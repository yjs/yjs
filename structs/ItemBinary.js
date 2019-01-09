/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import { Item, splitHelper } from './Item.js'
import * as stringify from '../utils/structStringify.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line

export class ItemBinary extends Item {
  constructor () {
    super()
    this._content = null
  }
  _copy () {
    let struct = super._copy()
    struct._content = this._content
    return struct
  }
  /**
   * @param {Y} y
   * @param {decoding.Decoder} decoder
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this._content = decoding.readPayload(decoder)
    return missing
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoding.writePayload(encoder, this._content)
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return stringify.logItemHelper('ItemBinary', this)
  }
}
