/**
 * @module structs
 */

import {
  AbstractItem,
  AbstractItemRef,
  computeItemParams,
  GC,
  StructStore, Transaction, AbstractType, ID // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structBinaryRefNumber = 1

export class ItemBinary extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {ArrayBuffer} content
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, content) {
    super(id, left, origin, right, rightOrigin, parent, parentSub)
    this.content = content
  }
  getContent () {
    return [this.content]
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
    return new ItemBinary(id, left, origin, right, rightOrigin, parent, parentSub, this.content)
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structBinaryRefNumber)
    encoding.writePayload(encoder, this.content)
  }
}

export class ItemBinaryRef extends AbstractItemRef {
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
    this.content = decoding.readPayload(decoder)
  }
  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {number} offset
   * @return {ItemBinary|GC}
   */
  toStruct (transaction, store, offset) {
    const { left, right, parent, parentSub } = computeItemParams(transaction, store, this.left, this.right, this.parent, this.parentSub, this.parentYKey)
    return parent === null
      ? new GC(this.id, this.length)
      : new ItemBinary(
        this.id,
        left,
        this.left,
        right,
        this.right,
        parent,
        parentSub,
        this.content
      )
  }
}
