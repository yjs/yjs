import { getReference } from '../Util/structReferences.js'
import ID from '../Util/ID.js'

/**
 * Delete all items in an ID-range
 * TODO: implement getItemCleanStartNode for better performance (only one lookup)
 */
export function deleteItemRange (y, user, clock, range) {
  const createDelete = y.connector._forwardAppliedStructs
  let item = y.os.getItemCleanStart(new ID(user, clock))
  if (item !== null) {
    if (!item._deleted) {
      item._splitAt(y, range)
      item._delete(y, createDelete)
    }
    let itemLen = item._length
    range -= itemLen
    clock += itemLen
    if (range > 0) {
      let node = y.os.findNode(new ID(user, clock))
      while (node !== null && range > 0 && node.val._id.equals(new ID(user, clock))) {
        const nodeVal = node.val
        if (!nodeVal._deleted) {
          nodeVal._splitAt(y, range)
          nodeVal._delete(y, createDelete)
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
 * Delete is not a real struct. It will not be saved in OS
 */
export default class Delete {
  constructor () {
    this._targetID = null
    this._length = null
  }
  _fromBinary (y, decoder) {
    this._targetID = decoder.readID()
    this._length = decoder.readVarUint()
    return []
  }
  _toBinary (encoder) {
    encoder.writeUint8(getReference(this.constructor))
    encoder.writeID(this._targetID)
    encoder.writeVarUint(this._length)
  }
  /**
   * - If created remotely (a remote user deleted something),
   *   this Delete is applied to all structs in id-range.
   * - If created lokally (e.g. when y-array deletes a range of elements),
   *   this struct is broadcasted only (it is already executed)
   */
  _integrate (y, locallyCreated = false) {
    if (!locallyCreated) {
      // from remote
      const id = this._targetID
      deleteItemRange(y, id.user, id.clock, this._length)
    } else {
      // from local
      y.connector.broadcastStruct(this)
    }
    if (y.persistence !== null) {
      y.persistence.saveOperations(this)
    }
  }
  _logString () {
    return `Delete - target: ${this._target}, len: ${this._length}`
  }
}
