import {
  AbstractStruct,
  addStruct,
  addToIdSet,
  UpdateEncoderV1, UpdateEncoderV2, StructStore, Transaction, // eslint-disable-line
  createID
} from '../internals.js'

import * as encoding from 'lib0/encoding'

export const structSkipRefNumber = 10

/**
 * @private
 */
export class Skip extends AbstractStruct {
  get deleted () {
    return false
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
    if (offset > 0) {
      this.id.clock += offset
      this.length -= offset
    }
    addToIdSet(transaction.doc.store.skips, this.id.client, this.id.clock, this.length)
    addStruct(transaction.doc.store, this)
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoder.writeInfo(structSkipRefNumber)
    // write as VarUint because Skips can't make use of predictable length-encoding
    encoding.writeVarUint(encoder.restEncoder, this.length - offset)
  }

  /**
   * @param {Transaction} _transaction
   * @param {StructStore} _store
   * @return {null | number}
   */
  getMissing (_transaction, _store) {
    return null
  }

  /**
   * @param {number} diff
   */
  splice (diff) {
    const other = new Skip(createID(this.id.client, this.id.clock + diff), this.length - diff)
    this.length = diff
    return other
  }
}
