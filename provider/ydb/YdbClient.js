/**
 * @module provider/ydb
 */

/* eslint-env browser */
import * as idbactions from './idbactions.js'
import * as globals from '../../lib/globals.js'
import * as message from './message.js'
import * as bc from './broadcastchannel.js'
import * as encoding from '../../lib/encoding.js'
import * as logging from '../../lib/logging.js'
import * as idb from '../../lib/idb.js'
import * as decoding from '../../lib/decoding.js'
import { Y } from '../../utils/Y.js'
import { integrateRemoteStruct } from '../MessageHandler/integrateRemoteStructs.js'
import { createMutualExclude } from '../../lib/mutualExclude.js'

import * as NamedEventHandler from './NamedEventHandler.js'

/**
 * @typedef RoomState
 * @type {Object}
 * @property {number} rsid room session id, -1 if unknown (created locally)
 * @property {number} offset By server, -1 if unknown
 * @property {number} cOffset current offset by client
 */

/**
 * @typedef SyncState
 * @type {Object}
 * @property {boolean} upsynced True if all local updates have been sent to the server and the server confirmed that it received the update
 * @property {boolean} downsynced True if the current session subscribed to the room, the server confirmed the subscription, and the initial data was received
 * @property {boolean} persisted True if the server confirmed that it persisted all published data
 */

/**
 *
 */
export class YdbClient extends NamedEventHandler.Class {
  constructor (url, db) {
    super()
    this.url = url
    this.ws = new WebSocket(url)
    this.rooms = globals.createMap()
    this.db = db
    this.connected = false
    /**
     * Set of room states. We try to keep it up in sync with idb, but this may fail due to concurrency with other windows.
     * TODO: implement tests for this
     * @type Map<string, RoomState>
     */
    this.roomStates = globals.createMap()
    /**
     * Meta information about unconfirmed updates created by this client.
     * Maps from confid to roomname
     * @type Map<number, string>
     */
    this.clientUnconfirmedStates = globals.createMap()
    bc.subscribeYdbEvents(this)
    initWS(this, this.ws)
  }
  /**
   * Open a Yjs instance that connects to `roomname`.
   * @param {string} roomname
   * @return {Y}
   */
  getY (roomname) {
    const y = new Y(roomname)
    const mutex = createMutualExclude()
    y.on('afterTransaction', (y, transaction) => mutex(() => {
      if (transaction.encodedStructsLen > 0) {
        update(this, roomname, transaction.encodedStructs.createBuffer())
      }
    }))
    subscribe(this, roomname, update => mutex(() => {
      y.transact(() => {
        const decoder = decoding.createDecoder(update)
        while (decoding.hasContent(decoder)) {
          integrateRemoteStruct(y, decoder)
        }
      }, true)
    }))
    return y
  }
  getRoomState (roomname) {
    return bc.computeRoomState(this, bc.getUnconfirmedRooms(this), roomname)
  }
  getRoomStates () {
    const unconfirmedRooms = bc.getUnconfirmedRooms(this)
    const states = globals.createMap()
    this.roomStates.forEach((rstate, roomname) => states.set(roomname, bc.computeRoomState(this, unconfirmedRooms, roomname)))
    return states
  }
}

/**
 * Initialize WebSocket connection. Try to reconnect on error/disconnect.
 * @param {YdbClient} ydb
 * @param {WebSocket} ws
 */
const initWS = (ydb, ws) => {
  ws.binaryType = 'arraybuffer'
  ws.onclose = () => {
    ydb.connected = false
    logging.log('Disconnected from ydb. Reconnecting..')
    ydb.ws = new WebSocket(ydb.url)
    initWS(ydb, ws)
  }
  ws.onopen = () => {
    const t = idbactions.createTransaction(ydb.db)
    globals.pall([idbactions.getRoomMetas(t), idbactions.getUnconfirmedSubscriptions(t), idbactions.getUnconfirmedUpdates(t)]).then(([metas, us, unconfirmedUpdates]) => {
      let subs = []
      metas.forEach(meta => {
        subs.push({
          room: meta.room,
          offset: meta.offset,
          rsid: meta.rsid
        })
      })
      us.forEach(room => {
        subs.push({
          room, offset: 0, rsid: 0
        })
      })
      subs = subs.filter(subdev => !ydb.roomStates.has(subdev.room)) // filter already subbed rooms
      ydb.connected = true
      const encoder = encoding.createEncoder()
      if (subs.length > 0) {
        encoding.writeArrayBuffer(encoder, message.createSub(subs))
        bc._broadcastYdbSyncingRoomsToServer(subs.map(subdev => subdev.room))
      }
      encoding.writeArrayBuffer(encoder, unconfirmedUpdates)
      send(ydb, encoding.toBuffer(encoder))
    })
  }
  ws.onmessage = event => message.readMessage(ydb, event.data)
}

// maps from dbNamespace to db
const dbPromises = new Map()

/**
 * Factory function. Get a ydb instance that connects to url, and uses dbNamespace as indexeddb namespace.
 * Create if it does not exist yet.
 *
 * @param {string} url
 * @param {string} dbNamespace
 * @return {Promise<YdbClient>}
 */
export const get = (url, dbNamespace = 'ydb') => {
  if (!dbPromises.has(dbNamespace)) {
    dbPromises.set(dbNamespace, idbactions.openDB(dbNamespace))
  }
  return dbPromises.get(dbNamespace).then(db => globals.presolve(new YdbClient(url, db)))
}

/**
 * Remove a db namespace. Call this to remove any persisted data. Make sure to close active sessions.
 * TODO: destroy active ydbClient sessions / throw if a session is still active
 * @param {string} dbNamespace
 * @return {Promise}
 */
export const clear = (dbNamespace = 'ydb') => idb.deleteDB(dbNamespace)

/**
 * @param {YdbClient} ydb
 * @param {ArrayBuffer} m
 */
export const send = (ydb, m) => ydb.connected && m.byteLength !== 0 && ydb.ws.send(m)

/**
 * @param {YdbClient} ydb
 * @param {string} room
 * @param {ArrayBuffer} update
 */
export const update = (ydb, room, update) => {
  bc.publishRoomData(room, update)
  const t = idbactions.createTransaction(ydb.db)
  logging.log(`Write Unconfirmed Update. room "${room}", ${JSON.stringify(update)}`)
  return idbactions.writeClientUnconfirmed(t, room, update).then(clientConf => {
    logging.log(`Send Unconfirmed Update. connected ${ydb.connected} room "${room}", clientConf ${clientConf}`)
    bc._broadcastYdbCUConfCreated(clientConf, room)
    send(ydb, message.createUpdate(room, update, clientConf))
  })
}

export const subscribe = (ydb, room, f) => {
  bc.subscribeRoomData(room, f)
  const t = idbactions.createTransaction(ydb.db)
  if (!ydb.roomStates.has(room)) {
    subscribeRooms(ydb, [room])
  }
  idbactions.getRoomData(t, room).then(data => {
    if (data.byteLength > 0) {
      f(data)
    }
  })
}

export const subscribeRooms = (ydb, rooms) => {
  const t = idbactions.createTransaction(ydb.db)
  let subs = []
  // TODO: try not to do too many single calls. Implement getRoomMetas(t, rooms) or retrieve all metas once and store them on ydb
  // TODO: find out performance of getRoomMetas with all metas
  return globals.pall(rooms.map(room => idbactions.getRoomMeta(t, room).then(meta => {
    if (meta === undefined) {
      subs.push(room)
      return idbactions.writeUnconfirmedSubscription(t, room)
    }
  }))).then(() => {
    subs = subs.filter(room => !ydb.roomStates.has(room))
    // write all sub messages when all unconfirmed subs are writted to idb
    if (subs.length > 0) {
      send(ydb, message.createSub(subs.map(room => ({room, offset: 0, rsid: 0}))))
      bc._broadcastYdbSyncingRoomsToServer(subs)
    }
  })
}
