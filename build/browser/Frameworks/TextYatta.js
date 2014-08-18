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

  TextYatta.prototype.getRootElement = function() {
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
    return this.getRootElement().val();
  };

  TextYatta.prototype.insertText = function(pos, content) {
    return this.getRootElement().insertText(pos, content);
  };

  TextYatta.prototype.deleteText = function(pos, length) {
    return this.getRootElement().deleteText(pos, length);
  };

  TextYatta.prototype.bind = function(textarea) {
    return this.getRootElement().bind(textarea);
  };

  TextYatta.prototype.replaceText = function(text) {
    return this.getRootElement().replaceText(text);
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
      var f, _i, _len, _ref, _ref1, _results;
      if (((_ref = this.event_listeners) != null ? _ref[event] : void 0) != null) {
        _ref1 = this.event_listeners[event];
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          f = _ref1[_i];
          _results.push(f.call(this, event, args));
        }
        return _results;
      }
    };

    Operation.prototype.setParent = function(o) {
      return this.parent = o;
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
      return this.validateSavedOperations;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0ZyYW1ld29ya3MvVGV4dFlhdHRhLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL1R5cGVzL0Jhc2ljVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9UZXh0VHlwZXMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDSUEsSUFBQSxNQUFBOztBQUFBO0FBTWUsRUFBQSxnQkFBRSxFQUFGLEVBQU8sTUFBUCxHQUFBO0FBQ1gsSUFEWSxJQUFDLENBQUEsS0FBQSxFQUNiLENBQUE7QUFBQSxJQURpQixJQUFDLENBQUEsU0FBQSxNQUNsQixDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsZUFBRCxHQUFtQixFQUFuQixDQURXO0VBQUEsQ0FBYjs7QUFBQSxtQkFNQSxjQUFBLEdBQWdCLFNBQUMsSUFBRCxHQUFBO0FBQ2QsUUFBQSxVQUFBO0FBQUEsSUFBQSxVQUFBLEdBQWEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFJLENBQUMsSUFBTCxDQUFyQixDQUFBO0FBQ0EsSUFBQSxJQUFHLGtCQUFIO2FBQ0UsVUFBQSxDQUFXLElBQVgsRUFERjtLQUFBLE1BQUE7QUFHRSxZQUFVLElBQUEsS0FBQSxDQUFPLDBDQUFBLEdBQXlDLElBQUksQ0FBQyxJQUE5QyxHQUFvRCxtQkFBcEQsR0FBc0UsQ0FBQSxJQUFJLENBQUMsU0FBTCxDQUFlLElBQWYsQ0FBQSxDQUF0RSxHQUEyRixHQUFsRyxDQUFWLENBSEY7S0FGYztFQUFBLENBTmhCLENBQUE7O0FBQUEsbUJBaUJBLGNBQUEsR0FBZ0IsU0FBQyxRQUFELEdBQUE7QUFDZCxRQUFBLHNDQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sRUFBTixDQUFBO0FBQ0EsU0FBQSwrQ0FBQTt1QkFBQTtBQUNFLE1BQUEsR0FBRyxDQUFDLElBQUosQ0FBUyxJQUFDLENBQUEsY0FBRCxDQUFnQixDQUFoQixDQUFULENBQUEsQ0FERjtBQUFBLEtBREE7QUFHQSxTQUFBLDRDQUFBO2tCQUFBO0FBQ0UsTUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBaUIsQ0FBakIsQ0FBQSxDQURGO0FBQUEsS0FIQTtBQUtBLFNBQUEsNENBQUE7a0JBQUE7QUFDRSxNQUFBLElBQUcsQ0FBQSxDQUFLLENBQUMsT0FBRixDQUFBLENBQVA7QUFDRSxRQUFBLElBQUMsQ0FBQSxlQUFlLENBQUMsSUFBakIsQ0FBc0IsQ0FBdEIsQ0FBQSxDQURGO09BREY7QUFBQSxLQUxBO1dBUUEsSUFBQyxDQUFBLGNBQUQsQ0FBQSxFQVRjO0VBQUEsQ0FqQmhCLENBQUE7O0FBQUEsbUJBZ0NBLG1CQUFBLEdBQXFCLFNBQUMsUUFBRCxHQUFBO0FBQ25CLFFBQUEscUJBQUE7QUFBQTtTQUFBLCtDQUFBO3VCQUFBO0FBQ0UsTUFBQSxJQUFPLG1DQUFQO3NCQUNFLElBQUMsQ0FBQSxPQUFELENBQVMsQ0FBVCxHQURGO09BQUEsTUFBQTs4QkFBQTtPQURGO0FBQUE7b0JBRG1CO0VBQUEsQ0FoQ3JCLENBQUE7O0FBQUEsbUJBd0NBLFFBQUEsR0FBVSxTQUFDLFFBQUQsR0FBQTtBQUNSLFFBQUEscUJBQUE7QUFBQTtTQUFBLCtDQUFBO3VCQUFBO0FBQ0Usb0JBQUEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxDQUFULEVBQUEsQ0FERjtBQUFBO29CQURRO0VBQUEsQ0F4Q1YsQ0FBQTs7QUFBQSxtQkErQ0EsT0FBQSxHQUFTLFNBQUMsT0FBRCxHQUFBO0FBRVAsUUFBQSxDQUFBO0FBQUEsSUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLGNBQUQsQ0FBZ0IsT0FBaEIsQ0FBSixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBaUIsQ0FBakIsQ0FEQSxDQUFBO0FBR0EsSUFBQSxJQUFHLENBQUEsQ0FBSyxDQUFDLE9BQUYsQ0FBQSxDQUFQO0FBQ0UsTUFBQSxJQUFDLENBQUEsZUFBZSxDQUFDLElBQWpCLENBQXNCLENBQXRCLENBQUEsQ0FERjtLQUFBLE1BQUE7QUFHRSxNQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFpQixDQUFqQixDQUFBLENBSEY7S0FIQTtXQU9BLElBQUMsQ0FBQSxjQUFELENBQUEsRUFUTztFQUFBLENBL0NULENBQUE7O0FBQUEsbUJBOERBLGNBQUEsR0FBZ0IsU0FBQSxHQUFBO0FBQ2QsUUFBQSxxREFBQTtBQUFBO1dBQU0sSUFBTixHQUFBO0FBQ0UsTUFBQSxVQUFBLEdBQWEsSUFBQyxDQUFBLGVBQWUsQ0FBQyxNQUE5QixDQUFBO0FBQUEsTUFDQSxXQUFBLEdBQWMsRUFEZCxDQUFBO0FBRUE7QUFBQSxXQUFBLDJDQUFBO3NCQUFBO0FBQ0UsUUFBQSxJQUFHLENBQUEsRUFBTSxDQUFDLE9BQUgsQ0FBQSxDQUFQO0FBQ0UsVUFBQSxXQUFXLENBQUMsSUFBWixDQUFpQixFQUFqQixDQUFBLENBREY7U0FBQSxNQUFBO0FBR0UsVUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBaUIsRUFBakIsQ0FBQSxDQUhGO1NBREY7QUFBQSxPQUZBO0FBQUEsTUFPQSxJQUFDLENBQUEsZUFBRCxHQUFtQixXQVBuQixDQUFBO0FBUUEsTUFBQSxJQUFHLElBQUMsQ0FBQSxlQUFlLENBQUMsTUFBakIsS0FBMkIsVUFBOUI7QUFDRSxjQURGO09BQUEsTUFBQTs4QkFBQTtPQVRGO0lBQUEsQ0FBQTtvQkFEYztFQUFBLENBOURoQixDQUFBOztnQkFBQTs7SUFORixDQUFBOztBQUFBLE1Bb0ZNLENBQUMsT0FBUCxHQUFpQixNQXBGakIsQ0FBQTs7OztBQ0hBLElBQUEsMERBQUE7O0FBQUEsd0JBQUEsR0FBMkIsT0FBQSxDQUFRLG9CQUFSLENBQTNCLENBQUE7O0FBQUEsYUFDQSxHQUFnQixPQUFBLENBQVEsa0JBQVIsQ0FEaEIsQ0FBQTs7QUFBQSxNQUVBLEdBQVMsT0FBQSxDQUFRLFdBQVIsQ0FGVCxDQUFBOztBQUFBO0FBYWUsRUFBQSxtQkFBQyxPQUFELEVBQVUsU0FBVixHQUFBO0FBQ1gsUUFBQSxvRUFBQTtBQUFBLElBQUEsSUFBQyxDQUFBLEVBQUQsR0FBVSxJQUFBLGFBQUEsQ0FBYyxPQUFkLENBQVYsQ0FBQTtBQUFBLElBQ0EsVUFBQSxHQUFhLHdCQUFBLENBQXlCLElBQUMsQ0FBQSxFQUExQixDQURiLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxLQUFELEdBQVMsVUFBVSxDQUFDLEtBRnBCLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxNQUFELEdBQWMsSUFBQSxNQUFBLENBQU8sSUFBQyxDQUFBLEVBQVIsRUFBWSxVQUFVLENBQUMsTUFBdkIsQ0FIZCxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsU0FBRCxHQUFpQixJQUFBLFNBQUEsQ0FBVSxJQUFDLENBQUEsTUFBWCxFQUFtQixJQUFDLENBQUEsRUFBcEIsRUFBd0IsVUFBVSxDQUFDLGtCQUFuQyxFQUF1RCxJQUF2RCxDQUpqQixDQUFBO0FBQUEsSUFNQSxTQUFBLEdBQVksSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQXFCLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxTQUFQLENBQWlCO0FBQUEsTUFBQyxPQUFBLEVBQVMsR0FBVjtBQUFBLE1BQWUsU0FBQSxFQUFXLFlBQTFCO0tBQWpCLEVBQTJELE1BQTNELEVBQXNFLE1BQXRFLENBQXJCLENBTlosQ0FBQTtBQUFBLElBT0EsR0FBQSxHQUFZLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFxQixJQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsU0FBUCxDQUFpQjtBQUFBLE1BQUMsT0FBQSxFQUFTLEdBQVY7QUFBQSxNQUFlLFNBQUEsRUFBVyxNQUExQjtLQUFqQixFQUEyRCxTQUEzRCxFQUFzRSxNQUF0RSxDQUFyQixDQVBaLENBQUE7QUFBQSxJQVFBLFNBQVMsQ0FBQyxPQUFWLEdBQW9CLEdBUnBCLENBQUE7QUFBQSxJQVNBLFNBQVMsQ0FBQyxPQUFWLENBQUEsQ0FUQSxDQUFBO0FBQUEsSUFVQSxHQUFHLENBQUMsT0FBSixDQUFBLENBVkEsQ0FBQTtBQUFBLElBV0EsVUFBQSxHQUFpQixJQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsSUFBUCxDQUFZO0FBQUEsTUFBQyxPQUFBLEVBQVMsR0FBVjtBQUFBLE1BQWUsU0FBQSxFQUFXLEdBQTFCO0tBQVosRUFBNEMsU0FBNUMsRUFBdUQsR0FBdkQsQ0FYakIsQ0FBQTtBQUFBLElBWUEsSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQWlCLFVBQWpCLENBQTRCLENBQUMsT0FBN0IsQ0FBQSxDQVpBLENBQUE7QUFBQSxJQWNBLEtBQUEsR0FBUTtBQUFBLE1BQUUsT0FBQSxFQUFTLEdBQVg7QUFBQSxNQUFnQixTQUFBLEVBQVcsSUFBM0I7S0FkUixDQUFBO0FBQUEsSUFlQSxPQUFBLEdBQVU7QUFBQSxNQUFFLE9BQUEsRUFBUyxHQUFYO0FBQUEsTUFBZ0IsU0FBQSxFQUFXLGVBQTNCO0tBZlYsQ0FBQTtBQUFBLElBZ0JBLE9BQUEsR0FBVTtBQUFBLE1BQUUsT0FBQSxFQUFTLEdBQVg7QUFBQSxNQUFnQixTQUFBLEVBQVcsU0FBM0I7S0FoQlYsQ0FBQTtBQUFBLElBaUJBLEdBQUEsR0FBTSxJQUFDLENBQUEsRUFBRSxDQUFDLFlBQUosQ0FBcUIsSUFBQSxJQUFDLENBQUEsS0FBSyxDQUFDLFNBQVAsQ0FBaUIsT0FBakIsRUFBMEIsTUFBMUIsRUFBcUMsT0FBckMsQ0FBckIsQ0FBa0UsQ0FBQyxPQUFuRSxDQUFBLENBakJOLENBQUE7QUFBQSxJQWtCQSxHQUFBLEdBQU0sSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQXFCLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxTQUFQLENBQWlCLE9BQWpCLEVBQTBCLEdBQTFCLEVBQStCLE1BQS9CLENBQXJCLENBQThELENBQUMsT0FBL0QsQ0FBQSxDQWxCTixDQUFBO0FBQUEsSUFtQkEsSUFBQyxDQUFBLFlBQUQsR0FBZ0IsSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQXFCLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxjQUFQLENBQXNCLE1BQXRCLEVBQWlDLEtBQWpDLEVBQXdDLEdBQXhDLEVBQTZDLEdBQTdDLENBQXJCLENBQXNFLENBQUMsT0FBdkUsQ0FBQSxDQW5CaEIsQ0FBQTtBQUFBLElBb0JBLElBQUMsQ0FBQSxZQUFZLENBQUMsT0FBZCxDQUFzQixVQUF0QixFQUFrQztBQUFBLE1BQUUsT0FBQSxFQUFTLEdBQVg7QUFBQSxNQUFnQixTQUFBLEVBQVcsYUFBM0I7S0FBbEMsQ0FwQkEsQ0FEVztFQUFBLENBQWI7O0FBQUEsc0JBMkJBLGNBQUEsR0FBZ0IsU0FBQSxHQUFBO1dBQ2QsSUFBQyxDQUFBLFlBQVksQ0FBQyxHQUFkLENBQUEsRUFEYztFQUFBLENBM0JoQixDQUFBOztBQUFBLHNCQWlDQSxTQUFBLEdBQVcsU0FBQSxHQUFBO1dBQ1QsSUFBQyxDQUFBLE9BRFE7RUFBQSxDQWpDWCxDQUFBOztBQUFBLHNCQXVDQSxZQUFBLEdBQWMsU0FBQSxHQUFBO1dBQ1osSUFBQyxDQUFBLFVBRFc7RUFBQSxDQXZDZCxDQUFBOztBQUFBLHNCQTZDQSxnQkFBQSxHQUFrQixTQUFBLEdBQUE7V0FDaEIsSUFBQyxDQUFBLEdBRGU7RUFBQSxDQTdDbEIsQ0FBQTs7QUFBQSxzQkFxREEsU0FBQSxHQUFXLFNBQUEsR0FBQTtXQUNULElBQUMsQ0FBQSxFQUFFLENBQUMsU0FBSixDQUFBLEVBRFM7RUFBQSxDQXJEWCxDQUFBOztBQUFBLHNCQTJEQSxHQUFBLEdBQUssU0FBQSxHQUFBO1dBQ0gsSUFBQyxDQUFBLGNBQUQsQ0FBQSxDQUFpQixDQUFDLEdBQWxCLENBQUEsRUFERztFQUFBLENBM0RMLENBQUE7O0FBQUEsc0JBaUVBLFVBQUEsR0FBWSxTQUFDLEdBQUQsRUFBTSxPQUFOLEdBQUE7V0FDVixJQUFDLENBQUEsY0FBRCxDQUFBLENBQWlCLENBQUMsVUFBbEIsQ0FBNkIsR0FBN0IsRUFBa0MsT0FBbEMsRUFEVTtFQUFBLENBakVaLENBQUE7O0FBQUEsc0JBdUVBLFVBQUEsR0FBWSxTQUFDLEdBQUQsRUFBTSxNQUFOLEdBQUE7V0FDVixJQUFDLENBQUEsY0FBRCxDQUFBLENBQWlCLENBQUMsVUFBbEIsQ0FBNkIsR0FBN0IsRUFBa0MsTUFBbEMsRUFEVTtFQUFBLENBdkVaLENBQUE7O0FBQUEsc0JBNkVBLElBQUEsR0FBTSxTQUFDLFFBQUQsR0FBQTtXQUNKLElBQUMsQ0FBQSxjQUFELENBQUEsQ0FBaUIsQ0FBQyxJQUFsQixDQUF1QixRQUF2QixFQURJO0VBQUEsQ0E3RU4sQ0FBQTs7QUFBQSxzQkFtRkEsV0FBQSxHQUFhLFNBQUMsSUFBRCxHQUFBO1dBQ1gsSUFBQyxDQUFBLGNBQUQsQ0FBQSxDQUFpQixDQUFDLFdBQWxCLENBQThCLElBQTlCLEVBRFc7RUFBQSxDQW5GYixDQUFBOzttQkFBQTs7SUFiRixDQUFBOztBQUFBLE1Bb0dNLENBQUMsT0FBUCxHQUFpQixTQXBHakIsQ0FBQTs7QUFxR0EsSUFBRyxnREFBSDtBQUNFLEVBQUEsSUFBTyxnQkFBUDtBQUNFLElBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxFQUFYLENBREY7R0FBQTtBQUFBLEVBRUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFULEdBQXFCLFNBRnJCLENBREY7Q0FyR0E7Ozs7QUNLQSxJQUFBLGFBQUE7O0FBQUE7QUFNZSxFQUFBLHVCQUFFLE9BQUYsR0FBQTtBQUNYLElBRFksSUFBQyxDQUFBLFVBQUEsT0FDYixDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsaUJBQUQsR0FBcUIsRUFBckIsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLE1BQUQsR0FBVSxFQURWLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxnQkFBRCxHQUFvQixFQUZwQixDQURXO0VBQUEsQ0FBYjs7QUFBQSwwQkFRQSxTQUFBLEdBQVcsU0FBQSxHQUFBO1dBQ1QsSUFBQyxDQUFBLFFBRFE7RUFBQSxDQVJYLENBQUE7O0FBQUEsMEJBaUJBLDJCQUFBLEdBQTZCLFNBQUEsR0FBQTtXQUMzQjtBQUFBLE1BQ0UsT0FBQSxFQUFVLEdBRFo7QUFBQSxNQUVFLFNBQUEsRUFBWSxHQUZkO01BRDJCO0VBQUEsQ0FqQjdCLENBQUE7O0FBQUEsMEJBMEJBLG1CQUFBLEdBQXFCLFNBQUEsR0FBQTtBQUNuQixRQUFBLG9CQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sRUFBTixDQUFBO0FBQ0E7QUFBQSxTQUFBLFlBQUE7dUJBQUE7QUFDRSxNQUFBLEdBQUksQ0FBQSxJQUFBLENBQUosR0FBWSxHQUFaLENBREY7QUFBQSxLQURBO1dBR0EsSUFKbUI7RUFBQSxDQTFCckIsQ0FBQTs7QUFBQSwwQkFtQ0EsT0FBQSxHQUFTLFNBQUMsWUFBRCxHQUFBO0FBQ1AsUUFBQSxzRUFBQTs7TUFEUSxlQUFhO0tBQ3JCO0FBQUEsSUFBQSxJQUFBLEdBQU8sRUFBUCxDQUFBO0FBQUEsSUFDQSxPQUFBLEdBQVUsU0FBQyxJQUFELEVBQU8sUUFBUCxHQUFBO0FBQ1IsTUFBQSxJQUFHLENBQUssWUFBTCxDQUFBLElBQWUsQ0FBSyxnQkFBTCxDQUFsQjtBQUNFLGNBQVUsSUFBQSxLQUFBLENBQU0sTUFBTixDQUFWLENBREY7T0FBQTthQUVJLDRCQUFKLElBQTJCLFlBQWEsQ0FBQSxJQUFBLENBQWIsSUFBc0IsU0FIekM7SUFBQSxDQURWLENBQUE7QUFNQTtBQUFBLFNBQUEsY0FBQTswQkFBQTtBQUNFLFdBQUEsZ0JBQUE7MkJBQUE7QUFDRSxRQUFBLElBQUcsQ0FBQyxDQUFBLEtBQUksQ0FBTSxRQUFBLENBQVMsUUFBVCxDQUFOLENBQUwsQ0FBQSxJQUFvQyxPQUFBLENBQVEsTUFBUixFQUFnQixRQUFoQixDQUF2QztBQUNFLFVBQUEsTUFBQSxHQUFTLENBQUMsQ0FBQyxPQUFGLENBQUEsQ0FBVCxDQUFBO0FBQ0EsVUFBQSxJQUFHLGlCQUFIO0FBQ0UsWUFBQSxNQUFBLEdBQVMsQ0FBQyxDQUFDLE9BQVgsQ0FBQTtBQUNBLG1CQUFNLHdCQUFBLElBQW9CLE9BQUEsQ0FBUSxNQUFNLENBQUMsT0FBZixFQUF3QixNQUFNLENBQUMsU0FBL0IsQ0FBMUIsR0FBQTtBQUNFLGNBQUEsTUFBQSxHQUFTLE1BQU0sQ0FBQyxPQUFoQixDQURGO1lBQUEsQ0FEQTtBQUFBLFlBR0EsTUFBTSxDQUFDLElBQVAsR0FBYyxNQUFNLENBQUMsTUFBUCxDQUFBLENBSGQsQ0FERjtXQUFBLE1BS0ssSUFBRyxpQkFBSDtBQUNILFlBQUEsTUFBQSxHQUFTLENBQUMsQ0FBQyxPQUFYLENBQUE7QUFDQSxtQkFBTSx3QkFBQSxJQUFvQixPQUFBLENBQVEsTUFBTSxDQUFDLE9BQWYsRUFBd0IsTUFBTSxDQUFDLFNBQS9CLENBQTFCLEdBQUE7QUFDRSxjQUFBLE1BQUEsR0FBUyxNQUFNLENBQUMsT0FBaEIsQ0FERjtZQUFBLENBREE7QUFBQSxZQUdBLE1BQU0sQ0FBQyxJQUFQLEdBQWMsTUFBTSxDQUFDLE1BQVAsQ0FBQSxDQUhkLENBREc7V0FOTDtBQUFBLFVBV0EsSUFBSSxDQUFDLElBQUwsQ0FBVSxNQUFWLENBWEEsQ0FERjtTQURGO0FBQUEsT0FERjtBQUFBLEtBTkE7V0FzQkEsS0F2Qk87RUFBQSxDQW5DVCxDQUFBOztBQUFBLDBCQWlFQSwwQkFBQSxHQUE0QixTQUFDLE9BQUQsR0FBQTtBQUMxQixRQUFBLEdBQUE7QUFBQSxJQUFBLElBQU8sZUFBUDtBQUNFLE1BQUEsT0FBQSxHQUFVLElBQUMsQ0FBQSxPQUFYLENBREY7S0FBQTtBQUVBLElBQUEsSUFBTyx1Q0FBUDtBQUNFLE1BQUEsSUFBQyxDQUFBLGlCQUFrQixDQUFBLE9BQUEsQ0FBbkIsR0FBOEIsQ0FBOUIsQ0FERjtLQUZBO0FBQUEsSUFJQSxHQUFBLEdBQ0U7QUFBQSxNQUFBLFNBQUEsRUFBWSxPQUFaO0FBQUEsTUFDQSxXQUFBLEVBQWMsSUFBQyxDQUFBLGlCQUFrQixDQUFBLE9BQUEsQ0FEakM7S0FMRixDQUFBO0FBQUEsSUFPQSxJQUFDLENBQUEsaUJBQWtCLENBQUEsT0FBQSxDQUFuQixFQVBBLENBQUE7V0FRQSxJQVQwQjtFQUFBLENBakU1QixDQUFBOztBQUFBLDBCQStFQSxZQUFBLEdBQWMsU0FBQyxHQUFELEdBQUE7QUFDWixRQUFBLElBQUE7QUFBQSxJQUFBLElBQUcsR0FBQSxZQUFlLE1BQWxCOzZEQUN3QixDQUFBLEdBQUcsQ0FBQyxTQUFKLFdBRHhCO0tBQUEsTUFFSyxJQUFPLFdBQVA7QUFBQTtLQUFBLE1BQUE7QUFFSCxZQUFVLElBQUEsS0FBQSxDQUFNLGtDQUFOLENBQVYsQ0FGRztLQUhPO0VBQUEsQ0EvRWQsQ0FBQTs7QUFBQSwwQkF5RkEsWUFBQSxHQUFjLFNBQUMsQ0FBRCxHQUFBO0FBQ1osSUFBQSxJQUFPLDhCQUFQO0FBQ0UsTUFBQSxJQUFDLENBQUEsTUFBTyxDQUFBLENBQUMsQ0FBQyxPQUFGLENBQVIsR0FBcUIsRUFBckIsQ0FERjtLQUFBO0FBRUEsSUFBQSxJQUFHLDJDQUFIO0FBQ0UsWUFBVSxJQUFBLEtBQUEsQ0FBTSxvQ0FBTixDQUFWLENBREY7S0FGQTtBQUFBLElBSUEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxDQUFDLENBQUMsT0FBRixDQUFXLENBQUEsQ0FBQyxDQUFDLFNBQUYsQ0FBbkIsR0FBa0MsQ0FKbEMsQ0FBQTtXQUtBLEVBTlk7RUFBQSxDQXpGZCxDQUFBOztBQUFBLDBCQW9HQSxZQUFBLEdBQWMsU0FBQyxDQUFELEdBQUE7QUFDWixJQUFBLElBQU8seUNBQVA7QUFDRSxNQUFBLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxDQUFDLENBQUMsT0FBRixDQUFuQixHQUFnQyxDQUFoQyxDQURGO0tBQUE7QUFFQSxJQUFBLElBQUcsTUFBQSxDQUFBLENBQVEsQ0FBQyxTQUFULEtBQXNCLFFBQXRCLElBQW1DLENBQUMsQ0FBQyxPQUFGLEtBQWUsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUFyRDthQUNFLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxDQUFDLENBQUMsT0FBRixDQUFuQixHQURGO0tBSFk7RUFBQSxDQXBHZCxDQUFBOzt1QkFBQTs7SUFORixDQUFBOztBQUFBLE1Bb0hNLENBQUMsT0FBUCxHQUFpQixhQXBIakIsQ0FBQTs7OztBQ05BLElBQUE7aVNBQUE7O0FBQUEsTUFBTSxDQUFDLE9BQVAsR0FBaUIsU0FBQyxFQUFELEdBQUE7QUFFZixNQUFBLGlGQUFBO0FBQUEsRUFBQSxNQUFBLEdBQVMsRUFBVCxDQUFBO0FBQUEsRUFDQSxrQkFBQSxHQUFxQixFQURyQixDQUFBO0FBQUEsRUFhTTtBQU1TLElBQUEsbUJBQUMsR0FBRCxHQUFBO0FBQ1gsTUFBQSxJQUFPLFdBQVA7QUFDRSxRQUFBLEdBQUEsR0FBTSxFQUFFLENBQUMsMEJBQUgsQ0FBQSxDQUFOLENBREY7T0FBQTtBQUFBLE1BR2EsSUFBQyxDQUFBLGNBQVosVUFERixFQUVnQixJQUFDLENBQUEsZ0JBQWYsWUFKRixDQURXO0lBQUEsQ0FBYjs7QUFBQSx3QkFhQSxFQUFBLEdBQUksU0FBQyxLQUFELEVBQVEsQ0FBUixHQUFBO0FBQ0YsVUFBQSxLQUFBOztRQUFBLElBQUMsQ0FBQSxrQkFBbUI7T0FBcEI7O2FBQ2lCLENBQUEsS0FBQSxJQUFVO09BRDNCO2FBRUEsSUFBQyxDQUFBLGVBQWdCLENBQUEsS0FBQSxDQUFNLENBQUMsSUFBeEIsQ0FBNkIsQ0FBN0IsRUFIRTtJQUFBLENBYkosQ0FBQTs7QUFBQSx3QkFzQkEsU0FBQSxHQUFXLFNBQUMsS0FBRCxFQUFRLElBQVIsR0FBQTtBQUNULFVBQUEsa0NBQUE7QUFBQSxNQUFBLElBQUcsc0VBQUg7QUFDRTtBQUFBO2FBQUEsNENBQUE7d0JBQUE7QUFDRSx3QkFBQSxDQUFDLENBQUMsSUFBRixDQUFPLElBQVAsRUFBVSxLQUFWLEVBQWlCLElBQWpCLEVBQUEsQ0FERjtBQUFBO3dCQURGO09BRFM7SUFBQSxDQXRCWCxDQUFBOztBQUFBLHdCQThCQSxTQUFBLEdBQVcsU0FBQyxDQUFELEdBQUE7YUFDVCxJQUFDLENBQUEsTUFBRCxHQUFVLEVBREQ7SUFBQSxDQTlCWCxDQUFBOztBQUFBLHdCQW9DQSxTQUFBLEdBQVcsU0FBQSxHQUFBO2FBQ1QsSUFBQyxDQUFBLE9BRFE7SUFBQSxDQXBDWCxDQUFBOztBQUFBLHdCQTBDQSxNQUFBLEdBQVEsU0FBQSxHQUFBO2FBQ047QUFBQSxRQUFFLFNBQUEsRUFBVyxJQUFDLENBQUEsT0FBZDtBQUFBLFFBQXVCLFdBQUEsRUFBYSxJQUFDLENBQUEsU0FBckM7UUFETTtJQUFBLENBMUNSLENBQUE7O0FBQUEsd0JBaURBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLFdBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxXQUFELEdBQWUsSUFBZixDQUFBO0FBQ0EsV0FBQSx5REFBQTttQ0FBQTtBQUNFLFFBQUEsQ0FBQSxDQUFFLElBQUMsQ0FBQSxPQUFELENBQUEsQ0FBRixDQUFBLENBREY7QUFBQSxPQURBO2FBR0EsS0FKTztJQUFBLENBakRULENBQUE7O0FBQUEsd0JBeUVBLGFBQUEsR0FBZSxTQUFDLElBQUQsRUFBTyxFQUFQLEdBQUE7QUFPYixNQUFBLElBQUcsMENBQUg7ZUFFRSxJQUFFLENBQUEsSUFBQSxDQUFGLEdBQVUsR0FGWjtPQUFBLE1BR0ssSUFBRyxVQUFIOztVQUVILElBQUMsQ0FBQSxZQUFhO1NBQWQ7ZUFDQSxJQUFDLENBQUEsU0FBVSxDQUFBLElBQUEsQ0FBWCxHQUFtQixHQUhoQjtPQVZRO0lBQUEsQ0F6RWYsQ0FBQTs7QUFBQSx3QkErRkEsdUJBQUEsR0FBeUIsU0FBQSxHQUFBO0FBQ3ZCLFVBQUEsK0NBQUE7QUFBQSxNQUFBLGNBQUEsR0FBaUIsRUFBakIsQ0FBQTtBQUFBLE1BQ0EsT0FBQSxHQUFVLElBRFYsQ0FBQTtBQUVBO0FBQUEsV0FBQSxZQUFBOzRCQUFBO0FBQ0UsUUFBQSxFQUFBLEdBQUssRUFBRSxDQUFDLFlBQUgsQ0FBZ0IsTUFBaEIsQ0FBTCxDQUFBO0FBQ0EsUUFBQSxJQUFHLEVBQUg7QUFDRSxVQUFBLElBQUUsQ0FBQSxJQUFBLENBQUYsR0FBVSxFQUFWLENBREY7U0FBQSxNQUFBO0FBR0UsVUFBQSxjQUFlLENBQUEsSUFBQSxDQUFmLEdBQXVCLE1BQXZCLENBQUE7QUFBQSxVQUNBLE9BQUEsR0FBVSxLQURWLENBSEY7U0FGRjtBQUFBLE9BRkE7QUFBQSxNQVNBLE1BQUEsQ0FBQSxJQUFRLENBQUEsU0FUUixDQUFBO0FBVUEsTUFBQSxJQUFHLENBQUEsT0FBSDtBQUNFLFFBQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxjQUFiLENBREY7T0FWQTthQVlBLFFBYnVCO0lBQUEsQ0EvRnpCLENBQUE7O3FCQUFBOztNQW5CRixDQUFBO0FBQUEsRUFzSU07QUFNSiw2QkFBQSxDQUFBOztBQUFhLElBQUEsZ0JBQUMsR0FBRCxFQUFNLE9BQU4sR0FBQTtBQUNYLE1BQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBQUEsQ0FBQTtBQUFBLE1BQ0Esd0NBQU0sR0FBTixDQURBLENBRFc7SUFBQSxDQUFiOztBQUFBLHFCQVNBLE9BQUEsR0FBUyxTQUFBLEdBQUE7YUFDUDtBQUFBLFFBQ0UsTUFBQSxFQUFRLFFBRFY7QUFBQSxRQUVFLEtBQUEsRUFBTyxJQUFDLENBQUEsTUFBRCxDQUFBLENBRlQ7QUFBQSxRQUdFLFNBQUEsRUFBVyxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUhiO1FBRE87SUFBQSxDQVRULENBQUE7O0FBQUEscUJBb0JBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxNQUFBLElBQUcsSUFBQyxDQUFBLHVCQUFELENBQUEsQ0FBSDtBQUNFLFFBQUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxXQUFULENBQXFCLElBQXJCLENBQUEsQ0FBQTtlQUNBLHFDQUFBLFNBQUEsRUFGRjtPQUFBLE1BQUE7ZUFJRSxNQUpGO09BRE87SUFBQSxDQXBCVCxDQUFBOztrQkFBQTs7S0FObUIsVUF0SXJCLENBQUE7QUFBQSxFQTBLQSxNQUFPLENBQUEsUUFBQSxDQUFQLEdBQW1CLFNBQUMsQ0FBRCxHQUFBO0FBQ2pCLFFBQUEsZ0JBQUE7QUFBQSxJQUNVLFFBQVIsTUFERixFQUVhLGdCQUFYLFVBRkYsQ0FBQTtXQUlJLElBQUEsTUFBQSxDQUFPLEdBQVAsRUFBWSxXQUFaLEVBTGE7RUFBQSxDQTFLbkIsQ0FBQTtBQUFBLEVBMExNO0FBU0osNkJBQUEsQ0FBQTs7QUFBYSxJQUFBLGdCQUFDLEdBQUQsRUFBTSxPQUFOLEVBQWUsT0FBZixFQUF3QixNQUF4QixHQUFBO0FBQ1gsTUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLFNBQWYsRUFBMEIsT0FBMUIsQ0FBQSxDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsYUFBRCxDQUFlLFNBQWYsRUFBMEIsT0FBMUIsQ0FEQSxDQUFBO0FBRUEsTUFBQSxJQUFHLGNBQUg7QUFDRSxRQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixNQUF6QixDQUFBLENBREY7T0FBQSxNQUFBO0FBR0UsUUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLFFBQWYsRUFBeUIsT0FBekIsQ0FBQSxDQUhGO09BRkE7QUFBQSxNQU1BLHdDQUFNLEdBQU4sQ0FOQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSxxQkFZQSxXQUFBLEdBQWEsU0FBQyxDQUFELEdBQUE7O1FBQ1gsSUFBQyxDQUFBLGFBQWM7T0FBZjtBQUFBLE1BQ0EsSUFBQyxDQUFBLFVBQVUsQ0FBQyxJQUFaLENBQWlCLENBQWpCLENBREEsQ0FBQTtBQUVBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLElBQUMsQ0FBQSxVQUFVLENBQUMsTUFBWixLQUFzQixDQUF0QztlQUVFLElBQUMsQ0FBQSxNQUFNLENBQUMsU0FBUixDQUFrQixRQUFsQixFQUE0QixJQUE1QixFQUZGO09BSFc7SUFBQSxDQVpiLENBQUE7O0FBQUEscUJBc0JBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVCxVQUFBLElBQUE7cURBQVcsQ0FBRSxnQkFBYixHQUFzQixFQURiO0lBQUEsQ0F0QlgsQ0FBQTs7QUFBQSxxQkE2QkEsbUJBQUEsR0FBcUIsU0FBQSxHQUFBO0FBQ25CLFVBQUEsSUFBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLENBQUosQ0FBQTtBQUFBLE1BQ0EsQ0FBQSxHQUFJLElBQUMsQ0FBQSxPQURMLENBQUE7QUFFQSxhQUFNLElBQU4sR0FBQTtBQUNFLFFBQUEsSUFBRyxJQUFDLENBQUEsTUFBRCxLQUFXLENBQWQ7QUFDRSxnQkFERjtTQUFBO0FBQUEsUUFFQSxDQUFBLEVBRkEsQ0FBQTtBQUlBLFFBQUEsSUFBRyxJQUFBLEtBQUssSUFBQyxDQUFBLE9BQVQ7QUFDRSxnQkFBVSxJQUFBLEtBQUEsQ0FBTSw0QkFBTixDQUFWLENBREY7U0FKQTtBQUFBLFFBTUEsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQU5OLENBREY7TUFBQSxDQUZBO2FBVUEsRUFYbUI7SUFBQSxDQTdCckIsQ0FBQTs7QUFBQSxxQkE4Q0EsU0FBQSxHQUFXLFNBQUEsR0FBQTtBQUNULFVBQUEsQ0FBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxPQUFMLENBQUE7QUFBQSxNQUNBLENBQUE7QUFBQSxRQUFBLE1BQUEsRUFBUSxTQUFDLE9BQUQsRUFBUyxPQUFULEdBQUE7QUFDTixjQUFBLFFBQUE7QUFBQTtpQkFBTSxJQUFOLEdBQUE7QUFDRSxZQUFBLElBQUcsQ0FBQyxDQUFDLFNBQUYsQ0FBQSxDQUFIOzRCQUNFLENBQUEsR0FBSSxDQUFFLENBQUEsT0FBQSxHQURSO2FBQUEsTUFBQTtBQUdFLGNBQUEsSUFBRSxDQUFBLE9BQUEsQ0FBRixHQUFhLENBQWIsQ0FBQTtBQUVBLG9CQUxGO2FBREY7VUFBQSxDQUFBOzBCQURNO1FBQUEsQ0FBUjtPQUFBLENBREEsQ0FBQTtBQUFBLE1BU0EsTUFBQSxDQUFPLFNBQVAsRUFBa0IsU0FBbEIsQ0FUQSxDQUFBO2FBVUEsTUFBQSxDQUFPLFNBQVAsRUFBa0IsU0FBbEIsRUFYUztJQUFBLENBOUNYLENBQUE7O0FBQUEscUJBaUVBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLG9EQUFBO0FBQUEsTUFBQSxJQUFHLHdCQUFIO0FBQ0UsZUFBTyxJQUFQLENBREY7T0FBQTtBQUVBLE1BQUEsSUFBRyxDQUFBLElBQUssQ0FBQSx1QkFBRCxDQUFBLENBQVA7QUFDRSxlQUFPLEtBQVAsQ0FERjtPQUFBLE1BQUE7QUFHRSxRQUFBLHlDQUFXLENBQUUsdUJBQVYsQ0FBQSxXQUFBLDJDQUFnRCxDQUFFLHVCQUFWLENBQUEsV0FBeEMsSUFBZ0YsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEtBQXNCLElBQXpHO0FBQ0UsVUFBQSxrQkFBQSxHQUFxQixDQUFyQixDQUFBO0FBQUEsVUFDQSxDQUFBLEdBQUksSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQURiLENBQUE7QUFBQSxVQUVBLENBQUEsR0FBSSxDQUZKLENBQUE7QUFlQSxpQkFBTSxJQUFOLEdBQUE7QUFDRSxZQUFBLElBQU8sU0FBUDtBQUVFLGNBQUEsT0FBTyxDQUFDLEdBQVIsQ0FBWSxJQUFJLENBQUMsU0FBTCxDQUFlLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBQWYsQ0FBWixDQUFBLENBQUE7QUFBQSxjQUNBLE9BQU8sQ0FBQyxHQUFSLENBQVksSUFBSSxDQUFDLFNBQUwsQ0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFmLENBQVosQ0FEQSxDQUZGO2FBQUE7QUFJQSxZQUFBLElBQUcsQ0FBQSxLQUFPLElBQUMsQ0FBQSxPQUFYO0FBRUUsY0FBQSxJQUFHLENBQUMsQ0FBQyxtQkFBRixDQUFBLENBQUEsS0FBMkIsQ0FBOUI7QUFFRSxnQkFBQSxJQUFHLENBQUMsQ0FBQyxPQUFGLEdBQVksSUFBQyxDQUFBLE9BQWhCO0FBQ0Usa0JBQUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxDQUFYLENBQUE7QUFBQSxrQkFDQSxrQkFBQSxHQUFxQixDQUFBLEdBQUksQ0FEekIsQ0FERjtpQkFBQSxNQUFBO0FBQUE7aUJBRkY7ZUFBQSxNQU9LLElBQUcsQ0FBQyxDQUFDLG1CQUFGLENBQUEsQ0FBQSxHQUEwQixDQUE3QjtBQUVILGdCQUFBLElBQUcsQ0FBQSxHQUFJLGtCQUFKLElBQTBCLENBQUMsQ0FBQyxtQkFBRixDQUFBLENBQTdCO0FBQ0Usa0JBQUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxDQUFYLENBQUE7QUFBQSxrQkFDQSxrQkFBQSxHQUFxQixDQUFBLEdBQUksQ0FEekIsQ0FERjtpQkFBQSxNQUFBO0FBQUE7aUJBRkc7ZUFBQSxNQUFBO0FBU0gsc0JBVEc7ZUFQTDtBQUFBLGNBaUJBLENBQUEsRUFqQkEsQ0FBQTtBQUFBLGNBa0JBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FsQk4sQ0FGRjthQUFBLE1BQUE7QUF1QkUsb0JBdkJGO2FBTEY7VUFBQSxDQWZBO0FBQUEsVUE2Q0EsSUFBQyxDQUFBLE9BQUQsR0FBVyxJQUFDLENBQUEsT0FBTyxDQUFDLE9BN0NwQixDQUFBO0FBQUEsVUE4Q0EsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLElBOUNuQixDQUFBO0FBQUEsVUErQ0EsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLElBL0NuQixDQURGO1NBQUE7QUFBQSxRQWlEQSxNQUFBLHlDQUFpQixDQUFFLFNBQVYsQ0FBQSxVQWpEVCxDQUFBO0FBa0RBLFFBQUEsSUFBRyxjQUFIO0FBQ0UsVUFBQSxJQUFDLENBQUEsU0FBRCxDQUFXLE1BQVgsQ0FBQSxDQUFBO0FBQUEsVUFDQSxJQUFDLENBQUEsTUFBTSxDQUFDLFNBQVIsQ0FBa0IsUUFBbEIsRUFBNEIsSUFBNUIsQ0FEQSxDQURGO1NBbERBO2VBcURBLHFDQUFBLFNBQUEsRUF4REY7T0FITztJQUFBLENBakVULENBQUE7O0FBQUEscUJBaUlBLFdBQUEsR0FBYSxTQUFBLEdBQUE7QUFDWCxVQUFBLGNBQUE7QUFBQSxNQUFBLFFBQUEsR0FBVyxDQUFYLENBQUE7QUFBQSxNQUNBLElBQUEsR0FBTyxJQUFDLENBQUEsT0FEUixDQUFBO0FBRUEsYUFBTSxJQUFOLEdBQUE7QUFDRSxRQUFBLElBQUcsSUFBQSxZQUFnQixTQUFuQjtBQUNFLGdCQURGO1NBQUE7QUFFQSxRQUFBLElBQUcsd0JBQUEsSUFBb0IsQ0FBQSxJQUFRLENBQUMsU0FBTCxDQUFBLENBQTNCO0FBQ0UsVUFBQSxRQUFBLEVBQUEsQ0FERjtTQUZBO0FBQUEsUUFJQSxJQUFBLEdBQU8sSUFBSSxDQUFDLE9BSlosQ0FERjtNQUFBLENBRkE7YUFRQSxTQVRXO0lBQUEsQ0FqSWIsQ0FBQTs7a0JBQUE7O0tBVG1CLFVBMUxyQixDQUFBO0FBQUEsRUFpVk07QUFNSixzQ0FBQSxDQUFBOztBQUFhLElBQUEseUJBQUMsR0FBRCxFQUFPLE9BQVAsRUFBZ0IsSUFBaEIsRUFBc0IsSUFBdEIsRUFBNEIsTUFBNUIsR0FBQTtBQUNYLE1BRGlCLElBQUMsQ0FBQSxVQUFBLE9BQ2xCLENBQUE7QUFBQSxNQUFBLGlEQUFNLEdBQU4sRUFBVyxJQUFYLEVBQWlCLElBQWpCLEVBQXVCLE1BQXZCLENBQUEsQ0FEVztJQUFBLENBQWI7O0FBQUEsOEJBTUEsR0FBQSxHQUFNLFNBQUEsR0FBQTthQUNKLElBQUMsQ0FBQSxRQURHO0lBQUEsQ0FOTixDQUFBOztBQUFBLDhCQVlBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLElBQUE7QUFBQSxNQUFBLElBQUEsR0FBTztBQUFBLFFBQ0wsTUFBQSxFQUFRLGlCQURIO0FBQUEsUUFFTCxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZIO0FBQUEsUUFHTCxTQUFBLEVBQVksSUFBQyxDQUFBLE9BSFI7T0FBUCxDQUFBO0FBS0EsTUFBQSxJQUFHLG9CQUFIO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQURGO09BTEE7QUFPQSxNQUFBLElBQUcsb0JBQUg7QUFDRSxRQUFBLElBQUssQ0FBQSxNQUFBLENBQUwsR0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFmLENBREY7T0FQQTtBQVNBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBQyxDQUFBLE9BQTlCO0FBQ0UsUUFBQSxJQUFLLENBQUEsUUFBQSxDQUFMLEdBQWlCLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBUixDQUFBLENBQWpCLENBREY7T0FUQTthQVdBLEtBWk87SUFBQSxDQVpULENBQUE7OzJCQUFBOztLQU40QixPQWpWOUIsQ0FBQTtBQUFBLEVBaVhBLE1BQU8sQ0FBQSxpQkFBQSxDQUFQLEdBQTRCLFNBQUMsSUFBRCxHQUFBO0FBQzFCLFFBQUEsZ0NBQUE7QUFBQSxJQUNVLFdBQVIsTUFERixFQUVjLGVBQVosVUFGRixFQUdVLFlBQVIsT0FIRixFQUlVLFlBQVIsT0FKRixFQUthLGNBQVgsU0FMRixDQUFBO1dBT0ksSUFBQSxlQUFBLENBQWdCLEdBQWhCLEVBQXFCLE9BQXJCLEVBQThCLElBQTlCLEVBQW9DLElBQXBDLEVBQTBDLE1BQTFDLEVBUnNCO0VBQUEsQ0FqWDVCLENBQUE7QUFBQSxFQWdZTTtBQVFKLGdDQUFBLENBQUE7O0FBQWEsSUFBQSxtQkFBQyxHQUFELEVBQU0sT0FBTixFQUFlLE9BQWYsRUFBd0IsTUFBeEIsR0FBQTtBQUNYLE1BQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBQUEsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBREEsQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxRQUFmLEVBQXlCLE9BQXpCLENBRkEsQ0FBQTtBQUFBLE1BR0EsMkNBQU0sR0FBTixDQUhBLENBRFc7SUFBQSxDQUFiOztBQUFBLHdCQVNBLFNBQUEsR0FBVyxTQUFBLEdBQUE7YUFDVCxNQURTO0lBQUEsQ0FUWCxDQUFBOztBQUFBLHdCQWVBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLFdBQUE7QUFBQSxNQUFBLElBQUcsb0VBQUg7ZUFDRSx3Q0FBQSxTQUFBLEVBREY7T0FBQSxNQUVLLDRDQUFlLENBQUEsU0FBQSxVQUFmO0FBQ0gsUUFBQSxJQUFHLElBQUMsQ0FBQSx1QkFBRCxDQUFBLENBQUg7QUFDRSxVQUFBLElBQUcsNEJBQUg7QUFDRSxrQkFBVSxJQUFBLEtBQUEsQ0FBTSxnQ0FBTixDQUFWLENBREY7V0FBQTtBQUFBLFVBRUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLElBRm5CLENBQUE7QUFBQSxVQUdBLE1BQUEsQ0FBQSxJQUFRLENBQUEsT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUgxQixDQUFBO2lCQUlBLHdDQUFBLFNBQUEsRUFMRjtTQUFBLE1BQUE7aUJBT0UsTUFQRjtTQURHO09BQUEsTUFTQSxJQUFHLHNCQUFBLElBQWtCLDhCQUFyQjtBQUNILFFBQUEsTUFBQSxDQUFBLElBQVEsQ0FBQSxPQUFPLENBQUMsU0FBUyxDQUFDLE9BQTFCLENBQUE7ZUFDQSxJQUFDLENBQUEsT0FBTyxDQUFDLE9BQVQsR0FBbUIsS0FGaEI7T0FBQSxNQUdBLElBQUcsc0JBQUEsSUFBYSxzQkFBaEI7ZUFDSCx3Q0FBQSxTQUFBLEVBREc7T0FBQSxNQUFBO0FBR0gsY0FBVSxJQUFBLEtBQUEsQ0FBTSxvQ0FBTixDQUFWLENBSEc7T0FmRTtJQUFBLENBZlQsQ0FBQTs7QUFBQSx3QkFzQ0EsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLFVBQUEsV0FBQTthQUFBO0FBQUEsUUFDRSxNQUFBLEVBQVMsV0FEWDtBQUFBLFFBRUUsS0FBQSxFQUFRLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FGVjtBQUFBLFFBR0UsTUFBQSxzQ0FBaUIsQ0FBRSxNQUFWLENBQUEsVUFIWDtBQUFBLFFBSUUsTUFBQSx3Q0FBaUIsQ0FBRSxNQUFWLENBQUEsVUFKWDtRQURPO0lBQUEsQ0F0Q1QsQ0FBQTs7cUJBQUE7O0tBUnNCLFVBaFl4QixDQUFBO0FBQUEsRUFzYkEsTUFBTyxDQUFBLFdBQUEsQ0FBUCxHQUFzQixTQUFDLElBQUQsR0FBQTtBQUNwQixRQUFBLGVBQUE7QUFBQSxJQUNRLFdBQVIsTUFEQSxFQUVTLFlBQVQsT0FGQSxFQUdTLFlBQVQsT0FIQSxDQUFBO1dBS0ksSUFBQSxTQUFBLENBQVUsR0FBVixFQUFlLElBQWYsRUFBcUIsSUFBckIsRUFOZ0I7RUFBQSxDQXRidEIsQ0FBQTtTQStiQTtBQUFBLElBQ0UsT0FBQSxFQUNFO0FBQUEsTUFBQSxRQUFBLEVBQVcsTUFBWDtBQUFBLE1BQ0EsUUFBQSxFQUFXLE1BRFg7QUFBQSxNQUVBLFdBQUEsRUFBYSxTQUZiO0FBQUEsTUFHQSxXQUFBLEVBQWEsU0FIYjtBQUFBLE1BSUEsaUJBQUEsRUFBb0IsZUFKcEI7S0FGSjtBQUFBLElBT0UsUUFBQSxFQUFXLE1BUGI7QUFBQSxJQVFFLG9CQUFBLEVBQXVCLGtCQVJ6QjtJQWpjZTtBQUFBLENBQWpCLENBQUE7Ozs7QUNBQSxJQUFBLHlCQUFBO0VBQUE7aVNBQUE7O0FBQUEseUJBQUEsR0FBNEIsT0FBQSxDQUFRLGNBQVIsQ0FBNUIsQ0FBQTs7QUFBQSxNQUVNLENBQUMsT0FBUCxHQUFpQixTQUFDLEVBQUQsR0FBQTtBQUNmLE1BQUEseUZBQUE7QUFBQSxFQUFBLFdBQUEsR0FBYyx5QkFBQSxDQUEwQixFQUExQixDQUFkLENBQUE7QUFBQSxFQUNBLEtBQUEsR0FBUSxXQUFXLENBQUMsS0FEcEIsQ0FBQTtBQUFBLEVBRUEsTUFBQSxHQUFTLFdBQVcsQ0FBQyxNQUZyQixDQUFBO0FBQUEsRUFPTTtBQUtKLGlDQUFBLENBQUE7O0FBQWEsSUFBQSxvQkFBQyxHQUFELEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxHQUFELEdBQU8sRUFBUCxDQUFBO0FBQUEsTUFDQSw0Q0FBTSxHQUFOLENBREEsQ0FEVztJQUFBLENBQWI7O0FBQUEseUJBT0EsR0FBQSxHQUFLLFNBQUMsSUFBRCxFQUFPLE9BQVAsR0FBQTtBQUNILFVBQUEsMkJBQUE7QUFBQSxNQUFBLElBQUcsZUFBSDtBQUNFLFFBQUEsSUFBTyxzQkFBUDtBQUNFLFVBQUEsRUFBRSxDQUFDLFlBQUgsQ0FBb0IsSUFBQSxPQUFBLENBQVEsTUFBUixFQUFtQixJQUFuQixFQUFzQixJQUF0QixDQUFwQixDQUErQyxDQUFDLE9BQWhELENBQUEsQ0FBQSxDQURGO1NBQUE7QUFBQSxRQUVBLElBQUMsQ0FBQSxHQUFJLENBQUEsSUFBQSxDQUFLLENBQUMsT0FBWCxDQUFtQixPQUFuQixDQUZBLENBQUE7ZUFHQSxLQUpGO09BQUEsTUFLSyxJQUFHLFlBQUg7QUFDSCxRQUFBLEdBQUEseUNBQWdCLENBQUUsR0FBWixDQUFBLFVBQU4sQ0FBQTtBQUNBLFFBQUEsSUFBRyxHQUFBLFlBQWUsS0FBSyxDQUFDLGVBQXhCO2lCQUNFLEdBQUcsQ0FBQyxHQUFKLENBQUEsRUFERjtTQUFBLE1BQUE7aUJBR0UsSUFIRjtTQUZHO09BQUEsTUFBQTtBQU9ILFFBQUEsTUFBQSxHQUFTLEVBQVQsQ0FBQTtBQUNBO0FBQUEsYUFBQSxhQUFBOzBCQUFBO0FBQ0UsVUFBQSxHQUFBLEdBQU0sQ0FBQyxDQUFDLEdBQUYsQ0FBQSxDQUFOLENBQUE7QUFDQSxVQUFBLElBQUcsR0FBQSxZQUFlLEtBQUssQ0FBQyxlQUFyQixJQUF3QyxHQUFBLFlBQWUsVUFBMUQ7QUFDRSxZQUFBLEdBQUEsR0FBTSxHQUFHLENBQUMsR0FBSixDQUFBLENBQU4sQ0FERjtXQURBO0FBQUEsVUFHQSxNQUFPLENBQUEsSUFBQSxDQUFQLEdBQWUsR0FIZixDQURGO0FBQUEsU0FEQTtlQU1BLE9BYkc7T0FORjtJQUFBLENBUEwsQ0FBQTs7c0JBQUE7O0tBTHVCLEtBQUssQ0FBQyxVQVAvQixDQUFBO0FBQUEsRUE4Q007QUFPSiw4QkFBQSxDQUFBOztBQUFhLElBQUEsaUJBQUMsR0FBRCxFQUFNLFdBQU4sRUFBb0IsSUFBcEIsR0FBQTtBQUNYLE1BRDhCLElBQUMsQ0FBQSxPQUFBLElBQy9CLENBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsYUFBZixFQUE4QixXQUE5QixDQUFBLENBQUE7QUFBQSxNQUNBLHlDQUFNLEdBQU4sQ0FEQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSxzQkFVQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxpQ0FBQTtBQUFBLE1BQUEsSUFBRyxDQUFBLElBQUssQ0FBQSx1QkFBRCxDQUFBLENBQVA7QUFDRSxlQUFPLEtBQVAsQ0FERjtPQUFBLE1BQUE7QUFHRSxRQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsV0FBVyxDQUFDLE1BQWIsQ0FBQSxDQUFSLENBQUE7QUFBQSxRQUNBLEtBQUssQ0FBQyxTQUFOLEdBQW1CLEdBQUEsR0FBRSxLQUFLLENBQUMsU0FBUixHQUFtQixNQUFuQixHQUF3QixJQUFDLENBQUEsSUFENUMsQ0FBQTtBQUVBLFFBQUEsSUFBTyw4QkFBUDtBQUNFLFVBQUEsT0FBQSxHQUFVLElBQUMsQ0FBQSxXQUFXLENBQUMsTUFBYixDQUFBLENBQVYsQ0FBQTtBQUFBLFVBQ0EsT0FBTyxDQUFDLFNBQVIsR0FBcUIsR0FBQSxHQUFFLE9BQU8sQ0FBQyxTQUFWLEdBQXFCLE1BQXJCLEdBQTBCLElBQUMsQ0FBQSxJQUEzQixHQUFpQyxZQUR0RCxDQUFBO0FBQUEsVUFFQSxPQUFBLEdBQVUsSUFBQyxDQUFBLFdBQVcsQ0FBQyxNQUFiLENBQUEsQ0FGVixDQUFBO0FBQUEsVUFHQSxPQUFPLENBQUMsU0FBUixHQUFxQixHQUFBLEdBQUUsT0FBTyxDQUFDLFNBQVYsR0FBcUIsTUFBckIsR0FBMEIsSUFBQyxDQUFBLElBQTNCLEdBQWlDLE1BSHRELENBQUE7QUFBQSxVQUlBLEdBQUEsR0FBTSxFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLEtBQUssQ0FBQyxTQUFOLENBQWdCLE9BQWhCLEVBQXlCLE1BQXpCLEVBQW9DLE9BQXBDLENBQXBCLENBQWdFLENBQUMsT0FBakUsQ0FBQSxDQUpOLENBQUE7QUFBQSxVQUtBLEdBQUEsR0FBTSxFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLEtBQUssQ0FBQyxTQUFOLENBQWdCLE9BQWhCLEVBQXlCLEdBQXpCLEVBQThCLE1BQTlCLENBQXBCLENBQTRELENBQUMsT0FBN0QsQ0FBQSxDQUxOLENBQUE7QUFBQSxVQU1BLElBQUMsQ0FBQSxXQUFXLENBQUMsR0FBSSxDQUFBLElBQUMsQ0FBQSxJQUFELENBQWpCLEdBQTBCLEVBQUUsQ0FBQyxZQUFILENBQW9CLElBQUEsY0FBQSxDQUFlLE1BQWYsRUFBMEIsS0FBMUIsRUFBaUMsR0FBakMsRUFBc0MsR0FBdEMsQ0FBcEIsQ0FBOEQsQ0FBQyxPQUEvRCxDQUFBLENBTjFCLENBREY7U0FGQTtlQVVBLHNDQUFBLFNBQUEsRUFiRjtPQURPO0lBQUEsQ0FWVCxDQUFBOztBQUFBLHNCQTZCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO2FBQ1A7QUFBQSxRQUNFLE1BQUEsRUFBUyxTQURYO0FBQUEsUUFFRSxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZWO0FBQUEsUUFHRSxhQUFBLEVBQWdCLElBQUMsQ0FBQSxXQUFXLENBQUMsTUFBYixDQUFBLENBSGxCO0FBQUEsUUFJRSxNQUFBLEVBQVMsSUFBQyxDQUFBLElBSlo7UUFETztJQUFBLENBN0JULENBQUE7O21CQUFBOztLQVBvQixLQUFLLENBQUMsVUE5QzVCLENBQUE7QUFBQSxFQTBGQSxNQUFPLENBQUEsU0FBQSxDQUFQLEdBQW9CLFNBQUMsSUFBRCxHQUFBO0FBQ2xCLFFBQUEsc0JBQUE7QUFBQSxJQUNrQixtQkFBaEIsY0FERixFQUVVLFdBQVIsTUFGRixFQUdXLFlBQVQsT0FIRixDQUFBO1dBS0ksSUFBQSxPQUFBLENBQVEsR0FBUixFQUFhLFdBQWIsRUFBMEIsSUFBMUIsRUFOYztFQUFBLENBMUZwQixDQUFBO0FBQUEsRUFxR007QUFPSixrQ0FBQSxDQUFBOztBQUFhLElBQUEscUJBQUMsR0FBRCxFQUFNLFNBQU4sRUFBaUIsR0FBakIsRUFBc0IsSUFBdEIsRUFBNEIsSUFBNUIsRUFBa0MsTUFBbEMsR0FBQTtBQUNYLE1BQUEsSUFBRyxtQkFBQSxJQUFlLGFBQWxCO0FBQ0UsUUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLFdBQWYsRUFBNEIsU0FBNUIsQ0FBQSxDQUFBO0FBQUEsUUFDQSxJQUFDLENBQUEsYUFBRCxDQUFlLEtBQWYsRUFBc0IsR0FBdEIsQ0FEQSxDQURGO09BQUEsTUFBQTtBQUlFLFFBQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLEtBQUssQ0FBQyxTQUFOLENBQWdCLE1BQWhCLEVBQTJCLE1BQTNCLEVBQXNDLE1BQXRDLENBQXBCLENBQWIsQ0FBQTtBQUFBLFFBQ0EsSUFBQyxDQUFBLEdBQUQsR0FBYSxFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLEtBQUssQ0FBQyxTQUFOLENBQWdCLE1BQWhCLEVBQTJCLElBQUMsQ0FBQSxTQUE1QixFQUF1QyxNQUF2QyxDQUFwQixDQURiLENBQUE7QUFBQSxRQUVBLElBQUMsQ0FBQSxTQUFTLENBQUMsT0FBWCxHQUFxQixJQUFDLENBQUEsR0FGdEIsQ0FBQTtBQUFBLFFBR0EsSUFBQyxDQUFBLFNBQVMsQ0FBQyxPQUFYLENBQUEsQ0FIQSxDQUFBO0FBQUEsUUFJQSxJQUFDLENBQUEsR0FBRyxDQUFDLE9BQUwsQ0FBQSxDQUpBLENBSkY7T0FBQTtBQUFBLE1BU0EsNkNBQU0sR0FBTixFQUFXLElBQVgsRUFBaUIsSUFBakIsRUFBdUIsTUFBdkIsQ0FUQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSwwQkFZQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsTUFBQSxJQUFHLElBQUMsQ0FBQSx1QkFBRCxDQUFBLENBQUg7QUFDRSxRQUFBLElBQUMsQ0FBQSxTQUFTLENBQUMsU0FBWCxDQUFxQixJQUFyQixDQUFBLENBQUE7QUFBQSxRQUNBLElBQUMsQ0FBQSxHQUFHLENBQUMsU0FBTCxDQUFlLElBQWYsQ0FEQSxDQUFBO2VBRUEsMENBQUEsU0FBQSxFQUhGO09BQUEsTUFBQTtlQUtFLE1BTEY7T0FETztJQUFBLENBWlQsQ0FBQTs7QUFBQSwwQkFxQkEsZ0JBQUEsR0FBa0IsU0FBQSxHQUFBO2FBQ2hCLElBQUMsQ0FBQSxHQUFHLENBQUMsUUFEVztJQUFBLENBckJsQixDQUFBOztBQUFBLDBCQXlCQSxpQkFBQSxHQUFtQixTQUFBLEdBQUE7YUFDakIsSUFBQyxDQUFBLFNBQVMsQ0FBQyxRQURNO0lBQUEsQ0F6Qm5CLENBQUE7O0FBQUEsMEJBOEJBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLFNBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsU0FBUyxDQUFDLE9BQWYsQ0FBQTtBQUFBLE1BQ0EsTUFBQSxHQUFTLEVBRFQsQ0FBQTtBQUVBLGFBQU0sQ0FBQSxLQUFPLElBQUMsQ0FBQSxHQUFkLEdBQUE7QUFDRSxRQUFBLE1BQU0sQ0FBQyxJQUFQLENBQVksQ0FBWixDQUFBLENBQUE7QUFBQSxRQUNBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FETixDQURGO01BQUEsQ0FGQTthQUtBLE9BTk87SUFBQSxDQTlCVCxDQUFBOztBQUFBLDBCQXlDQSxzQkFBQSxHQUF3QixTQUFDLFFBQUQsR0FBQTtBQUN0QixVQUFBLENBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsU0FBUyxDQUFDLE9BQWYsQ0FBQTtBQUNBLE1BQUEsSUFBRyxDQUFDLFFBQUEsR0FBVyxDQUFYLElBQWdCLENBQUMsQ0FBQyxTQUFGLENBQUEsQ0FBakIsQ0FBQSxJQUFvQyxDQUFBLENBQUssQ0FBQSxZQUFhLEtBQUssQ0FBQyxTQUFwQixDQUEzQztBQUNFLGVBQU0sQ0FBQyxDQUFDLFNBQUYsQ0FBQSxDQUFBLElBQWtCLENBQUEsQ0FBSyxDQUFBLFlBQWEsS0FBSyxDQUFDLFNBQXBCLENBQTVCLEdBQUE7QUFFRSxVQUFBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FBTixDQUZGO1FBQUEsQ0FBQTtBQUdBLGVBQU0sSUFBTixHQUFBO0FBRUUsVUFBQSxJQUFHLENBQUEsWUFBYSxLQUFLLENBQUMsU0FBdEI7QUFDRSxrQkFERjtXQUFBO0FBRUEsVUFBQSxJQUFHLFFBQUEsSUFBWSxDQUFaLElBQWtCLENBQUEsQ0FBSyxDQUFDLFNBQUYsQ0FBQSxDQUF6QjtBQUNFLGtCQURGO1dBRkE7QUFBQSxVQUlBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FKTixDQUFBO0FBS0EsVUFBQSxJQUFHLENBQUEsQ0FBSyxDQUFDLFNBQUYsQ0FBQSxDQUFQO0FBQ0UsWUFBQSxRQUFBLElBQVksQ0FBWixDQURGO1dBUEY7UUFBQSxDQUpGO09BREE7YUFnQkEsRUFqQnNCO0lBQUEsQ0F6Q3hCLENBQUE7O3VCQUFBOztLQVB3QixLQUFLLENBQUMsT0FyR2hDLENBQUE7QUFBQSxFQStLTTtBQU1KLHFDQUFBLENBQUE7O0FBQWEsSUFBQSx3QkFBQyxlQUFELEVBQWtCLEdBQWxCLEVBQXVCLFNBQXZCLEVBQWtDLEdBQWxDLEVBQXVDLElBQXZDLEVBQTZDLElBQTdDLEVBQW1ELE1BQW5ELEdBQUE7QUFDWCxNQUFBLGdEQUFNLEdBQU4sRUFBVyxTQUFYLEVBQXNCLEdBQXRCLEVBQTJCLElBQTNCLEVBQWlDLElBQWpDLEVBQXVDLE1BQXZDLENBQUEsQ0FBQTtBQUNBLE1BQUEsSUFBRyx1QkFBSDtBQUNFLFFBQUEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxlQUFULENBQUEsQ0FERjtPQUZXO0lBQUEsQ0FBYjs7QUFBQSw2QkFXQSxPQUFBLEdBQVMsU0FBQyxPQUFELEVBQVUsZUFBVixHQUFBO0FBQ1AsVUFBQSxLQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLGdCQUFELENBQUEsQ0FBSixDQUFBO0FBQUEsTUFDQSxFQUFBLEdBQVMsSUFBQSxXQUFBLENBQVksT0FBWixFQUFxQixJQUFyQixFQUF3QixlQUF4QixFQUF5QyxDQUF6QyxFQUE0QyxDQUFDLENBQUMsT0FBOUMsQ0FEVCxDQUFBO2FBRUEsRUFBRSxDQUFDLFlBQUgsQ0FBZ0IsRUFBaEIsQ0FBbUIsQ0FBQyxPQUFwQixDQUFBLEVBSE87SUFBQSxDQVhULENBQUE7O0FBQUEsNkJBb0JBLEdBQUEsR0FBSyxTQUFBLEdBQUE7QUFDSCxVQUFBLENBQUE7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUFKLENBQUE7MkNBR0EsQ0FBQyxDQUFDLGVBSkM7SUFBQSxDQXBCTCxDQUFBOztBQUFBLDZCQTZCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFBLEdBQ0U7QUFBQSxRQUNFLE1BQUEsRUFBUSxnQkFEVjtBQUFBLFFBRUUsS0FBQSxFQUFRLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FGVjtBQUFBLFFBR0UsV0FBQSxFQUFjLElBQUMsQ0FBQSxTQUFTLENBQUMsTUFBWCxDQUFBLENBSGhCO0FBQUEsUUFJRSxLQUFBLEVBQVEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxNQUFMLENBQUEsQ0FKVjtPQURGLENBQUE7QUFPQSxNQUFBLElBQUcsc0JBQUEsSUFBYyxzQkFBakI7QUFDRSxRQUFBLElBQUssQ0FBQSxNQUFBLENBQUwsR0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFmLENBQUE7QUFBQSxRQUNBLElBQUssQ0FBQSxNQUFBLENBQUwsR0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQURmLENBREY7T0FQQTtBQVVBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBQyxDQUFBLE9BQTlCO0FBQ0UsUUFBQSxJQUFLLENBQUEsUUFBQSxDQUFMLEdBQWlCLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBUixDQUFBLENBQWpCLENBREY7T0FWQTthQVlBLEtBYk87SUFBQSxDQTdCVCxDQUFBOzswQkFBQTs7S0FOMkIsWUEvSzdCLENBQUE7QUFBQSxFQWlPQSxNQUFPLENBQUEsZ0JBQUEsQ0FBUCxHQUEyQixTQUFDLElBQUQsR0FBQTtBQUN6QixRQUFBLGdEQUFBO0FBQUEsSUFDYyxlQUFaLFVBREYsRUFFVSxXQUFSLE1BRkYsRUFHVSxZQUFSLE9BSEYsRUFJVSxZQUFSLE9BSkYsRUFLYSxjQUFYLFNBTEYsRUFNZ0IsaUJBQWQsWUFORixFQU9VLFdBQVIsTUFQRixDQUFBO1dBU0ksSUFBQSxjQUFBLENBQWUsT0FBZixFQUF3QixHQUF4QixFQUE2QixTQUE3QixFQUF3QyxHQUF4QyxFQUE2QyxJQUE3QyxFQUFtRCxJQUFuRCxFQUF5RCxNQUF6RCxFQVZxQjtFQUFBLENBak8zQixDQUFBO0FBQUEsRUFrUE07QUFPSixrQ0FBQSxDQUFBOztBQUFhLElBQUEscUJBQUMsT0FBRCxFQUFVLE1BQVYsRUFBa0IsR0FBbEIsRUFBdUIsSUFBdkIsRUFBNkIsSUFBN0IsRUFBbUMsTUFBbkMsR0FBQTtBQUNYLE1BQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBQUEsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLGFBQUQsQ0FBZSxRQUFmLEVBQXlCLE1BQXpCLENBREEsQ0FBQTtBQUVBLE1BQUEsSUFBRyxDQUFBLENBQUssY0FBQSxJQUFVLGNBQVYsSUFBb0IsaUJBQXJCLENBQVA7QUFDRSxjQUFVLElBQUEsS0FBQSxDQUFNLGdFQUFOLENBQVYsQ0FERjtPQUZBO0FBQUEsTUFJQSw2Q0FBTSxHQUFOLEVBQVcsSUFBWCxFQUFpQixJQUFqQixFQUF1QixNQUF2QixDQUpBLENBRFc7SUFBQSxDQUFiOztBQUFBLDBCQVVBLEdBQUEsR0FBSyxTQUFBLEdBQUE7YUFDSCxJQUFDLENBQUEsUUFERTtJQUFBLENBVkwsQ0FBQTs7QUFBQSwwQkFnQkEsT0FBQSxHQUFTLFNBQUMsT0FBRCxHQUFBO2FBQ1AsSUFBQyxDQUFBLE1BQU0sQ0FBQyxPQUFSLENBQWdCLE9BQWhCLEVBRE87SUFBQSxDQWhCVCxDQUFBOztBQUFBLDBCQXVCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxLQUFBO0FBQUEsTUFBQSxJQUFHLENBQUEsSUFBSyxDQUFBLHVCQUFELENBQUEsQ0FBUDtBQUNFLGVBQU8sS0FBUCxDQURGO09BQUEsTUFBQTs7ZUFHVSxDQUFDLGtCQUFtQixJQUFDLENBQUE7U0FBN0I7ZUFDQSwwQ0FBQSxTQUFBLEVBSkY7T0FETztJQUFBLENBdkJULENBQUE7O0FBQUEsMEJBaUNBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLElBQUE7QUFBQSxNQUFBLElBQUEsR0FDRTtBQUFBLFFBQ0UsTUFBQSxFQUFRLGFBRFY7QUFBQSxRQUVFLFNBQUEsRUFBVyxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUZiO0FBQUEsUUFHRSxnQkFBQSxFQUFtQixJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUhyQjtBQUFBLFFBSUUsTUFBQSxFQUFRLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBSlY7QUFBQSxRQUtFLE1BQUEsRUFBUSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUxWO0FBQUEsUUFNRSxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQU5WO09BREYsQ0FBQTtBQVNBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBQyxDQUFBLE9BQTlCO0FBQ0UsUUFBQSxJQUFLLENBQUEsUUFBQSxDQUFMLEdBQWlCLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBUixDQUFBLENBQWpCLENBREY7T0FUQTthQVdBLEtBWk87SUFBQSxDQWpDVCxDQUFBOzt1QkFBQTs7S0FQd0IsS0FBSyxDQUFDLE9BbFBoQyxDQUFBO0FBQUEsRUF3U0EsTUFBTyxDQUFBLGFBQUEsQ0FBUCxHQUF3QixTQUFDLElBQUQsR0FBQTtBQUN0QixRQUFBLHdDQUFBO0FBQUEsSUFDYyxlQUFaLFVBREYsRUFFcUIsY0FBbkIsaUJBRkYsRUFHVSxXQUFSLE1BSEYsRUFJVSxZQUFSLE9BSkYsRUFLVSxZQUFSLE9BTEYsRUFNYSxjQUFYLFNBTkYsQ0FBQTtXQVFJLElBQUEsV0FBQSxDQUFZLE9BQVosRUFBcUIsTUFBckIsRUFBNkIsR0FBN0IsRUFBa0MsSUFBbEMsRUFBd0MsSUFBeEMsRUFBOEMsTUFBOUMsRUFUa0I7RUFBQSxDQXhTeEIsQ0FBQTtBQUFBLEVBcVRBLEtBQU0sQ0FBQSxhQUFBLENBQU4sR0FBdUIsV0FyVHZCLENBQUE7QUFBQSxFQXNUQSxLQUFNLENBQUEsWUFBQSxDQUFOLEdBQXNCLFVBdFR0QixDQUFBO0FBQUEsRUF1VEEsS0FBTSxDQUFBLGdCQUFBLENBQU4sR0FBMEIsY0F2VDFCLENBQUE7QUFBQSxFQXdUQSxLQUFNLENBQUEsYUFBQSxDQUFOLEdBQXVCLFdBeFR2QixDQUFBO1NBMFRBLFlBM1RlO0FBQUEsQ0FGakIsQ0FBQTs7OztBQ0FBLElBQUEsOEJBQUE7RUFBQTtpU0FBQTs7QUFBQSw4QkFBQSxHQUFpQyxPQUFBLENBQVEsbUJBQVIsQ0FBakMsQ0FBQTs7QUFBQSxNQUVNLENBQUMsT0FBUCxHQUFpQixTQUFDLEVBQUQsR0FBQTtBQUNmLE1BQUEsNkRBQUE7QUFBQSxFQUFBLGdCQUFBLEdBQW1CLDhCQUFBLENBQStCLEVBQS9CLENBQW5CLENBQUE7QUFBQSxFQUNBLEtBQUEsR0FBUSxnQkFBZ0IsQ0FBQyxLQUR6QixDQUFBO0FBQUEsRUFFQSxNQUFBLEdBQVMsZ0JBQWdCLENBQUMsTUFGMUIsQ0FBQTtBQUFBLEVBUU07QUFBTixpQ0FBQSxDQUFBOzs7O0tBQUE7O3NCQUFBOztLQUF5QixLQUFLLENBQUMsT0FSL0IsQ0FBQTtBQUFBLEVBU0EsTUFBTyxDQUFBLFlBQUEsQ0FBUCxHQUF1QixNQUFPLENBQUEsUUFBQSxDQVQ5QixDQUFBO0FBQUEsRUFjTTtBQUtKLGlDQUFBLENBQUE7O0FBQWEsSUFBQSxvQkFBRSxPQUFGLEVBQVcsR0FBWCxFQUFnQixJQUFoQixFQUFzQixJQUF0QixFQUE0QixNQUE1QixHQUFBO0FBQ1gsTUFEWSxJQUFDLENBQUEsVUFBQSxPQUNiLENBQUE7QUFBQSxNQUFBLElBQUcsQ0FBQSxDQUFLLGNBQUEsSUFBVSxjQUFYLENBQVA7QUFDRSxjQUFVLElBQUEsS0FBQSxDQUFNLHNEQUFOLENBQVYsQ0FERjtPQUFBO0FBQUEsTUFFQSw0Q0FBTSxHQUFOLEVBQVcsSUFBWCxFQUFpQixJQUFqQixFQUF1QixNQUF2QixDQUZBLENBRFc7SUFBQSxDQUFiOztBQUFBLHlCQU9BLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVCxNQUFBLElBQUcsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUFIO2VBQ0UsRUFERjtPQUFBLE1BQUE7ZUFHRSxJQUFDLENBQUEsT0FBTyxDQUFDLE9BSFg7T0FEUztJQUFBLENBUFgsQ0FBQTs7QUFBQSx5QkFrQkEsR0FBQSxHQUFLLFNBQUMsZ0JBQUQsR0FBQTtBQUNILE1BQUEsSUFBRyxJQUFDLENBQUEsU0FBRCxDQUFBLENBQUg7ZUFDRSxHQURGO09BQUEsTUFBQTtlQUdFLElBQUMsQ0FBQSxRQUhIO09BREc7SUFBQSxDQWxCTCxDQUFBOztBQUFBLHlCQTRCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFBLEdBQ0U7QUFBQSxRQUNFLE1BQUEsRUFBUSxZQURWO0FBQUEsUUFFRSxTQUFBLEVBQVcsSUFBQyxDQUFBLE9BRmQ7QUFBQSxRQUdFLEtBQUEsRUFBUSxJQUFDLENBQUEsTUFBRCxDQUFBLENBSFY7QUFBQSxRQUlFLE1BQUEsRUFBUSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUpWO0FBQUEsUUFLRSxNQUFBLEVBQVEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FMVjtPQURGLENBQUE7QUFRQSxNQUFBLElBQUcscUJBQUEsSUFBYSxJQUFDLENBQUEsTUFBRCxLQUFhLElBQUMsQ0FBQSxPQUE5QjtBQUNFLFFBQUEsSUFBSyxDQUFBLFFBQUEsQ0FBTCxHQUFpQixJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUFqQixDQURGO09BUkE7YUFVQSxLQVhPO0lBQUEsQ0E1QlQsQ0FBQTs7c0JBQUE7O0tBTHVCLEtBQUssQ0FBQyxPQWQvQixDQUFBO0FBQUEsRUE0REEsTUFBTyxDQUFBLFlBQUEsQ0FBUCxHQUF1QixTQUFDLElBQUQsR0FBQTtBQUNyQixRQUFBLGdDQUFBO0FBQUEsSUFDYyxlQUFaLFVBREYsRUFFVSxXQUFSLE1BRkYsRUFHVSxZQUFSLE9BSEYsRUFJVSxZQUFSLE9BSkYsRUFLYSxjQUFYLFNBTEYsQ0FBQTtXQU9JLElBQUEsVUFBQSxDQUFXLE9BQVgsRUFBb0IsR0FBcEIsRUFBeUIsSUFBekIsRUFBK0IsSUFBL0IsRUFBcUMsTUFBckMsRUFSaUI7RUFBQSxDQTVEdkIsQ0FBQTtBQUFBLEVBeUVNO0FBS0osMkJBQUEsQ0FBQTs7QUFBYSxJQUFBLGNBQUMsR0FBRCxFQUFNLFNBQU4sRUFBaUIsR0FBakIsRUFBc0IsSUFBdEIsRUFBNEIsSUFBNUIsRUFBa0MsTUFBbEMsR0FBQTtBQUNYLE1BQUEsc0NBQU0sR0FBTixFQUFXLFNBQVgsRUFBc0IsR0FBdEIsRUFBMkIsSUFBM0IsRUFBaUMsSUFBakMsRUFBdUMsTUFBdkMsQ0FBQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSxtQkFNQSxVQUFBLEdBQVksU0FBQyxRQUFELEVBQVcsT0FBWCxHQUFBO0FBQ1YsVUFBQSw0QkFBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxzQkFBRCxDQUF3QixRQUF4QixDQUFKLENBQUE7QUFDQTtXQUFBLDhDQUFBO3dCQUFBO0FBQ0UsUUFBQSxFQUFBLEdBQVMsSUFBQSxVQUFBLENBQVcsQ0FBWCxFQUFjLE1BQWQsRUFBeUIsQ0FBQyxDQUFDLE9BQTNCLEVBQW9DLENBQXBDLENBQVQsQ0FBQTtBQUFBLHNCQUNBLEVBQUUsQ0FBQyxZQUFILENBQWdCLEVBQWhCLENBQW1CLENBQUMsT0FBcEIsQ0FBQSxFQURBLENBREY7QUFBQTtzQkFGVTtJQUFBLENBTlosQ0FBQTs7QUFBQSxtQkFlQSxVQUFBLEdBQVksU0FBQyxRQUFELEVBQVcsTUFBWCxHQUFBO0FBQ1YsVUFBQSx1QkFBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxzQkFBRCxDQUF3QixRQUF4QixDQUFKLENBQUE7QUFBQSxNQUVBLFVBQUEsR0FBYSxFQUZiLENBQUE7QUFHQSxXQUFTLGtGQUFULEdBQUE7QUFDRSxRQUFBLElBQUcsQ0FBQSxZQUFhLEtBQUssQ0FBQyxTQUF0QjtBQUNFLGdCQURGO1NBQUE7QUFBQSxRQUVBLENBQUEsR0FBSSxFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLFVBQUEsQ0FBVyxNQUFYLEVBQXNCLENBQXRCLENBQXBCLENBQTRDLENBQUMsT0FBN0MsQ0FBQSxDQUZKLENBQUE7QUFBQSxRQUdBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FITixDQUFBO0FBSUEsZUFBTSxDQUFBLENBQUssQ0FBQSxZQUFhLEtBQUssQ0FBQyxTQUFwQixDQUFKLElBQXVDLENBQUMsQ0FBQyxTQUFGLENBQUEsQ0FBN0MsR0FBQTtBQUNFLFVBQUEsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQUFOLENBREY7UUFBQSxDQUpBO0FBQUEsUUFNQSxVQUFVLENBQUMsSUFBWCxDQUFnQixDQUFDLENBQUMsT0FBRixDQUFBLENBQWhCLENBTkEsQ0FERjtBQUFBLE9BSEE7YUFXQSxXQVpVO0lBQUEsQ0FmWixDQUFBOztBQUFBLG1CQW9DQSxXQUFBLEdBQWEsU0FBQyxJQUFELEdBQUE7QUFDWCxVQUFBLElBQUE7QUFBQSxNQUFBLElBQUcsNEJBQUg7QUFDRSxRQUFBLElBQUEsR0FBTyxFQUFFLENBQUMsWUFBSCxDQUFvQixJQUFBLElBQUEsQ0FBSyxNQUFMLENBQXBCLENBQW1DLENBQUMsT0FBcEMsQ0FBQSxDQUFQLENBQUE7QUFBQSxRQUNBLElBQUksQ0FBQyxVQUFMLENBQWdCLENBQWhCLEVBQW1CLElBQW5CLENBREEsQ0FBQTtlQUVBLElBQUMsQ0FBQSxlQUFlLENBQUMsT0FBakIsQ0FBeUIsSUFBekIsRUFIRjtPQUFBLE1BQUE7QUFLRSxjQUFVLElBQUEsS0FBQSxDQUFNLDREQUFOLENBQVYsQ0FMRjtPQURXO0lBQUEsQ0FwQ2IsQ0FBQTs7QUFBQSxtQkErQ0EsR0FBQSxHQUFLLFNBQUEsR0FBQTtBQUNILFVBQUEsSUFBQTtBQUFBLE1BQUEsQ0FBQTs7QUFBSTtBQUFBO2FBQUEsMkNBQUE7dUJBQUE7QUFDRixVQUFBLElBQUcsYUFBSDswQkFDRSxDQUFDLENBQUMsR0FBRixDQUFBLEdBREY7V0FBQSxNQUFBOzBCQUdFLElBSEY7V0FERTtBQUFBOzttQkFBSixDQUFBO2FBS0EsQ0FBQyxDQUFDLElBQUYsQ0FBTyxFQUFQLEVBTkc7SUFBQSxDQS9DTCxDQUFBOztBQUFBLG1CQTJEQSxpQkFBQSxHQUFtQixTQUFDLEVBQUQsR0FBQTtBQUNqQixNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsaUJBQWYsRUFBa0MsRUFBbEMsQ0FBQSxDQUFBO2FBQ0EsSUFBQyxDQUFBLHdCQUZnQjtJQUFBLENBM0RuQixDQUFBOztBQUFBLG1CQWtFQSxJQUFBLEdBQU0sU0FBQyxTQUFELEdBQUE7QUFDSixVQUFBLElBQUE7QUFBQSxNQUFBLElBQUEsR0FBTyxJQUFQLENBQUE7QUFBQSxNQUNBLFNBQVMsQ0FBQyxLQUFWLEdBQWtCLElBQUMsQ0FBQSxHQUFELENBQUEsQ0FEbEIsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLEVBQUQsQ0FBSSxRQUFKLEVBQWMsU0FBQyxLQUFELEVBQVEsRUFBUixHQUFBO0FBQ1osWUFBQSx1QkFBQTtBQUFBLFFBQUEsS0FBQSxHQUFRLEVBQUUsQ0FBQyxXQUFILENBQUEsQ0FBUixDQUFBO0FBQUEsUUFDQSxHQUFBLEdBQU0sU0FBQyxNQUFELEdBQUE7QUFDSixVQUFBLElBQUcsTUFBQSxJQUFVLEtBQWI7bUJBQ0UsT0FERjtXQUFBLE1BQUE7QUFHRSxZQUFBLE1BQUEsSUFBVSxDQUFWLENBQUE7bUJBQ0EsT0FKRjtXQURJO1FBQUEsQ0FETixDQUFBO0FBQUEsUUFPQSxJQUFBLEdBQU8sR0FBQSxDQUFJLFNBQVMsQ0FBQyxjQUFkLENBUFAsQ0FBQTtBQUFBLFFBUUEsS0FBQSxHQUFRLEdBQUEsQ0FBSSxTQUFTLENBQUMsWUFBZCxDQVJSLENBQUE7QUFBQSxRQVVBLFNBQVMsQ0FBQyxLQUFWLEdBQWtCLElBQUksQ0FBQyxHQUFMLENBQUEsQ0FWbEIsQ0FBQTtlQVdBLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixJQUE1QixFQUFrQyxLQUFsQyxFQVpZO01BQUEsQ0FBZCxDQUhBLENBQUE7QUFBQSxNQWtCQSxJQUFDLENBQUEsRUFBRCxDQUFJLFFBQUosRUFBYyxTQUFDLEtBQUQsRUFBUSxFQUFSLEdBQUE7QUFDWixZQUFBLHVCQUFBO0FBQUEsUUFBQSxLQUFBLEdBQVEsRUFBRSxDQUFDLFdBQUgsQ0FBQSxDQUFSLENBQUE7QUFBQSxRQUNBLEdBQUEsR0FBTSxTQUFDLE1BQUQsR0FBQTtBQUNKLFVBQUEsSUFBRyxNQUFBLEdBQVMsS0FBWjttQkFDRSxPQURGO1dBQUEsTUFBQTtBQUdFLFlBQUEsTUFBQSxJQUFVLENBQVYsQ0FBQTttQkFDQSxPQUpGO1dBREk7UUFBQSxDQUROLENBQUE7QUFBQSxRQU9BLElBQUEsR0FBTyxHQUFBLENBQUksU0FBUyxDQUFDLGNBQWQsQ0FQUCxDQUFBO0FBQUEsUUFRQSxLQUFBLEdBQVEsR0FBQSxDQUFJLFNBQVMsQ0FBQyxZQUFkLENBUlIsQ0FBQTtBQUFBLFFBVUEsU0FBUyxDQUFDLEtBQVYsR0FBa0IsSUFBSSxDQUFDLEdBQUwsQ0FBQSxDQVZsQixDQUFBO2VBV0EsU0FBUyxDQUFDLGlCQUFWLENBQTRCLElBQTVCLEVBQWtDLEtBQWxDLEVBWlk7TUFBQSxDQUFkLENBbEJBLENBQUE7QUFBQSxNQWlDQSxTQUFTLENBQUMsVUFBVixHQUF1QixTQUFDLEtBQUQsR0FBQTtBQUNyQixZQUFBLHdCQUFBO0FBQUEsUUFBQSxJQUFBLEdBQU8sSUFBUCxDQUFBO0FBQ0EsUUFBQSxJQUFHLGlCQUFIO0FBQ0UsVUFBQSxJQUFHLEtBQUssQ0FBQyxRQUFOLEtBQWtCLEVBQXJCO0FBQ0UsWUFBQSxJQUFBLEdBQU8sR0FBUCxDQURGO1dBQUEsTUFFSyxJQUFHLEtBQUssQ0FBQyxPQUFOLEtBQWlCLEVBQXBCO0FBQ0gsWUFBQSxJQUFBLEdBQU8sSUFBUCxDQURHO1dBQUEsTUFBQTtBQUdILFlBQUEsSUFBQSxHQUFPLEtBQUssQ0FBQyxHQUFiLENBSEc7V0FIUDtTQUFBLE1BQUE7QUFRRSxVQUFBLElBQUEsR0FBTyxNQUFNLENBQUMsWUFBUCxDQUFvQixLQUFLLENBQUMsT0FBMUIsQ0FBUCxDQVJGO1NBREE7QUFVQSxRQUFBLElBQUcsSUFBSSxDQUFDLE1BQUwsR0FBYyxDQUFqQjtBQUNFLFVBQUEsR0FBQSxHQUFNLElBQUksQ0FBQyxHQUFMLENBQVMsU0FBUyxDQUFDLGNBQW5CLEVBQW1DLFNBQVMsQ0FBQyxZQUE3QyxDQUFOLENBQUE7QUFBQSxVQUNBLElBQUEsR0FBTyxJQUFJLENBQUMsR0FBTCxDQUFTLFNBQVMsQ0FBQyxZQUFWLEdBQXlCLFNBQVMsQ0FBQyxjQUE1QyxDQURQLENBQUE7QUFBQSxVQUVBLElBQUksQ0FBQyxVQUFMLENBQWlCLEdBQWpCLEVBQXVCLElBQXZCLENBRkEsQ0FBQTtBQUFBLFVBR0EsSUFBSSxDQUFDLFVBQUwsQ0FBZ0IsR0FBaEIsRUFBcUIsSUFBckIsQ0FIQSxDQUFBO0FBQUEsVUFJQSxPQUFBLEdBQVUsR0FBQSxHQUFNLElBQUksQ0FBQyxNQUpyQixDQUFBO0FBQUEsVUFLQSxTQUFTLENBQUMsaUJBQVYsQ0FBNEIsT0FBNUIsRUFBcUMsT0FBckMsQ0FMQSxDQUFBO2lCQU1BLEtBQUssQ0FBQyxjQUFOLENBQUEsRUFQRjtTQUFBLE1BQUE7aUJBU0UsS0FBSyxDQUFDLGNBQU4sQ0FBQSxFQVRGO1NBWHFCO01BQUEsQ0FqQ3ZCLENBQUE7QUFBQSxNQXVEQSxTQUFTLENBQUMsT0FBVixHQUFvQixTQUFDLEtBQUQsR0FBQTtlQUNsQixLQUFLLENBQUMsY0FBTixDQUFBLEVBRGtCO01BQUEsQ0F2RHBCLENBQUE7QUFBQSxNQXlEQSxTQUFTLENBQUMsS0FBVixHQUFrQixTQUFDLEtBQUQsR0FBQTtlQUNoQixLQUFLLENBQUMsY0FBTixDQUFBLEVBRGdCO01BQUEsQ0F6RGxCLENBQUE7YUFtRUEsU0FBUyxDQUFDLFNBQVYsR0FBc0IsU0FBQyxLQUFELEdBQUE7QUFDcEIsWUFBQSxtQ0FBQTtBQUFBLFFBQUEsR0FBQSxHQUFNLElBQUksQ0FBQyxHQUFMLENBQVMsU0FBUyxDQUFDLGNBQW5CLEVBQW1DLFNBQVMsQ0FBQyxZQUE3QyxDQUFOLENBQUE7QUFBQSxRQUNBLElBQUEsR0FBTyxJQUFJLENBQUMsR0FBTCxDQUFTLFNBQVMsQ0FBQyxZQUFWLEdBQXlCLFNBQVMsQ0FBQyxjQUE1QyxDQURQLENBQUE7QUFFQSxRQUFBLElBQUcsdUJBQUEsSUFBbUIsS0FBSyxDQUFDLE9BQU4sS0FBaUIsQ0FBdkM7QUFDRSxVQUFBLElBQUcsSUFBQSxHQUFPLENBQVY7QUFDRSxZQUFBLElBQUksQ0FBQyxVQUFMLENBQWdCLEdBQWhCLEVBQXFCLElBQXJCLENBQUEsQ0FBQTtBQUFBLFlBQ0EsU0FBUyxDQUFDLGlCQUFWLENBQTRCLEdBQTVCLEVBQWlDLEdBQWpDLENBREEsQ0FERjtXQUFBLE1BQUE7QUFJRSxZQUFBLElBQUcsdUJBQUEsSUFBbUIsS0FBSyxDQUFDLE9BQTVCO0FBQ0UsY0FBQSxHQUFBLEdBQU0sU0FBUyxDQUFDLEtBQWhCLENBQUE7QUFBQSxjQUNBLE9BQUEsR0FBVSxHQURWLENBQUE7QUFBQSxjQUVBLFVBQUEsR0FBYSxDQUZiLENBQUE7QUFHQSxjQUFBLElBQUcsR0FBQSxHQUFNLENBQVQ7QUFDRSxnQkFBQSxPQUFBLEVBQUEsQ0FBQTtBQUFBLGdCQUNBLFVBQUEsRUFEQSxDQURGO2VBSEE7QUFNQSxxQkFBTSxPQUFBLEdBQVUsQ0FBVixJQUFnQixHQUFJLENBQUEsT0FBQSxDQUFKLEtBQWtCLEdBQWxDLElBQTBDLEdBQUksQ0FBQSxPQUFBLENBQUosS0FBa0IsSUFBbEUsR0FBQTtBQUNFLGdCQUFBLE9BQUEsRUFBQSxDQUFBO0FBQUEsZ0JBQ0EsVUFBQSxFQURBLENBREY7Y0FBQSxDQU5BO0FBQUEsY0FTQSxJQUFJLENBQUMsVUFBTCxDQUFnQixPQUFoQixFQUEwQixHQUFBLEdBQUksT0FBOUIsQ0FUQSxDQUFBO0FBQUEsY0FVQSxTQUFTLENBQUMsaUJBQVYsQ0FBNEIsT0FBNUIsRUFBcUMsT0FBckMsQ0FWQSxDQURGO2FBQUEsTUFBQTtBQWFFLGNBQUEsSUFBSSxDQUFDLFVBQUwsQ0FBaUIsR0FBQSxHQUFJLENBQXJCLEVBQXlCLENBQXpCLENBQUEsQ0FiRjthQUpGO1dBQUE7aUJBa0JBLEtBQUssQ0FBQyxjQUFOLENBQUEsRUFuQkY7U0FBQSxNQW9CSyxJQUFHLHVCQUFBLElBQW1CLEtBQUssQ0FBQyxPQUFOLEtBQWlCLEVBQXZDO0FBQ0gsVUFBQSxJQUFHLElBQUEsR0FBTyxDQUFWO0FBQ0UsWUFBQSxJQUFJLENBQUMsVUFBTCxDQUFnQixHQUFoQixFQUFxQixJQUFyQixDQUFBLENBQUE7QUFBQSxZQUNBLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixHQUE1QixFQUFpQyxHQUFqQyxDQURBLENBREY7V0FBQSxNQUFBO0FBSUUsWUFBQSxJQUFJLENBQUMsVUFBTCxDQUFnQixHQUFoQixFQUFxQixDQUFyQixDQUFBLENBQUE7QUFBQSxZQUNBLFNBQVMsQ0FBQyxpQkFBVixDQUE0QixHQUE1QixFQUFpQyxHQUFqQyxDQURBLENBSkY7V0FBQTtpQkFNQSxLQUFLLENBQUMsY0FBTixDQUFBLEVBUEc7U0F2QmU7TUFBQSxFQXBFbEI7SUFBQSxDQWxFTixDQUFBOztBQUFBLG1CQTJLQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxJQUFBO0FBQUEsTUFBQSxJQUFBLEdBQU87QUFBQSxRQUNMLE1BQUEsRUFBUSxNQURIO0FBQUEsUUFFTCxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZIO0FBQUEsUUFHTCxXQUFBLEVBQWMsSUFBQyxDQUFBLFNBQVMsQ0FBQyxNQUFYLENBQUEsQ0FIVDtBQUFBLFFBSUwsS0FBQSxFQUFRLElBQUMsQ0FBQSxHQUFHLENBQUMsTUFBTCxDQUFBLENBSkg7T0FBUCxDQUFBO0FBTUEsTUFBQSxJQUFHLG9CQUFIO0FBQ0UsUUFBQSxJQUFLLENBQUEsTUFBQSxDQUFMLEdBQWUsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBZixDQURGO09BTkE7QUFRQSxNQUFBLElBQUcsb0JBQUg7QUFDRSxRQUFBLElBQUssQ0FBQSxNQUFBLENBQUwsR0FBZSxJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFmLENBREY7T0FSQTtBQVVBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBQyxDQUFBLE9BQTlCO0FBQ0UsUUFBQSxJQUFLLENBQUEsUUFBQSxDQUFMLEdBQWlCLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBUixDQUFBLENBQWpCLENBREY7T0FWQTthQVlBLEtBYk87SUFBQSxDQTNLVCxDQUFBOztnQkFBQTs7S0FMaUIsS0FBSyxDQUFDLFlBekV6QixDQUFBO0FBQUEsRUF3UUEsTUFBTyxDQUFBLE1BQUEsQ0FBUCxHQUFpQixTQUFDLElBQUQsR0FBQTtBQUNmLFFBQUEsdUNBQUE7QUFBQSxJQUNVLFdBQVIsTUFERixFQUVnQixpQkFBZCxZQUZGLEVBR1UsV0FBUixNQUhGLEVBSVUsWUFBUixPQUpGLEVBS1UsWUFBUixPQUxGLEVBTWEsY0FBWCxTQU5GLENBQUE7V0FRSSxJQUFBLElBQUEsQ0FBSyxHQUFMLEVBQVUsU0FBVixFQUFxQixHQUFyQixFQUEwQixJQUExQixFQUFnQyxJQUFoQyxFQUFzQyxNQUF0QyxFQVRXO0VBQUEsQ0F4UWpCLENBQUE7QUFBQSxFQW1SQSxLQUFNLENBQUEsWUFBQSxDQUFOLEdBQXNCLFVBblJ0QixDQUFBO0FBQUEsRUFvUkEsS0FBTSxDQUFBLFlBQUEsQ0FBTixHQUFzQixVQXBSdEIsQ0FBQTtBQUFBLEVBcVJBLEtBQU0sQ0FBQSxNQUFBLENBQU4sR0FBZ0IsSUFyUmhCLENBQUE7U0FzUkEsaUJBdlJlO0FBQUEsQ0FGakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcclxuI1xyXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXHJcbiNcclxuY2xhc3MgRW5naW5lXHJcblxyXG4gICNcclxuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcclxuICAjIEBwYXJhbSB7QXJyYXl9IHBhcnNlciBEZWZpbmVzIGhvdyB0byBwYXJzZSBlbmNvZGVkIG1lc3NhZ2VzLlxyXG4gICNcclxuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHBhcnNlciktPlxyXG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXHJcblxyXG4gICNcclxuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxyXG4gICNcclxuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cclxuICAgIHR5cGVQYXJzZXIgPSBAcGFyc2VyW2pzb24udHlwZV1cclxuICAgIGlmIHR5cGVQYXJzZXI/XHJcbiAgICAgIHR5cGVQYXJzZXIganNvblxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXHJcbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcclxuICAjXHJcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxyXG4gICAgb3BzID0gW11cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcclxuICAjXHJcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cclxuICAjXHJcbiAgYXBwbHlPcDogKG9wX2pzb24pLT5cclxuICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxyXG4gICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICBASEIuYWRkVG9Db3VudGVyIG9cclxuICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIGVsc2VcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxudGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL1RleHRUeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBUZXh0IERhdGFzdHJ1Y3R1cmVzLlxuI1xuY2xhc3MgVGV4dFlhdHRhXG5cbiAgI1xuICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXFlIHVzZXIgaWQgdGhhdCBkZWZpbmVzIHRoaXMgcGVlci5cbiAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIFRoZSBjb25uZWN0b3IgZGVmaW5lcyBob3cgeW91IGNvbm5lY3QgdG8gdGhlIG90aGVyIHBlZXJzLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAodXNlcl9pZCwgQ29ubmVjdG9yKS0+XG4gICAgQEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICAgIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuICAgIEBlbmdpbmUgPSBuZXcgRW5naW5lIEBIQiwgdGV4dF90eXBlcy5wYXJzZXJcbiAgICBAY29ubmVjdG9yID0gbmV3IENvbm5lY3RvciBAZW5naW5lLCBASEIsIHRleHRfdHlwZXMuZXhlY3V0aW9uX2xpc3RlbmVyLCBAXG5cbiAgICBiZWdpbm5pbmcgPSBASEIuYWRkT3BlcmF0aW9uIG5ldyBAdHlwZXMuRGVsaW1pdGVyIHtjcmVhdG9yOiAnXycsIG9wX251bWJlcjogJ19iZWdpbm5pbmcnfSAsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgZW5kID0gICAgICAgQEhCLmFkZE9wZXJhdGlvbiBuZXcgQHR5cGVzLkRlbGltaXRlciB7Y3JlYXRvcjogJ18nLCBvcF9udW1iZXI6ICdfZW5kJ30gICAgICAgLCBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgIGJlZ2lubmluZy5uZXh0X2NsID0gZW5kXG4gICAgYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgIGVuZC5leGVjdXRlKClcbiAgICBmaXJzdF93b3JkID0gbmV3IEB0eXBlcy5Xb3JkIHtjcmVhdG9yOiAnXycsIG9wX251bWJlcjogJ18nfSwgYmVnaW5uaW5nLCBlbmRcbiAgICBASEIuYWRkT3BlcmF0aW9uKGZpcnN0X3dvcmQpLmV4ZWN1dGUoKVxuXG4gICAgdWlkX3IgPSB7IGNyZWF0b3I6ICdfJywgb3BfbnVtYmVyOiBcIlJNXCIgfVxuICAgIHVpZF9iZWcgPSB7IGNyZWF0b3I6ICdfJywgb3BfbnVtYmVyOiBcIl9STV9iZWdpbm5pbmdcIiB9XG4gICAgdWlkX2VuZCA9IHsgY3JlYXRvcjogJ18nLCBvcF9udW1iZXI6IFwiX1JNX2VuZFwiIH1cbiAgICBiZWcgPSBASEIuYWRkT3BlcmF0aW9uKG5ldyBAdHlwZXMuRGVsaW1pdGVyIHVpZF9iZWcsIHVuZGVmaW5lZCwgdWlkX2VuZCkuZXhlY3V0ZSgpXG4gICAgZW5kID0gQEhCLmFkZE9wZXJhdGlvbihuZXcgQHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgQHJvb3RfZWxlbWVudCA9IEBIQi5hZGRPcGVyYXRpb24obmV3IEB0eXBlcy5SZXBsYWNlTWFuYWdlciB1bmRlZmluZWQsIHVpZF9yLCBiZWcsIGVuZCkuZXhlY3V0ZSgpXG4gICAgQHJvb3RfZWxlbWVudC5yZXBsYWNlIGZpcnN0X3dvcmQsIHsgY3JlYXRvcjogJ18nLCBvcF9udW1iZXI6ICdSZXBsYWNlYWJsZSd9XG5cblxuICAjXG4gICMgQHJlc3VsdCBXb3JkXG4gICNcbiAgZ2V0Um9vdEVsZW1lbnQ6ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50LnZhbCgpXG5cbiAgI1xuICAjIEBzZWUgRW5naW5lXG4gICNcbiAgZ2V0RW5naW5lOiAoKS0+XG4gICAgQGVuZ2luZVxuXG4gICNcbiAgIyBHZXQgdGhlIGluaXRpYWxpemVkIGNvbm5lY3Rvci5cbiAgI1xuICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICBAY29ubmVjdG9yXG5cbiAgI1xuICAjIEBzZWUgSGlzdG9yeUJ1ZmZlclxuICAjXG4gIGdldEhpc3RvcnlCdWZmZXI6ICgpLT5cbiAgICBASEJcblxuICAjXG4gICMgR2V0IHRoZSBVc2VySWQgZnJvbSB0aGUgSGlzdG9yeUJ1ZmZlciBvYmplY3QuXG4gICMgSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXMgdGhlIHVzZXJfaWQgdmFsdWUgd2l0aCB3aGljaFxuICAjIEpzb25ZYXR0YSB3YXMgaW5pdGlhbGl6ZWQgKERlcGVuZGluZyBvbiB0aGUgSGlzdG9yeUJ1ZmZlciBpbXBsZW1lbnRhdGlvbikuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQEhCLmdldFVzZXJJZCgpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsXG4gICNcbiAgdmFsOiAoKS0+XG4gICAgQGdldFJvb3RFbGVtZW50KCkudmFsKClcblxuICAjXG4gICMgQHNlZSBXb3JkLmluc2VydFRleHRcbiAgI1xuICBpbnNlcnRUZXh0OiAocG9zLCBjb250ZW50KS0+XG4gICAgQGdldFJvb3RFbGVtZW50KCkuaW5zZXJ0VGV4dCBwb3MsIGNvbnRlbnRcblxuICAjXG4gICMgQHNlZSBXb3JkLmRlbGV0ZVRleHRcbiAgI1xuICBkZWxldGVUZXh0OiAocG9zLCBsZW5ndGgpLT5cbiAgICBAZ2V0Um9vdEVsZW1lbnQoKS5kZWxldGVUZXh0IHBvcywgbGVuZ3RoXG5cbiAgI1xuICAjIEBzZWUgV29yZC5iaW5kXG4gICNcbiAgYmluZDogKHRleHRhcmVhKS0+XG4gICAgQGdldFJvb3RFbGVtZW50KCkuYmluZCB0ZXh0YXJlYVxuXG4gICNcbiAgIyBAc2VlIFdvcmQucmVwbGFjZVRleHRcbiAgI1xuICByZXBsYWNlVGV4dDogKHRleHQpLT5cbiAgICBAZ2V0Um9vdEVsZW1lbnQoKS5yZXBsYWNlVGV4dCB0ZXh0XG5cblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0WWF0dGFcbmlmIHdpbmRvdz9cbiAgaWYgbm90IHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZID0ge31cbiAgd2luZG93LlkuVGV4dFlhdHRhID0gVGV4dFlhdHRhXG4iLCJcbiNcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuXG4gICNcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQHVzZXJfaWRcblxuICAjXG4gICMgVGhlcmUgaXMgb25seSBvbmUgcmVzZXJ2ZWQgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCksIHNvIHVzZSBpdCB3aXNlbHkuXG4gICMgSSBwcm9wb3NlIHRvIHVzZSBpdCBpbiB5b3VyIEZyYW1ld29yaywgdG8gY3JlYXRlIHNvbWV0aGluZyBsaWtlIGEgcm9vdCBlbGVtZW50LlxuICAjIEFuIG9wZXJhdGlvbiB3aXRoIHRoaXMgaWRlbnRpZmllciBpcyBub3QgcHJvcGFnYXRlZCB0byBvdGhlciBjbGllbnRzLlxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cbiAgI1xuICBnZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXI6ICgpLT5cbiAgICB7XG4gICAgICBjcmVhdG9yIDogJ18nXG4gICAgICBvcF9udW1iZXIgOiAnXydcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICgpLT5cbiAgICByZXMgPSB7fVxuICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgIHJlc1t1c2VyXSA9IGN0blxuICAgIHJlc1xuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cbiAgICBqc29uID0gW11cbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZGFoIVwiXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcblxuICAgIGZvciB1X25hbWUsdXNlciBvZiBAYnVmZmVyXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3QgaXNOYU4ocGFyc2VJbnQob19udW1iZXIpKSkgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD9cbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC5jcmVhdG9yLCBvX25leHQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD9cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fbmV4dC5jcmVhdG9yLCBvX25leHQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxuICAgIGlmIHVpZCBpbnN0YW5jZW9mIE9iamVjdFxuICAgICAgQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgZWxzZSBpZiBub3QgdWlkP1xuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgdHlwZSBvZiB1aWQgaXMgbm90IGRlZmluZWQhXCJcbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLmNyZWF0b3JdID0ge31cbiAgICBpZiBAYnVmZmVyW28uY3JlYXRvcl1bby5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXSA9IG9cbiAgICBvXG5cbiAgI1xuICAjIEluY3JlbWVudCB0aGUgb3BlcmF0aW9uX2NvdW50ZXIgdGhhdCBkZWZpbmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBFbmdpbmUuXG4gICNcbiAgYWRkVG9Db3VudGVyOiAobyktPlxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdID0gMFxuICAgIGlmIHR5cGVvZiBvLm9wX251bWJlciBpcyAnbnVtYmVyJyBhbmQgby5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSsrXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIGlzbnQgKG8ub3BfbnVtYmVyICsgMSlcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0gLSAoby5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICBwYXJzZXIgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wZXJhdGlvbnMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci5cbiAgI1xuICBjbGFzcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgaWYgbm90IHVpZD9cbiAgICAgICAgdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAge1xuICAgICAgICAnY3JlYXRvcic6IEBjcmVhdG9yXG4gICAgICAgICdvcF9udW1iZXInIDogQG9wX251bWJlclxuICAgICAgfSA9IHVpZFxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gZXZlbnQgTmFtZSBvZiB0aGUgZXZlbnQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9uOiAoZXZlbnQsIGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPz0ge31cbiAgICAgIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdID89IFtdXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzW2V2ZW50XS5wdXNoIGZcblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjXG4gICAgY2FsbEV2ZW50OiAoZXZlbnQsIGFyZ3MpLT5cbiAgICAgIGlmIEBldmVudF9saXN0ZW5lcnM/W2V2ZW50XT9cbiAgICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1tldmVudF1cbiAgICAgICAgICBmLmNhbGwgQCwgZXZlbnQsIGFyZ3NcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChvKS0+XG4gICAgICBAcGFyZW50ID0gb1xuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgeyAnY3JlYXRvcic6IEBjcmVhdG9yLCAnb3BfbnVtYmVyJzogQG9wX251bWJlciB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgb3A/LmV4ZWN1dGU/XG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG5cblxuICAjXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBJbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgY2xhc3MgRGVsZXRlIGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBkZWxldGVzKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIHBhcnNlclsnRGVsZXRlJ10gPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgRGVsZXRlIHVpZCwgZGVsZXRlc191aWRcblxuICAjXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZFxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3MgSW5zZXJ0IGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBpZiBAcGFyZW50PyBhbmQgQGRlbGV0ZWRfYnkubGVuZ3RoIGlzIDFcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50IFwiZGVsZXRlXCIsIEBcblxuICAgICNcbiAgICAjIElmIGlzRGVsZXRlZCgpIGlzIHRydWUgdGhpcyBvcGVyYXRpb24gd29uJ3QgYmUgbWFpbnRhaW5lZCBpbiB0aGUgc2xcbiAgICAjXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBAZGVsZXRlZF9ieT8ubGVuZ3RoID4gMFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgICNUT0RPOiBkZWxldGUgdGhpc1xuICAgICAgICBpZiBAIGlzIEBwcmV2X2NsXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBzaG91bGQgbm90IGhhcHBlbiA7KSBcIlxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVXBkYXRlIHRoZSBzaG9ydCBsaXN0XG4gICAgIyBUT0RPIChVbnVzZWQpXG4gICAgdXBkYXRlX3NsOiAoKS0+XG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHVwZGF0ZTogKGRlc3RfY2wsZGVzdF9zbCktPlxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgaWYgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgbyA9IG9bZGVzdF9jbF1cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBAW2Rlc3Rfc2xdID0gb1xuXG4gICAgICAgICAgICBicmVha1xuICAgICAgdXBkYXRlIFwicHJldl9jbFwiLCBcInByZXZfc2xcIlxuICAgICAgdXBkYXRlIFwibmV4dF9jbFwiLCBcInByZXZfc2xcIlxuXG5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQGlzX2V4ZWN1dGVkP1xuICAgICAgICByZXR1cm4gQFxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAcHJldl9jbD8udmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKSBhbmQgQG5leHRfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBwcmV2X2NsLm5leHRfY2wgaXNudCBAXG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IDBcbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgICAgICMgICAgICAgICBsZXQgJE9MPSBbbzEsbzIsbzMsbzRdLCB3aGVyZWJ5ICR0aGlzIGlzIHRvIGJlIGluc2VydGVkIGJldHdlZW4gbzEgYW5kIG80XG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICAgICAjICAgICAgICAgdGhlbiBvMiBrbm93cyBvMy4gU2luY2Ugb24gYW5vdGhlciBjbGllbnQgJE9MIGNvdWxkIGJlIFtvMSxvMyxvNF0gdGhlIHByb2JsZW0gaXMgY29tcGxleFxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgIGlmIGN1cnJlbnQgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uID4gJG8gb3JpZ2luOiAkdGhpcyBpbnNcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZSAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgICAgICMgY2FzZSAzOiAkb3JpZ2luID4gJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICAgaWYgbm90IG8/XG4gICAgICAgICAgICAgICMgVE9ETzogRGVidWdnaW5nXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby5jcmVhdG9yIDwgQGNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcbiAgICAgICAgcGFyZW50ID0gQHByZXZfY2w/LmdldFBhcmVudCgpXG4gICAgICAgIGlmIHBhcmVudD9cbiAgICAgICAgICBAc2V0UGFyZW50IHBhcmVudFxuICAgICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50IFwiaW5zZXJ0XCIsIEBcbiAgICAgICAgc3VwZXIgIyBub3RpZnkgdGhlIGV4ZWN1dGlvbl9saXN0ZW5lcnNcblxuICAgICNcbiAgICAjIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQb3NpdGlvbjogKCktPlxuICAgICAgcG9zaXRpb24gPSAwXG4gICAgICBwcmV2ID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgcHJldiBpbnN0YW5jZW9mIERlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHByZXYuaXNEZWxldGVkPyBhbmQgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG4gICNcbiAgIyBEZWZpbmVzIGFuIG9iamVjdCB0aGF0IGlzIGNhbm5vdCBiZSBjaGFuZ2VkLiBZb3UgY2FuIHVzZSB0aGlzIHRvIHNldCBhbiBpbW11dGFibGUgc3RyaW5nLCBvciBhIG51bWJlci5cbiAgI1xuICBjbGFzcyBJbW11dGFibGVPYmplY3QgZXh0ZW5kcyBJbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBjb250ZW50XG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBAY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgQHJldHVybiBbU3RyaW5nXSBUaGUgY29udGVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgdmFsIDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogXCJJbW11dGFibGVPYmplY3RcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnY29udGVudCcgOiBAY29udGVudFxuICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBpZiBAbmV4dF9jbD9cbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ0ltbXV0YWJsZU9iamVjdCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSW1tdXRhYmxlT2JqZWN0IHVpZCwgY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3MgRGVsaW1pdGVyIGV4dGVuZHMgT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgaXNEZWxldGVkKCkgaXMgdHJ1ZSB0aGlzIG9wZXJhdGlvbiB3b24ndCBiZSBtYWludGFpbmVkIGluIHRoZSBzbFxuICAgICNcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnRGVsaW1pdGVyJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgRGVsaW1pdGVyIHVpZCwgcHJldiwgbmV4dFxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICd0eXBlcycgOlxuICAgICAgJ0RlbGV0ZScgOiBEZWxldGVcbiAgICAgICdJbnNlcnQnIDogSW5zZXJ0XG4gICAgICAnRGVsaW1pdGVyJzogRGVsaW1pdGVyXG4gICAgICAnT3BlcmF0aW9uJzogT3BlcmF0aW9uXG4gICAgICAnSW1tdXRhYmxlT2JqZWN0JyA6IEltbXV0YWJsZU9iamVjdFxuICAgICdwYXJzZXInIDogcGFyc2VyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IGJhc2ljX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBNYXBNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uVHlwZXMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGNvbnRlbnQ/XG4gICAgICAgIGlmIG5vdCBAbWFwW25hbWVdP1xuICAgICAgICAgIEhCLmFkZE9wZXJhdGlvbihuZXcgQWRkTmFtZSB1bmRlZmluZWQsIEAsIG5hbWUpLmV4ZWN1dGUoKVxuICAgICAgICBAbWFwW25hbWVdLnJlcGxhY2UgY29udGVudFxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIG9iaiA9IEBtYXBbbmFtZV0/LnZhbCgpXG4gICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgIG9iai52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgb2JqXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQG1hcFxuICAgICAgICAgIG9iaiA9IG8udmFsKClcbiAgICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3Qgb3Igb2JqIGluc3RhbmNlb2YgTWFwTWFuYWdlclxuICAgICAgICAgICAgb2JqID0gb2JqLnZhbCgpXG4gICAgICAgICAgcmVzdWx0W25hbWVdID0gb2JqXG4gICAgICAgIHJlc3VsdFxuXG4gICNcbiAgIyBXaGVuIGEgbmV3IHByb3BlcnR5IGluIGEgbWFwIG1hbmFnZXIgaXMgY3JlYXRlZCwgdGhlbiB0aGUgdWlkcyBvZiB0aGUgaW5zZXJ0ZWQgT3BlcmF0aW9uc1xuICAjIG11c3QgYmUgdW5pcXVlICh0aGluayBhYm91dCBjb25jdXJyZW50IG9wZXJhdGlvbnMpLiBUaGVyZWZvcmUgb25seSBhbiBBZGROYW1lIG9wZXJhdGlvbiBpcyBhbGxvd2VkIHRvXG4gICMgYWRkIGEgcHJvcGVydHkgaW4gYSBNYXBNYW5hZ2VyLiBJZiB0d28gQWRkTmFtZSBvcGVyYXRpb25zIG9uIHRoZSBzYW1lIE1hcE1hbmFnZXIgbmFtZSBoYXBwZW4gY29uY3VycmVudGx5XG4gICMgb25seSBvbmUgd2lsbCBBZGROYW1lIG9wZXJhdGlvbiB3aWxsIGJlIGV4ZWN1dGVkLlxuICAjXG4gIGNsYXNzIEFkZE5hbWUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBtYXBfbWFuYWdlciBVaWQgb3IgcmVmZXJlbmNlIHRvIHRoZSBNYXBNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCB3aWxsIGJlIGFkZGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgbWFwX21hbmFnZXIsIEBuYW1lKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbWFwX21hbmFnZXInLCBtYXBfbWFuYWdlclxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBJZiBtYXBfbWFuYWdlciBkb2Vzbid0IGhhdmUgdGhlIHByb3BlcnR5IG5hbWUsIHRoZW4gYWRkIGl0LlxuICAgICMgVGhlIFJlcGxhY2VNYW5hZ2VyIHRoYXQgaXMgYmVpbmcgd3JpdHRlbiBvbiB0aGUgcHJvcGVydHkgaXMgdW5pcXVlXG4gICAgIyBpbiBzdWNoIGEgd2F5IHRoYXQgaWYgQWRkTmFtZSBpcyBleGVjdXRlZCAoZnJvbSBhbm90aGVyIHBlZXIpIGl0IHdpbGxcbiAgICAjIGFsd2F5cyBoYXZlIHRoZSBzYW1lIHJlc3VsdCAoUmVwbGFjZU1hbmFnZXIsIGFuZCBpdHMgYmVnaW5uaW5nIGFuZCBlbmQgYXJlIHRoZSBzYW1lKVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHVpZF9yID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgIHVpZF9yLm9wX251bWJlciA9IFwiXyN7dWlkX3Iub3BfbnVtYmVyfV9STV8je0BuYW1lfVwiXG4gICAgICAgIGlmIG5vdCBIQi5nZXRPcGVyYXRpb24odWlkX3IpP1xuICAgICAgICAgIHVpZF9iZWcgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfYmVnLm9wX251bWJlciA9IFwiXyN7dWlkX2JlZy5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2JlZ2lubmluZ1wiXG4gICAgICAgICAgdWlkX2VuZCA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICAgIHVpZF9lbmQub3BfbnVtYmVyID0gXCJfI3t1aWRfZW5kLm9wX251bWJlcn1fUk1fI3tAbmFtZX1fZW5kXCJcbiAgICAgICAgICBiZWcgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfYmVnLCB1bmRlZmluZWQsIHVpZF9lbmQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGVuZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgdHlwZXMuRGVsaW1pdGVyIHVpZF9lbmQsIGJlZywgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXSA9IEhCLmFkZE9wZXJhdGlvbihuZXcgUmVwbGFjZU1hbmFnZXIgdW5kZWZpbmVkLCB1aWRfciwgYmVnLCBlbmQpLmV4ZWN1dGUoKVxuICAgICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkFkZE5hbWVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnbWFwX21hbmFnZXInIDogQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICduYW1lJyA6IEBuYW1lXG4gICAgICB9XG5cbiAgcGFyc2VyWydBZGROYW1lJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdtYXBfbWFuYWdlcicgOiBtYXBfbWFuYWdlclxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICduYW1lJyA6IG5hbWVcbiAgICB9ID0ganNvblxuICAgIG5ldyBBZGROYW1lIHVpZCwgbWFwX21hbmFnZXIsIG5hbWVcblxuICAjXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBMaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBpZiBiZWdpbm5pbmc/IGFuZCBlbmQ/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdiZWdpbm5pbmcnLCBiZWdpbm5pbmdcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2VuZCcsIGVuZFxuICAgICAgZWxzZVxuICAgICAgICBAYmVnaW5uaW5nID0gSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgICBAZW5kID0gICAgICAgSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIHJlc3VsdC5wdXNoIG9cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICBpZiAocG9zaXRpb24gPiAwIG9yIG8uaXNEZWxldGVkKCkpIGFuZCBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgIHdoaWxlIG8uaXNEZWxldGVkKCkgYW5kIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgICAjIGZpbmQgZmlyc3Qgbm9uIGRlbGV0ZWQgb3BcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgcG9zaXRpb24gLT0gMVxuXG5cbiAgICAgIG9cblxuICAjXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFdvcmRcbiAgI1xuICBjbGFzcyBSZXBsYWNlTWFuYWdlciBleHRlbmRzIExpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGluaXRpYWxfY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAgIGlmIGluaXRpYWxfY29udGVudD9cbiAgICAgICAgQHJlcGxhY2UgaW5pdGlhbF9jb250ZW50XG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgb3AgPSBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2xcbiAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFxuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICAjaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlTWFuYWdlclwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAbmV4dF9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlTWFuYWdlclwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgfSA9IGpzb25cbiAgICBuZXcgUmVwbGFjZU1hbmFnZXIgY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuICAjXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBSZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8gYW5kIGNvbnRlbnQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgY29udGVudCwgcHJldiwgYW5kIG5leHQgZm9yIFJlcGxhY2VhYmxlLXR5cGVzIVwiXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyByZXBsYWNlYWJsZSB3aXRoIG5ldyBjb250ZW50LlxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCktPlxuICAgICAgQHBhcmVudC5yZXBsYWNlIGNvbnRlbnRcblxuICAgICNcbiAgICAjIElmIHBvc3NpYmxlIHNldCB0aGUgcmVwbGFjZSBtYW5hZ2VyIGluIHRoZSBjb250ZW50LlxuICAgICMgQHNlZSBXb3JkLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQuc2V0UmVwbGFjZU1hbmFnZXI/KEBwYXJlbnQpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlYWJsZVwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudC5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuXG4gIHR5cGVzWydMaXN0TWFuYWdlciddID0gTGlzdE1hbmFnZXJcbiAgdHlwZXNbJ01hcE1hbmFnZXInXSA9IE1hcE1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VNYW5hZ2VyJ10gPSBSZXBsYWNlTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZWFibGUnXSA9IFJlcGxhY2VhYmxlXG5cbiAgYmFzaWNfdHlwZXNcblxuXG5cblxuXG5cbiIsInN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHN0cnVjdHVyZWRfdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHN0cnVjdHVyZWRfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEF0IHRoZSBtb21lbnQgVGV4dERlbGV0ZSB0eXBlIGVxdWFscyB0aGUgRGVsZXRlIHR5cGUgaW4gQmFzaWNUeXBlcy5cbiAgIyBAc2VlIEJhc2ljVHlwZXMuRGVsZXRlXG4gICNcbiAgY2xhc3MgVGV4dERlbGV0ZSBleHRlbmRzIHR5cGVzLkRlbGV0ZVxuICBwYXJzZXJbXCJUZXh0RGVsZXRlXCJdID0gcGFyc2VyW1wiRGVsZXRlXCJdXG5cbiAgI1xuICAjICBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyBUZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKClcbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudFxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlRleHRJbnNlcnRcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBUZXh0SW5zZXJ0IGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEhhbmRsZXMgYSBUZXh0LWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgI1xuICBjbGFzcyBXb3JkIGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkXG4gICAgI1xuICAgIGluc2VydFRleHQ6IChwb3NpdGlvbiwgY29udGVudCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgIG9wID0gbmV3IFRleHRJbnNlcnQgYywgdW5kZWZpbmVkLCBvLnByZXZfY2wsIG9cbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBkZWxldGVfb3BzXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgd29yZCB3aXRoIGFub3RoZXIgb25lLiBDb25jdXJyZW50IHJlcGxhY2VtZW50cyBhcmUgbm90IG1lcmdlZCFcbiAgICAjIE9ubHkgb25lIG9mIHRoZSByZXBsYWNlbWVudHMgd2lsbCBiZSB1c2VkLlxuICAgICNcbiAgICAjIENhbiBvbmx5IGJlIHVzZWQgaWYgdGhlIFJlcGxhY2VNYW5hZ2VyIHdhcyBzZXQhXG4gICAgIyBAc2VlIFdvcmQuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAjXG4gICAgcmVwbGFjZVRleHQ6ICh0ZXh0KS0+XG4gICAgICBpZiBAcmVwbGFjZV9tYW5hZ2VyP1xuICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBXb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCB0ZXh0XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXIucmVwbGFjZSh3b3JkKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgaXMgY3VycmVudGx5IG5vdCBtYWludGFpbmVkIGJ5IGEgUmVwbGFjZU1hbmFnZXIhXCJcblxuICAgICNcbiAgICAjIEByZXR1cm5zIFtKc29uXSBBIEpzb24gb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIEluIG1vc3QgY2FzZXMgeW91IHdvdWxkIGVtYmVkIGEgV29yZCBpbiBhIFJlcGxhY2VhYmxlLCB3aWNoIGlzIGhhbmRsZWQgYnkgdGhlIFJlcGxhY2VNYW5hZ2VyIGluIG9yZGVyXG4gICAgIyB0byBwcm92aWRlIHJlcGxhY2UgZnVuY3Rpb25hbGl0eS5cbiAgICAjXG4gICAgc2V0UmVwbGFjZU1hbmFnZXI6IChvcCktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3JlcGxhY2VfbWFuYWdlcicsIG9wXG4gICAgICBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnNcblxuICAgICNcbiAgICAjIEJpbmQgdGhpcyBXb3JkIHRvIGEgdGV4dGZpZWxkLlxuICAgICNcbiAgICBiaW5kOiAodGV4dGZpZWxkKS0+XG4gICAgICB3b3JkID0gQFxuICAgICAgdGV4dGZpZWxkLnZhbHVlID0gQHZhbCgpXG5cbiAgICAgIEBvbiBcImluc2VydFwiLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIG9fcG9zID0gb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgaWYgY3Vyc29yIDw9IG9fcG9zXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjdXJzb3IgKz0gMVxuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG5cbiAgICAgIEBvbiBcImRlbGV0ZVwiLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIG9fcG9zID0gb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgaWYgY3Vyc29yIDwgb19wb3NcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGN1cnNvciAtPSAxXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgcmlnaHQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuXG4gICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIGxlZnQsIHJpZ2h0XG5cbiAgICAgICMgY29uc3VtZSBhbGwgdGV4dC1pbnNlcnQgY2hhbmdlcy5cbiAgICAgIHRleHRmaWVsZC5vbmtleXByZXNzID0gKGV2ZW50KS0+XG4gICAgICAgIGNoYXIgPSBudWxsXG4gICAgICAgIGlmIGV2ZW50LmtleT9cbiAgICAgICAgICBpZiBldmVudC5jaGFyQ29kZSBpcyAzMlxuICAgICAgICAgICAgY2hhciA9IFwiIFwiXG4gICAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlIGlzIDEzXG4gICAgICAgICAgICBjaGFyID0gJ1xcbidcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjaGFyID0gZXZlbnQua2V5XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZSBldmVudC5rZXlDb2RlXG4gICAgICAgIGlmIGNoYXIubGVuZ3RoID4gMFxuICAgICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCAocG9zKSwgZGlmZlxuICAgICAgICAgIHdvcmQuaW5zZXJ0VGV4dCBwb3MsIGNoYXJcbiAgICAgICAgICBuZXdfcG9zID0gcG9zICsgY2hhci5sZW5ndGhcbiAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgdGV4dGZpZWxkLm9ucGFzdGUgPSAoZXZlbnQpLT5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgdGV4dGZpZWxkLm9uY3V0ID0gKGV2ZW50KS0+XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgI1xuICAgICAgIyBjb25zdW1lIGRlbGV0ZXMuIE5vdGUgdGhhdFxuICAgICAgIyAgIGNocm9tZTogd29uJ3QgY29uc3VtZSBkZWxldGlvbnMgb24ga2V5cHJlc3MgZXZlbnQuXG4gICAgICAjICAga2V5Q29kZSBpcyBkZXByZWNhdGVkLiBCVVQ6IEkgZG9uJ3Qgc2VlIGFub3RoZXIgd2F5LlxuICAgICAgIyAgICAgc2luY2UgZXZlbnQua2V5IGlzIG5vdCBpbXBsZW1lbnRlZCBpbiB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIGNocm9tZS5cbiAgICAgICMgICAgIEV2ZXJ5IGJyb3dzZXIgc3VwcG9ydHMga2V5Q29kZS4gTGV0J3Mgc3RpY2sgd2l0aCBpdCBmb3Igbm93Li5cbiAgICAgICNcbiAgICAgIHRleHRmaWVsZC5vbmtleWRvd24gPSAoZXZlbnQpLT5cbiAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIGRpZmZcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGlmIGV2ZW50LmN0cmxLZXk/IGFuZCBldmVudC5jdHJsS2V5XG4gICAgICAgICAgICAgIHZhbCA9IHRleHRmaWVsZC52YWx1ZVxuICAgICAgICAgICAgICBuZXdfcG9zID0gcG9zXG4gICAgICAgICAgICAgIGRlbF9sZW5ndGggPSAwXG4gICAgICAgICAgICAgIGlmIHBvcyA+IDBcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd2hpbGUgbmV3X3BvcyA+IDAgYW5kIHZhbFtuZXdfcG9zXSBpc250IFwiIFwiIGFuZCB2YWxbbmV3X3Bvc10gaXNudCAnXFxuJ1xuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgbmV3X3BvcywgKHBvcy1uZXdfcG9zKVxuICAgICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcy0xKSwgMVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCAxXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cblxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIldvcmRcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnV29yZCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBXb3JkIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkJ10gPSBXb3JkXG4gIHN0cnVjdHVyZWRfdHlwZXNcblxuXG4iXX0=
