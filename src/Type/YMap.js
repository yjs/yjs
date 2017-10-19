import Type from '../Struct/Type.js'
import Item from '../Struct/Item.js'
import ItemJSON from '../Struct/ItemJSON.js'

export default class YMap extends Type {
  _callObserver (parentSub) {
    this._eventHandler.callEventListeners({
      name: parentSub
    })
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
    this._y.transact(() => {
      const old = this._map.get(key) || null
      if (old !== null) {
        old._delete(this._y)
      }
      let v
      if (value instanceof Item) {
        v = value
      } else {
        v = new ItemJSON()
        v._content = [value]
      }
      v._right = old
      v._right_origin = old
      v._parent = this
      v._parentSub = key
      v._integrate(this._y)
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
    let s = super._logString()
    return 'YMap: ' + s
  }
}
