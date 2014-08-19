(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var createIwcConnector;

createIwcConnector = function(callback, options) {
  var IwcConnector, duiClient, init, iwcHandler, received_HB, userIwcHandler;
  userIwcHandler = null;
  if (options != null) {
    userIwcHandler = options.iwcHandler;
  }
  iwcHandler = {};
  duiClient = new DUIClient();
  duiClient.connect(function(intent) {
    var _ref;
    if ((_ref = iwcHandler[intent.action]) != null) {
      _ref.map(function(f) {
        return setTimeout(function() {
          return f(intent);
        }, 0);
      });
    }
    if (userIwcHandler != null) {
      return userIwcHandler(intent);
    }
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
      intent = null;
      if (arguments.length >= 2) {
        action_name = arguments[0], content = arguments[1];
        intent = {
          action: action_name,
          component: "",
          data: "",
          dataType: "",
          flags: ["PUBLISH_GLOBAL"],
          extras: content
        };
      } else {
        intent = arguments[0];
      }
      return this.duiClient.sendIntent(intent);
    };

    IwcConnector.prototype.setIwcHandler = function(f) {
      return userIwcHandler = f;
    };

    return IwcConnector;

  })();
  init = function() {
    var proposed_user_id;
    proposed_user_id = Math.floor(Math.random() * 1000000);
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

  JsonYatta.prototype.getSharedObject = function() {
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

  JsonYatta.prototype.toJson = function() {
    return this.root_element.toJson();
  };

  JsonYatta.prototype.val = function(name, content, mutable) {
    return this.root_element.val(name, content, mutable);
  };

  JsonYatta.prototype.on = function() {
    var _ref;
    return (_ref = this.root_element).on.apply(_ref, arguments);
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
      var args, event, f, _i, _len, _ref, _ref1, _results;
      event = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (((_ref = this.event_listeners) != null ? _ref[event] : void 0) != null) {
        _ref1 = this.event_listeners[event];
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          f = _ref1[_i];
          _results.push(f.call.apply(f, [this, event].concat(__slice.call(args))));
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

    JsonType.prototype.toJson = function() {
      var json, name, o, val;
      val = this.val();
      json = {};
      for (name in val) {
        o = val[name];
        if (o.constructor === {}.constructor) {
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
          this.map_manager.map[this.name] = HB.addOperation(new ReplaceManager(void 0, uid_r, beg, end));
          this.map_manager.map[this.name].setParent(this.map_manager, this.name);
          this.map_manager.map[this.name].execute();
        }
        this.map_manager.callEvent('addProperty', this.name);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvSXdjQ29ubmVjdG9yLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvQ29ubmVjdG9ycy9UZXN0Q29ubmVjdG9yLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvRW5naW5lLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvRnJhbWV3b3Jrcy9Kc29uWWF0dGEuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9GcmFtZXdvcmtzL1RleHRZYXR0YS5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0hpc3RvcnlCdWZmZXIuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvSnNvblR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvU3RydWN0dXJlZFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9saWIvaW5kZXguY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL25vZGVfbW9kdWxlcy91bmRlcnNjb3JlL3VuZGVyc2NvcmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNLQSxJQUFBLGtCQUFBOztB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QUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4jXG4jIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgY29ubmVjdG9yIGlzIGluaXRpYWxpemVkLlxuIyBAcGFyYW0ge1N0cmluZ30gaW5pdGlhbF91c2VyX2lkIE9wdGlvbmFsLiBZb3UgY2FuIHNldCB5b3Ugb3duIHVzZXJfaWQgKHNpbmNlIHRoZSBpZHMgb2YgZHVpY2xpZW50IGFyZSBub3QgYWx3YXlzIHVuaXF1ZSlcbiNcbmNyZWF0ZUl3Y0Nvbm5lY3RvciA9IChjYWxsYmFjaywgb3B0aW9ucyktPlxuICB1c2VySXdjSGFuZGxlciA9IG51bGxcbiAgaWYgb3B0aW9ucz9cbiAgICB7aXdjSGFuZGxlcjogdXNlckl3Y0hhbmRsZXJ9ID0gb3B0aW9uc1xuXG4gIGl3Y0hhbmRsZXIgPSB7fVxuICBkdWlDbGllbnQgPSBuZXcgRFVJQ2xpZW50KClcbiAgI0BkdWlDbGllbnQgPSBuZXcgaXdjLkNsaWVudCgpXG4gIGR1aUNsaWVudC5jb25uZWN0IChpbnRlbnQpLT5cbiAgICBpd2NIYW5kbGVyW2ludGVudC5hY3Rpb25dPy5tYXAgKGYpLT5cbiAgICAgIHNldFRpbWVvdXQgKCktPlxuICAgICAgICBmIGludGVudFxuICAgICAgLCAwXG4gICAgaWYgdXNlckl3Y0hhbmRsZXI/XG4gICAgICB1c2VySXdjSGFuZGxlciBpbnRlbnRcblxuICBkdWlDbGllbnQuaW5pdE9LKClcblxuICByZWNlaXZlZF9IQiA9IG51bGxcblxuICAjXG4gICMgVGhlIEl3YyBDb25uZWN0b3IgYWRkcyBzdXBwb3J0IGZvciB0aGUgSW50ZXItV2lkZ2V0LUNvbW11bmljYXRpb24gcHJvdG9jb2wgdGhhdCBpcyB1c2VkIGluIHRoZSBSb2xlLVNESy5cbiAgIyBAc2VlIGh0dHA6Ly9kYmlzLnJ3dGgtYWFjaGVuLmRlL2Ntcy9wcm9qZWN0cy90aGUteG1wcC1leHBlcmllbmNlI2ludGVyd2lkZ2V0LWNvbW11bmljYXRpb25cbiAgIyBAc2VlIGh0dHA6Ly9kYmlzLnJ3dGgtYWFjaGVuLmRlL2Ntcy9wcm9qZWN0cy9ST0xFXG4gICNcbiAgY2xhc3MgSXdjQ29ubmVjdG9yXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcbiAgICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgICAjIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiAgICAjIEBwYXJhbSB7WWF0dGF9IHlhdHRhIFRoZSBZYXR0YSBmcmFtZXdvcmsuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoQGVuZ2luZSwgQEhCLCBAZXhlY3V0aW9uX2xpc3RlbmVyLCBAeWF0dGEpLT5cbiAgICAgIEBkdWlDbGllbnQgPSBkdWlDbGllbnRcbiAgICAgIEBpd2NIYW5kbGVyID0gaXdjSGFuZGxlclxuXG4gICAgICBzZW5kXyA9IChvKT0+XG4gICAgICAgIGlmIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKEBpbml0aWFsaXplZCkubGVuZ3RoIGlzbnQgMFxuICAgICAgICAgIEBzZW5kIG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG4gICAgICBAaW5pdGlhbGl6ZWQgPSB7fVxuICAgICAgcmVjZWl2ZUhCID0gKGpzb24pPT5cbiAgICAgICAgSEIgPSBqc29uLmV4dHJhcy5IQlxuICAgICAgICBoaW0gPSBqc29uLmV4dHJhcy51c2VyXG4gICAgICAgIHRoaXMuZW5naW5lLmFwcGx5T3BzQ2hlY2tEb3VibGUgSEJcbiAgICAgICAgQGluaXRpYWxpemVkW2hpbV0gPSB0cnVlXG4gICAgICBpd2NIYW5kbGVyW1wiWWF0dGFfcHVzaF9IQl9lbGVtZW50XCJdID0gW3JlY2VpdmVIQl1cblxuICAgICAgQHNlbmRJd2NJbnRlbnQgXCJZYXR0YV9nZXRfSEJfZWxlbWVudFwiLCB7fVxuXG4gICAgICByZWNlaXZlXyA9IChpbnRlbnQpPT5cbiAgICAgICAgbyA9IGludGVudC5leHRyYXNcbiAgICAgICAgaWYgQGluaXRpYWxpemVkW28udWlkLmNyZWF0b3JdPyAjIGluaXRpYWxpemUgZmlyc3RcbiAgICAgICAgICBAcmVjZWl2ZSBvXG5cbiAgICAgIEBpd2NIYW5kbGVyW1wiWWF0dGFfbmV3X29wZXJhdGlvblwiXSA9IFtyZWNlaXZlX11cblxuICAgICAgaWYgcmVjZWl2ZWRfSEI/XG4gICAgICAgIEBlbmdpbmUuYXBwbHlPcHNDaGVja0RvdWJsZSByZWNlaXZlZF9IQlxuXG4gICAgICBzZW5kSGlzdG9yeUJ1ZmZlciA9ICgpPT5cbiAgICAgICAganNvbiA9XG4gICAgICAgICAgSEIgOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoKVxuICAgICAgICAgIHVzZXIgOiBAeWF0dGEuZ2V0VXNlcklkKClcbiAgICAgICAgQHNlbmRJd2NJbnRlbnQgXCJZYXR0YV9wdXNoX0hCX2VsZW1lbnRcIiwganNvblxuICAgICAgQGl3Y0hhbmRsZXJbXCJZYXR0YV9nZXRfSEJfZWxlbWVudFwiXSA9IFtzZW5kSGlzdG9yeUJ1ZmZlcl1cblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgZXhlY3V0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIGV4ZWN1dGVkLlxuICAgICNcbiAgICBzZW5kOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpcyBASEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgICAgQHNlbmRJd2NJbnRlbnQgXCJZYXR0YV9uZXdfb3BlcmF0aW9uXCIsIG9cblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIHJlY2VpdmVkLlxuICAgICNcbiAgICByZWNlaXZlOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpc250IEBIQi5nZXRVc2VySWQoKVxuICAgICAgICBAZW5naW5lLmFwcGx5T3Agb1xuXG4gICAgI1xuICAgICMgSGVscGVyIGZvciBzZW5kaW5nIGl3YyBpbnRlbnRzLlxuICAgICMgQG92ZXJsb2FkIHNlbmRJd2NJbnRlbnQgaW50ZW50XG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBpbnRlbnQgVGhlIGludGVudCBvYmplY3QuXG4gICAgIyBAb3ZlcmxvYWQgc2VuZEl3Y0ludGVudCBhY3Rpb25fbmFtZSwgY29udGVudFxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gYWN0aW9uX25hbWUgVGhlIG5hbWUgb2YgdGhlIGFjdGlvbiB0aGF0IGlzIGdvaW5nIHRvIGJlIHNlbmQuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50IFRoZSBjb250ZW50IHRoYXQgaXMgYXR0ZWNoZWQgdG8gdGhlIGludGVudC5cbiAgICAjXG4gICAgc2VuZEl3Y0ludGVudDogKGFjdGlvbl9uYW1lLCBjb250ZW50KS0+XG4gICAgICBpbnRlbnQgPSBudWxsXG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID49IDJcbiAgICAgICAgW2FjdGlvbl9uYW1lLCBjb250ZW50XSA9IGFyZ3VtZW50c1xuICAgICAgICBpbnRlbnQgPVxuICAgICAgICAgIGFjdGlvbjogYWN0aW9uX25hbWVcbiAgICAgICAgICBjb21wb25lbnQ6IFwiXCJcbiAgICAgICAgICBkYXRhOiBcIlwiXG4gICAgICAgICAgZGF0YVR5cGU6IFwiXCJcbiAgICAgICAgICBmbGFnczogW1wiUFVCTElTSF9HTE9CQUxcIl1cbiAgICAgICAgICBleHRyYXM6IGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgaW50ZW50ID0gYXJndW1lbnRzWzBdXG5cbiAgICAgIEBkdWlDbGllbnQuc2VuZEludGVudChpbnRlbnQpXG5cbiAgICBzZXRJd2NIYW5kbGVyOiAoZiktPlxuICAgICAgdXNlckl3Y0hhbmRsZXIgPSBmXG5cblxuICBpbml0ID0gKCktPlxuICAgICMgcHJvcG9zZWRfdXNlcl9pZCA9IGR1aUNsaWVudC5nZXRJd2NDbGllbnQoKS5fY29tcG9uZW50TmFtZSAjVE9ETzogVGhpcyBpcyBzdHVwaWQhIHdoeSBjYW4ndCBpIHVzZSB0aGlzP1xuICAgIHByb3Bvc2VkX3VzZXJfaWQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqMTAwMDAwMClcbiAgICBjYWxsYmFjayBJd2NDb25uZWN0b3IsIHByb3Bvc2VkX3VzZXJfaWRcblxuICBzZXRUaW1lb3V0IGluaXQsIDUwMDBcblxuICB1bmRlZmluZWRcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUl3Y0Nvbm5lY3RvclxuaWYgd2luZG93P1xuICBpZiBub3Qgd2luZG93Llk/XG4gICAgd2luZG93LlkgPSB7fVxuICB3aW5kb3cuWS5jcmVhdGVJd2NDb25uZWN0b3IgPSBjcmVhdGVJd2NDb25uZWN0b3JcblxuIiwiXG5fID0gcmVxdWlyZSBcInVuZGVyc2NvcmVcIlxuXG5tb2R1bGUuZXhwb3J0cyA9ICh1c2VyX2xpc3QpLT5cblxuICAjXG4gICMgQSB0cml2aWFsIENvbm5lY3RvciB0aGF0IHNpbXVsYXRlcyBuZXR3b3JrIGRlbGF5LlxuICAjXG4gIGNsYXNzIFRlc3RDb25uZWN0b3JcblxuICAgICNcbiAgICAjIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuICAgICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAgICMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuICAgICMgQHBhcmFtIHtZYXR0YX0geWF0dGEgVGhlIFlhdHRhIGZyYW1ld29yay5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAZW5naW5lLCBASEIsIEBleGVjdXRpb25fbGlzdGVuZXIpLT5cbiAgICAgIHNlbmRfID0gKG8pPT5cbiAgICAgICAgQHNlbmQgb1xuICAgICAgQGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG5cbiAgICAgIEBhcHBsaWVkX29wZXJhdGlvbnMgPSBbXVxuICAgICAgYXBwbGllZE9wZXJhdGlvbnNMaXN0ZW5lciA9IChvKT0+XG4gICAgICAgIEBhcHBsaWVkX29wZXJhdGlvbnMucHVzaCBvXG4gICAgICBAZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggYXBwbGllZE9wZXJhdGlvbnNMaXN0ZW5lclxuICAgICAgaWYgbm90ICh1c2VyX2xpc3Q/Lmxlbmd0aCBpcyAwKVxuICAgICAgICBAZW5naW5lLmFwcGx5T3BzIHVzZXJfbGlzdFswXS5nZXRIaXN0b3J5QnVmZmVyKCkuX2VuY29kZSgpXG5cbiAgICAgIEB1bmV4ZWN1dGVkID0ge31cblxuICAgICNcbiAgICAjIFRoaXMgZW5naW5lIGFwcGxpZWQgb3BlcmF0aW9ucyBpbiBhIHNwZWNpZmljIG9yZGVyLlxuICAgICMgR2V0IHRoZSBvcHMgaW4gdGhlIHJpZ2h0IG9yZGVyLlxuICAgICNcbiAgICBnZXRPcHNJbkV4ZWN1dGlvbk9yZGVyOiAoKS0+XG4gICAgICBAYXBwbGllZF9vcGVyYXRpb25zXG5cbiAgICAjXG4gICAgIyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aGVuZXZlciBhbiBvcGVyYXRpb24gd2FzIGV4ZWN1dGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG8gVGhlIG9wZXJhdGlvbiB0aGF0IHdhcyBleGVjdXRlZC5cbiAgICAjXG4gICAgc2VuZDogKG8pLT5cbiAgICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEBIQi5nZXRVc2VySWQoKSkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgICAgZm9yIHVzZXIgaW4gdXNlcl9saXN0XG4gICAgICAgICAgaWYgdXNlci5nZXRVc2VySWQoKSBpc250IEBIQi5nZXRVc2VySWQoKVxuICAgICAgICAgICAgdXNlci5nZXRDb25uZWN0b3IoKS5yZWNlaXZlKG8pXG5cbiAgICAjXG4gICAgIyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aGVuZXZlciBhbiBvcGVyYXRpb24gd2FzIHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG8gVGhlIG9wZXJhdGlvbiB0aGF0IHdhcyByZWNlaXZlZC5cbiAgICAjXG4gICAgcmVjZWl2ZTogKG8pLT5cbiAgICAgIEB1bmV4ZWN1dGVkW28udWlkLmNyZWF0b3JdID89IFtdXG4gICAgICBAdW5leGVjdXRlZFtvLnVpZC5jcmVhdG9yXS5wdXNoIG9cblxuICAgICNcbiAgICAjIEZsdXNoIG9uZSBvcGVyYXRpb24gZnJvbSB0aGUgbGluZSBvZiBhIHNwZWNpZmljIHVzZXIuXG4gICAgI1xuICAgIGZsdXNoT25lOiAodXNlciktPlxuICAgICAgaWYgQHVuZXhlY3V0ZWRbdXNlcl0/Lmxlbmd0aCA+IDBcbiAgICAgICAgQGVuZ2luZS5hcHBseU9wIEB1bmV4ZWN1dGVkW3VzZXJdLnNoaWZ0KClcblxuICAgICNcbiAgICAjIEZsdXNoIG9uZSBvcGVyYXRpb24gb24gYSByYW5kb20gbGluZS5cbiAgICAjXG4gICAgZmx1c2hPbmVSYW5kb206ICgpLT5cbiAgICAgIEBmbHVzaE9uZSAoXy5yYW5kb20gMCwgKHVzZXJfbGlzdC5sZW5ndGgtMSkpXG5cbiAgICAjXG4gICAgIyBGbHVzaCBhbGwgb3BlcmF0aW9ucyBvbiBldmVyeSBsaW5lLlxuICAgICNcbiAgICBmbHVzaEFsbDogKCktPlxuICAgICAgZm9yIG4sb3BzIG9mIEB1bmV4ZWN1dGVkXG4gICAgICAgIEBlbmdpbmUuYXBwbHlPcHMgb3BzXG4gICAgICBAdW5leGVjdXRlZCA9IHt9XG5cbiIsIlxyXG4jXHJcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cclxuI1xyXG5jbGFzcyBFbmdpbmVcclxuXHJcbiAgI1xyXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxyXG4gICMgQHBhcmFtIHtBcnJheX0gcGFyc2VyIERlZmluZXMgaG93IHRvIHBhcnNlIGVuY29kZWQgbWVzc2FnZXMuXHJcbiAgI1xyXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAcGFyc2VyKS0+XHJcbiAgICBAdW5wcm9jZXNzZWRfb3BzID0gW11cclxuXHJcbiAgI1xyXG4gICMgUGFyc2VzIGFuIG9wZXJhdGlvIGZyb20gdGhlIGpzb24gZm9ybWF0LiBJdCB1c2VzIHRoZSBzcGVjaWZpZWQgcGFyc2VyIGluIHlvdXIgT3BlcmF0aW9uVHlwZSBtb2R1bGUuXHJcbiAgI1xyXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxyXG4gICAgdHlwZVBhcnNlciA9IEBwYXJzZXJbanNvbi50eXBlXVxyXG4gICAgaWYgdHlwZVBhcnNlcj9cclxuICAgICAgdHlwZVBhcnNlciBqc29uXHJcbiAgICBlbHNlXHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLl9lbmNvZGUoKS5cclxuICAjIEBub3RlIFlvdSBtdXN0IG5vdCB1c2UgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYWxyZWFkeSBoYXZlIG9wcyBpbiB5b3VyIEhCIVxyXG4gICNcclxuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XHJcbiAgICBvcHMgPSBbXVxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cclxuICAgIGZvciBvIGluIG9wc1xyXG4gICAgICBASEIuYWRkT3BlcmF0aW9uIG9cclxuICAgIGZvciBvIGluIG9wc1xyXG4gICAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xyXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcclxuXHJcbiAgI1xyXG4gICMgU2FtZSBhcyBhcHBseU9wcyBidXQgb3BlcmF0aW9ucyB0aGF0IGFyZSBhbHJlYWR5IGluIHRoZSBIQiBhcmUgbm90IGFwcGxpZWQuXHJcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xyXG4gICNcclxuICBhcHBseU9wc0NoZWNrRG91YmxlOiAob3BzX2pzb24pLT5cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIGlmIG5vdCBASEIuZ2V0T3BlcmF0aW9uKG8udWlkKT9cclxuICAgICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIChIZWxwZXIgZm9yIHVzaW5nIGFwcGx5T3Agb24gQXJyYXlzKVxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxyXG4gIGFwcGx5T3BzOiAob3BzX2pzb24pLT5cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIEBhcHBseU9wIG9cclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxyXG4gICNcclxuICBhcHBseU9wOiAob3BfanNvbiktPlxyXG4gICAgIyAkcGFyc2VfYW5kX2V4ZWN1dGUgd2lsbCByZXR1cm4gZmFsc2UgaWYgJG9fanNvbiB3YXMgcGFyc2VkIGFuZCBleGVjdXRlZCwgb3RoZXJ3aXNlIHRoZSBwYXJzZWQgb3BlcmFkaW9uXHJcbiAgICBvID0gQHBhcnNlT3BlcmF0aW9uIG9wX2pzb25cclxuICAgIEBIQi5hZGRUb0NvdW50ZXIgb1xyXG4gICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cclxuICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxyXG4gICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xyXG4gICAgZWxzZVxyXG4gICAgICBASEIuYWRkT3BlcmF0aW9uIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIENhbGwgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYXBwbGllZCBhIG5ldyBvcGVyYXRpb24uXHJcbiAgIyBJdCBjaGVja3MgaWYgb3BlcmF0aW9ucyB0aGF0IHdlcmUgcHJldmlvdXNseSBub3QgZXhlY3V0YWJsZSBhcmUgbm93IGV4ZWN1dGFibGUuXHJcbiAgI1xyXG4gIHRyeVVucHJvY2Vzc2VkOiAoKS0+XHJcbiAgICB3aGlsZSB0cnVlXHJcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxyXG4gICAgICB1bnByb2Nlc3NlZCA9IFtdXHJcbiAgICAgIGZvciBvcCBpbiBAdW5wcm9jZXNzZWRfb3BzXHJcbiAgICAgICAgaWYgbm90IG9wLmV4ZWN1dGUoKVxyXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIEBIQi5hZGRPcGVyYXRpb24gb3BcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXHJcbiAgICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzIG9sZF9sZW5ndGhcclxuICAgICAgICBicmVha1xyXG5cclxuXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuIiwiXG5qc29uX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi4vVHlwZXMvSnNvblR5cGVzXCJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi4vSGlzdG9yeUJ1ZmZlclwiXG5FbmdpbmUgPSByZXF1aXJlIFwiLi4vRW5naW5lXCJcblxuI1xuIyBGcmFtZXdvcmsgZm9yIEpzb24gZGF0YS1zdHJ1Y3R1cmVzLlxuIyBLbm93biB2YWx1ZXMgdGhhdCBhcmUgc3VwcG9ydGVkOlxuIyAqIFN0cmluZ1xuIyAqIEludGVnZXJcbiMgKiBBcnJheVxuI1xuY2xhc3MgSnNvbllhdHRhXG5cbiAgI1xuICAjIEBwYXJhbSB7U3RyaW5nfSB1c2VyX2lkIFVuaXF1ZSBpZCBvZiB0aGUgcGVlci5cbiAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIHRoZSBjb25uZWN0b3IgY2xhc3MuXG4gICNcbiAgY29uc3RydWN0b3I6ICh1c2VyX2lkLCBDb25uZWN0b3IpLT5cbiAgICBASEIgPSBuZXcgSGlzdG9yeUJ1ZmZlciB1c2VyX2lkXG4gICAgdHlwZV9tYW5hZ2VyID0ganNvbl90eXBlc191bmluaXRpYWxpemVkIEBIQlxuICAgIEB0eXBlcyA9IHR5cGVfbWFuYWdlci50eXBlc1xuICAgIEBlbmdpbmUgPSBuZXcgRW5naW5lIEBIQiwgdHlwZV9tYW5hZ2VyLnBhcnNlclxuICAgIEBjb25uZWN0b3IgPSBuZXcgQ29ubmVjdG9yIEBlbmdpbmUsIEBIQiwgdHlwZV9tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lciwgQFxuXG4gICAgZmlyc3Rfd29yZCA9IG5ldyBAdHlwZXMuSnNvblR5cGUgQEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpXG4gICAgQEhCLmFkZE9wZXJhdGlvbihmaXJzdF93b3JkKS5leGVjdXRlKClcbiAgICBAcm9vdF9lbGVtZW50ID0gZmlyc3Rfd29yZFxuXG4gICNcbiAgIyBAcmVzdWx0IEpzb25UeXBlXG4gICNcbiAgZ2V0U2hhcmVkT2JqZWN0OiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudFxuXG4gICNcbiAgIyBAc2VlIEVuZ2luZVxuICAjXG4gIGdldEVuZ2luZTogKCktPlxuICAgIEBlbmdpbmVcblxuICAjXG4gICMgR2V0IHRoZSBpbml0aWFsaXplZCBjb25uZWN0b3IuXG4gICNcbiAgZ2V0Q29ubmVjdG9yOiAoKS0+XG4gICAgQGNvbm5lY3RvclxuXG4gICNcbiAgIyBAc2VlIEhpc3RvcnlCdWZmZXJcbiAgI1xuICBnZXRIaXN0b3J5QnVmZmVyOiAoKS0+XG4gICAgQEhCXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUuc2V0TXV0YWJsZURlZmF1bHRcbiAgI1xuICBzZXRNdXRhYmxlRGVmYXVsdDogKG11dGFibGUpLT5cbiAgICBAcm9vdF9lbGVtZW50LnNldE11dGFibGVEZWZhdWx0KG11dGFibGUpXG5cbiAgI1xuICAjIEdldCB0aGUgVXNlcklkIGZyb20gdGhlIEhpc3RvcnlCdWZmZXIgb2JqZWN0LlxuICAjIEluIG1vc3QgY2FzZXMgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzIHRoZSB1c2VyX2lkIHZhbHVlIHdpdGggd2hpY2hcbiAgIyBKc29uWWF0dGEgd2FzIGluaXRpYWxpemVkIChEZXBlbmRpbmcgb24gdGhlIEhpc3RvcnlCdWZmZXIgaW1wbGVtZW50YXRpb24pLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEBIQi5nZXRVc2VySWQoKVxuXG4gICNcbiAgIyBAc2VlIEpzb25UeXBlLnRvSnNvblxuICAjXG4gIHRvSnNvbiA6ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50LnRvSnNvbigpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsXG4gICNcbiAgdmFsIDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICBAcm9vdF9lbGVtZW50LnZhbChuYW1lLCBjb250ZW50LCBtdXRhYmxlKVxuXG4gIG9uOiAoKS0+XG4gICAgQHJvb3RfZWxlbWVudC5vbiBhcmd1bWVudHMuLi5cblxuICAjXG4gICMgQHNlZSBKc29uVHlwZS52YWx1ZVxuICAjXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBKc29uWWF0dGEucHJvdG90eXBlLCAndmFsdWUnLFxuICAgIGdldCA6IC0+IEByb290X2VsZW1lbnQudmFsdWVcbiAgICBzZXQgOiAobyktPlxuICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICBmb3Igb19uYW1lLG9fb2JqIG9mIG9cbiAgICAgICAgICBAdmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBvbmx5IHNldCBPYmplY3QgdmFsdWVzIVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSnNvbllhdHRhXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLkpzb25ZYXR0YSA9IEpzb25ZYXR0YVxuIiwiXG50ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi4vVHlwZXMvVGV4dFR5cGVzXCJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi4vSGlzdG9yeUJ1ZmZlclwiXG5FbmdpbmUgPSByZXF1aXJlIFwiLi4vRW5naW5lXCJcblxuI1xuIyBGcmFtZXdvcmsgZm9yIFRleHQgRGF0YXN0cnVjdHVyZXMuXG4jXG5jbGFzcyBUZXh0WWF0dGFcblxuICAjXG4gICMgQHBhcmFtIHtTdHJpbmd9IHVzZXJfaWQgVW5pcWUgdXNlciBpZCB0aGF0IGRlZmluZXMgdGhpcyBwZWVyLlxuICAjIEBwYXJhbSB7Q29ubmVjdG9yfSBDb25uZWN0b3IgVGhlIGNvbm5lY3RvciBkZWZpbmVzIGhvdyB5b3UgY29ubmVjdCB0byB0aGUgb3RoZXIgcGVlcnMuXG4gICNcbiAgY29uc3RydWN0b3I6ICh1c2VyX2lkLCBDb25uZWN0b3IpLT5cbiAgICBASEIgPSBuZXcgSGlzdG9yeUJ1ZmZlciB1c2VyX2lkXG4gICAgdGV4dF90eXBlcyA9IHRleHRfdHlwZXNfdW5pbml0aWFsaXplZCBASEJcbiAgICBAdHlwZXMgPSB0ZXh0X3R5cGVzLnR5cGVzXG4gICAgQGVuZ2luZSA9IG5ldyBFbmdpbmUgQEhCLCB0ZXh0X3R5cGVzLnBhcnNlclxuICAgIEBjb25uZWN0b3IgPSBuZXcgQ29ubmVjdG9yIEBlbmdpbmUsIEBIQiwgdGV4dF90eXBlcy5leGVjdXRpb25fbGlzdGVuZXIsIEBcblxuICAgIGJlZ2lubmluZyA9IEBIQi5hZGRPcGVyYXRpb24gbmV3IEB0eXBlcy5EZWxpbWl0ZXIge2NyZWF0b3I6ICdfJywgb3BfbnVtYmVyOiAnX2JlZ2lubmluZyd9ICwgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICBlbmQgPSAgICAgICBASEIuYWRkT3BlcmF0aW9uIG5ldyBAdHlwZXMuRGVsaW1pdGVyIHtjcmVhdG9yOiAnXycsIG9wX251bWJlcjogJ19lbmQnfSAgICAgICAsIGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgYmVnaW5uaW5nLm5leHRfY2wgPSBlbmRcbiAgICBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgZW5kLmV4ZWN1dGUoKVxuICAgIGZpcnN0X3dvcmQgPSBuZXcgQHR5cGVzLldvcmQge2NyZWF0b3I6ICdfJywgb3BfbnVtYmVyOiAnXyd9LCBiZWdpbm5pbmcsIGVuZFxuICAgIEBIQi5hZGRPcGVyYXRpb24oZmlyc3Rfd29yZCkuZXhlY3V0ZSgpXG5cbiAgICB1aWRfciA9IHsgY3JlYXRvcjogJ18nLCBvcF9udW1iZXI6IFwiUk1cIiB9XG4gICAgdWlkX2JlZyA9IHsgY3JlYXRvcjogJ18nLCBvcF9udW1iZXI6IFwiX1JNX2JlZ2lubmluZ1wiIH1cbiAgICB1aWRfZW5kID0geyBjcmVhdG9yOiAnXycsIG9wX251bWJlcjogXCJfUk1fZW5kXCIgfVxuICAgIGJlZyA9IEBIQi5hZGRPcGVyYXRpb24obmV3IEB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICBlbmQgPSBASEIuYWRkT3BlcmF0aW9uKG5ldyBAdHlwZXMuRGVsaW1pdGVyIHVpZF9lbmQsIGJlZywgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICBAcm9vdF9lbGVtZW50ID0gQEhCLmFkZE9wZXJhdGlvbihuZXcgQHR5cGVzLlJlcGxhY2VNYW5hZ2VyIHVuZGVmaW5lZCwgdWlkX3IsIGJlZywgZW5kKS5leGVjdXRlKClcbiAgICBAcm9vdF9lbGVtZW50LnJlcGxhY2UgZmlyc3Rfd29yZCwgeyBjcmVhdG9yOiAnXycsIG9wX251bWJlcjogJ1JlcGxhY2VhYmxlJ31cblxuXG4gICNcbiAgIyBAcmVzdWx0IFdvcmRcbiAgI1xuICBnZXRTaGFyZWRPYmplY3Q6ICgpLT5cbiAgICBAcm9vdF9lbGVtZW50LnZhbCgpXG5cbiAgI1xuICAjIEBzZWUgRW5naW5lXG4gICNcbiAgZ2V0RW5naW5lOiAoKS0+XG4gICAgQGVuZ2luZVxuXG4gICNcbiAgIyBHZXQgdGhlIGluaXRpYWxpemVkIGNvbm5lY3Rvci5cbiAgI1xuICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICBAY29ubmVjdG9yXG5cbiAgI1xuICAjIEBzZWUgSGlzdG9yeUJ1ZmZlclxuICAjXG4gIGdldEhpc3RvcnlCdWZmZXI6ICgpLT5cbiAgICBASEJcblxuICAjXG4gICMgR2V0IHRoZSBVc2VySWQgZnJvbSB0aGUgSGlzdG9yeUJ1ZmZlciBvYmplY3QuXG4gICMgSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXMgdGhlIHVzZXJfaWQgdmFsdWUgd2l0aCB3aGljaFxuICAjIEpzb25ZYXR0YSB3YXMgaW5pdGlhbGl6ZWQgKERlcGVuZGluZyBvbiB0aGUgSGlzdG9yeUJ1ZmZlciBpbXBsZW1lbnRhdGlvbikuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQEhCLmdldFVzZXJJZCgpXG5cbiAgI1xuICAjIEBzZWUgSnNvblR5cGUudmFsXG4gICNcbiAgdmFsOiAoKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLnZhbCgpXG5cbiAgI1xuICAjIEBzZWUgV29yZC5pbnNlcnRUZXh0XG4gICNcbiAgaW5zZXJ0VGV4dDogKHBvcywgY29udGVudCktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS5pbnNlcnRUZXh0IHBvcywgY29udGVudFxuXG4gICNcbiAgIyBAc2VlIFdvcmQuZGVsZXRlVGV4dFxuICAjXG4gIGRlbGV0ZVRleHQ6IChwb3MsIGxlbmd0aCktPlxuICAgIEBnZXRTaGFyZWRPYmplY3QoKS5kZWxldGVUZXh0IHBvcywgbGVuZ3RoXG5cbiAgI1xuICAjIEBzZWUgV29yZC5iaW5kXG4gICNcbiAgYmluZDogKHRleHRhcmVhKS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLmJpbmQgdGV4dGFyZWFcblxuICAjXG4gICMgQHNlZSBXb3JkLnJlcGxhY2VUZXh0XG4gICNcbiAgcmVwbGFjZVRleHQ6ICh0ZXh0KS0+XG4gICAgQGdldFNoYXJlZE9iamVjdCgpLnJlcGxhY2VUZXh0IHRleHRcblxuICBvbjogKCktPlxuICAgIEByb290X2VsZW1lbnQub24gYXJndW1lbnRzLi4uXG5cblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0WWF0dGFcbmlmIHdpbmRvdz9cbiAgaWYgbm90IHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZID0ge31cbiAgd2luZG93LlkuVGV4dFlhdHRhID0gVGV4dFlhdHRhXG4iLCJcbiNcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuXG4gICNcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQHVzZXJfaWRcblxuICAjXG4gICMgVGhlcmUgaXMgb25seSBvbmUgcmVzZXJ2ZWQgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCksIHNvIHVzZSBpdCB3aXNlbHkuXG4gICMgSSBwcm9wb3NlIHRvIHVzZSBpdCBpbiB5b3VyIEZyYW1ld29yaywgdG8gY3JlYXRlIHNvbWV0aGluZyBsaWtlIGEgcm9vdCBlbGVtZW50LlxuICAjIEFuIG9wZXJhdGlvbiB3aXRoIHRoaXMgaWRlbnRpZmllciBpcyBub3QgcHJvcGFnYXRlZCB0byBvdGhlciBjbGllbnRzLlxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cbiAgI1xuICBnZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXI6ICgpLT5cbiAgICB7XG4gICAgICBjcmVhdG9yIDogJ18nXG4gICAgICBvcF9udW1iZXIgOiAnXydcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICgpLT5cbiAgICByZXMgPSB7fVxuICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgIHJlc1t1c2VyXSA9IGN0blxuICAgIHJlc1xuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cbiAgICBqc29uID0gW11cbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZGFoIVwiXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcblxuICAgIGZvciB1X25hbWUsdXNlciBvZiBAYnVmZmVyXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3QgaXNOYU4ocGFyc2VJbnQob19udW1iZXIpKSkgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD9cbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC5jcmVhdG9yLCBvX25leHQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD9cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fbmV4dC5jcmVhdG9yLCBvX25leHQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxuICAgIGlmIHVpZCBpbnN0YW5jZW9mIE9iamVjdFxuICAgICAgQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgZWxzZSBpZiBub3QgdWlkP1xuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgdHlwZSBvZiB1aWQgaXMgbm90IGRlZmluZWQhXCJcbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLmNyZWF0b3JdID0ge31cbiAgICBpZiBAYnVmZmVyW28uY3JlYXRvcl1bby5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgQGJ1ZmZlcltvLmNyZWF0b3JdW28ub3BfbnVtYmVyXSA9IG9cbiAgICBvXG5cbiAgI1xuICAjIEluY3JlbWVudCB0aGUgb3BlcmF0aW9uX2NvdW50ZXIgdGhhdCBkZWZpbmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBFbmdpbmUuXG4gICNcbiAgYWRkVG9Db3VudGVyOiAobyktPlxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdID0gMFxuICAgIGlmIHR5cGVvZiBvLm9wX251bWJlciBpcyAnbnVtYmVyJyBhbmQgby5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby5jcmVhdG9yXSsrXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLmNyZWF0b3JdIGlzbnQgKG8ub3BfbnVtYmVyICsgMSlcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28uY3JlYXRvcl0gLSAoby5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICBwYXJzZXIgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wZXJhdGlvbnMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci5cbiAgI1xuICBjbGFzcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgaWYgbm90IHVpZD9cbiAgICAgICAgdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAge1xuICAgICAgICAnY3JlYXRvcic6IEBjcmVhdG9yXG4gICAgICAgICdvcF9udW1iZXInIDogQG9wX251bWJlclxuICAgICAgfSA9IHVpZFxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gZXZlbnQgTmFtZSBvZiB0aGUgZXZlbnQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9uOiAoZXZlbnRzLCBmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID89IHt9XG4gICAgICBpZiBldmVudHMuY29uc3RydWN0b3IgaXNudCBbXS5jb25zdHJ1Y3RvclxuICAgICAgICBldmVudHMgPSBbZXZlbnRzXVxuICAgICAgZm9yIGUgaW4gZXZlbnRzXG4gICAgICAgIEBldmVudF9saXN0ZW5lcnNbZV0gPz0gW11cbiAgICAgICAgQGV2ZW50X2xpc3RlbmVyc1tlXS5wdXNoIGZcblxuICAgIGRlbGV0ZUxpc3RlbmVyOiAoZXZlbnRzLCBmKS0+XG4gICAgICBpZiBldmVudHMuY29uc3RydWN0b3IgaXNudCBbXS5jb25zdHJ1Y3RvclxuICAgICAgICBldmVudHMgPSBbZXZlbnRzXVxuICAgICAgZm9yIGUgaW4gZXZlbnRzXG4gICAgICAgIGlmIEBldmVudF9saXN0ZW5lcnM/W2VdP1xuICAgICAgICAgIEBldmVudF9saXN0ZW5lcnNbZV0gPSBAZXZlbnRfbGlzdGVuZXJzW2VdLmZpbHRlciAoZyktPlxuICAgICAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjXG4gICAgY2FsbEV2ZW50OiAoZXZlbnQsIGFyZ3MuLi4pLT5cbiAgICAgIGlmIEBldmVudF9saXN0ZW5lcnM/W2V2ZW50XT9cbiAgICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1tldmVudF1cbiAgICAgICAgICBmLmNhbGwgQCwgZXZlbnQsIGFyZ3MuLi5cblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChAcGFyZW50KS0+XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcGFyZW50XG5cbiAgICAjXG4gICAgIyBDb21wdXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpIHRoYXQgaWRlbnRpZmllcyB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0VWlkOiAoKS0+XG4gICAgICB7ICdjcmVhdG9yJzogQGNyZWF0b3IsICdvcF9udW1iZXInOiBAb3BfbnVtYmVyIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBAaXNfZXhlY3V0ZWQgPSB0cnVlXG4gICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcbiAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgT3BlcmF0aW9ucyBtYXkgZGVwZW5kIG9uIG90aGVyIG9wZXJhdGlvbnMgKGxpbmtlZCBsaXN0cywgZXRjLikuXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXG4gICAgIyBhbiBlYXN5IHdheSB0byByZWZlciB0byB0aGVzZSBvcGVyYXRpb25zIHZpYSBhbiB1aWQgb3Igb2JqZWN0IHJlZmVyZW5jZS5cbiAgICAjXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8pOyAgIG9yXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkby5nZXRVaWQoKSk7XG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcF91aWQpXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R9IG9wX3VpZCBBIHVpZCB0aGF0IHJlZmVycyB0byBhbiBvcGVyYXRpb25cbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPcGVyYXRpb259IG9wIEFuIE9wZXJhdGlvbiBvYmplY3RcbiAgICAjXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wKS0+XG5cbiAgICAgICNcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXG4gICAgICAjIFdlIHVzZSBkdWNrLXR5cGluZyB0byBjaGVjayBpZiBvcCBpcyBpbnN0YW50aWF0ZWQgc2luY2UgdGhlcmVcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXG4gICAgICAjXG4gICAgICBpZiBvcD8uZXhlY3V0ZT9cbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWRcbiAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICBlbHNlIGlmIG9wP1xuICAgICAgICAjIG5vdCBpbml0aWFsaXplZC4gRG8gaXQgd2hlbiBjYWxsaW5nICR2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtuYW1lXSA9IG9wXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxuICAgICMgQHNlZSBPcGVyYXRpb24uc2F2ZU9wZXJhdGlvblxuICAgICNcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxuICAgICNcbiAgICB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9uczogKCktPlxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxuICAgICAgc3VjY2VzcyA9IEBcbiAgICAgIGZvciBuYW1lLCBvcF91aWQgb2YgQHVuY2hlY2tlZFxuICAgICAgICBvcCA9IEhCLmdldE9wZXJhdGlvbiBvcF91aWRcbiAgICAgICAgaWYgb3BcbiAgICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuaW5zdGFudGlhdGVkW25hbWVdID0gb3BfdWlkXG4gICAgICAgICAgc3VjY2VzcyA9IGZhbHNlXG4gICAgICBkZWxldGUgQHVuY2hlY2tlZFxuICAgICAgaWYgbm90IHN1Y2Nlc3NcbiAgICAgICAgQHVuY2hlY2tlZCA9IHVuaW5zdGFudGlhdGVkXG4gICAgICBzdWNjZXNzXG5cblxuXG4gICNcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIEluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyBEZWxldGUgZXh0ZW5kcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgI1xuICAjIERlZmluZSBob3cgdG8gcGFyc2UgRGVsZXRlIG9wZXJhdGlvbnMuXG4gICNcbiAgcGFyc2VyWydEZWxldGUnXSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyBEZWxldGUgdWlkLCBkZWxldGVzX3VpZFxuXG4gICNcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcbiAgI1xuICBjbGFzcyBJbnNlcnQgZXh0ZW5kcyBPcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBAZGVsZXRlZF9ieS5sZW5ndGggaXMgMVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnQgXCJkZWxldGVcIiwgQFxuXG4gICAgI1xuICAgICMgSWYgaXNEZWxldGVkKCkgaXMgdHJ1ZSB0aGlzIG9wZXJhdGlvbiB3b24ndCBiZSBtYWludGFpbmVkIGluIHRoZSBzbFxuICAgICNcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIEBkZWxldGVkX2J5Py5sZW5ndGggPiAwXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgI1RPRE86IGRlbGV0ZSB0aGlzXG4gICAgICAgIGlmIEAgaXMgQHByZXZfY2xcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHNob3VsZCBub3QgaGFwcGVuIDspIFwiXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBVcGRhdGUgdGhlIHNob3J0IGxpc3RcbiAgICAjIFRPRE8gKFVudXNlZClcbiAgICB1cGRhdGVfc2w6ICgpLT5cbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgdXBkYXRlOiAoZGVzdF9jbCxkZXN0X3NsKS0+XG4gICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICBpZiBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBvID0gb1tkZXN0X2NsXVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIEBbZGVzdF9zbF0gPSBvXG5cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICB1cGRhdGUgXCJwcmV2X2NsXCIsIFwicHJldl9zbFwiXG4gICAgICB1cGRhdGUgXCJuZXh0X2NsXCIsIFwicHJldl9zbFwiXG5cblxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAaXNfZXhlY3V0ZWQ/XG4gICAgICAgIHJldHVybiBAXG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBwcmV2X2NsPy52YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpIGFuZCBAbmV4dF9jbD8udmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKSBhbmQgQHByZXZfY2wubmV4dF9jbCBpc250IEBcbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSAwXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBpID0gMFxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBub3Qgbz9cbiAgICAgICAgICAgICAgIyBUT0RPOiBEZWJ1Z2dpbmdcbiAgICAgICAgICAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkgQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkgQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLmNyZWF0b3IgPCBAY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuICAgICAgICBwYXJlbnQgPSBAcHJldl9jbD8uZ2V0UGFyZW50KClcbiAgICAgICAgaWYgcGFyZW50P1xuICAgICAgICAgIEBzZXRQYXJlbnQgcGFyZW50XG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnQgXCJpbnNlcnRcIiwgQFxuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2YgRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcHJldi5pc0RlbGV0ZWQ/IGFuZCBub3QgcHJldi5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uKytcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxuICAgICAgcG9zaXRpb25cbiAgI1xuICAjIERlZmluZXMgYW4gb2JqZWN0IHRoYXQgaXMgY2Fubm90IGJlIGNoYW5nZWQuIFlvdSBjYW4gdXNlIHRoaXMgdG8gc2V0IGFuIGltbXV0YWJsZSBzdHJpbmcsIG9yIGEgbnVtYmVyLlxuICAjXG4gIGNsYXNzIEltbXV0YWJsZU9iamVjdCBleHRlbmRzIEluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGNvbnRlbnRcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIEBjb250ZW50LCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtTdHJpbmddIFRoZSBjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICB2YWwgOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIkltbXV0YWJsZU9iamVjdFwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdjb250ZW50JyA6IEBjb250ZW50XG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnSW1tdXRhYmxlT2JqZWN0J10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBJbW11dGFibGVPYmplY3QgdWlkLCBjb250ZW50LCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyBEZWxpbWl0ZXIgZXh0ZW5kcyBPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICAjXG4gICAgIyBJZiBpc0RlbGV0ZWQoKSBpcyB0cnVlIHRoaXMgb3BlcmF0aW9uIHdvbid0IGJlIG1haW50YWluZWQgaW4gdGhlIHNsXG4gICAgI1xuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgZmFsc2VcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEB1bmNoZWNrZWQ/WydwcmV2X2NsJ11cbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUHJvYmFibHkgZHVwbGljYXRlZCBvcGVyYXRpb25zXCJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICAgIHN1cGVyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBmYWxzZVxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IG9yIEBuZXh0X2NsP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJEZWxpbWl0ZXJcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgcGFyc2VyWydEZWxpbWl0ZXInXSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyBEZWxpbWl0ZXIgdWlkLCBwcmV2LCBuZXh0XG5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxuICB7XG4gICAgJ3R5cGVzJyA6XG4gICAgICAnRGVsZXRlJyA6IERlbGV0ZVxuICAgICAgJ0luc2VydCcgOiBJbnNlcnRcbiAgICAgICdEZWxpbWl0ZXInOiBEZWxpbWl0ZXJcbiAgICAgICdPcGVyYXRpb24nOiBPcGVyYXRpb25cbiAgICAgICdJbW11dGFibGVPYmplY3QnIDogSW1tdXRhYmxlT2JqZWN0XG4gICAgJ3BhcnNlcicgOiBwYXJzZXJcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsInRleHRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1RleHRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSB0ZXh0X3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHRleHRfdHlwZXMucGFyc2VyXG5cbiAgY3JlYXRlSnNvbldyYXBwZXIgPSAoX2pzb25UeXBlKS0+XG5cbiAgICAjXG4gICAgIyBBIEpzb25XcmFwcGVyIHdhcyBpbnRlbmRlZCB0byBiZSBhIGNvbnZlbmllbnQgd3JhcHBlciBmb3IgdGhlIEpzb25UeXBlLlxuICAgICMgQnV0IGl0IGNhbiBtYWtlIHRoaW5ncyBtb3JlIGRpZmZpY3VsdCB0aGFuIHRoZXkgYXJlLlxuICAgICMgQHNlZSBKc29uVHlwZVxuICAgICNcbiAgICAjIEBleGFtcGxlIGNyZWF0ZSBhIEpzb25XcmFwcGVyXG4gICAgIyAgICMgWW91IGdldCBhIEpzb25XcmFwcGVyIGZyb20gYSBKc29uVHlwZSBieSBjYWxsaW5nXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICNcbiAgICAjIEl0IGNyZWF0ZXMgSmF2YXNjcmlwdHMgLWdldHRlciBhbmQgLXNldHRlciBtZXRob2RzIGZvciBlYWNoIHByb3BlcnR5IHRoYXQgSnNvblR5cGUgbWFpbnRhaW5zLlxuICAgICMgQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvZGVmaW5lUHJvcGVydHlcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBHZXR0ZXIgRXhhbXBsZVxuICAgICMgICAjIHlvdSBjYW4gYWNjZXNzIHRoZSB4IHByb3BlcnR5IG9mIHlhdHRhIGJ5IGNhbGxpbmdcbiAgICAjICAgdy54XG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnKVxuICAgICNcbiAgICAjIEBub3RlIFlvdSBjYW4gb25seSBvdmVyd3JpdGUgZXhpc3RpbmcgdmFsdWVzISBTZXR0aW5nIGEgbmV3IHByb3BlcnR5IHdvbid0IGhhdmUgYW55IGVmZmVjdCFcbiAgICAjXG4gICAgIyBAZXhhbXBsZSBTZXR0ZXIgRXhhbXBsZVxuICAgICMgICAjIHlvdSBjYW4gc2V0IGFuIGV4aXN0aW5nIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnggPSBcInRleHRcIlxuICAgICMgICAjIGluc3RlYWQgb2ZcbiAgICAjICAgeWF0dGEudmFsKCd4JywgXCJ0ZXh0XCIpXG4gICAgI1xuICAgICMgSW4gb3JkZXIgdG8gc2V0IGEgbmV3IHByb3BlcnR5IHlvdSBoYXZlIHRvIG92ZXJ3cml0ZSBhbiBleGlzdGluZyBwcm9wZXJ0eS5cbiAgICAjIFRoZXJlZm9yZSB0aGUgSnNvbldyYXBwZXIgc3VwcG9ydHMgYSBzcGVjaWFsIGZlYXR1cmUgdGhhdCBzaG91bGQgbWFrZSB0aGluZ3MgbW9yZSBjb252ZW5pZW50XG4gICAgIyAod2UgY2FuIGFyZ3VlIGFib3V0IHRoYXQsIHVzZSB0aGUgSnNvblR5cGUgaWYgeW91IGRvbid0IGxpa2UgaXQgOykuXG4gICAgIyBJZiB5b3Ugb3ZlcndyaXRlIGFuIG9iamVjdCBwcm9wZXJ0eSBvZiB0aGUgSnNvbldyYXBwZXIgd2l0aCBhIG5ldyBvYmplY3QsIGl0IHdpbGwgcmVzdWx0IGluIGEgbWVyZ2VkIHZlcnNpb24gb2YgdGhlIG9iamVjdHMuXG4gICAgIyBMZXQgdy5wIHRoZSBwcm9wZXJ0eSB0aGF0IGlzIHRvIGJlIG92ZXJ3cml0dGVuIGFuZCBvIHRoZSBuZXcgdmFsdWUuIEUuZy4gdy5wID0gb1xuICAgICMgKiBUaGUgcmVzdWx0IGhhcyBhbGwgcHJvcGVydGllcyBvZiBvXG4gICAgIyAqIFRoZSByZXN1bHQgaGFzIGFsbCBwcm9wZXJ0aWVzIG9mIHcucCBpZiB0aGV5IGRvbid0IG9jY3VyIHVuZGVyIHRoZSBzYW1lIHByb3BlcnR5LW5hbWUgaW4gby5cbiAgICAjXG4gICAgIyBAZXhhbXBsZSBDb25mbGljdCBFeGFtcGxlXG4gICAgIyAgIHlhdHRhLnZhbHVlID0ge2EgOiBcInN0cmluZ1wifVxuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjICAgY29uc29sZS5sb2codykgIyB7YSA6IFwic3RyaW5nXCJ9XG4gICAgIyAgIHcuYSA9IHthIDoge2IgOiBcInN0cmluZ1wifX1cbiAgICAjICAgY29uc29sZS5sb2codykgIyB7YSA6IHtiIDogXCJTdHJpbmdcIn19XG4gICAgIyAgIHcuYSA9IHthIDoge2MgOiA0fX1cbiAgICAjICAgY29uc29sZS5sb2codykgIyB7YSA6IHtiIDogXCJTdHJpbmdcIiwgYyA6IDR9fVxuICAgICNcbiAgICAjIEBleGFtcGxlIENvbW1vbiBQaXRmYWxsc1xuICAgICMgICB3ID0geWF0dGEudmFsdWVcbiAgICAjICAgIyBTZXR0aW5nIGEgbmV3IHByb3BlcnR5XG4gICAgIyAgIHcubmV3UHJvcGVydHkgPSBcIkF3ZXNvbWVcIlxuICAgICMgICBjb25zb2xlLmxvZyh3Lm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIGZhbHNlLCB3Lm5ld1Byb3BlcnR5IGlzIHVuZGVmaW5lZFxuICAgICMgICAjIG92ZXJ3cml0ZSB0aGUgdyBvYmplY3RcbiAgICAjICAgdyA9IHtuZXdQcm9wZXJ0eSA6IFwiQXdlc29tZVwifVxuICAgICMgICBjb25zb2xlLmxvZyh3Lm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIHRydWUhLCBidXQgLi5cbiAgICAjICAgY29uc29sZS5sb2coeWF0dGEudmFsdWUubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgZmFsc2UsIHlvdSBhcmUgb25seSBhbGxvd2VkIHRvIHNldCBwcm9wZXJ0aWVzIVxuICAgICMgICAjIFRoZSBzb2x1dGlvblxuICAgICMgICB5YXR0YS52YWx1ZSA9IHtuZXdQcm9wZXJ0eSA6IFwiQXdlc29tZVwifVxuICAgICMgICBjb25zb2xlLmxvZyh3Lm5ld1Byb3BlcnR5ID09IFwiQXdlc29tZVwiKSAjIHRydWUhXG4gICAgI1xuICAgIGNsYXNzIEpzb25XcmFwcGVyXG5cbiAgICAgICNcbiAgICAgICMgQHBhcmFtIHtKc29uVHlwZX0ganNvblR5cGUgSW5zdGFuY2Ugb2YgdGhlIEpzb25UeXBlIHRoYXQgdGhpcyBjbGFzcyB3cmFwcGVzLlxuICAgICAgI1xuICAgICAgY29uc3RydWN0b3I6IChqc29uVHlwZSktPlxuICAgICAgICBmb3IgbmFtZSwgb2JqIG9mIGpzb25UeXBlLm1hcFxuICAgICAgICAgIGRvIChuYW1lLCBvYmopLT5cbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBKc29uV3JhcHBlci5wcm90b3R5cGUsIG5hbWUsXG4gICAgICAgICAgICAgIGdldCA6IC0+XG4gICAgICAgICAgICAgICAgeCA9IG9iai52YWwoKVxuICAgICAgICAgICAgICAgIGlmIHggaW5zdGFuY2VvZiBKc29uVHlwZVxuICAgICAgICAgICAgICAgICAgY3JlYXRlSnNvbldyYXBwZXIgeFxuICAgICAgICAgICAgICAgIGVsc2UgaWYgeCBpbnN0YW5jZW9mIHR5cGVzLkltbXV0YWJsZU9iamVjdFxuICAgICAgICAgICAgICAgICAgeC52YWwoKVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIHhcbiAgICAgICAgICAgICAgc2V0IDogKG8pLT5cbiAgICAgICAgICAgICAgICBvdmVyd3JpdGUgPSBqc29uVHlwZS52YWwobmFtZSlcbiAgICAgICAgICAgICAgICBpZiBvLmNvbnN0cnVjdG9yIGlzIHt9LmNvbnN0cnVjdG9yIGFuZCBvdmVyd3JpdGUgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgICAgICAgICAgICBvdmVyd3JpdGUudmFsKG9fbmFtZSwgb19vYmosICdpbW11dGFibGUnKVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIGpzb25UeXBlLnZhbChuYW1lLCBvLCAnaW1tdXRhYmxlJylcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgbmV3IEpzb25XcmFwcGVyIF9qc29uVHlwZVxuXG4gICNcbiAgIyBNYW5hZ2VzIE9iamVjdC1saWtlIHZhbHVlcy5cbiAgI1xuICBjbGFzcyBKc29uVHlwZSBleHRlbmRzIHR5cGVzLk1hcE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsX3ZhbHVlIENyZWF0ZSB0aGlzIG9wZXJhdGlvbiB3aXRoIGFuIGluaXRpYWwgdmFsdWUuXG4gICAgIyBAcGFyYW0ge1N0cmluZ3xCb29sZWFufSBXaGV0aGVyIHRoZSBpbml0aWFsX3ZhbHVlIHNob3VsZCBiZSBjcmVhdGVkIGFzIG11dGFibGUuIChPcHRpb25hbCAtIHNlZSBzZXRNdXRhYmxlRGVmYXVsdClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGluaXRpYWxfdmFsdWUsIG11dGFibGUpLT5cbiAgICAgIHN1cGVyIHVpZFxuICAgICAgaWYgaW5pdGlhbF92YWx1ZT9cbiAgICAgICAgaWYgdHlwZW9mIGluaXRpYWxfdmFsdWUgaXNudCBcIm9iamVjdFwiXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhlIGluaXRpYWwgdmFsdWUgb2YgSnNvblR5cGVzIG11c3QgYmUgb2YgdHlwZSBPYmplY3QhIChjdXJyZW50IHR5cGU6ICN7dHlwZW9mIGluaXRpYWxfdmFsdWV9KVwiXG4gICAgICAgIGZvciBuYW1lLG8gb2YgaW5pdGlhbF92YWx1ZVxuICAgICAgICAgIEB2YWwgbmFtZSwgbywgbXV0YWJsZVxuXG4gICAgI1xuICAgICMgVHJhbnNmb3JtIHRoaXMgdG8gYSBKc29uIGFuZCBsb29zZSBhbGwgdGhlIHNoYXJpbmctYWJpbGl0aWVzICh0aGUgbmV3IG9iamVjdCB3aWxsIGJlIGEgZGVlcCBjbG9uZSkhXG4gICAgIyBAcmV0dXJuIHtKc29ufVxuICAgICNcbiAgICB0b0pzb246ICgpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAganNvbiA9IHt9XG4gICAgICBmb3IgbmFtZSwgbyBvZiB2YWxcbiAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgIGpzb25bbmFtZV0gPSBAdmFsKG5hbWUpLnRvSnNvbigpXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIHdoaWxlIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICAgIG8gPSBvLnZhbCgpXG4gICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICBqc29uXG5cbiAgICAjXG4gICAgIyBXaGV0aGVyIHRoZSBkZWZhdWx0IGlzICdtdXRhYmxlJyAodHJ1ZSkgb3IgJ2ltbXV0YWJsZScgKGZhbHNlKVxuICAgICNcbiAgICBtdXRhYmxlX2RlZmF1bHQ6XG4gICAgICB0cnVlXG5cbiAgICAjXG4gICAgIyBTZXQgaWYgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnIG9yICdpbW11dGFibGUnXG4gICAgIyBAcGFyYW0ge1N0cmluZ3xCb29sZWFufSBtdXRhYmxlIFNldCBlaXRoZXIgJ211dGFibGUnIC8gdHJ1ZSBvciAnaW1tdXRhYmxlJyAvIGZhbHNlXG4gICAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgICBpZiBtdXRhYmxlIGlzIHRydWUgb3IgbXV0YWJsZSBpcyAnbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IHRydWVcbiAgICAgIGVsc2UgaWYgbXV0YWJsZSBpcyBmYWxzZSBvciBtdXRhYmxlIGlzICdpbW11dGFibGUnXG4gICAgICAgIEpzb25UeXBlLnByb3RvdHlwZS5tdXRhYmxlX2RlZmF1bHQgPSBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgJ1NldCBtdXRhYmxlIGVpdGhlciBcIm11dGFibGVcIiBvciBcImltbXV0YWJsZVwiISdcbiAgICAgICdPSydcblxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwoKVxuICAgICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAgICMgICBAcmV0dXJuIFtKc29uXVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGV8V29yZHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICAgIGlmIHR5cGVvZiBuYW1lIGlzICdvYmplY3QnXG4gICAgICAgICMgU3BlY2lhbCBjYXNlLiBGaXJzdCBhcmd1bWVudCBpcyBhbiBvYmplY3QuIFRoZW4gdGhlIHNlY29uZCBhcmcgaXMgbXV0YWJsZS5cbiAgICAgICAgIyBLZWVwIHRoYXQgaW4gbWluZCB3aGVuIHJlYWRpbmcgdGhlIGZvbGxvd2luZy4uXG4gICAgICAgIGZvciBvX25hbWUsbyBvZiBuYW1lXG4gICAgICAgICAgQHZhbChvX25hbWUsbyxjb250ZW50KVxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/IGFuZCBjb250ZW50P1xuICAgICAgICBpZiBtdXRhYmxlP1xuICAgICAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICAgICAgbXV0YWJsZSA9IHRydWVcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBtdXRhYmxlID0gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG11dGFibGUgPSBAbXV0YWJsZV9kZWZhdWx0XG4gICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdmdW5jdGlvbidcbiAgICAgICAgICBAICMgSnVzdCBkbyBub3RoaW5nXG4gICAgICAgIGVsc2UgaWYgKChub3QgbXV0YWJsZSkgb3IgdHlwZW9mIGNvbnRlbnQgaXMgJ251bWJlcicpIGFuZCBjb250ZW50LmNvbnN0cnVjdG9yIGlzbnQgT2JqZWN0XG4gICAgICAgICAgb2JqID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICAgICAgICBzdXBlciBuYW1lLCBvYmpcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdzdHJpbmcnXG4gICAgICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5Xb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgICB3b3JkLmluc2VydFRleHQgMCwgY29udGVudFxuICAgICAgICAgICAgc3VwZXIgbmFtZSwgd29yZFxuICAgICAgICAgIGVsc2UgaWYgY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICAgIGpzb24gPSBIQi5hZGRPcGVyYXRpb24obmV3IEpzb25UeXBlIHVuZGVmaW5lZCwgY29udGVudCwgbXV0YWJsZSkuZXhlY3V0ZSgpXG4gICAgICAgICAgICBzdXBlciBuYW1lLCBqc29uXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCAje3R5cGVvZiBjb250ZW50fS10eXBlcyBpbiBjb2xsYWJvcmF0aXZlIEpzb24tb2JqZWN0cyFcIlxuICAgICAgZWxzZVxuICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvblR5cGUucHJvdG90eXBlLCAndmFsdWUnLFxuICAgICAgZ2V0IDogLT4gY3JlYXRlSnNvbldyYXBwZXIgQFxuICAgICAgc2V0IDogKG8pLT5cbiAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgICAgQHZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG9ubHkgc2V0IE9iamVjdCB2YWx1ZXMhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJKc29uVHlwZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG5cbiAgcGFyc2VyWydKc29uVHlwZSddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IEpzb25UeXBlIHVpZFxuXG5cblxuXG4gIHR5cGVzWydKc29uVHlwZSddID0gSnNvblR5cGVcblxuICB0ZXh0X3R5cGVzXG5cblxuIiwiYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBiYXNpY190eXBlcyA9IGJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBiYXNpY190eXBlcy50eXBlc1xuICBwYXJzZXIgPSBiYXNpY190eXBlcy5wYXJzZXJcblxuICAjXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBzZWUgSnNvblR5cGVzLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBpZiBub3QgQG1hcFtuYW1lXT9cbiAgICAgICAgICBIQi5hZGRPcGVyYXRpb24obmV3IEFkZE5hbWUgdW5kZWZpbmVkLCBALCBuYW1lKS5leGVjdXRlKClcbiAgICAgICAgQG1hcFtuYW1lXS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBvYmogPSBAbWFwW25hbWVdPy52YWwoKVxuICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICBvYmoudmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9ialxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBtYXBcbiAgICAgICAgICBvYmogPSBvLnZhbCgpXG4gICAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0IG9yIG9iaiBpbnN0YW5jZW9mIE1hcE1hbmFnZXJcbiAgICAgICAgICAgIG9iaiA9IG9iai52YWwoKVxuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG9ialxuICAgICAgICByZXN1bHRcblxuICAjXG4gICMgV2hlbiBhIG5ldyBwcm9wZXJ0eSBpbiBhIG1hcCBtYW5hZ2VyIGlzIGNyZWF0ZWQsIHRoZW4gdGhlIHVpZHMgb2YgdGhlIGluc2VydGVkIE9wZXJhdGlvbnNcbiAgIyBtdXN0IGJlIHVuaXF1ZSAodGhpbmsgYWJvdXQgY29uY3VycmVudCBvcGVyYXRpb25zKS4gVGhlcmVmb3JlIG9ubHkgYW4gQWRkTmFtZSBvcGVyYXRpb24gaXMgYWxsb3dlZCB0b1xuICAjIGFkZCBhIHByb3BlcnR5IGluIGEgTWFwTWFuYWdlci4gSWYgdHdvIEFkZE5hbWUgb3BlcmF0aW9ucyBvbiB0aGUgc2FtZSBNYXBNYW5hZ2VyIG5hbWUgaGFwcGVuIGNvbmN1cnJlbnRseVxuICAjIG9ubHkgb25lIHdpbGwgQWRkTmFtZSBvcGVyYXRpb24gd2lsbCBiZSBleGVjdXRlZC5cbiAgI1xuICBjbGFzcyBBZGROYW1lIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gbWFwX21hbmFnZXIgVWlkIG9yIHJlZmVyZW5jZSB0byB0aGUgTWFwTWFuYWdlci5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgd2lsbCBiZSBhZGRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIG1hcF9tYW5hZ2VyLCBAbmFtZSktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ21hcF9tYW5hZ2VyJywgbWFwX21hbmFnZXJcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgbWFwX21hbmFnZXIgZG9lc24ndCBoYXZlIHRoZSBwcm9wZXJ0eSBuYW1lLCB0aGVuIGFkZCBpdC5cbiAgICAjIFRoZSBSZXBsYWNlTWFuYWdlciB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gb24gdGhlIHByb3BlcnR5IGlzIHVuaXF1ZVxuICAgICMgaW4gc3VjaCBhIHdheSB0aGF0IGlmIEFkZE5hbWUgaXMgZXhlY3V0ZWQgKGZyb20gYW5vdGhlciBwZWVyKSBpdCB3aWxsXG4gICAgIyBhbHdheXMgaGF2ZSB0aGUgc2FtZSByZXN1bHQgKFJlcGxhY2VNYW5hZ2VyLCBhbmQgaXRzIGJlZ2lubmluZyBhbmQgZW5kIGFyZSB0aGUgc2FtZSlcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB1aWRfciA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIl8je3VpZF9iZWcub3BfbnVtYmVyfV9STV8je0BuYW1lfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiXyN7dWlkX2VuZC5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2VuZFwiXG4gICAgICAgICAgYmVnID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0gPSBIQi5hZGRPcGVyYXRpb24obmV3IFJlcGxhY2VNYW5hZ2VyIHVuZGVmaW5lZCwgdWlkX3IsIGJlZywgZW5kKVxuICAgICAgICAgIEBtYXBfbWFuYWdlci5tYXBbQG5hbWVdLnNldFBhcmVudCBAbWFwX21hbmFnZXIsIEBuYW1lXG4gICAgICAgICAgQG1hcF9tYW5hZ2VyLm1hcFtAbmFtZV0uZXhlY3V0ZSgpXG4gICAgICAgIEBtYXBfbWFuYWdlci5jYWxsRXZlbnQgJ2FkZFByb3BlcnR5JywgQG5hbWVcbiAgICAgICAgc3VwZXJcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJBZGROYW1lXCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ21hcF9tYW5hZ2VyJyA6IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICAnbmFtZScgOiBAbmFtZVxuICAgICAgfVxuXG4gIHBhcnNlclsnQWRkTmFtZSddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnbWFwX21hbmFnZXInIDogbWFwX21hbmFnZXJcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnbmFtZScgOiBuYW1lXG4gICAgfSA9IGpzb25cbiAgICBuZXcgQWRkTmFtZSB1aWQsIG1hcF9tYW5hZ2VyLCBuYW1lXG5cbiAgI1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3MgTGlzdE1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcblxuICAgICNcbiAgICAjIEEgTGlzdE1hbmFnZXIgbWFpbnRhaW5zIGEgbm9uLWVtcHR5IGxpc3QgdGhhdCBoYXMgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCAoYm90aCBEZWxpbWl0ZXJzISlcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgaWYgYmVnaW5uaW5nPyBhbmQgZW5kP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnYmVnaW5uaW5nJywgYmVnaW5uaW5nXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdlbmQnLCBlbmRcbiAgICAgIGVsc2VcbiAgICAgICAgQGJlZ2lubmluZyA9IEhCLmFkZE9wZXJhdGlvbiBuZXcgdHlwZXMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICAgICAgQGVuZCA9ICAgICAgIEhCLmFkZE9wZXJhdGlvbiBuZXcgdHlwZXMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgICAgQGJlZ2lubmluZy5leGVjdXRlKClcbiAgICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICByZXN1bHQucHVzaCBvXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgaWYgKHBvc2l0aW9uID4gMCBvciBvLmlzRGVsZXRlZCgpKSBhbmQgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgIyBmaW5kIGZpcnN0IG5vbiBkZWxldGVkIG9wXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIHBvc2l0aW9uIC09IDFcbiAgICAgIG9cblxuICAjXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFdvcmRcbiAgI1xuICBjbGFzcyBSZXBsYWNlTWFuYWdlciBleHRlbmRzIExpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGluaXRpYWxfY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAgIGlmIGluaXRpYWxfY29udGVudD9cbiAgICAgICAgQHJlcGxhY2UgaW5pdGlhbF9jb250ZW50XG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgb3AgPSBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2xcbiAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG5cbiAgICAjXG4gICAgIyBBZGQgY2hhbmdlIGxpc3RlbmVycyBmb3IgcGFyZW50LlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChwYXJlbnQsIHByb3BlcnR5X25hbWUpLT5cbiAgICAgIEBvbiAnaW5zZXJ0JywgKGV2ZW50LCBvcCk9PlxuICAgICAgICBpZiBvcC5uZXh0X2NsIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnQgJ2NoYW5nZScsIHByb3BlcnR5X25hbWVcbiAgICAgIEBvbiAnY2hhbmdlJywgKGV2ZW50KT0+XG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50ICdjaGFuZ2UnLCBwcm9wZXJ0eV9uYW1lXG4gICAgICBzdXBlciBwYXJlbnRcbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFxuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICAjaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlTWFuYWdlclwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAbmV4dF9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlTWFuYWdlclwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgfSA9IGpzb25cbiAgICBuZXcgUmVwbGFjZU1hbmFnZXIgY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuICAjXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBSZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8gYW5kIGNvbnRlbnQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgY29udGVudCwgcHJldiwgYW5kIG5leHQgZm9yIFJlcGxhY2VhYmxlLXR5cGVzIVwiXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyByZXBsYWNlYWJsZSB3aXRoIG5ldyBjb250ZW50LlxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCktPlxuICAgICAgQHBhcmVudC5yZXBsYWNlIGNvbnRlbnRcblxuICAgICNcbiAgICAjIElmIHBvc3NpYmxlIHNldCB0aGUgcmVwbGFjZSBtYW5hZ2VyIGluIHRoZSBjb250ZW50LlxuICAgICMgQHNlZSBXb3JkLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQuc2V0UmVwbGFjZU1hbmFnZXI/KEBwYXJlbnQpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlYWJsZVwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudC5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuXG4gIHR5cGVzWydMaXN0TWFuYWdlciddID0gTGlzdE1hbmFnZXJcbiAgdHlwZXNbJ01hcE1hbmFnZXInXSA9IE1hcE1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VNYW5hZ2VyJ10gPSBSZXBsYWNlTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZWFibGUnXSA9IFJlcGxhY2VhYmxlXG5cbiAgYmFzaWNfdHlwZXNcblxuXG5cblxuXG5cbiIsInN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHN0cnVjdHVyZWRfdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHN0cnVjdHVyZWRfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEF0IHRoZSBtb21lbnQgVGV4dERlbGV0ZSB0eXBlIGVxdWFscyB0aGUgRGVsZXRlIHR5cGUgaW4gQmFzaWNUeXBlcy5cbiAgIyBAc2VlIEJhc2ljVHlwZXMuRGVsZXRlXG4gICNcbiAgY2xhc3MgVGV4dERlbGV0ZSBleHRlbmRzIHR5cGVzLkRlbGV0ZVxuICBwYXJzZXJbXCJUZXh0RGVsZXRlXCJdID0gcGFyc2VyW1wiRGVsZXRlXCJdXG5cbiAgI1xuICAjICBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyBUZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKClcbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudFxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlRleHRJbnNlcnRcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBUZXh0SW5zZXJ0IGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEhhbmRsZXMgYSBUZXh0LWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgI1xuICBjbGFzcyBXb3JkIGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkXG4gICAgI1xuICAgIGluc2VydFRleHQ6IChwb3NpdGlvbiwgY29udGVudCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgIG9wID0gbmV3IFRleHRJbnNlcnQgYywgdW5kZWZpbmVkLCBvLnByZXZfY2wsIG9cbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBkZWxldGVfb3BzXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgd29yZCB3aXRoIGFub3RoZXIgb25lLiBDb25jdXJyZW50IHJlcGxhY2VtZW50cyBhcmUgbm90IG1lcmdlZCFcbiAgICAjIE9ubHkgb25lIG9mIHRoZSByZXBsYWNlbWVudHMgd2lsbCBiZSB1c2VkLlxuICAgICNcbiAgICAjIENhbiBvbmx5IGJlIHVzZWQgaWYgdGhlIFJlcGxhY2VNYW5hZ2VyIHdhcyBzZXQhXG4gICAgIyBAc2VlIFdvcmQuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAjXG4gICAgcmVwbGFjZVRleHQ6ICh0ZXh0KS0+XG4gICAgICBpZiBAcmVwbGFjZV9tYW5hZ2VyP1xuICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBXb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCB0ZXh0XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXIucmVwbGFjZSh3b3JkKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgaXMgY3VycmVudGx5IG5vdCBtYWludGFpbmVkIGJ5IGEgUmVwbGFjZU1hbmFnZXIhXCJcblxuICAgICNcbiAgICAjIEByZXR1cm5zIFtKc29uXSBBIEpzb24gb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIEluIG1vc3QgY2FzZXMgeW91IHdvdWxkIGVtYmVkIGEgV29yZCBpbiBhIFJlcGxhY2VhYmxlLCB3aWNoIGlzIGhhbmRsZWQgYnkgdGhlIFJlcGxhY2VNYW5hZ2VyIGluIG9yZGVyXG4gICAgIyB0byBwcm92aWRlIHJlcGxhY2UgZnVuY3Rpb25hbGl0eS5cbiAgICAjXG4gICAgc2V0UmVwbGFjZU1hbmFnZXI6IChvcCktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3JlcGxhY2VfbWFuYWdlcicsIG9wXG4gICAgICBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgQG9uIFsnaW5zZXJ0JywgJ2RlbGV0ZSddLCAoKT0+XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXI/LmNhbGxFdmVudCAnY2hhbmdlJ1xuXG4gICAgI1xuICAgICMgQmluZCB0aGlzIFdvcmQgdG8gYSB0ZXh0ZmllbGQuXG4gICAgI1xuICAgIGJpbmQ6ICh0ZXh0ZmllbGQpLT5cbiAgICAgIHdvcmQgPSBAXG4gICAgICB0ZXh0ZmllbGQudmFsdWUgPSBAdmFsKClcblxuICAgICAgQG9uIFwiaW5zZXJ0XCIsIChldmVudCwgb3ApLT5cbiAgICAgICAgb19wb3MgPSBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICBpZiBjdXJzb3IgPD0gb19wb3NcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGN1cnNvciArPSAxXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgcmlnaHQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuXG4gICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIGxlZnQsIHJpZ2h0XG5cblxuICAgICAgQG9uIFwiZGVsZXRlXCIsIChldmVudCwgb3ApLT5cbiAgICAgICAgb19wb3MgPSBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICBpZiBjdXJzb3IgPCBvX3Bvc1xuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY3Vyc29yIC09IDFcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICBsZWZ0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICByaWdodCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG5cbiAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gd29yZC52YWwoKVxuICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbGVmdCwgcmlnaHRcblxuICAgICAgIyBjb25zdW1lIGFsbCB0ZXh0LWluc2VydCBjaGFuZ2VzLlxuICAgICAgdGV4dGZpZWxkLm9ua2V5cHJlc3MgPSAoZXZlbnQpLT5cbiAgICAgICAgY2hhciA9IG51bGxcbiAgICAgICAgaWYgZXZlbnQua2V5P1xuICAgICAgICAgIGlmIGV2ZW50LmNoYXJDb2RlIGlzIDMyXG4gICAgICAgICAgICBjaGFyID0gXCIgXCJcbiAgICAgICAgICBlbHNlIGlmIGV2ZW50LmtleUNvZGUgaXMgMTNcbiAgICAgICAgICAgIGNoYXIgPSAnXFxuJ1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNoYXIgPSBldmVudC5rZXlcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlIGV2ZW50LmtleUNvZGVcbiAgICAgICAgaWYgY2hhci5sZW5ndGggPiAwXG4gICAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgICAgZGlmZiA9IE1hdGguYWJzKHRleHRmaWVsZC5zZWxlY3Rpb25FbmQgLSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQpXG4gICAgICAgICAgd29yZC5kZWxldGVUZXh0IChwb3MpLCBkaWZmXG4gICAgICAgICAgd29yZC5pbnNlcnRUZXh0IHBvcywgY2hhclxuICAgICAgICAgIG5ld19wb3MgPSBwb3MgKyBjaGFyLmxlbmd0aFxuICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBuZXdfcG9zLCBuZXdfcG9zXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICB0ZXh0ZmllbGQub25wYXN0ZSA9IChldmVudCktPlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICB0ZXh0ZmllbGQub25jdXQgPSAoZXZlbnQpLT5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAjXG4gICAgICAjIGNvbnN1bWUgZGVsZXRlcy4gTm90ZSB0aGF0XG4gICAgICAjICAgY2hyb21lOiB3b24ndCBjb25zdW1lIGRlbGV0aW9ucyBvbiBrZXlwcmVzcyBldmVudC5cbiAgICAgICMgICBrZXlDb2RlIGlzIGRlcHJlY2F0ZWQuIEJVVDogSSBkb24ndCBzZWUgYW5vdGhlciB3YXkuXG4gICAgICAjICAgICBzaW5jZSBldmVudC5rZXkgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IHZlcnNpb24gb2YgY2hyb21lLlxuICAgICAgIyAgICAgRXZlcnkgYnJvd3NlciBzdXBwb3J0cyBrZXlDb2RlLiBMZXQncyBzdGljayB3aXRoIGl0IGZvciBub3cuLlxuICAgICAgI1xuICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IChldmVudCktPlxuICAgICAgICBwb3MgPSBNYXRoLm1pbiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQsIHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgZGlmZiA9IE1hdGguYWJzKHRleHRmaWVsZC5zZWxlY3Rpb25FbmQgLSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQpXG4gICAgICAgIGlmIGV2ZW50LmtleUNvZGU/IGFuZCBldmVudC5rZXlDb2RlIGlzIDggIyBCYWNrc3BhY2VcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGVUZXh0IHBvcywgZGlmZlxuICAgICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHBvcywgcG9zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgaWYgZXZlbnQuY3RybEtleT8gYW5kIGV2ZW50LmN0cmxLZXlcbiAgICAgICAgICAgICAgdmFsID0gdGV4dGZpZWxkLnZhbHVlXG4gICAgICAgICAgICAgIG5ld19wb3MgPSBwb3NcbiAgICAgICAgICAgICAgZGVsX2xlbmd0aCA9IDBcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3aGlsZSBuZXdfcG9zID4gMCBhbmQgdmFsW25ld19wb3NdIGlzbnQgXCIgXCIgYW5kIHZhbFtuZXdfcG9zXSBpc250ICdcXG4nXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBuZXdfcG9zLCAocG9zLW5ld19wb3MpXG4gICAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBuZXdfcG9zLCBuZXdfcG9zXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCAocG9zLTEpLCAxXG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgICBlbHNlIGlmIGV2ZW50LmtleUNvZGU/IGFuZCBldmVudC5rZXlDb2RlIGlzIDQ2ICMgRGVsZXRlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIGRpZmZcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIDFcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiV29yZFwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyWydXb3JkJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnYmVnaW5uaW5nJyA6IGJlZ2lubmluZ1xuICAgICAgJ2VuZCcgOiBlbmRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IFdvcmQgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgdHlwZXNbJ1RleHRJbnNlcnQnXSA9IFRleHRJbnNlcnRcbiAgdHlwZXNbJ1RleHREZWxldGUnXSA9IFRleHREZWxldGVcbiAgdHlwZXNbJ1dvcmQnXSA9IFdvcmRcbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuZXhwb3J0c1snSXdjQ29ubmVjdG9yJ10gPVxuICByZXF1aXJlICcuL0Nvbm5lY3RvcnMvSXdjQ29ubmVjdG9yJ1xuZXhwb3J0c1snVGVzdENvbm5lY3RvciddID1cbiAgcmVxdWlyZSAnLi9Db25uZWN0b3JzL1Rlc3RDb25uZWN0b3InXG5leHBvcnRzWydKc29uWWF0dGEnXSA9XG4gIHJlcXVpcmUgJy4vRnJhbWV3b3Jrcy9Kc29uWWF0dGEnXG5leHBvcnRzWydUZXh0WWF0dGEnXSA9XG4gIHJlcXVpcmUgJy4vRnJhbWV3b3Jrcy9UZXh0WWF0dGEnXG5cbiIsIi8vICAgICBVbmRlcnNjb3JlLmpzIDEuNi4wXG4vLyAgICAgaHR0cDovL3VuZGVyc2NvcmVqcy5vcmdcbi8vICAgICAoYykgMjAwOS0yMDE0IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4vLyAgICAgVW5kZXJzY29yZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uKCkge1xuXG4gIC8vIEJhc2VsaW5lIHNldHVwXG4gIC8vIC0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gRXN0YWJsaXNoIHRoZSByb290IG9iamVjdCwgYHdpbmRvd2AgaW4gdGhlIGJyb3dzZXIsIG9yIGBleHBvcnRzYCBvbiB0aGUgc2VydmVyLlxuICB2YXIgcm9vdCA9IHRoaXM7XG5cbiAgLy8gU2F2ZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIGBfYCB2YXJpYWJsZS5cbiAgdmFyIHByZXZpb3VzVW5kZXJzY29yZSA9IHJvb3QuXztcblxuICAvLyBFc3RhYmxpc2ggdGhlIG9iamVjdCB0aGF0IGdldHMgcmV0dXJuZWQgdG8gYnJlYWsgb3V0IG9mIGEgbG9vcCBpdGVyYXRpb24uXG4gIHZhciBicmVha2VyID0ge307XG5cbiAgLy8gU2F2ZSBieXRlcyBpbiB0aGUgbWluaWZpZWQgKGJ1dCBub3QgZ3ppcHBlZCkgdmVyc2lvbjpcbiAgdmFyIEFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGUsIE9ialByb3RvID0gT2JqZWN0LnByb3RvdHlwZSwgRnVuY1Byb3RvID0gRnVuY3Rpb24ucHJvdG90eXBlO1xuXG4gIC8vIENyZWF0ZSBxdWljayByZWZlcmVuY2UgdmFyaWFibGVzIGZvciBzcGVlZCBhY2Nlc3MgdG8gY29yZSBwcm90b3R5cGVzLlxuICB2YXJcbiAgICBwdXNoICAgICAgICAgICAgID0gQXJyYXlQcm90by5wdXNoLFxuICAgIHNsaWNlICAgICAgICAgICAgPSBBcnJheVByb3RvLnNsaWNlLFxuICAgIGNvbmNhdCAgICAgICAgICAgPSBBcnJheVByb3RvLmNvbmNhdCxcbiAgICB0b1N0cmluZyAgICAgICAgID0gT2JqUHJvdG8udG9TdHJpbmcsXG4gICAgaGFzT3duUHJvcGVydHkgICA9IE9ialByb3RvLmhhc093blByb3BlcnR5O1xuXG4gIC8vIEFsbCAqKkVDTUFTY3JpcHQgNSoqIG5hdGl2ZSBmdW5jdGlvbiBpbXBsZW1lbnRhdGlvbnMgdGhhdCB3ZSBob3BlIHRvIHVzZVxuICAvLyBhcmUgZGVjbGFyZWQgaGVyZS5cbiAgdmFyXG4gICAgbmF0aXZlRm9yRWFjaCAgICAgID0gQXJyYXlQcm90by5mb3JFYWNoLFxuICAgIG5hdGl2ZU1hcCAgICAgICAgICA9IEFycmF5UHJvdG8ubWFwLFxuICAgIG5hdGl2ZVJlZHVjZSAgICAgICA9IEFycmF5UHJvdG8ucmVkdWNlLFxuICAgIG5hdGl2ZVJlZHVjZVJpZ2h0ICA9IEFycmF5UHJvdG8ucmVkdWNlUmlnaHQsXG4gICAgbmF0aXZlRmlsdGVyICAgICAgID0gQXJyYXlQcm90by5maWx0ZXIsXG4gICAgbmF0aXZlRXZlcnkgICAgICAgID0gQXJyYXlQcm90by5ldmVyeSxcbiAgICBuYXRpdmVTb21lICAgICAgICAgPSBBcnJheVByb3RvLnNvbWUsXG4gICAgbmF0aXZlSW5kZXhPZiAgICAgID0gQXJyYXlQcm90by5pbmRleE9mLFxuICAgIG5hdGl2ZUxhc3RJbmRleE9mICA9IEFycmF5UHJvdG8ubGFzdEluZGV4T2YsXG4gICAgbmF0aXZlSXNBcnJheSAgICAgID0gQXJyYXkuaXNBcnJheSxcbiAgICBuYXRpdmVLZXlzICAgICAgICAgPSBPYmplY3Qua2V5cyxcbiAgICBuYXRpdmVCaW5kICAgICAgICAgPSBGdW5jUHJvdG8uYmluZDtcblxuICAvLyBDcmVhdGUgYSBzYWZlIHJlZmVyZW5jZSB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QgZm9yIHVzZSBiZWxvdy5cbiAgdmFyIF8gPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgXykgcmV0dXJuIG9iajtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgXykpIHJldHVybiBuZXcgXyhvYmopO1xuICAgIHRoaXMuX3dyYXBwZWQgPSBvYmo7XG4gIH07XG5cbiAgLy8gRXhwb3J0IHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgKipOb2RlLmpzKiosIHdpdGhcbiAgLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkgZm9yIHRoZSBvbGQgYHJlcXVpcmUoKWAgQVBJLiBJZiB3ZSdyZSBpblxuICAvLyB0aGUgYnJvd3NlciwgYWRkIGBfYCBhcyBhIGdsb2JhbCBvYmplY3QgdmlhIGEgc3RyaW5nIGlkZW50aWZpZXIsXG4gIC8vIGZvciBDbG9zdXJlIENvbXBpbGVyIFwiYWR2YW5jZWRcIiBtb2RlLlxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBfO1xuICAgIH1cbiAgICBleHBvcnRzLl8gPSBfO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuXyA9IF87XG4gIH1cblxuICAvLyBDdXJyZW50IHZlcnNpb24uXG4gIF8uVkVSU0lPTiA9ICcxLjYuMCc7XG5cbiAgLy8gQ29sbGVjdGlvbiBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBUaGUgY29ybmVyc3RvbmUsIGFuIGBlYWNoYCBpbXBsZW1lbnRhdGlvbiwgYWthIGBmb3JFYWNoYC5cbiAgLy8gSGFuZGxlcyBvYmplY3RzIHdpdGggdGhlIGJ1aWx0LWluIGBmb3JFYWNoYCwgYXJyYXlzLCBhbmQgcmF3IG9iamVjdHMuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBmb3JFYWNoYCBpZiBhdmFpbGFibGUuXG4gIHZhciBlYWNoID0gXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIHJlc3VsdHMgb2YgYXBwbHlpbmcgdGhlIGl0ZXJhdG9yIHRvIGVhY2ggZWxlbWVudC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYG1hcGAgaWYgYXZhaWxhYmxlLlxuICBfLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZU1hcCAmJiBvYmoubWFwID09PSBuYXRpdmVNYXApIHJldHVybiBvYmoubWFwKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXN1bHRzLnB1c2goaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICB2YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbiAgLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuICAvLyBvciBgZm9sZGxgLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlYCBpZiBhdmFpbGFibGUuXG4gIF8ucmVkdWNlID0gXy5mb2xkbCA9IF8uaW5qZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlICYmIG9iai5yZWR1Y2UgPT09IG5hdGl2ZVJlZHVjZSkge1xuICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZShpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlKGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgIG1lbW8gPSB2YWx1ZTtcbiAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghaW5pdGlhbCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgcmV0dXJuIG1lbW87XG4gIH07XG5cbiAgLy8gVGhlIHJpZ2h0LWFzc29jaWF0aXZlIHZlcnNpb24gb2YgcmVkdWNlLCBhbHNvIGtub3duIGFzIGBmb2xkcmAuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGByZWR1Y2VSaWdodGAgaWYgYXZhaWxhYmxlLlxuICBfLnJlZHVjZVJpZ2h0ID0gXy5mb2xkciA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaWYgKG5hdGl2ZVJlZHVjZVJpZ2h0ICYmIG9iai5yZWR1Y2VSaWdodCA9PT0gbmF0aXZlUmVkdWNlUmlnaHQpIHtcbiAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2VSaWdodChpdGVyYXRvciwgbWVtbykgOiBvYmoucmVkdWNlUmlnaHQoaXRlcmF0b3IpO1xuICAgIH1cbiAgICB2YXIgbGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoICE9PSArbGVuZ3RoKSB7XG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgfVxuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGluZGV4ID0ga2V5cyA/IGtleXNbLS1sZW5ndGhdIDogLS1sZW5ndGg7XG4gICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgbWVtbyA9IG9ialtpbmRleF07XG4gICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWVtbyA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgbWVtbywgb2JqW2luZGV4XSwgaW5kZXgsIGxpc3QpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmICghaW5pdGlhbCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgcmV0dXJuIG1lbW87XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBmaXJzdCB2YWx1ZSB3aGljaCBwYXNzZXMgYSB0cnV0aCB0ZXN0LiBBbGlhc2VkIGFzIGBkZXRlY3RgLlxuICBfLmZpbmQgPSBfLmRldGVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBhbnkob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgcGFzcyBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBmaWx0ZXJgIGlmIGF2YWlsYWJsZS5cbiAgLy8gQWxpYXNlZCBhcyBgc2VsZWN0YC5cbiAgXy5maWx0ZXIgPSBfLnNlbGVjdCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgIGlmIChuYXRpdmVGaWx0ZXIgJiYgb2JqLmZpbHRlciA9PT0gbmF0aXZlRmlsdGVyKSByZXR1cm4gb2JqLmZpbHRlcihwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSByZXN1bHRzLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIF8ucmVqZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHJldHVybiAhcHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICB9LCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgd2hldGhlciBhbGwgb2YgdGhlIGVsZW1lbnRzIG1hdGNoIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGV2ZXJ5YCBpZiBhdmFpbGFibGUuXG4gIC8vIEFsaWFzZWQgYXMgYGFsbGAuXG4gIF8uZXZlcnkgPSBfLmFsbCA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcHJlZGljYXRlIHx8IChwcmVkaWNhdGUgPSBfLmlkZW50aXR5KTtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKG5hdGl2ZUV2ZXJ5ICYmIG9iai5ldmVyeSA9PT0gbmF0aXZlRXZlcnkpIHJldHVybiBvYmouZXZlcnkocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoIShyZXN1bHQgPSByZXN1bHQgJiYgcHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSkpIHJldHVybiBicmVha2VyO1xuICAgIH0pO1xuICAgIHJldHVybiAhIXJlc3VsdDtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgYXQgbGVhc3Qgb25lIGVsZW1lbnQgaW4gdGhlIG9iamVjdCBtYXRjaGVzIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHNvbWVgIGlmIGF2YWlsYWJsZS5cbiAgLy8gQWxpYXNlZCBhcyBgYW55YC5cbiAgdmFyIGFueSA9IF8uc29tZSA9IF8uYW55ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgfHwgKHByZWRpY2F0ZSA9IF8uaWRlbnRpdHkpO1xuICAgIHZhciByZXN1bHQgPSBmYWxzZTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKG5hdGl2ZVNvbWUgJiYgb2JqLnNvbWUgPT09IG5hdGl2ZVNvbWUpIHJldHVybiBvYmouc29tZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChyZXN1bHQgfHwgKHJlc3VsdCA9IHByZWRpY2F0ZS5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpKSByZXR1cm4gYnJlYWtlcjtcbiAgICB9KTtcbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiB2YWx1ZSAodXNpbmcgYD09PWApLlxuICAvLyBBbGlhc2VkIGFzIGBpbmNsdWRlYC5cbiAgXy5jb250YWlucyA9IF8uaW5jbHVkZSA9IGZ1bmN0aW9uKG9iaiwgdGFyZ2V0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG5hdGl2ZUluZGV4T2YgJiYgb2JqLmluZGV4T2YgPT09IG5hdGl2ZUluZGV4T2YpIHJldHVybiBvYmouaW5kZXhPZih0YXJnZXQpICE9IC0xO1xuICAgIHJldHVybiBhbnkob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlID09PSB0YXJnZXQ7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gSW52b2tlIGEgbWV0aG9kICh3aXRoIGFyZ3VtZW50cykgb24gZXZlcnkgaXRlbSBpbiBhIGNvbGxlY3Rpb24uXG4gIF8uaW52b2tlID0gZnVuY3Rpb24ob2JqLCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgaXNGdW5jID0gXy5pc0Z1bmN0aW9uKG1ldGhvZCk7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiAoaXNGdW5jID8gbWV0aG9kIDogdmFsdWVbbWV0aG9kXSkuYXBwbHkodmFsdWUsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gIF8ucGx1Y2sgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmlsdGVyYDogc2VsZWN0aW5nIG9ubHkgb2JqZWN0c1xuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLndoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbmRgOiBnZXR0aW5nIHRoZSBmaXJzdCBvYmplY3RcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5maW5kV2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmluZChvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IG9yIChlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgLy8gQ2FuJ3Qgb3B0aW1pemUgYXJyYXlzIG9mIGludGVnZXJzIGxvbmdlciB0aGFuIDY1LDUzNSBlbGVtZW50cy5cbiAgLy8gU2VlIFtXZWJLaXQgQnVnIDgwNzk3XShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9ODA3OTcpXG4gIF8ubWF4ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmICghaXRlcmF0b3IgJiYgXy5pc0FycmF5KG9iaikgJiYgb2JqWzBdID09PSArb2JqWzBdICYmIG9iai5sZW5ndGggPCA2NTUzNSkge1xuICAgICAgcmV0dXJuIE1hdGgubWF4LmFwcGx5KE1hdGgsIG9iaik7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSAtSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IC1JbmZpbml0eTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICB2YXIgY29tcHV0ZWQgPSBpdGVyYXRvciA/IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSA6IHZhbHVlO1xuICAgICAgaWYgKGNvbXB1dGVkID4gbGFzdENvbXB1dGVkKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5taW4gPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpdGVyYXRvciAmJiBfLmlzQXJyYXkob2JqKSAmJiBvYmpbMF0gPT09ICtvYmpbMF0gJiYgb2JqLmxlbmd0aCA8IDY1NTM1KSB7XG4gICAgICByZXR1cm4gTWF0aC5taW4uYXBwbHkoTWF0aCwgb2JqKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IEluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSBJbmZpbml0eTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICB2YXIgY29tcHV0ZWQgPSBpdGVyYXRvciA/IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSA6IHZhbHVlO1xuICAgICAgaWYgKGNvbXB1dGVkIDwgbGFzdENvbXB1dGVkKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICBsYXN0Q29tcHV0ZWQgPSBjb21wdXRlZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFNodWZmbGUgYW4gYXJyYXksIHVzaW5nIHRoZSBtb2Rlcm4gdmVyc2lvbiBvZiB0aGVcbiAgLy8gW0Zpc2hlci1ZYXRlcyBzaHVmZmxlXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zpc2hlcuKAk1lhdGVzX3NodWZmbGUpLlxuICBfLnNodWZmbGUgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcmFuZDtcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHZhciBzaHVmZmxlZCA9IFtdO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmFuZCA9IF8ucmFuZG9tKGluZGV4KyspO1xuICAgICAgc2h1ZmZsZWRbaW5kZXggLSAxXSA9IHNodWZmbGVkW3JhbmRdO1xuICAgICAgc2h1ZmZsZWRbcmFuZF0gPSB2YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gc2h1ZmZsZWQ7XG4gIH07XG5cbiAgLy8gU2FtcGxlICoqbioqIHJhbmRvbSB2YWx1ZXMgZnJvbSBhIGNvbGxlY3Rpb24uXG4gIC8vIElmICoqbioqIGlzIG5vdCBzcGVjaWZpZWQsIHJldHVybnMgYSBzaW5nbGUgcmFuZG9tIGVsZW1lbnQuXG4gIC8vIFRoZSBpbnRlcm5hbCBgZ3VhcmRgIGFyZ3VtZW50IGFsbG93cyBpdCB0byB3b3JrIHdpdGggYG1hcGAuXG4gIF8uc2FtcGxlID0gZnVuY3Rpb24ob2JqLCBuLCBndWFyZCkge1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHtcbiAgICAgIGlmIChvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCkgb2JqID0gXy52YWx1ZXMob2JqKTtcbiAgICAgIHJldHVybiBvYmpbXy5yYW5kb20ob2JqLmxlbmd0aCAtIDEpXTtcbiAgICB9XG4gICAgcmV0dXJuIF8uc2h1ZmZsZShvYmopLnNsaWNlKDAsIE1hdGgubWF4KDAsIG4pKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBsb29rdXAgaXRlcmF0b3JzLlxuICB2YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gXy5pZGVudGl0eTtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgfTtcblxuICAvLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0b3IuXG4gIF8uc29ydEJ5ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KVxuICAgICAgfTtcbiAgICB9KS5zb3J0KGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgIGlmIChhIDwgYiB8fCBiID09PSB2b2lkIDApIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsZWZ0LmluZGV4IC0gcmlnaHQuaW5kZXg7XG4gICAgfSksICd2YWx1ZScpO1xuICB9O1xuXG4gIC8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHVzZWQgZm9yIGFnZ3JlZ2F0ZSBcImdyb3VwIGJ5XCIgb3BlcmF0aW9ucy5cbiAgdmFyIGdyb3VwID0gZnVuY3Rpb24oYmVoYXZpb3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgIHZhciBrZXkgPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCBrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEdyb3VwcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLiBQYXNzIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGVcbiAgLy8gdG8gZ3JvdXAgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjcml0ZXJpb24uXG4gIF8uZ3JvdXBCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5LCB2YWx1ZSkge1xuICAgIF8uaGFzKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldLnB1c2godmFsdWUpIDogcmVzdWx0W2tleV0gPSBbdmFsdWVdO1xuICB9KTtcblxuICAvLyBJbmRleGVzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24sIHNpbWlsYXIgdG8gYGdyb3VwQnlgLCBidXQgZm9yXG4gIC8vIHdoZW4geW91IGtub3cgdGhhdCB5b3VyIGluZGV4IHZhbHVlcyB3aWxsIGJlIHVuaXF1ZS5cbiAgXy5pbmRleEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCBrZXksIHZhbHVlKSB7XG4gICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgfSk7XG5cbiAgLy8gQ291bnRzIGluc3RhbmNlcyBvZiBhbiBvYmplY3QgdGhhdCBncm91cCBieSBhIGNlcnRhaW4gY3JpdGVyaW9uLiBQYXNzXG4gIC8vIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGUgdG8gY291bnQgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAvLyBjcml0ZXJpb24uXG4gIF8uY291bnRCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5KSB7XG4gICAgXy5oYXMocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0rKyA6IHJlc3VsdFtrZXldID0gMTtcbiAgfSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIF8uc29ydGVkSW5kZXggPSBmdW5jdGlvbihhcnJheSwgb2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IoaXRlcmF0b3IpO1xuICAgIHZhciB2YWx1ZSA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqKTtcbiAgICB2YXIgbG93ID0gMCwgaGlnaCA9IGFycmF5Lmxlbmd0aDtcbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgYXJyYXlbbWlkXSkgPCB2YWx1ZSA/IGxvdyA9IG1pZCArIDEgOiBoaWdoID0gbWlkO1xuICAgIH1cbiAgICByZXR1cm4gbG93O1xuICB9O1xuXG4gIC8vIFNhZmVseSBjcmVhdGUgYSByZWFsLCBsaXZlIGFycmF5IGZyb20gYW55dGhpbmcgaXRlcmFibGUuXG4gIF8udG9BcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghb2JqKSByZXR1cm4gW107XG4gICAgaWYgKF8uaXNBcnJheShvYmopKSByZXR1cm4gc2xpY2UuY2FsbChvYmopO1xuICAgIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkgcmV0dXJuIF8ubWFwKG9iaiwgXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIF8udmFsdWVzKG9iaik7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gYW4gb2JqZWN0LlxuICBfLnNpemUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpID8gb2JqLmxlbmd0aCA6IF8ua2V5cyhvYmopLmxlbmd0aDtcbiAgfTtcblxuICAvLyBBcnJheSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gR2V0IHRoZSBmaXJzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBmaXJzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIEFsaWFzZWQgYXMgYGhlYWRgIGFuZCBgdGFrZWAuIFRoZSAqKmd1YXJkKiogY2hlY2tcbiAgLy8gYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLmZpcnN0ID0gXy5oZWFkID0gXy50YWtlID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgaWYgKChuID09IG51bGwpIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbMF07XG4gICAgaWYgKG4gPCAwKSByZXR1cm4gW107XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIG4pO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGxhc3QgZW50cnkgb2YgdGhlIGFycmF5LiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiBhbGwgdGhlIHZhbHVlcyBpblxuICAvLyB0aGUgYXJyYXksIGV4Y2x1ZGluZyB0aGUgbGFzdCBOLiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGhcbiAgLy8gYF8ubWFwYC5cbiAgXy5pbml0aWFsID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIGFycmF5Lmxlbmd0aCAtICgobiA9PSBudWxsKSB8fCBndWFyZCA/IDEgOiBuKSk7XG4gIH07XG5cbiAgLy8gR2V0IHRoZSBsYXN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGxhc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5sYXN0ID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgaWYgKChuID09IG51bGwpIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIE1hdGgubWF4KGFycmF5Lmxlbmd0aCAtIG4sIDApKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBmaXJzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEFsaWFzZWQgYXMgYHRhaWxgIGFuZCBgZHJvcGAuXG4gIC8vIEVzcGVjaWFsbHkgdXNlZnVsIG9uIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nIGFuICoqbioqIHdpbGwgcmV0dXJuXG4gIC8vIHRoZSByZXN0IE4gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKlxuICAvLyBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ucmVzdCA9IF8udGFpbCA9IF8uZHJvcCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCAobiA9PSBudWxsKSB8fCBndWFyZCA/IDEgOiBuKTtcbiAgfTtcblxuICAvLyBUcmltIG91dCBhbGwgZmFsc3kgdmFsdWVzIGZyb20gYW4gYXJyYXkuXG4gIF8uY29tcGFjdCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBfLmlkZW50aXR5KTtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiBhIHJlY3Vyc2l2ZSBgZmxhdHRlbmAgZnVuY3Rpb24uXG4gIHZhciBmbGF0dGVuID0gZnVuY3Rpb24oaW5wdXQsIHNoYWxsb3csIG91dHB1dCkge1xuICAgIGlmIChzaGFsbG93ICYmIF8uZXZlcnkoaW5wdXQsIF8uaXNBcnJheSkpIHtcbiAgICAgIHJldHVybiBjb25jYXQuYXBwbHkob3V0cHV0LCBpbnB1dCk7XG4gICAgfVxuICAgIGVhY2goaW5wdXQsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoXy5pc0FycmF5KHZhbHVlKSB8fCBfLmlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgICBzaGFsbG93ID8gcHVzaC5hcHBseShvdXRwdXQsIHZhbHVlKSA6IGZsYXR0ZW4odmFsdWUsIHNoYWxsb3csIG91dHB1dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfTtcblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IganVzdCBvbmUgbGV2ZWwuXG4gIF8uZmxhdHRlbiA9IGZ1bmN0aW9uKGFycmF5LCBzaGFsbG93KSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4oYXJyYXksIHNoYWxsb3csIFtdKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSB2ZXJzaW9uIG9mIHRoZSBhcnJheSB0aGF0IGRvZXMgbm90IGNvbnRhaW4gdGhlIHNwZWNpZmllZCB2YWx1ZShzKS5cbiAgXy53aXRob3V0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5kaWZmZXJlbmNlKGFycmF5LCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9O1xuXG4gIC8vIFNwbGl0IGFuIGFycmF5IGludG8gdHdvIGFycmF5czogb25lIHdob3NlIGVsZW1lbnRzIGFsbCBzYXRpc2Z5IHRoZSBnaXZlblxuICAvLyBwcmVkaWNhdGUsIGFuZCBvbmUgd2hvc2UgZWxlbWVudHMgYWxsIGRvIG5vdCBzYXRpc2Z5IHRoZSBwcmVkaWNhdGUuXG4gIF8ucGFydGl0aW9uID0gZnVuY3Rpb24oYXJyYXksIHByZWRpY2F0ZSkge1xuICAgIHZhciBwYXNzID0gW10sIGZhaWwgPSBbXTtcbiAgICBlYWNoKGFycmF5LCBmdW5jdGlvbihlbGVtKSB7XG4gICAgICAocHJlZGljYXRlKGVsZW0pID8gcGFzcyA6IGZhaWwpLnB1c2goZWxlbSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIFtwYXNzLCBmYWlsXTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIEFsaWFzZWQgYXMgYHVuaXF1ZWAuXG4gIF8udW5pcSA9IF8udW5pcXVlID0gZnVuY3Rpb24oYXJyYXksIGlzU29ydGVkLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChfLmlzRnVuY3Rpb24oaXNTb3J0ZWQpKSB7XG4gICAgICBjb250ZXh0ID0gaXRlcmF0b3I7XG4gICAgICBpdGVyYXRvciA9IGlzU29ydGVkO1xuICAgICAgaXNTb3J0ZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGluaXRpYWwgPSBpdGVyYXRvciA/IF8ubWFwKGFycmF5LCBpdGVyYXRvciwgY29udGV4dCkgOiBhcnJheTtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIHZhciBzZWVuID0gW107XG4gICAgZWFjaChpbml0aWFsLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgIGlmIChpc1NvcnRlZCA/ICghaW5kZXggfHwgc2VlbltzZWVuLmxlbmd0aCAtIDFdICE9PSB2YWx1ZSkgOiAhXy5jb250YWlucyhzZWVuLCB2YWx1ZSkpIHtcbiAgICAgICAgc2Vlbi5wdXNoKHZhbHVlKTtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGFycmF5W2luZGV4XSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB1bmlvbjogZWFjaCBkaXN0aW5jdCBlbGVtZW50IGZyb20gYWxsIG9mXG4gIC8vIHRoZSBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLnVuaW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8udW5pcShfLmZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlKSk7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIGV2ZXJ5IGl0ZW0gc2hhcmVkIGJldHdlZW4gYWxsIHRoZVxuICAvLyBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLmludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3QgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKF8udW5pcShhcnJheSksIGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIHJldHVybiBfLmV2ZXJ5KHJlc3QsIGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgICAgIHJldHVybiBfLmNvbnRhaW5zKG90aGVyLCBpdGVtKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFRha2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBvbmUgYXJyYXkgYW5kIGEgbnVtYmVyIG9mIG90aGVyIGFycmF5cy5cbiAgLy8gT25seSB0aGUgZWxlbWVudHMgcHJlc2VudCBpbiBqdXN0IHRoZSBmaXJzdCBhcnJheSB3aWxsIHJlbWFpbi5cbiAgXy5kaWZmZXJlbmNlID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgcmVzdCA9IGNvbmNhdC5hcHBseShBcnJheVByb3RvLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgZnVuY3Rpb24odmFsdWUpeyByZXR1cm4gIV8uY29udGFpbnMocmVzdCwgdmFsdWUpOyB9KTtcbiAgfTtcblxuICAvLyBaaXAgdG9nZXRoZXIgbXVsdGlwbGUgbGlzdHMgaW50byBhIHNpbmdsZSBhcnJheSAtLSBlbGVtZW50cyB0aGF0IHNoYXJlXG4gIC8vIGFuIGluZGV4IGdvIHRvZ2V0aGVyLlxuICBfLnppcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsZW5ndGggPSBfLm1heChfLnBsdWNrKGFyZ3VtZW50cywgJ2xlbmd0aCcpLmNvbmNhdCgwKSk7XG4gICAgdmFyIHJlc3VsdHMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsICcnICsgaSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgXy5vYmplY3QgPSBmdW5jdGlvbihsaXN0LCB2YWx1ZXMpIHtcbiAgICBpZiAobGlzdCA9PSBudWxsKSByZXR1cm4ge307XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gSWYgdGhlIGJyb3dzZXIgZG9lc24ndCBzdXBwbHkgdXMgd2l0aCBpbmRleE9mIChJJ20gbG9va2luZyBhdCB5b3UsICoqTVNJRSoqKSxcbiAgLy8gd2UgbmVlZCB0aGlzIGZ1bmN0aW9uLiBSZXR1cm4gdGhlIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGFuXG4gIC8vIGl0ZW0gaW4gYW4gYXJyYXksIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBpbmRleE9mYCBpZiBhdmFpbGFibGUuXG4gIC8vIElmIHRoZSBhcnJheSBpcyBsYXJnZSBhbmQgYWxyZWFkeSBpbiBzb3J0IG9yZGVyLCBwYXNzIGB0cnVlYFxuICAvLyBmb3IgKippc1NvcnRlZCoqIHRvIHVzZSBiaW5hcnkgc2VhcmNoLlxuICBfLmluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgaXNTb3J0ZWQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmIChpc1NvcnRlZCkge1xuICAgICAgaWYgKHR5cGVvZiBpc1NvcnRlZCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpID0gKGlzU29ydGVkIDwgMCA/IE1hdGgubWF4KDAsIGxlbmd0aCArIGlzU29ydGVkKSA6IGlzU29ydGVkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkgPSBfLnNvcnRlZEluZGV4KGFycmF5LCBpdGVtKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2ldID09PSBpdGVtID8gaSA6IC0xO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobmF0aXZlSW5kZXhPZiAmJiBhcnJheS5pbmRleE9mID09PSBuYXRpdmVJbmRleE9mKSByZXR1cm4gYXJyYXkuaW5kZXhPZihpdGVtLCBpc1NvcnRlZCk7XG4gICAgZm9yICg7IGkgPCBsZW5ndGg7IGkrKykgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGxhc3RJbmRleE9mYCBpZiBhdmFpbGFibGUuXG4gIF8ubGFzdEluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgZnJvbSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gLTE7XG4gICAgdmFyIGhhc0luZGV4ID0gZnJvbSAhPSBudWxsO1xuICAgIGlmIChuYXRpdmVMYXN0SW5kZXhPZiAmJiBhcnJheS5sYXN0SW5kZXhPZiA9PT0gbmF0aXZlTGFzdEluZGV4T2YpIHtcbiAgICAgIHJldHVybiBoYXNJbmRleCA/IGFycmF5Lmxhc3RJbmRleE9mKGl0ZW0sIGZyb20pIDogYXJyYXkubGFzdEluZGV4T2YoaXRlbSk7XG4gICAgfVxuICAgIHZhciBpID0gKGhhc0luZGV4ID8gZnJvbSA6IGFycmF5Lmxlbmd0aCk7XG4gICAgd2hpbGUgKGktLSkgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYW4gaW50ZWdlciBBcnJheSBjb250YWluaW5nIGFuIGFyaXRobWV0aWMgcHJvZ3Jlc3Npb24uIEEgcG9ydCBvZlxuICAvLyB0aGUgbmF0aXZlIFB5dGhvbiBgcmFuZ2UoKWAgZnVuY3Rpb24uIFNlZVxuICAvLyBbdGhlIFB5dGhvbiBkb2N1bWVudGF0aW9uXShodHRwOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvZnVuY3Rpb25zLmh0bWwjcmFuZ2UpLlxuICBfLnJhbmdlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHN0ZXApIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICBzdG9wID0gc3RhcnQgfHwgMDtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgc3RlcCA9IGFyZ3VtZW50c1syXSB8fCAxO1xuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgaWR4ID0gMDtcbiAgICB2YXIgcmFuZ2UgPSBuZXcgQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlKGlkeCA8IGxlbmd0aCkge1xuICAgICAgcmFuZ2VbaWR4KytdID0gc3RhcnQ7XG4gICAgICBzdGFydCArPSBzdGVwO1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfTtcblxuICAvLyBGdW5jdGlvbiAoYWhlbSkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldXNhYmxlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciBwcm90b3R5cGUgc2V0dGluZy5cbiAgdmFyIGN0b3IgPSBmdW5jdGlvbigpe307XG5cbiAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgLy8gYXZhaWxhYmxlLlxuICBfLmJpbmQgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0KSB7XG4gICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcjtcbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSkgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBjdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgdmFyIHNlbGYgPSBuZXcgY3RvcjtcbiAgICAgIGN0b3IucHJvdG90eXBlID0gbnVsbDtcbiAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgaWYgKE9iamVjdChyZXN1bHQpID09PSByZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbiAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuICAvLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG4gIF8ucGFydGlhbCA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFyZ3NbaV0gPT09IF8pIGFyZ3NbaV0gPSBhcmd1bWVudHNbcG9zaXRpb24rK107XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gQmluZCBhIG51bWJlciBvZiBhbiBvYmplY3QncyBtZXRob2RzIHRvIHRoYXQgb2JqZWN0LiBSZW1haW5pbmcgYXJndW1lbnRzXG4gIC8vIGFyZSB0aGUgbWV0aG9kIG5hbWVzIHRvIGJlIGJvdW5kLiBVc2VmdWwgZm9yIGVuc3VyaW5nIHRoYXQgYWxsIGNhbGxiYWNrc1xuICAvLyBkZWZpbmVkIG9uIGFuIG9iamVjdCBiZWxvbmcgdG8gaXQuXG4gIF8uYmluZEFsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBmdW5jcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBpZiAoZnVuY3MubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ2JpbmRBbGwgbXVzdCBiZSBwYXNzZWQgZnVuY3Rpb24gbmFtZXMnKTtcbiAgICBlYWNoKGZ1bmNzLCBmdW5jdGlvbihmKSB7IG9ialtmXSA9IF8uYmluZChvYmpbZl0sIG9iaik7IH0pO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gTWVtb2l6ZSBhbiBleHBlbnNpdmUgZnVuY3Rpb24gYnkgc3RvcmluZyBpdHMgcmVzdWx0cy5cbiAgXy5tZW1vaXplID0gZnVuY3Rpb24oZnVuYywgaGFzaGVyKSB7XG4gICAgdmFyIG1lbW8gPSB7fTtcbiAgICBoYXNoZXIgfHwgKGhhc2hlciA9IF8uaWRlbnRpdHkpO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBrZXkgPSBoYXNoZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBfLmhhcyhtZW1vLCBrZXkpID8gbWVtb1trZXldIDogKG1lbW9ba2V5XSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBEZWxheXMgYSBmdW5jdGlvbiBmb3IgdGhlIGdpdmVuIG51bWJlciBvZiBtaWxsaXNlY29uZHMsIGFuZCB0aGVuIGNhbGxzXG4gIC8vIGl0IHdpdGggdGhlIGFyZ3VtZW50cyBzdXBwbGllZC5cbiAgXy5kZWxheSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpeyByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmdzKTsgfSwgd2FpdCk7XG4gIH07XG5cbiAgLy8gRGVmZXJzIGEgZnVuY3Rpb24sIHNjaGVkdWxpbmcgaXQgdG8gcnVuIGFmdGVyIHRoZSBjdXJyZW50IGNhbGwgc3RhY2sgaGFzXG4gIC8vIGNsZWFyZWQuXG4gIF8uZGVmZXIgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgcmV0dXJuIF8uZGVsYXkuYXBwbHkoXywgW2Z1bmMsIDFdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIF8udGhyb3R0bGUgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBvcHRpb25zKSB7XG4gICAgdmFyIGNvbnRleHQsIGFyZ3MsIHJlc3VsdDtcbiAgICB2YXIgdGltZW91dCA9IG51bGw7XG4gICAgdmFyIHByZXZpb3VzID0gMDtcbiAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcHJldmlvdXMgPSBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlID8gMCA6IF8ubm93KCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgfTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm93ID0gXy5ub3coKTtcbiAgICAgIGlmICghcHJldmlvdXMgJiYgb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSkgcHJldmlvdXMgPSBub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAocmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgcHJldmlvdXMgPSBub3c7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCBhcyBsb25nIGFzIGl0IGNvbnRpbnVlcyB0byBiZSBpbnZva2VkLCB3aWxsIG5vdFxuICAvLyBiZSB0cmlnZ2VyZWQuIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCBhZnRlciBpdCBzdG9wcyBiZWluZyBjYWxsZWQgZm9yXG4gIC8vIE4gbWlsbGlzZWNvbmRzLiBJZiBgaW1tZWRpYXRlYCBpcyBwYXNzZWQsIHRyaWdnZXIgdGhlIGZ1bmN0aW9uIG9uIHRoZVxuICAvLyBsZWFkaW5nIGVkZ2UsIGluc3RlYWQgb2YgdGhlIHRyYWlsaW5nLlxuICBfLmRlYm91bmNlID0gZnVuY3Rpb24oZnVuYywgd2FpdCwgaW1tZWRpYXRlKSB7XG4gICAgdmFyIHRpbWVvdXQsIGFyZ3MsIGNvbnRleHQsIHRpbWVzdGFtcCwgcmVzdWx0O1xuXG4gICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbGFzdCA9IF8ubm93KCkgLSB0aW1lc3RhbXA7XG4gICAgICBpZiAobGFzdCA8IHdhaXQpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIHRpbWVzdGFtcCA9IF8ubm93KCk7XG4gICAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcbiAgICAgIGlmICghdGltZW91dCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCk7XG4gICAgICB9XG4gICAgICBpZiAoY2FsbE5vdykge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgXy5vbmNlID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHZhciByYW4gPSBmYWxzZSwgbWVtbztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAocmFuKSByZXR1cm4gbWVtbztcbiAgICAgIHJhbiA9IHRydWU7XG4gICAgICBtZW1vID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgZnVuYyA9IG51bGw7XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGZ1bmN0aW9uIHBhc3NlZCBhcyBhbiBhcmd1bWVudCB0byB0aGUgc2Vjb25kLFxuICAvLyBhbGxvd2luZyB5b3UgdG8gYWRqdXN0IGFyZ3VtZW50cywgcnVuIGNvZGUgYmVmb3JlIGFuZCBhZnRlciwgYW5kXG4gIC8vIGNvbmRpdGlvbmFsbHkgZXhlY3V0ZSB0aGUgb3JpZ2luYWwgZnVuY3Rpb24uXG4gIF8ud3JhcCA9IGZ1bmN0aW9uKGZ1bmMsIHdyYXBwZXIpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHdyYXBwZXIsIGZ1bmMpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiBhIGxpc3Qgb2YgZnVuY3Rpb25zLCBlYWNoXG4gIC8vIGNvbnN1bWluZyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gIF8uY29tcG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGZvciAodmFyIGkgPSBmdW5jcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBhcmdzID0gW2Z1bmNzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhcmdzWzBdO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGFmdGVyIGJlaW5nIGNhbGxlZCBOIHRpbWVzLlxuICBfLmFmdGVyID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIE9iamVjdCBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgT2JqZWN0LmtleXNgXG4gIF8ua2V5cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgaWYgKG5hdGl2ZUtleXMpIHJldHVybiBuYXRpdmVLZXlzKG9iaik7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuICAvLyBSZXRyaWV2ZSB0aGUgdmFsdWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIF8udmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbHVlc1tpXSA9IG9ialtrZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfTtcblxuICAvLyBDb252ZXJ0IGFuIG9iamVjdCBpbnRvIGEgbGlzdCBvZiBgW2tleSwgdmFsdWVdYCBwYWlycy5cbiAgXy5wYWlycyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHBhaXJzW2ldID0gW2tleXNbaV0sIG9ialtrZXlzW2ldXV07XG4gICAgfVxuICAgIHJldHVybiBwYWlycztcbiAgfTtcblxuICAvLyBJbnZlcnQgdGhlIGtleXMgYW5kIHZhbHVlcyBvZiBhbiBvYmplY3QuIFRoZSB2YWx1ZXMgbXVzdCBiZSBzZXJpYWxpemFibGUuXG4gIF8uaW52ZXJ0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdFtvYmpba2V5c1tpXV1dID0ga2V5c1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBzb3J0ZWQgbGlzdCBvZiB0aGUgZnVuY3Rpb24gbmFtZXMgYXZhaWxhYmxlIG9uIHRoZSBvYmplY3QuXG4gIC8vIEFsaWFzZWQgYXMgYG1ldGhvZHNgXG4gIF8uZnVuY3Rpb25zID0gXy5tZXRob2RzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIG5hbWVzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKF8uaXNGdW5jdGlvbihvYmpba2V5XSkpIG5hbWVzLnB1c2goa2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIG5hbWVzLnNvcnQoKTtcbiAgfTtcblxuICAvLyBFeHRlbmQgYSBnaXZlbiBvYmplY3Qgd2l0aCBhbGwgdGhlIHByb3BlcnRpZXMgaW4gcGFzc2VkLWluIG9iamVjdChzKS5cbiAgXy5leHRlbmQgPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgb25seSBjb250YWluaW5nIHRoZSB3aGl0ZWxpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLnBpY2sgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgY29weSA9IHt9O1xuICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgZWFjaChrZXlzLCBmdW5jdGlvbihrZXkpIHtcbiAgICAgIGlmIChrZXkgaW4gb2JqKSBjb3B5W2tleV0gPSBvYmpba2V5XTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGJsYWNrbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ub21pdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBjb3B5ID0ge307XG4gICAgdmFyIGtleXMgPSBjb25jYXQuYXBwbHkoQXJyYXlQcm90bywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoIV8uY29udGFpbnMoa2V5cywga2V5KSkgY29weVtrZXldID0gb2JqW2tleV07XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gIC8vIEZpbGwgaW4gYSBnaXZlbiBvYmplY3Qgd2l0aCBkZWZhdWx0IHByb3BlcnRpZXMuXG4gIF8uZGVmYXVsdHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgaWYgKG9ialtwcm9wXSA9PT0gdm9pZCAwKSBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgXy5jbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBfLmlzQXJyYXkob2JqKSA/IG9iai5zbGljZSgpIDogXy5leHRlbmQoe30sIG9iaik7XG4gIH07XG5cbiAgLy8gSW52b2tlcyBpbnRlcmNlcHRvciB3aXRoIHRoZSBvYmosIGFuZCB0aGVuIHJldHVybnMgb2JqLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIF8udGFwID0gZnVuY3Rpb24ob2JqLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKG9iaik7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYGlzRXF1YWxgLlxuICB2YXIgZXEgPSBmdW5jdGlvbihhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIElkZW50aWNhbCBvYmplY3RzIGFyZSBlcXVhbC4gYDAgPT09IC0wYCwgYnV0IHRoZXkgYXJlbid0IGlkZW50aWNhbC5cbiAgICAvLyBTZWUgdGhlIFtIYXJtb255IGBlZ2FsYCBwcm9wb3NhbF0oaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsKS5cbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIGEgIT09IDAgfHwgMSAvIGEgPT0gMSAvIGI7XG4gICAgLy8gQSBzdHJpY3QgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkgYmVjYXVzZSBgbnVsbCA9PSB1bmRlZmluZWRgLlxuICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gYSA9PT0gYjtcbiAgICAvLyBVbndyYXAgYW55IHdyYXBwZWQgb2JqZWN0cy5cbiAgICBpZiAoYSBpbnN0YW5jZW9mIF8pIGEgPSBhLl93cmFwcGVkO1xuICAgIGlmIChiIGluc3RhbmNlb2YgXykgYiA9IGIuX3dyYXBwZWQ7XG4gICAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9IHRvU3RyaW5nLmNhbGwoYikpIHJldHVybiBmYWxzZTtcbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gU3RyaW5ncywgbnVtYmVycywgZGF0ZXMsIGFuZCBib29sZWFucyBhcmUgY29tcGFyZWQgYnkgdmFsdWUuXG4gICAgICBjYXNlICdbb2JqZWN0IFN0cmluZ10nOlxuICAgICAgICAvLyBQcmltaXRpdmVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9iamVjdCB3cmFwcGVycyBhcmUgZXF1aXZhbGVudDsgdGh1cywgYFwiNVwiYCBpc1xuICAgICAgICAvLyBlcXVpdmFsZW50IHRvIGBuZXcgU3RyaW5nKFwiNVwiKWAuXG4gICAgICAgIHJldHVybiBhID09IFN0cmluZyhiKTtcbiAgICAgIGNhc2UgJ1tvYmplY3QgTnVtYmVyXSc6XG4gICAgICAgIC8vIGBOYU5gcyBhcmUgZXF1aXZhbGVudCwgYnV0IG5vbi1yZWZsZXhpdmUuIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3JcbiAgICAgICAgLy8gb3RoZXIgbnVtZXJpYyB2YWx1ZXMuXG4gICAgICAgIHJldHVybiBhICE9ICthID8gYiAhPSArYiA6IChhID09IDAgPyAxIC8gYSA9PSAxIC8gYiA6IGEgPT0gK2IpO1xuICAgICAgY2FzZSAnW29iamVjdCBEYXRlXSc6XG4gICAgICBjYXNlICdbb2JqZWN0IEJvb2xlYW5dJzpcbiAgICAgICAgLy8gQ29lcmNlIGRhdGVzIGFuZCBib29sZWFucyB0byBudW1lcmljIHByaW1pdGl2ZSB2YWx1ZXMuIERhdGVzIGFyZSBjb21wYXJlZCBieSB0aGVpclxuICAgICAgICAvLyBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnMuIE5vdGUgdGhhdCBpbnZhbGlkIGRhdGVzIHdpdGggbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zXG4gICAgICAgIC8vIG9mIGBOYU5gIGFyZSBub3QgZXF1aXZhbGVudC5cbiAgICAgICAgcmV0dXJuICthID09ICtiO1xuICAgICAgLy8gUmVnRXhwcyBhcmUgY29tcGFyZWQgYnkgdGhlaXIgc291cmNlIHBhdHRlcm5zIGFuZCBmbGFncy5cbiAgICAgIGNhc2UgJ1tvYmplY3QgUmVnRXhwXSc6XG4gICAgICAgIHJldHVybiBhLnNvdXJjZSA9PSBiLnNvdXJjZSAmJlxuICAgICAgICAgICAgICAgYS5nbG9iYWwgPT0gYi5nbG9iYWwgJiZcbiAgICAgICAgICAgICAgIGEubXVsdGlsaW5lID09IGIubXVsdGlsaW5lICYmXG4gICAgICAgICAgICAgICBhLmlnbm9yZUNhc2UgPT0gYi5pZ25vcmVDYXNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgIT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICAvLyBBc3N1bWUgZXF1YWxpdHkgZm9yIGN5Y2xpYyBzdHJ1Y3R1cmVzLiBUaGUgYWxnb3JpdGhtIGZvciBkZXRlY3RpbmcgY3ljbGljXG4gICAgLy8gc3RydWN0dXJlcyBpcyBhZGFwdGVkIGZyb20gRVMgNS4xIHNlY3Rpb24gMTUuMTIuMywgYWJzdHJhY3Qgb3BlcmF0aW9uIGBKT2AuXG4gICAgdmFyIGxlbmd0aCA9IGFTdGFjay5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAvLyBMaW5lYXIgc2VhcmNoLiBQZXJmb3JtYW5jZSBpcyBpbnZlcnNlbHkgcHJvcG9ydGlvbmFsIHRvIHRoZSBudW1iZXIgb2ZcbiAgICAgIC8vIHVuaXF1ZSBuZXN0ZWQgc3RydWN0dXJlcy5cbiAgICAgIGlmIChhU3RhY2tbbGVuZ3RoXSA9PSBhKSByZXR1cm4gYlN0YWNrW2xlbmd0aF0gPT0gYjtcbiAgICB9XG4gICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzXG4gICAgLy8gZnJvbSBkaWZmZXJlbnQgZnJhbWVzIGFyZS5cbiAgICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gICAgaWYgKGFDdG9yICE9PSBiQ3RvciAmJiAhKF8uaXNGdW5jdGlvbihhQ3RvcikgJiYgKGFDdG9yIGluc3RhbmNlb2YgYUN0b3IpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uaXNGdW5jdGlvbihiQ3RvcikgJiYgKGJDdG9yIGluc3RhbmNlb2YgYkN0b3IpKVxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKCdjb25zdHJ1Y3RvcicgaW4gYSAmJiAnY29uc3RydWN0b3InIGluIGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIC8vIEFkZCB0aGUgZmlyc3Qgb2JqZWN0IHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucHVzaChhKTtcbiAgICBiU3RhY2sucHVzaChiKTtcbiAgICB2YXIgc2l6ZSA9IDAsIHJlc3VsdCA9IHRydWU7XG4gICAgLy8gUmVjdXJzaXZlbHkgY29tcGFyZSBvYmplY3RzIGFuZCBhcnJheXMuXG4gICAgaWYgKGNsYXNzTmFtZSA9PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAvLyBDb21wYXJlIGFycmF5IGxlbmd0aHMgdG8gZGV0ZXJtaW5lIGlmIGEgZGVlcCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeS5cbiAgICAgIHNpemUgPSBhLmxlbmd0aDtcbiAgICAgIHJlc3VsdCA9IHNpemUgPT0gYi5sZW5ndGg7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIC8vIERlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXMuXG4gICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICBpZiAoIShyZXN1bHQgPSBlcShhW3NpemVdLCBiW3NpemVdLCBhU3RhY2ssIGJTdGFjaykpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEZWVwIGNvbXBhcmUgb2JqZWN0cy5cbiAgICAgIGZvciAodmFyIGtleSBpbiBhKSB7XG4gICAgICAgIGlmIChfLmhhcyhhLCBrZXkpKSB7XG4gICAgICAgICAgLy8gQ291bnQgdGhlIGV4cGVjdGVkIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgICAgIHNpemUrKztcbiAgICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXIuXG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gXy5oYXMoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEVuc3VyZSB0aGF0IGJvdGggb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBmb3IgKGtleSBpbiBiKSB7XG4gICAgICAgICAgaWYgKF8uaGFzKGIsIGtleSkgJiYgIShzaXplLS0pKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgPSAhc2l6ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmVtb3ZlIHRoZSBmaXJzdCBvYmplY3QgZnJvbSB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnBvcCgpO1xuICAgIGJTdGFjay5wb3AoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFBlcmZvcm0gYSBkZWVwIGNvbXBhcmlzb24gdG8gY2hlY2sgaWYgdHdvIG9iamVjdHMgYXJlIGVxdWFsLlxuICBfLmlzRXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGVxKGEsIGIsIFtdLCBbXSk7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiBhcnJheSwgc3RyaW5nLCBvciBvYmplY3QgZW1wdHk/XG4gIC8vIEFuIFwiZW1wdHlcIiBvYmplY3QgaGFzIG5vIGVudW1lcmFibGUgb3duLXByb3BlcnRpZXMuXG4gIF8uaXNFbXB0eSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKF8uaXNBcnJheShvYmopIHx8IF8uaXNTdHJpbmcob2JqKSkgcmV0dXJuIG9iai5sZW5ndGggPT09IDA7XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBET00gZWxlbWVudD9cbiAgXy5pc0VsZW1lbnQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gISEob2JqICYmIG9iai5ub2RlVHlwZSA9PT0gMSk7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhbiBhcnJheT9cbiAgLy8gRGVsZWdhdGVzIHRvIEVDTUE1J3MgbmF0aXZlIEFycmF5LmlzQXJyYXlcbiAgXy5pc0FycmF5ID0gbmF0aXZlSXNBcnJheSB8fCBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSBhbiBvYmplY3Q/XG4gIF8uaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBPYmplY3Qob2JqKTtcbiAgfTtcblxuICAvLyBBZGQgc29tZSBpc1R5cGUgbWV0aG9kczogaXNBcmd1bWVudHMsIGlzRnVuY3Rpb24sIGlzU3RyaW5nLCBpc051bWJlciwgaXNEYXRlLCBpc1JlZ0V4cC5cbiAgZWFjaChbJ0FyZ3VtZW50cycsICdGdW5jdGlvbicsICdTdHJpbmcnLCAnTnVtYmVyJywgJ0RhdGUnLCAnUmVnRXhwJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBfWydpcycgKyBuYW1lXSA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCAnICsgbmFtZSArICddJztcbiAgICB9O1xuICB9KTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFKSwgd2hlcmVcbiAgLy8gdGhlcmUgaXNuJ3QgYW55IGluc3BlY3RhYmxlIFwiQXJndW1lbnRzXCIgdHlwZS5cbiAgaWYgKCFfLmlzQXJndW1lbnRzKGFyZ3VtZW50cykpIHtcbiAgICBfLmlzQXJndW1lbnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gISEob2JqICYmIF8uaGFzKG9iaiwgJ2NhbGxlZScpKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gT3B0aW1pemUgYGlzRnVuY3Rpb25gIGlmIGFwcHJvcHJpYXRlLlxuICBpZiAodHlwZW9mICgvLi8pICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJztcbiAgICB9O1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiBvYmplY3QgYSBmaW5pdGUgbnVtYmVyP1xuICBfLmlzRmluaXRlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIGlzRmluaXRlKG9iaikgJiYgIWlzTmFOKHBhcnNlRmxvYXQob2JqKSk7XG4gIH07XG5cbiAgLy8gSXMgdGhlIGdpdmVuIHZhbHVlIGBOYU5gPyAoTmFOIGlzIHRoZSBvbmx5IG51bWJlciB3aGljaCBkb2VzIG5vdCBlcXVhbCBpdHNlbGYpLlxuICBfLmlzTmFOID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIF8uaXNOdW1iZXIob2JqKSAmJiBvYmogIT0gK29iajtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgYm9vbGVhbj9cbiAgXy5pc0Jvb2xlYW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSB0cnVlIHx8IG9iaiA9PT0gZmFsc2UgfHwgdG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0IEJvb2xlYW5dJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGVxdWFsIHRvIG51bGw/XG4gIF8uaXNOdWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gbnVsbDtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIHVuZGVmaW5lZD9cbiAgXy5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHZvaWQgMDtcbiAgfTtcblxuICAvLyBTaG9ydGN1dCBmdW5jdGlvbiBmb3IgY2hlY2tpbmcgaWYgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHByb3BlcnR5IGRpcmVjdGx5XG4gIC8vIG9uIGl0c2VsZiAoaW4gb3RoZXIgd29yZHMsIG5vdCBvbiBhIHByb3RvdHlwZSkuXG4gIF8uaGFzID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gIH07XG5cbiAgLy8gVXRpbGl0eSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSdW4gVW5kZXJzY29yZS5qcyBpbiAqbm9Db25mbGljdCogbW9kZSwgcmV0dXJuaW5nIHRoZSBgX2AgdmFyaWFibGUgdG8gaXRzXG4gIC8vIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcm9vdC5fID0gcHJldmlvdXNVbmRlcnNjb3JlO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8vIEtlZXAgdGhlIGlkZW50aXR5IGZ1bmN0aW9uIGFyb3VuZCBmb3IgZGVmYXVsdCBpdGVyYXRvcnMuXG4gIF8uaWRlbnRpdHkgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICBfLmNvbnN0YW50ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG4gIH07XG5cbiAgXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBwcmVkaWNhdGUgZm9yIGNoZWNraW5nIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5tYXRjaGVzID0gZnVuY3Rpb24oYXR0cnMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG4gICAgICBpZiAob2JqID09PSBhdHRycykgcmV0dXJuIHRydWU7IC8vYXZvaWQgY29tcGFyaW5nIGFuIG9iamVjdCB0byBpdHNlbGYuXG4gICAgICBmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcbiAgICAgICAgaWYgKGF0dHJzW2tleV0gIT09IG9ialtrZXldKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfTtcblxuICAvLyBSdW4gYSBmdW5jdGlvbiAqKm4qKiB0aW1lcy5cbiAgXy50aW1lcyA9IGZ1bmN0aW9uKG4sIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIGFjY3VtID0gQXJyYXkoTWF0aC5tYXgoMCwgbikpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSBhY2N1bVtpXSA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHJhbmRvbSBpbnRlZ2VyIGJldHdlZW4gbWluIGFuZCBtYXggKGluY2x1c2l2ZSkuXG4gIF8ucmFuZG9tID0gZnVuY3Rpb24obWluLCBtYXgpIHtcbiAgICBpZiAobWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IG1pbjtcbiAgICAgIG1pbiA9IDA7XG4gICAgfVxuICAgIHJldHVybiBtaW4gKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpO1xuICB9O1xuXG4gIC8vIEEgKHBvc3NpYmx5IGZhc3Rlcikgd2F5IHRvIGdldCB0aGUgY3VycmVudCB0aW1lc3RhbXAgYXMgYW4gaW50ZWdlci5cbiAgXy5ub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xuXG4gIC8vIExpc3Qgb2YgSFRNTCBlbnRpdGllcyBmb3IgZXNjYXBpbmcuXG4gIHZhciBlbnRpdHlNYXAgPSB7XG4gICAgZXNjYXBlOiB7XG4gICAgICAnJic6ICcmYW1wOycsXG4gICAgICAnPCc6ICcmbHQ7JyxcbiAgICAgICc+JzogJyZndDsnLFxuICAgICAgJ1wiJzogJyZxdW90OycsXG4gICAgICBcIidcIjogJyYjeDI3OydcbiAgICB9XG4gIH07XG4gIGVudGl0eU1hcC51bmVzY2FwZSA9IF8uaW52ZXJ0KGVudGl0eU1hcC5lc2NhcGUpO1xuXG4gIC8vIFJlZ2V4ZXMgY29udGFpbmluZyB0aGUga2V5cyBhbmQgdmFsdWVzIGxpc3RlZCBpbW1lZGlhdGVseSBhYm92ZS5cbiAgdmFyIGVudGl0eVJlZ2V4ZXMgPSB7XG4gICAgZXNjYXBlOiAgIG5ldyBSZWdFeHAoJ1snICsgXy5rZXlzKGVudGl0eU1hcC5lc2NhcGUpLmpvaW4oJycpICsgJ10nLCAnZycpLFxuICAgIHVuZXNjYXBlOiBuZXcgUmVnRXhwKCcoJyArIF8ua2V5cyhlbnRpdHlNYXAudW5lc2NhcGUpLmpvaW4oJ3wnKSArICcpJywgJ2cnKVxuICB9O1xuXG4gIC8vIEZ1bmN0aW9ucyBmb3IgZXNjYXBpbmcgYW5kIHVuZXNjYXBpbmcgc3RyaW5ncyB0by9mcm9tIEhUTUwgaW50ZXJwb2xhdGlvbi5cbiAgXy5lYWNoKFsnZXNjYXBlJywgJ3VuZXNjYXBlJ10sIGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIF9bbWV0aG9kXSA9IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgaWYgKHN0cmluZyA9PSBudWxsKSByZXR1cm4gJyc7XG4gICAgICByZXR1cm4gKCcnICsgc3RyaW5nKS5yZXBsYWNlKGVudGl0eVJlZ2V4ZXNbbWV0aG9kXSwgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgICAgcmV0dXJuIGVudGl0eU1hcFttZXRob2RdW21hdGNoXTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIElmIHRoZSB2YWx1ZSBvZiB0aGUgbmFtZWQgYHByb3BlcnR5YCBpcyBhIGZ1bmN0aW9uIHRoZW4gaW52b2tlIGl0IHdpdGggdGhlXG4gIC8vIGBvYmplY3RgIGFzIGNvbnRleHQ7IG90aGVyd2lzZSwgcmV0dXJuIGl0LlxuICBfLnJlc3VsdCA9IGZ1bmN0aW9uKG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICBpZiAob2JqZWN0ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgdmFyIHZhbHVlID0gb2JqZWN0W3Byb3BlcnR5XTtcbiAgICByZXR1cm4gXy5pc0Z1bmN0aW9uKHZhbHVlKSA/IHZhbHVlLmNhbGwob2JqZWN0KSA6IHZhbHVlO1xuICB9O1xuXG4gIC8vIEFkZCB5b3VyIG93biBjdXN0b20gZnVuY3Rpb25zIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5taXhpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGVhY2goXy5mdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfW25hbWVdID0gb2JqW25hbWVdO1xuICAgICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbdGhpcy5fd3JhcHBlZF07XG4gICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIGZ1bmMuYXBwbHkoXywgYXJncykpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhIHVuaXF1ZSBpbnRlZ2VyIGlkICh1bmlxdWUgd2l0aGluIHRoZSBlbnRpcmUgY2xpZW50IHNlc3Npb24pLlxuICAvLyBVc2VmdWwgZm9yIHRlbXBvcmFyeSBET00gaWRzLlxuICB2YXIgaWRDb3VudGVyID0gMDtcbiAgXy51bmlxdWVJZCA9IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH07XG5cbiAgLy8gQnkgZGVmYXVsdCwgVW5kZXJzY29yZSB1c2VzIEVSQi1zdHlsZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzLCBjaGFuZ2UgdGhlXG4gIC8vIGZvbGxvd2luZyB0ZW1wbGF0ZSBzZXR0aW5ncyB0byB1c2UgYWx0ZXJuYXRpdmUgZGVsaW1pdGVycy5cbiAgXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xuICAgIGV2YWx1YXRlICAgIDogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZSA6IC88JT0oW1xcc1xcU10rPyklPi9nLFxuICAgIGVzY2FwZSAgICAgIDogLzwlLShbXFxzXFxTXSs/KSU+L2dcbiAgfTtcblxuICAvLyBXaGVuIGN1c3RvbWl6aW5nIGB0ZW1wbGF0ZVNldHRpbmdzYCwgaWYgeW91IGRvbid0IHdhbnQgdG8gZGVmaW5lIGFuXG4gIC8vIGludGVycG9sYXRpb24sIGV2YWx1YXRpb24gb3IgZXNjYXBpbmcgcmVnZXgsIHdlIG5lZWQgb25lIHRoYXQgaXNcbiAgLy8gZ3VhcmFudGVlZCBub3QgdG8gbWF0Y2guXG4gIHZhciBub01hdGNoID0gLyguKV4vO1xuXG4gIC8vIENlcnRhaW4gY2hhcmFjdGVycyBuZWVkIHRvIGJlIGVzY2FwZWQgc28gdGhhdCB0aGV5IGNhbiBiZSBwdXQgaW50byBhXG4gIC8vIHN0cmluZyBsaXRlcmFsLlxuICB2YXIgZXNjYXBlcyA9IHtcbiAgICBcIidcIjogICAgICBcIidcIixcbiAgICAnXFxcXCc6ICAgICAnXFxcXCcsXG4gICAgJ1xccic6ICAgICAncicsXG4gICAgJ1xcbic6ICAgICAnbicsXG4gICAgJ1xcdCc6ICAgICAndCcsXG4gICAgJ1xcdTIwMjgnOiAndTIwMjgnLFxuICAgICdcXHUyMDI5JzogJ3UyMDI5J1xuICB9O1xuXG4gIHZhciBlc2NhcGVyID0gL1xcXFx8J3xcXHJ8XFxufFxcdHxcXHUyMDI4fFxcdTIwMjkvZztcblxuICAvLyBKYXZhU2NyaXB0IG1pY3JvLXRlbXBsYXRpbmcsIHNpbWlsYXIgdG8gSm9obiBSZXNpZydzIGltcGxlbWVudGF0aW9uLlxuICAvLyBVbmRlcnNjb3JlIHRlbXBsYXRpbmcgaGFuZGxlcyBhcmJpdHJhcnkgZGVsaW1pdGVycywgcHJlc2VydmVzIHdoaXRlc3BhY2UsXG4gIC8vIGFuZCBjb3JyZWN0bHkgZXNjYXBlcyBxdW90ZXMgd2l0aGluIGludGVycG9sYXRlZCBjb2RlLlxuICBfLnRlbXBsYXRlID0gZnVuY3Rpb24odGV4dCwgZGF0YSwgc2V0dGluZ3MpIHtcbiAgICB2YXIgcmVuZGVyO1xuICAgIHNldHRpbmdzID0gXy5kZWZhdWx0cyh7fSwgc2V0dGluZ3MsIF8udGVtcGxhdGVTZXR0aW5ncyk7XG5cbiAgICAvLyBDb21iaW5lIGRlbGltaXRlcnMgaW50byBvbmUgcmVndWxhciBleHByZXNzaW9uIHZpYSBhbHRlcm5hdGlvbi5cbiAgICB2YXIgbWF0Y2hlciA9IG5ldyBSZWdFeHAoW1xuICAgICAgKHNldHRpbmdzLmVzY2FwZSB8fCBub01hdGNoKS5zb3VyY2UsXG4gICAgICAoc2V0dGluZ3MuaW50ZXJwb2xhdGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmV2YWx1YXRlIHx8IG5vTWF0Y2gpLnNvdXJjZVxuICAgIF0uam9pbignfCcpICsgJ3wkJywgJ2cnKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIHRlbXBsYXRlIHNvdXJjZSwgZXNjYXBpbmcgc3RyaW5nIGxpdGVyYWxzIGFwcHJvcHJpYXRlbHkuXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB2YXIgc291cmNlID0gXCJfX3ArPSdcIjtcbiAgICB0ZXh0LnJlcGxhY2UobWF0Y2hlciwgZnVuY3Rpb24obWF0Y2gsIGVzY2FwZSwgaW50ZXJwb2xhdGUsIGV2YWx1YXRlLCBvZmZzZXQpIHtcbiAgICAgIHNvdXJjZSArPSB0ZXh0LnNsaWNlKGluZGV4LCBvZmZzZXQpXG4gICAgICAgIC5yZXBsYWNlKGVzY2FwZXIsIGZ1bmN0aW9uKG1hdGNoKSB7IHJldHVybiAnXFxcXCcgKyBlc2NhcGVzW21hdGNoXTsgfSk7XG5cbiAgICAgIGlmIChlc2NhcGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBlc2NhcGUgKyBcIikpPT1udWxsPycnOl8uZXNjYXBlKF9fdCkpK1xcbidcIjtcbiAgICAgIH1cbiAgICAgIGlmIChpbnRlcnBvbGF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGludGVycG9sYXRlICsgXCIpKT09bnVsbD8nJzpfX3QpK1xcbidcIjtcbiAgICAgIH1cbiAgICAgIGlmIChldmFsdWF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInO1xcblwiICsgZXZhbHVhdGUgKyBcIlxcbl9fcCs9J1wiO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgfSk7XG4gICAgc291cmNlICs9IFwiJztcXG5cIjtcblxuICAgIC8vIElmIGEgdmFyaWFibGUgaXMgbm90IHNwZWNpZmllZCwgcGxhY2UgZGF0YSB2YWx1ZXMgaW4gbG9jYWwgc2NvcGUuXG4gICAgaWYgKCFzZXR0aW5ncy52YXJpYWJsZSkgc291cmNlID0gJ3dpdGgob2JqfHx7fSl7XFxuJyArIHNvdXJjZSArICd9XFxuJztcblxuICAgIHNvdXJjZSA9IFwidmFyIF9fdCxfX3A9JycsX19qPUFycmF5LnByb3RvdHlwZS5qb2luLFwiICtcbiAgICAgIFwicHJpbnQ9ZnVuY3Rpb24oKXtfX3ArPV9fai5jYWxsKGFyZ3VtZW50cywnJyk7fTtcXG5cIiArXG4gICAgICBzb3VyY2UgKyBcInJldHVybiBfX3A7XFxuXCI7XG5cbiAgICB0cnkge1xuICAgICAgcmVuZGVyID0gbmV3IEZ1bmN0aW9uKHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonLCAnXycsIHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGlmIChkYXRhKSByZXR1cm4gcmVuZGVyKGRhdGEsIF8pO1xuICAgIHZhciB0ZW1wbGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiByZW5kZXIuY2FsbCh0aGlzLCBkYXRhLCBfKTtcbiAgICB9O1xuXG4gICAgLy8gUHJvdmlkZSB0aGUgY29tcGlsZWQgZnVuY3Rpb24gc291cmNlIGFzIGEgY29udmVuaWVuY2UgZm9yIHByZWNvbXBpbGF0aW9uLlxuICAgIHRlbXBsYXRlLnNvdXJjZSA9ICdmdW5jdGlvbignICsgKHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonKSArICcpe1xcbicgKyBzb3VyY2UgKyAnfSc7XG5cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH07XG5cbiAgLy8gQWRkIGEgXCJjaGFpblwiIGZ1bmN0aW9uLCB3aGljaCB3aWxsIGRlbGVnYXRlIHRvIHRoZSB3cmFwcGVyLlxuICBfLmNoYWluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIF8ob2JqKS5jaGFpbigpO1xuICB9O1xuXG4gIC8vIE9PUFxuICAvLyAtLS0tLS0tLS0tLS0tLS1cbiAgLy8gSWYgVW5kZXJzY29yZSBpcyBjYWxsZWQgYXMgYSBmdW5jdGlvbiwgaXQgcmV0dXJucyBhIHdyYXBwZWQgb2JqZWN0IHRoYXRcbiAgLy8gY2FuIGJlIHVzZWQgT08tc3R5bGUuIFRoaXMgd3JhcHBlciBob2xkcyBhbHRlcmVkIHZlcnNpb25zIG9mIGFsbCB0aGVcbiAgLy8gdW5kZXJzY29yZSBmdW5jdGlvbnMuIFdyYXBwZWQgb2JqZWN0cyBtYXkgYmUgY2hhaW5lZC5cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29udGludWUgY2hhaW5pbmcgaW50ZXJtZWRpYXRlIHJlc3VsdHMuXG4gIHZhciByZXN1bHQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdGhpcy5fY2hhaW4gPyBfKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfTtcblxuICAvLyBBZGQgYWxsIG9mIHRoZSBVbmRlcnNjb3JlIGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlciBvYmplY3QuXG4gIF8ubWl4aW4oXyk7XG5cbiAgLy8gQWRkIGFsbCBtdXRhdG9yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgZWFjaChbJ3BvcCcsICdwdXNoJywgJ3JldmVyc2UnLCAnc2hpZnQnLCAnc29ydCcsICdzcGxpY2UnLCAndW5zaGlmdCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgbWV0aG9kLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIGlmICgobmFtZSA9PSAnc2hpZnQnIHx8IG5hbWUgPT0gJ3NwbGljZScpICYmIG9iai5sZW5ndGggPT09IDApIGRlbGV0ZSBvYmpbMF07XG4gICAgICByZXR1cm4gcmVzdWx0LmNhbGwodGhpcywgb2JqKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBBZGQgYWxsIGFjY2Vzc29yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgZWFjaChbJ2NvbmNhdCcsICdqb2luJywgJ3NsaWNlJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG1ldGhvZC5hcHBseSh0aGlzLl93cmFwcGVkLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9KTtcblxuICBfLmV4dGVuZChfLnByb3RvdHlwZSwge1xuXG4gICAgLy8gU3RhcnQgY2hhaW5pbmcgYSB3cmFwcGVkIFVuZGVyc2NvcmUgb2JqZWN0LlxuICAgIGNoYWluOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX2NoYWluID0gdHJ1ZTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBFeHRyYWN0cyB0aGUgcmVzdWx0IGZyb20gYSB3cmFwcGVkIGFuZCBjaGFpbmVkIG9iamVjdC5cbiAgICB2YWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgICB9XG5cbiAgfSk7XG5cbiAgLy8gQU1EIHJlZ2lzdHJhdGlvbiBoYXBwZW5zIGF0IHRoZSBlbmQgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBBTUQgbG9hZGVyc1xuICAvLyB0aGF0IG1heSBub3QgZW5mb3JjZSBuZXh0LXR1cm4gc2VtYW50aWNzIG9uIG1vZHVsZXMuIEV2ZW4gdGhvdWdoIGdlbmVyYWxcbiAgLy8gcHJhY3RpY2UgZm9yIEFNRCByZWdpc3RyYXRpb24gaXMgdG8gYmUgYW5vbnltb3VzLCB1bmRlcnNjb3JlIHJlZ2lzdGVyc1xuICAvLyBhcyBhIG5hbWVkIG1vZHVsZSBiZWNhdXNlLCBsaWtlIGpRdWVyeSwgaXQgaXMgYSBiYXNlIGxpYnJhcnkgdGhhdCBpc1xuICAvLyBwb3B1bGFyIGVub3VnaCB0byBiZSBidW5kbGVkIGluIGEgdGhpcmQgcGFydHkgbGliLCBidXQgbm90IGJlIHBhcnQgb2ZcbiAgLy8gYW4gQU1EIGxvYWQgcmVxdWVzdC4gVGhvc2UgY2FzZXMgY291bGQgZ2VuZXJhdGUgYW4gZXJyb3Igd2hlbiBhblxuICAvLyBhbm9ueW1vdXMgZGVmaW5lKCkgaXMgY2FsbGVkIG91dHNpZGUgb2YgYSBsb2FkZXIgcmVxdWVzdC5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZSgndW5kZXJzY29yZScsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfO1xuICAgIH0pO1xuICB9XG59KS5jYWxsKHRoaXMpO1xuIl19
