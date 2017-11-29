// import diff from 'fast-diff'
import { defaultDomFilter } from './utils.js'

import YMap from '../YMap.js'
import { YXmlFragment } from './y-xml.js'

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
  _copy (undeleteChildren) {
    let struct = super._copy(undeleteChildren)
    struct.nodeName = this.nodeName
    return struct
  }
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
        attributes.set(attr.name, attr.value)
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
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder)
    this.nodeName = decoder.readVarString()
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder)
    encoder.writeVarString(this.nodeName)
  }
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
   * Returns the string representation of the XML document.
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
  removeAttribute () {
    return YMap.prototype.delete.apply(this, arguments)
  }

  setAttribute () {
    return YMap.prototype.set.apply(this, arguments)
  }

  getAttribute () {
    return YMap.prototype.get.apply(this, arguments)
  }

  getAttributes () {
    const obj = {}
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        obj[key] = value._content[0]
      }
    }
    return obj
  }
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
