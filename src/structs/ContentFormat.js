import * as error from 'lib0/error'

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
   * @param {number} _offset
   * @return {ContentFormat}
   */
  splice (_offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {ContentFormat} _right
   * @return {boolean}
   */
  mergeWith (_right) {
    return false
  }

  /**
   * @param {import('../utils/Transaction.js').Transaction} _transaction
   * @param {import('./Item.js').Item} item
   */
  integrate (_transaction, item) {
    // @todo searchmarker are currently unsupported for rich text documents
    const p = /** @type {import('../ytype.js').YType<any>} */ (item.parent)
    p._searchMarker = null
    p._hasFormatting = true
  }

  /**
   * @param {import('../utils/Transaction.js').Transaction} _transaction
   */
  delete (_transaction) {}
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
 * @param {import('../utils/UpdateDecoder.js').UpdateDecoderV1 | import('../utils/UpdateDecoder.js').UpdateDecoderV2} decoder
 * @return {ContentFormat}
 */
export const readContentFormat = decoder => new ContentFormat(decoder.readKey(), decoder.readJSON())
