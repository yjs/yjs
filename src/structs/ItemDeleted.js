/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import { AbstractItem, AbstractItemRef } from './AbstractItem.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { ID } from '../utils/ID.js' // eslint-disable-line
import { getItemCleanEnd, getItemCleanStart, getItemType } from '../utils/StructStore.js'
import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line

export const structDeletedRefNumber = 2

export class ItemDeleted extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {number} length
   */
  constructor (id, left, right, parent, parentSub, length) {
    super(id, left, right, parent, parentSub)
    this.length = length
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemDeleted(id, left, right, parent, parentSub, this.length)
  }
  /**
   * @param {ItemDeleted} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (right.origin === this && this.right === right) {
      this.length += right.length
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
    this.length = decoding.readVarUint(decoder)
  }
  /**
   * @param {Transaction} transaction
   * @return {ItemDeleted}
   */
  toStruct (transaction) {
    const y = transaction.y
    const store = y.store
    return new ItemDeleted(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      // @ts-ignore
      this.parent === null ? y.get(this.parentYKey) : getItemType(store, this.parent).type,
      this.parentSub,
      this.length
    )
  }
}
