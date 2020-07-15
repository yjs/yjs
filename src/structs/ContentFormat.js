
import {
  AbstractType, AbstractUpdateDecoder, AbstractUpdateEncoder, Item, StructStore, Transaction // eslint-disable-line
} from '../internals.js'

import * as error from 'lib0/error.js'

/**
 * @private
 */
export class ContentFormat {
  /**
   * @param {string} key
   * @param {Object} value
   */
  constructor (key, value) {
    this.key = key
    this.value = value
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
    return []
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return false
  }

  /**
   * @return {ContentFormat}
   */
  copy () {
    return new ContentFormat(this.key, this.value)
  }

  /**
   * @param {number} offset
   * @return {ContentFormat}
   */
  splice (offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {ContentFormat} right
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
    // @todo searchmarker are currently unsupported for rich text documents
    /** @type {AbstractType<any>} */ (item.parent)._searchMarker = null
  }

  /**
   * @param {Transaction} transaction
   */
  delete (transaction) {}
  /**
   * @param {StructStore} store
   */
  gc (store) {}
  /**
   * @param {AbstractUpdateEncoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoder.writeKey(this.key)
    encoder.writeJSON(this.value)
  }

  /**
   * @return {number}
   */
  getRef () {
    return 6
  }
}

/**
 * @param {AbstractUpdateDecoder} decoder
 * @return {ContentFormat}
 */
export const readContentFormat = decoder => new ContentFormat(decoder.readString(), decoder.readJSON())
