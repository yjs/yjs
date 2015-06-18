
type State = {
  user: string,
  clock: number
};

type StateVector = Array<State>;

type StateSet = Object<number>;

var IndexedDB = (function(){ //eslint-disable-line no-unused-vars
  class Transaction {

    constructor (transaction) {
      this.transaction = transaction;
      this.sv = transaction.objectStore("StateVector");
      this.ob = transaction.objectStore("OperationBuffer");
    }
    *setOperation (op) {
        yield this.ob.put(op);
        return op;
    }
    *getOperation (uid) {
        return yield this.ob.get(uid);
    }
    *setState (state : State) : State {
      return yield this.sv.put(state);
    }
    *getState (user : string) : State {
      return (yield this.sv.get(user)) || {
        user: user,
        clock: 0
      };
    }
    *getStateVector () : StateVector {
      var stateVector = [];
      var cursor = yield this.sv.openCursor();
      while ((cursor = yield cursor.continue) != null) {
        stateVector.push(cursor.value);
      }
      return stateVector;
    }
    *getStateSet () : StateSet {
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

        function handle(res){
          var request = res.value;
          if (res.done){
            return;
          } else if (request.constructor === IDBRequest) {
            request.onsuccess = function(){
              handle(gen.next(request.result));
            };
            request.onerror = function(err){
              gen.throw(err);
            };
          } else {
            gen.throw("You may not yield this type!");
          }
        }

        return handle(gen.next());
      });
    }
  }
  return DB;
})();
