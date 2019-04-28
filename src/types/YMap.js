
/**
 * @module YMap
 */

import {
  YEvent,
  AbstractType,
  typeMapDelete,
  typeMapSet,
  typeMapGet,
  typeMapHas,
  createMapIterator,
  YMapRefID,
  callTypeObservers,
  transact,
  Y, Transaction, ItemType, // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js' // eslint-disable-line
import * as iterator from 'lib0/iterator.js'

/**
 * @template T
 * Event that describes the changes on a YMap.
 */
export class YMapEvent extends YEvent {
  /**
   * @param {YMap<T>} ymap The YArray that changed.
   * @param {Transaction} transaction
   * @param {Set<any>} subs The keys that changed.
   */
  constructor (ymap, transaction, subs) {
    super(ymap, transaction)
    this.keysChanged = subs
  }
}

/**
 * @template T number|string|Object|Array|ArrayBuffer
 * A shared Map implementation.
 *
 * @extends AbstractType<YMapEvent<T>>
 * @implements {IterableIterator}
 */
export class YMap extends AbstractType {
  constructor () {
    super()
    /**
     * @type {Map<string,any>?}
     * @private
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
   * @param {Y} y The Yjs instance
   * @param {ItemType} item
   *
   * @private
   */
  _integrate (y, item) {
    super._integrate(y, item)
    // @ts-ignore
    for (let [key, value] of this._prelimContent) {
      this.set(key, value)
    }
    this._prelimContent = null
  }
  /**
   * Creates YMapEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   *
   * @private
   */
  _callObserver (transaction, parentSubs) {
    callTypeObservers(this, transaction, new YMapEvent(this, transaction, parentSubs))
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Object<string,T>}
   */
  toJSON () {
    /**
     * @type {Object<string,T>}
     */
    const map = {}
    for (let [key, item] of this._map) {
      if (!item.deleted) {
        const v = item.getContent()[0]
        map[key] = v instanceof AbstractType ? v.toJSON() : v
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
    return iterator.iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[0])
  }

  /**
   * Returns the keys for each element in the YMap Type.
   *
   * @return {Iterator<string>}
   */
  values () {
    return iterator.iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[1].getContent()[v[1].length - 1])
  }

  /**
   * Returns an Iterator of [key, value] pairs
   *
   * @return {IterableIterator<any>}
   */
  entries () {
    return iterator.iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => [v[0], v[1].getContent()[v[1].length - 1]])
  }

  /**
   * @return {IterableIterator<T>}
   */
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
      transact(this._y, transaction => {
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
   * @param {T} value The value of the element to add
   */
  set (key, value) {
    if (this._y !== null) {
      transact(this._y, transaction => {
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
   * @return {T|undefined}
   */
  get (key) {
    // @ts-ignore
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

  /**
   * @param {encoding.Encoder} encoder
   *
   * @private
   */
  _write (encoder) {
    encoding.writeVarUint(encoder, YMapRefID)
  }
}

/**
 * @param {decoding.Decoder} decoder
 *
 * @private
 * @function
 */
export const readYMap = decoder => new YMap()
