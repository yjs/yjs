import { AbstractType, GC, ID, Item, Transaction, YEvent } from "yjs"

/**
 * @template T extends AbstractType<any>
 * @extends YEvent<any>
 * Event that describes the changes on a YMap.
 */
export class YWeakLinkEvent extends YEvent {
  /**
   * @param {YWeakLink<T>} ylink The YWeakLink to which this event was propagated to.
   * @param {Transaction} transaction
   * @param {YEvent<any>} source Source event that has been propagated to ylink.
   */
  constructor (ylink, transaction, source) {
    super(ylink, transaction)
    this.source = source
  }
}

/**
 * @template T
 * 
 * Weak link to another value stored somewhere in the document.
 */
export class YWeakLink {
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
