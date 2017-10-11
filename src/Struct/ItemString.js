import Item from './Item'

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
  _toBinary (y, encoder) {
    super._toBinary(y, encoder)
    encoder.writeVarString(this._content)
  }
  _logString () {
    let s = super._logString()
    return 'ItemString: ' + s
  }
}
