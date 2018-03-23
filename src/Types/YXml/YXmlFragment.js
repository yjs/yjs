/* global MutationObserver */

import { createAssociation } from '../../Bindings/DomBinding/util.js'
import YXmlTreeWalker from './YXmlTreeWalker.js'

import YArray from '../YArray/YArray.js'
import YXmlEvent from './YXmlEvent.js'
import { YXmlText, YXmlHook } from './YXml.js'
import { logID } from '../../MessageHandler/messageToString.js'
import diff from '../../Util/simpleDiff.js'

/**
 * Define the elements to which a set of CSS queries apply.
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors|CSS_Selectors}
 *
 * @example
 *   query = '.classSelector'
 *   query = 'nodeSelector'
 *   query = '#idSelector'
 *
 * @typedef {string} CSS_Selector
 */


/**
 * Represents a list of {@link YXmlElement}.
 * A YxmlFragment does not have a nodeName and it does not have attributes.
 * Therefore it also must not be added as a childElement.
 */
export default class YXmlFragment extends YArray {
  /**
   * Create a subtree of childNodes.
   *
   * @param {Function} filter Function that is called on each child element and
   *                          returns a Boolean indicating whether the child
   *                          is to be included in the subtree.
   * @return {TreeWalker} A subtree and a position within it.
   */
  createTreeWalker (filter) {
    return new YXmlTreeWalker(this, filter)
  }

  /**
   * Returns the first YXmlElement that matches the query.
   * Similar to DOM's {@link querySelector}.
   *
   * Query support:
   *   - tagname
   * TODO:
   *   - id
   *   - attribute
   *
   * @param {CSS_Selector} query The query on the children.
   * @return {?YXmlElement} The first element that matches the query or null.
   */
  querySelector (query) {
    query = query.toUpperCase()
    const iterator = new YXmlTreeWalker(this, element => element.nodeName === query)
    const next = iterator.next()
    if (next.done) {
      return null
    } else {
      return next.value
    }
  }

  /**
   * Returns all YXmlElements that match the query.
   * Similar to Dom's {@link querySelectorAll}.
   *
   * TODO: Does not yet support all queries. Currently only query by tagName.
   *
   * @param {CSS_Selector} query The query on the children
   * @return {Array<YXmlElement>} The elements that match this query.
   */
  querySelectorAll (query) {
    query = query.toUpperCase()
    return Array.from(new YXmlTreeWalker(this, element => element.nodeName === query))
  }

  /**
   * Dom filter function.
   *
   * @callback domFilter
   * @param {string} nodeName The nodeName of the element
   * @param {Map} attributes The map of attributes.
   * @return {boolean} Whether to include the Dom node in the YXmlElement.
   */

  /**
   * @private
   * Creates YArray Event and calls observers.
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YXmlEvent(this, parentSubs, remote, transaction))
  }

  /**
   * Get the string representation of all the children of this YXmlFragment.
   *
   * @return {string} The string representation of all children.
   */
  toString () {
    return this.map(xml => xml.toString()).join('')
  }

  /**
   * @private
   * Unbind from Dom and mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   */
  _delete (y, createDelete) {
    super._delete(y, createDelete)
  }

  /**
   * @return {DocumentFragment} The dom representation of this
   */
  toDom (_document = document, binding) {
    const fragment = _document.createDocumentFragment()
    createAssociation(binding, fragment, this)
    this.forEach(xmlType => {
      fragment.insertBefore(xmlType.toDom(_document, binding), null)
    })
    return fragment
  }
  /**
   * @private
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items implement this method.
   */
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `YXml(id:${logID(this._id)},left:${logID(left)},origin:${logID(origin)},right:${this._right},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}
