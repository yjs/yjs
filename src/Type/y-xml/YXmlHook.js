import YMap from '../YMap.js'
import { getHook, addHook } from './hooks.js'

/**
 * You can manage binding to a custom type with YXmlHook.
 *
 * @param {String} hookName nodeName of the Dom Node.
 */
export default class YXmlHook extends YMap {
  constructor (hookName, dom) {
    super()
    this._dom = null
    this.hookName = null
    if (hookName !== undefined) {
      this.hookName = hookName
      this._dom = dom
      dom._yjsHook = hookName
      dom._yxml = this
      getHook(hookName).fillType(dom, this)
    }
  }

  /**
   * @private
   * Creates an Item with the same effect as this Item (without position effect)
   */
  _copy () {
    const struct = super._copy()
    struct.hookName = this.hookName
    return struct
  }

  /**
   * Returns the Dom representation of this YXmlHook.
   */
  getDom (_document) {
    _document = _document || document
    if (this._dom === null) {
      const dom = getHook(this.hookName).createDom(this)
      this._dom = dom
      dom._yxml = this
      dom._yjsHook = this.hookName
    }
    return this._dom
  }

  /**
   * @private
   * Removes the Dom binding.
   */
  _unbindFromDom () {
    this._dom._yxml = null
    this._yxml = null
    // TODO: cleanup hook?
  }

  /**
   * @private
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.hookName = decoder.readVarString()
    return missing
  }

  /**
   * @private
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoder.writeVarString(this.hookName)
  }

  /**
   * @private
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   */
  _integrate (y) {
    if (this.hookName === null) {
      throw new Error('hookName must be defined!')
    }
    super._integrate(y)
  }
  setDomFilter () {
    // TODO: implement new modfilter method!
  }
  enableSmartScrolling () {
    // TODO: implement new smartscrolling method!
  }
}
YXmlHook.addHook = addHook
