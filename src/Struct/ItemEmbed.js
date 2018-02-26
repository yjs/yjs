import { default as Item } from './Item.js'
import { logID } from '../MessageHandler/messageToString.js'

export default class ItemEmbed extends Item {
  constructor () {
    super()
    this.embed = null
  }
  _copy (undeleteChildren, copyPosition) {
    let struct = super._copy(undeleteChildren, copyPosition)
    struct.embed = this.embed
    return struct
  }
  get _length () {
    return 1
  }
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.embed = JSON.parse(decoder.readVarString())
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoder.writeVarString(JSON.stringify(this.embed))
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `ItemEmbed(id:${logID(this._id)},embed:${JSON.stringify(this.embed)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}
