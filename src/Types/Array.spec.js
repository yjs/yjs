/* @flow */
/*eslint-env browser,jasmine */

var numberOfYArrayTests = 10;

describe("Array Type", function(){
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 3000;
  beforeEach(function(done){
    createUsers(this, 5, done);
  });

  describe("Basic tests", function(){
    it("insert three elements", function(done){
      var y = this.users[0].root;
      y.set("Array", Y.Array).then(function(array) {
        array.insert(0, [1, 2, 3]);
        return y.get("Array");
      }).then(function(array){
        expect(array.toArray()).toEqual([1, 2, 3]);
        done();
      });
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
  describe("Random tests", function(){
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
