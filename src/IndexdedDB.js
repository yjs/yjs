
var IndexedDB = (function(){ //eslint-disable-line no-unused-vars
  class Transaction {
    constructor (transaction) {
      this.transaction = transaction;
    }
    setOperation (op) {
      return new Promise((resolve, reject)=> {
        var req = this.transaction.objectStore("OperationBuffer").put(op);
        req.onsuccess = function () {
          resolve(op);
        };
        req.onerror = function () {
          reject("Could not set Operation!");
        };
      });
    }
    getOperation (uid) {
      return new Promise((resolve, reject)=>{
        var req = this.transaction.objectStore("OperationBuffer").get(uid);
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject("Could not get Operation");
        };
      });
    }
  }
  class DB {
    constructor (namespace : string) {
      this.namespace = namespace;
      this.ready = new Promise(function(yay, nay){
        var req = indexedDB.open(namespace); //eslint-disable-line no-undef
        req.onerror = function(){
          nay("Couldn't open the IndexedDB database!");
        };
        req.onsuccess = function(event){
          yay(event.target.result);
        };
        req.onupgradeneeded = function(event){
          var db = event.target.result;
          db.createObjectStore("OperationBuffer", {keyPath: "uid"});
          db.createObjectStore("StateVector", {keyPath: "user"});
        };
      }).catch(function(message){
          throw new Error(message);
      });
    }
    requestTransaction (generator : Function) {
      this.ready.then(function(){
        var gen = generator(3);//new Transaction(db.transaction(["OperationBuffer", "StateVector"], "readwrite"))
        gen.next();
      });
    }
  }
  return {
    "DB": DB,
    "Transaction": Transaction
  };
})();

function requestTransaction(makeGen : Function){ //eslint-disable-line no-unused-vars
  var gen = makeGen([1, 2, 3]);
  function handle(result : Object){
    if (result.done) {
      return result.value;
    }
    return result.value.then(function(res){
      return handle(gen.next(res));
    }, function(err){
      return handle(gen.throw(err));
    });
  }
  return handle(gen.next());
}
