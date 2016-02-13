/* global async, databases, describe, beforeEach, afterEach */
/* eslint-env browser,jasmine,console */
'use strict'

var Y = require('./SpecHelper.js')

for (let database of databases) {
  describe(`Database (${database})`, function () {
    var store
    describe('DeleteStore', function () {
      describe('Basic', function () {
        beforeEach(function () {
          store = new Y[database](null, {
            gcTimeout: -1,
            namespace: 'testing'
          })
        })
        afterEach(function (done) {
          store.requestTransaction(function * () {
            yield* this.store.destroy()
            done()
          })
        })
        it('Deleted operation is deleted', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['u1', 10], 1)
            expect(yield* this.isDeleted(['u1', 10])).toBeTruthy()
            expect(yield* this.getDeleteSet()).toEqual({'u1': [[10, 1, false]]})
            done()
          })
        }))
        it('Deleted operation extends other deleted operation', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['u1', 10], 1)
            yield* this.markDeleted(['u1', 11], 1)
            expect(yield* this.isDeleted(['u1', 10])).toBeTruthy()
            expect(yield* this.isDeleted(['u1', 11])).toBeTruthy()
            expect(yield* this.getDeleteSet()).toEqual({'u1': [[10, 2, false]]})
            done()
          })
        }))
        it('Deleted operation extends other deleted operation', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['0', 3], 1)
            yield* this.markDeleted(['0', 4], 1)
            yield* this.markDeleted(['0', 2], 1)
            expect(yield* this.getDeleteSet()).toEqual({'0': [[2, 3, false]]})
            done()
          })
        }))
        it('Debug #1', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['166', 0], 1)
            yield* this.markDeleted(['166', 2], 1)
            yield* this.markDeleted(['166', 0], 1)
            yield* this.markDeleted(['166', 2], 1)
            yield* this.markGarbageCollected(['166', 2], 1)
            yield* this.markDeleted(['166', 1], 1)
            yield* this.markDeleted(['166', 3], 1)
            yield* this.markGarbageCollected(['166', 3], 1)
            yield* this.markDeleted(['166', 0], 1)
            expect(yield* this.getDeleteSet()).toEqual({'166': [[0, 2, false], [2, 2, true]]})
            done()
          })
        }))
        it('Debug #2', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['293', 0], 1)
            yield* this.markDeleted(['291', 2], 1)
            yield* this.markDeleted(['291', 2], 1)
            yield* this.markGarbageCollected(['293', 0], 1)
            yield* this.markDeleted(['293', 1], 1)
            yield* this.markGarbageCollected(['291', 2], 1)
            expect(yield* this.getDeleteSet()).toEqual({'291': [[2, 1, true]], '293': [[0, 1, true], [1, 1, false]]})
            done()
          })
        }))
        it('Debug #3', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['581', 0], 1)
            yield* this.markDeleted(['581', 1], 1)
            yield* this.markDeleted(['580', 0], 1)
            yield* this.markDeleted(['580', 0], 1)
            yield* this.markGarbageCollected(['581', 0], 1)
            yield* this.markDeleted(['581', 2], 1)
            yield* this.markDeleted(['580', 1], 1)
            yield* this.markDeleted(['580', 2], 1)
            yield* this.markDeleted(['580', 1], 1)
            yield* this.markDeleted(['580', 2], 1)
            yield* this.markGarbageCollected(['581', 2], 1)
            yield* this.markGarbageCollected(['581', 1], 1)
            yield* this.markGarbageCollected(['580', 1], 1)
            expect(yield* this.getDeleteSet()).toEqual({'580': [[0, 1, false], [1, 1, true], [2, 1, false]], '581': [[0, 3, true]]})
            done()
          })
        }))
        it('Debug #4', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['544', 0], 1)
            yield* this.markDeleted(['543', 2], 1)
            yield* this.markDeleted(['544', 0], 1)
            yield* this.markDeleted(['543', 2], 1)
            yield* this.markGarbageCollected(['544', 0], 1)
            yield* this.markDeleted(['545', 1], 1)
            yield* this.markDeleted(['543', 4], 1)
            yield* this.markDeleted(['543', 3], 1)
            yield* this.markDeleted(['544', 1], 1)
            yield* this.markDeleted(['544', 2], 1)
            yield* this.markDeleted(['544', 1], 1)
            yield* this.markDeleted(['544', 2], 1)
            yield* this.markGarbageCollected(['543', 2], 1)
            yield* this.markGarbageCollected(['543', 4], 1)
            yield* this.markGarbageCollected(['544', 2], 1)
            yield* this.markGarbageCollected(['543', 3], 1)
            expect(yield* this.getDeleteSet()).toEqual({'543': [[2, 3, true]], '544': [[0, 1, true], [1, 1, false], [2, 1, true]], '545': [[1, 1, false]]})
            done()
          })
        }))
        it('Debug #5', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.applyDeleteSet({'16': [[1, 2, false]], '17': [[0, 1, true], [1, 3, false]]})
            expect(yield* this.getDeleteSet()).toEqual({'16': [[1, 2, false]], '17': [[0, 1, true], [1, 3, false]]})
            yield* this.applyDeleteSet({'16': [[1, 2, false]], '17': [[0, 4, true]]})
            expect(yield* this.getDeleteSet()).toEqual({'16': [[1, 2, false]], '17': [[0, 4, true]]})
            done()
          })
        }))
        it('Debug #6', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.applyDeleteSet({'40': [[0, 3, false]]})
            expect(yield* this.getDeleteSet()).toEqual({'40': [[0, 3, false]]})
            yield* this.applyDeleteSet({'39': [[2, 2, false]], '40': [[0, 1, true], [1, 2, false]], '41': [[2, 1, false]]})
            expect(yield* this.getDeleteSet()).toEqual({'39': [[2, 2, false]], '40': [[0, 1, true], [1, 2, false]], '41': [[2, 1, false]]})
            done()
          })
        }))
        it('Debug #7', async(function * (done) {
          store.requestTransaction(function * () {
            yield* this.markDeleted(['9', 2], 1)
            yield* this.markDeleted(['11', 2], 1)
            yield* this.markDeleted(['11', 4], 1)
            yield* this.markDeleted(['11', 1], 1)
            yield* this.markDeleted(['9', 4], 1)
            yield* this.markDeleted(['10', 0], 1)
            yield* this.markGarbageCollected(['11', 2], 1)
            yield* this.markDeleted(['11', 2], 1)
            yield* this.markGarbageCollected(['11', 3], 1)
            yield* this.markDeleted(['11', 3], 1)
            yield* this.markDeleted(['11', 3], 1)
            yield* this.markDeleted(['9', 4], 1)
            yield* this.markDeleted(['10', 0], 1)
            yield* this.markGarbageCollected(['11', 1], 1)
            yield* this.markDeleted(['11', 1], 1)
            expect(yield* this.getDeleteSet()).toEqual({'9': [[2, 1, false], [4, 1, false]], '10': [[0, 1, false]], '11': [[1, 3, true], [4, 1, false]]})
            done()
          })
        }))
      })
    })
    describe('OperationStore', function () {
      describe('Basic Tests', function () {
        beforeEach(function () {
          store = new Y[database](null, {
            gcTimeout: -1,
            namespace: 'testing'
          })
        })
        afterEach(function (done) {
          store.requestTransaction(function * () {
            yield* this.store.destroy()
            done()
          })
        })
        it('debug #1', function (done) {
          store.requestTransaction(function * () {
            yield* this.os.put({id: [2]})
            yield* this.os.put({id: [0]})
            yield* this.os.delete([2])
            yield* this.os.put({id: [1]})
            expect(yield* this.os.find([0])).toBeTruthy()
            expect(yield* this.os.find([1])).toBeTruthy()
            expect(yield* this.os.find([2])).toBeFalsy()
            done()
          })
        })
        it('can add&retrieve 5 elements', function (done) {
          store.requestTransaction(function * () {
            yield* this.os.put({val: 'four', id: [4]})
            yield* this.os.put({val: 'one', id: [1]})
            yield* this.os.put({val: 'three', id: [3]})
            yield* this.os.put({val: 'two', id: [2]})
            yield* this.os.put({val: 'five', id: [5]})
            expect((yield* this.os.find([1])).val).toEqual('one')
            expect((yield* this.os.find([2])).val).toEqual('two')
            expect((yield* this.os.find([3])).val).toEqual('three')
            expect((yield* this.os.find([4])).val).toEqual('four')
            expect((yield* this.os.find([5])).val).toEqual('five')
            done()
          })
        })
        it('5 elements do not exist anymore after deleting them', function (done) {
          store.requestTransaction(function * () {
            yield* this.os.put({val: 'four', id: [4]})
            yield* this.os.put({val: 'one', id: [1]})
            yield* this.os.put({val: 'three', id: [3]})
            yield* this.os.put({val: 'two', id: [2]})
            yield* this.os.put({val: 'five', id: [5]})
            yield* this.os.delete([4])
            expect(yield* this.os.find([4])).not.toBeTruthy()
            yield* this.os.delete([3])
            expect(yield* this.os.find([3])).not.toBeTruthy()
            yield* this.os.delete([2])
            expect(yield* this.os.find([2])).not.toBeTruthy()
            yield* this.os.delete([1])
            expect(yield* this.os.find([1])).not.toBeTruthy()
            yield* this.os.delete([5])
            expect(yield* this.os.find([5])).not.toBeTruthy()
            done()
          })
        })
      })
      var numberOfOSTests = 1000
      describe(`Random Tests - after adding&deleting (0.8/0.2) ${numberOfOSTests} times`, function () {
        var elements = []
        beforeAll(function (done) {
          store = new Y[database](null, {
            gcTimeout: -1,
            namespace: 'testing'
          })
          store.requestTransaction(function * () {
            for (var i = 0; i < numberOfOSTests; i++) {
              var r = Math.random()
              if (r < 0.8) {
                var obj = [Math.floor(Math.random() * numberOfOSTests * 10000)]
                if (!(yield* this.os.find(obj))) {
                  elements.push(obj)
                  yield* this.os.put({id: obj})
                }
              } else if (elements.length > 0) {
                var elemid = Math.floor(Math.random() * elements.length)
                var elem = elements[elemid]
                elements = elements.filter(function (e) {
                  return !Y.utils.compareIds(e, elem)
                })
                yield* this.os.delete(elem)
              }
            }
            done()
          })
        })
        afterAll(function (done) {
          store.requestTransaction(function * () {
            yield* this.store.destroy()
            done()
          })
        })
        it('can find every object', function (done) {
          store.requestTransaction(function * () {
            for (var id of elements) {
              expect((yield* this.os.find(id)).id).toEqual(id)
            }
            done()
          })
        })

        it('can find every object with lower bound search', function (done) {
          store.requestTransaction(function * () {
            for (var id of elements) {
              var e = yield* this.os.findWithLowerBound(id)
              expect(e.id).toEqual(id)
            }
            done()
          })
        })

        it('iterating over a tree with lower bound yields the right amount of results', function (done) {
          var lowerBound = elements[Math.floor(Math.random() * elements.length)]
          var expectedResults = elements.filter(function (e, pos) {
            return (Y.utils.smaller(lowerBound, e) || Y.utils.compareIds(e, lowerBound)) && elements.indexOf(e) === pos
          }).length

          var actualResults = 0
          store.requestTransaction(function * () {
            yield* this.os.iterate(this, lowerBound, null, function * (val) {
              expect(val).toBeDefined()
              actualResults++
            })
            expect(expectedResults).toEqual(actualResults)
            done()
          })
        })

        it('iterating over a tree without bounds yield the right amount of results', function (done) {
          var lowerBound = null
          var expectedResults = elements.filter(function (e, pos) {
            return elements.indexOf(e) === pos
          }).length
          var actualResults = 0
          store.requestTransaction(function * () {
            yield* this.os.iterate(this, lowerBound, null, function * (val) {
              expect(val).toBeDefined()
              actualResults++
            })
            expect(expectedResults).toEqual(actualResults)
            done()
          })
        })

        it('iterating over a tree with upper bound yields the right amount of results', function (done) {
          var upperBound = elements[Math.floor(Math.random() * elements.length)]
          var expectedResults = elements.filter(function (e, pos) {
            return (Y.utils.smaller(e, upperBound) || Y.utils.compareIds(e, upperBound)) && elements.indexOf(e) === pos
          }).length

          var actualResults = 0
          store.requestTransaction(function * () {
            yield* this.os.iterate(this, null, upperBound, function * (val) {
              expect(val).toBeDefined()
              actualResults++
            })
            expect(expectedResults).toEqual(actualResults)
            done()
          })
        })

        it('iterating over a tree with upper and lower bounds yield the right amount of results', function (done) {
          var b1 = elements[Math.floor(Math.random() * elements.length)]
          var b2 = elements[Math.floor(Math.random() * elements.length)]
          var upperBound, lowerBound
          if (Y.utils.smaller(b1, b2)) {
            lowerBound = b1
            upperBound = b2
          } else {
            lowerBound = b2
            upperBound = b1
          }
          var expectedResults = elements.filter(function (e, pos) {
            return (Y.utils.smaller(lowerBound, e) || Y.utils.compareIds(e, lowerBound)) &&
              (Y.utils.smaller(e, upperBound) || Y.utils.compareIds(e, upperBound)) && elements.indexOf(e) === pos
          }).length
          var actualResults = 0
          store.requestTransaction(function * () {
            yield* this.os.iterate(this, lowerBound, upperBound, function * (val) {
              expect(val).toBeDefined()
              actualResults++
            })
            expect(expectedResults).toEqual(actualResults)
            done()
          })
        })
      })
    })
  })
}
