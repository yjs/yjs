
export default class GC {
  constructor () {
    this._id = null
    this._length = 0
  }

  get _deleted () {
    return true
  }

  integrate () {
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   * @private
   */
  _toBinary (encoder) {
    encoder.writeUint8(getStructReference(this.constructor))
    encoder.writeID(this._id)
    encoder.writeVarUint(this._length)
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   * @private
   */
  _fromBinary (y, decoder) {
    this._id = decoder.readID()
    this._length = decoder.readVarUint()
    return []
  }  
}