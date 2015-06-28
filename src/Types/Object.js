
(function(){
  class Map {
    constructor (_model) {
      this._model = _model;
    }
    *val () {
      var transaction = yield "transaction";
      var model = transaction.getOperation(this._model);
      if (arguments.length === 0) {
        throw new Error("Implement this case!");
      } else if (arguments.length === 1) {
        return yield* this.Struct.Map.get.call(transaction, model, arguments[0]);
      } else {
        return yield* this.Struct.Map.set.call(transaction, model, arguments[0], arguments[1]);
      }
    }
  }

  Y.Map = function* YMap(){
    var model = yield* this.Struct.map.create.call(this);
    return new Map(model);
  };
  Y.Map.Create = Map;
})();
