(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var adaptConnector;

adaptConnector = function(connector, engine, HB, execution_listener) {
  var applyHB, encode_state_vector, getHB, getStateVector, parse_state_vector, send_;
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
  getStateVector = function() {
    return encode_state_vector(HB.getOperationCounter());
  };
  getHB = function(v) {
    var hb, json, o, state_vector, _i, _len;
    state_vector = parse_state_vector(v);
    hb = HB._encode(state_vector);
    for (_i = 0, _len = hb.length; _i < _len; _i++) {
      o = hb[_i];
      o.fromHB = "true";
    }
    json = {
      hb: hb,
      state_vector: encode_state_vector(HB.getOperationCounter())
    };
    return json;
  };
  applyHB = function(hb) {
    return engine.applyOp(hb);
  };
  connector.getStateVector = getStateVector;
  connector.getHB = getHB;
  connector.applyHB = applyHB;
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
      if (op_json.fromHB != null) {
        o.fromHB = op_json.fromHB;
      }
      if (this.HB.getOperation(o) != null) {

      } else if (((!this.HB.isExpectedOperation(o)) && (o.fromHB == null)) || (!o.execute())) {
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

        } else if ((!this.HB.isExpectedOperation(op) && (op.fromHB == null)) || (!op.execute())) {
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
    this.garbageCollectTimeout = 30000;
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
    o.uid.op_number <= this.operation_counter[o.uid.creator];
    return true;
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
    if ((o.uid.op_number.constructor !== String) && (!this.isExpectedOperation(o)) && (o.fromHB == null)) {
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

    Operation.prototype["delete"] = function() {
      (new types.Delete(void 0, this)).execute();
      return null;
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
          } else if (o instanceof types.Array) {
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
          return Object.__super__.val.call(this, name, content);
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
    return content;
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
      var o, prop, result, _ref;
      if (arguments.length > 1) {
        this.retrieveSub(name).replace(content);
        return this;
      } else if (name != null) {
        prop = this.map[name];
        if ((prop != null) && !prop.isContentDeleted()) {
          return prop.val();
        } else {
          return void 0;
        }
      } else {
        result = {};
        _ref = this.map;
        for (name in _ref) {
          o = _ref[name];
          if (!o.isContentDeleted()) {
            result[name] = o.val();
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
      if ((content != null) && (content.creator != null)) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      this.saveOperation('parent', parent);
      Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
      this.is_deleted = is_deleted;
    }

    Replaceable.prototype.type = "Replaceable";

    Replaceable.prototype.val = function() {
      return this.content;
    };

    Replaceable.prototype.applyDelete = function() {
      var res, _base, _base1, _base2;
      res = Replaceable.__super__.applyDelete.apply(this, arguments);
      if (this.content != null) {
        if (this.next_cl.type !== "Delimiter") {
          if (typeof (_base = this.content).deleteAllObservers === "function") {
            _base.deleteAllObservers();
          }
        }
        if (typeof (_base1 = this.content).applyDelete === "function") {
          _base1.applyDelete();
        }
        if (typeof (_base2 = this.content).dontSync === "function") {
          _base2.dontSync();
        }
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
      var json;
      json = {
        'type': this.type,
        'parent': this.parent.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'origin': this.origin.getUid(),
        'uid': this.getUid(),
        'is_deleted': this.is_deleted
      };
      if (this.content instanceof types.Operation) {
        json['content'] = this.content.getUid();
      } else {
        if ((this.content != null) && (this.content.creator != null)) {
          throw new Error("You must not set creator here!");
        }
        json['content'] = this.content;
      }
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
      if (content != null ? content.creator : void 0) {
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

    Array.prototype.toJson = function(transform_to_value) {
      var i, o, val, _i, _len, _results;
      if (transform_to_value == null) {
        transform_to_value = false;
      }
      val = this.val();
      _results = [];
      for (o = _i = 0, _len = val.length; _i < _len; o = ++_i) {
        i = val[o];
        if (o instanceof types.Object) {
          _results.push(o.toJson(transform_to_value));
        } else if (o instanceof types.Array) {
          _results.push(o.toJson(transform_to_value));
        } else if (transform_to_value && o instanceof types.Operation) {
          _results.push(o.val());
        } else {
          _results.push(o);
        }
      }
      return _results;
    };

    Array.prototype.val = function(pos) {
      var o, result;
      if (pos != null) {
        o = this.getOperationByPosition(pos + 1);
        if (!(o instanceof types.Delimiter)) {
          return o.val();
        } else {
          throw new Error("this position does not exist");
        }
      } else {
        o = this.beginning.next_cl;
        result = [];
        while (o !== this.end) {
          if (!o.isDeleted()) {
            result.push(o.val());
          }
          o = o.next_cl;
        }
        return result;
      }
    };

    Array.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, content);
    };

    Array.prototype.insertAfter = function(left, content, options) {
      var c, createContent, right, tmp, _i, _len;
      createContent = function(content, options) {
        var type;
        if ((content != null) && (content.constructor != null)) {
          type = types[content.constructor.name];
          if ((type != null) && (type.create != null)) {
            return type.create(content, options);
          } else {
            throw new Error("The " + content.constructor.name + "-type is not (yet) supported in Yatta.");
          }
        } else {
          return content;
        }
      };
      right = left.next_cl;
      while (right.isDeleted()) {
        right = right.next_cl;
      }
      left = right.prev_cl;
      if (content instanceof types.Operation) {
        (new types.TextInsert(content, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = content.length; _i < _len; _i++) {
          c = content[_i];
          tmp = (new types.TextInsert(createContent(c, options), void 0, left, right)).execute();
          left = tmp;
        }
      }
      return this;
    };

    Array.prototype.insert = function(position, content, options) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, [content], options);
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
        while ((!(o instanceof types.Delimiter)) && o.isDeleted()) {
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
    var ith, list;
    if (mutable === "mutable") {
      list = new types.Array().execute();
      ith = list.getOperationByPosition(0);
      list.insertAfter(ith, content);
      return list;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return content;
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

    String.prototype.insert = function(position, content, options) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, content, options);
    };

    String.prototype.bind = function(textfield, dom_root) {
      var createRange, creator_token, t, word, writeContent, writeRange, _i, _len, _ref;
      if (dom_root == null) {
        dom_root = window;
      }
      if (dom_root.getSelection == null) {
        dom_root = window;
      }
      _ref = this.textfields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        t = _ref[_i];
        if (t === textfield) {
          return;
        }
      }
      creator_token = false;
      word = this;
      textfield.value = this.val();
      this.textfields.push(textfield);
      if ((textfield.selectionStart != null) && (textfield.setSelectionRange != null)) {
        createRange = function(fix) {
          var left, right;
          left = textfield.selectionStart;
          right = textfield.selectionEnd;
          if (fix != null) {
            left = fix(left);
            right = fix(right);
          }
          return {
            left: left,
            right: right
          };
        };
        writeRange = function(range) {
          writeContent(word.val());
          return textfield.setSelectionRange(range.left, range.right);
        };
        writeContent = function(content) {
          return textfield.value = content;
        };
      } else {
        createRange = function(fix) {
          var clength, left, right, s;
          s = dom_root.getSelection();
          clength = textfield.textContent.length;
          left = Math.min(s.anchorOffset, clength);
          right = Math.min(s.focusOffset, clength);
          if (fix != null) {
            left = fix(left);
            right = fix(right);
          }
          return {
            left: left,
            right: right,
            isReal: true
          };
        };
        writeRange = function(range) {
          var r, s, textnode;
          writeContent(word.val());
          textnode = textfield.childNodes[0];
          if (range.isReal && (textnode != null)) {
            if (range.left < 0) {
              range.left = 0;
            }
            range.right = Math.max(range.left, range.right);
            if (range.right > textnode.length) {
              range.right = textnode.length;
            }
            range.left = Math.min(range.left, range.right);
            r = document.createRange();
            r.setStart(textnode, range.left);
            r.setEnd(textnode, range.right);
            s = window.getSelection();
            s.removeAllRanges();
            return s.addRange(r);
          }
        };
        writeContent = function(content) {
          var append;
          append = "";
          if (content[content.length - 1] === " ") {
            content = content.slice(0, content.length - 1);
            append = '&nbsp;';
          }
          textfield.textContent = content;
          return textfield.innerHTML += append;
        };
      }
      writeContent(this.val());
      this.observe(function(events) {
        var event, fix, o_pos, r, _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = events.length; _j < _len1; _j++) {
          event = events[_j];
          if (!creator_token) {
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
              r = createRange(fix);
              _results.push(writeRange(r));
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
              r = createRange(fix);
              _results.push(writeRange(r));
            } else {
              _results.push(void 0);
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
      textfield.onkeypress = function(event) {
        var char, diff, pos, r;
        if (word.is_deleted) {
          textfield.onkeypress = null;
          return true;
        }
        creator_token = true;
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
          char = window.String.fromCharCode(event.keyCode);
        }
        if (char.length > 1) {
          return true;
        } else if (char.length > 0) {
          r = createRange();
          pos = Math.min(r.left, r.right);
          diff = Math.abs(r.right - r.left);
          word["delete"](pos, diff);
          word.insert(pos, char);
          r.left = pos + char.length;
          r.right = r.left;
          writeRange(r);
        }
        event.preventDefault();
        creator_token = false;
        return false;
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
        var del_length, diff, new_pos, pos, r, val;
        creator_token = true;
        if (word.is_deleted) {
          textfield.onkeydown = null;
          return true;
        }
        r = createRange();
        pos = Math.min(r.left, r.right, word.val().length);
        diff = Math.abs(r.left - r.right);
        if ((event.keyCode != null) && event.keyCode === 8) {
          if (diff > 0) {
            word["delete"](pos, diff);
            r.left = pos;
            r.right = pos;
            writeRange(r);
          } else {
            if ((event.ctrlKey != null) && event.ctrlKey) {
              val = word.val();
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
              r.left = new_pos;
              r.right = new_pos;
              writeRange(r);
            } else {
              if (pos > 0) {
                word["delete"](pos - 1, 1);
                r.left = pos - 1;
                r.right = pos - 1;
                writeRange(r);
              }
            }
          }
          event.preventDefault();
          creator_token = false;
          return false;
        } else if ((event.keyCode != null) && event.keyCode === 46) {
          if (diff > 0) {
            word["delete"](pos, diff);
            r.left = pos;
            r.right = pos;
            writeRange(r);
          } else {
            word["delete"](pos, 1);
            r.left = pos;
            r.right = pos;
            writeRange(r);
          }
          event.preventDefault();
          creator_token = false;
          return false;
        } else {
          creator_token = false;
          return true;
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
      return content;
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  return structured_types;
};


},{"./StructuredTypes":6}],8:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL0Nvbm5lY3RvckFkYXB0ZXIuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9saWIvVHlwZXMvQmFzaWNUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL0pzb25UeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1N0cnVjdHVyZWRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1RleHRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL3lhdHRhLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ09BLElBQUEsY0FBQTs7QUFBQSxjQUFBLEdBQWlCLFNBQUMsU0FBRCxFQUFZLE1BQVosRUFBb0IsRUFBcEIsRUFBd0Isa0JBQXhCLEdBQUE7QUFDZixNQUFBLDhFQUFBO0FBQUEsRUFBQSxLQUFBLEdBQVEsU0FBQyxDQUFELEdBQUE7QUFDTixJQUFBLElBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEtBQWlCLEVBQUUsQ0FBQyxTQUFILENBQUEsQ0FBakIsSUFBb0MsQ0FBQyxNQUFBLENBQUEsQ0FBUSxDQUFDLEdBQUcsQ0FBQyxTQUFiLEtBQTRCLFFBQTdCLENBQXZDO2FBQ0UsU0FBUyxDQUFD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R0EsSUFBQyxDQUFBLE1BQUQsR0FBYyxJQUFBLE1BQUEsQ0FBTyxJQUFDLENBQUEsRUFBUixFQUFZLFlBQVksQ0FBQyxLQUF6QixDQUhkLENBQUE7QUFBQSxNQUlBLGNBQUEsQ0FBZSxJQUFDLENBQUEsU0FBaEIsRUFBMkIsSUFBQyxDQUFBLE1BQTVCLEVBQW9DLElBQUMsQ0FBQSxFQUFyQyxFQUF5QyxZQUFZLENBQUMsa0JBQXRELENBSkEsQ0FBQTtBQUFBLE1BS0Esd0NBQUEsU0FBQSxDQUxBLENBRFc7SUFBQSxDQUFiOztBQUFBLG9CQVFBLFlBQUEsR0FBYyxTQUFBLEdBQUE7YUFDWixJQUFDLENBQUEsVUFEVztJQUFBLENBUmQsQ0FBQTs7aUJBQUE7O0tBTmtCLEtBQUssQ0FBQyxPQW5CMUIsQ0FBQTtBQW9DQSxTQUFXLElBQUEsS0FBQSxDQUFNLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQU4sQ0FBdUMsQ0FBQyxPQUF4QyxDQUFBLENBQVgsQ0FyQ1k7QUFBQSxDQUxkLENBQUE7O0FBQUEsTUE0Q00sQ0FBQyxPQUFQLEdBQWlCLFdBNUNqQixDQUFBOztBQTZDQSxJQUFHLGtEQUFBLElBQWdCLHNCQUFuQjtBQUNFLEVBQUEsTUFBTSxDQUFDLEtBQVAsR0FBZSxXQUFmLENBREY7Q0E3Q0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5cbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXG5cbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XG4gICAgICB1c2VyOiBuYW1lXG4gICAgICBzdGF0ZTogdmFsdWVcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxuICAgIGZvciBzIGluIHZcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxuICAgIHN0YXRlX3ZlY3RvclxuXG4gIGdldFN0YXRlVmVjdG9yID0gKCktPlxuICAgIGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG5cbiAgZ2V0SEIgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHBhcnNlX3N0YXRlX3ZlY3RvciB2XG4gICAgaGIgPSBIQi5fZW5jb2RlIHN0YXRlX3ZlY3RvclxuICAgIGZvciBvIGluIGhiXG4gICAgICBvLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseVxuICAgIGpzb24gPVxuICAgICAgaGI6IGhiXG4gICAgICBzdGF0ZV92ZWN0b3I6IGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG4gICAganNvblxuXG4gIGFwcGx5SEIgPSAoaGIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYlxuXG4gIGNvbm5lY3Rvci5nZXRTdGF0ZVZlY3RvciA9IGdldFN0YXRlVmVjdG9yXG4gIGNvbm5lY3Rvci5nZXRIQiA9IGdldEhCXG4gIGNvbm5lY3Rvci5hcHBseUhCID0gYXBwbHlIQlxuXG4gIGNvbm5lY3Rvci53aGVuUmVjZWl2aW5nIChzZW5kZXIsIG9wKS0+XG4gICAgaWYgb3AudWlkLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgZW5naW5lLmFwcGx5T3Agb3BcblxuICBpZiBjb25uZWN0b3IuX3doZW5Cb3VuZFRvWWF0dGE/XG4gICAgY29ubmVjdG9yLl93aGVuQm91bmRUb1lhdHRhKClcblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvciIsIlxud2luZG93Py51bnByb2Nlc3NlZF9jb3VudGVyID0gMCAjIGRlbCB0aGlzXG53aW5kb3c/LnVucHJvY2Vzc2VkX2V4ZWNfY291bnRlciA9IDAgIyBUT0RPXG53aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzID0gW11cblxuI1xuIyBAbm9kb2NcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cbiNcbmNsYXNzIEVuZ2luZVxuXG4gICNcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICMgQHBhcmFtIHtPYmplY3R9IHR5cGVzIGxpc3Qgb2YgYXZhaWxhYmxlIHR5cGVzXG4gICNcbiAgY29uc3RydWN0b3I6IChASEIsIEB0eXBlcyktPlxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxuXG4gICNcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cbiAgI1xuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cbiAgICB0eXBlID0gQHR5cGVzW2pzb24udHlwZV1cbiAgICBpZiB0eXBlPy5wYXJzZT9cbiAgICAgIHR5cGUucGFyc2UganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcblxuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxuICAjIEBub3RlIFlvdSBtdXN0IG5vdCB1c2UgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYWxyZWFkeSBoYXZlIG9wcyBpbiB5b3VyIEhCIVxuICAjIyNcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxuICAgIG9wcyA9IFtdXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXG4gICAgZm9yIG8gaW4gb3BzXG4gICAgICBpZiBub3Qgby5leGVjdXRlKClcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuICAjIyNcblxuICAjXG4gICMgU2FtZSBhcyBhcHBseU9wcyBidXQgb3BlcmF0aW9ucyB0aGF0IGFyZSBhbHJlYWR5IGluIHRoZSBIQiBhcmUgbm90IGFwcGxpZWQuXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcbiAgI1xuICBhcHBseU9wc0NoZWNrRG91YmxlOiAob3BzX2pzb24pLT5cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xuICAgICAgICBAYXBwbHlPcCBvXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIChIZWxwZXIgZm9yIHVzaW5nIGFwcGx5T3Agb24gQXJyYXlzKVxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxuICAgIEBhcHBseU9wIG9wc19qc29uXG5cbiAgI1xuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cbiAgIyBUT0RPOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhIVxuICAjIC0gb3BlcmF0aW9ucyBtYXkgb25seSBleGVjdXRlZCBpbiBvcmRlciBieSBjcmVhdG9yLCBvcmRlciB0aGVtIGluIG9iamVjdCBvZiBhcnJheXMgKGtleSBieSBjcmVhdG9yKVxuICAjIC0geW91IGNhbiBwcm9iYWJseSBtYWtlIHNvbWV0aGluZyBsaWtlIGRlcGVuZGVuY2llcyAoY3JlYXRvcjEgd2FpdHMgZm9yIGNyZWF0b3IyKVxuICBhcHBseU9wOiAob3BfanNvbl9hcnJheSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBvLnVpZC5jcmVhdG9yID0gaWRcbiAgICAgIGlmIEBidWZmZXJbaWRdP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgYXJlIHJlLWFzc2lnbmluZyBhbiBvbGQgdXNlciBpZCAtIHRoaXMgaXMgbm90ICh5ZXQpIHBvc3NpYmxlIVwiXG4gICAgICBAYnVmZmVyW2lkXSA9IG93blxuICAgICAgZGVsZXRlIEBidWZmZXJbQHVzZXJfaWRdXG5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxuICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgICBkb1N5bmM6IGZhbHNlXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiBvLnVpZC5kb1N5bmMgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICAjIGl0cyBuZWNlc3NhcnkgdG8gc2VuZCBpdCwgYW5kIG5vdCBrbm93biBpbiBzdGF0ZV92ZWN0b3JcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD8gIyBhcHBsaWVzIGZvciBhbGwgb3BzIGJ1dCB0aGUgbW9zdCByaWdodCBkZWxpbWl0ZXIhXG4gICAgICAgICAgICAjIHNlYXJjaCBmb3IgdGhlIG5leHQgX2tub3duXyBvcGVyYXRpb24uIChXaGVuIHN0YXRlX3ZlY3RvciBpcyB7fSB0aGVuIHRoaXMgaXMgdGhlIERlbGltaXRlcilcbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC51aWQuY3JlYXRvciwgb19uZXh0LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fbmV4dCA9IG9fbmV4dC5uZXh0X2NsXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsPyAjIG1vc3QgcmlnaHQgZGVsaW1pdGVyIG9ubHkhXG4gICAgICAgICAgICAjIHNhbWUgYXMgdGhlIGFib3ZlIHdpdGggcHJldi5cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fcHJldi51aWQuY3JlYXRvciwgb19wcmV2LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fcHJldiA9IG9fcHJldi5wcmV2X2NsXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxuICAgICAgICAgIGpzb24ucHVzaCBvX2pzb25cblxuICAgIGpzb25cblxuICAjXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXG4gICMgQWNjb3JkaW5nbHkgeW91IHdpbGwgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBudW1iZXIgdGhhdCBpcyBleHBlY3RlZCBmcm9tIHRoYXQgdXNlci5cbiAgIyBUaGlzIHdpbGwgaW5jcmVtZW50IHRoZSBvcGVyYXRpb24gY291bnRlci5cbiAgI1xuICBnZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0gPSAwXG4gICAgdWlkID1cbiAgICAgICdjcmVhdG9yJyA6IHVzZXJfaWRcbiAgICAgICdvcF9udW1iZXInIDogQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG4gICAgICAnZG9TeW5jJyA6IHRydWVcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pICMgeW91IGFscmVhZHkgZG8gdGhpcyBpbiB0aGUgZW5naW5lLCBzbyBkZWxldGUgaXQgaGVyZSFcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcbiAgICBAYWRkVG9Db3VudGVyKG8pXG4gICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cblxuICAjIFdoZW4gdGhlIEhCIGRldGVybWluZXMgaW5jb25zaXN0ZW5jaWVzLCB0aGVuIHRoZSBpbnZva2VTeW5jXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcbiAgc2V0SW52b2tlU3luY0hhbmRsZXI6IChmKS0+XG4gICAgQGludm9rZVN5bmMgPSBmXG5cbiAgIyBlbXB0eSBwZXIgZGVmYXVsdCAjIFRPRE86IGRvIGkgbmVlZCB0aGlzP1xuICBpbnZva2VTeW5jOiAoKS0+XG5cbiAgIyBhZnRlciB5b3UgcmVjZWl2ZWQgdGhlIEhCIG9mIGFub3RoZXIgdXNlciAoaW4gdGhlIHN5bmMgcHJvY2VzcyksXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cbiAgICBmb3IgdXNlcixzdGF0ZSBvZiBzdGF0ZV92ZWN0b3JcbiAgICAgIGlmIChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSlcbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdID0gc3RhdGVfdmVjdG9yW3VzZXJdXG5cbiAgI1xuICAjIEluY3JlbWVudCB0aGUgb3BlcmF0aW9uX2NvdW50ZXIgdGhhdCBkZWZpbmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBFbmdpbmUuXG4gICNcbiAgYWRkVG9Db3VudGVyOiAobyktPlxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPSAwXG4gICAgaWYgdHlwZW9mIG8udWlkLm9wX251bWJlciBpcyAnbnVtYmVyJyBhbmQgby51aWQuY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxuICAgICAgIyBUT0RPOiBjaGVjayBpZiBvcGVyYXRpb25zIGFyZSBzZW5kIGluIG9yZGVyXG4gICAgICBpZiBvLnVpZC5vcF9udW1iZXIgaXMgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgICBlbHNlXG4gICAgICAgIEBpbnZva2VTeW5jIG8udWlkLmNyZWF0b3JcblxuICAgICNpZiBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gaXNudCAoby51aWQub3BfbnVtYmVyICsgMSlcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIC0gKG8udWlkLm9wX251bWJlciArIDEpKVxuICAgICAgI2NvbnNvbGUubG9nIG9cbiAgICAgICN0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZG9uJ3QgcmVjZWl2ZSBvcGVyYXRpb25zIGluIHRoZSBwcm9wZXIgb3JkZXIuIFRyeSBjb3VudGluZyBsaWtlIHRoaXMgMCwxLDIsMyw0LC4uIDspXCJcblxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICAjIEBzZWUgRW5naW5lLnBhcnNlXG4gIHR5cGVzID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wZXJhdGlvbnMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyAqIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXSAjIFRPRE86IHJlbmFtZSB0byBvYnNlcnZlcnMgb3Igc3RoIGxpa2UgdGhhdFxuICAgICAgaWYgdWlkP1xuICAgICAgICBAdWlkID0gdWlkXG5cbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXG5cbiAgICByZXRyaWV2ZVN1YjogKCktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzLnB1c2ggZlxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBmdW5jdGlvbiBmcm9tIHRoZSBvYnNlcnZlciBsaXN0XG4gICAgIyBAc2VlIE9wZXJhdGlvbi5vYnNlcnZlXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHVub2JzZXJ2ZShldmVudCwgZilcbiAgICAjICAgQHBhcmFtIGYgICAgIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRoYXQgeW91IHdhbnQgdG8gZGVsZXRlIFxuICAgIHVub2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBAZXZlbnRfbGlzdGVuZXJzLmZpbHRlciAoZyktPlxuICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgIyBUaGlzIHNob3VsZCBiZSBjYWxsZWQsIGUuZy4gYWZ0ZXIgdGhpcyBoYXMgYmVlbiByZXBsYWNlZC5cbiAgICAjIChUaGVuIG9ubHkgb25lIHJlcGxhY2UgZXZlbnQgc2hvdWxkIGZpcmUuIClcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxuICAgIGRlbGV0ZUFsbE9ic2VydmVyczogKCktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdXG5cbiAgICBkZWxldGU6ICgpLT5cbiAgICAgIChuZXcgdHlwZXMuRGVsZXRlIHVuZGVmaW5lZCwgQCkuZXhlY3V0ZSgpXG4gICAgICBudWxsXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCBjYWxsRXZlbnQrZm9yd2FyZEV2ZW50PyBPbmx5IG9uZSBzdWZmaWNlcyBwcm9iYWJseVxuICAgIGNhbGxFdmVudDogKCktPlxuICAgICAgQGZvcndhcmRFdmVudCBALCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQgYW5kIHNwZWNpZnkgaW4gd2hpY2ggY29udGV4dCB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkIChzZXQgJ3RoaXMnKS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIHRoaXMgP1xuICAgIGZvcndhcmRFdmVudDogKG9wLCBhcmdzLi4uKS0+XG4gICAgICBmb3IgZiBpbiBAZXZlbnRfbGlzdGVuZXJzXG4gICAgICAgIGYuY2FsbCBvcCwgYXJncy4uLlxuXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBAaXNfZGVsZXRlZFxuXG4gICAgYXBwbHlEZWxldGU6IChnYXJiYWdlY29sbGVjdCA9IHRydWUpLT5cbiAgICAgIGlmIG5vdCBAZ2FyYmFnZV9jb2xsZWN0ZWRcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcbiAgICAgICAgQGlzX2RlbGV0ZWQgPSB0cnVlXG4gICAgICAgIGlmIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxuICAgICAgICAgIEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXG4gICAgICBIQi5yZW1vdmVPcGVyYXRpb24gQFxuICAgICAgQGRlbGV0ZUFsbE9ic2VydmVycygpXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEB1aWRcbiAgICAgIGVsc2VcbiAgICAgICAgQHVpZC5hbHQgIyBjb3VsZCBiZSAoc2FmZWx5KSB1bmRlZmluZWRcblxuICAgIGNsb25lVWlkOiAoKS0+XG4gICAgICB1aWQgPSB7fVxuICAgICAgZm9yIG4sdiBvZiBAZ2V0VWlkKClcbiAgICAgICAgdWlkW25dID0gdlxuICAgICAgdWlkXG5cbiAgICBkb250U3luYzogKCktPlxuICAgICAgQHVpZC5kb1N5bmMgPSBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAjIFdoZW4gdGhpcyBvcGVyYXRpb24gd2FzIGNyZWF0ZWQgd2l0aG91dCBhIHVpZCwgdGhlbiBzZXQgaXQgaGVyZS5cbiAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICBAdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEhCLmFkZE9wZXJhdGlvbiBAXG4gICAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgb3A/LmV4ZWN1dGU/XG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyB0eXBlcy5EZWxldGUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIHR5cGVzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyB0aGlzKHVpZCwgZGVsZXRlc191aWQpXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIHR5cGVzLkluc2VydCBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luLCBwYXJlbnQpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc0RlbGV0ZWQoKSBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIGNhbGxMYXRlclxuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzKG8pXG4gICAgICBpZiBAcHJldl9jbD8uaXNEZWxldGVkKClcbiAgICAgICAgIyBnYXJiYWdlIGNvbGxlY3QgcHJldl9jbFxuICAgICAgICBAcHJldl9jbC5hcHBseURlbGV0ZSgpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInJpZ2h0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGNoYW5nZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcbiAgICAgICAgc3VwZXJcbiAgICAgICMgZWxzZVxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwYXJlbnQuYmVnaW5uaW5nXG4gICAgICAgICAgaWYgbm90IEBuZXh0X2NsP1xuICAgICAgICAgICAgQG5leHRfY2wgPSBAcGFyZW50LmVuZFxuICAgICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IGRpc3RhbmNlX3RvX29yaWdpbiAjIGxvb3AgY291bnRlclxuXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcbiAgICAgICAgICAjICAgICAgICAgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIDwgQHVpZC5jcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG5cbiAgICAgICAgQHNldFBhcmVudCBAcHJldl9jbC5nZXRQYXJlbnQoKSAjIGRvIEluc2VydGlvbnMgYWx3YXlzIGhhdmUgYSBwYXJlbnQ/XG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMoKVxuICAgICAgICBAXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIEBwYXJlbnQ/LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudFxuICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICB2YWx1ZTogQGNvbnRlbnRcbiAgICAgIF1cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIEBwYXJlbnQuY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50ICMgVE9ETzogWW91IGNhbiBjb21iaW5lIGdldFBvc2l0aW9uICsgZ2V0UGFyZW50IGluIGEgbW9yZSBlZmZpY2llbnQgbWFubmVyISAob25seSBsZWZ0IERlbGltaXRlciB3aWxsIGhvbGQgQHBhcmVudClcbiAgICAgICAgbGVuZ3RoOiAxXG4gICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgXVxuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIERlZmluZXMgYW4gb2JqZWN0IHRoYXQgaXMgY2Fubm90IGJlIGNoYW5nZWQuIFlvdSBjYW4gdXNlIHRoaXMgdG8gc2V0IGFuIGltbXV0YWJsZSBzdHJpbmcsIG9yIGEgbnVtYmVyLlxuICAjXG4gIGNsYXNzIHR5cGVzLkltbXV0YWJsZU9iamVjdCBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGNvbnRlbnRcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIEBjb250ZW50KS0+XG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiSW1tdXRhYmxlT2JqZWN0XCJcblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdjb250ZW50JyA6IEBjb250ZW50XG4gICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuSW1tdXRhYmxlT2JqZWN0LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkLCBjb250ZW50KVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIHR5cGVzLkRlbGltaXRlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIge25vT3BlcmF0aW9uOiB0cnVlfVxuXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cbiAgICAgICAgc3VwZXJcbiAgICAgICNlbHNlXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHR5cGVzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDogdHlwZXNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsInRleHRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1RleHRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSB0ZXh0X3R5cGVzLnR5cGVzXG5cbiAgI1xuICAjIE1hbmFnZXMgT2JqZWN0LWxpa2UgdmFsdWVzLlxuICAjXG4gIGNsYXNzIHR5cGVzLk9iamVjdCBleHRlbmRzIHR5cGVzLk1hcE1hbmFnZXJcblxuICAgICNcbiAgICAjIElkZW50aWZpZXMgdGhpcyBjbGFzcy5cbiAgICAjIFVzZSBpdCB0byBjaGVjayB3aGV0aGVyIHRoaXMgaXMgYSBqc29uLXR5cGUgb3Igc29tZXRoaW5nIGVsc2UuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHggPSB5YXR0YS52YWwoJ3Vua25vd24nKVxuICAgICMgICBpZiAoeC50eXBlID09PSBcIk9iamVjdFwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIk9iamVjdFwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG5cbiAgICAjXG4gICAgIyBUcmFuc2Zvcm0gdGhpcyB0byBhIEpzb24uIElmIHlvdXIgYnJvd3NlciBzdXBwb3J0cyBPYmplY3Qub2JzZXJ2ZSBpdCB3aWxsIGJlIHRyYW5zZm9ybWVkIGF1dG9tYXRpY2FsbHkgd2hlbiBhIGNoYW5nZSBhcnJpdmVzLlxuICAgICMgT3RoZXJ3aXNlIHlvdSB3aWxsIGxvb3NlIGFsbCB0aGUgc2hhcmluZy1hYmlsaXRpZXMgKHRoZSBuZXcgb2JqZWN0IHdpbGwgYmUgYSBkZWVwIGNsb25lKSFcbiAgICAjIEByZXR1cm4ge0pzb259XG4gICAgI1xuICAgICMgVE9ETzogYXQgdGhlIG1vbWVudCB5b3UgZG9uJ3QgY29uc2lkZXIgY2hhbmdpbmcgb2YgcHJvcGVydGllcy5cbiAgICAjIEUuZy46IGxldCB4ID0ge2E6W119LiBUaGVuIHguYS5wdXNoIDEgd291bGRuJ3QgY2hhbmdlIGFueXRoaW5nXG4gICAgI1xuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICBpZiBub3QgQGJvdW5kX2pzb24/IG9yIG5vdCBPYmplY3Qub2JzZXJ2ZT8gb3IgdHJ1ZSAjIFRPRE86IGN1cnJlbnRseSwgeW91IGFyZSBub3Qgd2F0Y2hpbmcgbXV0YWJsZSBzdHJpbmdzIGZvciBjaGFuZ2VzLCBhbmQsIHRoZXJlZm9yZSwgdGhlIEBib3VuZF9qc29uIGlzIG5vdCB1cGRhdGVkLiBUT0RPIFRPRE8gIHd1YXd1YXd1YSBlYXN5XG4gICAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgICBqc29uID0ge31cbiAgICAgICAgZm9yIG5hbWUsIG8gb2YgdmFsXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9iamVjdFxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5BcnJheVxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udmFsKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBqc29uW25hbWVdID0gb1xuICAgICAgICBAYm91bmRfanNvbiA9IGpzb25cbiAgICAgICAgaWYgT2JqZWN0Lm9ic2VydmU/XG4gICAgICAgICAgdGhhdCA9IEBcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZSBAYm91bmRfanNvbiwgKGV2ZW50cyktPlxuICAgICAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgICAgICBpZiBub3QgZXZlbnQuY2hhbmdlZEJ5PyBhbmQgKGV2ZW50LnR5cGUgaXMgXCJhZGRcIiBvciBldmVudC50eXBlID0gXCJ1cGRhdGVcIilcbiAgICAgICAgICAgICAgICAjIHRoaXMgZXZlbnQgaXMgbm90IGNyZWF0ZWQgYnkgWWF0dGEuXG4gICAgICAgICAgICAgICAgdGhhdC52YWwoZXZlbnQubmFtZSwgZXZlbnQub2JqZWN0W2V2ZW50Lm5hbWVdKVxuICAgICAgICAgIEBvYnNlcnZlIChldmVudHMpLT5cbiAgICAgICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICAgICAgaWYgZXZlbnQuY3JlYXRlZF8gaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgICAgICAgICAgIG5vdGlmaWVyID0gT2JqZWN0LmdldE5vdGlmaWVyKHRoYXQuYm91bmRfanNvbilcbiAgICAgICAgICAgICAgICBvbGRWYWwgPSB0aGF0LmJvdW5kX2pzb25bZXZlbnQubmFtZV1cbiAgICAgICAgICAgICAgICBpZiBvbGRWYWw/XG4gICAgICAgICAgICAgICAgICBub3RpZmllci5wZXJmb3JtQ2hhbmdlICd1cGRhdGUnLCAoKS0+XG4gICAgICAgICAgICAgICAgICAgICAgdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdID0gdGhhdC52YWwoZXZlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgLCB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgIG5vdGlmaWVyLm5vdGlmeVxuICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IHRoYXQuYm91bmRfanNvblxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAndXBkYXRlJ1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBldmVudC5uYW1lXG4gICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRWYWxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlZEJ5OiBldmVudC5jaGFuZ2VkQnlcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5wZXJmb3JtQ2hhbmdlICdhZGQnLCAoKS0+XG4gICAgICAgICAgICAgICAgICAgICAgdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdID0gdGhhdC52YWwoZXZlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgLCB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgIG5vdGlmaWVyLm5vdGlmeVxuICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IHRoYXQuYm91bmRfanNvblxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYWRkJ1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBldmVudC5uYW1lXG4gICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRWYWxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlZEJ5OmV2ZW50LmNoYW5nZWRCeVxuICAgICAgQGJvdW5kX2pzb25cblxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwoKVxuICAgICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAgICMgICBAcmV0dXJuIFtKc29uXVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGV8fFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgbmFtZT8gYW5kIGFyZ3VtZW50cy5sZW5ndGggPiAxXG4gICAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNvbnN0cnVjdG9yP1xuICAgICAgICAgIHR5cGUgPSB0eXBlc1tjb250ZW50LmNvbnN0cnVjdG9yLm5hbWVdXG4gICAgICAgICAgaWYgdHlwZT8gYW5kIHR5cGUuY3JlYXRlP1xuICAgICAgICAgICAgYXJncyA9IFtdXG4gICAgICAgICAgICBmb3IgaSBpbiBbMS4uLmFyZ3VtZW50cy5sZW5ndGhdXG4gICAgICAgICAgICAgIGFyZ3MucHVzaCBhcmd1bWVudHNbaV1cbiAgICAgICAgICAgIG8gPSB0eXBlLmNyZWF0ZS5hcHBseSBudWxsLCBhcmdzXG4gICAgICAgICAgICBzdXBlciBuYW1lLCBvXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhlICN7Y29udGVudC5jb25zdHJ1Y3Rvci5uYW1lfS10eXBlIGlzIG5vdCAoeWV0KSBzdXBwb3J0ZWQgaW4gWWF0dGEuXCJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHN1cGVyIG5hbWUsIGNvbnRlbnRcbiAgICAgIGVsc2UgIyBpcyB0aGlzIGV2ZW4gbmVjZXNzYXJ5ID8gSSBoYXZlIHRvIGRlZmluZSBldmVyeSB0eXBlIGFueXdheS4uIChzZWUgTnVtYmVyIHR5cGUgYmVsb3cpXG4gICAgICAgIHN1cGVyIG5hbWVcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICB0eXBlcy5PYmplY3QucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQpXG5cbiAgdHlwZXMuT2JqZWN0LmNyZWF0ZSA9IChjb250ZW50LCBtdXRhYmxlKS0+XG4gICAganNvbiA9IG5ldyB0eXBlcy5PYmplY3QoKS5leGVjdXRlKClcbiAgICBmb3IgbixvIG9mIGNvbnRlbnRcbiAgICAgIGpzb24udmFsIG4sIG8sIG11dGFibGVcbiAgICBqc29uXG5cblxuICB0eXBlcy5OdW1iZXIgPSB7fVxuICB0eXBlcy5OdW1iZXIuY3JlYXRlID0gKGNvbnRlbnQpLT5cbiAgICBjb250ZW50XG5cbiAgdGV4dF90eXBlc1xuXG5cbiIsImJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1R5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgYmFzaWNfdHlwZXMgPSBiYXNpY190eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gYmFzaWNfdHlwZXMudHlwZXNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgdHlwZXMuTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgZm9yIG5hbWUscCBvZiBAbWFwXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uVHlwZXMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGFyZ3VtZW50cy5sZW5ndGggPiAxXG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBwcm9wID0gQG1hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcHJvcC52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQG1hcFxuICAgICAgICAgIGlmIG5vdCBvLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gby52YWwoKVxuICAgICAgICByZXN1bHRcblxuICAgIGRlbGV0ZTogKG5hbWUpLT5cbiAgICAgIEBtYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQG1hcFtwcm9wZXJ0eV9uYW1lXT9cbiAgICAgICAgZXZlbnRfcHJvcGVydGllcyA9XG4gICAgICAgICAgbmFtZTogcHJvcGVydHlfbmFtZVxuICAgICAgICBldmVudF90aGlzID0gQFxuICAgICAgICBtYXBfdWlkID0gQGNsb25lVWlkKClcbiAgICAgICAgbWFwX3VpZC5zdWIgPSBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtX3VpZCA9XG4gICAgICAgICAgbm9PcGVyYXRpb246IHRydWVcbiAgICAgICAgICBhbHQ6IG1hcF91aWRcbiAgICAgICAgcm0gPSBuZXcgdHlwZXMuUmVwbGFjZU1hbmFnZXIgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAbWFwW3Byb3BlcnR5X25hbWVdID0gcm1cbiAgICAgICAgcm0uc2V0UGFyZW50IEAsIHByb3BlcnR5X25hbWVcbiAgICAgICAgcm0uZXhlY3V0ZSgpXG4gICAgICBAbWFwW3Byb3BlcnR5X25hbWVdXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3MgdHlwZXMuTGlzdE1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEEgTGlzdE1hbmFnZXIgbWFpbnRhaW5zIGEgbm9uLWVtcHR5IGxpc3QgdGhhdCBoYXMgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCAoYm90aCBEZWxpbWl0ZXJzISlcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQGJlZ2lubmluZyA9IG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgdHlwZXMuRGVsaW1pdGVyIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgQGJlZ2lubmluZy5leGVjdXRlKClcbiAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiTGlzdE1hbmFnZXJcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBzZWUgT3BlcmF0aW9uLmV4ZWN1dGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGJlZ2lubmluZy5zZXRQYXJlbnQgQFxuICAgICAgICBAZW5kLnNldFBhcmVudCBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAZW5kLnByZXZfY2xcblxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXG5cbiAgICAjIFRyYW5zZm9ybXMgdGhlIHRoZSBsaXN0IHRvIGFuIGFycmF5XG4gICAgIyBEb2Vzbid0IHJldHVybiBsZWZ0LXJpZ2h0IGRlbGltaXRlci5cbiAgICB0b0FycmF5OiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgcmVzdWx0LnB1c2ggb1xuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICMgZS5nLiBcImFiY1wiIDogdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxuICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyIGFuZCBvLnByZXZfY2w/XG4gICAgICAgICAgIyB0aGUgdXNlciBvciB5b3UgZ2F2ZSBhIHBvc2l0aW9uIHBhcmFtZXRlciB0aGF0IGlzIHRvIGJpZ1xuICAgICAgICAgICMgZm9yIHRoZSBjdXJyZW50IGFycmF5LiBUaGVyZWZvcmUgd2UgcmVhY2ggYSBEZWxpbWl0ZXIuXG4gICAgICAgICAgIyBUaGVuLCB3ZSdsbCBqdXN0IHJldHVybiB0aGUgbGFzdCBjaGFyYWN0ZXIuXG4gICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIHdoaWxlIG8uaXNEZWxldGVkKCkgb3Igbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3MgdHlwZXMuUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF9wcm9wZXJ0aWVzIERlY29yYXRlcyB0aGUgZXZlbnQgdGhhdCBpcyB0aHJvd24gYnkgdGhlIFJNXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfdGhpcyBUaGUgb2JqZWN0IG9uIHdoaWNoIHRoZSBldmVudCBzaGFsbCBiZSBleGVjdXRlZFxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkLCBiZWdpbm5pbmcsIGVuZCktPlxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cbiAgICAgICAgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddID0gQGV2ZW50X3RoaXNcbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyB0eXBlcy5SZXBsYWNlYWJsZSBjb250ZW50LCBALCByZXBsYWNlYWJsZV91aWQsIG8sIG8ubmV4dF9jbCkuZXhlY3V0ZSgpXG4gICAgICAjIFRPRE86IGRlbGV0ZSByZXBsIChmb3IgZGVidWdnaW5nKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBpc0NvbnRlbnREZWxldGVkOiAoKS0+XG4gICAgICBAZ2V0TGFzdE9wZXJhdGlvbigpLmlzRGVsZXRlZCgpXG5cbiAgICBkZWxldGVDb250ZW50OiAoKS0+XG4gICAgICAobmV3IHR5cGVzLkRlbGV0ZSB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBAdHlwZVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGpzb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyB0eXBlcy5SZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIGlzX2RlbGV0ZWQpLT5cbiAgICAgICMgc2VlIGVuY29kZSB0byBzZWUsIHdoeSB3ZSBhcmUgZG9pbmcgaXQgdGhpcyB3YXlcbiAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNyZWF0b3I/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luICMgUGFyZW50IGlzIGFscmVhZHkgc2F2ZWQgYnkgUmVwbGFjZWFibGVcbiAgICAgIEBpc19kZWxldGVkID0gaXNfZGVsZXRlZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlYWJsZVwiXG5cbiAgICAjXG4gICAgIyBSZXR1cm4gdGhlIGNvbnRlbnQgdGhhdCB0aGlzIG9wZXJhdGlvbiBob2xkcy5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHJlcyA9IHN1cGVyXG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBAY29udGVudC5kZWxldGVBbGxPYnNlcnZlcnM/KClcbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGU/KClcbiAgICAgICAgQGNvbnRlbnQuZG9udFN5bmM/KClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuICAgICAgcmVzXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC10eXBlIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXG4gICAgIyBUT0RPOiBjb25zaWRlciBkb2luZyB0aGlzIGluIGEgbW9yZSBjb25zaXN0ZW50IG1hbm5lci4gVGhpcyBjb3VsZCBhbHNvIGJlXG4gICAgIyBkb25lIHdpdGggZXhlY3V0ZS4gQnV0IGN1cnJlbnRseSwgdGhlcmUgYXJlIG5vIHNwZWNpdGFsIEluc2VydC10eXBlcyBmb3IgTGlzdE1hbmFnZXIuXG4gICAgI1xuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKCktPlxuICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBAcHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIHRoaXMgcmVwbGFjZXMgYW5vdGhlciBSZXBsYWNlYWJsZVxuICAgICAgICBpZiBub3QgQGlzX2RlbGV0ZWQgIyBXaGVuIHRoaXMgaXMgcmVjZWl2ZWQgZnJvbSB0aGUgSEIsIHRoaXMgY291bGQgYWxyZWFkeSBiZSBkZWxldGVkIVxuICAgICAgICAgIG9sZF92YWx1ZSA9IEBwcmV2X2NsLmNvbnRlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgb2xkVmFsdWU6IG9sZF92YWx1ZVxuICAgICAgICAgIF1cbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSBpZiBAbmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBAYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBAY29udGVudFxuICAgICAgICBdXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAncGFyZW50JyA6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICdvcmlnaW4nIDogQG9yaWdpbi5nZXRVaWQoKVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2lzX2RlbGV0ZWQnOiBAaXNfZGVsZXRlZFxuICAgICAgICB9XG4gICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICAjIFRoaXMgY291bGQgYmUgYSBzZWN1cml0eSBjb25jZXJuLlxuICAgICAgICAjIFRocm93IGVycm9yIGlmIHRoZSB1c2VycyB3YW50cyB0byB0cmljayB1c1xuICAgICAgICBpZiBAY29udGVudD8gYW5kIEBjb250ZW50LmNyZWF0b3I/XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCBjcmVhdG9yIGhlcmUhXCJcbiAgICAgICAganNvblsnY29udGVudCddID0gQGNvbnRlbnRcbiAgICAgIGpzb25cblxuICB0eXBlcy5SZXBsYWNlYWJsZS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdpc19kZWxldGVkJzogaXNfZGVsZXRlZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgaXNfZGVsZXRlZClcblxuXG4gIGJhc2ljX3R5cGVzXG5cblxuXG5cblxuXG4iLCJzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9TdHJ1Y3R1cmVkVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBzdHJ1Y3R1cmVkX3R5cGVzID0gc3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gc3RydWN0dXJlZF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSBzdHJ1Y3R1cmVkX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyB0eXBlcy5UZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgcGFyZW50KS0+XG4gICAgICBpZiBjb250ZW50Py5jcmVhdG9yXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuICAgIHR5cGU6IFwiVGV4dEluc2VydFwiXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIgIyBubyBicmFjZXMgaW5kZWVkIVxuICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgQGNvbnRlbnQgPSBudWxsXG5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEBcbiAgICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKCkgb3Igbm90IEBjb250ZW50P1xuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ29yaWdpbic6IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgICAgICAncGFyZW50JzogQHBhcmVudC5nZXRVaWQoKVxuICAgICAgICB9XG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50XG4gICAgICBqc29uXG5cbiAgdHlwZXMuVGV4dEluc2VydC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuXG4gIGNsYXNzIHR5cGVzLkFycmF5IGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcblxuICAgIHR5cGU6IFwiQXJyYXlcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAZW5kXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgZm9yIGksIG8gaW4gdmFsXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5PYmplY3RcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkFycmF5XG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9cblxuICAgIHZhbDogKHBvcyktPlxuICAgICAgaWYgcG9zP1xuICAgICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zKzEpXG4gICAgICAgIGlmIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgICByZXN1bHQgPSBbXVxuICAgICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICByZXN1bHQucHVzaCBvLnZhbCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICByZXN1bHRcblxuICAgIHB1c2g6IChjb250ZW50KS0+XG4gICAgICBAaW5zZXJ0QWZ0ZXIgQGVuZC5wcmV2X2NsLCBjb250ZW50XG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnQsIG9wdGlvbnMpLT5cbiAgICAgIGNyZWF0ZUNvbnRlbnQgPSAoY29udGVudCwgb3B0aW9ucyktPlxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5jb25zdHJ1Y3Rvcj9cbiAgICAgICAgICB0eXBlID0gdHlwZXNbY29udGVudC5jb25zdHJ1Y3Rvci5uYW1lXVxuICAgICAgICAgIGlmIHR5cGU/IGFuZCB0eXBlLmNyZWF0ZT9cbiAgICAgICAgICAgIHR5cGUuY3JlYXRlIGNvbnRlbnQsIG9wdGlvbnNcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgI3tjb250ZW50LmNvbnN0cnVjdG9yLm5hbWV9LXR5cGUgaXMgbm90ICh5ZXQpIHN1cHBvcnRlZCBpbiBZYXR0YS5cIlxuICAgICAgICBlbHNlXG4gICAgICAgICAgY29udGVudFxuXG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG5cbiAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgKG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgICAgdG1wID0gKG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNyZWF0ZUNvbnRlbnQoYywgb3B0aW9ucyksIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtBcnJheSBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIFtjb250ZW50XSwgb3B0aW9uc1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7QXJyYXkgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XG4gICAgI1xuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGgpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gKG5ldyB0eXBlcy5EZWxldGUgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSAobm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGpzb25cblxuICB0eXBlcy5BcnJheS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZClcblxuICB0eXBlcy5BcnJheS5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgbGlzdCA9IG5ldyB0eXBlcy5BcnJheSgpLmV4ZWN1dGUoKVxuICAgICAgaXRoID0gbGlzdC5nZXRPcGVyYXRpb25CeVBvc2l0aW9uIDBcbiAgICAgIGxpc3QuaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50XG4gICAgICBsaXN0XG4gICAgZWxzZSBpZiAobm90IG11dGFibGU/KSBvciAobXV0YWJsZSBpcyBcImltbXV0YWJsZVwiKVxuICAgICAgY29udGVudFxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlNwZWNpZnkgZWl0aGVyIFxcXCJtdXRhYmxlXFxcIiBvciBcXFwiaW1tdXRhYmxlXFxcIiEhXCJcblxuICAjXG4gICMgSGFuZGxlcyBhIFN0cmluZy1saWtlIGRhdGEgc3RydWN0dXJlcyB3aXRoIHN1cHBvcnQgZm9yIGluc2VydC9kZWxldGUgYXQgYSB3b3JkLXBvc2l0aW9uLlxuICAjIEBub3RlIEN1cnJlbnRseSwgb25seSBUZXh0IGlzIHN1cHBvcnRlZCFcbiAgI1xuICBjbGFzcyB0eXBlcy5TdHJpbmcgZXh0ZW5kcyB0eXBlcy5BcnJheVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEB0ZXh0ZmllbGRzID0gW11cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIHdvcmQtdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHlhdHRhLnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiU3RyaW5nXCIpIHtcbiAgICAjICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSh4LnRvSnNvbigpKVxuICAgICMgICB9XG4gICAgI1xuICAgIHR5cGU6IFwiU3RyaW5nXCJcblxuICAgICNcbiAgICAjIEdldCB0aGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgd29yZC5cbiAgICAjIEByZXR1cm4ge1N0cmluZ30gVGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIG9iamVjdC5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBjID0gZm9yIG8gaW4gQHRvQXJyYXkoKVxuICAgICAgICBpZiBvLnZhbD9cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBcIlwiXG4gICAgICBjLmpvaW4oJycpXG5cbiAgICAjXG4gICAgIyBTYW1lIGFzIFN0cmluZy52YWxcbiAgICAjIEBzZWUgU3RyaW5nLnZhbFxuICAgICNcbiAgICB0b1N0cmluZzogKCktPlxuICAgICAgQHZhbCgpXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7QXJyYXkgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudCwgb3B0aW9ucyktPlxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50LCBvcHRpb25zXG5cbiAgICAjXG4gICAgIyBCaW5kIHRoaXMgU3RyaW5nIHRvIGEgdGV4dGZpZWxkIG9yIGlucHV0IGZpZWxkLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB0ZXh0Ym94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXh0ZmllbGRcIik7XG4gICAgIyAgIHlhdHRhLmJpbmQodGV4dGJveCk7XG4gICAgI1xuICAgIGJpbmQ6ICh0ZXh0ZmllbGQsIGRvbV9yb290KS0+XG4gICAgICBkb21fcm9vdCA/PSB3aW5kb3dcbiAgICAgIGlmIChub3QgZG9tX3Jvb3QuZ2V0U2VsZWN0aW9uPylcbiAgICAgICAgZG9tX3Jvb3QgPSB3aW5kb3dcblxuICAgICAgIyBkb24ndCBkdXBsaWNhdGUhXG4gICAgICBmb3IgdCBpbiBAdGV4dGZpZWxkc1xuICAgICAgICBpZiB0IGlzIHRleHRmaWVsZFxuICAgICAgICAgIHJldHVyblxuICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlO1xuXG4gICAgICB3b3JkID0gQFxuICAgICAgdGV4dGZpZWxkLnZhbHVlID0gQHZhbCgpXG4gICAgICBAdGV4dGZpZWxkcy5wdXNoIHRleHRmaWVsZFxuXG4gICAgICBpZiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQ/IGFuZCB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2U/XG4gICAgICAgIGNyZWF0ZVJhbmdlID0gKGZpeCktPlxuICAgICAgICAgIGxlZnQgPSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICByaWdodCA9IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBpZiBmaXg/XG4gICAgICAgICAgICBsZWZ0ID0gZml4IGxlZnRcbiAgICAgICAgICAgIHJpZ2h0ID0gZml4IHJpZ2h0XG4gICAgICAgICAge1xuICAgICAgICAgICAgbGVmdDogbGVmdFxuICAgICAgICAgICAgcmlnaHQ6IHJpZ2h0XG4gICAgICAgICAgfVxuXG4gICAgICAgIHdyaXRlUmFuZ2UgPSAocmFuZ2UpLT5cbiAgICAgICAgICB3cml0ZUNvbnRlbnQgd29yZC52YWwoKVxuICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSByYW5nZS5sZWZ0LCByYW5nZS5yaWdodFxuXG4gICAgICAgIHdyaXRlQ29udGVudCA9IChjb250ZW50KS0+XG4gICAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBjcmVhdGVSYW5nZSA9IChmaXgpLT5cbiAgICAgICAgICBzID0gZG9tX3Jvb3QuZ2V0U2VsZWN0aW9uKClcbiAgICAgICAgICBjbGVuZ3RoID0gdGV4dGZpZWxkLnRleHRDb250ZW50Lmxlbmd0aFxuICAgICAgICAgIGxlZnQgPSBNYXRoLm1pbiBzLmFuY2hvck9mZnNldCwgY2xlbmd0aFxuICAgICAgICAgIHJpZ2h0ID0gTWF0aC5taW4gcy5mb2N1c09mZnNldCwgY2xlbmd0aFxuICAgICAgICAgIGlmIGZpeD9cbiAgICAgICAgICAgIGxlZnQgPSBmaXggbGVmdFxuICAgICAgICAgICAgcmlnaHQgPSBmaXggcmlnaHRcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsZWZ0OiBsZWZ0XG4gICAgICAgICAgICByaWdodDogcmlnaHRcbiAgICAgICAgICAgIGlzUmVhbDogdHJ1ZVxuICAgICAgICAgIH1cblxuICAgICAgICB3cml0ZVJhbmdlID0gKHJhbmdlKS0+XG4gICAgICAgICAgd3JpdGVDb250ZW50IHdvcmQudmFsKClcbiAgICAgICAgICB0ZXh0bm9kZSA9IHRleHRmaWVsZC5jaGlsZE5vZGVzWzBdXG4gICAgICAgICAgaWYgcmFuZ2UuaXNSZWFsIGFuZCB0ZXh0bm9kZT9cbiAgICAgICAgICAgIGlmIHJhbmdlLmxlZnQgPCAwXG4gICAgICAgICAgICAgIHJhbmdlLmxlZnQgPSAwXG4gICAgICAgICAgICByYW5nZS5yaWdodCA9IE1hdGgubWF4IHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0XG4gICAgICAgICAgICBpZiByYW5nZS5yaWdodCA+IHRleHRub2RlLmxlbmd0aFxuICAgICAgICAgICAgICByYW5nZS5yaWdodCA9IHRleHRub2RlLmxlbmd0aFxuICAgICAgICAgICAgcmFuZ2UubGVmdCA9IE1hdGgubWluIHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0XG4gICAgICAgICAgICByID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKVxuICAgICAgICAgICAgci5zZXRTdGFydCh0ZXh0bm9kZSwgcmFuZ2UubGVmdClcbiAgICAgICAgICAgIHIuc2V0RW5kKHRleHRub2RlLCByYW5nZS5yaWdodClcbiAgICAgICAgICAgIHMgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKClcbiAgICAgICAgICAgIHMucmVtb3ZlQWxsUmFuZ2VzKClcbiAgICAgICAgICAgIHMuYWRkUmFuZ2UocilcbiAgICAgICAgd3JpdGVDb250ZW50ID0gKGNvbnRlbnQpLT5cbiAgICAgICAgICBhcHBlbmQgPSBcIlwiXG4gICAgICAgICAgaWYgY29udGVudFtjb250ZW50Lmxlbmd0aCAtIDFdIGlzIFwiIFwiXG4gICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5zbGljZSgwLGNvbnRlbnQubGVuZ3RoLTEpXG4gICAgICAgICAgICBhcHBlbmQgPSAnJm5ic3A7J1xuICAgICAgICAgIHRleHRmaWVsZC50ZXh0Q29udGVudCA9IGNvbnRlbnRcbiAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJIVE1MICs9IGFwcGVuZFxuXG4gICAgICB3cml0ZUNvbnRlbnQgdGhpcy52YWwoKVxuXG4gICAgICBAb2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBpZiBub3QgY3JlYXRvcl90b2tlblxuICAgICAgICAgICAgaWYgZXZlbnQudHlwZSBpcyBcImluc2VydFwiXG4gICAgICAgICAgICAgIG9fcG9zID0gZXZlbnQucG9zaXRpb25cbiAgICAgICAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICByID0gY3JlYXRlUmFuZ2UgZml4XG4gICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAgICAgICBlbHNlIGlmIGV2ZW50LnR5cGUgaXMgXCJkZWxldGVcIlxuICAgICAgICAgICAgICBvX3BvcyA9IGV2ZW50LnBvc2l0aW9uXG4gICAgICAgICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICAgICAgICBpZiBjdXJzb3IgPCBvX3Bvc1xuICAgICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgY3Vyc29yIC09IDFcbiAgICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICByID0gY3JlYXRlUmFuZ2UgZml4XG4gICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAjIGNvbnN1bWUgYWxsIHRleHQtaW5zZXJ0IGNoYW5nZXMuXG4gICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IG51bGxcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICBjcmVhdG9yX3Rva2VuID0gdHJ1ZVxuICAgICAgICBjaGFyID0gbnVsbFxuICAgICAgICBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgICAgY2hhciA9ICdcXG4nXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IHdpbmRvdy5TdHJpbmcuZnJvbUNoYXJDb2RlIGV2ZW50LmtleUNvZGVcbiAgICAgICAgaWYgY2hhci5sZW5ndGggPiAxXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZWxzZSBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICByID0gY3JlYXRlUmFuZ2UoKVxuICAgICAgICAgIHBvcyA9IE1hdGgubWluIHIubGVmdCwgci5yaWdodFxuICAgICAgICAgIGRpZmYgPSBNYXRoLmFicyhyLnJpZ2h0IC0gci5sZWZ0KVxuICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgIHdvcmQuaW5zZXJ0IHBvcywgY2hhclxuICAgICAgICAgIHIubGVmdCA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgci5yaWdodCA9IHIubGVmdFxuICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25jdXQgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAjXG4gICAgICAjIGNvbnN1bWUgZGVsZXRlcy4gTm90ZSB0aGF0XG4gICAgICAjICAgY2hyb21lOiB3b24ndCBjb25zdW1lIGRlbGV0aW9ucyBvbiBrZXlwcmVzcyBldmVudC5cbiAgICAgICMgICBrZXlDb2RlIGlzIGRlcHJlY2F0ZWQuIEJVVDogSSBkb24ndCBzZWUgYW5vdGhlciB3YXkuXG4gICAgICAjICAgICBzaW5jZSBldmVudC5rZXkgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IHZlcnNpb24gb2YgY2hyb21lLlxuICAgICAgIyAgICAgRXZlcnkgYnJvd3NlciBzdXBwb3J0cyBrZXlDb2RlLiBMZXQncyBzdGljayB3aXRoIGl0IGZvciBub3cuLlxuICAgICAgI1xuICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IChldmVudCktPlxuICAgICAgICBjcmVhdG9yX3Rva2VuID0gdHJ1ZVxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIHIgPSBjcmVhdGVSYW5nZSgpXG4gICAgICAgIHBvcyA9IE1hdGgubWluKHIubGVmdCwgci5yaWdodCwgd29yZC52YWwoKS5sZW5ndGgpXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyhyLmxlZnQgLSByLnJpZ2h0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgICAgci5sZWZ0ID0gcG9zXG4gICAgICAgICAgICByLnJpZ2h0ID0gcG9zXG4gICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB3b3JkLnZhbCgpXG4gICAgICAgICAgICAgIG5ld19wb3MgPSBwb3NcbiAgICAgICAgICAgICAgZGVsX2xlbmd0aCA9IDBcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3aGlsZSBuZXdfcG9zID4gMCBhbmQgdmFsW25ld19wb3NdIGlzbnQgXCIgXCIgYW5kIHZhbFtuZXdfcG9zXSBpc250ICdcXG4nXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlIG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgci5sZWZ0ID0gbmV3X3Bvc1xuICAgICAgICAgICAgICByLnJpZ2h0ID0gbmV3X3Bvc1xuICAgICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIHdvcmQuZGVsZXRlIChwb3MtMSksIDFcbiAgICAgICAgICAgICAgICByLmxlZnQgPSBwb3MtMVxuICAgICAgICAgICAgICAgIHIucmlnaHQgPSBwb3MtMVxuICAgICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZSBwb3MsIGRpZmZcbiAgICAgICAgICAgIHIubGVmdCA9IHBvc1xuICAgICAgICAgICAgci5yaWdodCA9IHBvc1xuICAgICAgICAgICAgd3JpdGVSYW5nZSByXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGUgcG9zLCAxXG4gICAgICAgICAgICByLmxlZnQgPSBwb3NcbiAgICAgICAgICAgIHIucmlnaHQgPSBwb3NcbiAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNyZWF0b3JfdG9rZW4gPSBmYWxzZVxuICAgICAgICAgIHRydWVcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuU3RyaW5nLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkKVxuXG4gIHR5cGVzLlN0cmluZy5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgd29yZCA9IG5ldyB0eXBlcy5TdHJpbmcoKS5leGVjdXRlKClcbiAgICAgIHdvcmQuaW5zZXJ0IDAsIGNvbnRlbnRcbiAgICAgIHdvcmRcbiAgICBlbHNlIGlmIChub3QgbXV0YWJsZT8pIG9yIChtdXRhYmxlIGlzIFwiaW1tdXRhYmxlXCIpXG4gICAgICBjb250ZW50XG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiU3BlY2lmeSBlaXRoZXIgXFxcIm11dGFibGVcXFwiIG9yIFxcXCJpbW11dGFibGVcXFwiISFcIlxuXG5cbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVHlwZXMvSnNvblR5cGVzXCJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuL0VuZ2luZVwiXG5hZGFwdENvbm5lY3RvciA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckFkYXB0ZXJcIlxuXG5jcmVhdGVZYXR0YSA9IChjb25uZWN0b3IpLT5cbiAgdXNlcl9pZCA9IG51bGxcbiAgaWYgY29ubmVjdG9yLmlkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IuaWQgIyBUT0RPOiBjaGFuZ2UgdG8gZ2V0VW5pcXVlSWQoKVxuICBlbHNlXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxuICAgIGNvbm5lY3Rvci53aGVuVXNlcklkU2V0IChpZCktPlxuICAgICAgdXNlcl9pZCA9IGlkXG4gICAgICBIQi5yZXNldFVzZXJJZCBpZFxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgdHlwZV9tYW5hZ2VyID0ganNvbl90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdHlwZV9tYW5hZ2VyLnR5cGVzXG5cbiAgI1xuICAjIEZyYW1ld29yayBmb3IgSnNvbiBkYXRhLXN0cnVjdHVyZXMuXG4gICMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiAgIyAqIFN0cmluZ1xuICAjICogSW50ZWdlclxuICAjICogQXJyYXlcbiAgI1xuICBjbGFzcyBZYXR0YSBleHRlbmRzIHR5cGVzLk9iamVjdFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IHVzZXJfaWQgVW5pcXVlIGlkIG9mIHRoZSBwZWVyLlxuICAgICMgQHBhcmFtIHtDb25uZWN0b3J9IENvbm5lY3RvciB0aGUgY29ubmVjdG9yIGNsYXNzLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKCktPlxuICAgICAgQGNvbm5lY3RvciA9IGNvbm5lY3RvclxuICAgICAgQEhCID0gSEJcbiAgICAgIEB0eXBlcyA9IHR5cGVzXG4gICAgICBAZW5naW5lID0gbmV3IEVuZ2luZSBASEIsIHR5cGVfbWFuYWdlci50eXBlc1xuICAgICAgYWRhcHRDb25uZWN0b3IgQGNvbm5lY3RvciwgQGVuZ2luZSwgQEhCLCB0eXBlX21hbmFnZXIuZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICBzdXBlclxuXG4gICAgZ2V0Q29ubmVjdG9yOiAoKS0+XG4gICAgICBAY29ubmVjdG9yXG5cbiAgcmV0dXJuIG5ldyBZYXR0YShIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKSkuZXhlY3V0ZSgpXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlWWF0dGFcbmlmIHdpbmRvdz8gYW5kIG5vdCB3aW5kb3cuWWF0dGE/XG4gIHdpbmRvdy5ZYXR0YSA9IGNyZWF0ZVlhdHRhXG4iXX0=
