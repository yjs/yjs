import { AbstractType, GC, ID, Item } from "yjs"

/**
 * @template T
 * 
 * Weak link to another value stored somewhere in the document.
 */
export class WeakLink {
  /**
    * @param {ID} id
    * @param {Item|GC|null} item
    */
  constructor(id, item) {
    this.id = id
    this.item = item
  }
  
  /**
   * Returns a reference to an underlying value existing somewhere on in the document.
   * 
   * @return {T|undefined}
   */
  deref() {
    if (this.item !== null && this.item.constructor === Item) {
      let item = this.item
      if (item.parentSub !== null) {
        // for map types go to the most recent one
        while (item.right !== null) {
          item = item.right
        }
        this.item = item
      }
      if (!item.deleted) {
        return item.content.getContent()[0]
      }
    }
    return undefined;
  }
}
