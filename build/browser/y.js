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

module.exports = function(HB) {
  var execution_listener, types;
  types = {};
  execution_listener = [];
  types.Operation = (function() {
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
      (new types.Delete(void 0, this)).execute();
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
          return HB.addToGarbageCollector(this);
        }
      }
    };

    Operation.prototype.cleanup = function() {
      HB.removeOperation(this);
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
        this.uid = HB.getNextOperationIdentifier();
      }
      if (this.uid.noOperation == null) {
        HB.addOperation(this);
        for (_i = 0, _len = execution_listener.length; _i < _len; _i++) {
          l = execution_listener[_i];
          l(this._encode());
        }
      }
      return this;
    };

    Operation.prototype.saveOperation = function(name, op) {
      if (((op != null ? op.execute : void 0) != null) || typeof op === "string") {
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
  types.Delete = (function(_super) {
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

  })(types.Operation);
  types.Delete.parse = function(o) {
    var deletes_uid, uid;
    uid = o['uid'], deletes_uid = o['deletes'];
    return new this(uid, deletes_uid);
  };
  types.Insert = (function(_super) {
    __extends(Insert, _super);

    function Insert(uid, prev_cl, next_cl, origin, parent) {
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
        if (prev instanceof types.Delimiter) {
          break;
        }
        if (!prev.isDeleted()) {
          position++;
        }
        prev = prev.prev_cl;
      }
      return position;
    };

    return Insert;

  })(types.Operation);
  types.ImmutableObject = (function(_super) {
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

  })(types.Operation);
  types.ImmutableObject.parse = function(json) {
    var content, uid;
    uid = json['uid'], content = json['content'];
    return new this(uid, content);
  };
  types.Delimiter = (function(_super) {
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

  })(types.Operation);
  types.Delimiter.parse = function(json) {
    var next, prev, uid;
    uid = json['uid'], prev = json['prev'], next = json['next'];
    return new this(uid, prev, next);
  };
  return {
    'types': types,
    'execution_listener': execution_listener
  };
};


},{}],6:[function(require,module,exports){
var text_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_types_uninitialized = require("./TextTypes");

module.exports = function(HB) {
  var text_types, types;
  text_types = text_types_uninitialized(HB);
  types = text_types.types;
  types.Object = (function(_super) {
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
          if (o instanceof types.Object) {
            json[name] = o.toJson(transform_to_value);
          } else if (o instanceof types.Array) {
            json[name] = o.toJson(transform_to_value);
          } else if (transform_to_value && o instanceof types.Operation) {
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
              if (event.created_ !== HB.getUserId()) {
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
          type = types[content.constructor.name];
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

  })(types.MapManager);
  types.Object.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  types.Object.create = function(content, mutable) {
    var json, n, o;
    json = new types.Object().execute();
    for (n in content) {
      o = content[n];
      json.val(n, o, mutable);
    }
    return json;
  };
  types.Number = {};
  types.Number.create = function(content) {
    return content;
  };
  return text_types;
};


},{"./TextTypes":8}],7:[function(require,module,exports){
var basic_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

basic_types_uninitialized = require("./BasicTypes");

module.exports = function(HB) {
  var basic_types, types;
  basic_types = basic_types_uninitialized(HB);
  types = basic_types.types;
  types.MapManager = (function(_super) {
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
        rm = new types.ReplaceManager(event_properties, event_this, rm_uid);
        this.map[property_name] = rm;
        rm.setParent(this, property_name);
        rm.execute();
      }
      return this.map[property_name];
    };

    return MapManager;

  })(types.Operation);
  types.ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(uid) {
      this.beginning = new types.Delimiter(void 0, void 0);
      this.end = new types.Delimiter(this.beginning, void 0);
      this.beginning.next_cl = this.end;
      this.beginning.execute();
      this.end.execute();
      ListManager.__super__.constructor.call(this, uid);
    }

    ListManager.prototype.type = "ListManager";

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
      o = this.beginning;
      while (true) {
        if (o instanceof types.Delimiter && (o.prev_cl != null)) {
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

    return ListManager;

  })(types.Operation);
  types.ReplaceManager = (function(_super) {
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
      relp = (new types.Replaceable(content, this, replaceable_uid, o, o.next_cl)).execute();
      return void 0;
    };

    ReplaceManager.prototype.isContentDeleted = function() {
      return this.getLastOperation().isDeleted();
    };

    ReplaceManager.prototype.deleteContent = function() {
      (new types.Delete(void 0, this.getLastOperation().uid)).execute();
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

  })(types.ListManager);
  types.Replaceable = (function(_super) {
    __extends(Replaceable, _super);

    function Replaceable(content, parent, uid, prev, next, origin, is_deleted) {
      if ((content != null) && (content.creator != null)) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      this.saveOperation('parent', parent);
      Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
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
      if (this.content instanceof types.Operation) {
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

  })(types.Insert);
  types.Replaceable.parse = function(json) {
    var content, is_deleted, next, origin, parent, prev, uid;
    content = json['content'], parent = json['parent'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], is_deleted = json['is_deleted'];
    return new this(content, parent, uid, prev, next, origin, is_deleted);
  };
  return basic_types;
};


},{"./BasicTypes":5}],8:[function(require,module,exports){
var structured_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

structured_types_uninitialized = require("./StructuredTypes");

module.exports = function(HB) {
  var parser, structured_types, types;
  structured_types = structured_types_uninitialized(HB);
  types = structured_types.types;
  parser = structured_types.parser;
  types.TextInsert = (function(_super) {
    __extends(TextInsert, _super);

    function TextInsert(content, uid, prev, next, origin, parent) {
      if (content != null ? content.creator : void 0) {
        this.saveOperation('content', content);
      } else {
        this.content = content;
      }
      TextInsert.__super__.constructor.call(this, uid, prev, next, origin, parent);
    }

    TextInsert.prototype.type = "TextInsert";

    TextInsert.prototype.getLength = function() {
      if (this.isDeleted()) {
        return 0;
      } else {
        return this.content.length;
      }
    };

    TextInsert.prototype.applyDelete = function() {
      TextInsert.__super__.applyDelete.apply(this, arguments);
      if (this.content instanceof types.Operation) {
        this.content.applyDelete();
      }
      return this.content = null;
    };

    TextInsert.prototype.execute = function() {
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (this.content instanceof types.Operation) {
          this.content.insert_parent = this;
        }
        return TextInsert.__super__.execute.call(this);
      }
    };

    TextInsert.prototype.val = function(current_position) {
      if (this.isDeleted() || (this.content == null)) {
        return "";
      } else {
        return this.content;
      }
    };

    TextInsert.prototype._encode = function() {
      var json, _ref;
      json = {
        'type': this.type,
        'uid': this.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'origin': this.origin.getUid(),
        'parent': this.parent.getUid()
      };
      if (((_ref = this.content) != null ? _ref.getUid : void 0) != null) {
        json['content'] = this.content.getUid();
      } else {
        json['content'] = JSON.stringify(this.content);
      }
      return json;
    };

    return TextInsert;

  })(types.Insert);
  types.TextInsert.parse = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], parent = json['parent'];
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    return new types.TextInsert(content, uid, prev, next, origin, parent);
  };
  types.Array = (function(_super) {
    __extends(Array, _super);

    function Array() {
      return Array.__super__.constructor.apply(this, arguments);
    }

    Array.prototype.type = "Array";

    Array.prototype.applyDelete = function() {
      var o;
      o = this.end;
      while (o != null) {
        o.applyDelete();
        o = o.prev_cl;
      }
      return Array.__super__.applyDelete.call(this);
    };

    Array.prototype.cleanup = function() {
      return Array.__super__.cleanup.call(this);
    };

    Array.prototype.toJson = function(transform_to_value) {
      var i, o, val, _i, _len, _results;
      if (transform_to_value == null) {
        transform_to_value = false;
      }
      val = this.val();
      _results = [];
      for (o = _i = 0, _len = val.length; _i < _len; o = ++_i) {
        i = val[o];
        if (o instanceof types.Object) {
          _results.push(o.toJson(transform_to_value));
        } else if (o instanceof types.Array) {
          _results.push(o.toJson(transform_to_value));
        } else if (transform_to_value && o instanceof types.Operation) {
          _results.push(o.val());
        } else {
          _results.push(o);
        }
      }
      return _results;
    };

    Array.prototype.val = function(pos) {
      var o, result;
      if (pos != null) {
        o = this.getOperationByPosition(pos + 1);
        if (!(o instanceof types.Delimiter)) {
          return o.val();
        } else {
          throw new Error("this position does not exist");
        }
      } else {
        o = this.beginning.next_cl;
        result = [];
        while (o !== this.end) {
          if (!o.isDeleted()) {
            result.push(o.val());
          }
          o = o.next_cl;
        }
        return result;
      }
    };

    Array.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, content);
    };

    Array.prototype.insertAfter = function(left, content, options) {
      var c, createContent, right, tmp, _i, _len;
      createContent = function(content, options) {
        var type;
        if ((content != null) && (content.constructor != null)) {
          type = types[content.constructor.name];
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
      if (content instanceof types.Operation) {
        (new types.TextInsert(content, void 0, left, right)).execute();
      } else {
        for (_i = 0, _len = content.length; _i < _len; _i++) {
          c = content[_i];
          tmp = (new types.TextInsert(createContent(c, options), void 0, left, right)).execute();
          left = tmp;
        }
      }
      return this;
    };

    Array.prototype.insert = function(position, content, options) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, [content], options);
    };

    Array.prototype["delete"] = function(position, length) {
      var d, delete_ops, i, o, _i;
      o = this.getOperationByPosition(position + 1);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof types.Delimiter) {
          break;
        }
        d = (new types.Delete(void 0, o)).execute();
        o = o.next_cl;
        while ((!(o instanceof types.Delimiter)) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return this;
    };

    Array.prototype._encode = function() {
      var json;
      json = {
        'type': this.type,
        'uid': this.getUid()
      };
      return json;
    };

    return Array;

  })(types.ListManager);
  types.Array.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  types.Array.create = function(content, mutable) {
    var ith, list;
    if (mutable === "mutable") {
      list = new types.Array().execute();
      ith = list.getOperationByPosition(0);
      list.insertAfter(ith, content);
      return list;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return content;
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  types.String = (function(_super) {
    __extends(String, _super);

    function String(uid) {
      this.textfields = [];
      String.__super__.constructor.call(this, uid);
    }

    String.prototype.type = "String";

    String.prototype.val = function() {
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

  })(types.Array);
  types.String.parse = function(json) {
    var uid;
    uid = json['uid'];
    return new this(uid);
  };
  types.String.create = function(content, mutable) {
    var word;
    if (mutable === "mutable") {
      word = new types.String().execute();
      word.insert(0, content);
      return word;
    } else if ((mutable == null) || (mutable === "immutable")) {
      return content;
    } else {
      throw new Error("Specify either \"mutable\" or \"immutable\"!!");
    }
  };
  return structured_types;
};


},{"./StructuredTypes":7}],9:[function(require,module,exports){
var Engine, HistoryBuffer, adaptConnector, createY, json_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

json_types_uninitialized = require("./Types/JsonTypes");

HistoryBuffer = require("./HistoryBuffer");

Engine = require("./Engine");

adaptConnector = require("./ConnectorAdapter");

createY = function(connector) {
  var HB, Y, type_manager, types, user_id;
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
  type_manager = json_types_uninitialized(HB);
  types = type_manager.types;
  Y = (function(_super) {
    __extends(Y, _super);

    function Y() {
      this.connector = connector;
      this.HB = HB;
      this.types = types;
      this.engine = new Engine(this.HB, type_manager.types);
      adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
      Y.__super__.constructor.apply(this, arguments);
    }

    Y.prototype.getConnector = function() {
      return this.connector;
    };

    return Y;

  })(types.Object);
  return new Y(HB.getReservedUniqueIdentifier()).execute();
};

module.exports = createY;

if ((typeof window !== "undefined" && window !== null) && (window.Y == null)) {
  window.Y = createY;
}


},{"./ConnectorAdapter":1,"./Engine":3,"./HistoryBuffer":4,"./Types/JsonTypes":6}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL1R5cGVzL0pzb25UeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENBQWxCLENBREY7QUFBQSxHQUFBO0FBQUEsRUFHQSxTQUFTLENBQUMsYUFBVixDQUFB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QUFDLEtBVnJCLENBQUE7QUFBQSxFQW1CTTtBQU1KLHdCQUFBLENBQUE7O0FBQWEsSUFBQSxXQUFBLEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxTQUFELEdBQWEsU0FBYixDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsRUFBRCxHQUFNLEVBRE4sQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLEtBQUQsR0FBUyxLQUZULENBQUE7QUFBQSxNQUdBLElBQUMsQ0FBQSxNQUFELEdBQWMsSUFBQSxNQUFBLENBQU8sSUFBQyxDQUFBLEVBQVIsRUFBWSxZQUFZLENBQUMsS0FBekIsQ0FIZCxDQUFBO0FBQUEsTUFJQSxjQUFBLENBQWUsSUFBQyxDQUFBLFNBQWhCLEVBQTJCLElBQUMsQ0FBQSxNQUE1QixFQUFvQyxJQUFDLENBQUEsRUFBckMsRUFBeUMsWUFBWSxDQUFDLGtCQUF0RCxDQUpBLENBQUE7QUFBQSxNQUtBLG9DQUFBLFNBQUEsQ0FMQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSxnQkFRQSxZQUFBLEdBQWMsU0FBQSxHQUFBO2FBQ1osSUFBQyxDQUFBLFVBRFc7SUFBQSxDQVJkLENBQUE7O2FBQUE7O0tBTmMsS0FBSyxDQUFDLE9BbkJ0QixDQUFBO0FBb0NBLFNBQVcsSUFBQSxDQUFBLENBQUUsRUFBRSxDQUFDLDJCQUFILENBQUEsQ0FBRixDQUFtQyxDQUFDLE9BQXBDLENBQUEsQ0FBWCxDQXJDUTtBQUFBLENBTFYsQ0FBQTs7QUFBQSxNQTRDTSxDQUFDLE9BQVAsR0FBaUIsT0E1Q2pCLENBQUE7O0FBNkNBLElBQUcsa0RBQUEsSUFBZ0Isa0JBQW5CO0FBQ0UsRUFBQSxNQUFNLENBQUMsQ0FBUCxHQUFXLE9BQVgsQ0FERjtDQTdDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbkNvbm5lY3RvckNsYXNzID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQ2xhc3NcIlxuI1xuIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcbiMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4jXG5hZGFwdENvbm5lY3RvciA9IChjb25uZWN0b3IsIGVuZ2luZSwgSEIsIGV4ZWN1dGlvbl9saXN0ZW5lciktPlxuXG4gIGZvciBuYW1lLCBmIG9mIENvbm5lY3RvckNsYXNzXG4gICAgY29ubmVjdG9yW25hbWVdID0gZlxuXG4gIGNvbm5lY3Rvci5zZXRJc0JvdW5kVG9ZKClcblxuICBzZW5kXyA9IChvKS0+XG4gICAgaWYgKG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkpIGFuZFxuICAgICAgICAodHlwZW9mIG8udWlkLm9wX251bWJlciBpc250IFwic3RyaW5nXCIpIGFuZCAjIFRPRE86IGkgZG9uJ3QgdGhpbmsgdGhhdCB3ZSBuZWVkIHRoaXMgYW55bW9yZS4uXG4gICAgICAgIChIQi5nZXRVc2VySWQoKSBpc250IFwiX3RlbXBcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXG5cbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XG4gICAgICB1c2VyOiBuYW1lXG4gICAgICBzdGF0ZTogdmFsdWVcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxuICAgIGZvciBzIGluIHZcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxuICAgIHN0YXRlX3ZlY3RvclxuXG4gIGdldFN0YXRlVmVjdG9yID0gKCktPlxuICAgIGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG5cbiAgZ2V0SEIgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHBhcnNlX3N0YXRlX3ZlY3RvciB2XG4gICAgaGIgPSBIQi5fZW5jb2RlIHN0YXRlX3ZlY3RvclxuICAgIGpzb24gPVxuICAgICAgaGI6IGhiXG4gICAgICBzdGF0ZV92ZWN0b3I6IGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG4gICAganNvblxuXG4gIGFwcGx5SEIgPSAoaGIsIGZyb21IQiktPlxuICAgIGVuZ2luZS5hcHBseU9wIGhiLCBmcm9tSEJcblxuICBjb25uZWN0b3IuZ2V0U3RhdGVWZWN0b3IgPSBnZXRTdGF0ZVZlY3RvclxuICBjb25uZWN0b3IuZ2V0SEIgPSBnZXRIQlxuICBjb25uZWN0b3IuYXBwbHlIQiA9IGFwcGx5SEJcblxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycy5wdXNoIChzZW5kZXIsIG9wKS0+XG4gICAgaWYgb3AudWlkLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgZW5naW5lLmFwcGx5T3Agb3BcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkYXB0Q29ubmVjdG9yIiwiXG5tb2R1bGUuZXhwb3J0cyA9XG4gICNcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnN5bmNNZXRob2Qge1N0cmluZ30gIGlzIGVpdGhlciBcInN5bmNBbGxcIiBvciBcIm1hc3Rlci1zbGF2ZVwiLlxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNZXRob2RcIiwgW1wic3luY0FsbFwiLCBcIm1hc3Rlci1zbGF2ZVwiXVxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cbiAgICByZXEgXCJ1c2VyX2lkXCJcbiAgICBAb25fdXNlcl9pZF9zZXQ/KEB1c2VyX2lkKVxuXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxuICAgICMgQnV0IHRoaXMgaXMgbm90IG5lY2Vzc2FyeSBpbiB0aGUgdGVzdC1jb25uZWN0b3JcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxuICAgIGVsc2VcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXG5cbiAgICAjIEEgTWFzdGVyIHNob3VsZCBzeW5jIHdpdGggZXZlcnlvbmUhIFRPRE86IHJlYWxseT8gLSBmb3Igbm93IGl0cyBzYWZlciB0aGlzIHdheSFcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXG5cbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcbiAgICAjIFBlZXJqcyBDb25uZWN0aW9uczoga2V5OiBjb25uLWlkLCB2YWx1ZTogb2JqZWN0XG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMgPz0gW11cblxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxuICAgIEBpc19pbml0aWFsaXplZCA9IHRydWVcblxuICBpc1JvbGVNYXN0ZXI6IC0+XG4gICAgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuXG4gIGlzUm9sZVNsYXZlOiAtPlxuICAgIEByb2xlIGlzIFwic2xhdmVcIlxuXG4gIGZpbmROZXdTeW5jVGFyZ2V0OiAoKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGZvciB1c2VyLCBjIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBpZiBub3QgYy5pc19zeW5jZWRcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgICAgIGJyZWFrXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQHNldFN0YXRlU3luY2VkKClcbiAgICBudWxsXG5cbiAgdXNlckxlZnQ6ICh1c2VyKS0+XG4gICAgZGVsZXRlIEBjb25uZWN0aW9uc1t1c2VyXVxuICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG5cbiAgdXNlckpvaW5lZDogKHVzZXIsIHJvbGUpLT5cbiAgICBpZiBub3Qgcm9sZT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkludGVybmFsOiBZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEgRS5nLiB1c2VySm9pbmVkKCd1aWQ6MzkzOScsJ3NsYXZlJylcIlxuICAgICMgYSB1c2VyIGpvaW5lZCB0aGUgcm9vbVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXSA/PSB7fVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXS5pc19zeW5jZWQgPSBmYWxzZVxuXG4gICAgaWYgKG5vdCBAaXNfc3luY2VkKSBvciBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcbiAgICAgIGVsc2UgaWYgcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICAgICMgVE9ETzogV2hhdCBpZiB0aGVyZSBhcmUgdHdvIG1hc3RlcnM/IFByZXZlbnQgc2VuZGluZyBldmVyeXRoaW5nIHR3byB0aW1lcyFcbiAgICAgICAgQHBlcmZvcm1TeW5jV2l0aE1hc3RlciB1c2VyXG5cblxuICAjXG4gICMgRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLiBJZiBub3QgY29ubmVjdGVkLCB3YWl0IHVudGlsIGNvbm5lY3RlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC5cbiAgI1xuICB3aGVuU3luY2VkOiAoYXJncyktPlxuICAgIGlmIGFyZ3MuY29uc3RydWN0b3JlIGlzIEZ1bmN0aW9uXG4gICAgICBhcmdzID0gW2FyZ3NdXG4gICAgaWYgQGlzX3N5bmNlZFxuICAgICAgYXJnc1swXS5hcHBseSB0aGlzLCBhcmdzWzEuLl1cbiAgICBlbHNlXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZCA/PSBbXVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQucHVzaCBhcmdzXG5cbiAgI1xuICAjIEV4ZWN1dGUgYW4gZnVuY3Rpb24gd2hlbiBhIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuIGYgd2lsbCBiZSBjYWxsZWQgd2l0aCAoc2VuZGVyX2lkLCBicm9hZGNhc3Qge3RydWV8ZmFsc2V9LCBtZXNzYWdlKS5cbiAgI1xuICBvblJlY2VpdmU6IChmKS0+XG4gICAgQHJlY2VpdmVfaGFuZGxlcnMucHVzaCBmXG5cbiAgIyMjXG4gICMgQnJvYWRjYXN0IGEgbWVzc2FnZSB0byBhbGwgY29ubmVjdGVkIHBlZXJzLlxuICAjIEBwYXJhbSBtZXNzYWdlIHtPYmplY3R9IFRoZSBtZXNzYWdlIHRvIGJyb2FkY2FzdC5cbiAgI1xuICBicm9hZGNhc3Q6IChtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IGJyb2FkY2FzdCFcIlxuXG4gICNcbiAgIyBTZW5kIGEgbWVzc2FnZSB0byBhIHBlZXIsIG9yIHNldCBvZiBwZWVyc1xuICAjXG4gIHNlbmQ6IChwZWVyX3MsIG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgc2VuZCFcIlxuICAjIyNcblxuICAjXG4gICMgcGVyZm9ybSBhIHN5bmMgd2l0aCBhIHNwZWNpZmljIHVzZXIuXG4gICNcbiAgcGVyZm9ybVN5bmM6ICh1c2VyKS0+XG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgICBAc2VuZCB1c2VyLFxuICAgICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxuICAgICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgICBkYXRhOiBbXSAjIEBnZXRTdGF0ZVZlY3RvcigpXG4gICAgICBpZiBub3QgQHNlbnRfaGJfdG9fYWxsX3VzZXJzXG4gICAgICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IHRydWVcblxuICAgICAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICAgICAgX2hiID0gW11cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDMwXG4gICAgICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuXG5cbiAgI1xuICAjIFdoZW4gYSBtYXN0ZXIgbm9kZSBqb2luZWQgdGhlIHJvb20sIHBlcmZvcm0gdGhpcyBzeW5jIHdpdGggaGltLiBJdCB3aWxsIGFzayB0aGUgbWFzdGVyIGZvciB0aGUgSEIsXG4gICMgYW5kIHdpbGwgYnJvYWRjYXN0IGhpcyBvd24gSEJcbiAgI1xuICBwZXJmb3JtU3luY1dpdGhNYXN0ZXI6ICh1c2VyKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgQHNlbmQgdXNlcixcbiAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgZGF0YTogW11cbiAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICBfaGIgPSBbXVxuICAgIGZvciBvIGluIGhiXG4gICAgICBfaGIucHVzaCBvXG4gICAgICBpZiBfaGIubGVuZ3RoID4gMzBcbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgQGJyb2FkY2FzdFxuICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgZGF0YTogX2hiXG5cbiAgI1xuICAjIFlvdSBhcmUgc3VyZSB0aGF0IGFsbCBjbGllbnRzIGFyZSBzeW5jZWQsIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICBzZXRTdGF0ZVN5bmNlZDogKCktPlxuICAgIGlmIG5vdCBAaXNfc3luY2VkXG4gICAgICBAaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgaWYgQGNvbXB1dGVfd2hlbl9zeW5jZWQ/XG4gICAgICAgIGZvciBmIGluIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICAgICAgZigpXG4gICAgICAgIGRlbGV0ZSBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgbnVsbFxuXG4gICNcbiAgIyBZb3UgcmVjZWl2ZWQgYSByYXcgbWVzc2FnZSwgYW5kIHlvdSBrbm93IHRoYXQgaXQgaXMgaW50ZW5kZWQgZm9yIHRvIFlqcy4gVGhlbiBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICNcbiAgcmVjZWl2ZU1lc3NhZ2U6IChzZW5kZXIsIHJlcyktPlxuICAgIGlmIG5vdCByZXMuc3luY19zdGVwP1xuICAgICAgZm9yIGYgaW4gQHJlY2VpdmVfaGFuZGxlcnNcbiAgICAgICAgZiBzZW5kZXIsIHJlc1xuICAgIGVsc2VcbiAgICAgIGlmIHNlbmRlciBpcyBAdXNlcl9pZFxuICAgICAgICByZXR1cm5cbiAgICAgIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJnZXRIQlwiXG4gICAgICAgIGRhdGEgPSBAZ2V0SEIocmVzLmRhdGEpXG4gICAgICAgIGhiID0gZGF0YS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICAjIGFsd2F5cyBicm9hZGNhc3QsIHdoZW4gbm90IHN5bmNlZC5cbiAgICAgICAgIyBUaGlzIHJlZHVjZXMgZXJyb3JzLCB3aGVuIHRoZSBjbGllbnRzIGdvZXMgb2ZmbGluZSBwcmVtYXR1cmVseS5cbiAgICAgICAgIyBXaGVuIHRoaXMgY2xpZW50IG9ubHkgc3luY3MgdG8gb25lIG90aGVyIGNsaWVudHMsIGJ1dCBsb29zZXMgY29ubmVjdG9ycyxcbiAgICAgICAgIyBiZWZvcmUgc3luY2luZyB0byB0aGUgb3RoZXIgY2xpZW50cywgdGhlIG9ubGluZSBjbGllbnRzIGhhdmUgZGlmZmVyZW50IHN0YXRlcy5cbiAgICAgICAgIyBTaW5jZSB3ZSBkbyBub3Qgd2FudCB0byBwZXJmb3JtIHJlZ3VsYXIgc3luY3MsIHRoaXMgaXMgYSBnb29kIGFsdGVybmF0aXZlXG4gICAgICAgIGlmIEBpc19zeW5jZWRcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XG4gICAgICAgICAgICBAc2VuZCBzZW5kZXIsIG1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBicm9hZGNhc3QgbVxuXG4gICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAzMFxuICAgICAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuXG4gICAgICAgIHNlbmRBcHBseUhCXG4gICAgICAgICAgc3luY19zdGVwIDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuICAgICAgICBpZiByZXMuc2VuZF9hZ2Fpbj8gYW5kIEBwZXJmb3JtX3NlbmRfYWdhaW5cbiAgICAgICAgICBzZW5kX2FnYWluID0gZG8gKHN2ID0gZGF0YS5zdGF0ZV92ZWN0b3IpPT5cbiAgICAgICAgICAgICgpPT5cbiAgICAgICAgICAgICAgaGIgPSBAZ2V0SEIoc3YpLmhiXG4gICAgICAgICAgICAgIEBzZW5kIHNlbmRlcixcbiAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiLFxuICAgICAgICAgICAgICAgIGRhdGE6IGhiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yP1xuICAgICAgICAgIG8udWlkLmNyZWF0b3IgPSBpZFxuICAgICAgICBpZiBvLnVpZC5hbHQ/XG4gICAgICAgICAgby51aWQuYWx0LmNyZWF0b3IgPSBpZFxuICAgICAgaWYgQGJ1ZmZlcltpZF0/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXG4gICAgICBkZWxldGUgQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW2lkXSA9IEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pICMgeW91IGFscmVhZHkgZG8gdGhpcyBpbiB0aGUgZW5naW5lLCBzbyBkZWxldGUgaXQgaGVyZSFcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcbiAgICBAYWRkVG9Db3VudGVyKG8pXG4gICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cblxuICAjIFdoZW4gdGhlIEhCIGRldGVybWluZXMgaW5jb25zaXN0ZW5jaWVzLCB0aGVuIHRoZSBpbnZva2VTeW5jXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcbiAgc2V0SW52b2tlU3luY0hhbmRsZXI6IChmKS0+XG4gICAgQGludm9rZVN5bmMgPSBmXG5cbiAgIyBlbXB0eSBwZXIgZGVmYXVsdCAjIFRPRE86IGRvIGkgbmVlZCB0aGlzP1xuICBpbnZva2VTeW5jOiAoKS0+XG5cbiAgIyBhZnRlciB5b3UgcmVjZWl2ZWQgdGhlIEhCIG9mIGFub3RoZXIgdXNlciAoaW4gdGhlIHN5bmMgcHJvY2VzcyksXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cbiAgICBmb3IgdXNlcixzdGF0ZSBvZiBzdGF0ZV92ZWN0b3JcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBpZiBvLnVpZC5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcbiAgICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSBpc250IChvLnVpZC5vcF9udW1iZXIgKyAxKVxuICAgICAgI2NvbnNvbGUubG9nIChAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gLSAoby51aWQub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgdHlwZXMgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBAcHJpdmF0ZVxuICAjIEBhYnN0cmFjdFxuICAjIEBub2RvY1xuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BlcmF0aW9ucy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLlxuICAgICMgSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZCBiZWZvcmUgYXQgdGhlIGVuZCBvZiB0aGUgZXhlY3V0aW9uIHNlcXVlbmNlXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XG4gICAgICBpZiB1aWQ/XG4gICAgICAgIEB1aWQgPSB1aWRcblxuICAgIHR5cGU6IFwiT3BlcmF0aW9uXCJcblxuICAgIHJldHJpZXZlU3ViOiAoKS0+XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJzdWIgcHJvcGVydGllcyBhcmUgbm90IGVuYWJsZSBvbiB0aGlzIG9wZXJhdGlvbiB0eXBlIVwiXG5cbiAgICAjXG4gICAgIyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIuIEl0IGRlcGVuZHMgb24gdGhlIG9wZXJhdGlvbiB3aGljaCBldmVudHMgYXJlIHN1cHBvcnRlZC5cbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cbiAgICAjXG4gICAgb2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcbiAgICAjIEBzZWUgT3BlcmF0aW9uLm9ic2VydmVcbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxuICAgICMgICBAcGFyYW0gZiAgICAge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdGhhdCB5b3Ugd2FudCB0byBkZWxldGUgXG4gICAgdW5vYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IEBldmVudF9saXN0ZW5lcnMuZmlsdGVyIChnKS0+XG4gICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGFsbCBzdWJzY3JpYmVkIGV2ZW50IGxpc3RlbmVycy5cbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxuICAgICMgKFRoZW4gb25seSBvbmUgcmVwbGFjZSBldmVudCBzaG91bGQgZmlyZS4gKVxuICAgICMgVGhpcyBpcyBhbHNvIGNhbGxlZCBpbiB0aGUgY2xlYW51cCBtZXRob2QuXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW11cblxuICAgIGRlbGV0ZTogKCktPlxuICAgICAgKG5ldyB0eXBlcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcbiAgICAgIG51bGxcblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XG4gICAgY2FsbEV2ZW50OiAoKS0+XG4gICAgICBAZm9yd2FyZEV2ZW50IEAsIGFyZ3VtZW50cy4uLlxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgdGhpcyA/XG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGFyZ3MuLi4pLT5cbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcbiAgICAgICAgZi5jYWxsIG9wLCBhcmdzLi4uXG5cbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIEBpc19kZWxldGVkXG5cbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxuICAgICAgaWYgbm90IEBnYXJiYWdlX2NvbGxlY3RlZFxuICAgICAgICAjY29uc29sZS5sb2cgXCJhcHBseURlbGV0ZTogI3tAdHlwZX1cIlxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcbiAgICAgICAgaWYgZ2FyYmFnZWNvbGxlY3RcbiAgICAgICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSB0cnVlXG4gICAgICAgICAgSEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEhCLnJlbW92ZU9wZXJhdGlvbiBAXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChAcGFyZW50KS0+XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcGFyZW50XG5cbiAgICAjXG4gICAgIyBDb21wdXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpIHRoYXQgaWRlbnRpZmllcyB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0VWlkOiAoKS0+XG4gICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgQHVpZFxuICAgICAgZWxzZVxuICAgICAgICBpZiBAdWlkLmFsdD8gIyBjb3VsZCBiZSAoc2FmZWx5KSB1bmRlZmluZWRcbiAgICAgICAgICBtYXBfdWlkID0gQHVpZC5hbHQuY2xvbmVVaWQoKVxuICAgICAgICAgIG1hcF91aWQuc3ViID0gQHVpZC5zdWJcbiAgICAgICAgICBtYXBfdWlkXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcblxuICAgIGNsb25lVWlkOiAoKS0+XG4gICAgICB1aWQgPSB7fVxuICAgICAgZm9yIG4sdiBvZiBAZ2V0VWlkKClcbiAgICAgICAgdWlkW25dID0gdlxuICAgICAgdWlkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSWYgbm90IGFscmVhZHkgZG9uZSwgc2V0IHRoZSB1aWRcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgaWYgbm90IEB1aWQ/XG4gICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxuICAgICAgICAjIFRoZXJlIGlzIG9ubHkgb25lIG90aGVyIHBsYWNlLCB3aGVyZSB0aGlzIGNhbiBiZSBkb25lIC0gYmVmb3JlIGFuIEluc2VydGlvblxuICAgICAgICAjIGlzIGV4ZWN1dGVkIChiZWNhdXNlIHdlIG5lZWQgdGhlIGNyZWF0b3JfaWQpXG4gICAgICAgIEB1aWQgPSBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uIEBcbiAgICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgT3BlcmF0aW9ucyBtYXkgZGVwZW5kIG9uIG90aGVyIG9wZXJhdGlvbnMgKGxpbmtlZCBsaXN0cywgZXRjLikuXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXG4gICAgIyBhbiBlYXN5IHdheSB0byByZWZlciB0byB0aGVzZSBvcGVyYXRpb25zIHZpYSBhbiB1aWQgb3Igb2JqZWN0IHJlZmVyZW5jZS5cbiAgICAjXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8pOyAgIG9yXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkby5nZXRVaWQoKSk7XG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcF91aWQpXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R9IG9wX3VpZCBBIHVpZCB0aGF0IHJlZmVycyB0byBhbiBvcGVyYXRpb25cbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPcGVyYXRpb259IG9wIEFuIE9wZXJhdGlvbiBvYmplY3RcbiAgICAjXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wKS0+XG5cbiAgICAgICNcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXG4gICAgICAjIFdlIHVzZSBkdWNrLXR5cGluZyB0byBjaGVjayBpZiBvcCBpcyBpbnN0YW50aWF0ZWQgc2luY2UgdGhlcmVcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXG4gICAgICAjXG4gICAgICBpZiBvcD8uZXhlY3V0ZT8gb3IgdHlwZW9mIG9wIGlzIFwic3RyaW5nXCJcbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWQsIG9yIG9wIGlzIHN0cmluZy4gQ3VycmVudGx5IFwiRGVsaW1pdGVyXCIgaXMgc2F2ZWQgYXMgc3RyaW5nIFxuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyB0eXBlcy5EZWxldGUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIHR5cGVzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyB0aGlzKHVpZCwgZGVsZXRlc191aWQpXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIHR5cGVzLkluc2VydCBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luLCBwYXJlbnQpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc0RlbGV0ZWQoKSBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIGNhbGxMYXRlclxuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzKG8pXG4gICAgICBpZiBAcHJldl9jbD8uaXNEZWxldGVkKClcbiAgICAgICAgIyBnYXJiYWdlIGNvbGxlY3QgcHJldl9jbFxuICAgICAgICBAcHJldl9jbC5hcHBseURlbGV0ZSgpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInJpZ2h0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGNoYW5nZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcbiAgICAgICAgc3VwZXJcbiAgICAgICMgZWxzZVxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby51aWQuY3JlYXRvciA8IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzKClcbiAgICAgICAgQFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBAcGFyZW50Py5jYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImluc2VydFwiXG4gICAgICAgIHBvc2l0aW9uOiBAZ2V0UG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBwYXJlbnRcbiAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IEBjb250ZW50XG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBAcGFyZW50LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudCAjIFRPRE86IFlvdSBjYW4gY29tYmluZSBnZXRQb3NpdGlvbiArIGdldFBhcmVudCBpbiBhIG1vcmUgZWZmaWNpZW50IG1hbm5lciEgKG9ubHkgbGVmdCBEZWxpbWl0ZXIgd2lsbCBob2xkIEBwYXJlbnQpXG4gICAgICAgIGxlbmd0aDogMVxuICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgIF1cblxuICAgICNcbiAgICAjIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQb3NpdGlvbjogKCktPlxuICAgICAgcG9zaXRpb24gPSAwXG4gICAgICBwcmV2ID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgcHJldiBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBEZWZpbmVzIGFuIG9iamVjdCB0aGF0IGlzIGNhbm5vdCBiZSBjaGFuZ2VkLiBZb3UgY2FuIHVzZSB0aGlzIHRvIHNldCBhbiBpbW11dGFibGUgc3RyaW5nLCBvciBhIG51bWJlci5cbiAgI1xuICBjbGFzcyB0eXBlcy5JbW11dGFibGVPYmplY3QgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBjb250ZW50XG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBAY29udGVudCktPlxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkltbXV0YWJsZU9iamVjdFwiXG5cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtTdHJpbmddIFRoZSBjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICB2YWwgOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnY29udGVudCcgOiBAY29udGVudFxuICAgICAgfVxuICAgICAganNvblxuXG4gIHR5cGVzLkltbXV0YWJsZU9iamVjdC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgY29udGVudClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBkZWxpbWl0ZXIgaXMgcGxhY2VkIGF0IHRoZSBlbmQgYW5kIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAjIFRoaXMgaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGhhdmUgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCBldmVuIGlmIHRoZSBjb250ZW50XG4gICMgb2YgdGhlIEVuZ2luZSBpcyBlbXB0eS5cbiAgI1xuICBjbGFzcyB0eXBlcy5EZWxpbWl0ZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHtub09wZXJhdGlvbjogdHJ1ZX1cblxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEB1bmNoZWNrZWQ/WydwcmV2X2NsJ11cbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUHJvYmFibHkgZHVwbGljYXRlZCBvcGVyYXRpb25zXCJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIHN1cGVyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBmYWxzZVxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IG9yIEBuZXh0X2NsPyBvciB0cnVlICMgVE9ETzogYXJlIHlvdSBzdXJlPyBUaGlzIGNhbiBoYXBwZW4gcmlnaHQ/XG4gICAgICAgIHN1cGVyXG4gICAgICAjZWxzZVxuICAgICAgIyAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICB0eXBlcy5EZWxpbWl0ZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAndWlkJyA6IHVpZFxuICAgICdwcmV2JyA6IHByZXZcbiAgICAnbmV4dCcgOiBuZXh0XG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQsIHByZXYsIG5leHQpXG5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBtb2R1bGUgZXhwb3J0cyBhZnRlciBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgSGlzdG9yeUJ1ZmZlclxuICB7XG4gICAgJ3R5cGVzJyA6IHR5cGVzXG4gICAgJ2V4ZWN1dGlvbl9saXN0ZW5lcicgOiBleGVjdXRpb25fbGlzdGVuZXJcbiAgfVxuXG5cblxuXG4iLCJ0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9UZXh0VHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICB0ZXh0X3R5cGVzID0gdGV4dF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdGV4dF90eXBlcy50eXBlc1xuXG4gICNcbiAgIyBNYW5hZ2VzIE9iamVjdC1saWtlIHZhbHVlcy5cbiAgI1xuICBjbGFzcyB0eXBlcy5PYmplY3QgZXh0ZW5kcyB0eXBlcy5NYXBNYW5hZ2VyXG5cbiAgICAjXG4gICAgIyBJZGVudGlmaWVzIHRoaXMgY2xhc3MuXG4gICAgIyBVc2UgaXQgdG8gY2hlY2sgd2hldGhlciB0aGlzIGlzIGEganNvbi10eXBlIG9yIHNvbWV0aGluZyBlbHNlLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB4ID0geS52YWwoJ3Vua25vd24nKVxuICAgICMgICBpZiAoeC50eXBlID09PSBcIk9iamVjdFwiKSB7XG4gICAgIyAgICAgY29uc29sZS5sb2cgSlNPTi5zdHJpbmdpZnkoeC50b0pzb24oKSlcbiAgICAjICAgfVxuICAgICNcbiAgICB0eXBlOiBcIk9iamVjdFwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG5cbiAgICAjXG4gICAgIyBUcmFuc2Zvcm0gdGhpcyB0byBhIEpzb24uIElmIHlvdXIgYnJvd3NlciBzdXBwb3J0cyBPYmplY3Qub2JzZXJ2ZSBpdCB3aWxsIGJlIHRyYW5zZm9ybWVkIGF1dG9tYXRpY2FsbHkgd2hlbiBhIGNoYW5nZSBhcnJpdmVzLlxuICAgICMgT3RoZXJ3aXNlIHlvdSB3aWxsIGxvb3NlIGFsbCB0aGUgc2hhcmluZy1hYmlsaXRpZXMgKHRoZSBuZXcgb2JqZWN0IHdpbGwgYmUgYSBkZWVwIGNsb25lKSFcbiAgICAjIEByZXR1cm4ge0pzb259XG4gICAgI1xuICAgICMgVE9ETzogYXQgdGhlIG1vbWVudCB5b3UgZG9uJ3QgY29uc2lkZXIgY2hhbmdpbmcgb2YgcHJvcGVydGllcy5cbiAgICAjIEUuZy46IGxldCB4ID0ge2E6W119LiBUaGVuIHguYS5wdXNoIDEgd291bGRuJ3QgY2hhbmdlIGFueXRoaW5nXG4gICAgI1xuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICBpZiBub3QgQGJvdW5kX2pzb24/IG9yIG5vdCBPYmplY3Qub2JzZXJ2ZT8gb3IgdHJ1ZSAjIFRPRE86IGN1cnJlbnRseSwgeW91IGFyZSBub3Qgd2F0Y2hpbmcgbXV0YWJsZSBzdHJpbmdzIGZvciBjaGFuZ2VzLCBhbmQsIHRoZXJlZm9yZSwgdGhlIEBib3VuZF9qc29uIGlzIG5vdCB1cGRhdGVkLiBUT0RPIFRPRE8gIHd1YXd1YXd1YSBlYXN5XG4gICAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgICBqc29uID0ge31cbiAgICAgICAgZm9yIG5hbWUsIG8gb2YgdmFsXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9iamVjdFxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5BcnJheVxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgICAganNvbltuYW1lXSA9IG8udmFsKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBqc29uW25hbWVdID0gb1xuICAgICAgICBAYm91bmRfanNvbiA9IGpzb25cbiAgICAgICAgaWYgT2JqZWN0Lm9ic2VydmU/XG4gICAgICAgICAgdGhhdCA9IEBcbiAgICAgICAgICBPYmplY3Qub2JzZXJ2ZSBAYm91bmRfanNvbiwgKGV2ZW50cyktPlxuICAgICAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgICAgICBpZiBub3QgZXZlbnQuY2hhbmdlZEJ5PyBhbmQgKGV2ZW50LnR5cGUgaXMgXCJhZGRcIiBvciBldmVudC50eXBlID0gXCJ1cGRhdGVcIilcbiAgICAgICAgICAgICAgICAjIHRoaXMgZXZlbnQgaXMgbm90IGNyZWF0ZWQgYnkgWS5cbiAgICAgICAgICAgICAgICB0aGF0LnZhbChldmVudC5uYW1lLCBldmVudC5vYmplY3RbZXZlbnQubmFtZV0pXG4gICAgICAgICAgQG9ic2VydmUgKGV2ZW50cyktPlxuICAgICAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgICAgICBpZiBldmVudC5jcmVhdGVkXyBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICAgICAgICAgICAgbm90aWZpZXIgPSBPYmplY3QuZ2V0Tm90aWZpZXIodGhhdC5ib3VuZF9qc29uKVxuICAgICAgICAgICAgICAgIG9sZFZhbCA9IHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXVxuICAgICAgICAgICAgICAgIGlmIG9sZFZhbD9cbiAgICAgICAgICAgICAgICAgIG5vdGlmaWVyLnBlcmZvcm1DaGFuZ2UgJ3VwZGF0ZScsICgpLT5cbiAgICAgICAgICAgICAgICAgICAgICB0aGF0LmJvdW5kX2pzb25bZXZlbnQubmFtZV0gPSB0aGF0LnZhbChldmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAsIHRoYXQuYm91bmRfanNvblxuICAgICAgICAgICAgICAgICAgbm90aWZpZXIubm90aWZ5XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdDogdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICd1cGRhdGUnXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGV2ZW50Lm5hbWVcbiAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG9sZFZhbFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkQnk6IGV2ZW50LmNoYW5nZWRCeVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIG5vdGlmaWVyLnBlcmZvcm1DaGFuZ2UgJ2FkZCcsICgpLT5cbiAgICAgICAgICAgICAgICAgICAgICB0aGF0LmJvdW5kX2pzb25bZXZlbnQubmFtZV0gPSB0aGF0LnZhbChldmVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAsIHRoYXQuYm91bmRfanNvblxuICAgICAgICAgICAgICAgICAgbm90aWZpZXIubm90aWZ5XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdDogdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGQnXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGV2ZW50Lm5hbWVcbiAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWU6IG9sZFZhbFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkQnk6ZXZlbnQuY2hhbmdlZEJ5XG4gICAgICBAYm91bmRfanNvblxuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbCgpXG4gICAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICAgIyAgIEByZXR1cm4gW0pzb25dXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAgICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAgICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZXx8U3RyaW5nfE9iamVjdF0gRGVwZW5kaW5nIG9uIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuIElmIG11dGFibGUgaXQgd2lsbCByZXR1cm4gYSBPcGVyYXRpb24tdHlwZSBvYmplY3QsIGlmIGltbXV0YWJsZSBpdCB3aWxsIHJldHVybiBTdHJpbmcvT2JqZWN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSwgY29udGVudClcbiAgICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gY29udGVudCBDb250ZW50IG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBuYW1lPyBhbmQgYXJndW1lbnRzLmxlbmd0aCA+IDFcbiAgICAgICAgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY29uc3RydWN0b3I/XG4gICAgICAgICAgdHlwZSA9IHR5cGVzW2NvbnRlbnQuY29uc3RydWN0b3IubmFtZV1cbiAgICAgICAgICBpZiB0eXBlPyBhbmQgdHlwZS5jcmVhdGU/XG4gICAgICAgICAgICBhcmdzID0gW11cbiAgICAgICAgICAgIGZvciBpIGluIFsxLi4uYXJndW1lbnRzLmxlbmd0aF1cbiAgICAgICAgICAgICAgYXJncy5wdXNoIGFyZ3VtZW50c1tpXVxuICAgICAgICAgICAgbyA9IHR5cGUuY3JlYXRlLmFwcGx5IG51bGwsIGFyZ3NcbiAgICAgICAgICAgIHN1cGVyIG5hbWUsIG9cbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgI3tjb250ZW50LmNvbnN0cnVjdG9yLm5hbWV9LXR5cGUgaXMgbm90ICh5ZXQpIHN1cHBvcnRlZCBpbiBZLlwiXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG4gICAgICBlbHNlICMgaXMgdGhpcyBldmVuIG5lY2Vzc2FyeSA/IEkgaGF2ZSB0byBkZWZpbmUgZXZlcnkgdHlwZSBhbnl3YXkuLiAoc2VlIE51bWJlciB0eXBlIGJlbG93KVxuICAgICAgICBzdXBlciBuYW1lXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG5cbiAgdHlwZXMuT2JqZWN0LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkKVxuXG4gIHR5cGVzLk9iamVjdC5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGpzb24gPSBuZXcgdHlwZXMuT2JqZWN0KCkuZXhlY3V0ZSgpXG4gICAgZm9yIG4sbyBvZiBjb250ZW50XG4gICAgICBqc29uLnZhbCBuLCBvLCBtdXRhYmxlXG4gICAganNvblxuXG5cbiAgdHlwZXMuTnVtYmVyID0ge31cbiAgdHlwZXMuTnVtYmVyLmNyZWF0ZSA9IChjb250ZW50KS0+XG4gICAgY29udGVudFxuXG4gIHRleHRfdHlwZXNcblxuXG4iLCJiYXNpY190eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIGJhc2ljX3R5cGVzID0gYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IGJhc2ljX3R5cGVzLnR5cGVzXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgbWFwIGxpa2Ugb2JqZWN0cy4gRS5nLiBKc29uLVR5cGUgYW5kIFhNTCBhdHRyaWJ1dGVzLlxuICAjXG4gIGNsYXNzIHR5cGVzLk1hcE1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBtYXAgPSB7fVxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQG1hcFxuICAgICAgICBwLmFwcGx5RGVsZXRlKClcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBzZWUgSnNvblR5cGVzLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBAcmV0cmlldmVTdWIobmFtZSkucmVwbGFjZSBjb250ZW50XG4gICAgICAgIEBcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgcHJvcCA9IEBtYXBbbmFtZV1cbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgIHByb3AudmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBtYXBcbiAgICAgICAgICBpZiBub3Qgby5pc0NvbnRlbnREZWxldGVkKClcbiAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG8udmFsKClcbiAgICAgICAgcmVzdWx0XG5cbiAgICBkZWxldGU6IChuYW1lKS0+XG4gICAgICBAbWFwW25hbWVdPy5kZWxldGVDb250ZW50KClcbiAgICAgIEBcblxuICAgIHJldHJpZXZlU3ViOiAocHJvcGVydHlfbmFtZSktPlxuICAgICAgaWYgbm90IEBtYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyB0eXBlcy5SZXBsYWNlTWFuYWdlciBldmVudF9wcm9wZXJ0aWVzLCBldmVudF90aGlzLCBybV91aWQgIyB0aGlzIG9wZXJhdGlvbiBzaGFsbCBub3QgYmUgc2F2ZWQgaW4gdGhlIEhCXG4gICAgICAgIEBtYXBbcHJvcGVydHlfbmFtZV0gPSBybVxuICAgICAgICBybS5zZXRQYXJlbnQgQCwgcHJvcGVydHlfbmFtZVxuICAgICAgICBybS5leGVjdXRlKClcbiAgICAgIEBtYXBbcHJvcGVydHlfbmFtZV1cblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyB0eXBlcy5MaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAYmVnaW5uaW5nID0gbmV3IHR5cGVzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgQGVuZCA9ICAgICAgIG5ldyB0eXBlcy5EZWxpbWl0ZXIgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICByZXN1bHQucHVzaCBvXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgIyBlLmcuIFwiYWJjXCIgOiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgIyBmaW5kIHRoZSBpLXRoIG9wXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3MgdHlwZXMuUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF9wcm9wZXJ0aWVzIERlY29yYXRlcyB0aGUgZXZlbnQgdGhhdCBpcyB0aHJvd24gYnkgdGhlIFJNXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfdGhpcyBUaGUgb2JqZWN0IG9uIHdoaWNoIHRoZSBldmVudCBzaGFsbCBiZSBleGVjdXRlZFxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkLCBiZWdpbm5pbmcsIGVuZCktPlxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cbiAgICAgICAgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddID0gQGV2ZW50X3RoaXNcbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyB0eXBlcy5SZXBsYWNlYWJsZSBjb250ZW50LCBALCByZXBsYWNlYWJsZV91aWQsIG8sIG8ubmV4dF9jbCkuZXhlY3V0ZSgpXG4gICAgICAjIFRPRE86IGRlbGV0ZSByZXBsIChmb3IgZGVidWdnaW5nKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBpc0NvbnRlbnREZWxldGVkOiAoKS0+XG4gICAgICBAZ2V0TGFzdE9wZXJhdGlvbigpLmlzRGVsZXRlZCgpXG5cbiAgICBkZWxldGVDb250ZW50OiAoKS0+XG4gICAgICAobmV3IHR5cGVzLkRlbGV0ZSB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuICAgICNcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPVxuICAgICAgICB7XG4gICAgICAgICAgJ3R5cGUnOiBAdHlwZVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGpzb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyB0eXBlcy5SZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIGlzX2RlbGV0ZWQpLT5cbiAgICAgICMgc2VlIGVuY29kZSB0byBzZWUsIHdoeSB3ZSBhcmUgZG9pbmcgaXQgdGhpcyB3YXlcbiAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNyZWF0b3I/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luICMgUGFyZW50IGlzIGFscmVhZHkgc2F2ZWQgYnkgUmVwbGFjZWFibGVcbiAgICAgIEBpc19kZWxldGVkID0gaXNfZGVsZXRlZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlYWJsZVwiXG5cbiAgICAjXG4gICAgIyBSZXR1cm4gdGhlIGNvbnRlbnQgdGhhdCB0aGlzIG9wZXJhdGlvbiBob2xkcy5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBAY29udGVudFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHJlcyA9IHN1cGVyXG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBAY29udGVudC5kZWxldGVBbGxPYnNlcnZlcnM/KClcbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGU/KClcbiAgICAgICAgQGNvbnRlbnQuZG9udFN5bmM/KClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuICAgICAgcmVzXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC10eXBlIHdhcyBzdWNjZXNzZnVsbHkgZXhlY3V0ZWQuXG4gICAgIyBUT0RPOiBjb25zaWRlciBkb2luZyB0aGlzIGluIGEgbW9yZSBjb25zaXN0ZW50IG1hbm5lci4gVGhpcyBjb3VsZCBhbHNvIGJlXG4gICAgIyBkb25lIHdpdGggZXhlY3V0ZS4gQnV0IGN1cnJlbnRseSwgdGhlcmUgYXJlIG5vIHNwZWNpdGFsIEluc2VydC10eXBlcyBmb3IgTGlzdE1hbmFnZXIuXG4gICAgI1xuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKCktPlxuICAgICAgaWYgQG5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBAcHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIHRoaXMgcmVwbGFjZXMgYW5vdGhlciBSZXBsYWNlYWJsZVxuICAgICAgICBpZiBub3QgQGlzX2RlbGV0ZWQgIyBXaGVuIHRoaXMgaXMgcmVjZWl2ZWQgZnJvbSB0aGUgSEIsIHRoaXMgY291bGQgYWxyZWFkeSBiZSBkZWxldGVkIVxuICAgICAgICAgIG9sZF92YWx1ZSA9IEBwcmV2X2NsLmNvbnRlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgb2xkVmFsdWU6IG9sZF92YWx1ZVxuICAgICAgICAgIF1cbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSBpZiBAbmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBAYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBAY29udGVudFxuICAgICAgICBdXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAncGFyZW50JyA6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2lzX2RlbGV0ZWQnOiBAaXNfZGVsZXRlZFxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBqc29uLm9yaWdpbiA9IFwiRGVsaW1pdGVyXCJcbiAgICAgIGVsc2UgaWYgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb24ub3JpZ2luID0gQG9yaWdpbi5nZXRVaWQoKVxuXG4gICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICAjIFRoaXMgY291bGQgYmUgYSBzZWN1cml0eSBjb25jZXJuLlxuICAgICAgICAjIFRocm93IGVycm9yIGlmIHRoZSB1c2VycyB3YW50cyB0byB0cmljayB1c1xuICAgICAgICBpZiBAY29udGVudD8gYW5kIEBjb250ZW50LmNyZWF0b3I/XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCBjcmVhdG9yIGhlcmUhXCJcbiAgICAgICAganNvblsnY29udGVudCddID0gQGNvbnRlbnRcbiAgICAgIGpzb25cblxuICB0eXBlcy5SZXBsYWNlYWJsZS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdpc19kZWxldGVkJzogaXNfZGVsZXRlZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgaXNfZGVsZXRlZClcblxuXG4gIGJhc2ljX3R5cGVzXG5cblxuXG5cblxuXG4iLCJzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9TdHJ1Y3R1cmVkVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBzdHJ1Y3R1cmVkX3R5cGVzID0gc3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gc3RydWN0dXJlZF90eXBlcy50eXBlc1xuICBwYXJzZXIgPSBzdHJ1Y3R1cmVkX3R5cGVzLnBhcnNlclxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyB0eXBlcy5UZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgcGFyZW50KS0+XG4gICAgICBpZiBjb250ZW50Py5jcmVhdG9yXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBwYXJlbnRcblxuICAgIHR5cGU6IFwiVGV4dEluc2VydFwiXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZSB0aGUgZWZmZWN0aXZlIGxlbmd0aCBvZiB0aGUgJGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldExlbmd0aDogKCktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpXG4gICAgICAgIDBcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQubGVuZ3RoXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIgIyBubyBicmFjZXMgaW5kZWVkIVxuICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgQGNvbnRlbnQgPSBudWxsXG5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEBcbiAgICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKCkgb3Igbm90IEBjb250ZW50P1xuICAgICAgICBcIlwiXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdwcmV2JzogQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnbmV4dCc6IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ29yaWdpbic6IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgICAgICAncGFyZW50JzogQHBhcmVudC5nZXRVaWQoKVxuICAgICAgICB9XG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEpTT04uc3RyaW5naWZ5IEBjb250ZW50XG4gICAgICBqc29uXG5cbiAgdHlwZXMuVGV4dEluc2VydC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIGlmIHR5cGVvZiBjb250ZW50IGlzIFwic3RyaW5nXCJcbiAgICAgIGNvbnRlbnQgPSBKU09OLnBhcnNlKGNvbnRlbnQpXG4gICAgbmV3IHR5cGVzLlRleHRJbnNlcnQgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIHBhcmVudFxuXG5cbiAgY2xhc3MgdHlwZXMuQXJyYXkgZXh0ZW5kcyB0eXBlcy5MaXN0TWFuYWdlclxuXG4gICAgdHlwZTogXCJBcnJheVwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBlbmRcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICB0b0pzb246ICh0cmFuc2Zvcm1fdG9fdmFsdWUgPSBmYWxzZSktPlxuICAgICAgdmFsID0gQHZhbCgpXG4gICAgICBmb3IgaSwgbyBpbiB2YWxcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLk9iamVjdFxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2YgdHlwZXMuQXJyYXlcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgb1xuXG4gICAgdmFsOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKVxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICAgIHJlc3VsdCA9IFtdXG4gICAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoIG8udmFsKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHJlc3VsdFxuXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIGNvbnRlbnRcblxuICAgIGluc2VydEFmdGVyOiAobGVmdCwgY29udGVudCwgb3B0aW9ucyktPlxuICAgICAgY3JlYXRlQ29udGVudCA9IChjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNvbnN0cnVjdG9yP1xuICAgICAgICAgIHR5cGUgPSB0eXBlc1tjb250ZW50LmNvbnN0cnVjdG9yLm5hbWVdXG4gICAgICAgICAgaWYgdHlwZT8gYW5kIHR5cGUuY3JlYXRlP1xuICAgICAgICAgICAgdHlwZS5jcmVhdGUgY29udGVudCwgb3B0aW9uc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoZSAje2NvbnRlbnQuY29uc3RydWN0b3IubmFtZX0tdHlwZSBpcyBub3QgKHlldCkgc3VwcG9ydGVkIGluIFkuXCJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNvbnRlbnRcblxuICAgICAgcmlnaHQgPSBsZWZ0Lm5leHRfY2xcbiAgICAgIHdoaWxlIHJpZ2h0LmlzRGVsZXRlZCgpXG4gICAgICAgIHJpZ2h0ID0gcmlnaHQubmV4dF9jbCAjIGZpbmQgdGhlIGZpcnN0IGNoYXJhY3RlciB0byB0aGUgcmlnaHQsIHRoYXQgaXMgbm90IGRlbGV0ZWQuIEluIHRoZSBjYXNlIHRoYXQgcG9zaXRpb24gaXMgMCwgaXRzIHRoZSBEZWxpbWl0ZXIuXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxuXG4gICAgICBpZiBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgIChuZXcgdHlwZXMuVGV4dEluc2VydCBjb250ZW50LCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgIGVsc2VcbiAgICAgICAgZm9yIGMgaW4gY29udGVudFxuICAgICAgICAgIHRtcCA9IChuZXcgdHlwZXMuVGV4dEluc2VydCBjcmVhdGVDb250ZW50KGMsIG9wdGlvbnMpLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgICAgICBsZWZ0ID0gdG1wXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7QXJyYXkgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudCwgb3B0aW9ucyktPlxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBbY29udGVudF0sIG9wdGlvbnNcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge0FycmF5IFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdFxuICAgICNcbiAgICBkZWxldGU6IChwb3NpdGlvbiwgbGVuZ3RoKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zaXRpb24rMSkgIyBwb3NpdGlvbiAwIGluIHRoaXMgY2FzZSBpcyB0aGUgZGVsZXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlclxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgdHlwZXMuRGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgKG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcikpIGFuZCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBkZWxldGVfb3BzLnB1c2ggZC5fZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuQXJyYXkucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQpXG5cbiAgdHlwZXMuQXJyYXkuY3JlYXRlID0gKGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICBpZiAobXV0YWJsZSBpcyBcIm11dGFibGVcIilcbiAgICAgIGxpc3QgPSBuZXcgdHlwZXMuQXJyYXkoKS5leGVjdXRlKClcbiAgICAgIGl0aCA9IGxpc3QuZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiAwXG4gICAgICBsaXN0Lmluc2VydEFmdGVyIGl0aCwgY29udGVudFxuICAgICAgbGlzdFxuICAgIGVsc2UgaWYgKG5vdCBtdXRhYmxlPykgb3IgKG11dGFibGUgaXMgXCJpbW11dGFibGVcIilcbiAgICAgIGNvbnRlbnRcbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJTcGVjaWZ5IGVpdGhlciBcXFwibXV0YWJsZVxcXCIgb3IgXFxcImltbXV0YWJsZVxcXCIhIVwiXG5cbiAgI1xuICAjIEhhbmRsZXMgYSBTdHJpbmctbGlrZSBkYXRhIHN0cnVjdHVyZXMgd2l0aCBzdXBwb3J0IGZvciBpbnNlcnQvZGVsZXRlIGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgIyBAbm90ZSBDdXJyZW50bHksIG9ubHkgVGV4dCBpcyBzdXBwb3J0ZWQhXG4gICNcbiAgY2xhc3MgdHlwZXMuU3RyaW5nIGV4dGVuZHMgdHlwZXMuQXJyYXlcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBAdGV4dGZpZWxkcyA9IFtdXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElkZW50aWZpZXMgdGhpcyBjbGFzcy5cbiAgICAjIFVzZSBpdCB0byBjaGVjayB3aGV0aGVyIHRoaXMgaXMgYSB3b3JkLXR5cGUgb3Igc29tZXRoaW5nIGVsc2UuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHggPSB5LnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiU3RyaW5nXCIpIHtcbiAgICAjICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSh4LnRvSnNvbigpKVxuICAgICMgICB9XG4gICAgI1xuICAgIHR5cGU6IFwiU3RyaW5nXCJcblxuICAgICNcbiAgICAjIEdldCB0aGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgd29yZC5cbiAgICAjIEByZXR1cm4ge1N0cmluZ30gVGhlIFN0cmluZy1yZXByZXNlbnRhdGlvbiBvZiB0aGlzIG9iamVjdC5cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBjID0gZm9yIG8gaW4gQHRvQXJyYXkoKVxuICAgICAgICBpZiBvLnZhbD9cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBcIlwiXG4gICAgICBjLmpvaW4oJycpXG5cbiAgICAjXG4gICAgIyBTYW1lIGFzIFN0cmluZy52YWxcbiAgICAjIEBzZWUgU3RyaW5nLnZhbFxuICAgICNcbiAgICB0b1N0cmluZzogKCktPlxuICAgICAgQHZhbCgpXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGEgc3RyaW5nIGludG8gdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7QXJyYXkgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudCwgb3B0aW9ucyktPlxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50LCBvcHRpb25zXG5cbiAgICAjXG4gICAgIyBCaW5kIHRoaXMgU3RyaW5nIHRvIGEgdGV4dGZpZWxkIG9yIGlucHV0IGZpZWxkLlxuICAgICNcbiAgICAjIEBleGFtcGxlXG4gICAgIyAgIHZhciB0ZXh0Ym94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ0ZXh0ZmllbGRcIik7XG4gICAgIyAgIHkuYmluZCh0ZXh0Ym94KTtcbiAgICAjXG4gICAgYmluZDogKHRleHRmaWVsZCwgZG9tX3Jvb3QpLT5cbiAgICAgIGRvbV9yb290ID89IHdpbmRvd1xuICAgICAgaWYgKG5vdCBkb21fcm9vdC5nZXRTZWxlY3Rpb24/KVxuICAgICAgICBkb21fcm9vdCA9IHdpbmRvd1xuXG4gICAgICAjIGRvbid0IGR1cGxpY2F0ZSFcbiAgICAgIGZvciB0IGluIEB0ZXh0ZmllbGRzXG4gICAgICAgIGlmIHQgaXMgdGV4dGZpZWxkXG4gICAgICAgICAgcmV0dXJuXG4gICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2U7XG5cbiAgICAgIHdvcmQgPSBAXG4gICAgICB0ZXh0ZmllbGQudmFsdWUgPSBAdmFsKClcbiAgICAgIEB0ZXh0ZmllbGRzLnB1c2ggdGV4dGZpZWxkXG5cbiAgICAgIGlmIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydD8gYW5kIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZT9cbiAgICAgICAgY3JlYXRlUmFuZ2UgPSAoZml4KS0+XG4gICAgICAgICAgbGVmdCA9IHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydFxuICAgICAgICAgIHJpZ2h0ID0gdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICAgIGlmIGZpeD9cbiAgICAgICAgICAgIGxlZnQgPSBmaXggbGVmdFxuICAgICAgICAgICAgcmlnaHQgPSBmaXggcmlnaHRcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsZWZ0OiBsZWZ0XG4gICAgICAgICAgICByaWdodDogcmlnaHRcbiAgICAgICAgICB9XG5cbiAgICAgICAgd3JpdGVSYW5nZSA9IChyYW5nZSktPlxuICAgICAgICAgIHdyaXRlQ29udGVudCB3b3JkLnZhbCgpXG4gICAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0XG5cbiAgICAgICAgd3JpdGVDb250ZW50ID0gKGNvbnRlbnQpLT5cbiAgICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIGNyZWF0ZVJhbmdlID0gKGZpeCktPlxuICAgICAgICAgIHJhbmdlID0ge31cbiAgICAgICAgICBzID0gZG9tX3Jvb3QuZ2V0U2VsZWN0aW9uKClcbiAgICAgICAgICBjbGVuZ3RoID0gdGV4dGZpZWxkLnRleHRDb250ZW50Lmxlbmd0aFxuICAgICAgICAgIHJhbmdlLmxlZnQgPSBNYXRoLm1pbiBzLmFuY2hvck9mZnNldCwgY2xlbmd0aFxuICAgICAgICAgIHJhbmdlLnJpZ2h0ID0gTWF0aC5taW4gcy5mb2N1c09mZnNldCwgY2xlbmd0aFxuICAgICAgICAgIGlmIGZpeD9cbiAgICAgICAgICAgIHJhbmdlLmxlZnQgPSBmaXggcmFuZ2UubGVmdFxuICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSBmaXggcmFuZ2UucmlnaHRcblxuICAgICAgICAgIGVkaXRlZF9lbGVtZW50ID0gcy5mb2N1c05vZGVcbiAgICAgICAgICBpZiBlZGl0ZWRfZWxlbWVudCBpcyB0ZXh0ZmllbGQgb3IgZWRpdGVkX2VsZW1lbnQgaXMgdGV4dGZpZWxkLmNoaWxkTm9kZXNbMF1cbiAgICAgICAgICAgIHJhbmdlLmlzUmVhbCA9IHRydWVcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByYW5nZS5pc1JlYWwgPSBmYWxzZVxuICAgICAgICAgIHJhbmdlXG5cbiAgICAgICAgd3JpdGVSYW5nZSA9IChyYW5nZSktPlxuICAgICAgICAgIHdyaXRlQ29udGVudCB3b3JkLnZhbCgpXG4gICAgICAgICAgdGV4dG5vZGUgPSB0ZXh0ZmllbGQuY2hpbGROb2Rlc1swXVxuICAgICAgICAgIGlmIHJhbmdlLmlzUmVhbCBhbmQgdGV4dG5vZGU/XG4gICAgICAgICAgICBpZiByYW5nZS5sZWZ0IDwgMFxuICAgICAgICAgICAgICByYW5nZS5sZWZ0ID0gMFxuICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSBNYXRoLm1heCByYW5nZS5sZWZ0LCByYW5nZS5yaWdodFxuICAgICAgICAgICAgaWYgcmFuZ2UucmlnaHQgPiB0ZXh0bm9kZS5sZW5ndGhcbiAgICAgICAgICAgICAgcmFuZ2UucmlnaHQgPSB0ZXh0bm9kZS5sZW5ndGhcbiAgICAgICAgICAgIHJhbmdlLmxlZnQgPSBNYXRoLm1pbiByYW5nZS5sZWZ0LCByYW5nZS5yaWdodFxuICAgICAgICAgICAgciA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKClcbiAgICAgICAgICAgIHIuc2V0U3RhcnQodGV4dG5vZGUsIHJhbmdlLmxlZnQpXG4gICAgICAgICAgICByLnNldEVuZCh0ZXh0bm9kZSwgcmFuZ2UucmlnaHQpXG4gICAgICAgICAgICBzID0gd2luZG93LmdldFNlbGVjdGlvbigpXG4gICAgICAgICAgICBzLnJlbW92ZUFsbFJhbmdlcygpXG4gICAgICAgICAgICBzLmFkZFJhbmdlKHIpXG4gICAgICAgIHdyaXRlQ29udGVudCA9IChjb250ZW50KS0+XG4gICAgICAgICAgY29udGVudF9hcnJheSA9IGNvbnRlbnQucmVwbGFjZShuZXcgUmVnRXhwKFwiXFxuXCIsJ2cnKSxcIiBcIikuc3BsaXQoXCIgXCIpXG4gICAgICAgICAgdGV4dGZpZWxkLmlubmVyVGV4dCA9IFwiXCJcbiAgICAgICAgICBmb3IgYywgaSBpbiBjb250ZW50X2FycmF5XG4gICAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJUZXh0ICs9IGNcbiAgICAgICAgICAgIGlmIGkgaXNudCBjb250ZW50X2FycmF5Lmxlbmd0aC0xXG4gICAgICAgICAgICAgIHRleHRmaWVsZC5pbm5lckhUTUwgKz0gJyZuYnNwOydcblxuICAgICAgd3JpdGVDb250ZW50IHRoaXMudmFsKClcblxuICAgICAgQG9ic2VydmUgKGV2ZW50cyktPlxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgaWYgbm90IGNyZWF0b3JfdG9rZW5cbiAgICAgICAgICAgIGlmIGV2ZW50LnR5cGUgaXMgXCJpbnNlcnRcIlxuICAgICAgICAgICAgICBvX3BvcyA9IGV2ZW50LnBvc2l0aW9uXG4gICAgICAgICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICAgICAgICBpZiBjdXJzb3IgPD0gb19wb3NcbiAgICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIGN1cnNvciArPSAxXG4gICAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgICAgciA9IGNyZWF0ZVJhbmdlIGZpeFxuICAgICAgICAgICAgICB3cml0ZVJhbmdlIHJcblxuICAgICAgICAgICAgZWxzZSBpZiBldmVudC50eXBlIGlzIFwiZGVsZXRlXCJcbiAgICAgICAgICAgICAgb19wb3MgPSBldmVudC5wb3NpdGlvblxuICAgICAgICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgICAgICAgaWYgY3Vyc29yIDwgb19wb3NcbiAgICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgIGN1cnNvciAtPSAxXG4gICAgICAgICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICAgICAgciA9IGNyZWF0ZVJhbmdlIGZpeFxuICAgICAgICAgICAgICB3cml0ZVJhbmdlIHJcblxuICAgICAgIyBjb25zdW1lIGFsbCB0ZXh0LWluc2VydCBjaGFuZ2VzLlxuICAgICAgdGV4dGZpZWxkLm9ua2V5cHJlc3MgPSAoZXZlbnQpLT5cbiAgICAgICAgaWYgd29yZC5pc19kZWxldGVkXG4gICAgICAgICAgIyBpZiB3b3JkIGlzIGRlbGV0ZWQsIGRvIG5vdCBkbyBhbnl0aGluZyBldmVyIGFnYWluXG4gICAgICAgICAgdGV4dGZpZWxkLm9ua2V5cHJlc3MgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgY3JlYXRvcl90b2tlbiA9IHRydWVcbiAgICAgICAgY2hhciA9IG51bGxcbiAgICAgICAgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgIGNoYXIgPSAnXFxuJ1xuICAgICAgICBlbHNlIGlmIGV2ZW50LmtleT9cbiAgICAgICAgICBpZiBldmVudC5jaGFyQ29kZSBpcyAzMlxuICAgICAgICAgICAgY2hhciA9IFwiIFwiXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IHdpbmRvdy5TdHJpbmcuZnJvbUNoYXJDb2RlIGV2ZW50LmtleUNvZGVcbiAgICAgICAgaWYgY2hhci5sZW5ndGggPiAxXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZWxzZSBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICByID0gY3JlYXRlUmFuZ2UoKVxuICAgICAgICAgIHBvcyA9IE1hdGgubWluIHIubGVmdCwgci5yaWdodFxuICAgICAgICAgIGRpZmYgPSBNYXRoLmFicyhyLnJpZ2h0IC0gci5sZWZ0KVxuICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgIHdvcmQuaW5zZXJ0IHBvcywgY2hhclxuICAgICAgICAgIHIubGVmdCA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgci5yaWdodCA9IHIubGVmdFxuICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25jdXQgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAjXG4gICAgICAjIGNvbnN1bWUgZGVsZXRlcy4gTm90ZSB0aGF0XG4gICAgICAjICAgY2hyb21lOiB3b24ndCBjb25zdW1lIGRlbGV0aW9ucyBvbiBrZXlwcmVzcyBldmVudC5cbiAgICAgICMgICBrZXlDb2RlIGlzIGRlcHJlY2F0ZWQuIEJVVDogSSBkb24ndCBzZWUgYW5vdGhlciB3YXkuXG4gICAgICAjICAgICBzaW5jZSBldmVudC5rZXkgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IHZlcnNpb24gb2YgY2hyb21lLlxuICAgICAgIyAgICAgRXZlcnkgYnJvd3NlciBzdXBwb3J0cyBrZXlDb2RlLiBMZXQncyBzdGljayB3aXRoIGl0IGZvciBub3cuLlxuICAgICAgI1xuICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IChldmVudCktPlxuICAgICAgICBjcmVhdG9yX3Rva2VuID0gdHJ1ZVxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIHIgPSBjcmVhdGVSYW5nZSgpXG4gICAgICAgIHBvcyA9IE1hdGgubWluKHIubGVmdCwgci5yaWdodCwgd29yZC52YWwoKS5sZW5ndGgpXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyhyLmxlZnQgLSByLnJpZ2h0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgICAgci5sZWZ0ID0gcG9zXG4gICAgICAgICAgICByLnJpZ2h0ID0gcG9zXG4gICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB3b3JkLnZhbCgpXG4gICAgICAgICAgICAgIG5ld19wb3MgPSBwb3NcbiAgICAgICAgICAgICAgZGVsX2xlbmd0aCA9IDBcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3aGlsZSBuZXdfcG9zID4gMCBhbmQgdmFsW25ld19wb3NdIGlzbnQgXCIgXCIgYW5kIHZhbFtuZXdfcG9zXSBpc250ICdcXG4nXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlIG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgci5sZWZ0ID0gbmV3X3Bvc1xuICAgICAgICAgICAgICByLnJpZ2h0ID0gbmV3X3Bvc1xuICAgICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIHdvcmQuZGVsZXRlIChwb3MtMSksIDFcbiAgICAgICAgICAgICAgICByLmxlZnQgPSBwb3MtMVxuICAgICAgICAgICAgICAgIHIucmlnaHQgPSBwb3MtMVxuICAgICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZSBwb3MsIGRpZmZcbiAgICAgICAgICAgIHIubGVmdCA9IHBvc1xuICAgICAgICAgICAgci5yaWdodCA9IHBvc1xuICAgICAgICAgICAgd3JpdGVSYW5nZSByXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGUgcG9zLCAxXG4gICAgICAgICAgICByLmxlZnQgPSBwb3NcbiAgICAgICAgICAgIHIucmlnaHQgPSBwb3NcbiAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNyZWF0b3JfdG9rZW4gPSBmYWxzZVxuICAgICAgICAgIHRydWVcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuU3RyaW5nLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkKVxuXG4gIHR5cGVzLlN0cmluZy5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgd29yZCA9IG5ldyB0eXBlcy5TdHJpbmcoKS5leGVjdXRlKClcbiAgICAgIHdvcmQuaW5zZXJ0IDAsIGNvbnRlbnRcbiAgICAgIHdvcmRcbiAgICBlbHNlIGlmIChub3QgbXV0YWJsZT8pIG9yIChtdXRhYmxlIGlzIFwiaW1tdXRhYmxlXCIpXG4gICAgICBjb250ZW50XG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiU3BlY2lmeSBlaXRoZXIgXFxcIm11dGFibGVcXFwiIG9yIFxcXCJpbW11dGFibGVcXFwiISFcIlxuXG5cbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVHlwZXMvSnNvblR5cGVzXCJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuL0VuZ2luZVwiXG5hZGFwdENvbm5lY3RvciA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckFkYXB0ZXJcIlxuXG5jcmVhdGVZID0gKGNvbm5lY3RvciktPlxuICB1c2VyX2lkID0gbnVsbFxuICBpZiBjb25uZWN0b3IudXNlcl9pZD9cbiAgICB1c2VyX2lkID0gY29ubmVjdG9yLnVzZXJfaWQgIyBUT0RPOiBjaGFuZ2UgdG8gZ2V0VW5pcXVlSWQoKVxuICBlbHNlXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxuICAgIGNvbm5lY3Rvci5vbl91c2VyX2lkX3NldCA9IChpZCktPlxuICAgICAgdXNlcl9pZCA9IGlkXG4gICAgICBIQi5yZXNldFVzZXJJZCBpZFxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgdHlwZV9tYW5hZ2VyID0ganNvbl90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdHlwZV9tYW5hZ2VyLnR5cGVzXG5cbiAgI1xuICAjIEZyYW1ld29yayBmb3IgSnNvbiBkYXRhLXN0cnVjdHVyZXMuXG4gICMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiAgIyAqIFN0cmluZ1xuICAjICogSW50ZWdlclxuICAjICogQXJyYXlcbiAgI1xuICBjbGFzcyBZIGV4dGVuZHMgdHlwZXMuT2JqZWN0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gdXNlcl9pZCBVbmlxdWUgaWQgb2YgdGhlIHBlZXIuXG4gICAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIHRoZSBjb25uZWN0b3IgY2xhc3MuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoKS0+XG4gICAgICBAY29ubmVjdG9yID0gY29ubmVjdG9yXG4gICAgICBASEIgPSBIQlxuICAgICAgQHR5cGVzID0gdHlwZXNcbiAgICAgIEBlbmdpbmUgPSBuZXcgRW5naW5lIEBIQiwgdHlwZV9tYW5hZ2VyLnR5cGVzXG4gICAgICBhZGFwdENvbm5lY3RvciBAY29ubmVjdG9yLCBAZW5naW5lLCBASEIsIHR5cGVfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcbiAgICAgIHN1cGVyXG5cbiAgICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3JcblxuICByZXR1cm4gbmV3IFkoSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcbmlmIHdpbmRvdz8gYW5kIG5vdCB3aW5kb3cuWT9cbiAgd2luZG93LlkgPSBjcmVhdGVZXG4iXX0=
