/* global DeleteStore */
/* eslint-env browser,jasmine,console */

describe('Memory', function () {
  describe('DeleteStore', function () {
    var ds
    beforeEach(function () {
      ds = new DeleteStore()
    })
    it('Deleted operation is deleted', function () {
      ds.delete(['u1', 10])
      expect(ds.isDeleted(['u1', 10])).toBeTruthy()
      expect(ds.toDeleteSet()).toBeTruthy({'u1': [10, 1]})
    })
    it('Deleted operation extends other deleted operation', function () {
      ds.delete(['u1', 10])
      ds.delete(['u1', 11])
      expect(ds.isDeleted(['u1', 10])).toBeTruthy()
      expect(ds.isDeleted(['u1', 11])).toBeTruthy()
      expect(ds.toDeleteSet()).toBeTruthy({'u1': [10, 2]})
    })
  })
})
