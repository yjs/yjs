/* @flow */
class AbstractTransaction { //eslint-disable-line no-unused-vars
  constructor (store : OperationStore) {
    this.store = store;
  }
  // Throws if operation is not expected.
  *addOperation (op) {
    var state = this.getState(op.id[0]);
    if (op.id[1] === state.clock){
      state.clock++;
      yield* this.setState(state);
      this.store.operationAdded(op);
      return true;
    } else {
      return false;
    }
  }
}

type Listener = {
  f : GeneratorFunction, // is called when all operations are available
  missing : number // number of operations that are missing
}

type GeneratorFunction = Function;

type Id = [string, number];

class AbstractOperationStore { //eslint-disable-line no-unused-vars
  constructor () {
    // E.g. this.listenersById[id] : Array<Listener>
    this.listenersById = {};
    // Execute the next time a transaction is requested
    this.listenersByIdExecuteNow = [];
    // A transaction is requested
    this.listenersByIdRequestPending = false;
    /* To make things more clear, the following naming conventions:
       * ls : we put this.listenersById on ls
       * l : Array<Listener>
       * id : Id (can't use as property name)
       * sid : String (converted from id via JSON.stringify
                       so we can use it as a property name)

      Always remember to first overwrite over
      a property before you iterate over it!
    */
  }
  // f is called as soon as every operation requested is available.
  // Note that Transaction can (and should) buffer requests.
  whenOperationsExist (ids : Array<Id>, f : GeneratorFunction, args : Array<any>) {
    if (ids.length > 0) {
      let listener : Listener = {
        f: f,
        args: args || [],
        missing: ids.length
      };

      for (let id of ids) {
        let sid = JSON.stringify(id);
        let l = this.listenersById[sid];
        if (l == null){
          l = [];
          this.listenersById[sid] = l;
        }
        l.push(listener);
      }
    } else {
      this.listenersByIdExecuteNow.push({
        f: f,
        args: args || []
      });
    }

    if (this.listenersByIdRequestPending){
      return;
    }

    this.listenersByIdRequestPending = true;
    var store = this;

    this.requestTransaction(function*(){
      var exe = store.listenersByIdExecuteNow;
      store.listenersByIdExecuteNow = [];
      for (let listener of exe) {
        yield* listener.f.apply(this, listener.args);
      }

      var ls = store.listenersById;
      store.listenersById = {};
      for (var sid in ls){
        var l = ls[sid];
        var id = JSON.parse(sid);
        if ((yield* this.getOperation(id)) == null){
          store.listenersById[sid] = l;
        } else {
          for (let listener of l) {
            if (--listener.missing === 0){
              yield* listener.f.apply(this, listener.args);
            }
          }
        }
      }

      store.listenersByIdRequestPending = false;
    });

  }
  // called by a transaction when an operation is added
  operationAdded (op) {
    var l = this.listenersById[op.id];
    for (var listener of l){
      if (--listener.missing === 0){
        this.whenOperationsExist([], listener.f, listener.args);
      }
    }
  }
}
