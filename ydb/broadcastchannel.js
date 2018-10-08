/* eslint-env browser */

import * as decoding from './decoding.js'
import * as encoding from './encoding.js'

const bc = new BroadcastChannel('ydb-client')
const subs = new Map()

bc.onmessage = event => {
  const decoder = decoding.createDecoder(event.data)
  const room = decoding.readVarString(decoder)
  const update = decoding.readTail(decoder)
  const rsubs = subs.get(room)
  if (rsubs !== undefined) {
    rsubs.forEach(f => f(update))
  }
}

/**
 * @param {string} room
 * @param {function(ArrayBuffer)} f
 */
export const subscribe = (room, f) => {
  let rsubs = subs.get(room)
  if (rsubs === undefined) {
    rsubs = new Set()
    subs.set(room, rsubs)
  }
  rsubs.add(f)
}

/**
 * @param {string} room
 * @param {ArrayBuffer} update
 */
export const publish = (room, update) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarString(encoder, room)
  encoding.writeArrayBuffer(encoder, update)
  bc.postMessage(encoding.toBuffer(encoder))
  const rsubs = subs.get(room)
  if (rsubs !== undefined) {
    rsubs.forEach(f => f(update))
  }
}
