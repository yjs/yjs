/**
 * @module provider/ydb
 */

/* eslint-env browser */

import * as decoding from '../../lib/decoding.js'
import * as encoding from '../../lib/encoding.js'
import * as globals from '../../lib/globals.js'
import * as NamedEventHandler from './NamedEventHandler.js'

const bc = new BroadcastChannel('ydb-client')

/**
 * @type {Map<string, Set<Function>>}
 */
const datasubs = globals.createMap()
/**
 * Set of Ydb instances
 * @type {Set<any>}
 */
const ydbinstances = globals.createSet()

const bcRoomDataMessage = 0
const bcYdbCUConfCreated = 1
const bcYdbCUConfConfirmed = 2
const bcYdbRemoteOffsetReceived = 3
const bcYdbRemoteOffsetConfirmed = 4
const bcYdbSyncingRoomsToServer = 5
const bcYdbSyncFromServer = 6

export const getUnconfirmedRooms = ydb => {
  const unconfirmedRooms = globals.createSet()
  ydb.clientUnconfirmedStates.forEach(room => unconfirmedRooms.add(room))
  return unconfirmedRooms
}

export const computeRoomState = (ydb, unconfirmedRooms, room) => {
  // state is a RoomState, defined in YdbClient.js
  const state = ydb.roomStates.get(room)
  if (state === undefined) {
    return {
      upsynced: false,
      downsynced: false,
      persisted: false
    }
  }
  return {
    upsynced: !unconfirmedRooms.has(room),
    downsynced: state.offset >= 0 && state.coffset >= state.offset,
    persisted: state.coffset === state.offset && state.offset >= 0 && !unconfirmedRooms.has(room)
  }
}

let roomStatesUpdating = []
const fireRoomStateUpdate = (ydb, room) => {
  roomStatesUpdating.push(room)
  if (roomStatesUpdating.length === 1) {
    // first time this is called, trigger actual publisher
    // setTimeout(() => {
    const updated = new Map()
    const unconfirmedRooms = getUnconfirmedRooms(ydb)
    roomStatesUpdating.forEach(room => {
      if (!updated.has(room)) {
        updated.set(room, computeRoomState(ydb, unconfirmedRooms, room))
      }
    })
    NamedEventHandler.fire(ydb, 'syncstate', {
      updated
    })
    roomStatesUpdating = []
    // }, 0)
  }
}

const receiveBCData = data => {
  const decoder = decoding.createDecoder(data)
  while (decoding.hasContent(decoder)) {
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case bcRoomDataMessage: {
        const room = decoding.readVarString(decoder)
        const update = decoding.readTail(decoder)
        const rsubs = datasubs.get(room)
        if (rsubs !== undefined) {
          rsubs.forEach(f => f(update))
        }
        break
      }
      case bcYdbCUConfCreated: {
        const confid = decoding.readVarUint(decoder)
        const room = decoding.readVarString(decoder)
        ydbinstances.forEach(ydb => {
          ydb.clientUnconfirmedStates.set(confid, room)
          fireRoomStateUpdate(ydb, room)
        })
        break
      }
      case bcYdbCUConfConfirmed: {
        const confid = decoding.readVarUint(decoder)
        const offset = decoding.readVarUint(decoder)
        ydbinstances.forEach(ydb => {
          const room = ydb.clientUnconfirmedStates.get(confid)
          if (room !== undefined) {
            ydb.clientUnconfirmedStates.delete(confid)
            const state = ydb.roomStates.get(room)
            if (state.coffset < offset) {
              state.coffset = offset
            }
            fireRoomStateUpdate(ydb, room)
          }
        })
        break
      }
      case bcYdbRemoteOffsetReceived: {
        const len = decoding.readVarUint(decoder)
        for (let i = 0; i < len; i++) {
          const room = decoding.readVarString(decoder)
          const offset = decoding.readVarUint(decoder)
          ydbinstances.forEach(ydb => {
            // this is only called when an update is received
            // so roomState.get(room) should exist
            const state = ydb.roomStates.get(room)
            if (state.coffset < offset) {
              state.coffset = offset
            }
            fireRoomStateUpdate(ydb, room)
          })
        }
        break
      }
      case bcYdbRemoteOffsetConfirmed: {
        const len = decoding.readVarUint(decoder)
        for (let i = 0; i < len; i++) {
          const room = decoding.readVarString(decoder)
          const offset = decoding.readVarUint(decoder)
          ydbinstances.forEach(ydb => {
            const state = ydb.roomStates.get(room)
            state.offset = offset
            fireRoomStateUpdate(ydb, room)
          })
        }
        break
      }
      case bcYdbSyncingRoomsToServer: {
        const len = decoding.readVarUint(decoder)
        for (let i = 0; i < len; i++) {
          const room = decoding.readVarString(decoder)
          ydbinstances.forEach(ydb => {
            const state = ydb.roomStates.get(room)
            if (state === undefined) {
              ydb.roomStates.set(room, {
                rsid: -1,
                offset: -1,
                coffset: 0
              })
              fireRoomStateUpdate(ydb, room)
            }
          })
        }
        break
      }
      case bcYdbSyncFromServer: {
        const len = decoding.readVarUint(decoder)
        for (let i = 0; i < len; i++) {
          const room = decoding.readVarString(decoder)
          const offset = decoding.readVarUint(decoder)
          const rsid = decoding.readVarUint(decoder)
          ydbinstances.forEach(ydb => {
            const state = ydb.roomStates.get(room)
            state.offset = offset
            state.rsid = rsid
            fireRoomStateUpdate(ydb, room)
          })
        }
        break
      }
      default:
        globals.error('Unexpected bc message type')
    }
  }
}

bc.onmessage = event => receiveBCData(event.data)

/**
 * Publish to all, including self
 * @param {encoding.Encoder} encoder
 */
export const publishAll = encoder => {
  const buffer = encoding.toBuffer(encoder)
  bc.postMessage(buffer)
  receiveBCData(buffer)
}

/**
 * Call this when update was created by this user and confid was created
 * @param {number} cconf
 * @param {string} roomname
 */
export const _broadcastYdbCUConfCreated = (cconf, roomname) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, bcYdbCUConfCreated)
  encoding.writeVarUint(encoder, cconf)
  encoding.writeVarString(encoder, roomname)
  publishAll(encoder)
}

/**
 * Call this when user confid was confirmed by host
 * @param {number} cconf
 * @param {number} offset The conf-offset of the client-created offset
 */
export const _broadcastYdbCUConfConfirmed = (cconf, offset) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, bcYdbCUConfConfirmed)
  encoding.writeVarUint(encoder, cconf)
  encoding.writeVarUint(encoder, offset)
  publishAll(encoder)
}

/**
 * Call this when remote update is received (thus host has increased, but not confirmed, the offset)
 * @param {Array<Object>} subs sub is { room, offset }
 */
export const _broadcastYdbRemoteOffsetReceived = subs => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, bcYdbRemoteOffsetReceived)
  encoding.writeVarUint(encoder, subs.length)
  subs.forEach(sub => {
    encoding.writeVarString(encoder, sub.room)
    encoding.writeVarUint(encoder, sub.offset)
  })
  publishAll(encoder)
}

/**
 * @param {Array<Object>} subs sub is { room, offset }
 */
export const _broadcastYdbRemoteOffsetConfirmed = subs => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, bcYdbRemoteOffsetConfirmed)
  encoding.writeVarUint(encoder, subs.length)
  subs.forEach(sub => {
    encoding.writeVarString(encoder, sub.room)
    encoding.writeVarUint(encoder, sub.offset)
  })
  publishAll(encoder)
}

/**
 * Call this when a subscription is created
 * @param {Array<string>} rooms
 */
export const _broadcastYdbSyncingRoomsToServer = rooms => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, bcYdbSyncingRoomsToServer)
  encoding.writeVarUint(encoder, rooms.length)
  rooms.forEach(room => {
    encoding.writeVarString(encoder, room)
  })
  publishAll(encoder)
}

/**
 * Call this when sync confirmed by host
 * @param {Array<Object>} subs sub is {room, offset, rsid}
 */
export const _broadcastYdbSyncFromServer = subs => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, bcYdbSyncFromServer)
  encoding.writeVarUint(encoder, subs.length)
  subs.forEach(sub => {
    encoding.writeVarString(encoder, sub.room)
    encoding.writeVarUint(encoder, sub.offset)
    encoding.writeVarUint(encoder, sub.rsid)
  })
  publishAll(encoder)
}

/**
 * @param {string} room
 * @param {Function} f
 */
export const subscribeRoomData = (room, f) => {
  let rsubs = datasubs.get(room)
  if (rsubs === undefined) {
    rsubs = new Set()
    datasubs.set(room, rsubs)
  }
  rsubs.add(f)
}

/**
 * @param {string} room
 * @param {ArrayBuffer} update
 */
export const publishRoomData = (room, update) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarString(encoder, room)
  encoding.writeArrayBuffer(encoder, update)
  bc.postMessage(encoding.toBuffer(encoder))
  // call subs directly here instead of calling receivedBCData
  const rsubs = datasubs.get(room)
  if (rsubs !== undefined) {
    rsubs.forEach(f => f(update))
  }
}

export const subscribeYdbEvents = ydb =>
  ydbinstances.add(ydb)
