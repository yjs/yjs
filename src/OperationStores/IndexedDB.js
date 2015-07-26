Y.IndexedDB = (function () { // eslint-disable-line
  class Transaction extends AbstractTransaction { // eslint-disable-line
    constructor (store) {
      super(store)
      this.transaction = store.db.transaction(['OperationStore', 'StateVector'], 'readwrite')
      this.sv = this.transaction.objectStore('StateVector')
      this.os = this.transaction.objectStore('OperationStore')
      this.buffer = {}
    }
    * setOperation (op) {
      yield this.os.put(op)
      this.buffer[JSON.stringify(op.id)] = op
      return op
    }
    * getOperation (id) {
      var op = this.buffer[JSON.stringify(id)]
      if (op == null) {
        op = yield this.os.get(id)
        this.buffer[JSON.stringify(id)] = op
      }
      return op
    }
    * removeOperation (id) {
      this.buffer[JSON.stringify(id)] = null
      return yield this.os.delete(id)
    }
    * setState (state) {
      return yield this.sv.put(state)
    }
    * getState (user) {
      var state
      if ((state = yield this.sv.get(user)) != null) {
        return state
      } else {
        return {
          user: user,
          clock: 0
        }
      }
    }
    * getStateVector () {
      var stateVector = []
      var cursorResult = this.sv.openCursor()
      var cursor
      while ((cursor = yield cursorResult) != null) {
        stateVector.push(cursor.value)
        cursor.continue()
      }
      return stateVector
    }
    * getStateSet () {
      var sv = yield* this.getStateVector()
      var ss = {}
      for (var state of sv) {
        ss[state.user] = state.clock
      }
      return ss
    }

    * getOperations (startSS) {
      if (startSS == null) {
        startSS = {}
      }
      var ops = []

      var endSV = yield* this.getStateVector()
      for (var endState of endSV) {
        var user = endState.user
        var startPos = startSS[user] || 0
        var endPos = endState.clock
        var range = window.IDBKeyRange.bound([user, startPos], [user, endPos])
        var cursorResult = this.os.openCursor(range)
        var cursor
        while ((cursor = yield cursorResult) != null) {
          ops.push(cursor.value)
          cursor.continue()
        }
      }
      return ops
    }
  }
  class OperationStore extends AbstractOperationStore { // eslint-disable-line no-undef
    constructor (y, opts) {
      super(y, opts)
      if (opts == null) {
        opts = {}
      }
      if (opts.namespace == null || typeof opts.namespace !== 'string') {
        throw new Error('IndexedDB: expect a string (opts.namespace)!')
      } else {
        this.namespace = opts.namespace
      }
      if (opts.idbVersion != null) {
        this.idbVersion = opts.idbVersion
      } else {
        this.idbVersion = 5
      }

      this.transactionQueue = {
        queue: [],
        onRequest: null
      }

      var store = this

      var tGen = (function * transactionGen () {
        store.db = yield window.indexedDB.open(opts.namespace, store.idbVersion)
        var transactionQueue = store.transactionQueue

        var transaction = null
        var cont = true
        while (cont) {
          var request = yield transactionQueue
          transaction = new Transaction(store)

          yield* request.call(transaction, request) /*
          while (transactionQueue.queue.length > 0) {
            yield* transactionQueue.queue.shift().call(transaction)
          }*/
        }
      })()

      function handleTransactions (t) { // eslint-disable-line no-unused-vars
        var request = t.value
        if (t.done) {
          return
        } else if (request.constructor === window.IDBRequest || request.constructor === window.IDBCursor) {
          request.onsuccess = function () {
            handleTransactions(tGen.next(request.result))
          }
          request.onerror = function (err) {
            tGen.throw(err)
          }
        } else if (request === store.transactionQueue) {
          if (request.queue.length > 0) {
            handleTransactions(tGen.next(request.queue.shift()))
          } else {
            request.onRequest = function () {
              request.onRequest = null
              handleTransactions(tGen.next(request.queue.shift()))
            }
          }
        } else if (request.constructor === window.IDBOpenDBRequest) {
          request.onsuccess = function (event) {
            var db = event.target.result
            handleTransactions(tGen.next(db))
          }
          request.onerror = function () {
            tGen.throw("Couldn't open IndexedDB database!")
          }
          request.onupgradeneeded = function (event) {
            var db = event.target.result
            try {
              db.createObjectStore('OperationStore', {keyPath: 'id'})
              db.createObjectStore('StateVector', {keyPath: 'user'})
            } catch (e) {
              // console.log("Store already exists!")
            }
          }
        } else {
          tGen.throw('You can not yield this type!')
        }
      }
      handleTransactions(tGen.next())

    }
    requestTransaction (makeGen) {
      this.transactionQueue.queue.push(makeGen)
      if (this.transactionQueue.onRequest != null) {
        this.transactionQueue.onRequest()
      }
    }
    * removeDatabase () {
      this.db.close()
      yield window.indexedDB.deleteDatabase(this.namespace)
    }
  }
  return OperationStore
})()
