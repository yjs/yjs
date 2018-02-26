import { writeStructs } from './syncStep1.js'
import { integrateRemoteStructs } from './integrateRemoteStructs.js'
import { readDeleteSet, writeDeleteSet } from './deleteSet.js'
import BinaryEncoder from '../Binary/Encoder.js'

export function fromBinary (y, decoder) {
  y.transact(function () {
    integrateRemoteStructs(y, decoder)
    readDeleteSet(y, decoder)
  })
}

export function toBinary (y) {
  let encoder = new BinaryEncoder()
  writeStructs(y, encoder, new Map())
  writeDeleteSet(y, encoder)
  return encoder
}
