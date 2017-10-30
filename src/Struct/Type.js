import Item from './Item.js'
import EventHandler from '../Util/EventHandler.js'
import ID from '../Util/ID.js'

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

export function getListItemIDByPosition (type, i) {
  let pos = 0
  let n = type._start
  while (n !== null) {
    if (!n._deleted) {
      if (pos <= i && i < pos + n._length) {
        const id = n._id
        return new ID(id.user, id.clock + i - pos)
      }
      pos++
    }
    n = n._right
  }
}

export default class Type extends Item {
  constructor () {
    super()
    this._map = new Map()
    this._start = null
    this._y = null
    this._eventHandler = new EventHandler()
    this._deepEventHandler = new EventHandler()
  }
  _callEventHandler (event) {
    this._eventHandler.callEventListeners(event)
    let type = this
    while (type !== this._y) {
      type._deepEventHandler.callEventListeners(event)
      type = type._parent
    }
  }
  _copy (undeleteChildren) {
    let copy = super._copy()
    let map = new Map()
    copy._map = map
    for (let [key, value] of this._map) {
      if (undeleteChildren.has(value) || !value.deleted) {
        let _item = value._copy(undeleteChildren)
        _item._parent = copy
        map.set(key, value._copy(undeleteChildren))
      }
    }
    let prevUndeleted = null
    copy._start = null
    let item = this._start
    while (item !== null) {
      if (undeleteChildren.has(item) || !item.deleted) {
        let _item = item._copy(undeleteChildren)
        _item._left = prevUndeleted
        _item._origin = prevUndeleted
        _item._right = null
        _item._right_origin = null
        _item._parent = copy
        if (prevUndeleted === null) {
          copy._start = _item
        } else {
          prevUndeleted._right = _item
        }
        prevUndeleted = _item
      }
      item = item._right
    }
    return copy
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
  observeDeep (f) {
    this._deepEventHandler.addEventListener(f)
  }
  unobserve (f) {
    this._eventHandler.removeEventListener(f)
  }
  unobserveDeep (f) {
    this._deepEventHandler.removeEventListener(f)
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
