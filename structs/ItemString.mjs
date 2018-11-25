/**
 * @module structs
 */

import { Item, splitHelper } from './Item.mjs'
import { logItemHelper } from '../protocols/syncProtocol.mjs'
import * as encoding from '../lib/encoding.mjs'
import * as decoding from '../lib/decoding.mjs'
import { Y } from '../utils/Y.mjs' // eslint-disable-line

export class ItemString extends Item {
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
  /**
   * @param {Y} y
   * @param {decoding.Decoder} decoder
   */
  _fromBinary (y, decoder) {
    let missing = super._fromBinary(y, decoder)
    this._content = decoding.readVarString(decoder)
    return missing
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoding.writeVarString(encoder, this._content)
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemString', this, `content:"${this._content}"`)
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
