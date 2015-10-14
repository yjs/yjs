/* global Y */
'use strict'

class DeleteStore extends Y.utils.RBTree {
  constructor () {
    super()
    this.mem = []
  }
}

Y.utils.DeleteStore = DeleteStore

Y.Memory = (function () {
  class Transaction extends Y.AbstractTransaction {
  }
  class OperationStore extends Y.AbstractOperationStore {
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
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          console.log('User: ', this.store.y.connector.userId, "==============================") // eslint-disable-line
          console.log("State Set (SS):", this.ss) // eslint-disable-line
          console.log("Operation Store (OS):") // eslint-disable-line
          yield* this.os.logTable() // eslint-disable-line
          console.log("Deletion Store (DS):") //eslint-disable-line
          yield* this.ds.logTable() // eslint-disable-line
          resolve()
        }, true)
      })
    }
    requestTransaction (_makeGen, callImmediately) {
      if (!this.transactionInProgress) {
        this.transactionInProgress = true
        var transact = () => {
          var makeGen = _makeGen
          while (makeGen != null) {
            var t = new Transaction(this)
            var gen = makeGen.call(t)
            var res = gen.next()
            while (!res.done) {
              res = gen.next(res.value)
            }
            makeGen = this.waitingTransactions.shift()
          }
          this.transactionInProgress = false
        }
        if (callImmediately) {
          transact()
        } else {
          setTimeout(transact, 0)
        }
      } else {
        this.waitingTransactions.push(_makeGen)
      }
    }
    * destroy () {
      super.destroy()
      delete this.os
    }
  }
  return OperationStore
})()
