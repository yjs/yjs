
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
  awaitAndPrematurelyCall (op) {
    this.awaiting++;
    this.onevent([op]);
  }
  awaitedLastOp () {
    var op = this.waiting.pop();
    for (var i = this.waiting.length - 1; i >= 0; i--) {
      var w = this.waiting[i];
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
      this.map = model.map;
      this.contents = {};
      this.opContents = {};
      this.eventHandler = new EventHandler( ops =>{
        for (var i in ops) {
          var op = ops[i];
          if (op.left === null) {
            if (op.opContent != null) {
              this.opContents[op.parentSub] = op.opContent;
            } else {
              this.contents[op.parentSub] = op.content;
            }
          }
        }
      });
    }
    get (key) {
      // return property.
      // if property does not exist, return null
      // if property is a type, return a promise
      if (this.opContents[key] == null) {
        return this.contents[key];
      } else {
        let def = Promise.defer();
        var oid = this.opContents[key];
        this.os.requestTransaction(function*(){
          def.resolve(yield* this.getType(oid));
        });
        return def.promise;
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
        parent: this._model,
        parentSub: key
      };
      var def = Promise.defer();
      if ( value != null && value.constructor === GeneratorFunction) {
        // construct a new type
        this.os.requestTransaction(function*(){
          var type = yield* value.call(this);
          insert.opContent = type._model;
          yield* Struct.Insert.create.call(this, insert);
          def.resolve(type);
        });
      } else {
        insert.content = value;
        var eventHandler = this.eventHandler;
        eventHandler.awaitAndPrematurelyCall(insert);

        this.os.requestTransaction(function*(){
          yield* Struct.Insert.create.call(this, insert);
          eventHandler.awaitedLastOp();
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
    _changed (op) {
      this.eventHandler.receivedOp(op);
    }
  }

  Y.Map = function* YMap(){
    var model = yield* Y.Struct.Map.create.call(this, {type: "Map"});
    return yield* this.createType(model);
  };
  Y.Map.create = function* YMapCreate(os, model){
    return new Map(os, model);
  };
})();
