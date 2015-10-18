/* global Y */
'use strict'

/*
 An operation also defines the structure of a type. This is why operation and
 structure are used interchangeably here.

 It must be of the type Object. I hope to achieve some performance
 improvements when working on databases that support the json format.

 An operation must have the following properties:

 * encode
     - Encode the structure in a readable format (preferably string- todo)
 * decode (todo)
     - decode structure to json
 * execute
     - Execute the semantics of an operation.
 * requiredOps
     - Operations that are required to execute this operation.
*/

var Struct = {
  /* This is the only operation that is actually not a structure, because
  it is not stored in the OS. This is why it _does not_ have an id

  op = {
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
      return yield* this.deleteOperation(op.target)
    }
  },
  Insert: {
    /* {
        content: any,
        id: Id,
        left: Id,
        origin: Id,
        right: Id,
        parent: Id,
        parentSub: string (optional), // child of Map type
      }
    */
    encode: function (op) {
      // TODO: you could not send the "left" property, then you also have to
      // "op.left = null" in $execute or $decode
      var e = {
        id: op.id,
        left: op.left,
        right: op.right,
        origin: op.origin,
        parent: op.parent,
        struct: op.struct
      }
      if (op.parentSub != null) {
        e.parentSub = op.parentSub
      }
      if (op.opContent != null) {
        e.opContent = op.opContent
      } else {
        e.content = op.content
      }

      return e
    },
    requiredOps: function (op) {
      var ids = []
      if (op.left != null) {
        ids.push(op.left)
      }
      if (op.right != null) {
        ids.push(op.right)
      }
      if (op.origin != null && !Y.utils.compareIds(op.left, op.origin)) {
        ids.push(op.origin)
      }
      // if (op.right == null && op.left == null) {
      ids.push(op.parent)

      if (op.opContent != null) {
        ids.push(op.opContent)
      }
      return ids
    },
    getDistanceToOrigin: function * (op) {
      if (op.left == null) {
        return 0
      } else {
        var d = 0
        var o = yield* this.getOperation(op.left)
        while (!Y.utils.compareIds(op.origin, (o ? o.id : null))) {
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
        if (o != null && !Y.utils.compareIds(o.id, op.right)) {
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

        // if right exists, and it is supposed to be gc'd. Remove it from the gc
        if (right.gc != null) {
          this.store.removeFromGarbageCollector(right)
        }
        yield* this.setOperation(right)
      }

      // update parents .map/start/end properties
      if (op.parentSub != null) {
        if (left == null) {
          parent.map[op.parentSub] = op.id
          yield* this.setOperation(parent)
        }
        // is a child of a map struct.
        // Then also make sure that only the most left element is not deleted
        if (op.right != null) {
          yield* this.deleteOperation(op.right, true)
        }
        if (op.left != null) {
          yield* this.deleteOperation(op.id, true)
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
    execute: function * (op) {
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
      while (o != null) { // TODO: change to != (at least some convention)
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
      return []
    },
    execute: function * () {},
    /*
      Get a property by name
    */
    get: function * (op, name) {
      var oid = op.map[name]
      if (oid != null) {
        var res = yield* this.getOperation(oid)
        return (res == null || res.deleted) ? void 0 : (res.opContent == null
          ? res.content : yield* this.getType(res.opContent))
      }
    },
    /*
      Delete a property by name
    */
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
