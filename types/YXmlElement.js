/**
 * @module types
 */

import { YMap } from './YMap.js'
import { createAssociation } from '../bindings/dom/util.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { DomBinding } from '../bindings/dom/DomBinding.js' // eslint-disable-line
import { YXmlTreeWalker } from './YXmlTreeWalker.js'
import { YArray } from './YArray.js'
import { YXmlEvent } from './YXmlEvent.js'
import * as stringify from '../utils/structStringify.js'

/**
 * Dom filter function.
 *
 * @callback domFilter
 * @param {string} nodeName The nodeName of the element
 * @param {Map} attributes The map of attributes.
 * @return {boolean} Whether to include the Dom node in the YXmlElement.
 */

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
 *//**
 * @module types
 */

/**
 * Represents a list of {@link YXmlElement}.and {@link YXmlText} types.
 * A YxmlFragment is similar to a {@link YXmlElement}, but it does not have a
 * nodeName and it does not have attributes. Though it can be bound to a DOM
 * element - in this case the attributes and the nodeName are not shared.
 *
 * @public
 */
export class YXmlFragment extends YArray {
  /**
   * Create a subtree of childNodes.
   *
   * @example
   * const walker = elem.createTreeWalker(dom => dom.nodeName === 'div')
   * for (let node in walker) {
   *   // `node` is a div node
   *   nop(node)
   * }
   *
   * @param {Function} filter Function that is called on each child element and
   *                          returns a Boolean indicating whether the child
   *                          is to be included in the subtree.
   * @return {YXmlTreeWalker} A subtree and a position within it.
   *
   * @public
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
   * @return {YXmlElement} The first element that matches the query or null.
   *
   * @public
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
   *
   * @public
   */
  querySelectorAll (query) {
    query = query.toUpperCase()
    return Array.from(new YXmlTreeWalker(this, element => element.nodeName === query))
  }

  /**
   * Creates YArray Event and calls observers.
   *
   * @private
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YXmlEvent(this, parentSubs, remote, transaction))
  }

  toString () {
    return this.toDomString()
  }

  /**
   * Get the string representation of all the children of this YXmlFragment.
   *
   * @return {string} The string representation of all children.
   */
  toDomString () {
    return this.map(xml => xml.toDomString()).join('')
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object.<string, any>} [hooks={}] Optional property to customize how hooks
   *                                             are presented in the // TODO: include all tests

   * @param {DomBinding} [binding] You should not set this property. T// TODO: include all tests

   *                               used if DomBinding wants to create // TODO: include all tests

   *                               association to the created DOM type// TODO: include all tests

   * @return {DocumentFragment} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks = {}, binding) {
    const fragment = _document.createDocumentFragment()
    createAssociation(binding, fragment, this)
    this.forEach(xmlType => {
      fragment.insertBefore(xmlType.toDom(_document, hooks, binding), null)
    })
    return fragment
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return stringify.logItemHelper('YXml', this)
  }
}

/**
 * An YXmlElement imitates the behavior of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}.
 *
 * * An YXmlElement has attributes (key value pairs)
 * * An YXmlElement has childElements that must inherit from YXmlElement
 */
export class YXmlElement extends YXmlFragment {
  constructor (nodeName = 'UNDEFINED') {
    super()
    this.nodeName = nodeName.toUpperCase()
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @private
   */
  _copy () {
    let struct = super._copy()
    struct.nodeName = this.nodeName
    return struct
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @private
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {decoding.Decoder} decoder The decoder object to read data from.
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.nodeName = decoding.readVarString(decoder)
    return missing
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @private
   * @param {encoding.Encoder} encoder The encoder to write data to.
   */
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoding.writeVarString(encoder, this.nodeName)
  }

  /**
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In case of
   * Item it connects _left and _right to this Item and calls the
   * {@link Item#beforeChange} method.
   *
   * * Checks for nodeName
   * * Sets domFilter
   *
   * @private
   * @param {Y} y The Yjs instance
   */
  _integrate (y) {
    if (this.nodeName === null) {
      throw new Error('nodeName must be defined!')
    }
    super._integrate(y)
  }

  toString () {
    return this.toDomString()
  }

  /**
   * Returns the string representation of this YXmlElement.
   * The attributes are ordered by attribute-name, so you can easily use this
   * method to compare YXmlElements
   *
   * @return {String} The string representation of this type.
   *
   * @public
   */
  toDomString () {
    const attrs = this.getAttributes()
    const stringBuilder = []
    const keys = []
    for (let key in attrs) {
      keys.push(key)
    }
    keys.sort()
    const keysLen = keys.length
    for (let i = 0; i < keysLen; i++) {
      const key = keys[i]
      stringBuilder.push(key + '="' + attrs[key] + '"')
    }
    const nodeName = this.nodeName.toLocaleLowerCase()
    const attrsString = stringBuilder.length > 0 ? ' ' + stringBuilder.join(' ') : ''
    return `<${nodeName}${attrsString}>${super.toDomString()}</${nodeName}>`
  }

  /**
   * Removes an attribute from this YXmlElement.
   *
   * @param {String} attributeName The attribute name that is to be removed.
   *
   * @public
   */
  removeAttribute (attributeName) {
    return YMap.prototype.delete.call(this, attributeName)
  }

  /**
   * Sets or updates an attribute.
   *
   * @param {String} attributeName The attribute name that is to be set.
   * @param {String} attributeValue The attribute value that is to be set.
   *
   * @public
   */
  setAttribute (attributeName, attributeValue) {
    return YMap.prototype.set.call(this, attributeName, attributeValue)
  }

  /**
   * Returns an attribute value that belongs to the attribute name.
   *
   * @param {String} attributeName The attribute name that identifies the
   *                               queried value.
   * @param {import('../protocols/history.js').HistorySnapshot} [snapshot]
   * @return {String} The queried attribute value.
   *
   * @public
   */
  getAttribute (attributeName, snapshot) {
    return YMap.prototype.get.call(this, attributeName, snapshot)
  }

  /**
   * Returns all attribute name/value pairs in a JSON Object.
   *
   * @param {import('../protocols/history.js').HistorySnapshot} [snapshot]
   * @return {Object} A JSON Object that describes the attributes.
   *
   * @public
   */
  getAttributes (snapshot) {
    const obj = {}
    if (snapshot === undefined) {
      for (let [key, value] of this._map) {
        if (!value._deleted) {
          obj[key] = value._content[0]
        }
      }
    } else {
      YMap.prototype.keys.call(this, snapshot).forEach(key => {
        obj[key] = YMap.prototype.get.call(this, key, snapshot)
      })
    }
    return obj
  }
  // TODO: outsource the binding property.
  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<string, any>} [hooks={}] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type.
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks = {}, binding) {
    const dom = _document.createElement(this.nodeName)
    let attrs = this.getAttributes()
    for (let key in attrs) {
      dom.setAttribute(key, attrs[key])
    }
    this.forEach(yxml => {
      dom.appendChild(yxml.toDom(_document, hooks, binding))
    })
    createAssociation(binding, dom, this)
    return dom
  }
}
