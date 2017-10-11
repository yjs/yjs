import Type from '../Struct/Type'
import ItemJSON from '../Struct/ItemJSON'

export default class YArray extends Type {
  forEach (f) {
    let pos = 0
    let n = this._start
    while (n !== null) {
      let content = n._getContent()
      for (let i = 0; i < content.length; i++) {
        pos++
        let c = content[i]
        if (!c._deleted) {
          f(content[i], pos, this)
        }
      }
      n = n._right
    }
  }
  [Symbol.iterator] () {
    return {
      next: function () {
        while (this._item !== null && (this._item._deleted || this._item._content.length <= this._itemElement)) {
          // item is deleted or itemElement does not exist (is deleted)
          this._item = this._item._right
          this._itemElement = 0
        }
        if (this._item === null) {
          return {
            done: true
          }
        } else {
          return {
            value: [this._count, this._item._content[this._itemElement++]],
            done: false
          }
        }
      },
      _item: this._start,
      _itemElement: 0,
      _count: 0
    }
  }
  insert (pos, content) {
    let left = this._start
    let right
    let count = 0
    while (left !== null && !left._deleted) {
      if (pos < count + left._content.length) {
        [left, right] = left._splitAt(pos - count)
        break
      }
      left = left.right
    }
    if (pos > count) {
      throw new Error('Position exceeds array range!')
    }
    let prevJsonIns = null
    for (let i = 0; i < content.length; i++) {
      let c = content[i]
      if (c instanceof Type) {
        if (prevJsonIns === null) {
          prevJsonIns._integrate(this._y)
          prevJsonIns = null
        }
        c._left = left
        c._origin = left
        c._right = right
        c._parent = this
      } else {
        if (prevJsonIns === null) {
          prevJsonIns = new ItemJSON()
          prevJsonIns._origin = left
          prevJsonIns._left = left
          prevJsonIns._right = right
          prevJsonIns._parent = this
          prevJsonIns._content = []
        }
        prevJsonIns._content.push(c)
      }
    }
  }
  _logString () {
    let s = super._logString()
    return 'YArray: ' + s
  }
}
