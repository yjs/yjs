/* global Y */
'use strict'

Y.Memory = (function () {
  class Transaction extends Y.Transaction {
    constructor (store) {
      super(store)
      this.store = store
      this.ss = store.ss
      this.os = store.os
      this.ds = store.ds
    }
  }
  class Database extends Y.AbstractDatabase {
    constructor (y, opts) {
      super(y, opts)
      this.os = new Y.utils.RBTree()
      this.ds = new Y.utils.RBTree()
      this.ss = new Y.utils.RBTree()
      this.waitingTransactions = []
      this.transactionInProgress = false
    }
    logTable () {
      var self = this
      self.requestTransaction(function * () {
        console.log('User: ', this.store.y.connector.userId, "==============================") // eslint-disable-line
        console.log("State Set (SS):", yield* this.getStateSet()) // eslint-disable-line
        console.log("Operation Store (OS):") // eslint-disable-line
        yield* this.os.logTable() // eslint-disable-line
        console.log("Deletion Store (DS):") //eslint-disable-line
        yield* this.ds.logTable() // eslint-disable-line
        if (this.store.gc1.length > 0 || this.store.gc2.length > 0) {
          console.warn('GC1|2 not empty!', this.store.gc1, this.store.gc2)
        }
        if (JSON.stringify(this.store.listenersById) !== '{}') {
          console.warn('listenersById not empty!')
        }
        if (JSON.stringify(this.store.listenersByIdExecuteNow) !== '[]') {
          console.warn('listenersByIdExecuteNow not empty!')
        }
        if (this.store.transactionInProgress) {
          console.warn('Transaction still in progress!')
        }
      }, true)
    }
    transact (makeGen) {
      var t = new Transaction(this)
      while (makeGen !== null) {
        var gen = makeGen.call(t)
        var res = gen.next()
        while (!res.done) {
          res = gen.next(res.value)
        }
        makeGen = this.getNextRequest()
      }
    }
    * destroy () {
      super.destroy()
      delete this.os
      delete this.ss
      delete this.ds
    }
  }
  return Database
})()
