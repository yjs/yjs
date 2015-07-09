
(function(){
  class Map {
    constructor (os, _model) {
      this._model = _model;
      this.os = os;
    }
    val () {
      if (arguments.length === 1) {
        if (this.opContents[arguments[0]] == null) {
          return this.contents[arguments[0]];
        } else {
          let def = Promise.defer();
          var oid = this.opContents[arguments[0]];
          this.os.requestTransaction(function*(){
            def.resolve(yield* this.getType(oid));
          });
          return def.promise;
        }
      } else if (arguments.length === 2) {
        var key = arguments[0];
        var value = arguments[1];
        let def = Promise.defer();
        var _model = this._model;
        this.os.requestTransaction(function*(){
          var model = yield* this.getOperation(_model);
          def.resolve(yield* Y.Struct.Map.set.call(this, model, key, value));
        });
        return def.promise;
      } else {
        throw new Error("Implement this case!");
      }
    }
    /*
    *delete (key) {
      var t = yield "transaction";
      var model = yield* t.getOperation(this._model);
      yield* Y.Struct.Map.delete.call(t, model, key);
    }*/
    _changed (op) {
      if (op.left === null) {
        if (op.opContent != null) {
          this.opContents[op.parentSub] = op.opContent;
        } else {
          this.contents[op.parentSub] = op.opContent;
        }
      }
    }
  }

  Y.Map = function* YMap(){
    var t = yield "transaction";
    if (this instanceof Y.AbstractOperationStore) {
      var model = yield* Y.Struct.map.create.call(t, {type: "Map"});
      return t.createType(model);
    } else {
      throw new Error("Don't use `new` to create this type!");
    }
  };
  Y.Map.Create = Map;
})();
