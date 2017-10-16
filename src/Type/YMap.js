import Type from '../Struct/Type.js'
import Item from '../Struct/Item.js'
import ItemJSON from '../Struct/ItemJSON.js'

export default class YMap extends Type {
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
  set (key, value) {
    let old = this._map.get(key)
    let v
    if (value instanceof Item) {
      v = value
    } else {
      let v = new ItemJSON()
      v._content = JSON.stringify(value)
    }
    v._right = old
    v._parent = this
    v._parentSub = key
    v._integrate()
  }
  get (key) {
    let v = this._map.get(key)
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
