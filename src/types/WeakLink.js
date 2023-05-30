import { AbstractType, GC, Item, createID } from "yjs"
import { findMarker, typeMapGet } from "./AbstractType.js"
import { error } from "lib0"
import { Transaction, getItemCleanEnd, getItemCleanStart } from "src/internals.js"

/**
 * @template T
 * 
 * Weak link to another value stored somewhere in the document.
 */
export class WeakLink {
  /**
    * @param {AbstractType<any>} source
    * @param {Item|GC} item
    * @param {string|null} key
    */
  constructor(source, item, key) {
    this.source = source
    this.item = item
    this.key = key
  }
  
  /**
   * Returns a reference to an underlying value existing somewhere on in the document.
   * 
   * @return {T|undefined}
   */
  deref() {
    if (this.key) {
      return /** @type {T|undefined} */ (typeMapGet(this.source, this.key))
    } else {
      if (this.item.constructor === Item) {
        return this.item.content.getContent()[0]
      } else {
        return undefined
      }
    }
  }
}

const lengthExceeded = error.create('Length exceeded!')

/**
 * Returns a {WeakLink} to an YArray element at given index.
 * 
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @return {WeakLink<any>}
 */
export const arrayWeakLink = (transaction, parent, index) => {
  const marker = findMarker(parent, index)
  let n = parent._start
  if (marker !== null) {
    n = marker.p
    index -= marker.index
  }
  for (; n !== null; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index < n.length) {
        if (index > 0) {
            n = getItemCleanStart(transaction, createID(n.id.clock, n.id.clock + index))
        }
        if (n.length > 1) {
            n = getItemCleanEnd(transaction, transaction.doc.store, createID(n.id.clock, n.id.clock + 1))
        }
        return new WeakLink(parent, n, null)
      }
      index -= n.length
    }
  }

  throw lengthExceeded
}

/**
 * Returns a {WeakLink} to an YMap element at given key.
 * 
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @return {WeakLink<any>|undefined}
 */
export const mapWeakLink = (parent, key) => {
  const item = parent._map.get(key)
  if (item !== undefined) {
    return new WeakLink(parent, item, key)
  } else {
    return undefined
  }
}