import {
  getItem,
  diffIdSet,
  createInsertionSetFromStructStore,
  createDeleteSetFromStructStore,
  createIdMapFromIdSet,
  ContentDeleted,
  Doc, Item, AbstractContent, IdMap // eslint-disable-line
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
 * @return {Attribution?}
 */
export const createAttributionFromAttributionItems = (attrs, deleted) => {
  /**
   * @type {Attribution?}
   */
  let attribution = null
  if (attrs != null) {
    attribution = {}
    if (deleted) {
      attribution.delete = []
    } else {
      attribution.insert = []
    }
    attrs.forEach(attr => {
      switch (attr.name) {
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
  return attribution
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
   */
  readContent (_contents, _item) {
    error.methodUnimplemented()
  }
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

  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   */
  readContent (contents, item) {
    const deleted = item.deleted
    const slice = (deleted ? this.deletes : this.inserts).slice(item.id, item.length)
    let content = slice.length === 1 ? item.content : item.content.copy()
    slice.forEach(s => {
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      if (!deleted || s.attrs != null) {
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
  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   */
  readContent (contents, item) {
    if (!item.deleted) {
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
   * @param {IdMap<any>} inserts
   * @param {IdMap<any>} deletes
   * @param {Doc} prevDoc
   * @param {Doc} nextDoc
   */
  constructor (inserts, deletes, prevDoc, nextDoc) {
    this.inserts = inserts
    this.deletes = deletes
    this._prevDocStore = prevDoc.store
    this._nextDoc = nextDoc
  }

  /**
   * @param {Array<AttributedContent<any>>} contents
   * @param {Item} item
   */
  readContent (contents, item) {
    const deleted = item.deleted || /** @type {any} */ (item.parent).doc !== this._nextDoc
    const slice = (deleted ? this.deletes : this.inserts).slice(item.id, item.length)
    let content = slice.length === 1 ? item.content : item.content.copy()
    if (content instanceof ContentDeleted && slice[0].attrs != null) {
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
      if (!deleted || s.attrs != null) {
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
export const createAttributionManagerFromDiff = (prevDoc, nextDoc) => {
  const inserts = diffIdSet(createInsertionSetFromStructStore(nextDoc.store), createInsertionSetFromStructStore(prevDoc.store))
  const deletes = diffIdSet(createDeleteSetFromStructStore(nextDoc.store), createDeleteSetFromStructStore(prevDoc.store))
  const insertMap = createIdMapFromIdSet(inserts, [])
  const deleteMap = createIdMapFromIdSet(deletes, [])
  // @todo, get deletes from the older doc
  return new DiffAttributionManager(insertMap, deleteMap, prevDoc, nextDoc)
}
