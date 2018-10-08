import Item, { splitHelper } from './Item.js'
import { logItemHelper } from '../MessageHandler/messageToString.js'

export default class ItemJSON extends Item {
  constructor () {
    super()
    this._content = null
  }
  _copy () {
    let struct = super._copy()
    struct._content = this._content
    return struct
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
      let parsed
      if (ctnt === 'undefined') {
        parsed = undefined
      } else {
        parsed = JSON.parse(ctnt)
      }
      this._content[i] = parsed
    }
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder)
    let len = this._content.length
    encoder.writeVarUint(len)
    for (let i = 0; i < len; i++) {
      let encoded
      let content = this._content[i]
      if (content === undefined) {
        encoded = 'undefined'
      } else {
        encoded = JSON.stringify(content)
      }
      encoder.writeVarString(encoded)
    }
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemJSON', this, `content:${JSON.stringify(this._content)}`)
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
