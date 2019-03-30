/**
 * @module types
 */

import { YText } from './YText.js'
import * as decoding from 'lib0/decoding.js' // eslint-disable-line

/**
 * Represents text in a Dom Element. In the future this type will also handle
 * simple formatting information like bold and italic.
 */
export class YXmlText extends YText {
  /**
   * Creates a Dom Element that mirrors this YXmlText.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<string, any>} [hooks] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {any} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type.
   * @return {Text} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks, binding) {
    const dom = _document.createTextNode(this.toString())
    if (binding !== undefined) {
      binding._createAssociation(dom, this)
    }
    return dom
  }
}

/**
 * @param {decoding.Decoder} decoder
 * @return {YXmlText}
 */
export const readYXmlText = decoder => new YXmlText()
