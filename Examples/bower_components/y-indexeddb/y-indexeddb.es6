(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y) {
  class Store {
    constructor (transaction, name) {
      this.store = transaction.objectStore(name)
    }
    * find (id) {
      return yield this.store.get(id)
    }
    * put (v) {
      yield this.store.put(v)
    }
    * delete (id) {
      yield this.store.delete(id)
    }
    * findWithLowerBound (start) {
      return yield this.store.openCursor(window.IDBKeyRange.lowerBound(start))
    }
    * findWithUpperBound (end) {
      return yield this.store.openCursor(window.IDBKeyRange.upperBound(end), 'prev')
    }
    * findNext (id) {
      return yield* this.findWithLowerBound([id[0], id[1] + 1])
    }
    * findPrev (id) {
      return yield* this.findWithUpperBound([id[0], id[1] - 1])
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
      while ((yield cursorResult) != null) {
        yield* gen.call(t, cursorResult.result.value)
        cursorResult.result.continue()
      }
    }

  }
  class Transaction extends Y.Transaction {
    constructor (store) {
      super(store)
      var transaction = store.db.transaction(['OperationStore', 'StateStore', 'DeleteStore'], 'readwrite')
      this.store = store
      this.ss = new Store(transaction, 'StateStore')
      this.os = new Store(transaction, 'OperationStore')
      this.ds = new Store(transaction, 'DeleteStore')
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
      var store = this
      // initialize database!
      this.requestTransaction(function * () {
        store.db = yield window.indexedDB.open(opts.namespace, store.idbVersion)
      })
      if (opts.cleanStart) {
        this.requestTransaction(function * () {
          yield this.os.store.clear()
          yield this.ds.store.clear()
          yield this.ss.store.clear()
        })
      }
      var operationsToAdd = []
      window.addEventListener('storage', function (event) {
        if (event.key === '__YJS__' + store.namespace) {
          operationsToAdd.push(event.newValue)
          if (operationsToAdd.length === 1) {
            store.requestTransaction(function * () {
              var add = operationsToAdd
              operationsToAdd = []
              for (var i in add) {
                // don't call the localStorage event twice..
                var op = JSON.parse(add[i])
                if (op.struct !== 'Delete') {
                  op = yield* this.getOperation(op.id)
                }
                yield* this.store.operationAdded(this, op, true)
              }
            })
          }
        }
      }, false)
    }
    * operationAdded (transaction, op, noAdd) {
      yield* super.operationAdded(transaction, op)
      if (!noAdd) {
        window.localStorage['__YJS__' + this.namespace] = JSON.stringify(op)
      }
    }
    transact (makeGen) {
      var transaction = this.db != null ? new Transaction(this) : null
      var store = this

      var gen = makeGen.call(transaction)
      handleTransactions(gen.next())

      function handleTransactions (result) {
        var request = result.value
        if (result.done) {
          makeGen = store.getNextRequest()
          if (makeGen != null) {
            if (transaction == null && store.db != null) {
              transaction = new Transaction(store)
            }
            gen = makeGen.call(transaction)
            handleTransactions(gen.next())
          } // else no transaction in progress!
          return
        }
        if (request.constructor === window.IDBRequest) {
          request.onsuccess = function () {
            var res = request.result
            if (res != null && res.constructor === window.IDBCursorWithValue) {
              res = res.value
            }
            handleTransactions(gen.next(res))
          }
          request.onerror = function (err) {
            gen.throw(err)
          }
        } else if (request.constructor === window.IDBCursor) {
          request.onsuccess = function () {
            handleTransactions(gen.next(request.result != null ? request.result.value : null))
          }
          request.onerror = function (err) {
            gen.throw(err)
          }
        } else if (request.constructor === window.IDBOpenDBRequest) {
          request.onsuccess = function (event) {
            var db = event.target.result
            handleTransactions(gen.next(db))
          }
          request.onerror = function () {
            gen.throw("Couldn't open IndexedDB database!")
          }
          request.onupgradeneeded = function (event) {
            var db = event.target.result
            try {
              db.createObjectStore('OperationStore', {keyPath: 'id'})
              db.createObjectStore('DeleteStore', {keyPath: 'id'})
              db.createObjectStore('StateStore', {keyPath: 'id'})
            } catch (e) {
              console.log('Store already exists!')
            }
          }
        } else {
          gen.throw('You must not yield this type!')
        }
      }
    }
    // TODO: implement "free"..
    * destroy () {
      this.db.close()
      yield window.indexedDB.deleteDatabase(this.namespace)
    }
  }
  Y.extend('indexeddb', OperationStore)
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}]},{},[1])

