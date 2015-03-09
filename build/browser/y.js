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
        throw new Error("This operation was not initialized with a custom type");
      }
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

    function Insert(custom_type, content, uid, prev_cl, next_cl, origin, parent) {
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
        this.callOperationSpecificDeleteEvents(o);
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
        this.callOperationSpecificInsertEvents();
        return this;
      }
    };

    Insert.prototype.callOperationSpecificInsertEvents = function() {
      var getContentType, _ref;
      getContentType = function(content) {
        if (content instanceof ops.Operation) {
          return content.getCustomType();
        } else {
          return content;
        }
      };
      return (_ref = this.parent) != null ? _ref.callEvent([
        {
          type: "insert",
          position: this.getPosition(),
          object: this.parent.getCustomType(),
          changedBy: this.uid.creator,
          value: getContentType(this.content)
        }
      ]) : void 0;
    };

    Insert.prototype.callOperationSpecificDeleteEvents = function(o) {
      return this.parent.callEvent([
        {
          type: "delete",
          position: this.getPosition(),
          object: this.parent.getCustomType(),
          length: 1,
          changedBy: o.uid.creator,
          oldValue: this.val()
        }
      ]);
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
      json.parent = this.parent.getUid();
      if (this.origin.type === "Delimiter") {
        json.origin = "Delimiter";
      } else if (this.origin !== this.prev_cl) {
        json.origin = this.origin.getUid();
      }
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
    return new this(null, content, uid, prev, next, origin, parent);
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
      o = this.end;
      while (o != null) {
        o.applyDelete();
        o = o.prev_cl;
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
        (new ops.Insert(null, content, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = contents.length; _i < _len; _i++) {
          c = contents[_i];
          if ((c != null) && (c._name != null) && (c._getModel != null)) {
            c = c._getModel(this.custom_types, this.operations);
          }
          tmp = (new ops.Insert(null, c, void 0, left, right)).execute();
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

    return ListManager;

  })(ops.Operation);
  ops.ListManager.parse = function(json) {
    var custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'];
    return new this(custom_type, uid);
  };
  ops.ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(custom_type, event_properties, event_this, uid, beginning, end) {
      this.event_properties = event_properties;
      this.event_this = event_this;
      if (this.event_properties['object'] == null) {
        this.event_properties['object'] = this.event_this.getCustomType();
      }
      ReplaceManager.__super__.constructor.call(this, custom_type, uid, beginning, end);
    }

    ReplaceManager.prototype.type = "ReplaceManager";

    ReplaceManager.prototype.applyDelete = function() {
      var o;
      o = this.beginning;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
      }
      return ReplaceManager.__super__.applyDelete.call(this);
    };

    ReplaceManager.prototype.cleanup = function() {
      return ReplaceManager.__super__.cleanup.call(this);
    };

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

    ReplaceManager.prototype.replace = function(content, replaceable_uid) {
      var o, relp;
      o = this.getLastOperation();
      relp = (new ops.Replaceable(null, content, this, replaceable_uid, o, o.next_cl)).execute();
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

    ReplaceManager.prototype._encode = function(json) {
      if (json == null) {
        json = {};
      }
      json.beginning = this.beginning.getUid();
      json.end = this.end.getUid();
      return ReplaceManager.__super__._encode.call(this, json);
    };

    return ReplaceManager;

  })(ops.ListManager);
  ops.Replaceable = (function(_super) {
    __extends(Replaceable, _super);

    function Replaceable(custom_type, content, parent, uid, prev, next, origin) {
      this.saveOperation('parent', parent);
      Replaceable.__super__.constructor.call(this, custom_type, content, uid, prev, next, origin);
    }

    Replaceable.prototype.type = "Replaceable";

    Replaceable.prototype.callOperationSpecificInsertEvents = function() {
      var old_value;
      if (this.next_cl.type === "Delimiter" && this.prev_cl.type !== "Delimiter") {
        if (!this.is_deleted) {
          old_value = this.prev_cl.val();
          this.parent.callEventDecorator([
            {
              type: "update",
              changedBy: this.uid.creator,
              oldValue: old_value
            }
          ]);
        }
        this.prev_cl.applyDelete();
      } else if (this.next_cl.type !== "Delimiter") {
        this.applyDelete();
      } else {
        this.parent.callEventDecorator([
          {
            type: "add",
            changedBy: this.uid.creator
          }
        ]);
      }
      return void 0;
    };

    Replaceable.prototype.callOperationSpecificDeleteEvents = function(o) {
      if (this.next_cl.type === "Delimiter") {
        return this.parent.callEventDecorator([
          {
            type: "delete",
            changedBy: o.uid.creator,
            oldValue: this.val()
          }
        ]);
      }
    };

    Replaceable.prototype._encode = function(json) {
      if (json == null) {
        json = {};
      }
      return Replaceable.__super__._encode.call(this, json);
    };

    return Replaceable;

  })(ops.Insert);
  ops.Replaceable.parse = function(json) {
    var content, custom_type, next, origin, parent, prev, uid;
    content = json['content'], parent = json['parent'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], custom_type = json['custom_type'];
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    return new this(custom_type, content, parent, uid, prev, next, origin);
  };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL09wZXJhdGlvbnMvQmFzaWMuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENBQWxCLENBREY7QUFBQSxHQUFBO0FBQUEsRUFHQSxTQUFTLENBQUMsYUFBVixDQUFBLENBSEEsQ0FBQTtBQUFBLEVBS0EsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFH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Q0FERjtDQWxDQTs7QUFBQSxPQXFDTyxDQUFDLE1BQVIsR0FBaUIsT0FBQSxDQUFRLGNBQVIsQ0FyQ2pCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5Db25uZWN0b3JDbGFzcyA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckNsYXNzXCJcbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cblxuICBmb3IgbmFtZSwgZiBvZiBDb25uZWN0b3JDbGFzc1xuICAgIGNvbm5lY3RvcltuYW1lXSA9IGZcblxuICBjb25uZWN0b3Iuc2V0SXNCb3VuZFRvWSgpXG5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEhCLmdldFVzZXJJZCgpKSBhbmRcbiAgICAgICAgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKSBhbmQgIyBUT0RPOiBpIGRvbid0IHRoaW5rIHRoYXQgd2UgbmVlZCB0aGlzIGFueW1vcmUuLlxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cblxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIGdldEhCID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcbiAgICBqc29uID1cbiAgICAgIGhiOiBoYlxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgIGpzb25cblxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXG5cbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXG5cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMgPz0gW11cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXG5cblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvciIsIlxubW9kdWxlLmV4cG9ydHMgPVxuICAjXG4gICMgQHBhcmFtcyBuZXcgQ29ubmVjdG9yKG9wdGlvbnMpXG4gICMgICBAcGFyYW0gb3B0aW9ucy5zeW5jTWV0aG9kIHtTdHJpbmd9ICBpcyBlaXRoZXIgXCJzeW5jQWxsXCIgb3IgXCJtYXN0ZXItc2xhdmVcIi5cbiAgIyAgIEBwYXJhbSBvcHRpb25zLnJvbGUge1N0cmluZ30gVGhlIHJvbGUgb2YgdGhpcyBjbGllbnRcbiAgIyAgICAgICAgICAgIChzbGF2ZSBvciBtYXN0ZXIgKG9ubHkgdXNlZCB3aGVuIHN5bmNNZXRob2QgaXMgbWFzdGVyLXNsYXZlKSlcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpbiB7Qm9vbGVhbn0gV2hldGVociB0byB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLCBidXQgaGFzIHNvbWUgb3ZlcmhlYWQgKG9wdGlvbmFsKVxuICAjXG4gIGluaXQ6IChvcHRpb25zKS0+XG4gICAgcmVxID0gKG5hbWUsIGNob2ljZXMpPT5cbiAgICAgIGlmIG9wdGlvbnNbbmFtZV0/XG4gICAgICAgIGlmIChub3QgY2hvaWNlcz8pIG9yIGNob2ljZXMuc29tZSgoYyktPmMgaXMgb3B0aW9uc1tuYW1lXSlcbiAgICAgICAgICBAW25hbWVdID0gb3B0aW9uc1tuYW1lXVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGNhbiBzZXQgdGhlICdcIituYW1lK1wiJyBvcHRpb24gdG8gb25lIG9mIHRoZSBmb2xsb3dpbmcgY2hvaWNlczogXCIrSlNPTi5lbmNvZGUoY2hvaWNlcylcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgc3BlY2lmeSBcIituYW1lK1wiLCB3aGVuIGluaXRpYWxpemluZyB0aGUgQ29ubmVjdG9yIVwiXG5cbiAgICByZXEgXCJzeW5jTWV0aG9kXCIsIFtcInN5bmNBbGxcIiwgXCJtYXN0ZXItc2xhdmVcIl1cbiAgICByZXEgXCJyb2xlXCIsIFtcIm1hc3RlclwiLCBcInNsYXZlXCJdXG4gICAgcmVxIFwidXNlcl9pZFwiXG4gICAgQG9uX3VzZXJfaWRfc2V0PyhAdXNlcl9pZClcblxuICAgICMgd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycy5cbiAgICAjIEJ1dCB0aGlzIGlzIG5vdCBuZWNlc3NhcnkgaW4gdGhlIHRlc3QtY29ubmVjdG9yXG4gICAgaWYgb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4/XG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW5cbiAgICBlbHNlXG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gdHJ1ZVxuXG4gICAgIyBBIE1hc3RlciBzaG91bGQgc3luYyB3aXRoIGV2ZXJ5b25lISBUT0RPOiByZWFsbHk/IC0gZm9yIG5vdyBpdHMgc2FmZXIgdGhpcyB3YXkhXG4gICAgaWYgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgQHN5bmNNZXRob2QgPSBcInN5bmNBbGxcIlxuXG4gICAgIyBpcyBzZXQgdG8gdHJ1ZSB3aGVuIHRoaXMgaXMgc3luY2VkIHdpdGggYWxsIG90aGVyIGNvbm5lY3Rpb25zXG4gICAgQGlzX3N5bmNlZCA9IGZhbHNlXG4gICAgIyBQZWVyanMgQ29ubmVjdGlvbnM6IGtleTogY29ubi1pZCwgdmFsdWU6IG9iamVjdFxuICAgIEBjb25uZWN0aW9ucyA9IHt9XG4gICAgIyBMaXN0IG9mIGZ1bmN0aW9ucyB0aGF0IHNoYWxsIHByb2Nlc3MgaW5jb21pbmcgZGF0YVxuICAgIEByZWNlaXZlX2hhbmRsZXJzID89IFtdXG5cbiAgICAjIHdoZXRoZXIgdGhpcyBpbnN0YW5jZSBpcyBib3VuZCB0byBhbnkgeSBpbnN0YW5jZVxuICAgIEBjb25uZWN0aW9ucyA9IHt9XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gZmFsc2VcbiAgICBAaXNfaW5pdGlhbGl6ZWQgPSB0cnVlXG5cbiAgaXNSb2xlTWFzdGVyOiAtPlxuICAgIEByb2xlIGlzIFwibWFzdGVyXCJcblxuICBpc1JvbGVTbGF2ZTogLT5cbiAgICBAcm9sZSBpcyBcInNsYXZlXCJcblxuICBmaW5kTmV3U3luY1RhcmdldDogKCktPlxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICBmb3IgdXNlciwgYyBvZiBAY29ubmVjdGlvbnNcbiAgICAgICAgaWYgbm90IGMuaXNfc3luY2VkXG4gICAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcbiAgICAgICAgICBicmVha1xuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBzZXRTdGF0ZVN5bmNlZCgpXG4gICAgbnVsbFxuXG4gIHVzZXJMZWZ0OiAodXNlciktPlxuICAgIGRlbGV0ZSBAY29ubmVjdGlvbnNbdXNlcl1cbiAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gIHVzZXJKb2luZWQ6ICh1c2VyLCByb2xlKS0+XG4gICAgaWYgbm90IHJvbGU/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJbnRlcm5hbDogWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhIEUuZy4gdXNlckpvaW5lZCgndWlkOjM5MzknLCdzbGF2ZScpXCJcbiAgICAjIGEgdXNlciBqb2luZWQgdGhlIHJvb21cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0gPz0ge31cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0uaXNfc3luY2VkID0gZmFsc2VcblxuICAgIGlmIChub3QgQGlzX3N5bmNlZCkgb3IgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgICAjIFRPRE86IFdoYXQgaWYgdGhlcmUgYXJlIHR3byBtYXN0ZXJzPyBQcmV2ZW50IHNlbmRpbmcgZXZlcnl0aGluZyB0d28gdGltZXMhXG4gICAgICAgIEBwZXJmb3JtU3luY1dpdGhNYXN0ZXIgdXNlclxuXG5cbiAgI1xuICAjIEV4ZWN1dGUgYSBmdW5jdGlvbiBfd2hlbl8gd2UgYXJlIGNvbm5lY3RlZC4gSWYgbm90IGNvbm5lY3RlZCwgd2FpdCB1bnRpbCBjb25uZWN0ZWQuXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuXG4gICNcbiAgd2hlblN5bmNlZDogKGFyZ3MpLT5cbiAgICBpZiBhcmdzLmNvbnN0cnVjdG9yZSBpcyBGdW5jdGlvblxuICAgICAgYXJncyA9IFthcmdzXVxuICAgIGlmIEBpc19zeW5jZWRcbiAgICAgIGFyZ3NbMF0uYXBwbHkgdGhpcywgYXJnc1sxLi5dXG4gICAgZWxzZVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkLnB1c2ggYXJnc1xuXG4gICNcbiAgIyBFeGVjdXRlIGFuIGZ1bmN0aW9uIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LiBmIHdpbGwgYmUgY2FsbGVkIHdpdGggKHNlbmRlcl9pZCwgYnJvYWRjYXN0IHt0cnVlfGZhbHNlfSwgbWVzc2FnZSkuXG4gICNcbiAgb25SZWNlaXZlOiAoZiktPlxuICAgIEByZWNlaXZlX2hhbmRsZXJzLnB1c2ggZlxuXG4gICMjI1xuICAjIEJyb2FkY2FzdCBhIG1lc3NhZ2UgdG8gYWxsIGNvbm5lY3RlZCBwZWVycy5cbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXG4gICNcbiAgYnJvYWRjYXN0OiAobWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcblxuICAjXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcbiAgI1xuICBzZW5kOiAocGVlcl9zLCBtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcbiAgIyMjXG5cbiAgI1xuICAjIHBlcmZvcm0gYSBzeW5jIHdpdGggYSBzcGVjaWZpYyB1c2VyLlxuICAjXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgICAgQHNlbmQgdXNlcixcbiAgICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgZGF0YTogW10gIyBAZ2V0U3RhdGVWZWN0b3IoKVxuICAgICAgaWYgbm90IEBzZW50X2hiX3RvX2FsbF91c2Vyc1xuICAgICAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSB0cnVlXG5cbiAgICAgICAgaGIgPSBAZ2V0SEIoW10pLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG4gICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICAgICAgZGF0YTogX2hiXG5cblxuXG4gICNcbiAgIyBXaGVuIGEgbWFzdGVyIG5vZGUgam9pbmVkIHRoZSByb29tLCBwZXJmb3JtIHRoaXMgc3luYyB3aXRoIGhpbS4gSXQgd2lsbCBhc2sgdGhlIG1hc3RlciBmb3IgdGhlIEhCLFxuICAjIGFuZCB3aWxsIGJyb2FkY2FzdCBoaXMgb3duIEhCXG4gICNcbiAgcGVyZm9ybVN5bmNXaXRoTWFzdGVyOiAodXNlciktPlxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgIEBzZW5kIHVzZXIsXG4gICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxuICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgIGRhdGE6IFtdXG4gICAgaGIgPSBAZ2V0SEIoW10pLmhiXG4gICAgX2hiID0gW11cbiAgICBmb3IgbyBpbiBoYlxuICAgICAgX2hiLnB1c2ggb1xuICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICBfaGIgPSBbXVxuICAgIEBicm9hZGNhc3RcbiAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcbiAgICAgIGRhdGE6IF9oYlxuXG4gICNcbiAgIyBZb3UgYXJlIHN1cmUgdGhhdCBhbGwgY2xpZW50cyBhcmUgc3luY2VkLCBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICNcbiAgc2V0U3RhdGVTeW5jZWQ6ICgpLT5cbiAgICBpZiBub3QgQGlzX3N5bmNlZFxuICAgICAgQGlzX3N5bmNlZCA9IHRydWVcbiAgICAgIGlmIEBjb21wdXRlX3doZW5fc3luY2VkP1xuICAgICAgICBmb3IgZiBpbiBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgICAgIGYoKVxuICAgICAgICBkZWxldGUgQGNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgIG51bGxcblxuICAjXG4gICMgWW91IHJlY2VpdmVkIGEgcmF3IG1lc3NhZ2UsIGFuZCB5b3Uga25vdyB0aGF0IGl0IGlzIGludGVuZGVkIGZvciB0byBZanMuIFRoZW4gY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cbiAgICBpZiBub3QgcmVzLnN5bmNfc3RlcD9cbiAgICAgIGZvciBmIGluIEByZWNlaXZlX2hhbmRsZXJzXG4gICAgICAgIGYgc2VuZGVyLCByZXNcbiAgICBlbHNlXG4gICAgICBpZiBzZW5kZXIgaXMgQHVzZXJfaWRcbiAgICAgICAgcmV0dXJuXG4gICAgICBpZiByZXMuc3luY19zdGVwIGlzIFwiZ2V0SEJcIlxuICAgICAgICBkYXRhID0gQGdldEhCKHJlcy5kYXRhKVxuICAgICAgICBoYiA9IGRhdGEuaGJcbiAgICAgICAgX2hiID0gW11cbiAgICAgICAgIyBhbHdheXMgYnJvYWRjYXN0LCB3aGVuIG5vdCBzeW5jZWQuXG4gICAgICAgICMgVGhpcyByZWR1Y2VzIGVycm9ycywgd2hlbiB0aGUgY2xpZW50cyBnb2VzIG9mZmxpbmUgcHJlbWF0dXJlbHkuXG4gICAgICAgICMgV2hlbiB0aGlzIGNsaWVudCBvbmx5IHN5bmNzIHRvIG9uZSBvdGhlciBjbGllbnRzLCBidXQgbG9vc2VzIGNvbm5lY3RvcnMsXG4gICAgICAgICMgYmVmb3JlIHN5bmNpbmcgdG8gdGhlIG90aGVyIGNsaWVudHMsIHRoZSBvbmxpbmUgY2xpZW50cyBoYXZlIGRpZmZlcmVudCBzdGF0ZXMuXG4gICAgICAgICMgU2luY2Ugd2UgZG8gbm90IHdhbnQgdG8gcGVyZm9ybSByZWd1bGFyIHN5bmNzLCB0aGlzIGlzIGEgZ29vZCBhbHRlcm5hdGl2ZVxuICAgICAgICBpZiBAaXNfc3luY2VkXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQHNlbmQgc2VuZGVyLCBtXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XG4gICAgICAgICAgICBAYnJvYWRjYXN0IG1cblxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgICAgIHNlbmRBcHBseUhCXG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgX2hiID0gW11cblxuICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgIHN5bmNfc3RlcCA6IFwiYXBwbHlIQlwiXG4gICAgICAgICAgZGF0YTogX2hiXG5cbiAgICAgICAgaWYgcmVzLnNlbmRfYWdhaW4/IGFuZCBAcGVyZm9ybV9zZW5kX2FnYWluXG4gICAgICAgICAgc2VuZF9hZ2FpbiA9IGRvIChzdiA9IGRhdGEuc3RhdGVfdmVjdG9yKT0+XG4gICAgICAgICAgICAoKT0+XG4gICAgICAgICAgICAgIGhiID0gQGdldEhCKHN2KS5oYlxuICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXG4gICAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIixcbiAgICAgICAgICAgICAgICBkYXRhOiBoYlxuICAgICAgICAgICAgICAgIHNlbnRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kX2FnYWluLCAzMDAwXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCXCJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcblxuICAgICAgICBpZiAoQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCIgb3IgcmVzLnNlbnRfYWdhaW4/KSBhbmQgKG5vdCBAaXNfc3luY2VkKSBhbmQgKChAY3VycmVudF9zeW5jX3RhcmdldCBpcyBzZW5kZXIpIG9yIChub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/KSlcbiAgICAgICAgICBAY29ubmVjdGlvbnNbc2VuZGVyXS5pc19zeW5jZWQgPSB0cnVlXG4gICAgICAgICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcblxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQl9cIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG5cbiAgIyBDdXJyZW50bHksIHRoZSBIQiBlbmNvZGVzIG9wZXJhdGlvbnMgYXMgSlNPTi4gRm9yIHRoZSBtb21lbnQgSSB3YW50IHRvIGtlZXAgaXRcbiAgIyB0aGF0IHdheS4gTWF5YmUgd2Ugc3VwcG9ydCBlbmNvZGluZyBpbiB0aGUgSEIgYXMgWE1MIGluIHRoZSBmdXR1cmUsIGJ1dCBmb3Igbm93IEkgZG9uJ3Qgd2FudFxuICAjIHRvbyBtdWNoIG92ZXJoZWFkLiBZIGlzIHZlcnkgbGlrZWx5IHRvIGdldCBjaGFuZ2VkIGEgbG90IGluIHRoZSBmdXR1cmVcbiAgI1xuICAjIEJlY2F1c2Ugd2UgZG9uJ3Qgd2FudCB0byBlbmNvZGUgSlNPTiBhcyBzdHJpbmcgKHdpdGggY2hhcmFjdGVyIGVzY2FwaW5nLCB3aWNoIG1ha2VzIGl0IHByZXR0eSBtdWNoIHVucmVhZGFibGUpXG4gICMgd2UgZW5jb2RlIHRoZSBKU09OIGFzIFhNTC5cbiAgI1xuICAjIFdoZW4gdGhlIEhCIHN1cHBvcnQgZW5jb2RpbmcgYXMgWE1MLCB0aGUgZm9ybWF0IHNob3VsZCBsb29rIHByZXR0eSBtdWNoIGxpa2UgdGhpcy5cblxuICAjIGRvZXMgbm90IHN1cHBvcnQgcHJpbWl0aXZlIHZhbHVlcyBhcyBhcnJheSBlbGVtZW50c1xuICAjIGV4cGVjdHMgYW4gbHR4IChsZXNzIHRoYW4geG1sKSBvYmplY3RcbiAgcGFyc2VNZXNzYWdlRnJvbVhtbDogKG0pLT5cbiAgICBwYXJzZV9hcnJheSA9IChub2RlKS0+XG4gICAgICBmb3IgbiBpbiBub2RlLmNoaWxkcmVuXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxuICAgICAgICAgIHBhcnNlX2FycmF5IG5cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHBhcnNlX29iamVjdCBuXG5cbiAgICBwYXJzZV9vYmplY3QgPSAobm9kZSktPlxuICAgICAganNvbiA9IHt9XG4gICAgICBmb3IgbmFtZSwgdmFsdWUgIG9mIG5vZGUuYXR0cnNcbiAgICAgICAgaW50ID0gcGFyc2VJbnQodmFsdWUpXG4gICAgICAgIGlmIGlzTmFOKGludCkgb3IgKFwiXCIraW50KSBpc250IHZhbHVlXG4gICAgICAgICAganNvbltuYW1lXSA9IHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uW25hbWVdID0gaW50XG4gICAgICBmb3IgbiBpbiBub2RlLmNoaWxkcmVuXG4gICAgICAgIG5hbWUgPSBuLm5hbWVcbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX2FycmF5IG5cbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9vYmplY3QgblxuICAgICAganNvblxuICAgIHBhcnNlX29iamVjdCBtXG5cbiAgIyBlbmNvZGUgbWVzc2FnZSBpbiB4bWxcbiAgIyB3ZSB1c2Ugc3RyaW5nIGJlY2F1c2UgU3Ryb3BoZSBvbmx5IGFjY2VwdHMgYW4gXCJ4bWwtc3RyaW5nXCIuLlxuICAjIFNvIHthOjQsYjp7Yzo1fX0gd2lsbCBsb29rIGxpa2VcbiAgIyA8eSBhPVwiNFwiPlxuICAjICAgPGIgYz1cIjVcIj48L2I+XG4gICMgPC95PlxuICAjIG0gLSBsdHggZWxlbWVudFxuICAjIGpzb24gLSBndWVzcyBpdCA7KVxuICAjXG4gIGVuY29kZU1lc3NhZ2VUb1htbDogKG0sIGpzb24pLT5cbiAgICAjIGF0dHJpYnV0ZXMgaXMgb3B0aW9uYWxcbiAgICBlbmNvZGVfb2JqZWN0ID0gKG0sIGpzb24pLT5cbiAgICAgIGZvciBuYW1lLHZhbHVlIG9mIGpzb25cbiAgICAgICAgaWYgbm90IHZhbHVlP1xuICAgICAgICAgICMgbm9wXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgZW5jb2RlX29iamVjdCBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKG5hbWUpLCB2YWx1ZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgbS5zZXRBdHRyaWJ1dGUobmFtZSx2YWx1ZSlcbiAgICAgIG1cbiAgICBlbmNvZGVfYXJyYXkgPSAobSwgYXJyYXkpLT5cbiAgICAgIG0uc2V0QXR0cmlidXRlKFwiaXNBcnJheVwiLFwidHJ1ZVwiKVxuICAgICAgZm9yIGUgaW4gYXJyYXlcbiAgICAgICAgaWYgZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJhcnJheS1lbGVtZW50XCIpLCBlXG4gICAgICBtXG4gICAgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwieVwiLHt4bWxuczpcImh0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemFcIn0pLCBqc29uXG4gICAgZWxzZSBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIEFycmF5XG4gICAgICBlbmNvZGVfYXJyYXkgbS5jKFwieVwiLHt4bWxuczpcImh0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemFcIn0pLCBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSSBjYW4ndCBlbmNvZGUgdGhpcyBqc29uIVwiXG5cbiAgc2V0SXNCb3VuZFRvWTogKCktPlxuICAgIEBvbl9ib3VuZF90b195PygpXG4gICAgZGVsZXRlIEB3aGVuX2JvdW5kX3RvX3lcbiAgICBAaXNfYm91bmRfdG9feSA9IHRydWVcbiIsIlxud2luZG93Py51bnByb2Nlc3NlZF9jb3VudGVyID0gMCAjIGRlbCB0aGlzXG53aW5kb3c/LnVucHJvY2Vzc2VkX2V4ZWNfY291bnRlciA9IDAgIyBUT0RPXG53aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzID0gW11cblxuI1xuIyBAbm9kb2NcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cbiNcbmNsYXNzIEVuZ2luZVxuXG4gICNcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICMgQHBhcmFtIHtPYmplY3R9IHR5cGVzIGxpc3Qgb2YgYXZhaWxhYmxlIHR5cGVzXG4gICNcbiAgY29uc3RydWN0b3I6IChASEIsIEB0eXBlcyktPlxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxuXG4gICNcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cbiAgI1xuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cbiAgICB0eXBlID0gQHR5cGVzW2pzb24udHlwZV1cbiAgICBpZiB0eXBlPy5wYXJzZT9cbiAgICAgIHR5cGUucGFyc2UganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcblxuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxuICAjIEBub3RlIFlvdSBtdXN0IG5vdCB1c2UgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYWxyZWFkeSBoYXZlIG9wcyBpbiB5b3VyIEhCIVxuICAjIyNcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxuICAgIG9wcyA9IFtdXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXG4gICAgZm9yIG8gaW4gb3BzXG4gICAgICBpZiBub3Qgby5leGVjdXRlKClcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuICAjIyNcblxuICAjXG4gICMgU2FtZSBhcyBhcHBseU9wcyBidXQgb3BlcmF0aW9ucyB0aGF0IGFyZSBhbHJlYWR5IGluIHRoZSBIQiBhcmUgbm90IGFwcGxpZWQuXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcbiAgI1xuICBhcHBseU9wc0NoZWNrRG91YmxlOiAob3BzX2pzb24pLT5cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xuICAgICAgICBAYXBwbHlPcCBvXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIChIZWxwZXIgZm9yIHVzaW5nIGFwcGx5T3Agb24gQXJyYXlzKVxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxuICAgIEBhcHBseU9wIG9wc19qc29uXG5cbiAgI1xuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cbiAgIyBUT0RPOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhIVxuICAjIC0gb3BlcmF0aW9ucyBtYXkgb25seSBleGVjdXRlZCBpbiBvcmRlciBieSBjcmVhdG9yLCBvcmRlciB0aGVtIGluIG9iamVjdCBvZiBhcnJheXMgKGtleSBieSBjcmVhdG9yKVxuICAjIC0geW91IGNhbiBwcm9iYWJseSBtYWtlIHNvbWV0aGluZyBsaWtlIGRlcGVuZGVuY2llcyAoY3JlYXRvcjEgd2FpdHMgZm9yIGNyZWF0b3IyKVxuICBhcHBseU9wOiAob3BfanNvbl9hcnJheSwgZnJvbUhCID0gZmFsc2UpLT5cbiAgICBpZiBvcF9qc29uX2FycmF5LmNvbnN0cnVjdG9yIGlzbnQgQXJyYXlcbiAgICAgIG9wX2pzb25fYXJyYXkgPSBbb3BfanNvbl9hcnJheV1cbiAgICBmb3Igb3BfanNvbiBpbiBvcF9qc29uX2FycmF5XG4gICAgICBpZiBmcm9tSEJcbiAgICAgICAgb3BfanNvbi5mcm9tSEIgPSBcInRydWVcIiAjIGV4ZWN1dGUgaW1tZWRpYXRlbHksIGlmXG4gICAgICAjICRwYXJzZV9hbmRfZXhlY3V0ZSB3aWxsIHJldHVybiBmYWxzZSBpZiAkb19qc29uIHdhcyBwYXJzZWQgYW5kIGV4ZWN1dGVkLCBvdGhlcndpc2UgdGhlIHBhcnNlZCBvcGVyYWRpb25cbiAgICAgIG8gPSBAcGFyc2VPcGVyYXRpb24gb3BfanNvblxuICAgICAgby5wYXJzZWRfZnJvbV9qc29uID0gb3BfanNvblxuICAgICAgaWYgb3BfanNvbi5mcm9tSEI/XG4gICAgICAgIG8uZnJvbUhCID0gb3BfanNvbi5mcm9tSEJcbiAgICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXG4gICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG8pP1xuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiAoKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgYW5kIChub3Qgby5mcm9tSEI/KSkgb3IgKG5vdCBvLmV4ZWN1dGUoKSlcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICAgICAgd2luZG93Py51bnByb2Nlc3NlZF90eXBlcy5wdXNoIG8udHlwZSAjIFRPRE86IGRlbGV0ZSB0aGlzXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcblxuICAjXG4gICMgQ2FsbCB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhcHBsaWVkIGEgbmV3IG9wZXJhdGlvbi5cbiAgIyBJdCBjaGVja3MgaWYgb3BlcmF0aW9ucyB0aGF0IHdlcmUgcHJldmlvdXNseSBub3QgZXhlY3V0YWJsZSBhcmUgbm93IGV4ZWN1dGFibGUuXG4gICNcbiAgdHJ5VW5wcm9jZXNzZWQ6ICgpLT5cbiAgICB3aGlsZSB0cnVlXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcbiAgICAgIHVucHJvY2Vzc2VkID0gW11cbiAgICAgIGZvciBvcCBpbiBAdW5wcm9jZXNzZWRfb3BzXG4gICAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24ob3ApP1xuICAgICAgICAgICMgbm9wXG4gICAgICAgIGVsc2UgaWYgKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvcCkgYW5kIChub3Qgb3AuZnJvbUhCPykpIG9yIChub3Qgb3AuZXhlY3V0ZSgpKVxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxuICAgICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXMgb2xkX2xlbmd0aFxuICAgICAgICBicmVha1xuICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzbnQgMFxuICAgICAgQEhCLmludm9rZVN5bmMoKVxuXG5cbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCJcbiNcbiMgQG5vZG9jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cbiAgICBAZ2FyYmFnZSA9IFtdICMgV2lsbCBiZSBjbGVhbmVkIG9uIG5leHQgY2FsbCBvZiBnYXJiYWdlQ29sbGVjdG9yXG4gICAgQHRyYXNoID0gW10gIyBJcyBkZWxldGVkLiBXYWl0IHVudGlsIGl0IGlzIG5vdCB1c2VkIGFueW1vcmUuXG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IHRydWVcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gMzAwMDBcbiAgICBAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyID0gMFxuICAgIHNldFRpbWVvdXQgQGVtcHR5R2FyYmFnZSwgQGdhcmJhZ2VDb2xsZWN0VGltZW91dFxuXG4gIHJlc2V0VXNlcklkOiAoaWQpLT5cbiAgICBvd24gPSBAYnVmZmVyW0B1c2VyX2lkXVxuICAgIGlmIG93bj9cbiAgICAgIGZvciBvX25hbWUsbyBvZiBvd25cbiAgICAgICAgaWYgby51aWQuY3JlYXRvcj9cbiAgICAgICAgICBvLnVpZC5jcmVhdG9yID0gaWRcbiAgICAgICAgaWYgby51aWQuYWx0P1xuICAgICAgICAgIG8udWlkLmFsdC5jcmVhdG9yID0gaWRcbiAgICAgIGlmIEBidWZmZXJbaWRdP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgYXJlIHJlLWFzc2lnbmluZyBhbiBvbGQgdXNlciBpZCAtIHRoaXMgaXMgbm90ICh5ZXQpIHBvc3NpYmxlIVwiXG4gICAgICBAYnVmZmVyW2lkXSA9IG93blxuICAgICAgZGVsZXRlIEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltpZF0gPSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgICBkZWxldGUgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxuICAgIEB1c2VyX2lkID0gaWRcblxuICBlbXB0eUdhcmJhZ2U6ICgpPT5cbiAgICBmb3IgbyBpbiBAZ2FyYmFnZVxuICAgICAgI2lmIEBnZXRPcGVyYXRpb25Db3VudGVyKG8udWlkLmNyZWF0b3IpID4gby51aWQub3BfbnVtYmVyXG4gICAgICBvLmNsZWFudXA/KClcblxuICAgIEBnYXJiYWdlID0gQHRyYXNoXG4gICAgQHRyYXNoID0gW11cbiAgICBpZiBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0IGlzbnQgLTFcbiAgICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZCA9IHNldFRpbWVvdXQgQGVtcHR5R2FyYmFnZSwgQGdhcmJhZ2VDb2xsZWN0VGltZW91dFxuICAgIHVuZGVmaW5lZFxuXG4gICNcbiAgIyBHZXQgdGhlIHVzZXIgaWQgd2l0aCB3aWNoIHRoZSBIaXN0b3J5IEJ1ZmZlciB3YXMgaW5pdGlhbGl6ZWQuXG4gICNcbiAgZ2V0VXNlcklkOiAoKS0+XG4gICAgQHVzZXJfaWRcblxuICBhZGRUb0dhcmJhZ2VDb2xsZWN0b3I6ICgpLT5cbiAgICBpZiBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uXG4gICAgICBmb3IgbyBpbiBhcmd1bWVudHNcbiAgICAgICAgaWYgbz9cbiAgICAgICAgICBAZ2FyYmFnZS5wdXNoIG9cblxuICBzdG9wR2FyYmFnZUNvbGxlY3Rpb246ICgpLT5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gZmFsc2VcbiAgICBAc2V0TWFudWFsR2FyYmFnZUNvbGxlY3QoKVxuICAgIEBnYXJiYWdlID0gW11cbiAgICBAdHJhc2ggPSBbXVxuXG4gIHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0OiAoKS0+XG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IC0xXG4gICAgY2xlYXJUaW1lb3V0IEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZFxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRJZCA9IHVuZGVmaW5lZFxuXG4gIHNldEdhcmJhZ2VDb2xsZWN0VGltZW91dDogKEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQpLT5cblxuICAjXG4gICMgSSBwcm9wb3NlIHRvIHVzZSBpdCBpbiB5b3VyIEZyYW1ld29yaywgdG8gY3JlYXRlIHNvbWV0aGluZyBsaWtlIGEgcm9vdCBlbGVtZW50LlxuICAjIEFuIG9wZXJhdGlvbiB3aXRoIHRoaXMgaWRlbnRpZmllciBpcyBub3QgcHJvcGFnYXRlZCB0byBvdGhlciBjbGllbnRzLlxuICAjIFRoaXMgaXMgd2h5IGV2ZXJ5Ym9kZSBtdXN0IGNyZWF0ZSB0aGUgc2FtZSBvcGVyYXRpb24gd2l0aCB0aGlzIHVpZC5cbiAgI1xuICBnZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXI6ICgpLT5cbiAgICB7XG4gICAgICBjcmVhdG9yIDogJ18nXG4gICAgICBvcF9udW1iZXIgOiBcIl8je0ByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIrK31cIlxuICAgIH1cblxuICAjXG4gICMgR2V0IHRoZSBvcGVyYXRpb24gY291bnRlciB0aGF0IGRlc2NyaWJlcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgZG9jdW1lbnQuXG4gICNcbiAgZ2V0T3BlcmF0aW9uQ291bnRlcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHJlcyA9IHt9XG4gICAgICBmb3IgdXNlcixjdG4gb2YgQG9wZXJhdGlvbl9jb3VudGVyXG4gICAgICAgIHJlc1t1c2VyXSA9IGN0blxuICAgICAgcmVzXG4gICAgZWxzZVxuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG5cbiAgaXNFeHBlY3RlZE9wZXJhdGlvbjogKG8pLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxuICAgIG8udWlkLm9wX251bWJlciA8PSBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICB0cnVlICNUT0RPOiAhISB0aGlzIGNvdWxkIGJyZWFrIHN0dWZmLiBCdXQgSSBkdW5ubyB3aHlcblxuICAjXG4gICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgIyBUT0RPOiBNYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhXG4gIF9lbmNvZGU6IChzdGF0ZV92ZWN0b3I9e30pLT5cbiAgICBqc29uID0gW11cbiAgICB1bmtub3duID0gKHVzZXIsIG9fbnVtYmVyKS0+XG4gICAgICBpZiAobm90IHVzZXI/KSBvciAobm90IG9fbnVtYmVyPylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZGFoIVwiXG4gICAgICBub3Qgc3RhdGVfdmVjdG9yW3VzZXJdPyBvciBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gb19udW1iZXJcblxuICAgIGZvciB1X25hbWUsdXNlciBvZiBAYnVmZmVyXG4gICAgICAjIFRPRE8gbmV4dCwgaWYgQHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBzdGF0ZV92ZWN0b3JbdXNlcl1cbiAgICAgIGlmIHVfbmFtZSBpcyBcIl9cIlxuICAgICAgICBjb250aW51ZVxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiAobm90IG8udWlkLm5vT3BlcmF0aW9uPykgYW5kIHVua25vd24odV9uYW1lLCBvX251bWJlcilcbiAgICAgICAgICAjIGl0cyBuZWNlc3NhcnkgdG8gc2VuZCBpdCwgYW5kIG5vdCBrbm93biBpbiBzdGF0ZV92ZWN0b3JcbiAgICAgICAgICBvX2pzb24gPSBvLl9lbmNvZGUoKVxuICAgICAgICAgIGlmIG8ubmV4dF9jbD8gIyBhcHBsaWVzIGZvciBhbGwgb3BzIGJ1dCB0aGUgbW9zdCByaWdodCBkZWxpbWl0ZXIhXG4gICAgICAgICAgICAjIHNlYXJjaCBmb3IgdGhlIG5leHQgX2tub3duXyBvcGVyYXRpb24uIChXaGVuIHN0YXRlX3ZlY3RvciBpcyB7fSB0aGVuIHRoaXMgaXMgdGhlIERlbGltaXRlcilcbiAgICAgICAgICAgIG9fbmV4dCA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgd2hpbGUgb19uZXh0Lm5leHRfY2w/IGFuZCB1bmtub3duKG9fbmV4dC51aWQuY3JlYXRvciwgb19uZXh0LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fbmV4dCA9IG9fbmV4dC5uZXh0X2NsXG4gICAgICAgICAgICBvX2pzb24ubmV4dCA9IG9fbmV4dC5nZXRVaWQoKVxuICAgICAgICAgIGVsc2UgaWYgby5wcmV2X2NsPyAjIG1vc3QgcmlnaHQgZGVsaW1pdGVyIG9ubHkhXG4gICAgICAgICAgICAjIHNhbWUgYXMgdGhlIGFib3ZlIHdpdGggcHJldi5cbiAgICAgICAgICAgIG9fcHJldiA9IG8ucHJldl9jbFxuICAgICAgICAgICAgd2hpbGUgb19wcmV2LnByZXZfY2w/IGFuZCB1bmtub3duKG9fcHJldi51aWQuY3JlYXRvciwgb19wcmV2LnVpZC5vcF9udW1iZXIpXG4gICAgICAgICAgICAgIG9fcHJldiA9IG9fcHJldi5wcmV2X2NsXG4gICAgICAgICAgICBvX2pzb24ucHJldiA9IG9fcHJldi5nZXRVaWQoKVxuICAgICAgICAgIGpzb24ucHVzaCBvX2pzb25cblxuICAgIGpzb25cblxuICAjXG4gICMgR2V0IHRoZSBudW1iZXIgb2Ygb3BlcmF0aW9ucyB0aGF0IHdlcmUgY3JlYXRlZCBieSBhIHVzZXIuXG4gICMgQWNjb3JkaW5nbHkgeW91IHdpbGwgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBudW1iZXIgdGhhdCBpcyBleHBlY3RlZCBmcm9tIHRoYXQgdXNlci5cbiAgIyBUaGlzIHdpbGwgaW5jcmVtZW50IHRoZSBvcGVyYXRpb24gY291bnRlci5cbiAgI1xuICBnZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcjogKHVzZXJfaWQpLT5cbiAgICBpZiBub3QgdXNlcl9pZD9cbiAgICAgIHVzZXJfaWQgPSBAdXNlcl9pZFxuICAgIGlmIG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0gPSAwXG4gICAgdWlkID1cbiAgICAgICdjcmVhdG9yJyA6IHVzZXJfaWRcbiAgICAgICdvcF9udW1iZXInIDogQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdKytcbiAgICB1aWRcblxuICAjXG4gICMgUmV0cmlldmUgYW4gb3BlcmF0aW9uIGZyb20gYSB1bmlxdWUgaWQuXG4gICNcbiAgIyB3aGVuIHVpZCBoYXMgYSBcInN1YlwiIHByb3BlcnR5LCB0aGUgdmFsdWUgb2YgaXQgd2lsbCBiZSBhcHBsaWVkXG4gICMgb24gdGhlIG9wZXJhdGlvbnMgcmV0cmlldmVTdWIgbWV0aG9kICh3aGljaCBtdXN0ISBiZSBkZWZpbmVkKVxuICAjXG4gIGdldE9wZXJhdGlvbjogKHVpZCktPlxuICAgIGlmIHVpZC51aWQ/XG4gICAgICB1aWQgPSB1aWQudWlkXG4gICAgbyA9IEBidWZmZXJbdWlkLmNyZWF0b3JdP1t1aWQub3BfbnVtYmVyXVxuICAgIGlmIHVpZC5zdWI/IGFuZCBvP1xuICAgICAgby5yZXRyaWV2ZVN1YiB1aWQuc3ViXG4gICAgZWxzZVxuICAgICAgb1xuXG4gICNcbiAgIyBBZGQgYW4gb3BlcmF0aW9uIHRvIHRoZSBIQi4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgbGluayBpdCBhZ2FpbnN0XG4gICMgb3RoZXIgb3BlcmF0aW9ucyAoaXQgd29udCBleGVjdXRlZClcbiAgI1xuICBhZGRPcGVyYXRpb246IChvKS0+XG4gICAgaWYgbm90IEBidWZmZXJbby51aWQuY3JlYXRvcl0/XG4gICAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdID0ge31cbiAgICBpZiBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgb3ZlcndyaXRlIG9wZXJhdGlvbnMhXCJcbiAgICBpZiAoby51aWQub3BfbnVtYmVyLmNvbnN0cnVjdG9yIGlzbnQgU3RyaW5nKSBhbmQgKG5vdCBAaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgYW5kIChub3Qgby5mcm9tSEI/KSAjIHlvdSBhbHJlYWR5IGRvIHRoaXMgaW4gdGhlIGVuZ2luZSwgc28gZGVsZXRlIGl0IGhlcmUhXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIG9wZXJhdGlvbiB3YXMgbm90IGV4cGVjdGVkIVwiXG4gICAgQGFkZFRvQ291bnRlcihvKVxuICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXSA9IG9cbiAgICBvXG5cbiAgcmVtb3ZlT3BlcmF0aW9uOiAobyktPlxuICAgIGRlbGV0ZSBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1tvLnVpZC5vcF9udW1iZXJdXG5cbiAgIyBXaGVuIHRoZSBIQiBkZXRlcm1pbmVzIGluY29uc2lzdGVuY2llcywgdGhlbiB0aGUgaW52b2tlU3luY1xuICAjIGhhbmRsZXIgd2lsIGJlIGNhbGxlZCwgd2hpY2ggc2hvdWxkIHNvbWVob3cgaW52b2tlIHRoZSBzeW5jIHdpdGggYW5vdGhlciBjb2xsYWJvcmF0b3IuXG4gICMgVGhlIHBhcmFtZXRlciBvZiB0aGUgc3luYyBoYW5kbGVyIGlzIHRoZSB1c2VyX2lkIHdpdGggd2ljaCBhbiBpbmNvbnNpc3RlbmN5IHdhcyBkZXRlcm1pbmVkXG4gIHNldEludm9rZVN5bmNIYW5kbGVyOiAoZiktPlxuICAgIEBpbnZva2VTeW5jID0gZlxuXG4gICMgZW1wdHkgcGVyIGRlZmF1bHQgIyBUT0RPOiBkbyBpIG5lZWQgdGhpcz9cbiAgaW52b2tlU3luYzogKCktPlxuXG4gICMgYWZ0ZXIgeW91IHJlY2VpdmVkIHRoZSBIQiBvZiBhbm90aGVyIHVzZXIgKGluIHRoZSBzeW5jIHByb2Nlc3MpLFxuICAjIHlvdSByZW5ldyB5b3VyIG93biBzdGF0ZV92ZWN0b3IgdG8gdGhlIHN0YXRlX3ZlY3RvciBvZiB0aGUgb3RoZXIgdXNlclxuICByZW5ld1N0YXRlVmVjdG9yOiAoc3RhdGVfdmVjdG9yKS0+XG4gICAgZm9yIHVzZXIsc3RhdGUgb2Ygc3RhdGVfdmVjdG9yXG4gICAgICBpZiAoKG5vdCBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0/KSBvciAoQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdIDwgc3RhdGVfdmVjdG9yW3VzZXJdKSkgYW5kIHN0YXRlX3ZlY3Rvclt1c2VyXT9cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdID0gc3RhdGVfdmVjdG9yW3VzZXJdXG5cbiAgI1xuICAjIEluY3JlbWVudCB0aGUgb3BlcmF0aW9uX2NvdW50ZXIgdGhhdCBkZWZpbmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBFbmdpbmUuXG4gICNcbiAgYWRkVG9Db3VudGVyOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgaWYgby51aWQuY3JlYXRvciBpc250IEBnZXRVc2VySWQoKVxuICAgICAgIyBUT0RPOiBjaGVjayBpZiBvcGVyYXRpb25zIGFyZSBzZW5kIGluIG9yZGVyXG4gICAgICBpZiBvLnVpZC5vcF9udW1iZXIgaXMgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgICB3aGlsZSBAYnVmZmVyW28udWlkLmNyZWF0b3JdW0BvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXV0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgICB1bmRlZmluZWRcblxuICAgICNpZiBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gaXNudCAoby51aWQub3BfbnVtYmVyICsgMSlcbiAgICAgICNjb25zb2xlLmxvZyAoQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIC0gKG8udWlkLm9wX251bWJlciArIDEpKVxuICAgICAgI2NvbnNvbGUubG9nIG9cbiAgICAgICN0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZG9uJ3QgcmVjZWl2ZSBvcGVyYXRpb25zIGluIHRoZSBwcm9wZXIgb3JkZXIuIFRyeSBjb3VudGluZyBsaWtlIHRoaXMgMCwxLDIsMyw0LC4uIDspXCJcblxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXG4iLCJcbmNsYXNzIFlPYmplY3RcblxuICBjb25zdHJ1Y3RvcjogKEBfb2JqZWN0ID0ge30pLT5cbiAgICBpZiBAX29iamVjdC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgIGZvciBuYW1lLCB2YWwgb2YgQF9vYmplY3RcbiAgICAgICAgaWYgdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIEBfb2JqZWN0W25hbWVdID0gbmV3IFlPYmplY3QodmFsKVxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlkuT2JqZWN0IGFjY2VwdHMgSnNvbiBPYmplY3RzIG9ubHlcIlxuXG4gIF9uYW1lOiBcIk9iamVjdFwiXG5cbiAgX2dldE1vZGVsOiAodHlwZXMsIG9wcyktPlxuICAgIGlmIG5vdCBAX21vZGVsP1xuICAgICAgQF9tb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihAKS5leGVjdXRlKClcbiAgICAgIGZvciBuLG8gb2YgQF9vYmplY3RcbiAgICAgICAgQF9tb2RlbC52YWwgbiwgb1xuICAgIGRlbGV0ZSBAX29iamVjdFxuICAgIEBfbW9kZWxcblxuICBfc2V0TW9kZWw6IChAX21vZGVsKS0+XG4gICAgZGVsZXRlIEBfb2JqZWN0XG5cbiAgb2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLm9ic2VydmUgZlxuICAgIEBcblxuICB1bm9ic2VydmU6IChmKS0+XG4gICAgQF9tb2RlbC51bm9ic2VydmUgZlxuICAgIEBcblxuICAjXG4gICMgQG92ZXJsb2FkIHZhbCgpXG4gICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAjICAgQHJldHVybiBbSnNvbl1cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGV8fFN0cmluZ3xPYmplY3RdIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LiBJZiBtdXRhYmxlIGl0IHdpbGwgcmV0dXJuIGEgT3BlcmF0aW9uLXR5cGUgb2JqZWN0LCBpZiBpbW11dGFibGUgaXQgd2lsbCByZXR1cm4gU3RyaW5nL09iamVjdC5cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwobmFtZSwgY29udGVudClcbiAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gY29udGVudCBDb250ZW50IG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgI1xuICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgaWYgQF9tb2RlbD9cbiAgICAgIEBfbW9kZWwudmFsLmFwcGx5IEBfbW9kZWwsIGFyZ3VtZW50c1xuICAgIGVsc2VcbiAgICAgIGlmIGNvbnRlbnQ/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdID0gY29udGVudFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBAX29iamVjdFtuYW1lXVxuICAgICAgZWxzZVxuICAgICAgICByZXMgPSB7fVxuICAgICAgICBmb3Igbix2IG9mIEBfb2JqZWN0XG4gICAgICAgICAgcmVzW25dID0gdlxuICAgICAgICByZXNcblxuICBkZWxldGU6IChuYW1lKS0+XG4gICAgQF9tb2RlbC5kZWxldGUobmFtZSlcbiAgICBAXG5cbmlmIHdpbmRvdz9cbiAgaWYgd2luZG93Llk/XG4gICAgd2luZG93LlkuT2JqZWN0ID0gWU9iamVjdFxuICBlbHNlXG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZmlyc3QgaW1wb3J0IFkhXCJcblxuaWYgbW9kdWxlP1xuICBtb2R1bGUuZXhwb3J0cyA9IFlPYmplY3RcblxuXG5cblxuXG5cblxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9ICgpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICBvcHMgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBAcHJpdmF0ZVxuICAjIEBhYnN0cmFjdFxuICAjIEBub2RvY1xuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BzLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgKiBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxuICAjICogdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuIFdlIGV4dGVuZCB0aGUgcGFyc2VyIG9iamVjdCBpbiBvcmRlciB0byBwYXJzZSBlbmNvZGVkIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLlxuICAgICMgSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZCBiZWZvcmUgYXQgdGhlIGVuZCBvZiB0aGUgZXhlY3V0aW9uIHNlcXVlbmNlXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCktPlxuICAgICAgaWYgY3VzdG9tX3R5cGU/XG4gICAgICAgIEBjdXN0b21fdHlwZSA9IGN1c3RvbV90eXBlXG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XG4gICAgICBpZiB1aWQ/XG4gICAgICAgIEB1aWQgPSB1aWRcblxuICAgIHR5cGU6IFwiT3BlcmF0aW9uXCJcblxuICAgIHJldHJpZXZlU3ViOiAoKS0+XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJzdWIgcHJvcGVydGllcyBhcmUgbm90IGVuYWJsZSBvbiB0aGlzIG9wZXJhdGlvbiB0eXBlIVwiXG5cbiAgICAjXG4gICAgIyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIuIEl0IGRlcGVuZHMgb24gdGhlIG9wZXJhdGlvbiB3aGljaCBldmVudHMgYXJlIHN1cHBvcnRlZC5cbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cbiAgICAjXG4gICAgb2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcbiAgICAjIEBzZWUgT3BlcmF0aW9uLm9ic2VydmVcbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxuICAgICMgICBAcGFyYW0gZiAgICAge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdGhhdCB5b3Ugd2FudCB0byBkZWxldGUgXG4gICAgdW5vYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IEBldmVudF9saXN0ZW5lcnMuZmlsdGVyIChnKS0+XG4gICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGFsbCBzdWJzY3JpYmVkIGV2ZW50IGxpc3RlbmVycy5cbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxuICAgICMgKFRoZW4gb25seSBvbmUgcmVwbGFjZSBldmVudCBzaG91bGQgZmlyZS4gKVxuICAgICMgVGhpcyBpcyBhbHNvIGNhbGxlZCBpbiB0aGUgY2xlYW51cCBtZXRob2QuXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW11cblxuICAgIGRlbGV0ZTogKCktPlxuICAgICAgKG5ldyBvcHMuRGVsZXRlIHVuZGVmaW5lZCwgQCkuZXhlY3V0ZSgpXG4gICAgICBudWxsXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCBjYWxsRXZlbnQrZm9yd2FyZEV2ZW50PyBPbmx5IG9uZSBzdWZmaWNlcyBwcm9iYWJseVxuICAgIGNhbGxFdmVudDogKCktPlxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xuICAgICAgICBjYWxsb24gPSBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlXG4gICAgICAgIGNhbGxvbiA9IEBcbiAgICAgIEBmb3J3YXJkRXZlbnQgY2FsbG9uLCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQgYW5kIHNwZWNpZnkgaW4gd2hpY2ggY29udGV4dCB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkIChzZXQgJ3RoaXMnKS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIHRoaXMgP1xuICAgIGZvcndhcmRFdmVudDogKG9wLCBhcmdzLi4uKS0+XG4gICAgICBmb3IgZiBpbiBAZXZlbnRfbGlzdGVuZXJzXG4gICAgICAgIGYuY2FsbCBvcCwgYXJncy4uLlxuXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBAaXNfZGVsZXRlZFxuXG4gICAgYXBwbHlEZWxldGU6IChnYXJiYWdlY29sbGVjdCA9IHRydWUpLT5cbiAgICAgIGlmIG5vdCBAZ2FyYmFnZV9jb2xsZWN0ZWRcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcbiAgICAgICAgQGlzX2RlbGV0ZWQgPSB0cnVlXG4gICAgICAgIGlmIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxuICAgICAgICAgIEBIQi5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IgQFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgI2NvbnNvbGUubG9nIFwiY2xlYW51cDogI3tAdHlwZX1cIlxuICAgICAgQEhCLnJlbW92ZU9wZXJhdGlvbiBAXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChAcGFyZW50KS0+XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcGFyZW50XG5cbiAgICAjXG4gICAgIyBDb21wdXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpIHRoYXQgaWRlbnRpZmllcyB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0VWlkOiAoKS0+XG4gICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgQHVpZFxuICAgICAgZWxzZVxuICAgICAgICBpZiBAdWlkLmFsdD8gIyBjb3VsZCBiZSAoc2FmZWx5KSB1bmRlZmluZWRcbiAgICAgICAgICBtYXBfdWlkID0gQHVpZC5hbHQuY2xvbmVVaWQoKVxuICAgICAgICAgIG1hcF91aWQuc3ViID0gQHVpZC5zdWJcbiAgICAgICAgICBtYXBfdWlkXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcblxuICAgIGNsb25lVWlkOiAoKS0+XG4gICAgICB1aWQgPSB7fVxuICAgICAgZm9yIG4sdiBvZiBAZ2V0VWlkKClcbiAgICAgICAgdWlkW25dID0gdlxuICAgICAgdWlkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSWYgbm90IGFscmVhZHkgZG9uZSwgc2V0IHRoZSB1aWRcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgaWYgbm90IEB1aWQ/XG4gICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxuICAgICAgICAjIFRoZXJlIGlzIG9ubHkgb25lIG90aGVyIHBsYWNlLCB3aGVyZSB0aGlzIGNhbiBiZSBkb25lIC0gYmVmb3JlIGFuIEluc2VydGlvblxuICAgICAgICAjIGlzIGV4ZWN1dGVkIChiZWNhdXNlIHdlIG5lZWQgdGhlIGNyZWF0b3JfaWQpXG4gICAgICAgIEB1aWQgPSBASEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEBIQi5hZGRPcGVyYXRpb24gQFxuICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcbiAgICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBqc29uLnR5cGUgPSBAdHlwZVxuICAgICAganNvbi51aWQgPSBAZ2V0VWlkKClcbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xuICAgICAgICAgIGpzb24uY3VzdG9tX3R5cGUgPSBAY3VzdG9tX3R5cGVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb24uY3VzdG9tX3R5cGUgPSBAY3VzdG9tX3R5cGUuX25hbWVcbiAgICAgIGpzb25cblxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgbm90IG9wP1xuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiBvcC5leGVjdXRlPyBvciBub3QgKG9wLm9wX251bWJlcj8gYW5kIG9wLmNyZWF0b3I/KVxuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZCwgb3Igb3AgaXMgc3RyaW5nLiBDdXJyZW50bHkgXCJEZWxpbWl0ZXJcIiBpcyBzYXZlZCBhcyBzdHJpbmdcbiAgICAgICAgIyAoaW4gY29tYmluYXRpb24gd2l0aCBAcGFyZW50IHlvdSBjYW4gcmV0cmlldmUgdGhlIGRlbGltaXRlci4uKVxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2VcbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBASEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuICAgIGdldEN1c3RvbVR5cGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAY3VzdG9tX3R5cGU/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgb3BlcmF0aW9uIHdhcyBub3QgaW5pdGlhbGl6ZWQgd2l0aCBhIGN1c3RvbSB0eXBlXCJcbiAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgIyBoYXMgbm90IGJlZW4gaW5pdGlhbGl6ZWQgeWV0IChvbmx5IHRoZSBuYW1lIGlzIHNwZWNpZmllZClcbiAgICAgICAgVHlwZSA9IEBjdXN0b21fdHlwZXNcbiAgICAgICAgZm9yIHQgaW4gQGN1c3RvbV90eXBlLnNwbGl0KFwiLlwiKVxuICAgICAgICAgIFR5cGUgPSBUeXBlW3RdXG4gICAgICAgIEBjdXN0b21fdHlwZSA9IG5ldyBUeXBlKClcbiAgICAgICAgQGN1c3RvbV90eXBlLl9zZXRNb2RlbCBAXG4gICAgICBAY3VzdG9tX3R5cGVcblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyBvcHMuRGVsZXRlIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmVzID0gc3VwZXJcbiAgICAgICAgaWYgcmVzXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICByZXNcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBvcHMuRGVsZXRlLnBhcnNlID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IHRoaXMobnVsbCwgdWlkLCBkZWxldGVzX3VpZClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZFxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3Mgb3BzLkluc2VydCBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgY29udGVudCwgdWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4sIHBhcmVudCktPlxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxuICAgICAgaWYgY29udGVudCBpcyB1bmRlZmluZWRcbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgdmFsOiAoKS0+XG4gICAgICBpZiBAY29udGVudD8gYW5kIEBjb250ZW50LmdldEN1c3RvbVR5cGU/XG4gICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc19kZWxldGVkIGFuZCBvPyAjIG8/IDogaWYgbm90IG8/LCB0aGVuIHRoZSBkZWxpbWl0ZXIgZGVsZXRlZCB0aGlzIEluc2VydGlvbi4gRnVydGhlcm1vcmUsIGl0IHdvdWxkIGJlIHdyb25nIHRvIGNhbGwgaXQuIFRPRE86IG1ha2UgdGhpcyBtb3JlIGV4cHJlc3NpdmUgYW5kIHNhdmVcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXG4gICAgICAgIGNhbGxMYXRlciA9IHRydWVcbiAgICAgIGlmIG8/XG4gICAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgZ2FyYmFnZWNvbGxlY3QgPSBmYWxzZVxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgZ2FyYmFnZWNvbGxlY3QgPSB0cnVlXG4gICAgICBzdXBlciBnYXJiYWdlY29sbGVjdFxuICAgICAgaWYgY2FsbExhdGVyXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHMobylcbiAgICAgIGlmIEBwcmV2X2NsPy5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgICMgZGVsZXRlIGFsbCBvcHMgdGhhdCBkZWxldGUgdGhpcyBpbnNlcnRpb25cbiAgICAgICAgZm9yIGQgaW4gQGRlbGV0ZWRfYnlcbiAgICAgICAgICBkLmNsZWFudXAoKVxuXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwicmlnaHQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXG4gICAgICAgICMgY2hhbmdlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxuICAgICAgICBvID0gQG5leHRfY2xcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcbiAgICAgICAgICAgIG8ub3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxuXG4gICAgICAgICMgZGVsZXRlIGNvbnRlbnRcbiAgICAgICAgIyAtIHdlIG11c3Qgbm90IGRvIHRoaXMgaW4gYXBwbHlEZWxldGUsIGJlY2F1c2UgdGhpcyB3b3VsZCBsZWFkIHRvIGluY29uc2lzdGVuY2llc1xuICAgICAgICAjIChlLmcuIHRoZSBmb2xsb3dpbmcgb3BlcmF0aW9uIG9yZGVyIG11c3QgYmUgaW52ZXJ0aWJsZSA6XG4gICAgICAgICMgICBJbnNlcnQgcmVmZXJzIHRvIGNvbnRlbnQsIHRoZW4gdGhlIGNvbnRlbnQgaXMgZGVsZXRlZClcbiAgICAgICAgIyBUaGVyZWZvcmUsIHdlIGhhdmUgdG8gZG8gdGhpcyBpbiB0aGUgY2xlYW51cFxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5LS1cbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXG4gICAgICAgICAgICBAY29udGVudC5hcHBseURlbGV0ZSgpXG4gICAgICAgIGRlbGV0ZSBAY29udGVudFxuICAgICAgICBzdXBlclxuICAgICAgIyBlbHNlXG4gICAgICAjICAgU29tZW9uZSBpbnNlcnRlZCBzb21ldGhpbmcgaW4gdGhlIG1lYW50aW1lLlxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA/PSAwXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSsrXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby51aWQuY3JlYXRvciA8IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzKClcbiAgICAgICAgQFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBnZXRDb250ZW50VHlwZSA9IChjb250ZW50KS0+XG4gICAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNvbnRlbnRcbiAgICAgIEBwYXJlbnQ/LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIEBjb250ZW50XG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBAcGFyZW50LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudC5nZXRDdXN0b21UeXBlKCkgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxuICAgICAgICBsZW5ndGg6IDFcbiAgICAgICAgY2hhbmdlZEJ5OiBvLnVpZC5jcmVhdG9yXG4gICAgICAgIG9sZFZhbHVlOiBAdmFsKClcbiAgICAgIF1cblxuICAgICNcbiAgICAjIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQb3NpdGlvbjogKCktPlxuICAgICAgcG9zaXRpb24gPSAwXG4gICAgICBwcmV2ID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgcHJldiBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBub3QgcHJldi5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uKytcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxuICAgICAgcG9zaXRpb25cblxuICAgICNcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW5kIHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24ucHJldiA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBqc29uLm5leHQgPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAganNvbi5wYXJlbnQgPSBAcGFyZW50LmdldFVpZCgpXG5cbiAgICAgIGlmIEBvcmlnaW4udHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIGpzb24ub3JpZ2luID0gXCJEZWxpbWl0ZXJcIlxuICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbi5vcmlnaW4gPSBAb3JpZ2luLmdldFVpZCgpXG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEpTT04uc3RyaW5naWZ5IEBjb250ZW50XG4gICAgICBzdXBlciBqc29uXG5cbiAgb3BzLkluc2VydC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIGlmIHR5cGVvZiBjb250ZW50IGlzIFwic3RyaW5nXCJcbiAgICAgIGNvbnRlbnQgPSBKU09OLnBhcnNlKGNvbnRlbnQpXG4gICAgbmV3IHRoaXMgbnVsbCwgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIHBhcmVudFxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIG9wcy5EZWxpbWl0ZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBudWxsLCB7bm9PcGVyYXRpb246IHRydWV9XG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xuICAgICAgICBzdXBlclxuICAgICAgI2Vsc2VcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAnb3BlcmF0aW9ucycgOiBvcHNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9ICgpLT5cbiAgYmFzaWNfb3BzID0gYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQoKVxuICBvcHMgPSBiYXNpY19vcHMub3BlcmF0aW9uc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBvcHMuTWFwTWFuYWdlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkKS0+XG4gICAgICBAX21hcCA9IHt9XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQF9tYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBtYXA6IChmKS0+XG4gICAgICBmb3Igbix2IG9mIEBfbWFwXG4gICAgICAgIGYobix2KVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XG4gICAgICAgICAgcmVwID0gY29udGVudC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXAgPSBjb250ZW50XG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIHJlcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIHByb3AgPSBAX21hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIHJlcyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICAgIHJlcy5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXNcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQF9tYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXSA9IHJtXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxuICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV1cblxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZClcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCktPlxuICAgICAgQGJlZ2lubmluZyA9IG5ldyBvcHMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICBAZW5kID0gICAgICAgbmV3IG9wcy5EZWxpbWl0ZXIgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiTGlzdE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAZW5kXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgZm9yIGksIG8gaW4gdmFsXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuT2JqZWN0XG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiBvcHMuTGlzdE1hbmFnZXJcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgbWFwOiAoZiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBmKG8pXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgZm9sZDogKGluaXQsIGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpbml0ID0gZihpbml0LCBvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBpbml0XG5cbiAgICB2YWw6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICBAdG9BcnJheSgpXG5cblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICMgZS5nLiBcImFiY1wiIDogdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBvLnByZXZfY2w/XG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgW2NvbnRlbnRdXG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnRzKS0+XG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG5cbiAgICAgICMgVE9ETzogYWx3YXlzIGV4cGVjdCBhbiBhcnJheSBhcyBjb250ZW50LiBUaGVuIHlvdSBjYW4gY29tYmluZSB0aGlzIHdpdGggdGhlIG90aGVyIG9wdGlvbiAoZWxzZSlcbiAgICAgIGlmIGNvbnRlbnRzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICBlbHNlXG4gICAgICAgIGZvciBjIGluIGNvbnRlbnRzXG4gICAgICAgICAgaWYgYz8gYW5kIGMuX25hbWU/IGFuZCBjLl9nZXRNb2RlbD9cbiAgICAgICAgICAgIGMgPSBjLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgICB0bXAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgYywgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICAgICAgbGVmdCA9IHRtcFxuICAgICAgQFxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhbiBhcnJheSBvZiBjb250ZW50IGludG8gdGhpcyBsaXN0LlxuICAgICMgQE5vdGU6IFRoaXMgZXhwZWN0cyBhbiBhcnJheSBhcyBjb250ZW50IVxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdC5cbiAgICAjXG4gICAgaW5zZXJ0OiAocG9zaXRpb24sIGNvbnRlbnRzKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnRzXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGEgcGFydCBvZiB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3RcbiAgICAjXG4gICAgZGVsZXRlOiAocG9zaXRpb24sIGxlbmd0aCA9IDEpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIChub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gIG9wcy5MaXN0TWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZSc6IGN1c3RvbV90eXBlXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkLCBiZWdpbm5pbmcsIGVuZCktPlxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cbiAgICAgICAgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddID0gQGV2ZW50X3RoaXMuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBiZWdpbm5pbmcsIGVuZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcbiAgICAjIFJlcGxhY2VhYmxlcyBhbHNvIG5vdCB0aHJvdyB0aGUgc2FtZSBldmVudHMuXG4gICAgIyBTbywgUmVwbGFjZU1hbmFnZXIgYW5kIExpc3RNYW5hZ2VyIGJvdGggaW1wbGVtZW50XG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cbiAgICAjXG4gICAgI1xuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxuICAgICAgaWYgbm90IEBpc0RlbGV0ZWQoKVxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xuICAgICAgICAgICAgZXZlbnRbbmFtZV0gPSBwcm9wXG4gICAgICAgIEBldmVudF90aGlzLmNhbGxFdmVudCBldmVudHNcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIHJlbHAgPSAobmV3IG9wcy5SZXBsYWNlYWJsZSBudWxsLCBjb250ZW50LCBALCByZXBsYWNlYWJsZV91aWQsIG8sIG8ubmV4dF9jbCkuZXhlY3V0ZSgpXG4gICAgICAjIFRPRE86IGRlbGV0ZSByZXBsIChmb3IgZGVidWdnaW5nKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBpc0NvbnRlbnREZWxldGVkOiAoKS0+XG4gICAgICBAZ2V0TGFzdE9wZXJhdGlvbigpLmlzRGVsZXRlZCgpXG5cbiAgICBkZWxldGVDb250ZW50OiAoKS0+XG4gICAgICAobmV3IG9wcy5EZWxldGUgbnVsbCwgdW5kZWZpbmVkLCBAZ2V0TGFzdE9wZXJhdGlvbigpLnVpZCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpc1xuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICAjaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi5iZWdpbm5pbmcgPSBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICBqc29uLmVuZCA9IEBlbmQuZ2V0VWlkKClcbiAgICAgIHN1cGVyIGpzb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBvcHMuUmVwbGFjZWFibGUgZXh0ZW5kcyBvcHMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiAjIFBhcmVudCBpcyBhbHJlYWR5IHNhdmVkIGJ5IFJlcGxhY2VhYmxlXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VhYmxlXCJcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCIgYW5kIEBwcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBAaXNfZGVsZXRlZCAjIFdoZW4gdGhpcyBpcyByZWNlaXZlZCBmcm9tIHRoZSBIQiwgdGhpcyBjb3VsZCBhbHJlYWR5IGJlIGRlbGV0ZWQhXG4gICAgICAgICAgb2xkX3ZhbHVlID0gQHByZXZfY2wudmFsKClcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgb2xkVmFsdWU6IG9sZF92YWx1ZVxuICAgICAgICAgIF1cbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSBpZiBAbmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBAYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBAdmFsKClcbiAgICAgICAgXVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5SZXBsYWNlYWJsZS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgIH0gPSBqc29uXG4gICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgXCJzdHJpbmdcIlxuICAgICAgY29udGVudCA9IEpTT04ucGFyc2UoY29udGVudClcbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbilcblxuXG4gIGJhc2ljX29wc1xuXG5cblxuXG5cblxuIiwiXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcblxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XG4gIHVzZXJfaWQgPSBudWxsXG4gIGlmIGNvbm5lY3Rvci51c2VyX2lkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLm9uX3VzZXJfaWRfc2V0ID0gKGlkKS0+XG4gICAgICB1c2VyX2lkID0gaWRcbiAgICAgIEhCLnJlc2V0VXNlcklkIGlkXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICBvcHNfbWFuYWdlciA9IHN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgSEIsIHRoaXMuY29uc3RydWN0b3JcbiAgb3BzID0gb3BzX21hbmFnZXIub3BlcmF0aW9uc1xuXG4gIGVuZ2luZSA9IG5ldyBFbmdpbmUgSEIsIG9wc1xuICBhZGFwdENvbm5lY3RvciBjb25uZWN0b3IsIGVuZ2luZSwgSEIsIG9wc19tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lclxuXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLkhCID0gSEJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUub3BlcmF0aW9ucyA9IG9wc1xuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY29ubmVjdG9yID0gY29ubmVjdG9yXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmN1c3RvbV90eXBlcyA9IHRoaXMuY29uc3RydWN0b3JcblxuICBjdCA9IG5ldyBjcmVhdGVZLk9iamVjdCgpXG4gIG1vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKGN0LCBIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKSkuZXhlY3V0ZSgpXG4gIGN0Ll9zZXRNb2RlbCBtb2RlbFxuICBjdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcbmlmIHdpbmRvdz9cbiAgd2luZG93LlkgPSBjcmVhdGVZXG5cbmNyZWF0ZVkuT2JqZWN0ID0gcmVxdWlyZSBcIi4vT2JqZWN0VHlwZVwiXG4iXX0=
