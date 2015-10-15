/* global Y */

'use strict'

Y.IndexedDB = (function () {
  class Store {
    constructor (transaction, name) {
      this.store = transaction.objectStore(name)
    }
    find (id) {
      return this.store.get(id)
    }
    put (v) {
      return this.store.put(v)
    }
    delete (id) {
      return this.store.delete(id)
    }
    * findNodeWithLowerBound (start) {
      var cursorResult = this.store.openCursor(window.IDBKeyRange.lowerBound(start))
      var cursor
      while ((cursor = yield cursorResult) != null) {
        // yield* gen.call(t, cursor.value)
        cursor.continue()
      }
    }
    * iterate (t, start, end, gen) {
      var range = null
      if (start != null && end != null) {
        range = window.IDBKeyRange.bound(start, end)
      } else if (start != null) {
        range = window.IDBKeyRange.lowerBound(start)
      } else if (end != null) {
        range = window.IDBKeyRange.upperBound(end)
      }
      var cursorResult = this.store.openCursor(range)
      var cursor
      while ((cursor = yield cursorResult) != null) {
        yield* gen.call(t, cursor.value)
        cursor.continue()
      }
    }

  }
  class Transaction {
    constructor (store) {
      var transaction = store.db.transaction(['OperationStore', 'StateStore', 'DeleteStore'], 'readwrite')
      this.ss = new Store(transaction, 'StateStore')
      this.os = new Store(transaction, 'OperationStore')
      this.ds = new Store(transaction, 'DeleteStore')
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
  class OperationStore extends Y.AbstractDatabase {
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

      function handleTransactions (t) {
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
              db.createObjectStore('DeleteStore', {keyPath: 'id'})
              db.createObjectStore('StateStore', {keyPath: 'id'})
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
    transact (makeGen) {
      var t = new Y.Transaction(this)
      while (makeGen !== null) {
        var gen = makeGen.call(t)
        var res = gen.next()
        while (!res.done) {
          res = gen.next(res.value)
        }
        makeGen = this.getNextRequest()
      }
    }
    // TODO: implement "free"..
    * destroy () {
      this.db.close()
      yield window.indexedDB.deleteDatabase(this.namespace)
    }
  }
  return OperationStore
})()
