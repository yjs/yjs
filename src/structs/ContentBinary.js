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
   * @param {import('../utils/Transaction.js').Transaction} transaction
   * @param {import('./Item.js').Item} item
   */
  integrate (transaction, item) {}
  /**
   * @param {import('../utils/Transaction.js').Transaction} transaction
   */
  delete (transaction) {}
  /**
   * @param {import('../utils/Transaction.js').Transaction} _tr
   */
  gc (_tr) {}
  /**
   * @param {import('../utils/UpdateEncoder.js').UpdateEncoderV1 | import('../utils/UpdateEncoder.js').UpdateEncoderV2} encoder
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
 * @param {import('../utils/UpdateDecoder.js').UpdateDecoderV1 | import('../utils/UpdateDecoder.js').UpdateDecoderV2 } decoder
 * @return {ContentBinary}
 */
export const readContentBinary = decoder => new ContentBinary(decoder.readBuf())
