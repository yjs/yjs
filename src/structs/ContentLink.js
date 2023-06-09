import { decoding, encoding, error } from 'lib0'
import {
    UpdateEncoderV1, UpdateEncoderV2, UpdateDecoderV1, UpdateDecoderV2, Transaction, Item, StructStore, // eslint-disable-line
    YWeakLink,
    AbstractType,
    getItemCleanStart,
    createID,
    getItemCleanEnd
  } from '../internals.js'
  
  export class ContentLink {
    /**
     * @param {YWeakLink<any>} link
     */
    constructor (link) {
      this.link = link
      /** 
       * @type {Item|null} 
       */
      this._item = null
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
      let sourceItem = this.link.item !== null ? this.link.item : getItemCleanStart(transaction, this.link.id)
      if (sourceItem.constructor === Item && sourceItem.parentSub !== null) {
        // for maps, advance to most recent item
        while (sourceItem.right !== null) {
          sourceItem = sourceItem.right
        }
      }
      if (!sourceItem.deleted && sourceItem.length > 1) {
        sourceItem = getItemCleanEnd(transaction, transaction.doc.store, createID(sourceItem.id.client, sourceItem.id.clock + 1))
      }
      this.link.item = sourceItem
      this._item = item
      if (!sourceItem.deleted) {
        const src = /** @type {Item} */ (sourceItem)
        if (src.linkedBy === null) {
          src.linkedBy = new Set()
        }
        src.linkedBy.add(item)
      }
    }
    
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {
      if (this._item !== null && this.link !== null && this.link.item !== null && !this.link.item.deleted) {
        const item = /** @type {Item} */ (this.link.item)
        if (item.linkedBy !== null) {
          item.linkedBy.delete(this._item)
        }
        this.link.item = null
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
      const flags = 0 // flags that could be used in the future
      encoding.writeUint8(encoder.restEncoder, flags)
      encoder.writeLeftID(this.link.id)
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
    const flags = decoding.readUint8(decoder.restDecoder)
    const id = decoder.readLeftID()
    return new ContentLink(new YWeakLink(id, null))
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
            item = getItemCleanEnd(transaction, transaction.doc.store, createID(item.id.client, item.id.clock + 1))
        }
        return new YWeakLink(item.id, item)
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
    return new YWeakLink(item.id, item)
  } else {
    return undefined
  }
}