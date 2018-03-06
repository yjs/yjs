import { defaultDomFilter } from './utils.js'

import YMap from '../YMap/YMap.js'
import { YXmlFragment } from './YXml.js'

/**
 * An YXmlElement imitates the behavior of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}.
 *
 * * An YXmlElement has attributes (key value pairs)
 * * An YXmlElement has childElements that must inherit from YXmlElement
 *
 * @param {String} arg1 Node name
 * @param {Function} arg2 Dom filter
 */
export default class YXmlElement extends YXmlFragment {
  constructor (arg1, arg2, _document) {
    super()
    this.nodeName = null
    this._scrollElement = null
    if (typeof arg1 === 'string') {
      this.nodeName = arg1.toUpperCase()
    } else if (arg1 != null && arg1.nodeType != null && arg1.nodeType === arg1.ELEMENT_NODE) {
      this.nodeName = arg1.nodeName
      this._setDom(arg1, _document)
    } else {
      this.nodeName = 'UNDEFINED'
    }
    if (typeof arg2 === 'function') {
      this._domFilter = arg2
    }
  }

  /**
   * @private
   * Creates an Item with the same effect as this Item (without position effect)
   */
  _copy () {
    let struct = super._copy()
    struct.nodeName = this.nodeName
    return struct
  }

  /**
   * @private
   * Copies children and attributes from a dom node to this YXmlElement.
   */
  _setDom (dom, _document) {
    if (this._dom != null) {
      throw new Error('Only call this method if you know what you are doing ;)')
    } else if (dom._yxml != null) { // TODO do i need to check this? - no.. but for dev purps..
      throw new Error('Already bound to an YXml type')
    } else {
      // tag is already set in constructor
      // set attributes
      let attributes = new Map()
      for (let i = 0; i < dom.attributes.length; i++) {
        let attr = dom.attributes[i]
        // get attribute via getAttribute for custom element support (some write something different in attr.value)
        attributes.set(attr.name, dom.getAttribute(attr.name))
      }
      attributes = this._domFilter(dom, attributes)
      attributes.forEach((value, name) => {
        this.setAttribute(name, value)
      })
      this.insertDomElements(0, Array.prototype.slice.call(dom.childNodes), _document)
      this._bindToDom(dom, _document)
      return dom
    }
  }

  /**
   * @private
   * Bind a dom to to this YXmlElement. This means that the DOM changes when the
   * YXmlElement is modified and that this YXmlElement changes when the DOM is
   * modified.
   *
   * Currently only works in YXmlFragment.
   */
  _bindToDom (dom, _document) {
    _document = _document || document
    this._dom = dom
    dom._yxml = this
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
    this.nodeName = decoder.readVarString()
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
    encoder.writeVarString(this.nodeName)
  }

  /**
   * @private
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In case of
   * Item it connects _left and _right to this Item and calls the
   * {@link Item#beforeChange} method.
   *
   * * Checks for nodeName
   * * Sets domFilter
   */
  _integrate (y) {
    if (this.nodeName === null) {
      throw new Error('nodeName must be defined!')
    }
    if (this._domFilter === defaultDomFilter && this._parent._domFilter !== undefined) {
      this._domFilter = this._parent._domFilter
    }
    super._integrate(y)
  }

  /**
   * Returns the string representation of this YXmlElement.
   * The attributes are ordered by attribute-name, so you can easily use this
   * method to compare YXmlElements
   */
  toString () {
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
    return `<${nodeName}${attrsString}>${super.toString()}</${nodeName}>`
  }

  /**
   * Removes an attribute from this YXmlElement.
   *
   * @param {String} attributeName The attribute name that is to be removed.
   */
  removeAttribute (attributeName) {
    return YMap.prototype.delete.call(this, attributeName)
  }

  /**
   * Sets or updates an attribute.
   *
   * @param {String} attributeName The attribute name that is to be set.
   * @param {String} attributeValue The attribute value that is to be set.
   */
  setAttribute (attributeName, attributeValue) {
    return YMap.prototype.set.call(this, attributeName, attributeValue)
  }

  /**
   * Returns an attribute value that belongs to the attribute name.
   *
   * @param {String} attributeName The attribute name that identifies the
   *                               queried value.
   * @return {String} The queried attribute value
   */
  getAttribute (attributeName) {
    return YMap.prototype.get.call(this, attributeName)
  }

  /**
   * Returns all attribute name/value pairs in a JSON Object.
   *
   * @return {Object} A JSON Object that describes the attributes.
   */
  getAttributes () {
    const obj = {}
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        obj[key] = value._content[0]
      }
    }
    return obj
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   */
  getDom (_document) {
    _document = _document || document
    let dom = this._dom
    if (dom == null) {
      dom = _document.createElement(this.nodeName)
      dom._yxml = this
      let attrs = this.getAttributes()
      for (let key in attrs) {
        dom.setAttribute(key, attrs[key])
      }
      this.forEach(yxml => {
        dom.appendChild(yxml.getDom(_document))
      })
      this._bindToDom(dom, _document)
    }
    return dom
  }
}
