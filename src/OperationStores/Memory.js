
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
type StateSet = Object;

Y.Memory = (function(){ //eslint-disable-line no-unused-vars
  class Transaction extends AbstractTransaction { //eslint-disable-line
    ss: StateSet;
    os: RBTree;
    store: OperationStore;

    constructor (store : OperationStore) {
      super(store);
      this.ss = store.ss;
      this.os = store.os;
    }
    *setOperation (op) {
      // TODO: you can remove this step! probs..
      var n = this.os.findNode(op.id);
      n.val = op;
      return op;
    }
    *addOperation (op) {
      this.os.add(op);
    }
    *getOperation (id) {
      if (id == null) {
        throw new Error("You must define id!");
      }
      return this.os.find(id);
    }
    *removeOperation (id) {
      this.os.delete(id);
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
      // TODO: use bounds here!
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

        this.os.iterate([user, startPos], [user, endPos], function(op){//eslint-disable-line
          ops.push(Struct[op.struct].encode(op));
        });
      }
      var res = [];
      for (var op of ops) {
        res.push(yield* this.makeOperationReady.call(this, startSS, op));
      }
      return res;
    }
    *makeOperationReady (ss, op) {
      // instead of ss, you could use currSS (a ss that increments when you add an operation)
      var clock;
      var o = op;
      while (o.right != null){
        // while unknown, go to the right
        clock = ss[o.right[0]];
        if (clock != null && o.right[1] < clock) {
          break;
        }
        o = yield* this.getOperation(o.right);
      }
      op = copyObject(op);
      op.right = o.right;
      return op;
    }
  }
  class OperationStore extends AbstractOperationStore { //eslint-disable-line no-undef
    constructor (y) {
      super(y);
      this.os = new RBTree();
      this.ss = {};
      this.waitingTransactions = [];
      this.transactionInProgress = false;
    }
    requestTransaction (_makeGen : Function) {
      if (!this.transactionInProgress) {
        this.transactionInProgress = true;
        window.setTimeout(() => {
          var makeGen = _makeGen;
          while (makeGen != null) {
            var t = new Transaction(this);
            var gen = makeGen.call(t);
            var res = gen.next();
            while(!res.done){
              if (res.value === "transaction") {
                res = gen.next(t);
              } else {
                throw new Error("You must not yield this type. (Maybe you meant to use 'yield*'?)");
              }
            }
            makeGen = this.waitingTransactions.shift();
          }
          this.transactionInProgress = false;
        }, 0);
      } else {
        this.waitingTransactions.push(_makeGen);
      }
    }
    *removeDatabase () {
      delete this.os;
    }
  }
  return OperationStore;
})();
