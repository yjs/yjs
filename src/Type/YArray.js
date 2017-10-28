import Type from '../Struct/Type.js'
import ItemJSON from '../Struct/ItemJSON.js'
import { logID } from '../MessageHandler/messageToString.js'

class YArrayEvent {
  constructor (yarray, remote) {
    this.target = yarray
    this.remote = remote
  }
}

export default class YArray extends Type {
  _callObserver (parentSubs, remote) {
    this._eventHandler.callEventListeners(new YArrayEvent(this, remote))
  }
  get (pos) {
    let n = this._start
    while (n !== null) {
      if (!n._deleted) {
        if (pos < n._length) {
          return n._content[n._length - pos]
        }
        pos -= n._length
      }
      n = n._right
    }
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
        if (!item._deleted) {
          if (count <= pos && pos < count + item._length) {
            const diffDel = pos - count
            item = item._splitAt(this._y, diffDel)
            item._splitAt(this._y, length)
            length -= item._length
            item._delete(this._y)
            count += diffDel
          } else {
            count += item._length
          }
        }
        item = item._right
      }
    })
    if (length > 0) {
      throw new Error('Delete exceeds the range of the YArray')
    }
  }
  insertAfter (left, content) {
    this._transact(y => {
      let right
      if (left === null) {
        right = this._start
      } else {
        right = left._right
      }
      let prevJsonIns = null
      for (let i = 0; i < content.length; i++) {
        let c = content[i]
        if (typeof c === 'function') {
          c = new c() // eslint-disable-line new-cap
        }
        if (c instanceof Type) {
          if (prevJsonIns !== null) {
            if (y !== null) {
              prevJsonIns._integrate(y)
            }
            left = prevJsonIns
            prevJsonIns = null
          }
          c._origin = left
          c._left = left
          c._right = right
          c._right_origin = right
          c._parent = this
          if (y !== null) {
            c._integrate(y)
          } else if (left === null) {
            this._start = c
          } else {
            left._right = c
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
      if (prevJsonIns !== null && y !== null) {
        prevJsonIns._integrate(y)
      }
    })
  }
  insert (pos, content) {
    let left = null
    let right = this._start
    let count = 0
    const y = this._y
    while (right !== null) {
      const rightLen = right._deleted ? 0 : (right._length - 1)
      if (count <= pos && pos <= count + rightLen) {
        const splitDiff = pos - count
        right = right._splitAt(y, splitDiff)
        left = right._left
        count += splitDiff
        break
      }
      if (!right._deleted) {
        count += right._length
      }
      left = right
      right = right._right
    }
    if (pos > count) {
      throw new Error('Position exceeds array range!')
    }
    this.insertAfter(left, content)
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `YArray(id:${logID(this._id)},start:${logID(this._start)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${logID(this._parentSub)})`
  }
}
