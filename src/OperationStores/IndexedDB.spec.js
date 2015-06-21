/* @flow */
/*eslint-env browser,jasmine */

if(typeof window !== "undefined"){
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
  describe("IndexedDB", function() {
    var ob = new IndexedDB("Test");

    it("can add and get operation", function(done) {
      ob.requestTransaction(function*(){
        var op = yield* this.setOperation({
          "id": ["1", 0],
          "stuff": true
        });
        expect(yield* this.getOperation(["1", 0]))
          .toEqual(op);
        done();
      });
    });

    it("can remove operation", function(done) {
      ob.requestTransaction(function*(){
        var op = yield* this.setOperation({
          "id": ["1", 0],
          "stuff": true
        });
        expect(yield* this.getOperation(["1", 0]))
          .toEqual(op);
        yield* this.removeOperation(["1", 0]);
        expect(yield* this.getOperation(["1", 0]))
          .toBeUndefined();
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
          yield* this.setOperation();
        } catch (e) {
          expect(true).toEqual(true);
          done();
          return;
        }
        expect("Expected an Error!").toEqual(true);
        done();
      });
    });

    it("sets and gets stateVector", function(done){
      ob.requestTransaction(function*(){
        var s1 = {user: "1", clock: 1};
        var s2 = {user: "2", clock: 3};
        yield* this.setState(s1);
        yield* this.setState(s2);
        var sv = yield* this.getStateVector();
        expect(sv).not.toBeUndefined();
        expect(sv).toEqual([s1, s2]);
        done();
      });
    });

    it("gets stateSet", function(done){
      ob.requestTransaction(function*(){
        var s1 = {user: "1", clock: 1};
        var s2 = {user: "2", clock: 3};
        yield* this.setState(s1);
        yield* this.setState(s2);
        var sv = yield* this.getStateSet();
        expect(sv).not.toBeUndefined();
        expect(sv).toEqual({
          "1": 1,
          "2": 3
        });
        done();
      });
    });

    it("getOperations returns operations (no parameters)", function(done){
      ob.requestTransaction(function*(){
        var s1 = {user: "1", clock: 55};
        yield* this.setState(s1);
        var op1 = yield* this.setOperation({
          "id": ["1", 0],
          "stuff": true
        });
        var op2 = yield* this.setOperation({
          "id": ["1", 3],
          "stuff": true
        });
        var ops = yield* this.getOperations();
        expect(ops.length).toBeGreaterThan(1);
        expect(ops[0]).toEqual(op1);
        expect(ops[1]).toEqual(op2);
        done();
      });
    });
    afterAll(function(done){
      ob.requestTransaction(function*(){
        yield* ob.removeDatabase();
        ob = null;
        done();
      });
    });
  });
}
