import { splitHelper, default as Item } from './Item.js'
import { logID } from '../MessageHandler/messageToString.js'

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
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `ItemJSON(id:${logID(this._id)},content:${JSON.stringify(this._content)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${logID(this._parentSub)})`
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
