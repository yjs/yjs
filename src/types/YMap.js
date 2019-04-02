/**
 * @module types
 */

import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line
import { AbstractType, typeMapDelete, typeMapSet, typeMapGet, typeMapHas, createMapIterator } from './AbstractType.js'
import { ItemType } from '../structs/ItemType.js' // eslint-disable-line
import { YEvent } from '../utils/YEvent.js'
import * as decoding from 'lib0/decoding.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import * as iterator from 'lib0/iterator.js'

/**
 * Event that describes the changes on a YMap.
 */
export class YMapEvent extends YEvent {
  /**
   * @param {YMap} ymap The YArray that changed.
   * @param {Set<any>} subs The keys that changed.
   */
  constructor (ymap, subs) {
    super(ymap)
    this.keysChanged = subs
  }
}

/**
 * A shared Map implementation.
 */
export class YMap extends AbstractType {
  constructor () {
    super()
    /**
     * @type {Map<string,any>?}
     */
    this._prelimContent = new Map()
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
    for (let [key, value] of this._prelimContent) {
      this.set(key, value)
    }
    this._prelimContent = null
  }
  /**
   * Creates YMapEvent and calls observers.
   * @private
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    this._callEventHandler(transaction, new YMapEvent(this, parentSubs))
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Object<string,number|string|Object|Array|ArrayBuffer>}
   */
  toJSON () {
    /**
     * @type {Object<string,number|string|Object|Array|ArrayBuffer>}
     */
    const map = {}
    for (let [key, item] of this._map) {
      if (!item.deleted) {
        map[key] = item.getContent()[0]
      }
    }
    return map
  }

  /**
   * Returns the keys for each element in the YMap Type.
   *
   * @return {Iterator<string>}
   */
  keys () {
    return iterator.iteratorMap(createMapIterator(this._map), v => v[0])
  }
  /**
   * Returns the value for each element in the YMap Type.
   *
   * @return {Iterator<string|number|ArrayBuffer|Object<string,any>|Array<any>>}
   */
  entries () {
    return iterator.iteratorMap(createMapIterator(this._map), v => v[1].getContent()[0])
  }

  [Symbol.iterator] () {
    return this.entries()
  }

  /**
   * Remove a specified element from this YMap.
   *
   * @param {string} key The key of the element to remove.
   */
  delete (key) {
    if (this._y !== null) {
      this._y.transact(transaction => {
        typeMapDelete(transaction, this, key)
      })
    } else {
      // @ts-ignore
      this._prelimContent.delete(key)
    }
  }

  /**
   * Adds or updates an element with a specified key and value.
   *
   * @param {string} key The key of the element to add to this YMap
   * @param {Object | string | number | AbstractType | ArrayBuffer } value The value of the element to add
   */
  set (key, value) {
    if (this._y !== null) {
      this._y.transact(transaction => {
        typeMapSet(transaction, this, key, value)
      })
    } else {
      // @ts-ignore
      this._prelimContent.set(key, value)
    }
    return value
  }

  /**
   * Returns a specified element from this YMap.
   *
   * @param {string} key
   * @return {Object<string,any>|number|Array<any>|string|ArrayBuffer|AbstractType|undefined}
   */
  get (key) {
    return typeMapGet(this, key)
  }

  /**
   * Returns a boolean indicating whether the specified key exists or not.
   *
   * @param {string} key The key to test.
   * @return {boolean}
   */
  has (key) {
    return typeMapHas(this, key)
  }
}

/**
 * @param {decoding.Decoder} decoder
 */
export const readYMap = decoder => new YMap()
