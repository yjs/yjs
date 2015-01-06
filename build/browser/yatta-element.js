(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var adaptConnector;

adaptConnector = function(connector, engine, HB, execution_listener) {
  var applyHb, encode_state_vector, parse_state_vector, sendHb, sendStateVector, send_;
  send_ = function(o) {
    if (o.uid.creator === HB.getUserId() && (typeof o.uid.op_number !== "string")) {
      return connector.broadcast(o);
    }
  };
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
  return HB.setInvokeSyncHandler(connector.invokeSync);
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
    this.garbageCollectTimeout = 2000;
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
    var _ref;
    if (uid.uid != null) {
      uid = uid.uid;
    }
    return (_ref = this.buffer[uid.creator]) != null ? _ref[uid.op_number] : void 0;
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
  var Delete, Delimiter, ImmutableObject, Insert, Operation, execution_listener, parser;
  parser = {};
  execution_listener = [];
  Operation = (function() {
    function Operation(uid) {
      this.is_deleted = false;
      this.garbage_collected = false;
      this.event_listeners = [];
      if (uid != null) {
        this.uid = uid;
      }
    }

    Operation.prototype.type = "Insert";

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
      return this.uid;
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
      HB.addOperation(this);
      for (_i = 0, _len = execution_listener.length; _i < _len; _i++) {
        l = execution_listener[_i];
        l(this._encode());
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
  Delete = (function(_super) {
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

  })(Operation);
  parser['Delete'] = function(o) {
    var deletes_uid, uid;
    uid = o['uid'], deletes_uid = o['deletes'];
    return new Delete(uid, deletes_uid);
  };
  Insert = (function(_super) {
    __extends(Insert, _super);

    function Insert(uid, prev_cl, next_cl, origin) {
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
      if (!((this.prev_cl != null) && (this.next_cl != null)) || this.prev_cl.isDeleted()) {
        garbagecollect = true;
      }
      Insert.__super__.applyDelete.call(this, garbagecollect);
      if (callLater) {
        this.callOperationSpecificDeleteEvents(o);
      }
      if ((_ref = this.next_cl) != null ? _ref.isDeleted() : void 0) {
        return this.next_cl.applyDelete();
      }
    };

    Insert.prototype.cleanup = function() {
      var d, o, _i, _len, _ref, _ref1;
      if ((_ref = this.prev_cl) != null ? _ref.isDeleted() : void 0) {
        _ref1 = this.deleted_by;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          d = _ref1[_i];
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
        if (prev instanceof Delimiter) {
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

  })(Operation);
  ImmutableObject = (function(_super) {
    __extends(ImmutableObject, _super);

    function ImmutableObject(uid, content, prev, next, origin) {
      this.content = content;
      ImmutableObject.__super__.constructor.call(this, uid, prev, next, origin);
    }

    ImmutableObject.prototype.type = "ImmutableObject";

    ImmutableObject.prototype.val = function() {
      return this.content;
    };

    ImmutableObject.prototype._encode = function() {
      var json;
      json = {
        'type': "ImmutableObject",
        'uid': this.getUid(),
        'content': this.content
      };
      if (this.prev_cl != null) {
        json['prev'] = this.prev_cl.getUid();
      }
      if (this.next_cl != null) {
        json['next'] = this.next_cl.getUid();
      }
      if (this.origin != null) {
        json["origin"] = this.origin().getUid();
      }
      return json;
    };

    return ImmutableObject;

  })(Operation);
  parser['ImmutableObject'] = function(json) {
    var content, next, origin, prev, uid;
    uid = json['uid'], content = json['content'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new ImmutableObject(uid, content, prev, next, origin);
  };
  Delimiter = (function(_super) {
    __extends(Delimiter, _super);

    function Delimiter(uid, prev_cl, next_cl, origin) {
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      this.saveOperation('origin', prev_cl);
      Delimiter.__super__.constructor.call(this, uid);
    }

    Delimiter.prototype.type = "Delimiter";

    Delimiter.prototype.applyDelete = function() {
      var o;
      Delimiter.__super__.applyDelete.call(this);
      o = this.next_cl;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
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
        'type': "Delimiter",
        'uid': this.getUid(),
        'prev': (_ref = this.prev_cl) != null ? _ref.getUid() : void 0,
        'next': (_ref1 = this.next_cl) != null ? _ref1.getUid() : void 0
      };
    };

    return Delimiter;

  })(Operation);
  parser['Delimiter'] = function(json) {
    var next, prev, uid;
    uid = json['uid'], prev = json['prev'], next = json['next'];
    return new Delimiter(uid, prev, next);
  };
  return {
    'types': {
      'Delete': Delete,
      'Insert': Insert,
      'Delimiter': Delimiter,
      'Operation': Operation,
      'ImmutableObject': ImmutableObject
    },
    'parser': parser,
    'execution_listener': execution_listener
  };
};


},{}],5:[function(require,module,exports){
var text_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_types_uninitialized = require("./TextTypes");

module.exports = function(HB) {
  var JsonType, createJsonTypeWrapper, parser, text_types, types;
  text_types = text_types_uninitialized(HB);
  types = text_types.types;
  parser = text_types.parser;
  createJsonTypeWrapper = function(_jsonType) {
    var JsonTypeWrapper;
    JsonTypeWrapper = (function() {
      function JsonTypeWrapper(jsonType) {
        var name, obj, _fn, _ref;
        _ref = jsonType.map;
        _fn = function(name, obj) {
          return Object.defineProperty(JsonTypeWrapper.prototype, name, {
            get: function() {
              var x;
              x = obj.val();
              if (x instanceof JsonType) {
                return createJsonTypeWrapper(x);
              } else if (x instanceof types.ImmutableObject) {
                return x.val();
              } else {
                return x;
              }
            },
            set: function(o) {
              var o_name, o_obj, overwrite, _results;
              overwrite = jsonType.val(name);
              if (o.constructor === {}.constructor && overwrite instanceof types.Operation) {
                _results = [];
                for (o_name in o) {
                  o_obj = o[o_name];
                  _results.push(overwrite.val(o_name, o_obj, 'immutable'));
                }
                return _results;
              } else {
                return jsonType.val(name, o, 'immutable');
              }
            },
            enumerable: true,
            configurable: false
          });
        };
        for (name in _ref) {
          obj = _ref[name];
          _fn(name, obj);
        }
      }

      return JsonTypeWrapper;

    })();
    return new JsonTypeWrapper(_jsonType);
  };
  JsonType = (function(_super) {
    __extends(JsonType, _super);

    function JsonType() {
      return JsonType.__super__.constructor.apply(this, arguments);
    }

    JsonType.prototype.type = "JsonType";

    JsonType.prototype.applyDelete = function() {
      return JsonType.__super__.applyDelete.call(this);
    };

    JsonType.prototype.cleanup = function() {
      return JsonType.__super__.cleanup.call(this);
    };

    JsonType.prototype.toJson = function() {
      var json, name, o, that, val;
      if ((this.bound_json == null) || (Object.observe == null) || true) {
        val = this.val();
        json = {};
        for (name in val) {
          o = val[name];
          if (o == null) {
            json[name] = o;
          } else if (o.constructor === {}.constructor) {
            json[name] = this.val(name).toJson();
          } else if (o instanceof types.Operation) {
            while (o instanceof types.Operation) {
              o = o.val();
            }
            json[name] = o;
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

    JsonType.prototype.mutable_default = true;

    JsonType.prototype.setMutableDefault = function(mutable) {
      if (mutable === true || mutable === 'mutable') {
        JsonType.prototype.mutable_default = true;
      } else if (mutable === false || mutable === 'immutable') {
        JsonType.prototype.mutable_default = false;
      } else {
        throw new Error('Set mutable either "mutable" or "immutable"!');
      }
      return 'OK';
    };

    JsonType.prototype.val = function(name, content, mutable) {
      var json, n, o, word;
      if ((name != null) && arguments.length > 1) {
        if (mutable != null) {
          if (mutable === true || mutable === 'mutable') {
            mutable = true;
          } else {
            mutable = false;
          }
        } else {
          mutable = this.mutable_default;
        }
        if (typeof content === 'function') {
          return this;
        } else if ((content == null) || (((!mutable) || typeof content === 'number') && content.constructor !== Object)) {
          return JsonType.__super__.val.call(this, name, (new types.ImmutableObject(void 0, content)).execute());
        } else {
          if (typeof content === 'string') {
            word = (new types.WordType(void 0)).execute();
            word.insertText(0, content);
            return JsonType.__super__.val.call(this, name, word);
          } else if (content.constructor === Object) {
            json = new JsonType().execute();
            for (n in content) {
              o = content[n];
              json.val(n, o, mutable);
            }
            return JsonType.__super__.val.call(this, name, json);
          } else {
            throw new Error("You must not set " + (typeof content) + "-types in collaborative Json-objects!");
          }
        }
      } else {
        return JsonType.__super__.val.call(this, name, content);
      }
    };

    Object.defineProperty(JsonType.prototype, 'value', {
      get: function() {
        return createJsonTypeWrapper(this);
      },
      set: function(o) {
        var o_name, o_obj, _results;
        if (o.constructor === {}.constructor) {
          _results = [];
          for (o_name in o) {
            o_obj = o[o_name];
            _results.push(this.val(o_name, o_obj, 'immutable'));
          }
          return _results;
        } else {
          throw new Error("You must only set Object values!");
        }
      }
    });

    JsonType.prototype._encode = function() {
      return {
        'type': "JsonType",
        'uid': this.getUid()
      };
    };

    return JsonType;

  })(types.MapManager);
  parser['JsonType'] = function(json) {
    var uid;
    uid = json['uid'];
    return new JsonType(uid);
  };
  types['JsonType'] = JsonType;
  return text_types;
};


},{"./TextTypes":7}],6:[function(require,module,exports){
var basic_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

basic_types_uninitialized = require("./BasicTypes");

module.exports = function(HB) {
  var AddName, ListManager, MapManager, ReplaceManager, Replaceable, basic_types, parser, types;
  basic_types = basic_types_uninitialized(HB);
  types = basic_types.types;
  parser = basic_types.parser;
  MapManager = (function(_super) {
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
        if (this.map[name] == null) {
          (new AddName(void 0, this, name)).execute();
        }
        this.map[name].replace(content);
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

    return MapManager;

  })(types.Operation);
  AddName = (function(_super) {
    __extends(AddName, _super);

    function AddName(uid, map_manager, name) {
      this.name = name;
      this.saveOperation('map_manager', map_manager);
      AddName.__super__.constructor.call(this, uid);
    }

    AddName.prototype.type = "AddName";

    AddName.prototype.applyDelete = function() {
      return AddName.__super__.applyDelete.call(this);
    };

    AddName.prototype.cleanup = function() {
      return AddName.__super__.cleanup.call(this);
    };

    AddName.prototype.execute = function() {
      var beg, clone, end, event_properties, event_this, uid_beg, uid_end, uid_r, _base;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        clone = function(o) {
          var name, p, value;
          p = {};
          for (name in o) {
            value = o[name];
            p[name] = value;
          }
          return p;
        };
        uid_r = clone(this.map_manager.getUid());
        uid_r.doSync = false;
        uid_r.op_number = "_" + uid_r.op_number + "_RM_" + this.name;
        if (HB.getOperation(uid_r) == null) {
          uid_beg = clone(uid_r);
          uid_beg.op_number = "" + uid_r.op_number + "_beginning";
          uid_end = clone(uid_r);
          uid_end.op_number = "" + uid_r.op_number + "_end";
          beg = (new types.Delimiter(uid_beg, void 0, uid_end)).execute();
          end = (new types.Delimiter(uid_end, beg, void 0)).execute();
          event_properties = {
            name: this.name
          };
          event_this = this.map_manager;
          this.map_manager.map[this.name] = new ReplaceManager(event_properties, event_this, uid_r, beg, end);
          this.map_manager.map[this.name].setParent(this.map_manager, this.name);
          ((_base = this.map_manager.map[this.name]).add_name_ops != null ? _base.add_name_ops : _base.add_name_ops = []).push(this);
          this.map_manager.map[this.name].execute();
        }
        return AddName.__super__.execute.apply(this, arguments);
      }
    };

    AddName.prototype._encode = function() {
      return {
        'type': "AddName",
        'uid': this.getUid(),
        'map_manager': this.map_manager.getUid(),
        'name': this.name
      };
    };

    return AddName;

  })(types.Operation);
  parser['AddName'] = function(json) {
    var map_manager, name, uid;
    map_manager = json['map_manager'], uid = json['uid'], name = json['name'];
    return new AddName(uid, map_manager, name);
  };
  ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(uid, beginning, end, prev, next, origin) {
      if ((beginning != null) && (end != null)) {
        this.saveOperation('beginning', beginning);
        this.saveOperation('end', end);
      } else {
        this.beginning = new types.Delimiter(void 0, void 0, void 0);
        this.end = new types.Delimiter(void 0, this.beginning, void 0);
        this.beginning.next_cl = this.end;
        this.beginning.execute();
        this.end.execute();
      }
      ListManager.__super__.constructor.call(this, uid, prev, next, origin);
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
  ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(event_properties, event_this, uid, beginning, end, prev, next, origin) {
      this.event_properties = event_properties;
      this.event_this = event_this;
      if (this.event_properties['object'] == null) {
        this.event_properties['object'] = this.event_this;
      }
      ReplaceManager.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
    }

    ReplaceManager.prototype.type = "ReplaceManager";

    ReplaceManager.prototype.applyDelete = function() {
      var o, _i, _len, _ref;
      o = this.beginning;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
      }
      if (this.add_name_ops != null) {
        _ref = this.add_name_ops;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          o = _ref[_i];
          o.applyDelete();
        }
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
      relp = (new Replaceable(content, this, replaceable_uid, o, o.next_cl)).execute();
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
        'type': "ReplaceManager",
        'uid': this.getUid(),
        'beginning': this.beginning.getUid(),
        'end': this.end.getUid()
      };
      if ((this.prev_cl != null) && (this.next_cl != null)) {
        json['prev'] = this.prev_cl.getUid();
        json['next'] = this.next_cl.getUid();
      }
      if (this.origin != null) {
        json["origin"] = this.origin().getUid();
      }
      return json;
    };

    return ReplaceManager;

  })(ListManager);
  parser["ReplaceManager"] = function(json) {
    var beginning, end, next, origin, prev, uid;
    uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], beginning = json['beginning'], end = json['end'];
    return new ReplaceManager(uid, beginning, end, prev, next, origin);
  };
  Replaceable = (function(_super) {
    __extends(Replaceable, _super);

    function Replaceable(content, parent, uid, prev, next, origin) {
      this.saveOperation('content', content);
      this.saveOperation('parent', parent);
      if (!((prev != null) && (next != null))) {
        throw new Error("You must define prev, and next for Replaceable-types!");
      }
      Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
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
        old_value = this.prev_cl.content;
        this.parent.callEventDecorator([
          {
            type: "update",
            changedBy: this.uid.creator,
            oldValue: old_value
          }
        ]);
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
        'type': "Replaceable",
        'content': (_ref = this.content) != null ? _ref.getUid() : void 0,
        'replace_manager': this.parent.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'uid': this.getUid()
      };
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return Replaceable;

  })(types.Insert);
  parser["Replaceable"] = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], parent = json['replace_manager'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new Replaceable(content, parent, uid, prev, next, origin);
  };
  types['ListManager'] = ListManager;
  types['MapManager'] = MapManager;
  types['ReplaceManager'] = ReplaceManager;
  types['Replaceable'] = Replaceable;
  return basic_types;
};


},{"./BasicTypes":4}],7:[function(require,module,exports){
var structured_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

structured_types_uninitialized = require("./StructuredTypes");

module.exports = function(HB) {
  var TextDelete, TextInsert, WordType, parser, structured_types, types;
  structured_types = structured_types_uninitialized(HB);
  types = structured_types.types;
  parser = structured_types.parser;
  TextDelete = (function(_super) {
    __extends(TextDelete, _super);

    function TextDelete() {
      return TextDelete.__super__.constructor.apply(this, arguments);
    }

    return TextDelete;

  })(types.Delete);
  parser["TextDelete"] = parser["Delete"];
  TextInsert = (function(_super) {
    __extends(TextInsert, _super);

    function TextInsert(content, uid, prev, next, origin) {
      var _ref;
      if (content != null ? (_ref = content.uid) != null ? _ref.creator : void 0 : void 0) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      if (!((prev != null) && (next != null))) {
        throw new Error("You must define prev, and next for TextInsert-types!");
      }
      TextInsert.__super__.constructor.call(this, uid, prev, next, origin);
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
        'type': "TextInsert",
        'uid': this.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid()
      };
      if (((_ref = this.content) != null ? _ref.getUid : void 0) != null) {
        json['content'] = this.content.getUid();
      } else {
        json['content'] = this.content;
      }
      if (this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return TextInsert;

  })(types.Insert);
  parser["TextInsert"] = function(json) {
    var content, next, origin, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new TextInsert(content, uid, prev, next, origin);
  };
  WordType = (function(_super) {
    __extends(WordType, _super);

    function WordType(uid, beginning, end, prev, next, origin) {
      this.textfields = [];
      WordType.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
    }

    WordType.prototype.type = "WordType";

    WordType.prototype.applyDelete = function() {
      var o, textfield, _i, _len, _ref;
      _ref = this.textfields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        textfield = _ref[_i];
        textfield.onkeypress = null;
        textfield.onpaste = null;
        textfield.oncut = null;
      }
      o = this.beginning;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
      }
      return WordType.__super__.applyDelete.call(this);
    };

    WordType.prototype.cleanup = function() {
      return WordType.__super__.cleanup.call(this);
    };

    WordType.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, content);
    };

    WordType.prototype.insertAfter = function(left, content) {
      var c, right, tmp, _i, _len;
      while (left.isDeleted()) {
        left = left.prev_cl;
      }
      right = left.next_cl;
      if (content.type != null) {
        (new TextInsert(content, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = content.length; _i < _len; _i++) {
          c = content[_i];
          tmp = (new TextInsert(c, void 0, left, right)).execute();
          left = tmp;
        }
      }
      return this;
    };

    WordType.prototype.insertText = function(position, content) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, content);
    };

    WordType.prototype.deleteText = function(position, length) {
      var d, delete_ops, i, o, _i;
      o = this.getOperationByPosition(position + 1);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof types.Delimiter) {
          break;
        }
        d = (new TextDelete(void 0, o)).execute();
        o = o.next_cl;
        while (!(o instanceof types.Delimiter) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return this;
    };

    WordType.prototype.val = function() {
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

    WordType.prototype.toString = function() {
      return this.val();
    };

    WordType.prototype.bind = function(textfield) {
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
          word.deleteText(pos, diff);
          word.insertText(pos, char);
          new_pos = pos + char.length;
          textfield.setSelectionRange(new_pos, new_pos);
          return event.preventDefault();
        } else {
          return event.preventDefault();
        }
      };
      textfield.onpaste = function(event) {
        return event.preventDefault();
      };
      textfield.oncut = function(event) {
        return event.preventDefault();
      };
      return textfield.onkeydown = function(event) {
        var del_length, diff, new_pos, pos, val;
        pos = Math.min(textfield.selectionStart, textfield.selectionEnd);
        diff = Math.abs(textfield.selectionEnd - textfield.selectionStart);
        if ((event.keyCode != null) && event.keyCode === 8) {
          if (diff > 0) {
            word.deleteText(pos, diff);
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
              word.deleteText(new_pos, pos - new_pos);
              textfield.setSelectionRange(new_pos, new_pos);
            } else {
              word.deleteText(pos - 1, 1);
            }
          }
          return event.preventDefault();
        } else if ((event.keyCode != null) && event.keyCode === 46) {
          if (diff > 0) {
            word.deleteText(pos, diff);
            textfield.setSelectionRange(pos, pos);
          } else {
            word.deleteText(pos, 1);
            textfield.setSelectionRange(pos, pos);
          }
          return event.preventDefault();
        }
      };
    };

    WordType.prototype._encode = function() {
      var json;
      json = {
        'type': "WordType",
        'uid': this.getUid(),
        'beginning': this.beginning.getUid(),
        'end': this.end.getUid()
      };
      if (this.prev_cl != null) {
        json['prev'] = this.prev_cl.getUid();
      }
      if (this.next_cl != null) {
        json['next'] = this.next_cl.getUid();
      }
      if (this.origin != null) {
        json["origin"] = this.origin().getUid();
      }
      return json;
    };

    return WordType;

  })(types.ListManager);
  parser['WordType'] = function(json) {
    var beginning, end, next, origin, prev, uid;
    uid = json['uid'], beginning = json['beginning'], end = json['end'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new WordType(uid, beginning, end, prev, next, origin);
  };
  types['TextInsert'] = TextInsert;
  types['TextDelete'] = TextDelete;
  types['WordType'] = WordType;
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
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        return this.val = this.parentElement.val.val(this.name, this.val).val(this.name);
      } else if (this.val.type === "JsonType") {
        return bindToChildren(this);
      } else if (this.val !== this.parentElement.val.val(this.name)) {
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
      this.engine = new Engine(this.HB, type_manager.parser);
      adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
      Yatta.__super__.constructor.apply(this, arguments);
    }

    Yatta.prototype.getConnector = function() {
      return this.connector;
    };

    return Yatta;

  })(types.JsonType);
  return new Yatta(HB.getReservedUniqueIdentifier()).execute();
};

module.exports = createYatta;

if ((typeof window !== "undefined" && window !== null) && (window.Yatta == null)) {
  window.Yatta = createYatta;
}


},{"./ConnectorAdapter":1,"./Engine":2,"./HistoryBuffer":3,"./Types/JsonTypes":5}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL0Nvbm5lY3RvckFkYXB0ZXIuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9saWIvVHlwZXMvQmFzaWNUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL0pzb25UeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1N0cnVjdHVyZWRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1RleHRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL3lhdHRhLWVsZW1lbnQuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi95YXR0YS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNPQSxJQUFBLGNBQUE7O0FBQUEsY0FBQSxHQUFpQixTQUFDLFNBQUQsRUFBWSxNQUFaLEVBQW9CLEVBQXBCLEVBQXdCLGtCQUF4QixHQUFBO0FBQ2YsTUFBQSxnRkFBQTtBQUFBLEVBQUEsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixLQUFpQixFQUFFLENBQUMsU0FBSCxDQUFBLENBQWpCLElBQW9DLENBQUMsTUFBQSxDQUFBLENB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QUFBLGVBQUEsR0FBQTtBQUNYLE1BQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxTQUFiLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxFQUFELEdBQU0sRUFETixDQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsS0FBRCxHQUFTLEtBRlQsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLE1BQUQsR0FBYyxJQUFBLE1BQUEsQ0FBTyxJQUFDLENBQUEsRUFBUixFQUFZLFlBQVksQ0FBQyxNQUF6QixDQUhkLENBQUE7QUFBQSxNQUlBLGNBQUEsQ0FBZSxJQUFDLENBQUEsU0FBaEIsRUFBMkIsSUFBQyxDQUFBLE1BQTVCLEVBQW9DLElBQUMsQ0FBQSxFQUFyQyxFQUF5QyxZQUFZLENBQUMsa0JBQXRELENBSkEsQ0FBQTtBQUFBLE1BS0Esd0NBQUEsU0FBQSxDQUxBLENBRFc7SUFBQSxDQUFiOztBQUFBLG9CQVFBLFlBQUEsR0FBYyxTQUFBLEdBQUE7YUFDWixJQUFDLENBQUEsVUFEVztJQUFBLENBUmQsQ0FBQTs7aUJBQUE7O0tBTmtCLEtBQUssQ0FBQyxTQW5CMUIsQ0FBQTtBQW9DQSxTQUFXLElBQUEsS0FBQSxDQUFNLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQU4sQ0FBdUMsQ0FBQyxPQUF4QyxDQUFBLENBQVgsQ0FyQ1k7QUFBQSxDQUxkLENBQUE7O0FBQUEsTUE0Q00sQ0FBQyxPQUFQLEdBQWlCLFdBNUNqQixDQUFBOztBQTZDQSxJQUFHLGtEQUFBLElBQWdCLHNCQUFuQjtBQUNFLEVBQUEsTUFBTSxDQUFDLEtBQVAsR0FBZSxXQUFmLENBREY7Q0E3Q0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5cbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBzZW5kU3RhdGVWZWN0b3IgPSAoKS0+XG4gICAgZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcblxuICBzZW5kSGIgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHBhcnNlX3N0YXRlX3ZlY3RvciB2XG4gICAganNvbiA9XG4gICAgICBoYjogSEIuX2VuY29kZShzdGF0ZV92ZWN0b3IpXG4gICAgICBzdGF0ZV92ZWN0b3I6IGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG4gICAganNvblxuXG4gIGFwcGx5SGIgPSAocmVzKS0+XG4gICAgSEIucmVuZXdTdGF0ZVZlY3RvciBwYXJzZV9zdGF0ZV92ZWN0b3IgcmVzLnN0YXRlX3ZlY3RvclxuICAgIGVuZ2luZS5hcHBseU9wc0NoZWNrRG91YmxlIHJlcy5oYlxuXG4gIGNvbm5lY3Rvci53aGVuU3luY2luZyBzZW5kU3RhdGVWZWN0b3IsIHNlbmRIYiwgYXBwbHlIYlxuXG4gIGNvbm5lY3Rvci53aGVuUmVjZWl2aW5nIChzZW5kZXIsIG9wKS0+XG4gICAgaWYgb3AudWlkLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgZW5naW5lLmFwcGx5T3Agb3BcblxuICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG5tb2R1bGUuZXhwb3J0cyA9IGFkYXB0Q29ubmVjdG9yIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge0FycmF5fSBwYXJzZXIgRGVmaW5lcyBob3cgdG8gcGFyc2UgZW5jb2RlZCBtZXNzYWdlcy5cbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHBhcnNlciktPlxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxuXG4gICNcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cbiAgI1xuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cbiAgICB0eXBlUGFyc2VyID0gQHBhcnNlcltqc29uLnR5cGVdXG4gICAgaWYgdHlwZVBhcnNlcj9cbiAgICAgIHR5cGVQYXJzZXIganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcblxuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxuICAjIEBub3RlIFlvdSBtdXN0IG5vdCB1c2UgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYWxyZWFkeSBoYXZlIG9wcyBpbiB5b3VyIEhCIVxuICAjIyNcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxuICAgIG9wcyA9IFtdXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXG4gICAgZm9yIG8gaW4gb3BzXG4gICAgICBpZiBub3Qgby5leGVjdXRlKClcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuICAjIyNcblxuICAjXG4gICMgU2FtZSBhcyBhcHBseU9wcyBidXQgb3BlcmF0aW9ucyB0aGF0IGFyZSBhbHJlYWR5IGluIHRoZSBIQiBhcmUgbm90IGFwcGxpZWQuXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcbiAgI1xuICBhcHBseU9wc0NoZWNrRG91YmxlOiAob3BzX2pzb24pLT5cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xuICAgICAgICBAYXBwbHlPcCBvXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIChIZWxwZXIgZm9yIHVzaW5nIGFwcGx5T3Agb24gQXJyYXlzKVxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxuICAgIEBhcHBseU9wIG9wc19qc29uXG5cbiAgI1xuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cbiAgIyBUT0RPOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhIVxuICAjIC0gb3BlcmF0aW9ucyBtYXkgb25seSBleGVjdXRlZCBpbiBvcmRlciBieSBjcmVhdG9yLCBvcmRlciB0aGVtIGluIG9iamVjdCBvZiBhcnJheXMgKGtleSBieSBjcmVhdG9yKVxuICAjIC0geW91IGNhbiBwcm9iYWJseSBtYWtlIHNvbWV0aGluZyBsaWtlIGRlcGVuZGVuY2llcyAoY3JlYXRvcjEgd2FpdHMgZm9yIGNyZWF0b3IyKVxuICBhcHBseU9wOiAob3BfanNvbl9hcnJheSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xuICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvKT9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgb3IgKG5vdCBvLmV4ZWN1dGUoKSlcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICAgICAgd2luZG93Py51bnByb2Nlc3NlZF90eXBlcy5wdXNoIG8udHlwZSAjIFRPRE86IGRlbGV0ZSB0aGlzXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcblxuICAjXG4gICMgQ2FsbCB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhcHBsaWVkIGEgbmV3IG9wZXJhdGlvbi5cbiAgIyBJdCBjaGVja3MgaWYgb3BlcmF0aW9ucyB0aGF0IHdlcmUgcHJldmlvdXNseSBub3QgZXhlY3V0YWJsZSBhcmUgbm93IGV4ZWN1dGFibGUuXG4gICNcbiAgdHJ5VW5wcm9jZXNzZWQ6ICgpLT5cbiAgICB3aGlsZSB0cnVlXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcbiAgICAgIHVucHJvY2Vzc2VkID0gW11cbiAgICAgIGZvciBvcCBpbiBAdW5wcm9jZXNzZWRfb3BzXG4gICAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24ob3ApP1xuICAgICAgICAgICMgbm9wXG4gICAgICAgIGVsc2UgaWYgKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvcCkpIG9yIChub3Qgb3AuZXhlY3V0ZSgpKVxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxuICAgICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXMgb2xkX2xlbmd0aFxuICAgICAgICBicmVha1xuICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzbnQgMFxuICAgICAgQEhCLmludm9rZVN5bmMoKVxuXG5cbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCJcbiNcbiMgQG5vZG9jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cbiAgICBAZ2FyYmFnZSA9IFtdICMgV2lsbCBiZSBjbGVhbmVkIG9uIG5leHQgY2FsbCBvZiBnYXJiYWdlQ29sbGVjdG9yXG4gICAgQHRyYXNoID0gW10gIyBJcyBkZWxldGVkLiBXYWl0IHVudGlsIGl0IGlzIG5vdCB1c2VkIGFueW1vcmUuXG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IHRydWVcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gMjAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBvLnVpZC5jcmVhdG9yID0gaWRcbiAgICAgIGlmIEBidWZmZXJbaWRdP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgYXJlIHJlLWFzc2lnbmluZyBhbiBvbGQgdXNlciBpZCAtIHRoaXMgaXMgbm90ICh5ZXQpIHBvc3NpYmxlIVwiXG4gICAgICBAYnVmZmVyW2lkXSA9IG93blxuICAgICAgZGVsZXRlIEBidWZmZXJbQHVzZXJfaWRdXG5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxuICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgICBkb1N5bmM6IGZhbHNlXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiBvLnVpZC5kb1N5bmMgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICAjIGl0cyBuZWNlc3NhcnkgdG8gc2VuZCBpdCwgYW5kIG5vdCBrbm93biBpbiBzdGF0ZV92ZWN0b3JcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD8gIyBhcHBsaWVzIGZvciBhbGwgb3BzIGJ1dCB0aGUgbW9zdCByaWdodCBkZWxpbWl0ZXIhXG4gICAgICAgICAgICAjIHNlYXJjaCBmb3IgdGhlIG5leHQgX2tub3duXyBvcGVyYXRpb24uIChXaGVuIHN0YXRlX3ZlY3RvciBpcyB7fSB0aGVuIHRoaXMgaXMgdGhlIERlbGltaXRlcilcbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC51aWQuY3JlYXRvciwgb19uZXh0LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fbmV4dCA9IG9fbmV4dC5uZXh0X2NsXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsPyAjIG1vc3QgcmlnaHQgZGVsaW1pdGVyIG9ubHkhXG4gICAgICAgICAgICAjIHNhbWUgYXMgdGhlIGFib3ZlIHdpdGggcHJldi5cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fcHJldi51aWQuY3JlYXRvciwgb19wcmV2LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fcHJldiA9IG9fcHJldi5wcmV2X2NsXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxuICAgICAgICAgIGpzb24ucHVzaCBvX2pzb25cblxuICAgIGpzb25cblxuICAjXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXG4gICMgQWNjb3JkaW5nbHkgeW91IHdpbGwgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBudW1iZXIgdGhhdCBpcyBleHBlY3RlZCBmcm9tIHRoYXQgdXNlci5cbiAgIyBUaGlzIHdpbGwgaW5jcmVtZW50IHRoZSBvcGVyYXRpb24gY291bnRlci5cbiAgI1xuICBnZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0gPSAwXG4gICAgdWlkID1cbiAgICAgICdjcmVhdG9yJyA6IHVzZXJfaWRcbiAgICAgICdvcF9udW1iZXInIDogQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG4gICAgICAnZG9TeW5jJyA6IHRydWVcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxuXG4gICNcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XG4gICMgb3RoZXIgb3BlcmF0aW9ucyAoaXQgd29udCBleGVjdXRlZClcbiAgI1xuICBhZGRPcGVyYXRpb246IChvKS0+XG4gICAgaWYgbm90IEBidWZmZXJbby51aWQuY3JlYXRvcl0/XG4gICAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdID0ge31cbiAgICBpZiBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgb3ZlcndyaXRlIG9wZXJhdGlvbnMhXCJcbiAgICBpZiAoby51aWQub3BfbnVtYmVyLmNvbnN0cnVjdG9yIGlzbnQgU3RyaW5nKSBhbmQgKG5vdCBAaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0/KSBvciAoQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdIDwgc3RhdGVfdmVjdG9yW3VzZXJdKVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA9IDBcbiAgICBpZiB0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzICdudW1iZXInIGFuZCBvLnVpZC5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcbiAgICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIGVsc2VcbiAgICAgICAgQGludm9rZVN5bmMgby51aWQuY3JlYXRvclxuXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSBpc250IChvLnVpZC5vcF9udW1iZXIgKyAxKVxuICAgICAgI2NvbnNvbGUubG9nIChAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gLSAoby51aWQub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgcGFyc2VyID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wZXJhdGlvbnMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyAqIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXSAjIFRPRE86IHJlbmFtZSB0byBvYnNlcnZlcnMgb3Igc3RoIGxpa2UgdGhhdFxuICAgICAgaWYgdWlkP1xuICAgICAgICBAdWlkID0gdWlkXG5cbiAgICB0eXBlOiBcIkluc2VydFwiXG5cbiAgICAjXG4gICAgIyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIuIEl0IGRlcGVuZHMgb24gdGhlIG9wZXJhdGlvbiB3aGljaCBldmVudHMgYXJlIHN1cHBvcnRlZC5cbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cbiAgICAjXG4gICAgb2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcbiAgICAjIEBzZWUgT3BlcmF0aW9uLm9ic2VydmVcbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxuICAgICMgICBAcGFyYW0gZiAgICAge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdGhhdCB5b3Ugd2FudCB0byBkZWxldGUgXG4gICAgdW5vYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IEBldmVudF9saXN0ZW5lcnMuZmlsdGVyIChnKS0+XG4gICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGFsbCBzdWJzY3JpYmVkIGV2ZW50IGxpc3RlbmVycy5cbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxuICAgICMgKFRoZW4gb25seSBvbmUgcmVwbGFjZSBldmVudCBzaG91bGQgZmlyZS4gKVxuICAgICMgVGhpcyBpcyBhbHNvIGNhbGxlZCBpbiB0aGUgY2xlYW51cCBtZXRob2QuXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW11cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XG4gICAgY2FsbEV2ZW50OiAoKS0+XG4gICAgICBAZm9yd2FyZEV2ZW50IEAsIGFyZ3VtZW50cy4uLlxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgdGhpcyA/XG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGFyZ3MuLi4pLT5cbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcbiAgICAgICAgZi5jYWxsIG9wLCBhcmdzLi4uXG5cbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIEBpc19kZWxldGVkXG5cbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxuICAgICAgaWYgbm90IEBnYXJiYWdlX2NvbGxlY3RlZFxuICAgICAgICAjY29uc29sZS5sb2cgXCJhcHBseURlbGV0ZTogI3tAdHlwZX1cIlxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcbiAgICAgICAgaWYgZ2FyYmFnZWNvbGxlY3RcbiAgICAgICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSB0cnVlXG4gICAgICAgICAgSEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEhCLnJlbW92ZU9wZXJhdGlvbiBAXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChAcGFyZW50KS0+XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcGFyZW50XG5cbiAgICAjXG4gICAgIyBDb21wdXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpIHRoYXQgaWRlbnRpZmllcyB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0VWlkOiAoKS0+XG4gICAgICBAdWlkXG5cbiAgICBkb250U3luYzogKCktPlxuICAgICAgQHVpZC5kb1N5bmMgPSBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAjIFdoZW4gdGhpcyBvcGVyYXRpb24gd2FzIGNyZWF0ZWQgd2l0aG91dCBhIHVpZCwgdGhlbiBzZXQgaXQgaGVyZS5cbiAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICBAdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgSEIuYWRkT3BlcmF0aW9uIEBcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiRGVsZXRlXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJlcyA9IHN1cGVyXG4gICAgICAgIGlmIHJlc1xuICAgICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgcmVzXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgI1xuICAjIERlZmluZSBob3cgdG8gcGFyc2UgRGVsZXRlIG9wZXJhdGlvbnMuXG4gICNcbiAgcGFyc2VyWydEZWxldGUnXSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyBEZWxldGUgdWlkLCBkZWxldGVzX3VpZFxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcbiAgI1xuICBjbGFzcyBJbnNlcnQgZXh0ZW5kcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkluc2VydFwiXG5cbiAgICAjXG4gICAgIyBzZXQgY29udGVudCB0byBudWxsIGFuZCBvdGhlciBzdHVmZlxuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgY2FsbExhdGVyID0gZmFsc2VcbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzRGVsZXRlZCgpIGFuZCBvPyAjIG8/IDogaWYgbm90IG8/LCB0aGVuIHRoZSBkZWxpbWl0ZXIgZGVsZXRlZCB0aGlzIEluc2VydGlvbi4gRnVydGhlcm1vcmUsIGl0IHdvdWxkIGJlIHdyb25nIHRvIGNhbGwgaXQuIFRPRE86IG1ha2UgdGhpcyBtb3JlIGV4cHJlc3NpdmUgYW5kIHNhdmVcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXG4gICAgICAgIGNhbGxMYXRlciA9IHRydWVcbiAgICAgIGlmIG8/XG4gICAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgZ2FyYmFnZWNvbGxlY3QgPSBmYWxzZVxuICAgICAgaWYgbm90IChAcHJldl9jbD8gYW5kIEBuZXh0X2NsPykgb3IgQHByZXZfY2wuaXNEZWxldGVkKClcbiAgICAgICAgZ2FyYmFnZWNvbGxlY3QgPSB0cnVlXG4gICAgICBzdXBlciBnYXJiYWdlY29sbGVjdFxuICAgICAgaWYgY2FsbExhdGVyXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHMobylcbiAgICAgIGlmIEBuZXh0X2NsPy5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICMgVE9ETzogRGVidWdnaW5nXG4gICAgICBpZiBAcHJldl9jbD8uaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJsZWZ0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGRlbGV0ZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcbiAgICAgICAgc3VwZXJcblxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IEBnZXREaXN0YW5jZVRvT3JpZ2luKCkgIyBtb3N0IGNhc2VzOiAwXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBpID0gZGlzdGFuY2VfdG9fb3JpZ2luICMgbG9vcCBjb3VudGVyXG5cbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgICAgICMgICAgICAgICBsZXQgJE9MPSBbbzEsbzIsbzMsbzRdLCB3aGVyZWJ5ICR0aGlzIGlzIHRvIGJlIGluc2VydGVkIGJldHdlZW4gbzEgYW5kIG80XG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICAgICAjICAgICAgICAgdGhlbiBvMiBrbm93cyBvMy4gU2luY2Ugb24gYW5vdGhlciBjbGllbnQgJE9MIGNvdWxkIGJlIFtvMSxvMyxvNF0gdGhlIHByb2JsZW0gaXMgY29tcGxleFxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgIGlmIGN1cnJlbnQgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uID4gJG8gb3JpZ2luOiAkdGhpcyBpbnNcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxuICAgICAgICAgICMgICAgICAgICAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgICAgICMgY2FzZSAzOiAkb3JpZ2luID4gJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcblxuICAgICAgICBAc2V0UGFyZW50IEBwcmV2X2NsLmdldFBhcmVudCgpICMgZG8gSW5zZXJ0aW9ucyBhbHdheXMgaGF2ZSBhIHBhcmVudD9cbiAgICAgICAgc3VwZXIgIyBub3RpZnkgdGhlIGV4ZWN1dGlvbl9saXN0ZW5lcnNcbiAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cygpXG4gICAgICAgIEBcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKCktPlxuICAgICAgQHBhcmVudD8uY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJpbnNlcnRcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50XG4gICAgICAgIGNoYW5nZWRCeTogQHVpZC5jcmVhdG9yXG4gICAgICAgIHZhbHVlOiBAY29udGVudFxuICAgICAgXVxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAobyktPlxuICAgICAgQHBhcmVudC5jYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXG4gICAgICAgIHBvc2l0aW9uOiBAZ2V0UG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBwYXJlbnQgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxuICAgICAgICBsZW5ndGg6IDFcbiAgICAgICAgY2hhbmdlZEJ5OiBvLnVpZC5jcmVhdG9yXG4gICAgICBdXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBEZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBub3QgcHJldi5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uKytcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxuICAgICAgcG9zaXRpb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgRGVmaW5lcyBhbiBvYmplY3QgdGhhdCBpcyBjYW5ub3QgYmUgY2hhbmdlZC4gWW91IGNhbiB1c2UgdGhpcyB0byBzZXQgYW4gaW1tdXRhYmxlIHN0cmluZywgb3IgYSBudW1iZXIuXG4gICNcbiAgY2xhc3MgSW1tdXRhYmxlT2JqZWN0IGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gY29udGVudFxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgQGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIHR5cGU6IFwiSW1tdXRhYmxlT2JqZWN0XCJcblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiSW1tdXRhYmxlT2JqZWN0XCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2NvbnRlbnQnIDogQGNvbnRlbnRcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyAjIGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4oKS5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnSW1tdXRhYmxlT2JqZWN0J10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBJbW11dGFibGVPYmplY3QgdWlkLCBjb250ZW50LCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyBEZWxpbWl0ZXIgZXh0ZW5kcyBPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xuICAgICAgICBzdXBlclxuICAgICAgI2Vsc2VcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkRlbGltaXRlclwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0RlbGltaXRlciddID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IERlbGltaXRlciB1aWQsIHByZXYsIG5leHRcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDpcbiAgICAgICdEZWxldGUnIDogRGVsZXRlXG4gICAgICAnSW5zZXJ0JyA6IEluc2VydFxuICAgICAgJ0RlbGltaXRlcic6IERlbGltaXRlclxuICAgICAgJ09wZXJhdGlvbic6IE9wZXJhdGlvblxuICAgICAgJ0ltbXV0YWJsZU9iamVjdCcgOiBJbW11dGFibGVPYmplY3RcbiAgICAncGFyc2VyJyA6IHBhcnNlclxuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cblxuXG5cblxuIiwidGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVGV4dFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgdGV4dF90eXBlcyA9IHRleHRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHRleHRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gdGV4dF90eXBlcy5wYXJzZXJcblxuICBjcmVhdGVKc29uVHlwZVdyYXBwZXIgPSAoX2pzb25UeXBlKS0+XG5cbiAgICAjXG4gICAgIyBAbm90ZSBFWFBFUklNRU5UQUxcbiAgICAjXG4gICAgIyBBIEpzb25UeXBlV3JhcHBlciB3YXMgaW50ZW5kZWQgdG8gYmUgYSBjb252ZW5pZW50IHdyYXBwZXIgZm9yIHRoZSBKc29uVHlwZS5cbiAgICAjIEJ1dCBpdCBjYW4gbWFrZSB0aGluZ3MgbW9yZSBkaWZmaWN1bHQgdGhhbiB0aGV5IGFyZS5cbiAgICAjIEBzZWUgSnNvblR5cGVcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBjcmVhdGUgYSBKc29uVHlwZVdyYXBwZXJcbiAgICAjICAgIyBZb3UgZ2V0IGEgSnNvblR5cGVXcmFwcGVyIGZyb20gYSBKc29uVHlwZSBieSBjYWxsaW5nXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICNcbiAgICAjIEl0IGNyZWF0ZXMgSmF2YXNjcmlwdHMgLWdldHRlciBhbmQgLXNldHRlciBtZXRob2RzIGZvciBlYWNoIHByb3BlcnR5IHRoYXQgSnNvblR5cGUgbWFpbnRhaW5zLlxuICAgICMgQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvZGVmaW5lUHJvcGVydHlcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBHZXR0ZXIgRXhhbXBsZVxuICAgICMgICAjIHlvdSBjYW4gYWNjZXNzIHRoZSB4IHByb3BlcnR5IG9mIHlhdHRhIGJ5IGNhbGxpbmdcbiAgICAjICAgdy54XG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnKVxuICAgICNcbiAgICAjIEBub3RlIFlvdSBjYW4gb25seSBvdmVyd3JpdGUgZXhpc3RpbmcgdmFsdWVzISBTZXR0aW5nIGEgbmV3IHByb3BlcnR5IHdvbid0IGhhdmUgYW55IGVmZmVjdCFcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBTZXR0ZXIgRXhhbXBsZVxuICAgICMgICAjIHlvdSBjYW4gc2V0IGFuIGV4aXN0aW5nIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnggPSBcInRleHRcIlxuICAgICMgICAjIGluc3RlYWQgb2ZcbiAgICAjICAgeWF0dGEudmFsKCd4JywgXCJ0ZXh0XCIpXG4gICAgI1xuICAgICMgSW4gb3JkZXIgdG8gc2V0IGEgbmV3IHByb3BlcnR5IHlvdSBoYXZlIHRvIG92ZXJ3cml0ZSBhbiBleGlzdGluZyBwcm9wZXJ0eS5cbiAgICAjIFRoZXJlZm9yZSB0aGUgSnNvblR5cGVXcmFwcGVyIHN1cHBvcnRzIGEgc3BlY2lhbCBmZWF0dXJlIHRoYXQgc2hvdWxkIG1ha2UgdGhpbmdzIG1vcmUgY29udmVuaWVudFxuICAgICMgKHdlIGNhbiBhcmd1ZSBhYm91dCB0aGF0LCB1c2UgdGhlIEpzb25UeXBlIGlmIHlvdSBkb24ndCBsaWtlIGl0IDspLlxuICAgICMgSWYgeW91IG92ZXJ3cml0ZSBhbiBvYmplY3QgcHJvcGVydHkgb2YgdGhlIEpzb25UeXBlV3JhcHBlciB3aXRoIGEgbmV3IG9iamVjdCwgaXQgd2lsbCByZXN1bHQgaW4gYSBtZXJnZWQgdmVyc2lvbiBvZiB0aGUgb2JqZWN0cy5cbiAgICAjIExldCBgeWF0dGEudmFsdWUucGAgdGhlIHByb3BlcnR5IHRoYXQgaXMgdG8gYmUgb3ZlcndyaXR0ZW4gYW5kIG8gdGhlIG5ldyB2YWx1ZS4gRS5nLiBgeWF0dGEudmFsdWUucCA9IG9gXG4gICAgIyAqIFRoZSByZXN1bHQgaGFzIGFsbCBwcm9wZXJ0aWVzIG9mIG9cbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygdy5wIGlmIHRoZXkgZG9uJ3Qgb2NjdXIgdW5kZXIgdGhlIHNhbWUgcHJvcGVydHktbmFtZSBpbiBvLlxuICAgICNcbiAgICAjIEBleGFtcGxlIENvbmZsaWN0IEV4YW1wbGVcbiAgICAjICAgeWF0dGEudmFsdWUgPSB7YSA6IFwic3RyaW5nXCJ9XG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdy5hID0ge2EgOiB7YiA6IFwic3RyaW5nXCJ9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wifX1cbiAgICAjICAgdy5hID0ge2EgOiB7YyA6IDR9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wiLCBjIDogNH19XG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29tbW9uIFBpdGZhbGxzXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICAjIFNldHRpbmcgYSBuZXcgcHJvcGVydHlcbiAgICAjICAgdy5uZXdQcm9wZXJ0eSA9IFwiQXdlc29tZVwiXG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgZmFsc2UsIHcubmV3UHJvcGVydHkgaXMgdW5kZWZpbmVkXG4gICAgIyAgICMgb3ZlcndyaXRlIHRoZSB3IG9iamVjdFxuICAgICMgICB3ID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSEsIGJ1dCAuLlxuICAgICMgICBjb25zb2xlLmxvZyh5YXR0YS52YWx1ZS5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgeW91IGFyZSBvbmx5IGFsbG93ZWQgdG8gc2V0IHByb3BlcnRpZXMhXG4gICAgIyAgICMgVGhlIHNvbHV0aW9uXG4gICAgIyAgIHlhdHRhLnZhbHVlID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSFcbiAgICAjXG4gICAgY2xhc3MgSnNvblR5cGVXcmFwcGVyXG5cbiAgICAgICNcbiAgICAgICMgQHBhcmFtIHtKc29uVHlwZX0ganNvblR5cGUgSW5zdGFuY2Ugb2YgdGhlIEpzb25UeXBlIHRoYXQgdGhpcyBjbGFzcyB3cmFwcGVzLlxuICAgICAgI1xuICAgICAgY29uc3RydWN0b3I6IChqc29uVHlwZSktPlxuICAgICAgICBmb3IgbmFtZSwgb2JqIG9mIGpzb25UeXBlLm1hcFxuICAgICAgICAgIGRvIChuYW1lLCBvYmopLT5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBKc29uVHlwZVdyYXBwZXIucHJvdG90eXBlLCBuYW1lLFxuICAgICAgICAgICAgICBnZXQgOiAtPlxuICAgICAgICAgICAgICAgIHggPSBvYmoudmFsKClcbiAgICAgICAgICAgICAgICBpZiB4IGluc3RhbmNlb2YgSnNvblR5cGVcbiAgICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25UeXBlV3JhcHBlciB4XG4gICAgICAgICAgICAgICAgZWxzZSBpZiB4IGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgICAgICAgICB4LnZhbCgpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgeFxuICAgICAgICAgICAgICBzZXQgOiAobyktPlxuICAgICAgICAgICAgICAgIG92ZXJ3cml0ZSA9IGpzb25UeXBlLnZhbChuYW1lKVxuICAgICAgICAgICAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3IgYW5kIG92ZXJ3cml0ZSBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZS52YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAganNvblR5cGUudmFsKG5hbWUsIG8sICdpbW11dGFibGUnKVxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICBuZXcgSnNvblR5cGVXcmFwcGVyIF9qc29uVHlwZVxuXG4gICNcbiAgIyBNYW5hZ2VzIE9iamVjdC1saWtlIHZhbHVlcy5cbiAgI1xuICBjbGFzcyBKc29uVHlwZSBleHRlbmRzIHR5cGVzLk1hcE1hbmFnZXJcblxuICAgICNcbiAgICAjIElkZW50aWZpZXMgdGhpcyBjbGFzcy5cbiAgICAjIFVzZSBpdCB0byBjaGVjayB3aGV0aGVyIHRoaXMgaXMgYSBqc29uLXR5cGUgb3Igc29tZXRoaW5nIGVsc2UuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHggPSB5YXR0YS52YWwoJ3Vua25vd24nKVxuICAgICMgICBpZiAoeC50eXBlID09PSBcIkpzb25UeXBlXCIpIHtcbiAgICAjICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSh4LnRvSnNvbigpKVxuICAgICMgICB9XG4gICAgI1xuICAgIHR5cGU6IFwiSnNvblR5cGVcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuXG4gICAgI1xuICAgICMgVHJhbnNmb3JtIHRoaXMgdG8gYSBKc29uLiBJZiB5b3VyIGJyb3dzZXIgc3VwcG9ydHMgT2JqZWN0Lm9ic2VydmUgaXQgd2lsbCBiZSB0cmFuc2Zvcm1lZCBhdXRvbWF0aWNhbGx5IHdoZW4gYSBjaGFuZ2UgYXJyaXZlcy5cbiAgICAjIE90aGVyd2lzZSB5b3Ugd2lsbCBsb29zZSBhbGwgdGhlIHNoYXJpbmctYWJpbGl0aWVzICh0aGUgbmV3IG9iamVjdCB3aWxsIGJlIGEgZGVlcCBjbG9uZSkhXG4gICAgIyBAcmV0dXJuIHtKc29ufVxuICAgICNcbiAgICAjIFRPRE86IGF0IHRoZSBtb21lbnQgeW91IGRvbid0IGNvbnNpZGVyIGNoYW5naW5nIG9mIHByb3BlcnRpZXMuXG4gICAgIyBFLmcuOiBsZXQgeCA9IHthOltdfS4gVGhlbiB4LmEucHVzaCAxIHdvdWxkbid0IGNoYW5nZSBhbnl0aGluZ1xuICAgICNcbiAgICB0b0pzb246ICgpLT5cbiAgICAgIGlmIG5vdCBAYm91bmRfanNvbj8gb3Igbm90IE9iamVjdC5vYnNlcnZlPyBvciB0cnVlICMgVE9ETzogY3VycmVudGx5LCB5b3UgYXJlIG5vdCB3YXRjaGluZyBtdXRhYmxlIHN0cmluZ3MgZm9yIGNoYW5nZXMsIGFuZCwgdGhlcmVmb3JlLCB0aGUgQGJvdW5kX2pzb24gaXMgbm90IHVwZGF0ZWQuIFRPRE8gVE9ETyAgd3Vhd3Vhd3VhIGVhc3lcbiAgICAgICAgdmFsID0gQHZhbCgpXG4gICAgICAgIGpzb24gPSB7fVxuICAgICAgICBmb3IgbmFtZSwgbyBvZiB2YWxcbiAgICAgICAgICBpZiBub3Qgbz9cbiAgICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICAgICAgZWxzZSBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAgICBqc29uW25hbWVdID0gQHZhbChuYW1lKS50b0pzb24oKVxuICAgICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAgd2hpbGUgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAgICBvID0gby52YWwoKVxuICAgICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBqc29uW25hbWVdID0gb1xuICAgICAgICBAYm91bmRfanNvbiA9IGpzb25cbiAgICAgICAgaWYgT2JqZWN0Lm9ic2VydmU/XG4gICAgICAgICAgdGhhdCA9IEBcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZSBAYm91bmRfanNvbiwgKGV2ZW50cyktPlxuICAgICAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgICAgICBpZiBub3QgZXZlbnQuY2hhbmdlZEJ5PyBhbmQgKGV2ZW50LnR5cGUgaXMgXCJhZGRcIiBvciBldmVudC50eXBlID0gXCJ1cGRhdGVcIilcbiAgICAgICAgICAgICAgICAjIHRoaXMgZXZlbnQgaXMgbm90IGNyZWF0ZWQgYnkgWWF0dGEuXG4gICAgICAgICAgICAgICAgdGhhdC52YWwoZXZlbnQubmFtZSwgZXZlbnQub2JqZWN0W2V2ZW50Lm5hbWVdKVxuICAgICAgICAgIEBvYnNlcnZlIChldmVudHMpLT5cbiAgICAgICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICAgICAgaWYgZXZlbnQuY3JlYXRlZF8gaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgICAgICAgICAgIG5vdGlmaWVyID0gT2JqZWN0LmdldE5vdGlmaWVyKHRoYXQuYm91bmRfanNvbilcbiAgICAgICAgICAgICAgICBvbGRWYWwgPSB0aGF0LmJvdW5kX2pzb25bZXZlbnQubmFtZV1cbiAgICAgICAgICAgICAgICBpZiBvbGRWYWw/XG4gICAgICAgICAgICAgICAgICBub3RpZmllci5wZXJmb3JtQ2hhbmdlICd1cGRhdGUnLCAoKS0+XG4gICAgICAgICAgICAgICAgICAgICAgdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdID0gdGhhdC52YWwoZXZlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgLCB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgIG5vdGlmaWVyLm5vdGlmeVxuICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IHRoYXQuYm91bmRfanNvblxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAndXBkYXRlJ1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBldmVudC5uYW1lXG4gICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRWYWxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlZEJ5OiBldmVudC5jaGFuZ2VkQnlcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5wZXJmb3JtQ2hhbmdlICdhZGQnLCAoKS0+XG4gICAgICAgICAgICAgICAgICAgICAgdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdID0gdGhhdC52YWwoZXZlbnQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgLCB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgIG5vdGlmaWVyLm5vdGlmeVxuICAgICAgICAgICAgICAgICAgICBvYmplY3Q6IHRoYXQuYm91bmRfanNvblxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYWRkJ1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBldmVudC5uYW1lXG4gICAgICAgICAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRWYWxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlZEJ5OmV2ZW50LmNoYW5nZWRCeVxuICAgICAgQGJvdW5kX2pzb25cblxuICAgICNcbiAgICAjIFdoZXRoZXIgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnICh0cnVlKSBvciAnaW1tdXRhYmxlJyAoZmFsc2UpXG4gICAgI1xuICAgIG11dGFibGVfZGVmYXVsdDpcbiAgICAgIHRydWVcblxuICAgICNcbiAgICAjIFNldCBpZiB0aGUgZGVmYXVsdCBpcyAnbXV0YWJsZScgb3IgJ2ltbXV0YWJsZSdcbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IG11dGFibGUgU2V0IGVpdGhlciAnbXV0YWJsZScgLyB0cnVlIG9yICdpbW11dGFibGUnIC8gZmFsc2VcbiAgICBzZXRNdXRhYmxlRGVmYXVsdDogKG11dGFibGUpLT5cbiAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICBKc29uVHlwZS5wcm90b3R5cGUubXV0YWJsZV9kZWZhdWx0ID0gdHJ1ZVxuICAgICAgZWxzZSBpZiBtdXRhYmxlIGlzIGZhbHNlIG9yIG11dGFibGUgaXMgJ2ltbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciAnU2V0IG11dGFibGUgZWl0aGVyIFwibXV0YWJsZVwiIG9yIFwiaW1tdXRhYmxlXCIhJ1xuICAgICAgJ09LJ1xuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbCgpXG4gICAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICAgIyAgIEByZXR1cm4gW0pzb25dXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAgICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZXxXb3JkVHlwZXxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICAgIGlmIG5hbWU/IGFuZCBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBtdXRhYmxlP1xuICAgICAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICAgICAgbXV0YWJsZSA9IHRydWVcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBtdXRhYmxlID0gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG11dGFibGUgPSBAbXV0YWJsZV9kZWZhdWx0XG4gICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdmdW5jdGlvbidcbiAgICAgICAgICBAICMgSnVzdCBkbyBub3RoaW5nXG4gICAgICAgIGVsc2UgaWYgKG5vdCBjb250ZW50Pykgb3IgKCgobm90IG11dGFibGUpIG9yIHR5cGVvZiBjb250ZW50IGlzICdudW1iZXInKSBhbmQgY29udGVudC5jb25zdHJ1Y3RvciBpc250IE9iamVjdClcbiAgICAgICAgICBzdXBlciBuYW1lLCAobmV3IHR5cGVzLkltbXV0YWJsZU9iamVjdCB1bmRlZmluZWQsIGNvbnRlbnQpLmV4ZWN1dGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ3N0cmluZydcbiAgICAgICAgICAgIHdvcmQgPSAobmV3IHR5cGVzLldvcmRUeXBlIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgICB3b3JkLmluc2VydFRleHQgMCwgY29udGVudFxuICAgICAgICAgICAgc3VwZXIgbmFtZSwgd29yZFxuICAgICAgICAgIGVsc2UgaWYgY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICAgIGpzb24gPSBuZXcgSnNvblR5cGUoKS5leGVjdXRlKClcbiAgICAgICAgICAgIGZvciBuLG8gb2YgY29udGVudFxuICAgICAgICAgICAgICBqc29uLnZhbCBuLCBvLCBtdXRhYmxlXG4gICAgICAgICAgICBzdXBlciBuYW1lLCBqc29uXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCAje3R5cGVvZiBjb250ZW50fS10eXBlcyBpbiBjb2xsYWJvcmF0aXZlIEpzb24tb2JqZWN0cyFcIlxuICAgICAgZWxzZVxuICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvblR5cGUucHJvdG90eXBlLCAndmFsdWUnLFxuICAgICAgZ2V0IDogLT4gY3JlYXRlSnNvblR5cGVXcmFwcGVyIEBcbiAgICAgIHNldCA6IChvKS0+XG4gICAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICAgIEB2YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBvbmx5IHNldCBPYmplY3QgdmFsdWVzIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiSnNvblR5cGVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnSnNvblR5cGUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICB9ID0ganNvblxuICAgIG5ldyBKc29uVHlwZSB1aWRcblxuXG5cblxuICB0eXBlc1snSnNvblR5cGUnXSA9IEpzb25UeXBlXG5cbiAgdGV4dF90eXBlc1xuXG5cbiIsImJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1R5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgYmFzaWNfdHlwZXMgPSBiYXNpY190eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gYmFzaWNfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gYmFzaWNfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgbWFwIGxpa2Ugb2JqZWN0cy4gRS5nLiBKc29uLVR5cGUgYW5kIFhNTCBhdHRyaWJ1dGVzLlxuICAjXG4gIGNsYXNzIE1hcE1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBtYXAgPSB7fVxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQG1hcFxuICAgICAgICBwLmFwcGx5RGVsZXRlKClcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBzZWUgSnNvblR5cGVzLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBpZiBub3QgQG1hcFtuYW1lXT9cbiAgICAgICAgICAobmV3IEFkZE5hbWUgdW5kZWZpbmVkLCBALCBuYW1lKS5leGVjdXRlKClcbiAgICAgICAgQG1hcFtuYW1lXS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBwcm9wID0gQG1hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgb2JqID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgICAgb2JqLnZhbCgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgb2JqXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICBvYmogPSBvLnZhbCgpXG4gICAgICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3QgIyBvciBvYmogaW5zdGFuY2VvZiBNYXBNYW5hZ2VyIFRPRE86IGRvIHlvdSB3YW50IGRlZXAganNvbj8gXG4gICAgICAgICAgICAgIG9iaiA9IG9iai52YWwoKVxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gb2JqXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQG1hcFtuYW1lXT8uZGVsZXRlQ29udGVudCgpXG4gICAgICBAXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBXaGVuIGEgbmV3IHByb3BlcnR5IGluIGEgbWFwIG1hbmFnZXIgaXMgY3JlYXRlZCwgdGhlbiB0aGUgdWlkcyBvZiB0aGUgaW5zZXJ0ZWQgT3BlcmF0aW9uc1xuICAjIG11c3QgYmUgdW5pcXVlICh0aGluayBhYm91dCBjb25jdXJyZW50IG9wZXJhdGlvbnMpLiBUaGVyZWZvcmUgb25seSBhbiBBZGROYW1lIG9wZXJhdGlvbiBpcyBhbGxvd2VkIHRvXG4gICMgYWRkIGEgcHJvcGVydHkgaW4gYSBNYXBNYW5hZ2VyLiBJZiB0d28gQWRkTmFtZSBvcGVyYXRpb25zIG9uIHRoZSBzYW1lIE1hcE1hbmFnZXIgbmFtZSBoYXBwZW4gY29uY3VycmVudGx5XG4gICMgb25seSBvbmUgd2lsbCBBZGROYW1lIG9wZXJhdGlvbiB3aWxsIGJlIGV4ZWN1dGVkLlxuICAjXG4gIGNsYXNzIEFkZE5hbWUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBtYXBfbWFuYWdlciBVaWQgb3IgcmVmZXJlbmNlIHRvIHRoZSBNYXBNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCB3aWxsIGJlIGFkZGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgbWFwX21hbmFnZXIsIEBuYW1lKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbWFwX21hbmFnZXInLCBtYXBfbWFuYWdlclxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkFkZE5hbWVcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIElmIG1hcF9tYW5hZ2VyIGRvZXNuJ3QgaGF2ZSB0aGUgcHJvcGVydHkgbmFtZSwgdGhlbiBhZGQgaXQuXG4gICAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgdGhhdCBpcyBiZWluZyB3cml0dGVuIG9uIHRoZSBwcm9wZXJ0eSBpcyB1bmlxdWVcbiAgICAjIGluIHN1Y2ggYSB3YXkgdGhhdCBpZiBBZGROYW1lIGlzIGV4ZWN1dGVkIChmcm9tIGFub3RoZXIgcGVlcikgaXQgd2lsbFxuICAgICMgYWx3YXlzIGhhdmUgdGhlIHNhbWUgcmVzdWx0IChSZXBsYWNlTWFuYWdlciwgYW5kIGl0cyBiZWdpbm5pbmcgYW5kIGVuZCBhcmUgdGhlIHNhbWUpXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgIyBoZWxwZXIgZm9yIGNsb25pbmcgYW4gb2JqZWN0XG4gICAgICAgIGNsb25lID0gKG8pLT5cbiAgICAgICAgICBwID0ge31cbiAgICAgICAgICBmb3IgbmFtZSx2YWx1ZSBvZiBvXG4gICAgICAgICAgICBwW25hbWVdID0gdmFsdWVcbiAgICAgICAgICBwXG4gICAgICAgIHVpZF9yID0gY2xvbmUoQG1hcF9tYW5hZ2VyLmdldFVpZCgpKVxuICAgICAgICB1aWRfci5kb1N5bmMgPSBmYWxzZVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gY2xvbmUodWlkX3IpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIiN7dWlkX3Iub3BfbnVtYmVyfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBjbG9uZSh1aWRfcilcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiI3t1aWRfci5vcF9udW1iZXJ9X2VuZFwiXG4gICAgICAgICAgYmVnID0gKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSAobmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgZXZlbnRfcHJvcGVydGllcyA9XG4gICAgICAgICAgICBuYW1lOiBAbmFtZVxuICAgICAgICAgIGV2ZW50X3RoaXMgPSBAbWFwX21hbmFnZXJcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXSA9IG5ldyBSZXBsYWNlTWFuYWdlciBldmVudF9wcm9wZXJ0aWVzLCBldmVudF90aGlzLCB1aWRfciwgYmVnLCBlbmRcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXS5zZXRQYXJlbnQgQG1hcF9tYW5hZ2VyLCBAbmFtZVxuICAgICAgICAgIChAbWFwX21hbmFnZXIubWFwW0BuYW1lXS5hZGRfbmFtZV9vcHMgPz0gW10pLnB1c2ggQFxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLmV4ZWN1dGUoKVxuICAgICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkFkZE5hbWVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnbWFwX21hbmFnZXInIDogQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICduYW1lJyA6IEBuYW1lXG4gICAgICB9XG5cbiAgcGFyc2VyWydBZGROYW1lJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdtYXBfbWFuYWdlcicgOiBtYXBfbWFuYWdlclxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICduYW1lJyA6IG5hbWVcbiAgICB9ID0ganNvblxuICAgIG5ldyBBZGROYW1lIHVpZCwgbWFwX21hbmFnZXIsIG5hbWVcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBMaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBpZiBiZWdpbm5pbmc/IGFuZCBlbmQ/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdiZWdpbm5pbmcnLCBiZWdpbm5pbmdcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2VuZCcsIGVuZFxuICAgICAgZWxzZVxuICAgICAgICBAYmVnaW5uaW5nID0gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICAgIEBlbmQgPSAgICAgICBuZXcgdHlwZXMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgICAgQGJlZ2lubmluZy5leGVjdXRlKClcbiAgICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIHJlc3VsdC5wdXNoIG9cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIG9yIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uIC09IDFcbiAgICAgIG9cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkVHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBXb3JkVHlwZVxuICAjXG4gIGNsYXNzIFJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgTGlzdE1hbmFnZXJcbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfcHJvcGVydGllcyBEZWNvcmF0ZXMgdGhlIGV2ZW50IHRoYXQgaXMgdGhyb3duIGJ5IHRoZSBSTVxuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3RoaXMgVGhlIG9iamVjdCBvbiB3aGljaCB0aGUgZXZlbnQgc2hhbGwgYmUgZXhlY3V0ZWRcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cbiAgICAgICAgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddID0gQGV2ZW50X3RoaXNcbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAjIGlmIHRoaXMgd2FzIGNyZWF0ZWQgYnkgYW4gQWRkTmFtZSBvcGVyYXRpb24sIGRlbGV0ZSBpdCB0b29cbiAgICAgIGlmIEBhZGRfbmFtZV9vcHM/XG4gICAgICAgIGZvciBvIGluIEBhZGRfbmFtZV9vcHNcbiAgICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIFRoaXMgZG9lc24ndCB0aHJvdyB0aGUgc2FtZSBldmVudHMgYXMgdGhlIExpc3RNYW5hZ2VyLiBUaGVyZWZvcmUsIHRoZVxuICAgICMgUmVwbGFjZWFibGVzIGFsc28gbm90IHRocm93IHRoZSBzYW1lIGV2ZW50cy5cbiAgICAjIFNvLCBSZXBsYWNlTWFuYWdlciBhbmQgTGlzdE1hbmFnZXIgYm90aCBpbXBsZW1lbnRcbiAgICAjIHRoZXNlIGZ1bmN0aW9ucyB0aGF0IGFyZSBjYWxsZWQgd2hlbiBhbiBJbnNlcnRpb24gaXMgZXhlY3V0ZWQgKGF0IHRoZSBlbmQpLlxuICAgICNcbiAgICAjXG4gICAgY2FsbEV2ZW50RGVjb3JhdG9yOiAoZXZlbnRzKS0+XG4gICAgICBpZiBub3QgQGlzRGVsZXRlZCgpXG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBmb3IgbmFtZSxwcm9wIG9mIEBldmVudF9wcm9wZXJ0aWVzXG4gICAgICAgICAgICBldmVudFtuYW1lXSA9IHByb3BcbiAgICAgICAgQGV2ZW50X3RoaXMuY2FsbEV2ZW50IGV2ZW50c1xuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgcmVscCA9IChuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2wpLmV4ZWN1dGUoKVxuICAgICAgIyBUT0RPOiBkZWxldGUgcmVwbCAoZm9yIGRlYnVnZ2luZylcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgaXNDb250ZW50RGVsZXRlZDogKCktPlxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxuXG4gICAgZGVsZXRlQ29udGVudDogKCktPlxuICAgICAgKG5ldyB0eXBlcy5EZWxldGUgdW5kZWZpbmVkLCBAZ2V0TGFzdE9wZXJhdGlvbigpLnVpZCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpcyBXb3JkVHlwZVxuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICAjaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlTWFuYWdlclwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAbmV4dF9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/ICMgVE9ETzogZG8gdGhpcyBldmVyeXdoZXJlOiBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luKCkuZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlTWFuYWdlclwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgfSA9IGpzb25cbiAgICBuZXcgUmVwbGFjZU1hbmFnZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBSZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBwcmV2LCBhbmQgbmV4dCBmb3IgUmVwbGFjZWFibGUtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VhYmxlXCJcblxuICAgICNcbiAgICAjIFJldHVybiB0aGUgY29udGVudCB0aGF0IHRoaXMgb3BlcmF0aW9uIGhvbGRzLlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgcmVzID0gc3VwZXJcbiAgICAgIGlmIEBjb250ZW50P1xuICAgICAgICBpZiBAbmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIEBjb250ZW50LmRlbGV0ZUFsbE9ic2VydmVycygpXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgICAgQGNvbnRlbnQuZG9udFN5bmMoKVxuICAgICAgQGNvbnRlbnQgPSBudWxsXG4gICAgICByZXNcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBUaGlzIGlzIGNhbGxlZCwgd2hlbiB0aGUgSW5zZXJ0LXR5cGUgd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjIFRPRE86IGNvbnNpZGVyIGRvaW5nIHRoaXMgaW4gYSBtb3JlIGNvbnNpc3RlbnQgbWFubmVyLiBUaGlzIGNvdWxkIGFsc28gYmVcbiAgICAjIGRvbmUgd2l0aCBleGVjdXRlLiBCdXQgY3VycmVudGx5LCB0aGVyZSBhcmUgbm8gc3BlY2l0YWwgSW5zZXJ0LXR5cGVzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCIgYW5kIEBwcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIG9sZF92YWx1ZSA9IEBwcmV2X2NsLmNvbnRlbnRcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcbiAgICAgICAgXVxuICAgICAgICBAcHJldl9jbC5hcHBseURlbGV0ZSgpXG4gICAgICBlbHNlIGlmIEBuZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgVGhpcyB3b24ndCBiZSByZWNvZ25pemVkIGJ5IHRoZSB1c2VyLCBiZWNhdXNlIGFub3RoZXJcbiAgICAgICAgIyBjb25jdXJyZW50IG9wZXJhdGlvbiBpcyBzZXQgYXMgdGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIFJNXG4gICAgICAgIEBhcHBseURlbGV0ZSgpXG4gICAgICBlbHNlICMgcHJldiBfYW5kXyBuZXh0IGFyZSBEZWxpbWl0ZXJzLiBUaGlzIGlzIHRoZSBmaXJzdCBjcmVhdGVkIFJlcGxhY2VhYmxlIGluIHRoZSBSTVxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJhZGRcIlxuICAgICAgICAgIGNoYW5nZWRCeTogQHVpZC5jcmVhdG9yXG4gICAgICAgIF1cbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAobyktPlxuICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBvLnVpZC5jcmVhdG9yXG4gICAgICAgICAgb2xkVmFsdWU6IEBjb250ZW50XG4gICAgICAgIF1cblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VhYmxlXCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50Py5nZXRVaWQoKVxuICAgICAgICAgICdyZXBsYWNlX21hbmFnZXInIDogQHBhcmVudC5nZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlJlcGxhY2VhYmxlXCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAncmVwbGFjZV9tYW5hZ2VyJyA6IHBhcmVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICB0eXBlc1snTGlzdE1hbmFnZXInXSA9IExpc3RNYW5hZ2VyXG4gIHR5cGVzWydNYXBNYW5hZ2VyJ10gPSBNYXBNYW5hZ2VyXG4gIHR5cGVzWydSZXBsYWNlTWFuYWdlciddID0gUmVwbGFjZU1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VhYmxlJ10gPSBSZXBsYWNlYWJsZVxuXG4gIGJhc2ljX3R5cGVzXG5cblxuXG5cblxuXG4iLCJzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9TdHJ1Y3R1cmVkVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBzdHJ1Y3R1cmVkX3R5cGVzID0gc3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gc3RydWN0dXJlZF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSBzdHJ1Y3R1cmVkX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBdCB0aGUgbW9tZW50IFRleHREZWxldGUgdHlwZSBlcXVhbHMgdGhlIERlbGV0ZSB0eXBlIGluIEJhc2ljVHlwZXMuXG4gICMgQHNlZSBCYXNpY1R5cGVzLkRlbGV0ZVxuICAjXG4gIGNsYXNzIFRleHREZWxldGUgZXh0ZW5kcyB0eXBlcy5EZWxldGVcbiAgcGFyc2VyW1wiVGV4dERlbGV0ZVwiXSA9IHBhcnNlcltcIkRlbGV0ZVwiXVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyBUZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgY29udGVudD8udWlkPy5jcmVhdG9yXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIlRleHRJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyICMgbm8gYnJhY2VzIGluZGVlZCFcbiAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAXG4gICAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIFRoZSByZXN1bHQgd2lsbCBiZSBjb25jYXRlbmF0ZWQgd2l0aCB0aGUgcmVzdWx0cyBmcm9tIHRoZSBvdGhlciBpbnNlcnQgb3BlcmF0aW9uc1xuICAgICMgaW4gb3JkZXIgdG8gcmV0cmlldmUgdGhlIGNvbnRlbnQgb2YgdGhlIGVuZ2luZS5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci50b0V4ZWN1dGVkQXJyYXlcbiAgICAjXG4gICAgdmFsOiAoY3VycmVudF9wb3NpdGlvbiktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpIG9yIG5vdCBAY29udGVudD9cbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudFxuICAgICAgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiVGV4dEluc2VydFwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgSGFuZGxlcyBhIFdvcmRUeXBlLWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgIyBAbm90ZSBDdXJyZW50bHksIG9ubHkgVGV4dCBpcyBzdXBwb3J0ZWQhXG4gICNcbiAgY2xhc3MgV29yZFR5cGUgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEB0ZXh0ZmllbGRzID0gW11cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIHdvcmQtdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHlhdHRhLnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiV29yZFR5cGVcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJXb3JkVHlwZVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgZm9yIHRleHRmaWVsZCBpbiBAdGV4dGZpZWxkc1xuICAgICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IG51bGxcbiAgICAgICAgdGV4dGZpZWxkLm9ucGFzdGUgPSBudWxsXG4gICAgICAgIHRleHRmaWVsZC5vbmN1dCA9IG51bGxcbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIGNvbnRlbnRcblxuICAgIGluc2VydEFmdGVyOiAobGVmdCwgY29udGVudCktPlxuICAgICAgd2hpbGUgbGVmdC5pc0RlbGV0ZWQoKVxuICAgICAgICBsZWZ0ID0gbGVmdC5wcmV2X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSBsZWZ0LCB0aGF0IGlzIG5vdCBkZWxldGVkLiBDYXNlIHBvc2l0aW9uIGlzIDAsIGl0cyB0aGUgRGVsaW1pdGVyLlxuICAgICAgcmlnaHQgPSBsZWZ0Lm5leHRfY2xcbiAgICAgIGlmIGNvbnRlbnQudHlwZT9cbiAgICAgICAgKG5ldyBUZXh0SW5zZXJ0IGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgICAgdG1wID0gKG5ldyBUZXh0SW5zZXJ0IGMsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7V29yZFR5cGV9IFRoaXMgV29yZFR5cGUgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnRUZXh0OiAocG9zaXRpb24sIGNvbnRlbnQpLT5cbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICAgQGluc2VydEFmdGVyIGl0aCwgY29udGVudFxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7V29yZFR5cGV9IFRoaXMgV29yZFR5cGUgb2JqZWN0XG4gICAgI1xuICAgIGRlbGV0ZVRleHQ6IChwb3NpdGlvbiwgbGVuZ3RoKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zaXRpb24rMSkgIyBwb3NpdGlvbiAwIGluIHRoaXMgY2FzZSBpcyB0aGUgZGVsZXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlclxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgVGV4dERlbGV0ZSB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcikgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBTdHJpbmctcmVwcmVzZW50YXRpb24gb2YgdGhpcyB3b3JkLlxuICAgICMgQHJldHVybiB7U3RyaW5nfSBUaGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIFNhbWUgYXMgV29yZFR5cGUudmFsXG4gICAgIyBAc2VlIFdvcmRUeXBlLnZhbFxuICAgICNcbiAgICB0b1N0cmluZzogKCktPlxuICAgICAgQHZhbCgpXG5cbiAgICAjXG4gICAgIyBCaW5kIHRoaXMgV29yZFR5cGUgdG8gYSB0ZXh0ZmllbGQgb3IgaW5wdXQgZmllbGQuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHRleHRib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRleHRmaWVsZFwiKTtcbiAgICAjICAgeWF0dGEuYmluZCh0ZXh0Ym94KTtcbiAgICAjXG4gICAgYmluZDogKHRleHRmaWVsZCktPlxuICAgICAgd29yZCA9IEBcbiAgICAgIHRleHRmaWVsZC52YWx1ZSA9IEB2YWwoKVxuICAgICAgQHRleHRmaWVsZHMucHVzaCB0ZXh0ZmllbGRcblxuICAgICAgQG9ic2VydmUgKGV2ZW50cyktPlxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgaWYgZXZlbnQudHlwZSBpcyBcImluc2VydFwiXG4gICAgICAgICAgICBvX3BvcyA9IGV2ZW50LnBvc2l0aW9uXG4gICAgICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQudHlwZSBpcyBcImRlbGV0ZVwiXG4gICAgICAgICAgICBvX3BvcyA9IGV2ZW50LnBvc2l0aW9uXG4gICAgICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgICAgIGlmIGN1cnNvciA8IG9fcG9zXG4gICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBjdXJzb3IgLT0gMVxuICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIGxlZnQsIHJpZ2h0XG5cbiAgICAgICMgY29uc3VtZSBhbGwgdGV4dC1pbnNlcnQgY2hhbmdlcy5cbiAgICAgIHRleHRmaWVsZC5vbmtleXByZXNzID0gKGV2ZW50KS0+XG4gICAgICAgIGNoYXIgPSBudWxsXG4gICAgICAgIGlmIGV2ZW50LmtleT9cbiAgICAgICAgICBpZiBldmVudC5jaGFyQ29kZSBpcyAzMlxuICAgICAgICAgICAgY2hhciA9IFwiIFwiXG4gICAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlIGlzIDEzXG4gICAgICAgICAgICBjaGFyID0gJ1xcbidcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjaGFyID0gZXZlbnQua2V5XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZSBldmVudC5rZXlDb2RlXG4gICAgICAgIGlmIGNoYXIubGVuZ3RoID4gMFxuICAgICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCAocG9zKSwgZGlmZlxuICAgICAgICAgIHdvcmQuaW5zZXJ0VGV4dCBwb3MsIGNoYXJcbiAgICAgICAgICBuZXdfcG9zID0gcG9zICsgY2hhci5sZW5ndGhcbiAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgdGV4dGZpZWxkLm9ucGFzdGUgPSAoZXZlbnQpLT5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgdGV4dGZpZWxkLm9uY3V0ID0gKGV2ZW50KS0+XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgI1xuICAgICAgIyBjb25zdW1lIGRlbGV0ZXMuIE5vdGUgdGhhdFxuICAgICAgIyAgIGNocm9tZTogd29uJ3QgY29uc3VtZSBkZWxldGlvbnMgb24ga2V5cHJlc3MgZXZlbnQuXG4gICAgICAjICAga2V5Q29kZSBpcyBkZXByZWNhdGVkLiBCVVQ6IEkgZG9uJ3Qgc2VlIGFub3RoZXIgd2F5LlxuICAgICAgIyAgICAgc2luY2UgZXZlbnQua2V5IGlzIG5vdCBpbXBsZW1lbnRlZCBpbiB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIGNocm9tZS5cbiAgICAgICMgICAgIEV2ZXJ5IGJyb3dzZXIgc3VwcG9ydHMga2V5Q29kZS4gTGV0J3Mgc3RpY2sgd2l0aCBpdCBmb3Igbm93Li5cbiAgICAgICNcbiAgICAgIHRleHRmaWVsZC5vbmtleWRvd24gPSAoZXZlbnQpLT5cbiAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIGRpZmZcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGlmIGV2ZW50LmN0cmxLZXk/IGFuZCBldmVudC5jdHJsS2V5XG4gICAgICAgICAgICAgIHZhbCA9IHRleHRmaWVsZC52YWx1ZVxuICAgICAgICAgICAgICBuZXdfcG9zID0gcG9zXG4gICAgICAgICAgICAgIGRlbF9sZW5ndGggPSAwXG4gICAgICAgICAgICAgIGlmIHBvcyA+IDBcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd2hpbGUgbmV3X3BvcyA+IDAgYW5kIHZhbFtuZXdfcG9zXSBpc250IFwiIFwiIGFuZCB2YWxbbmV3X3Bvc10gaXNudCAnXFxuJ1xuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgbmV3X3BvcywgKHBvcy1uZXdfcG9zKVxuICAgICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcy0xKSwgMVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCAxXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cblxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogXCJXb3JkVHlwZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyAjIGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4oKS5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnV29yZFR5cGUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdiZWdpbm5pbmcnIDogYmVnaW5uaW5nXG4gICAgICAnZW5kJyA6IGVuZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgV29yZFR5cGUgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgdHlwZXNbJ1RleHRJbnNlcnQnXSA9IFRleHRJbnNlcnRcbiAgdHlwZXNbJ1RleHREZWxldGUnXSA9IFRleHREZWxldGVcbiAgdHlwZXNbJ1dvcmRUeXBlJ10gPSBXb3JkVHlwZVxuICBzdHJ1Y3R1cmVkX3R5cGVzXG5cblxuIiwiXG5ZYXR0YSA9IHJlcXVpcmUgJy4veWF0dGEnXG5cbmJpbmRUb0NoaWxkcmVuID0gKHRoYXQpLT5cbiAgZm9yIGkgaW4gWzAuLi50aGF0LmNoaWxkcmVuLmxlbmd0aF1cbiAgICBhdHRyID0gdGhhdC5jaGlsZHJlbi5pdGVtKGkpXG4gICAgaWYgYXR0ci5uYW1lP1xuICAgICAgYXR0ci52YWwgPSB0aGF0LnZhbC52YWwoYXR0ci5uYW1lKVxuICB0aGF0LnZhbC5vYnNlcnZlIChldmVudHMpLT5cbiAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICBpZiBldmVudC5uYW1lP1xuICAgICAgICBmb3IgaSBpbiBbMC4uLnRoYXQuY2hpbGRyZW4ubGVuZ3RoXVxuICAgICAgICAgIGF0dHIgPSB0aGF0LmNoaWxkcmVuLml0ZW0oaSlcbiAgICAgICAgICBpZiBhdHRyLm5hbWU/IGFuZCBhdHRyLm5hbWUgaXMgZXZlbnQubmFtZVxuICAgICAgICAgICAgbmV3VmFsID0gdGhhdC52YWwudmFsKGF0dHIubmFtZSlcbiAgICAgICAgICAgIGlmIGF0dHIudmFsIGlzbnQgbmV3VmFsXG4gICAgICAgICAgICAgIGF0dHIudmFsID0gbmV3VmFsXG5cblBvbHltZXIgXCJ5YXR0YS1lbGVtZW50XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQGNvbm5lY3Rvcj9cbiAgICAgIEB2YWwgPSBuZXcgWWF0dGEgQGNvbm5lY3RvclxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuICAgIGVsc2UgaWYgQHZhbD9cbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuICB2YWxDaGFuZ2VkOiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEB2YWwudHlwZSBpcyBcIkpzb25UeXBlXCJcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuUG9seW1lciBcInlhdHRhLXByb3BlcnR5XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEBuYW1lP1xuICAgICAgaWYgQHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgQHZhbCA9IEBwYXJlbnRFbGVtZW50LnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgdHlwZW9mIEB2YWwgaXMgXCJzdHJpbmdcIlxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwoQG5hbWUsQHZhbClcbiAgICAgIGlmIEB2YWwudHlwZSBpcyBcIkpzb25UeXBlXCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsLnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgQHZhbC50eXBlIGlzIFwiSnNvblR5cGVcIlxuICAgICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgICBlbHNlIGlmIEB2YWwgaXNudCBAcGFyZW50RWxlbWVudC52YWwudmFsKEBuYW1lKVxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwudmFsIEBuYW1lLCBAdmFsXG5cblxuIiwiXG5qc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UeXBlcy9Kc29uVHlwZXNcIlxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVlhdHRhID0gKGNvbm5lY3RvciktPlxuICB1c2VyX2lkID0gbnVsbFxuICBpZiBjb25uZWN0b3IuaWQ/XG4gICAgdXNlcl9pZCA9IGNvbm5lY3Rvci5pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLndoZW5Vc2VySWRTZXQgKGlkKS0+XG4gICAgICB1c2VyX2lkID0gaWRcbiAgICAgIEhCLnJlc2V0VXNlcklkIGlkXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICB0eXBlX21hbmFnZXIgPSBqc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSB0eXBlX21hbmFnZXIudHlwZXNcblxuICAjXG4gICMgRnJhbWV3b3JrIGZvciBKc29uIGRhdGEtc3RydWN0dXJlcy5cbiAgIyBLbm93biB2YWx1ZXMgdGhhdCBhcmUgc3VwcG9ydGVkOlxuICAjICogU3RyaW5nXG4gICMgKiBJbnRlZ2VyXG4gICMgKiBBcnJheVxuICAjXG4gIGNsYXNzIFlhdHRhIGV4dGVuZHMgdHlwZXMuSnNvblR5cGVcblxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXF1ZSBpZCBvZiB0aGUgcGVlci5cbiAgICAjIEBwYXJhbSB7Q29ubmVjdG9yfSBDb25uZWN0b3IgdGhlIGNvbm5lY3RvciBjbGFzcy5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3IgPSBjb25uZWN0b3JcbiAgICAgIEBIQiA9IEhCXG4gICAgICBAdHlwZXMgPSB0eXBlc1xuICAgICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0eXBlX21hbmFnZXIucGFyc2VyXG4gICAgICBhZGFwdENvbm5lY3RvciBAY29ubmVjdG9yLCBAZW5naW5lLCBASEIsIHR5cGVfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcbiAgICAgIHN1cGVyXG5cbiAgICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3JcblxuICByZXR1cm4gbmV3IFlhdHRhKEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKS5leGVjdXRlKClcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZYXR0YVxuaWYgd2luZG93PyBhbmQgbm90IHdpbmRvdy5ZYXR0YT9cbiAgd2luZG93LllhdHRhID0gY3JlYXRlWWF0dGFcbiJdfQ==
