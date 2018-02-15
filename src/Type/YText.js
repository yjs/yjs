import ItemString from '../Struct/ItemString.js'
import ItemFormat from '../Struct/ItemFormat.js'
import YArray from './YArray.js'
import { logID } from '../MessageHandler/messageToString.js'

function integrateItem (item, parent, y, left, right) {
  item._origin = left
  item._left = left
  item._right = right
  item._right_origin = right
  item._parent = parent
  if (y !== null) {
    item._integrate(this._y)
  } else if (left === null) {
    parent._start = item
  } else {
    left._right = item
  }
}

function findPosition (parent, pos, attributes) {
  let currentAttributes = new Map()
  let left = null
  let right = parent._start
  let count = 0
  while (right !== null) {
    switch (right.constructor) {
      // case ItemBlockFormat: do not break..
      case ItemString:
        const rightLen = right._deleted ? 0 : (right._length - 1)
        if (count <= pos && pos <= count + rightLen) {
          const splitDiff = pos - count
          right = right._splitAt(parent._y, splitDiff)
          left = right._left
          count += splitDiff
          break
        }
        if (!right._deleted) {
          count += right._length
        }
        break
      case ItemFormat:
        if (right._deleted === false) {
          const key = right.key
          const value = right.value
          if (value === null) {
            currentAttributes.delete(key)
          } else if (attributes.hasOwnProperty(key)) {
            // only set if relevant
            currentAttributes.set(key, value)
          }
        }
        break
    }
    left = right
    right = right._right
  }
  if (pos > count) {
    throw new Error('Position exceeds array range!')
  }
  return [left, right, currentAttributes]
}

export default class YText extends YArray {
  constructor (string) {
    super()
    if (typeof string === 'string') {
      const start = new ItemString()
      start._parent = this
      start._content = string
      this._start = start
    }
  }
  toString () {
    let str = ''
    let n = this._start
    while (n !== null) {
      if (!n._deleted && n._countable) {
        str += n._content
      }
      n = n._right
    }
    return str
  }
  /**
   * As defined by Quilljs - https://quilljs.com/docs/delta/
   */
  toRichtextDelta () {
    let ops = []
    let currentAttributes = new Map()
    let str = ''
    let n = this._start
    function packStr () {
      if (str.length > 0) {
        // pack str with attributes to ops
        let attributes = {}
        for (let [key, value] of currentAttributes) {
          attributes[key] = value
        }
        ops.push({ insert: str, attributes })
        str = ''
      }
    }
    while (n !== null) {
      if (!n._deleted) {
        switch (n.constructor) {
          case ItemString:
            str += n._content
            break
          case ItemFormat:
            packStr()
            const value = n.value
            const key = n.key
            if (value === null) {
              currentAttributes.delete(key)
            } else {
              currentAttributes.set(key, value)
            }
            break
        }
      }
      n = n._right
    }
    packStr()
    return ops
  }
  insert (pos, text, attributes = {}) {
    if (text.length <= 0) {
      return
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, pos, attributes)
      let negatedAttributes = new Map()
      // insert format-start items
      for (let key in attributes) {
        const val = attributes[key]
        const currentVal = currentAttributes.get(key)
        if (currentVal !== val) {
          // save negated attribute (set null if currentVal undefined)
          negatedAttributes.set(key, currentVal || null)
          let format = new ItemFormat()
          format.key = key
          format.value = val
          integrateItem(format, this, y, left, right)
          left = format
        }
      }
      // insert text content
      let item = new ItemString()
      item._content = text
      integrateItem(item, this, y, left, right)
      left = item
      // negate applied formats
      for (let [key, value] of negatedAttributes) {
        let format = new ItemFormat()
        format.key = key
        format.value = value
        integrateItem(format, this, y, left, right)
        left = format
      }
    })
  }
  format (pos, length, attributes) {
    this._transact(y => {
      let [left, _right, currentAttributes] = findPosition(this, pos, attributes)
      if (_right === null) {
        return
      }
      let negatedAttributes = new Map()
      // insert format-start items
      for (let key in attributes) {
        const val = attributes[key]
        const currentVal = currentAttributes.get(key)
        if (currentVal !== val) {
          // save negated attribute (set null if currentVal undefined)
          negatedAttributes.set(key, currentVal || null)
          let format = new ItemFormat()
          format.key = key
          format.value = val
          integrateItem(format, this, y, left, _right)
          left = format
        }
      }
      // iterate until first non-format or null is found
      // delete all formats with attributes[format.key] != null
      while (length > 0 && left !== null) {
        if (left._deleted === false) {
          if (left.constructor === ItemFormat) {
            if (attributes[left.key] != null) {
              left.delete(y)
            }
          } else if (length < left._length) {

          }
        }
        left = left._right
      }
    })
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `YText(id:${logID(this._id)},start:${logID(this._start)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}
