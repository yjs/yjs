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
      expect(yield* root.val("stuff")).toEqual("c0");
    };
    y.connector.flushAll();

    for (var key in this.users) {
      var u = this.users[key];
      u.transact(transaction);
    }
  });
  it("Basic get&set of Map property (handle three conflicts)", function(){
    var y = this.users[0];
    y.connector.flushAll();
    this.users[0].transact(function*(root){
      yield* root.val("stuff", "c0");
    });
    this.users[1].transact(function*(root){
      yield* root.val("stuff", "c1");
    });
    this.users[2].transact(function*(root){
      yield* root.val("stuff", "c2");
    });
    this.users[3].transact(function*(root){
      yield* root.val("stuff", "c3");
    });
    y.connector.flushAll();
    var transaction = function*(root){
      expect(yield* root.val("stuff")).toEqual("c0");
    };

    for (var key in this.users) {
      var u = this.users[key];
      u.transact(transaction);
    }
  });
  it("can create a List type", function(){
    var y = this.users[0];
    y.transact(function*(root){
      var list = yield* Y.List();
      yield* root.val("list", list);
      yield* list.insert(0, [1, 2, 3, 4]);
      expect(yield* root.val("list")).not.toBeUndefined();
    });
    y.connector.flushAll();
    function* transaction (root) {
      var list = yield* root.val("list");
      expect(yield* list.val()).toEqual([1, 2, 3, 4]);
    }
    for (var u of this.users) {
      u.transact(transaction);
    }
  });
});
