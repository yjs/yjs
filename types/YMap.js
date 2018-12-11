/**
 * @module types
 */

import { Item } from '../structs/Item.js'
import { Type } from '../structs/Type.js'
import { ItemJSON } from '../structs/ItemJSON.js'
import * as stringify from '../utils/structStringify.js'
import { YEvent } from '../utils/YEvent.js'

/**
 * Event that describes the changes on a YMap.
 */
export class YMapEvent extends YEvent {
  /**
   * @param {YMap} ymap The YArray that changed.
   * @param {Set<any>} subs The keys that changed.
   * @param {boolean} remote Whether the change was created by a remote peer.
   */
  constructor (ymap, subs, remote) {
    super(ymap)
    this.keysChanged = subs
    this.remote = remote
  }
}

/**
 * A shared Map implementation.
 */
export class YMap extends Type {
  /**
   * Creates YMap Event and calls observers.
   *
   * @private
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YMapEvent(this, parentSubs, remote))
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Object}
   */
  toJSON () {
    const map = {}
    for (let [key, item] of this._map) {
      if (!item._deleted) {
        let res
        if (item instanceof Type) {
          if (item.toJSON !== undefined) {
            res = item.toJSON()
          } else {
            res = item.toString()
          }
        } else {
          res = item._content[0]
        }
        map[key] = res
      }
    }
    return map
  }

  /**
   * Returns the keys for each element in the YMap Type.
   *
   * @return {Array}
   */
  keys () {
    // TODO: Should return either Iterator or Set!
    let keys = []
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Remove a specified element from this YMap.
   *
   * @param {string} key The key of the element to remove.
   */
  delete (key) {
    this._transact((y) => {
      let c = this._map.get(key)
      if (y !== null && c !== undefined) {
        c._delete(y)
      }
    })
  }

  /**
   * Adds or updates an element with a specified key and value.
   *
   * @param {string} key The key of the element to add to this YMap
   * @param {Object | string | number | Type} value The value of the element to add
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
   */
  get (key) {
    let v = this._map.get(key)
    if (v === undefined || v._deleted) {
      return undefined
    }
    if (v instanceof Type) {
      return v
    } else {
      return v._content[v._content.length - 1]
    }
  }

  /**
   * Returns a boolean indicating whether the specified key exists or not.
   *
   * @param {string} key The key to test.
   */
  has (key) {
    let v = this._map.get(key)
    if (v === undefined || v._deleted) {
      return false
    } else {
      return true
    }
  }

  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return stringify.logItemHelper('YMap', this, `mapSize:${this._map.size}`)
  }
}
