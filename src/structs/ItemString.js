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
  Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structStringRefNumber = 6

export class ItemString extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {string} string
   */
  constructor (id, left, right, parent, parentSub, string) {
    super(id, left, right, parent, parentSub)
    /**
     * @type {string}
     */
    this.string = string
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemString(id, left, right, parent, parentSub, this.string)
  }
  getContent () {
    return this.string.split('')
  }
  get length () {
    return this.string.length
  }
  /**
   * @param {Transaction} transaction
   * @param {number} diff
   * @return {ItemString}
   */
  splitAt (transaction, diff) {
    /**
     * @type {ItemString}
     */
    // @ts-ignore
    const right = splitItem(transaction, this, diff)
    right.string = this.string.slice(diff)
    this.string = this.string.slice(0, diff)
    return right
  }
  /**
   * @param {ItemString} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (right.origin === this && this.right === right) {
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
  /**
   * @param {Transaction} transaction
   * @return {ItemString}
   */
  toStruct (transaction) {
    const y = transaction.y
    const store = y.store
    return new ItemString(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      // @ts-ignore
      this.parent === null ? y.get(this.parentYKey) : getItemType(store, this.parent),
      this.parentSub,
      this.string
    )
  }
}
