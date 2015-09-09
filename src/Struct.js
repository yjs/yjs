/* global copyObject, Y*/

function compareIds (id1, id2) {
  if (id1 == null || id2 == null) {
    if (id1 == null && id2 == null) {
      return true
    }
    return false
  }
  if (id1[0] === id2[0] && id1[1] === id2[1]) {
    return true
  } else {
    return false
  }
}

var Struct = {
  /* This Operations does _not_ have an id!
  {
  target: Id
  }
  */
  Delete: {
    encode: function (op) {
      return op
    },
    requiredOps: function (op) {
      return [] // [op.target]
    },
    execute: function * (op) {
      // console.log('Delete', op, console.trace())
      var target = yield* this.getOperation(op.target)
      if (target != null && !target.deleted) {
        target.deleted = true
        if (target.left !== null && (yield* this.getOperation(target.left)).deleted) {
          this.store.addToGarbageCollector(target.id)
          target.gc = true
        }
        if (target.right !== null) {
          var right = yield* this.getOperation(target.right)
          if (right.deleted && right.gc == null) {
            this.store.addToGarbageCollector(right.id)
            right.gc = true
            yield* this.setOperation(right)
          }
        }
        yield* this.setOperation(target)
        var t = this.store.initializedTypes[JSON.stringify(target.parent)]
        if (t != null) {
          yield* t._changed(this, copyObject(op))
        }
      }
      this.ds.delete(op.target)
      var state = yield* this.getState(op.target[0])
      if (state.clock === op.target[1]) {
        yield* this.checkDeleteStoreForState(state)
        yield* this.setState(state)
      }
    }
  },
  Insert: {
    /* {
        content: any,
        left: Id,
        right: Id,
        origin: id,
        parent: Id,
        parentSub: string (optional),
        id: this.os.getNextOpId()
      }
    */
    encode: function (op) {
      /* bad idea, right?
      var e = {
        id: op.id,
        left: op.left,
        right: op.right,
        origin: op.origin,
        parent: op.parent,
        content: op.content,
        struct: "Insert"
      }
      if (op.parentSub != null){
        e.parentSub = op.parentSub
      }
      return e;*/
      return op
    },
    requiredOps: function (op) {
      var ids = []
      if (op.left != null) {
        ids.push(op.left)
      }
      if (op.right != null) {
        ids.push(op.right)
      }
      // if(op.right == null && op.left == null) {}
      ids.push(op.parent)

      if (op.opContent != null) {
        ids.push(op.opContent)
      }
      return ids
    },
    getDistanceToOrigin: function *(op) {
      if (op.left == null) {
        return 0
      } else {
        var d = 0
        var o = yield* this.getOperation(op.left)
        while (!compareIds(op.origin, (o ? o.id : null))) {
          d++
          if (o.left == null) {
            break
          } else {
            o = yield* this.getOperation(o.left)
          }
        }
        return d
      }
    },
    /*
    # $this has to find a unique position between origin and the next known character
    # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
    #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
    #         o2,o3 and o4 origin is 1 (the position of o2)
    #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
    #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
    #         therefore $this would be always to the right of o3
    # case 2: $origin < $o.origin
    #         if current $this insert_position > $o origin: $this ins
    #         else $insert_position will not change
    #         (maybe we encounter case 1 later, then this will be to the right of $o)
    # case 3: $origin > $o.origin
    #         $this insert_position is to the left of $o (forever!)
    */
    execute: function *(op) {
      var i // loop counter
      var distanceToOrigin = i = yield* Struct.Insert.getDistanceToOrigin.call(this, op) // most cases: 0 (starts from 0)
      var o
      var parent
      var start

      // find o. o is the first conflicting operation
      if (op.left != null) {
        o = yield* this.getOperation(op.left)
        o = (o.right == null) ? null : yield* this.getOperation(o.right)
      } else { // left == null
        parent = yield* this.getOperation(op.parent)
        let startId = op.parentSub ? parent.map[op.parentSub] : parent.start
        start = startId == null ? null : yield* this.getOperation(startId)
        o = start
      }

      // handle conflicts
      while (true) {
        if (o != null && !compareIds(o.id, op.right)) {
          var oOriginDistance = yield* Struct.Insert.getDistanceToOrigin.call(this, o)
          if (oOriginDistance === i) {
            // case 1
            if (o.id[0] < op.id[0]) {
              op.left = o.id
              distanceToOrigin = i + 1
            }
          } else if (oOriginDistance < i) {
            // case 2
            if (i - distanceToOrigin <= oOriginDistance) {
              op.left = o.id
              distanceToOrigin = i + 1
            }
          } else {
            break
          }
          i++
          o = o.right ? yield* this.getOperation(o.right) : null
        } else {
          break
        }
      }

      // reconnect..
      var left = null
      var right = null
      parent = parent || (yield* this.getOperation(op.parent))

      // reconnect left and set right of op
      if (op.left != null) {
        left = yield* this.getOperation(op.left)
        op.right = left.right
        left.right = op.id
        yield* this.setOperation(left)
      } else {
        op.right = op.parentSub ? parent.map[op.parentSub] || null : parent.start
      }
      // reconnect right
      if (op.right != null) {
        right = yield* this.getOperation(op.right)
        right.left = op.id
        yield* this.setOperation(right)
      }

      // notify parent
      if (op.parentSub != null) {
        if (left == null) {
          parent.map[op.parentSub] = op.id
          yield* this.setOperation(parent)
        }
      } else {
        if (right == null || left == null) {
          if (right == null) {
            parent.end = op.id
          }
          if (left == null) {
            parent.start = op.id
          }
          yield* this.setOperation(parent)
        }
      }
    }
  },
  List: {
    /*
    {
      start: null,
      end: null,
      struct: "List",
      type: "",
      id: this.os.getNextOpId()
    }
    */
    encode: function (op) {
      return {
        struct: 'List',
        id: op.id,
        type: op.type
      }
    },
    requiredOps: function () {
      /*
      var ids = []
      if (op.start != null) {
        ids.push(op.start)
      }
      if (op.end != null){
        ids.push(op.end)
      }
      return ids
      */
      return []
    },
    execute: function * (op) { // eslint-disable-line
      op.start = null
      op.end = null
    },
    ref: function * (op, pos) {
      if (op.start == null) {
        return null
      }
      var res = null
      var o = yield* this.getOperation(op.start)

      while (true) {
        if (!o.deleted) {
          res = o
          pos--
        }
        if (pos >= 0 && o.right != null) {
          o = (yield* this.getOperation(o.right))
        } else {
          break
        }
      }
      return res
    },
    map: function * (o, f) {
      o = o.start
      var res = []
      while (o !== null) {
        var operation = yield* this.getOperation(o)
        if (!operation.deleted) {
          res.push(f(operation))
        }
        o = operation.right
      }
      return res
    }
  },
  Map: {
    /*
      {
        map: {},
        struct: "Map",
        type: "",
        id: this.os.getNextOpId()
      }
    */
    encode: function (op) {
      return {
        struct: 'Map',
        type: op.type,
        id: op.id,
        map: {} // overwrite map!!
      }
    },
    requiredOps: function () {
      /*
      var ids = []
      for (var end in op.map) {
        ids.push(op.map[end])
      }
      return ids
      */
      return []
    },
    execute: function * () {},
    get: function * (op, name) {
      var oid = op.map[name]
      if (oid != null) {
        var res = yield* this.getOperation(oid)
        return (res == null || res.deleted) ? void 0 : (res.opContent == null
          ? res.content : yield* this.getType(res.opContent))
      }
    },
    delete: function * (op, name) {
      var v = op.map[name] || null
      if (v != null) {
        yield* Struct.Delete.create.call(this, {
          target: v
        })
      }
    }
  }
}
Y.Struct = Struct
