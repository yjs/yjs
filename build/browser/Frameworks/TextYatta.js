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
var Engine, HistoryBuffer, TextYatta, text_types_uninitialized;

text_types_uninitialized = require("../Types/TextTypes");

HistoryBuffer = require("../HistoryBuffer");

Engine = require("../Engine");

TextYatta = (function() {
  function TextYatta(user_id, Connector) {
    var beg, beginning, end, first_word, text_types, uid_beg, uid_end, uid_r;
    this.HB = new HistoryBuffer(user_id);
    text_types = text_types_uninitialized(this.HB);
    this.types = text_types.types;
    this.engine = new Engine(this.HB, text_types.parser);
    this.connector = new Connector(this.engine, this.HB, text_types.execution_listener, this);
    beginning = this.HB.addOperation(new this.types.Delimiter({
      creator: '_',
      op_number: '_beginning'
    }, void 0, void 0));
    end = this.HB.addOperation(new this.types.Delimiter({
      creator: '_',
      op_number: '_end'
    }, beginning, void 0));
    beginning.next_cl = end;
    beginning.execute();
    end.execute();
    first_word = new this.types.Word({
      creator: '_',
      op_number: '_'
    }, beginning, end);
    this.HB.addOperation(first_word).execute();
    uid_r = {
      creator: '_',
      op_number: "RM"
    };
    uid_beg = {
      creator: '_',
      op_number: "_RM_beginning"
    };
    uid_end = {
      creator: '_',
      op_number: "_RM_end"
    };
    beg = this.HB.addOperation(new this.types.Delimiter(uid_beg, void 0, uid_end)).execute();
    end = this.HB.addOperation(new this.types.Delimiter(uid_end, beg, void 0)).execute();
    this.root_element = this.HB.addOperation(new this.types.ReplaceManager(void 0, uid_r, beg, end)).execute();
    this.root_element.replace(first_word, {
      creator: '_',
      op_number: 'Replaceable'
    });
  }

  TextYatta.prototype.getSharedObject = function() {
    return this.root_element.val();
  };

  TextYatta.prototype.getEngine = function() {
    return this.engine;
  };

  TextYatta.prototype.getConnector = function() {
    return this.connector;
  };

  TextYatta.prototype.getHistoryBuffer = function() {
    return this.HB;
  };

  TextYatta.prototype.getUserId = function() {
    return this.HB.getUserId();
  };

  TextYatta.prototype.val = function() {
    return this.getSharedObject().val();
  };

  TextYatta.prototype.insertText = function(pos, content) {
    return this.getSharedObject().insertText(pos, content);
  };

  TextYatta.prototype.deleteText = function(pos, length) {
    return this.getSharedObject().deleteText(pos, length);
  };

  TextYatta.prototype.bind = function(textarea) {
    return this.getSharedObject().bind(textarea);
  };

  TextYatta.prototype.replaceText = function(text) {
    return this.getSharedObject().replaceText(text);
  };

  TextYatta.prototype.on = function() {
    var _ref;
    return (_ref = this.root_element).on.apply(_ref, arguments);
  };

  return TextYatta;

})();

module.exports = TextYatta;

if (typeof window !== "undefined" && window !== null) {
  if (window.Y == null) {
    window.Y = {};
  }
  window.Y.TextYatta = TextYatta;
}


},{"../Engine":1,"../HistoryBuffer":3,"../Types/TextTypes":6}],3:[function(require,module,exports){
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


},{"./BasicTypes":4}],6:[function(require,module,exports){
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
      return delete_ops;
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
      this.validateSavedOperations();
      return this.on(['insert', 'delete'], (function(_this) {
        return function() {
          var _ref;
          return (_ref = _this.replace_manager) != null ? _ref.callEvent('change') : void 0;
        };
      })(this));
    };

    Word.prototype.bind = function(textfield) {
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


},{"./StructuredTypes":5}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0ZyYW1ld29ya3MvVGV4dFlhdHRhLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL1R5cGVzL0Jhc2ljVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9UZXh0VHlwZXMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDSUEsSUFBQSxNQUFBOztBQUFBO0FBTWUsRUFBQSxnQkFBRSxFQUFGLEVBQU8sTUFBUCxHQUFBO0FBQ1gsSUFEWSxJQUFDLENBQUEsS0FBQSxFQUNiLENBQUE7QUFBQSxJQURpQixJQUFDLENBQUEsU0FBQSxNQUNsQixDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsZUFBRCxHQUFtQixFQUFuQixDQURXO0VBQUEsQ0FBYjs7QUFBQSxtQkFNQSxjQUFBLEdBQWdCLFNBQUMsSUFBRCxHQUFBO0FBQ2QsUUFBQSxVQUFBO0FBQUEsSUFBQSxVQUFBLEdBQWEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFJLENBQUMsSUFBTCxDQUFyQixDQUFBO0FBQ0EsSUFBQSxJQUFHLGtCQUFIO2FBQ0UsVUFBQSxDQUFXLElBQVgsRUFERjtLQUFBLE1BQUE7QUFHRSxZQUFVLElBQUEsS0FBQSxDQUFPLDBDQUFBLEdBQXlDLElBQUksQ0FBQyxJQUE5QyxHQUFvRCxtQkFBcEQsR0FBc0UsQ0FBQSxJQUFJLENBQUMsU0FBTCxDQUFlLElBQWYsQ0FBQSxDQUF0RSxHQUEyRixHQUFsRyxDQUFWLENBSEY7S0FGYztFQUFBLENBTmhCLENBQUE7O0FBQUEsbUJBaUJBLGNBQUEsR0FBZ0IsU0FBQyxRQUFELEdBQUE7QUFDZCxRQUFBLHNDQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sRUFBTixDQUFBO0FBQ0EsU0FBQSwrQ0FBQTt1QkFBQTtBQUNFLE1BQUEsR0FBRyxDQUFDLElBQUosQ0FBUyxJQUFDLENBQUEsY0FBRCxDQUFnQixDQUFoQixDQUFULENBQUEsQ0FERjtBQUFBLEtBREE7QUFHQSxTQUFBLDRDQUFBO2tCQUFBO0FBQ0UsTUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBaUIsQ0FBakIsQ0FBQSxDQURGO0FBQUEsS0FIQTtBQUtBLFNBQUEsNENBQUE7a0JBQUE7QUFDRSxNQUFBLElBQUcsQ0FBQSxDQUFLLENBQUMsT0FBRixDQUFBLENBQVA7QUFDRSxRQUFBLElBQUMsQ0FBQSxlQUFlLENBQUMsSUFBakIsQ0FBc0IsQ0FBdEIsQ0FBQSxDQURGO09BREY7QUFBQSxLQUxBO1dBUUEsSUFBQyxDQUFBLGNBQUQsQ0FBQSxFQVRjO0VBQUEsQ0FqQmhCLENBQUE7O0FBQUEsbUJBZ0NBLG1CQUFBLEdBQXFCLFNBQUMsUUFBRCxHQUFBO0FBQ25CLFFBQUEscUJBQUE7QUFBQTtTQUFBLCtDQUFBO3VCQUFBO0FBQ0UsTUFBQSxJQUFPLG1DQUFQO3NCQUNFLElBQUMsQ0FBQSxPQUFELENBQVMsQ0FBVCxHQURGO09BQUEsTUFBQTs4QkFBQTtPQURGO0FBQUE7b0JBRG1CO0VBQUEsQ0FoQ3JCLENBQUE7O0FBQUEsbUJBd0NBLFFBQUEsR0FBVSxTQUFDLFFBQUQsR0FBQTtBQUNSLFFBQUEscUJBQUE7QUFBQTtTQUFBLCtDQUFBO3VCQUFBO0FBQ0Usb0JBQUEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxDQUFULEVBQUEsQ0FERjtBQUFBO29CQURRO0VBQUEsQ0F4Q1YsQ0FBQTs7QUFBQSxtQkErQ0EsT0FBQSxHQUFTLFNBQUMsT0FBRCxHQUFBO0FBRVAsUUFBQSxDQUFBO0FBQUEsSUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLGNBQUQsQ0FBZ0IsT0FBaEIsQ0FBSixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBaUIsQ0FBakIsQ0FEQSxDQUFBO0FBR0EsSUFBQSxJQUFHLENBQUEsQ0FBSyxDQUFDLE9BQUYsQ0FBQSxDQUFQO0FBQ0UsTUFBQSxJQUFDLENBQUEsZUFBZSxDQUFDLElBQWpCLENBQXNCLENBQXRCLENBQUEsQ0FERjtLQUFBLE1BQUE7QUFHRSxNQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFpQixDQUFqQixDQUFBLENBSEY7S0FIQTtXQU9BLElBQUMsQ0FBQSxjQUFELENBQUEsRUFUTztFQUFBLENBL0NULENBQUE7O0FBQUEsbUJBOERBLGNBQUEsR0FBZ0IsU0FBQSxHQUFBO0FBQ2QsUUFBQSxxREFBQTtBQUFBO1dBQU0sSUFBTixHQUFBO0FBQ0UsTUFBQSxVQUFBLEdBQWEsSUFBQyxDQUFBLGVBQWUsQ0FBQyxNQUE5QixDQUFBO0FBQUEsTUFDQSxXQUFBLEdBQWMsRUFEZCxDQUFBO0FBRUE7QUFBQSxXQUFBLDJDQUFBO3NCQUFBO0FBQ0UsUUFBQSxJQUFHLENBQUEsRUFBTSxDQUFDLE9BQUgsQ0FBQSxDQUFQO0FBQ0UsVUFBQSxXQUFXLENBQUMsSUFBWixDQUFpQixFQUFqQixDQUFBLENBREY7U0FBQSxNQUFBO0FBR0UsVUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBaUIsRUFBakIsQ0FBQSxDQUhGO1NBREY7QUFBQSxPQUZBO0FBQUEsTUFPQSxJQUFDLENBQUEsZUFBRCxHQUFtQixXQVBuQixDQUFBO0FBUUEsTUFBQSxJQUFHLElBQUMsQ0FBQSxlQUFlLENBQUMsTUFBakIsS0FBMkIsVUFBOUI7QUFDRSxjQURGO09BQUEsTUFBQTs4QkFBQTtPQVRGO0lBQUEsQ0FBQTtvQkFEYztFQUFBLENBOURoQixDQUFBOztnQkFBQTs7SUFORixDQUFBOztBQUFBLE1Bb0ZNLENBQUMsT0FBUCxHQUFpQixNQXBGakIsQ0FBQTs7OztBQ0hBLElBQUEsMERBQUE7O0FBQUEsd0JBQUEsR0FBMkIsT0FBQSxDQUFRLG9CQUFSLENBQTNCLENBQUE7O0FBQUEsYUFDQSxHQUFnQixPQUFBLENBQVEsa0JBQVIsQ0FEaEIsQ0FBQTs7QUFBQSxNQUVBLEdBQVMsT0FBQSxDQUFRLFdBQVIsQ0FGVCxDQUFBOztBQUFBO0FBYWUsRUFBQSxtQkFBQyxPQUFELEVBQVUsU0FBVixHQUFBO0FBQ1gsUUFBQSxvRUFBQTtBQUFBLElBQUEsSUFBQyxDQUFBLEVBQUQsR0FBVSxJQUFBLGFBQUEsQ0FBYyxPQUFkLENBQVYsQ0FBQTtBQUFBLElBQ0EsVUFBQSxHQUFhLHdCQUFBLENBQXlCLElBQUMsQ0FBQSxFQUExQixDQURiLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxLQUFELEdBQVMsVUFBVSxDQUFDLEtBRnBCLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxNQUFELEdBQWMsSUFBQSxNQUFBLENBQU8sSUFBQyxDQUFBLEVBQVIsRUFBWSxVQUFVLENBQUMsTUFBdkIsQ0FIZCxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsU0FBRCxHQUFpQixJQUFBLFNBQUEsQ0FBVSxJQUFDLENBQUEsTUFBWCxFQUFtQixJQUFDLENBQUEsRUFBcEIsRUFBd0IsVUFBVSxDQUFDLGtCQUFuQyxFQUF1RCxJQUF2RCxDQUpqQixDQUFBO0FBQUEsSUFNQSxTQUFBLEdBQVksSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQXFCLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxTQUFQLENBQWlCO0FBQUEsTUFBQyxPQUFBLEVBQVMsR0FBVjtBQUFBLE1BQWUsU0FBQSxFQUFXLFlBQTFCO0tBQWpCLEVBQTJELE1BQTNELEVBQXNFLE1BQXRFLENBQXJCLENBTlosQ0FBQTtBQUFBLElBT0EsR0FBQSxHQUFZLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFxQixJQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsU0FBUCxDQUFpQjtBQUFBLE1BQUMsT0FBQSxFQUFTLEdBQVY7QUFBQSxNQUFlLFNBQUEsRUFBVyxNQUExQjtLQUFqQixFQUEyRCxTQUEzRCxFQUFzRSxNQUF0RSxDQUFyQixDQVBaLENBQUE7QUFBQSxJQVFBLFNBQVMsQ0FBQyxPQUFWLEdBQW9CLEdBUnBCLENBQUE7QUFBQSxJQVNBLFNBQVMsQ0FBQyxPQUFWLENBQUEsQ0FUQSxDQUFBO0FBQUEsSUFVQSxHQUFHLENBQUMsT0FBSixDQUFBLENBVkEsQ0FBQTtBQUFBLElBV0EsVUFBQSxHQUFpQixJQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsSUFBUCxDQUFZO0FBQUEsTUFBQyxPQUFBLEVBQVMsR0FBVjtBQUFBLE1BQWUsU0FBQSxFQUFXLEdBQTFCO0tBQVosRUFBNEMsU0FBNUMsRUFBdUQsR0FBdkQsQ0FYakIsQ0FBQTtBQUFBLElBWUEsSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQWlCLFVBQWpCLENBQTRCLENBQUMsT0FBN0IsQ0FBQSxDQVpBLENBQUE7QUFBQSxJQWNBLEtBQUEsR0FBUTtBQUFBLE1BQUUsT0FBQSxFQUFTLEdBQVg7QUFBQSxNQUFnQixTQUFBLEVBQVcsSUFBM0I7S0FkUixDQUFBO0FBQUEsSUFlQSxPQUFBLEdBQVU7QUFBQSxNQUFFLE9BQUEsRUFBUyxHQUFYO0FBQUEsTUFBZ0IsU0FBQSxFQUFXLGVBQTNCO0tBZlYsQ0FBQTtBQUFBLElBZ0JBLE9BQUEsR0FBVTtBQUFBLE1BQUUsT0FBQSxFQUFTLEdBQVg7QUFBQSxNQUFnQixTQUFBLEVBQVcsU0FBM0I7S0FoQlYsQ0FBQTtBQUFBLElBaUJBLEdBQUEsR0FBTSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBcUIsSUFBQSxJQUFDLENBQUEsS0FBSyxDQUFDLFNBQVAsQ0FBaUIsT0FBakIsRUFBMEIsTUFBMUIsRUFBcUMsT0FBckMsQ0FBckIsQ0FBa0UsQ0FBQyxPQUFuRSxDQUFBLENBakJOLENBQUE7QUFBQSxJQWtCQSxHQUFBLEdBQU0sSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQXFCLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxTQUFQLENBQWlCLE9BQWpCLEVBQTBCLEdBQTFCLEVBQStCLE1BQS9CLENBQXJCLENBQThELENBQUMsT0FBL0QsQ0FBQSxDQWxCTixDQUFBO0FBQUEsSUFtQkEsSUFBQyxDQUFBLFlBQUQsR0FBZ0IsSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQXFCLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxjQUFQLENBQXNCLE1BQXRCLEVBQWlDLEtBQWpDLEVBQXdDLEdBQXhDLEVBQTZDLEdBQTdDLENBQXJCLENBQXNFLENBQUMsT0FBdkUsQ0FBQSxDQW5CaEIsQ0FBQTtBQUFBLElBb0JBLElBQUMsQ0FBQSxZQUFZLENBQUMsT0FBZCxDQUFzQixVQUF0QixFQUFrQztBQUFBLE1BQUUsT0FBQSxFQUFTLEdBQVg7QUFBQSxNQUFnQixTQUFBLEVBQVcsYUFBM0I7S0FBbEMsQ0FwQkEsQ0FEVztFQUFBLENBQWI7O0FBQUEsc0JBMkJBLGVBQUEsR0FBaUIsU0FBQSxHQUFBO1dBQ2YsSUFBQyxDQUFBLFlBQVksQ0FBQyxHQUFkLENBQUEsRUFEZTtFQUFBLENBM0JqQixDQUFBOztBQUFBLHNCQWlDQSxTQUFBLEdBQVcsU0FBQSxHQUFBO1dBQ1QsSUFBQyxDQUFBLE9BRFE7RUFBQSxDQWpDWCxDQUFBOztBQUFBLHNCQXVDQSxZQUFBLEdBQWMsU0FBQSxHQUFBO1dBQ1osSUFBQyxDQUFBLFVBRFc7RUFBQSxDQXZDZCxDQUFBOztBQUFBLHNCQTZDQSxnQkFBQSxHQUFrQixTQUFBLEdBQUE7V0FDaEIsSUFBQyxDQUFBLEdBRGU7RUFBQSxDQTdDbEIsQ0FBQTs7QUFBQSxzQkFxREEsU0FBQSxHQUFXLFNBQUEsR0FBQTtXQUNULElBQUMsQ0FBQSxFQUFFLENBQUMsU0FBSixDQUFBLEVBRFM7RUFBQSxDQXJEWCxDQUFBOztBQUFBLHNCQTJEQSxHQUFBLEdBQUssU0FBQSxHQUFBO1dBQ0gsSUFBQyxDQUFBLGVBQUQsQ0FBQSxDQUFrQixDQUFDLEdBQW5CLENBQUEsRUFERztFQUFBLENBM0RMLENBQUE7O0FBQUEsc0JBaUVBLFVBQUEsR0FBWSxTQUFDLEdBQUQsRUFBTSxPQUFOLEdBQUE7V0FDVixJQUFDLENBQUEsZUFBRCxDQUFBLENBQWtCLENBQUMsVUFBbkIsQ0FBOEIsR0FBOUIsRUFBbUMsT0FBbkMsRUFEVTtFQUFBLENBakVaLENBQUE7O0FBQUEsc0JBdUVBLFVBQUEsR0FBWSxTQUFDLEdBQUQsRUFBTSxNQUFOLEdBQUE7V0FDVixJQUFDLENBQUEsZUFBRCxDQUFBLENBQWtCLENBQUMsVUFBbkIsQ0FBOEIsR0FBOUIsRUFBbUMsTUFBbkMsRUFEVTtFQUFBLENBdkVaLENBQUE7O0FBQUEsc0JBNkVBLElBQUEsR0FBTSxTQUFDLFFBQUQsR0FBQTtXQUNKLElBQUMsQ0FBQSxlQUFELENBQUEsQ0FBa0IsQ0FBQyxJQUFuQixDQUF3QixRQUF4QixFQURJO0VBQUEsQ0E3RU4sQ0FBQTs7QUFBQSxzQkFtRkEsV0FBQSxHQUFhLFNBQUMsSUFBRCxHQUFBO1dBQ1gsSUFBQyxDQUFBLGVBQUQsQ0FBQSxDQUFrQixDQUFDLFdBQW5CLENBQStCLElBQS9CLEVBRFc7RUFBQSxDQW5GYixDQUFBOztBQUFBLHNCQXNGQSxFQUFBLEdBQUksU0FBQSxHQUFBO0FBQ0YsUUFBQSxJQUFBO1dBQUEsUUFBQSxJQUFDLENBQUEsWUFBRCxDQUFhLENBQUMsRUFBZCxhQUFpQixTQUFqQixFQURFO0VBQUEsQ0F0RkosQ0FBQTs7bUJBQUE7O0lBYkYsQ0FBQTs7QUFBQSxNQXVHTSxDQUFDLE9BQVAsR0FBaUIsU0F2R2pCLENBQUE7O0FBd0dBLElBQUcsZ0RBQUg7QUFDRSxFQUFBLElBQU8sZ0JBQVA7QUFDRSxJQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsRUFBWCxDQURGO0dBQUE7QUFBQSxFQUVBLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBVCxHQUFxQixTQUZyQixDQURGO0NBeEdBOzs7O0FDS0EsSUFBQSxhQUFBOztBQUFBO0FBTWUsRUFBQSx1QkFBRSxPQUFGLEdBQUE7QUFDWCxJQURZLElBQUMsQ0FBQSxVQUFBLE9BQ2IsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGlCQUFELEdBQXFCLEVBQXJCLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxNQUFELEdBQVUsRUFEVixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsZ0JBQUQsR0FBb0IsRUFGcEIsQ0FEVztFQUFBLENBQWI7O0FBQUEsMEJBUUEsU0FBQSxHQUFXLFNBQUEsR0FBQTtXQUNULElBQUMsQ0FBQSxRQURRO0VBQUEsQ0FSWCxDQUFBOztBQUFBLDBCQWlCQSwyQkFBQSxHQUE2QixTQUFBLEdBQUE7V0FDM0I7QUFBQSxNQUNFLE9BQUEsRUFBVSxHQURaO0FBQUEsTUFFRSxTQUFBLEVBQVksR0FGZDtNQUQyQjtFQUFBLENBakI3QixDQUFBOztBQUFBLDBCQTBCQSxtQkFBQSxHQUFxQixTQUFBLEdBQUE7QUFDbkIsUUFBQSxvQkFBQTtBQUFBLElBQUEsR0FBQSxHQUFNLEVBQU4sQ0FBQTtBQUNBO0FBQUEsU0FBQSxZQUFBO3VCQUFBO0FBQ0UsTUFBQSxHQUFJLENBQUEsSUFBQSxDQUFKLEdBQVksR0FBWixDQURGO0FBQUEsS0FEQTtXQUdBLElBSm1CO0VBQUEsQ0ExQnJCLENBQUE7O0FBQUEsMEJBbUNBLE9BQUEsR0FBUyxTQUFDLFlBQUQsR0FBQTtBQUNQLFFBQUEsc0VBQUE7O01BRFEsZUFBYTtLQUNyQjtBQUFBLElBQUEsSUFBQSxHQUFPLEVBQVAsQ0FBQTtBQUFBLElBQ0EsT0FBQSxHQUFVLFNBQUMsSUFBRCxFQUFPLFFBQVAsR0FBQTtBQUNSLE1BQUEsSUFBRyxDQUFLLFlBQUwsQ0FBQSxJQUFlLENBQUssZ0JBQUwsQ0FBbEI7QUFDRSxjQUFVLElBQUEsS0FBQSxDQUFNLE1BQU4sQ0FBVixDQURGO09BQUE7YUFFSSw0QkFBSixJQUEyQixZQUFhLENBQUEsSUFBQSxDQUFiLElBQXNCLFNBSHpDO0lBQUEsQ0FEVixDQUFBO0FBTUE7QUFBQSxTQUFBLGNBQUE7MEJBQUE7QUFDRSxXQUFBLGdCQUFBOzJCQUFBO0FBQ0UsUUFBQSxJQUFHLENBQUMsQ0FBQSxLQUFJLENBQU0sUUFBQSxDQUFTLFFBQVQsQ0FBTixDQUFMLENBQUEsSUFBb0MsT0FBQSxDQUFRLE1BQVIsRUFBZ0IsUUFBaEIsQ0FBdkM7QUFDRSxVQUFBLE1BQUEsR0FBUyxDQUFDLENBQUMsT0FBRixDQUFBLENBQVQsQ0FBQTtBQUNBLFVBQUEsSUFBRyxpQkFBSDtBQUNFLFlBQUEsTUFBQSxHQUFTLENBQUMsQ0FBQyxPQUFYLENBQUE7QUFDQSxtQkFBTSx3QkFBQSxJQUFvQixPQUFBLENBQVEsTUFBTSxDQUFDLE9BQWYsRUFBd0IsTUFBTSxDQUFDLFNBQS9CLENBQTFCLEdBQUE7QUFDRSxjQUFBLE1BQUEsR0FBUyxNQUFNLENBQUMsT0FBaEIsQ0FERjtZQUFBLENBREE7QUFBQSxZQUdBLE1BQU0sQ0FBQyxJQUFQLEdBQWMsTUFBTSxDQUFDLE1BQVAsQ0FBQSxDQUhkLENBREY7V0FBQSxNQUtLLElBQUcsaUJBQUg7QUFDSCxZQUFBLE1BQUEsR0FBUyxDQUFDLENBQUMsT0FBWCxDQUFBO0FBQ0EsbUJBQU0sd0JBQUEsSUFBb0IsT0FBQSxDQUFRLE1BQU0sQ0FBQyxPQUFmLEVBQXdCLE1BQU0sQ0FBQyxTQUEvQixDQUExQixHQUFBO0FBQ0UsY0FBQSxNQUFBLEdBQVMsTUFBTSxDQUFDLE9BQWhCLENBREY7WUFBQSxDQURBO0FBQUEsWUFHQSxNQUFNLENBQUMsSUFBUCxHQUFjLE1BQU0sQ0FBQyxNQUFQLENBQUEsQ0FIZCxDQURHO1dBTkw7QUFBQSxVQVdBLElBQUksQ0FBQyxJQUFMLENBQVUsTUFBVixDQVhBLENBREY7U0FERjtBQUFBLE9BREY7QUFBQSxLQU5BO1dBc0JBLEtBdkJPO0VBQUEsQ0FuQ1QsQ0FBQTs7QUFBQSwwQkFpRUEsMEJBQUEsR0FBNEIsU0FBQyxPQUFELEdBQUE7QUFDMUIsUUFBQSxHQUFBO0FBQUEsSUFBQSxJQUFPLGVBQVA7QUFDRSxNQUFBLE9BQUEsR0FBVSxJQUFDLENBQUEsT0FBWCxDQURGO0tBQUE7QUFFQSxJQUFBLElBQU8sdUNBQVA7QUFDRSxNQUFBLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxPQUFBLENBQW5CLEdBQThCLENBQTlCLENBREY7S0FGQTtBQUFBLElBSUEsR0FBQSxHQUNFO0FBQUEsTUFBQSxTQUFBLEVBQVksT0FBWjtBQUFBLE1BQ0EsV0FBQSxFQUFjLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxPQUFBLENBRGpDO0tBTEYsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLGlCQUFrQixDQUFBLE9BQUEsQ0FBbkIsRUFQQSxDQUFBO1dBUUEsSUFUMEI7RUFBQSxDQWpFNUIsQ0FBQTs7QUFBQSwwQkErRUEsWUFBQSxHQUFjLFNBQUMsR0FBRCxHQUFBO0FBQ1osUUFBQSxJQUFBO0FBQUEsSUFBQSxJQUFHLEdBQUEsWUFBZSxNQUFsQjs2REFDd0IsQ0FBQSxHQUFHLENBQUMsU0FBSixXQUR4QjtLQUFBLE1BRUssSUFBTyxXQUFQO0FBQUE7S0FBQSxNQUFBO0FBRUgsWUFBVSxJQUFBLEtBQUEsQ0FBTSxrQ0FBTixDQUFWLENBRkc7S0FITztFQUFBLENBL0VkLENBQUE7O0FBQUEsMEJBeUZBLFlBQUEsR0FBYyxTQUFDLENBQUQsR0FBQTtBQUNaLElBQUEsSUFBTyw4QkFBUDtBQUNFLE1BQUEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxDQUFDLENBQUMsT0FBRixDQUFSLEdBQXFCLEVBQXJCLENBREY7S0FBQTtBQUVBLElBQUEsSUFBRywyQ0FBSDtBQUNFLFlBQVUsSUFBQSxLQUFBLENBQU0sb0NBQU4sQ0FBVixDQURGO0tBRkE7QUFBQSxJQUlBLElBQUMsQ0FBQSxNQUFPLENBQUEsQ0FBQyxDQUFDLE9BQUYsQ0FBVyxDQUFBLENBQUMsQ0FBQyxTQUFGLENBQW5CLEdBQWtDLENBSmxDLENBQUE7V0FLQSxFQU5ZO0VBQUEsQ0F6RmQsQ0FBQTs7QUFBQSwwQkFvR0EsWUFBQSxHQUFjLFNBQUMsQ0FBRCxHQUFBO0FBQ1osSUFBQSxJQUFPLHlDQUFQO0FBQ0UsTUFBQSxJQUFDLENBQUEsaUJBQWtCLENBQUEsQ0FBQyxDQUFDLE9BQUYsQ0FBbkIsR0FBZ0MsQ0FBaEMsQ0FERjtLQUFBO0FBRUEsSUFBQSxJQUFHLE1BQUEsQ0FBQSxDQUFRLENBQUMsU0FBVCxLQUFzQixRQUF0QixJQUFtQyxDQUFDLENBQUMsT0FBRixLQUFlLElBQUMsQ0FBQSxTQUFELENBQUEsQ0FBckQ7YUFDRSxJQUFDLENBQUEsaUJBQWtCLENBQUEsQ0FBQyxDQUFDLE9BQUYsQ0FBbkIsR0FERjtLQUhZO0VBQUEsQ0FwR2QsQ0FBQTs7dUJBQUE7O0lBTkYsQ0FBQTs7QUFBQSxNQW9ITSxDQUFDLE9BQVAsR0FBaUIsYUFwSGpCLENBQUE7Ozs7QUNOQSxJQUFBOztpU0FBQTs7QUFBQSxNQUFNLENBQUMsT0FBUCxHQUFpQixTQUFDLEVBQUQsR0FBQTtBQUVmLE1BQUEsaUZBQUE7QUFBQSxFQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7QUFBQSxFQUNBLGtCQUFBLEdBQXFCLEVBRHJCLENBQUE7QUFBQSxFQWFNO0FBTVMsSUFBQSxtQkFBQyxHQUFELEdBQUE7QUFDWCxNQUFBLElBQU8sV0FBUDtBQUNFLFFBQUEsR0FBQSxHQUFNLEVBQUUsQ0FBQywwQkFBSCxDQUFBLENBQU4sQ0FERjtPQUFBO0FBQUEsTUFHYSxJQUFDLENBQUEsY0FBWixVQURGLEVBRWdCLElBQUMsQ0FBQSxnQkFBZixZQUpGLENBRFc7SUFBQSxDQUFiOztBQUFBLHdCQWFBLEVBQUEsR0FBSSxTQUFDLE1BQUQsRUFBUyxDQUFULEdBQUE7QUFDRixVQUFBLDRCQUFBOztRQUFBLElBQUMsQ0FBQSxrQkFBbUI7T0FBcEI7QUFDQSxNQUFBLElBQUcsTUFBTSxDQUFDLFdBQVAsS0FBd0IsRUFBRSxDQUFDLFdBQTlCO0FBQ0UsUUFBQSxNQUFBLEdBQVMsQ0FBQyxNQUFELENBQVQsQ0FERjtPQURBO0FBR0E7V0FBQSw2Q0FBQTt1QkFBQTs7ZUFDbUIsQ0FBQSxDQUFBLElBQU07U0FBdkI7QUFBQSxzQkFDQSxJQUFDLENBQUEsZUFBZ0IsQ0FBQSxDQUFBLENBQUUsQ0FBQyxJQUFwQixDQUF5QixDQUF6QixFQURBLENBREY7QUFBQTtzQkFKRTtJQUFBLENBYkosQ0FBQTs7QUFBQSx3QkFxQkEsY0FBQSxHQUFnQixTQUFDLE1BQUQsRUFBUyxDQUFULEdBQUE7QUFDZCxVQUFBLDJCQUFBO0FBQUEsTUFBQSxJQUFHLE1BQU0sQ0FBQyxXQUFQLEtBQXdCLEVBQUUsQ0FBQyxXQUE5QjtBQUNFLFFBQUEsTUFBQSxHQUFTLENBQUMsTUFBRCxDQUFULENBREY7T0FBQTtBQUVBO1dBQUEsNkNBQUE7dUJBQUE7QUFDRSxRQUFBLElBQUcsa0VBQUg7d0JBQ0UsSUFBQyxDQUFBLGVBQWdCLENBQUEsQ0FBQSxDQUFqQixHQUFzQixJQUFDLENBQUEsZUFBZ0IsQ0FBQSxDQUFBLENBQUUsQ0FBQyxNQUFwQixDQUEyQixTQUFDLENBQUQsR0FBQTttQkFDL0MsQ0FBQSxLQUFPLEVBRHdDO1VBQUEsQ0FBM0IsR0FEeEI7U0FBQSxNQUFBO2dDQUFBO1NBREY7QUFBQTtzQkFIYztJQUFBLENBckJoQixDQUFBOztBQUFBLHdCQWlDQSxTQUFBLEdBQVcsU0FBQSxHQUFBO2FBQ1QsSUFBQyxDQUFBLFlBQUQsYUFBYyxDQUFBLElBQUcsU0FBQSxhQUFBLFNBQUEsQ0FBQSxDQUFqQixFQURTO0lBQUEsQ0FqQ1gsQ0FBQTs7QUFBQSx3QkF1Q0EsWUFBQSxHQUFjLFNBQUEsR0FBQTtBQUNaLFVBQUEsbURBQUE7QUFBQSxNQURhLG1CQUFJLHNCQUFPLDhEQUN4QixDQUFBO0FBQUEsTUFBQSxJQUFHLHNFQUFIO0FBQ0U7QUFBQTthQUFBLDRDQUFBO3dCQUFBO0FBQ0Usd0JBQUEsQ0FBQyxDQUFDLElBQUYsVUFBTyxDQUFBLEVBQUEsRUFBSSxLQUFPLFNBQUEsYUFBQSxJQUFBLENBQUEsQ0FBbEIsRUFBQSxDQURGO0FBQUE7d0JBREY7T0FEWTtJQUFBLENBdkNkLENBQUE7O0FBQUEsd0JBK0NBLFNBQUEsR0FBVyxTQUFFLE1BQUYsR0FBQTtBQUFVLE1BQVQsSUFBQyxDQUFBLFNBQUEsTUFBUSxDQUFWO0lBQUEsQ0EvQ1gsQ0FBQTs7QUFBQSx3QkFvREEsU0FBQSxHQUFXLFNBQUEsR0FBQTthQUNULElBQUMsQ0FBQSxPQURRO0lBQUEsQ0FwRFgsQ0FBQTs7QUFBQSx3QkEwREEsTUFBQSxHQUFRLFNBQUEsR0FBQTthQUNOO0FBQUEsUUFBRSxTQUFBLEVBQVcsSUFBQyxDQUFBLE9BQWQ7QUFBQSxRQUF1QixXQUFBLEVBQWEsSUFBQyxDQUFBLFNBQXJDO1FBRE07SUFBQSxDQTFEUixDQUFBOztBQUFBLHdCQWlFQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxXQUFBO0FBQUEsTUFBQSxJQUFDLENBQUEsV0FBRCxHQUFlLElBQWYsQ0FBQTtBQUNBLFdBQUEseURBQUE7bUNBQUE7QUFDRSxRQUFBLENBQUEsQ0FBRSxJQUFDLENBQUEsT0FBRCxDQUFBLENBQUYsQ0FBQSxDQURGO0FBQUEsT0FEQTthQUdBLEtBSk87SUFBQSxDQWpFVCxDQUFBOztBQUFBLHdCQXlGQSxhQUFBLEdBQWUsU0FBQyxJQUFELEVBQU8sRUFBUCxHQUFBO0FBT2IsTUFBQSxJQUFHLDBDQUFIO2VBRUUsSUFBRSxDQUFBLElBQUEsQ0FBRixHQUFVLEdBRlo7T0FBQSxNQUdLLElBQUcsVUFBSDs7VUFFSCxJQUFDLENBQUEsWUFBYTtTQUFkO2VBQ0EsSUFBQyxDQUFBLFNBQVUsQ0FBQSxJQUFBLENBQVgsR0FBbUIsR0FIaEI7T0FWUTtJQUFBLENBekZmLENBQUE7O0FBQUEsd0JBK0dBLHVCQUFBLEdBQXlCLFNBQUEsR0FBQTtBQUN2QixVQUFBLCtDQUFBO0FBQUEsTUFBQSxjQUFBLEdBQWlCLEVBQWpCLENBQUE7QUFBQSxNQUNBLE9BQUEsR0FBVSxJQURWLENBQUE7QUFFQTtBQUFBLFdBQUEsWUFBQTs0QkFBQTtBQUNFLFFBQUEsRUFBQSxHQUFLLEVBQUUsQ0FBQyxZQUFILENBQWdCLE1BQWhCLENBQUwsQ0FBQTtBQUNBLFFBQUEsSUFBRyxFQUFIO0FBQ0UsVUFBQSxJQUFFLENBQUEsSUFBQSxDQUFGLEdBQVUsRUFBVixDQURGO1NBQUEsTUFBQTtBQUdFLFVBQUEsY0FBZSxDQUFBLElBQUEsQ0FBZixHQUF1QixNQUF2QixDQUFBO0FBQUEsVUFDQSxPQUFBLEdBQVUsS0FEVixDQUhGO1NBRkY7QUFBQSxPQUZBO0FBQUEsTUFTQSxNQUFBLENBQUEsSUFBUSxDQUFBLFNBVFIsQ0FBQTtBQVVBLE1BQUEsSUFBRyxDQUFBLE9BQUg7QUFDRSxRQUFBLElBQUMsQ0FBQSxTQUFELEdBQWEsY0FBYixDQURGO09BVkE7YUFZQSxRQWJ1QjtJQUFBLENBL0d6QixDQUFBOztxQkFBQTs7TUFuQkYsQ0FBQTtBQUFBLEVBc0pNO0FBTUosNkJBQUEsQ0FBQTs7QUFBYSxJQUFBLGdCQUFDLEdBQUQsRUFBTSxPQUFOLEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQUFBLENBQUE7QUFBQSxNQUNBLHdDQUFNLEdBQU4sQ0FEQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSxxQkFTQSxPQUFBLEdBQVMsU0FBQSxHQUFBO2FBQ1A7QUFBQSxRQUNFLE1BQUEsRUFBUSxRQURWO0FBQUEsUUFFRSxLQUFBLEVBQU8sSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZUO0FBQUEsUUFHRSxTQUFBLEVBQVcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FIYjtRQURPO0lBQUEsQ0FUVCxDQUFBOztBQUFBLHFCQW9CQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsTUFBQSxJQUFHLElBQUMsQ0FBQSx1QkFBRCxDQUFBLENBQUg7QUFDRSxRQUFBLElBQUMsQ0FBQSxPQUFPLENBQUMsV0FBVCxDQUFxQixJQUFyQixDQUFBLENBQUE7ZUFDQSxxQ0FBQSxTQUFBLEVBRkY7T0FBQSxNQUFBO2VBSUUsTUFKRjtPQURPO0lBQUEsQ0FwQlQsQ0FBQTs7a0JBQUE7O0tBTm1CLFVBdEpyQixDQUFBO0FBQUEsRUEwTEEsTUFBTyxDQUFBLFFBQUEsQ0FBUCxHQUFtQixTQUFDLENBQUQsR0FBQTtBQUNqQixRQUFBLGdCQUFBO0FBQUEsSUFDVSxRQUFSLE1BREYsRUFFYSxnQkFBWCxVQUZGLENBQUE7V0FJSSxJQUFBLE1BQUEsQ0FBTyxHQUFQLEVBQVksV0FBWixFQUxhO0VBQUEsQ0ExTG5CLENBQUE7QUFBQSxFQTBNTTtBQVNKLDZCQUFBLENBQUE7O0FBQWEsSUFBQSxnQkFBQyxHQUFELEVBQU0sT0FBTixFQUFlLE9BQWYsRUFBd0IsTUFBeEIsR0FBQTtBQUNYLE1BQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBQUEsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBREEsQ0FBQTtBQUVBLE1BQUEsSUFBRyxjQUFIO0FBQ0UsUUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLFFBQWYsRUFBeUIsTUFBekIsQ0FBQSxDQURGO09BQUEsTUFBQTtBQUdFLFFBQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxRQUFmLEVBQXlCLE9BQXpCLENBQUEsQ0FIRjtPQUZBO0FBQUEsTUFNQSx3Q0FBTSxHQUFOLENBTkEsQ0FEVztJQUFBLENBQWI7O0FBQUEscUJBWUEsV0FBQSxHQUFhLFNBQUMsQ0FBRCxHQUFBOztRQUNYLElBQUMsQ0FBQSxhQUFjO09BQWY7QUFBQSxNQUNBLElBQUMsQ0FBQSxVQUFVLENBQUMsSUFBWixDQUFpQixDQUFqQixDQURBLENBQUE7QUFFQSxNQUFBLElBQUcscUJBQUEsSUFBYSxJQUFDLENBQUEsVUFBVSxDQUFDLE1BQVosS0FBc0IsQ0FBdEM7ZUFFRSxJQUFDLENBQUEsTUFBTSxDQUFDLFNBQVIsQ0FBa0IsUUFBbEIsRUFBNEIsSUFBNUIsRUFGRjtPQUhXO0lBQUEsQ0FaYixDQUFBOztBQUFBLHFCQXNCQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1QsVUFBQSxJQUFBO3FEQUFXLENBQUUsZ0JBQWIsR0FBc0IsRUFEYjtJQUFBLENBdEJYLENBQUE7O0FBQUEscUJBNkJBLG1CQUFBLEdBQXFCLFNBQUEsR0FBQTtBQUNuQixVQUFBLElBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxDQUFKLENBQUE7QUFBQSxNQUNBLENBQUEsR0FBSSxJQUFDLENBQUEsT0FETCxDQUFBO0FBRUEsYUFBTSxJQUFOLEdBQUE7QUFDRSxRQUFBLElBQUcsSUFBQyxDQUFBLE1BQUQsS0FBVyxDQUFkO0FBQ0UsZ0JBREY7U0FBQTtBQUFBLFFBRUEsQ0FBQSxFQUZBLENBQUE7QUFJQSxRQUFBLElBQUcsSUFBQSxLQUFLLElBQUMsQ0FBQSxPQUFUO0FBQ0UsZ0JBQVUsSUFBQSxLQUFBLENBQU0sNEJBQU4sQ0FBVixDQURGO1NBSkE7QUFBQSxRQU1BLENBQUEsR0FBSSxDQUFDLENBQUMsT0FOTixDQURGO01BQUEsQ0FGQTthQVVBLEVBWG1CO0lBQUEsQ0E3QnJCLENBQUE7O0FBQUEscUJBOENBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVCxVQUFBLENBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsT0FBTCxDQUFBO0FBQUEsTUFDQSxDQUFBO0FBQUEsUUFBQSxNQUFBLEVBQVEsU0FBQyxPQUFELEVBQVMsT0FBVCxHQUFBO0FBQ04sY0FBQSxRQUFBO0FBQUE7aUJBQU0sSUFBTixHQUFBO0FBQ0UsWUFBQSxJQUFHLENBQUMsQ0FBQyxTQUFGLENBQUEsQ0FBSDs0QkFDRSxDQUFBLEdBQUksQ0FBRSxDQUFBLE9BQUEsR0FEUjthQUFBLE1BQUE7QUFHRSxjQUFBLElBQUUsQ0FBQSxPQUFBLENBQUYsR0FBYSxDQUFiLENBQUE7QUFFQSxvQkFMRjthQURGO1VBQUEsQ0FBQTswQkFETTtRQUFBLENBQVI7T0FBQSxDQURBLENBQUE7QUFBQSxNQVNBLE1BQUEsQ0FBTyxTQUFQLEVBQWtCLFNBQWxCLENBVEEsQ0FBQTthQVVBLE1BQUEsQ0FBTyxTQUFQLEVBQWtCLFNBQWxCLEVBWFM7SUFBQSxDQTlDWCxDQUFBOztBQUFBLHFCQWlFQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxvREFBQTtBQUFBLE1BQUEsSUFBRyx3QkFBSDtBQUNFLGVBQU8sSUFBUCxDQURGO09BQUE7QUFFQSxNQUFBLElBQUcsQ0FBQSxJQUFLLENBQUEsdUJBQUQsQ0FBQSxDQUFQO0FBQ0UsZUFBTyxLQUFQLENBREY7T0FBQSxNQUFBO0FBR0UsUUFBQSx5Q0FBVyxDQUFFLHVCQUFWLENBQUEsV0FBQSwyQ0FBZ0QsQ0FBRSx1QkFBVixDQUFBLFdBQXhDLElBQWdGLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxLQUFzQixJQUF6RztBQUNFLFVBQUEsa0JBQUEsR0FBcUIsQ0FBckIsQ0FBQTtBQUFBLFVBQ0EsQ0FBQSxHQUFJLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FEYixDQUFBO0FBQUEsVUFFQSxDQUFBLEdBQUksQ0FGSixDQUFBO0FBZUEsaUJBQU0sSUFBTixHQUFBO0FBQ0UsWUFBQSxJQUFPLFNBQVA7QUFFRSxjQUFBLE9BQU8sQ0FBQyxHQUFSLENBQVksSUFBSSxDQUFDLFNBQUwsQ0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFmLENBQVosQ0FBQSxDQUFBO0FBQUEsY0FDQSxPQUFPLENBQUMsR0FBUixDQUFZLElBQUksQ0FBQyxTQUFMLENBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQUFaLENBREEsQ0FGRjthQUFBO0FBSUEsWUFBQSxJQUFHLENBQUEsS0FBTyxJQUFDLENBQUEsT0FBWDtBQUVFLGNBQUEsSUFBRyxDQUFDLENBQUMsbUJBQUYsQ0FBQSxDQUFBLEtBQTJCLENBQTlCO0FBRUUsZ0JBQUEsSUFBRyxDQUFDLENBQUMsT0FBRixHQUFZLElBQUMsQ0FBQSxPQUFoQjtBQUNFLGtCQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsQ0FBWCxDQUFBO0FBQUEsa0JBQ0Esa0JBQUEsR0FBcUIsQ0FBQSxHQUFJLENBRHpCLENBREY7aUJBQUEsTUFBQTtBQUFBO2lCQUZGO2VBQUEsTUFPSyxJQUFHLENBQUMsQ0FBQyxtQkFBRixDQUFBLENBQUEsR0FBMEIsQ0FBN0I7QUFFSCxnQkFBQSxJQUFHLENBQUEsR0FBSSxrQkFBSixJQUEwQixDQUFDLENBQUMsbUJBQUYsQ0FBQSxDQUE3QjtBQUNFLGtCQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsQ0FBWCxDQUFBO0FBQUEsa0JBQ0Esa0JBQUEsR0FBcUIsQ0FBQSxHQUFJLENBRHpCLENBREY7aUJBQUEsTUFBQTtBQUFBO2lCQUZHO2VBQUEsTUFBQTtBQVNILHNCQVRHO2VBUEw7QUFBQSxjQWlCQSxDQUFBLEVBakJBLENBQUE7QUFBQSxjQWtCQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BbEJOLENBRkY7YUFBQSxNQUFBO0FBdUJFLG9CQXZCRjthQUxGO1VBQUEsQ0FmQTtBQUFBLFVBNkNBLElBQUMsQ0FBQSxPQUFELEdBQVcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQTdDcEIsQ0FBQTtBQUFBLFVBOENBLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxHQUFtQixJQTlDbkIsQ0FBQTtBQUFBLFVBK0NBLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxHQUFtQixJQS9DbkIsQ0FERjtTQUFBO0FBQUEsUUFpREEsTUFBQSx5Q0FBaUIsQ0FBRSxTQUFWLENBQUEsVUFqRFQsQ0FBQTtBQWtEQSxRQUFBLElBQUcsY0FBSDtBQUNFLFVBQUEsSUFBQyxDQUFBLFNBQUQsQ0FBVyxNQUFYLENBQUEsQ0FBQTtBQUFBLFVBQ0EsSUFBQyxDQUFBLE1BQU0sQ0FBQyxTQUFSLENBQWtCLFFBQWxCLEVBQTRCLElBQTVCLENBREEsQ0FERjtTQWxEQTtlQXFEQSxxQ0FBQSxTQUFBLEVBeERGO09BSE87SUFBQSxDQWpFVCxDQUFBOztBQUFBLHFCQWlJQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1gsVUFBQSxjQUFBO0FBQUEsTUFBQSxRQUFBLEdBQVcsQ0FBWCxDQUFBO0FBQUEsTUFDQSxJQUFBLEdBQU8sSUFBQyxDQUFBLE9BRFIsQ0FBQTtBQUVBLGFBQU0sSUFBTixHQUFBO0FBQ0UsUUFBQSxJQUFHLElBQUEsWUFBZ0IsU0FBbkI7QUFDRSxnQkFERjtTQUFBO0FBRUEsUUFBQSxJQUFHLHdCQUFBLElBQW9CLENBQUEsSUFBUSxDQUFDLFNBQUwsQ0FBQSxDQUEzQjtBQUNFLFVBQUEsUUFBQSxFQUFBLENBREY7U0FGQTtBQUFBLFFBSUEsSUFBQSxHQUFPLElBQUksQ0FBQyxPQUpaLENBREY7TUFBQSxDQUZBO2FBUUEsU0FUVztJQUFBLENBakliLENBQUE7O2tCQUFBOztLQVRtQixVQTFNckIsQ0FBQTtBQUFBLEVBaVdNO0FBTUosc0NBQUEsQ0FBQTs7QUFBYSxJQUFBLHlCQUFDLEdBQUQsRUFBTyxPQUFQLEVBQWdCLElBQWhCLEVBQXNCLElBQXRCLEVBQTRCLE1BQTVCLEdBQUE7QUFDWCxNQURpQixJQUFDLENBQUEsVUFBQSxPQUNsQixDQUFBO0FBQUEsTUFBQSxpREFBTSxHQUFOLEVBQVcsSUFBWCxFQUFpQixJQUFqQixFQUF1QixNQUF2QixDQUFBLENBRFc7SUFBQSxDQUFiOztBQUFBLDhCQU1BLEdBQUEsR0FBTSxTQUFBLEdBQUE7YUFDSixJQUFDLENBQUEsUUFERztJQUFBLENBTk4sQ0FBQTs7QUFBQSw4QkFZQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFBLEdBQU87QUFBQSxRQUNMLE1BQUEsRUFBUSxpQkFESDtBQUFBLFFBRUwsS0FBQSxFQUFRLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FGSDtBQUFBLFFBR0wsU0FBQSxFQUFZLElBQUMsQ0FBQSxPQUhSO09BQVAsQ0FBQTtBQUtBLE1BQUEsSUFBRyxvQkFBSDtBQUNFLFFBQUEsSUFBSyxDQUFBLE1BQUEsQ0FBTCxHQUFlLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBQWYsQ0FERjtPQUxBO0FBT0EsTUFBQSxJQUFHLG9CQUFIO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQURGO09BUEE7QUFTQSxNQUFBLElBQUcscUJBQUEsSUFBYSxJQUFDLENBQUEsTUFBRCxLQUFhLElBQUMsQ0FBQSxPQUE5QjtBQUNFLFFBQUEsSUFBSyxDQUFBLFFBQUEsQ0FBTCxHQUFpQixJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUFqQixDQURGO09BVEE7YUFXQSxLQVpPO0lBQUEsQ0FaVCxDQUFBOzsyQkFBQTs7S0FONEIsT0FqVzlCLENBQUE7QUFBQSxFQWlZQSxNQUFPLENBQUEsaUJBQUEsQ0FBUCxHQUE0QixTQUFDLElBQUQsR0FBQTtBQUMxQixRQUFBLGdDQUFBO0FBQUEsSUFDVSxXQUFSLE1BREYsRUFFYyxlQUFaLFVBRkYsRUFHVSxZQUFSLE9BSEYsRUFJVSxZQUFSLE9BSkYsRUFLYSxjQUFYLFNBTEYsQ0FBQTtXQU9JLElBQUEsZUFBQSxDQUFnQixHQUFoQixFQUFxQixPQUFyQixFQUE4QixJQUE5QixFQUFvQyxJQUFwQyxFQUEwQyxNQUExQyxFQVJzQjtFQUFBLENBalk1QixDQUFBO0FBQUEsRUFnWk07QUFRSixnQ0FBQSxDQUFBOztBQUFhLElBQUEsbUJBQUMsR0FBRCxFQUFNLE9BQU4sRUFBZSxPQUFmLEVBQXdCLE1BQXhCLEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQURBLENBQUE7QUFBQSxNQUVBLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixPQUF6QixDQUZBLENBQUE7QUFBQSxNQUdBLDJDQUFNLEdBQU4sQ0FIQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSx3QkFTQSxTQUFBLEdBQVcsU0FBQSxHQUFBO2FBQ1QsTUFEUztJQUFBLENBVFgsQ0FBQTs7QUFBQSx3QkFlQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxXQUFBO0FBQUEsTUFBQSxJQUFHLG9FQUFIO2VBQ0Usd0NBQUEsU0FBQSxFQURGO09BQUEsTUFFSyw0Q0FBZSxDQUFBLFNBQUEsVUFBZjtBQUNILFFBQUEsSUFBRyxJQUFDLENBQUEsdUJBQUQsQ0FBQSxDQUFIO0FBQ0UsVUFBQSxJQUFHLDRCQUFIO0FBQ0Usa0JBQVUsSUFBQSxLQUFBLENBQU0sZ0NBQU4sQ0FBVixDQURGO1dBQUE7QUFBQSxVQUVBLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxHQUFtQixJQUZuQixDQUFBO0FBQUEsVUFHQSxNQUFBLENBQUEsSUFBUSxDQUFBLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FIMUIsQ0FBQTtpQkFJQSx3Q0FBQSxTQUFBLEVBTEY7U0FBQSxNQUFBO2lCQU9FLE1BUEY7U0FERztPQUFBLE1BU0EsSUFBRyxzQkFBQSxJQUFrQiw4QkFBckI7QUFDSCxRQUFBLE1BQUEsQ0FBQSxJQUFRLENBQUEsT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUExQixDQUFBO2VBQ0EsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLEtBRmhCO09BQUEsTUFHQSxJQUFHLHNCQUFBLElBQWEsc0JBQWhCO2VBQ0gsd0NBQUEsU0FBQSxFQURHO09BQUEsTUFBQTtBQUdILGNBQVUsSUFBQSxLQUFBLENBQU0sb0NBQU4sQ0FBVixDQUhHO09BZkU7SUFBQSxDQWZULENBQUE7O0FBQUEsd0JBc0NBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLFdBQUE7YUFBQTtBQUFBLFFBQ0UsTUFBQSxFQUFTLFdBRFg7QUFBQSxRQUVFLEtBQUEsRUFBUSxJQUFDLENBQUEsTUFBRCxDQUFBLENBRlY7QUFBQSxRQUdFLE1BQUEsc0NBQWlCLENBQUUsTUFBVixDQUFBLFVBSFg7QUFBQSxRQUlFLE1BQUEsd0NBQWlCLENBQUUsTUFBVixDQUFBLFVBSlg7UUFETztJQUFBLENBdENULENBQUE7O3FCQUFBOztLQVJzQixVQWhaeEIsQ0FBQTtBQUFBLEVBc2NBLE1BQU8sQ0FBQSxXQUFBLENBQVAsR0FBc0IsU0FBQyxJQUFELEdBQUE7QUFDcEIsUUFBQSxlQUFBO0FBQUEsSUFDUSxXQUFSLE1BREEsRUFFUyxZQUFULE9BRkEsRUFHUyxZQUFULE9BSEEsQ0FBQTtXQUtJLElBQUEsU0FBQSxDQUFVLEdBQVYsRUFBZSxJQUFmLEVBQXFCLElBQXJCLEVBTmdCO0VBQUEsQ0F0Y3RCLENBQUE7U0ErY0E7QUFBQSxJQUNFLE9BQUEsRUFDRTtBQUFBLE1BQUEsUUFBQSxFQUFXLE1BQVg7QUFBQSxNQUNBLFFBQUEsRUFBVyxNQURYO0FBQUEsTUFFQSxXQUFBLEVBQWEsU0FGYjtBQUFBLE1BR0EsV0FBQSxFQUFhLFNBSGI7QUFBQSxNQUlBLGlCQUFBLEVBQW9CLGVBSnBCO0tBRko7QUFBQSxJQU9FLFFBQUEsRUFBVyxNQVBiO0FBQUEsSUFRRSxvQkFBQSxFQUF1QixrQkFSekI7SUFqZGU7QUFBQSxDQUFqQixDQUFBOzs7O0FDQUEsSUFBQSx5QkFBQTtFQUFBO2lTQUFBOztBQUFBLHlCQUFBLEdBQTRCLE9BQUEsQ0FBUSxjQUFSLENBQTVCLENBQUE7O0FBQUEsTUFFTSxDQUFDLE9BQVAsR0FBaUIsU0FBQyxFQUFELEdBQUE7QUFDZixNQUFBLHlGQUFBO0FBQUEsRUFBQSxXQUFBLEdBQWMseUJBQUEsQ0FBMEIsRUFBMUIsQ0FBZCxDQUFBO0FBQUEsRUFDQSxLQUFBLEdBQVEsV0FBVyxDQUFDLEtBRHBCLENBQUE7QUFBQSxFQUVBLE1BQUEsR0FBUyxXQUFXLENBQUMsTUFGckIsQ0FBQTtBQUFBLEVBT007QUFLSixpQ0FBQSxDQUFBOztBQUFhLElBQUEsb0JBQUMsR0FBRCxHQUFBO0FBQ1gsTUFBQSxJQUFDLENBQUEsR0FBRCxHQUFPLEVBQVAsQ0FBQTtBQUFBLE1BQ0EsNENBQU0sR0FBTixDQURBLENBRFc7SUFBQSxDQUFiOztBQUFBLHlCQU9BLEdBQUEsR0FBSyxTQUFDLElBQUQsRUFBTyxPQUFQLEdBQUE7QUFDSCxVQUFBLDJCQUFBO0FBQUEsTUFBQSxJQUFHLGVBQUg7QUFDRSxRQUFBLElBQU8sc0JBQVA7QUFDRSxVQUFBLEVBQUUsQ0FBQyxZQUFILENBQW9CLElBQUEsT0FBQSxDQUFRLE1BQVIsRUFBbUIsSUFBbkIsRUFBc0IsSUFBdEIsQ0FBcEIsQ0FBK0MsQ0FBQyxPQUFoRCxDQUFBLENBQUEsQ0FERjtTQUFBO0FBQUEsUUFFQSxJQUFDLENBQUEsR0FBSSxDQUFBLElBQUEsQ0FBSyxDQUFDLE9BQVgsQ0FBbUIsT0FBbkIsQ0FGQSxDQUFBO2VBR0EsS0FKRjtPQUFBLE1BS0ssSUFBRyxZQUFIO0FBQ0gsUUFBQSxHQUFBLHlDQUFnQixDQUFFLEdBQVosQ0FBQSxVQUFOLENBQUE7QUFDQSxRQUFBLElBQUcsR0FBQSxZQUFlLEtBQUssQ0FBQyxlQUF4QjtpQkFDRSxHQUFHLENBQUMsR0FBSixDQUFBLEVBREY7U0FBQSxNQUFBO2lCQUdFLElBSEY7U0FGRztPQUFBLE1BQUE7QUFPSCxRQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7QUFDQTtBQUFBLGFBQUEsYUFBQTswQkFBQTtBQUNFLFVBQUEsR0FBQSxHQUFNLENBQUMsQ0FBQyxHQUFGLENBQUEsQ0FBTixDQUFBO0FBQ0EsVUFBQSxJQUFHLEdBQUEsWUFBZSxLQUFLLENBQUMsZUFBckIsSUFBd0MsR0FBQSxZQUFlLFVBQTFEO0FBQ0UsWUFBQSxHQUFBLEdBQU0sR0FBRyxDQUFDLEdBQUosQ0FBQSxDQUFOLENBREY7V0FEQTtBQUFBLFVBR0EsTUFBTyxDQUFBLElBQUEsQ0FBUCxHQUFlLEdBSGYsQ0FERjtBQUFBLFNBREE7ZUFNQSxPQWJHO09BTkY7SUFBQSxDQVBMLENBQUE7O3NCQUFBOztLQUx1QixLQUFLLENBQUMsVUFQL0IsQ0FBQTtBQUFBLEVBOENNO0FBT0osOEJBQUEsQ0FBQTs7QUFBYSxJQUFBLGlCQUFDLEdBQUQsRUFBTSxXQUFOLEVBQW9CLElBQXBCLEdBQUE7QUFDWCxNQUQ4QixJQUFDLENBQUEsT0FBQSxJQUMvQixDQUFBO0FBQUEsTUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLGFBQWYsRUFBOEIsV0FBOUIsQ0FBQSxDQUFBO0FBQUEsTUFDQSx5Q0FBTSxHQUFOLENBREEsQ0FEVztJQUFBLENBQWI7O0FBQUEsc0JBVUEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLFVBQUEsaUNBQUE7QUFBQSxNQUFBLElBQUcsQ0FBQSxJQUFLLENBQUEsdUJBQUQsQ0FBQSxDQUFQO0FBQ0UsZUFBTyxLQUFQLENBREY7T0FBQSxNQUFBO0FBR0UsUUFBQSxLQUFBLEdBQVEsSUFBQyxDQUFBLFdBQVcsQ0FBQyxNQUFiLENBQUEsQ0FBUixDQUFBO0FBQUEsUUFDQSxLQUFLLENBQUMsU0FBTixHQUFtQixHQUFBLEdBQUUsS0FBSyxDQUFDLFNBQVIsR0FBbUIsTUFBbkIsR0FBd0IsSUFBQyxDQUFBLElBRDVDLENBQUE7QUFFQSxRQUFBLElBQU8sOEJBQVA7QUFDRSxVQUFBLE9BQUEsR0FBVSxJQUFDLENBQUEsV0FBVyxDQUFDLE1BQWIsQ0FBQSxDQUFWLENBQUE7QUFBQSxVQUNBLE9BQU8sQ0FBQyxTQUFSLEdBQXFCLEdBQUEsR0FBRSxPQUFPLENBQUMsU0FBVixHQUFxQixNQUFyQixHQUEwQixJQUFDLENBQUEsSUFBM0IsR0FBaUMsWUFEdEQsQ0FBQTtBQUFBLFVBRUEsT0FBQSxHQUFVLElBQUMsQ0FBQSxXQUFXLENBQUMsTUFBYixDQUFBLENBRlYsQ0FBQTtBQUFBLFVBR0EsT0FBTyxDQUFDLFNBQVIsR0FBcUIsR0FBQSxHQUFFLE9BQU8sQ0FBQyxTQUFWLEdBQXFCLE1BQXJCLEdBQTBCLElBQUMsQ0FBQSxJQUEzQixHQUFpQyxNQUh0RCxDQUFBO0FBQUEsVUFJQSxHQUFBLEdBQU0sRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxLQUFLLENBQUMsU0FBTixDQUFnQixPQUFoQixFQUF5QixNQUF6QixFQUFvQyxPQUFwQyxDQUFwQixDQUFnRSxDQUFDLE9BQWpFLENBQUEsQ0FKTixDQUFBO0FBQUEsVUFLQSxHQUFBLEdBQU0sRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxLQUFLLENBQUMsU0FBTixDQUFnQixPQUFoQixFQUF5QixHQUF6QixFQUE4QixNQUE5QixDQUFwQixDQUE0RCxDQUFDLE9BQTdELENBQUEsQ0FMTixDQUFBO0FBQUEsVUFNQSxJQUFDLENBQUEsV0FBVyxDQUFDLEdBQUksQ0FBQSxJQUFDLENBQUEsSUFBRCxDQUFqQixHQUEwQixFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLGNBQUEsQ0FBZSxNQUFmLEVBQTBCLEtBQTFCLEVBQWlDLEdBQWpDLEVBQXNDLEdBQXRDLENBQXBCLENBTjFCLENBQUE7QUFBQSxVQU9BLElBQUMsQ0FBQSxXQUFXLENBQUMsR0FBSSxDQUFBLElBQUMsQ0FBQSxJQUFELENBQU0sQ0FBQyxTQUF4QixDQUFrQyxJQUFDLENBQUEsV0FBbkMsRUFBZ0QsSUFBQyxDQUFBLElBQWpELENBUEEsQ0FBQTtBQUFBLFVBUUEsSUFBQyxDQUFBLFdBQVcsQ0FBQyxHQUFJLENBQUEsSUFBQyxDQUFBLElBQUQsQ0FBTSxDQUFDLE9BQXhCLENBQUEsQ0FSQSxDQURGO1NBRkE7ZUFZQSxzQ0FBQSxTQUFBLEVBZkY7T0FETztJQUFBLENBVlQsQ0FBQTs7QUFBQSxzQkErQkEsT0FBQSxHQUFTLFNBQUEsR0FBQTthQUNQO0FBQUEsUUFDRSxNQUFBLEVBQVMsU0FEWDtBQUFBLFFBRUUsS0FBQSxFQUFRLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FGVjtBQUFBLFFBR0UsYUFBQSxFQUFnQixJQUFDLENBQUEsV0FBVyxDQUFDLE1BQWIsQ0FBQSxDQUhsQjtBQUFBLFFBSUUsTUFBQSxFQUFTLElBQUMsQ0FBQSxJQUpaO1FBRE87SUFBQSxDQS9CVCxDQUFBOzttQkFBQTs7S0FQb0IsS0FBSyxDQUFDLFVBOUM1QixDQUFBO0FBQUEsRUE0RkEsTUFBTyxDQUFBLFNBQUEsQ0FBUCxHQUFvQixTQUFDLElBQUQsR0FBQTtBQUNsQixRQUFBLHNCQUFBO0FBQUEsSUFDa0IsbUJBQWhCLGNBREYsRUFFVSxXQUFSLE1BRkYsRUFHVyxZQUFULE9BSEYsQ0FBQTtXQUtJLElBQUEsT0FBQSxDQUFRLEdBQVIsRUFBYSxXQUFiLEVBQTBCLElBQTFCLEVBTmM7RUFBQSxDQTVGcEIsQ0FBQTtBQUFBLEVBdUdNO0FBT0osa0NBQUEsQ0FBQTs7QUFBYSxJQUFBLHFCQUFDLEdBQUQsRUFBTSxTQUFOLEVBQWlCLEdBQWpCLEVBQXNCLElBQXRCLEVBQTRCLElBQTVCLEVBQWtDLE1BQWxDLEdBQUE7QUFDWCxNQUFBLElBQUcsbUJBQUEsSUFBZSxhQUFsQjtBQUNFLFFBQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxXQUFmLEVBQTRCLFNBQTVCLENBQUEsQ0FBQTtBQUFBLFFBQ0EsSUFBQyxDQUFBLGFBQUQsQ0FBZSxLQUFmLEVBQXNCLEdBQXRCLENBREEsQ0FERjtPQUFBLE1BQUE7QUFJRSxRQUFBLElBQUMsQ0FBQSxTQUFELEdBQWEsRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxLQUFLLENBQUMsU0FBTixDQUFnQixNQUFoQixFQUEyQixNQUEzQixFQUFzQyxNQUF0QyxDQUFwQixDQUFiLENBQUE7QUFBQSxRQUNBLElBQUMsQ0FBQSxHQUFELEdBQWEsRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxLQUFLLENBQUMsU0FBTixDQUFnQixNQUFoQixFQUEyQixJQUFDLENBQUEsU0FBNUIsRUFBdUMsTUFBdkMsQ0FBcEIsQ0FEYixDQUFBO0FBQUEsUUFFQSxJQUFDLENBQUEsU0FBUyxDQUFDLE9BQVgsR0FBcUIsSUFBQyxDQUFBLEdBRnRCLENBQUE7QUFBQSxRQUdBLElBQUMsQ0FBQSxTQUFTLENBQUMsT0FBWCxDQUFBLENBSEEsQ0FBQTtBQUFBLFFBSUEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxPQUFMLENBQUEsQ0FKQSxDQUpGO09BQUE7QUFBQSxNQVNBLDZDQUFNLEdBQU4sRUFBVyxJQUFYLEVBQWlCLElBQWpCLEVBQXVCLE1BQXZCLENBVEEsQ0FEVztJQUFBLENBQWI7O0FBQUEsMEJBWUEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLE1BQUEsSUFBRyxJQUFDLENBQUEsdUJBQUQsQ0FBQSxDQUFIO0FBQ0UsUUFBQSxJQUFDLENBQUEsU0FBUyxDQUFDLFNBQVgsQ0FBcUIsSUFBckIsQ0FBQSxDQUFBO0FBQUEsUUFDQSxJQUFDLENBQUEsR0FBRyxDQUFDLFNBQUwsQ0FBZSxJQUFmLENBREEsQ0FBQTtlQUVBLDBDQUFBLFNBQUEsRUFIRjtPQUFBLE1BQUE7ZUFLRSxNQUxGO09BRE87SUFBQSxDQVpULENBQUE7O0FBQUEsMEJBcUJBLGdCQUFBLEdBQWtCLFNBQUEsR0FBQTthQUNoQixJQUFDLENBQUEsR0FBRyxDQUFDLFFBRFc7SUFBQSxDQXJCbEIsQ0FBQTs7QUFBQSwwQkF5QkEsaUJBQUEsR0FBbUIsU0FBQSxHQUFBO2FBQ2pCLElBQUMsQ0FBQSxTQUFTLENBQUMsUUFETTtJQUFBLENBekJuQixDQUFBOztBQUFBLDBCQThCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxTQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLFNBQVMsQ0FBQyxPQUFmLENBQUE7QUFBQSxNQUNBLE1BQUEsR0FBUyxFQURULENBQUE7QUFFQSxhQUFNLENBQUEsS0FBTyxJQUFDLENBQUEsR0FBZCxHQUFBO0FBQ0UsUUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLENBQVosQ0FBQSxDQUFBO0FBQUEsUUFDQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BRE4sQ0FERjtNQUFBLENBRkE7YUFLQSxPQU5PO0lBQUEsQ0E5QlQsQ0FBQTs7QUFBQSwwQkF5Q0Esc0JBQUEsR0FBd0IsU0FBQyxRQUFELEdBQUE7QUFDdEIsVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLFNBQVMsQ0FBQyxPQUFmLENBQUE7QUFDQSxNQUFBLElBQUcsQ0FBQyxRQUFBLEdBQVcsQ0FBWCxJQUFnQixDQUFDLENBQUMsU0FBRixDQUFBLENBQWpCLENBQUEsSUFBb0MsQ0FBQSxDQUFLLENBQUEsWUFBYSxLQUFLLENBQUMsU0FBcEIsQ0FBM0M7QUFDRSxlQUFNLENBQUMsQ0FBQyxTQUFGLENBQUEsQ0FBQSxJQUFrQixDQUFBLENBQUssQ0FBQSxZQUFhLEtBQUssQ0FBQyxTQUFwQixDQUE1QixHQUFBO0FBRUUsVUFBQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BQU4sQ0FGRjtRQUFBLENBQUE7QUFHQSxlQUFNLElBQU4sR0FBQTtBQUVFLFVBQUEsSUFBRyxDQUFBLFlBQWEsS0FBSyxDQUFDLFNBQXRCO0FBQ0Usa0JBREY7V0FBQTtBQUVBLFVBQUEsSUFBRyxRQUFBLElBQVksQ0FBWixJQUFrQixDQUFBLENBQUssQ0FBQyxTQUFGLENBQUEsQ0FBekI7QUFDRSxrQkFERjtXQUZBO0FBQUEsVUFJQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BSk4sQ0FBQTtBQUtBLFVBQUEsSUFBRyxDQUFBLENBQUssQ0FBQyxTQUFGLENBQUEsQ0FBUDtBQUNFLFlBQUEsUUFBQSxJQUFZLENBQVosQ0FERjtXQVBGO1FBQUEsQ0FKRjtPQURBO2FBY0EsRUFmc0I7SUFBQSxDQXpDeEIsQ0FBQTs7dUJBQUE7O0tBUHdCLEtBQUssQ0FBQyxPQXZHaEMsQ0FBQTtBQUFBLEVBK0tNO0FBTUoscUNBQUEsQ0FBQTs7QUFBYSxJQUFBLHdCQUFDLGVBQUQsRUFBa0IsR0FBbEIsRUFBdUIsU0FBdkIsRUFBa0MsR0FBbEMsRUFBdUMsSUFBdkMsRUFBNkMsSUFBN0MsRUFBbUQsTUFBbkQsR0FBQTtBQUNYLE1BQUEsZ0RBQU0sR0FBTixFQUFXLFNBQVgsRUFBc0IsR0FBdEIsRUFBMkIsSUFBM0IsRUFBaUMsSUFBakMsRUFBdUMsTUFBdkMsQ0FBQSxDQUFBO0FBQ0EsTUFBQSxJQUFHLHVCQUFIO0FBQ0UsUUFBQSxJQUFDLENBQUEsT0FBRCxDQUFTLGVBQVQsQ0FBQSxDQURGO09BRlc7SUFBQSxDQUFiOztBQUFBLDZCQVdBLE9BQUEsR0FBUyxTQUFDLE9BQUQsRUFBVSxlQUFWLEdBQUE7QUFDUCxVQUFBLEtBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUFKLENBQUE7QUFBQSxNQUNBLEVBQUEsR0FBUyxJQUFBLFdBQUEsQ0FBWSxPQUFaLEVBQXFCLElBQXJCLEVBQXdCLGVBQXhCLEVBQXlDLENBQXpDLEVBQTRDLENBQUMsQ0FBQyxPQUE5QyxDQURULENBQUE7YUFFQSxFQUFFLENBQUMsWUFBSCxDQUFnQixFQUFoQixDQUFtQixDQUFDLE9BQXBCLENBQUEsRUFITztJQUFBLENBWFQsQ0FBQTs7QUFBQSw2QkFtQkEsU0FBQSxHQUFXLFNBQUMsTUFBRCxFQUFTLGFBQVQsR0FBQTtBQUNULFVBQUEsbUJBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxFQUFELENBQUksUUFBSixFQUFjLENBQUEsU0FBQSxLQUFBLEdBQUE7ZUFBQSxTQUFDLEtBQUQsRUFBUSxFQUFSLEdBQUE7QUFDWixVQUFBLElBQUcsRUFBRSxDQUFDLE9BQUgsWUFBc0IsS0FBSyxDQUFDLFNBQS9CO21CQUNFLEtBQUMsQ0FBQSxNQUFNLENBQUMsU0FBUixDQUFrQixRQUFsQixFQUE0QixhQUE1QixFQURGO1dBRFk7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFkLENBQUEsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLEVBQUQsQ0FBSSxRQUFKLEVBQWMsQ0FBQSxTQUFBLEtBQUEsR0FBQTtlQUFBLFNBQUMsS0FBRCxHQUFBO2lCQUNaLEtBQUMsQ0FBQSxNQUFNLENBQUMsU0FBUixDQUFrQixRQUFsQixFQUE0QixhQUE1QixFQURZO1FBQUEsRUFBQTtNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBZCxDQUhBLENBQUE7QUFBQSxNQU1BLG1CQUFBLEdBQXNCLENBQUEsU0FBQSxLQUFBLEdBQUE7ZUFBQSxTQUFDLEtBQUQsRUFBUSxFQUFSLEdBQUE7QUFDcEIsVUFBQSxJQUFHLEVBQUUsQ0FBQyxPQUFILFlBQXNCLEtBQUssQ0FBQyxTQUE1QixJQUEwQyxFQUFFLENBQUMsT0FBSCxZQUFzQixLQUFLLENBQUMsU0FBekU7QUFDRSxZQUFBLEtBQUMsQ0FBQSxNQUFNLENBQUMsU0FBUixDQUFrQixhQUFsQixFQUFpQyxhQUFqQyxDQUFBLENBREY7V0FBQTtpQkFFQSxLQUFDLENBQUEsY0FBRCxDQUFnQixhQUFoQixFQUErQixtQkFBL0IsRUFIb0I7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQU50QixDQUFBO0FBQUEsTUFVQSxJQUFDLENBQUEsRUFBRCxDQUFJLFFBQUosRUFBYyxtQkFBZCxDQVZBLENBQUE7YUFXQSw4Q0FBTSxNQUFOLEVBWlM7SUFBQSxDQW5CWCxDQUFBOztBQUFBLDZCQW9DQSxHQUFBLEdBQUssU0FBQSxHQUFBO0FBQ0gsVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLGdCQUFELENBQUEsQ0FBSixDQUFBOzJDQUdBLENBQUMsQ0FBQyxlQUpDO0lBQUEsQ0FwQ0wsQ0FBQTs7QUFBQSw2QkE2Q0EsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLFVBQUEsSUFBQTtBQUFBLE1BQUEsSUFBQSxHQUNFO0FBQUEsUUFDRSxNQUFBLEVBQVEsZ0JBRFY7QUFBQSxRQUVFLEtBQUEsRUFBUSxJQUFDLENBQUEsTUFBRCxDQUFBLENBRlY7QUFBQSxRQUdFLFdBQUEsRUFBYyxJQUFDLENBQUEsU0FBUyxDQUFDLE1BQVgsQ0FBQSxDQUhoQjtBQUFBLFFBSUUsS0FBQSxFQUFRLElBQUMsQ0FBQSxHQUFHLENBQUMsTUFBTCxDQUFBLENBSlY7T0FERixDQUFBO0FBT0EsTUFBQSxJQUFHLHNCQUFBLElBQWMsc0JBQWpCO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQUFBO0FBQUEsUUFDQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FEZixDQURGO09BUEE7QUFVQSxNQUFBLElBQUcscUJBQUEsSUFBYSxJQUFDLENBQUEsTUFBRCxLQUFhLElBQUMsQ0FBQSxPQUE5QjtBQUNFLFFBQUEsSUFBSyxDQUFBLFFBQUEsQ0FBTCxHQUFpQixJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUFqQixDQURGO09BVkE7YUFZQSxLQWJPO0lBQUEsQ0E3Q1QsQ0FBQTs7MEJBQUE7O0tBTjJCLFlBL0s3QixDQUFBO0FBQUEsRUFpUEEsTUFBTyxDQUFBLGdCQUFBLENBQVAsR0FBMkIsU0FBQyxJQUFELEdBQUE7QUFDekIsUUFBQSxnREFBQTtBQUFBLElBQ2MsZUFBWixVQURGLEVBRVUsV0FBUixNQUZGLEVBR1UsWUFBUixPQUhGLEVBSVUsWUFBUixPQUpGLEVBS2EsY0FBWCxTQUxGLEVBTWdCLGlCQUFkLFlBTkYsRUFPVSxXQUFSLE1BUEYsQ0FBQTtXQVNJLElBQUEsY0FBQSxDQUFlLE9BQWYsRUFBd0IsR0FBeEIsRUFBNkIsU0FBN0IsRUFBd0MsR0FBeEMsRUFBNkMsSUFBN0MsRUFBbUQsSUFBbkQsRUFBeUQsTUFBekQsRUFWcUI7RUFBQSxDQWpQM0IsQ0FBQTtBQUFBLEVBa1FNO0FBT0osa0NBQUEsQ0FBQTs7QUFBYSxJQUFBLHFCQUFDLE9BQUQsRUFBVSxNQUFWLEVBQWtCLEdBQWxCLEVBQXVCLElBQXZCLEVBQTZCLElBQTdCLEVBQW1DLE1BQW5DLEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixNQUF6QixDQURBLENBQUE7QUFFQSxNQUFBLElBQUcsQ0FBQSxDQUFLLGNBQUEsSUFBVSxjQUFWLElBQW9CLGlCQUFyQixDQUFQO0FBQ0UsY0FBVSxJQUFBLEtBQUEsQ0FBTSxnRUFBTixDQUFWLENBREY7T0FGQTtBQUFBLE1BSUEsNkNBQU0sR0FBTixFQUFXLElBQVgsRUFBaUIsSUFBakIsRUFBdUIsTUFBdkIsQ0FKQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSwwQkFVQSxHQUFBLEdBQUssU0FBQSxHQUFBO2FBQ0gsSUFBQyxDQUFBLFFBREU7SUFBQSxDQVZMLENBQUE7O0FBQUEsMEJBZ0JBLE9BQUEsR0FBUyxTQUFDLE9BQUQsR0FBQTthQUNQLElBQUMsQ0FBQSxNQUFNLENBQUMsT0FBUixDQUFnQixPQUFoQixFQURPO0lBQUEsQ0FoQlQsQ0FBQTs7QUFBQSwwQkF1QkEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLFVBQUEsS0FBQTtBQUFBLE1BQUEsSUFBRyxDQUFBLElBQUssQ0FBQSx1QkFBRCxDQUFBLENBQVA7QUFDRSxlQUFPLEtBQVAsQ0FERjtPQUFBLE1BQUE7O2VBR1UsQ0FBQyxrQkFBbUIsSUFBQyxDQUFBO1NBQTdCO2VBQ0EsMENBQUEsU0FBQSxFQUpGO09BRE87SUFBQSxDQXZCVCxDQUFBOztBQUFBLDBCQWlDQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFBLEdBQ0U7QUFBQSxRQUNFLE1BQUEsRUFBUSxhQURWO0FBQUEsUUFFRSxTQUFBLEVBQVcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FGYjtBQUFBLFFBR0UsZ0JBQUEsRUFBbUIsSUFBQyxDQUFBLE1BQU0sQ0FBQyxNQUFSLENBQUEsQ0FIckI7QUFBQSxRQUlFLE1BQUEsRUFBUSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUpWO0FBQUEsUUFLRSxNQUFBLEVBQVEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FMVjtBQUFBLFFBTUUsS0FBQSxFQUFRLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FOVjtPQURGLENBQUE7QUFTQSxNQUFBLElBQUcscUJBQUEsSUFBYSxJQUFDLENBQUEsTUFBRCxLQUFhLElBQUMsQ0FBQSxPQUE5QjtBQUNFLFFBQUEsSUFBSyxDQUFBLFFBQUEsQ0FBTCxHQUFpQixJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUFqQixDQURGO09BVEE7YUFXQSxLQVpPO0lBQUEsQ0FqQ1QsQ0FBQTs7dUJBQUE7O0tBUHdCLEtBQUssQ0FBQyxPQWxRaEMsQ0FBQTtBQUFBLEVBd1RBLE1BQU8sQ0FBQSxhQUFBLENBQVAsR0FBd0IsU0FBQyxJQUFELEdBQUE7QUFDdEIsUUFBQSx3Q0FBQTtBQUFBLElBQ2MsZUFBWixVQURGLEVBRXFCLGNBQW5CLGlCQUZGLEVBR1UsV0FBUixNQUhGLEVBSVUsWUFBUixPQUpGLEVBS1UsWUFBUixPQUxGLEVBTWEsY0FBWCxTQU5GLENBQUE7V0FRSSxJQUFBLFdBQUEsQ0FBWSxPQUFaLEVBQXFCLE1BQXJCLEVBQTZCLEdBQTdCLEVBQWtDLElBQWxDLEVBQXdDLElBQXhDLEVBQThDLE1BQTlDLEVBVGtCO0VBQUEsQ0F4VHhCLENBQUE7QUFBQSxFQXFVQSxLQUFNLENBQUEsYUFBQSxDQUFOLEdBQXVCLFdBclV2QixDQUFBO0FBQUEsRUFzVUEsS0FBTSxDQUFBLFlBQUEsQ0FBTixHQUFzQixVQXRVdEIsQ0FBQTtBQUFBLEVBdVVBLEtBQU0sQ0FBQSxnQkFBQSxDQUFOLEdBQTBCLGNBdlUxQixDQUFBO0FBQUEsRUF3VUEsS0FBTSxDQUFBLGFBQUEsQ0FBTixHQUF1QixXQXhVdkIsQ0FBQTtTQTBVQSxZQTNVZTtBQUFBLENBRmpCLENBQUE7Ozs7QUNBQSxJQUFBLDhCQUFBO0VBQUE7aVNBQUE7O0FBQUEsOEJBQUEsR0FBaUMsT0FBQSxDQUFRLG1CQUFSLENBQWpDLENBQUE7O0FBQUEsTUFFTSxDQUFDLE9BQVAsR0FBaUIsU0FBQyxFQUFELEdBQUE7QUFDZixNQUFBLDZEQUFBO0FBQUEsRUFBQSxnQkFBQSxHQUFtQiw4QkFBQSxDQUErQixFQUEvQixDQUFuQixDQUFBO0FBQUEsRUFDQSxLQUFBLEdBQVEsZ0JBQWdCLENBQUMsS0FEekIsQ0FBQTtBQUFBLEVBRUEsTUFBQSxHQUFTLGdCQUFnQixDQUFDLE1BRjFCLENBQUE7QUFBQSxFQVFNO0FBQU4saUNBQUEsQ0FBQTs7OztLQUFBOztzQkFBQTs7S0FBeUIsS0FBSyxDQUFDLE9BUi9CLENBQUE7QUFBQSxFQVNBLE1BQU8sQ0FBQSxZQUFBLENBQVAsR0FBdUIsTUFBTyxDQUFBLFFBQUEsQ0FUOUIsQ0FBQTtBQUFBLEVBY007QUFLSixpQ0FBQSxDQUFBOztBQUFhLElBQUEsb0JBQUUsT0FBRixFQUFXLEdBQVgsRUFBZ0IsSUFBaEIsRUFBc0IsSUFBdEIsRUFBNEIsTUFBNUIsR0FBQTtBQUNYLE1BRFksSUFBQyxDQUFBLFVBQUEsT0FDYixDQUFBO0FBQUEsTUFBQSxJQUFHLENBQUEsQ0FBSyxjQUFBLElBQVUsY0FBWCxDQUFQO0FBQ0UsY0FBVSxJQUFBLEtBQUEsQ0FBTSxzREFBTixDQUFWLENBREY7T0FBQTtBQUFBLE1BRUEsNENBQU0sR0FBTixFQUFXLElBQVgsRUFBaUIsSUFBakIsRUFBdUIsTUFBdkIsQ0FGQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSx5QkFPQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1QsTUFBQSxJQUFHLElBQUMsQ0FBQSxTQUFELENBQUEsQ0FBSDtlQUNFLEVBREY7T0FBQSxNQUFBO2VBR0UsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUhYO09BRFM7SUFBQSxDQVBYLENBQUE7O0FBQUEseUJBa0JBLEdBQUEsR0FBSyxTQUFDLGdCQUFELEdBQUE7QUFDSCxNQUFBLElBQUcsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUFIO2VBQ0UsR0FERjtPQUFBLE1BQUE7ZUFHRSxJQUFDLENBQUEsUUFISDtPQURHO0lBQUEsQ0FsQkwsQ0FBQTs7QUFBQSx5QkE0QkEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLFVBQUEsSUFBQTtBQUFBLE1BQUEsSUFBQSxHQUNFO0FBQUEsUUFDRSxNQUFBLEVBQVEsWUFEVjtBQUFBLFFBRUUsU0FBQSxFQUFXLElBQUMsQ0FBQSxPQUZkO0FBQUEsUUFHRSxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUhWO0FBQUEsUUFJRSxNQUFBLEVBQVEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FKVjtBQUFBLFFBS0UsTUFBQSxFQUFRLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBTFY7T0FERixDQUFBO0FBUUEsTUFBQSxJQUFHLHFCQUFBLElBQWEsSUFBQyxDQUFBLE1BQUQsS0FBYSxJQUFDLENBQUEsT0FBOUI7QUFDRSxRQUFBLElBQUssQ0FBQSxRQUFBLENBQUwsR0FBaUIsSUFBQyxDQUFBLE1BQU0sQ0FBQyxNQUFSLENBQUEsQ0FBakIsQ0FERjtPQVJBO2FBVUEsS0FYTztJQUFBLENBNUJULENBQUE7O3NCQUFBOztLQUx1QixLQUFLLENBQUMsT0FkL0IsQ0FBQTtBQUFBLEVBNERBLE1BQU8sQ0FBQSxZQUFBLENBQVAsR0FBdUIsU0FBQyxJQUFELEdBQUE7QUFDckIsUUFBQSxnQ0FBQTtBQUFBLElBQ2MsZUFBWixVQURGLEVBRVUsV0FBUixNQUZGLEVBR1UsWUFBUixPQUhGLEVBSVUsWUFBUixPQUpGLEVBS2EsY0FBWCxTQUxGLENBQUE7V0FPSSxJQUFBLFVBQUEsQ0FBVyxPQUFYLEVBQW9CLEdBQXBCLEVBQXlCLElBQXpCLEVBQStCLElBQS9CLEVBQXFDLE1BQXJDLEVBUmlCO0VBQUEsQ0E1RHZCLENBQUE7QUFBQSxFQXlFTTtBQUtKLDJCQUFBLENBQUE7O0FBQWEsSUFBQSxjQUFDLEdBQUQsRUFBTSxTQUFOLEVBQWlCLEdBQWpCLEVBQXNCLElBQXRCLEVBQTRCLElBQTVCLEVBQWtDLE1BQWxDLEdBQUE7QUFDWCxNQUFBLHNDQUFNLEdBQU4sRUFBVyxTQUFYLEVBQXNCLEdBQXRCLEVBQTJCLElBQTNCLEVBQWlDLElBQWpDLEVBQXVDLE1BQXZDLENBQUEsQ0FEVztJQUFBLENBQWI7O0FBQUEsbUJBTUEsVUFBQSxHQUFZLFNBQUMsUUFBRCxFQUFXLE9BQVgsR0FBQTtBQUNWLFVBQUEsNEJBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsc0JBQUQsQ0FBd0IsUUFBeEIsQ0FBSixDQUFBO0FBQ0E7V0FBQSw4Q0FBQTt3QkFBQTtBQUNFLFFBQUEsRUFBQSxHQUFTLElBQUEsVUFBQSxDQUFXLENBQVgsRUFBYyxNQUFkLEVBQXlCLENBQUMsQ0FBQyxPQUEzQixFQUFvQyxDQUFwQyxDQUFULENBQUE7QUFBQSxzQkFDQSxFQUFFLENBQUMsWUFBSCxDQUFnQixFQUFoQixDQUFtQixDQUFDLE9BQXBCLENBQUEsRUFEQSxDQURGO0FBQUE7c0JBRlU7SUFBQSxDQU5aLENBQUE7O0FBQUEsbUJBZUEsVUFBQSxHQUFZLFNBQUMsUUFBRCxFQUFXLE1BQVgsR0FBQTtBQUNWLFVBQUEsdUJBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsc0JBQUQsQ0FBd0IsUUFBeEIsQ0FBSixDQUFBO0FBQUEsTUFFQSxVQUFBLEdBQWEsRUFGYixDQUFBO0FBR0EsV0FBUyxrRkFBVCxHQUFBO0FBQ0UsUUFBQSxJQUFHLENBQUEsWUFBYSxLQUFLLENBQUMsU0FBdEI7QUFDRSxnQkFERjtTQUFBO0FBQUEsUUFFQSxDQUFBLEdBQUksRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxVQUFBLENBQVcsTUFBWCxFQUFzQixDQUF0QixDQUFwQixDQUE0QyxDQUFDLE9BQTdDLENBQUEsQ0FGSixDQUFBO0FBQUEsUUFHQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BSE4sQ0FBQTtBQUlBLGVBQU0sQ0FBQSxDQUFLLENBQUEsWUFBYSxLQUFLLENBQUMsU0FBcEIsQ0FBSixJQUF1QyxDQUFDLENBQUMsU0FBRixDQUFBLENBQTdDLEdBQUE7QUFDRSxVQUFBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FBTixDQURGO1FBQUEsQ0FKQTtBQUFBLFFBTUEsVUFBVSxDQUFDLElBQVgsQ0FBZ0IsQ0FBQyxDQUFDLE9BQUYsQ0FBQSxDQUFoQixDQU5BLENBREY7QUFBQSxPQUhBO2FBV0EsV0FaVTtJQUFBLENBZlosQ0FBQTs7QUFBQSxtQkFvQ0EsV0FBQSxHQUFhLFNBQUMsSUFBRCxHQUFBO0FBQ1gsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFHLDRCQUFIO0FBQ0UsUUFBQSxJQUFBLEdBQU8sRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxJQUFBLENBQUssTUFBTCxDQUFwQixDQUFtQyxDQUFDLE9BQXBDLENBQUEsQ0FBUCxDQUFBO0FBQUEsUUFDQSxJQUFJLENBQUMsVUFBTCxDQUFnQixDQUFoQixFQUFtQixJQUFuQixDQURBLENBQUE7ZUFFQSxJQUFDLENBQUEsZUFBZSxDQUFDLE9BQWpCLENBQXlCLElBQXpCLEVBSEY7T0FBQSxNQUFBO0FBS0UsY0FBVSxJQUFBLEtBQUEsQ0FBTSw0REFBTixDQUFWLENBTEY7T0FEVztJQUFBLENBcENiLENBQUE7O0FBQUEsbUJBK0NBLEdBQUEsR0FBSyxTQUFBLEdBQUE7QUFDSCxVQUFBLElBQUE7QUFBQSxNQUFBLENBQUE7O0FBQUk7QUFBQTthQUFBLDJDQUFBO3VCQUFBO0FBQ0YsVUFBQSxJQUFHLGFBQUg7MEJBQ0UsQ0FBQyxDQUFDLEdBQUYsQ0FBQSxHQURGO1dBQUEsTUFBQTswQkFHRSxJQUhGO1dBREU7QUFBQTs7bUJBQUosQ0FBQTthQUtBLENBQUMsQ0FBQyxJQUFGLENBQU8sRUFBUCxFQU5HO0lBQUEsQ0EvQ0wsQ0FBQTs7QUFBQSxtQkEyREEsaUJBQUEsR0FBbUIsU0FBQyxFQUFELEdBQUE7QUFDakIsTUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLGlCQUFmLEVBQWtDLEVBQWxDLENBQUEsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLHVCQUFELENBQUEsQ0FEQSxDQUFBO2FBRUEsSUFBQyxDQUFBLEVBQUQsQ0FBSSxDQUFDLFFBQUQsRUFBVyxRQUFYLENBQUosRUFBMEIsQ0FBQSxTQUFBLEtBQUEsR0FBQTtlQUFBLFNBQUEsR0FBQTtBQUN4QixjQUFBLElBQUE7OERBQWdCLENBQUUsU0FBbEIsQ0FBNEIsUUFBNUIsV0FEd0I7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUExQixFQUhpQjtJQUFBLENBM0RuQixDQUFBOztBQUFBLG1CQW9FQSxJQUFBLEdBQU0sU0FBQyxTQUFELEdBQUE7QUFDSixVQUFBLElBQUE7QUFBQSxNQUFBLElBQUEsR0FBTyxJQUFQLENBQUE7QUFBQSxNQUNBLFNBQVMsQ0FBQyxLQUFWLEdBQWtCLElBQUMsQ0FBQSxHQUFELENBQUEsQ0FEbEIsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLEVBQUQsQ0FBSSxRQUFKLEVBQWMsU0FBQyxLQUFELEVBQVEsRUFBUixHQUFBO0FBQ1osWUFBQSx1QkFBQTtBQUFBLFFBQUEsS0FBQSxHQUFRLEVBQUUsQ0FBQyxXQUFILENBQUEsQ0FBUixDQUFBO0FBQUEsUUFDQSxHQUFBLEdBQU0sU0FBQyxNQUFELEdBQUE7QUFDSixVQUFBLElBQUcsTUFBQSxJQUFVLEtBQWI7bUJBQ0UsT0FERjtXQUFBLE1BQUE7QUFHRSxZQUFBLE1BQUEsSUFBVSxDQUFWLENBQUE7bUJBQ0EsT0FKRjtXQURJO1FBQUEsQ0FETixDQUFBO0FBQUEsUUFPQSxJQUFBLEdBQU8sR0FBQSxDQUFJLFNBQVMsQ0FBQyxjQUFkLENBUFAsQ0FBQTtBQUFBLFFBUUEsS0FBQSxHQUFRLEdBQUEsQ0FBSSxTQUFTLENBQUMsWUFBZCxDQVJSLENBQUE7QUFBQSxRQVVBLFNBQVMsQ0FBQyxLQUFWLEdBQWtCLElBQUksQ0FBQyxHQUFMLENBQUEsQ0FWbEIsQ0FBQTtlQVdBLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixJQUE1QixFQUFrQyxLQUFsQyxFQVpZO01BQUEsQ0FBZCxDQUhBLENBQUE7QUFBQSxNQWtCQSxJQUFDLENBQUEsRUFBRCxDQUFJLFFBQUosRUFBYyxTQUFDLEtBQUQsRUFBUSxFQUFSLEdBQUE7QUFDWixZQUFBLHVCQUFBO0FBQUEsUUFBQSxLQUFBLEdBQVEsRUFBRSxDQUFDLFdBQUgsQ0FBQSxDQUFSLENBQUE7QUFBQSxRQUNBLEdBQUEsR0FBTSxTQUFDLE1BQUQsR0FBQTtBQUNKLFVBQUEsSUFBRyxNQUFBLEdBQVMsS0FBWjttQkFDRSxPQURGO1dBQUEsTUFBQTtBQUdFLFlBQUEsTUFBQSxJQUFVLENBQVYsQ0FBQTttQkFDQSxPQUpGO1dBREk7UUFBQSxDQUROLENBQUE7QUFBQSxRQU9BLElBQUEsR0FBTyxHQUFBLENBQUksU0FBUyxDQUFDLGNBQWQsQ0FQUCxDQUFBO0FBQUEsUUFRQSxLQUFBLEdBQVEsR0FBQSxDQUFJLFNBQVMsQ0FBQyxZQUFkLENBUlIsQ0FBQTtBQUFBLFFBVUEsU0FBUyxDQUFDLEtBQVYsR0FBa0IsSUFBSSxDQUFDLEdBQUwsQ0FBQSxDQVZsQixDQUFBO2VBV0EsU0FBUyxDQUFDLGlCQUFWLENBQTRCLElBQTVCLEVBQWtDLEtBQWxDLEVBWlk7TUFBQSxDQUFkLENBbEJBLENBQUE7QUFBQSxNQWlDQSxTQUFTLENBQUMsVUFBVixHQUF1QixTQUFDLEtBQUQsR0FBQTtBQUNyQixZQUFBLHdCQUFBO0FBQUEsUUFBQSxJQUFBLEdBQU8sSUFBUCxDQUFBO0FBQ0EsUUFBQSxJQUFHLGlCQUFIO0FBQ0UsVUFBQSxJQUFHLEtBQUssQ0FBQyxRQUFOLEtBQWtCLEVBQXJCO0FBQ0UsWUFBQSxJQUFBLEdBQU8sR0FBUCxDQURGO1dBQUEsTUFFSyxJQUFHLEtBQUssQ0FBQyxPQUFOLEtBQWlCLEVBQXBCO0FBQ0gsWUFBQSxJQUFBLEdBQU8sSUFBUCxDQURHO1dBQUEsTUFBQTtBQUdILFlBQUEsSUFBQSxHQUFPLEtBQUssQ0FBQyxHQUFiLENBSEc7V0FIUDtTQUFBLE1BQUE7QUFRRSxVQUFBLElBQUEsR0FBTyxNQUFNLENBQUMsWUFBUCxDQUFvQixLQUFLLENBQUMsT0FBMUIsQ0FBUCxDQVJGO1NBREE7QUFVQSxRQUFBLElBQUcsSUFBSSxDQUFDLE1BQUwsR0FBYyxDQUFqQjtBQUNFLFVBQUEsR0FBQSxHQUFNLElBQUksQ0FBQyxHQUFMLENBQVMsU0FBUyxDQUFDLGNBQW5CLEVBQW1DLFNBQVMsQ0FBQyxZQUE3QyxDQUFOLENBQUE7QUFBQSxVQUNBLElBQUEsR0FBTyxJQUFJLENBQUMsR0FBTCxDQUFTLFNBQVMsQ0FBQyxZQUFWLEdBQXlCLFNBQVMsQ0FBQyxjQUE1QyxDQURQLENBQUE7QUFBQSxVQUVBLElBQUksQ0FBQyxVQUFMLENBQWlCLEdBQWpCLEVBQXVCLElBQXZCLENBRkEsQ0FBQTtBQUFBLFVBR0EsSUFBSSxDQUFDLFVBQUwsQ0FBZ0IsR0FBaEIsRUFBcUIsSUFBckIsQ0FIQSxDQUFBO0FBQUEsVUFJQSxPQUFBLEdBQVUsR0FBQSxHQUFNLElBQUksQ0FBQyxNQUpyQixDQUFBO0FBQUEsVUFLQSxTQUFTLENBQUMsaUJBQVYsQ0FBNEIsT0FBNUIsRUFBcUMsT0FBckMsQ0FMQSxDQUFBO2lCQU1BLEtBQUssQ0FBQyxjQUFOLENBQUEsRUFQRjtTQUFBLE1BQUE7aUJBU0UsS0FBSyxDQUFDLGNBQU4sQ0FBQSxFQVRGO1NBWHFCO01BQUEsQ0FqQ3ZCLENBQUE7QUFBQSxNQXVEQSxTQUFTLENBQUMsT0FBVixHQUFvQixTQUFDLEtBQUQsR0FBQTtlQUNsQixLQUFLLENBQUMsY0FBTixDQUFBLEVBRGtCO01BQUEsQ0F2RHBCLENBQUE7QUFBQSxNQXlEQSxTQUFTLENBQUMsS0FBVixHQUFrQixTQUFDLEtBQUQsR0FBQTtlQUNoQixLQUFLLENBQUMsY0FBTixDQUFBLEVBRGdCO01BQUEsQ0F6RGxCLENBQUE7YUFtRUEsU0FBUyxDQUFDLFNBQVYsR0FBc0IsU0FBQyxLQUFELEdBQUE7QUFDcEIsWUFBQSxtQ0FBQTtBQUFBLFFBQUEsR0FBQSxHQUFNLElBQUksQ0FBQyxHQUFMLENBQVMsU0FBUyxDQUFDLGNBQW5CLEVBQW1DLFNBQVMsQ0FBQyxZQUE3QyxDQUFOLENBQUE7QUFBQSxRQUNBLElBQUEsR0FBTyxJQUFJLENBQUMsR0FBTCxDQUFTLFNBQVMsQ0FBQyxZQUFWLEdBQXlCLFNBQVMsQ0FBQyxjQUE1QyxDQURQLENBQUE7QUFFQSxRQUFBLElBQUcsdUJBQUEsSUFBbUIsS0FBSyxDQUFDLE9BQU4sS0FBaUIsQ0FBdkM7QUFDRSxVQUFBLElBQUcsSUFBQSxHQUFPLENBQVY7QUFDRSxZQUFBLElBQUksQ0FBQyxVQUFMLENBQWdCLEdBQWhCLEVBQXFCLElBQXJCLENBQUEsQ0FBQTtBQUFBLFlBQ0EsU0FBUyxDQUFDLGlCQUFWLENBQTRCLEdBQTVCLEVBQWlDLEdBQWpDLENBREEsQ0FERjtXQUFBLE1BQUE7QUFJRSxZQUFBLElBQUcsdUJBQUEsSUFBbUIsS0FBSyxDQUFDLE9BQTVCO0FBQ0UsY0FBQSxHQUFBLEdBQU0sU0FBUyxDQUFDLEtBQWhCLENBQUE7QUFBQSxjQUNBLE9BQUEsR0FBVSxHQURWLENBQUE7QUFBQSxjQUVBLFVBQUEsR0FBYSxDQUZiLENBQUE7QUFHQSxjQUFBLElBQUcsR0FBQSxHQUFNLENBQVQ7QUFDRSxnQkFBQSxPQUFBLEVBQUEsQ0FBQTtBQUFBLGdCQUNBLFVBQUEsRUFEQSxDQURGO2VBSEE7QUFNQSxxQkFBTSxPQUFBLEdBQVUsQ0FBVixJQUFnQixHQUFJLENBQUEsT0FBQSxDQUFKLEtBQWtCLEdBQWxDLElBQTBDLEdBQUksQ0FBQSxPQUFBLENBQUosS0FBa0IsSUFBbEUsR0FBQTtBQUNFLGdCQUFBLE9BQUEsRUFBQSxDQUFBO0FBQUEsZ0JBQ0EsVUFBQSxFQURBLENBREY7Y0FBQSxDQU5BO0FBQUEsY0FTQSxJQUFJLENBQUMsVUFBTCxDQUFnQixPQUFoQixFQUEwQixHQUFBLEdBQUksT0FBOUIsQ0FUQSxDQUFBO0FBQUEsY0FVQSxTQUFTLENBQUMsaUJBQVYsQ0FBNEIsT0FBNUIsRUFBcUMsT0FBckMsQ0FWQSxDQURGO2FBQUEsTUFBQTtBQWFFLGNBQUEsSUFBSSxDQUFDLFVBQUwsQ0FBaUIsR0FBQSxHQUFJLENBQXJCLEVBQXlCLENBQXpCLENBQUEsQ0FiRjthQUpGO1dBQUE7aUJBa0JBLEtBQUssQ0FBQyxjQUFOLENBQUEsRUFuQkY7U0FBQSxNQW9CSyxJQUFHLHVCQUFBLElBQW1CLEtBQUssQ0FBQyxPQUFOLEtBQWlCLEVBQXZDO0FBQ0gsVUFBQSxJQUFHLElBQUEsR0FBTyxDQUFWO0FBQ0UsWUFBQSxJQUFJLENBQUMsVUFBTCxDQUFnQixHQUFoQixFQUFxQixJQUFyQixDQUFBLENBQUE7QUFBQSxZQUNBLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixHQUE1QixFQUFpQyxHQUFqQyxDQURBLENBREY7V0FBQSxNQUFBO0FBSUUsWUFBQSxJQUFJLENBQUMsVUFBTCxDQUFnQixHQUFoQixFQUFxQixDQUFyQixDQUFBLENBQUE7QUFBQSxZQUNBLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixHQUE1QixFQUFpQyxHQUFqQyxDQURBLENBSkY7V0FBQTtpQkFNQSxLQUFLLENBQUMsY0FBTixDQUFBLEVBUEc7U0F2QmU7TUFBQSxFQXBFbEI7SUFBQSxDQXBFTixDQUFBOztBQUFBLG1CQTZLQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFBLEdBQU87QUFBQSxRQUNMLE1BQUEsRUFBUSxNQURIO0FBQUEsUUFFTCxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZIO0FBQUEsUUFHTCxXQUFBLEVBQWMsSUFBQyxDQUFBLFNBQVMsQ0FBQyxNQUFYLENBQUEsQ0FIVDtBQUFBLFFBSUwsS0FBQSxFQUFRLElBQUMsQ0FBQSxHQUFHLENBQUMsTUFBTCxDQUFBLENBSkg7T0FBUCxDQUFBO0FBTUEsTUFBQSxJQUFHLG9CQUFIO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQURGO09BTkE7QUFRQSxNQUFBLElBQUcsb0JBQUg7QUFDRSxRQUFBLElBQUssQ0FBQSxNQUFBLENBQUwsR0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFmLENBREY7T0FSQTtBQVVBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBQyxDQUFBLE9BQTlCO0FBQ0UsUUFBQSxJQUFLLENBQUEsUUFBQSxDQUFMLEdBQWlCLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBUixDQUFBLENBQWpCLENBREY7T0FWQTthQVlBLEtBYk87SUFBQSxDQTdLVCxDQUFBOztnQkFBQTs7S0FMaUIsS0FBSyxDQUFDLFlBekV6QixDQUFBO0FBQUEsRUEwUUEsTUFBTyxDQUFBLE1BQUEsQ0FBUCxHQUFpQixTQUFDLElBQUQsR0FBQTtBQUNmLFFBQUEsdUNBQUE7QUFBQSxJQUNVLFdBQVIsTUFERixFQUVnQixpQkFBZCxZQUZGLEVBR1UsV0FBUixNQUhGLEVBSVUsWUFBUixPQUpGLEVBS1UsWUFBUixPQUxGLEVBTWEsY0FBWCxTQU5GLENBQUE7V0FRSSxJQUFBLElBQUEsQ0FBSyxHQUFMLEVBQVUsU0FBVixFQUFxQixHQUFyQixFQUEwQixJQUExQixFQUFnQyxJQUFoQyxFQUFzQyxNQUF0QyxFQVRXO0VBQUEsQ0ExUWpCLENBQUE7QUFBQSxFQXFSQSxLQUFNLENBQUEsWUFBQSxDQUFOLEdBQXNCLFVBclJ0QixDQUFBO0FBQUEsRUFzUkEsS0FBTSxDQUFBLFlBQUEsQ0FBTixHQUFzQixVQXRSdEIsQ0FBQTtBQUFBLEVBdVJBLEtBQU0sQ0FBQSxNQUFBLENBQU4sR0FBZ0IsSUF2UmhCLENBQUE7U0F3UkEsaUJBelJlO0FBQUEsQ0FGakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcclxuI1xyXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXHJcbiNcclxuY2xhc3MgRW5naW5lXHJcblxyXG4gICNcclxuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcclxuICAjIEBwYXJhbSB7QXJyYXl9IHBhcnNlciBEZWZpbmVzIGhvdyB0byBwYXJzZSBlbmNvZGVkIG1lc3NhZ2VzLlxyXG4gICNcclxuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHBhcnNlciktPlxyXG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXHJcblxyXG4gICNcclxuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxyXG4gICNcclxuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cclxuICAgIHR5cGVQYXJzZXIgPSBAcGFyc2VyW2pzb24udHlwZV1cclxuICAgIGlmIHR5cGVQYXJzZXI/XHJcbiAgICAgIHR5cGVQYXJzZXIganNvblxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXHJcbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcclxuICAjXHJcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxyXG4gICAgb3BzID0gW11cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcclxuICAjXHJcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cclxuICAjXHJcbiAgYXBwbHlPcDogKG9wX2pzb24pLT5cclxuICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxyXG4gICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICBASEIuYWRkVG9Db3VudGVyIG9cclxuICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIGVsc2VcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxudGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL1RleHRUeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBUZXh0IERhdGFzdHJ1Y3R1cmVzLlxuI1xuY2xhc3MgVGV4dFlhdHRhXG5cbiAgI1xuICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXFlIHVzZXIgaWQgdGhhdCBkZWZpbmVzIHRoaXMgcGVlci5cbiAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIFRoZSBjb25uZWN0b3IgZGVmaW5lcyBob3cgeW91IGNvbm5lY3QgdG8gdGhlIG90aGVyIHBlZXJzLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAodXNlcl9pZCwgQ29ubmVjdG9yKS0+XG4gICAgQEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICAgIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuICAgIEBlbmdpbmUgPSBuZXcgRW5naW5lIEBIQiwgdGV4dF90eXBlcy5wYXJzZXJcbiAgICBAY29ubmVjdG9yID0gbmV3IENvbm5lY3RvciBAZW5naW5lLCBASEIsIHRleHRfdHlwZXMuZXhlY3V0aW9uX2xpc3RlbmVyLCBAXG5cbiAgICBiZWdpbm5pbmcgPSBASEIuYWRkT3BlcmF0aW9uIG5ldyBAdHlwZXMuRGVsaW1pdGVyIHtjcmVhdG9yOiAnXycsIG9wX251bWJlcjogJ19iZWdpbm5pbmcnfSAsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgZW5kID0gICAgICAgQEhCLmFkZE9wZXJhdGlvbiBuZXcgQHR5cGVzLkRlbGltaXRlciB7Y3JlYXRvcjogJ18nLCBvcF9udW1iZXI6ICdfZW5kJ30gICAgICAgLCBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgIGJlZ2lubmluZy5uZXh0X2NsID0gZW5kXG4gICAgYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgIGVuZC5leGVjdXRlKClcbiAgICBmaXJzdF93b3JkID0gbmV3IEB0eXBlcy5Xb3JkIHtjcmVhdG9yOiAnXycsIG9wX251bWJlcjogJ18nfSwgYmVnaW5uaW5nLCBlbmRcbiAgICBASEIuYWRkT3BlcmF0aW9uKGZpcnN0X3dvcmQpLmV4ZWN1dGUoKVxuXG4gICAgdWlkX3IgPSB7IGNyZWF0b3I6ICdfJywgb3BfbnVtYmVyOiBcIlJNXCIgfVxuICAgIHVpZF9iZWcgPSB7IGNyZWF0b3I6ICdfJywgb3BfbnVtYmVyOiBcIl9STV9iZWdpbm5pbmdcIiB9XG4gICAgdWlkX2VuZCA9IHsgY3JlYXRvcjogJ18nLCBvcF9udW1iZXI6IFwiX1JNX2VuZFwiIH1cbiAgICBiZWcgPSBASEIuYWRkT3BlcmF0aW9uKG5ldyBAdHlwZXMuRGVsaW1pdGVyIHVpZF9iZWcsIHVuZGVmaW5lZCwgdWlkX2VuZCkuZXhlY3V0ZSgpXG4gICAgZW5kID0gQEhCLmFkZE9wZXJhdGlvbihuZXcgQHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgQHJvb3RfZWxlbWVudCA9IEBIQi5hZGRPcGVyYXRpb24obmV3IEB0eXBlcy5SZXBsYWNlTWFuYWdlciB1bmRlZmluZWQsIHVpZF9yLCBiZWcsIGVuZCkuZXhlY3V0ZSgpXG4gICAgQHJvb3RfZWxlbWVudC5yZXBsYWNlIGZpcnN0X3dvcmQsIHsgY3JlYXRvcjogJ18nLCBvcF9udW1iZXI6ICdSZXBsYWNlYWJsZSd9XG5cblxuICAjXG4gICMgQHJlc3VsdCBXb3JkXG4gICNcbiAgZ2V0U2hhcmVkT2JqZWN0OiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudC52YWwoKVxuXG4gICNcbiAgIyBAc2VlIEVuZ2luZVxuICAjXG4gIGdldEVuZ2luZTogKCktPlxuICAgIEBlbmdpbmVcblxuICAjXG4gICMgR2V0IHRoZSBpbml0aWFsaXplZCBjb25uZWN0b3IuXG4gICNcbiAgZ2V0Q29ubmVjdG9yOiAoKS0+XG4gICAgQGNvbm5lY3RvclxuXG4gICNcbiAgIyBAc2VlIEhpc3RvcnlCdWZmZXJcbiAgI1xuICBnZXRIaXN0b3J5QnVmZmVyOiAoKS0+XG4gICAgQEhCXG5cbiAgI1xuICAjIEdldCB0aGUgVXNlcklkIGZyb20gdGhlIEhpc3RvcnlCdWZmZXIgb2JqZWN0LlxuICAjIEluIG1vc3QgY2FzZXMgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzIHRoZSB1c2VyX2lkIHZhbHVlIHdpdGggd2hpY2hcbiAgIyBKc29uWWF0dGEgd2FzIGluaXRpYWxpemVkIChEZXBlbmRpbmcgb24gdGhlIEhpc3RvcnlCdWZmZXIgaW1wbGVtZW50YXRpb24pLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEBIQi5nZXRVc2VySWQoKVxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnZhbFxuICAjXG4gIHZhbDogKCktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS52YWwoKVxuXG4gICNcbiAgIyBAc2VlIFdvcmQuaW5zZXJ0VGV4dFxuICAjXG4gIGluc2VydFRleHQ6IChwb3MsIGNvbnRlbnQpLT5cbiAgICBAZ2V0U2hhcmVkT2JqZWN0KCkuaW5zZXJ0VGV4dCBwb3MsIGNvbnRlbnRcblxuICAjXG4gICMgQHNlZSBXb3JkLmRlbGV0ZVRleHRcbiAgI1xuICBkZWxldGVUZXh0OiAocG9zLCBsZW5ndGgpLT5cbiAgICBAZ2V0U2hhcmVkT2JqZWN0KCkuZGVsZXRlVGV4dCBwb3MsIGxlbmd0aFxuXG4gICNcbiAgIyBAc2VlIFdvcmQuYmluZFxuICAjXG4gIGJpbmQ6ICh0ZXh0YXJlYSktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS5iaW5kIHRleHRhcmVhXG5cbiAgI1xuICAjIEBzZWUgV29yZC5yZXBsYWNlVGV4dFxuICAjXG4gIHJlcGxhY2VUZXh0OiAodGV4dCktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS5yZXBsYWNlVGV4dCB0ZXh0XG5cbiAgb246ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50Lm9uIGFyZ3VtZW50cy4uLlxuXG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dFlhdHRhXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLlRleHRZYXR0YSA9IFRleHRZYXR0YVxuIiwiXG4jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgI1xuICAjIFRoZXJlIGlzIG9ubHkgb25lIHJlc2VydmVkIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpLCBzbyB1c2UgaXQgd2lzZWx5LlxuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogJ18nXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAoKS0+XG4gICAgcmVzID0ge31cbiAgICBmb3IgdXNlcixjdG4gb2YgQG9wZXJhdGlvbl9jb3VudGVyXG4gICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICByZXNcblxuICAjXG4gICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgI1xuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiAobm90IGlzTmFOKHBhcnNlSW50KG9fbnVtYmVyKSkpIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/XG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/XG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQgaW5zdGFuY2VvZiBPYmplY3RcbiAgICAgIEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxuICAgIGVsc2UgaWYgbm90IHVpZD9cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgb2YgdWlkIGlzIG5vdCBkZWZpbmVkIVwiXG4gICNcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XG4gICMgb3RoZXIgb3BlcmF0aW9ucyAoaXQgd29udCBleGVjdXRlZClcbiAgI1xuICBhZGRPcGVyYXRpb246IChvKS0+XG4gICAgaWYgbm90IEBidWZmZXJbby5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIEBidWZmZXJbby5jcmVhdG9yXVtvLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSA9IDBcbiAgICBpZiB0eXBlb2Ygby5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8uY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0rK1xuICAgICNpZiBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSBpc250IChvLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIC0gKG8ub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgcGFyc2VyID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuXG4gICNcbiAgY2xhc3MgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIGlmIG5vdCB1aWQ/XG4gICAgICAgIHVpZCA9IEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIHtcbiAgICAgICAgJ2NyZWF0b3InOiBAY3JlYXRvclxuICAgICAgICAnb3BfbnVtYmVyJyA6IEBvcF9udW1iZXJcbiAgICAgIH0gPSB1aWRcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGV2ZW50IE5hbWUgb2YgdGhlIGV2ZW50LlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvbjogKGV2ZW50cywgZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA/PSB7fVxuICAgICAgaWYgZXZlbnRzLmNvbnN0cnVjdG9yIGlzbnQgW10uY29uc3RydWN0b3JcbiAgICAgICAgZXZlbnRzID0gW2V2ZW50c11cbiAgICAgIGZvciBlIGluIGV2ZW50c1xuICAgICAgICBAZXZlbnRfbGlzdGVuZXJzW2VdID89IFtdXG4gICAgICAgIEBldmVudF9saXN0ZW5lcnNbZV0ucHVzaCBmXG5cbiAgICBkZWxldGVMaXN0ZW5lcjogKGV2ZW50cywgZiktPlxuICAgICAgaWYgZXZlbnRzLmNvbnN0cnVjdG9yIGlzbnQgW10uY29uc3RydWN0b3JcbiAgICAgICAgZXZlbnRzID0gW2V2ZW50c11cbiAgICAgIGZvciBlIGluIGV2ZW50c1xuICAgICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tlXT9cbiAgICAgICAgICBAZXZlbnRfbGlzdGVuZXJzW2VdID0gQGV2ZW50X2xpc3RlbmVyc1tlXS5maWx0ZXIgKGcpLT5cbiAgICAgICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgI1xuICAgIGNhbGxFdmVudDogKCktPlxuICAgICAgQGZvcndhcmRFdmVudCBALCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQgYW5kIHNwZWNpZnkgaW4gd2hpY2ggY29udGV4dCB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkIChzZXQgJ3RoaXMnKS5cbiAgICAjXG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGV2ZW50LCBhcmdzLi4uKS0+XG4gICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tldmVudF0/XG4gICAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdXG4gICAgICAgICAgZi5jYWxsIG9wLCBldmVudCwgYXJncy4uLlxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIHsgJ2NyZWF0b3InOiBAY3JlYXRvciwgJ29wX251bWJlcic6IEBvcF9udW1iZXIgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gSW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBwYXJzZXJbJ0RlbGV0ZSddID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IERlbGV0ZSB1aWQsIGRlbGV0ZXNfdWlkXG5cbiAgI1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIEluc2VydCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgaWYgQHBhcmVudD8gYW5kIEBkZWxldGVkX2J5Lmxlbmd0aCBpcyAxXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImRlbGV0ZVwiLCBAXG5cbiAgICAjXG4gICAgIyBJZiBpc0RlbGV0ZWQoKSBpcyB0cnVlIHRoaXMgb3BlcmF0aW9uIHdvbid0IGJlIG1haW50YWluZWQgaW4gdGhlIHNsXG4gICAgI1xuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGRlbGV0ZWRfYnk/Lmxlbmd0aCA+IDBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICAjVE9ETzogZGVsZXRlIHRoaXNcbiAgICAgICAgaWYgQCBpcyBAcHJldl9jbFxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gOykgXCJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFVwZGF0ZSB0aGUgc2hvcnQgbGlzdFxuICAgICMgVE9ETyAoVW51c2VkKVxuICAgIHVwZGF0ZV9zbDogKCktPlxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB1cGRhdGU6IChkZXN0X2NsLGRlc3Rfc2wpLT5cbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgIGlmIG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIG8gPSBvW2Rlc3RfY2xdXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgQFtkZXN0X3NsXSA9IG9cblxuICAgICAgICAgICAgYnJlYWtcbiAgICAgIHVwZGF0ZSBcInByZXZfY2xcIiwgXCJwcmV2X3NsXCJcbiAgICAgIHVwZGF0ZSBcIm5leHRfY2xcIiwgXCJwcmV2X3NsXCJcblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEBpc19leGVjdXRlZD9cbiAgICAgICAgcmV0dXJuIEBcbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHByZXZfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBuZXh0X2NsPy52YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpIGFuZCBAcHJldl9jbC5uZXh0X2NsIGlzbnQgQFxuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSAwXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2UgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG5vdCBvP1xuICAgICAgICAgICAgICAjIFRPRE86IERlYnVnZ2luZ1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8uY3JlYXRvciA8IEBjcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG4gICAgICAgIHBhcmVudCA9IEBwcmV2X2NsPy5nZXRQYXJlbnQoKVxuICAgICAgICBpZiBwYXJlbnQ/XG4gICAgICAgICAgQHNldFBhcmVudCBwYXJlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImluc2VydFwiLCBAXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBEZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBwcmV2LmlzRGVsZXRlZD8gYW5kIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuICAjXG4gICMgRGVmaW5lcyBhbiBvYmplY3QgdGhhdCBpcyBjYW5ub3QgYmUgY2hhbmdlZC4gWW91IGNhbiB1c2UgdGhpcyB0byBzZXQgYW4gaW1tdXRhYmxlIHN0cmluZywgb3IgYSBudW1iZXIuXG4gICNcbiAgY2xhc3MgSW1tdXRhYmxlT2JqZWN0IGV4dGVuZHMgSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gY29udGVudFxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgQGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiSW1tdXRhYmxlT2JqZWN0XCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2NvbnRlbnQnIDogQGNvbnRlbnRcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyWydJbW11dGFibGVPYmplY3QnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IEltbXV0YWJsZU9iamVjdCB1aWQsIGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIERlbGltaXRlciBleHRlbmRzIE9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElmIGlzRGVsZXRlZCgpIGlzIHRydWUgdGhpcyBvcGVyYXRpb24gd29uJ3QgYmUgbWFpbnRhaW5lZCBpbiB0aGUgc2xcbiAgICAjXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkRlbGltaXRlclwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0RlbGltaXRlciddID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IERlbGltaXRlciB1aWQsIHByZXYsIG5leHRcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDpcbiAgICAgICdEZWxldGUnIDogRGVsZXRlXG4gICAgICAnSW5zZXJ0JyA6IEluc2VydFxuICAgICAgJ0RlbGltaXRlcic6IERlbGltaXRlclxuICAgICAgJ09wZXJhdGlvbic6IE9wZXJhdGlvblxuICAgICAgJ0ltbXV0YWJsZU9iamVjdCcgOiBJbW11dGFibGVPYmplY3RcbiAgICAncGFyc2VyJyA6IHBhcnNlclxuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cblxuXG5cblxuIiwiYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBiYXNpY190eXBlcyA9IGJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBiYXNpY190eXBlcy50eXBlc1xuICBwYXJzZXIgPSBiYXNpY190eXBlcy5wYXJzZXJcblxuICAjXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBzZWUgSnNvblR5cGVzLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBpZiBub3QgQG1hcFtuYW1lXT9cbiAgICAgICAgICBIQi5hZGRPcGVyYXRpb24obmV3IEFkZE5hbWUgdW5kZWZpbmVkLCBALCBuYW1lKS5leGVjdXRlKClcbiAgICAgICAgQG1hcFtuYW1lXS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBvYmogPSBAbWFwW25hbWVdPy52YWwoKVxuICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICBvYmoudmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9ialxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBtYXBcbiAgICAgICAgICBvYmogPSBvLnZhbCgpXG4gICAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0IG9yIG9iaiBpbnN0YW5jZW9mIE1hcE1hbmFnZXJcbiAgICAgICAgICAgIG9iaiA9IG9iai52YWwoKVxuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG9ialxuICAgICAgICByZXN1bHRcblxuICAjXG4gICMgV2hlbiBhIG5ldyBwcm9wZXJ0eSBpbiBhIG1hcCBtYW5hZ2VyIGlzIGNyZWF0ZWQsIHRoZW4gdGhlIHVpZHMgb2YgdGhlIGluc2VydGVkIE9wZXJhdGlvbnNcbiAgIyBtdXN0IGJlIHVuaXF1ZSAodGhpbmsgYWJvdXQgY29uY3VycmVudCBvcGVyYXRpb25zKS4gVGhlcmVmb3JlIG9ubHkgYW4gQWRkTmFtZSBvcGVyYXRpb24gaXMgYWxsb3dlZCB0b1xuICAjIGFkZCBhIHByb3BlcnR5IGluIGEgTWFwTWFuYWdlci4gSWYgdHdvIEFkZE5hbWUgb3BlcmF0aW9ucyBvbiB0aGUgc2FtZSBNYXBNYW5hZ2VyIG5hbWUgaGFwcGVuIGNvbmN1cnJlbnRseVxuICAjIG9ubHkgb25lIHdpbGwgQWRkTmFtZSBvcGVyYXRpb24gd2lsbCBiZSBleGVjdXRlZC5cbiAgI1xuICBjbGFzcyBBZGROYW1lIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gbWFwX21hbmFnZXIgVWlkIG9yIHJlZmVyZW5jZSB0byB0aGUgTWFwTWFuYWdlci5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgd2lsbCBiZSBhZGRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIG1hcF9tYW5hZ2VyLCBAbmFtZSktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ21hcF9tYW5hZ2VyJywgbWFwX21hbmFnZXJcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgbWFwX21hbmFnZXIgZG9lc24ndCBoYXZlIHRoZSBwcm9wZXJ0eSBuYW1lLCB0aGVuIGFkZCBpdC5cbiAgICAjIFRoZSBSZXBsYWNlTWFuYWdlciB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gb24gdGhlIHByb3BlcnR5IGlzIHVuaXF1ZVxuICAgICMgaW4gc3VjaCBhIHdheSB0aGF0IGlmIEFkZE5hbWUgaXMgZXhlY3V0ZWQgKGZyb20gYW5vdGhlciBwZWVyKSBpdCB3aWxsXG4gICAgIyBhbHdheXMgaGF2ZSB0aGUgc2FtZSByZXN1bHQgKFJlcGxhY2VNYW5hZ2VyLCBhbmQgaXRzIGJlZ2lubmluZyBhbmQgZW5kIGFyZSB0aGUgc2FtZSlcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB1aWRfciA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIl8je3VpZF9iZWcub3BfbnVtYmVyfV9STV8je0BuYW1lfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiXyN7dWlkX2VuZC5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2VuZFwiXG4gICAgICAgICAgYmVnID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0gPSBIQi5hZGRPcGVyYXRpb24obmV3IFJlcGxhY2VNYW5hZ2VyIHVuZGVmaW5lZCwgdWlkX3IsIGJlZywgZW5kKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLnNldFBhcmVudCBAbWFwX21hbmFnZXIsIEBuYW1lXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0uZXhlY3V0ZSgpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiQWRkTmFtZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdtYXBfbWFuYWdlcicgOiBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgJ25hbWUnIDogQG5hbWVcbiAgICAgIH1cblxuICBwYXJzZXJbJ0FkZE5hbWUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ21hcF9tYW5hZ2VyJyA6IG1hcF9tYW5hZ2VyXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ25hbWUnIDogbmFtZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IEFkZE5hbWUgdWlkLCBtYXBfbWFuYWdlciwgbmFtZVxuXG4gICNcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIExpc3RNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIGJlZ2lubmluZz8gYW5kIGVuZD9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2JlZ2lubmluZycsIGJlZ2lubmluZ1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnZW5kJywgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIEBiZWdpbm5pbmcgPSBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICAgIEBlbmQgPSAgICAgICBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGJlZ2lubmluZy5zZXRQYXJlbnQgQFxuICAgICAgICBAZW5kLnNldFBhcmVudCBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAZW5kLnByZXZfY2xcblxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXG5cbiAgICAjIFRyYW5zZm9ybXMgdGhlIHRoZSBsaXN0IHRvIGFuIGFycmF5XG4gICAgIyBEb2Vzbid0IHJldHVybiBsZWZ0LXJpZ2h0IGRlbGltaXRlci5cbiAgICB0b0FycmF5OiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgcmVzdWx0LnB1c2ggb1xuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIGlmIChwb3NpdGlvbiA+IDAgb3Igby5pc0RlbGV0ZWQoKSkgYW5kIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICAgICMgZmluZCBmaXJzdCBub24gZGVsZXRlZCBvcFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxuICAgICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgV29yZC10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBXb3JkXG4gICNcbiAgY2xhc3MgUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyBMaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChpbml0aWFsX2NvbnRlbnQsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgICBpZiBpbml0aWFsX2NvbnRlbnQ/XG4gICAgICAgIEByZXBsYWNlIGluaXRpYWxfY29udGVudFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIG9wID0gbmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsXG4gICAgICBIQi5hZGRPcGVyYXRpb24ob3ApLmV4ZWN1dGUoKVxuXG4gICAgI1xuICAgICMgQWRkIGNoYW5nZSBsaXN0ZW5lcnMgZm9yIHBhcmVudC5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAocGFyZW50LCBwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBAb24gJ2luc2VydCcsIChldmVudCwgb3ApPT5cbiAgICAgICAgaWYgb3AubmV4dF9jbCBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50ICdjaGFuZ2UnLCBwcm9wZXJ0eV9uYW1lXG4gICAgICBAb24gJ2NoYW5nZScsIChldmVudCk9PlxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCAnY2hhbmdlJywgcHJvcGVydHlfbmFtZVxuICAgICAgIyBDYWxsIHRoaXMsIHdoZW4gdGhlIGZpcnN0IGVsZW1lbnQgaXMgaW5zZXJ0ZWQuIFRoZW4gZGVsZXRlIHRoZSBsaXN0ZW5lci5cbiAgICAgIGFkZFByb3BlcnR5TGlzdGVuZXIgPSAoZXZlbnQsIG9wKT0+XG4gICAgICAgIGlmIG9wLm5leHRfY2wgaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIgYW5kIG9wLnByZXZfY2wgaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCAnYWRkUHJvcGVydHknLCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIEBkZWxldGVMaXN0ZW5lciAnYWRkUHJvcGVydHknLCBhZGRQcm9wZXJ0eUxpc3RlbmVyXG4gICAgICBAb24gJ2luc2VydCcsIGFkZFByb3BlcnR5TGlzdGVuZXJcbiAgICAgIHN1cGVyIHBhcmVudFxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpcyBXb3JkXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VNYW5hZ2VyXCJcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAgICdlbmQnIDogQGVuZC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAcHJldl9jbD8gYW5kIEBuZXh0X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlJlcGxhY2VNYW5hZ2VyXCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlTWFuYWdlciBjb250ZW50LCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG4gICNcbiAgIyBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZXMuXG4gICMgQHNlZSBSZXBsYWNlTWFuYWdlclxuICAjXG4gIGNsYXNzIFJlcGxhY2VhYmxlIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBpZiBub3QgKHByZXY/IGFuZCBuZXh0PyBhbmQgY29udGVudD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBjb250ZW50LCBwcmV2LCBhbmQgbmV4dCBmb3IgUmVwbGFjZWFibGUtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICAjXG4gICAgIyBSZXR1cm4gdGhlIGNvbnRlbnQgdGhhdCB0aGlzIG9wZXJhdGlvbiBob2xkcy5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgY29udGVudCBvZiB0aGlzIHJlcGxhY2VhYmxlIHdpdGggbmV3IGNvbnRlbnQuXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50KS0+XG4gICAgICBAcGFyZW50LnJlcGxhY2UgY29udGVudFxuXG4gICAgI1xuICAgICMgSWYgcG9zc2libGUgc2V0IHRoZSByZXBsYWNlIG1hbmFnZXIgaW4gdGhlIGNvbnRlbnQuXG4gICAgIyBAc2VlIFdvcmQuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudC5zZXRSZXBsYWNlTWFuYWdlcj8oQHBhcmVudClcbiAgICAgICAgc3VwZXJcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlJlcGxhY2VhYmxlXCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50LmdldFVpZCgpXG4gICAgICAgICAgJ1JlcGxhY2VNYW5hZ2VyJyA6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlYWJsZVwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ1JlcGxhY2VNYW5hZ2VyJyA6IHBhcmVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VhYmxlIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG5cbiAgdHlwZXNbJ0xpc3RNYW5hZ2VyJ10gPSBMaXN0TWFuYWdlclxuICB0eXBlc1snTWFwTWFuYWdlciddID0gTWFwTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZU1hbmFnZXInXSA9IFJlcGxhY2VNYW5hZ2VyXG4gIHR5cGVzWydSZXBsYWNlYWJsZSddID0gUmVwbGFjZWFibGVcblxuICBiYXNpY190eXBlc1xuXG5cblxuXG5cblxuIiwic3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vU3RydWN0dXJlZFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgc3RydWN0dXJlZF90eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gc3RydWN0dXJlZF90eXBlcy5wYXJzZXJcblxuICAjXG4gICMgQXQgdGhlIG1vbWVudCBUZXh0RGVsZXRlIHR5cGUgZXF1YWxzIHRoZSBEZWxldGUgdHlwZSBpbiBCYXNpY1R5cGVzLlxuICAjIEBzZWUgQmFzaWNUeXBlcy5EZWxldGVcbiAgI1xuICBjbGFzcyBUZXh0RGVsZXRlIGV4dGVuZHMgdHlwZXMuRGVsZXRlXG4gIHBhcnNlcltcIlRleHREZWxldGVcIl0gPSBwYXJzZXJbXCJEZWxldGVcIl1cblxuICAjXG4gICMgIEV4dGVuZHMgdGhlIGJhc2ljIEluc2VydCB0eXBlIHRvIGFuIG9wZXJhdGlvbiB0aGF0IGhvbGRzIGEgdGV4dCB2YWx1ZVxuICAjXG4gIGNsYXNzIFRleHRJbnNlcnQgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcbiAgICAjXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gY29udGVudCBUaGUgY29udGVudCBvZiB0aGlzIEluc2VydC10eXBlIE9wZXJhdGlvbi4gVXN1YWxseSB5b3UgcmVzdHJpY3QgdGhlIGxlbmd0aCBvZiBjb250ZW50IHRvIHNpemUgMVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGRlZmluZSBwcmV2LCBhbmQgbmV4dCBmb3IgVGV4dEluc2VydC10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICAjXG4gICAgIyBUaGUgcmVzdWx0IHdpbGwgYmUgY29uY2F0ZW5hdGVkIHdpdGggdGhlIHJlc3VsdHMgZnJvbSB0aGUgb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnNcbiAgICAjIGluIG9yZGVyIHRvIHJldHJpZXZlIHRoZSBjb250ZW50IG9mIHRoZSBlbmdpbmUuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIudG9FeGVjdXRlZEFycmF5XG4gICAgI1xuICAgIHZhbDogKGN1cnJlbnRfcG9zaXRpb24pLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJUZXh0SW5zZXJ0XCJcbiAgICAgICAgICAnY29udGVudCc6IEBjb250ZW50XG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiVGV4dEluc2VydFwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgSGFuZGxlcyBhIFRleHQtbGlrZSBkYXRhIHN0cnVjdHVyZXMgd2l0aCBzdXBwb3J0IGZvciBpbnNlcnRUZXh0L2RlbGV0ZVRleHQgYXQgYSB3b3JkLXBvc2l0aW9uLlxuICAjXG4gIGNsYXNzIFdvcmQgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmRcbiAgICAjXG4gICAgaW5zZXJ0VGV4dDogKHBvc2l0aW9uLCBjb250ZW50KS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgIGZvciBjIGluIGNvbnRlbnRcbiAgICAgICAgb3AgPSBuZXcgVGV4dEluc2VydCBjLCB1bmRlZmluZWQsIG8ucHJldl9jbCwgb1xuICAgICAgICBIQi5hZGRPcGVyYXRpb24ob3ApLmV4ZWN1dGUoKVxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgIGRlbGV0ZVRleHQ6IChwb3NpdGlvbiwgbGVuZ3RoKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cblxuICAgICAgZGVsZXRlX29wcyA9IFtdXG4gICAgICBmb3IgaSBpbiBbMC4uLmxlbmd0aF1cbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQgPSBIQi5hZGRPcGVyYXRpb24obmV3IFRleHREZWxldGUgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpIGFuZCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBkZWxldGVfb3BzLnB1c2ggZC5fZW5jb2RlKClcbiAgICAgIGRlbGV0ZV9vcHNcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyB3b3JkIHdpdGggYW5vdGhlciBvbmUuIENvbmN1cnJlbnQgcmVwbGFjZW1lbnRzIGFyZSBub3QgbWVyZ2VkIVxuICAgICMgT25seSBvbmUgb2YgdGhlIHJlcGxhY2VtZW50cyB3aWxsIGJlIHVzZWQuXG4gICAgI1xuICAgICMgQ2FuIG9ubHkgYmUgdXNlZCBpZiB0aGUgUmVwbGFjZU1hbmFnZXIgd2FzIHNldCFcbiAgICAjIEBzZWUgV29yZC5zZXRSZXBsYWNlTWFuYWdlclxuICAgICNcbiAgICByZXBsYWNlVGV4dDogKHRleHQpLT5cbiAgICAgIGlmIEByZXBsYWNlX21hbmFnZXI/XG4gICAgICAgIHdvcmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IFdvcmQgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIHRleHRcbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlci5yZXBsYWNlKHdvcmQpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgdHlwZSBpcyBjdXJyZW50bHkgbm90IG1haW50YWluZWQgYnkgYSBSZXBsYWNlTWFuYWdlciFcIlxuXG4gICAgI1xuICAgICMgQHJldHVybnMgW0pzb25dIEEgSnNvbiBvYmplY3QuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgYyA9IGZvciBvIGluIEB0b0FycmF5KClcbiAgICAgICAgaWYgby52YWw/XG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgXCJcIlxuICAgICAgYy5qb2luKCcnKVxuXG4gICAgI1xuICAgICMgSW4gbW9zdCBjYXNlcyB5b3Ugd291bGQgZW1iZWQgYSBXb3JkIGluIGEgUmVwbGFjZWFibGUsIHdpY2ggaXMgaGFuZGxlZCBieSB0aGUgUmVwbGFjZU1hbmFnZXIgaW4gb3JkZXJcbiAgICAjIHRvIHByb3ZpZGUgcmVwbGFjZSBmdW5jdGlvbmFsaXR5LlxuICAgICNcbiAgICBzZXRSZXBsYWNlTWFuYWdlcjogKG9wKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncmVwbGFjZV9tYW5hZ2VyJywgb3BcbiAgICAgIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICBAb24gWydpbnNlcnQnLCAnZGVsZXRlJ10sICgpPT5cbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlcj8uY2FsbEV2ZW50ICdjaGFuZ2UnXG5cbiAgICAjXG4gICAgIyBCaW5kIHRoaXMgV29yZCB0byBhIHRleHRmaWVsZC5cbiAgICAjXG4gICAgYmluZDogKHRleHRmaWVsZCktPlxuICAgICAgd29yZCA9IEBcbiAgICAgIHRleHRmaWVsZC52YWx1ZSA9IEB2YWwoKVxuXG4gICAgICBAb24gXCJpbnNlcnRcIiwgKGV2ZW50LCBvcCktPlxuICAgICAgICBvX3BvcyA9IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuXG4gICAgICBAb24gXCJkZWxldGVcIiwgKGV2ZW50LCBvcCktPlxuICAgICAgICBvX3BvcyA9IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgIGlmIGN1cnNvciA8IG9fcG9zXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjdXJzb3IgLT0gMVxuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG4gICAgICAjIGNvbnN1bWUgYWxsIHRleHQtaW5zZXJ0IGNoYW5nZXMuXG4gICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IChldmVudCktPlxuICAgICAgICBjaGFyID0gbnVsbFxuICAgICAgICBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgICAgY2hhciA9ICdcXG4nXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUgZXZlbnQua2V5Q29kZVxuICAgICAgICBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICBwb3MgPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcyksIGRpZmZcbiAgICAgICAgICB3b3JkLmluc2VydFRleHQgcG9zLCBjaGFyXG4gICAgICAgICAgbmV3X3BvcyA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgICNcbiAgICAgICMgY29uc3VtZSBkZWxldGVzLiBOb3RlIHRoYXRcbiAgICAgICMgICBjaHJvbWU6IHdvbid0IGNvbnN1bWUgZGVsZXRpb25zIG9uIGtleXByZXNzIGV2ZW50LlxuICAgICAgIyAgIGtleUNvZGUgaXMgZGVwcmVjYXRlZC4gQlVUOiBJIGRvbid0IHNlZSBhbm90aGVyIHdheS5cbiAgICAgICMgICAgIHNpbmNlIGV2ZW50LmtleSBpcyBub3QgaW1wbGVtZW50ZWQgaW4gdGhlIGN1cnJlbnQgdmVyc2lvbiBvZiBjaHJvbWUuXG4gICAgICAjICAgICBFdmVyeSBicm93c2VyIHN1cHBvcnRzIGtleUNvZGUuIExldCdzIHN0aWNrIHdpdGggaXQgZm9yIG5vdy4uXG4gICAgICAjXG4gICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gKGV2ZW50KS0+XG4gICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICBkaWZmID0gTWF0aC5hYnModGV4dGZpZWxkLnNlbGVjdGlvbkVuZCAtIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydClcbiAgICAgICAgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgOCAjIEJhY2tzcGFjZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB0ZXh0ZmllbGQudmFsdWVcbiAgICAgICAgICAgICAgbmV3X3BvcyA9IHBvc1xuICAgICAgICAgICAgICBkZWxfbGVuZ3RoID0gMFxuICAgICAgICAgICAgICBpZiBwb3MgPiAwXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdoaWxlIG5ld19wb3MgPiAwIGFuZCB2YWxbbmV3X3Bvc10gaXNudCBcIiBcIiBhbmQgdmFsW25ld19wb3NdIGlzbnQgJ1xcbidcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIG5ld19wb3MsIG5ld19wb3NcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IChwb3MtMSksIDFcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgNDYgIyBEZWxldGVcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgMVxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG5cblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogXCJXb3JkXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICdlbmQnIDogQGVuZC5nZXRVaWQoKVxuICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBpZiBAbmV4dF9jbD9cbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ1dvcmQnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdiZWdpbm5pbmcnIDogYmVnaW5uaW5nXG4gICAgICAnZW5kJyA6IGVuZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgV29yZCB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICB0eXBlc1snVGV4dEluc2VydCddID0gVGV4dEluc2VydFxuICB0eXBlc1snVGV4dERlbGV0ZSddID0gVGV4dERlbGV0ZVxuICB0eXBlc1snV29yZCddID0gV29yZFxuICBzdHJ1Y3R1cmVkX3R5cGVzXG5cblxuIl19
