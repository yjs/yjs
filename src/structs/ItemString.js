/**
 * @module structs
 */
import {
  AbstractItem,
  AbstractItemRef,
  getItemCleanEnd,
  getItemCleanStart,
  getItemType,
  splitItem,
  changeItemRefOffset,
  compareIDs,
  ItemDeleted,
  GC,
  StructStore, Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structStringRefNumber = 6
// TODO: we can probably try to omit rightOrigin. We can just use .right
export class ItemString extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {string} string
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, string) {
    super(id, left, origin, right, rightOrigin, parent, parentSub)
    /**
     * @type {string}
     */
    this.string = string
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
    return new ItemString(id, left, origin, right, rightOrigin, parent, parentSub, this.string)
  }
  getContent () {
    return this.string.split('')
  }
  get length () {
    return this.string.length
  }
  /**
   * @param {StructStore} store
   * @param {number} diff
   * @return {ItemString}
   */
  splitAt (store, diff) {
    /**
     * @type {ItemString}
     */
    // @ts-ignore
    const right = splitItem(store, this, diff)
    right.string = this.string.slice(diff)
    this.string = this.string.slice(0, diff)
    return right
  }
  /**
   * @param {ItemString} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (compareIDs(right.origin, this.lastId) && this.right === right) {
      this.string += right.string
      return true
    }
    return false
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structStringRefNumber)
    encoding.writeVarString(encoder, offset === 0 ? this.string : this.string.slice(offset))
  }
}

export class ItemStringRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    /**
     * @type {string}
     */
    this.string = decoding.readVarString(decoder)
  }
  get length () {
    return this.string.length
  }
  /**
   * @param {Transaction} transaction
   * @param {number} offset
   * @return {ItemString|GC}
   */
  toStruct (transaction, offset) {
    const y = transaction.y
    const store = y.store
    if (offset > 0) {
      changeItemRefOffset(this, offset)
      this.string = this.string.slice(offset)
    }

    let parent
    if (this.parent !== null) {
      const parentItem = getItemType(store, this.parent)
      switch (parentItem.constructor) {
        case ItemDeleted:
        case GC:
          return new GC(this.id, this.string.length)
      }
      parent = parentItem.type
    } else {
      // @ts-ignore
      parent = y.get(this.parentYKey)
    }

    return new ItemString(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, this.left),
      this.left,
      this.right === null ? null : getItemCleanStart(store, this.right),
      this.right,
      parent,
      this.parentSub,
      this.string
    )
  }
}
