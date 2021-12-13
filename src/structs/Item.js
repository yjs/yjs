
import {
  GC,
  getState,
  AbstractStruct,
  replaceStruct,
  addStruct,
  addToDeleteSet,
  findRootTypeKey,
  compareIDs,
  getItem,
  getItemCleanEnd,
  getItemCleanStart,
  readContentDeleted,
  readContentBinary,
  readContentJSON,
  readContentAny,
  readContentString,
  readContentEmbed,
  readContentDoc,
  createID,
  readContentFormat,
  readContentType,
  readContentMove,
  addChangedTypeToTransaction,
  UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, ContentType, ContentDeleted, StructStore, ID, AbstractType, Transaction // eslint-disable-line
} from '../internals.js'

import * as error from 'lib0/error'
import * as binary from 'lib0/binary'
import { ContentMove } from './ContentMove.js'

/**
 * @todo This should return several items
 *
 * @param {StructStore} store
 * @param {ID} id
 * @return {{item:Item, diff:number}}
 */
export const followRedone = (store, id) => {
  /**
   * @type {ID|null}
   */
  let nextID = id
  let diff = 0
  let item
  do {
    if (diff > 0) {
      nextID = createID(nextID.client, nextID.clock + diff)
    }
    item = getItem(store, nextID)
    diff = nextID.clock - item.id.clock
    nextID = item.redone
  } while (nextID !== null && item instanceof Item)
  return {
    item, diff
  }
}

/**
 * Make sure that neither item nor any of its parents is ever deleted.
 *
 * This property does not persist when storing it into a database or when
 * sending it to other peers
 *
 * @param {Item|null} item
 * @param {boolean} keep
 */
export const keepItem = (item, keep) => {
  while (item !== null && item.keep !== keep) {
    item.keep = keep
    item = /** @type {AbstractType<any>} */ (item.parent)._item
  }
}

/**
 * Split leftItem into two items
 * @param {Transaction} transaction
 * @param {Item} leftItem
 * @param {number} diff
 * @return {Item}
 *
 * @function
 * @private
 */
export const splitItem = (transaction, leftItem, diff) => {
  // create rightItem
  const { client, clock } = leftItem.id
  const rightItem = new Item(
    createID(client, clock + diff),
    leftItem,
    createID(client, clock + diff - 1),
    leftItem.right,
    leftItem.rightOrigin,
    leftItem.parent,
    leftItem.parentSub,
    leftItem.content.splice(diff)
  )
  if (leftItem.deleted) {
    rightItem.markDeleted()
  }
  if (leftItem.keep) {
    rightItem.keep = true
  }
  if (leftItem.redone !== null) {
    rightItem.redone = createID(leftItem.redone.client, leftItem.redone.clock + diff)
  }
  // update left (do not set leftItem.rightOrigin as it will lead to problems when syncing)
  leftItem.right = rightItem
  // update right
  if (rightItem.right !== null) {
    rightItem.right.left = rightItem
  }
  // right is more specific.
  transaction._mergeStructs.push(rightItem)
  // update parent._map
  if (rightItem.parentSub !== null && rightItem.right === null) {
    /** @type {AbstractType<any>} */ (rightItem.parent)._map.set(rightItem.parentSub, rightItem)
  }
  leftItem.length = diff
  if (leftItem.moved) {
    const m = transaction.prevMoved.get(leftItem)
    if (m) {
      transaction.prevMoved.set(rightItem, m)
    }
  }
  return rightItem
}

/**
 * Redoes the effect of this operation.
 *
 * @param {Transaction} transaction The Yjs instance.
 * @param {Item} item
 * @param {Set<Item>} redoitems
 * @param {Array<Item>} itemsToDelete
 *
 * @return {Item|null}
 *
 * @private
 */
export const redoItem = (transaction, item, redoitems, itemsToDelete) => {
  const doc = transaction.doc
  const store = doc.store
  const ownClientID = doc.clientID
  const redone = item.redone
  if (redone !== null) {
    return getItemCleanStart(transaction, redone)
  }
  let parentItem = /** @type {AbstractType<any>} */ (item.parent)._item
  /**
   * @type {Item|null}
   */
  let left
  /**
   * @type {Item|null}
   */
  let right
  if (item.parentSub === null) {
    // Is an array item. Insert at the old position
    left = item.left
    right = item
  } else {
    // Is a map item. Insert as current value
    left = item
    while (left.right !== null) {
      left = left.right
      if (left.id.client !== ownClientID) {
        // It is not possible to redo this item because it conflicts with a
        // change from another client
        return null
      }
    }
    if (left.right !== null) {
      left = /** @type {Item} */ (/** @type {AbstractType<any>} */ (item.parent)._map.get(item.parentSub))
    }
    right = null
  }
  // make sure that parent is redone
  if (parentItem !== null && parentItem.deleted === true && parentItem.redone === null) {
    // try to undo parent if it will be undone anyway
    if (!redoitems.has(parentItem) || redoItem(transaction, parentItem, redoitems, itemsToDelete) === null) {
      return null
    }
  }
  if (parentItem !== null && parentItem.redone !== null) {
    while (parentItem.redone !== null) {
      parentItem = getItemCleanStart(transaction, parentItem.redone)
    }
    // find next cloned_redo items
    while (left !== null) {
      /**
       * @type {Item|null}
       */
      let leftTrace = left
      // trace redone until parent matches
      while (leftTrace !== null && /** @type {AbstractType<any>} */ (leftTrace.parent)._item !== parentItem) {
        leftTrace = leftTrace.redone === null ? null : getItemCleanStart(transaction, leftTrace.redone)
      }
      if (leftTrace !== null && /** @type {AbstractType<any>} */ (leftTrace.parent)._item === parentItem) {
        left = leftTrace
        break
      }
      left = left.left
    }
    while (right !== null) {
      /**
       * @type {Item|null}
       */
      let rightTrace = right
      // trace redone until parent matches
      while (rightTrace !== null && /** @type {AbstractType<any>} */ (rightTrace.parent)._item !== parentItem) {
        rightTrace = rightTrace.redone === null ? null : getItemCleanStart(transaction, rightTrace.redone)
      }
      if (rightTrace !== null && /** @type {AbstractType<any>} */ (rightTrace.parent)._item === parentItem) {
        right = rightTrace
        break
      }
      right = right.right
    }
    // Iterate right while right is in itemsToDelete
    // If it is intended to delete right while item is redone, we can expect that item should replace right.
    while (left !== null && left.right !== null && left.right !== right && itemsToDelete.findIndex(d => d === /** @type {Item} */ (left).right) >= 0) {
      left = left.right
    }
  }
  const nextClock = getState(store, ownClientID)
  const nextId = createID(ownClientID, nextClock)
  const redoneItem = new Item(
    nextId,
    left, left && left.lastId,
    right, right && right.id,
    parentItem === null ? item.parent : /** @type {ContentType} */ (parentItem.content).type,
    item.parentSub,
    item.content.copy()
  )
  item.redone = nextId
  keepItem(redoneItem, true)
  redoneItem.integrate(transaction, 0)
  return redoneItem
}

/**
 * Abstract class that represents any content.
 */
export class Item extends AbstractStruct {
  /**
   * @param {ID} id
   * @param {Item | null} left
   * @param {ID | null} origin
   * @param {Item | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>|ID|null} parent Is a type if integrated, is null if it is possible to copy parent from left or right, is ID before integration to search for it.
   * @param {string | null} parentSub
   * @param {AbstractContent} content
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, content) {
    super(id, content.getLength())
    /**
     * The item that was originally to the left of this item.
     * @type {ID | null}
     */
    this.origin = origin
    /**
     * The item that is currently to the left of this item.
     * @type {Item | null}
     */
    this.left = left
    /**
     * The item that is currently to the right of this item.
     * @type {Item | null}
     */
    this.right = right
    /**
     * The item that was originally to the right of this item.
     * @type {ID | null}
     */
    this.rightOrigin = rightOrigin
    /**
     * @type {AbstractType<any>|ID|null}
     */
    this.parent = parent
    /**
     * If the parent refers to this item with some kind of key (e.g. YMap, the
     * key is specified here. The key is then used to refer to the list in which
     * to insert this item. If `parentSub = null` type._start is the list in
     * which to insert to. Otherwise it is `parent._map`.
     * @type {String | null}
     */
    this.parentSub = parentSub
    /**
     * If this type's effect is reundone this type refers to the type-id that undid
     * this operation.
     *
     * @type {ID | null}
     */
    this.redone = null
    /**
     * This property is reused by the moved prop. In this case this property refers to an Item.
     *
     * @type {Item | null}
     */
    this.moved = null
    /**
     * @type {AbstractContent}
     */
    this.content = content
    /**
     * bit1: keep
     * bit2: countable
     * bit3: deleted
     * bit4: mark - mark node as fast-search-marker
     * @type {number} byte
     */
    this.info = this.content.isCountable() ? binary.BIT2 : 0
  }

  /**
   * This is used to mark the item as an indexed fast-search marker
   *
   * @type {boolean}
   */
  set marker (isMarked) {
    if (((this.info & binary.BIT4) > 0) !== isMarked) {
      this.info ^= binary.BIT4
    }
  }

  get marker () {
    return (this.info & binary.BIT4) > 0
  }

  /**
   * If true, do not garbage collect this Item.
   */
  get keep () {
    return (this.info & binary.BIT1) > 0
  }

  set keep (doKeep) {
    if (this.keep !== doKeep) {
      this.info ^= binary.BIT1
    }
  }

  get countable () {
    return (this.info & binary.BIT2) > 0
  }

  /**
   * Whether this item was deleted or not.
   * @type {Boolean}
   */
  get deleted () {
    return (this.info & binary.BIT3) > 0
  }

  set deleted (doDelete) {
    if (this.deleted !== doDelete) {
      this.info ^= binary.BIT3
    }
  }

  markDeleted () {
    this.info |= binary.BIT3
  }

  /**
   * Return the creator clientID of the missing op or define missing items and return null.
   *
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @return {null | number}
   */
  getMissing (transaction, store) {
    if (this.origin && this.origin.client !== this.id.client && this.origin.clock >= getState(store, this.origin.client)) {
      return this.origin.client
    }
    if (this.rightOrigin && this.rightOrigin.client !== this.id.client && this.rightOrigin.clock >= getState(store, this.rightOrigin.client)) {
      return this.rightOrigin.client
    }
    if (this.parent && this.parent.constructor === ID && this.id.client !== this.parent.client && this.parent.clock >= getState(store, this.parent.client)) {
      return this.parent.client
    }
    if (this.content.constructor === ContentMove) {
      const c = /** @type {ContentMove} */ (this.content)
      const start = c.start.item
      const end = c.isCollapsed() ? null : c.end.item
      if (start && start.clock >= getState(store, start.client)) {
        return start.client
      }
      if (end && end.clock >= getState(store, end.client)) {
        return end.client
      }
    }

    // We have all missing ids, now find the items
    if (this.origin) {
      this.left = getItemCleanEnd(transaction, this.origin)
      this.origin = this.left.lastId
    }
    if (this.rightOrigin) {
      this.right = getItemCleanStart(transaction, this.rightOrigin)
      this.rightOrigin = this.right.id
    }
    if ((this.left && this.left.constructor === GC) || (this.right && this.right.constructor === GC)) {
      this.parent = null
    }
    // only set parent if this shouldn't be garbage collected
    if (!this.parent) {
      if (this.left && this.left.constructor === Item) {
        this.parent = this.left.parent
        this.parentSub = this.left.parentSub
      }
      if (this.right && this.right.constructor === Item) {
        this.parent = this.right.parent
        this.parentSub = this.right.parentSub
      }
    } else if (this.parent.constructor === ID) {
      const parentItem = getItem(store, this.parent)
      if (parentItem.constructor === GC) {
        this.parent = null
      } else {
        this.parent = /** @type {ContentType} */ (parentItem.content).type
      }
    }

    return null
  }

  /**
   * @param {Transaction} transaction
   * @param {number} offset
   */
  integrate (transaction, offset) {
    if (offset > 0) {
      this.id.clock += offset
      this.left = getItemCleanEnd(transaction, createID(this.id.client, this.id.clock - 1))
      this.origin = this.left.lastId
      this.content = this.content.splice(offset)
      this.length -= offset
    }

    if (this.parent) {
      if ((!this.left && (!this.right || this.right.left !== null)) || (this.left && this.left.right !== this.right)) {
        /**
         * @type {Item|null}
         */
        let left = this.left

        /**
         * @type {Item|null}
         */
        let o
        // set o to the first conflicting item
        if (left !== null) {
          o = left.right
        } else if (this.parentSub !== null) {
          o = /** @type {AbstractType<any>} */ (this.parent)._map.get(this.parentSub) || null
          while (o !== null && o.left !== null) {
            o = o.left
          }
        } else {
          o = /** @type {AbstractType<any>} */ (this.parent)._start
        }
        // TODO: use something like DeleteSet here (a tree implementation would be best)
        // @todo use global set definitions
        /**
         * @type {Set<Item>}
         */
        const conflictingItems = new Set()
        /**
         * @type {Set<Item>}
         */
        const itemsBeforeOrigin = new Set()
        // Let c in conflictingItems, b in itemsBeforeOrigin
        // ***{origin}bbbb{this}{c,b}{c,b}{o}***
        // Note that conflictingItems is a subset of itemsBeforeOrigin
        while (o !== null && o !== this.right) {
          itemsBeforeOrigin.add(o)
          conflictingItems.add(o)
          if (compareIDs(this.origin, o.origin)) {
            // case 1
            if (o.id.client < this.id.client) {
              left = o
              conflictingItems.clear()
            } else if (compareIDs(this.rightOrigin, o.rightOrigin)) {
              // this and o are conflicting and point to the same integration points. The id decides which item comes first.
              // Since this is to the left of o, we can break here
              break
            } // else, o might be integrated before an item that this conflicts with. If so, we will find it in the next iterations
          } else if (o.origin !== null && itemsBeforeOrigin.has(getItem(transaction.doc.store, o.origin))) { // use getItem instead of getItemCleanEnd because we don't want / need to split items.
            // case 2
            if (!conflictingItems.has(getItem(transaction.doc.store, o.origin))) {
              left = o
              conflictingItems.clear()
            }
          } else {
            break
          }
          o = o.right
        }
        this.left = left
      }
      // reconnect left/right + update parent map/start if necessary
      if (this.left !== null) {
        const right = this.left.right
        this.right = right
        this.left.right = this
      } else {
        let r
        if (this.parentSub !== null) {
          r = /** @type {AbstractType<any>} */ (this.parent)._map.get(this.parentSub) || null
          while (r !== null && r.left !== null) {
            r = r.left
          }
        } else {
          r = /** @type {AbstractType<any>} */ (this.parent)._start
          ;/** @type {AbstractType<any>} */ (this.parent)._start = this
        }
        this.right = r
      }
      if (this.right !== null) {
        this.right.left = this
      } else if (this.parentSub !== null) {
        // set as current parent value if right === null and this is parentSub
        /** @type {AbstractType<any>} */ (this.parent)._map.set(this.parentSub, this)
        if (this.left !== null) {
          // this is the current attribute value of parent. delete right
          this.left.delete(transaction)
        }
      }
      // adjust length of parent
      if (this.parentSub === null && this.countable && !this.deleted) {
        /** @type {AbstractType<any>} */ (this.parent)._length += this.length
      }
      addStruct(transaction.doc.store, this)
      this.content.integrate(transaction, this)
      // add parent to transaction.changed
      addChangedTypeToTransaction(transaction, /** @type {AbstractType<any>} */ (this.parent), this.parentSub)
      if ((/** @type {AbstractType<any>} */ (this.parent)._item !== null && /** @type {AbstractType<any>} */ (this.parent)._item.deleted) || (this.parentSub !== null && this.right !== null)) {
        // delete if parent is deleted or if this is not the current attribute value of parent
        this.delete(transaction)
      }
    } else {
      // parent is not defined. Integrate GC struct instead
      new GC(this.id, this.length).integrate(transaction, 0)
    }
  }

  /**
   * Returns the next non-deleted item
   */
  get next () {
    let n = this.right
    while (n !== null && n.deleted) {
      n = n.right
    }
    return n
  }

  /**
   * Returns the previous non-deleted item
   */
  get prev () {
    let n = this.left
    while (n !== null && n.deleted) {
      n = n.left
    }
    return n
  }

  /**
   * Computes the last content address of this Item.
   */
  get lastId () {
    // allocating ids is pretty costly because of the amount of ids created, so we try to reuse whenever possible
    return this.length === 1 ? this.id : createID(this.id.client, this.id.clock + this.length - 1)
  }

  /**
   * Try to merge two items
   *
   * @param {Item} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (
      this.constructor === right.constructor &&
      compareIDs(right.origin, this.lastId) &&
      this.right === right &&
      compareIDs(this.rightOrigin, right.rightOrigin) &&
      this.id.client === right.id.client &&
      this.id.clock + this.length === right.id.clock &&
      this.deleted === right.deleted &&
      this.redone === null &&
      right.redone === null &&
      this.moved === right.moved &&
      this.content.constructor === right.content.constructor &&
      this.content.mergeWith(right.content)
    ) {
      if (right.marker) {
        // Right will be "forgotten", so we delete all
        // search markers that reference right.
        const searchMarker = /** @type {AbstractType<any>} */ (this.parent)._searchMarker
        if (searchMarker) {
          for (let i = searchMarker.length - 1; i >= 0; i--) {
            if (searchMarker[i].nextItem === right) {
              // @todo do something more efficient than splicing..
              searchMarker.splice(i, 1)
            }
          }
        }
      }
      if (right.keep) {
        this.keep = true
      }
      this.right = right.right
      if (this.right !== null) {
        this.right.left = this
      }
      this.length += right.length
      return true
    }
    return false
  }

  /**
   * Mark this Item as deleted.
   *
   * @param {Transaction} transaction
   */
  delete (transaction) {
    if (!this.deleted) {
      const parent = /** @type {AbstractType<any>} */ (this.parent)
      // adjust the length of parent
      if (this.countable && this.parentSub === null) {
        parent._length -= this.length
      }
      this.markDeleted()
      addToDeleteSet(transaction.deleteSet, this.id.client, this.id.clock, this.length)
      addChangedTypeToTransaction(transaction, parent, this.parentSub)
      this.content.delete(transaction, this)
    }
  }

  /**
   * @param {StructStore} store
   * @param {boolean} parentGCd
   */
  gc (store, parentGCd) {
    if (!this.deleted) {
      throw error.unexpectedCase()
    }
    this.moved = null
    this.content.gc(store)
    if (parentGCd) {
      replaceStruct(store, this, new GC(this.id, this.length))
    } else {
      this.content = new ContentDeleted(this.length)
    }
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
   * @param {number} offset
   */
  write (encoder, offset) {
    const origin = offset > 0 ? createID(this.id.client, this.id.clock + offset - 1) : this.origin
    const rightOrigin = this.rightOrigin
    const parentSub = this.parentSub
    const info = (this.content.getRef() & binary.BITS5) |
      (origin === null ? 0 : binary.BIT8) | // origin is defined
      (rightOrigin === null ? 0 : binary.BIT7) | // right origin is defined
      (parentSub === null ? 0 : binary.BIT6) // parentSub is non-null
    encoder.writeInfo(info)
    if (origin !== null) {
      encoder.writeLeftID(origin)
    }
    if (rightOrigin !== null) {
      encoder.writeRightID(rightOrigin)
    }
    if (origin === null && rightOrigin === null) {
      const parent = /** @type {AbstractType<any>} */ (this.parent)
      if (parent._item !== undefined) {
        const parentItem = parent._item
        if (parentItem === null) {
          // parent type on y._map
          // find the correct key
          const ykey = findRootTypeKey(parent)
          encoder.writeParentInfo(true) // write parentYKey
          encoder.writeString(ykey)
        } else {
          encoder.writeParentInfo(false) // write parent id
          encoder.writeLeftID(parentItem.id)
        }
      } else if (parent.constructor === String) { // this edge case was added by differential updates
        encoder.writeParentInfo(true) // write parentYKey
        encoder.writeString(parent)
      } else if (parent.constructor === ID) {
        encoder.writeParentInfo(false) // write parent id
        encoder.writeLeftID(parent)
      } else {
        error.unexpectedCase()
      }
      if (parentSub !== null) {
        encoder.writeString(parentSub)
      }
    }
    this.content.write(encoder, offset)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @param {number} info
 */
export const readItemContent = (decoder, info) => contentRefs[info & binary.BITS5](decoder)

/**
 * A lookup map for reading Item content.
 *
 * @type {Array<function(UpdateDecoderV1 | UpdateDecoderV2):AbstractContent>}
 */
export const contentRefs = [
  () => { error.unexpectedCase() }, // GC is not ItemContent
  readContentDeleted, // 1
  readContentJSON, // 2
  readContentBinary, // 3
  readContentString, // 4
  readContentEmbed, // 5
  readContentFormat, // 6
  readContentType, // 7
  readContentAny, // 8
  readContentDoc, // 9
  () => { error.unexpectedCase() }, // 10 - Skip is not ItemContent
  readContentMove // 11
]

/**
 * Do not implement this class!
 */
export class AbstractContent {
  /**
   * @return {number}
   */
  getLength () {
    throw error.methodUnimplemented()
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    throw error.methodUnimplemented()
  }

  /**
   * Should return false if this Item is some kind of meta information
   * (e.g. format information).
   *
   * * Whether this Item should be addressable via `yarray.get(i)`
   * * Whether this Item should be counted when computing yarray.length
   *
   * @return {boolean}
   */
  isCountable () {
    throw error.methodUnimplemented()
  }

  /**
   * @return {AbstractContent}
   */
  copy () {
    throw error.methodUnimplemented()
  }

  /**
   * @param {number} offset
   * @return {AbstractContent}
   */
  splice (offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {AbstractContent} right
   * @return {boolean}
   */
  mergeWith (right) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {Transaction} transaction
   * @param {Item} item
   */
  integrate (transaction, item) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {Transaction} transaction
   * @param {Item} item
   */
  delete (transaction, item) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {StructStore} store
   */
  gc (store) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @return {number}
   */
  getRef () {
    throw error.methodUnimplemented()
  }
}
