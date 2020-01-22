import {
  Transaction, Item, StructStore // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

/**
 * @private
 */
export class ContentString {
  /**
   * @param {string} str
   */
  constructor (str) {
    /**
     * @type {string}
     */
    this.str = str
  }

  /**
   * @return {number}
   */
  getLength () {
    return this.str.length
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    return this.str.split('')
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return true
  }

  /**
   * @return {ContentString}
   */
  copy () {
    return new ContentString(this.str)
  }

  /**
   * @param {number} offset
   * @return {ContentString}
   */
  splice (offset) {
    const right = new ContentString(this.str.slice(offset))
    this.str = this.str.slice(0, offset)
    return right
  }

  /**
   * @param {ContentString} right
   * @return {boolean}
   */
  mergeWith (right) {
    this.str += right.str
    return true
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
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoding.writeVarString(encoder, offset === 0 ? this.str : this.str.slice(offset))
  }

  /**
   * @return {number}
   */
  getRef () {
    return 4
  }
}

/**
 * @private
 *
 * @param {decoding.Decoder} decoder
 * @return {ContentString}
 */
export const readContentString = decoder => new ContentString(decoding.readVarString(decoder))
