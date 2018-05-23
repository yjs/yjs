import { getStructReference } from '../Util/structReferences.mjs'
import ID from '../Util/ID/ID.mjs'
import { logID } from '../MessageHandler/messageToString.mjs'
import { writeStructToTransaction } from '../Transaction.mjs'

/**
 * @private
 * Delete all items in an ID-range
 * TODO: implement getItemCleanStartNode for better performance (only one lookup)
 */
export function deleteItemRange (y, user, clock, range, gcChildren) {
  const createDelete = y.connector !== null && y.connector._forwardAppliedStructs
  let item = y.os.getItemCleanStart(new ID(user, clock))
  if (item !== null) {
    if (!item._deleted) {
      item._splitAt(y, range)
      item._delete(y, createDelete, true)
    }
    let itemLen = item._length
    range -= itemLen
    clock += itemLen
    if (range > 0) {
      let node = y.os.findNode(new ID(user, clock))
      while (node !== null && node.val !== null && range > 0 && node.val._id.equals(new ID(user, clock))) {
        const nodeVal = node.val
        if (!nodeVal._deleted) {
          nodeVal._splitAt(y, range)
          nodeVal._delete(y, createDelete, gcChildren)
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
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   */
  _fromBinary (y, decoder) {
    // TODO: set target, and add it to missing if not found
    // There is an edge case in p2p networks!
    const targetID = decoder.readID()
    this._targetID = targetID
    this._length = decoder.readVarUint()
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
   * @param {BinaryEncoder} encoder The encoder to write data to.
   */
  _toBinary (encoder) {
    encoder.writeUint8(getStructReference(this.constructor))
    encoder.writeID(this._targetID)
    encoder.writeVarUint(this._length)
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
    } else if (y.connector !== null) {
      // from local
      y.connector.broadcastStruct(this)
    }
    if (y.persistence !== null) {
      y.persistence.saveStruct(y, this)
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
    return `Delete - target: ${logID(this._targetID)}, len: ${this._length}`
  }
}
