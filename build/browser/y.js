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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkg6XFxHaXRIdWJcXHlqc1xcbm9kZV9tb2R1bGVzXFxndWxwLWJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiSDpcXEdpdEh1YlxceWpzXFxsaWJcXENvbm5lY3RvckFkYXB0ZXIuY29mZmVlIiwiSDpcXEdpdEh1YlxceWpzXFxsaWJcXENvbm5lY3RvckNsYXNzLmNvZmZlZSIsIkg6XFxHaXRIdWJcXHlqc1xcbGliXFxFbmdpbmUuY29mZmVlIiwiSDpcXEdpdEh1YlxceWpzXFxsaWJcXEhpc3RvcnlCdWZmZXIuY29mZmVlIiwiSDpcXEdpdEh1YlxceWpzXFxsaWJcXE9iamVjdFR5cGUuY29mZmVlIiwiSDpcXEdpdEh1YlxceWpzXFxsaWJcXE9wZXJhdGlvbnNcXEJhc2ljLmNvZmZlZSIsIkg6XFxHaXRIdWJcXHlqc1xcbGliXFxPcGVyYXRpb25zXFxTdHJ1Y3R1cmVkLmNvZmZlZSIsIkg6XFxHaXRIdWJcXHlqc1xcbGliXFx5LmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0NBLElBQUEsOEJBQUE7O0FBQUEsY0FBQSxHQUFpQixPQUFBLENBQVEsa0JBQVIsQ0FBakIsQ0FBQTs7QUFBQSxjQU1BLEdBQWlCLFNBQUMsU0FBRCxFQUFZLE1BQVosRUFBb0IsRUFBcEIsRUFBd0Isa0JBQXhCLEdBQUE7QUFFZixNQUFBLHVGQUFBO0FBQUEsT0FBQSxzQkFBQTs2QkFBQTtBQUNFLElBQUEsU0FBVSxDQUFBLElBQUEsQ0FBVixHQUFrQixDQUFsQixDQURGO0FBQUEsR0FBQTtBQUFBLEVBR0EsU0FBUyxDQUFDLGFBQVYsQ0FBQSxDQUhBLENBQUE7QUFBQSxFQUtBLEtBQUEsR0FBUSxTQUFDLENBQUQsR0FBQTtBQUNOLElBQUEsSUFBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixLQUFpQixFQUFFLENBQUMsU0FBSCxDQUFBLENBQWxCLENB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LGNBQVIsQ0FyQ2pCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXHJcbkNvbm5lY3RvckNsYXNzID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQ2xhc3NcIlxyXG4jXHJcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXHJcbiMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxyXG4jIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cclxuI1xyXG5hZGFwdENvbm5lY3RvciA9IChjb25uZWN0b3IsIGVuZ2luZSwgSEIsIGV4ZWN1dGlvbl9saXN0ZW5lciktPlxyXG5cclxuICBmb3IgbmFtZSwgZiBvZiBDb25uZWN0b3JDbGFzc1xyXG4gICAgY29ubmVjdG9yW25hbWVdID0gZlxyXG5cclxuICBjb25uZWN0b3Iuc2V0SXNCb3VuZFRvWSgpXHJcblxyXG4gIHNlbmRfID0gKG8pLT5cclxuICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEhCLmdldFVzZXJJZCgpKSBhbmRcclxuICAgICAgICAodHlwZW9mIG8udWlkLm9wX251bWJlciBpc250IFwic3RyaW5nXCIpIGFuZCAjIFRPRE86IGkgZG9uJ3QgdGhpbmsgdGhhdCB3ZSBuZWVkIHRoaXMgYW55bW9yZS4uXHJcbiAgICAgICAgKEhCLmdldFVzZXJJZCgpIGlzbnQgXCJfdGVtcFwiKVxyXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cclxuXHJcbiAgaWYgY29ubmVjdG9yLmludm9rZVN5bmM/XHJcbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xyXG5cclxuICBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xyXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcclxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxyXG4gIGVuY29kZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxyXG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxyXG4gICAgICB1c2VyOiBuYW1lXHJcbiAgICAgIHN0YXRlOiB2YWx1ZVxyXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XHJcbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxyXG4gICAgZm9yIHMgaW4gdlxyXG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcclxuICAgIHN0YXRlX3ZlY3RvclxyXG5cclxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cclxuICAgIGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXHJcblxyXG4gIGdldEhCID0gKHYpLT5cclxuICAgIHN0YXRlX3ZlY3RvciA9IHBhcnNlX3N0YXRlX3ZlY3RvciB2XHJcbiAgICBoYiA9IEhCLl9lbmNvZGUgc3RhdGVfdmVjdG9yXHJcbiAgICBqc29uID1cclxuICAgICAgaGI6IGhiXHJcbiAgICAgIHN0YXRlX3ZlY3RvcjogZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcclxuICAgIGpzb25cclxuXHJcbiAgYXBwbHlIQiA9IChoYiwgZnJvbUhCKS0+XHJcbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXHJcblxyXG4gIGNvbm5lY3Rvci5nZXRTdGF0ZVZlY3RvciA9IGdldFN0YXRlVmVjdG9yXHJcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcclxuICBjb25uZWN0b3IuYXBwbHlIQiA9IGFwcGx5SEJcclxuXHJcbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMgPz0gW11cclxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycy5wdXNoIChzZW5kZXIsIG9wKS0+XHJcbiAgICBpZiBvcC51aWQuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXHJcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvclxyXG4iLCJcclxubW9kdWxlLmV4cG9ydHMgPVxyXG4gICNcclxuICAjIEBwYXJhbXMgbmV3IENvbm5lY3RvcihvcHRpb25zKVxyXG4gICMgICBAcGFyYW0gb3B0aW9ucy5zeW5jTWV0aG9kIHtTdHJpbmd9ICBpcyBlaXRoZXIgXCJzeW5jQWxsXCIgb3IgXCJtYXN0ZXItc2xhdmVcIi5cclxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxyXG4gICMgICAgICAgICAgICAoc2xhdmUgb3IgbWFzdGVyIChvbmx5IHVzZWQgd2hlbiBzeW5jTWV0aG9kIGlzIG1hc3Rlci1zbGF2ZSkpXHJcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpbiB7Qm9vbGVhbn0gV2hldGVociB0byB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLCBidXQgaGFzIHNvbWUgb3ZlcmhlYWQgKG9wdGlvbmFsKVxyXG4gICNcclxuICBpbml0OiAob3B0aW9ucyktPlxyXG4gICAgcmVxID0gKG5hbWUsIGNob2ljZXMpPT5cclxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cclxuICAgICAgICBpZiAobm90IGNob2ljZXM/KSBvciBjaG9pY2VzLnNvbWUoKGMpLT5jIGlzIG9wdGlvbnNbbmFtZV0pXHJcbiAgICAgICAgICBAW25hbWVdID0gb3B0aW9uc1tuYW1lXVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4gc2V0IHRoZSAnXCIrbmFtZStcIicgb3B0aW9uIHRvIG9uZSBvZiB0aGUgZm9sbG93aW5nIGNob2ljZXM6IFwiK0pTT04uZW5jb2RlKGNob2ljZXMpXHJcbiAgICAgIGVsc2VcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcclxuXHJcbiAgICByZXEgXCJzeW5jTWV0aG9kXCIsIFtcInN5bmNBbGxcIiwgXCJtYXN0ZXItc2xhdmVcIl1cclxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cclxuICAgIHJlcSBcInVzZXJfaWRcIlxyXG4gICAgQG9uX3VzZXJfaWRfc2V0PyhAdXNlcl9pZClcclxuXHJcbiAgICAjIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMuXHJcbiAgICAjIEJ1dCB0aGlzIGlzIG5vdCBuZWNlc3NhcnkgaW4gdGhlIHRlc3QtY29ubmVjdG9yXHJcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cclxuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluXHJcbiAgICBlbHNlXHJcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXHJcblxyXG4gICAgIyBBIE1hc3RlciBzaG91bGQgc3luYyB3aXRoIGV2ZXJ5b25lISBUT0RPOiByZWFsbHk/IC0gZm9yIG5vdyBpdHMgc2FmZXIgdGhpcyB3YXkhXHJcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXHJcbiAgICAgIEBzeW5jTWV0aG9kID0gXCJzeW5jQWxsXCJcclxuXHJcbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcclxuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxyXG4gICAgIyBQZWVyanMgQ29ubmVjdGlvbnM6IGtleTogY29ubi1pZCwgdmFsdWU6IG9iamVjdFxyXG4gICAgQGNvbm5lY3Rpb25zID0ge31cclxuICAgICMgTGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBzaGFsbCBwcm9jZXNzIGluY29taW5nIGRhdGFcclxuICAgIEByZWNlaXZlX2hhbmRsZXJzID89IFtdXHJcblxyXG4gICAgIyB3aGV0aGVyIHRoaXMgaW5zdGFuY2UgaXMgYm91bmQgdG8gYW55IHkgaW5zdGFuY2VcclxuICAgIEBjb25uZWN0aW9ucyA9IHt9XHJcbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcclxuICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IGZhbHNlXHJcbiAgICBAaXNfaW5pdGlhbGl6ZWQgPSB0cnVlXHJcblxyXG4gIGlzUm9sZU1hc3RlcjogLT5cclxuICAgIEByb2xlIGlzIFwibWFzdGVyXCJcclxuXHJcbiAgaXNSb2xlU2xhdmU6IC0+XHJcbiAgICBAcm9sZSBpcyBcInNsYXZlXCJcclxuXHJcbiAgZmluZE5ld1N5bmNUYXJnZXQ6ICgpLT5cclxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxyXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcclxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXHJcbiAgICAgICAgaWYgbm90IGMuaXNfc3luY2VkXHJcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxyXG4gICAgICAgICAgYnJlYWtcclxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cclxuICAgICAgQHNldFN0YXRlU3luY2VkKClcclxuICAgIG51bGxcclxuXHJcbiAgdXNlckxlZnQ6ICh1c2VyKS0+XHJcbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXHJcbiAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxyXG5cclxuICB1c2VySm9pbmVkOiAodXNlciwgcm9sZSktPlxyXG4gICAgaWYgbm90IHJvbGU/XHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkludGVybmFsOiBZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEgRS5nLiB1c2VySm9pbmVkKCd1aWQ6MzkzOScsJ3NsYXZlJylcIlxyXG4gICAgIyBhIHVzZXIgam9pbmVkIHRoZSByb29tXHJcbiAgICBAY29ubmVjdGlvbnNbdXNlcl0gPz0ge31cclxuICAgIEBjb25uZWN0aW9uc1t1c2VyXS5pc19zeW5jZWQgPSBmYWxzZVxyXG5cclxuICAgIGlmIChub3QgQGlzX3N5bmNlZCkgb3IgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcclxuICAgICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcclxuICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxyXG4gICAgICAgICMgVE9ETzogV2hhdCBpZiB0aGVyZSBhcmUgdHdvIG1hc3RlcnM/IFByZXZlbnQgc2VuZGluZyBldmVyeXRoaW5nIHR3byB0aW1lcyFcclxuICAgICAgICBAcGVyZm9ybVN5bmNXaXRoTWFzdGVyIHVzZXJcclxuXHJcblxyXG4gICNcclxuICAjIEV4ZWN1dGUgYSBmdW5jdGlvbiBfd2hlbl8gd2UgYXJlIGNvbm5lY3RlZC4gSWYgbm90IGNvbm5lY3RlZCwgd2FpdCB1bnRpbCBjb25uZWN0ZWQuXHJcbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC5cclxuICAjXHJcbiAgd2hlblN5bmNlZDogKGFyZ3MpLT5cclxuICAgIGlmIGFyZ3MuY29uc3RydWN0b3JlIGlzIEZ1bmN0aW9uXHJcbiAgICAgIGFyZ3MgPSBbYXJnc11cclxuICAgIGlmIEBpc19zeW5jZWRcclxuICAgICAgYXJnc1swXS5hcHBseSB0aGlzLCBhcmdzWzEuLl1cclxuICAgIGVsc2VcclxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cclxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQucHVzaCBhcmdzXHJcblxyXG4gICNcclxuICAjIEV4ZWN1dGUgYW4gZnVuY3Rpb24gd2hlbiBhIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXHJcbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC4gZiB3aWxsIGJlIGNhbGxlZCB3aXRoIChzZW5kZXJfaWQsIGJyb2FkY2FzdCB7dHJ1ZXxmYWxzZX0sIG1lc3NhZ2UpLlxyXG4gICNcclxuICBvblJlY2VpdmU6IChmKS0+XHJcbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcclxuXHJcbiAgIyMjXHJcbiAgIyBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBjb25uZWN0ZWQgcGVlcnMuXHJcbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXHJcbiAgI1xyXG4gIGJyb2FkY2FzdDogKG1lc3NhZ2UpLT5cclxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcclxuXHJcbiAgI1xyXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcclxuICAjXHJcbiAgc2VuZDogKHBlZXJfcywgbWVzc2FnZSktPlxyXG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcclxuICAjIyNcclxuXHJcbiAgI1xyXG4gICMgcGVyZm9ybSBhIHN5bmMgd2l0aCBhIHNwZWNpZmljIHVzZXIuXHJcbiAgI1xyXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxyXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xyXG4gICAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcclxuICAgICAgQHNlbmQgdXNlcixcclxuICAgICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxyXG4gICAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXHJcbiAgICAgICAgZGF0YTogW10gIyBAZ2V0U3RhdGVWZWN0b3IoKVxyXG4gICAgICBpZiBub3QgQHNlbnRfaGJfdG9fYWxsX3VzZXJzXHJcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxyXG5cclxuICAgICAgICBoYiA9IEBnZXRIQihbXSkuaGJcclxuICAgICAgICBfaGIgPSBbXVxyXG4gICAgICAgIGZvciBvIGluIGhiXHJcbiAgICAgICAgICBfaGIucHVzaCBvXHJcbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcclxuICAgICAgICAgICAgQGJyb2FkY2FzdFxyXG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXHJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXHJcbiAgICAgICAgICAgIF9oYiA9IFtdXHJcbiAgICAgICAgQGJyb2FkY2FzdFxyXG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxyXG4gICAgICAgICAgZGF0YTogX2hiXHJcblxyXG5cclxuXHJcbiAgI1xyXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcclxuICAjIGFuZCB3aWxsIGJyb2FkY2FzdCBoaXMgb3duIEhCXHJcbiAgI1xyXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cclxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxyXG4gICAgQHNlbmQgdXNlcixcclxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcclxuICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcclxuICAgICAgZGF0YTogW11cclxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxyXG4gICAgX2hiID0gW11cclxuICAgIGZvciBvIGluIGhiXHJcbiAgICAgIF9oYi5wdXNoIG9cclxuICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXHJcbiAgICAgICAgQGJyb2FkY2FzdFxyXG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcclxuICAgICAgICAgIGRhdGE6IF9oYlxyXG4gICAgICAgIF9oYiA9IFtdXHJcbiAgICBAYnJvYWRjYXN0XHJcbiAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcclxuICAgICAgZGF0YTogX2hiXHJcblxyXG4gICNcclxuICAjIFlvdSBhcmUgc3VyZSB0aGF0IGFsbCBjbGllbnRzIGFyZSBzeW5jZWQsIGNhbGwgdGhpcyBmdW5jdGlvbi5cclxuICAjXHJcbiAgc2V0U3RhdGVTeW5jZWQ6ICgpLT5cclxuICAgIGlmIG5vdCBAaXNfc3luY2VkXHJcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXHJcbiAgICAgIGlmIEBjb21wdXRlX3doZW5fc3luY2VkP1xyXG4gICAgICAgIGZvciBmIGluIEBjb21wdXRlX3doZW5fc3luY2VkXHJcbiAgICAgICAgICBmKClcclxuICAgICAgICBkZWxldGUgQGNvbXB1dGVfd2hlbl9zeW5jZWRcclxuICAgICAgbnVsbFxyXG5cclxuICAjXHJcbiAgIyBZb3UgcmVjZWl2ZWQgYSByYXcgbWVzc2FnZSwgYW5kIHlvdSBrbm93IHRoYXQgaXQgaXMgaW50ZW5kZWQgZm9yIHRvIFlqcy4gVGhlbiBjYWxsIHRoaXMgZnVuY3Rpb24uXHJcbiAgI1xyXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cclxuICAgIGlmIG5vdCByZXMuc3luY19zdGVwP1xyXG4gICAgICBmb3IgZiBpbiBAcmVjZWl2ZV9oYW5kbGVyc1xyXG4gICAgICAgIGYgc2VuZGVyLCByZXNcclxuICAgIGVsc2VcclxuICAgICAgaWYgc2VuZGVyIGlzIEB1c2VyX2lkXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJnZXRIQlwiXHJcbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcclxuICAgICAgICBoYiA9IGRhdGEuaGJcclxuICAgICAgICBfaGIgPSBbXVxyXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxyXG4gICAgICAgICMgVGhpcyByZWR1Y2VzIGVycm9ycywgd2hlbiB0aGUgY2xpZW50cyBnb2VzIG9mZmxpbmUgcHJlbWF0dXJlbHkuXHJcbiAgICAgICAgIyBXaGVuIHRoaXMgY2xpZW50IG9ubHkgc3luY3MgdG8gb25lIG90aGVyIGNsaWVudHMsIGJ1dCBsb29zZXMgY29ubmVjdG9ycyxcclxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxyXG4gICAgICAgICMgU2luY2Ugd2UgZG8gbm90IHdhbnQgdG8gcGVyZm9ybSByZWd1bGFyIHN5bmNzLCB0aGlzIGlzIGEgZ29vZCBhbHRlcm5hdGl2ZVxyXG4gICAgICAgIGlmIEBpc19zeW5jZWRcclxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cclxuICAgICAgICAgICAgQHNlbmQgc2VuZGVyLCBtXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxyXG4gICAgICAgICAgICBAYnJvYWRjYXN0IG1cclxuXHJcbiAgICAgICAgZm9yIG8gaW4gaGJcclxuICAgICAgICAgIF9oYi5wdXNoIG9cclxuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxyXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxyXG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXHJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXHJcbiAgICAgICAgICAgIF9oYiA9IFtdXHJcblxyXG4gICAgICAgIHNlbmRBcHBseUhCXHJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxyXG4gICAgICAgICAgZGF0YTogX2hiXHJcblxyXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxyXG4gICAgICAgICAgc2VuZF9hZ2FpbiA9IGRvIChzdiA9IGRhdGEuc3RhdGVfdmVjdG9yKT0+XHJcbiAgICAgICAgICAgICgpPT5cclxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcclxuICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXHJcbiAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogaGJcclxuICAgICAgICAgICAgICAgIHNlbnRfYWdhaW46IFwidHJ1ZVwiXHJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcclxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQlwiXHJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcclxuXHJcbiAgICAgICAgaWYgKEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiIG9yIHJlcy5zZW50X2FnYWluPykgYW5kIChub3QgQGlzX3N5bmNlZCkgYW5kICgoQGN1cnJlbnRfc3luY190YXJnZXQgaXMgc2VuZGVyKSBvciAobm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0PykpXHJcbiAgICAgICAgICBAY29ubmVjdGlvbnNbc2VuZGVyXS5pc19zeW5jZWQgPSB0cnVlXHJcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxyXG5cclxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQl9cIlxyXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXHJcblxyXG5cclxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxyXG4gICMgdGhhdCB3YXkuIE1heWJlIHdlIHN1cHBvcnQgZW5jb2RpbmcgaW4gdGhlIEhCIGFzIFhNTCBpbiB0aGUgZnV0dXJlLCBidXQgZm9yIG5vdyBJIGRvbid0IHdhbnRcclxuICAjIHRvbyBtdWNoIG92ZXJoZWFkLiBZIGlzIHZlcnkgbGlrZWx5IHRvIGdldCBjaGFuZ2VkIGEgbG90IGluIHRoZSBmdXR1cmVcclxuICAjXHJcbiAgIyBCZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gZW5jb2RlIEpTT04gYXMgc3RyaW5nICh3aXRoIGNoYXJhY3RlciBlc2NhcGluZywgd2ljaCBtYWtlcyBpdCBwcmV0dHkgbXVjaCB1bnJlYWRhYmxlKVxyXG4gICMgd2UgZW5jb2RlIHRoZSBKU09OIGFzIFhNTC5cclxuICAjXHJcbiAgIyBXaGVuIHRoZSBIQiBzdXBwb3J0IGVuY29kaW5nIGFzIFhNTCwgdGhlIGZvcm1hdCBzaG91bGQgbG9vayBwcmV0dHkgbXVjaCBsaWtlIHRoaXMuXHJcblxyXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXHJcbiAgIyBleHBlY3RzIGFuIGx0eCAobGVzcyB0aGFuIHhtbCkgb2JqZWN0XHJcbiAgcGFyc2VNZXNzYWdlRnJvbVhtbDogKG0pLT5cclxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cclxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxyXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxyXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHBhcnNlX29iamVjdCBuXHJcblxyXG4gICAgcGFyc2Vfb2JqZWN0ID0gKG5vZGUpLT5cclxuICAgICAganNvbiA9IHt9XHJcbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xyXG4gICAgICAgIGludCA9IHBhcnNlSW50KHZhbHVlKVxyXG4gICAgICAgIGlmIGlzTmFOKGludCkgb3IgKFwiXCIraW50KSBpc250IHZhbHVlXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gaW50XHJcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cclxuICAgICAgICBuYW1lID0gbi5uYW1lXHJcbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXHJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9vYmplY3QgblxyXG4gICAgICBqc29uXHJcbiAgICBwYXJzZV9vYmplY3QgbVxyXG5cclxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxyXG4gICMgd2UgdXNlIHN0cmluZyBiZWNhdXNlIFN0cm9waGUgb25seSBhY2NlcHRzIGFuIFwieG1sLXN0cmluZ1wiLi5cclxuICAjIFNvIHthOjQsYjp7Yzo1fX0gd2lsbCBsb29rIGxpa2VcclxuICAjIDx5IGE9XCI0XCI+XHJcbiAgIyAgIDxiIGM9XCI1XCI+PC9iPlxyXG4gICMgPC95PlxyXG4gICMgbSAtIGx0eCBlbGVtZW50XHJcbiAgIyBqc29uIC0gZ3Vlc3MgaXQgOylcclxuICAjXHJcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxyXG4gICAgIyBhdHRyaWJ1dGVzIGlzIG9wdGlvbmFsXHJcbiAgICBlbmNvZGVfb2JqZWN0ID0gKG0sIGpzb24pLT5cclxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxyXG4gICAgICAgIGlmIG5vdCB2YWx1ZT9cclxuICAgICAgICAgICMgbm9wXHJcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKG5hbWUpLCB2YWx1ZVxyXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgQXJyYXlcclxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgbS5zZXRBdHRyaWJ1dGUobmFtZSx2YWx1ZSlcclxuICAgICAgbVxyXG4gICAgZW5jb2RlX2FycmF5ID0gKG0sIGFycmF5KS0+XHJcbiAgICAgIG0uc2V0QXR0cmlidXRlKFwiaXNBcnJheVwiLFwidHJ1ZVwiKVxyXG4gICAgICBmb3IgZSBpbiBhcnJheVxyXG4gICAgICAgIGlmIGUuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxyXG4gICAgICBtXHJcbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxyXG4gICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxyXG4gICAgZWxzZSBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIEFycmF5XHJcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cclxuICAgIGVsc2VcclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSSBjYW4ndCBlbmNvZGUgdGhpcyBqc29uIVwiXHJcblxyXG4gIHNldElzQm91bmRUb1k6ICgpLT5cclxuICAgIEBvbl9ib3VuZF90b195PygpXHJcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxyXG4gICAgQGlzX2JvdW5kX3RvX3kgPSB0cnVlXHJcbiIsIlxyXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcclxud2luZG93Py51bnByb2Nlc3NlZF9leGVjX2NvdW50ZXIgPSAwICMgVE9ET1xyXG53aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzID0gW11cclxuXHJcbiNcclxuIyBAbm9kb2NcclxuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxyXG4jXHJcbmNsYXNzIEVuZ2luZVxyXG5cclxuICAjXHJcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXHJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcclxuICAjXHJcbiAgY29uc3RydWN0b3I6IChASEIsIEB0eXBlcyktPlxyXG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXHJcblxyXG4gICNcclxuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxyXG4gICNcclxuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cclxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxyXG4gICAgaWYgdHlwZT8ucGFyc2U/XHJcbiAgICAgIHR5cGUucGFyc2UganNvblxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXHJcblxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxyXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXHJcbiAgIyMjXHJcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxyXG4gICAgb3BzID0gW11cclxuICAgIGZvciBvIGluIG9wc19qc29uXHJcbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXHJcbiAgICBmb3IgbyBpbiBvcHNcclxuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcbiAgIyMjXHJcblxyXG4gICNcclxuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxyXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcclxuICAjXHJcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBAYXBwbHlPcCBvcHNfanNvblxyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXHJcbiAgIyBUT0RPOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhIVxyXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXHJcbiAgIyAtIHlvdSBjYW4gcHJvYmFibHkgbWFrZSBzb21ldGhpbmcgbGlrZSBkZXBlbmRlbmNpZXMgKGNyZWF0b3IxIHdhaXRzIGZvciBjcmVhdG9yMilcclxuICBhcHBseU9wOiAob3BfanNvbl9hcnJheSwgZnJvbUhCID0gZmFsc2UpLT5cclxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxyXG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXHJcbiAgICBmb3Igb3BfanNvbiBpbiBvcF9qc29uX2FycmF5XHJcbiAgICAgIGlmIGZyb21IQlxyXG4gICAgICAgIG9wX2pzb24uZnJvbUhCID0gXCJ0cnVlXCIgIyBleGVjdXRlIGltbWVkaWF0ZWx5LCBpZlxyXG4gICAgICAjICRwYXJzZV9hbmRfZXhlY3V0ZSB3aWxsIHJldHVybiBmYWxzZSBpZiAkb19qc29uIHdhcyBwYXJzZWQgYW5kIGV4ZWN1dGVkLCBvdGhlcndpc2UgdGhlIHBhcnNlZCBvcGVyYWRpb25cclxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICAgIG8ucGFyc2VkX2Zyb21fanNvbiA9IG9wX2pzb25cclxuICAgICAgaWYgb3BfanNvbi5mcm9tSEI/XHJcbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxyXG4gICAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG8pP1xyXG4gICAgICAgICMgbm9wXHJcbiAgICAgIGVsc2UgaWYgKChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykpIG9yIChub3Qgby5leGVjdXRlKCkpXHJcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcclxuICAgIEB0cnlVbnByb2Nlc3NlZCgpXHJcblxyXG4gICNcclxuICAjIENhbGwgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYXBwbGllZCBhIG5ldyBvcGVyYXRpb24uXHJcbiAgIyBJdCBjaGVja3MgaWYgb3BlcmF0aW9ucyB0aGF0IHdlcmUgcHJldmlvdXNseSBub3QgZXhlY3V0YWJsZSBhcmUgbm93IGV4ZWN1dGFibGUuXHJcbiAgI1xyXG4gIHRyeVVucHJvY2Vzc2VkOiAoKS0+XHJcbiAgICB3aGlsZSB0cnVlXHJcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxyXG4gICAgICB1bnByb2Nlc3NlZCA9IFtdXHJcbiAgICAgIGZvciBvcCBpbiBAdW5wcm9jZXNzZWRfb3BzXHJcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XHJcbiAgICAgICAgICAjIG5vcFxyXG4gICAgICAgIGVsc2UgaWYgKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvcCkgYW5kIChub3Qgb3AuZnJvbUhCPykpIG9yIChub3Qgb3AuZXhlY3V0ZSgpKVxyXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxyXG4gICAgICBAdW5wcm9jZXNzZWRfb3BzID0gdW5wcm9jZXNzZWRcclxuICAgICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXMgb2xkX2xlbmd0aFxyXG4gICAgICAgIGJyZWFrXHJcbiAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpc250IDBcclxuICAgICAgQEhCLmludm9rZVN5bmMoKVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiIsIlxyXG4jXHJcbiMgQG5vZG9jXHJcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cclxuI1xyXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxyXG4jXHJcbmNsYXNzIEhpc3RvcnlCdWZmZXJcclxuXHJcbiAgI1xyXG4gICMgQ3JlYXRlcyBhbiBlbXB0eSBIQi5cclxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxyXG4gICNcclxuICBjb25zdHJ1Y3RvcjogKEB1c2VyX2lkKS0+XHJcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxyXG4gICAgQGJ1ZmZlciA9IHt9XHJcbiAgICBAY2hhbmdlX2xpc3RlbmVycyA9IFtdXHJcbiAgICBAZ2FyYmFnZSA9IFtdICMgV2lsbCBiZSBjbGVhbmVkIG9uIG5leHQgY2FsbCBvZiBnYXJiYWdlQ29sbGVjdG9yXHJcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cclxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSB0cnVlXHJcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gMzAwMDBcclxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXHJcbiAgICBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcclxuXHJcbiAgcmVzZXRVc2VySWQ6IChpZCktPlxyXG4gICAgb3duID0gQGJ1ZmZlcltAdXNlcl9pZF1cclxuICAgIGlmIG93bj9cclxuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxyXG4gICAgICAgIGlmIG8udWlkLmNyZWF0b3I/XHJcbiAgICAgICAgICBvLnVpZC5jcmVhdG9yID0gaWRcclxuICAgICAgICBpZiBvLnVpZC5hbHQ/XHJcbiAgICAgICAgICBvLnVpZC5hbHQuY3JlYXRvciA9IGlkXHJcbiAgICAgIGlmIEBidWZmZXJbaWRdP1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcclxuICAgICAgQGJ1ZmZlcltpZF0gPSBvd25cclxuICAgICAgZGVsZXRlIEBidWZmZXJbQHVzZXJfaWRdXHJcbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xyXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxyXG4gICAgICBkZWxldGUgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxyXG4gICAgQHVzZXJfaWQgPSBpZFxyXG5cclxuICBlbXB0eUdhcmJhZ2U6ICgpPT5cclxuICAgIGZvciBvIGluIEBnYXJiYWdlXHJcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxyXG4gICAgICBvLmNsZWFudXA/KClcclxuXHJcbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxyXG4gICAgQHRyYXNoID0gW11cclxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxyXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcclxuICAgIHVuZGVmaW5lZFxyXG5cclxuICAjXHJcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXHJcbiAgI1xyXG4gIGdldFVzZXJJZDogKCktPlxyXG4gICAgQHVzZXJfaWRcclxuXHJcbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XHJcbiAgICBpZiBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uXHJcbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xyXG4gICAgICAgIGlmIG8/XHJcbiAgICAgICAgICBAZ2FyYmFnZS5wdXNoIG9cclxuXHJcbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XHJcbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gZmFsc2VcclxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXHJcbiAgICBAZ2FyYmFnZSA9IFtdXHJcbiAgICBAdHJhc2ggPSBbXVxyXG5cclxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxyXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IC0xXHJcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXHJcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcclxuXHJcbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxyXG5cclxuICAjXHJcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXHJcbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cclxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cclxuICAjXHJcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XHJcbiAgICB7XHJcbiAgICAgIGNyZWF0b3IgOiAnXydcclxuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcclxuICAgIH1cclxuXHJcbiAgI1xyXG4gICMgR2V0IHRoZSBvcGVyYXRpb24gY291bnRlciB0aGF0IGRlc2NyaWJlcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgZG9jdW1lbnQuXHJcbiAgI1xyXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XHJcbiAgICBpZiBub3QgdXNlcl9pZD9cclxuICAgICAgcmVzID0ge31cclxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxyXG4gICAgICAgIHJlc1t1c2VyXSA9IGN0blxyXG4gICAgICByZXNcclxuICAgIGVsc2VcclxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXHJcblxyXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XHJcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxyXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxyXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XHJcblxyXG4gICNcclxuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXHJcbiAgIyBUT0RPOiBNYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhXHJcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxyXG4gICAganNvbiA9IFtdXHJcbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XHJcbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxyXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcclxuXHJcbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxyXG4gICAgICAjIFRPRE8gbmV4dCwgaWYgQHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBzdGF0ZV92ZWN0b3JbdXNlcl1cclxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXHJcbiAgICAgICAgY29udGludWVcclxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxyXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXHJcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxyXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcclxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXHJcbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxyXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcclxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxyXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxyXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcclxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXHJcbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxyXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcclxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxyXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxyXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxyXG5cclxuICAgIGpzb25cclxuXHJcbiAgI1xyXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXHJcbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxyXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXHJcbiAgI1xyXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxyXG4gICAgaWYgbm90IHVzZXJfaWQ/XHJcbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxyXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cclxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxyXG4gICAgdWlkID1cclxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxyXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxyXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdKytcclxuICAgIHVpZFxyXG5cclxuICAjXHJcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cclxuICAjXHJcbiAgIyB3aGVuIHVpZCBoYXMgYSBcInN1YlwiIHByb3BlcnR5LCB0aGUgdmFsdWUgb2YgaXQgd2lsbCBiZSBhcHBsaWVkXHJcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXHJcbiAgI1xyXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxyXG4gICAgaWYgdWlkLnVpZD9cclxuICAgICAgdWlkID0gdWlkLnVpZFxyXG4gICAgbyA9IEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxyXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XHJcbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxyXG4gICAgZWxzZVxyXG4gICAgICBvXHJcblxyXG4gICNcclxuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcclxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXHJcbiAgI1xyXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cclxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xyXG4gICAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdID0ge31cclxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXHJcbiAgICBpZiAoby51aWQub3BfbnVtYmVyLmNvbnN0cnVjdG9yIGlzbnQgU3RyaW5nKSBhbmQgKG5vdCBAaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgYW5kIChub3Qgby5mcm9tSEI/KSAjIHlvdSBhbHJlYWR5IGRvIHRoaXMgaW4gdGhlIGVuZ2luZSwgc28gZGVsZXRlIGl0IGhlcmUhXHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcclxuICAgIEBhZGRUb0NvdW50ZXIobylcclxuICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXSA9IG9cclxuICAgIG9cclxuXHJcbiAgcmVtb3ZlT3BlcmF0aW9uOiAobyktPlxyXG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cclxuXHJcbiAgIyBXaGVuIHRoZSBIQiBkZXRlcm1pbmVzIGluY29uc2lzdGVuY2llcywgdGhlbiB0aGUgaW52b2tlU3luY1xyXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cclxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxyXG4gIHNldEludm9rZVN5bmNIYW5kbGVyOiAoZiktPlxyXG4gICAgQGludm9rZVN5bmMgPSBmXHJcblxyXG4gICMgZW1wdHkgcGVyIGRlZmF1bHQgIyBUT0RPOiBkbyBpIG5lZWQgdGhpcz9cclxuICBpbnZva2VTeW5jOiAoKS0+XHJcblxyXG4gICMgYWZ0ZXIgeW91IHJlY2VpdmVkIHRoZSBIQiBvZiBhbm90aGVyIHVzZXIgKGluIHRoZSBzeW5jIHByb2Nlc3MpLFxyXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXHJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxyXG4gICAgZm9yIHVzZXIsc3RhdGUgb2Ygc3RhdGVfdmVjdG9yXHJcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xyXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxyXG5cclxuICAjXHJcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxyXG4gICNcclxuICBhZGRUb0NvdW50ZXI6IChvKS0+XHJcbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxyXG4gICAgaWYgby51aWQuY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxyXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxyXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXHJcbiAgICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cclxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXHJcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIC0gKG8udWlkLm9wX251bWJlciArIDEpKVxyXG4gICAgICAjY29uc29sZS5sb2cgb1xyXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcclxuIiwiXHJcbmNsYXNzIFlPYmplY3RcclxuXHJcbiAgY29uc3RydWN0b3I6IChAX29iamVjdCA9IHt9KS0+XHJcbiAgICBpZiBAX29iamVjdC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgZm9yIG5hbWUsIHZhbCBvZiBAX29iamVjdFxyXG4gICAgICAgIGlmIHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcclxuICAgICAgICAgIEBfb2JqZWN0W25hbWVdID0gbmV3IFlPYmplY3QodmFsKVxyXG4gICAgZWxzZVxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZLk9iamVjdCBhY2NlcHRzIEpzb24gT2JqZWN0cyBvbmx5XCJcclxuXHJcbiAgX25hbWU6IFwiT2JqZWN0XCJcclxuXHJcbiAgX2dldE1vZGVsOiAodHlwZXMsIG9wcyktPlxyXG4gICAgaWYgbm90IEBfbW9kZWw/XHJcbiAgICAgIEBfbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoQCkuZXhlY3V0ZSgpXHJcbiAgICAgIGZvciBuLG8gb2YgQF9vYmplY3RcclxuICAgICAgICBAX21vZGVsLnZhbCBuLCBvXHJcbiAgICBkZWxldGUgQF9vYmplY3RcclxuICAgIEBfbW9kZWxcclxuXHJcbiAgX3NldE1vZGVsOiAoQF9tb2RlbCktPlxyXG4gICAgZGVsZXRlIEBfb2JqZWN0XHJcblxyXG4gIG9ic2VydmU6IChmKS0+XHJcbiAgICBAX21vZGVsLm9ic2VydmUgZlxyXG4gICAgQFxyXG5cclxuICB1bm9ic2VydmU6IChmKS0+XHJcbiAgICBAX21vZGVsLnVub2JzZXJ2ZSBmXHJcbiAgICBAXHJcblxyXG4gICNcclxuICAjIEBvdmVybG9hZCB2YWwoKVxyXG4gICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxyXG4gICMgICBAcmV0dXJuIFtKc29uXVxyXG4gICNcclxuICAjIEBvdmVybG9hZCB2YWwobmFtZSlcclxuICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXHJcbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cclxuICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGV8fFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cclxuICAjXHJcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXHJcbiAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cclxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxyXG4gICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxyXG4gICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcclxuICAjXHJcbiAgdmFsOiAobmFtZSwgY29udGVudCktPlxyXG4gICAgaWYgQF9tb2RlbD9cclxuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXHJcbiAgICBlbHNlXHJcbiAgICAgIGlmIGNvbnRlbnQ/XHJcbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XHJcbiAgICAgIGVsc2UgaWYgbmFtZT9cclxuICAgICAgICBAX29iamVjdFtuYW1lXVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgcmVzID0ge31cclxuICAgICAgICBmb3Igbix2IG9mIEBfb2JqZWN0XHJcbiAgICAgICAgICByZXNbbl0gPSB2XHJcbiAgICAgICAgcmVzXHJcblxyXG4gIGRlbGV0ZTogKG5hbWUpLT5cclxuICAgIEBfbW9kZWwuZGVsZXRlKG5hbWUpXHJcbiAgICBAXHJcblxyXG5pZiB3aW5kb3c/XHJcbiAgaWYgd2luZG93Llk/XHJcbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XHJcbiAgZWxzZVxyXG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZmlyc3QgaW1wb3J0IFkhXCJcclxuXHJcbmlmIG1vZHVsZT9cclxuICBtb2R1bGUuZXhwb3J0cyA9IFlPYmplY3RcclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9ICgpLT5cclxuICAjIEBzZWUgRW5naW5lLnBhcnNlXHJcbiAgb3BzID0ge31cclxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxyXG5cclxuICAjXHJcbiAgIyBAcHJpdmF0ZVxyXG4gICMgQGFic3RyYWN0XHJcbiAgIyBAbm9kb2NcclxuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BzLlxyXG4gICNcclxuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxyXG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXHJcbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXHJcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcclxuICAjXHJcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cclxuICAjXHJcbiAgY2xhc3Mgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLlxyXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XHJcbiAgICAgIGlmIGN1c3RvbV90eXBlP1xyXG4gICAgICAgIEBjdXN0b21fdHlwZSA9IGN1c3RvbV90eXBlXHJcbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcclxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcclxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XHJcbiAgICAgIGlmIHVpZD9cclxuICAgICAgICBAdWlkID0gdWlkXHJcblxyXG4gICAgICAjIHNlZSBlbmNvZGUgdG8gc2VlLCB3aHkgd2UgYXJlIGRvaW5nIGl0IHRoaXMgd2F5XHJcbiAgICAgIGlmIGNvbnRlbnQgaXMgdW5kZWZpbmVkXHJcbiAgICAgICAgIyBub3BcclxuICAgICAgZWxzZSBpZiBjb250ZW50PyBhbmQgY29udGVudC5jcmVhdG9yP1xyXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgQGNvbnRlbnQgPSBjb250ZW50XHJcbiAgICAgIGlmIGNvbnRlbnRfb3BlcmF0aW9ucz9cclxuICAgICAgICBAY29udGVudF9vcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbmFtZSwgb3Agb2YgY29udGVudF9vcGVyYXRpb25zXHJcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuYW1lLCBvcCwgJ2NvbnRlbnRfb3BlcmF0aW9ucydcclxuXHJcbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXHJcblxyXG4gICAgZ2V0Q29udGVudDogKG5hbWUpLT5cclxuICAgICAgaWYgQGNvbnRlbnQ/XHJcbiAgICAgICAgaWYgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZT9cclxuICAgICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxyXG4gICAgICAgIGVsc2UgaWYgQGNvbnRlbnQuY29uc3RydWN0b3IgaXMgT2JqZWN0XHJcbiAgICAgICAgICBpZiBuYW1lP1xyXG4gICAgICAgICAgICBpZiBAY29udGVudFtuYW1lXT9cclxuICAgICAgICAgICAgICBAY29udGVudFtuYW1lXVxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9uc1tuYW1lXS5nZXRDdXN0b21UeXBlKClcclxuICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgY29udGVudCA9IHt9XHJcbiAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRcclxuICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxyXG4gICAgICAgICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xyXG4gICAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xyXG4gICAgICAgICAgICAgICAgdiA9IHYuZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxyXG4gICAgICAgICAgICBjb250ZW50XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgQGNvbnRlbnRcclxuICAgICAgZWxzZVxyXG4gICAgICAgIEBjb250ZW50XHJcblxyXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cclxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxyXG5cclxuICAgICNcclxuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXHJcbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cclxuICAgICNcclxuICAgIG9ic2VydmU6IChmKS0+XHJcbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXHJcblxyXG4gICAgI1xyXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcclxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxyXG4gICAgI1xyXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxyXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZVxyXG4gICAgdW5vYnNlcnZlOiAoZiktPlxyXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cclxuICAgICAgICBmIGlzbnQgZ1xyXG5cclxuICAgICNcclxuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXHJcbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxyXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXHJcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxyXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XHJcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxyXG5cclxuICAgIGRlbGV0ZTogKCktPlxyXG4gICAgICAobmV3IG9wcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcclxuICAgICAgbnVsbFxyXG5cclxuICAgICNcclxuICAgICMgRmlyZSBhbiBldmVudC5cclxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXHJcbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XHJcbiAgICBjYWxsRXZlbnQ6ICgpLT5cclxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xyXG4gICAgICAgIGNhbGxvbiA9IEBnZXRDdXN0b21UeXBlKClcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGNhbGxvbiA9IEBcclxuICAgICAgQGZvcndhcmRFdmVudCBjYWxsb24sIGFyZ3VtZW50cy4uLlxyXG5cclxuICAgICNcclxuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxyXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cclxuICAgIGZvcndhcmRFdmVudDogKG9wLCBhcmdzLi4uKS0+XHJcbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcclxuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cclxuXHJcbiAgICBpc0RlbGV0ZWQ6ICgpLT5cclxuICAgICAgQGlzX2RlbGV0ZWRcclxuXHJcbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxyXG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXHJcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcclxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcclxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxyXG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxyXG4gICAgICAgICAgQEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXHJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxyXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcclxuXHJcbiAgICAjXHJcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxyXG4gICAgI1xyXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxyXG5cclxuICAgICNcclxuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRQYXJlbnQ6ICgpLT5cclxuICAgICAgQHBhcmVudFxyXG5cclxuICAgICNcclxuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXHJcbiAgICAjXHJcbiAgICBnZXRVaWQ6ICgpLT5cclxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XHJcbiAgICAgICAgQHVpZFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXHJcbiAgICAgICAgICBtYXBfdWlkID0gQHVpZC5hbHQuY2xvbmVVaWQoKVxyXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxyXG4gICAgICAgICAgbWFwX3VpZFxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGNsb25lVWlkOiAoKS0+XHJcbiAgICAgIHVpZCA9IHt9XHJcbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXHJcbiAgICAgICAgdWlkW25dID0gdlxyXG4gICAgICB1aWRcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXHJcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxyXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxyXG4gICAgI1xyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxyXG4gICAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcclxuICAgICAgICBpZiBub3QgQHVpZD9cclxuICAgICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxyXG4gICAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cclxuICAgICAgICAgICMgaXMgZXhlY3V0ZWQgKGJlY2F1c2Ugd2UgbmVlZCB0aGUgY3JlYXRvcl9pZClcclxuICAgICAgICAgIEB1aWQgPSBASEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxyXG4gICAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xyXG4gICAgICAgICAgQEhCLmFkZE9wZXJhdGlvbiBAXHJcbiAgICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcclxuICAgICAgICAgICAgbCBAX2VuY29kZSgpXHJcbiAgICAgICAgQFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxyXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXHJcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxyXG4gICAgI1xyXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xyXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xyXG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cclxuICAgICNcclxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxyXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cclxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxyXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcclxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cclxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxyXG4gICAgI1xyXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wLCBiYXNlID0gXCJ0aGlzXCIpLT5cclxuICAgICAgaWYgb3A/IGFuZCBvcC5fZ2V0TW9kZWw/XHJcbiAgICAgICAgb3AgPSBvcC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXHJcbiAgICAgICNcclxuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cclxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXHJcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXHJcbiAgICAgICNcclxuICAgICAgaWYgbm90IG9wP1xyXG4gICAgICAgICMgbm9wXHJcbiAgICAgIGVsc2UgaWYgb3AuZXhlY3V0ZT8gb3Igbm90IChvcC5vcF9udW1iZXI/IGFuZCBvcC5jcmVhdG9yPylcclxuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZCwgb3Igb3AgaXMgc3RyaW5nLiBDdXJyZW50bHkgXCJEZWxpbWl0ZXJcIiBpcyBzYXZlZCBhcyBzdHJpbmdcclxuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXHJcbiAgICAgICAgaWYgYmFzZSBpcyBcInRoaXNcIlxyXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgZGVzdCA9IEBbYmFzZV1cclxuICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcclxuICAgICAgICAgIGxhc3RfcGF0aCA9IHBhdGhzLnBvcCgpXHJcbiAgICAgICAgICBmb3IgcGF0aCBpbiBwYXRoc1xyXG4gICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxyXG4gICAgICAgICAgZGVzdFtsYXN0X3BhdGhdID0gb3BcclxuICAgICAgZWxzZVxyXG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICBAdW5jaGVja2VkID89IHt9XHJcbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXSA/PSB7fVxyXG4gICAgICAgIEB1bmNoZWNrZWRbYmFzZV1bbmFtZV0gPSBvcFxyXG5cclxuICAgICNcclxuICAgICMgQHByaXZhdGVcclxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxyXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXHJcbiAgICAjXHJcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxyXG4gICAgI1xyXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cclxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxyXG4gICAgICBzdWNjZXNzID0gdHJ1ZVxyXG4gICAgICBmb3IgYmFzZV9uYW1lLCBiYXNlIG9mIEB1bmNoZWNrZWRcclxuICAgICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIGJhc2VcclxuICAgICAgICAgIG9wID0gQEhCLmdldE9wZXJhdGlvbiBvcF91aWRcclxuICAgICAgICAgIGlmIG9wXHJcbiAgICAgICAgICAgIGlmIGJhc2VfbmFtZSBpcyBcInRoaXNcIlxyXG4gICAgICAgICAgICAgIEBbbmFtZV0gPSBvcFxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgZGVzdCA9IEBbYmFzZV9uYW1lXVxyXG4gICAgICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcclxuICAgICAgICAgICAgICBsYXN0X3BhdGggPSBwYXRocy5wb3AoKVxyXG4gICAgICAgICAgICAgIGZvciBwYXRoIGluIHBhdGhzXHJcbiAgICAgICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxyXG4gICAgICAgICAgICAgIGRlc3RbbGFzdF9wYXRoXSA9IG9wXHJcbiAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV0gPz0ge31cclxuICAgICAgICAgICAgdW5pbnN0YW50aWF0ZWRbYmFzZV9uYW1lXVtuYW1lXSA9IG9wX3VpZFxyXG4gICAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcclxuICAgICAgaWYgbm90IHN1Y2Nlc3NcclxuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcclxuICAgICAgICByZXR1cm4gZmFsc2VcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXHJcbiAgICAgICAgcmV0dXJuIEBcclxuXHJcbiAgICBnZXRDdXN0b21UeXBlOiAoKS0+XHJcbiAgICAgIGlmIG5vdCBAY3VzdG9tX3R5cGU/XHJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXHJcbiAgICAgICAgQFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xyXG4gICAgICAgICAgIyBoYXMgbm90IGJlZW4gaW5pdGlhbGl6ZWQgeWV0IChvbmx5IHRoZSBuYW1lIGlzIHNwZWNpZmllZClcclxuICAgICAgICAgIFR5cGUgPSBAY3VzdG9tX3R5cGVzXHJcbiAgICAgICAgICBmb3IgdCBpbiBAY3VzdG9tX3R5cGUuc3BsaXQoXCIuXCIpXHJcbiAgICAgICAgICAgIFR5cGUgPSBUeXBlW3RdXHJcbiAgICAgICAgICBAY3VzdG9tX3R5cGUgPSBuZXcgVHlwZSgpXHJcbiAgICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcclxuICAgICAgICBAY3VzdG9tX3R5cGVcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXHJcbiAgICAjXHJcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XHJcbiAgICAgIGpzb24udHlwZSA9IEB0eXBlXHJcbiAgICAgIGpzb24udWlkID0gQGdldFVpZCgpXHJcbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cclxuICAgICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXHJcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZS5fbmFtZVxyXG5cclxuICAgICAgaWYgQGNvbnRlbnQ/LmdldFVpZD9cclxuICAgICAgICBqc29uLmNvbnRlbnQgPSBAY29udGVudC5nZXRVaWQoKVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAganNvbi5jb250ZW50ID0gQGNvbnRlbnRcclxuICAgICAgaWYgQGNvbnRlbnRfb3BlcmF0aW9ucz9cclxuICAgICAgICBvcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbixvIG9mIEBjb250ZW50X29wZXJhdGlvbnNcclxuICAgICAgICAgIGlmIG8uX2dldE1vZGVsP1xyXG4gICAgICAgICAgICBvID0gby5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXHJcbiAgICAgICAgICBvcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxyXG4gICAgICAgIGpzb24uY29udGVudF9vcGVyYXRpb25zID0gb3BlcmF0aW9uc1xyXG4gICAgICBqc29uXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXHJcbiAgI1xyXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cclxuICAgICNcclxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG5cclxuICAgIHR5cGU6IFwiRGVsZXRlXCJcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cclxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cclxuICAgICNcclxuICAgIF9lbmNvZGU6ICgpLT5cclxuICAgICAge1xyXG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxyXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcclxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXHJcbiAgICAgIH1cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cclxuICAgICNcclxuICAgIGV4ZWN1dGU6ICgpLT5cclxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICByZXMgPSBzdXBlclxyXG4gICAgICAgIGlmIHJlc1xyXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxyXG4gICAgICAgIHJlc1xyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgI1xyXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cclxuICAjXHJcbiAgb3BzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XHJcbiAgICB7XHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcclxuICAgIH0gPSBvXHJcbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxyXG5cclxuICAjXHJcbiAgIyBAbm9kb2NcclxuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cclxuICAjXHJcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxyXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXHJcbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XHJcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkICh1bmltcGxlbWVudGVkLCBnb29kIGlkZWE/KVxyXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcclxuICAjXHJcbiAgY2xhc3Mgb3BzLkluc2VydCBleHRlbmRzIG9wcy5PcGVyYXRpb25cclxuXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cclxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcclxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXHJcbiAgICAjXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMsIHBhcmVudCwgdWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cclxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcclxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXHJcbiAgICAgIGlmIG9yaWdpbj9cclxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxyXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcclxuXHJcbiAgICB0eXBlOiBcIkluc2VydFwiXHJcblxyXG4gICAgdmFsOiAoKS0+XHJcbiAgICAgIEBnZXRDb250ZW50KClcclxuXHJcbiAgICBnZXROZXh0OiAoaT0xKS0+XHJcbiAgICAgIG4gPSBAXHJcbiAgICAgIHdoaWxlIGkgPiAwIGFuZCBuLmlzX2RlbGV0ZWQgYW5kIG4ubmV4dF9jbD9cclxuICAgICAgICBuID0gbi5uZXh0X2NsXHJcbiAgICAgICAgaWYgbm90IG4uaXNfZGVsZXRlZFxyXG4gICAgICAgICAgaS0tXHJcbiAgICAgIG5cclxuXHJcbiAgICBnZXRQcmV2OiAoaT0xKS0+XHJcbiAgICAgIG4gPSBAXHJcbiAgICAgIHdoaWxlIGkgPiAwIGFuZCBuLmlzX2RlbGV0ZWQgYW5kIG4ucHJldl9jbD9cclxuICAgICAgICBuID0gbi5wcmV2X2NsXHJcbiAgICAgICAgaWYgbm90IG4uaXNfZGVsZXRlZFxyXG4gICAgICAgICAgaS0tXHJcbiAgICAgIG5cclxuXHJcbiAgICAjXHJcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjXHJcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cclxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cclxuICAgICAgY2FsbExhdGVyID0gZmFsc2VcclxuICAgICAgaWYgQHBhcmVudD8gYW5kIG5vdCBAaXNfZGVsZXRlZCBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXHJcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXHJcbiAgICAgICAgY2FsbExhdGVyID0gdHJ1ZVxyXG4gICAgICBpZiBvP1xyXG4gICAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xyXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXHJcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgZ2FyYmFnZWNvbGxlY3QgPSB0cnVlXHJcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XHJcbiAgICAgIGlmIGNhbGxMYXRlclxyXG4gICAgICAgIEBwYXJlbnQuY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzKHRoaXMsIG8pXHJcbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQHByZXZfY2wuaXNEZWxldGVkKClcclxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXHJcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxyXG5cclxuICAgIGNsZWFudXA6ICgpLT5cclxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcclxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXHJcbiAgICAgICAgZm9yIGQgaW4gQGRlbGV0ZWRfYnlcclxuICAgICAgICAgIGQuY2xlYW51cCgpXHJcblxyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwicmlnaHQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXHJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XHJcbiAgICAgICAgbyA9IEBuZXh0X2NsXHJcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxyXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxyXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXHJcbiAgICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxyXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxyXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxyXG5cclxuICAgICAgICAjIGRlbGV0ZSBjb250ZW50XHJcbiAgICAgICAgIyAtIHdlIG11c3Qgbm90IGRvIHRoaXMgaW4gYXBwbHlEZWxldGUsIGJlY2F1c2UgdGhpcyB3b3VsZCBsZWFkIHRvIGluY29uc2lzdGVuY2llc1xyXG4gICAgICAgICMgKGUuZy4gdGhlIGZvbGxvd2luZyBvcGVyYXRpb24gb3JkZXIgbXVzdCBiZSBpbnZlcnRpYmxlIDpcclxuICAgICAgICAjICAgSW5zZXJ0IHJlZmVycyB0byBjb250ZW50LCB0aGVuIHRoZSBjb250ZW50IGlzIGRlbGV0ZWQpXHJcbiAgICAgICAgIyBUaGVyZWZvcmUsIHdlIGhhdmUgdG8gZG8gdGhpcyBpbiB0aGUgY2xlYW51cFxyXG4gICAgICAgICMgKiBOT0RFOiBXZSBuZXZlciBkZWxldGUgSW5zZXJ0aW9ucyFcclxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb24gYW5kIG5vdCAoQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuSW5zZXJ0KVxyXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieS0tXHJcbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXHJcbiAgICAgICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcclxuICAgICAgICBkZWxldGUgQGNvbnRlbnRcclxuICAgICAgICBzdXBlclxyXG4gICAgICAjIGVsc2VcclxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cclxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxyXG4gICAgI1xyXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxyXG4gICAgICBkID0gMFxyXG4gICAgICBvID0gQHByZXZfY2xcclxuICAgICAgd2hpbGUgdHJ1ZVxyXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xyXG4gICAgICAgICAgYnJlYWtcclxuICAgICAgICBkKytcclxuICAgICAgICBvID0gby5wcmV2X2NsXHJcbiAgICAgIGRcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICByZXR1cm4gZmFsc2VcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXHJcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5ID89IDBcclxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnkrK1xyXG4gICAgICAgIGlmIEBwYXJlbnQ/XHJcbiAgICAgICAgICBpZiBub3QgQHByZXZfY2w/XHJcbiAgICAgICAgICAgIEBwcmV2X2NsID0gQHBhcmVudC5iZWdpbm5pbmdcclxuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xyXG4gICAgICAgICAgICBAb3JpZ2luID0gQHByZXZfY2xcclxuICAgICAgICAgIGVsc2UgaWYgQG9yaWdpbiBpcyBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xyXG4gICAgICAgICAgaWYgbm90IEBuZXh0X2NsP1xyXG4gICAgICAgICAgICBAbmV4dF9jbCA9IEBwYXJlbnQuZW5kXHJcbiAgICAgICAgaWYgQHByZXZfY2w/XHJcbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxyXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcclxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcclxuXHJcbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XHJcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxyXG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxyXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxyXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcclxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xyXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cclxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXHJcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxyXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXHJcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxyXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXHJcbiAgICAgICAgICB3aGlsZSB0cnVlXHJcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxyXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XHJcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxyXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcclxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXHJcbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICMgbm9wXHJcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcclxuICAgICAgICAgICAgICAgICMgY2FzZSAyXHJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXHJcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xyXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAjbm9wXHJcbiAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcclxuICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgaSsrXHJcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcclxuICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcclxuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxyXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcclxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXHJcblxyXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xyXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXHJcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHModGhpcylcclxuICAgICAgICBAXHJcblxyXG4gICAgI1xyXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cclxuICAgICNcclxuICAgIGdldFBvc2l0aW9uOiAoKS0+XHJcbiAgICAgIHBvc2l0aW9uID0gMFxyXG4gICAgICBwcmV2ID0gQHByZXZfY2xcclxuICAgICAgd2hpbGUgdHJ1ZVxyXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXHJcbiAgICAgICAgICBicmVha1xyXG4gICAgICAgIGlmIG5vdCBwcmV2LmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICBwb3NpdGlvbisrXHJcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxyXG4gICAgICBwb3NpdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxyXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxyXG4gICAgI1xyXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxyXG4gICAgICBqc29uLnByZXYgPSBAcHJldl9jbC5nZXRVaWQoKVxyXG4gICAgICBqc29uLm5leHQgPSBAbmV4dF9jbC5nZXRVaWQoKVxyXG5cclxuICAgICAgaWYgQG9yaWdpbi50eXBlIGlzIFwiRGVsaW1pdGVyXCJcclxuICAgICAgICBqc29uLm9yaWdpbiA9IFwiRGVsaW1pdGVyXCJcclxuICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcclxuICAgICAgICBqc29uLm9yaWdpbiA9IEBvcmlnaW4uZ2V0VWlkKClcclxuXHJcbiAgICAgICMgaWYgbm90IChqc29uLnByZXY/IGFuZCBqc29uLm5leHQ/KVxyXG4gICAgICBqc29uLnBhcmVudCA9IEBwYXJlbnQuZ2V0VWlkKClcclxuXHJcbiAgICAgIHN1cGVyIGpzb25cclxuXHJcbiAgb3BzLkluc2VydC5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcclxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ3ByZXYnOiBwcmV2XHJcbiAgICAgICduZXh0JzogbmV4dFxyXG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxyXG4gICAgICAncGFyZW50JyA6IHBhcmVudFxyXG4gICAgfSA9IGpzb25cclxuICAgIG5ldyB0aGlzIG51bGwsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucywgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxyXG5cclxuICAjXHJcbiAgIyBAbm9kb2NcclxuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cclxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XHJcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxyXG4gICNcclxuICBjbGFzcyBvcHMuRGVsaW1pdGVyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXHJcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxyXG4gICAgI1xyXG4gICAgY29uc3RydWN0b3I6IChwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cclxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXHJcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxyXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxyXG4gICAgICBzdXBlciBudWxsLCB7bm9PcGVyYXRpb246IHRydWV9XHJcblxyXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxyXG5cclxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XHJcbiAgICAgIHN1cGVyKClcclxuICAgICAgbyA9IEBwcmV2X2NsXHJcbiAgICAgIHdoaWxlIG8/XHJcbiAgICAgICAgby5hcHBseURlbGV0ZSgpXHJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICBjbGVhbnVwOiAoKS0+XHJcbiAgICAgIHN1cGVyKClcclxuXHJcbiAgICAjXHJcbiAgICAjIEBwcml2YXRlXHJcbiAgICAjXHJcbiAgICBleGVjdXRlOiAoKS0+XHJcbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XHJcbiAgICAgICAgc3VwZXJcclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXHJcbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcclxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXHJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxyXG4gICAgICAgICAgc3VwZXJcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBmYWxzZVxyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XHJcbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXHJcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcclxuICAgICAgICBzdXBlclxyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xyXG4gICAgICAgIHN1cGVyXHJcbiAgICAgICNlbHNlXHJcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxyXG5cclxuICAgICNcclxuICAgICMgQHByaXZhdGVcclxuICAgICNcclxuICAgIF9lbmNvZGU6ICgpLT5cclxuICAgICAge1xyXG4gICAgICAgICd0eXBlJyA6IEB0eXBlXHJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcclxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcclxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcclxuICAgICAgfVxyXG5cclxuICBvcHMuRGVsaW1pdGVyLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICd1aWQnIDogdWlkXHJcbiAgICAncHJldicgOiBwcmV2XHJcbiAgICAnbmV4dCcgOiBuZXh0XHJcbiAgICB9ID0ganNvblxyXG4gICAgbmV3IHRoaXModWlkLCBwcmV2LCBuZXh0KVxyXG5cclxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXHJcbiAge1xyXG4gICAgJ29wZXJhdGlvbnMnIDogb3BzXHJcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxyXG4gIH1cclxuIiwiYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1wiXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9ICgpLT5cclxuICBiYXNpY19vcHMgPSBiYXNpY19vcHNfdW5pbml0aWFsaXplZCgpXHJcbiAgb3BzID0gYmFzaWNfb3BzLm9wZXJhdGlvbnNcclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cclxuICAjXHJcbiAgY2xhc3Mgb3BzLk1hcE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxyXG4gICAgICBAX21hcCA9IHt9XHJcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xyXG5cclxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXHJcblxyXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cclxuICAgICAgZm9yIG5hbWUscCBvZiBAX21hcFxyXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgY2xlYW51cDogKCktPlxyXG4gICAgICBzdXBlcigpXHJcblxyXG4gICAgbWFwOiAoZiktPlxyXG4gICAgICBmb3Igbix2IG9mIEBfbWFwXHJcbiAgICAgICAgZihuLHYpXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgICNcclxuICAgICMgQHNlZSBKc29uT3BlcmF0aW9ucy52YWxcclxuICAgICNcclxuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cclxuICAgICAgaWYgYXJndW1lbnRzLmxlbmd0aCA+IDFcclxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XHJcbiAgICAgICAgICByZXAgPSBjb250ZW50Ll9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICByZXAgPSBjb250ZW50XHJcbiAgICAgICAgQHJldHJpZXZlU3ViKG5hbWUpLnJlcGxhY2UgcmVwXHJcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKVxyXG4gICAgICBlbHNlIGlmIG5hbWU/XHJcbiAgICAgICAgcHJvcCA9IEBfbWFwW25hbWVdXHJcbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxyXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxyXG4gICAgICAgICAgaWYgcmVzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgICByZXMuZ2V0Q3VzdG9tVHlwZSgpXHJcbiAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIHJlc1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHVuZGVmaW5lZFxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgcmVzdWx0ID0ge31cclxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXHJcbiAgICAgICAgICBpZiBub3Qgby5pc0NvbnRlbnREZWxldGVkKClcclxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gby52YWwoKVxyXG4gICAgICAgIHJlc3VsdFxyXG5cclxuICAgIGRlbGV0ZTogKG5hbWUpLT5cclxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxyXG4gICAgICBAXHJcblxyXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XHJcbiAgICAgIGlmIG5vdCBAX21hcFtwcm9wZXJ0eV9uYW1lXT9cclxuICAgICAgICBldmVudF9wcm9wZXJ0aWVzID1cclxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcclxuICAgICAgICBldmVudF90aGlzID0gQFxyXG4gICAgICAgIHJtX3VpZCA9XHJcbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxyXG4gICAgICAgICAgc3ViOiBwcm9wZXJ0eV9uYW1lXHJcbiAgICAgICAgICBhbHQ6IEBcclxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxyXG4gICAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdID0gcm1cclxuICAgICAgICBybS5zZXRQYXJlbnQgQCwgcHJvcGVydHlfbmFtZVxyXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxyXG4gICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXVxyXG5cclxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XHJcbiAgICB7XHJcbiAgICAgICd1aWQnIDogdWlkXHJcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxyXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XHJcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXHJcbiAgICB9ID0ganNvblxyXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKVxyXG5cclxuXHJcblxyXG4gICNcclxuICAjIEBub2RvY1xyXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cclxuICAjXHJcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxyXG5cclxuICAgICNcclxuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxyXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXHJcbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cclxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxyXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cclxuICAgICAgQGJlZ2lubmluZyA9IG5ldyBvcHMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkXHJcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgb3BzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcclxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxyXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxyXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxyXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcclxuXHJcbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcclxuXHJcblxyXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cclxuICAgICAgbyA9IEBiZWdpbm5pbmdcclxuICAgICAgd2hpbGUgbz9cclxuICAgICAgICBvLmFwcGx5RGVsZXRlKClcclxuICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgIHN1cGVyKClcclxuXHJcbiAgICBjbGVhbnVwOiAoKS0+XHJcbiAgICAgIHN1cGVyKClcclxuXHJcblxyXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cclxuICAgICAgdmFsID0gQHZhbCgpXHJcbiAgICAgIGZvciBpLCBvIGluIHZhbFxyXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuT2JqZWN0XHJcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXHJcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2Ygb3BzLkxpc3RNYW5hZ2VyXHJcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXHJcbiAgICAgICAgZWxzZSBpZiB0cmFuc2Zvcm1fdG9fdmFsdWUgYW5kIG8gaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXHJcbiAgICAgICAgICBvLnZhbCgpXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgb1xyXG5cclxuICAgICNcclxuICAgICMgQHByaXZhdGVcclxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxyXG4gICAgI1xyXG4gICAgZXhlY3V0ZTogKCktPlxyXG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxyXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcclxuICAgICAgICBAZW5kLnNldFBhcmVudCBAXHJcbiAgICAgICAgc3VwZXJcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGZhbHNlXHJcblxyXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXHJcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XHJcbiAgICAgIEBlbmQucHJldl9jbFxyXG5cclxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcclxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XHJcbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxyXG5cclxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcclxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXHJcbiAgICB0b0FycmF5OiAoKS0+XHJcbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcclxuICAgICAgcmVzdWx0ID0gW11cclxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcclxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXHJcbiAgICAgICAgICByZXN1bHQucHVzaCBvLnZhbCgpXHJcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICByZXN1bHRcclxuXHJcbiAgICBtYXA6IChmKS0+XHJcbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcclxuICAgICAgcmVzdWx0ID0gW11cclxuICAgICAgd2hpbGUgbyBpc250IEBlbmRcclxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXHJcbiAgICAgICAgICByZXN1bHQucHVzaCBmKG8pXHJcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICByZXN1bHRcclxuXHJcbiAgICBmb2xkOiAoaW5pdCwgZiktPlxyXG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXHJcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXHJcbiAgICAgICAgaWYgbm90IG8uaXNfZGVsZXRlZFxyXG4gICAgICAgICAgaW5pdCA9IGYoaW5pdCwgbylcclxuICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgIGluaXRcclxuXHJcbiAgICB2YWw6IChwb3MpLT5cclxuICAgICAgaWYgcG9zP1xyXG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcclxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxyXG4gICAgICAgICAgby52YWwoKVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgQHRvQXJyYXkoKVxyXG5cclxuICAgIHJlZjogKHBvcyktPlxyXG4gICAgICBpZiBwb3M/XHJcbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxyXG4gICAgICAgIGlmIG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpXHJcbiAgICAgICAgICBvXHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgbnVsbFxyXG4gICAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcclxuICAgICAgZWxzZVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcInlvdSBtdXN0IHNwZWNpZnkgYSBwb3NpdGlvbiBwYXJhbWV0ZXJcIlxyXG5cclxuICAgICNcclxuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXHJcbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXHJcbiAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxyXG4gICAgI1xyXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XHJcbiAgICAgIG8gPSBAYmVnaW5uaW5nXHJcbiAgICAgIHdoaWxlIHRydWVcclxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcclxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xyXG4gICAgICAgICAgIyB0aGUgdXNlciBvciB5b3UgZ2F2ZSBhIHBvc2l0aW9uIHBhcmFtZXRlciB0aGF0IGlzIHRvIGJpZ1xyXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cclxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxyXG4gICAgICAgICAgbyA9IG8ucHJldl9jbFxyXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgby5wcmV2X2NsP1xyXG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXHJcbiAgICAgICAgICBicmVha1xyXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICBicmVha1xyXG5cclxuICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcclxuICAgICAgICAgIHBvc2l0aW9uIC09IDFcclxuICAgICAgb1xyXG5cclxuICAgIHB1c2g6IChjb250ZW50KS0+XHJcbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIFtjb250ZW50XVxyXG5cclxuICAgIGluc2VydEFmdGVyOiAobGVmdCwgY29udGVudHMpLT5cclxuICAgICAgcmlnaHQgPSBsZWZ0Lm5leHRfY2xcclxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcclxuICAgICAgICByaWdodCA9IHJpZ2h0Lm5leHRfY2wgIyBmaW5kIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gdGhlIHJpZ2h0LCB0aGF0IGlzIG5vdCBkZWxldGVkLiBJbiB0aGUgY2FzZSB0aGF0IHBvc2l0aW9uIGlzIDAsIGl0cyB0aGUgRGVsaW1pdGVyLlxyXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxyXG5cclxuICAgICAgIyBUT0RPOiBhbHdheXMgZXhwZWN0IGFuIGFycmF5IGFzIGNvbnRlbnQuIFRoZW4geW91IGNhbiBjb21iaW5lIHRoaXMgd2l0aCB0aGUgb3RoZXIgb3B0aW9uIChlbHNlKVxyXG4gICAgICBpZiBjb250ZW50cyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cclxuICAgICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcclxuICAgICAgZWxzZVxyXG4gICAgICAgIGZvciBjIGluIGNvbnRlbnRzXHJcbiAgICAgICAgICBpZiBjPyBhbmQgYy5fbmFtZT8gYW5kIGMuX2dldE1vZGVsP1xyXG4gICAgICAgICAgICBjID0gYy5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXHJcbiAgICAgICAgICB0bXAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgYywgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcclxuICAgICAgICAgIGxlZnQgPSB0bXBcclxuICAgICAgQFxyXG5cclxuICAgICNcclxuICAgICMgSW5zZXJ0cyBhbiBhcnJheSBvZiBjb250ZW50IGludG8gdGhpcyBsaXN0LlxyXG4gICAgIyBATm90ZTogVGhpcyBleHBlY3RzIGFuIGFycmF5IGFzIGNvbnRlbnQhXHJcbiAgICAjXHJcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdC5cclxuICAgICNcclxuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50cyktPlxyXG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxyXG4gICAgICAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXHJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXHJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnRzXHJcblxyXG4gICAgI1xyXG4gICAgIyBEZWxldGVzIGEgcGFydCBvZiB0aGUgd29yZC5cclxuICAgICNcclxuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XHJcbiAgICAjXHJcbiAgICBkZWxldGU6IChwb3NpdGlvbiwgbGVuZ3RoID0gMSktPlxyXG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zaXRpb24rMSkgIyBwb3NpdGlvbiAwIGluIHRoaXMgY2FzZSBpcyB0aGUgZGVsZXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlclxyXG5cclxuICAgICAgZGVsZXRlX29wcyA9IFtdXHJcbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxyXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXHJcbiAgICAgICAgICBicmVha1xyXG4gICAgICAgIGQgPSAobmV3IG9wcy5EZWxldGUgbnVsbCwgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcclxuICAgICAgICBvID0gby5uZXh0X2NsXHJcbiAgICAgICAgd2hpbGUgKG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpKSBhbmQgby5pc0RlbGV0ZWQoKVxyXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxyXG4gICAgICBAXHJcblxyXG5cclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wKS0+XHJcbiAgICAgIGdldENvbnRlbnRUeXBlID0gKGNvbnRlbnQpLT5cclxuICAgICAgICBpZiBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxyXG4gICAgICAgICAgY29udGVudC5nZXRDdXN0b21UeXBlKClcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBjb250ZW50XHJcbiAgICAgIEBjYWxsRXZlbnQgW1xyXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcclxuICAgICAgICByZWZlcmVuY2U6IG9wXHJcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcclxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKClcclxuICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIG9wLnZhbCgpXHJcbiAgICAgIF1cclxuXHJcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XHJcbiAgICAgIEBjYWxsRXZlbnQgW1xyXG4gICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcclxuICAgICAgICByZWZlcmVuY2U6IG9wXHJcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcclxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKCkgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxyXG4gICAgICAgIGxlbmd0aDogMVxyXG4gICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgb2xkVmFsdWU6IG9wLnZhbCgpXHJcbiAgICAgIF1cclxuXHJcbiAgb3BzLkxpc3RNYW5hZ2VyLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcclxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxyXG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xyXG4gICAgfSA9IGpzb25cclxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcclxuXHJcbiAgY2xhc3Mgb3BzLkNvbXBvc2l0aW9uIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXHJcblxyXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgQF9jb21wb3NpdGlvbl92YWx1ZSwgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucywgdWlkLCB0bXBfY29tcG9zaXRpb25fcmVmKS0+XHJcbiAgICAgICMgd2UgY2FuJ3QgdXNlIEBzZXZlT3BlcmF0aW9uICdjb21wb3NpdGlvbl9yZWYnLCB0bXBfY29tcG9zaXRpb25fcmVmIGhlcmUsXHJcbiAgICAgICMgYmVjYXVzZSB0aGVuIHRoZXJlIGlzIGEgXCJsb29wXCIgKGluc2VydGlvbiByZWZlcnMgdG8gcGFyZW50LCByZWZlcnMgdG8gaW5zZXJ0aW9uLi4pXHJcbiAgICAgICMgVGhpcyBpcyB3aHkgd2UgaGF2ZSB0byBjaGVjayBpbiBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzIHVudGlsIHdlIGZpbmQgaXRcclxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxyXG4gICAgICBpZiB0bXBfY29tcG9zaXRpb25fcmVmP1xyXG4gICAgICAgIEB0bXBfY29tcG9zaXRpb25fcmVmID0gdG1wX2NvbXBvc2l0aW9uX3JlZlxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxyXG4gICAgICBpZiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xyXG4gICAgICAgIEBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbixvIG9mIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcclxuICAgICAgICAgIEBzYXZlT3BlcmF0aW9uIG4sIG8sICdfY29tcG9zaXRpb25fdmFsdWUnXHJcblxyXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXHJcblxyXG4gICAgI1xyXG4gICAgIyBAcHJpdmF0ZVxyXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXHJcbiAgICAjXHJcbiAgICBleGVjdXRlOiAoKS0+XHJcbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXHJcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKS5fc2V0Q29tcG9zaXRpb25WYWx1ZSBAX2NvbXBvc2l0aW9uX3ZhbHVlXHJcbiAgICAgICAgZGVsZXRlIEBfY29tcG9zaXRpb25fdmFsdWVcclxuICAgICAgICBzdXBlclxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgZmFsc2VcclxuXHJcbiAgICAjXHJcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtb3BlcmF0aW9uIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXHJcbiAgICAjXHJcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6IChvcCktPlxyXG4gICAgICBpZiBAdG1wX2NvbXBvc2l0aW9uX3JlZj9cclxuICAgICAgICBpZiBvcC51aWQuY3JlYXRvciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5jcmVhdG9yIGFuZCBvcC51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxyXG4gICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IG9wXHJcbiAgICAgICAgICBkZWxldGUgQHRtcF9jb21wb3NpdGlvbl9yZWZcclxuICAgICAgICAgIG8gPSBvcC5uZXh0X2NsXHJcbiAgICAgICAgICB3aGlsZSBvLm5leHRfY2w/XHJcbiAgICAgICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXHJcbiAgICAgICAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyBvXHJcbiAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcclxuICAgICAgICByZXR1cm5cclxuXHJcbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWYubmV4dF9jbCBpcyBvcFxyXG4gICAgICAgIG9wLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvcC52YWwoKVxyXG4gICAgICBlbHNlXHJcbiAgICAgICAgbyA9IEBlbmQucHJldl9jbFxyXG4gICAgICAgIHdoaWxlIG8gaXNudCBvcFxyXG4gICAgICAgICAgQGdldEN1c3RvbVR5cGUoKS5fdW5hcHBseSBvLnVuZG9fZGVsdGFcclxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcclxuICAgICAgICB3aGlsZSBvIGlzbnQgQGVuZFxyXG4gICAgICAgICAgby51bmRvX2RlbHRhID0gQGdldEN1c3RvbVR5cGUoKS5fYXBwbHkgby52YWwoKVxyXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxyXG4gICAgICBAY29tcG9zaXRpb25fcmVmID0gQGVuZC5wcmV2X2NsXHJcblxyXG4gICAgICBAY2FsbEV2ZW50IFtcclxuICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXHJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxyXG4gICAgICAgIG5ld1ZhbHVlOiBAdmFsKClcclxuICAgICAgXVxyXG5cclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cclxuICAgICAgcmV0dXJuXHJcblxyXG4gICAgI1xyXG4gICAgIyBDcmVhdGUgYSBuZXcgRGVsdGFcclxuICAgICMgLSBpbnNlcnRzIG5ldyBDb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcclxuICAgICMgLSB1cGRhdGVzIHRoZSBjb21wb3NpdGlvbl92YWx1ZVxyXG4gICAgIyAtIHVwZGF0ZXMgdGhlIGNvbXBvc2l0aW9uX3JlZlxyXG4gICAgI1xyXG4gICAgIyBAcGFyYW0gZGVsdGEgVGhlIGRlbHRhIHRoYXQgaXMgYXBwbGllZCB0byB0aGUgY29tcG9zaXRpb25fdmFsdWVcclxuICAgICNcclxuICAgIGFwcGx5RGVsdGE6IChkZWx0YSwgb3BlcmF0aW9ucyktPlxyXG4gICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgZGVsdGEsIG9wZXJhdGlvbnMsIEAsIG51bGwsIEBlbmQucHJldl9jbCwgQGVuZCkuZXhlY3V0ZSgpXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgICNcclxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cclxuICAgICNcclxuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cclxuICAgICAgY3VzdG9tID0gQGdldEN1c3RvbVR5cGUoKS5fZ2V0Q29tcG9zaXRpb25WYWx1ZSgpXHJcbiAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWUgPSBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVcclxuICAgICAgaWYgY3VzdG9tLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnM/XHJcbiAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zID0ge31cclxuICAgICAgICBmb3IgbixvIG9mIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXHJcbiAgICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNbbl0gPSBvLmdldFVpZCgpXHJcbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWY/XHJcbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXHJcbiAgICAgIGVsc2VcclxuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3JlZiA9IEB0bXBfY29tcG9zaXRpb25fcmVmXHJcbiAgICAgIHN1cGVyIGpzb25cclxuXHJcbiAgb3BzLkNvbXBvc2l0aW9uLnBhcnNlID0gKGpzb24pLT5cclxuICAgIHtcclxuICAgICAgJ3VpZCcgOiB1aWRcclxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcclxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXHJcbiAgICAgICdjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zJyA6IGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcclxuICAgICAgJ2NvbXBvc2l0aW9uX3JlZicgOiBjb21wb3NpdGlvbl9yZWZcclxuICAgIH0gPSBqc29uXHJcbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgY29tcG9zaXRpb25fcmVmKVxyXG5cclxuXHJcbiAgI1xyXG4gICMgQG5vZG9jXHJcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXHJcbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXHJcbiAgI1xyXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcclxuICAjIEBzZWUgVGV4dFR5cGVcclxuICAjXHJcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF9wcm9wZXJ0aWVzIERlY29yYXRlcyB0aGUgZXZlbnQgdGhhdCBpcyB0aHJvd24gYnkgdGhlIFJNXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXHJcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXHJcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cclxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxyXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXHJcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCktPlxyXG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xyXG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzLmdldEN1c3RvbVR5cGUoKVxyXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXHJcblxyXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXHJcblxyXG4gICAgI1xyXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcclxuICAgICMgUmVwbGFjZWFibGVzIGFsc28gbm90IHRocm93IHRoZSBzYW1lIGV2ZW50cy5cclxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxyXG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cclxuICAgICNcclxuICAgICNcclxuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxyXG4gICAgICBpZiBub3QgQGlzRGVsZXRlZCgpXHJcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xyXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xyXG4gICAgICAgICAgICBldmVudFtuYW1lXSA9IHByb3BcclxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgICNcclxuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC10eXBlIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXHJcbiAgICAjIFRPRE86IGNvbnNpZGVyIGRvaW5nIHRoaXMgaW4gYSBtb3JlIGNvbnNpc3RlbnQgbWFubmVyLiBUaGlzIGNvdWxkIGFsc28gYmVcclxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cclxuICAgICNcclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wKS0+XHJcbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcC5wcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgIyB0aGlzIHJlcGxhY2VzIGFub3RoZXIgUmVwbGFjZWFibGVcclxuICAgICAgICBpZiBub3Qgb3AuaXNfZGVsZXRlZCAjIFdoZW4gdGhpcyBpcyByZWNlaXZlZCBmcm9tIHRoZSBIQiwgdGhpcyBjb3VsZCBhbHJlYWR5IGJlIGRlbGV0ZWQhXHJcbiAgICAgICAgICBvbGRfdmFsdWUgPSBvcC5wcmV2X2NsLnZhbCgpXHJcbiAgICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcclxuICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxyXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcclxuICAgICAgICAgIF1cclxuICAgICAgICBvcC5wcmV2X2NsLmFwcGx5RGVsZXRlKClcclxuICAgICAgZWxzZSBpZiBvcC5uZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXHJcbiAgICAgICAgIyBUaGlzIHdvbid0IGJlIHJlY29nbml6ZWQgYnkgdGhlIHVzZXIsIGJlY2F1c2UgYW5vdGhlclxyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxyXG4gICAgICAgIG9wLmFwcGx5RGVsZXRlKClcclxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cclxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcclxuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcclxuICAgICAgICAgIGNoYW5nZWRCeTogb3AudWlkLmNyZWF0b3JcclxuICAgICAgICBdXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cclxuICAgICAgaWYgb3AubmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcclxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcclxuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcclxuICAgICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXHJcbiAgICAgICAgICBvbGRWYWx1ZTogb3AudmFsKClcclxuICAgICAgICBdXHJcblxyXG5cclxuICAgICNcclxuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXHJcbiAgICAjXHJcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cclxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcclxuICAgICNcclxuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cclxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcclxuICAgICAgcmVscCA9IChuZXcgb3BzLkluc2VydCBudWxsLCBjb250ZW50LCBudWxsLCBALCByZXBsYWNlYWJsZV91aWQsIG8sIG8ubmV4dF9jbCkuZXhlY3V0ZSgpXHJcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXHJcbiAgICAgIHVuZGVmaW5lZFxyXG5cclxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cclxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxyXG5cclxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cclxuICAgICAgKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxyXG4gICAgICB1bmRlZmluZWRcclxuXHJcbiAgICAjXHJcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpc1xyXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XHJcbiAgICAjXHJcbiAgICB2YWw6ICgpLT5cclxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcclxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXHJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXHJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXHJcblxyXG5cclxuXHJcbiAgYmFzaWNfb3BzXHJcbiIsIlxyXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcclxuXHJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcclxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcclxuYWRhcHRDb25uZWN0b3IgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JBZGFwdGVyXCJcclxuXHJcbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XHJcbiAgdXNlcl9pZCA9IG51bGxcclxuICBpZiBjb25uZWN0b3IudXNlcl9pZD9cclxuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXHJcbiAgZWxzZVxyXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxyXG4gICAgY29ubmVjdG9yLm9uX3VzZXJfaWRfc2V0ID0gKGlkKS0+XHJcbiAgICAgIHVzZXJfaWQgPSBpZFxyXG4gICAgICBIQi5yZXNldFVzZXJJZCBpZFxyXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxyXG4gIG9wc19tYW5hZ2VyID0gc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCBIQiwgdGhpcy5jb25zdHJ1Y3RvclxyXG4gIG9wcyA9IG9wc19tYW5hZ2VyLm9wZXJhdGlvbnNcclxuXHJcbiAgZW5naW5lID0gbmV3IEVuZ2luZSBIQiwgb3BzXHJcbiAgYWRhcHRDb25uZWN0b3IgY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBvcHNfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcclxuXHJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuSEIgPSBIQlxyXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLm9wZXJhdGlvbnMgPSBvcHNcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jb25uZWN0b3IgPSBjb25uZWN0b3JcclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jdXN0b21fdHlwZXMgPSB0aGlzLmNvbnN0cnVjdG9yXHJcblxyXG4gIGN0ID0gbmV3IGNyZWF0ZVkuT2JqZWN0KClcclxuICBtb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihjdCwgSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxyXG4gIGN0Ll9zZXRNb2RlbCBtb2RlbFxyXG4gIGN0XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcclxuaWYgd2luZG93P1xyXG4gIHdpbmRvdy5ZID0gY3JlYXRlWVxyXG5cclxuY3JlYXRlWS5PYmplY3QgPSByZXF1aXJlIFwiLi9PYmplY3RUeXBlXCJcclxuIl19
