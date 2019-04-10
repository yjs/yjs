/**
 * @module structs
 */

import {
  AbstractItem,
  AbstractItemRef,
  computeItemParams,
  GC,
  Transaction, StructStore, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structEmbedRefNumber = 3

export class ItemEmbed extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {Object} embed
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, embed) {
    super(id, left, origin, right, rightOrigin, parent, parentSub)
    this.embed = embed
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
    return new ItemEmbed(id, left, origin, right, rightOrigin, parent, parentSub, this.embed)
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structEmbedRefNumber)
    encoding.writeVarString(encoder, JSON.stringify(this.embed))
  }
}

export class ItemEmbedRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    /**
     * @type {ArrayBuffer}
     */
    this.embed = JSON.parse(decoding.readVarString(decoder))
  }
  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {number} offset
   * @return {ItemEmbed|GC}
   */
  toStruct (transaction, store, offset) {
    const { left, right, parent, parentSub } = computeItemParams(transaction, store, this.left, this.right, this.parent, this.parentSub, this.parentYKey)
    return parent === null
      ? new GC(this.id, this.length)
      : new ItemEmbed(
        this.id,
        left,
        this.left,
        right,
        this.right,
        parent,
        parentSub,
        this.embed
      )
  }
}
