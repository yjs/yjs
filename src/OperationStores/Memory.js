
type State = {
  user: string,
  clock: number
};

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
      this.os[JSON.stringify(op.id)] = op;
      return op;
    }
    *getOperation (id) {
      return this.os[JSON.stringify(id)];
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
          var op = yield* this.getOperation([user, clock]);
          if (op != null) {
            ops.push(op);
          }
        }
      }
      return ops;
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
      var gen = makeGen.call(t);
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
