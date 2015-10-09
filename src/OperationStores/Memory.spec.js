/* global Y, async */
/* eslint-env browser,jasmine,console */

describe('Memory', function () {
  describe('DeleteStore', function () {
    var ds
    beforeEach(function () {
      ds = new Y.utils.DeleteStore()
    })
    it('Deleted operation is deleted', function () {
      ds.markDeleted(['u1', 10])
      expect(ds.isDeleted(['u1', 10])).toBeTruthy()
      expect(ds.toDeleteSet()).toEqual({'u1': [[10, 1, false]]})
    })
    it('Deleted operation extends other deleted operation', function () {
      ds.markDeleted(['u1', 10])
      ds.markDeleted(['u1', 11])
      expect(ds.isDeleted(['u1', 10])).toBeTruthy()
      expect(ds.isDeleted(['u1', 11])).toBeTruthy()
      expect(ds.toDeleteSet()).toEqual({'u1': [[10, 2, false]]})
    })
    it('Deleted operation extends other deleted operation', function () {
      ds.markDeleted(['0', 3])
      ds.markDeleted(['0', 4])
      ds.markDeleted(['0', 2])
      expect(ds.toDeleteSet()).toEqual({'0': [[2, 3, false]]})
    })
    it('Debug #1', function () {
      ds.markDeleted(['166', 0])
      ds.markDeleted(['166', 2])
      ds.markDeleted(['166', 0])
      ds.markDeleted(['166', 2])
      ds.markGarbageCollected(['166', 2])
      ds.markDeleted(['166', 1])
      ds.markDeleted(['166', 3])
      ds.markGarbageCollected(['166', 3])
      ds.markDeleted(['166', 0])
      expect(ds.toDeleteSet()).toEqual({'166': [[0, 2, false], [2, 2, true]]})
    })
    it('Debug #2', function () {
      ds.markDeleted(['293', 0])
      ds.markDeleted(['291', 2])
      ds.markDeleted(['291', 2])
      ds.markGarbageCollected(['293', 0])
      ds.markDeleted(['293', 1])
      ds.markGarbageCollected(['291', 2])
      expect(ds.toDeleteSet()).toEqual({'291': [[2, 1, true]], '293': [[0, 1, true], [1, 1, false]]})
    })
    it('Debug #3', function () {
      ds.markDeleted(['581', 0])
      ds.markDeleted(['581', 1])
      ds.markDeleted(['580', 0])
      ds.markDeleted(['580', 0])
      ds.markGarbageCollected(['581', 0])
      ds.markDeleted(['581', 2])
      ds.markDeleted(['580', 1])
      ds.markDeleted(['580', 2])
      ds.markDeleted(['580', 1])
      ds.markDeleted(['580', 2])
      ds.markGarbageCollected(['581', 2])
      ds.markGarbageCollected(['581', 1])
      ds.markGarbageCollected(['580', 1])
      expect(ds.toDeleteSet()).toEqual({'580': [[0, 1, false], [1, 1, true], [2, 1, false]], '581': [[0, 3, true]]})
    })
    it('Debug #4', function () {
      ds.markDeleted(['544', 0])
      ds.markDeleted(['543', 2])
      ds.markDeleted(['544', 0])
      ds.markDeleted(['543', 2])
      ds.markGarbageCollected(['544', 0])
      ds.markDeleted(['545', 1])
      ds.markDeleted(['543', 4])
      ds.markDeleted(['543', 3])
      ds.markDeleted(['544', 1])
      ds.markDeleted(['544', 2])
      ds.markDeleted(['544', 1])
      ds.markDeleted(['544', 2])
      ds.markGarbageCollected(['543', 2])
      ds.markGarbageCollected(['543', 4])
      ds.markGarbageCollected(['544', 2])
      ds.markGarbageCollected(['543', 3])
      expect(ds.toDeleteSet()).toEqual({'543': [[2, 3, true]], '544': [[0, 1, true], [1, 1, false], [2, 1, true]], '545': [[1, 1, false]]})
    })
    it('Debug #5', async(function * (done) {
      var store = new Y.Memory(null, {
        db: {
          name: 'Memory',
          gcTimeout: -1
        }
      })
      store.requestTransaction(function * () {
        yield* this.applyDeleteSet({'16': [[1, 2, false]], '17': [[0, 1, true], [1, 3, false]]})
        expect(this.ds.toDeleteSet()).toEqual({'16': [[1, 2, false]], '17': [[0, 1, true], [1, 3, false]]})
        yield* this.applyDeleteSet({'16': [[1, 2, false]], '17': [[0, 4, true]]})
        expect(this.ds.toDeleteSet()).toEqual({'16': [[1, 2, false]], '17': [[0, 4, true]]})
        done()
      })
    }))
    it('Debug #6', async(function * (done) {
      var store = new Y.Memory(null, {
        db: {
          name: 'Memory',
          gcTimeout: -1
        }
      })
      store.requestTransaction(function * () {
        yield* this.applyDeleteSet({'40': [[0, 3, false]]})
        expect(this.ds.toDeleteSet()).toEqual({'40': [[0, 3, false]]})
        yield* this.applyDeleteSet({'39': [[2, 2, false]], '40': [[0, 1, true], [1, 2, false]], '41': [[2, 1, false]]})
        expect(this.ds.toDeleteSet()).toEqual({'39': [[2, 2, false]], '40': [[0, 1, true], [1, 2, false]], '41': [[2, 1, false]]})
        done()
      })
    }))
  })
})
