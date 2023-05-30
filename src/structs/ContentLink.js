import { decoding, encoding, error } from 'lib0'
import {
    UpdateEncoderV1, UpdateEncoderV2, UpdateDecoderV1, UpdateDecoderV2, Transaction, Item, StructStore, // eslint-disable-line
    WeakLink,
    findRootTypeKey,
    ID,
    find,
    ContentType
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
          item = find(transaction.doc.store, item)
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
  