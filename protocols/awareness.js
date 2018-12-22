/**
 * @module awareness-protocol
 */

import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line

const messageUsersStateChanged = 0

/**
 * @typedef {Object} UserStateUpdate
 * @property {number} UserStateUpdate.userID
 * @property {number} UserStateUpdate.clock
 * @property {Object} UserStateUpdate.state
 */

/**
 * @param {encoding.Encoder} encoder
 * @param {Array<UserStateUpdate>} stateUpdates
 */
export const writeUsersStateChange = (encoder, stateUpdates) => {
  const len = stateUpdates.length
  encoding.writeVarUint(encoder, messageUsersStateChanged)
  encoding.writeVarUint(encoder, len)
  for (let i = 0; i < len; i++) {
    const {userID, state, clock} = stateUpdates[i]
    encoding.writeVarUint(encoder, userID)
    encoding.writeVarUint(encoder, clock)
    encoding.writeVarString(encoder, JSON.stringify(state))
  }
}

export const readUsersStateChange = (decoder, y) => {
  const added = []
  const updated = []
  const removed = []
  const len = decoding.readVarUint(decoder)
  for (let i = 0; i < len; i++) {
    const userID = decoding.readVarUint(decoder)
    const clock = decoding.readVarUint(decoder)
    const state = JSON.parse(decoding.readVarString(decoder))
    if (userID !== y.userID) {
      const uClock = y.awarenessClock.get(userID) || 0
      y.awarenessClock.set(userID, clock)
      if (state === null) {
        // only write if clock increases. cannot overwrite
        if (y.awareness.has(userID) && uClock < clock) {
          y.awareness.delete(userID)
          removed.push(userID)
        }
      } else if (uClock <= clock) { // allow to overwrite (e.g. when client was on, then offline)
        if (y.awareness.has(userID)) {
          updated.push(userID)
        } else {
          added.push(userID)
        }
        y.awareness.set(userID, state)
        y.awarenessClock.set(userID, clock)
      }
    }
  }
  if (added.length > 0 || updated.length > 0 || removed.length > 0) {
    y.emit('awareness', {
      added, updated, removed
    })
  }
}

/**
 * @param {decoding.Decoder} decoder
 * @param {encoding.Encoder} encoder
 * @return {Array<UserStateUpdate>}
 */
export const forwardUsersStateChange = (decoder, encoder) => {
  const len = decoding.readVarUint(decoder)
  const updates = []
  encoding.writeVarUint(encoder, messageUsersStateChanged)
  encoding.writeVarUint(encoder, len)
  for (let i = 0; i < len; i++) {
    const userID = decoding.readVarUint(decoder)
    const clock = decoding.readVarUint(decoder)
    const state = decoding.readVarString(decoder)
    encoding.writeVarUint(encoder, userID)
    encoding.writeVarUint(encoder, clock)
    encoding.writeVarString(encoder, state)
    updates.push({userID, state: JSON.parse(state), clock})
  }
  return updates
}

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const readAwarenessMessage = (decoder, y) => {
  switch (decoding.readVarUint(decoder)) {
    case messageUsersStateChanged:
      readUsersStateChange(decoder, y)
      break
  }
}

/**
 * @typedef {Object} UserState
 * @property {number} UserState.userID
 * @property {any} UserState.state
 * @property {number} UserState.clock
 */

/**
 * @param {decoding.Decoder} decoder
 * @param {encoding.Encoder} encoder
 * @return {Array<UserState>} Array of state updates
 */
export const forwardAwarenessMessage = (decoder, encoder) => {
  let s = []
  switch (decoding.readVarUint(decoder)) {
    case messageUsersStateChanged:
      s = forwardUsersStateChange(decoder, encoder)
  }
  return s
}
