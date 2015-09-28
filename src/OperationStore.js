/* global Y */
'use strict'

/*
  Partial definition of a transaction
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
  * createType (model) {
    var sid = JSON.stringify(model.id)
    var t = yield* Y[model.type].initType.call(this, this.store, model)
    this.store.initializedTypes[sid] = t
    return t
  }
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
    Delete an operation from the OS, and add it to the GC, if necessary.

    Rulez:
    * The most left element in a list must not be deleted.
      => There is at least one element in the list
    * When an operation o is deleted, then it checks if its right operation
      can be gc'd (iff it's deleted)
  */
  * deleteOperation (targetId) {
    var target = yield* this.getOperation(targetId)

    if (target == null || !target.deleted) {
      this.ds.markDeleted(targetId)
      var state = yield* this.getState(targetId[0])
      if (state.clock === targetId[1]) {
        yield* this.checkDeleteStoreForState(state)
        yield* this.setState(state)
      }
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

      this.store.addToGarbageCollector(target, left, right)

      // set here because it was deleted and/or gc'd
      yield* this.setOperation(target)

      if (
        left != null &&
        left.left != null &&
        this.store.addToGarbageCollector(left, yield* this.getOperation(left.left), target)
      ) {
        yield* this.setOperation(left)
      }

      if (
        right != null &&
        right.right != null &&
        this.store.addToGarbageCollector(right, target, yield* this.getOperation(right.right))
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

    if (o.left != null) {
      var left = yield* this.getOperation(o.left)
      left.right = o.right
      yield* this.setOperation(left)
    }
    if (o.right != null) {
      var right = yield* this.getOperation(o.right)
      right.left = o.left
      yield* this.setOperation(right)
    }
    var parent = yield* this.getOperation(o.parent)
    var setParent = false
    if (Y.utils.compareIds(parent.start, o.id)) {
      setParent = true
      parent.start = o.right
    }
    if (Y.utils.compareIds(parent.end, o.id)) {
      setParent = true
      parent.end = o.left
    }
    if (setParent) {
      yield* this.setOperation(parent)
    }
    yield* this.removeOperation(o.id)
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
      if (op.deleted && op.left != null && op.right != null) {
        var left = os.find(op.left)
        var right = os.find(op.right)
        self.addToGarbageCollector(op, left, right)
      }
    })
  }
  /*
    Try to add to GC.

    TODO: rename this function

    Only gc when
       * creator of op is online
       * left & right defined and both are from the same creator as op

    returns true iff op was added to GC
  */
  addToGarbageCollector (op, left, right) {
    if (
      op.gc == null &&
      op.deleted === true &&
      this.y.connector.isSynced &&
      // (this.y.connector.connections[op.id[0]] != null || op.id[0] === this.y.connector.userId) &&
      left != null &&
      right != null &&
      left.deleted &&
      right.deleted &&
      left.id[0] === op.id[0] &&
      right.id[0] === op.id[0]
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
  apply (ops) {
    for (var key in ops) {
      var o = ops[key]
      if (o.gc == null) { // TODO: why do i get the same op twice?
        if (o.deleted == null) {
          var required = Y.Struct[o.struct].requiredOps(o)
          this.whenOperationsExist(required, o)
        } else {
          throw new Error('Ops must not contain deleted field!')
        }
      } else {
        throw new Error("Must not receive gc'd ops!")
      }
    }
  }
  // op is executed as soon as every operation requested is available.
  // Note that Transaction can (and should) buffer requests.
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

    this.requestTransaction(function *() {
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
  removeParentListener (id, f) {
    var ls = this.parentListeners[id]
    if (ls != null) {
      this.parentListeners[id] = ls.filter(function (g) {
        return (f !== g)
      })
    }
  }
  addParentListener (id, f) {
    var ls = this.parentListeners[JSON.stringify(id)]
    if (ls == null) {
      ls = []
      this.parentListeners[JSON.stringify(id)] = ls
    }
    ls.push(f)
  }
}
Y.AbstractOperationStore = AbstractOperationStore
