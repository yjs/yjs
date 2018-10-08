/* eslint-env browser */
import * as idbactions from './idbactions.js'
import * as globals from './globals.js'
import * as message from './message.js'
import * as bc from './broadcastchannel.js'
import * as encoding from './encoding.js'
import * as logging from './logging.js'
import * as idb from './idb.js'
import Y from '../src/Y.js'

export class YdbClient {
  constructor (url, db) {
    this.url = url
    this.ws = new WebSocket(url)
    this.rooms = new Map()
    this.db = db
    this.connected = false
    initWS(this, this.ws)
  }
  /**
   * Open a Yjs instance that connects to `roomname`.
   * @param {string} roomname
   * @return {Y}
   */
  getY (roomname) {
    const y = new Y(roomname)
    y.on('afterTransaction', function () {
      debugger
    })
    return y
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
      const subs = []
      metas.forEach(meta => {
        subs.push({
          room: meta.room,
          offset: meta.offset
        })
      })
      us.forEach(room => {
        subs.push({
          room, offset: 0
        })
      })
      ydb.connected = true
      const encoder = encoding.createEncoder()
      encoding.writeArrayBuffer(encoder, message.createSub(subs))
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
export const send = (ydb, m) => ydb.connected && ydb.ws.send(m)

/**
 * @param {YdbClient} ydb
 * @param {string} room
 * @param {ArrayBuffer} update
 */
export const update = (ydb, room, update) => {
  bc.publish(room, update)
  const t = idbactions.createTransaction(ydb.db)
  logging.log(`Write Unconfirmed Update. room "${room}", ${JSON.stringify(update)}`)
  return idbactions.writeClientUnconfirmed(t, room, update).then(clientConf => {
    logging.log(`Send Unconfirmed Update. connected ${ydb.connected} room "${room}", clientConf ${clientConf}, ${logging.arrayBufferToString(update)}`)
    send(ydb, message.createUpdate(room, update, clientConf))
  })
}

export const subscribe = (ydb, room, f) => {
  bc.subscribe(room, f)
  const t = idbactions.createTransaction(ydb.db)
  idbactions.getRoomData(t, room).then(data => {
    if (data.byteLength > 0) {
      f(data)
    }
  })
  idbactions.getRoomMeta(t, room).then(meta => {
    if (meta === undefined) {
      logging.log(`Send Subscribe. room "${room}", offset ${0}`)
      // TODO: maybe set prelim meta value so we don't sub twice
      send(ydb, message.createSub([{ room, offset: 0 }]))
      idbactions.writeUnconfirmedSubscription(t, room)
    }
  })
}
