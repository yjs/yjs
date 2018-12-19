/**
 * @module structs
 */

import { getStructReference } from '../utils/structReferences.js'
import * as ID from '../utils/ID.js'
import { Delete } from './Delete.js'
import { writeStructToTransaction } from '../utils/structEncoding.js'
import { GC } from './GC.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
// import { Type } from './Type.js' // eslint-disable-line

/**
 * @private
 */
export const transactionTypeChanged = (y, type, sub) => {
  if (type !== y && !type._deleted && !y._transaction.newTypes.has(type)) {
    const changedTypes = y._transaction.changedTypes
    let subs = changedTypes.get(type)
    if (subs === undefined) {
      // create if it doesn't exist yet
      subs = new Set()
      changedTypes.set(type, subs)
    }
    subs.add(sub)
  }
}

/**
 * Helper utility to split an Item (see {@link Item#_splitAt})
 * - copies all properties from a to b
 * - connects a to b
 * - assigns the correct _id
 * - saves b to os
 * @private
 */
export const splitHelper = (y, a, b, diff) => {
  const aID = a._id
  b._id = ID.createID(aID.user, aID.clock + diff)
  b._origin = a
  b._left = a
  b._right = a._right
  if (b._right !== null) {
    b._right._left = b
  }
  b._right_origin = a._right_origin
  // do not set a._right_origin, as this will lead to problems when syncing
  a._right = b
  b._parent = a._parent
  b._parentSub = a._parentSub
  b._deleted = a._deleted
  // now search all relevant items to the right and update origin
  // if origin is not it foundOrigins, we don't have to search any longer
  let foundOrigins = new Set()
  foundOrigins.add(a)
  let o = b._right
  while (o !== null && foundOrigins.has(o._origin)) {
    if (o._origin === a) {
      o._origin = b
    }
    foundOrigins.add(o)
    o = o._right
  }
  y.os.put(b)
  if (y._transaction !== null) {
    if (y._transaction.newTypes.has(a)) {
      y._transaction.newTypes.add(b)
    } else if (y._transaction.deletedStructs.has(a)) {
      y._transaction.deletedStructs.add(b)
    }
  }
}

/**
 * Abstract class that represents any content.
 */
export class Item {
  constructor () {
    /**
     * The uniqe identifier of this type.
     * @type {ID.ID | ID.RootID}
     */
    this._id = null
    /**
     * The item that was originally to the left of this item.
     * @type {Item}
     */
    this._origin = null
    /**
     * The item that is currently to the left of this item.
     * @type {Item}
     */
    this._left = null
    /**
     * The item that is currently to the right of this item.
     * @type {Item}
     */
    this._right = null
    /**
     * The item that was originally to the right of this item.
     * @type {Item}
     */
    this._right_origin = null
    /**
     * The parent type.
     * @type {Y|Type}
     */
    this._parent = null
    /**
     * If the parent refers to this item with some kind of key (e.g. YMap, the
     * key is specified here. The key is then used to refer to the list in which
     * to insert this item. If `parentSub = null` type._start is the list in
     * which to insert to. Otherwise it is `parent._map`.
     * @type {String}
     */
    this._parentSub = null
    /**
     * Whether this item was deleted or not.
     * @type {Boolean}
     */
    this._deleted = false
    /**
     * If this type's effect is reundone this type refers to the type that undid
     * this operation.
     * @type {Type}
     */
    this._redone = null
  }

  /**
   * Returns the next non-deleted item
   * @private
   */
  get _next () {
    let n = this._right
    while (n !== null && n._deleted) {
      n = n._right
    }
    return n
  }

  /**
   * Returns the previous non-deleted item
   * @private
   */
  get _prev () {
    let n = this._left
    while (n !== null && n._deleted) {
      n = n._left
    }
    return n
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @private
   */
  _copy () {
    const C = this.constructor
    return new C()
  }

  /**
   * Redoes the effect of this operation.
   *
   * @param {Y} y The Yjs instance.
   * @param {Set<Item>} redoitems
   *
   * @private
   */
  _redo (y, redoitems) {
    if (this._redone !== null) {
      return this._redone
    }
    if (!(this._parent instanceof Item)) {
      return
    }
    let struct = this._copy()
    let left, right
    if (this._parentSub === null) {
      // Is an array item. Insert at the old position
      left = this._left
      right = this
    } else {
      // Is a map item. Insert at the start
      left = null
      right = this._parent._map.get(this._parentSub)
      right._delete(y)
    }
    let parent = this._parent
    // make sure that parent is redone
    if (parent._deleted === true && parent._redone === null) {
      // try to undo parent if it will be undone anyway
      if (!redoitems.has(parent) || !parent._redo(y, redoitems)) {
        return false
      }
    }
    if (parent._redone !== null) {
      parent = parent._redone
      // find next cloned_redo items
      while (left !== null) {
        if (left._redone !== null && left._redone._parent === parent) {
          left = left._redone
          break
        }
        left = left._left
      }
      while (right !== null) {
        if (right._redone !== null && right._redone._parent === parent) {
          right = right._redone
        }
        right = right._right
      }
    }
    struct._origin = left
    struct._left = left
    struct._right = right
    struct._right_origin = right
    struct._parent = parent
    struct._parentSub = this._parentSub
    struct._integrate(y)
    this._redone = struct
    return true
  }

  /**
   * Computes the last content address of this Item.
   *
   * @private
   */
  get _lastId () {
    /**
     * @type {any}
     */
    const id = this._id
    return ID.createID(id.user, id.clock + this._length - 1)
  }

  /**
   * Computes the length of this Item.
   *
   * @private
   */
  get _length () {
    return 1
  }

  /**
   * Should return false if this Item is some kind of meta information
   * (e.g. format information).
   *
   * * Whether this Item should be addressable via `yarray.get(i)`
   * * Whether this Item should be counted when computing yarray.length
   *
   * @private
   */
  get _countable () {
    return true
  }

  /**
   * Splits this Item so that another Items can be inserted in-between.
   * This must be overwritten if _length > 1
   * Returns right part after split
   * * diff === 0 => this
   * * diff === length => this._right
   * * otherwise => split _content and return right part of split
   * (see {@link ItemJSON}/{@link ItemString} for implementation)
   *
   * @private
   */
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    }
    return this._right
  }

  /**
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   * @param {boolean} gcChildren
   *
   * @private
   */
  _delete (y, createDelete = true, gcChildren) {
    if (!this._deleted) {
      const parent = this._parent
      const len = this._length
      // adjust the length of parent
      if (parent.length !== undefined && this._countable) {
        parent.length -= len
      }
      this._deleted = true
      y.ds.mark(this._id, this._length, false)
      let del = new Delete()
      del._targetID = this._id
      del._length = len
      if (createDelete) {
        // broadcast and persists Delete
        del._integrate(y, true)
      }
      transactionTypeChanged(y, parent, this._parentSub)
      y._transaction.deletedStructs.add(this)
    }
  }

  _gcChildren (y) {}

  _gc (y) {
    const gc = new GC()
    gc._id = this._id
    gc._length = this._length
    y.os.delete(this._id)
    gc._integrate(y)
  }

  /**
   * This is called right before this Item receives any children.
   * It can be overwritten to apply pending changes before applying remote changes
   *
   * @private
   */
  _beforeChange () {
    // nop
  }

  /**
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In case of
   * Item it connects _left and _right to this Item and calls the
   * {@link Item#beforeChange} method.
   *
   * * Integrate the struct so that other types/structs can see it
   * * Add this struct to y.os
   * * Check if this is struct deleted
   *
   * @param {Y} y
   *
   * @private
   */
  _integrate (y) {
    y._transaction.newTypes.add(this)
    /**
     * @type {any}
     */
    const parent = this._parent
    /**
     * @type {any}
     */
    const selfID = this._id
    const user = selfID === null ? y.userID : selfID.user
    const userState = y.ss.getState(user)
    if (selfID === null) {
      this._id = y.ss.getNextID(this._length)
    } else if (selfID.user === ID.RootFakeUserID) {
      // is parent
      return
    } else if (selfID.clock < userState) {
      // already applied..
      return
    } else if (selfID.clock === userState) {
      y.ss.setState(selfID.user, userState + this._length)
    } else {
      // missing content from user
      throw new Error('Can not apply yet!')
    }
    if (!parent._deleted && !y._transaction.changedTypes.has(parent) && !y._transaction.newTypes.has(parent)) {
      // this is the first time parent is updated
      // or this types is new
      parent._beforeChange()
    }

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
    let o
    // set o to the first conflicting item
    if (this._left !== null) {
      o = this._left._right
    } else if (this._parentSub !== null) {
      o = parent._map.get(this._parentSub) || null
    } else {
      o = parent._start
    }
    let conflictingItems = new Set()
    let itemsBeforeOrigin = new Set()
    // Let c in conflictingItems, b in itemsBeforeOrigin
    // ***{origin}bbbb{this}{c,b}{c,b}{o}***
    // Note that conflictingItems is a subset of itemsBeforeOrigin
    while (o !== null && o !== this._right) {
      itemsBeforeOrigin.add(o)
      conflictingItems.add(o)
      if (this._origin === o._origin) {
        // case 1
        if (o._id.user < this._id.user) {
          this._left = o
          conflictingItems.clear()
        }
      } else if (itemsBeforeOrigin.has(o._origin)) {
        // case 2
        if (!conflictingItems.has(o._origin)) {
          this._left = o
          conflictingItems.clear()
        }
      } else {
        break
      }
      // TODO: try to use right_origin instead.
      // Then you could basically omit conflictingItems!
      // Note: you probably can't use right_origin in every case.. only when setting _left
      o = o._right
    }
    // reconnect left/right + update parent map/start if necessary
    const parentSub = this._parentSub
    if (this._left === null) {
      let right
      if (parentSub !== null) {
        const pmap = parent._map
        right = pmap.get(parentSub) || null
        pmap.set(parentSub, this)
      } else {
        right = parent._start
        parent._start = this
      }
      this._right = right
      if (right !== null) {
        right._left = this
      }
    } else {
      const left = this._left
      const right = left._right
      this._right = right
      left._right = this
      if (right !== null) {
        right._left = this
      }
    }
    // adjust the length of parent
    if (parentSub === null && parent.length !== undefined && this._countable) {
      parent.length += this._length
    }
    if (parent._deleted) {
      this._delete(y, false, true)
    }
    y.os.put(this)
    transactionTypeChanged(y, parent, parentSub)
    if (this._id.user !== ID.RootFakeUserID) {
      writeStructToTransaction(y._transaction, this)
    }
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   *
   * @private
   */
  _toBinary (encoder) {
    encoding.writeUint8(encoder, getStructReference(this.constructor))
    let info = 0
    if (this._origin !== null) {
      info += 0b1 // origin is defined
    }
    // TODO: remove
    /* no longer send _left
    if (this._left !== this._origin) {
      info += 0b10 // do not copy origin to left
    }
    */
    if (this._right_origin !== null) {
      info += 0b100
    }
    if (this._parentSub !== null) {
      info += 0b1000
    }
    encoding.writeUint8(encoder, info)
    this._id.encode(encoder)
    if (info & 0b1) {
      this._origin._lastId.encode(encoder)
    }
    // TODO: remove
    /* see above
    if (info & 0b10) {
      encoder.writeID(this._left._lastId)
    }
    */
    if (info & 0b100) {
      this._right_origin._id.encode(encoder)
    }
    if ((info & 0b101) === 0) {
      // neither origin nor right is defined
      this._parent._id.encode(encoder)
    }
    if (info & 0b1000) {
      encoding.writeVarString(encoder, JSON.stringify(this._parentSub))
    }
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {decoding.Decoder} decoder The decoder object to read data from.
   *
   * @private
   */
  _fromBinary (y, decoder) {
    let missing = []
    const info = decoding.readUint8(decoder)
    const id = ID.decode(decoder)
    this._id = id
    // read origin
    if (info & 0b1) {
      // origin != null
      const originID = ID.decode(decoder)
      // we have to query for left again because it might have been split/merged..
      const origin = y.os.getItemCleanEnd(originID)
      if (origin === null) {
        missing.push(originID)
      } else {
        this._origin = origin
        this._left = this._origin
      }
    }
    // read right
    if (info & 0b100) {
      // right != null
      const rightID = ID.decode(decoder)
      // we have to query for right again because it might have been split/merged..
      const right = y.os.getItemCleanStart(rightID)
      if (right === null) {
        missing.push(rightID)
      } else {
        this._right = right
        this._right_origin = right
      }
    }
    // read parent
    if ((info & 0b101) === 0) {
      // neither origin nor right is defined
      const parentID = ID.decode(decoder)
      // parent does not change, so we don't have to search for it again
      if (this._parent === null) {
        let parent
        if (parentID.constructor === ID.RootID) {
          parent = y.os.get(parentID)
        } else {
          parent = y.os.getItem(parentID)
        }
        if (parent === null) {
          missing.push(parentID)
        } else {
          this._parent = parent
        }
      }
    } else if (this._parent === null) {
      if (this._origin !== null) {
        this._parent = this._origin._parent
      } else if (this._right_origin !== null) {
        this._parent = this._right_origin._parent
      }
    }
    if (info & 0b1000) {
      // TODO: maybe put this in read parent condition (you can also read parentsub from left/right)
      this._parentSub = JSON.parse(decoding.readVarString(decoder))
    }
    if (id instanceof ID.ID && y.ss.getState(id.user) < id.clock) {
      missing.push(ID.createID(id.user, id.clock - 1))
    }
    return missing
  }
}
