/* @flow */
'use strict'

module.exports = function (Y /* :YGlobal */) {
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
  class AbstractDatabase {
    /* ::
    y: YConfig;
    forwardAppliedOperations: boolean;
    listenersById: Object;
    listenersByIdExecuteNow: Array<Object>;
    listenersByIdRequestPending: boolean;
    initializedTypes: Object;
    whenUserIdSetListener: ?Function;
    waitingTransactions: Array<Transaction>;
    transactionInProgress: boolean;
    executeOrder: Array<Object>;
    gc1: Array<Struct>;
    gc2: Array<Struct>;
    gcTimeout: number;
    gcInterval: any;
    garbageCollect: Function;
    executeOrder: Array<any>; // for debugging only
    userId: UserId;
    opClock: number;
    transactionsFinished: ?{promise: Promise, resolve: any};
    transact: (x: ?Generator) => any;
    */
    constructor (y, opts) {
      this.y = y
      // whether to broadcast all applied operations (insert & delete hook)
      this.forwardAppliedOperations = false
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
      this.waitingTransactions = []
      this.transactionInProgress = false
      if (typeof YConcurrency_TestingMode !== 'undefined') {
        this.executeOrder = []
      }
      this.gc1 = [] // first stage
      this.gc2 = [] // second stage -> after that, remove the op
      this.gcTimeout = opts.gcTimeout || 5000
      var os = this
      function garbageCollect () {
        return new Promise((resolve) => {
          os.requestTransaction(function * () {
            if (os.y.connector != null && os.y.connector.isSynced) {
              for (var i = 0; i < os.gc2.length; i++) {
                var oid = os.gc2[i]
                yield* this.garbageCollectOperation(oid)
              }
              os.gc2 = os.gc1
              os.gc1 = []
            }
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
    addToDebug () {
      if (typeof YConcurrency_TestingMode !== 'undefined') {
        var command /* :string */ = Array.prototype.map.call(arguments, function (s) {
          if (typeof s === 'string') {
            return s
          } else {
            return JSON.stringify(s)
          }
        }).join('').replace(/"/g, "'").replace(/,/g, ', ').replace(/:/g, ': ')
        this.executeOrder.push(command)
      }
    }
    getDebugData () {
      console.log(this.executeOrder.join('\n'))
    }
    stopGarbageCollector () {
      var self = this
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          var ungc /* :Array<Struct> */ = self.gc1.concat(self.gc2)
          self.gc1 = []
          self.gc2 = []
          for (var i = 0; i < ungc.length; i++) {
            var op = yield* this.getOperation(ungc[i])
            delete op.gc
            yield* this.setOperation(op)
          }
          resolve()
        })
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
        left.deleted === true
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
      var self = this
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          self.userId = userId
          var state = yield* this.getState(userId)
          self.opClock = state.clock
          if (self.whenUserIdSetListener != null) {
            self.whenUserIdSetListener()
            self.whenUserIdSetListener = null
          }
          resolve()
        })
      })
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

        for (let key = 0; key < exeNow.length; key++) {
          let o = exeNow[key].op
          yield* store.tryExecute.call(this, o)
        }

        for (var sid in ls) {
          var l = ls[sid]
          var id = JSON.parse(sid)
          var op = yield* this.getOperation(id)
          if (op == null) {
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
    */
    /* :: // TODO: this belongs somehow to transaction
    store: Object;
    getOperation: any;
    isGarbageCollected: any;
    addOperation: any;
    whenOperationsExist: any;
    */
    * tryExecute (op) {
      this.store.addToDebug('yield* this.store.tryExecute.call(this, ', JSON.stringify(op), ')')
      if (op.struct === 'Delete') {
        yield* Y.Struct.Delete.execute.call(this, op)
        yield* this.store.operationAdded(this, op)
      } else {
        var defined = yield* this.getOperation(op.id)
        if (defined == null) {
          var isGarbageCollected = yield* this.isGarbageCollected(op.id)
          if (!isGarbageCollected) {
            yield* Y.Struct[op.struct].execute.call(this, op)
            yield* this.addOperation(op)
            yield* this.store.operationAdded(this, op)
          }
        }
      }
    }
    // called by a transaction when an operation is added
    * operationAdded (transaction, op) {
      if (op.struct === 'Delete') {
        var target = yield* transaction.getOperation(op.target)
        if (target != null) {
          var type = transaction.store.initializedTypes[JSON.stringify(target.parent)]
          if (type != null) {
            yield* type._changed(transaction, {
              struct: 'Delete',
              target: op.target
            })
          }
        }
      } else {
        // increase SS
        var o = op
        var state = yield* transaction.getState(op.id[0])
        while (o != null && o.id[1] === state.clock && op.id[0] === o.id[0]) {
          // either its a new operation (1. case), or it is an operation that was deleted, but is not yet in the OS
          state.clock++
          yield* transaction.checkDeleteStoreForState(state)
          o = yield* transaction.os.findNext(o.id)
        }
        yield* transaction.setState(state)

        // notify whenOperation listeners (by id)
        var sid = JSON.stringify(op.id)
        var l = this.listenersById[sid]
        delete this.listenersById[sid]

        if (l != null) {
          for (var key in l) {
            var listener = l[key]
            if (--listener.missing === 0) {
              this.whenOperationsExist([], listener.op)
            }
          }
        }
        var t = this.initializedTypes[JSON.stringify(op.parent)]

        // Delete if DS says this is actually deleted
        var opIsDeleted = yield* transaction.isDeleted(op.id)
        if (!op.deleted && opIsDeleted) {
          var delop = {
            struct: 'Delete',
            target: op.id
          }
          yield* Y.Struct['Delete'].execute.call(transaction, delop)
        }

        // notify parent, if it has been initialized as a custom type
        if (t != null) {
          yield* t._changed(transaction, Y.utils.copyObject(op))
        }
      }
    }
    whenTransactionsFinished () {
      if (this.transactionInProgress) {
        if (this.transactionsFinished == null) {
          var resolve
          var promise = new Promise(function (r) {
            resolve = r
          })
          this.transactionsFinished = {
            resolve: resolve,
            promise: promise
          }
          return promise
        } else {
          return this.transactionsFinished.promise
        }
      } else {
        return Promise.resolve()
      }
    }
    getNextRequest () {
      if (this.waitingTransactions.length === 0) {
        this.transactionInProgress = false
        if (this.transactionsFinished != null) {
          this.transactionsFinished.resolve()
          this.transactionsFinished = null
        }
        return null
      } else {
        return this.waitingTransactions.shift()
      }
    }
    requestTransaction (makeGen/* :any */, callImmediately) {
      if (callImmediately) {
        this.waitingTransactions.push(makeGen)
        if (!this.transactionInProgress) {
          this.transactionInProgress = true
          this.transact(this.getNextRequest())
        }
      } else {
        this.waitingTransactions.push(makeGen)
        if (!this.transactionInProgress) {
          this.transactionInProgress = true
          var self = this
          setTimeout(function () {
            self.transact(self.getNextRequest())
          }, 0)
        }
      }
    }
  }
  Y.AbstractDatabase = AbstractDatabase
}
