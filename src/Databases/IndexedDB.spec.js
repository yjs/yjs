/* global Y */
/* eslint-env browser,jasmine */

if (typeof window !== 'undefined' && false) {
  describe('IndexedDB', function () {
    var ob
    beforeAll(function () {
      ob = new Y.IndexedDB(null, {namespace: 'Test', gcTimeout: -1})
    })

    afterAll(function (done) {
      ob.requestTransaction(function *() {
        yield* ob.removeDatabase()
        ob = null
        done()
      })
    })
  })
}
