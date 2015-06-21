

(function(){

  class List {
    constructor (_model) {
      this._model = _model;
    }
    *val (pos) {
      var o = yield* this.Struct.List.ref(pos);
      return o ? o.content : null;
    }
    *insert (pos, contents) {
      yield* this.Struct.List.insert(pos, contents);
    }
  }

  Y.List = function* YList(){
    var model = yield* this.Struct.List.create();
    return new Y.List.Create(model);
  }

  Y.List.Create = List;
  Y.List = List;
})();
