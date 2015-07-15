
var GeneratorFunction = (function*(){}).constructor;

class EventHandler {
  constructor (onevent) {
    this.waiting = [];
    this.awaiting = 0;
    this.onevent = onevent;
    this.userEventListeners = [];
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
  addUserEventListener (f) {
    this.userEventListeners.push(f);
  }
  removeUserEventListener (f) {
    this.userEventListeners = this.userEventListeners.filter(function(g){
      return f !== g;
    });
  }
  removeAllUserEventListeners () {
    this.userEventListeners = [];
  }
  callUserEventListeners (event) {
    for (var i in this.userEventListeners) {
      try {
        this.userEventListeners[i](event);
      } catch (e) {
        console.log("User events must not throw Errors!");//eslint-disable-line
      }
    }
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
    if (this.awaiting <= 0 && this.waiting.length > 0) {
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
        var userEvents = [];
        for (var i in ops) {
          var op = ops[i];
          var oldValue;
          // key is the name to use to access (op)content
          var key = op.struct === "Delete" ? op.key : op.parentSub;

          // compute oldValue
          if (this.opContents[key] != null) {
            let prevType = this.opContents[key];
            oldValue = () => { //eslint-disable-line
              let def = Promise.defer();
              this.os.requestTransaction(function*(){//eslint-disable-line
                def.resolve(yield* this.getType(prevType));
              });
              return def.promise;
            };
          } else {
            oldValue = this.contents[key];
          }
          // compute op event
          if (op.struct === "Insert"){
            if (op.left === null) {
              if (op.opContent != null) {
                delete this.contents[key];
                this.opContents[key] = op.opContent;
              } else {
                delete this.opContents[key];
                this.contents[key] = op.content;
              }
              this.map[key] = op.id;
              var insertEvent = {
                name: key,
                object: this
              };
              if (oldValue === undefined) {
                insertEvent.type = "add";
              } else {
                insertEvent.type = "update";
                insertEvent.oldValue = oldValue;
              }
              userEvents.push(insertEvent);
            }
          } else if (op.struct === "Delete") {
            if (compareIds(this.map[key], op.target)) {
              if (this.opContents[key] != null) {
                delete this.opContents[key];
              } else {
                delete this.contents[key];
              }
              var deleteEvent = {
                name: key,
                object: this,
                oldValue: oldValue,
                type: "delete"
              };
              userEvents.push(deleteEvent);
            }
          } else {
            throw new Error("Unexpected Operation!");
          }
        }
        this.eventHandler.callUserEventListeners(userEvents);
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
    observe (f) {
      this.eventHandler.addUserEventListener(f);
    }
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
