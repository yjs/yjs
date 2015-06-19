
type State = {
  user: string,
  clock: number
};

type StateVector = Array<State>;

type StateSet = Object;

type IDBTransaction = Function;
type IDBObjectStore = Function;
type IDBRequest = Function;
type IDBCursor = Function;
type IDBKeyRange = Function;

type IDBOpenDBRequest = Function;

declare var indexedDB : Object;

declare var setTimeout : Function;

class AbstractTransaction { //eslint-disable-line no-unused-vars
  constructor () {
  }
  *addOperation (op) {
    var state = yield* this.getState(op.uid[0]);
    if (state == null){
      state = {
        user: op.uid[0],
        clock: 0
      };
    }
    if (op.uid[1] === state.clock){
      state.clock++;
      yield* this.setState(state);
      return true;
    } else {
      return false;
    }
  }
}

var IndexedDB = (function(){ //eslint-disable-line no-unused-vars
  class Transaction extends AbstractTransaction{
    transaction: IDBTransaction;
    sv: IDBObjectStore;
    ob: IDBObjectStore;
    constructor (transaction) {
      super();
      this.transaction = transaction;
      this.sv = transaction.objectStore("StateVector");
      this.ob = transaction.objectStore("OperationBuffer");
    }
    *setOperation (op) {
        yield* (function*(){})();
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
      var cursorResult = this.sv.openCursor();
      var cursor;
      while ((cursor = yield cursorResult) != null) {
        stateVector.push(cursor.value);
        cursor.continue();
      }
      return stateVector;
    }
    *getStateSet () : StateSet {
      var sv : StateVector = yield* this.getStateVector();
      var ss : StateSet = {};
      for (var state of sv){
        ss[state.user] = state.clock;
      }
      return ss;
    }

    *getOperations (startSS : StateSet) {
      if (startSS == null){
        startSS = {};
      }
      var ops = [];

      var endSV : StateVector = yield* this.getStateVector();
      for (var endState of endSV) {
        var user = endState.user;
        var startPos = startSS[user] || 0;
        var endPos = endState.clock;
        var range = IDBKeyRange.bound([user, startPos], [user, endPos]);
        var cursorResult = this.ob.openCursor(range);
        var cursor;
        while ((cursor = yield cursorResult) != null) {
          ops.push(cursor.value);
          cursor.continue();
        }
      }
      return ops;
    }
  }
  class DB {
    namespace: string;
    ready: Promise;
    whenReadyListeners: Array<Function>;
    constructor (namespace : string) {
      this.whenReadyListeners = [];
      this.namespace = namespace;
      this.ready = false;

      var req = indexedDB.open(namespace); //eslint-disable-line no-undef
      req.onerror = function(){
        throw new Error("Couldn't open the IndexedDB database!");
      };
      req.onsuccess = (event)=>{
        this.db = event.target.result;
        this.whenReadyListeners.forEach(function(f){
          setTimeout(f, 0);
        });
        this.whenReadyListeners = null;
        this.ready = true;
      };
      req.onupgradeneeded = function(event){
        var db = event.target.result;
        db.createObjectStore("OperationBuffer", {keyPath: "uid"});
        db.createObjectStore("StateVector", {keyPath: "user"});
      };
    }
    whenReady (f : Function) {
      if (this.ready){
        setTimeout(f, 0);
      } else {
        this.whenReadyListeners.push(f);
      }
    }
    requestTransaction (makeGen : Function) {
      this.whenReady(()=>{
        var transaction = new Transaction(this.db.transaction(["OperationBuffer", "StateVector"], "readwrite"));
        var gen = makeGen.apply(transaction);

        function handle(res : any){
          var request : any = res.value;
          if (res.done){
            return;
          } else if (request.constructor === IDBRequest
                     || request.constructor === IDBCursor
                     || request.constructor === IDBOpenDBRequest) {
            request.onsuccess = function(){
              handle(gen.next(request.result));
            };
            request.onerror = function(err){
              gen.throw(err);
            };
          } else {
            gen.throw("You can not yield this type!");
          }
        }
        handle(gen.next());
      });
    }
    *removeDatabase () {
      return yield indexedDB.deleteDatabase(this.namespace);
    }
  }
  return DB;
})();
