import { Y } from '../utils/Y.js' // eslint-disable-line
import { ID, createID } from '../utils/ID.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as error from 'lib0/error.js'

// eslint-disable-next-line
export class AbstractStruct {
  /**
   * @param {ID} id
   */
  constructor (id) {
    /**
     * The uniqe identifier of this struct.
     * @type {ID}
     * @readonly
     */
    this.id = id
  }
  /**
   * @type {number}
   */
  get length () {
    throw error.methodUnimplemented()
  }
  /**
   * @param {encoding.Encoder} encoder The encoder to write data to.
   * @param {number} encodingRef
   * @private
   */
  write (encoder, encodingRef) {
    throw error.methodUnimplemented()
  }
}

export class AbstractRef {
  /**
   * @return {Array<ID|null>}
   */
  getMissing () {
    return []
  }
  /**
   * @param {Transaction} transaction
   * @return {AbstractStruct}
   */
  toStruct (transaction) {
    throw error.methodUnimplemented()
  }
}
