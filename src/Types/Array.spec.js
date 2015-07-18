/* @flow */
/*eslint-env browser,jasmine */

var numberOfYArrayTests = 80;

describe("Array Type", function(){
  var y1, y2, y3, flushAll;

  jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;
  beforeEach(async function(done){
    await createUsers(this, 5);
    y1 = this.users[0].root;
    y2 = this.users[1].root;
    y3 = this.users[2].root;
    flushAll = this.users[0].connector.flushAll;
    done();
  });
  afterEach(async function(done) {
    await compareAllUsers(this.users);
    done();
  });

  describe("Basic tests", function(){
    it("insert three elements, try re-get property", async function(done){
      var array = await y1.set("Array", Y.Array);
      array.insert(0, [1, 2, 3]);
      array = await y1.get("Array"); // re-get property
      expect(array.toArray()).toEqual([1, 2, 3]);
      done();
    });
    it("Basic insert in array (handle three conflicts)", async function(done){
      var l1, l2, l3;
      await y1.set("Array", Y.Array);
      await flushAll();
      (l1 = await y1.get("Array")).insert(0, [0]);
      (l2 = await y2.get("Array")).insert(0, [1]);
      (l3 = await y3.get("Array")).insert(0, [2]);
      await flushAll();
      expect(l1.toArray()).toEqual(l2.toArray());
      expect(l2.toArray()).toEqual(l3.toArray());
      done();
    });
    it("Basic insert&delete in array (handle three conflicts)", async function(done){
      var l1, l2, l3;
      l1 = await y1.set("Array", Y.Array);
      l1.insert(0, ["x", "y", "z"]);
      await flushAll();
      l1.insert(1, [0]);
      l2 = await y2.get("Array");
      l2.delete(0);
      l2.delete(1);
      l3 = await y3.get("Array");
      l3.insert(1, [2]);
      await flushAll();
      expect(l1.toArray()).toEqual(l2.toArray());
      expect(l2.toArray()).toEqual(l3.toArray());
      expect(l2.toArray()).toEqual([0, 2, "y"]);
      done();
    });
    it("Basic insert. Then delete the whole array", async function(done){
      var l1, l2, l3;
      l1 = await y1.set("Array", Y.Array);
      l1.insert(0, ["x", "y", "z"]);
      await flushAll();
      l1.delete(0, 3);
      l2 = await y2.get("Array");
      l3 = await y3.get("Array");
      await flushAll();
      expect(l1.toArray()).toEqual(l2.toArray());
      expect(l2.toArray()).toEqual(l3.toArray());
      expect(l2.toArray()).toEqual([]);
      done();
    });
    it("throw insert & delete events", async function(done){
      var array = await this.users[0].root.set("array", Y.Array);
      var event;
      array.observe(function(e){
        event = e;
      });
      array.insert(0, [0]);
      expect(event).toEqual([{
        type: "insert",
        object: array,
        index: 0,
        length: 1
      }]);
      array.delete(0);
      expect(event).toEqual([{
        type: "delete",
        object: array,
        index: 0,
        length: 1
      }]);
      await wait(50);
      done();
    });
  });
  describe(`${numberOfYArrayTests} Random tests`, function(){
    var randomArrayTransactions = [
      function insert (array) {
        array.insert(getRandomNumber(array.toArray().length), [getRandomNumber()]);
      },
      function _delete (array) {
        var length = array.toArray().length;
        if (length > 0) {
          array.delete(getRandomNumber(length - 1));
        }
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
    beforeEach(async function(done){
      await this.users[0].root.set("Array", Y.Array);
      await flushAll();

      var promises = [];
      for (var u = 0; u < this.users.length; u++) {
        promises.push(this.users[u].root.get("Array"));
      }
      this.arrays = await Promise.all(promises);
      done();
    });
    it("arrays.length equals users.length", async function(done){
      expect(this.arrays.length).toEqual(this.users.length);
      done();
    });
    it(`succeed after ${numberOfYArrayTests} actions`, async function(done){
      await applyRandomTransactions(this.users, this.arrays, randomArrayTransactions, numberOfYArrayTests);
      await flushAll();
      await compareArrayValues(this.arrays);
      done();
    });
  });
});
