/**
 * @module sync-protocol
 */

import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import * as ID from '../utils/ID.js'
import { getStruct } from '../utils/structReferences.js'
import { deleteItemRange } from '../utils/structManipulation.js'
import { integrateRemoteStruct } from '../utils/integrateRemoteStructs.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import * as stringify from '../utils/structStringify.js'
import { readStateMap, writeStateMap } from '../utils/StateStore.js'
import { writeDeleteStore, readDeleteStore, stringifyDeleteStore } from '../utils/DeleteStore.js'

/**
 * @typedef {Map<number, number>} StateMap
 */

/**
 * Core Yjs only defines three message types:
 * • YjsSyncStep1: Includes the State Set of the sending client. When received, the client should reply with YjsSyncStep2.
 * • YjsSyncStep2: Includes all missing structs and the complete delete set. When received, the the client is assured that
 *   it received all information from the remote client.
 *
 * In a peer-to-peer network, you may want to introduce a SyncDone message type. Both parties should initiate the connection
 * with SyncStep1. When a client received SyncStep2, it should reply with SyncDone. When the local client received both
 * SyncStep2 and SyncDone, it is assured that it is synced to the remote client.
 *
 * In a client-server model, you want to handle this differently: The client should initiate the connection with SyncStep1.
 * When the server receives SyncStep1, it should reply with SyncStep2 immediately followed by SyncStep1. The client replies
 * with SyncStep2 when it receives SyncStep1. Optionally the server may send a SyncDone after it received SyncStep2, so the
 * client knows that the sync is finished.  There are two reasons for this more elaborated sync model: 1. This protocol can
 * easily be implemented on top of http and websockets. 2. The server shoul only reply to requests, and not initiate them.
 * Therefore it is necesarry that the client initiates the sync.
 *
 * Construction of a message:
 * [messageType : varUint, message definition..]
 *
 * Note: A message does not include information about the room name. This must to be handled by the upper layer protocol!
 *
 * stringify[messageType] stringifies a message definition (messageType is already read from the bufffer)
 */

export const messageYjsSyncStep1 = 0
export const messageYjsSyncStep2 = 1
export const messageYjsUpdate = 2

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 * @return {string}
 */
export const stringifyStructs = (decoder, y) => {
  let str = ''
  const len = decoding.readUint32(decoder)
  for (let i = 0; i < len; i++) {
    let reference = decoding.readVarUint(decoder)
    let Constr = getStruct(reference)
    let struct = new Constr()
    let missing = struct._fromBinary(y, decoder)
    let logMessage = '  ' + struct._logString()
    if (missing.length > 0) {
      logMessage += ' .. missing: ' + missing.map(stringify.stringifyItemID).join(', ')
    }
    str += logMessage + '\n'
  }
  return str
}

/**
 * Write all Items that are not not included in ss to
 * the encoder object.
 *
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 * @param {StateMap} ss State Set received from a remote client. Maps from client id to number of created operations by client id.
 */
export const writeStructs = (encoder, y, ss) => {
  const lenPos = encoding.length(encoder)
  encoding.writeUint32(encoder, 0)
  let len = 0
  for (let user of y.ss.state.keys()) {
    let clock = ss.get(user) || 0
    if (user !== ID.RootFakeUserID) {
      const minBound = ID.createID(user, clock)
      const overlappingLeft = y.os.findPrev(minBound)
      const rightID = overlappingLeft === null ? null : overlappingLeft._id
      if (rightID !== null && rightID.user === user && rightID.clock + overlappingLeft._length > clock) {
        // TODO: only write partial content (only missing content)
        // const struct = overlappingLeft._clonePartial(clock - rightID.clock)
        const struct = overlappingLeft
        struct._toBinary(encoder)
        len++
      }
      y.os.iterate(minBound, ID.createID(user, Number.MAX_VALUE), struct => {
        struct._toBinary(encoder)
        len++
      })
    }
  }
  encoding.setUint32(encoder, lenPos, len)
}

/**
 * Read structs and delete operations from decoder and apply them on a shared document.
 *
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const readStructs = (decoder, y) => {
  const len = decoding.readUint32(decoder)
  for (let i = 0; i < len; i++) {
    integrateRemoteStruct(decoder, y)
  }
}

/**
 * Read SyncStep1 and return it as a readable string.
 *
 * @param {decoding.Decoder} decoder
 * @return {string}
 */
export const stringifySyncStep1 = (decoder) => {
  let s = 'SyncStep1: '
  const len = decoding.readUint32(decoder)
  for (let i = 0; i < len; i++) {
    const user = decoding.readVarUint(decoder)
    const clock = decoding.readVarUint(decoder)
    s += `(${user}:${clock})`
  }
  return s
}

/**
 * Create a sync step 1 message based on the state of the current shared document.
 *
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 */
export const writeSyncStep1 = (encoder, y) => {
  encoding.writeVarUint(encoder, messageYjsSyncStep1)
  writeStateMap(encoder, y.ss.state)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 * @param {Map<number, number>} ss
 */
export const writeSyncStep2 = (encoder, y, ss) => {
  encoding.writeVarUint(encoder, messageYjsSyncStep2)
  writeStructs(encoder, y, ss)
  writeDeleteStore(encoder, y.ds)
}

/**
 * Read SyncStep1 message and reply with SyncStep2.
 *
 * @param {decoding.Decoder} decoder The reply to the received message
 * @param {encoding.Encoder} encoder The received message
 * @param {Y} y
 */
export const readSyncStep1 = (decoder, encoder, y) =>
  writeSyncStep2(encoder, y, readStateMap(decoder))

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 * @return {string}
 */
export const stringifySyncStep2 = (decoder, y) => {
  let str = '  == Sync step 2:\n'
  str += ' + Structs:\n'
  str += stringifyStructs(decoder, y)
  // write DS to string
  str += ' + Delete Set:\n'
  str += stringifyDeleteStore(decoder)
  return str
}

/**
 * Read and apply Structs and then DeleteStore to a y instance.
 *
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const readSyncStep2 = (decoder, y) => {
  readStructs(decoder, y)
  readDeleteStore(decoder, y)
}

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 * @return {string}
 */
export const stringifyUpdate = (decoder, y) =>
  '  == Update:\n' + stringifyStructs(decoder, y)

/**
 * @param {encoding.Encoder} encoder
 * @param {number} numOfStructs
 * @param {encoding.Encoder} updates
 */
export const writeUpdate = (encoder, numOfStructs, updates) => {
  encoding.writeVarUint(encoder, messageYjsUpdate)
  encoding.writeUint32(encoder, numOfStructs)
  encoding.writeBinaryEncoder(encoder, updates)
}

export const readUpdate = readStructs

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 * @return {string} The message converted to string
 */
export const stringifySyncMessage = (decoder, y) => {
  const messageType = decoding.readVarUint(decoder)
  let stringifiedMessage
  let stringifiedMessageType
  switch (messageType) {
    case messageYjsSyncStep1:
      stringifiedMessageType = 'YjsSyncStep1'
      stringifiedMessage = stringifySyncStep1(decoder)
      break
    case messageYjsSyncStep2:
      stringifiedMessageType = 'YjsSyncStep2'
      stringifiedMessage = stringifySyncStep2(decoder, y)
      break
    case messageYjsUpdate:
      stringifiedMessageType = 'YjsUpdate'
      stringifiedMessage = stringifyStructs(decoder, y)
      break
    default:
      stringifiedMessageType = 'Unknown'
      stringifiedMessage = 'Unknown'
  }
  return `Message ${stringifiedMessageType}:\n${stringifiedMessage}`
}

/**
 * @param {decoding.Decoder} decoder A message received from another client
 * @param {encoding.Encoder} encoder The reply message. Will not be sent if empty.
 * @param {Y} y
 */
export const readSyncMessage = (decoder, encoder, y) => {
  const messageType = decoding.readVarUint(decoder)
  switch (messageType) {
    case messageYjsSyncStep1:
      readSyncStep1(decoder, encoder, y)
      break
    case messageYjsSyncStep2:
      y.transact(() => readSyncStep2(decoder, y), true)
      break
    case messageYjsUpdate:
      y.transact(() => readUpdate(decoder, y), true)
      break
    default:
      throw new Error('Unknown message type')
  }
  return messageType
}
