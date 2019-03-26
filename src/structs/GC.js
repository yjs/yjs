/**
 * @module structs
 */
import { AbstractRef, AbstractStruct } from './AbstractStruct.js'
import { ID, readID, createID, writeID } from '../utils/ID.js' // eslint-disable-line
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

  /**
   * @param {encoding.Encoder} encoder
   */
  write (encoder) {
    encoding.writeUint8(encoder, structGCRefNumber)
    writeID(encoder, this.id)
    encoding.writeVarUint(encoder, this.length)
  }
}

export class GCRef extends AbstractRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super()
    const id = readID(decoder)
    if (id === null) {
      throw new Error('expected id')
    }
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
