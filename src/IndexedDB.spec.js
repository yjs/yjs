/* @flow */
/*eslint-env browser,jasmine */

if(typeof window !== "undefined"){
  describe("IndexedDB", function() {
    var ob = new IndexedDB("Test");

    it("can create transactions", function(done) {
      ob.requestTransaction(function*(){
        var op = yield this.setOperation({
          "uid": ["u1", 0],
          "stuff": true
        });
        expect(yield this.getOperation(["u1", 0]))
          .toEqual(op);
        done();
      });
    });

    it("receive remaining operations", function(done){
      ob.requestTransaction(function*(){
        expect(yield this.getOperations(["u1", 0]))
          .toEqual({
            "uid": ["u1", 0],
            "stuff": true
          });
        done();
      });
    });
  });
}
