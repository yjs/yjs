var Engine, _;

_ = require("underscore");

Engine = (function() {
  function Engine(HB, parser) {
    this.HB = HB;
    this.parser = parser;
    this.unprocessed_ops = [];
  }

  Engine.prototype.parseOperation = function(json) {
    var typeParser;
    typeParser = this.parser[json.type];
    if (typeParser != null) {
      return typeParser(json);
    } else {
      throw new Error("You forgot to specify a parser for type " + json.type + ". The message is " + (JSON.stringify(json)) + ".");
    }
  };

  Engine.prototype.applyOps = function(ops) {
    var o, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = ops.length; _i < _len; _i++) {
      o = ops[_i];
      _results.push(this.applyOp(o));
    }
    return _results;
  };

  Engine.prototype.applyOp = function(op_json) {
    var o, op, unprocessed, _i, _len, _ref;
    o = this.parseOperation(o_json);
    this.HB.addOperation(o);
    if (!o.execute()) {
      this.unprocessed_ops.push(o);
    }
    unprocessed = [];
    _ref = this.unprocessed_ops;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      op = _ref[_i];
      if (!op.execute()) {
        unprocessed.push(op);
      }
    }
    return this.unprocessed_ops = unprocessed;
  };

  return Engine;

})();

module.exports = Engine;

//# sourceMappingURL=Engine.js.map
