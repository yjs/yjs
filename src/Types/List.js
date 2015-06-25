

(function(){

  class List {
    constructor (_model) {
      this._model = _model;
    }
    *val (pos) {
      if (pos != null) {
        var o = yield* this.Struct.List.ref(this._model, pos);
        return o ? o.content : null;
      } else {
        return yield* this.Struct.List.map(this._model, function(c){return c; });
      }
    }
    *insert (pos, contents) {
      yield* this.Struct.List.insert(pos, contents);
    }
  }

  Y.List = function* YList(){
    var model = yield* this.Struct.List.create();
    return new List(model);
  };
  Y.List.Create = List;
})();
