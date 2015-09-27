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
  garbageCollect (id) {
    var n = this.delete(id)
    if (!n.val.gc) {
      if (n.val.id[1] < id[1]) {
        // un-extend left
        var newlen = n.val.len - (id[1] - n.val.id[1])
        n.val.len -= newlen
        n = this.add({id: id, len: newlen, gc: false})
      }
      if (id[1] < n.val.id[1] + n.val.len - 1) {
        // un-extend right
        this.add({id: id, len: n.val.len - 1, gc: false})
        n.val.len = 1
      }
      // set gc'd
      n.val.gc = true

      // can extend left?
      var prev = n.prev()
      if (prev != null && prev.val.gc) {
        prev.val.len += n.val.len
        super.delete(n.val.id)
      }
      // can extend right?
      var next = n.next()
      if (next != null && next.val.gc) {
        n.val.len += next.val.len
        super.delete(next.val.id)
      }
    }
  }
  /*
    Mark an operation as deleted.

    returns the delete node
  */
  delete (id) {
    var n = this.findNodeWithUpperBound(id)
    if (n != null && n.val.id[0] === id[0]) {
      if (n.val.id[1] <= id[1] && id[1] < n.val.id[1] + n.val.len) {
        // already deleted
        return n
      } else if (n.val.id[1] + n.val.len === id[1]) {
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
    if (next !== null && Y.utils.compareIds([n.val.id[0], n.val.id[1] + n.val.len], next.val.id)) {
      n.val.len = n.val.len + next.val.len
      super.delete(next.val.id)
    }
    return n
  }
  // a DeleteSet (ds) describes all the deleted ops in the OS
  toDeleteSet () {
    var ds = {}
    this.iterate(null, null, function (n) {
      var user = n.id[0]
      var counter = n.id[1]
      var len = n.len
      var dv = ds[user]
      if (dv === void 0) {
        dv = []
        ds[user] = dv
      }
      dv.push([counter, len])
    })
    return ds
  }
  // returns a set of deletions that need to be applied in order to get to
  // the state of the supplied ds
  getDeletions (ds) {
    var deletions = []
    function createDeletions (user, start, len) {
      for (var c = start; c < start + len; c++) {
        deletions.push({
          target: [user, c],
          struct: 'Delete'
        })
      }
    }
    for (var user in ds) {
      var dv = ds[user]
      var pos = 0
      var d = dv[pos]
      this.iterate([user, 0], [user, Number.MAX_VALUE], function (n) {
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
          var diff // describe the diff of length in 1) and 2)
          if (n.id[1] + n.len <= d[0]) {
            // 1)
            break
          } else if (d[0] < n.id[1]) {
            // 2)
            // delete maximum the len of d
            // else delete as much as possible
            diff = Math.min(n.id[1] - d[0], d[1])
            createDeletions(user, d[0], diff)
          } else {
            // 3)
            diff = n.id[1] + n.len - d[0] // never null (see 1)
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
      for (; pos < dv.length; pos++) {
        d = dv[pos]
        createDeletions(user, d[0], d[1])
      }
    }
    return deletions
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
      if (n !== null && n.val.id[0] === state.user) {
        state.clock = Math.max(state.clock, n.val.id[1] + n.val.len)
      }
    }
    * getDeleteSet (id) {
      return this.ds.toDeleteSet(id)
    }
    * isDeleted (id) {
      return this.ds.isDeleted(id)
    }
    * getOpsFromDeleteSet (ds) {
      return this.ds.getDeletions(ds)
    }
    * setOperation (op) {
      // TODO: you can remove this step! probs..
      var n = this.os.findNode(op.id)
      n.val = op
      return op
    }
    * addOperation (op) {
      this.os.add(op)
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
        var state = startSS[op.id[0]] || 0
        if ((state === op.id[1]) || true) {
          startSS[op.id[0]] = state + 1
        } else {
          throw new Error('Unexpected operation!')
        }
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
        if (o.right[1] < (ss[o.right[0]] || 0)) {
          break
        }
        o = yield* this.getOperation(o.right)
      }
      // new right is not gc'd and known according to the ss
      op.right = o.right
      while (o.left != null) {
        // while unknown, go to the right
        if (o.left[1] < (ss[o.left[0]] || 0)) {
          break
        }
        o = yield* this.getOperation(o.left)
      }
      // new left is not gc'd and known according to the ss
      op.left = o.left
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
      this.os.logTable()
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
