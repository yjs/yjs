/* global Y */
/* eslint-env browser, jasmine */

/*
  This is just a compilation of functions that help to test this library!
***/

var g
if (typeof global !== 'undefined') {
  g = global
} else if (typeof window !== 'undefined') {
  g = window
} else {
  throw new Error('No global object?')
}
g.g = g

function wait (t) {
  if (t == null) {
    t = 10
  }
  var def = Promise.defer()
  setTimeout(function () {
    def.resolve()
  }, t)
  return def.promise
}
g.wait = wait

// returns a random element of o
// works on Object, and Array
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

function getRandomNumber(n) {//eslint-disable-line
  if (n == null) {
    n = 9999
  }
  return Math.floor(Math.random() * n)
}
g.getRandomNumber = getRandomNumber

g.applyRandomTransactions = async(function * applyRandomTransactions (users, objects, transactions, numberOfTransactions) { //eslint-disable-line
  function randomTransaction (root) {
    var f = getRandom(transactions)
    f(root)
  }
  function applyTransactions () {
    for (var i = 0; i < numberOfTransactions / 2 + 1; i++) {
      var r = Math.random()
      if (r >= 0.9) {
        // 10% chance to flush
        users[0].connector.flushOne()
      } else {
        randomTransaction(getRandom(objects))
      }
      wait()
    }
  }
  applyTransactions()
  yield users[0].connector.flushAll()
  users[0].disconnect()
  yield wait()
  applyTransactions()
  yield users[0].connector.flushAll()
  users[0].reconnect()
  yield wait()
  yield users[0].connector.flushAll()
})

g.garbageCollectAllUsers = async(function * garbageCollectAllUsers (users) {
  for (var i in users) {
    yield users[i].db.garbageCollect()
    yield users[i].db.garbageCollect()
  }
})

g.compareAllUsers = async(function * compareAllUsers (users) { //eslint-disable-line
  var s1, s2, ds1, ds2, allDels1, allDels2
  var db1 = []
  function * t1 () {
    s1 = yield* this.getStateSet()
    ds1 = yield* this.getDeleteSet()
    allDels1 = []
    this.ds.iterate(null, null, function (d) {
      allDels1.push(d)
    })
  }
  function * t2 () {
    s2 = yield* this.getStateSet()
    ds2 = yield* this.getDeleteSet()
    allDels2 = []
    this.ds.iterate(null, null, function (d) {
      allDels2.push(d)
    })
  }
  yield users[0].connector.flushAll()
  yield g.garbageCollectAllUsers(users)
  yield wait(200)
  yield g.garbageCollectAllUsers(users)
  yield wait(200)
  for (var uid = 0; uid < users.length; uid++) {
    var u = users[uid]
    // compare deleted ops against deleteStore
    u.db.os.iterate(null, null, function (o) {
      if (o.deleted === true) {
        expect(u.db.ds.isDeleted(o.id)).toBeTruthy()
      }
    })
    // compare deleteStore against deleted ops
    u.db.requestTransaction(function * () {
      var ds = []
      u.db.ds.iterate(null, null, function (d) {
        ds.push(d)
      })
      for (var j in ds) {
        var d = ds[j]
        for (var i = 0; i < d.len; i++) {
          var o = yield* this.getOperation([d.id[0], d.id[1] + i])
          // gc'd or deleted
          expect(o == null || o.deleted).toBeTruthy()
        }
      }
    })
    // compare allDels tree
    yield wait()
    if (s1 == null) {
      u.db.requestTransaction(t1)
      yield wait()
      u.db.os.iterate(null, null, function(o){//eslint-disable-line
        db1.push(o)
      })
    } else {
      u.db.requestTransaction(t2)
      yield wait()
      expect(s1).toEqual(s2)
      expect(allDels1).toEqual(allDels2) // inner structure
      expect(ds1).toEqual(ds2) // exported structure
      var count = 0
      u.db.os.iterate(null, null, function(o){//eslint-disable-line
        expect(db1[count++]).toEqual(o)
      })
    }
  }
})

g.createUsers = async(function * createUsers (self, numberOfUsers) { //eslint-disable-line
  if (Y.utils.globalRoom.users[0] != null) {//eslint-disable-line
    yield Y.utils.globalRoom.users[0].flushAll()//eslint-disable-line
  }
  // destroy old users
  for (var u in Y.utils.globalRoom.users) {//eslint-disable-line
    Y.utils.globalRoom.users[u].y.destroy()//eslint-disable-line
  }
  self.users = []

  var promises = []
  for (var i = 0; i < numberOfUsers; i++) {
    promises.push(Y({
      db: {
        name: 'Memory',
        gcTimeout: -1
      },
      connector: {
        name: 'Test',
        debug: false
      }
    }))
  }
  self.users = yield Promise.all(promises)
})

function async (makeGenerator) {
  return function (arg) {
    var generator = makeGenerator.apply(this, arguments)

    function handle (result) {
      // result => { done: [Boolean], value: [Object] }
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
      return Promise.reject(ex)
    }
  }
}
g.wrapCo = async
