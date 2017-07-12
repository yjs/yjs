
import _Y from '../../yjs/src/y.js'

import yMemory from '../../y-memory/src/y-memory.js'
import yArray from '../../y-array/src/y-array.js'
import yMap from '../../y-map/src/Map.js'
import yTest from './test-connector.js'

import Chance from 'chance'

export let Y = _Y

Y.extend(yMemory, yArray, yMap, yTest)

export async function garbageCollectUsers (t, users) {
  await flushAll(t, users)
  await Promise.all(users.map(u => u.db.emptyGarbageCollector()))
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

  var userTypeContents = users.map(u => u.share.array._content.map(c => c.val || JSON.stringify(c.type)))

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
    u.db.requestTransaction(function * () {
      var os = yield * this.getOperationsUntransformed()
      data.os = {}
      for (let i = 0; i < os.untransformed.length; i++) {
        let op = os.untransformed[i]
        op = Y.Struct[op.struct].encode(op)
        delete op.origin
        /*
          If gc = false, it is necessary to filter deleted ops
          as they might have been split up differently..
         */
        if (filterDeletedOps) {
          let opIsDeleted = yield * this.isDeleted(op.id)
          if (!opIsDeleted) {
            data.os[JSON.stringify(op.id)] = op
          }
        } else {
          data.os[JSON.stringify(op.id)] = op
        }
      }
      data.ds = yield * this.getDeleteSet()
      data.ss = yield * this.getStateSet()
    })
    await u.db.whenTransactionsFinished()
    return data
  }))
  for (var i = 0; i < data.length - 1; i++) {
    await t.asyncGroup(async () => {
      t.compare(userTypeContents[i], userTypeContents[i + 1], 'types')
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
  var share = Object.assign({ flushHelper: 'Map', array: 'Array' }, opts.share)
  var chance = opts.chance || new Chance(t.getSeed() * 1000000000)
  var connector = Object.assign({ room: 'debugging_' + t.name, generateUserId: false, testContext: t, chance }, opts.connector)
  for (let i = 0; i < opts.users; i++) {
    let dbOpts
    let connOpts
    if (i === 0) {
      // Only one instance can gc!
      dbOpts = Object.assign({ gc: true }, opts.db)
      connOpts = Object.assign({ role: 'master' }, connector)
    } else {
      dbOpts = Object.assign({ gc: false }, opts.db)
      connOpts = Object.assign({ role: 'slave' }, connector)
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
