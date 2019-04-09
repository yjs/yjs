/**
 * @module types
 */

import {
  YEvent,
  ItemEmbed,
  ItemString,
  ItemFormat,
  AbstractType,
  nextID,
  createID,
  getItemCleanStart,
  isVisible,
  YTextRefID,
  callTypeObservers,
  transact,
  Y, ItemType, AbstractItem, Snapshot, StructStore, Transaction // eslint-disable-line
} from '../internals.js'

import * as decoding from 'lib0/decoding.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js'

/**
 * @private
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @param {Map<string,any>} currentAttributes
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {number} count
 * @return {{left:AbstractItem|null,right:AbstractItem|null,currentAttributes:Map<string,any>}}
 */
const findNextPosition = (transaction, store, currentAttributes, left, right, count) => {
  while (right !== null && count > 0) {
    switch (right.constructor) {
      case ItemEmbed:
      case ItemString:
        if (!right.deleted) {
          if (count < right.length) {
            // split right
            getItemCleanStart(store, createID(right.id.client, right.id.clock + count))
          }
          count -= right.length
        }
        break
      case ItemFormat:
        if (!right.deleted) {
          // @ts-ignore right is ItemFormat
          updateCurrentAttributes(currentAttributes, right)
        }
        break
    }
    left = right
    right = right.right
  }
  return { left, right, currentAttributes }
}

/**
 * @private
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @return {{left:AbstractItem|null,right:AbstractItem|null,currentAttributes:Map<string,any>}}
 */
const findPosition = (transaction, store, parent, index) => {
  let currentAttributes = new Map()
  let left = null
  let right = parent._start
  return findNextPosition(transaction, store, currentAttributes, left, right, index)
}

/**
 * Negate applied formats
 *
 * @private
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {Map<string,any>} negatedAttributes
 * @return {{left:AbstractItem|null,right:AbstractItem|null}}
 */
const insertNegatedAttributes = (transaction, parent, left, right, negatedAttributes) => {
  // check if we really need to remove attributes
  while (
    right !== null && (
      right.deleted === true || (
        right.constructor === ItemFormat &&
        // @ts-ignore right is ItemFormat
        (negatedAttributes.get(right.key) === right.value)
      )
    )
  ) {
    if (!right.deleted) {
      // @ts-ignore right is ItemFormat
      negatedAttributes.delete(right.key)
    }
    left = right
    right = right.right
  }
  for (let [key, val] of negatedAttributes) {
    left = new ItemFormat(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, key, val)
    left.integrate(transaction)
  }
  return {left, right}
}

/**
 * @private
 * @param {Map<string,any>} currentAttributes
 * @param {ItemFormat} item
 */
const updateCurrentAttributes = (currentAttributes, item) => {
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
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {Object<string,any>} attributes
 * @return {{left:AbstractItem|null,right:AbstractItem|null}}
 */
const minimizeAttributeChanges = (left, right, currentAttributes, attributes) => {
  // go right while attributes[right.key] === right.value (or right is deleted)
  while (true) {
    if (right === null) {
      break
    } else if (right.deleted) {
      // continue
    // @ts-ignore right is ItemFormat
    } else if (right.constructor === ItemFormat && (attributes[right.key] || null) === right.value) {
      // found a format, update currentAttributes and continue
      // @ts-ignore right is ItemFormat
      updateCurrentAttributes(currentAttributes, right)
    } else {
      break
    }
    left = right
    right = right.right
  }
  return { left, right }
}

/**
 * @private
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {Object<string,any>} attributes
 * @return {{left:AbstractItem|null,right:AbstractItem|null,negatedAttributes:Map<string,any>}}
 **/
const insertAttributes = (transaction, parent, left, right, currentAttributes, attributes) => {
  const negatedAttributes = new Map()
  // insert format-start items
  for (let key in attributes) {
    const val = attributes[key]
    const currentVal = currentAttributes.get(key)
    if (currentVal !== val) {
      // save negated attribute (set null if currentVal undefined)
      negatedAttributes.set(key, currentVal || null)
      left = new ItemFormat(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, key, val)
      left.integrate(transaction)
    }
  }
  return { left, right, negatedAttributes }
}

/**
 * @private
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {string} text
 * @param {Object<string,any>} attributes
 * @return {{left:AbstractItem|null,right:AbstractItem|null}}
 **/
const insertText = (transaction, parent, left, right, currentAttributes, text, attributes) => {
  for (let [key] of currentAttributes) {
    if (attributes[key] === undefined) {
      attributes[key] = null
    }
  }
  const minPos = minimizeAttributeChanges(left, right, currentAttributes, attributes)
  const insertPos = insertAttributes(transaction, parent, minPos.left, minPos.right, currentAttributes, attributes)
  left = insertPos.left
  right = insertPos.right
  // insert content
  if (text.constructor === String) {
    left = new ItemString(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, text)
  } else {
    left = new ItemEmbed(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, text)
  }
  left.integrate(transaction)
  return insertNegatedAttributes(transaction, parent, left, insertPos.right, insertPos.negatedAttributes)
}

/**
 * @private
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {number} length
 * @param {Object<string,any>} attributes
 * @return {{left:AbstractItem|null,right:AbstractItem|null}}
 */
const formatText = (transaction, parent, left, right, currentAttributes, length, attributes) => {
  const minPos = minimizeAttributeChanges(left, right, currentAttributes, attributes)
  const insertPos = insertAttributes(transaction, parent, minPos.left, minPos.right, currentAttributes, attributes)
  const negatedAttributes = insertPos.negatedAttributes
  left = insertPos.left
  right = insertPos.right
  // iterate until first non-format or null is found
  // delete all formats with attributes[format.key] != null
  while (length > 0 && right !== null) {
    if (right.deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          // @ts-ignore right is ItemFormat
          const attr = attributes[right.key]
          if (attr !== undefined) {
            // @ts-ignore right is ItemFormat
            if (attr === right.value) {
              // @ts-ignore right is ItemFormat
              negatedAttributes.delete(right.key)
            } else {
              // @ts-ignore right is ItemFormat
              negatedAttributes.set(right.key, right.value)
            }
            right.delete(transaction)
          }
          // @ts-ignore right is ItemFormat
          updateCurrentAttributes(currentAttributes, right)
          break
        case ItemEmbed:
        case ItemString:
          if (length < right.length) {
            getItemCleanStart(transaction.y.store, createID(right.id.client, right.id.clock + length))
          }
          length -= right.length
          break
      }
    }
    left = right
    right = right.right
  }
  return insertNegatedAttributes(transaction, parent, left, right, negatedAttributes)
}

/**
 * @private
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {AbstractItem|null} left
 * @param {AbstractItem|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {number} length
 * @return {{left:AbstractItem|null,right:AbstractItem|null}}
 */
const deleteText = (transaction, parent, left, right, currentAttributes, length) => {
  while (length > 0 && right !== null) {
    if (right.deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          // @ts-ignore right is ItemFormat
          updateCurrentAttributes(currentAttributes, right)
          break
        case ItemEmbed:
        case ItemString:
          if (length < right.length) {
            getItemCleanStart(transaction.y.store, createID(right.id.client, right.id.clock + length))
          }
          length -= right.length
          right.delete(transaction)
          break
      }
    }
    left = right
    right = right.right
  }
  return { left, right }
}

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
class YTextEvent extends YEvent {
  /**
   * @param {YText} ytext
   * @param {Transaction} transaction
   */
  constructor (ytext, transaction) {
    super(ytext, transaction)
    /**
     * @type {Array<{delete:number|undefined,retain:number|undefined,insert:string|undefined,attributes:Object<string,any>}>|null}
     */
    this._delta = null
  }
  // TODO: Should put this in a separate function. toDelta shouldn't be included
  //       in every Yjs distribution
  /**
   * Compute the changes in the delta format.
   *
   * @type {Array<{delete:number|undefined,retain:number|undefined,insert:string|undefined,attributes:Object<string,any>}>} A {@link https://quilljs.com/docs/delta/|Quill Delta}) that
   *                 represents the changes on the document.
   *
   * @public
   */
  get delta () {
    if (this._delta === null) {
      const y = this.target._y
      // @ts-ignore
      transact(y, transaction => {
        /**
         * @type {Array<{delete:number|undefined,retain:number|undefined,insert:string|undefined,attributes:Object<string,any>}>}
         */
        const delta = []
        const currentAttributes = new Map() // saves all current attributes for insert
        const oldAttributes = new Map()
        let item = this.target._start
        /**
         * @type {string?}
         */
        let action = null
        /**
         * @type {Object<string,any>}
         */
        let attributes = {} // counts added or removed new attributes for retain
        let insert = ''
        let retain = 0
        let deleteLen = 0
        this._delta = delta
        const addOp = () => {
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
              if (this.adds(item)) {
                addOp()
                action = 'insert'
                // @ts-ignore item is ItemFormat
                insert = item.embed
                addOp()
              } else if (this.deletes(item)) {
                if (action !== 'delete') {
                  addOp()
                  action = 'delete'
                }
                deleteLen += 1
              } else if (!item.deleted) {
                if (action !== 'retain') {
                  addOp()
                  action = 'retain'
                }
                retain += 1
              }
              break
            case ItemString:
              if (this.adds(item)) {
                if (action !== 'insert') {
                  addOp()
                  action = 'insert'
                }
                // @ts-ignore
                insert += item.string
              } else if (this.deletes(item)) {
                if (action !== 'delete') {
                  addOp()
                  action = 'delete'
                }
                deleteLen += item.length
              } else if (!item.deleted) {
                if (action !== 'retain') {
                  addOp()
                  action = 'retain'
                }
                retain += item.length
              }
              break
            case ItemFormat:
              if (this.adds(item)) {
                // @ts-ignore item is ItemFormat
                const curVal = currentAttributes.get(item.key) || null
                // @ts-ignore item is ItemFormat
                if (curVal !== item.value) {
                  if (action === 'retain') {
                    addOp()
                  }
                  // @ts-ignore item is ItemFormat
                  if (item.value === (oldAttributes.get(item.key) || null)) {
                    // @ts-ignore item is ItemFormat
                    delete attributes[item.key]
                  } else {
                    // @ts-ignore item is ItemFormat
                    attributes[item.key] = item.value
                  }
                } else {
                  item.delete(transaction)
                }
              } else if (this.deletes(item)) {
                // @ts-ignore item is ItemFormat
                oldAttributes.set(item.key, item.value)
                // @ts-ignore item is ItemFormat
                const curVal = currentAttributes.get(item.key) || null
                // @ts-ignore item is ItemFormat
                if (curVal !== item.value) {
                  if (action === 'retain') {
                    addOp()
                  }
                  // @ts-ignore item is ItemFormat
                  attributes[item.key] = curVal
                }
              } else if (!item.deleted) {
                // @ts-ignore item is ItemFormat
                oldAttributes.set(item.key, item.value)
                // @ts-ignore item is ItemFormat
                const attr = attributes[item.key]
                if (attr !== undefined) {
                  // @ts-ignore item is ItemFormat
                  if (attr !== item.value) {
                    if (action === 'retain') {
                      addOp()
                    }
                    // @ts-ignore item is ItemFormat
                    if (item.value === null) {
                      // @ts-ignore item is ItemFormat
                      attributes[item.key] = item.value
                    } else {
                      // @ts-ignore item is ItemFormat
                      delete attributes[item.key]
                    }
                  } else {
                    item.delete(transaction)
                  }
                }
              }
              if (!item.deleted) {
                if (action === 'insert') {
                  addOp()
                }
                // @ts-ignore item is ItemFormat
                updateCurrentAttributes(currentAttributes, item)
              }
              break
          }
          item = item.right
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
    // @ts-ignore _delta is defined above
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
 * @extends AbstractType<YTextEvent>
 */
export class YText extends AbstractType {
  /**
   * @param {String} [string] The initial value of the YText.
   */
  constructor (string) {
    super()
    /**
     * @type {Array<string>?}
     */
    this._prelimContent = string !== undefined ? [string] : []
  }

  get length () {
    return this._length
  }

  /**
   * @param {Y} y
   * @param {ItemType} item
   */
  _integrate (y, item) {
    super._integrate(y, item)
    // @ts-ignore this._prelimContent is still defined
    this.insert(0, this._prelimContent.join(''))
    this._prelimContent = null
  }

  /**
   * Creates YTextEvent and calls observers.
   * @private
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    callTypeObservers(this, transaction, new YTextEvent(this, transaction))
  }

  toDom () {
    return document.createTextNode(this.toString())
  }

  /**
   * Returns the unformatted string representation of this YText type.
   *
   * @public
   */
  toString () {
    let str = ''
    /**
     * @type {AbstractItem|null}
     */
    let n = this._start
    while (n !== null) {
      if (!n.deleted && n.countable && n.constructor === ItemString) {
        // @ts-ignore
        str += n.string
      }
      n = n.right
    }
    return str
  }

  toDomString () {
    // @ts-ignore
    return this.toDelta().map(delta => {
      const nestedNodes = []
      for (let nodeName in delta.attributes) {
        const attrs = []
        for (let key in delta.attributes[nodeName]) {
          attrs.push({ key, value: delta.attributes[nodeName][key] })
        }
        // sort attributes to get a unique order
        attrs.sort((a, b) => a.key < b.key ? -1 : 1)
        nestedNodes.push({ nodeName, attrs })
      }
      // sort node order to get a unique order
      nestedNodes.sort((a, b) => a.nodeName < b.nodeName ? -1 : 1)
      // now convert to dom string
      let str = ''
      for (let i = 0; i < nestedNodes.length; i++) {
        const node = nestedNodes[i]
        str += `<${node.nodeName}`
        for (let j = 0; j < node.attrs.length; j++) {
          const attr = node.attrs[i]
          str += ` ${attr.key}="${attr.value}"`
        }
        str += '>'
      }
      str += delta.insert
      for (let i = nestedNodes.length - 1; i >= 0; i--) {
        str += `</${nestedNodes[i].nodeName}>`
      }
      return str
    })
  }

  /**
   * Apply a {@link Delta} on this shared YText type.
   *
   * @param {any} delta The changes to apply on this element.
   *
   * @public
   */
  applyDelta (delta) {
    if (this._y !== null) {
      transact(this._y, transaction => {
        /**
         * @type {{left:AbstractItem|null,right:AbstractItem|null}}
         */
        let pos = { left: null, right: this._start }
        const currentAttributes = new Map()
        for (let i = 0; i < delta.length; i++) {
          const op = delta[i]
          if (op.insert !== undefined) {
            pos = insertText(transaction, this, pos.left, pos.right, currentAttributes, op.insert, op.attributes || {})
          } else if (op.retain !== undefined) {
            pos = formatText(transaction, this, pos.left, pos.right, currentAttributes, op.retain, op.attributes || {})
          } else if (op.delete !== undefined) {
            pos = deleteText(transaction, this, pos.left, pos.right, currentAttributes, op.delete)
          }
        }
      })
    }
  }

  /**
   * Returns the Delta representation of this YText type.
   *
   * @param {Snapshot} [snapshot]
   * @param {Snapshot} [prevSnapshot]
   * @return {any} The Delta representation of this type.
   *
   * @public
   */
  toDelta (snapshot, prevSnapshot) {
    /**
     * @type{Array<any>}
     */
    const ops = []
    const currentAttributes = new Map()
    let str = ''
    /**
     * @type {AbstractItem|null}
     */
    // @ts-ignore
    let n = this._start
    function packStr () {
      if (str.length > 0) {
        // pack str with attributes to ops
        /**
         * @type {Object<string,any>}
         */
        const attributes = {}
        let addAttributes = false
        for (let [key, value] of currentAttributes) {
          addAttributes = true
          attributes[key] = value
        }
        /**
         * @type {Object<string,any>}
         */
        const op = { insert: str }
        if (addAttributes) {
          op.attributes = attributes
        }
        ops.push(op)
        str = ''
      }
    }
    while (n !== null) {
      if (isVisible(n, snapshot) || (prevSnapshot !== undefined && isVisible(n, prevSnapshot))) {
        switch (n.constructor) {
          case ItemString:
            const cur = currentAttributes.get('ychange')
            if (snapshot !== undefined && !isVisible(n, snapshot)) {
              if (cur === undefined || cur.user !== n.id.client || cur.state !== 'removed') {
                packStr()
                currentAttributes.set('ychange', { user: n.id.client, state: 'removed' })
              }
            } else if (prevSnapshot !== undefined && !isVisible(n, prevSnapshot)) {
              if (cur === undefined || cur.user !== n.id.client || cur.state !== 'added') {
                packStr()
                currentAttributes.set('ychange', { user: n.id.client, state: 'added' })
              }
            } else if (cur !== undefined) {
              packStr()
              currentAttributes.delete('ychange')
            }
            // @ts-ignore
            str += n.string
            break
          case ItemFormat:
            packStr()
            // @ts-ignore
            updateCurrentAttributes(currentAttributes, n)
            break
        }
      }
      n = n.right
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
    const y = this._y
    if (y !== null) {
      transact(y, transaction => {
        const {left, right, currentAttributes} = findPosition(transaction, y.store, this, index)
        insertText(transaction, this, left, right, currentAttributes, text, attributes)
      })
    }
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
    const y = this._y
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, y.store, this, index)
        insertText(transaction, this, left, right, currentAttributes, embed, attributes)
      })
    }
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
    const y = this._y
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, y.store, this, index)
        deleteText(transaction, this, left, right, currentAttributes, length)
      })
    }
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
    const y = this._y
    if (y !== null) {
      transact(y, transaction => {
        let { left, right, currentAttributes } = findPosition(transaction, y.store, this, index)
        if (right === null) {
          return
        }
        formatText(transaction, this, left, right, currentAttributes, length, attributes)
      })
    }
  }

  /**
   * @param {encoding.Encoder} encoder
   */
  _write (encoder) {
    encoding.writeVarUint(encoder, YTextRefID)
  }
}

/**
 * @param {decoding.Decoder} decoder
 * @return {YText}
 */
export const readYText = decoder => new YText()
