/* global Y */
'use strict'

class DeleteStore extends Y.utils.RBTree {
  constructor () {
    super()
    // TODO: debugggg
    this.mem = [];
    this.memDS = [];
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
    this.mem.push({"gc": id});
    var n = this.markDeleted(id)
    this.mem.pop()
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
    this.mem.push({"del": id});
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

      this.memDS = store.ds.memDS; // TODO: remove
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

      var memAction = {
        before: yield* this.getDeleteSet(),
        applied: JSON.parse(JSON.stringify(ds))
      };

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
      memAction.after = yield* this.getDeleteSet();
      this.memDS.push(memAction);
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
        /*
        var state = startSS[op.id[0]] || 0
        if ((state === op.id[1]) || true) {
          startSS[op.id[0]] = op.id[1] + 1
        } else {
          throw new Error('Unexpected operation!')
        }
        */
      }
      return res
    }
    * makeOperationReady (ss, op) {
      op = Y.Struct[op.struct].encode(op)
      // instead of ss, you could use currSS (a ss that increments when you add an operation)
      op = Y.utils.copyObject(op)
      var o = op

      while (o.right != null) {
        // while unknown, go to the right
        if (o.right[1] < (ss[o.right[0]] || 0)) { // && !Y.utils.compareIds(op.id, o.origin)
          break
        }
        o = yield* this.getOperation(o.right)
      }
      // new right is known according to the ss
      op.right = o.right
      /*
      while (o.left != null) {
        // while unknown, go to the right
        if (o.left[1] < (ss[o.left[0]] || 0)) {
          break
        }
        o = yield* this.getOperation(o.left)
      }
      // new left is known according to the ss
      op.left = o.left
      */
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
