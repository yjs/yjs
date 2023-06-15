import { decoding, encoding, error } from "lib0"
import { 
  YEvent, Transaction, ID, GC, AbstractType, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Doc, Item,
  transact,
  getItemCleanEnd,
  createID,
  getItemCleanStart,
  callTypeObservers,
  YWeakLinkRefID
} from "../internals.js"

/**
 * @template T extends AbstractType<any>
 * @extends YEvent<any>
 * Event that describes the changes on a YMap.
 */
export class YWeakLinkEvent extends YEvent {
  /**
   * @param {YWeakLink<T>} ylink The YWeakLink to which this event was propagated to.
   * @param {Transaction} transaction
   */
  constructor (ylink, transaction) {
    super(ylink, transaction)
  }
}

/**
 * @template T
 * @extends AbstractType<YWeakLinkEvent<T>>
 * 
 * Weak link to another value stored somewhere in the document.
 */
export class YWeakLink extends AbstractType {
  /**
    * @param {ID} id
    * @param {Item|GC|null} item
    */
  constructor(id, item) {
    super()
    this._id = id
    this._linkedItem = item
  }
  
  /**
   * Returns a reference to an underlying value existing somewhere on in the document.
   * 
   * @return {T|undefined}
   */
  deref() {
    if (this._linkedItem !== null && this._linkedItem.constructor === Item) {
      let item = this._linkedItem
      if (item.parentSub !== null) {
        // for map types go to the most recent one
        while (item.right !== null) {
          item = item.right
        }
        this._linkedItem = item
      }
      if (!item.deleted) {
        return item.content.getContent()[0]
      }
    }
    return undefined;
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Doc} y The Yjs instance
   * @param {Item|null} item
   */
  _integrate (y, item) {
    super._integrate(y, item)
    if (item !== null) {
      transact(y, (transaction) => {
        // link may refer to a single element in multi-element block
        // in such case we need to cut of the linked element into a
        // separate block
        let sourceItem = this._linkedItem !== null ? this._linkedItem : getItemCleanStart(transaction, this._id)
        if (sourceItem.constructor === Item && sourceItem.parentSub !== null) {
          // for maps, advance to most recent item
          while (sourceItem.right !== null) {
            sourceItem = sourceItem.right
          }
        }
        if (!sourceItem.deleted && sourceItem.length > 1) {
          sourceItem = getItemCleanEnd(transaction, transaction.doc.store, createID(sourceItem.id.client, sourceItem.id.clock + 1))
        }
        this._linkedItem = sourceItem
        if (!sourceItem.deleted) {
          const src = /** @type {Item} */ (sourceItem)
          if (src.linkedBy === null) {
            src.linkedBy = new Set()
          }
          src.linkedBy.add(this)
        }
      })
    }
  }

  /**
   * @return {YWeakLink<T>}
   */
  _copy () {
    return new YWeakLink(this._id, this._linkedItem)
  }

  /**
   * @return {YWeakLink<T>}
   */
  clone () {
    return new YWeakLink(this._id, this._linkedItem)
  }

  /**
   * Creates YWeakLinkEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    super._callObserver(transaction, parentSubs)
    callTypeObservers(this, transaction, new YWeakLinkEvent(this, transaction))
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   */
  _write (encoder) {
    encoder.writeTypeRef(YWeakLinkRefID)
    const flags = 0 // flags that could be used in the future
    encoding.writeUint8(encoder.restEncoder, flags)
    encoder.writeLeftID(this._id)
  }
}

  
/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {YWeakLink<any>}
 */
export const readYWeakLink = decoder => {
  const flags = decoding.readUint8(decoder.restDecoder)
  const id = decoder.readLeftID()
  return new YWeakLink(id, null)
}

const lengthExceeded = error.create('Length exceeded!')

/**
 * Returns a {WeakLink} to an YArray element at given index.
 * 
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @return {YWeakLink<any>}
 */
export const arrayWeakLink = (transaction, parent, index) => {
  let item = parent._start
  for (; item !== null; item = item.right) {
    if (!item.deleted && item.countable) {
      if (index < item.length) {
        if (index > 0) {
            item = getItemCleanStart(transaction, createID(item.id.client, item.id.clock + index))
        }
        if (item.length > 1) {
            item = getItemCleanEnd(transaction, transaction.doc.store, createID(item.id.client, item.id.clock))
        }
        const link = new YWeakLink(item.id, item)
        if (item.linkedBy === null) {
          item.linkedBy = new Set()
        }
        item.linkedBy.add(link)
        return link
      }
      index -= item.length
    }
  }

  throw lengthExceeded
}

/**
 * Returns a {WeakLink} to an YMap element at given key.
 * 
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @return {YWeakLink<any>|undefined}
 */
export const mapWeakLink = (parent, key) => {
  const item = parent._map.get(key)
  if (item !== undefined) {
    const link = new YWeakLink(item.id, item)
    if (item.linkedBy === null) {
      item.linkedBy = new Set()
    }
    item.linkedBy.add(link)
    return link
  } else {
    return undefined
  }
}