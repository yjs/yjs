/**
 * @module provider/ydb
 */

/* eslint-env browser */

/**
 * Naming conventions:
 * * ydb: Think of ydb as a federated set of servers. This is not yet true, but we will eventually get there. With this assumption come some challenges with the client
 * * ydb instance: A single ydb instance that this ydb-client connects to
 * * (room) host: Exactly one ydb instance controls a room at any time. The ownership may change over time. The host of a room is the ydb instance that owns it. This is not necessarily the instance we connect to.
 * * room session id: An random id that is assigned to a room. When the server dies unexpectedly, we can conclude which data is missing and send it to the server (or delete it and prevent duplicate content)
 * * update: An ArrayBuffer of binary data. Neither Ydb nor Ydb-client care about the content of update. Updates may be appended to each other.
 *
 * The database has four tables:
 *
 * CU "client-unconfirmed" confid -> room, update
 *   - The client writes to this table when it creates an update.
 *   - Then it sends an update to the host with the generated confid
 *   - In case the host doesn't confirm that it received this update, it is sent again on next sync
 * HU "host-unconfirmed" room, offset -> update
 *   - Updates from the host are written to this table
 *   - When host confirms that an unconfirmed update was persisted, the update is written to the Co table
 *   - When client sync to host and the room session ids don't match, all host-unconfirmed messages are sent to host
 * Co "confirmed":
 *   data:{room} -> update
 *     - this field holds confirmed room updates
 *   meta:{room} -> room session id, confirmed offset
 *     - this field holds metadata about the room
 * US "unconfirmed-subscriptions" room -> _
 *   - Subscriptions sent to the server, but didn't receive confirmation yet
 *   - Either a room is in US or in Co
 *   - A client may update a room when the room is in either US or Co
 */

import * as encoding from '../../lib/encoding.js'
import * as decoding from '../../lib/decoding.js'
import * as idb from '../../lib/idb.js'
import * as globals from '../../lib/globals.js'
import * as message from './message.js'

/**
 * Get 'client-unconfirmed' store from transaction
 * @param {IDBTransaction} t
 * @return {IDBObjectStore}
 */
const getStoreCU = t => idb.getStore(t, STORE_CU)
/**
 * Get 'host-unconfirmed' store from transaction
 * @param {IDBTransaction} t
 * @return {IDBObjectStore}
 */
const getStoreHU = t => idb.getStore(t, STORE_HU)
/**
 * Get 'confirmed' store from transaction
 * @param {IDBTransaction} t
 * @return {IDBObjectStore}
 */
const getStoreCo = t => idb.getStore(t, STORE_CO)

/**
 * Get `unconfirmed-subscriptions` store from transaction
 * @param {IDBTransaction} t
 * @return {IDBObjectStore}
 */
const getStoreUS = t => idb.getStore(t, STORE_US)

/**
 * @param {string} room
 * @param {number} offset
 * @return {HUTableKey}
 */
const encodeHUKey = (room, offset) => [room, offset]

/**
 * Array of length 2: [string, number]
 * @typedef HUTableKey
 * @type {any}
 */

/**
 * @typedef RoomAndOffset
 * @type {Object}
 * @property {string} room
 * @property {number} offset Received offsets (including offsets that are not yet confirmed)
 */

/**
 * @param {HUTableKey} key
 * @return {RoomAndOffset}
 */
const decodeHUKey = key => {
  return {
    room: key[0],
    offset: key[1]
  }
}

const getCoMetaKey = room => 'meta:' + room
const getCoDataKey = room => 'data:' + room

const STORE_CU = 'client-unconfirmed'
const STORE_US = 'unconfirmed-subscriptions'
const STORE_CO = 'confirmed'
const STORE_HU = 'host-unconfirmed'

/**
 * @param {string} dbNamespace
 * @return {Promise<IDBDatabase>}
 */
export const openDB = dbNamespace => idb.openDB(dbNamespace, db => idb.createStores(db, [
  [STORE_CU, { autoIncrement: true }],
  [STORE_HU],
  [STORE_CO],
  [STORE_US]
]))

export const deleteDB = name => idb.deleteDB(name)

/**
 * Create a new IDBTransaction accessing all object stores. Normally we should care that we can access object stores in parallel.
 * But this is not possible in ydb-client since at least two object stores are requested in every IDB change.
 * @param {IDBDatabase} db
 * @return {IDBTransaction}
 */
export const createTransaction = db => db.transaction([STORE_CU, STORE_HU, STORE_CO, STORE_US], 'readwrite')

/**
 * Write an update to the db after the client created it. This update is not yet received by the host.
 * This function returns a client confirmation number. The confirmation number must be send to the host so it can identify the update,
 * and we can move the update to HU when it is confirmed (@see writeHostUnconfirmedByClient)
 * @param {IDBTransaction} t
 * @param {String} room
 * @param {ArrayBuffer} update
 * @return {Promise<number>} client confirmation number
 */
export const writeClientUnconfirmed = (t, room, update) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarString(encoder, room)
  encoding.writeArrayBuffer(encoder, update)
  return idb.addAutoKey(getStoreCU(t), encoding.toBuffer(encoder))
}

/**
 * Get all updates that are not yet confirmed by host.
 * @param {IDBTransaction} t
 * @return {Promise<ArrayBuffer>} All update messages as a single ArrayBuffer
 */
export const getUnconfirmedUpdates = t => {
  const encoder = encoding.createEncoder()
  return idb.iterate(getStoreCU(t), null, (value, clientConf) => {
    const decoder = decoding.createDecoder(value)
    const room = decoding.readVarString(decoder)
    const update = decoding.readTail(decoder)
    encoding.writeArrayBuffer(encoder, message.createUpdate(room, update, clientConf))
  }).then(() => encoding.toBuffer(encoder))
}

/**
 * The host confirms that it received and persisted an update. The update can be safely removed from CU.
 * It is necessary to call this function in case that the client disconnected before the host could send `writeHostUnconfirmedByClient`.
 * @param {IDBTransaction} t
 * @param {number} clientConf
 * @return {Promise}
 */
export const confirmClient = (t, clientConf) => idb.del(getStoreCU(t), idb.createIDBKeyRangeUpperBound(clientConf, false))

/**
 * The host confirms that it received and broadcasted an update sent from this client.
 * Calling this method does not confirm that the update has been persisted by the server.
 *
 * Other clients will receive an update with `writeHostUnconfirmed`. Since this client created the update, it only receives a confirmation. So
 * we can simply move the update from CU to HU.
 *
 * @param {IDBTransaction} t
 * @param {number} clientConf The client confirmation number that identifies the update
 * @param {number} offset The offset with wich the server will store the information
 */
export const writeHostUnconfirmedByClient = (t, clientConf, offset) => idb.get(getStoreCU(t), clientConf).then(roomAndUpdate => {
  const decoder = decoding.createDecoder(roomAndUpdate)
  const room = decoding.readVarString(decoder)
  const update = decoding.readTail(decoder)
  return writeHostUnconfirmed(t, room, offset, update).then(() =>
    idb.del(getStoreCU(t), clientConf)
  )
})

/**
 * The host broadcasts an update created by another client. It assures that the update will eventually be persisted with
 * `offset`. Calling this function does not imply that the update was persisted by the host. In case of mismatching room session ids
 * the updates in HU will be sent to the server.
 *
 * @param {IDBTransaction} t
 * @param {String} room
 * @param {number} offset
 * @param {ArrayBuffer} update
 * @return {Promise}
 */
export const writeHostUnconfirmed = (t, room, offset, update) => idb.put(getStoreHU(t), update, encodeHUKey(room, offset))

/**
 * The host confirms that it persisted updates up until (including) offset. updates may be moved from HU to Co.
 *
 * @param {IDBTransaction} t
 * @param {String} room
 * @param {number} offset Inclusive range [0, offset - 1] has been stored to host
 */
export const writeConfirmedByHost = (t, room, offset) => {
  const co = getStoreCo(t)
  return globals.pall([idb.get(co, getCoDataKey(room)), idb.get(co, getCoMetaKey(room))]).then(async arr => {
    const data = arr[0]
    const meta = decodeMetaValue(arr[1])
    const dataEncoder = encoding.createEncoder()
    if (meta.offset >= offset) {
      return // nothing to do
    }
    encoding.writeArrayBuffer(dataEncoder, data)
    const hu = getStoreHU(t)
    const huKeyRange = idb.createIDBKeyRangeBound(encodeHUKey(room, 0), encodeHUKey(room, offset), false, false)
    return idb.iterate(hu, huKeyRange, (value, _key) => {
      const key = decodeHUKey(_key) // @kevin _key is an array. remove decodeHUKey functions
      if (key.room === room && key.offset <= offset) {
        encoding.writeArrayBuffer(dataEncoder, value)
      }
    }).then(() => {
      globals.pall([idb.put(co, encodeMetaValue(meta.rsid, offset), getCoMetaKey(room)), idb.put(co, encoding.toBuffer(dataEncoder), getCoDataKey(room)), idb.del(hu, huKeyRange)])
    })
  })
}

/**
 * @typedef RoomMeta
 * @type {Object}
 * @property {string} room
 * @property {number} rsid Room session id
 * @property {number} offset Received offsets (including offsets that are not yet confirmed)
 */

/**
 * Get all meta information for all rooms.
 *
 * @param {IDBTransaction} t
 * @return {Promise<Array<RoomMeta>>}
 */
export const getRoomMetas = t => {
  // const result = []
  const storeCo = getStoreCo(t)
  const coQuery = idb.createIDBKeyRangeLowerBound('meta:', false)
  return globals.pall([idb.getAll(storeCo, coQuery), idb.getAllKeys(storeCo, coQuery)]).then(([metaValues, metaKeys]) => globals.pall(metaValues.map((metavalue, i) => {
    const room = metaKeys[i].slice(5)
    const { rsid, offset } = decodeMetaValue(metavalue)
    return {
      room,
      rsid,
      offset: offset
    }
  })))
  /*
  return idb.iterate(getStoreCo(t), idb.createIDBKeyRangeLowerBound('meta:', false), (metavalue, metakey) =>
    idb.getAllKeys(hu, idb.createIDBKeyRangeBound(encodeHUKey(metakey.slice(5), 0), encodeHUKey(metakey.slice(5), 2 ** 32), false, false)).then(keys => {
      const { rsid, offset } = decodeMetaValue(metavalue)
      result.push({
        room: metakey.slice(5),
        rsid,
        offset: keys.reduce((cur, key) => math.max(decodeHUKey(key).offset, cur), offset)
      })
    })
  ).then(() => globals.presolve(result))
  */
}

export const getRoomMeta = (t, room) =>
  idb.get(getStoreCo(t), getCoMetaKey(room))

/**
 * Get all data from idb, excluding unconfirmed updates.
 * TODO: include updates in CU
 * @param {IDBTransaction} t
 * @param {string} room
 * @return {Promise<ArrayBuffer>}
 */
export const getRoomDataWithoutCU = (t, room) => globals.pall([idb.get(getStoreCo(t), 'data:' + room), idb.getAll(getStoreHU(t), idb.createIDBKeyRangeBound(encodeHUKey(room, 0), encodeHUKey(room, 2 ** 32), false, false))]).then(([data, updates]) => {
  const encoder = encoding.createEncoder()
  encoding.writeArrayBuffer(encoder, data || new Uint8Array(0))
  updates.forEach(update => encoding.writeArrayBuffer(encoder, update))
  return encoding.toBuffer(encoder)
})

/**
 * Get all data from idb, including unconfirmed updates.
 * TODO: include updates in CU
 * @param {IDBTransaction} t
 * @param {string} room
 * @return {Promise<ArrayBuffer>}
 */
export const getRoomData = (t, room) => globals.pall([idb.get(getStoreCo(t), 'data:' + room), idb.getAll(getStoreHU(t), idb.createIDBKeyRangeBound(encodeHUKey(room, 0), encodeHUKey(room, 2 ** 32), false, false)), idb.getAll(getStoreCU(t))]).then(([data, updates, cuUpdates]) => {
  const encoder = encoding.createEncoder()
  encoding.writeArrayBuffer(encoder, data || new Uint8Array(0))
  updates.forEach(update => encoding.writeArrayBuffer(encoder, update))
  cuUpdates.forEach(roomAndUpdate => {
    const decoder = decoding.createDecoder(roomAndUpdate)
    if (decoding.readVarString(decoder) === room) {
      encoding.writeArrayBuffer(encoder, decoding.readTail(decoder))
    }
  })
  return encoding.toBuffer(encoder)
})

const decodeMetaValue = buffer => {
  const decoder = decoding.createDecoder(buffer)
  const rsid = decoding.readVarUint(decoder)
  const offset = decoding.readVarUint(decoder)
  return {
    rsid, offset
  }
}
/**
 * @param {number} rsid room session id
 * @param {number} offset
 * @return {ArrayBuffer}
 */
const encodeMetaValue = (rsid, offset) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, rsid)
  encoding.writeVarUint(encoder, offset)
  return encoding.toBuffer(encoder)
}

const writeInitialCoEntry = (t, room, roomsessionid, offset) => globals.pall([
  idb.put(getStoreCo(t), encodeMetaValue(roomsessionid, offset), getCoMetaKey(room)),
  idb.put(getStoreCo(t), globals.createArrayBufferFromArray([]), getCoDataKey(room))
])

const _confirmSub = (t, metaval, sub) => {
  if (metaval === undefined) {
    return writeInitialCoEntry(t, sub.room, sub.rsid, sub.offset).then(() => idb.del(getStoreUS(t), sub.room)).then(() => null)
  }
  const meta = decodeMetaValue(metaval)
  if (meta.rsid !== sub.rsid) {
    // TODO: Yjs sync with server here
    // get all room data (without CU) and save it as a client update. Then remove all data
    return getRoomDataWithoutCU(t, sub.room)
      .then(roomdata =>
        writeClientUnconfirmed(t, sub.room, roomdata)
          .then(clientConf => message.createUpdate(sub.room, roomdata, clientConf))
          .then(update =>
            writeInitialCoEntry(t, sub.room, sub.rsid, sub.offset).then(() => update)
          )
      )
  } else if (meta.offset < sub.offset) {
    return writeConfirmedByHost(t, sub.room, sub.offset).then(() => null)
  } else {
    // nothing needs to happen
    return null
  }
}

/**
 * @typedef Sub
 * @type {Object}
 * @property {string} room room name
 * @property {number} rsid room session id
 * @property {number} offset
 */

/**
 * Set the initial room data. Overwrites initial data if there is any!
 * @param {IDBTransaction} t
 * @param {Sub} sub
 * @return {Promise<ArrayBuffer?>} Message to send to server
 */
export const confirmSubscription = (t, sub) => idb.get(getStoreCo(t), getCoMetaKey(sub.room)).then(metaval => _confirmSub(t, metaval, sub))

export const confirmSubscriptions = (t, subs) => idb.getAllKeysValues(getStoreCo(t), idb.createIDBKeyRangeLowerBound('meta:', false)).then(kvs => {
  const ps = []
  const subMap = new Map()
  subs.forEach(sub => subMap.set(sub.room, sub))
  for (let i = 0, len = kvs.length; i < len; i++) {
    const kv = kvs[i]
    const kvroom = kv.k.slice(5)
    const exSub = subMap.get(kvroom)
    if (exSub !== undefined) {
      subMap.delete(kvroom)
      ps.push(_confirmSub(t, kv.v, exSub))
    }
  }
  // all remaining elements in subMap do not exist yet in Co.
  subMap.forEach(nonexSub => ps.push(_confirmSub(t, undefined, nonexSub)))
  return ps
})

export const writeUnconfirmedSubscription = (t, room) => idb.put(getStoreUS(t), true, room)

export const getUnconfirmedSubscriptions = t => idb.getAllKeys(getStoreUS(t))
