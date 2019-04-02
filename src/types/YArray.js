/**
 * @module types
 */

import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line
import { ItemType } from '../structs/ItemType.js' // eslint-disable-line
import { AbstractType, typeArrayGet, typeArrayToArray, typeArrayForEach, typeArrayCreateIterator, typeArrayInsertGenerics, typeArrayDelete, typeArrayMap } from './AbstractType.js'
import { YEvent } from '../utils/YEvent.js'
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import * as decoding from 'lib0/decoding.js' // eslint-disable-line

/**
 * Event that describes the changes on a YArray
 */
export class YArrayEvent extends YEvent {
  /**
   * @param {AbstractType} yarray The changed type
   * @param {Transaction} transaction The transaction object
   */
  constructor (yarray, transaction) {
    super(yarray)
    this._transaction = transaction
    this._addedElements = null
    this._removedElements = null
  }

  /**
   * Child elements that were added in this transaction.
   *
   * @return {Set<AbstractItem>}
   */
  get addedElements () {
    if (this._addedElements === null) {
      const target = this.target
      const transaction = this._transaction
      const addedElements = new Set()
      transaction.added.forEach(type => {
        if (type.parent === target && !transaction.deleted.has(type)) {
          addedElements.add(type)
        }
      })
      this._addedElements = addedElements
    }
    return this._addedElements
  }

  /**
   * Child elements that were removed in this transaction.
   *
   * @return {Set<AbstractItem>}
   */
  get removedElements () {
    if (this._removedElements === null) {
      const target = this.target
      const transaction = this._transaction
      const removedElements = new Set()
      transaction.deleted.forEach(struct => {
        if (struct.parent === target && !transaction.added.has(struct)) {
          removedElements.add(struct)
        }
      })
      this._removedElements = removedElements
    }
    return this._removedElements
  }
}

/**
 * A shared Array implementation.
 * @template T
 */
export class YArray extends AbstractType {
  constructor () {
    super()
    /**
     * @type {Array<any>?}
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
   * @param {Transaction} transaction The Yjs instance
   * @param {ItemType} item
   * @private
   */
  _integrate (transaction, item) {
    super._integrate(transaction, item)
    // @ts-ignore
    this.insert(0, this._prelimContent)
    this._prelimContent = null
  }
  get length () {
    return this._prelimContent === null ? this._length : this._prelimContent.length
  }
  /**
   * Creates YArrayEvent and calls observers.
   * @private
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    this._callEventHandler(transaction, new YArrayEvent(this, transaction))
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {number} index The index of the element to return from the YArray
   * @return {T}
   */
  get (index) {
    return typeArrayGet(this, index)
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @return {Array<T>}
   */
  toArray () {
    return typeArrayToArray(this)
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
    // @ts-ignore
    return typeArrayMap(this, f)
  }

  /**
   * Executes a provided function on once on overy element of this YArray.
   *
   * @param {function(T,number):void} f A function to execute on every element of this YArray.
   */
  forEach (f) {
    typeArrayForEach(this, f)
  }

  [Symbol.iterator] () {
    return typeArrayCreateIterator(this)
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {number} index Index at which to start deleting elements
   * @param {number} length The number of elements to remove. Defaults to 1.
   */
  delete (index, length = 1) {
    if (this._y !== null) {
      this._y.transact(transaction => {
        typeArrayDelete(transaction, this, index, length)
      })
    } else {
      // @ts-ignore _prelimContent is defined because this is not yet integrated
      this._prelimContent.splice(index, length)
    }
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
   *  yarray.insert(2, [1, 2])
   *
   * @param {number} index The index to insert content at.
   * @param {Array<number|string|ArrayBuffer|AbstractType>} content The array of content
   */
  insert (index, content) {
    if (this._y !== null) {
      this._y.transact(transaction => {
        typeArrayInsertGenerics(transaction, this, index, content)
      })
    } else {
      // @ts-ignore _prelimContent is defined because this is not yet integrated
      this._prelimContent.splice(index, 0, ...content)
    }
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array<number|string|ArrayBuffer|AbstractType>} content Array of content to append.
   */
  push (content) {
    this.insert(this.length, content)
  }
}

/**
 * @param {decoding.Decoder} decoder
 */
export const readYArray = decoder => new YArray()
