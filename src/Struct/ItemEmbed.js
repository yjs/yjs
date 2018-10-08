import Item from './Item.js'
import { logItemHelper } from '../MessageHandler/messageToString.js'

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
