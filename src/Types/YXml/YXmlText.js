import YText from '../YText/YText.js'
import { createAssociation } from '../../Bindings/DomBinding/util.js'

/**
 * Represents text in a Dom Element. In the future this type will also handle
 * simple formatting information like bold and italic.
 *
 * @param {String} arg1 Initial value.
 */
export default class YXmlText extends YText {
  /**
   * Creates a Dom Element that mirrors this YXmlText.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<key:hookDefinition>} [hooks] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type.
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks, binding) {
    const dom = _document.createTextNode(this.toString())
    createAssociation(binding, dom, this)
    return dom
  }

  /**
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   *
   * @private
   */
  _delete (y, createDelete, gcChildren) {
    super._delete(y, createDelete, gcChildren)
  }
}
