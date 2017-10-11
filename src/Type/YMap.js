import Type from '../Struct/Type'
import Item from '../Struct/Item'
import ItemJSON from '../Struct/ItemJSON'

export default class YMap extends Type {
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
