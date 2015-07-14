/* @flow */
/*eslint-env browser,jasmine */

/***
  This is "just" a compilation of functions that help to test this library!
***/


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

function applyRandomTransactions (users, objects, transactions, numberOfTransactions) {//eslint-disable-line
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

function compareAllUsers(users){//eslint-disable-line
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

function createUsers(self, numberOfUsers, done) {//eslint-disable-line
  if (self.users != null) {
    for (var y of self.users) {
      y.destroy();
    }
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
  Promise.all(promises).then( users => {
    self.users = users;
    done();
  });
}
