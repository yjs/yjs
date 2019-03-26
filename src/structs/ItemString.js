/**
 * @module structs
 */

import { AbstractItem, logItemHelper, AbstractItemRef, splitItem } from './AbstractItem.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { ID } from '../utils/ID.js' // eslint-disable-line
import { ItemType } from './ItemType.js' // eslint-disable-line
import { getItemCleanEnd, getItemCleanStart, getItemType } from '../utils/StructStore.js'
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line

export const structStringRefNumber = 6

export class ItemString extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   * @param {string} string
   */
  constructor (id, left, right, parent, parentSub, string) {
    super(id, left, right, parent, parentSub)
    this.string = string
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemString(id, left, right, parent, parentSub, this.string)
  }
  /**
   * Transform this Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  logString () {
    return logItemHelper('ItemString', this, `content:"${this.string}"`)
  }
  get length () {
    return this.string.length
  }
  splitAt (y, diff) {
    if (diff === 0) {
      return this
    } else if (diff >= this.string.length) {
      return this.right
    }
    /**
     * @type {ItemString}
     */
    const right = splitItem(this, y, diff)
    right.string = this.string.slice(diff)
    right.string = this.string.slice(0, diff)
    return right
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  write (encoder) {
    super.write(encoder, structStringRefNumber)
    encoding.writeVarString(encoder, this.string)
  }
}

export class ItemStringRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super(decoder, info)
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
    const store = transaction.y.store
    return new ItemString(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      this.parent === null ? null : getItemType(store, this.parent),
      this.parentSub,
      this.string
    )
  }
}
