import { splitHelper, default as Item } from './Item.js'

export default class ItemString extends Item {
  constructor () {
    super()
    this._content = null
  }
  get _length () {
    return this._content.length
  }
  _fromBinary (y, decoder) {
    let missing = super._fromBinary(y, decoder)
    this._content = decoder.readVarString()
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoder.writeVarString(this._content)
  }
  _logString () {
    let s = super._logString()
    return 'ItemString: ' + s
  }
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    } else if (diff >= this._length) {
      return this._right
    }
    let item = new ItemString()
    item._content = this._content.slice(diff)
    this._content = this._content.slice(0, diff)
    splitHelper(y, this, item, diff)
    return item
  }
}
