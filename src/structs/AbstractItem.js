/**
 * @module structs
 */

import { readID, createID, writeID, writeNullID, ID, createNextID } from '../utils/ID.js' // eslint-disable-line
import { Delete } from '../Delete.js'
import { writeStructToTransaction } from '../utils/structEncoding.js'
import { GC } from './GC.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { ItemType } from './ItemType.js' // eslint-disable-line
import { AbstractType } from '../types/AbstractType.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import * as maplib from 'lib0/map.js'
import * as set from 'lib0/set.js'
import * as binary from 'lib0/binary.js'
import { AbstractRef, AbstractStruct } from './AbstractStruct.js' // eslint-disable-line
import * as error from 'lib0/error.js'

/**
 * Stringify an item id.
 *
 * @param { ID } id
 * @return {string}
 */
export const stringifyID = id => `(${id.client},${id.clock})`

/**
 * Stringify an item as ID. HHere, an item could also be a Yjs instance (e.g. item._parent).
 *
 * @param {AbstractItem | null} item
 * @return {string}
 */
export const stringifyItemID = item =>
  item === null ? '()' : (item.id != null ? stringifyID(item.id) : 'y')

/**
 * Helper utility to convert an item to a readable format.
 *
 * @param {String} name The name of the item class (YText, ItemString, ..).
 * @param {AbstractItem} item The item instance.
 * @param {String} [append] Additional information to append to the returned
 *                          string.
 * @return {String} A readable string that represents the item object.
 *
 */
export const logItemHelper = (name, item, append) => {
  const left = item.left !== null ? stringifyID(item.left.lastId) : '()'
  const origin = item.origin !== null ? stringifyID(item.origin.lastId) : '()'
  return `${name}(id:${stringifyItemID(item)},left:${left},origin:${origin},right:${stringifyItemID(item.right)},parent:${stringifyItemID(item.parent)},parentSub:${item.parentSub}${append !== undefined ? ' - ' + append : ''})`
}

/**
 * Split leftItem into two items
 * @param {AbstractItem} leftItem
 * @param {Y} y
 * @param {number} diff
 * @return {any}
 */
export const splitItem = (leftItem, diff) => {
  const id = leftItem.id
  // create rightItem
  const rightItem = leftItem.copy(createID(id.client, id.clock + diff), leftItem, leftItem.rightOrigin, leftItem.parent, leftItem.parentSub)
  rightItem.right = leftItem.right
  if (leftItem.deleted) {
    rightItem.deleted = true
  }
  // update left (do not set leftItem.rightOrigin as it will lead to problems when syncing)
  leftItem.right = rightItem
  // update right
  if (rightItem.right !== null) {
    rightItem.right.left = rightItem
  }
  // update all origins to the right
  // search all relevant items to the right and update origin
  // if origin is not it foundOrigins, we don't have to search any longer
  const foundOrigins = new Set()
  foundOrigins.add(leftItem)
  let o = rightItem.right
  while (o !== null && foundOrigins.has(o.origin)) {
    if (o.origin === leftItem) {
      o.origin = rightItem
    }
    foundOrigins.add(o)
    o = o.right
  }
}

/**
 * Abstract class that represents any content.
 */
export class AbstractItem extends AbstractStruct {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType | null} parent
   * @param {string | null} parentSub
   */
  constructor (id, left, right, parent, parentSub) {
    if (left !== null) {
      parent = left.parent
      parentSub = left.parentSub
    } else if (right !== null) {
      parent = right.parent
      parentSub = right.parentSub
    } else if (parent === null) {
      error.throwUnexpectedCase()
    }
    super(id)
    /**
     * The item that was originally to the left of this item.
     * @type {AbstractItem | null}
     * @readonly
     */
    this.origin = left
    /**
     * The item that is currently to the left of this item.
     * @type {AbstractItem | null}
     */
    this.left = left
    /**
     * The item that is currently to the right of this item.
     * @type {AbstractItem | null}
     */
    this.right = right
    /**
     * The item that was originally to the right of this item.
     * @readonly
     * @type {AbstractItem | null}
     */
    this.rightOrigin = right
    /**
     * The parent type.
     * @type {AbstractType}
     * @readonly
     */
    this.parent = parent
    /**
     * If the parent refers to this item with some kind of key (e.g. YMap, the
     * key is specified here. The key is then used to refer to the list in which
     * to insert this item. If `parentSub = null` type._start is the list in
     * which to insert to. Otherwise it is `parent._map`.
     * @type {String | null}
     * @readonly
     */
    this.parentSub = parentSub
    /**
     * Whether this item was deleted or not.
     * @type {Boolean}
     */
    this.deleted = false
    /**
     * If this type's effect is reundone this type refers to the type that undid
     * this operation.
     * @type {AbstractItem | null}
     */
    this.redone = null
  }

  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    const y = transaction.y
    const id = this.id
    const parent = this.parent
    const parentSub = this.parentSub
    const length = this.length
    const left = this.left
    const right = this.right
    // integrate
    const parentType = parent !== null ? parent.type : maplib.setTfUndefined(y.share, parentSub, () => new AbstractType())
    if (y.ss.getState(id.client) !== id.clock) {
      throw new Error('Expected other operation')
    }
    y.ss.setState(id.client, id.clock + length)
    transaction.added.add(this)
    /*
    # $this has to find a unique position between origin and the next known character
    # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
    #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
    #         o2,o3 and o4 origin is 1 (the position of o2)
    #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
    #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
    #         therefore $this would be always to the right of o3
    # case 2: $origin < $o.origin
    #         if current $this insert_position > $o origin: $this ins
    #         else $insert_position will not change
    #         (maybe we encounter case 1 later, then this will be to the right of $o)
    # case 3: $origin > $o.origin
    #         $this insert_position is to the left of $o (forever!)
    */
    // handle conflicts
    /**
     * @type {AbstractItem|null}
     */
    let o
    // set o to the first conflicting item
    if (left !== null) {
      o = left.right
    } else if (this.parentSub !== null) {
      o = parentType._map.get(parentSub) || null
    } else {
      o = parentType._start
    }
    const conflictingItems = new Set()
    const itemsBeforeOrigin = new Set()
    // Let c in conflictingItems, b in itemsBeforeOrigin
    // ***{origin}bbbb{this}{c,b}{c,b}{o}***
    // Note that conflictingItems is a subset of itemsBeforeOrigin
    while (o !== null && o !== right) {
      itemsBeforeOrigin.add(o)
      conflictingItems.add(o)
      if (this.origin === o.origin) {
        // case 1
        if (o.id.client < id.client) {
          this.left = o
          conflictingItems.clear()
        }
      } else if (itemsBeforeOrigin.has(o.origin)) {
        // case 2
        if (!conflictingItems.has(o.origin)) {
          this.left = o
          conflictingItems.clear()
        }
      } else {
        break
      }
      // TODO: try to use right_origin instead.
      // Then you could basically omit conflictingItems!
      // Note: you probably can't use right_origin in every case.. only when setting _left
      o = o.right
    }
    // reconnect left/right + update parent map/start if necessary
    if (left !== null) {
      const right = left.right
      this.right = right
      left.right = this
      if (right !== null) {
        right.left = this
      }
    } else {
      let r
      if (parentSub !== null) {
        const pmap = parentType._map
        r = pmap.get(parentSub) || null
        pmap.set(parentSub, this)
      } else {
        r = parentType._start
        parentType._start = this
      }
      this.right = r
      if (r !== null) {
        r._left = this
      }
    }
    // adjust the length of parent
    if (parentSub === null && this.countable) {
      parentType._length += length
    }
    if (parent !== null && parent.deleted) {
      this.delete(transaction, false, true)
    }
    y.os.put(this)
    if (parent !== null) {
      maplib.setTfUndefined(transaction.changed, parent, set.create).add(parentSub)
    }

    writeStructToTransaction(y._transaction, this)
  }

  /**
   * Returns the next non-deleted item
   * @private
   */
  get next () {
    let n = this.right
    while (n !== null && n._deleted) {
      n = n.right
    }
    return n
  }

  /**
   * Returns the previous non-deleted item
   * @private
   */
  get prev () {
    let n = this.left
    while (n !== null && n._deleted) {
      n = n.left
    }
    return n
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @param {ID} id
   * @param {AbstractItem|null} left
   * @param {AbstractItem|null} right
   * @param {ItemType|null} parent
   * @param {string|null} parentSub
   * @return {AbstractItem}
   */
  copy (id, left, right, parent, parentSub) {
    throw new Error('unimplemented')
  }

  /**
   * Redoes the effect of this operation.
   *
   * @param {Y} y The Yjs instance.
   * @param {Set<AbstractItem>} redoitems
   *
   * @private
   */
  redo (y, redoitems) {
    if (this.redone !== null) {
      return this.redone
    }
    /**
     * @type {any}
     */
    let parent = this.parent
    if (parent === null) {
      return
    }
    let left, right
    if (this.parentSub === null) {
      // Is an array item. Insert at the old position
      left = this.left
      right = this
    } else {
      // Is a map item. Insert at the start
      left = null
      right = parent.type._map.get(this.parentSub)
      right._delete(y)
    }
    // make sure that parent is redone
    if (parent._deleted === true && parent.redone === null) {
      // try to undo parent if it will be undone anyway
      if (!redoitems.has(parent) || !parent.redo(y, redoitems)) {
        return false
      }
    }
    if (parent.redone !== null) {
      while (parent.redone !== null) {
        parent = parent.redone
      }
      // find next cloned_redo items
      while (left !== null) {
        if (left.redone !== null && left.redone.parent === parent) {
          left = left.redone
          break
        }
        left = left.left
      }
      while (right !== null) {
        if (right.redone !== null && right.redone.parent === parent) {
          right = right.redone
        }
        right = right._right
      }
    }
    this.redone = this.copy(createNextID(y), left, right, parent, this.parentSub)
    return true
  }

  /**
   * Computes the last content address of this Item.
   *
   * @private
   */
  get lastId () {
    /**
     * @type {any}
     */
    const id = this.id
    return createID(id.user, id.clock + this.length - 1)
  }

  /**
   * Computes the length of this Item.
   */
  get length () {
    return 1
  }

  /**
   * Should return false if this Item is some kind of meta information
   * (e.g. format information).
   *
   * * Whether this Item should be addressable via `yarray.get(i)`
   * * Whether this Item should be counted when computing yarray.length
   */
  get countable () {
    return true
  }

  /**
   * Splits this Item so that another Item can be inserted in-between.
   * This must be overwritten if _length > 1
   * Returns right part after split
   *
   * (see {@link ItemJSON}/{@link ItemString} for implementation)
   *
   * Does not integrate the struct, nor store it in struct store.
   *
   * This method should only be cally by StructStore.
   *
   * @param {number} diff
   * @return {AbstractItem}
   */
  splitAt (diff) {
    throw new Error('unimplemented')
  }

  /**
   * Mark this Item as deleted.
   *
   * @param {Transaction} transaction
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   * @param {boolean} [gcChildren]
   *
   * @private
   */
  delete (transaction, createDelete = true, gcChildren) {
    if (!this.deleted) {
      const y = transaction.y
      const parent = this.parent
      const len = this.length
      // adjust the length of parent
      if (this.countable && this.parentSub === null) {
        if (parent !== null) {
          // parent is y
          y.get(this.)

        } else {
          transaction.y.get(this.parentSub)
        }
      }
      if (parent.length !== undefined && this.countable) {
        parent.length -= len
      }
      this._deleted = true
      y.ds.mark(this.id, this.length, false)
      let del = new Delete(this.id, len)
      if (createDelete) {
        // broadcast and persists Delete
        del.integrate(y, true)
      }
      if (parent !== null) {
        maplib.setTfUndefined(transaction.changed, parent, set.create).add(this.parentSub)
      }
      transaction.deleted.add(this)
    }
  }

  /**
   * @param {Y} y
   */
  gcChildren (y) {}

  /**
   * @param {Y} y
   */
  gc (y) {
    if (this.id !== null) {
      y.os.replace(this, new GC(this.id, this.length))
    }
  }

  getContent () {
    throw new Error('Must implement') // TODO: create function in lib0
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   * @param {number} encodingRef
   * @private
   */
  write (encoder, encodingRef) {
    const info = (encodingRef & binary.BITS5) |
      ((this.origin === null) ? 0 : binary.BIT8) | // origin is defined
      ((this.rightOrigin === null) ? 0 : binary.BIT7) | // right origin is defined
      ((this.parentSub !== null) ? 0 : binary.BIT6) // parentSub is non-null
    encoding.writeUint8(encoder, info)
    writeID(encoder, this.id)
    if (this.origin !== null) {
      writeID(encoder, this.origin.lastId)
    }
    if (this.rightOrigin !== null) {
      writeID(encoder, this.rightOrigin.id)
    }
    if (this.origin === null && this.rightOrigin === null) {
      if (this.parent === null) {
        writeNullID(encoder)
      } else {
        // neither origin nor right is defined
        writeID(encoder, this.parent.id)
      }
      if (this.parentSub !== null) {
        encoding.writeVarString(encoder, this.parentSub)
      }
    }
  }
}

export class AbstractItemRef extends AbstractRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super()
    const id = readID(decoder)
    if (id === null) {
      throw new Error('id must not be null')
    }
    /**
     * The uniqe identifier of this type.
     * @type {ID}
     */
    this.id = id
    /**
     * The item that was originally to the left of this item.
     * @type {ID | null}
     */
    this.left = (info & binary.BIT8) === binary.BIT8 ? readID(decoder) : null
    /**
     * The item that was originally to the right of this item.
     * @type {ID | null}
     */
    this.right = (info & binary.BIT7) === binary.BIT7 ? readID(decoder) : null
    const canCopyParentInfo = (info & (binary.BIT7 | binary.BIT8)) === 0
    /**
     * The parent type.
     * @type {ID | null}
     */
    this.parent = canCopyParentInfo ? readID(decoder) : null
    /**
     * If the parent refers to this item with some kind of key (e.g. YMap, the
     * key is specified here. The key is then used to refer to the list in which
     * to insert this item. If `parentSub = null` type._start is the list in
     * which to insert to. Otherwise it is `parent._map`.
     * @type {String | null}
     */
    this.parentSub = canCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoding.readVarString(decoder) : null
  }
  /**
   * @return {Array<ID|null>}
   */
  getMissing () {
    return [
      createID(this.id.client, this.id.clock - 1),
      this.left,
      this.right,
      this.parent
    ]
  }
}
