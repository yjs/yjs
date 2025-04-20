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
   * @param {Item} _item
   * @return {Array<AttributedContent<any>>}
   */
  getContent (_item) {
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
   * @param {Item} item
   * @return {Array<AttributedContent<any>>}
   */
  getContent (item) {
    const deleted = item.deleted
    const slice = (deleted ? this.deletes : this.inserts).slice(item.id, item.length)
    let content = slice.length === 1 ? item.content : item.content.copy()
    let res = slice.map(s => {
      const c = content
      if (s.len < c.getLength()) {
        content = c.splice(s.len)
      }
      return new AttributedContent(c, deleted, s.attrs)
    })
    if (deleted) {
      res = res.filter(s => s.attrs != null)
    }
    return res
  }
}

/**
 * Abstract class for associating Attributions to content / changes
 *
 * @implements AbstractAttributionManager
 */
export class NoAttributionsManager {
  /**
   * @param {Item} item
   * @return {Array<AttributedContent<any>>}
   */
  getContent (item) {
    return item.deleted ? [] : [new AttributedContent(item.content, item.deleted, null)]
  }
}

export const noAttributionsManager = new NoAttributionsManager()
