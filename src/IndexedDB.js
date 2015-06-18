
var IndexedDB = (function(){ //eslint-disable-line no-unused-vars
  var GeneratorFunction = (function*(){}).constructor;

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
    getOperations () {
      return function* () {
        var op = yield this.getOperation(["u1", 0]);
        return op.uid;
      };
    }
    /*
    getOperations: (state_map)->
      flow = Promise.resolve()
      ops = []
      that = this
      hb = that.t.objectStore("HistoryBuffer")

      that.getStateVector().then (end_state_vector)->
        for end_state of end_state_vector
          # convert to the db-structure
          do (end_state = end_state)->
            start_state =
              user: end_state.name
              state: state_map[end_state] ? 0

            flow = flow.then ()->
              from = [start_state.user, start_state.number]
              to = [end_state.user, end_state.number]
                cursor = event.target.result
                if cursor?
                  ops.push cursor.value # add Operation
                  cursor.continue()
                else
                  # got all ops from this user
                  defer.resolve ops
              defer.promise
    */
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
    requestTransaction (makeGen : Function) {
      this.ready.then(function(db){
        var transaction = new Transaction(db.transaction(["OperationBuffer", "StateVector"], "readwrite"));
        var gen = makeGen.apply(transaction);
        function handle(result : Object){
          var v = result.value;
          if (result.done) {
            return v;
          } else if (v.constructor === Promise) {
            return result.value.then(function(res){
              return handle(gen.next(res));
            }, function(err){
              return handle(gen.throw(err));
            });
          } else if (v.constructor === GeneratorFunction){
            return handle(v.apply(transaction).next());
          } else {
            throw new Error("I do only accept Promises and Generators!");
          }
        }
        return handle(gen.next());
      });
    }
  }
  return DB;
})();
