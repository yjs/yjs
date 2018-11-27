/**
 * @module types
 */

import { YXmlElement, YXmlFragment } from './YXmlElement.js' // eslint-disable-line

/**
 * Define the elements to which a set of CSS queries apply.
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors|CSS_Selectors}
 *
 * @example
 *   query = '.classSelector'
 *   query = 'nodeSelector'
 *   query = '#idSelector'
 *
 * @typedef {string} CSS_Selector
 */

/**
 * Represents a subset of the nodes of a YXmlElement / YXmlFragment and a
 * position within them.
 *
 * Can be created with {@link YXmlFragment#createTreeWalker}
 *
 * @public
 */
export class YXmlTreeWalker {
  constructor (root, f) {
    this._filter = f || (() => true)
    this._root = root
    this._currentNode = root
    this._firstCall = true
  }
  [Symbol.iterator] () {
    return this
  }
  /**
   * Get the next node.
   *
   * @return {YXmlElement} The next node.
   *
   * @public
   */
  next () {
    let n = this._currentNode
    if (this._firstCall) {
      this._firstCall = false
      if (!n._deleted && this._filter(n)) {
        return { value: n, done: false }
      }
    }
    do {
      if (!n._deleted && (n.constructor === YXmlElement || n.constructor === YXmlFragment) && n._start !== null) {
        // walk down in the tree
        n = n._start
      } else {
        // walk right or up in the tree
        while (n !== this._root) {
          if (n._right !== null) {
            n = n._right
            break
          }
          n = n._parent
        }
        if (n === this._root) {
          n = null
        }
      }
      if (n === this._root) {
        break
      }
    } while (n !== null && (n._deleted || !this._filter(n)))
    this._currentNode = n
    if (n === null) {
      return { done: true }
    } else {
      return { value: n, done: false }
    }
  }
}
