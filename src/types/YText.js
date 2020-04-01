
/**
 * @module YText
 */

import {
  YEvent,
  AbstractType,
  nextID,
  createID,
  getItemCleanStart,
  isVisible,
  YTextRefID,
  callTypeObservers,
  transact,
  ContentEmbed,
  ContentFormat,
  ContentString,
  splitSnapshotAffectedStructs,
  ID, Doc, Item, Snapshot, Transaction // eslint-disable-line
} from '../internals.js'

import * as decoding from 'lib0/decoding.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js'
import * as object from 'lib0/object.js'

/**
 * @param {any} a
 * @param {any} b
 * @return {boolean}
 */
const equalAttrs = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b && object.equalFlat(a, b))

export class ItemListPosition {
  /**
   * @param {Item|null} left
   * @param {Item|null} right
   */
  constructor (left, right) {
    this.left = left
    this.right = right
  }
}

export class ItemTextListPosition extends ItemListPosition {
  /**
   * @param {Item|null} left
   * @param {Item|null} right
   * @param {Map<string,any>} currentAttributes
   */
  constructor (left, right, currentAttributes) {
    super(left, right)
    this.currentAttributes = currentAttributes
  }
}

export class ItemInsertionResult extends ItemListPosition {
  /**
   * @param {Item|null} left
   * @param {Item|null} right
   * @param {Map<string,any>} negatedAttributes
   */
  constructor (left, right, negatedAttributes) {
    super(left, right)
    this.negatedAttributes = negatedAttributes
  }
}

/**
 * @param {Transaction} transaction
 * @param {Map<string,any>} currentAttributes
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {number} count
 * @return {ItemTextListPosition}
 *
 * @private
 * @function
 */
const findNextPosition = (transaction, currentAttributes, left, right, count) => {
  while (right !== null && count > 0) {
    switch (right.content.constructor) {
      case ContentEmbed:
      case ContentString:
        if (!right.deleted) {
          if (count < right.length) {
            // split right
            getItemCleanStart(transaction, createID(right.id.client, right.id.clock + count))
          }
          count -= right.length
        }
        break
      case ContentFormat:
        if (!right.deleted) {
          updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (right.content))
        }
        break
    }
    left = right
    right = right.right
  }
  return new ItemTextListPosition(left, right, currentAttributes)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @return {ItemTextListPosition}
 *
 * @private
 * @function
 */
const findPosition = (transaction, parent, index) => {
  const currentAttributes = new Map()
  const right = parent._start
  return findNextPosition(transaction, currentAttributes, null, right, index)
}

/**
 * Negate applied formats
 *
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {Map<string,any>} negatedAttributes
 * @return {ItemListPosition}
 *
 * @private
 * @function
 */
const insertNegatedAttributes = (transaction, parent, left, right, negatedAttributes) => {
  // check if we really need to remove attributes
  while (
    right !== null && (
      right.deleted === true || (
        right.content.constructor === ContentFormat &&
        equalAttrs(negatedAttributes.get(/** @type {ContentFormat} */ (right.content).key), /** @type {ContentFormat} */ (right.content).value)
      )
    )
  ) {
    if (!right.deleted) {
      negatedAttributes.delete(/** @type {ContentFormat} */ (right.content).key)
    }
    left = right
    right = right.right
  }
  for (const [key, val] of negatedAttributes) {
    left = new Item(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, new ContentFormat(key, val))
    left.integrate(transaction)
  }
  return { left, right }
}

/**
 * @param {Map<string,any>} currentAttributes
 * @param {ContentFormat} format
 *
 * @private
 * @function
 */
const updateCurrentAttributes = (currentAttributes, format) => {
  const { key, value } = format
  if (value === null) {
    currentAttributes.delete(key)
  } else {
    currentAttributes.set(key, value)
  }
}

/**
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {Object<string,any>} attributes
 * @return {ItemListPosition}
 *
 * @private
 * @function
 */
const minimizeAttributeChanges = (left, right, currentAttributes, attributes) => {
  // go right while attributes[right.key] === right.value (or right is deleted)
  while (true) {
    if (right === null) {
      break
    } else if (right.deleted) {
      // continue
    } else if (right.content.constructor === ContentFormat && equalAttrs(attributes[(/** @type {ContentFormat} */ (right.content)).key] || null, /** @type {ContentFormat} */ (right.content).value)) {
      // found a format, update currentAttributes and continue
      updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (right.content))
    } else {
      break
    }
    left = right
    right = right.right
  }
  return new ItemListPosition(left, right)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {Object<string,any>} attributes
 * @return {ItemInsertionResult}
 *
 * @private
 * @function
 **/
const insertAttributes = (transaction, parent, left, right, currentAttributes, attributes) => {
  const negatedAttributes = new Map()
  // insert format-start items
  for (const key in attributes) {
    const val = attributes[key]
    const currentVal = currentAttributes.get(key) || null
    if (!equalAttrs(currentVal, val)) {
      // save negated attribute (set null if currentVal undefined)
      negatedAttributes.set(key, currentVal)
      left = new Item(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, new ContentFormat(key, val))
      left.integrate(transaction)
    }
  }
  return new ItemInsertionResult(left, right, negatedAttributes)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {string|object} text
 * @param {Object<string,any>} attributes
 * @return {ItemListPosition}
 *
 * @private
 * @function
 **/
const insertText = (transaction, parent, left, right, currentAttributes, text, attributes) => {
  for (const [key] of currentAttributes) {
    if (attributes[key] === undefined) {
      attributes[key] = null
    }
  }
  const minPos = minimizeAttributeChanges(left, right, currentAttributes, attributes)
  const insertPos = insertAttributes(transaction, parent, minPos.left, minPos.right, currentAttributes, attributes)
  left = insertPos.left
  right = insertPos.right
  // insert content
  const content = text.constructor === String ? new ContentString(/** @type {string} */ (text)) : new ContentEmbed(text)
  left = new Item(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, content)
  left.integrate(transaction)
  return insertNegatedAttributes(transaction, parent, left, insertPos.right, insertPos.negatedAttributes)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {number} length
 * @param {Object<string,any>} attributes
 * @return {ItemListPosition}
 *
 * @private
 * @function
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
    if (!right.deleted) {
      switch (right.content.constructor) {
        case ContentFormat: {
          const { key, value } = /** @type {ContentFormat} */ (right.content)
          const attr = attributes[key]
          if (attr !== undefined) {
            if (equalAttrs(attr, value)) {
              negatedAttributes.delete(key)
            } else {
              negatedAttributes.set(key, value)
            }
            right.delete(transaction)
          }
          updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (right.content))
          break
        }
        case ContentEmbed:
        case ContentString:
          if (length < right.length) {
            getItemCleanStart(transaction, createID(right.id.client, right.id.clock + length))
          }
          length -= right.length
          break
      }
    }
    left = right
    right = right.right
  }
  // Quill just assumes that the editor starts with a newline and that it always
  // ends with a newline. We only insert that newline when a new newline is
  // inserted - i.e when length is bigger than type.length
  if (length > 0) {
    let newlines = ''
    for (; length > 0; length--) {
      newlines += '\n'
    }
    left = new Item(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, new ContentString(newlines))
    left.integrate(transaction)
  }
  return insertNegatedAttributes(transaction, parent, left, right, negatedAttributes)
}

/**
 * @param {Transaction} transaction
 * @param {Item|null} left
 * @param {Item|null} right
 * @param {Map<string,any>} currentAttributes
 * @param {number} length
 * @return {ItemListPosition}
 *
 * @private
 * @function
 */
const deleteText = (transaction, left, right, currentAttributes, length) => {
  while (length > 0 && right !== null) {
    if (right.deleted === false) {
      switch (right.content.constructor) {
        case ContentFormat:
          updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (right.content))
          break
        case ContentEmbed:
        case ContentString:
          if (length < right.length) {
            getItemCleanStart(transaction, createID(right.id.client, right.id.clock + length))
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
 * @typedef {Object} DeltaItem
 * @property {number|undefined} DeltaItem.delete
 * @property {number|undefined} DeltaItem.retain
 * @property {string|undefined} DeltaItem.string
 * @property {Object<string,any>} DeltaItem.attributes
 */

/**
 * Event that describes the changes on a YText type.
 */
export class YTextEvent extends YEvent {
  /**
   * @param {YText} ytext
   * @param {Transaction} transaction
   */
  constructor (ytext, transaction) {
    super(ytext, transaction)
    /**
     * @type {Array<DeltaItem>|null}
     */
    this._delta = null
  }

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {Array<DeltaItem>}
   *
   * @public
   */
  get delta () {
    if (this._delta === null) {
      const y = /** @type {Doc} */ (this.target.doc)
      this._delta = []
      transact(y, transaction => {
        const delta = /** @type {Array<DeltaItem>} */ (this._delta)
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
        const attributes = {} // counts added or removed new attributes for retain
        /**
         * @type {string|object}
         */
        let insert = ''
        let retain = 0
        let deleteLen = 0
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
                  for (const [key, value] of currentAttributes) {
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
                  for (const key in attributes) {
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
          switch (item.content.constructor) {
            case ContentEmbed:
              if (this.adds(item)) {
                if (!this.deletes(item)) {
                  addOp()
                  action = 'insert'
                  insert = /** @type {ContentEmbed} */ (item.content).embed
                  addOp()
                }
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
            case ContentString:
              if (this.adds(item)) {
                if (!this.deletes(item)) {
                  if (action !== 'insert') {
                    addOp()
                    action = 'insert'
                  }
                  insert += /** @type {ContentString} */ (item.content).str
                }
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
            case ContentFormat: {
              const { key, value } = /** @type {ContentFormat} */ (item.content)
              if (this.adds(item)) {
                if (!this.deletes(item)) {
                  const curVal = currentAttributes.get(key) || null
                  if (!equalAttrs(curVal, value)) {
                    if (action === 'retain') {
                      addOp()
                    }
                    if (equalAttrs(value, (oldAttributes.get(key) || null))) {
                      delete attributes[key]
                    } else {
                      attributes[key] = value
                    }
                  } else {
                    item.delete(transaction)
                  }
                }
              } else if (this.deletes(item)) {
                oldAttributes.set(key, value)
                const curVal = currentAttributes.get(key) || null
                if (!equalAttrs(curVal, value)) {
                  if (action === 'retain') {
                    addOp()
                  }
                  attributes[key] = curVal
                }
              } else if (!item.deleted) {
                oldAttributes.set(key, value)
                const attr = attributes[key]
                if (attr !== undefined) {
                  if (!equalAttrs(attr, value)) {
                    if (action === 'retain') {
                      addOp()
                    }
                    if (value === null) {
                      attributes[key] = value
                    } else {
                      delete attributes[key]
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
                updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (item.content))
              }
              break
            }
          }
          item = item.right
        }
        addOp()
        while (delta.length > 0) {
          const lastOp = delta[delta.length - 1]
          if (lastOp.retain !== undefined && lastOp.attributes === undefined) {
            // retain delta's if they don't assign attributes
            delta.pop()
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
 * @extends AbstractType<YTextEvent>
 */
export class YText extends AbstractType {
  /**
   * @param {String} [string] The initial value of the YText.
   */
  constructor (string) {
    super()
    /**
     * Array of pending operations on this type
     * @type {Array<function():void>?}
     */
    this._pending = string !== undefined ? [() => this.insert(0, string)] : []
  }

  /**
   * Number of characters of this text type.
   *
   * @type {number}
   */
  get length () {
    return this._length
  }

  /**
   * @param {Doc} y
   * @param {Item} item
   */
  _integrate (y, item) {
    super._integrate(y, item)
    try {
      /** @type {Array<function>} */ (this._pending).forEach(f => f())
    } catch (e) {
      console.error(e)
    }
    this._pending = null
  }

  _copy () {
    return new YText()
  }

  /**
   * Creates YTextEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    callTypeObservers(this, transaction, new YTextEvent(this, transaction))
  }

  /**
   * Returns the unformatted string representation of this YText type.
   *
   * @public
   */
  toString () {
    let str = ''
    /**
     * @type {Item|null}
     */
    let n = this._start
    while (n !== null) {
      if (!n.deleted && n.countable && n.content.constructor === ContentString) {
        str += /** @type {ContentString} */ (n.content).str
      }
      n = n.right
    }
    return str
  }

  /**
   * Returns the unformatted string representation of this YText type.
   *
   * @return {string}
   * @public
   */
  toJSON () {
    return this.toString()
  }

  /**
   * Apply a {@link Delta} on this shared YText type.
   *
   * @param {any} delta The changes to apply on this element.
   *
   * @public
   */
  applyDelta (delta) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        /**
         * @type {ItemListPosition}
         */
        let pos = new ItemListPosition(null, this._start)
        const currentAttributes = new Map()
        for (let i = 0; i < delta.length; i++) {
          const op = delta[i]
          if (op.insert !== undefined) {
            // Quill assumes that the content starts with an empty paragraph.
            // Yjs/Y.Text assumes that it starts empty. We always hide that
            // there is a newline at the end of the content.
            // If we omit this step, clients will see a different number of
            // paragraphs, but nothing bad will happen.
            const ins = (typeof op.insert === 'string' && i === delta.length - 1 && pos.right === null && op.insert.slice(-1) === '\n') ? op.insert.slice(0, -1) : op.insert
            if (typeof ins !== 'string' || ins.length > 0) {
              pos = insertText(transaction, this, pos.left, pos.right, currentAttributes, ins, op.attributes || {})
            }
          } else if (op.retain !== undefined) {
            pos = formatText(transaction, this, pos.left, pos.right, currentAttributes, op.retain, op.attributes || {})
          } else if (op.delete !== undefined) {
            pos = deleteText(transaction, pos.left, pos.right, currentAttributes, op.delete)
          }
        }
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.applyDelta(delta))
    }
  }

  /**
   * Returns the Delta representation of this YText type.
   *
   * @param {Snapshot} [snapshot]
   * @param {Snapshot} [prevSnapshot]
   * @param {function('removed' | 'added', ID):any} [computeYChange]
   * @return {any} The Delta representation of this type.
   *
   * @public
   */
  toDelta (snapshot, prevSnapshot, computeYChange) {
    /**
     * @type{Array<any>}
     */
    const ops = []
    const currentAttributes = new Map()
    const doc = /** @type {Doc} */ (this.doc)
    let str = ''
    let n = this._start
    function packStr () {
      if (str.length > 0) {
        // pack str with attributes to ops
        /**
         * @type {Object<string,any>}
         */
        const attributes = {}
        let addAttributes = false
        for (const [key, value] of currentAttributes) {
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
    // snapshots are merged again after the transaction, so we need to keep the
    // transalive until we are done
    transact(doc, transaction => {
      if (snapshot) {
        splitSnapshotAffectedStructs(transaction, snapshot)
      }
      if (prevSnapshot) {
        splitSnapshotAffectedStructs(transaction, prevSnapshot)
      }
      while (n !== null) {
        if (isVisible(n, snapshot) || (prevSnapshot !== undefined && isVisible(n, prevSnapshot))) {
          switch (n.content.constructor) {
            case ContentString: {
              const cur = currentAttributes.get('ychange')
              if (snapshot !== undefined && !isVisible(n, snapshot)) {
                if (cur === undefined || cur.user !== n.id.client || cur.state !== 'removed') {
                  packStr()
                  currentAttributes.set('ychange', computeYChange ? computeYChange('removed', n.id) : { type: 'removed' })
                }
              } else if (prevSnapshot !== undefined && !isVisible(n, prevSnapshot)) {
                if (cur === undefined || cur.user !== n.id.client || cur.state !== 'added') {
                  packStr()
                  currentAttributes.set('ychange', computeYChange ? computeYChange('added', n.id) : { type: 'added' })
                }
              } else if (cur !== undefined) {
                packStr()
                currentAttributes.delete('ychange')
              }
              str += /** @type {ContentString} */ (n.content).str
              break
            }
            case ContentEmbed: {
              packStr()
              /**
               * @type {Object<string,any>}
               */
              const op = {
                insert: /** @type {ContentEmbed} */ (n.content).embed
              }
              if (currentAttributes.size > 0) {
                const attrs = /** @type {Object<string,any>} */ ({})
                op.attributes = attrs
                for (const [key, value] of currentAttributes) {
                  attrs[key] = value
                }
              }
              ops.push(op)
              break
            }
            case ContentFormat:
              if (isVisible(n, snapshot)) {
                packStr()
                updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (n.content))
              }
              break
          }
        }
        n = n.right
      }
      packStr()
    }, splitSnapshotAffectedStructs)
    return ops
  }

  /**
   * Insert text at a given index.
   *
   * @param {number} index The index at which to start inserting.
   * @param {String} text The text to insert at the specified position.
   * @param {TextAttributes} [attributes] Optionally define some formatting
   *                                    information to apply on the inserted
   *                                    Text.
   * @public
   */
  insert (index, text, attributes) {
    if (text.length <= 0) {
      return
    }
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, this, index)
        if (!attributes) {
          attributes = {}
          // @ts-ignore
          currentAttributes.forEach((v, k) => { attributes[k] = v })
        }
        insertText(transaction, this, left, right, currentAttributes, text, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.insert(index, text, attributes))
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
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, this, index)
        insertText(transaction, this, left, right, currentAttributes, embed, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.insertEmbed(index, embed, attributes))
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
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, this, index)
        deleteText(transaction, left, right, currentAttributes, length)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.delete(index, length))
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
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, this, index)
        if (right === null) {
          return
        }
        formatText(transaction, this, left, right, currentAttributes, length, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.format(index, length, attributes))
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
 *
 * @private
 * @function
 */
export const readYText = decoder => new YText()
