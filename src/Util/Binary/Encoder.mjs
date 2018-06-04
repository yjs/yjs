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
    this._currentPos = 0
    this._currentBuffer = new Uint8Array(1000)
    this._data = []
  }

  /**
   * The current length of the encoded data.
   */
  get length () {
    let len = 0
    for (let i = 0; i < this._data.length; i++) {
      len += this._data[i].length
    }
    len += this._currentPos
    return len
  }

  /**
   * The current write pointer (the same as {@link length}).
   */
  get pos () {
    return this.length
  }

  /**
   * Transform to ArrayBuffer.
   *
   * @return {ArrayBuffer} The created ArrayBuffer.
   */
  createBuffer () {
    const len = this.length
    const uint8array = new Uint8Array(len)
    let curPos = 0
    for (let i = 0; i < this._data.length; i++) {
      let d = this._data[i]
      uint8array.set(d, curPos)
      curPos += d.length
    }
    uint8array.set(new Uint8Array(this._currentBuffer.buffer, 0, this._currentPos), curPos)
    return uint8array.buffer
  }

  /**
   * Write one byte to the encoder.
   *
   * @param {number} num The byte that is to be encoded.
   */
  write (num) {
    if (this._currentPos === this._currentBuffer.length) {
      this._data.push(this._currentBuffer)
      this._currentBuffer = new Uint8Array(this._currentBuffer.length * 2)
      this._currentPos = 0
    }
    this._currentBuffer[this._currentPos++] = num
  }

  set (pos, num) {
    let buffer = null
    // iterate all buffers and adjust position
    for (let i = 0; i < this._data.length && buffer === null; i++) {
      const b = this._data[i]
      if (pos < b.length) {
        buffer = b // found buffer
      } else {
        pos -= b.length
      }
    }
    if (buffer === null) {
      // use current buffer
      buffer = this._currentBuffer
    }
    buffer[pos] = num
  }

  /**
   * Write one byte as an unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint8 (num) {
    this.write(num & bits8)
  }

  /**
   * Write one byte as an unsigned Integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint8 (pos, num) {
    this.set(pos, num & bits8)
  }

  /**
   * Write two bytes as an unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint16 (num) {
    this.write(num & bits8)
    this.write((num >>> 8) & bits8)
  }
  /**
   * Write two bytes as an unsigned integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint16 (pos, num) {
    this.set(pos, num & bits8)
    this.set(pos + 1, (num >>> 8) & bits8)
  }

  /**
   * Write two bytes as an unsigned integer
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint32 (num) {
    for (let i = 0; i < 4; i++) {
      this.write(num & bits8)
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
      this.set(pos + i, num & bits8)
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
      this.write(0b10000000 | (bits7 & num))
      num >>>= 7
    }
    this.write(bits7 & num)
  }

  /**
   * Write a variable length string.
   *
   * @param {String} str The string that is to be encoded.
   */
  writeVarString (str) {
    const encodedString = unescape(encodeURIComponent(str))
    const len = encodedString.length
    this.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      this.write(encodedString.codePointAt(i))
    }
  }

  /**
   * Write the content of another binary encoder.
   *
   * @param encoder The BinaryEncoder to be written.
   */
  writeBinaryEncoder (encoder) {
    this.writeArrayBuffer(encoder.createBuffer())
  }

  writeArrayBuffer (arrayBuffer) {
    const prevBufferLen = this._currentBuffer.length
    this._data.push(new Uint8Array(this._currentBuffer.buffer, 0, this._currentPos))
    this._data.push(new Uint8Array(arrayBuffer))
    this._currentBuffer = new Uint8Array(prevBufferLen)
    this._currentPos = 0
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
