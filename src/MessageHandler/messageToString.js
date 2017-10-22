import BinaryDecoder from '../Binary/Decoder.js'
import { stringifyStructs } from './integrateRemoteStructs.js'
import { stringifySyncStep1 } from './syncStep1.js'
import { stringifySyncStep2 } from './syncStep2.js'

export function messageToString ([y, buffer]) {
  let decoder = new BinaryDecoder(buffer)
  decoder.readVarString() // read roomname
  let type = decoder.readVarString()
  let strBuilder = []
  strBuilder.push('\n === ' + type + ' ===\n')
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
