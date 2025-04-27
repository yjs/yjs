import {
  Item, AbstractContent, IdMap // eslint-disable-line
} from '../internals.js'

import * as error from 'lib0/error'

/**
 * @template T
 */
export class AttributedContent {
  /**
   * @param {AbstractContent} content
   * @param {boolean} deleted
   * @param {Array<import('./IdMap.js').Attribution<T>> | null} attrs
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
 * Abstract class for associating Attributions to content / changes
 *
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
