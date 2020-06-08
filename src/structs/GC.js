
import {
  AbstractStruct,
  addStruct,
  StructStore, Transaction, ID // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'

export const structGCRefNumber = 0

/**
 * @private
 */
export class GC extends AbstractStruct {
  /**
   * @param {ID} id
   * @param {number} length
   */
  constructor (id, length) {
    super(id, length)
    this.deleted = true
  }

  delete () {}

  /**
   * @param {GC} right
   * @return {boolean}
   */
  mergeWith (right) {
    this.length += right.length
    return true
  }

  /**
   * @param {Transaction} transaction
   * @param {number} offset
   */
  integrate (transaction, offset) {
    if (offset > 0) {
      this.id.clock += offset
      this.length -= offset
    }
    addStruct(transaction.doc.store, this)
  }

  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoding.writeUint8(encoder, structGCRefNumber)
    encoding.writeVarUint(encoder, this.length - offset)
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @return {null | ID}
   */
  getMissing (transaction, store) {
    return null
  }
}
