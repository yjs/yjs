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
          name: "Test",
          debug: true
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
  it("Basic get&set of Map property (converge via sync)", function(done){
    var y = this.users[0];
    y.transact(function*(){
      yield* y.root.val("stuff", "stuffy");
      expect(yield* y.root.val("stuff")).toEqual("stuffy");
    });

    y.connector.flushAll();

    function getTransaction(yy){
      return function*(){
        expect(yield* yy.root.val("stuff")).toEqual("stuffy");
      };
    }
    for (var key in this.users) {
      var u = this.users[key];
      u.transact(getTransaction(u));
    }
    done();
  });
  it("Basic get&set of Map property (converge via update)", function(done){
    var y = this.users[0];
    y.connector.flushAll();
    y.transact(function*(){
      yield* y.root.val("stuff", "stuffy");
      expect(yield* y.root.val("stuff")).toEqual("stuffy");
    });

    function getTransaction(yy){
      return function*(){
        expect(yield* yy.root.val("stuff")).toEqual("stuffy");
      };
    }
    y.connector.flushAll();

    for (var key in this.users) {
      var u = this.users[key];
      u.transact(getTransaction(u));
    }
    done();
  });
});
