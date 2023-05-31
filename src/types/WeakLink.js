import { AbstractType, GC, Item, createID } from "yjs"
import { typeMapGet } from "./AbstractType.js"

/**
 * @template T
 * 
 * Weak link to another value stored somewhere in the document.
 */
export class WeakLink {
  /**
    * @param {{parent:AbstractType<any>,item:Item|GC|null,key:string|null}|null} source
    */
  constructor(source) {
    this.source = source
  }
  
  /**
   * Returns a reference to an underlying value existing somewhere on in the document.
   * 
   * @return {T|undefined}
   */
  deref() {
    const item = this.linkedItem()
    if (item !== undefined && !item.deleted) {
      return /** @type {Item} */ (item).content.getContent()[0]
    } else {
      return undefined
    }
  }

  /**
   * Returns currently linked item to an underlying value existing somewhere on in the document.
   * 
   * @return {Item|GC|undefined}
   */
  linkedItem() {
    if (this.source !== null) {
      const source = this.source
      if (source.key !== null) {
        return source.parent._map.get(source.key)
      } else if (source.item !== null && !source.item.deleted) {
        return source.item
      }
    }
    return undefined
  }

  /**
   * Checks if a linked content source has been deleted.
   * 
   * @return {boolean}
   */
  get deleted() {
    return this.source === null || this.source.item === null || this.source.item.deleted
  }
}
