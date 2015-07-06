

(function(){

  class List {
    constructor (_model) {
      this._model = _model;
    }
    *val (pos) {
      var t = yield "transaction";
      if (pos != null) {
        var o = yield* Y.Struct.List.ref.call(t, this._model, pos);
        return o ? o.content : null;
      } else {
        return yield* Y.Struct.List.map.call(t, this._model, function(c){return c; });
      }
    }
    *insert (pos, contents) {
      var t = yield "transaction";
      yield* Y.Struct.List.insert.call(t, this._model, pos, contents);
    }
  }

  Y.List = function* YList(){
    var t = yield "transaction";
    var model = yield* Y.Struct.List.create.call(t, {type: "List"});
    return new List(model);
  };
  Y.List.Create = List;
})();
