var HistoryBuffer, _;

_ = require("underscore");

HistoryBuffer = (function() {
  function HistoryBuffer(user_id) {
    this.user_id = user_id;
    this.operation_counter = {};
    this.buffer = {};
    this.change_listeners = [];
  }

  HistoryBuffer.prototype.getUserId = function() {
    return this.user_id;
  };

  HistoryBuffer.prototype.getOperationCounter = function() {
    return _.clone(this.operation_counter);
  };

  HistoryBuffer.prototype.toJson = function() {
    var json, o, user, _i, _len, _ref;
    json = [];
    _ref = this.buffer;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      for (o in user) {
        json.push(o.toJson());
      }
    }
    return json;
  };

  HistoryBuffer.prototype.getNextOperationIdentifier = function(user_id) {
    var uid;
    if (user_id == null) {
      user_id = this.user_id;
    }
    if (this.operation_counter[user_id] == null) {
      this.operation_counter[user_id] = 0;
    }
    uid = {
      'creator': user_id,
      'op_number': this.operation_counter[user_id]
    };
    this.operation_counter[user_id]++;
    return uid;
  };

  HistoryBuffer.prototype.getOperation = function(uid) {
    var _ref;
    if (uid instanceof Object) {
      return (_ref = this.buffer[uid.creator]) != null ? _ref[uid.op_number] : void 0;
    } else {
      throw new Error("This type of uid is not defined!");
    }
  };

  HistoryBuffer.prototype.addOperation = function(o) {
    if (this.buffer[o.creator] == null) {
      this.buffer[o.creator] = {};
    }
    if (this.operation_counter[o.creator] == null) {
      this.operation_counter[o.creator] = 0;
    }
    if (this.buffer[o.creator][o.op_number] != null) {
      throw new Error("You must not overwrite operations!");
    }
    this.buffer[o.creator][o.op_number] = o;
    if (typeof o.op_number === 'number' && o.creator !== this.getUserId()) {
      this.operation_counter[o.creator]++;
    }
    return o;
  };

  return HistoryBuffer;

})();

module.exports = HistoryBuffer;

//# sourceMappingURL=HistoryBuffer.js.map
