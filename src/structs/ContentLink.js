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
     * @param {WeakLink<any>|null} link
     * @param {{type:ID|null,tname:string|null,item:ID|null,key:string|null}|null} raw
     */
    constructor (link, raw) {
      this.link = link
      this.raw = raw
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
      return new ContentLink(this.link, this.raw)
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
      if (this.raw !== null) {
        const { type, tname, key, item } = this.raw
        let parent = null
        if (type !== null) {
          const parentItem = find(transaction.doc.store, type)
          if (parentItem.constructor === Item) {
            parent = /** @type {ContentType} */ (parentItem.content).type
          } else {
            parent = null
          }
        } else {
          parent = /** @type {AbstractType<any>} */ (transaction.doc.share.get(/** @type {string} */ (tname)))
        }

        let target = null
        if (item !== null) {
          target = getItemCleanStart(transaction, item)
          if (target.length > 1) {
            target = getItemCleanEnd(transaction, transaction.doc.store, createID(target.id.client, target.id.clock + 1))
          }
        } else if (parent !== null) {
          target = parent._map.get(/** @type {string} */ (key)) || null
        }
        const source = (parent !== null && target !== null) ? {parent: parent, item: target, key: key} : null
        this.link = new WeakLink(source)
        this.raw = null
      }

      const linked = /** @type {WeakLink<any>} */ (this.link).linkedItem()
      if (linked !== undefined && linked.constructor === Item) {
        if (linked.linkedBy === null) {
          linked.linkedBy = new Set()
        }
        linked.linkedBy.add(/** @type {WeakLink<any>} */ (this.link))
      }
    }
    
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {
      if (this.link !== null && this.link.source !== null) {
        const item = this.link.source.item
        if (item !== null && item.constructor === Item) {
          if (item.linkedBy !== null) {
            item.linkedBy.delete(this.link)
          }
        }
        this.link.source = null
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
      let type = null
      let tname = null
      let item = null
      let key = null
      let flags = 0
      if (this.raw !== null) {
        type = this.raw.type
        tname = this.raw.tname
        key = this.raw.key
        item = this.raw.item
      } else {
        const source = /** @type {WeakLink<any>} */ (this.link).source
        if (source !== null) {
          if (source.parent._item !== null) {
            type = source.parent._item.id
          } else {
            tname = findRootTypeKey(source.parent)
          }
          if (source.item !== null) {
            item = source.item.id
          } else {
            key = source.key
          }
        }
      }
      
      if (type !== null) {
        flags |= 1
      }
      if (item !== null) {
        flags |= 2
      }
      encoding.writeVarUint(encoder.restEncoder, flags)
      if (type !== null) {
        encoder.writeLeftID(type)
      } else {
        encoder.writeString(/** @type {string} */ (tname))
      }
      if (item !== null) {
        encoder.writeLeftID(item)
      } else {
        encoder.writeString(/** @type {string} */ (key))
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
    let type = null
    let tname = null
    let item = null
    let key = null
    if ((flags & 1) !== 0) {
      type = decoder.readLeftID()
    } else {
      tname = decoder.readString()
    }
    if ((flags & 2) !== 0) {
      item = decoder.readLeftID()
    } else {
      key = decoder.readString()
    }
    return new ContentLink(null, { type, tname, item, key })
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
  let item = parent._start
  if (marker !== null) {
    item = marker.p
    index -= marker.index
  }
  for (; item !== null; item = item.right) {
    if (!item.deleted && item.countable) {
      if (index < item.length) {
        if (index > 0) {
            item = getItemCleanStart(transaction, createID(item.id.client, item.id.clock + index))
        }
        if (item.length > 1) {
            item = getItemCleanEnd(transaction, transaction.doc.store, createID(item.id.client, item.id.clock + 1))
        }
        return new WeakLink({parent, item, key: null})
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
 * @return {WeakLink<any>|undefined}
 */
export const mapWeakLink = (parent, key) => {
  const item = parent._map.get(key)
  if (item !== undefined) {
    return new WeakLink({parent, item, key})
  } else {
    return undefined
  }
}