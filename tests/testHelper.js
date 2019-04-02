import * as Y from '../src/index.js'
import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import { createMutex } from 'lib0/mutex.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as syncProtocol from 'y-protocols/sync.js'

/**
 * @param {TestYInstance} y
 * @param {Y.Transaction} transaction
 */
const afterTransaction = (y, transaction) => {
  y.mMux(() => {
    const encoder = encoding.createEncoder()
    syncProtocol.writeUpdate(encoder, transaction.updateMessage)
    broadcastMessage(y, encoding.toBuffer(encoder))
  })
}

/**
 * @param {TestYInstance} y // publish message created by `y` to all other online clients
 * @param {ArrayBuffer} m
 */
const broadcastMessage = (y, m) => {
  if (y.tc.onlineConns.has(y)) {
    y.tc.onlineConns.forEach(remoteYInstance => {
      if (remoteYInstance !== y) {
        remoteYInstance._receive(m, y)
      }
    })
  }
}

export class TestYInstance extends Y.Y {
  /**
   * @param {TestConnector} testConnector
   */
  constructor (testConnector, clientID) {
    super()
    this.userID = clientID // overwriting clientID
    /**
     * @type {TestConnector}
     */
    this.tc = testConnector
    /**
     * @type {Map<TestYInstance, Array<ArrayBuffer>>}
     */
    this.receiving = new Map()
    /**
     * Message mutex
     * @type {Function}
     */
    this.mMux = createMutex()
    testConnector.allConns.add(this)
    // set up observe on local model
    this.on('afterTransaction', afterTransaction)
    this.connect()
  }
  /**
   * Disconnect from TestConnector.
   */
  disconnect () {
    this.receiving = new Map()
    this.tc.onlineConns.delete(this)
  }
  /**
   * Append yourself to the list of known Y instances in testconnector.
   * Also initiate sync with all clients.
   */
  connect () {
    if (!this.tc.onlineConns.has(this)) {
      this.tc.onlineConns.add(this)
      const encoder = encoding.createEncoder()
      syncProtocol.writeSyncStep1(encoder, this)
      // publish SyncStep1
      broadcastMessage(this, encoding.toBuffer(encoder))
      this.tc.onlineConns.forEach(remoteYInstance => {
        if (remoteYInstance !== this) {
          // remote instance sends instance to this instance
          const encoder = encoding.createEncoder()
          syncProtocol.writeSyncStep1(encoder, remoteYInstance)
          this._receive(encoding.toBuffer(encoder), remoteYInstance)
        }
      })
    }
  }
  /**
   * Receive a message from another client. This message is only appended to the list of receiving messages.
   * TestConnector decides when this client actually reads this message.
   *
   * @param {ArrayBuffer} message
   * @param {TestYInstance} remoteClient
   */
  _receive (message, remoteClient) {
    let messages = this.receiving.get(remoteClient)
    if (messages === undefined) {
      messages = []
      this.receiving.set(remoteClient, messages)
    }
    messages.push(message)
  }
}

/**
 * Keeps track of TestYInstances.
 *
 * The TestYInstances add/remove themselves from the list of connections maiained in this object.
 * I think it makes sense. Deal with it.
 */
export class TestConnector {
  constructor (gen) {
    /**
     * @type {Set<TestYInstance>}
     */
    this.allConns = new Set()
    /**
     * @type {Set<TestYInstance>}
     */
    this.onlineConns = new Set()
    /**
     * @type {prng.PRNG}
     */
    this.prng = gen
  }
  /**
   * Create a new Y instance and add it to the list of connections
   * @param {number} clientID
   */
  createY (clientID) {
    return new TestYInstance(this, clientID)
  }
  /**
   * Choose random connection and flush a random message from a random sender.
   *
   * If this function was unable to flush a message, because there are no more messages to flush, it returns false. true otherwise.
   * @return {boolean}
   */
  flushRandomMessage () {
    const gen = this.prng
    const conns = Array.from(this.onlineConns).filter(conn => conn.receiving.size > 0)
    if (conns.length > 0) {
      const receiver = prng.oneOf(gen, conns)
      const [sender, messages] = prng.oneOf(gen, Array.from(receiver.receiving))
      const m = messages.shift()
      if (messages.length === 0) {
        receiver.receiving.delete(sender)
      }
      if (m === undefined) {
        return this.flushRandomMessage()
      }
      const encoder = encoding.createEncoder()
      receiver.mMux(() => {
        // console.log('receive (' + sender.userID + '->' + receiver.userID + '):\n', syncProtocol.stringifySyncMessage(decoding.createDecoder(m), receiver))
        // do not publish data created when this function is executed (could be ss2 or update message)
        syncProtocol.readSyncMessage(decoding.createDecoder(m), encoder, receiver)
      })
      if (encoding.length(encoder) > 0) {
        // send reply message
        sender._receive(encoding.toBuffer(encoder), receiver)
      }
      return true
    }
    return false
  }
  /**
   * @return {boolean} True iff this function actually flushed something
   */
  flushAllMessages () {
    let didSomething = false
    while (this.flushRandomMessage()) {
      didSomething = true
    }
    return didSomething
  }
  reconnectAll () {
    this.allConns.forEach(conn => conn.connect())
  }
  disconnectAll () {
    this.allConns.forEach(conn => conn.disconnect())
  }
  syncAll () {
    this.reconnectAll()
    this.flushAllMessages()
  }
  /**
   * @return {boolean} Whether it was possible to disconnect a randon connection.
   */
  disconnectRandom () {
    if (this.onlineConns.size === 0) {
      return false
    }
    prng.oneOf(this.prng, Array.from(this.onlineConns)).disconnect()
    return true
  }
  /**
   * @return {boolean} Whether it was possible to reconnect a random connection.
   */
  reconnectRandom () {
    const reconnectable = []
    this.allConns.forEach(conn => {
      if (!this.onlineConns.has(conn)) {
        reconnectable.push(conn)
      }
    })
    if (reconnectable.length === 0) {
      return false
    }
    prng.oneOf(this.prng, reconnectable).connect()
    return true
  }
}

/**
 * @param {t.TestCase} tc
 * @param {{users?:number}} conf
 * @return {{testConnector:TestConnector,users:Array<TestYInstance>,array0:Y.Array<any>,array1:Y.Array<any>,array2:Y.Array<any>,map0:Y.Map,map1:Y.Map,map2:Y.Map,text0:Y.Text,text1:Y.Text,text2:Y.Text,xml0:YXmlFragment,xml1:YXmlFragment,xml2:YXmlFragment}}
 */
export const init = (tc, { users = 5 } = {}) => {
  /**
   * @type {Object<string,any>}
   */
  const result = {
    users: []
  }
  const gen = tc.prng
  const testConnector = new TestConnector(gen)
  result.testConnector = testConnector
  for (let i = 0; i < users; i++) {
    const y = testConnector.createY(i)
    result.users.push(y)
    result['array' + i] = y.get('array', Y.Array)
    result['map' + i] = y.get('map', Y.Map)
    result['xml' + i] = y.get('xml', Y.XmlElement)
    result['text' + i] = y.get('text', Y.Text)
  }
  testConnector.syncAll()
  // @ts-ignore
  return result
}

/**
 * @param {any} constructor
 * @param {ID} a
 * @param {ID} b
 * @param {string} path
 * @param {any} next
 */
const customOSCompare = (constructor, a, b, path, next) => {
  switch (constructor) {
    case Y.ID:
      return compareIDs(a, b)
  }
  return next(constructor, a, b, path, next)
}

/**
 * 1. reconnect and flush all
 * 2. user 0 gc
 * 3. get type content
 * 4. disconnect & reconnect all (so gc is propagated)
 * 5. compare os, ds, ss
 *
 * @param {Array<TestYInstance>} users
 */
export const compare = users => {
  users.forEach(u => u.connect())
  while (users[0].tc.flushAllMessages()) {}
  var userArrayValues = users.map(u => u.define('array', Y.Array).toJSON().map(val => JSON.stringify(val)))
  var userMapValues = users.map(u => u.define('map', Y.Map).toJSON())
  var userXmlValues = users.map(u => u.define('xml', Y.XmlElement).toString())
  var userTextValues = users.map(u => u.define('text', Y.Text).toDelta())
  var data = users.map(u => {
    defragmentItemContent(u)
    var data = {}
    let ops = []
    u.os.iterate(null, null, op => {
      let json
      if (op.constructor === Y.GC) {
        json = {
          type: 'GC',
          id: op._id,
          length: op._length,
          content: null
        }
      } else {
        json = {
          id: op._id,
          left: op._left === null ? null : op._left._lastId,
          right: op._right === null ? null : op._right._id,
          length: op._length,
          deleted: op._deleted,
          parent: op._parent._id,
          content: null
        }
      }
      if (op instanceof Y.ItemJSON || op instanceof Y.ItemString) {
        json.content = op._content
      }
      ops.push(json)
    })
    data.os = ops
    data.ds = getDeleteSet(u)
    const ss = {}
    u.ss.state.forEach((clock, user) => {
      ss[user] = clock
    })
    data.ss = ss
    return data
  })
  for (var i = 0; i < data.length - 1; i++) {
    // t.describe(`Comparing user${i} with user${i + 1}`)
    t.compare(userArrayValues[i].length, users[i].get('array').length)
    t.compare(userArrayValues[i], userArrayValues[i + 1])
    t.compare(userMapValues[i], userMapValues[i + 1])
    t.compare(userXmlValues[i], userXmlValues[i + 1])
    t.compare(userTextValues[i].map(a => a.insert).join('').length, users[i].get('text').length)
    t.compare(userTextValues[i], userTextValues[i + 1])
    t.compare(data[i].os, data[i + 1].os, null, customOSCompare)
    t.compare(data[i].ds, data[i + 1].ds, null, customOSCompare)
    t.compare(data[i].ss, data[i + 1].ss, null, customOSCompare)
  }
  users.forEach(user =>
    t.assert(user._missingStructs.size === 0)
  )
  users.map(u => u.destroy())
}

export const applyRandomTests = (tc, mods, iterations) => {
  const gen = tc.prng
  const result = init(tc, { users: 5 })
  const { testConnector, users } = result
  for (var i = 0; i < iterations; i++) {
    if (prng.int31(gen, 0, 100) <= 2) {
      // 2% chance to disconnect/reconnect a random user
      if (prng.bool(gen)) {
        testConnector.disconnectRandom()
      } else {
        testConnector.reconnectRandom()
      }
    } else if (prng.int31(gen, 0, 100) <= 1) {
      // 1% chance to flush all & garbagecollect
      // TODO: We do not gc all users as this does not work yet
      // await garbageCollectUsers(t, users)
      testConnector.flushAllMessages()
      // await users[0].db.emptyGarbageCollector() // TODO: reintroduce GC tests!
    } else if (prng.int31(gen, 0, 100) <= 50) {
      // 50% chance to flush a random message
      testConnector.flushRandomMessage()
    }
    let user = prng.oneOf(gen, users)
    var test = prng.oneOf(gen, mods)
    test(t, user, gen)
  }
  compare(users)
  return result
}
