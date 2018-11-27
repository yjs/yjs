/* eslint-env browser */

/**
 * @module binary
 */

import * as string from './string.js'
import * as globals from './globals.js'

export const BITS32 = 0xFFFFFFFF
export const BITS21 = (1 << 21) - 1
export const BITS16 = (1 << 16) - 1

export const BIT26 = 1 << 26
export const BIT32 = 1 << 32

/**
 * @param {Uint8Array} bytes
 * @return {string}
 */
export const toBase64 = bytes => {
  let s = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    s += string.fromCharCode(bytes[i])
  }
  return btoa(s)
}

/**
 * @param {string} s
 * @return {Uint8Array}
 */
export const fromBase64 = s => {
  const a = atob(s)
  const bytes = globals.createUint8ArrayFromLen(a.length)
  for (let i = 0; i < a.length; i++) {
    bytes[i] = a.charCodeAt(i)
  }
  return bytes
}
