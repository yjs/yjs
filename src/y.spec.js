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

var numberOfYMapTests = 5;

function applyRandomTransactions (users, objects, transactions, numberOfTransactions) {
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
      randomTransaction(getRandom(objects));
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
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
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
    it("Map can set custom types (Array)", function(done){
      var y = this.users[0].root;
      y.set("Array", Y.Array).then(function(array) {
        array.insert(0, [1, 2, 3]);
        return y.get("Array");
      }).then(function(array){
        expect(array.toArray()).toEqual([1, 2, 3]);
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
    it("Basic insert in array (handle three conflicts)", function(done){
      var y = this.users[0];
      var l1, l2, l3;
      y.root.set("Array", Y.Array).then((array)=>{
        l1 = array;
        y.connector.flushAll();
        l1.insert(0, [0]);
        return this.users[1].root.get("Array");
      }).then((array)=>{
        l2 = array;
        l2.insert(0, [1]);
        return this.users[2].root.get("Array");
      }).then((array)=>{
        l3 = array;
        l3.insert(0, [2]);
        y.connector.flushAll();
        expect(l1.toArray()).toEqual(l2.toArray());
        expect(l2.toArray()).toEqual(l3.toArray());
        compareAllUsers(this.users);
        done();
      });
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
    function compareMapValues(maps){
      var firstMap;
      for (var map of maps) {
        var val = map.get();
        if (firstMap == null) {
          firstMap = val;
        } else {
          expect(val).toEqual(firstMap);
        }
      }
    }
    beforeEach(function(done){
      this.users[0].root.set("Map", Y.Map);
      this.users[0].connector.flushAll();

      var then = Promise.resolve();
      var maps = [];
      for (var u of this.users) {
        then = then.then(function(){ //eslint-disable-line
          return u.root.get("Map");
        }).then(function(map){//eslint-disable-line
          maps.push(map);
        });
      }
      this.maps = maps;
      then.then(function(){
        done();
      });
    });
    it(`succeed after ${numberOfYMapTests} actions`, function(done){
      applyRandomTransactions(this.users, this.maps, randomMapTransactions, numberOfYMapTests);
      setTimeout(()=>{
        compareAllUsers(this.users);
        compareMapValues(this.maps);
        done();
      }, 500);
    });
  });

  var numberOfYArrayTests = 10;
  describe("Array random tests", function(){
    var randomMapTransactions = [
      function insert (array) {
        array.insert(getRandomNumber(array.toArray().length), [getRandomNumber()]);
      }
    ];
    function compareArrayValues(arrays){
      var firstArray;
      for (var l of arrays) {
        var val = l.toArray();
        if (firstArray == null) {
          firstArray = val;
        } else {
          expect(val).toEqual(firstArray);
        }
      }
    }
    beforeEach(function(done){
      this.users[0].root.set("Array", Y.Array);
      this.users[0].connector.flushAll();

      var then = Promise.resolve();
      var arrays = [];
      for (var u of this.users) {
        then = then.then(function(){ //eslint-disable-line
          return u.root.get("Array");
        }).then(function(array){//eslint-disable-line
          arrays.push(array);
        });
      }
      this.arrays = arrays;
      then.then(function(){
        done();
      });
    });
    it("arrays.length equals users.length", function(){
      expect(this.arrays.length).toEqual(this.users.length);
    });
    it(`succeed after ${numberOfYArrayTests} actions`, function(done){
      applyRandomTransactions(this.users, this.arrays, randomMapTransactions, numberOfYArrayTests);
      setTimeout(()=>{
        compareAllUsers(this.users);
        compareArrayValues(this.arrays);
        done();
      }, 500);
    });
  });
});
