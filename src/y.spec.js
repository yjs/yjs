/* @flow */
/*eslint-env browser,jasmine */

// returns a random element of o
// works on Object, and Array
function getRandom (o) {
  if (o instanceof Array) {
    return o[Math.floor(Math.random() * o.length)];
  } else if (o.constructor === Object) {
    var ks = [];
    for (var key in o) {
      ks.push(key);
    }
    return o[getRandom(ks)];
  }
}
function getRandomNumber(n) {
  if (n == null) {
    n = 9999;
  }
  return Math.floor(Math.random() * n);
}

var numberOfYMapTests = 30;

function applyRandomTransactions (users, transactions, numberOfTransactions) {
  function* randomTransaction (root) {
    var f = getRandom(transactions);
    yield* f(root);
  }
  for(var i = 0; i < numberOfTransactions; i++) {
    var r = Math.random();
    if (r >= 0.9) {
      // 10% chance to flush
      users[0].connector.flushOne();
    } else {
      getRandom(users).transact(randomTransaction);
    }
  }
}

function compareAllUsers(users){
  var s1, s2;
  function* t1(){
    s1 = yield* this.getStateSet();
  }
  function* t2(){
    s2 = yield* this.getStateSet();
  }
  users[0].connector.flushAll();
  for (var uid = 0; uid + 1 < users.length; uid++) {
    var u1 = users[uid];
    var u2 = users[uid + 1];
    u1.transact(t1);
    u2.transact(t2);
    expect(s1).toEqual(s2);
    var db1 = [];
    var db2 = [];
    u1.db.os.iterate(null, null, function(o){//eslint-disable-line
      db1.push(o);
    });
    u2.db.os.iterate(null, null, function(o){//eslint-disable-line
      db2.push(o);
    });

    for (var key in db1) {
      expect(db1[key]).toEqual(db2[key]);
    }
  }
}

describe("Yjs", function(){
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
          debug: false
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

  describe("Basic tests", function(){
    it("There is an initial Map type & it is created only once", function(){
      var y = this.users[0];
      var root1;
      y.transact(function*(root){
        expect(root).not.toBeUndefined();
        root1 = root;
      });
      y.transact(function*(root2){
        expect(root1).toBe(root2);
      });
    });
    it("Custom Types are created only once", function(){
      var y = this.users[0];
      var l1;
      y.transact(function*(root){
        var l = yield* Y.List();
        yield* root.val("list", l);
        l1 = l;
      });
      y.transact(function*(root){
        expect(l1).toBe(yield* root.val("list"));
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
  });
  it("Basic get&set&delete with Map property", function(){
    var y = this.users[0];
    y.connector.flushAll();
    this.users[0].transact(function*(root){
      yield* root.val("stuff", "c0");
    });
    this.users[0].transact(function*(root){
      yield* root.val("stuff", "c1");
    });
    this.users[0].transact(function*(root){
      yield* root.delete("stuff");
    });

    y.connector.flushAll();
    var transaction = function*(root){
      expect(yield* root.val("stuff")).toBeUndefined();
    };

    for (var key in this.users) {
      var u = this.users[key];
      u.transact(transaction);
    }
  });

  it("List type: can create, insert, and delete elements", function(){
    var y = this.users[0];
    y.transact(function*(root){
      var list = yield* Y.List();
      yield* root.val("list", list);
      yield* list.insert(0, [1, 2, 3, 4]);
      yield* list.delete(1);
      expect(yield* root.val("list")).not.toBeUndefined();
    });
    y.connector.flushAll();
    function* transaction (root) {
      var list = yield* root.val("list");
      expect(yield* list.val()).toEqual([1, 3, 4]);
    }
    for (var u of this.users) {
      u.transact(transaction);
    }
  });
  describe("Map random tests", function(){
    var randomMapTransactions = [
      function* set (map) {
        yield* map.val("somekey", getRandomNumber());
      },
      function* delete_ (map) {
        yield* map.delete("somekey");
      }
    ];
    it(`succeed after ${numberOfYMapTests} actions with flush before transactions`, function(){
      this.users[0].connector.flushAll();
      applyRandomTransactions(this.users, randomMapTransactions, numberOfYMapTests);
      compareAllUsers(this.users);
      var firstMap;
      for (var u of this.users) {
        u.transact(function*(root){//eslint-disable-line
          var val = yield* root.val();
          if (firstMap == null) {
            firstMap = val;
          } else {
            expect(val).toEqual(firstMap);
          }
        });
      }
    });
    it(`succeed after ${numberOfYMapTests} actions without flush before transactions`, function(){
      applyRandomTransactions(this.users, randomMapTransactions, numberOfYMapTests);
      compareAllUsers(this.users);
    });
  });
  var numberOfYListTests = 100;
  describe("List random tests", function(){
    var randomListTests = [function* insert (root) {
      var list = yield* root.val("list");
      yield* list.insert(Math.floor(Math.random() * 10), [getRandomNumber()]);
    }, function* delete_(root) {
      var list = yield* root.val("list");
      yield* list.delete(Math.floor(Math.random() * 10));
    }];
    beforeEach(function(){
      this.users[0].transact(function*(root){
        var list = yield* Y.List();
        yield* root.val("list", list);
      });
      this.users[0].connector.flushAll();
    });

    it(`succeeds after ${numberOfYListTests} actions`, function(){
      applyRandomTransactions(this.users, randomListTests, numberOfYListTests);
      compareAllUsers(this.users);
      var userList;
      this.users[0].transact(function*(root){
        var list = yield* root.val("list");
        if (userList == null) {
          userList = yield* list.val();
        } else {
          expect(userList).toEqual(yield* list.val());
          expect(userList.length > 0).toBeTruthy();
        }
      });
    });
  });

  describe("Map debug tests", function(){
    beforeEach(function(){
      this.u1 = this.users[0];
      this.u2 = this.users[1];
      this.u3 = this.users[2];
    });
    it("concurrent insertions #1", function(){
      this.u1.transact(function*(root){
        var op = {
          content: 1,
          left: null,
          right: null,
          parent: root._model,
          parentSub: "a"
        };
        Struct.Insert.create.call(this, op);
      });
      compareAllUsers(this.users);
    });
  });
});
