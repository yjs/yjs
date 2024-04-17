/**
 * @module YArray
 */

import {
  YEvent,
  AbstractType,
  typeListGet,
  typeListToArray,
  typeListForEach,
  typeListCreateIterator,
  typeListInsertGenerics,
  typeListDelete,
  typeListMap,
  YArrayRefID,
  callTypeObservers,
  transact,
  Doc, Transaction, Item // eslint-disable-line
} from '../internals.js'

import * as decoding from 'lib0/decoding.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js'

/**
 * Event that describes the changes on a YArray
 * @template T
 */
export class YArrayEvent extends YEvent {
  /**
   * @param {YArray<T>} yarray The changed type
   * @param {Transaction} transaction The transaction object
   */
  constructor (yarray, transaction) {
    super(yarray, transaction)
    this._transaction = transaction
  }
}

/**
 * A shared Array implementation.
 * @template T
 * @extends AbstractType<YArrayEvent<T>>
 * @implements {Iterable<T>}
 */
export class YArray extends AbstractType {
  constructor () {
    super()
    /**
     * @type {Array<any>?}
     * @private
     */
    this._prelimContent = []
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Doc} y The Yjs instance
   * @param {Item} item
   */
  _integrate (y, item) {
    super._integrate(y, item)
    this.insert(0, /** @type {Array<any>} */ (this._prelimContent))
    this._prelimContent = null
  }

  _copy () {
    return new YArray()
  }

  get length () {
    return this._prelimContent === null ? this._length : this._prelimContent.length
  }

  /**
   * Creates YArrayEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    callTypeObservers(this, transaction, new YArrayEvent(this, transaction))
  }

  /**
   * Inserts new content at an index.
   *
   * Important: This function expects an array of content. Not just a content
   * object. The reason for this "weirdness" is that inserting several elements
   * is very efficient when it is done as a single operation.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  yarray.insert(0, ['a'])
   *  // Insert numbers 1, 2 at position 1
   *  yarray.insert(1, [1, 2])
   *
   * @param {number} index The index to insert content at.
   * @param {Array<T>} content The array of content
   * @return {YArray<T>} Instance of the YArray
   */
  insert (index, content) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeListInsertGenerics(transaction, this, index, content)
      })
    } else {
      /** @type {Array<any>} */ (this._prelimContent).splice(index, 0, ...content)
    }
    return this
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array<T>} content Array of content to append.
   * @return {YArray<T>} Instance of the YArray
   */
  push (content) {
    return this.insert(this.length, content)
  }

  /**
   * Preppends content to this YArray.
   *
   * @param {Array<T>} content Array of content to preppend.
   * @return {YArray<T>} Instance of the YArray
   */
  unshift (content) {
    return this.insert(0, content)
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {number} index Index at which to start deleting elements
   * @param {number} length The number of elements to remove. Defaults to 1.
   * @return {YArray<T>} Instance of the YArray
   */
  delete (index, length = 1) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeListDelete(transaction, this, index, length)
      })
    } else {
      /** @type {Array<any>} */ (this._prelimContent).splice(index, length)
    }
    return this
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {number} index The index of the element to return from the YArray
   * @return {T}
   */
  get (index) {
    return typeListGet(this, index)
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @return {Array<T>}
   */
  toArray () {
    return typeListToArray(this)
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Array<any>}
   */
  toJSON () {
    return this.map(c => c instanceof AbstractType ? c.toJSON() : c)
  }

  /**
   * Returns an Array with the result of calling a provided function on every
   * element of this YArray.
   *
   * @template T,M
   * @param {function(T,number,YArray<T>):M} f Function that produces an element of the new Array
   * @return {Array<M>} A new array with each element being the result of the
   *                 callback function
   */
  map (f) {
    return typeListMap(this, /** @type {any} */ (f))
  }

  /**
   * Executes a provided function on once on overy element of this YArray.
   *
   * @param {function(T,number,YArray<T>):void} f A function to execute on every element of this YArray.
   */
  forEach (f) {
    typeListForEach(this, f)
  }

  /**
   * @return {IterableIterator<T>}
   */
  [Symbol.iterator] () {
    return typeListCreateIterator(this)
  }

  /**
   * @param {encoding.Encoder} encoder
   */
  _write (encoder) {
    encoding.writeVarUint(encoder, YArrayRefID)
  }
}

/**
 * @param {decoding.Decoder} decoder
 *
 * @private
 * @function
 */
export const readYArray = decoder => new YArray()
