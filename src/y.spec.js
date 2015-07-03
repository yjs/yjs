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
  it("There is an initial Map type", function(){
    var y = this.users[0];
    y.transact(function*(root){
      expect(root).not.toBeUndefined();
    });
  });
  it("Basic get&set of Map property (converge via sync)", function(){
    var y = this.users[0];
    y.transact(function*(root){
      yield* root.val("stuff", "stuffy");
      expect(yield* root.val("stuff")).toEqual("stuffy");
    });

    y.connector.flushAll();

    var transaction = function*(root){
      expect(yield* root.val("stuff")).toEqual("stuffy");
    };
    for (var key in this.users) {
      var u = this.users[key];
      u.transact(transaction);
    }
  });
  it("Basic get&set of Map property (converge via update)", function(){
    var y = this.users[0];
    y.connector.flushAll();
    y.transact(function*(root){
      yield* root.val("stuff", "stuffy");
      expect(yield* root.val("stuff")).toEqual("stuffy");
    });

    var transaction = function*(root){
      expect(yield* root.val("stuff")).toEqual("stuffy");
    };
    y.connector.flushAll();

    for (var key in this.users) {
      var u = this.users[key];
      u.transact(transaction);
    }
  });
  it("Basic get&set of Map property (handle conflict)", function(){
    var y = this.users[0];
    y.connector.flushAll();
    this.users[0].transact(function*(root){
      yield* root.val("stuff", "c0");
    });
    this.users[1].transact(function*(root){
      yield* root.val("stuff", "c1");
    });

    var transaction = function*(root){
      expect(yield* root.val("stuff")).toEqual("c1");
    };
    y.connector.flushAll();

    for (var key in this.users) {
      var u = this.users[key];
      u.transact(transaction);
    }
  });


});
