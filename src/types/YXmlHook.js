
import {
  YMap,
  YXmlHookRefID
} from '../internals.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

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
   * Creates an Item with the same effect as this Item (without position effect)
   */
  _copy () {
    return new YXmlHook(this.hookName)
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object.<string, any>} [hooks] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {any} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDOM (_document = document, hooks = {}, binding) {
    const hook = hooks[this.hookName]
    let dom
    if (hook !== undefined) {
      dom = hook.createDom(this)
    } else {
      dom = document.createElement(this.hookName)
    }
    dom.setAttribute('data-yjs-hook', this.hookName)
    if (binding !== undefined) {
      binding._createAssociation(dom, this)
    }
    return dom
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   */
  _write (encoder) {
    super._write(encoder)
    encoding.writeVarUint(encoder, YXmlHookRefID)
    encoding.writeVarString(encoder, this.hookName)
  }
}

/**
 * @param {decoding.Decoder} decoder
 * @return {YXmlHook}
 *
 * @private
 * @function
 */
export const readYXmlHook = decoder =>
  new YXmlHook(decoding.readVarString(decoder))
