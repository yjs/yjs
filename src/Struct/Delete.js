import StructManager from '../Util/StructManager.js'

export default class Delete {
  constructor () {
    this._target = null
    this._length = null
  }
  _fromBinary (y, decoder) {
    this._targetID = decoder.readOpID()
    this._length = decoder.readVarUint()
  }
  _toBinary (y, encoder) {
    encoder.writeUint8(StructManager.getReference(this.constructor))
    encoder.writeOpID(this._targetID)
    encoder.writeVarUint(this._length)
  }
  _integrate (y) {
    let items = y.os.getItems(this._target, this._length)
    for (let i = items.length - 1; i >= 0; i--) {
      items[i]._delete()
    }
    // TODO: only broadcast if created by local user or if y.connector._forwardAppliedStructs..
    y.connector.broadcastStruct(this)
    if (y.persistence !== null) {
      y.persistence.saveOperations(this)
    }
  }
  _logString () {
    return `Delete - target: ${this._target}, len: ${this._length}`
  }
}
