import * as encoding from './encoding.js'
import * as decoding from './decoding.js'
import * as idbactions from './idbactions.js'
import * as logging from './logging.js'
import * as bc from './broadcastchannel.js'

/* make sure to update message.go in ydb when updating these values.. */
export const MESSAGE_UPDATE = 0 // TODO: rename host_unconfirmed?
export const MESSAGE_SUB = 1
export const MESSAGE_CONFIRMATION = 2
export const MESSAGE_SUB_CONF = 3
export const MESSAGE_HOST_UNCONFIRMED_BY_CLIENT = 4
export const MESSAGE_CONFIRMED_BY_HOST = 5

/**
 * @param {any} ydb YdbClient instance
 * @param {ArrayBuffer} message
 */
export const readMessage = (ydb, message) => {
  const t = idbactions.createTransaction(ydb.db)
  const decoder = decoding.createDecoder(message)
  while (decoding.hasContent(decoder)) {
    switch (decoding.readVarUint(decoder)) {
      case MESSAGE_UPDATE: {
        const offset = decoding.readVarUint(decoder)
        const room = decoding.readVarString(decoder)
        const update = decoding.readPayload(decoder)
        logging.log(`Received Update. room "${room}", offset ${offset}, ${logging.arrayBufferToString(update)}`)
        idbactions.writeHostUnconfirmed(t, room, offset, update)
        bc.publish(room, update)
        break
      }
      case MESSAGE_SUB_CONF: {
        const nSubs = decoding.readVarUint(decoder)
        for (let i = 0; i < nSubs; i++) {
          const room = decoding.readVarString(decoder)
          const offset = decoding.readVarUint(decoder)
          const roomsid = decoding.readVarUint(decoder) // TODO: SID
          logging.log(`Received Sub Conf. room "${room}", offset ${offset}, roomsid ${roomsid}`)
          idbactions.confirmSubscription(t, room, roomsid, offset)
        }
        break
      }
      case MESSAGE_CONFIRMATION: {
        const room = decoding.readVarString(decoder)
        const offset = decoding.readVarUint(decoder)
        logging.log(`Received Confirmation. room "${room}", offset ${offset}`)
        idbactions.writeConfirmedByHost(t, room, offset)
        break
      }
      case MESSAGE_HOST_UNCONFIRMED_BY_CLIENT: {
        const clientConf = decoding.readVarUint(decoder)
        const offset = decoding.readVarUint(decoder)
        logging.log(`Received HostUnconfirmedByClient. clientConf "${clientConf}", offset ${offset}`)
        idbactions.writeHostUnconfirmedByClient(t, clientConf, offset)
        break
      }
      case MESSAGE_CONFIRMED_BY_HOST: {
        const room = decoding.readVarString(decoder)
        const offset = decoding.readVarUint(decoder)
        logging.log(`Received Confirmation By Host. room "${room}", offset ${offset}`)
        idbactions.writeConfirmedByHost(t, room, offset)
        break
      }
      default:
        logging.fail(`Unexpected message type`)
    }
  }
}

/**
 * @param {string} room
 * @param {ArrayBuffer} update
 * @param {number} clientConf
 * @return {ArrayBuffer}
 */
export const createUpdate = (room, update, clientConf) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MESSAGE_UPDATE)
  encoding.writeVarUint(encoder, clientConf)
  encoding.writeVarString(encoder, room)
  encoding.writePayload(encoder, update)
  return encoding.toBuffer(encoder)
}

/**
 * @typedef SubDef
 * @type {Object}
 * @property {string} room
 * @property {number} offset
 */

/**
 * @param {Array<SubDef>} rooms
 * @return {ArrayBuffer}
 */
export const createSub = rooms => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MESSAGE_SUB)
  encoding.writeVarUint(encoder, rooms.length)
  for (let i = 0; i < rooms.length; i++) {
    encoding.writeVarString(encoder, rooms[i].room)
    encoding.writeVarUint(encoder, rooms[i].offset)
  }
  return encoding.toBuffer(encoder)
}
