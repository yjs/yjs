
import {
  YXmlFragment,
  transact,
  typeMapDelete,
  typeMapSet,
  typeMapGet,
  typeMapGetAll,
  typeArrayForEach,
  YXmlElementRefID,
  Snapshot, Y, ItemType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

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
    /**
     * @type {Map<string, any>|null}
     * @private
     */
    this._prelimAttrs = new Map()
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   * @param {ItemType} item
   * @private
   */
  _integrate (y, item) {
    super._integrate(y, item)
    // @ts-ignore
    this.insert(0, this._prelimContent)
    this._prelimContent = null
    // @ts-ignore
    this._prelimAttrs.forEach((value, key) => {
      this.setAttribute(key, value)
    })
    this._prelimContent = null
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @return {YXmlElement}
   * @private
   */
  _copy () {
    return new YXmlElement(this.nodeName)
  }

  /**
   * Returns the XML serialization of this YXmlElement.
   * The attributes are ordered by attribute-name, so you can easily use this
   * method to compare YXmlElements
   *
   * @return {string} The string representation of this type.
   *
   * @public
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
   *
   * @public
   */
  removeAttribute (attributeName) {
    if (this._y !== null) {
      transact(this._y, transaction => {
        typeMapDelete(transaction, this, attributeName)
      })
    } else {
      // @ts-ignore
      this._prelimAttrs.delete(attributeName)
    }
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
    if (this._y !== null) {
      transact(this._y, transaction => {
        typeMapSet(transaction, this, attributeName, attributeValue)
      })
    } else {
      // @ts-ignore
      this._prelimAttrs.set(attributeName, attributeValue)
    }
  }

  /**
   * Returns an attribute value that belongs to the attribute name.
   *
   * @param {String} attributeName The attribute name that identifies the
   *                               queried value.
   * @return {String} The queried attribute value.
   *
   * @public
   */
  getAttribute (attributeName) {
    // @ts-ignore
    return typeMapGet(this, attributeName)
  }

  /**
   * Returns all attribute name/value pairs in a JSON Object.
   *
   * @param {Snapshot} [snapshot]
   * @return {Object} A JSON Object that describes the attributes.
   *
   * @public
   */
  getAttributes (snapshot) {
    return typeMapGetAll(this)
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<string, any>} [hooks={}] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {any} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type.
   * @return {Node} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDOM (_document = document, hooks = {}, binding) {
    const dom = _document.createElement(this.nodeName)
    let attrs = this.getAttributes()
    for (let key in attrs) {
      dom.setAttribute(key, attrs[key])
    }
    typeArrayForEach(this, yxml => {
      dom.appendChild(yxml.toDOM(_document, hooks, binding))
    })
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
   * @private
   * @param {encoding.Encoder} encoder The encoder to write data to.
   */
  _write (encoder) {
    encoding.writeVarUint(encoder, YXmlElementRefID)
    encoding.writeVarString(encoder, this.nodeName)
  }
}

/**
 * @param {decoding.Decoder} decoder
 * @return {YXmlElement}
 *
 * @private
 * @function
 */
export const readYXmlElement = decoder => new YXmlElement(decoding.readVarString(decoder))
