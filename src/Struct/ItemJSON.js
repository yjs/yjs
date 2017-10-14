import Item from './Item.js'

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
  _toBinary (y, encoder) {
    super._toBinary(y, encoder)
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
}
