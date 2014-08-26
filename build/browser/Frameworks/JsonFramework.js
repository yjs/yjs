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
    var first_word, type_manager;
    this.HB = new HistoryBuffer(user_id);
    type_manager = json_types_uninitialized(this.HB);
    this.types = type_manager.types;
    this.engine = new Engine(this.HB, type_manager.parser);
    this.connector = new Connector(this.engine, this.HB, type_manager.execution_listener, this);
    first_word = new this.types.JsonType(this.HB.getReservedUniqueIdentifier());
    this.HB.addOperation(first_word).execute();
    this.root_element = first_word;
  }

  JsonFramework.prototype.getSharedObject = function() {
    return this.root_element;
  };

  JsonFramework.prototype.getConnector = function() {
    return this.connector;
  };

  JsonFramework.prototype.getHistoryBuffer = function() {
    return this.HB;
  };

  JsonFramework.prototype.setMutableDefault = function(mutable) {
    return this.root_element.setMutableDefault(mutable);
  };

  JsonFramework.prototype.getUserId = function() {
    return this.HB.getUserId();
  };

  JsonFramework.prototype.toJson = function() {
    return this.root_element.toJson();
  };

  JsonFramework.prototype.val = function(name, content, mutable) {
    return this.root_element.val(name, content, mutable);
  };

  JsonFramework.prototype.on = function() {
    var _ref;
    return (_ref = this.root_element).on.apply(_ref, arguments);
  };

  JsonFramework.prototype.deleteListener = function() {
    var _ref;
    return (_ref = this.root_element).deleteListener.apply(_ref, arguments);
  };

  Object.defineProperty(JsonFramework.prototype, 'value', {
    get: function() {
      return this.root_element.value;
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
      if (uid == null) {
        uid = HB.getNextOperationIdentifier();
      }
      this.creator = uid['creator'], this.op_number = uid['op_number'];
    }

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

    Operation.prototype.setParent = function(parent) {
      this.parent = parent;
    };

    Operation.prototype.getParent = function() {
      return this.parent;
    };

    Operation.prototype.getUid = function() {
      return {
        'creator': this.creator,
        'op_number': this.op_number
      };
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

    Insert.prototype.applyDelete = function(o) {
      if (this.deleted_by == null) {
        this.deleted_by = [];
      }
      this.deleted_by.push(o);
      if ((this.parent != null) && this.deleted_by.length === 1) {
        return this.parent.callEvent("delete", this);
      }
    };

    Insert.prototype.isDeleted = function() {
      var _ref;
      return ((_ref = this.deleted_by) != null ? _ref.length : void 0) > 0;
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
        if (this === this.prev_cl) {
          throw new Error("this should not happen ;) ");
        }
        o = o.prev_cl;
      }
      return d;
    };

    Insert.prototype.update_sl = function() {
      var o;
      o = this.prev_cl;
      ({
        update: function(dest_cl, dest_sl) {
          var _results;
          _results = [];
          while (true) {
            if (o.isDeleted()) {
              _results.push(o = o[dest_cl]);
            } else {
              this[dest_sl] = o;
              break;
            }
          }
          return _results;
        }
      });
      update("prev_cl", "prev_sl");
      return update("next_cl", "prev_sl");
    };

    Insert.prototype.execute = function() {
      var distance_to_origin, i, o, parent, _ref, _ref1, _ref2;
      if (this.is_executed != null) {
        return this;
      }
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (((_ref = this.prev_cl) != null ? _ref.validateSavedOperations() : void 0) && ((_ref1 = this.next_cl) != null ? _ref1.validateSavedOperations() : void 0) && this.prev_cl.next_cl !== this) {
          distance_to_origin = 0;
          o = this.prev_cl.next_cl;
          i = 0;
          while (true) {
            if (o == null) {
              console.log(JSON.stringify(this.prev_cl.getUid()));
              console.log(JSON.stringify(this.next_cl.getUid()));
            }
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
        parent = (_ref2 = this.prev_cl) != null ? _ref2.getParent() : void 0;
        if (parent != null) {
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
        if ((prev.isDeleted != null) && !prev.isDeleted()) {
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
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return ImmutableObject;

  })(Insert);
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

    Delimiter.prototype.isDeleted = function() {
      return false;
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

    JsonType.prototype.setReplaceManager = function(rm) {
      this.parent = rm.parent;
      return this.on(['change', 'addProperty'], function() {
        var _ref;
        return (_ref = rm.parent).forwardEvent.apply(_ref, [this].concat(__slice.call(arguments)));
      });
    };

    JsonType.prototype.getParent = function() {
      return this.parent;
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
      var json, o, o_name, obj, word;
      if (typeof name === 'object') {
        for (o_name in name) {
          o = name[o_name];
          this.val(o_name, o, content);
        }
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

    AddName.prototype.execute = function() {
      var beg, end, uid_beg, uid_end, uid_r;
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

  })(types.Insert);
  ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(initial_content, uid, beginning, end, prev, next, origin) {
      ReplaceManager.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
      if (initial_content != null) {
        this.replace(initial_content);
      }
    }

    ReplaceManager.prototype.replace = function(content, replaceable_uid) {
      var o, op;
      o = this.getLastOperation();
      op = new Replaceable(content, this, replaceable_uid, o, o.next_cl);
      return HB.addOperation(op).execute();
    };

    ReplaceManager.prototype.setParent = function(parent, property_name) {
      var addPropertyListener;
      this.on('insert', (function(_this) {
        return function(event, op) {
          if (op.next_cl instanceof types.Delimiter) {
            return _this.parent.callEvent('change', property_name);
          }
        };
      })(this));
      this.on('change', (function(_this) {
        return function(event) {
          return _this.parent.callEvent('change', property_name);
        };
      })(this));
      addPropertyListener = (function(_this) {
        return function(event, op) {
          if (op.next_cl instanceof types.Delimiter && op.prev_cl instanceof types.Delimiter) {
            _this.parent.callEvent('addProperty', property_name);
          }
          return _this.deleteListener('addProperty', addPropertyListener);
        };
      })(this);
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
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
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
      if (!((prev != null) && (next != null) && (content != null))) {
        throw new Error("You must define content, prev, and next for Replaceable-types!");
      }
      Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
    }

    Replaceable.prototype.val = function() {
      return this.content;
    };

    Replaceable.prototype.replace = function(content) {
      return this.parent.replace(content);
    };

    Replaceable.prototype.execute = function() {
      var _base;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (typeof (_base = this.content).setReplaceManager === "function") {
          _base.setReplaceManager(this.parent);
        }
        return Replaceable.__super__.execute.apply(this, arguments);
      }
    };

    Replaceable.prototype._encode = function() {
      var json;
      json = {
        'type': "Replaceable",
        'content': this.content.getUid(),
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

    TextInsert.prototype.getLength = function() {
      if (this.isDeleted()) {
        return 0;
      } else {
        return this.content.length;
      }
    };

    TextInsert.prototype.val = function(current_position) {
      if (this.isDeleted()) {
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
      if ((this.origin != null) && this.origin !== this.prev_cl) {
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

    WordType.prototype.insertText = function(position, content) {
      var c, o, op, _i, _len;
      o = this.getOperationByPosition(position);
      for (_i = 0, _len = content.length; _i < _len; _i++) {
        c = content[_i];
        op = new TextInsert(c, void 0, o.prev_cl, o);
        HB.addOperation(op).execute();
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
      return this.on(['insert', 'delete'], (function(_this) {
        return function() {
          var _ref;
          return (_ref = _this.replace_manager) != null ? _ref.callEvent('change') : void 0;
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
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0ZyYW1ld29ya3MvSnNvbkZyYW1ld29yay5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0hpc3RvcnlCdWZmZXIuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvSnNvblR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvU3RydWN0dXJlZFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0tBLElBQUEsTUFBQTs7QUFBQTtBQU1lLEVBQUEsZ0JBQUUsRUFBRixFQUFPLE1BQVAsR0FBQTtBQUNYLElBRFksSUFBQyxDQUFBLEtBQUEsRUFDYixDQUFBO0FBQUEsSUFEaUIsSUFBQyxDQUFBLFNBQUEsTUFDbEIsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGVBQUQsR0FBbUIsRUFBbkIsQ0FEVztFQUFBLENBQWI7O0FBQUEsbUJBTUEsY0FBQSxHQUFnQixTQUFDLElBQUQsR0FBQTtBQUNkLFFBQUEsVUFBQTtBQUFBLElBQUEsVUFBQSxHQUFhLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBSSxDQUFDLElBQUwsQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBRyxrQkFBSDth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TSxDQUFBLFlBQUEsQ0FBTixHQUFzQixVQTNUdEIsQ0FBQTtBQUFBLEVBNFRBLEtBQU0sQ0FBQSxVQUFBLENBQU4sR0FBb0IsUUE1VHBCLENBQUE7U0E2VEEsaUJBOVRlO0FBQUEsQ0FGakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcclxuI1xyXG4jIEBub2RvY1xyXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXHJcbiNcclxuY2xhc3MgRW5naW5lXHJcblxyXG4gICNcclxuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcclxuICAjIEBwYXJhbSB7QXJyYXl9IHBhcnNlciBEZWZpbmVzIGhvdyB0byBwYXJzZSBlbmNvZGVkIG1lc3NhZ2VzLlxyXG4gICNcclxuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHBhcnNlciktPlxyXG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXHJcblxyXG4gICNcclxuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxyXG4gICNcclxuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cclxuICAgIHR5cGVQYXJzZXIgPSBAcGFyc2VyW2pzb24udHlwZV1cclxuICAgIGlmIHR5cGVQYXJzZXI/XHJcbiAgICAgIHR5cGVQYXJzZXIganNvblxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXHJcbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcclxuICAjXHJcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxyXG4gICAgb3BzID0gW11cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcclxuICAjXHJcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cclxuICAjXHJcbiAgYXBwbHlPcDogKG9wX2pzb24pLT5cclxuICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxyXG4gICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICBASEIuYWRkVG9Db3VudGVyIG9cclxuICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIGVsc2VcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL0pzb25UeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBKc29uIGRhdGEtc3RydWN0dXJlcy5cbiMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiMgKiBTdHJpbmdcbiMgKiBJbnRlZ2VyXG4jICogQXJyYXlcbiNcbmNsYXNzIEpzb25GcmFtZXdvcmtcblxuICAjXG4gICMgQHBhcmFtIHtTdHJpbmd9IHVzZXJfaWQgVW5pcXVlIGlkIG9mIHRoZSBwZWVyLlxuICAjIEBwYXJhbSB7Q29ubmVjdG9yfSBDb25uZWN0b3IgdGhlIGNvbm5lY3RvciBjbGFzcy5cbiAgI1xuICBjb25zdHJ1Y3RvcjogKHVzZXJfaWQsIENvbm5lY3RvciktPlxuICAgIEBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgICB0eXBlX21hbmFnZXIgPSBqc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQHR5cGVzID0gdHlwZV9tYW5hZ2VyLnR5cGVzXG4gICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0eXBlX21hbmFnZXIucGFyc2VyXG4gICAgQGNvbm5lY3RvciA9IG5ldyBDb25uZWN0b3IgQGVuZ2luZSwgQEhCLCB0eXBlX21hbmFnZXIuZXhlY3V0aW9uX2xpc3RlbmVyLCBAXG4gICAgZmlyc3Rfd29yZCA9IG5ldyBAdHlwZXMuSnNvblR5cGUgQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpXG4gICAgQEhCLmFkZE9wZXJhdGlvbihmaXJzdF93b3JkKS5leGVjdXRlKClcbiAgICBAcm9vdF9lbGVtZW50ID0gZmlyc3Rfd29yZFxuXG4gICNcbiAgIyBAcmV0dXJuIEpzb25UeXBlXG4gICNcbiAgZ2V0U2hhcmVkT2JqZWN0OiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudFxuXG4gICNcbiAgIyBHZXQgdGhlIGluaXRpYWxpemVkIGNvbm5lY3Rvci5cbiAgI1xuICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICBAY29ubmVjdG9yXG5cbiAgI1xuICAjIEBzZWUgSGlzdG9yeUJ1ZmZlclxuICAjXG4gIGdldEhpc3RvcnlCdWZmZXI6ICgpLT5cbiAgICBASEJcblxuICAjXG4gICMgQHNlZSBKc29uVHlwZS5zZXRNdXRhYmxlRGVmYXVsdFxuICAjXG4gIHNldE11dGFibGVEZWZhdWx0OiAobXV0YWJsZSktPlxuICAgIEByb290X2VsZW1lbnQuc2V0TXV0YWJsZURlZmF1bHQobXV0YWJsZSlcblxuICAjXG4gICMgR2V0IHRoZSBVc2VySWQgZnJvbSB0aGUgSGlzdG9yeUJ1ZmZlciBvYmplY3QuXG4gICMgSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXMgdGhlIHVzZXJfaWQgdmFsdWUgd2l0aCB3aGljaFxuICAjIEpzb25GcmFtZXdvcmsgd2FzIGluaXRpYWxpemVkIChEZXBlbmRpbmcgb24gdGhlIEhpc3RvcnlCdWZmZXIgaW1wbGVtZW50YXRpb24pLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEBIQi5nZXRVc2VySWQoKVxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnRvSnNvblxuICAjXG4gIHRvSnNvbiA6ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50LnRvSnNvbigpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsXG4gICNcbiAgdmFsIDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICBAcm9vdF9lbGVtZW50LnZhbChuYW1lLCBjb250ZW50LCBtdXRhYmxlKVxuXG4gICNcbiAgIyBAc2VlIE9wZXJhdGlvbi5vblxuICAjXG4gIG9uOiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudC5vbiBhcmd1bWVudHMuLi5cblxuICAjXG4gICMgQHNlZSBPcGVyYXRpb24uZGVsZXRlTGlzdGVuZXJcbiAgI1xuICBkZWxldGVMaXN0ZW5lcjogKCktPlxuICAgIEByb290X2VsZW1lbnQuZGVsZXRlTGlzdGVuZXIgYXJndW1lbnRzLi4uXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsdWVcbiAgI1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvbkZyYW1ld29yay5wcm90b3R5cGUsICd2YWx1ZScsXG4gICAgZ2V0IDogLT4gQHJvb3RfZWxlbWVudC52YWx1ZVxuICAgIHNldCA6IChvKS0+XG4gICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgIEB2YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG9ubHkgc2V0IE9iamVjdCB2YWx1ZXMhXCJcblxubW9kdWxlLmV4cG9ydHMgPSBKc29uRnJhbWV3b3JrXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLkpzb25GcmFtZXdvcmsgPSBKc29uRnJhbWV3b3JrXG4iLCJcbiNcbiMgQG5vZG9jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgI1xuICAjIFRoZXJlIGlzIG9ubHkgb25lIHJlc2VydmVkIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpLCBzbyB1c2UgaXQgd2lzZWx5LlxuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogJ18nXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAoKS0+XG4gICAgcmVzID0ge31cbiAgICBmb3IgdXNlcixjdG4gb2YgQG9wZXJhdGlvbl9jb3VudGVyXG4gICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICByZXNcblxuICAjXG4gICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgIyBUT0RPOiBNYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cbiAgICBqc29uID0gW11cbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZGFoIVwiXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcblxuICAgIGZvciB1X25hbWUsdXNlciBvZiBAYnVmZmVyXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3QgaXNOYU4ocGFyc2VJbnQob19udW1iZXIpKSkgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICAjIGl0cyBuZWNlc3NhcnkgdG8gc2VuZCBpdCwgYW5kIG5vdCBrbm93biBpbiBzdGF0ZV92ZWN0b3JcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD9cbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LmNyZWF0b3IsIG9fbmV4dC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fbmV4dCA9IG9fbmV4dC5uZXh0X2NsXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsP1xuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX3ByZXYuY3JlYXRvciwgb19wcmV2Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQgaW5zdGFuY2VvZiBPYmplY3RcbiAgICAgIEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxuICAgIGVsc2UgaWYgbm90IHVpZD9cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgb2YgdWlkIGlzIG5vdCBkZWZpbmVkIVwiXG4gICNcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XG4gICMgb3RoZXIgb3BlcmF0aW9ucyAoaXQgd29udCBleGVjdXRlZClcbiAgI1xuICBhZGRPcGVyYXRpb246IChvKS0+XG4gICAgaWYgbm90IEBidWZmZXJbby5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIEBidWZmZXJbby5jcmVhdG9yXVtvLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSA9IDBcbiAgICBpZiB0eXBlb2Ygby5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8uY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxuICAgICAgIyBUT0RPOiBmaXggdGhpcyBpc3N1ZSBiZXR0ZXIuXG4gICAgICAjIE9wZXJhdGlvbnMgc2hvdWxkIGluY29tZSBpbiBvcmRlclxuICAgICAgIyBUaGVuIHlvdSBkb24ndCBoYXZlIHRvIGRvIHRoaXMuLlxuICAgICAgaWYgby5vcF9udW1iZXIgaXMgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl1cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0rK1xuICAgICAgICB3aGlsZSBAZ2V0T3BlcmF0aW9uKHtjcmVhdG9yOm8uY3JlYXRvciwgb3BfbnVtYmVyOiBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXX0pP1xuICAgICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdKytcblxuICAgICNpZiBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSBpc250IChvLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIC0gKG8ub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgcGFyc2VyID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wZXJhdGlvbnMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyAqIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgaWYgbm90IHVpZD9cbiAgICAgICAgdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAge1xuICAgICAgICAnY3JlYXRvcic6IEBjcmVhdG9yXG4gICAgICAgICdvcF9udW1iZXInIDogQG9wX251bWJlclxuICAgICAgfSA9IHVpZFxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gZXZlbnQgTmFtZSBvZiB0aGUgZXZlbnQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9uOiAoZXZlbnRzLCBmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID89IHt9XG4gICAgICBpZiBldmVudHMuY29uc3RydWN0b3IgaXNudCBbXS5jb25zdHJ1Y3RvclxuICAgICAgICBldmVudHMgPSBbZXZlbnRzXVxuICAgICAgZm9yIGUgaW4gZXZlbnRzXG4gICAgICAgIEBldmVudF9saXN0ZW5lcnNbZV0gPz0gW11cbiAgICAgICAgQGV2ZW50X2xpc3RlbmVyc1tlXS5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBmdW5jdGlvbiBmcm9tIGFuIGV2ZW50IC8gbGlzdCBvZiBldmVudHMuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5vblxuICAgICNcbiAgICAjIEBvdmVybG9hZCBkZWxldGVMaXN0ZW5lcihldmVudCwgZilcbiAgICAjICAgQHBhcmFtIGV2ZW50IHtTdHJpbmd9IEFuIGV2ZW50IG5hbWVcbiAgICAjICAgQHBhcmFtIGYgICAgIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRoYXQgeW91IHdhbnQgdG8gZGVsZXRlIGZyb20gdGhlc2UgZXZlbnRzXG4gICAgIyBAb3ZlcmxvYWQgZGVsZXRlTGlzdGVuZXIoZXZlbnRzLCBmKVxuICAgICMgICBAcGFyYW0gZXZlbnRzIHtBcnJheTxTdHJpbmc+fSBBIGxpc3Qgb2YgZXZlbnQgbmFtZXNcbiAgICAjICAgQHBhcmFtIGYgICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBmcm9tIHRoZXNlIGV2ZW50cy5cbiAgICBkZWxldGVMaXN0ZW5lcjogKGV2ZW50cywgZiktPlxuICAgICAgaWYgZXZlbnRzLmNvbnN0cnVjdG9yIGlzbnQgW10uY29uc3RydWN0b3JcbiAgICAgICAgZXZlbnRzID0gW2V2ZW50c11cbiAgICAgIGZvciBlIGluIGV2ZW50c1xuICAgICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tlXT9cbiAgICAgICAgICBAZXZlbnRfbGlzdGVuZXJzW2VdID0gQGV2ZW50X2xpc3RlbmVyc1tlXS5maWx0ZXIgKGcpLT5cbiAgICAgICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgI1xuICAgIGNhbGxFdmVudDogKCktPlxuICAgICAgQGZvcndhcmRFdmVudCBALCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQgYW5kIHNwZWNpZnkgaW4gd2hpY2ggY29udGV4dCB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkIChzZXQgJ3RoaXMnKS5cbiAgICAjXG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGV2ZW50LCBhcmdzLi4uKS0+XG4gICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tldmVudF0/XG4gICAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdXG4gICAgICAgICAgZi5jYWxsIG9wLCBldmVudCwgYXJncy4uLlxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIHsgJ2NyZWF0b3InOiBAY3JlYXRvciwgJ29wX251bWJlcic6IEBvcF9udW1iZXIgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gSW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBwYXJzZXJbJ0RlbGV0ZSddID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IERlbGV0ZSB1aWQsIGRlbGV0ZXNfdWlkXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIEluc2VydCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgaWYgQHBhcmVudD8gYW5kIEBkZWxldGVkX2J5Lmxlbmd0aCBpcyAxXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImRlbGV0ZVwiLCBAXG5cbiAgICAjXG4gICAgIyBJZiBpc0RlbGV0ZWQoKSBpcyB0cnVlIHRoaXMgb3BlcmF0aW9uIHdvbid0IGJlIG1haW50YWluZWQgaW4gdGhlIHNsXG4gICAgI1xuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGRlbGV0ZWRfYnk/Lmxlbmd0aCA+IDBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICAjVE9ETzogZGVsZXRlIHRoaXNcbiAgICAgICAgaWYgQCBpcyBAcHJldl9jbFxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gOykgXCJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFVwZGF0ZSB0aGUgc2hvcnQgbGlzdFxuICAgICMgVE9ETyAoVW51c2VkKVxuICAgIHVwZGF0ZV9zbDogKCktPlxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB1cGRhdGU6IChkZXN0X2NsLGRlc3Rfc2wpLT5cbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgIGlmIG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIG8gPSBvW2Rlc3RfY2xdXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgQFtkZXN0X3NsXSA9IG9cblxuICAgICAgICAgICAgYnJlYWtcbiAgICAgIHVwZGF0ZSBcInByZXZfY2xcIiwgXCJwcmV2X3NsXCJcbiAgICAgIHVwZGF0ZSBcIm5leHRfY2xcIiwgXCJwcmV2X3NsXCJcblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEBpc19leGVjdXRlZD9cbiAgICAgICAgcmV0dXJuIEBcbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHByZXZfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBuZXh0X2NsPy52YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpIGFuZCBAcHJldl9jbC5uZXh0X2NsIGlzbnQgQFxuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSAwXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2UgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG5vdCBvP1xuICAgICAgICAgICAgICAjIFRPRE86IERlYnVnZ2luZ1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8uY3JlYXRvciA8IEBjcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG4gICAgICAgIHBhcmVudCA9IEBwcmV2X2NsPy5nZXRQYXJlbnQoKVxuICAgICAgICBpZiBwYXJlbnQ/XG4gICAgICAgICAgQHNldFBhcmVudCBwYXJlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImluc2VydFwiLCBAXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBEZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBwcmV2LmlzRGVsZXRlZD8gYW5kIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBEZWZpbmVzIGFuIG9iamVjdCB0aGF0IGlzIGNhbm5vdCBiZSBjaGFuZ2VkLiBZb3UgY2FuIHVzZSB0aGlzIHRvIHNldCBhbiBpbW11dGFibGUgc3RyaW5nLCBvciBhIG51bWJlci5cbiAgI1xuICBjbGFzcyBJbW11dGFibGVPYmplY3QgZXh0ZW5kcyBJbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBjb250ZW50XG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBAY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgQHJldHVybiBbU3RyaW5nXSBUaGUgY29udGVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgdmFsIDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogXCJJbW11dGFibGVPYmplY3RcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnY29udGVudCcgOiBAY29udGVudFxuICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBpZiBAbmV4dF9jbD9cbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ0ltbXV0YWJsZU9iamVjdCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSW1tdXRhYmxlT2JqZWN0IHVpZCwgY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3MgRGVsaW1pdGVyIGV4dGVuZHMgT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgaXNEZWxldGVkKCkgaXMgdHJ1ZSB0aGlzIG9wZXJhdGlvbiB3b24ndCBiZSBtYWludGFpbmVkIGluIHRoZSBzbFxuICAgICNcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnRGVsaW1pdGVyJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgRGVsaW1pdGVyIHVpZCwgcHJldiwgbmV4dFxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICd0eXBlcycgOlxuICAgICAgJ0RlbGV0ZScgOiBEZWxldGVcbiAgICAgICdJbnNlcnQnIDogSW5zZXJ0XG4gICAgICAnRGVsaW1pdGVyJzogRGVsaW1pdGVyXG4gICAgICAnT3BlcmF0aW9uJzogT3BlcmF0aW9uXG4gICAgICAnSW1tdXRhYmxlT2JqZWN0JyA6IEltbXV0YWJsZU9iamVjdFxuICAgICdwYXJzZXInIDogcGFyc2VyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJ0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0VHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICB0ZXh0X3R5cGVzID0gdGV4dF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSB0ZXh0X3R5cGVzLnBhcnNlclxuXG4gIGNyZWF0ZUpzb25UeXBlV3JhcHBlciA9IChfanNvblR5cGUpLT5cblxuICAgICNcbiAgICAjIEBub3RlIEVYUEVSSU1FTlRBTFxuICAgICNcbiAgICAjIEEgSnNvblR5cGVXcmFwcGVyIHdhcyBpbnRlbmRlZCB0byBiZSBhIGNvbnZlbmllbnQgd3JhcHBlciBmb3IgdGhlIEpzb25UeXBlLlxuICAgICMgQnV0IGl0IGNhbiBtYWtlIHRoaW5ncyBtb3JlIGRpZmZpY3VsdCB0aGFuIHRoZXkgYXJlLlxuICAgICMgQHNlZSBKc29uVHlwZVxuICAgICNcbiAgICAjIEBleGFtcGxlIGNyZWF0ZSBhIEpzb25UeXBlV3JhcHBlclxuICAgICMgICAjIFlvdSBnZXQgYSBKc29uVHlwZVdyYXBwZXIgZnJvbSBhIEpzb25UeXBlIGJ5IGNhbGxpbmdcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgI1xuICAgICMgSXQgY3JlYXRlcyBKYXZhc2NyaXB0cyAtZ2V0dGVyIGFuZCAtc2V0dGVyIG1ldGhvZHMgZm9yIGVhY2ggcHJvcGVydHkgdGhhdCBKc29uVHlwZSBtYWludGFpbnMuXG4gICAgIyBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9kZWZpbmVQcm9wZXJ0eVxuICAgICNcbiAgICAjIEBleGFtcGxlIEdldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBhY2Nlc3MgdGhlIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnhcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcpXG4gICAgI1xuICAgICMgQG5vdGUgWW91IGNhbiBvbmx5IG92ZXJ3cml0ZSBleGlzdGluZyB2YWx1ZXMhIFNldHRpbmcgYSBuZXcgcHJvcGVydHkgd29uJ3QgaGF2ZSBhbnkgZWZmZWN0IVxuICAgICNcbiAgICAjIEBleGFtcGxlIFNldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBzZXQgYW4gZXhpc3RpbmcgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueCA9IFwidGV4dFwiXG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnLCBcInRleHRcIilcbiAgICAjXG4gICAgIyBJbiBvcmRlciB0byBzZXQgYSBuZXcgcHJvcGVydHkgeW91IGhhdmUgdG8gb3ZlcndyaXRlIGFuIGV4aXN0aW5nIHByb3BlcnR5LlxuICAgICMgVGhlcmVmb3JlIHRoZSBKc29uVHlwZVdyYXBwZXIgc3VwcG9ydHMgYSBzcGVjaWFsIGZlYXR1cmUgdGhhdCBzaG91bGQgbWFrZSB0aGluZ3MgbW9yZSBjb252ZW5pZW50XG4gICAgIyAod2UgY2FuIGFyZ3VlIGFib3V0IHRoYXQsIHVzZSB0aGUgSnNvblR5cGUgaWYgeW91IGRvbid0IGxpa2UgaXQgOykuXG4gICAgIyBJZiB5b3Ugb3ZlcndyaXRlIGFuIG9iamVjdCBwcm9wZXJ0eSBvZiB0aGUgSnNvblR5cGVXcmFwcGVyIHdpdGggYSBuZXcgb2JqZWN0LCBpdCB3aWxsIHJlc3VsdCBpbiBhIG1lcmdlZCB2ZXJzaW9uIG9mIHRoZSBvYmplY3RzLlxuICAgICMgTGV0IGB5YXR0YS52YWx1ZS5wYCB0aGUgcHJvcGVydHkgdGhhdCBpcyB0byBiZSBvdmVyd3JpdHRlbiBhbmQgbyB0aGUgbmV3IHZhbHVlLiBFLmcuIGB5YXR0YS52YWx1ZS5wID0gb2BcbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygb1xuICAgICMgKiBUaGUgcmVzdWx0IGhhcyBhbGwgcHJvcGVydGllcyBvZiB3LnAgaWYgdGhleSBkb24ndCBvY2N1ciB1bmRlciB0aGUgc2FtZSBwcm9wZXJ0eS1uYW1lIGluIG8uXG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29uZmxpY3QgRXhhbXBsZVxuICAgICMgICB5YXR0YS52YWx1ZSA9IHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiBcInN0cmluZ1wifVxuICAgICMgICB3LmEgPSB7YSA6IHtiIDogXCJzdHJpbmdcIn19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCJ9fVxuICAgICMgICB3LmEgPSB7YSA6IHtjIDogNH19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCIsIGMgOiA0fX1cbiAgICAjXG4gICAgIyBAZXhhbXBsZSBDb21tb24gUGl0ZmFsbHNcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgICMgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eVxuICAgICMgICB3Lm5ld1Byb3BlcnR5ID0gXCJBd2Vzb21lXCJcbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgdy5uZXdQcm9wZXJ0eSBpcyB1bmRlZmluZWRcbiAgICAjICAgIyBvdmVyd3JpdGUgdGhlIHcgb2JqZWN0XG4gICAgIyAgIHcgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlISwgYnV0IC4uXG4gICAgIyAgIGNvbnNvbGUubG9nKHlhdHRhLnZhbHVlLm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIGZhbHNlLCB5b3UgYXJlIG9ubHkgYWxsb3dlZCB0byBzZXQgcHJvcGVydGllcyFcbiAgICAjICAgIyBUaGUgc29sdXRpb25cbiAgICAjICAgeWF0dGEudmFsdWUgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlIVxuICAgICNcbiAgICBjbGFzcyBKc29uVHlwZVdyYXBwZXJcblxuICAgICAgI1xuICAgICAgIyBAcGFyYW0ge0pzb25UeXBlfSBqc29uVHlwZSBJbnN0YW5jZSBvZiB0aGUgSnNvblR5cGUgdGhhdCB0aGlzIGNsYXNzIHdyYXBwZXMuXG4gICAgICAjXG4gICAgICBjb25zdHJ1Y3RvcjogKGpzb25UeXBlKS0+XG4gICAgICAgIGZvciBuYW1lLCBvYmogb2YganNvblR5cGUubWFwXG4gICAgICAgICAgZG8gKG5hbWUsIG9iaiktPlxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25UeXBlV3JhcHBlci5wcm90b3R5cGUsIG5hbWUsXG4gICAgICAgICAgICAgIGdldCA6IC0+XG4gICAgICAgICAgICAgICAgeCA9IG9iai52YWwoKVxuICAgICAgICAgICAgICAgIGlmIHggaW5zdGFuY2VvZiBKc29uVHlwZVxuICAgICAgICAgICAgICAgICAgY3JlYXRlSnNvblR5cGVXcmFwcGVyIHhcbiAgICAgICAgICAgICAgICBlbHNlIGlmIHggaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICAgICAgICAgIHgudmFsKClcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICB4XG4gICAgICAgICAgICAgIHNldCA6IChvKS0+XG4gICAgICAgICAgICAgICAgb3ZlcndyaXRlID0ganNvblR5cGUudmFsKG5hbWUpXG4gICAgICAgICAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvciBhbmQgb3ZlcndyaXRlIGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlLnZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBqc29uVHlwZS52YWwobmFtZSwgbywgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZVxuICAgIG5ldyBKc29uVHlwZVdyYXBwZXIgX2pzb25UeXBlXG5cbiAgI1xuICAjIE1hbmFnZXMgT2JqZWN0LWxpa2UgdmFsdWVzLlxuICAjXG4gIGNsYXNzIEpzb25UeXBlIGV4dGVuZHMgdHlwZXMuTWFwTWFuYWdlclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGluaXRpYWxfdmFsdWUgQ3JlYXRlIHRoaXMgb3BlcmF0aW9uIHdpdGggYW4gaW5pdGlhbCB2YWx1ZS5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IFdoZXRoZXIgdGhlIGluaXRpYWxfdmFsdWUgc2hvdWxkIGJlIGNyZWF0ZWQgYXMgbXV0YWJsZS4gKE9wdGlvbmFsIC0gc2VlIHNldE11dGFibGVEZWZhdWx0KVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgaW5pdGlhbF92YWx1ZSwgbXV0YWJsZSktPlxuICAgICAgc3VwZXIgdWlkXG4gICAgICBpZiBpbml0aWFsX3ZhbHVlP1xuICAgICAgICBpZiB0eXBlb2YgaW5pdGlhbF92YWx1ZSBpc250IFwib2JqZWN0XCJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgaW5pdGlhbCB2YWx1ZSBvZiBKc29uVHlwZXMgbXVzdCBiZSBvZiB0eXBlIE9iamVjdCEgKGN1cnJlbnQgdHlwZTogI3t0eXBlb2YgaW5pdGlhbF92YWx1ZX0pXCJcbiAgICAgICAgZm9yIG5hbWUsbyBvZiBpbml0aWFsX3ZhbHVlXG4gICAgICAgICAgQHZhbCBuYW1lLCBvLCBtdXRhYmxlXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEganNvbi10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geWF0dGEudmFsKCd1bmtub3duJylcbiAgICAjICAgaWYgKHgudHlwZSA9PT0gXCJKc29uVHlwZVwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIkpzb25UeXBlXCJcblxuICAgICNcbiAgICAjIFRyYW5zZm9ybSB0aGlzIHRvIGEgSnNvbiBhbmQgbG9vc2UgYWxsIHRoZSBzaGFyaW5nLWFiaWxpdGllcyAodGhlIG5ldyBvYmplY3Qgd2lsbCBiZSBhIGRlZXAgY2xvbmUpIVxuICAgICMgQHJldHVybiB7SnNvbn1cbiAgICAjXG4gICAgdG9Kc29uOiAoKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGpzb24gPSB7fVxuICAgICAgZm9yIG5hbWUsIG8gb2YgdmFsXG4gICAgICAgIGlmIG8gaXMgbnVsbFxuICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICAgIGVsc2UgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgIGpzb25bbmFtZV0gPSBAdmFsKG5hbWUpLnRvSnNvbigpXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIHdoaWxlIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgIG8gPSBvLnZhbCgpXG4gICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICBqc29uXG5cbiAgICAjXG4gICAgIyBAc2VlIFdvcmRUeXBlLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgIyBTZXRzIHRoZSBwYXJlbnQgb2YgdGhpcyBKc29uVHlwZSBvYmplY3QuXG4gICAgI1xuICAgIHNldFJlcGxhY2VNYW5hZ2VyOiAocm0pLT5cbiAgICAgIEBwYXJlbnQgPSBybS5wYXJlbnRcbiAgICAgIEBvbiBbJ2NoYW5nZScsJ2FkZFByb3BlcnR5J10sICgpLT5cbiAgICAgICAgcm0ucGFyZW50LmZvcndhcmRFdmVudCB0aGlzLCBhcmd1bWVudHMuLi5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIEpzb25UeXBlLlxuICAgICMgQHJldHVybiB7SnNvblR5cGV9XG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgV2hldGhlciB0aGUgZGVmYXVsdCBpcyAnbXV0YWJsZScgKHRydWUpIG9yICdpbW11dGFibGUnIChmYWxzZSlcbiAgICAjXG4gICAgbXV0YWJsZV9kZWZhdWx0OlxuICAgICAgdHJ1ZVxuXG4gICAgI1xuICAgICMgU2V0IGlmIHRoZSBkZWZhdWx0IGlzICdtdXRhYmxlJyBvciAnaW1tdXRhYmxlJ1xuICAgICMgQHBhcmFtIHtTdHJpbmd8Qm9vbGVhbn0gbXV0YWJsZSBTZXQgZWl0aGVyICdtdXRhYmxlJyAvIHRydWUgb3IgJ2ltbXV0YWJsZScgLyBmYWxzZVxuICAgIHNldE11dGFibGVEZWZhdWx0OiAobXV0YWJsZSktPlxuICAgICAgaWYgbXV0YWJsZSBpcyB0cnVlIG9yIG11dGFibGUgaXMgJ211dGFibGUnXG4gICAgICAgIEpzb25UeXBlLnByb3RvdHlwZS5tdXRhYmxlX2RlZmF1bHQgPSB0cnVlXG4gICAgICBlbHNlIGlmIG11dGFibGUgaXMgZmFsc2Ugb3IgbXV0YWJsZSBpcyAnaW1tdXRhYmxlJ1xuICAgICAgICBKc29uVHlwZS5wcm90b3R5cGUubXV0YWJsZV9kZWZhdWx0ID0gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yICdTZXQgbXV0YWJsZSBlaXRoZXIgXCJtdXRhYmxlXCIgb3IgXCJpbW11dGFibGVcIiEnXG4gICAgICAnT0snXG5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgICAjICAgQHJldHVybiBbSnNvbl1cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW0pzb25UeXBlfFdvcmRUeXBlfFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCwgbXV0YWJsZSktPlxuICAgICAgaWYgdHlwZW9mIG5hbWUgaXMgJ29iamVjdCdcbiAgICAgICAgIyBTcGVjaWFsIGNhc2UuIEZpcnN0IGFyZ3VtZW50IGlzIGFuIG9iamVjdC4gVGhlbiB0aGUgc2Vjb25kIGFyZyBpcyBtdXRhYmxlLlxuICAgICAgICAjIEtlZXAgdGhhdCBpbiBtaW5kIHdoZW4gcmVhZGluZyB0aGUgZm9sbG93aW5nLi5cbiAgICAgICAgZm9yIG9fbmFtZSxvIG9mIG5hbWVcbiAgICAgICAgICBAdmFsKG9fbmFtZSxvLGNvbnRlbnQpXG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT8gYW5kIChjb250ZW50PyBvciBjb250ZW50IGlzIG51bGwpXG4gICAgICAgIGlmIG11dGFibGU/XG4gICAgICAgICAgaWYgbXV0YWJsZSBpcyB0cnVlIG9yIG11dGFibGUgaXMgJ211dGFibGUnXG4gICAgICAgICAgICBtdXRhYmxlID0gdHJ1ZVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIG11dGFibGUgPSBmYWxzZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgbXV0YWJsZSA9IEBtdXRhYmxlX2RlZmF1bHRcbiAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ2Z1bmN0aW9uJ1xuICAgICAgICAgIEAgIyBKdXN0IGRvIG5vdGhpbmdcbiAgICAgICAgZWxzZSBpZiBjb250ZW50IGlzIG51bGwgb3IgKCgobm90IG11dGFibGUpIG9yIHR5cGVvZiBjb250ZW50IGlzICdudW1iZXInKSBhbmQgY29udGVudC5jb25zdHJ1Y3RvciBpc250IE9iamVjdClcbiAgICAgICAgICBvYmogPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkltbXV0YWJsZU9iamVjdCB1bmRlZmluZWQsIGNvbnRlbnQpLmV4ZWN1dGUoKVxuICAgICAgICAgIHN1cGVyIG5hbWUsIG9ialxuICAgICAgICBlbHNlXG4gICAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ3N0cmluZydcbiAgICAgICAgICAgIHdvcmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLldvcmRUeXBlIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgICB3b3JkLmluc2VydFRleHQgMCwgY29udGVudFxuICAgICAgICAgICAgc3VwZXIgbmFtZSwgd29yZFxuICAgICAgICAgIGVsc2UgaWYgY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICAgIGpzb24gPSBIQi5hZGRPcGVyYXRpb24obmV3IEpzb25UeXBlIHVuZGVmaW5lZCwgY29udGVudCwgbXV0YWJsZSkuZXhlY3V0ZSgpXG4gICAgICAgICAgICBzdXBlciBuYW1lLCBqc29uXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCAje3R5cGVvZiBjb250ZW50fS10eXBlcyBpbiBjb2xsYWJvcmF0aXZlIEpzb24tb2JqZWN0cyFcIlxuICAgICAgZWxzZVxuICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvblR5cGUucHJvdG90eXBlLCAndmFsdWUnLFxuICAgICAgZ2V0IDogLT4gY3JlYXRlSnNvblR5cGVXcmFwcGVyIEBcbiAgICAgIHNldCA6IChvKS0+XG4gICAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICAgIEB2YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBvbmx5IHNldCBPYmplY3QgdmFsdWVzIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiSnNvblR5cGVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnSnNvblR5cGUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICB9ID0ganNvblxuICAgIG5ldyBKc29uVHlwZSB1aWRcblxuXG5cblxuICB0eXBlc1snSnNvblR5cGUnXSA9IEpzb25UeXBlXG5cbiAgdGV4dF90eXBlc1xuXG5cbiIsImJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1R5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgYmFzaWNfdHlwZXMgPSBiYXNpY190eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gYmFzaWNfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gYmFzaWNfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgbWFwIGxpa2Ugb2JqZWN0cy4gRS5nLiBKc29uLVR5cGUgYW5kIFhNTCBhdHRyaWJ1dGVzLlxuICAjXG4gIGNsYXNzIE1hcE1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBtYXAgPSB7fVxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25UeXBlcy52YWxcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgaWYgbm90IEBtYXBbbmFtZV0/XG4gICAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG5ldyBBZGROYW1lIHVuZGVmaW5lZCwgQCwgbmFtZSkuZXhlY3V0ZSgpXG4gICAgICAgIEBtYXBbbmFtZV0ucmVwbGFjZSBjb250ZW50XG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgb2JqID0gQG1hcFtuYW1lXT8udmFsKClcbiAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgb2JqLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvYmpcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAbWFwXG4gICAgICAgICAgb2JqID0gby52YWwoKVxuICAgICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdCBvciBvYmogaW5zdGFuY2VvZiBNYXBNYW5hZ2VyXG4gICAgICAgICAgICBvYmogPSBvYmoudmFsKClcbiAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvYmpcbiAgICAgICAgcmVzdWx0XG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFdoZW4gYSBuZXcgcHJvcGVydHkgaW4gYSBtYXAgbWFuYWdlciBpcyBjcmVhdGVkLCB0aGVuIHRoZSB1aWRzIG9mIHRoZSBpbnNlcnRlZCBPcGVyYXRpb25zXG4gICMgbXVzdCBiZSB1bmlxdWUgKHRoaW5rIGFib3V0IGNvbmN1cnJlbnQgb3BlcmF0aW9ucykuIFRoZXJlZm9yZSBvbmx5IGFuIEFkZE5hbWUgb3BlcmF0aW9uIGlzIGFsbG93ZWQgdG9cbiAgIyBhZGQgYSBwcm9wZXJ0eSBpbiBhIE1hcE1hbmFnZXIuIElmIHR3byBBZGROYW1lIG9wZXJhdGlvbnMgb24gdGhlIHNhbWUgTWFwTWFuYWdlciBuYW1lIGhhcHBlbiBjb25jdXJyZW50bHlcbiAgIyBvbmx5IG9uZSB3aWxsIEFkZE5hbWUgb3BlcmF0aW9uIHdpbGwgYmUgZXhlY3V0ZWQuXG4gICNcbiAgY2xhc3MgQWRkTmFtZSBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IG1hcF9tYW5hZ2VyIFVpZCBvciByZWZlcmVuY2UgdG8gdGhlIE1hcE1hbmFnZXIuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IHdpbGwgYmUgYWRkZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBtYXBfbWFuYWdlciwgQG5hbWUpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdtYXBfbWFuYWdlcicsIG1hcF9tYW5hZ2VyXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElmIG1hcF9tYW5hZ2VyIGRvZXNuJ3QgaGF2ZSB0aGUgcHJvcGVydHkgbmFtZSwgdGhlbiBhZGQgaXQuXG4gICAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgdGhhdCBpcyBiZWluZyB3cml0dGVuIG9uIHRoZSBwcm9wZXJ0eSBpcyB1bmlxdWVcbiAgICAjIGluIHN1Y2ggYSB3YXkgdGhhdCBpZiBBZGROYW1lIGlzIGV4ZWN1dGVkIChmcm9tIGFub3RoZXIgcGVlcikgaXQgd2lsbFxuICAgICMgYWx3YXlzIGhhdmUgdGhlIHNhbWUgcmVzdWx0IChSZXBsYWNlTWFuYWdlciwgYW5kIGl0cyBiZWdpbm5pbmcgYW5kIGVuZCBhcmUgdGhlIHNhbWUpXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgdWlkX3IgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgdWlkX3Iub3BfbnVtYmVyID0gXCJfI3t1aWRfci5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9XCJcbiAgICAgICAgaWYgbm90IEhCLmdldE9wZXJhdGlvbih1aWRfcik/XG4gICAgICAgICAgdWlkX2JlZyA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICAgIHVpZF9iZWcub3BfbnVtYmVyID0gXCJfI3t1aWRfYmVnLm9wX251bWJlcn1fUk1fI3tAbmFtZX1fYmVnaW5uaW5nXCJcbiAgICAgICAgICB1aWRfZW5kID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2VuZC5vcF9udW1iZXIgPSBcIl8je3VpZF9lbmQub3BfbnVtYmVyfV9STV8je0BuYW1lfV9lbmRcIlxuICAgICAgICAgIGJlZyA9IEhCLmFkZE9wZXJhdGlvbihuZXcgdHlwZXMuRGVsaW1pdGVyIHVpZF9iZWcsIHVuZGVmaW5lZCwgdWlkX2VuZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgZW5kID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2VuZCwgYmVnLCB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBSZXBsYWNlTWFuYWdlciB1bmRlZmluZWQsIHVpZF9yLCBiZWcsIGVuZClcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXS5zZXRQYXJlbnQgQG1hcF9tYW5hZ2VyLCBAbmFtZVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLmV4ZWN1dGUoKVxuICAgICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkFkZE5hbWVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnbWFwX21hbmFnZXInIDogQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICduYW1lJyA6IEBuYW1lXG4gICAgICB9XG5cbiAgcGFyc2VyWydBZGROYW1lJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdtYXBfbWFuYWdlcicgOiBtYXBfbWFuYWdlclxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICduYW1lJyA6IG5hbWVcbiAgICB9ID0ganNvblxuICAgIG5ldyBBZGROYW1lIHVpZCwgbWFwX21hbmFnZXIsIG5hbWVcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBMaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBpZiBiZWdpbm5pbmc/IGFuZCBlbmQ/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdiZWdpbm5pbmcnLCBiZWdpbm5pbmdcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2VuZCcsIGVuZFxuICAgICAgZWxzZVxuICAgICAgICBAYmVnaW5uaW5nID0gSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgICBAZW5kID0gICAgICAgSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIHJlc3VsdC5wdXNoIG9cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICBpZiAocG9zaXRpb24gPiAwIG9yIG8uaXNEZWxldGVkKCkpIGFuZCBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgIHdoaWxlIG8uaXNEZWxldGVkKCkgYW5kIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgICAjIGZpbmQgZmlyc3Qgbm9uIGRlbGV0ZWQgb3BcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFdvcmRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFdvcmRUeXBlXG4gICNcbiAgY2xhc3MgUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyBMaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChpbml0aWFsX2NvbnRlbnQsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgICBpZiBpbml0aWFsX2NvbnRlbnQ/XG4gICAgICAgIEByZXBsYWNlIGluaXRpYWxfY29udGVudFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIG9wID0gbmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsXG4gICAgICBIQi5hZGRPcGVyYXRpb24ob3ApLmV4ZWN1dGUoKVxuXG4gICAgI1xuICAgICMgQWRkIGNoYW5nZSBsaXN0ZW5lcnMgZm9yIHBhcmVudC5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAocGFyZW50LCBwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBAb24gJ2luc2VydCcsIChldmVudCwgb3ApPT5cbiAgICAgICAgaWYgb3AubmV4dF9jbCBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50ICdjaGFuZ2UnLCBwcm9wZXJ0eV9uYW1lXG4gICAgICBAb24gJ2NoYW5nZScsIChldmVudCk9PlxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCAnY2hhbmdlJywgcHJvcGVydHlfbmFtZVxuICAgICAgIyBDYWxsIHRoaXMsIHdoZW4gdGhlIGZpcnN0IGVsZW1lbnQgaXMgaW5zZXJ0ZWQuIFRoZW4gZGVsZXRlIHRoZSBsaXN0ZW5lci5cbiAgICAgIGFkZFByb3BlcnR5TGlzdGVuZXIgPSAoZXZlbnQsIG9wKT0+XG4gICAgICAgIGlmIG9wLm5leHRfY2wgaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIgYW5kIG9wLnByZXZfY2wgaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCAnYWRkUHJvcGVydHknLCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIEBkZWxldGVMaXN0ZW5lciAnYWRkUHJvcGVydHknLCBhZGRQcm9wZXJ0eUxpc3RlbmVyXG4gICAgICBAb24gJ2luc2VydCcsIGFkZFByb3BlcnR5TGlzdGVuZXJcbiAgICAgIHN1cGVyIHBhcmVudFxuICAgICAgXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzIFdvcmRUeXBlXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VNYW5hZ2VyXCJcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAgICdlbmQnIDogQGVuZC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAcHJldl9jbD8gYW5kIEBuZXh0X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlJlcGxhY2VNYW5hZ2VyXCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlTWFuYWdlciBjb250ZW50LCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZXMuXG4gICMgQHNlZSBSZXBsYWNlTWFuYWdlclxuICAjXG4gIGNsYXNzIFJlcGxhY2VhYmxlIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBpZiBub3QgKHByZXY/IGFuZCBuZXh0PyBhbmQgY29udGVudD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBjb250ZW50LCBwcmV2LCBhbmQgbmV4dCBmb3IgUmVwbGFjZWFibGUtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICAjXG4gICAgIyBSZXR1cm4gdGhlIGNvbnRlbnQgdGhhdCB0aGlzIG9wZXJhdGlvbiBob2xkcy5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGlzIHJlcGxhY2VhYmxlIHdpdGggbmV3IGNvbnRlbnQuXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50KS0+XG4gICAgICBAcGFyZW50LnJlcGxhY2UgY29udGVudFxuXG4gICAgI1xuICAgICMgSWYgcG9zc2libGUgc2V0IHRoZSByZXBsYWNlIG1hbmFnZXIgaW4gdGhlIGNvbnRlbnQuXG4gICAgIyBAc2VlIFdvcmRUeXBlLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQuc2V0UmVwbGFjZU1hbmFnZXI/KEBwYXJlbnQpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlYWJsZVwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudC5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuXG4gIHR5cGVzWydMaXN0TWFuYWdlciddID0gTGlzdE1hbmFnZXJcbiAgdHlwZXNbJ01hcE1hbmFnZXInXSA9IE1hcE1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VNYW5hZ2VyJ10gPSBSZXBsYWNlTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZWFibGUnXSA9IFJlcGxhY2VhYmxlXG5cbiAgYmFzaWNfdHlwZXNcblxuXG5cblxuXG5cbiIsInN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHN0cnVjdHVyZWRfdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHN0cnVjdHVyZWRfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEF0IHRoZSBtb21lbnQgVGV4dERlbGV0ZSB0eXBlIGVxdWFscyB0aGUgRGVsZXRlIHR5cGUgaW4gQmFzaWNUeXBlcy5cbiAgIyBAc2VlIEJhc2ljVHlwZXMuRGVsZXRlXG4gICNcbiAgY2xhc3MgVGV4dERlbGV0ZSBleHRlbmRzIHR5cGVzLkRlbGV0ZVxuICBwYXJzZXJbXCJUZXh0RGVsZXRlXCJdID0gcGFyc2VyW1wiRGVsZXRlXCJdXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEV4dGVuZHMgdGhlIGJhc2ljIEluc2VydCB0eXBlIHRvIGFuIG9wZXJhdGlvbiB0aGF0IGhvbGRzIGEgdGV4dCB2YWx1ZVxuICAjXG4gIGNsYXNzIFRleHRJbnNlcnQgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcbiAgICAjXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gY29udGVudCBUaGUgY29udGVudCBvZiB0aGlzIEluc2VydC10eXBlIE9wZXJhdGlvbi4gVXN1YWxseSB5b3UgcmVzdHJpY3QgdGhlIGxlbmd0aCBvZiBjb250ZW50IHRvIHNpemUgMVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBwcmV2LCBhbmQgbmV4dCBmb3IgVGV4dEluc2VydC10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICAjXG4gICAgIyBUaGUgcmVzdWx0IHdpbGwgYmUgY29uY2F0ZW5hdGVkIHdpdGggdGhlIHJlc3VsdHMgZnJvbSB0aGUgb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnNcbiAgICAjIGluIG9yZGVyIHRvIHJldHJpZXZlIHRoZSBjb250ZW50IG9mIHRoZSBlbmdpbmUuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIudG9FeGVjdXRlZEFycmF5XG4gICAgI1xuICAgIHZhbDogKGN1cnJlbnRfcG9zaXRpb24pLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJUZXh0SW5zZXJ0XCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50XG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiVGV4dEluc2VydFwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgSGFuZGxlcyBhIFdvcmRUeXBlLWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgIyBAbm90ZSBDdXJyZW50bHksIG9ubHkgVGV4dCBpcyBzdXBwb3J0ZWQhXG4gICNcbiAgY2xhc3MgV29yZFR5cGUgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIHdvcmQtdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHlhdHRhLnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiV29yZFR5cGVcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJXb3JkVHlwZVwiXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7V29yZFR5cGV9IFRoaXMgV29yZFR5cGUgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnRUZXh0OiAocG9zaXRpb24sIGNvbnRlbnQpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgZm9yIGMgaW4gY29udGVudFxuICAgICAgICBvcCA9IG5ldyBUZXh0SW5zZXJ0IGMsIHVuZGVmaW5lZCwgby5wcmV2X2NsLCBvXG4gICAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGEgcGFydCBvZiB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtXb3JkVHlwZX0gVGhpcyBXb3JkVHlwZSBvYmplY3RcbiAgICAjXG4gICAgZGVsZXRlVGV4dDogKHBvc2l0aW9uLCBsZW5ndGgpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgVGV4dERlbGV0ZSB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcikgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGlzIHdvcmQgd2l0aCBhbm90aGVyIG9uZS4gQ29uY3VycmVudCByZXBsYWNlbWVudHMgYXJlIG5vdCBtZXJnZWQhXG4gICAgIyBPbmx5IG9uZSBvZiB0aGUgcmVwbGFjZW1lbnRzIHdpbGwgYmUgdXNlZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtXb3JkVHlwZX0gUmV0dXJucyB0aGUgbmV3IFdvcmRUeXBlIG9iamVjdC5cbiAgICAjXG4gICAgcmVwbGFjZVRleHQ6ICh0ZXh0KS0+XG4gICAgICAjIENhbiBvbmx5IGJlIHVzZWQgaWYgdGhlIFJlcGxhY2VNYW5hZ2VyIHdhcyBzZXQhXG4gICAgICAjIEBzZWUgV29yZFR5cGUuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAgIGlmIEByZXBsYWNlX21hbmFnZXI/XG4gICAgICAgIHdvcmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IFdvcmRUeXBlIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCB0ZXh0XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXIucmVwbGFjZSh3b3JkKVxuICAgICAgICB3b3JkXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgdHlwZSBpcyBjdXJyZW50bHkgbm90IG1haW50YWluZWQgYnkgYSBSZXBsYWNlTWFuYWdlciFcIlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBTdHJpbmctcmVwcmVzZW50YXRpb24gb2YgdGhpcyB3b3JkLlxuICAgICMgQHJldHVybiB7U3RyaW5nfSBUaGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIFNhbWUgYXMgV29yZFR5cGUudmFsXG4gICAgIyBAc2VlIFdvcmRUeXBlLnZhbFxuICAgICNcbiAgICB0b1N0cmluZzogKCktPlxuICAgICAgQHZhbCgpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW4gbW9zdCBjYXNlcyB5b3Ugd291bGQgZW1iZWQgYSBXb3JkVHlwZSBpbiBhIFJlcGxhY2VhYmxlLCB3aWNoIGlzIGhhbmRsZWQgYnkgdGhlIFJlcGxhY2VNYW5hZ2VyIGluIG9yZGVyXG4gICAgIyB0byBwcm92aWRlIHJlcGxhY2UgZnVuY3Rpb25hbGl0eS5cbiAgICAjXG4gICAgc2V0UmVwbGFjZU1hbmFnZXI6IChvcCktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3JlcGxhY2VfbWFuYWdlcicsIG9wXG4gICAgICBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgQG9uIFsnaW5zZXJ0JywgJ2RlbGV0ZSddLCAoKT0+XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXI/LmNhbGxFdmVudCAnY2hhbmdlJ1xuXG4gICAgI1xuICAgICMgQmluZCB0aGlzIFdvcmRUeXBlIHRvIGEgdGV4dGZpZWxkIG9yIGlucHV0IGZpZWxkLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB0ZXh0Ym94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXh0ZmllbGRcIik7XG4gICAgIyAgIHlhdHRhLmJpbmQodGV4dGJveCk7XG4gICAgI1xuICAgIGJpbmQ6ICh0ZXh0ZmllbGQpLT5cbiAgICAgIHdvcmQgPSBAXG4gICAgICB0ZXh0ZmllbGQudmFsdWUgPSBAdmFsKClcblxuICAgICAgQG9uIFwiaW5zZXJ0XCIsIChldmVudCwgb3ApLT5cbiAgICAgICAgb19wb3MgPSBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICBpZiBjdXJzb3IgPD0gb19wb3NcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGN1cnNvciArPSAxXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgcmlnaHQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuXG4gICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIGxlZnQsIHJpZ2h0XG5cblxuICAgICAgQG9uIFwiZGVsZXRlXCIsIChldmVudCwgb3ApLT5cbiAgICAgICAgb19wb3MgPSBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICBpZiBjdXJzb3IgPCBvX3Bvc1xuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY3Vyc29yIC09IDFcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuICAgICAgIyBjb25zdW1lIGFsbCB0ZXh0LWluc2VydCBjaGFuZ2VzLlxuICAgICAgdGV4dGZpZWxkLm9ua2V5cHJlc3MgPSAoZXZlbnQpLT5cbiAgICAgICAgY2hhciA9IG51bGxcbiAgICAgICAgaWYgZXZlbnQua2V5P1xuICAgICAgICAgIGlmIGV2ZW50LmNoYXJDb2RlIGlzIDMyXG4gICAgICAgICAgICBjaGFyID0gXCIgXCJcbiAgICAgICAgICBlbHNlIGlmIGV2ZW50LmtleUNvZGUgaXMgMTNcbiAgICAgICAgICAgIGNoYXIgPSAnXFxuJ1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNoYXIgPSBldmVudC5rZXlcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlIGV2ZW50LmtleUNvZGVcbiAgICAgICAgaWYgY2hhci5sZW5ndGggPiAwXG4gICAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgICAgZGlmZiA9IE1hdGguYWJzKHRleHRmaWVsZC5zZWxlY3Rpb25FbmQgLSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQpXG4gICAgICAgICAgd29yZC5kZWxldGVUZXh0IChwb3MpLCBkaWZmXG4gICAgICAgICAgd29yZC5pbnNlcnRUZXh0IHBvcywgY2hhclxuICAgICAgICAgIG5ld19wb3MgPSBwb3MgKyBjaGFyLmxlbmd0aFxuICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBuZXdfcG9zLCBuZXdfcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICB0ZXh0ZmllbGQub25wYXN0ZSA9IChldmVudCktPlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICB0ZXh0ZmllbGQub25jdXQgPSAoZXZlbnQpLT5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAjXG4gICAgICAjIGNvbnN1bWUgZGVsZXRlcy4gTm90ZSB0aGF0XG4gICAgICAjICAgY2hyb21lOiB3b24ndCBjb25zdW1lIGRlbGV0aW9ucyBvbiBrZXlwcmVzcyBldmVudC5cbiAgICAgICMgICBrZXlDb2RlIGlzIGRlcHJlY2F0ZWQuIEJVVDogSSBkb24ndCBzZWUgYW5vdGhlciB3YXkuXG4gICAgICAjICAgICBzaW5jZSBldmVudC5rZXkgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IHZlcnNpb24gb2YgY2hyb21lLlxuICAgICAgIyAgICAgRXZlcnkgYnJvd3NlciBzdXBwb3J0cyBrZXlDb2RlLiBMZXQncyBzdGljayB3aXRoIGl0IGZvciBub3cuLlxuICAgICAgI1xuICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IChldmVudCktPlxuICAgICAgICBwb3MgPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgZGlmZiA9IE1hdGguYWJzKHRleHRmaWVsZC5zZWxlY3Rpb25FbmQgLSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQpXG4gICAgICAgIGlmIGV2ZW50LmtleUNvZGU/IGFuZCBldmVudC5rZXlDb2RlIGlzIDggIyBCYWNrc3BhY2VcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgaWYgZXZlbnQuY3RybEtleT8gYW5kIGV2ZW50LmN0cmxLZXlcbiAgICAgICAgICAgICAgdmFsID0gdGV4dGZpZWxkLnZhbHVlXG4gICAgICAgICAgICAgIG5ld19wb3MgPSBwb3NcbiAgICAgICAgICAgICAgZGVsX2xlbmd0aCA9IDBcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3aGlsZSBuZXdfcG9zID4gMCBhbmQgdmFsW25ld19wb3NdIGlzbnQgXCIgXCIgYW5kIHZhbFtuZXdfcG9zXSBpc250ICdcXG4nXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBuZXdfcG9zLCAocG9zLW5ld19wb3MpXG4gICAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBuZXdfcG9zLCBuZXdfcG9zXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCAocG9zLTEpLCAxXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICBlbHNlIGlmIGV2ZW50LmtleUNvZGU/IGFuZCBldmVudC5rZXlDb2RlIGlzIDQ2ICMgRGVsZXRlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIGRpZmZcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIDFcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIldvcmRUeXBlXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICdlbmQnIDogQGVuZC5nZXRVaWQoKVxuICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBpZiBAbmV4dF9jbD9cbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ1dvcmRUeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmRUeXBlIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkVHlwZSddID0gV29yZFR5cGVcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiJdfQ==
