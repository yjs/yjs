import { splitHelper, default as Item } from './Item.js'

export default class ItemJSON extends Item {
  constructor () {
    super()
    this._content = null
  }
  get _length () {
    return this._content.length
  }
  _fromBinary (y, decoder) {
    let missing = super._fromBinary(y, decoder)
    let len = decoder.readVarUint()
    this._content = new Array(len)
    for (let i = 0; i < len; i++) {
      this._content[i] = JSON.parse(decoder.readVarString())
    }
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder)
    let len = this._content.length
    encoder.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      encoder.writeVarString(JSON.stringify(this._content[i]))
    }
  }
  _logString () {
    let s = super._logString()
    return 'ItemJSON: ' + s
  }
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    } else if (diff >= this._length) {
      return this._right
    }
    let item = new ItemJSON()
    item._content = this._content.splice(diff)
    splitHelper(y, this, item, diff)
    return item
  }
}
