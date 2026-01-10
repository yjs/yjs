import {
  cleanupFormattingGap,
  createIdSet,
  removeEventHandlerListener,
  callEventHandlerListeners,
  addEventHandlerListener,
  createEventHandler,
  getState,
  isVisible,
  ContentType,
  createID,
  ContentAny,
  ContentFormat,
  ContentBinary,
  ContentJSON,
  ContentDeleted,
  ContentString,
  ContentEmbed,
  getItemCleanStart,
  noAttributionsManager,
  transact,
  ContentDoc, UpdateEncoderV1, UpdateEncoderV2, Doc, Snapshot, Transaction, EventHandler, YEvent, Item, createAttributionFromAttributionItems, AbstractAttributionManager // eslint-disable-line
} from './internals.js'

import * as contentType from './structs/ContentType.js'

import * as traits from 'lib0/traits'
import * as delta from 'lib0/delta'
import * as array from 'lib0/array'
import * as map from 'lib0/map'
import * as iterator from 'lib0/iterator'
import * as error from 'lib0/error'
import * as math from 'lib0/math'
import * as log from 'lib0/logging'
import * as object from 'lib0/object'
import * as s from 'lib0/schema'

/**
 * @typedef {Object<string,any>|Array<any>|number|null|string|Uint8Array|BigInt|YType<any>} YValue
 */

/**
 * https://docs.yjs.dev/getting-started/working-with-shared-types#caveats
 */
export const warnPrematureAccess = () => { log.warn('Invalid access: Add Yjs type to a document before reading data.') }

const maxSearchMarker = 80

/**
 * A unique timestamp that identifies each marker.
 *
 * Time is relative,.. this is more like an ever-increasing clock.
 *
 * @type {number}
 */
let globalSearchMarkerTimestamp = 0

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
   * @param {YType} parent
   * @param {number} length
   * @param {Object<string,any>} attributes
   *
   * @function
   */
  formatText (transaction, parent, length, attributes) {
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
             * @type {Array<import('./internals.js').AttributedContent<any>>}
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
    if (length > 0) {
      throw new Error('Exceeded content range')
    }
    insertNegatedAttributes(transaction, parent, this, negatedAttributes)
  }
}

/**
 * Negate applied formats
 *
 * @param {Transaction} transaction
 * @param {YType} parent
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
 * @param {YType} parent
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
 * @param {YType} parent
 * @param {ItemTextListPosition} currPos
 * @param {import('./structs/Item.js').AbstractContent} content
 * @param {Object<string,any>} attributes
 *
 * @private
 * @function
 **/
export const insertContent = (transaction, parent, currPos, content, attributes) => {
  currPos.currentAttributes.forEach((_val, key) => {
    if (attributes[key] === undefined) {
      attributes[key] = null
    }
  })
  const doc = transaction.doc
  const ownClientId = doc.clientID
  minimizeAttributeChanges(currPos, attributes)
  const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes)
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
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {ItemTextListPosition} currPos
 * @param {Array<any>|string} insert
 * @param {Object<string,any>} attributes
 */
export const insertContentHelper = (transaction, parent, currPos, insert, attributes) => {
  if (s.$string.check(insert)) {
    insertContent(transaction, parent, currPos, new ContentString(insert), attributes)
  } else {
    insert = insert.map(ins => delta.$deltaAny.check(ins) ? YType.from(ins) : ins)
    for (let i = 0; i < insert.length;) {
      const first = insert[i]
      if (first instanceof YType) {
        insertContent(transaction, parent, currPos, new ContentType(first), attributes)
        i++
      } else if (first instanceof Doc) {
        insertContent(transaction, parent, currPos, new ContentDoc(first), attributes)
        i++
      } else {
        // insert "any" content
        // compute slice len
        let j = i + 1
        for (; j < insert.length && !(insert[j] instanceof YType || insert[j] instanceof Doc); j++) { /* nop */ }
        insertContent(transaction, parent, currPos, new ContentAny((i === 0 && j === insert.length) ? insert : insert.slice(i, j)), attributes)
        i = j
      }
    }
  }
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
export const deleteText = (transaction, currPos, length) => {
  const startLength = length
  const startAttrs = map.copy(currPos.currentAttributes)
  const start = currPos.right
  while (length > 0 && currPos.right !== null) {
    const item = currPos.right
    if (!item.deleted && item.countable) {
      if (length < item.length) {
        getItemCleanStart(transaction, createID(item.id.client, item.id.clock + length))
      }
      length -= item.length
      item.delete(transaction)
    } else if (currPos.am !== noAttributionsManager) {
      /**
       * @type {Array<import('./internals.js').AttributedContent<any>>}
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
  const parent = /** @type {YType<any>} */ (/** @type {Item} */ (currPos.left || currPos.right).parent)
  if (parent._searchMarker) {
    updateMarkerChanges(parent._searchMarker, currPos.index, -startLength + length)
  }
  return currPos
}

export class ArraySearchMarker {
  /**
   * @param {Item} p
   * @param {number} index
   */
  constructor (p, index) {
    p.marker = true
    this.p = p
    this.index = index
    this.timestamp = globalSearchMarkerTimestamp++
  }
}

/**
 * @param {ArraySearchMarker} marker
 */
const refreshMarkerTimestamp = marker => { marker.timestamp = globalSearchMarkerTimestamp++ }

/**
 * This is rather complex so this function is the only thing that should overwrite a marker
 *
 * @param {ArraySearchMarker} marker
 * @param {Item} p
 * @param {number} index
 */
const overwriteMarker = (marker, p, index) => {
  marker.p.marker = false
  marker.p = p
  p.marker = true
  marker.index = index
  marker.timestamp = globalSearchMarkerTimestamp++
}

/**
 * @param {Array<ArraySearchMarker>} searchMarker
 * @param {Item} p
 * @param {number} index
 */
const markPosition = (searchMarker, p, index) => {
  if (searchMarker.length >= maxSearchMarker) {
    // override oldest marker (we don't want to create more objects)
    const marker = searchMarker.reduce((a, b) => a.timestamp < b.timestamp ? a : b)
    overwriteMarker(marker, p, index)
    return marker
  } else {
    // create new marker
    const pm = new ArraySearchMarker(p, index)
    searchMarker.push(pm)
    return pm
  }
}

/**
 * Search marker help us to find positions in the associative array faster.
 *
 * They speed up the process of finding a position without much bookkeeping.
 *
 * A maximum of `maxSearchMarker` objects are created.
 *
 * This function always returns a refreshed marker (updated timestamp)
 *
 * @param {YType} yarray
 * @param {number} index
 */
export const findMarker = (yarray, index) => {
  if (yarray._start === null || index === 0 || yarray._searchMarker === null) {
    return null
  }
  const marker = yarray._searchMarker.length === 0 ? null : yarray._searchMarker.reduce((a, b) => math.abs(index - a.index) < math.abs(index - b.index) ? a : b)
  let p = yarray._start
  let pindex = 0
  if (marker !== null) {
    p = marker.p
    pindex = marker.index
    refreshMarkerTimestamp(marker) // we used it, we might need to use it again
  }
  // iterate to right if possible
  while (p.right !== null && pindex < index) {
    if (!p.deleted && p.countable) {
      if (index < pindex + p.length) {
        break
      }
      pindex += p.length
    }
    p = p.right
  }
  // iterate to left if necessary (might be that pindex > index)
  while (p.left !== null && pindex > index) {
    p = p.left
    if (!p.deleted && p.countable) {
      pindex -= p.length
    }
  }
  // we want to make sure that p can't be merged with left, because that would screw up everything
  // in that cas just return what we have (it is most likely the best marker anyway)
  // iterate to left until p can't be merged with left
  while (p.left !== null && p.left.id.client === p.id.client && p.left.id.clock + p.left.length === p.id.clock) {
    p = p.left
    if (!p.deleted && p.countable) {
      pindex -= p.length
    }
  }
  if (marker !== null && math.abs(marker.index - pindex) < /** @type {any} */ (p.parent).length / maxSearchMarker) {
    // adjust existing marker
    overwriteMarker(marker, p, pindex)
    return marker
  } else {
    // create new marker
    return markPosition(yarray._searchMarker, p, pindex)
  }
}

/**
 * Update markers when a change happened.
 *
 * This should be called before doing a deletion!
 *
 * @param {Array<ArraySearchMarker>} searchMarker
 * @param {number} index
 * @param {number} len If insertion, len is positive. If deletion, len is negative.
 */
export const updateMarkerChanges = (searchMarker, index, len) => {
  for (let i = searchMarker.length - 1; i >= 0; i--) {
    const m = searchMarker[i]
    if (len > 0) {
      /**
       * @type {Item|null}
       */
      let p = m.p
      p.marker = false
      // Ideally we just want to do a simple position comparison, but this will only work if
      // search markers don't point to deleted items for formats.
      // Iterate marker to prev undeleted countable position so we know what to do when updating a position
      while (p && (p.deleted || !p.countable)) {
        p = p.left
        if (p && !p.deleted && p.countable) {
          // adjust position. the loop should break now
          m.index -= p.length
        }
      }
      if (p === null || p.marker === true) {
        // remove search marker if updated position is null or if position is already marked
        searchMarker.splice(i, 1)
        continue
      }
      m.p = p
      p.marker = true
    }
    if (index < m.index || (len > 0 && index === m.index)) { // a simple index <= m.index check would actually suffice
      m.index = math.max(index, m.index + len)
    }
  }
}

/**
 * Accumulate all (list) children of a type and return them as an Array.
 *
 * @param {YType} t
 * @return {Array<Item>}
 */
export const getTypeChildren = t => {
  t.doc ?? warnPrematureAccess()
  let s = t._start
  const arr = []
  while (s) {
    arr.push(s)
    s = s.right
  }
  return arr
}

/**
 * Call event listeners with an event. This will also add an event to all
 * parents (for `.observeDeep` handlers).
 *
 * @param {YType} type
 * @param {Transaction} transaction
  * @param {YEvent<any>} event
 */
export const callTypeObservers = (type, transaction, event) => {
  const changedType = type
  const changedParentTypes = transaction.changedParentTypes
  while (true) {
    // @ts-ignore
    map.setIfUndefined(changedParentTypes, type, () => []).push(event)
    if (type._item === null) {
      break
    }
    type = /** @type {YType} */ (type._item.parent)
  }
  callEventHandlerListeners(/** @type {any} */ (changedType._eH), event, transaction)
}

/**
 * Abstract Yjs Type class
 * @template {delta.DeltaConf} [DConf=any]
 */
export class YType {
  /**
   * @param {delta.DeltaConfGetName<DConf>?} name
   */
  constructor (name = null) {
    /**
     * @type {delta.DeltaConfGetName<DConf>}
     */
    this.name = /** @type {delta.DeltaConfGetName<DConf>} */ (name)
    /**
     * @type {Item|null}
     */
    this._item = null
    /**
     * @type {Map<string,Item>}
     */
    this._map = new Map()
    /**
     * @type {Item|null}
     */
    this._start = null
    /**
     * @type {Doc|null}
     */
    this.doc = null
    this._length = 0
    /**
     * Event handlers
     * @type {EventHandler<YEvent<DeltaToYType<DConf>>,Transaction>}
     */
    this._eH = createEventHandler()
    /**
     * Deep event handlers
     * @type {EventHandler<YEvent<DConf>,Transaction>}
     */
    this._dEH = createEventHandler()
    /**
     * @type {null | Array<ArraySearchMarker>}
     */
    this._searchMarker = null
    /**
     * @type {delta.DeltaBuilder<DConf>}
     * @private
     */
    this._content = /** @type {delta.DeltaBuilderAny} */ (delta.create())
    this._legacyTypeRef = this.name == null ? contentType.YXmlFragmentRefID : contentType.YXmlElementRefID
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
   * @template {delta.DeltaConf} DC
   * @param {delta.Delta<DC>} d
   * @return {YType<DC>}
   */
  static from (d) {
    const yt = new YType(d.name)
    yt.applyDelta(d)
    return yt
  }

  get length () {
    this.doc ?? warnPrematureAccess()
    return this._length
  }

  /**
   * Returns a fresh delta that can be used to change this YType.
   * @type {delta.DeltaBuilder<DeltaToYType<DConf>>}
   */
  get change () {
    return /** @type {any} */ (delta.create())
  }

  /**
   * @return {YType<any>?}
   */
  get parent () {
    return /** @type {YType<any>?} */ (this._item ? this._item.parent : null)
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Doc} y The Yjs instance
   * @param {Item|null} item
   */
  _integrate (y, item) {
    this.doc = y
    this._item = item
    if (this._prelim) {
      this.applyDelta(this._prelim)
      this._prelim = null
    }
  }

  /**
   * @return {YType<DConf>}
   */
  _copy () {
    return new YType(this.name)
  }

  /**
   * Creates YEvent and calls all type observers.
   * Must be implemented by each type.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    const event = new YEvent(/** @type {any} */ (this), transaction, parentSubs)
    callTypeObservers(/** @type {any} */ (this), transaction, event)
    if (!transaction.local && this._searchMarker) {
      this._searchMarker.length = 0
    }
    // If a remote change happened, we try to cleanup potential formatting duplicates.
    if (!transaction.local && this._hasFormatting) {
      transaction._needFormattingCleanup = true
    }
  }

  /**
   * Observe all events that are created on this type.
   *
   * @template {(target: YEvent<DeltaToYType<DConf>>, tr: Transaction) => void} F
   * @param {F} f Observer function
   * @return {F}
   */
  observe (f) {
    addEventHandlerListener(this._eH, f)
    return f
  }

  /**
   * Observe all events that are created by this type and its children.
   *
   * @template {function(YEvent<DConf>,Transaction):void} F
   * @param {F} f Observer function
   * @return {F}
   */
  observeDeep (f) {
    addEventHandlerListener(this._dEH, f)
    return f
  }

  /**
   * Unregister an observer function.
   *
   * @param {(type:YEvent<DeltaToYType<DConf>>,tr:Transaction)=>void} f Observer function
   */
  unobserve (f) {
    removeEventHandlerListener(this._eH, f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {function(YEvent<DConf>,Transaction):void} f Observer function
   */
  unobserveDeep (f) {
    removeEventHandlerListener(this._dEH, f)
  }

  /**
   * Render the difference to another ydoc (which can be empty) and highlight the differences with
   * attributions.
   *
   * Note that deleted content that was not deleted in prevYdoc is rendered as an insertion with the
   * attribution `{ isDeleted: true, .. }`.
   *
   * @template {boolean} [Deep=false]
   *
   * @param {AbstractAttributionManager} am
   * @param {Object} [opts]
   * @param {import('./utils/IdSet.js').IdSet?} [opts.itemsToRender]
   * @param {boolean} [opts.retainInserts] - if true, retain rendered inserts with attributions
   * @param {boolean} [opts.retainDeletes] - if true, retain rendered+attributed deletes only
   * @param {import('./utils/IdSet.js').IdSet?} [opts.deletedItems] - used for computing prevItem in attributes
   * @param {Map<YType,Set<string|null>>|null} [opts.modified] - set of types that should be rendered as modified children
   * @param {Deep} [opts.deep] - render child types as delta
   * @return {Deep extends true ? delta.Delta<DConf> : delta.Delta<DeltaConfDeltaToYType<DConf>>} The Delta representation of this type.
   *
   * @public
   */
  getContent (am = noAttributionsManager, opts = {}) {
    const { itemsToRender = null, retainInserts = false, retainDeletes = false, deletedItems = null, modified = null, deep = false } = opts
    const renderAttrs = modified?.get(this) || null
    const renderChildren = !!(modified == null || modified.get(this)?.has(null))
    /**
     * @type {delta.DeltaBuilderAny}
     */
    const d = /** @type {any} */ (delta.create(this.name))
    const optsAll = modified == null ? opts : object.assign({}, opts, { modified: null })
    typeMapGetDelta(d, /** @type {any} */ (this), renderAttrs, am, deep, modified, deletedItems, itemsToRender, opts, optsAll)
    if (renderChildren) {
      /**
       * @type {delta.FormattingAttributes}
       */
      let currentAttributes = {} // saves all current attributes for insert
      let usingCurrentAttributes = false
      /**
       * @type {delta.FormattingAttributes}
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
       * @type {delta.FormattingAttributes}
       */
      const previousUnattributedAttributes = {} // contains previously known unattributed formatting
      /**
       * @type {delta.FormattingAttributes}
       */
      const previousAttributes = {} // The value before changes
      /**
       * @type {Array<import('./internals.js').AttributedContent<any>>}
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
            case ContentEmbed:
            case ContentAny:
            case ContentJSON:
            case ContentType:
            case ContentBinary:
              if (renderContent) {
                d.usedAttributes = currentAttributes
                usingCurrentAttributes = true
                if (c.deleted ? retainDeletes : retainInserts) {
                  d.retain(c.content.getLength(), null, attribution ?? {})
                } else if (deep && c.content.constructor === ContentType) {
                  d.insert([/** @type {any} */(c.content).type.getContent(am, optsAll)], null, attribution)
                } else {
                  d.insert(c.content.getContent(), null, attribution)
                }
              } else if (renderDelete) {
                d.delete(1)
              } else if (retainContent) {
                if (c.content.constructor === ContentType && modified?.has(/** @type {ContentType} */ (c.content).type)) {
                  // @todo use current transaction instead
                  d.modify(/** @type {any} */ (c.content).type.getContent(am, opts))
                } else {
                  d.usedAttributes = changedAttributes
                  usingChangedAttributes = true
                  d.retain(1)
                }
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
                 * @type {import('./utils/AttributionManager.js').Attribution}
                 */
                const formattingAttribution = object.assign({}, d.usedAttribution)
                const changedAttributedAttributes = /** @type {{ [key: string]: Array<any> }} */ (formattingAttribution.format = object.assign({}, formattingAttribution.format ?? {}))
                if (attribution == null || equalAttrs(previousUnattributedAttributes[key], currentAttributes[key] ?? null)) {
                  // an unattributed formatting attribute was found or an attributed formatting
                  // attribute was found that resets to the previous status
                  delete changedAttributedAttributes[key]
                  delete previousUnattributedAttributes[key]
                } else {
                  const by = changedAttributedAttributes[key] = (changedAttributedAttributes[key]?.slice() ?? [])
                  by.push(...((c.deleted ? attribution.delete : attribution.insert) ?? []))
                  const attributedAt = (c.deleted ? attribution.deletedAt : attribution.insertedAt)
                  if (attributedAt) formattingAttribution.formatAt = attributedAt
                }
                if (object.isEmpty(changedAttributedAttributes)) {
                  d.useAttribution(null)
                } else if (attribution != null) {
                  const attributedAt = (c.deleted ? attribution.deletedAt : attribution.insertedAt)
                  if (attributedAt != null) formattingAttribution.formatAt = attributedAt
                  d.useAttribution(formattingAttribution)
                }
              }
              break
            }
          }
        }
      }
    }
    return /** @type {any} */ (d.done(false))
  }

  /**
   * Render the difference to another ydoc (which can be empty) and highlight the differences with
   * attributions.
   *
   * @param {AbstractAttributionManager} am
   * @return {delta.Delta<DConf>}
   */
  getContentDeep (am = noAttributionsManager) {
    return /** @type {any} */ (this.getContent(am, { deep: true }))
  }

  /**
   * Apply a {@link Delta} on this shared type.
   *
   * @param {delta.DeltaAny} d The changes to apply on this element.
   * @param {AbstractAttributionManager} am
   *
   * @public
   */
  applyDelta (d, am = noAttributionsManager) {
    if (this.doc == null) {
      (this._prelim || (this._prelim = /** @type {any} */ (delta.create()))).apply(d)
    } else {
      // @todo this was moved here from ytext. Make this more generic
      transact(this.doc, transaction => {
        const currPos = new ItemTextListPosition(null, this._start, 0, new Map(), am)
        for (const op of d.children) {
          if (delta.$textOp.check(op)) {
            insertContent(transaction, /** @type {any} */ (this), currPos, new ContentString(op.insert), op.format || {})
          } else if (delta.$insertOp.check(op)) {
            insertContentHelper(transaction, this, currPos, op.insert, op.format || {})
          } else if (delta.$retainOp.check(op)) {
            currPos.formatText(transaction, /** @type {any} */ (this), op.retain, op.format || {})
          } else if (delta.$deleteOp.check(op)) {
            deleteText(transaction, currPos, op.delete)
          } else if (delta.$modifyOp.check(op)) {
            if (currPos.right) {
              /** @type {ContentType} */ (currPos.right.content).type.applyDelta(op.value)
            } else {
              error.unexpectedCase()
            }
            currPos.formatText(transaction, /** @type {any} */ (this), 1, op.format || {})
          } else {
            error.unexpectedCase()
          }
        }
        for (const op of d.attrs) {
          if (delta.$setAttrOp.check(op)) {
            typeMapSet(transaction, /** @type {any} */ (this), /** @type {any} */ (op.key), op.value)
          } else if (delta.$deleteAttrOp.check(op)) {
            typeMapDelete(transaction, /** @type {any} */ (this), /** @type {any} */ (op.key))
          } else {
            const sub = typeMapGet(/** @type {any} */ (this), /** @type {any} */ (op.key))
            if (!(sub instanceof YType)) {
              error.unexpectedCase()
            }
            sub.applyDelta(op.value)
          }
        }
      })
    }
    return this
  }

  /**
   * Makes a copy of this data type that can be included somewhere else.
   *
   * Note that the content is only readable _after_ it has been included somewhere in the Ydoc.
   *
   * @return {YType<DConf>}
   */
  clone () {
    const cpy = this._copy()
    cpy.applyDelta(this.getContentDeep())
    return cpy
  }

  /**
   * Removes all elements from this YMap.
   */
  clearAttrs () {
    const d = delta.create()
    this.forEachAttr((_, key) => {
      d.deleteAttr(/** @type {any} */ (key))
    })
    this.applyDelta(d)
  }

  /**
   * Removes an attribute from this YXmlElement.
   *
   * @param {string} attributeName The attribute name that is to be removed.
   *
   * @public
   */
  deleteAttr (attributeName) {
    this.applyDelta(delta.create().deleteAttr(attributeName).done())
  }

  /**
   * Sets or updates an attribute.
   *
   * @template {Exclude<keyof delta.DeltaConfGetAttrs<DConf>,symbol>} KEY
   * @template {delta.DeltaConfGetAttrs<DConf>[KEY]} VAL
   *
   * @param {KEY} attributeName The attribute name that is to be set.
   * @param {VAL} attributeValue The attribute value that is to be set.
   * @return {VAL}
   *
   * @public
   */
  setAttr (attributeName, attributeValue) {
    this.applyDelta(delta.create().setAttr(attributeName, attributeValue).done())
    return attributeValue
  }

  /**
   * Returns an attribute value that belongs to the attribute name.
   *
   * @template {Exclude<keyof delta.DeltaConfGetAttrs<DConf>,symbol|number>} KEY
   * @param {KEY} attributeName The attribute name that identifies the queried value.
   * @return {delta.DeltaConfGetAttrs<DConf>[KEY]|undefined} The queried attribute value.
   * @public
   */
  getAttr (attributeName) {
    return /** @type {any} */ (typeMapGet(this, attributeName))
  }

  /**
   * Returns whether an attribute exists
   *
   * @param {string} attributeName The attribute name to check for existence.
   * @return {boolean} whether the attribute exists.
   *
   * @public
   */
  hasAttr (attributeName) {
    return /** @type {any} */ (typeMapHas(this, attributeName))
  }

  /**
   * Returns all attribute name/value pairs in a JSON Object.
   *
   * @param {Snapshot} [snapshot]
   * @return {{ [Key in Extract<keyof delta.DeltaConfGetAttrs<DConf>,string>]?: delta.DeltaConfGetAttrs<DConf>[Key]}} A JSON Object that describes the attributes.
   *
   * @public
   */
  getAttrs (snapshot) {
    return /** @type {any} */ (snapshot ? typeMapGetAllSnapshot(this, snapshot) : typeMapGetAll(this))
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
   *  yarray.insert(1, [1, 2])
   *
   * @param {number} index The index to insert content at.
   * @param {Array<delta.DeltaConfGetChildren<DConf>>|delta.DeltaConfGetText<DConf>} content Array of content to append.
   * @param {delta.FormattingAttributes} [format]
   */
  insert (index, content, format) {
    this.applyDelta(delta.create().retain(index).insert(/** @type {any} */ (content), format))
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
   *  yarray.insert(1, [1, 2])
   *
   * @param {number} index The index to insert content at.
   * @param {number} length The index to insert content at.
   * @param {delta.FormattingAttributes} formats
   *
   */
  format (index, length, formats) {
    this.applyDelta(delta.create().retain(index).retain(length, formats))
  }

  /**
   * Inserts new content after another element.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  xml.insert(0, [new Y.XmlText('text')])
   *
   * @param {null|Item|YType} ref The index to insert content at
   * @param {Array<delta.DeltaConfGetChildren<DConf>>} content The array of content
   */
  insertAfter (ref, content) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        const refItem = ref && ref instanceof YType ? ref._item : ref
        typeListInsertGenericsAfter(transaction, this, refItem, content)
      })
    } else {
      // only possible once this item has been integrated
      error.unexpectedCase()
    }
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array<delta.DeltaConfGetChildren<DConf>>|delta.DeltaConfGetText<DConf>} content Array of content to append.
   *
   * @todo Use the following implementation in all types.
   */
  push (content) {
    this.insert(this.length, content)
  }

  /**
   * Prepends content to this YArray.
   *
   * @param {delta.DeltaConfGetText<DConf>} content Array of content to prepend.
   */
  unshift (content) {
    this.insert(0, content)
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {number} index Index at which to start deleting elements
   * @param {number} length The number of elements to remove. Defaults to 1.
   */
  delete (index, length = 1) {
    this.applyDelta(delta.create().retain(index).delete(length))
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {number} index The index of the element to return from the YArray
   * @return {delta.DeltaConfGetChildren<DConf>}
   */
  get (index) {
    return typeListGet(this, index)
  }

  /**
   * Returns a portion of this YXmlFragment into a JavaScript Array selected
   * from start to end (end not included).
   *
   * @param {number} [start]
   * @param {number} [end]
   * @return {Array<delta.DeltaConfGetChildren<DConf>>}
   */
  slice (start = 0, end = this.length) {
    return typeListSlice(this, start, end)
  }

  /**
   * @todo refactor this, this should use getContent only!
   *
   * Transforms this YArray to a JavaScript Array.
   *
   * @return {Array<delta.DeltaConfGetChildren<DConf> | delta.DeltaConfGetText<DConf>>}
   */
  toArray () {
    const dcontent = this.getContent()
    /**
     * @type {Array<any>}
     */
    const children = []
    for (const child of dcontent.children) {
      if (delta.$insertOp.check(child)) {
        children.push(...child.insert)
      } else if (delta.$textOp.check(child)) {
        children.push(child.insert)
      }
    }
    return children
  }

  /**
   * Transforms this Shared Type to a JSON object.
   * @return {{ name?: string, attrs?: { [K:string|number]: any }, children?: Array<any>  }}
   */
  toJSON () {
    /**
     * @type {{[K:string]:any}}
     */
    const attrs = this.getAttrs()
    for (const k in attrs) {
      const attr = attrs[k]
      attrs[k] = attr instanceof YType ? attr.toJSON() : attr
    }
    const children = this.toArray().map(child => child instanceof YType ? /** @type {any} */ (child.toJSON()) : child)
    /**
     * @type {any}
     */
    const res = {}
    if (this.name != null) {
      res.name = this.name
    }
    if (this.length > 0) {
      res.children = children
    }
    if (this.attrSize > 0) {
      res.attrs = attrs
    }
    return res
  }

  /**
   * @param {object} opts
   * @param {boolean} [opts.forceTag] enforce creating a surrouning <name /> tag, even if it is null.
   */
  toString ({ forceTag = false } = {}) {
    /**
     * @type {Array<[string|number,string]>}
     */
    const attrs = []
    this.forEachAttr((attr, key) => {
      attrs.push([(key), /** @type {any} */ (attr) instanceof YType ? attr.toString({ forceTag: true }) : JSON.stringify(attr)])
    })
    const attrsString = (attrs.length > 0 ? ' ' : '') + attrs.sort((a, b) => a[0].toString() < b[0].toString() ? -1 : 1).map(attr => attr[0] + '=' + attr[1]).join(' ')
    /**
     * @type {string}
     */
    const children = this.toArray().map(c => s.$string.check(c) ? c : (c instanceof YType ? c.toString({ forceTag: true }) : JSON.stringify(c))).join('')
    if (this.name == null && !forceTag && attrs.length === 0) {
      return children
    }
    if (this.length === 0) {
      return `<${this.name ?? ''}${attrsString} />`
    }
    return `<${this.name ?? ''}${attrsString}>${children}</${this.name ?? ''}>`
  }

  /**
   * Returns an Array with the result of calling a provided function on every
   * child-element.
   *
   * @template M
   * @param {(child:delta.DeltaConfGetChildren<DConf>|delta.DeltaConfGetText<DConf>,index:number)=>M} f Function that produces an element of the new Array
   * @return {Array<M>} A new array with each element being the result of the
   *                 callback function
   */
  map (f) {
    return this.toArray().map(f)
  }

  /**
   * Executes a provided function once on every element of this YArray.
   *
   * @param {(child:delta.DeltaConfGetChildren<DConf>|delta.DeltaConfGetText<DConf>,index:number)=>any} f Function that produces an element of the new Array
   */
  forEach (f) {
    return this.toArray().forEach(f)
  }

  /**
   * Executes a provided function on once on every key-value pair.
   *
   * @param {(val:delta.DeltaConfGetAttrs<DConf>[any],key:Exclude<keyof delta.DeltaConfGetAttrs<DConf>,symbol>,ytype:this)=>any} f
   */
  forEachAttr (f) {
    this._map.forEach((item, key) => {
      if (!item.deleted) {
        f(item.content.getContent()[item.length - 1], /** @type {any} */ (key), this)
      }
    })
  }

  /**
   * Returns the keys for each element in the YMap Type.
   *
   * @return {IterableIterator<import('lib0/ts').KeyOf<delta.DeltaConfGetAttrs<DConf>>>}
   */
  attrKeys () {
    return iterator.iteratorMap(createMapIterator(this), /** @param {any} v */ v => v[0])
  }

  /**
   * Returns the values for each element in the YMap Type.
   *
   * @return {IterableIterator<delta.DeltaConfGetAttrs<DConf>[any]>}
   */
  attrValues () {
    return iterator.iteratorMap(createMapIterator(this), /** @param {any} v */ v => v[1].content.getContent()[v[1].length - 1])
  }

  /**
   * Returns an Iterator of [key, value] pairs
   *
   * @return {IterableIterator<{ [K in keyof delta.DeltaConfGetAttrs<DConf>]: [K,delta.DeltaConfGetAttrs<DConf>[K]] }[any]>}
   */
  attrEntries () {
    return iterator.iteratorMap(createMapIterator(this), /** @param {any} v */ v => /** @type {any} */ ([v[0], v[1].content.getContent()[v[1].length - 1]]))
  }

  /**
   * Returns the number of stored attributes (count of key/value pairs)
   *
   * @return {number}
   */
  get attrSize () {
    return [...createMapIterator(this)].length
  }

  /**
   * @param {this} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.getContent().equals(other.getContent())
  }

  /**
   * @todo this doesn't need to live in a method.
   *
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
   */
  _write (encoder) {
    encoder.writeTypeRef(this._legacyTypeRef)
    switch (this._legacyTypeRef) {
      case contentType.YXmlElementRefID:
      case contentType.YXmlHookRefID: {
        encoder.writeKey(this.name)
        break
      }
    }
  }
}

/**
 * @param {import('./utils/UpdateDecoder.js').UpdateDecoderV1 | import('./utils/UpdateDecoder.js').UpdateDecoderV2} decoder
 * @return {YType}
 *
 * @private
 * @function
 */
export const readYType = decoder => {
  const typeRef = decoder.readTypeRef()
  const ytype = new YType(typeRef === contentType.YXmlElementRefID || typeRef === contentType.YXmlHookRefID ? decoder.readKey() : null)
  ytype._legacyTypeRef = typeRef
  return ytype
}

/**
 * @param {any} a
 * @param {any} b
 * @return {boolean}
 */
export const equalAttrs = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b && object.equalFlat(a, b))

/**
 * @template {delta.DeltaConf} DConf
 * @typedef {delta.DeltaConfOverwrite<DConf, {
 *     attrs: { [K in keyof delta.DeltaConfGetAttrs<DConf>]: DeltaToYType<delta.DeltaConfGetAttrs<DConf>[K]> },
 *     children: DeltaToYType<delta.DeltaConfGetChildren<DConf>>
 *   }>
 * } DeltaConfDeltaToYType
 */

/**
 * @template {any} Data
 * @typedef {Exclude<Data,delta.DeltaAny> | (Extract<Data,delta.DeltaAny> extends delta.Delta<infer DConf> ? (unknown extends DConf ? YType<DConf> : never) : never)} DeltaToYType
 */

/**
 * @param {YType<any>} type
 * @param {number} start
 * @param {number} end
 * @return {Array<any>}
 *
 * @private
 * @function
 */
export const typeListSlice = (type, start, end) => {
  type.doc ?? warnPrematureAccess()
  if (start < 0) {
    start = type._length + start
  }
  if (end < 0) {
    end = type._length + end
  }
  let len = end - start
  const cs = []
  let n = type._start
  while (n !== null && len > 0) {
    if (n.countable && !n.deleted) {
      const c = n.content.getContent()
      if (c.length <= start) {
        start -= c.length
      } else {
        for (let i = start; i < c.length && len > 0; i++) {
          cs.push(c[i])
          len--
        }
        start = 0
      }
    }
    n = n.right
  }
  return cs
}

/**
 * @todo remove / inline this
 *
 * @param {YType} type
 * @param {number} index
 * @return {any}
 *
 * @private
 * @function
 */
export const typeListGet = (type, index) => {
  type.doc ?? warnPrematureAccess()
  const marker = findMarker(type, index)
  let n = type._start
  if (marker !== null) {
    n = marker.p
    index -= marker.index
  }
  for (; n !== null; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index < n.length) {
        return n.content.getContent()[index]
      }
      index -= n.length
    }
  }
}

/**
 * @todo this is a duplicate. use the unified insert function and remove this.
 *
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {Item?} referenceItem
 * @param {Array<YValue>} content
 *
 * @private
 * @function
 */
export const typeListInsertGenericsAfter = (transaction, parent, referenceItem, content) => {
  let left = referenceItem
  const doc = transaction.doc
  const ownClientId = doc.clientID
  const store = doc.store
  const right = referenceItem === null ? parent._start : referenceItem.right
  /**
   * @type {Array<Object|Array<any>|number|null>}
   */
  let jsonContent = []
  const packJsonContent = () => {
    if (jsonContent.length > 0) {
      left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentAny(jsonContent))
      left.integrate(transaction, 0)
      jsonContent = []
    }
  }
  content.forEach(c => {
    if (c === null) {
      jsonContent.push(c)
    } else {
      switch (c.constructor) {
        case Number:
        case Object:
        case undefined:
        case Boolean:
        case Array:
        case String:
        case BigInt:
        case Date:
          jsonContent.push(c)
          break
        default:
          packJsonContent()
          switch (c.constructor) {
            case Uint8Array:
            case ArrayBuffer:
              left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentBinary(new Uint8Array(/** @type {Uint8Array} */ (c))))
              left.integrate(transaction, 0)
              break
            case Doc:
              left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentDoc(/** @type {Doc} */ (c)))
              left.integrate(transaction, 0)
              break
            default:
              if (c instanceof YType) {
                left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentType(/** @type {any} */ (c)))
                left.integrate(transaction, 0)
              } else {
                throw new Error('Unexpected content type in insert operation')
              }
          }
      }
    }
  })
  packJsonContent()
}

const lengthExceeded = () => error.create('Length exceeded!')

/**
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {number} index
 * @param {Array<Object<string,any>|Array<any>|number|null|string|Uint8Array>} content
 *
 * @private
 * @function
 */
export const typeListInsertGenerics = (transaction, parent, index, content) => {
  if (index > parent._length) {
    throw lengthExceeded()
  }
  if (index === 0) {
    if (parent._searchMarker) {
      updateMarkerChanges(parent._searchMarker, index, content.length)
    }
    return typeListInsertGenericsAfter(transaction, parent, null, content)
  }
  const startIndex = index
  const marker = findMarker(parent, index)
  let n = parent._start
  if (marker !== null) {
    n = marker.p
    index -= marker.index
    // we need to iterate one to the left so that the algorithm works
    if (index === 0) {
      // @todo refactor this as it actually doesn't consider formats
      n = n.prev // important! get the left undeleted item so that we can actually decrease index
      index += (n && n.countable && !n.deleted) ? n.length : 0
    }
  }
  for (; n !== null; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index <= n.length) {
        if (index < n.length) {
          // insert in-between
          getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index))
        }
        break
      }
      index -= n.length
    }
  }
  if (parent._searchMarker) {
    updateMarkerChanges(parent._searchMarker, startIndex, content.length)
  }
  return typeListInsertGenericsAfter(transaction, parent, n, content)
}

/**
 * Pushing content is special as we generally want to push after the last item. So we don't have to update
 * the search marker.
 *
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {Array<Object<string,any>|Array<any>|number|null|string|Uint8Array>} content
 *
 * @private
 * @function
 */
export const typeListPushGenerics = (transaction, parent, content) => {
  // Use the marker with the highest index and iterate to the right.
  const marker = (parent._searchMarker || []).reduce((maxMarker, currMarker) => currMarker.index > maxMarker.index ? currMarker : maxMarker, { index: 0, p: parent._start })
  let n = marker.p
  if (n) {
    while (n.right) {
      n = n.right
    }
  }
  return typeListInsertGenericsAfter(transaction, parent, n, content)
}

/**
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {number} index
 * @param {number} length
 *
 * @private
 * @function
 */
export const typeListDelete = (transaction, parent, index, length) => {
  if (length === 0) { return }
  const startIndex = index
  const startLength = length
  const marker = findMarker(parent, index)
  let n = parent._start
  if (marker !== null) {
    n = marker.p
    index -= marker.index
  }
  // compute the first item to be deleted
  for (; n !== null && index > 0; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index < n.length) {
        getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index))
      }
      index -= n.length
    }
  }
  // delete all items until done
  while (length > 0 && n !== null) {
    if (!n.deleted) {
      if (length < n.length) {
        getItemCleanStart(transaction, createID(n.id.client, n.id.clock + length))
      }
      n.delete(transaction)
      length -= n.length
    }
    n = n.right
  }
  if (length > 0) {
    throw lengthExceeded()
  }
  if (parent._searchMarker) {
    updateMarkerChanges(parent._searchMarker, startIndex, -startLength + length /* in case we remove the above exception */)
  }
}

/**
 * @todo inline this code
 *
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {string} key
 *
 * @private
 * @function
 */
export const typeMapDelete = (transaction, parent, key) => {
  const c = parent._map.get(key)
  if (c !== undefined) {
    c.delete(transaction)
  }
}

/**
 * @param {Transaction} transaction
 * @param {YType} parent
 * @param {string} key
 * @param {YValue} value
 *
 * @private
 * @function
 */
export const typeMapSet = (transaction, parent, key, value) => {
  const left = parent._map.get(key) || null
  const doc = transaction.doc
  const ownClientId = doc.clientID
  let content
  if (value == null) {
    content = new ContentAny([value])
  } else {
    switch (value.constructor) {
      case Number:
      case Object:
      case Boolean:
      case Array:
      case String:
      case Date:
      case BigInt:
        content = new ContentAny([value])
        break
      case Uint8Array:
        content = new ContentBinary(/** @type {Uint8Array} */ (value))
        break
      case Doc:
        content = new ContentDoc(/** @type {Doc} */ (value))
        break
      default:
        if (value instanceof YType) {
          content = new ContentType(/** @type {any} */ (value))
        } else {
          throw new Error('Unexpected content type')
        }
    }
  }
  new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, null, null, parent, key, content).integrate(transaction, 0)
}

/**
 * @param {YType<any>} parent
 * @param {string} key
 * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|YType<any>|undefined}
 *
 * @private
 * @function
 */
export const typeMapGet = (parent, key) => {
  parent.doc ?? warnPrematureAccess()
  const val = parent._map.get(key)
  return val !== undefined && !val.deleted ? val.content.getContent()[val.length - 1] : undefined
}

/**
 * @param {YType<any>} parent
 * @return {Object<string,Object<string,any>|number|null|Array<any>|string|Uint8Array|YType<any>|undefined>}
 *
 * @private
 * @function
 */
export const typeMapGetAll = (parent) => {
  /**
   * @type {Object<string,any>}
   */
  const res = {}
  parent.doc ?? warnPrematureAccess()
  parent._map.forEach((value, key) => {
    if (!value.deleted) {
      res[key] = value.content.getContent()[value.length - 1]
    }
  })
  return res
}

/**
 * @todo move this to getContent/getDelta
 *
 * Render the difference to another ydoc (which can be empty) and highlight the differences with
 * attributions.
 *
 * Note that deleted content that was not deleted in prevYdoc is rendered as an insertion with the
 * attribution `{ isDeleted: true, .. }`.
 *
 * @template {delta.DeltaBuilderAny} TypeDelta
 * @param {TypeDelta} d
 * @param {YType} parent
 * @param {Set<string|null>?} attrsToRender
 * @param {import('./internals.js').AbstractAttributionManager} am
 * @param {boolean} deep
 * @param {Set<YType>|Map<YType,any>|null} [modified] - set of types that should be rendered as modified children
 * @param {import('./utils/IdSet.js').IdSet?} [deletedItems]
 * @param {import('./utils/IdSet.js').IdSet?} [itemsToRender]
 * @param {any} [opts]
 * @param {any} [optsAll]
 *
 * @private
 * @function
 */
export const typeMapGetDelta = (d, parent, attrsToRender, am, deep, modified, deletedItems, itemsToRender, opts, optsAll) => {
  // @todo support modified ops!
  /**
   * @param {Item} item
   * @param {string} key
   */
  const renderAttrs = (item, key) => {
    /**
     * @type {Array<import('./internals.js').AttributedContent<any>>}
     */
    const cs = []
    am.readContent(cs, item.id.client, item.id.clock, item.deleted, item.content, 1)
    const { deleted, attrs, content, render } = cs[cs.length - 1]
    if (!render) return
    const attribution = createAttributionFromAttributionItems(attrs, deleted)
    let c = array.last(content.getContent())
    if (deleted) {
      if (itemsToRender == null || itemsToRender.hasId(item.lastId)) {
        d.deleteAttr(key, attribution, c)
      }
    } else if (deep && c instanceof YType && modified?.has(c)) {
      d.modifyAttr(key, c.getContent(am, opts))
    } else {
      // find prev content
      let prevContentItem = item
      // this algorithm is problematic. should check all previous content using am.readcontent
      for (; prevContentItem.left !== null && deletedItems?.hasId(prevContentItem.left.lastId); prevContentItem = prevContentItem.left) {
        // nop
      }
      const prevValue = (prevContentItem !== item && itemsToRender?.hasId(prevContentItem.lastId)) ? array.last(prevContentItem.content.getContent()) : undefined
      if (deep && c instanceof YType) {
        c = /** @type {any} */(c).getContent(am, optsAll)
      }
      d.setAttr(key, c, attribution, prevValue)
    }
  }
  if (attrsToRender == null) {
    parent._map.forEach(renderAttrs)
  } else {
    attrsToRender.forEach(key => key != null && renderAttrs(/** @type {Item} */ (parent._map.get(key)), key))
  }
}

/**
 * @param {YType<any>} parent
 * @param {string} key
 * @return {boolean}
 *
 * @private
 * @function
 */
export const typeMapHas = (parent, key) => {
  parent.doc ?? warnPrematureAccess()
  const val = parent._map.get(key)
  return val !== undefined && !val.deleted
}

/**
 * @param {YType<any>} parent
 * @param {string} key
 * @param {Snapshot} snapshot
 * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|YType<any>|undefined}
 *
 * @private
 * @function
 */
export const typeMapGetSnapshot = (parent, key, snapshot) => {
  let v = parent._map.get(key) || null
  while (v !== null && (!snapshot.sv.has(v.id.client) || v.id.clock >= (snapshot.sv.get(v.id.client) || 0))) {
    v = v.left
  }
  return v !== null && isVisible(v, snapshot) ? v.content.getContent()[v.length - 1] : undefined
}

/**
 * @param {YType<any>} parent
 * @param {Snapshot} snapshot
 * @return {Object<string,Object<string,any>|number|null|Array<any>|string|Uint8Array|YType<any>|undefined>}
 *
 * @private
 * @function
 */
export const typeMapGetAllSnapshot = (parent, snapshot) => {
  /**
   * @type {Object<string,any>}
   */
  const res = {}
  parent._map.forEach((value, key) => {
    /**
     * @type {Item|null}
     */
    let v = value
    while (v !== null && (!snapshot.sv.has(v.id.client) || v.id.clock >= (snapshot.sv.get(v.id.client) || 0))) {
      v = v.left
    }
    if (v !== null && isVisible(v, snapshot)) {
      res[key] = v.content.getContent()[v.length - 1]
    }
  })
  return res
}

/**
 * @param {YType<any> & { _map: Map<string, Item> }} type
 * @return {IterableIterator<Array<any>>}
 *
 * @private
 * @function
 */
export const createMapIterator = type => {
  type.doc ?? warnPrematureAccess()
  return iterator.iteratorFilter(type._map.entries(), /** @param {any} entry */ entry => !entry[1].deleted)
}
