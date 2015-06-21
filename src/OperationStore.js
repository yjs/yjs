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

type Id = [string, number];

class AbstractOperationStore { //eslint-disable-line no-unused-vars
  constructor () {
    this.parentListeners = {};
    this.parentListenersRequestPending = false;
    this.parentListenersActivated = {};
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
      var exeNow = store.listenersByIdExecuteNow;
      store.listenersByIdExecuteNow = [];

      var ls = store.listenersById;
      store.listenersById = {};

      store.listenersByIdRequestPending = false;

      for (let listener of exeNow) {
        yield* listener.f.apply(this, listener.args);
      }

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
    });
  }
  // called by a transaction when an operation is added
  operationAdded (op) {
    // notify whenOperation listeners (by id)
    var l = this.listenersById[op.id];
    if (l != null) {
      for (var listener of l){
        if (--listener.missing === 0){
          this.whenOperationsExist([], listener.f, listener.args);
        }
      }
    }
    // notify parent listeners, if possible
    var listeners = this.parentListeners[op.parent];
    if (     this.parentListenersRequestPending
        || ( listeners == null )
        || ( listeners.length === 0 )) {
      return;
    }
    var al = this.parentListenersActivated[JSON.stringify(op.parent)];
    if ( al == null ){
      al = [];
      this.parentListenersActivated[JSON.stringify(op.parent)] = al;
    }
    al.push(op);

    this.parentListenersRequestPending = true;
    var store = this;
    this.requestTransaction(function*(myRequest){ // you can throw error on myRequest, then restart if you have to
      store.parentListenersRequestPending = false;
      var activatedOperations = store.parentListenersActivated;
      store.parentListenersActivated = {};
      for (var parent_id in activatedOperations){
        var parent = yield* this.getOperation(parent_id);
        Struct[parent.type].notifyObservers(activatedOperations[parent_id]);
      }  
    })

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
