

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
      if (typeof pos !== "number") {
        throw new Error("pos must be a number!");
      }
      if (!(contents instanceof Array)) {
        throw new Error("contents must be an Array of objects!");
      }
      var t = yield "transaction";
      yield* Y.Struct.List.insert.call(t, this._model, pos, contents);
    }
    *delete (pos) {
      if (typeof pos !== "number") {
        throw new Error("pos must be a number!");
      }
      var t = yield "transaction";
      yield* Y.Struct.List.delete.call(t, this._model, pos);
    }
  }

  Y.List = function* YList(){
    var t = yield "transaction";
    var model = yield* Y.Struct.List.create.call(t, {type: "List"});
    return new List(model);
  };
  Y.List.Create = List;
})();
