import { splitHelper, default as Item } from './Item.js'
import { logID } from '../MessageHandler/messageToString.js'

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
      const ctnt = decoder.readVarString()
      this._content[i] = JSON.parse(ctnt)
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
    let item = new ItemJSON()
    item._content = this._content.splice(diff)
    splitHelper(y, this, item, diff)
    return item
  }
}
