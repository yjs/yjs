/* global Y */
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
  })
})
