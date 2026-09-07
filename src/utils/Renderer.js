import { ObservableV2 } from 'lib0/observable'
import * as encoding from 'lib0/encoding'

import { getItemCleanStart } from './transaction-helpers.js'
import { diffIdSet, createInsertSetFromStructStore, createDeleteSetFromStructStore, insertIntoIdSet, mergeIdSets, intersectSets, createIdSet, createIdSetFromIdMap, writeIdSet, createIdMapFromIdSet, insertIntoIdMap, diffIdMap, createIdMap, mergeIdMaps, intersectMaps, createMaybeAttrRange, createContentAttribute } from './ids.js'
import { ContentDeleted, ContentFormat, ContentType } from '../structs/Item.js'
import { createID } from './ID.js'
import { writeStructsFromIdSet } from './encoding-helpers.js'
import { applyUpdate, encodeStateAsUpdate } from './encoding.js'
import { UpdateEncoderV1 } from './UpdateEncoder.js'
import { transact } from './Transaction.js'
import { UndoManager, StackItem } from './UndoManager.js'

import { $renderer, AttributedContent } from './renderer-helpers.js'

export { AbstractRenderer, rendererContentLength, $renderer } from './renderer-helpers.js'

/**
 * Emit a single content piece into `contents`, applying the rendering rules of
 * {@link AttributionsRenderer}. `inRC` is whether the piece is in `renderedContent` (renders normally,
 * even when the item is deleted — a "restore"); `attrs` is its attribution (or `null`).
 *
 * @param {Array<AttributedContent<any>>} contents - where to write the result
 * @param {AbstractContent} c
 * @param {number} clock
 * @param {boolean} deleted - the item's doc deleted flag
 * @param {boolean} inRC - whether this piece is in `renderedContent`
 * @param {Array<ContentAttribute<any>>|null} attrs
 * @param {0|1|2|3} shouldRender - see {@link AbstractRenderer#readContent}
 */
const pushAttributedPiece = (contents, c, clock, deleted, inRC, attrs, shouldRender) => {
  if (inRC || attrs != null) {
    // Visible: rendered normally (in `renderedContent`) and/or attributed. A restored deletion
    // (`inRC`) renders as alive, so its effective `deleted` flag is cleared.
    contents.push(new AttributedContent(c, clock, deleted && !inRC, attrs, shouldRender))
  } else if (deleted && shouldRender !== 0 && shouldRender !== 3) {
    // Genuinely deleted, unattributed, not restored: preserve the legacy retain/delete-op
    // behavior (mode 3 renders unattributed deleted content as nothing — see DiffRenderer).
    contents.push(new AttributedContent(c, clock, true, null, shouldRender))
  }
  // else: hidden alive content (or invisible deleted content under mode 0/3) — emit nothing.
}

/**
 * Renders content with attributions, given a single `attributions` {@link ContentMap} of how to
 * attribute content and an optional `renderedContent` {@link IdSet} of what renders.
 *
 * - `attributions` (inserts ∪ deletes) is merged into a single `renderAs` map; content it covers
 *   always renders, carrying its attribution.
 * - `renderedContent` defines the content that renders *normally* — even if the item is marked
 *   deleted in the doc (a "restore"). It defaults to the doc's alive content (`inserts − deletes`),
 *   applied implicitly (a piece is in the default set ⟺ its item is not `deleted`), so the common
 *   "pure attribution overlay" case does no extra work. When a custom set is supplied it is
 *   authoritative: alive content omitted from it (and unattributed) is hidden.
 *
 * Restoring deleted content requires `gc: false` on the doc (the renderer does not rehydrate
 * garbage-collected content, unlike {@link DiffRenderer}).
 *
 * @implements AbstractRenderer
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class AttributionsRenderer extends ObservableV2 {
  /**
   * @param {ContentMap} attributions - how to attribute content (`{ inserts, deletes }` IdMaps)
   * @param {Object} [options]
   * @param {IdSet?} [options.renderedContent] - content that renders normally; defaults to the
   * doc's alive content (`inserts − deletes`), applied implicitly.
   */
  constructor (attributions, { renderedContent = null } = {}) {
    super()
    /**
     * The two attribution maps merged into one — `readContent` consults this for how to attribute
     * a piece.
     * @type {IdMap<any>}
     */
    this.renderAs = mergeIdMaps([attributions.inserts, attributions.deletes])
    /**
     * Coverage of `renderAs` (ids that carry attributions). The small set `hasItem` checks. May
     * over-approximate what actually renders — `readContent` remains authoritative. See
     * {@link AbstractRenderer#attributed}.
     * @type {IdSet}
     */
    this.attributed = createIdSetFromIdMap(this.renderAs)
    /**
     * Custom "content that renders normally" set, or `null` to use the implicit default
     * (alive ⟺ `!item.deleted`).
     * @type {IdSet?}
     */
    this.renderedContent = renderedContent
    /**
     * Union of `renderedContent` and `attributed` — the single cheap "does this produce visible
     * output?" set. Only materialized when a custom `renderedContent` is supplied.
     * @type {IdSet?}
     */
    this.rendered = renderedContent === null ? null : mergeIdSets([renderedContent, this.attributed])
  }

  get $type () { return $renderer }

  /**
   * @param {Item} item
   * @return {boolean}
   */
  hasItem (item) {
    const { client, clock } = item.id
    if (this.attributed.intersects(client, clock, item.length)) return true
    if (this.renderedContent === null) return false
    // Custom renderedContent differs from the generic fast path for: deleted content that must be
    // restored, and alive content that must be hidden (not fully covered).
    return item.deleted
      ? this.renderedContent.intersects(client, clock, item.length)
      : !this.renderedContent.covers(client, clock, item.length)
  }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} client
   * @param {number} clock
   * @param {boolean} deleted
   * @param {AbstractContent} content
   * @param {0|1|2|3} shouldRender - whether this should render or just result in a `retain` operation (see AbstractRenderer#readContent)
   */
  readContent (contents, client, clock, deleted, content, shouldRender) {
    const total = content.getLength()
    /**
     * Segments of the item partitioned by `renderedContent`, or `null` when `inRC` is uniform over
     * the whole item (the common case: default set, or a custom set that fully contains/excludes
     * the item). `null` lets us slice `renderAs` once.
     * @type {Array<import('./ids.js').MaybeIdRange>?}
     */
    let outer = null
    let inRC = !deleted // implicit default: alive ⟺ rendered normally
    if (this.renderedContent !== null) {
      outer = this.renderedContent.slice(client, clock, total)
      if (outer.length === 1) {
        inRC = outer[0].exists
        outer = null
      }
    }
    if (outer === null) {
      // Uniform `inRC` — a single `renderAs` slice fixes the attribution boundaries.
      const slice = this.renderAs.slice(client, clock, total)
      let rest = slice.length === 1 ? content : content.copy()
      for (let i = 0; i < slice.length; i++) {
        const s = slice[i]
        const c = rest
        if (i < slice.length - 1) rest = c.splice(s.len)
        pushAttributedPiece(contents, c, s.clock, deleted, inRC, s.attrs, shouldRender)
      }
      return
    }
    // General case: partition by `renderedContent` (outer, fixes `inRC`/effectiveDeleted), then by
    // `renderAs` (inner, fixes attrs). Multiple outer segments ⇒ multi-id (string-like) content, so
    // copying to avoid mutating the caller's content is safe.
    let rest = content.copy()
    for (let oi = 0; oi < outer.length; oi++) {
      const rcSeg = outer[oi]
      const slice = this.renderAs.slice(client, rcSeg.clock, rcSeg.len)
      for (let ii = 0; ii < slice.length; ii++) {
        const s = slice[ii]
        const last = oi === outer.length - 1 && ii === slice.length - 1
        const c = rest
        if (!last) rest = c.splice(s.len)
        pushAttributedPiece(contents, c, s.clock, deleted, rcSeg.exists, s.attrs, shouldRender)
      }
    }
  }

  /**
   * @param {Item} item
   * @return {number}
   */
  contentLength (item) {
    if (!item.content.isCountable()) {
      return 0
    }
    const { client, clock } = item.id
    if (this.renderedContent === null) {
      // Default: alive content renders in full; deleted content only where attributed.
      return item.deleted ? this.renderAs.coveredLength(client, clock, item.length) : item.length
    }
    // Custom: rendered length is |item ∩ rendered| (renderedContent ∪ attributed).
    return /** @type {IdSet} */ (this.rendered).coveredLength(client, clock, item.length)
  }
}

/**
 * @param {ContentMap} attributions - how to attribute content (`{ inserts, deletes }` IdMaps)
 * @param {Object} [options]
 * @param {IdSet?} [options.renderedContent] - content that renders normally; defaults to the doc's
 * alive content (`inserts − deletes`).
 */
export const createAttributionsRenderer = (attributions, options) => new AttributionsRenderer(attributions, options)

/**
 * @param {StructStore} store
 * @param {number} client
 * @param {number} clock
 * @param {number} len
 */
const getItemContent = (store, client, clock, len) => {
  // Retrieved item is never more fragmented than the newer item.
  const prevItem = store.getItem(createID(client, clock))
  const diffStart = clock - prevItem.id.clock
  let content = prevItem.length > 1 ? prevItem.content.copy() : prevItem.content
  // trim itemContent to the correct size.
  if (diffStart > 0) {
    content = content.splice(diffStart)
  }
  if (len < content.getLength()) {
    content.splice(len)
  }
  return content
}

/**
 * Collect the whole subtree of an accepted pending node insert. A nested item can only exist in
 * the suggestion doc if its parent does, so every attribute entry and every child of an accepted
 * node belongs to the same suggestion - the attributes in particular: shipped without them, the
 * node that reaches the base doc is not the node that was suggested (an image without its `src`,
 * a paragraph without its text). Deleted nested items are transient (inserted and deleted within
 * the suggestion) and are collected like the top-level `collectAll` case; the receiving document
 * filters what it already holds.
 *
 * @param {import('../ynode.js').YNode} type
 * @param {IdSet} inserts
 * @param {IdSet} deletes
 */
const collectSubtree = (type, inserts, deletes) => {
  /**
   * @type {Array<Item|null>}
   */
  const chains = [type._start]
  type._map.forEach(item => { chains.push(item) })
  for (const chain of chains) {
    // list items chain to the right, map entries to the left (their overwritten values)
    for (let item = chain; item != null; item = item.parentSub != null ? item.left : item.right) {
      inserts.add(item.id.client, item.id.clock, item.length)
      if (item.deleted) {
        deletes.add(item.id.client, item.id.clock, item.length)
      } else if (item.content instanceof ContentType) {
        collectSubtree(item.content.type, inserts, deletes)
      }
    }
  }
}

/**
 * @param {Transaction?} tr - only specify this if you want to fill the content of deleted content
 * @param {DiffRenderer} renderer
 * @param {ID} start
 * @param {ID} end
 * @param {boolean} collectAll - collect as many items as possible. Accept adding redundant changes.
 *   An accepted node insert then also collects its subtree (see {@link collectSubtree}).
 */
const collectSuggestedChanges = (tr, renderer, start, end, collectAll) => {
  const inserts = createIdSet()
  const deletes = createIdSet()
  const store = renderer._nextDoc.store
  /**
   * make sure to collect suggestions until all formats are closed
   * @type {Set<string>}
   */
  const openedCollectedFormats = new Set()
  /**
   * @type {Item?}
   */
  let item = store.getItem(start)
  const endItem = start === end ? item : (end == null ? null : store.getItem(end))

  // walk to the left and find first un-attributed change that is rendered
  while (item.left != null) {
    item = item.left
    if (item.content instanceof ContentFormat && item.content.value == null) {
      item = item.right
      break
    }
    if (!item.deleted) {
      const slice = renderer.inserts.slice(item.id.client, item.id.clock, item.length)
      if (slice.some(s => s.attrs === null)) {
        for (let i = slice.length - 1; i >= 0; i--) {
          const s = slice[i]
          if (s.attrs == null) break
          inserts.add(item.id.client, s.clock, s.len)
          if (collectAll && item.content instanceof ContentType) {
            collectSubtree(item.content.type, inserts, deletes)
          }
        }
        item = item.right
        break
      }
    }
  }
  let foundEndItem = false
  // eslint-disable-next-line
  itemLoop: while (item != null) {
    const itemClient = item.id.client
    const slice = (item.deleted ? renderer.deletes : renderer.inserts).slice(itemClient, item.id.clock, item.length)
    foundEndItem ||= item === endItem
    if (item.deleted) {
      // item probably gc'd content. Need to split item and fill with content again
      for (let i = slice.length - 1; i >= 0; i--) {
        const s = slice[i]
        if (s.attrs != null || collectAll) {
          deletes.add(itemClient, s.clock, s.len)
          if (collectAll) {
            // in case item has been added and deleted this might be necessary. the forked document
            // will automatically filter this if it doesn't have it already.
            inserts.add(itemClient, s.clock, s.len)
          }
        }
        if (tr != null) {
          const splicedItem = getItemCleanStart(tr, createID(itemClient, s.clock))
          if (s.attrs != null) {
            splicedItem.content = getItemContent(renderer._prevDocStore, itemClient, s.clock, s.len)
          }
        }
      }
    } else {
      if (item.content instanceof ContentFormat) {
        const { key, value } = item.content
        if (value == null) {
          openedCollectedFormats.delete(key)
        } else {
          openedCollectedFormats.add(key)
        }
      }
      for (let i = 0; i < slice.length; i++) {
        const s = slice[i]
        if (s.attrs != null) {
          inserts.add(itemClient, s.clock, s.len)
          if (collectAll && item.content instanceof ContentType) {
            collectSubtree(item.content.type, inserts, deletes)
          }
        } else if (foundEndItem && openedCollectedFormats.size === 0) {
          // eslint-disable-next-line
          break itemLoop
        }
      }
    }
    item = item.right
  }
  return { inserts, deletes }
}

/**
 * @param {IdMap<any>|undefined} attrs
 * @param {IdSet} slice
 *
 */
const extractAttributions = (attrs, slice) => attrs == null ? createIdMapFromIdSet(slice, []) : mergeIdMaps([intersectMaps(attrs, slice), createIdMapFromIdSet(slice, [])])

/**
 * @implements AbstractRenderer
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class DiffRenderer extends ObservableV2 {
  /**
   * @param {Doc} prevDoc
   * @param {Doc} nextDoc
   * @param {Object} [options] - options for the renderer
   * @param {ContentMap?} [options.attributions] - the attributions to apply to the diff
   */
  constructor (prevDoc, nextDoc, { attributions = null } = {}) {
    super()
    const _nextDocInserts = createInsertSetFromStructStore(nextDoc.store, false) // unmaintained
    const _prevDocInserts = createInsertSetFromStructStore(prevDoc.store, false) // unmaintained
    const nextDocDeletes = createDeleteSetFromStructStore(nextDoc.store) // maintained
    const prevDocDeletes = createDeleteSetFromStructStore(prevDoc.store) // maintained
    const insertDiff = diffIdSet(_nextDocInserts, _prevDocInserts)
    const deleteDiff = diffIdSet(nextDocDeletes, prevDocDeletes)
    this.inserts = extractAttributions(attributions?.inserts, insertDiff)
    this.deletes = extractAttributions(attributions?.deletes, deleteDiff)
    /**
     * Raw coverage of `inserts` ∪ `deletes`, maintained alongside them. Over-approximates the
     * actually-rendered set (e.g. it keeps suggested-inserts that were deleted later) —
     * `readContent` remains authoritative. See {@link AbstractRenderer#attributed}.
     * @type {IdSet}
     */
    this.attributed = mergeIdSets([insertDiff, deleteDiff])
    this._prevDoc = prevDoc
    this._prevDocStore = prevDoc.store
    this._nextDoc = nextDoc
    // update before observer calls fired
    this._nextBOH = nextDoc.on('beforeObserverCalls', tr => {
      // update inserts
      const diffInserts = diffIdSet(tr.insertSet, _prevDocInserts)
      insertIntoIdMap(this.inserts, extractAttributions(attributions?.inserts, diffInserts))
      // update deletes
      const diffDeletes = diffIdSet(diffIdSet(tr.deleteSet, prevDocDeletes), this.inserts)
      insertIntoIdMap(this.deletes, extractAttributions(attributions?.deletes, diffDeletes))
      insertIntoIdSet(this.attributed, diffInserts)
      insertIntoIdSet(this.attributed, diffDeletes)
      // @todo fire update ranges on `diffInserts` and `diffDeletes`
    })
    this._prevBOH = prevDoc.on('beforeObserverCalls', tr => {
      insertIntoIdSet(_prevDocInserts, tr.insertSet)
      insertIntoIdSet(prevDocDeletes, tr.deleteSet)
      if (tr.insertSet.clients.size < 2) {
        tr.insertSet.forEach((attrRange, client) => {
          this.inserts.delete(client, attrRange.clock, attrRange.len)
        })
      } else {
        this.inserts = diffIdMap(this.inserts, tr.insertSet)
      }
      // insertIntoIdMap(this.deletes, createIdMapFromIdSet(intersectSets(tr.deleteSet, this.deletes), [createAttributionItem('acceptDelete', 'unknown')]))
      if (tr.deleteSet.clients.size < 2) {
        tr.deleteSet.forEach((attrRange, client) => {
          this.deletes.delete(client, attrRange.clock, attrRange.len)
        })
      } else {
        this.deletes = diffIdMap(this.deletes, tr.deleteSet)
      }
      // evict the accepted/rejected ranges from the coverage set, then re-add whatever the maps
      // still claim: `tr.insertSet` only evicts insert-attributions and `tr.deleteSet` only evicts
      // delete-attributions, but a single range can be covered by both maps (e.g. an accepted
      // insert with a still-pending delete suggestion on the same ids must stay attributed).
      const evicted = mergeIdSets([tr.insertSet, tr.deleteSet])
      this.attributed = diffIdSet(this.attributed, evicted)
      insertIntoIdSet(this.attributed, intersectSets(evicted, this.inserts))
      insertIntoIdSet(this.attributed, intersectSets(evicted, this.deletes))
      // fire event of "changed" attributions. exclude items that were added & deleted in the same
      // transaction
      this.emit('change', [diffIdSet(mergeIdSets([tr.insertSet, tr.deleteSet]), intersectSets(tr.insertSet, tr.deleteSet)), tr.origin, tr.local])
    })
    // changes from prevDoc should always flow into suggestionDoc
    // changes from suggestionDoc only flow into ydoc if suggestion-mode is disabled
    this._prevUpdateListener = prevDoc.on('update', (update, origin) => {
      origin !== this && applyUpdate(nextDoc, update)
    })
    this._ndUpdateListener = nextDoc.on('update', (update, origin, _doc, tr) => {
      // only if event is local and suggestion mode is enabled
      if (!this.suggestionMode && tr.local && (this.suggestionOrigins == null || this.suggestionOrigins.some(o => o === origin))) {
        applyUpdate(prevDoc, update, this)
      }
    })
    this._afterTrListener = nextDoc.on('afterTransaction', (tr) => {
      // apply deletes on attributed deletes (content that is already deleted, but is rendered by
      // the renderer)
      if (!this.suggestionMode && tr.local && (this.suggestionOrigins == null || this.suggestionOrigins.some(o => o === tr.origin))) {
        const attributedDeletes = tr.meta.get('attributedDeletes')
        if (attributedDeletes != null) {
          transact(prevDoc, () => {
            // apply attributed deletes if there are any
            const ds = new UpdateEncoderV1()
            encoding.writeVarUint(ds.restEncoder, 0) // encode 0 structs
            writeIdSet(ds, attributedDeletes)
            applyUpdate(prevDoc, ds.toUint8Array())
          }, this)
        }
      }
    })
    this.suggestionMode = true
    /**
     * Optionally limit origins that may sync changes to the main doc if suggestion-mode is
     * disabled.
     *
     * @type {Array<any>?}
     */
    this.suggestionOrigins = null
    this._destroyHandler = nextDoc.on('destroy', this.destroy.bind(this))
    prevDoc.on('destroy', this._destroyHandler)
  }

  get $type () { return $renderer }

  /**
   * @param {Item} item
   * @return {boolean}
   */
  hasItem (item) {
    return this.attributed.intersects(item.id.client, item.id.clock, item.length)
  }

  destroy () {
    super.destroy()
    this._nextDoc.off('destroy', this._destroyHandler)
    this._prevDoc.off('destroy', this._destroyHandler)
    this._nextDoc.off('beforeObserverCalls', this._nextBOH)
    this._prevDoc.off('beforeObserverCalls', this._prevBOH)
    this._prevDoc.off('update', this._prevUpdateListener)
    this._nextDoc.off('update', this._ndUpdateListener)
    this._nextDoc.off('afterTransaction', this._afterTrListener)
  }

  acceptAllChanges () {
    applyUpdate(this._prevDoc, encodeStateAsUpdate(this._nextDoc))
  }

  rejectAllChanges () {
    this._prevDoc.transact(tr => {
      applyUpdate(this._prevDoc, encodeStateAsUpdate(this._nextDoc))
      const um = new UndoManager(this._prevDoc)
      um.undoStack.push(new StackItem(tr.insertSet, tr.deleteSet))
      um.undo()
      um.destroy()
    })
  }

  /**
   * @param {ID} start
   * @param {ID} end
   */
  acceptChanges (start, end = start) {
    const { inserts, deletes } = collectSuggestedChanges(null, this, start, end, true)
    const encoder = new UpdateEncoderV1()
    writeStructsFromIdSet(encoder, this._nextDoc.store, inserts)
    writeIdSet(encoder, deletes)
    applyUpdate(this._prevDoc, encoder.toUint8Array())
  }

  /**
   * @param {ID} start
   * @param {ID} end
   */
  rejectChanges (start, end = start) {
    this._nextDoc.transact(tr => {
      const { inserts, deletes } = collectSuggestedChanges(tr, this, start, end, false)
      const encoder = new UpdateEncoderV1()
      writeStructsFromIdSet(encoder, this._nextDoc.store, inserts)
      writeIdSet(encoder, deletes)
      const um = new UndoManager(this._nextDoc)
      um.undoStack.push(new StackItem(inserts, deletes))
      um.undo()
      um.destroy()
    })
    this.acceptChanges(start, end)
  }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} client
   * @param {number} clock
   * @param {boolean} deleted
   * @param {AbstractContent} _content
   * @param {0|1|2|3} shouldRender - whether this should render or just result in a `retain` operation (see AbstractRenderer#readContent)
   */
  readContent (contents, client, clock, deleted, _content, shouldRender) {
    const slice = (deleted ? this.deletes : this.inserts).slice(client, clock, _content.getLength())
    /**
     * @type {AbstractContent?}
     */
    let content = slice.length === 1 ? _content : _content.copy()
    for (let i = 0; i < slice.length; i++) {
      const s = slice[i]
      if (content == null || content instanceof ContentDeleted) {
        if ((!shouldRender && s.attrs == null) || this.inserts.has(client, s.clock)) {
          continue
        }
        // Retrieved item is never more fragmented than the newer item.
        const prevItem = this._prevDocStore.getItem(createID(client, s.clock))
        const diffStart = s.clock - prevItem.id.clock
        content = prevItem.length > 1 ? prevItem.content.copy() : prevItem.content
        // trim itemContent to the correct size.
        if (diffStart > 0) {
          content = content.splice(diffStart)
        }
      }
      const c = /** @type {AbstractContent} */ (content)
      const clen = c.getLength()
      if (clen < s.len) {
        slice.splice(i + 1, 0, createMaybeAttrRange(s.clock + clen, s.len - clen, s.attrs))
        s.len = clen
      }
      content = s.len < clen ? c.splice(s.len) : null
      // mode 3 (fresh content deleted in the same transaction) renders as an insert only where
      // the renderer attributes it — unattributed deleted content is invisible and renders as
      // *nothing* (there is nothing to insert, and a `delete` op would misapply: the consuming
      // state has never seen this content)
      if (!deleted || s.attrs != null || (shouldRender !== 0 && shouldRender !== 3)) {
        contents.push(new AttributedContent(c, s.clock, deleted, s.attrs, shouldRender))
      }
    }
  }

  /**
   * @param {Item} item
   * @return {number}
   */
  contentLength (item) {
    if (!item.deleted) {
      return item.content.isCountable() ? item.length : 0
    }
    /**
     * @type {Array<AttributedContent<any>>}
     */
    const cs = []
    this.readContent(cs, item.id.client, item.id.clock, true, item.content, 0)
    return cs.reduce((cnt, c) => cnt + ((c.attrs != null && c.content.isCountable()) ? c.content.getLength() : 0), 0)
  }
}

/**
 * Attribute changes from ydoc1 to ydoc2.
 *
 * @param {Doc} prevDoc
 * @param {Doc} nextDoc
 * @param {Object} [options] - options for the renderer
 * @param {ContentMap?} [options.attributions] - the attributions to apply to the diff
 */
export const createDiffRenderer = (prevDoc, nextDoc, options) => new DiffRenderer(prevDoc, nextDoc, options)

/**
 * Intended for projects that used the v13 snapshot feature. With this renderer you can
 * read content similar to the previous snapshot api. Requires that `ydoc.gc` is turned off.
 *
 * @implements AbstractRenderer
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class SnapshotRenderer extends ObservableV2 {
  /**
   * @param {Snapshot} prevSnapshot
   * @param {Snapshot} nextSnapshot
   * @param {Object} [options] - options for the renderer
   * @param {Array<ContentAttribute>} [options.attrs] - the attributes to apply to the diff
   */
  constructor (prevSnapshot, nextSnapshot) {
    super()
    this.prevSnapshot = prevSnapshot
    this.nextSnapshot = nextSnapshot
    const inserts = createIdMap()
    const deletes = createIdMapFromIdSet(diffIdSet(nextSnapshot.ds, prevSnapshot.ds), [createContentAttribute('change', '')])
    nextSnapshot.sv.forEach((clock, client) => {
      const prevClock = prevSnapshot.sv.get(client) || 0
      inserts.add(client, 0, prevClock, []) // content is included in prevSnapshot is rendered without attributes
      inserts.add(client, prevClock, clock - prevClock, [createContentAttribute('change', '')]) // content is rendered as "inserted"
    })
    this.attrs = mergeIdMaps([diffIdMap(inserts, prevSnapshot.ds), deletes])
    /**
     * Coverage of `attrs` (everything up to `nextSnapshot`). Content *after* the snapshot must be
     * hidden rather than rendered normally, which a finite set cannot express — `hasItem`
     * additionally claims all future content. See {@link AbstractRenderer#attributed}.
     * @type {IdSet}
     */
    this.attributed = createIdSetFromIdMap(this.attrs)
  }

  get $type () { return $renderer }

  /**
   * @param {Item} item
   * @return {boolean}
   */
  hasItem (item) {
    // claim future content (item ids at/after the snapshot's state vector, including clients the
    // snapshot has never seen) — `readContent` hides it, the generic path would render it
    return (this.nextSnapshot.sv.get(item.id.client) ?? 0) < item.id.clock + item.length ||
      this.attributed.intersects(item.id.client, item.id.clock, item.length)
  }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} client
   * @param {number} clock
   * @param {boolean} _deleted
   * @param {AbstractContent} content
   * @param {0|1|2|3} shouldRender - whether this should render or just result in a `retain` operation (see AbstractRenderer#readContent)
   */
  readContent (contents, client, clock, _deleted, content, shouldRender) {
    if ((this.nextSnapshot.sv.get(client) ?? 0) <= clock) return // future item that should not be displayed
    const slice = this.attrs.slice(client, clock, content.getLength())
    content = slice.length === 1 ? content : content.copy()
    slice.forEach(s => {
      const deleted = this.nextSnapshot.ds.has(client, s.clock)
      const nonExistend = (this.nextSnapshot.sv.get(client) ?? 0) <= s.clock
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      if (nonExistend) return
      if (shouldRender || !deleted || (s.attrs != null && s.attrs.length > 0)) {
        let attrsWithoutChange = s.attrs?.filter(attr => attr.name !== 'change') ?? null
        if (s.attrs?.length === 0) {
          attrsWithoutChange = null
        }
        contents.push(new AttributedContent(c, s.clock, deleted, attrsWithoutChange, shouldRender))
      }
    })
  }

  /**
   * @param {Item} item
   * @return {number}
   */
  contentLength (item) {
    return item.content.isCountable()
      ? (item.deleted
          ? this.attrs.sliceId(item.id, item.length).reduce((len, s) => s.attrs != null ? len + s.len : len, 0)
          : item.length
        )
      : 0
  }
}

/**
 * @param {Snapshot} prevSnapshot
 * @param {Snapshot} nextSnapshot
 */
export const createSnapshotRenderer = (prevSnapshot, nextSnapshot = prevSnapshot) => new SnapshotRenderer(prevSnapshot, nextSnapshot)
