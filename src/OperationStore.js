/* global Y */
'use strict'

/*
  Partial definition of a transaction
  
  A transaction provides all the the async functionality on a database.
  
  By convention, a transaction has the following properties:
  * ss for StateSet
  * os for OperationStore
  * ds for DeleteStore

  A transaction must also define the following methods:
  * checkDeleteStoreForState(state)
    - When increasing the state of a user, an operation with an higher id
      may already be garbage collected, and therefore it will never be received.
      update the state to reflect this knowledge. This won't call a method to save the state!
  * getDeleteSet(id)
    - Get the delete set in a readable format:
      {
        "userX": [
          [5,1], // starting from position 5, one operations is deleted
          [9,4]  // starting from position 9, four operations are deleted
        ],
        "userY": ...
      }
  * isDeleted(id)
  * getOpsFromDeleteSet(ds) -- TODO: just call this.deleteOperation(id) here
    - get a set of deletions that need to be applied in order to get to
      achieve the state of the supplied ds
  * setOperation(op)
    - write `op` to the database.
      Note: this is allowed to return an in-memory object.
      E.g. the Memory adapter returns the object that it has in-memory.
      Changing values on this object will be stored directly in the database
      without calling this function. Therefore,
      setOperation may have no functionality in some adapters. This also has
      implications on the way we use operations that were served from the database.
      We try not to call copyObject, if not necessary.
  * addOperation(op)
    - add an operation to the database.
      This may only be called once for every op.id
  * getOperation(id)
  * removeOperation(id)
    - remove an operation from the database. This is called when an operation
      is garbage collected.
  * setState(state)
    - `state` is of the form
      {
        user: "1",
        clock: 4
      } <- meaning that we have four operations from user "1"
           (with these id's respectively: 0, 1, 2, and 3)
  * getState(user)
  * getStateVector()
    - Get the state of the OS in the form
    [{
      user: "userX",
      clock: 11
    },
     ..
    ]
  * getStateSet()
    - Get the state of the OS in the form
    {
      "userX": 11,
      "userY": 22
    }
   * getOperations(startSS)
     - Get the all the operations that are necessary in order to achive the
       stateSet of this user, starting from a stateSet supplied by another user
   * makeOperationReady(ss, op)
     - this is called only by `getOperations(startSS)`. It makes an operation
       applyable on a given SS.
*/
class AbstractTransaction {
  constructor (store) {
    this.store = store
  }
  /*
    Get a type based on the id of its model.
    If it does not exist yes, create it.
  */
  * getType (id) {
    var sid = JSON.stringify(id)
    var t = this.store.initializedTypes[sid]
    if (t == null) {
      var op = yield* this.getOperation(id)
      if (op != null) {
        t = yield* Y[op.type].initType.call(this, this.store, op)
        this.store.initializedTypes[sid] = t
      }
    }
    return t
  }
  /*
    Apply operations that this user created (no remote ones!)
      * does not check for Struct.*.requiredOps()
      * also broadcasts it through the connector
  */
  * applyCreatedOperations (ops) {
    var send = []
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i]
      yield* this.store.tryExecute.call(this, op)
      send.push(Y.utils.copyObject(Y.Struct[op.struct].encode(op)))
    }
    if (this.store.y.connector.broadcastedHB) {
      this.store.y.connector.broadcast({
        type: 'update',
        ops: send
      })
    }
  }
  /*
    Mark an operation as deleted, and add it to the GC, if possible.
  */
  * deleteOperation (targetId) {
    var target = yield* this.getOperation(targetId)

    if (target == null || !target.deleted) {
      this.ds.markDeleted(targetId)
    }

    if (target != null && target.gc == null) {
      if (!target.deleted) {
        // set deleted & notify type
        target.deleted = true
        var type = this.store.initializedTypes[JSON.stringify(target.parent)]
        if (type != null) {
          yield* type._changed(this, {
            struct: 'Delete',
            target: targetId
          })
        }
      }
      var left = target.left != null ? yield* this.getOperation(target.left) : null
      var right = target.right != null ? yield* this.getOperation(target.right) : null

      this.store.addToGarbageCollector(target, left)

      // set here because it was deleted and/or gc'd
      yield* this.setOperation(target)

      // check if it is possible to add right to the gc (this delete can't be responsible for left being gc'd)
      if (
        right != null &&
        right.right != null &&
        this.store.addToGarbageCollector(right, target)
      ) {
        yield* this.setOperation(right)
      }
    }
  }
  * garbageCollectOperation (id) {
    var o = yield* this.getOperation(id)

    if (o == null) {
      return
    }

    if (!o.deleted) {
      yield* this.deleteOperation(id)
      o = yield* this.getOperation(id)
    }
    
    // check to increase the state of the respective user
    var state = yield* this.getState(id[0])
    if (state.clock === id[1]) {
      // also check if more expected operations were gc'd
      yield* this.checkDeleteStoreForState(state)
      // then set the state
      yield* this.setState(state)
    }

    // remove gc'd op from the left op, if it exists
    if (o.left != null) {
      var left = yield* this.getOperation(o.left)
      left.right = o.right
      yield* this.setOperation(left)
    }
    // remove gc'd op from the right op, if it exists
    if (o.right != null) {
      var right = yield* this.getOperation(o.right)
      right.left = o.left
      yield* this.setOperation(right)
    }
    // remove gc'd op from parent, if it exists
    var parent = yield* this.getOperation(o.parent)
    var setParent = false // whether to save parent to the os
    if (Y.utils.compareIds(parent.start, o.id)) {
      // gc'd op is the start
      setParent = true
      parent.start = o.right
    }
    if (Y.utils.compareIds(parent.end, o.id)) {
      // gc'd op is the end
      setParent = true
      parent.end = o.left
    }
    if (setParent) {
      yield* this.setOperation(parent)
    }
    yield* this.removeOperation(o.id) // actually remove it from the os
    yield* this.ds.markGarbageCollected(o.id)
  }
}
Y.AbstractTransaction = AbstractTransaction

/*
  Partial definition of an OperationStore.
  TODO: name it Database, operation store only holds operations.

  A database definition must alse define the following methods:
  * logTable() (optional)
    - show relevant information information in a table
  * requestTransaction(makeGen)
    - request a transaction
  * destroy()
    - destroy the database
*/
class AbstractOperationStore {
  constructor (y, opts) {
    this.y = y
    // E.g. this.listenersById[id] : Array<Listener>
    this.listenersById = {}
    // Execute the next time a transaction is requested
    this.listenersByIdExecuteNow = []
    // A transaction is requested
    this.listenersByIdRequestPending = false
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
    this.initializedTypes = {}
    this.whenUserIdSetListener = null
    this.waitingOperations = new Y.utils.RBTree()

    this.gc1 = [] // first stage
    this.gc2 = [] // second stage -> after that, remove the op
    this.gcTimeout = opts.gcTimeout || 5000
    var os = this
    function garbageCollect () {
      return new Promise((resolve) => {
        os.requestTransaction(function * () {
          for (var i in os.gc2) {
            var oid = os.gc2[i]
            yield* this.garbageCollectOperation(oid)
          }
          os.gc2 = os.gc1
          os.gc1 = []
          if (os.gcTimeout > 0) {
            os.gcInterval = setTimeout(garbageCollect, os.gcTimeout)
          }
          resolve()
        })
      })
    }
    this.garbageCollect = garbageCollect
    if (this.gcTimeout > 0) {
      garbageCollect()
    }
  }
  garbageCollectAfterSync () {
    var os = this.os
    var self = this
    os.iterate(null, null, function (op) {
      if (op.deleted && op.left != null) {
        var left = os.find(op.left)
        self.addToGarbageCollector(op, left)
      }
    })
  }
  /*
    Try to add to GC.

    TODO: rename this function
    
    Rulez:
    * Only gc if this user is online
    * The most left element in a list must not be gc'd.
      => There is at least one element in the list
    
    returns true iff op was added to GC
  */
  addToGarbageCollector (op, left) {
    if (
      op.gc == null &&
      op.deleted === true &&
      this.y.connector.isSynced &&
      left != null &&
      left.deleted &&
    ) {
      op.gc = true
      this.gc1.push(op.id)
      return true
    } else {
      return false
    }
  }
  removeFromGarbageCollector (op) {
    function filter (o) {
      return !Y.utils.compareIds(o, op.id)
    }
    this.gc1 = this.gc1.filter(filter)
    this.gc2 = this.gc2.filter(filter)
    delete op.gc
  }
  destroy () {
    clearInterval(this.gcInterval)
    this.gcInterval = null
  }
  setUserId (userId) {
    this.userId = userId
    this.opClock = 0
    if (this.whenUserIdSetListener != null) {
      this.whenUserIdSetListener()
      this.whenUserIdSetListener = null
    }
  }
  whenUserIdSet (f) {
    if (this.userId != null) {
      f()
    } else {
      this.whenUserIdSetListener = f
    }
  }
  getNextOpId () {
    if (this.userId == null) {
      throw new Error('OperationStore not yet initialized!')
    }
    return [this.userId, this.opClock++]
  }
  /*
    Apply a list of operations.
    
    * get a transaction
    * check whether all Struct.*.requiredOps are in the OS
    * check if it is an expected op (otherwise wait for it)
    * check if was deleted, apply a delete operation after op was applied
  */
  apply (ops) {
    for (var key in ops) {
      var o = ops[key]
      var required = Y.Struct[o.struct].requiredOps(o)
      this.whenOperationsExist(required, o)
    }
  }
  /*
    op is executed as soon as every operation requested is available.
    Note that Transaction can (and should) buffer requests.
  */
  whenOperationsExist (ids, op) {
    if (ids.length > 0) {
      let listener = {
        op: op,
        missing: ids.length
      }

      for (let key in ids) {
        let id = ids[key]
        let sid = JSON.stringify(id)
        let l = this.listenersById[sid]
        if (l == null) {
          l = []
          this.listenersById[sid] = l
        }
        l.push(listener)
      }
    } else {
      this.listenersByIdExecuteNow.push({
        op: op
      })
    }

    if (this.listenersByIdRequestPending) {
      return
    }

    this.listenersByIdRequestPending = true
    var store = this

    this.requestTransaction(function * () {
      var exeNow = store.listenersByIdExecuteNow
      store.listenersByIdExecuteNow = []

      var ls = store.listenersById
      store.listenersById = {}

      store.listenersByIdRequestPending = false

      for (let key in exeNow) {
        let o = exeNow[key].op
        yield* store.tryExecute.call(this, o)
      }

      for (var sid in ls) {
        var l = ls[sid]
        var id = JSON.parse(sid)
        if ((yield* this.getOperation(id)) == null) {
          store.listenersById[sid] = l
        } else {
          for (let key in l) {
            let listener = l[key]
            let o = listener.op
            if (--listener.missing === 0) {
              yield* store.tryExecute.call(this, o)
            }
          }
        }
      }
    })
  }
  /*
    Actually execute an operation, when all expected operations are available.
    If op is not yet expected, add it to the list of waiting operations.
      
    This will also try to execute waiting operations
    (ops that were not expected yet), after it was applied
  */
  * tryExecute (op) {
    if (op.struct === 'Delete') {
      yield* Y.Struct.Delete.execute.call(this, op)
    } else {
      while (op != null) {
        var state = yield* this.getState(op.id[0])
        if (op.id[1] === state.clock) {
          // either its a new operation (1. case), or it is an operation that was deleted, but is not yet in the OS
          if (op.id[1] === state.clock) {
            state.clock++
            yield* this.checkDeleteStoreForState(state)
            yield* this.setState(state)
          }

          yield* Y.Struct[op.struct].execute.call(this, op)
          yield* this.addOperation(op)
          yield* this.store.operationAdded(this, op)

          // Delete if DS says this is actually deleted
          if (this.store.ds.isDeleted(op.id)) {
            yield* Y.Struct['Delete'].execute.call(this, {struct: 'Delete', target: op.id})
          }

          // find next operation to execute
          op = this.store.waitingOperations.find([op.id[0], state.clock])
          if (op != null) {
            this.store.waitingOperations.delete([op.id[0], state.clock])
          }
        } else {
          if (op.id[1] > state.clock) {
            // has to be executed at some point later
            this.store.waitingOperations.add(op)
          }
          op = null
        }
      }
    }
  }
  // called by a transaction when an operation is added
  * operationAdded (transaction, op) {
    var sid = JSON.stringify(op.id)
    var l = this.listenersById[sid]
    delete this.listenersById[sid]

    // notify whenOperation listeners (by id)
    if (l != null) {
      for (var key in l) {
        var listener = l[key]
        if (--listener.missing === 0) {
          this.whenOperationsExist([], listener.op)
        }
      }
    }
    // notify parent, if it has been initialized as a custom type
    var t = this.initializedTypes[JSON.stringify(op.parent)]
    if (t != null && !op.deleted) {
      yield* t._changed(transaction, Y.utils.copyObject(op))
    }
  }
}
Y.AbstractOperationStore = AbstractOperationStore
