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
    function Operation(uid) {
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

    return Operation;

  })();
  ops.Delete = (function(_super) {
    __extends(Delete, _super);

    function Delete(uid, deletes) {
      this.saveOperation('deletes', deletes);
      Delete.__super__.constructor.call(this, uid);
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
    return new this(uid, deletes_uid);
  };
  ops.Insert = (function(_super) {
    __extends(Insert, _super);

    function Insert(content, uid, prev_cl, next_cl, origin, parent) {
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
      Insert.__super__.constructor.call(this, uid);
    }

    Insert.prototype.type = "Insert";

    Insert.prototype.val = function() {
      return this.content;
    };

    Insert.prototype.applyDelete = function(o) {
      var callLater, garbagecollect, _ref;
      if (this.deleted_by == null) {
        this.deleted_by = [];
      }
      callLater = false;
      if ((this.parent != null) && !this.isDeleted() && (o != null)) {
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
        this.prev_cl.applyDelete();
      }
      if (this.content instanceof ops.Operation) {
        this.content.applyDelete();
      }
      return delete this.content;
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
      var distance_to_origin, i, o;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (this.content instanceof ops.Operation) {
          this.content.insert_parent = this;
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
      var _ref;
      return (_ref = this.parent) != null ? _ref.callEvent([
        {
          type: "insert",
          position: this.getPosition(),
          object: this.parent,
          changedBy: this.uid.creator,
          value: this.content
        }
      ]) : void 0;
    };

    Insert.prototype.callOperationSpecificDeleteEvents = function(o) {
      return this.parent.callEvent([
        {
          type: "delete",
          position: this.getPosition(),
          object: this.parent,
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

    Insert.prototype._encode = function() {
      var json, _ref;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'parent': this.parent.getUid()
      };
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
      return json;
    };

    return Insert;

  })(ops.Operation);
  ops.Insert.parse = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], parent = json['parent'];
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    return new this(content, uid, prev, next, origin, parent);
  };
  ops.ImmutableObject = (function(_super) {
    __extends(ImmutableObject, _super);

    function ImmutableObject(uid, content) {
      this.content = content;
      ImmutableObject.__super__.constructor.call(this, uid);
    }

    ImmutableObject.prototype.type = "ImmutableObject";

    ImmutableObject.prototype.val = function() {
      return this.content;
    };

    ImmutableObject.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'content': this.content
      };
      return json;
    };

    return ImmutableObject;

  })(ops.Operation);
  ops.ImmutableObject.parse = function(json) {
    var content, uid;
    uid = json['uid'], content = json['content'];
    return new this(uid, content);
  };
  ops.Delimiter = (function(_super) {
    __extends(Delimiter, _super);

    function Delimiter(prev_cl, next_cl, origin) {
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      this.saveOperation('origin', prev_cl);
      Delimiter.__super__.constructor.call(this, {
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
var text_ops_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_ops_uninitialized = require("./Text");

module.exports = function() {
  var ops, text_ops;
  text_ops = text_ops_uninitialized();
  ops = text_ops.operations;
  ops.Object = (function(_super) {
    __extends(Object, _super);

    function Object() {
      return Object.__super__.constructor.apply(this, arguments);
    }

    Object.prototype.type = "Object";

    Object.prototype.applyDelete = function() {
      return Object.__super__.applyDelete.call(this);
    };

    Object.prototype.cleanup = function() {
      return Object.__super__.cleanup.call(this);
    };

    Object.prototype.toJson = function(transform_to_value) {
      var json, name, o, that, val;
      if (transform_to_value == null) {
        transform_to_value = false;
      }
      if ((this.bound_json == null) || (Object.observe == null) || true) {
        val = this.val();
        json = {};
        for (name in val) {
          o = val[name];
          if (o instanceof ops.Object) {
            json[name] = o.toJson(transform_to_value);
          } else if (o instanceof ops.ListManager) {
            json[name] = o.toJson(transform_to_value);
          } else if (transform_to_value && o instanceof ops.Operation) {
            json[name] = o.val();
          } else {
            json[name] = o;
          }
        }
        this.bound_json = json;
        if (Object.observe != null) {
          that = this;
          Object.observe(this.bound_json, function(events) {
            var event, _i, _len, _results;
            _results = [];
            for (_i = 0, _len = events.length; _i < _len; _i++) {
              event = events[_i];
              if ((event.changedBy == null) && (event.type === "add" || (event.type = "update"))) {
                _results.push(that.val(event.name, event.object[event.name]));
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          });
          this.observe(function(events) {
            var event, notifier, oldVal, _i, _len, _results;
            _results = [];
            for (_i = 0, _len = events.length; _i < _len; _i++) {
              event = events[_i];
              if (event.created_ !== this.HB.getUserId()) {
                notifier = Object.getNotifier(that.bound_json);
                oldVal = that.bound_json[event.name];
                if (oldVal != null) {
                  notifier.performChange('update', function() {
                    return that.bound_json[event.name] = that.val(event.name);
                  }, that.bound_json);
                  _results.push(notifier.notify({
                    object: that.bound_json,
                    type: 'update',
                    name: event.name,
                    oldValue: oldVal,
                    changedBy: event.changedBy
                  }));
                } else {
                  notifier.performChange('add', function() {
                    return that.bound_json[event.name] = that.val(event.name);
                  }, that.bound_json);
                  _results.push(notifier.notify({
                    object: that.bound_json,
                    type: 'add',
                    name: event.name,
                    oldValue: oldVal,
                    changedBy: event.changedBy
                  }));
                }
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          });
        }
      }
      return this.bound_json;
    };

    Object.prototype.val = function(name, content) {
      var args, i, o, type, _i, _ref;
      if ((name != null) && arguments.length > 1) {
        if ((content != null) && (content.constructor != null)) {
          type = ops[content.constructor.name];
          if ((type != null) && (type.create != null)) {
            args = [];
            for (i = _i = 1, _ref = arguments.length; 1 <= _ref ? _i < _ref : _i > _ref; i = 1 <= _ref ? ++_i : --_i) {
              args.push(arguments[i]);
            }
            o = type.create.apply(null, args);
            return Object.__super__.val.call(this, name, o);
          } else {
            throw new Error("The " + content.constructor.name + "-type is not (yet) supported in Y.");
          }
        } else {
          return Object.__super__.val.call(this, name, content);
        }
      } else {
        return Object.__super__.val.call(this, name);
      }
    };

    Object.prototype._encode = function() {
      return {
        'type': this.type,
        'uid': this.getUid()
      };
    };

    return Object;

  })(ops.MapManager);
  ops.Object.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  ops.Object.create = function(content, mutable) {
    var json, n, o;
    json = new ops.Object().execute();
    for (n in content) {
      o = content[n];
      json.val(n, o, mutable);
    }
    return json;
  };
  ops.Number = {};
  ops.Number.create = function(content) {
    return content;
  };
  return text_ops;
};


},{"./Text":8}],7:[function(require,module,exports){
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

    function MapManager(uid) {
      this.map = {};
      MapManager.__super__.constructor.call(this, uid);
    }

    MapManager.prototype.type = "MapManager";

    MapManager.prototype.applyDelete = function() {
      var name, p, _ref;
      _ref = this.map;
      for (name in _ref) {
        p = _ref[name];
        p.applyDelete();
      }
      return MapManager.__super__.applyDelete.call(this);
    };

    MapManager.prototype.cleanup = function() {
      return MapManager.__super__.cleanup.call(this);
    };

    MapManager.prototype.val = function(name, content) {
      var o, prop, result, _ref;
      if (arguments.length > 1) {
        this.retrieveSub(name).replace(content);
        return this;
      } else if (name != null) {
        prop = this.map[name];
        if ((prop != null) && !prop.isContentDeleted()) {
          return prop.val();
        } else {
          return void 0;
        }
      } else {
        result = {};
        _ref = this.map;
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
      if ((_ref = this.map[name]) != null) {
        _ref.deleteContent();
      }
      return this;
    };

    MapManager.prototype.retrieveSub = function(property_name) {
      var event_properties, event_this, rm, rm_uid;
      if (this.map[property_name] == null) {
        event_properties = {
          name: property_name
        };
        event_this = this;
        rm_uid = {
          noOperation: true,
          sub: property_name,
          alt: this
        };
        rm = new ops.ReplaceManager(event_properties, event_this, rm_uid);
        this.map[property_name] = rm;
        rm.setParent(this, property_name);
        rm.execute();
      }
      return this.map[property_name];
    };

    return MapManager;

  })(ops.Operation);
  ops.ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(uid) {
      this.beginning = new ops.Delimiter(void 0, void 0);
      this.end = new ops.Delimiter(this.beginning, void 0);
      this.beginning.next_cl = this.end;
      this.beginning.execute();
      this.end.execute();
      ListManager.__super__.constructor.call(this, uid);
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
          result.push(o);
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
      return this.insertAfter(this.end.prev_cl, content);
    };

    ListManager.prototype.insertAfter = function(left, content, options) {
      var c, createContent, right, tmp, _i, _len;
      createContent = function(content, options) {
        var type;
        if ((content != null) && (content.constructor != null)) {
          type = ops[content.constructor.name];
          if ((type != null) && (type.create != null)) {
            return type.create(content, options);
          } else {
            throw new Error("The " + content.constructor.name + "-type is not (yet) supported in Y.");
          }
        } else {
          return content;
        }
      };
      right = left.next_cl;
      while (right.isDeleted()) {
        right = right.next_cl;
      }
      left = right.prev_cl;
      if (content instanceof ops.Operation) {
        (new ops.Insert(content, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = content.length; _i < _len; _i++) {
          c = content[_i];
          tmp = (new ops.Insert(createContent(c, options), void 0, left, right)).execute();
          left = tmp;
        }
      }
      return this;
    };

    ListManager.prototype.insert = function(position, content, options) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, [content], options);
    };

    ListManager.prototype["delete"] = function(position, length) {
      var d, delete_ops, i, o, _i;
      o = this.getOperationByPosition(position + 1);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof ops.Delimiter) {
          break;
        }
        d = (new ops.Delete(void 0, o)).execute();
        o = o.next_cl;
        while ((!(o instanceof ops.Delimiter)) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return this;
    };

    ListManager.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid()
      };
      return json;
    };

    return ListManager;

  })(ops.Operation);
  ops.ListManager.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  ops.Array = function() {};
  ops.Array.create = function(content, mutable) {
    var ith, list;
    if (mutable === "mutable") {
      list = new ops.ListManager().execute();
      ith = list.getOperationByPosition(0);
      list.insertAfter(ith, content);
      return list;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return content;
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  ops.ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(event_properties, event_this, uid, beginning, end) {
      this.event_properties = event_properties;
      this.event_this = event_this;
      if (this.event_properties['object'] == null) {
        this.event_properties['object'] = this.event_this;
      }
      ReplaceManager.__super__.constructor.call(this, uid, beginning, end);
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
      relp = (new ops.Replaceable(content, this, replaceable_uid, o, o.next_cl)).execute();
      return void 0;
    };

    ReplaceManager.prototype.isContentDeleted = function() {
      return this.getLastOperation().isDeleted();
    };

    ReplaceManager.prototype.deleteContent = function() {
      (new ops.Delete(void 0, this.getLastOperation().uid)).execute();
      return void 0;
    };

    ReplaceManager.prototype.val = function() {
      var o;
      o = this.getLastOperation();
      return typeof o.val === "function" ? o.val() : void 0;
    };

    ReplaceManager.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'beginning': this.beginning.getUid(),
        'end': this.end.getUid()
      };
      return json;
    };

    return ReplaceManager;

  })(ops.ListManager);
  ops.Replaceable = (function(_super) {
    __extends(Replaceable, _super);

    function Replaceable(content, parent, uid, prev, next, origin, is_deleted) {
      this.saveOperation('parent', parent);
      Replaceable.__super__.constructor.call(this, content, uid, prev, next, origin);
      this.is_deleted = is_deleted;
    }

    Replaceable.prototype.type = "Replaceable";

    Replaceable.prototype.val = function() {
      return this.content;
    };

    Replaceable.prototype.applyDelete = function() {
      var res, _base, _base1, _base2;
      res = Replaceable.__super__.applyDelete.apply(this, arguments);
      if (this.content != null) {
        if (this.next_cl.type !== "Delimiter") {
          if (typeof (_base = this.content).deleteAllObservers === "function") {
            _base.deleteAllObservers();
          }
        }
        if (typeof (_base1 = this.content).applyDelete === "function") {
          _base1.applyDelete();
        }
        if (typeof (_base2 = this.content).dontSync === "function") {
          _base2.dontSync();
        }
      }
      this.content = null;
      return res;
    };

    Replaceable.prototype.cleanup = function() {
      return Replaceable.__super__.cleanup.apply(this, arguments);
    };

    Replaceable.prototype.callOperationSpecificInsertEvents = function() {
      var old_value;
      if (this.next_cl.type === "Delimiter" && this.prev_cl.type !== "Delimiter") {
        if (!this.is_deleted) {
          old_value = this.prev_cl.content;
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
            oldValue: this.content
          }
        ]);
      }
    };

    Replaceable.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'parent': this.parent.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'uid': this.getUid(),
        'is_deleted': this.is_deleted
      };
      if (this.origin.type === "Delimiter") {
        json.origin = "Delimiter";
      } else if (this.origin !== this.prev_cl) {
        json.origin = this.origin.getUid();
      }
      if (this.content instanceof ops.Operation) {
        json['content'] = this.content.getUid();
      } else {
        if ((this.content != null) && (this.content.creator != null)) {
          throw new Error("You must not set creator here!");
        }
        json['content'] = this.content;
      }
      return json;
    };

    return Replaceable;

  })(ops.Insert);
  ops.Replaceable.parse = function(json) {
    var content, is_deleted, next, origin, parent, prev, uid;
    content = json['content'], parent = json['parent'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], is_deleted = json['is_deleted'];
    return new this(content, parent, uid, prev, next, origin, is_deleted);
  };
  return basic_ops;
};


},{"./Basic":5}],8:[function(require,module,exports){
var structured_ops_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

structured_ops_uninitialized = require("./Structured");

module.exports = function() {
  var ops, structured_ops;
  structured_ops = structured_ops_uninitialized();
  ops = structured_ops.operations;
  ops.String = (function(_super) {
    __extends(String, _super);

    function String(uid) {
      this.textfields = [];
      String.__super__.constructor.call(this, uid);
    }

    String.prototype.type = "String";

    String.prototype.val = function() {
      return this.fold("", function(left, o) {
        return left + o.val();
      });
    };

    String.prototype.toString = function() {
      return this.val();
    };

    String.prototype.insert = function(position, content, options) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, content, options);
    };

    String.prototype.bind = function(textfield, dom_root) {
      var createRange, creator_token, t, word, writeContent, writeRange, _i, _len, _ref;
      if (dom_root == null) {
        dom_root = window;
      }
      if (dom_root.getSelection == null) {
        dom_root = window;
      }
      _ref = this.textfields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        t = _ref[_i];
        if (t === textfield) {
          return;
        }
      }
      creator_token = false;
      word = this;
      textfield.value = this.val();
      this.textfields.push(textfield);
      if ((textfield.selectionStart != null) && (textfield.setSelectionRange != null)) {
        createRange = function(fix) {
          var left, right;
          left = textfield.selectionStart;
          right = textfield.selectionEnd;
          if (fix != null) {
            left = fix(left);
            right = fix(right);
          }
          return {
            left: left,
            right: right
          };
        };
        writeRange = function(range) {
          writeContent(word.val());
          return textfield.setSelectionRange(range.left, range.right);
        };
        writeContent = function(content) {
          return textfield.value = content;
        };
      } else {
        createRange = function(fix) {
          var clength, edited_element, range, s;
          range = {};
          s = dom_root.getSelection();
          clength = textfield.textContent.length;
          range.left = Math.min(s.anchorOffset, clength);
          range.right = Math.min(s.focusOffset, clength);
          if (fix != null) {
            range.left = fix(range.left);
            range.right = fix(range.right);
          }
          edited_element = s.focusNode;
          if (edited_element === textfield || edited_element === textfield.childNodes[0]) {
            range.isReal = true;
          } else {
            range.isReal = false;
          }
          return range;
        };
        writeRange = function(range) {
          var r, s, textnode;
          writeContent(word.val());
          textnode = textfield.childNodes[0];
          if (range.isReal && (textnode != null)) {
            if (range.left < 0) {
              range.left = 0;
            }
            range.right = Math.max(range.left, range.right);
            if (range.right > textnode.length) {
              range.right = textnode.length;
            }
            range.left = Math.min(range.left, range.right);
            r = document.createRange();
            r.setStart(textnode, range.left);
            r.setEnd(textnode, range.right);
            s = window.getSelection();
            s.removeAllRanges();
            return s.addRange(r);
          }
        };
        writeContent = function(content) {
          var c, content_array, i, _j, _len1, _results;
          content_array = content.replace(new RegExp("\n", 'g'), " ").split(" ");
          textfield.innerText = "";
          _results = [];
          for (i = _j = 0, _len1 = content_array.length; _j < _len1; i = ++_j) {
            c = content_array[i];
            textfield.innerText += c;
            if (i !== content_array.length - 1) {
              _results.push(textfield.innerHTML += '&nbsp;');
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        };
      }
      writeContent(this.val());
      this.observe(function(events) {
        var event, fix, o_pos, r, _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = events.length; _j < _len1; _j++) {
          event = events[_j];
          if (!creator_token) {
            if (event.type === "insert") {
              o_pos = event.position;
              fix = function(cursor) {
                if (cursor <= o_pos) {
                  return cursor;
                } else {
                  cursor += 1;
                  return cursor;
                }
              };
              r = createRange(fix);
              _results.push(writeRange(r));
            } else if (event.type === "delete") {
              o_pos = event.position;
              fix = function(cursor) {
                if (cursor < o_pos) {
                  return cursor;
                } else {
                  cursor -= 1;
                  return cursor;
                }
              };
              r = createRange(fix);
              _results.push(writeRange(r));
            } else {
              _results.push(void 0);
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
      textfield.onkeypress = function(event) {
        var char, diff, pos, r;
        if (word.is_deleted) {
          textfield.onkeypress = null;
          return true;
        }
        creator_token = true;
        char = null;
        if (event.keyCode === 13) {
          char = '\n';
        } else if (event.key != null) {
          if (event.charCode === 32) {
            char = " ";
          } else {
            char = event.key;
          }
        } else {
          char = window.String.fromCharCode(event.keyCode);
        }
        if (char.length > 1) {
          return true;
        } else if (char.length > 0) {
          r = createRange();
          pos = Math.min(r.left, r.right);
          diff = Math.abs(r.right - r.left);
          word["delete"](pos, diff);
          word.insert(pos, char);
          r.left = pos + char.length;
          r.right = r.left;
          writeRange(r);
        }
        event.preventDefault();
        creator_token = false;
        return false;
      };
      textfield.onpaste = function(event) {
        if (word.is_deleted) {
          textfield.onpaste = null;
          return true;
        }
        return event.preventDefault();
      };
      textfield.oncut = function(event) {
        if (word.is_deleted) {
          textfield.oncut = null;
          return true;
        }
        return event.preventDefault();
      };
      return textfield.onkeydown = function(event) {
        var del_length, diff, new_pos, pos, r, val;
        creator_token = true;
        if (word.is_deleted) {
          textfield.onkeydown = null;
          return true;
        }
        r = createRange();
        pos = Math.min(r.left, r.right, word.val().length);
        diff = Math.abs(r.left - r.right);
        if ((event.keyCode != null) && event.keyCode === 8) {
          if (diff > 0) {
            word["delete"](pos, diff);
            r.left = pos;
            r.right = pos;
            writeRange(r);
          } else {
            if ((event.ctrlKey != null) && event.ctrlKey) {
              val = word.val();
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
              word["delete"](new_pos, pos - new_pos);
              r.left = new_pos;
              r.right = new_pos;
              writeRange(r);
            } else {
              if (pos > 0) {
                word["delete"](pos - 1, 1);
                r.left = pos - 1;
                r.right = pos - 1;
                writeRange(r);
              }
            }
          }
          event.preventDefault();
          creator_token = false;
          return false;
        } else if ((event.keyCode != null) && event.keyCode === 46) {
          if (diff > 0) {
            word["delete"](pos, diff);
            r.left = pos;
            r.right = pos;
            writeRange(r);
          } else {
            word["delete"](pos, 1);
            r.left = pos;
            r.right = pos;
            writeRange(r);
          }
          event.preventDefault();
          creator_token = false;
          return false;
        } else {
          creator_token = false;
          return true;
        }
      };
    };

    String.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid()
      };
      return json;
    };

    return String;

  })(ops.ListManager);
  ops.String.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  ops.String.create = function(content, mutable) {
    var word;
    if (mutable === "mutable") {
      word = new ops.String().execute();
      word.insert(0, content);
      return word;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return content;
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  return structured_ops;
};


},{"./Structured":7}],9:[function(require,module,exports){
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


},{"./y":10}],10:[function(require,module,exports){
var Engine, HistoryBuffer, adaptConnector, createY, json_ops_uninitialized;

json_ops_uninitialized = require("./Operations/Json");

HistoryBuffer = require("./HistoryBuffer");

Engine = require("./Engine");

adaptConnector = require("./ConnectorAdapter");

createY = function(connector) {
  var HB, engine, ops, ops_manager, user_id;
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
  ops_manager = json_ops_uninitialized(HB, this.constructor);
  ops = ops_manager.operations;
  engine = new Engine(HB, ops);
  adaptConnector(connector, engine, HB, ops_manager.execution_listener);
  ops.Operation.prototype.HB = HB;
  ops.Operation.prototype.operations = ops;
  ops.Operation.prototype.engine = engine;
  ops.Operation.prototype.connector = connector;
  ops.Operation.prototype.custom_ops = this.constructor;
  return new ops.Object(HB.getReservedUniqueIdentifier()).execute();
};

module.exports = createY;

if ((typeof window !== "undefined" && window !== null) && (window.Y == null)) {
  window.Y = createY;
}


},{"./ConnectorAdapter":1,"./Engine":3,"./HistoryBuffer":4,"./Operations/Json":6}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9PcGVyYXRpb25zL0Jhc2ljLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL09wZXJhdGlvbnMvSnNvbi5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9PcGVyYXRpb25zL1N0cnVjdHVyZWQuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvT3BlcmF0aW9ucy9UZXh0LmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL3ktb2JqZWN0LmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENB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LElBQUksQ0FBQyxXQW5CMUMsQ0FBQTtBQXFCQSxTQUFXLElBQUEsR0FBRyxDQUFDLE1BQUosQ0FBVyxFQUFFLENBQUMsMkJBQUgsQ0FBQSxDQUFYLENBQTRDLENBQUMsT0FBN0MsQ0FBQSxDQUFYLENBdEJRO0FBQUEsQ0FOVixDQUFBOztBQUFBLE1BOEJNLENBQUMsT0FBUCxHQUFpQixPQTlCakIsQ0FBQTs7QUErQkEsSUFBRyxrREFBQSxJQUFnQixrQkFBbkI7QUFDRSxFQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsT0FBWCxDQURGO0NBL0JBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuQ29ubmVjdG9yQ2xhc3MgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JDbGFzc1wiXG4jXG4jIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4jIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiNcbmFkYXB0Q29ubmVjdG9yID0gKGNvbm5lY3RvciwgZW5naW5lLCBIQiwgZXhlY3V0aW9uX2xpc3RlbmVyKS0+XG5cbiAgZm9yIG5hbWUsIGYgb2YgQ29ubmVjdG9yQ2xhc3NcbiAgICBjb25uZWN0b3JbbmFtZV0gPSBmXG5cbiAgY29ubmVjdG9yLnNldElzQm91bmRUb1koKVxuXG4gIHNlbmRfID0gKG8pLT5cbiAgICBpZiAoby51aWQuY3JlYXRvciBpcyBIQi5nZXRVc2VySWQoKSkgYW5kXG4gICAgICAgICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIikgYW5kICMgVE9ETzogaSBkb24ndCB0aGluayB0aGF0IHdlIG5lZWQgdGhpcyBhbnltb3JlLi5cbiAgICAgICAgKEhCLmdldFVzZXJJZCgpIGlzbnQgXCJfdGVtcFwiKVxuICAgICAgY29ubmVjdG9yLmJyb2FkY2FzdCBvXG5cbiAgaWYgY29ubmVjdG9yLmludm9rZVN5bmM/XG4gICAgSEIuc2V0SW52b2tlU3luY0hhbmRsZXIgY29ubmVjdG9yLmludm9rZVN5bmNcblxuICBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuICAjIEZvciB0aGUgWE1QUENvbm5lY3RvcjogbGV0cyBzZW5kIGl0IGFzIGFuIGFycmF5XG4gICMgdGhlcmVmb3JlLCB3ZSBoYXZlIHRvIHJlc3RydWN0dXJlIGl0IGxhdGVyXG4gIGVuY29kZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxuICAgIGZvciBuYW1lLHZhbHVlIG9mIHZcbiAgICAgIHVzZXI6IG5hbWVcbiAgICAgIHN0YXRlOiB2YWx1ZVxuICBwYXJzZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHt9XG4gICAgZm9yIHMgaW4gdlxuICAgICAgc3RhdGVfdmVjdG9yW3MudXNlcl0gPSBzLnN0YXRlXG4gICAgc3RhdGVfdmVjdG9yXG5cbiAgZ2V0U3RhdGVWZWN0b3IgPSAoKS0+XG4gICAgZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcblxuICBnZXRIQiA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0gcGFyc2Vfc3RhdGVfdmVjdG9yIHZcbiAgICBoYiA9IEhCLl9lbmNvZGUgc3RhdGVfdmVjdG9yXG4gICAganNvbiA9XG4gICAgICBoYjogaGJcbiAgICAgIHN0YXRlX3ZlY3RvcjogZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICBqc29uXG5cbiAgYXBwbHlIQiA9IChoYiwgZnJvbUhCKS0+XG4gICAgZW5naW5lLmFwcGx5T3AgaGIsIGZyb21IQlxuXG4gIGNvbm5lY3Rvci5nZXRTdGF0ZVZlY3RvciA9IGdldFN0YXRlVmVjdG9yXG4gIGNvbm5lY3Rvci5nZXRIQiA9IGdldEhCXG4gIGNvbm5lY3Rvci5hcHBseUhCID0gYXBwbHlIQlxuXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzID89IFtdXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzLnB1c2ggKHNlbmRlciwgb3ApLT5cbiAgICBpZiBvcC51aWQuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICBlbmdpbmUuYXBwbHlPcCBvcFxuXG5cbm1vZHVsZS5leHBvcnRzID0gYWRhcHRDb25uZWN0b3IiLCJcbm1vZHVsZS5leHBvcnRzID1cbiAgI1xuICAjIEBwYXJhbXMgbmV3IENvbm5lY3RvcihvcHRpb25zKVxuICAjICAgQHBhcmFtIG9wdGlvbnMuc3luY01ldGhvZCB7U3RyaW5nfSAgaXMgZWl0aGVyIFwic3luY0FsbFwiIG9yIFwibWFzdGVyLXNsYXZlXCIuXG4gICMgICBAcGFyYW0gb3B0aW9ucy5yb2xlIHtTdHJpbmd9IFRoZSByb2xlIG9mIHRoaXMgY2xpZW50XG4gICMgICAgICAgICAgICAoc2xhdmUgb3IgbWFzdGVyIChvbmx5IHVzZWQgd2hlbiBzeW5jTWV0aG9kIGlzIG1hc3Rlci1zbGF2ZSkpXG4gICMgICBAcGFyYW0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4ge0Jvb2xlYW59IFdoZXRlaHIgdG8gd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycywgYnV0IGhhcyBzb21lIG92ZXJoZWFkIChvcHRpb25hbClcbiAgI1xuICBpbml0OiAob3B0aW9ucyktPlxuICAgIHJlcSA9IChuYW1lLCBjaG9pY2VzKT0+XG4gICAgICBpZiBvcHRpb25zW25hbWVdP1xuICAgICAgICBpZiAobm90IGNob2ljZXM/KSBvciBjaG9pY2VzLnNvbWUoKGMpLT5jIGlzIG9wdGlvbnNbbmFtZV0pXG4gICAgICAgICAgQFtuYW1lXSA9IG9wdGlvbnNbbmFtZV1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4gc2V0IHRoZSAnXCIrbmFtZStcIicgb3B0aW9uIHRvIG9uZSBvZiB0aGUgZm9sbG93aW5nIGNob2ljZXM6IFwiK0pTT04uZW5jb2RlKGNob2ljZXMpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IHNwZWNpZnkgXCIrbmFtZStcIiwgd2hlbiBpbml0aWFsaXppbmcgdGhlIENvbm5lY3RvciFcIlxuXG4gICAgcmVxIFwic3luY01ldGhvZFwiLCBbXCJzeW5jQWxsXCIsIFwibWFzdGVyLXNsYXZlXCJdXG4gICAgcmVxIFwicm9sZVwiLCBbXCJtYXN0ZXJcIiwgXCJzbGF2ZVwiXVxuICAgIHJlcSBcInVzZXJfaWRcIlxuICAgIEBvbl91c2VyX2lkX3NldD8oQHVzZXJfaWQpXG5cbiAgICAjIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMuXG4gICAgIyBCdXQgdGhpcyBpcyBub3QgbmVjZXNzYXJ5IGluIHRoZSB0ZXN0LWNvbm5lY3RvclxuICAgIGlmIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluP1xuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluXG4gICAgZWxzZVxuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IHRydWVcblxuICAgICMgQSBNYXN0ZXIgc2hvdWxkIHN5bmMgd2l0aCBldmVyeW9uZSEgVE9ETzogcmVhbGx5PyAtIGZvciBub3cgaXRzIHNhZmVyIHRoaXMgd2F5IVxuICAgIGlmIEByb2xlIGlzIFwibWFzdGVyXCJcbiAgICAgIEBzeW5jTWV0aG9kID0gXCJzeW5jQWxsXCJcblxuICAgICMgaXMgc2V0IHRvIHRydWUgd2hlbiB0aGlzIGlzIHN5bmNlZCB3aXRoIGFsbCBvdGhlciBjb25uZWN0aW9uc1xuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxuICAgICMgUGVlcmpzIENvbm5lY3Rpb25zOiBrZXk6IGNvbm4taWQsIHZhbHVlOiBvYmplY3RcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgICMgTGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBzaGFsbCBwcm9jZXNzIGluY29taW5nIGRhdGFcbiAgICBAcmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxuXG4gICAgIyB3aGV0aGVyIHRoaXMgaW5zdGFuY2UgaXMgYm91bmQgdG8gYW55IHkgaW5zdGFuY2VcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IGZhbHNlXG4gICAgQGlzX2luaXRpYWxpemVkID0gdHJ1ZVxuXG4gIGlzUm9sZU1hc3RlcjogLT5cbiAgICBAcm9sZSBpcyBcIm1hc3RlclwiXG5cbiAgaXNSb2xlU2xhdmU6IC0+XG4gICAgQHJvbGUgaXMgXCJzbGF2ZVwiXG5cbiAgZmluZE5ld1N5bmNUYXJnZXQ6ICgpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGlmIG5vdCBjLmlzX3N5bmNlZFxuICAgICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICAgICAgYnJlYWtcbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAc2V0U3RhdGVTeW5jZWQoKVxuICAgIG51bGxcblxuICB1c2VyTGVmdDogKHVzZXIpLT5cbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXG4gICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcblxuICB1c2VySm9pbmVkOiAodXNlciwgcm9sZSktPlxuICAgIGlmIG5vdCByb2xlP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSW50ZXJuYWw6IFlvdSBtdXN0IHNwZWNpZnkgdGhlIHJvbGUgb2YgdGhlIGpvaW5lZCB1c2VyISBFLmcuIHVzZXJKb2luZWQoJ3VpZDozOTM5Jywnc2xhdmUnKVwiXG4gICAgIyBhIHVzZXIgam9pbmVkIHRoZSByb29tXG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdID89IHt9XG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdLmlzX3N5bmNlZCA9IGZhbHNlXG5cbiAgICBpZiAobm90IEBpc19zeW5jZWQpIG9yIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgZWxzZSBpZiByb2xlIGlzIFwibWFzdGVyXCJcbiAgICAgICAgIyBUT0RPOiBXaGF0IGlmIHRoZXJlIGFyZSB0d28gbWFzdGVycz8gUHJldmVudCBzZW5kaW5nIGV2ZXJ5dGhpbmcgdHdvIHRpbWVzIVxuICAgICAgICBAcGVyZm9ybVN5bmNXaXRoTWFzdGVyIHVzZXJcblxuXG4gICNcbiAgIyBFeGVjdXRlIGEgZnVuY3Rpb24gX3doZW5fIHdlIGFyZSBjb25uZWN0ZWQuIElmIG5vdCBjb25uZWN0ZWQsIHdhaXQgdW50aWwgY29ubmVjdGVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgYXJncy5jb25zdHJ1Y3RvcmUgaXMgRnVuY3Rpb25cbiAgICAgIGFyZ3MgPSBbYXJnc11cbiAgICBpZiBAaXNfc3luY2VkXG4gICAgICBhcmdzWzBdLmFwcGx5IHRoaXMsIGFyZ3NbMS4uXVxuICAgIGVsc2VcbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkID89IFtdXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZC5wdXNoIGFyZ3NcblxuICAjXG4gICMgRXhlY3V0ZSBhbiBmdW5jdGlvbiB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC4gZiB3aWxsIGJlIGNhbGxlZCB3aXRoIChzZW5kZXJfaWQsIGJyb2FkY2FzdCB7dHJ1ZXxmYWxzZX0sIG1lc3NhZ2UpLlxuICAjXG4gIG9uUmVjZWl2ZTogKGYpLT5cbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcblxuICAjIyNcbiAgIyBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBjb25uZWN0ZWQgcGVlcnMuXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gYnJvYWRjYXN0LlxuICAjXG4gIGJyb2FkY2FzdDogKG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgYnJvYWRjYXN0IVwiXG5cbiAgI1xuICAjIFNlbmQgYSBtZXNzYWdlIHRvIGEgcGVlciwgb3Igc2V0IG9mIHBlZXJzXG4gICNcbiAgc2VuZDogKHBlZXJfcywgbWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBzZW5kIVwiXG4gICMjI1xuXG4gICNcbiAgIyBwZXJmb3JtIGEgc3luYyB3aXRoIGEgc3BlY2lmaWMgdXNlci5cbiAgI1xuICBwZXJmb3JtU3luYzogKHVzZXIpLT5cbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICAgIEBzZW5kIHVzZXIsXG4gICAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgIGRhdGE6IFtdICMgQGdldFN0YXRlVmVjdG9yKClcbiAgICAgIGlmIG5vdCBAc2VudF9oYl90b19hbGxfdXNlcnNcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxuXG4gICAgICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMzBcbiAgICAgICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG5cblxuICAjXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxuICAjXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICBAc2VuZCB1c2VyLFxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICBkYXRhOiBbXVxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgIF9oYiA9IFtdXG4gICAgZm9yIG8gaW4gaGJcbiAgICAgIF9oYi5wdXNoIG9cbiAgICAgIGlmIF9oYi5sZW5ndGggPiAzMFxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgX2hiID0gW11cbiAgICBAYnJvYWRjYXN0XG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICBkYXRhOiBfaGJcblxuICAjXG4gICMgWW91IGFyZSBzdXJlIHRoYXQgYWxsIGNsaWVudHMgYXJlIHN5bmNlZCwgY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XG4gICAgaWYgbm90IEBpc19zeW5jZWRcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cbiAgICAgICAgZm9yIGYgaW4gQGNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgICAgICBmKClcbiAgICAgICAgZGVsZXRlIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICBudWxsXG5cbiAgI1xuICAjIFlvdSByZWNlaXZlZCBhIHJhdyBtZXNzYWdlLCBhbmQgeW91IGtub3cgdGhhdCBpdCBpcyBpbnRlbmRlZCBmb3IgdG8gWWpzLiBUaGVuIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICByZWNlaXZlTWVzc2FnZTogKHNlbmRlciwgcmVzKS0+XG4gICAgaWYgbm90IHJlcy5zeW5jX3N0ZXA/XG4gICAgICBmb3IgZiBpbiBAcmVjZWl2ZV9oYW5kbGVyc1xuICAgICAgICBmIHNlbmRlciwgcmVzXG4gICAgZWxzZVxuICAgICAgaWYgc2VuZGVyIGlzIEB1c2VyX2lkXG4gICAgICAgIHJldHVyblxuICAgICAgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImdldEhCXCJcbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcbiAgICAgICAgaGIgPSBkYXRhLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxuICAgICAgICAjIFdoZW4gdGhpcyBjbGllbnQgb25seSBzeW5jcyB0byBvbmUgb3RoZXIgY2xpZW50cywgYnV0IGxvb3NlcyBjb25uZWN0b3JzLFxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcbiAgICAgICAgaWYgQGlzX3N5bmNlZFxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXG5cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDMwXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG5cbiAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxuICAgICAgICAgICAgKCk9PlxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogaGJcbiAgICAgICAgICAgICAgICBzZW50X2FnYWluOiBcInRydWVcIlxuICAgICAgICAgIHNldFRpbWVvdXQgc2VuZF9hZ2FpbiwgMzAwMFxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQlwiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cbiAgICAgICAgaWYgKEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiIG9yIHJlcy5zZW50X2FnYWluPykgYW5kIChub3QgQGlzX3N5bmNlZCkgYW5kICgoQGN1cnJlbnRfc3luY190YXJnZXQgaXMgc2VuZGVyKSBvciAobm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0PykpXG4gICAgICAgICAgQGNvbm5lY3Rpb25zW3NlbmRlcl0uaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG5cbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJfXCJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcblxuXG4gICMgQ3VycmVudGx5LCB0aGUgSEIgZW5jb2RlcyBvcGVyYXRpb25zIGFzIEpTT04uIEZvciB0aGUgbW9tZW50IEkgd2FudCB0byBrZWVwIGl0XG4gICMgdGhhdCB3YXkuIE1heWJlIHdlIHN1cHBvcnQgZW5jb2RpbmcgaW4gdGhlIEhCIGFzIFhNTCBpbiB0aGUgZnV0dXJlLCBidXQgZm9yIG5vdyBJIGRvbid0IHdhbnRcbiAgIyB0b28gbXVjaCBvdmVyaGVhZC4gWSBpcyB2ZXJ5IGxpa2VseSB0byBnZXQgY2hhbmdlZCBhIGxvdCBpbiB0aGUgZnV0dXJlXG4gICNcbiAgIyBCZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gZW5jb2RlIEpTT04gYXMgc3RyaW5nICh3aXRoIGNoYXJhY3RlciBlc2NhcGluZywgd2ljaCBtYWtlcyBpdCBwcmV0dHkgbXVjaCB1bnJlYWRhYmxlKVxuICAjIHdlIGVuY29kZSB0aGUgSlNPTiBhcyBYTUwuXG4gICNcbiAgIyBXaGVuIHRoZSBIQiBzdXBwb3J0IGVuY29kaW5nIGFzIFhNTCwgdGhlIGZvcm1hdCBzaG91bGQgbG9vayBwcmV0dHkgbXVjaCBsaWtlIHRoaXMuXG5cbiAgIyBkb2VzIG5vdCBzdXBwb3J0IHByaW1pdGl2ZSB2YWx1ZXMgYXMgYXJyYXkgZWxlbWVudHNcbiAgIyBleHBlY3RzIGFuIGx0eCAobGVzcyB0aGFuIHhtbCkgb2JqZWN0XG4gIHBhcnNlTWVzc2FnZUZyb21YbWw6IChtKS0+XG4gICAgcGFyc2VfYXJyYXkgPSAobm9kZSktPlxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBwYXJzZV9hcnJheSBuXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBwYXJzZV9vYmplY3QgblxuXG4gICAgcGFyc2Vfb2JqZWN0ID0gKG5vZGUpLT5cbiAgICAgIGpzb24gPSB7fVxuICAgICAgZm9yIG5hbWUsIHZhbHVlICBvZiBub2RlLmF0dHJzXG4gICAgICAgIGludCA9IHBhcnNlSW50KHZhbHVlKVxuICAgICAgICBpZiBpc05hTihpbnQpIG9yIChcIlwiK2ludCkgaXNudCB2YWx1ZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSB2YWx1ZVxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IGludFxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxuICAgICAgICBuYW1lID0gbi5uYW1lXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9hcnJheSBuXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2Vfb2JqZWN0IG5cbiAgICAgIGpzb25cbiAgICBwYXJzZV9vYmplY3QgbVxuXG4gICMgZW5jb2RlIG1lc3NhZ2UgaW4geG1sXG4gICMgd2UgdXNlIHN0cmluZyBiZWNhdXNlIFN0cm9waGUgb25seSBhY2NlcHRzIGFuIFwieG1sLXN0cmluZ1wiLi5cbiAgIyBTbyB7YTo0LGI6e2M6NX19IHdpbGwgbG9vayBsaWtlXG4gICMgPHkgYT1cIjRcIj5cbiAgIyAgIDxiIGM9XCI1XCI+PC9iPlxuICAjIDwveT5cbiAgIyBtIC0gbHR4IGVsZW1lbnRcbiAgIyBqc29uIC0gZ3Vlc3MgaXQgOylcbiAgI1xuICBlbmNvZGVNZXNzYWdlVG9YbWw6IChtLCBqc29uKS0+XG4gICAgIyBhdHRyaWJ1dGVzIGlzIG9wdGlvbmFsXG4gICAgZW5jb2RlX29iamVjdCA9IChtLCBqc29uKS0+XG4gICAgICBmb3IgbmFtZSx2YWx1ZSBvZiBqc29uXG4gICAgICAgIGlmIG5vdCB2YWx1ZT9cbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKG5hbWUpLCB2YWx1ZVxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIEFycmF5XG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG0uc2V0QXR0cmlidXRlKG5hbWUsdmFsdWUpXG4gICAgICBtXG4gICAgZW5jb2RlX2FycmF5ID0gKG0sIGFycmF5KS0+XG4gICAgICBtLnNldEF0dHJpYnV0ZShcImlzQXJyYXlcIixcInRydWVcIilcbiAgICAgIGZvciBlIGluIGFycmF5XG4gICAgICAgIGlmIGUuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJhcnJheS1lbGVtZW50XCIpLCBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgbVxuICAgIGlmIGpzb24uY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxuICAgIGVsc2UgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgZW5jb2RlX2FycmF5IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkkgY2FuJ3QgZW5jb2RlIHRoaXMganNvbiFcIlxuXG4gIHNldElzQm91bmRUb1k6ICgpLT5cbiAgICBAb25fYm91bmRfdG9feT8oKVxuICAgIGRlbGV0ZSBAd2hlbl9ib3VuZF90b195XG4gICAgQGlzX2JvdW5kX3RvX3kgPSB0cnVlXG4iLCJcbndpbmRvdz8udW5wcm9jZXNzZWRfY291bnRlciA9IDAgIyBkZWwgdGhpc1xud2luZG93Py51bnByb2Nlc3NlZF9leGVjX2NvdW50ZXIgPSAwICMgVE9ET1xud2luZG93Py51bnByb2Nlc3NlZF90eXBlcyA9IFtdXG5cbiNcbiMgQG5vZG9jXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXG4jXG5jbGFzcyBFbmdpbmVcblxuICAjXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAjIEBwYXJhbSB7T2JqZWN0fSB0eXBlcyBsaXN0IG9mIGF2YWlsYWJsZSB0eXBlc1xuICAjXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAdHlwZXMpLT5cbiAgICBAdW5wcm9jZXNzZWRfb3BzID0gW11cblxuICAjXG4gICMgUGFyc2VzIGFuIG9wZXJhdGlvIGZyb20gdGhlIGpzb24gZm9ybWF0LiBJdCB1c2VzIHRoZSBzcGVjaWZpZWQgcGFyc2VyIGluIHlvdXIgT3BlcmF0aW9uVHlwZSBtb2R1bGUuXG4gICNcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XG4gICAgdHlwZSA9IEB0eXBlc1tqc29uLnR5cGVdXG4gICAgaWYgdHlwZT8ucGFyc2U/XG4gICAgICB0eXBlLnBhcnNlIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXG5cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLl9lbmNvZGUoKS5cbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcbiAgIyMjXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cbiAgICBvcHMgPSBbXVxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xuICAgIGZvciBvIGluIG9wc1xuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcbiAgIyMjXG5cbiAgI1xuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXG4gICNcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIGlmIG5vdCBASEIuZ2V0T3BlcmF0aW9uKG8udWlkKT9cbiAgICAgICAgQGFwcGx5T3Agb1xuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wXG4gIGFwcGx5T3BzOiAob3BzX2pzb24pLT5cbiAgICBAYXBwbHlPcCBvcHNfanNvblxuXG4gICNcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICMgVE9ETzogbWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50ISFcbiAgIyAtIG9wZXJhdGlvbnMgbWF5IG9ubHkgZXhlY3V0ZWQgaW4gb3JkZXIgYnkgY3JlYXRvciwgb3JkZXIgdGhlbSBpbiBvYmplY3Qgb2YgYXJyYXlzIChrZXkgYnkgY3JlYXRvcilcbiAgIyAtIHlvdSBjYW4gcHJvYmFibHkgbWFrZSBzb21ldGhpbmcgbGlrZSBkZXBlbmRlbmNpZXMgKGNyZWF0b3IxIHdhaXRzIGZvciBjcmVhdG9yMilcbiAgYXBwbHlPcDogKG9wX2pzb25fYXJyYXksIGZyb21IQiA9IGZhbHNlKS0+XG4gICAgaWYgb3BfanNvbl9hcnJheS5jb25zdHJ1Y3RvciBpc250IEFycmF5XG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXG4gICAgZm9yIG9wX2pzb24gaW4gb3BfanNvbl9hcnJheVxuICAgICAgaWYgZnJvbUhCXG4gICAgICAgIG9wX2pzb24uZnJvbUhCID0gXCJ0cnVlXCIgIyBleGVjdXRlIGltbWVkaWF0ZWx5LCBpZlxuICAgICAgIyAkcGFyc2VfYW5kX2V4ZWN1dGUgd2lsbCByZXR1cm4gZmFsc2UgaWYgJG9fanNvbiB3YXMgcGFyc2VkIGFuZCBleGVjdXRlZCwgb3RoZXJ3aXNlIHRoZSBwYXJzZWQgb3BlcmFkaW9uXG4gICAgICBvID0gQHBhcnNlT3BlcmF0aW9uIG9wX2pzb25cbiAgICAgIG8ucGFyc2VkX2Zyb21fanNvbiA9IG9wX2pzb25cbiAgICAgIGlmIG9wX2pzb24uZnJvbUhCP1xuICAgICAgICBvLmZyb21IQiA9IG9wX2pzb24uZnJvbUhCXG4gICAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xuICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvKT9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgKChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykpIG9yIChub3Qgby5leGVjdXRlKCkpXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXG4gICAgICAgIHdpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMucHVzaCBvLnR5cGUgIyBUT0RPOiBkZWxldGUgdGhpc1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG5cbiAgI1xuICAjIENhbGwgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYXBwbGllZCBhIG5ldyBvcGVyYXRpb24uXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxuICAjXG4gIHRyeVVucHJvY2Vzc2VkOiAoKS0+XG4gICAgd2hpbGUgdHJ1ZVxuICAgICAgb2xkX2xlbmd0aCA9IEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoXG4gICAgICB1bnByb2Nlc3NlZCA9IFtdXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xuICAgICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG9wKT9cbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24ob3ApIGFuZCAobm90IG9wLmZyb21IQj8pKSBvciAobm90IG9wLmV4ZWN1dGUoKSlcbiAgICAgICAgICB1bnByb2Nlc3NlZC5wdXNoIG9wXG4gICAgICBAdW5wcm9jZXNzZWRfb3BzID0gdW5wcm9jZXNzZWRcbiAgICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzIG9sZF9sZW5ndGhcbiAgICAgICAgYnJlYWtcbiAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpc250IDBcbiAgICAgIEBIQi5pbnZva2VTeW5jKClcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEVuZ2luZVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuIiwiXG4jXG4jIEBub2RvY1xuIyBBbiBvYmplY3QgdGhhdCBob2xkcyBhbGwgYXBwbGllZCBvcGVyYXRpb25zLlxuI1xuIyBAbm90ZSBUaGUgSGlzdG9yeUJ1ZmZlciBpcyBjb21tb25seSBhYmJyZXZpYXRlZCB0byBIQi5cbiNcbmNsYXNzIEhpc3RvcnlCdWZmZXJcblxuICAjXG4gICMgQ3JlYXRlcyBhbiBlbXB0eSBIQi5cbiAgIyBAcGFyYW0ge09iamVjdH0gdXNlcl9pZCBDcmVhdG9yIG9mIHRoZSBIQi5cbiAgI1xuICBjb25zdHJ1Y3RvcjogKEB1c2VyX2lkKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyID0ge31cbiAgICBAYnVmZmVyID0ge31cbiAgICBAY2hhbmdlX2xpc3RlbmVycyA9IFtdXG4gICAgQGdhcmJhZ2UgPSBbXSAjIFdpbGwgYmUgY2xlYW5lZCBvbiBuZXh0IGNhbGwgb2YgZ2FyYmFnZUNvbGxlY3RvclxuICAgIEB0cmFzaCA9IFtdICMgSXMgZGVsZXRlZC4gV2FpdCB1bnRpbCBpdCBpcyBub3QgdXNlZCBhbnltb3JlLlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSB0cnVlXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IDMwMDAwXG4gICAgQHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlciA9IDBcbiAgICBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcblxuICByZXNldFVzZXJJZDogKGlkKS0+XG4gICAgb3duID0gQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBvd24/XG4gICAgICBmb3Igb19uYW1lLG8gb2Ygb3duXG4gICAgICAgIGlmIG8udWlkLmNyZWF0b3I/XG4gICAgICAgICAgby51aWQuY3JlYXRvciA9IGlkXG4gICAgICAgIGlmIG8udWlkLmFsdD9cbiAgICAgICAgICBvLnVpZC5hbHQuY3JlYXRvciA9IGlkXG4gICAgICBpZiBAYnVmZmVyW2lkXT9cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGFyZSByZS1hc3NpZ25pbmcgYW4gb2xkIHVzZXIgaWQgLSB0aGlzIGlzIG5vdCAoeWV0KSBwb3NzaWJsZSFcIlxuICAgICAgQGJ1ZmZlcltpZF0gPSBvd25cbiAgICAgIGRlbGV0ZSBAYnVmZmVyW0B1c2VyX2lkXVxuICAgIGlmIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxuICAgICAgZGVsZXRlIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICBAdXNlcl9pZCA9IGlkXG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxuICAgICAgby5jbGVhbnVwPygpXG5cbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxuICAgIEB0cmFzaCA9IFtdXG4gICAgaWYgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCBpc250IC0xXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcbiAgICB1bmRlZmluZWRcblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxuICAgICAgZm9yIG8gaW4gYXJndW1lbnRzXG4gICAgICAgIGlmIG8/XG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXG5cbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXG4gICAgQHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0KClcbiAgICBAZ2FyYmFnZSA9IFtdXG4gICAgQHRyYXNoID0gW11cblxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxuICAgIGNsZWFyVGltZW91dCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWRcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcblxuICBzZXRHYXJiYWdlQ29sbGVjdFRpbWVvdXQ6IChAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0KS0+XG5cbiAgI1xuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICByZXMgPSB7fVxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICAgIHJlc1xuICAgIGVsc2VcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBvLnVpZC5vcF9udW1iZXIgPD0gQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XG5cbiAgI1xuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXG4gICAgICBpZiB1X25hbWUgaXMgXCJfXCJcbiAgICAgICAgY29udGludWVcbiAgICAgIGZvciBvX251bWJlcixvIG9mIHVzZXJcbiAgICAgICAgaWYgKG5vdCBvLnVpZC5ub09wZXJhdGlvbj8pIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/ICMgYXBwbGllcyBmb3IgYWxsIG9wcyBidXQgdGhlIG1vc3QgcmlnaHQgZGVsaW1pdGVyIVxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQudWlkLmNyZWF0b3IsIG9fbmV4dC51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD8gIyBtb3N0IHJpZ2h0IGRlbGltaXRlciBvbmx5IVxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX3ByZXYudWlkLmNyZWF0b3IsIG9fcHJldi51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxuICAjIG9uIHRoZSBvcGVyYXRpb25zIHJldHJpZXZlU3ViIG1ldGhvZCAod2hpY2ggbXVzdCEgYmUgZGVmaW5lZClcbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBpZiB1aWQuc3ViPyBhbmQgbz9cbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxuICAgIGVsc2VcbiAgICAgIG9cblxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSkpIGFuZCBzdGF0ZV92ZWN0b3JbdXNlcl0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcbiAgICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgd2hpbGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1dP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSAtIChvLnVpZC5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgb3BzID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wcy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXSAjIFRPRE86IHJlbmFtZSB0byBvYnNlcnZlcnMgb3Igc3RoIGxpa2UgdGhhdFxuICAgICAgaWYgdWlkP1xuICAgICAgICBAdWlkID0gdWlkXG5cbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXG5cbiAgICByZXRyaWV2ZVN1YjogKCktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzLnB1c2ggZlxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBmdW5jdGlvbiBmcm9tIHRoZSBvYnNlcnZlciBsaXN0XG4gICAgIyBAc2VlIE9wZXJhdGlvbi5vYnNlcnZlXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHVub2JzZXJ2ZShldmVudCwgZilcbiAgICAjICAgQHBhcmFtIGYgICAgIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRoYXQgeW91IHdhbnQgdG8gZGVsZXRlIFxuICAgIHVub2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBAZXZlbnRfbGlzdGVuZXJzLmZpbHRlciAoZyktPlxuICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgIyBUaGlzIHNob3VsZCBiZSBjYWxsZWQsIGUuZy4gYWZ0ZXIgdGhpcyBoYXMgYmVlbiByZXBsYWNlZC5cbiAgICAjIChUaGVuIG9ubHkgb25lIHJlcGxhY2UgZXZlbnQgc2hvdWxkIGZpcmUuIClcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxuICAgIGRlbGV0ZUFsbE9ic2VydmVyczogKCktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdXG5cbiAgICBkZWxldGU6ICgpLT5cbiAgICAgIChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIEApLmV4ZWN1dGUoKVxuICAgICAgbnVsbFxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIEBmb3J3YXJkRXZlbnQgQCwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBASEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxuICAgICAgQGRlbGV0ZUFsbE9ic2VydmVycygpXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEB1aWRcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXG4gICAgICAgICAgbWFwX3VpZCA9IEB1aWQuYWx0LmNsb25lVWlkKClcbiAgICAgICAgICBtYXBfdWlkLnN1YiA9IEB1aWQuc3ViXG4gICAgICAgICAgbWFwX3VpZFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbG9uZVVpZDogKCktPlxuICAgICAgdWlkID0ge31cbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXG4gICAgICAgIHVpZFtuXSA9IHZcbiAgICAgIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAjIFdoZW4gdGhpcyBvcGVyYXRpb24gd2FzIGNyZWF0ZWQgd2l0aG91dCBhIHVpZCwgdGhlbiBzZXQgaXQgaGVyZS5cbiAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICBAdWlkID0gQEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBASEIuYWRkT3BlcmF0aW9uIEBcbiAgICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgT3BlcmF0aW9ucyBtYXkgZGVwZW5kIG9uIG90aGVyIG9wZXJhdGlvbnMgKGxpbmtlZCBsaXN0cywgZXRjLikuXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXG4gICAgIyBhbiBlYXN5IHdheSB0byByZWZlciB0byB0aGVzZSBvcGVyYXRpb25zIHZpYSBhbiB1aWQgb3Igb2JqZWN0IHJlZmVyZW5jZS5cbiAgICAjXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8pOyAgIG9yXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkby5nZXRVaWQoKSk7XG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcF91aWQpXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R9IG9wX3VpZCBBIHVpZCB0aGF0IHJlZmVycyB0byBhbiBvcGVyYXRpb25cbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPcGVyYXRpb259IG9wIEFuIE9wZXJhdGlvbiBvYmplY3RcbiAgICAjXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wKS0+XG5cbiAgICAgICNcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXG4gICAgICAjIFdlIHVzZSBkdWNrLXR5cGluZyB0byBjaGVjayBpZiBvcCBpcyBpbnN0YW50aWF0ZWQgc2luY2UgdGhlcmVcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXG4gICAgICAjXG4gICAgICBpZiBub3Qgb3A/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmIG9wLmV4ZWN1dGU/IG9yIG5vdCAob3Aub3BfbnVtYmVyPyBhbmQgb3AuY3JlYXRvcj8pXG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkLCBvciBvcCBpcyBzdHJpbmcuIEN1cnJlbnRseSBcIkRlbGltaXRlclwiIGlzIHNhdmVkIGFzIHN0cmluZ1xuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZVxuICAgICAgICAjIG5vdCBpbml0aWFsaXplZC4gRG8gaXQgd2hlbiBjYWxsaW5nICR2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtuYW1lXSA9IG9wXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxuICAgICMgQHNlZSBPcGVyYXRpb24uc2F2ZU9wZXJhdGlvblxuICAgICNcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxuICAgICNcbiAgICB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9uczogKCktPlxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxuICAgICAgc3VjY2VzcyA9IEBcbiAgICAgIGZvciBuYW1lLCBvcF91aWQgb2YgQHVuY2hlY2tlZFxuICAgICAgICBvcCA9IEBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyBvcHMuRGVsZXRlIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiRGVsZXRlXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJlcyA9IHN1cGVyXG4gICAgICAgIGlmIHJlc1xuICAgICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgcmVzXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgI1xuICAjIERlZmluZSBob3cgdG8gcGFyc2UgRGVsZXRlIG9wZXJhdGlvbnMuXG4gICNcbiAgb3BzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyB0aGlzKHVpZCwgZGVsZXRlc191aWQpXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIG9wcy5JbnNlcnQgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgdWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4sIHBhcmVudCktPlxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxuICAgICAgaWYgY29udGVudCBpcyB1bmRlZmluZWRcbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkluc2VydFwiXG5cbiAgICB2YWw6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBzZXQgY29udGVudCB0byBudWxsIGFuZCBvdGhlciBzdHVmZlxuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgY2FsbExhdGVyID0gZmFsc2VcbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzRGVsZXRlZCgpIGFuZCBvPyAjIG8/IDogaWYgbm90IG8/LCB0aGVuIHRoZSBkZWxpbWl0ZXIgZGVsZXRlZCB0aGlzIEluc2VydGlvbi4gRnVydGhlcm1vcmUsIGl0IHdvdWxkIGJlIHdyb25nIHRvIGNhbGwgaXQuIFRPRE86IG1ha2UgdGhpcyBtb3JlIGV4cHJlc3NpdmUgYW5kIHNhdmVcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXG4gICAgICAgIGNhbGxMYXRlciA9IHRydWVcbiAgICAgIGlmIG8/XG4gICAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgZ2FyYmFnZWNvbGxlY3QgPSBmYWxzZVxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgZ2FyYmFnZWNvbGxlY3QgPSB0cnVlXG4gICAgICBzdXBlciBnYXJiYWdlY29sbGVjdFxuICAgICAgaWYgY2FsbExhdGVyXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHMobylcbiAgICAgIGlmIEBwcmV2X2NsPy5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcblxuICAgICAgIyBkZWxldGUgY29udGVudFxuICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgIGRlbGV0ZSBAY29udGVudFxuXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInJpZ2h0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGNoYW5nZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcbiAgICAgICAgc3VwZXJcbiAgICAgICMgZWxzZVxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAICMgVE9ETzogdGhpcyBpcyBwcm9iYWJseSBub3QgbmVjZXNzYXJ5IGFuZCBvbmx5IG5pY2UgZm9yIGRlYnVnZ2luZ1xuICAgICAgICBpZiBAcGFyZW50P1xuICAgICAgICAgIGlmIG5vdCBAcHJldl9jbD9cbiAgICAgICAgICAgIEBwcmV2X2NsID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG9yaWdpbj9cbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIGVsc2UgaWYgQG9yaWdpbiBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgICAgICBAb3JpZ2luID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG5leHRfY2w/XG4gICAgICAgICAgICBAbmV4dF9jbCA9IEBwYXJlbnQuZW5kXG4gICAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IEBnZXREaXN0YW5jZVRvT3JpZ2luKCkgIyBtb3N0IGNhc2VzOiAwXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBpID0gZGlzdGFuY2VfdG9fb3JpZ2luICMgbG9vcCBjb3VudGVyXG5cbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgICAgICMgICAgICAgICBsZXQgJE9MPSBbbzEsbzIsbzMsbzRdLCB3aGVyZWJ5ICR0aGlzIGlzIHRvIGJlIGluc2VydGVkIGJldHdlZW4gbzEgYW5kIG80XG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICAgICAjICAgICAgICAgdGhlbiBvMiBrbm93cyBvMy4gU2luY2Ugb24gYW5vdGhlciBjbGllbnQgJE9MIGNvdWxkIGJlIFtvMSxvMyxvNF0gdGhlIHByb2JsZW0gaXMgY29tcGxleFxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgIGlmIGN1cnJlbnQgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uID4gJG8gb3JpZ2luOiAkdGhpcyBpbnNcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxuICAgICAgICAgICMgICAgICAgICAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgICAgICMgY2FzZSAzOiAkb3JpZ2luID4gJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcblxuICAgICAgICBAc2V0UGFyZW50IEBwcmV2X2NsLmdldFBhcmVudCgpICMgZG8gSW5zZXJ0aW9ucyBhbHdheXMgaGF2ZSBhIHBhcmVudD9cbiAgICAgICAgc3VwZXIgIyBub3RpZnkgdGhlIGV4ZWN1dGlvbl9saXN0ZW5lcnNcbiAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cygpXG4gICAgICAgIEBcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKCktPlxuICAgICAgQHBhcmVudD8uY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJpbnNlcnRcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50XG4gICAgICAgIGNoYW5nZWRCeTogQHVpZC5jcmVhdG9yXG4gICAgICAgIHZhbHVlOiBAY29udGVudFxuICAgICAgXVxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAobyktPlxuICAgICAgQHBhcmVudC5jYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXG4gICAgICAgIHBvc2l0aW9uOiBAZ2V0UG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBwYXJlbnQgIyBUT0RPOiBZb3UgY2FuIGNvbWJpbmUgZ2V0UG9zaXRpb24gKyBnZXRQYXJlbnQgaW4gYSBtb3JlIGVmZmljaWVudCBtYW5uZXIhIChvbmx5IGxlZnQgRGVsaW1pdGVyIHdpbGwgaG9sZCBAcGFyZW50KVxuICAgICAgICBsZW5ndGg6IDFcbiAgICAgICAgY2hhbmdlZEJ5OiBvLnVpZC5jcmVhdG9yXG4gICAgICBdXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ3BhcmVudCc6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgfVxuXG4gICAgICBpZiBAb3JpZ2luLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBqc29uLm9yaWdpbiA9IFwiRGVsaW1pdGVyXCJcbiAgICAgIGVsc2UgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb24ub3JpZ2luID0gQG9yaWdpbi5nZXRVaWQoKVxuXG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uWydjb250ZW50J10gPSBKU09OLnN0cmluZ2lmeSBAY29udGVudFxuICAgICAganNvblxuXG4gIG9wcy5JbnNlcnQucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgfSA9IGpzb25cbiAgICBpZiB0eXBlb2YgY29udGVudCBpcyBcInN0cmluZ1wiXG4gICAgICBjb250ZW50ID0gSlNPTi5wYXJzZShjb250ZW50KVxuICAgIG5ldyB0aGlzIGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIERlZmluZXMgYW4gb2JqZWN0IHRoYXQgaXMgY2Fubm90IGJlIGNoYW5nZWQuIFlvdSBjYW4gdXNlIHRoaXMgdG8gc2V0IGFuIGltbXV0YWJsZSBzdHJpbmcsIG9yIGEgbnVtYmVyLlxuICAjXG4gIGNsYXNzIG9wcy5JbW11dGFibGVPYmplY3QgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gY29udGVudFxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgQGNvbnRlbnQpLT5cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJJbW11dGFibGVPYmplY3RcIlxuXG4gICAgI1xuICAgICMgQHJldHVybiBbU3RyaW5nXSBUaGUgY29udGVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgdmFsIDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2NvbnRlbnQnIDogQGNvbnRlbnRcbiAgICAgIH1cbiAgICAgIGpzb25cblxuICBvcHMuSW1tdXRhYmxlT2JqZWN0LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkLCBjb250ZW50KVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIG9wcy5EZWxpbWl0ZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB7bm9PcGVyYXRpb246IHRydWV9XG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xuICAgICAgICBzdXBlclxuICAgICAgI2Vsc2VcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAnb3BlcmF0aW9ucycgOiBvcHNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsInRleHRfb3BzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0XCJcblxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gIHRleHRfb3BzID0gdGV4dF9vcHNfdW5pbml0aWFsaXplZCgpXG4gIG9wcyA9IHRleHRfb3BzLm9wZXJhdGlvbnNcblxuICAjXG4gICMgTWFuYWdlcyBPYmplY3QtbGlrZSB2YWx1ZXMuXG4gICNcbiAgY2xhc3Mgb3BzLk9iamVjdCBleHRlbmRzIG9wcy5NYXBNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEganNvbi10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geS52YWwoJ3Vua25vd24nKVxuICAgICMgICBpZiAoeC50eXBlID09PSBcIk9iamVjdFwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIk9iamVjdFwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVHJhbnNmb3JtIHRoaXMgdG8gYSBKc29uLiBJZiB5b3VyIGJyb3dzZXIgc3VwcG9ydHMgT2JqZWN0Lm9ic2VydmUgaXQgd2lsbCBiZSB0cmFuc2Zvcm1lZCBhdXRvbWF0aWNhbGx5IHdoZW4gYSBjaGFuZ2UgYXJyaXZlcy5cbiAgICAjIE90aGVyd2lzZSB5b3Ugd2lsbCBsb29zZSBhbGwgdGhlIHNoYXJpbmctYWJpbGl0aWVzICh0aGUgbmV3IG9iamVjdCB3aWxsIGJlIGEgZGVlcCBjbG9uZSkhXG4gICAgIyBAcmV0dXJuIHtKc29ufVxuICAgICNcbiAgICAjIFRPRE86IGF0IHRoZSBtb21lbnQgeW91IGRvbid0IGNvbnNpZGVyIGNoYW5naW5nIG9mIHByb3BlcnRpZXMuXG4gICAgIyBFLmcuOiBsZXQgeCA9IHthOltdfS4gVGhlbiB4LmEucHVzaCAxIHdvdWxkbid0IGNoYW5nZSBhbnl0aGluZ1xuICAgICNcbiAgICB0b0pzb246ICh0cmFuc2Zvcm1fdG9fdmFsdWUgPSBmYWxzZSktPlxuICAgICAgaWYgbm90IEBib3VuZF9qc29uPyBvciBub3QgT2JqZWN0Lm9ic2VydmU/IG9yIHRydWUgIyBUT0RPOiBjdXJyZW50bHksIHlvdSBhcmUgbm90IHdhdGNoaW5nIG11dGFibGUgc3RyaW5ncyBmb3IgY2hhbmdlcywgYW5kLCB0aGVyZWZvcmUsIHRoZSBAYm91bmRfanNvbiBpcyBub3QgdXBkYXRlZC4gVE9ETyBUT0RPICB3dWF3dWF3dWEgZWFzeVxuICAgICAgICB2YWwgPSBAdmFsKClcbiAgICAgICAganNvbiA9IHt9XG4gICAgICAgIGZvciBuYW1lLCBvIG9mIHZhbFxuICAgICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuT2JqZWN0XG4gICAgICAgICAgICBqc29uW25hbWVdID0gby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIG9wcy5MaXN0TWFuYWdlclxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICAgIGpzb25bbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAganNvbltuYW1lXSA9IG9cbiAgICAgICAgQGJvdW5kX2pzb24gPSBqc29uXG4gICAgICAgIGlmIE9iamVjdC5vYnNlcnZlP1xuICAgICAgICAgIHRoYXQgPSBAXG4gICAgICAgICAgT2JqZWN0Lm9ic2VydmUgQGJvdW5kX2pzb24sIChldmVudHMpLT5cbiAgICAgICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICAgICAgaWYgbm90IGV2ZW50LmNoYW5nZWRCeT8gYW5kIChldmVudC50eXBlIGlzIFwiYWRkXCIgb3IgZXZlbnQudHlwZSA9IFwidXBkYXRlXCIpXG4gICAgICAgICAgICAgICAgIyB0aGlzIGV2ZW50IGlzIG5vdCBjcmVhdGVkIGJ5IFkuXG4gICAgICAgICAgICAgICAgdGhhdC52YWwoZXZlbnQubmFtZSwgZXZlbnQub2JqZWN0W2V2ZW50Lm5hbWVdKVxuICAgICAgICAgIEBvYnNlcnZlIChldmVudHMpLT5cbiAgICAgICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICAgICAgaWYgZXZlbnQuY3JlYXRlZF8gaXNudCBASEIuZ2V0VXNlcklkKClcbiAgICAgICAgICAgICAgICBub3RpZmllciA9IE9iamVjdC5nZXROb3RpZmllcih0aGF0LmJvdW5kX2pzb24pXG4gICAgICAgICAgICAgICAgb2xkVmFsID0gdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdXG4gICAgICAgICAgICAgICAgaWYgb2xkVmFsP1xuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAndXBkYXRlJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZSdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTogZXZlbnQuY2hhbmdlZEJ5XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAnYWRkJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZCdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTpldmVudC5jaGFuZ2VkQnlcbiAgICAgIEBib3VuZF9qc29uXG5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgICAjICAgQHJldHVybiBbSnNvbl1cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlfHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIG5hbWU/IGFuZCBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5jb25zdHJ1Y3Rvcj9cbiAgICAgICAgICB0eXBlID0gb3BzW2NvbnRlbnQuY29uc3RydWN0b3IubmFtZV1cbiAgICAgICAgICBpZiB0eXBlPyBhbmQgdHlwZS5jcmVhdGU/XG4gICAgICAgICAgICBhcmdzID0gW11cbiAgICAgICAgICAgIGZvciBpIGluIFsxLi4uYXJndW1lbnRzLmxlbmd0aF1cbiAgICAgICAgICAgICAgYXJncy5wdXNoIGFyZ3VtZW50c1tpXVxuICAgICAgICAgICAgbyA9IHR5cGUuY3JlYXRlLmFwcGx5IG51bGwsIGFyZ3NcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIG9cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgI3tjb250ZW50LmNvbnN0cnVjdG9yLm5hbWV9LXR5cGUgaXMgbm90ICh5ZXQpIHN1cHBvcnRlZCBpbiBZLlwiXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG4gICAgICBlbHNlICMgaXMgdGhpcyBldmVuIG5lY2Vzc2FyeSA/IEkgaGF2ZSB0byBkZWZpbmUgZXZlcnkgdHlwZSBhbnl3YXkuLiAoc2VlIE51bWJlciB0eXBlIGJlbG93KVxuICAgICAgICBzdXBlciBuYW1lXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG5cbiAgb3BzLk9iamVjdC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZClcblxuICBvcHMuT2JqZWN0LmNyZWF0ZSA9IChjb250ZW50LCBtdXRhYmxlKS0+XG4gICAganNvbiA9IG5ldyBvcHMuT2JqZWN0KCkuZXhlY3V0ZSgpXG4gICAgZm9yIG4sbyBvZiBjb250ZW50XG4gICAgICBqc29uLnZhbCBuLCBvLCBtdXRhYmxlXG4gICAganNvblxuXG5cbiAgb3BzLk51bWJlciA9IHt9XG4gIG9wcy5OdW1iZXIuY3JlYXRlID0gKGNvbnRlbnQpLT5cbiAgICBjb250ZW50XG5cbiAgdGV4dF9vcHNcblxuXG4iLCJiYXNpY19vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gIGJhc2ljX29wcyA9IGJhc2ljX29wc191bmluaXRpYWxpemVkKClcbiAgb3BzID0gYmFzaWNfb3BzLm9wZXJhdGlvbnNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3Mgb3BzLk1hcE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAbWFwID0ge31cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBmb3IgbmFtZSxwIG9mIEBtYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBAcmV0cmlldmVTdWIobmFtZSkucmVwbGFjZSBjb250ZW50XG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgcHJvcCA9IEBtYXBbbmFtZV1cbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgIHByb3AudmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBtYXBcbiAgICAgICAgICBpZiBub3Qgby5pc0NvbnRlbnREZWxldGVkKClcbiAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG8udmFsKClcbiAgICAgICAgcmVzdWx0XG5cbiAgICBkZWxldGU6IChuYW1lKS0+XG4gICAgICBAbWFwW25hbWVdPy5kZWxldGVDb250ZW50KClcbiAgICAgIEBcblxuICAgIHJldHJpZXZlU3ViOiAocHJvcGVydHlfbmFtZSktPlxuICAgICAgaWYgbm90IEBtYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAbWFwW3Byb3BlcnR5X25hbWVdID0gcm1cbiAgICAgICAgcm0uc2V0UGFyZW50IEAsIHByb3BlcnR5X25hbWVcbiAgICAgICAgcm0uZXhlY3V0ZSgpXG4gICAgICBAbWFwW3Byb3BlcnR5X25hbWVdXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAYmVnaW5uaW5nID0gbmV3IG9wcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgb3BzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGVuZFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGZvciBpLCBvIGluIHZhbFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLk9iamVjdFxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2Ygb3BzLkxpc3RNYW5hZ2VyXG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggb1xuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIG1hcDogKGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggZihvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIGZvbGQ6IChpbml0LCBmKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgaW5pdCA9IGYoaW5pdCwgbylcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgaW5pdFxuXG4gICAgdmFsOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgQHRvQXJyYXkoKVxuXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIGNvbnRlbnRcblxuICAgIGluc2VydEFmdGVyOiAobGVmdCwgY29udGVudCwgb3B0aW9ucyktPlxuICAgICAgY3JlYXRlQ29udGVudCA9IChjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNvbnN0cnVjdG9yP1xuICAgICAgICAgIHR5cGUgPSBvcHNbY29udGVudC5jb25zdHJ1Y3Rvci5uYW1lXVxuICAgICAgICAgIGlmIHR5cGU/IGFuZCB0eXBlLmNyZWF0ZT9cbiAgICAgICAgICAgIHR5cGUuY3JlYXRlIGNvbnRlbnQsIG9wdGlvbnNcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgI3tjb250ZW50LmNvbnN0cnVjdG9yLm5hbWV9LXR5cGUgaXMgbm90ICh5ZXQpIHN1cHBvcnRlZCBpbiBZLlwiXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjb250ZW50XG5cbiAgICAgIHJpZ2h0ID0gbGVmdC5uZXh0X2NsXG4gICAgICB3aGlsZSByaWdodC5pc0RlbGV0ZWQoKVxuICAgICAgICByaWdodCA9IHJpZ2h0Lm5leHRfY2wgIyBmaW5kIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gdGhlIHJpZ2h0LCB0aGF0IGlzIG5vdCBkZWxldGVkLiBJbiB0aGUgY2FzZSB0aGF0IHBvc2l0aW9uIGlzIDAsIGl0cyB0aGUgRGVsaW1pdGVyLlxuICAgICAgbGVmdCA9IHJpZ2h0LnByZXZfY2xcblxuICAgICAgaWYgY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgKG5ldyBvcHMuSW5zZXJ0IGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgICAgdG1wID0gKG5ldyBvcHMuSW5zZXJ0IGNyZWF0ZUNvbnRlbnQoYywgb3B0aW9ucyksIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIFtjb250ZW50XSwgb3B0aW9uc1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XG4gICAgI1xuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGgpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIChub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGpzb25cblxuICBvcHMuTGlzdE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQpXG5cbiAgb3BzLkFycmF5ID0gKCktPlxuICBvcHMuQXJyYXkuY3JlYXRlID0gKGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgICBsaXN0ID0gbmV3IG9wcy5MaXN0TWFuYWdlcigpLmV4ZWN1dGUoKVxuICAgICAgICBpdGggPSBsaXN0LmdldE9wZXJhdGlvbkJ5UG9zaXRpb24gMFxuICAgICAgICBsaXN0Lmluc2VydEFmdGVyIGl0aCwgY29udGVudFxuICAgICAgICBsaXN0XG4gICAgICBlbHNlIGlmIChub3QgbXV0YWJsZT8pIG9yIChtdXRhYmxlIGlzIFwiaW1tdXRhYmxlXCIpXG4gICAgICAgIGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiU3BlY2lmeSBlaXRoZXIgXFxcIm11dGFibGVcXFwiIG9yIFxcXCJpbW11dGFibGVcXFwiISFcIlxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgVGV4dFR5cGUtdHlwZSBoYXMgaW1wbGVtZW50ZWQgc3VwcG9ydCBmb3IgcmVwbGFjZVxuICAjIEBzZWUgVGV4dFR5cGVcbiAgI1xuICBjbGFzcyBvcHMuUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfcHJvcGVydGllcyBEZWNvcmF0ZXMgdGhlIGV2ZW50IHRoYXQgaXMgdGhyb3duIGJ5IHRoZSBSTVxuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3RoaXMgVGhlIG9iamVjdCBvbiB3aGljaCB0aGUgZXZlbnQgc2hhbGwgYmUgZXhlY3V0ZWRcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCwgYmVnaW5uaW5nLCBlbmQpLT5cbiAgICAgIGlmIG5vdCBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10/XG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzXG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIFRoaXMgZG9lc24ndCB0aHJvdyB0aGUgc2FtZSBldmVudHMgYXMgdGhlIExpc3RNYW5hZ2VyLiBUaGVyZWZvcmUsIHRoZVxuICAgICMgUmVwbGFjZWFibGVzIGFsc28gbm90IHRocm93IHRoZSBzYW1lIGV2ZW50cy5cbiAgICAjIFNvLCBSZXBsYWNlTWFuYWdlciBhbmQgTGlzdE1hbmFnZXIgYm90aCBpbXBsZW1lbnRcbiAgICAjIHRoZXNlIGZ1bmN0aW9ucyB0aGF0IGFyZSBjYWxsZWQgd2hlbiBhbiBJbnNlcnRpb24gaXMgZXhlY3V0ZWQgKGF0IHRoZSBlbmQpLlxuICAgICNcbiAgICAjXG4gICAgY2FsbEV2ZW50RGVjb3JhdG9yOiAoZXZlbnRzKS0+XG4gICAgICBpZiBub3QgQGlzRGVsZXRlZCgpXG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBmb3IgbmFtZSxwcm9wIG9mIEBldmVudF9wcm9wZXJ0aWVzXG4gICAgICAgICAgICBldmVudFtuYW1lXSA9IHByb3BcbiAgICAgICAgQGV2ZW50X3RoaXMuY2FsbEV2ZW50IGV2ZW50c1xuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgcmVscCA9IChuZXcgb3BzLlJlcGxhY2VhYmxlIGNvbnRlbnQsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAgICdlbmQnIDogQGVuZC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBqc29uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlcy5cbiAgIyBAc2VlIFJlcGxhY2VNYW5hZ2VyXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VhYmxlIGV4dGVuZHMgb3BzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIGlzX2RlbGV0ZWQpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIHN1cGVyIGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luICMgUGFyZW50IGlzIGFscmVhZHkgc2F2ZWQgYnkgUmVwbGFjZWFibGVcbiAgICAgIEBpc19kZWxldGVkID0gaXNfZGVsZXRlZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlYWJsZVwiXG5cbiAgICAjXG4gICAgIyBSZXR1cm4gdGhlIGNvbnRlbnQgdGhhdCB0aGlzIG9wZXJhdGlvbiBob2xkcy5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHJlcyA9IHN1cGVyXG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBAY29udGVudC5kZWxldGVBbGxPYnNlcnZlcnM/KClcbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGU/KClcbiAgICAgICAgQGNvbnRlbnQuZG9udFN5bmM/KClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuICAgICAgcmVzXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC10eXBlIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXG4gICAgIyBUT0RPOiBjb25zaWRlciBkb2luZyB0aGlzIGluIGEgbW9yZSBjb25zaXN0ZW50IG1hbm5lci4gVGhpcyBjb3VsZCBhbHNvIGJlXG4gICAgIyBkb25lIHdpdGggZXhlY3V0ZS4gQnV0IGN1cnJlbnRseSwgdGhlcmUgYXJlIG5vIHNwZWNpdGFsIEluc2VydC1vcHMgZm9yIExpc3RNYW5hZ2VyLlxuICAgICNcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIiBhbmQgQHByZXZfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyB0aGlzIHJlcGxhY2VzIGFub3RoZXIgUmVwbGFjZWFibGVcbiAgICAgICAgaWYgbm90IEBpc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBAcHJldl9jbC5jb250ZW50XG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxuICAgICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcbiAgICAgICAgICBdXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyBUaGlzIHdvbid0IGJlIHJlY29nbml6ZWQgYnkgdGhlIHVzZXIsIGJlY2F1c2UgYW5vdGhlclxuICAgICAgICAjIGNvbmN1cnJlbnQgb3BlcmF0aW9uIGlzIHNldCBhcyB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgUk1cbiAgICAgICAgQGFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgIyBwcmV2IF9hbmRfIG5leHQgYXJlIERlbGltaXRlcnMuIFRoaXMgaXMgdGhlIGZpcnN0IGNyZWF0ZWQgUmVwbGFjZWFibGUgaW4gdGhlIFJNXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgXVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgICAgICBvbGRWYWx1ZTogQGNvbnRlbnRcbiAgICAgICAgXVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICAgJ3BhcmVudCcgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdpc19kZWxldGVkJzogQGlzX2RlbGV0ZWRcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbi50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAganNvbi5vcmlnaW4gPSBcIkRlbGltaXRlclwiXG4gICAgICBlbHNlIGlmIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uLm9yaWdpbiA9IEBvcmlnaW4uZ2V0VWlkKClcblxuICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgICMgVGhpcyBjb3VsZCBiZSBhIHNlY3VyaXR5IGNvbmNlcm4uXG4gICAgICAgICMgVGhyb3cgZXJyb3IgaWYgdGhlIHVzZXJzIHdhbnRzIHRvIHRyaWNrIHVzXG4gICAgICAgIGlmIEBjb250ZW50PyBhbmQgQGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgc2V0IGNyZWF0b3IgaGVyZSFcIlxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudFxuICAgICAganNvblxuXG4gIG9wcy5SZXBsYWNlYWJsZS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdpc19kZWxldGVkJzogaXNfZGVsZXRlZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgaXNfZGVsZXRlZClcblxuXG4gIGJhc2ljX29wc1xuXG5cblxuXG5cblxuIiwic3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRcIlxuXG5tb2R1bGUuZXhwb3J0cyA9ICgpLT5cbiAgc3RydWN0dXJlZF9vcHMgPSBzdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkKClcbiAgb3BzID0gc3RydWN0dXJlZF9vcHMub3BlcmF0aW9uc1xuXG4gICNcbiAgIyBIYW5kbGVzIGEgU3RyaW5nLWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0L2RlbGV0ZSBhdCBhIHdvcmQtcG9zaXRpb24uXG4gICMgQG5vdGUgQ3VycmVudGx5LCBvbmx5IFRleHQgaXMgc3VwcG9ydGVkIVxuICAjXG4gIGNsYXNzIG9wcy5TdHJpbmcgZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAdGV4dGZpZWxkcyA9IFtdXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElkZW50aWZpZXMgdGhpcyBjbGFzcy5cbiAgICAjIFVzZSBpdCB0byBjaGVjayB3aGV0aGVyIHRoaXMgaXMgYSB3b3JkLXR5cGUgb3Igc29tZXRoaW5nIGVsc2UuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHggPSB5LnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiU3RyaW5nXCIpIHtcbiAgICAjICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSh4LnRvSnNvbigpKVxuICAgICMgICB9XG4gICAgI1xuICAgIHR5cGU6IFwiU3RyaW5nXCJcblxuICAgICNcbiAgICAjIEdldCB0aGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgd29yZC5cbiAgICAjIEByZXR1cm4ge1N0cmluZ30gVGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIG9iamVjdC5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBAZm9sZCBcIlwiLCAobGVmdCwgbyktPlxuICAgICAgICBsZWZ0ICsgby52YWwoKVxuXG4gICAgI1xuICAgICMgU2FtZSBhcyBTdHJpbmcudmFsXG4gICAgIyBAc2VlIFN0cmluZy52YWxcbiAgICAjXG4gICAgdG9TdHJpbmc6ICgpLT5cbiAgICAgIEB2YWwoKVxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdC5cbiAgICAjXG4gICAgaW5zZXJ0OiAocG9zaXRpb24sIGNvbnRlbnQsIG9wdGlvbnMpLT5cbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICAgQGluc2VydEFmdGVyIGl0aCwgY29udGVudCwgb3B0aW9uc1xuXG4gICAgI1xuICAgICMgQmluZCB0aGlzIFN0cmluZyB0byBhIHRleHRmaWVsZCBvciBpbnB1dCBmaWVsZC5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgdGV4dGJveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidGV4dGZpZWxkXCIpO1xuICAgICMgICB5LmJpbmQodGV4dGJveCk7XG4gICAgI1xuICAgIGJpbmQ6ICh0ZXh0ZmllbGQsIGRvbV9yb290KS0+XG4gICAgICBkb21fcm9vdCA/PSB3aW5kb3dcbiAgICAgIGlmIChub3QgZG9tX3Jvb3QuZ2V0U2VsZWN0aW9uPylcbiAgICAgICAgZG9tX3Jvb3QgPSB3aW5kb3dcblxuICAgICAgIyBkb24ndCBkdXBsaWNhdGUhXG4gICAgICBmb3IgdCBpbiBAdGV4dGZpZWxkc1xuICAgICAgICBpZiB0IGlzIHRleHRmaWVsZFxuICAgICAgICAgIHJldHVyblxuICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlO1xuXG4gICAgICB3b3JkID0gQFxuICAgICAgdGV4dGZpZWxkLnZhbHVlID0gQHZhbCgpXG4gICAgICBAdGV4dGZpZWxkcy5wdXNoIHRleHRmaWVsZFxuXG4gICAgICBpZiB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnQ/IGFuZCB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2U/XG4gICAgICAgIGNyZWF0ZVJhbmdlID0gKGZpeCktPlxuICAgICAgICAgIGxlZnQgPSB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgICByaWdodCA9IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcbiAgICAgICAgICBpZiBmaXg/XG4gICAgICAgICAgICBsZWZ0ID0gZml4IGxlZnRcbiAgICAgICAgICAgIHJpZ2h0ID0gZml4IHJpZ2h0XG4gICAgICAgICAge1xuICAgICAgICAgICAgbGVmdDogbGVmdFxuICAgICAgICAgICAgcmlnaHQ6IHJpZ2h0XG4gICAgICAgICAgfVxuXG4gICAgICAgIHdyaXRlUmFuZ2UgPSAocmFuZ2UpLT5cbiAgICAgICAgICB3cml0ZUNvbnRlbnQgd29yZC52YWwoKVxuICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSByYW5nZS5sZWZ0LCByYW5nZS5yaWdodFxuXG4gICAgICAgIHdyaXRlQ29udGVudCA9IChjb250ZW50KS0+XG4gICAgICAgICAgdGV4dGZpZWxkLnZhbHVlID0gY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBjcmVhdGVSYW5nZSA9IChmaXgpLT5cbiAgICAgICAgICByYW5nZSA9IHt9XG4gICAgICAgICAgcyA9IGRvbV9yb290LmdldFNlbGVjdGlvbigpXG4gICAgICAgICAgY2xlbmd0aCA9IHRleHRmaWVsZC50ZXh0Q29udGVudC5sZW5ndGhcbiAgICAgICAgICByYW5nZS5sZWZ0ID0gTWF0aC5taW4gcy5hbmNob3JPZmZzZXQsIGNsZW5ndGhcbiAgICAgICAgICByYW5nZS5yaWdodCA9IE1hdGgubWluIHMuZm9jdXNPZmZzZXQsIGNsZW5ndGhcbiAgICAgICAgICBpZiBmaXg/XG4gICAgICAgICAgICByYW5nZS5sZWZ0ID0gZml4IHJhbmdlLmxlZnRcbiAgICAgICAgICAgIHJhbmdlLnJpZ2h0ID0gZml4IHJhbmdlLnJpZ2h0XG5cbiAgICAgICAgICBlZGl0ZWRfZWxlbWVudCA9IHMuZm9jdXNOb2RlXG4gICAgICAgICAgaWYgZWRpdGVkX2VsZW1lbnQgaXMgdGV4dGZpZWxkIG9yIGVkaXRlZF9lbGVtZW50IGlzIHRleHRmaWVsZC5jaGlsZE5vZGVzWzBdXG4gICAgICAgICAgICByYW5nZS5pc1JlYWwgPSB0cnVlXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgcmFuZ2UuaXNSZWFsID0gZmFsc2VcbiAgICAgICAgICByYW5nZVxuXG4gICAgICAgIHdyaXRlUmFuZ2UgPSAocmFuZ2UpLT5cbiAgICAgICAgICB3cml0ZUNvbnRlbnQgd29yZC52YWwoKVxuICAgICAgICAgIHRleHRub2RlID0gdGV4dGZpZWxkLmNoaWxkTm9kZXNbMF1cbiAgICAgICAgICBpZiByYW5nZS5pc1JlYWwgYW5kIHRleHRub2RlP1xuICAgICAgICAgICAgaWYgcmFuZ2UubGVmdCA8IDBcbiAgICAgICAgICAgICAgcmFuZ2UubGVmdCA9IDBcbiAgICAgICAgICAgIHJhbmdlLnJpZ2h0ID0gTWF0aC5tYXggcmFuZ2UubGVmdCwgcmFuZ2UucmlnaHRcbiAgICAgICAgICAgIGlmIHJhbmdlLnJpZ2h0ID4gdGV4dG5vZGUubGVuZ3RoXG4gICAgICAgICAgICAgIHJhbmdlLnJpZ2h0ID0gdGV4dG5vZGUubGVuZ3RoXG4gICAgICAgICAgICByYW5nZS5sZWZ0ID0gTWF0aC5taW4gcmFuZ2UubGVmdCwgcmFuZ2UucmlnaHRcbiAgICAgICAgICAgIHIgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpXG4gICAgICAgICAgICByLnNldFN0YXJ0KHRleHRub2RlLCByYW5nZS5sZWZ0KVxuICAgICAgICAgICAgci5zZXRFbmQodGV4dG5vZGUsIHJhbmdlLnJpZ2h0KVxuICAgICAgICAgICAgcyA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKVxuICAgICAgICAgICAgcy5yZW1vdmVBbGxSYW5nZXMoKVxuICAgICAgICAgICAgcy5hZGRSYW5nZShyKVxuICAgICAgICB3cml0ZUNvbnRlbnQgPSAoY29udGVudCktPlxuICAgICAgICAgIGNvbnRlbnRfYXJyYXkgPSBjb250ZW50LnJlcGxhY2UobmV3IFJlZ0V4cChcIlxcblwiLCdnJyksXCIgXCIpLnNwbGl0KFwiIFwiKVxuICAgICAgICAgIHRleHRmaWVsZC5pbm5lclRleHQgPSBcIlwiXG4gICAgICAgICAgZm9yIGMsIGkgaW4gY29udGVudF9hcnJheVxuICAgICAgICAgICAgdGV4dGZpZWxkLmlubmVyVGV4dCArPSBjXG4gICAgICAgICAgICBpZiBpIGlzbnQgY29udGVudF9hcnJheS5sZW5ndGgtMVxuICAgICAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJIVE1MICs9ICcmbmJzcDsnXG5cbiAgICAgIHdyaXRlQ29udGVudCB0aGlzLnZhbCgpXG5cbiAgICAgIEBvYnNlcnZlIChldmVudHMpLT5cbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGlmIG5vdCBjcmVhdG9yX3Rva2VuXG4gICAgICAgICAgICBpZiBldmVudC50eXBlIGlzIFwiaW5zZXJ0XCJcbiAgICAgICAgICAgICAgb19wb3MgPSBldmVudC5wb3NpdGlvblxuICAgICAgICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgICAgICAgaWYgY3Vyc29yIDw9IG9fcG9zXG4gICAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBjdXJzb3IgKz0gMVxuICAgICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgIHIgPSBjcmVhdGVSYW5nZSBmaXhcbiAgICAgICAgICAgICAgd3JpdGVSYW5nZSByXG5cbiAgICAgICAgICAgIGVsc2UgaWYgZXZlbnQudHlwZSBpcyBcImRlbGV0ZVwiXG4gICAgICAgICAgICAgIG9fcG9zID0gZXZlbnQucG9zaXRpb25cbiAgICAgICAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgICAgICAgIGlmIGN1cnNvciA8IG9fcG9zXG4gICAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICBjdXJzb3IgLT0gMVxuICAgICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgIHIgPSBjcmVhdGVSYW5nZSBmaXhcbiAgICAgICAgICAgICAgd3JpdGVSYW5nZSByXG5cbiAgICAgICMgY29uc3VtZSBhbGwgdGV4dC1pbnNlcnQgY2hhbmdlcy5cbiAgICAgIHRleHRmaWVsZC5vbmtleXByZXNzID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbmtleXByZXNzID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGNyZWF0b3JfdG9rZW4gPSB0cnVlXG4gICAgICAgIGNoYXIgPSBudWxsXG4gICAgICAgIGlmIGV2ZW50LmtleUNvZGUgaXMgMTNcbiAgICAgICAgICBjaGFyID0gJ1xcbidcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNoYXIgPSBldmVudC5rZXlcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNoYXIgPSB3aW5kb3cuU3RyaW5nLmZyb21DaGFyQ29kZSBldmVudC5rZXlDb2RlXG4gICAgICAgIGlmIGNoYXIubGVuZ3RoID4gMVxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGVsc2UgaWYgY2hhci5sZW5ndGggPiAwXG4gICAgICAgICAgciA9IGNyZWF0ZVJhbmdlKClcbiAgICAgICAgICBwb3MgPSBNYXRoLm1pbiByLmxlZnQsIHIucmlnaHRcbiAgICAgICAgICBkaWZmID0gTWF0aC5hYnMoci5yaWdodCAtIHIubGVmdClcbiAgICAgICAgICB3b3JkLmRlbGV0ZSBwb3MsIGRpZmZcbiAgICAgICAgICB3b3JkLmluc2VydCBwb3MsIGNoYXJcbiAgICAgICAgICByLmxlZnQgPSBwb3MgKyBjaGFyLmxlbmd0aFxuICAgICAgICAgIHIucmlnaHQgPSByLmxlZnRcbiAgICAgICAgICB3cml0ZVJhbmdlIHJcblxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGNyZWF0b3JfdG9rZW4gPSBmYWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgICB0ZXh0ZmllbGQub25wYXN0ZSA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25wYXN0ZSA9IG51bGxcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICB0ZXh0ZmllbGQub25jdXQgPSAoZXZlbnQpLT5cbiAgICAgICAgaWYgd29yZC5pc19kZWxldGVkXG4gICAgICAgICAgIyBpZiB3b3JkIGlzIGRlbGV0ZWQsIGRvIG5vdCBkbyBhbnl0aGluZyBldmVyIGFnYWluXG4gICAgICAgICAgdGV4dGZpZWxkLm9uY3V0ID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgI1xuICAgICAgIyBjb25zdW1lIGRlbGV0ZXMuIE5vdGUgdGhhdFxuICAgICAgIyAgIGNocm9tZTogd29uJ3QgY29uc3VtZSBkZWxldGlvbnMgb24ga2V5cHJlc3MgZXZlbnQuXG4gICAgICAjICAga2V5Q29kZSBpcyBkZXByZWNhdGVkLiBCVVQ6IEkgZG9uJ3Qgc2VlIGFub3RoZXIgd2F5LlxuICAgICAgIyAgICAgc2luY2UgZXZlbnQua2V5IGlzIG5vdCBpbXBsZW1lbnRlZCBpbiB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIGNocm9tZS5cbiAgICAgICMgICAgIEV2ZXJ5IGJyb3dzZXIgc3VwcG9ydHMga2V5Q29kZS4gTGV0J3Mgc3RpY2sgd2l0aCBpdCBmb3Igbm93Li5cbiAgICAgICNcbiAgICAgIHRleHRmaWVsZC5vbmtleWRvd24gPSAoZXZlbnQpLT5cbiAgICAgICAgY3JlYXRvcl90b2tlbiA9IHRydWVcbiAgICAgICAgaWYgd29yZC5pc19kZWxldGVkXG4gICAgICAgICAgIyBpZiB3b3JkIGlzIGRlbGV0ZWQsIGRvIG5vdCBkbyBhbnl0aGluZyBldmVyIGFnYWluXG4gICAgICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IG51bGxcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICByID0gY3JlYXRlUmFuZ2UoKVxuICAgICAgICBwb3MgPSBNYXRoLm1pbihyLmxlZnQsIHIucmlnaHQsIHdvcmQudmFsKCkubGVuZ3RoKVxuICAgICAgICBkaWZmID0gTWF0aC5hYnMoci5sZWZ0IC0gci5yaWdodClcbiAgICAgICAgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgOCAjIEJhY2tzcGFjZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZSBwb3MsIGRpZmZcbiAgICAgICAgICAgIHIubGVmdCA9IHBvc1xuICAgICAgICAgICAgci5yaWdodCA9IHBvc1xuICAgICAgICAgICAgd3JpdGVSYW5nZSByXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgaWYgZXZlbnQuY3RybEtleT8gYW5kIGV2ZW50LmN0cmxLZXlcbiAgICAgICAgICAgICAgdmFsID0gd29yZC52YWwoKVxuICAgICAgICAgICAgICBuZXdfcG9zID0gcG9zXG4gICAgICAgICAgICAgIGRlbF9sZW5ndGggPSAwXG4gICAgICAgICAgICAgIGlmIHBvcyA+IDBcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd2hpbGUgbmV3X3BvcyA+IDAgYW5kIHZhbFtuZXdfcG9zXSBpc250IFwiIFwiIGFuZCB2YWxbbmV3X3Bvc10gaXNudCAnXFxuJ1xuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZSBuZXdfcG9zLCAocG9zLW5ld19wb3MpXG4gICAgICAgICAgICAgIHIubGVmdCA9IG5ld19wb3NcbiAgICAgICAgICAgICAgci5yaWdodCA9IG5ld19wb3NcbiAgICAgICAgICAgICAgd3JpdGVSYW5nZSByXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIGlmIHBvcyA+IDBcbiAgICAgICAgICAgICAgICB3b3JkLmRlbGV0ZSAocG9zLTEpLCAxXG4gICAgICAgICAgICAgICAgci5sZWZ0ID0gcG9zLTFcbiAgICAgICAgICAgICAgICByLnJpZ2h0ID0gcG9zLTFcbiAgICAgICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlXG4gICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZT8gYW5kIGV2ZW50LmtleUNvZGUgaXMgNDYgIyBEZWxldGVcbiAgICAgICAgICBpZiBkaWZmID4gMFxuICAgICAgICAgICAgd29yZC5kZWxldGUgcG9zLCBkaWZmXG4gICAgICAgICAgICByLmxlZnQgPSBwb3NcbiAgICAgICAgICAgIHIucmlnaHQgPSBwb3NcbiAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgMVxuICAgICAgICAgICAgci5sZWZ0ID0gcG9zXG4gICAgICAgICAgICByLnJpZ2h0ID0gcG9zXG4gICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlXG4gICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICB0cnVlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgfVxuICAgICAganNvblxuXG4gIG9wcy5TdHJpbmcucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQpXG5cbiAgb3BzLlN0cmluZy5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgd29yZCA9IG5ldyBvcHMuU3RyaW5nKCkuZXhlY3V0ZSgpXG4gICAgICB3b3JkLmluc2VydCAwLCBjb250ZW50XG4gICAgICB3b3JkXG4gICAgZWxzZSBpZiAobm90IG11dGFibGU/KSBvciAobXV0YWJsZSBpcyBcImltbXV0YWJsZVwiKVxuICAgICAgY29udGVudFxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlNwZWNpZnkgZWl0aGVyIFxcXCJtdXRhYmxlXFxcIiBvciBcXFwiaW1tdXRhYmxlXFxcIiEhXCJcblxuXG4gIHN0cnVjdHVyZWRfb3BzXG5cblxuIiwiXG5ZID0gcmVxdWlyZSAnLi95J1xuXG5iaW5kVG9DaGlsZHJlbiA9ICh0aGF0KS0+XG4gIGZvciBpIGluIFswLi4udGhhdC5jaGlsZHJlbi5sZW5ndGhdXG4gICAgYXR0ciA9IHRoYXQuY2hpbGRyZW4uaXRlbShpKVxuICAgIGlmIGF0dHIubmFtZT9cbiAgICAgIGF0dHIudmFsID0gdGhhdC52YWwudmFsKGF0dHIubmFtZSlcbiAgdGhhdC52YWwub2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgaWYgZXZlbnQubmFtZT9cbiAgICAgICAgZm9yIGkgaW4gWzAuLi50aGF0LmNoaWxkcmVuLmxlbmd0aF1cbiAgICAgICAgICBhdHRyID0gdGhhdC5jaGlsZHJlbi5pdGVtKGkpXG4gICAgICAgICAgaWYgYXR0ci5uYW1lPyBhbmQgYXR0ci5uYW1lIGlzIGV2ZW50Lm5hbWVcbiAgICAgICAgICAgIG5ld1ZhbCA9IHRoYXQudmFsLnZhbChhdHRyLm5hbWUpXG4gICAgICAgICAgICBpZiBhdHRyLnZhbCBpc250IG5ld1ZhbFxuICAgICAgICAgICAgICBhdHRyLnZhbCA9IG5ld1ZhbFxuXG5Qb2x5bWVyIFwieS1vYmplY3RcIixcbiAgcmVhZHk6ICgpLT5cbiAgICBpZiBAY29ubmVjdG9yP1xuICAgICAgQHZhbCA9IG5ldyBZIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcbiAgICBlbHNlIGlmIEB2YWw/XG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgdmFsQ2hhbmdlZDogKCktPlxuICAgIGlmIEB2YWw/IGFuZCBAdmFsLnR5cGUgaXMgXCJPYmplY3RcIlxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIGNvbm5lY3RvckNoYW5nZWQ6ICgpLT5cbiAgICBpZiAobm90IEB2YWw/KVxuICAgICAgQHZhbCA9IG5ldyBZIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuUG9seW1lciBcInktcHJvcGVydHlcIixcbiAgcmVhZHk6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsKEBuYW1lLEB2YWwpLnZhbChAbmFtZSlcbiAgICAgICAgIyBUT0RPOiBwbGVhc2UgdXNlIGluc3RhbmNlb2YgaW5zdGVhZCBvZiAudHlwZSxcbiAgICAgICAgIyBzaW5jZSBpdCBpcyBtb3JlIHNhZmUgKGNvbnNpZGVyIHNvbWVvbmUgcHV0dGluZyBhIGN1c3RvbSBPYmplY3QgdHlwZSBoZXJlKVxuICAgICAgZWxzZSBpZiB0eXBlb2YgQHZhbCBpcyBcInN0cmluZ1wiXG4gICAgICAgIEBwYXJlbnRFbGVtZW50LnZhbChAbmFtZSxAdmFsKVxuICAgICAgaWYgQHZhbC50eXBlIGlzIFwiT2JqZWN0XCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsLnZhbChAbmFtZSxAdmFsKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLnR5cGUsXG4gICAgICAgICMgc2luY2UgaXQgaXMgbW9yZSBzYWZlIChjb25zaWRlciBzb21lb25lIHB1dHRpbmcgYSBjdXN0b20gT2JqZWN0IHR5cGUgaGVyZSlcbiAgICAgIGVsc2UgaWYgQHZhbC50eXBlIGlzIFwiT2JqZWN0XCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuICAgICAgZWxzZSBpZiBAcGFyZW50RWxlbWVudC52YWw/LnZhbD8gYW5kIEB2YWwgaXNudCBAcGFyZW50RWxlbWVudC52YWwudmFsKEBuYW1lKVxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwudmFsIEBuYW1lLCBAdmFsXG5cblxuIiwiXG5qc29uX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9Kc29uXCJcblxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XG4gIHVzZXJfaWQgPSBudWxsXG4gIGlmIGNvbm5lY3Rvci51c2VyX2lkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLm9uX3VzZXJfaWRfc2V0ID0gKGlkKS0+XG4gICAgICB1c2VyX2lkID0gaWRcbiAgICAgIEhCLnJlc2V0VXNlcklkIGlkXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICBvcHNfbWFuYWdlciA9IGpzb25fb3BzX3VuaW5pdGlhbGl6ZWQgSEIsIHRoaXMuY29uc3RydWN0b3JcbiAgb3BzID0gb3BzX21hbmFnZXIub3BlcmF0aW9uc1xuXG4gIGVuZ2luZSA9IG5ldyBFbmdpbmUgSEIsIG9wc1xuICBhZGFwdENvbm5lY3RvciBjb25uZWN0b3IsIGVuZ2luZSwgSEIsIG9wc19tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lclxuXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLkhCID0gSEJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUub3BlcmF0aW9ucyA9IG9wc1xuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY29ubmVjdG9yID0gY29ubmVjdG9yXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmN1c3RvbV9vcHMgPSB0aGlzLmNvbnN0cnVjdG9yXG5cbiAgcmV0dXJuIG5ldyBvcHMuT2JqZWN0KEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKS5leGVjdXRlKClcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZXG5pZiB3aW5kb3c/IGFuZCBub3Qgd2luZG93Llk/XG4gIHdpbmRvdy5ZID0gY3JlYXRlWVxuIl19
