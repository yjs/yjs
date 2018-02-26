import ItemString from '../Struct/ItemString.js'
import ItemEmbed from '../Struct/ItemEmbed.js'
import ItemFormat from '../Struct/ItemFormat.js'
import { logID } from '../MessageHandler/messageToString.js'
import { YArrayEvent, default as YArray } from './YArray.js'

function integrateItem (item, parent, y, left, right) {
  item._origin = left
  item._left = left
  item._right = right
  item._right_origin = right
  item._parent = parent
  if (y !== null) {
    item._integrate(y)
  } else if (left === null) {
    parent._start = item
  } else {
    left._right = item
  }
}

function findNextPosition (currentAttributes, parent, left, right, count) {
  while (right !== null && count > 0) {
    switch (right.constructor) {
      case ItemEmbed:
      case ItemString:
        const rightLen = right._deleted ? 0 : (right._length - 1)
        if (count <= rightLen) {
          right = right._splitAt(parent._y, count)
          left = right._left
          return [left, right, currentAttributes]
        }
        if (right._deleted === false) {
          count -= right._length
        }
        break
      case ItemFormat:
        if (right._deleted === false) {
          updateCurrentAttributes(currentAttributes, right)
        }
        break
    }
    left = right
    right = right._right
  }
  return [left, right, currentAttributes]
}

function findPosition (parent, pos) {
  let currentAttributes = new Map()
  let left = null
  let right = parent._start
  return findNextPosition(currentAttributes, parent, left, right, pos)
}

// negate applied formats
function insertNegatedAttributes (y, parent, left, right, negatedAttributes) {
  // check if we really need to remove attributes
  while (
    right !== null && (
      right._deleted === true || (
        right.constructor === ItemFormat &&
        (negatedAttributes.get(right.key) === right.value)
      )
    )
  ) {
    if (right._deleted === false) {
      negatedAttributes.delete(right.key)
    }
    left = right
    right = right._right
  }
  for (let [key, val] of negatedAttributes) {
    let format = new ItemFormat()
    format.key = key
    format.value = val
    integrateItem(format, parent, y, left, right)
    left = format
  }
  return [left, right]
}

function updateCurrentAttributes (currentAttributes, item) {
  const value = item.value
  const key = item.key
  if (value === null) {
    currentAttributes.delete(key)
  } else {
    currentAttributes.set(key, value)
  }
}

function minimizeAttributeChanges (left, right, currentAttributes, attributes) {
  // go right while attributes[right.key] === right.value (or right is deleted)
  while (true) {
    if (right === null) {
      break
    } else if (right._deleted === true) {
      // continue
    } else if (right.constructor === ItemFormat && (attributes[right.key] || null) === right.value) {
      // found a format, update currentAttributes and continue
      updateCurrentAttributes(currentAttributes, right)
    } else {
      break
    }
    left = right
    right = right._right
  }
  return [left, right]
}

function insertText (y, text, parent, left, right, currentAttributes, attributes) {
  for (let [key] of currentAttributes) {
    if (attributes.hasOwnProperty(key) === false) {
      attributes[key] = null
    }
  }
  [left, right] = minimizeAttributeChanges(left, right, currentAttributes, attributes)
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
      integrateItem(format, parent, y, left, right)
      left = format
    }
  }
  // insert content
  let item
  if (text.constructor === String) {
    item = new ItemString()
    item._content = text
  } else {
    item = new ItemEmbed()
    item.embed = text
  }
  integrateItem(item, parent, y, left, right)
  left = item
  return insertNegatedAttributes(y, parent, left, right, negatedAttributes)
}

function formatText (y, length, parent, left, right, currentAttributes, attributes) {
  [left, right] = minimizeAttributeChanges(left, right, currentAttributes, attributes)
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
      integrateItem(format, parent, y, left, right)
      left = format
    }
  }
  // iterate until first non-format or null is found
  // delete all formats with attributes[format.key] != null
  while (length > 0 && right !== null) {
    if (right._deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          if (attributes.hasOwnProperty(right.key)) {
            if (attributes[right.key] === right.value) {
              negatedAttributes.delete(right.key)
            } else {
              negatedAttributes.set(right.key, right.value)
            }
            right._delete(y)
          }
          updateCurrentAttributes(currentAttributes, right)
          break
        case ItemEmbed:
        case ItemString:
          right._splitAt(y, length)
          length -= right._length
          break
      }
    }
    left = right
    right = right._right
  }
  return insertNegatedAttributes(y, parent, left, right, negatedAttributes)
}

function deleteText (y, length, parent, left, right, currentAttributes) {
  while (length > 0 && right !== null) {
    if (right._deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          updateCurrentAttributes(currentAttributes, right)
          break
        case ItemEmbed:
        case ItemString:
          right._splitAt(y, length)
          length -= right._length
          right._delete(y)
          break
      }
    }
    left = right
    right = right._right
  }
  return [left, right]
}

class YTextEvent extends YArrayEvent {
  constructor (ytext, remote, transaction) {
    super(ytext, remote, transaction)
    this._delta = null
  }
  get delta () {
    if (this._delta === null) {
      const y = this.target._y
      y.transact(() => {
        let item = this.target._start
        const delta = []
        const added = this.addedElements
        const removed = this.removedElements
        this._delta = delta
        let action = null
        let attributes = {} // counts added or removed new attributes for retain
        const currentAttributes = new Map() // saves all current attributes for insert
        const oldAttributes = new Map()
        let insert = ''
        let retain = 0
        let deleteLen = 0
        const addOp = function addOp () {
          if (action !== null) {
            let op
            switch (action) {
              case 'delete':
                op = { delete: deleteLen }
                deleteLen = 0
                break
              case 'insert':
                op = { insert }
                if (currentAttributes.size > 0) {
                  op.attributes = {}
                  for (let [key, value] of currentAttributes) {
                    if (value !== null) {
                      op.attributes[key] = value
                    }
                  }
                }
                insert = ''
                break
              case 'retain':
                op = { retain }
                if (Object.keys(attributes).length > 0) {
                  op.attributes = {}
                  for (let key in attributes) {
                    op.attributes[key] = attributes[key]
                  }
                }
                retain = 0
                break
            }
            delta.push(op)
            action = null
          }
        }
        while (item !== null) {
          switch (item.constructor) {
            case ItemEmbed:
              if (added.has(item)) {
                addOp()
                action = 'insert'
                insert = item.embed
                addOp()
              } else if (removed.has(item)) {
                if (action !== 'delete') {
                  addOp()
                  action = 'delete'
                }
                deleteLen += 1
              } else if (item._deleted === false) {
                if (action !== 'retain') {
                  addOp()
                  action = 'retain'
                }
                retain += 1
              }
              break
            case ItemString:
              if (added.has(item)) {
                if (action !== 'insert') {
                  addOp()
                  action = 'insert'
                }
                insert += item._content
              } else if (removed.has(item)) {
                if (action !== 'delete') {
                  addOp()
                  action = 'delete'
                }
                deleteLen += item._length
              } else if (item._deleted === false) {
                if (action !== 'retain') {
                  addOp()
                  action = 'retain'
                }
                retain += item._length
              }
              break
            case ItemFormat:
              if (added.has(item)) {
                const curVal = currentAttributes.get(item.key) || null
                if (curVal !== item.value) {
                  if (action === 'retain') {
                    addOp()
                  }
                  if (item.value === (oldAttributes.get(item.key) || null)) {
                    delete attributes[item.key]
                  } else {
                    attributes[item.key] = item.value
                  }
                } else {
                  item._delete(y)
                }
              } else if (removed.has(item)) {
                oldAttributes.set(item.key, item.value)
                const curVal = currentAttributes.get(item.key) || null
                if (curVal !== item.value) {
                  if (action === 'retain') {
                    addOp()
                  }
                  attributes[item.key] = curVal
                }
              } else if (item._deleted === false) {
                oldAttributes.set(item.key, item.value)
                if (attributes.hasOwnProperty(item.key)) {
                  if (attributes[item.key] !== item.value) {
                    if (action === 'retain') {
                      addOp()
                    }
                    if (item.value === null) {
                      attributes[item.key] = item.value
                    } else {
                      delete attributes[item.key]
                    }
                  } else {
                    item._delete(y)
                  }
                }
              }
              if (item._deleted === false) {
                if (action === 'insert') {
                  addOp()
                }
                updateCurrentAttributes(currentAttributes, item)
              }
              break
          }
          item = item._right
        }
        addOp()
        while (this._delta.length > 0) {
          let lastOp = this._delta[this._delta.length - 1]
          if (lastOp.hasOwnProperty('retain') && !lastOp.hasOwnProperty('attributes')) {
            // retain delta's if they don't assign attributes
            this._delta.pop()
          } else {
            break
          }
        }
      })
    }
    return this._delta
  }
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
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YTextEvent(this, remote, transaction))
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
  applyDelta (delta) {
    this._transact(y => {
      let left = null
      let right = this._start
      const currentAttributes = new Map()
      for (let i = 0; i < delta.length; i++) {
        let op = delta[i]
        if (op.hasOwnProperty('insert')) {
          ;[left, right] = insertText(y, op.insert, this, left, right, currentAttributes, op.attributes || {})
        } else if (op.hasOwnProperty('retain')) {
          ;[left, right] = formatText(y, op.retain, this, left, right, currentAttributes, op.attributes || {})
        } else if (op.hasOwnProperty('delete')) {
          ;[left, right] = deleteText(y, op.delete, this, left, right, currentAttributes)
        }
      }
    })
  }
  /**
   * As defined by Quilljs - https://quilljs.com/docs/delta/
   */
  toDelta () {
    let ops = []
    let currentAttributes = new Map()
    let str = ''
    let n = this._start
    function packStr () {
      if (str.length > 0) {
        // pack str with attributes to ops
        let attributes = {}
        let addAttributes = false
        for (let [key, value] of currentAttributes) {
          addAttributes = true
          attributes[key] = value
        }
        let op = { insert: str }
        if (addAttributes) {
          op.attributes = attributes
        }
        ops.push(op)
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
            updateCurrentAttributes(currentAttributes, n)
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
      let [left, right, currentAttributes] = findPosition(this, pos)
      insertText(y, text, this, left, right, currentAttributes, attributes)
    })
  }
  insertEmbed (pos, embed, attributes = {}) {
    if (embed.constructor !== Object) {
      throw new Error('Embed must be an Object')
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, pos)
      insertText(y, embed, this, left, right, currentAttributes, attributes)
    })
  }
  delete (pos, length) {
    if (length === 0) {
      return
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, pos)
      deleteText(y, length, this, left, right, currentAttributes)
    })
  }
  format (pos, length, attributes) {
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, pos)
      if (right === null) {
        return
      }
      formatText(y, length, this, left, right, currentAttributes, attributes)
    })
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `YText(id:${logID(this._id)},start:${logID(this._start)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}
