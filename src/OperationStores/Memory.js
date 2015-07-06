
type State = {
  user: string,
  clock: number
};


function copyObject (o) {
  var c = {};
  for (var key in o) {
    c[key] = o[key];
  }
  return c;
}

type StateVector = Array<State>;
type OperationSet = Object; // os[Id] = op
type StateSet = Object;

Y.Memory = (function(){ //eslint-disable-line no-unused-vars
  class Transaction extends AbstractTransaction { //eslint-disable-line
    ss: StateSet;
    os: OperationSet;
    store: OperationStore;

    constructor (store : OperationStore) {
      super(store);
      this.ss = store.ss;
      this.os = store.os;
    }
    *setOperation (op) {
      if (op.struct === "Insert" && op.right === undefined) {
        throw new Error("here!");
      }
      this.os[JSON.stringify(op.id)] = op;
      return op;
    }
    *getOperation (id) {
      var op = this.os[JSON.stringify(id)];
      if (op == null) {
        throw new Error("Op does not exist..");
      } else {
        return op;
      }
    }
    *removeOperation (id) {
      delete this.os[JSON.stringify(id)];
    }
    *setState (state : State) : State {
      this.ss[state.user] = state.clock;
    }
    *getState (user : string) : State {
      var clock = this.ss[user];
      if (clock == null){
        clock = 0;
      }
      return {
        user: user,
        clock: clock
      };
    }
    *getStateVector () : StateVector {
      var stateVector = [];

      for (var user in this.ss) {
        var clock = this.ss[user];
        stateVector.push({
          user: user,
          clock: clock
        });
      }
      return stateVector;
    }
    *getStateSet () : StateSet {
      return this.ss;
    }
    *getOperations (startSS : StateSet) {
      if (startSS == null){
        startSS = {};
      }
      var ops = [];

      var endSV : StateVector = yield* this.getStateVector();
      for (var endState of endSV) {
        var user = endState.user;
        if (user === "_") {
          continue;
        }
        var startPos = startSS[user] || 0;
        var endPos = endState.clock;

        for (var clock = startPos; clock <= endPos; clock++) {
          var op = this.os[JSON.stringify([user, clock])];
          if (op != null) {
            op = Struct[op.struct].encode(op);
            ops.push(yield* this.makeOperationReady.call(this, startSS, op));
          }
        }
      }
      return ops;
    }
    *makeOperationReady (ss, op) {
      // instead of ss, you could use currSS (a ss that increments when you add an operation)
      var clock;
      var o = op;
      while (o.right != null){
        // while unknown, go to the right
        o = yield* this.getOperation(o.right);
        clock = ss[o.id[0]];
        if (clock != null && o.id[1] < clock) {
          break;
        }
      }
      op = copyObject(op);
      op.right = (o == null) ? null : o.id;
      return op;
    }
  }
  class OperationStore extends AbstractOperationStore { //eslint-disable-line no-undef
    constructor (y) {
      super(y);
      this.os = {};
      this.ss = {};
    }
    requestTransaction (makeGen : Function) {
      var t = new Transaction(this);
      var gen = makeGen.call(t, new Y.Map.Create(["_", 0]));
      var res = gen.next();
      while(!res.done){
        if (res.value === "transaction") {
          res = gen.next(t);
        } else {
          throw new Error("You may not yield this type. (Maybe you meant to use 'yield*'?)");
        }
      }
    }
    *removeDatabase () {
      delete this.os;
    }
  }
  return OperationStore;
})();
