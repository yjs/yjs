
import { writeStructs } from './syncStep1.js'
import { integrateRemoteStructs } from './integrateRemoteStructs.js'
import { readDeleteSet, writeDeleteSet } from './deleteSet.js'
import BinaryEncoder from '../Binary/Encoder.js'

/**
 * Read the Decoder and fill the Yjs instance with data in the decoder.
 *
 * @param {Y} y The Yjs instance
 * @param {BinaryDecoder} decoder The BinaryDecoder to read from.
 */
export function fromBinary (y, decoder) {
  y.transact(function () {
    integrateRemoteStructs(y, decoder)
    readDeleteSet(y, decoder)
  })
}

/**
 * Encode the Yjs model to binary format.
 *
 * @param {Y} y The Yjs instance
 * @return {BinaryEncoder} The encoder instance that can be transformed
 *                         to ArrayBuffer or Buffer.
 */
export function toBinary (y) {
  let encoder = new BinaryEncoder()
  writeStructs(y, encoder, new Map())
  writeDeleteSet(y, encoder)
  return encoder
}
