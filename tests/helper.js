
import * as Y from '../index.js'
import { ItemJSON } from '../structs/ItemJSON.js'
import { ItemString } from '../structs/ItemString.js'
import { defragmentItemContent } from '../utils/defragmentItemContent.js'
import Quill from 'quill'
import { GC } from '../structs/GC.js'
import * as random from '../lib/prng/prng.js'
import * as syncProtocol from '../protocols/sync.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { createMutex } from '../lib/mutex.js'
import { QuillBinding } from '../bindings/quill.js'
import { DomBinding } from '../bindings/dom/DomBinding.js'

export * from '../index.js'

/**
 * @param {TestYInstance} y
 * @param {Y.Transaction} transaction
 */
const afterTransaction = (y, transaction) => {
  y.mMux(() => {
    if (transaction.encodedStructsLen > 0) {
      const encoder = encoding.createEncoder()
      syncProtocol.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
      broadcastMessage(y, encoding.toBuffer(encoder))
    }
  })
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
 * The TestYInstances add/remove themselves from the list of connections maintained in this object.
 * I think it makes sense. Deal with it.
 */
export class TestConnector {
  constructor (prng) {
    /**
     * @type {Set<TestYInstance>}
     */
    this.allConns = new Set()
    /**
     * @type {Set<TestYInstance>}
     */
    this.onlineConns = new Set()
    /**
     * @type {random.PRNG}
     */
    this.prng = prng
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
    const prng = this.prng
    const conns = Array.from(this.onlineConns).filter(conn => conn.receiving.size > 0)
    if (conns.length > 0) {
      const receiver = random.oneOf(prng, conns)
      const [sender, messages] = random.oneOf(prng, Array.from(receiver.receiving))
      const m = messages.shift()
      if (messages.length === 0) {
        receiver.receiving.delete(sender)
      }
      const encoder = encoding.createEncoder()
      receiver.mMux(() => {
        console.log('receive (' + sender.userID + '->' + receiver.userID + '):\n', syncProtocol.stringifySyncMessage(decoding.createDecoder(m), receiver))
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
    random.oneOf(this.prng, Array.from(this.onlineConns)).disconnect()
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
    random.oneOf(this.prng, reconnectable).connect()
    return true
  }
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

/**
 * Convert DS to a proper DeleteSet of Map.
 *
 * @param {Y.Y} y
 * @return {Object<number, Array<[number, number, boolean]>>}
 */
const getDeleteSet = y => {
  /**
   * @type {Object<number, Array<[number, number, boolean]>}
   */
  var ds = {}
  y.ds.iterate(null, null, n => {
    var user = n._id.user
    var counter = n._id.clock
    var len = n.len
    var gc = n.gc
    var dv = ds[user]
    if (dv === void 0) {
      dv = []
      ds[user] = dv
    }
    dv.push([counter, len, gc])
  })
  return ds
}

/**
 * 1. reconnect and flush all
 * 2. user 0 gc
 * 3. get type content
 * 4. disconnect & reconnect all (so gc is propagated)
 * 5. compare os, ds, ss
 *
 * @param {any} t
 * @param {Array<TestYInstance>} users
 */
export const compareUsers = (t, users) => {
  users.forEach(u => u.connect())
  do {
    users.forEach(u => {
      // flush dom changes
      u.domBinding._beforeTransactionHandler(null, null, false)
    })
  } while (users[0].tc.flushAllMessages())

  var userArrayValues = users.map(u => u.define('array', Y.Array).toJSON().map(val => JSON.stringify(val)))
  var userMapValues = users.map(u => u.define('map', Y.Map).toJSON())
  var userXmlValues = users.map(u => u.define('xml', Y.XmlElement).toString())
  var userTextValues = users.map(u => u.define('text', Y.Text).toDelta())
  var userQuillValues = users.map(u => {
    u.quill.update('yjs') // get latest changes
    return u.quill.getContents().ops
  })

  var data = users.map(u => {
    defragmentItemContent(u)
    var data = {}
    let ops = []
    u.os.iterate(null, null, op => {
      let json
      if (op.constructor === GC) {
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
      if (op instanceof ItemJSON || op instanceof ItemString) {
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
    t.group(() => {
      t.compare(userArrayValues[i].length, users[i].get('array').length, 'array length correctly computed')
      t.compare(userArrayValues[i], userArrayValues[i + 1], 'array types')
      t.compare(userMapValues[i], userMapValues[i + 1], 'map types')
      t.compare(userXmlValues[i], userXmlValues[i + 1], 'xml types')
      t.compare(userTextValues[i].map(a => a.insert).join('').length, users[i].get('text').length, 'text length correctly computed')
      t.compare(userTextValues[i], userTextValues[i + 1], 'text types')
      t.compare(userQuillValues[i], userQuillValues[i + 1], 'quill delta content')
      t.compare(data[i].os, data[i + 1].os, 'os')
      t.compare(data[i].ds, data[i + 1].ds, 'ds')
      t.compare(data[i].ss, data[i + 1].ss, 'ss')
    }, `Compare user${i} with user${i + 1}`)
  }
  users.forEach(user => {
    if (user._missingStructs.size !== 0) {
      t.fail('missing structs should mes empty!')
    }
  })
  users.map(u => u.destroy())
}

/**
 * @param {string} nodeName
 * @param {Map<string, string>} attrs
 * @return {null|Map<string, string>}
 */
const filter = (nodeName, attrs) => {
  if (nodeName === 'HIDDEN') {
    return null
  }
  attrs.delete('hidden')
  return attrs
}

/**
 * @param {any} t
 * @param {any} opts
 * @return {any}
 */
export const initArrays = (t, opts) => {
  var result = {
    users: []
  }
  var prng = opts.prng || random.createPRNG(t.getSeed())
  const testConnector = new TestConnector(prng)
  result.testConnector = testConnector
  for (let i = 0; i < opts.users; i++) {
    let y = testConnector.createY(i)
    result.users.push(y)
    result['array' + i] = y.define('array', Y.Array)
    result['map' + i] = y.define('map', Y.Map)
    const yxml = y.define('xml', Y.XmlElement)
    result['xml' + i] = yxml
    const dom = document.createElement('my-dom')
    const domBinding = new DomBinding(yxml, dom, { filter })
    result['domBinding' + i] = domBinding
    result['dom' + i] = dom
    const textType = y.define('text', Y.Text)
    result['text' + i] = textType
    const quill = new Quill(document.createElement('div'))
    result['quillBinding' + i] = new QuillBinding(textType, quill)
    result['quill' + i] = quill
    y.quill = quill // put quill on the y object (so we can use it later)
    y.dom = dom
    y.domBinding = domBinding
  }
  testConnector.syncAll()
  return result
}

export const applyRandomTests = (t, mods, iterations) => {
  const prng = random.createPRNG(t.getSeed())
  const result = initArrays(t, { users: 5, prng })
  const { testConnector, users } = result
  for (var i = 0; i < iterations; i++) {
    if (random.int32(prng, 0, 100) <= 2) {
      // 2% chance to disconnect/reconnect a random user
      if (random.bool(prng)) {
        testConnector.disconnectRandom()
      } else {
        testConnector.reconnectRandom()
      }
    } else if (random.int32(prng, 0, 100) <= 1) {
      // 1% chance to flush all & garbagecollect
      // TODO: We do not gc all users as this does not work yet
      // await garbageCollectUsers(t, users)
      testConnector.flushAllMessages()
      // await users[0].db.emptyGarbageCollector() // TODO: reintroduce GC tests!
    } else if (random.int32(prng, 0, 100) <= 50) {
      // 50% chance to flush a random message
      testConnector.flushRandomMessage()
    }
    let user = random.oneOf(prng, users)
    var test = random.oneOf(prng, mods)
    test(t, user, prng)
  }
  compareUsers(t, users)
  return result
}
