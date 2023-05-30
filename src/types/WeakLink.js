import { AbstractType, GC, Item, createID } from "yjs"
import { typeMapGet } from "./AbstractType.js"

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
