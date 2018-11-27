/* eslint-env browser */

import * as binary from './binary.js'
import * as globals from './globals.js'

/**
 * @typedef {Object} Channel
 * @property {Set<Function>} Channel.subs
 * @property {BC} Channel.bc
 */

/**
 * @type {Map<string, Channel>}
 */
const channels = new Map()

class LocalStoragePolyfill {
  constructor (room) {
    this.room = room
    this.onmessage = null
    addEventListener('storage', e => e.key === room && this.onmessage !== null && this.onmessage({ data: binary.fromBase64(e.newValue) }))
  }
  /**
   * @param {ArrayBuffer} data
   */
  postMessage (buf) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.room, binary.toBase64(globals.createUint8ArrayFromArrayBuffer(buf)))
    }
  }
}

// Use BroadcastChannel or Polyfill
const BC = typeof BroadcastChannel === 'undefined' ? LocalStoragePolyfill : BroadcastChannel

/**
 * @param {string} room
 * @return {Channel}
 */
const getChannel = room => {
  let c = channels.get(room)
  if (c === undefined) {
    const subs = new Set()
    const bc = new BC(room)
    bc.onmessage = e => subs.forEach(sub => sub(e.data))
    c = {
      bc, subs
    }
    channels.set(room, c)
  }
  return c
}

/**
 * @function
 * @param {string} room
 * @param {Function} f
 */
export const subscribe = (room, f) => getChannel(room).subs.add(f)

/**
 * Publish data to all subscribers (including subscribers on this tab)
 *
 * @function
 * @param {string} room
 * @param {ArrayBuffer} data
 */
export const publish = (room, data) => {
  const c = getChannel(room)
  c.bc.postMessage(data)
  c.subs.forEach(sub => sub(data))
}
