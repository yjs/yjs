/**
 * @module utils
 */

/* global crypto */

export const generateRandomUint32 = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues != null) {
    // browser
    let arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0]
  } else if (typeof crypto !== 'undefined' && crypto.randomBytes != null) {
    // node
    let buf = crypto.randomBytes(4)
    return new Uint32Array(buf.buffer)[0]
  } else {
    return Math.ceil(Math.random() * 0xFFFFFFFF)
  }
}
