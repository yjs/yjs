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
          if (_hb.length > 30) {
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
      if (_hb.length > 30) {
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
          if (_hb.length > 30) {
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
      return this.forwardEvent.apply(this, [this].concat(__slice.call(arguments)));
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
      if (this.custom_type == null) {
        throw new Error("This operation was not initialized with a custom type");
      }
      if (this.custom_type.constructor === String) {
        this.custom_type = new this.custom_types[this.custom_type]();
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
        if (this.content instanceof ops.Operation && !deleted_earlyer) {
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
          changedBy: o.uid.creator
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


},{}],6:[function(require,module,exports){
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


},{"./Basic":5}],7:[function(require,module,exports){
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


},{}],8:[function(require,module,exports){
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

createY.Object = require("./Types/Object");


},{"./ConnectorAdapter":1,"./Engine":3,"./HistoryBuffer":4,"./Operations/Structured":6,"./Types/Object":7}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9PcGVyYXRpb25zL0Jhc2ljLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL09wZXJhdGlvbnMvU3RydWN0dXJlZC5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9UeXBlcy9PYmplY3QuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIveS1vYmplY3QuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIveS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNDQSxJQUFBLDhCQUFBOztBQUFBLGNBQUEsR0FBaUIsT0FBQSxDQUFRLGtCQUFSLENBQWpCLENBQUE7O0FBQUEsY0FNQSxHQUFpQixTQUFDLFNBQUQsRUFBWSxNQUFaLEVBQW9CLEVBQXBCLEVBQXdCLGtCQUF4QixHQUFBO0FBRWYsTUFBQSx1RkFBQTtBQUFBLE9BQUEsc0JBQUE7NkJBQUE7QUFDRSxJQUFBLFNBQVUsQ0FBQSxJQUFBLENBQVYsR0FBa0IsQ0FBbEIsQ0FERjtBQUFBLEdBQUE7QUFBQSxFQUdBLFNBQVMsQ0FBQyxhQUFWLENBQUEsQ0FIQSxDQUFB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eEIsR0FBaUMsTUFqQmpDLENBQUE7QUFBQSxFQWtCQSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxTQUF4QixHQUFvQyxTQWxCcEMsQ0FBQTtBQUFBLEVBbUJBLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFlBQXhCLEdBQXVDLElBQUksQ0FBQyxXQW5CNUMsQ0FBQTtBQUFBLEVBcUJBLEVBQUEsR0FBUyxJQUFBLE9BQU8sQ0FBQyxNQUFSLENBQUEsQ0FyQlQsQ0FBQTtBQUFBLEVBc0JBLEtBQUEsR0FBWSxJQUFBLEdBQUcsQ0FBQyxVQUFKLENBQWUsRUFBZixFQUFtQixFQUFFLENBQUMsMkJBQUgsQ0FBQSxDQUFuQixDQUFvRCxDQUFDLE9BQXJELENBQUEsQ0F0QlosQ0FBQTtBQUFBLEVBdUJBLEVBQUUsQ0FBQyxTQUFILENBQWEsS0FBYixDQXZCQSxDQUFBO1NBd0JBLEdBekJRO0FBQUEsQ0FOVixDQUFBOztBQUFBLE1BaUNNLENBQUMsT0FBUCxHQUFpQixPQWpDakIsQ0FBQTs7QUFrQ0EsSUFBRyxnREFBSDtBQUNFLEVBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxPQUFYLENBREY7Q0FsQ0E7O0FBQUEsT0FxQ08sQ0FBQyxNQUFSLEdBQWlCLE9BQUEsQ0FBUSxnQkFBUixDQXJDakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbkNvbm5lY3RvckNsYXNzID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQ2xhc3NcIlxuI1xuIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcbiMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4jXG5hZGFwdENvbm5lY3RvciA9IChjb25uZWN0b3IsIGVuZ2luZSwgSEIsIGV4ZWN1dGlvbl9saXN0ZW5lciktPlxuXG4gIGZvciBuYW1lLCBmIG9mIENvbm5lY3RvckNsYXNzXG4gICAgY29ubmVjdG9yW25hbWVdID0gZlxuXG4gIGNvbm5lY3Rvci5zZXRJc0JvdW5kVG9ZKClcblxuICBzZW5kXyA9IChvKS0+XG4gICAgaWYgKG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkpIGFuZFxuICAgICAgICAodHlwZW9mIG8udWlkLm9wX251bWJlciBpc250IFwic3RyaW5nXCIpIGFuZCAjIFRPRE86IGkgZG9uJ3QgdGhpbmsgdGhhdCB3ZSBuZWVkIHRoaXMgYW55bW9yZS4uXG4gICAgICAgIChIQi5nZXRVc2VySWQoKSBpc250IFwiX3RlbXBcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXG5cbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XG4gICAgICB1c2VyOiBuYW1lXG4gICAgICBzdGF0ZTogdmFsdWVcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxuICAgIGZvciBzIGluIHZcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxuICAgIHN0YXRlX3ZlY3RvclxuXG4gIGdldFN0YXRlVmVjdG9yID0gKCktPlxuICAgIGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG5cbiAgZ2V0SEIgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHBhcnNlX3N0YXRlX3ZlY3RvciB2XG4gICAgaGIgPSBIQi5fZW5jb2RlIHN0YXRlX3ZlY3RvclxuICAgIGpzb24gPVxuICAgICAgaGI6IGhiXG4gICAgICBzdGF0ZV92ZWN0b3I6IGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG4gICAganNvblxuXG4gIGFwcGx5SEIgPSAoaGIsIGZyb21IQiktPlxuICAgIGVuZ2luZS5hcHBseU9wIGhiLCBmcm9tSEJcblxuICBjb25uZWN0b3IuZ2V0U3RhdGVWZWN0b3IgPSBnZXRTdGF0ZVZlY3RvclxuICBjb25uZWN0b3IuZ2V0SEIgPSBnZXRIQlxuICBjb25uZWN0b3IuYXBwbHlIQiA9IGFwcGx5SEJcblxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycy5wdXNoIChzZW5kZXIsIG9wKS0+XG4gICAgaWYgb3AudWlkLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgZW5naW5lLmFwcGx5T3Agb3BcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkYXB0Q29ubmVjdG9yIiwiXG5tb2R1bGUuZXhwb3J0cyA9XG4gICNcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnN5bmNNZXRob2Qge1N0cmluZ30gIGlzIGVpdGhlciBcInN5bmNBbGxcIiBvciBcIm1hc3Rlci1zbGF2ZVwiLlxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNZXRob2RcIiwgW1wic3luY0FsbFwiLCBcIm1hc3Rlci1zbGF2ZVwiXVxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cbiAgICByZXEgXCJ1c2VyX2lkXCJcbiAgICBAb25fdXNlcl9pZF9zZXQ/KEB1c2VyX2lkKVxuXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxuICAgICMgQnV0IHRoaXMgaXMgbm90IG5lY2Vzc2FyeSBpbiB0aGUgdGVzdC1jb25uZWN0b3JcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxuICAgIGVsc2VcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXG5cbiAgICAjIEEgTWFzdGVyIHNob3VsZCBzeW5jIHdpdGggZXZlcnlvbmUhIFRPRE86IHJlYWxseT8gLSBmb3Igbm93IGl0cyBzYWZlciB0aGlzIHdheSFcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXG5cbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcbiAgICAjIFBlZXJqcyBDb25uZWN0aW9uczoga2V5OiBjb25uLWlkLCB2YWx1ZTogb2JqZWN0XG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMgPz0gW11cblxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxuICAgIEBpc19pbml0aWFsaXplZCA9IHRydWVcblxuICBpc1JvbGVNYXN0ZXI6IC0+XG4gICAgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuXG4gIGlzUm9sZVNsYXZlOiAtPlxuICAgIEByb2xlIGlzIFwic2xhdmVcIlxuXG4gIGZpbmROZXdTeW5jVGFyZ2V0OiAoKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGZvciB1c2VyLCBjIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBpZiBub3QgYy5pc19zeW5jZWRcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgICAgIGJyZWFrXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQHNldFN0YXRlU3luY2VkKClcbiAgICBudWxsXG5cbiAgdXNlckxlZnQ6ICh1c2VyKS0+XG4gICAgZGVsZXRlIEBjb25uZWN0aW9uc1t1c2VyXVxuICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG5cbiAgdXNlckpvaW5lZDogKHVzZXIsIHJvbGUpLT5cbiAgICBpZiBub3Qgcm9sZT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkludGVybmFsOiBZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEgRS5nLiB1c2VySm9pbmVkKCd1aWQ6MzkzOScsJ3NsYXZlJylcIlxuICAgICMgYSB1c2VyIGpvaW5lZCB0aGUgcm9vbVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXSA/PSB7fVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXS5pc19zeW5jZWQgPSBmYWxzZVxuXG4gICAgaWYgKG5vdCBAaXNfc3luY2VkKSBvciBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcbiAgICAgIGVsc2UgaWYgcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICAgICMgVE9ETzogV2hhdCBpZiB0aGVyZSBhcmUgdHdvIG1hc3RlcnM/IFByZXZlbnQgc2VuZGluZyBldmVyeXRoaW5nIHR3byB0aW1lcyFcbiAgICAgICAgQHBlcmZvcm1TeW5jV2l0aE1hc3RlciB1c2VyXG5cblxuICAjXG4gICMgRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLiBJZiBub3QgY29ubmVjdGVkLCB3YWl0IHVudGlsIGNvbm5lY3RlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC5cbiAgI1xuICB3aGVuU3luY2VkOiAoYXJncyktPlxuICAgIGlmIGFyZ3MuY29uc3RydWN0b3JlIGlzIEZ1bmN0aW9uXG4gICAgICBhcmdzID0gW2FyZ3NdXG4gICAgaWYgQGlzX3N5bmNlZFxuICAgICAgYXJnc1swXS5hcHBseSB0aGlzLCBhcmdzWzEuLl1cbiAgICBlbHNlXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZCA/PSBbXVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQucHVzaCBhcmdzXG5cbiAgI1xuICAjIEV4ZWN1dGUgYW4gZnVuY3Rpb24gd2hlbiBhIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuIGYgd2lsbCBiZSBjYWxsZWQgd2l0aCAoc2VuZGVyX2lkLCBicm9hZGNhc3Qge3RydWV8ZmFsc2V9LCBtZXNzYWdlKS5cbiAgI1xuICBvblJlY2VpdmU6IChmKS0+XG4gICAgQHJlY2VpdmVfaGFuZGxlcnMucHVzaCBmXG5cbiAgIyMjXG4gICMgQnJvYWRjYXN0IGEgbWVzc2FnZSB0byBhbGwgY29ubmVjdGVkIHBlZXJzLlxuICAjIEBwYXJhbSBtZXNzYWdlIHtPYmplY3R9IFRoZSBtZXNzYWdlIHRvIGJyb2FkY2FzdC5cbiAgI1xuICBicm9hZGNhc3Q6IChtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IGJyb2FkY2FzdCFcIlxuXG4gICNcbiAgIyBTZW5kIGEgbWVzc2FnZSB0byBhIHBlZXIsIG9yIHNldCBvZiBwZWVyc1xuICAjXG4gIHNlbmQ6IChwZWVyX3MsIG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgc2VuZCFcIlxuICAjIyNcblxuICAjXG4gICMgcGVyZm9ybSBhIHN5bmMgd2l0aCBhIHNwZWNpZmljIHVzZXIuXG4gICNcbiAgcGVyZm9ybVN5bmM6ICh1c2VyKS0+XG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgICBAc2VuZCB1c2VyLFxuICAgICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxuICAgICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgICBkYXRhOiBbXSAjIEBnZXRTdGF0ZVZlY3RvcigpXG4gICAgICBpZiBub3QgQHNlbnRfaGJfdG9fYWxsX3VzZXJzXG4gICAgICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IHRydWVcblxuICAgICAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICAgICAgX2hiID0gW11cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDMwXG4gICAgICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuXG5cbiAgI1xuICAjIFdoZW4gYSBtYXN0ZXIgbm9kZSBqb2luZWQgdGhlIHJvb20sIHBlcmZvcm0gdGhpcyBzeW5jIHdpdGggaGltLiBJdCB3aWxsIGFzayB0aGUgbWFzdGVyIGZvciB0aGUgSEIsXG4gICMgYW5kIHdpbGwgYnJvYWRjYXN0IGhpcyBvd24gSEJcbiAgI1xuICBwZXJmb3JtU3luY1dpdGhNYXN0ZXI6ICh1c2VyKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgQHNlbmQgdXNlcixcbiAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgZGF0YTogW11cbiAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICBfaGIgPSBbXVxuICAgIGZvciBvIGluIGhiXG4gICAgICBfaGIucHVzaCBvXG4gICAgICBpZiBfaGIubGVuZ3RoID4gMzBcbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgQGJyb2FkY2FzdFxuICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgZGF0YTogX2hiXG5cbiAgI1xuICAjIFlvdSBhcmUgc3VyZSB0aGF0IGFsbCBjbGllbnRzIGFyZSBzeW5jZWQsIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICBzZXRTdGF0ZVN5bmNlZDogKCktPlxuICAgIGlmIG5vdCBAaXNfc3luY2VkXG4gICAgICBAaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgaWYgQGNvbXB1dGVfd2hlbl9zeW5jZWQ/XG4gICAgICAgIGZvciBmIGluIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICAgICAgZigpXG4gICAgICAgIGRlbGV0ZSBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgbnVsbFxuXG4gICNcbiAgIyBZb3UgcmVjZWl2ZWQgYSByYXcgbWVzc2FnZSwgYW5kIHlvdSBrbm93IHRoYXQgaXQgaXMgaW50ZW5kZWQgZm9yIHRvIFlqcy4gVGhlbiBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICNcbiAgcmVjZWl2ZU1lc3NhZ2U6IChzZW5kZXIsIHJlcyktPlxuICAgIGlmIG5vdCByZXMuc3luY19zdGVwP1xuICAgICAgZm9yIGYgaW4gQHJlY2VpdmVfaGFuZGxlcnNcbiAgICAgICAgZiBzZW5kZXIsIHJlc1xuICAgIGVsc2VcbiAgICAgIGlmIHNlbmRlciBpcyBAdXNlcl9pZFxuICAgICAgICByZXR1cm5cbiAgICAgIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJnZXRIQlwiXG4gICAgICAgIGRhdGEgPSBAZ2V0SEIocmVzLmRhdGEpXG4gICAgICAgIGhiID0gZGF0YS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICAjIGFsd2F5cyBicm9hZGNhc3QsIHdoZW4gbm90IHN5bmNlZC5cbiAgICAgICAgIyBUaGlzIHJlZHVjZXMgZXJyb3JzLCB3aGVuIHRoZSBjbGllbnRzIGdvZXMgb2ZmbGluZSBwcmVtYXR1cmVseS5cbiAgICAgICAgIyBXaGVuIHRoaXMgY2xpZW50IG9ubHkgc3luY3MgdG8gb25lIG90aGVyIGNsaWVudHMsIGJ1dCBsb29zZXMgY29ubmVjdG9ycyxcbiAgICAgICAgIyBiZWZvcmUgc3luY2luZyB0byB0aGUgb3RoZXIgY2xpZW50cywgdGhlIG9ubGluZSBjbGllbnRzIGhhdmUgZGlmZmVyZW50IHN0YXRlcy5cbiAgICAgICAgIyBTaW5jZSB3ZSBkbyBub3Qgd2FudCB0byBwZXJmb3JtIHJlZ3VsYXIgc3luY3MsIHRoaXMgaXMgYSBnb29kIGFsdGVybmF0aXZlXG4gICAgICAgIGlmIEBpc19zeW5jZWRcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XG4gICAgICAgICAgICBAc2VuZCBzZW5kZXIsIG1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBicm9hZGNhc3QgbVxuXG4gICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAzMFxuICAgICAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuXG4gICAgICAgIHNlbmRBcHBseUhCXG4gICAgICAgICAgc3luY19zdGVwIDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuICAgICAgICBpZiByZXMuc2VuZF9hZ2Fpbj8gYW5kIEBwZXJmb3JtX3NlbmRfYWdhaW5cbiAgICAgICAgICBzZW5kX2FnYWluID0gZG8gKHN2ID0gZGF0YS5zdGF0ZV92ZWN0b3IpPT5cbiAgICAgICAgICAgICgpPT5cbiAgICAgICAgICAgICAgaGIgPSBAZ2V0SEIoc3YpLmhiXG4gICAgICAgICAgICAgIEBzZW5kIHNlbmRlcixcbiAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiLFxuICAgICAgICAgICAgICAgIGRhdGE6IGhiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yP1xuICAgICAgICAgIG8udWlkLmNyZWF0b3IgPSBpZFxuICAgICAgICBpZiBvLnVpZC5hbHQ/XG4gICAgICAgICAgby51aWQuYWx0LmNyZWF0b3IgPSBpZFxuICAgICAgaWYgQGJ1ZmZlcltpZF0/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXG4gICAgICBkZWxldGUgQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW2lkXSA9IEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pICMgeW91IGFscmVhZHkgZG8gdGhpcyBpbiB0aGUgZW5naW5lLCBzbyBkZWxldGUgaXQgaGVyZSFcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcbiAgICBAYWRkVG9Db3VudGVyKG8pXG4gICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cblxuICAjIFdoZW4gdGhlIEhCIGRldGVybWluZXMgaW5jb25zaXN0ZW5jaWVzLCB0aGVuIHRoZSBpbnZva2VTeW5jXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcbiAgc2V0SW52b2tlU3luY0hhbmRsZXI6IChmKS0+XG4gICAgQGludm9rZVN5bmMgPSBmXG5cbiAgIyBlbXB0eSBwZXIgZGVmYXVsdCAjIFRPRE86IGRvIGkgbmVlZCB0aGlzP1xuICBpbnZva2VTeW5jOiAoKS0+XG5cbiAgIyBhZnRlciB5b3UgcmVjZWl2ZWQgdGhlIEhCIG9mIGFub3RoZXIgdXNlciAoaW4gdGhlIHN5bmMgcHJvY2VzcyksXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cbiAgICBmb3IgdXNlcixzdGF0ZSBvZiBzdGF0ZV92ZWN0b3JcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBpZiBvLnVpZC5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcbiAgICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSBpc250IChvLnVpZC5vcF9udW1iZXIgKyAxKVxuICAgICAgI2NvbnNvbGUubG9nIChAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gLSAoby51aWQub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKCktPlxuICAjIEBzZWUgRW5naW5lLnBhcnNlXG4gIG9wcyA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEBwcml2YXRlXG4gICMgQGFic3RyYWN0XG4gICMgQG5vZG9jXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcHMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyAqIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkKS0+XG4gICAgICBpZiBjdXN0b21fdHlwZT9cbiAgICAgICAgQGN1c3RvbV90eXBlID0gY3VzdG9tX3R5cGVcbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcbiAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IGZhbHNlXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW10gIyBUT0RPOiByZW5hbWUgdG8gb2JzZXJ2ZXJzIG9yIHN0aCBsaWtlIHRoYXRcbiAgICAgIGlmIHVpZD9cbiAgICAgICAgQHVpZCA9IHVpZFxuXG4gICAgdHlwZTogXCJPcGVyYXRpb25cIlxuXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcInN1YiBwcm9wZXJ0aWVzIGFyZSBub3QgZW5hYmxlIG9uIHRoaXMgb3BlcmF0aW9uIHR5cGUhXCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBcbiAgICB1bm9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cbiAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYWxsIHN1YnNjcmliZWQgZXZlbnQgbGlzdGVuZXJzLlxuICAgICMgVGhpcyBzaG91bGQgYmUgY2FsbGVkLCBlLmcuIGFmdGVyIHRoaXMgaGFzIGJlZW4gcmVwbGFjZWQuXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXG4gICAgIyBUaGlzIGlzIGFsc28gY2FsbGVkIGluIHRoZSBjbGVhbnVwIG1ldGhvZC5cbiAgICBkZWxldGVBbGxPYnNlcnZlcnM6ICgpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxuXG4gICAgZGVsZXRlOiAoKS0+XG4gICAgICAobmV3IG9wcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcbiAgICAgIG51bGxcblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XG4gICAgY2FsbEV2ZW50OiAoKS0+XG4gICAgICBAZm9yd2FyZEV2ZW50IEAsIGFyZ3VtZW50cy4uLlxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgdGhpcyA/XG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGFyZ3MuLi4pLT5cbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcbiAgICAgICAgZi5jYWxsIG9wLCBhcmdzLi4uXG5cbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIEBpc19kZWxldGVkXG5cbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxuICAgICAgaWYgbm90IEBnYXJiYWdlX2NvbGxlY3RlZFxuICAgICAgICAjY29uc29sZS5sb2cgXCJhcHBseURlbGV0ZTogI3tAdHlwZX1cIlxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcbiAgICAgICAgaWYgZ2FyYmFnZWNvbGxlY3RcbiAgICAgICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSB0cnVlXG4gICAgICAgICAgQEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXG4gICAgICBASEIucmVtb3ZlT3BlcmF0aW9uIEBcbiAgICAgIEBkZWxldGVBbGxPYnNlcnZlcnMoKVxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBAdWlkXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEB1aWQuYWx0PyAjIGNvdWxkIGJlIChzYWZlbHkpIHVuZGVmaW5lZFxuICAgICAgICAgIG1hcF91aWQgPSBAdWlkLmFsdC5jbG9uZVVpZCgpXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxuICAgICAgICAgIG1hcF91aWRcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xvbmVVaWQ6ICgpLT5cbiAgICAgIHVpZCA9IHt9XG4gICAgICBmb3Igbix2IG9mIEBnZXRVaWQoKVxuICAgICAgICB1aWRbbl0gPSB2XG4gICAgICB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJZiBub3QgYWxyZWFkeSBkb25lLCBzZXQgdGhlIHVpZFxuICAgICMgQWRkIHRoaXMgdG8gdGhlIEhCXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBAaXNfZXhlY3V0ZWQgPSB0cnVlXG4gICAgICBpZiBub3QgQHVpZD9cbiAgICAgICAgIyBXaGVuIHRoaXMgb3BlcmF0aW9uIHdhcyBjcmVhdGVkIHdpdGhvdXQgYSB1aWQsIHRoZW4gc2V0IGl0IGhlcmUuXG4gICAgICAgICMgVGhlcmUgaXMgb25seSBvbmUgb3RoZXIgcGxhY2UsIHdoZXJlIHRoaXMgY2FuIGJlIGRvbmUgLSBiZWZvcmUgYW4gSW5zZXJ0aW9uXG4gICAgICAgICMgaXMgZXhlY3V0ZWQgKGJlY2F1c2Ugd2UgbmVlZCB0aGUgY3JlYXRvcl9pZClcbiAgICAgICAgQHVpZCA9IEBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgQEhCLmFkZE9wZXJhdGlvbiBAXG4gICAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24udHlwZSA9IEB0eXBlXG4gICAgICBqc29uLnVpZCA9IEBnZXRVaWQoKVxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xuICAgICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZVxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZS5fbmFtZVxuICAgICAganNvblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgT3BlcmF0aW9ucyBtYXkgZGVwZW5kIG9uIG90aGVyIG9wZXJhdGlvbnMgKGxpbmtlZCBsaXN0cywgZXRjLikuXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXG4gICAgIyBhbiBlYXN5IHdheSB0byByZWZlciB0byB0aGVzZSBvcGVyYXRpb25zIHZpYSBhbiB1aWQgb3Igb2JqZWN0IHJlZmVyZW5jZS5cbiAgICAjXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8pOyAgIG9yXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkby5nZXRVaWQoKSk7XG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcF91aWQpXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R9IG9wX3VpZCBBIHVpZCB0aGF0IHJlZmVycyB0byBhbiBvcGVyYXRpb25cbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPcGVyYXRpb259IG9wIEFuIE9wZXJhdGlvbiBvYmplY3RcbiAgICAjXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wKS0+XG5cbiAgICAgICNcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXG4gICAgICAjIFdlIHVzZSBkdWNrLXR5cGluZyB0byBjaGVjayBpZiBvcCBpcyBpbnN0YW50aWF0ZWQgc2luY2UgdGhlcmVcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXG4gICAgICAjXG4gICAgICBpZiBub3Qgb3A/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmIG9wLmV4ZWN1dGU/IG9yIG5vdCAob3Aub3BfbnVtYmVyPyBhbmQgb3AuY3JlYXRvcj8pXG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkLCBvciBvcCBpcyBzdHJpbmcuIEN1cnJlbnRseSBcIkRlbGltaXRlclwiIGlzIHNhdmVkIGFzIHN0cmluZ1xuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZVxuICAgICAgICAjIG5vdCBpbml0aWFsaXplZC4gRG8gaXQgd2hlbiBjYWxsaW5nICR2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtuYW1lXSA9IG9wXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxuICAgICMgQHNlZSBPcGVyYXRpb24uc2F2ZU9wZXJhdGlvblxuICAgICNcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxuICAgICNcbiAgICB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9uczogKCktPlxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxuICAgICAgc3VjY2VzcyA9IEBcbiAgICAgIGZvciBuYW1lLCBvcF91aWQgb2YgQHVuY2hlY2tlZFxuICAgICAgICBvcCA9IEBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG4gICAgZ2V0Q3VzdG9tVHlwZTogKCktPlxuICAgICAgaWYgbm90IEBjdXN0b21fdHlwZT9cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyBvcGVyYXRpb24gd2FzIG5vdCBpbml0aWFsaXplZCB3aXRoIGEgY3VzdG9tIHR5cGVcIlxuICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xuICAgICAgICAjIGhhcyBub3QgYmVlbiBpbml0aWFsaXplZCB5ZXQgKG9ubHkgdGhlIG5hbWUgaXMgc3BlY2lmaWVkKVxuICAgICAgICBAY3VzdG9tX3R5cGUgPSBuZXcgQGN1c3RvbV90eXBlc1tAY3VzdG9tX3R5cGVdKClcbiAgICAgICAgQGN1c3RvbV90eXBlLl9zZXRNb2RlbCBAXG4gICAgICBAY3VzdG9tX3R5cGVcblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyBvcHMuRGVsZXRlIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmVzID0gc3VwZXJcbiAgICAgICAgaWYgcmVzXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICByZXNcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBvcHMuRGVsZXRlLnBhcnNlID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IHRoaXMobnVsbCwgdWlkLCBkZWxldGVzX3VpZClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZFxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3Mgb3BzLkluc2VydCBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgY29udGVudCwgdWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4sIHBhcmVudCktPlxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxuICAgICAgaWYgY29udGVudCBpcyB1bmRlZmluZWRcbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgdmFsOiAoKS0+XG4gICAgICBpZiBAY29udGVudD8gYW5kIEBjb250ZW50LmdldEN1c3RvbVR5cGU/XG4gICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc19kZWxldGVkIGFuZCBvPyAjIG8/IDogaWYgbm90IG8/LCB0aGVuIHRoZSBkZWxpbWl0ZXIgZGVsZXRlZCB0aGlzIEluc2VydGlvbi4gRnVydGhlcm1vcmUsIGl0IHdvdWxkIGJlIHdyb25nIHRvIGNhbGwgaXQuIFRPRE86IG1ha2UgdGhpcyBtb3JlIGV4cHJlc3NpdmUgYW5kIHNhdmVcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXG4gICAgICAgIGNhbGxMYXRlciA9IHRydWVcbiAgICAgIGlmIG8/XG4gICAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgZ2FyYmFnZWNvbGxlY3QgPSBmYWxzZVxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgZ2FyYmFnZWNvbGxlY3QgPSB0cnVlXG4gICAgICBzdXBlciBnYXJiYWdlY29sbGVjdFxuICAgICAgaWYgY2FsbExhdGVyXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHMobylcbiAgICAgIGlmIEBwcmV2X2NsPy5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgICMgZGVsZXRlIGFsbCBvcHMgdGhhdCBkZWxldGUgdGhpcyBpbnNlcnRpb25cbiAgICAgICAgZm9yIGQgaW4gQGRlbGV0ZWRfYnlcbiAgICAgICAgICBkLmNsZWFudXAoKVxuXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwicmlnaHQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXG4gICAgICAgICMgY2hhbmdlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxuICAgICAgICBvID0gQG5leHRfY2xcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcbiAgICAgICAgICAgIG8ub3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxuXG4gICAgICAgICMgZGVsZXRlIGNvbnRlbnRcbiAgICAgICAgIyAtIHdlIG11c3Qgbm90IGRvIHRoaXMgaW4gYXBwbHlEZWxldGUsIGJlY2F1c2UgdGhpcyB3b3VsZCBsZWFkIHRvIGluY29uc2lzdGVuY2llc1xuICAgICAgICAjIChlLmcuIHRoZSBmb2xsb3dpbmcgb3BlcmF0aW9uIG9yZGVyIG11c3QgYmUgaW52ZXJ0aWJsZSA6XG4gICAgICAgICMgICBJbnNlcnQgcmVmZXJzIHRvIGNvbnRlbnQsIHRoZW4gdGhlIGNvbnRlbnQgaXMgZGVsZXRlZClcbiAgICAgICAgIyBUaGVyZWZvcmUsIHdlIGhhdmUgdG8gZG8gdGhpcyBpbiB0aGUgY2xlYW51cFxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb24gYW5kIG5vdCBkZWxldGVkX2Vhcmx5ZXJcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5LS1cbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXG4gICAgICAgICAgICBAY29udGVudC5hcHBseURlbGV0ZSgpXG4gICAgICAgIGRlbGV0ZSBAY29udGVudFxuICAgICAgICBzdXBlclxuICAgICAgIyBlbHNlXG4gICAgICAjICAgU29tZW9uZSBpbnNlcnRlZCBzb21ldGhpbmcgaW4gdGhlIG1lYW50aW1lLlxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA/PSAwXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSsrXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby51aWQuY3JlYXRvciA8IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzKClcbiAgICAgICAgQFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBnZXRDb250ZW50VHlwZSA9IChjb250ZW50KS0+XG4gICAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNvbnRlbnRcbiAgICAgIEBwYXJlbnQ/LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIEBjb250ZW50XG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBAcGFyZW50LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudC5nZXRDdXN0b21UeXBlKCkgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxuICAgICAgICBsZW5ndGg6IDFcbiAgICAgICAgY2hhbmdlZEJ5OiBvLnVpZC5jcmVhdG9yXG4gICAgICBdXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBqc29uLnByZXYgPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAganNvbi5uZXh0ID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGpzb24ucGFyZW50ID0gQHBhcmVudC5nZXRVaWQoKVxuXG4gICAgICBpZiBAb3JpZ2luLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBqc29uLm9yaWdpbiA9IFwiRGVsaW1pdGVyXCJcbiAgICAgIGVsc2UgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb24ub3JpZ2luID0gQG9yaWdpbi5nZXRVaWQoKVxuXG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uWydjb250ZW50J10gPSBKU09OLnN0cmluZ2lmeSBAY29udGVudFxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5JbnNlcnQucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgfSA9IGpzb25cbiAgICBpZiB0eXBlb2YgY29udGVudCBpcyBcInN0cmluZ1wiXG4gICAgICBjb250ZW50ID0gSlNPTi5wYXJzZShjb250ZW50KVxuICAgIG5ldyB0aGlzIG51bGwsIGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyBvcHMuRGVsaW1pdGVyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgbnVsbCwge25vT3BlcmF0aW9uOiB0cnVlfVxuXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cbiAgICAgICAgc3VwZXJcbiAgICAgICNlbHNlXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIG9wcy5EZWxpbWl0ZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQsIHByZXYsIG5leHQpXG5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxuICB7XG4gICAgJ29wZXJhdGlvbnMnIDogb3BzXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJiYXNpY19vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gIGJhc2ljX29wcyA9IGJhc2ljX29wc191bmluaXRpYWxpemVkKClcbiAgb3BzID0gYmFzaWNfb3BzLm9wZXJhdGlvbnNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3Mgb3BzLk1hcE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCktPlxuICAgICAgQF9tYXAgPSB7fVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBmb3IgbmFtZSxwIG9mIEBfbWFwXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgbWFwOiAoZiktPlxuICAgICAgZm9yIG4sdiBvZiBAX21hcFxuICAgICAgICBmKG4sdilcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uT3BlcmF0aW9ucy52YWxcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgYXJndW1lbnRzLmxlbmd0aCA+IDFcbiAgICAgICAgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuX2dldE1vZGVsP1xuICAgICAgICAgIHJlcCA9IGNvbnRlbnQuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmVwID0gY29udGVudFxuICAgICAgICBAcmV0cmlldmVTdWIobmFtZSkucmVwbGFjZSByZXBcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBwcm9wID0gQF9tYXBbbmFtZV1cbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgIHJlcyA9IHByb3AudmFsKClcbiAgICAgICAgICBpZiByZXMgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgICByZXMuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgcmVzXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAX21hcFxuICAgICAgICAgIGlmIG5vdCBvLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gby52YWwoKVxuICAgICAgICByZXN1bHRcblxuICAgIGRlbGV0ZTogKG5hbWUpLT5cbiAgICAgIEBfbWFwW25hbWVdPy5kZWxldGVDb250ZW50KClcbiAgICAgIEBcblxuICAgIHJldHJpZXZlU3ViOiAocHJvcGVydHlfbmFtZSktPlxuICAgICAgaWYgbm90IEBfbWFwW3Byb3BlcnR5X25hbWVdP1xuICAgICAgICBldmVudF9wcm9wZXJ0aWVzID1cbiAgICAgICAgICBuYW1lOiBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIGV2ZW50X3RoaXMgPSBAXG4gICAgICAgIHJtX3VpZCA9XG4gICAgICAgICAgbm9PcGVyYXRpb246IHRydWVcbiAgICAgICAgICBzdWI6IHByb3BlcnR5X25hbWVcbiAgICAgICAgICBhbHQ6IEBcbiAgICAgICAgcm0gPSBuZXcgb3BzLlJlcGxhY2VNYW5hZ2VyIG51bGwsIGV2ZW50X3Byb3BlcnRpZXMsIGV2ZW50X3RoaXMsIHJtX3VpZCAjIHRoaXMgb3BlcmF0aW9uIHNoYWxsIG5vdCBiZSBzYXZlZCBpbiB0aGUgSEJcbiAgICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV0gPSBybVxuICAgICAgICBybS5zZXRQYXJlbnQgQCwgcHJvcGVydHlfbmFtZVxuICAgICAgICBybS5leGVjdXRlKClcbiAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdXG5cbiAgb3BzLk1hcE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnIDogY3VzdG9tX3R5cGVcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQpXG5cblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5MaXN0TWFuYWdlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEEgTGlzdE1hbmFnZXIgbWFpbnRhaW5zIGEgbm9uLWVtcHR5IGxpc3QgdGhhdCBoYXMgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCAoYm90aCBEZWxpbWl0ZXJzISlcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQpLT5cbiAgICAgIEBiZWdpbm5pbmcgPSBuZXcgb3BzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgQGVuZCA9ICAgICAgIG5ldyBvcHMuRGVsaW1pdGVyIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgQGJlZ2lubmluZy5leGVjdXRlKClcbiAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGVuZFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGZvciBpLCBvIGluIHZhbFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLk9iamVjdFxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2Ygb3BzLkxpc3RNYW5hZ2VyXG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggby52YWwoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIG1hcDogKGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggZihvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIGZvbGQ6IChpbml0LCBmKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgaW5pdCA9IGYoaW5pdCwgbylcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgaW5pdFxuXG4gICAgdmFsOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgQHRvQXJyYXkoKVxuXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIFtjb250ZW50XVxuXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50cyktPlxuICAgICAgcmlnaHQgPSBsZWZ0Lm5leHRfY2xcbiAgICAgIHdoaWxlIHJpZ2h0LmlzRGVsZXRlZCgpXG4gICAgICAgIHJpZ2h0ID0gcmlnaHQubmV4dF9jbCAjIGZpbmQgdGhlIGZpcnN0IGNoYXJhY3RlciB0byB0aGUgcmlnaHQsIHRoYXQgaXMgbm90IGRlbGV0ZWQuIEluIHRoZSBjYXNlIHRoYXQgcG9zaXRpb24gaXMgMCwgaXRzIHRoZSBEZWxpbWl0ZXIuXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxuXG4gICAgICAjIFRPRE86IGFsd2F5cyBleHBlY3QgYW4gYXJyYXkgYXMgY29udGVudC4gVGhlbiB5b3UgY2FuIGNvbWJpbmUgdGhpcyB3aXRoIHRoZSBvdGhlciBvcHRpb24gKGVsc2UpXG4gICAgICBpZiBjb250ZW50cyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50c1xuICAgICAgICAgIGlmIGM/IGFuZCBjLl9uYW1lPyBhbmQgYy5fZ2V0TW9kZWw/XG4gICAgICAgICAgICBjID0gYy5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgICAgdG1wID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGMsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYW4gYXJyYXkgb2YgY29udGVudCBpbnRvIHRoaXMgbGlzdC5cbiAgICAjIEBOb3RlOiBUaGlzIGV4cGVjdHMgYW4gYXJyYXkgYXMgY29udGVudCFcbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50cyktPlxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50c1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XG4gICAgI1xuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGggPSAxKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zaXRpb24rMSkgIyBwb3NpdGlvbiAwIGluIHRoaXMgY2FzZSBpcyB0aGUgZGVsZXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlclxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQgPSAobmV3IG9wcy5EZWxldGUgbnVsbCwgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSAobm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcikpIGFuZCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBkZWxldGVfb3BzLnB1c2ggZC5fZW5jb2RlKClcbiAgICAgIEBcblxuICBvcHMuTGlzdE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBUZXh0VHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBUZXh0VHlwZVxuICAjXG4gIGNsYXNzIG9wcy5SZXBsYWNlTWFuYWdlciBleHRlbmRzIG9wcy5MaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF9wcm9wZXJ0aWVzIERlY29yYXRlcyB0aGUgZXZlbnQgdGhhdCBpcyB0aHJvd24gYnkgdGhlIFJNXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfdGhpcyBUaGUgb2JqZWN0IG9uIHdoaWNoIHRoZSBldmVudCBzaGFsbCBiZSBleGVjdXRlZFxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCwgYmVnaW5uaW5nLCBlbmQpLT5cbiAgICAgIGlmIG5vdCBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10/XG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzLmdldEN1c3RvbVR5cGUoKVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgYmVnaW5uaW5nLCBlbmRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyBvcHMuUmVwbGFjZWFibGUgbnVsbCwgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2wpLmV4ZWN1dGUoKVxuICAgICAgIyBUT0RPOiBkZWxldGUgcmVwbCAoZm9yIGRlYnVnZ2luZylcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgaXNDb250ZW50RGVsZXRlZDogKCktPlxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxuXG4gICAgZGVsZXRlQ29udGVudDogKCktPlxuICAgICAgKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXNcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24uYmVnaW5uaW5nID0gQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAganNvbi5lbmQgPSBAZW5kLmdldFVpZCgpXG4gICAgICBzdXBlciBqc29uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlcy5cbiAgIyBAc2VlIFJlcGxhY2VNYW5hZ2VyXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VhYmxlIGV4dGVuZHMgb3BzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4gIyBQYXJlbnQgaXMgYWxyZWFkeSBzYXZlZCBieSBSZXBsYWNlYWJsZVxuXG4gICAgdHlwZTogXCJSZXBsYWNlYWJsZVwiXG5cbiAgICAjXG4gICAgIyBUaGlzIGlzIGNhbGxlZCwgd2hlbiB0aGUgSW5zZXJ0LXR5cGUgd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjIFRPRE86IGNvbnNpZGVyIGRvaW5nIHRoaXMgaW4gYSBtb3JlIGNvbnNpc3RlbnQgbWFubmVyLiBUaGlzIGNvdWxkIGFsc28gYmVcbiAgICAjIGRvbmUgd2l0aCBleGVjdXRlLiBCdXQgY3VycmVudGx5LCB0aGVyZSBhcmUgbm8gc3BlY2l0YWwgSW5zZXJ0LW9wcyBmb3IgTGlzdE1hbmFnZXIuXG4gICAgI1xuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKCktPlxuICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBAcHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIHRoaXMgcmVwbGFjZXMgYW5vdGhlciBSZXBsYWNlYWJsZVxuICAgICAgICBpZiBub3QgQGlzX2RlbGV0ZWQgIyBXaGVuIHRoaXMgaXMgcmVjZWl2ZWQgZnJvbSB0aGUgSEIsIHRoaXMgY291bGQgYWxyZWFkeSBiZSBkZWxldGVkIVxuICAgICAgICAgIG9sZF92YWx1ZSA9IEBwcmV2X2NsLnZhbCgpXG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxuICAgICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcbiAgICAgICAgICBdXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyBUaGlzIHdvbid0IGJlIHJlY29nbml6ZWQgYnkgdGhlIHVzZXIsIGJlY2F1c2UgYW5vdGhlclxuICAgICAgICAjIGNvbmN1cnJlbnQgb3BlcmF0aW9uIGlzIHNldCBhcyB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgUk1cbiAgICAgICAgQGFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgIyBwcmV2IF9hbmRfIG5leHQgYXJlIERlbGltaXRlcnMuIFRoaXMgaXMgdGhlIGZpcnN0IGNyZWF0ZWQgUmVwbGFjZWFibGUgaW4gdGhlIFJNXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgXVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgICAgICBvbGRWYWx1ZTogQHZhbCgpXG4gICAgICAgIF1cblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuUmVwbGFjZWFibGUucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnY3VzdG9tX3R5cGUnIDogY3VzdG9tX3R5cGVcbiAgICB9ID0ganNvblxuICAgIGlmIHR5cGVvZiBjb250ZW50IGlzIFwic3RyaW5nXCJcbiAgICAgIGNvbnRlbnQgPSBKU09OLnBhcnNlKGNvbnRlbnQpXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pXG5cblxuICBiYXNpY19vcHNcblxuXG5cblxuXG5cbiIsIlxuY2xhc3MgWU9iamVjdFxuXG4gIGNvbnN0cnVjdG9yOiAoQF9vYmplY3QgPSB7fSktPlxuICAgIGlmIEBfb2JqZWN0LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZm9yIG5hbWUsIHZhbCBvZiBAX29iamVjdFxuICAgICAgICBpZiB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBuZXcgWU9iamVjdCh2YWwpXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWS5PYmplY3QgYWNjZXB0cyBKc29uIE9iamVjdHMgb25seVwiXG5cbiAgX25hbWU6IFwiT2JqZWN0XCJcblxuICBfZ2V0TW9kZWw6ICh0eXBlcywgb3BzKS0+XG4gICAgaWYgbm90IEBfbW9kZWw/XG4gICAgICBAX21vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKEApLmV4ZWN1dGUoKVxuICAgICAgZm9yIG4sbyBvZiBAX29iamVjdFxuICAgICAgICBAX21vZGVsLnZhbCBuLCBvXG4gICAgZGVsZXRlIEBfb2JqZWN0XG4gICAgQF9tb2RlbFxuXG4gIF9zZXRNb2RlbDogKEBfbW9kZWwpLT5cbiAgICBkZWxldGUgQF9vYmplY3RcblxuICBvYnNlcnZlOiAoZiktPlxuICAgIEBfbW9kZWwub2JzZXJ2ZSBmXG4gICAgQFxuXG4gIHVub2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLnVub2JzZXJ2ZSBmXG4gICAgQFxuXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICMgICBAcmV0dXJuIFtKc29uXVxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZXx8U3RyaW5nfE9iamVjdF0gRGVwZW5kaW5nIG9uIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIElmIG11dGFibGUgaXQgd2lsbCByZXR1cm4gYSBPcGVyYXRpb24tdHlwZSBvYmplY3QsIGlmIGltbXV0YWJsZSBpdCB3aWxsIHJldHVybiBTdHJpbmcvT2JqZWN0LlxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAjXG4gIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICBpZiBAX21vZGVsP1xuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXG4gICAgZWxzZVxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdXG4gICAgICBlbHNlXG4gICAgICAgIHJlcyA9IHt9XG4gICAgICAgIGZvciBuLHYgb2YgQF9vYmplY3RcbiAgICAgICAgICByZXNbbl0gPSB2XG4gICAgICAgIHJlc1xuXG4gIGRlbGV0ZTogKG5hbWUpLT5cbiAgICBAX21vZGVsLmRlbGV0ZShuYW1lKVxuICAgIEBcblxuaWYgd2luZG93P1xuICBpZiB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBmaXJzdCBpbXBvcnQgWSFcIlxuXG5pZiBtb2R1bGU/XG4gIG1vZHVsZS5leHBvcnRzID0gWU9iamVjdFxuXG5cblxuXG5cblxuXG5cbiIsIlxuWSA9IHJlcXVpcmUgJy4veSdcblxuYmluZFRvQ2hpbGRyZW4gPSAodGhhdCktPlxuICBmb3IgaSBpbiBbMC4uLnRoYXQuY2hpbGRyZW4ubGVuZ3RoXVxuICAgIGF0dHIgPSB0aGF0LmNoaWxkcmVuLml0ZW0oaSlcbiAgICBpZiBhdHRyLm5hbWU/XG4gICAgICBhdHRyLnZhbCA9IHRoYXQudmFsLnZhbChhdHRyLm5hbWUpXG4gIHRoYXQudmFsLm9ic2VydmUgKGV2ZW50cyktPlxuICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgIGlmIGV2ZW50Lm5hbWU/XG4gICAgICAgIGZvciBpIGluIFswLi4udGhhdC5jaGlsZHJlbi5sZW5ndGhdXG4gICAgICAgICAgYXR0ciA9IHRoYXQuY2hpbGRyZW4uaXRlbShpKVxuICAgICAgICAgIGlmIGF0dHIubmFtZT8gYW5kIGF0dHIubmFtZSBpcyBldmVudC5uYW1lXG4gICAgICAgICAgICBuZXdWYWwgPSB0aGF0LnZhbC52YWwoYXR0ci5uYW1lKVxuICAgICAgICAgICAgaWYgYXR0ci52YWwgaXNudCBuZXdWYWxcbiAgICAgICAgICAgICAgYXR0ci52YWwgPSBuZXdWYWxcblxuUG9seW1lciBcInktb2JqZWN0XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQGNvbm5lY3Rvcj9cbiAgICAgIEB2YWwgPSBuZXcgWSBAY29ubmVjdG9yXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgZWxzZSBpZiBAdmFsP1xuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQHZhbC50eXBlIGlzIFwiT2JqZWN0XCJcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuICBjb25uZWN0b3JDaGFuZ2VkOiAoKS0+XG4gICAgaWYgKG5vdCBAdmFsPylcbiAgICAgIEB2YWwgPSBuZXcgWSBAY29ubmVjdG9yXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cblBvbHltZXIgXCJ5LXByb3BlcnR5XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEBuYW1lP1xuICAgICAgaWYgQHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgQHZhbCA9IEBwYXJlbnRFbGVtZW50LnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgdHlwZW9mIEB2YWwgaXMgXCJzdHJpbmdcIlxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwoQG5hbWUsQHZhbClcbiAgICAgIGlmIEB2YWwudHlwZSBpcyBcIk9iamVjdFwiXG4gICAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuICB2YWxDaGFuZ2VkOiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEBuYW1lP1xuICAgICAgaWYgQHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgQHZhbCA9IEBwYXJlbnRFbGVtZW50LnZhbC52YWwoQG5hbWUsQHZhbCkudmFsKEBuYW1lKVxuICAgICAgICAjIFRPRE86IHBsZWFzZSB1c2UgaW5zdGFuY2VvZiBpbnN0ZWFkIG9mIC50eXBlLFxuICAgICAgICAjIHNpbmNlIGl0IGlzIG1vcmUgc2FmZSAoY29uc2lkZXIgc29tZW9uZSBwdXR0aW5nIGEgY3VzdG9tIE9iamVjdCB0eXBlIGhlcmUpXG4gICAgICBlbHNlIGlmIEB2YWwudHlwZSBpcyBcIk9iamVjdFwiXG4gICAgICAgIGJpbmRUb0NoaWxkcmVuIEBcbiAgICAgIGVsc2UgaWYgQHBhcmVudEVsZW1lbnQudmFsPy52YWw/IGFuZCBAdmFsIGlzbnQgQHBhcmVudEVsZW1lbnQudmFsLnZhbChAbmFtZSlcbiAgICAgICAgQHBhcmVudEVsZW1lbnQudmFsLnZhbCBAbmFtZSwgQHZhbFxuXG5cbiIsIlxuc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL09wZXJhdGlvbnMvU3RydWN0dXJlZFwiXG5cbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuL0VuZ2luZVwiXG5hZGFwdENvbm5lY3RvciA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckFkYXB0ZXJcIlxuXG5jcmVhdGVZID0gKGNvbm5lY3RvciktPlxuICB1c2VyX2lkID0gbnVsbFxuICBpZiBjb25uZWN0b3IudXNlcl9pZD9cbiAgICB1c2VyX2lkID0gY29ubmVjdG9yLnVzZXJfaWQgIyBUT0RPOiBjaGFuZ2UgdG8gZ2V0VW5pcXVlSWQoKVxuICBlbHNlXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxuICAgIGNvbm5lY3Rvci5vbl91c2VyX2lkX3NldCA9IChpZCktPlxuICAgICAgdXNlcl9pZCA9IGlkXG4gICAgICBIQi5yZXNldFVzZXJJZCBpZFxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgb3BzX21hbmFnZXIgPSBzdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkIEhCLCB0aGlzLmNvbnN0cnVjdG9yXG4gIG9wcyA9IG9wc19tYW5hZ2VyLm9wZXJhdGlvbnNcblxuICBlbmdpbmUgPSBuZXcgRW5naW5lIEhCLCBvcHNcbiAgYWRhcHRDb25uZWN0b3IgY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBvcHNfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcblxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5IQiA9IEhCXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLm9wZXJhdGlvbnMgPSBvcHNcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuZW5naW5lID0gZW5naW5lXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmNvbm5lY3RvciA9IGNvbm5lY3RvclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jdXN0b21fdHlwZXMgPSB0aGlzLmNvbnN0cnVjdG9yXG5cbiAgY3QgPSBuZXcgY3JlYXRlWS5PYmplY3QoKVxuICBtb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihjdCwgSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxuICBjdC5fc2V0TW9kZWwgbW9kZWxcbiAgY3RcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZXG5pZiB3aW5kb3c/XG4gIHdpbmRvdy5ZID0gY3JlYXRlWVxuXG5jcmVhdGVZLk9iamVjdCA9IHJlcXVpcmUgXCIuL1R5cGVzL09iamVjdFwiXG4iXX0=
