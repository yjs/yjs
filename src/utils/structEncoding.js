import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { getStructReference } from './structReferences.js'
import { ID, createID, writeID, writeNullID } from './ID.js'
import * as binary from 'lib0/binary.js'

export const writeStructToTransaction = (transaction, struct) => {
  transaction.encodedStructsLen++
  struct._toBinary(transaction.encodedStructs)
}

const structRefs = [
  ItemBinaryRef
]

/**
 * Read the next Item in a Decoder and fill this Item with the read data.
 *
 * This is called when data is received from a remote peer.
 *
 * @param {Y} y The Yjs instance that this Item belongs to.
 * @param {decoding.Decoder} decoder The decoder object to read data from.
 * @return {AbstractRef}
 *
 * @private
 */
export const read = decoder => {
  const info = decoding.readUint8(decoder)
  return new structRefs[binary.BITS5 & info](decoder, info)
}
