/* global Y, async */
/* eslint-env browser,jasmine,console */

describe('Memory', function () {
  describe('DeleteStore', function () {
    var store
    beforeEach(function () {
      store = new Y.Memory(null, {
        name: 'Memory',
        gcTimeout: -1
      })
    })
    it('Deleted operation is deleted', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['u1', 10])
        expect(yield* this.isDeleted(['u1', 10])).toBeTruthy()
        expect(yield* this.getDeleteSet()).toEqual({'u1': [[10, 1, false]]})
        done()
      })
    }))
    it('Deleted operation extends other deleted operation', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['u1', 10])
        yield* this.markDeleted(['u1', 11])
        expect(yield* this.isDeleted(['u1', 10])).toBeTruthy()
        expect(yield* this.isDeleted(['u1', 11])).toBeTruthy()
        expect(yield* this.getDeleteSet()).toEqual({'u1': [[10, 2, false]]})
        done()
      })
    }))
    it('Deleted operation extends other deleted operation', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['0', 3])
        yield* this.markDeleted(['0', 4])
        yield* this.markDeleted(['0', 2])
        expect(yield* this.getDeleteSet()).toEqual({'0': [[2, 3, false]]})
        done()
      })
    }))
    it('Debug #1', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['166', 0])
        yield* this.markDeleted(['166', 2])
        yield* this.markDeleted(['166', 0])
        yield* this.markDeleted(['166', 2])
        yield* this.markGarbageCollected(['166', 2])
        yield* this.markDeleted(['166', 1])
        yield* this.markDeleted(['166', 3])
        yield* this.markGarbageCollected(['166', 3])
        yield* this.markDeleted(['166', 0])
        expect(yield* this.getDeleteSet()).toEqual({'166': [[0, 2, false], [2, 2, true]]})
        done()
      })
    }))
    it('Debug #2', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['293', 0])
        yield* this.markDeleted(['291', 2])
        yield* this.markDeleted(['291', 2])
        yield* this.markGarbageCollected(['293', 0])
        yield* this.markDeleted(['293', 1])
        yield* this.markGarbageCollected(['291', 2])
        expect(yield* this.getDeleteSet()).toEqual({'291': [[2, 1, true]], '293': [[0, 1, true], [1, 1, false]]})
        done()
      })
    }))
    it('Debug #3', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['581', 0])
        yield* this.markDeleted(['581', 1])
        yield* this.markDeleted(['580', 0])
        yield* this.markDeleted(['580', 0])
        yield* this.markGarbageCollected(['581', 0])
        yield* this.markDeleted(['581', 2])
        yield* this.markDeleted(['580', 1])
        yield* this.markDeleted(['580', 2])
        yield* this.markDeleted(['580', 1])
        yield* this.markDeleted(['580', 2])
        yield* this.markGarbageCollected(['581', 2])
        yield* this.markGarbageCollected(['581', 1])
        yield* this.markGarbageCollected(['580', 1])
        expect(yield* this.getDeleteSet()).toEqual({'580': [[0, 1, false], [1, 1, true], [2, 1, false]], '581': [[0, 3, true]]})
        done()
      })
    }))
    it('Debug #4', async(function * (done) {
      store.requestTransaction(function * () {
        yield* this.markDeleted(['544', 0])
        yield* this.markDeleted(['543', 2])
        yield* this.markDeleted(['544', 0])
        yield* this.markDeleted(['543', 2])
        yield* this.markGarbageCollected(['544', 0])
        yield* this.markDeleted(['545', 1])
        yield* this.markDeleted(['543', 4])
        yield* this.markDeleted(['543', 3])
        yield* this.markDeleted(['544', 1])
        yield* this.markDeleted(['544', 2])
        yield* this.markDeleted(['544', 1])
        yield* this.markDeleted(['544', 2])
        yield* this.markGarbageCollected(['543', 2])
        yield* this.markGarbageCollected(['543', 4])
        yield* this.markGarbageCollected(['544', 2])
        yield* this.markGarbageCollected(['543', 3])
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
        yield* this.markDeleted(['9', 2])
        yield* this.markDeleted(['11', 2])
        yield* this.markDeleted(['11', 4])
        yield* this.markDeleted(['11', 1])
        yield* this.markDeleted(['9', 4])
        yield* this.markDeleted(['10', 0])
        yield* this.markGarbageCollected(['11', 2])
        yield* this.markDeleted(['11', 2])
        yield* this.markGarbageCollected(['11', 3])
        yield* this.markDeleted(['11', 3])
        yield* this.markDeleted(['11', 3])
        yield* this.markDeleted(['9', 4])
        yield* this.markDeleted(['10', 0])
        yield* this.markGarbageCollected(['11', 1])
        yield* this.markDeleted(['11', 1])
        expect(yield* this.getDeleteSet()).toEqual({'9': [[2, 1, false], [4, 1, false]], '10': [[0, 1, false]], '11': [[1, 3, true], [4, 1, false]]})
        done()
      })
    }))
  })
})
