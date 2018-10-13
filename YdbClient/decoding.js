
/* global Buffer */

import * as globals from './globals.js'

/**
 * A Decoder handles the decoding of an ArrayBuffer.
 */
class Decoder {
  /**
   * @param {ArrayBuffer} buffer Binary data to decode
   */
  constructor (buffer) {
    this.arr = new Uint8Array(buffer)
    this.pos = 0
  }
}

/**
 * @param {ArrayBuffer} buffer
 * @return {Decoder}
 */
export const createDecoder = buffer => new Decoder(buffer)

export const hasContent = decoder => decoder.pos !== decoder.arr.length

/**
 * Clone a decoder instance.
 * Optionally set a new position parameter.
 * @param {Decoder} decoder The decoder instance
 * @return {Decoder} A clone of `decoder`
 */
export const clone = (decoder, newPos = decoder.pos) => {
  let _decoder = createDecoder(decoder.arr.buffer)
  _decoder.pos = newPos
  return _decoder
}

/**
 * Read `len` bytes as an ArrayBuffer.
 * @param {Decoder} decoder The decoder instance
 * @param {number} len The length of bytes to read
 * @return {ArrayBuffer}
 */
export const readArrayBuffer = (decoder, len) => {
  const arrayBuffer = globals.createUint8ArrayFromLen(len)
  const view = globals.createUint8ArrayFromBuffer(decoder.arr.buffer, decoder.pos, len)
  arrayBuffer.set(view)
  decoder.pos += len
  return arrayBuffer.buffer
}

/**
 * Read variable length payload as ArrayBuffer
 * @param {Decoder} decoder
 * @return {ArrayBuffer}
 */
export const readPayload = decoder => readArrayBuffer(decoder, readVarUint(decoder))

/**
 * Read the rest of the content as an ArrayBuffer
 * @param {Decoder} decoder
 * @return {ArrayBuffer}
 */
export const readTail = decoder => readArrayBuffer(decoder, decoder.arr.length - decoder.pos)

/**
 * Skip one byte, jump to the next position.
 * @param {Decoder} decoder The decoder instance
 * @return {number} The next position
 */
export const skip8 = decoder => decoder.pos++

/**
 * Read one byte as unsigned integer.
 * @param {Decoder} decoder The decoder instance
 * @return {number} Unsigned 8-bit integer
 */
export const readUint8 = decoder => decoder.arr[decoder.pos++]

/**
 * Read 4 bytes as unsigned integer.
 *
 * @param {Decoder} decoder
 * @return {number} An unsigned integer.
 */
export const readUint32 = decoder => {
  let uint =
    decoder.arr[decoder.pos] +
    (decoder.arr[decoder.pos + 1] << 8) +
    (decoder.arr[decoder.pos + 2] << 16) +
    (decoder.arr[decoder.pos + 3] << 24)
  decoder.pos += 4
  return uint
}

/**
 * Look ahead without incrementing position.
 * to the next byte and read it as unsigned integer.
 *
 * @param {Decoder} decoder
 * @return {number} An unsigned integer.
 */
export const peekUint8 = decoder => decoder.arr[decoder.pos]

/**
 * Read unsigned integer (32bit) with variable length.
 * 1/8th of the storage is used as encoding overhead.
 *  * numbers < 2^7 is stored in one bytlength
 *  * numbers < 2^14 is stored in two bylength
 *
 * @param {Decoder} decoder
 * @return {number} An unsigned integer.length
 */
export const readVarUint = decoder => {
  let num = 0
  let len = 0
  while (true) {
    let r = decoder.arr[decoder.pos++]
    num = num | ((r & 0b1111111) << len)
    len += 7
    if (r < 1 << 7) {
      return num >>> 0 // return unsigned number!
    }
    if (len > 35) {
      throw new Error('Integer out of range!')
    }
  }
}

/**
 * Read string of variable length
 * * varUint is used to store the length of the string
 *
 * Transforming utf8 to a string is pretty expensive. The code performs 10x better
 * when String.fromCodePoint is fed with all characters as arguments.
 * But most environments have a maximum number of arguments per functions.
 * For effiency reasons we apply a maximum of 10000 characters at once.
 *
 * @param {Decoder} decoder
 * @return {String} The read String.
 */
export const readVarString = decoder => {
  let remainingLen = readVarUint(decoder)
  let encodedString = ''
  while (remainingLen > 0) {
    const nextLen = remainingLen < 10000 ? remainingLen : 10000
    const bytes = new Array(nextLen)
    for (let i = 0; i < nextLen; i++) {
      bytes[i] = decoder.arr[decoder.pos++]
    }
    encodedString += String.fromCodePoint.apply(null, bytes)
    remainingLen -= nextLen
  }
  return decodeURIComponent(escape(encodedString))
}

/**
 * Look ahead and read varString without incrementing position
 * @param {Decoder} decoder
 * @return {string}
 */
export const peekVarString = decoder => {
  let pos = decoder.pos
  let s = readVarString(decoder)
  decoder.pos = pos
  return s
}

/**
 * Read ID.
 * * If first varUint read is 0xFFFFFF a RootID is returned.
 * * Otherwise an ID is returned
 *
 * @param {Decoder} decoder
 * @return {ID}
 *
export const readID = decoder => {
  let user = decoder.readVarUint()
  if (user === RootFakeUserID) {
    // read property name and type id
    const rid = new RootID(decoder.readVarString(), null)
    rid.type = decoder.readVarUint()
    return rid
  }
  return new ID(user, decoder.readVarUint())
}
*/
