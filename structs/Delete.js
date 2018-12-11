/**
 * @module structs
 */

import { getStructReference } from '../utils/structReferences.js'
import * as ID from '../utils/ID.js'
import { writeStructToTransaction } from '../utils/structEncoding.js'
import * as decoding from '../lib/decoding.js'
import * as encoding from '../lib/encoding.js'
// import { Item } from './Item.js' // eslint-disable-line
// import { Y } from '../utils/Y.js' // eslint-disable-line
import { deleteItemRange } from '../utils/structManipulation.js'
import * as stringify from '../utils/structStringify.js'

/**
 * @private
 * A Delete change is not a real Item, but it provides the same interface as an
 * Item. The only difference is that it will not be saved in the ItemStore
 * (OperationStore), but instead it is safed in the DeleteStore.
 */
export class Delete {
  constructor () {
    /**
     * @type {ID.ID}
     */
    this._targetID = null
    /**
     * @type {Item}
     */
    this._target = null
    this._length = null
  }

  /**
   * @private
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {decoding.Decoder} decoder The decoder object to read data from.
   */
  _fromBinary (y, decoder) {
    // TODO: set target, and add it to missing if not found
    // There is an edge case in p2p networks!
    /**
     * @type {any}
     */
    const targetID = ID.decode(decoder)
    this._targetID = targetID
    this._length = decoding.readVarUint(decoder)
    if (y.os.getItem(targetID) === null) {
      return [targetID]
    } else {
      return []
    }
  }

  /**
   * @private
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   */
  _toBinary (encoder) {
    encoding.writeUint8(encoder, getStructReference(this.constructor))
    this._targetID.encode(encoder)
    encoding.writeVarUint(encoder, this._length)
  }

  /**
   * @private
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In the case of
   * Delete it marks the delete target as deleted.
   *
   * * If created remotely (a remote user deleted something),
   *   this Delete is applied to all structs in id-range.
   * * If created lokally (e.g. when y-array deletes a range of elements),
   *   this struct is broadcasted only (it is already executed)
   */
  _integrate (y, locallyCreated = false) {
    if (!locallyCreated) {
      // from remote
      const id = this._targetID
      deleteItemRange(y, id.user, id.clock, this._length, false)
    }
    writeStructToTransaction(y._transaction, this)
  }

  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return `Delete - target: ${stringify.stringifyID(this._targetID)}, len: ${this._length}`
  }
}
