/**
 * @module persistence/leveldb
 * This module re-uses the encoding of syncProtocol to store and read updates from leveldb.
 */

const level = require('level')
const Y = require('../build/yjs.js')
const mux = Y.createMutex()

/*
 * Improves the uniqueness of timestamps.
 * We gamble with the fact that users won't create more than 10000 changes on a single document
 * within one millisecond (also assuming clock works correctly).
 */
let timestampIterator = 0
/**
 * @return {string} A random, time-based string starting with "${roomName}:"
 */
const getNextTimestamp = () => {
  timestampIterator = (timestampIterator + 1) % 10000
  return `${Date.now()}${timestampIterator.toString().padStart(4, '0')}`
}

/**
 * @param {string} docName
 * @return {string}
 */
const generateEntryKey = docName => `${docName}#${getNextTimestamp()}`

/**
 *
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array | ArrayBuffer} buf
 */
const writeEntry = (db, docName, buf) => db.put(generateEntryKey(docName), buf)

/**
 * @param {Uint8Array} arr
 * @param {Y.Y} ydocument
 */
const readEntry = (arr, ydocument) => mux(() =>
  Y.syncProtocol.readSyncMessage(Y.decoding.createDecoder(arr), Y.encoding.createEncoder(), ydocument)
)

/**
 * @param {any} db
 * @param {string} docName
 * @param {Y.Y} ydocument
 */
const loadFromPersistence = (db, docName, ydocument) => new Promise((resolve, reject) =>
  db.createReadStream({
    gte: `${docName}#`,
    lte: `${docName}#Z`,
    keys: false,
    values: true
  })
    .on('data', data => readEntry(data, ydocument))
    .on('error', reject)
    .on('end', resolve)
    .on('close', resolve)
)

const persistState = (db, docName, ydocument) => {
  const encoder = Y.encoding.createEncoder()
  Y.syncProtocol.writeSyncStep2(encoder, ydocument, new Map())
  const entryKey = generateEntryKey(docName)
  const entryPromise = db.put(entryKey, Y.encoding.toBuffer(encoder))
  const delOps = []
  return new Promise((resolve, reject) => db.createKeyStream({
    gte: `${docName}#`,
    lt: entryKey
  })
    .on('data', key => delOps.push({ type: 'del', key }))
    .on('error', reject)
    .on('end', resolve)
    .on('close', resolve)
  ).then(() => entryPromise).then(() => db.batch(delOps))
}

/**
 * Persistence layer for Leveldb.
 */
exports.LevelDbPersistence = class LevelDbPersistence {
  /**
   * @param {string} fpath Path to leveldb database
   */
  constructor (fpath) {
    this.db = level(fpath, { valueEncoding: 'binary' })
  }
  /**
   * Retrieve all data from LevelDB and automatically persist all document updates to leveldb.
   *
   * @param {string} docName
   * @param {Y.Y} ydocument
   */
  bindState (docName, ydocument) {
    // write all updates received from other clients
    // - unless it is created by this persistence layer (e.g. loadFromPersistence, we we mux).
    ydocument.on('afterTransaction', (y, transaction) => {
      if (transaction.encodedStructsLen > 0) {
        mux(() => {
          const encoder = Y.encoding.createEncoder()
          Y.syncProtocol.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
          writeEntry(this.db, docName, Y.encoding.toBuffer(encoder))
        })
      }
    })
    // read all data from persistence
    return loadFromPersistence(this.db, docName, ydocument).then(() =>
      // write current state (just in case anything was added before state was bound)
      this.writeState(docName, ydocument)
    )
  }
  /**
   * Write current state to persistence layer. Deletes all entries that were made before.
   * Call this method at any time - the recommended time to call this method is before the ydocument is destroyed.
   *
   * @param {string} docName
   * @param {Y.Y} ydocument
   */
  writeState (docName, ydocument) {
    return persistState(this.db, docName, ydocument)
  }
}
