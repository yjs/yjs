/**
 * @module structs
 */

import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line
import { AbstractItem, AbstractItemRef } from './AbstractItem.js'
import { ItemType } from './ItemType.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { Y } from '../utils/Y.js'  // eslint-disable-line
import { ID } from '../utils/ID.js' // eslint-disable-line
import { getItemCleanEnd, getItemCleanStart, getItemType } from '../utils/StructStore.js'
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line

export const structEmbedRefNumber = 3

export class ItemEmbed extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType} parent
   * @param {string | null} parentSub
   * @param {Object} embed
   */
  constructor (id, left, right, parent, parentSub, embed) {
    super(id, left, right, parent, parentSub)
    this.embed = embed
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemEmbed(id, left, right, parent, parentSub, this.embed)
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  write (encoder) {
    super.write(encoder, structEmbedRefNumber)
    encoding.writeVarString(encoder, JSON.stringify(this.embed))
  }
}

export class ItemEmbedRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super(decoder, info)
    /**
     * @type {ArrayBuffer}
     */
    this.embed = JSON.parse(decoding.readVarString(decoder))
  }
  /**
   * @param {Transaction} transaction
   * @return {ItemEmbed}
   */
  toStruct (transaction) {
    const y = transaction.y
    const store = y.store
    return new ItemEmbed(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      // @ts-ignore
      this.parent === null ? y.get(this.parentYKey) : getItemType(store, this.parent),
      this.parentSub,
      this.embed
    )
  }
}
