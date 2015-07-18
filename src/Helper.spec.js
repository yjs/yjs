/* @flow */
/*eslint-env browser,jasmine */

/***
  This is "just" a compilation of functions that help to test this library!
***/

function wait(t = 0) {//eslint-disable-line
  var def = Promise.defer();
  setTimeout(function(){
    def.resolve();
  }, t);
  return def.promise;
}

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
function getRandomNumber(n) {//eslint-disable-line
  if (n == null) {
    n = 9999;
  }
  return Math.floor(Math.random() * n);
}

async function applyRandomTransactions (users, objects, transactions, numberOfTransactions) {//eslint-disable-line
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
    wait();
  }
}

async function compareAllUsers(users){//eslint-disable-line
  var s1, s2;
  var db1 = [];
  function* t1(){
    s1 = yield* this.getStateSet();
  }
  function* t2(){
    s2 = yield* this.getStateSet();
  }
  await users[0].connector.flushAll();
  for (var uid = 0; uid < users.length; uid++) {
    if (s1 == null) {
      var u = users[uid];
      u.db.requestTransaction(t1);
      await wait();
      u.db.os.iterate(null, null, function(o){//eslint-disable-line
        db1.push(o);
      });
    } else {
      var u2 = users[uid];
      u2.db.requestTransaction(t2);
      await wait();
      expect(s1).toEqual(s2);
      var count = 0;
      u2.db.os.iterate(null, null, function(o){//eslint-disable-line
        expect(db1[count++]).toEqual(o);
      });
    }
  }
}

async function createUsers(self, numberOfUsers) {//eslint-disable-line
  if (globalRoom.users[0] != null) {//eslint-disable-line
    await globalRoom.users[0].flushAll();//eslint-disable-line
  }
  //destroy old users
  for (var u in globalRoom.users) {//eslint-disable-line
    globalRoom.users[u].y.destroy()//eslint-disable-line
  }
  self.users = [];

  var promises = [];
  for (var i = 0; i < numberOfUsers; i++) {
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
  self.users = await Promise.all(promises);
}
