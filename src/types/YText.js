
/**
 * @module YText
 */

import {
  YEvent,
  AbstractType,
  getItemCleanStart,
  getState,
  isVisible,
  createID,
  YTextRefID,
  callTypeObservers,
  transact,
  ContentEmbed,
  GC,
  ContentFormat,
  ContentString,
  splitSnapshotAffectedStructs,
  iterateDeletedStructs,
  iterateStructs,
  ID, Doc, Item, Snapshot, Transaction // eslint-disable-line
} from '../internals.js'

import * as decoding from 'lib0/decoding.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js'
import * as object from 'lib0/object.js'
import * as map from 'lib0/map.js'

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
 * @param {ItemListPosition} currPos
 * @param {Map<string,any>} negatedAttributes
 *
 * @private
 * @function
 */
const insertNegatedAttributes = (transaction, parent, currPos, negatedAttributes) => {
  let { left, right } = currPos
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
  const doc = transaction.doc
  const ownClientId = doc.clientID
  for (const [key, val] of negatedAttributes) {
    left = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val))
    left.integrate(transaction, 0)
  }
  currPos.left = left
  currPos.right = right
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
 * @param {ItemListPosition} currPos
 * @param {Map<string,any>} currentAttributes
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 */
const minimizeAttributeChanges = (currPos, currentAttributes, attributes) => {
  // go right while attributes[right.key] === right.value (or right is deleted)
  let { left, right } = currPos
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
  currPos.left = left
  currPos.right = right
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemListPosition} currPos
 * @param {Map<string,any>} currentAttributes
 * @param {Object<string,any>} attributes
 * @return {Map<string,any>}
 *
 * @private
 * @function
 **/
const insertAttributes = (transaction, parent, currPos, currentAttributes, attributes) => {
  const doc = transaction.doc
  const ownClientId = doc.clientID
  const negatedAttributes = new Map()
  // insert format-start items
  for (const key in attributes) {
    const val = attributes[key]
    const currentVal = currentAttributes.get(key) || null
    if (!equalAttrs(currentVal, val)) {
      // save negated attribute (set null if currentVal undefined)
      negatedAttributes.set(key, currentVal)
      const { left, right } = currPos
      currPos.left = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val))
      currPos.left.integrate(transaction, 0)
    }
  }
  return negatedAttributes
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemListPosition} currPos
 * @param {Map<string,any>} currentAttributes
 * @param {string|object} text
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 **/
const insertText = (transaction, parent, currPos, currentAttributes, text, attributes) => {
  for (const [key] of currentAttributes) {
    if (attributes[key] === undefined) {
      attributes[key] = null
    }
  }
  const doc = transaction.doc
  const ownClientId = doc.clientID
  minimizeAttributeChanges(currPos, currentAttributes, attributes)
  const negatedAttributes = insertAttributes(transaction, parent, currPos, currentAttributes, attributes)
  // insert content
  const content = text.constructor === String ? new ContentString(/** @type {string} */ (text)) : new ContentEmbed(text)
  const { left, right } = currPos
  currPos.left = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, content)
  currPos.left.integrate(transaction, 0)
  return insertNegatedAttributes(transaction, parent, currPos, negatedAttributes)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemListPosition} currPos
 * @param {Map<string,any>} currentAttributes
 * @param {number} length
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 */
const formatText = (transaction, parent, currPos, currentAttributes, length, attributes) => {
  const doc = transaction.doc
  const ownClientId = doc.clientID
  minimizeAttributeChanges(currPos, currentAttributes, attributes)
  const negatedAttributes = insertAttributes(transaction, parent, currPos, currentAttributes, attributes)
  let { left, right } = currPos
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
    left = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentString(newlines))
    left.integrate(transaction, 0)
  }
  currPos.left = left
  currPos.right = right
  insertNegatedAttributes(transaction, parent, currPos, negatedAttributes)
}

/**
 * Call this function after string content has been deleted in order to
 * clean up formatting Items.
 *
 * @param {Transaction} transaction
 * @param {Item} start
 * @param {Item|null} end exclusive end, automatically iterates to the next Content Item
 * @param {Map<string,any>} startAttributes
 * @param {Map<string,any>} endAttributes This attribute is modified!
 * @return {number} The amount of formatting Items deleted.
 *
 * @function
 */
const cleanupFormattingGap = (transaction, start, end, startAttributes, endAttributes) => {
  while (end && end.content.constructor !== ContentString && end.content.constructor !== ContentEmbed) {
    if (!end.deleted && end.content.constructor === ContentFormat) {
      updateCurrentAttributes(endAttributes, /** @type {ContentFormat} */ (end.content))
    }
    end = end.right
  }
  let cleanups = 0
  while (start !== end) {
    if (!start.deleted) {
      const content = start.content
      switch (content.constructor) {
        case ContentFormat: {
          const { key, value } = /** @type {ContentFormat} */ (content)
          if ((endAttributes.get(key) || null) !== value || (startAttributes.get(key) || null) === value) {
            // Either this format is overwritten or it is not necessary because the attribute already existed.
            start.delete(transaction)
            cleanups++
          }
          break
        }
      }
    }
    start = /** @type {Item} */ (start.right)
  }
  return cleanups
}

/**
 * @param {Transaction} transaction
 * @param {Item | null} item
 */
const cleanupContextlessFormattingGap = (transaction, item) => {
  // iterate until item.right is null or content
  while (item && item.right && (item.right.deleted || (item.right.content.constructor !== ContentString && item.right.content.constructor !== ContentEmbed))) {
    item = item.right
  }
  const attrs = new Set()
  // iterate back until a content item is found
  while (item && (item.deleted || (item.content.constructor !== ContentString && item.content.constructor !== ContentEmbed))) {
    if (!item.deleted && item.content.constructor === ContentFormat) {
      const key = /** @type {ContentFormat} */ (item.content).key
      if (attrs.has(key)) {
        item.delete(transaction)
      } else {
        attrs.add(key)
      }
    }
    item = item.left
  }
}

/**
 * This function is experimental and subject to change / be removed.
 *
 * Ideally, we don't need this function at all. Formatting attributes should be cleaned up
 * automatically after each change. This function iterates twice over the complete YText type
 * and removes unnecessary formatting attributes. This is also helpful for testing.
 *
 * This function won't be exported anymore as soon as there is confidence that the YText type works as intended.
 *
 * @param {YText} type
 * @return {number} How many formatting attributes have been cleaned up.
 */
export const cleanupYTextFormatting = type => {
  let res = 0
  transact(/** @type {Doc} */ (type.doc), transaction => {
    let start = /** @type {Item} */ (type._start)
    let end = type._start
    let startAttributes = map.create()
    const currentAttributes = map.copy(startAttributes)
    while (end) {
      if (end.deleted === false) {
        switch (end.content.constructor) {
          case ContentFormat:
            updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (end.content))
            break
          case ContentEmbed:
          case ContentString:
            res += cleanupFormattingGap(transaction, start, end, startAttributes, currentAttributes)
            startAttributes = map.copy(currentAttributes)
            start = end
            break
        }
      }
      end = end.right
    }
  })
  return res
}

/**
 * @param {Transaction} transaction
 * @param {ItemListPosition} currPos
 * @param {Map<string,any>} currentAttributes
 * @param {number} length
 * @return {ItemListPosition}
 *
 * @private
 * @function
 */
const deleteText = (transaction, currPos, currentAttributes, length) => {
  const startAttrs = map.copy(currentAttributes)
  const start = currPos.right
  let { left, right } = currPos
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
  if (start) {
    cleanupFormattingGap(transaction, start, right, startAttrs, map.copy(currentAttributes))
  }
  currPos.left = left
  currPos.right = right
  return currPos
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
    const event = new YTextEvent(this, transaction)
    const doc = transaction.doc
    // If a remote change happened, we try to cleanup potential formatting duplicates.
    if (!transaction.local) {
      // check if another formatting item was inserted
      let foundFormattingItem = false
      for (const [client, afterClock] of transaction.afterState) {
        const clock = transaction.beforeState.get(client) || 0
        if (afterClock === clock) {
          continue
        }
        iterateStructs(transaction, /** @type {Array<Item|GC>} */ (doc.store.clients.get(client)), clock, afterClock, item => {
          // @ts-ignore
          if (!item.deleted && item.content.constructor === ContentFormat) {
            foundFormattingItem = true
          }
        })
        if (foundFormattingItem) {
          break
        }
      }
      transact(doc, t => {
        if (foundFormattingItem) {
          // If a formatting item was inserted, we simply clean the whole type.
          // We need to compute currentAttributes for the current position anyway.
          cleanupYTextFormatting(this)
        } else {
          // If no formatting attribute was inserted, we can make due with contextless
          // formatting cleanups.
          // Contextless: it is not necessary to compute currentAttributes for the affected position.
          iterateDeletedStructs(t, transaction.deleteSet, item => {
            if (item instanceof GC) {
              return
            }
            if (item.parent === this) {
              cleanupContextlessFormattingGap(t, item)
            }
          })
        }
      })
    }
    callTypeObservers(this, transaction, event)
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
   * @param {object}  [opts]
   * @param {boolean} [opts.sanitize] Sanitize input delta. Removes ending newlines if set to true.
   *
   *
   * @public
   */
  applyDelta (delta, { sanitize = true } = {}) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        /**
         * @type {ItemListPosition}
         */
        const currPos = new ItemListPosition(null, this._start)
        const currentAttributes = new Map()
        for (let i = 0; i < delta.length; i++) {
          const op = delta[i]
          if (op.insert !== undefined) {
            // Quill assumes that the content starts with an empty paragraph.
            // Yjs/Y.Text assumes that it starts empty. We always hide that
            // there is a newline at the end of the content.
            // If we omit this step, clients will see a different number of
            // paragraphs, but nothing bad will happen.
            const ins = (!sanitize && typeof op.insert === 'string' && i === delta.length - 1 && currPos.right === null && op.insert.slice(-1) === '\n') ? op.insert.slice(0, -1) : op.insert
            if (typeof ins !== 'string' || ins.length > 0) {
              insertText(transaction, this, currPos, currentAttributes, ins, op.attributes || {})
            }
          } else if (op.retain !== undefined) {
            formatText(transaction, this, currPos, currentAttributes, op.retain, op.attributes || {})
          } else if (op.delete !== undefined) {
            deleteText(transaction, currPos, currentAttributes, op.delete)
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
   * @return {YText} Instance of the YText.
   * @public
   */
  insert (index, text, attributes) {
    if (text.length <= 0) {
      return this
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
        insertText(transaction, this, new ItemListPosition(left, right), currentAttributes, text, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.insert(index, text, attributes))
    }
    return this
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
        insertText(transaction, this, new ItemListPosition(left, right), currentAttributes, embed, attributes)
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
   * @return {YText} Instance of the YText.
   *
   * @public
   */
  delete (index, length) {
    if (length === 0) {
      return this
    }
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, this, index)
        deleteText(transaction, new ItemListPosition(left, right), currentAttributes, length)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.delete(index, length))
    }
    return this
  }

  /**
   * Assigns properties to a range of text.
   *
   * @param {number} index The position where to start formatting.
   * @param {number} length The amount of characters to assign properties to.
   * @param {TextAttributes} attributes Attribute information to apply on the
   *                                    text.
   * @return {YText} Instance of the YText.
   *
   * @public
   */
  format (index, length, attributes) {
    if (length === 0) {
      return this
    }
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const { left, right, currentAttributes } = findPosition(transaction, this, index)
        if (right === null) {
          return
        }
        formatText(transaction, this, new ItemListPosition(left, right), currentAttributes, length, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.format(index, length, attributes))
    }
    return this
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
