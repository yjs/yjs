(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Engine;

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

  Engine.prototype.applyOpsBundle = function(ops_json) {
    var o, ops, _i, _j, _k, _len, _len1, _len2;
    ops = [];
    for (_i = 0, _len = ops_json.length; _i < _len; _i++) {
      o = ops_json[_i];
      ops.push(this.parseOperation(o));
    }
    for (_j = 0, _len1 = ops.length; _j < _len1; _j++) {
      o = ops[_j];
      this.HB.addOperation(o);
    }
    for (_k = 0, _len2 = ops.length; _k < _len2; _k++) {
      o = ops[_k];
      if (!o.execute()) {
        this.unprocessed_ops.push(o);
      }
    }
    return this.tryUnprocessed();
  };

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
    var o, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = ops_json.length; _i < _len; _i++) {
      o = ops_json[_i];
      _results.push(this.applyOp(o));
    }
    return _results;
  };

  Engine.prototype.applyOp = function(op_json) {
    var o;
    o = this.parseOperation(op_json);
    this.HB.addToCounter(o);
    if (!o.execute()) {
      this.unprocessed_ops.push(o);
    } else {
      this.HB.addOperation(o);
    }
    return this.tryUnprocessed();
  };

  Engine.prototype.tryUnprocessed = function() {
    var old_length, op, unprocessed, _i, _len, _ref, _results;
    _results = [];
    while (true) {
      old_length = this.unprocessed_ops.length;
      unprocessed = [];
      _ref = this.unprocessed_ops;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        op = _ref[_i];
        if (!op.execute()) {
          unprocessed.push(op);
        } else {
          this.HB.addOperation(op);
        }
      }
      this.unprocessed_ops = unprocessed;
      if (this.unprocessed_ops.length === old_length) {
        break;
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  return Engine;

})();

module.exports = Engine;


},{}],2:[function(require,module,exports){
var Engine, HistoryBuffer, JsonFramework, json_types_uninitialized;

json_types_uninitialized = require("../Types/JsonTypes");

HistoryBuffer = require("../HistoryBuffer");

Engine = require("../Engine");

JsonFramework = (function() {
  function JsonFramework(user_id, Connector) {
    var beg, end, first_word, type_manager, uid_beg, uid_end;
    this.HB = new HistoryBuffer(user_id);
    type_manager = json_types_uninitialized(this.HB);
    this.types = type_manager.types;
    this.engine = new Engine(this.HB, type_manager.parser);
    this.HB.engine = this.engine;
    this.connector = new Connector(this.engine, this.HB, type_manager.execution_listener, this);
    first_word = new this.types.JsonType(this.HB.getReservedUniqueIdentifier());
    this.HB.addOperation(first_word).execute();
    uid_beg = this.HB.getReservedUniqueIdentifier();
    uid_end = this.HB.getReservedUniqueIdentifier();
    beg = this.HB.addOperation(new this.types.Delimiter(uid_beg, void 0, uid_end)).execute();
    end = this.HB.addOperation(new this.types.Delimiter(uid_end, beg, void 0)).execute();
    this.root_element = new this.types.ReplaceManager(void 0, this.HB.getReservedUniqueIdentifier(), beg, end);
    this.HB.addOperation(this.root_element).execute();
    this.root_element.replace(first_word, this.HB.getReservedUniqueIdentifier());
  }

  JsonFramework.prototype.getSharedObject = function() {
    return this.root_element.val();
  };

  JsonFramework.prototype.getConnector = function() {
    return this.connector;
  };

  JsonFramework.prototype.getHistoryBuffer = function() {
    return this.HB;
  };

  JsonFramework.prototype.setMutableDefault = function(mutable) {
    return this.getSharedObject().setMutableDefault(mutable);
  };

  JsonFramework.prototype.getUserId = function() {
    return this.HB.getUserId();
  };

  JsonFramework.prototype.toJson = function() {
    return this.getSharedObject().toJson();
  };

  JsonFramework.prototype.val = function(name, content, mutable) {
    return this.getSharedObject().val(name, content, mutable);
  };

  JsonFramework.prototype.on = function() {
    var _ref;
    return (_ref = this.getSharedObject()).on.apply(_ref, arguments);
  };

  JsonFramework.prototype.deleteListener = function() {
    var _ref;
    return (_ref = this.getSharedObject()).deleteListener.apply(_ref, arguments);
  };

  Object.defineProperty(JsonFramework.prototype, 'value', {
    get: function() {
      return this.getSharedObject().value;
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

  return JsonFramework;

})();

module.exports = JsonFramework;

if (typeof window !== "undefined" && window !== null) {
  if (window.Y == null) {
    window.Y = {};
  }
  window.Y.JsonFramework = JsonFramework;
}


},{"../Engine":1,"../HistoryBuffer":3,"../Types/JsonTypes":5}],3:[function(require,module,exports){
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
      this.doSync = true;
      this.garbage_collected = false;
      if (uid == null) {
        uid = HB.getNextOperationIdentifier();
      }
      if (uid.doSync == null) {
        uid.doSync = !isNaN(parseInt(uid.op_number));
      }
      this.creator = uid['creator'], this.op_number = uid['op_number'], this.doSync = uid['doSync'];
    }

    Operation.prototype.type = "Insert";

    Operation.prototype.on = function(events, f) {
      var e, _base, _i, _len, _results;
      if (this.event_listeners == null) {
        this.event_listeners = {};
      }
      if (events.constructor !== [].constructor) {
        events = [events];
      }
      _results = [];
      for (_i = 0, _len = events.length; _i < _len; _i++) {
        e = events[_i];
        if ((_base = this.event_listeners)[e] == null) {
          _base[e] = [];
        }
        _results.push(this.event_listeners[e].push(f));
      }
      return _results;
    };

    Operation.prototype.deleteListener = function(events, f) {
      var e, _i, _len, _ref, _results;
      if (events.constructor !== [].constructor) {
        events = [events];
      }
      _results = [];
      for (_i = 0, _len = events.length; _i < _len; _i++) {
        e = events[_i];
        if (((_ref = this.event_listeners) != null ? _ref[e] : void 0) != null) {
          _results.push(this.event_listeners[e] = this.event_listeners[e].filter(function(g) {
            return f !== g;
          }));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Operation.prototype.callEvent = function() {
      return this.forwardEvent.apply(this, [this].concat(__slice.call(arguments)));
    };

    Operation.prototype.forwardEvent = function() {
      var args, event, f, op, _i, _len, _ref, _ref1, _results;
      op = arguments[0], event = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
      if (((_ref = this.event_listeners) != null ? _ref[event] : void 0) != null) {
        _ref1 = this.event_listeners[event];
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          f = _ref1[_i];
          _results.push(f.call.apply(f, [op, event].concat(__slice.call(args))));
        }
        return _results;
      }
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
      return HB.removeOperation(this);
    };

    Operation.prototype.setParent = function(parent) {
      this.parent = parent;
    };

    Operation.prototype.getParent = function() {
      return this.parent;
    };

    Operation.prototype.getUid = function() {
      return {
        'creator': this.creator,
        'op_number': this.op_number,
        'sync': this.doSync
      };
    };

    Operation.prototype.dontSync = function() {
      return this.doSync = false;
    };

    Operation.prototype.execute = function() {
      var l, _i, _len;
      this.is_executed = true;
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
      if (this.validateSavedOperations()) {
        this.deletes.applyDelete(this);
        return Delete.__super__.execute.apply(this, arguments);
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
      var garbagecollect;
      if (this.deleted_by == null) {
        this.deleted_by = [];
      }
      if ((this.parent != null) && !this.isDeleted()) {
        this.parent.callEvent("delete", this, o);
      }
      if (o != null) {
        this.deleted_by.push(o);
      }
      garbagecollect = false;
      if (this.prev_cl.isDeleted()) {
        garbagecollect = true;
      }
      Insert.__super__.applyDelete.call(this, garbagecollect);
      if (this.next_cl.isDeleted()) {
        return this.next_cl.applyDelete();
      }
    };

    Insert.prototype.cleanup = function() {
      var d, o, _i, _len, _ref;
      if (this.prev_cl.isDeleted()) {
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

    Insert.prototype.execute = function(fire_event) {
      var distance_to_origin, i, o, parent, _ref;
      if (fire_event == null) {
        fire_event = true;
      }
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
                if (o.creator < this.creator) {
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
        parent = (_ref = this.prev_cl) != null ? _ref.getParent() : void 0;
        if ((parent != null) && fire_event) {
          this.setParent(parent);
          this.parent.callEvent("insert", this);
        }
        return Insert.__super__.execute.apply(this, arguments);
      }
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
          delete this.prev_cl.unchecked.next_cl;
          return Delimiter.__super__.execute.apply(this, arguments);
        } else {
          return false;
        }
      } else if ((this.prev_cl != null) && (this.prev_cl.next_cl == null)) {
        delete this.prev_cl.unchecked.next_cl;
        return this.prev_cl.next_cl = this;
      } else if ((this.prev_cl != null) || (this.next_cl != null)) {
        return Delimiter.__super__.execute.apply(this, arguments);
      } else {
        throw new Error("Delimiter is unsufficient defined!");
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
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

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

    function JsonType(uid, initial_value, mutable) {
      var name, o;
      JsonType.__super__.constructor.call(this, uid);
      if (initial_value != null) {
        if (typeof initial_value !== "object") {
          throw new Error("The initial value of JsonTypes must be of type Object! (current type: " + (typeof initial_value) + ")");
        }
        for (name in initial_value) {
          o = initial_value[name];
          this.val(name, o, mutable);
        }
      }
    }

    JsonType.prototype.type = "JsonType";

    JsonType.prototype.applyDelete = function() {
      return JsonType.__super__.applyDelete.call(this);
    };

    JsonType.prototype.cleanup = function() {
      return JsonType.__super__.cleanup.call(this);
    };

    JsonType.prototype.toJson = function() {
      var json, name, o, val;
      val = this.val();
      json = {};
      for (name in val) {
        o = val[name];
        if (o === null) {
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
      return json;
    };

    JsonType.prototype.setReplaceManager = function(replace_manager) {
      this.replace_manager = replace_manager;
      return this.on(['change', 'addProperty'], function() {
        var _ref;
        if (replace_manager.parent != null) {
          return (_ref = replace_manager.parent).forwardEvent.apply(_ref, [this].concat(__slice.call(arguments)));
        }
      });
    };

    JsonType.prototype.getParent = function() {
      return this.replace_manager.parent;
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
      var json, obj, word;
      if (typeof name === 'object') {
        json = new JsonType(void 0, name, content);
        HB.addOperation(json).execute();
        this.replace_manager.replace(json);
        return this;
      } else if ((name != null) && ((content != null) || content === null)) {
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
        } else if (content === null || (((!mutable) || typeof content === 'number') && content.constructor !== Object)) {
          obj = HB.addOperation(new types.ImmutableObject(void 0, content)).execute();
          return JsonType.__super__.val.call(this, name, obj);
        } else {
          if (typeof content === 'string') {
            word = HB.addOperation(new types.WordType(void 0)).execute();
            word.insertText(0, content);
            return JsonType.__super__.val.call(this, name, word);
          } else if (content.constructor === Object) {
            json = HB.addOperation(new JsonType(void 0, content, mutable)).execute();
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
      var o, obj, result, _ref, _ref1;
      if (content != null) {
        if (this.map[name] == null) {
          HB.addOperation(new AddName(void 0, this, name)).execute();
        }
        this.map[name].replace(content);
        return this;
      } else if (name != null) {
        obj = (_ref = this.map[name]) != null ? _ref.val() : void 0;
        if (obj instanceof types.ImmutableObject) {
          return obj.val();
        } else {
          return obj;
        }
      } else {
        result = {};
        _ref1 = this.map;
        for (name in _ref1) {
          o = _ref1[name];
          obj = o.val();
          if (obj instanceof types.ImmutableObject || obj instanceof MapManager) {
            obj = obj.val();
          }
          result[name] = obj;
        }
        return result;
      }
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
      var beg, end, uid_beg, uid_end, uid_r, _base;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        uid_r = this.map_manager.getUid();
        uid_r.op_number = "_" + uid_r.op_number + "_RM_" + this.name;
        if (HB.getOperation(uid_r) == null) {
          uid_beg = this.map_manager.getUid();
          uid_beg.op_number = "_" + uid_beg.op_number + "_RM_" + this.name + "_beginning";
          uid_end = this.map_manager.getUid();
          uid_end.op_number = "_" + uid_end.op_number + "_RM_" + this.name + "_end";
          beg = HB.addOperation(new types.Delimiter(uid_beg, void 0, uid_end)).execute();
          end = HB.addOperation(new types.Delimiter(uid_end, beg, void 0)).execute();
          this.map_manager.map[this.name] = HB.addOperation(new ReplaceManager(void 0, uid_r, beg, end));
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
        this.beginning = HB.addOperation(new types.Delimiter(void 0, void 0, void 0));
        this.end = HB.addOperation(new types.Delimiter(void 0, this.beginning, void 0));
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
      o = this.beginning.next_cl;
      if ((position > 0 || o.isDeleted()) && !(o instanceof types.Delimiter)) {
        while (o.isDeleted() && !(o instanceof types.Delimiter)) {
          o = o.next_cl;
        }
        while (true) {
          if (o instanceof types.Delimiter) {
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
      }
      return o;
    };

    return ListManager;

  })(types.Operation);
  ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(initial_content, uid, beginning, end, prev, next, origin) {
      ReplaceManager.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
      if (initial_content != null) {
        this.replace(initial_content);
      }
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

    ReplaceManager.prototype.replace = function(content, replaceable_uid) {
      var o, op;
      o = this.getLastOperation();
      op = new Replaceable(content, this, replaceable_uid, o, o.next_cl);
      HB.addOperation(op).execute();
      return void 0;
    };

    ReplaceManager.prototype.setParent = function(parent, property_name) {
      var addPropertyListener, repl_manager;
      repl_manager = this;
      this.on('insert', function(event, op) {
        if (op.next_cl instanceof types.Delimiter) {
          return repl_manager.parent.callEvent('change', property_name, op);
        }
      });
      this.on('change', function(event, op) {
        if (repl_manager !== this) {
          return repl_manager.parent.callEvent('change', property_name, op);
        }
      });
      addPropertyListener = function(event, op) {
        repl_manager.parent.callEvent('addProperty', property_name, op);
        return repl_manager.deleteListener('addProperty', addPropertyListener);
      };
      this.on('insert', addPropertyListener);
      return ReplaceManager.__super__.setParent.call(this, parent);
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
    var beginning, content, end, next, origin, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], beginning = json['beginning'], end = json['end'];
    return new ReplaceManager(content, uid, beginning, end, prev, next, origin);
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

    Replaceable.prototype.replace = function(content) {
      return this.parent.replace(content);
    };

    Replaceable.prototype.applyDelete = function() {
      if (this.content != null) {
        this.content.applyDelete();
        this.content.dontSync();
      }
      this.content = null;
      return Replaceable.__super__.applyDelete.apply(this, arguments);
    };

    Replaceable.prototype.cleanup = function() {
      return Replaceable.__super__.cleanup.apply(this, arguments);
    };

    Replaceable.prototype.execute = function() {
      var ins_result, _ref;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if ((_ref = this.content) != null) {
          if (typeof _ref.setReplaceManager === "function") {
            _ref.setReplaceManager(this.parent);
          }
        }
        ins_result = Replaceable.__super__.execute.call(this, this.content != null);
        if (ins_result) {
          if (this.next_cl.type === "Delimiter" && this.prev_cl.type !== "Delimiter") {
            this.prev_cl.applyDelete();
          } else if (this.next_cl.type !== "Delimiter") {
            this.applyDelete();
          }
        }
        return ins_result;
      }
    };

    Replaceable.prototype._encode = function() {
      var json, _ref;
      json = {
        'type': "Replaceable",
        'content': (_ref = this.content) != null ? _ref.getUid() : void 0,
        'ReplaceManager': this.parent.getUid(),
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
    content = json['content'], parent = json['ReplaceManager'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'];
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
      this.content = content;
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
      this.content = null;
      return TextInsert.__super__.applyDelete.apply(this, arguments);
    };

    TextInsert.prototype.val = function(current_position) {
      if (this.isDeleted() || (this.content == null)) {
        return "";
      } else {
        return this.content;
      }
    };

    TextInsert.prototype._encode = function() {
      var json;
      json = {
        'type': "TextInsert",
        'content': this.content,
        'uid': this.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid()
      };
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

    WordType.prototype.insertText = function(position, content) {
      var c, ith, left, op, right, _i, _len;
      ith = this.getOperationByPosition(position);
      left = ith.prev_cl;
      while (left.isDeleted()) {
        left = left.prev_cl;
      }
      right = left.next_cl;
      for (_i = 0, _len = content.length; _i < _len; _i++) {
        c = content[_i];
        op = new TextInsert(c, void 0, left, right);
        HB.addOperation(op).execute();
        left = op;
      }
      return this;
    };

    WordType.prototype.deleteText = function(position, length) {
      var d, delete_ops, i, o, _i;
      o = this.getOperationByPosition(position);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof types.Delimiter) {
          break;
        }
        d = HB.addOperation(new TextDelete(void 0, o)).execute();
        o = o.next_cl;
        while (!(o instanceof types.Delimiter) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return this;
    };

    WordType.prototype.replaceText = function(text) {
      var word;
      if (this.replace_manager != null) {
        word = HB.addOperation(new WordType(void 0)).execute();
        word.insertText(0, text);
        this.replace_manager.replace(word);
        return word;
      } else {
        throw new Error("This type is currently not maintained by a ReplaceManager!");
      }
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

    WordType.prototype.setReplaceManager = function(op) {
      this.saveOperation('replace_manager', op);
      this.validateSavedOperations();
      this.on('insert', (function(_this) {
        return function(event, ins) {
          var _ref;
          return (_ref = _this.replace_manager) != null ? _ref.forwardEvent(_this, 'change', ins) : void 0;
        };
      })(this));
      return this.on('delete', (function(_this) {
        return function(event, ins, del) {
          var _ref;
          return (_ref = _this.replace_manager) != null ? _ref.forwardEvent(_this, 'change', del) : void 0;
        };
      })(this));
    };

    WordType.prototype.bind = function(textfield) {
      var word;
      word = this;
      textfield.value = this.val();
      this.on("insert", function(event, op) {
        var fix, left, o_pos, right;
        o_pos = op.getPosition();
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
        return textfield.setSelectionRange(left, right);
      });
      this.on("delete", function(event, op) {
        var fix, left, o_pos, right;
        o_pos = op.getPosition();
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
        return textfield.setSelectionRange(left, right);
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


},{"./StructuredTypes":6}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0ZyYW1ld29ya3MvSnNvbkZyYW1ld29yay5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0hpc3RvcnlCdWZmZXIuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvSnNvblR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvU3RydWN0dXJlZFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0tBLElBQUEsTUFBQTs7QUFBQTtBQU1lLEVBQUEsZ0JBQUUsRUFBRixFQUFPLE1BQVAsR0FBQTtBQUNYLElBRFksSUFBQyxDQUFBLEtBQUEsRUFDYixDQUFBO0FBQUEsSUFEaUIsSUFBQyxDQUFBLFNBQUEsTUFDbEIsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGVBQUQsR0FBbUIsRUFBbkIsQ0FEVztFQUFBLENBQWI7O0FBQUEsbUJBTUEsY0FBQSxHQUFnQixTQUFDLElBQUQsR0FBQTtBQUNkLFFBQUEsVUFBQTtBQUFBLElBQUEsVUFBQSxHQUFhLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBSSxDQUFDLElBQUwsQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBRyxrQkFBSDth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QkFBSDtBQUNFLFFBQUEsSUFBSyxDQUFBLE1BQUEsQ0FBTCxHQUFlLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBQWYsQ0FERjtPQU5BO0FBUUEsTUFBQSxJQUFHLG9CQUFIO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQURGO09BUkE7QUFVQSxNQUFBLElBQUcsbUJBQUg7QUFDRSxRQUFBLElBQUssQ0FBQSxRQUFBLENBQUwsR0FBaUIsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUFTLENBQUMsTUFBVixDQUFBLENBQWpCLENBREY7T0FWQTthQVlBLEtBYk87SUFBQSxDQS9OVCxDQUFBOztvQkFBQTs7S0FOcUIsS0FBSyxDQUFDLFlBbkY3QixDQUFBO0FBQUEsRUF1VUEsTUFBTyxDQUFBLFVBQUEsQ0FBUCxHQUFxQixTQUFDLElBQUQsR0FBQTtBQUNuQixRQUFBLHVDQUFBO0FBQUEsSUFDVSxXQUFSLE1BREYsRUFFZ0IsaUJBQWQsWUFGRixFQUdVLFdBQVIsTUFIRixFQUlVLFlBQVIsT0FKRixFQUtVLFlBQVIsT0FMRixFQU1hLGNBQVgsU0FORixDQUFBO1dBUUksSUFBQSxRQUFBLENBQVMsR0FBVCxFQUFjLFNBQWQsRUFBeUIsR0FBekIsRUFBOEIsSUFBOUIsRUFBb0MsSUFBcEMsRUFBMEMsTUFBMUMsRUFUZTtFQUFBLENBdlVyQixDQUFBO0FBQUEsRUFrVkEsS0FBTSxDQUFBLFlBQUEsQ0FBTixHQUFzQixVQWxWdEIsQ0FBQTtBQUFBLEVBbVZBLEtBQU0sQ0FBQSxZQUFBLENBQU4sR0FBc0IsVUFuVnRCLENBQUE7QUFBQSxFQW9WQSxLQUFNLENBQUEsVUFBQSxDQUFOLEdBQW9CLFFBcFZwQixDQUFBO1NBcVZBLGlCQXRWZTtBQUFBLENBRmpCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXHJcbiNcclxuIyBAbm9kb2NcclxuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxyXG4jXHJcbmNsYXNzIEVuZ2luZVxyXG5cclxuICAjXHJcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXHJcbiAgIyBAcGFyYW0ge0FycmF5fSBwYXJzZXIgRGVmaW5lcyBob3cgdG8gcGFyc2UgZW5jb2RlZCBtZXNzYWdlcy5cclxuICAjXHJcbiAgY29uc3RydWN0b3I6IChASEIsIEBwYXJzZXIpLT5cclxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxyXG5cclxuICAjXHJcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cclxuICAjXHJcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XHJcbiAgICB0eXBlUGFyc2VyID0gQHBhcnNlcltqc29uLnR5cGVdXHJcbiAgICBpZiB0eXBlUGFyc2VyP1xyXG4gICAgICB0eXBlUGFyc2VyIGpzb25cclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxyXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXHJcbiAgI1xyXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cclxuICAgIG9wcyA9IFtdXHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxyXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXHJcbiAgI1xyXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xyXG4gICAgICAgIEBhcHBseU9wIG9cclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXHJcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wXHJcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXHJcbiAgI1xyXG4gIGFwcGx5T3A6IChvcF9qc29uKS0+XHJcbiAgICAjICRwYXJzZV9hbmRfZXhlY3V0ZSB3aWxsIHJldHVybiBmYWxzZSBpZiAkb19qc29uIHdhcyBwYXJzZWQgYW5kIGV4ZWN1dGVkLCBvdGhlcndpc2UgdGhlIHBhcnNlZCBvcGVyYWRpb25cclxuICAgIG8gPSBAcGFyc2VPcGVyYXRpb24gb3BfanNvblxyXG4gICAgQEhCLmFkZFRvQ291bnRlciBvXHJcbiAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBlbHNlXHJcbiAgICAgIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcclxuXHJcbiAgI1xyXG4gICMgQ2FsbCB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhcHBsaWVkIGEgbmV3IG9wZXJhdGlvbi5cclxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cclxuICAjXHJcbiAgdHJ5VW5wcm9jZXNzZWQ6ICgpLT5cclxuICAgIHdoaWxlIHRydWVcclxuICAgICAgb2xkX2xlbmd0aCA9IEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoXHJcbiAgICAgIHVucHJvY2Vzc2VkID0gW11cclxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcclxuICAgICAgICBpZiBub3Qgb3AuZXhlY3V0ZSgpXHJcbiAgICAgICAgICB1bnByb2Nlc3NlZC5wdXNoIG9wXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvcFxyXG4gICAgICBAdW5wcm9jZXNzZWRfb3BzID0gdW5wcm9jZXNzZWRcclxuICAgICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXMgb2xkX2xlbmd0aFxyXG4gICAgICAgIGJyZWFrXHJcblxyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEVuZ2luZVxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG4iLCJcbmpzb25fdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuLi9UeXBlcy9Kc29uVHlwZXNcIlxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuLi9IaXN0b3J5QnVmZmVyXCJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuLi9FbmdpbmVcIlxuXG4jXG4jIEZyYW1ld29yayBmb3IgSnNvbiBkYXRhLXN0cnVjdHVyZXMuXG4jIEtub3duIHZhbHVlcyB0aGF0IGFyZSBzdXBwb3J0ZWQ6XG4jICogU3RyaW5nXG4jICogSW50ZWdlclxuIyAqIEFycmF5XG4jXG5jbGFzcyBKc29uRnJhbWV3b3JrXG5cbiAgI1xuICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXF1ZSBpZCBvZiB0aGUgcGVlci5cbiAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIHRoZSBjb25uZWN0b3IgY2xhc3MuXG4gICNcbiAgY29uc3RydWN0b3I6ICh1c2VyX2lkLCBDb25uZWN0b3IpLT5cbiAgICBASEIgPSBuZXcgSGlzdG9yeUJ1ZmZlciB1c2VyX2lkXG4gICAgdHlwZV9tYW5hZ2VyID0ganNvbl90eXBlc191bmluaXRpYWxpemVkIEBIQlxuICAgIEB0eXBlcyA9IHR5cGVfbWFuYWdlci50eXBlc1xuICAgIEBlbmdpbmUgPSBuZXcgRW5naW5lIEBIQiwgdHlwZV9tYW5hZ2VyLnBhcnNlclxuICAgIEBIQi5lbmdpbmUgPSBAZW5naW5lICMgVE9ETzogISEgb25seSBmb3IgZGVidWdnaW5nXG4gICAgQGNvbm5lY3RvciA9IG5ldyBDb25uZWN0b3IgQGVuZ2luZSwgQEhCLCB0eXBlX21hbmFnZXIuZXhlY3V0aW9uX2xpc3RlbmVyLCBAXG4gICAgZmlyc3Rfd29yZCA9IG5ldyBAdHlwZXMuSnNvblR5cGUoQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKVxuICAgIEBIQi5hZGRPcGVyYXRpb24oZmlyc3Rfd29yZCkuZXhlY3V0ZSgpXG5cbiAgICB1aWRfYmVnID0gQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpXG4gICAgdWlkX2VuZCA9IEBIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKVxuICAgIGJlZyA9IEBIQi5hZGRPcGVyYXRpb24obmV3IEB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICBlbmQgPSBASEIuYWRkT3BlcmF0aW9uKG5ldyBAdHlwZXMuRGVsaW1pdGVyIHVpZF9lbmQsIGJlZywgdW5kZWZpbmVkKS5leGVjdXRlKClcblxuICAgIEByb290X2VsZW1lbnQgPSBuZXcgQHR5cGVzLlJlcGxhY2VNYW5hZ2VyIHVuZGVmaW5lZCwgQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpLCBiZWcsIGVuZFxuICAgIEBIQi5hZGRPcGVyYXRpb24oQHJvb3RfZWxlbWVudCkuZXhlY3V0ZSgpXG4gICAgQHJvb3RfZWxlbWVudC5yZXBsYWNlIGZpcnN0X3dvcmQsIEBIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKVxuXG4gICNcbiAgIyBAcmV0dXJuIEpzb25UeXBlXG4gICNcbiAgZ2V0U2hhcmVkT2JqZWN0OiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudC52YWwoKVxuXG4gICNcbiAgIyBHZXQgdGhlIGluaXRpYWxpemVkIGNvbm5lY3Rvci5cbiAgI1xuICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICBAY29ubmVjdG9yXG5cbiAgI1xuICAjIEBzZWUgSGlzdG9yeUJ1ZmZlclxuICAjXG4gIGdldEhpc3RvcnlCdWZmZXI6ICgpLT5cbiAgICBASEJcblxuICAjXG4gICMgQHNlZSBKc29uVHlwZS5zZXRNdXRhYmxlRGVmYXVsdFxuICAjXG4gIHNldE11dGFibGVEZWZhdWx0OiAobXV0YWJsZSktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS5zZXRNdXRhYmxlRGVmYXVsdChtdXRhYmxlKVxuXG4gICNcbiAgIyBHZXQgdGhlIFVzZXJJZCBmcm9tIHRoZSBIaXN0b3J5QnVmZmVyIG9iamVjdC5cbiAgIyBJbiBtb3N0IGNhc2VzIHRoaXMgd2lsbCBiZSB0aGUgc2FtZSBhcyB0aGUgdXNlcl9pZCB2YWx1ZSB3aXRoIHdoaWNoXG4gICMgSnNvbkZyYW1ld29yayB3YXMgaW5pdGlhbGl6ZWQgKERlcGVuZGluZyBvbiB0aGUgSGlzdG9yeUJ1ZmZlciBpbXBsZW1lbnRhdGlvbikuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQEhCLmdldFVzZXJJZCgpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudG9Kc29uXG4gICNcbiAgdG9Kc29uIDogKCktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS50b0pzb24oKVxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnZhbFxuICAjXG4gIHZhbCA6IChuYW1lLCBjb250ZW50LCBtdXRhYmxlKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLnZhbChuYW1lLCBjb250ZW50LCBtdXRhYmxlKVxuXG4gICNcbiAgIyBAc2VlIE9wZXJhdGlvbi5vblxuICAjXG4gIG9uOiAoKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLm9uIGFyZ3VtZW50cy4uLlxuXG4gICNcbiAgIyBAc2VlIE9wZXJhdGlvbi5kZWxldGVMaXN0ZW5lclxuICAjXG4gIGRlbGV0ZUxpc3RlbmVyOiAoKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLmRlbGV0ZUxpc3RlbmVyIGFyZ3VtZW50cy4uLlxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnZhbHVlXG4gICNcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25GcmFtZXdvcmsucHJvdG90eXBlLCAndmFsdWUnLFxuICAgIGdldCA6IC0+IEBnZXRTaGFyZWRPYmplY3QoKS52YWx1ZVxuICAgIHNldCA6IChvKS0+XG4gICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgIEB2YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG9ubHkgc2V0IE9iamVjdCB2YWx1ZXMhXCJcblxubW9kdWxlLmV4cG9ydHMgPSBKc29uRnJhbWV3b3JrXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLkpzb25GcmFtZXdvcmsgPSBKc29uRnJhbWV3b3JrXG4iLCJcbiNcbiMgQG5vZG9jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG5cblxuICAjXG4gICMgQ3JlYXRlcyBhbiBlbXB0eSBIQi5cbiAgIyBAcGFyYW0ge09iamVjdH0gdXNlcl9pZCBDcmVhdG9yIG9mIHRoZSBIQi5cbiAgI1xuICBjb25zdHJ1Y3RvcjogKEB1c2VyX2lkKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyID0ge31cbiAgICBAYnVmZmVyID0ge31cbiAgICBAY2hhbmdlX2xpc3RlbmVycyA9IFtdXG4gICAgQGdhcmJhZ2UgPSBbXSAjIFdpbGwgYmUgY2xlYW5lZCBvbiBuZXh0IGNhbGwgb2YgZ2FyYmFnZUNvbGxlY3RvclxuICAgIEB0cmFzaCA9IFtdICMgSXMgZGVsZXRlZC4gV2FpdCB1bnRpbCBpdCBpcyBub3QgdXNlZCBhbnltb3JlLlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSB0cnVlXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IDEwMDBcbiAgICBAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyID0gMFxuICAgIHNldFRpbWVvdXQgQGVtcHR5R2FyYmFnZSwgQGdhcmJhZ2VDb2xsZWN0VGltZW91dFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby5jcmVhdG9yKSA+IG8ub3BfbnVtYmVyXG4gICAgICBvLmNsZWFudXA/KClcblxuICAgIEBnYXJiYWdlID0gQHRyYXNoXG4gICAgQHRyYXNoID0gW11cbiAgICBpZiBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0IGlzbnQgLTFcbiAgICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZCA9IHNldFRpbWVvdXQgQGVtcHR5R2FyYmFnZSwgQGdhcmJhZ2VDb2xsZWN0VGltZW91dFxuICAgIHVuZGVmaW5lZFxuXG4gICNcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQHVzZXJfaWRcblxuICBhZGRUb0dhcmJhZ2VDb2xsZWN0b3I6ICgpLT5cbiAgICBpZiBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uXG4gICAgICBmb3IgbyBpbiBhcmd1bWVudHNcbiAgICAgICAgaWYgbz9cbiAgICAgICAgICBAZ2FyYmFnZS5wdXNoIG9cblxuICBzdG9wR2FyYmFnZUNvbGxlY3Rpb246ICgpLT5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gZmFsc2VcbiAgICBAc2V0TWFudWFsR2FyYmFnZUNvbGxlY3QoKVxuICAgIEBnYXJiYWdlID0gW11cbiAgICBAdHJhc2ggPSBbXVxuXG4gIHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0OiAoKS0+XG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IC0xXG4gICAgY2xlYXJUaW1lb3V0IEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZFxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZCA9IHVuZGVmaW5lZFxuXG4gIHNldEdhcmJhZ2VDb2xsZWN0VGltZW91dDogKEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQpLT5cblxuICAjXG4gICMgSSBwcm9wb3NlIHRvIHVzZSBpdCBpbiB5b3VyIEZyYW1ld29yaywgdG8gY3JlYXRlIHNvbWV0aGluZyBsaWtlIGEgcm9vdCBlbGVtZW50LlxuICAjIEFuIG9wZXJhdGlvbiB3aXRoIHRoaXMgaWRlbnRpZmllciBpcyBub3QgcHJvcGFnYXRlZCB0byBvdGhlciBjbGllbnRzLlxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cbiAgI1xuICBnZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXI6ICgpLT5cbiAgICB7XG4gICAgICBjcmVhdG9yIDogJ18nXG4gICAgICBvcF9udW1iZXIgOiBcIl8je0ByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIrK31cIlxuICAgICAgZG9TeW5jOiBmYWxzZVxuICAgIH1cblxuICAjXG4gICMgR2V0IHRoZSBvcGVyYXRpb24gY291bnRlciB0aGF0IGRlc2NyaWJlcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgZG9jdW1lbnQuXG4gICNcbiAgZ2V0T3BlcmF0aW9uQ291bnRlcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHJlcyA9IHt9XG4gICAgICBmb3IgdXNlcixjdG4gb2YgQG9wZXJhdGlvbl9jb3VudGVyXG4gICAgICAgIHJlc1t1c2VyXSA9IGN0blxuICAgICAgcmVzXG4gICAgZWxzZVxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG5cblxuICAjXG4gICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgIyBUT0RPOiBNYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cbiAgICBqc29uID0gW11cbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZGFoIVwiXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcblxuICAgIGZvciB1X25hbWUsdXNlciBvZiBAYnVmZmVyXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIG8uZG9TeW5jIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/ICMgYXBwbGllcyBmb3IgYWxsIG9wcyBidXQgdGhlIG1vc3QgcmlnaHQgZGVsaW1pdGVyIVxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LmNyZWF0b3IsIG9fcHJldi5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fcHJldiA9IG9fcHJldi5wcmV2X2NsXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxuICAgICAgICAgIGpzb24ucHVzaCBvX2pzb25cblxuICAgIGpzb25cblxuICAjXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXG4gICMgQWNjb3JkaW5nbHkgeW91IHdpbGwgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBudW1iZXIgdGhhdCBpcyBleHBlY3RlZCBmcm9tIHRoYXQgdXNlci5cbiAgIyBUaGlzIHdpbGwgaW5jcmVtZW50IHRoZSBvcGVyYXRpb24gY291bnRlci5cbiAgI1xuICBnZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0gPSAwXG4gICAgdWlkID1cbiAgICAgICdjcmVhdG9yJyA6IHVzZXJfaWRcbiAgICAgICdvcF9udW1iZXInIDogQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdKytcbiAgICB1aWRcblxuICAjXG4gICMgUmV0cmlldmUgYW4gb3BlcmF0aW9uIGZyb20gYSB1bmlxdWUgaWQuXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkIGluc3RhbmNlb2YgT2JqZWN0XG4gICAgICBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBlbHNlIGlmIG5vdCB1aWQ/XG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyB0eXBlIG9mIHVpZCBpcyBub3QgZGVmaW5lZCFcIlxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28uY3JlYXRvcl0/XG4gICAgICBAYnVmZmVyW28uY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby5jcmVhdG9yXVtvLm9wX251bWJlcl0/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgb3ZlcndyaXRlIG9wZXJhdGlvbnMhXCJcbiAgICBAYnVmZmVyW28uY3JlYXRvcl1bby5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby5jcmVhdG9yXT9bby5vcF9udW1iZXJdXG5cbiAgI1xuICAjIEluY3JlbWVudCB0aGUgb3BlcmF0aW9uX2NvdW50ZXIgdGhhdCBkZWZpbmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBFbmdpbmUuXG4gICNcbiAgYWRkVG9Db3VudGVyOiAobyktPlxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdID0gMFxuICAgIGlmIHR5cGVvZiBvLm9wX251bWJlciBpcyAnbnVtYmVyJyBhbmQgby5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICAjIFRPRE86IGZpeCB0aGlzIGlzc3VlIGJldHRlci5cbiAgICAgICMgT3BlcmF0aW9ucyBzaG91bGQgaW5jb21lIGluIG9yZGVyXG4gICAgICAjIFRoZW4geW91IGRvbid0IGhhdmUgdG8gZG8gdGhpcy4uXG4gICAgICBpZiBvLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSsrXG4gICAgICAgIHdoaWxlIEBnZXRPcGVyYXRpb24oe2NyZWF0b3I6by5jcmVhdG9yLCBvcF9udW1iZXI6IEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdfSk/XG4gICAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0rK1xuXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIGlzbnQgKG8ub3BfbnVtYmVyICsgMSlcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0gLSAoby5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICBwYXJzZXIgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBAcHJpdmF0ZVxuICAjIEBhYnN0cmFjdFxuICAjIEBub2RvY1xuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BlcmF0aW9ucy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZG9TeW5jID0gdHJ1ZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIGlmIG5vdCB1aWQ/XG4gICAgICAgIHVpZCA9IEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIGlmIG5vdCB1aWQuZG9TeW5jP1xuICAgICAgICB1aWQuZG9TeW5jID0gbm90IGlzTmFOKHBhcnNlSW50KHVpZC5vcF9udW1iZXIpKVxuICAgICAge1xuICAgICAgICAnY3JlYXRvcic6IEBjcmVhdG9yXG4gICAgICAgICdvcF9udW1iZXInIDogQG9wX251bWJlclxuICAgICAgICAnZG9TeW5jJyA6IEBkb1N5bmNcbiAgICAgIH0gPSB1aWRcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGV2ZW50IE5hbWUgb2YgdGhlIGV2ZW50LlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvbjogKGV2ZW50cywgZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA/PSB7fVxuICAgICAgaWYgZXZlbnRzLmNvbnN0cnVjdG9yIGlzbnQgW10uY29uc3RydWN0b3JcbiAgICAgICAgZXZlbnRzID0gW2V2ZW50c11cbiAgICAgIGZvciBlIGluIGV2ZW50c1xuICAgICAgICBAZXZlbnRfbGlzdGVuZXJzW2VdID89IFtdXG4gICAgICAgIEBldmVudF9saXN0ZW5lcnNbZV0ucHVzaCBmXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGEgZnVuY3Rpb24gZnJvbSBhbiBldmVudCAvIGxpc3Qgb2YgZXZlbnRzLlxuICAgICMgQHNlZSBPcGVyYXRpb24ub25cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgZGVsZXRlTGlzdGVuZXIoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBldmVudCB7U3RyaW5nfSBBbiBldmVudCBuYW1lXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBmcm9tIHRoZXNlIGV2ZW50c1xuICAgICMgQG92ZXJsb2FkIGRlbGV0ZUxpc3RlbmVyKGV2ZW50cywgZilcbiAgICAjICAgQHBhcmFtIGV2ZW50cyB7QXJyYXk8U3RyaW5nPn0gQSBsaXN0IG9mIGV2ZW50IG5hbWVzXG4gICAgIyAgIEBwYXJhbSBmICAgICAge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdGhhdCB5b3Ugd2FudCB0byBkZWxldGUgZnJvbSB0aGVzZSBldmVudHMuXG4gICAgZGVsZXRlTGlzdGVuZXI6IChldmVudHMsIGYpLT5cbiAgICAgIGlmIGV2ZW50cy5jb25zdHJ1Y3RvciBpc250IFtdLmNvbnN0cnVjdG9yXG4gICAgICAgIGV2ZW50cyA9IFtldmVudHNdXG4gICAgICBmb3IgZSBpbiBldmVudHNcbiAgICAgICAgaWYgQGV2ZW50X2xpc3RlbmVycz9bZV0/XG4gICAgICAgICAgQGV2ZW50X2xpc3RlbmVyc1tlXSA9IEBldmVudF9saXN0ZW5lcnNbZV0uZmlsdGVyIChnKS0+XG4gICAgICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICNcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIEBmb3J3YXJkRXZlbnQgQCwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgI1xuICAgIGZvcndhcmRFdmVudDogKG9wLCBldmVudCwgYXJncy4uLiktPlxuICAgICAgaWYgQGV2ZW50X2xpc3RlbmVycz9bZXZlbnRdP1xuICAgICAgICBmb3IgZiBpbiBAZXZlbnRfbGlzdGVuZXJzW2V2ZW50XVxuICAgICAgICAgIGYuY2FsbCBvcCwgZXZlbnQsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBIQi5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IgQFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgI2NvbnNvbGUubG9nIFwiY2xlYW51cDogI3tAdHlwZX1cIlxuICAgICAgSEIucmVtb3ZlT3BlcmF0aW9uIEBcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChAcGFyZW50KS0+XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcGFyZW50XG5cbiAgICAjXG4gICAgIyBDb21wdXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpIHRoYXQgaWRlbnRpZmllcyB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0VWlkOiAoKS0+XG4gICAgICB7ICdjcmVhdG9yJzogQGNyZWF0b3IsICdvcF9udW1iZXInOiBAb3BfbnVtYmVyICwgJ3N5bmMnOiBAZG9TeW5jfVxuXG4gICAgZG9udFN5bmM6ICgpLT5cbiAgICAgIEBkb1N5bmMgPSBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiRGVsZXRlXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBwYXJzZXJbJ0RlbGV0ZSddID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IERlbGV0ZSB1aWQsIGRlbGV0ZXNfdWlkXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIEluc2VydCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgICNcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc0RlbGV0ZWQoKVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnQgXCJkZWxldGVcIiwgQCwgb1xuICAgICAgaWYgbz9cbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXG4gICAgICBpZiBAcHJldl9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICMgVE9ETzogRGVidWdnaW5nXG4gICAgICBpZiBAcHJldl9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcImxlZnQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXG4gICAgICAgICMgZGVsZXRlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxuICAgICAgICBvID0gQG5leHRfY2xcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcbiAgICAgICAgICAgIG8ub3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxuICAgICAgICBzdXBlclxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgICMgQHBhcmFtIGZpcmVfZXZlbnQge2Jvb2xlYW59IFdoZXRoZXIgdG8gZmlyZSB0aGUgaW5zZXJ0LWV2ZW50LlxuICAgIGV4ZWN1dGU6IChmaXJlX2V2ZW50ID0gdHJ1ZSktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IGRpc3RhbmNlX3RvX29yaWdpbiAjIGxvb3AgY291bnRlclxuXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2UgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLmNyZWF0b3IgPCBAY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIHBhcmVudCA9IEBwcmV2X2NsPy5nZXRQYXJlbnQoKVxuICAgICAgICBpZiBwYXJlbnQ/IGFuZCBmaXJlX2V2ZW50XG4gICAgICAgICAgQHNldFBhcmVudCBwYXJlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImluc2VydFwiLCBAXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBEZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBub3QgcHJldi5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uKytcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxuICAgICAgcG9zaXRpb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgRGVmaW5lcyBhbiBvYmplY3QgdGhhdCBpcyBjYW5ub3QgYmUgY2hhbmdlZC4gWW91IGNhbiB1c2UgdGhpcyB0byBzZXQgYW4gaW1tdXRhYmxlIHN0cmluZywgb3IgYSBudW1iZXIuXG4gICNcbiAgY2xhc3MgSW1tdXRhYmxlT2JqZWN0IGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gY29udGVudFxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgQGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIHR5cGU6IFwiSW1tdXRhYmxlT2JqZWN0XCJcblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiSW1tdXRhYmxlT2JqZWN0XCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2NvbnRlbnQnIDogQGNvbnRlbnRcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyAjIGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4oKS5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnSW1tdXRhYmxlT2JqZWN0J10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBJbW11dGFibGVPYmplY3QgdWlkLCBjb250ZW50LCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyBEZWxpbWl0ZXIgZXh0ZW5kcyBPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnRGVsaW1pdGVyJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgRGVsaW1pdGVyIHVpZCwgcHJldiwgbmV4dFxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICd0eXBlcycgOlxuICAgICAgJ0RlbGV0ZScgOiBEZWxldGVcbiAgICAgICdJbnNlcnQnIDogSW5zZXJ0XG4gICAgICAnRGVsaW1pdGVyJzogRGVsaW1pdGVyXG4gICAgICAnT3BlcmF0aW9uJzogT3BlcmF0aW9uXG4gICAgICAnSW1tdXRhYmxlT2JqZWN0JyA6IEltbXV0YWJsZU9iamVjdFxuICAgICdwYXJzZXInIDogcGFyc2VyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJ0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0VHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICB0ZXh0X3R5cGVzID0gdGV4dF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSB0ZXh0X3R5cGVzLnBhcnNlclxuXG4gIGNyZWF0ZUpzb25UeXBlV3JhcHBlciA9IChfanNvblR5cGUpLT5cblxuICAgICNcbiAgICAjIEBub3RlIEVYUEVSSU1FTlRBTFxuICAgICNcbiAgICAjIEEgSnNvblR5cGVXcmFwcGVyIHdhcyBpbnRlbmRlZCB0byBiZSBhIGNvbnZlbmllbnQgd3JhcHBlciBmb3IgdGhlIEpzb25UeXBlLlxuICAgICMgQnV0IGl0IGNhbiBtYWtlIHRoaW5ncyBtb3JlIGRpZmZpY3VsdCB0aGFuIHRoZXkgYXJlLlxuICAgICMgQHNlZSBKc29uVHlwZVxuICAgICNcbiAgICAjIEBleGFtcGxlIGNyZWF0ZSBhIEpzb25UeXBlV3JhcHBlclxuICAgICMgICAjIFlvdSBnZXQgYSBKc29uVHlwZVdyYXBwZXIgZnJvbSBhIEpzb25UeXBlIGJ5IGNhbGxpbmdcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgI1xuICAgICMgSXQgY3JlYXRlcyBKYXZhc2NyaXB0cyAtZ2V0dGVyIGFuZCAtc2V0dGVyIG1ldGhvZHMgZm9yIGVhY2ggcHJvcGVydHkgdGhhdCBKc29uVHlwZSBtYWludGFpbnMuXG4gICAgIyBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9kZWZpbmVQcm9wZXJ0eVxuICAgICNcbiAgICAjIEBleGFtcGxlIEdldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBhY2Nlc3MgdGhlIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnhcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcpXG4gICAgI1xuICAgICMgQG5vdGUgWW91IGNhbiBvbmx5IG92ZXJ3cml0ZSBleGlzdGluZyB2YWx1ZXMhIFNldHRpbmcgYSBuZXcgcHJvcGVydHkgd29uJ3QgaGF2ZSBhbnkgZWZmZWN0IVxuICAgICNcbiAgICAjIEBleGFtcGxlIFNldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBzZXQgYW4gZXhpc3RpbmcgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueCA9IFwidGV4dFwiXG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnLCBcInRleHRcIilcbiAgICAjXG4gICAgIyBJbiBvcmRlciB0byBzZXQgYSBuZXcgcHJvcGVydHkgeW91IGhhdmUgdG8gb3ZlcndyaXRlIGFuIGV4aXN0aW5nIHByb3BlcnR5LlxuICAgICMgVGhlcmVmb3JlIHRoZSBKc29uVHlwZVdyYXBwZXIgc3VwcG9ydHMgYSBzcGVjaWFsIGZlYXR1cmUgdGhhdCBzaG91bGQgbWFrZSB0aGluZ3MgbW9yZSBjb252ZW5pZW50XG4gICAgIyAod2UgY2FuIGFyZ3VlIGFib3V0IHRoYXQsIHVzZSB0aGUgSnNvblR5cGUgaWYgeW91IGRvbid0IGxpa2UgaXQgOykuXG4gICAgIyBJZiB5b3Ugb3ZlcndyaXRlIGFuIG9iamVjdCBwcm9wZXJ0eSBvZiB0aGUgSnNvblR5cGVXcmFwcGVyIHdpdGggYSBuZXcgb2JqZWN0LCBpdCB3aWxsIHJlc3VsdCBpbiBhIG1lcmdlZCB2ZXJzaW9uIG9mIHRoZSBvYmplY3RzLlxuICAgICMgTGV0IGB5YXR0YS52YWx1ZS5wYCB0aGUgcHJvcGVydHkgdGhhdCBpcyB0byBiZSBvdmVyd3JpdHRlbiBhbmQgbyB0aGUgbmV3IHZhbHVlLiBFLmcuIGB5YXR0YS52YWx1ZS5wID0gb2BcbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygb1xuICAgICMgKiBUaGUgcmVzdWx0IGhhcyBhbGwgcHJvcGVydGllcyBvZiB3LnAgaWYgdGhleSBkb24ndCBvY2N1ciB1bmRlciB0aGUgc2FtZSBwcm9wZXJ0eS1uYW1lIGluIG8uXG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29uZmxpY3QgRXhhbXBsZVxuICAgICMgICB5YXR0YS52YWx1ZSA9IHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiBcInN0cmluZ1wifVxuICAgICMgICB3LmEgPSB7YSA6IHtiIDogXCJzdHJpbmdcIn19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCJ9fVxuICAgICMgICB3LmEgPSB7YSA6IHtjIDogNH19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCIsIGMgOiA0fX1cbiAgICAjXG4gICAgIyBAZXhhbXBsZSBDb21tb24gUGl0ZmFsbHNcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgICMgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eVxuICAgICMgICB3Lm5ld1Byb3BlcnR5ID0gXCJBd2Vzb21lXCJcbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgdy5uZXdQcm9wZXJ0eSBpcyB1bmRlZmluZWRcbiAgICAjICAgIyBvdmVyd3JpdGUgdGhlIHcgb2JqZWN0XG4gICAgIyAgIHcgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlISwgYnV0IC4uXG4gICAgIyAgIGNvbnNvbGUubG9nKHlhdHRhLnZhbHVlLm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIGZhbHNlLCB5b3UgYXJlIG9ubHkgYWxsb3dlZCB0byBzZXQgcHJvcGVydGllcyFcbiAgICAjICAgIyBUaGUgc29sdXRpb25cbiAgICAjICAgeWF0dGEudmFsdWUgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlIVxuICAgICNcbiAgICBjbGFzcyBKc29uVHlwZVdyYXBwZXJcblxuICAgICAgI1xuICAgICAgIyBAcGFyYW0ge0pzb25UeXBlfSBqc29uVHlwZSBJbnN0YW5jZSBvZiB0aGUgSnNvblR5cGUgdGhhdCB0aGlzIGNsYXNzIHdyYXBwZXMuXG4gICAgICAjXG4gICAgICBjb25zdHJ1Y3RvcjogKGpzb25UeXBlKS0+XG4gICAgICAgIGZvciBuYW1lLCBvYmogb2YganNvblR5cGUubWFwXG4gICAgICAgICAgZG8gKG5hbWUsIG9iaiktPlxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25UeXBlV3JhcHBlci5wcm90b3R5cGUsIG5hbWUsXG4gICAgICAgICAgICAgIGdldCA6IC0+XG4gICAgICAgICAgICAgICAgeCA9IG9iai52YWwoKVxuICAgICAgICAgICAgICAgIGlmIHggaW5zdGFuY2VvZiBKc29uVHlwZVxuICAgICAgICAgICAgICAgICAgY3JlYXRlSnNvblR5cGVXcmFwcGVyIHhcbiAgICAgICAgICAgICAgICBlbHNlIGlmIHggaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICAgICAgICAgIHgudmFsKClcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICB4XG4gICAgICAgICAgICAgIHNldCA6IChvKS0+XG4gICAgICAgICAgICAgICAgb3ZlcndyaXRlID0ganNvblR5cGUudmFsKG5hbWUpXG4gICAgICAgICAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvciBhbmQgb3ZlcndyaXRlIGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlLnZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBqc29uVHlwZS52YWwobmFtZSwgbywgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZVxuICAgIG5ldyBKc29uVHlwZVdyYXBwZXIgX2pzb25UeXBlXG5cbiAgI1xuICAjIE1hbmFnZXMgT2JqZWN0LWxpa2UgdmFsdWVzLlxuICAjXG4gIGNsYXNzIEpzb25UeXBlIGV4dGVuZHMgdHlwZXMuTWFwTWFuYWdlclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGluaXRpYWxfdmFsdWUgQ3JlYXRlIHRoaXMgb3BlcmF0aW9uIHdpdGggYW4gaW5pdGlhbCB2YWx1ZS5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IFdoZXRoZXIgdGhlIGluaXRpYWxfdmFsdWUgc2hvdWxkIGJlIGNyZWF0ZWQgYXMgbXV0YWJsZS4gKE9wdGlvbmFsIC0gc2VlIHNldE11dGFibGVEZWZhdWx0KVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgaW5pdGlhbF92YWx1ZSwgbXV0YWJsZSktPlxuICAgICAgc3VwZXIgdWlkXG4gICAgICBpZiBpbml0aWFsX3ZhbHVlP1xuICAgICAgICBpZiB0eXBlb2YgaW5pdGlhbF92YWx1ZSBpc250IFwib2JqZWN0XCJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgaW5pdGlhbCB2YWx1ZSBvZiBKc29uVHlwZXMgbXVzdCBiZSBvZiB0eXBlIE9iamVjdCEgKGN1cnJlbnQgdHlwZTogI3t0eXBlb2YgaW5pdGlhbF92YWx1ZX0pXCJcbiAgICAgICAgZm9yIG5hbWUsbyBvZiBpbml0aWFsX3ZhbHVlXG4gICAgICAgICAgQHZhbCBuYW1lLCBvLCBtdXRhYmxlXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEganNvbi10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geWF0dGEudmFsKCd1bmtub3duJylcbiAgICAjICAgaWYgKHgudHlwZSA9PT0gXCJKc29uVHlwZVwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIkpzb25UeXBlXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG4gICAgI1xuICAgICMgVHJhbnNmb3JtIHRoaXMgdG8gYSBKc29uIGFuZCBsb29zZSBhbGwgdGhlIHNoYXJpbmctYWJpbGl0aWVzICh0aGUgbmV3IG9iamVjdCB3aWxsIGJlIGEgZGVlcCBjbG9uZSkhXG4gICAgIyBAcmV0dXJuIHtKc29ufVxuICAgICNcbiAgICB0b0pzb246ICgpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAganNvbiA9IHt9XG4gICAgICBmb3IgbmFtZSwgbyBvZiB2YWxcbiAgICAgICAgaWYgbyBpcyBudWxsXG4gICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgZWxzZSBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAganNvbltuYW1lXSA9IEB2YWwobmFtZSkudG9Kc29uKClcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgd2hpbGUgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAgbyA9IG8udmFsKClcbiAgICAgICAgICBqc29uW25hbWVdID0gb1xuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgIGpzb25cblxuICAgICNcbiAgICAjIEBzZWUgV29yZFR5cGUuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAjIFNldHMgdGhlIHBhcmVudCBvZiB0aGlzIEpzb25UeXBlIG9iamVjdC5cbiAgICAjXG4gICAgc2V0UmVwbGFjZU1hbmFnZXI6IChyZXBsYWNlX21hbmFnZXIpLT5cbiAgICAgIEByZXBsYWNlX21hbmFnZXIgPSByZXBsYWNlX21hbmFnZXJcbiAgICAgIEBvbiBbJ2NoYW5nZScsJ2FkZFByb3BlcnR5J10sICgpLT5cbiAgICAgICAgaWYgcmVwbGFjZV9tYW5hZ2VyLnBhcmVudD9cbiAgICAgICAgICByZXBsYWNlX21hbmFnZXIucGFyZW50LmZvcndhcmRFdmVudCB0aGlzLCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgSnNvblR5cGUuXG4gICAgIyBAcmV0dXJuIHtKc29uVHlwZX1cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcmVwbGFjZV9tYW5hZ2VyLnBhcmVudFxuXG4gICAgI1xuICAgICMgV2hldGhlciB0aGUgZGVmYXVsdCBpcyAnbXV0YWJsZScgKHRydWUpIG9yICdpbW11dGFibGUnIChmYWxzZSlcbiAgICAjXG4gICAgbXV0YWJsZV9kZWZhdWx0OlxuICAgICAgdHJ1ZVxuXG4gICAgI1xuICAgICMgU2V0IGlmIHRoZSBkZWZhdWx0IGlzICdtdXRhYmxlJyBvciAnaW1tdXRhYmxlJ1xuICAgICMgQHBhcmFtIHtTdHJpbmd8Qm9vbGVhbn0gbXV0YWJsZSBTZXQgZWl0aGVyICdtdXRhYmxlJyAvIHRydWUgb3IgJ2ltbXV0YWJsZScgLyBmYWxzZVxuICAgIHNldE11dGFibGVEZWZhdWx0OiAobXV0YWJsZSktPlxuICAgICAgaWYgbXV0YWJsZSBpcyB0cnVlIG9yIG11dGFibGUgaXMgJ211dGFibGUnXG4gICAgICAgIEpzb25UeXBlLnByb3RvdHlwZS5tdXRhYmxlX2RlZmF1bHQgPSB0cnVlXG4gICAgICBlbHNlIGlmIG11dGFibGUgaXMgZmFsc2Ugb3IgbXV0YWJsZSBpcyAnaW1tdXRhYmxlJ1xuICAgICAgICBKc29uVHlwZS5wcm90b3R5cGUubXV0YWJsZV9kZWZhdWx0ID0gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yICdTZXQgbXV0YWJsZSBlaXRoZXIgXCJtdXRhYmxlXCIgb3IgXCJpbW11dGFibGVcIiEnXG4gICAgICAnT0snXG5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgICAjICAgQHJldHVybiBbSnNvbl1cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW0pzb25UeXBlfFdvcmRUeXBlfFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCwgbXV0YWJsZSktPlxuICAgICAgaWYgdHlwZW9mIG5hbWUgaXMgJ29iamVjdCdcbiAgICAgICAgIyBTcGVjaWFsIGNhc2UuIEZpcnN0IGFyZ3VtZW50IGlzIGFuIG9iamVjdC4gVGhlbiB0aGUgc2Vjb25kIGFyZyBpcyBtdXRhYmxlLlxuICAgICAgICAjIEtlZXAgdGhhdCBpbiBtaW5kIHdoZW4gcmVhZGluZyB0aGUgZm9sbG93aW5nLi5cbiAgICAgICAganNvbiA9IG5ldyBKc29uVHlwZSB1bmRlZmluZWQsIG5hbWUsIGNvbnRlbnRcbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uKGpzb24pLmV4ZWN1dGUoKVxuICAgICAgICBAcmVwbGFjZV9tYW5hZ2VyLnJlcGxhY2UganNvblxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/IGFuZCAoY29udGVudD8gb3IgY29udGVudCBpcyBudWxsKVxuICAgICAgICBpZiBtdXRhYmxlP1xuICAgICAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICAgICAgbXV0YWJsZSA9IHRydWVcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBtdXRhYmxlID0gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG11dGFibGUgPSBAbXV0YWJsZV9kZWZhdWx0XG4gICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdmdW5jdGlvbidcbiAgICAgICAgICBAICMgSnVzdCBkbyBub3RoaW5nXG4gICAgICAgIGVsc2UgaWYgY29udGVudCBpcyBudWxsIG9yICgoKG5vdCBtdXRhYmxlKSBvciB0eXBlb2YgY29udGVudCBpcyAnbnVtYmVyJykgYW5kIGNvbnRlbnQuY29uc3RydWN0b3IgaXNudCBPYmplY3QpXG4gICAgICAgICAgb2JqID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICAgICAgICBzdXBlciBuYW1lLCBvYmpcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdzdHJpbmcnXG4gICAgICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5Xb3JkVHlwZSB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuICAgICAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIGNvbnRlbnRcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIHdvcmRcbiAgICAgICAgICBlbHNlIGlmIGNvbnRlbnQuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgICBqc29uID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBKc29uVHlwZSB1bmRlZmluZWQsIGNvbnRlbnQsIG11dGFibGUpLmV4ZWN1dGUoKVxuICAgICAgICAgICAgc3VwZXIgbmFtZSwganNvblxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBzZXQgI3t0eXBlb2YgY29udGVudH0tdHlwZXMgaW4gY29sbGFib3JhdGl2ZSBKc29uLW9iamVjdHMhXCJcbiAgICAgIGVsc2VcbiAgICAgICAgc3VwZXIgbmFtZSwgY29udGVudFxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25UeXBlLnByb3RvdHlwZSwgJ3ZhbHVlJyxcbiAgICAgIGdldCA6IC0+IGNyZWF0ZUpzb25UeXBlV3JhcHBlciBAXG4gICAgICBzZXQgOiAobyktPlxuICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICBAdmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkpzb25UeXBlXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0pzb25UeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSnNvblR5cGUgdWlkXG5cblxuXG5cbiAgdHlwZXNbJ0pzb25UeXBlJ10gPSBKc29uVHlwZVxuXG4gIHRleHRfdHlwZXNcblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IGJhc2ljX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBNYXBNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBmb3IgbmFtZSxwIG9mIEBtYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25UeXBlcy52YWxcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgaWYgbm90IEBtYXBbbmFtZV0/XG4gICAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG5ldyBBZGROYW1lIHVuZGVmaW5lZCwgQCwgbmFtZSkuZXhlY3V0ZSgpXG4gICAgICAgIEBtYXBbbmFtZV0ucmVwbGFjZSBjb250ZW50XG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgb2JqID0gQG1hcFtuYW1lXT8udmFsKClcbiAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgb2JqLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvYmpcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAbWFwXG4gICAgICAgICAgb2JqID0gby52YWwoKVxuICAgICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdCBvciBvYmogaW5zdGFuY2VvZiBNYXBNYW5hZ2VyXG4gICAgICAgICAgICBvYmogPSBvYmoudmFsKClcbiAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvYmpcbiAgICAgICAgcmVzdWx0XG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFdoZW4gYSBuZXcgcHJvcGVydHkgaW4gYSBtYXAgbWFuYWdlciBpcyBjcmVhdGVkLCB0aGVuIHRoZSB1aWRzIG9mIHRoZSBpbnNlcnRlZCBPcGVyYXRpb25zXG4gICMgbXVzdCBiZSB1bmlxdWUgKHRoaW5rIGFib3V0IGNvbmN1cnJlbnQgb3BlcmF0aW9ucykuIFRoZXJlZm9yZSBvbmx5IGFuIEFkZE5hbWUgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG9cbiAgIyBhZGQgYSBwcm9wZXJ0eSBpbiBhIE1hcE1hbmFnZXIuIElmIHR3byBBZGROYW1lIG9wZXJhdGlvbnMgb24gdGhlIHNhbWUgTWFwTWFuYWdlciBuYW1lIGhhcHBlbiBjb25jdXJyZW50bHlcbiAgIyBvbmx5IG9uZSB3aWxsIEFkZE5hbWUgb3BlcmF0aW9uIHdpbGwgYmUgZXhlY3V0ZWQuXG4gICNcbiAgY2xhc3MgQWRkTmFtZSBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IG1hcF9tYW5hZ2VyIFVpZCBvciByZWZlcmVuY2UgdG8gdGhlIE1hcE1hbmFnZXIuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IHdpbGwgYmUgYWRkZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBtYXBfbWFuYWdlciwgQG5hbWUpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdtYXBfbWFuYWdlcicsIG1hcF9tYW5hZ2VyXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiQWRkTmFtZVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgSWYgbWFwX21hbmFnZXIgZG9lc24ndCBoYXZlIHRoZSBwcm9wZXJ0eSBuYW1lLCB0aGVuIGFkZCBpdC5cbiAgICAjIFRoZSBSZXBsYWNlTWFuYWdlciB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gb24gdGhlIHByb3BlcnR5IGlzIHVuaXF1ZVxuICAgICMgaW4gc3VjaCBhIHdheSB0aGF0IGlmIEFkZE5hbWUgaXMgZXhlY3V0ZWQgKGZyb20gYW5vdGhlciBwZWVyKSBpdCB3aWxsXG4gICAgIyBhbHdheXMgaGF2ZSB0aGUgc2FtZSByZXN1bHQgKFJlcGxhY2VNYW5hZ2VyLCBhbmQgaXRzIGJlZ2lubmluZyBhbmQgZW5kIGFyZSB0aGUgc2FtZSlcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB1aWRfciA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIl8je3VpZF9iZWcub3BfbnVtYmVyfV9STV8je0BuYW1lfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiXyN7dWlkX2VuZC5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2VuZFwiXG4gICAgICAgICAgYmVnID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0gPSBIQi5hZGRPcGVyYXRpb24obmV3IFJlcGxhY2VNYW5hZ2VyIHVuZGVmaW5lZCwgdWlkX3IsIGJlZywgZW5kKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLnNldFBhcmVudCBAbWFwX21hbmFnZXIsIEBuYW1lXG4gICAgICAgICAgKEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLmFkZF9uYW1lX29wcyA/PSBbXSkucHVzaCBAXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0uZXhlY3V0ZSgpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiQWRkTmFtZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdtYXBfbWFuYWdlcicgOiBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgJ25hbWUnIDogQG5hbWVcbiAgICAgIH1cblxuICBwYXJzZXJbJ0FkZE5hbWUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ21hcF9tYW5hZ2VyJyA6IG1hcF9tYW5hZ2VyXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ25hbWUnIDogbmFtZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IEFkZE5hbWUgdWlkLCBtYXBfbWFuYWdlciwgbmFtZVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIExpc3RNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIGJlZ2lubmluZz8gYW5kIGVuZD9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2JlZ2lubmluZycsIGJlZ2lubmluZ1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnZW5kJywgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIEBiZWdpbm5pbmcgPSBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICAgIEBlbmQgPSAgICAgICBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICByZXN1bHQucHVzaCBvXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgaWYgKHBvc2l0aW9uID4gMCBvciBvLmlzRGVsZXRlZCgpKSBhbmQgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgIyBmaW5kIGZpcnN0IG5vbiBkZWxldGVkIG9wXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIHBvc2l0aW9uIC09IDFcbiAgICAgIG9cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkVHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBXb3JkVHlwZVxuICAjXG4gIGNsYXNzIFJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgTGlzdE1hbmFnZXJcbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoaW5pdGlhbF9jb250ZW50LCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuICAgICAgaWYgaW5pdGlhbF9jb250ZW50P1xuICAgICAgICBAcmVwbGFjZSBpbml0aWFsX2NvbnRlbnRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgIyBpZiB0aGlzIHdhcyBjcmVhdGVkIGJ5IGFuIEFkZE5hbWUgb3BlcmF0aW9uLCBkZWxldGUgaXQgdG9vXG4gICAgICBpZiBAYWRkX25hbWVfb3BzP1xuICAgICAgICBmb3IgbyBpbiBAYWRkX25hbWVfb3BzXG4gICAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgb3AgPSBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2xcbiAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEFkZCBjaGFuZ2UgbGlzdGVuZXJzIGZvciBwYXJlbnQuXG4gICAgI1xuICAgIHNldFBhcmVudDogKHBhcmVudCwgcHJvcGVydHlfbmFtZSktPlxuICAgICAgcmVwbF9tYW5hZ2VyID0gdGhpc1xuICAgICAgQG9uICdpbnNlcnQnLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIGlmIG9wLm5leHRfY2wgaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICByZXBsX21hbmFnZXIucGFyZW50LmNhbGxFdmVudCAnY2hhbmdlJywgcHJvcGVydHlfbmFtZSwgb3BcbiAgICAgIEBvbiAnY2hhbmdlJywgKGV2ZW50LCBvcCktPlxuICAgICAgICBpZiByZXBsX21hbmFnZXIgaXNudCB0aGlzXG4gICAgICAgICAgcmVwbF9tYW5hZ2VyLnBhcmVudC5jYWxsRXZlbnQgJ2NoYW5nZScsIHByb3BlcnR5X25hbWUsIG9wXG4gICAgICAjIENhbGwgdGhpcywgd2hlbiB0aGUgZmlyc3QgZWxlbWVudCBpcyBpbnNlcnRlZC4gVGhlbiBkZWxldGUgdGhlIGxpc3RlbmVyLlxuICAgICAgYWRkUHJvcGVydHlMaXN0ZW5lciA9IChldmVudCwgb3ApLT5cbiAgICAgICAgcmVwbF9tYW5hZ2VyLnBhcmVudC5jYWxsRXZlbnQgJ2FkZFByb3BlcnR5JywgcHJvcGVydHlfbmFtZSwgb3BcbiAgICAgICAgcmVwbF9tYW5hZ2VyLmRlbGV0ZUxpc3RlbmVyICdhZGRQcm9wZXJ0eScsIGFkZFByb3BlcnR5TGlzdGVuZXJcbiAgICAgIEBvbiAnaW5zZXJ0JywgYWRkUHJvcGVydHlMaXN0ZW5lclxuICAgICAgc3VwZXIgcGFyZW50XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFR5cGVcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiUmVwbGFjZU1hbmFnZXJcIlxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyAjIGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4oKS5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlJlcGxhY2VNYW5hZ2VyXCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlTWFuYWdlciBjb250ZW50LCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZXMuXG4gICMgQHNlZSBSZXBsYWNlTWFuYWdlclxuICAjXG4gIGNsYXNzIFJlcGxhY2VhYmxlIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBpZiBub3QgKHByZXY/IGFuZCBuZXh0PylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZGVmaW5lIHByZXYsIGFuZCBuZXh0IGZvciBSZXBsYWNlYWJsZS10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIHR5cGU6IFwiUmVwbGFjZWFibGVcIlxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyByZXBsYWNlYWJsZSB3aXRoIG5ldyBjb250ZW50LlxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCktPlxuICAgICAgQHBhcmVudC5yZXBsYWNlIGNvbnRlbnRcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgICBAY29udGVudC5kb250U3luYygpXG4gICAgICBAY29udGVudCA9IG51bGxcbiAgICAgIHN1cGVyXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgSWYgcG9zc2libGUgc2V0IHRoZSByZXBsYWNlIG1hbmFnZXIgaW4gdGhlIGNvbnRlbnQuXG4gICAgIyBAc2VlIFdvcmRUeXBlLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQ/LnNldFJlcGxhY2VNYW5hZ2VyPyhAcGFyZW50KVxuICAgICAgICBpbnNfcmVzdWx0ID0gc3VwZXIoQGNvbnRlbnQ/KVxuICAgICAgICBpZiBpbnNfcmVzdWx0XG4gICAgICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBAcHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgICAgIGVsc2UgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBhcHBseURlbGV0ZSgpXG5cbiAgICAgICAgcmV0dXJuIGluc19yZXN1bHRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VhYmxlXCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50Py5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuXG4gIHR5cGVzWydMaXN0TWFuYWdlciddID0gTGlzdE1hbmFnZXJcbiAgdHlwZXNbJ01hcE1hbmFnZXInXSA9IE1hcE1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VNYW5hZ2VyJ10gPSBSZXBsYWNlTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZWFibGUnXSA9IFJlcGxhY2VhYmxlXG5cbiAgYmFzaWNfdHlwZXNcblxuXG5cblxuXG5cbiIsInN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHN0cnVjdHVyZWRfdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHN0cnVjdHVyZWRfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEF0IHRoZSBtb21lbnQgVGV4dERlbGV0ZSB0eXBlIGVxdWFscyB0aGUgRGVsZXRlIHR5cGUgaW4gQmFzaWNUeXBlcy5cbiAgIyBAc2VlIEJhc2ljVHlwZXMuRGVsZXRlXG4gICNcbiAgY2xhc3MgVGV4dERlbGV0ZSBleHRlbmRzIHR5cGVzLkRlbGV0ZVxuICBwYXJzZXJbXCJUZXh0RGVsZXRlXCJdID0gcGFyc2VyW1wiRGVsZXRlXCJdXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEV4dGVuZHMgdGhlIGJhc2ljIEluc2VydCB0eXBlIHRvIGFuIG9wZXJhdGlvbiB0aGF0IGhvbGRzIGEgdGV4dCB2YWx1ZVxuICAjXG4gIGNsYXNzIFRleHRJbnNlcnQgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcbiAgICAjXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gY29udGVudCBUaGUgY29udGVudCBvZiB0aGlzIEluc2VydC10eXBlIE9wZXJhdGlvbi4gVXN1YWxseSB5b3UgcmVzdHJpY3QgdGhlIGxlbmd0aCBvZiBjb250ZW50IHRvIHNpemUgMVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBwcmV2LCBhbmQgbmV4dCBmb3IgVGV4dEluc2VydC10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIHR5cGU6IFwiVGV4dEluc2VydFwiXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgQGNvbnRlbnQgPSBudWxsXG4gICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKCkgb3Igbm90IEBjb250ZW50P1xuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJUZXh0SW5zZXJ0XCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50XG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJUZXh0SW5zZXJ0XCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgVGV4dEluc2VydCBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBIYW5kbGVzIGEgV29yZFR5cGUtbGlrZSBkYXRhIHN0cnVjdHVyZXMgd2l0aCBzdXBwb3J0IGZvciBpbnNlcnRUZXh0L2RlbGV0ZVRleHQgYXQgYSB3b3JkLXBvc2l0aW9uLlxuICAjIEBub3RlIEN1cnJlbnRseSwgb25seSBUZXh0IGlzIHN1cHBvcnRlZCFcbiAgI1xuICBjbGFzcyBXb3JkVHlwZSBleHRlbmRzIHR5cGVzLkxpc3RNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEgd29yZC10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geWF0dGEudmFsKCd1bmtub3duJylcbiAgICAjICAgaWYgKHgudHlwZSA9PT0gXCJXb3JkVHlwZVwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIldvcmRUeXBlXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtXb3JkVHlwZX0gVGhpcyBXb3JkVHlwZSBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydFRleHQ6IChwb3NpdGlvbiwgY29udGVudCktPlxuICAgICAgIyBUT0RPOiBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHNob3VsZCByZXR1cm4gXCIoaS0yKXRoXCIgY2hhcmFjdGVyXG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvbiAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIGEgaXMgdGhlIDB0aCBjaGFyYWN0ZXJcbiAgICAgIGxlZnQgPSBpdGgucHJldl9jbCAjIGxlZnQgaXMgdGhlIG5vbi1kZWxldGVkIGNoYXJhdGhlciB0byB0aGUgbGVmdCBvZiBpdGhcbiAgICAgIHdoaWxlIGxlZnQuaXNEZWxldGVkKClcbiAgICAgICAgbGVmdCA9IGxlZnQucHJldl9jbCAjIGZpbmQgdGhlIGZpcnN0IGNoYXJhY3RlciB0byB0aGUgbGVmdCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gQ2FzZSBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIHJpZ2h0ID0gbGVmdC5uZXh0X2NsXG4gICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgIG9wID0gbmV3IFRleHRJbnNlcnQgYywgdW5kZWZpbmVkLCBsZWZ0LCByaWdodFxuICAgICAgICBIQi5hZGRPcGVyYXRpb24ob3ApLmV4ZWN1dGUoKVxuICAgICAgICBsZWZ0ID0gb3BcbiAgICAgIEBcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBUaGlzIFdvcmRUeXBlIG9iamVjdFxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgd29yZCB3aXRoIGFub3RoZXIgb25lLiBDb25jdXJyZW50IHJlcGxhY2VtZW50cyBhcmUgbm90IG1lcmdlZCFcbiAgICAjIE9ubHkgb25lIG9mIHRoZSByZXBsYWNlbWVudHMgd2lsbCBiZSB1c2VkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBSZXR1cm5zIHRoZSBuZXcgV29yZFR5cGUgb2JqZWN0LlxuICAgICNcbiAgICByZXBsYWNlVGV4dDogKHRleHQpLT5cbiAgICAgICMgQ2FuIG9ubHkgYmUgdXNlZCBpZiB0aGUgUmVwbGFjZU1hbmFnZXIgd2FzIHNldCFcbiAgICAgICMgQHNlZSBXb3JkVHlwZS5zZXRSZXBsYWNlTWFuYWdlclxuICAgICAgaWYgQHJlcGxhY2VfbWFuYWdlcj9cbiAgICAgICAgd29yZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgV29yZFR5cGUgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIHRleHRcbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlci5yZXBsYWNlKHdvcmQpXG4gICAgICAgIHdvcmRcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyB0eXBlIGlzIGN1cnJlbnRseSBub3QgbWFpbnRhaW5lZCBieSBhIFJlcGxhY2VNYW5hZ2VyIVwiXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIHdvcmQuXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9IFRoZSBTdHJpbmctcmVwcmVzZW50YXRpb24gb2YgdGhpcyBvYmplY3QuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgYyA9IGZvciBvIGluIEB0b0FycmF5KClcbiAgICAgICAgaWYgby52YWw/XG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgXCJcIlxuICAgICAgYy5qb2luKCcnKVxuXG4gICAgI1xuICAgICMgU2FtZSBhcyBXb3JkVHlwZS52YWxcbiAgICAjIEBzZWUgV29yZFR5cGUudmFsXG4gICAgI1xuICAgIHRvU3RyaW5nOiAoKS0+XG4gICAgICBAdmFsKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbiBtb3N0IGNhc2VzIHlvdSB3b3VsZCBlbWJlZCBhIFdvcmRUeXBlIGluIGEgUmVwbGFjZWFibGUsIHdpY2ggaXMgaGFuZGxlZCBieSB0aGUgUmVwbGFjZU1hbmFnZXIgaW4gb3JkZXJcbiAgICAjIHRvIHByb3ZpZGUgcmVwbGFjZSBmdW5jdGlvbmFsaXR5LlxuICAgICNcbiAgICBzZXRSZXBsYWNlTWFuYWdlcjogKG9wKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncmVwbGFjZV9tYW5hZ2VyJywgb3BcbiAgICAgIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICBAb24gJ2luc2VydCcsIChldmVudCwgaW5zKT0+XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXI/LmZvcndhcmRFdmVudCBALCAnY2hhbmdlJywgaW5zXG4gICAgICBAb24gJ2RlbGV0ZScsIChldmVudCwgaW5zLCBkZWwpPT5cbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlcj8uZm9yd2FyZEV2ZW50IEAsICdjaGFuZ2UnLCBkZWxcbiAgICAjXG4gICAgIyBCaW5kIHRoaXMgV29yZFR5cGUgdG8gYSB0ZXh0ZmllbGQgb3IgaW5wdXQgZmllbGQuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHRleHRib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRleHRmaWVsZFwiKTtcbiAgICAjICAgeWF0dGEuYmluZCh0ZXh0Ym94KTtcbiAgICAjXG4gICAgYmluZDogKHRleHRmaWVsZCktPlxuICAgICAgd29yZCA9IEBcbiAgICAgIHRleHRmaWVsZC52YWx1ZSA9IEB2YWwoKVxuXG4gICAgICBAb24gXCJpbnNlcnRcIiwgKGV2ZW50LCBvcCktPlxuICAgICAgICBvX3BvcyA9IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuXG4gICAgICBAb24gXCJkZWxldGVcIiwgKGV2ZW50LCBvcCktPlxuICAgICAgICBvX3BvcyA9IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgIGlmIGN1cnNvciA8IG9fcG9zXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjdXJzb3IgLT0gMVxuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG4gICAgICAjIGNvbnN1bWUgYWxsIHRleHQtaW5zZXJ0IGNoYW5nZXMuXG4gICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IChldmVudCktPlxuICAgICAgICBjaGFyID0gbnVsbFxuICAgICAgICBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgICAgY2hhciA9ICdcXG4nXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUgZXZlbnQua2V5Q29kZVxuICAgICAgICBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICBwb3MgPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcyksIGRpZmZcbiAgICAgICAgICB3b3JkLmluc2VydFRleHQgcG9zLCBjaGFyXG4gICAgICAgICAgbmV3X3BvcyA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgICNcbiAgICAgICMgY29uc3VtZSBkZWxldGVzLiBOb3RlIHRoYXRcbiAgICAgICMgICBjaHJvbWU6IHdvbid0IGNvbnN1bWUgZGVsZXRpb25zIG9uIGtleXByZXNzIGV2ZW50LlxuICAgICAgIyAgIGtleUNvZGUgaXMgZGVwcmVjYXRlZC4gQlVUOiBJIGRvbid0IHNlZSBhbm90aGVyIHdheS5cbiAgICAgICMgICAgIHNpbmNlIGV2ZW50LmtleSBpcyBub3QgaW1wbGVtZW50ZWQgaW4gdGhlIGN1cnJlbnQgdmVyc2lvbiBvZiBjaHJvbWUuXG4gICAgICAjICAgICBFdmVyeSBicm93c2VyIHN1cHBvcnRzIGtleUNvZGUuIExldCdzIHN0aWNrIHdpdGggaXQgZm9yIG5vdy4uXG4gICAgICAjXG4gICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gKGV2ZW50KS0+XG4gICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgOCAjIEJhY2tzcGFjZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB0ZXh0ZmllbGQudmFsdWVcbiAgICAgICAgICAgICAgbmV3X3BvcyA9IHBvc1xuICAgICAgICAgICAgICBkZWxfbGVuZ3RoID0gMFxuICAgICAgICAgICAgICBpZiBwb3MgPiAwXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdoaWxlIG5ld19wb3MgPiAwIGFuZCB2YWxbbmV3X3Bvc10gaXNudCBcIiBcIiBhbmQgdmFsW25ld19wb3NdIGlzbnQgJ1xcbidcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IChwb3MtMSksIDFcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgNDYgIyBEZWxldGVcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgMVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiV29yZFR5cGVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gIyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luKCkuZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ1dvcmRUeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmRUeXBlIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkVHlwZSddID0gV29yZFR5cGVcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiJdfQ==
