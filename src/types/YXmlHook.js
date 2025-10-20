import {
  YMap,
  YXmlHookRefID,
  UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2 // eslint-disable-line
} from '../internals.js'

/**
 * You can manage binding to a custom type with YXmlHook.
 *
 * @extends {YMap<any>}
 */
export class YXmlHook extends YMap {
  /**
   * @param {string} hookName nodeName of the Dom Node.
   */
  constructor (hookName) {
    super()
    /**
     * @type {string}
     */
    this.hookName = hookName
  }

  /**
   * @return {this}
   */
  _copy () {
    return /** @type {this} */ (new YXmlHook(this.hookName))
  }

  /**
   * Makes a copy of this data type that can be included somewhere else.
   *
   * Note that the content is only readable _after_ it has been included somewhere in the Ydoc.
   *
   * @return {this}
   */
  clone () {
    const el = this._copy()
    this.forEach((value, key) => {
      el.set(key, value)
    })
    return el
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
   */
  _write (encoder) {
    encoder.writeTypeRef(YXmlHookRefID)
    encoder.writeKey(this.hookName)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {import('../utils/types.js').YType}
 *
 * @private
 * @function
 */
export const readYXmlHook = decoder =>
  new YXmlHook(decoder.readKey())
