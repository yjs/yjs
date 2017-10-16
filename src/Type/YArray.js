import Type from '../Struct/Type.js'
import ItemJSON from '../Struct/ItemJSON.js'

export default class YArray extends Type {
  toJSON () {
    return this.map(c => {
      if (c instanceof Type) {
        if (c.toJSON !== null) {
          return c.toJSON()
        } else {
          return c.toString()
        }
      }
    })
  }
  map (f) {
    const res = []
    this.forEach((c, i) => {
      res.push(f(c, i, this))
    })
    return res
  }
  forEach (f) {
    let pos = 0
    let n = this._start
    while (n !== null) {
      if (!n._deleted) {
        const content = n._content
        const contentLen = content.length
        for (let i = 0; i < contentLen; i++) {
          pos++
          f(content[i], pos, this)
        }
      }
      n = n._right
    }
  }
  get length () {
    let length = 0
    let n = this._start
    while (n !== null) {
      if (!n._deleted) {
        length += n._length
      }
      n = n._next
    }
    return length
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
  delete (pos, length = 1) {
    let item = this._start
    let count = 0
    while (item !== null && length > 0) {
      if (count < pos && pos < count + item._length) {
        const diffDel = pos - count
        item = item
          ._splitAt(this._y, diffDel)
          ._splitAt(this._y, length)
        length -= item._length
        item._delete(this._y)
      }
      if (!item._deleted) {
        count += item._length
      }
      item = item._right
    }
    if (length > 0) {
      throw new Error('Delete exceeds the range of the YArray')
    }
  }
  insert (pos, content) {
    let left = this._start
    let right = null
    let count = 0
    while (left !== null) {
      if (count <= pos && pos < count + left._content.length) {
        right = left._splitAt(this.y, pos - count)
        break
      }
      count += left._length
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
    if (prevJsonIns !== null) {
      prevJsonIns._integrate(this._y)
    }
  }
  _logString () {
    let s = super._logString()
    return 'YArray: ' + s
  }
}
