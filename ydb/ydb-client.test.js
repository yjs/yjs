/* eslint-env browser */

import * as test from './test.js'
import * as ydbClient from './ydb-client.js'
import * as globals from './globals.js'
import * as idbactions from './idbactions.js'
import * as logging from './logging.js'

const wsUrl = 'ws://127.0.0.1:8899/ws'
const testRoom = 'testroom'

class YdbTestClient {
  constructor (ydb) {
    this.ydb = ydb
    this.createdUpdates = new Set()
    this.data = []
    this.checked = new Set()
  }
}

const clearAllYdbContent = () => fetch('http://127.0.0.1:8899/clearAll', { mode: 'no-cors' })

/**
 * @param {string} name
 * @return {Promise<YdbTestClient>}
 */
const getTestClient = async name => {
  await ydbClient.clear('ydb-' + name)
  const ydb = await ydbClient.get(wsUrl, 'ydb-' + name)
  const testClient = new YdbTestClient(ydb)
  ydbClient.subscribe(ydb, testRoom, data => {
    testClient.data.push(data)
    globals.createArrayFromArrayBuffer(data).forEach(d => {
      if (d < nextUpdateNumber) {
        testClient.checked.add(d)
      }
    })
    console.log(name, 'received data', data, testClient.data)
  })
  return testClient
}

// TODO: does only work for 8bit numbers..
let nextUpdateNumber = 0

/**
 * Create an update. We use an increasing message counter so each update is unique.
 * @param {YdbTestClient} client
 */
const update = (client) => {
  ydbClient.update(client.ydb, testRoom, globals.createArrayBufferFromArray([nextUpdateNumber++]))
}

/**
 * Check if tsclient has all data in dataset
 * @param {...YdbTestClient} testClients
 */
const checkTestClients = (...testClients) => globals.until(100000, () => testClients.every(testClient =>
  testClient.checked.size === nextUpdateNumber
)).then(() =>
  globals.wait(150) // wait 150 for all conf messages to come in..
  // TODO: do the below check in the until handler
).then(() => globals.pall(testClients.map(testClient => idbactions.getRoomData(idbactions.createTransaction(testClient.ydb.db), testRoom)))).then(testClientsData => {
  testClientsData.forEach((testClientData, i) => {
    const checked = new Set()
    globals.createArrayFromArrayBuffer(testClientData).forEach(d => {
      if (checked.has(d)) {
        logging.fail('duplicate content')
      }
      checked.add(d)
    })
    if (checked.size !== nextUpdateNumber) {
      logging.fail(`Not all data is available in idb in client ${i}`)
    }
  })
})

clearAllYdbContent().then(() => {
  test.run('ydb-client', async testname => {
    const c1 = await getTestClient('1')
    const c2 = await getTestClient('2')
    update(c1)
    await checkTestClients(c1, c2)
  })
})
