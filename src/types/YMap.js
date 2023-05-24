
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
  UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Doc, Transaction, Item // eslint-disable-line
} from '../internals.js'

import * as iterator from 'lib0/iterator'

/**
 * @template T
 * @typedef {Extract<keyof T, string>} StringKey<T>
 */

/**
 * This works around some weird JSDoc+TS circular reference issues: https://github.com/microsoft/TypeScript/issues/46369
 * @typedef {boolean|null|string|number|Uint8Array|JsonArray|JsonObject} Json
 * @typedef {Json[]} JsonArray
 * @typedef {{ [key: string]: Json }} JsonObject
 * @typedef {Json|AbstractType<any>} MapValue
 */

/**
 * @template {Record<string, MapValue>} T
 * @extends YEvent<YMap<T>>
 * Event that describes the changes on a YMap.
 */
export class YMapEvent extends YEvent {
  /**
   * @param {YMap<T>} ymap The YMap that changed.
   * @param {Transaction} transaction
   * @param {Set<any>} subs The keys that changed.
   */
  constructor (ymap, transaction, subs) {
    super(ymap, transaction)
    this.keysChanged = subs
  }
}

/**
 * @template {Record<string, MapValue>} MapType
 * A shared Map implementation.
 *
 * @extends AbstractType<YMapEvent<MapType>>
 * @implements {Iterable<MapType>}
 */
export class YMap extends AbstractType {
  /**
   *
   * @param {Iterable<readonly [string, any]>=} entries - an optional iterable to initialize the YMap
   */
  constructor (entries) {
    super()
    /**
     * @type {Map<string,any>?}
     * @private
     */
    this._prelimContent = null

    if (entries === undefined) {
      this._prelimContent = new Map()
    } else {
      this._prelimContent = new Map(entries)
    }
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
    ;/** @type {Map<string, any>} */ (this._prelimContent).forEach((value, key) => {
      // TODO: fix
      this.set(/** @type {any} */ (key), value)
    })
    this._prelimContent = null
  }

  /**
   * @return {YMap<MapType>}
   */
  _copy () {
    return new YMap()
  }

  /**
   * @return {YMap<MapType>}
   */
  clone () {
    /**
     * @type {YMap<MapType>}
     */
    const map = new YMap()
    this.forEach((value, key) => {
      // TODO: fix
      map.set(key, /** @type {any} */ (value instanceof AbstractType ? /** @type {typeof value} */ (value.clone()) : value))
    })
    return map
  }

  /**
   * Creates YMapEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    callTypeObservers(this, transaction, new YMapEvent(this, transaction, parentSubs))
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Object<string,any>}
   */
  toJSON () {
    /**
     * @type {Object<string,MapType>}
     */
    const map = {}
    this._map.forEach((item, key) => {
      if (!item.deleted) {
        const v = item.content.getContent()[item.length - 1]
        map[key] = v instanceof AbstractType ? v.toJSON() : v
      }
    })
    return map
  }

  /**
   * Returns the size of the YMap (count of key/value pairs)
   *
   * @return {number}
   */
  get size () {
    return [...createMapIterator(this._map)].length
  }

  /**
   * Returns the keys for each element in the YMap Type.
   *
   * @return {IterableIterator<string>}
   */
  keys () {
    return iterator.iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[0])
  }

  /**
   * Returns the values for each element in the YMap Type.
   *
   * @return {IterableIterator<any>}
   */
  values () {
    return iterator.iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[1].content.getContent()[v[1].length - 1])
  }

  /**
   * Returns an Iterator of [key, value] pairs
   *
   * @return {IterableIterator<any>}
   */
  entries () {
    return iterator.iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => [v[0], v[1].content.getContent()[v[1].length - 1]])
  }

  /**
   * Executes a provided function on once on every key-value pair.
   *
   * @param {function(MapType[keyof MapType],StringKey<MapType>,YMap<MapType>):void} f A function to execute on every element of this YArray.
   */
  forEach (f) {
    this._map.forEach((item, key) => {
      if (!item.deleted) {
        f(item.content.getContent()[item.length - 1], /** @type {StringKey<MapType>} */ (key), this)
      }
    })
  }

  /**
   * Returns an Iterator of [key, value] pairs
   *
   * @return {IterableIterator<any>}
   */
  [Symbol.iterator] () {
    return this.entries()
  }

  /**
   * Remove a specified element from this YMap.
   *
   * TODO: type to only allow deletion of optional elements in MapType
   * @param {string} key The key of the element to remove.
   */
  delete (key) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeMapDelete(transaction, this, key)
      })
    } else {
      /** @type {Map<string, any>} */ (this._prelimContent).delete(key)
    }
  }

  /**
   * @template {StringKey<MapType>} Key
   * @template {MapType[Key]} Value
   * Adds or updates an element with a specified key and value.
   *
   * @param {Key} key The key of the element to add to this YMap
   * @param {Value} value The value of the element to add
   * @return {Value}
   */
  set (key, value) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeMapSet(transaction, this, key, value)
      })
    } else {
      /** @type {Map<string, any>} */ (this._prelimContent).set(key, value)
    }
    return value
  }

  /**
   * @template {StringKey<MapType>} Key
   * Returns a specified element from this YMap.
   *
   * @param {Key} key
   * @return {MapType[Key]|undefined}
   */
  get (key) {
    return /** @type {MapType[Key]|undefined} */ (typeMapGet(this, key))
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
   * Removes all elements from this YMap.
   */
  clear () {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        this.forEach(function (_value, key, map) {
          typeMapDelete(transaction, map, key)
        })
      })
    } else {
      /** @type {Map<string, any>} */ (this._prelimContent).clear()
    }
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   */
  _write (encoder) {
    encoder.writeTypeRef(YMapRefID)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
 *
 * @private
 * @function
 */
export const readYMap = _decoder => new YMap()


/** @type {YMap<{ foo: { hello: [3, 4, { hiThere: null }] }; }>} */
const foo = new YMap();

foo.has("")
