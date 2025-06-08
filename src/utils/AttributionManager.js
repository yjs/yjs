import {
  getItem,
  diffIdSet,
  createInsertSetFromStructStore,
  createDeleteSetFromStructStore,
  createIdMapFromIdSet,
  ContentDeleted,
  insertIntoIdMap,
  insertIntoIdSet,
  diffIdMap,
  createIdMap,
  createAttributionItem,
  mergeIdMaps,
  createID,
  mergeIdSets,
  ID, IdSet, Item, Snapshot, Doc, AbstractContent, IdMap, // eslint-disable-line
  applyUpdate,
  writeIdSet,
  UpdateEncoderV1,
  transact,
  createMaybeAttrRange,
  createIdSet,
  writeStructsFromIdSet
} from '../internals.js'

import * as error from 'lib0/error'
import { ObservableV2 } from 'lib0/observable'
import * as encoding from 'lib0/encoding'

/**
 * @todo rename this to `insertBy`, `insertAt`, ..
 *
 * @typedef {Object} Attribution
 * @property {Array<any>} [Attribution.insert]
 * @property {number} [Attribution.insertedAt]
 * @property {Array<any>} [Attribution.acceptInsert]
 * @property {number} [Attribution.acceptedDeleteAt]
 * @property {Array<any>} [Attribution.acceptDelete]
 * @property {number} [Attribution.acceptedDeleteAt]
 * @property {Array<any>} [Attribution.delete]
 * @property {number} [Attribution.deletedAt]
 * @property {{ [key: string]: Array<any> }} [Attribution.attributes]
 * @property {number} [Attribution.attributedAt]
 */

/**
 * @todo SHOULD NOT RETURN AN OBJECT!
 * @param {Array<import('./IdMap.js').AttributionItem<any>>?} attrs
 * @param {boolean} deleted - whether the attributed item is deleted
 * @return {Attribution?}
 */
export const createAttributionFromAttributionItems = (attrs, deleted) => {
  if (attrs == null) return null
  /**
   * @type {Attribution}
   */
  const attribution = {}
  if (deleted) {
    attribution.delete = []
  } else {
    attribution.insert = []
  }
  attrs.forEach(attr => {
    switch (attr.name) {
      case 'acceptDelete':
        delete attribution.delete
        // eslint-disable-next-line no-fallthrough
      case 'acceptInsert':
        delete attribution.insert
        // eslint-disable-next-line no-fallthrough
      case 'insert':
      case 'delete': {
        const as = /** @type {import('../utils/Delta.js').Attribution} */ (attribution)
        const ls = as[attr.name] = as[attr.name] ?? []
        ls.push(attr.val)
        break
      }
      default: {
        if (attr.name[0] !== '_') {
          /** @type {any} */ (attribution)[attr.name] = attr.val
        }
      }
    }
  })
  return attribution
}

/**
 * @template T
 */
export class AttributedContent {
  /**
   * @param {AbstractContent} content
   * @param {number} clock
   * @param {boolean} deleted
   * @param {Array<import('./IdMap.js').AttributionItem<T>> | null} attrs
   * @param {0|1|2} renderBehavior
   */
  constructor (content, clock, deleted, attrs, renderBehavior) {
    this.content = content
    this.clock = clock
    this.deleted = deleted
    this.attrs = attrs
    this.render = renderBehavior === 0 ? false : (renderBehavior === 1 ? (!deleted || attrs != null) : true)
  }
}

/**
 * Abstract class for associating Attributions to content / changes
 *
 * Should fire an event when the attributions changed _after_ the original change happens. This
 * Event will be used to update the attribution on the current content.
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class AbstractAttributionManager extends ObservableV2 {
  /**
   * @param {Array<AttributedContent<any>>} _contents - where to write the result
   * @param {number} _client
   * @param {number} _clock
   * @param {boolean} _deleted
   * @param {AbstractContent} _content
   * @param {0|1|2} _shouldRender - 0: if undeleted or attributed, render as a retain operation. 1: render only if undeleted or attributed. 2: render as insert operation (if unattributed and deleted, render as delete).
   */
  readContent (_contents, _client, _clock, _deleted, _content, _shouldRender) {
    error.methodUnimplemented()
  }

  /**
   * Calculate the length of the attributed content. This is used by iterators that walk through the
   * content.
   *
   * If the content is not countable, it should return 0.
   *
   * @param {Item} _item
   * @return {number}
   */
  contentLength (_item) {
    error.methodUnimplemented()
  }
}

/**
 * @implements AbstractAttributionManager
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class TwosetAttributionManager extends ObservableV2 {
  /**
   * @param {IdMap<any>} inserts
   * @param {IdMap<any>} deletes
   */
  constructor (inserts, deletes) {
    super()
    this.inserts = inserts
    this.deletes = deletes
  }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} client
   * @param {number} clock
   * @param {boolean} deleted
   * @param {AbstractContent} content
   * @param {0|1|2} shouldRender - whether this should render or just result in a `retain` operation
   */
  readContent (contents, client, clock, deleted, content, shouldRender) {
    const slice = (deleted ? this.deletes : this.inserts).slice(client, clock, content.getLength())
    content = slice.length === 1 ? content : content.copy()
    slice.forEach(s => {
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      if (!deleted || s.attrs != null || shouldRender) {
        contents.push(new AttributedContent(c, s.clock, deleted, s.attrs, shouldRender))
      }
    })
  }

  /**
   * @param {Item} item
   * @return {number}
   */
  contentLength (item) {
    if (!item.content.isCountable()) {
      return 0
    } else if (!item.deleted) {
      return item.length
    } else {
      return this.deletes.sliceId(item.id, item.length).reduce((len, s) => s.attrs != null ? len + s.len : len, 0)
    }
  }
}

/**
 * Abstract class for associating Attributions to content / changes
 *
 * @implements AbstractAttributionManager
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class NoAttributionsManager extends ObservableV2 {
  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} _client
   * @param {number} clock
   * @param {boolean} deleted
   * @param {AbstractContent} content
   * @param {0|1|2} shouldRender - whether this should render or just result in a `retain` operation
   */
  readContent (contents, _client, clock, deleted, content, shouldRender) {
    if (!deleted || shouldRender) {
      contents.push(new AttributedContent(content, clock, deleted, null, shouldRender))
    }
  }

  /**
   * @param {Item} item
   * @return {number}
   */
  contentLength (item) {
    return (item.deleted || !item.content.isCountable()) ? 0 : item.length
  }
}

export const noAttributionsManager = new NoAttributionsManager()

/**
 * @implements AbstractAttributionManager
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class DiffAttributionManager extends ObservableV2 {
  /**
   * @param {Doc} prevDoc
   * @param {Doc} nextDoc
   */
  constructor (prevDoc, nextDoc) {
    super()
    const _nextDocInserts = createInsertSetFromStructStore(nextDoc.store, false) // unmaintained
    const _prevDocInserts = createInsertSetFromStructStore(prevDoc.store, false) // unmaintained
    const nextDocDeletes = createDeleteSetFromStructStore(nextDoc.store) // maintained
    const prevDocDeletes = createDeleteSetFromStructStore(prevDoc.store) // maintained
    this.inserts = createIdMapFromIdSet(diffIdSet(_nextDocInserts, _prevDocInserts), [])
    this.deletes = createIdMapFromIdSet(diffIdSet(nextDocDeletes, prevDocDeletes), [])
    this._prevDoc = prevDoc
    this._prevDocStore = prevDoc.store
    this._nextDoc = nextDoc
    // update before observer calls fired
    this._nextBOH = nextDoc.on('beforeObserverCalls', tr => {
      // update inserts
      const diffInserts = diffIdSet(tr.insertSet, _prevDocInserts)
      insertIntoIdMap(this.inserts, createIdMapFromIdSet(diffInserts, []))
      // update deletes
      const diffDeletes = diffIdSet(diffIdSet(tr.deleteSet, prevDocDeletes), this.inserts)
      insertIntoIdMap(this.deletes, createIdMapFromIdSet(diffDeletes, []))
      // @todo fire update ranges on `diffInserts` and `diffDeletes`
    })
    this._prevBOH = prevDoc.on('beforeObserverCalls', tr => {
      insertIntoIdSet(_prevDocInserts, tr.insertSet)
      insertIntoIdSet(prevDocDeletes, tr.deleteSet)
      // insertIntoIdMap(this.inserts, createIdMapFromIdSet(intersectSets(tr.insertSet, this.inserts), [createAttributionItem('acceptInsert', 'unknown')]))
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
      // @todo fire update ranges on `tr.insertSet` and `tr.deleteSet`
      this.emit('change', [mergeIdSets([tr.insertSet, tr.deleteSet]), tr.origin, tr.local])
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
      // the attribution manager)
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

  /**
   * @param {ID} start
   * @param {ID?} end
   */
  acceptChanges (start, end = start) {
    const encoder = new UpdateEncoderV1()
    const store = this._nextDoc.store
    const inserts = createIdSet()
    const deletes = createIdSet()
    /**
     * @type {Item?}
     */
    let item = getItem(store, start)
    const endItem = start === end ? item : (end == null ? null : getItem(store, end))
    // walk to the left and find first un-attributed change that is rendered
    while (item.left != null) {
      item = item.left
      if (!item.deleted) {
        const slice = this.inserts.slice(item.id.client, item.id.clock, item.length)
        if (slice.some(s => s.attrs === null)) {
          break
        }
      }
    }
    let foundEndItem = false
    while (item != null) {
      inserts.add(item.id.client, item.id.clock, item.length)
      if (item.deleted) {
        deletes.add(item.id.client, item.id.clock, item.length)
      }
      foundEndItem ||= item === endItem
      if (foundEndItem && !item.deleted && this.inserts.slice(item.id.client, item.id.clock, item.length).some(s => s.attrs === null)) {
        break
      }
      item = item.right
    }
    writeStructsFromIdSet(encoder, this._nextDoc.store, inserts)
    writeIdSet(encoder, deletes)
    const acceptUpdate = encoder.toUint8Array()
    applyUpdate(this._prevDoc, acceptUpdate)
  }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} client
   * @param {number} clock
   * @param {boolean} deleted
   * @param {AbstractContent} _content
   * @param {0|1|2} shouldRender - whether this should render or just result in a `retain` operation
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
        const prevItem = getItem(this._prevDocStore, createID(client, s.clock))
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
      if (shouldRender || !deleted || s.attrs != null) {
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
 */
export const createAttributionManagerFromDiff = (prevDoc, nextDoc) => new DiffAttributionManager(prevDoc, nextDoc)

/**
 * Intended for projects that used the v13 snapshot feature. With this AttributionManager you can
 * read content similar to the previous snapshot api. Requires that `ydoc.gc` is turned off.
 *
 * @implements AbstractAttributionManager
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class SnapshotAttributionManager extends ObservableV2 {
  /**
   * @param {Snapshot} prevSnapshot
   * @param {Snapshot} nextSnapshot
   */
  constructor (prevSnapshot, nextSnapshot) {
    super()
    this.prevSnapshot = prevSnapshot
    this.nextSnapshot = nextSnapshot
    const inserts = createIdMap()
    const deletes = createIdMapFromIdSet(diffIdSet(nextSnapshot.ds, prevSnapshot.ds), [createAttributionItem('change', '')])
    nextSnapshot.sv.forEach((clock, client) => {
      const prevClock = prevSnapshot.sv.get(client) || 0
      inserts.add(client, 0, prevClock, []) // content is included in prevSnapshot is rendered without attributes
      inserts.add(client, prevClock, clock - prevClock, [createAttributionItem('change', '')]) // content is rendered as "inserted"
    })
    this.attrs = mergeIdMaps([diffIdMap(inserts, prevSnapshot.ds), deletes])
  }

  /**
   * @param {Array<AttributedContent<any>>} contents - where to write the result
   * @param {number} client
   * @param {number} clock
   * @param {boolean} _deleted
   * @param {AbstractContent} content
   * @param {0|1|2} shouldRender - whether this should render or just result in a `retain` operation
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
export const createAttributionManagerFromSnapshots = (prevSnapshot, nextSnapshot = prevSnapshot) => new SnapshotAttributionManager(prevSnapshot, nextSnapshot)
