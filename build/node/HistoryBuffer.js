(function() {
  var HistoryBuffer,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  HistoryBuffer = (function() {
    function HistoryBuffer(user_id) {
      this.user_id = user_id;
      this.emptyGarbage = __bind(this.emptyGarbage, this);
      this.operation_counter = {};
      this.buffer = {};
      this.change_listeners = [];
      this.garbage = [];
      this.trash = [];
      this.performGarbageCollection = true;
      this.garbageCollectTimeout = 1000;
      this.reserved_identifier_counter = 0;
      setTimeout(this.emptyGarbage, this.garbageCollectTimeout);
    }

    HistoryBuffer.prototype.emptyGarbage = function() {
      var o, _i, _len, _ref;
      _ref = this.garbage;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        o = _ref[_i];
        if (typeof o.cleanup === "function") {
          o.cleanup();
        }
      }
      this.garbage = this.trash;
      this.trash = [];
      if (this.garbageCollectTimeout !== -1) {
        this.garbageCollectTimeoutId = setTimeout(this.emptyGarbage, this.garbageCollectTimeout);
      }
      return void 0;
    };

    HistoryBuffer.prototype.getUserId = function() {
      return this.user_id;
    };

    HistoryBuffer.prototype.addToGarbageCollector = function() {
      var o, _i, _len, _results;
      if (this.performGarbageCollection) {
        _results = [];
        for (_i = 0, _len = arguments.length; _i < _len; _i++) {
          o = arguments[_i];
          if (o != null) {
            _results.push(this.garbage.push(o));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    HistoryBuffer.prototype.stopGarbageCollection = function() {
      this.performGarbageCollection = false;
      this.setManualGarbageCollect();
      this.garbage = [];
      return this.trash = [];
    };

    HistoryBuffer.prototype.setManualGarbageCollect = function() {
      this.garbageCollectTimeout = -1;
      clearTimeout(this.garbageCollectTimeoutId);
      return this.garbageCollectTimeoutId = void 0;
    };

    HistoryBuffer.prototype.setGarbageCollectTimeout = function(garbageCollectTimeout) {
      this.garbageCollectTimeout = garbageCollectTimeout;
    };

    HistoryBuffer.prototype.getReservedUniqueIdentifier = function() {
      return {
        creator: '_',
        op_number: "_" + (this.reserved_identifier_counter++)
      };
    };

    HistoryBuffer.prototype.getOperationCounter = function(user_id) {
      var ctn, res, user, _ref;
      if (user_id == null) {
        res = {};
        _ref = this.operation_counter;
        for (user in _ref) {
          ctn = _ref[user];
          res[user] = ctn;
        }
        return res;
      } else {
        return this.operation_counter[user_id];
      }
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
          if (o.doSync && unknown(u_name, o_number)) {
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

    HistoryBuffer.prototype.removeOperation = function(o) {
      var _ref;
      return (_ref = this.buffer[o.creator]) != null ? delete _ref[o.op_number] : void 0;
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