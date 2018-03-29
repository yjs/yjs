import { default as Item } from './Item.js'
import { logItemHelper } from '../MessageHandler/messageToString.js'

export default class ItemFormat extends Item {
  constructor () {
    super()
    this.key = null
    this.value = null
  }
  _copy (undeleteChildren, copyPosition) {
    let struct = super._copy(undeleteChildren, copyPosition)
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
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.key = decoder.readVarString()
    this.value = JSON.parse(decoder.readVarString())
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoder.writeVarString(this.key)
    encoder.writeVarString(JSON.stringify(this.value))
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemFormat', this, `key:${JSON.stringify(this.key)},value:${JSON.stringify(this.value)}`)
  }
}
