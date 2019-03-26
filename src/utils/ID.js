/**
 * @module utils
 */

import * as decoding from 'lib0/decoding.js'
import * as encoding from 'lib0/encoding.js'

export class ID {
  /**
   * @param {number} client client id
   * @param {number} clock unique per client id, continuous number
   */
  constructor (client, clock) {
    /**
     * @type {number} Client id
     */
    this.client = client
    /**
     * @type {number} unique per client id, continuous number
     */
    this.clock = clock
  }
  /**
   * @return {ID}
   */
  clone () {
    return new ID(this.client, this.clock)
  }
  /**
   * @param {ID} id
   * @return {boolean}
   */
  equals (id) {
    return id !== null && id.client === this.client && id.clock === this.clock
  }
  /**
   * @param {ID} id
   * @return {boolean}
   */
  lessThan (id) {
    if (id.constructor === ID) {
      return this.client < id.client || (this.client === id.client && this.clock < id.clock)
    } else {
      return false
    }
  }
}

/**
 * @param {number} client
 * @param {number} clock
 */
export const createID = (client, clock) => new ID(client, clock)

const isNullID = 0xFFFFFF

/**
 * @param {encoding.Encoder} encoder
 * @param {ID} id
 */
export const writeID = (encoder, id) => {
  encoding.writeVarUint(encoder, id.client)
  encoding.writeVarUint(encoder, id.clock)
}

/**
 * @param {encoding.Encoder} encoder
 */
export const writeNullID = (encoder) =>
  encoding.writeVarUint(encoder, isNullID)

/**
 * Read ID.
 * * If first varUint read is 0xFFFFFF a RootID is returned.
 * * Otherwise an ID is returned
 *
 * @param {decoding.Decoder} decoder
 * @return {ID | null}
 */
export const readID = decoder => {
  const client = decoding.readVarUint(decoder)
  return client === isNullID ? null : createID(client, decoding.readVarUint(decoder))
}
