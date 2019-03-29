import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { AbstractStruct, AbstractRef } from '../structs/AbstractStruct.js'
import { ID, createID, writeID, writeNullID } from './ID.js'
import * as binary from 'lib0/binary.js'
import { Transaction } from './Transaction.js'
import { findIndex } from './StructStore.js'

const structRefs = [
  ItemBinaryRef
]

/**
 * Read the next Item in a Decoder and fill this Item with the read data.
 *
 * This is called when data is received from a remote peer.
 *
 * @param {decoding.Decoder} decoder The decoder object to read data from.
 * @return {AbstractRef}
 *
 * @private
 */
export const read = decoder => {
  const info = decoding.readUint8(decoder)
  return new structRefs[binary.BITS5 & info](decoder, info)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {Transaction} transaction
 */
export const writeStructsFromTransaction = (encoder, transaction) => {
  const stateUpdates = transaction.stateUpdates
  const y = transaction.y
  encoding.writeVarUint(encoder, stateUpdates.size)
  stateUpdates.forEach((clock, client) => {
    /**
     * @type {Array<AbstractStruct>}
     */
    // @ts-ignore
    const structs = y.store.clients.get(client)
    for (let i = findIndex(structs, clock); i < structs.length; i++) {
      structs[i].write(encoder, 0)
    }
  })
}
