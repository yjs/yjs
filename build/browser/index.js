(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var createIwcConnector;

createIwcConnector = function(callback, initial_user_id) {
  var IwcConnector, duiClient, init, iwcHandler, received_HB;
  iwcHandler = {};
  duiClient = new DUIClient();
  duiClient.connect(function(intent) {
    var _ref;
    return (_ref = iwcHandler[intent.action]) != null ? _ref.map(function(f) {
      return setTimeout(function() {
        return f(intent);
      }, 0);
    }) : void 0;
  });
  duiClient.initOK();
  received_HB = null;
  IwcConnector = (function() {
    function IwcConnector(engine, HB, execution_listener, yatta) {
      var receiveHB, receive_, sendHistoryBuffer, send_;
      this.engine = engine;
      this.HB = HB;
      this.execution_listener = execution_listener;
      this.yatta = yatta;
      this.duiClient = duiClient;
      this.iwcHandler = iwcHandler;
      send_ = (function(_this) {
        return function(o) {
          if (Object.getOwnPropertyNames(_this.initialized).length !== 0) {
            return _this.send(o);
          }
        };
      })(this);
      this.execution_listener.push(send_);
      this.initialized = {};
      receiveHB = (function(_this) {
        return function(json) {
          var him;
          HB = json.extras.HB;
          him = json.extras.user;
          _this.engine.applyOpsCheckDouble(HB);
          return _this.initialized[him] = true;
        };
      })(this);
      iwcHandler["Yatta_push_HB_element"] = [receiveHB];
      this.sendIwcIntent("Yatta_get_HB_element", {});
      receive_ = (function(_this) {
        return function(intent) {
          var o;
          o = intent.extras;
          if (_this.initialized[o.uid.creator] != null) {
            return _this.receive(o);
          }
        };
      })(this);
      this.iwcHandler["Yatta_new_operation"] = [receive_];
      if (received_HB != null) {
        this.engine.applyOpsCheckDouble(received_HB);
      }
      sendHistoryBuffer = (function(_this) {
        return function() {
          var json;
          json = {
            HB: _this.yatta.getHistoryBuffer()._encode(),
            user: _this.yatta.getUserId()
          };
          return _this.sendIwcIntent("Yatta_push_HB_element", json);
        };
      })(this);
      this.iwcHandler["Yatta_get_HB_element"] = [sendHistoryBuffer];
    }

    IwcConnector.prototype.send = function(o) {
      if (o.uid.creator === this.HB.getUserId() && (typeof o.uid.op_number !== "string")) {
        return this.sendIwcIntent("Yatta_new_operation", o);
      }
    };

    IwcConnector.prototype.receive = function(o) {
      if (o.uid.creator !== this.HB.getUserId()) {
        return this.engine.applyOp(o);
      }
    };

    IwcConnector.prototype.sendIwcIntent = function(action_name, content) {
      var intent;
      intent = {
        action: action_name,
        component: "",
        data: "",
        dataType: "",
        flags: ["PUBLISH_GLOBAL"],
        extras: content
      };
      return this.duiClient.sendIntent(intent);
    };

    return IwcConnector;

  })();
  init = function() {
    var proposed_user_id;
    proposed_user_id = null;
    if (initial_user_id != null) {
      proposed_user_id = initial_user_id;
    } else {
      proposed_user_id = Math.floor(Math.random() * 1000000);
    }
    return callback(IwcConnector, proposed_user_id);
  };
  setTimeout(init, 5000);
  return void 0;
};

module.exports = createIwcConnector;

if (typeof window !== "undefined" && window !== null) {
  if (window.Y == null) {
    window.Y = {};
  }
  window.Y.createIwcConnector = createIwcConnector;
}


},{}],2:[function(require,module,exports){
var _;

_ = require("underscore");

module.exports = function(user_list) {
  var TestConnector;
  return TestConnector = (function() {
    function TestConnector(engine, HB, execution_listener) {
      var appliedOperationsListener, send_;
      this.engine = engine;
      this.HB = HB;
      this.execution_listener = execution_listener;
      send_ = (function(_this) {
        return function(o) {
          return _this.send(o);
        };
      })(this);
      this.execution_listener.push(send_);
      this.applied_operations = [];
      appliedOperationsListener = (function(_this) {
        return function(o) {
          return _this.applied_operations.push(o);
        };
      })(this);
      this.execution_listener.push(appliedOperationsListener);
      if (!((user_list != null ? user_list.length : void 0) === 0)) {
        this.engine.applyOps(user_list[0].getHistoryBuffer()._encode());
      }
      this.unexecuted = {};
    }

    TestConnector.prototype.getOpsInExecutionOrder = function() {
      return this.applied_operations;
    };

    TestConnector.prototype.send = function(o) {
      var user, _i, _len, _results;
      if ((o.uid.creator === this.HB.getUserId()) && (typeof o.uid.op_number !== "string")) {
        _results = [];
        for (_i = 0, _len = user_list.length; _i < _len; _i++) {
          user = user_list[_i];
          if (user.getUserId() !== this.HB.getUserId()) {
            _results.push(user.getConnector().receive(o));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    TestConnector.prototype.receive = function(o) {
      var _base, _name;
      if ((_base = this.unexecuted)[_name = o.uid.creator] == null) {
        _base[_name] = [];
      }
      return this.unexecuted[o.uid.creator].push(o);
    };

    TestConnector.prototype.flushOne = function(user) {
      var _ref;
      if (((_ref = this.unexecuted[user]) != null ? _ref.length : void 0) > 0) {
        return this.engine.applyOp(this.unexecuted[user].shift());
      }
    };

    TestConnector.prototype.flushOneRandom = function() {
      return this.flushOne(_.random(0, user_list.length - 1));
    };

    TestConnector.prototype.flushAll = function() {
      var n, ops, _ref;
      _ref = this.unexecuted;
      for (n in _ref) {
        ops = _ref[n];
        this.engine.applyOps(ops);
      }
      return this.unexecuted = {};
    };

    return TestConnector;

  })();
};


},{"underscore":12}],3:[function(require,module,exports){
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


},{}],4:[function(require,module,exports){
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

module.exports = JsonYatta;

if (typeof window !== "undefined" && window !== null) {
  if (window.Y == null) {
    window.Y = {};
  }
  window.Y.JsonYatta = JsonYatta;
}


},{"../Engine":3,"../HistoryBuffer":6,"../Types/JsonTypes":8}],5:[function(require,module,exports){
var Engine, HistoryBuffer, TextYatta, text_types_uninitialized;

text_types_uninitialized = require("../Types/TextTypes");

HistoryBuffer = require("../HistoryBuffer");

Engine = require("../Engine");

TextYatta = (function() {
  function TextYatta(user_id, Connector) {
    var first_word, text_types;
    this.HB = new HistoryBuffer(user_id);
    text_types = text_types_uninitialized(this.HB);
    this.engine = new Engine(this.HB, text_types.parser);
    this.connector = new Connector(this.engine, this.HB, text_types.execution_listener);
    first_word = new text_types.types.Word(void 0);
    this.HB.addOperation(first_word).execute();
    this.root_element = first_word;
  }

  TextYatta.prototype.getRootElement = function() {
    return this.root_element;
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
    return this.root_element.val();
  };

  TextYatta.prototype.insertText = function(pos, content) {
    return this.root_element.insertText(pos, content);
  };

  TextYatta.prototype.deleteText = function(pos, length) {
    return this.root_element.deleteText(pos, length);
  };

  TextYatta.prototype.replaceText = function(text) {
    return this.root_element.replaceText(text);
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


},{"../Engine":3,"../HistoryBuffer":6,"../Types/TextTypes":10}],6:[function(require,module,exports){
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


},{}],7:[function(require,module,exports){
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
        position++;
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


},{}],8:[function(require,module,exports){
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


},{"./TextTypes":10}],9:[function(require,module,exports){
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
            console.log("position parameter exceeded the length of the document!");
            o = null;
            break;
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


},{"./BasicTypes":7}],10:[function(require,module,exports){
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
      var d, delete_ops, i, o, _i, _results;
      o = this.getOperationByPosition(position);
      delete_ops = [];
      _results = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        d = HB.addOperation(new TextDelete(void 0, o)).execute();
        o = o.next_cl;
        while (o.isDeleted() && !(o instanceof types.Delimiter)) {
          if (o instanceof types.Delimiter) {
            throw new Error("You can't delete more than there is..");
          }
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
        if (o instanceof types.Delimiter) {
          break;
        } else {
          _results.push(void 0);
        }
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

    Word.prototype.bind = function(textfield) {
      var document_length, position_start, update_yatta, word;
      word = this;
      textfield.value = this.val();
      position_start = null;
      document_length = null;
      this.on("insert", function(event, op) {
        var fix, left, o_pos, right;
        if (op.creator !== HB.getUserId()) {
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
          if (position_start != null) {
            document_length += 1;
            position_start = fix(position_start);
          }
          textfield.value = word.val();
          return textfield.setSelectionRange(left, right);
        }
      });
      this.on("delete", function(event, op) {
        var fix, left, o_pos, right;
        if (op.creator !== HB.getUserId()) {
          o_pos = op.getPosition();
          fix = function(cursor) {
            if (cursor <= o_pos) {
              return cursor;
            } else {
              cursor -= 1;
              return cursor;
            }
          };
          left = fix(textfield.selectionStart);
          right = fix(textfield.selectionEnd);
          if (position_start != null) {
            document_length -= 1;
            position_start = fix(position_start);
          }
          textfield.value = word.val();
          return textfield.setSelectionRange(left, right);
        }
      });
      update_yatta = function() {
        var current_position, deletion_position, document_length_diff, text_insert;
        if (position_start != null) {
          document_length_diff = textfield.value.length - document_length;
          current_position = Math.min(textfield.selectionStart, textfield.selectionEnd);
          if (document_length_diff < 0) {
            deletion_position = Math.min(current_position, position_start);
            word.deleteText(deletion_position, Math.abs(document_length_diff));
          } else if (document_length_diff > 0) {
            text_insert = textfield.value.substring(position_start, position_start + document_length_diff);
            word.insertText(position_start, text_insert);
          }
          position_start = null;
          return document_length = null;
        }
      };
      textfield.onkeydown = function(event) {
        var selection_range;
        if (position_start != null) {
          update_yatta();
        }
        selection_range = Math.abs(textfield.selectionEnd - textfield.selectionStart);
        position_start = Math.min(textfield.selectionStart, textfield.selectionEnd);
        word.deleteText(position_start, selection_range);
        return document_length = textfield.value.length - selection_range;
      };
      return textfield.onkeyup = function(event) {
        return update_yatta();
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


},{"./StructuredTypes":9}],11:[function(require,module,exports){
exports['IwcConnector'] = require('./Connectors/IwcConnector');

exports['TestConnector'] = require('./Connectors/TestConnector');

exports['JsonYatta'] = require('./Frameworks/JsonYatta');

exports['TextYatta'] = require('./Frameworks/TextYatta');


},{"./Connectors/IwcConnector":1,"./Connectors/TestConnector":2,"./Frameworks/JsonYatta":4,"./Frameworks/TextYatta":5}],12:[function(require,module,exports){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

},{}]},{},[11])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvSXdjQ29ubmVjdG9yLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvQ29ubmVjdG9ycy9UZXN0Q29ubmVjdG9yLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvRW5naW5lLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvRnJhbWV3b3Jrcy9Kc29uWWF0dGEuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9GcmFtZXdvcmtzL1RleHRZYXR0YS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0hpc3RvcnlCdWZmZXIuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvSnNvblR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvU3RydWN0dXJlZFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvaW5kZXguY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL25vZGVfbW9kdWxlcy91bmRlcnNjb3JlL3VuZGVyc2NvcmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNLQSxJQUFBLGtCQUFBOztB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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbiNcbiMgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSBjb25uZWN0b3IgaXMgaW5pdGlhbGl6ZWQuXG4jIEBwYXJhbSB7U3RyaW5nfSBpbml0aWFsX3VzZXJfaWQgT3B0aW9uYWwuIFlvdSBjYW4gc2V0IHlvdSBvd24gdXNlcl9pZCAoc2luY2UgdGhlIGlkcyBvZiBkdWljbGllbnQgYXJlIG5vdCBhbHdheXMgdW5pcXVlKVxuI1xuY3JlYXRlSXdjQ29ubmVjdG9yID0gKGNhbGxiYWNrLCBpbml0aWFsX3VzZXJfaWQpLT5cbiAgaXdjSGFuZGxlciA9IHt9XG4gIGR1aUNsaWVudCA9IG5ldyBEVUlDbGllbnQoKVxuICAjQGR1aUNsaWVudCA9IG5ldyBpd2MuQ2xpZW50KClcbiAgZHVpQ2xpZW50LmNvbm5lY3QgKGludGVudCktPlxuICAgIGl3Y0hhbmRsZXJbaW50ZW50LmFjdGlvbl0/Lm1hcCAoZiktPlxuICAgICAgc2V0VGltZW91dCAoKS0+XG4gICAgICAgIGYgaW50ZW50XG4gICAgICAsIDBcblxuICBkdWlDbGllbnQuaW5pdE9LKClcblxuICByZWNlaXZlZF9IQiA9IG51bGxcblxuICAjXG4gICMgVGhlIEl3YyBDb25uZWN0b3IgYWRkcyBzdXBwb3J0IGZvciB0aGUgSW50ZXItV2lkZ2V0LUNvbW11bmljYXRpb24gcHJvdG9jb2wgdGhhdCBpcyB1c2VkIGluIHRoZSBSb2xlLVNESy5cbiAgIyBAc2VlIGh0dHA6Ly9kYmlzLnJ3dGgtYWFjaGVuLmRlL2Ntcy9wcm9qZWN0cy90aGUteG1wcC1leHBlcmllbmNlI2ludGVyd2lkZ2V0LWNvbW11bmljYXRpb25cbiAgIyBAc2VlIGh0dHA6Ly9kYmlzLnJ3dGgtYWFjaGVuLmRlL2Ntcy9wcm9qZWN0cy9ST0xFXG4gICNcbiAgY2xhc3MgSXdjQ29ubmVjdG9yXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcbiAgICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgICAjIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiAgICAjIEBwYXJhbSB7WWF0dGF9IHlhdHRhIFRoZSBZYXR0YSBmcmFtZXdvcmsuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoQGVuZ2luZSwgQEhCLCBAZXhlY3V0aW9uX2xpc3RlbmVyLCBAeWF0dGEpLT5cbiAgICAgIEBkdWlDbGllbnQgPSBkdWlDbGllbnRcbiAgICAgIEBpd2NIYW5kbGVyID0gaXdjSGFuZGxlclxuXG4gICAgICBzZW5kXyA9IChvKT0+XG4gICAgICAgIGlmIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKEBpbml0aWFsaXplZCkubGVuZ3RoIGlzbnQgMFxuICAgICAgICAgIEBzZW5kIG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG4gICAgICBAaW5pdGlhbGl6ZWQgPSB7fVxuICAgICAgcmVjZWl2ZUhCID0gKGpzb24pPT5cbiAgICAgICAgSEIgPSBqc29uLmV4dHJhcy5IQlxuICAgICAgICBoaW0gPSBqc29uLmV4dHJhcy51c2VyXG4gICAgICAgIHRoaXMuZW5naW5lLmFwcGx5T3BzQ2hlY2tEb3VibGUgSEJcbiAgICAgICAgQGluaXRpYWxpemVkW2hpbV0gPSB0cnVlXG4gICAgICBpd2NIYW5kbGVyW1wiWWF0dGFfcHVzaF9IQl9lbGVtZW50XCJdID0gW3JlY2VpdmVIQl1cblxuICAgICAgQHNlbmRJd2NJbnRlbnQgXCJZYXR0YV9nZXRfSEJfZWxlbWVudFwiLCB7fVxuXG4gICAgICByZWNlaXZlXyA9IChpbnRlbnQpPT5cbiAgICAgICAgbyA9IGludGVudC5leHRyYXNcbiAgICAgICAgaWYgQGluaXRpYWxpemVkW28udWlkLmNyZWF0b3JdPyAjIGluaXRpYWxpemUgZmlyc3RcbiAgICAgICAgICBAcmVjZWl2ZSBvXG5cbiAgICAgIEBpd2NIYW5kbGVyW1wiWWF0dGFfbmV3X29wZXJhdGlvblwiXSA9IFtyZWNlaXZlX11cblxuICAgICAgaWYgcmVjZWl2ZWRfSEI/XG4gICAgICAgIEBlbmdpbmUuYXBwbHlPcHNDaGVja0RvdWJsZSByZWNlaXZlZF9IQlxuXG4gICAgICBzZW5kSGlzdG9yeUJ1ZmZlciA9ICgpPT5cbiAgICAgICAganNvbiA9XG4gICAgICAgICAgSEIgOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoKVxuICAgICAgICAgIHVzZXIgOiBAeWF0dGEuZ2V0VXNlcklkKClcbiAgICAgICAgQHNlbmRJd2NJbnRlbnQgXCJZYXR0YV9wdXNoX0hCX2VsZW1lbnRcIiwganNvblxuICAgICAgQGl3Y0hhbmRsZXJbXCJZYXR0YV9nZXRfSEJfZWxlbWVudFwiXSA9IFtzZW5kSGlzdG9yeUJ1ZmZlcl1cblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgZXhlY3V0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIGV4ZWN1dGVkLlxuICAgICNcbiAgICBzZW5kOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpcyBASEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgICAgQHNlbmRJd2NJbnRlbnQgXCJZYXR0YV9uZXdfb3BlcmF0aW9uXCIsIG9cblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIHJlY2VpdmVkLlxuICAgICNcbiAgICByZWNlaXZlOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpc250IEBIQi5nZXRVc2VySWQoKVxuICAgICAgICBAZW5naW5lLmFwcGx5T3Agb1xuXG4gICAgI1xuICAgICMgSGVscGVyIGZvciBzZW5kaW5nIGl3YyBpbnRlbnRzLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGFjdGlvbl9uYW1lIFRoZSBuYW1lIG9mIHRoZSBhY3Rpb24gdGhhdCBpcyBnb2luZyB0byBiZSBzZW5kLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgdGhhdCBpcyBhdHRlY2hlZCB0byB0aGUgaW50ZW50LlxuICAgICNcbiAgICBzZW5kSXdjSW50ZW50OiAoYWN0aW9uX25hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGludGVudCA9XG4gICAgICAgIGFjdGlvbjogYWN0aW9uX25hbWVcbiAgICAgICAgY29tcG9uZW50OiBcIlwiXG4gICAgICAgIGRhdGE6IFwiXCJcbiAgICAgICAgZGF0YVR5cGU6IFwiXCJcbiAgICAgICAgZmxhZ3M6IFtcIlBVQkxJU0hfR0xPQkFMXCJdXG4gICAgICAgIGV4dHJhczogY29udGVudFxuXG4gICAgICBAZHVpQ2xpZW50LnNlbmRJbnRlbnQoaW50ZW50KVxuXG5cblxuICBpbml0ID0gKCktPlxuICAgIHByb3Bvc2VkX3VzZXJfaWQgPSBudWxsXG4gICAgaWYgaW5pdGlhbF91c2VyX2lkP1xuICAgICAgcHJvcG9zZWRfdXNlcl9pZCA9IGluaXRpYWxfdXNlcl9pZFxuICAgIGVsc2VcbiAgICAgICMgcHJvcG9zZWRfdXNlcl9pZCA9IGR1aUNsaWVudC5nZXRJd2NDbGllbnQoKS5fY29tcG9uZW50TmFtZSAjVE9ETzogVGhpcyBpcyBzdHVwaWQhIHdoeSBjYW4ndCBpIHVzZSB0aGlzP1xuICAgICAgcHJvcG9zZWRfdXNlcl9pZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSoxMDAwMDAwKVxuICAgIGNhbGxiYWNrIEl3Y0Nvbm5lY3RvciwgcHJvcG9zZWRfdXNlcl9pZFxuXG4gIHNldFRpbWVvdXQgaW5pdCwgNTAwMFxuXG4gIHVuZGVmaW5lZFxuXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlSXdjQ29ubmVjdG9yXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLmNyZWF0ZUl3Y0Nvbm5lY3RvciA9IGNyZWF0ZUl3Y0Nvbm5lY3RvclxuXG4iLCJcbl8gPSByZXF1aXJlIFwidW5kZXJzY29yZVwiXG5cbm1vZHVsZS5leHBvcnRzID0gKHVzZXJfbGlzdCktPlxuXG4gICNcbiAgIyBBIHRyaXZpYWwgQ29ubmVjdG9yIHRoYXQgc2ltdWxhdGVzIG5ldHdvcmsgZGVsYXkuXG4gICNcbiAgY2xhc3MgVGVzdENvbm5lY3RvclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4gICAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICAgIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4gICAgIyBAcGFyYW0ge1lhdHRhfSB5YXR0YSBUaGUgWWF0dGEgZnJhbWV3b3JrLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBlbmdpbmUsIEBIQiwgQGV4ZWN1dGlvbl9saXN0ZW5lciktPlxuICAgICAgc2VuZF8gPSAobyk9PlxuICAgICAgICBAc2VuZCBvXG4gICAgICBAZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cblxuICAgICAgQGFwcGxpZWRfb3BlcmF0aW9ucyA9IFtdXG4gICAgICBhcHBsaWVkT3BlcmF0aW9uc0xpc3RlbmVyID0gKG8pPT5cbiAgICAgICAgQGFwcGxpZWRfb3BlcmF0aW9ucy5wdXNoIG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBhcHBsaWVkT3BlcmF0aW9uc0xpc3RlbmVyXG4gICAgICBpZiBub3QgKHVzZXJfbGlzdD8ubGVuZ3RoIGlzIDApXG4gICAgICAgIEBlbmdpbmUuYXBwbHlPcHMgdXNlcl9saXN0WzBdLmdldEhpc3RvcnlCdWZmZXIoKS5fZW5jb2RlKClcblxuICAgICAgQHVuZXhlY3V0ZWQgPSB7fVxuXG4gICAgI1xuICAgICMgVGhpcyBlbmdpbmUgYXBwbGllZCBvcGVyYXRpb25zIGluIGEgc3BlY2lmaWMgb3JkZXIuXG4gICAgIyBHZXQgdGhlIG9wcyBpbiB0aGUgcmlnaHQgb3JkZXIuXG4gICAgI1xuICAgIGdldE9wc0luRXhlY3V0aW9uT3JkZXI6ICgpLT5cbiAgICAgIEBhcHBsaWVkX29wZXJhdGlvbnNcblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgZXhlY3V0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIGV4ZWN1dGVkLlxuICAgICNcbiAgICBzZW5kOiAobyktPlxuICAgICAgaWYgKG8udWlkLmNyZWF0b3IgaXMgQEhCLmdldFVzZXJJZCgpKSBhbmQgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKVxuICAgICAgICBmb3IgdXNlciBpbiB1c2VyX2xpc3RcbiAgICAgICAgICBpZiB1c2VyLmdldFVzZXJJZCgpIGlzbnQgQEhCLmdldFVzZXJJZCgpXG4gICAgICAgICAgICB1c2VyLmdldENvbm5lY3RvcigpLnJlY2VpdmUobylcblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIHJlY2VpdmVkLlxuICAgICNcbiAgICByZWNlaXZlOiAobyktPlxuICAgICAgQHVuZXhlY3V0ZWRbby51aWQuY3JlYXRvcl0gPz0gW11cbiAgICAgIEB1bmV4ZWN1dGVkW28udWlkLmNyZWF0b3JdLnB1c2ggb1xuXG4gICAgI1xuICAgICMgRmx1c2ggb25lIG9wZXJhdGlvbiBmcm9tIHRoZSBsaW5lIG9mIGEgc3BlY2lmaWMgdXNlci5cbiAgICAjXG4gICAgZmx1c2hPbmU6ICh1c2VyKS0+XG4gICAgICBpZiBAdW5leGVjdXRlZFt1c2VyXT8ubGVuZ3RoID4gMFxuICAgICAgICBAZW5naW5lLmFwcGx5T3AgQHVuZXhlY3V0ZWRbdXNlcl0uc2hpZnQoKVxuXG4gICAgI1xuICAgICMgRmx1c2ggb25lIG9wZXJhdGlvbiBvbiBhIHJhbmRvbSBsaW5lLlxuICAgICNcbiAgICBmbHVzaE9uZVJhbmRvbTogKCktPlxuICAgICAgQGZsdXNoT25lIChfLnJhbmRvbSAwLCAodXNlcl9saXN0Lmxlbmd0aC0xKSlcblxuICAgICNcbiAgICAjIEZsdXNoIGFsbCBvcGVyYXRpb25zIG9uIGV2ZXJ5IGxpbmUuXG4gICAgI1xuICAgIGZsdXNoQWxsOiAoKS0+XG4gICAgICBmb3IgbixvcHMgb2YgQHVuZXhlY3V0ZWRcbiAgICAgICAgQGVuZ2luZS5hcHBseU9wcyBvcHNcbiAgICAgIEB1bmV4ZWN1dGVkID0ge31cblxuIiwiXHJcbiNcclxuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxyXG4jXHJcbmNsYXNzIEVuZ2luZVxyXG5cclxuICAjXHJcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXHJcbiAgIyBAcGFyYW0ge0FycmF5fSBwYXJzZXIgRGVmaW5lcyBob3cgdG8gcGFyc2UgZW5jb2RlZCBtZXNzYWdlcy5cclxuICAjXHJcbiAgY29uc3RydWN0b3I6IChASEIsIEBwYXJzZXIpLT5cclxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxyXG5cclxuICAjXHJcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cclxuICAjXHJcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XHJcbiAgICB0eXBlUGFyc2VyID0gQHBhcnNlcltqc29uLnR5cGVdXHJcbiAgICBpZiB0eXBlUGFyc2VyP1xyXG4gICAgICB0eXBlUGFyc2VyIGpzb25cclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIudG9Kc29uKCkuXHJcbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcclxuICAjXHJcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxyXG4gICAgb3BzID0gW11cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcclxuICAjXHJcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cclxuICAjXHJcbiAgYXBwbHlPcDogKG9wX2pzb24pLT5cclxuICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxyXG4gICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICBASEIuYWRkVG9Db3VudGVyIG9cclxuICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIGVsc2VcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL0pzb25UeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBKc29uIGRhdGEtc3RydWN0dXJlcy5cbiMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiMgKiBTdHJpbmdcbiMgKiBJbnRlZ2VyXG4jICogQXJyYXlcbiNcbmNsYXNzIEpzb25ZYXR0YVxuXG4gICNcbiAgIyBAcGFyYW0ge1N0cmluZ30gdXNlcl9pZCBVbmlxdWUgaWQgb2YgdGhlIHBlZXIuXG4gICMgQHBhcmFtIHtDb25uZWN0b3J9IENvbm5lY3RvciB0aGUgY29ubmVjdG9yIGNsYXNzLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAodXNlcl9pZCwgQ29ubmVjdG9yKS0+XG4gICAgQEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICAgIGpzb25fdHlwZXMgPSBqc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCBqc29uX3R5cGVzLnBhcnNlclxuICAgIEBjb25uZWN0b3IgPSBuZXcgQ29ubmVjdG9yIEBlbmdpbmUsIEBIQiwganNvbl90eXBlcy5leGVjdXRpb25fbGlzdGVuZXIsIEBcblxuICAgIGZpcnN0X3dvcmQgPSBuZXcganNvbl90eXBlcy50eXBlcy5Kc29uVHlwZSBASEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKClcbiAgICBASEIuYWRkT3BlcmF0aW9uKGZpcnN0X3dvcmQpLmV4ZWN1dGUoKVxuICAgIEByb290X2VsZW1lbnQgPSBmaXJzdF93b3JkXG5cbiAgI1xuICAjIEByZXN1bHQgSnNvblR5cGVcbiAgI1xuICBnZXRSb290RWxlbWVudDogKCktPlxuICAgIEByb290X2VsZW1lbnRcblxuICAjXG4gICMgQHNlZSBFbmdpbmVcbiAgI1xuICBnZXRFbmdpbmU6ICgpLT5cbiAgICBAZW5naW5lXG5cbiAgI1xuICAjIEdldCB0aGUgaW5pdGlhbGl6ZWQgY29ubmVjdG9yLlxuICAjXG4gIGdldENvbm5lY3RvcjogKCktPlxuICAgIEBjb25uZWN0b3JcblxuICAjXG4gICMgQHNlZSBIaXN0b3J5QnVmZmVyXG4gICNcbiAgZ2V0SGlzdG9yeUJ1ZmZlcjogKCktPlxuICAgIEBIQlxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnNldE11dGFibGVEZWZhdWx0XG4gICNcbiAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgQHJvb3RfZWxlbWVudC5zZXRNdXRhYmxlRGVmYXVsdChtdXRhYmxlKVxuXG4gICNcbiAgIyBHZXQgdGhlIFVzZXJJZCBmcm9tIHRoZSBIaXN0b3J5QnVmZmVyIG9iamVjdC5cbiAgIyBJbiBtb3N0IGNhc2VzIHRoaXMgd2lsbCBiZSB0aGUgc2FtZSBhcyB0aGUgdXNlcl9pZCB2YWx1ZSB3aXRoIHdoaWNoXG4gICMgSnNvbllhdHRhIHdhcyBpbml0aWFsaXplZCAoRGVwZW5kaW5nIG9uIHRoZSBIaXN0b3J5QnVmZmVyIGltcGxlbWVudGF0aW9uKS5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBASEIuZ2V0VXNlcklkKClcblxuICAjXG4gICMgQHNlZSBKc29uVHlwZS52YWxcbiAgI1xuICB2YWwgOiAobmFtZSwgY29udGVudCwgbXV0YWJsZSktPlxuICAgIEByb290X2VsZW1lbnQudmFsKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsdWVcbiAgI1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvbllhdHRhLnByb3RvdHlwZSwgJ3ZhbHVlJyxcbiAgICBnZXQgOiAtPiBAcm9vdF9lbGVtZW50LnZhbHVlXG4gICAgc2V0IDogKG8pLT5cbiAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgQHZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEpzb25ZYXR0YVxuaWYgd2luZG93P1xuICBpZiBub3Qgd2luZG93Llk/XG4gICAgd2luZG93LlkgPSB7fVxuICB3aW5kb3cuWS5Kc29uWWF0dGEgPSBKc29uWWF0dGFcbiIsIlxudGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4uL1R5cGVzL1RleHRUeXBlc1wiXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4uL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4uL0VuZ2luZVwiXG5cbiNcbiMgRnJhbWV3b3JrIGZvciBUZXh0IERhdGFzdHJ1Y3R1cmVzLlxuI1xuY2xhc3MgVGV4dFlhdHRhXG5cbiAgI1xuICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXFlIHVzZXIgaWQgdGhhdCBkZWZpbmVzIHRoaXMgcGVlci5cbiAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIFRoZSBjb25uZWN0b3IgZGVmaW5lcyBob3cgeW91IGNvbm5lY3QgdG8gdGhlIG90aGVyIHBlZXJzLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAodXNlcl9pZCwgQ29ubmVjdG9yKS0+XG4gICAgQEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICAgIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgQEhCXG4gICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0ZXh0X3R5cGVzLnBhcnNlclxuICAgIEBjb25uZWN0b3IgPSBuZXcgQ29ubmVjdG9yIEBlbmdpbmUsIEBIQiwgdGV4dF90eXBlcy5leGVjdXRpb25fbGlzdGVuZXJcblxuICAgIGZpcnN0X3dvcmQgPSBuZXcgdGV4dF90eXBlcy50eXBlcy5Xb3JkIHVuZGVmaW5lZFxuICAgIEBIQi5hZGRPcGVyYXRpb24oZmlyc3Rfd29yZCkuZXhlY3V0ZSgpXG4gICAgQHJvb3RfZWxlbWVudCA9IGZpcnN0X3dvcmRcblxuICAjXG4gICMgQHJlc3VsdCBXb3JkXG4gICNcbiAgZ2V0Um9vdEVsZW1lbnQ6ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50XG5cbiAgI1xuICAjIEBzZWUgRW5naW5lXG4gICNcbiAgZ2V0RW5naW5lOiAoKS0+XG4gICAgQGVuZ2luZVxuXG4gICNcbiAgIyBHZXQgdGhlIGluaXRpYWxpemVkIGNvbm5lY3Rvci5cbiAgI1xuICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICBAY29ubmVjdG9yXG5cbiAgI1xuICAjIEBzZWUgSGlzdG9yeUJ1ZmZlclxuICAjXG4gIGdldEhpc3RvcnlCdWZmZXI6ICgpLT5cbiAgICBASEJcblxuICAjXG4gICMgR2V0IHRoZSBVc2VySWQgZnJvbSB0aGUgSGlzdG9yeUJ1ZmZlciBvYmplY3QuXG4gICMgSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXMgdGhlIHVzZXJfaWQgdmFsdWUgd2l0aCB3aGljaFxuICAjIEpzb25ZYXR0YSB3YXMgaW5pdGlhbGl6ZWQgKERlcGVuZGluZyBvbiB0aGUgSGlzdG9yeUJ1ZmZlciBpbXBsZW1lbnRhdGlvbikuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQEhCLmdldFVzZXJJZCgpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsXG4gICNcbiAgdmFsOiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudC52YWwoKVxuXG4gICNcbiAgIyBAc2VlIFdvcmQuaW5zZXJ0VGV4dFxuICAjXG4gIGluc2VydFRleHQ6IChwb3MsIGNvbnRlbnQpLT5cbiAgICBAcm9vdF9lbGVtZW50Lmluc2VydFRleHQgcG9zLCBjb250ZW50XG5cbiAgI1xuICAjIEBzZWUgV29yZC5kZWxldGVUZXh0XG4gICNcbiAgZGVsZXRlVGV4dDogKHBvcywgbGVuZ3RoKS0+XG4gICAgQHJvb3RfZWxlbWVudC5kZWxldGVUZXh0IHBvcywgbGVuZ3RoXG5cbiAgI1xuICAjIEBzZWUgV29yZC5yZXBsYWNlVGV4dFxuICAjXG4gIHJlcGxhY2VUZXh0OiAodGV4dCktPlxuICAgIEByb290X2VsZW1lbnQucmVwbGFjZVRleHQgdGV4dFxuXG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dFlhdHRhXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLlRleHRZYXR0YSA9IFRleHRZYXR0YVxuIiwiXG4jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgI1xuICAjIFRoZXJlIGlzIG9ubHkgb25lIHJlc2VydmVkIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpLCBzbyB1c2UgaXQgd2lzZWx5LlxuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogJ18nXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAoKS0+XG4gICAgcmVzID0ge31cbiAgICBmb3IgdXNlcixjdG4gb2YgQG9wZXJhdGlvbl9jb3VudGVyXG4gICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICByZXNcblxuICAjXG4gICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgI1xuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiAobm90IGlzTmFOKHBhcnNlSW50KG9fbnVtYmVyKSkpIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/XG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/XG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX25leHQuY3JlYXRvciwgb19uZXh0Lm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQgaW5zdGFuY2VvZiBPYmplY3RcbiAgICAgIEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxuICAgIGVsc2UgaWYgbm90IHVpZD9cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgb2YgdWlkIGlzIG5vdCBkZWZpbmVkIVwiXG4gICNcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XG4gICMgb3RoZXIgb3BlcmF0aW9ucyAoaXQgd29udCBleGVjdXRlZClcbiAgI1xuICBhZGRPcGVyYXRpb246IChvKS0+XG4gICAgaWYgbm90IEBidWZmZXJbby5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIEBidWZmZXJbby5jcmVhdG9yXVtvLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSA9IDBcbiAgICBpZiB0eXBlb2Ygby5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8uY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0rK1xuICAgICNpZiBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSBpc250IChvLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIC0gKG8ub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgcGFyc2VyID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuXG4gICNcbiAgY2xhc3MgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIGlmIG5vdCB1aWQ/XG4gICAgICAgIHVpZCA9IEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIHtcbiAgICAgICAgJ2NyZWF0b3InOiBAY3JlYXRvclxuICAgICAgICAnb3BfbnVtYmVyJyA6IEBvcF9udW1iZXJcbiAgICAgIH0gPSB1aWRcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGV2ZW50IE5hbWUgb2YgdGhlIGV2ZW50LlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvbjogKGV2ZW50LCBmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID89IHt9XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzW2V2ZW50XSA/PSBbXVxuICAgICAgQGV2ZW50X2xpc3RlbmVyc1tldmVudF0ucHVzaCBmXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgI1xuICAgIGNhbGxFdmVudDogKGV2ZW50LCBhcmdzKS0+XG4gICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tldmVudF0/XG4gICAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdXG4gICAgICAgICAgZi5jYWxsIEAsIGV2ZW50LCBhcmdzXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAobyktPlxuICAgICAgQHBhcmVudCA9IG9cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIHsgJ2NyZWF0b3InOiBAY3JlYXRvciwgJ29wX251bWJlcic6IEBvcF9udW1iZXIgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gSW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBwYXJzZXJbJ0RlbGV0ZSddID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IERlbGV0ZSB1aWQsIGRlbGV0ZXNfdWlkXG5cbiAgI1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIEluc2VydCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgaWYgQHBhcmVudD8gYW5kIEBkZWxldGVkX2J5Lmxlbmd0aCBpcyAxXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImRlbGV0ZVwiLCBAXG5cbiAgICAjXG4gICAgIyBJZiBpc0RlbGV0ZWQoKSBpcyB0cnVlIHRoaXMgb3BlcmF0aW9uIHdvbid0IGJlIG1haW50YWluZWQgaW4gdGhlIHNsXG4gICAgI1xuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGRlbGV0ZWRfYnk/Lmxlbmd0aCA+IDBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICAjVE9ETzogZGVsZXRlIHRoaXNcbiAgICAgICAgaWYgQCBpcyBAcHJldl9jbFxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gOykgXCJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFVwZGF0ZSB0aGUgc2hvcnQgbGlzdFxuICAgICMgVE9ETyAoVW51c2VkKVxuICAgIHVwZGF0ZV9zbDogKCktPlxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB1cGRhdGU6IChkZXN0X2NsLGRlc3Rfc2wpLT5cbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgIGlmIG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIG8gPSBvW2Rlc3RfY2xdXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgQFtkZXN0X3NsXSA9IG9cblxuICAgICAgICAgICAgYnJlYWtcbiAgICAgIHVwZGF0ZSBcInByZXZfY2xcIiwgXCJwcmV2X3NsXCJcbiAgICAgIHVwZGF0ZSBcIm5leHRfY2xcIiwgXCJwcmV2X3NsXCJcblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEBpc19leGVjdXRlZD9cbiAgICAgICAgcmV0dXJuIEBcbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHByZXZfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBuZXh0X2NsPy52YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpIGFuZCBAcHJldl9jbC5uZXh0X2NsIGlzbnQgQFxuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSAwXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2UgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG5vdCBvP1xuICAgICAgICAgICAgICAjIFRPRE86IERlYnVnZ2luZ1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8uY3JlYXRvciA8IEBjcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG4gICAgICAgIHBhcmVudCA9IEBwcmV2X2NsPy5nZXRQYXJlbnQoKVxuICAgICAgICBpZiBwYXJlbnQ/XG4gICAgICAgICAgQHNldFBhcmVudCBwYXJlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImluc2VydFwiLCBAXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBEZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG4gICNcbiAgIyBEZWZpbmVzIGFuIG9iamVjdCB0aGF0IGlzIGNhbm5vdCBiZSBjaGFuZ2VkLiBZb3UgY2FuIHVzZSB0aGlzIHRvIHNldCBhbiBpbW11dGFibGUgc3RyaW5nLCBvciBhIG51bWJlci5cbiAgI1xuICBjbGFzcyBJbW11dGFibGVPYmplY3QgZXh0ZW5kcyBJbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBjb250ZW50XG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBAY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgQHJldHVybiBbU3RyaW5nXSBUaGUgY29udGVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgdmFsIDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogXCJJbW11dGFibGVPYmplY3RcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnY29udGVudCcgOiBAY29udGVudFxuICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBpZiBAbmV4dF9jbD9cbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbJ0ltbXV0YWJsZU9iamVjdCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSW1tdXRhYmxlT2JqZWN0IHVpZCwgY29udGVudCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3MgRGVsaW1pdGVyIGV4dGVuZHMgT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgaXNEZWxldGVkKCkgaXMgdHJ1ZSB0aGlzIG9wZXJhdGlvbiB3b24ndCBiZSBtYWludGFpbmVkIGluIHRoZSBzbFxuICAgICNcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHBhcnNlclsnRGVsaW1pdGVyJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgRGVsaW1pdGVyIHVpZCwgcHJldiwgbmV4dFxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICd0eXBlcycgOlxuICAgICAgJ0RlbGV0ZScgOiBEZWxldGVcbiAgICAgICdJbnNlcnQnIDogSW5zZXJ0XG4gICAgICAnRGVsaW1pdGVyJzogRGVsaW1pdGVyXG4gICAgICAnT3BlcmF0aW9uJzogT3BlcmF0aW9uXG4gICAgICAnSW1tdXRhYmxlT2JqZWN0JyA6IEltbXV0YWJsZU9iamVjdFxuICAgICdwYXJzZXInIDogcGFyc2VyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJ0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0VHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICB0ZXh0X3R5cGVzID0gdGV4dF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSB0ZXh0X3R5cGVzLnBhcnNlclxuXG4gIGNyZWF0ZUpzb25XcmFwcGVyID0gKF9qc29uVHlwZSktPlxuXG4gICAgI1xuICAgICMgQSBKc29uV3JhcHBlciB3YXMgaW50ZW5kZWQgdG8gYmUgYSBjb252ZW5pZW50IHdyYXBwZXIgZm9yIHRoZSBKc29uVHlwZS5cbiAgICAjIEJ1dCBpdCBjYW4gbWFrZSB0aGluZ3MgbW9yZSBkaWZmaWN1bHQgdGhhbiB0aGV5IGFyZS5cbiAgICAjIEBzZWUgSnNvblR5cGVcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBjcmVhdGUgYSBKc29uV3JhcHBlclxuICAgICMgICAjIFlvdSBnZXQgYSBKc29uV3JhcHBlciBmcm9tIGEgSnNvblR5cGUgYnkgY2FsbGluZ1xuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjXG4gICAgIyBJdCBjcmVhdGVzIEphdmFzY3JpcHRzIC1nZXR0ZXIgYW5kIC1zZXR0ZXIgbWV0aG9kcyBmb3IgZWFjaCBwcm9wZXJ0eSB0aGF0IEpzb25UeXBlIG1haW50YWlucy5cbiAgICAjIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2RlZmluZVByb3BlcnR5XG4gICAgI1xuICAgICMgQGV4YW1wbGUgR2V0dGVyIEV4YW1wbGVcbiAgICAjICAgIyB5b3UgY2FuIGFjY2VzcyB0aGUgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueFxuICAgICMgICAjIGluc3RlYWQgb2ZcbiAgICAjICAgeWF0dGEudmFsKCd4JylcbiAgICAjXG4gICAgIyBAbm90ZSBZb3UgY2FuIG9ubHkgb3ZlcndyaXRlIGV4aXN0aW5nIHZhbHVlcyEgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eSB3b24ndCBoYXZlIGFueSBlZmZlY3QhXG4gICAgI1xuICAgICMgQGV4YW1wbGUgU2V0dGVyIEV4YW1wbGVcbiAgICAjICAgIyB5b3UgY2FuIHNldCBhbiBleGlzdGluZyB4IHByb3BlcnR5IG9mIHlhdHRhIGJ5IGNhbGxpbmdcbiAgICAjICAgdy54ID0gXCJ0ZXh0XCJcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcsIFwidGV4dFwiKVxuICAgICNcbiAgICAjIEluIG9yZGVyIHRvIHNldCBhIG5ldyBwcm9wZXJ0eSB5b3UgaGF2ZSB0byBvdmVyd3JpdGUgYW4gZXhpc3RpbmcgcHJvcGVydHkuXG4gICAgIyBUaGVyZWZvcmUgdGhlIEpzb25XcmFwcGVyIHN1cHBvcnRzIGEgc3BlY2lhbCBmZWF0dXJlIHRoYXQgc2hvdWxkIG1ha2UgdGhpbmdzIG1vcmUgY29udmVuaWVudFxuICAgICMgKHdlIGNhbiBhcmd1ZSBhYm91dCB0aGF0LCB1c2UgdGhlIEpzb25UeXBlIGlmIHlvdSBkb24ndCBsaWtlIGl0IDspLlxuICAgICMgSWYgeW91IG92ZXJ3cml0ZSBhbiBvYmplY3QgcHJvcGVydHkgb2YgdGhlIEpzb25XcmFwcGVyIHdpdGggYSBuZXcgb2JqZWN0LCBpdCB3aWxsIHJlc3VsdCBpbiBhIG1lcmdlZCB2ZXJzaW9uIG9mIHRoZSBvYmplY3RzLlxuICAgICMgTGV0IHcucCB0aGUgcHJvcGVydHkgdGhhdCBpcyB0byBiZSBvdmVyd3JpdHRlbiBhbmQgbyB0aGUgbmV3IHZhbHVlLiBFLmcuIHcucCA9IG9cbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygb1xuICAgICMgKiBUaGUgcmVzdWx0IGhhcyBhbGwgcHJvcGVydGllcyBvZiB3LnAgaWYgdGhleSBkb24ndCBvY2N1ciB1bmRlciB0aGUgc2FtZSBwcm9wZXJ0eS1uYW1lIGluIG8uXG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29uZmxpY3QgRXhhbXBsZVxuICAgICMgICB5YXR0YS52YWx1ZSA9IHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiBcInN0cmluZ1wifVxuICAgICMgICB3LmEgPSB7YSA6IHtiIDogXCJzdHJpbmdcIn19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCJ9fVxuICAgICMgICB3LmEgPSB7YSA6IHtjIDogNH19XG4gICAgIyAgIGNvbnNvbGUubG9nKHcpICMge2EgOiB7YiA6IFwiU3RyaW5nXCIsIGMgOiA0fX1cbiAgICAjXG4gICAgIyBAZXhhbXBsZSBDb21tb24gUGl0ZmFsbHNcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgIyAgICMgU2V0dGluZyBhIG5ldyBwcm9wZXJ0eVxuICAgICMgICB3Lm5ld1Byb3BlcnR5ID0gXCJBd2Vzb21lXCJcbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgdy5uZXdQcm9wZXJ0eSBpcyB1bmRlZmluZWRcbiAgICAjICAgIyBvdmVyd3JpdGUgdGhlIHcgb2JqZWN0XG4gICAgIyAgIHcgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlISwgYnV0IC4uXG4gICAgIyAgIGNvbnNvbGUubG9nKHlhdHRhLnZhbHVlLm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIGZhbHNlLCB5b3UgYXJlIG9ubHkgYWxsb3dlZCB0byBzZXQgcHJvcGVydGllcyFcbiAgICAjICAgIyBUaGUgc29sdXRpb25cbiAgICAjICAgeWF0dGEudmFsdWUgPSB7bmV3UHJvcGVydHkgOiBcIkF3ZXNvbWVcIn1cbiAgICAjICAgY29uc29sZS5sb2cody5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyB0cnVlIVxuICAgICNcbiAgICBjbGFzcyBKc29uV3JhcHBlclxuXG4gICAgICAjXG4gICAgICAjIEBwYXJhbSB7SnNvblR5cGV9IGpzb25UeXBlIEluc3RhbmNlIG9mIHRoZSBKc29uVHlwZSB0aGF0IHRoaXMgY2xhc3Mgd3JhcHBlcy5cbiAgICAgICNcbiAgICAgIGNvbnN0cnVjdG9yOiAoanNvblR5cGUpLT5cbiAgICAgICAgZm9yIG5hbWUsIG9iaiBvZiBqc29uVHlwZS5tYXBcbiAgICAgICAgICBkbyAobmFtZSwgb2JqKS0+XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvbldyYXBwZXIucHJvdG90eXBlLCBuYW1lLFxuICAgICAgICAgICAgICBnZXQgOiAtPlxuICAgICAgICAgICAgICAgIHggPSBvYmoudmFsKClcbiAgICAgICAgICAgICAgICBpZiB4IGluc3RhbmNlb2YgSnNvblR5cGVcbiAgICAgICAgICAgICAgICAgIGNyZWF0ZUpzb25XcmFwcGVyIHhcbiAgICAgICAgICAgICAgICBlbHNlIGlmIHggaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICAgICAgICAgIHgudmFsKClcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICB4XG4gICAgICAgICAgICAgIHNldCA6IChvKS0+XG4gICAgICAgICAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlID0ganNvblR5cGUudmFsKG5hbWUpXG4gICAgICAgICAgICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlLnZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBqc29uVHlwZS52YWwobmFtZSwgbywgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiBmYWxzZVxuICAgIG5ldyBKc29uV3JhcHBlciBfanNvblR5cGVcblxuICAjXG4gICMgTWFuYWdlcyBPYmplY3QtbGlrZSB2YWx1ZXMuXG4gICNcbiAgY2xhc3MgSnNvblR5cGUgZXh0ZW5kcyB0eXBlcy5NYXBNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gaW5pdGlhbF92YWx1ZSBDcmVhdGUgdGhpcyBvcGVyYXRpb24gd2l0aCBhbiBpbml0aWFsIHZhbHVlLlxuICAgICMgQHBhcmFtIHtTdHJpbmd8Qm9vbGVhbn0gV2hldGhlciB0aGUgaW5pdGlhbF92YWx1ZSBzaG91bGQgYmUgY3JlYXRlZCBhcyBtdXRhYmxlLiAoT3B0aW9uYWwgLSBzZWUgc2V0TXV0YWJsZURlZmF1bHQpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBpbml0aWFsX3ZhbHVlLCBtdXRhYmxlKS0+XG4gICAgICBzdXBlciB1aWRcbiAgICAgIGlmIGluaXRpYWxfdmFsdWU/XG4gICAgICAgIGlmIHR5cGVvZiBpbml0aWFsX3ZhbHVlIGlzbnQgXCJvYmplY3RcIlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoZSBpbml0aWFsIHZhbHVlIG9mIEpzb25UeXBlcyBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0ISAoY3VycmVudCB0eXBlOiAje3R5cGVvZiBpbml0aWFsX3ZhbHVlfSlcIlxuICAgICAgICBmb3IgbmFtZSxvIG9mIGluaXRpYWxfdmFsdWVcbiAgICAgICAgICBAdmFsIG5hbWUsIG8sIG11dGFibGVcblxuICAgICNcbiAgICAjIFdoZXRoZXIgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnICh0cnVlKSBvciAnaW1tdXRhYmxlJyAoZmFsc2UpXG4gICAgI1xuICAgIG11dGFibGVfZGVmYXVsdDpcbiAgICAgIHRydWVcblxuICAgICNcbiAgICAjIFNldCBpZiB0aGUgZGVmYXVsdCBpcyAnbXV0YWJsZScgb3IgJ2ltbXV0YWJsZSdcbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IG11dGFibGUgU2V0IGVpdGhlciAnbXV0YWJsZScgLyB0cnVlIG9yICdpbW11dGFibGUnIC8gZmFsc2VcbiAgICBzZXRNdXRhYmxlRGVmYXVsdDogKG11dGFibGUpLT5cbiAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICBKc29uVHlwZS5wcm90b3R5cGUubXV0YWJsZV9kZWZhdWx0ID0gdHJ1ZVxuICAgICAgZWxzZSBpZiBtdXRhYmxlIGlzIGZhbHNlIG9yIG11dGFibGUgaXMgJ2ltbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciAnU2V0IG11dGFibGUgZWl0aGVyIFwibXV0YWJsZVwiIG9yIFwiaW1tdXRhYmxlXCIhJ1xuICAgICAgJ09LJ1xuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbCgpXG4gICAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICAgIyAgIEByZXR1cm4gW0pzb25dXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAgICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZXxXb3JkfFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtKc29uVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCwgbXV0YWJsZSktPlxuICAgICAgaWYgdHlwZW9mIG5hbWUgaXMgJ29iamVjdCdcbiAgICAgICAgIyBTcGVjaWFsIGNhc2UuIEZpcnN0IGFyZ3VtZW50IGlzIGFuIG9iamVjdC4gVGhlbiB0aGUgc2Vjb25kIGFyZyBpcyBtdXRhYmxlLlxuICAgICAgICAjIEtlZXAgdGhhdCBpbiBtaW5kIHdoZW4gcmVhZGluZyB0aGUgZm9sbG93aW5nLi5cbiAgICAgICAgZm9yIG9fbmFtZSxvIG9mIG5hbWVcbiAgICAgICAgICBAdmFsKG9fbmFtZSxvLGNvbnRlbnQpXG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT8gYW5kIGNvbnRlbnQ/XG4gICAgICAgIGlmIG11dGFibGU/XG4gICAgICAgICAgaWYgbXV0YWJsZSBpcyB0cnVlIG9yIG11dGFibGUgaXMgJ211dGFibGUnXG4gICAgICAgICAgICBtdXRhYmxlID0gdHJ1ZVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIG11dGFibGUgPSBmYWxzZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgbXV0YWJsZSA9IEBtdXRhYmxlX2RlZmF1bHRcbiAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ2Z1bmN0aW9uJ1xuICAgICAgICAgIEAgIyBKdXN0IGRvIG5vdGhpbmdcbiAgICAgICAgZWxzZSBpZiAoKG5vdCBtdXRhYmxlKSBvciB0eXBlb2YgY29udGVudCBpcyAnbnVtYmVyJykgYW5kIGNvbnRlbnQuY29uc3RydWN0b3IgaXNudCBPYmplY3RcbiAgICAgICAgICBvYmogPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkltbXV0YWJsZU9iamVjdCB1bmRlZmluZWQsIGNvbnRlbnQpLmV4ZWN1dGUoKVxuICAgICAgICAgIHN1cGVyIG5hbWUsIG9ialxuICAgICAgICBlbHNlXG4gICAgICAgICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgJ3N0cmluZydcbiAgICAgICAgICAgIHdvcmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLldvcmQgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCBjb250ZW50XG4gICAgICAgICAgICBzdXBlciBuYW1lLCB3b3JkXG4gICAgICAgICAgZWxzZSBpZiBjb250ZW50LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgICAganNvbiA9IEhCLmFkZE9wZXJhdGlvbihuZXcgSnNvblR5cGUgdW5kZWZpbmVkLCBjb250ZW50LCBtdXRhYmxlKS5leGVjdXRlKClcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIGpzb25cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgc2V0ICN7dHlwZW9mIGNvbnRlbnR9LXR5cGVzIGluIGNvbGxhYm9yYXRpdmUgSnNvbi1vYmplY3RzIVwiXG4gICAgICBlbHNlXG4gICAgICAgIHN1cGVyIG5hbWUsIGNvbnRlbnRcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBKc29uVHlwZS5wcm90b3R5cGUsICd2YWx1ZScsXG4gICAgICBnZXQgOiAtPiBjcmVhdGVKc29uV3JhcHBlciBAXG4gICAgICBzZXQgOiAobyktPlxuICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yXG4gICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICBAdmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgb25seSBzZXQgT2JqZWN0IHZhbHVlcyFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkpzb25UeXBlXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0pzb25UeXBlJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgSnNvblR5cGUgdWlkXG5cblxuXG5cbiAgdHlwZXNbJ0pzb25UeXBlJ10gPSBKc29uVHlwZVxuXG4gIHRleHRfdHlwZXNcblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IGJhc2ljX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBNYXBNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uVHlwZXMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGNvbnRlbnQ/XG4gICAgICAgIGlmIG5vdCBAbWFwW25hbWVdP1xuICAgICAgICAgIEhCLmFkZE9wZXJhdGlvbihuZXcgQWRkTmFtZSB1bmRlZmluZWQsIEAsIG5hbWUpLmV4ZWN1dGUoKVxuICAgICAgICBAbWFwW25hbWVdLnJlcGxhY2UgY29udGVudFxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIG9iaiA9IEBtYXBbbmFtZV0/LnZhbCgpXG4gICAgICAgIGlmIG9iaiBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgIG9iai52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgb2JqXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQG1hcFxuICAgICAgICAgIG9iaiA9IG8udmFsKClcbiAgICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3Qgb3Igb2JqIGluc3RhbmNlb2YgTWFwTWFuYWdlclxuICAgICAgICAgICAgb2JqID0gb2JqLnZhbCgpXG4gICAgICAgICAgcmVzdWx0W25hbWVdID0gb2JqXG4gICAgICAgIHJlc3VsdFxuXG4gICNcbiAgIyBXaGVuIGEgbmV3IHByb3BlcnR5IGluIGEgbWFwIG1hbmFnZXIgaXMgY3JlYXRlZCwgdGhlbiB0aGUgdWlkcyBvZiB0aGUgaW5zZXJ0ZWQgT3BlcmF0aW9uc1xuICAjIG11c3QgYmUgdW5pcXVlICh0aGluayBhYm91dCBjb25jdXJyZW50IG9wZXJhdGlvbnMpLiBUaGVyZWZvcmUgb25seSBhbiBBZGROYW1lIG9wZXJhdGlvbiBpcyBhbGxvd2VkIHRvXG4gICMgYWRkIGEgcHJvcGVydHkgaW4gYSBNYXBNYW5hZ2VyLiBJZiB0d28gQWRkTmFtZSBvcGVyYXRpb25zIG9uIHRoZSBzYW1lIE1hcE1hbmFnZXIgbmFtZSBoYXBwZW4gY29uY3VycmVudGx5XG4gICMgb25seSBvbmUgd2lsbCBBZGROYW1lIG9wZXJhdGlvbiB3aWxsIGJlIGV4ZWN1dGVkLlxuICAjXG4gIGNsYXNzIEFkZE5hbWUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBtYXBfbWFuYWdlciBVaWQgb3IgcmVmZXJlbmNlIHRvIHRoZSBNYXBNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCB3aWxsIGJlIGFkZGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgbWFwX21hbmFnZXIsIEBuYW1lKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbWFwX21hbmFnZXInLCBtYXBfbWFuYWdlclxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBJZiBtYXBfbWFuYWdlciBkb2Vzbid0IGhhdmUgdGhlIHByb3BlcnR5IG5hbWUsIHRoZW4gYWRkIGl0LlxuICAgICMgVGhlIFJlcGxhY2VNYW5hZ2VyIHRoYXQgaXMgYmVpbmcgd3JpdHRlbiBvbiB0aGUgcHJvcGVydHkgaXMgdW5pcXVlXG4gICAgIyBpbiBzdWNoIGEgd2F5IHRoYXQgaWYgQWRkTmFtZSBpcyBleGVjdXRlZCAoZnJvbSBhbm90aGVyIHBlZXIpIGl0IHdpbGxcbiAgICAjIGFsd2F5cyBoYXZlIHRoZSBzYW1lIHJlc3VsdCAoUmVwbGFjZU1hbmFnZXIsIGFuZCBpdHMgYmVnaW5uaW5nIGFuZCBlbmQgYXJlIHRoZSBzYW1lKVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIHVpZF9yID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgIHVpZF9yLm9wX251bWJlciA9IFwiXyN7dWlkX3Iub3BfbnVtYmVyfV9STV8je0BuYW1lfVwiXG4gICAgICAgIGlmIG5vdCBIQi5nZXRPcGVyYXRpb24odWlkX3IpP1xuICAgICAgICAgIHVpZF9iZWcgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfYmVnLm9wX251bWJlciA9IFwiXyN7dWlkX2JlZy5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2JlZ2lubmluZ1wiXG4gICAgICAgICAgdWlkX2VuZCA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICAgIHVpZF9lbmQub3BfbnVtYmVyID0gXCJfI3t1aWRfZW5kLm9wX251bWJlcn1fUk1fI3tAbmFtZX1fZW5kXCJcbiAgICAgICAgICBiZWcgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfYmVnLCB1bmRlZmluZWQsIHVpZF9lbmQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGVuZCA9IEhCLmFkZE9wZXJhdGlvbihuZXcgdHlwZXMuRGVsaW1pdGVyIHVpZF9lbmQsIGJlZywgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgICAjYmVnLmV4ZWN1dGUoKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBSZXBsYWNlTWFuYWdlciB1bmRlZmluZWQsIHVpZF9yLCBiZWcsIGVuZCkuZXhlY3V0ZSgpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IFwiQWRkTmFtZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdtYXBfbWFuYWdlcicgOiBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgJ25hbWUnIDogQG5hbWVcbiAgICAgIH1cblxuICBwYXJzZXJbJ0FkZE5hbWUnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ21hcF9tYW5hZ2VyJyA6IG1hcF9tYW5hZ2VyXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ25hbWUnIDogbmFtZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IEFkZE5hbWUgdWlkLCBtYXBfbWFuYWdlciwgbmFtZVxuXG4gICNcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIExpc3RNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIGJlZ2lubmluZz8gYW5kIGVuZD9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2JlZ2lubmluZycsIGJlZ2lubmluZ1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnZW5kJywgZW5kXG4gICAgICBlbHNlXG4gICAgICAgIEBiZWdpbm5pbmcgPSBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICAgIEBlbmQgPSAgICAgICBIQi5hZGRPcGVyYXRpb24gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGJlZ2lubmluZy5zZXRQYXJlbnQgQFxuICAgICAgICBAZW5kLnNldFBhcmVudCBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAZW5kLnByZXZfY2xcblxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXG5cbiAgICAjIFRyYW5zZm9ybXMgdGhlIHRoZSBsaXN0IHRvIGFuIGFycmF5XG4gICAgIyBEb2Vzbid0IHJldHVybiBsZWZ0LXJpZ2h0IGRlbGltaXRlci5cbiAgICB0b0FycmF5OiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgcmVzdWx0LnB1c2ggb1xuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIGlmIHBvc2l0aW9uID4gMFxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICAgICAgaWYgcG9zaXRpb24gaXMgMFxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyBcInBvc2l0aW9uIHBhcmFtZXRlciBleGNlZWRlZCB0aGUgbGVuZ3RoIG9mIHRoZSBkb2N1bWVudCFcIlxuICAgICAgICAgICAgbyA9IG51bGxcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgV29yZC10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBXb3JkXG4gICNcbiAgY2xhc3MgUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyBMaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChpbml0aWFsX2NvbnRlbnQsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgICBpZiBpbml0aWFsX2NvbnRlbnQ/XG4gICAgICAgIEByZXBsYWNlIGluaXRpYWxfY29udGVudFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50KS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgb3AgPSBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgdW5kZWZpbmVkLCBvLCBvLm5leHRfY2xcbiAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFxuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImR0cm5cIlxuICAgICAgby52YWwoKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiUmVwbGFjZU1hbmFnZXJcIlxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZU1hbmFnZXJcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdiZWdpbm5pbmcnIDogYmVnaW5uaW5nXG4gICAgICAnZW5kJyA6IGVuZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VNYW5hZ2VyIGNvbnRlbnQsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG5cbiAgI1xuICAjIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlcy5cbiAgIyBAc2VlIFJlcGxhY2VNYW5hZ2VyXG4gICNcbiAgY2xhc3MgUmVwbGFjZWFibGUgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBjb250ZW50IFRoZSB2YWx1ZSB0aGF0IHRoaXMgUmVwbGFjZWFibGUgaG9sZHMuXG4gICAgIyBAcGFyYW0ge1JlcGxhY2VNYW5hZ2VyfSBwYXJlbnQgVXNlZCB0byByZXBsYWNlIHRoaXMgUmVwbGFjZWFibGUgd2l0aCBhbm90aGVyIG9uZS5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/IGFuZCBjb250ZW50PylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZGVmaW5lIGNvbnRlbnQsIHByZXYsIGFuZCBuZXh0IGZvciBSZXBsYWNlYWJsZS10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIFJldHVybiB0aGUgY29udGVudCB0aGF0IHRoaXMgb3BlcmF0aW9uIGhvbGRzLlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgcmVwbGFjZWFibGUgd2l0aCBuZXcgY29udGVudC5cbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQpLT5cbiAgICAgIEBwYXJlbnQucmVwbGFjZSBjb250ZW50XG5cbiAgICAjXG4gICAgIyBJZiBwb3NzaWJsZSBzZXQgdGhlIHJlcGxhY2UgbWFuYWdlciBpbiB0aGUgY29udGVudC5cbiAgICAjIEBzZWUgV29yZC5zZXRSZXBsYWNlTWFuYWdlclxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50LnNldFJlcGxhY2VNYW5hZ2VyPyhAcGFyZW50KVxuICAgICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiUmVwbGFjZWFibGVcIlxuICAgICAgICAgICdjb250ZW50JzogQGNvbnRlbnQuZ2V0VWlkKClcbiAgICAgICAgICAnUmVwbGFjZU1hbmFnZXInIDogQHBhcmVudC5nZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlJlcGxhY2VhYmxlXCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAnUmVwbGFjZU1hbmFnZXInIDogcGFyZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG5cblxuICB0eXBlc1snTGlzdE1hbmFnZXInXSA9IExpc3RNYW5hZ2VyXG4gIHR5cGVzWydNYXBNYW5hZ2VyJ10gPSBNYXBNYW5hZ2VyXG4gIHR5cGVzWydSZXBsYWNlTWFuYWdlciddID0gUmVwbGFjZU1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VhYmxlJ10gPSBSZXBsYWNlYWJsZVxuXG4gIGJhc2ljX3R5cGVzXG5cblxuXG5cblxuXG4iLCJzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9TdHJ1Y3R1cmVkVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBzdHJ1Y3R1cmVkX3R5cGVzID0gc3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gc3RydWN0dXJlZF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSBzdHJ1Y3R1cmVkX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBBdCB0aGUgbW9tZW50IFRleHREZWxldGUgdHlwZSBlcXVhbHMgdGhlIERlbGV0ZSB0eXBlIGluIEJhc2ljVHlwZXMuXG4gICMgQHNlZSBCYXNpY1R5cGVzLkRlbGV0ZVxuICAjXG4gIGNsYXNzIFRleHREZWxldGUgZXh0ZW5kcyB0eXBlcy5EZWxldGVcbiAgcGFyc2VyW1wiVGV4dERlbGV0ZVwiXSA9IHBhcnNlcltcIkRlbGV0ZVwiXVxuXG4gICNcbiAgIyAgRXh0ZW5kcyB0aGUgYmFzaWMgSW5zZXJ0IHR5cGUgdG8gYW4gb3BlcmF0aW9uIHRoYXQgaG9sZHMgYSB0ZXh0IHZhbHVlXG4gICNcbiAgY2xhc3MgVGV4dEluc2VydCBleHRlbmRzIHR5cGVzLkluc2VydFxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50IFRoZSBjb250ZW50IG9mIHRoaXMgSW5zZXJ0LXR5cGUgT3BlcmF0aW9uLiBVc3VhbGx5IHlvdSByZXN0cmljdCB0aGUgbGVuZ3RoIG9mIGNvbnRlbnQgdG8gc2l6ZSAxXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoQGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBpZiBub3QgKHByZXY/IGFuZCBuZXh0PylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZGVmaW5lIHByZXYsIGFuZCBuZXh0IGZvciBUZXh0SW5zZXJ0LXR5cGVzIVwiXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuICAgICNcbiAgICAjIFJldHJpZXZlIHRoZSBlZmZlY3RpdmUgbGVuZ3RoIG9mIHRoZSAkY29udGVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0TGVuZ3RoOiAoKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKClcbiAgICAgICAgMFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudC5sZW5ndGhcblxuICAgICNcbiAgICAjIFRoZSByZXN1bHQgd2lsbCBiZSBjb25jYXRlbmF0ZWQgd2l0aCB0aGUgcmVzdWx0cyBmcm9tIHRoZSBvdGhlciBpbnNlcnQgb3BlcmF0aW9uc1xuICAgICMgaW4gb3JkZXIgdG8gcmV0cmlldmUgdGhlIGNvbnRlbnQgb2YgdGhlIGVuZ2luZS5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci50b0V4ZWN1dGVkQXJyYXlcbiAgICAjXG4gICAgdmFsOiAoY3VycmVudF9wb3NpdGlvbiktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIFwiXCJcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW5kIHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBcIlRleHRJbnNlcnRcIlxuICAgICAgICAgICdjb250ZW50JzogQGNvbnRlbnRcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJUZXh0SW5zZXJ0XCJdID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgfSA9IGpzb25cbiAgICBuZXcgVGV4dEluc2VydCBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBIYW5kbGVzIGEgVGV4dC1saWtlIGRhdGEgc3RydWN0dXJlcyB3aXRoIHN1cHBvcnQgZm9yIGluc2VydFRleHQvZGVsZXRlVGV4dCBhdCBhIHdvcmQtcG9zaXRpb24uXG4gICNcbiAgY2xhc3MgV29yZCBleHRlbmRzIHR5cGVzLkxpc3RNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZFxuICAgICNcbiAgICBpbnNlcnRUZXh0OiAocG9zaXRpb24sIGNvbnRlbnQpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgZm9yIGMgaW4gY29udGVudFxuICAgICAgICBvcCA9IG5ldyBUZXh0SW5zZXJ0IGMsIHVuZGVmaW5lZCwgby5wcmV2X2NsLCBvXG4gICAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGEgcGFydCBvZiB0aGUgd29yZC5cbiAgICAjXG4gICAgZGVsZXRlVGV4dDogKHBvc2l0aW9uLCBsZW5ndGgpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4ndCBkZWxldGUgbW9yZSB0aGFuIHRoZXJlIGlzLi5cIlxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgd29yZCB3aXRoIGFub3RoZXIgb25lLiBDb25jdXJyZW50IHJlcGxhY2VtZW50cyBhcmUgbm90IG1lcmdlZCFcbiAgICAjIE9ubHkgb25lIG9mIHRoZSByZXBsYWNlbWVudHMgd2lsbCBiZSB1c2VkLlxuICAgICNcbiAgICAjIENhbiBvbmx5IGJlIHVzZWQgaWYgdGhlIFJlcGxhY2VNYW5hZ2VyIHdhcyBzZXQhXG4gICAgIyBAc2VlIFdvcmQuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAjXG4gICAgcmVwbGFjZVRleHQ6ICh0ZXh0KS0+XG4gICAgICBpZiBAcmVwbGFjZV9tYW5hZ2VyP1xuICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBXb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCB0ZXh0XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXIucmVwbGFjZSh3b3JkKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgaXMgY3VycmVudGx5IG5vdCBtYWludGFpbmVkIGJ5IGEgUmVwbGFjZU1hbmFnZXIhXCJcblxuICAgICNcbiAgICAjIEByZXR1cm5zIFtKc29uXSBBIEpzb24gb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIEluIG1vc3QgY2FzZXMgeW91IHdvdWxkIGVtYmVkIGEgV29yZCBpbiBhIFJlcGxhY2VhYmxlLCB3aWNoIGlzIGhhbmRsZWQgYnkgdGhlIFJlcGxhY2VNYW5hZ2VyIGluIG9yZGVyXG4gICAgIyB0byBwcm92aWRlIHJlcGxhY2UgZnVuY3Rpb25hbGl0eS5cbiAgICAjXG4gICAgc2V0UmVwbGFjZU1hbmFnZXI6IChvcCktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3JlcGxhY2VfbWFuYWdlcicsIG9wXG4gICAgICBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnNcblxuICAgICNcbiAgICAjIEJpbmQgdGhpcyBXb3JkIHRvIGEgdGV4dGZpZWxkLlxuICAgICMgVE9ETzpcbiAgICAjICAgaW5zZXJ0X3ByZXNzaW5nK21vdXNlIG5ldyBwb3NpdGlvblxuICAgICMgICBjb25jdXJyZW50IHByZXNzaW5nICh0d28gdXNlciBwcmVzc2luZyBzdHVmZilcbiAgICBiaW5kOiAodGV4dGZpZWxkKS0+XG4gICAgICB3b3JkID0gQFxuICAgICAgdGV4dGZpZWxkLnZhbHVlID0gQHZhbCgpXG4gICAgICBwb3NpdGlvbl9zdGFydCA9IG51bGxcbiAgICAgIGRvY3VtZW50X2xlbmd0aCA9IG51bGxcblxuICAgICAgQG9uIFwiaW5zZXJ0XCIsIChldmVudCwgb3ApLT5cbiAgICAgICAgaWYgb3AuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICAgICAgb19wb3MgPSBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgICAgaWYgY3Vyc29yIDw9IG9fcG9zXG4gICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICBjdXJzb3IgKz0gMVxuICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBpZiBwb3NpdGlvbl9zdGFydD9cbiAgICAgICAgICAgIGRvY3VtZW50X2xlbmd0aCArPSAxXG4gICAgICAgICAgICBwb3NpdGlvbl9zdGFydCA9IGZpeCBwb3NpdGlvbl9zdGFydFxuXG4gICAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG5cbiAgICAgIEBvbiBcImRlbGV0ZVwiLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIGlmIG9wLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgICAgIG9fcG9zID0gb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgY3Vyc29yIC09IDFcbiAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgICAgaWYgcG9zaXRpb25fc3RhcnQ/XG4gICAgICAgICAgICBkb2N1bWVudF9sZW5ndGggLT0gMVxuICAgICAgICAgICAgcG9zaXRpb25fc3RhcnQgPSBmaXggcG9zaXRpb25fc3RhcnRcblxuICAgICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuXG4gICAgICB1cGRhdGVfeWF0dGEgPSAoKS0+XG4gICAgICAgIGlmIHBvc2l0aW9uX3N0YXJ0P1xuICAgICAgICAgIGRvY3VtZW50X2xlbmd0aF9kaWZmID0gdGV4dGZpZWxkLnZhbHVlLmxlbmd0aCAtIGRvY3VtZW50X2xlbmd0aFxuICAgICAgICAgIGN1cnJlbnRfcG9zaXRpb24gPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBpZiBkb2N1bWVudF9sZW5ndGhfZGlmZiA8IDAgIyBkZWxldGlvblxuICAgICAgICAgICAgZGVsZXRpb25fcG9zaXRpb24gPSBNYXRoLm1pbiBjdXJyZW50X3Bvc2l0aW9uLCBwb3NpdGlvbl9zdGFydFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IGRlbGV0aW9uX3Bvc2l0aW9uLCBNYXRoLmFicyBkb2N1bWVudF9sZW5ndGhfZGlmZlxuICAgICAgICAgIGVsc2UgaWYgZG9jdW1lbnRfbGVuZ3RoX2RpZmYgPiAwICMgaW5zZXJ0aW9uXG4gICAgICAgICAgICB0ZXh0X2luc2VydCA9IHRleHRmaWVsZC52YWx1ZS5zdWJzdHJpbmcgcG9zaXRpb25fc3RhcnQsIChwb3NpdGlvbl9zdGFydCArIGRvY3VtZW50X2xlbmd0aF9kaWZmKVxuICAgICAgICAgICAgd29yZC5pbnNlcnRUZXh0IHBvc2l0aW9uX3N0YXJ0LCB0ZXh0X2luc2VydFxuXG4gICAgICAgICAgcG9zaXRpb25fc3RhcnQgPSBudWxsXG4gICAgICAgICAgZG9jdW1lbnRfbGVuZ3RoID0gbnVsbFxuXG4gICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gKGV2ZW50KS0+XG4gICAgICAgICNjb25zb2xlLmxvZyBcImRvd25cIlxuICAgICAgICBpZiBwb3NpdGlvbl9zdGFydD9cbiAgICAgICAgICB1cGRhdGVfeWF0dGEoKVxuXG4gICAgICAgIHNlbGVjdGlvbl9yYW5nZSA9IE1hdGguYWJzKHRleHRmaWVsZC5zZWxlY3Rpb25FbmQgLSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQpXG4gICAgICAgIHBvc2l0aW9uX3N0YXJ0ID0gTWF0aC5taW4odGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kKVxuICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zaXRpb25fc3RhcnQsIHNlbGVjdGlvbl9yYW5nZVxuICAgICAgICBkb2N1bWVudF9sZW5ndGggPSB0ZXh0ZmllbGQudmFsdWUubGVuZ3RoIC0gc2VsZWN0aW9uX3JhbmdlXG5cbiAgICAgIHRleHRmaWVsZC5vbmtleXVwID0gKGV2ZW50KS0+XG4gICAgICAgICNjb25zb2xlLmxvZyBcInVwXCJcbiAgICAgICAgdXBkYXRlX3lhdHRhKClcbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiV29yZFwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyWydXb3JkJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmQgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgdHlwZXNbJ1RleHRJbnNlcnQnXSA9IFRleHRJbnNlcnRcbiAgdHlwZXNbJ1RleHREZWxldGUnXSA9IFRleHREZWxldGVcbiAgdHlwZXNbJ1dvcmQnXSA9IFdvcmRcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuZXhwb3J0c1snSXdjQ29ubmVjdG9yJ10gPVxuICByZXF1aXJlICcuL0Nvbm5lY3RvcnMvSXdjQ29ubmVjdG9yJ1xuZXhwb3J0c1snVGVzdENvbm5lY3RvciddID1cbiAgcmVxdWlyZSAnLi9Db25uZWN0b3JzL1Rlc3RDb25uZWN0b3InXG5leHBvcnRzWydKc29uWWF0dGEnXSA9XG4gIHJlcXVpcmUgJy4vRnJhbWV3b3Jrcy9Kc29uWWF0dGEnXG5leHBvcnRzWydUZXh0WWF0dGEnXSA9XG4gIHJlcXVpcmUgJy4vRnJhbWV3b3Jrcy9UZXh0WWF0dGEnXG5cbiIsIi8vICAgICBVbmRlcnNjb3JlLmpzIDEuNi4wXG4vLyAgICAgaHR0cDovL3VuZGVyc2NvcmVqcy5vcmdcbi8vICAgICAoYykgMjAwOS0yMDE0IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4vLyAgICAgVW5kZXJzY29yZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uKCkge1xuXG4gIC8vIEJhc2VsaW5lIHNldHVwXG4gIC8vIC0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gRXN0YWJsaXNoIHRoZSByb290IG9iamVjdCwgYHdpbmRvd2AgaW4gdGhlIGJyb3dzZXIsIG9yIGBleHBvcnRzYCBvbiB0aGUgc2VydmVyLlxuICB2YXIgcm9vdCA9IHRoaXM7XG5cbiAgLy8gU2F2ZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIGBfYCB2YXJpYWJsZS5cbiAgdmFyIHByZXZpb3VzVW5kZXJzY29yZSA9IHJvb3QuXztcblxuICAvLyBFc3RhYmxpc2ggdGhlIG9iamVjdCB0aGF0IGdldHMgcmV0dXJuZWQgdG8gYnJlYWsgb3V0IG9mIGEgbG9vcCBpdGVyYXRpb24uXG4gIHZhciBicmVha2VyID0ge307XG5cbiAgLy8gU2F2ZSBieXRlcyBpbiB0aGUgbWluaWZpZWQgKGJ1dCBub3QgZ3ppcHBlZCkgdmVyc2lvbjpcbiAgdmFyIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsIE9ialByb3RvID0gT2JqZWN0LnByb3RvdHlwZSwgRnVuY1Byb3RvID0gRnVuY3Rpb24ucHJvdG90eXBlO1xuXG4gIC8vIENyZWF0ZSBxdWljayByZWZlcmVuY2UgdmFyaWFibGVzIGZvciBzcGVlZCBhY2Nlc3MgdG8gY29yZSBwcm90b3R5cGVzLlxuICB2YXJcbiAgICBwdXNoICAgICAgICAgICAgID0gQXJyYXlQcm90by5wdXNoLFxuICAgIHNsaWNlICAgICAgICAgICAgPSBBcnJheVByb3RvLnNsaWNlLFxuICAgIGNvbmNhdCAgICAgICAgICAgPSBBcnJheVByb3RvLmNvbmNhdCxcbiAgICB0b1N0cmluZyAgICAgICAgID0gT2JqUHJvdG8udG9TdHJpbmcsXG4gICAgaGFzT3duUHJvcGVydHkgICA9IE9ialByb3RvLmhhc093blByb3BlcnR5O1xuXG4gIC8vIEFsbCAqKkVDTUFTY3JpcHQgNSoqIG5hdGl2ZSBmdW5jdGlvbiBpbXBsZW1lbnRhdGlvbnMgdGhhdCB3ZSBob3BlIHRvIHVzZVxuICAvLyBhcmUgZGVjbGFyZWQgaGVyZS5cbiAgdmFyXG4gICAgbmF0aXZlRm9yRWFjaCAgICAgID0gQXJyYXlQcm90by5mb3JFYWNoLFxuICAgIG5hdGl2ZU1hcCAgICAgICAgICA9IEFycmF5UHJvdG8ubWFwLFxuICAgIG5hdGl2ZVJlZHVjZSAgICAgICA9IEFycmF5UHJvdG8ucmVkdWNlLFxuICAgIG5hdGl2ZVJlZHVjZVJpZ2h0ICA9IEFycmF5UHJvdG8ucmVkdWNlUmlnaHQsXG4gICAgbmF0aXZlRmlsdGVyICAgICAgID0gQXJyYXlQcm90by5maWx0ZXIsXG4gICAgbmF0aXZlRXZlcnkgICAgICAgID0gQXJyYXlQcm90by5ldmVyeSxcbiAgICBuYXRpdmVTb21lICAgICAgICAgPSBBcnJheVByb3RvLnNvbWUsXG4gICAgbmF0aXZlSW5kZXhPZiAgICAgID0gQXJyYXlQcm90by5pbmRleE9mLFxuICAgIG5hdGl2ZUxhc3RJbmRleE9mICA9IEFycmF5UHJvdG8ubGFzdEluZGV4T2YsXG4gICAgbmF0aXZlSXNBcnJheSAgICAgID0gQXJyYXkuaXNBcnJheSxcbiAgICBuYXRpdmVLZXlzICAgICAgICAgPSBPYmplY3Qua2V5cyxcbiAgICBuYXRpdmVCaW5kICAgICAgICAgPSBGdW5jUHJvdG8uYmluZDtcblxuICAvLyBDcmVhdGUgYSBzYWZlIHJlZmVyZW5jZSB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QgZm9yIHVzZSBiZWxvdy5cbiAgdmFyIF8gPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgXykgcmV0dXJuIG9iajtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgXykpIHJldHVybiBuZXcgXyhvYmopO1xuICAgIHRoaXMuX3dyYXBwZWQgPSBvYmo7XG4gIH07XG5cbiAgLy8gRXhwb3J0IHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbiAgLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuICAvLyB0aGUgYnJvd3NlciwgYWRkIGBfYCBhcyBhIGdsb2JhbCBvYmplY3QgdmlhIGEgc3RyaW5nIGlkZW50aWZpZXIsXG4gIC8vIGZvciBDbG9zdXJlIENvbXBpbGVyIFwiYWR2YW5jZWRcIiBtb2RlLlxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBfO1xuICAgIH1cbiAgICBleHBvcnRzLl8gPSBfO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuXyA9IF87XG4gIH1cblxuICAvLyBDdXJyZW50IHZlcnNpb24uXG4gIF8uVkVSU0lPTiA9ICcxLjYuMCc7XG5cbiAgLy8gQ29sbGVjdGlvbiBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBUaGUgY29ybmVyc3RvbmUsIGFuIGBlYWNoYCBpbXBsZW1lbnRhdGlvbiwgYWthIGBmb3JFYWNoYC5cbiAgLy8gSGFuZGxlcyBvYmplY3RzIHdpdGggdGhlIGJ1aWx0LWluIGBmb3JFYWNoYCwgYXJyYXlzLCBhbmQgcmF3IG9iamVjdHMuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBmb3JFYWNoYCBpZiBhdmFpbGFibGUuXG4gIHZhciBlYWNoID0gXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYG1hcGAgaWYgYXZhaWxhYmxlLlxuICBfLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZU1hcCAmJiBvYmoubWFwID09PSBuYXRpdmVNYXApIHJldHVybiBvYmoubWFwKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICB2YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbiAgLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuICAvLyBvciBgZm9sZGxgLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlYCBpZiBhdmFpbGFibGUuXG4gIF8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZShpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgIG1lbW8gPSB2YWx1ZTtcbiAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghaW5pdGlhbCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgcmV0dXJuIG1lbW87XG4gIH07XG5cbiAgLy8gVGhlIHJpZ2h0LWFzc29jaWF0aXZlIHZlcnNpb24gb2YgcmVkdWNlLCBhbHNvIGtub3duIGFzIGBmb2xkcmAuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGByZWR1Y2VSaWdodGAgaWYgYXZhaWxhYmxlLlxuICBfLnJlZHVjZVJpZ2h0ID0gXy5mb2xkciA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaWYgKG5hdGl2ZVJlZHVjZVJpZ2h0ICYmIG9iai5yZWR1Y2VSaWdodCA9PT0gbmF0aXZlUmVkdWNlUmlnaHQpIHtcbiAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2VSaWdodChpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlUmlnaHQoaXRlcmF0b3IpO1xuICAgIH1cbiAgICB2YXIgbGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoICE9PSArbGVuZ3RoKSB7XG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgfVxuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGluZGV4ID0ga2V5cyA/IGtleXNbLS1sZW5ndGhdIDogLS1sZW5ndGg7XG4gICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgbWVtbyA9IG9ialtpbmRleF07XG4gICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWVtbyA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgbWVtbywgb2JqW2luZGV4XSwgaW5kZXgsIGxpc3QpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghaW5pdGlhbCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgcmV0dXJuIG1lbW87XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBmaXJzdCB2YWx1ZSB3aGljaCBwYXNzZXMgYSB0cnV0aCB0ZXN0LiBBbGlhc2VkIGFzIGBkZXRlY3RgLlxuICBfLmZpbmQgPSBfLmRldGVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBhbnkob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgcGFzcyBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBmaWx0ZXJgIGlmIGF2YWlsYWJsZS5cbiAgLy8gQWxpYXNlZCBhcyBgc2VsZWN0YC5cbiAgXy5maWx0ZXIgPSBfLnNlbGVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgIGlmIChuYXRpdmVGaWx0ZXIgJiYgb2JqLmZpbHRlciA9PT0gbmF0aXZlRmlsdGVyKSByZXR1cm4gb2JqLmZpbHRlcihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSByZXN1bHRzLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIF8ucmVqZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHJldHVybiAhcHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICB9LCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgd2hldGhlciBhbGwgb2YgdGhlIGVsZW1lbnRzIG1hdGNoIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGV2ZXJ5YCBpZiBhdmFpbGFibGUuXG4gIC8vIEFsaWFzZWQgYXMgYGFsbGAuXG4gIF8uZXZlcnkgPSBfLmFsbCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcHJlZGljYXRlIHx8IChwcmVkaWNhdGUgPSBfLmlkZW50aXR5KTtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKG5hdGl2ZUV2ZXJ5ICYmIG9iai5ldmVyeSA9PT0gbmF0aXZlRXZlcnkpIHJldHVybiBvYmouZXZlcnkocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoIShyZXN1bHQgPSByZXN1bHQgJiYgcHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSkpIHJldHVybiBicmVha2VyO1xuICAgIH0pO1xuICAgIHJldHVybiAhIXJlc3VsdDtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgYXQgbGVhc3Qgb25lIGVsZW1lbnQgaW4gdGhlIG9iamVjdCBtYXRjaGVzIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHNvbWVgIGlmIGF2YWlsYWJsZS5cbiAgLy8gQWxpYXNlZCBhcyBgYW55YC5cbiAgdmFyIGFueSA9IF8uc29tZSA9IF8uYW55ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgfHwgKHByZWRpY2F0ZSA9IF8uaWRlbnRpdHkpO1xuICAgIHZhciByZXN1bHQgPSBmYWxzZTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKG5hdGl2ZVNvbWUgJiYgb2JqLnNvbWUgPT09IG5hdGl2ZVNvbWUpIHJldHVybiBvYmouc29tZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChyZXN1bHQgfHwgKHJlc3VsdCA9IHByZWRpY2F0ZS5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpKSByZXR1cm4gYnJlYWtlcjtcbiAgICB9KTtcbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiB2YWx1ZSAodXNpbmcgYD09PWApLlxuICAvLyBBbGlhc2VkIGFzIGBpbmNsdWRlYC5cbiAgXy5jb250YWlucyA9IF8uaW5jbHVkZSA9IGZ1bmN0aW9uKG9iaiwgdGFyZ2V0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG5hdGl2ZUluZGV4T2YgJiYgb2JqLmluZGV4T2YgPT09IG5hdGl2ZUluZGV4T2YpIHJldHVybiBvYmouaW5kZXhPZih0YXJnZXQpICE9IC0xO1xuICAgIHJldHVybiBhbnkob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlID09PSB0YXJnZXQ7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gSW52b2tlIGEgbWV0aG9kICh3aXRoIGFyZ3VtZW50cykgb24gZXZlcnkgaXRlbSBpbiBhIGNvbGxlY3Rpb24uXG4gIF8uaW52b2tlID0gZnVuY3Rpb24ob2JqLCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgaXNGdW5jID0gXy5pc0Z1bmN0aW9uKG1ldGhvZCk7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiAoaXNGdW5jID8gbWV0aG9kIDogdmFsdWVbbWV0aG9kXSkuYXBwbHkodmFsdWUsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gIF8ucGx1Y2sgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmlsdGVyYDogc2VsZWN0aW5nIG9ubHkgb2JqZWN0c1xuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLndoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbmRgOiBnZXR0aW5nIHRoZSBmaXJzdCBvYmplY3RcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5maW5kV2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmluZChvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IG9yIChlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgLy8gQ2FuJ3Qgb3B0aW1pemUgYXJyYXlzIG9mIGludGVnZXJzIGxvbmdlciB0aGFuIDY1LDUzNSBlbGVtZW50cy5cbiAgLy8gU2VlIFtXZWJLaXQgQnVnIDgwNzk3XShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9ODA3OTcpXG4gIF8ubWF4ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmICghaXRlcmF0b3IgJiYgXy5pc0FycmF5KG9iaikgJiYgb2JqWzBdID09PSArb2JqWzBdICYmIG9iai5sZW5ndGggPCA2NTUzNSkge1xuICAgICAgcmV0dXJuIE1hdGgubWF4LmFwcGx5KE1hdGgsIG9iaik7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSAtSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IC1JbmZpbml0eTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICB2YXIgY29tcHV0ZWQgPSBpdGVyYXRvciA/IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSA6IHZhbHVlO1xuICAgICAgaWYgKGNvbXB1dGVkID4gbGFzdENvbXB1dGVkKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5taW4gPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpdGVyYXRvciAmJiBfLmlzQXJyYXkob2JqKSAmJiBvYmpbMF0gPT09ICtvYmpbMF0gJiYgb2JqLmxlbmd0aCA8IDY1NTM1KSB7XG4gICAgICByZXR1cm4gTWF0aC5taW4uYXBwbHkoTWF0aCwgb2JqKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IEluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSBJbmZpbml0eTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICB2YXIgY29tcHV0ZWQgPSBpdGVyYXRvciA/IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSA6IHZhbHVlO1xuICAgICAgaWYgKGNvbXB1dGVkIDwgbGFzdENvbXB1dGVkKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFNodWZmbGUgYW4gYXJyYXksIHVzaW5nIHRoZSBtb2Rlcm4gdmVyc2lvbiBvZiB0aGVcbiAgLy8gW0Zpc2hlci1ZYXRlcyBzaHVmZmxlXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zpc2hlcuKAk1lhdGVzX3NodWZmbGUpLlxuICBfLnNodWZmbGUgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcmFuZDtcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHZhciBzaHVmZmxlZCA9IFtdO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmFuZCA9IF8ucmFuZG9tKGluZGV4KyspO1xuICAgICAgc2h1ZmZsZWRbaW5kZXggLSAxXSA9IHNodWZmbGVkW3JhbmRdO1xuICAgICAgc2h1ZmZsZWRbcmFuZF0gPSB2YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gc2h1ZmZsZWQ7XG4gIH07XG5cbiAgLy8gU2FtcGxlICoqbioqIHJhbmRvbSB2YWx1ZXMgZnJvbSBhIGNvbGxlY3Rpb24uXG4gIC8vIElmICoqbioqIGlzIG5vdCBzcGVjaWZpZWQsIHJldHVybnMgYSBzaW5nbGUgcmFuZG9tIGVsZW1lbnQuXG4gIC8vIFRoZSBpbnRlcm5hbCBgZ3VhcmRgIGFyZ3VtZW50IGFsbG93cyBpdCB0byB3b3JrIHdpdGggYG1hcGAuXG4gIF8uc2FtcGxlID0gZnVuY3Rpb24ob2JqLCBuLCBndWFyZCkge1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHtcbiAgICAgIGlmIChvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCkgb2JqID0gXy52YWx1ZXMob2JqKTtcbiAgICAgIHJldHVybiBvYmpbXy5yYW5kb20ob2JqLmxlbmd0aCAtIDEpXTtcbiAgICB9XG4gICAgcmV0dXJuIF8uc2h1ZmZsZShvYmopLnNsaWNlKDAsIE1hdGgubWF4KDAsIG4pKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBsb29rdXAgaXRlcmF0b3JzLlxuICB2YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgfTtcblxuICAvLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0b3IuXG4gIF8uc29ydEJ5ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KVxuICAgICAgfTtcbiAgICB9KS5zb3J0KGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgIGlmIChhIDwgYiB8fCBiID09PSB2b2lkIDApIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsZWZ0LmluZGV4IC0gcmlnaHQuaW5kZXg7XG4gICAgfSksICd2YWx1ZScpO1xuICB9O1xuXG4gIC8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHVzZWQgZm9yIGFnZ3JlZ2F0ZSBcImdyb3VwIGJ5XCIgb3BlcmF0aW9ucy5cbiAgdmFyIGdyb3VwID0gZnVuY3Rpb24oYmVoYXZpb3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgIHZhciBrZXkgPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCBrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEdyb3VwcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLiBQYXNzIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGVcbiAgLy8gdG8gZ3JvdXAgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjcml0ZXJpb24uXG4gIF8uZ3JvdXBCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5LCB2YWx1ZSkge1xuICAgIF8uaGFzKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldLnB1c2godmFsdWUpIDogcmVzdWx0W2tleV0gPSBbdmFsdWVdO1xuICB9KTtcblxuICAvLyBJbmRleGVzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24sIHNpbWlsYXIgdG8gYGdyb3VwQnlgLCBidXQgZm9yXG4gIC8vIHdoZW4geW91IGtub3cgdGhhdCB5b3VyIGluZGV4IHZhbHVlcyB3aWxsIGJlIHVuaXF1ZS5cbiAgXy5pbmRleEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCBrZXksIHZhbHVlKSB7XG4gICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgfSk7XG5cbiAgLy8gQ291bnRzIGluc3RhbmNlcyBvZiBhbiBvYmplY3QgdGhhdCBncm91cCBieSBhIGNlcnRhaW4gY3JpdGVyaW9uLiBQYXNzXG4gIC8vIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGUgdG8gY291bnQgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAvLyBjcml0ZXJpb24uXG4gIF8uY291bnRCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5KSB7XG4gICAgXy5oYXMocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0rKyA6IHJlc3VsdFtrZXldID0gMTtcbiAgfSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIF8uc29ydGVkSW5kZXggPSBmdW5jdGlvbihhcnJheSwgb2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgIHZhciB2YWx1ZSA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqKTtcbiAgICB2YXIgbG93ID0gMCwgaGlnaCA9IGFycmF5Lmxlbmd0aDtcbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgYXJyYXlbbWlkXSkgPCB2YWx1ZSA/IGxvdyA9IG1pZCArIDEgOiBoaWdoID0gbWlkO1xuICAgIH1cbiAgICByZXR1cm4gbG93O1xuICB9O1xuXG4gIC8vIFNhZmVseSBjcmVhdGUgYSByZWFsLCBsaXZlIGFycmF5IGZyb20gYW55dGhpbmcgaXRlcmFibGUuXG4gIF8udG9BcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghb2JqKSByZXR1cm4gW107XG4gICAgaWYgKF8uaXNBcnJheShvYmopKSByZXR1cm4gc2xpY2UuY2FsbChvYmopO1xuICAgIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkgcmV0dXJuIF8ubWFwKG9iaiwgXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIF8udmFsdWVzKG9iaik7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gYW4gb2JqZWN0LlxuICBfLnNpemUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpID8gb2JqLmxlbmd0aCA6IF8ua2V5cyhvYmopLmxlbmd0aDtcbiAgfTtcblxuICAvLyBBcnJheSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gR2V0IHRoZSBmaXJzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBmaXJzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIEFsaWFzZWQgYXMgYGhlYWRgIGFuZCBgdGFrZWAuIFRoZSAqKmd1YXJkKiogY2hlY2tcbiAgLy8gYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLmZpcnN0ID0gXy5oZWFkID0gXy50YWtlID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgaWYgKChuID09IG51bGwpIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbMF07XG4gICAgaWYgKG4gPCAwKSByZXR1cm4gW107XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIG4pO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGxhc3QgZW50cnkgb2YgdGhlIGFycmF5LiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiBhbGwgdGhlIHZhbHVlcyBpblxuICAvLyB0aGUgYXJyYXksIGV4Y2x1ZGluZyB0aGUgbGFzdCBOLiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGhcbiAgLy8gYF8ubWFwYC5cbiAgXy5pbml0aWFsID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIGFycmF5Lmxlbmd0aCAtICgobiA9PSBudWxsKSB8fCBndWFyZCA/IDEgOiBuKSk7XG4gIH07XG5cbiAgLy8gR2V0IHRoZSBsYXN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGxhc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5sYXN0ID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgaWYgKChuID09IG51bGwpIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIE1hdGgubWF4KGFycmF5Lmxlbmd0aCAtIG4sIDApKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBmaXJzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEFsaWFzZWQgYXMgYHRhaWxgIGFuZCBgZHJvcGAuXG4gIC8vIEVzcGVjaWFsbHkgdXNlZnVsIG9uIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nIGFuICoqbioqIHdpbGwgcmV0dXJuXG4gIC8vIHRoZSByZXN0IE4gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKlxuICAvLyBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ucmVzdCA9IF8udGFpbCA9IF8uZHJvcCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCAobiA9PSBudWxsKSB8fCBndWFyZCA/IDEgOiBuKTtcbiAgfTtcblxuICAvLyBUcmltIG91dCBhbGwgZmFsc3kgdmFsdWVzIGZyb20gYW4gYXJyYXkuXG4gIF8uY29tcGFjdCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBfLmlkZW50aXR5KTtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiBhIHJlY3Vyc2l2ZSBgZmxhdHRlbmAgZnVuY3Rpb24uXG4gIHZhciBmbGF0dGVuID0gZnVuY3Rpb24oaW5wdXQsIHNoYWxsb3csIG91dHB1dCkge1xuICAgIGlmIChzaGFsbG93ICYmIF8uZXZlcnkoaW5wdXQsIF8uaXNBcnJheSkpIHtcbiAgICAgIHJldHVybiBjb25jYXQuYXBwbHkob3V0cHV0LCBpbnB1dCk7XG4gICAgfVxuICAgIGVhY2goaW5wdXQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoXy5pc0FycmF5KHZhbHVlKSB8fCBfLmlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgICBzaGFsbG93ID8gcHVzaC5hcHBseShvdXRwdXQsIHZhbHVlKSA6IGZsYXR0ZW4odmFsdWUsIHNoYWxsb3csIG91dHB1dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfTtcblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IganVzdCBvbmUgbGV2ZWwuXG4gIF8uZmxhdHRlbiA9IGZ1bmN0aW9uKGFycmF5LCBzaGFsbG93KSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4oYXJyYXksIHNoYWxsb3csIFtdKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSB2ZXJzaW9uIG9mIHRoZSBhcnJheSB0aGF0IGRvZXMgbm90IGNvbnRhaW4gdGhlIHNwZWNpZmllZCB2YWx1ZShzKS5cbiAgXy53aXRob3V0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5kaWZmZXJlbmNlKGFycmF5LCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9O1xuXG4gIC8vIFNwbGl0IGFuIGFycmF5IGludG8gdHdvIGFycmF5czogb25lIHdob3NlIGVsZW1lbnRzIGFsbCBzYXRpc2Z5IHRoZSBnaXZlblxuICAvLyBwcmVkaWNhdGUsIGFuZCBvbmUgd2hvc2UgZWxlbWVudHMgYWxsIGRvIG5vdCBzYXRpc2Z5IHRoZSBwcmVkaWNhdGUuXG4gIF8ucGFydGl0aW9uID0gZnVuY3Rpb24oYXJyYXksIHByZWRpY2F0ZSkge1xuICAgIHZhciBwYXNzID0gW10sIGZhaWwgPSBbXTtcbiAgICBlYWNoKGFycmF5LCBmdW5jdGlvbihlbGVtKSB7XG4gICAgICAocHJlZGljYXRlKGVsZW0pID8gcGFzcyA6IGZhaWwpLnB1c2goZWxlbSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFtwYXNzLCBmYWlsXTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIEFsaWFzZWQgYXMgYHVuaXF1ZWAuXG4gIF8udW5pcSA9IF8udW5pcXVlID0gZnVuY3Rpb24oYXJyYXksIGlzU29ydGVkLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChfLmlzRnVuY3Rpb24oaXNTb3J0ZWQpKSB7XG4gICAgICBjb250ZXh0ID0gaXRlcmF0b3I7XG4gICAgICBpdGVyYXRvciA9IGlzU29ydGVkO1xuICAgICAgaXNTb3J0ZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGluaXRpYWwgPSBpdGVyYXRvciA/IF8ubWFwKGFycmF5LCBpdGVyYXRvciwgY29udGV4dCkgOiBhcnJheTtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIHZhciBzZWVuID0gW107XG4gICAgZWFjaChpbml0aWFsLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgIGlmIChpc1NvcnRlZCA/ICghaW5kZXggfHwgc2VlbltzZWVuLmxlbmd0aCAtIDFdICE9PSB2YWx1ZSkgOiAhXy5jb250YWlucyhzZWVuLCB2YWx1ZSkpIHtcbiAgICAgICAgc2Vlbi5wdXNoKHZhbHVlKTtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGFycmF5W2luZGV4XSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB1bmlvbjogZWFjaCBkaXN0aW5jdCBlbGVtZW50IGZyb20gYWxsIG9mXG4gIC8vIHRoZSBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLnVuaW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8udW5pcShfLmZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlKSk7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIGV2ZXJ5IGl0ZW0gc2hhcmVkIGJldHdlZW4gYWxsIHRoZVxuICAvLyBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLmludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3QgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKF8udW5pcShhcnJheSksIGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIHJldHVybiBfLmV2ZXJ5KHJlc3QsIGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgICAgIHJldHVybiBfLmNvbnRhaW5zKG90aGVyLCBpdGVtKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFRha2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBvbmUgYXJyYXkgYW5kIGEgbnVtYmVyIG9mIG90aGVyIGFycmF5cy5cbiAgLy8gT25seSB0aGUgZWxlbWVudHMgcHJlc2VudCBpbiBqdXN0IHRoZSBmaXJzdCBhcnJheSB3aWxsIHJlbWFpbi5cbiAgXy5kaWZmZXJlbmNlID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgcmVzdCA9IGNvbmNhdC5hcHBseShBcnJheVByb3RvLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgZnVuY3Rpb24odmFsdWUpeyByZXR1cm4gIV8uY29udGFpbnMocmVzdCwgdmFsdWUpOyB9KTtcbiAgfTtcblxuICAvLyBaaXAgdG9nZXRoZXIgbXVsdGlwbGUgbGlzdHMgaW50byBhIHNpbmdsZSBhcnJheSAtLSBlbGVtZW50cyB0aGF0IHNoYXJlXG4gIC8vIGFuIGluZGV4IGdvIHRvZ2V0aGVyLlxuICBfLnppcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsZW5ndGggPSBfLm1heChfLnBsdWNrKGFyZ3VtZW50cywgJ2xlbmd0aCcpLmNvbmNhdCgwKSk7XG4gICAgdmFyIHJlc3VsdHMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsICcnICsgaSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgXy5vYmplY3QgPSBmdW5jdGlvbihsaXN0LCB2YWx1ZXMpIHtcbiAgICBpZiAobGlzdCA9PSBudWxsKSByZXR1cm4ge307XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gSWYgdGhlIGJyb3dzZXIgZG9lc24ndCBzdXBwbHkgdXMgd2l0aCBpbmRleE9mIChJJ20gbG9va2luZyBhdCB5b3UsICoqTVNJRSoqKSxcbiAgLy8gd2UgbmVlZCB0aGlzIGZ1bmN0aW9uLiBSZXR1cm4gdGhlIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGFuXG4gIC8vIGl0ZW0gaW4gYW4gYXJyYXksIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBpbmRleE9mYCBpZiBhdmFpbGFibGUuXG4gIC8vIElmIHRoZSBhcnJheSBpcyBsYXJnZSBhbmQgYWxyZWFkeSBpbiBzb3J0IG9yZGVyLCBwYXNzIGB0cnVlYFxuICAvLyBmb3IgKippc1NvcnRlZCoqIHRvIHVzZSBiaW5hcnkgc2VhcmNoLlxuICBfLmluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgaXNTb3J0ZWQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmIChpc1NvcnRlZCkge1xuICAgICAgaWYgKHR5cGVvZiBpc1NvcnRlZCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpID0gKGlzU29ydGVkIDwgMCA/IE1hdGgubWF4KDAsIGxlbmd0aCArIGlzU29ydGVkKSA6IGlzU29ydGVkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkgPSBfLnNvcnRlZEluZGV4KGFycmF5LCBpdGVtKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2ldID09PSBpdGVtID8gaSA6IC0xO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobmF0aXZlSW5kZXhPZiAmJiBhcnJheS5pbmRleE9mID09PSBuYXRpdmVJbmRleE9mKSByZXR1cm4gYXJyYXkuaW5kZXhPZihpdGVtLCBpc1NvcnRlZCk7XG4gICAgZm9yICg7IGkgPCBsZW5ndGg7IGkrKykgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGxhc3RJbmRleE9mYCBpZiBhdmFpbGFibGUuXG4gIF8ubGFzdEluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgZnJvbSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gLTE7XG4gICAgdmFyIGhhc0luZGV4ID0gZnJvbSAhPSBudWxsO1xuICAgIGlmIChuYXRpdmVMYXN0SW5kZXhPZiAmJiBhcnJheS5sYXN0SW5kZXhPZiA9PT0gbmF0aXZlTGFzdEluZGV4T2YpIHtcbiAgICAgIHJldHVybiBoYXNJbmRleCA/IGFycmF5Lmxhc3RJbmRleE9mKGl0ZW0sIGZyb20pIDogYXJyYXkubGFzdEluZGV4T2YoaXRlbSk7XG4gICAgfVxuICAgIHZhciBpID0gKGhhc0luZGV4ID8gZnJvbSA6IGFycmF5Lmxlbmd0aCk7XG4gICAgd2hpbGUgKGktLSkgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYW4gaW50ZWdlciBBcnJheSBjb250YWluaW5nIGFuIGFyaXRobWV0aWMgcHJvZ3Jlc3Npb24uIEEgcG9ydCBvZlxuICAvLyB0aGUgbmF0aXZlIFB5dGhvbiBgcmFuZ2UoKWAgZnVuY3Rpb24uIFNlZVxuICAvLyBbdGhlIFB5dGhvbiBkb2N1bWVudGF0aW9uXShodHRwOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvZnVuY3Rpb25zLmh0bWwjcmFuZ2UpLlxuICBfLnJhbmdlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHN0ZXApIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICBzdG9wID0gc3RhcnQgfHwgMDtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgc3RlcCA9IGFyZ3VtZW50c1syXSB8fCAxO1xuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgaWR4ID0gMDtcbiAgICB2YXIgcmFuZ2UgPSBuZXcgQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlKGlkeCA8IGxlbmd0aCkge1xuICAgICAgcmFuZ2VbaWR4KytdID0gc3RhcnQ7XG4gICAgICBzdGFydCArPSBzdGVwO1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfTtcblxuICAvLyBGdW5jdGlvbiAoYWhlbSkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldXNhYmxlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciBwcm90b3R5cGUgc2V0dGluZy5cbiAgdmFyIGN0b3IgPSBmdW5jdGlvbigpe307XG5cbiAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgLy8gYXZhaWxhYmxlLlxuICBfLmJpbmQgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0KSB7XG4gICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcjtcbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSkgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBjdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgdmFyIHNlbGYgPSBuZXcgY3RvcjtcbiAgICAgIGN0b3IucHJvdG90eXBlID0gbnVsbDtcbiAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgaWYgKE9iamVjdChyZXN1bHQpID09PSByZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbiAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuICAvLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG4gIF8ucGFydGlhbCA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFyZ3NbaV0gPT09IF8pIGFyZ3NbaV0gPSBhcmd1bWVudHNbcG9zaXRpb24rK107XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gQmluZCBhIG51bWJlciBvZiBhbiBvYmplY3QncyBtZXRob2RzIHRvIHRoYXQgb2JqZWN0LiBSZW1haW5pbmcgYXJndW1lbnRzXG4gIC8vIGFyZSB0aGUgbWV0aG9kIG5hbWVzIHRvIGJlIGJvdW5kLiBVc2VmdWwgZm9yIGVuc3VyaW5nIHRoYXQgYWxsIGNhbGxiYWNrc1xuICAvLyBkZWZpbmVkIG9uIGFuIG9iamVjdCBiZWxvbmcgdG8gaXQuXG4gIF8uYmluZEFsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBmdW5jcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBpZiAoZnVuY3MubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ2JpbmRBbGwgbXVzdCBiZSBwYXNzZWQgZnVuY3Rpb24gbmFtZXMnKTtcbiAgICBlYWNoKGZ1bmNzLCBmdW5jdGlvbihmKSB7IG9ialtmXSA9IF8uYmluZChvYmpbZl0sIG9iaik7IH0pO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gTWVtb2l6ZSBhbiBleHBlbnNpdmUgZnVuY3Rpb24gYnkgc3RvcmluZyBpdHMgcmVzdWx0cy5cbiAgXy5tZW1vaXplID0gZnVuY3Rpb24oZnVuYywgaGFzaGVyKSB7XG4gICAgdmFyIG1lbW8gPSB7fTtcbiAgICBoYXNoZXIgfHwgKGhhc2hlciA9IF8uaWRlbnRpdHkpO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBrZXkgPSBoYXNoZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBfLmhhcyhtZW1vLCBrZXkpID8gbWVtb1trZXldIDogKG1lbW9ba2V5XSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBEZWxheXMgYSBmdW5jdGlvbiBmb3IgdGhlIGdpdmVuIG51bWJlciBvZiBtaWxsaXNlY29uZHMsIGFuZCB0aGVuIGNhbGxzXG4gIC8vIGl0IHdpdGggdGhlIGFyZ3VtZW50cyBzdXBwbGllZC5cbiAgXy5kZWxheSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpeyByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmdzKTsgfSwgd2FpdCk7XG4gIH07XG5cbiAgLy8gRGVmZXJzIGEgZnVuY3Rpb24sIHNjaGVkdWxpbmcgaXQgdG8gcnVuIGFmdGVyIHRoZSBjdXJyZW50IGNhbGwgc3RhY2sgaGFzXG4gIC8vIGNsZWFyZWQuXG4gIF8uZGVmZXIgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgcmV0dXJuIF8uZGVsYXkuYXBwbHkoXywgW2Z1bmMsIDFdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIF8udGhyb3R0bGUgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBvcHRpb25zKSB7XG4gICAgdmFyIGNvbnRleHQsIGFyZ3MsIHJlc3VsdDtcbiAgICB2YXIgdGltZW91dCA9IG51bGw7XG4gICAgdmFyIHByZXZpb3VzID0gMDtcbiAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcHJldmlvdXMgPSBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlID8gMCA6IF8ubm93KCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgfTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm93ID0gXy5ub3coKTtcbiAgICAgIGlmICghcHJldmlvdXMgJiYgb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSkgcHJldmlvdXMgPSBub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAocmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgcHJldmlvdXMgPSBub3c7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCBhcyBsb25nIGFzIGl0IGNvbnRpbnVlcyB0byBiZSBpbnZva2VkLCB3aWxsIG5vdFxuICAvLyBiZSB0cmlnZ2VyZWQuIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCBhZnRlciBpdCBzdG9wcyBiZWluZyBjYWxsZWQgZm9yXG4gIC8vIE4gbWlsbGlzZWNvbmRzLiBJZiBgaW1tZWRpYXRlYCBpcyBwYXNzZWQsIHRyaWdnZXIgdGhlIGZ1bmN0aW9uIG9uIHRoZVxuICAvLyBsZWFkaW5nIGVkZ2UsIGluc3RlYWQgb2YgdGhlIHRyYWlsaW5nLlxuICBfLmRlYm91bmNlID0gZnVuY3Rpb24oZnVuYywgd2FpdCwgaW1tZWRpYXRlKSB7XG4gICAgdmFyIHRpbWVvdXQsIGFyZ3MsIGNvbnRleHQsIHRpbWVzdGFtcCwgcmVzdWx0O1xuXG4gICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbGFzdCA9IF8ubm93KCkgLSB0aW1lc3RhbXA7XG4gICAgICBpZiAobGFzdCA8IHdhaXQpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIHRpbWVzdGFtcCA9IF8ubm93KCk7XG4gICAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcbiAgICAgIGlmICghdGltZW91dCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCk7XG4gICAgICB9XG4gICAgICBpZiAoY2FsbE5vdykge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgXy5vbmNlID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHZhciByYW4gPSBmYWxzZSwgbWVtbztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAocmFuKSByZXR1cm4gbWVtbztcbiAgICAgIHJhbiA9IHRydWU7XG4gICAgICBtZW1vID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgZnVuYyA9IG51bGw7XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGZ1bmN0aW9uIHBhc3NlZCBhcyBhbiBhcmd1bWVudCB0byB0aGUgc2Vjb25kLFxuICAvLyBhbGxvd2luZyB5b3UgdG8gYWRqdXN0IGFyZ3VtZW50cywgcnVuIGNvZGUgYmVmb3JlIGFuZCBhZnRlciwgYW5kXG4gIC8vIGNvbmRpdGlvbmFsbHkgZXhlY3V0ZSB0aGUgb3JpZ2luYWwgZnVuY3Rpb24uXG4gIF8ud3JhcCA9IGZ1bmN0aW9uKGZ1bmMsIHdyYXBwZXIpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHdyYXBwZXIsIGZ1bmMpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiBhIGxpc3Qgb2YgZnVuY3Rpb25zLCBlYWNoXG4gIC8vIGNvbnN1bWluZyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gIF8uY29tcG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGZvciAodmFyIGkgPSBmdW5jcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBhcmdzID0gW2Z1bmNzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhcmdzWzBdO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGFmdGVyIGJlaW5nIGNhbGxlZCBOIHRpbWVzLlxuICBfLmFmdGVyID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIE9iamVjdCBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgT2JqZWN0LmtleXNgXG4gIF8ua2V5cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgaWYgKG5hdGl2ZUtleXMpIHJldHVybiBuYXRpdmVLZXlzKG9iaik7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuICAvLyBSZXRyaWV2ZSB0aGUgdmFsdWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIF8udmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbHVlc1tpXSA9IG9ialtrZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfTtcblxuICAvLyBDb252ZXJ0IGFuIG9iamVjdCBpbnRvIGEgbGlzdCBvZiBgW2tleSwgdmFsdWVdYCBwYWlycy5cbiAgXy5wYWlycyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHBhaXJzW2ldID0gW2tleXNbaV0sIG9ialtrZXlzW2ldXV07XG4gICAgfVxuICAgIHJldHVybiBwYWlycztcbiAgfTtcblxuICAvLyBJbnZlcnQgdGhlIGtleXMgYW5kIHZhbHVlcyBvZiBhbiBvYmplY3QuIFRoZSB2YWx1ZXMgbXVzdCBiZSBzZXJpYWxpemFibGUuXG4gIF8uaW52ZXJ0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdFtvYmpba2V5c1tpXV1dID0ga2V5c1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBzb3J0ZWQgbGlzdCBvZiB0aGUgZnVuY3Rpb24gbmFtZXMgYXZhaWxhYmxlIG9uIHRoZSBvYmplY3QuXG4gIC8vIEFsaWFzZWQgYXMgYG1ldGhvZHNgXG4gIF8uZnVuY3Rpb25zID0gXy5tZXRob2RzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIG5hbWVzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKF8uaXNGdW5jdGlvbihvYmpba2V5XSkpIG5hbWVzLnB1c2goa2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIG5hbWVzLnNvcnQoKTtcbiAgfTtcblxuICAvLyBFeHRlbmQgYSBnaXZlbiBvYmplY3Qgd2l0aCBhbGwgdGhlIHByb3BlcnRpZXMgaW4gcGFzc2VkLWluIG9iamVjdChzKS5cbiAgXy5leHRlbmQgPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgb25seSBjb250YWluaW5nIHRoZSB3aGl0ZWxpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLnBpY2sgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgY29weSA9IHt9O1xuICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgZWFjaChrZXlzLCBmdW5jdGlvbihrZXkpIHtcbiAgICAgIGlmIChrZXkgaW4gb2JqKSBjb3B5W2tleV0gPSBvYmpba2V5XTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGJsYWNrbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ub21pdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBjb3B5ID0ge307XG4gICAgdmFyIGtleXMgPSBjb25jYXQuYXBwbHkoQXJyYXlQcm90bywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoIV8uY29udGFpbnMoa2V5cywga2V5KSkgY29weVtrZXldID0gb2JqW2tleV07XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gIC8vIEZpbGwgaW4gYSBnaXZlbiBvYmplY3Qgd2l0aCBkZWZhdWx0IHByb3BlcnRpZXMuXG4gIF8uZGVmYXVsdHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgaWYgKG9ialtwcm9wXSA9PT0gdm9pZCAwKSBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgXy5jbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBfLmlzQXJyYXkob2JqKSA/IG9iai5zbGljZSgpIDogXy5leHRlbmQoe30sIG9iaik7XG4gIH07XG5cbiAgLy8gSW52b2tlcyBpbnRlcmNlcHRvciB3aXRoIHRoZSBvYmosIGFuZCB0aGVuIHJldHVybnMgb2JqLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIF8udGFwID0gZnVuY3Rpb24ob2JqLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKG9iaik7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYGlzRXF1YWxgLlxuICB2YXIgZXEgPSBmdW5jdGlvbihhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIElkZW50aWNhbCBvYmplY3RzIGFyZSBlcXVhbC4gYDAgPT09IC0wYCwgYnV0IHRoZXkgYXJlbid0IGlkZW50aWNhbC5cbiAgICAvLyBTZWUgdGhlIFtIYXJtb255IGBlZ2FsYCBwcm9wb3NhbF0oaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsKS5cbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIGEgIT09IDAgfHwgMSAvIGEgPT0gMSAvIGI7XG4gICAgLy8gQSBzdHJpY3QgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkgYmVjYXVzZSBgbnVsbCA9PSB1bmRlZmluZWRgLlxuICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gYSA9PT0gYjtcbiAgICAvLyBVbndyYXAgYW55IHdyYXBwZWQgb2JqZWN0cy5cbiAgICBpZiAoYSBpbnN0YW5jZW9mIF8pIGEgPSBhLl93cmFwcGVkO1xuICAgIGlmIChiIGluc3RhbmNlb2YgXykgYiA9IGIuX3dyYXBwZWQ7XG4gICAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9IHRvU3RyaW5nLmNhbGwoYikpIHJldHVybiBmYWxzZTtcbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gU3RyaW5ncywgbnVtYmVycywgZGF0ZXMsIGFuZCBib29sZWFucyBhcmUgY29tcGFyZWQgYnkgdmFsdWUuXG4gICAgICBjYXNlICdbb2JqZWN0IFN0cmluZ10nOlxuICAgICAgICAvLyBQcmltaXRpdmVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9iamVjdCB3cmFwcGVycyBhcmUgZXF1aXZhbGVudDsgdGh1cywgYFwiNVwiYCBpc1xuICAgICAgICAvLyBlcXVpdmFsZW50IHRvIGBuZXcgU3RyaW5nKFwiNVwiKWAuXG4gICAgICAgIHJldHVybiBhID09IFN0cmluZyhiKTtcbiAgICAgIGNhc2UgJ1tvYmplY3QgTnVtYmVyXSc6XG4gICAgICAgIC8vIGBOYU5gcyBhcmUgZXF1aXZhbGVudCwgYnV0IG5vbi1yZWZsZXhpdmUuIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3JcbiAgICAgICAgLy8gb3RoZXIgbnVtZXJpYyB2YWx1ZXMuXG4gICAgICAgIHJldHVybiBhICE9ICthID8gYiAhPSArYiA6IChhID09IDAgPyAxIC8gYSA9PSAxIC8gYiA6IGEgPT0gK2IpO1xuICAgICAgY2FzZSAnW29iamVjdCBEYXRlXSc6XG4gICAgICBjYXNlICdbb2JqZWN0IEJvb2xlYW5dJzpcbiAgICAgICAgLy8gQ29lcmNlIGRhdGVzIGFuZCBib29sZWFucyB0byBudW1lcmljIHByaW1pdGl2ZSB2YWx1ZXMuIERhdGVzIGFyZSBjb21wYXJlZCBieSB0aGVpclxuICAgICAgICAvLyBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnMuIE5vdGUgdGhhdCBpbnZhbGlkIGRhdGVzIHdpdGggbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zXG4gICAgICAgIC8vIG9mIGBOYU5gIGFyZSBub3QgZXF1aXZhbGVudC5cbiAgICAgICAgcmV0dXJuICthID09ICtiO1xuICAgICAgLy8gUmVnRXhwcyBhcmUgY29tcGFyZWQgYnkgdGhlaXIgc291cmNlIHBhdHRlcm5zIGFuZCBmbGFncy5cbiAgICAgIGNhc2UgJ1tvYmplY3QgUmVnRXhwXSc6XG4gICAgICAgIHJldHVybiBhLnNvdXJjZSA9PSBiLnNvdXJjZSAmJlxuICAgICAgICAgICAgICAgYS5nbG9iYWwgPT0gYi5nbG9iYWwgJiZcbiAgICAgICAgICAgICAgIGEubXVsdGlsaW5lID09IGIubXVsdGlsaW5lICYmXG4gICAgICAgICAgICAgICBhLmlnbm9yZUNhc2UgPT0gYi5pZ25vcmVDYXNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgIT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICAvLyBBc3N1bWUgZXF1YWxpdHkgZm9yIGN5Y2xpYyBzdHJ1Y3R1cmVzLiBUaGUgYWxnb3JpdGhtIGZvciBkZXRlY3RpbmcgY3ljbGljXG4gICAgLy8gc3RydWN0dXJlcyBpcyBhZGFwdGVkIGZyb20gRVMgNS4xIHNlY3Rpb24gMTUuMTIuMywgYWJzdHJhY3Qgb3BlcmF0aW9uIGBKT2AuXG4gICAgdmFyIGxlbmd0aCA9IGFTdGFjay5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAvLyBMaW5lYXIgc2VhcmNoLiBQZXJmb3JtYW5jZSBpcyBpbnZlcnNlbHkgcHJvcG9ydGlvbmFsIHRvIHRoZSBudW1iZXIgb2ZcbiAgICAgIC8vIHVuaXF1ZSBuZXN0ZWQgc3RydWN0dXJlcy5cbiAgICAgIGlmIChhU3RhY2tbbGVuZ3RoXSA9PSBhKSByZXR1cm4gYlN0YWNrW2xlbmd0aF0gPT0gYjtcbiAgICB9XG4gICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzXG4gICAgLy8gZnJvbSBkaWZmZXJlbnQgZnJhbWVzIGFyZS5cbiAgICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gICAgaWYgKGFDdG9yICE9PSBiQ3RvciAmJiAhKF8uaXNGdW5jdGlvbihhQ3RvcikgJiYgKGFDdG9yIGluc3RhbmNlb2YgYUN0b3IpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uaXNGdW5jdGlvbihiQ3RvcikgJiYgKGJDdG9yIGluc3RhbmNlb2YgYkN0b3IpKVxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKCdjb25zdHJ1Y3RvcicgaW4gYSAmJiAnY29uc3RydWN0b3InIGluIGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIEFkZCB0aGUgZmlyc3Qgb2JqZWN0IHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucHVzaChhKTtcbiAgICBiU3RhY2sucHVzaChiKTtcbiAgICB2YXIgc2l6ZSA9IDAsIHJlc3VsdCA9IHRydWU7XG4gICAgLy8gUmVjdXJzaXZlbHkgY29tcGFyZSBvYmplY3RzIGFuZCBhcnJheXMuXG4gICAgaWYgKGNsYXNzTmFtZSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAvLyBDb21wYXJlIGFycmF5IGxlbmd0aHMgdG8gZGV0ZXJtaW5lIGlmIGEgZGVlcCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeS5cbiAgICAgIHNpemUgPSBhLmxlbmd0aDtcbiAgICAgIHJlc3VsdCA9IHNpemUgPT0gYi5sZW5ndGg7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIC8vIERlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXMuXG4gICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICBpZiAoIShyZXN1bHQgPSBlcShhW3NpemVdLCBiW3NpemVdLCBhU3RhY2ssIGJTdGFjaykpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEZWVwIGNvbXBhcmUgb2JqZWN0cy5cbiAgICAgIGZvciAodmFyIGtleSBpbiBhKSB7XG4gICAgICAgIGlmIChfLmhhcyhhLCBrZXkpKSB7XG4gICAgICAgICAgLy8gQ291bnQgdGhlIGV4cGVjdGVkIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgICAgIHNpemUrKztcbiAgICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXIuXG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gXy5oYXMoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEVuc3VyZSB0aGF0IGJvdGggb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBmb3IgKGtleSBpbiBiKSB7XG4gICAgICAgICAgaWYgKF8uaGFzKGIsIGtleSkgJiYgIShzaXplLS0pKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSAhc2l6ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmVtb3ZlIHRoZSBmaXJzdCBvYmplY3QgZnJvbSB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnBvcCgpO1xuICAgIGJTdGFjay5wb3AoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFBlcmZvcm0gYSBkZWVwIGNvbXBhcmlzb24gdG8gY2hlY2sgaWYgdHdvIG9iamVjdHMgYXJlIGVxdWFsLlxuICBfLmlzRXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGVxKGEsIGIsIFtdLCBbXSk7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiBhcnJheSwgc3RyaW5nLCBvciBvYmplY3QgZW1wdHk/XG4gIC8vIEFuIFwiZW1wdHlcIiBvYmplY3QgaGFzIG5vIGVudW1lcmFibGUgb3duLXByb3BlcnRpZXMuXG4gIF8uaXNFbXB0eSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKF8uaXNBcnJheShvYmopIHx8IF8uaXNTdHJpbmcob2JqKSkgcmV0dXJuIG9iai5sZW5ndGggPT09IDA7XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBET00gZWxlbWVudD9cbiAgXy5pc0VsZW1lbnQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gISEob2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMSk7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhbiBhcnJheT9cbiAgLy8gRGVsZWdhdGVzIHRvIEVDTUE1J3MgbmF0aXZlIEFycmF5LmlzQXJyYXlcbiAgXy5pc0FycmF5ID0gbmF0aXZlSXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSBhbiBvYmplY3Q/XG4gIF8uaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBPYmplY3Qob2JqKTtcbiAgfTtcblxuICAvLyBBZGQgc29tZSBpc1R5cGUgbWV0aG9kczogaXNBcmd1bWVudHMsIGlzRnVuY3Rpb24sIGlzU3RyaW5nLCBpc051bWJlciwgaXNEYXRlLCBpc1JlZ0V4cC5cbiAgZWFjaChbJ0FyZ3VtZW50cycsICdGdW5jdGlvbicsICdTdHJpbmcnLCAnTnVtYmVyJywgJ0RhdGUnLCAnUmVnRXhwJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBfWydpcycgKyBuYW1lXSA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCAnICsgbmFtZSArICddJztcbiAgICB9O1xuICB9KTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFKSwgd2hlcmVcbiAgLy8gdGhlcmUgaXNuJ3QgYW55IGluc3BlY3RhYmxlIFwiQXJndW1lbnRzXCIgdHlwZS5cbiAgaWYgKCFfLmlzQXJndW1lbnRzKGFyZ3VtZW50cykpIHtcbiAgICBfLmlzQXJndW1lbnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gISEob2JqICYmIF8uaGFzKG9iaiwgJ2NhbGxlZScpKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gT3B0aW1pemUgYGlzRnVuY3Rpb25gIGlmIGFwcHJvcHJpYXRlLlxuICBpZiAodHlwZW9mICgvLi8pICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9O1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiBvYmplY3QgYSBmaW5pdGUgbnVtYmVyP1xuICBfLmlzRmluaXRlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIGlzRmluaXRlKG9iaikgJiYgIWlzTmFOKHBhcnNlRmxvYXQob2JqKSk7XG4gIH07XG5cbiAgLy8gSXMgdGhlIGdpdmVuIHZhbHVlIGBOYU5gPyAoTmFOIGlzIHRoZSBvbmx5IG51bWJlciB3aGljaCBkb2VzIG5vdCBlcXVhbCBpdHNlbGYpLlxuICBfLmlzTmFOID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIF8uaXNOdW1iZXIob2JqKSAmJiBvYmogIT0gK29iajtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgYm9vbGVhbj9cbiAgXy5pc0Jvb2xlYW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSB0cnVlIHx8IG9iaiA9PT0gZmFsc2UgfHwgdG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEJvb2xlYW5dJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGVxdWFsIHRvIG51bGw/XG4gIF8uaXNOdWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gbnVsbDtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIHVuZGVmaW5lZD9cbiAgXy5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHZvaWQgMDtcbiAgfTtcblxuICAvLyBTaG9ydGN1dCBmdW5jdGlvbiBmb3IgY2hlY2tpbmcgaWYgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHByb3BlcnR5IGRpcmVjdGx5XG4gIC8vIG9uIGl0c2VsZiAoaW4gb3RoZXIgd29yZHMsIG5vdCBvbiBhIHByb3RvdHlwZSkuXG4gIF8uaGFzID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gIH07XG5cbiAgLy8gVXRpbGl0eSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSdW4gVW5kZXJzY29yZS5qcyBpbiAqbm9Db25mbGljdCogbW9kZSwgcmV0dXJuaW5nIHRoZSBgX2AgdmFyaWFibGUgdG8gaXRzXG4gIC8vIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcm9vdC5fID0gcHJldmlvdXNVbmRlcnNjb3JlO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8vIEtlZXAgdGhlIGlkZW50aXR5IGZ1bmN0aW9uIGFyb3VuZCBmb3IgZGVmYXVsdCBpdGVyYXRvcnMuXG4gIF8uaWRlbnRpdHkgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICBfLmNvbnN0YW50ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG4gIH07XG5cbiAgXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBwcmVkaWNhdGUgZm9yIGNoZWNraW5nIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5tYXRjaGVzID0gZnVuY3Rpb24oYXR0cnMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICBpZiAob2JqID09PSBhdHRycykgcmV0dXJuIHRydWU7IC8vYXZvaWQgY29tcGFyaW5nIGFuIG9iamVjdCB0byBpdHNlbGYuXG4gICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHJzW2tleV0gIT09IG9ialtrZXldKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfTtcblxuICAvLyBSdW4gYSBmdW5jdGlvbiAqKm4qKiB0aW1lcy5cbiAgXy50aW1lcyA9IGZ1bmN0aW9uKG4sIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIGFjY3VtID0gQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSBhY2N1bVtpXSA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHJhbmRvbSBpbnRlZ2VyIGJldHdlZW4gbWluIGFuZCBtYXggKGluY2x1c2l2ZSkuXG4gIF8ucmFuZG9tID0gZnVuY3Rpb24obWluLCBtYXgpIHtcbiAgICBpZiAobWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IG1pbjtcbiAgICAgIG1pbiA9IDA7XG4gICAgfVxuICAgIHJldHVybiBtaW4gKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpO1xuICB9O1xuXG4gIC8vIEEgKHBvc3NpYmx5IGZhc3Rlcikgd2F5IHRvIGdldCB0aGUgY3VycmVudCB0aW1lc3RhbXAgYXMgYW4gaW50ZWdlci5cbiAgXy5ub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xuXG4gIC8vIExpc3Qgb2YgSFRNTCBlbnRpdGllcyBmb3IgZXNjYXBpbmcuXG4gIHZhciBlbnRpdHlNYXAgPSB7XG4gICAgZXNjYXBlOiB7XG4gICAgICAnJic6ICcmYW1wOycsXG4gICAgICAnPCc6ICcmbHQ7JyxcbiAgICAgICc+JzogJyZndDsnLFxuICAgICAgJ1wiJzogJyZxdW90OycsXG4gICAgICBcIidcIjogJyYjeDI3OydcbiAgICB9XG4gIH07XG4gIGVudGl0eU1hcC51bmVzY2FwZSA9IF8uaW52ZXJ0KGVudGl0eU1hcC5lc2NhcGUpO1xuXG4gIC8vIFJlZ2V4ZXMgY29udGFpbmluZyB0aGUga2V5cyBhbmQgdmFsdWVzIGxpc3RlZCBpbW1lZGlhdGVseSBhYm92ZS5cbiAgdmFyIGVudGl0eVJlZ2V4ZXMgPSB7XG4gICAgZXNjYXBlOiAgIG5ldyBSZWdFeHAoJ1snICsgXy5rZXlzKGVudGl0eU1hcC5lc2NhcGUpLmpvaW4oJycpICsgJ10nLCAnZycpLFxuICAgIHVuZXNjYXBlOiBuZXcgUmVnRXhwKCcoJyArIF8ua2V5cyhlbnRpdHlNYXAudW5lc2NhcGUpLmpvaW4oJ3wnKSArICcpJywgJ2cnKVxuICB9O1xuXG4gIC8vIEZ1bmN0aW9ucyBmb3IgZXNjYXBpbmcgYW5kIHVuZXNjYXBpbmcgc3RyaW5ncyB0by9mcm9tIEhUTUwgaW50ZXJwb2xhdGlvbi5cbiAgXy5lYWNoKFsnZXNjYXBlJywgJ3VuZXNjYXBlJ10sIGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIF9bbWV0aG9kXSA9IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgaWYgKHN0cmluZyA9PSBudWxsKSByZXR1cm4gJyc7XG4gICAgICByZXR1cm4gKCcnICsgc3RyaW5nKS5yZXBsYWNlKGVudGl0eVJlZ2V4ZXNbbWV0aG9kXSwgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgICAgcmV0dXJuIGVudGl0eU1hcFttZXRob2RdW21hdGNoXTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIElmIHRoZSB2YWx1ZSBvZiB0aGUgbmFtZWQgYHByb3BlcnR5YCBpcyBhIGZ1bmN0aW9uIHRoZW4gaW52b2tlIGl0IHdpdGggdGhlXG4gIC8vIGBvYmplY3RgIGFzIGNvbnRleHQ7IG90aGVyd2lzZSwgcmV0dXJuIGl0LlxuICBfLnJlc3VsdCA9IGZ1bmN0aW9uKG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICBpZiAob2JqZWN0ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgdmFyIHZhbHVlID0gb2JqZWN0W3Byb3BlcnR5XTtcbiAgICByZXR1cm4gXy5pc0Z1bmN0aW9uKHZhbHVlKSA/IHZhbHVlLmNhbGwob2JqZWN0KSA6IHZhbHVlO1xuICB9O1xuXG4gIC8vIEFkZCB5b3VyIG93biBjdXN0b20gZnVuY3Rpb25zIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5taXhpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGVhY2goXy5mdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfW25hbWVdID0gb2JqW25hbWVdO1xuICAgICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbdGhpcy5fd3JhcHBlZF07XG4gICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIGZ1bmMuYXBwbHkoXywgYXJncykpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhIHVuaXF1ZSBpbnRlZ2VyIGlkICh1bmlxdWUgd2l0aGluIHRoZSBlbnRpcmUgY2xpZW50IHNlc3Npb24pLlxuICAvLyBVc2VmdWwgZm9yIHRlbXBvcmFyeSBET00gaWRzLlxuICB2YXIgaWRDb3VudGVyID0gMDtcbiAgXy51bmlxdWVJZCA9IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH07XG5cbiAgLy8gQnkgZGVmYXVsdCwgVW5kZXJzY29yZSB1c2VzIEVSQi1zdHlsZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzLCBjaGFuZ2UgdGhlXG4gIC8vIGZvbGxvd2luZyB0ZW1wbGF0ZSBzZXR0aW5ncyB0byB1c2UgYWx0ZXJuYXRpdmUgZGVsaW1pdGVycy5cbiAgXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xuICAgIGV2YWx1YXRlICAgIDogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZSA6IC88JT0oW1xcc1xcU10rPyklPi9nLFxuICAgIGVzY2FwZSAgICAgIDogLzwlLShbXFxzXFxTXSs/KSU+L2dcbiAgfTtcblxuICAvLyBXaGVuIGN1c3RvbWl6aW5nIGB0ZW1wbGF0ZVNldHRpbmdzYCwgaWYgeW91IGRvbid0IHdhbnQgdG8gZGVmaW5lIGFuXG4gIC8vIGludGVycG9sYXRpb24sIGV2YWx1YXRpb24gb3IgZXNjYXBpbmcgcmVnZXgsIHdlIG5lZWQgb25lIHRoYXQgaXNcbiAgLy8gZ3VhcmFudGVlZCBub3QgdG8gbWF0Y2guXG4gIHZhciBub01hdGNoID0gLyguKV4vO1xuXG4gIC8vIENlcnRhaW4gY2hhcmFjdGVycyBuZWVkIHRvIGJlIGVzY2FwZWQgc28gdGhhdCB0aGV5IGNhbiBiZSBwdXQgaW50byBhXG4gIC8vIHN0cmluZyBsaXRlcmFsLlxuICB2YXIgZXNjYXBlcyA9IHtcbiAgICBcIidcIjogICAgICBcIidcIixcbiAgICAnXFxcXCc6ICAgICAnXFxcXCcsXG4gICAgJ1xccic6ICAgICAncicsXG4gICAgJ1xcbic6ICAgICAnbicsXG4gICAgJ1xcdCc6ICAgICAndCcsXG4gICAgJ1xcdTIwMjgnOiAndTIwMjgnLFxuICAgICdcXHUyMDI5JzogJ3UyMDI5J1xuICB9O1xuXG4gIHZhciBlc2NhcGVyID0gL1xcXFx8J3xcXHJ8XFxufFxcdHxcXHUyMDI4fFxcdTIwMjkvZztcblxuICAvLyBKYXZhU2NyaXB0IG1pY3JvLXRlbXBsYXRpbmcsIHNpbWlsYXIgdG8gSm9obiBSZXNpZydzIGltcGxlbWVudGF0aW9uLlxuICAvLyBVbmRlcnNjb3JlIHRlbXBsYXRpbmcgaGFuZGxlcyBhcmJpdHJhcnkgZGVsaW1pdGVycywgcHJlc2VydmVzIHdoaXRlc3BhY2UsXG4gIC8vIGFuZCBjb3JyZWN0bHkgZXNjYXBlcyBxdW90ZXMgd2l0aGluIGludGVycG9sYXRlZCBjb2RlLlxuICBfLnRlbXBsYXRlID0gZnVuY3Rpb24odGV4dCwgZGF0YSwgc2V0dGluZ3MpIHtcbiAgICB2YXIgcmVuZGVyO1xuICAgIHNldHRpbmdzID0gXy5kZWZhdWx0cyh7fSwgc2V0dGluZ3MsIF8udGVtcGxhdGVTZXR0aW5ncyk7XG5cbiAgICAvLyBDb21iaW5lIGRlbGltaXRlcnMgaW50byBvbmUgcmVndWxhciBleHByZXNzaW9uIHZpYSBhbHRlcm5hdGlvbi5cbiAgICB2YXIgbWF0Y2hlciA9IG5ldyBSZWdFeHAoW1xuICAgICAgKHNldHRpbmdzLmVzY2FwZSB8fCBub01hdGNoKS5zb3VyY2UsXG4gICAgICAoc2V0dGluZ3MuaW50ZXJwb2xhdGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmV2YWx1YXRlIHx8IG5vTWF0Y2gpLnNvdXJjZVxuICAgIF0uam9pbignfCcpICsgJ3wkJywgJ2cnKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIHRlbXBsYXRlIHNvdXJjZSwgZXNjYXBpbmcgc3RyaW5nIGxpdGVyYWxzIGFwcHJvcHJpYXRlbHkuXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB2YXIgc291cmNlID0gXCJfX3ArPSdcIjtcbiAgICB0ZXh0LnJlcGxhY2UobWF0Y2hlciwgZnVuY3Rpb24obWF0Y2gsIGVzY2FwZSwgaW50ZXJwb2xhdGUsIGV2YWx1YXRlLCBvZmZzZXQpIHtcbiAgICAgIHNvdXJjZSArPSB0ZXh0LnNsaWNlKGluZGV4LCBvZmZzZXQpXG4gICAgICAgIC5yZXBsYWNlKGVzY2FwZXIsIGZ1bmN0aW9uKG1hdGNoKSB7IHJldHVybiAnXFxcXCcgKyBlc2NhcGVzW21hdGNoXTsgfSk7XG5cbiAgICAgIGlmIChlc2NhcGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBlc2NhcGUgKyBcIikpPT1udWxsPycnOl8uZXNjYXBlKF9fdCkpK1xcbidcIjtcbiAgICAgIH1cbiAgICAgIGlmIChpbnRlcnBvbGF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGludGVycG9sYXRlICsgXCIpKT09bnVsbD8nJzpfX3QpK1xcbidcIjtcbiAgICAgIH1cbiAgICAgIGlmIChldmFsdWF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInO1xcblwiICsgZXZhbHVhdGUgKyBcIlxcbl9fcCs9J1wiO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG4gICAgc291cmNlICs9IFwiJztcXG5cIjtcblxuICAgIC8vIElmIGEgdmFyaWFibGUgaXMgbm90IHNwZWNpZmllZCwgcGxhY2UgZGF0YSB2YWx1ZXMgaW4gbG9jYWwgc2NvcGUuXG4gICAgaWYgKCFzZXR0aW5ncy52YXJpYWJsZSkgc291cmNlID0gJ3dpdGgob2JqfHx7fSl7XFxuJyArIHNvdXJjZSArICd9XFxuJztcblxuICAgIHNvdXJjZSA9IFwidmFyIF9fdCxfX3A9JycsX19qPUFycmF5LnByb3RvdHlwZS5qb2luLFwiICtcbiAgICAgIFwicHJpbnQ9ZnVuY3Rpb24oKXtfX3ArPV9fai5jYWxsKGFyZ3VtZW50cywnJyk7fTtcXG5cIiArXG4gICAgICBzb3VyY2UgKyBcInJldHVybiBfX3A7XFxuXCI7XG5cbiAgICB0cnkge1xuICAgICAgcmVuZGVyID0gbmV3IEZ1bmN0aW9uKHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonLCAnXycsIHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGlmIChkYXRhKSByZXR1cm4gcmVuZGVyKGRhdGEsIF8pO1xuICAgIHZhciB0ZW1wbGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiByZW5kZXIuY2FsbCh0aGlzLCBkYXRhLCBfKTtcbiAgICB9O1xuXG4gICAgLy8gUHJvdmlkZSB0aGUgY29tcGlsZWQgZnVuY3Rpb24gc291cmNlIGFzIGEgY29udmVuaWVuY2UgZm9yIHByZWNvbXBpbGF0aW9uLlxuICAgIHRlbXBsYXRlLnNvdXJjZSA9ICdmdW5jdGlvbignICsgKHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonKSArICcpe1xcbicgKyBzb3VyY2UgKyAnfSc7XG5cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH07XG5cbiAgLy8gQWRkIGEgXCJjaGFpblwiIGZ1bmN0aW9uLCB3aGljaCB3aWxsIGRlbGVnYXRlIHRvIHRoZSB3cmFwcGVyLlxuICBfLmNoYWluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIF8ob2JqKS5jaGFpbigpO1xuICB9O1xuXG4gIC8vIE9PUFxuICAvLyAtLS0tLS0tLS0tLS0tLS1cbiAgLy8gSWYgVW5kZXJzY29yZSBpcyBjYWxsZWQgYXMgYSBmdW5jdGlvbiwgaXQgcmV0dXJucyBhIHdyYXBwZWQgb2JqZWN0IHRoYXRcbiAgLy8gY2FuIGJlIHVzZWQgT08tc3R5bGUuIFRoaXMgd3JhcHBlciBob2xkcyBhbHRlcmVkIHZlcnNpb25zIG9mIGFsbCB0aGVcbiAgLy8gdW5kZXJzY29yZSBmdW5jdGlvbnMuIFdyYXBwZWQgb2JqZWN0cyBtYXkgYmUgY2hhaW5lZC5cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29udGludWUgY2hhaW5pbmcgaW50ZXJtZWRpYXRlIHJlc3VsdHMuXG4gIHZhciByZXN1bHQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdGhpcy5fY2hhaW4gPyBfKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfTtcblxuICAvLyBBZGQgYWxsIG9mIHRoZSBVbmRlcnNjb3JlIGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlciBvYmplY3QuXG4gIF8ubWl4aW4oXyk7XG5cbiAgLy8gQWRkIGFsbCBtdXRhdG9yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgZWFjaChbJ3BvcCcsICdwdXNoJywgJ3JldmVyc2UnLCAnc2hpZnQnLCAnc29ydCcsICdzcGxpY2UnLCAndW5zaGlmdCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgbWV0aG9kLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIGlmICgobmFtZSA9PSAnc2hpZnQnIHx8IG5hbWUgPT0gJ3NwbGljZScpICYmIG9iai5sZW5ndGggPT09IDApIGRlbGV0ZSBvYmpbMF07XG4gICAgICByZXR1cm4gcmVzdWx0LmNhbGwodGhpcywgb2JqKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBBZGQgYWxsIGFjY2Vzc29yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgZWFjaChbJ2NvbmNhdCcsICdqb2luJywgJ3NsaWNlJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG1ldGhvZC5hcHBseSh0aGlzLl93cmFwcGVkLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9KTtcblxuICBfLmV4dGVuZChfLnByb3RvdHlwZSwge1xuXG4gICAgLy8gU3RhcnQgY2hhaW5pbmcgYSB3cmFwcGVkIFVuZGVyc2NvcmUgb2JqZWN0LlxuICAgIGNoYWluOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX2NoYWluID0gdHJ1ZTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBFeHRyYWN0cyB0aGUgcmVzdWx0IGZyb20gYSB3cmFwcGVkIGFuZCBjaGFpbmVkIG9iamVjdC5cbiAgICB2YWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgICB9XG5cbiAgfSk7XG5cbiAgLy8gQU1EIHJlZ2lzdHJhdGlvbiBoYXBwZW5zIGF0IHRoZSBlbmQgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBBTUQgbG9hZGVyc1xuICAvLyB0aGF0IG1heSBub3QgZW5mb3JjZSBuZXh0LXR1cm4gc2VtYW50aWNzIG9uIG1vZHVsZXMuIEV2ZW4gdGhvdWdoIGdlbmVyYWxcbiAgLy8gcHJhY3RpY2UgZm9yIEFNRCByZWdpc3RyYXRpb24gaXMgdG8gYmUgYW5vbnltb3VzLCB1bmRlcnNjb3JlIHJlZ2lzdGVyc1xuICAvLyBhcyBhIG5hbWVkIG1vZHVsZSBiZWNhdXNlLCBsaWtlIGpRdWVyeSwgaXQgaXMgYSBiYXNlIGxpYnJhcnkgdGhhdCBpc1xuICAvLyBwb3B1bGFyIGVub3VnaCB0byBiZSBidW5kbGVkIGluIGEgdGhpcmQgcGFydHkgbGliLCBidXQgbm90IGJlIHBhcnQgb2ZcbiAgLy8gYW4gQU1EIGxvYWQgcmVxdWVzdC4gVGhvc2UgY2FzZXMgY291bGQgZ2VuZXJhdGUgYW4gZXJyb3Igd2hlbiBhblxuICAvLyBhbm9ueW1vdXMgZGVmaW5lKCkgaXMgY2FsbGVkIG91dHNpZGUgb2YgYSBsb2FkZXIgcmVxdWVzdC5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZSgndW5kZXJzY29yZScsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfO1xuICAgIH0pO1xuICB9XG59KS5jYWxsKHRoaXMpO1xuIl19
