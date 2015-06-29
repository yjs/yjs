/* @flow */
/*eslint-env browser,jasmine */

describe("Yjs (basic)", function(){
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 500;
  beforeEach(function(){
    this.users = [];
    for (var i = 0; i < 5; i++) {
      this.users.push(new Y({
        db: {
          name: "Memory"
        },
        connector: {
          name: "Test"
        }
      }));
    }
  });
  afterEach(function(){
    for (var y of this.users) {
      y.destroy();
    }
    this.users = [];
  });
  it("There is an initial Map type", function(done){
    var y = this.users[0];
    y.transact(function*(){
      expect(y.root).not.toBeUndefined();
      done();
    });
  });
  it("Basic get&set of Map property", function(done){
    var y = this.users[0];
    y.transact(function*(){
      yield* y.root.val("stuff", "stuffy");
      expect(yield* y.root.val("stuff")).toEqual("stuffy");
      done();
    });
  });
});
