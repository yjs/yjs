import ItemString from '../Struct/ItemString.js'
import YArray from './YArray.js'

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
    const strBuilder = []
    let n = this._start
    while (n !== null) {
      if (!n._deleted) {
        strBuilder.push(n._content)
      }
      n = n._right
    }
    return strBuilder.join('')
  }
  insert (pos, text) {
    this._y.transact(() => {
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
      let item = new ItemString()
      item._origin = left
      item._left = left
      item._right = right
      item._right_origin = right
      item._parent = this
      item._content = text
      item._integrate(this._y)
    })
  }
}
