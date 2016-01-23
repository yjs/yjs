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

g.YConcurrency_TestingMode = true

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000

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
}
/*
  returns a random element of o.
  works on Object, and Array
*/
function getRandom (o) {
  if (o instanceof Array) {
    return o[Math.floor(Math.random() * o.length)]
  } else if (o.constructor === Object) {
    var ks = []
    for (var key in o) {
      ks.push(key)
    }
    return o[getRandom(ks)]
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
  var tokens = 'abcdefäö' // ü\n\n\n\n\n\n\n'
  return tokens[getRandomNumber(tokens.length - 1)]
}
g.getRandomString = getRandomString

function * applyTransactions (relAmount, numberOfTransactions, objects, users, transactions) {
  function randomTransaction (root) {
    var f = getRandom(transactions)
    f(root)
  }
  for (var i = 0; i < numberOfTransactions * relAmount + 1; i++) {
    var r = Math.random()
    if (r >= 0.5) {
      // 50% chance to flush
      yield Y.utils.globalRoom.flushOne() // flushes for some user.. (not necessarily 0)
    } else if (r >= 0.05) {
      // 45% chance to create operation
      randomTransaction(getRandom(objects))
      yield Y.utils.globalRoom.whenTransactionsFinished()
    } else {
      // 5% chance to disconnect/reconnect
      var u = getRandom(users)
      if (u.connector.isDisconnected()) {
        yield u.reconnect()
      } else {
        yield u.disconnect()
      }
    }
  }
}

g.applyRandomTransactionsAllRejoinNoGC = async(function * applyRandomTransactions (users, objects, transactions, numberOfTransactions) {
  yield* applyTransactions(1, numberOfTransactions, objects, users, transactions)
  yield Y.utils.globalRoom.flushAll()
  for (var u in users) {
    yield users[u].reconnect()
  }
  yield Y.utils.globalRoom.flushAll()
  yield g.garbageCollectAllUsers(users)
})

g.applyRandomTransactionsWithGC = async(function * applyRandomTransactions (users, objects, transactions, numberOfTransactions) {
  yield* applyTransactions(1, numberOfTransactions, objects, users.slice(1), transactions)
  yield Y.utils.globalRoom.flushAll()
  yield g.garbageCollectAllUsers(users)
  for (var u in users) {
    // TODO: here, we enforce that two users never sync at the same time with u[0]
    //       enforce that in the connector itself!
    yield users[u].reconnect()
  }
  yield Y.utils.globalRoom.flushAll()
  yield g.garbageCollectAllUsers(users)
})

g.garbageCollectAllUsers = async(function * garbageCollectAllUsers (users) {
  // gc two times because of the two gc phases (really collect everything)
  for (var i in users) {
    yield users[i].db.garbageCollect()
    yield users[i].db.garbageCollect()
  }
})

g.compareAllUsers = async(function * compareAllUsers (users) {
  var s1, s2 // state sets
  var ds1, ds2 // delete sets
  var allDels1, allDels2 // all deletions
  var db1 = [] // operation store of user1

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
  yield Y.utils.globalRoom.flushAll()
  yield g.garbageCollectAllUsers(users)
  yield Y.utils.globalRoom.flushAll()
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
          var o = yield* this.getOperation([d.id[0], d.id[1] + i])
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
          db1.push(o)
        })
      })
    } else {
      // TODO: make requestTransaction return a promise..
      u.db.requestTransaction(function * () {
        yield* t2.call(this)
        expect(s1).toEqual(s2)
        expect(allDels1).toEqual(allDels2) // inner structure
        expect(ds1).toEqual(ds2) // exported structure
        var count = 0
        yield* this.os.iterate(this, null, null, function * (o) {
          o = Y.utils.copyObject(o)
          delete o.origin
          expect(db1[count++]).toEqual(o)
        })
      })
    }
    yield u.db.whenTransactionsFinished()
  }
})

g.createUsers = async(function * createUsers (self, numberOfUsers, database) {
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
        gcTimeout: -1
      },
      connector: {
        name: 'Test',
        debug: false
      },
      share: {
        root: 'Map'
      }
    }))
  }
  self.users = yield Promise.all(promises)
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
