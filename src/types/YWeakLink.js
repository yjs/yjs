import { decoding, encoding, error } from "lib0"
import * as map from 'lib0/map'
import * as set from 'lib0/set'
import { 
  YEvent, Transaction, ID, GC, AbstractType, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Doc, Item,
  transact,
  getItemCleanEnd,
  createID,
  getItemCleanStart,
  callTypeObservers,
  YWeakLinkRefID,
  writeID,
  readID,
  RelativePosition
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
    * @param {RelativePosition} start
    * @param {RelativePosition} end
    * @param {Item|null} firstItem
    * @param {Item|null} lastItem
    */
  constructor(start, end, firstItem, lastItem) {
    super()
    this._quoteStart = start
    this._quoteEnd = end
    this._firstItem = firstItem
    this._lastItem = lastItem
  }

  /**
   * Check if current link contains only a single element.
   * 
   * @returns {boolean}
   */
  isSingle() {
    return this._quoteStart.item === this._quoteEnd.item
  }
  
  /**
   * Returns a reference to an underlying value existing somewhere on in the document.
   * 
   * @return {T|undefined}
   */
  deref() {
    if (this._firstItem !== null) {
      let item = this._firstItem
      if (item.parentSub !== null) {
        while (item.right !== null) {
          item = item.right
        }
        // we don't support quotations over maps
        this._firstItem = item
      }
      if (!this._firstItem.deleted) {
        return this._firstItem.content.getContent()[0]
      }
    }

    return undefined;
  }
  
  /**
   * Returns an array of references to all elements quoted by current weak link.
   * 
   * @return {Array<any>}
   */
  unqote() {
    let result = /** @type {Array<any>} */ ([])
    let item = this._firstItem
    //TODO: moved elements
    while (item !== null && item !== this._lastItem) {
      if (!item.deleted) {
        result = result.concat(item.content.getContent())
      }
      item = item.right
    }
    return result
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
        let firstItem = this._firstItem !== null ? this._firstItem : getItemCleanStart(transaction, /** @type {ID} */ (this._quoteStart.item))
        let lastItem = this._lastItem !== null ? this._lastItem : getItemCleanEnd(transaction, y.store, /** @type {ID} */(this._quoteEnd.item))
        if (firstItem.parentSub !== null) {
          // for maps, advance to most recent item
          while (firstItem.right !== null) {
            firstItem = firstItem.right
          }
          lastItem = firstItem
        }
        this._firstItem = firstItem
        this._lastItem = lastItem
        
        /** @type {Item|null} */
        let item = firstItem
        for (; item !== null; item = item.right) {
          createLink(transaction, item, this)
          if (item === lastItem) {
            break;
          }
        }
      })
    }
  }

  /**
   * @return {YWeakLink<T>}
   */
  _copy () {
    return new YWeakLink(this._quoteStart, this._quoteEnd, this._firstItem, this._lastItem)
  }

  /**
   * @return {YWeakLink<T>}
   */
  clone () {
    return new YWeakLink(this._quoteStart, this._quoteEnd, this._firstItem, this._lastItem)
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
    const isSingle = this.isSingle()
    const info =  (isSingle ? 0 : 1) | (this._quoteStart.assoc >= 0 ? 2 : 0) | (this._quoteEnd.assoc >= 0 ? 4 :0)
    encoding.writeUint8(encoder.restEncoder, info)
    writeID(encoder.restEncoder, /** @type {ID} */ (this._quoteStart.item))
    if (!isSingle) {
      writeID(encoder.restEncoder, /** @type {ID} */ (this._quoteEnd.item))
    }
  }
}

  
/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {YWeakLink<any>}
 */
export const readYWeakLink = decoder => {
  const info = decoding.readUint8(decoder.restDecoder)
  const isSingle = (info & 1) !== 1
  const startAssoc = (info & 2) === 2 ? 0 : -1
  const endAssoc = (info & 4) === 4 ? 0 : -1
  const startID = readID(decoder.restDecoder)
  const start = new RelativePosition(null, null, startID, startAssoc)
  const end = new RelativePosition(null, null, isSingle ? startID : readID(decoder.restDecoder), endAssoc)
  return new YWeakLink(start, end, null, null)
}

const invalidQuotedRange = error.create('Invalid quoted range length.')

/**
 * Returns a {WeakLink} to an YArray element at given index.
 * 
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @return {YWeakLink<any>}
 */
export const arrayWeakLink = (transaction, parent, index, length = 1) => {
  if (length <= 0) {
    throw invalidQuotedRange
  }
  let startItem = parent._start
  for (;startItem !== null; startItem = startItem.right) {
    if (!startItem.deleted && startItem.countable) {
      if (index < startItem.length) {
        if (index > 0) {
            startItem = getItemCleanStart(transaction, createID(startItem.id.client, startItem.id.clock + index))
        }
        break;
      }
      index -= startItem.length
    }
  }

  if (startItem !== null) {
    let endItem =  startItem
    let remaining = length
    for (;endItem !== null && endItem.right !== null && endItem.length > remaining; endItem = endItem.right) {
      // iterate over the items to reach the last block in the quoted range
      remaining -= endItem.length
    }
    if (endItem.length >= remaining) {
      endItem = getItemCleanEnd(transaction, transaction.doc.store, createID(startItem.id.client, startItem.id.clock + remaining - 1))
      const start = new RelativePosition(null, null, startItem.id, 0)
      const end = new RelativePosition(null, null, endItem.lastId, -1)
      const link = new YWeakLink(start, end, startItem, endItem)
      if (parent.doc !== null) {
        transact(parent.doc, (transaction) => {
          for (let item = link._firstItem; item !== null; item = item = item.right) {
            createLink(transaction, item, link)
            if (item === link._lastItem) {
              break;
            }
          }
        })
      }
      return link
    }
  }

  throw invalidQuotedRange
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
    const start = new RelativePosition(null, null, item.id, 0)
    const end = new RelativePosition(null, null, item.id, -1)
    const link = new YWeakLink(start, end, item, item)
    if (parent.doc !== null) {
      transact(parent.doc, (transaction) => {
        createLink(transaction, item, link)
      })
    }
    return link
  } else {
    return undefined
  }
}

/**
 * Establishes a link between source and weak link reference.
 * It assumes that source has already been split if necessary.
 * 
 * @param {Transaction} transaction 
 * @param {Item} source
 * @param {YWeakLink<any>} linkRef
 */
export const createLink = (transaction, source, linkRef) => {
  const allLinks = transaction.doc.store.linkedBy
  map.setIfUndefined(allLinks, source, set.create).add(linkRef)
  source.linked = true
}

/**
 * Deletes the link between source and a weak link reference.
 * 
 * @param {Transaction} transaction 
 * @param {Item} source
 * @param {YWeakLink<any>} linkRef
 */
export const unlinkFrom = (transaction, source, linkRef) => {
  const allLinks = transaction.doc.store.linkedBy
  const linkedBy = allLinks.get(source)
  if (linkedBy !== undefined) {
    linkedBy.delete(linkRef)
    if (linkedBy.size === 0) {
      allLinks.delete(source)
      source.linked = false
      if (source.countable) {
        // since linked property is blocking items from merging,
        // it may turn out that source item can be merged now
        transaction._mergeStructs.push(source)
      }
    }
  }
}