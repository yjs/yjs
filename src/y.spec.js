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
  function randomTransaction (root) {
    var f = getRandom(transactions);
    f(root);
  }
  for(var i = 0; i < numberOfTransactions; i++) {
    var r = Math.random();
    if (r >= 0.9) {
      // 10% chance to flush
      users[0].connector.flushOne();
    } else {
      randomTransaction(getRandom(users).root);
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
    u1.db.requestTransaction(t1);
    u2.db.requestTransaction(t2);
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
  beforeEach(function(done){
    if (this.users != null) {
      for (var y of this.users) {
        y.destroy();
      }
    }
    this.users = [];

    var promises = [];
    for (var i = 0; i < 5; i++) {
      promises.push(Y({
        db: {
          name: "Memory"
        },
        connector: {
          name: "Test",
          debug: false
        }
      }));
    }
    Promise.all(promises).then( users => {
      this.users = users;
      done();
    });
  });

  describe("Basic tests", function(){
    it("Basic get&set of Map property (converge via sync)", function(){
      var y = this.users[0].root;
      y.set("stuff", "stuffy");
      expect(y.get("stuff")).toEqual("stuffy");

      this.users[0].connector.flushAll();

      for (var key in this.users) {
        var u = this.users[key].root;
        expect(u.get("stuff")).toEqual("stuffy");
      }
      compareAllUsers(this.users);
    });
    it("Map can set custom types (Map)", function(done){
      var y = this.users[0].root;
      y.set("Map", Y.Map).then(function(map) {
        map.set("one", 1);
        return y.get("Map");
      }).then(function(map){
        expect(map.get("one")).toEqual(1);
        done();
      });
    });
    it("Basic get&set of Map property (converge via update)", function(done){
      var u = this.users[0];
      u.connector.flushAll();
      var y = u.root;
      y.set("stuff", "stuffy");
      expect(y.get("stuff")).toEqual("stuffy");

      u.connector.flushAll();
      setTimeout(() => {
        for (var key in this.users) {
          var r = this.users[key].root;
          expect(r.get("stuff")).toEqual("stuffy");
        }
        done();
      }, 50);
    });
    it("Basic get&set of Map property (handle conflict)", function(done){
      var y = this.users[0];
      y.connector.flushAll();
      y.root.set("stuff", "c0");

      this.users[1].root.set("stuff", "c1");

      y.connector.flushAll();

      setTimeout( () => {
        for (var key in this.users) {
          var u = this.users[key];
          expect(u.root.get("stuff")).toEqual("c0");
          compareAllUsers(this.users);
        }
        done();
      }, 50);
    });
    it("Basic get&set of Map property (handle three conflicts)", function(done){
      var y = this.users[0];
      this.users[0].root.set("stuff", "c0");
      this.users[1].root.set("stuff", "c1");
      this.users[2].root.set("stuff", "c2");
      this.users[3].root.set("stuff", "c3");
      y.connector.flushAll();

      setTimeout( () => {
        for (var key in this.users) {
          var u = this.users[key];
          expect(u.root.get("stuff")).toEqual("c0");
        }
        compareAllUsers(this.users);
        done();
      }, 50);
    });
  });
  describe("Map random tests", function(){
    var randomMapTransactions = [
      function set (map) {
        map.set("somekey", getRandomNumber());
      },
      function* delete_ (map) {
        map.delete("somekey");
      }
    ];
    function compareMapValues(users){
      var firstMap;
      for (var u of users) {
        var val = u.root.get();
        if (firstMap == null) {
          firstMap = val;
        } else {
          expect(val).toEqual(firstMap);
        }
      }
    }
    it(`succeed after ${numberOfYMapTests} actions with flush before transactions`, function(done){
      this.users[0].connector.flushAll();
      applyRandomTransactions(this.users, randomMapTransactions, numberOfYMapTests);
      setTimeout(()=>{
        compareAllUsers(this.users);
        compareMapValues(this.users);
        done();
      }, 500);
    });
    it(`succeed after ${numberOfYMapTests} actions without flush before transactions`, function(done){
      applyRandomTransactions(this.users, randomMapTransactions, numberOfYMapTests);
      setTimeout(()=>{
        compareAllUsers(this.users);
        compareMapValues(this.users);
        done();
      }, 500);
    });
  });

/*

  var numberOfYListTests = 100;
  describe("List random tests", function(){
    var randomListTests = [function* insert (root) {
      var list = yield* root.get("list");
      yield* list.insert(Math.floor(Math.random() * 10), [getRandomNumber()]);
    }, function* delete_(root) {
      var list = yield* root.get("list");
      yield* list.delete(Math.floor(Math.random() * 10));
    }];
    beforeEach(function(){
      this.users[0].transact(function*(root){
        var list = yield* Y.List();
        yield* root.set("list", list);
      });
      this.users[0].connector.flushAll();
    });

    it(`succeeds after ${numberOfYListTests} actions`, function(){
      applyRandomTransactions(this.users, randomListTests, numberOfYListTests);
      compareAllUsers(this.users);
      var userList;
      this.users[0].transact(function*(root){
        var list = yield* root.get("list");
        if (userList == null) {
          userList = yield* list.get();
        } else {
          expect(userList).toEqual(yield* list.get());
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
  */
});
