import { decoding, encoding, error } from 'lib0'
import {
    UpdateEncoderV1, UpdateEncoderV2, UpdateDecoderV1, UpdateDecoderV2, Transaction, Item, StructStore, // eslint-disable-line
    WeakLink,
    findRootTypeKey,
    ID,
    find,
    ContentType,
    AbstractType,
    findMarker,
    getItemCleanStart,
    createID,
    getItemCleanEnd
  } from '../internals.js'
  
  export class ContentLink {
    /**
     * @param {WeakLink<any>|{parent:string|ID,item:string|ID}} link
     */
    constructor (link) {
      this.link = link
    }
  
    /**
     * @return {number}
     */
    getLength () {
      return 1
    }
  
    /**
     * @return {Array<any>}
     */
    getContent () {
      return [this.link]
    }
  
    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }
  
    /**
     * @return {ContentLink}
     */
    copy () {
      return new ContentLink(this.link)
    }
  
    /**
     * @param {number} offset
     * @return {ContentLink}
     */
    splice (offset) {
      throw error.methodUnimplemented()
    }
  
    /**
     * @param {ContentLink} right
     * @return {boolean}
     */
    mergeWith (right) {
      return false
    }
  
    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {
      if (this.link.constructor !== WeakLink) {
        let { parent, item } = /** @type {any} */ (this.link)
        let key = null
        if (parent.constructor === ID) {
          const parentItem = find(transaction.doc.store, parent)
          if (parentItem.constructor === Item) {
            parent = /** @type {ContentType} */ (parentItem.content).type
          } else {
            parent = null
          }
        } else {
          parent = transaction.doc.share.get(parent)
        }

        if (item.constructor === ID) {
          item = getItemCleanStart(transaction, item)
          if (item.length > 1) {
            item = getItemCleanEnd(transaction, transaction.doc.store, createID(item.id.client, item.id.clock + 1))
          }
        } else {
          key = item
          item = parent._map.get(key)
        }
        this.link = new WeakLink(parent, item, key)
      }

      const link = /** @type {WeakLink<any>} */ (this.link)
      if (link.item.constructor === Item) {
        if (link.item.linkedBy === null) {
            link.item.linkedBy = new Set()
        }
        link.item.linkedBy.add(link)
      }
    }
    
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {
      const link = /** @type {WeakLink<any>} */ (this.link)
      if (link.item.constructor === Item) {
        if (link.item.linkedBy !== null) {
          link.item.linkedBy.delete(link)
        }
      }
    }

    /**
     * @param {StructStore} store
     */
    gc (store) {}

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      const link = /** @type {WeakLink<any>} */ (this.link)
      let flags = 0
      const parentItem = link.source._item
      if (parentItem) {
        flags |= 1
      }
      if (link.key) {
        flags |= 2
      }
      encoding.writeVarUint(encoder.restEncoder, flags)
      if (parentItem) {
        encoder.writeLeftID(parentItem.id)
      } else {
        const ykey = findRootTypeKey(link.source)
        encoder.writeString(ykey)
      }
      if (link.key !== null) {
        encoder.writeString(link.key)
      } else {
        encoder.writeLeftID(link.item.id)
      }
    }
  
    /**
     * @return {number}
     */
    getRef () {
      return 11
    }
  }
  
  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentLink}
   */
  export const readContentWeakLink = decoder => {
    const flags = decoding.readVarUint(decoder.restDecoder)
    let parent
    let item
    if ((flags & 1) !== 0) {
      parent = decoder.readLeftID()
    } else {
      parent = decoder.readString()
    }
    if ((flags & 2) !== 0) {
      item = decoder.readString()
    } else {
      item = decoder.readLeftID()
    }
    return new ContentLink({parent, item})
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
            n = getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index))
        }
        if (n.length > 1) {
            n = getItemCleanEnd(transaction, transaction.doc.store, createID(n.id.client, n.id.clock + 1))
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