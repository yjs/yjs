import '../../node_modules/utf8/utf8.js'

const bits7 = 0b1111111
const bits8 = 0b11111111

export default class BinaryEncoder {
  constructor () {
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
    let bytes = utf8.setBytesFromString(str)
    let len = bytes.length
    this.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      this.data.push(bytes[i])
    }
  }

  writeOpID (id) {
    let user = id[0]
    this.writeVarUint(user)
    if (user !== 0xFFFFFF) {
      this.writeVarUint(id[1])
    } else {
      this.writeVarString(id[1])
    }
  }
}
