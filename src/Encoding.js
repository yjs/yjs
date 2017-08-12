import utf8 from 'utf-8'

const bits7 = 0b1111111
const bits8 = 0b11111111

export class BinaryEncoder {
  constructor () {
    this.data = []
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

export class BinaryDecoder {
  constructor (buffer) {
    if (buffer instanceof ArrayBuffer) {
      this.uint8arr = new Uint8Array(buffer)
    } else if (buffer instanceof Uint8Array || (typeof Buffer !== 'undefined' && buffer instanceof Buffer)) {
      this.uint8arr = buffer
    } else {
      throw new Error('Expected an ArrayBuffer or Uint8Array!')
    }
    this.pos = 0
  }

  skip8 () {
    this.pos++
  }

  readUint8 () {
    return this.uint8arr[this.pos++]
  }

  readUint32 () {
    let uint =
      this.uint8arr[this.pos] +
      (this.uint8arr[this.pos + 1] << 8) +
      (this.uint8arr[this.pos + 2] << 16) +
      (this.uint8arr[this.pos + 3] << 24)
    this.pos += 4
    return uint
  }

  peekUint8 () {
    return this.uint8arr[this.pos]
  }

  readVarUint () {
    let num = 0
    let len = 0
    while (true) {
      let r = this.uint8arr[this.pos++]
      num = num | ((r & bits7) << len)
      len += 7
      if (r < 1 << 7) {
        return num >>> 0 // return unsigned number!
      }
      if (len > 35) {
        throw new Error('Integer out of range!')
      }
    }
  }

  readVarString () {
    let len = this.readVarUint()
    let bytes = new Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = this.uint8arr[this.pos++]
    }
    return utf8.getStringFromBytes(bytes)
  }

  peekVarString () {
    let pos = this.pos
    let s = this.readVarString()
    this.pos = pos
    return s
  }

  readOpID () {
    let user = this.readVarUint()
    if (user !== 0xFFFFFF) {
      return [user, this.readVarUint()]
    } else {
      return [user, this.readVarString()]
    }
  }
}
