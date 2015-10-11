/* global Y */
'use strict'

class DeleteStore extends Y.utils.RBTree {
  constructor () {
    super()
  }
  isDeleted (id) {
    var n = this.findNodeWithUpperBound(id)
    return n !== null && n.val.id[0] === id[0] && id[1] < n.val.id[1] + n.val.len
  }
  /*
    Mark an operation as deleted&gc'd

    returns the delete node
  */
  markGarbageCollected (id) {
    var n = this.markDeleted(id)
    if (!n.val.gc) {
      if (n.val.id[1] < id[1]) {
        // un-extend left
        var newlen = n.val.len - (id[1] - n.val.id[1])
        n.val.len -= newlen
        n = this.add({id: id, len: newlen, gc: false})
      }
      if (id[1] < n.val.id[1] + n.val.len - 1) {
        // un-extend right
        this.add({id: [id[0], id[1] + 1], len: n.val.len - 1, gc: false})
        n.val.len = 1
      }
      // set gc'd
      n.val.gc = true
      var prev = n.prev()
      var next = n.next()
      // can extend left?
      if (
        prev != null &&
        prev.val.gc &&
        Y.utils.compareIds([prev.val.id[0], prev.val.id[1] + prev.val.len], n.val.id)
      ) {
        prev.val.len += n.val.len
        super.delete(n.val.id)
        n = prev
      }
      // can extend right?
      if (
        next != null &&
        next.val.gc &&
        Y.utils.compareIds([n.val.id[0], n.val.id[1] + n.val.len], next.val.id)
      ) {
        n.val.len += next.val.len
        super.delete(next.val.id)
      }
    }
    return n
  }
  /*
    Mark an operation as deleted.

    returns the delete node
  */
  markDeleted (id) {
    var n = this.findNodeWithUpperBound(id)
    if (n != null && n.val.id[0] === id[0]) {
      if (n.val.id[1] <= id[1] && id[1] < n.val.id[1] + n.val.len) {
        // already deleted
        return n
      } else if (n.val.id[1] + n.val.len === id[1] && !n.val.gc) {
        // can extend existing deletion
        n.val.len++
      } else {
        // cannot extend left
        n = this.add({id: id, len: 1, gc: false})
      }
    } else {
      // cannot extend left
      n = this.add({id: id, len: 1, gc: false})
    }
    // can extend right?
    var next = n.next()
    if (
      next !== null &&
      Y.utils.compareIds([n.val.id[0], n.val.id[1] + n.val.len], next.val.id) &&
      !next.val.gc
    ) {
      n.val.len = n.val.len + next.val.len
      super.delete(next.val.id)
    }
    return n
  }
  /*
    A DeleteSet (ds) describes all the deleted ops in the OS
  */
  toDeleteSet () {
    var ds = {}
    this.iterate(null, null, function (n) {
      var user = n.id[0]
      var counter = n.id[1]
      var len = n.len
      var gc = n.gc
      var dv = ds[user]
      if (dv === void 0) {
        dv = []
        ds[user] = dv
      }
      dv.push([counter, len, gc])
    })
    return ds
  }
}

Y.utils.DeleteStore = DeleteStore

Y.Memory = (function () {
  class Transaction extends Y.AbstractTransaction {

    constructor (store) {
      super(store)
      this.ss = store.ss
      this.os = store.os
      this.ds = store.ds
    }
    * checkDeleteStoreForState (state) {
      var n = this.ds.findNodeWithUpperBound([state.user, state.clock])
      if (n !== null && n.val.id[0] === state.user && n.val.gc) {
        state.clock = Math.max(state.clock, n.val.id[1] + n.val.len)
      }
    }
    * getDeleteSet (id) {
      return this.ds.toDeleteSet(id)
    }
    /*
      apply a delete set in order to get
      the state of the supplied ds
    */
    * applyDeleteSet (ds) {
      var deletions = []
      function createDeletions (user, start, len, gc) {
        for (var c = start; c < start + len; c++) {
          deletions.push([user, c, gc])
        }
      }

      for (var user in ds) {
        var dv = ds[user]
        var pos = 0
        var d = dv[pos]
        this.ds.iterate([user, 0], [user, Number.MAX_VALUE], function (n) {
          // cases:
          // 1. d deletes something to the right of n
          //  => go to next n (break)
          // 2. d deletes something to the left of n
          //  => create deletions
          //  => reset d accordingly
          //  *)=> if d doesn't delete anything anymore, go to next d (continue)
          // 3. not 2) and d deletes something that also n deletes
          //  => reset d so that it doesn't contain n's deletion
          //  *)=> if d does not delete anything anymore, go to next d (continue)
          while (d != null) {
            var diff = 0 // describe the diff of length in 1) and 2)
            if (n.id[1] + n.len <= d[0]) {
              // 1)
              break
            } else if (d[0] < n.id[1]) {
              // 2)
              // delete maximum the len of d
              // else delete as much as possible
              diff = Math.min(n.id[1] - d[0], d[1])
              createDeletions(user, d[0], diff, d[2])
            } else {
              // 3)
              diff = n.id[1] + n.len - d[0] // never null (see 1)
              if (d[2] && !n.gc) {
                // d marks as gc'd but n does not
                // then delete either way
                createDeletions(user, d[0], Math.min(diff, d[1]), d[2])
              }
            }
            if (d[1] <= diff) {
              // d doesn't delete anything anymore
              d = dv[++pos]
            } else {
              d[0] = d[0] + diff // reset pos
              d[1] = d[1] - diff // reset length
            }
          }
        })
        // for the rest.. just apply it
        for (; pos < dv.length; pos++) {
          d = dv[pos]
          createDeletions(user, d[0], d[1], d[2])
        }
      }
      for (var i in deletions) {
        var del = deletions[i]
        var id = [del[0], del[1]]
        if (del[2]) {
          // gc
          yield* this.garbageCollectOperation(id)
        } else {
          // delete
          yield* this.deleteOperation(id)
        }
      }
    }
    * isDeleted (id) {
      return this.ds.isDeleted(id)
    }
    * setOperation (op) {
      // TODO: you can remove this step! probs..
      var n = this.os.findNode(op.id)
      n.val = op
      return op
    }
    * addOperation (op) {
      var n = this.os.add(op)
      return function () {
        if (n != null) {
          n = n.next()
          return n != null ? n.val : null
        } else {
          return null
        }
      }
    }
    * getOperation (id) {
      return this.os.find(id)
    }
    * removeOperation (id) {
      this.os.delete(id)
    }
    * setState (state) {
      this.ss[state.user] = state.clock
    }
    * getState (user) {
      var clock = this.ss[user]
      if (clock == null) {
        clock = 0
      }
      return {
        user: user,
        clock: clock
      }
    }
    * getStateVector () {
      var stateVector = []
      for (var user in this.ss) {
        var clock = this.ss[user]
        stateVector.push({
          user: user,
          clock: clock
        })
      }
      return stateVector
    }
    * getStateSet () {
      return Y.utils.copyObject(this.ss)
    }
    * getOperations (startSS) {
      // TODO: use bounds here!
      if (startSS == null) {
        startSS = {}
      }
      var ops = []

      var endSV = yield* this.getStateVector()
      for (var endState of endSV) {
        var user = endState.user
        if (user === '_') {
          continue
        }
        var startPos = startSS[user] || 0
        var endPos = endState.clock

        this.os.iterate([user, startPos], [user, endPos], function (op) {
          ops.push(op)
        })
      }
      var res = []
      for (var op of ops) {
        res.push(yield* this.makeOperationReady(startSS, op))
      }
      return res
    }
    /*
      Here, we make op executable for the receiving user.

      Notes:
        startSS: denotes to the SV that the remote user sent
        currSS:  denotes to the state vector that the user should have if he
                 applies all already sent operations (increases is each step)

      We face several problems:
      * Execute op as is won't work because ops depend on each other
       -> find a way so that they do not anymore
      * When changing left, must not go more to the left than the origin
      * When changing right, you have to consider that other ops may have op
        as their origin, this means that you must not set one of these ops
        as the new right (interdependencies of ops)
      * can't just go to the right until you find the first known operation,
        With currSS
          -> interdependency of ops is a problem
        With startSS
          -> leads to inconsistencies when two users join at the same time.
             Then the position depends on the order of execution -> error!

        Solution:
        -> re-create originial situation
          -> set op.left = op.origin (which never changes)
          -> set op.right
               to the first operation that is known (according to startSS)
               or to the first operation that has an origin that is not to the
               right of op.
          -> Enforces unique execution order -> happy user

        Improvements: TODO
          * Could set left to origin, or the first known operation
            (startSS or currSS.. ?)
            -> Could be necessary when I turn GC again.
            -> Is a bad(ish) idea because it requires more computation
    */
    * makeOperationReady (startSS, op) {
      op = Y.Struct[op.struct].encode(op)
      op = Y.utils.copyObject(op)
      var o = op
      var ids = [op.id]
      // search for the new op.right
      // it is either the first known op (according to startSS)
      // or the o that has no origin to the right of op
      // (this is why we use the ids array)
      while (o.right != null) {
        var right = yield* this.getOperation(o.right)
        if (o.right[1] < (startSS[o.right[0]] || 0) || !ids.some(function (id) {
          return Y.utils.compareIds(id, right.origin)
        })) {
          break
        }
        ids.push(o.right)
        o = right
      }
      op.right = o.right
      op.left = op.origin
      return op
    }
  }
  class OperationStore extends Y.AbstractOperationStore {
    constructor (y, opts) {
      super(y, opts)
      this.os = new Y.utils.RBTree()
      this.ss = {}
      this.waitingTransactions = []
      this.transactionInProgress = false
      this.ds = new DeleteStore()
    }
    logTable () {
      console.log('User: ', this.y.connector.userId, "=============================================") // eslint-disable-line
      console.log("State Set (SS):", this.ss) // eslint-disable-line
      console.log("Operation Store (OS):") // eslint-disable-line
      this.os.logTable() // eslint-disable-line
      console.log("Deletion Store (DS):") //eslint-disable-line
      this.ds.logTable() // eslint-disable-line
    }
    requestTransaction (_makeGen, requestNow) {
      if (requestNow == null) { requestNow = false }
      if (!this.transactionInProgress) {
        this.transactionInProgress = true
        var transact = (xxxx) => {
          var makeGen = _makeGen
          while (makeGen != null) {
            var t = new Transaction(this)
            var gen = makeGen.call(t)
            var res = gen.next()
            while (!res.done) {
              if (res.value === 'transaction') {
                res = gen.next(t)
              } else {
                throw new Error("You must not yield this type. (Maybe you meant to use 'yield*'?)")
              }
            }
            makeGen = this.waitingTransactions.shift()
          }
          this.transactionInProgress = false
        }
        if (!requestNow) {
          setTimeout(transact, 0)
        } else {
          transact()
        }
      } else {
        this.waitingTransactions.push(_makeGen)
      }
    }
    * destroy () { // eslint-disable-line
      super.destroy()
      delete this.os
    }
  }
  return OperationStore
})()
