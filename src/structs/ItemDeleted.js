/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import {
  AbstractItem,
  AbstractItemRef,
  getItemCleanEnd,
  getItemCleanStart,
  getItemType,
  changeItemRefOffset,
  GC,
  splitItem,
  compareIDs,
  StructStore, Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structDeletedRefNumber = 2

export class ItemDeleted extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {number} length
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, length) {
    super(id, left, origin, right, rightOrigin, parent, parentSub)
    this._len = length
    this.deleted = true
  }
  get length () {
    return this._len
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   */
  copy (id, left, origin, right, rightOrigin, parent, parentSub) {
    return new ItemDeleted(id, left, origin, right, rightOrigin, parent, parentSub, this.length)
  }
  /**
   * @param {StructStore} store
   * @param {number} diff
   */
  splitAt (store, diff) {
    /**
     * @type {ItemDeleted}
     */
    // @ts-ignore
    const right = splitItem(store, this, diff)
    right._len -= diff
    this._len = diff
    return right
  }
  /**
   * @param {ItemDeleted} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (compareIDs(right.origin, this.lastId) && this.right === right && compareIDs(this.rightOrigin, right.rightOrigin)) {
      this._len += right._len
      return true
    }
    return false
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structDeletedRefNumber)
    encoding.writeVarUint(encoder, this.length - offset)
  }
}

export class ItemDeletedRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    /**
     * @type {number}
     */
    this.len = decoding.readVarUint(decoder)
  }
  get length () {
    return this.len
  }
  /**
   * @param {Transaction} transaction
   * @param {number} offset
   * @return {ItemDeleted|GC}
   */
  toStruct (transaction, offset) {
    const y = transaction.y
    const store = y.store
    if (offset > 0) {
      changeItemRefOffset(this, offset)
      this.len = this.len - offset
    }

    let parent
    if (this.parent !== null) {
      const parentItem = getItemType(store, this.parent)
      switch (parentItem.constructor) {
        case ItemDeleted:
        case GC:
          return new GC(this.id, 1)
      }
      parent = parentItem.type
    } else {
      // @ts-ignore
      parent = y.get(this.parentYKey)
    }

    return new ItemDeleted(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, this.left),
      this.left,
      this.right === null ? null : getItemCleanStart(store, this.right),
      this.right,
      parent,
      this.parentSub,
      this.len
    )
  }
}
