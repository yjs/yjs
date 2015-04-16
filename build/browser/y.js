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
    return this.is_initialized = true;
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
    delete this.connections[user];
    return this.findNewSyncTarget();
  },
  userJoined: function(user, role) {
    var _base;
    if (role == null) {
      throw new Error("Internal: You must specify the role of the joined user! E.g. userJoined('uid:3939','slave')");
    }
    if ((_base = this.connections)[user] == null) {
      _base[user] = {};
    }
    this.connections[user].is_synced = false;
    if ((!this.is_synced) || this.syncMethod === "syncAll") {
      if (this.syncMethod === "syncAll") {
        return this.performSync(user);
      } else if (role === "master") {
        return this.performSyncWithMaster(user);
      }
    }
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
    function Operation(custom_type, uid) {
      if (custom_type != null) {
        this.custom_type = custom_type;
      }
      this.is_deleted = false;
      this.garbage_collected = false;
      this.event_listeners = [];
      if (uid != null) {
        this.uid = uid;
      }
    }

    Operation.prototype.type = "Operation";

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
    };

    Operation.prototype._encode = function(json) {
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
      return json;
    };

    Operation.prototype.saveOperation = function(name, op) {
      if (op == null) {

      } else if ((op.execute != null) || !((op.op_number != null) && (op.creator != null))) {
        return this[name] = op;
      } else {
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
        op = this.HB.getOperation(op_uid);
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

    function Insert(custom_type, content, parent, uid, prev_cl, next_cl, origin) {
      if (content === void 0) {

      } else if ((content != null) && (content.creator != null)) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      this.saveOperation('parent', parent);
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      if (origin != null) {
        this.saveOperation('origin', origin);
      } else {
        this.saveOperation('origin', prev_cl);
      }
      Insert.__super__.constructor.call(this, custom_type, uid);
    }

    Insert.prototype.type = "Insert";

    Insert.prototype.val = function() {
      if ((this.content != null) && (this.content.getCustomType != null)) {
        return this.content.getCustomType();
      } else {
        return this.content;
      }
    };

    Insert.prototype.getNext = function(i) {
      var n;
      if (i == null) {
        i = 1;
      }
      n = this;
      while (i > 0 && n.is_deleted && (n.next_cl != null)) {
        n = n.next_cl;
        if (!n.is_deleted) {
          i--;
        }
      }
      return n;
    };

    Insert.prototype.getPrev = function(i) {
      var n;
      if (i == null) {
        i = 1;
      }
      n = this;
      while (i > 0 && n.is_deleted && (n.prev_cl != null)) {
        n = n.prev_cl;
        if (!n.is_deleted) {
          i--;
        }
      }
      return n;
    };

    Insert.prototype.applyDelete = function(o) {
      var callLater, garbagecollect, _ref;
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
      if ((_ref = this.prev_cl) != null ? _ref.isDeleted() : void 0) {
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
        if (this.content instanceof ops.Operation) {
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
      var _ref;
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
      if (((_ref = this.content) != null ? _ref.getUid : void 0) != null) {
        json['content'] = this.content.getUid();
      } else {
        json['content'] = JSON.stringify(this.content);
      }
      return Insert.__super__._encode.call(this, json);
    };

    return Insert;

  })(ops.Operation);
  ops.Insert.parse = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], parent = json['parent'];
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    return new this(null, content, parent, uid, prev, next, origin);
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

    function MapManager(custom_type, uid) {
      this._map = {};
      MapManager.__super__.constructor.call(this, custom_type, uid);
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
    var custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'];
    return new this(custom_type, uid);
  };
  ops.ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(custom_type, uid) {
      this.beginning = new ops.Delimiter(void 0, void 0);
      this.end = new ops.Delimiter(this.beginning, void 0);
      this.beginning.next_cl = this.end;
      this.beginning.execute();
      this.end.execute();
      ListManager.__super__.constructor.call(this, custom_type, uid);
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
        (new ops.Insert(null, content, void 0, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = contents.length; _i < _len; _i++) {
          c = contents[_i];
          if ((c != null) && (c._name != null) && (c._getModel != null)) {
            c = c._getModel(this.custom_types, this.operations);
          }
          tmp = (new ops.Insert(null, c, void 0, void 0, left, right)).execute();
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
          position: op.getPosition(),
          object: this.getCustomType(),
          changedBy: op.uid.creator,
          value: getContentType(op.content)
        }
      ]);
    };

    ListManager.prototype.callOperationSpecificDeleteEvents = function(op, del_op) {
      return this.callEvent([
        {
          type: "delete",
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
    var custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'];
    return new this(custom_type, uid);
  };
  ops.Composition = (function(_super) {
    __extends(Composition, _super);

    function Composition(custom_type, composition_value, uid, tmp_composition_ref) {
      Composition.__super__.constructor.call(this, custom_type, uid);
      if (tmp_composition_ref != null) {
        this.tmp_composition_ref = tmp_composition_ref;
      } else {
        this.composition_ref = this.end.prev_cl;
      }
    }

    Composition.prototype.type = "Composition";

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
        op.undo_delta = this.getCustomType()._apply(op.content);
      } else {
        o = this.end.prev_cl;
        while (o !== op) {
          this.getCustomType()._unapply(o.undo_delta);
          o = o.prev_cl;
        }
        while (o !== this.end) {
          o.undo_delta = this.getCustomType()._apply(o.content);
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

    Composition.prototype.applyDelta = function(delta) {
      (new ops.Insert(null, delta, this, null, this.end.prev_cl, this.end)).execute();
      return void 0;
    };

    Composition.prototype._encode = function(json) {
      if (json == null) {
        json = {};
      }
      json.composition_value = JSON.stringify(this.getCustomType()._getCompositionValue());
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
    var composition_ref, composition_value, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], composition_value = json['composition_value'], composition_ref = json['composition_ref'];
    return new this(custom_type, JSON.parse(composition_value), uid, composition_ref);
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
      relp = (new ops.Insert(null, content, this, replaceable_uid, o, o.next_cl)).execute();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOlxcVXNlcnNcXGRtb25hZFxcRG9jdW1lbnRzXFxHaXRIdWJcXHlqc1xcbGliXFxDb25uZWN0b3JBZGFwdGVyLmNvZmZlZSIsIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxsaWJcXENvbm5lY3RvckNsYXNzLmNvZmZlZSIsIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxsaWJcXEVuZ2luZS5jb2ZmZWUiLCJDOlxcVXNlcnNcXGRtb25hZFxcRG9jdW1lbnRzXFxHaXRIdWJcXHlqc1xcbGliXFxIaXN0b3J5QnVmZmVyLmNvZmZlZSIsIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxsaWJcXE9iamVjdFR5cGUuY29mZmVlIiwiQzpcXFVzZXJzXFxkbW9uYWRcXERvY3VtZW50c1xcR2l0SHViXFx5anNcXGxpYlxcT3BlcmF0aW9uc1xcQmFzaWMuY29mZmVlIiwiQzpcXFVzZXJzXFxkbW9uYWRcXERvY3VtZW50c1xcR2l0SHViXFx5anNcXGxpYlxcT3BlcmF0aW9uc1xcU3RydWN0dXJlZC5jb2ZmZWUiLCJDOlxcVXNlcnNcXGRtb25hZFxcRG9jdW1lbnRzXFxHaXRIdWJcXHlqc1xcbGliXFx5LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0NBLElBQUEsOEJBQUE7O0FBQUEsY0FBQSxHQUFpQixPQUFBLENBQVEsa0JBQVIsQ0FBakIsQ0FBQTs7QUFBQSxjQU1BLEdBQWlCLFNBQUMsU0FBRCxFQUFZLE1BQVosRUFBb0IsRUFBcEIsRUFBd0Isa0JBQXhCLEdBQUE7QUFFZixNQUFBLHVGQUFB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QUFBO0FBQUEsRUFrQkEsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBeEIsR0FBb0MsU0FsQnBDLENBQUE7QUFBQSxFQW1CQSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxZQUF4QixHQUF1QyxJQUFJLENBQUMsV0FuQjVDLENBQUE7QUFBQSxFQXFCQSxFQUFBLEdBQVMsSUFBQSxPQUFPLENBQUMsTUFBUixDQUFBLENBckJULENBQUE7QUFBQSxFQXNCQSxLQUFBLEdBQVksSUFBQSxHQUFHLENBQUMsVUFBSixDQUFlLEVBQWYsRUFBbUIsRUFBRSxDQUFDLDJCQUFILENBQUEsQ0FBbkIsQ0FBb0QsQ0FBQyxPQUFyRCxDQUFBLENBdEJaLENBQUE7QUFBQSxFQXVCQSxFQUFFLENBQUMsU0FBSCxDQUFhLEtBQWIsQ0F2QkEsQ0FBQTtTQXdCQSxHQXpCUTtBQUFBLENBTlYsQ0FBQTs7QUFBQSxNQWlDTSxDQUFDLE9BQVAsR0FBaUIsT0FqQ2pCLENBQUE7O0FBa0NBLElBQUcsZ0RBQUg7QUFDRSxFQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsT0FBWCxDQURGO0NBbENBOztBQUFBLE9BcUNPLENBQUMsTUFBUixHQUFpQixPQUFBLENBQVEsY0FBUixDQXJDakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcclxuQ29ubmVjdG9yQ2xhc3MgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JDbGFzc1wiXHJcbiNcclxuIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcclxuIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXHJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxyXG4jXHJcbmFkYXB0Q29ubmVjdG9yID0gKGNvbm5lY3RvciwgZW5naW5lLCBIQiwgZXhlY3V0aW9uX2xpc3RlbmVyKS0+XHJcblxyXG4gIGZvciBuYW1lLCBmIG9mIENvbm5lY3RvckNsYXNzXHJcbiAgICBjb25uZWN0b3JbbmFtZV0gPSBmXHJcblxyXG4gIGNvbm5lY3Rvci5zZXRJc0JvdW5kVG9ZKClcclxuXHJcbiAgc2VuZF8gPSAobyktPlxyXG4gICAgaWYgKG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkpIGFuZFxyXG4gICAgICAgICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIikgYW5kICMgVE9ETzogaSBkb24ndCB0aGluayB0aGF0IHdlIG5lZWQgdGhpcyBhbnltb3JlLi5cclxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXHJcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xyXG5cclxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cclxuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXHJcblxyXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXHJcbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxyXG4gICMgdGhlcmVmb3JlLCB3ZSBoYXZlIHRvIHJlc3RydWN0dXJlIGl0IGxhdGVyXHJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XHJcbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XHJcbiAgICAgIHVzZXI6IG5hbWVcclxuICAgICAgc3RhdGU6IHZhbHVlXHJcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cclxuICAgIHN0YXRlX3ZlY3RvciA9IHt9XHJcbiAgICBmb3IgcyBpbiB2XHJcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxyXG4gICAgc3RhdGVfdmVjdG9yXHJcblxyXG4gIGdldFN0YXRlVmVjdG9yID0gKCktPlxyXG4gICAgZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcclxuXHJcbiAgZ2V0SEIgPSAodiktPlxyXG4gICAgc3RhdGVfdmVjdG9yID0gcGFyc2Vfc3RhdGVfdmVjdG9yIHZcclxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcclxuICAgIGpzb24gPVxyXG4gICAgICBoYjogaGJcclxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxyXG4gICAganNvblxyXG5cclxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cclxuICAgIGVuZ2luZS5hcHBseU9wIGhiLCBmcm9tSEJcclxuXHJcbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcclxuICBjb25uZWN0b3IuZ2V0SEIgPSBnZXRIQlxyXG4gIGNvbm5lY3Rvci5hcHBseUhCID0gYXBwbHlIQlxyXG5cclxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxyXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzLnB1c2ggKHNlbmRlciwgb3ApLT5cclxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcclxuICAgICAgZW5naW5lLmFwcGx5T3Agb3BcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGFkYXB0Q29ubmVjdG9yIiwiXHJcbm1vZHVsZS5leHBvcnRzID1cclxuICAjXHJcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcclxuICAjICAgQHBhcmFtIG9wdGlvbnMuc3luY01ldGhvZCB7U3RyaW5nfSAgaXMgZWl0aGVyIFwic3luY0FsbFwiIG9yIFwibWFzdGVyLXNsYXZlXCIuXHJcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnJvbGUge1N0cmluZ30gVGhlIHJvbGUgb2YgdGhpcyBjbGllbnRcclxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxyXG4gICMgICBAcGFyYW0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4ge0Jvb2xlYW59IFdoZXRlaHIgdG8gd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycywgYnV0IGhhcyBzb21lIG92ZXJoZWFkIChvcHRpb25hbClcclxuICAjXHJcbiAgaW5pdDogKG9wdGlvbnMpLT5cclxuICAgIHJlcSA9IChuYW1lLCBjaG9pY2VzKT0+XHJcbiAgICAgIGlmIG9wdGlvbnNbbmFtZV0/XHJcbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxyXG4gICAgICAgICAgQFtuYW1lXSA9IG9wdGlvbnNbbmFtZV1cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgc3BlY2lmeSBcIituYW1lK1wiLCB3aGVuIGluaXRpYWxpemluZyB0aGUgQ29ubmVjdG9yIVwiXHJcblxyXG4gICAgcmVxIFwic3luY01ldGhvZFwiLCBbXCJzeW5jQWxsXCIsIFwibWFzdGVyLXNsYXZlXCJdXHJcbiAgICByZXEgXCJyb2xlXCIsIFtcIm1hc3RlclwiLCBcInNsYXZlXCJdXHJcbiAgICByZXEgXCJ1c2VyX2lkXCJcclxuICAgIEBvbl91c2VyX2lkX3NldD8oQHVzZXJfaWQpXHJcblxyXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxyXG4gICAgIyBCdXQgdGhpcyBpcyBub3QgbmVjZXNzYXJ5IGluIHRoZSB0ZXN0LWNvbm5lY3RvclxyXG4gICAgaWYgb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4/XHJcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxyXG4gICAgZWxzZVxyXG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gdHJ1ZVxyXG5cclxuICAgICMgQSBNYXN0ZXIgc2hvdWxkIHN5bmMgd2l0aCBldmVyeW9uZSEgVE9ETzogcmVhbGx5PyAtIGZvciBub3cgaXRzIHNhZmVyIHRoaXMgd2F5IVxyXG4gICAgaWYgQHJvbGUgaXMgXCJtYXN0ZXJcIlxyXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXHJcblxyXG4gICAgIyBpcyBzZXQgdG8gdHJ1ZSB3aGVuIHRoaXMgaXMgc3luY2VkIHdpdGggYWxsIG90aGVyIGNvbm5lY3Rpb25zXHJcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcclxuICAgICMgUGVlcmpzIENvbm5lY3Rpb25zOiBrZXk6IGNvbm4taWQsIHZhbHVlOiBvYmplY3RcclxuICAgIEBjb25uZWN0aW9ucyA9IHt9XHJcbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXHJcbiAgICBAcmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxyXG5cclxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXHJcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxyXG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXHJcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxyXG4gICAgQGlzX2luaXRpYWxpemVkID0gdHJ1ZVxyXG5cclxuICBpc1JvbGVNYXN0ZXI6IC0+XHJcbiAgICBAcm9sZSBpcyBcIm1hc3RlclwiXHJcblxyXG4gIGlzUm9sZVNsYXZlOiAtPlxyXG4gICAgQHJvbGUgaXMgXCJzbGF2ZVwiXHJcblxyXG4gIGZpbmROZXdTeW5jVGFyZ2V0OiAoKS0+XHJcbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcclxuICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXHJcbiAgICAgIGZvciB1c2VyLCBjIG9mIEBjb25uZWN0aW9uc1xyXG4gICAgICAgIGlmIG5vdCBjLmlzX3N5bmNlZFxyXG4gICAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcclxuICAgICAgICAgIGJyZWFrXHJcbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XHJcbiAgICAgIEBzZXRTdGF0ZVN5bmNlZCgpXHJcbiAgICBudWxsXHJcblxyXG4gIHVzZXJMZWZ0OiAodXNlciktPlxyXG4gICAgZGVsZXRlIEBjb25uZWN0aW9uc1t1c2VyXVxyXG4gICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcclxuXHJcbiAgdXNlckpvaW5lZDogKHVzZXIsIHJvbGUpLT5cclxuICAgIGlmIG5vdCByb2xlP1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJbnRlcm5hbDogWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhIEUuZy4gdXNlckpvaW5lZCgndWlkOjM5MzknLCdzbGF2ZScpXCJcclxuICAgICMgYSB1c2VyIGpvaW5lZCB0aGUgcm9vbVxyXG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdID89IHt9XHJcbiAgICBAY29ubmVjdGlvbnNbdXNlcl0uaXNfc3luY2VkID0gZmFsc2VcclxuXHJcbiAgICBpZiAobm90IEBpc19zeW5jZWQpIG9yIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXHJcbiAgICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXHJcbiAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcclxuICAgICAgZWxzZSBpZiByb2xlIGlzIFwibWFzdGVyXCJcclxuICAgICAgICAjIFRPRE86IFdoYXQgaWYgdGhlcmUgYXJlIHR3byBtYXN0ZXJzPyBQcmV2ZW50IHNlbmRpbmcgZXZlcnl0aGluZyB0d28gdGltZXMhXHJcbiAgICAgICAgQHBlcmZvcm1TeW5jV2l0aE1hc3RlciB1c2VyXHJcblxyXG5cclxuICAjXHJcbiAgIyBFeGVjdXRlIGEgZnVuY3Rpb24gX3doZW5fIHdlIGFyZSBjb25uZWN0ZWQuIElmIG5vdCBjb25uZWN0ZWQsIHdhaXQgdW50aWwgY29ubmVjdGVkLlxyXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuXHJcbiAgI1xyXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XHJcbiAgICBpZiBhcmdzLmNvbnN0cnVjdG9yZSBpcyBGdW5jdGlvblxyXG4gICAgICBhcmdzID0gW2FyZ3NdXHJcbiAgICBpZiBAaXNfc3luY2VkXHJcbiAgICAgIGFyZ3NbMF0uYXBwbHkgdGhpcywgYXJnc1sxLi5dXHJcbiAgICBlbHNlXHJcbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkID89IFtdXHJcbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkLnB1c2ggYXJnc1xyXG5cclxuICAjXHJcbiAgIyBFeGVjdXRlIGFuIGZ1bmN0aW9uIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxyXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuIGYgd2lsbCBiZSBjYWxsZWQgd2l0aCAoc2VuZGVyX2lkLCBicm9hZGNhc3Qge3RydWV8ZmFsc2V9LCBtZXNzYWdlKS5cclxuICAjXHJcbiAgb25SZWNlaXZlOiAoZiktPlxyXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMucHVzaCBmXHJcblxyXG4gICMjI1xyXG4gICMgQnJvYWRjYXN0IGEgbWVzc2FnZSB0byBhbGwgY29ubmVjdGVkIHBlZXJzLlxyXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gYnJvYWRjYXN0LlxyXG4gICNcclxuICBicm9hZGNhc3Q6IChtZXNzYWdlKS0+XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgYnJvYWRjYXN0IVwiXHJcblxyXG4gICNcclxuICAjIFNlbmQgYSBtZXNzYWdlIHRvIGEgcGVlciwgb3Igc2V0IG9mIHBlZXJzXHJcbiAgI1xyXG4gIHNlbmQ6IChwZWVyX3MsIG1lc3NhZ2UpLT5cclxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBzZW5kIVwiXHJcbiAgIyMjXHJcblxyXG4gICNcclxuICAjIHBlcmZvcm0gYSBzeW5jIHdpdGggYSBzcGVjaWZpYyB1c2VyLlxyXG4gICNcclxuICBwZXJmb3JtU3luYzogKHVzZXIpLT5cclxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cclxuICAgICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXHJcbiAgICAgIEBzZW5kIHVzZXIsXHJcbiAgICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcclxuICAgICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxyXG4gICAgICAgIGRhdGE6IFtdICMgQGdldFN0YXRlVmVjdG9yKClcclxuICAgICAgaWYgbm90IEBzZW50X2hiX3RvX2FsbF91c2Vyc1xyXG4gICAgICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IHRydWVcclxuXHJcbiAgICAgICAgaGIgPSBAZ2V0SEIoW10pLmhiXHJcbiAgICAgICAgX2hiID0gW11cclxuICAgICAgICBmb3IgbyBpbiBoYlxyXG4gICAgICAgICAgX2hiLnB1c2ggb1xyXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXHJcbiAgICAgICAgICAgIEBicm9hZGNhc3RcclxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxyXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxyXG4gICAgICAgICAgICBfaGIgPSBbXVxyXG4gICAgICAgIEBicm9hZGNhc3RcclxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcclxuICAgICAgICAgIGRhdGE6IF9oYlxyXG5cclxuXHJcblxyXG4gICNcclxuICAjIFdoZW4gYSBtYXN0ZXIgbm9kZSBqb2luZWQgdGhlIHJvb20sIHBlcmZvcm0gdGhpcyBzeW5jIHdpdGggaGltLiBJdCB3aWxsIGFzayB0aGUgbWFzdGVyIGZvciB0aGUgSEIsXHJcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxyXG4gICNcclxuICBwZXJmb3JtU3luY1dpdGhNYXN0ZXI6ICh1c2VyKS0+XHJcbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcclxuICAgIEBzZW5kIHVzZXIsXHJcbiAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXHJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXHJcbiAgICAgIGRhdGE6IFtdXHJcbiAgICBoYiA9IEBnZXRIQihbXSkuaGJcclxuICAgIF9oYiA9IFtdXHJcbiAgICBmb3IgbyBpbiBoYlxyXG4gICAgICBfaGIucHVzaCBvXHJcbiAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxyXG4gICAgICAgIEBicm9hZGNhc3RcclxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXHJcbiAgICAgICAgICBkYXRhOiBfaGJcclxuICAgICAgICBfaGIgPSBbXVxyXG4gICAgQGJyb2FkY2FzdFxyXG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXHJcbiAgICAgIGRhdGE6IF9oYlxyXG5cclxuICAjXHJcbiAgIyBZb3UgYXJlIHN1cmUgdGhhdCBhbGwgY2xpZW50cyBhcmUgc3luY2VkLCBjYWxsIHRoaXMgZnVuY3Rpb24uXHJcbiAgI1xyXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XHJcbiAgICBpZiBub3QgQGlzX3N5bmNlZFxyXG4gICAgICBAaXNfc3luY2VkID0gdHJ1ZVxyXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cclxuICAgICAgICBmb3IgZiBpbiBAY29tcHV0ZV93aGVuX3N5bmNlZFxyXG4gICAgICAgICAgZigpXHJcbiAgICAgICAgZGVsZXRlIEBjb21wdXRlX3doZW5fc3luY2VkXHJcbiAgICAgIG51bGxcclxuXHJcbiAgI1xyXG4gICMgWW91IHJlY2VpdmVkIGEgcmF3IG1lc3NhZ2UsIGFuZCB5b3Uga25vdyB0aGF0IGl0IGlzIGludGVuZGVkIGZvciB0byBZanMuIFRoZW4gY2FsbCB0aGlzIGZ1bmN0aW9uLlxyXG4gICNcclxuICByZWNlaXZlTWVzc2FnZTogKHNlbmRlciwgcmVzKS0+XHJcbiAgICBpZiBub3QgcmVzLnN5bmNfc3RlcD9cclxuICAgICAgZm9yIGYgaW4gQHJlY2VpdmVfaGFuZGxlcnNcclxuICAgICAgICBmIHNlbmRlciwgcmVzXHJcbiAgICBlbHNlXHJcbiAgICAgIGlmIHNlbmRlciBpcyBAdXNlcl9pZFxyXG4gICAgICAgIHJldHVyblxyXG4gICAgICBpZiByZXMuc3luY19zdGVwIGlzIFwiZ2V0SEJcIlxyXG4gICAgICAgIGRhdGEgPSBAZ2V0SEIocmVzLmRhdGEpXHJcbiAgICAgICAgaGIgPSBkYXRhLmhiXHJcbiAgICAgICAgX2hiID0gW11cclxuICAgICAgICAjIGFsd2F5cyBicm9hZGNhc3QsIHdoZW4gbm90IHN5bmNlZC5cclxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxyXG4gICAgICAgICMgV2hlbiB0aGlzIGNsaWVudCBvbmx5IHN5bmNzIHRvIG9uZSBvdGhlciBjbGllbnRzLCBidXQgbG9vc2VzIGNvbm5lY3RvcnMsXHJcbiAgICAgICAgIyBiZWZvcmUgc3luY2luZyB0byB0aGUgb3RoZXIgY2xpZW50cywgdGhlIG9ubGluZSBjbGllbnRzIGhhdmUgZGlmZmVyZW50IHN0YXRlcy5cclxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcclxuICAgICAgICBpZiBAaXNfc3luY2VkXHJcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XHJcbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cclxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXHJcblxyXG4gICAgICAgIGZvciBvIGluIGhiXHJcbiAgICAgICAgICBfaGIucHVzaCBvXHJcbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcclxuICAgICAgICAgICAgc2VuZEFwcGx5SEJcclxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxyXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxyXG4gICAgICAgICAgICBfaGIgPSBbXVxyXG5cclxuICAgICAgICBzZW5kQXBwbHlIQlxyXG4gICAgICAgICAgc3luY19zdGVwIDogXCJhcHBseUhCXCJcclxuICAgICAgICAgIGRhdGE6IF9oYlxyXG5cclxuICAgICAgICBpZiByZXMuc2VuZF9hZ2Fpbj8gYW5kIEBwZXJmb3JtX3NlbmRfYWdhaW5cclxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxyXG4gICAgICAgICAgICAoKT0+XHJcbiAgICAgICAgICAgICAgaGIgPSBAZ2V0SEIoc3YpLmhiXHJcbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxyXG4gICAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIixcclxuICAgICAgICAgICAgICAgIGRhdGE6IGhiXHJcbiAgICAgICAgICAgICAgICBzZW50X2FnYWluOiBcInRydWVcIlxyXG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kX2FnYWluLCAzMDAwXHJcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxyXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXHJcblxyXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxyXG4gICAgICAgICAgQGNvbm5lY3Rpb25zW3NlbmRlcl0uaXNfc3luY2VkID0gdHJ1ZVxyXG4gICAgICAgICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcclxuXHJcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJfXCJcclxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxyXG5cclxuXHJcbiAgIyBDdXJyZW50bHksIHRoZSBIQiBlbmNvZGVzIG9wZXJhdGlvbnMgYXMgSlNPTi4gRm9yIHRoZSBtb21lbnQgSSB3YW50IHRvIGtlZXAgaXRcclxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XHJcbiAgIyB0b28gbXVjaCBvdmVyaGVhZC4gWSBpcyB2ZXJ5IGxpa2VseSB0byBnZXQgY2hhbmdlZCBhIGxvdCBpbiB0aGUgZnV0dXJlXHJcbiAgI1xyXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcclxuICAjIHdlIGVuY29kZSB0aGUgSlNPTiBhcyBYTUwuXHJcbiAgI1xyXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxyXG5cclxuICAjIGRvZXMgbm90IHN1cHBvcnQgcHJpbWl0aXZlIHZhbHVlcyBhcyBhcnJheSBlbGVtZW50c1xyXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxyXG4gIHBhcnNlTWVzc2FnZUZyb21YbWw6IChtKS0+XHJcbiAgICBwYXJzZV9hcnJheSA9IChub2RlKS0+XHJcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cclxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcclxuICAgICAgICAgIHBhcnNlX2FycmF5IG5cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBwYXJzZV9vYmplY3QgblxyXG5cclxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XHJcbiAgICAgIGpzb24gPSB7fVxyXG4gICAgICBmb3IgbmFtZSwgdmFsdWUgIG9mIG5vZGUuYXR0cnNcclxuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcclxuICAgICAgICBpZiBpc05hTihpbnQpIG9yIChcIlwiK2ludCkgaXNudCB2YWx1ZVxyXG4gICAgICAgICAganNvbltuYW1lXSA9IHZhbHVlXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAganNvbltuYW1lXSA9IGludFxyXG4gICAgICBmb3IgbiBpbiBub2RlLmNoaWxkcmVuXHJcbiAgICAgICAgbmFtZSA9IG4ubmFtZVxyXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxyXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX2FycmF5IG5cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2Vfb2JqZWN0IG5cclxuICAgICAganNvblxyXG4gICAgcGFyc2Vfb2JqZWN0IG1cclxuXHJcbiAgIyBlbmNvZGUgbWVzc2FnZSBpbiB4bWxcclxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXHJcbiAgIyBTbyB7YTo0LGI6e2M6NX19IHdpbGwgbG9vayBsaWtlXHJcbiAgIyA8eSBhPVwiNFwiPlxyXG4gICMgICA8YiBjPVwiNVwiPjwvYj5cclxuICAjIDwveT5cclxuICAjIG0gLSBsdHggZWxlbWVudFxyXG4gICMganNvbiAtIGd1ZXNzIGl0IDspXHJcbiAgI1xyXG4gIGVuY29kZU1lc3NhZ2VUb1htbDogKG0sIGpzb24pLT5cclxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxyXG4gICAgZW5jb2RlX29iamVjdCA9IChtLCBqc29uKS0+XHJcbiAgICAgIGZvciBuYW1lLHZhbHVlIG9mIGpzb25cclxuICAgICAgICBpZiBub3QgdmFsdWU/XHJcbiAgICAgICAgICAjIG5vcFxyXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcclxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIEFycmF5XHJcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKG5hbWUpLCB2YWx1ZVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIG0uc2V0QXR0cmlidXRlKG5hbWUsdmFsdWUpXHJcbiAgICAgIG1cclxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxyXG4gICAgICBtLnNldEF0dHJpYnV0ZShcImlzQXJyYXlcIixcInRydWVcIilcclxuICAgICAgZm9yIGUgaW4gYXJyYXlcclxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxyXG4gICAgICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJhcnJheS1lbGVtZW50XCIpLCBlXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcclxuICAgICAgbVxyXG4gICAgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cclxuICAgIGVsc2UgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBBcnJheVxyXG4gICAgICBlbmNvZGVfYXJyYXkgbS5jKFwieVwiLHt4bWxuczpcImh0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemFcIn0pLCBqc29uXHJcbiAgICBlbHNlXHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkkgY2FuJ3QgZW5jb2RlIHRoaXMganNvbiFcIlxyXG5cclxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XHJcbiAgICBAb25fYm91bmRfdG9feT8oKVxyXG4gICAgZGVsZXRlIEB3aGVuX2JvdW5kX3RvX3lcclxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxyXG4iLCJcclxud2luZG93Py51bnByb2Nlc3NlZF9jb3VudGVyID0gMCAjIGRlbCB0aGlzXHJcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cclxud2luZG93Py51bnByb2Nlc3NlZF90eXBlcyA9IFtdXHJcblxyXG4jXHJcbiMgQG5vZG9jXHJcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cclxuI1xyXG5jbGFzcyBFbmdpbmVcclxuXHJcbiAgI1xyXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxyXG4gICMgQHBhcmFtIHtPYmplY3R9IHR5cGVzIGxpc3Qgb2YgYXZhaWxhYmxlIHR5cGVzXHJcbiAgI1xyXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAdHlwZXMpLT5cclxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxyXG5cclxuICAjXHJcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cclxuICAjXHJcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XHJcbiAgICB0eXBlID0gQHR5cGVzW2pzb24udHlwZV1cclxuICAgIGlmIHR5cGU/LnBhcnNlP1xyXG4gICAgICB0eXBlLnBhcnNlIGpzb25cclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxyXG5cclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLl9lbmNvZGUoKS5cclxuICAjIEBub3RlIFlvdSBtdXN0IG5vdCB1c2UgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYWxyZWFkeSBoYXZlIG9wcyBpbiB5b3VyIEhCIVxyXG4gICMjI1xyXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cclxuICAgIG9wcyA9IFtdXHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxyXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG4gICMjI1xyXG5cclxuICAjXHJcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXHJcbiAgI1xyXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xyXG4gICAgICAgIEBhcHBseU9wIG9cclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXHJcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wXHJcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxyXG4gICAgQGFwcGx5T3Agb3BzX2pzb25cclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxyXG4gICMgVE9ETzogbWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50ISFcclxuICAjIC0gb3BlcmF0aW9ucyBtYXkgb25seSBleGVjdXRlZCBpbiBvcmRlciBieSBjcmVhdG9yLCBvcmRlciB0aGVtIGluIG9iamVjdCBvZiBhcnJheXMgKGtleSBieSBjcmVhdG9yKVxyXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXHJcbiAgYXBwbHlPcDogKG9wX2pzb25fYXJyYXksIGZyb21IQiA9IGZhbHNlKS0+XHJcbiAgICBpZiBvcF9qc29uX2FycmF5LmNvbnN0cnVjdG9yIGlzbnQgQXJyYXlcclxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxyXG4gICAgZm9yIG9wX2pzb24gaW4gb3BfanNvbl9hcnJheVxyXG4gICAgICBpZiBmcm9tSEJcclxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcclxuICAgICAgIyAkcGFyc2VfYW5kX2V4ZWN1dGUgd2lsbCByZXR1cm4gZmFsc2UgaWYgJG9fanNvbiB3YXMgcGFyc2VkIGFuZCBleGVjdXRlZCwgb3RoZXJ3aXNlIHRoZSBwYXJzZWQgb3BlcmFkaW9uXHJcbiAgICAgIG8gPSBAcGFyc2VPcGVyYXRpb24gb3BfanNvblxyXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXHJcbiAgICAgIGlmIG9wX2pzb24uZnJvbUhCP1xyXG4gICAgICAgIG8uZnJvbUhCID0gb3BfanNvbi5mcm9tSEJcclxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cclxuICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvKT9cclxuICAgICAgICAjIG5vcFxyXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxyXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICAgICAgd2luZG93Py51bnByb2Nlc3NlZF90eXBlcy5wdXNoIG8udHlwZSAjIFRPRE86IGRlbGV0ZSB0aGlzXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24ob3ApP1xyXG4gICAgICAgICAgIyBub3BcclxuICAgICAgICBlbHNlIGlmIChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24ob3ApIGFuZCAobm90IG9wLmZyb21IQj8pKSBvciAobm90IG9wLmV4ZWN1dGUoKSlcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXHJcbiAgICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzIG9sZF9sZW5ndGhcclxuICAgICAgICBicmVha1xyXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXHJcbiAgICAgIEBIQi5pbnZva2VTeW5jKClcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEVuZ2luZVxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG4iLCJcclxuI1xyXG4jIEBub2RvY1xyXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXHJcbiNcclxuIyBAbm90ZSBUaGUgSGlzdG9yeUJ1ZmZlciBpcyBjb21tb25seSBhYmJyZXZpYXRlZCB0byBIQi5cclxuI1xyXG5jbGFzcyBIaXN0b3J5QnVmZmVyXHJcblxyXG4gICNcclxuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXHJcbiAgIyBAcGFyYW0ge09iamVjdH0gdXNlcl9pZCBDcmVhdG9yIG9mIHRoZSBIQi5cclxuICAjXHJcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxyXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyID0ge31cclxuICAgIEBidWZmZXIgPSB7fVxyXG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxyXG4gICAgQGdhcmJhZ2UgPSBbXSAjIFdpbGwgYmUgY2xlYW5lZCBvbiBuZXh0IGNhbGwgb2YgZ2FyYmFnZUNvbGxlY3RvclxyXG4gICAgQHRyYXNoID0gW10gIyBJcyBkZWxldGVkLiBXYWl0IHVudGlsIGl0IGlzIG5vdCB1c2VkIGFueW1vcmUuXHJcbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxyXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IDMwMDAwXHJcbiAgICBAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyID0gMFxyXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XHJcblxyXG4gIHJlc2V0VXNlcklkOiAoaWQpLT5cclxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXHJcbiAgICBpZiBvd24/XHJcbiAgICAgIGZvciBvX25hbWUsbyBvZiBvd25cclxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yP1xyXG4gICAgICAgICAgby51aWQuY3JlYXRvciA9IGlkXHJcbiAgICAgICAgaWYgby51aWQuYWx0P1xyXG4gICAgICAgICAgby51aWQuYWx0LmNyZWF0b3IgPSBpZFxyXG4gICAgICBpZiBAYnVmZmVyW2lkXT9cclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgYXJlIHJlLWFzc2lnbmluZyBhbiBvbGQgdXNlciBpZCAtIHRoaXMgaXMgbm90ICh5ZXQpIHBvc3NpYmxlIVwiXHJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXHJcbiAgICAgIGRlbGV0ZSBAYnVmZmVyW0B1c2VyX2lkXVxyXG4gICAgaWYgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXT9cclxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW2lkXSA9IEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cclxuICAgICAgZGVsZXRlIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cclxuICAgIEB1c2VyX2lkID0gaWRcclxuXHJcbiAgZW1wdHlHYXJiYWdlOiAoKT0+XHJcbiAgICBmb3IgbyBpbiBAZ2FyYmFnZVxyXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcclxuICAgICAgby5jbGVhbnVwPygpXHJcblxyXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcclxuICAgIEB0cmFzaCA9IFtdXHJcbiAgICBpZiBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0IGlzbnQgLTFcclxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XHJcbiAgICB1bmRlZmluZWRcclxuXHJcbiAgI1xyXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxyXG4gICNcclxuICBnZXRVc2VySWQ6ICgpLT5cclxuICAgIEB1c2VyX2lkXHJcblxyXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxyXG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxyXG4gICAgICBmb3IgbyBpbiBhcmd1bWVudHNcclxuICAgICAgICBpZiBvP1xyXG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXHJcblxyXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxyXG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXHJcbiAgICBAc2V0TWFudWFsR2FyYmFnZUNvbGxlY3QoKVxyXG4gICAgQGdhcmJhZ2UgPSBbXVxyXG4gICAgQHRyYXNoID0gW11cclxuXHJcbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cclxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxyXG4gICAgY2xlYXJUaW1lb3V0IEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZFxyXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXHJcblxyXG4gIHNldEdhcmJhZ2VDb2xsZWN0VGltZW91dDogKEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQpLT5cclxuXHJcbiAgI1xyXG4gICMgSSBwcm9wb3NlIHRvIHVzZSBpdCBpbiB5b3VyIEZyYW1ld29yaywgdG8gY3JlYXRlIHNvbWV0aGluZyBsaWtlIGEgcm9vdCBlbGVtZW50LlxyXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXHJcbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXHJcbiAgI1xyXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxyXG4gICAge1xyXG4gICAgICBjcmVhdG9yIDogJ18nXHJcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXHJcbiAgICB9XHJcblxyXG4gICNcclxuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxyXG4gICNcclxuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxyXG4gICAgaWYgbm90IHVzZXJfaWQ/XHJcbiAgICAgIHJlcyA9IHt9XHJcbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cclxuICAgICAgcmVzXHJcbiAgICBlbHNlXHJcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxyXG5cclxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxyXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcclxuICAgIG8udWlkLm9wX251bWJlciA8PSBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cclxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxyXG5cclxuICAjXHJcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxyXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxyXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cclxuICAgIGpzb24gPSBbXVxyXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxyXG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcclxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXHJcblxyXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXHJcbiAgICAgIGlmIHVfbmFtZSBpcyBcIl9cIlxyXG4gICAgICAgIGNvbnRpbnVlXHJcbiAgICAgIGZvciBvX251bWJlcixvIG9mIHVzZXJcclxuICAgICAgICBpZiAobm90IG8udWlkLm5vT3BlcmF0aW9uPykgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcclxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxyXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcclxuICAgICAgICAgIGlmIG8ubmV4dF9jbD8gIyBhcHBsaWVzIGZvciBhbGwgb3BzIGJ1dCB0aGUgbW9zdCByaWdodCBkZWxpbWl0ZXIhXHJcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxyXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcclxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC51aWQuY3JlYXRvciwgb19uZXh0LnVpZC5vcF9udW1iZXIpXHJcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcclxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcclxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsPyAjIG1vc3QgcmlnaHQgZGVsaW1pdGVyIG9ubHkhXHJcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxyXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcclxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fcHJldi51aWQuY3JlYXRvciwgb19wcmV2LnVpZC5vcF9udW1iZXIpXHJcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcclxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcclxuICAgICAgICAgIGpzb24ucHVzaCBvX2pzb25cclxuXHJcbiAgICBqc29uXHJcblxyXG4gICNcclxuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxyXG4gICMgQWNjb3JkaW5nbHkgeW91IHdpbGwgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBudW1iZXIgdGhhdCBpcyBleHBlY3RlZCBmcm9tIHRoYXQgdXNlci5cclxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxyXG4gICNcclxuICBnZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcjogKHVzZXJfaWQpLT5cclxuICAgIGlmIG5vdCB1c2VyX2lkP1xyXG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcclxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0/XHJcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcclxuICAgIHVpZCA9XHJcbiAgICAgICdjcmVhdG9yJyA6IHVzZXJfaWRcclxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cclxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXHJcbiAgICB1aWRcclxuXHJcbiAgI1xyXG4gICMgUmV0cmlldmUgYW4gb3BlcmF0aW9uIGZyb20gYSB1bmlxdWUgaWQuXHJcbiAgI1xyXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxyXG4gICMgb24gdGhlIG9wZXJhdGlvbnMgcmV0cmlldmVTdWIgbWV0aG9kICh3aGljaCBtdXN0ISBiZSBkZWZpbmVkKVxyXG4gICNcclxuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cclxuICAgIGlmIHVpZC51aWQ/XHJcbiAgICAgIHVpZCA9IHVpZC51aWRcclxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cclxuICAgIGlmIHVpZC5zdWI/IGFuZCBvP1xyXG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcclxuICAgIGVsc2VcclxuICAgICAgb1xyXG5cclxuICAjXHJcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XHJcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxyXG4gICNcclxuICBhZGRPcGVyYXRpb246IChvKS0+XHJcbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cclxuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XHJcbiAgICBpZiBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0/XHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxyXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIG9wZXJhdGlvbiB3YXMgbm90IGV4cGVjdGVkIVwiXHJcbiAgICBAYWRkVG9Db3VudGVyKG8pXHJcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXHJcbiAgICBvXHJcblxyXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cclxuICAgIGRlbGV0ZSBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1tvLnVpZC5vcF9udW1iZXJdXHJcblxyXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcclxuICAjIGhhbmRsZXIgd2lsIGJlIGNhbGxlZCwgd2hpY2ggc2hvdWxkIHNvbWVob3cgaW52b2tlIHRoZSBzeW5jIHdpdGggYW5vdGhlciBjb2xsYWJvcmF0b3IuXHJcbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcclxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cclxuICAgIEBpbnZva2VTeW5jID0gZlxyXG5cclxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XHJcbiAgaW52b2tlU3luYzogKCktPlxyXG5cclxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcclxuICAjIHlvdSByZW5ldyB5b3VyIG93biBzdGF0ZV92ZWN0b3IgdG8gdGhlIHN0YXRlX3ZlY3RvciBvZiB0aGUgb3RoZXIgdXNlclxyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cclxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxyXG4gICAgICBpZiAoKG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0/KSBvciAoQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdIDwgc3RhdGVfdmVjdG9yW3VzZXJdKSkgYW5kIHN0YXRlX3ZlY3Rvclt1c2VyXT9cclxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cclxuXHJcbiAgI1xyXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cclxuICAjXHJcbiAgYWRkVG9Db3VudGVyOiAobyktPlxyXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcclxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcclxuICAgICAgIyBUT0RPOiBjaGVjayBpZiBvcGVyYXRpb25zIGFyZSBzZW5kIGluIG9yZGVyXHJcbiAgICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cclxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xyXG4gICAgICB3aGlsZSBAYnVmZmVyW28udWlkLmNyZWF0b3JdW0BvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXV0/XHJcbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcclxuICAgICAgdW5kZWZpbmVkXHJcblxyXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSBpc250IChvLnVpZC5vcF9udW1iZXIgKyAxKVxyXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSAtIChvLnVpZC5vcF9udW1iZXIgKyAxKSlcclxuICAgICAgI2NvbnNvbGUubG9nIG9cclxuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXHJcbiIsIlxyXG5jbGFzcyBZT2JqZWN0XHJcblxyXG4gIGNvbnN0cnVjdG9yOiAoQF9vYmplY3QgPSB7fSktPlxyXG4gICAgaWYgQF9vYmplY3QuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgIGZvciBuYW1lLCB2YWwgb2YgQF9vYmplY3RcclxuICAgICAgICBpZiB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgICAgICBAX29iamVjdFtuYW1lXSA9IG5ldyBZT2JqZWN0KHZhbClcclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWS5PYmplY3QgYWNjZXB0cyBKc29uIE9iamVjdHMgb25seVwiXHJcblxyXG4gIF9uYW1lOiBcIk9iamVjdFwiXHJcblxyXG4gIF9nZXRNb2RlbDogKHR5cGVzLCBvcHMpLT5cclxuICAgIGlmIG5vdCBAX21vZGVsP1xyXG4gICAgICBAX21vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKEApLmV4ZWN1dGUoKVxyXG4gICAgICBmb3IgbixvIG9mIEBfb2JqZWN0XHJcbiAgICAgICAgQF9tb2RlbC52YWwgbiwgb1xyXG4gICAgZGVsZXRlIEBfb2JqZWN0XHJcbiAgICBAX21vZGVsXHJcblxyXG4gIF9zZXRNb2RlbDogKEBfbW9kZWwpLT5cclxuICAgIGRlbGV0ZSBAX29iamVjdFxyXG5cclxuICBvYnNlcnZlOiAoZiktPlxyXG4gICAgQF9tb2RlbC5vYnNlcnZlIGZcclxuICAgIEBcclxuXHJcbiAgdW5vYnNlcnZlOiAoZiktPlxyXG4gICAgQF9tb2RlbC51bm9ic2VydmUgZlxyXG4gICAgQFxyXG5cclxuICAjXHJcbiAgIyBAb3ZlcmxvYWQgdmFsKClcclxuICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cclxuICAjICAgQHJldHVybiBbSnNvbl1cclxuICAjXHJcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXHJcbiAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxyXG4gICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXHJcbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlfHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXHJcbiAgI1xyXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxyXG4gICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXHJcbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cclxuICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cclxuICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXHJcbiAgI1xyXG4gIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cclxuICAgIGlmIEBfbW9kZWw/XHJcbiAgICAgIEBfbW9kZWwudmFsLmFwcGx5IEBfbW9kZWwsIGFyZ3VtZW50c1xyXG4gICAgZWxzZVxyXG4gICAgICBpZiBjb250ZW50P1xyXG4gICAgICAgIEBfb2JqZWN0W25hbWVdID0gY29udGVudFxyXG4gICAgICBlbHNlIGlmIG5hbWU/XHJcbiAgICAgICAgQF9vYmplY3RbbmFtZV1cclxuICAgICAgZWxzZVxyXG4gICAgICAgIHJlcyA9IHt9XHJcbiAgICAgICAgZm9yIG4sdiBvZiBAX29iamVjdFxyXG4gICAgICAgICAgcmVzW25dID0gdlxyXG4gICAgICAgIHJlc1xyXG5cclxuICBkZWxldGU6IChuYW1lKS0+XHJcbiAgICBAX21vZGVsLmRlbGV0ZShuYW1lKVxyXG4gICAgQFxyXG5cclxuaWYgd2luZG93P1xyXG4gIGlmIHdpbmRvdy5ZP1xyXG4gICAgd2luZG93LlkuT2JqZWN0ID0gWU9iamVjdFxyXG4gIGVsc2VcclxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGZpcnN0IGltcG9ydCBZIVwiXHJcblxyXG5pZiBtb2R1bGU/XHJcbiAgbW9kdWxlLmV4cG9ydHMgPSBZT2JqZWN0XHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoKS0+XHJcbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxyXG4gIG9wcyA9IHt9XHJcbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cclxuXHJcbiAgI1xyXG4gICMgQHByaXZhdGVcclxuICAjIEBhYnN0cmFjdFxyXG4gICMgQG5vZG9jXHJcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wcy5cclxuICAjXHJcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcclxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxyXG4gICMgKiBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxyXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXHJcbiAgI1xyXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuIFdlIGV4dGVuZCB0aGUgcGFyc2VyIG9iamVjdCBpbiBvcmRlciB0byBwYXJzZSBlbmNvZGVkIG9wZXJhdGlvbnMuXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5PcGVyYXRpb25cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cclxuICAgICMgSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZCBiZWZvcmUgYXQgdGhlIGVuZCBvZiB0aGUgZXhlY3V0aW9uIHNlcXVlbmNlXHJcbiAgICAjXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQpLT5cclxuICAgICAgaWYgY3VzdG9tX3R5cGU/XHJcbiAgICAgICAgQGN1c3RvbV90eXBlID0gY3VzdG9tX3R5cGVcclxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxyXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxyXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW10gIyBUT0RPOiByZW5hbWUgdG8gb2JzZXJ2ZXJzIG9yIHN0aCBsaWtlIHRoYXRcclxuICAgICAgaWYgdWlkP1xyXG4gICAgICAgIEB1aWQgPSB1aWRcclxuXHJcbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXHJcblxyXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxyXG5cclxuICAgICNcclxuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXHJcbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cclxuICAgICNcclxuICAgIG9ic2VydmU6IChmKS0+XHJcbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXHJcblxyXG4gICAgI1xyXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcclxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxyXG4gICAgI1xyXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxyXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZVxyXG4gICAgdW5vYnNlcnZlOiAoZiktPlxyXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cclxuICAgICAgICBmIGlzbnQgZ1xyXG5cclxuICAgICNcclxuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXHJcbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxyXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXHJcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxyXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XHJcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxyXG5cclxuICAgIGRlbGV0ZTogKCktPlxyXG4gICAgICAobmV3IG9wcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcclxuICAgICAgbnVsbFxyXG5cclxuICAgICNcclxuICAgICMgRmlyZSBhbiBldmVudC5cclxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXHJcbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XHJcbiAgICBjYWxsRXZlbnQ6ICgpLT5cclxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xyXG4gICAgICAgIGNhbGxvbiA9IEBnZXRDdXN0b21UeXBlKClcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGNhbGxvbiA9IEBcclxuICAgICAgQGZvcndhcmRFdmVudCBjYWxsb24sIGFyZ3VtZW50cy4uLlxyXG5cclxuICAgICNcclxuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxyXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cclxuICAgIGZvcndhcmRFdmVudDogKG9wLCBhcmdzLi4uKS0+XHJcbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcclxuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cclxuXHJcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cclxuICAgICAgQGlzX2RlbGV0ZWRcclxuXHJcbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxyXG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXHJcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcclxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcclxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxyXG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxyXG4gICAgICAgICAgQEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXHJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxyXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcclxuXHJcbiAgICAjXHJcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxyXG4gICAgI1xyXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxyXG5cclxuICAgICNcclxuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRQYXJlbnQ6ICgpLT5cclxuICAgICAgQHBhcmVudFxyXG5cclxuICAgICNcclxuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRVaWQ6ICgpLT5cclxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XHJcbiAgICAgICAgQHVpZFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXHJcbiAgICAgICAgICBtYXBfdWlkID0gQHVpZC5hbHQuY2xvbmVVaWQoKVxyXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxyXG4gICAgICAgICAgbWFwX3VpZFxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGNsb25lVWlkOiAoKS0+XHJcbiAgICAgIHVpZCA9IHt9XHJcbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXHJcbiAgICAgICAgdWlkW25dID0gdlxyXG4gICAgICB1aWRcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXHJcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxyXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxyXG4gICAgI1xyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBAaXNfZXhlY3V0ZWQgPSB0cnVlXHJcbiAgICAgIGlmIG5vdCBAdWlkP1xyXG4gICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxyXG4gICAgICAgICMgVGhlcmUgaXMgb25seSBvbmUgb3RoZXIgcGxhY2UsIHdoZXJlIHRoaXMgY2FuIGJlIGRvbmUgLSBiZWZvcmUgYW4gSW5zZXJ0aW9uXHJcbiAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxyXG4gICAgICAgIEB1aWQgPSBASEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxyXG4gICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cclxuICAgICAgICBASEIuYWRkT3BlcmF0aW9uIEBcclxuICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcclxuICAgICAgICAgIGwgQF9lbmNvZGUoKVxyXG4gICAgICBAXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxyXG4gICAgI1xyXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxyXG4gICAgICBqc29uLnR5cGUgPSBAdHlwZVxyXG4gICAgICBqc29uLnVpZCA9IEBnZXRVaWQoKVxyXG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XHJcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xyXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIGpzb24uY3VzdG9tX3R5cGUgPSBAY3VzdG9tX3R5cGUuX25hbWVcclxuICAgICAganNvblxyXG5cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxyXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXHJcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxyXG4gICAgI1xyXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xyXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xyXG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cclxuICAgICNcclxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxyXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cclxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxyXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcclxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cclxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxyXG4gICAgI1xyXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wKS0+XHJcblxyXG4gICAgICAjXHJcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXHJcbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxyXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxyXG4gICAgICAjXHJcbiAgICAgIGlmIG5vdCBvcD9cclxuICAgICAgICAjIG5vcFxyXG4gICAgICBlbHNlIGlmIG9wLmV4ZWN1dGU/IG9yIG5vdCAob3Aub3BfbnVtYmVyPyBhbmQgb3AuY3JlYXRvcj8pXHJcbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWQsIG9yIG9wIGlzIHN0cmluZy4gQ3VycmVudGx5IFwiRGVsaW1pdGVyXCIgaXMgc2F2ZWQgYXMgc3RyaW5nXHJcbiAgICAgICAgIyAoaW4gY29tYmluYXRpb24gd2l0aCBAcGFyZW50IHlvdSBjYW4gcmV0cmlldmUgdGhlIGRlbGltaXRlci4uKVxyXG4gICAgICAgIEBbbmFtZV0gPSBvcFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxyXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cclxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cclxuICAgICMgQHNlZSBPcGVyYXRpb24uc2F2ZU9wZXJhdGlvblxyXG4gICAgI1xyXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cclxuICAgICNcclxuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XHJcbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cclxuICAgICAgc3VjY2VzcyA9IEBcclxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXHJcbiAgICAgICAgb3AgPSBASEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxyXG4gICAgICAgIGlmIG9wXHJcbiAgICAgICAgICBAW25hbWVdID0gb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxyXG4gICAgICAgICAgc3VjY2VzcyA9IGZhbHNlXHJcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXHJcbiAgICAgIGlmIG5vdCBzdWNjZXNzXHJcbiAgICAgICAgQHVuY2hlY2tlZCA9IHVuaW5zdGFudGlhdGVkXHJcbiAgICAgIHN1Y2Nlc3NcclxuXHJcbiAgICBnZXRDdXN0b21UeXBlOiAoKS0+XHJcbiAgICAgIGlmIG5vdCBAY3VzdG9tX3R5cGU/XHJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXHJcbiAgICAgICAgQFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xyXG4gICAgICAgICAgIyBoYXMgbm90IGJlZW4gaW5pdGlhbGl6ZWQgeWV0IChvbmx5IHRoZSBuYW1lIGlzIHNwZWNpZmllZClcclxuICAgICAgICAgIFR5cGUgPSBAY3VzdG9tX3R5cGVzXHJcbiAgICAgICAgICBmb3IgdCBpbiBAY3VzdG9tX3R5cGUuc3BsaXQoXCIuXCIpXHJcbiAgICAgICAgICAgIFR5cGUgPSBUeXBlW3RdXHJcbiAgICAgICAgICBAY3VzdG9tX3R5cGUgPSBuZXcgVHlwZSgpXHJcbiAgICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcclxuICAgICAgICBAY3VzdG9tX3R5cGVcclxuXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG5cclxuICAgIHR5cGU6IFwiRGVsZXRlXCJcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cclxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cclxuICAgICNcclxuICAgIF9lbmNvZGU6ICgpLT5cclxuICAgICAge1xyXG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxyXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcclxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXHJcbiAgICAgIH1cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cclxuICAgICNcclxuICAgIGV4ZWN1dGU6ICgpLT5cclxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICByZXMgPSBzdXBlclxyXG4gICAgICAgIGlmIHJlc1xyXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxyXG4gICAgICAgIHJlc1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgI1xyXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cclxuICAjXHJcbiAgb3BzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XHJcbiAgICB7XHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcclxuICAgIH0gPSBvXHJcbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxyXG5cclxuICAjXHJcbiAgIyBAbm9kb2NcclxuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cclxuICAjXHJcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxyXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXHJcbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XHJcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXHJcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xyXG4gICNcclxuICBjbGFzcyBvcHMuSW5zZXJ0IGV4dGVuZHMgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cclxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxyXG4gICAgICBpZiBjb250ZW50IGlzIHVuZGVmaW5lZFxyXG4gICAgICAgICMgbm9wXHJcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cclxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcclxuICAgICAgZWxzZVxyXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XHJcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcclxuICAgICAgaWYgb3JpZ2luP1xyXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cclxuICAgICAgZWxzZVxyXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXHJcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcclxuXHJcbiAgICB0eXBlOiBcIkluc2VydFwiXHJcblxyXG4gICAgdmFsOiAoKS0+XHJcbiAgICAgIGlmIEBjb250ZW50PyBhbmQgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZT9cclxuICAgICAgICBAY29udGVudC5nZXRDdXN0b21UeXBlKClcclxuICAgICAgZWxzZVxyXG4gICAgICAgIEBjb250ZW50XHJcblxyXG4gICAgZ2V0TmV4dDogKGk9MSktPlxyXG4gICAgICBuID0gQFxyXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5pc19kZWxldGVkIGFuZCBuLm5leHRfY2w/XHJcbiAgICAgICAgbiA9IG4ubmV4dF9jbFxyXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcclxuICAgICAgICAgIGktLVxyXG4gICAgICBuXHJcblxyXG4gICAgZ2V0UHJldjogKGk9MSktPlxyXG4gICAgICBuID0gQFxyXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5pc19kZWxldGVkIGFuZCBuLnByZXZfY2w/XHJcbiAgICAgICAgbiA9IG4ucHJldl9jbFxyXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcclxuICAgICAgICAgIGktLVxyXG4gICAgICBuXHJcblxyXG4gICAgI1xyXG4gICAgIyBzZXQgY29udGVudCB0byBudWxsIGFuZCBvdGhlciBzdHVmZlxyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgI1xyXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XHJcbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXHJcbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXHJcbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzX2RlbGV0ZWQgYW5kIG8/ICMgbz8gOiBpZiBub3Qgbz8sIHRoZW4gdGhlIGRlbGltaXRlciBkZWxldGVkIHRoaXMgSW5zZXJ0aW9uLiBGdXJ0aGVybW9yZSwgaXQgd291bGQgYmUgd3JvbmcgdG8gY2FsbCBpdC4gVE9ETzogbWFrZSB0aGlzIG1vcmUgZXhwcmVzc2l2ZSBhbmQgc2F2ZVxyXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxyXG4gICAgICAgIGNhbGxMYXRlciA9IHRydWVcclxuICAgICAgaWYgbz9cclxuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cclxuICAgICAgZ2FyYmFnZWNvbGxlY3QgPSBmYWxzZVxyXG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxyXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxyXG4gICAgICBzdXBlciBnYXJiYWdlY29sbGVjdFxyXG4gICAgICBpZiBjYWxsTGF0ZXJcclxuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyh0aGlzLCBvKVxyXG4gICAgICBpZiBAcHJldl9jbD8uaXNEZWxldGVkKClcclxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXHJcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxyXG5cclxuICAgIGNsZWFudXA6ICgpLT5cclxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcclxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXHJcbiAgICAgICAgZm9yIGQgaW4gQGRlbGV0ZWRfYnlcclxuICAgICAgICAgIGQuY2xlYW51cCgpXHJcblxyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwicmlnaHQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXHJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XHJcbiAgICAgICAgbyA9IEBuZXh0X2NsXHJcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxyXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxyXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXHJcbiAgICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxyXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxyXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxyXG5cclxuICAgICAgICAjIGRlbGV0ZSBjb250ZW50XHJcbiAgICAgICAgIyAtIHdlIG11c3Qgbm90IGRvIHRoaXMgaW4gYXBwbHlEZWxldGUsIGJlY2F1c2UgdGhpcyB3b3VsZCBsZWFkIHRvIGluY29uc2lzdGVuY2llc1xyXG4gICAgICAgICMgKGUuZy4gdGhlIGZvbGxvd2luZyBvcGVyYXRpb24gb3JkZXIgbXVzdCBiZSBpbnZlcnRpYmxlIDpcclxuICAgICAgICAjICAgSW5zZXJ0IHJlZmVycyB0byBjb250ZW50LCB0aGVuIHRoZSBjb250ZW50IGlzIGRlbGV0ZWQpXHJcbiAgICAgICAgIyBUaGVyZWZvcmUsIHdlIGhhdmUgdG8gZG8gdGhpcyBpbiB0aGUgY2xlYW51cFxyXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieS0tXHJcbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXHJcbiAgICAgICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcclxuICAgICAgICBkZWxldGUgQGNvbnRlbnRcclxuICAgICAgICBzdXBlclxyXG4gICAgICAjIGVsc2VcclxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cclxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxyXG4gICAgI1xyXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxyXG4gICAgICBkID0gMFxyXG4gICAgICBvID0gQHByZXZfY2xcclxuICAgICAgd2hpbGUgdHJ1ZVxyXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xyXG4gICAgICAgICAgYnJlYWtcclxuICAgICAgICBkKytcclxuICAgICAgICBvID0gby5wcmV2X2NsXHJcbiAgICAgIGRcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICByZXR1cm4gZmFsc2VcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXHJcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5ID89IDBcclxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnkrK1xyXG4gICAgICAgIGlmIEBwYXJlbnQ/XHJcbiAgICAgICAgICBpZiBub3QgQHByZXZfY2w/XHJcbiAgICAgICAgICAgIEBwcmV2X2NsID0gQHBhcmVudC5iZWdpbm5pbmdcclxuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xyXG4gICAgICAgICAgICBAb3JpZ2luID0gQHByZXZfY2xcclxuICAgICAgICAgIGVsc2UgaWYgQG9yaWdpbiBpcyBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xyXG4gICAgICAgICAgaWYgbm90IEBuZXh0X2NsP1xyXG4gICAgICAgICAgICBAbmV4dF9jbCA9IEBwYXJlbnQuZW5kXHJcbiAgICAgICAgaWYgQHByZXZfY2w/XHJcbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxyXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcclxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcclxuXHJcbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XHJcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxyXG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxyXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxyXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcclxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xyXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cclxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXHJcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxyXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXHJcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxyXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXHJcbiAgICAgICAgICB3aGlsZSB0cnVlXHJcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxyXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XHJcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxyXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcclxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXHJcbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICMgbm9wXHJcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcclxuICAgICAgICAgICAgICAgICMgY2FzZSAyXHJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXHJcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xyXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAjbm9wXHJcbiAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcclxuICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgaSsrXHJcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcclxuICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcclxuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxyXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcclxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXHJcblxyXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xyXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXHJcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHModGhpcylcclxuICAgICAgICBAXHJcblxyXG4gICAgI1xyXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cclxuICAgICNcclxuICAgIGdldFBvc2l0aW9uOiAoKS0+XHJcbiAgICAgIHBvc2l0aW9uID0gMFxyXG4gICAgICBwcmV2ID0gQHByZXZfY2xcclxuICAgICAgd2hpbGUgdHJ1ZVxyXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXHJcbiAgICAgICAgICBicmVha1xyXG4gICAgICAgIGlmIG5vdCBwcmV2LmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICBwb3NpdGlvbisrXHJcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxyXG4gICAgICBwb3NpdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxyXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxyXG4gICAgI1xyXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxyXG4gICAgICBqc29uLnByZXYgPSBAcHJldl9jbC5nZXRVaWQoKVxyXG4gICAgICBqc29uLm5leHQgPSBAbmV4dF9jbC5nZXRVaWQoKVxyXG5cclxuICAgICAgaWYgQG9yaWdpbi50eXBlIGlzIFwiRGVsaW1pdGVyXCJcclxuICAgICAgICBqc29uLm9yaWdpbiA9IFwiRGVsaW1pdGVyXCJcclxuICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcclxuICAgICAgICBqc29uLm9yaWdpbiA9IEBvcmlnaW4uZ2V0VWlkKClcclxuXHJcbiAgICAgICMgaWYgbm90IChqc29uLnByZXY/IGFuZCBqc29uLm5leHQ/KVxyXG4gICAgICBqc29uLnBhcmVudCA9IEBwYXJlbnQuZ2V0VWlkKClcclxuXHJcbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XHJcbiAgICAgICAganNvblsnY29udGVudCddID0gQGNvbnRlbnQuZ2V0VWlkKClcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEpTT04uc3RyaW5naWZ5IEBjb250ZW50XHJcbiAgICAgIHN1cGVyIGpzb25cclxuXHJcbiAgb3BzLkluc2VydC5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ3ByZXYnOiBwcmV2XHJcbiAgICAgICduZXh0JzogbmV4dFxyXG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxyXG4gICAgICAncGFyZW50JyA6IHBhcmVudFxyXG4gICAgfSA9IGpzb25cclxuICAgIGlmIHR5cGVvZiBjb250ZW50IGlzIFwic3RyaW5nXCJcclxuICAgICAgY29udGVudCA9IEpTT04ucGFyc2UoY29udGVudClcclxuICAgIG5ldyB0aGlzIG51bGwsIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXHJcbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxyXG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cclxuICAjXHJcbiAgY2xhc3Mgb3BzLkRlbGltaXRlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XHJcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcclxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcclxuICAgICAgc3VwZXIgbnVsbCwge25vT3BlcmF0aW9uOiB0cnVlfVxyXG5cclxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcclxuXHJcbiAgICBhcHBseURlbGV0ZTogKCktPlxyXG4gICAgICBzdXBlcigpXHJcbiAgICAgIG8gPSBAcHJldl9jbFxyXG4gICAgICB3aGlsZSBvP1xyXG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxyXG4gICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgdW5kZWZpbmVkXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgI1xyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xyXG4gICAgICAgIHN1cGVyXHJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxyXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXHJcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxyXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcclxuICAgICAgICAgIHN1cGVyXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgZmFsc2VcclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xyXG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxyXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXHJcbiAgICAgICAgc3VwZXJcclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cclxuICAgICAgICBzdXBlclxyXG4gICAgICAjZWxzZVxyXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjXHJcbiAgICBfZW5jb2RlOiAoKS0+XHJcbiAgICAgIHtcclxuICAgICAgICAndHlwZScgOiBAdHlwZVxyXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXHJcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXHJcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXHJcbiAgICAgIH1cclxuXHJcbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAndWlkJyA6IHVpZFxyXG4gICAgJ3ByZXYnIDogcHJldlxyXG4gICAgJ25leHQnIDogbmV4dFxyXG4gICAgfSA9IGpzb25cclxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcclxuXHJcbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxyXG4gIHtcclxuICAgICdvcGVyYXRpb25zJyA6IG9wc1xyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcclxuICB9XHJcbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XHJcbiAgYmFzaWNfb3BzID0gYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQoKVxyXG4gIG9wcyA9IGJhc2ljX29wcy5vcGVyYXRpb25zXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5NYXBNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxyXG4gICAgI1xyXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkKS0+XHJcbiAgICAgIEBfbWFwID0ge31cclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG5cclxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXHJcblxyXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cclxuICAgICAgZm9yIG5hbWUscCBvZiBAX21hcFxyXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgbWFwOiAoZiktPlxyXG4gICAgICBmb3Igbix2IG9mIEBfbWFwXHJcbiAgICAgICAgZihuLHYpXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgICNcclxuICAgICMgQHNlZSBKc29uT3BlcmF0aW9ucy52YWxcclxuICAgICNcclxuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cclxuICAgICAgaWYgYXJndW1lbnRzLmxlbmd0aCA+IDFcclxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XHJcbiAgICAgICAgICByZXAgPSBjb250ZW50Ll9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICByZXAgPSBjb250ZW50XHJcbiAgICAgICAgQHJldHJpZXZlU3ViKG5hbWUpLnJlcGxhY2UgcmVwXHJcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKVxyXG4gICAgICBlbHNlIGlmIG5hbWU/XHJcbiAgICAgICAgcHJvcCA9IEBfbWFwW25hbWVdXHJcbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxyXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxyXG4gICAgICAgICAgaWYgcmVzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgICByZXMuZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHJlc1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHVuZGVmaW5lZFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgcmVzdWx0ID0ge31cclxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXHJcbiAgICAgICAgICBpZiBub3Qgby5pc0NvbnRlbnREZWxldGVkKClcclxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gby52YWwoKVxyXG4gICAgICAgIHJlc3VsdFxyXG5cclxuICAgIGRlbGV0ZTogKG5hbWUpLT5cclxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxyXG4gICAgICBAXHJcblxyXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XHJcbiAgICAgIGlmIG5vdCBAX21hcFtwcm9wZXJ0eV9uYW1lXT9cclxuICAgICAgICBldmVudF9wcm9wZXJ0aWVzID1cclxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcclxuICAgICAgICBldmVudF90aGlzID0gQFxyXG4gICAgICAgIHJtX3VpZCA9XHJcbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxyXG4gICAgICAgICAgc3ViOiBwcm9wZXJ0eV9uYW1lXHJcbiAgICAgICAgICBhbHQ6IEBcclxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxyXG4gICAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdID0gcm1cclxuICAgICAgICBybS5zZXRQYXJlbnQgQCwgcHJvcGVydHlfbmFtZVxyXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxyXG4gICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXVxyXG5cclxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxyXG4gICAgfSA9IGpzb25cclxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQpXHJcblxyXG5cclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxyXG4gICNcclxuICBjbGFzcyBvcHMuTGlzdE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXHJcblxyXG4gICAgI1xyXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cclxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxyXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQpLT5cclxuICAgICAgQGJlZ2lubmluZyA9IG5ldyBvcHMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkXHJcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgb3BzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcclxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxyXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxyXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxyXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXHJcblxyXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXHJcblxyXG5cclxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XHJcbiAgICAgIG8gPSBAYmVnaW5uaW5nXHJcbiAgICAgIHdoaWxlIG8/XHJcbiAgICAgICAgby5hcHBseURlbGV0ZSgpXHJcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICBzdXBlcigpXHJcblxyXG5cclxuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XHJcbiAgICAgIHZhbCA9IEB2YWwoKVxyXG4gICAgICBmb3IgaSwgbyBpbiB2YWxcclxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLk9iamVjdFxyXG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxyXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIG9wcy5MaXN0TWFuYWdlclxyXG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxyXG4gICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgby52YWwoKVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIG9cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEBzZWUgT3BlcmF0aW9uLmV4ZWN1dGVcclxuICAgICNcclxuICAgIGV4ZWN1dGU6ICgpLT5cclxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXHJcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxyXG4gICAgICAgIHN1cGVyXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBmYWxzZVxyXG5cclxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxyXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxyXG4gICAgICBAZW5kLnByZXZfY2xcclxuXHJcbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXHJcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxyXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcclxuXHJcbiAgICAjIFRyYW5zZm9ybXMgdGhlIHRoZSBsaXN0IHRvIGFuIGFycmF5XHJcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxyXG4gICAgdG9BcnJheTogKCktPlxyXG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXHJcbiAgICAgIHJlc3VsdCA9IFtdXHJcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXHJcbiAgICAgICAgaWYgbm90IG8uaXNfZGVsZXRlZFxyXG4gICAgICAgICAgcmVzdWx0LnB1c2ggby52YWwoKVxyXG4gICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgcmVzdWx0XHJcblxyXG4gICAgbWFwOiAoZiktPlxyXG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXHJcbiAgICAgIHJlc3VsdCA9IFtdXHJcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXHJcbiAgICAgICAgaWYgbm90IG8uaXNfZGVsZXRlZFxyXG4gICAgICAgICAgcmVzdWx0LnB1c2ggZihvKVxyXG4gICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgcmVzdWx0XHJcblxyXG4gICAgZm9sZDogKGluaXQsIGYpLT5cclxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxyXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxyXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcclxuICAgICAgICAgIGluaXQgPSBmKGluaXQsIG8pXHJcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICBpbml0XHJcblxyXG4gICAgdmFsOiAocG9zKS0+XHJcbiAgICAgIGlmIHBvcz9cclxuICAgICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zKzEpXHJcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcclxuICAgICAgICAgIG8udmFsKClcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcclxuICAgICAgZWxzZVxyXG4gICAgICAgIEB0b0FycmF5KClcclxuXHJcbiAgICByZWY6IChwb3MpLT5cclxuICAgICAgaWYgcG9zP1xyXG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcclxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxyXG4gICAgICAgICAgb1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIG51bGxcclxuICAgICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBwb3NpdGlvbiBkb2VzIG5vdCBleGlzdFwiXHJcbiAgICAgIGVsc2VcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ5b3UgbXVzdCBzcGVjaWZ5IGEgcG9zaXRpb24gcGFyYW1ldGVyXCJcclxuXHJcbiAgICAjXHJcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxyXG4gICAgIyBlLmcuIFwiYWJjXCIgOiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxyXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcclxuICAgICNcclxuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxyXG4gICAgICBvID0gQGJlZ2lubmluZ1xyXG4gICAgICB3aGlsZSB0cnVlXHJcbiAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXHJcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cclxuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcclxuICAgICAgICAgICMgZm9yIHRoZSBjdXJyZW50IGFycmF5LiBUaGVyZWZvcmUgd2UgcmVhY2ggYSBEZWxpbWl0ZXIuXHJcbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cclxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgICAgIHdoaWxlIG8uaXNEZWxldGVkKCkgYW5kIG8ucHJldl9jbD9cclxuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxyXG4gICAgICAgICAgYnJlYWtcclxuICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxyXG4gICAgICAgICAgYnJlYWtcclxuXHJcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXHJcbiAgICAgIG9cclxuXHJcbiAgICBwdXNoOiAoY29udGVudCktPlxyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgQGVuZC5wcmV2X2NsLCBbY29udGVudF1cclxuXHJcbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnRzKS0+XHJcbiAgICAgIHJpZ2h0ID0gbGVmdC5uZXh0X2NsXHJcbiAgICAgIHdoaWxlIHJpZ2h0LmlzRGVsZXRlZCgpXHJcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cclxuICAgICAgbGVmdCA9IHJpZ2h0LnByZXZfY2xcclxuXHJcbiAgICAgICMgVE9ETzogYWx3YXlzIGV4cGVjdCBhbiBhcnJheSBhcyBjb250ZW50LiBUaGVuIHlvdSBjYW4gY29tYmluZSB0aGlzIHdpdGggdGhlIG90aGVyIG9wdGlvbiAoZWxzZSlcclxuICAgICAgaWYgY29udGVudHMgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXHJcbiAgICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBmb3IgYyBpbiBjb250ZW50c1xyXG4gICAgICAgICAgaWYgYz8gYW5kIGMuX25hbWU/IGFuZCBjLl9nZXRNb2RlbD9cclxuICAgICAgICAgICAgYyA9IGMuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxyXG4gICAgICAgICAgdG1wID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXHJcbiAgICAgICAgICBsZWZ0ID0gdG1wXHJcbiAgICAgIEBcclxuXHJcbiAgICAjXHJcbiAgICAjIEluc2VydHMgYW4gYXJyYXkgb2YgY29udGVudCBpbnRvIHRoaXMgbGlzdC5cclxuICAgICMgQE5vdGU6IFRoaXMgZXhwZWN0cyBhbiBhcnJheSBhcyBjb250ZW50IVxyXG4gICAgI1xyXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXHJcbiAgICAjXHJcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudHMpLT5cclxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cclxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxyXG4gICAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50c1xyXG5cclxuICAgICNcclxuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXHJcbiAgICAjXHJcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdFxyXG4gICAgI1xyXG4gICAgZGVsZXRlOiAocG9zaXRpb24sIGxlbmd0aCA9IDEpLT5cclxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvc2l0aW9uKzEpICMgcG9zaXRpb24gMCBpbiB0aGlzIGNhc2UgaXMgdGhlIGRlbGV0aW9uIG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXJcclxuXHJcbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxyXG4gICAgICBmb3IgaSBpbiBbMC4uLmxlbmd0aF1cclxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxyXG4gICAgICAgICAgYnJlYWtcclxuICAgICAgICBkID0gKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXHJcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICAgIHdoaWxlIChub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcclxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgICBkZWxldGVfb3BzLnB1c2ggZC5fZW5jb2RlKClcclxuICAgICAgQFxyXG5cclxuXHJcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxyXG4gICAgICBnZXRDb250ZW50VHlwZSA9IChjb250ZW50KS0+XHJcbiAgICAgICAgaWYgY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cclxuICAgICAgICAgIGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgY29udGVudFxyXG4gICAgICBAY2FsbEV2ZW50IFtcclxuICAgICAgICB0eXBlOiBcImluc2VydFwiXHJcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcclxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKClcclxuICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIG9wLmNvbnRlbnRcclxuICAgICAgXVxyXG5cclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cclxuICAgICAgQGNhbGxFdmVudCBbXHJcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxyXG4gICAgICAgIHBvc2l0aW9uOiBvcC5nZXRQb3NpdGlvbigpXHJcbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpICMgVE9ETzogWW91IGNhbiBjb21iaW5lIGdldFBvc2l0aW9uICsgZ2V0UGFyZW50IGluIGEgbW9yZSBlZmZpY2llbnQgbWFubmVyISAob25seSBsZWZ0IERlbGltaXRlciB3aWxsIGhvbGQgQHBhcmVudClcclxuICAgICAgICBsZW5ndGg6IDFcclxuICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxyXG4gICAgICAgIG9sZFZhbHVlOiBvcC52YWwoKVxyXG4gICAgICBdXHJcblxyXG4gIG9wcy5MaXN0TWFuYWdlci5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdjdXN0b21fdHlwZSc6IGN1c3RvbV90eXBlXHJcbiAgICB9ID0ganNvblxyXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZClcclxuXHJcblxyXG5cclxuXHJcblxyXG4gIGNsYXNzIG9wcy5Db21wb3NpdGlvbiBleHRlbmRzIG9wcy5MaXN0TWFuYWdlclxyXG5cclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbXBvc2l0aW9uX3ZhbHVlLCB1aWQsIHRtcF9jb21wb3NpdGlvbl9yZWYpLT5cclxuICAgICAgIyB3ZSBjYW4ndCB1c2UgQHNldmVPcGVyYXRpb24gJ2NvbXBvc2l0aW9uX3JlZicsIHRtcF9jb21wb3NpdGlvbl9yZWYgaGVyZSxcclxuICAgICAgIyBiZWNhdXNlIHRoZW4gdGhlcmUgaXMgYSBcImxvb3BcIiAoaW5zZXJ0aW9uIHJlZmVycyB0byBwYXJhbnQsIHJlZmVycyB0byBpbnNlcnRpb24uLilcclxuICAgICAgIyBUaGlzIGlzIHdoeSB3ZSBoYXZlIHRvIGNoZWNrIGluIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMgdW50aWwgd2UgZmluZCBpdFxyXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXHJcbiAgICAgIGlmIHRtcF9jb21wb3NpdGlvbl9yZWY/XHJcbiAgICAgICAgQHRtcF9jb21wb3NpdGlvbl9yZWYgPSB0bXBfY29tcG9zaXRpb25fcmVmXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBAY29tcG9zaXRpb25fcmVmID0gQGVuZC5wcmV2X2NsXHJcbiAgICAgICNAZ2V0Q3VzdG9tVHlwZSgpLl9zZXRDb21wb3NpdGlvblZhbHVlIGNvbXBvc2l0aW9uX3ZhbHVlXHJcblxyXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXHJcblxyXG4gICAgI1xyXG4gICAgIyBUaGlzIGlzIGNhbGxlZCwgd2hlbiB0aGUgSW5zZXJ0LW9wZXJhdGlvbiB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxyXG4gICAgI1xyXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cclxuICAgICAgaWYgQHRtcF9jb21wb3NpdGlvbl9yZWY/XHJcbiAgICAgICAgaWYgb3AudWlkLmNyZWF0b3IgaXMgQHRtcF9jb21wb3NpdGlvbl9yZWYuY3JlYXRvciBhbmQgb3AudWlkLm9wX251bWJlciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5vcF9udW1iZXJcclxuICAgICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBvcFxyXG4gICAgICAgICAgZGVsZXRlIEB0bXBfY29tcG9zaXRpb25fcmVmXHJcbiAgICAgICAgICBvID0gb3AubmV4dF9jbFxyXG4gICAgICAgICAgd2hpbGUgby5uZXh0X2NsP1xyXG4gICAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxyXG4gICAgICAgICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMgb1xyXG4gICAgICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgICAgcmV0dXJuXHJcblxyXG4gICAgICBpZiBAY29tcG9zaXRpb25fcmVmLm5leHRfY2wgaXMgb3BcclxuICAgICAgICBvcC51bmRvX2RlbHRhID0gQGdldEN1c3RvbVR5cGUoKS5fYXBwbHkgb3AuY29udGVudFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgbyA9IEBlbmQucHJldl9jbFxyXG4gICAgICAgIHdoaWxlIG8gaXNudCBvcFxyXG4gICAgICAgICAgQGdldEN1c3RvbVR5cGUoKS5fdW5hcHBseSBvLnVuZG9fZGVsdGFcclxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgICB3aGlsZSBvIGlzbnQgQGVuZFxyXG4gICAgICAgICAgby51bmRvX2RlbHRhID0gQGdldEN1c3RvbVR5cGUoKS5fYXBwbHkgby5jb250ZW50XHJcbiAgICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBAZW5kLnByZXZfY2xcclxuXHJcbiAgICAgIEBjYWxsRXZlbnQgW1xyXG4gICAgICAgIHR5cGU6IFwidXBkYXRlXCJcclxuICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgbmV3VmFsdWU6IEB2YWwoKVxyXG4gICAgICBdXHJcblxyXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAob3AsIGRlbF9vcCktPlxyXG4gICAgICByZXR1cm5cclxuXHJcbiAgICAjXHJcbiAgICAjIENyZWF0ZSBhIG5ldyBEZWx0YVxyXG4gICAgIyAtIGluc2VydHMgbmV3IENvbnRlbnQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxyXG4gICAgIyAtIHVwZGF0ZXMgdGhlIGNvbXBvc2l0aW9uX3ZhbHVlXHJcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fcmVmXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSBkZWx0YSBUaGUgZGVsdGEgdGhhdCBpcyBhcHBsaWVkIHRvIHRoZSBjb21wb3NpdGlvbl92YWx1ZVxyXG4gICAgI1xyXG4gICAgYXBwbHlEZWx0YTogKGRlbHRhKS0+XHJcbiAgICAgIChuZXcgb3BzLkluc2VydCBudWxsLCBkZWx0YSwgQCwgbnVsbCwgQGVuZC5wcmV2X2NsLCBAZW5kKS5leGVjdXRlKClcclxuICAgICAgdW5kZWZpbmVkXHJcblxyXG4gICAgI1xyXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxyXG4gICAgI1xyXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxyXG4gICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlID0gSlNPTi5zdHJpbmdpZnkgQGdldEN1c3RvbVR5cGUoKS5fZ2V0Q29tcG9zaXRpb25WYWx1ZSgpXHJcbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWY/XHJcbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3JlZiA9IEB0bXBfY29tcG9zaXRpb25fcmVmXHJcbiAgICAgIHN1cGVyIGpzb25cclxuXHJcbiAgb3BzLkNvbXBvc2l0aW9uLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcclxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXHJcbiAgICAgICdjb21wb3NpdGlvbl9yZWYnIDogY29tcG9zaXRpb25fcmVmXHJcbiAgICB9ID0ganNvblxyXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIEpTT04ucGFyc2UoY29tcG9zaXRpb25fdmFsdWUpLCB1aWQsIGNvbXBvc2l0aW9uX3JlZilcclxuXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxyXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxyXG4gICNcclxuICAjIFRoZSBUZXh0VHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXHJcbiAgIyBAc2VlIFRleHRUeXBlXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5SZXBsYWNlTWFuYWdlciBleHRlbmRzIG9wcy5MaXN0TWFuYWdlclxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfcHJvcGVydGllcyBEZWNvcmF0ZXMgdGhlIGV2ZW50IHRoYXQgaXMgdGhyb3duIGJ5IHRoZSBSTVxyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfdGhpcyBUaGUgb2JqZWN0IG9uIHdoaWNoIHRoZSBldmVudCBzaGFsbCBiZSBleGVjdXRlZFxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cclxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxyXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgQGV2ZW50X3Byb3BlcnRpZXMsIEBldmVudF90aGlzLCB1aWQpLT5cclxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cclxuICAgICAgICBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10gPSBAZXZlbnRfdGhpcy5nZXRDdXN0b21UeXBlKClcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG5cclxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxyXG5cclxuICAgICNcclxuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXHJcbiAgICAjIFJlcGxhY2VhYmxlcyBhbHNvIG5vdCB0aHJvdyB0aGUgc2FtZSBldmVudHMuXHJcbiAgICAjIFNvLCBSZXBsYWNlTWFuYWdlciBhbmQgTGlzdE1hbmFnZXIgYm90aCBpbXBsZW1lbnRcclxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXHJcbiAgICAjXHJcbiAgICAjXHJcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cclxuICAgICAgaWYgbm90IEBpc0RlbGV0ZWQoKVxyXG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcclxuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcclxuICAgICAgICAgICAgZXZlbnRbbmFtZV0gPSBwcm9wXHJcbiAgICAgICAgQGV2ZW50X3RoaXMuY2FsbEV2ZW50IGV2ZW50c1xyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICAjXHJcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxyXG4gICAgIyBUT0RPOiBjb25zaWRlciBkb2luZyB0aGlzIGluIGEgbW9yZSBjb25zaXN0ZW50IG1hbm5lci4gVGhpcyBjb3VsZCBhbHNvIGJlXHJcbiAgICAjIGRvbmUgd2l0aCBleGVjdXRlLiBCdXQgY3VycmVudGx5LCB0aGVyZSBhcmUgbm8gc3BlY2l0YWwgSW5zZXJ0LW9wcyBmb3IgTGlzdE1hbmFnZXIuXHJcbiAgICAjXHJcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxyXG4gICAgICBpZiBvcC5uZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIiBhbmQgb3AucHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxyXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXHJcbiAgICAgICAgaWYgbm90IG9wLmlzX2RlbGV0ZWQgIyBXaGVuIHRoaXMgaXMgcmVjZWl2ZWQgZnJvbSB0aGUgSEIsIHRoaXMgY291bGQgYWxyZWFkeSBiZSBkZWxldGVkIVxyXG4gICAgICAgICAgb2xkX3ZhbHVlID0gb3AucHJldl9jbC52YWwoKVxyXG4gICAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXHJcbiAgICAgICAgICAgIHR5cGU6IFwidXBkYXRlXCJcclxuICAgICAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxyXG4gICAgICAgICAgICBvbGRWYWx1ZTogb2xkX3ZhbHVlXHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgb3AucHJldl9jbC5hcHBseURlbGV0ZSgpXHJcbiAgICAgIGVsc2UgaWYgb3AubmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxyXG4gICAgICAgICMgVGhpcyB3b24ndCBiZSByZWNvZ25pemVkIGJ5IHRoZSB1c2VyLCBiZWNhdXNlIGFub3RoZXJcclxuICAgICAgICAjIGNvbmN1cnJlbnQgb3BlcmF0aW9uIGlzIHNldCBhcyB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgUk1cclxuICAgICAgICBvcC5hcHBseURlbGV0ZSgpXHJcbiAgICAgIGVsc2UgIyBwcmV2IF9hbmRfIG5leHQgYXJlIERlbGltaXRlcnMuIFRoaXMgaXMgdGhlIGZpcnN0IGNyZWF0ZWQgUmVwbGFjZWFibGUgaW4gdGhlIFJNXHJcbiAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXHJcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXHJcbiAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgXVxyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XHJcbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXHJcbiAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXHJcbiAgICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxyXG4gICAgICAgICAgb2xkVmFsdWU6IG9wLnZhbCgpXHJcbiAgICAgICAgXVxyXG5cclxuXHJcbiAgICAjXHJcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXHJcbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXHJcbiAgICAjXHJcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XHJcbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXHJcbiAgICAgIHJlbHAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2wpLmV4ZWN1dGUoKVxyXG4gICAgICAjIFRPRE86IGRlbGV0ZSByZXBsIChmb3IgZGVidWdnaW5nKVxyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICBpc0NvbnRlbnREZWxldGVkOiAoKS0+XHJcbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcclxuXHJcbiAgICBkZWxldGVDb250ZW50OiAoKS0+XHJcbiAgICAgIChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcclxuICAgICAgdW5kZWZpbmVkXHJcblxyXG4gICAgI1xyXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXNcclxuICAgICMgQHJldHVybiB7U3RyaW5nfVxyXG4gICAgI1xyXG4gICAgdmFsOiAoKS0+XHJcbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXHJcbiAgICAgICNpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxyXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxyXG5cclxuXHJcblxyXG4gIGJhc2ljX29wc1xyXG4iLCJcclxuc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL09wZXJhdGlvbnMvU3RydWN0dXJlZFwiXHJcblxyXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4vSGlzdG9yeUJ1ZmZlclwiXHJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuL0VuZ2luZVwiXHJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXHJcblxyXG5jcmVhdGVZID0gKGNvbm5lY3RvciktPlxyXG4gIHVzZXJfaWQgPSBudWxsXHJcbiAgaWYgY29ubmVjdG9yLnVzZXJfaWQ/XHJcbiAgICB1c2VyX2lkID0gY29ubmVjdG9yLnVzZXJfaWQgIyBUT0RPOiBjaGFuZ2UgdG8gZ2V0VW5pcXVlSWQoKVxyXG4gIGVsc2VcclxuICAgIHVzZXJfaWQgPSBcIl90ZW1wXCJcclxuICAgIGNvbm5lY3Rvci5vbl91c2VyX2lkX3NldCA9IChpZCktPlxyXG4gICAgICB1c2VyX2lkID0gaWRcclxuICAgICAgSEIucmVzZXRVc2VySWQgaWRcclxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcclxuICBvcHNfbWFuYWdlciA9IHN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgSEIsIHRoaXMuY29uc3RydWN0b3JcclxuICBvcHMgPSBvcHNfbWFuYWdlci5vcGVyYXRpb25zXHJcblxyXG4gIGVuZ2luZSA9IG5ldyBFbmdpbmUgSEIsIG9wc1xyXG4gIGFkYXB0Q29ubmVjdG9yIGNvbm5lY3RvciwgZW5naW5lLCBIQiwgb3BzX21hbmFnZXIuZXhlY3V0aW9uX2xpc3RlbmVyXHJcblxyXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLkhCID0gSEJcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5vcGVyYXRpb25zID0gb3BzXHJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuZW5naW5lID0gZW5naW5lXHJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY29ubmVjdG9yID0gY29ubmVjdG9yXHJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY3VzdG9tX3R5cGVzID0gdGhpcy5jb25zdHJ1Y3RvclxyXG5cclxuICBjdCA9IG5ldyBjcmVhdGVZLk9iamVjdCgpXHJcbiAgbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoY3QsIEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKS5leGVjdXRlKClcclxuICBjdC5fc2V0TW9kZWwgbW9kZWxcclxuICBjdFxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZXHJcbmlmIHdpbmRvdz9cclxuICB3aW5kb3cuWSA9IGNyZWF0ZVlcclxuXHJcbmNyZWF0ZVkuT2JqZWN0ID0gcmVxdWlyZSBcIi4vT2JqZWN0VHlwZVwiXHJcbiJdfQ==
