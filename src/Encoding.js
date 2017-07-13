import utf8 from 'utf-8'

const bits7 = 0b1111111

export class BinaryLength {
  constructor () {
    this.length = 0
  }
  writeUint8 (num) {
    this.length++
  }
  writeVarUint (num) {
    while (num >= 0b10000000) {
      this.length++
      num >>= 7
    }
    this.length++
  }
  writeVarString (str) {
    let len = utf8.setBytesFromString(str).length
    this.writeVarUint(len)
    this.length += len
  }
  writeOpID (id) {
    this.writeVarUint(id[0])
    this.writeVarUint(id[1])
  }
}

export class BinaryEncoder {
  constructor (binaryLength) {
    this.dataview = new DataView(new ArrayBuffer(binaryLength.length))
    this.pos = 0
  }
  writeUint8 (num) {
    this.dataview.setUint8(this.pos++, num)
  }
  writeVarUint (num) {
    while (num >= 0b10000000) {
      this.dataview.setUint8(this.pos++, 0b10000000 | (bits7 & num))
      num >>= 7
    }
    this.dataview.setUint8(this.pos++, bits7 & num)
  }
  writeVarString (str) {
    let bytes = utf8.setBytesFromString(str)
    let len = bytes.length
    this.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      this.dataview.setUint8(this.pos++, bytes[i])
    }
  }
  writeOpID (id) {
    this.writeVarUint(id[0])
    this.writeVarUint(id[1])
  }
}

export class BinaryDecoder {
  constructor (dataview) {
    this.dataview = dataview
    this.pos = 0
  }
  skip8 () {
    this.pos++
  }
  skip16 () {
    this.pos += 2
  }
  skip32 () {
    this.pos += 4
  }
  skipVar () {
    while (this.dataview.getUint8(this.pos++) >= 1 << 7) { }
  }
  readUint8 () {
    return this.dataview.getUint8(this.pos++)
  }
  readVarUint () {
    let num = 0
    let len = 0
    while (true) {
      let r = this.dataview.getUint8(this.pos++)
      num = num | ((r & bits7) << len)
      len += 7
      if (r < 1 << 7) {
        return num
      }
    }
  }
  readVarString () {
    let len = this.readVarUint()
    let bytes = new Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = this.dataview.getUint8(this.pos++)
    }
    return utf8.getStringFromBytes(bytes)
  }
  readOpID () {
    return [this.readVarUint(), this.readVarUint()]
  }
}
