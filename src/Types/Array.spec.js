/* global createUsers, wait, Y, compareAllUsers, getRandomNumber, applyRandomTransactions, async, garbageCollectAllUsers */
/* eslint-env browser,jasmine */

var numberOfYArrayTests = 10

describe('Array Type', function () {
  var y1, y2, y3, yconfig1, yconfig2, yconfig3, flushAll

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 100
  beforeEach(async(function * (done) {
    yield createUsers(this, 3)
    y1 = (yconfig1 = this.users[0]).root
    y2 = (yconfig2 = this.users[1]).root
    y3 = (yconfig3 = this.users[2]).root
    flushAll = this.users[0].connector.flushAll
    yield wait(10)
    done()
  }))
  afterEach(async(function * (done) {
    yield compareAllUsers(this.users)
    done()
  }))

  describe('Basic tests', function () {
    it('insert three elements, try re-get property', async(function * (done) {
      var array = yield y1.set('Array', Y.Array)
      array.insert(0, [1, 2, 3])
      array = yield y1.get('Array') // re-get property
      expect(array.toArray()).toEqual([1, 2, 3])
      done()
    }))
    it('Basic insert in array (handle three conflicts)', async(function * (done) {
      yield y1.set('Array', Y.Array)
      yield flushAll()
      var l1 = yield y1.get('Array')
      l1.insert(0, [0])
      var l2 = yield y2.get('Array')
      l2.insert(0, [1])
      var l3 = yield y3.get('Array')
      l3.insert(0, [2])
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      expect(l2.toArray()).toEqual(l3.toArray())
      done()
    }))
    it('Basic insert&delete in array (handle three conflicts)', async(function * (done) {
      var l1, l2, l3
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y', 'z'])
      yield flushAll()
      l1.insert(1, [0])
      l2 = yield y2.get('Array')
      l2.delete(0)
      l2.delete(1)
      l3 = yield y3.get('Array')
      l3.insert(1, [2])
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      expect(l2.toArray()).toEqual(l3.toArray())
      expect(l2.toArray()).toEqual([0, 2, 'y'])
      done()
    }))
    it('Handles getOperations ascending ids bug in late sync', async(function * (done) {
      var l1, l2
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y'])
      yield flushAll()
      yconfig3.disconnect()
      yconfig2.disconnect()
      yield wait()
      l2 = yield y2.get('Array')
      l2.insert(1, [2])
      l2.insert(1, [3])
      yield flushAll()
      yconfig2.reconnect()
      yconfig3.reconnect()
      yield wait()
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      done()
    }))
    it('Handles deletions in late sync', async(function * (done) {
      var l1, l2
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y'])
      yield flushAll()
      yconfig2.disconnect()
      yield wait()
      l2 = yield y2.get('Array')
      l2.delete(1, 1)
      l1.delete(0, 2)
      yield flushAll()
      yconfig2.reconnect()
      yield wait()
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      done()
    }))
    it('Handles deletions in late sync (2)', async(function * (done) {
      var l1, l2
      l1 = yield y1.set('Array', Y.Array)
      yield flushAll()
      l2 = yield y2.get('Array')
      l1.insert(0, ['x', 'y'])
      l1.delete(0, 2)
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      done()
    }))
    it('Basic insert. Then delete the whole array', async(function * (done) {
      var l1, l2, l3
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y', 'z'])
      yield flushAll()
      l1.delete(0, 3)
      l2 = yield y2.get('Array')
      l3 = yield y3.get('Array')
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      expect(l2.toArray()).toEqual(l3.toArray())
      expect(l2.toArray()).toEqual([])
      done()
    }))
    it('Basic insert. Then delete the whole array (merge listeners on late sync)', async(function * (done) {
      var l1, l2, l3
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y', 'z'])
      yield flushAll()
      yconfig2.disconnect()
      l1.delete(0, 3)
      l2 = yield y2.get('Array')
      yield wait()
      yconfig2.reconnect()
      yield wait()
      l3 = yield y3.get('Array')
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      expect(l2.toArray()).toEqual(l3.toArray())
      expect(l2.toArray()).toEqual([])
      done()
    }))
    it('Basic insert. Then delete the whole array (merge deleter on late sync)', async(function * (done) {
      var l1, l2, l3
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y', 'z'])
      yield flushAll()
      yconfig1.disconnect()
      l1.delete(0, 3)
      l2 = yield y2.get('Array')
      yconfig1.reconnect()
      l3 = yield y3.get('Array')
      yield flushAll()
      expect(l1.toArray()).toEqual(l2.toArray())
      expect(l2.toArray()).toEqual(l3.toArray())
      expect(l2.toArray()).toEqual([])
      done()
    }))
    it('throw insert & delete events', async(function * (done) {
      var array = yield this.users[0].root.set('array', Y.Array)
      var event
      array.observe(function (e) {
        event = e
      })
      array.insert(0, [0])
      expect(event).toEqual([{
        type: 'insert',
        object: array,
        index: 0,
        length: 1
      }])
      array.delete(0)
      expect(event).toEqual([{
        type: 'delete',
        object: array,
        index: 0,
        length: 1
      }])
      yield wait(50)
      done()
    }))
    it('garbage collects', async(function * (done) {
      var l1, l2, l3
      l1 = yield y1.set('Array', Y.Array)
      l1.insert(0, ['x', 'y', 'z'])
      yield flushAll()
      yconfig1.disconnect()
      l1.delete(0, 3)
      l2 = yield y2.get('Array')
      yield wait()
      yconfig1.reconnect()
      yield wait()
      l3 = yield y3.get('Array')
      yield flushAll()
      yield garbageCollectAllUsers(this.users)
      yconfig1.db.logTable()
      expect(l1.toArray()).toEqual(l2.toArray())
      expect(l2.toArray()).toEqual(l3.toArray())
      expect(l2.toArray()).toEqual([])
      done()
    }))
  })
  describe(`Random tests`, function () {
    var randomArrayTransactions = [
      function insert (array) {
        array.insert(getRandomNumber(array.toArray().length), [getRandomNumber()])
      },
      function _delete (array) {
        var length = array.toArray().length
        if (length > 0) {
          array.delete(getRandomNumber(length - 1))
        }
      }
    ]
    function compareArrayValues (arrays) {
      var firstArray
      for (var l of arrays) {
        var val = l.toArray()
        if (firstArray == null) {
          firstArray = val
        } else {
          expect(val).toEqual(firstArray)
        }
      }
    }
    beforeEach(async(function * (done) {
      yield this.users[0].root.set('Array', Y.Array)
      yield flushAll()

      var promises = []
      for (var u = 0; u < this.users.length; u++) {
        promises.push(this.users[u].root.get('Array'))
      }
      this.arrays = yield Promise.all(promises)
      done()
    }))
    it('arrays.length equals users.length', async(function * (done) { // eslint-disable-line
      expect(this.arrays.length).toEqual(this.users.length)
      done()
    }))
    it(`succeed after ${numberOfYArrayTests} actions`, async(function * (done) {
      for (var u of this.users) {
        u.connector.debug = true
      }
      yield applyRandomTransactions(this.users, this.arrays, randomArrayTransactions, numberOfYArrayTests)
      yield flushAll()
      yield compareArrayValues(this.arrays)
      done()
    }))
  })
})
