import {
    UpdateEncoderV1, UpdateEncoderV2, UpdateDecoderV1, UpdateDecoderV2, Transaction, Item, StructStore // eslint-disable-line
  } from '../internals.js'
  
  export class ContentLink {
    /**
     * @param {Item} item
     */
    constructor (item) {
      /**
       * @type {Item}
       */
      this.item = item
    }
  
    /**
     * @return {number}
     */
    getLength () {
      return this.item.length
    }
  
    /**
     * @return {Array<any>}
     */
    getContent () {
      throw new Error('not implemented')
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
      return new ContentLink(this.item)
    }
  
    /**
     * @param {number} offset
     * @return {ContentLink}
     */
    splice (offset) {
      throw new Error('not implemented')
    }
  
    /**
     * @param {ContentLink} right
     * @return {boolean}
     */
    mergeWith (right) {
      throw new Error('not implemented')
    }
  
    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {}
    
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}

    /**
     * @param {StructStore} store
     */
    gc (store) {}

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      throw new Error('not implemented')
    }
  
    /**
     * @return {number}
     */
    getRef () {
      return 10
    }
  }
  
  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentLink}
   */
  export const readContentWeakLink = decoder => {
    throw new Error('not implemented')
  }
  