'use strict'

/*
  Partial definition of a transaction

  A transaction provides all the the async functionality on a database.

  By convention, a transaction has the following properties:
  * ss for StateSet
  * os for OperationStore
  * ds for DeleteStore

  A transaction must also define the following methods:
  * checkDeleteStoreForState(state)
    - When increasing the state of a user, an operation with an higher id
      may already be garbage collected, and therefore it will never be received.
      update the state to reflect this knowledge. This won't call a method to save the state!
  * getDeleteSet(id)
    - Get the delete set in a readable format:
      {
        "userX": [
          [5,1], // starting from position 5, one operations is deleted
          [9,4]  // starting from position 9, four operations are deleted
        ],
        "userY": ...
      }
  * getOpsFromDeleteSet(ds) -- TODO: just call this.deleteOperation(id) here
    - get a set of deletions that need to be applied in order to get to
      achieve the state of the supplied ds
  * setOperation(op)
    - write `op` to the database.
      Note: this is allowed to return an in-memory object.
      E.g. the Memory adapter returns the object that it has in-memory.
      Changing values on this object will be stored directly in the database
      without calling this function. Therefore,
      setOperation may have no functionality in some adapters. This also has
      implications on the way we use operations that were served from the database.
      We try not to call copyObject, if not necessary.
  * addOperation(op)
    - add an operation to the database.
      This may only be called once for every op.id
      Must return a function that returns the next operation in the database (ordered by id)
  * getOperation(id)
  * removeOperation(id)
    - remove an operation from the database. This is called when an operation
      is garbage collected.
  * setState(state)
    - `state` is of the form
      {
        user: "1",
        clock: 4
      } <- meaning that we have four operations from user "1"
           (with these id's respectively: 0, 1, 2, and 3)
  * getState(user)
  * getStateVector()
    - Get the state of the OS in the form
    [{
      user: "userX",
      clock: 11
    },
     ..
    ]
  * getStateSet()
    - Get the state of the OS in the form
    {
      "userX": 11,
      "userY": 22
    }
   * getOperations(startSS)
     - Get the all the operations that are necessary in order to achive the
       stateSet of this user, starting from a stateSet supplied by another user
   * makeOperationReady(ss, op)
     - this is called only by `getOperations(startSS)`. It makes an operation
       applyable on a given SS.
*/
module.exports = function (Y) {
  class Transaction {
    /*
      Get a type based on the id of its model.
      If it does not exist yes, create it.
      TODO: delete type from store.initializedTypes[id] when corresponding id was deleted!
    */
    * getType (id) {
      var sid = JSON.stringify(id)
      var t = this.store.initializedTypes[sid]
      if (t == null) {
        var op = yield* this.getOperation(id)
        if (op != null) {
          t = yield* Y[op.type].initType.call(this, this.store, op)
          this.store.initializedTypes[sid] = t
        }
      }
      return t
    }
    /*
      Apply operations that this user created (no remote ones!)
        * does not check for Struct.*.requiredOps()
        * also broadcasts it through the connector
    */
    * applyCreatedOperations (ops) {
      var send = []
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        yield* this.store.tryExecute.call(this, op)
        send.push(Y.Struct[op.struct].encode(op))
      }
      if (!this.store.y.connector.isDisconnected()) { // TODO: && !this.store.forwardAppliedOperations (but then i don't send delete ops)
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcast({
          type: 'update',
          ops: send
        })
      }
    }

    * deleteList (start) {
      if (this.store.y.connector.isSynced) {
        while (start != null && this.store.y.connector.isSynced) {
          start = (yield* this.getOperation(start))
          start.gc = true
          yield* this.setOperation(start)
          // TODO: will always reset the parent..
          this.store.gc1.push(start.id)
          start = start.right
        }
      } else {
        // TODO: when not possible??? do later in (gcWhenSynced)
      }
    }

    /*
      Mark an operation as deleted, and add it to the GC, if possible.
    */
    * deleteOperation (targetId, preventCallType) {
      var target = yield* this.getOperation(targetId)
      var callType = false

      if (target == null || !target.deleted) {
        yield* this.markDeleted(targetId)
      }

      if (target != null && target.gc == null) {
        if (!target.deleted) {
          callType = true
          // set deleted & notify type
          target.deleted = true
          /*
          if (!preventCallType) {
            var type = this.store.initializedTypes[JSON.stringify(target.parent)]
            if (type != null) {
              yield* type._changed(this, {
                struct: 'Delete',
                target: targetId
              })
            }
          }
          */
          // delete containing lists
          if (target.start != null) {
            // TODO: don't do it like this .. -.-
            yield* this.deleteList(target.start)
            yield* this.deleteList(target.id)
          }
          if (target.map != null) {
            for (var name in target.map) {
              yield* this.deleteList(target.map[name])
            }
            // TODO: here to..  (see above)
            yield* this.deleteList(target.id)
          }
          if (target.opContent != null) {
            yield* this.deleteOperation(target.opContent)
            target.opContent = null
          }
        }
        var left = target.left != null ? yield* this.getOperation(target.left) : null

        this.store.addToGarbageCollector(target, left)

        // set here because it was deleted and/or gc'd
        yield* this.setOperation(target)

        /*
          Check if it is possible to add right to the gc.
          Because this delete can't be responsible for left being gc'd,
          we don't have to add left to the gc..
        */
        var right = target.right != null ? yield* this.getOperation(target.right) : null
        if (
          right != null &&
          this.store.addToGarbageCollector(right, target)
        ) {
          yield* this.setOperation(right)
        }
        return callType
      }
    }
    /*
      Mark an operation as deleted&gc'd
    */
    * markGarbageCollected (id) {
      // this.mem.push(["gc", id]);
      var n = yield* this.markDeleted(id)
      if (!n.gc) {
        if (n.id[1] < id[1]) {
          // un-extend left
          var newlen = n.len - (id[1] - n.id[1])
          n.len -= newlen
          yield* this.ds.put(n)
          n = {id: id, len: newlen, gc: false}
          yield* this.ds.put(n)
        }
        // get prev&next before adding a new operation
        var prev = yield* this.ds.findPrev(id)
        var next = yield* this.ds.findNext(id)

        if (id[1] < n.id[1] + n.len - 1) {
          // un-extend right
          yield* this.ds.put({id: [id[0], id[1] + 1], len: n.len - 1, gc: false})
          n.len = 1
        }
        // set gc'd
        n.gc = true
        // can extend left?
        if (
          prev != null &&
          prev.gc &&
          Y.utils.compareIds([prev.id[0], prev.id[1] + prev.len], n.id)
        ) {
          prev.len += n.len
          yield* this.ds.delete(n.id)
          n = prev
          // ds.put n here?
        }
        // can extend right?
        if (
          next != null &&
          next.gc &&
          Y.utils.compareIds([n.id[0], n.id[1] + n.len], next.id)
        ) {
          n.len += next.len
          yield* this.ds.delete(next.id)
        }
        yield* this.ds.put(n)
      }
    }
    /*
      Mark an operation as deleted.

      returns the delete node
    */
    * markDeleted (id) {
      // this.mem.push(["del", id]);
      var n = yield* this.ds.findWithUpperBound(id)
      if (n != null && n.id[0] === id[0]) {
        if (n.id[1] <= id[1] && id[1] < n.id[1] + n.len) {
          // already deleted
          return n
        } else if (n.id[1] + n.len === id[1] && !n.gc) {
          // can extend existing deletion
          n.len++
        } else {
          // cannot extend left
          n = {id: id, len: 1, gc: false}
          yield* this.ds.put(n)
        }
      } else {
        // cannot extend left
        n = {id: id, len: 1, gc: false}
        yield* this.ds.put(n)
      }
      // can extend right?
      var next = yield* this.ds.findNext(n.id)
      if (
        next != null &&
        Y.utils.compareIds([n.id[0], n.id[1] + n.len], next.id) &&
        !next.gc
      ) {
        n.len = n.len + next.len
        yield* this.ds.delete(next.id)
      }
      yield* this.ds.put(n)
      return n
    }
    /*
      Call this method when the client is connected&synced with the
      other clients (e.g. master). This will query the database for
      operations that can be gc'd and add them to the garbage collector.
    */
    * garbageCollectAfterSync () {
      yield* this.os.iterate(this, null, null, function * (op) {
        if (op.deleted && op.left != null) {
          var left = yield* this.getOperation(op.left)
          this.store.addToGarbageCollector(op, left)
        }
      })
    }
    /*
      Really remove an op and all its effects.
      The complicated case here is the Insert operation:
      * reset left
      * reset right
      * reset parent.start
      * reset parent.end
      * reset origins of all right ops
    */
    * garbageCollectOperation (id) {
      this.store.addToDebug('yield* this.garbageCollectOperation(', id, ')')
      // check to increase the state of the respective user
      var state = yield* this.getState(id[0])
      if (state.clock === id[1]) {
        state.clock++
        // also check if more expected operations were gc'd
        yield* this.checkDeleteStoreForState(state)
        // then set the state
        yield* this.setState(state)
      }
      yield* this.markGarbageCollected(id)

      // if op exists, then clean that mess up..
      var o = yield* this.getOperation(id)
      if (o != null) {
        /*
        if (!o.deleted) {
          yield* this.deleteOperation(id)
          o = yield* this.getOperation(id)
        }
        */

        // remove gc'd op from the left op, if it exists
        if (o.left != null) {
          var left = yield* this.getOperation(o.left)
          left.right = o.right
          yield* this.setOperation(left)
        }
        // remove gc'd op from the right op, if it exists
        // also reset origins of right ops
        if (o.right != null) {
          var right = yield* this.getOperation(o.right)
          right.left = o.left
          if (Y.utils.compareIds(right.origin, o.id)) { // rights origin is o
            // find new origin of right ops
            // origin is the first left deleted operation
            var neworigin = o.left
            while (neworigin != null) {
              var neworigin_ = yield* this.getOperation(neworigin)
              if (neworigin_.deleted) {
                break
              }
              neworigin = neworigin_.left
            }

            // reset origin of right
            right.origin = neworigin

            // reset origin of all right ops (except first right - duh!),
            // until you find origin pointer to the left of o
            var i = right.right == null ? null : yield* this.getOperation(right.right)
            var ids = [o.id, o.right]
            while (i != null && ids.some(function (id) {
              return Y.utils.compareIds(id, i.origin)
            })) {
              if (Y.utils.compareIds(i.origin, o.id)) {
                // reset origin of i
                i.origin = neworigin
                yield* this.setOperation(i)
              }
              // get next i
              i = i.right == null ? null : yield* this.getOperation(i.right)
            }
          } /* otherwise, rights origin is to the left of o,
               then there is no right op (from o), that origins in o */
          yield* this.setOperation(right)
        }

        if (o.parent != null) {
          // remove gc'd op from parent, if it exists
          var parent = yield* this.getOperation(o.parent)
          var setParent = false // whether to save parent to the os
          if (o.parentSub != null) {
            if (Y.utils.compareIds(parent.map[o.parentSub], o.id)) {
              setParent = true
              parent.map[o.parentSub] = o.right
            }
          } else {
            if (Y.utils.compareIds(parent.start, o.id)) {
              // gc'd op is the start
              setParent = true
              parent.start = o.right
            }
            if (Y.utils.compareIds(parent.end, o.id)) {
              // gc'd op is the end
              setParent = true
              parent.end = o.left
            }
          }
          if (setParent) {
            yield* this.setOperation(parent)
          }
        }
        // finally remove it from the os
        yield* this.removeOperation(o.id)
      }
    }
    * checkDeleteStoreForState (state) {
      var n = yield* this.ds.findWithUpperBound([state.user, state.clock])
      if (n != null && n.id[0] === state.user && n.gc) {
        state.clock = Math.max(state.clock, n.id[1] + n.len)
      }
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
        yield* this.ds.iterate(this, [user, 0], [user, Number.MAX_VALUE], function * (n) {
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
        // always try to delete..
        var addOperation = yield* this.deleteOperation(id)
        if (addOperation) {
          // TODO:.. really .. here? You could prevent calling all these functions in operationAdded
          yield* this.store.operationAdded(this, {struct: 'Delete', target: id})
        }
        if (del[2]) {
          // gc
          yield* this.garbageCollectOperation(id)
        }
      }
      if (this.store.forwardAppliedOperations) {
        var ops = deletions.map(function (d) {
          return {struct: 'Delete', target: [d[0], d[1]]}
        })
        this.store.y.connector.broadcast({
          type: 'update',
          ops: ops
        })
      }
    }
    * isGarbageCollected (id) {
      var n = yield* this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len && n.gc
    }
    /*
      A DeleteSet (ds) describes all the deleted ops in the OS
    */
    * getDeleteSet () {
      var ds = {}
      yield* this.ds.iterate(this, null, null, function * (n) {
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
    * isDeleted (id) {
      var n = yield* this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len
    }
    * setOperation (op) {
      yield* this.os.put(op)
      return op
    }
    * addOperation (op) {
      yield* this.os.put(op)
      if (!this.store.y.connector.isDisconnected() && this.store.forwardAppliedOperations) {
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcast({
          type: 'update',
          ops: [op]
        })
      }
    }
    * getOperation (id) {
      return yield* this.os.find(id)
    }
    * removeOperation (id) {
      yield* this.os.delete(id)
    }
    * setState (state) {
      var val = {
        id: [state.user],
        clock: state.clock
      }
      // TODO: find a way to skip this step.. (after implementing some dbs..)
      if (yield* this.ss.find([state.user])) {
        yield* this.ss.put(val)
      } else {
        yield* this.ss.put(val)
      }
    }
    * getState (user) {
      var n
      var clock = (n = yield* this.ss.find([user])) == null ? null : n.clock
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
      yield* this.ss.iterate(this, null, null, function * (n) {
        stateVector.push({
          user: n.id[0],
          clock: n.clock
        })
      })
      return stateVector
    }
    * getStateSet () {
      var ss = {}
      yield* this.ss.iterate(this, null, null, function * (n) {
        ss[n.id[0]] = n.clock
      })
      return ss
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

        yield* this.os.iterate(this, [user, startPos], [user, Number.MAX_VALUE], function * (op) {
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
  Y.Transaction = Transaction
}
