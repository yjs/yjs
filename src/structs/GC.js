
import {
  AbstractStructRef,
  AbstractStruct,
  createID,
  addStruct,
  Y, StructStore, Transaction, ID // eslint-disable-line
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
    super(id)
    /**
     * @type {number}
     */
    this._len = length
    this.deleted = true
  }

  get length () {
    return this._len
  }

  delete () {}

  /**
   * @param {AbstractStruct} right
   * @return {boolean}
   */
  mergeWith (right) {
    this._len += right.length
    return true
  }

  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    addStruct(transaction.y.store, this)
  }

  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoding.writeUint8(encoder, structGCRefNumber)
    encoding.writeVarUint(encoder, this._len - offset)
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
    this._len = decoding.readVarUint(decoder)
  }
  get length () {
    return this._len
  }
  missing () {
    return [
      createID(this.id.client, this.id.clock - 1)
    ]
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
      this._len = this._len - offset
    }
    return new GC(
      this.id,
      this._len
    )
  }
}
