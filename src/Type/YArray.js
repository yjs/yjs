import Type from '../Struct/Type.js'
import ItemJSON from '../Struct/ItemJSON.js'

export default class YArray extends Type {
  _callObserver () {
    this._eventHandler.callEventListeners({})
  }
  get (i) {
    // TODO: This can be improved!
    return this.toArray()[i]
  }
  toArray () {
    return this.map(c => c)
  }
  toJSON () {
    return this.map(c => {
      if (c instanceof Type) {
        if (c.toJSON !== null) {
          return c.toJSON()
        } else {
          return c.toString()
        }
      }
      return c
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
        if (n instanceof Type) {
          f(n, pos++, this)
        } else {
          const content = n._content
          const contentLen = content.length
          for (let i = 0; i < contentLen; i++) {
            pos++
            f(content[i], pos, this)
          }
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
      n = n._right
    }
    return length
  }
  [Symbol.iterator] () {
    return {
      next: function () {
        while (this._item !== null && (this._item._deleted || this._item._length <= this._itemElement)) {
          // item is deleted or itemElement does not exist (is deleted)
          this._item = this._item._right
          this._itemElement = 0
        }
        if (this._item === null) {
          return {
            done: true
          }
        }
        let content
        if (this._item instanceof Type) {
          content = this._item
        } else {
          content = this._item._content[this._itemElement++]
        }
        return {
          value: [this._count, content],
          done: false
        }
      },
      _item: this._start,
      _itemElement: 0,
      _count: 0
    }
  }
  delete (pos, length = 1) {
    this._y.transact(() => {
      let item = this._start
      let count = 0
      while (item !== null && length > 0) {
        if (count <= pos && pos < count + item._length) {
          const diffDel = pos - count
          item = item._splitAt(this._y, diffDel)
          item._splitAt(this._y, length)
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
    })
  }
  insertAfter (left, content) {
    const apply = () => {
      let right
      if (left === null) {
        right = this._start
      } else {
        right = left._right
      }
      let prevJsonIns = null
      for (let i = 0; i < content.length; i++) {
        let c = content[i]
        if (c instanceof Type) {
          if (prevJsonIns !== null) {
            if (this._y !== null) {
              prevJsonIns._integrate(this._y)
            }
            left = prevJsonIns
            prevJsonIns = null
          }
          c._origin = left
          c._left = left
          c._right = right
          c._right_origin = right
          c._parent = this
          if (this._y !== null) {
            c._integrate(this._y)
          } else if (left === null) {
            this._start = c
          }
          left = c
        } else {
          if (prevJsonIns === null) {
            prevJsonIns = new ItemJSON()
            prevJsonIns._origin = left
            prevJsonIns._left = left
            prevJsonIns._right = right
            prevJsonIns._right_origin = right
            prevJsonIns._parent = this
            prevJsonIns._content = []
          }
          prevJsonIns._content.push(c)
        }
      }
      if (prevJsonIns !== null && this._y !== null) {
        prevJsonIns._integrate(this._y)
      }
    }
    if (this._y !== null) {
      this._y.transact(apply)
    } else {
      apply()
    }
    return content
  }
  insert (pos, content) {
    let left = null
    let right = this._start
    let count = 0
    while (right !== null) {
      if (count <= pos && pos < count + right._length) {
        right = right._splitAt(this._y, pos - count)
        left = right._left
        break
      }
      count += right._length
      left = right
      right = right._right
    }
    if (pos > count) {
      throw new Error('Position exceeds array range!')
    }
    this.insertAfter(left, content)
  }
  _logString () {
    let s = super._logString()
    return 'YArray: ' + s
  }
}
