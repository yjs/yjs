
import _Y from '../../yjs/src/y.js'

import yMemory from '../../y-memory/src/y-memory.js'
import yArray from '../../y-array/src/y-array.js'
import yText from '../../y-text/src/Text.js'
import yMap from '../../y-map/src/y-map.js'
import yXml from '../../y-xml/src/y-xml.js'
import yTest from './test-connector.js'

import Chance from 'chance'

export let Y = _Y

Y.extend(yMemory, yArray, yText, yMap, yTest, yXml)

export var database = { name: 'memory' }
export var connector = { name: 'test', url: 'http://localhost:1234' }

function getStateSet () {
  var ss = {}
  this.ss.iterate(this, null, null, function (n) {
    var user = n.id[0]
    var clock = n.clock
    ss[user] = clock
  })
  return ss
}

function getDeleteSet () {
  var ds = {}
  this.ds.iterate(this, null, null, function (n) {
    var user = n.id[0]
    var counter = n.id[1]
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

export async function garbageCollectUsers (t, users) {
  await flushAll(t, users)
  await Promise.all(users.map(u => u.db.emptyGarbageCollector()))
}

export function attrsToObject (attrs) {
  let obj = {}
  for (var i = 0; i < attrs.length; i++) {
    let attr = attrs[i]
    obj[attr.name] = attr.value
  }
  return obj
}

export function domToJson (dom) {
  if (dom.nodeType === document.TEXT_NODE) {
    return dom.textContent
  } else if (dom.nodeType === document.ELEMENT_NODE) {
    let attributes = attrsToObject(dom.attributes)
    let children = Array.from(dom.childNodes.values()).map(domToJson)
    return {
      name: dom.nodeName,
      children: children,
      attributes: attributes
    }
  } else {
    throw new Error('Unsupported node type')
  }
}

/*
 * 1. reconnect and flush all
 * 2. user 0 gc
 * 3. get type content
 * 4. disconnect & reconnect all (so gc is propagated)
 * 5. compare os, ds, ss
 */
export async function compareUsers (t, users) {
  await Promise.all(users.map(u => u.reconnect()))
  if (users[0].connector.testRoom == null) {
    await wait(100)
  }
  await flushAll(t, users)
  await wait()
  await flushAll(t, users)

  var userArrayValues = users.map(u => u.share.array._content.map(c => c.val || JSON.stringify(c.type)))
  function valueToComparable (v) {
    if (v != null && v._model != null) {
      return v._model
    } else {
      return v || null
    }
  }
  var userMapOneValues = users.map(u => u.share.map.get('one')).map(valueToComparable)
  var userMapTwoValues = users.map(u => u.share.map.get('two')).map(valueToComparable)
  var userXmlValues = users.map(u => u.share.xml.getDom()).map(domToJson)

  await users[0].db.garbageCollect()
  await users[0].db.garbageCollect()

  // disconnect all except user 0
  await Promise.all(users.slice(1).map(async u =>
    u.disconnect()
  ))
  if (users[0].connector.testRoom == null) {
    await wait(100)
  }
  // reconnect all
  await Promise.all(users.map(u => u.reconnect()))
  if (users[0].connector.testRoom == null) {
    await wait(100)
  }
  await users[0].connector.testRoom.flushAll(users)
  await Promise.all(users.map(u =>
    new Promise(function (resolve) {
      u.connector.whenSynced(resolve)
    })
  ))
  let filterDeletedOps = users.every(u => u.db.gc === false)
  var data = await Promise.all(users.map(async (u) => {
    var data = {}
    u.db.requestTransaction(function () {
      let ops = []
      this.os.iterate(this, null, null, function (op) {
        ops.push(Y.Struct[op.struct].encode(op))
      })

      data.os = {}
      for (let i = 0; i < ops.length; i++) {
        let op = ops[i]
        op = Y.Struct[op.struct].encode(op)
        delete op.origin
        /*
          If gc = false, it is necessary to filter deleted ops
          as they might have been split up differently..
         */
        if (filterDeletedOps) {
          let opIsDeleted = this.isDeleted(op.id)
          if (!opIsDeleted) {
            data.os[JSON.stringify(op.id)] = op
          }
        } else {
          data.os[JSON.stringify(op.id)] = op
        }
      }
      data.ds = getDeleteSet.apply(this)
      data.ss = getStateSet.apply(this)
    })
    await u.db.whenTransactionsFinished()
    return data
  }))
  for (var i = 0; i < data.length - 1; i++) {
    await t.asyncGroup(async () => {
      t.compare(userArrayValues[i], userArrayValues[i + 1], 'array types')
      t.compare(userMapOneValues[i], userMapOneValues[i + 1], 'map types (propery "one")')
      t.compare(userMapTwoValues[i], userMapTwoValues[i + 1], 'map types (propery "two")')
      t.compare(userXmlValues[i], userXmlValues[i + 1], 'xml types')
      t.compare(data[i].os, data[i + 1].os, 'os')
      t.compare(data[i].ds, data[i + 1].ds, 'ds')
      t.compare(data[i].ss, data[i + 1].ss, 'ss')
    }, `Compare user${i} with user${i + 1}`)
  }
  await Promise.all(users.map(async (u) => {
    await u.close()
  }))
}

export async function initArrays (t, opts) {
  var result = {
    users: []
  }
  var share = Object.assign({ flushHelper: 'Map', array: 'Array', map: 'Map', xml: 'XmlElement("div")' }, opts.share)
  var chance = opts.chance || new Chance(t.getSeed() * 1000000000)
  var conn = Object.assign({ room: 'debugging_' + t.name, generateUserId: false, testContext: t, chance }, connector)
  for (let i = 0; i < opts.users; i++) {
    let dbOpts
    let connOpts
    if (i === 0) {
      // Only one instance can gc!
      dbOpts = Object.assign({ gc: false }, database)
      connOpts = Object.assign({ role: 'master' }, conn)
    } else {
      dbOpts = Object.assign({ gc: false }, database)
      connOpts = Object.assign({ role: 'slave' }, conn)
    }
    let y = await Y({
      connector: connOpts,
      db: dbOpts,
      share: share
    })
    result.users.push(y)
    for (let name in share) {
      result[name + i] = y.share[name]
    }
  }
  result.array0.delete(0, result.array0.length)
  if (result.users[0].connector.testRoom != null) {
    // flush for sync if test-connector
    await result.users[0].connector.testRoom.flushAll(result.users)
  }
  await Promise.all(result.users.map(u => {
    return new Promise(function (resolve) {
      u.connector.whenSynced(resolve)
    })
  }))
  await flushAll(t, result.users)
  return result
}

export async function flushAll (t, users) {
  // users = users.filter(u => u.connector.isSynced)
  if (users.length === 0) {
    return
  }
  await wait(0)
  if (users[0].connector.testRoom != null) {
    // use flushAll method specified in Test Connector
    await users[0].connector.testRoom.flushAll(users)
  } else {
    // flush for any connector
    await Promise.all(users.map(u => { return u.db.whenTransactionsFinished() }))

    var flushCounter = users[0].share.flushHelper.get('0') || 0
    flushCounter++
    await Promise.all(users.map(async (u, i) => {
      // wait for all users to set the flush counter to the same value
      await new Promise(resolve => {
        function observer () {
          var allUsersReceivedUpdate = true
          for (var i = 0; i < users.length; i++) {
            if (u.share.flushHelper.get(i + '') !== flushCounter) {
              allUsersReceivedUpdate = false
              break
            }
          }
          if (allUsersReceivedUpdate) {
            resolve()
          }
        }
        u.share.flushHelper.observe(observer)
        u.share.flushHelper.set(i + '', flushCounter)
      })
    }))
  }
}

export async function flushSome (t, users) {
  if (users[0].connector.testRoom == null) {
    // if not test-connector, wait for some time for operations to arrive
    await wait(100)
  }
}

export function wait (t) {
  return new Promise(function (resolve) {
    setTimeout(resolve, t != null ? t : 100)
  })
}

export async function applyRandomTests (t, mods, iterations) {
  const chance = new Chance(t.getSeed() * 1000000000)
  var initInformation = await initArrays(t, { users: 5, chance: chance })
  let { users } = initInformation
  for (var i = 0; i < iterations; i++) {
    if (chance.bool({likelihood: 10})) {
      // 10% chance to disconnect/reconnect a user
      // we make sure that the first users always is connected
      let user = chance.pickone(users.slice(1))
      if (user.connector.isSynced) {
        if (users.filter(u => u.connector.isSynced).length > 1) {
          // make sure that at least one user remains in the room
          await user.disconnect()
          if (users[0].connector.testRoom == null) {
            await wait(100)
          }
        }
      } else {
        await user.reconnect()
        if (users[0].connector.testRoom == null) {
          await wait(100)
        }
        await new Promise(function (resolve) {
          user.connector.whenSynced(resolve)
        })
      }
    } else if (chance.bool({likelihood: 5})) {
      // 20%*!prev chance to flush all & garbagecollect
      // TODO: We do not gc all users as this does not work yet
      // await garbageCollectUsers(t, users)
      await flushAll(t, users)
      await users[0].db.emptyGarbageCollector()
      await flushAll(t, users)
    } else if (chance.bool({likelihood: 10})) {
      // 20%*!prev chance to flush some operations
      await flushSome(t, users)
    }
    let user = chance.pickone(users)
    var test = chance.pickone(mods)
    test(t, user, chance)
  }
  await compareUsers(t, users)
  return initInformation
}
