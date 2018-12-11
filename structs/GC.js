/**
 * @module structs
 */

import { getStructReference } from '../utils/structReferences.js'
import * as ID from '../utils/ID.js'
import { writeStructToTransaction } from '../utils/structEncoding.js'
import * as decoding from '../lib/decoding.js'
import * as encoding from '../lib/encoding.js'
// import { Y } from '../utils/Y.js' // eslint-disable-line

// TODO should have the same base class as Item
export class GC {
  constructor () {
    /**
     * @type {ID.ID}
     */
    this._id = null
    this._length = 0
  }

  get _redone () {
    return null
  }

  get _deleted () {
    return true
  }

  _integrate (y) {
    const id = this._id
    const userState = y.ss.getState(id.user)
    if (id.clock === userState) {
      y.ss.setState(id.user, id.clock + this._length)
    }
    y.ds.mark(this._id, this._length, true)
    let n = y.os.put(this)
    const prev = n.prev().val
    if (prev !== null && prev.constructor === GC && prev._id.user === n.val._id.user && prev._id.clock + prev._length === n.val._id.clock) {
      // TODO: do merging for all items!
      prev._length += n.val._length
      y.os.delete(n.val._id)
      n = prev
    }
    if (n.val) {
      n = n.val
    }
    const next = y.os.findNext(n._id)
    if (next !== null && next.constructor === GC && next._id.user === n._id.user && next._id.clock === n._id.clock + n._length) {
      n._length += next._length
      y.os.delete(next._id)
    }
    if (id.user !== ID.RootFakeUserID) {
      writeStructToTransaction(y._transaction, this)
    }
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {encoding.Encoder} encoder The encoder to write data to.
   * @private
   */
  _toBinary (encoder) {
    encoding.writeUint8(encoder, getStructReference(this.constructor))
    this._id.encode(encoder)
    encoding.writeVarUint(encoder, this._length)
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {decoding.Decoder} decoder The decoder object to read data from.
   * @private
   */
  _fromBinary (y, decoder) {
    /**
     * @type {any}
     */
    const id = ID.decode(decoder)
    this._id = id
    this._length = decoding.readVarUint(decoder)
    const missing = []
    if (y.ss.getState(id.user) < id.clock) {
      missing.push(ID.createID(id.user, id.clock - 1))
    }
    return missing
  }

  _splitAt () {
    return this
  }

  _clonePartial (diff) {
    const gc = new GC()
    gc._id = ID.createID(this._id.user, this._id.clock + diff)
    gc._length = this._length - diff
    return gc
  }
}
