
import {
  readID,
  createID,
  writeID,
  GC,
  nextID,
  AbstractRef,
  AbstractStruct,
  replaceStruct,
  addStruct,
  addToDeleteSet,
  ItemDeleted,
  findRootTypeKey,
  compareIDs,
  getItem,
  getItemType,
  getItemCleanEnd,
  getItemCleanStart,
  YEvent, StructStore, ID, AbstractType, Y, Transaction // eslint-disable-line
} from '../internals.js'

import * as error from 'lib0/error.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as maplib from 'lib0/map.js'
import * as set from 'lib0/set.js'
import * as binary from 'lib0/binary.js'

/**
 * Split leftItem into two items
 * @param {StructStore} store
 * @param {AbstractItem} leftItem
 * @param {number} diff
 * @return {AbstractItem}
 *
 * @todo remove store param0
 */
export const splitItem = (store, leftItem, diff) => {
  const id = leftItem.id
  // create rightItem
  const rightItem = leftItem.copy(
    createID(id.client, id.clock + diff),
    leftItem,
    createID(id.client, id.clock + diff - 1),
    leftItem.right,
    leftItem.rightOrigin,
    leftItem.parent,
    leftItem.parentSub
  )
  if (leftItem.deleted) {
    rightItem.deleted = true
  }
  // update left (do not set leftItem.rightOrigin as it will lead to problems when syncing)
  leftItem.right = rightItem
  // update right
  if (rightItem.right !== null) {
    rightItem.right.left = rightItem
  }
  return rightItem
}

/**
 * Abstract class that represents any content.
 */
export class AbstractItem extends AbstractStruct {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub) {
    super(id)
    /**
     * The item that was originally to the left of this item.
     * @type {ID | null}
     * @readonly
     */
    this.origin = origin
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
     * @type {ID | null}
     */
    this.rightOrigin = rightOrigin
    /**
     * The parent type.
     * @type {AbstractType<any>}
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
    const store = transaction.y.store
    const id = this.id
    const parent = this.parent
    const parentSub = this.parentSub
    const length = this.length
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
    if (this.left !== null) {
      o = this.left.right
    } else if (parentSub !== null) {
      o = parent._map.get(parentSub) || null
    } else {
      o = parent._start
    }
    // TODO: use something like DeleteSet here (a tree implementation would be best)
    /**
     * @type {Set<AbstractItem>}
     */
    const conflictingItems = new Set()
    /**
     * @type {Set<AbstractItem>}
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
        if (o.id.client < id.client) {
          this.left = o
          conflictingItems.clear()
        } // TODO: verify break else?
      } else if (o.origin !== null && itemsBeforeOrigin.has(getItem(store, o.origin))) {
        // case 2
        if (o.origin === null || !conflictingItems.has(getItem(store, o.origin))) {
          this.left = o
          conflictingItems.clear()
        }
      } else {
        break
      }
      // TODO: experiment with rightOrigin.
      // Then you could basically omit conflictingItems!
      // Note: you probably can't use right_origin in every case.. only when setting _left
      o = o.right
    }
    // reconnect left/right + update parent map/start if necessary
    if (this.left !== null) {
      const right = this.left.right
      this.right = right
      this.left.right = this
      if (right !== null) {
        right.left = this
      }
    } else {
      let r
      if (parentSub !== null) {
        const pmap = parent._map
        r = pmap.get(parentSub) || null
        pmap.set(parentSub, this)
      } else {
        r = parent._start
        parent._start = this
      }
      this.right = r
      if (r !== null) {
        r.left = this
      }
    }
    // adjust the length of parent
    if (parentSub === null && this.countable && !this.deleted) {
      parent._length += length
    }
    addStruct(store, this)
    if (parent !== null) {
      maplib.setIfUndefined(transaction.changed, parent, set.create).add(parentSub)
    }
    // @ts-ignore
    if ((parent._item !== null && parent._item.deleted) || (this.left !== null && parentSub !== null)) {
      // delete if parent is deleted or if this is not the current attribute value of parent
      this.delete(transaction)
    } else if (parentSub !== null && this.left === null && this.right !== null) {
      // this is the current attribute value of parent. delete right
      this.right.delete(transaction)
    }
  }

  /**
   * Returns the next non-deleted item
   * @private
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
   * @private
   */
  get prev () {
    let n = this.left
    while (n !== null && n.deleted) {
      n = n.left
    }
    return n
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @return {AbstractItem}
   */
  copy (id, left, origin, right, rightOrigin, parent, parentSub) {
    throw new Error('unimplemented')
  }

  /**
   * Redoes the effect of this operation.
   *
   * @param {Transaction} transaction The Yjs instance.
   * @param {Set<AbstractItem>} redoitems
   *
   * @private
   */
  redo (transaction, redoitems) {
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
    }
    // make sure that parent is redone
    if (parent._deleted === true && parent.redone === null) {
      // try to undo parent if it will be undone anyway
      if (!redoitems.has(parent) || !parent.redo(transaction, redoitems)) {
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
    this.redone = this.copy(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, this.parentSub)
    this.redone.integrate(transaction)
    return true
  }

  /**
   * Computes the last content address of this Item.
   * TODO: do still need this?
   * @private
   */
  get lastId () {
    return createID(this.id.client, this.id.clock + this.length - 1)
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
   * Do not call directly. Always split via StructStore!
   *
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
   * @param {StructStore} store
   * @param {number} diff
   * @return {AbstractItem}
   */
  splitAt (store, diff) {
    throw new Error('unimplemented')
  }

  /**
   * @param {AbstractItem} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (compareIDs(right.origin, this.lastId) && this.right === right && compareIDs(this.rightOrigin, right.rightOrigin)) {
      this.right = right.right
      if (this.right !== null) {
        this.right.left = this
      }
      return true
    }
    return false
  }
  /**
   * Mark this Item as deleted.
   *
   * @param {Transaction} transaction
   *
   * @private
   */
  delete (transaction) {
    if (!this.deleted) {
      const parent = this.parent
      // adjust the length of parent
      if (this.countable && this.parentSub === null) {
        parent._length -= this.length
      }
      this.deleted = true
      addToDeleteSet(transaction.deleteSet, this.id, this.length)
      maplib.setIfUndefined(transaction.changed, parent, set.create).add(this.parentSub)
    }
  }

  /**
   * @param {Y} y
   */
  gcChildren (y) {}

  /**
   * @param {Y} y
   * @return {GC|ItemDeleted}
   */
  gc (y) {
    let r
    if (this.parent._item !== null && this.parent._item.deleted) {
      r = new GC(this.id, this.length)
    } else {
      r = new ItemDeleted(this.id, this.left, this.origin, this.right, this.rightOrigin, this.parent, this.parentSub, this.length)
      if (r.left !== null) {
        r.left.right = r
      }
      if (r.right !== null) {
        r.right.left = r
      }
      if (r.left === null) {
        if (r.parentSub === null) {
          r.parent._start = r
        } else {
          r.parent._map.set(r.parentSub, r)
        }
      }
    }
    replaceStruct(y.store, this, r)
    return r
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    throw error.methodUnimplemented()
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   * @param {number} offset
   * @param {number} encodingRef
   * @private
   */
  write (encoder, offset, encodingRef) {
    const origin = offset > 0 ? createID(this.id.client, this.id.clock + offset - 1) : this.origin
    const rightOrigin = this.rightOrigin
    const parentSub = this.parentSub
    const info = (encodingRef & binary.BITS5) |
      (origin === null ? 0 : binary.BIT8) | // origin is defined
      (rightOrigin === null ? 0 : binary.BIT7) | // right origin is defined
      (parentSub === null ? 0 : binary.BIT6) // parentSub is non-null
    encoding.writeUint8(encoder, info)
    if (origin !== null) {
      writeID(encoder, origin)
    }
    if (rightOrigin !== null) {
      writeID(encoder, rightOrigin)
    }
    if (origin === null && rightOrigin === null) {
      const parent = this.parent
      if (parent._item === null) {
        // parent type on y._map
        // find the correct key
        // @ts-ignore we know that y exists
        const ykey = findRootTypeKey(parent)
        encoding.writeVarUint(encoder, 1) // write parentYKey
        encoding.writeVarString(encoder, ykey)
      } else {
        encoding.writeVarUint(encoder, 0) // write parent id
        // @ts-ignore _item is defined because parent is integrated
        writeID(encoder, parent._item.id)
      }
      if (parentSub !== null) {
        encoding.writeVarString(encoder, parentSub)
      }
    }
  }
}

export class AbstractItemRef extends AbstractRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(id)
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
    const hasParentYKey = canCopyParentInfo ? decoding.readVarUint(decoder) === 1 : false
    /**
     * If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
     * and we read the next string as parentYKey.
     * It indicates how we store/retrieve parent from `y.share`
     * @type {string|null}
     */
    this.parentYKey = canCopyParentInfo && hasParentYKey ? decoding.readVarString(decoder) : null
    /**
     * The parent type.
     * @type {ID | null}
     */
    this.parent = canCopyParentInfo && !hasParentYKey ? readID(decoder) : null
    /**
     * If the parent refers to this item with some kind of key (e.g. YMap, the
     * key is specified here. The key is then used to refer to the list in which
     * to insert this item. If `parentSub = null` type._start is the list in
     * which to insert to. Otherwise it is `parent._map`.
     * @type {String | null}
     */
    this.parentSub = canCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoding.readVarString(decoder) : null
    const missing = this._missing
    if (this.left !== null) {
      missing.push(this.left)
    }
    if (this.right !== null) {
      missing.push(this.right)
    }
    if (this.parent !== null) {
      missing.push(this.parent)
    }
  }
}

/**
 * @param {AbstractItemRef} item
 * @param {number} offset
 */
export const changeItemRefOffset = (item, offset) => {
  item.id = createID(item.id.client, item.id.clock + offset)
  item.left = createID(item.id.client, item.id.clock - 1)
}

/**
 * Outsourcing some of the logic of computing the item params from a received struct.
 * If parent === null, it is expected to gc the read struct. Otherwise apply it.
 *
 * @param {Y} y
 * @param {StructStore} store
 * @param {ID|null} leftid
 * @param {ID|null} rightid
 * @param {ID|null} parentid
 * @param {string|null} parentSub
 * @param {string|null} parentYKey
 * @return {{left:AbstractItem?,right:AbstractItem?,parent:AbstractType<YEvent>?,parentSub:string?}}
 */
export const computeItemParams = (y, store, leftid, rightid, parentid, parentSub, parentYKey) => {
  const left = leftid === null ? null : getItemCleanEnd(store, leftid)
  const right = rightid === null ? null : getItemCleanStart(store, rightid)
  let parent = null
  if (parentid !== null) {
    const parentItem = getItemType(store, parentid)
    switch (parentItem.constructor) {
      case ItemDeleted:
      case GC:
        break
      default:
        parent = parentItem.type
    }
  } else if (parentYKey !== null) {
    parent = y.get(parentYKey)
  } else if (left !== null) {
    if (left.constructor !== GC) {
      parent = left.parent
      parentSub = left.parentSub
    }
  } else if (right !== null) {
    if (right.constructor !== GC) {
      parent = right.parent
      parentSub = right.parentSub
    }
  } else {
    throw error.unexpectedCase()
  }
  return {
    left, right, parent, parentSub
  }
}
