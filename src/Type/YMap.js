import Type from '../Struct/Type.js'
import Item from '../Struct/Item.js'
import ItemJSON from '../Struct/ItemJSON.js'
import { logID } from '../MessageHandler/messageToString.js'

class YMapEvent {
  constructor (ymap, subs, remote) {
    this.target = ymap
    this.keysChanged = subs
    this.remote = remote
  }
}

export default class YMap extends Type {
  _callObserver (parentSubs, remote) {
    this._eventHandler.callEventListeners(new YMapEvent(this, parentSubs, remote))
  }
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
  delete (key) {
    this._y.transact(() => {
      let c = this._map.get(key)
      if (c !== undefined) {
        c._delete(this._y)
      }
    })
  }
  set (key, value) {
    const y = this._y
    y.transact(() => {
      const old = this._map.get(key) || null
      if (old !== null) {
        if (old instanceof ItemJSON && old._content[0] === value) {
          // Trying to overwrite with same value
          // break here
          return value
        }
        old._delete(y)
      }
      let v
      if (typeof value === 'function') {
        v = new value() // eslint-disable-line new-cap
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
      v._integrate(y)
    })
    return value
  }
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
  _logString () {
    return `YMap(id:${logID(this._id)},mapSize:${this._map.size},left:${logID(this._left)},origin:${logID(this._origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${logID(this._parentSub)})`
  }
}
