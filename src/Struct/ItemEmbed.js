import Item from './Item.js'
import { logItemHelper } from '../message.js'
import * as encoding from '../../lib/encoding.js'
import * as decoding from '../../lib/decoding.js'

/**
 * @typedef {import('../index.js').Y} Y
 */

export default class ItemEmbed extends Item {
  constructor () {
    super()
    this.embed = null
  }
  _copy (undeleteChildren, copyPosition) {
    let struct = super._copy()
    struct.embed = this.embed
    return struct
  }
  get _length () {
    return 1
  }
  /**
   * @param {Y} y
   * @param {decoding.Decoder} decoder
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.embed = JSON.parse(decoding.readVarString(decoder))
    return missing
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoding.writeVarString(encoder, JSON.stringify(this.embed))
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemEmbed', this, `embed:${JSON.stringify(this.embed)}`)
  }
}
