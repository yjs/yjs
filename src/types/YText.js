
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
  typeMapDelete,
  typeMapSet,
  typeMapGet,
  typeMapGetAll,
  updateMarkerChanges,
  ContentType,
  useSearchMarker,
  findIndexCleanStart,
  ListIterator, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, ID, Doc, Item, Snapshot, Transaction // eslint-disable-line
} from '../internals.js'

import * as object from 'lib0/object'
import * as map from 'lib0/map'
import * as error from 'lib0/error'

/**
 * @param {any} a
 * @param {any} b
 * @return {boolean}
 */
const equalAttrs = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b && object.equalFlat(a, b))

export class ItemTextListPosition {
  /**
   * @param {Item|null} left
   * @param {Item|null} right
   * @param {number} index
   * @param {Map<string,any>} currentAttributes
   */
  constructor (left, right, index, currentAttributes) {
    this.left = left
    this.right = right
    this.index = index
    this.currentAttributes = currentAttributes
  }

  /**
   * Only call this if you know that this.right is defined
   */
  forward () {
    if (this.right === null) {
      error.unexpectedCase()
    }
    switch (this.right.content.constructor) {
      case ContentFormat:
        if (!this.right.deleted) {
          updateCurrentAttributes(this.currentAttributes, /** @type {ContentFormat} */ (this.right.content))
        }
        break
      default:
        if (!this.right.deleted) {
          this.index += this.right.length
        }
        break
    }
    this.left = this.right
    this.right = this.right.right
  }
}

/**
 * @param {Transaction} transaction
 * @param {ItemTextListPosition} pos
 * @param {number} count steps to move forward
 * @return {ItemTextListPosition}
 *
 * @private
 * @function
 */
const findNextPosition = (transaction, pos, count) => {
  while (pos.right !== null && count > 0) {
    switch (pos.right.content.constructor) {
      case ContentFormat:
        if (!pos.right.deleted) {
          updateCurrentAttributes(pos.currentAttributes, /** @type {ContentFormat} */ (pos.right.content))
        }
        break
      default:
        if (!pos.right.deleted) {
          if (count < pos.right.length) {
            // split right
            getItemCleanStart(transaction, createID(pos.right.id.client, pos.right.id.clock + count))
          }
          pos.index += pos.right.length
          count -= pos.right.length
        }
        break
    }
    pos.left = pos.right
    pos.right = pos.right.right
    // pos.forward() - we don't forward because that would halve the performance because we already do the checks above
  }
  return pos
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
  if (parent._searchMarker) {
    return useSearchMarker(transaction, parent, index, listIter => {
      let left, right
      if (listIter.rel > 0) {
        // must exist because rel > 0
        const nextItem = /** @type {Item} */ (listIter.nextItem)
        if (listIter.rel === nextItem.length) {
          left = nextItem
          right = left.right
        } else {
          const structs = /** @type {Array<Item|GC>} */ (transaction.doc.store.clients.get(nextItem.id.client))
          const after = /** @type {Item} */ (structs[findIndexCleanStart(transaction, structs, nextItem.id.clock + listIter.rel)])
          listIter.nextItem = after
          listIter.rel = 0
          left = listIter.left
          right = listIter.right
        }
      } else {
        left = listIter.left
        right = listIter.right
      }
      // @todo this should simply split if .rel > 0
      return new ItemTextListPosition(left, right, index, currentAttributes)
    })
  } else {
    const pos = new ItemTextListPosition(null, parent._start, 0, currentAttributes)
    return findNextPosition(transaction, pos, index)
  }
}

/**
 * Negate applied formats
 *
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemTextListPosition} currPos
 * @param {Map<string,any>} negatedAttributes
 *
 * @private
 * @function
 */
const insertNegatedAttributes = (transaction, parent, currPos, negatedAttributes) => {
  // check if we really need to remove attributes
  while (
    currPos.right !== null && (
      currPos.right.deleted === true || (
        currPos.right.content.constructor === ContentFormat &&
        equalAttrs(negatedAttributes.get(/** @type {ContentFormat} */ (currPos.right.content).key), /** @type {ContentFormat} */ (currPos.right.content).value)
      )
    )
  ) {
    if (!currPos.right.deleted) {
      negatedAttributes.delete(/** @type {ContentFormat} */ (currPos.right.content).key)
    }
    currPos.forward()
  }
  const doc = transaction.doc
  const ownClientId = doc.clientID
  negatedAttributes.forEach((val, key) => {
    const left = currPos.left
    const right = currPos.right
    const nextFormat = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val))
    nextFormat.integrate(transaction, 0)
    currPos.right = nextFormat
    currPos.forward()
  })
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
 * @param {ItemTextListPosition} currPos
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 */
const minimizeAttributeChanges = (currPos, attributes) => {
  // go right while attributes[right.key] === right.value (or right is deleted)
  while (true) {
    if (currPos.right === null) {
      break
    } else if (currPos.right.deleted || (currPos.right.content.constructor === ContentFormat && equalAttrs(attributes[(/** @type {ContentFormat} */ (currPos.right.content)).key] || null, /** @type {ContentFormat} */ (currPos.right.content).value))) {
      //
    } else {
      break
    }
    currPos.forward()
  }
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemTextListPosition} currPos
 * @param {Object<string,any>} attributes
 * @return {Map<string,any>}
 *
 * @private
 * @function
 **/
const insertAttributes = (transaction, parent, currPos, attributes) => {
  const doc = transaction.doc
  const ownClientId = doc.clientID
  const negatedAttributes = new Map()
  // insert format-start items
  for (const key in attributes) {
    const val = attributes[key]
    const currentVal = currPos.currentAttributes.get(key) || null
    if (!equalAttrs(currentVal, val)) {
      // save negated attribute (set null if currentVal undefined)
      negatedAttributes.set(key, currentVal)
      const { left, right } = currPos
      currPos.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val))
      currPos.right.integrate(transaction, 0)
      currPos.forward()
    }
  }
  return negatedAttributes
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemTextListPosition} currPos
 * @param {string|object|AbstractType<any>} text
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 **/
const insertText = (transaction, parent, currPos, text, attributes) => {
  currPos.currentAttributes.forEach((val, key) => {
    if (attributes[key] === undefined) {
      attributes[key] = null
    }
  })
  const doc = transaction.doc
  const ownClientId = doc.clientID
  minimizeAttributeChanges(currPos, attributes)
  const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes)
  // insert content
  const content = text.constructor === String ? new ContentString(/** @type {string} */ (text)) : (text instanceof AbstractType ? new ContentType(text) : new ContentEmbed(text))
  let { left, right, index } = currPos
  if (parent._searchMarker) {
    updateMarkerChanges(parent._searchMarker, currPos.index, content.getLength(), null)
  }
  right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, content)
  right.integrate(transaction, 0)
  currPos.right = right
  currPos.index = index
  currPos.forward()
  insertNegatedAttributes(transaction, parent, currPos, negatedAttributes)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {ItemTextListPosition} currPos
 * @param {number} length
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 */
const formatText = (transaction, parent, currPos, length, attributes) => {
  const doc = transaction.doc
  const ownClientId = doc.clientID
  minimizeAttributeChanges(currPos, attributes)
  const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes)
  // iterate until first non-format or null is found
  // delete all formats with attributes[format.key] != null
  while (length > 0 && currPos.right !== null) {
    if (!currPos.right.deleted) {
      switch (currPos.right.content.constructor) {
        case ContentFormat: {
          const { key, value } = /** @type {ContentFormat} */ (currPos.right.content)
          const attr = attributes[key]
          if (attr !== undefined) {
            if (equalAttrs(attr, value)) {
              negatedAttributes.delete(key)
            } else {
              negatedAttributes.set(key, value)
            }
            currPos.right.delete(transaction)
          }
          break
        }
        default:
          if (length < currPos.right.length) {
            getItemCleanStart(transaction, createID(currPos.right.id.client, currPos.right.id.clock + length))
          }
          length -= currPos.right.length
          break
      }
    }
    currPos.forward()
  }
  // Quill just assumes that the editor starts with a newline and that it always
  // ends with a newline. We only insert that newline when a new newline is
  // inserted - i.e when length is bigger than type.length
  if (length > 0) {
    let newlines = ''
    for (; length > 0; length--) {
      newlines += '\n'
    }
    currPos.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), currPos.left, currPos.left && currPos.left.lastId, currPos.right, currPos.right && currPos.right.id, parent, null, new ContentString(newlines))
    currPos.right.integrate(transaction, 0)
    currPos.forward()
  }
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
  while (end && (!end.countable || end.deleted)) {
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
  while (item && item.right && (item.right.deleted || !item.right.countable)) {
    item = item.right
  }
  const attrs = new Set()
  // iterate back until a content item is found
  while (item && (item.deleted || !item.countable)) {
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
          default:
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
 * @param {ItemTextListPosition} currPos
 * @param {number} length
 * @return {ItemTextListPosition}
 *
 * @private
 * @function
 */
const deleteText = (transaction, currPos, length) => {
  const startLength = length
  const startAttrs = map.copy(currPos.currentAttributes)
  const start = currPos.right
  while (length > 0 && currPos.right !== null) {
    if (currPos.right.deleted === false) {
      switch (currPos.right.content.constructor) {
        case ContentType:
        case ContentEmbed:
        case ContentString:
          if (length < currPos.right.length) {
            getItemCleanStart(transaction, createID(currPos.right.id.client, currPos.right.id.clock + length))
          }
          length -= currPos.right.length
          currPos.right.delete(transaction)
          break
      }
    }
    currPos.forward()
  }
  if (start) {
    cleanupFormattingGap(transaction, start, currPos.right, startAttrs, map.copy(currPos.currentAttributes))
  }
  const parent = /** @type {AbstractType<any>} */ (/** @type {Item} */ (currPos.left || currPos.right).parent)
  if (parent._searchMarker) {
    updateMarkerChanges(parent._searchMarker, currPos.index, -startLength + length, null)
  }
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
 * Event that describes the changes on a YText type.
 */
export class YTextEvent extends YEvent {
  /**
   * @param {YText} ytext
   * @param {Transaction} transaction
   * @param {Set<any>} subs The keys that changed
   */
  constructor (ytext, transaction, subs) {
    super(ytext, transaction)
    /**
     * Whether the children changed.
     * @type {Boolean}
     * @private
     */
    this.childListChanged = false
    /**
     * Set of all changed attributes.
     * @type {Set<string>}
     */
    this.keysChanged = new Set()
    subs.forEach((sub) => {
      if (sub === null) {
        this.childListChanged = true
      } else {
        this.keysChanged.add(sub)
      }
    })
  }

  /**
   * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert?:Array<any>|string, delete?:number, retain?:number}>}}
   */
  get changes () {
    if (this._changes === null) {
      /**
       * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert?:Array<any>|string|AbstractType<any>|object, delete?:number, retain?:number}>}}
       */
      const changes = {
        keys: this.keys,
        delta: this.delta,
        added: new Set(),
        deleted: new Set()
      }
      this._changes = changes
    }
    return /** @type {any} */ (this._changes)
  }

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {Array<{insert?:string|object|AbstractType<any>, delete?:number, retain?:number, attributes?: Object<string,any>}>}
   *
   * @public
   */
  get delta () {
    if (this._delta === null) {
      const y = /** @type {Doc} */ (this.target.doc)
      /**
       * @type {Array<{insert?:string|object|AbstractType<any>, delete?:number, retain?:number, attributes?: Object<string,any>}>}
       */
      const delta = []
      transact(y, transaction => {
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
                  currentAttributes.forEach((value, key) => {
                    if (value !== null) {
                      op.attributes[key] = value
                    }
                  })
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
            case ContentType:
            case ContentEmbed:
              if (this.adds(item)) {
                if (!this.deletes(item)) {
                  addOp()
                  action = 'insert'
                  insert = item.content.getContent()[0]
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
                      delete attributes[key]
                    } else {
                      attributes[key] = value
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
      this._delta = delta
    }
    return /** @type {any} */ (this._delta)
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
    /**
     * @type {Array<ListIterator>}
     */
    this._searchMarker = []
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
   * @return {YText}
   */
  clone () {
    const text = new YText()
    text.applyDelta(this.toDelta())
    return text
  }

  /**
   * Creates YTextEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    super._callObserver(transaction, parentSubs)
    const event = new YTextEvent(this, transaction, parentSubs)
    const doc = transaction.doc
    callTypeObservers(this, transaction, event)
    // If a remote change happened, we try to cleanup potential formatting duplicates.
    if (!transaction.local) {
      // check if another formatting item was inserted
      let foundFormattingItem = false
      for (const [client, afterClock] of transaction.afterState.entries()) {
        const clock = transaction.beforeState.get(client) || 0
        if (afterClock === clock) {
          continue
        }
        iterateStructs(transaction, /** @type {Array<Item|GC>} */ (doc.store.clients.get(client)), clock, afterClock, item => {
          if (!item.deleted && /** @type {Item} */ (item).content.constructor === ContentFormat) {
            foundFormattingItem = true
          }
        })
        if (foundFormattingItem) {
          break
        }
      }
      if (!foundFormattingItem) {
        iterateDeletedStructs(transaction, transaction.deleteSet, item => {
          if (item instanceof GC || foundFormattingItem) {
            return
          }
          if (item.parent === this && item.content.constructor === ContentFormat) {
            foundFormattingItem = true
          }
        })
      }
      transact(doc, (t) => {
        if (foundFormattingItem) {
          // If a formatting item was inserted, we simply clean the whole type.
          // We need to compute currentAttributes for the current position anyway.
          cleanupYTextFormatting(this)
        } else {
          // If no formatting attribute was inserted, we can make due with contextless
          // formatting cleanups.
          // Contextless: it is not necessary to compute currentAttributes for the affected position.
          iterateDeletedStructs(t, t.deleteSet, item => {
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
        const currPos = new ItemTextListPosition(null, this._start, 0, new Map())
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
              insertText(transaction, this, currPos, ins, op.attributes || {})
            }
          } else if (op.retain !== undefined) {
            formatText(transaction, this, currPos, op.retain, op.attributes || {})
          } else if (op.delete !== undefined) {
            deleteText(transaction, currPos, op.delete)
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
        currentAttributes.forEach((value, key) => {
          addAttributes = true
          attributes[key] = value
        })
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
            case ContentType:
            case ContentEmbed: {
              packStr()
              /**
               * @type {Object<string,any>}
               */
              const op = {
                insert: n.content.getContent()[0]
              }
              if (currentAttributes.size > 0) {
                const attrs = /** @type {Object<string,any>} */ ({})
                op.attributes = attrs
                currentAttributes.forEach((value, key) => {
                  attrs[key] = value
                })
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
        const pos = findPosition(transaction, this, index)
        if (!attributes) {
          attributes = {}
          // @ts-ignore
          pos.currentAttributes.forEach((v, k) => { attributes[k] = v })
        }
        insertText(transaction, this, pos, text, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.insert(index, text, attributes))
    }
  }

  /**
   * Inserts an embed at a index.
   *
   * @param {number} index The index to insert the embed at.
   * @param {Object | AbstractType<any>} embed The Object that represents the embed.
   * @param {TextAttributes} attributes Attribute information to apply on the
   *                                    embed
   *
   * @public
   */
  insertEmbed (index, embed, attributes = {}) {
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const pos = findPosition(transaction, this, index)
        insertText(transaction, this, pos, embed, attributes)
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
        deleteText(transaction, findPosition(transaction, this, index), length)
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
    if (length === 0) {
      return
    }
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const pos = findPosition(transaction, this, index)
        if (pos.right === null) {
          return
        }
        formatText(transaction, this, pos, length, attributes)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.format(index, length, attributes))
    }
  }

  /**
   * Removes an attribute.
   *
   * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
   *
   * @param {String} attributeName The attribute name that is to be removed.
   *
   * @public
   */
  removeAttribute (attributeName) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeMapDelete(transaction, this, attributeName)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.removeAttribute(attributeName))
    }
  }

  /**
   * Sets or updates an attribute.
   *
   * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
   *
   * @param {String} attributeName The attribute name that is to be set.
   * @param {any} attributeValue The attribute value that is to be set.
   *
   * @public
   */
  setAttribute (attributeName, attributeValue) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        typeMapSet(transaction, this, attributeName, attributeValue)
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.setAttribute(attributeName, attributeValue))
    }
  }

  /**
   * Returns an attribute value that belongs to the attribute name.
   *
   * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
   *
   * @param {String} attributeName The attribute name that identifies the
   *                               queried value.
   * @return {any} The queried attribute value.
   *
   * @public
   */
  getAttribute (attributeName) {
    return /** @type {any} */ (typeMapGet(this, attributeName))
  }

  /**
   * Returns all attribute name/value pairs in a JSON Object.
   *
   * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
   *
   * @param {Snapshot} [snapshot]
   * @return {Object<string, any>} A JSON Object that describes the attributes.
   *
   * @public
   */
  getAttributes (snapshot) {
    return typeMapGetAll(this)
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   */
  _write (encoder) {
    encoder.writeTypeRef(YTextRefID)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {YText}
 *
 * @private
 * @function
 */
export const readYText = decoder => new YText()
