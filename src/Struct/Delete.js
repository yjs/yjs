import { getStructReference } from '../Util/structReferences.js'
import * as ID from '../Util/ID.js'
import { stringifyID } from '../message.js'
import { writeStructToTransaction } from '../Util/Transaction.js'
import * as decoding from '../../lib/decoding.js'
import * as encoding from '../../lib/encoding.js'

/**
 * @private
 * Delete all items in an ID-range.
 * Does not create delete operations!
 * TODO: implement getItemCleanStartNode for better performance (only one lookup).
 */
export function deleteItemRange (y, user, clock, range, gcChildren) {
  let item = y.os.getItemCleanStart(ID.createID(user, clock))
  if (item !== null) {
    if (!item._deleted) {
      item._splitAt(y, range)
      item._delete(y, false, true)
    }
    let itemLen = item._length
    range -= itemLen
    clock += itemLen
    if (range > 0) {
      let node = y.os.findNode(ID.createID(user, clock))
      while (node !== null && node.val !== null && range > 0 && node.val._id.equals(ID.createID(user, clock))) {
        const nodeVal = node.val
        if (!nodeVal._deleted) {
          nodeVal._splitAt(y, range)
          nodeVal._delete(y, false, gcChildren)
        }
        const nodeLen = nodeVal._length
        range -= nodeLen
        clock += nodeLen
        node = node.next()
      }
    }
  }
}

/**
 * @private
 * A Delete change is not a real Item, but it provides the same interface as an
 * Item. The only difference is that it will not be saved in the ItemStore
 * (OperationStore), but instead it is safed in the DeleteStore.
 */
export default class Delete {
  constructor () {
    /**
     * @type {ID.ID}
     */
    this._targetID = null
    /**
     * @type {import('./Item.js').default}
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
   * @param {import('../Y.js').default} y The Yjs instance that this Item belongs to.
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
    return `Delete - target: ${stringifyID(this._targetID)}, len: ${this._length}`
  }
}
