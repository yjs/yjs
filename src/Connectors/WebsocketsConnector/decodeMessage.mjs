import BinaryDecoder from '../../Util/Binary/Decoder.mjs'
import BinaryEncoder from '../../Util/Binary/Encoder.mjs'
import { readStateSet, writeStateSet } from '../../MessageHandler/stateSet.mjs'
import { writeStructs } from '../../MessageHandler/syncStep1.mjs'
import { writeDeleteSet, readDeleteSet } from '../../MessageHandler/deleteSet.mjs'
import { integrateRemoteStructs } from '../../MessageHandler/integrateRemoteStructs.mjs'

const CONTENT_GET_SS = 4
export function messageGetSS (roomName, y, encoder) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_GET_SS)
}

const CONTENT_SUBSCRIBE = 3
export function messageSubscribe (roomName, y, encoder) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_SUBSCRIBE)
}

const CONTENT_SS = 0
/**
 * Message the current state set. The other side must respond with CONTENT_STRUCTS_DSS
 */
export function messageSS (roomName, y, encoder) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_SS)
  writeStateSet(y, encoder)
}

const CONTENT_STRUCTS_DSS = 2
export function messageStructsDSS (roomName, y, encoder, ss) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_STRUCTS_DSS)
  writeStructs(y, encoder, ss)
  writeDeleteSet(y, encoder)
}

const CONTENT_STRUCTS = 5
export function messageStructs (roomName, y, encoder, structsBinaryEncoder) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_STRUCTS)
  encoder.writeBinaryEncoder(structsBinaryEncoder)
}

/**
 * Decodes a client-message.
 *
 * A client-message consists of multiple message-elements that are concatenated without delimiter.
 * Each has the following structure:
 * - roomName
 * - content_type
 * - content (additional info that is encoded based on the value of content_type)
 *
 * The message is encoded until no more message-elements are available.
 *
 * @param {*} connector The connector that handles the connections
 * @param {*} message The binary encoded message
 * @param {*} ws The connection object
 */
export default function decodeMessage (connector, message, ws) {
  const decoder = new BinaryDecoder(message)
  const encoder = new BinaryEncoder()
  while (decoder.hasContent()) {
    const roomName = decoder.readVarString()
    const contentType = decoder.readVarUint()
    const room = connector.getRoom(roomName)
    const y = room.y
    switch (contentType) {
      case CONTENT_STRUCTS:
        connector._mutualExclude(() => {
          y.transact(() => {
            integrateRemoteStructs(y, decoder)
          }, true)
        })
        break
      case CONTENT_GET_SS:
        messageSS(roomName, y, encoder)
        break
      case CONTENT_SUBSCRIBE:
        room.connections.add(ws)
        break
      case CONTENT_SS:
        // received state set
        // reply with missing content
        const ss = readStateSet(decoder)
        messageStructsDSS(roomName, y, encoder, ss)
        break
      case CONTENT_STRUCTS_DSS:
        connector._mutualExclude(() => {
          y.transact(() => {
            integrateRemoteStructs(y, decoder)
            readDeleteSet(y, decoder)
          }, true)
        })
        break
      default:
        console.error('Unexpected content type!')
        if (ws !== null) {
          ws.close() // TODO: specify reason
        }
    }
  }
  return encoder
}
