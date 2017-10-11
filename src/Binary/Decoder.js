import utf8 from 'utf-8'

export default class BinaryDecoder {
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

  clone (newPos = this.pos) {
    let decoder = new BinaryDecoder(this.uint8arr)
    decoder.pos = newPos
    return decoder
  }

  get length () {
    return this.uint8arr.length
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
