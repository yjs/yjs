(function() {
  var HistoryBuffer;

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

    HistoryBuffer.prototype.getReservedUniqueIdentifier = function() {
      return {
        creator: '_',
        op_number: '_'
      };
    };

    HistoryBuffer.prototype.getOperationCounter = function() {
      var ctn, res, user, _ref;
      res = {};
      _ref = this.operation_counter;
      for (user in _ref) {
        ctn = _ref[user];
        res[user] = ctn;
      }
      return res;
    };

    HistoryBuffer.prototype._encode = function(state_vector) {
      var json, o, o_json, o_next, o_number, o_prev, u_name, unknown, user, _ref;
      if (state_vector == null) {
        state_vector = {};
      }
      json = [];
      unknown = function(user, o_number) {
        if ((user == null) || (o_number == null)) {
          throw new Error("dah!");
        }
        return (state_vector[user] == null) || state_vector[user] <= o_number;
      };
      _ref = this.buffer;
      for (u_name in _ref) {
        user = _ref[u_name];
        for (o_number in user) {
          o = user[o_number];
          if ((!isNaN(parseInt(o_number))) && unknown(u_name, o_number)) {
            o_json = o._encode();
            if (o.next_cl != null) {
              o_next = o.next_cl;
              while ((o_next.next_cl != null) && unknown(o_next.creator, o_next.op_number)) {
                o_next = o_next.next_cl;
              }
              o_json.next = o_next.getUid();
            } else if (o.prev_cl != null) {
              o_prev = o.prev_cl;
              while ((o_prev.prev_cl != null) && unknown(o_prev.creator, o_prev.op_number)) {
                o_prev = o_prev.prev_cl;
              }
              o_json.prev = o_prev.getUid();
            }
            json.push(o_json);
          }
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
      } else if (uid == null) {

      } else {
        throw new Error("This type of uid is not defined!");
      }
    };

    HistoryBuffer.prototype.addOperation = function(o) {
      if (this.buffer[o.creator] == null) {
        this.buffer[o.creator] = {};
      }
      if (this.buffer[o.creator][o.op_number] != null) {
        throw new Error("You must not overwrite operations!");
      }
      this.buffer[o.creator][o.op_number] = o;
      return o;
    };

    HistoryBuffer.prototype.addToCounter = function(o) {
      var _results;
      if (this.operation_counter[o.creator] == null) {
        this.operation_counter[o.creator] = 0;
      }
      if (typeof o.op_number === 'number' && o.creator !== this.getUserId()) {
        if (o.op_number === this.operation_counter[o.creator]) {
          this.operation_counter[o.creator]++;
          _results = [];
          while (this.getOperation({
              creator: o.creator,
              op_number: this.operation_counter[o.creator]
            }) != null) {
            _results.push(this.operation_counter[o.creator]++);
          }
          return _results;
        }
      }
    };

    return HistoryBuffer;

  })();

  module.exports = HistoryBuffer;

}).call(this);

//# sourceMappingURL=HistoryBuffer.js.map