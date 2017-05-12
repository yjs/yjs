/* eslint-env browser, jasmine */

/*
  This is just a compilation of functions that help to test this library!
*/

// When testing, you store everything on the global object. We call it g

var Y = require('./y.js')
require('../../y-memory/src/Memory.js')(Y)
require('../../y-array/src/Array.js')(Y)
require('../../y-map/src/Map.js')(Y)
require('../../y-indexeddb/src/IndexedDB.js')(Y)

module.exports = Y

var g
if (typeof global !== 'undefined') {
  g = global
} else if (typeof window !== 'undefined') {
  g = window
} else {
  throw new Error('No global object?')
}
g.g = g

// Helper methods for the random number generator
Math.seedrandom = require('seedrandom')

g.generateRandomSeed = function generateRandomSeed () {
  var seed
  if (typeof window !== 'undefined' && window.location.hash.length > 1) {
    seed = window.location.hash.slice(1) // first character is the hash!
    console.warn('Using random seed that was specified in the url!')
  } else {
    seed = JSON.stringify(Math.random())
  }
  console.info('Using random seed: ' + seed)
  g.setRandomSeed(seed)
}

g.setRandomSeed = function setRandomSeed (seed) {
  Math.seedrandom.currentSeed = seed
  Math.seedrandom(Math.seedrandom.currentSeed, { global: true })
}

g.generateRandomSeed()

g.YConcurrency_TestingMode = true

jasmine.DEFAULT_TIMEOUT_INTERVAL = 200000

g.describeManyTimes = function describeManyTimes (times, name, f) {
  for (var i = 0; i < times; i++) {
    describe(name, f)
  }
}

/*
  Wait for a specified amount of time (in ms). defaults to 5ms
*/
function wait (t) {
  if (t == null) {
    t = 0
  }
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve()
    }, t)
  })
}
g.wait = wait

g.databases = ['memory']
if (typeof window !== 'undefined') {
  g.databases.push('indexeddb')
} else {
  g.databases.push('leveldb')
}
/*
  returns a random element of o.
  works on Object, and Array
*/
function getRandom (o) {
  if (o instanceof Array) {
    return o[Math.floor(Math.random() * o.length)]
  } else if (o.constructor === Object) {
    return o[getRandom(Object.keys(o))]
  }
}
g.getRandom = getRandom

function getRandomNumber (n) {
  if (n == null) {
    n = 9999
  }
  return Math.floor(Math.random() * n)
}
g.getRandomNumber = getRandomNumber

function getRandomString () {
  var chars = 'abcdefghijklmnopqrstuvwxyzäüöABCDEFGHIJKLMNOPQRSTUVWXYZÄÜÖ'
  var char = chars[getRandomNumber(chars.length)] // ü\n\n\n\n\n\n\n'
  var length = getRandomNumber(7)
  var string = ''
  for (var i = 0; i < length; i++) {
    string += char
  }
  return string
}
g.getRandomString = getRandomString

function * applyTransactions (relAmount, numberOfTransactions, objects, users, transactions, noReconnect) {
  g.generateRandomSeed() // create a new seed, so we can re-create the behavior
  for (var i = 0; i < numberOfTransactions * relAmount + 1; i++) {
    var r = Math.random()
    if (r > 0.95) {
      // 10% chance of toggling concurrent user interactions.
      // There will be an artificial delay until ops can be executed by the type,
      // therefore, operations of the database will be (pre)transformed until user operations arrive
      yield (function simulateConcurrentUserInteractions (type) {
        if (!(type instanceof Y.utils.CustomType) && type.y instanceof Y.utils.CustomType) {
          // usually we expect type to be a custom type. But in YXml we share an object {y: YXml, dom: Dom} instead
          type = type.y
        }
        if (type.eventHandler.awaiting === 0 && type.eventHandler._debuggingAwaiting !== true) {
          type.eventHandler.awaiting = 1
          type.eventHandler._debuggingAwaiting = true
        } else {
          // fixAwaitingInType will handle _debuggingAwaiting
          return fixAwaitingInType(type)
        }
      })(getRandom(objects))
    } else if (r >= 0.5) {
      // 40% chance to flush
      yield Y.utils.globalRoom.flushOne() // flushes for some user.. (not necessarily 0)
    } else if (noReconnect || r >= 0.05) {
      // 45% chance to create operation
      var done = getRandom(transactions)(getRandom(objects))
      if (done != null) {
        yield done
      } else {
        yield wait()
      }
      yield Y.utils.globalRoom.whenTransactionsFinished()
    } else {
      // 5% chance to disconnect/reconnect
      var u = getRandom(users)
      yield Promise.all(objects.map(fixAwaitingInType))
      if (u.connector.isDisconnected()) {
        yield u.reconnect()
      } else {
        yield u.disconnect()
      }
      yield Promise.all(objects.map(fixAwaitingInType))
    }
  }
}

function fixAwaitingInType (type) {
  if (!(type instanceof Y.utils.CustomType) && type.y instanceof Y.utils.CustomType) {
    // usually we expect type to be a custom type. But in YXml we share an object {y: YXml, dom: Dom} instead
    type = type.y
  }
  return new Promise(function (resolve) {
    type.os.whenTransactionsFinished().then(function () {
      // _debuggingAwaiting artificially increases the awaiting property. We need to make sure that we only do that once / reverse the effect once
      type.os.requestTransaction(function * () {
        if (type.eventHandler.awaiting > 0 && type.eventHandler._debuggingAwaiting === true) {
          type.eventHandler._debuggingAwaiting = false
          yield* type.eventHandler.awaitOps(this, function * () { /* mock function */ })
        }
        wait(50).then(type.os.whenTransactionsFinished()).then(wait(50)).then(resolve)
      })
    })
  })
}
g.fixAwaitingInType = fixAwaitingInType

g.applyRandomTransactionsNoGCNoDisconnect = async(function * applyRandomTransactions (users, objects, transactions, numberOfTransactions) {
  yield* applyTransactions(1, numberOfTransactions, objects, users, transactions, true)
  yield Y.utils.globalRoom.flushAll()
  yield Promise.all(objects.map(fixAwaitingInType))
})

g.applyRandomTransactionsAllRejoinNoGC = async(function * applyRandomTransactions (users, objects, transactions, numberOfTransactions) {
  yield* applyTransactions(1, numberOfTransactions, objects, users, transactions)
  yield Promise.all(objects.map(fixAwaitingInType))
  yield Y.utils.globalRoom.flushAll()
  yield Promise.all(objects.map(fixAwaitingInType))
  for (var u in users) {
    yield Promise.all(objects.map(fixAwaitingInType))
    yield users[u].reconnect()
    yield Promise.all(objects.map(fixAwaitingInType))
  }
  yield Promise.all(objects.map(fixAwaitingInType))
  yield Y.utils.globalRoom.flushAll()
  yield Promise.all(objects.map(fixAwaitingInType))
  yield g.garbageCollectAllUsers(users)
})

g.applyRandomTransactionsWithGC = async(function * applyRandomTransactions (users, objects, transactions, numberOfTransactions) {
  yield* applyTransactions(1, numberOfTransactions, objects, users.slice(1), transactions)
  yield Y.utils.globalRoom.flushAll()
  yield Promise.all(objects.map(fixAwaitingInType))
  for (var u in users) {
    // TODO: here, we enforce that two users never sync at the same time with u[0]
    //       enforce that in the connector itself!
    yield users[u].reconnect()
  }
  yield Y.utils.globalRoom.flushAll()
  yield Promise.all(objects.map(fixAwaitingInType))
  yield g.garbageCollectAllUsers(users)
})

g.garbageCollectAllUsers = async(function * garbageCollectAllUsers (users) {
  yield Y.utils.globalRoom.flushAll()
  for (var i in users) {
    yield users[i].db.emptyGarbageCollector()
  }
})

g.compareAllUsers = async(function * compareAllUsers (users) {
  var s1, s2 // state sets
  var ds1, ds2 // delete sets
  var allDels1, allDels2 // all deletions
  var db1 = [] // operation store of user1

  yield Y.utils.globalRoom.flushAll()
  yield g.garbageCollectAllUsers(users)
  yield Y.utils.globalRoom.flushAll()

  // disconnect, then reconnect all users
  // We do this to make sure that the gc is updated by everyone
  for (var i = 0; i < users.length; i++) {
    yield users[i].disconnect()
    yield wait()
    yield users[i].reconnect()
  }
  yield wait()
  yield Y.utils.globalRoom.flushAll()

  // t1 and t2 basically do the same. They define t[1,2], ds[1,2], and allDels[1,2]
  function * t1 () {
    s1 = yield* this.getStateSet()
    ds1 = yield* this.getDeleteSet()
    allDels1 = []
    yield* this.ds.iterate(this, null, null, function * (d) {
      allDels1.push(d)
    })
  }
  function * t2 () {
    s2 = yield* this.getStateSet()
    ds2 = yield* this.getDeleteSet()
    allDels2 = []
    yield* this.ds.iterate(this, null, null, function * (d) {
      allDels2.push(d)
    })
  }

  var buffer = Y.utils.globalRoom.buffers
  for (var name in buffer) {
    if (buffer[name].length > 0) {
      // not all ops were transmitted..
      debugger // eslint-disable-line
    }
  }

  for (var uid = 0; uid < users.length; uid++) {
    var u = users[uid]
    u.db.requestTransaction(function * () {
      var sv = yield* this.getStateVector()
      for (var s of sv) {
        yield* this.updateState(s.user)
      }
      // compare deleted ops against deleteStore
      yield* this.os.iterate(this, null, null, function * (o) {
        if (o.deleted === true) {
          expect(yield* this.isDeleted(o.id)).toBeTruthy()
        }
      })
      // compare deleteStore against deleted ops
      var ds = []
      yield* this.ds.iterate(this, null, null, function * (d) {
        ds.push(d)
      })
      for (var j in ds) {
        var d = ds[j]
        for (var i = 0; i < d.len; i++) {
          var o = yield* this.getInsertion([d.id[0], d.id[1] + i])
          // gc'd or deleted
          if (d.gc) {
            expect(o).toBeFalsy()
          } else {
            expect(o.deleted).toBeTruthy()
          }
        }
      }
    })
    // compare allDels tree
    if (s1 == null) {
      u.db.requestTransaction(function * () {
        yield* t1.call(this)
        yield* this.os.iterate(this, null, null, function * (o) {
          o = Y.utils.copyObject(o)
          delete o.origin
          delete o.originOf
          db1.push(o)
        })
      })
    } else {
      u.db.requestTransaction(function * () {
        yield* t2.call(this)
        var db2 = []
        yield* this.os.iterate(this, null, null, function * (o) {
          o = Y.utils.copyObject(o)
          delete o.origin
          delete o.originOf
          db2.push(o)
        })
        expect(s1).toEqual(s2)
        expect(allDels1).toEqual(allDels2) // inner structure
        expect(ds1).toEqual(ds2) // exported structure
        db2.forEach((o, i) => {
          expect(db1[i]).toEqual(o)
        })
      })
    }
    yield u.db.whenTransactionsFinished()
  }
})

g.createUsers = async(function * createUsers (self, numberOfUsers, database, initType) {
  if (Y.utils.globalRoom.users[0] != null) {
    yield Y.utils.globalRoom.flushAll()
  }
  // destroy old users
  for (var u in Y.utils.globalRoom.users) {
    Y.utils.globalRoom.users[u].y.destroy()
  }
  self.users = null

  var promises = []
  for (var i = 0; i < numberOfUsers; i++) {
    promises.push(Y({
      db: {
        name: database,
        namespace: 'User ' + i,
        cleanStart: true,
        gcTimeout: -1,
        gc: true,
        repairCheckInterval: -1
      },
      connector: {
        name: 'Test',
        debug: false
      },
      share: {
        root: initType || 'Map'
      }
    }))
  }
  self.users = yield Promise.all(promises)
  self.types = self.users.map(function (u) { return u.share.root })
  return self.users
})

/*
  Until async/await arrives in js, we use this function to wait for promises
  by yielding them.
*/
function async (makeGenerator) {
  return function (arg) {
    var generator = makeGenerator.apply(this, arguments)

    function handle (result) {
      if (result.done) return Promise.resolve(result.value)

      return Promise.resolve(result.value).then(function (res) {
        return handle(generator.next(res))
      }, function (err) {
        return handle(generator.throw(err))
      })
    }
    try {
      return handle(generator.next())
    } catch (ex) {
      generator.throw(ex)
      // return Promise.reject(ex)
    }
  }
}
g.async = async

function logUsers (self) {
  if (self.constructor === Array) {
    self = {users: self}
  }
  self.users[0].db.logTable()
  self.users[1].db.logTable()
  self.users[2].db.logTable()
}

g.logUsers = logUsers
