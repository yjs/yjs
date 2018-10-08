import * as test from './test.js'
import * as idb from './idb.js'
import * as logging from './logging.js'

const initTestDB = db => idb.createStores(db, [['test']])
const testDBName = 'idb-test'

const createTransaction = db => db.transaction(['test'], 'readwrite')
/**
 * @param {IDBTransaction} t
 * @return {IDBObjectStore}
 */
const getStore = t => idb.getStore(t, 'test')

idb.deleteDB(testDBName).then(() => idb.openDB(testDBName, initTestDB)).then(db => {
  test.run('idb iteration', async testname => {
    const t = createTransaction(db)
    await idb.put(getStore(t), 0, ['t', 0])
    await idb.put(getStore(t), 1, ['t', 1])
    const valsGetAll = await idb.getAll(getStore(t))
    if (valsGetAll.length !== 2) {
      logging.fail('getAll does not return two values')
    }
    const valsIterate = []
    const keyrange = idb.createIDBKeyRangeBound(['t', 0], ['t', 1], false, false)
    await idb.put(getStore(t), 2, ['t', 2])
    await idb.iterate(getStore(t), keyrange, (val, key) => {
      valsIterate.push(val)
    })
    if (valsIterate.length !== 2) {
      logging.fail('iterate does not return two values')
    }
  })
})
