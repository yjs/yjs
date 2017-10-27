import Item from './Item.js'
import EventHandler from '../Util/EventHandler.js'

// restructure children as if they were inserted one after another
function integrateChildren (y, start) {
  let right
  do {
    right = start._right
    start._right = null
    start._right_origin = null
    start._origin = start._left
    start._integrate(y)
    start = right
  } while (right !== null)
}

export default class Type extends Item {
  constructor () {
    super()
    this._map = new Map()
    this._start = null
    this._y = null
    this._eventHandler = new EventHandler()
  }
  _transact (f) {
    const y = this._y
    if (y !== null) {
      y.transact(f)
    } else {
      f(y)
    }
  }
  observe (f) {
    this._eventHandler.addEventListener(f)
  }
  unobserve (f) {
    this._eventHandler.removeEventListener(f)
  }
  _integrate (y) {
    y._transaction.newTypes.add(this)
    super._integrate(y)
    this._y = y
    // when integrating children we must make sure to
    // integrate start
    const start = this._start
    if (start !== null) {
      this._start = null
      integrateChildren(y, start)
    }
    // integrate map children
    const map = this._map
    this._map = new Map()
    for (let t of map.values()) {
      // TODO make sure that right elements are deleted!
      integrateChildren(y, t)
    }
  }
  _delete (y, createDelete) {
    super._delete(y, createDelete)
    y._transaction.changedTypes.delete(this)
    // delete map types
    for (let value of this._map.values()) {
      if (value instanceof Item && !value._deleted) {
        value._delete(y, false)
      }
    }
    // delete array types
    let t = this._start
    while (t !== null) {
      if (!t._deleted) {
        t._delete(y, false)
      }
      t = t._right
    }
  }
}
