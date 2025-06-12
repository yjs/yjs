/**
 * @module YText
 */

import {
  YEvent,
  AbstractType,
  getItemCleanStart,
  getState,
  createID,
  YTextRefID,
  callTypeObservers,
  transact,
  ContentEmbed,
  GC,
  ContentFormat,
  ContentString,
  iterateStructsByIdSet,
  findMarker,
  typeMapDelete,
  typeMapSet,
  typeMapGet,
  typeMapGetAll,
  updateMarkerChanges,
  ContentType,
  warnPrematureAccess,
  noAttributionsManager, AbstractAttributionManager, ArraySearchMarker, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Doc, Item, Transaction, // eslint-disable-line
  createAttributionFromAttributionItems,
  mergeIdSets,
  diffIdSet,
  createIdSet,
  ContentDeleted
} from '../internals.js'

import * as delta from '../utils/Delta.js'

import * as math from 'lib0/math'
import * as traits from 'lib0/traits'
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
   * @param {AbstractAttributionManager} am
   */
  constructor (left, right, index, currentAttributes, am) {
    this.left = left
    this.right = right
    this.index = index
    this.currentAttributes = currentAttributes
    this.am = am
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
        this.index += this.am.contentLength(this.right)
        break
    }
    this.left = this.right
    this.right = this.right.right
  }

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {number} length
   * @param {Object<string,any>} attributes
   *
   * @function
   */
  formatText (transaction, parent, length, attributes) {
    const doc = transaction.doc
    const ownClientId = doc.clientID
    minimizeAttributeChanges(this, attributes)
    const negatedAttributes = insertAttributes(transaction, parent, this, attributes)
    // iterate until first non-format or null is found
    // delete all formats with attributes[format.key] != null
    // also check the attributes after the first non-format as we do not want to insert redundant negated attributes there
    // eslint-disable-next-line no-labels
    iterationLoop: while (
      this.right !== null &&
      (length > 0 ||
        (
          negatedAttributes.size > 0 &&
          ((this.right.deleted && this.am.contentLength(this.right) === 0) || this.right.content.constructor === ContentFormat)
        )
      )
    ) {
      switch (this.right.content.constructor) {
        case ContentFormat: {
          if (!this.right.deleted) {
            const { key, value } = /** @type {ContentFormat} */ (this.right.content)
            const attr = attributes[key]
            if (attr !== undefined) {
              if (equalAttrs(attr, value)) {
                negatedAttributes.delete(key)
              } else {
                if (length === 0) {
                  // no need to further extend negatedAttributes
                  // eslint-disable-next-line no-labels
                  break iterationLoop
                }
                negatedAttributes.set(key, value)
              }
              this.right.delete(transaction)
            } else {
              this.currentAttributes.set(key, value)
            }
          }
          break
        }
        default: {
          const item = this.right
          const rightLen = this.am.contentLength(item)
          if (length < rightLen) {
            /**
             * @type {Array<import('../internals.js').AttributedContent<any>>}
             */
            const contents = []
            this.am.readContent(contents, item.id.client, item.id.clock, item.deleted, item.content, 0)
            let i = 0
            for (; i < contents.length && length > 0; i++) {
              const c = contents[i]
              if ((!c.deleted || c.attrs != null) && c.content.isCountable()) {
                length -= c.content.getLength()
              }
            }
            if (length < 0 || (length === 0 && i !== contents.length)) {
              const c = contents[--i]
              getItemCleanStart(transaction, createID(item.id.client, c.clock + c.content.getLength() + length))
            }
          } else {
            length -= rightLen
          }
          break
        }
      }
      this.forward()
    }
    // Quill just assumes that the editor starts with a newline and that it always
    // ends with a newline. We only insert that newline when a new newline is
    // inserted - i.e when length is bigger than type.length
    if (length > 0) {
      let newlines = ''
      for (; length > 0; length--) {
        newlines += '\n'
      }
      this.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), this.left, this.left && this.left.lastId, this.right, this.right && this.right.id, parent, null, new ContentString(newlines))
      this.right.integrate(transaction, 0)
      this.forward()
    }
    insertNegatedAttributes(transaction, parent, this, negatedAttributes)
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
 * @param {boolean} useSearchMarker
 * @return {ItemTextListPosition}
 *
 * @private
 * @function
 */
const findPosition = (transaction, parent, index, useSearchMarker) => {
  const currentAttributes = new Map()
  const marker = useSearchMarker ? findMarker(parent, index) : null
  if (marker) {
    const pos = new ItemTextListPosition(marker.p.left, marker.p, marker.index, currentAttributes, noAttributionsManager)
    return findNextPosition(transaction, pos, index - marker.index)
  } else {
    const pos = new ItemTextListPosition(null, parent._start, 0, currentAttributes, noAttributionsManager)
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
      (currPos.right.deleted && (currPos.am === noAttributionsManager || currPos.am.contentLength(currPos.right) === 0)) || (
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
    } else if (currPos.right.deleted ? (currPos.am.contentLength(currPos.right) === 0) : (!currPos.right.deleted && currPos.right.content.constructor === ContentFormat && equalAttrs(attributes[(/** @type {ContentFormat} */ (currPos.right.content)).key] ?? null, /** @type {ContentFormat} */ (currPos.right.content).value))) {
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
    const currentVal = currPos.currentAttributes.get(key) ?? null
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
  currPos.currentAttributes.forEach((_val, key) => {
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
    updateMarkerChanges(parent._searchMarker, currPos.index, content.getLength())
  }
  right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, content)
  right.integrate(transaction, 0)
  currPos.right = right
  currPos.index = index
  currPos.forward()
  insertNegatedAttributes(transaction, parent, currPos, negatedAttributes)
}

/**
 * Call this function after string content has been deleted in order to
 * clean up formatting Items.
 *
 * @param {Transaction} transaction
 * @param {Item} start
 * @param {Item|null} curr exclusive end, automatically iterates to the next Content Item
 * @param {Map<string,any>} startAttributes
 * @param {Map<string,any>} currAttributes
 * @return {number} The amount of formatting Items deleted.
 *
 * @function
 */
const cleanupFormattingGap = (transaction, start, curr, startAttributes, currAttributes) => {
  if (!transaction.doc.cleanupFormatting) return 0
  /**
   * @type {Item|null}
   */
  let end = start
  /**
   * @type {Map<string,ContentFormat>}
   */
  const endFormats = map.create()
  while (end && (!end.countable || end.deleted)) {
    if (!end.deleted && end.content.constructor === ContentFormat) {
      const cf = /** @type {ContentFormat} */ (end.content)
      endFormats.set(cf.key, cf)
    }
    end = end.right
  }
  let cleanups = 0
  let reachedCurr = false
  while (start !== end) {
    if (curr === start) {
      reachedCurr = true
    }
    if (!start.deleted) {
      const content = start.content
      switch (content.constructor) {
        case ContentFormat: {
          const { key, value } = /** @type {ContentFormat} */ (content)
          const startAttrValue = startAttributes.get(key) ?? null
          if (endFormats.get(key) !== content || startAttrValue === value) {
            // Either this format is overwritten or it is not necessary because the attribute already existed.
            start.delete(transaction)
            transaction.cleanUps.add(start.id.client, start.id.clock, start.length)
            cleanups++
            if (!reachedCurr && (currAttributes.get(key) ?? null) === value && startAttrValue !== value) {
              if (startAttrValue === null) {
                currAttributes.delete(key)
              } else {
                currAttributes.set(key, startAttrValue)
              }
            }
          }
          if (!reachedCurr && !start.deleted) {
            updateCurrentAttributes(currAttributes, /** @type {ContentFormat} */ (content))
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
  if (!transaction.doc.cleanupFormatting) return 0
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
        transaction.cleanUps.add(item.id.client, item.id.clock, item.length)
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
 * @param {YText<any>} type
 * @return {number} How many formatting attributes have been cleaned up.
 */
export const cleanupYTextFormatting = type => {
  if (!type.doc?.cleanupFormatting) return 0
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
 * This will be called by the transaction once the event handlers are called to potentially cleanup
 * formatting attributes.
 *
 * @param {Transaction} transaction
 */
export const cleanupYTextAfterTransaction = transaction => {
  /**
   * @type {Set<YText<any>>}
   */
  const needFullCleanup = new Set()
  // check if another formatting item was inserted
  const doc = transaction.doc
  iterateStructsByIdSet(transaction, transaction.insertSet, (item) => {
    if (
      !item.deleted && /** @type {Item} */ (item).content.constructor === ContentFormat && item.constructor !== GC
    ) {
      needFullCleanup.add(/** @type {any} */ (item).parent)
    }
  })
  // cleanup in a new transaction
  transact(doc, (t) => {
    iterateStructsByIdSet(transaction, transaction.deleteSet, item => {
      if (item instanceof GC || !(/** @type {YText<any>} */ (item.parent)._hasFormatting) || needFullCleanup.has(/** @type {YText<any>} */ (item.parent))) {
        return
      }
      const parent = /** @type {YText<any>} */ (item.parent)
      if (item.content.constructor === ContentFormat) {
        needFullCleanup.add(parent)
      } else {
        // If no formatting attribute was inserted or deleted, we can make due with contextless
        // formatting cleanups.
        // Contextless: it is not necessary to compute currentAttributes for the affected position.
        cleanupContextlessFormattingGap(t, item)
      }
    })
    // If a formatting item was inserted, we simply clean the whole type.
    // We need to compute currentAttributes for the current position anyway.
    for (const yText of needFullCleanup) {
      cleanupYTextFormatting(yText)
    }
  })
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
    if (!currPos.right.deleted) {
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
    } else if (currPos.am !== noAttributionsManager) {
      const item = currPos.right
      /**
       * @type {Array<import('../internals.js').AttributedContent<any>>}
       */
      const contents = []
      currPos.am.readContent(contents, item.id.client, item.id.clock, true, item.content, 0)
      for (let i = 0; i < contents.length; i++) {
        const c = contents[i]
        if (c.content.isCountable() && c.attrs != null) {
          // deleting already deleted content. store that information in a meta property, but do
          // nothing
          const contentLen = math.min(c.content.getLength(), length)
          map.setIfUndefined(transaction.meta, 'attributedDeletes', createIdSet).add(item.id.client, c.clock, contentLen)
          length -= contentLen
        }
      }
      const lastContent = contents.length > 0 ? contents[contents.length - 1] : null
      const nextItemClock = item.id.clock + item.length
      const nextContentClock = lastContent != null ? lastContent.clock + lastContent.content.getLength() : nextItemClock
      if (nextContentClock < nextItemClock) {
        getItemCleanStart(transaction, createID(item.id.client, nextContentClock))
      }
    }
    currPos.forward()
  }
  if (start) {
    cleanupFormattingGap(transaction, start, currPos.right, startAttrs, currPos.currentAttributes)
  }
  const parent = /** @type {AbstractType<any>} */ (/** @type {Item} */ (currPos.left || currPos.right).parent)
  if (parent._searchMarker) {
    updateMarkerChanges(parent._searchMarker, currPos.index, -startLength + length)
  }
  return currPos
}

/**
 * The Quill Delta format represents changes on a text document with
 * formatting information. For more information visit {@link https://quilljs.com/docs/delta/|Quill Delta}
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
 * @template {{ [key:string]: any } | AbstractType<any> } TextEmbeds
 * @extends YEvent<YText<any>>
 * Event that describes the changes on a YText type.
 */
export class YTextEvent extends YEvent {
  /**
   * @param {YText<TextEmbeds>} ytext
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
   * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:delta.TextDelta<TextEmbeds>}}
   */
  get changes () {
    if (this._changes === null) {
      /**
       * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:delta.TextDelta<TextEmbeds>}}
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
   * @param {AbstractAttributionManager} am
   * @return {import('../utils/Delta.js').TextDelta<TextEmbeds>} The Delta representation of this type.
   *
   * @public
   */
  getDelta (am = noAttributionsManager) {
    const itemsToRender = mergeIdSets([diffIdSet(this.transaction.insertSet, this.transaction.deleteSet), diffIdSet(this.transaction.deleteSet, this.transaction.insertSet)])
    return this.target.getDelta(am, { itemsToRender, retainDeletes: true })
  }

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {delta.TextDelta<TextEmbeds>}
   *
   * @public
   */
  get delta () {
    return this._delta ?? (this._delta = this.getDelta())
  }
}

/**
 * Type that represents text with formatting information.
 *
 * This type replaces y-richtext as this implementation is able to handle
 * block formats (format information on a paragraph), embeds (complex elements
 * like pictures and videos), and text formats (**bold**, *italic*).
 *
 * @template {{ [key:string]:any } | AbstractType<any>} [Embeds={ [key:string]:any } | AbstractType<any>]
 * @extends AbstractType<YTextEvent<Embeds>>
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
     * @type {Array<ArraySearchMarker>|null}
     */
    this._searchMarker = []
    /**
     * Whether this YText contains formatting attributes.
     * This flag is updated when a formatting item is integrated (see ContentFormat.integrate)
     */
    this._hasFormatting = false
  }

  /**
   * Number of characters of this text type.
   *
   * @type {number}
   */
  get length () {
    this.doc ?? warnPrematureAccess()
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

  /**
   * @return {YText<Embeds>}
   */
  _copy () {
    return new YText()
  }

  /**
   * Makes a copy of this data type that can be included somewhere else.
   *
   * Note that the content is only readable _after_ it has been included somewhere in the Ydoc.
   *
   * @return {YText<Embeds>}
   */
  clone () {
    /**
     * @type {YText<Embeds>}
     */
    const text = new YText()
    text.applyDelta(this.getContent())
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
    callTypeObservers(this, transaction, event)
    // If a remote change happened, we try to cleanup potential formatting duplicates.
    if (!transaction.local && this._hasFormatting) {
      transaction._needFormattingCleanup = true
    }
  }

  /**
   * Returns the unformatted string representation of this YText type.
   *
   * @public
   */
  toString () {
    this.doc ?? warnPrematureAccess()
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
   * @param {Array<any> | delta.Delta} delta The changes to apply on this element.
   * @param {AbstractAttributionManager} am
   *
   * @public
   */
  applyDelta (delta, am = noAttributionsManager) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        /**
         * @type {Array<any>}
         */
        const deltaOps = /** @type {Array<any>} */ (/** @type {delta.Delta} */ (delta).ops instanceof Array ? /** @type {delta.Delta} */ (delta).ops : delta)
        const currPos = new ItemTextListPosition(null, this._start, 0, new Map(), am)
        for (let i = 0; i < deltaOps.length; i++) {
          const op = deltaOps[i]
          if (op.insert !== undefined) {
            if (op.insert.length > 0 || typeof op.insert !== 'string') {
              insertText(transaction, this, currPos, op.insert, op.attributes || {})
            }
          } else if (op.retain !== undefined) {
            currPos.formatText(transaction, this, op.retain, op.attributes || {})
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
   * Render the difference to another ydoc (which can be empty) and highlight the differences with
   * attributions.
   *
   * Note that deleted content that was not deleted in prevYdoc is rendered as an insertion with the
   * attribution `{ isDeleted: true, .. }`.
   *
   * @param {AbstractAttributionManager} am
   * @return {import('../utils/Delta.js').TextDelta< Embeds extends import('./AbstractType.js').AbstractType<any> ? import('./AbstractType.js').DeepContent : Embeds >} The Delta representation of this type.
   *
   * @public
   */
  getContentDeep (am = noAttributionsManager) {
    return this.getContent(am).map(d =>
      d instanceof delta.InsertEmbedOp && d.insert instanceof AbstractType
        ? new delta.InsertEmbedOp(d.insert.getContent(am), d.attributes, d.attribution)
        : d
    )
  }

  /**
   * @param {AbstractAttributionManager} am
   * @return {import('../utils/Delta.js').TextDelta<Embeds>} The Delta representation of this type.
   *
   * @public
   */
  getContent (am = noAttributionsManager) {
    return this.getDelta(am)
  }

  /**
   * Render the difference to another ydoc (which can be empty) and highlight the differences with
   * attributions.
   *
   * Note that deleted content that was not deleted in prevYdoc is rendered as an insertion with the
   * attribution `{ isDeleted: true, .. }`.
   *
   * @param {AbstractAttributionManager} am
   * @param {Object} [opts]
   * @param {import('../utils/IdSet.js').IdSet?} [opts.itemsToRender]
   * @param {boolean} [opts.retainInserts] - if true, retain rendered inserts with attributions
   * @param {boolean} [opts.retainDeletes] - if true, retain rendered+attributed deletes only
   * @return {import('../utils/Delta.js').TextDelta<Embeds>} The Delta representation of this type.
   *
   * @public
   */
  getDelta (am = noAttributionsManager, { itemsToRender = null, retainInserts = false, retainDeletes = false } = {}) {
    /**
     * @type {import('../utils/Delta.js').TextDelta<Embeds>}
     */
    const d = delta.createTextDelta()
    /**
     * @type {import('../utils/Delta.js').FormattingAttributes}
     */
    let currentAttributes = {} // saves all current attributes for insert
    let usingCurrentAttributes = false
    /**
     * @type {import('../utils/Delta.js').FormattingAttributes}
     */
    let changedAttributes = {} // saves changed attributes for retain
    let usingChangedAttributes = false
    /**
     * Logic for formatting attribute attribution
     * Everything that comes after an formatting attribute is formatted by the user that created it.
     * Two exceptions:
     * - the user resets formatting to the previously known formatting that is not attributed
     * - the user deletes a formatting attribute and hence restores the previously known formatting
     *   that is not attributed.
     * @type {import('../utils/Delta.js').FormattingAttributes}
     */
    const previousUnattributedAttributes = {} // contains previously known unattributed formatting
    /**
     * @type {import('../utils/Delta.js').FormattingAttributes}
     */
    const previousAttributes = {} // The value before changes

    /**
     * @type {Array<import('../internals.js').AttributedContent<any>>}
     */
    const cs = []
    for (let item = this._start; item !== null; cs.length = 0) {
      if (itemsToRender != null) {
        for (; item !== null && cs.length < 50; item = item.right) {
          const rslice = itemsToRender.slice(item.id.client, item.id.clock, item.length)
          let itemContent = rslice.length > 1 ? item.content.copy() : item.content
          for (let ir = 0; ir < rslice.length; ir++) {
            const idrange = rslice[ir]
            const content = itemContent
            if (ir !== rslice.length - 1) {
              itemContent = itemContent.splice(idrange.len)
            }
            am.readContent(cs, item.id.client, idrange.clock, item.deleted, content, idrange.exists ? 2 : 0)
          }
        }
      } else {
        for (; item !== null && cs.length < 50; item = item.right) {
          am.readContent(cs, item.id.client, item.id.clock, item.deleted, item.content, 1)
        }
      }
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i]
        // render (attributed) content even if it was deleted
        const renderContent = c.render && (!c.deleted || c.attrs != null)
        // content that was just deleted. It is not rendered as an insertion, because it doesn't
        // have any attributes.
        const renderDelete = c.render && c.deleted
        // existing content that should be retained, only adding changed attributes
        const retainContent = !c.render && (!c.deleted || c.attrs != null)
        const attribution = (renderContent || c.content.constructor === ContentFormat) ? createAttributionFromAttributionItems(c.attrs, c.deleted) : null
        switch (c.content.constructor) {
          case ContentDeleted: {
            if (renderDelete) d.delete(c.content.getLength())
            break
          }
          case ContentType:
          case ContentEmbed:
            if (renderContent) {
              d.usedAttributes = currentAttributes
              usingCurrentAttributes = true
              if (c.deleted ? retainDeletes : retainInserts) {
                d.retain(c.content.getLength(), null, attribution ?? {})
              } else {
                d.insert(c.content.getContent()[0], null, attribution)
              }
            } else if (renderDelete) {
              d.delete(1)
            } else if (retainContent) {
              d.usedAttributes = changedAttributes
              usingChangedAttributes = true
              d.retain(1)
            }
            break
          case ContentString:
            if (renderContent) {
              d.usedAttributes = currentAttributes
              usingCurrentAttributes = true
              if (c.deleted ? retainDeletes : retainInserts) {
                d.retain(/** @type {ContentString} */ (c.content).str.length, null, attribution ?? {})
              } else {
                d.insert(/** @type {ContentString} */ (c.content).str, null, attribution)
              }
            } else if (renderDelete) {
              d.delete(c.content.getLength())
            } else if (retainContent) {
              d.usedAttributes = changedAttributes
              usingChangedAttributes = true
              d.retain(c.content.getLength())
            }
            break
          case ContentFormat: {
            const { key, value } = /** @type {ContentFormat} */ (c.content)
            const currAttrVal = currentAttributes[key] ?? null
            if (attribution != null && (c.deleted || !object.hasProperty(previousUnattributedAttributes, key))) {
              previousUnattributedAttributes[key] = c.deleted ? value : currAttrVal
            }
            // @todo write a function "updateCurrentAttributes" and "updateChangedAttributes"
            // # Update Attributes
            if (renderContent || renderDelete) {
              // create fresh references
              if (usingCurrentAttributes) {
                currentAttributes = object.assign({}, currentAttributes)
                usingCurrentAttributes = false
              }
              if (usingChangedAttributes) {
                usingChangedAttributes = false
                changedAttributes = object.assign({}, changedAttributes)
              }
            }
            if (renderContent || renderDelete) {
              if (c.deleted) {
                // content was deleted, but is possibly attributed
                if (!equalAttrs(value, currAttrVal)) { // do nothing if nothing changed
                  if (equalAttrs(currAttrVal, previousAttributes[key] ?? null) && changedAttributes[key] !== undefined) {
                    delete changedAttributes[key]
                  } else {
                    changedAttributes[key] = currAttrVal
                  }
                  // current attributes doesn't change
                  previousAttributes[key] = value
                }
              } else { // !c.deleted
                // content was inserted, and is possibly attributed
                if (equalAttrs(value, currAttrVal)) {
                  // item.delete(transaction)
                } else if (equalAttrs(value, previousAttributes[key] ?? null)) {
                  delete changedAttributes[key]
                } else {
                  changedAttributes[key] = value
                }
                if (value == null) {
                  delete currentAttributes[key]
                } else {
                  currentAttributes[key] = value
                }
              }
            } else if (retainContent && !c.deleted) {
              // fresh reference to currentAttributes only
              if (usingCurrentAttributes) {
                currentAttributes = object.assign({}, currentAttributes)
                usingCurrentAttributes = false
              }
              if (usingChangedAttributes && changedAttributes[key] !== undefined) {
                usingChangedAttributes = false
                changedAttributes = object.assign({}, changedAttributes)
              }
              if (value == null) {
                delete currentAttributes[key]
              } else {
                currentAttributes[key] = value
              }
              delete changedAttributes[key]
              previousAttributes[key] = value
            }
            // # Update Attributions
            if (attribution != null || object.hasProperty(previousUnattributedAttributes, key)) {
              /**
               * @type {import('../utils/Delta.js').Attribution}
               */
              const formattingAttribution = object.assign({}, d.usedAttribution)
              const changedAttributedAttributes = /** @type {{ [key: string]: Array<any> }} */ (formattingAttribution.attributes = object.assign({}, formattingAttribution.attributes ?? {}))
              if (attribution == null || equalAttrs(previousUnattributedAttributes[key], currentAttributes[key] ?? null)) {
                // an unattributed formatting attribute was found or an attributed formatting
                // attribute was found that resets to the previous status
                delete changedAttributedAttributes[key]
                delete previousUnattributedAttributes[key]
              } else {
                const by = changedAttributedAttributes[key] = (changedAttributedAttributes[key]?.slice() ?? [])
                by.push(...((c.deleted ? attribution.delete : attribution.insert) ?? []))
                const attributedAt = (c.deleted ? attribution.deletedAt : attribution.insertedAt)
                if (attributedAt) formattingAttribution.attributedAt = attributedAt
              }
              if (object.isEmpty(changedAttributedAttributes)) {
                d.useAttribution(null)
              } else if (attribution != null) {
                const attributedAt = (c.deleted ? attribution.deletedAt : attribution.insertedAt)
                if (attributedAt != null) formattingAttribution.attributedAt = attributedAt
                d.useAttribution(formattingAttribution)
              }
            }
            break
          }
        }
      }
    }
    return d.done()
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
        const pos = findPosition(transaction, this, index, !attributes)
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
   * @param {TextAttributes} [attributes] Attribute information to apply on the
   *                                    embed
   *
   * @public
   */
  insertEmbed (index, embed, attributes) {
    const y = this.doc
    if (y !== null) {
      transact(y, transaction => {
        const pos = findPosition(transaction, this, index, !attributes)
        insertText(transaction, this, pos, embed, attributes || {})
      })
    } else {
      /** @type {Array<function>} */ (this._pending).push(() => this.insertEmbed(index, embed, attributes || {}))
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
        deleteText(transaction, findPosition(transaction, this, index, true), length)
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
        const pos = findPosition(transaction, this, index, false)
        if (pos.right === null) {
          return
        }
        pos.formatText(transaction, this, length, attributes)
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
   * @return {Object<string, any>} A JSON Object that describes the attributes.
   *
   * @public
   */
  getAttributes () {
    return typeMapGetAll(this)
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   */
  _write (encoder) {
    encoder.writeTypeRef(YTextRefID)
  }

  /**
   * @param {this} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.getContent().equals(other.getContent())
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
 * @return {YText}
 *
 * @private
 * @function
 */
export const readYText = _decoder => new YText()
