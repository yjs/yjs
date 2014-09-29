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
    if (this.HB.getOperation(o) != null) {

    } else if (!o.execute()) {
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
        if (this.HB.getOperation(op) != null) {

        } else if (!op.execute()) {
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

  JsonFramework.prototype.val = function() {
    var _ref;
    return (_ref = this.getSharedObject()).val.apply(_ref, arguments);
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
    if (this.number_of_operations_added_to_HB == null) {
      this.number_of_operations_added_to_HB = 0;
    }
    this.number_of_operations_added_to_HB++;
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
      var garbagecollect, _ref;
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
      if (!((this.prev_cl != null) && (this.next_cl != null)) || this.prev_cl.isDeleted()) {
        garbagecollect = true;
      }
      Insert.__super__.applyDelete.call(this, garbagecollect);
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
      } else if ((name != null) && arguments.length > 1) {
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
        repl_manager.deleteListener('addProperty', addPropertyListener);
        return repl_manager.parent.callEvent('addProperty', property_name, op);
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
      if ((content != null ? content.creator : void 0) != null) {
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
      if (this.content instanceof types.Operation) {
        this.content.applyDelete();
      }
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
      var c, op, right, _i, _len;
      while (left.isDeleted()) {
        left = left.prev_cl;
      }
      right = left.next_cl;
      if (content.type != null) {
        op = new TextInsert(content, void 0, left, right);
        HB.addOperation(op).execute();
      } else {
        for (_i = 0, _len = content.length; _i < _len; _i++) {
          c = content[_i];
          op = new TextInsert(c, void 0, left, right);
          HB.addOperation(op).execute();
          left = op;
        }
      }
      return this;
    };

    WordType.prototype.insertText = function(position, content) {
      var ith, left;
      ith = this.getOperationByPosition(position);
      left = ith.prev_cl;
      return this.insertAfter(left, content);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0ZyYW1ld29ya3MvSnNvbkZyYW1ld29yay5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0hpc3RvcnlCdWZmZXIuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvSnNvblR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvU3RydWN0dXJlZFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0tBLElBQUEsTUFBQTs7QUFBQTtBQU1lLEVBQUEsZ0JBQUUsRUFBRixFQUFPLE1BQVAsR0FBQTtBQUNYLElBRFksSUFBQyxDQUFBLEtBQUEsRUFDYixDQUFBO0FBQUEsSUFEaUIsSUFBQyxDQUFBLFNBQUEsTUFDbEIsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGVBQUQsR0FBbUIsRUFBbkIsQ0FEVztFQUFBLENBQWI7O0FBQUEsbUJBTUEsY0FBQSxHQUFnQixTQUFDLElBQUQsR0FBQTtBQUNkLFFBQUEsVUFBQTtBQUFBLElBQUEsVUFBQSxHQUFhLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBSSxDQUFDLElBQUwsQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBRyxrQkFBSDth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Q0FBTCxHQUFlLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBQWYsQ0FERjtPQU5BO0FBUUEsTUFBQSxJQUFHLG9CQUFIO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQURGO09BUkE7QUFVQSxNQUFBLElBQUcsbUJBQUg7QUFDRSxRQUFBLElBQUssQ0FBQSxRQUFBLENBQUwsR0FBaUIsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUFTLENBQUMsTUFBVixDQUFBLENBQWpCLENBREY7T0FWQTthQVlBLEtBYk87SUFBQSxDQXhPVCxDQUFBOztvQkFBQTs7S0FOcUIsS0FBSyxDQUFDLFlBNUY3QixDQUFBO0FBQUEsRUF5VkEsTUFBTyxDQUFBLFVBQUEsQ0FBUCxHQUFxQixTQUFDLElBQUQsR0FBQTtBQUNuQixRQUFBLHVDQUFBO0FBQUEsSUFDVSxXQUFSLE1BREYsRUFFZ0IsaUJBQWQsWUFGRixFQUdVLFdBQVIsTUFIRixFQUlVLFlBQVIsT0FKRixFQUtVLFlBQVIsT0FMRixFQU1hLGNBQVgsU0FORixDQUFBO1dBUUksSUFBQSxRQUFBLENBQVMsR0FBVCxFQUFjLFNBQWQsRUFBeUIsR0FBekIsRUFBOEIsSUFBOUIsRUFBb0MsSUFBcEMsRUFBMEMsTUFBMUMsRUFUZTtFQUFBLENBelZyQixDQUFBO0FBQUEsRUFvV0EsS0FBTSxDQUFBLFlBQUEsQ0FBTixHQUFzQixVQXBXdEIsQ0FBQTtBQUFBLEVBcVdBLEtBQU0sQ0FBQSxZQUFBLENBQU4sR0FBc0IsVUFyV3RCLENBQUE7QUFBQSxFQXNXQSxLQUFNLENBQUEsVUFBQSxDQUFOLEdBQW9CLFFBdFdwQixDQUFBO1NBdVdBLGlCQXhXZTtBQUFBLENBRmpCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXHJcbiNcclxuIyBAbm9kb2NcclxuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxyXG4jXHJcbmNsYXNzIEVuZ2luZVxyXG5cclxuICAjXHJcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXHJcbiAgIyBAcGFyYW0ge0FycmF5fSBwYXJzZXIgRGVmaW5lcyBob3cgdG8gcGFyc2UgZW5jb2RlZCBtZXNzYWdlcy5cclxuICAjXHJcbiAgY29uc3RydWN0b3I6IChASEIsIEBwYXJzZXIpLT5cclxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxyXG5cclxuICAjXHJcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cclxuICAjXHJcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XHJcbiAgICB0eXBlUGFyc2VyID0gQHBhcnNlcltqc29uLnR5cGVdXHJcbiAgICBpZiB0eXBlUGFyc2VyP1xyXG4gICAgICB0eXBlUGFyc2VyIGpzb25cclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxyXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXHJcbiAgI1xyXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cclxuICAgIG9wcyA9IFtdXHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxyXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXHJcbiAgI1xyXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xyXG4gICAgICAgIEBhcHBseU9wIG9cclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXHJcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wXHJcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXHJcbiAgI1xyXG4gIGFwcGx5T3A6IChvcF9qc29uKS0+XHJcbiAgICAjICRwYXJzZV9hbmRfZXhlY3V0ZSB3aWxsIHJldHVybiBmYWxzZSBpZiAkb19qc29uIHdhcyBwYXJzZWQgYW5kIGV4ZWN1dGVkLCBvdGhlcndpc2UgdGhlIHBhcnNlZCBvcGVyYWRpb25cclxuICAgIG8gPSBAcGFyc2VPcGVyYXRpb24gb3BfanNvblxyXG4gICAgQEhCLmFkZFRvQ291bnRlciBvXHJcbiAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgaWYgQEhCLmdldE9wZXJhdGlvbihvKT9cclxuICAgIGVsc2UgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBlbHNlXHJcbiAgICAgIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcclxuXHJcbiAgI1xyXG4gICMgQ2FsbCB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhcHBsaWVkIGEgbmV3IG9wZXJhdGlvbi5cclxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cclxuICAjXHJcbiAgdHJ5VW5wcm9jZXNzZWQ6ICgpLT5cclxuICAgIHdoaWxlIHRydWVcclxuICAgICAgb2xkX2xlbmd0aCA9IEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoXHJcbiAgICAgIHVucHJvY2Vzc2VkID0gW11cclxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcclxuICAgICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG9wKT9cclxuICAgICAgICBlbHNlIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL0pzb25UeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBKc29uIGRhdGEtc3RydWN0dXJlcy5cbiMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiMgKiBTdHJpbmdcbiMgKiBJbnRlZ2VyXG4jICogQXJyYXlcbiNcbmNsYXNzIEpzb25GcmFtZXdvcmtcblxuICAjXG4gICMgQHBhcmFtIHtTdHJpbmd9IHVzZXJfaWQgVW5pcXVlIGlkIG9mIHRoZSBwZWVyLlxuICAjIEBwYXJhbSB7Q29ubmVjdG9yfSBDb25uZWN0b3IgdGhlIGNvbm5lY3RvciBjbGFzcy5cbiAgI1xuICBjb25zdHJ1Y3RvcjogKHVzZXJfaWQsIENvbm5lY3RvciktPlxuICAgIEBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgICB0eXBlX21hbmFnZXIgPSBqc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQHR5cGVzID0gdHlwZV9tYW5hZ2VyLnR5cGVzXG4gICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0eXBlX21hbmFnZXIucGFyc2VyXG4gICAgQEhCLmVuZ2luZSA9IEBlbmdpbmUgIyBUT0RPOiAhISBvbmx5IGZvciBkZWJ1Z2dpbmdcbiAgICBAY29ubmVjdG9yID0gbmV3IENvbm5lY3RvciBAZW5naW5lLCBASEIsIHR5cGVfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXIsIEBcbiAgICBmaXJzdF93b3JkID0gbmV3IEB0eXBlcy5Kc29uVHlwZShASEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpXG4gICAgQEhCLmFkZE9wZXJhdGlvbihmaXJzdF93b3JkKS5leGVjdXRlKClcblxuICAgIHVpZF9iZWcgPSBASEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKClcbiAgICB1aWRfZW5kID0gQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpXG4gICAgYmVnID0gQEhCLmFkZE9wZXJhdGlvbihuZXcgQHR5cGVzLkRlbGltaXRlciB1aWRfYmVnLCB1bmRlZmluZWQsIHVpZF9lbmQpLmV4ZWN1dGUoKVxuICAgIGVuZCA9IEBIQi5hZGRPcGVyYXRpb24obmV3IEB0eXBlcy5EZWxpbWl0ZXIgdWlkX2VuZCwgYmVnLCB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuXG4gICAgQHJvb3RfZWxlbWVudCA9IG5ldyBAdHlwZXMuUmVwbGFjZU1hbmFnZXIgdW5kZWZpbmVkLCBASEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCksIGJlZywgZW5kXG4gICAgQEhCLmFkZE9wZXJhdGlvbihAcm9vdF9lbGVtZW50KS5leGVjdXRlKClcbiAgICBAcm9vdF9lbGVtZW50LnJlcGxhY2UgZmlyc3Rfd29yZCwgQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpXG5cbiAgI1xuICAjIEByZXR1cm4gSnNvblR5cGVcbiAgI1xuICBnZXRTaGFyZWRPYmplY3Q6ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50LnZhbCgpXG5cbiAgI1xuICAjIEdldCB0aGUgaW5pdGlhbGl6ZWQgY29ubmVjdG9yLlxuICAjXG4gIGdldENvbm5lY3RvcjogKCktPlxuICAgIEBjb25uZWN0b3JcblxuICAjXG4gICMgQHNlZSBIaXN0b3J5QnVmZmVyXG4gICNcbiAgZ2V0SGlzdG9yeUJ1ZmZlcjogKCktPlxuICAgIEBIQlxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnNldE11dGFibGVEZWZhdWx0XG4gICNcbiAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLnNldE11dGFibGVEZWZhdWx0KG11dGFibGUpXG5cbiAgI1xuICAjIEdldCB0aGUgVXNlcklkIGZyb20gdGhlIEhpc3RvcnlCdWZmZXIgb2JqZWN0LlxuICAjIEluIG1vc3QgY2FzZXMgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzIHRoZSB1c2VyX2lkIHZhbHVlIHdpdGggd2hpY2hcbiAgIyBKc29uRnJhbWV3b3JrIHdhcyBpbml0aWFsaXplZCAoRGVwZW5kaW5nIG9uIHRoZSBIaXN0b3J5QnVmZmVyIGltcGxlbWVudGF0aW9uKS5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBASEIuZ2V0VXNlcklkKClcblxuICAjXG4gICMgQHNlZSBKc29uVHlwZS50b0pzb25cbiAgI1xuICB0b0pzb24gOiAoKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLnRvSnNvbigpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsXG4gICNcbiAgdmFsIDogKCktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS52YWwgYXJndW1lbnRzLi4uXG5cbiAgI1xuICAjIEBzZWUgT3BlcmF0aW9uLm9uXG4gICNcbiAgb246ICgpLT5cbiAgICBAZ2V0U2hhcmVkT2JqZWN0KCkub24gYXJndW1lbnRzLi4uXG5cbiAgI1xuICAjIEBzZWUgT3BlcmF0aW9uLmRlbGV0ZUxpc3RlbmVyXG4gICNcbiAgZGVsZXRlTGlzdGVuZXI6ICgpLT5cbiAgICBAZ2V0U2hhcmVkT2JqZWN0KCkuZGVsZXRlTGlzdGVuZXIgYXJndW1lbnRzLi4uXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsdWVcbiAgI1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvbkZyYW1ld29yay5wcm90b3R5cGUsICd2YWx1ZScsXG4gICAgZ2V0IDogLT4gQGdldFNoYXJlZE9iamVjdCgpLnZhbHVlXG4gICAgc2V0IDogKG8pLT5cbiAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgQHZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEpzb25GcmFtZXdvcmtcbmlmIHdpbmRvdz9cbiAgaWYgbm90IHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZID0ge31cbiAgd2luZG93LlkuSnNvbkZyYW1ld29yayA9IEpzb25GcmFtZXdvcmtcbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cblxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cbiAgICBAZ2FyYmFnZSA9IFtdICMgV2lsbCBiZSBjbGVhbmVkIG9uIG5leHQgY2FsbCBvZiBnYXJiYWdlQ29sbGVjdG9yXG4gICAgQHRyYXNoID0gW10gIyBJcyBkZWxldGVkLiBXYWl0IHVudGlsIGl0IGlzIG5vdCB1c2VkIGFueW1vcmUuXG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IHRydWVcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gMTAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLmNyZWF0b3IpID4gby5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgICBkb1N5bmM6IGZhbHNlXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiBvLmRvU3luYyBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LmNyZWF0b3IsIG9fbmV4dC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fbmV4dCA9IG9fbmV4dC5uZXh0X2NsXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsPyAjIG1vc3QgcmlnaHQgZGVsaW1pdGVyIG9ubHkhXG4gICAgICAgICAgICAjIHNhbWUgYXMgdGhlIGFib3ZlIHdpdGggcHJldi5cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fcHJldi5jcmVhdG9yLCBvX3ByZXYub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxuICAgIGlmIHVpZCBpbnN0YW5jZW9mIE9iamVjdFxuICAgICAgQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgZWxzZSBpZiBub3QgdWlkP1xuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgdHlwZSBvZiB1aWQgaXMgbm90IGRlZmluZWQhXCJcbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLmNyZWF0b3JdID0ge31cbiAgICBpZiBAYnVmZmVyW28uY3JlYXRvcl1bby5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXSA9IG9cbiAgICBAbnVtYmVyX29mX29wZXJhdGlvbnNfYWRkZWRfdG9fSEIgPz0gMCAjIFRPRE86IERlYnVnLCByZW1vdmUgdGhpc1xuICAgIEBudW1iZXJfb2Zfb3BlcmF0aW9uc19hZGRlZF90b19IQisrXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLmNyZWF0b3JdP1tvLm9wX251bWJlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0gPSAwXG4gICAgaWYgdHlwZW9mIG8ub3BfbnVtYmVyIGlzICdudW1iZXInIGFuZCBvLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcbiAgICAgICMgVE9ETzogZml4IHRoaXMgaXNzdWUgYmV0dGVyLlxuICAgICAgIyBPcGVyYXRpb25zIHNob3VsZCBpbmNvbWUgaW4gb3JkZXJcbiAgICAgICMgVGhlbiB5b3UgZG9uJ3QgaGF2ZSB0byBkbyB0aGlzLi5cbiAgICAgIGlmIG8ub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdKytcbiAgICAgICAgd2hpbGUgQGdldE9wZXJhdGlvbih7Y3JlYXRvcjpvLmNyZWF0b3IsIG9wX251bWJlcjogQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl19KT9cbiAgICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSsrXG5cbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0gaXNudCAoby5vcF9udW1iZXIgKyAxKVxuICAgICAgI2NvbnNvbGUubG9nIChAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSAtIChvLm9wX251bWJlciArIDEpKVxuICAgICAgI2NvbnNvbGUubG9nIG9cbiAgICAgICN0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZG9uJ3QgcmVjZWl2ZSBvcGVyYXRpb25zIGluIHRoZSBwcm9wZXIgb3JkZXIuIFRyeSBjb3VudGluZyBsaWtlIHRoaXMgMCwxLDIsMyw0LC4uIDspXCJcblxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICAjIEBzZWUgRW5naW5lLnBhcnNlXG4gIHBhcnNlciA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEBwcml2YXRlXG4gICMgQGFic3RyYWN0XG4gICMgQG5vZG9jXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgKiBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxuICAjICogdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuIFdlIGV4dGVuZCB0aGUgcGFyc2VyIG9iamVjdCBpbiBvcmRlciB0byBwYXJzZSBlbmNvZGVkIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3MgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcbiAgICAgIEBkb1N5bmMgPSB0cnVlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgaWYgbm90IHVpZD9cbiAgICAgICAgdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgaWYgbm90IHVpZC5kb1N5bmM/XG4gICAgICAgIHVpZC5kb1N5bmMgPSBub3QgaXNOYU4ocGFyc2VJbnQodWlkLm9wX251bWJlcikpXG4gICAgICB7XG4gICAgICAgICdjcmVhdG9yJzogQGNyZWF0b3JcbiAgICAgICAgJ29wX251bWJlcicgOiBAb3BfbnVtYmVyXG4gICAgICAgICdkb1N5bmMnIDogQGRvU3luY1xuICAgICAgfSA9IHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gZXZlbnQgTmFtZSBvZiB0aGUgZXZlbnQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9uOiAoZXZlbnRzLCBmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID89IHt9XG4gICAgICBpZiBldmVudHMuY29uc3RydWN0b3IgaXNudCBbXS5jb25zdHJ1Y3RvclxuICAgICAgICBldmVudHMgPSBbZXZlbnRzXVxuICAgICAgZm9yIGUgaW4gZXZlbnRzXG4gICAgICAgIEBldmVudF9saXN0ZW5lcnNbZV0gPz0gW11cbiAgICAgICAgQGV2ZW50X2xpc3RlbmVyc1tlXS5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBmdW5jdGlvbiBmcm9tIGFuIGV2ZW50IC8gbGlzdCBvZiBldmVudHMuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5vblxuICAgICNcbiAgICAjIEBvdmVybG9hZCBkZWxldGVMaXN0ZW5lcihldmVudCwgZilcbiAgICAjICAgQHBhcmFtIGV2ZW50IHtTdHJpbmd9IEFuIGV2ZW50IG5hbWVcbiAgICAjICAgQHBhcmFtIGYgICAgIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRoYXQgeW91IHdhbnQgdG8gZGVsZXRlIGZyb20gdGhlc2UgZXZlbnRzXG4gICAgIyBAb3ZlcmxvYWQgZGVsZXRlTGlzdGVuZXIoZXZlbnRzLCBmKVxuICAgICMgICBAcGFyYW0gZXZlbnRzIHtBcnJheTxTdHJpbmc+fSBBIGxpc3Qgb2YgZXZlbnQgbmFtZXNcbiAgICAjICAgQHBhcmFtIGYgICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBmcm9tIHRoZXNlIGV2ZW50cy5cbiAgICBkZWxldGVMaXN0ZW5lcjogKGV2ZW50cywgZiktPlxuICAgICAgaWYgZXZlbnRzLmNvbnN0cnVjdG9yIGlzbnQgW10uY29uc3RydWN0b3JcbiAgICAgICAgZXZlbnRzID0gW2V2ZW50c11cbiAgICAgIGZvciBlIGluIGV2ZW50c1xuICAgICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tlXT9cbiAgICAgICAgICBAZXZlbnRfbGlzdGVuZXJzW2VdID0gQGV2ZW50X2xpc3RlbmVyc1tlXS5maWx0ZXIgKGcpLT5cbiAgICAgICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgI1xuICAgIGNhbGxFdmVudDogKCktPlxuICAgICAgQGZvcndhcmRFdmVudCBALCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQgYW5kIHNwZWNpZnkgaW4gd2hpY2ggY29udGV4dCB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkIChzZXQgJ3RoaXMnKS5cbiAgICAjXG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGV2ZW50LCBhcmdzLi4uKS0+XG4gICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tldmVudF0/XG4gICAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdXG4gICAgICAgICAgZi5jYWxsIG9wLCBldmVudCwgYXJncy4uLlxuXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBAaXNfZGVsZXRlZFxuXG4gICAgYXBwbHlEZWxldGU6IChnYXJiYWdlY29sbGVjdCA9IHRydWUpLT5cbiAgICAgIGlmIG5vdCBAZ2FyYmFnZV9jb2xsZWN0ZWRcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcbiAgICAgICAgQGlzX2RlbGV0ZWQgPSB0cnVlXG4gICAgICAgIGlmIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxuICAgICAgICAgIEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXG4gICAgICBIQi5yZW1vdmVPcGVyYXRpb24gQFxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIHsgJ2NyZWF0b3InOiBAY3JlYXRvciwgJ29wX251bWJlcic6IEBvcF9udW1iZXIgLCAnc3luYyc6IEBkb1N5bmN9XG5cbiAgICBkb250U3luYzogKCktPlxuICAgICAgQGRvU3luYyA9IGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgb3A/LmV4ZWN1dGU/XG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXG4gICNcbiAgY2xhc3MgRGVsZXRlIGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBkZWxldGVzKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIHBhcnNlclsnRGVsZXRlJ10gPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgRGVsZXRlIHVpZCwgZGVsZXRlc191aWRcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZFxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3MgSW5zZXJ0IGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzRGVsZXRlZCgpXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImRlbGV0ZVwiLCBALCBvXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIG5vdCAoQHByZXZfY2w/IGFuZCBAbmV4dF9jbD8pIG9yIEBwcmV2X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIEBuZXh0X2NsPy5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICMgVE9ETzogRGVidWdnaW5nXG4gICAgICBpZiBAcHJldl9jbD8uaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJsZWZ0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGRlbGV0ZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcbiAgICAgICAgc3VwZXJcblxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICAjIEBwYXJhbSBmaXJlX2V2ZW50IHtib29sZWFufSBXaGV0aGVyIHRvIGZpcmUgdGhlIGluc2VydC1ldmVudC5cbiAgICBleGVjdXRlOiAoZmlyZV9ldmVudCA9IHRydWUpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby5jcmVhdG9yIDwgQGNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcblxuICAgICAgICBwYXJlbnQgPSBAcHJldl9jbD8uZ2V0UGFyZW50KClcbiAgICAgICAgaWYgcGFyZW50PyBhbmQgZmlyZV9ldmVudFxuICAgICAgICAgIEBzZXRQYXJlbnQgcGFyZW50XG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnQgXCJpbnNlcnRcIiwgQFxuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2YgRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIERlZmluZXMgYW4gb2JqZWN0IHRoYXQgaXMgY2Fubm90IGJlIGNoYW5nZWQuIFlvdSBjYW4gdXNlIHRoaXMgdG8gc2V0IGFuIGltbXV0YWJsZSBzdHJpbmcsIG9yIGEgbnVtYmVyLlxuICAjXG4gIGNsYXNzIEltbXV0YWJsZU9iamVjdCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGNvbnRlbnRcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIEBjb250ZW50LCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIkltbXV0YWJsZU9iamVjdFwiXG5cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtTdHJpbmddIFRoZSBjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICB2YWwgOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIkltbXV0YWJsZU9iamVjdFwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdjb250ZW50JyA6IEBjb250ZW50XG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gIyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luKCkuZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ0ltbXV0YWJsZU9iamVjdCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSW1tdXRhYmxlT2JqZWN0IHVpZCwgY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3MgRGVsaW1pdGVyIGV4dGVuZHMgT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcbiAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkRlbGltaXRlclwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0RlbGltaXRlciddID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IERlbGltaXRlciB1aWQsIHByZXYsIG5leHRcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDpcbiAgICAgICdEZWxldGUnIDogRGVsZXRlXG4gICAgICAnSW5zZXJ0JyA6IEluc2VydFxuICAgICAgJ0RlbGltaXRlcic6IERlbGltaXRlclxuICAgICAgJ09wZXJhdGlvbic6IE9wZXJhdGlvblxuICAgICAgJ0ltbXV0YWJsZU9iamVjdCcgOiBJbW11dGFibGVPYmplY3RcbiAgICAncGFyc2VyJyA6IHBhcnNlclxuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cblxuXG5cblxuIiwidGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVGV4dFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgdGV4dF90eXBlcyA9IHRleHRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHRleHRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gdGV4dF90eXBlcy5wYXJzZXJcblxuICBjcmVhdGVKc29uVHlwZVdyYXBwZXIgPSAoX2pzb25UeXBlKS0+XG5cbiAgICAjXG4gICAgIyBAbm90ZSBFWFBFUklNRU5UQUxcbiAgICAjXG4gICAgIyBBIEpzb25UeXBlV3JhcHBlciB3YXMgaW50ZW5kZWQgdG8gYmUgYSBjb252ZW5pZW50IHdyYXBwZXIgZm9yIHRoZSBKc29uVHlwZS5cbiAgICAjIEJ1dCBpdCBjYW4gbWFrZSB0aGluZ3MgbW9yZSBkaWZmaWN1bHQgdGhhbiB0aGV5IGFyZS5cbiAgICAjIEBzZWUgSnNvblR5cGVcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBjcmVhdGUgYSBKc29uVHlwZVdyYXBwZXJcbiAgICAjICAgIyBZb3UgZ2V0IGEgSnNvblR5cGVXcmFwcGVyIGZyb20gYSBKc29uVHlwZSBieSBjYWxsaW5nXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICNcbiAgICAjIEl0IGNyZWF0ZXMgSmF2YXNjcmlwdHMgLWdldHRlciBhbmQgLXNldHRlciBtZXRob2RzIGZvciBlYWNoIHByb3BlcnR5IHRoYXQgSnNvblR5cGUgbWFpbnRhaW5zLlxuICAgICMgQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvZGVmaW5lUHJvcGVydHlcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBHZXR0ZXIgRXhhbXBsZVxuICAgICMgICAjIHlvdSBjYW4gYWNjZXNzIHRoZSB4IHByb3BlcnR5IG9mIHlhdHRhIGJ5IGNhbGxpbmdcbiAgICAjICAgdy54XG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnKVxuICAgICNcbiAgICAjIEBub3RlIFlvdSBjYW4gb25seSBvdmVyd3JpdGUgZXhpc3RpbmcgdmFsdWVzISBTZXR0aW5nIGEgbmV3IHByb3BlcnR5IHdvbid0IGhhdmUgYW55IGVmZmVjdCFcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBTZXR0ZXIgRXhhbXBsZVxuICAgICMgICAjIHlvdSBjYW4gc2V0IGFuIGV4aXN0aW5nIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnggPSBcInRleHRcIlxuICAgICMgICAjIGluc3RlYWQgb2ZcbiAgICAjICAgeWF0dGEudmFsKCd4JywgXCJ0ZXh0XCIpXG4gICAgI1xuICAgICMgSW4gb3JkZXIgdG8gc2V0IGEgbmV3IHByb3BlcnR5IHlvdSBoYXZlIHRvIG92ZXJ3cml0ZSBhbiBleGlzdGluZyBwcm9wZXJ0eS5cbiAgICAjIFRoZXJlZm9yZSB0aGUgSnNvblR5cGVXcmFwcGVyIHN1cHBvcnRzIGEgc3BlY2lhbCBmZWF0dXJlIHRoYXQgc2hvdWxkIG1ha2UgdGhpbmdzIG1vcmUgY29udmVuaWVudFxuICAgICMgKHdlIGNhbiBhcmd1ZSBhYm91dCB0aGF0LCB1c2UgdGhlIEpzb25UeXBlIGlmIHlvdSBkb24ndCBsaWtlIGl0IDspLlxuICAgICMgSWYgeW91IG92ZXJ3cml0ZSBhbiBvYmplY3QgcHJvcGVydHkgb2YgdGhlIEpzb25UeXBlV3JhcHBlciB3aXRoIGEgbmV3IG9iamVjdCwgaXQgd2lsbCByZXN1bHQgaW4gYSBtZXJnZWQgdmVyc2lvbiBvZiB0aGUgb2JqZWN0cy5cbiAgICAjIExldCBgeWF0dGEudmFsdWUucGAgdGhlIHByb3BlcnR5IHRoYXQgaXMgdG8gYmUgb3ZlcndyaXR0ZW4gYW5kIG8gdGhlIG5ldyB2YWx1ZS4gRS5nLiBgeWF0dGEudmFsdWUucCA9IG9gXG4gICAgIyAqIFRoZSByZXN1bHQgaGFzIGFsbCBwcm9wZXJ0aWVzIG9mIG9cbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygdy5wIGlmIHRoZXkgZG9uJ3Qgb2NjdXIgdW5kZXIgdGhlIHNhbWUgcHJvcGVydHktbmFtZSBpbiBvLlxuICAgICNcbiAgICAjIEBleGFtcGxlIENvbmZsaWN0IEV4YW1wbGVcbiAgICAjICAgeWF0dGEudmFsdWUgPSB7YSA6IFwic3RyaW5nXCJ9XG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdy5hID0ge2EgOiB7YiA6IFwic3RyaW5nXCJ9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wifX1cbiAgICAjICAgdy5hID0ge2EgOiB7YyA6IDR9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wiLCBjIDogNH19XG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29tbW9uIFBpdGZhbGxzXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICAjIFNldHRpbmcgYSBuZXcgcHJvcGVydHlcbiAgICAjICAgdy5uZXdQcm9wZXJ0eSA9IFwiQXdlc29tZVwiXG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgZmFsc2UsIHcubmV3UHJvcGVydHkgaXMgdW5kZWZpbmVkXG4gICAgIyAgICMgb3ZlcndyaXRlIHRoZSB3IG9iamVjdFxuICAgICMgICB3ID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSEsIGJ1dCAuLlxuICAgICMgICBjb25zb2xlLmxvZyh5YXR0YS52YWx1ZS5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgeW91IGFyZSBvbmx5IGFsbG93ZWQgdG8gc2V0IHByb3BlcnRpZXMhXG4gICAgIyAgICMgVGhlIHNvbHV0aW9uXG4gICAgIyAgIHlhdHRhLnZhbHVlID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSFcbiAgICAjXG4gICAgY2xhc3MgSnNvblR5cGVXcmFwcGVyXG5cbiAgICAgICNcbiAgICAgICMgQHBhcmFtIHtKc29uVHlwZX0ganNvblR5cGUgSW5zdGFuY2Ugb2YgdGhlIEpzb25UeXBlIHRoYXQgdGhpcyBjbGFzcyB3cmFwcGVzLlxuICAgICAgI1xuICAgICAgY29uc3RydWN0b3I6IChqc29uVHlwZSktPlxuICAgICAgICBmb3IgbmFtZSwgb2JqIG9mIGpzb25UeXBlLm1hcFxuICAgICAgICAgIGRvIChuYW1lLCBvYmopLT5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBKc29uVHlwZVdyYXBwZXIucHJvdG90eXBlLCBuYW1lLFxuICAgICAgICAgICAgICBnZXQgOiAtPlxuICAgICAgICAgICAgICAgIHggPSBvYmoudmFsKClcbiAgICAgICAgICAgICAgICBpZiB4IGluc3RhbmNlb2YgSnNvblR5cGVcbiAgICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25UeXBlV3JhcHBlciB4XG4gICAgICAgICAgICAgICAgZWxzZSBpZiB4IGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgICAgICAgICB4LnZhbCgpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgeFxuICAgICAgICAgICAgICBzZXQgOiAobyktPlxuICAgICAgICAgICAgICAgIG92ZXJ3cml0ZSA9IGpzb25UeXBlLnZhbChuYW1lKVxuICAgICAgICAgICAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3IgYW5kIG92ZXJ3cml0ZSBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZS52YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAganNvblR5cGUudmFsKG5hbWUsIG8sICdpbW11dGFibGUnKVxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICBuZXcgSnNvblR5cGVXcmFwcGVyIF9qc29uVHlwZVxuXG4gICNcbiAgIyBNYW5hZ2VzIE9iamVjdC1saWtlIHZhbHVlcy5cbiAgI1xuICBjbGFzcyBKc29uVHlwZSBleHRlbmRzIHR5cGVzLk1hcE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsX3ZhbHVlIENyZWF0ZSB0aGlzIG9wZXJhdGlvbiB3aXRoIGFuIGluaXRpYWwgdmFsdWUuXG4gICAgIyBAcGFyYW0ge1N0cmluZ3xCb29sZWFufSBXaGV0aGVyIHRoZSBpbml0aWFsX3ZhbHVlIHNob3VsZCBiZSBjcmVhdGVkIGFzIG11dGFibGUuIChPcHRpb25hbCAtIHNlZSBzZXRNdXRhYmxlRGVmYXVsdClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGluaXRpYWxfdmFsdWUsIG11dGFibGUpLT5cbiAgICAgIHN1cGVyIHVpZFxuICAgICAgaWYgaW5pdGlhbF92YWx1ZT9cbiAgICAgICAgaWYgdHlwZW9mIGluaXRpYWxfdmFsdWUgaXNudCBcIm9iamVjdFwiXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhlIGluaXRpYWwgdmFsdWUgb2YgSnNvblR5cGVzIG11c3QgYmUgb2YgdHlwZSBPYmplY3QhIChjdXJyZW50IHR5cGU6ICN7dHlwZW9mIGluaXRpYWxfdmFsdWV9KVwiXG4gICAgICAgIGZvciBuYW1lLG8gb2YgaW5pdGlhbF92YWx1ZVxuICAgICAgICAgIEB2YWwgbmFtZSwgbywgbXV0YWJsZVxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIGpzb24tdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHlhdHRhLnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiSnNvblR5cGVcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJKc29uVHlwZVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICNcbiAgICAjIFRyYW5zZm9ybSB0aGlzIHRvIGEgSnNvbiBhbmQgbG9vc2UgYWxsIHRoZSBzaGFyaW5nLWFiaWxpdGllcyAodGhlIG5ldyBvYmplY3Qgd2lsbCBiZSBhIGRlZXAgY2xvbmUpIVxuICAgICMgQHJldHVybiB7SnNvbn1cbiAgICAjXG4gICAgdG9Kc29uOiAoKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGpzb24gPSB7fVxuICAgICAgZm9yIG5hbWUsIG8gb2YgdmFsXG4gICAgICAgIGlmIG8gaXMgbnVsbFxuICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICAgIGVsc2UgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgIGpzb25bbmFtZV0gPSBAdmFsKG5hbWUpLnRvSnNvbigpXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIHdoaWxlIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgIG8gPSBvLnZhbCgpXG4gICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICBqc29uXG5cbiAgICAjXG4gICAgIyBAc2VlIFdvcmRUeXBlLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgIyBTZXRzIHRoZSBwYXJlbnQgb2YgdGhpcyBKc29uVHlwZSBvYmplY3QuXG4gICAgI1xuICAgIHNldFJlcGxhY2VNYW5hZ2VyOiAocmVwbGFjZV9tYW5hZ2VyKS0+XG4gICAgICBAcmVwbGFjZV9tYW5hZ2VyID0gcmVwbGFjZV9tYW5hZ2VyXG4gICAgICBAb24gWydjaGFuZ2UnLCdhZGRQcm9wZXJ0eSddLCAoKS0+XG4gICAgICAgIGlmIHJlcGxhY2VfbWFuYWdlci5wYXJlbnQ/XG4gICAgICAgICAgcmVwbGFjZV9tYW5hZ2VyLnBhcmVudC5mb3J3YXJkRXZlbnQgdGhpcywgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIEpzb25UeXBlLlxuICAgICMgQHJldHVybiB7SnNvblR5cGV9XG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHJlcGxhY2VfbWFuYWdlci5wYXJlbnRcblxuICAgICNcbiAgICAjIFdoZXRoZXIgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnICh0cnVlKSBvciAnaW1tdXRhYmxlJyAoZmFsc2UpXG4gICAgI1xuICAgIG11dGFibGVfZGVmYXVsdDpcbiAgICAgIHRydWVcblxuICAgICNcbiAgICAjIFNldCBpZiB0aGUgZGVmYXVsdCBpcyAnbXV0YWJsZScgb3IgJ2ltbXV0YWJsZSdcbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IG11dGFibGUgU2V0IGVpdGhlciAnbXV0YWJsZScgLyB0cnVlIG9yICdpbW11dGFibGUnIC8gZmFsc2VcbiAgICBzZXRNdXRhYmxlRGVmYXVsdDogKG11dGFibGUpLT5cbiAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICBKc29uVHlwZS5wcm90b3R5cGUubXV0YWJsZV9kZWZhdWx0ID0gdHJ1ZVxuICAgICAgZWxzZSBpZiBtdXRhYmxlIGlzIGZhbHNlIG9yIG11dGFibGUgaXMgJ2ltbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciAnU2V0IG11dGFibGUgZWl0aGVyIFwibXV0YWJsZVwiIG9yIFwiaW1tdXRhYmxlXCIhJ1xuICAgICAgJ09LJ1xuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbCgpXG4gICAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICAgIyAgIEByZXR1cm4gW0pzb25dXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAgICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZXxXb3JkVHlwZXxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICAgIGlmIHR5cGVvZiBuYW1lIGlzICdvYmplY3QnXG4gICAgICAgICMgU3BlY2lhbCBjYXNlLiBGaXJzdCBhcmd1bWVudCBpcyBhbiBvYmplY3QuIFRoZW4gdGhlIHNlY29uZCBhcmcgaXMgbXV0YWJsZS5cbiAgICAgICAgIyBLZWVwIHRoYXQgaW4gbWluZCB3aGVuIHJlYWRpbmcgdGhlIGZvbGxvd2luZy4uXG4gICAgICAgIGpzb24gPSBuZXcgSnNvblR5cGUgdW5kZWZpbmVkLCBuYW1lLCBjb250ZW50XG4gICAgICAgIEhCLmFkZE9wZXJhdGlvbihqc29uKS5leGVjdXRlKClcbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlci5yZXBsYWNlIGpzb25cbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lPyBhbmQgYXJndW1lbnRzLmxlbmd0aCA+IDFcbiAgICAgICAgaWYgbXV0YWJsZT9cbiAgICAgICAgICBpZiBtdXRhYmxlIGlzIHRydWUgb3IgbXV0YWJsZSBpcyAnbXV0YWJsZSdcbiAgICAgICAgICAgIG11dGFibGUgPSB0cnVlXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgbXV0YWJsZSA9IGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtdXRhYmxlID0gQG11dGFibGVfZGVmYXVsdFxuICAgICAgICBpZiB0eXBlb2YgY29udGVudCBpcyAnZnVuY3Rpb24nXG4gICAgICAgICAgQCAjIEp1c3QgZG8gbm90aGluZ1xuICAgICAgICBlbHNlIGlmIChub3QgY29udGVudD8pIG9yICgoKG5vdCBtdXRhYmxlKSBvciB0eXBlb2YgY29udGVudCBpcyAnbnVtYmVyJykgYW5kIGNvbnRlbnQuY29uc3RydWN0b3IgaXNudCBPYmplY3QpXG4gICAgICAgICAgb2JqID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICAgICAgICBzdXBlciBuYW1lLCBvYmpcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdzdHJpbmcnXG4gICAgICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5Xb3JkVHlwZSB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuICAgICAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIGNvbnRlbnRcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIHdvcmRcbiAgICAgICAgICBlbHNlIGlmIGNvbnRlbnQuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgICBqc29uID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBKc29uVHlwZSB1bmRlZmluZWQsIGNvbnRlbnQsIG11dGFibGUpLmV4ZWN1dGUoKVxuICAgICAgICAgICAgc3VwZXIgbmFtZSwganNvblxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBzZXQgI3t0eXBlb2YgY29udGVudH0tdHlwZXMgaW4gY29sbGFib3JhdGl2ZSBKc29uLW9iamVjdHMhXCJcbiAgICAgIGVsc2VcbiAgICAgICAgc3VwZXIgbmFtZSwgY29udGVudFxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25UeXBlLnByb3RvdHlwZSwgJ3ZhbHVlJyxcbiAgICAgIGdldCA6IC0+IGNyZWF0ZUpzb25UeXBlV3JhcHBlciBAXG4gICAgICBzZXQgOiAobyktPlxuICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICBAdmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkpzb25UeXBlXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0pzb25UeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSnNvblR5cGUgdWlkXG5cblxuXG5cbiAgdHlwZXNbJ0pzb25UeXBlJ10gPSBKc29uVHlwZVxuXG4gIHRleHRfdHlwZXNcblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IGJhc2ljX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBNYXBNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBmb3IgbmFtZSxwIG9mIEBtYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25UeXBlcy52YWxcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgaWYgbm90IEBtYXBbbmFtZV0/XG4gICAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG5ldyBBZGROYW1lIHVuZGVmaW5lZCwgQCwgbmFtZSkuZXhlY3V0ZSgpXG4gICAgICAgIEBtYXBbbmFtZV0ucmVwbGFjZSBjb250ZW50XG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgb2JqID0gQG1hcFtuYW1lXT8udmFsKClcbiAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgb2JqLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvYmpcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAbWFwXG4gICAgICAgICAgb2JqID0gby52YWwoKVxuICAgICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdCBvciBvYmogaW5zdGFuY2VvZiBNYXBNYW5hZ2VyXG4gICAgICAgICAgICBvYmogPSBvYmoudmFsKClcbiAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvYmpcbiAgICAgICAgcmVzdWx0XG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFdoZW4gYSBuZXcgcHJvcGVydHkgaW4gYSBtYXAgbWFuYWdlciBpcyBjcmVhdGVkLCB0aGVuIHRoZSB1aWRzIG9mIHRoZSBpbnNlcnRlZCBPcGVyYXRpb25zXG4gICMgbXVzdCBiZSB1bmlxdWUgKHRoaW5rIGFib3V0IGNvbmN1cnJlbnQgb3BlcmF0aW9ucykuIFRoZXJlZm9yZSBvbmx5IGFuIEFkZE5hbWUgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG9cbiAgIyBhZGQgYSBwcm9wZXJ0eSBpbiBhIE1hcE1hbmFnZXIuIElmIHR3byBBZGROYW1lIG9wZXJhdGlvbnMgb24gdGhlIHNhbWUgTWFwTWFuYWdlciBuYW1lIGhhcHBlbiBjb25jdXJyZW50bHlcbiAgIyBvbmx5IG9uZSB3aWxsIEFkZE5hbWUgb3BlcmF0aW9uIHdpbGwgYmUgZXhlY3V0ZWQuXG4gICNcbiAgY2xhc3MgQWRkTmFtZSBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IG1hcF9tYW5hZ2VyIFVpZCBvciByZWZlcmVuY2UgdG8gdGhlIE1hcE1hbmFnZXIuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IHdpbGwgYmUgYWRkZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBtYXBfbWFuYWdlciwgQG5hbWUpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdtYXBfbWFuYWdlcicsIG1hcF9tYW5hZ2VyXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiQWRkTmFtZVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgSWYgbWFwX21hbmFnZXIgZG9lc24ndCBoYXZlIHRoZSBwcm9wZXJ0eSBuYW1lLCB0aGVuIGFkZCBpdC5cbiAgICAjIFRoZSBSZXBsYWNlTWFuYWdlciB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gb24gdGhlIHByb3BlcnR5IGlzIHVuaXF1ZVxuICAgICMgaW4gc3VjaCBhIHdheSB0aGF0IGlmIEFkZE5hbWUgaXMgZXhlY3V0ZWQgKGZyb20gYW5vdGhlciBwZWVyKSBpdCB3aWxsXG4gICAgIyBhbHdheXMgaGF2ZSB0aGUgc2FtZSByZXN1bHQgKFJlcGxhY2VNYW5hZ2VyLCBhbmQgaXRzIGJlZ2lubmluZyBhbmQgZW5kIGFyZSB0aGUgc2FtZSlcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB1aWRfciA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIl8je3VpZF9iZWcub3BfbnVtYmVyfV9STV8je0BuYW1lfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiXyN7dWlkX2VuZC5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2VuZFwiXG4gICAgICAgICAgYmVnID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0gPSBIQi5hZGRPcGVyYXRpb24obmV3IFJlcGxhY2VNYW5hZ2VyIHVuZGVmaW5lZCwgdWlkX3IsIGJlZywgZW5kKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLnNldFBhcmVudCBAbWFwX21hbmFnZXIsIEBuYW1lXG4gICAgICAgICAgKEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLmFkZF9uYW1lX29wcyA/PSBbXSkucHVzaCBAXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0uZXhlY3V0ZSgpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiQWRkTmFtZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdtYXBfbWFuYWdlcicgOiBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgJ25hbWUnIDogQG5hbWVcbiAgICAgIH1cblxuICBwYXJzZXJbJ0FkZE5hbWUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ21hcF9tYW5hZ2VyJyA6IG1hcF9tYW5hZ2VyXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ25hbWUnIDogbmFtZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IEFkZE5hbWUgdWlkLCBtYXBfbWFuYWdlciwgbmFtZVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIExpc3RNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIGJlZ2lubmluZz8gYW5kIGVuZD9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2JlZ2lubmluZycsIGJlZ2lubmluZ1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnZW5kJywgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIEBiZWdpbm5pbmcgPSBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICAgIEBlbmQgPSAgICAgICBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICByZXN1bHQucHVzaCBvXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgaWYgKHBvc2l0aW9uID4gMCBvciBvLmlzRGVsZXRlZCgpKSBhbmQgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgIyBmaW5kIGZpcnN0IG5vbiBkZWxldGVkIG9wXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIHBvc2l0aW9uIC09IDFcbiAgICAgIG9cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkVHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBXb3JkVHlwZVxuICAjXG4gIGNsYXNzIFJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgTGlzdE1hbmFnZXJcbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoaW5pdGlhbF9jb250ZW50LCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuICAgICAgaWYgaW5pdGlhbF9jb250ZW50P1xuICAgICAgICBAcmVwbGFjZSBpbml0aWFsX2NvbnRlbnRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgIyBpZiB0aGlzIHdhcyBjcmVhdGVkIGJ5IGFuIEFkZE5hbWUgb3BlcmF0aW9uLCBkZWxldGUgaXQgdG9vXG4gICAgICBpZiBAYWRkX25hbWVfb3BzP1xuICAgICAgICBmb3IgbyBpbiBAYWRkX25hbWVfb3BzXG4gICAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgb3AgPSBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2xcbiAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEFkZCBjaGFuZ2UgbGlzdGVuZXJzIGZvciBwYXJlbnQuXG4gICAgI1xuICAgIHNldFBhcmVudDogKHBhcmVudCwgcHJvcGVydHlfbmFtZSktPlxuICAgICAgcmVwbF9tYW5hZ2VyID0gdGhpc1xuICAgICAgQG9uICdpbnNlcnQnLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIGlmIG9wLm5leHRfY2wgaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICByZXBsX21hbmFnZXIucGFyZW50LmNhbGxFdmVudCAnY2hhbmdlJywgcHJvcGVydHlfbmFtZSwgb3BcbiAgICAgIEBvbiAnY2hhbmdlJywgKGV2ZW50LCBvcCktPlxuICAgICAgICBpZiByZXBsX21hbmFnZXIgaXNudCB0aGlzXG4gICAgICAgICAgcmVwbF9tYW5hZ2VyLnBhcmVudC5jYWxsRXZlbnQgJ2NoYW5nZScsIHByb3BlcnR5X25hbWUsIG9wXG4gICAgICAjIENhbGwgdGhpcywgd2hlbiB0aGUgZmlyc3QgZWxlbWVudCBpcyBpbnNlcnRlZC4gVGhlbiBkZWxldGUgdGhlIGxpc3RlbmVyLlxuICAgICAgYWRkUHJvcGVydHlMaXN0ZW5lciA9IChldmVudCwgb3ApLT5cbiAgICAgICAgcmVwbF9tYW5hZ2VyLmRlbGV0ZUxpc3RlbmVyICdhZGRQcm9wZXJ0eScsIGFkZFByb3BlcnR5TGlzdGVuZXJcbiAgICAgICAgcmVwbF9tYW5hZ2VyLnBhcmVudC5jYWxsRXZlbnQgJ2FkZFByb3BlcnR5JywgcHJvcGVydHlfbmFtZSwgb3BcbiAgICAgIEBvbiAnaW5zZXJ0JywgYWRkUHJvcGVydHlMaXN0ZW5lclxuICAgICAgc3VwZXIgcGFyZW50XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFR5cGVcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiUmVwbGFjZU1hbmFnZXJcIlxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyAjIGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4oKS5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlJlcGxhY2VNYW5hZ2VyXCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlTWFuYWdlciBjb250ZW50LCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZXMuXG4gICMgQHNlZSBSZXBsYWNlTWFuYWdlclxuICAjXG4gIGNsYXNzIFJlcGxhY2VhYmxlIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBpZiBub3QgKHByZXY/IGFuZCBuZXh0PylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZGVmaW5lIHByZXYsIGFuZCBuZXh0IGZvciBSZXBsYWNlYWJsZS10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIHR5cGU6IFwiUmVwbGFjZWFibGVcIlxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyByZXBsYWNlYWJsZSB3aXRoIG5ldyBjb250ZW50LlxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCktPlxuICAgICAgQHBhcmVudC5yZXBsYWNlIGNvbnRlbnRcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgICBAY29udGVudC5kb250U3luYygpXG4gICAgICBAY29udGVudCA9IG51bGxcbiAgICAgIHN1cGVyXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgSWYgcG9zc2libGUgc2V0IHRoZSByZXBsYWNlIG1hbmFnZXIgaW4gdGhlIGNvbnRlbnQuXG4gICAgIyBAc2VlIFdvcmRUeXBlLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQ/LnNldFJlcGxhY2VNYW5hZ2VyPyhAcGFyZW50KVxuICAgICAgICAjIG9ubHkgZmlyZSAnaW5zZXJ0LWV2ZW50JyAod2hpY2ggd2lsbCByZXN1bHQgaW4gYWRkUHJvcGVydHkgYW5kIGNoYW5nZSBldmVudHMpLFxuICAgICAgICAjIHdoZW4gY29udGVudCBpcyBhZGRlZC4gSW4gY2FzZSBvZiBKc29uLCBlbXB0eSBjb250ZW50IG1lYW5zIHRoYXQgdGhpcyBpcyBub3QgdGhlIGxhc3QgdXBkYXRlLFxuICAgICAgICAjIHNpbmNlIGNvbnRlbnQgaXMgZGVsZXRlZCB3aGVuICdhcHBseURlbGV0ZScgd2FzIGV4ZWN0dXRlZC5cbiAgICAgICAgaW5zX3Jlc3VsdCA9IHN1cGVyKEBjb250ZW50PykgIyBAY29udGVudD8gd2hldGhlciB0byBmaXJlIG9yIG5vdFxuICAgICAgICBpZiBpbnNfcmVzdWx0XG4gICAgICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBAcHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgICAgIGVsc2UgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBhcHBseURlbGV0ZSgpXG5cbiAgICAgICAgcmV0dXJuIGluc19yZXN1bHRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VhYmxlXCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50Py5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgdHlwZXNbJ0xpc3RNYW5hZ2VyJ10gPSBMaXN0TWFuYWdlclxuICB0eXBlc1snTWFwTWFuYWdlciddID0gTWFwTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZU1hbmFnZXInXSA9IFJlcGxhY2VNYW5hZ2VyXG4gIHR5cGVzWydSZXBsYWNlYWJsZSddID0gUmVwbGFjZWFibGVcblxuICBiYXNpY190eXBlc1xuXG5cblxuXG5cblxuIiwic3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vU3RydWN0dXJlZFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgc3RydWN0dXJlZF90eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gc3RydWN0dXJlZF90eXBlcy5wYXJzZXJcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQXQgdGhlIG1vbWVudCBUZXh0RGVsZXRlIHR5cGUgZXF1YWxzIHRoZSBEZWxldGUgdHlwZSBpbiBCYXNpY1R5cGVzLlxuICAjIEBzZWUgQmFzaWNUeXBlcy5EZWxldGVcbiAgI1xuICBjbGFzcyBUZXh0RGVsZXRlIGV4dGVuZHMgdHlwZXMuRGVsZXRlXG4gIHBhcnNlcltcIlRleHREZWxldGVcIl0gPSBwYXJzZXJbXCJEZWxldGVcIl1cblxuICAjXG4gICMgQG5vZG9jXG4gICMgRXh0ZW5kcyB0aGUgYmFzaWMgSW5zZXJ0IHR5cGUgdG8gYW4gb3BlcmF0aW9uIHRoYXQgaG9sZHMgYSB0ZXh0IHZhbHVlXG4gICNcbiAgY2xhc3MgVGV4dEluc2VydCBleHRlbmRzIHR5cGVzLkluc2VydFxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50IFRoZSBjb250ZW50IG9mIHRoaXMgSW5zZXJ0LXR5cGUgT3BlcmF0aW9uLiBVc3VhbGx5IHlvdSByZXN0cmljdCB0aGUgbGVuZ3RoIG9mIGNvbnRlbnQgdG8gc2l6ZSAxXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIGNvbnRlbnQ/LmNyZWF0b3I/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICB0eXBlOiBcIlRleHRJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuICAgICAgc3VwZXJcblxuICAgICNcbiAgICAjIFRoZSByZXN1bHQgd2lsbCBiZSBjb25jYXRlbmF0ZWQgd2l0aCB0aGUgcmVzdWx0cyBmcm9tIHRoZSBvdGhlciBpbnNlcnQgb3BlcmF0aW9uc1xuICAgICMgaW4gb3JkZXIgdG8gcmV0cmlldmUgdGhlIGNvbnRlbnQgb2YgdGhlIGVuZ2luZS5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci50b0V4ZWN1dGVkQXJyYXlcbiAgICAjXG4gICAgdmFsOiAoY3VycmVudF9wb3NpdGlvbiktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpIG9yIG5vdCBAY29udGVudD9cbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudFxuICAgICAgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiVGV4dEluc2VydFwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgSGFuZGxlcyBhIFdvcmRUeXBlLWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgIyBAbm90ZSBDdXJyZW50bHksIG9ubHkgVGV4dCBpcyBzdXBwb3J0ZWQhXG4gICNcbiAgY2xhc3MgV29yZFR5cGUgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIHdvcmQtdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHlhdHRhLnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiV29yZFR5cGVcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJXb3JkVHlwZVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgY29udGVudFxuXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50KS0+XG4gICAgICB3aGlsZSBsZWZ0LmlzRGVsZXRlZCgpXG4gICAgICAgIGxlZnQgPSBsZWZ0LnByZXZfY2wgIyBmaW5kIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gdGhlIGxlZnQsIHRoYXQgaXMgbm90IGRlbGV0ZWQuIENhc2UgcG9zaXRpb24gaXMgMCwgaXRzIHRoZSBEZWxpbWl0ZXIuXG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgaWYgY29udGVudC50eXBlP1xuICAgICAgICBvcCA9IG5ldyBUZXh0SW5zZXJ0IGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHRcbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcbiAgICAgIGVsc2VcbiAgICAgICAgZm9yIGMgaW4gY29udGVudFxuICAgICAgICAgIG9wID0gbmV3IFRleHRJbnNlcnQgYywgdW5kZWZpbmVkLCBsZWZ0LCByaWdodFxuICAgICAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG4gICAgICAgICAgbGVmdCA9IG9wXG4gICAgICBAXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBUaGlzIFdvcmRUeXBlIG9iamVjdC5cbiAgICAjXG4gICAgaW5zZXJ0VGV4dDogKHBvc2l0aW9uLCBjb250ZW50KS0+XG4gICAgICAjIFRPRE86IGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gc2hvdWxkIHJldHVybiBcIihpLTIpdGhcIiBjaGFyYWN0ZXJcbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgYSBpcyB0aGUgMHRoIGNoYXJhY3RlclxuICAgICAgbGVmdCA9IGl0aC5wcmV2X2NsICMgbGVmdCBpcyB0aGUgbm9uLWRlbGV0ZWQgY2hhcmF0aGVyIHRvIHRoZSBsZWZ0IG9mIGl0aFxuICAgICAgQGluc2VydEFmdGVyIGxlZnQsIGNvbnRlbnRcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBUaGlzIFdvcmRUeXBlIG9iamVjdFxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgd29yZCB3aXRoIGFub3RoZXIgb25lLiBDb25jdXJyZW50IHJlcGxhY2VtZW50cyBhcmUgbm90IG1lcmdlZCFcbiAgICAjIE9ubHkgb25lIG9mIHRoZSByZXBsYWNlbWVudHMgd2lsbCBiZSB1c2VkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge1dvcmRUeXBlfSBSZXR1cm5zIHRoZSBuZXcgV29yZFR5cGUgb2JqZWN0LlxuICAgICNcbiAgICByZXBsYWNlVGV4dDogKHRleHQpLT5cbiAgICAgICMgQ2FuIG9ubHkgYmUgdXNlZCBpZiB0aGUgUmVwbGFjZU1hbmFnZXIgd2FzIHNldCFcbiAgICAgICMgQHNlZSBXb3JkVHlwZS5zZXRSZXBsYWNlTWFuYWdlclxuICAgICAgaWYgQHJlcGxhY2VfbWFuYWdlcj9cbiAgICAgICAgd29yZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgV29yZFR5cGUgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIHRleHRcbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlci5yZXBsYWNlKHdvcmQpXG4gICAgICAgIHdvcmRcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyB0eXBlIGlzIGN1cnJlbnRseSBub3QgbWFpbnRhaW5lZCBieSBhIFJlcGxhY2VNYW5hZ2VyIVwiXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIHdvcmQuXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9IFRoZSBTdHJpbmctcmVwcmVzZW50YXRpb24gb2YgdGhpcyBvYmplY3QuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgYyA9IGZvciBvIGluIEB0b0FycmF5KClcbiAgICAgICAgaWYgby52YWw/XG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgXCJcIlxuICAgICAgYy5qb2luKCcnKVxuXG4gICAgI1xuICAgICMgU2FtZSBhcyBXb3JkVHlwZS52YWxcbiAgICAjIEBzZWUgV29yZFR5cGUudmFsXG4gICAgI1xuICAgIHRvU3RyaW5nOiAoKS0+XG4gICAgICBAdmFsKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbiBtb3N0IGNhc2VzIHlvdSB3b3VsZCBlbWJlZCBhIFdvcmRUeXBlIGluIGEgUmVwbGFjZWFibGUsIHdpY2ggaXMgaGFuZGxlZCBieSB0aGUgUmVwbGFjZU1hbmFnZXIgaW4gb3JkZXJcbiAgICAjIHRvIHByb3ZpZGUgcmVwbGFjZSBmdW5jdGlvbmFsaXR5LlxuICAgICNcbiAgICBzZXRSZXBsYWNlTWFuYWdlcjogKG9wKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncmVwbGFjZV9tYW5hZ2VyJywgb3BcbiAgICAgIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICBAb24gJ2luc2VydCcsIChldmVudCwgaW5zKT0+XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXI/LmZvcndhcmRFdmVudCBALCAnY2hhbmdlJywgaW5zXG4gICAgICBAb24gJ2RlbGV0ZScsIChldmVudCwgaW5zLCBkZWwpPT5cbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlcj8uZm9yd2FyZEV2ZW50IEAsICdjaGFuZ2UnLCBkZWxcbiAgICAjXG4gICAgIyBCaW5kIHRoaXMgV29yZFR5cGUgdG8gYSB0ZXh0ZmllbGQgb3IgaW5wdXQgZmllbGQuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHRleHRib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRleHRmaWVsZFwiKTtcbiAgICAjICAgeWF0dGEuYmluZCh0ZXh0Ym94KTtcbiAgICAjXG4gICAgYmluZDogKHRleHRmaWVsZCktPlxuICAgICAgd29yZCA9IEBcbiAgICAgIHRleHRmaWVsZC52YWx1ZSA9IEB2YWwoKVxuXG4gICAgICBAb24gXCJpbnNlcnRcIiwgKGV2ZW50LCBvcCktPlxuICAgICAgICBvX3BvcyA9IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuXG4gICAgICBAb24gXCJkZWxldGVcIiwgKGV2ZW50LCBvcCktPlxuICAgICAgICBvX3BvcyA9IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgIGlmIGN1cnNvciA8IG9fcG9zXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjdXJzb3IgLT0gMVxuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG4gICAgICAjIGNvbnN1bWUgYWxsIHRleHQtaW5zZXJ0IGNoYW5nZXMuXG4gICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IChldmVudCktPlxuICAgICAgICBjaGFyID0gbnVsbFxuICAgICAgICBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgICAgY2hhciA9ICdcXG4nXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUgZXZlbnQua2V5Q29kZVxuICAgICAgICBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICBwb3MgPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcyksIGRpZmZcbiAgICAgICAgICB3b3JkLmluc2VydFRleHQgcG9zLCBjaGFyXG4gICAgICAgICAgbmV3X3BvcyA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgICNcbiAgICAgICMgY29uc3VtZSBkZWxldGVzLiBOb3RlIHRoYXRcbiAgICAgICMgICBjaHJvbWU6IHdvbid0IGNvbnN1bWUgZGVsZXRpb25zIG9uIGtleXByZXNzIGV2ZW50LlxuICAgICAgIyAgIGtleUNvZGUgaXMgZGVwcmVjYXRlZC4gQlVUOiBJIGRvbid0IHNlZSBhbm90aGVyIHdheS5cbiAgICAgICMgICAgIHNpbmNlIGV2ZW50LmtleSBpcyBub3QgaW1wbGVtZW50ZWQgaW4gdGhlIGN1cnJlbnQgdmVyc2lvbiBvZiBjaHJvbWUuXG4gICAgICAjICAgICBFdmVyeSBicm93c2VyIHN1cHBvcnRzIGtleUNvZGUuIExldCdzIHN0aWNrIHdpdGggaXQgZm9yIG5vdy4uXG4gICAgICAjXG4gICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gKGV2ZW50KS0+XG4gICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgOCAjIEJhY2tzcGFjZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB0ZXh0ZmllbGQudmFsdWVcbiAgICAgICAgICAgICAgbmV3X3BvcyA9IHBvc1xuICAgICAgICAgICAgICBkZWxfbGVuZ3RoID0gMFxuICAgICAgICAgICAgICBpZiBwb3MgPiAwXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdoaWxlIG5ld19wb3MgPiAwIGFuZCB2YWxbbmV3X3Bvc10gaXNudCBcIiBcIiBhbmQgdmFsW25ld19wb3NdIGlzbnQgJ1xcbidcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IChwb3MtMSksIDFcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgNDYgIyBEZWxldGVcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgMVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiV29yZFR5cGVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gIyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luKCkuZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ1dvcmRUeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmRUeXBlIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkVHlwZSddID0gV29yZFR5cGVcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiJdfQ==
