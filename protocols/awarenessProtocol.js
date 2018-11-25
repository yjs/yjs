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
 * @property {Object} state
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
    const {userID, state} = stateUpdates[i]
    encoding.writeVarUint(encoder, userID)
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
    const state = JSON.parse(decoding.readVarString(decoder))
    if (userID !== y.userID) {
      if (state === null) {
        if (y.awareness.has(userID)) {
          y.awareness.delete(userID)
          removed.push(userID)
        }
      } else {
        if (y.awareness.has(userID)) {
          updated.push(userID)
        } else {
          added.push(userID)
        }
        y.awareness.set(userID, state)
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
 */
export const forwardUsersStateChange = (decoder, encoder) => {
  const len = decoding.readVarUint(decoder)
  const updates = []
  encoding.writeVarUint(encoder, messageUsersStateChanged)
  encoding.writeVarUint(encoder, len)
  for (let i = 0; i < len; i++) {
    const userID = decoding.readVarUint(decoder)
    const state = decoding.readVarString(decoder)
    encoding.writeVarUint(encoder, userID)
    encoding.writeVarString(encoder, state)
    updates.push({userID, state: JSON.parse(state)})
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
 * @param {decoding.Decoder} decoder
 * @param {encoding.Encoder} encoder
 */
export const forwardAwarenessMessage = (decoder, encoder) => {
  switch (decoding.readVarUint(decoder)) {
    case messageUsersStateChanged:
      return forwardUsersStateChange(decoder, encoder)
  }
}
