import { RootFakeUserID } from '../Util/RootID.js'

const bits7 = 0b1111111
const bits8 = 0b11111111

export default class BinaryEncoder {
  constructor () {
    // TODO: implement chained Uint8Array buffers instead of Array buffer
    this.data = []
  }

  get length () {
    return this.data.length
  }

  get pos () {
    return this.data.length
  }

  createBuffer () {
    return Uint8Array.from(this.data).buffer
  }

  writeUint8 (num) {
    this.data.push(num & bits8)
  }

  setUint8 (pos, num) {
    this.data[pos] = num & bits8
  }

  writeUint16 (num) {
    this.data.push(num & bits8, (num >>> 8) & bits8)
  }

  setUint16 (pos, num) {
    this.data[pos] = num & bits8
    this.data[pos + 1] = (num >>> 8) & bits8
  }

  writeUint32 (num) {
    for (let i = 0; i < 4; i++) {
      this.data.push(num & bits8)
      num >>>= 8
    }
  }

  setUint32 (pos, num) {
    for (let i = 0; i < 4; i++) {
      this.data[pos + i] = num & bits8
      num >>>= 8
    }
  }

  writeVarUint (num) {
    while (num >= 0b10000000) {
      this.data.push(0b10000000 | (bits7 & num))
      num >>>= 7
    }
    this.data.push(bits7 & num)
  }

  writeVarString (str) {
    let encodedString = unescape(encodeURIComponent(str))
    let bytes = encodedString.split('').map(c => c.codePointAt())
    let len = bytes.length
    this.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      this.data.push(bytes[i])
    }
  }

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
