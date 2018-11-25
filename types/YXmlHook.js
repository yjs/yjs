/**
 * @module types
 */

import { YMap } from './YMap.js'
import { createAssociation } from '../bindings/dom/util.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'

import { DomBinding } from '../bindings/dom/DomBinding.js' // eslint-disable-line
import { Y } from '../utils/Y.js' // eslint-disable-line

/**
 * You can manage binding to a custom type with YXmlHook.
 *
 * @public
 */
export class YXmlHook extends YMap {
  /**
   * @param {String} hookName nodeName of the Dom Node.
   */
  constructor (hookName) {
    super()
    this.hookName = null
    if (hookName !== undefined) {
      this.hookName = hookName
    }
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @private
   */
  _copy () {
    const struct = super._copy()
    struct.hookName = this.hookName
    return struct
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object.<string, any>} [hooks] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks = {}, binding) {
    const hook = hooks[this.hookName]
    let dom
    if (hook !== undefined) {
      dom = hook.createDom(this)
    } else {
      dom = document.createElement(this.hookName)
    }
    dom.setAttribute('data-yjs-hook', this.hookName)
    createAssociation(binding, dom, this)
    return dom
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {decoding.Decoder} decoder The decoder object to read data from.
   *
   * @private
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.hookName = decoding.readVarString(decoder)
    return missing
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   *
   * @private
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoding.writeVarString(encoder, this.hookName)
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   *
   * @private
   */
  _integrate (y) {
    if (this.hookName === null) {
      throw new Error('hookName must be defined!')
    }
    super._integrate(y)
  }
}
