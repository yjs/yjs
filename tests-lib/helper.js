
import _Y from '../src/Y.js'
import yTest from './test-connector.js'

import Chance from 'chance'
import ItemJSON from '../src/Struct/ItemJSON.js'
import ItemString from '../src/Struct/ItemString.js'
import { defragmentItemContent } from '../src/Util/defragmentItemContent.js'

export const Y = _Y

Y.extend(yTest)

export const database = { name: 'memory' }
export const connector = { name: 'test', url: 'http://localhost:1234' }

function getStateSet (y) {
  let ss = {}
  for (let [user, clock] of y.ss.state) {
    ss[user] = clock
  }
  return ss
}

function getDeleteSet (y) {
  var ds = {}
  y.ds.iterate(null, null, function (n) {
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

export function attrsObject (dom) {
  let keys = []
  let yxml = dom._yxml
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
      .filter(d => d._yxml !== false)
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
  await wait()
  await flushAll(t, users)
  await wait()
  await flushAll(t, users)

  var userArrayValues = users.map(u => u.get('array', Y.Array).toJSON().map(val => JSON.stringify(val)))
  var userMapValues = users.map(u => u.get('map', Y.Map).toJSON())
  var userXmlValues = users.map(u => u.get('xml', Y.Xml).toString())

  var data = users.map(u => {
    defragmentItemContent(u)
    var data = {}
    let ops = []
    u.os.iterate(null, null, function (op) {
      const json = {
        id: op._id,
        left: op._left === null ? null : op._left._lastId,
        right: op._right === null ? null : op._right._id,
        length: op._length,
        deleted: op._deleted,
        parent: op._parent._id
      }
      if (op instanceof ItemJSON || op instanceof ItemString) {
        json.content = op._content
      }
      ops.push(json)
    })
    data.os = ops
    data.ds = getDeleteSet(u)
    data.ss = getStateSet(u)
    return data
  })
  for (var i = 0; i < data.length - 1; i++) {
    await t.asyncGroup(async () => {
      t.compare(userArrayValues[i], userArrayValues[i + 1], 'array types')
      t.compare(userMapValues[i], userMapValues[i + 1], 'map types')
      t.compare(userXmlValues[i], userXmlValues[i + 1], 'xml types')
      t.compare(data[i].os, data[i + 1].os, 'os')
      t.compare(data[i].ds, data[i + 1].ds, 'ds')
      t.compare(data[i].ss, data[i + 1].ss, 'ss')
    }, `Compare user${i} with user${i + 1}`)
  }
  users.map(u => u.destroy())
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
    let y = new Y(connOpts.room, {
      _userID: i, // evil hackery, don't try this at home
      connector: connOpts
    })
    result.users.push(y)
    result['array' + i] = y.define('array', Y.Array)
    result['map' + i] = y.define('map', Y.Map)
    result['xml' + i] = y.define('xml', Y.XmlElement)
    y.get('xml').setDomFilter(function (nodeName, attrs) {
      if (nodeName === 'HIDDEN') {
        return null
      }
      attrs.delete('hidden')
      return attrs
    })
    y.on('afterTransaction', function () {
      for (let missing of y._missingStructs.values()) {
        if (Array.from(missing.values()).length > 0) {
          console.error(new Error('Test check in "afterTransaction": missing should be empty!'))
        }
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
  await wait(10)
  if (users[0].connector.testRoom != null) {
    // use flushAll method specified in Test Connector
    await users[0].connector.testRoom.flushAll(users)
  } else {
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
      // await users[0].db.emptyGarbageCollector()
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
