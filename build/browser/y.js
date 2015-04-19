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
      console.log("delete this ...");
      this.constructed_with = [custom_type, content, content_operations];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOlxcVXNlcnNcXGRtb25hZFxcRG9jdW1lbnRzXFxHaXRIdWJcXHlqc1xcbGliXFxDb25uZWN0b3JBZGFwdGVyLmNvZmZlZSIsIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxsaWJcXENvbm5lY3RvckNsYXNzLmNvZmZlZSIsIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxsaWJcXEVuZ2luZS5jb2ZmZWUiLCJDOlxcVXNlcnNcXGRtb25hZFxcRG9jdW1lbnRzXFxHaXRIdWJcXHlqc1xcbGliXFxIaXN0b3J5QnVmZmVyLmNvZmZlZSIsIkM6XFxVc2Vyc1xcZG1vbmFkXFxEb2N1bWVudHNcXEdpdEh1YlxceWpzXFxsaWJcXE9iamVjdFR5cGUuY29mZmVlIiwiQzpcXFVzZXJzXFxkbW9uYWRcXERvY3VtZW50c1xcR2l0SHViXFx5anNcXGxpYlxcT3BlcmF0aW9uc1xcQmFzaWMuY29mZmVlIiwiQzpcXFVzZXJzXFxkbW9uYWRcXERvY3VtZW50c1xcR2l0SHViXFx5anNcXGxpYlxcT3BlcmF0aW9uc1xcU3RydWN0dXJlZC5jb2ZmZWUiLCJDOlxcVXNlcnNcXGRtb25hZFxcRG9jdW1lbnRzXFxHaXRIdWJcXHlqc1xcbGliXFx5LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0NBLElBQUEsOEJBQUE7O0FBQUEsY0FBQSxHQUFpQixPQUFBLENBQVEsa0JBQVIsQ0FBakIsQ0FBQTs7QUFBQSxjQU1BLEdBQWlCLFNBQUMsU0FBRCxFQUFZLE1BQVosRUFBb0IsRUFBcEIsRUFBd0Isa0JBQXhCLEdBQUE7QUFFZixNQUFBLHVGQUFB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QlosQ0FBQTtBQUFBLEVBdUJBLEVBQUUsQ0FBQyxTQUFILENBQWEsS0FBYixDQXZCQSxDQUFBO1NBd0JBLEdBekJRO0FBQUEsQ0FOVixDQUFBOztBQUFBLE1BaUNNLENBQUMsT0FBUCxHQUFpQixPQWpDakIsQ0FBQTs7QUFrQ0EsSUFBRyxnREFBSDtBQUNFLEVBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxPQUFYLENBREY7Q0FsQ0E7O0FBQUEsT0FxQ08sQ0FBQyxNQUFSLEdBQWlCLE9BQUEsQ0FBUSxjQUFSLENBckNqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxyXG5Db25uZWN0b3JDbGFzcyA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckNsYXNzXCJcclxuI1xyXG4jIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxyXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcclxuIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXHJcbiNcclxuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cclxuXHJcbiAgZm9yIG5hbWUsIGYgb2YgQ29ubmVjdG9yQ2xhc3NcclxuICAgIGNvbm5lY3RvcltuYW1lXSA9IGZcclxuXHJcbiAgY29ubmVjdG9yLnNldElzQm91bmRUb1koKVxyXG5cclxuICBzZW5kXyA9IChvKS0+XHJcbiAgICBpZiAoby51aWQuY3JlYXRvciBpcyBIQi5nZXRVc2VySWQoKSkgYW5kXHJcbiAgICAgICAgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKSBhbmQgIyBUT0RPOiBpIGRvbid0IHRoaW5rIHRoYXQgd2UgbmVlZCB0aGlzIGFueW1vcmUuLlxyXG4gICAgICAgIChIQi5nZXRVc2VySWQoKSBpc250IFwiX3RlbXBcIilcclxuICAgICAgY29ubmVjdG9yLmJyb2FkY2FzdCBvXHJcblxyXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xyXG4gICAgSEIuc2V0SW52b2tlU3luY0hhbmRsZXIgY29ubmVjdG9yLmludm9rZVN5bmNcclxuXHJcbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cclxuICAjIEZvciB0aGUgWE1QUENvbm5lY3RvcjogbGV0cyBzZW5kIGl0IGFzIGFuIGFycmF5XHJcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cclxuICAgIGZvciBuYW1lLHZhbHVlIG9mIHZcclxuICAgICAgdXNlcjogbmFtZVxyXG4gICAgICBzdGF0ZTogdmFsdWVcclxuICBwYXJzZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxyXG4gICAgc3RhdGVfdmVjdG9yID0ge31cclxuICAgIGZvciBzIGluIHZcclxuICAgICAgc3RhdGVfdmVjdG9yW3MudXNlcl0gPSBzLnN0YXRlXHJcbiAgICBzdGF0ZV92ZWN0b3JcclxuXHJcbiAgZ2V0U3RhdGVWZWN0b3IgPSAoKS0+XHJcbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxyXG5cclxuICBnZXRIQiA9ICh2KS0+XHJcbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxyXG4gICAgaGIgPSBIQi5fZW5jb2RlIHN0YXRlX3ZlY3RvclxyXG4gICAganNvbiA9XHJcbiAgICAgIGhiOiBoYlxyXG4gICAgICBzdGF0ZV92ZWN0b3I6IGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXHJcbiAgICBqc29uXHJcblxyXG4gIGFwcGx5SEIgPSAoaGIsIGZyb21IQiktPlxyXG4gICAgZW5naW5lLmFwcGx5T3AgaGIsIGZyb21IQlxyXG5cclxuICBjb25uZWN0b3IuZ2V0U3RhdGVWZWN0b3IgPSBnZXRTdGF0ZVZlY3RvclxyXG4gIGNvbm5lY3Rvci5nZXRIQiA9IGdldEhCXHJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXHJcblxyXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzID89IFtdXHJcbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxyXG4gICAgaWYgb3AudWlkLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxyXG4gICAgICBlbmdpbmUuYXBwbHlPcCBvcFxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gYWRhcHRDb25uZWN0b3IiLCJcclxubW9kdWxlLmV4cG9ydHMgPVxyXG4gICNcclxuICAjIEBwYXJhbXMgbmV3IENvbm5lY3RvcihvcHRpb25zKVxyXG4gICMgICBAcGFyYW0gb3B0aW9ucy5zeW5jTWV0aG9kIHtTdHJpbmd9ICBpcyBlaXRoZXIgXCJzeW5jQWxsXCIgb3IgXCJtYXN0ZXItc2xhdmVcIi5cclxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxyXG4gICMgICAgICAgICAgICAoc2xhdmUgb3IgbWFzdGVyIChvbmx5IHVzZWQgd2hlbiBzeW5jTWV0aG9kIGlzIG1hc3Rlci1zbGF2ZSkpXHJcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpbiB7Qm9vbGVhbn0gV2hldGVociB0byB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLCBidXQgaGFzIHNvbWUgb3ZlcmhlYWQgKG9wdGlvbmFsKVxyXG4gICNcclxuICBpbml0OiAob3B0aW9ucyktPlxyXG4gICAgcmVxID0gKG5hbWUsIGNob2ljZXMpPT5cclxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cclxuICAgICAgICBpZiAobm90IGNob2ljZXM/KSBvciBjaG9pY2VzLnNvbWUoKGMpLT5jIGlzIG9wdGlvbnNbbmFtZV0pXHJcbiAgICAgICAgICBAW25hbWVdID0gb3B0aW9uc1tuYW1lXVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4gc2V0IHRoZSAnXCIrbmFtZStcIicgb3B0aW9uIHRvIG9uZSBvZiB0aGUgZm9sbG93aW5nIGNob2ljZXM6IFwiK0pTT04uZW5jb2RlKGNob2ljZXMpXHJcbiAgICAgIGVsc2VcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcclxuXHJcbiAgICByZXEgXCJzeW5jTWV0aG9kXCIsIFtcInN5bmNBbGxcIiwgXCJtYXN0ZXItc2xhdmVcIl1cclxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cclxuICAgIHJlcSBcInVzZXJfaWRcIlxyXG4gICAgQG9uX3VzZXJfaWRfc2V0PyhAdXNlcl9pZClcclxuXHJcbiAgICAjIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMuXHJcbiAgICAjIEJ1dCB0aGlzIGlzIG5vdCBuZWNlc3NhcnkgaW4gdGhlIHRlc3QtY29ubmVjdG9yXHJcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cclxuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluXHJcbiAgICBlbHNlXHJcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXHJcblxyXG4gICAgIyBBIE1hc3RlciBzaG91bGQgc3luYyB3aXRoIGV2ZXJ5b25lISBUT0RPOiByZWFsbHk/IC0gZm9yIG5vdyBpdHMgc2FmZXIgdGhpcyB3YXkhXHJcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXHJcbiAgICAgIEBzeW5jTWV0aG9kID0gXCJzeW5jQWxsXCJcclxuXHJcbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcclxuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxyXG4gICAgIyBQZWVyanMgQ29ubmVjdGlvbnM6IGtleTogY29ubi1pZCwgdmFsdWU6IG9iamVjdFxyXG4gICAgQGNvbm5lY3Rpb25zID0ge31cclxuICAgICMgTGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBzaGFsbCBwcm9jZXNzIGluY29taW5nIGRhdGFcclxuICAgIEByZWNlaXZlX2hhbmRsZXJzID89IFtdXHJcblxyXG4gICAgIyB3aGV0aGVyIHRoaXMgaW5zdGFuY2UgaXMgYm91bmQgdG8gYW55IHkgaW5zdGFuY2VcclxuICAgIEBjb25uZWN0aW9ucyA9IHt9XHJcbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcclxuICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IGZhbHNlXHJcbiAgICBAaXNfaW5pdGlhbGl6ZWQgPSB0cnVlXHJcblxyXG4gIGlzUm9sZU1hc3RlcjogLT5cclxuICAgIEByb2xlIGlzIFwibWFzdGVyXCJcclxuXHJcbiAgaXNSb2xlU2xhdmU6IC0+XHJcbiAgICBAcm9sZSBpcyBcInNsYXZlXCJcclxuXHJcbiAgZmluZE5ld1N5bmNUYXJnZXQ6ICgpLT5cclxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxyXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcclxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXHJcbiAgICAgICAgaWYgbm90IGMuaXNfc3luY2VkXHJcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxyXG4gICAgICAgICAgYnJlYWtcclxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cclxuICAgICAgQHNldFN0YXRlU3luY2VkKClcclxuICAgIG51bGxcclxuXHJcbiAgdXNlckxlZnQ6ICh1c2VyKS0+XHJcbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXHJcbiAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxyXG5cclxuICB1c2VySm9pbmVkOiAodXNlciwgcm9sZSktPlxyXG4gICAgaWYgbm90IHJvbGU/XHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkludGVybmFsOiBZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEgRS5nLiB1c2VySm9pbmVkKCd1aWQ6MzkzOScsJ3NsYXZlJylcIlxyXG4gICAgIyBhIHVzZXIgam9pbmVkIHRoZSByb29tXHJcbiAgICBAY29ubmVjdGlvbnNbdXNlcl0gPz0ge31cclxuICAgIEBjb25uZWN0aW9uc1t1c2VyXS5pc19zeW5jZWQgPSBmYWxzZVxyXG5cclxuICAgIGlmIChub3QgQGlzX3N5bmNlZCkgb3IgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcclxuICAgICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcclxuICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxyXG4gICAgICAgICMgVE9ETzogV2hhdCBpZiB0aGVyZSBhcmUgdHdvIG1hc3RlcnM/IFByZXZlbnQgc2VuZGluZyBldmVyeXRoaW5nIHR3byB0aW1lcyFcclxuICAgICAgICBAcGVyZm9ybVN5bmNXaXRoTWFzdGVyIHVzZXJcclxuXHJcblxyXG4gICNcclxuICAjIEV4ZWN1dGUgYSBmdW5jdGlvbiBfd2hlbl8gd2UgYXJlIGNvbm5lY3RlZC4gSWYgbm90IGNvbm5lY3RlZCwgd2FpdCB1bnRpbCBjb25uZWN0ZWQuXHJcbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC5cclxuICAjXHJcbiAgd2hlblN5bmNlZDogKGFyZ3MpLT5cclxuICAgIGlmIGFyZ3MuY29uc3RydWN0b3JlIGlzIEZ1bmN0aW9uXHJcbiAgICAgIGFyZ3MgPSBbYXJnc11cclxuICAgIGlmIEBpc19zeW5jZWRcclxuICAgICAgYXJnc1swXS5hcHBseSB0aGlzLCBhcmdzWzEuLl1cclxuICAgIGVsc2VcclxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cclxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQucHVzaCBhcmdzXHJcblxyXG4gICNcclxuICAjIEV4ZWN1dGUgYW4gZnVuY3Rpb24gd2hlbiBhIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXHJcbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC4gZiB3aWxsIGJlIGNhbGxlZCB3aXRoIChzZW5kZXJfaWQsIGJyb2FkY2FzdCB7dHJ1ZXxmYWxzZX0sIG1lc3NhZ2UpLlxyXG4gICNcclxuICBvblJlY2VpdmU6IChmKS0+XHJcbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcclxuXHJcbiAgIyMjXHJcbiAgIyBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBjb25uZWN0ZWQgcGVlcnMuXHJcbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXHJcbiAgI1xyXG4gIGJyb2FkY2FzdDogKG1lc3NhZ2UpLT5cclxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcclxuXHJcbiAgI1xyXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcclxuICAjXHJcbiAgc2VuZDogKHBlZXJfcywgbWVzc2FnZSktPlxyXG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcclxuICAjIyNcclxuXHJcbiAgI1xyXG4gICMgcGVyZm9ybSBhIHN5bmMgd2l0aCBhIHNwZWNpZmljIHVzZXIuXHJcbiAgI1xyXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxyXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xyXG4gICAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcclxuICAgICAgQHNlbmQgdXNlcixcclxuICAgICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxyXG4gICAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXHJcbiAgICAgICAgZGF0YTogW10gIyBAZ2V0U3RhdGVWZWN0b3IoKVxyXG4gICAgICBpZiBub3QgQHNlbnRfaGJfdG9fYWxsX3VzZXJzXHJcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxyXG5cclxuICAgICAgICBoYiA9IEBnZXRIQihbXSkuaGJcclxuICAgICAgICBfaGIgPSBbXVxyXG4gICAgICAgIGZvciBvIGluIGhiXHJcbiAgICAgICAgICBfaGIucHVzaCBvXHJcbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcclxuICAgICAgICAgICAgQGJyb2FkY2FzdFxyXG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXHJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXHJcbiAgICAgICAgICAgIF9oYiA9IFtdXHJcbiAgICAgICAgQGJyb2FkY2FzdFxyXG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxyXG4gICAgICAgICAgZGF0YTogX2hiXHJcblxyXG5cclxuXHJcbiAgI1xyXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcclxuICAjIGFuZCB3aWxsIGJyb2FkY2FzdCBoaXMgb3duIEhCXHJcbiAgI1xyXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cclxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxyXG4gICAgQHNlbmQgdXNlcixcclxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcclxuICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcclxuICAgICAgZGF0YTogW11cclxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxyXG4gICAgX2hiID0gW11cclxuICAgIGZvciBvIGluIGhiXHJcbiAgICAgIF9oYi5wdXNoIG9cclxuICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXHJcbiAgICAgICAgQGJyb2FkY2FzdFxyXG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcclxuICAgICAgICAgIGRhdGE6IF9oYlxyXG4gICAgICAgIF9oYiA9IFtdXHJcbiAgICBAYnJvYWRjYXN0XHJcbiAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcclxuICAgICAgZGF0YTogX2hiXHJcblxyXG4gICNcclxuICAjIFlvdSBhcmUgc3VyZSB0aGF0IGFsbCBjbGllbnRzIGFyZSBzeW5jZWQsIGNhbGwgdGhpcyBmdW5jdGlvbi5cclxuICAjXHJcbiAgc2V0U3RhdGVTeW5jZWQ6ICgpLT5cclxuICAgIGlmIG5vdCBAaXNfc3luY2VkXHJcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXHJcbiAgICAgIGlmIEBjb21wdXRlX3doZW5fc3luY2VkP1xyXG4gICAgICAgIGZvciBmIGluIEBjb21wdXRlX3doZW5fc3luY2VkXHJcbiAgICAgICAgICBmKClcclxuICAgICAgICBkZWxldGUgQGNvbXB1dGVfd2hlbl9zeW5jZWRcclxuICAgICAgbnVsbFxyXG5cclxuICAjXHJcbiAgIyBZb3UgcmVjZWl2ZWQgYSByYXcgbWVzc2FnZSwgYW5kIHlvdSBrbm93IHRoYXQgaXQgaXMgaW50ZW5kZWQgZm9yIHRvIFlqcy4gVGhlbiBjYWxsIHRoaXMgZnVuY3Rpb24uXHJcbiAgI1xyXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cclxuICAgIGlmIG5vdCByZXMuc3luY19zdGVwP1xyXG4gICAgICBmb3IgZiBpbiBAcmVjZWl2ZV9oYW5kbGVyc1xyXG4gICAgICAgIGYgc2VuZGVyLCByZXNcclxuICAgIGVsc2VcclxuICAgICAgaWYgc2VuZGVyIGlzIEB1c2VyX2lkXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJnZXRIQlwiXHJcbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcclxuICAgICAgICBoYiA9IGRhdGEuaGJcclxuICAgICAgICBfaGIgPSBbXVxyXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxyXG4gICAgICAgICMgVGhpcyByZWR1Y2VzIGVycm9ycywgd2hlbiB0aGUgY2xpZW50cyBnb2VzIG9mZmxpbmUgcHJlbWF0dXJlbHkuXHJcbiAgICAgICAgIyBXaGVuIHRoaXMgY2xpZW50IG9ubHkgc3luY3MgdG8gb25lIG90aGVyIGNsaWVudHMsIGJ1dCBsb29zZXMgY29ubmVjdG9ycyxcclxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxyXG4gICAgICAgICMgU2luY2Ugd2UgZG8gbm90IHdhbnQgdG8gcGVyZm9ybSByZWd1bGFyIHN5bmNzLCB0aGlzIGlzIGEgZ29vZCBhbHRlcm5hdGl2ZVxyXG4gICAgICAgIGlmIEBpc19zeW5jZWRcclxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cclxuICAgICAgICAgICAgQHNlbmQgc2VuZGVyLCBtXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxyXG4gICAgICAgICAgICBAYnJvYWRjYXN0IG1cclxuXHJcbiAgICAgICAgZm9yIG8gaW4gaGJcclxuICAgICAgICAgIF9oYi5wdXNoIG9cclxuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxyXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxyXG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXHJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXHJcbiAgICAgICAgICAgIF9oYiA9IFtdXHJcblxyXG4gICAgICAgIHNlbmRBcHBseUhCXHJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxyXG4gICAgICAgICAgZGF0YTogX2hiXHJcblxyXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxyXG4gICAgICAgICAgc2VuZF9hZ2FpbiA9IGRvIChzdiA9IGRhdGEuc3RhdGVfdmVjdG9yKT0+XHJcbiAgICAgICAgICAgICgpPT5cclxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcclxuICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXHJcbiAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogaGJcclxuICAgICAgICAgICAgICAgIHNlbnRfYWdhaW46IFwidHJ1ZVwiXHJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcclxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQlwiXHJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcclxuXHJcbiAgICAgICAgaWYgKEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiIG9yIHJlcy5zZW50X2FnYWluPykgYW5kIChub3QgQGlzX3N5bmNlZCkgYW5kICgoQGN1cnJlbnRfc3luY190YXJnZXQgaXMgc2VuZGVyKSBvciAobm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0PykpXHJcbiAgICAgICAgICBAY29ubmVjdGlvbnNbc2VuZGVyXS5pc19zeW5jZWQgPSB0cnVlXHJcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxyXG5cclxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQl9cIlxyXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXHJcblxyXG5cclxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxyXG4gICMgdGhhdCB3YXkuIE1heWJlIHdlIHN1cHBvcnQgZW5jb2RpbmcgaW4gdGhlIEhCIGFzIFhNTCBpbiB0aGUgZnV0dXJlLCBidXQgZm9yIG5vdyBJIGRvbid0IHdhbnRcclxuICAjIHRvbyBtdWNoIG92ZXJoZWFkLiBZIGlzIHZlcnkgbGlrZWx5IHRvIGdldCBjaGFuZ2VkIGEgbG90IGluIHRoZSBmdXR1cmVcclxuICAjXHJcbiAgIyBCZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gZW5jb2RlIEpTT04gYXMgc3RyaW5nICh3aXRoIGNoYXJhY3RlciBlc2NhcGluZywgd2ljaCBtYWtlcyBpdCBwcmV0dHkgbXVjaCB1bnJlYWRhYmxlKVxyXG4gICMgd2UgZW5jb2RlIHRoZSBKU09OIGFzIFhNTC5cclxuICAjXHJcbiAgIyBXaGVuIHRoZSBIQiBzdXBwb3J0IGVuY29kaW5nIGFzIFhNTCwgdGhlIGZvcm1hdCBzaG91bGQgbG9vayBwcmV0dHkgbXVjaCBsaWtlIHRoaXMuXHJcblxyXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXHJcbiAgIyBleHBlY3RzIGFuIGx0eCAobGVzcyB0aGFuIHhtbCkgb2JqZWN0XHJcbiAgcGFyc2VNZXNzYWdlRnJvbVhtbDogKG0pLT5cclxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cclxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxyXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxyXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHBhcnNlX29iamVjdCBuXHJcblxyXG4gICAgcGFyc2Vfb2JqZWN0ID0gKG5vZGUpLT5cclxuICAgICAganNvbiA9IHt9XHJcbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xyXG4gICAgICAgIGludCA9IHBhcnNlSW50KHZhbHVlKVxyXG4gICAgICAgIGlmIGlzTmFOKGludCkgb3IgKFwiXCIraW50KSBpc250IHZhbHVlXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gaW50XHJcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cclxuICAgICAgICBuYW1lID0gbi5uYW1lXHJcbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9vYmplY3QgblxyXG4gICAgICBqc29uXHJcbiAgICBwYXJzZV9vYmplY3QgbVxyXG5cclxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxyXG4gICMgd2UgdXNlIHN0cmluZyBiZWNhdXNlIFN0cm9waGUgb25seSBhY2NlcHRzIGFuIFwieG1sLXN0cmluZ1wiLi5cclxuICAjIFNvIHthOjQsYjp7Yzo1fX0gd2lsbCBsb29rIGxpa2VcclxuICAjIDx5IGE9XCI0XCI+XHJcbiAgIyAgIDxiIGM9XCI1XCI+PC9iPlxyXG4gICMgPC95PlxyXG4gICMgbSAtIGx0eCBlbGVtZW50XHJcbiAgIyBqc29uIC0gZ3Vlc3MgaXQgOylcclxuICAjXHJcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxyXG4gICAgIyBhdHRyaWJ1dGVzIGlzIG9wdGlvbmFsXHJcbiAgICBlbmNvZGVfb2JqZWN0ID0gKG0sIGpzb24pLT5cclxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxyXG4gICAgICAgIGlmIG5vdCB2YWx1ZT9cclxuICAgICAgICAgICMgbm9wXHJcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKG5hbWUpLCB2YWx1ZVxyXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgQXJyYXlcclxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgbS5zZXRBdHRyaWJ1dGUobmFtZSx2YWx1ZSlcclxuICAgICAgbVxyXG4gICAgZW5jb2RlX2FycmF5ID0gKG0sIGFycmF5KS0+XHJcbiAgICAgIG0uc2V0QXR0cmlidXRlKFwiaXNBcnJheVwiLFwidHJ1ZVwiKVxyXG4gICAgICBmb3IgZSBpbiBhcnJheVxyXG4gICAgICAgIGlmIGUuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxyXG4gICAgICBtXHJcbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxyXG4gICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxyXG4gICAgZWxzZSBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIEFycmF5XHJcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSSBjYW4ndCBlbmNvZGUgdGhpcyBqc29uIVwiXHJcblxyXG4gIHNldElzQm91bmRUb1k6ICgpLT5cclxuICAgIEBvbl9ib3VuZF90b195PygpXHJcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxyXG4gICAgQGlzX2JvdW5kX3RvX3kgPSB0cnVlXHJcbiIsIlxyXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcclxud2luZG93Py51bnByb2Nlc3NlZF9leGVjX2NvdW50ZXIgPSAwICMgVE9ET1xyXG53aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzID0gW11cclxuXHJcbiNcclxuIyBAbm9kb2NcclxuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxyXG4jXHJcbmNsYXNzIEVuZ2luZVxyXG5cclxuICAjXHJcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXHJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcclxuICAjXHJcbiAgY29uc3RydWN0b3I6IChASEIsIEB0eXBlcyktPlxyXG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXHJcblxyXG4gICNcclxuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxyXG4gICNcclxuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cclxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxyXG4gICAgaWYgdHlwZT8ucGFyc2U/XHJcbiAgICAgIHR5cGUucGFyc2UganNvblxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXHJcblxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxyXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXHJcbiAgIyMjXHJcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxyXG4gICAgb3BzID0gW11cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcbiAgIyMjXHJcblxyXG4gICNcclxuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcclxuICAjXHJcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBAYXBwbHlPcCBvcHNfanNvblxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXHJcbiAgIyBUT0RPOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhIVxyXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXHJcbiAgIyAtIHlvdSBjYW4gcHJvYmFibHkgbWFrZSBzb21ldGhpbmcgbGlrZSBkZXBlbmRlbmNpZXMgKGNyZWF0b3IxIHdhaXRzIGZvciBjcmVhdG9yMilcclxuICBhcHBseU9wOiAob3BfanNvbl9hcnJheSwgZnJvbUhCID0gZmFsc2UpLT5cclxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxyXG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXHJcbiAgICBmb3Igb3BfanNvbiBpbiBvcF9qc29uX2FycmF5XHJcbiAgICAgIGlmIGZyb21IQlxyXG4gICAgICAgIG9wX2pzb24uZnJvbUhCID0gXCJ0cnVlXCIgIyBleGVjdXRlIGltbWVkaWF0ZWx5LCBpZlxyXG4gICAgICAjICRwYXJzZV9hbmRfZXhlY3V0ZSB3aWxsIHJldHVybiBmYWxzZSBpZiAkb19qc29uIHdhcyBwYXJzZWQgYW5kIGV4ZWN1dGVkLCBvdGhlcndpc2UgdGhlIHBhcnNlZCBvcGVyYWRpb25cclxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICAgIG8ucGFyc2VkX2Zyb21fanNvbiA9IG9wX2pzb25cclxuICAgICAgaWYgb3BfanNvbi5mcm9tSEI/XHJcbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxyXG4gICAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG8pP1xyXG4gICAgICAgICMgbm9wXHJcbiAgICAgIGVsc2UgaWYgKChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykpIG9yIChub3Qgby5leGVjdXRlKCkpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIENhbGwgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYXBwbGllZCBhIG5ldyBvcGVyYXRpb24uXHJcbiAgIyBJdCBjaGVja3MgaWYgb3BlcmF0aW9ucyB0aGF0IHdlcmUgcHJldmlvdXNseSBub3QgZXhlY3V0YWJsZSBhcmUgbm93IGV4ZWN1dGFibGUuXHJcbiAgI1xyXG4gIHRyeVVucHJvY2Vzc2VkOiAoKS0+XHJcbiAgICB3aGlsZSB0cnVlXHJcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxyXG4gICAgICB1bnByb2Nlc3NlZCA9IFtdXHJcbiAgICAgIGZvciBvcCBpbiBAdW5wcm9jZXNzZWRfb3BzXHJcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XHJcbiAgICAgICAgICAjIG5vcFxyXG4gICAgICAgIGVsc2UgaWYgKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvcCkgYW5kIChub3Qgb3AuZnJvbUhCPykpIG9yIChub3Qgb3AuZXhlY3V0ZSgpKVxyXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxyXG4gICAgICBAdW5wcm9jZXNzZWRfb3BzID0gdW5wcm9jZXNzZWRcclxuICAgICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXMgb2xkX2xlbmd0aFxyXG4gICAgICAgIGJyZWFrXHJcbiAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpc250IDBcclxuICAgICAgQEhCLmludm9rZVN5bmMoKVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxyXG4jXHJcbiMgQG5vZG9jXHJcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cclxuI1xyXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxyXG4jXHJcbmNsYXNzIEhpc3RvcnlCdWZmZXJcclxuXHJcbiAgI1xyXG4gICMgQ3JlYXRlcyBhbiBlbXB0eSBIQi5cclxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxyXG4gICNcclxuICBjb25zdHJ1Y3RvcjogKEB1c2VyX2lkKS0+XHJcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxyXG4gICAgQGJ1ZmZlciA9IHt9XHJcbiAgICBAY2hhbmdlX2xpc3RlbmVycyA9IFtdXHJcbiAgICBAZ2FyYmFnZSA9IFtdICMgV2lsbCBiZSBjbGVhbmVkIG9uIG5leHQgY2FsbCBvZiBnYXJiYWdlQ29sbGVjdG9yXHJcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cclxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSB0cnVlXHJcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gMzAwMDBcclxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXHJcbiAgICBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcclxuXHJcbiAgcmVzZXRVc2VySWQ6IChpZCktPlxyXG4gICAgb3duID0gQGJ1ZmZlcltAdXNlcl9pZF1cclxuICAgIGlmIG93bj9cclxuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxyXG4gICAgICAgIGlmIG8udWlkLmNyZWF0b3I/XHJcbiAgICAgICAgICBvLnVpZC5jcmVhdG9yID0gaWRcclxuICAgICAgICBpZiBvLnVpZC5hbHQ/XHJcbiAgICAgICAgICBvLnVpZC5hbHQuY3JlYXRvciA9IGlkXHJcbiAgICAgIGlmIEBidWZmZXJbaWRdP1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcclxuICAgICAgQGJ1ZmZlcltpZF0gPSBvd25cclxuICAgICAgZGVsZXRlIEBidWZmZXJbQHVzZXJfaWRdXHJcbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xyXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxyXG4gICAgICBkZWxldGUgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxyXG4gICAgQHVzZXJfaWQgPSBpZFxyXG5cclxuICBlbXB0eUdhcmJhZ2U6ICgpPT5cclxuICAgIGZvciBvIGluIEBnYXJiYWdlXHJcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxyXG4gICAgICBvLmNsZWFudXA/KClcclxuXHJcbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxyXG4gICAgQHRyYXNoID0gW11cclxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxyXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcclxuICAgIHVuZGVmaW5lZFxyXG5cclxuICAjXHJcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXHJcbiAgI1xyXG4gIGdldFVzZXJJZDogKCktPlxyXG4gICAgQHVzZXJfaWRcclxuXHJcbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XHJcbiAgICBpZiBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uXHJcbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xyXG4gICAgICAgIGlmIG8/XHJcbiAgICAgICAgICBAZ2FyYmFnZS5wdXNoIG9cclxuXHJcbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XHJcbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gZmFsc2VcclxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXHJcbiAgICBAZ2FyYmFnZSA9IFtdXHJcbiAgICBAdHJhc2ggPSBbXVxyXG5cclxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxyXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IC0xXHJcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXHJcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcclxuXHJcbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxyXG5cclxuICAjXHJcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXHJcbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cclxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cclxuICAjXHJcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XHJcbiAgICB7XHJcbiAgICAgIGNyZWF0b3IgOiAnXydcclxuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcclxuICAgIH1cclxuXHJcbiAgI1xyXG4gICMgR2V0IHRoZSBvcGVyYXRpb24gY291bnRlciB0aGF0IGRlc2NyaWJlcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgZG9jdW1lbnQuXHJcbiAgI1xyXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XHJcbiAgICBpZiBub3QgdXNlcl9pZD9cclxuICAgICAgcmVzID0ge31cclxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxyXG4gICAgICAgIHJlc1t1c2VyXSA9IGN0blxyXG4gICAgICByZXNcclxuICAgIGVsc2VcclxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXHJcblxyXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XHJcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxyXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxyXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XHJcblxyXG4gICNcclxuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXHJcbiAgIyBUT0RPOiBNYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhXHJcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxyXG4gICAganNvbiA9IFtdXHJcbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XHJcbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxyXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcclxuXHJcbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxyXG4gICAgICAjIFRPRE8gbmV4dCwgaWYgQHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBzdGF0ZV92ZWN0b3JbdXNlcl1cclxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXHJcbiAgICAgICAgY29udGludWVcclxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxyXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXHJcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxyXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcclxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXHJcbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxyXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcclxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxyXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxyXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcclxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXHJcbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxyXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcclxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxyXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxyXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxyXG5cclxuICAgIGpzb25cclxuXHJcbiAgI1xyXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXHJcbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxyXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXHJcbiAgI1xyXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxyXG4gICAgaWYgbm90IHVzZXJfaWQ/XHJcbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxyXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cclxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxyXG4gICAgdWlkID1cclxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxyXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxyXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdKytcclxuICAgIHVpZFxyXG5cclxuICAjXHJcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cclxuICAjXHJcbiAgIyB3aGVuIHVpZCBoYXMgYSBcInN1YlwiIHByb3BlcnR5LCB0aGUgdmFsdWUgb2YgaXQgd2lsbCBiZSBhcHBsaWVkXHJcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXHJcbiAgI1xyXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxyXG4gICAgaWYgdWlkLnVpZD9cclxuICAgICAgdWlkID0gdWlkLnVpZFxyXG4gICAgbyA9IEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxyXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XHJcbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxyXG4gICAgZWxzZVxyXG4gICAgICBvXHJcblxyXG4gICNcclxuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcclxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXHJcbiAgI1xyXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cclxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xyXG4gICAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdID0ge31cclxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXHJcbiAgICBpZiAoby51aWQub3BfbnVtYmVyLmNvbnN0cnVjdG9yIGlzbnQgU3RyaW5nKSBhbmQgKG5vdCBAaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgYW5kIChub3Qgby5mcm9tSEI/KSAjIHlvdSBhbHJlYWR5IGRvIHRoaXMgaW4gdGhlIGVuZ2luZSwgc28gZGVsZXRlIGl0IGhlcmUhXHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcclxuICAgIEBhZGRUb0NvdW50ZXIobylcclxuICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXSA9IG9cclxuICAgIG9cclxuXHJcbiAgcmVtb3ZlT3BlcmF0aW9uOiAobyktPlxyXG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cclxuXHJcbiAgIyBXaGVuIHRoZSBIQiBkZXRlcm1pbmVzIGluY29uc2lzdGVuY2llcywgdGhlbiB0aGUgaW52b2tlU3luY1xyXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cclxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxyXG4gIHNldEludm9rZVN5bmNIYW5kbGVyOiAoZiktPlxyXG4gICAgQGludm9rZVN5bmMgPSBmXHJcblxyXG4gICMgZW1wdHkgcGVyIGRlZmF1bHQgIyBUT0RPOiBkbyBpIG5lZWQgdGhpcz9cclxuICBpbnZva2VTeW5jOiAoKS0+XHJcblxyXG4gICMgYWZ0ZXIgeW91IHJlY2VpdmVkIHRoZSBIQiBvZiBhbm90aGVyIHVzZXIgKGluIHRoZSBzeW5jIHByb2Nlc3MpLFxyXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXHJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxyXG4gICAgZm9yIHVzZXIsc3RhdGUgb2Ygc3RhdGVfdmVjdG9yXHJcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xyXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxyXG5cclxuICAjXHJcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxyXG4gICNcclxuICBhZGRUb0NvdW50ZXI6IChvKS0+XHJcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxyXG4gICAgaWYgby51aWQuY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxyXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxyXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXHJcbiAgICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cclxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXHJcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIC0gKG8udWlkLm9wX251bWJlciArIDEpKVxyXG4gICAgICAjY29uc29sZS5sb2cgb1xyXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcclxuIiwiXHJcbmNsYXNzIFlPYmplY3RcclxuXHJcbiAgY29uc3RydWN0b3I6IChAX29iamVjdCA9IHt9KS0+XHJcbiAgICBpZiBAX29iamVjdC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgZm9yIG5hbWUsIHZhbCBvZiBAX29iamVjdFxyXG4gICAgICAgIGlmIHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgICAgIEBfb2JqZWN0W25hbWVdID0gbmV3IFlPYmplY3QodmFsKVxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZLk9iamVjdCBhY2NlcHRzIEpzb24gT2JqZWN0cyBvbmx5XCJcclxuXHJcbiAgX25hbWU6IFwiT2JqZWN0XCJcclxuXHJcbiAgX2dldE1vZGVsOiAodHlwZXMsIG9wcyktPlxyXG4gICAgaWYgbm90IEBfbW9kZWw/XHJcbiAgICAgIEBfbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoQCkuZXhlY3V0ZSgpXHJcbiAgICAgIGZvciBuLG8gb2YgQF9vYmplY3RcclxuICAgICAgICBAX21vZGVsLnZhbCBuLCBvXHJcbiAgICBkZWxldGUgQF9vYmplY3RcclxuICAgIEBfbW9kZWxcclxuXHJcbiAgX3NldE1vZGVsOiAoQF9tb2RlbCktPlxyXG4gICAgZGVsZXRlIEBfb2JqZWN0XHJcblxyXG4gIG9ic2VydmU6IChmKS0+XHJcbiAgICBAX21vZGVsLm9ic2VydmUgZlxyXG4gICAgQFxyXG5cclxuICB1bm9ic2VydmU6IChmKS0+XHJcbiAgICBAX21vZGVsLnVub2JzZXJ2ZSBmXHJcbiAgICBAXHJcblxyXG4gICNcclxuICAjIEBvdmVybG9hZCB2YWwoKVxyXG4gICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxyXG4gICMgICBAcmV0dXJuIFtKc29uXVxyXG4gICNcclxuICAjIEBvdmVybG9hZCB2YWwobmFtZSlcclxuICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXHJcbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cclxuICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGV8fFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cclxuICAjXHJcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXHJcbiAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cclxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxyXG4gICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxyXG4gICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcclxuICAjXHJcbiAgdmFsOiAobmFtZSwgY29udGVudCktPlxyXG4gICAgaWYgQF9tb2RlbD9cclxuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXHJcbiAgICBlbHNlXHJcbiAgICAgIGlmIGNvbnRlbnQ/XHJcbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XHJcbiAgICAgIGVsc2UgaWYgbmFtZT9cclxuICAgICAgICBAX29iamVjdFtuYW1lXVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgcmVzID0ge31cclxuICAgICAgICBmb3Igbix2IG9mIEBfb2JqZWN0XHJcbiAgICAgICAgICByZXNbbl0gPSB2XHJcbiAgICAgICAgcmVzXHJcblxyXG4gIGRlbGV0ZTogKG5hbWUpLT5cclxuICAgIEBfbW9kZWwuZGVsZXRlKG5hbWUpXHJcbiAgICBAXHJcblxyXG5pZiB3aW5kb3c/XHJcbiAgaWYgd2luZG93Llk/XHJcbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XHJcbiAgZWxzZVxyXG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZmlyc3QgaW1wb3J0IFkhXCJcclxuXHJcbmlmIG1vZHVsZT9cclxuICBtb2R1bGUuZXhwb3J0cyA9IFlPYmplY3RcclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9ICgpLT5cclxuICAjIEBzZWUgRW5naW5lLnBhcnNlXHJcbiAgb3BzID0ge31cclxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxyXG5cclxuICAjXHJcbiAgIyBAcHJpdmF0ZVxyXG4gICMgQGFic3RyYWN0XHJcbiAgIyBAbm9kb2NcclxuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BzLlxyXG4gICNcclxuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxyXG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXHJcbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXHJcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcclxuICAjXHJcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cclxuICAjXHJcbiAgY2xhc3Mgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XHJcbiAgICAgIGlmIGN1c3RvbV90eXBlP1xyXG4gICAgICAgIEBjdXN0b21fdHlwZSA9IGN1c3RvbV90eXBlXHJcbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcclxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcclxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XHJcbiAgICAgIGlmIHVpZD9cclxuICAgICAgICBAdWlkID0gdWlkXHJcblxyXG4gICAgICAjIHNlZSBlbmNvZGUgdG8gc2VlLCB3aHkgd2UgYXJlIGRvaW5nIGl0IHRoaXMgd2F5XHJcbiAgICAgIGlmIGNvbnRlbnQgaXMgdW5kZWZpbmVkXHJcbiAgICAgICAgIyBub3BcclxuICAgICAgZWxzZSBpZiBjb250ZW50PyBhbmQgY29udGVudC5jcmVhdG9yP1xyXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgQGNvbnRlbnQgPSBjb250ZW50XHJcbiAgICAgIGlmIGNvbnRlbnRfb3BlcmF0aW9ucz9cclxuICAgICAgICBAY29udGVudF9vcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbmFtZSwgb3Agb2YgY29udGVudF9vcGVyYXRpb25zXHJcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuYW1lLCBvcCwgJ2NvbnRlbnRfb3BlcmF0aW9ucydcclxuXHJcbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXHJcblxyXG4gICAgZ2V0Q29udGVudDogKG5hbWUpLT5cclxuICAgICAgaWYgQGNvbnRlbnQ/XHJcbiAgICAgICAgaWYgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZT9cclxuICAgICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxyXG4gICAgICAgIGVsc2UgaWYgQGNvbnRlbnQuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgICAgICBpZiBuYW1lP1xyXG4gICAgICAgICAgICBpZiBAY29udGVudFtuYW1lXT9cclxuICAgICAgICAgICAgICBAY29udGVudFtuYW1lXVxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9uc1tuYW1lXS5nZXRDdXN0b21UeXBlKClcclxuICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgY29udGVudCA9IHt9XHJcbiAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRcclxuICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxyXG4gICAgICAgICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xyXG4gICAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xyXG4gICAgICAgICAgICAgICAgdiA9IHYuZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxyXG4gICAgICAgICAgICBjb250ZW50XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgQGNvbnRlbnRcclxuICAgICAgZWxzZVxyXG4gICAgICAgIEBjb250ZW50XHJcblxyXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxyXG5cclxuICAgICNcclxuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXHJcbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cclxuICAgICNcclxuICAgIG9ic2VydmU6IChmKS0+XHJcbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXHJcblxyXG4gICAgI1xyXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcclxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxyXG4gICAgI1xyXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxyXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZVxyXG4gICAgdW5vYnNlcnZlOiAoZiktPlxyXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cclxuICAgICAgICBmIGlzbnQgZ1xyXG5cclxuICAgICNcclxuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXHJcbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxyXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXHJcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxyXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XHJcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxyXG5cclxuICAgIGRlbGV0ZTogKCktPlxyXG4gICAgICAobmV3IG9wcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcclxuICAgICAgbnVsbFxyXG5cclxuICAgICNcclxuICAgICMgRmlyZSBhbiBldmVudC5cclxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXHJcbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XHJcbiAgICBjYWxsRXZlbnQ6ICgpLT5cclxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xyXG4gICAgICAgIGNhbGxvbiA9IEBnZXRDdXN0b21UeXBlKClcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGNhbGxvbiA9IEBcclxuICAgICAgQGZvcndhcmRFdmVudCBjYWxsb24sIGFyZ3VtZW50cy4uLlxyXG5cclxuICAgICNcclxuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxyXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cclxuICAgIGZvcndhcmRFdmVudDogKG9wLCBhcmdzLi4uKS0+XHJcbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcclxuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cclxuXHJcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cclxuICAgICAgQGlzX2RlbGV0ZWRcclxuXHJcbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxyXG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXHJcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcclxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcclxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxyXG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxyXG4gICAgICAgICAgQEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXHJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxyXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcclxuXHJcbiAgICAjXHJcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxyXG4gICAgI1xyXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxyXG5cclxuICAgICNcclxuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRQYXJlbnQ6ICgpLT5cclxuICAgICAgQHBhcmVudFxyXG5cclxuICAgICNcclxuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRVaWQ6ICgpLT5cclxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XHJcbiAgICAgICAgQHVpZFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXHJcbiAgICAgICAgICBtYXBfdWlkID0gQHVpZC5hbHQuY2xvbmVVaWQoKVxyXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxyXG4gICAgICAgICAgbWFwX3VpZFxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGNsb25lVWlkOiAoKS0+XHJcbiAgICAgIHVpZCA9IHt9XHJcbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXHJcbiAgICAgICAgdWlkW25dID0gdlxyXG4gICAgICB1aWRcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXHJcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxyXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxyXG4gICAgI1xyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxyXG4gICAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcclxuICAgICAgICBpZiBub3QgQHVpZD9cclxuICAgICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxyXG4gICAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cclxuICAgICAgICAgICMgaXMgZXhlY3V0ZWQgKGJlY2F1c2Ugd2UgbmVlZCB0aGUgY3JlYXRvcl9pZClcclxuICAgICAgICAgIEB1aWQgPSBASEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxyXG4gICAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xyXG4gICAgICAgICAgQEhCLmFkZE9wZXJhdGlvbiBAXHJcbiAgICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcclxuICAgICAgICAgICAgbCBAX2VuY29kZSgpXHJcbiAgICAgICAgQFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxyXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXHJcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxyXG4gICAgI1xyXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xyXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xyXG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cclxuICAgICNcclxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxyXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cclxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxyXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcclxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cclxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxyXG4gICAgI1xyXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wLCBiYXNlID0gXCJ0aGlzXCIpLT5cclxuICAgICAgaWYgb3A/IGFuZCBvcC5fZ2V0TW9kZWw/XHJcbiAgICAgICAgb3AgPSBvcC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXHJcbiAgICAgICNcclxuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cclxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXHJcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXHJcbiAgICAgICNcclxuICAgICAgaWYgbm90IG9wP1xyXG4gICAgICAgICMgbm9wXHJcbiAgICAgIGVsc2UgaWYgb3AuZXhlY3V0ZT8gb3Igbm90IChvcC5vcF9udW1iZXI/IGFuZCBvcC5jcmVhdG9yPylcclxuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZCwgb3Igb3AgaXMgc3RyaW5nLiBDdXJyZW50bHkgXCJEZWxpbWl0ZXJcIiBpcyBzYXZlZCBhcyBzdHJpbmdcclxuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXHJcbiAgICAgICAgaWYgYmFzZSBpcyBcInRoaXNcIlxyXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgZGVzdCA9IEBbYmFzZV1cclxuICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcclxuICAgICAgICAgIGxhc3RfcGF0aCA9IHBhdGhzLnBvcCgpXHJcbiAgICAgICAgICBmb3IgcGF0aCBpbiBwYXRoc1xyXG4gICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxyXG4gICAgICAgICAgZGVzdFtsYXN0X3BhdGhdID0gb3BcclxuICAgICAgZWxzZVxyXG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICBAdW5jaGVja2VkID89IHt9XHJcbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXSA/PSB7fVxyXG4gICAgICAgIEB1bmNoZWNrZWRbYmFzZV1bbmFtZV0gPSBvcFxyXG5cclxuICAgICNcclxuICAgICMgQHByaXZhdGVcclxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxyXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXHJcbiAgICAjXHJcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxyXG4gICAgI1xyXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cclxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxyXG4gICAgICBzdWNjZXNzID0gdHJ1ZVxyXG4gICAgICBmb3IgYmFzZV9uYW1lLCBiYXNlIG9mIEB1bmNoZWNrZWRcclxuICAgICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIGJhc2VcclxuICAgICAgICAgIG9wID0gQEhCLmdldE9wZXJhdGlvbiBvcF91aWRcclxuICAgICAgICAgIGlmIG9wXHJcbiAgICAgICAgICAgIGlmIGJhc2VfbmFtZSBpcyBcInRoaXNcIlxyXG4gICAgICAgICAgICAgIEBbbmFtZV0gPSBvcFxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgZGVzdCA9IEBbYmFzZV9uYW1lXVxyXG4gICAgICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcclxuICAgICAgICAgICAgICBsYXN0X3BhdGggPSBwYXRocy5wb3AoKVxyXG4gICAgICAgICAgICAgIGZvciBwYXRoIGluIHBhdGhzXHJcbiAgICAgICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxyXG4gICAgICAgICAgICAgIGRlc3RbbGFzdF9wYXRoXSA9IG9wXHJcbiAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV0gPz0ge31cclxuICAgICAgICAgICAgdW5pbnN0YW50aWF0ZWRbYmFzZV9uYW1lXVtuYW1lXSA9IG9wX3VpZFxyXG4gICAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcclxuICAgICAgaWYgbm90IHN1Y2Nlc3NcclxuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcclxuICAgICAgICByZXR1cm4gZmFsc2VcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXHJcbiAgICAgICAgcmV0dXJuIEBcclxuXHJcbiAgICBnZXRDdXN0b21UeXBlOiAoKS0+XHJcbiAgICAgIGlmIG5vdCBAY3VzdG9tX3R5cGU/XHJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXHJcbiAgICAgICAgQFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xyXG4gICAgICAgICAgIyBoYXMgbm90IGJlZW4gaW5pdGlhbGl6ZWQgeWV0IChvbmx5IHRoZSBuYW1lIGlzIHNwZWNpZmllZClcclxuICAgICAgICAgIFR5cGUgPSBAY3VzdG9tX3R5cGVzXHJcbiAgICAgICAgICBmb3IgdCBpbiBAY3VzdG9tX3R5cGUuc3BsaXQoXCIuXCIpXHJcbiAgICAgICAgICAgIFR5cGUgPSBUeXBlW3RdXHJcbiAgICAgICAgICBAY3VzdG9tX3R5cGUgPSBuZXcgVHlwZSgpXHJcbiAgICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcclxuICAgICAgICBAY3VzdG9tX3R5cGVcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXHJcbiAgICAjXHJcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XHJcbiAgICAgIGpzb24udHlwZSA9IEB0eXBlXHJcbiAgICAgIGpzb24udWlkID0gQGdldFVpZCgpXHJcbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cclxuICAgICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXHJcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZS5fbmFtZVxyXG5cclxuICAgICAgaWYgQGNvbnRlbnQ/LmdldFVpZD9cclxuICAgICAgICBqc29uLmNvbnRlbnQgPSBAY29udGVudC5nZXRVaWQoKVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAganNvbi5jb250ZW50ID0gQGNvbnRlbnRcclxuICAgICAgaWYgQGNvbnRlbnRfb3BlcmF0aW9ucz9cclxuICAgICAgICBvcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbixvIG9mIEBjb250ZW50X29wZXJhdGlvbnNcclxuICAgICAgICAgIGlmIG8uX2dldE1vZGVsP1xyXG4gICAgICAgICAgICBvID0gby5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXHJcbiAgICAgICAgICBvcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxyXG4gICAgICAgIGpzb24uY29udGVudF9vcGVyYXRpb25zID0gb3BlcmF0aW9uc1xyXG4gICAgICBqc29uXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG5cclxuICAgIHR5cGU6IFwiRGVsZXRlXCJcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cclxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cclxuICAgICNcclxuICAgIF9lbmNvZGU6ICgpLT5cclxuICAgICAge1xyXG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxyXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcclxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXHJcbiAgICAgIH1cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cclxuICAgICNcclxuICAgIGV4ZWN1dGU6ICgpLT5cclxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICByZXMgPSBzdXBlclxyXG4gICAgICAgIGlmIHJlc1xyXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxyXG4gICAgICAgIHJlc1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgI1xyXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cclxuICAjXHJcbiAgb3BzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XHJcbiAgICB7XHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcclxuICAgIH0gPSBvXHJcbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxyXG5cclxuICAjXHJcbiAgIyBAbm9kb2NcclxuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cclxuICAjXHJcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxyXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXHJcbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XHJcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXHJcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xyXG4gICNcclxuICBjbGFzcyBvcHMuSW5zZXJ0IGV4dGVuZHMgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucywgcGFyZW50LCB1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XHJcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcclxuICAgICAgaWYgb3JpZ2luP1xyXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cclxuICAgICAgZWxzZVxyXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXHJcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xyXG5cclxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcclxuXHJcbiAgICB2YWw6ICgpLT5cclxuICAgICAgQGdldENvbnRlbnQoKVxyXG5cclxuICAgIGdldE5leHQ6IChpPTEpLT5cclxuICAgICAgbiA9IEBcclxuICAgICAgd2hpbGUgaSA+IDAgYW5kIG4uaXNfZGVsZXRlZCBhbmQgbi5uZXh0X2NsP1xyXG4gICAgICAgIG4gPSBuLm5leHRfY2xcclxuICAgICAgICBpZiBub3Qgbi5pc19kZWxldGVkXHJcbiAgICAgICAgICBpLS1cclxuICAgICAgblxyXG5cclxuICAgIGdldFByZXY6IChpPTEpLT5cclxuICAgICAgbiA9IEBcclxuICAgICAgd2hpbGUgaSA+IDAgYW5kIG4uaXNfZGVsZXRlZCBhbmQgbi5wcmV2X2NsP1xyXG4gICAgICAgIG4gPSBuLnByZXZfY2xcclxuICAgICAgICBpZiBub3Qgbi5pc19kZWxldGVkXHJcbiAgICAgICAgICBpLS1cclxuICAgICAgblxyXG5cclxuICAgICNcclxuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcclxuICAgICMgQHByaXZhdGVcclxuICAgICNcclxuICAgIGFwcGx5RGVsZXRlOiAobyktPlxyXG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxyXG4gICAgICBjYWxsTGF0ZXIgPSBmYWxzZVxyXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc19kZWxldGVkIGFuZCBvPyAjIG8/IDogaWYgbm90IG8/LCB0aGVuIHRoZSBkZWxpbWl0ZXIgZGVsZXRlZCB0aGlzIEluc2VydGlvbi4gRnVydGhlcm1vcmUsIGl0IHdvdWxkIGJlIHdyb25nIHRvIGNhbGwgaXQuIFRPRE86IG1ha2UgdGhpcyBtb3JlIGV4cHJlc3NpdmUgYW5kIHNhdmVcclxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXHJcbiAgICAgIGlmIG8/XHJcbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXHJcbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcclxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcclxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcclxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcclxuICAgICAgaWYgY2FsbExhdGVyXHJcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHModGhpcywgbylcclxuICAgICAgaWYgQHByZXZfY2w/LmlzRGVsZXRlZCgpXHJcbiAgICAgICAgIyBnYXJiYWdlIGNvbGxlY3QgcHJldl9jbFxyXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcclxuXHJcbiAgICBjbGVhbnVwOiAoKS0+XHJcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxyXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XHJcbiAgICAgICAgICBkLmNsZWFudXAoKVxyXG5cclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInJpZ2h0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxyXG4gICAgICAgICMgY2hhbmdlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxyXG4gICAgICAgIG8gPSBAbmV4dF9jbFxyXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcclxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcclxuICAgICAgICAgICAgby5vcmlnaW4gPSBAcHJldl9jbFxyXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcclxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQG5leHRfY2xcclxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcclxuXHJcbiAgICAgICAgIyBkZWxldGUgY29udGVudFxyXG4gICAgICAgICMgLSB3ZSBtdXN0IG5vdCBkbyB0aGlzIGluIGFwcGx5RGVsZXRlLCBiZWNhdXNlIHRoaXMgd291bGQgbGVhZCB0byBpbmNvbnNpc3RlbmNpZXNcclxuICAgICAgICAjIChlLmcuIHRoZSBmb2xsb3dpbmcgb3BlcmF0aW9uIG9yZGVyIG11c3QgYmUgaW52ZXJ0aWJsZSA6XHJcbiAgICAgICAgIyAgIEluc2VydCByZWZlcnMgdG8gY29udGVudCwgdGhlbiB0aGUgY29udGVudCBpcyBkZWxldGVkKVxyXG4gICAgICAgICMgVGhlcmVmb3JlLCB3ZSBoYXZlIHRvIGRvIHRoaXMgaW4gdGhlIGNsZWFudXBcclxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cclxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnktLVxyXG4gICAgICAgICAgaWYgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA8PSAwIGFuZCBub3QgQGNvbnRlbnQuaXNfZGVsZXRlZFxyXG4gICAgICAgICAgICBAY29udGVudC5hcHBseURlbGV0ZSgpXHJcbiAgICAgICAgZGVsZXRlIEBjb250ZW50XHJcbiAgICAgICAgc3VwZXJcclxuICAgICAgIyBlbHNlXHJcbiAgICAgICMgICBTb21lb25lIGluc2VydGVkIHNvbWV0aGluZyBpbiB0aGUgbWVhbnRpbWUuXHJcbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxyXG5cclxuICAgICNcclxuICAgICMgQHByaXZhdGVcclxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cclxuICAgICNcclxuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cclxuICAgICAgZCA9IDBcclxuICAgICAgbyA9IEBwcmV2X2NsXHJcbiAgICAgIHdoaWxlIHRydWVcclxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cclxuICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgZCsrXHJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxyXG4gICAgICBkXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cclxuICAgIGV4ZWN1dGU6ICgpLT5cclxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cclxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAICMgVE9ETzogdGhpcyBpcyBwcm9iYWJseSBub3QgbmVjZXNzYXJ5IGFuZCBvbmx5IG5pY2UgZm9yIGRlYnVnZ2luZ1xyXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA/PSAwXHJcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5KytcclxuICAgICAgICBpZiBAcGFyZW50P1xyXG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xyXG4gICAgICAgICAgICBAcHJldl9jbCA9IEBwYXJlbnQuYmVnaW5uaW5nXHJcbiAgICAgICAgICBpZiBub3QgQG9yaWdpbj9cclxuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXHJcbiAgICAgICAgICBlbHNlIGlmIEBvcmlnaW4gaXMgXCJEZWxpbWl0ZXJcIlxyXG4gICAgICAgICAgICBAb3JpZ2luID0gQHBhcmVudC5iZWdpbm5pbmdcclxuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cclxuICAgICAgICAgICAgQG5leHRfY2wgPSBAcGFyZW50LmVuZFxyXG4gICAgICAgIGlmIEBwcmV2X2NsP1xyXG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcclxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXHJcbiAgICAgICAgICBpID0gZGlzdGFuY2VfdG9fb3JpZ2luICMgbG9vcCBjb3VudGVyXHJcblxyXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXHJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxyXG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcclxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcclxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XHJcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcclxuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXHJcbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xyXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcclxuICAgICAgICAgICMgICAgICAgICAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxyXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cclxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxyXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxyXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcclxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxyXG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcclxuICAgICAgICAgICAgICAgICMgY2FzZSAxXHJcbiAgICAgICAgICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIDwgQHVpZC5jcmVhdG9yXHJcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xyXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAjIG5vcFxyXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXHJcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxyXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cclxuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcclxuICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICAgI25vcFxyXG4gICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgICMgY2FzZSAzXHJcbiAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgIGkrK1xyXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXHJcbiAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXHJcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcclxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXHJcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxyXG5cclxuICAgICAgICBAc2V0UGFyZW50IEBwcmV2X2NsLmdldFBhcmVudCgpICMgZG8gSW5zZXJ0aW9ucyBhbHdheXMgaGF2ZSBhIHBhcmVudD9cclxuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xyXG4gICAgICAgIEBwYXJlbnQuY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzKHRoaXMpXHJcbiAgICAgICAgQFxyXG5cclxuICAgICNcclxuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRQb3NpdGlvbjogKCktPlxyXG4gICAgICBwb3NpdGlvbiA9IDBcclxuICAgICAgcHJldiA9IEBwcmV2X2NsXHJcbiAgICAgIHdoaWxlIHRydWVcclxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxyXG4gICAgICAgICAgYnJlYWtcclxuICAgICAgICBpZiBub3QgcHJldi5pc0RlbGV0ZWQoKVxyXG4gICAgICAgICAgcG9zaXRpb24rK1xyXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcclxuICAgICAgcG9zaXRpb25cclxuXHJcbiAgICAjXHJcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cclxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cclxuICAgICNcclxuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cclxuICAgICAganNvbi5wcmV2ID0gQHByZXZfY2wuZ2V0VWlkKClcclxuICAgICAganNvbi5uZXh0ID0gQG5leHRfY2wuZ2V0VWlkKClcclxuXHJcbiAgICAgIGlmIEBvcmlnaW4udHlwZSBpcyBcIkRlbGltaXRlclwiXHJcbiAgICAgICAganNvbi5vcmlnaW4gPSBcIkRlbGltaXRlclwiXHJcbiAgICAgIGVsc2UgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXHJcbiAgICAgICAganNvbi5vcmlnaW4gPSBAb3JpZ2luLmdldFVpZCgpXHJcblxyXG4gICAgICAjIGlmIG5vdCAoanNvbi5wcmV2PyBhbmQganNvbi5uZXh0PylcclxuICAgICAganNvbi5wYXJlbnQgPSBAcGFyZW50LmdldFVpZCgpXHJcblxyXG4gICAgICBzdXBlciBqc29uXHJcblxyXG4gIG9wcy5JbnNlcnQucGFyc2UgPSAoanNvbiktPlxyXG4gICAge1xyXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XHJcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdwcmV2JzogcHJldlxyXG4gICAgICAnbmV4dCc6IG5leHRcclxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cclxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcclxuICAgIH0gPSBqc29uXHJcbiAgICBuZXcgdGhpcyBudWxsLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXHJcbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxyXG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cclxuICAjXHJcbiAgY2xhc3Mgb3BzLkRlbGltaXRlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxyXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XHJcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcclxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcclxuICAgICAgc3VwZXIgbnVsbCwge25vT3BlcmF0aW9uOiB0cnVlfVxyXG5cclxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcclxuXHJcbiAgICBhcHBseURlbGV0ZTogKCktPlxyXG4gICAgICBzdXBlcigpXHJcbiAgICAgIG8gPSBAcHJldl9jbFxyXG4gICAgICB3aGlsZSBvP1xyXG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxyXG4gICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgdW5kZWZpbmVkXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgI1xyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xyXG4gICAgICAgIHN1cGVyXHJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxyXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXHJcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxyXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcclxuICAgICAgICAgIHN1cGVyXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgZmFsc2VcclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xyXG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxyXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXHJcbiAgICAgICAgc3VwZXJcclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cclxuICAgICAgICBzdXBlclxyXG4gICAgICAjZWxzZVxyXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjXHJcbiAgICBfZW5jb2RlOiAoKS0+XHJcbiAgICAgIHtcclxuICAgICAgICAndHlwZScgOiBAdHlwZVxyXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXHJcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXHJcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXHJcbiAgICAgIH1cclxuXHJcbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAndWlkJyA6IHVpZFxyXG4gICAgJ3ByZXYnIDogcHJldlxyXG4gICAgJ25leHQnIDogbmV4dFxyXG4gICAgfSA9IGpzb25cclxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcclxuXHJcbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxyXG4gIHtcclxuICAgICdvcGVyYXRpb25zJyA6IG9wc1xyXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcclxuICB9XHJcbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XHJcbiAgYmFzaWNfb3BzID0gYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQoKVxyXG4gIG9wcyA9IGJhc2ljX29wcy5vcGVyYXRpb25zXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5NYXBNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxyXG4gICAgI1xyXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cclxuICAgICAgQF9tYXAgPSB7fVxyXG4gICAgICBjb25zb2xlLmxvZyhcImRlbGV0ZSB0aGlzIC4uLlwiKVxyXG4gICAgICB0aGlzLmNvbnN0cnVjdGVkX3dpdGggPSBbY3VzdG9tX3R5cGUsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc10gIyBkZWJ1ZyFcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXHJcblxyXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcclxuXHJcbiAgICBhcHBseURlbGV0ZTogKCktPlxyXG4gICAgICBmb3IgbmFtZSxwIG9mIEBfbWFwXHJcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXHJcbiAgICAgIHN1cGVyKClcclxuXHJcbiAgICBjbGVhbnVwOiAoKS0+XHJcbiAgICAgIHN1cGVyKClcclxuXHJcbiAgICBtYXA6IChmKS0+XHJcbiAgICAgIGZvciBuLHYgb2YgQF9tYXBcclxuICAgICAgICBmKG4sdilcclxuICAgICAgdW5kZWZpbmVkXHJcblxyXG4gICAgI1xyXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxyXG4gICAgI1xyXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxyXG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxyXG4gICAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50Ll9nZXRNb2RlbD9cclxuICAgICAgICAgIHJlcCA9IGNvbnRlbnQuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHJlcCA9IGNvbnRlbnRcclxuICAgICAgICBAcmV0cmlldmVTdWIobmFtZSkucmVwbGFjZSByZXBcclxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgIGVsc2UgaWYgbmFtZT9cclxuICAgICAgICBwcm9wID0gQF9tYXBbbmFtZV1cclxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXHJcbiAgICAgICAgICByZXMgPSBwcm9wLnZhbCgpXHJcbiAgICAgICAgICBpZiByZXMgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXHJcbiAgICAgICAgICAgIHJlcy5nZXRDdXN0b21UeXBlKClcclxuICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgcmVzXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgdW5kZWZpbmVkXHJcbiAgICAgIGVsc2VcclxuICAgICAgICByZXN1bHQgPSB7fVxyXG4gICAgICAgIGZvciBuYW1lLG8gb2YgQF9tYXBcclxuICAgICAgICAgIGlmIG5vdCBvLmlzQ29udGVudERlbGV0ZWQoKVxyXG4gICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvLnZhbCgpXHJcbiAgICAgICAgcmVzdWx0XHJcblxyXG4gICAgZGVsZXRlOiAobmFtZSktPlxyXG4gICAgICBAX21hcFtuYW1lXT8uZGVsZXRlQ29udGVudCgpXHJcbiAgICAgIEBcclxuXHJcbiAgICByZXRyaWV2ZVN1YjogKHByb3BlcnR5X25hbWUpLT5cclxuICAgICAgaWYgbm90IEBfbWFwW3Byb3BlcnR5X25hbWVdP1xyXG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxyXG4gICAgICAgICAgbmFtZTogcHJvcGVydHlfbmFtZVxyXG4gICAgICAgIGV2ZW50X3RoaXMgPSBAXHJcbiAgICAgICAgcm1fdWlkID1cclxuICAgICAgICAgIG5vT3BlcmF0aW9uOiB0cnVlXHJcbiAgICAgICAgICBzdWI6IHByb3BlcnR5X25hbWVcclxuICAgICAgICAgIGFsdDogQFxyXG4gICAgICAgIHJtID0gbmV3IG9wcy5SZXBsYWNlTWFuYWdlciBudWxsLCBldmVudF9wcm9wZXJ0aWVzLCBldmVudF90aGlzLCBybV91aWQgIyB0aGlzIG9wZXJhdGlvbiBzaGFsbCBub3QgYmUgc2F2ZWQgaW4gdGhlIEhCXHJcbiAgICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV0gPSBybVxyXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXHJcbiAgICAgICAgcm0uZXhlY3V0ZSgpXHJcbiAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdXHJcblxyXG4gIG9wcy5NYXBNYW5hZ2VyLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ2N1c3RvbV90eXBlJyA6IGN1c3RvbV90eXBlXHJcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcclxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcclxuICAgIH0gPSBqc29uXHJcbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpXHJcblxyXG5cclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxyXG4gICNcclxuICBjbGFzcyBvcHMuTGlzdE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXHJcblxyXG4gICAgI1xyXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cclxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxyXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxyXG4gICAgICBAYmVnaW5uaW5nID0gbmV3IG9wcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWRcclxuICAgICAgQGVuZCA9ICAgICAgIG5ldyBvcHMuRGVsaW1pdGVyIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxyXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXHJcbiAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXHJcbiAgICAgIEBlbmQuZXhlY3V0ZSgpXHJcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xyXG5cclxuICAgIHR5cGU6IFwiTGlzdE1hbmFnZXJcIlxyXG5cclxuXHJcbiAgICBhcHBseURlbGV0ZTogKCktPlxyXG4gICAgICBvID0gQGJlZ2lubmluZ1xyXG4gICAgICB3aGlsZSBvP1xyXG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxyXG4gICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgc3VwZXIoKVxyXG5cclxuICAgIGNsZWFudXA6ICgpLT5cclxuICAgICAgc3VwZXIoKVxyXG5cclxuXHJcbiAgICB0b0pzb246ICh0cmFuc2Zvcm1fdG9fdmFsdWUgPSBmYWxzZSktPlxyXG4gICAgICB2YWwgPSBAdmFsKClcclxuICAgICAgZm9yIGksIG8gaW4gdmFsXHJcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5PYmplY3RcclxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcclxuICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiBvcHMuTGlzdE1hbmFnZXJcclxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcclxuICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cclxuICAgICAgICAgIG8udmFsKClcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBvXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXHJcbiAgICAjXHJcbiAgICBleGVjdXRlOiAoKS0+XHJcbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXHJcbiAgICAgICAgQGJlZ2lubmluZy5zZXRQYXJlbnQgQFxyXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcclxuICAgICAgICBzdXBlclxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcclxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cclxuICAgICAgQGVuZC5wcmV2X2NsXHJcblxyXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxyXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cclxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXHJcblxyXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxyXG4gICAgIyBEb2Vzbid0IHJldHVybiBsZWZ0LXJpZ2h0IGRlbGltaXRlci5cclxuICAgIHRvQXJyYXk6ICgpLT5cclxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxyXG4gICAgICByZXN1bHQgPSBbXVxyXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxyXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcclxuICAgICAgICAgIHJlc3VsdC5wdXNoIG8udmFsKClcclxuICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgIHJlc3VsdFxyXG5cclxuICAgIG1hcDogKGYpLT5cclxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxyXG4gICAgICByZXN1bHQgPSBbXVxyXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxyXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcclxuICAgICAgICAgIHJlc3VsdC5wdXNoIGYobylcclxuICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgIHJlc3VsdFxyXG5cclxuICAgIGZvbGQ6IChpbml0LCBmKS0+XHJcbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcclxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcclxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXHJcbiAgICAgICAgICBpbml0ID0gZihpbml0LCBvKVxyXG4gICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgaW5pdFxyXG5cclxuICAgIHZhbDogKHBvcyktPlxyXG4gICAgICBpZiBwb3M/XHJcbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxyXG4gICAgICAgIGlmIG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpXHJcbiAgICAgICAgICBvLnZhbCgpXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBwb3NpdGlvbiBkb2VzIG5vdCBleGlzdFwiXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBAdG9BcnJheSgpXHJcblxyXG4gICAgcmVmOiAocG9zKS0+XHJcbiAgICAgIGlmIHBvcz9cclxuICAgICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zKzEpXHJcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcclxuICAgICAgICAgIG9cclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBudWxsXHJcbiAgICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwieW91IG11c3Qgc3BlY2lmeSBhIHBvc2l0aW9uIHBhcmFtZXRlclwiXHJcblxyXG4gICAgI1xyXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cclxuICAgICMgZS5nLiBcImFiY1wiIDogdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcclxuICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXHJcbiAgICAjXHJcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cclxuICAgICAgbyA9IEBiZWdpbm5pbmdcclxuICAgICAgd2hpbGUgdHJ1ZVxyXG4gICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxyXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyIGFuZCBvLnByZXZfY2w/XHJcbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXHJcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxyXG4gICAgICAgICAgIyBUaGVuLCB3ZSdsbCBqdXN0IHJldHVybiB0aGUgbGFzdCBjaGFyYWN0ZXIuXHJcbiAgICAgICAgICBvID0gby5wcmV2X2NsXHJcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBvLnByZXZfY2w/XHJcbiAgICAgICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcclxuICAgICAgICAgIGJyZWFrXHJcblxyXG4gICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxyXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxyXG4gICAgICBvXHJcblxyXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cclxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgW2NvbnRlbnRdXHJcblxyXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50cyktPlxyXG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxyXG4gICAgICB3aGlsZSByaWdodC5pc0RlbGV0ZWQoKVxyXG4gICAgICAgIHJpZ2h0ID0gcmlnaHQubmV4dF9jbCAjIGZpbmQgdGhlIGZpcnN0IGNoYXJhY3RlciB0byB0aGUgcmlnaHQsIHRoYXQgaXMgbm90IGRlbGV0ZWQuIEluIHRoZSBjYXNlIHRoYXQgcG9zaXRpb24gaXMgMCwgaXRzIHRoZSBEZWxpbWl0ZXIuXHJcbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXHJcblxyXG4gICAgICAjIFRPRE86IGFsd2F5cyBleHBlY3QgYW4gYXJyYXkgYXMgY29udGVudC4gVGhlbiB5b3UgY2FuIGNvbWJpbmUgdGhpcyB3aXRoIHRoZSBvdGhlciBvcHRpb24gKGVsc2UpXHJcbiAgICAgIGlmIGNvbnRlbnRzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgIChuZXcgb3BzLkluc2VydCBudWxsLCBjb250ZW50LCBudWxsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZm9yIGMgaW4gY29udGVudHNcclxuICAgICAgICAgIGlmIGM/IGFuZCBjLl9uYW1lPyBhbmQgYy5fZ2V0TW9kZWw/XHJcbiAgICAgICAgICAgIGMgPSBjLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcclxuICAgICAgICAgIHRtcCA9IChuZXcgb3BzLkluc2VydCBudWxsLCBjLCBudWxsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxyXG4gICAgICAgICAgbGVmdCA9IHRtcFxyXG4gICAgICBAXHJcblxyXG4gICAgI1xyXG4gICAgIyBJbnNlcnRzIGFuIGFycmF5IG9mIGNvbnRlbnQgaW50byB0aGlzIGxpc3QuXHJcbiAgICAjIEBOb3RlOiBUaGlzIGV4cGVjdHMgYW4gYXJyYXkgYXMgY29udGVudCFcclxuICAgICNcclxuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxyXG4gICAgI1xyXG4gICAgaW5zZXJ0OiAocG9zaXRpb24sIGNvbnRlbnRzKS0+XHJcbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXHJcbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcclxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcclxuICAgICAgQGluc2VydEFmdGVyIGl0aCwgY29udGVudHNcclxuXHJcbiAgICAjXHJcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxyXG4gICAgI1xyXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3RcclxuICAgICNcclxuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGggPSAxKS0+XHJcbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXHJcblxyXG4gICAgICBkZWxldGVfb3BzID0gW11cclxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXHJcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcclxuICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgZCA9IChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxyXG4gICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgICB3aGlsZSAobm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcikpIGFuZCBvLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXHJcbiAgICAgIEBcclxuXHJcblxyXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cclxuICAgICAgZ2V0Q29udGVudFR5cGUgPSAoY29udGVudCktPlxyXG4gICAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXHJcbiAgICAgICAgICBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIGNvbnRlbnRcclxuICAgICAgQGNhbGxFdmVudCBbXHJcbiAgICAgICAgdHlwZTogXCJpbnNlcnRcIlxyXG4gICAgICAgIHBvc2l0aW9uOiBvcC5nZXRQb3NpdGlvbigpXHJcbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxyXG4gICAgICAgIHZhbHVlOiBnZXRDb250ZW50VHlwZSBvcC52YWwoKVxyXG4gICAgICBdXHJcblxyXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAob3AsIGRlbF9vcCktPlxyXG4gICAgICBAY2FsbEV2ZW50IFtcclxuICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXHJcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcclxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKCkgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxyXG4gICAgICAgIGxlbmd0aDogMVxyXG4gICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgb2xkVmFsdWU6IG9wLnZhbCgpXHJcbiAgICAgIF1cclxuXHJcbiAgb3BzLkxpc3RNYW5hZ2VyLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcclxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxyXG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xyXG4gICAgfSA9IGpzb25cclxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcclxuXHJcbiAgY2xhc3Mgb3BzLkNvbXBvc2l0aW9uIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXHJcblxyXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgQF9jb21wb3NpdGlvbl92YWx1ZSwgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucywgdWlkLCB0bXBfY29tcG9zaXRpb25fcmVmKS0+XHJcbiAgICAgICMgd2UgY2FuJ3QgdXNlIEBzZXZlT3BlcmF0aW9uICdjb21wb3NpdGlvbl9yZWYnLCB0bXBfY29tcG9zaXRpb25fcmVmIGhlcmUsXHJcbiAgICAgICMgYmVjYXVzZSB0aGVuIHRoZXJlIGlzIGEgXCJsb29wXCIgKGluc2VydGlvbiByZWZlcnMgdG8gcGFyYW50LCByZWZlcnMgdG8gaW5zZXJ0aW9uLi4pXHJcbiAgICAgICMgVGhpcyBpcyB3aHkgd2UgaGF2ZSB0byBjaGVjayBpbiBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzIHVudGlsIHdlIGZpbmQgaXRcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG4gICAgICBpZiB0bXBfY29tcG9zaXRpb25fcmVmP1xyXG4gICAgICAgIEB0bXBfY29tcG9zaXRpb25fcmVmID0gdG1wX2NvbXBvc2l0aW9uX3JlZlxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxyXG4gICAgICBpZiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xyXG4gICAgICAgIEBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbixvIG9mIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcclxuICAgICAgICAgIEBzYXZlT3BlcmF0aW9uIG4sIG8sICdfY29tcG9zaXRpb25fdmFsdWUnXHJcblxyXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXHJcbiAgICAjXHJcbiAgICBleGVjdXRlOiAoKS0+XHJcbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXHJcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKS5fc2V0Q29tcG9zaXRpb25WYWx1ZSBAX2NvbXBvc2l0aW9uX3ZhbHVlXHJcbiAgICAgICAgZGVsZXRlIEBfY29tcG9zaXRpb25fdmFsdWVcclxuICAgICAgICBzdXBlclxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgICAjXHJcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtb3BlcmF0aW9uIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXHJcbiAgICAjXHJcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxyXG4gICAgICBpZiBAdG1wX2NvbXBvc2l0aW9uX3JlZj9cclxuICAgICAgICBpZiBvcC51aWQuY3JlYXRvciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5jcmVhdG9yIGFuZCBvcC51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxyXG4gICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IG9wXHJcbiAgICAgICAgICBkZWxldGUgQHRtcF9jb21wb3NpdGlvbl9yZWZcclxuICAgICAgICAgIG8gPSBvcC5uZXh0X2NsXHJcbiAgICAgICAgICB3aGlsZSBvLm5leHRfY2w/XHJcbiAgICAgICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyBvXHJcbiAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgICByZXR1cm5cclxuXHJcbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWYubmV4dF9jbCBpcyBvcFxyXG4gICAgICAgIG9wLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvcC52YWwoKVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgbyA9IEBlbmQucHJldl9jbFxyXG4gICAgICAgIHdoaWxlIG8gaXNudCBvcFxyXG4gICAgICAgICAgQGdldEN1c3RvbVR5cGUoKS5fdW5hcHBseSBvLnVuZG9fZGVsdGFcclxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgICB3aGlsZSBvIGlzbnQgQGVuZFxyXG4gICAgICAgICAgby51bmRvX2RlbHRhID0gQGdldEN1c3RvbVR5cGUoKS5fYXBwbHkgby52YWwoKVxyXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICBAY29tcG9zaXRpb25fcmVmID0gQGVuZC5wcmV2X2NsXHJcblxyXG4gICAgICBAY2FsbEV2ZW50IFtcclxuICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXHJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxyXG4gICAgICAgIG5ld1ZhbHVlOiBAdmFsKClcclxuICAgICAgXVxyXG5cclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cclxuICAgICAgcmV0dXJuXHJcblxyXG4gICAgI1xyXG4gICAgIyBDcmVhdGUgYSBuZXcgRGVsdGFcclxuICAgICMgLSBpbnNlcnRzIG5ldyBDb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcclxuICAgICMgLSB1cGRhdGVzIHRoZSBjb21wb3NpdGlvbl92YWx1ZVxyXG4gICAgIyAtIHVwZGF0ZXMgdGhlIGNvbXBvc2l0aW9uX3JlZlxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0gZGVsdGEgVGhlIGRlbHRhIHRoYXQgaXMgYXBwbGllZCB0byB0aGUgY29tcG9zaXRpb25fdmFsdWVcclxuICAgICNcclxuICAgIGFwcGx5RGVsdGE6IChkZWx0YSwgb3BlcmF0aW9ucyktPlxyXG4gICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgZGVsdGEsIG9wZXJhdGlvbnMsIEAsIG51bGwsIEBlbmQucHJldl9jbCwgQGVuZCkuZXhlY3V0ZSgpXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgICNcclxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cclxuICAgICNcclxuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cclxuICAgICAgY3VzdG9tID0gQGdldEN1c3RvbVR5cGUoKS5fZ2V0Q29tcG9zaXRpb25WYWx1ZSgpXHJcbiAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWUgPSBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVcclxuICAgICAgaWYgY3VzdG9tLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnM/XHJcbiAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbixvIG9mIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXHJcbiAgICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNbbl0gPSBvLmdldFVpZCgpXHJcbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWY/XHJcbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3JlZiA9IEB0bXBfY29tcG9zaXRpb25fcmVmXHJcbiAgICAgIHN1cGVyIGpzb25cclxuXHJcbiAgb3BzLkNvbXBvc2l0aW9uLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcclxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXHJcbiAgICAgICdjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zJyA6IGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcclxuICAgICAgJ2NvbXBvc2l0aW9uX3JlZicgOiBjb21wb3NpdGlvbl9yZWZcclxuICAgIH0gPSBqc29uXHJcbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgY29tcG9zaXRpb25fcmVmKVxyXG5cclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXHJcbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXHJcbiAgI1xyXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcclxuICAjIEBzZWUgVGV4dFR5cGVcclxuICAjXHJcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF9wcm9wZXJ0aWVzIERlY29yYXRlcyB0aGUgZXZlbnQgdGhhdCBpcyB0aHJvd24gYnkgdGhlIFJNXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXHJcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cclxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxyXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCktPlxyXG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xyXG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzLmdldEN1c3RvbVR5cGUoKVxyXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXHJcblxyXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXHJcblxyXG4gICAgI1xyXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcclxuICAgICMgUmVwbGFjZWFibGVzIGFsc28gbm90IHRocm93IHRoZSBzYW1lIGV2ZW50cy5cclxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxyXG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cclxuICAgICNcclxuICAgICNcclxuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxyXG4gICAgICBpZiBub3QgQGlzRGVsZXRlZCgpXHJcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xyXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xyXG4gICAgICAgICAgICBldmVudFtuYW1lXSA9IHByb3BcclxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgICNcclxuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC10eXBlIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXHJcbiAgICAjIFRPRE86IGNvbnNpZGVyIGRvaW5nIHRoaXMgaW4gYSBtb3JlIGNvbnNpc3RlbnQgbWFubmVyLiBUaGlzIGNvdWxkIGFsc28gYmVcclxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cclxuICAgICNcclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wKS0+XHJcbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcC5wcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgIyB0aGlzIHJlcGxhY2VzIGFub3RoZXIgUmVwbGFjZWFibGVcclxuICAgICAgICBpZiBub3Qgb3AuaXNfZGVsZXRlZCAjIFdoZW4gdGhpcyBpcyByZWNlaXZlZCBmcm9tIHRoZSBIQiwgdGhpcyBjb3VsZCBhbHJlYWR5IGJlIGRlbGV0ZWQhXHJcbiAgICAgICAgICBvbGRfdmFsdWUgPSBvcC5wcmV2X2NsLnZhbCgpXHJcbiAgICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcclxuICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxyXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcclxuICAgICAgICAgIF1cclxuICAgICAgICBvcC5wcmV2X2NsLmFwcGx5RGVsZXRlKClcclxuICAgICAgZWxzZSBpZiBvcC5uZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgIyBUaGlzIHdvbid0IGJlIHJlY29nbml6ZWQgYnkgdGhlIHVzZXIsIGJlY2F1c2UgYW5vdGhlclxyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxyXG4gICAgICAgIG9wLmFwcGx5RGVsZXRlKClcclxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cclxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcclxuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcclxuICAgICAgICAgIGNoYW5nZWRCeTogb3AudWlkLmNyZWF0b3JcclxuICAgICAgICBdXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cclxuICAgICAgaWYgb3AubmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcclxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcclxuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcclxuICAgICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgICBvbGRWYWx1ZTogb3AudmFsKClcclxuICAgICAgICBdXHJcblxyXG5cclxuICAgICNcclxuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cclxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcclxuICAgICNcclxuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cclxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcclxuICAgICAgcmVscCA9IChuZXcgb3BzLkluc2VydCBudWxsLCBjb250ZW50LCBudWxsLCBALCByZXBsYWNlYWJsZV91aWQsIG8sIG8ubmV4dF9jbCkuZXhlY3V0ZSgpXHJcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cclxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxyXG5cclxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cclxuICAgICAgKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICAjXHJcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpc1xyXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XHJcbiAgICAjXHJcbiAgICB2YWw6ICgpLT5cclxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcclxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXHJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXHJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXHJcblxyXG5cclxuXHJcbiAgYmFzaWNfb3BzXHJcbiIsIlxyXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcclxuXHJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcclxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcclxuYWRhcHRDb25uZWN0b3IgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JBZGFwdGVyXCJcclxuXHJcbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XHJcbiAgdXNlcl9pZCA9IG51bGxcclxuICBpZiBjb25uZWN0b3IudXNlcl9pZD9cclxuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXHJcbiAgZWxzZVxyXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxyXG4gICAgY29ubmVjdG9yLm9uX3VzZXJfaWRfc2V0ID0gKGlkKS0+XHJcbiAgICAgIHVzZXJfaWQgPSBpZFxyXG4gICAgICBIQi5yZXNldFVzZXJJZCBpZFxyXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxyXG4gIG9wc19tYW5hZ2VyID0gc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCBIQiwgdGhpcy5jb25zdHJ1Y3RvclxyXG4gIG9wcyA9IG9wc19tYW5hZ2VyLm9wZXJhdGlvbnNcclxuXHJcbiAgZW5naW5lID0gbmV3IEVuZ2luZSBIQiwgb3BzXHJcbiAgYWRhcHRDb25uZWN0b3IgY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBvcHNfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcclxuXHJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuSEIgPSBIQlxyXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLm9wZXJhdGlvbnMgPSBvcHNcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jb25uZWN0b3IgPSBjb25uZWN0b3JcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jdXN0b21fdHlwZXMgPSB0aGlzLmNvbnN0cnVjdG9yXHJcblxyXG4gIGN0ID0gbmV3IGNyZWF0ZVkuT2JqZWN0KClcclxuICBtb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihjdCwgSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxyXG4gIGN0Ll9zZXRNb2RlbCBtb2RlbFxyXG4gIGN0XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcclxuaWYgd2luZG93P1xyXG4gIHdpbmRvdy5ZID0gY3JlYXRlWVxyXG5cclxuY3JlYXRlWS5PYmplY3QgPSByZXF1aXJlIFwiLi9PYmplY3RUeXBlXCJcclxuIl19
