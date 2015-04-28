(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var ConnectorClass, adaptConnector;

ConnectorClass = require("./ConnectorClass");

adaptConnector = function(connector, engine, HB, execution_listener) {
  var applyHB, encode_state_vector, f, getHB, getStateVector, name, parse_state_vector, send_;
  for (name in ConnectorClass) {
    f = ConnectorClass[name];
    connector[name] = f;
  }
  connector.setIsBoundToY();
  send_ = function(o) {
    if ((o.uid.creator === HB.getUserId()) && (typeof o.uid.op_number !== "string") && (HB.getUserId() !== "_temp")) {
      return connector.broadcast(o);
    }
  };
  if (connector.invokeSync != null) {
    HB.setInvokeSyncHandler(connector.invokeSync);
  }
  execution_listener.push(send_);
  encode_state_vector = function(v) {
    var value, _results;
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
  getStateVector = function() {
    return encode_state_vector(HB.getOperationCounter());
  };
  getHB = function(v) {
    var hb, json, state_vector;
    state_vector = parse_state_vector(v);
    hb = HB._encode(state_vector);
    json = {
      hb: hb,
      state_vector: encode_state_vector(HB.getOperationCounter())
    };
    return json;
  };
  applyHB = function(hb, fromHB) {
    return engine.applyOp(hb, fromHB);
  };
  connector.getStateVector = getStateVector;
  connector.getHB = getHB;
  connector.applyHB = applyHB;
  if (connector.receive_handlers == null) {
    connector.receive_handlers = [];
  }
  return connector.receive_handlers.push(function(sender, op) {
    if (op.uid.creator !== HB.getUserId()) {
      return engine.applyOp(op);
    }
  });
};

module.exports = adaptConnector;


},{"./ConnectorClass":2}],2:[function(require,module,exports){
module.exports = {
  init: function(options) {
    var req;
    req = (function(_this) {
      return function(name, choices) {
        if (options[name] != null) {
          if ((choices == null) || choices.some(function(c) {
            return c === options[name];
          })) {
            return _this[name] = options[name];
          } else {
            throw new Error("You can set the '" + name + "' option to one of the following choices: " + JSON.encode(choices));
          }
        } else {
          throw new Error("You must specify " + name + ", when initializing the Connector!");
        }
      };
    })(this);
    req("syncMethod", ["syncAll", "master-slave"]);
    req("role", ["master", "slave"]);
    req("user_id");
    if (typeof this.on_user_id_set === "function") {
      this.on_user_id_set(this.user_id);
    }
    if (options.perform_send_again != null) {
      this.perform_send_again = options.perform_send_again;
    } else {
      this.perform_send_again = true;
    }
    if (this.role === "master") {
      this.syncMethod = "syncAll";
    }
    this.is_synced = false;
    this.connections = {};
    if (this.receive_handlers == null) {
      this.receive_handlers = [];
    }
    this.connections = {};
    this.current_sync_target = null;
    this.sent_hb_to_all_users = false;
    this.is_initialized = true;
    return this.connections_listeners = [];
  },
  onUserEvent: function(f) {
    return this.connections_listeners.push(f);
  },
  isRoleMaster: function() {
    return this.role === "master";
  },
  isRoleSlave: function() {
    return this.role === "slave";
  },
  findNewSyncTarget: function() {
    var c, user, _ref;
    this.current_sync_target = null;
    if (this.syncMethod === "syncAll") {
      _ref = this.connections;
      for (user in _ref) {
        c = _ref[user];
        if (!c.is_synced) {
          this.performSync(user);
          break;
        }
      }
    }
    if (this.current_sync_target == null) {
      this.setStateSynced();
    }
    return null;
  },
  userLeft: function(user) {
    var f, _i, _len, _ref, _results;
    delete this.connections[user];
    this.findNewSyncTarget();
    _ref = this.connections_listeners;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      f = _ref[_i];
      _results.push(f({
        action: "userLeft",
        user: user
      }));
    }
    return _results;
  },
  userJoined: function(user, role) {
    var f, _base, _i, _len, _ref, _results;
    if (role == null) {
      throw new Error("Internal: You must specify the role of the joined user! E.g. userJoined('uid:3939','slave')");
    }
    if ((_base = this.connections)[user] == null) {
      _base[user] = {};
    }
    this.connections[user].is_synced = false;
    if ((!this.is_synced) || this.syncMethod === "syncAll") {
      if (this.syncMethod === "syncAll") {
        this.performSync(user);
      } else if (role === "master") {
        this.performSyncWithMaster(user);
      }
    }
    _ref = this.connections_listeners;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      f = _ref[_i];
      _results.push(f({
        action: "userJoined",
        user: user,
        role: role
      }));
    }
    return _results;
  },
  whenSynced: function(args) {
    if (args.constructore === Function) {
      args = [args];
    }
    if (this.is_synced) {
      return args[0].apply(this, args.slice(1));
    } else {
      if (this.compute_when_synced == null) {
        this.compute_when_synced = [];
      }
      return this.compute_when_synced.push(args);
    }
  },
  onReceive: function(f) {
    return this.receive_handlers.push(f);
  },

  /*
   * Broadcast a message to all connected peers.
   * @param message {Object} The message to broadcast.
   *
  broadcast: (message)->
    throw new Error "You must implement broadcast!"
  
   *
   * Send a message to a peer, or set of peers
   *
  send: (peer_s, message)->
    throw new Error "You must implement send!"
   */
  performSync: function(user) {
    var hb, o, _hb, _i, _len;
    if (this.current_sync_target == null) {
      this.current_sync_target = user;
      this.send(user, {
        sync_step: "getHB",
        send_again: "true",
        data: []
      });
      if (!this.sent_hb_to_all_users) {
        this.sent_hb_to_all_users = true;
        hb = this.getHB([]).hb;
        _hb = [];
        for (_i = 0, _len = hb.length; _i < _len; _i++) {
          o = hb[_i];
          _hb.push(o);
          if (_hb.length > 10) {
            this.broadcast({
              sync_step: "applyHB_",
              data: _hb
            });
            _hb = [];
          }
        }
        return this.broadcast({
          sync_step: "applyHB",
          data: _hb
        });
      }
    }
  },
  performSyncWithMaster: function(user) {
    var hb, o, _hb, _i, _len;
    this.current_sync_target = user;
    this.send(user, {
      sync_step: "getHB",
      send_again: "true",
      data: []
    });
    hb = this.getHB([]).hb;
    _hb = [];
    for (_i = 0, _len = hb.length; _i < _len; _i++) {
      o = hb[_i];
      _hb.push(o);
      if (_hb.length > 10) {
        this.broadcast({
          sync_step: "applyHB_",
          data: _hb
        });
        _hb = [];
      }
    }
    return this.broadcast({
      sync_step: "applyHB",
      data: _hb
    });
  },
  setStateSynced: function() {
    var f, _i, _len, _ref;
    if (!this.is_synced) {
      this.is_synced = true;
      if (this.compute_when_synced != null) {
        _ref = this.compute_when_synced;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          f = _ref[_i];
          f();
        }
        delete this.compute_when_synced;
      }
      return null;
    }
  },
  receiveMessage: function(sender, res) {
    var data, f, hb, o, sendApplyHB, send_again, _hb, _i, _j, _len, _len1, _ref, _results;
    if (res.sync_step == null) {
      _ref = this.receive_handlers;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        _results.push(f(sender, res));
      }
      return _results;
    } else {
      if (sender === this.user_id) {
        return;
      }
      if (res.sync_step === "getHB") {
        data = this.getHB(res.data);
        hb = data.hb;
        _hb = [];
        if (this.is_synced) {
          sendApplyHB = (function(_this) {
            return function(m) {
              return _this.send(sender, m);
            };
          })(this);
        } else {
          sendApplyHB = (function(_this) {
            return function(m) {
              return _this.broadcast(m);
            };
          })(this);
        }
        for (_j = 0, _len1 = hb.length; _j < _len1; _j++) {
          o = hb[_j];
          _hb.push(o);
          if (_hb.length > 10) {
            sendApplyHB({
              sync_step: "applyHB_",
              data: _hb
            });
            _hb = [];
          }
        }
        sendApplyHB({
          sync_step: "applyHB",
          data: _hb
        });
        if ((res.send_again != null) && this.perform_send_again) {
          send_again = (function(_this) {
            return function(sv) {
              return function() {
                hb = _this.getHB(sv).hb;
                return _this.send(sender, {
                  sync_step: "applyHB",
                  data: hb,
                  sent_again: "true"
                });
              };
            };
          })(this)(data.state_vector);
          return setTimeout(send_again, 3000);
        }
      } else if (res.sync_step === "applyHB") {
        this.applyHB(res.data, sender === this.current_sync_target);
        if ((this.syncMethod === "syncAll" || (res.sent_again != null)) && (!this.is_synced) && ((this.current_sync_target === sender) || (this.current_sync_target == null))) {
          this.connections[sender].is_synced = true;
          return this.findNewSyncTarget();
        }
      } else if (res.sync_step === "applyHB_") {
        return this.applyHB(res.data, sender === this.current_sync_target);
      }
    }
  },
  parseMessageFromXml: function(m) {
    var parse_array, parse_object;
    parse_array = function(node) {
      var n, _i, _len, _ref, _results;
      _ref = node.children;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        n = _ref[_i];
        if (n.getAttribute("isArray") === "true") {
          _results.push(parse_array(n));
        } else {
          _results.push(parse_object(n));
        }
      }
      return _results;
    };
    parse_object = function(node) {
      var int, json, n, name, value, _i, _len, _ref, _ref1;
      json = {};
      _ref = node.attrs;
      for (name in _ref) {
        value = _ref[name];
        int = parseInt(value);
        if (isNaN(int) || ("" + int) !== value) {
          json[name] = value;
        } else {
          json[name] = int;
        }
      }
      _ref1 = node.children;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        n = _ref1[_i];
        name = n.name;
        if (n.getAttribute("isArray") === "true") {
          json[name] = parse_array(n);
        } else {
          json[name] = parse_object(n);
        }
      }
      return json;
    };
    return parse_object(m);
  },
  encodeMessageToXml: function(m, json) {
    var encode_array, encode_object;
    encode_object = function(m, json) {
      var name, value;
      for (name in json) {
        value = json[name];
        if (value == null) {

        } else if (value.constructor === Object) {
          encode_object(m.c(name), value);
        } else if (value.constructor === Array) {
          encode_array(m.c(name), value);
        } else {
          m.setAttribute(name, value);
        }
      }
      return m;
    };
    encode_array = function(m, array) {
      var e, _i, _len;
      m.setAttribute("isArray", "true");
      for (_i = 0, _len = array.length; _i < _len; _i++) {
        e = array[_i];
        if (e.constructor === Object) {
          encode_object(m.c("array-element"), e);
        } else {
          encode_array(m.c("array-element"), e);
        }
      }
      return m;
    };
    if (json.constructor === Object) {
      return encode_object(m.c("y", {
        xmlns: "http://y.ninja/connector-stanza"
      }), json);
    } else if (json.constructor === Array) {
      return encode_array(m.c("y", {
        xmlns: "http://y.ninja/connector-stanza"
      }), json);
    } else {
      throw new Error("I can't encode this json!");
    }
  },
  setIsBoundToY: function() {
    if (typeof this.on_bound_to_y === "function") {
      this.on_bound_to_y();
    }
    delete this.when_bound_to_y;
    return this.is_bound_to_y = true;
  }
};


},{}],3:[function(require,module,exports){
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
  function Engine(HB, types) {
    this.HB = HB;
    this.types = types;
    this.unprocessed_ops = [];
  }

  Engine.prototype.parseOperation = function(json) {
    var type;
    type = this.types[json.type];
    if ((type != null ? type.parse : void 0) != null) {
      return type.parse(json);
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

  Engine.prototype.applyOp = function(op_json_array, fromHB) {
    var o, op_json, _i, _len;
    if (fromHB == null) {
      fromHB = false;
    }
    if (op_json_array.constructor !== Array) {
      op_json_array = [op_json_array];
    }
    for (_i = 0, _len = op_json_array.length; _i < _len; _i++) {
      op_json = op_json_array[_i];
      if (fromHB) {
        op_json.fromHB = "true";
      }
      o = this.parseOperation(op_json);
      o.parsed_from_json = op_json;
      if (op_json.fromHB != null) {
        o.fromHB = op_json.fromHB;
      }
      if (this.HB.getOperation(o) != null) {

      } else if (((!this.HB.isExpectedOperation(o)) && (o.fromHB == null)) || (!o.execute())) {
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

        } else if ((!this.HB.isExpectedOperation(op) && (op.fromHB == null)) || (!op.execute())) {
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


},{}],4:[function(require,module,exports){
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
    this.garbageCollectTimeout = 30000;
    this.reserved_identifier_counter = 0;
    setTimeout(this.emptyGarbage, this.garbageCollectTimeout);
  }

  HistoryBuffer.prototype.resetUserId = function(id) {
    var o, o_name, own;
    own = this.buffer[this.user_id];
    if (own != null) {
      for (o_name in own) {
        o = own[o_name];
        if (o.uid.creator != null) {
          o.uid.creator = id;
        }
        if (o.uid.alt != null) {
          o.uid.alt.creator = id;
        }
      }
      if (this.buffer[id] != null) {
        throw new Error("You are re-assigning an old user id - this is not (yet) possible!");
      }
      this.buffer[id] = own;
      delete this.buffer[this.user_id];
    }
    if (this.operation_counter[this.user_id] != null) {
      this.operation_counter[id] = this.operation_counter[this.user_id];
      delete this.operation_counter[this.user_id];
    }
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
      op_number: "_" + (this.reserved_identifier_counter++)
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
    o.uid.op_number <= this.operation_counter[o.uid.creator];
    return true;
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
      if (u_name === "_") {
        continue;
      }
      for (o_number in user) {
        o = user[o_number];
        if ((o.uid.noOperation == null) && unknown(u_name, o_number)) {
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
      'op_number': this.operation_counter[user_id]
    };
    this.operation_counter[user_id]++;
    return uid;
  };

  HistoryBuffer.prototype.getOperation = function(uid) {
    var o, _ref;
    if (uid.uid != null) {
      uid = uid.uid;
    }
    o = (_ref = this.buffer[uid.creator]) != null ? _ref[uid.op_number] : void 0;
    if ((uid.sub != null) && (o != null)) {
      return o.retrieveSub(uid.sub);
    } else {
      return o;
    }
  };

  HistoryBuffer.prototype.addOperation = function(o) {
    if (this.buffer[o.uid.creator] == null) {
      this.buffer[o.uid.creator] = {};
    }
    if (this.buffer[o.uid.creator][o.uid.op_number] != null) {
      throw new Error("You must not overwrite operations!");
    }
    if ((o.uid.op_number.constructor !== String) && (!this.isExpectedOperation(o)) && (o.fromHB == null)) {
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
      if (((this.operation_counter[user] == null) || (this.operation_counter[user] < state_vector[user])) && (state_vector[user] != null)) {
        _results.push(this.operation_counter[user] = state_vector[user]);
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  HistoryBuffer.prototype.addToCounter = function(o) {
    var _base, _name;
    if ((_base = this.operation_counter)[_name = o.uid.creator] == null) {
      _base[_name] = 0;
    }
    if (o.uid.creator !== this.getUserId()) {
      if (o.uid.op_number === this.operation_counter[o.uid.creator]) {
        this.operation_counter[o.uid.creator]++;
      }
      while (this.buffer[o.uid.creator][this.operation_counter[o.uid.creator]] != null) {
        this.operation_counter[o.uid.creator]++;
      }
      return void 0;
    }
  };

  return HistoryBuffer;

})();

module.exports = HistoryBuffer;


},{}],5:[function(require,module,exports){
var YObject;

YObject = (function() {
  function YObject(_object) {
    var name, val, _ref;
    this._object = _object != null ? _object : {};
    if (this._object.constructor === Object) {
      _ref = this._object;
      for (name in _ref) {
        val = _ref[name];
        if (val.constructor === Object) {
          this._object[name] = new YObject(val);
        }
      }
    } else {
      throw new Error("Y.Object accepts Json Objects only");
    }
  }

  YObject.prototype._name = "Object";

  YObject.prototype._getModel = function(types, ops) {
    var n, o, _ref;
    if (this._model == null) {
      this._model = new ops.MapManager(this).execute();
      _ref = this._object;
      for (n in _ref) {
        o = _ref[n];
        this._model.val(n, o);
      }
    }
    delete this._object;
    return this._model;
  };

  YObject.prototype._setModel = function(_model) {
    this._model = _model;
    return delete this._object;
  };

  YObject.prototype.observe = function(f) {
    this._model.observe(f);
    return this;
  };

  YObject.prototype.unobserve = function(f) {
    this._model.unobserve(f);
    return this;
  };

  YObject.prototype.val = function(name, content) {
    var n, res, v, _ref;
    if (this._model != null) {
      return this._model.val.apply(this._model, arguments);
    } else {
      if (content != null) {
        return this._object[name] = content;
      } else if (name != null) {
        return this._object[name];
      } else {
        res = {};
        _ref = this._object;
        for (n in _ref) {
          v = _ref[n];
          res[n] = v;
        }
        return res;
      }
    }
  };

  YObject.prototype["delete"] = function(name) {
    this._model["delete"](name);
    return this;
  };

  return YObject;

})();

if (typeof window !== "undefined" && window !== null) {
  if (window.Y != null) {
    window.Y.Object = YObject;
  } else {
    throw new Error("You must first import Y!");
  }
}

if (typeof module !== "undefined" && module !== null) {
  module.exports = YObject;
}


},{}],6:[function(require,module,exports){
var __slice = [].slice,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = function() {
  var execution_listener, ops;
  ops = {};
  execution_listener = [];
  ops.Operation = (function() {
    function Operation(custom_type, uid, content, content_operations) {
      var name, op;
      if (custom_type != null) {
        this.custom_type = custom_type;
      }
      this.is_deleted = false;
      this.garbage_collected = false;
      this.event_listeners = [];
      if (uid != null) {
        this.uid = uid;
      }
      if (content === void 0) {

      } else if ((content != null) && (content.creator != null)) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      if (content_operations != null) {
        this.content_operations = {};
        for (name in content_operations) {
          op = content_operations[name];
          this.saveOperation(name, op, 'content_operations');
        }
      }
    }

    Operation.prototype.type = "Operation";

    Operation.prototype.getContent = function(name) {
      var content, n, v, _ref, _ref1;
      if (this.content != null) {
        if (this.content.getCustomType != null) {
          return this.content.getCustomType();
        } else if (this.content.constructor === Object) {
          if (name != null) {
            if (this.content[name] != null) {
              return this.content[name];
            } else {
              return this.content_operations[name].getCustomType();
            }
          } else {
            content = {};
            _ref = this.content;
            for (n in _ref) {
              v = _ref[n];
              content[n] = v;
            }
            if (this.content_operations != null) {
              _ref1 = this.content_operations;
              for (n in _ref1) {
                v = _ref1[n];
                v = v.getCustomType();
                content[n] = v;
              }
            }
            return content;
          }
        } else {
          return this.content;
        }
      } else {
        return this.content;
      }
    };

    Operation.prototype.retrieveSub = function() {
      throw new Error("sub properties are not enable on this operation type!");
    };

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

    Operation.prototype["delete"] = function() {
      (new ops.Delete(void 0, this)).execute();
      return null;
    };

    Operation.prototype.callEvent = function() {
      var callon;
      if (this.custom_type != null) {
        callon = this.getCustomType();
      } else {
        callon = this;
      }
      return this.forwardEvent.apply(this, [callon].concat(__slice.call(arguments)));
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
          return this.HB.addToGarbageCollector(this);
        }
      }
    };

    Operation.prototype.cleanup = function() {
      this.HB.removeOperation(this);
      return this.deleteAllObservers();
    };

    Operation.prototype.setParent = function(parent) {
      this.parent = parent;
    };

    Operation.prototype.getParent = function() {
      return this.parent;
    };

    Operation.prototype.getUid = function() {
      var map_uid;
      if (this.uid.noOperation == null) {
        return this.uid;
      } else {
        if (this.uid.alt != null) {
          map_uid = this.uid.alt.cloneUid();
          map_uid.sub = this.uid.sub;
          return map_uid;
        } else {
          return void 0;
        }
      }
    };

    Operation.prototype.cloneUid = function() {
      var n, uid, v, _ref;
      uid = {};
      _ref = this.getUid();
      for (n in _ref) {
        v = _ref[n];
        uid[n] = v;
      }
      return uid;
    };

    Operation.prototype.execute = function() {
      var l, _i, _len;
      if (this.validateSavedOperations()) {
        this.is_executed = true;
        if (this.uid == null) {
          this.uid = this.HB.getNextOperationIdentifier();
        }
        if (this.uid.noOperation == null) {
          this.HB.addOperation(this);
          for (_i = 0, _len = execution_listener.length; _i < _len; _i++) {
            l = execution_listener[_i];
            l(this._encode());
          }
        }
        return this;
      } else {
        return false;
      }
    };

    Operation.prototype.saveOperation = function(name, op, base) {
      var dest, last_path, path, paths, _base, _i, _len;
      if (base == null) {
        base = "this";
      }
      if ((op != null) && (op._getModel != null)) {
        op = op._getModel(this.custom_types, this.operations);
      }
      if (op == null) {

      } else if ((op.execute != null) || !((op.op_number != null) && (op.creator != null))) {
        if (base === "this") {
          return this[name] = op;
        } else {
          dest = this[base];
          paths = name.split("/");
          last_path = paths.pop();
          for (_i = 0, _len = paths.length; _i < _len; _i++) {
            path = paths[_i];
            dest = dest[path];
          }
          return dest[last_path] = op;
        }
      } else {
        if (this.unchecked == null) {
          this.unchecked = {};
        }
        if ((_base = this.unchecked)[base] == null) {
          _base[base] = {};
        }
        return this.unchecked[base][name] = op;
      }
    };

    Operation.prototype.validateSavedOperations = function() {
      var base, base_name, dest, last_path, name, op, op_uid, path, paths, success, uninstantiated, _i, _len, _ref;
      uninstantiated = {};
      success = true;
      _ref = this.unchecked;
      for (base_name in _ref) {
        base = _ref[base_name];
        for (name in base) {
          op_uid = base[name];
          op = this.HB.getOperation(op_uid);
          if (op) {
            if (base_name === "this") {
              this[name] = op;
            } else {
              dest = this[base_name];
              paths = name.split("/");
              last_path = paths.pop();
              for (_i = 0, _len = paths.length; _i < _len; _i++) {
                path = paths[_i];
                dest = dest[path];
              }
              dest[last_path] = op;
            }
          } else {
            if (uninstantiated[base_name] == null) {
              uninstantiated[base_name] = {};
            }
            uninstantiated[base_name][name] = op_uid;
            success = false;
          }
        }
      }
      if (!success) {
        this.unchecked = uninstantiated;
        return false;
      } else {
        delete this.unchecked;
        return this;
      }
    };

    Operation.prototype.getCustomType = function() {
      var Type, t, _i, _len, _ref;
      if (this.custom_type == null) {
        return this;
      } else {
        if (this.custom_type.constructor === String) {
          Type = this.custom_types;
          _ref = this.custom_type.split(".");
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            t = _ref[_i];
            Type = Type[t];
          }
          this.custom_type = new Type();
          this.custom_type._setModel(this);
        }
        return this.custom_type;
      }
    };

    Operation.prototype._encode = function(json) {
      var n, o, operations, _ref, _ref1;
      if (json == null) {
        json = {};
      }
      json.type = this.type;
      json.uid = this.getUid();
      if (this.custom_type != null) {
        if (this.custom_type.constructor === String) {
          json.custom_type = this.custom_type;
        } else {
          json.custom_type = this.custom_type._name;
        }
      }
      if (((_ref = this.content) != null ? _ref.getUid : void 0) != null) {
        json.content = this.content.getUid();
      } else {
        json.content = this.content;
      }
      if (this.content_operations != null) {
        operations = {};
        _ref1 = this.content_operations;
        for (n in _ref1) {
          o = _ref1[n];
          if (o._getModel != null) {
            o = o._getModel(this.custom_types, this.operations);
          }
          operations[n] = o.getUid();
        }
        json.content_operations = operations;
      }
      return json;
    };

    return Operation;

  })();
  ops.Delete = (function(_super) {
    __extends(Delete, _super);

    function Delete(custom_type, uid, deletes) {
      this.saveOperation('deletes', deletes);
      Delete.__super__.constructor.call(this, custom_type, uid);
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

  })(ops.Operation);
  ops.Delete.parse = function(o) {
    var deletes_uid, uid;
    uid = o['uid'], deletes_uid = o['deletes'];
    return new this(null, uid, deletes_uid);
  };
  ops.Insert = (function(_super) {
    __extends(Insert, _super);

    function Insert(custom_type, content, content_operations, parent, uid, prev_cl, next_cl, origin) {
      this.saveOperation('parent', parent);
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      if (origin != null) {
        this.saveOperation('origin', origin);
      } else {
        this.saveOperation('origin', prev_cl);
      }
      Insert.__super__.constructor.call(this, custom_type, uid, content, content_operations);
    }

    Insert.prototype.type = "Insert";

    Insert.prototype.val = function() {
      return this.getContent();
    };

    Insert.prototype.getNext = function(i) {
      var n;
      if (i == null) {
        i = 1;
      }
      n = this;
      while (i > 0 && (n.next_cl != null)) {
        n = n.next_cl;
        if (!n.is_deleted) {
          i--;
        }
      }
      if (n.is_deleted) {
        null;
      }
      return n;
    };

    Insert.prototype.getPrev = function(i) {
      var n;
      if (i == null) {
        i = 1;
      }
      n = this;
      while (i > 0 && (n.prev_cl != null)) {
        n = n.prev_cl;
        if (!n.is_deleted) {
          i--;
        }
      }
      if (n.is_deleted) {
        return null;
      } else {
        return n;
      }
    };

    Insert.prototype.applyDelete = function(o) {
      var callLater, garbagecollect;
      if (this.deleted_by == null) {
        this.deleted_by = [];
      }
      callLater = false;
      if ((this.parent != null) && !this.is_deleted && (o != null)) {
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
        this.parent.callOperationSpecificDeleteEvents(this, o);
      }
      if ((this.prev_cl != null) && this.prev_cl.isDeleted()) {
        return this.prev_cl.applyDelete();
      }
    };

    Insert.prototype.cleanup = function() {
      var d, o, _i, _len, _ref;
      if (this.next_cl.isDeleted()) {
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
        if (this.content instanceof ops.Operation && !(this.content instanceof ops.Insert)) {
          this.content.referenced_by--;
          if (this.content.referenced_by <= 0 && !this.content.is_deleted) {
            this.content.applyDelete();
          }
        }
        delete this.content;
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
      var distance_to_origin, i, o, _base;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (this.content instanceof ops.Operation) {
          this.content.insert_parent = this;
          if ((_base = this.content).referenced_by == null) {
            _base.referenced_by = 0;
          }
          this.content.referenced_by++;
        }
        if (this.parent != null) {
          if (this.prev_cl == null) {
            this.prev_cl = this.parent.beginning;
          }
          if (this.origin == null) {
            this.origin = this.prev_cl;
          } else if (this.origin === "Delimiter") {
            this.origin = this.parent.beginning;
          }
          if (this.next_cl == null) {
            this.next_cl = this.parent.end;
          }
        }
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
        this.parent.callOperationSpecificInsertEvents(this);
        return this;
      }
    };

    Insert.prototype.getPosition = function() {
      var position, prev;
      position = 0;
      prev = this.prev_cl;
      while (true) {
        if (prev instanceof ops.Delimiter) {
          break;
        }
        if (!prev.isDeleted()) {
          position++;
        }
        prev = prev.prev_cl;
      }
      return position;
    };

    Insert.prototype._encode = function(json) {
      if (json == null) {
        json = {};
      }
      json.prev = this.prev_cl.getUid();
      json.next = this.next_cl.getUid();
      if (this.origin.type === "Delimiter") {
        json.origin = "Delimiter";
      } else if (this.origin !== this.prev_cl) {
        json.origin = this.origin.getUid();
      }
      json.parent = this.parent.getUid();
      return Insert.__super__._encode.call(this, json);
    };

    return Insert;

  })(ops.Operation);
  ops.Insert.parse = function(json) {
    var content, content_operations, next, origin, parent, prev, uid;
    content = json['content'], content_operations = json['content_operations'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], parent = json['parent'];
    return new this(null, content, content_operations, parent, uid, prev, next, origin);
  };
  ops.Delimiter = (function(_super) {
    __extends(Delimiter, _super);

    function Delimiter(prev_cl, next_cl, origin) {
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      this.saveOperation('origin', prev_cl);
      Delimiter.__super__.constructor.call(this, null, {
        noOperation: true
      });
    }

    Delimiter.prototype.type = "Delimiter";

    Delimiter.prototype.applyDelete = function() {
      var o;
      Delimiter.__super__.applyDelete.call(this);
      o = this.prev_cl;
      while (o != null) {
        o.applyDelete();
        o = o.prev_cl;
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
        'type': this.type,
        'uid': this.getUid(),
        'prev': (_ref = this.prev_cl) != null ? _ref.getUid() : void 0,
        'next': (_ref1 = this.next_cl) != null ? _ref1.getUid() : void 0
      };
    };

    return Delimiter;

  })(ops.Operation);
  ops.Delimiter.parse = function(json) {
    var next, prev, uid;
    uid = json['uid'], prev = json['prev'], next = json['next'];
    return new this(uid, prev, next);
  };
  return {
    'operations': ops,
    'execution_listener': execution_listener
  };
};


},{}],7:[function(require,module,exports){
var basic_ops_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

basic_ops_uninitialized = require("./Basic");

module.exports = function() {
  var basic_ops, ops;
  basic_ops = basic_ops_uninitialized();
  ops = basic_ops.operations;
  ops.MapManager = (function(_super) {
    __extends(MapManager, _super);

    function MapManager(custom_type, uid, content, content_operations) {
      this._map = {};
      MapManager.__super__.constructor.call(this, custom_type, uid, content, content_operations);
    }

    MapManager.prototype.type = "MapManager";

    MapManager.prototype.applyDelete = function() {
      var name, p, _ref;
      _ref = this._map;
      for (name in _ref) {
        p = _ref[name];
        p.applyDelete();
      }
      return MapManager.__super__.applyDelete.call(this);
    };

    MapManager.prototype.cleanup = function() {
      return MapManager.__super__.cleanup.call(this);
    };

    MapManager.prototype.map = function(f) {
      var n, v, _ref;
      _ref = this._map;
      for (n in _ref) {
        v = _ref[n];
        f(n, v);
      }
      return void 0;
    };

    MapManager.prototype.val = function(name, content) {
      var o, prop, rep, res, result, _ref;
      if (arguments.length > 1) {
        if ((content != null) && (content._getModel != null)) {
          rep = content._getModel(this.custom_types, this.operations);
        } else {
          rep = content;
        }
        this.retrieveSub(name).replace(rep);
        return this.getCustomType();
      } else if (name != null) {
        prop = this._map[name];
        if ((prop != null) && !prop.isContentDeleted()) {
          res = prop.val();
          if (res instanceof ops.Operation) {
            return res.getCustomType();
          } else {
            return res;
          }
        } else {
          return void 0;
        }
      } else {
        result = {};
        _ref = this._map;
        for (name in _ref) {
          o = _ref[name];
          if (!o.isContentDeleted()) {
            result[name] = o.val();
          }
        }
        return result;
      }
    };

    MapManager.prototype["delete"] = function(name) {
      var _ref;
      if ((_ref = this._map[name]) != null) {
        _ref.deleteContent();
      }
      return this;
    };

    MapManager.prototype.retrieveSub = function(property_name) {
      var event_properties, event_this, rm, rm_uid;
      if (this._map[property_name] == null) {
        event_properties = {
          name: property_name
        };
        event_this = this;
        rm_uid = {
          noOperation: true,
          sub: property_name,
          alt: this
        };
        rm = new ops.ReplaceManager(null, event_properties, event_this, rm_uid);
        this._map[property_name] = rm;
        rm.setParent(this, property_name);
        rm.execute();
      }
      return this._map[property_name];
    };

    return MapManager;

  })(ops.Operation);
  ops.MapManager.parse = function(json) {
    var content, content_operations, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], content = json['content'], content_operations = json['content_operations'];
    return new this(custom_type, uid, content, content_operations);
  };
  ops.ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(custom_type, uid, content, content_operations) {
      this.beginning = new ops.Delimiter(void 0, void 0);
      this.end = new ops.Delimiter(this.beginning, void 0);
      this.beginning.next_cl = this.end;
      this.beginning.execute();
      this.end.execute();
      ListManager.__super__.constructor.call(this, custom_type, uid, content, content_operations);
    }

    ListManager.prototype.type = "ListManager";

    ListManager.prototype.applyDelete = function() {
      var o;
      o = this.beginning;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
      }
      return ListManager.__super__.applyDelete.call(this);
    };

    ListManager.prototype.cleanup = function() {
      return ListManager.__super__.cleanup.call(this);
    };

    ListManager.prototype.toJson = function(transform_to_value) {
      var i, o, val, _i, _len, _results;
      if (transform_to_value == null) {
        transform_to_value = false;
      }
      val = this.val();
      _results = [];
      for (o = _i = 0, _len = val.length; _i < _len; o = ++_i) {
        i = val[o];
        if (o instanceof ops.Object) {
          _results.push(o.toJson(transform_to_value));
        } else if (o instanceof ops.ListManager) {
          _results.push(o.toJson(transform_to_value));
        } else if (transform_to_value && o instanceof ops.Operation) {
          _results.push(o.val());
        } else {
          _results.push(o);
        }
      }
      return _results;
    };

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
        if (!o.is_deleted) {
          result.push(o.val());
        }
        o = o.next_cl;
      }
      return result;
    };

    ListManager.prototype.map = function(f) {
      var o, result;
      o = this.beginning.next_cl;
      result = [];
      while (o !== this.end) {
        if (!o.is_deleted) {
          result.push(f(o));
        }
        o = o.next_cl;
      }
      return result;
    };

    ListManager.prototype.fold = function(init, f) {
      var o;
      o = this.beginning.next_cl;
      while (o !== this.end) {
        if (!o.is_deleted) {
          init = f(init, o);
        }
        o = o.next_cl;
      }
      return init;
    };

    ListManager.prototype.val = function(pos) {
      var o;
      if (pos != null) {
        o = this.getOperationByPosition(pos + 1);
        if (!(o instanceof ops.Delimiter)) {
          return o.val();
        } else {
          throw new Error("this position does not exist");
        }
      } else {
        return this.toArray();
      }
    };

    ListManager.prototype.ref = function(pos) {
      var o;
      if (pos != null) {
        o = this.getOperationByPosition(pos + 1);
        if (!(o instanceof ops.Delimiter)) {
          return o;
        } else {
          return null;
        }
      } else {
        throw new Error("you must specify a position parameter");
      }
    };

    ListManager.prototype.getOperationByPosition = function(position) {
      var o;
      o = this.beginning;
      while (true) {
        if (o instanceof ops.Delimiter && (o.prev_cl != null)) {
          o = o.prev_cl;
          while (o.isDeleted() && (o.prev_cl != null)) {
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

    ListManager.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, [content]);
    };

    ListManager.prototype.insertAfter = function(left, contents) {
      var c, right, tmp, _i, _len;
      right = left.next_cl;
      while (right.isDeleted()) {
        right = right.next_cl;
      }
      left = right.prev_cl;
      if (contents instanceof ops.Operation) {
        (new ops.Insert(null, content, null, void 0, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = contents.length; _i < _len; _i++) {
          c = contents[_i];
          if ((c != null) && (c._name != null) && (c._getModel != null)) {
            c = c._getModel(this.custom_types, this.operations);
          }
          tmp = (new ops.Insert(null, c, null, void 0, void 0, left, right)).execute();
          left = tmp;
        }
      }
      return this;
    };

    ListManager.prototype.insert = function(position, contents) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, contents);
    };

    ListManager.prototype["delete"] = function(position, length) {
      var d, delete_ops, i, o, _i;
      if (length == null) {
        length = 1;
      }
      o = this.getOperationByPosition(position + 1);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof ops.Delimiter) {
          break;
        }
        d = (new ops.Delete(null, void 0, o)).execute();
        o = o.next_cl;
        while ((!(o instanceof ops.Delimiter)) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return this;
    };

    ListManager.prototype.callOperationSpecificInsertEvents = function(op) {
      var getContentType;
      getContentType = function(content) {
        if (content instanceof ops.Operation) {
          return content.getCustomType();
        } else {
          return content;
        }
      };
      return this.callEvent([
        {
          type: "insert",
          reference: op,
          position: op.getPosition(),
          object: this.getCustomType(),
          changedBy: op.uid.creator,
          value: getContentType(op.val())
        }
      ]);
    };

    ListManager.prototype.callOperationSpecificDeleteEvents = function(op, del_op) {
      return this.callEvent([
        {
          type: "delete",
          reference: op,
          position: op.getPosition(),
          object: this.getCustomType(),
          length: 1,
          changedBy: del_op.uid.creator,
          oldValue: op.val()
        }
      ]);
    };

    return ListManager;

  })(ops.Operation);
  ops.ListManager.parse = function(json) {
    var content, content_operations, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], content = json['content'], content_operations = json['content_operations'];
    return new this(custom_type, uid, content, content_operations);
  };
  ops.Composition = (function(_super) {
    __extends(Composition, _super);

    function Composition(custom_type, _composition_value, composition_value_operations, uid, tmp_composition_ref) {
      var n, o;
      this._composition_value = _composition_value;
      Composition.__super__.constructor.call(this, custom_type, uid);
      if (tmp_composition_ref != null) {
        this.tmp_composition_ref = tmp_composition_ref;
      } else {
        this.composition_ref = this.end.prev_cl;
      }
      if (composition_value_operations != null) {
        this.composition_value_operations = {};
        for (n in composition_value_operations) {
          o = composition_value_operations[n];
          this.saveOperation(n, o, '_composition_value');
        }
      }
    }

    Composition.prototype.type = "Composition";

    Composition.prototype.execute = function() {
      if (this.validateSavedOperations()) {
        this.getCustomType()._setCompositionValue(this._composition_value);
        delete this._composition_value;
        return Composition.__super__.execute.apply(this, arguments);
      } else {
        return false;
      }
    };

    Composition.prototype.callOperationSpecificInsertEvents = function(op) {
      var o;
      if (this.tmp_composition_ref != null) {
        if (op.uid.creator === this.tmp_composition_ref.creator && op.uid.op_number === this.tmp_composition_ref.op_number) {
          this.composition_ref = op;
          delete this.tmp_composition_ref;
          o = op.next_cl;
          while (o.next_cl != null) {
            if (!o.isDeleted()) {
              this.callOperationSpecificInsertEvents(o);
            }
            o = o.next_cl;
          }
        }
        return;
      }
      if (this.composition_ref.next_cl === op) {
        op.undo_delta = this.getCustomType()._apply(op.val());
      } else {
        o = this.end.prev_cl;
        while (o !== op) {
          this.getCustomType()._unapply(o.undo_delta);
          o = o.prev_cl;
        }
        while (o !== this.end) {
          o.undo_delta = this.getCustomType()._apply(o.val());
          o = o.next_cl;
        }
      }
      this.composition_ref = this.end.prev_cl;
      return this.callEvent([
        {
          type: "update",
          changedBy: op.uid.creator,
          newValue: this.val()
        }
      ]);
    };

    Composition.prototype.callOperationSpecificDeleteEvents = function(op, del_op) {};

    Composition.prototype.applyDelta = function(delta, operations) {
      (new ops.Insert(null, delta, operations, this, null, this.end.prev_cl, this.end)).execute();
      return void 0;
    };

    Composition.prototype._encode = function(json) {
      var custom, n, o, _ref;
      if (json == null) {
        json = {};
      }
      custom = this.getCustomType()._getCompositionValue();
      json.composition_value = custom.composition_value;
      if (custom.composition_value_operations != null) {
        json.composition_value_operations = {};
        _ref = custom.composition_value_operations;
        for (n in _ref) {
          o = _ref[n];
          json.composition_value_operations[n] = o.getUid();
        }
      }
      if (this.composition_ref != null) {
        json.composition_ref = this.composition_ref.getUid();
      } else {
        json.composition_ref = this.tmp_composition_ref;
      }
      return Composition.__super__._encode.call(this, json);
    };

    return Composition;

  })(ops.ListManager);
  ops.Composition.parse = function(json) {
    var composition_ref, composition_value, composition_value_operations, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], composition_value = json['composition_value'], composition_value_operations = json['composition_value_operations'], composition_ref = json['composition_ref'];
    return new this(custom_type, composition_value, composition_value_operations, uid, composition_ref);
  };
  ops.ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(custom_type, event_properties, event_this, uid) {
      this.event_properties = event_properties;
      this.event_this = event_this;
      if (this.event_properties['object'] == null) {
        this.event_properties['object'] = this.event_this.getCustomType();
      }
      ReplaceManager.__super__.constructor.call(this, custom_type, uid);
    }

    ReplaceManager.prototype.type = "ReplaceManager";

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

    ReplaceManager.prototype.callOperationSpecificInsertEvents = function(op) {
      var old_value;
      if (op.next_cl.type === "Delimiter" && op.prev_cl.type !== "Delimiter") {
        if (!op.is_deleted) {
          old_value = op.prev_cl.val();
          this.callEventDecorator([
            {
              type: "update",
              changedBy: op.uid.creator,
              oldValue: old_value
            }
          ]);
        }
        op.prev_cl.applyDelete();
      } else if (op.next_cl.type !== "Delimiter") {
        op.applyDelete();
      } else {
        this.callEventDecorator([
          {
            type: "add",
            changedBy: op.uid.creator
          }
        ]);
      }
      return void 0;
    };

    ReplaceManager.prototype.callOperationSpecificDeleteEvents = function(op, del_op) {
      if (op.next_cl.type === "Delimiter") {
        return this.callEventDecorator([
          {
            type: "delete",
            changedBy: del_op.uid.creator,
            oldValue: op.val()
          }
        ]);
      }
    };

    ReplaceManager.prototype.replace = function(content, replaceable_uid) {
      var o, relp;
      o = this.getLastOperation();
      relp = (new ops.Insert(null, content, null, this, replaceable_uid, o, o.next_cl)).execute();
      return void 0;
    };

    ReplaceManager.prototype.isContentDeleted = function() {
      return this.getLastOperation().isDeleted();
    };

    ReplaceManager.prototype.deleteContent = function() {
      (new ops.Delete(null, void 0, this.getLastOperation().uid)).execute();
      return void 0;
    };

    ReplaceManager.prototype.val = function() {
      var o;
      o = this.getLastOperation();
      return typeof o.val === "function" ? o.val() : void 0;
    };

    return ReplaceManager;

  })(ops.ListManager);
  return basic_ops;
};


},{"./Basic":6}],8:[function(require,module,exports){
var Y, bindToChildren;

Y = require('./y');

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

Polymer("y-object", {
  ready: function() {
    if (this.connector != null) {
      this.val = new Y(this.connector);
      return bindToChildren(this);
    } else if (this.val != null) {
      return bindToChildren(this);
    }
  },
  valChanged: function() {
    if ((this.val != null) && this.val.type === "Object") {
      return bindToChildren(this);
    }
  },
  connectorChanged: function() {
    if (this.val == null) {
      this.val = new Y(this.connector);
      return bindToChildren(this);
    }
  }
});

Polymer("y-property", {
  ready: function() {
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        this.val = this.parentElement.val(this.name, this.val).val(this.name);
      } else if (typeof this.val === "string") {
        this.parentElement.val(this.name, this.val);
      }
      if (this.val.type === "Object") {
        return bindToChildren(this);
      }
    }
  },
  valChanged: function() {
    var _ref;
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        return this.val = this.parentElement.val.val(this.name, this.val).val(this.name);
      } else if (this.val.type === "Object") {
        return bindToChildren(this);
      } else if ((((_ref = this.parentElement.val) != null ? _ref.val : void 0) != null) && this.val !== this.parentElement.val.val(this.name)) {
        return this.parentElement.val.val(this.name, this.val);
      }
    }
  }
});


},{"./y":9}],9:[function(require,module,exports){
var Engine, HistoryBuffer, adaptConnector, createY, structured_ops_uninitialized;

structured_ops_uninitialized = require("./Operations/Structured");

HistoryBuffer = require("./HistoryBuffer");

Engine = require("./Engine");

adaptConnector = require("./ConnectorAdapter");

createY = function(connector) {
  var HB, ct, engine, model, ops, ops_manager, user_id;
  user_id = null;
  if (connector.user_id != null) {
    user_id = connector.user_id;
  } else {
    user_id = "_temp";
    connector.on_user_id_set = function(id) {
      user_id = id;
      return HB.resetUserId(id);
    };
  }
  HB = new HistoryBuffer(user_id);
  ops_manager = structured_ops_uninitialized(HB, this.constructor);
  ops = ops_manager.operations;
  engine = new Engine(HB, ops);
  adaptConnector(connector, engine, HB, ops_manager.execution_listener);
  ops.Operation.prototype.HB = HB;
  ops.Operation.prototype.operations = ops;
  ops.Operation.prototype.engine = engine;
  ops.Operation.prototype.connector = connector;
  ops.Operation.prototype.custom_types = this.constructor;
  ct = new createY.Object();
  model = new ops.MapManager(ct, HB.getReservedUniqueIdentifier()).execute();
  ct._setModel(model);
  return ct;
};

module.exports = createY;

if (typeof window !== "undefined" && window !== null) {
  window.Y = createY;
}

createY.Object = require("./ObjectType");


},{"./ConnectorAdapter":1,"./Engine":3,"./HistoryBuffer":4,"./ObjectType":5,"./Operations/Structured":7}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9naXQveWpzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9Db25uZWN0b3JBZGFwdGVyLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvZ2l0L3lqcy9saWIvRW5naW5lLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PcGVyYXRpb25zL0Jhc2ljLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PcGVyYXRpb25zL1N0cnVjdHVyZWQuY29mZmVlIiwiL2hvbWUvZG1vbmFkL2dpdC95anMvbGliL3ktb2JqZWN0LmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi95LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0NBLElBQUEsOEJBQUE7O0FBQUEsY0FBQSxHQUFpQixPQUFBLENBQVEsa0JBQVIsQ0FBakIsQ0FBQTs7QUFBQSxjQU1BLEdBQWlCLFNBQUMsU0FBRCxFQUFZLE1BQVosRUFBb0IsRUFBcEIsRUFBd0Isa0JBQXhCLEdBQUE7QUFFZixNQUFBLHVGQUFBO0FBQUEsT0FBQSxzQkFBQTs2QkFBQTtBQUNFLElBQUEsU0FBVSxDQUFBLElBQUEsQ0FBVixHQUFrQixDQUFsQixDQURGO0FBQUEsR0FBQTtBQUFBLEVBR0EsU0FBUyxDQUFDLGFBQVYsQ0FBQSxDQUhBLENBQUE7QUFBQSxFQUtBLEtBQUEsR0FBUSxTQUFDLENBQUQsR0FBQTtBQUNOLElBQUEsSUFBRyxD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SSxDQUFDLFdBbkI1QyxDQUFBO0FBQUEsRUFxQkEsRUFBQSxHQUFTLElBQUEsT0FBTyxDQUFDLE1BQVIsQ0FBQSxDQXJCVCxDQUFBO0FBQUEsRUFzQkEsS0FBQSxHQUFZLElBQUEsR0FBRyxDQUFDLFVBQUosQ0FBZSxFQUFmLEVBQW1CLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQW5CLENBQW9ELENBQUMsT0FBckQsQ0FBQSxDQXRCWixDQUFBO0FBQUEsRUF1QkEsRUFBRSxDQUFDLFNBQUgsQ0FBYSxLQUFiLENBdkJBLENBQUE7U0F3QkEsR0F6QlE7QUFBQSxDQU5WLENBQUE7O0FBQUEsTUFpQ00sQ0FBQyxPQUFQLEdBQWlCLE9BakNqQixDQUFBOztBQWtDQSxJQUFHLGdEQUFIO0FBQ0UsRUFBQSxNQUFNLENBQUMsQ0FBUCxHQUFXLE9BQVgsQ0FERjtDQWxDQTs7QUFBQSxPQXFDTyxDQUFDLE1BQVIsR0FBaUIsT0FBQSxDQUFRLGNBQVIsQ0FyQ2pCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5Db25uZWN0b3JDbGFzcyA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckNsYXNzXCJcbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cblxuICBmb3IgbmFtZSwgZiBvZiBDb25uZWN0b3JDbGFzc1xuICAgIGNvbm5lY3RvcltuYW1lXSA9IGZcblxuICBjb25uZWN0b3Iuc2V0SXNCb3VuZFRvWSgpXG5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEhCLmdldFVzZXJJZCgpKSBhbmRcbiAgICAgICAgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKSBhbmQgIyBUT0RPOiBpIGRvbid0IHRoaW5rIHRoYXQgd2UgbmVlZCB0aGlzIGFueW1vcmUuLlxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cblxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIGdldEhCID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcbiAgICBqc29uID1cbiAgICAgIGhiOiBoYlxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgIGpzb25cblxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXG5cbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXG5cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMgPz0gW11cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXG5cblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvclxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9XG4gICNcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnN5bmNNZXRob2Qge1N0cmluZ30gIGlzIGVpdGhlciBcInN5bmNBbGxcIiBvciBcIm1hc3Rlci1zbGF2ZVwiLlxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNZXRob2RcIiwgW1wic3luY0FsbFwiLCBcIm1hc3Rlci1zbGF2ZVwiXVxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cbiAgICByZXEgXCJ1c2VyX2lkXCJcbiAgICBAb25fdXNlcl9pZF9zZXQ/KEB1c2VyX2lkKVxuXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxuICAgICMgQnV0IHRoaXMgaXMgbm90IG5lY2Vzc2FyeSBpbiB0aGUgdGVzdC1jb25uZWN0b3JcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxuICAgIGVsc2VcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXG5cbiAgICAjIEEgTWFzdGVyIHNob3VsZCBzeW5jIHdpdGggZXZlcnlvbmUhIFRPRE86IHJlYWxseT8gLSBmb3Igbm93IGl0cyBzYWZlciB0aGlzIHdheSFcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXG5cbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcbiAgICAjIFBlZXJqcyBDb25uZWN0aW9uczoga2V5OiBjb25uLWlkLCB2YWx1ZTogb2JqZWN0XG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMgPz0gW11cblxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxuICAgIEBpc19pbml0aWFsaXplZCA9IHRydWVcbiAgICBAY29ubmVjdGlvbnNfbGlzdGVuZXJzID0gW11cblxuICBvblVzZXJFdmVudDogKGYpLT5cbiAgICBAY29ubmVjdGlvbnNfbGlzdGVuZXJzLnB1c2ggZlxuXG4gIGlzUm9sZU1hc3RlcjogLT5cbiAgICBAcm9sZSBpcyBcIm1hc3RlclwiXG5cbiAgaXNSb2xlU2xhdmU6IC0+XG4gICAgQHJvbGUgaXMgXCJzbGF2ZVwiXG5cbiAgZmluZE5ld1N5bmNUYXJnZXQ6ICgpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGlmIG5vdCBjLmlzX3N5bmNlZFxuICAgICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICAgICAgYnJlYWtcbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAc2V0U3RhdGVTeW5jZWQoKVxuICAgIG51bGxcblxuICB1c2VyTGVmdDogKHVzZXIpLT5cbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXG4gICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcbiAgICBmb3IgZiBpbiBAY29ubmVjdGlvbnNfbGlzdGVuZXJzXG4gICAgICBmIHtcbiAgICAgICAgYWN0aW9uOiBcInVzZXJMZWZ0XCJcbiAgICAgICAgdXNlcjogdXNlclxuICAgICAgfVxuXG5cbiAgdXNlckpvaW5lZDogKHVzZXIsIHJvbGUpLT5cbiAgICBpZiBub3Qgcm9sZT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkludGVybmFsOiBZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEgRS5nLiB1c2VySm9pbmVkKCd1aWQ6MzkzOScsJ3NsYXZlJylcIlxuICAgICMgYSB1c2VyIGpvaW5lZCB0aGUgcm9vbVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXSA/PSB7fVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXS5pc19zeW5jZWQgPSBmYWxzZVxuXG4gICAgaWYgKG5vdCBAaXNfc3luY2VkKSBvciBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcbiAgICAgIGVsc2UgaWYgcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICAgICMgVE9ETzogV2hhdCBpZiB0aGVyZSBhcmUgdHdvIG1hc3RlcnM/IFByZXZlbnQgc2VuZGluZyBldmVyeXRoaW5nIHR3byB0aW1lcyFcbiAgICAgICAgQHBlcmZvcm1TeW5jV2l0aE1hc3RlciB1c2VyXG5cbiAgICBmb3IgZiBpbiBAY29ubmVjdGlvbnNfbGlzdGVuZXJzXG4gICAgICBmIHtcbiAgICAgICAgYWN0aW9uOiBcInVzZXJKb2luZWRcIlxuICAgICAgICB1c2VyOiB1c2VyXG4gICAgICAgIHJvbGU6IHJvbGVcbiAgICAgIH1cblxuICAjXG4gICMgRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLiBJZiBub3QgY29ubmVjdGVkLCB3YWl0IHVudGlsIGNvbm5lY3RlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC5cbiAgI1xuICB3aGVuU3luY2VkOiAoYXJncyktPlxuICAgIGlmIGFyZ3MuY29uc3RydWN0b3JlIGlzIEZ1bmN0aW9uXG4gICAgICBhcmdzID0gW2FyZ3NdXG4gICAgaWYgQGlzX3N5bmNlZFxuICAgICAgYXJnc1swXS5hcHBseSB0aGlzLCBhcmdzWzEuLl1cbiAgICBlbHNlXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZCA/PSBbXVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQucHVzaCBhcmdzXG5cbiAgI1xuICAjIEV4ZWN1dGUgYW4gZnVuY3Rpb24gd2hlbiBhIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuIGYgd2lsbCBiZSBjYWxsZWQgd2l0aCAoc2VuZGVyX2lkLCBicm9hZGNhc3Qge3RydWV8ZmFsc2V9LCBtZXNzYWdlKS5cbiAgI1xuICBvblJlY2VpdmU6IChmKS0+XG4gICAgQHJlY2VpdmVfaGFuZGxlcnMucHVzaCBmXG5cbiAgIyMjXG4gICMgQnJvYWRjYXN0IGEgbWVzc2FnZSB0byBhbGwgY29ubmVjdGVkIHBlZXJzLlxuICAjIEBwYXJhbSBtZXNzYWdlIHtPYmplY3R9IFRoZSBtZXNzYWdlIHRvIGJyb2FkY2FzdC5cbiAgI1xuICBicm9hZGNhc3Q6IChtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IGJyb2FkY2FzdCFcIlxuXG4gICNcbiAgIyBTZW5kIGEgbWVzc2FnZSB0byBhIHBlZXIsIG9yIHNldCBvZiBwZWVyc1xuICAjXG4gIHNlbmQ6IChwZWVyX3MsIG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgc2VuZCFcIlxuICAjIyNcblxuICAjXG4gICMgcGVyZm9ybSBhIHN5bmMgd2l0aCBhIHNwZWNpZmljIHVzZXIuXG4gICNcbiAgcGVyZm9ybVN5bmM6ICh1c2VyKS0+XG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgICBAc2VuZCB1c2VyLFxuICAgICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxuICAgICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgICBkYXRhOiBbXSAjIEBnZXRTdGF0ZVZlY3RvcigpXG4gICAgICBpZiBub3QgQHNlbnRfaGJfdG9fYWxsX3VzZXJzXG4gICAgICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IHRydWVcblxuICAgICAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICAgICAgX2hiID0gW11cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuXG5cbiAgI1xuICAjIFdoZW4gYSBtYXN0ZXIgbm9kZSBqb2luZWQgdGhlIHJvb20sIHBlcmZvcm0gdGhpcyBzeW5jIHdpdGggaGltLiBJdCB3aWxsIGFzayB0aGUgbWFzdGVyIGZvciB0aGUgSEIsXG4gICMgYW5kIHdpbGwgYnJvYWRjYXN0IGhpcyBvd24gSEJcbiAgI1xuICBwZXJmb3JtU3luY1dpdGhNYXN0ZXI6ICh1c2VyKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgQHNlbmQgdXNlcixcbiAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgZGF0YTogW11cbiAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICBfaGIgPSBbXVxuICAgIGZvciBvIGluIGhiXG4gICAgICBfaGIucHVzaCBvXG4gICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgQGJyb2FkY2FzdFxuICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgZGF0YTogX2hiXG5cbiAgI1xuICAjIFlvdSBhcmUgc3VyZSB0aGF0IGFsbCBjbGllbnRzIGFyZSBzeW5jZWQsIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICBzZXRTdGF0ZVN5bmNlZDogKCktPlxuICAgIGlmIG5vdCBAaXNfc3luY2VkXG4gICAgICBAaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgaWYgQGNvbXB1dGVfd2hlbl9zeW5jZWQ/XG4gICAgICAgIGZvciBmIGluIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICAgICAgZigpXG4gICAgICAgIGRlbGV0ZSBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgbnVsbFxuXG4gICNcbiAgIyBZb3UgcmVjZWl2ZWQgYSByYXcgbWVzc2FnZSwgYW5kIHlvdSBrbm93IHRoYXQgaXQgaXMgaW50ZW5kZWQgZm9yIHRvIFlqcy4gVGhlbiBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICNcbiAgcmVjZWl2ZU1lc3NhZ2U6IChzZW5kZXIsIHJlcyktPlxuICAgIGlmIG5vdCByZXMuc3luY19zdGVwP1xuICAgICAgZm9yIGYgaW4gQHJlY2VpdmVfaGFuZGxlcnNcbiAgICAgICAgZiBzZW5kZXIsIHJlc1xuICAgIGVsc2VcbiAgICAgIGlmIHNlbmRlciBpcyBAdXNlcl9pZFxuICAgICAgICByZXR1cm5cbiAgICAgIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJnZXRIQlwiXG4gICAgICAgIGRhdGEgPSBAZ2V0SEIocmVzLmRhdGEpXG4gICAgICAgIGhiID0gZGF0YS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICAjIGFsd2F5cyBicm9hZGNhc3QsIHdoZW4gbm90IHN5bmNlZC5cbiAgICAgICAgIyBUaGlzIHJlZHVjZXMgZXJyb3JzLCB3aGVuIHRoZSBjbGllbnRzIGdvZXMgb2ZmbGluZSBwcmVtYXR1cmVseS5cbiAgICAgICAgIyBXaGVuIHRoaXMgY2xpZW50IG9ubHkgc3luY3MgdG8gb25lIG90aGVyIGNsaWVudHMsIGJ1dCBsb29zZXMgY29ubmVjdG9ycyxcbiAgICAgICAgIyBiZWZvcmUgc3luY2luZyB0byB0aGUgb3RoZXIgY2xpZW50cywgdGhlIG9ubGluZSBjbGllbnRzIGhhdmUgZGlmZmVyZW50IHN0YXRlcy5cbiAgICAgICAgIyBTaW5jZSB3ZSBkbyBub3Qgd2FudCB0byBwZXJmb3JtIHJlZ3VsYXIgc3luY3MsIHRoaXMgaXMgYSBnb29kIGFsdGVybmF0aXZlXG4gICAgICAgIGlmIEBpc19zeW5jZWRcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XG4gICAgICAgICAgICBAc2VuZCBzZW5kZXIsIG1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBicm9hZGNhc3QgbVxuXG4gICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuXG4gICAgICAgIHNlbmRBcHBseUhCXG4gICAgICAgICAgc3luY19zdGVwIDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuICAgICAgICBpZiByZXMuc2VuZF9hZ2Fpbj8gYW5kIEBwZXJmb3JtX3NlbmRfYWdhaW5cbiAgICAgICAgICBzZW5kX2FnYWluID0gZG8gKHN2ID0gZGF0YS5zdGF0ZV92ZWN0b3IpPT5cbiAgICAgICAgICAgICgpPT5cbiAgICAgICAgICAgICAgaGIgPSBAZ2V0SEIoc3YpLmhiXG4gICAgICAgICAgICAgIEBzZW5kIHNlbmRlcixcbiAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiLFxuICAgICAgICAgICAgICAgIGRhdGE6IGhiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yP1xuICAgICAgICAgIG8udWlkLmNyZWF0b3IgPSBpZFxuICAgICAgICBpZiBvLnVpZC5hbHQ/XG4gICAgICAgICAgby51aWQuYWx0LmNyZWF0b3IgPSBpZFxuICAgICAgaWYgQGJ1ZmZlcltpZF0/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXG4gICAgICBkZWxldGUgQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW2lkXSA9IEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pICMgeW91IGFscmVhZHkgZG8gdGhpcyBpbiB0aGUgZW5naW5lLCBzbyBkZWxldGUgaXQgaGVyZSFcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcbiAgICBAYWRkVG9Db3VudGVyKG8pXG4gICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cblxuICAjIFdoZW4gdGhlIEhCIGRldGVybWluZXMgaW5jb25zaXN0ZW5jaWVzLCB0aGVuIHRoZSBpbnZva2VTeW5jXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcbiAgc2V0SW52b2tlU3luY0hhbmRsZXI6IChmKS0+XG4gICAgQGludm9rZVN5bmMgPSBmXG5cbiAgIyBlbXB0eSBwZXIgZGVmYXVsdCAjIFRPRE86IGRvIGkgbmVlZCB0aGlzP1xuICBpbnZva2VTeW5jOiAoKS0+XG5cbiAgIyBhZnRlciB5b3UgcmVjZWl2ZWQgdGhlIEhCIG9mIGFub3RoZXIgdXNlciAoaW4gdGhlIHN5bmMgcHJvY2VzcyksXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cbiAgICBmb3IgdXNlcixzdGF0ZSBvZiBzdGF0ZV92ZWN0b3JcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBpZiBvLnVpZC5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcbiAgICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSBpc250IChvLnVpZC5vcF9udW1iZXIgKyAxKVxuICAgICAgI2NvbnNvbGUubG9nIChAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gLSAoby51aWQub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIlxuY2xhc3MgWU9iamVjdFxuXG4gIGNvbnN0cnVjdG9yOiAoQF9vYmplY3QgPSB7fSktPlxuICAgIGlmIEBfb2JqZWN0LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZm9yIG5hbWUsIHZhbCBvZiBAX29iamVjdFxuICAgICAgICBpZiB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBuZXcgWU9iamVjdCh2YWwpXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWS5PYmplY3QgYWNjZXB0cyBKc29uIE9iamVjdHMgb25seVwiXG5cbiAgX25hbWU6IFwiT2JqZWN0XCJcblxuICBfZ2V0TW9kZWw6ICh0eXBlcywgb3BzKS0+XG4gICAgaWYgbm90IEBfbW9kZWw/XG4gICAgICBAX21vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKEApLmV4ZWN1dGUoKVxuICAgICAgZm9yIG4sbyBvZiBAX29iamVjdFxuICAgICAgICBAX21vZGVsLnZhbCBuLCBvXG4gICAgZGVsZXRlIEBfb2JqZWN0XG4gICAgQF9tb2RlbFxuXG4gIF9zZXRNb2RlbDogKEBfbW9kZWwpLT5cbiAgICBkZWxldGUgQF9vYmplY3RcblxuICBvYnNlcnZlOiAoZiktPlxuICAgIEBfbW9kZWwub2JzZXJ2ZSBmXG4gICAgQFxuXG4gIHVub2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLnVub2JzZXJ2ZSBmXG4gICAgQFxuXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICMgICBAcmV0dXJuIFtKc29uXVxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZXx8U3RyaW5nfE9iamVjdF0gRGVwZW5kaW5nIG9uIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIElmIG11dGFibGUgaXQgd2lsbCByZXR1cm4gYSBPcGVyYXRpb24tdHlwZSBvYmplY3QsIGlmIGltbXV0YWJsZSBpdCB3aWxsIHJldHVybiBTdHJpbmcvT2JqZWN0LlxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAjXG4gIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICBpZiBAX21vZGVsP1xuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXG4gICAgZWxzZVxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdXG4gICAgICBlbHNlXG4gICAgICAgIHJlcyA9IHt9XG4gICAgICAgIGZvciBuLHYgb2YgQF9vYmplY3RcbiAgICAgICAgICByZXNbbl0gPSB2XG4gICAgICAgIHJlc1xuXG4gIGRlbGV0ZTogKG5hbWUpLT5cbiAgICBAX21vZGVsLmRlbGV0ZShuYW1lKVxuICAgIEBcblxuaWYgd2luZG93P1xuICBpZiB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBmaXJzdCBpbXBvcnQgWSFcIlxuXG5pZiBtb2R1bGU/XG4gIG1vZHVsZS5leHBvcnRzID0gWU9iamVjdFxuXG5cblxuXG5cblxuXG5cbiIsIm1vZHVsZS5leHBvcnRzID0gKCktPlxuICAjIEBzZWUgRW5naW5lLnBhcnNlXG4gIG9wcyA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEBwcml2YXRlXG4gICMgQGFic3RyYWN0XG4gICMgQG5vZG9jXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcHMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyAqIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cbiAgICAgIGlmIGN1c3RvbV90eXBlP1xuICAgICAgICBAY3VzdG9tX3R5cGUgPSBjdXN0b21fdHlwZVxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXSAjIFRPRE86IHJlbmFtZSB0byBvYnNlcnZlcnMgb3Igc3RoIGxpa2UgdGhhdFxuICAgICAgaWYgdWlkP1xuICAgICAgICBAdWlkID0gdWlkXG5cbiAgICAgICMgc2VlIGVuY29kZSB0byBzZWUsIHdoeSB3ZSBhcmUgZG9pbmcgaXQgdGhpcyB3YXlcbiAgICAgIGlmIGNvbnRlbnQgaXMgdW5kZWZpbmVkXG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNyZWF0b3I/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIGlmIGNvbnRlbnRfb3BlcmF0aW9ucz9cbiAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9ucyA9IHt9XG4gICAgICAgIGZvciBuYW1lLCBvcCBvZiBjb250ZW50X29wZXJhdGlvbnNcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuYW1lLCBvcCwgJ2NvbnRlbnRfb3BlcmF0aW9ucydcblxuICAgIHR5cGU6IFwiT3BlcmF0aW9uXCJcblxuICAgIGdldENvbnRlbnQ6IChuYW1lKS0+XG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgaWYgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZT9cbiAgICAgICAgICBAY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZSBpZiBAY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBpZiBuYW1lP1xuICAgICAgICAgICAgaWYgQGNvbnRlbnRbbmFtZV0/XG4gICAgICAgICAgICAgIEBjb250ZW50W25hbWVdXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIEBjb250ZW50X29wZXJhdGlvbnNbbmFtZV0uZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY29udGVudCA9IHt9XG4gICAgICAgICAgICBmb3Igbix2IG9mIEBjb250ZW50XG4gICAgICAgICAgICAgIGNvbnRlbnRbbl0gPSB2XG4gICAgICAgICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICAgICAgICBmb3Igbix2IG9mIEBjb250ZW50X29wZXJhdGlvbnNcbiAgICAgICAgICAgICAgICB2ID0gdi5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxuICAgICAgICAgICAgY29udGVudFxuICAgICAgICBlbHNlXG4gICAgICAgICAgQGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnRcblxuICAgIHJldHJpZXZlU3ViOiAoKS0+XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJzdWIgcHJvcGVydGllcyBhcmUgbm90IGVuYWJsZSBvbiB0aGlzIG9wZXJhdGlvbiB0eXBlIVwiXG5cbiAgICAjXG4gICAgIyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIuIEl0IGRlcGVuZHMgb24gdGhlIG9wZXJhdGlvbiB3aGljaCBldmVudHMgYXJlIHN1cHBvcnRlZC5cbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cbiAgICAjXG4gICAgb2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcbiAgICAjIEBzZWUgT3BlcmF0aW9uLm9ic2VydmVcbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxuICAgICMgICBAcGFyYW0gZiAgICAge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdGhhdCB5b3Ugd2FudCB0byBkZWxldGVcbiAgICB1bm9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cbiAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYWxsIHN1YnNjcmliZWQgZXZlbnQgbGlzdGVuZXJzLlxuICAgICMgVGhpcyBzaG91bGQgYmUgY2FsbGVkLCBlLmcuIGFmdGVyIHRoaXMgaGFzIGJlZW4gcmVwbGFjZWQuXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXG4gICAgIyBUaGlzIGlzIGFsc28gY2FsbGVkIGluIHRoZSBjbGVhbnVwIG1ldGhvZC5cbiAgICBkZWxldGVBbGxPYnNlcnZlcnM6ICgpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxuXG4gICAgZGVsZXRlOiAoKS0+XG4gICAgICAobmV3IG9wcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcbiAgICAgIG51bGxcblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XG4gICAgY2FsbEV2ZW50OiAoKS0+XG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XG4gICAgICAgIGNhbGxvbiA9IEBnZXRDdXN0b21UeXBlKClcbiAgICAgIGVsc2VcbiAgICAgICAgY2FsbG9uID0gQFxuICAgICAgQGZvcndhcmRFdmVudCBjYWxsb24sIGFyZ3VtZW50cy4uLlxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgdGhpcyA/XG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGFyZ3MuLi4pLT5cbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcbiAgICAgICAgZi5jYWxsIG9wLCBhcmdzLi4uXG5cbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIEBpc19kZWxldGVkXG5cbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxuICAgICAgaWYgbm90IEBnYXJiYWdlX2NvbGxlY3RlZFxuICAgICAgICAjY29uc29sZS5sb2cgXCJhcHBseURlbGV0ZTogI3tAdHlwZX1cIlxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcbiAgICAgICAgaWYgZ2FyYmFnZWNvbGxlY3RcbiAgICAgICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSB0cnVlXG4gICAgICAgICAgQEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXG4gICAgICBASEIucmVtb3ZlT3BlcmF0aW9uIEBcbiAgICAgIEBkZWxldGVBbGxPYnNlcnZlcnMoKVxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBAdWlkXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEB1aWQuYWx0PyAjIGNvdWxkIGJlIChzYWZlbHkpIHVuZGVmaW5lZFxuICAgICAgICAgIG1hcF91aWQgPSBAdWlkLmFsdC5jbG9uZVVpZCgpXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxuICAgICAgICAgIG1hcF91aWRcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xvbmVVaWQ6ICgpLT5cbiAgICAgIHVpZCA9IHt9XG4gICAgICBmb3Igbix2IG9mIEBnZXRVaWQoKVxuICAgICAgICB1aWRbbl0gPSB2XG4gICAgICB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJZiBub3QgYWxyZWFkeSBkb25lLCBzZXQgdGhlIHVpZFxuICAgICMgQWRkIHRoaXMgdG8gdGhlIEhCXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAaXNfZXhlY3V0ZWQgPSB0cnVlXG4gICAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxuICAgICAgICAgICMgVGhlcmUgaXMgb25seSBvbmUgb3RoZXIgcGxhY2UsIHdoZXJlIHRoaXMgY2FuIGJlIGRvbmUgLSBiZWZvcmUgYW4gSW5zZXJ0aW9uXG4gICAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICAgIEB1aWQgPSBASEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIEBcbiAgICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcbiAgICAgICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgICBAXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgT3BlcmF0aW9ucyBtYXkgZGVwZW5kIG9uIG90aGVyIG9wZXJhdGlvbnMgKGxpbmtlZCBsaXN0cywgZXRjLikuXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXG4gICAgIyBhbiBlYXN5IHdheSB0byByZWZlciB0byB0aGVzZSBvcGVyYXRpb25zIHZpYSBhbiB1aWQgb3Igb2JqZWN0IHJlZmVyZW5jZS5cbiAgICAjXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8pOyAgIG9yXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkby5nZXRVaWQoKSk7XG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcF91aWQpXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R9IG9wX3VpZCBBIHVpZCB0aGF0IHJlZmVycyB0byBhbiBvcGVyYXRpb25cbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPcGVyYXRpb259IG9wIEFuIE9wZXJhdGlvbiBvYmplY3RcbiAgICAjXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wLCBiYXNlID0gXCJ0aGlzXCIpLT5cbiAgICAgIGlmIG9wPyBhbmQgb3AuX2dldE1vZGVsP1xuICAgICAgICBvcCA9IG9wLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICNcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXG4gICAgICAjIFdlIHVzZSBkdWNrLXR5cGluZyB0byBjaGVjayBpZiBvcCBpcyBpbnN0YW50aWF0ZWQgc2luY2UgdGhlcmVcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXG4gICAgICAjXG4gICAgICBpZiBub3Qgb3A/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmIG9wLmV4ZWN1dGU/IG9yIG5vdCAob3Aub3BfbnVtYmVyPyBhbmQgb3AuY3JlYXRvcj8pXG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkLCBvciBvcCBpcyBzdHJpbmcuIEN1cnJlbnRseSBcIkRlbGltaXRlclwiIGlzIHNhdmVkIGFzIHN0cmluZ1xuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXG4gICAgICAgIGlmIGJhc2UgaXMgXCJ0aGlzXCJcbiAgICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGRlc3QgPSBAW2Jhc2VdXG4gICAgICAgICAgcGF0aHMgPSBuYW1lLnNwbGl0KFwiL1wiKVxuICAgICAgICAgIGxhc3RfcGF0aCA9IHBhdGhzLnBvcCgpXG4gICAgICAgICAgZm9yIHBhdGggaW4gcGF0aHNcbiAgICAgICAgICAgIGRlc3QgPSBkZXN0W3BhdGhdXG4gICAgICAgICAgZGVzdFtsYXN0X3BhdGhdID0gb3BcbiAgICAgIGVsc2VcbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbYmFzZV0gPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXVtuYW1lXSA9IG9wXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxuICAgICMgQHNlZSBPcGVyYXRpb24uc2F2ZU9wZXJhdGlvblxuICAgICNcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxuICAgICNcbiAgICB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9uczogKCktPlxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxuICAgICAgc3VjY2VzcyA9IHRydWVcbiAgICAgIGZvciBiYXNlX25hbWUsIGJhc2Ugb2YgQHVuY2hlY2tlZFxuICAgICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIGJhc2VcbiAgICAgICAgICBvcCA9IEBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgICAgaWYgb3BcbiAgICAgICAgICAgIGlmIGJhc2VfbmFtZSBpcyBcInRoaXNcIlxuICAgICAgICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgZGVzdCA9IEBbYmFzZV9uYW1lXVxuICAgICAgICAgICAgICBwYXRocyA9IG5hbWUuc3BsaXQoXCIvXCIpXG4gICAgICAgICAgICAgIGxhc3RfcGF0aCA9IHBhdGhzLnBvcCgpXG4gICAgICAgICAgICAgIGZvciBwYXRoIGluIHBhdGhzXG4gICAgICAgICAgICAgICAgZGVzdCA9IGRlc3RbcGF0aF1cbiAgICAgICAgICAgICAgZGVzdFtsYXN0X3BhdGhdID0gb3BcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB1bmluc3RhbnRpYXRlZFtiYXNlX25hbWVdID89IHt9XG4gICAgICAgICAgICB1bmluc3RhbnRpYXRlZFtiYXNlX25hbWVdW25hbWVdID0gb3BfdWlkXG4gICAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgICAgcmV0dXJuIEBcblxuICAgIGdldEN1c3RvbVR5cGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAY3VzdG9tX3R5cGU/XG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyBvcGVyYXRpb24gd2FzIG5vdCBpbml0aWFsaXplZCB3aXRoIGEgY3VzdG9tIHR5cGVcIlxuICAgICAgICBAXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgICAjIGhhcyBub3QgYmVlbiBpbml0aWFsaXplZCB5ZXQgKG9ubHkgdGhlIG5hbWUgaXMgc3BlY2lmaWVkKVxuICAgICAgICAgIFR5cGUgPSBAY3VzdG9tX3R5cGVzXG4gICAgICAgICAgZm9yIHQgaW4gQGN1c3RvbV90eXBlLnNwbGl0KFwiLlwiKVxuICAgICAgICAgICAgVHlwZSA9IFR5cGVbdF1cbiAgICAgICAgICBAY3VzdG9tX3R5cGUgPSBuZXcgVHlwZSgpXG4gICAgICAgICAgQGN1c3RvbV90eXBlLl9zZXRNb2RlbCBAXG4gICAgICAgIEBjdXN0b21fdHlwZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24udHlwZSA9IEB0eXBlXG4gICAgICBqc29uLnVpZCA9IEBnZXRVaWQoKVxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xuICAgICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZVxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZS5fbmFtZVxuXG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uLmNvbnRlbnQgPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uLmNvbnRlbnQgPSBAY29udGVudFxuICAgICAgaWYgQGNvbnRlbnRfb3BlcmF0aW9ucz9cbiAgICAgICAgb3BlcmF0aW9ucyA9IHt9XG4gICAgICAgIGZvciBuLG8gb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgIGlmIG8uX2dldE1vZGVsP1xuICAgICAgICAgICAgbyA9IG8uX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICAgIG9wZXJhdGlvbnNbbl0gPSBvLmdldFVpZCgpXG4gICAgICAgIGpzb24uY29udGVudF9vcGVyYXRpb25zID0gb3BlcmF0aW9uc1xuICAgICAganNvblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyBvcHMuRGVsZXRlIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmVzID0gc3VwZXJcbiAgICAgICAgaWYgcmVzXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICByZXNcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBvcHMuRGVsZXRlLnBhcnNlID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IHRoaXMobnVsbCwgdWlkLCBkZWxldGVzX3VpZClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZCAodW5pbXBsZW1lbnRlZCwgZ29vZCBpZGVhPylcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIG9wcy5JbnNlcnQgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucywgcGFyZW50LCB1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIkluc2VydFwiXG5cbiAgICB2YWw6ICgpLT5cbiAgICAgIEBnZXRDb250ZW50KClcblxuICAgIGdldE5leHQ6IChpPTEpLT5cbiAgICAgIG4gPSBAXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5uZXh0X2NsP1xuICAgICAgICBuID0gbi5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpLS1cbiAgICAgIGlmIG4uaXNfZGVsZXRlZFxuICAgICAgICBudWxsXG4gICAgICBuXG5cbiAgICBnZXRQcmV2OiAoaT0xKS0+XG4gICAgICBuID0gQFxuICAgICAgd2hpbGUgaSA+IDAgYW5kIG4ucHJldl9jbD9cbiAgICAgICAgbiA9IG4ucHJldl9jbFxuICAgICAgICBpZiBub3Qgbi5pc19kZWxldGVkXG4gICAgICAgICAgaS0tXG4gICAgICBpZiBuLmlzX2RlbGV0ZWRcbiAgICAgICAgbnVsbFxuICAgICAgZWxzZVxuICAgICAgICBuXG5cbiAgICAjXG4gICAgIyBzZXQgY29udGVudCB0byBudWxsIGFuZCBvdGhlciBzdHVmZlxuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgY2FsbExhdGVyID0gZmFsc2VcbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzX2RlbGV0ZWQgYW5kIG8/ICMgbz8gOiBpZiBub3Qgbz8sIHRoZW4gdGhlIGRlbGltaXRlciBkZWxldGVkIHRoaXMgSW5zZXJ0aW9uLiBGdXJ0aGVybW9yZSwgaXQgd291bGQgYmUgd3JvbmcgdG8gY2FsbCBpdC4gVE9ETzogbWFrZSB0aGlzIG1vcmUgZXhwcmVzc2l2ZSBhbmQgc2F2ZVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgY2FsbExhdGVyID0gdHJ1ZVxuICAgICAgaWYgbz9cbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICBpZiBjYWxsTGF0ZXJcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHModGhpcywgbylcbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQHByZXZfY2wuaXNEZWxldGVkKClcbiAgICAgICAgIyBnYXJiYWdlIGNvbGxlY3QgcHJldl9jbFxuICAgICAgICBAcHJldl9jbC5hcHBseURlbGV0ZSgpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInJpZ2h0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGNoYW5nZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcblxuICAgICAgICAjIGRlbGV0ZSBjb250ZW50XG4gICAgICAgICMgLSB3ZSBtdXN0IG5vdCBkbyB0aGlzIGluIGFwcGx5RGVsZXRlLCBiZWNhdXNlIHRoaXMgd291bGQgbGVhZCB0byBpbmNvbnNpc3RlbmNpZXNcbiAgICAgICAgIyAoZS5nLiB0aGUgZm9sbG93aW5nIG9wZXJhdGlvbiBvcmRlciBtdXN0IGJlIGludmVydGlibGUgOlxuICAgICAgICAjICAgSW5zZXJ0IHJlZmVycyB0byBjb250ZW50LCB0aGVuIHRoZSBjb250ZW50IGlzIGRlbGV0ZWQpXG4gICAgICAgICMgVGhlcmVmb3JlLCB3ZSBoYXZlIHRvIGRvIHRoaXMgaW4gdGhlIGNsZWFudXBcbiAgICAgICAgIyAqIE5PREU6IFdlIG5ldmVyIGRlbGV0ZSBJbnNlcnRpb25zIVxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb24gYW5kIG5vdCAoQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuSW5zZXJ0KVxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnktLVxuICAgICAgICAgIGlmIEBjb250ZW50LnJlZmVyZW5jZWRfYnkgPD0gMCBhbmQgbm90IEBjb250ZW50LmlzX2RlbGV0ZWRcbiAgICAgICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgICAgZGVsZXRlIEBjb250ZW50XG4gICAgICAgIHN1cGVyXG4gICAgICAjIGVsc2VcbiAgICAgICMgICBTb21lb25lIGluc2VydGVkIHNvbWV0aGluZyBpbiB0aGUgbWVhbnRpbWUuXG4gICAgICAjICAgUmVtZW1iZXI6IHRoaXMgY2FuIG9ubHkgYmUgZ2FyYmFnZSBjb2xsZWN0ZWQgd2hlbiBuZXh0X2NsIGlzIGRlbGV0ZWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBAY29udGVudC5pbnNlcnRfcGFyZW50ID0gQCAjIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG5lY2Vzc2FyeSBhbmQgb25seSBuaWNlIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5ID89IDBcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5KytcbiAgICAgICAgaWYgQHBhcmVudD9cbiAgICAgICAgICBpZiBub3QgQHByZXZfY2w/XG4gICAgICAgICAgICBAcHJldl9jbCA9IEBwYXJlbnQuYmVnaW5uaW5nXG4gICAgICAgICAgaWYgbm90IEBvcmlnaW4/XG4gICAgICAgICAgICBAb3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBlbHNlIGlmIEBvcmlnaW4gaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgICAgQG9yaWdpbiA9IEBwYXJlbnQuYmVnaW5uaW5nXG4gICAgICAgICAgaWYgbm90IEBuZXh0X2NsP1xuICAgICAgICAgICAgQG5leHRfY2wgPSBAcGFyZW50LmVuZFxuICAgICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IGRpc3RhbmNlX3RvX29yaWdpbiAjIGxvb3AgY291bnRlclxuXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcbiAgICAgICAgICAjICAgICAgICAgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIDwgQHVpZC5jcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG5cbiAgICAgICAgQHNldFBhcmVudCBAcHJldl9jbC5nZXRQYXJlbnQoKSAjIGRvIEluc2VydGlvbnMgYWx3YXlzIGhhdmUgYSBwYXJlbnQ/XG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG4gICAgICAgIEBwYXJlbnQuY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzKHRoaXMpXG4gICAgICAgIEBcblxuICAgICNcbiAgICAjIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQb3NpdGlvbjogKCktPlxuICAgICAgcG9zaXRpb24gPSAwXG4gICAgICBwcmV2ID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgcHJldiBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBub3QgcHJldi5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uKytcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxuICAgICAgcG9zaXRpb25cblxuICAgICNcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW5kIHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24ucHJldiA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBqc29uLm5leHQgPSBAbmV4dF9jbC5nZXRVaWQoKVxuXG4gICAgICBpZiBAb3JpZ2luLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBqc29uLm9yaWdpbiA9IFwiRGVsaW1pdGVyXCJcbiAgICAgIGVsc2UgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb24ub3JpZ2luID0gQG9yaWdpbi5nZXRVaWQoKVxuXG4gICAgICAjIGlmIG5vdCAoanNvbi5wcmV2PyBhbmQganNvbi5uZXh0PylcbiAgICAgIGpzb24ucGFyZW50ID0gQHBhcmVudC5nZXRVaWQoKVxuXG4gICAgICBzdXBlciBqc29uXG5cbiAgb3BzLkluc2VydC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyBudWxsLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyBvcHMuRGVsaW1pdGVyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgbnVsbCwge25vT3BlcmF0aW9uOiB0cnVlfVxuXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cbiAgICAgICAgc3VwZXJcbiAgICAgICNlbHNlXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIG9wcy5EZWxpbWl0ZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQsIHByZXYsIG5leHQpXG5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxuICB7XG4gICAgJ29wZXJhdGlvbnMnIDogb3BzXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuIiwiYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKCktPlxuICBiYXNpY19vcHMgPSBiYXNpY19vcHNfdW5pbml0aWFsaXplZCgpXG4gIG9wcyA9IGJhc2ljX29wcy5vcGVyYXRpb25zXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgbWFwIGxpa2Ugb2JqZWN0cy4gRS5nLiBKc29uLVR5cGUgYW5kIFhNTCBhdHRyaWJ1dGVzLlxuICAjXG4gIGNsYXNzIG9wcy5NYXBNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgQF9tYXAgPSB7fVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQF9tYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBtYXA6IChmKS0+XG4gICAgICBmb3Igbix2IG9mIEBfbWFwXG4gICAgICAgIGYobix2KVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XG4gICAgICAgICAgcmVwID0gY29udGVudC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXAgPSBjb250ZW50XG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIHJlcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIHByb3AgPSBAX21hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIHJlcyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICAgIHJlcy5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXNcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQF9tYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXSA9IHJtXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxuICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV1cblxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XG4gICAgICBAYmVnaW5uaW5nID0gbmV3IG9wcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgb3BzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcblxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG5cbiAgICB0b0pzb246ICh0cmFuc2Zvcm1fdG9fdmFsdWUgPSBmYWxzZSktPlxuICAgICAgdmFsID0gQHZhbCgpXG4gICAgICBmb3IgaSwgbyBpbiB2YWxcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5PYmplY3RcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIG9wcy5MaXN0TWFuYWdlclxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiB0cmFuc2Zvcm1fdG9fdmFsdWUgYW5kIG8gaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgb1xuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBzZWUgT3BlcmF0aW9uLmV4ZWN1dGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGJlZ2lubmluZy5zZXRQYXJlbnQgQFxuICAgICAgICBAZW5kLnNldFBhcmVudCBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAZW5kLnByZXZfY2xcblxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXG5cbiAgICAjIFRyYW5zZm9ybXMgdGhlIHRoZSBsaXN0IHRvIGFuIGFycmF5XG4gICAgIyBEb2Vzbid0IHJldHVybiBsZWZ0LXJpZ2h0IGRlbGltaXRlci5cbiAgICB0b0FycmF5OiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgaWYgbm90IG8uaXNfZGVsZXRlZFxuICAgICAgICAgIHJlc3VsdC5wdXNoIG8udmFsKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICBtYXA6IChmKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICByZXN1bHQgPSBbXVxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgaWYgbm90IG8uaXNfZGVsZXRlZFxuICAgICAgICAgIHJlc3VsdC5wdXNoIGYobylcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICBmb2xkOiAoaW5pdCwgZiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgaWYgbm90IG8uaXNfZGVsZXRlZFxuICAgICAgICAgIGluaXQgPSBmKGluaXQsIG8pXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIGluaXRcblxuICAgIHZhbDogKHBvcyktPlxuICAgICAgaWYgcG9zP1xuICAgICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zKzEpXG4gICAgICAgIGlmIG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBwb3NpdGlvbiBkb2VzIG5vdCBleGlzdFwiXG4gICAgICBlbHNlXG4gICAgICAgIEB0b0FycmF5KClcblxuICAgIHJlZjogKHBvcyktPlxuICAgICAgaWYgcG9zP1xuICAgICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zKzEpXG4gICAgICAgIGlmIG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgb1xuICAgICAgICBlbHNlXG4gICAgICAgICAgbnVsbFxuICAgICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBwb3NpdGlvbiBkb2VzIG5vdCBleGlzdFwiXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcInlvdSBtdXN0IHNwZWNpZnkgYSBwb3NpdGlvbiBwYXJhbWV0ZXJcIlxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgIyBlLmcuIFwiYWJjXCIgOiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyIGFuZCBvLnByZXZfY2w/XG4gICAgICAgICAgIyB0aGUgdXNlciBvciB5b3UgZ2F2ZSBhIHBvc2l0aW9uIHBhcmFtZXRlciB0aGF0IGlzIHRvIGJpZ1xuICAgICAgICAgICMgZm9yIHRoZSBjdXJyZW50IGFycmF5LiBUaGVyZWZvcmUgd2UgcmVhY2ggYSBEZWxpbWl0ZXIuXG4gICAgICAgICAgIyBUaGVuLCB3ZSdsbCBqdXN0IHJldHVybiB0aGUgbGFzdCBjaGFyYWN0ZXIuXG4gICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIHdoaWxlIG8uaXNEZWxldGVkKCkgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uIC09IDFcbiAgICAgIG9cblxuICAgIHB1c2g6IChjb250ZW50KS0+XG4gICAgICBAaW5zZXJ0QWZ0ZXIgQGVuZC5wcmV2X2NsLCBbY29udGVudF1cblxuICAgIGluc2VydEFmdGVyOiAobGVmdCwgY29udGVudHMpLT5cbiAgICAgIHJpZ2h0ID0gbGVmdC5uZXh0X2NsXG4gICAgICB3aGlsZSByaWdodC5pc0RlbGV0ZWQoKVxuICAgICAgICByaWdodCA9IHJpZ2h0Lm5leHRfY2wgIyBmaW5kIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gdGhlIHJpZ2h0LCB0aGF0IGlzIG5vdCBkZWxldGVkLiBJbiB0aGUgY2FzZSB0aGF0IHBvc2l0aW9uIGlzIDAsIGl0cyB0aGUgRGVsaW1pdGVyLlxuICAgICAgbGVmdCA9IHJpZ2h0LnByZXZfY2xcblxuICAgICAgIyBUT0RPOiBhbHdheXMgZXhwZWN0IGFuIGFycmF5IGFzIGNvbnRlbnQuIFRoZW4geW91IGNhbiBjb21iaW5lIHRoaXMgd2l0aCB0aGUgb3RoZXIgb3B0aW9uIChlbHNlKVxuICAgICAgaWYgY29udGVudHMgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgIChuZXcgb3BzLkluc2VydCBudWxsLCBjb250ZW50LCBudWxsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50c1xuICAgICAgICAgIGlmIGM/IGFuZCBjLl9uYW1lPyBhbmQgYy5fZ2V0TW9kZWw/XG4gICAgICAgICAgICBjID0gYy5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgICAgdG1wID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGMsIG51bGwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICAgICAgbGVmdCA9IHRtcFxuICAgICAgQFxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhbiBhcnJheSBvZiBjb250ZW50IGludG8gdGhpcyBsaXN0LlxuICAgICMgQE5vdGU6IFRoaXMgZXhwZWN0cyBhbiBhcnJheSBhcyBjb250ZW50IVxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdC5cbiAgICAjXG4gICAgaW5zZXJ0OiAocG9zaXRpb24sIGNvbnRlbnRzKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnRzXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGEgcGFydCBvZiB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3RcbiAgICAjXG4gICAgZGVsZXRlOiAocG9zaXRpb24sIGxlbmd0aCA9IDEpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIChub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxuICAgICAgZ2V0Q29udGVudFR5cGUgPSAoY29udGVudCktPlxuICAgICAgICBpZiBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjb250ZW50XG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJpbnNlcnRcIlxuICAgICAgICByZWZlcmVuY2U6IG9wXG4gICAgICAgIHBvc2l0aW9uOiBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQGdldEN1c3RvbVR5cGUoKVxuICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgIHZhbHVlOiBnZXRDb250ZW50VHlwZSBvcC52YWwoKVxuICAgICAgXVxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAob3AsIGRlbF9vcCktPlxuICAgICAgQGNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgcmVmZXJlbmNlOiBvcFxuICAgICAgICBwb3NpdGlvbjogb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKCkgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxuICAgICAgICBsZW5ndGg6IDFcbiAgICAgICAgY2hhbmdlZEJ5OiBkZWxfb3AudWlkLmNyZWF0b3JcbiAgICAgICAgb2xkVmFsdWU6IG9wLnZhbCgpXG4gICAgICBdXG5cbiAgb3BzLkxpc3RNYW5hZ2VyLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpXG5cbiAgY2xhc3Mgb3BzLkNvbXBvc2l0aW9uIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG5cbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBAX2NvbXBvc2l0aW9uX3ZhbHVlLCBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zLCB1aWQsIHRtcF9jb21wb3NpdGlvbl9yZWYpLT5cbiAgICAgICMgd2UgY2FuJ3QgdXNlIEBzZXZlT3BlcmF0aW9uICdjb21wb3NpdGlvbl9yZWYnLCB0bXBfY29tcG9zaXRpb25fcmVmIGhlcmUsXG4gICAgICAjIGJlY2F1c2UgdGhlbiB0aGVyZSBpcyBhIFwibG9vcFwiIChpbnNlcnRpb24gcmVmZXJzIHRvIHBhcmVudCwgcmVmZXJzIHRvIGluc2VydGlvbi4uKVxuICAgICAgIyBUaGlzIGlzIHdoeSB3ZSBoYXZlIHRvIGNoZWNrIGluIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMgdW50aWwgd2UgZmluZCBpdFxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuICAgICAgaWYgdG1wX2NvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAgQHRtcF9jb21wb3NpdGlvbl9yZWYgPSB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICBlbHNlXG4gICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBAZW5kLnByZXZfY2xcbiAgICAgIGlmIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnM/XG4gICAgICAgIEBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG4sbyBvZiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAgICAgQHNhdmVPcGVyYXRpb24gbiwgbywgJ19jb21wb3NpdGlvbl92YWx1ZSdcblxuICAgIHR5cGU6IFwiQ29tcG9zaXRpb25cIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBzZWUgT3BlcmF0aW9uLmV4ZWN1dGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKS5fc2V0Q29tcG9zaXRpb25WYWx1ZSBAX2NvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICAgIGRlbGV0ZSBAX2NvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBUaGlzIGlzIGNhbGxlZCwgd2hlbiB0aGUgSW5zZXJ0LW9wZXJhdGlvbiB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICNcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxuICAgICAgaWYgQHRtcF9jb21wb3NpdGlvbl9yZWY/XG4gICAgICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLmNyZWF0b3IgYW5kIG9wLnVpZC5vcF9udW1iZXIgaXMgQHRtcF9jb21wb3NpdGlvbl9yZWYub3BfbnVtYmVyXG4gICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IG9wXG4gICAgICAgICAgZGVsZXRlIEB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICAgICAgbyA9IG9wLm5leHRfY2xcbiAgICAgICAgICB3aGlsZSBvLm5leHRfY2w/XG4gICAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzIG9cbiAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgcmV0dXJuXG5cbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWYubmV4dF9jbCBpcyBvcFxuICAgICAgICBvcC51bmRvX2RlbHRhID0gQGdldEN1c3RvbVR5cGUoKS5fYXBwbHkgb3AudmFsKClcbiAgICAgIGVsc2VcbiAgICAgICAgbyA9IEBlbmQucHJldl9jbFxuICAgICAgICB3aGlsZSBvIGlzbnQgb3BcbiAgICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl91bmFwcGx5IG8udW5kb19kZWx0YVxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgICBvLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvLnZhbCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxuXG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxuICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgIG5ld1ZhbHVlOiBAdmFsKClcbiAgICAgIF1cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cbiAgICAgIHJldHVyblxuXG4gICAgI1xuICAgICMgQ3JlYXRlIGEgbmV3IERlbHRhXG4gICAgIyAtIGluc2VydHMgbmV3IENvbnRlbnQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICMgLSB1cGRhdGVzIHRoZSBjb21wb3NpdGlvbl92YWx1ZVxuICAgICMgLSB1cGRhdGVzIHRoZSBjb21wb3NpdGlvbl9yZWZcbiAgICAjXG4gICAgIyBAcGFyYW0gZGVsdGEgVGhlIGRlbHRhIHRoYXQgaXMgYXBwbGllZCB0byB0aGUgY29tcG9zaXRpb25fdmFsdWVcbiAgICAjXG4gICAgYXBwbHlEZWx0YTogKGRlbHRhLCBvcGVyYXRpb25zKS0+XG4gICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgZGVsdGEsIG9wZXJhdGlvbnMsIEAsIG51bGwsIEBlbmQucHJldl9jbCwgQGVuZCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGN1c3RvbSA9IEBnZXRDdXN0b21UeXBlKCkuX2dldENvbXBvc2l0aW9uVmFsdWUoKVxuICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZSA9IGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZVxuICAgICAgaWYgY3VzdG9tLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnM/XG4gICAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucyA9IHt9XG4gICAgICAgIGZvciBuLG8gb2YgY3VzdG9tLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcbiAgICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNbbl0gPSBvLmdldFVpZCgpXG4gICAgICBpZiBAY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3JlZiA9IEBjb21wb3NpdGlvbl9yZWYuZ2V0VWlkKClcbiAgICAgIGVsc2VcbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5Db21wb3NpdGlvbi5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZSc6IGN1c3RvbV90eXBlXG4gICAgICAnY29tcG9zaXRpb25fdmFsdWUnIDogY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICdjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zJyA6IGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcbiAgICAgICdjb21wb3NpdGlvbl9yZWYnIDogY29tcG9zaXRpb25fcmVmXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgY29tcG9zaXRpb25fcmVmKVxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgVGV4dFR5cGUtdHlwZSBoYXMgaW1wbGVtZW50ZWQgc3VwcG9ydCBmb3IgcmVwbGFjZVxuICAjIEBzZWUgVGV4dFR5cGVcbiAgI1xuICBjbGFzcyBvcHMuUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfcHJvcGVydGllcyBEZWNvcmF0ZXMgdGhlIGV2ZW50IHRoYXQgaXMgdGhyb3duIGJ5IHRoZSBSTVxuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3RoaXMgVGhlIG9iamVjdCBvbiB3aGljaCB0aGUgZXZlbnQgc2hhbGwgYmUgZXhlY3V0ZWRcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgQGV2ZW50X3Byb3BlcnRpZXMsIEBldmVudF90aGlzLCB1aWQpLT5cbiAgICAgIGlmIG5vdCBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10/XG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzLmdldEN1c3RvbVR5cGUoKVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXG5cbiAgICAjXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcbiAgICAjIFJlcGxhY2VhYmxlcyBhbHNvIG5vdCB0aHJvdyB0aGUgc2FtZSBldmVudHMuXG4gICAgIyBTbywgUmVwbGFjZU1hbmFnZXIgYW5kIExpc3RNYW5hZ2VyIGJvdGggaW1wbGVtZW50XG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cbiAgICAjXG4gICAgI1xuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxuICAgICAgaWYgbm90IEBpc0RlbGV0ZWQoKVxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xuICAgICAgICAgICAgZXZlbnRbbmFtZV0gPSBwcm9wXG4gICAgICAgIEBldmVudF90aGlzLmNhbGxFdmVudCBldmVudHNcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC10eXBlIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXG4gICAgIyBUT0RPOiBjb25zaWRlciBkb2luZyB0aGlzIGluIGEgbW9yZSBjb25zaXN0ZW50IG1hbm5lci4gVGhpcyBjb3VsZCBhbHNvIGJlXG4gICAgIyBkb25lIHdpdGggZXhlY3V0ZS4gQnV0IGN1cnJlbnRseSwgdGhlcmUgYXJlIG5vIHNwZWNpdGFsIEluc2VydC1vcHMgZm9yIExpc3RNYW5hZ2VyLlxuICAgICNcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxuICAgICAgaWYgb3AubmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCIgYW5kIG9wLnByZXZfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyB0aGlzIHJlcGxhY2VzIGFub3RoZXIgUmVwbGFjZWFibGVcbiAgICAgICAgaWYgbm90IG9wLmlzX2RlbGV0ZWQgIyBXaGVuIHRoaXMgaXMgcmVjZWl2ZWQgZnJvbSB0aGUgSEIsIHRoaXMgY291bGQgYWxyZWFkeSBiZSBkZWxldGVkIVxuICAgICAgICAgIG9sZF92YWx1ZSA9IG9wLnByZXZfY2wudmFsKClcbiAgICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgICAgIGNoYW5nZWRCeTogb3AudWlkLmNyZWF0b3JcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcbiAgICAgICAgICBdXG4gICAgICAgIG9wLnByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSBpZiBvcC5uZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgVGhpcyB3b24ndCBiZSByZWNvZ25pemVkIGJ5IHRoZSB1c2VyLCBiZWNhdXNlIGFub3RoZXJcbiAgICAgICAgIyBjb25jdXJyZW50IG9wZXJhdGlvbiBpcyBzZXQgYXMgdGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIFJNXG4gICAgICAgIG9wLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgIyBwcmV2IF9hbmRfIG5leHQgYXJlIERlbGltaXRlcnMuIFRoaXMgaXMgdGhlIGZpcnN0IGNyZWF0ZWQgUmVwbGFjZWFibGUgaW4gdGhlIFJNXG4gICAgICAgIEBjYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgIF1cbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAob3AsIGRlbF9vcCktPlxuICAgICAgaWYgb3AubmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXG4gICAgICAgICAgb2xkVmFsdWU6IG9wLnZhbCgpXG4gICAgICAgIF1cblxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIHJlbHAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2wpLmV4ZWN1dGUoKVxuICAgICAgIyBUT0RPOiBkZWxldGUgcmVwbCAoZm9yIGRlYnVnZ2luZylcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgaXNDb250ZW50RGVsZXRlZDogKCktPlxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxuXG4gICAgZGVsZXRlQ29udGVudDogKCktPlxuICAgICAgKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXNcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuXG5cbiAgYmFzaWNfb3BzXG4iLCJcblkgPSByZXF1aXJlICcuL3knXG5cbmJpbmRUb0NoaWxkcmVuID0gKHRoYXQpLT5cbiAgZm9yIGkgaW4gWzAuLi50aGF0LmNoaWxkcmVuLmxlbmd0aF1cbiAgICBhdHRyID0gdGhhdC5jaGlsZHJlbi5pdGVtKGkpXG4gICAgaWYgYXR0ci5uYW1lP1xuICAgICAgYXR0ci52YWwgPSB0aGF0LnZhbC52YWwoYXR0ci5uYW1lKVxuICB0aGF0LnZhbC5vYnNlcnZlIChldmVudHMpLT5cbiAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICBpZiBldmVudC5uYW1lP1xuICAgICAgICBmb3IgaSBpbiBbMC4uLnRoYXQuY2hpbGRyZW4ubGVuZ3RoXVxuICAgICAgICAgIGF0dHIgPSB0aGF0LmNoaWxkcmVuLml0ZW0oaSlcbiAgICAgICAgICBpZiBhdHRyLm5hbWU/IGFuZCBhdHRyLm5hbWUgaXMgZXZlbnQubmFtZVxuICAgICAgICAgICAgbmV3VmFsID0gdGhhdC52YWwudmFsKGF0dHIubmFtZSlcbiAgICAgICAgICAgIGlmIGF0dHIudmFsIGlzbnQgbmV3VmFsXG4gICAgICAgICAgICAgIGF0dHIudmFsID0gbmV3VmFsXG5cblBvbHltZXIgXCJ5LW9iamVjdFwiLFxuICByZWFkeTogKCktPlxuICAgIGlmIEBjb25uZWN0b3I/XG4gICAgICBAdmFsID0gbmV3IFkgQGNvbm5lY3RvclxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuICAgIGVsc2UgaWYgQHZhbD9cbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuICB2YWxDaGFuZ2VkOiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEB2YWwudHlwZSBpcyBcIk9iamVjdFwiXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgY29ubmVjdG9yQ2hhbmdlZDogKCktPlxuICAgIGlmIChub3QgQHZhbD8pXG4gICAgICBAdmFsID0gbmV3IFkgQGNvbm5lY3RvclxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG5Qb2x5bWVyIFwieS1wcm9wZXJ0eVwiLFxuICByZWFkeTogKCktPlxuICAgIGlmIEB2YWw/IGFuZCBAbmFtZT9cbiAgICAgIGlmIEB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgIEB2YWwgPSBAcGFyZW50RWxlbWVudC52YWwoQG5hbWUsQHZhbCkudmFsKEBuYW1lKVxuICAgICAgICAjIFRPRE86IHBsZWFzZSB1c2UgaW5zdGFuY2VvZiBpbnN0ZWFkIG9mIC50eXBlLFxuICAgICAgICAjIHNpbmNlIGl0IGlzIG1vcmUgc2FmZSAoY29uc2lkZXIgc29tZW9uZSBwdXR0aW5nIGEgY3VzdG9tIE9iamVjdCB0eXBlIGhlcmUpXG4gICAgICBlbHNlIGlmIHR5cGVvZiBAdmFsIGlzIFwic3RyaW5nXCJcbiAgICAgICAgQHBhcmVudEVsZW1lbnQudmFsKEBuYW1lLEB2YWwpXG4gICAgICBpZiBAdmFsLnR5cGUgaXMgXCJPYmplY3RcIlxuICAgICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgdmFsQ2hhbmdlZDogKCktPlxuICAgIGlmIEB2YWw/IGFuZCBAbmFtZT9cbiAgICAgIGlmIEB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgIEB2YWwgPSBAcGFyZW50RWxlbWVudC52YWwudmFsKEBuYW1lLEB2YWwpLnZhbChAbmFtZSlcbiAgICAgICAgIyBUT0RPOiBwbGVhc2UgdXNlIGluc3RhbmNlb2YgaW5zdGVhZCBvZiAudHlwZSxcbiAgICAgICAgIyBzaW5jZSBpdCBpcyBtb3JlIHNhZmUgKGNvbnNpZGVyIHNvbWVvbmUgcHV0dGluZyBhIGN1c3RvbSBPYmplY3QgdHlwZSBoZXJlKVxuICAgICAgZWxzZSBpZiBAdmFsLnR5cGUgaXMgXCJPYmplY3RcIlxuICAgICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgICBlbHNlIGlmIEBwYXJlbnRFbGVtZW50LnZhbD8udmFsPyBhbmQgQHZhbCBpc250IEBwYXJlbnRFbGVtZW50LnZhbC52YWwoQG5hbWUpXG4gICAgICAgIEBwYXJlbnRFbGVtZW50LnZhbC52YWwgQG5hbWUsIEB2YWxcblxuXG4iLCJcbnN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9PcGVyYXRpb25zL1N0cnVjdHVyZWRcIlxuXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4vSGlzdG9yeUJ1ZmZlclwiXG5FbmdpbmUgPSByZXF1aXJlIFwiLi9FbmdpbmVcIlxuYWRhcHRDb25uZWN0b3IgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JBZGFwdGVyXCJcblxuY3JlYXRlWSA9IChjb25uZWN0b3IpLT5cbiAgdXNlcl9pZCA9IG51bGxcbiAgaWYgY29ubmVjdG9yLnVzZXJfaWQ/XG4gICAgdXNlcl9pZCA9IGNvbm5lY3Rvci51c2VyX2lkICMgVE9ETzogY2hhbmdlIHRvIGdldFVuaXF1ZUlkKClcbiAgZWxzZVxuICAgIHVzZXJfaWQgPSBcIl90ZW1wXCJcbiAgICBjb25uZWN0b3Iub25fdXNlcl9pZF9zZXQgPSAoaWQpLT5cbiAgICAgIHVzZXJfaWQgPSBpZFxuICAgICAgSEIucmVzZXRVc2VySWQgaWRcbiAgSEIgPSBuZXcgSGlzdG9yeUJ1ZmZlciB1c2VyX2lkXG4gIG9wc19tYW5hZ2VyID0gc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCBIQiwgdGhpcy5jb25zdHJ1Y3RvclxuICBvcHMgPSBvcHNfbWFuYWdlci5vcGVyYXRpb25zXG5cbiAgZW5naW5lID0gbmV3IEVuZ2luZSBIQiwgb3BzXG4gIGFkYXB0Q29ubmVjdG9yIGNvbm5lY3RvciwgZW5naW5lLCBIQiwgb3BzX21hbmFnZXIuZXhlY3V0aW9uX2xpc3RlbmVyXG5cbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuSEIgPSBIQlxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5vcGVyYXRpb25zID0gb3BzXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmVuZ2luZSA9IGVuZ2luZVxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jb25uZWN0b3IgPSBjb25uZWN0b3JcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY3VzdG9tX3R5cGVzID0gdGhpcy5jb25zdHJ1Y3RvclxuXG4gIGN0ID0gbmV3IGNyZWF0ZVkuT2JqZWN0KClcbiAgbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoY3QsIEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKS5leGVjdXRlKClcbiAgY3QuX3NldE1vZGVsIG1vZGVsXG4gIGN0XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlWVxuaWYgd2luZG93P1xuICB3aW5kb3cuWSA9IGNyZWF0ZVlcblxuY3JlYXRlWS5PYmplY3QgPSByZXF1aXJlIFwiLi9PYmplY3RUeXBlXCJcbiJdfQ==
