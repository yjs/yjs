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
      if (this.HB.getOperation(o.uid) != null) {
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
var Engine, HistoryBuffer, JsonYatta, json_types_uninitialized;

json_types_uninitialized = require("../Types/JsonTypes");

HistoryBuffer = require("../HistoryBuffer");

Engine = require("../Engine");

JsonYatta = (function() {
  function JsonYatta(user_id, Connector) {
    var first_word, json_types;
    this.HB = new HistoryBuffer(user_id);
    json_types = json_types_uninitialized(this.HB);
    this.engine = new Engine(this.HB, json_types.parser);
    this.connector = new Connector(this.engine, this.HB, json_types.execution_listener, this);
    first_word = new json_types.types.JsonType(this.HB.getReservedUniqueIdentifier());
    this.HB.addOperation(first_word).execute();
    this.root_element = first_word;
  }

  JsonYatta.prototype.getRootElement = function() {
    return this.root_element;
  };

  JsonYatta.prototype.getEngine = function() {
    return this.engine;
  };

  JsonYatta.prototype.getConnector = function() {
    return this.connector;
  };

  JsonYatta.prototype.getHistoryBuffer = function() {
    return this.HB;
  };

  JsonYatta.prototype.setMutableDefault = function(mutable) {
    return this.root_element.setMutableDefault(mutable);
  };

  JsonYatta.prototype.getUserId = function() {
    return this.HB.getUserId();
  };

  JsonYatta.prototype.val = function(name, content, mutable) {
    return this.root_element.val(name, content, mutable);
  };

  Object.defineProperty(JsonYatta.prototype, 'value', {
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

  return JsonYatta;

})();

if (typeof window !== "undefined" && window !== null) {
  window.JsonYatta = JsonYatta;
}

module.exports = JsonYatta;


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
        if (!isNaN(parseInt(o_number)) && unknown(u_name, o_number)) {
          o_json = o._encode();
          if (o.next_cl != null) {
            o_next = o.next_cl;
            while ((o_next.next_cl != null) && unknown(o_next.creator, o_next.op_number)) {
              o_next = o_next.next_cl;
            }
            o_json.next = o_next.getUid();
          } else if (o.prev_cl != null) {
            o_prev = o.prev_cl;
            while ((o_prev.prev_cl != null) && unknown(o_next.creator, o_next.op_number)) {
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
    if (this.operation_counter[o.creator] == null) {
      this.operation_counter[o.creator] = 0;
    }
    if (typeof o.op_number === 'number' && o.creator !== this.getUserId()) {
      return this.operation_counter[o.creator]++;
    }
  };

  return HistoryBuffer;

})();

module.exports = HistoryBuffer;


},{}],4:[function(require,module,exports){
var __hasProp = {}.hasOwnProperty,
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

    Operation.prototype.on = function(event, f) {
      var _base;
      if (this.event_listeners == null) {
        this.event_listeners = {};
      }
      if ((_base = this.event_listeners)[event] == null) {
        _base[event] = [];
      }
      return this.event_listeners[event].push(f);
    };

    Operation.prototype.callEvent = function(event, args) {
      var f, _i, _len, _ref, _results;
      if (this.event_listeners[event] != null) {
        _ref = this.event_listeners[event];
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          f = _ref[_i];
          _results.push(f.call(this, event, args));
        }
        return _results;
      }
    };

    Operation.prototype.setParent = function(o) {
      return this.parent = o;
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
        Delete.__super__.execute.apply(this, arguments);
        return this;
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
      return this.deleted_by.push(o);
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
      var distance_to_origin, i, o, _ref, _ref1;
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
        Insert.__super__.execute.apply(this, arguments);
        return this;
      }
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
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_types_uninitialized = require("./TextTypes");

module.exports = function(HB) {
  var JsonType, createJsonWrapper, parser, text_types, types;
  text_types = text_types_uninitialized(HB);
  types = text_types.types;
  parser = text_types.parser;
  createJsonWrapper = function(_jsonType) {
    var JsonWrapper;
    JsonWrapper = (function() {
      function JsonWrapper(jsonType) {
        var name, obj, _fn, _ref;
        _ref = jsonType.map;
        _fn = function(name, obj) {
          return Object.defineProperty(JsonWrapper.prototype, name, {
            get: function() {
              var x;
              x = obj.val();
              if (x instanceof JsonType) {
                return createJsonWrapper(x);
              } else if (x instanceof types.ImmutableObject) {
                return x.val();
              } else {
                return x;
              }
            },
            set: function(o) {
              var o_name, o_obj, overwrite, _results;
              if (o.constructor === {}.constructor) {
                overwrite = jsonType.val(name);
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

      return JsonWrapper;

    })();
    return new JsonWrapper(_jsonType);
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
      } else if ((name != null) && (content != null)) {
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
        } else if (((!mutable) || typeof content === 'number') && content.constructor !== Object) {
          obj = HB.addOperation(new types.ImmutableObject(void 0, content)).execute();
          return JsonType.__super__.val.call(this, name, obj);
        } else {
          if (typeof content === 'string') {
            word = HB.addOperation(new types.Word(void 0)).execute();
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
        return createJsonWrapper(this);
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
          this.map_manager.map[this.name] = HB.addOperation(new ReplaceManager(void 0, uid_r, beg, end)).execute();
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
      if (position > 0) {
        while (true) {
          o = o.next_cl;
          if (!o.isDeleted()) {
            position -= 1;
          }
          if (position === 0) {
            break;
          }
          if (o instanceof types.Delimiter) {
            throw new Error("position parameter exceeded the length of the document!");
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

    ReplaceManager.prototype.replace = function(content) {
      var o, op;
      o = this.getLastOperation();
      op = new Replaceable(content, this, void 0, o, o.next_cl);
      return HB.addOperation(op).execute();
    };

    ReplaceManager.prototype.val = function() {
      var o;
      o = this.getLastOperation();
      if (o instanceof types.Delimiter) {
        throw new Error("dtrn");
      }
      return o.val();
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
        Replaceable.__super__.execute.apply(this, arguments);
        return this;
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
  var TextDelete, TextInsert, Word, parser, structured_types, types;
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
  Word = (function(_super) {
    __extends(Word, _super);

    function Word(uid, beginning, end, prev, next, origin) {
      Word.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
    }

    Word.prototype.insertText = function(position, content) {
      var c, o, op, _i, _len, _results;
      o = this.getOperationByPosition(position);
      _results = [];
      for (_i = 0, _len = content.length; _i < _len; _i++) {
        c = content[_i];
        op = new TextInsert(c, void 0, o.prev_cl, o);
        _results.push(HB.addOperation(op).execute());
      }
      return _results;
    };

    Word.prototype.deleteText = function(position, length) {
      var d, i, o, _i, _results;
      o = this.getOperationByPosition(position);
      _results = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        d = HB.addOperation(new TextDelete(void 0, o)).execute();
        o = o.next_cl;
        while (o.isDeleted()) {
          if (o instanceof types.Delimiter) {
            throw new Error("You can't delete more than there is..");
          }
          o = o.next_cl;
        }
        _results.push(d._encode());
      }
      return _results;
    };

    Word.prototype.replaceText = function(text) {
      var word;
      if (this.replace_manager != null) {
        word = HB.addOperation(new Word(void 0)).execute();
        word.insertText(0, text);
        return this.replace_manager.replace(word);
      } else {
        throw new Error("This type is currently not maintained by a ReplaceManager!");
      }
    };

    Word.prototype.val = function() {
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

    Word.prototype.setReplaceManager = function(op) {
      this.saveOperation('replace_manager', op);
      return this.validateSavedOperations;
    };

    Word.prototype._encode = function() {
      var json;
      json = {
        'type': "Word",
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

    return Word;

  })(types.ListManager);
  parser['Word'] = function(json) {
    var beginning, end, next, origin, prev, uid;
    uid = json['uid'], beginning = json['beginning'], end = json['end'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new Word(uid, beginning, end, prev, next, origin);
  };
  types['TextInsert'] = TextInsert;
  types['TextDelete'] = TextDelete;
  types['Word'] = Word;
  return structured_types;
};


},{"./StructuredTypes":6}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0ZyYW1ld29ya3MvSnNvbllhdHRhLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL1R5cGVzL0Jhc2ljVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9Kc29uVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9UZXh0VHlwZXMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDSUEsSUFBQSxNQUFBOztBQUFBO0FBTWUsRUFBQSxnQkFBRSxFQUFGLEVBQU8sTUFBUCxHQUFBO0FBQ1gsSUFEWSxJQUFDLENBQUEsS0FBQSxFQUNiLENBQUE7QUFBQSxJQURpQixJQUFDLENBQUEsU0FBQSxNQUNsQixDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsZUFBRCxHQUFtQixFQUFuQixDQURXO0VBQUEsQ0FBYjs7QUFBQSxtQkFNQSxjQUFBLEdBQWdCLFNBQUMsSUFBRCxHQUFBO0FBQ2QsUUFBQSxVQUFBO0FBQUEsSUFBQSxVQUFBLEdBQWEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFJLENBQUMsSUFBTCxDQUFyQixDQUFBO0FBQ0EsSUFBQSxJQUFHLGtCQUFIO2FBQ0Us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R0FBc0IsVUF4S3RCLENBQUE7QUFBQSxFQXlLQSxLQUFNLENBQUEsWUFBQSxDQUFOLEdBQXNCLFVBekt0QixDQUFBO0FBQUEsRUEwS0EsS0FBTSxDQUFBLE1BQUEsQ0FBTixHQUFnQixJQTFLaEIsQ0FBQTtTQTJLQSxpQkE1S2U7QUFBQSxDQUZqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxyXG4jXHJcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cclxuI1xyXG5jbGFzcyBFbmdpbmVcclxuXHJcbiAgI1xyXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxyXG4gICMgQHBhcmFtIHtBcnJheX0gcGFyc2VyIERlZmluZXMgaG93IHRvIHBhcnNlIGVuY29kZWQgbWVzc2FnZXMuXHJcbiAgI1xyXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAcGFyc2VyKS0+XHJcbiAgICBAdW5wcm9jZXNzZWRfb3BzID0gW11cclxuXHJcbiAgI1xyXG4gICMgUGFyc2VzIGFuIG9wZXJhdGlvIGZyb20gdGhlIGpzb24gZm9ybWF0LiBJdCB1c2VzIHRoZSBzcGVjaWZpZWQgcGFyc2VyIGluIHlvdXIgT3BlcmF0aW9uVHlwZSBtb2R1bGUuXHJcbiAgI1xyXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxyXG4gICAgdHlwZVBhcnNlciA9IEBwYXJzZXJbanNvbi50eXBlXVxyXG4gICAgaWYgdHlwZVBhcnNlcj9cclxuICAgICAgdHlwZVBhcnNlciBqc29uXHJcbiAgICBlbHNlXHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLnRvSnNvbigpLlxyXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXHJcbiAgI1xyXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cclxuICAgIG9wcyA9IFtdXHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxyXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXHJcbiAgI1xyXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cclxuICAjXHJcbiAgYXBwbHlPcDogKG9wX2pzb24pLT5cclxuICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxyXG4gICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICBASEIuYWRkVG9Db3VudGVyIG9cclxuICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIGVsc2VcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL0pzb25UeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBKc29uIGRhdGEtc3RydWN0dXJlcy5cbiMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiMgKiBTdHJpbmdcbiMgKiBJbnRlZ2VyXG4jICogQXJyYXlcbiNcbmNsYXNzIEpzb25ZYXR0YVxuXG4gICNcbiAgIyBAcGFyYW0ge1N0cmluZ30gdXNlcl9pZCBVbmlxdWUgaWQgb2YgdGhlIHBlZXIuXG4gICMgQHBhcmFtIHtDb25uZWN0b3J9IENvbm5lY3RvciB0aGUgY29ubmVjdG9yIGNsYXNzLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAodXNlcl9pZCwgQ29ubmVjdG9yKS0+XG4gICAgQEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICAgIGpzb25fdHlwZXMgPSBqc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCBqc29uX3R5cGVzLnBhcnNlclxuICAgIEBjb25uZWN0b3IgPSBuZXcgQ29ubmVjdG9yIEBlbmdpbmUsIEBIQiwganNvbl90eXBlcy5leGVjdXRpb25fbGlzdGVuZXIsIEBcblxuICAgIGZpcnN0X3dvcmQgPSBuZXcganNvbl90eXBlcy50eXBlcy5Kc29uVHlwZSBASEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKClcbiAgICBASEIuYWRkT3BlcmF0aW9uKGZpcnN0X3dvcmQpLmV4ZWN1dGUoKVxuICAgIEByb290X2VsZW1lbnQgPSBmaXJzdF93b3JkXG5cbiAgI1xuICAjIEByZXN1bHQgSnNvblR5cGVcbiAgI1xuICBnZXRSb290RWxlbWVudDogKCktPlxuICAgIEByb290X2VsZW1lbnRcblxuICAjXG4gICMgQHNlZSBFbmdpbmVcbiAgI1xuICBnZXRFbmdpbmU6ICgpLT5cbiAgICBAZW5naW5lXG5cbiAgI1xuICAjIEdldCB0aGUgaW5pdGlhbGl6ZWQgY29ubmVjdG9yLlxuICAjXG4gIGdldENvbm5lY3RvcjogKCktPlxuICAgIEBjb25uZWN0b3JcblxuICAjXG4gICMgQHNlZSBIaXN0b3J5QnVmZmVyXG4gICNcbiAgZ2V0SGlzdG9yeUJ1ZmZlcjogKCktPlxuICAgIEBIQlxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnNldE11dGFibGVEZWZhdWx0XG4gICNcbiAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgQHJvb3RfZWxlbWVudC5zZXRNdXRhYmxlRGVmYXVsdChtdXRhYmxlKVxuXG4gICNcbiAgIyBHZXQgdGhlIFVzZXJJZCBmcm9tIHRoZSBIaXN0b3J5QnVmZmVyIG9iamVjdC5cbiAgIyBJbiBtb3N0IGNhc2VzIHRoaXMgd2lsbCBiZSB0aGUgc2FtZSBhcyB0aGUgdXNlcl9pZCB2YWx1ZSB3aXRoIHdoaWNoXG4gICMgSnNvbllhdHRhIHdhcyBpbml0aWFsaXplZCAoRGVwZW5kaW5nIG9uIHRoZSBIaXN0b3J5QnVmZmVyIGltcGxlbWVudGF0aW9uKS5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBASEIuZ2V0VXNlcklkKClcblxuICAjXG4gICMgQHNlZSBKc29uVHlwZS52YWxcbiAgI1xuICB2YWwgOiAobmFtZSwgY29udGVudCwgbXV0YWJsZSktPlxuICAgIEByb290X2VsZW1lbnQudmFsKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsdWVcbiAgI1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvbllhdHRhLnByb3RvdHlwZSwgJ3ZhbHVlJyxcbiAgICBnZXQgOiAtPiBAcm9vdF9lbGVtZW50LnZhbHVlXG4gICAgc2V0IDogKG8pLT5cbiAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgQHZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxud2luZG93Py5Kc29uWWF0dGEgPSBKc29uWWF0dGFcbm1vZHVsZS5leHBvcnRzID0gSnNvbllhdHRhXG4iLCJcbiNcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuXG4gICNcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQHVzZXJfaWRcblxuICAjXG4gICMgVGhlcmUgaXMgb25seSBvbmUgcmVzZXJ2ZWQgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCksIHNvIHVzZSBpdCB3aXNlbHkuXG4gICMgSSBwcm9wb3NlIHRvIHVzZSBpdCBpbiB5b3VyIEZyYW1ld29yaywgdG8gY3JlYXRlIHNvbWV0aGluZyBsaWtlIGEgcm9vdCBlbGVtZW50LlxuICAjIEFuIG9wZXJhdGlvbiB3aXRoIHRoaXMgaWRlbnRpZmllciBpcyBub3QgcHJvcGFnYXRlZCB0byBvdGhlciBjbGllbnRzLlxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cbiAgI1xuICBnZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXI6ICgpLT5cbiAgICB7XG4gICAgICBjcmVhdG9yIDogJ18nXG4gICAgICBvcF9udW1iZXIgOiAnXydcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICgpLT5cbiAgICByZXMgPSB7fVxuICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgIHJlc1t1c2VyXSA9IGN0blxuICAgIHJlc1xuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cbiAgICBqc29uID0gW11cbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZGFoIVwiXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcblxuICAgIGZvciB1X25hbWUsdXNlciBvZiBAYnVmZmVyXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIG5vdCBpc05hTihwYXJzZUludChvX251bWJlcikpIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/XG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/XG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQgaW5zdGFuY2VvZiBPYmplY3RcbiAgICAgIEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxuICAgIGVsc2UgaWYgbm90IHVpZD9cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgb2YgdWlkIGlzIG5vdCBkZWZpbmVkIVwiXG4gICNcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XG4gICMgb3RoZXIgb3BlcmF0aW9ucyAoaXQgd29udCBleGVjdXRlZClcbiAgI1xuICBhZGRPcGVyYXRpb246IChvKS0+XG4gICAgaWYgbm90IEBidWZmZXJbby5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIEBidWZmZXJbby5jcmVhdG9yXVtvLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSA9IDBcbiAgICBpZiB0eXBlb2Ygby5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8uY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0rK1xuICAgICNpZiBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSBpc250IChvLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIC0gKG8ub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgcGFyc2VyID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuXG4gICNcbiAgY2xhc3MgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIGlmIG5vdCB1aWQ/XG4gICAgICAgIHVpZCA9IEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIHtcbiAgICAgICAgJ2NyZWF0b3InOiBAY3JlYXRvclxuICAgICAgICAnb3BfbnVtYmVyJyA6IEBvcF9udW1iZXJcbiAgICAgIH0gPSB1aWRcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGV2ZW50IE5hbWUgb2YgdGhlIGV2ZW50LlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvbjogKGV2ZW50LCBmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID89IHt9XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzW2V2ZW50XSA/PSBbXVxuICAgICAgQGV2ZW50X2xpc3RlbmVyc1tldmVudF0ucHVzaCBmXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgI1xuICAgIGNhbGxFdmVudDogKGV2ZW50LCBhcmdzKS0+XG4gICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzW2V2ZW50XT9cbiAgICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1tldmVudF1cbiAgICAgICAgICBmLmNhbGwgQCwgZXZlbnQsIGFyZ3NcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChvKS0+XG4gICAgICBAcGFyZW50ID0gb1xuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgeyAnY3JlYXRvcic6IEBjcmVhdG9yLCAnb3BfbnVtYmVyJzogQG9wX251bWJlciB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgb3A/LmV4ZWN1dGU/XG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG5cblxuICAjXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBJbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgY2xhc3MgRGVsZXRlIGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBkZWxldGVzKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICBzdXBlclxuICAgICAgICBAXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgI1xuICAjIERlZmluZSBob3cgdG8gcGFyc2UgRGVsZXRlIG9wZXJhdGlvbnMuXG4gICNcbiAgcGFyc2VyWydEZWxldGUnXSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyBEZWxldGUgdWlkLCBkZWxldGVzX3VpZFxuXG4gICNcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcbiAgI1xuICBjbGFzcyBJbnNlcnQgZXh0ZW5kcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cblxuICAgICNcbiAgICAjIElmIGlzRGVsZXRlZCgpIGlzIHRydWUgdGhpcyBvcGVyYXRpb24gd29uJ3QgYmUgbWFpbnRhaW5lZCBpbiB0aGUgc2xcbiAgICAjXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBAZGVsZXRlZF9ieT8ubGVuZ3RoID4gMFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgICNUT0RPOiBkZWxldGUgdGhpc1xuICAgICAgICBpZiBAIGlzIEBwcmV2X2NsXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBzaG91bGQgbm90IGhhcHBlbiA7KSBcIlxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVXBkYXRlIHRoZSBzaG9ydCBsaXN0XG4gICAgIyBUT0RPIChVbnVzZWQpXG4gICAgdXBkYXRlX3NsOiAoKS0+XG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHVwZGF0ZTogKGRlc3RfY2wsZGVzdF9zbCktPlxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgaWYgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgbyA9IG9bZGVzdF9jbF1cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBAW2Rlc3Rfc2xdID0gb1xuXG4gICAgICAgICAgICBicmVha1xuICAgICAgdXBkYXRlIFwicHJldl9jbFwiLCBcInByZXZfc2xcIlxuICAgICAgdXBkYXRlIFwibmV4dF9jbFwiLCBcInByZXZfc2xcIlxuXG5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQGlzX2V4ZWN1dGVkP1xuICAgICAgICByZXR1cm4gQFxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAcHJldl9jbD8udmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKSBhbmQgQG5leHRfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBwcmV2X2NsLm5leHRfY2wgaXNudCBAXG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IDBcbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgICAgICMgICAgICAgICBsZXQgJE9MPSBbbzEsbzIsbzMsbzRdLCB3aGVyZWJ5ICR0aGlzIGlzIHRvIGJlIGluc2VydGVkIGJldHdlZW4gbzEgYW5kIG80XG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICAgICAjICAgICAgICAgdGhlbiBvMiBrbm93cyBvMy4gU2luY2Ugb24gYW5vdGhlciBjbGllbnQgJE9MIGNvdWxkIGJlIFtvMSxvMyxvNF0gdGhlIHByb2JsZW0gaXMgY29tcGxleFxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgIGlmIGN1cnJlbnQgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uID4gJG8gb3JpZ2luOiAkdGhpcyBpbnNcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZSAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgICAgICMgY2FzZSAzOiAkb3JpZ2luID4gJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICAgaWYgbm90IG8/XG4gICAgICAgICAgICAgICMgVE9ETzogRGVidWdnaW5nXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby5jcmVhdG9yIDwgQGNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcbiAgICAgICAgc3VwZXIgIyBub3RpZnkgdGhlIGV4ZWN1dGlvbl9saXN0ZW5lcnNcbiAgICAgICAgQFxuXG4gICNcbiAgIyBEZWZpbmVzIGFuIG9iamVjdCB0aGF0IGlzIGNhbm5vdCBiZSBjaGFuZ2VkLiBZb3UgY2FuIHVzZSB0aGlzIHRvIHNldCBhbiBpbW11dGFibGUgc3RyaW5nLCBvciBhIG51bWJlci5cbiAgI1xuICBjbGFzcyBJbW11dGFibGVPYmplY3QgZXh0ZW5kcyBJbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBjb250ZW50XG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBAY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgQHJldHVybiBbU3RyaW5nXSBUaGUgY29udGVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgdmFsIDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogXCJJbW11dGFibGVPYmplY3RcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnY29udGVudCcgOiBAY29udGVudFxuICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBpZiBAbmV4dF9jbD9cbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ0ltbXV0YWJsZU9iamVjdCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSW1tdXRhYmxlT2JqZWN0IHVpZCwgY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3MgRGVsaW1pdGVyIGV4dGVuZHMgT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgaXNEZWxldGVkKCkgaXMgdHJ1ZSB0aGlzIG9wZXJhdGlvbiB3b24ndCBiZSBtYWludGFpbmVkIGluIHRoZSBzbFxuICAgICNcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnRGVsaW1pdGVyJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgRGVsaW1pdGVyIHVpZCwgcHJldiwgbmV4dFxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICd0eXBlcycgOlxuICAgICAgJ0RlbGV0ZScgOiBEZWxldGVcbiAgICAgICdJbnNlcnQnIDogSW5zZXJ0XG4gICAgICAnRGVsaW1pdGVyJzogRGVsaW1pdGVyXG4gICAgICAnT3BlcmF0aW9uJzogT3BlcmF0aW9uXG4gICAgICAnSW1tdXRhYmxlT2JqZWN0JyA6IEltbXV0YWJsZU9iamVjdFxuICAgICdwYXJzZXInIDogcGFyc2VyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJ0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0VHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICB0ZXh0X3R5cGVzID0gdGV4dF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSB0ZXh0X3R5cGVzLnBhcnNlclxuXG4gIGNyZWF0ZUpzb25XcmFwcGVyID0gKF9qc29uVHlwZSktPlxuXG4gICAgI1xuICAgICMgQSBKc29uV3JhcHBlciB3YXMgaW50ZW5kZWQgdG8gYmUgYSBjb252ZW5pZW50IHdyYXBwZXIgZm9yIHRoZSBKc29uVHlwZS5cbiAgICAjIEJ1dCBpdCBjYW4gbWFrZSB0aGluZ3MgbW9yZSBkaWZmaWN1bHQgdGhhbiB0aGV5IGFyZS5cbiAgICAjIEBzZWUgSnNvblR5cGVcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBjcmVhdGUgYSBKc29uV3JhcHBlclxuICAgICMgICAjIFlvdSBnZXQgYSBKc29uV3JhcHBlciBmcm9tIGEgSnNvblR5cGUgYnkgY2FsbGluZ1xuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjXG4gICAgIyBJdCBjcmVhdGVzIEphdmFzY3JpcHRzIC1nZXR0ZXIgYW5kIC1zZXR0ZXIgbWV0aG9kcyBmb3IgZWFjaCBwcm9wZXJ0eSB0aGF0IEpzb25UeXBlIG1haW50YWlucy5cbiAgICAjIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2RlZmluZVByb3BlcnR5XG4gICAgI1xuICAgICMgQGV4YW1wbGUgR2V0dGVyIEV4YW1wbGVcbiAgICAjICAgIyB5b3UgY2FuIGFjY2VzcyB0aGUgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueFxuICAgICMgICAjIGluc3RlYWQgb2ZcbiAgICAjICAgeWF0dGEudmFsKCd4JylcbiAgICAjXG4gICAgIyBAbm90ZSBZb3UgY2FuIG9ubHkgb3ZlcndyaXRlIGV4aXN0aW5nIHZhbHVlcyEgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eSB3b24ndCBoYXZlIGFueSBlZmZlY3QhXG4gICAgI1xuICAgICMgQGV4YW1wbGUgU2V0dGVyIEV4YW1wbGVcbiAgICAjICAgIyB5b3UgY2FuIHNldCBhbiBleGlzdGluZyB4IHByb3BlcnR5IG9mIHlhdHRhIGJ5IGNhbGxpbmdcbiAgICAjICAgdy54ID0gXCJ0ZXh0XCJcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcsIFwidGV4dFwiKVxuICAgICNcbiAgICAjIEluIG9yZGVyIHRvIHNldCBhIG5ldyBwcm9wZXJ0eSB5b3UgaGF2ZSB0byBvdmVyd3JpdGUgYW4gZXhpc3RpbmcgcHJvcGVydHkuXG4gICAgIyBUaGVyZWZvcmUgdGhlIEpzb25XcmFwcGVyIHN1cHBvcnRzIGEgc3BlY2lhbCBmZWF0dXJlIHRoYXQgc2hvdWxkIG1ha2UgdGhpbmdzIG1vcmUgY29udmVuaWVudFxuICAgICMgKHdlIGNhbiBhcmd1ZSBhYm91dCB0aGF0LCB1c2UgdGhlIEpzb25UeXBlIGlmIHlvdSBkb24ndCBsaWtlIGl0IDspLlxuICAgICMgSWYgeW91IG92ZXJ3cml0ZSBhbiBvYmplY3QgcHJvcGVydHkgb2YgdGhlIEpzb25XcmFwcGVyIHdpdGggYSBuZXcgb2JqZWN0LCBpdCB3aWxsIHJlc3VsdCBpbiBhIG1lcmdlZCB2ZXJzaW9uIG9mIHRoZSBvYmplY3RzLlxuICAgICMgTGV0IHcucCB0aGUgcHJvcGVydHkgdGhhdCBpcyB0byBiZSBvdmVyd3JpdHRlbiBhbmQgbyB0aGUgbmV3IHZhbHVlLiBFLmcuIHcucCA9IG9cbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygb1xuICAgICMgKiBUaGUgcmVzdWx0IGhhcyBhbGwgcHJvcGVydGllcyBvZiB3LnAgaWYgdGhleSBkb24ndCBvY2N1ciB1bmRlciB0aGUgc2FtZSBwcm9wZXJ0eS1uYW1lIGluIG8uXG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29uZmxpY3QgRXhhbXBsZVxuICAgICMgICB5YXR0YS52YWx1ZSA9IHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiBcInN0cmluZ1wifVxuICAgICMgICB3LmEgPSB7YSA6IHtiIDogXCJzdHJpbmdcIn19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCJ9fVxuICAgICMgICB3LmEgPSB7YSA6IHtjIDogNH19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCIsIGMgOiA0fX1cbiAgICAjXG4gICAgIyBAZXhhbXBsZSBDb21tb24gUGl0ZmFsbHNcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgICMgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eVxuICAgICMgICB3Lm5ld1Byb3BlcnR5ID0gXCJBd2Vzb21lXCJcbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgdy5uZXdQcm9wZXJ0eSBpcyB1bmRlZmluZWRcbiAgICAjICAgIyBvdmVyd3JpdGUgdGhlIHcgb2JqZWN0XG4gICAgIyAgIHcgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlISwgYnV0IC4uXG4gICAgIyAgIGNvbnNvbGUubG9nKHlhdHRhLnZhbHVlLm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIGZhbHNlLCB5b3UgYXJlIG9ubHkgYWxsb3dlZCB0byBzZXQgcHJvcGVydGllcyFcbiAgICAjICAgIyBUaGUgc29sdXRpb25cbiAgICAjICAgeWF0dGEudmFsdWUgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlIVxuICAgICNcbiAgICBjbGFzcyBKc29uV3JhcHBlclxuXG4gICAgICAjXG4gICAgICAjIEBwYXJhbSB7SnNvblR5cGV9IGpzb25UeXBlIEluc3RhbmNlIG9mIHRoZSBKc29uVHlwZSB0aGF0IHRoaXMgY2xhc3Mgd3JhcHBlcy5cbiAgICAgICNcbiAgICAgIGNvbnN0cnVjdG9yOiAoanNvblR5cGUpLT5cbiAgICAgICAgZm9yIG5hbWUsIG9iaiBvZiBqc29uVHlwZS5tYXBcbiAgICAgICAgICBkbyAobmFtZSwgb2JqKS0+XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvbldyYXBwZXIucHJvdG90eXBlLCBuYW1lLFxuICAgICAgICAgICAgICBnZXQgOiAtPlxuICAgICAgICAgICAgICAgIHggPSBvYmoudmFsKClcbiAgICAgICAgICAgICAgICBpZiB4IGluc3RhbmNlb2YgSnNvblR5cGVcbiAgICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25XcmFwcGVyIHhcbiAgICAgICAgICAgICAgICBlbHNlIGlmIHggaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICAgICAgICAgIHgudmFsKClcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICB4XG4gICAgICAgICAgICAgIHNldCA6IChvKS0+XG4gICAgICAgICAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlID0ganNvblR5cGUudmFsKG5hbWUpXG4gICAgICAgICAgICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlLnZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBqc29uVHlwZS52YWwobmFtZSwgbywgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZVxuICAgIG5ldyBKc29uV3JhcHBlciBfanNvblR5cGVcblxuICAjXG4gICMgTWFuYWdlcyBPYmplY3QtbGlrZSB2YWx1ZXMuXG4gICNcbiAgY2xhc3MgSnNvblR5cGUgZXh0ZW5kcyB0eXBlcy5NYXBNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gaW5pdGlhbF92YWx1ZSBDcmVhdGUgdGhpcyBvcGVyYXRpb24gd2l0aCBhbiBpbml0aWFsIHZhbHVlLlxuICAgICMgQHBhcmFtIHtTdHJpbmd8Qm9vbGVhbn0gV2hldGhlciB0aGUgaW5pdGlhbF92YWx1ZSBzaG91bGQgYmUgY3JlYXRlZCBhcyBtdXRhYmxlLiAoT3B0aW9uYWwgLSBzZWUgc2V0TXV0YWJsZURlZmF1bHQpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBpbml0aWFsX3ZhbHVlLCBtdXRhYmxlKS0+XG4gICAgICBzdXBlciB1aWRcbiAgICAgIGlmIGluaXRpYWxfdmFsdWU/XG4gICAgICAgIGlmIHR5cGVvZiBpbml0aWFsX3ZhbHVlIGlzbnQgXCJvYmplY3RcIlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoZSBpbml0aWFsIHZhbHVlIG9mIEpzb25UeXBlcyBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0ISAoY3VycmVudCB0eXBlOiAje3R5cGVvZiBpbml0aWFsX3ZhbHVlfSlcIlxuICAgICAgICBmb3IgbmFtZSxvIG9mIGluaXRpYWxfdmFsdWVcbiAgICAgICAgICBAdmFsIG5hbWUsIG8sIG11dGFibGVcblxuICAgICNcbiAgICAjIFdoZXRoZXIgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnICh0cnVlKSBvciAnaW1tdXRhYmxlJyAoZmFsc2UpXG4gICAgI1xuICAgIG11dGFibGVfZGVmYXVsdDpcbiAgICAgIHRydWVcblxuICAgICNcbiAgICAjIFNldCBpZiB0aGUgZGVmYXVsdCBpcyAnbXV0YWJsZScgb3IgJ2ltbXV0YWJsZSdcbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IG11dGFibGUgU2V0IGVpdGhlciAnbXV0YWJsZScgLyB0cnVlIG9yICdpbW11dGFibGUnIC8gZmFsc2VcbiAgICBzZXRNdXRhYmxlRGVmYXVsdDogKG11dGFibGUpLT5cbiAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICBKc29uVHlwZS5wcm90b3R5cGUubXV0YWJsZV9kZWZhdWx0ID0gdHJ1ZVxuICAgICAgZWxzZSBpZiBtdXRhYmxlIGlzIGZhbHNlIG9yIG11dGFibGUgaXMgJ2ltbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciAnU2V0IG11dGFibGUgZWl0aGVyIFwibXV0YWJsZVwiIG9yIFwiaW1tdXRhYmxlXCIhJ1xuICAgICAgJ09LJ1xuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbCgpXG4gICAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICAgIyAgIEByZXR1cm4gW0pzb25dXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAgICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZXxXb3JkfFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCwgbXV0YWJsZSktPlxuICAgICAgaWYgdHlwZW9mIG5hbWUgaXMgJ29iamVjdCdcbiAgICAgICAgIyBTcGVjaWFsIGNhc2UuIEZpcnN0IGFyZ3VtZW50IGlzIGFuIG9iamVjdC4gVGhlbiB0aGUgc2Vjb25kIGFyZyBpcyBtdXRhYmxlLlxuICAgICAgICAjIEtlZXAgdGhhdCBpbiBtaW5kIHdoZW4gcmVhZGluZyB0aGUgZm9sbG93aW5nLi5cbiAgICAgICAgZm9yIG9fbmFtZSxvIG9mIG5hbWVcbiAgICAgICAgICBAdmFsKG9fbmFtZSxvLGNvbnRlbnQpXG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT8gYW5kIGNvbnRlbnQ/XG4gICAgICAgIGlmIG11dGFibGU/XG4gICAgICAgICAgaWYgbXV0YWJsZSBpcyB0cnVlIG9yIG11dGFibGUgaXMgJ211dGFibGUnXG4gICAgICAgICAgICBtdXRhYmxlID0gdHJ1ZVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIG11dGFibGUgPSBmYWxzZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgbXV0YWJsZSA9IEBtdXRhYmxlX2RlZmF1bHRcbiAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ2Z1bmN0aW9uJ1xuICAgICAgICAgIEAgIyBKdXN0IGRvIG5vdGhpbmdcbiAgICAgICAgZWxzZSBpZiAoKG5vdCBtdXRhYmxlKSBvciB0eXBlb2YgY29udGVudCBpcyAnbnVtYmVyJykgYW5kIGNvbnRlbnQuY29uc3RydWN0b3IgaXNudCBPYmplY3RcbiAgICAgICAgICBvYmogPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkltbXV0YWJsZU9iamVjdCB1bmRlZmluZWQsIGNvbnRlbnQpLmV4ZWN1dGUoKVxuICAgICAgICAgIHN1cGVyIG5hbWUsIG9ialxuICAgICAgICBlbHNlXG4gICAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ3N0cmluZydcbiAgICAgICAgICAgIHdvcmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLldvcmQgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCBjb250ZW50XG4gICAgICAgICAgICBzdXBlciBuYW1lLCB3b3JkXG4gICAgICAgICAgZWxzZSBpZiBjb250ZW50LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgICAganNvbiA9IEhCLmFkZE9wZXJhdGlvbihuZXcgSnNvblR5cGUgdW5kZWZpbmVkLCBjb250ZW50LCBtdXRhYmxlKS5leGVjdXRlKClcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIGpzb25cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgc2V0ICN7dHlwZW9mIGNvbnRlbnR9LXR5cGVzIGluIGNvbGxhYm9yYXRpdmUgSnNvbi1vYmplY3RzIVwiXG4gICAgICBlbHNlXG4gICAgICAgIHN1cGVyIG5hbWUsIGNvbnRlbnRcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBKc29uVHlwZS5wcm90b3R5cGUsICd2YWx1ZScsXG4gICAgICBnZXQgOiAtPiBjcmVhdGVKc29uV3JhcHBlciBAXG4gICAgICBzZXQgOiAobyktPlxuICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICBAdmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkpzb25UeXBlXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0pzb25UeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSnNvblR5cGUgdWlkXG5cblxuXG5cbiAgdHlwZXNbJ0pzb25UeXBlJ10gPSBKc29uVHlwZVxuXG4gIHRleHRfdHlwZXNcblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IGJhc2ljX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBNYXBNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uVHlwZXMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGNvbnRlbnQ/XG4gICAgICAgIGlmIG5vdCBAbWFwW25hbWVdP1xuICAgICAgICAgIEhCLmFkZE9wZXJhdGlvbihuZXcgQWRkTmFtZSB1bmRlZmluZWQsIEAsIG5hbWUpLmV4ZWN1dGUoKVxuICAgICAgICBAbWFwW25hbWVdLnJlcGxhY2UgY29udGVudFxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIG9iaiA9IEBtYXBbbmFtZV0/LnZhbCgpXG4gICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgIG9iai52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgb2JqXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQG1hcFxuICAgICAgICAgIG9iaiA9IG8udmFsKClcbiAgICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3Qgb3Igb2JqIGluc3RhbmNlb2YgTWFwTWFuYWdlclxuICAgICAgICAgICAgb2JqID0gb2JqLnZhbCgpXG4gICAgICAgICAgcmVzdWx0W25hbWVdID0gb2JqXG4gICAgICAgIHJlc3VsdFxuXG4gICNcbiAgIyBXaGVuIGEgbmV3IHByb3BlcnR5IGluIGEgbWFwIG1hbmFnZXIgaXMgY3JlYXRlZCwgdGhlbiB0aGUgdWlkcyBvZiB0aGUgaW5zZXJ0ZWQgT3BlcmF0aW9uc1xuICAjIG11c3QgYmUgdW5pcXVlICh0aGluayBhYm91dCBjb25jdXJyZW50IG9wZXJhdGlvbnMpLiBUaGVyZWZvcmUgb25seSBhbiBBZGROYW1lIG9wZXJhdGlvbiBpcyBhbGxvd2VkIHRvXG4gICMgYWRkIGEgcHJvcGVydHkgaW4gYSBNYXBNYW5hZ2VyLiBJZiB0d28gQWRkTmFtZSBvcGVyYXRpb25zIG9uIHRoZSBzYW1lIE1hcE1hbmFnZXIgbmFtZSBoYXBwZW4gY29uY3VycmVudGx5XG4gICMgb25seSBvbmUgd2lsbCBBZGROYW1lIG9wZXJhdGlvbiB3aWxsIGJlIGV4ZWN1dGVkLlxuICAjXG4gIGNsYXNzIEFkZE5hbWUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBtYXBfbWFuYWdlciBVaWQgb3IgcmVmZXJlbmNlIHRvIHRoZSBNYXBNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCB3aWxsIGJlIGFkZGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgbWFwX21hbmFnZXIsIEBuYW1lKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbWFwX21hbmFnZXInLCBtYXBfbWFuYWdlclxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBJZiBtYXBfbWFuYWdlciBkb2Vzbid0IGhhdmUgdGhlIHByb3BlcnR5IG5hbWUsIHRoZW4gYWRkIGl0LlxuICAgICMgVGhlIFJlcGxhY2VNYW5hZ2VyIHRoYXQgaXMgYmVpbmcgd3JpdHRlbiBvbiB0aGUgcHJvcGVydHkgaXMgdW5pcXVlXG4gICAgIyBpbiBzdWNoIGEgd2F5IHRoYXQgaWYgQWRkTmFtZSBpcyBleGVjdXRlZCAoZnJvbSBhbm90aGVyIHBlZXIpIGl0IHdpbGxcbiAgICAjIGFsd2F5cyBoYXZlIHRoZSBzYW1lIHJlc3VsdCAoUmVwbGFjZU1hbmFnZXIsIGFuZCBpdHMgYmVnaW5uaW5nIGFuZCBlbmQgYXJlIHRoZSBzYW1lKVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHVpZF9yID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgIHVpZF9yLm9wX251bWJlciA9IFwiXyN7dWlkX3Iub3BfbnVtYmVyfV9STV8je0BuYW1lfVwiXG4gICAgICAgIGlmIG5vdCBIQi5nZXRPcGVyYXRpb24odWlkX3IpP1xuICAgICAgICAgIHVpZF9iZWcgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfYmVnLm9wX251bWJlciA9IFwiXyN7dWlkX2JlZy5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2JlZ2lubmluZ1wiXG4gICAgICAgICAgdWlkX2VuZCA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICAgIHVpZF9lbmQub3BfbnVtYmVyID0gXCJfI3t1aWRfZW5kLm9wX251bWJlcn1fUk1fI3tAbmFtZX1fZW5kXCJcbiAgICAgICAgICBiZWcgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfYmVnLCB1bmRlZmluZWQsIHVpZF9lbmQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGVuZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgdHlwZXMuRGVsaW1pdGVyIHVpZF9lbmQsIGJlZywgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgICAjYmVnLmV4ZWN1dGUoKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBSZXBsYWNlTWFuYWdlciB1bmRlZmluZWQsIHVpZF9yLCBiZWcsIGVuZCkuZXhlY3V0ZSgpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiQWRkTmFtZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdtYXBfbWFuYWdlcicgOiBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgJ25hbWUnIDogQG5hbWVcbiAgICAgIH1cblxuICBwYXJzZXJbJ0FkZE5hbWUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ21hcF9tYW5hZ2VyJyA6IG1hcF9tYW5hZ2VyXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ25hbWUnIDogbmFtZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IEFkZE5hbWUgdWlkLCBtYXBfbWFuYWdlciwgbmFtZVxuXG4gICNcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIExpc3RNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIGJlZ2lubmluZz8gYW5kIGVuZD9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2JlZ2lubmluZycsIGJlZ2lubmluZ1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnZW5kJywgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIEBiZWdpbm5pbmcgPSBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICAgIEBlbmQgPSAgICAgICBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG5cbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAZW5kLnByZXZfY2xcblxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXG5cbiAgICAjIFRyYW5zZm9ybXMgdGhlIHRoZSBsaXN0IHRvIGFuIGFycmF5XG4gICAgIyBEb2Vzbid0IHJldHVybiBsZWZ0LXJpZ2h0IGRlbGltaXRlci5cbiAgICB0b0FycmF5OiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgcmVzdWx0LnB1c2ggb1xuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIGlmIHBvc2l0aW9uID4gMFxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICAgICAgaWYgcG9zaXRpb24gaXMgMFxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJwb3NpdGlvbiBwYXJhbWV0ZXIgZXhjZWVkZWQgdGhlIGxlbmd0aCBvZiB0aGUgZG9jdW1lbnQhXCJcbiAgICAgIG9cblxuICAjXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFdvcmRcbiAgI1xuICBjbGFzcyBSZXBsYWNlTWFuYWdlciBleHRlbmRzIExpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGluaXRpYWxfY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAgIGlmIGluaXRpYWxfY29udGVudD9cbiAgICAgICAgQHJlcGxhY2UgaW5pdGlhbF9jb250ZW50XG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBvcCA9IG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBALCB1bmRlZmluZWQsIG8sIG8ubmV4dF9jbFxuICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcblxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpcyBXb3JkXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZHRyblwiXG4gICAgICBvLnZhbCgpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlTWFuYWdlclwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAbmV4dF9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlTWFuYWdlclwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgfSA9IGpzb25cbiAgICBuZXcgUmVwbGFjZU1hbmFnZXIgY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuICAjXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBSZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8gYW5kIGNvbnRlbnQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgY29udGVudCwgcHJldiwgYW5kIG5leHQgZm9yIFJlcGxhY2VhYmxlLXR5cGVzIVwiXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyByZXBsYWNlYWJsZSB3aXRoIG5ldyBjb250ZW50LlxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCktPlxuICAgICAgQHBhcmVudC5yZXBsYWNlIGNvbnRlbnRcblxuICAgICNcbiAgICAjIElmIHBvc3NpYmxlIHNldCB0aGUgcmVwbGFjZSBtYW5hZ2VyIGluIHRoZSBjb250ZW50LlxuICAgICMgQHNlZSBXb3JkLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQuc2V0UmVwbGFjZU1hbmFnZXI/KEBwYXJlbnQpXG4gICAgICAgIHN1cGVyXG4gICAgICAgIEBcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VhYmxlXCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50LmdldFVpZCgpXG4gICAgICAgICAgJ1JlcGxhY2VNYW5hZ2VyJyA6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlYWJsZVwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ1JlcGxhY2VNYW5hZ2VyJyA6IHBhcmVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG5cbiAgdHlwZXNbJ0xpc3RNYW5hZ2VyJ10gPSBMaXN0TWFuYWdlclxuICB0eXBlc1snTWFwTWFuYWdlciddID0gTWFwTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZU1hbmFnZXInXSA9IFJlcGxhY2VNYW5hZ2VyXG4gIHR5cGVzWydSZXBsYWNlYWJsZSddID0gUmVwbGFjZWFibGVcblxuICBiYXNpY190eXBlc1xuXG5cblxuXG5cblxuIiwic3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vU3RydWN0dXJlZFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgc3RydWN0dXJlZF90eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gc3RydWN0dXJlZF90eXBlcy5wYXJzZXJcblxuICAjXG4gICMgQXQgdGhlIG1vbWVudCBUZXh0RGVsZXRlIHR5cGUgZXF1YWxzIHRoZSBEZWxldGUgdHlwZSBpbiBCYXNpY1R5cGVzLlxuICAjIEBzZWUgQmFzaWNUeXBlcy5EZWxldGVcbiAgI1xuICBjbGFzcyBUZXh0RGVsZXRlIGV4dGVuZHMgdHlwZXMuRGVsZXRlXG4gIHBhcnNlcltcIlRleHREZWxldGVcIl0gPSBwYXJzZXJbXCJEZWxldGVcIl1cblxuICAjXG4gICMgIEV4dGVuZHMgdGhlIGJhc2ljIEluc2VydCB0eXBlIHRvIGFuIG9wZXJhdGlvbiB0aGF0IGhvbGRzIGEgdGV4dCB2YWx1ZVxuICAjXG4gIGNsYXNzIFRleHRJbnNlcnQgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcbiAgICAjXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gY29udGVudCBUaGUgY29udGVudCBvZiB0aGlzIEluc2VydC10eXBlIE9wZXJhdGlvbi4gVXN1YWxseSB5b3UgcmVzdHJpY3QgdGhlIGxlbmd0aCBvZiBjb250ZW50IHRvIHNpemUgMVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBwcmV2LCBhbmQgbmV4dCBmb3IgVGV4dEluc2VydC10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICAjXG4gICAgIyBUaGUgcmVzdWx0IHdpbGwgYmUgY29uY2F0ZW5hdGVkIHdpdGggdGhlIHJlc3VsdHMgZnJvbSB0aGUgb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnNcbiAgICAjIGluIG9yZGVyIHRvIHJldHJpZXZlIHRoZSBjb250ZW50IG9mIHRoZSBlbmdpbmUuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIudG9FeGVjdXRlZEFycmF5XG4gICAgI1xuICAgIHZhbDogKGN1cnJlbnRfcG9zaXRpb24pLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJUZXh0SW5zZXJ0XCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50XG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiVGV4dEluc2VydFwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgSGFuZGxlcyBhIFRleHQtbGlrZSBkYXRhIHN0cnVjdHVyZXMgd2l0aCBzdXBwb3J0IGZvciBpbnNlcnRUZXh0L2RlbGV0ZVRleHQgYXQgYSB3b3JkLXBvc2l0aW9uLlxuICAjXG4gIGNsYXNzIFdvcmQgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmRcbiAgICAjXG4gICAgaW5zZXJ0VGV4dDogKHBvc2l0aW9uLCBjb250ZW50KS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgIGZvciBjIGluIGNvbnRlbnRcbiAgICAgICAgb3AgPSBuZXcgVGV4dEluc2VydCBjLCB1bmRlZmluZWQsIG8ucHJldl9jbCwgb1xuICAgICAgICBIQi5hZGRPcGVyYXRpb24ob3ApLmV4ZWN1dGUoKVxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgIGRlbGV0ZVRleHQ6IChwb3NpdGlvbiwgbGVuZ3RoKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cblxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGQgPSBIQi5hZGRPcGVyYXRpb24obmV3IFRleHREZWxldGUgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGNhbid0IGRlbGV0ZSBtb3JlIHRoYW4gdGhlcmUgaXMuLlwiXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBkLl9lbmNvZGUoKVxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGlzIHdvcmQgd2l0aCBhbm90aGVyIG9uZS4gQ29uY3VycmVudCByZXBsYWNlbWVudHMgYXJlIG5vdCBtZXJnZWQhXG4gICAgIyBPbmx5IG9uZSBvZiB0aGUgcmVwbGFjZW1lbnRzIHdpbGwgYmUgdXNlZC5cbiAgICAjXG4gICAgIyBDYW4gb25seSBiZSB1c2VkIGlmIHRoZSBSZXBsYWNlTWFuYWdlciB3YXMgc2V0IVxuICAgICMgQHNlZSBXb3JkLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIHJlcGxhY2VUZXh0OiAodGV4dCktPlxuICAgICAgaWYgQHJlcGxhY2VfbWFuYWdlcj9cbiAgICAgICAgd29yZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgV29yZCB1bmRlZmluZWQpLmV4ZWN1dGUoKVxuICAgICAgICB3b3JkLmluc2VydFRleHQgMCwgdGV4dFxuICAgICAgICBAcmVwbGFjZV9tYW5hZ2VyLnJlcGxhY2Uod29yZClcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyB0eXBlIGlzIGN1cnJlbnRseSBub3QgbWFpbnRhaW5lZCBieSBhIFJlcGxhY2VNYW5hZ2VyIVwiXG5cbiAgICAjXG4gICAgIyBAcmV0dXJucyBbSnNvbl0gQSBKc29uIG9iamVjdC5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBjID0gZm9yIG8gaW4gQHRvQXJyYXkoKVxuICAgICAgICBpZiBvLnZhbD9cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBcIlwiXG4gICAgICBjLmpvaW4oJycpXG5cbiAgICAjXG4gICAgIyBJbiBtb3N0IGNhc2VzIHlvdSB3b3VsZCBlbWJlZCBhIFdvcmQgaW4gYSBSZXBsYWNlYWJsZSwgd2ljaCBpcyBoYW5kbGVkIGJ5IHRoZSBSZXBsYWNlTWFuYWdlciBpbiBvcmRlclxuICAgICMgdG8gcHJvdmlkZSByZXBsYWNlIGZ1bmN0aW9uYWxpdHkuXG4gICAgI1xuICAgIHNldFJlcGxhY2VNYW5hZ2VyOiAob3ApLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdyZXBsYWNlX21hbmFnZXInLCBvcFxuICAgICAgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiV29yZFwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyWydXb3JkJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmQgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgdHlwZXNbJ1RleHRJbnNlcnQnXSA9IFRleHRJbnNlcnRcbiAgdHlwZXNbJ1RleHREZWxldGUnXSA9IFRleHREZWxldGVcbiAgdHlwZXNbJ1dvcmQnXSA9IFdvcmRcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiJdfQ==
