/**
 * @module utils
 */

import * as ID from '../utils/ID.js'

import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'

const writeStateStore = (encoder, ss) => {

}

/**
 * @typedef {Map<number, number>} StateMap
 */

/**
 * Read StateMap from Decoder and return as Map
 *
 * @param {decoding.Decoder} decoder
 * @return {StateMap}
 */
export const readStateMap = decoder => {
  const ss = new Map()
  const ssLength = decoding.readUint32(decoder)
  for (let i = 0; i < ssLength; i++) {
    const user = decoding.readVarUint(decoder)
    const clock = decoding.readVarUint(decoder)
    ss.set(user, clock)
  }
  return ss
}

/**
 * Write StateMap to Encoder
 *
 * @param {encoding.Encoder} encoder
 * @param {StateMap} state
 */
export const writeStateMap = (encoder, state) => {
  // write as fixed-size number to stay consistent with the other encode functions.
  // => anytime we write the number of objects that follow, encode as fixed-size number.
  encoding.writeUint32(encoder, state.size)
  state.forEach((clock, user) => {
    encoding.writeVarUint(encoder, user)
    encoding.writeVarUint(encoder, clock)
  })
}

/**
 * Read a StateMap from Decoder and return it as string.
 *
 * @param {decoding.Decoder} decoder
 * @return {string}
 */
export const stringifyStateMap = decoder => {
  let s = 'State Set: '
  readStateMap(decoder).forEach((clock, user) => {
    s += `(${user}: ${clock}), `
  })
  return s
}

/**
 */
export class StateStore {
  constructor (y) {
    this.y = y
    this.state = new Map()
  }
  logTable () {
    const entries = []
    for (let [user, state] of this.state) {
      entries.push({
        user, state
      })
    }
    console.table(entries)
  }
  getNextID (len) {
    const user = this.y.userID
    const state = this.getState(user)
    this.setState(user, state + len)
    return ID.createID(user, state)
  }
  updateRemoteState (struct) {
    let user = struct._id.user
    let userState = this.state.get(user)
    while (struct !== null && struct._id.clock === userState) {
      userState += struct._length
      struct = this.y.os.get(ID.createID(user, userState))
    }
    this.state.set(user, userState)
  }
  getState (user) {
    let state = this.state.get(user)
    if (state == null) {
      return 0
    }
    return state
  }
  setState (user, state) {
    // TODO: modify missingi structs here
    const beforeState = this.y._transaction.beforeState
    if (!beforeState.has(user)) {
      beforeState.set(user, this.getState(user))
    }
    this.state.set(user, state)
  }
}
