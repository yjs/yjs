/* @flow */
/*eslint-env browser,jasmine,console */

describe("OperationStore", function() {
  class OperationStore extends AbstractOperationStore {
    requestTransaction (makeGen) {
      var gen = makeGen.apply();

      function handle(res : any){
        if (res.done){
          return;
        } else {
          handle(gen.next(res.value));
        }
      }
      handle(gen.next());
    }
  }

  var os = new OperationStore();

  it("calls when operation added", function(done) {
    var id = ["u1", 1];
    os.whenOperationsExist([id], function*(){
      done();
    });
    os.operationAdded({id: id});
  });
  it("calls when no requirements", function(done) {
    os.whenOperationsExist([], function*(){
      done();
    });
  });
  it("calls when no requirements with arguments", function(done) {
    os.whenOperationsExist([], function*(arg){
      expect(arg).toBeTrue();
      done();
    }, [true]);
  });
});
