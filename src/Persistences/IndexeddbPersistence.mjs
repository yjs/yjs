/* global indexedDB, location, BroadcastChannel */

import Y from '../Y.mjs'

/*
 * Request to Promise transformer
 */
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
    window.r1 = request
    request.onupgradeneeded = function (event) {
      const db = event.target.result
      if (db.objectStoreNames.contains('model')) {
        db.deleteObjectStore('updates')
        db.deleteObjectStore('model')
        db.deleteObjectStore('custom')
      }
      db.createObjectStore('updates', {autoIncrement: true})
      db.createObjectStore('model')
      db.createObjectStore('custom')
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

const PREFERRED_TRIM_SIZE = 500

export default class IndexedDBPersistence extends Y.AbstractPersistence {
  constructor (opts) {
    super(opts)
    window.addEventListener('unload', () => {
      this.ys.forEach(function (cnf, y) {
        if (cnf.db !== null) {
          cnf.db.close()
        } else {
          cnf._db.then(db => db.close())
        }
      })
    })
  }
  init (y) {
    let cnf = this.ys.get(y)
    let room = y.room
    cnf.db = null
    const dbOpened = openDB(room)
    dbOpened.then(db => {
      cnf.db = db
    })
    if (typeof BroadcastChannel !== 'undefined') {
      cnf.channel = new BroadcastChannel('__yjs__' + room)
      cnf.channel.addEventListener('message', e => {
        cnf.mutualExclude(function () {
          y.transact(function () {
            Y.utils.integrateRemoteStructs(y, new Y.utils.BinaryDecoder(e.data))
          })
        })
      })
    } else {
      cnf.channel = null
    }
    return dbOpened
  }

  deinit (y) {
    let cnf = this.ys.get(y)
    cnf.db.close()
    super.deinit(y)
  }

  set (y, key, value) {
    const cnf = this.ys.get(y)
    const t = cnf.db.transaction(['custom'], 'readwrite')
    const customStore = t.objectStore('custom')
    return rtop(customStore.put(value, key))
  }

  get (y, key) {
    const cnf = this.ys.get(y)
    const t = cnf.db.transaction(['custom'], 'readwrite')
    const customStore = t.objectStore('custom')
    return rtop(customStore.get(key))
  }

  /**
   * Remove all persisted data that belongs to a room.
   * Automatically destroys all Yjs all Yjs instances that persist to
   * the room. If `destroyYjsInstances = false` the persistence functionality
   * will be removed from the Yjs instances.
   */
  removePersistedData (room, destroyYjsInstances = true) {
    super.removePersistedData(room, destroyYjsInstances)
    return rtop(indexedDB.deleteDatabase(room))
  }

  saveUpdate (y, update) {
    let cnf = this.ys.get(y)
    if (cnf.channel !== null) {
      cnf.channel.postMessage(update)
    }
    let t = cnf.db.transaction(['updates'], 'readwrite')
    let updatesStore = t.objectStore('updates')
    updatesStore.put(update)
    let cntP = rtop(updatesStore.count())
    cntP.then(cnt => {
      if (cnt >= PREFERRED_TRIM_SIZE) {
        this.persist(y)
      }
    })
  }

  saveStruct (y, struct) {
    super.saveStruct(y, struct)
  }

  retrieve (y) {
    let cnf = this.ys.get(y)
    let t = cnf.db.transaction(['updates', 'model'], 'readonly')
    let modelStore = t.objectStore('model')
    let updatesStore = t.objectStore('updates')
    return Promise.all([rtop(modelStore.get(0)), rtop(updatesStore.getAll())])
      .then(([model, updates]) => {
        super.retrieve(y, model, updates)
      })
  }

  persist (y) {
    let cnf = this.ys.get(y)
    let db = cnf.db
    let t = db.transaction(['updates', 'model'], 'readwrite')
    let updatesStore = t.objectStore('updates')
    return rtop(updatesStore.getAll())
    .then(updates => {
      // apply pending updates before deleting them
      Y.AbstractPersistence.prototype.retrieve.call(this, y, null, updates)
      // get binary model
      let binaryModel = Y.AbstractPersistence.prototype.persist.call(this, y)
      // delete all pending updates
      if (updates.length > 0) {
        let modelStore = t.objectStore('model')
        modelStore.put(binaryModel, 0)
        updatesStore.clear()
      }
    })
  }
}

if (typeof Y !== 'undefined') {
  extendYIndexedDBPersistence(Y) // eslint-disable-line
}
