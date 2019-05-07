
import {
  AbstractItem,
  AbstractItemRef,
  computeItemParams,
  GC,
  StructStore, Transaction, AbstractType, ID // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as buffer from 'lib0/buffer.js'

/**
 * @private
 */
export const structBinaryRefNumber = 1

/**
 * @private
 */
export class ItemBinary extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {Uint8Array} content
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
    encoding.writeVarUint8Array(encoder, this.content)
  }
}

/**
 * @private
 */
export class ItemBinaryRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    /**
     * @type {Uint8Array}
     */
    this.content = buffer.copyUint8Array(decoding.readVarUint8Array(decoder))
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
