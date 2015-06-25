/* @flow */

// Op is anything that we could get from the OperationStore.
type Op = Object;

var Struct = {
  Operation: {  //eslint-disable-line no-unused-vars
    create: function*(op : Op, user : string) : Struct.Operation {
      var state = yield* this.getState(user);
      op.id = [user, state.clock];
      return yield* this.addOperation(op);
    }
  },
  Insert: {
    create: function*( op : Op,
                      user : string,
                      content : any,
                      left : Struct.Insert,
                      right : Struct.Insert,
                      parent : Struct.List) : Insert {
      op.left = left ? left.id : null;
      op.origin = op.left;
      op.right = right ? right.id : null;
      op.parent = parent.id;
      op.struct = "Insert";
      yield* Struct.Operation.create.call(this, op, user);

      if (left != null) {
        left.right = op.id;
        yield* this.setOperation(left);
      }
      if (right != null) {
        right.left = op.id;
        yield* this.setOperation(right);
      }
      return op;
    },
    requiredOps: function(op, ids){
      if(op.left != null){
        ids.push(op.left);
      }
      if(op.right != null){
        ids.push(op.right);
      }
      return ids;
    },
    getDistanceToOrigin: function *(op){
      var d = 0;
      var o = yield this.getOperation(op.left);
      while (op.origin !== (o ? o.id : null)) {
        d++;
        o = yield this.getOperation(o.left);
      }
      return d;
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
      var distance_to_origin = yield* Struct.Insert.getDistanceToOrigin(op); // most cases: 0 (starts from 0)
      var i = distance_to_origin; // loop counter
      var o = yield* this.getOperation(this.left);
      o = yield* this.getOperation(o.right);
      var tmp;
      while (true) {
        if (o.id !== this.right){
          if (Struct.Insert.getDistanceToOrigin(o) === i) {
            // case 1
            if (o.id[0] < op.id[0]) {
              op.left = o;
              distance_to_origin = i + 1;
            }
          } else if ((tmp = Struct.Insert.getDistanceToOrigin(o)) < i) {
            // case 2
            if (i - distance_to_origin <= tmp) {
              op.left = o;
              distance_to_origin = i+1;
            }
          } else {
            break;
          }
          i++;
          o = yield* this.getOperation(o.next_cl);
        } else {
          break
        }
      }
      // reconnect..
      var left = this.getOperation(op.left);
      var right = this.getOperation(op.right);
      left.right = op.id;
      right.left = op.id;
      op.left = left;
      op.right = right;
      yield* this.setOperation(left);
      yield* this.setOperation(right);
      yield* this.setOperation(op);
    }
  },
  List: {
    create: function*( op : Op,
                       user : string){
      op.start = null;
      op.end = null;
      op.struct = "List";
      return yield* Struct.Operation.create.call(this, op, user);
    },
    requiredOps: function(op, ids){
      if (op.start != null) {
        ids.push(op.start);
      }
      if (op.end != null){
        ids.push(op.end);
      }
      return ids;
    },
    execute: function* (op) {
      // nop
    },
    ref: function* (op : Op, pos : number) : Insert {
      var o = op.start;
      while ( pos !== 0 || o == null) {
        o = (yield* this.getOperation(o)).right;
        pos--;
      }
      return (o == null) ? null : yield* this.getOperation(o);
    },
    map: function* (o : Op, f : Function) : Array<any> {
      o = o.start;
      var res = [];
      while ( pos !== 0 || o == null) {
        var operation = yield* this.getOperation(o);
        res.push(f(operation.content));
        o = operation.right;
        pos--;
      }
      return res;
    },
    insert: function* (op, pos : number, contents : Array<any>) {
      var o = yield* Struct.List.ref.call(this, op, pos);
      var o_end = yield* this.getOperation(o.right);
      for (var content of contents) {
        o = yield* Struct.Insert.create.call(this, {}, user, content, o, o_end, op);
      }
    }
  }
};
