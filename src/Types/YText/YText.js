import ItemEmbed from '../../Struct/ItemEmbed.js'
import ItemString from '../../Struct/ItemString.js'
import ItemFormat from '../../Struct/ItemFormat.js'
import { logItemHelper } from '../../message.js'
import { YArrayEvent, default as YArray } from '../YArray/YArray.js'

/**
 * @private
 */
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

/**
 * @private
 */
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

/**
 * @private
 */
function findPosition (parent, index) {
  let currentAttributes = new Map()
  let left = null
  let right = parent._start
  return findNextPosition(currentAttributes, parent, left, right, index)
}

/**
 * Negate applied formats
 *
 * @private
 */
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

/**
 * @private
 */
function updateCurrentAttributes (currentAttributes, item) {
  const value = item.value
  const key = item.key
  if (value === null) {
    currentAttributes.delete(key)
  } else {
    currentAttributes.set(key, value)
  }
}

/**
 * @private
 */
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

/**
 * @private
 */
function insertAttributes (y, parent, left, right, attributes, currentAttributes) {
  const negatedAttributes = new Map()
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
  return [left, right, negatedAttributes]
}

/**
 * @private
 */
function insertText (y, text, parent, left, right, currentAttributes, attributes) {
  for (let [key] of currentAttributes) {
    if (attributes[key] === undefined) {
      attributes[key] = null
    }
  }
  [left, right] = minimizeAttributeChanges(left, right, currentAttributes, attributes)
  let negatedAttributes
  [left, right, negatedAttributes] = insertAttributes(y, parent, left, right, attributes, currentAttributes)
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

/**
 * @private
 */
function formatText (y, length, parent, left, right, currentAttributes, attributes) {
  [left, right] = minimizeAttributeChanges(left, right, currentAttributes, attributes)
  let negatedAttributes
  [left, right, negatedAttributes] = insertAttributes(y, parent, left, right, attributes, currentAttributes)
  // iterate until first non-format or null is found
  // delete all formats with attributes[format.key] != null
  while (length > 0 && right !== null) {
    if (right._deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          const attr = attributes[right.key]
          if (attr !== undefined) {
            if (attr === right.value) {
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

/**
 * @private
 */
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

// TODO: In the quill delta representation we should also use the format {ops:[..]}
/**
 * The Quill Delta format represents changes on a text document with
 * formatting information. For mor information visit {@link https://quilljs.com/docs/delta/|Quill Delta}
 *
 * @example
 *   {
 *     ops: [
 *       { insert: 'Gandalf', attributes: { bold: true } },
 *       { insert: ' the ' },
 *       { insert: 'Grey', attributes: { color: '#cccccc' } }
 *     ]
 *   }
 *
 * @typedef {Array<Object>} Delta
 */

/**
  * Attributes that can be assigned to a selection of text.
  *
  * @example
  *   {
  *     bold: true,
  *     font-size: '40px'
  *   }
  *
  * @typedef {Object} TextAttributes
  */

/**
 * Event that describes the changes on a YText type.
 *
 * @private
 */
class YTextEvent extends YArrayEvent {
  constructor (ytext, remote, transaction) {
    super(ytext, remote, transaction)
    this._delta = null
  }
  // TODO: Should put this in a separate function. toDelta shouldn't be included
  //       in every Yjs distribution
  /**
   * Compute the changes in the delta format.
   *
   * @return {Delta} A {@link https://quilljs.com/docs/delta/|Quill Delta}) that
   *                 represents the changes on the document.
   *
   * @public
   */
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
            /**
             * @type {any}
             */
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
                const attr = attributes[item.key]
                if (attr !== undefined) {
                  if (attr !== item.value) {
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
          if (lastOp.retain !== undefined && lastOp.attributes === undefined) {
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

/**
 * Type that represents text with formatting information.
 *
 * This type replaces y-richtext as this implementation is able to handle
 * block formats (format information on a paragraph), embeds (complex elements
 * like pictures and videos), and text formats (**bold**, *italic*).
 *
 * @param {String} string The initial value of the YText.
 */
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

  /**
   * @private
   * Creates YMap Event and calls observers.
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YTextEvent(this, remote, transaction))
  }

  /**
   * Returns the unformatted string representation of this YText type.
   *
   * @public
   */
  toString () {
    let str = ''
    /**
     * @type {any}
     */
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
   * Apply a {@link Delta} on this shared YText type.
   *
   * @param {Delta} delta The changes to apply on this element.
   *
   * @public
   */
  applyDelta (delta) {
    this._transact(y => {
      let left = null
      let right = this._start
      const currentAttributes = new Map()
      for (let i = 0; i < delta.length; i++) {
        let op = delta[i]
        if (op.insert !== undefined) {
          ;[left, right] = insertText(y, op.insert, this, left, right, currentAttributes, op.attributes || {})
        } else if (op.retain !== undefined) {
          ;[left, right] = formatText(y, op.retain, this, left, right, currentAttributes, op.attributes || {})
        } else if (op.delete !== undefined) {
          ;[left, right] = deleteText(y, op.delete, this, left, right, currentAttributes)
        }
      }
    })
  }

  /**
   * Returns the Delta representation of this YText type.
   *
   * @return {Delta} The Delta representation of this type.
   *
   * @public
   */
  toDelta () {
    let ops = []
    let currentAttributes = new Map()
    let str = ''
    /**
     * @type {any}
     */
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

  /**
   * Insert text at a given index.
   *
   * @param {number} index The index at which to start inserting.
   * @param {String} text The text to insert at the specified position.
   * @param {TextAttributes} attributes Optionally define some formatting
   *                                    information to apply on the inserted
   *                                    Text.
   * @public
   */
  insert (index, text, attributes = {}) {
    if (text.length <= 0) {
      return
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index)
      insertText(y, text, this, left, right, currentAttributes, attributes)
    })
  }

  /**
   * Inserts an embed at a index.
   *
   * @param {number} index The index to insert the embed at.
   * @param {Object} embed The Object that represents the embed.
   * @param {TextAttributes} attributes Attribute information to apply on the
   *                                    embed
   *
   * @public
   */
  insertEmbed (index, embed, attributes = {}) {
    if (embed.constructor !== Object) {
      throw new Error('Embed must be an Object')
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index)
      insertText(y, embed, this, left, right, currentAttributes, attributes)
    })
  }

  /**
   * Deletes text starting from an index.
   *
   * @param {number} index Index at which to start deleting.
   * @param {number} length The number of characters to remove. Defaults to 1.
   *
   * @public
   */
  delete (index, length) {
    if (length === 0) {
      return
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index)
      deleteText(y, length, this, left, right, currentAttributes)
    })
  }

  /**
   * Assigns properties to a range of text.
   *
   * @param {number} index The position where to start formatting.
   * @param {number} length The amount of characters to assign properties to.
   * @param {TextAttributes} attributes Attribute information to apply on the
   *                                    text.
   *
   * @public
   */
  format (index, length, attributes) {
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index)
      if (right === null) {
        return
      }
      formatText(y, length, this, left, right, currentAttributes, attributes)
    })
  }
  // TODO: De-duplicate code. The following code is in every type.
  /**
   * Transform this YText to a readable format.
   * Useful for logging as all Items implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('YText', this)
  }
}
