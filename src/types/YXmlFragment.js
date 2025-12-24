/**
 * @module YXml
 */

import {
  AbstractType,
  typeListMap,
  typeListForEach,
  typeListInsertGenerics,
  typeListInsertGenericsAfter,
  typeListDelete,
  typeListToArray,
  YXmlFragmentRefID,
  transact,
  typeListGet,
  typeListSlice,
  warnPrematureAccess,
  YXmlElement, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Doc, Transaction, Item, YXmlText, YXmlHook // eslint-disable-line
} from '../internals.js'

import * as delta from 'lib0/delta' // eslint-disable-line
import * as error from 'lib0/error'

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
 * Dom filter function.
 *
 * @callback domFilter
 * @param {string} nodeName The nodeName of the element
 * @param {Map} attributes The map of attributes.
 * @return {boolean} Whether to include the Dom node in the YXmlElement.
 */

/**
 * Represents a list of {@link YXmlElement}.and {@link YXmlText} types.
 * A YxmlFragment is similar to a {@link YXmlElement}, but it does not have a
 * nodeName and it does not have attributes. Though it can be bound to a DOM
 * element - in this case the attributes and the nodeName are not shared.
 *
 * @public
 * @template {any} [Children=any]
 * @template {{[K in string]:any}} [Attrs={}]
 * @extends AbstractType<delta.Delta<any,Attrs,Children,any>>
 */
export class YXmlFragment extends AbstractType {
  constructor () {
    super()
    /**
     * @todo remove _prelimContent
     * @type {Array<any>|null}
     */
    this._prelimContent = []
  }

  /**
   * @type {YXmlElement|YXmlText|null}
   */
  get firstChild () {
    const first = this._first
    return first ? first.content.getContent()[0] : null
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Doc} y The Yjs instance
   * @param {Item?} item
   */
  _integrate (y, item) {
    super._integrate(y, item)
    if (!this._prelimContent) {
      throw Error('YArray was already added to a document')
    }
    this.insert(0, /** @type {Array<any>} */ (this._prelimContent))
    this._prelimContent = null
  }

  /**
   * Makes a copy of this data type that can be included somewhere else.
   *
   * Note that the content is only readable _after_ it has been included somewhere in the Ydoc.
   *
   * @return {this}
   */
  clone () {
    const el = this._copy()
    el.insert(0, this.toArray().map(item => item instanceof AbstractType ? item.clone() : item))
    return el
  }

  get length () {
    this.doc ?? warnPrematureAccess()
    return this._prelimContent === null ? this._length : this._prelimContent.length
  }

  /**
   * Get the string representation of all the children of this YXmlFragment.
   *
   * @return {string} The string representation of all children.
   */
  toString () {
    return typeListMap(this, xml => xml.toString()).join('')
  }

  /**
   * @return {string}
   */
  toJSON () {
    return this.toString()
  }

  /**
   * Inserts new content at an index.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  xml.insert(0, [new Y.XmlText('text')])
   *
   * @param {number} index The index to insert content at
   * @param {Array<YXmlElement|YXmlText|YXmlHook>} content The array of content
   */
  insert (index, content) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeListInsertGenerics(transaction, this, index, content)
      })
    } else {
      // @ts-ignore _prelimContent is defined because this is not yet integrated
      this._prelimContent.splice(index, 0, ...content)
    }
  }

  /**
   * Inserts new content at an index.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  xml.insert(0, [new Y.XmlText('text')])
   *
   * @param {null|Item|YXmlElement|YXmlText} ref The index to insert content at
   * @param {Array<YXmlElement|YXmlText>} content The array of content
   */
  insertAfter (ref, content) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        const refItem = (ref && ref instanceof AbstractType) ? ref._item : ref
        typeListInsertGenericsAfter(transaction, this, refItem, content)
      })
    } else {
      const pc = /** @type {Array<any>} */ (this._prelimContent)
      const index = ref === null ? 0 : pc.findIndex(el => el === ref) + 1
      if (index === 0 && ref !== null) {
        throw error.create('Reference item not found')
      }
      pc.splice(index, 0, ...content)
    }
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {number} index Index at which to start deleting elements
   * @param {number} [length=1] The number of elements to remove. Defaults to 1.
   */
  delete (index, length = 1) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeListDelete(transaction, this, index, length)
      })
    } else {
      // @ts-ignore _prelimContent is defined because this is not yet integrated
      this._prelimContent.splice(index, length)
    }
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @return {Array<YXmlElement|YXmlText|YXmlHook>}
   */
  toArray () {
    return typeListToArray(this)
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array<YXmlElement|YXmlText>} content Array of content to append.
   */
  push (content) {
    this.insert(this.length, content)
  }

  /**
   * Prepends content to this YArray.
   *
   * @param {Array<YXmlElement|YXmlText>} content Array of content to prepend.
   */
  unshift (content) {
    this.insert(0, content)
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {number} index The index of the element to return from the YArray
   * @return {YXmlElement|YXmlText}
   */
  get (index) {
    return typeListGet(this, index)
  }

  /**
   * Returns a portion of this YXmlFragment into a JavaScript Array selected
   * from start to end (end not included).
   *
   * @param {number} [start]
   * @param {number} [end]
   * @return {Array<YXmlElement|YXmlText>}
   */
  slice (start = 0, end = this.length) {
    return typeListSlice(this, start, end)
  }

  /**
   * Executes a provided function on once on every child element.
   *
   * @param {function(YXmlElement|YXmlText,number, typeof self):void} f A function to execute on every element of this YArray.
   */
  forEach (f) {
    typeListForEach(this, f)
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
   */
  _write (encoder) {
    encoder.writeTypeRef(YXmlFragmentRefID)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
 * @return {import('../utils/types.js').YType}
 *
 * @private
 * @function
 */
export const readYXmlFragment = _decoder => new YXmlFragment()
