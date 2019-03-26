import { Y } from '../utils/Y.js' // eslint-disable-line
import { ID } from '../utils/ID.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line

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
    throw new Error('unimplemented')
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
  toStruct (transaction) { throw new Error('Must be defined') }
}
