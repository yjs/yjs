import {
  mergeDeleteSets,
  iterateDeletedStructs,
  keepItem,
  transact,
  createID,
  redoItem,
  iterateStructs,
  isParentOf,
  followRedone,
  getItemCleanStart,
  getState,
  ID, Transaction, Doc, Item, GC, DeleteSet, AbstractType // eslint-disable-line
} from '../internals.js'

import * as time from 'lib0/time.js'
import { Observable } from 'lib0/observable.js'

class StackItem {
  /**
   * @param {DeleteSet} ds
   * @param {Map<number,number>} beforeState
   * @param {Map<number,number>} afterState
   */
  constructor (ds, beforeState, afterState) {
    this.ds = ds
    this.beforeState = beforeState
    this.afterState = afterState
    /**
     * Use this to save and restore metadata like selection range
     */
    this.meta = new Map()
  }
}

/**
 * @param {UndoManager} undoManager
 * @param {Array<StackItem>} stack
 * @param {string} eventType
 * @return {StackItem?}
 */
const popStackItem = (undoManager, stack, eventType) => {
  /**
   * Whether a change happened
   * @type {StackItem?}
   */
  let result = null
  const doc = undoManager.doc
  const scope = undoManager.scope
  transact(doc, transaction => {
    while (stack.length > 0 && result === null) {
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
      stackItem.afterState.forEach((endClock, client) => {
        const startClock = stackItem.beforeState.get(client) || 0
        const len = endClock - startClock
        // @todo iterateStructs should not need the structs parameter
        const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client))
        if (startClock !== endClock) {
          // make sure structs don't overlap with the range of created operations [stackItem.start, stackItem.start + stackItem.end)
          // this must be executed before deleted structs are iterated.
          getItemCleanStart(transaction, createID(client, startClock))
          if (endClock < getState(doc.store, client)) {
            getItemCleanStart(transaction, createID(client, endClock))
          }
          iterateStructs(transaction, structs, startClock, len, struct => {
            if (struct instanceof Item) {
              if (struct.redone !== null) {
                let { item, diff } = followRedone(store, struct.id)
                if (diff > 0) {
                  item = getItemCleanStart(transaction, createID(item.id.client, item.id.clock + diff))
                }
                if (item.length > len) {
                  getItemCleanStart(transaction, createID(item.id.client, endClock))
                }
                struct = item
              }
              if (!struct.deleted && scope.some(type => isParentOf(type, /** @type {Item} */ (struct)))) {
                itemsToDelete.push(struct)
              }
            }
          })
        }
      })
      iterateDeletedStructs(transaction, stackItem.ds, struct => {
        const id = struct.id
        const clock = id.clock
        const client = id.client
        const startClock = stackItem.beforeState.get(client) || 0
        const endClock = stackItem.afterState.get(client) || 0
        if (
          struct instanceof Item &&
          scope.some(type => isParentOf(type, struct)) &&
          // Never redo structs in [stackItem.start, stackItem.start + stackItem.end) because they were created and deleted in the same capture interval.
          !(clock >= startClock && clock < endClock)
        ) {
          itemsToRedo.add(struct)
        }
      })
      itemsToRedo.forEach(struct => {
        performedChange = redoItem(transaction, struct, itemsToRedo) !== null || performedChange
      })
      // We want to delete in reverse order so that children are deleted before
      // parents, so we have more information available when items are filtered.
      for (let i = itemsToDelete.length - 1; i >= 0; i--) {
        const item = itemsToDelete[i]
        if (undoManager.deleteFilter(item)) {
          item.delete(transaction)
          performedChange = true
        }
      }
      result = stackItem
    }
    transaction.changed.forEach((subProps, type) => {
      // destroy search marker if necessary
      if (subProps.has(null) && type._searchMarker) {
        type._searchMarker.length = 0
      }
    })
  }, undoManager)
  if (result != null) {
    undoManager.emit('stack-item-popped', [{ stackItem: result, type: eventType }, undoManager])
  }
  return result
}

/**
 * @typedef {Object} UndoManagerOptions
 * @property {number} [UndoManagerOptions.captureTimeout=500]
 * @property {function(Item):boolean} [UndoManagerOptions.deleteFilter=()=>true] Sometimes
 * it is necessary to filter whan an Undo/Redo operation can delete. If this
 * filter returns false, the type/item won't be deleted even it is in the
 * undo/redo scope.
 * @property {Set<any>} [UndoManagerOptions.trackedOrigins=new Set([null])]
 */

/**
 * Fires 'stack-item-added' event when a stack item was added to either the undo- or
 * the redo-stack. You may store additional stack information via the
 * metadata property on `event.stackItem.meta` (it is a `Map` of metadata properties).
 * Fires 'stack-item-popped' event when a stack item was popped from either the
 * undo- or the redo-stack. You may restore the saved stack information from `event.stackItem.meta`.
 *
 * @extends {Observable<'stack-item-added'|'stack-item-popped'>}
 */
export class UndoManager extends Observable {
  /**
   * @param {AbstractType<any>|Array<AbstractType<any>>} typeScope Accepts either a single type, or an array of types
   * @param {UndoManagerOptions} options
   */
  constructor (typeScope, { captureTimeout = 500, deleteFilter = () => true, trackedOrigins = new Set([null]) } = {}) {
    super()
    this.scope = typeScope instanceof Array ? typeScope : [typeScope]
    this.deleteFilter = deleteFilter
    trackedOrigins.add(this)
    this.trackedOrigins = trackedOrigins
    /**
     * @type {Array<StackItem>}
     */
    this.undoStack = []
    /**
     * @type {Array<StackItem>}
     */
    this.redoStack = []
    /**
     * Whether the client is currently undoing (calling UndoManager.undo)
     *
     * @type {boolean}
     */
    this.undoing = false
    this.redoing = false
    this.doc = /** @type {Doc} */ (this.scope[0].doc)
    this.lastChange = 0
    this.doc.on('afterTransaction', /** @param {Transaction} transaction */ transaction => {
      // Only track certain transactions
      if (!this.scope.some(type => transaction.changedParentTypes.has(type)) || (!this.trackedOrigins.has(transaction.origin) && (!transaction.origin || !this.trackedOrigins.has(transaction.origin.constructor)))) {
        return
      }
      const undoing = this.undoing
      const redoing = this.redoing
      const stack = undoing ? this.redoStack : this.undoStack
      if (undoing) {
        this.stopCapturing() // next undo should not be appended to last stack item
      } else if (!redoing) {
        // neither undoing nor redoing: delete redoStack
        this.redoStack = []
      }
      const beforeState = transaction.beforeState
      const afterState = transaction.afterState
      const now = time.getUnixTime()
      if (now - this.lastChange < captureTimeout && stack.length > 0 && !undoing && !redoing) {
        // append change to last stack op
        const lastOp = stack[stack.length - 1]
        lastOp.ds = mergeDeleteSets([lastOp.ds, transaction.deleteSet])
        lastOp.afterState = afterState
      } else {
        // create a new stack op
        stack.push(new StackItem(transaction.deleteSet, beforeState, afterState))
      }
      if (!undoing && !redoing) {
        this.lastChange = now
      }
      // make sure that deleted structs are not gc'd
      iterateDeletedStructs(transaction, transaction.deleteSet, /** @param {Item|GC} item */ item => {
        if (item instanceof Item && this.scope.some(type => isParentOf(type, item))) {
          keepItem(item, true)
        }
      })
      this.emit('stack-item-added', [{ stackItem: stack[stack.length - 1], origin: transaction.origin, type: undoing ? 'redo' : 'undo' }, this])
    })
  }

  clear () {
    this.doc.transact(transaction => {
      /**
       * @param {StackItem} stackItem
       */
      const clearItem = stackItem => {
        iterateDeletedStructs(transaction, stackItem.ds, item => {
          if (item instanceof Item && this.scope.some(type => isParentOf(type, item))) {
            keepItem(item, false)
          }
        })
      }
      this.undoStack.forEach(clearItem)
      this.redoStack.forEach(clearItem)
    })
    this.undoStack = []
    this.redoStack = []
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
}
