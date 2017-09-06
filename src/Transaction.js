import { BinaryEncoder, BinaryDecoder } from './Encoding.js'

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
export default function extendTransaction (Y) {
  class TransactionInterface {
    /* ::
    store: Y.AbstractDatabase;
    ds: Store;
    os: Store;
    ss: Store;
    */
    /*
      Apply operations that this user created (no remote ones!)
        * does not check for Struct.*.requiredOps()
        * also broadcasts it through the connector
    */
    applyCreatedOperations (ops) {
      var send = []
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        this.store.tryExecute.call(this, op)
        if (op.id == null || typeof op.id[1] !== 'string') {
          send.push(Y.Struct[op.struct].encode(op))
        }
      }
      if (send.length > 0) { // TODO: && !this.store.forwardAppliedOperations (but then i don't send delete ops)
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcastOps(send)
        if (this.store.y.persistence != null) {
          this.store.y.persistence.saveOperations(send)
        }
      }
    }

    deleteList (start) {
      while (start != null) {
        start = this.getOperation(start)
        if (!start.gc) {
          start.gc = true
          start.deleted = true
          this.setOperation(start)
          var delLength = start.content != null ? start.content.length : 1
          this.markDeleted(start.id, delLength)
          if (start.opContent != null) {
            this.deleteOperation(start.opContent)
          }
          this.store.queueGarbageCollector(start.id)
        }
        start = start.right
      }
    }

    /*
      Mark an operation as deleted, and add it to the GC, if possible.
    */
    deleteOperation (targetId, length, preventCallType) /* :Generator<any, any, any> */ {
      if (length == null) {
        length = 1
      }
      this.markDeleted(targetId, length)
      while (length > 0) {
        var callType = false
        var target = this.os.findWithUpperBound([targetId[0], targetId[1] + length - 1])
        var targetLength = target != null && target.content != null ? target.content.length : 1
        if (target == null || target.id[0] !== targetId[0] || target.id[1] + targetLength <= targetId[1]) {
          // does not exist or is not in the range of the deletion
          target = null
          length = 0
        } else {
          // does exist, check if it is too long
          if (!target.deleted) {
            if (target.id[1] < targetId[1]) {
              // starts to the left of the deletion range
              target = this.getInsertionCleanStart(targetId)
              targetLength = target.content.length // must have content property!
            }
            if (target.id[1] + targetLength > targetId[1] + length) {
              // ends to the right of the deletion range
              target = this.getInsertionCleanEnd([targetId[0], targetId[1] + length - 1])
              targetLength = target.content.length
            }
          }
          length = target.id[1] - targetId[1]
        }

        if (target != null) {
          if (!target.deleted) {
            callType = true
            // set deleted & notify type
            target.deleted = true
            // delete containing lists
            if (target.start != null) {
              // TODO: don't do it like this .. -.-
              this.deleteList(target.start)
              // this.deleteList(target.id) -- do not gc itself because this may still get referenced
            }
            if (target.map != null) {
              for (var name in target.map) {
                this.deleteList(target.map[name])
              }
              // TODO: here to..  (see above)
              // this.deleteList(target.id) -- see above
            }
            if (target.opContent != null) {
              this.deleteOperation(target.opContent)
              // target.opContent = null
            }
            if (target.requires != null) {
              for (var i = 0; i < target.requires.length; i++) {
                this.deleteOperation(target.requires[i])
              }
            }
          }
          var left
          if (target.left != null) {
            left = this.getInsertion(target.left)
          } else {
            left = null
          }

          // set here because it was deleted and/or gc'd
          this.setOperation(target)

          /*
            Check if it is possible to add right to the gc.
            Because this delete can't be responsible for left being gc'd,
            we don't have to add left to the gc..
          */
          var right
          if (target.right != null) {
            right = this.getOperation(target.right)
          } else {
            right = null
          }
          if (callType && !preventCallType) {
            this.store.operationAdded(this, {
              struct: 'Delete',
              target: target.id,
              length: targetLength,
              targetParent: target.parent
            })
          }
          // need to gc in the end!
          this.store.addToGarbageCollector.call(this, target, left)
          if (right != null) {
            this.store.addToGarbageCollector.call(this, right, target)
          }
        }
      }
    }
    /*
      Mark an operation as deleted&gc'd
    */
    markGarbageCollected (id, len) {
      // this.mem.push(["gc", id]);
      this.store.addToDebug('this.markGarbageCollected(', id, ', ', len, ')')
      var n = this.markDeleted(id, len)
      if (n.id[1] < id[1] && !n.gc) {
        // un-extend left
        var newlen = n.len - (id[1] - n.id[1])
        n.len -= newlen
        this.ds.put(n)
        n = {id: id, len: newlen, gc: false}
        this.ds.put(n)
      }
      // get prev&next before adding a new operation
      var prev = this.ds.findPrev(id)
      var next = this.ds.findNext(id)

      if (id[1] + len < n.id[1] + n.len && !n.gc) {
        // un-extend right
        this.ds.put({id: [id[0], id[1] + len], len: n.len - len, gc: false})
        n.len = len
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
        this.ds.delete(n.id)
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
        this.ds.delete(next.id)
      }
      this.ds.put(n)
      this.updateState(n.id[0])
    }
    /*
      Mark an operation as deleted.

      returns the delete node
    */
    markDeleted (id, length) {
      if (length == null) {
        length = 1
      }
      // this.mem.push(["del", id]);
      var n = this.ds.findWithUpperBound(id)
      if (n != null && n.id[0] === id[0]) {
        if (n.id[1] <= id[1] && id[1] <= n.id[1] + n.len) {
          // id is in n's range
          var diff = id[1] + length - (n.id[1] + n.len) // overlapping right
          if (diff > 0) {
            // id+length overlaps n
            if (!n.gc) {
              n.len += diff
            } else {
              diff = n.id[1] + n.len - id[1] // overlapping left (id till n.end)
              if (diff < length) {
                // a partial deletion
                n = {id: [id[0], id[1] + diff], len: length - diff, gc: false}
                this.ds.put(n)
              } else {
                // already gc'd
                throw new Error(
                  'DS reached an inconsistent state. Please report this issue!'
                )
              }
            }
          } else {
            // no overlapping, already deleted
            return n
          }
        } else {
          // cannot extend left (there is no left!)
          n = {id: id, len: length, gc: false}
          this.ds.put(n) // TODO: you double-put !!
        }
      } else {
        // cannot extend left
        n = {id: id, len: length, gc: false}
        this.ds.put(n)
      }
      // can extend right?
      var next = this.ds.findNext(n.id)
      if (
        next != null &&
        n.id[0] === next.id[0] &&
        n.id[1] + n.len >= next.id[1]
      ) {
        diff = n.id[1] + n.len - next.id[1] // from next.start to n.end
        while (diff >= 0) {
          // n overlaps with next
          if (next.gc) {
            // gc is stronger, so reduce length of n
            n.len -= diff
            if (diff >= next.len) {
              // delete the missing range after next
              diff = diff - next.len // missing range after next
              if (diff > 0) {
                this.ds.put(n) // unneccessary? TODO!
                this.markDeleted([next.id[0], next.id[1] + next.len], diff)
              }
            }
            break
          } else {
            // we can extend n with next
            if (diff > next.len) {
              // n is even longer than next
              // get next.next, and try to extend it
              var _next = this.ds.findNext(next.id)
              this.ds.delete(next.id)
              if (_next == null || n.id[0] !== _next.id[0]) {
                break
              } else {
                next = _next
                diff = n.id[1] + n.len - next.id[1] // from next.start to n.end
                // continue!
              }
            } else {
              // n just partially overlaps with next. extend n, delete next, and break this loop
              n.len += next.len - diff
              this.ds.delete(next.id)
              break
            }
          }
        }
      }
      this.ds.put(n)
      return n
    }
    /*
      Call this method when the client is connected&synced with the
      other clients (e.g. master). This will query the database for
      operations that can be gc'd and add them to the garbage collector.
    */
    garbageCollectAfterSync () {
      // debugger
      if (this.store.gc1.length > 0 || this.store.gc2.length > 0) {
        console.warn('gc should be empty after sync')
      }
      if (!this.store.gc) {
        return
      }
      this.os.iterate(this, null, null, function (op) {
        if (op.gc) {
          delete op.gc
          this.setOperation(op)
        }
        if (op.parent != null) {
          var parentDeleted = this.isDeleted(op.parent)
          if (parentDeleted) {
            op.gc = true
            if (!op.deleted) {
              this.markDeleted(op.id, op.content != null ? op.content.length : 1)
              op.deleted = true
              if (op.opContent != null) {
                this.deleteOperation(op.opContent)
              }
              if (op.requires != null) {
                for (var i = 0; i < op.requires.length; i++) {
                  this.deleteOperation(op.requires[i])
                }
              }
            }
            this.setOperation(op)
            this.store.gc1.push(op.id) // this is ok becaues its shortly before sync (otherwise use queueGarbageCollector!)
            return
          }
        }
        if (op.deleted) {
          var left = null
          if (op.left != null) {
            left = this.getInsertion(op.left)
          }
          this.store.addToGarbageCollector.call(this, op, left)
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
    garbageCollectOperation (id) {
      this.store.addToDebug('this.garbageCollectOperation(', id, ')')
      var o = this.getOperation(id)
      this.markGarbageCollected(id, (o != null && o.content != null) ? o.content.length : 1) // always mark gc'd
      // if op exists, then clean that mess up..
      if (o != null) {
        var deps = []
        if (o.opContent != null) {
          deps.push(o.opContent)
        }
        if (o.requires != null) {
          deps = deps.concat(o.requires)
        }
        for (var i = 0; i < deps.length; i++) {
          var dep = this.getOperation(deps[i])
          if (dep != null) {
            if (!dep.deleted) {
              this.deleteOperation(dep.id)
              dep = this.getOperation(dep.id)
            }
            dep.gc = true
            this.setOperation(dep)
            this.store.queueGarbageCollector(dep.id)
          } else {
            this.markGarbageCollected(deps[i], 1)
          }
        }

        // remove gc'd op from the left op, if it exists
        if (o.left != null) {
          var left = this.getInsertion(o.left)
          left.right = o.right
          this.setOperation(left)
        }
        // remove gc'd op from the right op, if it exists
        // also reset origins of right ops
        if (o.right != null) {
          var right = this.getOperation(o.right)
          right.left = o.left
          this.setOperation(right)

          if (o.originOf != null && o.originOf.length > 0) {
            // find new origin of right ops
            // origin is the first left operation
            var neworigin = o.left

            // reset origin of all right ops (except first right - duh!),

            /* ** The following code does not rely on the the originOf property **
                  I recently added originOf to all Insert Operations (see Struct.Insert.execute),
                  which saves which operations originate in a Insert operation.
                  Garbage collecting without originOf is more memory efficient, but is nearly impossible for large texts, or lists!
                  But I keep this code for now
            ```
            // reset origin of right
            right.origin = neworigin
            // search until you find origin pointer to the left of o
            if (right.right != null) {
              var i = this.getOperation(right.right)
              var ids = [o.id, o.right]
              while (ids.some(function (id) {
                return Y.utils.compareIds(id, i.origin)
              })) {
                if (Y.utils.compareIds(i.origin, o.id)) {
                  // reset origin of i
                  i.origin = neworigin
                  this.setOperation(i)
                }
                // get next i
                if (i.right == null) {
                  break
                } else {
                  ids.push(i.id)
                  i = this.getOperation(i.right)
                }
              }
            }
            ```
            */
            // ** Now the new implementation starts **
            // reset neworigin of all originOf[*]
            for (var _i in o.originOf) {
              var originsIn = this.getOperation(o.originOf[_i])
              if (originsIn != null) {
                originsIn.origin = neworigin
                this.setOperation(originsIn)
              }
            }
            if (neworigin != null) {
              var neworigin_ = this.getInsertion(neworigin)
              if (neworigin_.originOf == null) {
                neworigin_.originOf = o.originOf
              } else {
                neworigin_.originOf = o.originOf.concat(neworigin_.originOf)
              }
              this.setOperation(neworigin_)
            }
            // we don't need to set right here, because
            // right should be in o.originOf => it is set it the previous for loop
          }
        }
        // o may originate in another operation.
        // Since o is deleted, we have to reset o.origin's `originOf` property
        if (o.origin != null) {
          var origin = this.getInsertion(o.origin)
          origin.originOf = origin.originOf.filter(function (_id) {
            return !Y.utils.compareIds(id, _id)
          })
          this.setOperation(origin)
        }
        var parent
        if (o.parent != null) {
          parent = this.getOperation(o.parent)
        }
        // remove gc'd op from parent, if it exists
        if (parent != null) {
          var setParent = false // whether to save parent to the os
          if (o.parentSub != null) {
            if (Y.utils.compareIds(parent.map[o.parentSub], o.id)) {
              setParent = true
              if (o.right != null) {
                parent.map[o.parentSub] = o.right
              } else {
                delete parent.map[o.parentSub]
              }
            }
          } else {
            if (Y.utils.compareIds(parent.start, o.id)) {
              // gc'd op is the start
              setParent = true
              parent.start = o.right
            }
            if (Y.utils.matchesId(o, parent.end)) {
              // gc'd op is the end
              setParent = true
              parent.end = o.left
            }
          }
          if (setParent) {
            this.setOperation(parent)
          }
        }
        // finally remove it from the os
        this.removeOperation(o.id)
      }
    }
    checkDeleteStoreForState (state) {
      var n = this.ds.findWithUpperBound([state.user, state.clock])
      if (n != null && n.id[0] === state.user && n.gc) {
        state.clock = Math.max(state.clock, n.id[1] + n.len)
      }
    }
    updateState (user) {
      var state = this.getState(user)
      this.checkDeleteStoreForState(state)
      var o = this.getInsertion([user, state.clock])
      var oLength = (o != null && o.content != null) ? o.content.length : 1
      while (o != null && user === o.id[0] && o.id[1] <= state.clock && o.id[1] + oLength > state.clock) {
        // either its a new operation (1. case), or it is an operation that was deleted, but is not yet in the OS
        state.clock += oLength
        this.checkDeleteStoreForState(state)
        o = this.os.findNext(o.id)
        oLength = (o != null && o.content != null) ? o.content.length : 1
      }
      this.setState(state)
    }
    /*
      apply a delete set in order to get
      the state of the supplied ds
    */
    applyDeleteSet (decoder) {
      var deletions = []

      let dsLength = decoder.readUint32()
      for (let i = 0; i < dsLength; i++) {
        let user = decoder.readVarUint()
        let dv = []
        let dvLength = decoder.readVarUint()
        for (let j = 0; j < dvLength; j++) {
          let from = decoder.readVarUint()
          let len = decoder.readVarUint()
          let gc = decoder.readUint8() === 1
          dv.push([from, len, gc])
        }
        var pos = 0
        var d = dv[pos]
        this.ds.iterate(this, [user, 0], [user, Number.MAX_VALUE], function (n) {
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
              deletions.push([user, d[0], diff, d[2]])
            } else {
              // 3)
              diff = n.id[1] + n.len - d[0] // never null (see 1)
              if (d[2] && !n.gc) {
                // d marks as gc'd but n does not
                // then delete either way
                deletions.push([user, d[0], Math.min(diff, d[1]), d[2]])
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
          deletions.push([user, d[0], d[1], d[2]])
        }
      }
      for (var i = 0; i < deletions.length; i++) {
        var del = deletions[i]
        // always try to delete..
        this.deleteOperation([del[0], del[1]], del[2])
        if (del[3]) {
          // gc..
          this.markGarbageCollected([del[0], del[1]], del[2]) // always mark gc'd
          // remove operation..
          var counter = del[1] + del[2]
          while (counter >= del[1]) {
            var o = this.os.findWithUpperBound([del[0], counter - 1])
            if (o == null) {
              break
            }
            var oLen = o.content != null ? o.content.length : 1
            if (o.id[0] !== del[0] || o.id[1] + oLen <= del[1]) {
              // not in range
              break
            }
            if (o.id[1] + oLen > del[1] + del[2]) {
              // overlaps right
              o = this.getInsertionCleanEnd([del[0], del[1] + del[2] - 1])
            }
            if (o.id[1] < del[1]) {
              // overlaps left
              o = this.getInsertionCleanStart([del[0], del[1]])
            }
            counter = o.id[1]
            this.garbageCollectOperation(o.id)
          }
        }
        if (this.store.forwardAppliedOperations || this.store.y.persistence != null) {
          var ops = []
          ops.push({struct: 'Delete', target: [del[0], del[1]], length: del[2]})
          if (this.store.forwardAppliedOperations) {
            this.store.y.connector.broadcastOps(ops)
          }
          if (this.store.y.persistence != null) {
            this.store.y.persistence.saveOperations(ops)
          }
        }
      }
    }
    isGarbageCollected (id) {
      var n = this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len && n.gc
    }
    /*
      A DeleteSet (ds) describes all the deleted ops in the OS
    */
    writeDeleteSet (encoder) {
      var ds = new Map()
      this.ds.iterate(this, null, null, function (n) {
        var user = n.id[0]
        var counter = n.id[1]
        var len = n.len
        var gc = n.gc
        var dv = ds.get(user)
        if (dv === void 0) {
          dv = []
          ds.set(user, dv)
        }
        dv.push([counter, len, gc])
      })
      let keys = Array.from(ds.keys())
      encoder.writeUint32(keys.length)
      for (var i = 0; i < keys.length; i++) {
        let user = keys[i]
        let deletions = ds.get(user)
        encoder.writeVarUint(user)
        encoder.writeVarUint(deletions.length)
        for (var j = 0; j < deletions.length; j++) {
          let del = deletions[j]
          encoder.writeVarUint(del[0])
          encoder.writeVarUint(del[1])
          encoder.writeUint8(del[2] ? 1 : 0)
        }
      }
    }
    isDeleted (id) {
      var n = this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len
    }
    setOperation (op) {
      this.os.put(op)
      return op
    }
    addOperation (op) {
      this.os.put(op)
      // case op is created by this user, op is already broadcasted in applyCreatedOperations
      if (op.id[0] !== this.store.userId && typeof op.id[1] !== 'string') {
        if (this.store.forwardAppliedOperations) {
          // is connected, and this is not going to be send in addOperation
          this.store.y.connector.broadcastOps([op])
        }
        if (this.store.y.persistence != null) {
          this.store.y.persistence.saveOperations([op])
        }
      }
    }
    // if insertion, try to combine with left insertion (if both have content property)
    tryCombineWithLeft (op) {
      if (
        op != null &&
        op.left != null &&
        op.content != null &&
        op.left[0] === op.id[0] &&
        Y.utils.compareIds(op.left, op.origin)
      ) {
        var left = this.getInsertion(op.left)
        if (left.content != null &&
            left.id[1] + left.content.length === op.id[1] &&
            left.originOf.length === 1 &&
            !left.gc && !left.deleted &&
            !op.gc && !op.deleted
        ) {
          // combine!
          if (op.originOf != null) {
            left.originOf = op.originOf
          } else {
            delete left.originOf
          }
          left.content = left.content.concat(op.content)
          left.right = op.right
          this.os.delete(op.id)
          this.setOperation(left)
        }
      }
    }
    getInsertion (id) {
      var ins = this.os.findWithUpperBound(id)
      if (ins == null) {
        return null
      } else {
        var len = ins.content != null ? ins.content.length : 1 // in case of opContent
        if (id[0] === ins.id[0] && id[1] < ins.id[1] + len) {
          return ins
        } else {
          return null
        }
      }
    }
    getInsertionCleanStartEnd (id) {
      this.getInsertionCleanStart(id)
      return this.getInsertionCleanEnd(id)
    }
    // Return an insertion such that id is the first element of content
    // This function manipulates an operation, if necessary
    getInsertionCleanStart (id) {
      var ins = this.getInsertion(id)
      if (ins != null) {
        if (ins.id[1] === id[1]) {
          return ins
        } else {
          var left = Y.utils.copyObject(ins)
          ins.content = left.content.splice(id[1] - ins.id[1])
          ins.id = id
          var leftLid = Y.utils.getLastId(left)
          ins.origin = leftLid
          left.originOf = [ins.id]
          left.right = ins.id
          ins.left = leftLid
          // debugger // check
          this.setOperation(left)
          this.setOperation(ins)
          if (left.gc) {
            this.store.queueGarbageCollector(ins.id)
          }
          return ins
        }
      } else {
        return null
      }
    }
    // Return an insertion such that id is the last element of content
    // This function manipulates an operation, if necessary
    getInsertionCleanEnd (id) {
      var ins = this.getInsertion(id)
      if (ins != null) {
        if (ins.content == null || (ins.id[1] + ins.content.length - 1 === id[1])) {
          return ins
        } else {
          var right = Y.utils.copyObject(ins)
          right.content = ins.content.splice(id[1] - ins.id[1] + 1) // cut off remainder
          right.id = [id[0], id[1] + 1]
          var insLid = Y.utils.getLastId(ins)
          right.origin = insLid
          ins.originOf = [right.id]
          ins.right = right.id
          right.left = insLid
          // debugger // check
          this.setOperation(right)
          this.setOperation(ins)
          if (ins.gc) {
            this.store.queueGarbageCollector(right.id)
          }
          return ins
        }
      } else {
        return null
      }
    }
    getOperation (id/* :any */)/* :Transaction<any> */ {
      var o = this.os.find(id)
      if (id[0] !== 0xFFFFFF || o != null) {
        return o
      } else { // type is string
        // generate this operation?
        var comp = id[1].split('_')
        if (comp.length > 1) {
          var struct = comp[0]
          let type = Y[comp[1]]
          let args = null
          if (type != null) {
            args = Y.utils.parseTypeDefinition(type, comp[3])
          }
          var op = Y.Struct[struct].create(id, args)
          op.type = comp[1]
          this.setOperation(op)
          return op
        } else {
          throw new Error(
            'Unexpected case. Operation cannot be generated correctly!' +
            'Incompatible Yjs version?'
          )
        }
      }
    }
    removeOperation (id) {
      this.os.delete(id)
    }
    setState (state) {
      var val = {
        id: [state.user],
        clock: state.clock
      }
      this.ss.put(val)
    }
    getState (user) {
      var n = this.ss.find([user])
      var clock = n == null ? null : n.clock
      if (clock == null) {
        clock = 0
      }
      return {
        user: user,
        clock: clock
      }
    }
    getStateVector () {
      var stateVector = []
      this.ss.iterate(this, null, null, function (n) {
        stateVector.push({
          user: n.id[0],
          clock: n.clock
        })
      })
      return stateVector
    }
    getStateSet () {
      var ss = {}
      this.ss.iterate(this, null, null, function (n) {
        ss[n.id[0]] = n.clock
      })
      return ss
    }
    writeStateSet (encoder) {
      let lenPosition = encoder.pos
      let len = 0
      encoder.writeUint32(0)
      this.ss.iterate(this, null, null, function (n) {
        encoder.writeVarUint(n.id[0])
        encoder.writeVarUint(n.clock)
        len++
      })
      encoder.setUint32(lenPosition, len)
      return len === 0
    }
    /*
      Here, we make all missing operations executable for the receiving user.

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

      What we do:
      * Iterate over all missing operations.
      * When there is an operation, where the right op is known, send this op all missing ops to the left to the user
      * I explained above what we have to do with each operation. Here is how we do it efficiently:
        1. Go to the left until you find either op.origin, or a known operation (let o denote current operation in the iteration)
        2. Found a known operation -> set op.left = o, and send it to the user. stop
        3. Found o = op.origin -> set op.left = op.origin, and send it to the user. start again from 1. (set op = o)
        4. Found some o -> set o.right = op, o.left = o.origin, send it to the user, continue
    */
    getOperations (startSS) {
      // TODO: use bounds here!
      if (startSS == null) {
        startSS = new Map()
      }
      var send = []

      var endSV = this.getStateVector()
      for (let endState of endSV) {
        let user = endState.user
        if (user === 0xFFFFFF) {
          continue
        }
        let startPos = startSS.get(user) || 0
        if (startPos > 0) {
          // There is a change that [user, startPos] is in a composed Insertion (with a smaller counter)
          // find out if that is the case
          let firstMissing = this.getInsertion([user, startPos])
          if (firstMissing != null) {
            // update startPos
            startPos = firstMissing.id[1]
          }
        }
        startSS.set(user, startPos)
      }
      for (let endState of endSV) {
        let user = endState.user
        let startPos = startSS.get(user)
        if (user === 0xFFFFFF) {
          continue
        }
        this.os.iterate(this, [user, startPos], [user, Number.MAX_VALUE], function (op) {
          op = Y.Struct[op.struct].encode(op)
          if (op.struct !== 'Insert') {
            send.push(op)
          } else if (op.right == null || op.right[1] < (startSS.get(op.right[0]) || 0)) {
            // case 1. op.right is known
            // this case is only reached if op.right is known.
            // => this is not called for op.left, as op.right is unknown
            let o = op
            // Remember: ?
            // -> set op.right
            //    1. to the first operation that is known (according to startSS)
            //    2. or to the first operation that has an origin that is not to the
            //      right of op.
            // For this we maintain a list of ops which origins are not found yet.
            var missingOrigins = [op]
            var newright = op.right
            while (true) {
              if (o.left == null) {
                op.left = null
                send.push(op)
                /* not necessary, as o is already sent..
                if (!Y.utils.compareIds(o.id, op.id) && o.id[1] >= (startSS.get(o.id[0]) || 0)) {
                  // o is not op && o is unknown
                  o = Y.Struct[op.struct].encode(o)
                  o.right = missingOrigins[missingOrigins.length - 1].id
                  send.push(o)
                }
                */
                break
              }
              o = this.getInsertion(o.left)
              // we set another o, check if we can reduce $missingOrigins
              while (missingOrigins.length > 0 && Y.utils.matchesId(o, missingOrigins[missingOrigins.length - 1].origin)) {
                missingOrigins.pop()
              }
              if (o.id[1] < (startSS.get(o.id[0]) || 0)) {
                // case 2. o is known
                op.left = Y.utils.getLastId(o)
                send.push(op)
                break
              } else if (Y.utils.matchesId(o, op.origin)) {
                // case 3. o is op.origin
                op.left = op.origin
                send.push(op)
                op = Y.Struct[op.struct].encode(o)
                op.right = newright
                if (missingOrigins.length > 0) {
                  throw new Error(
                    'Reached inconsistent OS state.' +
                    'Operations are not correctly connected.'
                  )
                }
                missingOrigins = [op]
              } else {
                // case 4. send o, continue to find op.origin
                var s = Y.Struct[op.struct].encode(o)
                s.right = missingOrigins[missingOrigins.length - 1].id
                s.left = s.origin
                send.push(s)
                missingOrigins.push(o)
              }
            }
          }
        })
      }
      return send.reverse()
    }

    writeOperations (encoder, decoder) {
      let ss = new Map()
      let ssLength = decoder.readUint32()
      for (let i = 0; i < ssLength; i++) {
        let user = decoder.readVarUint()
        let clock = decoder.readVarUint()
        ss.set(user, clock)
      }
      let ops = this.getOperations(ss)
      encoder.writeUint32(ops.length)
      for (let i = 0; i < ops.length; i++) {
        let op = ops[i]
        Y.Struct[op.struct].binaryEncode(encoder, Y.Struct[op.struct].encode(op))
      }
    }

    toBinary () {
      let encoder = new BinaryEncoder()
      this.writeOperationsUntransformed(encoder)
      this.writeDeleteSet(encoder)
      return encoder.createBuffer()
    }

    fromBinary (buffer) {
      let decoder = new BinaryDecoder(buffer)
      this.applyOperationsUntransformed(decoder)
      this.applyDeleteSet(decoder)
    }

    /*
     * Get the plain untransformed operations from the database.
     * You can apply these operations using .applyOperationsUntransformed(ops)
     *
     */
    writeOperationsUntransformed (encoder) {
      let lenPosition = encoder.pos
      let len = 0
      encoder.writeUint32(0) // placeholder
      this.os.iterate(this, null, null, function (op) {
        if (op.id[0] !== 0xFFFFFF) {
          len++
          Y.Struct[op.struct].binaryEncode(encoder, Y.Struct[op.struct].encode(op))
        }
      })
      encoder.setUint32(lenPosition, len)
      this.writeStateSet(encoder)
    }
    applyOperationsUntransformed (decoder) {
      let len = decoder.readUint32()
      for (let i = 0; i < len; i++) {
        let op = Y.Struct.binaryDecodeOperation(decoder)
        this.os.put(op)
      }
      this.os.iterate(this, null, null, function (op) {
        if (op.parent != null) {
          if (op.struct === 'Insert') {
            // update parents .map/start/end properties
            if (op.parentSub != null && op.left == null) {
              // op is child of Map
              let parent = this.getOperation(op.parent)
              parent.map[op.parentSub] = op.id
              this.setOperation(parent)
            } else if (op.right == null || op.left == null) {
              let parent = this.getOperation(op.parent)
              if (op.right == null) {
                parent.end = Y.utils.getLastId(op)
              }
              if (op.left == null) {
                parent.start = op.id
              }
              this.setOperation(parent)
            }
          }
        }
      })
      let stateSetLength = decoder.readUint32()
      for (let i = 0; i < stateSetLength; i++) {
        let user = decoder.readVarUint()
        let clock = decoder.readVarUint()
        this.ss.put({
          id: [user],
          clock: clock
        })
      }
    }
    /* this is what we used before.. use this as a reference..
    makeOperationReady (startSS, op) {
      op = Y.Struct[op.struct].encode(op)
      op = Y.utils.copyObject(op) -- use copyoperation instead now!
      var o = op
      var ids = [op.id]
      // search for the new op.right
      // it is either the first known op (according to startSS)
      // or the o that has no origin to the right of op
      // (this is why we use the ids array)
      while (o.right != null) {
        var right = this.getOperation(o.right)
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
    */
    flush () {
      this.os.flush()
      this.ss.flush()
      this.ds.flush()
    }
  }
  Y.Transaction = TransactionInterface
}
