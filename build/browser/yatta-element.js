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
  return connector.whenReceiving(function(sender, op) {
    if (op.uid.creator !== HB.getUserId()) {
      return engine.applyOp(op);
    }
  });
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
      var d, o, _i, _len, _ref, _ref1;
      if ((_ref = this.next_cl) != null ? _ref.isDeleted() : void 0) {
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
      } else if ((this.next_cl != null) && (this.prev_cl != null)) {
        throw new Error("This insertion was not supposed to be deleted!");
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

    function Replaceable(content, parent, uid, prev, next, origin, is_deleted) {
      this.saveOperation('content', content);
      this.saveOperation('parent', parent);
      if (!((prev != null) && (next != null))) {
        throw new Error("You must define prev, and next for Replaceable-types!");
      }
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
        'type': "Replaceable",
        'content': (_ref = this.content) != null ? _ref.getUid() : void 0,
        'replace_manager': this.parent.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'uid': this.getUid(),
        'is_deleted': this.is_deleted
      };
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return Replaceable;

  })(types.Insert);
  parser["Replaceable"] = function(json) {
    var content, is_deleted, next, origin, parent, prev, uid;
    content = json['content'], parent = json['replace_manager'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], is_deleted = json['is_deleted'];
    return new Replaceable(content, parent, uid, prev, next, origin, is_deleted);
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
      var o;
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
      right = left.next_cl;
      while (right.isDeleted()) {
        right = right.next_cl;
      }
      left = right.prev_cl;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL0Nvbm5lY3RvckFkYXB0ZXIuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ZYXR0YS9saWIvVHlwZXMvQmFzaWNUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL0pzb25UeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1N0cnVjdHVyZWRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL1R5cGVzL1RleHRUeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvWWF0dGEvbGliL3lhdHRhLWVsZW1lbnQuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL1lhdHRhL2xpYi95YXR0YS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNPQSxJQUFBLGNBQUE7O0FBQUEsY0FBQSxHQUFpQixTQUFDLFNBQUQsRUFBWSxNQUFaLEVBQW9CLEVBQXBCLEVBQXdCLGtCQUF4QixHQUFBO0FBQ2YsTUFBQSxnRkFBQTtBQUFBLEVBQUEsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixLQUFpQixFQUFFLENBQUMsU0FBSCxDQUFBLENBQWpCLElBQW9DLENBQUMsTUFBQSxDQUFBLENB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QUFDLENBQUEsU0FBaEIsRUFBMkIsSUFBQyxDQUFBLE1BQTVCLEVBQW9DLElBQUMsQ0FBQSxFQUFyQyxFQUF5QyxZQUFZLENBQUMsa0JBQXRELENBSkEsQ0FBQTtBQUFBLE1BS0Esd0NBQUEsU0FBQSxDQUxBLENBRFc7SUFBQSxDQUFiOztBQUFBLG9CQVFBLFlBQUEsR0FBYyxTQUFBLEdBQUE7YUFDWixJQUFDLENBQUEsVUFEVztJQUFBLENBUmQsQ0FBQTs7aUJBQUE7O0tBTmtCLEtBQUssQ0FBQyxTQW5CMUIsQ0FBQTtBQW9DQSxTQUFXLElBQUEsS0FBQSxDQUFNLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQU4sQ0FBdUMsQ0FBQyxPQUF4QyxDQUFBLENBQVgsQ0FyQ1k7QUFBQSxDQUxkLENBQUE7O0FBQUEsTUE0Q00sQ0FBQyxPQUFQLEdBQWlCLFdBNUNqQixDQUFBOztBQTZDQSxJQUFHLGtEQUFBLElBQWdCLHNCQUFuQjtBQUNFLEVBQUEsTUFBTSxDQUFDLEtBQVAsR0FBZSxXQUFmLENBREY7Q0E3Q0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5cbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXG5cbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XG4gICAgICB1c2VyOiBuYW1lXG4gICAgICBzdGF0ZTogdmFsdWVcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxuICAgIGZvciBzIGluIHZcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxuICAgIHN0YXRlX3ZlY3RvclxuXG4gIHNlbmRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIHNlbmRIYiA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0gcGFyc2Vfc3RhdGVfdmVjdG9yIHZcbiAgICBqc29uID1cbiAgICAgIGhiOiBIQi5fZW5jb2RlKHN0YXRlX3ZlY3RvcilcbiAgICAgIHN0YXRlX3ZlY3RvcjogZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICBqc29uXG5cbiAgYXBwbHlIYiA9IChyZXMpLT5cbiAgICBIQi5yZW5ld1N0YXRlVmVjdG9yIHBhcnNlX3N0YXRlX3ZlY3RvciByZXMuc3RhdGVfdmVjdG9yXG4gICAgZW5naW5lLmFwcGx5T3BzQ2hlY2tEb3VibGUgcmVzLmhiXG5cbiAgY29ubmVjdG9yLndoZW5TeW5jaW5nIHNlbmRTdGF0ZVZlY3Rvciwgc2VuZEhiLCBhcHBseUhiXG5cbiAgY29ubmVjdG9yLndoZW5SZWNlaXZpbmcgKHNlbmRlciwgb3ApLT5cbiAgICBpZiBvcC51aWQuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICBlbmdpbmUuYXBwbHlPcCBvcFxuXG5cbm1vZHVsZS5leHBvcnRzID0gYWRhcHRDb25uZWN0b3IiLCJcbndpbmRvdz8udW5wcm9jZXNzZWRfY291bnRlciA9IDAgIyBkZWwgdGhpc1xud2luZG93Py51bnByb2Nlc3NlZF9leGVjX2NvdW50ZXIgPSAwICMgVE9ET1xud2luZG93Py51bnByb2Nlc3NlZF90eXBlcyA9IFtdXG5cbiNcbiMgQG5vZG9jXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXG4jXG5jbGFzcyBFbmdpbmVcblxuICAjXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAjIEBwYXJhbSB7QXJyYXl9IHBhcnNlciBEZWZpbmVzIGhvdyB0byBwYXJzZSBlbmNvZGVkIG1lc3NhZ2VzLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAcGFyc2VyKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGVQYXJzZXIgPSBAcGFyc2VyW2pzb24udHlwZV1cbiAgICBpZiB0eXBlUGFyc2VyP1xuICAgICAgdHlwZVBhcnNlciBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5KS0+XG4gICAgaWYgb3BfanNvbl9hcnJheS5jb25zdHJ1Y3RvciBpc250IEFycmF5XG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXG4gICAgZm9yIG9wX2pzb24gaW4gb3BfanNvbl9hcnJheVxuICAgICAgIyAkcGFyc2VfYW5kX2V4ZWN1dGUgd2lsbCByZXR1cm4gZmFsc2UgaWYgJG9fanNvbiB3YXMgcGFyc2VkIGFuZCBleGVjdXRlZCwgb3RoZXJ3aXNlIHRoZSBwYXJzZWQgb3BlcmFkaW9uXG4gICAgICBvID0gQHBhcnNlT3BlcmF0aW9uIG9wX2pzb25cbiAgICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXG4gICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG8pP1xuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAyMDAwXG4gICAgQHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlciA9IDBcbiAgICBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcblxuICByZXNldFVzZXJJZDogKGlkKS0+XG4gICAgb3duID0gQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBvd24/XG4gICAgICBmb3Igb19uYW1lLG8gb2Ygb3duXG4gICAgICAgIG8udWlkLmNyZWF0b3IgPSBpZFxuICAgICAgaWYgQGJ1ZmZlcltpZF0/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXG4gICAgICBkZWxldGUgQGJ1ZmZlcltAdXNlcl9pZF1cblxuICAgIEBvcGVyYXRpb25fY291bnRlcltpZF0gPSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgZGVsZXRlIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICBAdXNlcl9pZCA9IGlkXG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxuICAgICAgby5jbGVhbnVwPygpXG5cbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxuICAgIEB0cmFzaCA9IFtdXG4gICAgaWYgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCBpc250IC0xXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcbiAgICB1bmRlZmluZWRcblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxuICAgICAgZm9yIG8gaW4gYXJndW1lbnRzXG4gICAgICAgIGlmIG8/XG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXG5cbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXG4gICAgQHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0KClcbiAgICBAZ2FyYmFnZSA9IFtdXG4gICAgQHRyYXNoID0gW11cblxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxuICAgIGNsZWFyVGltZW91dCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWRcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcblxuICBzZXRHYXJiYWdlQ29sbGVjdFRpbWVvdXQ6IChAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0KS0+XG5cbiAgI1xuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcbiAgICAgIGRvU3luYzogZmFsc2VcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICByZXMgPSB7fVxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICAgIHJlc1xuICAgIGVsc2VcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBvLnVpZC5vcF9udW1iZXIgPD0gQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG5cbiAgI1xuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIG8udWlkLmRvU3luYyBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICAgICdkb1N5bmMnIDogdHJ1ZVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxuICAgIGlmIHVpZC51aWQ/XG4gICAgICB1aWQgPSB1aWQudWlkXG4gICAgQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSAjIHlvdSBhbHJlYWR5IGRvIHRoaXMgaW4gdGhlIGVuZ2luZSwgc28gZGVsZXRlIGl0IGhlcmUhXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIG9wZXJhdGlvbiB3YXMgbm90IGV4cGVjdGVkIVwiXG4gICAgQGFkZFRvQ291bnRlcihvKVxuICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXSA9IG9cbiAgICBvXG5cbiAgcmVtb3ZlT3BlcmF0aW9uOiAobyktPlxuICAgIGRlbGV0ZSBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1tvLnVpZC5vcF9udW1iZXJdXG5cbiAgIyBXaGVuIHRoZSBIQiBkZXRlcm1pbmVzIGluY29uc2lzdGVuY2llcywgdGhlbiB0aGUgaW52b2tlU3luY1xuICAjIGhhbmRsZXIgd2lsIGJlIGNhbGxlZCwgd2hpY2ggc2hvdWxkIHNvbWVob3cgaW52b2tlIHRoZSBzeW5jIHdpdGggYW5vdGhlciBjb2xsYWJvcmF0b3IuXG4gICMgVGhlIHBhcmFtZXRlciBvZiB0aGUgc3luYyBoYW5kbGVyIGlzIHRoZSB1c2VyX2lkIHdpdGggd2ljaCBhbiBpbmNvbnNpc3RlbmN5IHdhcyBkZXRlcm1pbmVkXG4gIHNldEludm9rZVN5bmNIYW5kbGVyOiAoZiktPlxuICAgIEBpbnZva2VTeW5jID0gZlxuXG4gICMgZW1wdHkgcGVyIGRlZmF1bHQgIyBUT0RPOiBkbyBpIG5lZWQgdGhpcz9cbiAgaW52b2tlU3luYzogKCktPlxuXG4gICMgYWZ0ZXIgeW91IHJlY2VpdmVkIHRoZSBIQiBvZiBhbm90aGVyIHVzZXIgKGluIHRoZSBzeW5jIHByb2Nlc3MpLFxuICAjIHlvdSByZW5ldyB5b3VyIG93biBzdGF0ZV92ZWN0b3IgdG8gdGhlIHN0YXRlX3ZlY3RvciBvZiB0aGUgb3RoZXIgdXNlclxuICByZW5ld1N0YXRlVmVjdG9yOiAoc3RhdGVfdmVjdG9yKS0+XG4gICAgZm9yIHVzZXIsc3RhdGUgb2Ygc3RhdGVfdmVjdG9yXG4gICAgICBpZiAobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID0gMFxuICAgIGlmIHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8udWlkLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcbiAgICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgZWxzZVxuICAgICAgICBAaW52b2tlU3luYyBvLnVpZC5jcmVhdG9yXG5cbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSAtIChvLnVpZC5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICBwYXJzZXIgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBAcHJpdmF0ZVxuICAjIEBhYnN0cmFjdFxuICAjIEBub2RvY1xuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BlcmF0aW9ucy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLlxuICAgICMgSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZCBiZWZvcmUgYXQgdGhlIGVuZCBvZiB0aGUgZXhlY3V0aW9uIHNlcXVlbmNlXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XG4gICAgICBpZiB1aWQ/XG4gICAgICAgIEB1aWQgPSB1aWRcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBcbiAgICB1bm9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cbiAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYWxsIHN1YnNjcmliZWQgZXZlbnQgbGlzdGVuZXJzLlxuICAgICMgVGhpcyBzaG91bGQgYmUgY2FsbGVkLCBlLmcuIGFmdGVyIHRoaXMgaGFzIGJlZW4gcmVwbGFjZWQuXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXG4gICAgIyBUaGlzIGlzIGFsc28gY2FsbGVkIGluIHRoZSBjbGVhbnVwIG1ldGhvZC5cbiAgICBkZWxldGVBbGxPYnNlcnZlcnM6ICgpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIEBmb3J3YXJkRXZlbnQgQCwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBIQi5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IgQFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgI2NvbnNvbGUubG9nIFwiY2xlYW51cDogI3tAdHlwZX1cIlxuICAgICAgSEIucmVtb3ZlT3BlcmF0aW9uIEBcbiAgICAgIEBkZWxldGVBbGxPYnNlcnZlcnMoKVxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIEB1aWRcblxuICAgIGRvbnRTeW5jOiAoKS0+XG4gICAgICBAdWlkLmRvU3luYyA9IGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSWYgbm90IGFscmVhZHkgZG9uZSwgc2V0IHRoZSB1aWRcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgaWYgbm90IEB1aWQ/XG4gICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxuICAgICAgICAjIFRoZXJlIGlzIG9ubHkgb25lIG90aGVyIHBsYWNlLCB3aGVyZSB0aGlzIGNhbiBiZSBkb25lIC0gYmVmb3JlIGFuIEluc2VydGlvblxuICAgICAgICAjIGlzIGV4ZWN1dGVkIChiZWNhdXNlIHdlIG5lZWQgdGhlIGNyZWF0b3JfaWQpXG4gICAgICAgIEB1aWQgPSBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICBIQi5hZGRPcGVyYXRpb24gQFxuICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgb3A/LmV4ZWN1dGU/XG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXG4gICNcbiAgY2xhc3MgRGVsZXRlIGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBkZWxldGVzKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmVzID0gc3VwZXJcbiAgICAgICAgaWYgcmVzXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICByZXNcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBwYXJzZXJbJ0RlbGV0ZSddID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IERlbGV0ZSB1aWQsIGRlbGV0ZXNfdWlkXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIEluc2VydCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgICNcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBjYWxsTGF0ZXIgPSBmYWxzZVxuICAgICAgaWYgQHBhcmVudD8gYW5kIG5vdCBAaXNEZWxldGVkKCkgYW5kIG8/ICMgbz8gOiBpZiBub3Qgbz8sIHRoZW4gdGhlIGRlbGltaXRlciBkZWxldGVkIHRoaXMgSW5zZXJ0aW9uLiBGdXJ0aGVybW9yZSwgaXQgd291bGQgYmUgd3JvbmcgdG8gY2FsbCBpdC4gVE9ETzogbWFrZSB0aGlzIG1vcmUgZXhwcmVzc2l2ZSBhbmQgc2F2ZVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgY2FsbExhdGVyID0gdHJ1ZVxuICAgICAgaWYgbz9cbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICBpZiBjYWxsTGF0ZXJcbiAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyhvKVxuICAgICAgaWYgQHByZXZfY2w/LmlzRGVsZXRlZCgpXG4gICAgICAgICMgZ2FyYmFnZSBjb2xsZWN0IHByZXZfY2xcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgIyBUT0RPOiBEZWJ1Z2dpbmdcbiAgICAgIGlmIEBuZXh0X2NsPy5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcImxlZnQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXG4gICAgICAgICMgZGVsZXRlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxuICAgICAgICBvID0gQG5leHRfY2xcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcbiAgICAgICAgICAgIG8ub3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAbmV4dF9jbD8gYW5kIEBwcmV2X2NsP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIGluc2VydGlvbiB3YXMgbm90IHN1cHBvc2VkIHRvIGJlIGRlbGV0ZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IGRpc3RhbmNlX3RvX29yaWdpbiAjIGxvb3AgY291bnRlclxuXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcbiAgICAgICAgICAjICAgICAgICAgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIDwgQHVpZC5jcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG5cbiAgICAgICAgQHNldFBhcmVudCBAcHJldl9jbC5nZXRQYXJlbnQoKSAjIGRvIEluc2VydGlvbnMgYWx3YXlzIGhhdmUgYSBwYXJlbnQ/XG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMoKVxuICAgICAgICBAXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIEBwYXJlbnQ/LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudFxuICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICB2YWx1ZTogQGNvbnRlbnRcbiAgICAgIF1cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIEBwYXJlbnQuY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50ICMgVE9ETzogWW91IGNhbiBjb21iaW5lIGdldFBvc2l0aW9uICsgZ2V0UGFyZW50IGluIGEgbW9yZSBlZmZpY2llbnQgbWFubmVyISAob25seSBsZWZ0IERlbGltaXRlciB3aWxsIGhvbGQgQHBhcmVudClcbiAgICAgICAgbGVuZ3RoOiAxXG4gICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgXVxuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2YgRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIERlZmluZXMgYW4gb2JqZWN0IHRoYXQgaXMgY2Fubm90IGJlIGNoYW5nZWQuIFlvdSBjYW4gdXNlIHRoaXMgdG8gc2V0IGFuIGltbXV0YWJsZSBzdHJpbmcsIG9yIGEgbnVtYmVyLlxuICAjXG4gIGNsYXNzIEltbXV0YWJsZU9iamVjdCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGNvbnRlbnRcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIEBjb250ZW50LCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIkltbXV0YWJsZU9iamVjdFwiXG5cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtTdHJpbmddIFRoZSBjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICB2YWwgOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIkltbXV0YWJsZU9iamVjdFwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdjb250ZW50JyA6IEBjb250ZW50XG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gIyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luKCkuZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ0ltbXV0YWJsZU9iamVjdCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSW1tdXRhYmxlT2JqZWN0IHVpZCwgY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3MgRGVsaW1pdGVyIGV4dGVuZHMgT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcbiAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cbiAgICAgICAgc3VwZXJcbiAgICAgICNlbHNlXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJEZWxpbWl0ZXJcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgcGFyc2VyWydEZWxpbWl0ZXInXSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyBEZWxpbWl0ZXIgdWlkLCBwcmV2LCBuZXh0XG5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxuICB7XG4gICAgJ3R5cGVzJyA6XG4gICAgICAnRGVsZXRlJyA6IERlbGV0ZVxuICAgICAgJ0luc2VydCcgOiBJbnNlcnRcbiAgICAgICdEZWxpbWl0ZXInOiBEZWxpbWl0ZXJcbiAgICAgICdPcGVyYXRpb24nOiBPcGVyYXRpb25cbiAgICAgICdJbW11dGFibGVPYmplY3QnIDogSW1tdXRhYmxlT2JqZWN0XG4gICAgJ3BhcnNlcicgOiBwYXJzZXJcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsInRleHRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1RleHRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSB0ZXh0X3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHRleHRfdHlwZXMucGFyc2VyXG5cbiAgY3JlYXRlSnNvblR5cGVXcmFwcGVyID0gKF9qc29uVHlwZSktPlxuXG4gICAgI1xuICAgICMgQG5vdGUgRVhQRVJJTUVOVEFMXG4gICAgI1xuICAgICMgQSBKc29uVHlwZVdyYXBwZXIgd2FzIGludGVuZGVkIHRvIGJlIGEgY29udmVuaWVudCB3cmFwcGVyIGZvciB0aGUgSnNvblR5cGUuXG4gICAgIyBCdXQgaXQgY2FuIG1ha2UgdGhpbmdzIG1vcmUgZGlmZmljdWx0IHRoYW4gdGhleSBhcmUuXG4gICAgIyBAc2VlIEpzb25UeXBlXG4gICAgI1xuICAgICMgQGV4YW1wbGUgY3JlYXRlIGEgSnNvblR5cGVXcmFwcGVyXG4gICAgIyAgICMgWW91IGdldCBhIEpzb25UeXBlV3JhcHBlciBmcm9tIGEgSnNvblR5cGUgYnkgY2FsbGluZ1xuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjXG4gICAgIyBJdCBjcmVhdGVzIEphdmFzY3JpcHRzIC1nZXR0ZXIgYW5kIC1zZXR0ZXIgbWV0aG9kcyBmb3IgZWFjaCBwcm9wZXJ0eSB0aGF0IEpzb25UeXBlIG1haW50YWlucy5cbiAgICAjIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2RlZmluZVByb3BlcnR5XG4gICAgI1xuICAgICMgQGV4YW1wbGUgR2V0dGVyIEV4YW1wbGVcbiAgICAjICAgIyB5b3UgY2FuIGFjY2VzcyB0aGUgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueFxuICAgICMgICAjIGluc3RlYWQgb2ZcbiAgICAjICAgeWF0dGEudmFsKCd4JylcbiAgICAjXG4gICAgIyBAbm90ZSBZb3UgY2FuIG9ubHkgb3ZlcndyaXRlIGV4aXN0aW5nIHZhbHVlcyEgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eSB3b24ndCBoYXZlIGFueSBlZmZlY3QhXG4gICAgI1xuICAgICMgQGV4YW1wbGUgU2V0dGVyIEV4YW1wbGVcbiAgICAjICAgIyB5b3UgY2FuIHNldCBhbiBleGlzdGluZyB4IHByb3BlcnR5IG9mIHlhdHRhIGJ5IGNhbGxpbmdcbiAgICAjICAgdy54ID0gXCJ0ZXh0XCJcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcsIFwidGV4dFwiKVxuICAgICNcbiAgICAjIEluIG9yZGVyIHRvIHNldCBhIG5ldyBwcm9wZXJ0eSB5b3UgaGF2ZSB0byBvdmVyd3JpdGUgYW4gZXhpc3RpbmcgcHJvcGVydHkuXG4gICAgIyBUaGVyZWZvcmUgdGhlIEpzb25UeXBlV3JhcHBlciBzdXBwb3J0cyBhIHNwZWNpYWwgZmVhdHVyZSB0aGF0IHNob3VsZCBtYWtlIHRoaW5ncyBtb3JlIGNvbnZlbmllbnRcbiAgICAjICh3ZSBjYW4gYXJndWUgYWJvdXQgdGhhdCwgdXNlIHRoZSBKc29uVHlwZSBpZiB5b3UgZG9uJ3QgbGlrZSBpdCA7KS5cbiAgICAjIElmIHlvdSBvdmVyd3JpdGUgYW4gb2JqZWN0IHByb3BlcnR5IG9mIHRoZSBKc29uVHlwZVdyYXBwZXIgd2l0aCBhIG5ldyBvYmplY3QsIGl0IHdpbGwgcmVzdWx0IGluIGEgbWVyZ2VkIHZlcnNpb24gb2YgdGhlIG9iamVjdHMuXG4gICAgIyBMZXQgYHlhdHRhLnZhbHVlLnBgIHRoZSBwcm9wZXJ0eSB0aGF0IGlzIHRvIGJlIG92ZXJ3cml0dGVuIGFuZCBvIHRoZSBuZXcgdmFsdWUuIEUuZy4gYHlhdHRhLnZhbHVlLnAgPSBvYFxuICAgICMgKiBUaGUgcmVzdWx0IGhhcyBhbGwgcHJvcGVydGllcyBvZiBvXG4gICAgIyAqIFRoZSByZXN1bHQgaGFzIGFsbCBwcm9wZXJ0aWVzIG9mIHcucCBpZiB0aGV5IGRvbid0IG9jY3VyIHVuZGVyIHRoZSBzYW1lIHByb3BlcnR5LW5hbWUgaW4gby5cbiAgICAjXG4gICAgIyBAZXhhbXBsZSBDb25mbGljdCBFeGFtcGxlXG4gICAgIyAgIHlhdHRhLnZhbHVlID0ge2EgOiBcInN0cmluZ1wifVxuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjICAgY29uc29sZS5sb2codykgIyB7YSA6IFwic3RyaW5nXCJ9XG4gICAgIyAgIHcuYSA9IHthIDoge2IgOiBcInN0cmluZ1wifX1cbiAgICAjICAgY29uc29sZS5sb2codykgIyB7YSA6IHtiIDogXCJTdHJpbmdcIn19XG4gICAgIyAgIHcuYSA9IHthIDoge2MgOiA0fX1cbiAgICAjICAgY29uc29sZS5sb2codykgIyB7YSA6IHtiIDogXCJTdHJpbmdcIiwgYyA6IDR9fVxuICAgICNcbiAgICAjIEBleGFtcGxlIENvbW1vbiBQaXRmYWxsc1xuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjICAgIyBTZXR0aW5nIGEgbmV3IHByb3BlcnR5XG4gICAgIyAgIHcubmV3UHJvcGVydHkgPSBcIkF3ZXNvbWVcIlxuICAgICMgICBjb25zb2xlLmxvZyh3Lm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIGZhbHNlLCB3Lm5ld1Byb3BlcnR5IGlzIHVuZGVmaW5lZFxuICAgICMgICAjIG92ZXJ3cml0ZSB0aGUgdyBvYmplY3RcbiAgICAjICAgdyA9IHtuZXdQcm9wZXJ0eSA6IFwiQXdlc29tZVwifVxuICAgICMgICBjb25zb2xlLmxvZyh3Lm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIHRydWUhLCBidXQgLi5cbiAgICAjICAgY29uc29sZS5sb2coeWF0dGEudmFsdWUubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgZmFsc2UsIHlvdSBhcmUgb25seSBhbGxvd2VkIHRvIHNldCBwcm9wZXJ0aWVzIVxuICAgICMgICAjIFRoZSBzb2x1dGlvblxuICAgICMgICB5YXR0YS52YWx1ZSA9IHtuZXdQcm9wZXJ0eSA6IFwiQXdlc29tZVwifVxuICAgICMgICBjb25zb2xlLmxvZyh3Lm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIHRydWUhXG4gICAgI1xuICAgIGNsYXNzIEpzb25UeXBlV3JhcHBlclxuXG4gICAgICAjXG4gICAgICAjIEBwYXJhbSB7SnNvblR5cGV9IGpzb25UeXBlIEluc3RhbmNlIG9mIHRoZSBKc29uVHlwZSB0aGF0IHRoaXMgY2xhc3Mgd3JhcHBlcy5cbiAgICAgICNcbiAgICAgIGNvbnN0cnVjdG9yOiAoanNvblR5cGUpLT5cbiAgICAgICAgZm9yIG5hbWUsIG9iaiBvZiBqc29uVHlwZS5tYXBcbiAgICAgICAgICBkbyAobmFtZSwgb2JqKS0+XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvblR5cGVXcmFwcGVyLnByb3RvdHlwZSwgbmFtZSxcbiAgICAgICAgICAgICAgZ2V0IDogLT5cbiAgICAgICAgICAgICAgICB4ID0gb2JqLnZhbCgpXG4gICAgICAgICAgICAgICAgaWYgeCBpbnN0YW5jZW9mIEpzb25UeXBlXG4gICAgICAgICAgICAgICAgICBjcmVhdGVKc29uVHlwZVdyYXBwZXIgeFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgeCBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgICAgICAgICAgeC52YWwoKVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIHhcbiAgICAgICAgICAgICAgc2V0IDogKG8pLT5cbiAgICAgICAgICAgICAgICBvdmVyd3JpdGUgPSBqc29uVHlwZS52YWwobmFtZSlcbiAgICAgICAgICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yIGFuZCBvdmVyd3JpdGUgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgICAgICAgICAgICBvdmVyd3JpdGUudmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIGpzb25UeXBlLnZhbChuYW1lLCBvLCAnaW1tdXRhYmxlJylcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgbmV3IEpzb25UeXBlV3JhcHBlciBfanNvblR5cGVcblxuICAjXG4gICMgTWFuYWdlcyBPYmplY3QtbGlrZSB2YWx1ZXMuXG4gICNcbiAgY2xhc3MgSnNvblR5cGUgZXh0ZW5kcyB0eXBlcy5NYXBNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEganNvbi10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geWF0dGEudmFsKCd1bmtub3duJylcbiAgICAjICAgaWYgKHgudHlwZSA9PT0gXCJKc29uVHlwZVwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIkpzb25UeXBlXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cblxuICAgICNcbiAgICAjIFRyYW5zZm9ybSB0aGlzIHRvIGEgSnNvbi4gSWYgeW91ciBicm93c2VyIHN1cHBvcnRzIE9iamVjdC5vYnNlcnZlIGl0IHdpbGwgYmUgdHJhbnNmb3JtZWQgYXV0b21hdGljYWxseSB3aGVuIGEgY2hhbmdlIGFycml2ZXMuXG4gICAgIyBPdGhlcndpc2UgeW91IHdpbGwgbG9vc2UgYWxsIHRoZSBzaGFyaW5nLWFiaWxpdGllcyAodGhlIG5ldyBvYmplY3Qgd2lsbCBiZSBhIGRlZXAgY2xvbmUpIVxuICAgICMgQHJldHVybiB7SnNvbn1cbiAgICAjXG4gICAgIyBUT0RPOiBhdCB0aGUgbW9tZW50IHlvdSBkb24ndCBjb25zaWRlciBjaGFuZ2luZyBvZiBwcm9wZXJ0aWVzLlxuICAgICMgRS5nLjogbGV0IHggPSB7YTpbXX0uIFRoZW4geC5hLnB1c2ggMSB3b3VsZG4ndCBjaGFuZ2UgYW55dGhpbmdcbiAgICAjXG4gICAgdG9Kc29uOiAoKS0+XG4gICAgICBpZiBub3QgQGJvdW5kX2pzb24/IG9yIG5vdCBPYmplY3Qub2JzZXJ2ZT8gb3IgdHJ1ZSAjIFRPRE86IGN1cnJlbnRseSwgeW91IGFyZSBub3Qgd2F0Y2hpbmcgbXV0YWJsZSBzdHJpbmdzIGZvciBjaGFuZ2VzLCBhbmQsIHRoZXJlZm9yZSwgdGhlIEBib3VuZF9qc29uIGlzIG5vdCB1cGRhdGVkLiBUT0RPIFRPRE8gIHd1YXd1YXd1YSBlYXN5XG4gICAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgICBqc29uID0ge31cbiAgICAgICAgZm9yIG5hbWUsIG8gb2YgdmFsXG4gICAgICAgICAgaWYgbm90IG8/XG4gICAgICAgICAgICBqc29uW25hbWVdID0gb1xuICAgICAgICAgIGVsc2UgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgICAganNvbltuYW1lXSA9IEB2YWwobmFtZSkudG9Kc29uKClcbiAgICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgIHdoaWxlIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgICAgbyA9IG8udmFsKClcbiAgICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgQGJvdW5kX2pzb24gPSBqc29uXG4gICAgICAgIGlmIE9iamVjdC5vYnNlcnZlP1xuICAgICAgICAgIHRoYXQgPSBAXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUgQGJvdW5kX2pzb24sIChldmVudHMpLT5cbiAgICAgICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICAgICAgaWYgbm90IGV2ZW50LmNoYW5nZWRCeT8gYW5kIChldmVudC50eXBlIGlzIFwiYWRkXCIgb3IgZXZlbnQudHlwZSA9IFwidXBkYXRlXCIpXG4gICAgICAgICAgICAgICAgIyB0aGlzIGV2ZW50IGlzIG5vdCBjcmVhdGVkIGJ5IFlhdHRhLlxuICAgICAgICAgICAgICAgIHRoYXQudmFsKGV2ZW50Lm5hbWUsIGV2ZW50Lm9iamVjdFtldmVudC5uYW1lXSlcbiAgICAgICAgICBAb2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgICAgIGlmIGV2ZW50LmNyZWF0ZWRfIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgICAgICAgICAgICBub3RpZmllciA9IE9iamVjdC5nZXROb3RpZmllcih0aGF0LmJvdW5kX2pzb24pXG4gICAgICAgICAgICAgICAgb2xkVmFsID0gdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdXG4gICAgICAgICAgICAgICAgaWYgb2xkVmFsP1xuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAndXBkYXRlJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZSdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTogZXZlbnQuY2hhbmdlZEJ5XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAnYWRkJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZCdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTpldmVudC5jaGFuZ2VkQnlcbiAgICAgIEBib3VuZF9qc29uXG5cbiAgICAjXG4gICAgIyBXaGV0aGVyIHRoZSBkZWZhdWx0IGlzICdtdXRhYmxlJyAodHJ1ZSkgb3IgJ2ltbXV0YWJsZScgKGZhbHNlKVxuICAgICNcbiAgICBtdXRhYmxlX2RlZmF1bHQ6XG4gICAgICB0cnVlXG5cbiAgICAjXG4gICAgIyBTZXQgaWYgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnIG9yICdpbW11dGFibGUnXG4gICAgIyBAcGFyYW0ge1N0cmluZ3xCb29sZWFufSBtdXRhYmxlIFNldCBlaXRoZXIgJ211dGFibGUnIC8gdHJ1ZSBvciAnaW1tdXRhYmxlJyAvIGZhbHNlXG4gICAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgICBpZiBtdXRhYmxlIGlzIHRydWUgb3IgbXV0YWJsZSBpcyAnbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IHRydWVcbiAgICAgIGVsc2UgaWYgbXV0YWJsZSBpcyBmYWxzZSBvciBtdXRhYmxlIGlzICdpbW11dGFibGUnXG4gICAgICAgIEpzb25UeXBlLnByb3RvdHlwZS5tdXRhYmxlX2RlZmF1bHQgPSBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgJ1NldCBtdXRhYmxlIGVpdGhlciBcIm11dGFibGVcIiBvciBcImltbXV0YWJsZVwiISdcbiAgICAgICdPSydcblxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwoKVxuICAgICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAgICMgICBAcmV0dXJuIFtKc29uXVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGV8V29yZFR5cGV8U3RyaW5nfE9iamVjdF0gRGVwZW5kaW5nIG9uIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIElmIG11dGFibGUgaXQgd2lsbCByZXR1cm4gYSBPcGVyYXRpb24tdHlwZSBvYmplY3QsIGlmIGltbXV0YWJsZSBpdCB3aWxsIHJldHVybiBTdHJpbmcvT2JqZWN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSwgY29udGVudClcbiAgICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gY29udGVudCBDb250ZW50IG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW0pzb25UeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50LCBtdXRhYmxlKS0+XG4gICAgICBpZiBuYW1lPyBhbmQgYXJndW1lbnRzLmxlbmd0aCA+IDFcbiAgICAgICAgaWYgbXV0YWJsZT9cbiAgICAgICAgICBpZiBtdXRhYmxlIGlzIHRydWUgb3IgbXV0YWJsZSBpcyAnbXV0YWJsZSdcbiAgICAgICAgICAgIG11dGFibGUgPSB0cnVlXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgbXV0YWJsZSA9IGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtdXRhYmxlID0gQG11dGFibGVfZGVmYXVsdFxuICAgICAgICBpZiB0eXBlb2YgY29udGVudCBpcyAnZnVuY3Rpb24nXG4gICAgICAgICAgQCAjIEp1c3QgZG8gbm90aGluZ1xuICAgICAgICBlbHNlIGlmIChub3QgY29udGVudD8pIG9yICgoKG5vdCBtdXRhYmxlKSBvciB0eXBlb2YgY29udGVudCBpcyAnbnVtYmVyJykgYW5kIGNvbnRlbnQuY29uc3RydWN0b3IgaXNudCBPYmplY3QpXG4gICAgICAgICAgc3VwZXIgbmFtZSwgKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdzdHJpbmcnXG4gICAgICAgICAgICB3b3JkID0gKG5ldyB0eXBlcy5Xb3JkVHlwZSB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuICAgICAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIGNvbnRlbnRcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIHdvcmRcbiAgICAgICAgICBlbHNlIGlmIGNvbnRlbnQuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgICBqc29uID0gbmV3IEpzb25UeXBlKCkuZXhlY3V0ZSgpXG4gICAgICAgICAgICBmb3IgbixvIG9mIGNvbnRlbnRcbiAgICAgICAgICAgICAganNvbi52YWwgbiwgbywgbXV0YWJsZVxuICAgICAgICAgICAgc3VwZXIgbmFtZSwganNvblxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBzZXQgI3t0eXBlb2YgY29udGVudH0tdHlwZXMgaW4gY29sbGFib3JhdGl2ZSBKc29uLW9iamVjdHMhXCJcbiAgICAgIGVsc2VcbiAgICAgICAgc3VwZXIgbmFtZSwgY29udGVudFxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25UeXBlLnByb3RvdHlwZSwgJ3ZhbHVlJyxcbiAgICAgIGdldCA6IC0+IGNyZWF0ZUpzb25UeXBlV3JhcHBlciBAXG4gICAgICBzZXQgOiAobyktPlxuICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICBAdmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkpzb25UeXBlXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0pzb25UeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSnNvblR5cGUgdWlkXG5cblxuXG5cbiAgdHlwZXNbJ0pzb25UeXBlJ10gPSBKc29uVHlwZVxuXG4gIHRleHRfdHlwZXNcblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IGJhc2ljX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBNYXBNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBmb3IgbmFtZSxwIG9mIEBtYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25UeXBlcy52YWxcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgaWYgbm90IEBtYXBbbmFtZV0/XG4gICAgICAgICAgKG5ldyBBZGROYW1lIHVuZGVmaW5lZCwgQCwgbmFtZSkuZXhlY3V0ZSgpXG4gICAgICAgIEBtYXBbbmFtZV0ucmVwbGFjZSBjb250ZW50XG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgcHJvcCA9IEBtYXBbbmFtZV1cbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgIG9iaiA9IHByb3AudmFsKClcbiAgICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICAgIG9iai52YWwoKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIG9ialxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQG1hcFxuICAgICAgICAgIGlmIG5vdCBvLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgICAgb2JqID0gby52YWwoKVxuICAgICAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0ICMgb3Igb2JqIGluc3RhbmNlb2YgTWFwTWFuYWdlciBUT0RPOiBkbyB5b3Ugd2FudCBkZWVwIGpzb24/IFxuICAgICAgICAgICAgICBvYmogPSBvYmoudmFsKClcbiAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG9ialxuICAgICAgICByZXN1bHRcblxuICAgIGRlbGV0ZTogKG5hbWUpLT5cbiAgICAgIEBtYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuICAjXG4gICMgQG5vZG9jXG4gICMgV2hlbiBhIG5ldyBwcm9wZXJ0eSBpbiBhIG1hcCBtYW5hZ2VyIGlzIGNyZWF0ZWQsIHRoZW4gdGhlIHVpZHMgb2YgdGhlIGluc2VydGVkIE9wZXJhdGlvbnNcbiAgIyBtdXN0IGJlIHVuaXF1ZSAodGhpbmsgYWJvdXQgY29uY3VycmVudCBvcGVyYXRpb25zKS4gVGhlcmVmb3JlIG9ubHkgYW4gQWRkTmFtZSBvcGVyYXRpb24gaXMgYWxsb3dlZCB0b1xuICAjIGFkZCBhIHByb3BlcnR5IGluIGEgTWFwTWFuYWdlci4gSWYgdHdvIEFkZE5hbWUgb3BlcmF0aW9ucyBvbiB0aGUgc2FtZSBNYXBNYW5hZ2VyIG5hbWUgaGFwcGVuIGNvbmN1cnJlbnRseVxuICAjIG9ubHkgb25lIHdpbGwgQWRkTmFtZSBvcGVyYXRpb24gd2lsbCBiZSBleGVjdXRlZC5cbiAgI1xuICBjbGFzcyBBZGROYW1lIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gbWFwX21hbmFnZXIgVWlkIG9yIHJlZmVyZW5jZSB0byB0aGUgTWFwTWFuYWdlci5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgd2lsbCBiZSBhZGRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIG1hcF9tYW5hZ2VyLCBAbmFtZSktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ21hcF9tYW5hZ2VyJywgbWFwX21hbmFnZXJcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJBZGROYW1lXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBJZiBtYXBfbWFuYWdlciBkb2Vzbid0IGhhdmUgdGhlIHByb3BlcnR5IG5hbWUsIHRoZW4gYWRkIGl0LlxuICAgICMgVGhlIFJlcGxhY2VNYW5hZ2VyIHRoYXQgaXMgYmVpbmcgd3JpdHRlbiBvbiB0aGUgcHJvcGVydHkgaXMgdW5pcXVlXG4gICAgIyBpbiBzdWNoIGEgd2F5IHRoYXQgaWYgQWRkTmFtZSBpcyBleGVjdXRlZCAoZnJvbSBhbm90aGVyIHBlZXIpIGl0IHdpbGxcbiAgICAjIGFsd2F5cyBoYXZlIHRoZSBzYW1lIHJlc3VsdCAoUmVwbGFjZU1hbmFnZXIsIGFuZCBpdHMgYmVnaW5uaW5nIGFuZCBlbmQgYXJlIHRoZSBzYW1lKVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgICMgaGVscGVyIGZvciBjbG9uaW5nIGFuIG9iamVjdFxuICAgICAgICBjbG9uZSA9IChvKS0+XG4gICAgICAgICAgcCA9IHt9XG4gICAgICAgICAgZm9yIG5hbWUsdmFsdWUgb2Ygb1xuICAgICAgICAgICAgcFtuYW1lXSA9IHZhbHVlXG4gICAgICAgICAgcFxuICAgICAgICB1aWRfciA9IGNsb25lKEBtYXBfbWFuYWdlci5nZXRVaWQoKSlcbiAgICAgICAgdWlkX3IuZG9TeW5jID0gZmFsc2VcbiAgICAgICAgdWlkX3Iub3BfbnVtYmVyID0gXCJfI3t1aWRfci5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9XCJcbiAgICAgICAgaWYgbm90IEhCLmdldE9wZXJhdGlvbih1aWRfcik/XG4gICAgICAgICAgdWlkX2JlZyA9IGNsb25lKHVpZF9yKVxuICAgICAgICAgIHVpZF9iZWcub3BfbnVtYmVyID0gXCIje3VpZF9yLm9wX251bWJlcn1fYmVnaW5uaW5nXCJcbiAgICAgICAgICB1aWRfZW5kID0gY2xvbmUodWlkX3IpXG4gICAgICAgICAgdWlkX2VuZC5vcF9udW1iZXIgPSBcIiN7dWlkX3Iub3BfbnVtYmVyfV9lbmRcIlxuICAgICAgICAgIGJlZyA9IChuZXcgdHlwZXMuRGVsaW1pdGVyIHVpZF9iZWcsIHVuZGVmaW5lZCwgdWlkX2VuZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgZW5kID0gKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2VuZCwgYmVnLCB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgICAgbmFtZTogQG5hbWVcbiAgICAgICAgICBldmVudF90aGlzID0gQG1hcF9tYW5hZ2VyXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0gPSBuZXcgUmVwbGFjZU1hbmFnZXIgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgdWlkX3IsIGJlZywgZW5kXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0uc2V0UGFyZW50IEBtYXBfbWFuYWdlciwgQG5hbWVcbiAgICAgICAgICAoQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0uYWRkX25hbWVfb3BzID89IFtdKS5wdXNoIEBcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXS5leGVjdXRlKClcbiAgICAgICAgc3VwZXJcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJBZGROYW1lXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ21hcF9tYW5hZ2VyJyA6IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICAnbmFtZScgOiBAbmFtZVxuICAgICAgfVxuXG4gIHBhcnNlclsnQWRkTmFtZSddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnbWFwX21hbmFnZXInIDogbWFwX21hbmFnZXJcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnbmFtZScgOiBuYW1lXG4gICAgfSA9IGpzb25cbiAgICBuZXcgQWRkTmFtZSB1aWQsIG1hcF9tYW5hZ2VyLCBuYW1lXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3MgTGlzdE1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEEgTGlzdE1hbmFnZXIgbWFpbnRhaW5zIGEgbm9uLWVtcHR5IGxpc3QgdGhhdCBoYXMgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCAoYm90aCBEZWxpbWl0ZXJzISlcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgYmVnaW5uaW5nPyBhbmQgZW5kP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnYmVnaW5uaW5nJywgYmVnaW5uaW5nXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdlbmQnLCBlbmRcbiAgICAgIGVsc2VcbiAgICAgICAgQGJlZ2lubmluZyA9IG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgICBAZW5kID0gICAgICAgbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICByZXN1bHQucHVzaCBvXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgIyBlLmcuIFwiYWJjXCIgOiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBvciBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgV29yZFR5cGUtdHlwZSBoYXMgaW1wbGVtZW50ZWQgc3VwcG9ydCBmb3IgcmVwbGFjZVxuICAjIEBzZWUgV29yZFR5cGVcbiAgI1xuICBjbGFzcyBSZXBsYWNlTWFuYWdlciBleHRlbmRzIExpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoQGV2ZW50X3Byb3BlcnRpZXMsIEBldmVudF90aGlzLCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIG5vdCBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10/XG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzXG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgIyBpZiB0aGlzIHdhcyBjcmVhdGVkIGJ5IGFuIEFkZE5hbWUgb3BlcmF0aW9uLCBkZWxldGUgaXQgdG9vXG4gICAgICBpZiBAYWRkX25hbWVfb3BzP1xuICAgICAgICBmb3IgbyBpbiBAYWRkX25hbWVfb3BzXG4gICAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcbiAgICAjIFJlcGxhY2VhYmxlcyBhbHNvIG5vdCB0aHJvdyB0aGUgc2FtZSBldmVudHMuXG4gICAgIyBTbywgUmVwbGFjZU1hbmFnZXIgYW5kIExpc3RNYW5hZ2VyIGJvdGggaW1wbGVtZW50XG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cbiAgICAjXG4gICAgI1xuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxuICAgICAgaWYgbm90IEBpc0RlbGV0ZWQoKVxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xuICAgICAgICAgICAgZXZlbnRbbmFtZV0gPSBwcm9wXG4gICAgICAgIEBldmVudF90aGlzLmNhbGxFdmVudCBldmVudHNcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIHJlbHAgPSAobmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIChuZXcgdHlwZXMuRGVsZXRlIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFR5cGVcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiUmVwbGFjZU1hbmFnZXJcIlxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyAjIFRPRE86IGRvIHRoaXMgZXZlcnl3aGVyZTogYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbigpLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZU1hbmFnZXJcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdiZWdpbm5pbmcnIDogYmVnaW5uaW5nXG4gICAgICAnZW5kJyA6IGVuZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VNYW5hZ2VyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlcy5cbiAgIyBAc2VlIFJlcGxhY2VNYW5hZ2VyXG4gICNcbiAgY2xhc3MgUmVwbGFjZWFibGUgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBjb250ZW50IFRoZSB2YWx1ZSB0aGF0IHRoaXMgUmVwbGFjZWFibGUgaG9sZHMuXG4gICAgIyBAcGFyYW0ge1JlcGxhY2VNYW5hZ2VyfSBwYXJlbnQgVXNlZCB0byByZXBsYWNlIHRoaXMgUmVwbGFjZWFibGUgd2l0aCBhbm90aGVyIG9uZS5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBpc19kZWxldGVkKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFJlcGxhY2VhYmxlLXR5cGVzIVwiXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuICAgICAgQGlzX2RlbGV0ZWQgPSBpc19kZWxldGVkXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VhYmxlXCJcblxuICAgICNcbiAgICAjIFJldHVybiB0aGUgY29udGVudCB0aGF0IHRoaXMgb3BlcmF0aW9uIGhvbGRzLlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgcmVzID0gc3VwZXJcbiAgICAgIGlmIEBjb250ZW50P1xuICAgICAgICBpZiBAbmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIEBjb250ZW50LmRlbGV0ZUFsbE9ic2VydmVycygpXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgICAgQGNvbnRlbnQuZG9udFN5bmMoKVxuICAgICAgQGNvbnRlbnQgPSBudWxsXG4gICAgICByZXNcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBUaGlzIGlzIGNhbGxlZCwgd2hlbiB0aGUgSW5zZXJ0LXR5cGUgd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjIFRPRE86IGNvbnNpZGVyIGRvaW5nIHRoaXMgaW4gYSBtb3JlIGNvbnNpc3RlbnQgbWFubmVyLiBUaGlzIGNvdWxkIGFsc28gYmVcbiAgICAjIGRvbmUgd2l0aCBleGVjdXRlLiBCdXQgY3VycmVudGx5LCB0aGVyZSBhcmUgbm8gc3BlY2l0YWwgSW5zZXJ0LXR5cGVzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCIgYW5kIEBwcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBAaXNfZGVsZXRlZCAjIFdoZW4gdGhpcyBpcyByZWNlaXZlZCBmcm9tIHRoZSBIQiwgdGhpcyBjb3VsZCBhbHJlYWR5IGJlIGRlbGV0ZWQhXG4gICAgICAgICAgb2xkX3ZhbHVlID0gQHByZXZfY2wuY29udGVudFxuICAgICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgICAgIGNoYW5nZWRCeTogQHVpZC5jcmVhdG9yXG4gICAgICAgICAgICBvbGRWYWx1ZTogb2xkX3ZhbHVlXG4gICAgICAgICAgXVxuICAgICAgICBAcHJldl9jbC5hcHBseURlbGV0ZSgpXG4gICAgICBlbHNlIGlmIEBuZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgVGhpcyB3b24ndCBiZSByZWNvZ25pemVkIGJ5IHRoZSB1c2VyLCBiZWNhdXNlIGFub3RoZXJcbiAgICAgICAgIyBjb25jdXJyZW50IG9wZXJhdGlvbiBpcyBzZXQgYXMgdGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIFJNXG4gICAgICAgIEBhcHBseURlbGV0ZSgpXG4gICAgICBlbHNlICMgcHJldiBfYW5kXyBuZXh0IGFyZSBEZWxpbWl0ZXJzLiBUaGlzIGlzIHRoZSBmaXJzdCBjcmVhdGVkIFJlcGxhY2VhYmxlIGluIHRoZSBSTVxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJhZGRcIlxuICAgICAgICAgIGNoYW5nZWRCeTogQHVpZC5jcmVhdG9yXG4gICAgICAgIF1cbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAobyktPlxuICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBvLnVpZC5jcmVhdG9yXG4gICAgICAgICAgb2xkVmFsdWU6IEBjb250ZW50XG4gICAgICAgIF1cblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VhYmxlXCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50Py5nZXRVaWQoKVxuICAgICAgICAgICdyZXBsYWNlX21hbmFnZXInIDogQHBhcmVudC5nZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnaXNfZGVsZXRlZCc6IEBpc19kZWxldGVkXG4gICAgICAgIH1cbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlYWJsZVwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3JlcGxhY2VfbWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdpc19kZWxldGVkJzogaXNfZGVsZXRlZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIGlzX2RlbGV0ZWRcblxuICB0eXBlc1snTGlzdE1hbmFnZXInXSA9IExpc3RNYW5hZ2VyXG4gIHR5cGVzWydNYXBNYW5hZ2VyJ10gPSBNYXBNYW5hZ2VyXG4gIHR5cGVzWydSZXBsYWNlTWFuYWdlciddID0gUmVwbGFjZU1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VhYmxlJ10gPSBSZXBsYWNlYWJsZVxuXG4gIGJhc2ljX3R5cGVzXG5cblxuXG5cblxuXG4iLCJzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9TdHJ1Y3R1cmVkVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBzdHJ1Y3R1cmVkX3R5cGVzID0gc3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gc3RydWN0dXJlZF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSBzdHJ1Y3R1cmVkX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBdCB0aGUgbW9tZW50IFRleHREZWxldGUgdHlwZSBlcXVhbHMgdGhlIERlbGV0ZSB0eXBlIGluIEJhc2ljVHlwZXMuXG4gICMgQHNlZSBCYXNpY1R5cGVzLkRlbGV0ZVxuICAjXG4gIGNsYXNzIFRleHREZWxldGUgZXh0ZW5kcyB0eXBlcy5EZWxldGVcbiAgcGFyc2VyW1wiVGV4dERlbGV0ZVwiXSA9IHBhcnNlcltcIkRlbGV0ZVwiXVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyBUZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgY29udGVudD8udWlkPy5jcmVhdG9yXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIlRleHRJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyICMgbm8gYnJhY2VzIGluZGVlZCFcbiAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAXG4gICAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIFRoZSByZXN1bHQgd2lsbCBiZSBjb25jYXRlbmF0ZWQgd2l0aCB0aGUgcmVzdWx0cyBmcm9tIHRoZSBvdGhlciBpbnNlcnQgb3BlcmF0aW9uc1xuICAgICMgaW4gb3JkZXIgdG8gcmV0cmlldmUgdGhlIGNvbnRlbnQgb2YgdGhlIGVuZ2luZS5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci50b0V4ZWN1dGVkQXJyYXlcbiAgICAjXG4gICAgdmFsOiAoY3VycmVudF9wb3NpdGlvbiktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpIG9yIG5vdCBAY29udGVudD9cbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudFxuICAgICAgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiVGV4dEluc2VydFwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgSGFuZGxlcyBhIFdvcmRUeXBlLWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgIyBAbm90ZSBDdXJyZW50bHksIG9ubHkgVGV4dCBpcyBzdXBwb3J0ZWQhXG4gICNcbiAgY2xhc3MgV29yZFR5cGUgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEB0ZXh0ZmllbGRzID0gW11cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIHdvcmQtdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHlhdHRhLnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiV29yZFR5cGVcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJXb3JkVHlwZVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgY29udGVudFxuXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50KS0+XG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG4gICAgICBpZiBjb250ZW50LnR5cGU/XG4gICAgICAgIChuZXcgVGV4dEluc2VydCBjb250ZW50LCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgIGVsc2VcbiAgICAgICAgZm9yIGMgaW4gY29udGVudFxuICAgICAgICAgIHRtcCA9IChuZXcgVGV4dEluc2VydCBjLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgICAgICBsZWZ0ID0gdG1wXG4gICAgICBAXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBUaGlzIFdvcmRUeXBlIG9iamVjdC5cbiAgICAjXG4gICAgaW5zZXJ0VGV4dDogKHBvc2l0aW9uLCBjb250ZW50KS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnRcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBUaGlzIFdvcmRUeXBlIG9iamVjdFxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvc2l0aW9uKzEpICMgcG9zaXRpb24gMCBpbiB0aGlzIGNhc2UgaXMgdGhlIGRlbGV0aW9uIG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXJcblxuICAgICAgZGVsZXRlX29wcyA9IFtdXG4gICAgICBmb3IgaSBpbiBbMC4uLmxlbmd0aF1cbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQgPSAobmV3IFRleHREZWxldGUgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpIGFuZCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBkZWxldGVfb3BzLnB1c2ggZC5fZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEdldCB0aGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgd29yZC5cbiAgICAjIEByZXR1cm4ge1N0cmluZ30gVGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIG9iamVjdC5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBjID0gZm9yIG8gaW4gQHRvQXJyYXkoKVxuICAgICAgICBpZiBvLnZhbD9cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBcIlwiXG4gICAgICBjLmpvaW4oJycpXG5cbiAgICAjXG4gICAgIyBTYW1lIGFzIFdvcmRUeXBlLnZhbFxuICAgICMgQHNlZSBXb3JkVHlwZS52YWxcbiAgICAjXG4gICAgdG9TdHJpbmc6ICgpLT5cbiAgICAgIEB2YWwoKVxuXG4gICAgI1xuICAgICMgQmluZCB0aGlzIFdvcmRUeXBlIHRvIGEgdGV4dGZpZWxkIG9yIGlucHV0IGZpZWxkLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB0ZXh0Ym94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXh0ZmllbGRcIik7XG4gICAgIyAgIHlhdHRhLmJpbmQodGV4dGJveCk7XG4gICAgI1xuICAgIGJpbmQ6ICh0ZXh0ZmllbGQpLT5cbiAgICAgIHdvcmQgPSBAXG4gICAgICB0ZXh0ZmllbGQudmFsdWUgPSBAdmFsKClcbiAgICAgIEB0ZXh0ZmllbGRzLnB1c2ggdGV4dGZpZWxkXG5cbiAgICAgIEBvYnNlcnZlIChldmVudHMpLT5cbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGlmIGV2ZW50LnR5cGUgaXMgXCJpbnNlcnRcIlxuICAgICAgICAgICAgb19wb3MgPSBldmVudC5wb3NpdGlvblxuICAgICAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgICAgICBpZiBjdXJzb3IgPD0gb19wb3NcbiAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGN1cnNvciArPSAxXG4gICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICAgICAgcmlnaHQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuXG4gICAgICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcbiAgICAgICAgICBlbHNlIGlmIGV2ZW50LnR5cGUgaXMgXCJkZWxldGVcIlxuICAgICAgICAgICAgb19wb3MgPSBldmVudC5wb3NpdGlvblxuICAgICAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgICAgICBpZiBjdXJzb3IgPCBvX3Bvc1xuICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgY3Vyc29yIC09IDFcbiAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG4gICAgICAjIGNvbnN1bWUgYWxsIHRleHQtaW5zZXJ0IGNoYW5nZXMuXG4gICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IG51bGxcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICBjaGFyID0gbnVsbFxuICAgICAgICBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgICAgY2hhciA9ICdcXG4nXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUgZXZlbnQua2V5Q29kZVxuICAgICAgICBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICBwb3MgPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcyksIGRpZmZcbiAgICAgICAgICB3b3JkLmluc2VydFRleHQgcG9zLCBjaGFyXG4gICAgICAgICAgbmV3X3BvcyA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25jdXQgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAjXG4gICAgICAjIGNvbnN1bWUgZGVsZXRlcy4gTm90ZSB0aGF0XG4gICAgICAjICAgY2hyb21lOiB3b24ndCBjb25zdW1lIGRlbGV0aW9ucyBvbiBrZXlwcmVzcyBldmVudC5cbiAgICAgICMgICBrZXlDb2RlIGlzIGRlcHJlY2F0ZWQuIEJVVDogSSBkb24ndCBzZWUgYW5vdGhlciB3YXkuXG4gICAgICAjICAgICBzaW5jZSBldmVudC5rZXkgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IHZlcnNpb24gb2YgY2hyb21lLlxuICAgICAgIyAgICAgRXZlcnkgYnJvd3NlciBzdXBwb3J0cyBrZXlDb2RlLiBMZXQncyBzdGljayB3aXRoIGl0IGZvciBub3cuLlxuICAgICAgI1xuICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgOCAjIEJhY2tzcGFjZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB0ZXh0ZmllbGQudmFsdWVcbiAgICAgICAgICAgICAgbmV3X3BvcyA9IHBvc1xuICAgICAgICAgICAgICBkZWxfbGVuZ3RoID0gMFxuICAgICAgICAgICAgICBpZiBwb3MgPiAwXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdoaWxlIG5ld19wb3MgPiAwIGFuZCB2YWxbbmV3X3Bvc10gaXNudCBcIiBcIiBhbmQgdmFsW25ld19wb3NdIGlzbnQgJ1xcbidcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IChwb3MtMSksIDFcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgNDYgIyBEZWxldGVcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgMVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiV29yZFR5cGVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gIyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luKCkuZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ1dvcmRUeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmRUeXBlIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkVHlwZSddID0gV29yZFR5cGVcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuWWF0dGEgPSByZXF1aXJlICcuL3lhdHRhJ1xuXG5iaW5kVG9DaGlsZHJlbiA9ICh0aGF0KS0+XG4gIGZvciBpIGluIFswLi4udGhhdC5jaGlsZHJlbi5sZW5ndGhdXG4gICAgYXR0ciA9IHRoYXQuY2hpbGRyZW4uaXRlbShpKVxuICAgIGlmIGF0dHIubmFtZT9cbiAgICAgIGF0dHIudmFsID0gdGhhdC52YWwudmFsKGF0dHIubmFtZSlcbiAgdGhhdC52YWwub2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgaWYgZXZlbnQubmFtZT9cbiAgICAgICAgZm9yIGkgaW4gWzAuLi50aGF0LmNoaWxkcmVuLmxlbmd0aF1cbiAgICAgICAgICBhdHRyID0gdGhhdC5jaGlsZHJlbi5pdGVtKGkpXG4gICAgICAgICAgaWYgYXR0ci5uYW1lPyBhbmQgYXR0ci5uYW1lIGlzIGV2ZW50Lm5hbWVcbiAgICAgICAgICAgIG5ld1ZhbCA9IHRoYXQudmFsLnZhbChhdHRyLm5hbWUpXG4gICAgICAgICAgICBpZiBhdHRyLnZhbCBpc250IG5ld1ZhbFxuICAgICAgICAgICAgICBhdHRyLnZhbCA9IG5ld1ZhbFxuXG5Qb2x5bWVyIFwieWF0dGEtZWxlbWVudFwiLFxuICByZWFkeTogKCktPlxuICAgIGlmIEBjb25uZWN0b3I/XG4gICAgICBAdmFsID0gbmV3IFlhdHRhIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcbiAgICBlbHNlIGlmIEB2YWw/XG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgdmFsQ2hhbmdlZDogKCktPlxuICAgIGlmIEB2YWw/IGFuZCBAdmFsLnR5cGUgaXMgXCJKc29uVHlwZVwiXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgY29ubmVjdG9yQ2hhbmdlZDogKCktPlxuICAgIGlmIChub3QgQHZhbD8pXG4gICAgICBAdmFsID0gbmV3IFlhdHRhIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuUG9seW1lciBcInlhdHRhLXByb3BlcnR5XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEBuYW1lP1xuICAgICAgaWYgQHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgQHZhbCA9IEBwYXJlbnRFbGVtZW50LnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgdHlwZW9mIEB2YWwgaXMgXCJzdHJpbmdcIlxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwoQG5hbWUsQHZhbClcbiAgICAgIGlmIEB2YWwudHlwZSBpcyBcIkpzb25UeXBlXCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsLnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgQHZhbC50eXBlIGlzIFwiSnNvblR5cGVcIlxuICAgICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgICBlbHNlIGlmIEB2YWwgaXNudCBAcGFyZW50RWxlbWVudC52YWwudmFsKEBuYW1lKVxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwudmFsIEBuYW1lLCBAdmFsXG5cblxuIiwiXG5qc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UeXBlcy9Kc29uVHlwZXNcIlxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVlhdHRhID0gKGNvbm5lY3RvciktPlxuICB1c2VyX2lkID0gbnVsbFxuICBpZiBjb25uZWN0b3IuaWQ/XG4gICAgdXNlcl9pZCA9IGNvbm5lY3Rvci5pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLndoZW5Vc2VySWRTZXQgKGlkKS0+XG4gICAgICB1c2VyX2lkID0gaWRcbiAgICAgIEhCLnJlc2V0VXNlcklkIGlkXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICB0eXBlX21hbmFnZXIgPSBqc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSB0eXBlX21hbmFnZXIudHlwZXNcblxuICAjXG4gICMgRnJhbWV3b3JrIGZvciBKc29uIGRhdGEtc3RydWN0dXJlcy5cbiAgIyBLbm93biB2YWx1ZXMgdGhhdCBhcmUgc3VwcG9ydGVkOlxuICAjICogU3RyaW5nXG4gICMgKiBJbnRlZ2VyXG4gICMgKiBBcnJheVxuICAjXG4gIGNsYXNzIFlhdHRhIGV4dGVuZHMgdHlwZXMuSnNvblR5cGVcblxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXF1ZSBpZCBvZiB0aGUgcGVlci5cbiAgICAjIEBwYXJhbSB7Q29ubmVjdG9yfSBDb25uZWN0b3IgdGhlIGNvbm5lY3RvciBjbGFzcy5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3IgPSBjb25uZWN0b3JcbiAgICAgIEBIQiA9IEhCXG4gICAgICBAdHlwZXMgPSB0eXBlc1xuICAgICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0eXBlX21hbmFnZXIucGFyc2VyXG4gICAgICBhZGFwdENvbm5lY3RvciBAY29ubmVjdG9yLCBAZW5naW5lLCBASEIsIHR5cGVfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcbiAgICAgIHN1cGVyXG5cbiAgICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3JcblxuICByZXR1cm4gbmV3IFlhdHRhKEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKS5leGVjdXRlKClcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZYXR0YVxuaWYgd2luZG93PyBhbmQgbm90IHdpbmRvdy5ZYXR0YT9cbiAgd2luZG93LllhdHRhID0gY3JlYXRlWWF0dGFcbiJdfQ==
