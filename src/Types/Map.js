
(function(){
  class Map {
    constructor (_model) {
      this._model = _model;
    }
    *val () {
      var transaction = yield "transaction";
      var model = yield* transaction.getOperation(this._model);
      if (arguments.length === 0) {
        throw new Error("Implement this case!");
      } else if (arguments.length === 1) {
        return yield* Y.Struct.Map.get.call(transaction, model, arguments[0]);
      } else {
        return yield* Y.Struct.Map.set.call(transaction, model, arguments[0], arguments[1]);
      }
    }
  }

  Y.Map = function* YMap(){
    if (this instanceof Y.AbstractOperationStore) {
      var model = yield* Y.Struct.map.create.call(this);
      return new Map(model);
    } else {
      throw new Error("Don't use `new` to create this type!");
    }
  };
  Y.Map.Create = Map;
})();
