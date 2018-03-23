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
   * Creates a TextNode with the same textual content.
   *
   * @return TextNode
   */
  toDom (_document = document, binding) {
    const dom = _document.createTextNode(this.toString())
    createAssociation(binding, dom, this)
    return dom
  }

  /**
   * @private
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   */
  _delete (y, createDelete) {
    super._delete(y, createDelete)
  }
}
