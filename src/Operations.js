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
                      left : Struct.Insert,
                      right : Struct.Insert) : Struct.Insert {
      op.left = left ? left.id : null;
      op.origin = op.left;
      op.right = right ? right.id : null;
      op.type = "Insert";
      yield* Struct.Operation.create(op, user);

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
      ids.push(op.left);
      ids.push(op.right);
      return ids;
    },
    execute: function*(op){
      return op;
    }
  }
};
