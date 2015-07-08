/* @flow */

// Op is anything that we could get from the OperationStore.
type Op = Object;
type Id = [string, number];

type List = {
  id: Id,
  start: Insert,
  end: Insert
};

type Insert = {
  id: Id,
  left: Insert,
  right: Insert,
  origin: Insert,
  parent: List,
  content: any
};

function compareIds(id1, id2) {

  if (id1 == null || id2 == null) {
    if (id1 == null && id2 == null) {
      return true;
    }
    return false;
  }
  if (id1[0] === id2[0] && id1[1] === id2[1]) {
    return true;
  } else {
    return false;
  }
}

var Struct = {
  Operation: {  //eslint-disable-line no-unused-vars
    create: function*(op : Op) : Struct.Operation {
      var user = this.store.y.connector.userId;
      var state = yield* this.getState(user);
      op.id = [user, state.clock];
      if ((yield* this.addOperation(op)) === false) {
        throw new Error("This is highly unexpected :(");
      }
      this.store.y.connector.broadcast({
        type: "update",
        ops: [Struct[op.struct].encode(op)]
      });
      return op;
    }
  },
  Insert: {
    /*{
        content: any,
        left: Id,
        right: Id,
        parent: Id,
        parentSub: string (optional)
      }
    */
    create: function*( op: Op ) : Insert {
      if ( op.left === undefined
        || op.right === undefined
        || op.parent === undefined ) {
          throw new Error("You must define left, right, and parent!");
        }
      op.origin = op.left;
      op.struct = "Insert";
      yield* Struct.Operation.create.call(this, op);

      if (op.left != null) {
        var left = yield* this.getOperation(op.left);
        left.right = op.id;
        yield* this.setOperation(left);
      }
      if (op.right != null) {
        var right = yield* this.getOperation(op.right);
        right.left = op.id;
        yield* this.setOperation(right);
      }
      var parent = yield* this.getOperation(op.parent);
      if (op.parentSub != null){
        if (compareIds(parent.map[op.parentSub], op.right)) {
          parent.map[op.parentSub] = op.id;
          yield* this.setOperation(parent);
        }
      } else {
        var start = compareIds(parent.start, op.right);
        var end = compareIds(parent.end, op.left);
        if (start || end) {
          if (start) {
            parent.start = op.id;
          }
          if (end) {
            parent.end = op.id;
          }
          yield* this.setOperation(parent);
        }
      }
      return op;
    },
    encode: function(op){
      /*var e = {
        id: op.id,
        left: op.left,
        right: op.right,
        origin: op.origin,
        parent: op.parent,
        content: op.content,
        struct: "Insert"
      };
      if (op.parentSub != null){
        e.parentSub = op.parentSub;
      }
      return e;*/
      return op;
    },
    requiredOps: function(op){
      var ids = [];
      if(op.left != null){
        ids.push(op.left);
      }
      if(op.right != null){
        ids.push(op.right);
      }
      if(op.right == null && op.left == null) {
        ids.push(op.parent);
      }
      if (op.opContent != null) {
        ids.push(op.opContent);
      }
      return ids;
    },
    getDistanceToOrigin: function *(op){
      if (op.left == null) {
        return 0;
      } else {
        var d = 0;
        var o = yield* this.getOperation(op.left);
        while (!compareIds(op.origin, (o ? o.id : null))) {
          d++;
          if (o.left == null) {
            break;
          } else {
            o = yield* this.getOperation(o.left);
          }
        }
        return d;
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
    execute: function*(op){
      var i; // loop counter
      var distanceToOrigin = i = yield* Struct.Insert.getDistanceToOrigin.call(this, op); // most cases: 0 (starts from 0)
      var o;
      var parent;
      var start;

      // find o. o is the first conflicting operation
      if (op.left != null) {
        o = yield* this.getOperation(op.left);
        o = (o.right == null) ? null : yield* this.getOperation(o.right);
      } else { // left == null
        parent = yield* this.getOperation(op.parent);
        let startId = op.parentSub ? parent.map[op.parentSub] : parent.start;
        start = startId == null ? null : yield* this.getOperation(startId);
        o = start;
      }

      // handle conflicts
      while (true) {
        if (o != null && !compareIds(o.id, op.right)){
          var oOriginDistance = yield* Struct.Insert.getDistanceToOrigin.call(this, o);
          if (oOriginDistance === i) {
            // case 1
            if (o.id[0] < op.id[0]) {
              op.left = o.id;
              distanceToOrigin = i + 1;
            }
          } else if (oOriginDistance < i) {
            // case 2
            if (i - distanceToOrigin <= oOriginDistance) {
              op.left = o.id;
              distanceToOrigin = i + 1;
            }
          } else {
            break;
          }
          i++;
          o = o.right ? yield* this.getOperation(o.right) : null;
        } else {
          break;
        }
      }

      // reconnect..
      var left = null;
      var right = null;
      parent = parent || (yield* this.getOperation(op.parent));

      // NOTE: You you have to call addOperation before you set any other operation!

      // reconnect left and set right of op
      if (op.left != null) {
        left = yield* this.getOperation(op.left);
        op.right = left.right;
        if ((yield* this.addOperation(op)) === false) { // add here
          return;
        }
        left.right = op.id;
        yield* this.setOperation(left);
      } else {
        op.right = op.parentSub ? (parent.map[op.parentSub] || null) : parent.start;
        if ((yield* this.addOperation(op)) === false) { // or here
          return;
        }
      }
      // reconnect right
      if (op.right != null) {
        right = yield* this.getOperation(op.right);
        right.left = op.id;
        yield* this.setOperation(right);
      }

      // notify parent
      if (op.parentSub != null) {
        if (left == null) {
          parent.map[op.parentSub] = op.id;
          yield* this.setOperation(parent);
        }
      } else {
        if (right == null || left == null) {
          if (right == null) {
            parent.end = op.id;
          }
          if (left == null) {
            parent.start = op.id;
          }
          yield* this.setOperation(parent);
        }
      }
    }
  },
  List: {
    create: function*( op : Op){
      op.start = null;
      op.end = null;
      op.struct = "List";
      return yield* Struct.Operation.create.call(this, op);
    },
    encode: function(op){
      return {
        struct: "List",
        id: op.id,
        type: op.type
      };
    },
    requiredOps: function(){
      /*
      var ids = [];
      if (op.start != null) {
        ids.push(op.start);
      }
      if (op.end != null){
        ids.push(op.end);
      }
      return ids;
      */
      return [];
    },
    execute: function* (op) {
      op.start = null;
      op.end = null;
      if ((yield* this.addOperation(op)) === false) {
        return;
      }
    },
    ref: function* (op : Op, pos : number) : Insert {
      if (op.start == null) {
        return null;
      }
      var o = yield* this.getOperation(op.start);
      while ( pos !== 0 && o.right != null) {
        o = (yield* this.getOperation(o.right));
        pos--;
      }
      return o;
    },
    map: function* (o : Op, f : Function) : Array<any> {
      o = o.start;
      var res = [];
      while ( o != null) {
        var operation = yield* this.getOperation(o);
        res.push(f(operation.content));
        o = operation.right;
      }
      return res;
    },
    insert: function* (op, pos : number, contents : Array<any>) {
      var ref = yield* Struct.List.ref.call(this, op, pos);
      var right = ref != null ? ref.id : null;
      var left = ref != null ? ref.left : null;
      for (var key in contents) {
        var insert = {
          left: left,
          right: right,
          content: contents[key],
          parent: op.id
        };
        left = (yield* Struct.Insert.create.call(this, insert)).id;
      }
    }
  },
  Map: {
    /*
      {
        // empty
      }
    */
    create: function*( op : Op ){
      op.map = {};
      op.struct = "Map";
      return yield* Struct.Operation.create.call(this, op);
    },
    encode: function(op){
      return {
        struct: "Map",
        type: op.type,
        id: op.id
      };
    },
    requiredOps: function(){
      /*
      var ids = [];
      for (var end in op.map) {
        ids.push(op.map[end]);
      }
      return ids;
      */
      return [];
    },
    execute: function* (op) {
      if ((yield* this.addOperation(op)) === false) {
        return;
      }
    },
    get: function* (op, name) {
      var res = yield* this.getOperation(op.map[name]);
      return (res == null) ? void 0 : (res.opContent == null
                ? res.content : yield* this.getType(res.opContent));
    },
    set: function* (op, name, value) {
      var insert = {
        left: null,
        right: op.map[name] || null,
        parent: op.id,
        parentSub: name
      };
      var oid;
      if ( value != null && value._model != null
           && (oid = value._model.id) != null && oid.length === 2) {
        insert.opContent = oid;
      } else {
        insert.content = value;
      }
      yield* Struct.Insert.create.call(this, insert);
    }
  }
};
