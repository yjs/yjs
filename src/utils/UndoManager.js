import {
  mergeDeleteSets,
  iterateDeletedStructs,
  keepItem,
  transact,
  createID,
  redoItem,
  isParentOf,
  followRedone,
  getItemCleanStart,
  isDeleted,
  addToDeleteSet,
  getState,
  findIndexSS,
  findIndexCleanStart,
  YEvent, Transaction, Doc, Item, GC, DeleteSet, AbstractType // eslint-disable-line
} from '../internals.js'

import * as time from 'lib0/time'
import * as array from 'lib0/array'
import * as logging from 'lib0/logging'
import { ObservableV2 } from 'lib0/observable'

export class StackItem {
  /**
   * @param {DeleteSet} deletions
   * @param {DeleteSet} insertions
   */
  constructor (deletions, insertions) {
    this.insertions = insertions
    this.deletions = deletions
    /**
     * Use this to save and restore metadata like selection range
     */
    this.meta = new Map()
  }
}
/**
 * The UndoManagers of each document. keep is one flag per item that every UndoManager on a document
 * shares, so after a release, clear() keeps again what the UndoManagers of the document still need.
 *
 * @type {WeakMap<Doc, Set<UndoManager>>}
 */
const undoManagers = new WeakMap()

/**
 * Calls f on the items of `client` that overlap a range. An item that only partly overlaps is
 * split only if `split(item)` is true: a split changes the structs that undo and redo work on
 * later, so it only happens where f changes the item.
 *
 * @param {Transaction} tr
 * @param {number} client
 * @param {number} clock
 * @param {number} len
 * @param {function(Item):boolean} split
 * @param {function(Item):void} f
 */
const forEachItemInRange = (tr, client, clock, len, split, f) => {
  const structs = /** @type {Array<Item|GC>|undefined} */ (tr.doc.store.clients.get(client))
  if (structs === undefined || len === 0) return
  const lastStruct = structs[structs.length - 1]
  if (clock >= lastStruct.id.clock + lastStruct.length) return
  const end = clock + len
  for (let index = findIndexSS(structs, clock); index < structs.length && structs[index].id.clock < end; index++) {
    let struct = structs[index]
    if (struct instanceof Item && split(struct)) {
      if (struct.id.clock < clock) {
        index = findIndexCleanStart(tr, structs, clock)
        struct = structs[index]
      }
      if (struct.id.clock + struct.length > end) {
        findIndexCleanStart(tr, structs, end)
      }
    }
    if (struct instanceof Item) {
      f(struct)
    }
  }
}

/**
 * Calls f on the items that an UndoManager keeps for its stack items: the items they deleted, the
 * items they inserted that were redone, and the items those were redone to, which undo and redo
 * follow through `redone`.
 *
 * `own` is true for the items that these stack items deleted and the items that their undo or redo
 * created. The others (inserts and what they were redone to) may belong to another UndoManager.
 *
 * @param {Transaction} tr
 * @param {UndoManager} um
 * @param {Array<StackItem>} stackItems
 * @param {function(Item,boolean):boolean} split whether f changes an item (see forEachItemInRange)
 * @param {function(Item,boolean):void} f called with the item and `own`
 */
const forEachKeptItem = (tr, um, stackItems, split, f) => {
  /**
   * Items already visited (with `own`), with what they were redone to: chains of redone items
   * overlap.
   *
   * @type {Map<Item,boolean>}
   */
  const visited = new Map()
  /**
   * @param {boolean} own
   * @return {function(Item):void}
   */
  const visit = own => item => {
    const seen = visited.get(item)
    if (seen !== undefined && (seen || !own)) return
    if (seen !== undefined) {
      // visited as part of a chain, but it is one of these stack items' own
      visited.set(item, true)
      f(item, true)
    } else if ((own || item.redone !== null) && um.scope.some(type => type === tr.doc || isParentOf(/** @type {AbstractType<any>} */ (type), item))) {
      visited.set(item, own)
      f(item, own)
      // follow `redone` to every item the item was redone to (they may have been split since)
      const redone = [item]
      while (redone.length > 0) {
        const it = /** @type {Item} */ (redone.pop())
        if (it.redone !== null) {
          forEachItemInRange(tr, it.redone.client, it.redone.clock, it.length, next => split(next, false), next => {
            if (!visited.has(next)) {
              visited.set(next, false)
              f(next, false)
              redone.push(next)
            }
          })
        }
      }
    }
  }
  /**
   * @param {DeleteSet} ds
   * @param {boolean} own
   */
  const visitIds = (ds, own) => {
    ds.clients.forEach((ranges, client) => {
      ranges.forEach(range => forEachItemInRange(tr, client, range.clock, range.len, item => split(item, own), visit(own)))
    })
  }
  // one merged set each: many small sets would visit the structs many times
  visitIds(mergeDeleteSets(stackItems.map(stackItem => stackItem.deletions)), true)
  visitIds(mergeDeleteSets(stackItems.map(stackItem => stackItem.insertions)), false)
}

/**
 * Release what an UndoManager kept for these stack items, with all parents.
 *
 * keepItem stops at a parent that is not kept, but the parents above it may still be kept for this
 * item. So this walks up until it meets a parent that it released itself.
 *
 * It leaves alone an item that isn't deleted and that these stack items didn't create (what
 * another UndoManager's undo or redo created): a live item can't be collected, and its creator,
 * or something else, keeps it.
 *
 * @param {Transaction} tr
 * @param {UndoManager} um
 * @param {Array<StackItem>} stackItems
 * @param {Set<Item>} released the items released so far
 * @return {boolean} whether an item was kept
 */
const releaseStackItems = (tr, um, stackItems, released) => {
  let wasKept = false
  forEachKeptItem(tr, um, stackItems, (item, own) => item.keep && (own || item.deleted), (item, own) => {
    if (!own && !item.deleted) return
    for (let it = /** @type {Item|null} */ (item); it !== null && !released.has(it); it = /** @type {AbstractType<any>} */ (it.parent)._item) {
      wasKept = wasKept || it.keep
      it.keep = false
      released.add(it)
    }
  })
  return wasKept
}

/**
 * Keep what the UndoManagers of a document still need, with all parents.
 *
 * keepItem stops at a parent that is already kept, but a release may have released the parents of
 * an item that is still kept. So this walks up until it meets a parent that it kept itself.
 *
 * @param {Transaction} tr
 */
const keepWhatUndoManagersNeed = tr => {
  /**
   * @type {Set<Item>}
   */
  const kept = new Set()
  /**
   * @param {Item} item
   */
  const keep = item => {
    for (let it = /** @type {Item|null} */ (item); it !== null && !kept.has(it); it = /** @type {AbstractType<any>} */ (it.parent)._item) {
      it.keep = true
      kept.add(it)
    }
  }
  const ums = undoManagers.get(tr.doc)
  if (ums !== undefined) {
    ums.forEach(um => {
      forEachKeptItem(tr, um, um.undoStack.concat(um.redoStack, um.poppedStackItems), (item, own) => !item.keep && (own || item.deleted), (item, own) => { if (own || item.deleted) keep(item) })
    })
  }
}

/**
 * @param {UndoManager} undoManager
 * @param {Array<StackItem>} stack
 * @param {'undo'|'redo'} eventType
 * @return {StackItem?}
 */
const popStackItem = (undoManager, stack, eventType) => {
  /**
   * Keep a reference to the transaction so we can fire the event with the changedParentTypes
   * @type {any}
   */
  let _tr = null
  const doc = undoManager.doc
  const scope = undoManager.scope
  transact(doc, transaction => {
    // the items redoItem creates (this pop may run inside a larger transaction)
    const createdFrom = getState(doc.store, doc.clientID)
    /**
     * @type {Array<DeleteSet>}
     */
    const poppedDeletions = []
    /**
     * @type {Array<DeleteSet>}
     */
    const poppedInsertions = []
    while (stack.length > 0 && undoManager.currStackItem === null) {
      const store = doc.store
      const stackItem = /** @type {StackItem} */ (stack.pop())
      /**
       * @type {Set<Item>}
       */
      const itemsToRedo = new Set()
      /**
       * @type {Array<Item>}
       */
      const itemsToDelete = []
      let performedChange = false
      iterateDeletedStructs(transaction, stackItem.insertions, struct => {
        if (struct instanceof Item) {
          if (struct.redone !== null) {
            let { item, diff } = followRedone(store, struct.id)
            if (diff > 0) {
              item = getItemCleanStart(transaction, createID(item.id.client, item.id.clock + diff))
            }
            struct = item
          }
          if (!struct.deleted && scope.some(type => type === transaction.doc || isParentOf(/** @type {AbstractType<any>} */ (type), /** @type {Item} */ (struct)))) {
            itemsToDelete.push(struct)
          }
        }
      })
      iterateDeletedStructs(transaction, stackItem.deletions, struct => {
        if (
          struct instanceof Item &&
          scope.some(type => type === transaction.doc || isParentOf(/** @type {AbstractType<any>} */ (type), struct)) &&
          // Never redo structs in stackItem.insertions because they were created and deleted in the same capture interval.
          !isDeleted(stackItem.insertions, struct.id)
        ) {
          itemsToRedo.add(struct)
        }
      })
      /**
       * @type {Set<Item>}
       */
      const redone = new Set()
      while (redone.size < itemsToRedo.size) {
        itemsToRedo.forEach(struct => {
          if (!redone.has(struct)) {
            redone.add(struct)
            performedChange = redoItem(transaction, struct, itemsToRedo, stackItem.insertions, undoManager.ignoreRemoteMapChanges, undoManager) !== null || performedChange
          }
        })
        // redoItem splits an item when an item next to it was redone into the middle of it. Redo
        // the part that was split off too.
        iterateDeletedStructs(transaction, stackItem.deletions, struct => {
          if (struct instanceof Item && struct.redone === null && !redone.has(struct) && !isDeleted(stackItem.insertions, struct.id) && scope.some(type => type === transaction.doc || isParentOf(/** @type {AbstractType<any>} */ (type), struct))) {
            itemsToRedo.add(struct)
          }
        })
      }
      // We want to delete in reverse order so that children are deleted before
      // parents, so we have more information available when items are filtered.
      for (let i = itemsToDelete.length - 1; i >= 0; i--) {
        const item = itemsToDelete[i]
        if (undoManager.deleteFilter(item)) {
          item.delete(transaction)
          performedChange = true
        }
      }
      undoManager.currStackItem = performedChange ? stackItem : null
      poppedDeletions.push(stackItem.deletions)
      poppedInsertions.push(stackItem.insertions)
    }
    // The popped stack items are on no stack anymore. What they kept, and the items that redoItem
    // created (and kept), stay kept until clear(). The created items are kept like deletions.
    const redone = new DeleteSet()
    const createdTo = getState(doc.store, doc.clientID)
    if (createdTo > createdFrom) {
      addToDeleteSet(redone, doc.clientID, createdFrom, createdTo - createdFrom)
    }
    poppedDeletions.push(redone)
    const insertions = mergeDeleteSets(poppedInsertions)
    const deletions = mergeDeleteSets(poppedDeletions)
    if (insertions.clients.size > 0 || deletions.clients.size > 0) {
      undoManager.poppedStackItems.push(new StackItem(deletions, insertions))
    }
    transaction.changed.forEach((subProps, type) => {
      // destroy search marker if necessary
      if (subProps.has(null) && type._searchMarker) {
        type._searchMarker.length = 0
      }
    })
    _tr = transaction
  }, undoManager)
  const res = undoManager.currStackItem
  if (res != null) {
    const changedParentTypes = _tr.changedParentTypes
    undoManager.emit('stack-item-popped', [{ stackItem: res, type: eventType, changedParentTypes, origin: undoManager }, undoManager])
    undoManager.currStackItem = null
  }
  return res
}

/**
 * @typedef {Object} UndoManagerOptions
 * @property {number} [UndoManagerOptions.captureTimeout=500]
 * @property {function(Transaction):boolean} [UndoManagerOptions.captureTransaction] Do not capture changes of a Transaction if result false.
 * @property {function(Item):boolean} [UndoManagerOptions.deleteFilter=()=>true] Sometimes
 * it is necessary to filter what an Undo/Redo operation can delete. If this
 * filter returns false, the type/item won't be deleted even it is in the
 * undo/redo scope.
 * @property {Set<any>} [UndoManagerOptions.trackedOrigins=new Set([null])]
 * @property {boolean} [ignoreRemoteMapChanges] Experimental. By default, the UndoManager will never overwrite remote changes. Enable this property to enable overwriting remote changes on key-value changes (Y.Map, properties on Y.Xml, etc..).
 * @property {Doc} [doc] The document that this UndoManager operates on. Only needed if typeScope is empty.
 */

/**
 * @typedef {Object} StackItemEvent
 * @property {StackItem} StackItemEvent.stackItem
 * @property {any} StackItemEvent.origin
 * @property {'undo'|'redo'} StackItemEvent.type
 * @property {Map<AbstractType<YEvent<any>>,Array<YEvent<any>>>} StackItemEvent.changedParentTypes
 */

/**
 * Fires 'stack-item-added' event when a stack item was added to either the undo- or
 * the redo-stack. You may store additional stack information via the
 * metadata property on `event.stackItem.meta` (it is a `Map` of metadata properties).
 * Fires 'stack-item-popped' event when a stack item was popped from either the
 * undo- or the redo-stack. You may restore the saved stack information from `event.stackItem.meta`.
 *
 * @extends {ObservableV2<{'stack-item-added':function(StackItemEvent, UndoManager):void, 'stack-item-popped': function(StackItemEvent, UndoManager):void, 'stack-cleared': function({ undoStackCleared: boolean, redoStackCleared: boolean }):void, 'stack-item-updated': function(StackItemEvent, UndoManager):void }>}
 */
export class UndoManager extends ObservableV2 {
  /**
   * @param {Doc|AbstractType<any>|Array<AbstractType<any>>} typeScope Limits the scope of the UndoManager. If this is set to a ydoc instance, all changes on that ydoc will be undone. If set to a specific type, only changes on that type or its children will be undone. Also accepts an array of types.
   * @param {UndoManagerOptions} options
   */
  constructor (typeScope, {
    captureTimeout = 500,
    captureTransaction = _tr => true,
    deleteFilter = () => true,
    trackedOrigins = new Set([null]),
    ignoreRemoteMapChanges = false,
    doc = /** @type {Doc} */ (array.isArray(typeScope) ? typeScope[0].doc : typeScope instanceof Doc ? typeScope : typeScope.doc)
  } = {}) {
    super()
    /**
     * @type {Array<AbstractType<any> | Doc>}
     */
    this.scope = []
    this.doc = doc
    this.addToScope(typeScope)
    this.deleteFilter = deleteFilter
    trackedOrigins.add(this)
    this.trackedOrigins = trackedOrigins
    this.captureTransaction = captureTransaction
    /**
     * @type {Array<StackItem>}
     */
    this.undoStack = []
    /**
     * @type {Array<StackItem>}
     */
    this.redoStack = []
    /**
     * What undo() and redo() took off the stacks and still keep until clear(): `deletions` are the
     * items that the popped stack items deleted and the items that the undo or redo created,
     * `insertions` the items that the popped stack items inserted.
     *
     * @type {Array<StackItem>}
     */
    this.poppedStackItems = []
    /**
     * Whether the client is currently undoing (calling UndoManager.undo)
     *
     * @type {boolean}
     */
    this.undoing = false
    this.redoing = false
    /**
     * The currently popped stack item if UndoManager.undoing or UndoManager.redoing
     *
     * @type {StackItem|null}
     */
    this.currStackItem = null
    this.lastChange = 0
    this.ignoreRemoteMapChanges = ignoreRemoteMapChanges
    this.captureTimeout = captureTimeout
    /**
     * @param {Transaction} transaction
     */
    this.afterTransactionHandler = transaction => {
      // Only track certain transactions
      if (
        !this.captureTransaction(transaction) ||
        !this.scope.some(type => transaction.changedParentTypes.has(/** @type {AbstractType<any>} */ (type)) || type === this.doc) ||
        (!this.trackedOrigins.has(transaction.origin) && (!transaction.origin || !this.trackedOrigins.has(transaction.origin.constructor)))
      ) {
        return
      }
      const undoing = this.undoing
      const redoing = this.redoing
      const stack = undoing ? this.redoStack : this.undoStack
      if (undoing) {
        this.stopCapturing() // next undo should not be appended to last stack item
      } else if (!redoing) {
        // neither undoing nor redoing: delete redoStack
        this.clear(false, true)
      }
      const insertions = new DeleteSet()
      transaction.afterState.forEach((endClock, client) => {
        const startClock = transaction.beforeState.get(client) || 0
        const len = endClock - startClock
        if (len > 0) {
          addToDeleteSet(insertions, client, startClock, len)
        }
      })
      const now = time.getUnixTime()
      let didAdd = false
      if (this.lastChange > 0 && now - this.lastChange < this.captureTimeout && stack.length > 0 && !undoing && !redoing) {
        // append change to last stack op
        const lastOp = stack[stack.length - 1]
        lastOp.deletions = mergeDeleteSets([lastOp.deletions, transaction.deleteSet])
        lastOp.insertions = mergeDeleteSets([lastOp.insertions, insertions])
      } else {
        // create a new stack op
        stack.push(new StackItem(transaction.deleteSet, insertions))
        didAdd = true
      }
      if (!undoing && !redoing) {
        this.lastChange = now
      }
      // make sure that deleted structs are not gc'd
      iterateDeletedStructs(transaction, transaction.deleteSet, /** @param {Item|GC} item */ item => {
        if (item instanceof Item && this.scope.some(type => type === transaction.doc || isParentOf(/** @type {AbstractType<any>} */ (type), item))) {
          keepItem(item, true)
        }
      })
      /**
       * @type {[StackItemEvent, UndoManager]}
       */
      const changeEvent = [{ stackItem: stack[stack.length - 1], origin: transaction.origin, type: undoing ? 'redo' : 'undo', changedParentTypes: transaction.changedParentTypes }, this]
      if (didAdd) {
        this.emit('stack-item-added', changeEvent)
      } else {
        this.emit('stack-item-updated', changeEvent)
      }
    }
    this.destroy = this.destroy.bind(this)
    let docUndoManagers = undoManagers.get(this.doc)
    if (docUndoManagers === undefined) {
      docUndoManagers = new Set()
      undoManagers.set(this.doc, docUndoManagers)
    }
    docUndoManagers.add(this)
    this.doc.on('afterTransaction', this.afterTransactionHandler)
    this.doc.on('destroy', this.destroy)
  }

  /**
   * Extend the scope.
   *
   * @param {Array<AbstractType<any> | Doc> | AbstractType<any> | Doc} ytypes
   */
  addToScope (ytypes) {
    const tmpSet = new Set(this.scope)
    ytypes = array.isArray(ytypes) ? ytypes : [ytypes]
    ytypes.forEach(ytype => {
      if (!tmpSet.has(ytype)) {
        tmpSet.add(ytype)
        if (ytype instanceof AbstractType ? ytype.doc !== this.doc : ytype !== this.doc) logging.warn('[yjs#509] Not same Y.Doc') // use MultiDocUndoManager instead. also see https://github.com/yjs/yjs/issues/509
        this.scope.push(ytype)
      }
    })
  }

  /**
   * @param {any} origin
   */
  addTrackedOrigin (origin) {
    this.trackedOrigins.add(origin)
  }

  /**
   * @param {any} origin
   */
  removeTrackedOrigin (origin) {
    this.trackedOrigins.delete(origin)
  }

  clear (clearUndoStack = true, clearRedoStack = true) {
    const clearPopped = (clearUndoStack || clearRedoStack) && this.poppedStackItems.length > 0
    if ((clearUndoStack && this.canUndo()) || (clearRedoStack && this.canRedo()) || clearPopped) {
      this.doc.transact(tr => {
        /**
         * @type {Set<Item>}
         */
        const releasedItems = new Set()
        let released = false
        if (clearUndoStack) {
          released = releaseStackItems(tr, this, this.undoStack, releasedItems) || released
          this.undoStack = []
        }
        if (clearRedoStack) {
          released = releaseStackItems(tr, this, this.redoStack, releasedItems) || released
          this.redoStack = []
        }
        if (clearPopped) {
          released = releaseStackItems(tr, this, this.poppedStackItems, releasedItems) || released
          this.poppedStackItems = []
        }
        if (released) {
          // Releasing an item releases its parents too, also what another UndoManager, or a
          // stack item that remains, still needs. Keep that again.
          keepWhatUndoManagersNeed(tr)
        }
        this.emit('stack-cleared', [{ undoStackCleared: clearUndoStack, redoStackCleared: clearRedoStack }])
      })
    }
  }

  /**
   * UndoManager merges Undo-StackItem if they are created within time-gap
   * smaller than `options.captureTimeout`. Call `um.stopCapturing()` so that the next
   * StackItem won't be merged.
   *
   *
   * @example
   *     // without stopCapturing
   *     ytext.insert(0, 'a')
   *     ytext.insert(1, 'b')
   *     um.undo()
   *     ytext.toString() // => '' (note that 'ab' was removed)
   *     // with stopCapturing
   *     ytext.insert(0, 'a')
   *     um.stopCapturing()
   *     ytext.insert(0, 'b')
   *     um.undo()
   *     ytext.toString() // => 'a' (note that only 'b' was removed)
   *
   */
  stopCapturing () {
    this.lastChange = 0
  }

  /**
   * Undo last changes on type.
   *
   * @return {StackItem?} Returns StackItem if a change was applied
   */
  undo () {
    this.undoing = true
    let res
    try {
      res = popStackItem(this, this.undoStack, 'undo')
    } finally {
      this.undoing = false
    }
    return res
  }

  /**
   * Redo last undo operation.
   *
   * @return {StackItem?} Returns StackItem if a change was applied
   */
  redo () {
    this.redoing = true
    let res
    try {
      res = popStackItem(this, this.redoStack, 'redo')
    } finally {
      this.redoing = false
    }
    return res
  }

  /**
   * Are undo steps available?
   *
   * @return {boolean} `true` if undo is possible
   */
  canUndo () {
    return this.undoStack.length > 0
  }

  /**
   * Are redo steps available?
   *
   * @return {boolean} `true` if redo is possible
   */
  canRedo () {
    return this.redoStack.length > 0
  }

  destroy () {
    const docUndoManagers = undoManagers.get(this.doc)
    if (docUndoManagers !== undefined) {
      docUndoManagers.delete(this)
    }
    this.trackedOrigins.delete(this)
    this.doc.off('afterTransaction', this.afterTransactionHandler)
    this.doc.off('destroy', this.destroy)
    super.destroy()
  }
}
