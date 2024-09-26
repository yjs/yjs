import { decoding, encoding } from 'lib0'
import * as map from 'lib0/map'
import * as set from 'lib0/set'
import {
  YEvent, AbstractType,
  transact,
  getItemCleanEnd,
  getItemCleanStart,
  callTypeObservers,
  YWeakLinkRefID,
  writeID,
  readID,
  RelativePosition,
  ContentString,
  rangeDelta,
  formatXmlString,
  YText,
  YXmlText,
  Transaction, Item, Doc, ID, Snapshot, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, YRange, rangeToRelative, // eslint-disable-line
} from '../internals.js'

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
  // eslint-disable-next-line no-useless-constructor
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
    */
  constructor (start, end, firstItem) {
    super()
    /** @type {RelativePosition} */
    this._quoteStart = start
    /** @type {RelativePosition} */
    this._quoteEnd = end
    /** @type {Item|null} */
    this._firstItem = firstItem
  }

  /**
   * Position descriptor of the start of a quoted range.
   *
   * @returns {RelativePosition}
   */
  get quoteStart () {
    return this._quoteStart
  }

  /**
   * Position descriptor of the end of a quoted range.
   *
   * @returns {RelativePosition}
   */
  get quoteEnd () {
    return this._quoteEnd
  }

  /**
   * Check if current link contains only a single element.
   *
   * @returns {boolean}
   */
  get isSingle () {
    return this._quoteStart.item === this._quoteEnd.item
  }

  /**
   * Returns a reference to an underlying value existing somewhere on in the document.
   *
   * @return {T|undefined}
   */
  deref () {
    if (this._firstItem !== null) {
      let item = this._firstItem
      if (item.parentSub !== null) {
        while (item.right !== null) {
          item = item.right
        }
        // we don't support quotations over maps
        this._firstItem = item
      }
      if (!item.deleted) {
        return item.content.getContent()[0]
      }
    }

    return undefined
  }

  /**
   * Returns an array of references to all elements quoted by current weak link.
   *
   * @return {Array<any>}
   */
  unquote () {
    let result = /** @type {Array<any>} */ ([])
    let n = this._firstItem
    if (n !== null && this._quoteStart.assoc >= 0) {
      // if assoc >= we exclude start from range
      n = n.right
    }
    const end = /** @type {ID} */ (this._quoteEnd.item)
    const endAssoc = this._quoteEnd.assoc
    // TODO: moved elements
    while (n !== null) {
      if (endAssoc < 0 && n.id.client === end.client && n.id.clock === end.clock) {
        // right side is open (last item excluded)
        break
      }
      if (!n.deleted) {
        result = result.concat(n.content.getContent())
      }
      const lastId = n.lastId
      if (endAssoc >= 0 && lastId.client === end.client && lastId.clock === end.clock) {
        break
      }
      n = n.right
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
        let [firstItem, lastItem] = sliceBlocksByRange(transaction, this._quoteStart, this.quoteEnd)
        if (firstItem.parentSub !== null) {
          // for maps, advance to most recent item
          while (firstItem.right !== null) {
            firstItem = firstItem.right
          }
        }
        this._firstItem = firstItem

        /** @type {Item|null} */
        let item = firstItem
        for (;item !== null; item = item.right) {
          createLink(transaction, item, this)
          if (item === lastItem) {
            break
          }
        }
      })
    }
  }

  /**
   * @return {YWeakLink<T>}
   */
  _copy () {
    return new YWeakLink(this._quoteStart, this._quoteEnd, this._firstItem)
  }

  /**
   * @return {YWeakLink<T>}
   */
  clone () {
    return new YWeakLink(this._quoteStart, this._quoteEnd, this._firstItem)
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
    const isSingle = this.isSingle
    /**
     * Info flag bits:
     * - 0: is quote spanning over single element? 
     *      If this bit is set, we skip writing ID of quotation end.
     * - 1: is quotation start inclusive
     * - 2: is quotation end exclusive
     * 
     * Future proposition for bits usage:
     * - 3: is quotation start unbounded. 
     * - 4: is quotation end unbounded
     * - 5: if quotation is unbounded on both ends, this bit says if quoted collection is root type.
     *      The next ID/String is a quoted collection ID or name.
     * - 6: this quotation links to a subdocument.
     *      If set, the last segment of data contains info that may be needed to restore subdoc data.
     * - 7: left unused. Potentially useful as a varint continuation flag if we need to expand this
     *      flag in the future. 
     */
    const info = (isSingle ? 0 : 1) | (this._quoteStart.assoc >= 0 ? 2 : 0) | (this._quoteEnd.assoc >= 0 ? 4 : 0)
    encoding.writeUint8(encoder.restEncoder, info)
    writeID(encoder.restEncoder, /** @type {ID} */ (this._quoteStart.item))
    if (!isSingle) {
      writeID(encoder.restEncoder, /** @type {ID} */ (this._quoteEnd.item))
    }
  }

  /**
   * Returns the unformatted string representation of this quoted text range.
   *
   * @public
   */
  toString () {
    let n = this._firstItem
    if (n !== null && this._quoteStart.assoc >= 0) {
      // if assoc >= we exclude start from range
      n = n.right
    }
    if (n !== null) {
      switch (/** @type {AbstractType<any>} */ (n.parent).constructor) {
        case YText: {
          let str = ''
          const end = /** @type {ID} */ (this._quoteEnd.item)
          const endAssoc = this._quoteEnd.assoc
          while (n !== null) {
            if (endAssoc < 0 && n.id.client === end.client && n.id.clock === end.clock) {
              // right side is open (last item excluded)
              break
            }
            if (!n.deleted && n.countable && n.content.constructor === ContentString) {
              str += /** @type {ContentString} */ (n.content).str
            }
            if (endAssoc >= 0) {
              const lastId = n.lastId
              if (lastId.client === end.client && lastId.clock === end.clock) {
                // right side is closed (last item included)
                break
              }
            }
            n = n.right
          }
          return str
        }
        case YXmlText:
          return this.toDelta().map(delta => formatXmlString(delta)).join('')
      }
    } else {
      return ''
    }
  }

  /**
   * Returns the Delta representation of quoted part of underlying text type.
   *
   * @param {Snapshot|undefined} [snapshot]
   * @param {Snapshot|undefined} [prevSnapshot]
   * @param {function('removed' | 'added', ID):any} [computeYChange]
   * @returns {Array<any>}
   */
  toDelta (snapshot, prevSnapshot, computeYChange) {
    if (this._firstItem !== null && this._quoteStart.item !== null && this._quoteEnd.item !== null) {
      const parent = /** @type {AbstractType<any>} */ (this._firstItem.parent)
      return rangeDelta(parent, this._quoteStart.item, this._quoteEnd.item, snapshot, prevSnapshot, computeYChange)
    } else {
      return []
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
  return new YWeakLink(start, end, null)
}

/**
 * Returns a {WeakLink} to an YArray element at given index.
 *
 * @param {AbstractType<any>} parent
 * @param {Transaction} transaction
 * @param {YRange} range
 * @return {YWeakLink<any>}
 */
export const quoteRange = (transaction, parent, range) => {
  const [start, end] = rangeToRelative(parent, range)
  const [startItem, endItem] = sliceBlocksByRange(transaction, start, end)
  const link = new YWeakLink(start, end, startItem)
  if (parent.doc !== null) {
    transact(parent.doc, (transaction) => {
      for (let item = link._firstItem; item !== null; item = item = item.right) {
        createLink(transaction, item, link)
        if (item === endItem) {
          break
        }
      }
    })
  }
  return link
}

/**
 * Checks relative position markers and slices the corresponding struct store items
 * across their positions.
 *
 * @param {Transaction} transaction
 * @param {RelativePosition} start
 * @param {RelativePosition} end
 * @returns {Array<Item>} first and last item that belongs to a sliced range
 */
const sliceBlocksByRange = (transaction, start, end) => {
  if (start.item === null || end.item === null) {
    throw new Error('this operation requires range to be bounded on both sides')
  }
  const first = getItemCleanStart(transaction, start.item)
  /** @type {Item} */
  let last
  if (end.assoc >= 0) {
    last = getItemCleanEnd(transaction, transaction.doc.store, end.item)
  } else {
    const item = getItemCleanStart(transaction, end.item)
    last = /** @type {Item} */ (item.left)
  }
  return [first, last]
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
    const link = new YWeakLink(start, end, item)
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

/**
 * Rebinds linkedBy links pointed between neighbours of a current item.
 * This method expects that current item has both left and right neighbours.
 *
 * @param {Transaction} transaction
 * @param {Item} item
 */
export const joinLinkedRange = (transaction, item) => {
  item.linked = true
  const allLinks = transaction.doc.store.linkedBy
  const leftLinks = allLinks.get(/** @type {Item} */ (item.left))
  const rightLinks = allLinks.get(/** @type {Item} */ (item.right))
  if (leftLinks && rightLinks) {
    const common = new Set()
    for (const link of leftLinks) {
      if (rightLinks.has(link)) {
        // new item existing in a quoted range in between two elements
        common.add(link)
      } else if (link._quoteEnd.assoc < 0) {
        // We're at the right edge of quoted range - right neighbor is not included
        // but the left one is. Since quotation is open on the right side, we need to
        // include current item.
        common.add(link)
      }
    }
    for (const link of rightLinks) {
      if (!leftLinks.has(link) && link._firstItem === item.left && link._quoteStart.assoc >= 0) {
        // We're at the right edge of quoted range - right neighbor is not included
        // but the left one is. Since quotation is open on the right side, we need to
        // include current item.
        link._firstItem = item // this item is the new most left-wise
        common.add(link)
      }
    }
    if (common.size !== 0) {
      allLinks.set(item, common)
    }
  }
}
