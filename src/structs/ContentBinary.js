import {
  UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, StructStore, Item, Transaction // eslint-disable-line
} from '../internals.js'

import * as error from 'lib0/error'

export class ContentBinary {
  /**
   * @param {Uint8Array} content
   */
  constructor (content) {
    this.content = content
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
    return [this.content]
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return true
  }

  /**
   * @return {ContentBinary}
   */
  copy () {
    return new ContentBinary(this.content)
  }

  /**
   * @param {number} offset
   * @return {ContentBinary}
   */
  splice (offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {ContentBinary} right
   * @return {boolean}
   */
  mergeWith (right) {
    return false
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
   * @param {Transaction} _tr
   */
  gc (_tr) {}
  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} _offset
   * @param {number} _offsetEnd
   */
  write (encoder, _offset, _offsetEnd) {
    encoder.writeBuf(this.content)
  }

  /**
   * @return {number}
   */
  getRef () {
    return 3
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2 } decoder
 * @return {ContentBinary}
 */
export const readContentBinary = decoder => new ContentBinary(decoder.readBuf())
