/* @flow */
class AbstractTransaction { //eslint-disable-line no-unused-vars
  constructor (store : OperationStore) {
    this.store = store;
  }
  *getType (id) {
    var sid = JSON.stringify(id);
    var t = this.store.initializedTypes[sid];
    if (t == null) {
      var op = yield* this.getOperation(id);
      if (op != null) {
        t = yield* Y[op.type].create(this.store, op.id);
        this.store.initializedTypes[sid] = t;
      }
    }
    return t;
  }
  *createType (model) {
    var sid = JSON.stringify(model.id);
    var t = yield* Y[model.type].create(this.store, model);
    this.store.initializedTypes[sid] = t;
    return t;
  }
  // returns false if operation is not expected.
  *addOperation (op) {
    var state = yield* this.getState(op.id[0]);
    if (op.id[1] === state.clock){
      state.clock++;
      yield* this.setState(state);
      this.os.add(op);
      this.store.operationAdded(op);
      return true;
    } else if (op.id[1] < state.clock) {
      return false;
    } else {
      throw new Error("Operations must arrive in order!");
    }
  }
}

type Listener = {
  f : GeneratorFunction, // is called when all operations are available
  missing : number // number of operations that are missing
}

type Id = [string, number];

class AbstractOperationStore { //eslint-disable-line no-unused-vars
  constructor (y) {
    this.y = y;
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

      Always remember to first overwrite
      a property before you iterate over it!
    */
    // TODO: Use ES7 Weak Maps. This way types that are no longer user,
    // wont be kept in memory.
    this.initializedTypes = {};
  }
  setUserId (userId) {
    this.userId = userId;
  }
  apply (ops) {
    for (var key in ops) {
      var o = ops[key];
      var required = Y.Struct[o.struct].requiredOps(o);
      this.whenOperationsExist(required, o);
    }
  }
  // op is executed as soon as every operation requested is available.
  // Note that Transaction can (and should) buffer requests.
  whenOperationsExist (ids : Array<Id>, op : Operation) {
    if (ids.length > 0) {
      let listener : Listener = {
        op: op,
        missing: ids.length
      };

      for (let key in ids) {
        let id = ids[key];
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
        op: op
      });
    }

    if (this.listenersByIdRequestPending){
      return;
    }

    this.listenersByIdRequestPending = true;
    var store = this;

    this.requestTransaction(function*(){
      var exeNow = store.listenersByIdExecuteNow;
      store.listenersByIdExecuteNow = [];

      var ls = store.listenersById;
      store.listenersById = {};

      store.listenersByIdRequestPending = false;

      for (let key in exeNow) {
        let o = exeNow[key].op;
        yield* Struct[o.struct].execute.call(this, o);
      }

      for (var sid in ls){
        var l = ls[sid];
        var id = JSON.parse(sid);
        if ((yield* this.getOperation(id)) == null){
          store.listenersById[sid] = l;
        } else {
          for (let key in l) {
            let listener = l[key];
            let o = listener.op;
            if (--listener.missing === 0){
              yield* Struct[o.struct].execute.call(this, o);
            }
          }
        }
      }
    });
  }
  // called by a transaction when an operation is added
  operationAdded (op) {
    var sid = JSON.stringify(op.id);
    var l = this.listenersById[sid];
    delete this.listenersById[sid];

    // notify whenOperation listeners (by id)
    if (l != null) {
      for (var key in l){
        var listener = l[key];
        if (--listener.missing === 0){
          this.whenOperationsExist([], listener.op);
        }
      }
    }
    // notify parent, if it has been initialized as a custom type
    var t = this.initializedTypes[JSON.stringify(op.parent)];
    if (t != null) {
      t._changed(op);
    }
  }
  removeParentListener (id, f) {
    var ls = this.parentListeners[id];
    if (ls != null) {
      this.parentListeners[id] = ls.filter(function(g){
        return (f !== g);
      });
    }
  }
  addParentListener (id, f) {
    var ls = this.parentListeners[JSON.stringify(id)];
    if (ls == null) {
      ls = [];
      this.parentListeners[JSON.stringify(id)] = ls;
    }
    ls.push(f);
  }
}
