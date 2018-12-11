/**
 * @module structs
 */

import { Item } from './Item.js'
import * as stringify from '../utils/structStringify.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line

export class ItemFormat extends Item {
  constructor () {
    super()
    this.key = null
    this.value = null
  }
  _copy (undeleteChildren, copyPosition) {
    let struct = super._copy()
    struct.key = this.key
    struct.value = this.value
    return struct
  }
  get _length () {
    return 1
  }
  get _countable () {
    return false
  }
  /**
   * @param {Y} y
   * @param {decoding.Decoder} decoder
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.key = decoding.readVarString(decoder)
    this.value = JSON.parse(decoding.readVarString(decoder))
    return missing
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoding.writeVarString(encoder, this.key)
    encoding.writeVarString(encoder, JSON.stringify(this.value))
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return stringify.logItemHelper('ItemFormat', this, `key:${JSON.stringify(this.key)},value:${JSON.stringify(this.value)}`)
  }
}
