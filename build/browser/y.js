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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9PcGVyYXRpb25zL0Jhc2ljLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL09wZXJhdGlvbnMvU3RydWN0dXJlZC5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9UeXBlcy9PYmplY3QuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIveS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNDQSxJQUFBLDhCQUFBOztBQUFBLGNBQUEsR0FBaUIsT0FBQSxDQUFRLGtCQUFSLENBQWpCLENBQUE7O0FBQUEsY0FNQSxHQUFpQixTQUFDLFNBQUQsRUFBWSxNQUFaLEVBQW9CLEVBQXBCLEVBQXdCLGtCQUF4QixHQUFBO0FBRWYsTUFBQSx1RkFBQTtBQUFBLE9BQUEsc0JBQUE7NkJBQUE7QUFDRSxJQUFBLFNBQVUsQ0FBQSxJQUFBLENBQVYsR0FBa0IsQ0FBbEIsQ0FERjtBQUFBLEdBQUE7QUFBQSxFQUdBLFNBQVMsQ0FBQyxhQUFWLENBQUEsQ0FIQSxDQUFBO0FBQUEsRUFLQSxLQUFBLEdBQVEsU0FBQyxDQUFELEdBQUE7QUFDTixJQUFBLElBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU4sS0FBaUIsRUFBRSxDQUFDLFNBQUgsQ0FBQSxDQUFsQixDQUFBLElBQ0MsQ0FBQyxNQUFBLENBQUEsQ0FBUSxDQUFDLEdBQUcsQ0FBQyxTQUFiLEtBQTRCLFFBQTdCLENBREQsSUFFQyxDQUFDLEVBQUUsQ0FBQyxTQUFILENBQUEsQ0FBQSxLQUFvQixPQUFyQixDQUZKO2FBR0UsU0FBUyxDQUFDLFNBQVYsQ0FBb0IsQ0FBcEIsRUFIRjtLQURNO0VBQUEsQ0FMUixDQUFBO0FBV0EsRUFBQSxJQUFHLDRCQUFIO0FBQ0UsSUFBQSxFQUFFLENBQUMsb0JBQUgsQ0FBd0IsU0FBUyxDQUFDLFVBQWxDLENBQUEsQ0FERjtHQVhBO0FBQUEsRUFjQSxrQkFBa0IsQ0FBQyxJQUFuQixDQUF3QixLQUF4QixDQWRBLENBQUE7QUFBQSxFQWlCQSxtQkFBQSxHQUFzQixTQUFDLENBQUQsR0FBQTtBQUNwQixRQUFBLGVBQUE7QUFBQTtTQUFBLFNBQUE7c0JBQUE7QUFDRSxvQkFBQTtBQUFBLFFBQUEsSUFBQSxFQUFNLElBQU47QUFBQSxRQUNBLEtBQUEsRUFBTyxLQURQO1FBQUEsQ0FERjtBQUFBO29CQURvQjtFQUFBLENBakJ0QixDQUFBO0FBQUEsRUFxQkEsa0JBQUEsR0FBcUIsU0FBQyxDQUFELEdBQUE7QUFDbkIsUUFBQSx5QkFBQTtBQUFBLElBQUEsWUFBQSxHQUFlLEVBQWYsQ0FBQTtBQUNBLFNBQUEsd0NBQUE7Z0JBQUE7QUFDRSxNQUFBLFlBQWEsQ0FBQSxDQUFDLENBQUMsSUFBRixDQUFiLEdBQXVCLENBQUMsQ0FBQyxLQUF6QixDQURGO0FBQUEsS0FEQTtXQUdBLGFBSm1CO0VBQUEsQ0FyQnJCLENBQUE7QUFBQSxFQTJCQSxjQUFBLEdBQWlCLFNBQUEsR0FBQTtXQUNmLG1CQUFBLENBQW9CLEVBQUUsQ0FBQyxtQkFBSCxDQUFBLENBQXBCLEVBRGU7RUFBQSxDQTNCakIsQ0FBQTtBQUFBLEVBOEJBLEtBQUEsR0FBUSxTQUFDLENBQUQsR0FBQTtBQUNOLFFBQUEsc0JBQUE7QUFBQSxJQUFBLFlBQUEsR0FBZSxrQkFBQSxDQUFtQixDQUFuQixDQUFmLENBQUE7QUFBQSxJQUNBLEVBQUEsR0FBSyxFQUFFLENBQUMsT0FBSCxDQUFXLFlBQVgsQ0FETCxDQUFBO0FBQUEsSUFFQSxJQUFBLEdBQ0U7QUFBQSxNQUFBLEVBQUEsRUFBSSxFQUFKO0FBQUEsTUFDQSxZQUFBLEVBQWMsbUJBQUEsQ0FBb0IsRUFBRSxDQUFDLG1CQUFILENBQUEsQ0FBcEIsQ0FEZDtLQUhGLENBQUE7V0FLQSxLQU5NO0VBQUEsQ0E5QlIsQ0FBQTtBQUFBLEVBc0NBLE9BQUEsR0FBVSxTQUFDLEVBQUQsRUFBSyxNQUFMLEdBQUE7V0FDUixNQUFNLENBQUMsT0FBUCxDQUFlLEVBQWYsRUFBbUIsTUFBbkIsRUFEUTtFQUFBLENBdENWLENBQUE7QUFBQSxFQXlDQSxTQUFTLENBQUMsY0FBVixHQUEyQixjQXpDM0IsQ0FBQTtBQUFBLEVBMENBLFNBQVMsQ0FBQyxLQUFWLEdBQWtCLEtBMUNsQixDQUFBO0FBQUEsRUEyQ0EsU0FBUyxDQUFDLE9BQVYsR0FBb0IsT0EzQ3BCLENBQUE7O0lBNkNBLFNBQVMsQ0FBQyxtQkFBb0I7R0E3QzlCO1NBOENBLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUEzQixDQUFnQyxTQUFDLE1BQUQsRUFBUyxFQUFULEdBQUE7QUFDOUIsSUFBQSxJQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBUCxLQUFvQixFQUFFLENBQUMsU0FBSCxDQUFBLENBQXZCO2FBQ0UsTUFBTSxDQUFDLE9BQVAsQ0FBZSxFQUFmLEVBREY7S0FEOEI7RUFBQSxDQUFoQyxFQWhEZTtBQUFBLENBTmpCLENBQUE7O0FBQUEsTUEyRE0sQ0FBQyxPQUFQLEdBQWlCLGNBM0RqQixDQUFBOzs7O0FDQUEsTUFBTSxDQUFDLE9BQVAsR0FRRTtBQUFBLEVBQUEsSUFBQSxFQUFNLFNBQUMsT0FBRCxHQUFBO0FBQ0osUUFBQSxHQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUMsSUFBRCxFQUFPLE9BQVAsR0FBQTtBQUNKLFFBQUEsSUFBRyxxQkFBSDtBQUNFLFVBQUEsSUFBRyxDQUFLLGVBQUwsQ0FBQSxJQUFrQixPQUFPLENBQUMsSUFBUixDQUFhLFNBQUMsQ0FBRCxHQUFBO21CQUFLLENBQUEsS0FBSyxPQUFRLENBQUEsSUFBQSxFQUFsQjtVQUFBLENBQWIsQ0FBckI7bUJBQ0UsS0FBRSxDQUFBLElBQUEsQ0FBRixHQUFVLE9BQVEsQ0FBQSxJQUFBLEVBRHBCO1dBQUEsTUFBQTtBQUdFLGtCQUFVLElBQUEsS0FBQSxDQUFNLG1CQUFBLEdBQW9CLElBQXBCLEdBQXlCLDRDQUF6QixHQUFzRSxJQUFJLENBQUMsTUFBTCxDQUFZLE9BQVosQ0FBNUUsQ0FBVixDQUhGO1dBREY7U0FBQSxNQUFBO0FBTUUsZ0JBQVUsSUFBQSxLQUFBLENBQU0sbUJBQUEsR0FBb0IsSUFBcEIsR0FBeUIsb0NBQS9CLENBQVYsQ0FORjtTQURJO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBTixDQUFBO0FBQUEsSUFTQSxHQUFBLENBQUksWUFBSixFQUFrQixDQUFDLFNBQUQsRUFBWSxjQUFaLENBQWxCLENBVEEsQ0FBQTtBQUFBLElBVUEsR0FBQSxDQUFJLE1BQUosRUFBWSxDQUFDLFFBQUQsRUFBVyxPQUFYLENBQVosQ0FWQSxDQUFBO0FBQUEsSUFXQSxHQUFBLENBQUksU0FBSixDQVhBLENBQUE7O01BWUEsSUFBQyxDQUFBLGVBQWdCLElBQUMsQ0FBQTtLQVpsQjtBQWdCQSxJQUFBLElBQUcsa0NBQUg7QUFDRSxNQUFBLElBQUMsQ0FBQSxrQkFBRCxHQUFzQixPQUFPLENBQUMsa0JBQTlCLENBREY7S0FBQSxNQUFBO0FBR0UsTUFBQSxJQUFDLENBQUEsa0JBQUQsR0FBc0IsSUFBdEIsQ0FIRjtLQWhCQTtBQXNCQSxJQUFBLElBQUcsSUFBQyxDQUFBLElBQUQsS0FBUyxRQUFaO0FBQ0UsTUFBQSxJQUFDLENBQUEsVUFBRCxHQUFjLFNBQWQsQ0FERjtLQXRCQTtBQUFBLElBMEJBLElBQUMsQ0FBQSxTQUFELEdBQWEsS0ExQmIsQ0FBQTtBQUFBLElBNEJBLElBQUMsQ0FBQSxXQUFELEdBQWUsRUE1QmYsQ0FBQTs7TUE4QkEsSUFBQyxDQUFBLG1CQUFvQjtLQTlCckI7QUFBQSxJQWlDQSxJQUFDLENBQUEsV0FBRCxHQUFlLEVBakNmLENBQUE7QUFBQSxJQWtDQSxJQUFDLENBQUEsbUJBQUQsR0FBdUIsSUFsQ3ZCLENBQUE7QUFBQSxJQW1DQSxJQUFDLENBQUEsb0JBQUQsR0FBd0IsS0FuQ3hCLENBQUE7V0FvQ0EsSUFBQyxDQUFBLGNBQUQsR0FBa0IsS0FyQ2Q7RUFBQSxDQUFOO0FBQUEsRUF1Q0EsWUFBQSxFQUFjLFNBQUEsR0FBQTtXQUNaLElBQUMsQ0FBQSxJQUFELEtBQVMsU0FERztFQUFBLENBdkNkO0FBQUEsRUEwQ0EsV0FBQSxFQUFhLFNBQUEsR0FBQTtXQUNYLElBQUMsQ0FBQSxJQUFELEtBQVMsUUFERTtFQUFBLENBMUNiO0FBQUEsRUE2Q0EsaUJBQUEsRUFBbUIsU0FBQSxHQUFBO0FBQ2pCLFFBQUEsYUFBQTtBQUFBLElBQUEsSUFBQyxDQUFBLG1CQUFELEdBQXVCLElBQXZCLENBQUE7QUFDQSxJQUFBLElBQUcsSUFBQyxDQUFBLFVBQUQsS0FBZSxTQUFsQjtBQUNFO0FBQUEsV0FBQSxZQUFBO3VCQUFBO0FBQ0UsUUFBQSxJQUFHLENBQUEsQ0FBSyxDQUFDLFNBQVQ7QUFDRSxVQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsSUFBYixDQUFBLENBQUE7QUFDQSxnQkFGRjtTQURGO0FBQUEsT0FERjtLQURBO0FBTUEsSUFBQSxJQUFPLGdDQUFQO0FBQ0UsTUFBQSxJQUFDLENBQUEsY0FBRCxDQUFBLENBQUEsQ0FERjtLQU5BO1dBUUEsS0FUaUI7RUFBQSxDQTdDbkI7QUFBQSxFQXdEQSxRQUFBLEVBQVUsU0FBQyxJQUFELEdBQUE7QUFDUixJQUFBLE1BQUEsQ0FBQSxJQUFRLENBQUEsV0FBWSxDQUFBLElBQUEsQ0FBcEIsQ0FBQTtXQUNBLElBQUMsQ0FBQSxpQkFBRCxDQUFBLEVBRlE7RUFBQSxDQXhEVjtBQUFBLEVBNERBLFVBQUEsRUFBWSxTQUFDLElBQUQsRUFBTyxJQUFQLEdBQUE7QUFDVixRQUFBLEtBQUE7QUFBQSxJQUFBLElBQU8sWUFBUDtBQUNFLFlBQVUsSUFBQSxLQUFBLENBQU0sNkZBQU4sQ0FBVixDQURGO0tBQUE7O1dBR2EsQ0FBQSxJQUFBLElBQVM7S0FIdEI7QUFBQSxJQUlBLElBQUMsQ0FBQSxXQUFZLENBQUEsSUFBQSxDQUFLLENBQUMsU0FBbkIsR0FBK0IsS0FKL0IsQ0FBQTtBQU1BLElBQUEsSUFBRyxDQUFDLENBQUEsSUFBSyxDQUFBLFNBQU4sQ0FBQSxJQUFvQixJQUFDLENBQUEsVUFBRCxLQUFlLFNBQXRDO0FBQ0UsTUFBQSxJQUFHLElBQUMsQ0FBQSxVQUFELEtBQWUsU0FBbEI7ZUFDRSxJQUFDLENBQUEsV0FBRCxDQUFhLElBQWIsRUFERjtPQUFBLE1BRUssSUFBRyxJQUFBLEtBQVEsUUFBWDtlQUVILElBQUMsQ0FBQSxxQkFBRCxDQUF1QixJQUF2QixFQUZHO09BSFA7S0FQVTtFQUFBLENBNURaO0FBQUEsRUErRUEsVUFBQSxFQUFZLFNBQUMsSUFBRCxHQUFBO0FBQ1YsSUFBQSxJQUFHLElBQUksQ0FBQyxZQUFMLEtBQXFCLFFBQXhCO0FBQ0UsTUFBQSxJQUFBLEdBQU8sQ0FBQyxJQUFELENBQVAsQ0FERjtLQUFBO0FBRUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxTQUFKO2FBQ0UsSUFBSyxDQUFBLENBQUEsQ0FBRSxDQUFDLEtBQVIsQ0FBYyxJQUFkLEVBQW9CLElBQUssU0FBekIsRUFERjtLQUFBLE1BQUE7O1FBR0UsSUFBQyxDQUFBLHNCQUF1QjtPQUF4QjthQUNBLElBQUMsQ0FBQSxtQkFBbUIsQ0FBQyxJQUFyQixDQUEwQixJQUExQixFQUpGO0tBSFU7RUFBQSxDQS9FWjtBQUFBLEVBNEZBLFNBQUEsRUFBVyxTQUFDLENBQUQsR0FBQTtXQUNULElBQUMsQ0FBQSxnQkFBZ0IsQ0FBQyxJQUFsQixDQUF1QixDQUF2QixFQURTO0VBQUEsQ0E1Rlg7QUErRkE7QUFBQTs7Ozs7Ozs7Ozs7O0tBL0ZBO0FBQUEsRUFnSEEsV0FBQSxFQUFhLFNBQUMsSUFBRCxHQUFBO0FBQ1gsUUFBQSxvQkFBQTtBQUFBLElBQUEsSUFBTyxnQ0FBUDtBQUNFLE1BQUEsSUFBQyxDQUFBLG1CQUFELEdBQXVCLElBQXZCLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxJQUFELENBQU0sSUFBTixFQUNFO0FBQUEsUUFBQSxTQUFBLEVBQVcsT0FBWDtBQUFBLFFBQ0EsVUFBQSxFQUFZLE1BRFo7QUFBQSxRQUVBLElBQUEsRUFBTSxFQUZOO09BREYsQ0FEQSxDQUFBO0FBS0EsTUFBQSxJQUFHLENBQUEsSUFBSyxDQUFBLG9CQUFSO0FBQ0UsUUFBQSxJQUFDLENBQUEsb0JBQUQsR0FBd0IsSUFBeEIsQ0FBQTtBQUFBLFFBRUEsRUFBQSxHQUFLLElBQUMsQ0FBQSxLQUFELENBQU8sRUFBUCxDQUFVLENBQUMsRUFGaEIsQ0FBQTtBQUFBLFFBR0EsR0FBQSxHQUFNLEVBSE4sQ0FBQTtBQUlBLGFBQUEseUNBQUE7cUJBQUE7QUFDRSxVQUFBLEdBQUcsQ0FBQyxJQUFKLENBQVMsQ0FBVCxDQUFBLENBQUE7QUFDQSxVQUFBLElBQUcsR0FBRyxDQUFDLE1BQUosR0FBYSxFQUFoQjtBQUNFLFlBQUEsSUFBQyxDQUFBLFNBQUQsQ0FDRTtBQUFBLGNBQUEsU0FBQSxFQUFXLFVBQVg7QUFBQSxjQUNBLElBQUEsRUFBTSxHQUROO2FBREYsQ0FBQSxDQUFBO0FBQUEsWUFHQSxHQUFBLEdBQU0sRUFITixDQURGO1dBRkY7QUFBQSxTQUpBO2VBV0EsSUFBQyxDQUFBLFNBQUQsQ0FDRTtBQUFBLFVBQUEsU0FBQSxFQUFXLFNBQVg7QUFBQSxVQUNBLElBQUEsRUFBTSxHQUROO1NBREYsRUFaRjtPQU5GO0tBRFc7RUFBQSxDQWhIYjtBQUFBLEVBNklBLHFCQUFBLEVBQXVCLFNBQUMsSUFBRCxHQUFBO0FBQ3JCLFFBQUEsb0JBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxtQkFBRCxHQUF1QixJQUF2QixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsSUFBRCxDQUFNLElBQU4sRUFDRTtBQUFBLE1BQUEsU0FBQSxFQUFXLE9BQVg7QUFBQSxNQUNBLFVBQUEsRUFBWSxNQURaO0FBQUEsTUFFQSxJQUFBLEVBQU0sRUFGTjtLQURGLENBREEsQ0FBQTtBQUFBLElBS0EsRUFBQSxHQUFLLElBQUMsQ0FBQSxLQUFELENBQU8sRUFBUCxDQUFVLENBQUMsRUFMaEIsQ0FBQTtBQUFBLElBTUEsR0FBQSxHQUFNLEVBTk4sQ0FBQTtBQU9BLFNBQUEseUNBQUE7aUJBQUE7QUFDRSxNQUFBLEdBQUcsQ0FBQyxJQUFKLENBQVMsQ0FBVCxDQUFBLENBQUE7QUFDQSxNQUFBLElBQUcsR0FBRyxDQUFDLE1BQUosR0FBYSxFQUFoQjtBQUNFLFFBQUEsSUFBQyxDQUFBLFNBQUQsQ0FDRTtBQUFBLFVBQUEsU0FBQSxFQUFXLFVBQVg7QUFBQSxVQUNBLElBQUEsRUFBTSxHQUROO1NBREYsQ0FBQSxDQUFBO0FBQUEsUUFHQSxHQUFBLEdBQU0sRUFITixDQURGO09BRkY7QUFBQSxLQVBBO1dBY0EsSUFBQyxDQUFBLFNBQUQsQ0FDRTtBQUFBLE1BQUEsU0FBQSxFQUFXLFNBQVg7QUFBQSxNQUNBLElBQUEsRUFBTSxHQUROO0tBREYsRUFmcUI7RUFBQSxDQTdJdkI7QUFBQSxFQW1LQSxjQUFBLEVBQWdCLFNBQUEsR0FBQTtBQUNkLFFBQUEsaUJBQUE7QUFBQSxJQUFBLElBQUcsQ0FBQSxJQUFLLENBQUEsU0FBUjtBQUNFLE1BQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxJQUFiLENBQUE7QUFDQSxNQUFBLElBQUcsZ0NBQUg7QUFDRTtBQUFBLGFBQUEsMkNBQUE7dUJBQUE7QUFDRSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBREY7QUFBQSxTQUFBO0FBQUEsUUFFQSxNQUFBLENBQUEsSUFBUSxDQUFBLG1CQUZSLENBREY7T0FEQTthQUtBLEtBTkY7S0FEYztFQUFBLENBbktoQjtBQUFBLEVBK0tBLGNBQUEsRUFBZ0IsU0FBQyxNQUFELEVBQVMsR0FBVCxHQUFBO0FBQ2QsUUFBQSxpRkFBQTtBQUFBLElBQUEsSUFBTyxxQkFBUDtBQUNFO0FBQUE7V0FBQSwyQ0FBQTtxQkFBQTtBQUNFLHNCQUFBLENBQUEsQ0FBRSxNQUFGLEVBQVUsR0FBVixFQUFBLENBREY7QUFBQTtzQkFERjtLQUFBLE1BQUE7QUFJRSxNQUFBLElBQUcsTUFBQSxLQUFVLElBQUMsQ0FBQSxPQUFkO0FBQ0UsY0FBQSxDQURGO09BQUE7QUFFQSxNQUFBLElBQUcsR0FBRyxDQUFDLFNBQUosS0FBaUIsT0FBcEI7QUFDRSxRQUFBLElBQUEsR0FBTyxJQUFDLENBQUEsS0FBRCxDQUFPLEdBQUcsQ0FBQyxJQUFYLENBQVAsQ0FBQTtBQUFBLFFBQ0EsRUFBQSxHQUFLLElBQUksQ0FBQyxFQURWLENBQUE7QUFBQSxRQUVBLEdBQUEsR0FBTSxFQUZOLENBQUE7QUFRQSxRQUFBLElBQUcsSUFBQyxDQUFBLFNBQUo7QUFDRSxVQUFBLFdBQUEsR0FBYyxDQUFBLFNBQUEsS0FBQSxHQUFBO21CQUFBLFNBQUMsQ0FBRCxHQUFBO3FCQUNaLEtBQUMsQ0FBQSxJQUFELENBQU0sTUFBTixFQUFjLENBQWQsRUFEWTtZQUFBLEVBQUE7VUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWQsQ0FERjtTQUFBLE1BQUE7QUFJRSxVQUFBLFdBQUEsR0FBYyxDQUFBLFNBQUEsS0FBQSxHQUFBO21CQUFBLFNBQUMsQ0FBRCxHQUFBO3FCQUNaLEtBQUMsQ0FBQSxTQUFELENBQVcsQ0FBWCxFQURZO1lBQUEsRUFBQTtVQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBZCxDQUpGO1NBUkE7QUFlQSxhQUFBLDJDQUFBO3FCQUFBO0FBQ0UsVUFBQSxHQUFHLENBQUMsSUFBSixDQUFTLENBQVQsQ0FBQSxDQUFBO0FBQ0EsVUFBQSxJQUFHLEdBQUcsQ0FBQyxNQUFKLEdBQWEsRUFBaEI7QUFDRSxZQUFBLFdBQUEsQ0FDRTtBQUFBLGNBQUEsU0FBQSxFQUFXLFVBQVg7QUFBQSxjQUNBLElBQUEsRUFBTSxHQUROO2FBREYsQ0FBQSxDQUFBO0FBQUEsWUFHQSxHQUFBLEdBQU0sRUFITixDQURGO1dBRkY7QUFBQSxTQWZBO0FBQUEsUUF1QkEsV0FBQSxDQUNFO0FBQUEsVUFBQSxTQUFBLEVBQVksU0FBWjtBQUFBLFVBQ0EsSUFBQSxFQUFNLEdBRE47U0FERixDQXZCQSxDQUFBO0FBMkJBLFFBQUEsSUFBRyx3QkFBQSxJQUFvQixJQUFDLENBQUEsa0JBQXhCO0FBQ0UsVUFBQSxVQUFBLEdBQWdCLENBQUEsU0FBQSxLQUFBLEdBQUE7bUJBQUEsU0FBQyxFQUFELEdBQUE7cUJBQ2QsU0FBQSxHQUFBO0FBQ0UsZ0JBQUEsRUFBQSxHQUFLLEtBQUMsQ0FBQSxLQUFELENBQU8sRUFBUCxDQUFVLENBQUMsRUFBaEIsQ0FBQTt1QkFDQSxLQUFDLENBQUEsSUFBRCxDQUFNLE1BQU4sRUFDRTtBQUFBLGtCQUFBLFNBQUEsRUFBVyxTQUFYO0FBQUEsa0JBQ0EsSUFBQSxFQUFNLEVBRE47QUFBQSxrQkFFQSxVQUFBLEVBQVksTUFGWjtpQkFERixFQUZGO2NBQUEsRUFEYztZQUFBLEVBQUE7VUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUgsQ0FBUyxJQUFJLENBQUMsWUFBZCxDQUFiLENBQUE7aUJBT0EsVUFBQSxDQUFXLFVBQVgsRUFBdUIsSUFBdkIsRUFSRjtTQTVCRjtPQUFBLE1BcUNLLElBQUcsR0FBRyxDQUFDLFNBQUosS0FBaUIsU0FBcEI7QUFDSCxRQUFBLElBQUMsQ0FBQSxPQUFELENBQVMsR0FBRyxDQUFDLElBQWIsRUFBbUIsTUFBQSxLQUFVLElBQUMsQ0FBQSxtQkFBOUIsQ0FBQSxDQUFBO0FBRUEsUUFBQSxJQUFHLENBQUMsSUFBQyxDQUFBLFVBQUQsS0FBZSxTQUFmLElBQTRCLHdCQUE3QixDQUFBLElBQWtELENBQUMsQ0FBQSxJQUFLLENBQUEsU0FBTixDQUFsRCxJQUF1RSxDQUFDLENBQUMsSUFBQyxDQUFBLG1CQUFELEtBQXdCLE1BQXpCLENBQUEsSUFBb0MsQ0FBSyxnQ0FBTCxDQUFyQyxDQUExRTtBQUNFLFVBQUEsSUFBQyxDQUFBLFdBQVksQ0FBQSxNQUFBLENBQU8sQ0FBQyxTQUFyQixHQUFpQyxJQUFqQyxDQUFBO2lCQUNBLElBQUMsQ0FBQSxpQkFBRCxDQUFBLEVBRkY7U0FIRztPQUFBLE1BT0EsSUFBRyxHQUFHLENBQUMsU0FBSixLQUFpQixVQUFwQjtlQUNILElBQUMsQ0FBQSxPQUFELENBQVMsR0FBRyxDQUFDLElBQWIsRUFBbUIsTUFBQSxLQUFVLElBQUMsQ0FBQSxtQkFBOUIsRUFERztPQWxEUDtLQURjO0VBQUEsQ0EvS2hCO0FBQUEsRUFpUEEsbUJBQUEsRUFBcUIsU0FBQyxDQUFELEdBQUE7QUFDbkIsUUFBQSx5QkFBQTtBQUFBLElBQUEsV0FBQSxHQUFjLFNBQUMsSUFBRCxHQUFBO0FBQ1osVUFBQSwyQkFBQTtBQUFBO0FBQUE7V0FBQSwyQ0FBQTtxQkFBQTtBQUNFLFFBQUEsSUFBRyxDQUFDLENBQUMsWUFBRixDQUFlLFNBQWYsQ0FBQSxLQUE2QixNQUFoQzt3QkFDRSxXQUFBLENBQVksQ0FBWixHQURGO1NBQUEsTUFBQTt3QkFHRSxZQUFBLENBQWEsQ0FBYixHQUhGO1NBREY7QUFBQTtzQkFEWTtJQUFBLENBQWQsQ0FBQTtBQUFBLElBT0EsWUFBQSxHQUFlLFNBQUMsSUFBRCxHQUFBO0FBQ2IsVUFBQSxnREFBQTtBQUFBLE1BQUEsSUFBQSxHQUFPLEVBQVAsQ0FBQTtBQUNBO0FBQUEsV0FBQSxZQUFBOzJCQUFBO0FBQ0UsUUFBQSxHQUFBLEdBQU0sUUFBQSxDQUFTLEtBQVQsQ0FBTixDQUFBO0FBQ0EsUUFBQSxJQUFHLEtBQUEsQ0FBTSxHQUFOLENBQUEsSUFBYyxDQUFDLEVBQUEsR0FBRyxHQUFKLENBQUEsS0FBYyxLQUEvQjtBQUNFLFVBQUEsSUFBSyxDQUFBLElBQUEsQ0FBTCxHQUFhLEtBQWIsQ0FERjtTQUFBLE1BQUE7QUFHRSxVQUFBLElBQUssQ0FBQSxJQUFBLENBQUwsR0FBYSxHQUFiLENBSEY7U0FGRjtBQUFBLE9BREE7QUFPQTtBQUFBLFdBQUEsNENBQUE7c0JBQUE7QUFDRSxRQUFBLElBQUEsR0FBTyxDQUFDLENBQUMsSUFBVCxDQUFBO0FBQ0EsUUFBQSxJQUFHLENBQUMsQ0FBQyxZQUFGLENBQWUsU0FBZixDQUFBLEtBQTZCLE1BQWhDO0FBQ0UsVUFBQSxJQUFLLENBQUEsSUFBQSxDQUFMLEdBQWEsV0FBQSxDQUFZLENBQVosQ0FBYixDQURGO1NBQUEsTUFBQTtBQUdFLFVBQUEsSUFBSyxDQUFBLElBQUEsQ0FBTCxHQUFhLFlBQUEsQ0FBYSxDQUFiLENBQWIsQ0FIRjtTQUZGO0FBQUEsT0FQQTthQWFBLEtBZGE7SUFBQSxDQVBmLENBQUE7V0FzQkEsWUFBQSxDQUFhLENBQWIsRUF2Qm1CO0VBQUEsQ0FqUHJCO0FBQUEsRUFtUkEsa0JBQUEsRUFBb0IsU0FBQyxDQUFELEVBQUksSUFBSixHQUFBO0FBRWxCLFFBQUEsMkJBQUE7QUFBQSxJQUFBLGFBQUEsR0FBZ0IsU0FBQyxDQUFELEVBQUksSUFBSixHQUFBO0FBQ2QsVUFBQSxXQUFBO0FBQUEsV0FBQSxZQUFBOzJCQUFBO0FBQ0UsUUFBQSxJQUFPLGFBQVA7QUFBQTtTQUFBLE1BRUssSUFBRyxLQUFLLENBQUMsV0FBTixLQUFxQixNQUF4QjtBQUNILFVBQUEsYUFBQSxDQUFjLENBQUMsQ0FBQyxDQUFGLENBQUksSUFBSixDQUFkLEVBQXlCLEtBQXpCLENBQUEsQ0FERztTQUFBLE1BRUEsSUFBRyxLQUFLLENBQUMsV0FBTixLQUFxQixLQUF4QjtBQUNILFVBQUEsWUFBQSxDQUFhLENBQUMsQ0FBQyxDQUFGLENBQUksSUFBSixDQUFiLEVBQXdCLEtBQXhCLENBQUEsQ0FERztTQUFBLE1BQUE7QUFHSCxVQUFBLENBQUMsQ0FBQyxZQUFGLENBQWUsSUFBZixFQUFvQixLQUFwQixDQUFBLENBSEc7U0FMUDtBQUFBLE9BQUE7YUFTQSxFQVZjO0lBQUEsQ0FBaEIsQ0FBQTtBQUFBLElBV0EsWUFBQSxHQUFlLFNBQUMsQ0FBRCxFQUFJLEtBQUosR0FBQTtBQUNiLFVBQUEsV0FBQTtBQUFBLE1BQUEsQ0FBQyxDQUFDLFlBQUYsQ0FBZSxTQUFmLEVBQXlCLE1BQXpCLENBQUEsQ0FBQTtBQUNBLFdBQUEsNENBQUE7c0JBQUE7QUFDRSxRQUFBLElBQUcsQ0FBQyxDQUFDLFdBQUYsS0FBaUIsTUFBcEI7QUFDRSxVQUFBLGFBQUEsQ0FBYyxDQUFDLENBQUMsQ0FBRixDQUFJLGVBQUosQ0FBZCxFQUFvQyxDQUFwQyxDQUFBLENBREY7U0FBQSxNQUFBO0FBR0UsVUFBQSxZQUFBLENBQWEsQ0FBQyxDQUFDLENBQUYsQ0FBSSxlQUFKLENBQWIsRUFBbUMsQ0FBbkMsQ0FBQSxDQUhGO1NBREY7QUFBQSxPQURBO2FBTUEsRUFQYTtJQUFBLENBWGYsQ0FBQTtBQW1CQSxJQUFBLElBQUcsSUFBSSxDQUFDLFdBQUwsS0FBb0IsTUFBdkI7YUFDRSxhQUFBLENBQWMsQ0FBQyxDQUFDLENBQUYsQ0FBSSxHQUFKLEVBQVE7QUFBQSxRQUFDLEtBQUEsRUFBTSxpQ0FBUDtPQUFSLENBQWQsRUFBa0UsSUFBbEUsRUFERjtLQUFBLE1BRUssSUFBRyxJQUFJLENBQUMsV0FBTCxLQUFvQixLQUF2QjthQUNILFlBQUEsQ0FBYSxDQUFDLENBQUMsQ0FBRixDQUFJLEdBQUosRUFBUTtBQUFBLFFBQUMsS0FBQSxFQUFNLGlDQUFQO09BQVIsQ0FBYixFQUFpRSxJQUFqRSxFQURHO0tBQUEsTUFBQTtBQUdILFlBQVUsSUFBQSxLQUFBLENBQU0sMkJBQU4sQ0FBVixDQUhHO0tBdkJhO0VBQUEsQ0FuUnBCO0FBQUEsRUErU0EsYUFBQSxFQUFlLFNBQUEsR0FBQTs7TUFDYixJQUFDLENBQUE7S0FBRDtBQUFBLElBQ0EsTUFBQSxDQUFBLElBQVEsQ0FBQSxlQURSLENBQUE7V0FFQSxJQUFDLENBQUEsYUFBRCxHQUFpQixLQUhKO0VBQUEsQ0EvU2Y7Q0FSRixDQUFBOzs7O0FDQUEsSUFBQSxNQUFBOzs7RUFBQSxNQUFNLENBQUUsbUJBQVIsR0FBOEI7Q0FBOUI7OztFQUNBLE1BQU0sQ0FBRSx3QkFBUixHQUFtQztDQURuQzs7O0VBRUEsTUFBTSxDQUFFLGlCQUFSLEdBQTRCO0NBRjVCOztBQUFBO0FBY2UsRUFBQSxnQkFBRSxFQUFGLEVBQU8sS0FBUCxHQUFBO0FBQ1gsSUFEWSxJQUFDLENBQUEsS0FBQSxFQUNiLENBQUE7QUFBQSxJQURpQixJQUFDLENBQUEsUUFBQSxLQUNsQixDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsZUFBRCxHQUFtQixFQUFuQixDQURXO0VBQUEsQ0FBYjs7QUFBQSxtQkFNQSxjQUFBLEdBQWdCLFNBQUMsSUFBRCxHQUFBO0FBQ2QsUUFBQSxJQUFBO0FBQUEsSUFBQSxJQUFBLEdBQU8sSUFBQyxDQUFBLEtBQU0sQ0FBQSxJQUFJLENBQUMsSUFBTCxDQUFkLENBQUE7QUFDQSxJQUFBLElBQUcsNENBQUg7YUFDRSxJQUFJLENBQUMsS0FBTCxDQUFXLElBQVgsRUFERjtLQUFBLE1BQUE7QUFHRSxZQUFVLElBQUEsS0FBQSxDQUFPLDBDQUFBLEdBQXlDLElBQUksQ0FBQyxJQUE5QyxHQUFvRCxtQkFBcEQsR0FBc0UsQ0FBQSxJQUFJLENBQUMsU0FBTCxDQUFlLElBQWYsQ0FBQSxDQUF0RSxHQUEyRixHQUFsRyxDQUFWLENBSEY7S0FGYztFQUFBLENBTmhCLENBQUE7O0FBaUJBO0FBQUE7Ozs7Ozs7OztLQWpCQTs7QUFBQSxtQkFnQ0EsbUJBQUEsR0FBcUIsU0FBQyxRQUFELEdBQUE7QUFDbkIsUUFBQSxxQkFBQTtBQUFBO1NBQUEsK0NBQUE7dUJBQUE7QUFDRSxNQUFBLElBQU8sbUNBQVA7c0JBQ0UsSUFBQyxDQUFBLE9BQUQsQ0FBUyxDQUFULEdBREY7T0FBQSxNQUFBOzhCQUFBO09BREY7QUFBQTtvQkFEbUI7RUFBQSxDQWhDckIsQ0FBQTs7QUFBQSxtQkF3Q0EsUUFBQSxHQUFVLFNBQUMsUUFBRCxHQUFBO1dBQ1IsSUFBQyxDQUFBLE9BQUQsQ0FBUyxRQUFULEVBRFE7RUFBQSxDQXhDVixDQUFBOztBQUFBLG1CQWdEQSxPQUFBLEdBQVMsU0FBQyxhQUFELEVBQWdCLE1BQWhCLEdBQUE7QUFDUCxRQUFBLG9CQUFBOztNQUR1QixTQUFTO0tBQ2hDO0FBQUEsSUFBQSxJQUFHLGFBQWEsQ0FBQyxXQUFkLEtBQStCLEtBQWxDO0FBQ0UsTUFBQSxhQUFBLEdBQWdCLENBQUMsYUFBRCxDQUFoQixDQURGO0tBQUE7QUFFQSxTQUFBLG9EQUFBO2tDQUFBO0FBQ0UsTUFBQSxJQUFHLE1BQUg7QUFDRSxRQUFBLE9BQU8sQ0FBQyxNQUFSLEdBQWlCLE1BQWpCLENBREY7T0FBQTtBQUFBLE1BR0EsQ0FBQSxHQUFJLElBQUMsQ0FBQSxjQUFELENBQWdCLE9BQWhCLENBSEosQ0FBQTtBQUFBLE1BSUEsQ0FBQyxDQUFDLGdCQUFGLEdBQXFCLE9BSnJCLENBQUE7QUFLQSxNQUFBLElBQUcsc0JBQUg7QUFDRSxRQUFBLENBQUMsQ0FBQyxNQUFGLEdBQVcsT0FBTyxDQUFDLE1BQW5CLENBREY7T0FMQTtBQVFBLE1BQUEsSUFBRywrQkFBSDtBQUFBO09BQUEsTUFFSyxJQUFHLENBQUMsQ0FBQyxDQUFBLElBQUssQ0FBQSxFQUFFLENBQUMsbUJBQUosQ0FBd0IsQ0FBeEIsQ0FBTCxDQUFBLElBQXFDLENBQUssZ0JBQUwsQ0FBdEMsQ0FBQSxJQUEwRCxDQUFDLENBQUEsQ0FBSyxDQUFDLE9BQUYsQ0FBQSxDQUFMLENBQTdEO0FBQ0gsUUFBQSxJQUFDLENBQUEsZUFBZSxDQUFDLElBQWpCLENBQXNCLENBQXRCLENBQUEsQ0FBQTs7VUFDQSxNQUFNLENBQUUsaUJBQWlCLENBQUMsSUFBMUIsQ0FBK0IsQ0FBQyxDQUFDLElBQWpDO1NBRkc7T0FYUDtBQUFBLEtBRkE7V0FnQkEsSUFBQyxDQUFBLGNBQUQsQ0FBQSxFQWpCTztFQUFBLENBaERULENBQUE7O0FBQUEsbUJBdUVBLGNBQUEsR0FBZ0IsU0FBQSxHQUFBO0FBQ2QsUUFBQSwyQ0FBQTtBQUFBLFdBQU0sSUFBTixHQUFBO0FBQ0UsTUFBQSxVQUFBLEdBQWEsSUFBQyxDQUFBLGVBQWUsQ0FBQyxNQUE5QixDQUFBO0FBQUEsTUFDQSxXQUFBLEdBQWMsRUFEZCxDQUFBO0FBRUE7QUFBQSxXQUFBLDJDQUFBO3NCQUFBO0FBQ0UsUUFBQSxJQUFHLGdDQUFIO0FBQUE7U0FBQSxNQUVLLElBQUcsQ0FBQyxDQUFBLElBQUssQ0FBQSxFQUFFLENBQUMsbUJBQUosQ0FBd0IsRUFBeEIsQ0FBSixJQUFvQyxDQUFLLGlCQUFMLENBQXJDLENBQUEsSUFBMEQsQ0FBQyxDQUFBLEVBQU0sQ0FBQyxPQUFILENBQUEsQ0FBTCxDQUE3RDtBQUNILFVBQUEsV0FBVyxDQUFDLElBQVosQ0FBaUIsRUFBakIsQ0FBQSxDQURHO1NBSFA7QUFBQSxPQUZBO0FBQUEsTUFPQSxJQUFDLENBQUEsZUFBRCxHQUFtQixXQVBuQixDQUFBO0FBUUEsTUFBQSxJQUFHLElBQUMsQ0FBQSxlQUFlLENBQUMsTUFBakIsS0FBMkIsVUFBOUI7QUFDRSxjQURGO09BVEY7SUFBQSxDQUFBO0FBV0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxlQUFlLENBQUMsTUFBakIsS0FBNkIsQ0FBaEM7YUFDRSxJQUFDLENBQUEsRUFBRSxDQUFDLFVBQUosQ0FBQSxFQURGO0tBWmM7RUFBQSxDQXZFaEIsQ0FBQTs7Z0JBQUE7O0lBZEYsQ0FBQTs7QUFBQSxNQXFHTSxDQUFDLE9BQVAsR0FBaUIsTUFyR2pCLENBQUE7Ozs7QUNNQSxJQUFBLGFBQUE7RUFBQSxrRkFBQTs7QUFBQTtBQU1lLEVBQUEsdUJBQUUsT0FBRixHQUFBO0FBQ1gsSUFEWSxJQUFDLENBQUEsVUFBQSxPQUNiLENBQUE7QUFBQSx1REFBQSxDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsaUJBQUQsR0FBcUIsRUFBckIsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLE1BQUQsR0FBVSxFQURWLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxnQkFBRCxHQUFvQixFQUZwQixDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsT0FBRCxHQUFXLEVBSFgsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLEtBQUQsR0FBUyxFQUpULENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSx3QkFBRCxHQUE0QixJQUw1QixDQUFBO0FBQUEsSUFNQSxJQUFDLENBQUEscUJBQUQsR0FBeUIsS0FOekIsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLDJCQUFELEdBQStCLENBUC9CLENBQUE7QUFBQSxJQVFBLFVBQUEsQ0FBVyxJQUFDLENBQUEsWUFBWixFQUEwQixJQUFDLENBQUEscUJBQTNCLENBUkEsQ0FEVztFQUFBLENBQWI7O0FBQUEsMEJBV0EsV0FBQSxHQUFhLFNBQUMsRUFBRCxHQUFBO0FBQ1gsUUFBQSxjQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFDLENBQUEsT0FBRCxDQUFkLENBQUE7QUFDQSxJQUFBLElBQUcsV0FBSDtBQUNFLFdBQUEsYUFBQTt3QkFBQTtBQUNFLFFBQUEsSUFBRyxxQkFBSDtBQUNFLFVBQUEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEdBQWdCLEVBQWhCLENBREY7U0FBQTtBQUVBLFFBQUEsSUFBRyxpQkFBSDtBQUNFLFVBQUEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBVixHQUFvQixFQUFwQixDQURGO1NBSEY7QUFBQSxPQUFBO0FBS0EsTUFBQSxJQUFHLHVCQUFIO0FBQ0UsY0FBVSxJQUFBLEtBQUEsQ0FBTSxtRUFBTixDQUFWLENBREY7T0FMQTtBQUFBLE1BT0EsSUFBQyxDQUFBLE1BQU8sQ0FBQSxFQUFBLENBQVIsR0FBYyxHQVBkLENBQUE7QUFBQSxNQVFBLE1BQUEsQ0FBQSxJQUFRLENBQUEsTUFBTyxDQUFBLElBQUMsQ0FBQSxPQUFELENBUmYsQ0FERjtLQURBO0FBV0EsSUFBQSxJQUFHLDRDQUFIO0FBQ0UsTUFBQSxJQUFDLENBQUEsaUJBQWtCLENBQUEsRUFBQSxDQUFuQixHQUF5QixJQUFDLENBQUEsaUJBQWtCLENBQUEsSUFBQyxDQUFBLE9BQUQsQ0FBNUMsQ0FBQTtBQUFBLE1BQ0EsTUFBQSxDQUFBLElBQVEsQ0FBQSxpQkFBa0IsQ0FBQSxJQUFDLENBQUEsT0FBRCxDQUQxQixDQURGO0tBWEE7V0FjQSxJQUFDLENBQUEsT0FBRCxHQUFXLEdBZkE7RUFBQSxDQVhiLENBQUE7O0FBQUEsMEJBNEJBLFlBQUEsR0FBYyxTQUFBLEdBQUE7QUFDWixRQUFBLGlCQUFBO0FBQUE7QUFBQSxTQUFBLDJDQUFBO21CQUFBOztRQUVFLENBQUMsQ0FBQztPQUZKO0FBQUEsS0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxJQUFDLENBQUEsS0FKWixDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsS0FBRCxHQUFTLEVBTFQsQ0FBQTtBQU1BLElBQUEsSUFBRyxJQUFDLENBQUEscUJBQUQsS0FBNEIsQ0FBQSxDQUEvQjtBQUNFLE1BQUEsSUFBQyxDQUFBLHVCQUFELEdBQTJCLFVBQUEsQ0FBVyxJQUFDLENBQUEsWUFBWixFQUEwQixJQUFDLENBQUEscUJBQTNCLENBQTNCLENBREY7S0FOQTtXQVFBLE9BVFk7RUFBQSxDQTVCZCxDQUFBOztBQUFBLDBCQTBDQSxTQUFBLEdBQVcsU0FBQSxHQUFBO1dBQ1QsSUFBQyxDQUFBLFFBRFE7RUFBQSxDQTFDWCxDQUFBOztBQUFBLDBCQTZDQSxxQkFBQSxHQUF1QixTQUFBLEdBQUE7QUFDckIsUUFBQSxxQkFBQTtBQUFBLElBQUEsSUFBRyxJQUFDLENBQUEsd0JBQUo7QUFDRTtXQUFBLGdEQUFBOzBCQUFBO0FBQ0UsUUFBQSxJQUFHLFNBQUg7d0JBQ0UsSUFBQyxDQUFBLE9BQU8sQ0FBQyxJQUFULENBQWMsQ0FBZCxHQURGO1NBQUEsTUFBQTtnQ0FBQTtTQURGO0FBQUE7c0JBREY7S0FEcUI7RUFBQSxDQTdDdkIsQ0FBQTs7QUFBQSwwQkFtREEscUJBQUEsR0FBdUIsU0FBQSxHQUFBO0FBQ3JCLElBQUEsSUFBQyxDQUFBLHdCQUFELEdBQTRCLEtBQTVCLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSx1QkFBRCxDQUFBLENBREEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxFQUZYLENBQUE7V0FHQSxJQUFDLENBQUEsS0FBRCxHQUFTLEdBSlk7RUFBQSxDQW5EdkIsQ0FBQTs7QUFBQSwwQkF5REEsdUJBQUEsR0FBeUIsU0FBQSxHQUFBO0FBQ3ZCLElBQUEsSUFBQyxDQUFBLHFCQUFELEdBQXlCLENBQUEsQ0FBekIsQ0FBQTtBQUFBLElBQ0EsWUFBQSxDQUFhLElBQUMsQ0FBQSx1QkFBZCxDQURBLENBQUE7V0FFQSxJQUFDLENBQUEsdUJBQUQsR0FBMkIsT0FISjtFQUFBLENBekR6QixDQUFBOztBQUFBLDBCQThEQSx3QkFBQSxHQUEwQixTQUFFLHFCQUFGLEdBQUE7QUFBeUIsSUFBeEIsSUFBQyxDQUFBLHdCQUFBLHFCQUF1QixDQUF6QjtFQUFBLENBOUQxQixDQUFBOztBQUFBLDBCQXFFQSwyQkFBQSxHQUE2QixTQUFBLEdBQUE7V0FDM0I7QUFBQSxNQUNFLE9BQUEsRUFBVSxHQURaO0FBQUEsTUFFRSxTQUFBLEVBQWEsR0FBQSxHQUFFLENBQUEsSUFBQyxDQUFBLDJCQUFELEVBQUEsQ0FGakI7TUFEMkI7RUFBQSxDQXJFN0IsQ0FBQTs7QUFBQSwwQkE4RUEsbUJBQUEsR0FBcUIsU0FBQyxPQUFELEdBQUE7QUFDbkIsUUFBQSxvQkFBQTtBQUFBLElBQUEsSUFBTyxlQUFQO0FBQ0UsTUFBQSxHQUFBLEdBQU0sRUFBTixDQUFBO0FBQ0E7QUFBQSxXQUFBLFlBQUE7eUJBQUE7QUFDRSxRQUFBLEdBQUksQ0FBQSxJQUFBLENBQUosR0FBWSxHQUFaLENBREY7QUFBQSxPQURBO2FBR0EsSUFKRjtLQUFBLE1BQUE7YUFNRSxJQUFDLENBQUEsaUJBQWtCLENBQUEsT0FBQSxFQU5yQjtLQURtQjtFQUFBLENBOUVyQixDQUFBOztBQUFBLDBCQXVGQSxtQkFBQSxHQUFxQixTQUFDLENBQUQsR0FBQTtBQUNuQixRQUFBLFlBQUE7O3FCQUFxQztLQUFyQztBQUFBLElBQ0EsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFOLElBQW1CLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU4sQ0FEdEMsQ0FBQTtXQUVBLEtBSG1CO0VBQUEsQ0F2RnJCLENBQUE7O0FBQUEsMEJBK0ZBLE9BQUEsR0FBUyxTQUFDLFlBQUQsR0FBQTtBQUNQLFFBQUEsc0VBQUE7O01BRFEsZUFBYTtLQUNyQjtBQUFBLElBQUEsSUFBQSxHQUFPLEVBQVAsQ0FBQTtBQUFBLElBQ0EsT0FBQSxHQUFVLFNBQUMsSUFBRCxFQUFPLFFBQVAsR0FBQTtBQUNSLE1BQUEsSUFBRyxDQUFLLFlBQUwsQ0FBQSxJQUFlLENBQUssZ0JBQUwsQ0FBbEI7QUFDRSxjQUFVLElBQUEsS0FBQSxDQUFNLE1BQU4sQ0FBVixDQURGO09BQUE7YUFFSSw0QkFBSixJQUEyQixZQUFhLENBQUEsSUFBQSxDQUFiLElBQXNCLFNBSHpDO0lBQUEsQ0FEVixDQUFBO0FBTUE7QUFBQSxTQUFBLGNBQUE7MEJBQUE7QUFFRSxNQUFBLElBQUcsTUFBQSxLQUFVLEdBQWI7QUFDRSxpQkFERjtPQUFBO0FBRUEsV0FBQSxnQkFBQTsyQkFBQTtBQUNFLFFBQUEsSUFBRyxDQUFLLHlCQUFMLENBQUEsSUFBNkIsT0FBQSxDQUFRLE1BQVIsRUFBZ0IsUUFBaEIsQ0FBaEM7QUFFRSxVQUFBLE1BQUEsR0FBUyxDQUFDLENBQUMsT0FBRixDQUFBLENBQVQsQ0FBQTtBQUNBLFVBQUEsSUFBRyxpQkFBSDtBQUVFLFlBQUEsTUFBQSxHQUFTLENBQUMsQ0FBQyxPQUFYLENBQUE7QUFDQSxtQkFBTSx3QkFBQSxJQUFvQixPQUFBLENBQVEsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFuQixFQUE0QixNQUFNLENBQUMsR0FBRyxDQUFDLFNBQXZDLENBQTFCLEdBQUE7QUFDRSxjQUFBLE1BQUEsR0FBUyxNQUFNLENBQUMsT0FBaEIsQ0FERjtZQUFBLENBREE7QUFBQSxZQUdBLE1BQU0sQ0FBQyxJQUFQLEdBQWMsTUFBTSxDQUFDLE1BQVAsQ0FBQSxDQUhkLENBRkY7V0FBQSxNQU1LLElBQUcsaUJBQUg7QUFFSCxZQUFBLE1BQUEsR0FBUyxDQUFDLENBQUMsT0FBWCxDQUFBO0FBQ0EsbUJBQU0sd0JBQUEsSUFBb0IsT0FBQSxDQUFRLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBbkIsRUFBNEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUF2QyxDQUExQixHQUFBO0FBQ0UsY0FBQSxNQUFBLEdBQVMsTUFBTSxDQUFDLE9BQWhCLENBREY7WUFBQSxDQURBO0FBQUEsWUFHQSxNQUFNLENBQUMsSUFBUCxHQUFjLE1BQU0sQ0FBQyxNQUFQLENBQUEsQ0FIZCxDQUZHO1dBUEw7QUFBQSxVQWFBLElBQUksQ0FBQyxJQUFMLENBQVUsTUFBVixDQWJBLENBRkY7U0FERjtBQUFBLE9BSkY7QUFBQSxLQU5BO1dBNEJBLEtBN0JPO0VBQUEsQ0EvRlQsQ0FBQTs7QUFBQSwwQkFtSUEsMEJBQUEsR0FBNEIsU0FBQyxPQUFELEdBQUE7QUFDMUIsUUFBQSxHQUFBO0FBQUEsSUFBQSxJQUFPLGVBQVA7QUFDRSxNQUFBLE9BQUEsR0FBVSxJQUFDLENBQUEsT0FBWCxDQURGO0tBQUE7QUFFQSxJQUFBLElBQU8sdUNBQVA7QUFDRSxNQUFBLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxPQUFBLENBQW5CLEdBQThCLENBQTlCLENBREY7S0FGQTtBQUFBLElBSUEsR0FBQSxHQUNFO0FBQUEsTUFBQSxTQUFBLEVBQVksT0FBWjtBQUFBLE1BQ0EsV0FBQSxFQUFjLElBQUMsQ0FBQSxpQkFBa0IsQ0FBQSxPQUFBLENBRGpDO0tBTEYsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLGlCQUFrQixDQUFBLE9BQUEsQ0FBbkIsRUFQQSxDQUFBO1dBUUEsSUFUMEI7RUFBQSxDQW5JNUIsQ0FBQTs7QUFBQSwwQkFvSkEsWUFBQSxHQUFjLFNBQUMsR0FBRCxHQUFBO0FBQ1osUUFBQSxPQUFBO0FBQUEsSUFBQSxJQUFHLGVBQUg7QUFDRSxNQUFBLEdBQUEsR0FBTSxHQUFHLENBQUMsR0FBVixDQURGO0tBQUE7QUFBQSxJQUVBLENBQUEsbURBQTBCLENBQUEsR0FBRyxDQUFDLFNBQUosVUFGMUIsQ0FBQTtBQUdBLElBQUEsSUFBRyxpQkFBQSxJQUFhLFdBQWhCO2FBQ0UsQ0FBQyxDQUFDLFdBQUYsQ0FBYyxHQUFHLENBQUMsR0FBbEIsRUFERjtLQUFBLE1BQUE7YUFHRSxFQUhGO0tBSlk7RUFBQSxDQXBKZCxDQUFBOztBQUFBLDBCQWlLQSxZQUFBLEdBQWMsU0FBQyxDQUFELEdBQUE7QUFDWixJQUFBLElBQU8sa0NBQVA7QUFDRSxNQUFBLElBQUMsQ0FBQSxNQUFPLENBQUEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLENBQVIsR0FBeUIsRUFBekIsQ0FERjtLQUFBO0FBRUEsSUFBQSxJQUFHLG1EQUFIO0FBQ0UsWUFBVSxJQUFBLEtBQUEsQ0FBTSxvQ0FBTixDQUFWLENBREY7S0FGQTtBQUlBLElBQUEsSUFBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQWhCLEtBQWlDLE1BQWxDLENBQUEsSUFBOEMsQ0FBQyxDQUFBLElBQUssQ0FBQSxtQkFBRCxDQUFxQixDQUFyQixDQUFMLENBQTlDLElBQWdGLENBQUssZ0JBQUwsQ0FBbkY7QUFDRSxZQUFVLElBQUEsS0FBQSxDQUFNLGtDQUFOLENBQVYsQ0FERjtLQUpBO0FBQUEsSUFNQSxJQUFDLENBQUEsWUFBRCxDQUFjLENBQWQsQ0FOQSxDQUFBO0FBQUEsSUFPQSxJQUFDLENBQUEsTUFBTyxDQUFBLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixDQUFlLENBQUEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFOLENBQXZCLEdBQTBDLENBUDFDLENBQUE7V0FRQSxFQVRZO0VBQUEsQ0FqS2QsQ0FBQTs7QUFBQSwwQkE0S0EsZUFBQSxHQUFpQixTQUFDLENBQUQsR0FBQTtBQUNmLFFBQUEsSUFBQTt5REFBQSxNQUFBLENBQUEsSUFBK0IsQ0FBQSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQU4sV0FEaEI7RUFBQSxDQTVLakIsQ0FBQTs7QUFBQSwwQkFrTEEsb0JBQUEsR0FBc0IsU0FBQyxDQUFELEdBQUE7V0FDcEIsSUFBQyxDQUFBLFVBQUQsR0FBYyxFQURNO0VBQUEsQ0FsTHRCLENBQUE7O0FBQUEsMEJBc0xBLFVBQUEsR0FBWSxTQUFBLEdBQUEsQ0F0TFosQ0FBQTs7QUFBQSwwQkEwTEEsZ0JBQUEsR0FBa0IsU0FBQyxZQUFELEdBQUE7QUFDaEIsUUFBQSxxQkFBQTtBQUFBO1NBQUEsb0JBQUE7aUNBQUE7QUFDRSxNQUFBLElBQUcsQ0FBQyxDQUFLLG9DQUFMLENBQUEsSUFBbUMsQ0FBQyxJQUFDLENBQUEsaUJBQWtCLENBQUEsSUFBQSxDQUFuQixHQUEyQixZQUFhLENBQUEsSUFBQSxDQUF6QyxDQUFwQyxDQUFBLElBQXlGLDRCQUE1RjtzQkFDRSxJQUFDLENBQUEsaUJBQWtCLENBQUEsSUFBQSxDQUFuQixHQUEyQixZQUFhLENBQUEsSUFBQSxHQUQxQztPQUFBLE1BQUE7OEJBQUE7T0FERjtBQUFBO29CQURnQjtFQUFBLENBMUxsQixDQUFBOztBQUFBLDBCQWtNQSxZQUFBLEdBQWMsU0FBQyxDQUFELEdBQUE7QUFDWixRQUFBLFlBQUE7O3FCQUFxQztLQUFyQztBQUNBLElBQUEsSUFBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU4sS0FBbUIsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUF0QjtBQUVFLE1BQUEsSUFBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQU4sS0FBbUIsSUFBQyxDQUFBLGlCQUFrQixDQUFBLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixDQUF6QztBQUNFLFFBQUEsSUFBQyxDQUFBLGlCQUFrQixDQUFBLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixDQUFuQixFQUFBLENBREY7T0FBQTtBQUVBLGFBQU0seUVBQU4sR0FBQTtBQUNFLFFBQUEsSUFBQyxDQUFBLGlCQUFrQixDQUFBLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTixDQUFuQixFQUFBLENBREY7TUFBQSxDQUZBO2FBSUEsT0FORjtLQUZZO0VBQUEsQ0FsTWQsQ0FBQTs7dUJBQUE7O0lBTkYsQ0FBQTs7QUFBQSxNQXVOTSxDQUFDLE9BQVAsR0FBaUIsYUF2TmpCLENBQUE7Ozs7QUNQQSxJQUFBOztpU0FBQTs7QUFBQSxNQUFNLENBQUMsT0FBUCxHQUFpQixTQUFBLEdBQUE7QUFFZixNQUFBLHVCQUFBO0FBQUEsRUFBQSxHQUFBLEdBQU0sRUFBTixDQUFBO0FBQUEsRUFDQSxrQkFBQSxHQUFxQixFQURyQixDQUFBO0FBQUEsRUFnQk0sR0FBRyxDQUFDO0FBTUssSUFBQSxtQkFBQyxXQUFELEVBQWMsR0FBZCxHQUFBO0FBQ1gsTUFBQSxJQUFHLG1CQUFIO0FBQ0UsUUFBQSxJQUFDLENBQUEsV0FBRCxHQUFlLFdBQWYsQ0FERjtPQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsVUFBRCxHQUFjLEtBRmQsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLGlCQUFELEdBQXFCLEtBSHJCLENBQUE7QUFBQSxNQUlBLElBQUMsQ0FBQSxlQUFELEdBQW1CLEVBSm5CLENBQUE7QUFLQSxNQUFBLElBQUcsV0FBSDtBQUNFLFFBQUEsSUFBQyxDQUFBLEdBQUQsR0FBTyxHQUFQLENBREY7T0FOVztJQUFBLENBQWI7O0FBQUEsd0JBU0EsSUFBQSxHQUFNLFdBVE4sQ0FBQTs7QUFBQSx3QkFXQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1gsWUFBVSxJQUFBLEtBQUEsQ0FBTSx1REFBTixDQUFWLENBRFc7SUFBQSxDQVhiLENBQUE7O0FBQUEsd0JBa0JBLE9BQUEsR0FBUyxTQUFDLENBQUQsR0FBQTthQUNQLElBQUMsQ0FBQSxlQUFlLENBQUMsSUFBakIsQ0FBc0IsQ0FBdEIsRUFETztJQUFBLENBbEJULENBQUE7O0FBQUEsd0JBMkJBLFNBQUEsR0FBVyxTQUFDLENBQUQsR0FBQTthQUNULElBQUMsQ0FBQSxlQUFELEdBQW1CLElBQUMsQ0FBQSxlQUFlLENBQUMsTUFBakIsQ0FBd0IsU0FBQyxDQUFELEdBQUE7ZUFDekMsQ0FBQSxLQUFPLEVBRGtDO01BQUEsQ0FBeEIsRUFEVjtJQUFBLENBM0JYLENBQUE7O0FBQUEsd0JBb0NBLGtCQUFBLEdBQW9CLFNBQUEsR0FBQTthQUNsQixJQUFDLENBQUEsZUFBRCxHQUFtQixHQUREO0lBQUEsQ0FwQ3BCLENBQUE7O0FBQUEsd0JBdUNBLFNBQUEsR0FBUSxTQUFBLEdBQUE7QUFDTixNQUFBLENBQUssSUFBQSxHQUFHLENBQUMsTUFBSixDQUFXLE1BQVgsRUFBc0IsSUFBdEIsQ0FBTCxDQUE2QixDQUFDLE9BQTlCLENBQUEsQ0FBQSxDQUFBO2FBQ0EsS0FGTTtJQUFBLENBdkNSLENBQUE7O0FBQUEsd0JBK0NBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVCxVQUFBLE1BQUE7QUFBQSxNQUFBLElBQUcsd0JBQUg7QUFDRSxRQUFBLE1BQUEsR0FBUyxJQUFDLENBQUEsYUFBRCxDQUFBLENBQVQsQ0FERjtPQUFBLE1BQUE7QUFHRSxRQUFBLE1BQUEsR0FBUyxJQUFULENBSEY7T0FBQTthQUlBLElBQUMsQ0FBQSxZQUFELGFBQWMsQ0FBQSxNQUFRLFNBQUEsYUFBQSxTQUFBLENBQUEsQ0FBdEIsRUFMUztJQUFBLENBL0NYLENBQUE7O0FBQUEsd0JBeURBLFlBQUEsR0FBYyxTQUFBLEdBQUE7QUFDWixVQUFBLHFDQUFBO0FBQUEsTUFEYSxtQkFBSSw4REFDakIsQ0FBQTtBQUFBO0FBQUE7V0FBQSwyQ0FBQTtxQkFBQTtBQUNFLHNCQUFBLENBQUMsQ0FBQyxJQUFGLFVBQU8sQ0FBQSxFQUFJLFNBQUEsYUFBQSxJQUFBLENBQUEsQ0FBWCxFQUFBLENBREY7QUFBQTtzQkFEWTtJQUFBLENBekRkLENBQUE7O0FBQUEsd0JBNkRBLFNBQUEsR0FBVyxTQUFBLEdBQUE7YUFDVCxJQUFDLENBQUEsV0FEUTtJQUFBLENBN0RYLENBQUE7O0FBQUEsd0JBZ0VBLFdBQUEsR0FBYSxTQUFDLGNBQUQsR0FBQTs7UUFBQyxpQkFBaUI7T0FDN0I7QUFBQSxNQUFBLElBQUcsQ0FBQSxJQUFLLENBQUEsaUJBQVI7QUFFRSxRQUFBLElBQUMsQ0FBQSxVQUFELEdBQWMsSUFBZCxDQUFBO0FBQ0EsUUFBQSxJQUFHLGNBQUg7QUFDRSxVQUFBLElBQUMsQ0FBQSxpQkFBRCxHQUFxQixJQUFyQixDQUFBO2lCQUNBLElBQUMsQ0FBQSxFQUFFLENBQUMscUJBQUosQ0FBMEIsSUFBMUIsRUFGRjtTQUhGO09BRFc7SUFBQSxDQWhFYixDQUFBOztBQUFBLHdCQXdFQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBRVAsTUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLGVBQUosQ0FBb0IsSUFBcEIsQ0FBQSxDQUFBO2FBQ0EsSUFBQyxDQUFBLGtCQUFELENBQUEsRUFITztJQUFBLENBeEVULENBQUE7O0FBQUEsd0JBZ0ZBLFNBQUEsR0FBVyxTQUFFLE1BQUYsR0FBQTtBQUFVLE1BQVQsSUFBQyxDQUFBLFNBQUEsTUFBUSxDQUFWO0lBQUEsQ0FoRlgsQ0FBQTs7QUFBQSx3QkFxRkEsU0FBQSxHQUFXLFNBQUEsR0FBQTthQUNULElBQUMsQ0FBQSxPQURRO0lBQUEsQ0FyRlgsQ0FBQTs7QUFBQSx3QkEyRkEsTUFBQSxHQUFRLFNBQUEsR0FBQTtBQUNOLFVBQUEsT0FBQTtBQUFBLE1BQUEsSUFBTyw0QkFBUDtlQUNFLElBQUMsQ0FBQSxJQURIO09BQUEsTUFBQTtBQUdFLFFBQUEsSUFBRyxvQkFBSDtBQUNFLFVBQUEsT0FBQSxHQUFVLElBQUMsQ0FBQSxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVQsQ0FBQSxDQUFWLENBQUE7QUFBQSxVQUNBLE9BQU8sQ0FBQyxHQUFSLEdBQWMsSUFBQyxDQUFBLEdBQUcsQ0FBQyxHQURuQixDQUFBO2lCQUVBLFFBSEY7U0FBQSxNQUFBO2lCQUtFLE9BTEY7U0FIRjtPQURNO0lBQUEsQ0EzRlIsQ0FBQTs7QUFBQSx3QkFzR0EsUUFBQSxHQUFVLFNBQUEsR0FBQTtBQUNSLFVBQUEsZUFBQTtBQUFBLE1BQUEsR0FBQSxHQUFNLEVBQU4sQ0FBQTtBQUNBO0FBQUEsV0FBQSxTQUFBO29CQUFBO0FBQ0UsUUFBQSxHQUFJLENBQUEsQ0FBQSxDQUFKLEdBQVMsQ0FBVCxDQURGO0FBQUEsT0FEQTthQUdBLElBSlE7SUFBQSxDQXRHVixDQUFBOztBQUFBLHdCQWtIQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxXQUFBO0FBQUEsTUFBQSxJQUFDLENBQUEsV0FBRCxHQUFlLElBQWYsQ0FBQTtBQUNBLE1BQUEsSUFBTyxnQkFBUDtBQUlFLFFBQUEsSUFBQyxDQUFBLEdBQUQsR0FBTyxJQUFDLENBQUEsRUFBRSxDQUFDLDBCQUFKLENBQUEsQ0FBUCxDQUpGO09BREE7QUFNQSxNQUFBLElBQU8sNEJBQVA7QUFDRSxRQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFpQixJQUFqQixDQUFBLENBQUE7QUFDQSxhQUFBLHlEQUFBO3FDQUFBO0FBQ0UsVUFBQSxDQUFBLENBQUUsSUFBQyxDQUFBLE9BQUQsQ0FBQSxDQUFGLENBQUEsQ0FERjtBQUFBLFNBRkY7T0FOQTthQVVBLEtBWE87SUFBQSxDQWxIVCxDQUFBOztBQUFBLHdCQW1JQSxPQUFBLEdBQVMsU0FBQyxJQUFELEdBQUE7O1FBQUMsT0FBTztPQUNmO0FBQUEsTUFBQSxJQUFJLENBQUMsSUFBTCxHQUFZLElBQUMsQ0FBQSxJQUFiLENBQUE7QUFBQSxNQUNBLElBQUksQ0FBQyxHQUFMLEdBQVcsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQURYLENBQUE7QUFFQSxNQUFBLElBQUcsd0JBQUg7QUFDRSxRQUFBLElBQUcsSUFBQyxDQUFBLFdBQVcsQ0FBQyxXQUFiLEtBQTRCLE1BQS9CO0FBQ0UsVUFBQSxJQUFJLENBQUMsV0FBTCxHQUFtQixJQUFDLENBQUEsV0FBcEIsQ0FERjtTQUFBLE1BQUE7QUFHRSxVQUFBLElBQUksQ0FBQyxXQUFMLEdBQW1CLElBQUMsQ0FBQSxXQUFXLENBQUMsS0FBaEMsQ0FIRjtTQURGO09BRkE7YUFPQSxLQVJPO0lBQUEsQ0FuSVQsQ0FBQTs7QUFBQSx3QkFnS0EsYUFBQSxHQUFlLFNBQUMsSUFBRCxFQUFPLEVBQVAsR0FBQTtBQU9iLE1BQUEsSUFBTyxVQUFQO0FBQUE7T0FBQSxNQUVLLElBQUcsb0JBQUEsSUFBZSxDQUFBLENBQUssc0JBQUEsSUFBa0Isb0JBQW5CLENBQXRCO2VBR0gsSUFBRSxDQUFBLElBQUEsQ0FBRixHQUFVLEdBSFA7T0FBQSxNQUFBOztVQU1ILElBQUMsQ0FBQSxZQUFhO1NBQWQ7ZUFDQSxJQUFDLENBQUEsU0FBVSxDQUFBLElBQUEsQ0FBWCxHQUFtQixHQVBoQjtPQVRRO0lBQUEsQ0FoS2YsQ0FBQTs7QUFBQSx3QkF5TEEsdUJBQUEsR0FBeUIsU0FBQSxHQUFBO0FBQ3ZCLFVBQUEsK0NBQUE7QUFBQSxNQUFBLGNBQUEsR0FBaUIsRUFBakIsQ0FBQTtBQUFBLE1BQ0EsT0FBQSxHQUFVLElBRFYsQ0FBQTtBQUVBO0FBQUEsV0FBQSxZQUFBOzRCQUFBO0FBQ0UsUUFBQSxFQUFBLEdBQUssSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQWlCLE1BQWpCLENBQUwsQ0FBQTtBQUNBLFFBQUEsSUFBRyxFQUFIO0FBQ0UsVUFBQSxJQUFFLENBQUEsSUFBQSxDQUFGLEdBQVUsRUFBVixDQURGO1NBQUEsTUFBQTtBQUdFLFVBQUEsY0FBZSxDQUFBLElBQUEsQ0FBZixHQUF1QixNQUF2QixDQUFBO0FBQUEsVUFDQSxPQUFBLEdBQVUsS0FEVixDQUhGO1NBRkY7QUFBQSxPQUZBO0FBQUEsTUFTQSxNQUFBLENBQUEsSUFBUSxDQUFBLFNBVFIsQ0FBQTtBQVVBLE1BQUEsSUFBRyxDQUFBLE9BQUg7QUFDRSxRQUFBLElBQUMsQ0FBQSxTQUFELEdBQWEsY0FBYixDQURGO09BVkE7YUFZQSxRQWJ1QjtJQUFBLENBekx6QixDQUFBOztBQUFBLHdCQXdNQSxhQUFBLEdBQWUsU0FBQSxHQUFBO0FBQ2IsTUFBQSxJQUFPLHdCQUFQO0FBQ0UsY0FBVSxJQUFBLEtBQUEsQ0FBTSx1REFBTixDQUFWLENBREY7T0FBQTtBQUVBLE1BQUEsSUFBRyxJQUFDLENBQUEsV0FBVyxDQUFDLFdBQWIsS0FBNEIsTUFBL0I7QUFFRSxRQUFBLElBQUMsQ0FBQSxXQUFELEdBQW1CLElBQUEsSUFBQyxDQUFBLFlBQWEsQ0FBQSxJQUFDLENBQUEsV0FBRCxDQUFkLENBQUEsQ0FBbkIsQ0FBQTtBQUFBLFFBQ0EsSUFBQyxDQUFBLFdBQVcsQ0FBQyxTQUFiLENBQXVCLElBQXZCLENBREEsQ0FGRjtPQUZBO2FBTUEsSUFBQyxDQUFBLFlBUFk7SUFBQSxDQXhNZixDQUFBOztxQkFBQTs7TUF0QkYsQ0FBQTtBQUFBLEVBNE9NLEdBQUcsQ0FBQztBQU1SLDZCQUFBLENBQUE7O0FBQWEsSUFBQSxnQkFBQyxXQUFELEVBQWMsR0FBZCxFQUFtQixPQUFuQixHQUFBO0FBQ1gsTUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLFNBQWYsRUFBMEIsT0FBMUIsQ0FBQSxDQUFBO0FBQUEsTUFDQSx3Q0FBTSxXQUFOLEVBQW1CLEdBQW5CLENBREEsQ0FEVztJQUFBLENBQWI7O0FBQUEscUJBSUEsSUFBQSxHQUFNLFFBSk4sQ0FBQTs7QUFBQSxxQkFXQSxPQUFBLEdBQVMsU0FBQSxHQUFBO2FBQ1A7QUFBQSxRQUNFLE1BQUEsRUFBUSxRQURWO0FBQUEsUUFFRSxLQUFBLEVBQU8sSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZUO0FBQUEsUUFHRSxTQUFBLEVBQVcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FIYjtRQURPO0lBQUEsQ0FYVCxDQUFBOztBQUFBLHFCQXNCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxHQUFBO0FBQUEsTUFBQSxJQUFHLElBQUMsQ0FBQSx1QkFBRCxDQUFBLENBQUg7QUFDRSxRQUFBLEdBQUEsR0FBTSxxQ0FBQSxTQUFBLENBQU4sQ0FBQTtBQUNBLFFBQUEsSUFBRyxHQUFIO0FBQ0UsVUFBQSxJQUFDLENBQUEsT0FBTyxDQUFDLFdBQVQsQ0FBcUIsSUFBckIsQ0FBQSxDQURGO1NBREE7ZUFHQSxJQUpGO09BQUEsTUFBQTtlQU1FLE1BTkY7T0FETztJQUFBLENBdEJULENBQUE7O2tCQUFBOztLQU51QixHQUFHLENBQUMsVUE1TzdCLENBQUE7QUFBQSxFQW9SQSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQVgsR0FBbUIsU0FBQyxDQUFELEdBQUE7QUFDakIsUUFBQSxnQkFBQTtBQUFBLElBQ1UsUUFBUixNQURGLEVBRWEsZ0JBQVgsVUFGRixDQUFBO1dBSUksSUFBQSxJQUFBLENBQUssSUFBTCxFQUFXLEdBQVgsRUFBZ0IsV0FBaEIsRUFMYTtFQUFBLENBcFJuQixDQUFBO0FBQUEsRUFxU00sR0FBRyxDQUFDO0FBT1IsNkJBQUEsQ0FBQTs7QUFBYSxJQUFBLGdCQUFDLFdBQUQsRUFBYyxPQUFkLEVBQXVCLEdBQXZCLEVBQTRCLE9BQTVCLEVBQXFDLE9BQXJDLEVBQThDLE1BQTlDLEVBQXNELE1BQXRELEdBQUE7QUFFWCxNQUFBLElBQUcsT0FBQSxLQUFXLE1BQWQ7QUFBQTtPQUFBLE1BRUssSUFBRyxpQkFBQSxJQUFhLHlCQUFoQjtBQUNILFFBQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxTQUFmLEVBQTBCLE9BQTFCLENBQUEsQ0FERztPQUFBLE1BQUE7QUFHSCxRQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsT0FBWCxDQUhHO09BRkw7QUFBQSxNQU1BLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixNQUF6QixDQU5BLENBQUE7QUFBQSxNQU9BLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQVBBLENBQUE7QUFBQSxNQVFBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQVJBLENBQUE7QUFTQSxNQUFBLElBQUcsY0FBSDtBQUNFLFFBQUEsSUFBQyxDQUFBLGFBQUQsQ0FBZSxRQUFmLEVBQXlCLE1BQXpCLENBQUEsQ0FERjtPQUFBLE1BQUE7QUFHRSxRQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixPQUF6QixDQUFBLENBSEY7T0FUQTtBQUFBLE1BYUEsd0NBQU0sV0FBTixFQUFtQixHQUFuQixDQWJBLENBRlc7SUFBQSxDQUFiOztBQUFBLHFCQWlCQSxJQUFBLEdBQU0sUUFqQk4sQ0FBQTs7QUFBQSxxQkFtQkEsR0FBQSxHQUFLLFNBQUEsR0FBQTtBQUNILE1BQUEsSUFBRyxzQkFBQSxJQUFjLG9DQUFqQjtlQUNFLElBQUMsQ0FBQSxPQUFPLENBQUMsYUFBVCxDQUFBLEVBREY7T0FBQSxNQUFBO2VBR0UsSUFBQyxDQUFBLFFBSEg7T0FERztJQUFBLENBbkJMLENBQUE7O0FBQUEscUJBNkJBLFdBQUEsR0FBYSxTQUFDLENBQUQsR0FBQTtBQUNYLFVBQUEsK0JBQUE7O1FBQUEsSUFBQyxDQUFBLGFBQWM7T0FBZjtBQUFBLE1BQ0EsU0FBQSxHQUFZLEtBRFosQ0FBQTtBQUVBLE1BQUEsSUFBRyxxQkFBQSxJQUFhLENBQUEsSUFBSyxDQUFBLFVBQWxCLElBQWlDLFdBQXBDO0FBRUUsUUFBQSxTQUFBLEdBQVksSUFBWixDQUZGO09BRkE7QUFLQSxNQUFBLElBQUcsU0FBSDtBQUNFLFFBQUEsSUFBQyxDQUFBLFVBQVUsQ0FBQyxJQUFaLENBQWlCLENBQWpCLENBQUEsQ0FERjtPQUxBO0FBQUEsTUFPQSxjQUFBLEdBQWlCLEtBUGpCLENBQUE7QUFRQSxNQUFBLElBQUcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxTQUFULENBQUEsQ0FBSDtBQUNFLFFBQUEsY0FBQSxHQUFpQixJQUFqQixDQURGO09BUkE7QUFBQSxNQVVBLHdDQUFNLGNBQU4sQ0FWQSxDQUFBO0FBV0EsTUFBQSxJQUFHLFNBQUg7QUFDRSxRQUFBLElBQUMsQ0FBQSxpQ0FBRCxDQUFtQyxDQUFuQyxDQUFBLENBREY7T0FYQTtBQWFBLE1BQUEsd0NBQVcsQ0FBRSxTQUFWLENBQUEsVUFBSDtlQUVFLElBQUMsQ0FBQSxPQUFPLENBQUMsV0FBVCxDQUFBLEVBRkY7T0FkVztJQUFBLENBN0JiLENBQUE7O0FBQUEscUJBK0NBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLG9CQUFBO0FBQUEsTUFBQSxJQUFHLElBQUMsQ0FBQSxPQUFPLENBQUMsU0FBVCxDQUFBLENBQUg7QUFFRTtBQUFBLGFBQUEsMkNBQUE7dUJBQUE7QUFDRSxVQUFBLENBQUMsQ0FBQyxPQUFGLENBQUEsQ0FBQSxDQURGO0FBQUEsU0FBQTtBQUFBLFFBS0EsQ0FBQSxHQUFJLElBQUMsQ0FBQSxPQUxMLENBQUE7QUFNQSxlQUFNLENBQUMsQ0FBQyxJQUFGLEtBQVksV0FBbEIsR0FBQTtBQUNFLFVBQUEsSUFBRyxDQUFDLENBQUMsTUFBRixLQUFZLElBQWY7QUFDRSxZQUFBLENBQUMsQ0FBQyxNQUFGLEdBQVcsSUFBQyxDQUFBLE9BQVosQ0FERjtXQUFBO0FBQUEsVUFFQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BRk4sQ0FERjtRQUFBLENBTkE7QUFBQSxRQVdBLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxHQUFtQixJQUFDLENBQUEsT0FYcEIsQ0FBQTtBQUFBLFFBWUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLElBQUMsQ0FBQSxPQVpwQixDQUFBO0FBbUJBLFFBQUEsSUFBRyxJQUFDLENBQUEsT0FBRCxZQUFvQixHQUFHLENBQUMsU0FBeEIsSUFBc0MsQ0FBQSxlQUF6QztBQUNFLFVBQUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxhQUFULEVBQUEsQ0FBQTtBQUNBLFVBQUEsSUFBRyxJQUFDLENBQUEsT0FBTyxDQUFDLGFBQVQsSUFBMEIsQ0FBMUIsSUFBZ0MsQ0FBQSxJQUFLLENBQUEsT0FBTyxDQUFDLFVBQWhEO0FBQ0UsWUFBQSxJQUFDLENBQUEsT0FBTyxDQUFDLFdBQVQsQ0FBQSxDQUFBLENBREY7V0FGRjtTQW5CQTtBQUFBLFFBdUJBLE1BQUEsQ0FBQSxJQUFRLENBQUEsT0F2QlIsQ0FBQTtlQXdCQSxxQ0FBQSxTQUFBLEVBMUJGO09BRE87SUFBQSxDQS9DVCxDQUFBOztBQUFBLHFCQW1GQSxtQkFBQSxHQUFxQixTQUFBLEdBQUE7QUFDbkIsVUFBQSxJQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksQ0FBSixDQUFBO0FBQUEsTUFDQSxDQUFBLEdBQUksSUFBQyxDQUFBLE9BREwsQ0FBQTtBQUVBLGFBQU0sSUFBTixHQUFBO0FBQ0UsUUFBQSxJQUFHLElBQUMsQ0FBQSxNQUFELEtBQVcsQ0FBZDtBQUNFLGdCQURGO1NBQUE7QUFBQSxRQUVBLENBQUEsRUFGQSxDQUFBO0FBQUEsUUFHQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BSE4sQ0FERjtNQUFBLENBRkE7YUFPQSxFQVJtQjtJQUFBLENBbkZyQixDQUFBOztBQUFBLHFCQWdHQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSwrQkFBQTtBQUFBLE1BQUEsSUFBRyxDQUFBLElBQUssQ0FBQSx1QkFBRCxDQUFBLENBQVA7QUFDRSxlQUFPLEtBQVAsQ0FERjtPQUFBLE1BQUE7QUFHRSxRQUFBLElBQUcsSUFBQyxDQUFBLE9BQUQsWUFBb0IsR0FBRyxDQUFDLFNBQTNCO0FBQ0UsVUFBQSxJQUFDLENBQUEsT0FBTyxDQUFDLGFBQVQsR0FBeUIsSUFBekIsQ0FBQTs7aUJBQ1EsQ0FBQyxnQkFBaUI7V0FEMUI7QUFBQSxVQUVBLElBQUMsQ0FBQSxPQUFPLENBQUMsYUFBVCxFQUZBLENBREY7U0FBQTtBQUlBLFFBQUEsSUFBRyxtQkFBSDtBQUNFLFVBQUEsSUFBTyxvQkFBUDtBQUNFLFlBQUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxJQUFDLENBQUEsTUFBTSxDQUFDLFNBQW5CLENBREY7V0FBQTtBQUVBLFVBQUEsSUFBTyxtQkFBUDtBQUNFLFlBQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxJQUFDLENBQUEsT0FBWCxDQURGO1dBQUEsTUFFSyxJQUFHLElBQUMsQ0FBQSxNQUFELEtBQVcsV0FBZDtBQUNILFlBQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxJQUFDLENBQUEsTUFBTSxDQUFDLFNBQWxCLENBREc7V0FKTDtBQU1BLFVBQUEsSUFBTyxvQkFBUDtBQUNFLFlBQUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxJQUFDLENBQUEsTUFBTSxDQUFDLEdBQW5CLENBREY7V0FQRjtTQUpBO0FBYUEsUUFBQSxJQUFHLG9CQUFIO0FBQ0UsVUFBQSxrQkFBQSxHQUFxQixJQUFDLENBQUEsbUJBQUQsQ0FBQSxDQUFyQixDQUFBO0FBQUEsVUFDQSxDQUFBLEdBQUksSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQURiLENBQUE7QUFBQSxVQUVBLENBQUEsR0FBSSxrQkFGSixDQUFBO0FBaUJBLGlCQUFNLElBQU4sR0FBQTtBQUNFLFlBQUEsSUFBRyxDQUFBLEtBQU8sSUFBQyxDQUFBLE9BQVg7QUFFRSxjQUFBLElBQUcsQ0FBQyxDQUFDLG1CQUFGLENBQUEsQ0FBQSxLQUEyQixDQUE5QjtBQUVFLGdCQUFBLElBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEdBQWdCLElBQUMsQ0FBQSxHQUFHLENBQUMsT0FBeEI7QUFDRSxrQkFBQSxJQUFDLENBQUEsT0FBRCxHQUFXLENBQVgsQ0FBQTtBQUFBLGtCQUNBLGtCQUFBLEdBQXFCLENBQUEsR0FBSSxDQUR6QixDQURGO2lCQUFBLE1BQUE7QUFBQTtpQkFGRjtlQUFBLE1BT0ssSUFBRyxDQUFDLENBQUMsbUJBQUYsQ0FBQSxDQUFBLEdBQTBCLENBQTdCO0FBRUgsZ0JBQUEsSUFBRyxDQUFBLEdBQUksa0JBQUosSUFBMEIsQ0FBQyxDQUFDLG1CQUFGLENBQUEsQ0FBN0I7QUFDRSxrQkFBQSxJQUFDLENBQUEsT0FBRCxHQUFXLENBQVgsQ0FBQTtBQUFBLGtCQUNBLGtCQUFBLEdBQXFCLENBQUEsR0FBSSxDQUR6QixDQURGO2lCQUFBLE1BQUE7QUFBQTtpQkFGRztlQUFBLE1BQUE7QUFTSCxzQkFURztlQVBMO0FBQUEsY0FpQkEsQ0FBQSxFQWpCQSxDQUFBO0FBQUEsY0FrQkEsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQWxCTixDQUZGO2FBQUEsTUFBQTtBQXVCRSxvQkF2QkY7YUFERjtVQUFBLENBakJBO0FBQUEsVUEyQ0EsSUFBQyxDQUFBLE9BQUQsR0FBVyxJQUFDLENBQUEsT0FBTyxDQUFDLE9BM0NwQixDQUFBO0FBQUEsVUE0Q0EsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLElBNUNuQixDQUFBO0FBQUEsVUE2Q0EsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULEdBQW1CLElBN0NuQixDQURGO1NBYkE7QUFBQSxRQTZEQSxJQUFDLENBQUEsU0FBRCxDQUFXLElBQUMsQ0FBQSxPQUFPLENBQUMsU0FBVCxDQUFBLENBQVgsQ0E3REEsQ0FBQTtBQUFBLFFBOERBLHFDQUFBLFNBQUEsQ0E5REEsQ0FBQTtBQUFBLFFBK0RBLElBQUMsQ0FBQSxpQ0FBRCxDQUFBLENBL0RBLENBQUE7ZUFnRUEsS0FuRUY7T0FETztJQUFBLENBaEdULENBQUE7O0FBQUEscUJBc0tBLGlDQUFBLEdBQW1DLFNBQUEsR0FBQTtBQUNqQyxVQUFBLG9CQUFBO0FBQUEsTUFBQSxjQUFBLEdBQWlCLFNBQUMsT0FBRCxHQUFBO0FBQ2YsUUFBQSxJQUFHLE9BQUEsWUFBbUIsR0FBRyxDQUFDLFNBQTFCO2lCQUNFLE9BQU8sQ0FBQyxhQUFSLENBQUEsRUFERjtTQUFBLE1BQUE7aUJBR0UsUUFIRjtTQURlO01BQUEsQ0FBakIsQ0FBQTtnREFLTyxDQUFFLFNBQVQsQ0FBbUI7UUFDakI7QUFBQSxVQUFBLElBQUEsRUFBTSxRQUFOO0FBQUEsVUFDQSxRQUFBLEVBQVUsSUFBQyxDQUFBLFdBQUQsQ0FBQSxDQURWO0FBQUEsVUFFQSxNQUFBLEVBQVEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxhQUFSLENBQUEsQ0FGUjtBQUFBLFVBR0EsU0FBQSxFQUFXLElBQUMsQ0FBQSxHQUFHLENBQUMsT0FIaEI7QUFBQSxVQUlBLEtBQUEsRUFBTyxjQUFBLENBQWUsSUFBQyxDQUFBLE9BQWhCLENBSlA7U0FEaUI7T0FBbkIsV0FOaUM7SUFBQSxDQXRLbkMsQ0FBQTs7QUFBQSxxQkFvTEEsaUNBQUEsR0FBbUMsU0FBQyxDQUFELEdBQUE7YUFDakMsSUFBQyxDQUFBLE1BQU0sQ0FBQyxTQUFSLENBQWtCO1FBQ2hCO0FBQUEsVUFBQSxJQUFBLEVBQU0sUUFBTjtBQUFBLFVBQ0EsUUFBQSxFQUFVLElBQUMsQ0FBQSxXQUFELENBQUEsQ0FEVjtBQUFBLFVBRUEsTUFBQSxFQUFRLElBQUMsQ0FBQSxNQUFNLENBQUMsYUFBUixDQUFBLENBRlI7QUFBQSxVQUdBLE1BQUEsRUFBUSxDQUhSO0FBQUEsVUFJQSxTQUFBLEVBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUpqQjtTQURnQjtPQUFsQixFQURpQztJQUFBLENBcExuQyxDQUFBOztBQUFBLHFCQWdNQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1gsVUFBQSxjQUFBO0FBQUEsTUFBQSxRQUFBLEdBQVcsQ0FBWCxDQUFBO0FBQUEsTUFDQSxJQUFBLEdBQU8sSUFBQyxDQUFBLE9BRFIsQ0FBQTtBQUVBLGFBQU0sSUFBTixHQUFBO0FBQ0UsUUFBQSxJQUFHLElBQUEsWUFBZ0IsR0FBRyxDQUFDLFNBQXZCO0FBQ0UsZ0JBREY7U0FBQTtBQUVBLFFBQUEsSUFBRyxDQUFBLElBQVEsQ0FBQyxTQUFMLENBQUEsQ0FBUDtBQUNFLFVBQUEsUUFBQSxFQUFBLENBREY7U0FGQTtBQUFBLFFBSUEsSUFBQSxHQUFPLElBQUksQ0FBQyxPQUpaLENBREY7TUFBQSxDQUZBO2FBUUEsU0FUVztJQUFBLENBaE1iLENBQUE7O0FBQUEscUJBK01BLE9BQUEsR0FBUyxTQUFDLElBQUQsR0FBQTtBQUNQLFVBQUEsSUFBQTs7UUFEUSxPQUFPO09BQ2Y7QUFBQSxNQUFBLElBQUksQ0FBQyxJQUFMLEdBQVksSUFBQyxDQUFBLE9BQU8sQ0FBQyxNQUFULENBQUEsQ0FBWixDQUFBO0FBQUEsTUFDQSxJQUFJLENBQUMsSUFBTCxHQUFZLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBRFosQ0FBQTtBQUFBLE1BRUEsSUFBSSxDQUFDLE1BQUwsR0FBYyxJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUZkLENBQUE7QUFJQSxNQUFBLElBQUcsSUFBQyxDQUFBLE1BQU0sQ0FBQyxJQUFSLEtBQWdCLFdBQW5CO0FBQ0UsUUFBQSxJQUFJLENBQUMsTUFBTCxHQUFjLFdBQWQsQ0FERjtPQUFBLE1BRUssSUFBRyxJQUFDLENBQUEsTUFBRCxLQUFhLElBQUMsQ0FBQSxPQUFqQjtBQUNILFFBQUEsSUFBSSxDQUFDLE1BQUwsR0FBYyxJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBQSxDQUFkLENBREc7T0FOTDtBQVNBLE1BQUEsSUFBRyw4REFBSDtBQUNFLFFBQUEsSUFBSyxDQUFBLFNBQUEsQ0FBTCxHQUFrQixJQUFDLENBQUEsT0FBTyxDQUFDLE1BQVQsQ0FBQSxDQUFsQixDQURGO09BQUEsTUFBQTtBQUdFLFFBQUEsSUFBSyxDQUFBLFNBQUEsQ0FBTCxHQUFrQixJQUFJLENBQUMsU0FBTCxDQUFlLElBQUMsQ0FBQSxPQUFoQixDQUFsQixDQUhGO09BVEE7YUFhQSxvQ0FBTSxJQUFOLEVBZE87SUFBQSxDQS9NVCxDQUFBOztrQkFBQTs7S0FQdUIsR0FBRyxDQUFDLFVBclM3QixDQUFBO0FBQUEsRUEyZ0JBLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBWCxHQUFtQixTQUFDLElBQUQsR0FBQTtBQUNqQixRQUFBLHdDQUFBO0FBQUEsSUFDYyxlQUFaLFVBREYsRUFFVSxXQUFSLE1BRkYsRUFHVSxZQUFSLE9BSEYsRUFJVSxZQUFSLE9BSkYsRUFLYSxjQUFYLFNBTEYsRUFNYSxjQUFYLFNBTkYsQ0FBQTtBQVFBLElBQUEsSUFBRyxNQUFBLENBQUEsT0FBQSxLQUFrQixRQUFyQjtBQUNFLE1BQUEsT0FBQSxHQUFVLElBQUksQ0FBQyxLQUFMLENBQVcsT0FBWCxDQUFWLENBREY7S0FSQTtXQVVJLElBQUEsSUFBQSxDQUFLLElBQUwsRUFBVyxPQUFYLEVBQW9CLEdBQXBCLEVBQXlCLElBQXpCLEVBQStCLElBQS9CLEVBQXFDLE1BQXJDLEVBQTZDLE1BQTdDLEVBWGE7RUFBQSxDQTNnQm5CLENBQUE7QUFBQSxFQThoQk0sR0FBRyxDQUFDO0FBTVIsZ0NBQUEsQ0FBQTs7QUFBYSxJQUFBLG1CQUFDLE9BQUQsRUFBVSxPQUFWLEVBQW1CLE1BQW5CLEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxhQUFELENBQWUsU0FBZixFQUEwQixPQUExQixDQURBLENBQUE7QUFBQSxNQUVBLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixPQUF6QixDQUZBLENBQUE7QUFBQSxNQUdBLDJDQUFNLElBQU4sRUFBWTtBQUFBLFFBQUMsV0FBQSxFQUFhLElBQWQ7T0FBWixDQUhBLENBRFc7SUFBQSxDQUFiOztBQUFBLHdCQU1BLElBQUEsR0FBTSxXQU5OLENBQUE7O0FBQUEsd0JBUUEsV0FBQSxHQUFhLFNBQUEsR0FBQTtBQUNYLFVBQUEsQ0FBQTtBQUFBLE1BQUEseUNBQUEsQ0FBQSxDQUFBO0FBQUEsTUFDQSxDQUFBLEdBQUksSUFBQyxDQUFBLE9BREwsQ0FBQTtBQUVBLGFBQU0sU0FBTixHQUFBO0FBQ0UsUUFBQSxDQUFDLENBQUMsV0FBRixDQUFBLENBQUEsQ0FBQTtBQUFBLFFBQ0EsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQUROLENBREY7TUFBQSxDQUZBO2FBS0EsT0FOVztJQUFBLENBUmIsQ0FBQTs7QUFBQSx3QkFnQkEsT0FBQSxHQUFTLFNBQUEsR0FBQTthQUNQLHFDQUFBLEVBRE87SUFBQSxDQWhCVCxDQUFBOztBQUFBLHdCQXNCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1AsVUFBQSxXQUFBO0FBQUEsTUFBQSxJQUFHLG9FQUFIO2VBQ0Usd0NBQUEsU0FBQSxFQURGO09BQUEsTUFFSyw0Q0FBZSxDQUFBLFNBQUEsVUFBZjtBQUNILFFBQUEsSUFBRyxJQUFDLENBQUEsdUJBQUQsQ0FBQSxDQUFIO0FBQ0UsVUFBQSxJQUFHLDRCQUFIO0FBQ0Usa0JBQVUsSUFBQSxLQUFBLENBQU0sZ0NBQU4sQ0FBVixDQURGO1dBQUE7QUFBQSxVQUVBLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxHQUFtQixJQUZuQixDQUFBO2lCQUdBLHdDQUFBLFNBQUEsRUFKRjtTQUFBLE1BQUE7aUJBTUUsTUFORjtTQURHO09BQUEsTUFRQSxJQUFHLHNCQUFBLElBQWtCLDhCQUFyQjtBQUNILFFBQUEsTUFBQSxDQUFBLElBQVEsQ0FBQSxPQUFPLENBQUMsU0FBUyxDQUFDLE9BQTFCLENBQUE7QUFBQSxRQUNBLElBQUMsQ0FBQSxPQUFPLENBQUMsT0FBVCxHQUFtQixJQURuQixDQUFBO2VBRUEsd0NBQUEsU0FBQSxFQUhHO09BQUEsTUFJQSxJQUFHLHNCQUFBLElBQWEsc0JBQWIsSUFBMEIsSUFBN0I7ZUFDSCx3Q0FBQSxTQUFBLEVBREc7T0FmRTtJQUFBLENBdEJULENBQUE7O0FBQUEsd0JBNkNBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUCxVQUFBLFdBQUE7YUFBQTtBQUFBLFFBQ0UsTUFBQSxFQUFTLElBQUMsQ0FBQSxJQURaO0FBQUEsUUFFRSxLQUFBLEVBQVEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZWO0FBQUEsUUFHRSxNQUFBLHNDQUFpQixDQUFFLE1BQVYsQ0FBQSxVQUhYO0FBQUEsUUFJRSxNQUFBLHdDQUFpQixDQUFFLE1BQVYsQ0FBQSxVQUpYO1FBRE87SUFBQSxDQTdDVCxDQUFBOztxQkFBQTs7S0FOMEIsR0FBRyxDQUFDLFVBOWhCaEMsQ0FBQTtBQUFBLEVBeWxCQSxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQWQsR0FBc0IsU0FBQyxJQUFELEdBQUE7QUFDcEIsUUFBQSxlQUFBO0FBQUEsSUFDUSxXQUFSLE1BREEsRUFFUyxZQUFULE9BRkEsRUFHUyxZQUFULE9BSEEsQ0FBQTtXQUtJLElBQUEsSUFBQSxDQUFLLEdBQUwsRUFBVSxJQUFWLEVBQWdCLElBQWhCLEVBTmdCO0VBQUEsQ0F6bEJ0QixDQUFBO1NBa21CQTtBQUFBLElBQ0UsWUFBQSxFQUFlLEdBRGpCO0FBQUEsSUFFRSxvQkFBQSxFQUF1QixrQkFGekI7SUFwbUJlO0FBQUEsQ0FBakIsQ0FBQTs7OztBQ0FBLElBQUEsdUJBQUE7RUFBQTtpU0FBQTs7QUFBQSx1QkFBQSxHQUEwQixPQUFBLENBQVEsU0FBUixDQUExQixDQUFBOztBQUFBLE1BRU0sQ0FBQyxPQUFQLEdBQWlCLFNBQUEsR0FBQTtBQUNmLE1BQUEsY0FBQTtBQUFBLEVBQUEsU0FBQSxHQUFZLHVCQUFBLENBQUEsQ0FBWixDQUFBO0FBQUEsRUFDQSxHQUFBLEdBQU0sU0FBUyxDQUFDLFVBRGhCLENBQUE7QUFBQSxFQU9NLEdBQUcsQ0FBQztBQUtSLGlDQUFBLENBQUE7O0FBQWEsSUFBQSxvQkFBQyxXQUFELEVBQWMsR0FBZCxHQUFBO0FBQ1gsTUFBQSxJQUFDLENBQUEsSUFBRCxHQUFRLEVBQVIsQ0FBQTtBQUFBLE1BQ0EsNENBQU0sV0FBTixFQUFtQixHQUFuQixDQURBLENBRFc7SUFBQSxDQUFiOztBQUFBLHlCQUlBLElBQUEsR0FBTSxZQUpOLENBQUE7O0FBQUEseUJBTUEsV0FBQSxHQUFhLFNBQUEsR0FBQTtBQUNYLFVBQUEsYUFBQTtBQUFBO0FBQUEsV0FBQSxZQUFBO3VCQUFBO0FBQ0UsUUFBQSxDQUFDLENBQUMsV0FBRixDQUFBLENBQUEsQ0FERjtBQUFBLE9BQUE7YUFFQSwwQ0FBQSxFQUhXO0lBQUEsQ0FOYixDQUFBOztBQUFBLHlCQVdBLE9BQUEsR0FBUyxTQUFBLEdBQUE7YUFDUCxzQ0FBQSxFQURPO0lBQUEsQ0FYVCxDQUFBOztBQUFBLHlCQWNBLEdBQUEsR0FBSyxTQUFDLENBQUQsR0FBQTtBQUNILFVBQUEsVUFBQTtBQUFBO0FBQUEsV0FBQSxTQUFBO29CQUFBO0FBQ0UsUUFBQSxDQUFBLENBQUUsQ0FBRixFQUFJLENBQUosQ0FBQSxDQURGO0FBQUEsT0FBQTthQUVBLE9BSEc7SUFBQSxDQWRMLENBQUE7O0FBQUEseUJBc0JBLEdBQUEsR0FBSyxTQUFDLElBQUQsRUFBTyxPQUFQLEdBQUE7QUFDSCxVQUFBLCtCQUFBO0FBQUEsTUFBQSxJQUFHLFNBQVMsQ0FBQyxNQUFWLEdBQW1CLENBQXRCO0FBQ0UsUUFBQSxJQUFHLGlCQUFBLElBQWEsMkJBQWhCO0FBQ0UsVUFBQSxHQUFBLEdBQU0sT0FBTyxDQUFDLFNBQVIsQ0FBa0IsSUFBQyxDQUFBLFlBQW5CLEVBQWlDLElBQUMsQ0FBQSxVQUFsQyxDQUFOLENBREY7U0FBQSxNQUFBO0FBR0UsVUFBQSxHQUFBLEdBQU0sT0FBTixDQUhGO1NBQUE7QUFBQSxRQUlBLElBQUMsQ0FBQSxXQUFELENBQWEsSUFBYixDQUFrQixDQUFDLE9BQW5CLENBQTJCLEdBQTNCLENBSkEsQ0FBQTtlQUtBLElBQUMsQ0FBQSxhQUFELENBQUEsRUFORjtPQUFBLE1BT0ssSUFBRyxZQUFIO0FBQ0gsUUFBQSxJQUFBLEdBQU8sSUFBQyxDQUFBLElBQUssQ0FBQSxJQUFBLENBQWIsQ0FBQTtBQUNBLFFBQUEsSUFBRyxjQUFBLElBQVUsQ0FBQSxJQUFRLENBQUMsZ0JBQUwsQ0FBQSxDQUFqQjtBQUNFLFVBQUEsR0FBQSxHQUFNLElBQUksQ0FBQyxHQUFMLENBQUEsQ0FBTixDQUFBO0FBQ0EsVUFBQSxJQUFHLEdBQUEsWUFBZSxHQUFHLENBQUMsU0FBdEI7bUJBQ0UsR0FBRyxDQUFDLGFBQUosQ0FBQSxFQURGO1dBQUEsTUFBQTttQkFHRSxJQUhGO1dBRkY7U0FBQSxNQUFBO2lCQU9FLE9BUEY7U0FGRztPQUFBLE1BQUE7QUFXSCxRQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7QUFDQTtBQUFBLGFBQUEsWUFBQTt5QkFBQTtBQUNFLFVBQUEsSUFBRyxDQUFBLENBQUssQ0FBQyxnQkFBRixDQUFBLENBQVA7QUFDRSxZQUFBLE1BQU8sQ0FBQSxJQUFBLENBQVAsR0FBZSxDQUFDLENBQUMsR0FBRixDQUFBLENBQWYsQ0FERjtXQURGO0FBQUEsU0FEQTtlQUlBLE9BZkc7T0FSRjtJQUFBLENBdEJMLENBQUE7O0FBQUEseUJBK0NBLFNBQUEsR0FBUSxTQUFDLElBQUQsR0FBQTtBQUNOLFVBQUEsSUFBQTs7WUFBVyxDQUFFLGFBQWIsQ0FBQTtPQUFBO2FBQ0EsS0FGTTtJQUFBLENBL0NSLENBQUE7O0FBQUEseUJBbURBLFdBQUEsR0FBYSxTQUFDLGFBQUQsR0FBQTtBQUNYLFVBQUEsd0NBQUE7QUFBQSxNQUFBLElBQU8sZ0NBQVA7QUFDRSxRQUFBLGdCQUFBLEdBQ0U7QUFBQSxVQUFBLElBQUEsRUFBTSxhQUFOO1NBREYsQ0FBQTtBQUFBLFFBRUEsVUFBQSxHQUFhLElBRmIsQ0FBQTtBQUFBLFFBR0EsTUFBQSxHQUNFO0FBQUEsVUFBQSxXQUFBLEVBQWEsSUFBYjtBQUFBLFVBQ0EsR0FBQSxFQUFLLGFBREw7QUFBQSxVQUVBLEdBQUEsRUFBSyxJQUZMO1NBSkYsQ0FBQTtBQUFBLFFBT0EsRUFBQSxHQUFTLElBQUEsR0FBRyxDQUFDLGNBQUosQ0FBbUIsSUFBbkIsRUFBeUIsZ0JBQXpCLEVBQTJDLFVBQTNDLEVBQXVELE1BQXZELENBUFQsQ0FBQTtBQUFBLFFBUUEsSUFBQyxDQUFBLElBQUssQ0FBQSxhQUFBLENBQU4sR0FBdUIsRUFSdkIsQ0FBQTtBQUFBLFFBU0EsRUFBRSxDQUFDLFNBQUgsQ0FBYSxJQUFiLEVBQWdCLGFBQWhCLENBVEEsQ0FBQTtBQUFBLFFBVUEsRUFBRSxDQUFDLE9BQUgsQ0FBQSxDQVZBLENBREY7T0FBQTthQVlBLElBQUMsQ0FBQSxJQUFLLENBQUEsYUFBQSxFQWJLO0lBQUEsQ0FuRGIsQ0FBQTs7c0JBQUE7O0tBTDJCLEdBQUcsQ0FBQyxVQVBqQyxDQUFBO0FBQUEsRUE4RUEsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFmLEdBQXVCLFNBQUMsSUFBRCxHQUFBO0FBQ3JCLFFBQUEsZ0JBQUE7QUFBQSxJQUNVLFdBQVIsTUFERixFQUVrQixtQkFBaEIsY0FGRixDQUFBO1dBSUksSUFBQSxJQUFBLENBQUssV0FBTCxFQUFrQixHQUFsQixFQUxpQjtFQUFBLENBOUV2QixDQUFBO0FBQUEsRUEyRk0sR0FBRyxDQUFDO0FBT1Isa0NBQUEsQ0FBQTs7QUFBYSxJQUFBLHFCQUFDLFdBQUQsRUFBYyxHQUFkLEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxTQUFELEdBQWlCLElBQUEsR0FBRyxDQUFDLFNBQUosQ0FBYyxNQUFkLEVBQXlCLE1BQXpCLENBQWpCLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxHQUFELEdBQWlCLElBQUEsR0FBRyxDQUFDLFNBQUosQ0FBYyxJQUFDLENBQUEsU0FBZixFQUEwQixNQUExQixDQURqQixDQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsU0FBUyxDQUFDLE9BQVgsR0FBcUIsSUFBQyxDQUFBLEdBRnRCLENBQUE7QUFBQSxNQUdBLElBQUMsQ0FBQSxTQUFTLENBQUMsT0FBWCxDQUFBLENBSEEsQ0FBQTtBQUFBLE1BSUEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxPQUFMLENBQUEsQ0FKQSxDQUFBO0FBQUEsTUFLQSw2Q0FBTSxXQUFOLEVBQW1CLEdBQW5CLENBTEEsQ0FEVztJQUFBLENBQWI7O0FBQUEsMEJBUUEsSUFBQSxHQUFNLGFBUk4sQ0FBQTs7QUFBQSwwQkFVQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1gsVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLEdBQUwsQ0FBQTtBQUNBLGFBQU0sU0FBTixHQUFBO0FBQ0UsUUFBQSxDQUFDLENBQUMsV0FBRixDQUFBLENBQUEsQ0FBQTtBQUFBLFFBQ0EsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQUROLENBREY7TUFBQSxDQURBO2FBSUEsMkNBQUEsRUFMVztJQUFBLENBVmIsQ0FBQTs7QUFBQSwwQkFpQkEsT0FBQSxHQUFTLFNBQUEsR0FBQTthQUNQLHVDQUFBLEVBRE87SUFBQSxDQWpCVCxDQUFBOztBQUFBLDBCQW9CQSxNQUFBLEdBQVEsU0FBQyxrQkFBRCxHQUFBO0FBQ04sVUFBQSw2QkFBQTs7UUFETyxxQkFBcUI7T0FDNUI7QUFBQSxNQUFBLEdBQUEsR0FBTSxJQUFDLENBQUEsR0FBRCxDQUFBLENBQU4sQ0FBQTtBQUNBO1dBQUEsa0RBQUE7bUJBQUE7QUFDRSxRQUFBLElBQUcsQ0FBQSxZQUFhLEdBQUcsQ0FBQyxNQUFwQjt3QkFDRSxDQUFDLENBQUMsTUFBRixDQUFTLGtCQUFULEdBREY7U0FBQSxNQUVLLElBQUcsQ0FBQSxZQUFhLEdBQUcsQ0FBQyxXQUFwQjt3QkFDSCxDQUFDLENBQUMsTUFBRixDQUFTLGtCQUFULEdBREc7U0FBQSxNQUVBLElBQUcsa0JBQUEsSUFBdUIsQ0FBQSxZQUFhLEdBQUcsQ0FBQyxTQUEzQzt3QkFDSCxDQUFDLENBQUMsR0FBRixDQUFBLEdBREc7U0FBQSxNQUFBO3dCQUdILEdBSEc7U0FMUDtBQUFBO3NCQUZNO0lBQUEsQ0FwQlIsQ0FBQTs7QUFBQSwwQkFvQ0EsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLE1BQUEsSUFBRyxJQUFDLENBQUEsdUJBQUQsQ0FBQSxDQUFIO0FBQ0UsUUFBQSxJQUFDLENBQUEsU0FBUyxDQUFDLFNBQVgsQ0FBcUIsSUFBckIsQ0FBQSxDQUFBO0FBQUEsUUFDQSxJQUFDLENBQUEsR0FBRyxDQUFDLFNBQUwsQ0FBZSxJQUFmLENBREEsQ0FBQTtlQUVBLDBDQUFBLFNBQUEsRUFIRjtPQUFBLE1BQUE7ZUFLRSxNQUxGO09BRE87SUFBQSxDQXBDVCxDQUFBOztBQUFBLDBCQTZDQSxnQkFBQSxHQUFrQixTQUFBLEdBQUE7YUFDaEIsSUFBQyxDQUFBLEdBQUcsQ0FBQyxRQURXO0lBQUEsQ0E3Q2xCLENBQUE7O0FBQUEsMEJBaURBLGlCQUFBLEdBQW1CLFNBQUEsR0FBQTthQUNqQixJQUFDLENBQUEsU0FBUyxDQUFDLFFBRE07SUFBQSxDQWpEbkIsQ0FBQTs7QUFBQSwwQkFzREEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNQLFVBQUEsU0FBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxTQUFTLENBQUMsT0FBZixDQUFBO0FBQUEsTUFDQSxNQUFBLEdBQVMsRUFEVCxDQUFBO0FBRUEsYUFBTSxDQUFBLEtBQU8sSUFBQyxDQUFBLEdBQWQsR0FBQTtBQUNFLFFBQUEsSUFBRyxDQUFBLENBQUssQ0FBQyxVQUFUO0FBQ0UsVUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLENBQUMsQ0FBQyxHQUFGLENBQUEsQ0FBWixDQUFBLENBREY7U0FBQTtBQUFBLFFBRUEsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQUZOLENBREY7TUFBQSxDQUZBO2FBTUEsT0FQTztJQUFBLENBdERULENBQUE7O0FBQUEsMEJBK0RBLEdBQUEsR0FBSyxTQUFDLENBQUQsR0FBQTtBQUNILFVBQUEsU0FBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxTQUFTLENBQUMsT0FBZixDQUFBO0FBQUEsTUFDQSxNQUFBLEdBQVMsRUFEVCxDQUFBO0FBRUEsYUFBTSxDQUFBLEtBQU8sSUFBQyxDQUFBLEdBQWQsR0FBQTtBQUNFLFFBQUEsSUFBRyxDQUFBLENBQUssQ0FBQyxVQUFUO0FBQ0UsVUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLENBQUEsQ0FBRSxDQUFGLENBQVosQ0FBQSxDQURGO1NBQUE7QUFBQSxRQUVBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FGTixDQURGO01BQUEsQ0FGQTthQU1BLE9BUEc7SUFBQSxDQS9ETCxDQUFBOztBQUFBLDBCQXdFQSxJQUFBLEdBQU0sU0FBQyxJQUFELEVBQU8sQ0FBUCxHQUFBO0FBQ0osVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLFNBQVMsQ0FBQyxPQUFmLENBQUE7QUFDQSxhQUFNLENBQUEsS0FBTyxJQUFDLENBQUEsR0FBZCxHQUFBO0FBQ0UsUUFBQSxJQUFHLENBQUEsQ0FBSyxDQUFDLFVBQVQ7QUFDRSxVQUFBLElBQUEsR0FBTyxDQUFBLENBQUUsSUFBRixFQUFRLENBQVIsQ0FBUCxDQURGO1NBQUE7QUFBQSxRQUVBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FGTixDQURGO01BQUEsQ0FEQTthQUtBLEtBTkk7SUFBQSxDQXhFTixDQUFBOztBQUFBLDBCQWdGQSxHQUFBLEdBQUssU0FBQyxHQUFELEdBQUE7QUFDSCxVQUFBLENBQUE7QUFBQSxNQUFBLElBQUcsV0FBSDtBQUNFLFFBQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxzQkFBRCxDQUF3QixHQUFBLEdBQUksQ0FBNUIsQ0FBSixDQUFBO0FBQ0EsUUFBQSxJQUFHLENBQUEsQ0FBSyxDQUFBLFlBQWEsR0FBRyxDQUFDLFNBQWxCLENBQVA7aUJBQ0UsQ0FBQyxDQUFDLEdBQUYsQ0FBQSxFQURGO1NBQUEsTUFBQTtBQUdFLGdCQUFVLElBQUEsS0FBQSxDQUFNLDhCQUFOLENBQVYsQ0FIRjtTQUZGO09BQUEsTUFBQTtlQU9FLElBQUMsQ0FBQSxPQUFELENBQUEsRUFQRjtPQURHO0lBQUEsQ0FoRkwsQ0FBQTs7QUFBQSwwQkFnR0Esc0JBQUEsR0FBd0IsU0FBQyxRQUFELEdBQUE7QUFDdEIsVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLFNBQUwsQ0FBQTtBQUNBLGFBQU0sSUFBTixHQUFBO0FBRUUsUUFBQSxJQUFHLENBQUEsWUFBYSxHQUFHLENBQUMsU0FBakIsSUFBK0IsbUJBQWxDO0FBSUUsVUFBQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BQU4sQ0FBQTtBQUNBLGlCQUFNLENBQUMsQ0FBQyxTQUFGLENBQUEsQ0FBQSxJQUFrQixtQkFBeEIsR0FBQTtBQUNFLFlBQUEsQ0FBQSxHQUFJLENBQUMsQ0FBQyxPQUFOLENBREY7VUFBQSxDQURBO0FBR0EsZ0JBUEY7U0FBQTtBQVFBLFFBQUEsSUFBRyxRQUFBLElBQVksQ0FBWixJQUFrQixDQUFBLENBQUssQ0FBQyxTQUFGLENBQUEsQ0FBekI7QUFDRSxnQkFERjtTQVJBO0FBQUEsUUFXQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BWE4sQ0FBQTtBQVlBLFFBQUEsSUFBRyxDQUFBLENBQUssQ0FBQyxTQUFGLENBQUEsQ0FBUDtBQUNFLFVBQUEsUUFBQSxJQUFZLENBQVosQ0FERjtTQWRGO01BQUEsQ0FEQTthQWlCQSxFQWxCc0I7SUFBQSxDQWhHeEIsQ0FBQTs7QUFBQSwwQkFvSEEsSUFBQSxHQUFNLFNBQUMsT0FBRCxHQUFBO2FBQ0osSUFBQyxDQUFBLFdBQUQsQ0FBYSxJQUFDLENBQUEsR0FBRyxDQUFDLE9BQWxCLEVBQTJCLENBQUMsT0FBRCxDQUEzQixFQURJO0lBQUEsQ0FwSE4sQ0FBQTs7QUFBQSwwQkF1SEEsV0FBQSxHQUFhLFNBQUMsSUFBRCxFQUFPLFFBQVAsR0FBQTtBQUNYLFVBQUEsdUJBQUE7QUFBQSxNQUFBLEtBQUEsR0FBUSxJQUFJLENBQUMsT0FBYixDQUFBO0FBQ0EsYUFBTSxLQUFLLENBQUMsU0FBTixDQUFBLENBQU4sR0FBQTtBQUNFLFFBQUEsS0FBQSxHQUFRLEtBQUssQ0FBQyxPQUFkLENBREY7TUFBQSxDQURBO0FBQUEsTUFHQSxJQUFBLEdBQU8sS0FBSyxDQUFDLE9BSGIsQ0FBQTtBQU1BLE1BQUEsSUFBRyxRQUFBLFlBQW9CLEdBQUcsQ0FBQyxTQUEzQjtBQUNFLFFBQUEsQ0FBSyxJQUFBLEdBQUcsQ0FBQyxNQUFKLENBQVcsSUFBWCxFQUFpQixPQUFqQixFQUEwQixNQUExQixFQUFxQyxJQUFyQyxFQUEyQyxLQUEzQyxDQUFMLENBQXNELENBQUMsT0FBdkQsQ0FBQSxDQUFBLENBREY7T0FBQSxNQUFBO0FBR0UsYUFBQSwrQ0FBQTsyQkFBQTtBQUNFLFVBQUEsSUFBRyxXQUFBLElBQU8saUJBQVAsSUFBb0IscUJBQXZCO0FBQ0UsWUFBQSxDQUFBLEdBQUksQ0FBQyxDQUFDLFNBQUYsQ0FBWSxJQUFDLENBQUEsWUFBYixFQUEyQixJQUFDLENBQUEsVUFBNUIsQ0FBSixDQURGO1dBQUE7QUFBQSxVQUVBLEdBQUEsR0FBTSxDQUFLLElBQUEsR0FBRyxDQUFDLE1BQUosQ0FBVyxJQUFYLEVBQWlCLENBQWpCLEVBQW9CLE1BQXBCLEVBQStCLElBQS9CLEVBQXFDLEtBQXJDLENBQUwsQ0FBZ0QsQ0FBQyxPQUFqRCxDQUFBLENBRk4sQ0FBQTtBQUFBLFVBR0EsSUFBQSxHQUFPLEdBSFAsQ0FERjtBQUFBLFNBSEY7T0FOQTthQWNBLEtBZlc7SUFBQSxDQXZIYixDQUFBOztBQUFBLDBCQThJQSxNQUFBLEdBQVEsU0FBQyxRQUFELEVBQVcsUUFBWCxHQUFBO0FBQ04sVUFBQSxHQUFBO0FBQUEsTUFBQSxHQUFBLEdBQU0sSUFBQyxDQUFBLHNCQUFELENBQXdCLFFBQXhCLENBQU4sQ0FBQTthQUdBLElBQUMsQ0FBQSxXQUFELENBQWEsR0FBYixFQUFrQixRQUFsQixFQUpNO0lBQUEsQ0E5SVIsQ0FBQTs7QUFBQSwwQkF5SkEsU0FBQSxHQUFRLFNBQUMsUUFBRCxFQUFXLE1BQVgsR0FBQTtBQUNOLFVBQUEsdUJBQUE7O1FBRGlCLFNBQVM7T0FDMUI7QUFBQSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsc0JBQUQsQ0FBd0IsUUFBQSxHQUFTLENBQWpDLENBQUosQ0FBQTtBQUFBLE1BRUEsVUFBQSxHQUFhLEVBRmIsQ0FBQTtBQUdBLFdBQVMsa0ZBQVQsR0FBQTtBQUNFLFFBQUEsSUFBRyxDQUFBLFlBQWEsR0FBRyxDQUFDLFNBQXBCO0FBQ0UsZ0JBREY7U0FBQTtBQUFBLFFBRUEsQ0FBQSxHQUFJLENBQUssSUFBQSxHQUFHLENBQUMsTUFBSixDQUFXLElBQVgsRUFBaUIsTUFBakIsRUFBNEIsQ0FBNUIsQ0FBTCxDQUFtQyxDQUFDLE9BQXBDLENBQUEsQ0FGSixDQUFBO0FBQUEsUUFHQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BSE4sQ0FBQTtBQUlBLGVBQU0sQ0FBQyxDQUFBLENBQUssQ0FBQSxZQUFhLEdBQUcsQ0FBQyxTQUFsQixDQUFMLENBQUEsSUFBdUMsQ0FBQyxDQUFDLFNBQUYsQ0FBQSxDQUE3QyxHQUFBO0FBQ0UsVUFBQSxDQUFBLEdBQUksQ0FBQyxDQUFDLE9BQU4sQ0FERjtRQUFBLENBSkE7QUFBQSxRQU1BLFVBQVUsQ0FBQyxJQUFYLENBQWdCLENBQUMsQ0FBQyxPQUFGLENBQUEsQ0FBaEIsQ0FOQSxDQURGO0FBQUEsT0FIQTthQVdBLEtBWk07SUFBQSxDQXpKUixDQUFBOzt1QkFBQTs7S0FQNEIsR0FBRyxDQUFDLFVBM0ZsQyxDQUFBO0FBQUEsRUF5UUEsR0FBRyxDQUFDLFdBQVcsQ0FBQyxLQUFoQixHQUF3QixTQUFDLElBQUQsR0FBQTtBQUN0QixRQUFBLGdCQUFBO0FBQUEsSUFDVSxXQUFSLE1BREYsRUFFaUIsbUJBQWYsY0FGRixDQUFBO1dBSUksSUFBQSxJQUFBLENBQUssV0FBTCxFQUFrQixHQUFsQixFQUxrQjtFQUFBLENBelF4QixDQUFBO0FBQUEsRUF3Uk0sR0FBRyxDQUFDO0FBUVIscUNBQUEsQ0FBQTs7QUFBYSxJQUFBLHdCQUFDLFdBQUQsRUFBZSxnQkFBZixFQUFrQyxVQUFsQyxFQUE4QyxHQUE5QyxFQUFtRCxTQUFuRCxFQUE4RCxHQUE5RCxHQUFBO0FBQ1gsTUFEeUIsSUFBQyxDQUFBLG1CQUFBLGdCQUMxQixDQUFBO0FBQUEsTUFENEMsSUFBQyxDQUFBLGFBQUEsVUFDN0MsQ0FBQTtBQUFBLE1BQUEsSUFBTyx1Q0FBUDtBQUNFLFFBQUEsSUFBQyxDQUFBLGdCQUFpQixDQUFBLFFBQUEsQ0FBbEIsR0FBOEIsSUFBQyxDQUFBLFVBQVUsQ0FBQyxhQUFaLENBQUEsQ0FBOUIsQ0FERjtPQUFBO0FBQUEsTUFFQSxnREFBTSxXQUFOLEVBQW1CLEdBQW5CLEVBQXdCLFNBQXhCLEVBQW1DLEdBQW5DLENBRkEsQ0FEVztJQUFBLENBQWI7O0FBQUEsNkJBS0EsSUFBQSxHQUFNLGdCQUxOLENBQUE7O0FBQUEsNkJBT0EsV0FBQSxHQUFhLFNBQUEsR0FBQTtBQUNYLFVBQUEsQ0FBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxTQUFMLENBQUE7QUFDQSxhQUFNLFNBQU4sR0FBQTtBQUNFLFFBQUEsQ0FBQyxDQUFDLFdBQUYsQ0FBQSxDQUFBLENBQUE7QUFBQSxRQUNBLENBQUEsR0FBSSxDQUFDLENBQUMsT0FETixDQURGO01BQUEsQ0FEQTthQUlBLDhDQUFBLEVBTFc7SUFBQSxDQVBiLENBQUE7O0FBQUEsNkJBY0EsT0FBQSxHQUFTLFNBQUEsR0FBQTthQUNQLDBDQUFBLEVBRE87SUFBQSxDQWRULENBQUE7O0FBQUEsNkJBd0JBLGtCQUFBLEdBQW9CLFNBQUMsTUFBRCxHQUFBO0FBQ2xCLFVBQUEsaUNBQUE7QUFBQSxNQUFBLElBQUcsQ0FBQSxJQUFLLENBQUEsU0FBRCxDQUFBLENBQVA7QUFDRSxhQUFBLDZDQUFBOzZCQUFBO0FBQ0U7QUFBQSxlQUFBLFlBQUE7OEJBQUE7QUFDRSxZQUFBLEtBQU0sQ0FBQSxJQUFBLENBQU4sR0FBYyxJQUFkLENBREY7QUFBQSxXQURGO0FBQUEsU0FBQTtBQUFBLFFBR0EsSUFBQyxDQUFBLFVBQVUsQ0FBQyxTQUFaLENBQXNCLE1BQXRCLENBSEEsQ0FERjtPQUFBO2FBS0EsT0FOa0I7SUFBQSxDQXhCcEIsQ0FBQTs7QUFBQSw2QkFzQ0EsT0FBQSxHQUFTLFNBQUMsT0FBRCxFQUFVLGVBQVYsR0FBQTtBQUNQLFVBQUEsT0FBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxnQkFBRCxDQUFBLENBQUosQ0FBQTtBQUFBLE1BQ0EsSUFBQSxHQUFPLENBQUssSUFBQSxHQUFHLENBQUMsV0FBSixDQUFnQixJQUFoQixFQUFzQixPQUF0QixFQUErQixJQUEvQixFQUFrQyxlQUFsQyxFQUFtRCxDQUFuRCxFQUFzRCxDQUFDLENBQUMsT0FBeEQsQ0FBTCxDQUFxRSxDQUFDLE9BQXRFLENBQUEsQ0FEUCxDQUFBO2FBR0EsT0FKTztJQUFBLENBdENULENBQUE7O0FBQUEsNkJBNENBLGdCQUFBLEdBQWtCLFNBQUEsR0FBQTthQUNoQixJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUFtQixDQUFDLFNBQXBCLENBQUEsRUFEZ0I7SUFBQSxDQTVDbEIsQ0FBQTs7QUFBQSw2QkErQ0EsYUFBQSxHQUFlLFNBQUEsR0FBQTtBQUNiLE1BQUEsQ0FBSyxJQUFBLEdBQUcsQ0FBQyxNQUFKLENBQVcsSUFBWCxFQUFpQixNQUFqQixFQUE0QixJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUFtQixDQUFDLEdBQWhELENBQUwsQ0FBeUQsQ0FBQyxPQUExRCxDQUFBLENBQUEsQ0FBQTthQUNBLE9BRmE7SUFBQSxDQS9DZixDQUFBOztBQUFBLDZCQXVEQSxHQUFBLEdBQUssU0FBQSxHQUFBO0FBQ0gsVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBQyxDQUFBLGdCQUFELENBQUEsQ0FBSixDQUFBOzJDQUdBLENBQUMsQ0FBQyxlQUpDO0lBQUEsQ0F2REwsQ0FBQTs7QUFBQSw2QkFnRUEsT0FBQSxHQUFTLFNBQUMsSUFBRCxHQUFBOztRQUFDLE9BQU87T0FDZjtBQUFBLE1BQUEsSUFBSSxDQUFDLFNBQUwsR0FBaUIsSUFBQyxDQUFBLFNBQVMsQ0FBQyxNQUFYLENBQUEsQ0FBakIsQ0FBQTtBQUFBLE1BQ0EsSUFBSSxDQUFDLEdBQUwsR0FBVyxJQUFDLENBQUEsR0FBRyxDQUFDLE1BQUwsQ0FBQSxDQURYLENBQUE7YUFFQSw0Q0FBTSxJQUFOLEVBSE87SUFBQSxDQWhFVCxDQUFBOzswQkFBQTs7S0FSK0IsR0FBRyxDQUFDLFlBeFJyQyxDQUFBO0FBQUEsRUEwV00sR0FBRyxDQUFDO0FBT1Isa0NBQUEsQ0FBQTs7QUFBYSxJQUFBLHFCQUFDLFdBQUQsRUFBYyxPQUFkLEVBQXVCLE1BQXZCLEVBQStCLEdBQS9CLEVBQW9DLElBQXBDLEVBQTBDLElBQTFDLEVBQWdELE1BQWhELEdBQUE7QUFDWCxNQUFBLElBQUMsQ0FBQSxhQUFELENBQWUsUUFBZixFQUF5QixNQUF6QixDQUFBLENBQUE7QUFBQSxNQUNBLDZDQUFNLFdBQU4sRUFBbUIsT0FBbkIsRUFBNEIsR0FBNUIsRUFBaUMsSUFBakMsRUFBdUMsSUFBdkMsRUFBNkMsTUFBN0MsQ0FEQSxDQURXO0lBQUEsQ0FBYjs7QUFBQSwwQkFJQSxJQUFBLEdBQU0sYUFKTixDQUFBOztBQUFBLDBCQVdBLGlDQUFBLEdBQW1DLFNBQUEsR0FBQTtBQUNqQyxVQUFBLFNBQUE7QUFBQSxNQUFBLElBQUcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxJQUFULEtBQWlCLFdBQWpCLElBQWlDLElBQUMsQ0FBQSxPQUFPLENBQUMsSUFBVCxLQUFtQixXQUF2RDtBQUVFLFFBQUEsSUFBRyxDQUFBLElBQUssQ0FBQSxVQUFSO0FBQ0UsVUFBQSxTQUFBLEdBQVksSUFBQyxDQUFBLE9BQU8sQ0FBQyxHQUFULENBQUEsQ0FBWixDQUFBO0FBQUEsVUFDQSxJQUFDLENBQUEsTUFBTSxDQUFDLGtCQUFSLENBQTJCO1lBQ3pCO0FBQUEsY0FBQSxJQUFBLEVBQU0sUUFBTjtBQUFBLGNBQ0EsU0FBQSxFQUFXLElBQUMsQ0FBQSxHQUFHLENBQUMsT0FEaEI7QUFBQSxjQUVBLFFBQUEsRUFBVSxTQUZWO2FBRHlCO1dBQTNCLENBREEsQ0FERjtTQUFBO0FBQUEsUUFPQSxJQUFDLENBQUEsT0FBTyxDQUFDLFdBQVQsQ0FBQSxDQVBBLENBRkY7T0FBQSxNQVVLLElBQUcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxJQUFULEtBQW1CLFdBQXRCO0FBR0gsUUFBQSxJQUFDLENBQUEsV0FBRCxDQUFBLENBQUEsQ0FIRztPQUFBLE1BQUE7QUFLSCxRQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsa0JBQVIsQ0FBMkI7VUFDekI7QUFBQSxZQUFBLElBQUEsRUFBTSxLQUFOO0FBQUEsWUFDQSxTQUFBLEVBQVcsSUFBQyxDQUFBLEdBQUcsQ0FBQyxPQURoQjtXQUR5QjtTQUEzQixDQUFBLENBTEc7T0FWTDthQW1CQSxPQXBCaUM7SUFBQSxDQVhuQyxDQUFBOztBQUFBLDBCQWlDQSxpQ0FBQSxHQUFtQyxTQUFDLENBQUQsR0FBQTtBQUNqQyxNQUFBLElBQUcsSUFBQyxDQUFBLE9BQU8sQ0FBQyxJQUFULEtBQWlCLFdBQXBCO2VBQ0UsSUFBQyxDQUFBLE1BQU0sQ0FBQyxrQkFBUixDQUEyQjtVQUN6QjtBQUFBLFlBQUEsSUFBQSxFQUFNLFFBQU47QUFBQSxZQUNBLFNBQUEsRUFBVyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BRGpCO0FBQUEsWUFFQSxRQUFBLEVBQVUsSUFBQyxDQUFBLEdBQUQsQ0FBQSxDQUZWO1dBRHlCO1NBQTNCLEVBREY7T0FEaUM7SUFBQSxDQWpDbkMsQ0FBQTs7QUFBQSwwQkE0Q0EsT0FBQSxHQUFTLFNBQUMsSUFBRCxHQUFBOztRQUFDLE9BQU87T0FDZjthQUFBLHlDQUFNLElBQU4sRUFETztJQUFBLENBNUNULENBQUE7O3VCQUFBOztLQVA0QixHQUFHLENBQUMsT0ExV2xDLENBQUE7QUFBQSxFQWdhQSxHQUFHLENBQUMsV0FBVyxDQUFDLEtBQWhCLEdBQXdCLFNBQUMsSUFBRCxHQUFBO0FBQ3RCLFFBQUEscURBQUE7QUFBQSxJQUNjLGVBQVosVUFERixFQUVhLGNBQVgsU0FGRixFQUdVLFdBQVIsTUFIRixFQUlVLFlBQVIsT0FKRixFQUtVLFlBQVIsT0FMRixFQU1hLGNBQVgsU0FORixFQU9rQixtQkFBaEIsY0FQRixDQUFBO0FBU0EsSUFBQSxJQUFHLE1BQUEsQ0FBQSxPQUFBLEtBQWtCLFFBQXJCO0FBQ0UsTUFBQSxPQUFBLEdBQVUsSUFBSSxDQUFDLEtBQUwsQ0FBVyxPQUFYLENBQVYsQ0FERjtLQVRBO1dBV0ksSUFBQSxJQUFBLENBQUssV0FBTCxFQUFrQixPQUFsQixFQUEyQixNQUEzQixFQUFtQyxHQUFuQyxFQUF3QyxJQUF4QyxFQUE4QyxJQUE5QyxFQUFvRCxNQUFwRCxFQVprQjtFQUFBLENBaGF4QixDQUFBO1NBK2FBLFVBaGJlO0FBQUEsQ0FGakIsQ0FBQTs7OztBQ0NBLElBQUEsT0FBQTs7QUFBQTtBQUVlLEVBQUEsaUJBQUUsT0FBRixHQUFBO0FBQ1gsUUFBQSxlQUFBO0FBQUEsSUFEWSxJQUFDLENBQUEsNEJBQUEsVUFBVSxFQUN2QixDQUFBO0FBQUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxPQUFPLENBQUMsV0FBVCxLQUF3QixNQUEzQjtBQUNFO0FBQUEsV0FBQSxZQUFBO3lCQUFBO0FBQ0UsUUFBQSxJQUFHLEdBQUcsQ0FBQyxXQUFKLEtBQW1CLE1BQXRCO0FBQ0UsVUFBQSxJQUFDLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBVCxHQUFxQixJQUFBLE9BQUEsQ0FBUSxHQUFSLENBQXJCLENBREY7U0FERjtBQUFBLE9BREY7S0FBQSxNQUFBO0FBS0UsWUFBVSxJQUFBLEtBQUEsQ0FBTSxvQ0FBTixDQUFWLENBTEY7S0FEVztFQUFBLENBQWI7O0FBQUEsb0JBUUEsS0FBQSxHQUFPLFFBUlAsQ0FBQTs7QUFBQSxvQkFVQSxTQUFBLEdBQVcsU0FBQyxLQUFELEVBQVEsR0FBUixHQUFBO0FBQ1QsUUFBQSxVQUFBO0FBQUEsSUFBQSxJQUFPLG1CQUFQO0FBQ0UsTUFBQSxJQUFDLENBQUEsTUFBRCxHQUFjLElBQUEsR0FBRyxDQUFDLFVBQUosQ0FBZSxJQUFmLENBQWlCLENBQUMsT0FBbEIsQ0FBQSxDQUFkLENBQUE7QUFDQTtBQUFBLFdBQUEsU0FBQTtvQkFBQTtBQUNFLFFBQUEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxHQUFSLENBQVksQ0FBWixFQUFlLENBQWYsQ0FBQSxDQURGO0FBQUEsT0FGRjtLQUFBO0FBQUEsSUFJQSxNQUFBLENBQUEsSUFBUSxDQUFBLE9BSlIsQ0FBQTtXQUtBLElBQUMsQ0FBQSxPQU5RO0VBQUEsQ0FWWCxDQUFBOztBQUFBLG9CQWtCQSxTQUFBLEdBQVcsU0FBRSxNQUFGLEdBQUE7QUFDVCxJQURVLElBQUMsQ0FBQSxTQUFBLE1BQ1gsQ0FBQTtXQUFBLE1BQUEsQ0FBQSxJQUFRLENBQUEsUUFEQztFQUFBLENBbEJYLENBQUE7O0FBQUEsb0JBcUJBLE9BQUEsR0FBUyxTQUFDLENBQUQsR0FBQTtBQUNQLElBQUEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxPQUFSLENBQWdCLENBQWhCLENBQUEsQ0FBQTtXQUNBLEtBRk87RUFBQSxDQXJCVCxDQUFBOztBQUFBLG9CQXlCQSxTQUFBLEdBQVcsU0FBQyxDQUFELEdBQUE7QUFDVCxJQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsU0FBUixDQUFrQixDQUFsQixDQUFBLENBQUE7V0FDQSxLQUZTO0VBQUEsQ0F6QlgsQ0FBQTs7QUFBQSxvQkE2Q0EsR0FBQSxHQUFLLFNBQUMsSUFBRCxFQUFPLE9BQVAsR0FBQTtBQUNILFFBQUEsZUFBQTtBQUFBLElBQUEsSUFBRyxtQkFBSDthQUNFLElBQUMsQ0FBQSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQVosQ0FBa0IsSUFBQyxDQUFBLE1BQW5CLEVBQTJCLFNBQTNCLEVBREY7S0FBQSxNQUFBO0FBR0UsTUFBQSxJQUFHLGVBQUg7ZUFDRSxJQUFDLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBVCxHQUFpQixRQURuQjtPQUFBLE1BRUssSUFBRyxZQUFIO2VBQ0gsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLEVBRE47T0FBQSxNQUFBO0FBR0gsUUFBQSxHQUFBLEdBQU0sRUFBTixDQUFBO0FBQ0E7QUFBQSxhQUFBLFNBQUE7c0JBQUE7QUFDRSxVQUFBLEdBQUksQ0FBQSxDQUFBLENBQUosR0FBUyxDQUFULENBREY7QUFBQSxTQURBO2VBR0EsSUFORztPQUxQO0tBREc7RUFBQSxDQTdDTCxDQUFBOztBQUFBLG9CQTJEQSxTQUFBLEdBQVEsU0FBQyxJQUFELEdBQUE7QUFDTixJQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsUUFBRCxDQUFQLENBQWUsSUFBZixDQUFBLENBQUE7V0FDQSxLQUZNO0VBQUEsQ0EzRFIsQ0FBQTs7aUJBQUE7O0lBRkYsQ0FBQTs7QUFpRUEsSUFBRyxnREFBSDtBQUNFLEVBQUEsSUFBRyxnQkFBSDtBQUNFLElBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFULEdBQWtCLE9BQWxCLENBREY7R0FBQSxNQUFBO0FBR0UsVUFBVSxJQUFBLEtBQUEsQ0FBTSwwQkFBTixDQUFWLENBSEY7R0FERjtDQWpFQTs7QUF1RUEsSUFBRyxnREFBSDtBQUNFLEVBQUEsTUFBTSxDQUFDLE9BQVAsR0FBaUIsT0FBakIsQ0FERjtDQXZFQTs7OztBQ0FBLElBQUEsNEVBQUE7O0FBQUEsNEJBQUEsR0FBK0IsT0FBQSxDQUFRLHlCQUFSLENBQS9CLENBQUE7O0FBQUEsYUFFQSxHQUFnQixPQUFBLENBQVEsaUJBQVIsQ0FGaEIsQ0FBQTs7QUFBQSxNQUdBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FIVCxDQUFBOztBQUFBLGNBSUEsR0FBaUIsT0FBQSxDQUFRLG9CQUFSLENBSmpCLENBQUE7O0FBQUEsT0FNQSxHQUFVLFNBQUMsU0FBRCxHQUFBO0FBQ1IsTUFBQSxnREFBQTtBQUFBLEVBQUEsT0FBQSxHQUFVLElBQVYsQ0FBQTtBQUNBLEVBQUEsSUFBRyx5QkFBSDtBQUNFLElBQUEsT0FBQSxHQUFVLFNBQVMsQ0FBQyxPQUFwQixDQURGO0dBQUEsTUFBQTtBQUdFLElBQUEsT0FBQSxHQUFVLE9BQVYsQ0FBQTtBQUFBLElBQ0EsU0FBUyxDQUFDLGNBQVYsR0FBMkIsU0FBQyxFQUFELEdBQUE7QUFDekIsTUFBQSxPQUFBLEdBQVUsRUFBVixDQUFBO2FBQ0EsRUFBRSxDQUFDLFdBQUgsQ0FBZSxFQUFmLEVBRnlCO0lBQUEsQ0FEM0IsQ0FIRjtHQURBO0FBQUEsRUFRQSxFQUFBLEdBQVMsSUFBQSxhQUFBLENBQWMsT0FBZCxDQVJULENBQUE7QUFBQSxFQVNBLFdBQUEsR0FBYyw0QkFBQSxDQUE2QixFQUE3QixFQUFpQyxJQUFJLENBQUMsV0FBdEMsQ0FUZCxDQUFBO0FBQUEsRUFVQSxHQUFBLEdBQU0sV0FBVyxDQUFDLFVBVmxCLENBQUE7QUFBQSxFQVlBLE1BQUEsR0FBYSxJQUFBLE1BQUEsQ0FBTyxFQUFQLEVBQVcsR0FBWCxDQVpiLENBQUE7QUFBQSxFQWFBLGNBQUEsQ0FBZSxTQUFmLEVBQTBCLE1BQTFCLEVBQWtDLEVBQWxDLEVBQXNDLFdBQVcsQ0FBQyxrQkFBbEQsQ0FiQSxDQUFBO0FBQUEsRUFlQSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUF4QixHQUE2QixFQWY3QixDQUFBO0FBQUEsRUFnQkEsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsVUFBeEIsR0FBcUMsR0FoQnJDLENBQUE7QUFBQSxFQWlCQSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUF4QixHQUFpQyxNQWpCakMsQ0FBQTtBQUFBLEVBa0JBLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFNBQXhCLEdBQW9DLFNBbEJwQyxDQUFBO0FBQUEsRUFtQkEsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsWUFBeEIsR0FBdUMsSUFBSSxDQUFDLFdBbkI1QyxDQUFBO0FBQUEsRUFxQkEsRUFBQSxHQUFTLElBQUEsT0FBTyxDQUFDLE1BQVIsQ0FBQSxDQXJCVCxDQUFBO0FBQUEsRUFzQkEsS0FBQSxHQUFZLElBQUEsR0FBRyxDQUFDLFVBQUosQ0FBZSxFQUFmLEVBQW1CLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQW5CLENBQW9ELENBQUMsT0FBckQsQ0FBQSxDQXRCWixDQUFBO0FBQUEsRUF1QkEsRUFBRSxDQUFDLFNBQUgsQ0FBYSxLQUFiLENBdkJBLENBQUE7U0F3QkEsR0F6QlE7QUFBQSxDQU5WLENBQUE7O0FBQUEsTUFpQ00sQ0FBQyxPQUFQLEdBQWlCLE9BakNqQixDQUFBOztBQWtDQSxJQUFHLGdEQUFIO0FBQ0UsRUFBQSxNQUFNLENBQUMsQ0FBUCxHQUFXLE9BQVgsQ0FERjtDQWxDQTs7QUFBQSxPQXFDTyxDQUFDLE1BQVIsR0FBaUIsT0FBQSxDQUFRLGdCQUFSLENBckNqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuQ29ubmVjdG9yQ2xhc3MgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JDbGFzc1wiXG4jXG4jIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4jIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiNcbmFkYXB0Q29ubmVjdG9yID0gKGNvbm5lY3RvciwgZW5naW5lLCBIQiwgZXhlY3V0aW9uX2xpc3RlbmVyKS0+XG5cbiAgZm9yIG5hbWUsIGYgb2YgQ29ubmVjdG9yQ2xhc3NcbiAgICBjb25uZWN0b3JbbmFtZV0gPSBmXG5cbiAgY29ubmVjdG9yLnNldElzQm91bmRUb1koKVxuXG4gIHNlbmRfID0gKG8pLT5cbiAgICBpZiAoby51aWQuY3JlYXRvciBpcyBIQi5nZXRVc2VySWQoKSkgYW5kXG4gICAgICAgICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIikgYW5kICMgVE9ETzogaSBkb24ndCB0aGluayB0aGF0IHdlIG5lZWQgdGhpcyBhbnltb3JlLi5cbiAgICAgICAgKEhCLmdldFVzZXJJZCgpIGlzbnQgXCJfdGVtcFwiKVxuICAgICAgY29ubmVjdG9yLmJyb2FkY2FzdCBvXG5cbiAgaWYgY29ubmVjdG9yLmludm9rZVN5bmM/XG4gICAgSEIuc2V0SW52b2tlU3luY0hhbmRsZXIgY29ubmVjdG9yLmludm9rZVN5bmNcblxuICBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuICAjIEZvciB0aGUgWE1QUENvbm5lY3RvcjogbGV0cyBzZW5kIGl0IGFzIGFuIGFycmF5XG4gICMgdGhlcmVmb3JlLCB3ZSBoYXZlIHRvIHJlc3RydWN0dXJlIGl0IGxhdGVyXG4gIGVuY29kZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxuICAgIGZvciBuYW1lLHZhbHVlIG9mIHZcbiAgICAgIHVzZXI6IG5hbWVcbiAgICAgIHN0YXRlOiB2YWx1ZVxuICBwYXJzZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHt9XG4gICAgZm9yIHMgaW4gdlxuICAgICAgc3RhdGVfdmVjdG9yW3MudXNlcl0gPSBzLnN0YXRlXG4gICAgc3RhdGVfdmVjdG9yXG5cbiAgZ2V0U3RhdGVWZWN0b3IgPSAoKS0+XG4gICAgZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcblxuICBnZXRIQiA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0gcGFyc2Vfc3RhdGVfdmVjdG9yIHZcbiAgICBoYiA9IEhCLl9lbmNvZGUgc3RhdGVfdmVjdG9yXG4gICAganNvbiA9XG4gICAgICBoYjogaGJcbiAgICAgIHN0YXRlX3ZlY3RvcjogZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICBqc29uXG5cbiAgYXBwbHlIQiA9IChoYiwgZnJvbUhCKS0+XG4gICAgZW5naW5lLmFwcGx5T3AgaGIsIGZyb21IQlxuXG4gIGNvbm5lY3Rvci5nZXRTdGF0ZVZlY3RvciA9IGdldFN0YXRlVmVjdG9yXG4gIGNvbm5lY3Rvci5nZXRIQiA9IGdldEhCXG4gIGNvbm5lY3Rvci5hcHBseUhCID0gYXBwbHlIQlxuXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzID89IFtdXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzLnB1c2ggKHNlbmRlciwgb3ApLT5cbiAgICBpZiBvcC51aWQuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICBlbmdpbmUuYXBwbHlPcCBvcFxuXG5cbm1vZHVsZS5leHBvcnRzID0gYWRhcHRDb25uZWN0b3IiLCJcbm1vZHVsZS5leHBvcnRzID1cbiAgI1xuICAjIEBwYXJhbXMgbmV3IENvbm5lY3RvcihvcHRpb25zKVxuICAjICAgQHBhcmFtIG9wdGlvbnMuc3luY01ldGhvZCB7U3RyaW5nfSAgaXMgZWl0aGVyIFwic3luY0FsbFwiIG9yIFwibWFzdGVyLXNsYXZlXCIuXG4gICMgICBAcGFyYW0gb3B0aW9ucy5yb2xlIHtTdHJpbmd9IFRoZSByb2xlIG9mIHRoaXMgY2xpZW50XG4gICMgICAgICAgICAgICAoc2xhdmUgb3IgbWFzdGVyIChvbmx5IHVzZWQgd2hlbiBzeW5jTWV0aG9kIGlzIG1hc3Rlci1zbGF2ZSkpXG4gICMgICBAcGFyYW0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4ge0Jvb2xlYW59IFdoZXRlaHIgdG8gd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycywgYnV0IGhhcyBzb21lIG92ZXJoZWFkIChvcHRpb25hbClcbiAgI1xuICBpbml0OiAob3B0aW9ucyktPlxuICAgIHJlcSA9IChuYW1lLCBjaG9pY2VzKT0+XG4gICAgICBpZiBvcHRpb25zW25hbWVdP1xuICAgICAgICBpZiAobm90IGNob2ljZXM/KSBvciBjaG9pY2VzLnNvbWUoKGMpLT5jIGlzIG9wdGlvbnNbbmFtZV0pXG4gICAgICAgICAgQFtuYW1lXSA9IG9wdGlvbnNbbmFtZV1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4gc2V0IHRoZSAnXCIrbmFtZStcIicgb3B0aW9uIHRvIG9uZSBvZiB0aGUgZm9sbG93aW5nIGNob2ljZXM6IFwiK0pTT04uZW5jb2RlKGNob2ljZXMpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IHNwZWNpZnkgXCIrbmFtZStcIiwgd2hlbiBpbml0aWFsaXppbmcgdGhlIENvbm5lY3RvciFcIlxuXG4gICAgcmVxIFwic3luY01ldGhvZFwiLCBbXCJzeW5jQWxsXCIsIFwibWFzdGVyLXNsYXZlXCJdXG4gICAgcmVxIFwicm9sZVwiLCBbXCJtYXN0ZXJcIiwgXCJzbGF2ZVwiXVxuICAgIHJlcSBcInVzZXJfaWRcIlxuICAgIEBvbl91c2VyX2lkX3NldD8oQHVzZXJfaWQpXG5cbiAgICAjIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMuXG4gICAgIyBCdXQgdGhpcyBpcyBub3QgbmVjZXNzYXJ5IGluIHRoZSB0ZXN0LWNvbm5lY3RvclxuICAgIGlmIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluP1xuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluXG4gICAgZWxzZVxuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IHRydWVcblxuICAgICMgQSBNYXN0ZXIgc2hvdWxkIHN5bmMgd2l0aCBldmVyeW9uZSEgVE9ETzogcmVhbGx5PyAtIGZvciBub3cgaXRzIHNhZmVyIHRoaXMgd2F5IVxuICAgIGlmIEByb2xlIGlzIFwibWFzdGVyXCJcbiAgICAgIEBzeW5jTWV0aG9kID0gXCJzeW5jQWxsXCJcblxuICAgICMgaXMgc2V0IHRvIHRydWUgd2hlbiB0aGlzIGlzIHN5bmNlZCB3aXRoIGFsbCBvdGhlciBjb25uZWN0aW9uc1xuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxuICAgICMgUGVlcmpzIENvbm5lY3Rpb25zOiBrZXk6IGNvbm4taWQsIHZhbHVlOiBvYmplY3RcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgICMgTGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBzaGFsbCBwcm9jZXNzIGluY29taW5nIGRhdGFcbiAgICBAcmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxuXG4gICAgIyB3aGV0aGVyIHRoaXMgaW5zdGFuY2UgaXMgYm91bmQgdG8gYW55IHkgaW5zdGFuY2VcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IGZhbHNlXG4gICAgQGlzX2luaXRpYWxpemVkID0gdHJ1ZVxuXG4gIGlzUm9sZU1hc3RlcjogLT5cbiAgICBAcm9sZSBpcyBcIm1hc3RlclwiXG5cbiAgaXNSb2xlU2xhdmU6IC0+XG4gICAgQHJvbGUgaXMgXCJzbGF2ZVwiXG5cbiAgZmluZE5ld1N5bmNUYXJnZXQ6ICgpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGlmIG5vdCBjLmlzX3N5bmNlZFxuICAgICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICAgICAgYnJlYWtcbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAc2V0U3RhdGVTeW5jZWQoKVxuICAgIG51bGxcblxuICB1c2VyTGVmdDogKHVzZXIpLT5cbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXG4gICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcblxuICB1c2VySm9pbmVkOiAodXNlciwgcm9sZSktPlxuICAgIGlmIG5vdCByb2xlP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSW50ZXJuYWw6IFlvdSBtdXN0IHNwZWNpZnkgdGhlIHJvbGUgb2YgdGhlIGpvaW5lZCB1c2VyISBFLmcuIHVzZXJKb2luZWQoJ3VpZDozOTM5Jywnc2xhdmUnKVwiXG4gICAgIyBhIHVzZXIgam9pbmVkIHRoZSByb29tXG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdID89IHt9XG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdLmlzX3N5bmNlZCA9IGZhbHNlXG5cbiAgICBpZiAobm90IEBpc19zeW5jZWQpIG9yIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgZWxzZSBpZiByb2xlIGlzIFwibWFzdGVyXCJcbiAgICAgICAgIyBUT0RPOiBXaGF0IGlmIHRoZXJlIGFyZSB0d28gbWFzdGVycz8gUHJldmVudCBzZW5kaW5nIGV2ZXJ5dGhpbmcgdHdvIHRpbWVzIVxuICAgICAgICBAcGVyZm9ybVN5bmNXaXRoTWFzdGVyIHVzZXJcblxuXG4gICNcbiAgIyBFeGVjdXRlIGEgZnVuY3Rpb24gX3doZW5fIHdlIGFyZSBjb25uZWN0ZWQuIElmIG5vdCBjb25uZWN0ZWQsIHdhaXQgdW50aWwgY29ubmVjdGVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgYXJncy5jb25zdHJ1Y3RvcmUgaXMgRnVuY3Rpb25cbiAgICAgIGFyZ3MgPSBbYXJnc11cbiAgICBpZiBAaXNfc3luY2VkXG4gICAgICBhcmdzWzBdLmFwcGx5IHRoaXMsIGFyZ3NbMS4uXVxuICAgIGVsc2VcbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkID89IFtdXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZC5wdXNoIGFyZ3NcblxuICAjXG4gICMgRXhlY3V0ZSBhbiBmdW5jdGlvbiB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC4gZiB3aWxsIGJlIGNhbGxlZCB3aXRoIChzZW5kZXJfaWQsIGJyb2FkY2FzdCB7dHJ1ZXxmYWxzZX0sIG1lc3NhZ2UpLlxuICAjXG4gIG9uUmVjZWl2ZTogKGYpLT5cbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcblxuICAjIyNcbiAgIyBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBjb25uZWN0ZWQgcGVlcnMuXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gYnJvYWRjYXN0LlxuICAjXG4gIGJyb2FkY2FzdDogKG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgYnJvYWRjYXN0IVwiXG5cbiAgI1xuICAjIFNlbmQgYSBtZXNzYWdlIHRvIGEgcGVlciwgb3Igc2V0IG9mIHBlZXJzXG4gICNcbiAgc2VuZDogKHBlZXJfcywgbWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBzZW5kIVwiXG4gICMjI1xuXG4gICNcbiAgIyBwZXJmb3JtIGEgc3luYyB3aXRoIGEgc3BlY2lmaWMgdXNlci5cbiAgI1xuICBwZXJmb3JtU3luYzogKHVzZXIpLT5cbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICAgIEBzZW5kIHVzZXIsXG4gICAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgIGRhdGE6IFtdICMgQGdldFN0YXRlVmVjdG9yKClcbiAgICAgIGlmIG5vdCBAc2VudF9oYl90b19hbGxfdXNlcnNcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxuXG4gICAgICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMzBcbiAgICAgICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG5cblxuICAjXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxuICAjXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICBAc2VuZCB1c2VyLFxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICBkYXRhOiBbXVxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgIF9oYiA9IFtdXG4gICAgZm9yIG8gaW4gaGJcbiAgICAgIF9oYi5wdXNoIG9cbiAgICAgIGlmIF9oYi5sZW5ndGggPiAzMFxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgX2hiID0gW11cbiAgICBAYnJvYWRjYXN0XG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICBkYXRhOiBfaGJcblxuICAjXG4gICMgWW91IGFyZSBzdXJlIHRoYXQgYWxsIGNsaWVudHMgYXJlIHN5bmNlZCwgY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XG4gICAgaWYgbm90IEBpc19zeW5jZWRcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cbiAgICAgICAgZm9yIGYgaW4gQGNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgICAgICBmKClcbiAgICAgICAgZGVsZXRlIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICBudWxsXG5cbiAgI1xuICAjIFlvdSByZWNlaXZlZCBhIHJhdyBtZXNzYWdlLCBhbmQgeW91IGtub3cgdGhhdCBpdCBpcyBpbnRlbmRlZCBmb3IgdG8gWWpzLiBUaGVuIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICByZWNlaXZlTWVzc2FnZTogKHNlbmRlciwgcmVzKS0+XG4gICAgaWYgbm90IHJlcy5zeW5jX3N0ZXA/XG4gICAgICBmb3IgZiBpbiBAcmVjZWl2ZV9oYW5kbGVyc1xuICAgICAgICBmIHNlbmRlciwgcmVzXG4gICAgZWxzZVxuICAgICAgaWYgc2VuZGVyIGlzIEB1c2VyX2lkXG4gICAgICAgIHJldHVyblxuICAgICAgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImdldEhCXCJcbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcbiAgICAgICAgaGIgPSBkYXRhLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxuICAgICAgICAjIFdoZW4gdGhpcyBjbGllbnQgb25seSBzeW5jcyB0byBvbmUgb3RoZXIgY2xpZW50cywgYnV0IGxvb3NlcyBjb25uZWN0b3JzLFxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcbiAgICAgICAgaWYgQGlzX3N5bmNlZFxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXG5cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDMwXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG5cbiAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxuICAgICAgICAgICAgKCk9PlxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogaGJcbiAgICAgICAgICAgICAgICBzZW50X2FnYWluOiBcInRydWVcIlxuICAgICAgICAgIHNldFRpbWVvdXQgc2VuZF9hZ2FpbiwgMzAwMFxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQlwiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cbiAgICAgICAgaWYgKEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiIG9yIHJlcy5zZW50X2FnYWluPykgYW5kIChub3QgQGlzX3N5bmNlZCkgYW5kICgoQGN1cnJlbnRfc3luY190YXJnZXQgaXMgc2VuZGVyKSBvciAobm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0PykpXG4gICAgICAgICAgQGNvbm5lY3Rpb25zW3NlbmRlcl0uaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG5cbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJfXCJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcblxuXG4gICMgQ3VycmVudGx5LCB0aGUgSEIgZW5jb2RlcyBvcGVyYXRpb25zIGFzIEpTT04uIEZvciB0aGUgbW9tZW50IEkgd2FudCB0byBrZWVwIGl0XG4gICMgdGhhdCB3YXkuIE1heWJlIHdlIHN1cHBvcnQgZW5jb2RpbmcgaW4gdGhlIEhCIGFzIFhNTCBpbiB0aGUgZnV0dXJlLCBidXQgZm9yIG5vdyBJIGRvbid0IHdhbnRcbiAgIyB0b28gbXVjaCBvdmVyaGVhZC4gWSBpcyB2ZXJ5IGxpa2VseSB0byBnZXQgY2hhbmdlZCBhIGxvdCBpbiB0aGUgZnV0dXJlXG4gICNcbiAgIyBCZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gZW5jb2RlIEpTT04gYXMgc3RyaW5nICh3aXRoIGNoYXJhY3RlciBlc2NhcGluZywgd2ljaCBtYWtlcyBpdCBwcmV0dHkgbXVjaCB1bnJlYWRhYmxlKVxuICAjIHdlIGVuY29kZSB0aGUgSlNPTiBhcyBYTUwuXG4gICNcbiAgIyBXaGVuIHRoZSBIQiBzdXBwb3J0IGVuY29kaW5nIGFzIFhNTCwgdGhlIGZvcm1hdCBzaG91bGQgbG9vayBwcmV0dHkgbXVjaCBsaWtlIHRoaXMuXG5cbiAgIyBkb2VzIG5vdCBzdXBwb3J0IHByaW1pdGl2ZSB2YWx1ZXMgYXMgYXJyYXkgZWxlbWVudHNcbiAgIyBleHBlY3RzIGFuIGx0eCAobGVzcyB0aGFuIHhtbCkgb2JqZWN0XG4gIHBhcnNlTWVzc2FnZUZyb21YbWw6IChtKS0+XG4gICAgcGFyc2VfYXJyYXkgPSAobm9kZSktPlxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBwYXJzZV9hcnJheSBuXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBwYXJzZV9vYmplY3QgblxuXG4gICAgcGFyc2Vfb2JqZWN0ID0gKG5vZGUpLT5cbiAgICAgIGpzb24gPSB7fVxuICAgICAgZm9yIG5hbWUsIHZhbHVlICBvZiBub2RlLmF0dHJzXG4gICAgICAgIGludCA9IHBhcnNlSW50KHZhbHVlKVxuICAgICAgICBpZiBpc05hTihpbnQpIG9yIChcIlwiK2ludCkgaXNudCB2YWx1ZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSB2YWx1ZVxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IGludFxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxuICAgICAgICBuYW1lID0gbi5uYW1lXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9hcnJheSBuXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2Vfb2JqZWN0IG5cbiAgICAgIGpzb25cbiAgICBwYXJzZV9vYmplY3QgbVxuXG4gICMgZW5jb2RlIG1lc3NhZ2UgaW4geG1sXG4gICMgd2UgdXNlIHN0cmluZyBiZWNhdXNlIFN0cm9waGUgb25seSBhY2NlcHRzIGFuIFwieG1sLXN0cmluZ1wiLi5cbiAgIyBTbyB7YTo0LGI6e2M6NX19IHdpbGwgbG9vayBsaWtlXG4gICMgPHkgYT1cIjRcIj5cbiAgIyAgIDxiIGM9XCI1XCI+PC9iPlxuICAjIDwveT5cbiAgIyBtIC0gbHR4IGVsZW1lbnRcbiAgIyBqc29uIC0gZ3Vlc3MgaXQgOylcbiAgI1xuICBlbmNvZGVNZXNzYWdlVG9YbWw6IChtLCBqc29uKS0+XG4gICAgIyBhdHRyaWJ1dGVzIGlzIG9wdGlvbmFsXG4gICAgZW5jb2RlX29iamVjdCA9IChtLCBqc29uKS0+XG4gICAgICBmb3IgbmFtZSx2YWx1ZSBvZiBqc29uXG4gICAgICAgIGlmIG5vdCB2YWx1ZT9cbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKG5hbWUpLCB2YWx1ZVxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIEFycmF5XG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG0uc2V0QXR0cmlidXRlKG5hbWUsdmFsdWUpXG4gICAgICBtXG4gICAgZW5jb2RlX2FycmF5ID0gKG0sIGFycmF5KS0+XG4gICAgICBtLnNldEF0dHJpYnV0ZShcImlzQXJyYXlcIixcInRydWVcIilcbiAgICAgIGZvciBlIGluIGFycmF5XG4gICAgICAgIGlmIGUuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJhcnJheS1lbGVtZW50XCIpLCBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgbVxuICAgIGlmIGpzb24uY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxuICAgIGVsc2UgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgZW5jb2RlX2FycmF5IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkkgY2FuJ3QgZW5jb2RlIHRoaXMganNvbiFcIlxuXG4gIHNldElzQm91bmRUb1k6ICgpLT5cbiAgICBAb25fYm91bmRfdG9feT8oKVxuICAgIGRlbGV0ZSBAd2hlbl9ib3VuZF90b195XG4gICAgQGlzX2JvdW5kX3RvX3kgPSB0cnVlXG4iLCJcbndpbmRvdz8udW5wcm9jZXNzZWRfY291bnRlciA9IDAgIyBkZWwgdGhpc1xud2luZG93Py51bnByb2Nlc3NlZF9leGVjX2NvdW50ZXIgPSAwICMgVE9ET1xud2luZG93Py51bnByb2Nlc3NlZF90eXBlcyA9IFtdXG5cbiNcbiMgQG5vZG9jXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXG4jXG5jbGFzcyBFbmdpbmVcblxuICAjXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAjIEBwYXJhbSB7T2JqZWN0fSB0eXBlcyBsaXN0IG9mIGF2YWlsYWJsZSB0eXBlc1xuICAjXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAdHlwZXMpLT5cbiAgICBAdW5wcm9jZXNzZWRfb3BzID0gW11cblxuICAjXG4gICMgUGFyc2VzIGFuIG9wZXJhdGlvIGZyb20gdGhlIGpzb24gZm9ybWF0LiBJdCB1c2VzIHRoZSBzcGVjaWZpZWQgcGFyc2VyIGluIHlvdXIgT3BlcmF0aW9uVHlwZSBtb2R1bGUuXG4gICNcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XG4gICAgdHlwZSA9IEB0eXBlc1tqc29uLnR5cGVdXG4gICAgaWYgdHlwZT8ucGFyc2U/XG4gICAgICB0eXBlLnBhcnNlIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXG5cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLl9lbmNvZGUoKS5cbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcbiAgIyMjXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cbiAgICBvcHMgPSBbXVxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xuICAgIGZvciBvIGluIG9wc1xuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcbiAgIyMjXG5cbiAgI1xuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXG4gICNcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIGlmIG5vdCBASEIuZ2V0T3BlcmF0aW9uKG8udWlkKT9cbiAgICAgICAgQGFwcGx5T3Agb1xuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wXG4gIGFwcGx5T3BzOiAob3BzX2pzb24pLT5cbiAgICBAYXBwbHlPcCBvcHNfanNvblxuXG4gICNcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICMgVE9ETzogbWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50ISFcbiAgIyAtIG9wZXJhdGlvbnMgbWF5IG9ubHkgZXhlY3V0ZWQgaW4gb3JkZXIgYnkgY3JlYXRvciwgb3JkZXIgdGhlbSBpbiBvYmplY3Qgb2YgYXJyYXlzIChrZXkgYnkgY3JlYXRvcilcbiAgIyAtIHlvdSBjYW4gcHJvYmFibHkgbWFrZSBzb21ldGhpbmcgbGlrZSBkZXBlbmRlbmNpZXMgKGNyZWF0b3IxIHdhaXRzIGZvciBjcmVhdG9yMilcbiAgYXBwbHlPcDogKG9wX2pzb25fYXJyYXksIGZyb21IQiA9IGZhbHNlKS0+XG4gICAgaWYgb3BfanNvbl9hcnJheS5jb25zdHJ1Y3RvciBpc250IEFycmF5XG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXG4gICAgZm9yIG9wX2pzb24gaW4gb3BfanNvbl9hcnJheVxuICAgICAgaWYgZnJvbUhCXG4gICAgICAgIG9wX2pzb24uZnJvbUhCID0gXCJ0cnVlXCIgIyBleGVjdXRlIGltbWVkaWF0ZWx5LCBpZlxuICAgICAgIyAkcGFyc2VfYW5kX2V4ZWN1dGUgd2lsbCByZXR1cm4gZmFsc2UgaWYgJG9fanNvbiB3YXMgcGFyc2VkIGFuZCBleGVjdXRlZCwgb3RoZXJ3aXNlIHRoZSBwYXJzZWQgb3BlcmFkaW9uXG4gICAgICBvID0gQHBhcnNlT3BlcmF0aW9uIG9wX2pzb25cbiAgICAgIG8ucGFyc2VkX2Zyb21fanNvbiA9IG9wX2pzb25cbiAgICAgIGlmIG9wX2pzb24uZnJvbUhCP1xuICAgICAgICBvLmZyb21IQiA9IG9wX2pzb24uZnJvbUhCXG4gICAgICAjIEBIQi5hZGRPcGVyYXRpb24gb1xuICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvKT9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgKChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykpIG9yIChub3Qgby5leGVjdXRlKCkpXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXG4gICAgICAgIHdpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMucHVzaCBvLnR5cGUgIyBUT0RPOiBkZWxldGUgdGhpc1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG5cbiAgI1xuICAjIENhbGwgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYXBwbGllZCBhIG5ldyBvcGVyYXRpb24uXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxuICAjXG4gIHRyeVVucHJvY2Vzc2VkOiAoKS0+XG4gICAgd2hpbGUgdHJ1ZVxuICAgICAgb2xkX2xlbmd0aCA9IEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoXG4gICAgICB1bnByb2Nlc3NlZCA9IFtdXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xuICAgICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG9wKT9cbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIChub3QgQEhCLmlzRXhwZWN0ZWRPcGVyYXRpb24ob3ApIGFuZCAobm90IG9wLmZyb21IQj8pKSBvciAobm90IG9wLmV4ZWN1dGUoKSlcbiAgICAgICAgICB1bnByb2Nlc3NlZC5wdXNoIG9wXG4gICAgICBAdW5wcm9jZXNzZWRfb3BzID0gdW5wcm9jZXNzZWRcbiAgICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzIG9sZF9sZW5ndGhcbiAgICAgICAgYnJlYWtcbiAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpc250IDBcbiAgICAgIEBIQi5pbnZva2VTeW5jKClcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEVuZ2luZVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuIiwiXG4jXG4jIEBub2RvY1xuIyBBbiBvYmplY3QgdGhhdCBob2xkcyBhbGwgYXBwbGllZCBvcGVyYXRpb25zLlxuI1xuIyBAbm90ZSBUaGUgSGlzdG9yeUJ1ZmZlciBpcyBjb21tb25seSBhYmJyZXZpYXRlZCB0byBIQi5cbiNcbmNsYXNzIEhpc3RvcnlCdWZmZXJcblxuICAjXG4gICMgQ3JlYXRlcyBhbiBlbXB0eSBIQi5cbiAgIyBAcGFyYW0ge09iamVjdH0gdXNlcl9pZCBDcmVhdG9yIG9mIHRoZSBIQi5cbiAgI1xuICBjb25zdHJ1Y3RvcjogKEB1c2VyX2lkKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyID0ge31cbiAgICBAYnVmZmVyID0ge31cbiAgICBAY2hhbmdlX2xpc3RlbmVycyA9IFtdXG4gICAgQGdhcmJhZ2UgPSBbXSAjIFdpbGwgYmUgY2xlYW5lZCBvbiBuZXh0IGNhbGwgb2YgZ2FyYmFnZUNvbGxlY3RvclxuICAgIEB0cmFzaCA9IFtdICMgSXMgZGVsZXRlZC4gV2FpdCB1bnRpbCBpdCBpcyBub3QgdXNlZCBhbnltb3JlLlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSB0cnVlXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCA9IDMwMDAwXG4gICAgQHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlciA9IDBcbiAgICBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcblxuICByZXNldFVzZXJJZDogKGlkKS0+XG4gICAgb3duID0gQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBvd24/XG4gICAgICBmb3Igb19uYW1lLG8gb2Ygb3duXG4gICAgICAgIGlmIG8udWlkLmNyZWF0b3I/XG4gICAgICAgICAgby51aWQuY3JlYXRvciA9IGlkXG4gICAgICAgIGlmIG8udWlkLmFsdD9cbiAgICAgICAgICBvLnVpZC5hbHQuY3JlYXRvciA9IGlkXG4gICAgICBpZiBAYnVmZmVyW2lkXT9cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGFyZSByZS1hc3NpZ25pbmcgYW4gb2xkIHVzZXIgaWQgLSB0aGlzIGlzIG5vdCAoeWV0KSBwb3NzaWJsZSFcIlxuICAgICAgQGJ1ZmZlcltpZF0gPSBvd25cbiAgICAgIGRlbGV0ZSBAYnVmZmVyW0B1c2VyX2lkXVxuICAgIGlmIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF0/XG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbaWRdID0gQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXVxuICAgICAgZGVsZXRlIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICBAdXNlcl9pZCA9IGlkXG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxuICAgICAgby5jbGVhbnVwPygpXG5cbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxuICAgIEB0cmFzaCA9IFtdXG4gICAgaWYgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCBpc250IC0xXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcbiAgICB1bmRlZmluZWRcblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxuICAgICAgZm9yIG8gaW4gYXJndW1lbnRzXG4gICAgICAgIGlmIG8/XG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXG5cbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXG4gICAgQHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0KClcbiAgICBAZ2FyYmFnZSA9IFtdXG4gICAgQHRyYXNoID0gW11cblxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxuICAgIGNsZWFyVGltZW91dCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWRcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcblxuICBzZXRHYXJiYWdlQ29sbGVjdFRpbWVvdXQ6IChAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0KS0+XG5cbiAgI1xuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICByZXMgPSB7fVxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICAgIHJlc1xuICAgIGVsc2VcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBvLnVpZC5vcF9udW1iZXIgPD0gQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XG5cbiAgI1xuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXG4gICAgICBpZiB1X25hbWUgaXMgXCJfXCJcbiAgICAgICAgY29udGludWVcbiAgICAgIGZvciBvX251bWJlcixvIG9mIHVzZXJcbiAgICAgICAgaWYgKG5vdCBvLnVpZC5ub09wZXJhdGlvbj8pIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/ICMgYXBwbGllcyBmb3IgYWxsIG9wcyBidXQgdGhlIG1vc3QgcmlnaHQgZGVsaW1pdGVyIVxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQudWlkLmNyZWF0b3IsIG9fbmV4dC51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD8gIyBtb3N0IHJpZ2h0IGRlbGltaXRlciBvbmx5IVxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX3ByZXYudWlkLmNyZWF0b3IsIG9fcHJldi51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxuICAjIG9uIHRoZSBvcGVyYXRpb25zIHJldHJpZXZlU3ViIG1ldGhvZCAod2hpY2ggbXVzdCEgYmUgZGVmaW5lZClcbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBpZiB1aWQuc3ViPyBhbmQgbz9cbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxuICAgIGVsc2VcbiAgICAgIG9cblxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSkpIGFuZCBzdGF0ZV92ZWN0b3JbdXNlcl0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxuICAgIGlmIG8udWlkLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcbiAgICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgd2hpbGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1dP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSAtIChvLnVpZC5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgb3BzID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wcy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQpLT5cbiAgICAgIGlmIGN1c3RvbV90eXBlP1xuICAgICAgICBAY3VzdG9tX3R5cGUgPSBjdXN0b21fdHlwZVxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXSAjIFRPRE86IHJlbmFtZSB0byBvYnNlcnZlcnMgb3Igc3RoIGxpa2UgdGhhdFxuICAgICAgaWYgdWlkP1xuICAgICAgICBAdWlkID0gdWlkXG5cbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXG5cbiAgICByZXRyaWV2ZVN1YjogKCktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzLnB1c2ggZlxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBmdW5jdGlvbiBmcm9tIHRoZSBvYnNlcnZlciBsaXN0XG4gICAgIyBAc2VlIE9wZXJhdGlvbi5vYnNlcnZlXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHVub2JzZXJ2ZShldmVudCwgZilcbiAgICAjICAgQHBhcmFtIGYgICAgIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRoYXQgeW91IHdhbnQgdG8gZGVsZXRlIFxuICAgIHVub2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBAZXZlbnRfbGlzdGVuZXJzLmZpbHRlciAoZyktPlxuICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgIyBUaGlzIHNob3VsZCBiZSBjYWxsZWQsIGUuZy4gYWZ0ZXIgdGhpcyBoYXMgYmVlbiByZXBsYWNlZC5cbiAgICAjIChUaGVuIG9ubHkgb25lIHJlcGxhY2UgZXZlbnQgc2hvdWxkIGZpcmUuIClcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxuICAgIGRlbGV0ZUFsbE9ic2VydmVyczogKCktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdXG5cbiAgICBkZWxldGU6ICgpLT5cbiAgICAgIChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIEApLmV4ZWN1dGUoKVxuICAgICAgbnVsbFxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cbiAgICAgICAgY2FsbG9uID0gQGdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZVxuICAgICAgICBjYWxsb24gPSBAXG4gICAgICBAZm9yd2FyZEV2ZW50IGNhbGxvbiwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBASEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxuICAgICAgQGRlbGV0ZUFsbE9ic2VydmVycygpXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEB1aWRcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXG4gICAgICAgICAgbWFwX3VpZCA9IEB1aWQuYWx0LmNsb25lVWlkKClcbiAgICAgICAgICBtYXBfdWlkLnN1YiA9IEB1aWQuc3ViXG4gICAgICAgICAgbWFwX3VpZFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbG9uZVVpZDogKCktPlxuICAgICAgdWlkID0ge31cbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXG4gICAgICAgIHVpZFtuXSA9IHZcbiAgICAgIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAjIFdoZW4gdGhpcyBvcGVyYXRpb24gd2FzIGNyZWF0ZWQgd2l0aG91dCBhIHVpZCwgdGhlbiBzZXQgaXQgaGVyZS5cbiAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICBAdWlkID0gQEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBASEIuYWRkT3BlcmF0aW9uIEBcbiAgICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi50eXBlID0gQHR5cGVcbiAgICAgIGpzb24udWlkID0gQGdldFVpZCgpXG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XG4gICAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlLl9uYW1lXG4gICAgICBqc29uXG5cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG5vdCBvcD9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgb3AuZXhlY3V0ZT8gb3Igbm90IChvcC5vcF9udW1iZXI/IGFuZCBvcC5jcmVhdG9yPylcbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWQsIG9yIG9wIGlzIHN0cmluZy4gQ3VycmVudGx5IFwiRGVsaW1pdGVyXCIgaXMgc2F2ZWQgYXMgc3RyaW5nXG4gICAgICAgICMgKGluIGNvbWJpbmF0aW9uIHdpdGggQHBhcmVudCB5b3UgY2FuIHJldHJpZXZlIHRoZSBkZWxpbWl0ZXIuLilcbiAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICBlbHNlXG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gQEhCLmdldE9wZXJhdGlvbiBvcF91aWRcbiAgICAgICAgaWYgb3BcbiAgICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuaW5zdGFudGlhdGVkW25hbWVdID0gb3BfdWlkXG4gICAgICAgICAgc3VjY2VzcyA9IGZhbHNlXG4gICAgICBkZWxldGUgQHVuY2hlY2tlZFxuICAgICAgaWYgbm90IHN1Y2Nlc3NcbiAgICAgICAgQHVuY2hlY2tlZCA9IHVuaW5zdGFudGlhdGVkXG4gICAgICBzdWNjZXNzXG5cbiAgICBnZXRDdXN0b21UeXBlOiAoKS0+XG4gICAgICBpZiBub3QgQGN1c3RvbV90eXBlP1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXG4gICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXG4gICAgICAgICMgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldCAob25seSB0aGUgbmFtZSBpcyBzcGVjaWZpZWQpXG4gICAgICAgIEBjdXN0b21fdHlwZSA9IG5ldyBAY3VzdG9tX3R5cGVzW0BjdXN0b21fdHlwZV0oKVxuICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcbiAgICAgIEBjdXN0b21fdHlwZVxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIG9wcy5EZWxldGUucGFyc2UgPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcbiAgI1xuICBjbGFzcyBvcHMuSW5zZXJ0IGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBjb250ZW50LCB1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiwgcGFyZW50KS0+XG4gICAgICAjIHNlZSBlbmNvZGUgdG8gc2VlLCB3aHkgd2UgYXJlIGRvaW5nIGl0IHRoaXMgd2F5XG4gICAgICBpZiBjb250ZW50IGlzIHVuZGVmaW5lZFxuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiBjb250ZW50PyBhbmQgY29udGVudC5jcmVhdG9yP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQgPSBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIkluc2VydFwiXG5cbiAgICB2YWw6ICgpLT5cbiAgICAgIGlmIEBjb250ZW50PyBhbmQgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZT9cbiAgICAgICAgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBzZXQgY29udGVudCB0byBudWxsIGFuZCBvdGhlciBzdHVmZlxuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgY2FsbExhdGVyID0gZmFsc2VcbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzX2RlbGV0ZWQgYW5kIG8/ICMgbz8gOiBpZiBub3Qgbz8sIHRoZW4gdGhlIGRlbGltaXRlciBkZWxldGVkIHRoaXMgSW5zZXJ0aW9uLiBGdXJ0aGVybW9yZSwgaXQgd291bGQgYmUgd3JvbmcgdG8gY2FsbCBpdC4gVE9ETzogbWFrZSB0aGlzIG1vcmUgZXhwcmVzc2l2ZSBhbmQgc2F2ZVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgY2FsbExhdGVyID0gdHJ1ZVxuICAgICAgaWYgbz9cbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICBpZiBjYWxsTGF0ZXJcbiAgICAgICAgQGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyhvKVxuICAgICAgaWYgQHByZXZfY2w/LmlzRGVsZXRlZCgpXG4gICAgICAgICMgZ2FyYmFnZSBjb2xsZWN0IHByZXZfY2xcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJyaWdodCBpcyBub3QgZGVsZXRlZC4gaW5jb25zaXN0ZW5jeSEsIHdyYXJhcmFyXCJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XG4gICAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgICB3aGlsZSBvLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxuICAgICAgICAgICAgby5vcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQG5leHRfY2xcbiAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBwcmV2X2NsXG5cbiAgICAgICAgIyBkZWxldGUgY29udGVudFxuICAgICAgICAjIC0gd2UgbXVzdCBub3QgZG8gdGhpcyBpbiBhcHBseURlbGV0ZSwgYmVjYXVzZSB0aGlzIHdvdWxkIGxlYWQgdG8gaW5jb25zaXN0ZW5jaWVzXG4gICAgICAgICMgKGUuZy4gdGhlIGZvbGxvd2luZyBvcGVyYXRpb24gb3JkZXIgbXVzdCBiZSBpbnZlcnRpYmxlIDpcbiAgICAgICAgIyAgIEluc2VydCByZWZlcnMgdG8gY29udGVudCwgdGhlbiB0aGUgY29udGVudCBpcyBkZWxldGVkKVxuICAgICAgICAjIFRoZXJlZm9yZSwgd2UgaGF2ZSB0byBkbyB0aGlzIGluIHRoZSBjbGVhbnVwXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvbiBhbmQgbm90IGRlbGV0ZWRfZWFybHllclxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnktLVxuICAgICAgICAgIGlmIEBjb250ZW50LnJlZmVyZW5jZWRfYnkgPD0gMCBhbmQgbm90IEBjb250ZW50LmlzX2RlbGV0ZWRcbiAgICAgICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgICAgZGVsZXRlIEBjb250ZW50XG4gICAgICAgIHN1cGVyXG4gICAgICAjIGVsc2VcbiAgICAgICMgICBTb21lb25lIGluc2VydGVkIHNvbWV0aGluZyBpbiB0aGUgbWVhbnRpbWUuXG4gICAgICAjICAgUmVtZW1iZXI6IHRoaXMgY2FuIG9ubHkgYmUgZ2FyYmFnZSBjb2xsZWN0ZWQgd2hlbiBuZXh0X2NsIGlzIGRlbGV0ZWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICBkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBAY29udGVudC5pbnNlcnRfcGFyZW50ID0gQCAjIFRPRE86IHRoaXMgaXMgcHJvYmFibHkgbm90IG5lY2Vzc2FyeSBhbmQgb25seSBuaWNlIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5ID89IDBcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5KytcbiAgICAgICAgaWYgQHBhcmVudD9cbiAgICAgICAgICBpZiBub3QgQHByZXZfY2w/XG4gICAgICAgICAgICBAcHJldl9jbCA9IEBwYXJlbnQuYmVnaW5uaW5nXG4gICAgICAgICAgaWYgbm90IEBvcmlnaW4/XG4gICAgICAgICAgICBAb3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBlbHNlIGlmIEBvcmlnaW4gaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgICAgQG9yaWdpbiA9IEBwYXJlbnQuYmVnaW5uaW5nXG4gICAgICAgICAgaWYgbm90IEBuZXh0X2NsP1xuICAgICAgICAgICAgQG5leHRfY2wgPSBAcGFyZW50LmVuZFxuICAgICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IGRpc3RhbmNlX3RvX29yaWdpbiAjIGxvb3AgY291bnRlclxuXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcbiAgICAgICAgICAjICAgICAgICAgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIDwgQHVpZC5jcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG5cbiAgICAgICAgQHNldFBhcmVudCBAcHJldl9jbC5nZXRQYXJlbnQoKSAjIGRvIEluc2VydGlvbnMgYWx3YXlzIGhhdmUgYSBwYXJlbnQ/XG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMoKVxuICAgICAgICBAXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIGdldENvbnRlbnRUeXBlID0gKGNvbnRlbnQpLT5cbiAgICAgICAgaWYgY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY29udGVudFxuICAgICAgQHBhcmVudD8uY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJpbnNlcnRcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICB2YWx1ZTogZ2V0Q29udGVudFR5cGUgQGNvbnRlbnRcbiAgICAgIF1cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIEBwYXJlbnQuY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50LmdldEN1c3RvbVR5cGUoKSAjIFRPRE86IFlvdSBjYW4gY29tYmluZSBnZXRQb3NpdGlvbiArIGdldFBhcmVudCBpbiBhIG1vcmUgZWZmaWNpZW50IG1hbm5lciEgKG9ubHkgbGVmdCBEZWxpbWl0ZXIgd2lsbCBob2xkIEBwYXJlbnQpXG4gICAgICAgIGxlbmd0aDogMVxuICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgIF1cblxuICAgICNcbiAgICAjIENvbXB1dGUgdGhlIHBvc2l0aW9uIG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQb3NpdGlvbjogKCktPlxuICAgICAgcG9zaXRpb24gPSAwXG4gICAgICBwcmV2ID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgcHJldiBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBub3QgcHJldi5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uKytcbiAgICAgICAgcHJldiA9IHByZXYucHJldl9jbFxuICAgICAgcG9zaXRpb25cblxuICAgICNcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW5kIHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24ucHJldiA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICBqc29uLm5leHQgPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAganNvbi5wYXJlbnQgPSBAcGFyZW50LmdldFVpZCgpXG5cbiAgICAgIGlmIEBvcmlnaW4udHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIGpzb24ub3JpZ2luID0gXCJEZWxpbWl0ZXJcIlxuICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbi5vcmlnaW4gPSBAb3JpZ2luLmdldFVpZCgpXG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEpTT04uc3RyaW5naWZ5IEBjb250ZW50XG4gICAgICBzdXBlciBqc29uXG5cbiAgb3BzLkluc2VydC5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIGlmIHR5cGVvZiBjb250ZW50IGlzIFwic3RyaW5nXCJcbiAgICAgIGNvbnRlbnQgPSBKU09OLnBhcnNlKGNvbnRlbnQpXG4gICAgbmV3IHRoaXMgbnVsbCwgY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIHBhcmVudFxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIG9wcy5EZWxpbWl0ZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBudWxsLCB7bm9PcGVyYXRpb246IHRydWV9XG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xuICAgICAgICBzdXBlclxuICAgICAgI2Vsc2VcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAnb3BlcmF0aW9ucycgOiBvcHNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9ICgpLT5cbiAgYmFzaWNfb3BzID0gYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQoKVxuICBvcHMgPSBiYXNpY19vcHMub3BlcmF0aW9uc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBvcHMuTWFwTWFuYWdlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkKS0+XG4gICAgICBAX21hcCA9IHt9XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQF9tYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBtYXA6IChmKS0+XG4gICAgICBmb3Igbix2IG9mIEBfbWFwXG4gICAgICAgIGYobix2KVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XG4gICAgICAgICAgcmVwID0gY29udGVudC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXAgPSBjb250ZW50XG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIHJlcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIHByb3AgPSBAX21hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIHJlcyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICAgIHJlcy5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXNcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQF9tYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXSA9IHJtXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxuICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV1cblxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZClcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCktPlxuICAgICAgQGJlZ2lubmluZyA9IG5ldyBvcHMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICBAZW5kID0gICAgICAgbmV3IG9wcy5EZWxpbWl0ZXIgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiTGlzdE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAZW5kXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgZm9yIGksIG8gaW4gdmFsXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuT2JqZWN0XG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiBvcHMuTGlzdE1hbmFnZXJcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgbWFwOiAoZiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBmKG8pXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgZm9sZDogKGluaXQsIGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpbml0ID0gZihpbml0LCBvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBpbml0XG5cbiAgICB2YWw6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICBAdG9BcnJheSgpXG5cblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICMgZS5nLiBcImFiY1wiIDogdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBvLnByZXZfY2w/XG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgW2NvbnRlbnRdXG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnRzKS0+XG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG5cbiAgICAgICMgVE9ETzogYWx3YXlzIGV4cGVjdCBhbiBhcnJheSBhcyBjb250ZW50LiBUaGVuIHlvdSBjYW4gY29tYmluZSB0aGlzIHdpdGggdGhlIG90aGVyIG9wdGlvbiAoZWxzZSlcbiAgICAgIGlmIGNvbnRlbnRzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICBlbHNlXG4gICAgICAgIGZvciBjIGluIGNvbnRlbnRzXG4gICAgICAgICAgaWYgYz8gYW5kIGMuX25hbWU/IGFuZCBjLl9nZXRNb2RlbD9cbiAgICAgICAgICAgIGMgPSBjLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgICB0bXAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgYywgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICAgICAgbGVmdCA9IHRtcFxuICAgICAgQFxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhbiBhcnJheSBvZiBjb250ZW50IGludG8gdGhpcyBsaXN0LlxuICAgICMgQE5vdGU6IFRoaXMgZXhwZWN0cyBhbiBhcnJheSBhcyBjb250ZW50IVxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdC5cbiAgICAjXG4gICAgaW5zZXJ0OiAocG9zaXRpb24sIGNvbnRlbnRzKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnRzXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGEgcGFydCBvZiB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3RcbiAgICAjXG4gICAgZGVsZXRlOiAocG9zaXRpb24sIGxlbmd0aCA9IDEpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIChub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gIG9wcy5MaXN0TWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZSc6IGN1c3RvbV90eXBlXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkLCBiZWdpbm5pbmcsIGVuZCktPlxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cbiAgICAgICAgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddID0gQGV2ZW50X3RoaXMuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBiZWdpbm5pbmcsIGVuZFxuXG4gICAgdHlwZTogXCJSZXBsYWNlTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBUaGlzIGRvZXNuJ3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzIGFzIHRoZSBMaXN0TWFuYWdlci4gVGhlcmVmb3JlLCB0aGVcbiAgICAjIFJlcGxhY2VhYmxlcyBhbHNvIG5vdCB0aHJvdyB0aGUgc2FtZSBldmVudHMuXG4gICAgIyBTbywgUmVwbGFjZU1hbmFnZXIgYW5kIExpc3RNYW5hZ2VyIGJvdGggaW1wbGVtZW50XG4gICAgIyB0aGVzZSBmdW5jdGlvbnMgdGhhdCBhcmUgY2FsbGVkIHdoZW4gYW4gSW5zZXJ0aW9uIGlzIGV4ZWN1dGVkIChhdCB0aGUgZW5kKS5cbiAgICAjXG4gICAgI1xuICAgIGNhbGxFdmVudERlY29yYXRvcjogKGV2ZW50cyktPlxuICAgICAgaWYgbm90IEBpc0RlbGV0ZWQoKVxuICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgZm9yIG5hbWUscHJvcCBvZiBAZXZlbnRfcHJvcGVydGllc1xuICAgICAgICAgICAgZXZlbnRbbmFtZV0gPSBwcm9wXG4gICAgICAgIEBldmVudF90aGlzLmNhbGxFdmVudCBldmVudHNcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIHJlbHAgPSAobmV3IG9wcy5SZXBsYWNlYWJsZSBudWxsLCBjb250ZW50LCBALCByZXBsYWNlYWJsZV91aWQsIG8sIG8ubmV4dF9jbCkuZXhlY3V0ZSgpXG4gICAgICAjIFRPRE86IGRlbGV0ZSByZXBsIChmb3IgZGVidWdnaW5nKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBpc0NvbnRlbnREZWxldGVkOiAoKS0+XG4gICAgICBAZ2V0TGFzdE9wZXJhdGlvbigpLmlzRGVsZXRlZCgpXG5cbiAgICBkZWxldGVDb250ZW50OiAoKS0+XG4gICAgICAobmV3IG9wcy5EZWxldGUgbnVsbCwgdW5kZWZpbmVkLCBAZ2V0TGFzdE9wZXJhdGlvbigpLnVpZCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpc1xuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICAjaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJSZXBsYWNlIE1hbmFnZXIgZG9lc24ndCBjb250YWluIGFueXRoaW5nLlwiXG4gICAgICBvLnZhbD8oKSAjID8gLSBmb3IgdGhlIGNhc2UgdGhhdCAoY3VycmVudGx5KSB0aGUgUk0gZG9lcyBub3QgY29udGFpbiBhbnl0aGluZyAodGhlbiBvIGlzIGEgRGVsaW1pdGVyKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi5iZWdpbm5pbmcgPSBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICBqc29uLmVuZCA9IEBlbmQuZ2V0VWlkKClcbiAgICAgIHN1cGVyIGpzb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBvcHMuUmVwbGFjZWFibGUgZXh0ZW5kcyBvcHMuSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gY29udGVudCBUaGUgdmFsdWUgdGhhdCB0aGlzIFJlcGxhY2VhYmxlIGhvbGRzLlxuICAgICMgQHBhcmFtIHtSZXBsYWNlTWFuYWdlcn0gcGFyZW50IFVzZWQgdG8gcmVwbGFjZSB0aGlzIFJlcGxhY2VhYmxlIHdpdGggYW5vdGhlciBvbmUuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiAjIFBhcmVudCBpcyBhbHJlYWR5IHNhdmVkIGJ5IFJlcGxhY2VhYmxlXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VhYmxlXCJcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCIgYW5kIEBwcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBAaXNfZGVsZXRlZCAjIFdoZW4gdGhpcyBpcyByZWNlaXZlZCBmcm9tIHRoZSBIQiwgdGhpcyBjb3VsZCBhbHJlYWR5IGJlIGRlbGV0ZWQhXG4gICAgICAgICAgb2xkX3ZhbHVlID0gQHByZXZfY2wudmFsKClcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgb2xkVmFsdWU6IG9sZF92YWx1ZVxuICAgICAgICAgIF1cbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSBpZiBAbmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBAYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiYWRkXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBAdmFsKClcbiAgICAgICAgXVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5SZXBsYWNlYWJsZS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgIH0gPSBqc29uXG4gICAgaWYgdHlwZW9mIGNvbnRlbnQgaXMgXCJzdHJpbmdcIlxuICAgICAgY29udGVudCA9IEpTT04ucGFyc2UoY29udGVudClcbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgY29udGVudCwgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbilcblxuXG4gIGJhc2ljX29wc1xuXG5cblxuXG5cblxuIiwiXG5jbGFzcyBZT2JqZWN0XG5cbiAgY29uc3RydWN0b3I6IChAX29iamVjdCA9IHt9KS0+XG4gICAgaWYgQF9vYmplY3QuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICBmb3IgbmFtZSwgdmFsIG9mIEBfb2JqZWN0XG4gICAgICAgIGlmIHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBAX29iamVjdFtuYW1lXSA9IG5ldyBZT2JqZWN0KHZhbClcbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZLk9iamVjdCBhY2NlcHRzIEpzb24gT2JqZWN0cyBvbmx5XCJcblxuICBfbmFtZTogXCJPYmplY3RcIlxuXG4gIF9nZXRNb2RlbDogKHR5cGVzLCBvcHMpLT5cbiAgICBpZiBub3QgQF9tb2RlbD9cbiAgICAgIEBfbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoQCkuZXhlY3V0ZSgpXG4gICAgICBmb3IgbixvIG9mIEBfb2JqZWN0XG4gICAgICAgIEBfbW9kZWwudmFsIG4sIG9cbiAgICBkZWxldGUgQF9vYmplY3RcbiAgICBAX21vZGVsXG5cbiAgX3NldE1vZGVsOiAoQF9tb2RlbCktPlxuICAgIGRlbGV0ZSBAX29iamVjdFxuXG4gIG9ic2VydmU6IChmKS0+XG4gICAgQF9tb2RlbC5vYnNlcnZlIGZcbiAgICBAXG5cbiAgdW5vYnNlcnZlOiAoZiktPlxuICAgIEBfbW9kZWwudW5vYnNlcnZlIGZcbiAgICBAXG5cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwoKVxuICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgIyAgIEByZXR1cm4gW0pzb25dXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlfHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICNcbiAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgIGlmIEBfbW9kZWw/XG4gICAgICBAX21vZGVsLnZhbC5hcHBseSBAX21vZGVsLCBhcmd1bWVudHNcbiAgICBlbHNlXG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBAX29iamVjdFtuYW1lXSA9IGNvbnRlbnRcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgQF9vYmplY3RbbmFtZV1cbiAgICAgIGVsc2VcbiAgICAgICAgcmVzID0ge31cbiAgICAgICAgZm9yIG4sdiBvZiBAX29iamVjdFxuICAgICAgICAgIHJlc1tuXSA9IHZcbiAgICAgICAgcmVzXG5cbiAgZGVsZXRlOiAobmFtZSktPlxuICAgIEBfbW9kZWwuZGVsZXRlKG5hbWUpXG4gICAgQFxuXG5pZiB3aW5kb3c/XG4gIGlmIHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZLk9iamVjdCA9IFlPYmplY3RcbiAgZWxzZVxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGZpcnN0IGltcG9ydCBZIVwiXG5cbmlmIG1vZHVsZT9cbiAgbW9kdWxlLmV4cG9ydHMgPSBZT2JqZWN0XG5cblxuXG5cblxuXG5cblxuIiwiXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcblxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XG4gIHVzZXJfaWQgPSBudWxsXG4gIGlmIGNvbm5lY3Rvci51c2VyX2lkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLm9uX3VzZXJfaWRfc2V0ID0gKGlkKS0+XG4gICAgICB1c2VyX2lkID0gaWRcbiAgICAgIEhCLnJlc2V0VXNlcklkIGlkXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICBvcHNfbWFuYWdlciA9IHN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgSEIsIHRoaXMuY29uc3RydWN0b3JcbiAgb3BzID0gb3BzX21hbmFnZXIub3BlcmF0aW9uc1xuXG4gIGVuZ2luZSA9IG5ldyBFbmdpbmUgSEIsIG9wc1xuICBhZGFwdENvbm5lY3RvciBjb25uZWN0b3IsIGVuZ2luZSwgSEIsIG9wc19tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lclxuXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLkhCID0gSEJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUub3BlcmF0aW9ucyA9IG9wc1xuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY29ubmVjdG9yID0gY29ubmVjdG9yXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmN1c3RvbV90eXBlcyA9IHRoaXMuY29uc3RydWN0b3JcblxuICBjdCA9IG5ldyBjcmVhdGVZLk9iamVjdCgpXG4gIG1vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKGN0LCBIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKSkuZXhlY3V0ZSgpXG4gIGN0Ll9zZXRNb2RlbCBtb2RlbFxuICBjdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcbmlmIHdpbmRvdz9cbiAgd2luZG93LlkgPSBjcmVhdGVZXG5cbmNyZWF0ZVkuT2JqZWN0ID0gcmVxdWlyZSBcIi4vVHlwZXMvT2JqZWN0XCJcbiJdfQ==
