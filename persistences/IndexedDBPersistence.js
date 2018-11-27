/*
import { Y } from '../utils/Y.js'
import { createMutex } from '../lib/mutex.js'
import { decodePersisted, encodeStructsDS, encodeUpdate, PERSIST_STRUCTS_DS, PERSIST_UPDATE } from './decodePersisted.js'

function rtop (request) {
  return new Promise(function (resolve, reject) {
    request.onerror = function (event) {
      reject(new Error(event.target.error))
    }
    request.onblocked = function () {
      location.reload()
    }
    request.onsuccess = function (event) {
      resolve(event.target.result)
    }
  })
}

function openDB (room) {
  return new Promise(function (resolve, reject) {
    let request = indexedDB.open(room)
    request.onupgradeneeded = function (event) {
      const db = event.target.result
      if (db.objectStoreNames.contains('updates')) {
        db.deleteObjectStore('updates')
      }
      db.createObjectStore('updates', {autoIncrement: true})
    }
    request.onerror = function (event) {
      reject(new Error(event.target.error))
    }
    request.onblocked = function () {
      location.reload()
    }
    request.onsuccess = function (event) {
      const db = event.target.result
      db.onversionchange = function () { db.close() }
      resolve(db)
    }
  })
}

function persist (room) {
  let t = room.db.transaction(['updates'], 'readwrite')
  let updatesStore = t.objectStore('updates')
  return rtop(updatesStore.getAll())
    .then(updates => {
      // apply all previous updates before deleting them
      room.mutex(() => {
        updates.forEach(update => {
          decodePersisted(y, new BinaryDecoder(update))
        })
      })
      const encoder = new BinaryEncoder()
      encodeStructsDS(y, encoder)
      // delete all pending updates
      rtop(updatesStore.clear()).then(() => {
        // write current model
        updatesStore.put(encoder.createBuffer())
      })
    })
}

function saveUpdate (room, updateBuffer) {
  const db = room.db
  if (db !== null) {
    const t = db.transaction(['updates'], 'readwrite')
    const updatesStore = t.objectStore('updates')
    const updatePut = rtop(updatesStore.put(updateBuffer))
    rtop(updatesStore.count()).then(cnt => {
      if (cnt >= PREFERRED_TRIM_SIZE) {
        persist(room)
      }
    })
    return updatePut
  }
}

function registerRoomInPersistence (documentsDB, roomName) {
  return documentsDB.then(
    db => Promise.all([
      db,
      rtop(db.transaction(['documents'], 'readonly').objectStore('documents').get(roomName))
    ])
  ).then(
    ([db, doc]) => {
      if (doc === undefined) {
        return rtop(db.transaction(['documents'], 'readwrite').objectStore('documents').add({ roomName, serverUpdateCounter: 0 }))
      }
    }
  )
}

const PREFERRED_TRIM_SIZE = 400

export class IndexedDBPersistence {
  constructor () {
    this._rooms = new Map()
    this._documentsDB = new Promise(function (resolve, reject) {
      let request = indexedDB.open('_yjs_documents')
      request.onupgradeneeded = function (event) {
        const db = event.target.result
        if (db.objectStoreNames.contains('documents')) {
          db.deleteObjectStore('documents')
        }
        db.createObjectStore('documents', { keyPath: "roomName" })
      }
      request.onerror = function (event) {
        reject(new Error(event.target.error))
      }
      request.onblocked = function () {
        location.reload()
      }
      request.onsuccess = function (event) {
        const db = event.target.result
        db.onversionchange = function () { db.close() }
        resolve(db)
      }
    })
    addEventListener('unload', () => {
      // close everything when page unloads
      this._rooms.forEach(room => {
        if (room.db !== null) {
          room.db.close()
        } else {
          room.dbPromise.then(db => db.close())
        }
      })
      this._documentsDB.then(db => db.close())
    })
  }
  getAllDocuments () {
    return this._documentsDB.then(
      db => rtop(db.transaction(['documents'], 'readonly').objectStore('documents').getAll())
    )
  }
  setRemoteUpdateCounter (roomName, remoteUpdateCounter) {
    this._documentsDB.then(
      db => rtop(db.transaction(['documents'], 'readwrite').objectStore('documents').put({ roomName, remoteUpdateCounter }))
    )
  }

  _createYInstance (roomName) {
    const room = this._rooms.get(roomName)
    if (room !== undefined) {
      return room.y
    }
    const y = new Y()
    return openDB(roomName).then(
      db => rtop(db.transaction(['updates'], 'readonly').objectStore('updates').getAll())
    ).then(
      updates =>
        y.transact(() => {
          updates.forEach(update => {
            decodePersisted(y, new BinaryDecoder(update))
          })
        }, true)
    ).then(() => Promise.resolve(y))
  }

  _persistStructsDS (roomName, structsDS) {
    const encoder = new BinaryEncoder()
    encoder.writeVarUint(PERSIST_STRUCTS_DS)
    encoder.writeArrayBuffer(structsDS)
    return openDB(roomName).then(db => {
      const t = db.transaction(['updates'], 'readwrite')
      const updatesStore = t.objectStore('updates')
      return rtop(updatesStore.put(encoder.createBuffer()))
    })
  }

  _persistStructs (roomName, structs) {
    const encoder = new BinaryEncoder()
    encoder.writeVarUint(PERSIST_UPDATE)
    encoder.writeArrayBuffer(structs)
    return openDB(roomName).then(db => {
      const t = db.transaction(['updates'], 'readwrite')
      const updatesStore = t.objectStore('updates')
      return rtop(updatesStore.put(encoder.createBuffer()))
    })
  }

  connectY (roomName, y) {
    if (this._rooms.has(roomName)) {
      throw new Error('A Y instance is already bound to this room!')
    }
    let room = {
      db: null,
      dbPromise: null,
      channel: null,
      mutex: createMutex(),
      y
    }
    if (typeof BroadcastChannel !== 'undefined') {
      room.channel = new BroadcastChannel('__yjs__' + roomName)
      room.channel.addEventListener('message', e => {
        room.mutex(function () {
          decodePersisted(y, new BinaryDecoder(e.data))
        })
      })
    }
    y.on('destroyed', () => {
      this.disconnectY(roomName, y)
    })
    y.on('afterTransaction', (y, transaction) => {
      room.mutex(() => {
        if (transaction.encodedStructsLen > 0) {
          const encoder = new BinaryEncoder()
          const update = new BinaryEncoder()
          encodeUpdate(y, transaction.encodedStructs, update)
          const updateBuffer = update.createBuffer()
          if (room.channel !== null) {
            room.channel.postMessage(updateBuffer)
          }
          if (transaction.encodedStructsLen > 0
            import { Y } from '../utils/Y.js'
            import { createMutex } from '../lib/mutex.js'
            import { decodePersisted, encodeStructsDS, encodeUpdate, PERSIST_STRUCTS_DS, PERSIST_UPDATE } from './decodePersisted.js'

            function rtop (request) {
              return new Promise(function (resolve, reject) {
                request.onerror = function (event) {
                  reject(new Error(event.target.error))
                }
                request.onblocked = function () {
                  location.reload()
                }
                request.onsuccess = function (event) {
                  resolve(event.target.result)
                }
              })
            }

            function openDB (room) {
              return new Promise(function (resolve, reject) {
                let request = indexedDB.open(room)
                request.onupgradeneeded = function (event) {
                  const db = event.target.result
                  if (db.objectStoreNames.contains('updates')) {
                    db.deleteObjectStore('updates')
                  }
                  db.createObjectStore('updates', {autoIncrement: true})
                }
                request.onerror = function (event) {
                  reject(new Error(event.target.error))
                }
                request.onblocked = function () {
                  location.reload()
                }
                request.onsuccess = function (event) {
                  const db = event.target.result
                  db.onversionchange = function () { db.close() }
                  resolve(db)
                }
              })
            }

            function persist (room) {
              let t = room.db.transaction(['updates'], 'readwrite')
              let updatesStore = t.objectStore('updates')
              return rtop(updatesStore.getAll())
                .then(updates => {
                  // apply all previous updates before deleting them
                  room.mutex(() => {
                    updates.forEach(update => {
                      decodePersisted(y, new BinaryDecoder(update))
                    })
                  })
                  const encoder = new BinaryEncoder()
                  encodeStructsDS(y, encoder)
                  // delete all pending updates
                  rtop(updatesStore.clear()).then(() => {
                    // write current model
                    updatesStore.put(encoder.createBuffer())
                  })
                })
            }

            function saveUpdate (room, updateBuffer) {
              const db = room.db
              if (db !== null) {
                const t = db.transaction(['updates'], 'readwrite')
                const updatesStore = t.objectStore('updates')
                const updatePut = rtop(updatesStore.put(updateBuffer))
                rtop(updatesStore.count()).then(cnt => {
                  if (cnt >= PREFERRED_TRIM_SIZE) {
                    persist(room)
                  }
                })
                return updatePut
              }
            }

            function registerRoomInPersistence (documentsDB, roomName) {
              return documentsDB.then(
                db => Promise.all([
                  db,
                  rtop(db.transaction(['documents'], 'readonly').objectStore('documents').get(roomName))
                ])
              ).then(
                ([db, doc]) => {
                  if (doc === undefined) {
                    return rtop(db.transaction(['documents'], 'readwrite').objectStore('documents').add({ roomName, serverUpdateCounter: 0 }))
                  }
                }
              )
            }

            const PREFERRED_TRIM_SIZE = 400

            export class IndexedDBPersistence {
              constructor () {
                this._rooms = new Map()
                this._documentsDB = new Promise(function (resolve, reject) {
                  let request = indexedDB.open('_yjs_documents')
                  request.onupgradeneeded = function (event) {
                    const db = event.target.result
                    if (db.objectStoreNames.contains('documents')) {
                      db.deleteObjectStore('documents')
                    }
                    db.createObjectStore('documents', { keyPath: "roomName" })
                  }
                  request.onerror = function (event) {
                    reject(new Error(event.target.error))
                  }
                  request.onblocked = function () {
                    location.reload()
                  }
                  request.onsuccess = function (event) {
                    const db = event.target.result
                    db.onversionchange = function () { db.close() }
                    resolve(db)
                  }
                })
                addEventListener('unload', () => {
                  // close everything when page unloads
                  this._rooms.forEach(room => {
                    if (room.db !== null) {
                      room.db.close()
                    } else {
                      room.dbPromise.then(db => db.close())
                    }
                  })
                  this._documentsDB.then(db => db.close())
                })
              }
              getAllDocuments () {
                return this._documentsDB.then(
                  db => rtop(db.transaction(['documents'], 'readonly').objectStore('documents').getAll())
                )
              }
              setRemoteUpdateCounter (roomName, remoteUpdateCounter) {
                this._documentsDB.then(
                  db => rtop(db.transaction(['documents'], 'readwrite').objectStore('documents').put({ roomName, remoteUpdateCounter }))
                )
              }

              _createYInstance (roomName) {
                const room = this._rooms.get(roomName)
                if (room !== undefined) {
                  return room.y
                }
                const y = new Y()
                return openDB(roomName).then(
                  db => rtop(db.transaction(['updates'], 'readonly').objectStore('updates').getAll())
                ).then(
                  updates =>
                    y.transact(() => {
                      updates.forEach(update => {
                        decodePersisted(y, new BinaryDecoder(update))
                      })
                    }, true)
                ).then(() => Promise.resolve(y))
              }

              _persistStructsDS (roomName, structsDS) {
                const encoder = new BinaryEncoder()
                encoder.writeVarUint(PERSIST_STRUCTS_DS)
                encoder.writeArrayBuffer(structsDS)
                return openDB(roomName).then(db => {
                  const t = db.transaction(['updates'], 'readwrite')
                  const updatesStore = t.objectStore('updates')
                  return rtop(updatesStore.put(encoder.createBuffer()))
                })
              }

              _persistStructs (roomName, structs) {
                const encoder = new BinaryEncoder()
                encoder.writeVarUint(PERSIST_UPDATE)
                encoder.writeArrayBuffer(structs)
                return openDB(roomName).then(db => {
                  const t = db.transaction(['updates'], 'readwrite')
                  const updatesStore = t.objectStore('updates')
                  return rtop(updatesStore.put(encoder.createBuffer()))
                })
              }

              connectY (roomName, y) {
                if (this._rooms.has(roomName)) {
                  throw new Error('A Y instance is already bound to this room!')
                }
                let room = {
                  db: null,
                  dbPromise: null,
                  channel: null,
                  mutex: createMutex(),
                  y
                }
                if (typeof BroadcastChannel !== 'undefined') {
                  room.channel = new BroadcastChannel('__yjs__' + roomName)
                  room.channel.addEventListener('message', e => {
                    room.mutex(function () {
                      decodePersisted(y, new BinaryDecoder(e.data))
                    })
                  })
                }
                y.on('destroyed', () => {
                  this.disconnectY(roomName, y)
                })
                y.on('afterTransaction', (y, transaction) => {
                  room.mutex(() => {
                    if (transaction.encodedStructsLen > 0) {
                      const encoder = new BinaryEncoder()
                      const update = new BinaryEncoder()
                      encodeUpdate(y, transaction.encodedStructs, update)
                      const updateBuffer = update.createBuffer()
                      if (room.channel !== null) {
                        room.channel.postMessage(updateBuffer)
                      }
                      if (transaction.encodedStructsLen > 0) {
                        if (room.db !== null) {
                          saveUpdate(room, updateBuffer)
                        }
                      }
                    }
                  })
                })
                // register document in documentsDB
                this._documentsDB.then(
                  db =>
                    rtop(db.transaction(['documents'], 'readonly').objectStore('documents').get(roomName))
                      .then(
                        doc => doc === undefined && rtop(db.transaction(['documents'], 'readwrite').objectStore('documents').add({ roomName, serverUpdateCounter: -1 }))
                      )
                )
                // open room db and read existing data
                return room.dbPromise = openDB(roomName)
                  .then(db => {
                    room.db = db
                    const t = room.db.transaction(['updates'], 'readwrite')
                    const updatesStore = t.objectStore('updates')
                    // write current state as update
                    const encoder = new BinaryEncoder()
                    encodeStructsDS(y, encoder)
                    return rtop(updatesStore.put(encoder.createBuffer())).then(() => {
                      // read persisted state
                      return rtop(updatesStore.getAll()).then(updates => {
                        room.mutex(() => {
                          y.transact(() => {
                            updates.forEach(update => {
                              decodePersisted(y, new BinaryDecoder(update))
                            })
                          }, true)
                        })
                      })
                    })
                  })
              }
              disconnectY (roomName) {
                const {
                  db, channel
                } = this._rooms.get(roomName)
                db.close()
                if (channel !== null) {
                  channel.close()
                }
                this._rooms.delete(roomName)
              }

              /**
               * Remove all persisted data that belongs to a room.
               * Automatically destroys all Yjs all Yjs instances that persist to
               * the room. If `destroyYjsInstances = false` the persistence functionality
               * will be removed from the Yjs instances.
               *
              removePersistedData (roomName, destroyYjsInstances = true) {
                this.disconnectY(roomName)
                return rtop(indexedDB.deleteDatabase(roomName))
              }
            }
             {
            if (room.db !== null) {
              saveUpdate(room, updateBuffer)
            }
          }
        }
      })
    })
    // register document in documentsDB
    this._documentsDB.then(
      db =>
        rtop(db.transaction(['documents'], 'readonly').objectStore('documents').get(roomName))
          .then(
            doc => doc === undefined && rtop(db.transaction(['documents'], 'readwrite').objectStore('documents').add({ roomName, serverUpdateCounter: -1 }))
          )
    )
    // open room db and read existing data
    return room.dbPromise = openDB(roomName)
      .then(db => {
        room.db = db
        const t = room.db.transaction(['updates'], 'readwrite')
        const updatesStore = t.objectStore('updates')
        // write current state as update
        const encoder = new BinaryEncoder()
        encodeStructsDS(y, encoder)
        return rtop(updatesStore.put(encoder.createBuffer())).then(() => {
          // read persisted state
          return rtop(updatesStore.getAll()).then(updates => {
            room.mutex(() => {
              y.transact(() => {
                updates.forEach(update => {
                  decodePersisted(y, new BinaryDecoder(update))
                })
              }, true)
            })
          })
        })
      })
  }
  disconnectY (roomName) {
    const {
      db, channel
    } = this._rooms.get(roomName)
    db.close()
    if (channel !== null) {
      channel.close()
    }
    this._rooms.delete(roomName)
  }

  /**
   * Remove all persisted data that belongs to a room.
   * Automatically destroys all Yjs all Yjs instances that persist to
   * the room. If `destroyYjsInstances = false` the persistence functionality
   * will be removed from the Yjs instances.
   *
  removePersistedData (roomName, destroyYjsInstances = true) {
    this.disconnectY(roomName)
    return rtop(indexedDB.deleteDatabase(roomName))
  }
}
*/
