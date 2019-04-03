/**
 * @module structs
 */

import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line
import { AbstractItem, AbstractItemRef, splitItem } from './AbstractItem.js'
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
   * @param {AbstractType} parent
   * @param {string | null} parentSub
   * @param {Array<any>} content
   */
  constructor (id, left, right, parent, parentSub, content) {
    super(id, left, right, parent, parentSub)
    /**
     * @type {Array<any>}
     */
    this.content = content
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemJSON(id, left, right, parent, parentSub, this.content)
  }
  get length () {
    return this.content.length
  }
  getContent () {
    return this.content
  }
  /**
   * @param {Transaction} transaction
   * @param {number} diff
   */
  splitAt (transaction, diff) {
    /**
     * @type {ItemJSON}
     */
    // @ts-ignore
    const right = splitItem(transaction, this, diff)
    right.content = this.content.splice(diff)
    return right
  }
  /**
   * @param {ItemJSON} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (right.origin === this && this.right === right) {
      this.content = this.content.concat(right.content)
      return true
    }
    return false
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structJSONRefNumber)
    const len = this.content.length
    encoding.writeVarUint(encoder, len - offset)
    for (let i = offset; i < len; i++) {
      const c = this.content[i]
      encoding.writeVarString(encoder, c === undefined ? 'undefined' : JSON.stringify(c))
    }
  }
}

export class ItemJSONRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
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
    const y = transaction.y
    const store = y.store
    return new ItemJSON(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      // @ts-ignore
      this.parent === null ? y.get(this.parentYKey) : getItemType(store, this.parent),
      this.parentSub,
      this.content
    )
  }
}
