/**
 * @module types
 */

import { AbstractType, typeMapDelete } from './AbstractType.js'
import { ItemJSON } from '../structs/ItemJSON.js'
import { ItemType } from '../structs/ItemType.js' // eslint-disable-line
import { YEvent } from '../utils/YEvent.js'
import { ItemBinary } from '../structs/ItemBinary.js'
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line

class YMapIterator {
  /**
   * @param {Array<any>} vals
   */
  constructor (vals) {
    this.vals = vals
    this.i = 0
  }
  [Symbol.iterator] () {
    return this
  }
  next () {
    let value
    let done = true
    if (this.i < this.vals.length) {
      value = this.vals[this.i]
      done = false
    }
    return {
      value,
      done
    }
  }
}

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
   * @return {YMapIterator}
   */
  keys () {
    const keys = []
    for (let [key, value] of this._map) {
      if (value.deleted) {
        keys.push(key)
      }
    }
    return new YMapIterator(keys)
  }

  entries () {
    const entries = []
    for (let [key, value] of this._map) {
      if (value.deleted) {
        entries.push([key, value.getContent()[0]])
      }
    }
    return new YMapIterator(entries)
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
    this._transact(y => {
      const old = this._map.get(key) || null
      if (old !== null) {
        if (
          old.constructor === ItemJSON &&
          !old._deleted && old._content[0] === value
        ) {
          // Trying to overwrite with same value
          // break here
          return value
        }
        if (y !== null) {
          old._delete(y)
        }
      }
      let v
      if (typeof value === 'function') {
        v = new value() // eslint-disable-line new-cap
        value = v
      } else if (value instanceof Item) {
        v = value
      } else if (value != null && value.constructor === ArrayBuffer) {
        v = new ItemBinary()
        v._content = value
      } else {
        v = new ItemJSON()
        v._content = [value]
      }
      v._right = old
      v._right_origin = old
      v._parent = this
      v._parentSub = key
      if (y !== null) {
        v._integrate(y)
      } else {
        this._map.set(key, v)
      }
    })
    return value
  }

  /**
   * Returns a specified element from this YMap.
   *
   * @param {string} key The key of the element to return.
   * @param {HistorySnapshot} [snapshot]
   */
  get (key, snapshot) {
    let v = this._map.get(key)
    if (v === undefined) {
      return undefined
    }
    if (snapshot !== undefined) {
      // iterate until found element that exists
      while (!snapshot.sm.has(v._id.user) || v._id.clock >= snapshot.sm.get(v._id.user)) {
        v = v._right
      }
    }
    if (isVisible(v, snapshot)) {
      if (v instanceof Type) {
        return v
      } else if (v.constructor === ItemBinary) {
        return v._content
      } else {
        return v._content[v._content.length - 1]
      }
    }
  }

  /**
   * Returns a boolean indicating whether the specified key exists or not.
   *
   * @param {string} key The key to test.
   * @param {HistorySnapshot} [snapshot]
   */
  has (key, snapshot) {
    let v = this._map.get(key)
    if (v === undefined) {
      return false
    }
    if (snapshot !== undefined) {
      // iterate until found element that exists
      while (!snapshot.sm.has(v._id.user) || v._id.clock >= snapshot.sm.get(v._id.user)) {
        v = v._right
      }
    }
    return isVisible(v, snapshot)
  }
}

export const readYMap = decoder => new YMap()