
import _Y from '../../yjs/src/y.js'
import yTest from './test-connector.js'

import Chance from 'chance'

export let Y = _Y

export var database = { name: 'memory' }
export var connector = { name: 'test', url: 'http://localhost:1234' }

function getStateSet (y) {
  let ss = {}
  for (let [user, clock] of y.ss.state) {
    ss[user] = clock
  }
  return ss
}

function getDeleteSet (y) {
  var ds = {}
  y.ds.iterate(this, null, null, function (n) {
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

export function attrsObject (dom) {
  let keys = []
  let yxml = dom.__yxml
  for (let i = 0; i < dom.attributes.length; i++) {
    keys.push(dom.attributes[i].name)
  }
  keys = yxml._domFilter(dom, keys)
  let obj = {}
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i]
    obj[key] = dom.getAttribute(key)
  }
  return obj
}

export function domToJson (dom) {
  if (dom.nodeType === document.TEXT_NODE) {
    return dom.textContent
  } else if (dom.nodeType === document.ELEMENT_NODE) {
    let attributes = attrsObject(dom)
    let children = Array.from(dom.childNodes.values())
      .filter(d => d.__yxml !== false)
      .map(domToJson)
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

  var userArrayValues = users.map(u => u.get('array', Y.Array).toJSON())
  var userMapValues = users.map(u => u.get('map', Y.Map).toJSON())
  var userXmlValues = users.map(u => u.get('xml', Y.Xml).getDom().toString())

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
  var data = users.forEach(u => {
    var data = {}
    let ops = []
    y.os.iterate(null, null, function (op) {
      if (!op._deleted) {
        ops.push({
          left: op._left,
          right: op._right,
          deleted: op._deleted
        })
      }
    })

    data.os = {}
    for (let i = 0; i < ops.length; i++) {
      let op = ops[i]
      op = Y.Struct[op.struct].encode(op)
      delete op.origin
      data.os[JSON.stringify(op.id)] = op
    }
    data.ds = getDeleteSet.apply(this)
    data.ss = getStateSet.apply(this)
    return data
  })
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
  users.map(u => u.close())
}

export async function initArrays (t, opts) {
  var result = {
    users: []
  }
  var chance = opts.chance || new Chance(t.getSeed() * 1000000000)
  var conn = Object.assign({ room: 'debugging_' + t.name, generateUserId: false, testContext: t, chance }, connector)
  for (let i = 0; i < opts.users; i++) {
    let connOpts
    if (i === 0) {
      connOpts = Object.assign({ role: 'master' }, conn)
    } else {
      connOpts = Object.assign({ role: 'slave' }, conn)
    }
    let y = new Y({
      connector: connOpts
    })
    result.users.push(y)
    y.get('xml', Y.Xml).setDomFilter(function (d, attrs) {
      if (d.nodeName === 'HIDDEN') {
        return null
      } else {
        return attrs.filter(a => a !== 'hidden')
      }
    })
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

    var flushCounter = users[0].get('flushHelper', Y.Map).get('0') || 0
    flushCounter++
    await Promise.all(users.map(async (u, i) => {
      // wait for all users to set the flush counter to the same value
      await new Promise(resolve => {
        function observer () {
          var allUsersReceivedUpdate = true
          for (var i = 0; i < users.length; i++) {
            if (u.get('flushHelper', Y.Map).get(i + '') !== flushCounter) {
              allUsersReceivedUpdate = false
              break
            }
          }
          if (allUsersReceivedUpdate) {
            resolve()
          }
        }
        u.get('flushHelper', Y.Map).observe(observer)
        u.get('flushHelper').set(i + '', flushCounter)
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
