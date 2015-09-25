/* global createUsers, Y, compareAllUsers, getRandomNumber, applyRandomTransactions, async, describeManyTimes */
/* eslint-env browser,jasmine */

var numberOfYMapTests = 70
var repeatMapTeasts = 1

describe('Map Type', function () {
  var y1, y2, y3, y4, flushAll

  beforeEach(async(function * (done) {
    yield createUsers(this, 5)
    y1 = this.users[0].root
    y2 = this.users[1].root
    y3 = this.users[2].root
    y4 = this.users[3].root
    flushAll = this.users[0].connector.flushAll
    done()
  }))
  afterEach(async(function * (done) {
    yield compareAllUsers(this.users)
    done()
  }), 5000)

  describe('Basic tests', function () {
    it('Basic get&set of Map property (converge via sync)', async(function * (done) {
      y1.set('stuff', 'stuffy')
      expect(y1.get('stuff')).toEqual('stuffy')
      yield flushAll()
      for (var key in this.users) {
        var u = this.users[key].root
        expect(u.get('stuff')).toEqual('stuffy')
      }
      done()
    }))
    it('Map can set custom types (Map)', async(function * (done) {
      var map = yield y1.set('Map', Y.Map)
      map.set('one', 1)
      map = yield y1.get('Map')
      expect(map.get('one')).toEqual(1)
      done()
    }))
    it('Map can set custom types (Array)', async(function * (done) {
      var array = yield y1.set('Array', Y.Array)
      array.insert(0, [1, 2, 3])
      array = yield y1.get('Array')
      expect(array.toArray()).toEqual([1, 2, 3])
      done()
    }))
    it('Basic get&set of Map property (converge via update)', async(function * (done) {
      yield flushAll()
      y1.set('stuff', 'stuffy')
      expect(y1.get('stuff')).toEqual('stuffy')

      yield flushAll()
      for (var key in this.users) {
        var r = this.users[key].root
        expect(r.get('stuff')).toEqual('stuffy')
      }
      done()
    }))
    it('Basic get&set of Map property (handle conflict)', async(function * (done) {
      yield flushAll()
      y1.set('stuff', 'c0')
      y2.set('stuff', 'c1')

      yield flushAll()
      for (var key in this.users) {
        var u = this.users[key]
        expect(u.root.get('stuff')).toEqual('c0')
      }
      done()
    }))
    it('Basic get&set&delete of Map property (handle conflict)', async(function * (done) {
      yield flushAll()
      y1.set('stuff', 'c0')
      y1.delete('stuff')
      y2.set('stuff', 'c1')
      yield flushAll()

      for (var key in this.users) {
        var u = this.users[key]
        expect(u.root.get('stuff')).toBeUndefined()
      }
      done()
    }))
    it('Basic get&set of Map property (handle three conflicts)', async(function * (done) {
      yield flushAll()
      y1.set('stuff', 'c0')
      y2.set('stuff', 'c1')
      y2.set('stuff', 'c2')
      y3.set('stuff', 'c3')
      yield flushAll()

      for (var key in this.users) {
        var u = this.users[key]
        expect(u.root.get('stuff')).toEqual('c0')
      }
      done()
    }))
    it('Basic get&set&delete of Map property (handle three conflicts)', async(function * (done) {
      yield flushAll()
      y1.set('stuff', 'c0')
      y2.set('stuff', 'c1')
      y2.set('stuff', 'c2')
      y3.set('stuff', 'c3')
      yield flushAll()
      y1.set('stuff', 'deleteme')
      y1.delete('stuff')
      y2.set('stuff', 'c1')
      y3.set('stuff', 'c2')
      y4.set('stuff', 'c3')
      yield flushAll()

      for (var key in this.users) {
        var u = this.users[key]
        expect(u.root.get('stuff')).toBeUndefined()
      }
      done()
    }))
    it('throws add & update & delete events (with type and primitive content)', async(function * (done) {
      var event
      yield flushAll()
      y1.observe(function (e) {
        event = e // just put it on event, should be thrown synchronously anyway
      })
      y1.set('stuff', 4)
      expect(event).toEqual([{
        type: 'add',
        object: y1,
        name: 'stuff'
      }])
      // update, oldValue is in contents
      yield y1.set('stuff', Y.Array)
      expect(event).toEqual([{
        type: 'update',
        object: y1,
        name: 'stuff',
        oldValue: 4
      }])
      y1.get('stuff').then(function (replacedArray) {
        // update, oldValue is in opContents
        y1.set('stuff', 5)
        var getYArray = event[0].oldValue
        expect(typeof getYArray.constructor === 'function').toBeTruthy()
        getYArray().then(function (array) {
          expect(array).toEqual(replacedArray)

          // delete
          y1.delete('stuff')
          expect(event).toEqual([{
            type: 'delete',
            name: 'stuff',
            object: y1,
            oldValue: 5
          }])
          done()
        })
      })
    }))
  })
  describeManyTimes(repeatMapTeasts, `${numberOfYMapTests} Random tests`, function () {
    var randomMapTransactions = [
      function set (map) {
        map.set('somekey', getRandomNumber())
      },
      function delete_ (map) {
        map.delete('somekey')
      }
    ]
    function compareMapValues (maps) {
      var firstMap
      for (var map of maps) {
        var val = map.get()
        if (firstMap == null) {
          firstMap = val
        } else {
          expect(val).toEqual(firstMap)
        }
      }
    }
    beforeEach(async(function * (done) {
      yield y1.set('Map', Y.Map)
      yield flushAll()

      var promises = []
      for (var u = 0; u < this.users.length; u++) {
        promises.push(this.users[u].root.get('Map'))
      }
      this.maps = yield Promise.all(promises)
      done()
    }))
    it(`succeed after ${numberOfYMapTests} actions`, async(function * (done) {
      yield applyRandomTransactions(this.users, this.maps, randomMapTransactions, numberOfYMapTests)
      yield flushAll()
      yield compareMapValues(this.maps)
      done()
    }))
  })
})
