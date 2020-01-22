import {
  Transaction, Item, StructStore // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

/**
 * @private
 */
export class ContentJSON {
  /**
   * @param {Array<any>} arr
   */
  constructor (arr) {
    /**
     * @type {Array<any>}
     */
    this.arr = arr
  }

  /**
   * @return {number}
   */
  getLength () {
    return this.arr.length
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    return this.arr
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return true
  }

  /**
   * @return {ContentJSON}
   */
  copy () {
    return new ContentJSON(this.arr)
  }

  /**
   * @param {number} offset
   * @return {ContentJSON}
   */
  splice (offset) {
    const right = new ContentJSON(this.arr.slice(offset))
    this.arr = this.arr.slice(0, offset)
    return right
  }

  /**
   * @param {ContentJSON} right
   * @return {boolean}
   */
  mergeWith (right) {
    this.arr = this.arr.concat(right.arr)
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
    const len = this.arr.length
    encoding.writeVarUint(encoder, len - offset)
    for (let i = offset; i < len; i++) {
      const c = this.arr[i]
      encoding.writeVarString(encoder, c === undefined ? 'undefined' : JSON.stringify(c))
    }
  }

  /**
   * @return {number}
   */
  getRef () {
    return 2
  }
}

/**
 * @private
 *
 * @param {decoding.Decoder} decoder
 * @return {ContentJSON}
 */
export const readContentJSON = decoder => {
  const len = decoding.readVarUint(decoder)
  const cs = []
  for (let i = 0; i < len; i++) {
    const c = decoding.readVarString(decoder)
    if (c === 'undefined') {
      cs.push(undefined)
    } else {
      cs.push(JSON.parse(c))
    }
  }
  return new ContentJSON(cs)
}
