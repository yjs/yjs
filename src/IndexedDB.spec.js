/* @flow */
/*eslint-env browser,jasmine */

if(typeof window !== "undefined"){
  describe("IndexedDB", function() {
    var ob = new IndexedDB("Test");

    it("can create transactions", function(done) {
      ob.requestTransaction(function*(){
        var op = yield* this.setOperation({
          "uid": ["u1", 0],
          "stuff": true
        });
        expect(yield* this.getOperation(["u1", 0]))
          .toEqual(op);
        done();
      });
    });

    it("getOperation(op) returns undefined if op does not exist", function(done){
      ob.requestTransaction(function*(){
        var op = yield* this.getOperation("plzDon'tBeThere");
        expect(op).toBeUndefined();
        done();
      });
    });

    it("yield throws if request is unknown", function(done){

      ob.requestTransaction(function*(){
        try {
          yield this.getOperations(["u1", 0]);
        } catch (e) {
          expect(true).toEqual(true);
          done();
          return;
        }
        expect("Expected an Error!").toEqual(true);
        done();
      });
    });
  });
}
