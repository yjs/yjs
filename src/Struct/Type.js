import Item from './Item'

export default class Type extends Item {
  constructor () {
    super()
    this._map = new Map()
    this._start = null
  }
  _delete (y) {
    super._delete(y)
    // delete map types
    for (let value of this._map.values()) {
      if (value instanceof Item && !value._deleted) {
        value._delete()
      }
    }
    // delete array types
    let t = this._start
    while (t !== null) {
      if (!t._deleted) {
        t._delete()
      }
      t = t._right
    }
  }
}
