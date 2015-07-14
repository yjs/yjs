
var GeneratorFunction = (function*(){}).constructor;

class EventHandler {
  constructor (onevent) {
    this.waiting = [];
    this.awaiting = 0;
    this.onevent = onevent;
  }
  receivedOp (op) {
    if (this.awaiting <= 0) {
      this.onevent([op]);
    } else {
      this.waiting.push(copyObject(op));
    }
  }
  awaitAndPrematurelyCall (ops) {
    this.awaiting++;
    this.onevent(ops);
  }
  awaitedLastInserts (n) {
    var ops = this.waiting.splice(this.waiting.length - n);
    for (var oid = 0; oid < ops.length; oid++) {
      var op = ops[oid];
      for (var i = this.waiting.length - 1; i >= 0; i--) {
        let w = this.waiting[i];
        if (compareIds(op.left, w.id)) {
          // include the effect of op in w
          w.right = op.id;
          // exclude the effect of w in op
          op.left = w.left;
        } else if (compareIds(op.right, w.id)) {
          // similar..
          w.left = op.id;
          op.right = w.right;
        }
      }
    }
    this.tryCallEvents();
  }
  awaitedLastDeletes (n, newLeft) {
    var ops = this.waiting.splice(this.waiting.length - n);
    for (var j in ops) {
      var del = ops[j];
      if (newLeft != null) {
        for (var i in this.waiting) {
          let w = this.waiting[i];
          // We will just care about w.left
          if (compareIds(del.target, w.left)) {
            del.left = newLeft;
          }
        }
      }
    }
    this.tryCallEvents();
  }
  tryCallEvents () {
    this.awaiting--;
    if (this.awaiting <= 0) {
      var events = this.waiting;
      this.waiting = [];
      this.onevent(events);
    }
  }

}
(function(){
  class Map {
    constructor (os, model) {
      this._model = model.id;
      this.os = os;
      this.map = copyObject(model.map);
      this.contents = {};
      this.opContents = {};
      this.eventHandler = new EventHandler( ops =>{
        for (var i in ops) {
          var op = ops[i];
          if (op.struct === "Insert"){
            if (op.left === null) {
              if (op.opContent != null) {
                this.opContents[op.parentSub] = op.opContent;
              } else {
                this.contents[op.parentSub] = op.content;
              }
              this.map[op.parentSub] = op.id;
            }
          } else if (op.struct === "Delete") {
            var key = op.key;
            if (compareIds(this.map[key], op.target)) {
              if (this.contents[key] != null) {
                delete this.contents[key];
              } else {
                delete this.opContents[key];
              }
            }
          } else {
            throw new Error("Unexpected Operation!");
          }
        }
      });
    }
    get (key) {
      // return property.
      // if property does not exist, return null
      // if property is a type, return a promise
      if (this.opContents[key] == null) {
        if (key == null) {
          return copyObject(this.contents);
        } else {
          return this.contents[key];
        }
      } else {
        let def = Promise.defer();
        var oid = this.opContents[key];
        this.os.requestTransaction(function*(){
          def.resolve(yield* this.getType(oid));
        });
        return def.promise;
      }
    }
    delete (key) {
      var right = this.map[key];
      if (right != null) {
        var del = {
          target: right,
          struct: "Delete"
        };
        var eventHandler = this.eventHandler;
        var modDel = copyObject(del);
        modDel.key = key;
        eventHandler.awaitAndPrematurelyCall([modDel]);
        this.os.requestTransaction(function*(){
          yield* this.applyCreatedOperations([del]);
          eventHandler.awaitedLastDeletes(1);
        });
      }
    }
    set (key, value) {
      // set property.
      // if property is a type, return a promise
      // if not, apply immediately on this type an call event

      var right = this.map[key] || null;
      var insert = {
        left: null,
        right: right,
        origin: null,
        parent: this._model,
        parentSub: key,
        struct: "Insert"
      };
      var def = Promise.defer();
      if ( value != null && value.constructor === GeneratorFunction) {
        // construct a new type
        this.os.requestTransaction(function*(){
          var type = yield* value.call(this);
          insert.opContent = type._model;
          insert.id = this.store.getNextOpId();
          yield* this.applyCreatedOperations([insert]);
          def.resolve(type);
        });
      } else {
        insert.content = value;
        insert.id = this.os.getNextOpId();
        var eventHandler = this.eventHandler;
        eventHandler.awaitAndPrematurelyCall([insert]);

        this.os.requestTransaction(function*(){
          yield* this.applyCreatedOperations([insert]);
          eventHandler.awaitedLastInserts(1);
        });
        def.resolve(value);
      }
      return def.promise;
    }
    /*
    *delete (key) {
      var t = yield "transaction";
      var model = yield* t.getOperation(this._model);
      yield* Y.Struct.Map.delete.call(t, model, key);
    }*/
    *_changed (transaction, op) {
      if (op.struct === "Delete") {
        op.key = (yield* transaction.getOperation(op.target)).parentSub;
      }
      this.eventHandler.receivedOp(op);
    }
  }

  Y.Map = function* YMap(){
    var model = {
      map: {},
      struct: "Map",
      type: "Map",
      id: this.store.getNextOpId()
    };
    yield* this.applyCreatedOperations([model]);
    return yield* this.createType(model);
  };
  Y.Map.create = function* YMapCreate(os, model){
    return new Map(os, model);
  };
})();
