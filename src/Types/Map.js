
(function(){
  class Map {
    constructor (_model) {
      this._model = _model;
    }
    *val () {
      var t = yield "transaction";
      var model = yield* t.getOperation(this._model);
      if (arguments.length === 0) {
        var res = {};
        for (var key in model.map) {
          var v = yield* Y.Struct.Map.get.call(t, model, key);
          if (v != null) {
            res[key] = v;
          }
        }
        return res;
      } else if (arguments.length === 1) {
        return yield* Y.Struct.Map.get.call(t, model, arguments[0]);
      } else if (arguments.length === 2) {
        return yield* Y.Struct.Map.set.call(t, model, arguments[0], arguments[1]);
      } else {
        throw new Error("Implement this case!");
      }
    }
    *delete (key) {
      var t = yield "transaction";
      var model = yield* t.getOperation(this._model);
      yield* Y.Struct.Map.delete.call(t, model, key);
    }
  }

  Y.Map = function* YMap(){
    var t = yield "transaction";
    if (this instanceof Y.AbstractOperationStore) {
      var model = yield* Y.Struct.map.create.call(t, {type: "Map"});
      return new Map(model);
    } else {
      throw new Error("Don't use `new` to create this type!");
    }
  };
  Y.Map.Create = Map;
})();
