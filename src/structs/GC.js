/**
 * @module structs
 */
import { AbstractRef, AbstractStruct } from './AbstractStruct.js'
import { ID, readID, createID, writeID } from '../utils/ID.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import * as decoding from 'lib0/decoding.js'
import * as encoding from 'lib0/encoding.js'

export const structGCRefNumber = 0

// TODO should have the same base class as Item
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
    this.length = length
  }

  get deleted () {
    return true
  }

  /**
   * @param {AbstractStruct} right
   * @return {boolean}
   */
  mergeWith (right) {
    this.length += right.length
    return true
  }

  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoding.writeUint8(encoder, structGCRefNumber)
    if (offset === 0) {
      writeID(encoder, this.id)
    } else {
      writeID(encoder, createID(this.id.client, this.id.clock + offset))
    }
    encoding.writeVarUint(encoder, this.length)
  }
}

export class GCRef extends AbstractRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(id)
    /**
     * @type {ID}
     */
    this.id = id
    /**
     * @type {number}
     */
    this.length = decoding.readVarUint(decoder)
  }
  missing () {
    return [
      createID(this.id.client, this.id.clock - 1)
    ]
  }
  /**
   * @return {GC}
   */
  toStruct () {
    return new GC(
      this.id,
      this.length
    )
  }
}
