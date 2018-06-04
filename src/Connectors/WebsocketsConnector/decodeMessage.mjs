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
export function messageSS (roomName, y, encoder) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_SS)
  writeStateSet(y, encoder)
}

const CONTENT_STRUCTS_DSS = 2
export function messageStructsDSS (roomName, y, encoder, ss, updateCounter) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_STRUCTS_DSS)
  encoder.writeVarUint(updateCounter)
  const structsDS = new BinaryEncoder()
  writeStructs(y, structsDS, ss)
  writeDeleteSet(y, structsDS)
  encoder.writeVarUint(structsDS.length)
  encoder.writeBinaryEncoder(structsDS)
}

const CONTENT_STRUCTS = 5
export function messageStructs (roomName, y, encoder, structsBinaryEncoder, updateCounter) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_STRUCTS)
  encoder.writeVarUint(updateCounter)
  encoder.writeVarUint(structsBinaryEncoder.length)
  encoder.writeBinaryEncoder(structsBinaryEncoder)
}

const CONTENT_CHECK_COUNTER = 6
export function messageCheckUpdateCounter (roomName, encoder, updateCounter = 0) {
  encoder.writeVarString(roomName)
  encoder.writeVarUint(CONTENT_CHECK_COUNTER)
  encoder.writeVarUint(updateCounter)
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
export default function decodeMessage (connector, message, ws, isServer = false, persistence) {
  const decoder = new BinaryDecoder(message)
  const encoder = new BinaryEncoder()
  while (decoder.hasContent()) {
    const roomName = decoder.readVarString()
    const contentType = decoder.readVarUint()
    const room = connector.getRoom(roomName)
    const y = room.y
    switch (contentType) {
      case CONTENT_CHECK_COUNTER:
        const updateCounter = decoder.readVarUint()
        if (room.localUpdateCounter !== updateCounter) {
          messageGetSS(roomName, y, encoder)
        }
        connector.subscribe(roomName, ws)
        break
      case CONTENT_STRUCTS:
        console.log(`${roomName}: received update`)
        connector._mutualExclude(() => {
          const remoteUpdateCounter = decoder.readVarUint()
          persistence.setRemoteUpdateCounter(roomName, remoteUpdateCounter)
          const messageLen = decoder.readVarUint()
          if (y === null) {
            persistence._persistStructs(roomName, decoder.readArrayBuffer(messageLen))
          } else {
            y.transact(() => {
              integrateRemoteStructs(y, decoder)
            }, true)
          }
        })
        break
      case CONTENT_GET_SS:
        if (y !== null) {
          messageSS(roomName, y, encoder)
        } else {
          persistence._createYInstance(roomName).then(y => {
            const encoder = new BinaryEncoder()
            messageSS(roomName, y, encoder)
            connector.send(encoder, ws)
          })
        }
        break
      case CONTENT_SUBSCRIBE:
        connector.subscribe(roomName, ws)
        break
      case CONTENT_SS:
        // received state set
        // reply with missing content
        const ss = readStateSet(decoder)
        const sendStructsDSS = () => {
          if (y !== null) { // TODO: how to sync local content?
            const encoder = new BinaryEncoder()
            messageStructsDSS(roomName, y, encoder, ss, room.localUpdateCounter) // room.localUpdateHandler in case it changes
            if (isServer) {
              messageSS(roomName, y, encoder)
            }
            connector.send(encoder, ws)
          }
        }
        if (room.persistenceLoaded !== undefined) {
          room.persistenceLoaded.then(sendStructsDSS)
        } else {
          sendStructsDSS()
        }
        break
      case CONTENT_STRUCTS_DSS:
        console.log(`${roomName}: synced`)
        connector._mutualExclude(() => {
          const remoteUpdateCounter = decoder.readVarUint()
          persistence.setRemoteUpdateCounter(roomName, remoteUpdateCounter)
          const messageLen = decoder.readVarUint()
          if (y === null) {
            persistence._persistStructsDS(roomName, decoder.readArrayBuffer(messageLen))
          } else {
            y.transact(() => {
              integrateRemoteStructs(y, decoder)
              readDeleteSet(y, decoder)
            }, true)
          }
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
