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

/**
 * @typedef {Map<number, number>} StateSet
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
 * Stringifies a message-encoded Delete Set.
 *
 * @param {decoding.Decoder} decoder
 * @return {string}
 */
export const stringifyDeleteSet = (decoder) => {
  let str = ''
  const dsLength = decoding.readUint32(decoder)
  for (let i = 0; i < dsLength; i++) {
    str += ' -' + decoding.readVarUint(decoder) + ':\n' // decodes user
    const dvLength = decoding.readUint32(decoder)
    for (let j = 0; j < dvLength; j++) {
      str += `clock: ${decoding.readVarUint(decoder)}, length: ${decoding.readVarUint(decoder)}, gc: ${decoding.readUint8(decoder) === 1}\n`
    }
  }
  return str
}

/**
 * Write the DeleteSet of a shared document to an Encoder.
 *
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 */
export const writeDeleteSet = (encoder, y) => {
  let currentUser = null
  let currentLength
  let lastLenPos
  let numberOfUsers = 0
  const laterDSLenPus = encoding.length(encoder)
  encoding.writeUint32(encoder, 0)
  y.ds.iterate(null, null, n => {
    const user = n._id.user
    const clock = n._id.clock
    const len = n.len
    const gc = n.gc
    if (currentUser !== user) {
      numberOfUsers++
      // a new user was foundimport { StateSet } from '../Store/StateStore.js' // eslint-disable-line

      if (currentUser !== null) { // happens on first iteration
        encoding.setUint32(encoder, lastLenPos, currentLength)
      }
      currentUser = user
      encoding.writeVarUint(encoder, user)
      // pseudo-fill pos
      lastLenPos = encoding.length(encoder)
      encoding.writeUint32(encoder, 0)
      currentLength = 0
    }
    encoding.writeVarUint(encoder, clock)
    encoding.writeVarUint(encoder, len)
    encoding.writeUint8(encoder, gc ? 1 : 0)
    currentLength++
  })
  if (currentUser !== null) { // happens on first iteration
    encoding.setUint32(encoder, lastLenPos, currentLength)
  }
  encoding.setUint32(encoder, laterDSLenPus, numberOfUsers)
}

/**
 * Read delete set from Decoder and apply it to a shared document.
 *
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const readDeleteSet = (decoder, y) => {
  const dsLength = decoding.readUint32(decoder)
  for (let i = 0; i < dsLength; i++) {
    const user = decoding.readVarUint(decoder)
    const dv = []
    const dvLength = decoding.readUint32(decoder)
    for (let j = 0; j < dvLength; j++) {
      const from = decoding.readVarUint(decoder)
      const len = decoding.readVarUint(decoder)
      const gc = decoding.readUint8(decoder) === 1
      dv.push({from, len, gc})
    }
    if (dvLength > 0) {
      const deletions = []
      let pos = 0
      let d = dv[pos]
      y.ds.iterate(ID.createID(user, 0), ID.createID(user, Number.MAX_VALUE), n => {
        // cases:
        // 1. d deletes something to the right of n
        //  => go to next n (break)
        // 2. d deletes something to the left of n
        //  => create deletions
        //  => reset d accordingly
        //  *)=> if d doesn't delete anything anymore, go to next d (continue)
        // 3. not 2) and d deletes something that also n deletes
        //  => reset d so that it doesn't contain n's deletion
        //  *)=> if d does not delete anything anymore, go to next d (continue)
        while (d != null) {
          var diff = 0 // describe the diff of length in 1) and 2)
          if (n._id.clock + n.len <= d.from) {
            // 1)
            break
          } else if (d.from < n._id.clock) {
            // 2)
            // delete maximum the len of d
            // else delete as much as possible
            diff = Math.min(n._id.clock - d.from, d.len)
            // deleteItemRange(y, user, d.from, diff, true)
            deletions.push([user, d.from, diff])
          } else {
            // 3)
            diff = n._id.clock + n.len - d.from // never null (see 1)
            if (d.gc && !n.gc) {
              // d marks as gc'd but n does not
              // then delete either way
              // deleteItemRange(y, user, d.from, Math.min(diff, d.len), true)
              deletions.push([user, d.from, Math.min(diff, d.len)])
            }
          }
          if (d.len <= diff) {
            // d doesn't delete anything anymore
            d = dv[++pos]
          } else {
            d.from = d.from + diff // reset pos
            d.len = d.len - diff // reset length
          }
        }
      })
      // TODO: It would be more performant to apply the deletes in the above loop
      // Adapt the Tree implementation to support delete while iterating
      for (let i = deletions.length - 1; i >= 0; i--) {
        const del = deletions[i]
        deleteItemRange(y, del[0], del[1], del[2], true)
      }
      // for the rest.. just apply it
      for (; pos < dv.length; pos++) {
        d = dv[pos]
        deleteItemRange(y, user, d.from, d.len, true)
        // deletions.push([user, d.from, d.len, d.gc)
      }
    }
  }
}

/**
 * Read a StateSet from Decoder and return it as string.
 *
 * @param {decoding.Decoder} decoder
 * @return {string}
 */
export const stringifyStateSet = decoder => {
  let s = 'State Set: '
  readStateSet(decoder).forEach((clock, user) => {
    s += `(${user}: ${clock}), `
  })
  return s
}

/**
 * Write StateSet to Encoder
 *
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 */
export const writeStateSet = (encoder, y) => {
  const state = y.ss.state
  // write as fixed-size number to stay consistent with the other encode functions.
  // => anytime we write the number of objects that follow, encode as fixed-size number.
  encoding.writeUint32(encoder, state.size)
  state.forEach((clock, user) => {
    encoding.writeVarUint(encoder, user)
    encoding.writeVarUint(encoder, clock)
  })
}

/**
 * Read StateSet from Decoder and return as Map
 *
 * @param {decoding.Decoder} decoder
 * @return {StateSet}
 */
export const readStateSet = decoder => {
  const ss = new Map()
  const ssLength = decoding.readUint32(decoder)
  for (let i = 0; i < ssLength; i++) {
    const user = decoding.readVarUint(decoder)
    const clock = decoding.readVarUint(decoder)
    ss.set(user, clock)
  }
  return ss
}

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
 * @param {StateSet} ss State Set received from a remote client. Maps from client id to number of created operations by client id.
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
  writeStateSet(encoder, y)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 * @param {Map<number, number>} ss
 */
export const writeSyncStep2 = (encoder, y, ss) => {
  encoding.writeVarUint(encoder, messageYjsSyncStep2)
  writeStructs(encoder, y, ss)
  writeDeleteSet(encoder, y)
}

/**
 * Read SyncStep1 message and reply with SyncStep2.
 *
 * @param {decoding.Decoder} decoder The reply to the received message
 * @param {encoding.Encoder} encoder The received message
 * @param {Y} y
 */
export const readSyncStep1 = (decoder, encoder, y) =>
  writeSyncStep2(encoder, y, readStateSet(decoder))

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
  str += stringifyDeleteSet(decoder)
  return str
}

/**
 * Read and apply Structs and then DeleteSet to a y instance.
 *
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const readSyncStep2 = (decoder, y) => {
  readStructs(decoder, y)
  readDeleteSet(decoder, y)
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
