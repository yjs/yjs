
import {
  AbstractStructRef,
  AbstractStruct,
  createID,
  addStruct,
  StructStore, Transaction, ID // eslint-disable-line
} from '../internals.js'

import * as decoding from 'lib0/decoding.js'
import * as encoding from 'lib0/encoding.js'

export const structGCRefNumber = 0

/**
 * @private
 */
export class GC extends AbstractStruct {
  /**
   * @param {ID} id
   * @param {number} length
   */
  constructor (id, length) {
    super(id, length)
    this.deleted = true
  }

  delete () {}

  /**
   * @param {GC} right
   * @return {boolean}
   */
  mergeWith (right) {
    this.length += right.length
    return true
  }

  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    addStruct(transaction.doc.store, this)
  }

  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoding.writeUint8(encoder, structGCRefNumber)
    encoding.writeVarUint(encoder, this.length - offset)
  }
}

/**
 * @private
 */
export class GCRef extends AbstractStructRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(id)
    /**
     * @type {number}
     */
    this.length = decoding.readVarUint(decoder)
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {number} offset
   * @return {GC}
   */
  toStruct (transaction, store, offset) {
    if (offset > 0) {
      // @ts-ignore
      this.id = createID(this.id.client, this.id.clock + offset)
      this.length -= offset
    }
    return new GC(
      this.id,
      this.length
    )
  }
}
