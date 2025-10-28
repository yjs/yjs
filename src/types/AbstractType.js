import {
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
  ItemTextListPosition,
  insertText,
  deleteText,
  ContentDoc, UpdateEncoderV1, UpdateEncoderV2, Doc, Snapshot, Transaction, EventHandler, YEvent, Item, createAttributionFromAttributionItems, AbstractAttributionManager, YXmlElement, // eslint-disable-line
} from '../internals.js'

import * as delta from 'lib0/delta'
import * as array from 'lib0/array'
import * as map from 'lib0/map'
import * as iterator from 'lib0/iterator'
import * as error from 'lib0/error'
import * as math from 'lib0/math'
import * as log from 'lib0/logging'
import * as object from 'lib0/object'

/**
 * @typedef {import('../utils/types.js').YType} YType_
 */
/**
 * @typedef {import('../utils/types.js').YValue} _YValue
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
 * @param {import('../utils/types.js').YType} yarray
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

  // @todo remove!
  // assure position
  // {
  //   let start = yarray._start
  //   let pos = 0
  //   while (start !== p) {
  //     if (!start.deleted && start.countable) {
  //       pos += start.length
  //     }
  //     start = /** @type {Item} */ (start.right)
  //   }
  //   if (pos !== pindex) {
  //     debugger
  //     throw new Error('Gotcha position fail!')
  //   }
  // }
  // if (marker) {
  //   if (window.lengths == null) {
  //     window.lengths = []
  //     window.getLengths = () => window.lengths.sort((a, b) => a - b)
  //   }
  //   window.lengths.push(marker.index - pindex)
  //   console.log('distance', marker.index - pindex, 'len', p && p.parent.length)
  // }
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
 * @param {import('../utils/types.js').YType} t
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
 * @param {import('../utils/types.js').YType} type
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
    type = /** @type {import('../utils/types.js').YType} */ (type._item.parent)
  }
  callEventHandlerListeners(/** @type {any} */ (changedType._eH), event, transaction)
}

/**
 * Abstract Yjs Type class
 * @template {delta.Delta<any,any,any,any,any>} [EventDelta=delta.Delta<any,any,any,any,any>]
 * @template {AbstractType<any,any>} [Self=any]
 */
export class AbstractType {
  constructor () {
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
     * @type {EventHandler<YEvent<Self>,Transaction>}
     */
    this._eH = createEventHandler()
    /**
     * Deep event handlers
     * @type {EventHandler<Array<YEvent<any>>,Transaction>}
     */
    this._dEH = createEventHandler()
    /**
     * @type {null | Array<ArraySearchMarker>}
     */
    this._searchMarker = null
    /**
     * @type {EventDelta?}
     */
    this._prelim = null
  }

  /**
   * Returns a fresh delta that can be used to change this YType.
   * @type {EventDelta}
   */
  get change () {
    return /** @type {any} */ (delta.create())
  }

  /**
   * @return {import('../utils/types.js').YType|null}
   */
  get parent () {
    return /** @type {import('../utils/types.js').YType} */ (this._item ? this._item.parent : null)
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
   * @return {Self}
   */
  _copy () {
    // @ts-ignore
    return new this.constructor()
  }

  /**
   * Makes a copy of this data type that can be included somewhere else.
   *
   * Note that the content is only readable _after_ it has been included somewhere in the Ydoc.
   *
   * @return {Self}
   */
  clone () {
    // @todo remove this method from othern types by doing `_copy().apply(this.getContent())`
    throw error.methodUnimplemented()
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} _encoder
   */
  _write (_encoder) { }

  /**
   * The first non-deleted item
   */
  get _first () {
    let n = this._start
    while (n !== null && n.deleted) {
      n = n.right
    }
    return n
  }

  /**
   * Creates YEvent and calls all type observers.
   * Must be implemented by each type.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} _parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, _parentSubs) {
    if (!transaction.local && this._searchMarker) {
      this._searchMarker.length = 0
    }
  }

  /**
   * Observe all events that are created on this type.
   *
   * @param {(target: YEvent<Self>, tr: Transaction) => void} f Observer function
   */
  observe (f) {
    addEventHandlerListener(this._eH, f)
  }

  /**
   * Observe all events that are created by this type and its children.
   *
   * @param {function(Array<YEvent<any>>,Transaction):void} f Observer function
   */
  observeDeep (f) {
    addEventHandlerListener(this._dEH, f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {(type:YEvent<Self>,tr:Transaction)=>void} f Observer function
   */
  unobserve (f) {
    removeEventHandlerListener(this._eH, f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {function(Array<YEvent<any>>,Transaction):void} f Observer function
   */
  unobserveDeep (f) {
    removeEventHandlerListener(this._dEH, f)
  }

  /**
   * @abstract
   * @return {any}
   */
  toJSON () {}

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
   * @param {import('../utils/IdSet.js').IdSet?} [opts.itemsToRender]
   * @param {boolean} [opts.retainInserts] - if true, retain rendered inserts with attributions
   * @param {boolean} [opts.retainDeletes] - if true, retain rendered+attributed deletes only
   * @param {Set<string>?} [opts.renderAttrs] - set of attrs to render. if null, render all attributes
   * @param {boolean} [opts.renderChildren] - if true, retain rendered+attributed deletes only
   * @param {import('../utils/IdSet.js').IdSet?} [opts.deletedItems] - used for computing prevItem in attributes
   * @param {Set<import('../utils/types.js').YType>|Map<import('../utils/types.js').YType,any>|null} [opts.modified] - set of types that should be rendered as modified children
   * @param {Deep} [opts.deep] - render child types as delta
   * @return {Deep extends true ? ToDeepEventDelta<EventDelta> : EventDelta} The Delta representation of this type.
   *
   * @public
   */
  getContent (am = noAttributionsManager, opts = {}) {
    const { itemsToRender = null, retainInserts = false, retainDeletes = false, renderAttrs = null, renderChildren = true, deletedItems = null, modified = null, deep = false } = opts
    /**
     * @type {EventDelta extends delta.Delta<infer N,infer Attrs,infer Children,infer Text,any> ? delta.DeltaBuilder<N,Attrs,Children,Text,any> : never}
     */
    const d = /** @type {any} */ (delta.create(/** @type {any} */ (this).nodeName || null))
    typeMapGetDelta(d, /** @type {any} */ (this), renderAttrs, am, deep, modified, deletedItems, itemsToRender)
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
                  d.insert([/** @type {any} */(c.content).type.getContent(am, opts)], null, attribution)
                } else {
                  d.insert(c.content.getContent(), null, attribution)
                }
              } else if (renderDelete) {
                d.delete(1)
              } else if (retainContent) {
                if (c.content.constructor === ContentType && modified?.has(/** @type {ContentType} */ (c.content).type)) {
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
                 * @type {import('../utils/AttributionManager.js').Attribution}
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
    return /** @type {any} */ (d.done())
  }

  /**
   * Render the difference to another ydoc (which can be empty) and highlight the differences with
   * attributions.
   *
   * @param {AbstractAttributionManager} am
   * @return {ToDeepEventDelta<EventDelta>}
   */
  getContentDeep (am = noAttributionsManager) {
    return /** @type {any} */ (this.getContent(am, { deep: true }))
  }

  /**
   * Apply a {@link Delta} on this shared type.
   *
   * @param {delta.Delta<any,any,any,any,any>} d The changes to apply on this element.
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
            insertText(transaction, /** @type {any} */ (this), currPos, op.insert, op.format || {})
          } else if (delta.$insertOp.check(op)) {
            for (let i = 0; i < op.insert.length; i++) {
              let ins = op.insert[i]
              if (delta.$deltaAny.check(ins)) {
                if (ins.name != null) {
                  const t = new YXmlElement(ins.name)
                  t.applyDelta(ins)
                  ins = t
                } else {
                  error.unexpectedCase()
                }
              }
              insertText(transaction, /** @type {any} */ (this), currPos, ins, op.format || {})
            }
          } else if (delta.$retainOp.check(op)) {
            currPos.formatText(transaction, /** @type {any} */ (this), op.retain, op.format || {})
          } else if (delta.$deleteOp.check(op)) {
            deleteText(transaction, currPos, op.delete)
          } else if (delta.$modifyOp.check(op)) {
            /** @type {ContentType} */ (currPos.right?.content).type.applyDelta(op.value)
            currPos.formatText(transaction, /** @type {any} */ (this), 1, op.format || {})
          }
        }
      })
    }
  }
}

/**
 * @param {any} a
 * @param {any} b
 * @return {boolean}
 */
export const equalAttrs = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b && object.equalFlat(a, b))

/**
 * @template {delta.Delta<any,any,any,any,any>} D
 * @typedef {D extends delta.Delta<infer N,infer Attrs,infer Cs,infer Text,any>
 *   ? delta.Delta<
 *       N,
 *       { [K in keyof Attrs]: TypeToDelta<Attrs[K]> },
 *       TypeToDelta<Cs>,
 *       Text
 *     >
 *   : D
 * } ToDeepEventDelta
 */

/**
 * @template {any} T
 * @typedef {(Extract<T,AbstractType<any>> extends AbstractType<infer D> ? (unknown extends D ? never : ToDeepEventDelta<D>) : never) | Exclude<T,AbstractType<any>>} TypeToDelta
 */

/**
 * @param {AbstractType<any>} type
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
 * @param {import('../utils/types.js').YType} type
 * @return {Array<any>}
 *
 * @private
 * @function
 */
export const typeListToArray = type => {
  type.doc ?? warnPrematureAccess()
  const cs = []
  let n = type._start
  while (n !== null) {
    if (n.countable && !n.deleted) {
      const c = n.content.getContent()
      for (let i = 0; i < c.length; i++) {
        cs.push(c[i])
      }
    }
    n = n.right
  }
  return cs
}

/**
 * @param {AbstractType<any>} type
 * @param {Snapshot} snapshot
 * @return {Array<any>}
 *
 * @private
 * @function
 */
export const typeListToArraySnapshot = (type, snapshot) => {
  const cs = []
  let n = type._start
  while (n !== null) {
    if (n.countable && isVisible(n, snapshot)) {
      const c = n.content.getContent()
      for (let i = 0; i < c.length; i++) {
        cs.push(c[i])
      }
    }
    n = n.right
  }
  return cs
}

/**
 * Executes a provided function on once on every element of this YArray.
 *
 * @param {AbstractType<any>} type
 * @param {function(any,number,any):void} f A function to execute on every element of this YArray.
 *
 * @private
 * @function
 */
export const typeListForEach = (type, f) => {
  let index = 0
  let n = type._start
  type.doc ?? warnPrematureAccess()
  while (n !== null) {
    if (n.countable && !n.deleted) {
      const c = n.content.getContent()
      for (let i = 0; i < c.length; i++) {
        f(c[i], index++, type)
      }
    }
    n = n.right
  }
}

/**
 * @template C,R
 * @param {AbstractType<any>} type
 * @param {function(C,number,AbstractType<any>):R} f
 * @return {Array<R>}
 *
 * @private
 * @function
 */
export const typeListMap = (type, f) => {
  /**
   * @type {Array<any>}
   */
  const result = []
  typeListForEach(type, (c, i) => {
    result.push(f(c, i, type))
  })
  return result
}

/**
 * @param {AbstractType} type
 * @return {IterableIterator<any>}
 *
 * @private
 * @function
 */
export const typeListCreateIterator = type => {
  let n = type._start
  /**
   * @type {Array<any>|null}
   */
  let currentContent = null
  let currentContentIndex = 0
  return {
    [Symbol.iterator] () {
      return this
    },
    next: () => {
      // find some content
      if (currentContent === null) {
        while (n !== null && n.deleted) {
          n = n.right
        }
        // check if we reached the end, no need to check currentContent, because it does not exist
        if (n === null) {
          return {
            done: true,
            value: undefined
          }
        }
        // we found n, so we can set currentContent
        currentContent = n.content.getContent()
        currentContentIndex = 0
        n = n.right // we used the content of n, now iterate to next
      }
      const value = currentContent[currentContentIndex++]
      // check if we need to empty currentContent
      if (currentContent.length <= currentContentIndex) {
        currentContent = null
      }
      return {
        done: false,
        value
      }
    }
  }
}

/**
 * Executes a provided function on once on every element of this YArray.
 * Operates on a snapshotted state of the document.
 *
 * @param {AbstractType} type
 * @param {function(any,number,AbstractType):void} f A function to execute on every element of this YArray.
 * @param {Snapshot} snapshot
 *
 * @private
 * @function
 */
export const typeListForEachSnapshot = (type, f, snapshot) => {
  let index = 0
  let n = type._start
  while (n !== null) {
    if (n.countable && isVisible(n, snapshot)) {
      const c = n.content.getContent()
      for (let i = 0; i < c.length; i++) {
        f(c[i], index++, type)
      }
    }
    n = n.right
  }
}

/**
 * @param {import('../utils/types.js').YType} type
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
 * @param {Transaction} transaction
 * @param {YType_} parent
 * @param {Item?} referenceItem
 * @param {Array<_YValue>} content
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
              if (c instanceof AbstractType) {
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
 * @param {YType_} parent
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
 * @param {YType_} parent
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
 * @param {import('../utils/types.js').YType} parent
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
 * @param {Transaction} transaction
 * @param {YType_} parent
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
 * @param {YType_} parent
 * @param {string} key
 * @param {_YValue} value
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
        if (value instanceof AbstractType) {
          content = new ContentType(/** @type {any} */ (value))
        } else {
          throw new Error('Unexpected content type')
        }
    }
  }
  new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, null, null, parent, key, content).integrate(transaction, 0)
}

/**
 * @param {YType_} parent
 * @param {string} key
 * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
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
 * @param {AbstractType<any>} parent
 * @return {Object<string,Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined>}
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
 * Render the difference to another ydoc (which can be empty) and highlight the differences with
 * attributions.
 *
 * Note that deleted content that was not deleted in prevYdoc is rendered as an insertion with the
 * attribution `{ isDeleted: true, .. }`.
 *
 * @template {delta.DeltaBuilder<any,any,any,any>} TypeDelta
 * @param {TypeDelta} d
 * @param {YType_} parent
 * @param {Set<string>?} attrsToRender
 * @param {import('../internals.js').AbstractAttributionManager} am
 * @param {boolean} deep
 * @param {Set<import('../utils/types.js').YType>|Map<import('../utils/types.js').YType,any>|null} [modified] - set of types that should be rendered as modified children
 * @param {import('../utils/IdSet.js').IdSet?} [deletedItems]
 * @param {import('../utils/IdSet.js').IdSet?} [itemsToRender]
 *
 * @private
 * @function
 */
export const typeMapGetDelta = (d, parent, attrsToRender, am, deep, modified, deletedItems, itemsToRender) => {
  // @todo support modified ops!
  /**
   * @param {Item} item
   * @param {string} key
   */
  const renderAttrs = (item, key) => {
    /**
     * @type {Array<import('../internals.js').AttributedContent<any>>}
     */
    const cs = []
    am.readContent(cs, item.id.client, item.id.clock, item.deleted, item.content, 1)
    const { deleted, attrs, content } = cs[cs.length - 1]
    const attribution = createAttributionFromAttributionItems(attrs, deleted)
    let c = array.last(content.getContent())
    if (deleted) {
      if (itemsToRender == null || itemsToRender.hasId(item.lastId)) {
        d.unset(key, attribution, c)
      }
    } else {
      // find prev content
      let prevContentItem = item
      // this algorithm is problematic. should check all previous content using am.readcontent
      for (; prevContentItem.left !== null && deletedItems?.hasId(prevContentItem.left.lastId); prevContentItem = prevContentItem.left) {
        // nop
      }
      const prevValue = (prevContentItem !== item && itemsToRender?.hasId(prevContentItem.lastId)) ? array.last(prevContentItem.content.getContent()) : undefined
      if (deep && c instanceof AbstractType) {
        c = /** @type {any} */(c).getContent(am)
      }
      d.set(key, c, attribution, prevValue)
    }
  }
  if (attrsToRender == null) {
    parent._map.forEach(renderAttrs)
  } else {
    attrsToRender.forEach(key => renderAttrs(/** @type {Item} */ (parent._map.get(key)), key))
  }
}

/**
 * @param {AbstractType<any>} parent
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
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @param {Snapshot} snapshot
 * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
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
 * @param {AbstractType<any>} parent
 * @param {Snapshot} snapshot
 * @return {Object<string,Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined>}
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
 * @param {AbstractType<any> & { _map: Map<string, Item> }} type
 * @return {IterableIterator<Array<any>>}
 *
 * @private
 * @function
 */
export const createMapIterator = type => {
  type.doc ?? warnPrematureAccess()
  return iterator.iteratorFilter(type._map.entries(), /** @param {any} entry */ entry => !entry[1].deleted)
}
