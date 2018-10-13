/* eslint-env browser */

import * as globals from './globals.js'

/*
 * IDB Request to Promise transformer
 */
export const rtop = request => globals.createPromise((resolve, reject) => {
  request.onerror = event => reject(new Error(event.target.error))
  request.onblocked = () => location.reload()
  request.onsuccess = event => resolve(event.target.result)
})

/**
 * @return {Promise<IDBDatabase>}
 */
export const openDB = (name, initDB) => globals.createPromise((resolve, reject) => {
  let request = indexedDB.open(name)
  /**
   * @param {any} event
   */
  request.onupgradeneeded = event => initDB(event.target.result)
  /**
   * @param {any} event
   */
  request.onerror = event => reject(new Error(event.target.error))
  request.onblocked = () => location.reload()
  /**
   * @param {any} event
   */
  request.onsuccess = event => {
    const db = event.target.result
    db.onversionchange = () => { db.close() }
    addEventListener('unload', () => db.close())
    resolve(db)
  }
})

export const deleteDB = name => rtop(indexedDB.deleteDatabase(name))

export const createStores = (db, definitions) => definitions.forEach(d =>
  db.createObjectStore.apply(db, d)
)

/**
 * @param {IDBObjectStore} store
 * @param {String | number | ArrayBuffer | Date | Array } key
 * @return {Promise<ArrayBuffer>}
 */
export const get = (store, key) =>
  rtop(store.get(key))

/**
 * @param {IDBObjectStore} store
 * @param {String | number | ArrayBuffer | Date | IDBKeyRange | Array } key
 */
export const del = (store, key) =>
  rtop(store.delete(key))

/**
 * @param {IDBObjectStore} store
 * @param {String | number | ArrayBuffer | Date | boolean} item
 * @param {String | number | ArrayBuffer | Date | Array} [key]
 */
export const put = (store, item, key) =>
  rtop(store.put(item, key))

/**
 * @param {IDBObjectStore} store
 * @param {String | number | ArrayBuffer | Date | boolean}  item
 * @param {String | number | ArrayBuffer | Date | Array}  [key]
 * @return {Promise<ArrayBuffer>}
 */
export const add = (store, item, key) =>
  rtop(store.add(item, key))

/**
 * @param {IDBObjectStore} store
 * @param {String | number | ArrayBuffer | Date}  item
 * @return {Promise<number>}
 */
export const addAutoKey = (store, item) =>
  rtop(store.add(item))

/**
 * @param {IDBObjectStore} store
 * @param {IDBKeyRange} [range]
 */
export const getAll = (store, range) =>
  rtop(store.getAll(range))

/**
 * @param {IDBObjectStore} store
 * @param {IDBKeyRange} [range]
 */
export const getAllKeys = (store, range) =>
  rtop(store.getAllKeys(range))

/**
 * Iterate on keys and values
 * @param {IDBObjectStore} store
 * @param {IDBKeyRange?} keyrange
 * @param {function(any, any)} f Return true in order to continue the cursor
 */
export const iterate = (store, keyrange, f) => globals.createPromise((resolve, reject) => {
  const request = store.openCursor(keyrange)
  request.onerror = reject
  /**
   * @param {any} event
   */
  request.onsuccess = event => {
    const cursor = event.target.result
    if (cursor === null) {
      return resolve()
    }
    f(cursor.value, cursor.key)
    cursor.continue()
  }
})

/**
 * Iterate on the keys (no values)
 * @param {IDBObjectStore} store
 * @param {IDBKeyRange} keyrange
 * @param {function(IDBCursor)} f Call `idbcursor.continue()` to iterate further
 */
export const iterateKeys = (store, keyrange, f) => {
  /**
   * @param {any} event
   */
  store.openKeyCursor(keyrange).onsuccess = event => f(event.target.result)
}

/**
 * Open store from transaction
 * @param {IDBTransaction} t
 * @param {String} store
 * @returns {IDBObjectStore}
 */
export const getStore = (t, store) => t.objectStore(store)

export const createIDBKeyRangeBound = (lower, upper, lowerOpen, upperOpen) => IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)
export const createIDBKeyRangeUpperBound = (upper, upperOpen) => IDBKeyRange.upperBound(upper, upperOpen)
export const createIDBKeyRangeLowerBound = (lower, lowerOpen) => IDBKeyRange.lowerBound(lower, lowerOpen)
