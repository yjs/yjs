
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

var IndexedDB = (function(){ //eslint-disable-line no-unused-vars
  class Transaction extends AbstractTransaction { //eslint-disable-line
    transaction: IDBTransaction;
    sv: IDBObjectStore;
    os: IDBObjectStore;
    store: OperationStore;

    constructor (store : OperationStore) {
      super(store);
      this.transaction = store.db.transaction(["OperationStore", "StateVector"], "readwrite");
      this.sv = this.transaction.objectStore("StateVector");
      this.os = this.transaction.objectStore("OperationStore");
      this.buffer = {};
    }
    *setOperation (op) {
      yield this.os.put(op);
      this.buffer[JSON.stringify(op.uid)] = op;
      return op;
    }
    *getOperation (id) {
      var op = this.buffer[JSON.stringify(id)];
      if (op == null) {
        op = yield this.os.get(id);
        this.buffer[JSON.stringify(id)] = op;
      }
      return op;
    }
    *removeOperation (id) {
      return yield this.os.delete(id);
    }
    *setState (state : State) : State {
      return yield this.sv.put(state);
    }
    *getState (user : string) : State {
      var state;
      if ((state = yield this.sv.get(user)) != null){
        return state;
      } else {
        return {
          user: user,
          clock: 0
        };
      }
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
        var cursorResult = this.os.openCursor(range);
        var cursor;
        while ((cursor = yield cursorResult) != null) {
          ops.push(cursor.value);
          cursor.continue();
        }
      }
      return ops;
    }
  }
  class OperationStore extends AbstractOperationStore { //eslint-disable-line no-undef
    namespace: string;
    ready: Promise;
    whenReadyListeners: Array<Function>;
    constructor (namespace : string) {
      super();
      this.whenReadyListeners = [];
      this.namespace = namespace;
      this.ready = false;

      var req = indexedDB.open(namespace, 2); //eslint-disable-line no-undef
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
        db.createObjectStore("OperationStore", {keyPath: "id"});
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
        var transaction = new Transaction(this);
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
      this.db.close();
      yield indexedDB.deleteDatabase(this.namespace);
    }
  }
  return OperationStore;
})();
