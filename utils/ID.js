/**
 * @module utils
 */

import { getStructReference } from './structReferences.js'
import * as decoding from '../lib/decoding.js'
import * as encoding from '../lib/encoding.js'

export class ID {
  constructor (user, clock) {
    this.user = user // TODO: rename to client
    this.clock = clock
  }
  clone () {
    return new ID(this.user, this.clock)
  }
  equals (id) {
    return id !== null && id.user === this.user && id.clock === this.clock
  }
  lessThan (id) {
    if (id.constructor === ID) {
      return this.user < id.user || (this.user === id.user && this.clock < id.clock)
    } else {
      return false
    }
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  encode (encoder) {
    encoding.writeVarUint(encoder, this.user)
    encoding.writeVarUint(encoder, this.clock)
  }
}

export const createID = (user, clock) => new ID(user, clock)

export const RootFakeUserID = 0xFFFFFF

export class RootID {
  constructor (name, typeConstructor) {
    this.user = RootFakeUserID
    this.name = name
    this.type = getStructReference(typeConstructor)
  }
  equals (id) {
    return id !== null && id.user === this.user && id.name === this.name && id.type === this.type
  }
  lessThan (id) {
    if (id.constructor === RootID) {
      return this.user < id.user || (this.user === id.user && (this.name < id.name || (this.name === id.name && this.type < id.type)))
    } else {
      return true
    }
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  encode (encoder) {
    encoding.writeVarUint(encoder, this.user)
    encoding.writeVarString(encoder, this.name)
    encoding.writeVarUint(encoder, this.type)
  }
}

/**
 * Create a new root id.
 *
 * @example
 *   y.define('name', Y.Array) // name, and typeConstructor
 *
 * @param {string} name
 * @param {Function} typeConstructor must be defined in structReferences
 */
export const createRootID = (name, typeConstructor) => new RootID(name, typeConstructor)

/**
 * Read ID.
 * * If first varUint read is 0xFFFFFF a RootID is returned.
 * * Otherwise an ID is returned
 *
 * @param {decoding.Decoder} decoder
 * @return {ID|RootID}
 */
export const decode = decoder => {
  const user = decoding.readVarUint(decoder)
  if (user === RootFakeUserID) {
    // read property name and type id
    const rid = createRootID(decoding.readVarString(decoder), null)
    rid.type = decoding.readVarUint(decoder)
    return rid
  }
  return createID(user, decoding.readVarUint(decoder))
}
