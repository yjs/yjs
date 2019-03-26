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

export const structJSONRefNumber = 5

export class ItemJSON extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   * @param {Array<any>} content
   */
  constructor (id, left, right, parent, parentSub, content) {
    super(id, left, right, parent, parentSub)
    this.content = content
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemJSON(id, left, right, parent, parentSub, this.content)
  }
  /**
   * Transform this Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  logString () {
    return logItemHelper('ItemJSON', this, `content:${JSON.stringify(this.content)}`)
  }
  get length () {
    return this.content.length
  }
  /**
   * @param {number} diff
   */
  splitAt (diff) {
    /**
     * @type {ItemJSON}
     */
    const right = splitItem(this, diff)
    right.content = this.content.splice(diff)
    return right
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  write (encoder) {
    super.write(encoder, structJSONRefNumber)
    const len = this.content.length
    encoding.writeVarUint(encoder, len)
    for (let i = 0; i < len; i++) {
      const c = this.content[i]
      encoding.writeVarString(encoder, c === undefined ? 'undefined' : JSON.stringify(c))
    }
  }
}

export class ItemJSONRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super(decoder, info)
    const len = decoding.readVarUint(decoder)
    const cs = []
    for (let i = 0; i < len; i++) {
      const c = decoding.readVarString(decoder)
      if (c === 'undefined') {
        cs.push(undefined)
      } else {
        cs.push(JSON.parse(c))
      }
    }
    this.content = cs
  }
  /**
   * @param {Transaction} transaction
   * @return {ItemJSON}
   */
  toStruct (transaction) {
    const store = transaction.y.store
    return new ItemJSON(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      this.parent === null ? null : getItemType(store, this.parent),
      this.parentSub,
      this.content
    )
  }
}
