import { getReference } from '../Util/structReferences.js'

export function deleteItemRange (y, user, clock, range) {
  let items = y.os.getItems(this._target, this._length)
  for (let i = items.length - 1; i >= 0; i--) {
    items[i]._delete(y, false)
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
