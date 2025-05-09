import {
  getItem,
  diffIdSet,
  createInsertionSetFromStructStore,
  createDeleteSetFromStructStore,
  createIdMapFromIdSet,
  ContentDeleted,
  Snapshot, Doc, Item, AbstractContent, IdMap, // eslint-disable-line
  insertIntoIdMap,
  insertIntoIdSet,
  diffIdMap,
  createIdMap,
  createAttributionItem,
  mergeIdMaps
} from '../internals.js'

import * as error from 'lib0/error'

/**
 * @typedef {Object} Attribution
 * @property {Array<any>} [Attribution.insert]
 * @property {number} [Attribution.insertedAt]
 * @property {Array<any>} [Attribution.suggest]
 * @property {number} [Attribution.suggestedAt]
 * @property {Array<any>} [Attribution.delete]
 * @property {number} [Attribution.deletedAt]
 * @property {{ [key: string]: Array<any> }} [Attribution.attributes]
 * @property {number} [Attribution.attributedAt]
 */

/**
 * @param {Array<import('./IdMap.js').AttributionItem<any>>?} attrs
 * @param {boolean} deleted - whether the attributed item is deleted
 * @return {{ attribution: Attribution?, retainOnly: boolean }}
 */
export const createAttributionFromAttributionItems = (attrs, deleted) => {
  /**
   * @type {Attribution?}
   */
  let attribution = null
  let retainOnly = false
  if (attrs != null) {
    attribution = {}
    if (deleted) {
      attribution.delete = []
    } else {
      attribution.insert = []
    }
    attrs.forEach(attr => {
      switch (attr.name) {
        case 'retain':
          retainOnly = true
          break
        case 'insert':
        case 'delete':
        case 'suggest': {
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
  }
  return { attribution, retainOnly }
}

/**
 * @template T
 */
export class AttributedContent {
  /**
   * @param {AbstractContent} content
   * @param {boolean} deleted
   * @param {Array<import('./IdMap.js').AttributionItem<T>> | null} attrs
   */
  constructor (content, deleted, attrs) {
    this.content = content
    this.deleted = deleted
    this.attrs = attrs
  }
}

/**
 * Abstract class for associating Attributions to content / changes
 */
export class AbstractAttributionManager {
  /**
   * @param {Array<AttributedContent<any>>} _contents
   * @param {Item} _item
   * @param {boolean} _forceRead read content even if it is unattributed and deleted
   */
  readContent (_contents, _item, _forceRead) {
    error.methodUnimplemented()
  }

  destroy () {}
}

/**
 * @implements AbstractAttributionManager
 */
export class TwosetAttributionManager {
  /**
   * @param {IdMap<any>} inserts
   * @param {IdMap<any>} deletes
   */
  constructor (inserts, deletes) {
    this.inserts = inserts
    this.deletes = deletes
  }

  destroy () {}

  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   * @param {boolean} forceRead read content even if it is unattributed and deleted
   */
  readContent (contents, item, forceRead) {
    const deleted = item.deleted
    const slice = (deleted ? this.deletes : this.inserts).sliceId(item.id, item.length)
    let content = slice.length === 1 ? item.content : item.content.copy()
    slice.forEach(s => {
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      if (!deleted || s.attrs != null || forceRead) {
        contents.push(new AttributedContent(c, deleted, s.attrs))
      }
    })
  }
}

/**
 * Abstract class for associating Attributions to content / changes
 *
 * @implements AbstractAttributionManager
 */
export class NoAttributionsManager {
  destroy () {}

  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   * @param {boolean} forceRead read content even if it is unattributed and deleted
   */
  readContent (contents, item, forceRead) {
    if (!item.deleted || forceRead) {
      contents.push(new AttributedContent(item.content, false, null))
    }
  }
}

export const noAttributionsManager = new NoAttributionsManager()

/**
 * @implements AbstractAttributionManager
 */
export class DiffAttributionManager {
  /**
   * @param {Doc} prevDoc
   * @param {Doc} nextDoc
   */
  constructor (prevDoc, nextDoc) {
    const _nextDocInserts = createInsertionSetFromStructStore(nextDoc.store, false) // unmaintained
    const _prevDocInserts = createInsertionSetFromStructStore(prevDoc.store, false) // unmaintained
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
      const diffDeletes = diffIdSet(tr.deleteSet, prevDocDeletes)
      insertIntoIdMap(this.deletes, createIdMapFromIdSet(diffDeletes, []))
      // @todo fire update ranges on `diffInserts` and `diffDeletes`
    })
    this._prevBOH = prevDoc.on('beforeObserverCalls', tr => {
      insertIntoIdSet(_prevDocInserts, tr.insertSet)
      insertIntoIdSet(prevDocDeletes, tr.deleteSet)
      if (tr.insertSet.clients.size < 2) {
        tr.insertSet.forEach((idrange, client) => {
          this.inserts.delete(client, idrange.clock, idrange.len)
        })
      } else {
        this.inserts = diffIdMap(this.inserts, tr.insertSet)
      }
      if (tr.deleteSet.clients.size < 2) {
        tr.deleteSet.forEach((attrRange, client) => {
          this.deletes.delete(client, attrRange.clock, attrRange.len)
        })
      } else {
        this.deletes = diffIdMap(this.deletes, tr.deleteSet)
      }
      // @todo fire update ranges on `tr.insertSet` and `tr.deleteSet`
    })
    this._destroyHandler = nextDoc.on('destroy', this.destroy.bind(this))
    prevDoc.on('destroy', this._destroyHandler)
  }

  destroy () {
    this._nextDoc.off('destroy', this._destroyHandler)
    this._prevDoc.off('destroy', this._destroyHandler)
    this._nextDoc.off('beforeObserverCalls', this._nextBOH)
    this._prevDoc.off('beforeObserverCalls', this._prevBOH)
  }

  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   * @param {boolean} forceRead read content even if it is unattributed and deleted
   */
  readContent (contents, item, forceRead) {
    const deleted = item.deleted || /** @type {any} */ (item.parent).doc !== this._nextDoc
    const slice = (deleted ? this.deletes : this.inserts).sliceId(item.id, item.length)
    let content = slice.length === 1 ? item.content : item.content.copy()
    if (content instanceof ContentDeleted && slice[0].attrs != null && !this.inserts.hasId(item.id)) {
      // Retrieved item is never more fragmented than the newer item.
      const prevItem = getItem(this._prevDocStore, item.id)
      content = prevItem.length > 1 ? prevItem.content.copy() : prevItem.content
      // trim itemContent to the correct size.
      const diffStart = prevItem.id.clock - item.id.clock
      const diffEnd = prevItem.id.clock + prevItem.length - item.id.clock - item.length
      if (diffStart > 0) {
        content = content.splice(diffStart)
      }
      if (diffEnd > 0) {
        content.splice(content.getLength() - diffEnd)
      }
    }
    slice.forEach(s => {
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      if (!deleted || s.attrs != null || forceRead) {
        contents.push(new AttributedContent(c, deleted, s.attrs))
      }
    })
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
 */
export class SnapshotAttributionManager {
  /**
   * @param {Snapshot} prevSnapshot
   * @param {Snapshot} nextSnapshot
   */
  constructor (prevSnapshot, nextSnapshot) {
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

  destroy () { }

  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   * @param {boolean} forceRead read content even if it is unattributed and deleted
   */
  readContent (contents, item, forceRead) {
    if ((this.nextSnapshot.sv.get(item.id.client) ?? 0) <= item.id.clock) return // future item that should not be displayed
    const slice = this.attrs.sliceId(item.id, item.length)
    let content = slice.length === 1 ? item.content : item.content.copy()
    slice.forEach(s => {
      const deleted = this.nextSnapshot.ds.has(item.id.client, s.clock)
      const nonExistend = (this.nextSnapshot.sv.get(item.id.client) ?? 0) <= s.clock
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      if (nonExistend) return
      if (!deleted || forceRead || (s.attrs != null && s.attrs.length > 0)) {
        let attrsWithoutChange = s.attrs?.filter(attr => attr.name !== 'change') ?? null
        if (s.attrs?.length === 0) {
          attrsWithoutChange = null
        }
        contents.push(new AttributedContent(c, deleted, attrsWithoutChange))
      }
    })
  }
}

/**
 * @param {Snapshot} prevSnapshot
 * @param {Snapshot} nextSnapshot
 */
export const createAttributionManagerFromSnapshots = (prevSnapshot, nextSnapshot = prevSnapshot) => new SnapshotAttributionManager(prevSnapshot, nextSnapshot)
