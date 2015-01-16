(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var adaptConnector;

adaptConnector = function(connector, engine, HB, execution_listener) {
  var applyHb, encode_state_vector, parse_state_vector, sendHb, sendStateVector, send_;
  send_ = function(o) {
    if (o.uid.creator === HB.getUserId() && (typeof o.uid.op_number !== "string")) {
      return connector.broadcast(o);
    }
  };
  if (connector.invokeSync != null) {
    HB.setInvokeSyncHandler(connector.invokeSync);
  }
  execution_listener.push(send_);
  encode_state_vector = function(v) {
    var name, value, _results;
    _results = [];
    for (name in v) {
      value = v[name];
      _results.push({
        user: name,
        state: value
      });
    }
    return _results;
  };
  parse_state_vector = function(v) {
    var s, state_vector, _i, _len;
    state_vector = {};
    for (_i = 0, _len = v.length; _i < _len; _i++) {
      s = v[_i];
      state_vector[s.user] = s.state;
    }
    return state_vector;
  };
  sendStateVector = function() {
    return encode_state_vector(HB.getOperationCounter());
  };
  sendHb = function(v) {
    var json, state_vector;
    state_vector = parse_state_vector(v);
    json = {
      hb: HB._encode(state_vector),
      state_vector: encode_state_vector(HB.getOperationCounter())
    };
    return json;
  };
  applyHb = function(res) {
    HB.renewStateVector(parse_state_vector(res.state_vector));
    return engine.applyOpsCheckDouble(res.hb);
  };
  connector.whenSyncing(sendStateVector, sendHb, applyHb);
  connector.whenReceiving(function(sender, op) {
    if (op.uid.creator !== HB.getUserId()) {
      return engine.applyOp(op);
    }
  });
  if (connector._whenBoundToYatta != null) {
    return connector._whenBoundToYatta();
  }
};

module.exports = adaptConnector;


},{}],2:[function(require,module,exports){
var Engine;

if (typeof window !== "undefined" && window !== null) {
  window.unprocessed_counter = 0;
}

if (typeof window !== "undefined" && window !== null) {
  window.unprocessed_exec_counter = 0;
}

if (typeof window !== "undefined" && window !== null) {
  window.unprocessed_types = [];
}

Engine = (function() {
  function Engine(HB, types) {
    this.HB = HB;
    this.types = types;
    this.unprocessed_ops = [];
  }

  Engine.prototype.parseOperation = function(json) {
    var type;
    type = this.types[json.type];
    if ((type != null ? type.parse : void 0) != null) {
      return type.parse(json);
    } else {
      throw new Error("You forgot to specify a parser for type " + json.type + ". The message is " + (JSON.stringify(json)) + ".");
    }
  };


  /*
  applyOpsBundle: (ops_json)->
    ops = []
    for o in ops_json
      ops.push @parseOperation o
    for o in ops
      if not o.execute()
        @unprocessed_ops.push o
    @tryUnprocessed()
   */

  Engine.prototype.applyOpsCheckDouble = function(ops_json) {
    var o, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = ops_json.length; _i < _len; _i++) {
      o = ops_json[_i];
      if (this.HB.getOperation(o.uid) == null) {
        _results.push(this.applyOp(o));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  Engine.prototype.applyOps = function(ops_json) {
    return this.applyOp(ops_json);
  };

  Engine.prototype.applyOp = function(op_json_array) {
    var o, op_json, _i, _len;
    if (op_json_array.constructor !== Array) {
      op_json_array = [op_json_array];
    }
    for (_i = 0, _len = op_json_array.length; _i < _len; _i++) {
      op_json = op_json_array[_i];
      o = this.parseOperation(op_json);
      if (this.HB.getOperation(o) != null) {

      } else if ((!this.HB.isExpectedOperation(o)) || (!o.execute())) {
        this.unprocessed_ops.push(o);
        if (typeof window !== "undefined" && window !== null) {
          window.unprocessed_types.push(o.type);
        }
      }
    }
    return this.tryUnprocessed();
  };

  Engine.prototype.tryUnprocessed = function() {
    var old_length, op, unprocessed, _i, _len, _ref;
    while (true) {
      old_length = this.unprocessed_ops.length;
      unprocessed = [];
      _ref = this.unprocessed_ops;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        op = _ref[_i];
        if (this.HB.getOperation(op) != null) {

        } else if ((!this.HB.isExpectedOperation(op)) || (!op.execute())) {
          unprocessed.push(op);
        }
      }
      this.unprocessed_ops = unprocessed;
      if (this.unprocessed_ops.length === old_length) {
        break;
      }
    }
    if (this.unprocessed_ops.length !== 0) {
      return this.HB.invokeSync();
    }
  };

  return Engine;

})();

module.exports = Engine;


},{}],3:[function(require,module,exports){
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
    this.garbageCollectTimeout = 20000;
    this.reserved_identifier_counter = 0;
    setTimeout(this.emptyGarbage, this.garbageCollectTimeout);
  }

  HistoryBuffer.prototype.resetUserId = function(id) {
    var o, o_name, own;
    own = this.buffer[this.user_id];
    if (own != null) {
      for (o_name in own) {
        o = own[o_name];
        o.uid.creator = id;
      }
      if (this.buffer[id] != null) {
        throw new Error("You are re-assigning an old user id - this is not (yet) possible!");
      }
      this.buffer[id] = own;
      delete this.buffer[this.user_id];
    }
    this.operation_counter[id] = this.operation_counter[this.user_id];
    delete this.operation_counter[this.user_id];
    return this.user_id = id;
  };

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
      op_number: "_" + (this.reserved_identifier_counter++),
      doSync: false
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

  HistoryBuffer.prototype.isExpectedOperation = function(o) {
    var _base, _name;
    if ((_base = this.operation_counter)[_name = o.uid.creator] == null) {
      _base[_name] = 0;
    }
    return o.uid.op_number <= this.operation_counter[o.uid.creator];
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
        if (o.uid.doSync && unknown(u_name, o_number)) {
          o_json = o._encode();
          if (o.next_cl != null) {
            o_next = o.next_cl;
            while ((o_next.next_cl != null) && unknown(o_next.uid.creator, o_next.uid.op_number)) {
              o_next = o_next.next_cl;
            }
            o_json.next = o_next.getUid();
          } else if (o.prev_cl != null) {
            o_prev = o.prev_cl;
            while ((o_prev.prev_cl != null) && unknown(o_prev.uid.creator, o_prev.uid.op_number)) {
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
      'op_number': this.operation_counter[user_id],
      'doSync': true
    };
    this.operation_counter[user_id]++;
    return uid;
  };

  HistoryBuffer.prototype.getOperation = function(uid) {
    var o, _ref;
    if (uid.uid != null) {
      uid = uid.uid;
    }
    o = (_ref = this.buffer[uid.creator]) != null ? _ref[uid.op_number] : void 0;
    if ((uid.sub != null) && (o != null)) {
      return o.retrieveSub(uid.sub);
    } else {
      return o;
    }
  };

  HistoryBuffer.prototype.addOperation = function(o) {
    if (this.buffer[o.uid.creator] == null) {
      this.buffer[o.uid.creator] = {};
    }
    if (this.buffer[o.uid.creator][o.uid.op_number] != null) {
      throw new Error("You must not overwrite operations!");
    }
    if ((o.uid.op_number.constructor !== String) && (!this.isExpectedOperation(o))) {
      throw new Error("this operation was not expected!");
    }
    this.addToCounter(o);
    this.buffer[o.uid.creator][o.uid.op_number] = o;
    return o;
  };

  HistoryBuffer.prototype.removeOperation = function(o) {
    var _ref;
    return (_ref = this.buffer[o.uid.creator]) != null ? delete _ref[o.uid.op_number] : void 0;
  };

  HistoryBuffer.prototype.setInvokeSyncHandler = function(f) {
    return this.invokeSync = f;
  };

  HistoryBuffer.prototype.invokeSync = function() {};

  HistoryBuffer.prototype.renewStateVector = function(state_vector) {
    var state, user, _results;
    _results = [];
    for (user in state_vector) {
      state = state_vector[user];
      if ((this.operation_counter[user] == null) || (this.operation_counter[user] < state_vector[user])) {
        _results.push(this.operation_counter[user] = state_vector[user]);
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  HistoryBuffer.prototype.addToCounter = function(o) {
    if (this.operation_counter[o.uid.creator] == null) {
      this.operation_counter[o.uid.creator] = 0;
    }
    if (typeof o.uid.op_number === 'number' && o.uid.creator !== this.getUserId()) {
      if (o.uid.op_number === this.operation_counter[o.uid.creator]) {
        return this.operation_counter[o.uid.creator]++;
      } else {
        return this.invokeSync(o.uid.creator);
      }
    }
  };

  return HistoryBuffer;

})();

module.exports = HistoryBuffer;


},{}],4:[function(require,module,exports){
var __slice = [].slice,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = function(HB) {
  var execution_listener, types;
  types = {};
  execution_listener = [];
  types.Operation = (function() {
    function Operation(uid) {
      this.is_deleted = false;
      this.garbage_collected = false;
      this.event_listeners = [];
      if (uid != null) {
        this.uid = uid;
      }
    }

    Operation.prototype.type = "Operation";

    Operation.prototype.retrieveSub = function() {
      throw new Error("sub properties are not enable on this operation type!");
    };

    Operation.prototype.observe = function(f) {
      return this.event_listeners.push(f);
    };

    Operation.prototype.unobserve = function(f) {
      return this.event_listeners = this.event_listeners.filter(function(g) {
        return f !== g;
      });
    };

    Operation.prototype.deleteAllObservers = function() {
      return this.event_listeners = [];
    };

    Operation.prototype.callEvent = function() {
      return this.forwardEvent.apply(this, [this].concat(__slice.call(arguments)));
    };

    Operation.prototype.forwardEvent = function() {
      var args, f, op, _i, _len, _ref, _results;
      op = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      _ref = this.event_listeners;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        _results.push(f.call.apply(f, [op].concat(__slice.call(args))));
      }
      return _results;
    };

    Operation.prototype.isDeleted = function() {
      return this.is_deleted;
    };

    Operation.prototype.applyDelete = function(garbagecollect) {
      if (garbagecollect == null) {
        garbagecollect = true;
      }
      if (!this.garbage_collected) {
        this.is_deleted = true;
        if (garbagecollect) {
          this.garbage_collected = true;
          return HB.addToGarbageCollector(this);
        }
      }
    };

    Operation.prototype.cleanup = function() {
      HB.removeOperation(this);
      return this.deleteAllObservers();
    };

    Operation.prototype.setParent = function(parent) {
      this.parent = parent;
    };

    Operation.prototype.getParent = function() {
      return this.parent;
    };

    Operation.prototype.getUid = function() {
      if (this.uid.noOperation == null) {
        return this.uid;
      } else {
        return this.uid.alt;
      }
    };

    Operation.prototype.cloneUid = function() {
      var n, uid, v, _ref;
      uid = {};
      _ref = this.getUid();
      for (n in _ref) {
        v = _ref[n];
        uid[n] = v;
      }
      return uid;
    };

    Operation.prototype.dontSync = function() {
      return this.uid.doSync = false;
    };

    Operation.prototype.execute = function() {
      var l, _i, _len;
      this.is_executed = true;
      if (this.uid == null) {
        this.uid = HB.getNextOperationIdentifier();
      }
      if (this.uid.noOperation == null) {
        HB.addOperation(this);
        for (_i = 0, _len = execution_listener.length; _i < _len; _i++) {
          l = execution_listener[_i];
          l(this._encode());
        }
      }
      return this;
    };

    Operation.prototype.saveOperation = function(name, op) {
      if ((op != null ? op.execute : void 0) != null) {
        return this[name] = op;
      } else if (op != null) {
        if (this.unchecked == null) {
          this.unchecked = {};
        }
        return this.unchecked[name] = op;
      }
    };

    Operation.prototype.validateSavedOperations = function() {
      var name, op, op_uid, success, uninstantiated, _ref;
      uninstantiated = {};
      success = this;
      _ref = this.unchecked;
      for (name in _ref) {
        op_uid = _ref[name];
        op = HB.getOperation(op_uid);
        if (op) {
          this[name] = op;
        } else {
          uninstantiated[name] = op_uid;
          success = false;
        }
      }
      delete this.unchecked;
      if (!success) {
        this.unchecked = uninstantiated;
      }
      return success;
    };

    return Operation;

  })();
  types.Delete = (function(_super) {
    __extends(Delete, _super);

    function Delete(uid, deletes) {
      this.saveOperation('deletes', deletes);
      Delete.__super__.constructor.call(this, uid);
    }

    Delete.prototype.type = "Delete";

    Delete.prototype._encode = function() {
      return {
        'type': "Delete",
        'uid': this.getUid(),
        'deletes': this.deletes.getUid()
      };
    };

    Delete.prototype.execute = function() {
      var res;
      if (this.validateSavedOperations()) {
        res = Delete.__super__.execute.apply(this, arguments);
        if (res) {
          this.deletes.applyDelete(this);
        }
        return res;
      } else {
        return false;
      }
    };

    return Delete;

  })(types.Operation);
  types.Delete.parse = function(o) {
    var deletes_uid, uid;
    uid = o['uid'], deletes_uid = o['deletes'];
    return new this(uid, deletes_uid);
  };
  types.Insert = (function(_super) {
    __extends(Insert, _super);

    function Insert(uid, prev_cl, next_cl, origin, parent) {
      this.saveOperation('parent', parent);
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      if (origin != null) {
        this.saveOperation('origin', origin);
      } else {
        this.saveOperation('origin', prev_cl);
      }
      Insert.__super__.constructor.call(this, uid);
    }

    Insert.prototype.type = "Insert";

    Insert.prototype.applyDelete = function(o) {
      var callLater, garbagecollect, _ref;
      if (this.deleted_by == null) {
        this.deleted_by = [];
      }
      callLater = false;
      if ((this.parent != null) && !this.isDeleted() && (o != null)) {
        callLater = true;
      }
      if (o != null) {
        this.deleted_by.push(o);
      }
      garbagecollect = false;
      if (this.next_cl.isDeleted()) {
        garbagecollect = true;
      }
      Insert.__super__.applyDelete.call(this, garbagecollect);
      if (callLater) {
        this.callOperationSpecificDeleteEvents(o);
      }
      if ((_ref = this.prev_cl) != null ? _ref.isDeleted() : void 0) {
        return this.prev_cl.applyDelete();
      }
    };

    Insert.prototype.cleanup = function() {
      var d, o, _i, _len, _ref;
      if (this.next_cl.isDeleted()) {
        _ref = this.deleted_by;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          d = _ref[_i];
          d.cleanup();
        }
        o = this.next_cl;
        while (o.type !== "Delimiter") {
          if (o.origin === this) {
            o.origin = this.prev_cl;
          }
          o = o.next_cl;
        }
        this.prev_cl.next_cl = this.next_cl;
        this.next_cl.prev_cl = this.prev_cl;
        return Insert.__super__.cleanup.apply(this, arguments);
      }
    };

    Insert.prototype.getDistanceToOrigin = function() {
      var d, o;
      d = 0;
      o = this.prev_cl;
      while (true) {
        if (this.origin === o) {
          break;
        }
        d++;
        o = o.prev_cl;
      }
      return d;
    };

    Insert.prototype.execute = function() {
      var distance_to_origin, i, o;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (this.parent != null) {
          if (this.prev_cl == null) {
            this.prev_cl = this.parent.beginning;
          }
          if (this.origin == null) {
            this.origin = this.parent.beginning;
          }
          if (this.next_cl == null) {
            this.next_cl = this.parent.end;
          }
        }
        if (this.prev_cl != null) {
          distance_to_origin = this.getDistanceToOrigin();
          o = this.prev_cl.next_cl;
          i = distance_to_origin;
          while (true) {
            if (o !== this.next_cl) {
              if (o.getDistanceToOrigin() === i) {
                if (o.uid.creator < this.uid.creator) {
                  this.prev_cl = o;
                  distance_to_origin = i + 1;
                } else {

                }
              } else if (o.getDistanceToOrigin() < i) {
                if (i - distance_to_origin <= o.getDistanceToOrigin()) {
                  this.prev_cl = o;
                  distance_to_origin = i + 1;
                } else {

                }
              } else {
                break;
              }
              i++;
              o = o.next_cl;
            } else {
              break;
            }
          }
          this.next_cl = this.prev_cl.next_cl;
          this.prev_cl.next_cl = this;
          this.next_cl.prev_cl = this;
        }
        this.setParent(this.prev_cl.getParent());
        Insert.__super__.execute.apply(this, arguments);
        this.callOperationSpecificInsertEvents();
        return this;
      }
    };

    Insert.prototype.callOperationSpecificInsertEvents = function() {
      var _ref;
      return (_ref = this.parent) != null ? _ref.callEvent([
        {
          type: "insert",
          position: this.getPosition(),
          object: this.parent,
          changedBy: this.uid.creator,
          value: this.content
        }
      ]) : void 0;
    };

    Insert.prototype.callOperationSpecificDeleteEvents = function(o) {
      return this.parent.callEvent([
        {
          type: "delete",
          position: this.getPosition(),
          object: this.parent,
          length: 1,
          changedBy: o.uid.creator
        }
      ]);
    };

    Insert.prototype.getPosition = function() {
      var position, prev;
      position = 0;
      prev = this.prev_cl;
      while (true) {
        if (prev instanceof types.Delimiter) {
          break;
        }
        if (!prev.isDeleted()) {
          position++;
        }
        prev = prev.prev_cl;
      }
      return position;
    };

    return Insert;

  })(types.Operation);
  types.ImmutableObject = (function(_super) {
    __extends(ImmutableObject, _super);

    function ImmutableObject(uid, content) {
      this.content = content;
      ImmutableObject.__super__.constructor.call(this, uid);
    }

    ImmutableObject.prototype.type = "ImmutableObject";

    ImmutableObject.prototype.val = function() {
      return this.content;
    };

    ImmutableObject.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'content': this.content
      };
      return json;
    };

    return ImmutableObject;

  })(types.Operation);
  types.ImmutableObject.parse = function(json) {
    var content, uid;
    uid = json['uid'], content = json['content'];
    return new this(uid, content);
  };
  types.Delimiter = (function(_super) {
    __extends(Delimiter, _super);

    function Delimiter(prev_cl, next_cl, origin) {
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      this.saveOperation('origin', prev_cl);
      Delimiter.__super__.constructor.call(this, {
        noOperation: true
      });
    }

    Delimiter.prototype.type = "Delimiter";

    Delimiter.prototype.applyDelete = function() {
      var o;
      Delimiter.__super__.applyDelete.call(this);
      o = this.prev_cl;
      while (o != null) {
        o.applyDelete();
        o = o.prev_cl;
      }
      return void 0;
    };

    Delimiter.prototype.cleanup = function() {
      return Delimiter.__super__.cleanup.call(this);
    };

    Delimiter.prototype.execute = function() {
      var _ref, _ref1;
      if (((_ref = this.unchecked) != null ? _ref['next_cl'] : void 0) != null) {
        return Delimiter.__super__.execute.apply(this, arguments);
      } else if ((_ref1 = this.unchecked) != null ? _ref1['prev_cl'] : void 0) {
        if (this.validateSavedOperations()) {
          if (this.prev_cl.next_cl != null) {
            throw new Error("Probably duplicated operations");
          }
          this.prev_cl.next_cl = this;
          return Delimiter.__super__.execute.apply(this, arguments);
        } else {
          return false;
        }
      } else if ((this.prev_cl != null) && (this.prev_cl.next_cl == null)) {
        delete this.prev_cl.unchecked.next_cl;
        this.prev_cl.next_cl = this;
        return Delimiter.__super__.execute.apply(this, arguments);
      } else if ((this.prev_cl != null) || (this.next_cl != null) || true) {
        return Delimiter.__super__.execute.apply(this, arguments);
      }
    };

    Delimiter.prototype._encode = function() {
      var _ref, _ref1;
      return {
        'type': this.type,
        'uid': this.getUid(),
        'prev': (_ref = this.prev_cl) != null ? _ref.getUid() : void 0,
        'next': (_ref1 = this.next_cl) != null ? _ref1.getUid() : void 0
      };
    };

    return Delimiter;

  })(types.Operation);
  types.Delimiter.parse = function(json) {
    var next, prev, uid;
    uid = json['uid'], prev = json['prev'], next = json['next'];
    return new this(uid, prev, next);
  };
  return {
    'types': types,
    'execution_listener': execution_listener
  };
};


},{}],5:[function(require,module,exports){
var text_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_types_uninitialized = require("./TextTypes");

module.exports = function(HB) {
  var text_types, types;
  text_types = text_types_uninitialized(HB);
  types = text_types.types;
  types.Object = (function(_super) {
    __extends(Object, _super);

    function Object() {
      return Object.__super__.constructor.apply(this, arguments);
    }

    Object.prototype.type = "Object";

    Object.prototype.applyDelete = function() {
      return Object.__super__.applyDelete.call(this);
    };

    Object.prototype.cleanup = function() {
      return Object.__super__.cleanup.call(this);
    };

    Object.prototype.toJson = function(transform_to_value) {
      var json, name, o, that, val;
      if (transform_to_value == null) {
        transform_to_value = false;
      }
      if ((this.bound_json == null) || (Object.observe == null) || true) {
        val = this.val();
        json = {};
        for (name in val) {
          o = val[name];
          if (o instanceof types.Object) {
            json[name] = o.toJson(transform_to_value);
          } else if (transform_to_value && o instanceof types.Operation) {
            json[name] = o.val();
          } else {
            json[name] = o;
          }
        }
        this.bound_json = json;
        if (Object.observe != null) {
          that = this;
          Object.observe(this.bound_json, function(events) {
            var event, _i, _len, _results;
            _results = [];
            for (_i = 0, _len = events.length; _i < _len; _i++) {
              event = events[_i];
              if ((event.changedBy == null) && (event.type === "add" || (event.type = "update"))) {
                _results.push(that.val(event.name, event.object[event.name]));
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          });
          this.observe(function(events) {
            var event, notifier, oldVal, _i, _len, _results;
            _results = [];
            for (_i = 0, _len = events.length; _i < _len; _i++) {
              event = events[_i];
              if (event.created_ !== HB.getUserId()) {
                notifier = Object.getNotifier(that.bound_json);
                oldVal = that.bound_json[event.name];
                if (oldVal != null) {
                  notifier.performChange('update', function() {
                    return that.bound_json[event.name] = that.val(event.name);
                  }, that.bound_json);
                  _results.push(notifier.notify({
                    object: that.bound_json,
                    type: 'update',
                    name: event.name,
                    oldValue: oldVal,
                    changedBy: event.changedBy
                  }));
                } else {
                  notifier.performChange('add', function() {
                    return that.bound_json[event.name] = that.val(event.name);
                  }, that.bound_json);
                  _results.push(notifier.notify({
                    object: that.bound_json,
                    type: 'add',
                    name: event.name,
                    oldValue: oldVal,
                    changedBy: event.changedBy
                  }));
                }
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          });
        }
      }
      return this.bound_json;
    };

    Object.prototype.val = function(name, content) {
      var args, i, o, type, _i, _ref;
      if ((name != null) && arguments.length > 1) {
        if ((content != null) && (content.constructor != null)) {
          type = types[content.constructor.name];
          if ((type != null) && (type.create != null)) {
            args = [];
            for (i = _i = 1, _ref = arguments.length; 1 <= _ref ? _i < _ref : _i > _ref; i = 1 <= _ref ? ++_i : --_i) {
              args.push(arguments[i]);
            }
            o = type.create.apply(null, args);
            return Object.__super__.val.call(this, name, o);
          } else {
            throw new Error("The " + content.constructor.name + "-type is not (yet) supported in Yatta.");
          }
        } else {
          return Object.__super__.val.call(this, name, (new types.ImmutableObject(void 0, content)).execute());
        }
      } else {
        return Object.__super__.val.call(this, name);
      }
    };

    Object.prototype._encode = function() {
      return {
        'type': this.type,
        'uid': this.getUid()
      };
    };

    return Object;

  })(types.MapManager);
  types.Object.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  types.Object.create = function(content, mutable) {
    var json, n, o;
    json = new types.Object().execute();
    for (n in content) {
      o = content[n];
      json.val(n, o, mutable);
    }
    return json;
  };
  types.Number = {};
  types.Number.create = function(content) {
    return (new types.ImmutableObject(void 0, content)).execute();
  };
  return text_types;
};


},{"./TextTypes":7}],6:[function(require,module,exports){
var basic_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

basic_types_uninitialized = require("./BasicTypes");

module.exports = function(HB) {
  var basic_types, types;
  basic_types = basic_types_uninitialized(HB);
  types = basic_types.types;
  types.MapManager = (function(_super) {
    __extends(MapManager, _super);

    function MapManager(uid) {
      this.map = {};
      MapManager.__super__.constructor.call(this, uid);
    }

    MapManager.prototype.type = "MapManager";

    MapManager.prototype.applyDelete = function() {
      var name, p, _ref;
      _ref = this.map;
      for (name in _ref) {
        p = _ref[name];
        p.applyDelete();
      }
      return MapManager.__super__.applyDelete.call(this);
    };

    MapManager.prototype.cleanup = function() {
      return MapManager.__super__.cleanup.call(this);
    };

    MapManager.prototype.val = function(name, content) {
      var o, obj, prop, result, _ref;
      if (content != null) {
        this.retrieveSub(name).replace(content);
        return this;
      } else if (name != null) {
        prop = this.map[name];
        if ((prop != null) && !prop.isContentDeleted()) {
          obj = prop.val();
          if (obj instanceof types.ImmutableObject) {
            return obj.val();
          } else {
            return obj;
          }
        } else {
          return void 0;
        }
      } else {
        result = {};
        _ref = this.map;
        for (name in _ref) {
          o = _ref[name];
          if (!o.isContentDeleted()) {
            obj = o.val();
            if (obj instanceof types.ImmutableObject) {
              obj = obj.val();
            }
            result[name] = obj;
          }
        }
        return result;
      }
    };

    MapManager.prototype["delete"] = function(name) {
      var _ref;
      if ((_ref = this.map[name]) != null) {
        _ref.deleteContent();
      }
      return this;
    };

    MapManager.prototype.retrieveSub = function(property_name) {
      var event_properties, event_this, map_uid, rm, rm_uid;
      if (this.map[property_name] == null) {
        event_properties = {
          name: property_name
        };
        event_this = this;
        map_uid = this.cloneUid();
        map_uid.sub = property_name;
        rm_uid = {
          noOperation: true,
          alt: map_uid
        };
        rm = new types.ReplaceManager(event_properties, event_this, rm_uid);
        this.map[property_name] = rm;
        rm.setParent(this, property_name);
        rm.execute();
      }
      return this.map[property_name];
    };

    return MapManager;

  })(types.Operation);
  types.ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(uid) {
      this.beginning = new types.Delimiter(void 0, void 0);
      this.end = new types.Delimiter(this.beginning, void 0);
      this.beginning.next_cl = this.end;
      this.beginning.execute();
      this.end.execute();
      ListManager.__super__.constructor.call(this, uid);
    }

    ListManager.prototype.type = "ListManager";

    ListManager.prototype.execute = function() {
      if (this.validateSavedOperations()) {
        this.beginning.setParent(this);
        this.end.setParent(this);
        return ListManager.__super__.execute.apply(this, arguments);
      } else {
        return false;
      }
    };

    ListManager.prototype.getLastOperation = function() {
      return this.end.prev_cl;
    };

    ListManager.prototype.getFirstOperation = function() {
      return this.beginning.next_cl;
    };

    ListManager.prototype.toArray = function() {
      var o, result;
      o = this.beginning.next_cl;
      result = [];
      while (o !== this.end) {
        result.push(o);
        o = o.next_cl;
      }
      return result;
    };

    ListManager.prototype.getOperationByPosition = function(position) {
      var o;
      o = this.beginning;
      while (true) {
        if (o instanceof types.Delimiter && (o.prev_cl != null)) {
          o = o.prev_cl;
          while (o.isDeleted() || !(o instanceof types.Delimiter)) {
            o = o.prev_cl;
          }
          break;
        }
        if (position <= 0 && !o.isDeleted()) {
          break;
        }
        o = o.next_cl;
        if (!o.isDeleted()) {
          position -= 1;
        }
      }
      return o;
    };

    return ListManager;

  })(types.Operation);
  types.ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(event_properties, event_this, uid, beginning, end) {
      this.event_properties = event_properties;
      this.event_this = event_this;
      if (this.event_properties['object'] == null) {
        this.event_properties['object'] = this.event_this;
      }
      ReplaceManager.__super__.constructor.call(this, uid, beginning, end);
    }

    ReplaceManager.prototype.type = "ReplaceManager";

    ReplaceManager.prototype.applyDelete = function() {
      var o;
      o = this.beginning;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
      }
      return ReplaceManager.__super__.applyDelete.call(this);
    };

    ReplaceManager.prototype.cleanup = function() {
      return ReplaceManager.__super__.cleanup.call(this);
    };

    ReplaceManager.prototype.callEventDecorator = function(events) {
      var event, name, prop, _i, _len, _ref;
      if (!this.isDeleted()) {
        for (_i = 0, _len = events.length; _i < _len; _i++) {
          event = events[_i];
          _ref = this.event_properties;
          for (name in _ref) {
            prop = _ref[name];
            event[name] = prop;
          }
        }
        this.event_this.callEvent(events);
      }
      return void 0;
    };

    ReplaceManager.prototype.replace = function(content, replaceable_uid) {
      var o, relp;
      o = this.getLastOperation();
      relp = (new types.Replaceable(content, this, replaceable_uid, o, o.next_cl)).execute();
      return void 0;
    };

    ReplaceManager.prototype.isContentDeleted = function() {
      return this.getLastOperation().isDeleted();
    };

    ReplaceManager.prototype.deleteContent = function() {
      (new types.Delete(void 0, this.getLastOperation().uid)).execute();
      return void 0;
    };

    ReplaceManager.prototype.val = function() {
      var o;
      o = this.getLastOperation();
      return typeof o.val === "function" ? o.val() : void 0;
    };

    ReplaceManager.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'beginning': this.beginning.getUid(),
        'end': this.end.getUid()
      };
      return json;
    };

    return ReplaceManager;

  })(types.ListManager);
  types.Replaceable = (function(_super) {
    __extends(Replaceable, _super);

    function Replaceable(content, parent, uid, prev, next, origin, is_deleted) {
      this.saveOperation('content', content);
      this.saveOperation('parent', parent);
      Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
      this.is_deleted = is_deleted;
    }

    Replaceable.prototype.type = "Replaceable";

    Replaceable.prototype.val = function() {
      return this.content;
    };

    Replaceable.prototype.applyDelete = function() {
      var res;
      res = Replaceable.__super__.applyDelete.apply(this, arguments);
      if (this.content != null) {
        if (this.next_cl.type !== "Delimiter") {
          this.content.deleteAllObservers();
        }
        this.content.applyDelete();
        this.content.dontSync();
      }
      this.content = null;
      return res;
    };

    Replaceable.prototype.cleanup = function() {
      return Replaceable.__super__.cleanup.apply(this, arguments);
    };

    Replaceable.prototype.callOperationSpecificInsertEvents = function() {
      var old_value;
      if (this.next_cl.type === "Delimiter" && this.prev_cl.type !== "Delimiter") {
        if (!this.is_deleted) {
          old_value = this.prev_cl.content;
          this.parent.callEventDecorator([
            {
              type: "update",
              changedBy: this.uid.creator,
              oldValue: old_value
            }
          ]);
        }
        this.prev_cl.applyDelete();
      } else if (this.next_cl.type !== "Delimiter") {
        this.applyDelete();
      } else {
        this.parent.callEventDecorator([
          {
            type: "add",
            changedBy: this.uid.creator
          }
        ]);
      }
      return void 0;
    };

    Replaceable.prototype.callOperationSpecificDeleteEvents = function(o) {
      if (this.next_cl.type === "Delimiter") {
        return this.parent.callEventDecorator([
          {
            type: "delete",
            changedBy: o.uid.creator,
            oldValue: this.content
          }
        ]);
      }
    };

    Replaceable.prototype._encode = function() {
      var json, _ref;
      json = {
        'type': this.type,
        'content': (_ref = this.content) != null ? _ref.getUid() : void 0,
        'parent': this.parent.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'origin': this.origin.getUid(),
        'uid': this.getUid(),
        'is_deleted': this.is_deleted
      };
      return json;
    };

    return Replaceable;

  })(types.Insert);
  types.Replaceable.parse = function(json) {
    var content, is_deleted, next, origin, parent, prev, uid;
    content = json['content'], parent = json['parent'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], is_deleted = json['is_deleted'];
    return new this(content, parent, uid, prev, next, origin, is_deleted);
  };
  return basic_types;
};


},{"./BasicTypes":4}],7:[function(require,module,exports){
var structured_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

structured_types_uninitialized = require("./StructuredTypes");

module.exports = function(HB) {
  var parser, structured_types, types;
  structured_types = structured_types_uninitialized(HB);
  types = structured_types.types;
  parser = structured_types.parser;
  types.TextInsert = (function(_super) {
    __extends(TextInsert, _super);

    function TextInsert(content, uid, prev, next, origin, parent) {
      var _ref;
      if (content != null ? (_ref = content.uid) != null ? _ref.creator : void 0 : void 0) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      TextInsert.__super__.constructor.call(this, uid, prev, next, origin, parent);
    }

    TextInsert.prototype.type = "TextInsert";

    TextInsert.prototype.getLength = function() {
      if (this.isDeleted()) {
        return 0;
      } else {
        return this.content.length;
      }
    };

    TextInsert.prototype.applyDelete = function() {
      TextInsert.__super__.applyDelete.apply(this, arguments);
      if (this.content instanceof types.Operation) {
        this.content.applyDelete();
      }
      return this.content = null;
    };

    TextInsert.prototype.execute = function() {
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (this.content instanceof types.Operation) {
          this.content.insert_parent = this;
        }
        return TextInsert.__super__.execute.call(this);
      }
    };

    TextInsert.prototype.val = function(current_position) {
      if (this.isDeleted() || (this.content == null)) {
        return "";
      } else {
        return this.content;
      }
    };

    TextInsert.prototype._encode = function() {
      var json, _ref;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'origin': this.origin.getUid(),
        'parent': this.parent.getUid()
      };
      if (((_ref = this.content) != null ? _ref.getUid : void 0) != null) {
        json['content'] = this.content.getUid();
      } else {
        json['content'] = this.content;
      }
      return json;
    };

    return TextInsert;

  })(types.Insert);
  types.TextInsert.parse = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], parent = json['parent'];
    return new types.TextInsert(content, uid, prev, next, origin, parent);
  };
  types.Array = (function(_super) {
    __extends(Array, _super);

    function Array() {
      return Array.__super__.constructor.apply(this, arguments);
    }

    Array.prototype.type = "Array";

    Array.prototype.applyDelete = function() {
      var o;
      o = this.end;
      while (o != null) {
        o.applyDelete();
        o = o.prev_cl;
      }
      return Array.__super__.applyDelete.call(this);
    };

    Array.prototype.cleanup = function() {
      return Array.__super__.cleanup.call(this);
    };

    Array.prototype.val = function() {
      var o, result;
      o = this.beginning.next_cl;
      result = [];
      while (o !== this.end) {
        result.push(o.val());
        o = o.next_cl;
      }
      return result;
    };

    Array.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, content);
    };

    Array.prototype.insertAfter = function(left, content) {
      var c, right, tmp, _i, _len;
      right = left.next_cl;
      while (right.isDeleted()) {
        right = right.next_cl;
      }
      left = right.prev_cl;
      if (content.type != null) {
        (new types.TextInsert(content, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = content.length; _i < _len; _i++) {
          c = content[_i];
          tmp = (new types.TextInsert(c, void 0, left, right)).execute();
          left = tmp;
        }
      }
      return this;
    };

    Array.prototype.insert = function(position, content) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, content);
    };

    Array.prototype["delete"] = function(position, length) {
      var d, delete_ops, i, o, _i;
      o = this.getOperationByPosition(position + 1);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof types.Delimiter) {
          break;
        }
        d = (new types.Delete(void 0, o)).execute();
        o = o.next_cl;
        while (!(o instanceof types.Delimiter) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return this;
    };

    Array.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid()
      };
      return json;
    };

    return Array;

  })(types.ListManager);
  types.Array.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  types.Array.create = function(content, mutable) {
    var list;
    if (mutable === "mutable") {
      list = new types.Array().execute();
      list.insert(0, content);
      return list;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return (new types.ImmutableObject(void 0, content)).execute();
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  types.String = (function(_super) {
    __extends(String, _super);

    function String(uid) {
      this.textfields = [];
      String.__super__.constructor.call(this, uid);
    }

    String.prototype.type = "String";

    String.prototype.val = function() {
      var c, o;
      c = (function() {
        var _i, _len, _ref, _results;
        _ref = this.toArray();
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          o = _ref[_i];
          if (o.val != null) {
            _results.push(o.val());
          } else {
            _results.push("");
          }
        }
        return _results;
      }).call(this);
      return c.join('');
    };

    String.prototype.toString = function() {
      return this.val();
    };

    String.prototype.bind = function(textfield) {
      var word;
      word = this;
      textfield.value = this.val();
      this.textfields.push(textfield);
      this.observe(function(events) {
        var event, fix, left, o_pos, right, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = events.length; _i < _len; _i++) {
          event = events[_i];
          if (event.type === "insert") {
            o_pos = event.position;
            fix = function(cursor) {
              if (cursor <= o_pos) {
                return cursor;
              } else {
                cursor += 1;
                return cursor;
              }
            };
            left = fix(textfield.selectionStart);
            right = fix(textfield.selectionEnd);
            textfield.value = word.val();
            _results.push(textfield.setSelectionRange(left, right));
          } else if (event.type === "delete") {
            o_pos = event.position;
            fix = function(cursor) {
              if (cursor < o_pos) {
                return cursor;
              } else {
                cursor -= 1;
                return cursor;
              }
            };
            left = fix(textfield.selectionStart);
            right = fix(textfield.selectionEnd);
            textfield.value = word.val();
            _results.push(textfield.setSelectionRange(left, right));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
      textfield.onkeypress = function(event) {
        var char, diff, new_pos, pos;
        if (word.is_deleted) {
          textfield.onkeypress = null;
          return true;
        }
        char = null;
        if (event.key != null) {
          if (event.charCode === 32) {
            char = " ";
          } else if (event.keyCode === 13) {
            char = '\n';
          } else {
            char = event.key;
          }
        } else {
          char = String.fromCharCode(event.keyCode);
        }
        if (char.length > 0) {
          pos = Math.min(textfield.selectionStart, textfield.selectionEnd);
          diff = Math.abs(textfield.selectionEnd - textfield.selectionStart);
          word["delete"](pos, diff);
          word.insert(pos, char);
          new_pos = pos + char.length;
          textfield.setSelectionRange(new_pos, new_pos);
          return event.preventDefault();
        } else {
          return event.preventDefault();
        }
      };
      textfield.onpaste = function(event) {
        if (word.is_deleted) {
          textfield.onpaste = null;
          return true;
        }
        return event.preventDefault();
      };
      textfield.oncut = function(event) {
        if (word.is_deleted) {
          textfield.oncut = null;
          return true;
        }
        return event.preventDefault();
      };
      return textfield.onkeydown = function(event) {
        var del_length, diff, new_pos, pos, val;
        if (word.is_deleted) {
          textfield.onkeydown = null;
          return true;
        }
        pos = Math.min(textfield.selectionStart, textfield.selectionEnd);
        diff = Math.abs(textfield.selectionEnd - textfield.selectionStart);
        if ((event.keyCode != null) && event.keyCode === 8) {
          if (diff > 0) {
            word["delete"](pos, diff);
            textfield.setSelectionRange(pos, pos);
          } else {
            if ((event.ctrlKey != null) && event.ctrlKey) {
              val = textfield.value;
              new_pos = pos;
              del_length = 0;
              if (pos > 0) {
                new_pos--;
                del_length++;
              }
              while (new_pos > 0 && val[new_pos] !== " " && val[new_pos] !== '\n') {
                new_pos--;
                del_length++;
              }
              word["delete"](new_pos, pos - new_pos);
              textfield.setSelectionRange(new_pos, new_pos);
            } else {
              word["delete"](pos - 1, 1);
            }
          }
          return event.preventDefault();
        } else if ((event.keyCode != null) && event.keyCode === 46) {
          if (diff > 0) {
            word["delete"](pos, diff);
            textfield.setSelectionRange(pos, pos);
          } else {
            word["delete"](pos, 1);
            textfield.setSelectionRange(pos, pos);
          }
          return event.preventDefault();
        }
      };
    };

    String.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid()
      };
      return json;
    };

    return String;

  })(types.Array);
  types.String.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  types.String.create = function(content, mutable) {
    var word;
    if (mutable === "mutable") {
      word = new types.String().execute();
      word.insert(0, content);
      return word;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return (new types.ImmutableObject(void 0, content)).execute();
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  return structured_types;
};


},{"./StructuredTypes":6}],8:[function(require,module,exports){
var Yatta, bindToChildren;

Yatta = require('./yatta');

bindToChildren = function(that) {
  var attr, i, _i, _ref;
  for (i = _i = 0, _ref = that.children.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    attr = that.children.item(i);
    if (attr.name != null) {
      attr.val = that.val.val(attr.name);
    }
  }
  return that.val.observe(function(events) {
    var event, newVal, _j, _len, _results;
    _results = [];
    for (_j = 0, _len = events.length; _j < _len; _j++) {
      event = events[_j];
      if (event.name != null) {
        _results.push((function() {
          var _k, _ref1, _results1;
          _results1 = [];
          for (i = _k = 0, _ref1 = that.children.length; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
            attr = that.children.item(i);
            if ((attr.name != null) && attr.name === event.name) {
              newVal = that.val.val(attr.name);
              if (attr.val !== newVal) {
                _results1.push(attr.val = newVal);
              } else {
                _results1.push(void 0);
              }
            } else {
              _results1.push(void 0);
            }
          }
          return _results1;
        })());
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  });
};

Polymer("yatta-element", {
  ready: function() {
    if (this.connector != null) {
      this.val = new Yatta(this.connector);
      return bindToChildren(this);
    } else if (this.val != null) {
      return bindToChildren(this);
    }
  },
  valChanged: function() {
    if ((this.val != null) && this.val.type === "JsonType") {
      return bindToChildren(this);
    }
  },
  connectorChanged: function() {
    if (this.val == null) {
      this.val = new Yatta(this.connector);
      return bindToChildren(this);
    }
  }
});

Polymer("yatta-property", {
  ready: function() {
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        this.val = this.parentElement.val(this.name, this.val).val(this.name);
      } else if (typeof this.val === "string") {
        this.parentElement.val(this.name, this.val);
      }
      if (this.val.type === "JsonType") {
        return bindToChildren(this);
      }
    }
  },
  valChanged: function() {
    var _ref;
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        return this.val = this.parentElement.val.val(this.name, this.val).val(this.name);
      } else if (this.val.type === "JsonType") {
        return bindToChildren(this);
      } else if ((((_ref = this.parentElement.val) != null ? _ref.val : void 0) != null) && this.val !== this.parentElement.val.val(this.name)) {
        return this.parentElement.val.val(this.name, this.val);
      }
    }
  }
});


},{"./yatta":9}],9:[function(require,module,exports){
var Engine, HistoryBuffer, adaptConnector, createYatta, json_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

json_types_uninitialized = require("./Types/JsonTypes");

HistoryBuffer = require("./HistoryBuffer");

Engine = require("./Engine");

adaptConnector = require("./ConnectorAdapter");

createYatta = function(connector) {
  var HB, Yatta, type_manager, types, user_id;
  user_id = null;
  if (connector.id != null) {
    user_id = connector.id;
  } else {
    user_id = "_temp";
    connector.whenUserIdSet(function(id) {
      user_id = id;
      return HB.resetUserId(id);
    });
  }
  HB = new HistoryBuffer(user_id);
  type_manager = json_types_uninitialized(HB);
  types = type_manager.types;
  Yatta = (function(_super) {
    __extends(Yatta, _super);

    function Yatta() {
      this.connector = connector;
      this.HB = HB;
      this.types = types;
      this.engine = new Engine(this.HB, type_manager.types);
      adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
      Yatta.__super__.constructor.apply(this, arguments);
    }

    Yatta.prototype.getConnector = function() {
      return this.connector;
    };

    return Yatta;

  })(types.Object);
  return new Yatta(HB.getReservedUniqueIdentifier()).execute();
};

module.exports = createYatta;

if ((typeof window !== "undefined" && window !== null) && (window.Yatta == null)) {
  window.Yatta = createYatta;
}


},{"./ConnectorAdapter":1,"./Engine":2,"./HistoryBuffer":3,"./Types/JsonTypes":5}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL0Nvbm5lY3RvckFkYXB0ZXIuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9saWIvVHlwZXMvQmFzaWNUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL0pzb25UeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1N0cnVjdHVyZWRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1RleHRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL3lhdHRhLWVsZW1lbnQuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi95YXR0YS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNPQSxJQUFBLGNBQUE7O0FBQUEsY0FBQSxHQUFpQixTQUFDLFNBQUQsRUFBWSxNQUFaLEVBQW9CLEVBQXBCLEVBQXdCLGtCQUF4QixHQUFBO0FBQ2YsTUFBQSxnRkFBQTtBQUFBLEVBQUEsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixLQUFpQixFQUFFLENBQUMsU0FBSCxDQUFBLENBQWpCLElBQW9DLENBQUMsTUFBQSxDQUFBLENB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QVRmLENBQUE7QUFBQSxFQVVBLEtBQUEsR0FBUSxZQUFZLENBQUMsS0FWckIsQ0FBQTtBQUFBLEVBbUJNO0FBTUosNEJBQUEsQ0FBQTs7QUFBYSxJQUFBLGVBQUEsR0FBQTtBQUNYLE1BQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxTQUFiLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxFQUFELEdBQU0sRUFETixDQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsS0FBRCxHQUFTLEtBRlQsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLE1BQUQsR0FBYyxJQUFBLE1BQUEsQ0FBTyxJQUFDLENBQUEsRUFBUixFQUFZLFlBQVksQ0FBQyxLQUF6QixDQUhkLENBQUE7QUFBQSxNQUlBLGNBQUEsQ0FBZSxJQUFDLENBQUEsU0FBaEIsRUFBMkIsSUFBQyxDQUFBLE1BQTVCLEVBQW9DLElBQUMsQ0FBQSxFQUFyQyxFQUF5QyxZQUFZLENBQUMsa0JBQXRELENBSkEsQ0FBQTtBQUFBLE1BS0Esd0NBQUEsU0FBQSxDQUxBLENBRFc7SUFBQSxDQUFiOztBQUFBLG9CQVFBLFlBQUEsR0FBYyxTQUFBLEdBQUE7YUFDWixJQUFDLENBQUEsVUFEVztJQUFBLENBUmQsQ0FBQTs7aUJBQUE7O0tBTmtCLEtBQUssQ0FBQyxPQW5CMUIsQ0FBQTtBQW9DQSxTQUFXLElBQUEsS0FBQSxDQUFNLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQU4sQ0FBdUMsQ0FBQyxPQUF4QyxDQUFBLENBQVgsQ0FyQ1k7QUFBQSxDQUxkLENBQUE7O0FBQUEsTUE0Q00sQ0FBQyxPQUFQLEdBQWlCLFdBNUNqQixDQUFBOztBQTZDQSxJQUFHLGtEQUFBLElBQWdCLHNCQUFuQjtBQUNFLEVBQUEsTUFBTSxDQUFDLEtBQVAsR0FBZSxXQUFmLENBREY7Q0E3Q0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5cbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXG5cbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XG4gICAgICB1c2VyOiBuYW1lXG4gICAgICBzdGF0ZTogdmFsdWVcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxuICAgIGZvciBzIGluIHZcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxuICAgIHN0YXRlX3ZlY3RvclxuXG4gIHNlbmRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIHNlbmRIYiA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0gcGFyc2Vfc3RhdGVfdmVjdG9yIHZcbiAgICBqc29uID1cbiAgICAgIGhiOiBIQi5fZW5jb2RlKHN0YXRlX3ZlY3RvcilcbiAgICAgIHN0YXRlX3ZlY3RvcjogZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICBqc29uXG5cbiAgYXBwbHlIYiA9IChyZXMpLT5cbiAgICBIQi5yZW5ld1N0YXRlVmVjdG9yIHBhcnNlX3N0YXRlX3ZlY3RvciByZXMuc3RhdGVfdmVjdG9yXG4gICAgZW5naW5lLmFwcGx5T3BzQ2hlY2tEb3VibGUgcmVzLmhiXG5cbiAgY29ubmVjdG9yLndoZW5TeW5jaW5nIHNlbmRTdGF0ZVZlY3Rvciwgc2VuZEhiLCBhcHBseUhiXG5cbiAgY29ubmVjdG9yLndoZW5SZWNlaXZpbmcgKHNlbmRlciwgb3ApLT5cbiAgICBpZiBvcC51aWQuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICBlbmdpbmUuYXBwbHlPcCBvcFxuXG4gIGlmIGNvbm5lY3Rvci5fd2hlbkJvdW5kVG9ZYXR0YT9cbiAgICBjb25uZWN0b3IuX3doZW5Cb3VuZFRvWWF0dGEoKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkYXB0Q29ubmVjdG9yIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5KS0+XG4gICAgaWYgb3BfanNvbl9hcnJheS5jb25zdHJ1Y3RvciBpc250IEFycmF5XG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXG4gICAgZm9yIG9wX2pzb24gaW4gb3BfanNvbl9hcnJheVxuICAgICAgIyAkcGFyc2VfYW5kX2V4ZWN1dGUgd2lsbCByZXR1cm4gZmFsc2UgaWYgJG9fanNvbiB3YXMgcGFyc2VkIGFuZCBleGVjdXRlZCwgb3RoZXJ3aXNlIHRoZSBwYXJzZWQgb3BlcmFkaW9uXG4gICAgICBvID0gQHBhcnNlT3BlcmF0aW9uIG9wX2pzb25cbiAgICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXG4gICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG8pP1xuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAyMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBvLnVpZC5jcmVhdG9yID0gaWRcbiAgICAgIGlmIEBidWZmZXJbaWRdP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgYXJlIHJlLWFzc2lnbmluZyBhbiBvbGQgdXNlciBpZCAtIHRoaXMgaXMgbm90ICh5ZXQpIHBvc3NpYmxlIVwiXG4gICAgICBAYnVmZmVyW2lkXSA9IG93blxuICAgICAgZGVsZXRlIEBidWZmZXJbQHVzZXJfaWRdXG5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxuICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgICBkb1N5bmM6IGZhbHNlXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiBvLnVpZC5kb1N5bmMgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICAjIGl0cyBuZWNlc3NhcnkgdG8gc2VuZCBpdCwgYW5kIG5vdCBrbm93biBpbiBzdGF0ZV92ZWN0b3JcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD8gIyBhcHBsaWVzIGZvciBhbGwgb3BzIGJ1dCB0aGUgbW9zdCByaWdodCBkZWxpbWl0ZXIhXG4gICAgICAgICAgICAjIHNlYXJjaCBmb3IgdGhlIG5leHQgX2tub3duXyBvcGVyYXRpb24uIChXaGVuIHN0YXRlX3ZlY3RvciBpcyB7fSB0aGVuIHRoaXMgaXMgdGhlIERlbGltaXRlcilcbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC51aWQuY3JlYXRvciwgb19uZXh0LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fbmV4dCA9IG9fbmV4dC5uZXh0X2NsXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsPyAjIG1vc3QgcmlnaHQgZGVsaW1pdGVyIG9ubHkhXG4gICAgICAgICAgICAjIHNhbWUgYXMgdGhlIGFib3ZlIHdpdGggcHJldi5cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fcHJldi51aWQuY3JlYXRvciwgb19wcmV2LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fcHJldiA9IG9fcHJldi5wcmV2X2NsXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxuICAgICAgICAgIGpzb24ucHVzaCBvX2pzb25cblxuICAgIGpzb25cblxuICAjXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXG4gICMgQWNjb3JkaW5nbHkgeW91IHdpbGwgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBudW1iZXIgdGhhdCBpcyBleHBlY3RlZCBmcm9tIHRoYXQgdXNlci5cbiAgIyBUaGlzIHdpbGwgaW5jcmVtZW50IHRoZSBvcGVyYXRpb24gY291bnRlci5cbiAgI1xuICBnZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0gPSAwXG4gICAgdWlkID1cbiAgICAgICdjcmVhdG9yJyA6IHVzZXJfaWRcbiAgICAgICdvcF9udW1iZXInIDogQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG4gICAgICAnZG9TeW5jJyA6IHRydWVcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSAjIHlvdSBhbHJlYWR5IGRvIHRoaXMgaW4gdGhlIGVuZ2luZSwgc28gZGVsZXRlIGl0IGhlcmUhXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIG9wZXJhdGlvbiB3YXMgbm90IGV4cGVjdGVkIVwiXG4gICAgQGFkZFRvQ291bnRlcihvKVxuICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXSA9IG9cbiAgICBvXG5cbiAgcmVtb3ZlT3BlcmF0aW9uOiAobyktPlxuICAgIGRlbGV0ZSBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1tvLnVpZC5vcF9udW1iZXJdXG5cbiAgIyBXaGVuIHRoZSBIQiBkZXRlcm1pbmVzIGluY29uc2lzdGVuY2llcywgdGhlbiB0aGUgaW52b2tlU3luY1xuICAjIGhhbmRsZXIgd2lsIGJlIGNhbGxlZCwgd2hpY2ggc2hvdWxkIHNvbWVob3cgaW52b2tlIHRoZSBzeW5jIHdpdGggYW5vdGhlciBjb2xsYWJvcmF0b3IuXG4gICMgVGhlIHBhcmFtZXRlciBvZiB0aGUgc3luYyBoYW5kbGVyIGlzIHRoZSB1c2VyX2lkIHdpdGggd2ljaCBhbiBpbmNvbnNpc3RlbmN5IHdhcyBkZXRlcm1pbmVkXG4gIHNldEludm9rZVN5bmNIYW5kbGVyOiAoZiktPlxuICAgIEBpbnZva2VTeW5jID0gZlxuXG4gICMgZW1wdHkgcGVyIGRlZmF1bHQgIyBUT0RPOiBkbyBpIG5lZWQgdGhpcz9cbiAgaW52b2tlU3luYzogKCktPlxuXG4gICMgYWZ0ZXIgeW91IHJlY2VpdmVkIHRoZSBIQiBvZiBhbm90aGVyIHVzZXIgKGluIHRoZSBzeW5jIHByb2Nlc3MpLFxuICAjIHlvdSByZW5ldyB5b3VyIG93biBzdGF0ZV92ZWN0b3IgdG8gdGhlIHN0YXRlX3ZlY3RvciBvZiB0aGUgb3RoZXIgdXNlclxuICByZW5ld1N0YXRlVmVjdG9yOiAoc3RhdGVfdmVjdG9yKS0+XG4gICAgZm9yIHVzZXIsc3RhdGUgb2Ygc3RhdGVfdmVjdG9yXG4gICAgICBpZiAobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID0gMFxuICAgIGlmIHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8udWlkLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcbiAgICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgZWxzZVxuICAgICAgICBAaW52b2tlU3luYyBvLnVpZC5jcmVhdG9yXG5cbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSAtIChvLnVpZC5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICB0eXBlcyA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEBwcml2YXRlXG4gICMgQGFic3RyYWN0XG4gICMgQG5vZG9jXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgKiBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxuICAjICogdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuIFdlIGV4dGVuZCB0aGUgcGFyc2VyIG9iamVjdCBpbiBvcmRlciB0byBwYXJzZSBlbmNvZGVkIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3MgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcbiAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IGZhbHNlXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW10gIyBUT0RPOiByZW5hbWUgdG8gb2JzZXJ2ZXJzIG9yIHN0aCBsaWtlIHRoYXRcbiAgICAgIGlmIHVpZD9cbiAgICAgICAgQHVpZCA9IHVpZFxuXG4gICAgdHlwZTogXCJPcGVyYXRpb25cIlxuXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcInN1YiBwcm9wZXJ0aWVzIGFyZSBub3QgZW5hYmxlIG9uIHRoaXMgb3BlcmF0aW9uIHR5cGUhXCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBcbiAgICB1bm9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cbiAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYWxsIHN1YnNjcmliZWQgZXZlbnQgbGlzdGVuZXJzLlxuICAgICMgVGhpcyBzaG91bGQgYmUgY2FsbGVkLCBlLmcuIGFmdGVyIHRoaXMgaGFzIGJlZW4gcmVwbGFjZWQuXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXG4gICAgIyBUaGlzIGlzIGFsc28gY2FsbGVkIGluIHRoZSBjbGVhbnVwIG1ldGhvZC5cbiAgICBkZWxldGVBbGxPYnNlcnZlcnM6ICgpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIEBmb3J3YXJkRXZlbnQgQCwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBIQi5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IgQFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgI2NvbnNvbGUubG9nIFwiY2xlYW51cDogI3tAdHlwZX1cIlxuICAgICAgSEIucmVtb3ZlT3BlcmF0aW9uIEBcbiAgICAgIEBkZWxldGVBbGxPYnNlcnZlcnMoKVxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBAdWlkXG4gICAgICBlbHNlXG4gICAgICAgIEB1aWQuYWx0ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXG5cbiAgICBjbG9uZVVpZDogKCktPlxuICAgICAgdWlkID0ge31cbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXG4gICAgICAgIHVpZFtuXSA9IHZcbiAgICAgIHVpZFxuXG4gICAgZG9udFN5bmM6ICgpLT5cbiAgICAgIEB1aWQuZG9TeW5jID0gZmFsc2VcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJZiBub3QgYWxyZWFkeSBkb25lLCBzZXQgdGhlIHVpZFxuICAgICMgQWRkIHRoaXMgdG8gdGhlIEhCXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBAaXNfZXhlY3V0ZWQgPSB0cnVlXG4gICAgICBpZiBub3QgQHVpZD9cbiAgICAgICAgIyBXaGVuIHRoaXMgb3BlcmF0aW9uIHdhcyBjcmVhdGVkIHdpdGhvdXQgYSB1aWQsIHRoZW4gc2V0IGl0IGhlcmUuXG4gICAgICAgICMgVGhlcmUgaXMgb25seSBvbmUgb3RoZXIgcGxhY2UsIHdoZXJlIHRoaXMgY2FuIGJlIGRvbmUgLSBiZWZvcmUgYW4gSW5zZXJ0aW9uXG4gICAgICAgICMgaXMgZXhlY3V0ZWQgKGJlY2F1c2Ugd2UgbmVlZCB0aGUgY3JlYXRvcl9pZClcbiAgICAgICAgQHVpZCA9IEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBIQi5hZGRPcGVyYXRpb24gQFxuICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcbiAgICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXG4gICNcbiAgY2xhc3MgdHlwZXMuRGVsZXRlIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBkZWxldGVzKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmVzID0gc3VwZXJcbiAgICAgICAgaWYgcmVzXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICByZXNcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICB0eXBlcy5EZWxldGUucGFyc2UgPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgdGhpcyh1aWQsIGRlbGV0ZXNfdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcbiAgI1xuICBjbGFzcyB0eXBlcy5JbnNlcnQgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiwgcGFyZW50KS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgICNcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBjYWxsTGF0ZXIgPSBmYWxzZVxuICAgICAgaWYgQHBhcmVudD8gYW5kIG5vdCBAaXNEZWxldGVkKCkgYW5kIG8/ICMgbz8gOiBpZiBub3Qgbz8sIHRoZW4gdGhlIGRlbGltaXRlciBkZWxldGVkIHRoaXMgSW5zZXJ0aW9uLiBGdXJ0aGVybW9yZSwgaXQgd291bGQgYmUgd3JvbmcgdG8gY2FsbCBpdC4gVE9ETzogbWFrZSB0aGlzIG1vcmUgZXhwcmVzc2l2ZSBhbmQgc2F2ZVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgY2FsbExhdGVyID0gdHJ1ZVxuICAgICAgaWYgbz9cbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICBpZiBjYWxsTGF0ZXJcbiAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyhvKVxuICAgICAgaWYgQHByZXZfY2w/LmlzRGVsZXRlZCgpXG4gICAgICAgICMgZ2FyYmFnZSBjb2xsZWN0IHByZXZfY2xcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJyaWdodCBpcyBub3QgZGVsZXRlZC4gaW5jb25zaXN0ZW5jeSEsIHdyYXJhcmFyXCJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XG4gICAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgICB3aGlsZSBvLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxuICAgICAgICAgICAgby5vcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQG5leHRfY2xcbiAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBwcmV2X2NsXG4gICAgICAgIHN1cGVyXG4gICAgICAjIGVsc2VcbiAgICAgICMgICBTb21lb25lIGluc2VydGVkIHNvbWV0aGluZyBpbiB0aGUgbWVhbnRpbWUuXG4gICAgICAjICAgUmVtZW1iZXI6IHRoaXMgY2FuIG9ubHkgYmUgZ2FyYmFnZSBjb2xsZWN0ZWQgd2hlbiBuZXh0X2NsIGlzIGRlbGV0ZWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAcGFyZW50P1xuICAgICAgICAgIGlmIG5vdCBAcHJldl9jbD9cbiAgICAgICAgICAgIEBwcmV2X2NsID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG9yaWdpbj9cbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby51aWQuY3JlYXRvciA8IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzKClcbiAgICAgICAgQFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBAcGFyZW50Py5jYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImluc2VydFwiXG4gICAgICAgIHBvc2l0aW9uOiBAZ2V0UG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBwYXJlbnRcbiAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IEBjb250ZW50XG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBAcGFyZW50LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudCAjIFRPRE86IFlvdSBjYW4gY29tYmluZSBnZXRQb3NpdGlvbiArIGdldFBhcmVudCBpbiBhIG1vcmUgZWZmaWNpZW50IG1hbm5lciEgKG9ubHkgbGVmdCBEZWxpbWl0ZXIgd2lsbCBob2xkIEBwYXJlbnQpXG4gICAgICAgIGxlbmd0aDogMVxuICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgIF1cblxuICAgICNcbiAgICAjIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQb3NpdGlvbjogKCktPlxuICAgICAgcG9zaXRpb24gPSAwXG4gICAgICBwcmV2ID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgcHJldiBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBEZWZpbmVzIGFuIG9iamVjdCB0aGF0IGlzIGNhbm5vdCBiZSBjaGFuZ2VkLiBZb3UgY2FuIHVzZSB0aGlzIHRvIHNldCBhbiBpbW11dGFibGUgc3RyaW5nLCBvciBhIG51bWJlci5cbiAgI1xuICBjbGFzcyB0eXBlcy5JbW11dGFibGVPYmplY3QgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBjb250ZW50XG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBAY29udGVudCktPlxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkltbXV0YWJsZU9iamVjdFwiXG5cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtTdHJpbmddIFRoZSBjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICB2YWwgOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnY29udGVudCcgOiBAY29udGVudFxuICAgICAgfVxuICAgICAganNvblxuXG4gIHR5cGVzLkltbXV0YWJsZU9iamVjdC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgY29udGVudClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyB0eXBlcy5EZWxpbWl0ZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHtub09wZXJhdGlvbjogdHJ1ZX1cblxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEB1bmNoZWNrZWQ/WydwcmV2X2NsJ11cbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUHJvYmFibHkgZHVwbGljYXRlZCBvcGVyYXRpb25zXCJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIHN1cGVyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBmYWxzZVxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IG9yIEBuZXh0X2NsPyBvciB0cnVlICMgVE9ETzogYXJlIHlvdSBzdXJlPyBUaGlzIGNhbiBoYXBwZW4gcmlnaHQ/XG4gICAgICAgIHN1cGVyXG4gICAgICAjZWxzZVxuICAgICAgIyAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICB0eXBlcy5EZWxpbWl0ZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQsIHByZXYsIG5leHQpXG5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxuICB7XG4gICAgJ3R5cGVzJyA6IHR5cGVzXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJ0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0VHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICB0ZXh0X3R5cGVzID0gdGV4dF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuXG4gICNcbiAgIyBNYW5hZ2VzIE9iamVjdC1saWtlIHZhbHVlcy5cbiAgI1xuICBjbGFzcyB0eXBlcy5PYmplY3QgZXh0ZW5kcyB0eXBlcy5NYXBNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEganNvbi10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geWF0dGEudmFsKCd1bmtub3duJylcbiAgICAjICAgaWYgKHgudHlwZSA9PT0gXCJPYmplY3RcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJPYmplY3RcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuXG4gICAgI1xuICAgICMgVHJhbnNmb3JtIHRoaXMgdG8gYSBKc29uLiBJZiB5b3VyIGJyb3dzZXIgc3VwcG9ydHMgT2JqZWN0Lm9ic2VydmUgaXQgd2lsbCBiZSB0cmFuc2Zvcm1lZCBhdXRvbWF0aWNhbGx5IHdoZW4gYSBjaGFuZ2UgYXJyaXZlcy5cbiAgICAjIE90aGVyd2lzZSB5b3Ugd2lsbCBsb29zZSBhbGwgdGhlIHNoYXJpbmctYWJpbGl0aWVzICh0aGUgbmV3IG9iamVjdCB3aWxsIGJlIGEgZGVlcCBjbG9uZSkhXG4gICAgIyBAcmV0dXJuIHtKc29ufVxuICAgICNcbiAgICAjIFRPRE86IGF0IHRoZSBtb21lbnQgeW91IGRvbid0IGNvbnNpZGVyIGNoYW5naW5nIG9mIHByb3BlcnRpZXMuXG4gICAgIyBFLmcuOiBsZXQgeCA9IHthOltdfS4gVGhlbiB4LmEucHVzaCAxIHdvdWxkbid0IGNoYW5nZSBhbnl0aGluZ1xuICAgICNcbiAgICB0b0pzb246ICh0cmFuc2Zvcm1fdG9fdmFsdWUgPSBmYWxzZSktPlxuICAgICAgaWYgbm90IEBib3VuZF9qc29uPyBvciBub3QgT2JqZWN0Lm9ic2VydmU/IG9yIHRydWUgIyBUT0RPOiBjdXJyZW50bHksIHlvdSBhcmUgbm90IHdhdGNoaW5nIG11dGFibGUgc3RyaW5ncyBmb3IgY2hhbmdlcywgYW5kLCB0aGVyZWZvcmUsIHRoZSBAYm91bmRfanNvbiBpcyBub3QgdXBkYXRlZC4gVE9ETyBUT0RPICB3dWF3dWF3dWEgZWFzeVxuICAgICAgICB2YWwgPSBAdmFsKClcbiAgICAgICAganNvbiA9IHt9XG4gICAgICAgIGZvciBuYW1lLCBvIG9mIHZhbFxuICAgICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5PYmplY3RcbiAgICAgICAgICAgIGpzb25bbmFtZV0gPSBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgICAgZWxzZSBpZiB0cmFuc2Zvcm1fdG9fdmFsdWUgYW5kIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgIGpzb25bbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgQGJvdW5kX2pzb24gPSBqc29uXG4gICAgICAgIGlmIE9iamVjdC5vYnNlcnZlP1xuICAgICAgICAgIHRoYXQgPSBAXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUgQGJvdW5kX2pzb24sIChldmVudHMpLT5cbiAgICAgICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICAgICAgaWYgbm90IGV2ZW50LmNoYW5nZWRCeT8gYW5kIChldmVudC50eXBlIGlzIFwiYWRkXCIgb3IgZXZlbnQudHlwZSA9IFwidXBkYXRlXCIpXG4gICAgICAgICAgICAgICAgIyB0aGlzIGV2ZW50IGlzIG5vdCBjcmVhdGVkIGJ5IFlhdHRhLlxuICAgICAgICAgICAgICAgIHRoYXQudmFsKGV2ZW50Lm5hbWUsIGV2ZW50Lm9iamVjdFtldmVudC5uYW1lXSlcbiAgICAgICAgICBAb2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgICAgIGlmIGV2ZW50LmNyZWF0ZWRfIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgICAgICAgICAgICBub3RpZmllciA9IE9iamVjdC5nZXROb3RpZmllcih0aGF0LmJvdW5kX2pzb24pXG4gICAgICAgICAgICAgICAgb2xkVmFsID0gdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdXG4gICAgICAgICAgICAgICAgaWYgb2xkVmFsP1xuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAndXBkYXRlJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZSdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTogZXZlbnQuY2hhbmdlZEJ5XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAnYWRkJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZCdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTpldmVudC5jaGFuZ2VkQnlcbiAgICAgIEBib3VuZF9qc29uXG5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgICAjICAgQHJldHVybiBbSnNvbl1cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlfHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIG5hbWU/IGFuZCBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5jb25zdHJ1Y3Rvcj9cbiAgICAgICAgICB0eXBlID0gdHlwZXNbY29udGVudC5jb25zdHJ1Y3Rvci5uYW1lXVxuICAgICAgICAgIGlmIHR5cGU/IGFuZCB0eXBlLmNyZWF0ZT9cbiAgICAgICAgICAgIGFyZ3MgPSBbXVxuICAgICAgICAgICAgZm9yIGkgaW4gWzEuLi5hcmd1bWVudHMubGVuZ3RoXVxuICAgICAgICAgICAgICBhcmdzLnB1c2ggYXJndW1lbnRzW2ldXG4gICAgICAgICAgICBvID0gdHlwZS5jcmVhdGUuYXBwbHkgbnVsbCwgYXJnc1xuICAgICAgICAgICAgc3VwZXIgbmFtZSwgb1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoZSAje2NvbnRlbnQuY29uc3RydWN0b3IubmFtZX0tdHlwZSBpcyBub3QgKHlldCkgc3VwcG9ydGVkIGluIFlhdHRhLlwiXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzdXBlciBuYW1lLCAobmV3IHR5cGVzLkltbXV0YWJsZU9iamVjdCB1bmRlZmluZWQsIGNvbnRlbnQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZSAjIGlzIHRoaXMgZXZlbiBuZWNlc3NhcnkgPyBJIGhhdmUgdG8gZGVmaW5lIGV2ZXJ5IHR5cGUgYW55d2F5Li4gKHNlZSBOdW1iZXIgdHlwZSBiZWxvdylcbiAgICAgICAgc3VwZXIgbmFtZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgfVxuXG4gIHR5cGVzLk9iamVjdC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZClcblxuICB0eXBlcy5PYmplY3QuY3JlYXRlID0gKGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICBqc29uID0gbmV3IHR5cGVzLk9iamVjdCgpLmV4ZWN1dGUoKVxuICAgIGZvciBuLG8gb2YgY29udGVudFxuICAgICAganNvbi52YWwgbiwgbywgbXV0YWJsZVxuICAgIGpzb25cblxuXG4gIHR5cGVzLk51bWJlciA9IHt9XG4gIHR5cGVzLk51bWJlci5jcmVhdGUgPSAoY29udGVudCktPlxuICAgIChuZXcgdHlwZXMuSW1tdXRhYmxlT2JqZWN0IHVuZGVmaW5lZCwgY29udGVudCkuZXhlY3V0ZSgpXG5cbiAgdGV4dF90eXBlc1xuXG5cbiIsImJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1R5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgYmFzaWNfdHlwZXMgPSBiYXNpY190eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gYmFzaWNfdHlwZXMudHlwZXNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgdHlwZXMuTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgZm9yIG5hbWUscCBvZiBAbWFwXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uVHlwZXMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGNvbnRlbnQ/XG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBwcm9wID0gQG1hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgb2JqID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgICAgb2JqLnZhbCgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgb2JqXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICBvYmogPSBvLnZhbCgpXG4gICAgICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3QgIyBvciBvYmogaW5zdGFuY2VvZiBNYXBNYW5hZ2VyIFRPRE86IGRvIHlvdSB3YW50IGRlZXAganNvbj8gXG4gICAgICAgICAgICAgIG9iaiA9IG9iai52YWwoKVxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gb2JqXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQG1hcFtuYW1lXT8uZGVsZXRlQ29udGVudCgpXG4gICAgICBAXG5cbiAgICByZXRyaWV2ZVN1YjogKHByb3BlcnR5X25hbWUpLT5cbiAgICAgIGlmIG5vdCBAbWFwW3Byb3BlcnR5X25hbWVdP1xuICAgICAgICBldmVudF9wcm9wZXJ0aWVzID1cbiAgICAgICAgICBuYW1lOiBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIGV2ZW50X3RoaXMgPSBAXG4gICAgICAgIG1hcF91aWQgPSBAY2xvbmVVaWQoKVxuICAgICAgICBtYXBfdWlkLnN1YiA9IHByb3BlcnR5X25hbWVcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIGFsdDogbWFwX3VpZFxuICAgICAgICBybSA9IG5ldyB0eXBlcy5SZXBsYWNlTWFuYWdlciBldmVudF9wcm9wZXJ0aWVzLCBldmVudF90aGlzLCBybV91aWQgIyB0aGlzIG9wZXJhdGlvbiBzaGFsbCBub3QgYmUgc2F2ZWQgaW4gdGhlIEhCXG4gICAgICAgIEBtYXBbcHJvcGVydHlfbmFtZV0gPSBybVxuICAgICAgICBybS5zZXRQYXJlbnQgQCwgcHJvcGVydHlfbmFtZVxuICAgICAgICBybS5leGVjdXRlKClcbiAgICAgIEBtYXBbcHJvcGVydHlfbmFtZV1cblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyB0eXBlcy5MaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAYmVnaW5uaW5nID0gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgQGVuZCA9ICAgICAgIG5ldyB0eXBlcy5EZWxpbWl0ZXIgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICByZXN1bHQucHVzaCBvXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgIyBlLmcuIFwiYWJjXCIgOiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBvciBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgVGV4dFR5cGUtdHlwZSBoYXMgaW1wbGVtZW50ZWQgc3VwcG9ydCBmb3IgcmVwbGFjZVxuICAjIEBzZWUgVGV4dFR5cGVcbiAgI1xuICBjbGFzcyB0eXBlcy5SZXBsYWNlTWFuYWdlciBleHRlbmRzIHR5cGVzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoQGV2ZW50X3Byb3BlcnRpZXMsIEBldmVudF90aGlzLCB1aWQsIGJlZ2lubmluZywgZW5kKS0+XG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xuICAgICAgICBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10gPSBAZXZlbnRfdGhpc1xuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcbiAgICAjIFJlcGxhY2VhYmxlcyBhbHNvIG5vdCB0aHJvdyB0aGUgc2FtZSBldmVudHMuXG4gICAgIyBTbywgUmVwbGFjZU1hbmFnZXIgYW5kIExpc3RNYW5hZ2VyIGJvdGggaW1wbGVtZW50XG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cbiAgICAjXG4gICAgI1xuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxuICAgICAgaWYgbm90IEBpc0RlbGV0ZWQoKVxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xuICAgICAgICAgICAgZXZlbnRbbmFtZV0gPSBwcm9wXG4gICAgICAgIEBldmVudF90aGlzLmNhbGxFdmVudCBldmVudHNcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIHJlbHAgPSAobmV3IHR5cGVzLlJlcGxhY2VhYmxlIGNvbnRlbnQsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIChuZXcgdHlwZXMuRGVsZXRlIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXNcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAganNvblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZXMuXG4gICMgQHNlZSBSZXBsYWNlTWFuYWdlclxuICAjXG4gIGNsYXNzIHR5cGVzLlJlcGxhY2VhYmxlIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgaXNfZGVsZXRlZCktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiAjIFBhcmVudCBpcyBhbHJlYWR5IHNhdmVkIGJ5IFJlcGxhY2VhYmxlXG4gICAgICBAaXNfZGVsZXRlZCA9IGlzX2RlbGV0ZWRcblxuICAgIHR5cGU6IFwiUmVwbGFjZWFibGVcIlxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICByZXMgPSBzdXBlclxuICAgICAgaWYgQGNvbnRlbnQ/XG4gICAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgQGNvbnRlbnQuZGVsZXRlQWxsT2JzZXJ2ZXJzKClcbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgICBAY29udGVudC5kb250U3luYygpXG4gICAgICBAY29udGVudCA9IG51bGxcbiAgICAgIHJlc1xuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXJcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtdHlwZXMgZm9yIExpc3RNYW5hZ2VyLlxuICAgICNcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIiBhbmQgQHByZXZfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyB0aGlzIHJlcGxhY2VzIGFub3RoZXIgUmVwbGFjZWFibGVcbiAgICAgICAgaWYgbm90IEBpc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBAcHJldl9jbC5jb250ZW50XG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxuICAgICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcbiAgICAgICAgICBdXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyBUaGlzIHdvbid0IGJlIHJlY29nbml6ZWQgYnkgdGhlIHVzZXIsIGJlY2F1c2UgYW5vdGhlclxuICAgICAgICAjIGNvbmN1cnJlbnQgb3BlcmF0aW9uIGlzIHNldCBhcyB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgUk1cbiAgICAgICAgQGFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgIyBwcmV2IF9hbmRfIG5leHQgYXJlIERlbGltaXRlcnMuIFRoaXMgaXMgdGhlIGZpcnN0IGNyZWF0ZWQgUmVwbGFjZWFibGUgaW4gdGhlIFJNXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgXVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgICAgICBvbGRWYWx1ZTogQGNvbnRlbnRcbiAgICAgICAgXVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudD8uZ2V0VWlkKClcbiAgICAgICAgICAncGFyZW50JyA6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICdvcmlnaW4nIDogQG9yaWdpbi5nZXRVaWQoKVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2lzX2RlbGV0ZWQnOiBAaXNfZGVsZXRlZFxuICAgICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuUmVwbGFjZWFibGUucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnaXNfZGVsZXRlZCc6IGlzX2RlbGV0ZWRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIGlzX2RlbGV0ZWQpXG5cblxuICBiYXNpY190eXBlc1xuXG5cblxuXG5cblxuIiwic3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vU3RydWN0dXJlZFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgc3RydWN0dXJlZF90eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gc3RydWN0dXJlZF90eXBlcy5wYXJzZXJcblxuICAjXG4gICMgQG5vZG9jXG4gICMgRXh0ZW5kcyB0aGUgYmFzaWMgSW5zZXJ0IHR5cGUgdG8gYW4gb3BlcmF0aW9uIHRoYXQgaG9sZHMgYSB0ZXh0IHZhbHVlXG4gICNcbiAgY2xhc3MgdHlwZXMuVGV4dEluc2VydCBleHRlbmRzIHR5cGVzLkluc2VydFxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50IFRoZSBjb250ZW50IG9mIHRoaXMgSW5zZXJ0LXR5cGUgT3BlcmF0aW9uLiBVc3VhbGx5IHlvdSByZXN0cmljdCB0aGUgbGVuZ3RoIG9mIGNvbnRlbnQgdG8gc2l6ZSAxXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIHBhcmVudCktPlxuICAgICAgaWYgY29udGVudD8udWlkPy5jcmVhdG9yXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuICAgIHR5cGU6IFwiVGV4dEluc2VydFwiXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIgIyBubyBicmFjZXMgaW5kZWVkIVxuICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgQGNvbnRlbnQgPSBudWxsXG5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEBcbiAgICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKCkgb3Igbm90IEBjb250ZW50P1xuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ29yaWdpbic6IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgICAgICAncGFyZW50JzogQHBhcmVudC5nZXRVaWQoKVxuICAgICAgICB9XG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50XG4gICAgICBqc29uXG5cbiAgdHlwZXMuVGV4dEluc2VydC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuXG4gIGNsYXNzIHR5cGVzLkFycmF5IGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcblxuICAgIHR5cGU6IFwiQXJyYXlcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAZW5kXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgcmVzdWx0LnB1c2ggby52YWwoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIHB1c2g6IChjb250ZW50KS0+XG4gICAgICBAaW5zZXJ0QWZ0ZXIgQGVuZC5wcmV2X2NsLCBjb250ZW50XG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnQpLT5cbiAgICAgIHJpZ2h0ID0gbGVmdC5uZXh0X2NsXG4gICAgICB3aGlsZSByaWdodC5pc0RlbGV0ZWQoKVxuICAgICAgICByaWdodCA9IHJpZ2h0Lm5leHRfY2wgIyBmaW5kIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gdGhlIHJpZ2h0LCB0aGF0IGlzIG5vdCBkZWxldGVkLiBJbiB0aGUgY2FzZSB0aGF0IHBvc2l0aW9uIGlzIDAsIGl0cyB0aGUgRGVsaW1pdGVyLlxuICAgICAgbGVmdCA9IHJpZ2h0LnByZXZfY2xcbiAgICAgIGlmIGNvbnRlbnQudHlwZT9cbiAgICAgICAgKG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgICAgdG1wID0gKG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGMsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtBcnJheSBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50KS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnRcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge0FycmF5IFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdFxuICAgICNcbiAgICBkZWxldGU6IChwb3NpdGlvbiwgbGVuZ3RoKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zaXRpb24rMSkgIyBwb3NpdGlvbiAwIGluIHRoaXMgY2FzZSBpcyB0aGUgZGVsZXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlclxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgdHlwZXMuRGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgfVxuICAgICAganNvblxuXG4gIHR5cGVzLkFycmF5LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkKVxuXG4gIHR5cGVzLkFycmF5LmNyZWF0ZSA9IChjb250ZW50LCBtdXRhYmxlKS0+XG4gICAgaWYgKG11dGFibGUgaXMgXCJtdXRhYmxlXCIpXG4gICAgICBsaXN0ID0gbmV3IHR5cGVzLkFycmF5KCkuZXhlY3V0ZSgpXG4gICAgICBsaXN0Lmluc2VydCAwLCBjb250ZW50XG4gICAgICBsaXN0XG4gICAgZWxzZSBpZiAobm90IG11dGFibGU/KSBvciAobXV0YWJsZSBpcyBcImltbXV0YWJsZVwiKVxuICAgICAgKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJTcGVjaWZ5IGVpdGhlciBcXFwibXV0YWJsZVxcXCIgb3IgXFxcImltbXV0YWJsZVxcXCIhIVwiXG5cbiAgI1xuICAjIEhhbmRsZXMgYSBTdHJpbmctbGlrZSBkYXRhIHN0cnVjdHVyZXMgd2l0aCBzdXBwb3J0IGZvciBpbnNlcnQvZGVsZXRlIGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgIyBAbm90ZSBDdXJyZW50bHksIG9ubHkgVGV4dCBpcyBzdXBwb3J0ZWQhXG4gICNcbiAgY2xhc3MgdHlwZXMuU3RyaW5nIGV4dGVuZHMgdHlwZXMuQXJyYXlcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAdGV4dGZpZWxkcyA9IFtdXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElkZW50aWZpZXMgdGhpcyBjbGFzcy5cbiAgICAjIFVzZSBpdCB0byBjaGVjayB3aGV0aGVyIHRoaXMgaXMgYSB3b3JkLXR5cGUgb3Igc29tZXRoaW5nIGVsc2UuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHggPSB5YXR0YS52YWwoJ3Vua25vd24nKVxuICAgICMgICBpZiAoeC50eXBlID09PSBcIlN0cmluZ1wiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIlN0cmluZ1wiXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIHdvcmQuXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9IFRoZSBTdHJpbmctcmVwcmVzZW50YXRpb24gb2YgdGhpcyBvYmplY3QuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgYyA9IGZvciBvIGluIEB0b0FycmF5KClcbiAgICAgICAgaWYgby52YWw/XG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgXCJcIlxuICAgICAgYy5qb2luKCcnKVxuXG4gICAgI1xuICAgICMgU2FtZSBhcyBTdHJpbmcudmFsXG4gICAgIyBAc2VlIFN0cmluZy52YWxcbiAgICAjXG4gICAgdG9TdHJpbmc6ICgpLT5cbiAgICAgIEB2YWwoKVxuXG4gICAgI1xuICAgICMgQmluZCB0aGlzIFN0cmluZyB0byBhIHRleHRmaWVsZCBvciBpbnB1dCBmaWVsZC5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgdGV4dGJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGV4dGZpZWxkXCIpO1xuICAgICMgICB5YXR0YS5iaW5kKHRleHRib3gpO1xuICAgICNcbiAgICBiaW5kOiAodGV4dGZpZWxkKS0+XG4gICAgICB3b3JkID0gQFxuICAgICAgdGV4dGZpZWxkLnZhbHVlID0gQHZhbCgpXG4gICAgICBAdGV4dGZpZWxkcy5wdXNoIHRleHRmaWVsZFxuXG4gICAgICBAb2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBpZiBldmVudC50eXBlIGlzIFwiaW5zZXJ0XCJcbiAgICAgICAgICAgIG9fcG9zID0gZXZlbnQucG9zaXRpb25cbiAgICAgICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICAgICAgaWYgY3Vyc29yIDw9IG9fcG9zXG4gICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBjdXJzb3IgKz0gMVxuICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIGxlZnQsIHJpZ2h0XG4gICAgICAgICAgZWxzZSBpZiBldmVudC50eXBlIGlzIFwiZGVsZXRlXCJcbiAgICAgICAgICAgIG9fcG9zID0gZXZlbnQucG9zaXRpb25cbiAgICAgICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICAgICAgaWYgY3Vyc29yIDwgb19wb3NcbiAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGN1cnNvciAtPSAxXG4gICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICAgICAgcmlnaHQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuXG4gICAgICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuICAgICAgIyBjb25zdW1lIGFsbCB0ZXh0LWluc2VydCBjaGFuZ2VzLlxuICAgICAgdGV4dGZpZWxkLm9ua2V5cHJlc3MgPSAoZXZlbnQpLT5cbiAgICAgICAgaWYgd29yZC5pc19kZWxldGVkXG4gICAgICAgICAgIyBpZiB3b3JkIGlzIGRlbGV0ZWQsIGRvIG5vdCBkbyBhbnl0aGluZyBldmVyIGFnYWluXG4gICAgICAgICAgdGV4dGZpZWxkLm9ua2V5cHJlc3MgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgY2hhciA9IG51bGxcbiAgICAgICAgaWYgZXZlbnQua2V5P1xuICAgICAgICAgIGlmIGV2ZW50LmNoYXJDb2RlIGlzIDMyXG4gICAgICAgICAgICBjaGFyID0gXCIgXCJcbiAgICAgICAgICBlbHNlIGlmIGV2ZW50LmtleUNvZGUgaXMgMTNcbiAgICAgICAgICAgIGNoYXIgPSAnXFxuJ1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNoYXIgPSBldmVudC5rZXlcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlIGV2ZW50LmtleUNvZGVcbiAgICAgICAgaWYgY2hhci5sZW5ndGggPiAwXG4gICAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgICAgZGlmZiA9IE1hdGguYWJzKHRleHRmaWVsZC5zZWxlY3Rpb25FbmQgLSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQpXG4gICAgICAgICAgd29yZC5kZWxldGUgKHBvcyksIGRpZmZcbiAgICAgICAgICB3b3JkLmluc2VydCBwb3MsIGNoYXJcbiAgICAgICAgICBuZXdfcG9zID0gcG9zICsgY2hhci5sZW5ndGhcbiAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgdGV4dGZpZWxkLm9ucGFzdGUgPSAoZXZlbnQpLT5cbiAgICAgICAgaWYgd29yZC5pc19kZWxldGVkXG4gICAgICAgICAgIyBpZiB3b3JkIGlzIGRlbGV0ZWQsIGRvIG5vdCBkbyBhbnl0aGluZyBldmVyIGFnYWluXG4gICAgICAgICAgdGV4dGZpZWxkLm9ucGFzdGUgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgdGV4dGZpZWxkLm9uY3V0ID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbmN1dCA9IG51bGxcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgICNcbiAgICAgICMgY29uc3VtZSBkZWxldGVzLiBOb3RlIHRoYXRcbiAgICAgICMgICBjaHJvbWU6IHdvbid0IGNvbnN1bWUgZGVsZXRpb25zIG9uIGtleXByZXNzIGV2ZW50LlxuICAgICAgIyAgIGtleUNvZGUgaXMgZGVwcmVjYXRlZC4gQlVUOiBJIGRvbid0IHNlZSBhbm90aGVyIHdheS5cbiAgICAgICMgICAgIHNpbmNlIGV2ZW50LmtleSBpcyBub3QgaW1wbGVtZW50ZWQgaW4gdGhlIGN1cnJlbnQgdmVyc2lvbiBvZiBjaHJvbWUuXG4gICAgICAjICAgICBFdmVyeSBicm93c2VyIHN1cHBvcnRzIGtleUNvZGUuIExldCdzIHN0aWNrIHdpdGggaXQgZm9yIG5vdy4uXG4gICAgICAjXG4gICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbmtleWRvd24gPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgaWYgZXZlbnQuY3RybEtleT8gYW5kIGV2ZW50LmN0cmxLZXlcbiAgICAgICAgICAgICAgdmFsID0gdGV4dGZpZWxkLnZhbHVlXG4gICAgICAgICAgICAgIG5ld19wb3MgPSBwb3NcbiAgICAgICAgICAgICAgZGVsX2xlbmd0aCA9IDBcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3aGlsZSBuZXdfcG9zID4gMCBhbmQgdmFsW25ld19wb3NdIGlzbnQgXCIgXCIgYW5kIHZhbFtuZXdfcG9zXSBpc250ICdcXG4nXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlIG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgd29yZC5kZWxldGUgKHBvcy0xKSwgMVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZSBwb3MsIGRpZmZcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgMVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGpzb25cblxuICB0eXBlcy5TdHJpbmcucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQpXG5cbiAgdHlwZXMuU3RyaW5nLmNyZWF0ZSA9IChjb250ZW50LCBtdXRhYmxlKS0+XG4gICAgaWYgKG11dGFibGUgaXMgXCJtdXRhYmxlXCIpXG4gICAgICB3b3JkID0gbmV3IHR5cGVzLlN0cmluZygpLmV4ZWN1dGUoKVxuICAgICAgd29yZC5pbnNlcnQgMCwgY29udGVudFxuICAgICAgd29yZFxuICAgIGVsc2UgaWYgKG5vdCBtdXRhYmxlPykgb3IgKG11dGFibGUgaXMgXCJpbW11dGFibGVcIilcbiAgICAgIChuZXcgdHlwZXMuSW1tdXRhYmxlT2JqZWN0IHVuZGVmaW5lZCwgY29udGVudCkuZXhlY3V0ZSgpXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiU3BlY2lmeSBlaXRoZXIgXFxcIm11dGFibGVcXFwiIG9yIFxcXCJpbW11dGFibGVcXFwiISFcIlxuXG5cbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuWWF0dGEgPSByZXF1aXJlICcuL3lhdHRhJ1xuXG5iaW5kVG9DaGlsZHJlbiA9ICh0aGF0KS0+XG4gIGZvciBpIGluIFswLi4udGhhdC5jaGlsZHJlbi5sZW5ndGhdXG4gICAgYXR0ciA9IHRoYXQuY2hpbGRyZW4uaXRlbShpKVxuICAgIGlmIGF0dHIubmFtZT9cbiAgICAgIGF0dHIudmFsID0gdGhhdC52YWwudmFsKGF0dHIubmFtZSlcbiAgdGhhdC52YWwub2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgaWYgZXZlbnQubmFtZT9cbiAgICAgICAgZm9yIGkgaW4gWzAuLi50aGF0LmNoaWxkcmVuLmxlbmd0aF1cbiAgICAgICAgICBhdHRyID0gdGhhdC5jaGlsZHJlbi5pdGVtKGkpXG4gICAgICAgICAgaWYgYXR0ci5uYW1lPyBhbmQgYXR0ci5uYW1lIGlzIGV2ZW50Lm5hbWVcbiAgICAgICAgICAgIG5ld1ZhbCA9IHRoYXQudmFsLnZhbChhdHRyLm5hbWUpXG4gICAgICAgICAgICBpZiBhdHRyLnZhbCBpc250IG5ld1ZhbFxuICAgICAgICAgICAgICBhdHRyLnZhbCA9IG5ld1ZhbFxuXG5Qb2x5bWVyIFwieWF0dGEtZWxlbWVudFwiLFxuICByZWFkeTogKCktPlxuICAgIGlmIEBjb25uZWN0b3I/XG4gICAgICBAdmFsID0gbmV3IFlhdHRhIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcbiAgICBlbHNlIGlmIEB2YWw/XG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgdmFsQ2hhbmdlZDogKCktPlxuICAgIGlmIEB2YWw/IGFuZCBAdmFsLnR5cGUgaXMgXCJKc29uVHlwZVwiXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgY29ubmVjdG9yQ2hhbmdlZDogKCktPlxuICAgIGlmIChub3QgQHZhbD8pXG4gICAgICBAdmFsID0gbmV3IFlhdHRhIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuUG9seW1lciBcInlhdHRhLXByb3BlcnR5XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEBuYW1lP1xuICAgICAgaWYgQHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgQHZhbCA9IEBwYXJlbnRFbGVtZW50LnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgdHlwZW9mIEB2YWwgaXMgXCJzdHJpbmdcIlxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwoQG5hbWUsQHZhbClcbiAgICAgIGlmIEB2YWwudHlwZSBpcyBcIkpzb25UeXBlXCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsLnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgQHZhbC50eXBlIGlzIFwiSnNvblR5cGVcIlxuICAgICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgICBlbHNlIGlmIEBwYXJlbnRFbGVtZW50LnZhbD8udmFsPyBhbmQgQHZhbCBpc250IEBwYXJlbnRFbGVtZW50LnZhbC52YWwoQG5hbWUpXG4gICAgICAgIEBwYXJlbnRFbGVtZW50LnZhbC52YWwgQG5hbWUsIEB2YWxcblxuXG4iLCJcbmpzb25fdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1R5cGVzL0pzb25UeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4vSGlzdG9yeUJ1ZmZlclwiXG5FbmdpbmUgPSByZXF1aXJlIFwiLi9FbmdpbmVcIlxuYWRhcHRDb25uZWN0b3IgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JBZGFwdGVyXCJcblxuY3JlYXRlWWF0dGEgPSAoY29ubmVjdG9yKS0+XG4gIHVzZXJfaWQgPSBudWxsXG4gIGlmIGNvbm5lY3Rvci5pZD9cbiAgICB1c2VyX2lkID0gY29ubmVjdG9yLmlkICMgVE9ETzogY2hhbmdlIHRvIGdldFVuaXF1ZUlkKClcbiAgZWxzZVxuICAgIHVzZXJfaWQgPSBcIl90ZW1wXCJcbiAgICBjb25uZWN0b3Iud2hlblVzZXJJZFNldCAoaWQpLT5cbiAgICAgIHVzZXJfaWQgPSBpZFxuICAgICAgSEIucmVzZXRVc2VySWQgaWRcbiAgSEIgPSBuZXcgSGlzdG9yeUJ1ZmZlciB1c2VyX2lkXG4gIHR5cGVfbWFuYWdlciA9IGpzb25fdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHR5cGVfbWFuYWdlci50eXBlc1xuXG4gICNcbiAgIyBGcmFtZXdvcmsgZm9yIEpzb24gZGF0YS1zdHJ1Y3R1cmVzLlxuICAjIEtub3duIHZhbHVlcyB0aGF0IGFyZSBzdXBwb3J0ZWQ6XG4gICMgKiBTdHJpbmdcbiAgIyAqIEludGVnZXJcbiAgIyAqIEFycmF5XG4gICNcbiAgY2xhc3MgWWF0dGEgZXh0ZW5kcyB0eXBlcy5PYmplY3RcblxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXF1ZSBpZCBvZiB0aGUgcGVlci5cbiAgICAjIEBwYXJhbSB7Q29ubmVjdG9yfSBDb25uZWN0b3IgdGhlIGNvbm5lY3RvciBjbGFzcy5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3IgPSBjb25uZWN0b3JcbiAgICAgIEBIQiA9IEhCXG4gICAgICBAdHlwZXMgPSB0eXBlc1xuICAgICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0eXBlX21hbmFnZXIudHlwZXNcbiAgICAgIGFkYXB0Q29ubmVjdG9yIEBjb25uZWN0b3IsIEBlbmdpbmUsIEBIQiwgdHlwZV9tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgc3VwZXJcblxuICAgIGdldENvbm5lY3RvcjogKCktPlxuICAgICAgQGNvbm5lY3RvclxuXG4gIHJldHVybiBuZXcgWWF0dGEoSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlhdHRhXG5pZiB3aW5kb3c/IGFuZCBub3Qgd2luZG93LllhdHRhP1xuICB3aW5kb3cuWWF0dGEgPSBjcmVhdGVZYXR0YVxuIl19
