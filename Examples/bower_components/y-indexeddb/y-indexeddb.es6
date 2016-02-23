(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y) {
  Y.requestModules(['memory']).then(function () {
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
        var cursorResult
        if (range != null) {
          cursorResult = this.store.openCursor(range)
        } else {
          cursorResult = this.store.openCursor()
        }
        while ((yield cursorResult) != null) {
          yield* gen.call(t, cursorResult.result.value)
          cursorResult.result.continue()
        }
      }
      * flush () {}
    }

    function createStoreClone (Store) {
      class Clone extends Store {
        constructor () {
          super(...arguments)
          this.buffer = []
          this._copyTo = null
        }
        // copy to this store
        // it may be neccessary to reset this every time you create a transaction
        copyTo (store) {
          this._copyTo = store
          return this
        }
        * put (v, dontCopy) {
          if (!dontCopy) {
            this.buffer.push(this._copyTo.put(v))
          }
          yield* super.put(v)
        }
        * delete (id) {
          this.buffer.push(this._copyTo.delete(id))
          yield* super.delete(id)
        }
        * flush () {
          yield* super.flush()
          for (var i = 0; i < this.buffer.length; i++) {
            yield* this.buffer[i]
          }
          yield* this._copyTo.flush()
        }
      }
      return Clone
    }
    Y.utils.createStoreClone = createStoreClone

    var BufferedStore = Y.utils.createSmallLookupBuffer(Store)
    var ClonedStore = Y.utils.createStoreClone(Y.utils.RBTree)

    class Transaction extends Y.Transaction {
      constructor (store) {
        super(store)
        var transaction = store.db.transaction(['OperationStore', 'StateStore', 'DeleteStore'], 'readwrite')
        this.store = store
        this.ss = new BufferedStore(transaction, 'StateStore')
        this.os = new BufferedStore(transaction, 'OperationStore')
        this._ds = new BufferedStore(transaction, 'DeleteStore')
        this.ds = store.dsClone.copyTo(this._ds)
      }
    }
    class OperationStore extends Y.AbstractDatabase {
      constructor (y, options) {
        super(y, options)
        // dsClone is persistent over transactions!
        // _ds is not
        this.dsClone = new ClonedStore()

        if (options == null) {
          options = {}
        }
        this.options = options
        if (options.namespace == null) {
          if (y.options.connector.room == null) {
            throw new Error('IndexedDB: expect a string (options.namespace)! (you can also skip this step if your connector has a room property)')
          } else {
            options.namespace = y.options.connector.room
          }
        }
        if (options.idbVersion != null) {
          this.idbVersion = options.idbVersion
        } else {
          this.idbVersion = 5
        }
        var store = this
        // initialize database!
        this.requestTransaction(function * () {
          store.db = yield window.indexedDB.open(options.namespace, store.idbVersion)
        })
        if (options.cleanStart) {
          delete window.localStorage[JSON.stringify(['Yjs_indexeddb', options.namespace])]
          this.requestTransaction(function * () {
            yield this.os.store.clear()
            yield this._ds.store.clear()
            yield this.ss.store.clear()
          })
        }
        this.whenUserIdSet(function (userid) {
          if (window.localStorage[JSON.stringify(['Yjs_indexeddb', options.namespace])] == null) {
            window.localStorage[JSON.stringify(['Yjs_indexeddb', options.namespace])] = JSON.stringify([userid, 0])
          }
        })
        this.requestTransaction(function * () {
          // this should be executed after the previous two defined transactions
          // after we computed the upgrade event (see `yield indexedDB.open(..)`), we can check if userid is still stored on localstorage
          var uid = window.localStorage[JSON.stringify(['Yjs_indexeddb', options.namespace])]
          if (uid != null) {
            store.setUserId(uid)
            var nextuid = JSON.parse(uid)
            nextuid[1] = nextuid[1] + 1
            window.localStorage[JSON.stringify(['Yjs_indexeddb', options.namespace])] = JSON.stringify(nextuid)
          }
          // copy from persistent Store to not persistent StoreClone. (there could already be content in Store)
          yield* this._ds.iterate(this, null, null, function * (o) {
            yield* this.ds.put(o, true)
          })
        })
        this.operationAddedNamespace = JSON.stringify(['__YJS__', this.options.namespace])
        var operationsToAdd = []
        window.addEventListener('storage', function (event) {
          if (event.key === store.operationAddedNamespace) {
            operationsToAdd.push(JSON.parse(event.newValue))
            var op, i // helper variables
            if (operationsToAdd.length === 1) {
              store.requestTransaction(function * () {
                /* about nextRound:
                   if op is not a delete, we retrieve it again from the db
                   then it could be true that op.left is not yet added to store
                    - but the types _change function expects that it is..
                   In this case left has to be executed first

                   What is left to say: we only put ready to execute ops in nextRound!

                   TODO: implement a smart buffer in eventHelper!!!!!
                */
                var nextRound = []
                for (i = 0; i < operationsToAdd.length; i++) {
                  op = operationsToAdd[i]
                  if (op.struct !== 'Delete') {
                    op = yield* this.getOperation(op.id)
                    while (op.left != null) {
                      var left = yield* this.getOperation(op.left)
                      if (!left.deleted) {
                        break
                      }
                      op.left = left.left
                    }
                  }
                  nextRound.push(op)
                }
                operationsToAdd = []
                while (nextRound.length > 0) {
                  var add = nextRound
                  nextRound = []
                  for (i = 0; i < add.length; i++) {
                    op = add[i]
                    if (op.struct === 'Insert') {
                      var ready = true
                      for (let j = i + 1; j < add.length; j++) {
                        let _op = add[j]
                        if (Y.utils.compareIds(_op.id, op.left)) {
                          ready = false
                          break
                        }
                      }
                      if (ready) {
                        for (let j = 0; j < nextRound.length; j++) {
                          let _op = add[j]
                          if (Y.utils.compareIds(_op.id, op.left)) {
                            ready = false
                            break
                          }
                        }
                      }
                      if (!ready) {
                        // it is necessary to execute left first
                        nextRound.push(op)
                        continue
                      }
                    }
                    yield* this.store.operationAdded(this, op, true)
                  }
                }
              })
            }
          }
        }, false)
      }
      * operationAdded (transaction, op, noAdd) {
        yield* super.operationAdded(transaction, op)
        if (!noAdd) {
          window.localStorage[this.operationAddedNamespace] = JSON.stringify(op)
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
          console.log('new request', request.source != null ? request.source.name : null)
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
                delete window.localStorage[JSON.stringify(['Yjs_indexeddb', store.options.namespace])]
                db.deleteObjectStore('OperationStore')
                db.deleteObjectStore('DeleteStore')
                db.deleteObjectStore('StateStore')
              } catch (e) {}
              db.createObjectStore('OperationStore', {keyPath: 'id'})
              db.createObjectStore('DeleteStore', {keyPath: 'id'})
              db.createObjectStore('StateStore', {keyPath: 'id'})
            }
          } else {
            gen.throw('You must not yield this type!')
          }
        }
      }
      // TODO: implement "free"..
      * destroy () {
        this.db.close()
        yield window.indexedDB.deleteDatabase(this.options.namespace)
      }
    }
    Y.extend('indexeddb', OperationStore)
  })
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}]},{},[1])

