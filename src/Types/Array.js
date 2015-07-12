

(function(){

  class YArray {
    constructor (os, _model, idArray, valArray) {
      this.os = os;
      this._model = _model;
      // Array of all the operation id's
      this.idArray = idArray;
      this.valArray = valArray;
      this.eventHandler = new EventHandler( ops =>{
        for (var i in ops) {
          var op = ops[i];
          var pos;
          if (op.right === null) {
            pos = this.idArray.length;
          } else {
            var sid = JSON.stringify(op.right);
            pos = this.idArray.indexOf(sid);
          }
          if (pos < 0) {
            throw new Error("Unexpected operation!");
          }
          this.idArray.splice(pos, 0, JSON.stringify(op.id));
          this.valArray.splice(pos, 0, op.content);
        }
      });
    }
    get (pos) {
      if (pos == null || typeof pos !== "number") {
          throw new Error("pos must be a number!");
      }
      return this.valArray[pos];
    }
    toArray() {
      return this.valArray.slice();
    }
    insert (pos, contents) {
      if (typeof pos !== "number") {
        throw new Error("pos must be a number!");
      }
      if (!(contents instanceof Array)) {
        throw new Error("contents must be an Array of objects!");
      }
      if (contents.length === 0) {
        return;
      }
      if (pos > this.idArray.length || pos < 0) {
        throw new Error("This position exceeds the range of the array!");
      }
      var mostLeft = pos === 0 ? null : JSON.parse(this.idArray[pos - 1]);
      var mostRight = pos === this.idArray.length ? null : JSON.parse(this.idArray[pos]);

      var ops = [];
      var prevId = mostLeft;
      for (var i = 0; i < contents.length; i++) {
        var op = {
          left: prevId,
          origin: prevId,
          right: mostRight,
          parent: this._model,
          content: contents[i],
          struct: "Insert",
          id: this.os.getNextOpId()
        };
        ops.push(op);
        prevId = op.id;
      }
      var eventHandler = this.eventHandler;
      eventHandler.awaitAndPrematurelyCall(ops);
      this.os.requestTransaction(function*(){
        yield* this.applyCreatedOperations(ops);
        eventHandler.awaitedLastOp(ops.length);
      });
    }
    *delete (pos) {
      if (typeof pos !== "number") {
        throw new Error("pos must be a number!");
      }
      var t = yield "transaction";
      var model = yield* t.getOperation(this._model);
      yield* Y.Struct.Array.delete.call(t, model, pos);
    }
    _changed (op) {
      this.eventHandler.receivedOp(op);
    }
  }

  Y.Array = function* _YArray(){
    var model = {
      start: null,
      end: null,
      struct: "List",
      type: "Array",
      id: this.store.getNextOpId()
    };
    yield* this.applyCreatedOperations([model]);
    return yield* this.createType(model);
  };
  Y.Array.create = function* YArrayCreate(os, model){
    var valArray = [];
    var idArray = yield* Y.Struct.List.map.call(this, model, function(c){
      valArray.push(c.content);
      return JSON.stringify(c.id);
    });
    return new YArray(os, model.id, idArray, valArray);
  };
})();
