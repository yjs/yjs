
import {
  AbstractStruct,
  AbstractUpdateEncoder, StructStore, Transaction, ID // eslint-disable-line
} from '../internals.js'
import * as error from 'lib0/error.js'

export const structSkipRefNumber = 10

/**
 * @private
 */
export class Skip extends AbstractStruct {
  get deleted () {
    return true
  }

  delete () {}

  /**
   * @param {Skip} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (this.constructor !== right.constructor) {
      return false
    }
    this.length += right.length
    return true
  }

  /**
   * @param {Transaction} transaction
   * @param {number} offset
   */
  integrate (transaction, offset) {
    // skip structs cannot be integrated
    error.unexpectedCase()
  }

  /**
   * @param {AbstractUpdateEncoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoder.writeInfo(structSkipRefNumber)
    encoder.writeLen(this.length - offset)
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @return {null | number}
   */
  getMissing (transaction, store) {
    return null
  }
}
