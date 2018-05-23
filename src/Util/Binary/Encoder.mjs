import { RootFakeUserID } from '../ID/RootID.mjs'

const bits7 = 0b1111111
const bits8 = 0b11111111

/**
 * A BinaryEncoder handles the encoding to an ArrayBuffer.
 */
export default class BinaryEncoder {
  constructor () {
    // TODO: implement chained Uint8Array buffers instead of Array buffer
    // TODO: Rewrite all methods as functions!
    this.data = []
  }

  /**
   * The current length of the encoded data.
   */
  get length () {
    return this.data.length
  }

  /**
   * The current write pointer (the same as {@link length}).
   */
  get pos () {
    return this.data.length
  }

  /**
   * Create an ArrayBuffer.
   *
   * @return {Uint8Array} A Uint8Array that represents the written data.
   */
  createBuffer () {
    return Uint8Array.from(this.data).buffer
  }

  /**
   * Write one byte as an unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint8 (num) {
    this.data.push(num & bits8)
  }

  /**
   * Write one byte as an unsigned Integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint8 (pos, num) {
    this.data[pos] = num & bits8
  }

  /**
   * Write two bytes as an unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint16 (num) {
    this.data.push(num & bits8, (num >>> 8) & bits8)
  }
  /**
   * Write two bytes as an unsigned integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint16 (pos, num) {
    this.data[pos] = num & bits8
    this.data[pos + 1] = (num >>> 8) & bits8
  }

  /**
   * Write two bytes as an unsigned integer
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint32 (num) {
    for (let i = 0; i < 4; i++) {
      this.data.push(num & bits8)
      num >>>= 8
    }
  }

  /**
   * Write two bytes as an unsigned integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint32 (pos, num) {
    for (let i = 0; i < 4; i++) {
      this.data[pos + i] = num & bits8
      num >>>= 8
    }
  }

  /**
   * Write a variable length unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeVarUint (num) {
    while (num >= 0b10000000) {
      this.data.push(0b10000000 | (bits7 & num))
      num >>>= 7
    }
    this.data.push(bits7 & num)
  }

  /**
   * Write a variable length string.
   *
   * @param {String} str The string that is to be encoded.
   */
  writeVarString (str) {
    let encodedString = unescape(encodeURIComponent(str))
    let bytes = encodedString.split('').map(c => c.codePointAt())
    let len = bytes.length
    this.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      this.data.push(bytes[i])
    }
  }

  /**
   * Write the content of another binary encoder.
   *
   * @param encoder The BinaryEncoder to be written.
   */
  writeBinaryEncoder (encoder) {
    this.data = this.data.concat(encoder.data)
  }

  /**
   * Write an ID at the current position.
   *
   * @param {ID} id The ID that is to be written.
   */
  writeID (id) {
    const user = id.user
    this.writeVarUint(user)
    if (user !== RootFakeUserID) {
      this.writeVarUint(id.clock)
    } else {
      this.writeVarString(id.name)
      this.writeVarUint(id.type)
    }
  }
}
