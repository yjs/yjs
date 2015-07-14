/* @flow */
/*eslint-env browser,jasmine */

var numberOfYMapTests = 5;

describe("Map Type", function(){
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
  beforeEach(function(done){
    createUsers(this, 5, done);
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
  });
  describe("Random tests", function(){
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
});
