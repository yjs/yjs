var Replaceable, y, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

y = require("Engine");

_ = require("underscore");

Replaceable = (function(_super) {
  __extends(Replaceable, _super);

  function Replaceable(user_id, content) {
    Replaceable.__super__.constructor.call(this, user_id, []);
    this.replace(content);
  }

  Replaceable.prototype.replace = function(content) {
    var o, op;
    o = this.HB.getLastOperation();
    op = new I(content, this.user_id, this.HB.getOperationCounter(this.user_id), o, o.next_cl);
    this.HB.addOperation(op).IT();
    return op.toJson();
  };

  Replaceable.prototype.getContent = function() {
    return this.HB.getLastOperation().execute();
  };

  return Replaceable;

})(y.Engine);

//# sourceMappingURL=ReplaceType.js.map
