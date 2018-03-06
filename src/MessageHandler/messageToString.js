import BinaryDecoder from '../Util/Binary/Decoder.js'
import { stringifyStructs } from './integrateRemoteStructs.js'
import { stringifySyncStep1 } from './syncStep1.js'
import { stringifySyncStep2 } from './syncStep2.js'
import ID from '../Util/ID/ID.js'
import RootID from '../Util/ID/RootID.js'
import Y from '../Y.js'

export function messageToString ([y, buffer]) {
  let decoder = new BinaryDecoder(buffer)
  decoder.readVarString() // read roomname
  let type = decoder.readVarString()
  let strBuilder = []
  strBuilder.push('\n === ' + type + ' ===')
  if (type === 'update') {
    stringifyStructs(y, decoder, strBuilder)
  } else if (type === 'sync step 1') {
    stringifySyncStep1(y, decoder, strBuilder)
  } else if (type === 'sync step 2') {
    stringifySyncStep2(y, decoder, strBuilder)
  } else {
    strBuilder.push('-- Unknown message type - probably an encoding issue!!!')
  }
  return strBuilder.join('\n')
}

export function messageToRoomname (buffer) {
  let decoder = new BinaryDecoder(buffer)
  decoder.readVarString() // roomname
  return decoder.readVarString() // messageType
}

export function logID (id) {
  if (id !== null && id._id != null) {
    id = id._id
  }
  if (id === null) {
    return '()'
  } else if (id instanceof ID) {
    return `(${id.user},${id.clock})`
  } else if (id instanceof RootID) {
    return `(${id.name},${id.type})`
  } else if (id.constructor === Y) {
    return `y`
  } else {
    throw new Error('This is not a valid ID!')
  }
}
