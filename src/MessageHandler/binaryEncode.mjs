
import { writeStructs } from './syncStep1.mjs'
import { integrateRemoteStructs } from './integrateRemoteStructs.mjs'
import { readDeleteSet, writeDeleteSet } from './deleteSet.mjs'
import BinaryEncoder from '../Util/Binary/Encoder.mjs'

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
