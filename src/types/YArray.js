/**
 * @module types
 */

import { Type } from '../structs/Type.js'
import { ItemJSON } from '../structs/ItemJSON.js'
import { ItemString } from '../structs/ItemString.js'
import * as stringify from '../utils/structStringify.js'
import { YEvent } from '../utils/YEvent.js'
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import { Item } from '../structs/Item.js' // eslint-disable-line
import { ItemBinary } from '../structs/ItemBinary.js'
import { isVisible } from '../utils/snapshot.js'

/**
 * Event that describes the changes on a YArray
 */
export class YArrayEvent extends YEvent {
  /**
   * @param {YArray} yarray The changed type
   * @param {Boolean} remote Whether the changed was caused by a remote peer
   * @param {Transaction} transaction The transaction object
   */
  constructor (yarray, remote, transaction) {
    super(yarray)
    this.remote = remote
    this._transaction = transaction
    this._addedElements = null
    this._removedElements = null
  }

  /**
   * Child elements that were added in this transaction.
   *
   * @return {Set}
   */
  get addedElements () {
    if (this._addedElements === null) {
      const target = this.target
      const transaction = this._transaction
      const addedElements = new Set()
      transaction.newTypes.forEach(type => {
        if (type._parent === target && !transaction.deletedStructs.has(type)) {
          addedElements.add(type)
        }
      })
      this._addedElements = addedElements
    }
    return this._addedElements
  }

  /**
   * Child elements that were removed in this transaction.
   *
   * @return {Set}
   */
  get removedElements () {
    if (this._removedElements === null) {
      const target = this.target
      const transaction = this._transaction
      const removedElements = new Set()
      transaction.deletedStructs.forEach(struct => {
        if (struct._parent === target && !transaction.newTypes.has(struct)) {
          removedElements.add(struct)
        }
      })
      this._removedElements = removedElements
    }
    return this._removedElements
  }
}

/**
 * A shared Array implementation.
 */
export class YArray extends Type {
  constructor () {
    super()
    this.length = 0
  }
  /**
   * Creates YArray Event and calls observers.
   *
   * @private
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YArrayEvent(this, remote, transaction))
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {number} index The index of the element to return from the YArray
   * @return {any}
   */
  get (index) {
    let n = this._start
    while (n !== null) {
      if (!n._deleted && n._countable) {
        if (index < n._length) {
          switch (n.constructor) {
            case ItemJSON:
            case ItemString:
              return n._content[index]
            default:
              return n
          }
        }
        index -= n._length
      }
      n = n._right
    }
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @param {Object} [snapshot]
   * @return {Array}
   */
  toArray (snapshot) {
    return this.map(c => c, snapshot)
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Array}
   */
  toJSON () {
    return this.map(c => {
      if (c instanceof Type) {
        return c.toJSON()
      }
      return c
    })
  }

  /**
   * Returns an Array with the result of calling a provided function on every
   * element of this YArray.
   *
   * @param {Function} f Function that produces an element of the new Array
   * @param {import('../protocols/history.js').HistorySnapshot} [snapshot]
   * @return {Array} A new array with each element being the result of the
   *                 callback function
   */
  map (f, snapshot) {
    const res = []
    this.forEach((c, i) => {
      res.push(f(c, i, this))
    }, snapshot)
    return res
  }

  /**
   * Executes a provided function on once on overy element of this YArray.
   *
   * @param {Function} f A function to execute on every element of this YArray.
   * @param {import('../protocols/history.js').HistorySnapshot} [snapshot]
   */
  forEach (f, snapshot) {
    let index = 0
    let n = this._start
    while (n !== null) {
      if (isVisible(n, snapshot) && n._countable) {
        if (n instanceof Type) {
          f(n, index++, this)
        } else if (n.constructor === ItemBinary) {
          f(n._content, index++, this)
        } else {
          const content = n._content
          const contentLen = content.length
          for (let i = 0; i < contentLen; i++) {
            index++
            f(content[i], index, this)
          }
        }
      }
      n = n._right
    }
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
          this._item = this._item._right
        } else {
          content = this._item._content[this._itemElement++]
        }
        return {
          value: content,
          done: false
        }
      },
      _item: this._start,
      _itemElement: 0,
      _count: 0
    }
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {number} index Index at which to start deleting elements
   * @param {number} length The number of elements to remove. Defaults to 1.
   */
  delete (index, length = 1) {
    this._y.transact(() => {
      let item = this._start
      let count = 0
      while (item !== null && length > 0) {
        if (!item._deleted && item._countable) {
          if (count <= index && index < count + item._length) {
            const diffDel = index - count
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

  /**
   * Inserts content after an element container.
   *
   * @private
   * @param {Item} left The element container to use as a reference.
   * @param {Array<number|string|Object|ArrayBuffer>} content The Array of content to insert (see {@see insert})
   */
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
        } else if (c.constructor === ArrayBuffer) {
          if (prevJsonIns !== null) {
            if (y !== null) {
              prevJsonIns._integrate(y)
            }
            left = prevJsonIns
            prevJsonIns = null
          }
          const itemBinary = new ItemBinary()
          itemBinary._origin = left
          itemBinary._left = left
          itemBinary._right = right
          itemBinary._right_origin = right
          itemBinary._parent = this
          itemBinary._content = c
          if (y !== null) {
            itemBinary._integrate(y)
          } else if (left === null) {
            this._start = itemBinary
          } else {
            left._right = itemBinary
          }
          left = itemBinary
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
      if (prevJsonIns !== null) {
        if (y !== null) {
          prevJsonIns._integrate(y)
        } else if (prevJsonIns._left === null) {
          this._start = prevJsonIns
        } else {
          left._right = prevJsonIns
        }
      }
    })
    return content
  }

  /**
   * Inserts new content at an index.
   *
   * Important: This function expects an array of content. Not just a content
   * object. The reason for this "weirdness" is that inserting several elements
   * is very efficient when it is done as a single operation.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  yarray.insert(0, ['a'])
   *  // Insert numbers 1, 2 at position 1
   *  yarray.insert(2, [1, 2])
   *
   * @param {number} index The index to insert content at.
   * @param {Array<number|string|ArrayBuffer|Type>} content The array of content
   */
  insert (index, content) {
    this._transact(() => {
      let left = null
      let right = this._start
      let count = 0
      const y = this._y
      while (right !== null) {
        const rightLen = right._deleted ? 0 : (right._length - 1)
        if (count <= index && index <= count + rightLen) {
          const splitDiff = index - count
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
      if (index > count) {
        throw new Error('Index exceeds array range!')
      }
      this.insertAfter(left, content)
    })
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array<number|string|ArrayBuffer|Type>} content Array of content to append.
   */
  push (content) {
    let n = this._start
    let lastUndeleted = null
    while (n !== null) {
      if (!n._deleted) {
        lastUndeleted = n
      }
      n = n._right
    }
    this.insertAfter(lastUndeleted, content)
  }

  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return stringify.logItemHelper('YArray', this, `start:${stringify.stringifyItemID(this._start)}"`)
  }
}
