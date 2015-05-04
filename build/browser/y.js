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
  onUserEvent: function(f) {
    if (this.connections_listeners == null) {
      this.connections_listeners = [];
    }
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
    if (this.connections_listeners != null) {
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
    }
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
    if (this.connections_listeners != null) {
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
                var _k, _len2;
                hb = _this.getHB(sv).hb;
                for (_k = 0, _len2 = hb.length; _k < _len2; _k++) {
                  o = hb[_k];
                  _hb.push(o);
                  if (_hb.length > 10) {
                    _this.send(sender, {
                      sync_step: "applyHB_",
                      data: _hb
                    });
                    _hb = [];
                  }
                }
                return _this.send(sender, {
                  sync_step: "applyHB",
                  data: _hb,
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
          op = op.next_cl;
          if (op === this.end) {
            return;
          }
        } else {
          return;
        }
      }
      o = this.end.prev_cl;
      while (o !== op) {
        this.getCustomType()._unapply(o.undo_delta);
        o = o.prev_cl;
      }
      while (o !== this.end) {
        o.undo_delta = this.getCustomType()._apply(o.val());
        o = o.next_cl;
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
      var last_op;
      last_op = this.getLastOperation();
      if ((!last_op.isDeleted()) && last_op.type !== "Delimiter") {
        (new ops.Delete(null, void 0, this.getLastOperation().uid)).execute();
      }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9naXQveWpzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9Db25uZWN0b3JBZGFwdGVyLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvZ2l0L3lqcy9saWIvRW5naW5lLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PcGVyYXRpb25zL0Jhc2ljLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PcGVyYXRpb25zL1N0cnVjdHVyZWQuY29mZmVlIiwiL2hvbWUvZG1vbmFkL2dpdC95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENBQWxCLENBREY7QUFBQSxHQUFBO0FBQUEsRUFHQSxTQUFTLENBQUMsYUFBVixDQUFBLENBSEEsQ0FBQTtBQUFBLEVBS0EsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEtBQWlCLEVBQUUsQ0FB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c0MsV0FBVyxDQUFDLGtCQUFsRCxDQWJBLENBQUE7QUFBQSxFQWVBLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQXhCLEdBQTZCLEVBZjdCLENBQUE7QUFBQSxFQWdCQSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxVQUF4QixHQUFxQyxHQWhCckMsQ0FBQTtBQUFBLEVBaUJBLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQXhCLEdBQWlDLE1BakJqQyxDQUFBO0FBQUEsRUFrQkEsR0FBRyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBeEIsR0FBb0MsU0FsQnBDLENBQUE7QUFBQSxFQW1CQSxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxZQUF4QixHQUF1QyxJQUFJLENBQUMsV0FuQjVDLENBQUE7QUFBQSxFQXFCQSxFQUFBLEdBQVMsSUFBQSxPQUFPLENBQUMsTUFBUixDQUFBLENBckJULENBQUE7QUFBQSxFQXNCQSxLQUFBLEdBQVksSUFBQSxHQUFHLENBQUMsVUFBSixDQUFlLEVBQWYsRUFBbUIsRUFBRSxDQUFDLDJCQUFILENBQUEsQ0FBbkIsQ0FBb0QsQ0FBQyxPQUFyRCxDQUFBLENBdEJaLENBQUE7QUFBQSxFQXVCQSxFQUFFLENBQUMsU0FBSCxDQUFhLEtBQWIsQ0F2QkEsQ0FBQTtTQXdCQSxHQXpCUTtBQUFBLENBTlYsQ0FBQTs7QUFBQSxNQWlDTSxDQUFDLE9BQVAsR0FBaUIsT0FqQ2pCLENBQUE7O0FBa0NBLElBQUcsZ0RBQUg7QUFDRSxFQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsT0FBWCxDQURGO0NBbENBOztBQUFBLE9BcUNPLENBQUMsTUFBUixHQUFpQixPQUFBLENBQVEsY0FBUixDQXJDakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbkNvbm5lY3RvckNsYXNzID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQ2xhc3NcIlxuI1xuIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcbiMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4jXG5hZGFwdENvbm5lY3RvciA9IChjb25uZWN0b3IsIGVuZ2luZSwgSEIsIGV4ZWN1dGlvbl9saXN0ZW5lciktPlxuXG4gIGZvciBuYW1lLCBmIG9mIENvbm5lY3RvckNsYXNzXG4gICAgY29ubmVjdG9yW25hbWVdID0gZlxuXG4gIGNvbm5lY3Rvci5zZXRJc0JvdW5kVG9ZKClcblxuICBzZW5kXyA9IChvKS0+XG4gICAgaWYgKG8udWlkLmNyZWF0b3IgaXMgSEIuZ2V0VXNlcklkKCkpIGFuZFxuICAgICAgICAodHlwZW9mIG8udWlkLm9wX251bWJlciBpc250IFwic3RyaW5nXCIpIGFuZCAjIFRPRE86IGkgZG9uJ3QgdGhpbmsgdGhhdCB3ZSBuZWVkIHRoaXMgYW55bW9yZS4uXG4gICAgICAgIChIQi5nZXRVc2VySWQoKSBpc250IFwiX3RlbXBcIilcbiAgICAgIGNvbm5lY3Rvci5icm9hZGNhc3Qgb1xuXG4gIGlmIGNvbm5lY3Rvci5pbnZva2VTeW5jP1xuICAgIEhCLnNldEludm9rZVN5bmNIYW5kbGVyIGNvbm5lY3Rvci5pbnZva2VTeW5jXG5cbiAgZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cbiAgIyBGb3IgdGhlIFhNUFBDb25uZWN0b3I6IGxldHMgc2VuZCBpdCBhcyBhbiBhcnJheVxuICAjIHRoZXJlZm9yZSwgd2UgaGF2ZSB0byByZXN0cnVjdHVyZSBpdCBsYXRlclxuICBlbmNvZGVfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBmb3IgbmFtZSx2YWx1ZSBvZiB2XG4gICAgICB1c2VyOiBuYW1lXG4gICAgICBzdGF0ZTogdmFsdWVcbiAgcGFyc2Vfc3RhdGVfdmVjdG9yID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSB7fVxuICAgIGZvciBzIGluIHZcbiAgICAgIHN0YXRlX3ZlY3RvcltzLnVzZXJdID0gcy5zdGF0ZVxuICAgIHN0YXRlX3ZlY3RvclxuXG4gIGdldFN0YXRlVmVjdG9yID0gKCktPlxuICAgIGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG5cbiAgZ2V0SEIgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHBhcnNlX3N0YXRlX3ZlY3RvciB2XG4gICAgaGIgPSBIQi5fZW5jb2RlIHN0YXRlX3ZlY3RvclxuICAgIGpzb24gPVxuICAgICAgaGI6IGhiXG4gICAgICBzdGF0ZV92ZWN0b3I6IGVuY29kZV9zdGF0ZV92ZWN0b3IgSEIuZ2V0T3BlcmF0aW9uQ291bnRlcigpXG4gICAganNvblxuXG4gIGFwcGx5SEIgPSAoaGIsIGZyb21IQiktPlxuICAgIGVuZ2luZS5hcHBseU9wIGhiLCBmcm9tSEJcblxuICBjb25uZWN0b3IuZ2V0U3RhdGVWZWN0b3IgPSBnZXRTdGF0ZVZlY3RvclxuICBjb25uZWN0b3IuZ2V0SEIgPSBnZXRIQlxuICBjb25uZWN0b3IuYXBwbHlIQiA9IGFwcGx5SEJcblxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxuICBjb25uZWN0b3IucmVjZWl2ZV9oYW5kbGVycy5wdXNoIChzZW5kZXIsIG9wKS0+XG4gICAgaWYgb3AudWlkLmNyZWF0b3IgaXNudCBIQi5nZXRVc2VySWQoKVxuICAgICAgZW5naW5lLmFwcGx5T3Agb3BcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGFkYXB0Q29ubmVjdG9yXG4iLCJcbm1vZHVsZS5leHBvcnRzID1cbiAgI1xuICAjIEBwYXJhbXMgbmV3IENvbm5lY3RvcihvcHRpb25zKVxuICAjICAgQHBhcmFtIG9wdGlvbnMuc3luY01ldGhvZCB7U3RyaW5nfSAgaXMgZWl0aGVyIFwic3luY0FsbFwiIG9yIFwibWFzdGVyLXNsYXZlXCIuXG4gICMgICBAcGFyYW0gb3B0aW9ucy5yb2xlIHtTdHJpbmd9IFRoZSByb2xlIG9mIHRoaXMgY2xpZW50XG4gICMgICAgICAgICAgICAoc2xhdmUgb3IgbWFzdGVyIChvbmx5IHVzZWQgd2hlbiBzeW5jTWV0aG9kIGlzIG1hc3Rlci1zbGF2ZSkpXG4gICMgICBAcGFyYW0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4ge0Jvb2xlYW59IFdoZXRlaHIgdG8gd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycywgYnV0IGhhcyBzb21lIG92ZXJoZWFkIChvcHRpb25hbClcbiAgI1xuICBpbml0OiAob3B0aW9ucyktPlxuICAgIHJlcSA9IChuYW1lLCBjaG9pY2VzKT0+XG4gICAgICBpZiBvcHRpb25zW25hbWVdP1xuICAgICAgICBpZiAobm90IGNob2ljZXM/KSBvciBjaG9pY2VzLnNvbWUoKGMpLT5jIGlzIG9wdGlvbnNbbmFtZV0pXG4gICAgICAgICAgQFtuYW1lXSA9IG9wdGlvbnNbbmFtZV1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4gc2V0IHRoZSAnXCIrbmFtZStcIicgb3B0aW9uIHRvIG9uZSBvZiB0aGUgZm9sbG93aW5nIGNob2ljZXM6IFwiK0pTT04uZW5jb2RlKGNob2ljZXMpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IHNwZWNpZnkgXCIrbmFtZStcIiwgd2hlbiBpbml0aWFsaXppbmcgdGhlIENvbm5lY3RvciFcIlxuXG4gICAgcmVxIFwic3luY01ldGhvZFwiLCBbXCJzeW5jQWxsXCIsIFwibWFzdGVyLXNsYXZlXCJdXG4gICAgcmVxIFwicm9sZVwiLCBbXCJtYXN0ZXJcIiwgXCJzbGF2ZVwiXVxuICAgIHJlcSBcInVzZXJfaWRcIlxuICAgIEBvbl91c2VyX2lkX3NldD8oQHVzZXJfaWQpXG5cbiAgICAjIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMuXG4gICAgIyBCdXQgdGhpcyBpcyBub3QgbmVjZXNzYXJ5IGluIHRoZSB0ZXN0LWNvbm5lY3RvclxuICAgIGlmIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluP1xuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluXG4gICAgZWxzZVxuICAgICAgQHBlcmZvcm1fc2VuZF9hZ2FpbiA9IHRydWVcblxuICAgICMgQSBNYXN0ZXIgc2hvdWxkIHN5bmMgd2l0aCBldmVyeW9uZSEgVE9ETzogcmVhbGx5PyAtIGZvciBub3cgaXRzIHNhZmVyIHRoaXMgd2F5IVxuICAgIGlmIEByb2xlIGlzIFwibWFzdGVyXCJcbiAgICAgIEBzeW5jTWV0aG9kID0gXCJzeW5jQWxsXCJcblxuICAgICMgaXMgc2V0IHRvIHRydWUgd2hlbiB0aGlzIGlzIHN5bmNlZCB3aXRoIGFsbCBvdGhlciBjb25uZWN0aW9uc1xuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxuICAgICMgUGVlcmpzIENvbm5lY3Rpb25zOiBrZXk6IGNvbm4taWQsIHZhbHVlOiBvYmplY3RcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgICMgTGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBzaGFsbCBwcm9jZXNzIGluY29taW5nIGRhdGFcbiAgICBAcmVjZWl2ZV9oYW5kbGVycyA/PSBbXVxuXG4gICAgIyB3aGV0aGVyIHRoaXMgaW5zdGFuY2UgaXMgYm91bmQgdG8gYW55IHkgaW5zdGFuY2VcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IGZhbHNlXG4gICAgQGlzX2luaXRpYWxpemVkID0gdHJ1ZVxuXG4gIG9uVXNlckV2ZW50OiAoZiktPlxuICAgIEBjb25uZWN0aW9uc19saXN0ZW5lcnMgPz0gW11cbiAgICBAY29ubmVjdGlvbnNfbGlzdGVuZXJzLnB1c2ggZlxuXG4gIGlzUm9sZU1hc3RlcjogLT5cbiAgICBAcm9sZSBpcyBcIm1hc3RlclwiXG5cbiAgaXNSb2xlU2xhdmU6IC0+XG4gICAgQHJvbGUgaXMgXCJzbGF2ZVwiXG5cbiAgZmluZE5ld1N5bmNUYXJnZXQ6ICgpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGlmIG5vdCBjLmlzX3N5bmNlZFxuICAgICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICAgICAgYnJlYWtcbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAc2V0U3RhdGVTeW5jZWQoKVxuICAgIG51bGxcblxuICB1c2VyTGVmdDogKHVzZXIpLT5cbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXG4gICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcbiAgICBpZiBAY29ubmVjdGlvbnNfbGlzdGVuZXJzP1xuICAgICAgZm9yIGYgaW4gQGNvbm5lY3Rpb25zX2xpc3RlbmVyc1xuICAgICAgICBmIHtcbiAgICAgICAgICBhY3Rpb246IFwidXNlckxlZnRcIlxuICAgICAgICAgIHVzZXI6IHVzZXJcbiAgICAgICAgfVxuXG5cbiAgdXNlckpvaW5lZDogKHVzZXIsIHJvbGUpLT5cbiAgICBpZiBub3Qgcm9sZT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkludGVybmFsOiBZb3UgbXVzdCBzcGVjaWZ5IHRoZSByb2xlIG9mIHRoZSBqb2luZWQgdXNlciEgRS5nLiB1c2VySm9pbmVkKCd1aWQ6MzkzOScsJ3NsYXZlJylcIlxuICAgICMgYSB1c2VyIGpvaW5lZCB0aGUgcm9vbVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXSA/PSB7fVxuICAgIEBjb25uZWN0aW9uc1t1c2VyXS5pc19zeW5jZWQgPSBmYWxzZVxuXG4gICAgaWYgKG5vdCBAaXNfc3luY2VkKSBvciBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcbiAgICAgIGVsc2UgaWYgcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICAgICMgVE9ETzogV2hhdCBpZiB0aGVyZSBhcmUgdHdvIG1hc3RlcnM/IFByZXZlbnQgc2VuZGluZyBldmVyeXRoaW5nIHR3byB0aW1lcyFcbiAgICAgICAgQHBlcmZvcm1TeW5jV2l0aE1hc3RlciB1c2VyXG5cbiAgICBpZiBAY29ubmVjdGlvbnNfbGlzdGVuZXJzP1xuICAgICAgZm9yIGYgaW4gQGNvbm5lY3Rpb25zX2xpc3RlbmVyc1xuICAgICAgICBmIHtcbiAgICAgICAgICBhY3Rpb246IFwidXNlckpvaW5lZFwiXG4gICAgICAgICAgdXNlcjogdXNlclxuICAgICAgICAgIHJvbGU6IHJvbGVcbiAgICAgICAgfVxuXG4gICNcbiAgIyBFeGVjdXRlIGEgZnVuY3Rpb24gX3doZW5fIHdlIGFyZSBjb25uZWN0ZWQuIElmIG5vdCBjb25uZWN0ZWQsIHdhaXQgdW50aWwgY29ubmVjdGVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgYXJncy5jb25zdHJ1Y3RvcmUgaXMgRnVuY3Rpb25cbiAgICAgIGFyZ3MgPSBbYXJnc11cbiAgICBpZiBAaXNfc3luY2VkXG4gICAgICBhcmdzWzBdLmFwcGx5IHRoaXMsIGFyZ3NbMS4uXVxuICAgIGVsc2VcbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkID89IFtdXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZC5wdXNoIGFyZ3NcblxuICAjXG4gICMgRXhlY3V0ZSBhbiBmdW5jdGlvbiB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC4gZiB3aWxsIGJlIGNhbGxlZCB3aXRoIChzZW5kZXJfaWQsIGJyb2FkY2FzdCB7dHJ1ZXxmYWxzZX0sIG1lc3NhZ2UpLlxuICAjXG4gIG9uUmVjZWl2ZTogKGYpLT5cbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcblxuICAjIyNcbiAgIyBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBjb25uZWN0ZWQgcGVlcnMuXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gYnJvYWRjYXN0LlxuICAjXG4gIGJyb2FkY2FzdDogKG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgYnJvYWRjYXN0IVwiXG5cbiAgI1xuICAjIFNlbmQgYSBtZXNzYWdlIHRvIGEgcGVlciwgb3Igc2V0IG9mIHBlZXJzXG4gICNcbiAgc2VuZDogKHBlZXJfcywgbWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBzZW5kIVwiXG4gICMjI1xuXG4gICNcbiAgIyBwZXJmb3JtIGEgc3luYyB3aXRoIGEgc3BlY2lmaWMgdXNlci5cbiAgI1xuICBwZXJmb3JtU3luYzogKHVzZXIpLT5cbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICAgIEBzZW5kIHVzZXIsXG4gICAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgIGRhdGE6IFtdICMgQGdldFN0YXRlVmVjdG9yKClcbiAgICAgIGlmIG5vdCBAc2VudF9oYl90b19hbGxfdXNlcnNcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxuXG4gICAgICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG5cblxuICAjXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxuICAjXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICBAc2VuZCB1c2VyLFxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICBkYXRhOiBbXVxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgIF9oYiA9IFtdXG4gICAgZm9yIG8gaW4gaGJcbiAgICAgIF9oYi5wdXNoIG9cbiAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgX2hiID0gW11cbiAgICBAYnJvYWRjYXN0XG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICBkYXRhOiBfaGJcblxuICAjXG4gICMgWW91IGFyZSBzdXJlIHRoYXQgYWxsIGNsaWVudHMgYXJlIHN5bmNlZCwgY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XG4gICAgaWYgbm90IEBpc19zeW5jZWRcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cbiAgICAgICAgZm9yIGYgaW4gQGNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgICAgICBmKClcbiAgICAgICAgZGVsZXRlIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICBudWxsXG5cbiAgI1xuICAjIFlvdSByZWNlaXZlZCBhIHJhdyBtZXNzYWdlLCBhbmQgeW91IGtub3cgdGhhdCBpdCBpcyBpbnRlbmRlZCBmb3IgdG8gWWpzLiBUaGVuIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICByZWNlaXZlTWVzc2FnZTogKHNlbmRlciwgcmVzKS0+XG4gICAgaWYgbm90IHJlcy5zeW5jX3N0ZXA/XG4gICAgICBmb3IgZiBpbiBAcmVjZWl2ZV9oYW5kbGVyc1xuICAgICAgICBmIHNlbmRlciwgcmVzXG4gICAgZWxzZVxuICAgICAgaWYgc2VuZGVyIGlzIEB1c2VyX2lkXG4gICAgICAgIHJldHVyblxuICAgICAgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImdldEhCXCJcbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcbiAgICAgICAgaGIgPSBkYXRhLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxuICAgICAgICAjIFdoZW4gdGhpcyBjbGllbnQgb25seSBzeW5jcyB0byBvbmUgb3RoZXIgY2xpZW50cywgYnV0IGxvb3NlcyBjb25uZWN0b3JzLFxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcbiAgICAgICAgaWYgQGlzX3N5bmNlZFxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXG5cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG5cbiAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxuICAgICAgICAgICAgKCk9PlxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcbiAgICAgICAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yP1xuICAgICAgICAgIG8udWlkLmNyZWF0b3IgPSBpZFxuICAgICAgICBpZiBvLnVpZC5hbHQ/XG4gICAgICAgICAgby51aWQuYWx0LmNyZWF0b3IgPSBpZFxuICAgICAgaWYgQGJ1ZmZlcltpZF0/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXG4gICAgICBkZWxldGUgQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW2lkXSA9IEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pICMgeW91IGFscmVhZHkgZG8gdGhpcyBpbiB0aGUgZW5naW5lLCBzbyBkZWxldGUgaXQgaGVyZSFcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcbiAgICBAYWRkVG9Db3VudGVyKG8pXG4gICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cblxuICAjIFdoZW4gdGhlIEhCIGRldGVybWluZXMgaW5jb25zaXN0ZW5jaWVzLCB0aGVuIHRoZSBpbnZva2VTeW5jXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcbiAgc2V0SW52b2tlU3luY0hhbmRsZXI6IChmKS0+XG4gICAgQGludm9rZVN5bmMgPSBmXG5cbiAgIyBlbXB0eSBwZXIgZGVmYXVsdCAjIFRPRE86IGRvIGkgbmVlZCB0aGlzP1xuICBpbnZva2VTeW5jOiAoKS0+XG5cbiAgIyBhZnRlciB5b3UgcmVjZWl2ZWQgdGhlIEhCIG9mIGFub3RoZXIgdXNlciAoaW4gdGhlIHN5bmMgcHJvY2VzcyksXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cbiAgICBmb3IgdXNlcixzdGF0ZSBvZiBzdGF0ZV92ZWN0b3JcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBpZiBvLnVpZC5jcmVhdG9yIGlzbnQgQGdldFVzZXJJZCgpXG4gICAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcbiAgICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cbiAgICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI2lmIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSBpc250IChvLnVpZC5vcF9udW1iZXIgKyAxKVxuICAgICAgI2NvbnNvbGUubG9nIChAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gLSAoby51aWQub3BfbnVtYmVyICsgMSkpXG4gICAgICAjY29uc29sZS5sb2cgb1xuICAgICAgI3Rocm93IG5ldyBFcnJvciBcIllvdSBkb24ndCByZWNlaXZlIG9wZXJhdGlvbnMgaW4gdGhlIHByb3BlciBvcmRlci4gVHJ5IGNvdW50aW5nIGxpa2UgdGhpcyAwLDEsMiwzLDQsLi4gOylcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEhpc3RvcnlCdWZmZXJcbiIsIlxuY2xhc3MgWU9iamVjdFxuXG4gIGNvbnN0cnVjdG9yOiAoQF9vYmplY3QgPSB7fSktPlxuICAgIGlmIEBfb2JqZWN0LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZm9yIG5hbWUsIHZhbCBvZiBAX29iamVjdFxuICAgICAgICBpZiB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBuZXcgWU9iamVjdCh2YWwpXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWS5PYmplY3QgYWNjZXB0cyBKc29uIE9iamVjdHMgb25seVwiXG5cbiAgX25hbWU6IFwiT2JqZWN0XCJcblxuICBfZ2V0TW9kZWw6ICh0eXBlcywgb3BzKS0+XG4gICAgaWYgbm90IEBfbW9kZWw/XG4gICAgICBAX21vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKEApLmV4ZWN1dGUoKVxuICAgICAgZm9yIG4sbyBvZiBAX29iamVjdFxuICAgICAgICBAX21vZGVsLnZhbCBuLCBvXG4gICAgZGVsZXRlIEBfb2JqZWN0XG4gICAgQF9tb2RlbFxuXG4gIF9zZXRNb2RlbDogKEBfbW9kZWwpLT5cbiAgICBkZWxldGUgQF9vYmplY3RcblxuICBvYnNlcnZlOiAoZiktPlxuICAgIEBfbW9kZWwub2JzZXJ2ZSBmXG4gICAgQFxuXG4gIHVub2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLnVub2JzZXJ2ZSBmXG4gICAgQFxuXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgIyAgIEdldCB0aGlzIGFzIGEgSnNvbiBvYmplY3QuXG4gICMgICBAcmV0dXJuIFtKc29uXVxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lKVxuICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcmV0dXJuIFsqXSBEZXBlbmRzIG9uIHRoZSB2YWx1ZSBvZiB0aGUgcHJvcGVydHkuXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUsIGNvbnRlbnQpXG4gICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGNvbnRlbnQgQ29udGVudCBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICNcbiAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgIGlmIEBfbW9kZWw/XG4gICAgICBAX21vZGVsLnZhbC5hcHBseSBAX21vZGVsLCBhcmd1bWVudHNcbiAgICBlbHNlXG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBAX29iamVjdFtuYW1lXSA9IGNvbnRlbnRcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgQF9vYmplY3RbbmFtZV1cbiAgICAgIGVsc2VcbiAgICAgICAgcmVzID0ge31cbiAgICAgICAgZm9yIG4sdiBvZiBAX29iamVjdFxuICAgICAgICAgIHJlc1tuXSA9IHZcbiAgICAgICAgcmVzXG5cbiAgZGVsZXRlOiAobmFtZSktPlxuICAgIEBfbW9kZWwuZGVsZXRlKG5hbWUpXG4gICAgQFxuXG5pZiB3aW5kb3c/XG4gIGlmIHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZLk9iamVjdCA9IFlPYmplY3RcbiAgZWxzZVxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGZpcnN0IGltcG9ydCBZIVwiXG5cbmlmIG1vZHVsZT9cbiAgbW9kdWxlLmV4cG9ydHMgPSBZT2JqZWN0XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICgpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICBvcHMgPSB7fVxuICBleGVjdXRpb25fbGlzdGVuZXIgPSBbXVxuXG4gICNcbiAgIyBAcHJpdmF0ZVxuICAjIEBhYnN0cmFjdFxuICAjIEBub2RvY1xuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BzLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgKiBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxuICAjICogdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuIFdlIGV4dGVuZCB0aGUgcGFyc2VyIG9iamVjdCBpbiBvcmRlciB0byBwYXJzZSBlbmNvZGVkIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLlxuICAgICMgSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZCBiZWZvcmUgYXQgdGhlIGVuZCBvZiB0aGUgZXhlY3V0aW9uIHNlcXVlbmNlXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XG4gICAgICBpZiBjdXN0b21fdHlwZT9cbiAgICAgICAgQGN1c3RvbV90eXBlID0gY3VzdG9tX3R5cGVcbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcbiAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IGZhbHNlXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW10gIyBUT0RPOiByZW5hbWUgdG8gb2JzZXJ2ZXJzIG9yIHN0aCBsaWtlIHRoYXRcbiAgICAgIGlmIHVpZD9cbiAgICAgICAgQHVpZCA9IHVpZFxuXG4gICAgICAjIHNlZSBlbmNvZGUgdG8gc2VlLCB3aHkgd2UgYXJlIGRvaW5nIGl0IHRoaXMgd2F5XG4gICAgICBpZiBjb250ZW50IGlzIHVuZGVmaW5lZFxuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiBjb250ZW50PyBhbmQgY29udGVudC5jcmVhdG9yP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQgPSBjb250ZW50XG4gICAgICBpZiBjb250ZW50X29wZXJhdGlvbnM/XG4gICAgICAgIEBjb250ZW50X29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbmFtZSwgb3Agb2YgY29udGVudF9vcGVyYXRpb25zXG4gICAgICAgICAgQHNhdmVPcGVyYXRpb24gbmFtZSwgb3AsICdjb250ZW50X29wZXJhdGlvbnMnXG5cbiAgICB0eXBlOiBcIk9wZXJhdGlvblwiXG5cbiAgICBnZXRDb250ZW50OiAobmFtZSktPlxuICAgICAgaWYgQGNvbnRlbnQ/XG4gICAgICAgIGlmIEBjb250ZW50LmdldEN1c3RvbVR5cGU/XG4gICAgICAgICAgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgIGVsc2UgaWYgQGNvbnRlbnQuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgaWYgbmFtZT9cbiAgICAgICAgICAgIGlmIEBjb250ZW50W25hbWVdP1xuICAgICAgICAgICAgICBAY29udGVudFtuYW1lXVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICBAY29udGVudF9vcGVyYXRpb25zW25hbWVdLmdldEN1c3RvbVR5cGUoKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGNvbnRlbnQgPSB7fVxuICAgICAgICAgICAgZm9yIG4sdiBvZiBAY29udGVudFxuICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxuICAgICAgICAgICAgaWYgQGNvbnRlbnRfb3BlcmF0aW9ucz9cbiAgICAgICAgICAgICAgZm9yIG4sdiBvZiBAY29udGVudF9vcGVyYXRpb25zXG4gICAgICAgICAgICAgICAgdiA9IHYuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgICAgICAgICAgY29udGVudFtuXSA9IHZcbiAgICAgICAgICAgIGNvbnRlbnRcbiAgICAgICAgZWxzZVxuICAgICAgICAgIEBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50XG5cbiAgICByZXRyaWV2ZVN1YjogKCktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwic3ViIHByb3BlcnRpZXMgYXJlIG5vdCBlbmFibGUgb24gdGhpcyBvcGVyYXRpb24gdHlwZSFcIlxuXG4gICAgI1xuICAgICMgQWRkIGFuIGV2ZW50IGxpc3RlbmVyLiBJdCBkZXBlbmRzIG9uIHRoZSBvcGVyYXRpb24gd2hpY2ggZXZlbnRzIGFyZSBzdXBwb3J0ZWQuXG4gICAgIyBAcGFyYW0ge0Z1bmN0aW9ufSBmIGYgaXMgZXhlY3V0ZWQgaW4gY2FzZSB0aGUgZXZlbnQgZmlyZXMuXG4gICAgI1xuICAgIG9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzLnB1c2ggZlxuXG4gICAgI1xuICAgICMgRGVsZXRlcyBmdW5jdGlvbiBmcm9tIHRoZSBvYnNlcnZlciBsaXN0XG4gICAgIyBAc2VlIE9wZXJhdGlvbi5vYnNlcnZlXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHVub2JzZXJ2ZShldmVudCwgZilcbiAgICAjICAgQHBhcmFtIGYgICAgIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRoYXQgeW91IHdhbnQgdG8gZGVsZXRlXG4gICAgdW5vYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IEBldmVudF9saXN0ZW5lcnMuZmlsdGVyIChnKS0+XG4gICAgICAgIGYgaXNudCBnXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGFsbCBzdWJzY3JpYmVkIGV2ZW50IGxpc3RlbmVycy5cbiAgICAjIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCwgZS5nLiBhZnRlciB0aGlzIGhhcyBiZWVuIHJlcGxhY2VkLlxuICAgICMgKFRoZW4gb25seSBvbmUgcmVwbGFjZSBldmVudCBzaG91bGQgZmlyZS4gKVxuICAgICMgVGhpcyBpcyBhbHNvIGNhbGxlZCBpbiB0aGUgY2xlYW51cCBtZXRob2QuXG4gICAgZGVsZXRlQWxsT2JzZXJ2ZXJzOiAoKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW11cblxuICAgIGRlbGV0ZTogKCktPlxuICAgICAgKG5ldyBvcHMuRGVsZXRlIHVuZGVmaW5lZCwgQCkuZXhlY3V0ZSgpXG4gICAgICBudWxsXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCBjYWxsRXZlbnQrZm9yd2FyZEV2ZW50PyBPbmx5IG9uZSBzdWZmaWNlcyBwcm9iYWJseVxuICAgIGNhbGxFdmVudDogKCktPlxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xuICAgICAgICBjYWxsb24gPSBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlXG4gICAgICAgIGNhbGxvbiA9IEBcbiAgICAgIEBmb3J3YXJkRXZlbnQgY2FsbG9uLCBhcmd1bWVudHMuLi5cblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQgYW5kIHNwZWNpZnkgaW4gd2hpY2ggY29udGV4dCB0aGUgbGlzdGVuZXIgaXMgY2FsbGVkIChzZXQgJ3RoaXMnKS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIHRoaXMgP1xuICAgIGZvcndhcmRFdmVudDogKG9wLCBhcmdzLi4uKS0+XG4gICAgICBmb3IgZiBpbiBAZXZlbnRfbGlzdGVuZXJzXG4gICAgICAgIGYuY2FsbCBvcCwgYXJncy4uLlxuXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBAaXNfZGVsZXRlZFxuXG4gICAgYXBwbHlEZWxldGU6IChnYXJiYWdlY29sbGVjdCA9IHRydWUpLT5cbiAgICAgIGlmIG5vdCBAZ2FyYmFnZV9jb2xsZWN0ZWRcbiAgICAgICAgI2NvbnNvbGUubG9nIFwiYXBwbHlEZWxldGU6ICN7QHR5cGV9XCJcbiAgICAgICAgQGlzX2RlbGV0ZWQgPSB0cnVlXG4gICAgICAgIGlmIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gdHJ1ZVxuICAgICAgICAgIEBIQi5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IgQFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgI2NvbnNvbGUubG9nIFwiY2xlYW51cDogI3tAdHlwZX1cIlxuICAgICAgQEhCLnJlbW92ZU9wZXJhdGlvbiBAXG4gICAgICBAZGVsZXRlQWxsT2JzZXJ2ZXJzKClcblxuICAgICNcbiAgICAjIFNldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBzZXRQYXJlbnQ6IChAcGFyZW50KS0+XG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UGFyZW50OiAoKS0+XG4gICAgICBAcGFyZW50XG5cbiAgICAjXG4gICAgIyBDb21wdXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyICh1aWQpIHRoYXQgaWRlbnRpZmllcyB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0VWlkOiAoKS0+XG4gICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgQHVpZFxuICAgICAgZWxzZVxuICAgICAgICBpZiBAdWlkLmFsdD8gIyBjb3VsZCBiZSAoc2FmZWx5KSB1bmRlZmluZWRcbiAgICAgICAgICBtYXBfdWlkID0gQHVpZC5hbHQuY2xvbmVVaWQoKVxuICAgICAgICAgIG1hcF91aWQuc3ViID0gQHVpZC5zdWJcbiAgICAgICAgICBtYXBfdWlkXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcblxuICAgIGNsb25lVWlkOiAoKS0+XG4gICAgICB1aWQgPSB7fVxuICAgICAgZm9yIG4sdiBvZiBAZ2V0VWlkKClcbiAgICAgICAgdWlkW25dID0gdlxuICAgICAgdWlkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSWYgbm90IGFscmVhZHkgZG9uZSwgc2V0IHRoZSB1aWRcbiAgICAjIEFkZCB0aGlzIHRvIHRoZSBIQlxuICAgICMgTm90aWZ5IHRoZSBhbGwgdGhlIGxpc3RlbmVycy5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGlzX2V4ZWN1dGVkID0gdHJ1ZVxuICAgICAgICBpZiBub3QgQHVpZD9cbiAgICAgICAgICAjIFdoZW4gdGhpcyBvcGVyYXRpb24gd2FzIGNyZWF0ZWQgd2l0aG91dCBhIHVpZCwgdGhlbiBzZXQgaXQgaGVyZS5cbiAgICAgICAgICAjIFRoZXJlIGlzIG9ubHkgb25lIG90aGVyIHBsYWNlLCB3aGVyZSB0aGlzIGNhbiBiZSBkb25lIC0gYmVmb3JlIGFuIEluc2VydGlvblxuICAgICAgICAgICMgaXMgZXhlY3V0ZWQgKGJlY2F1c2Ugd2UgbmVlZCB0aGUgY3JlYXRvcl9pZClcbiAgICAgICAgICBAdWlkID0gQEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgICAgQEhCLmFkZE9wZXJhdGlvbiBAXG4gICAgICAgICAgZm9yIGwgaW4gZXhlY3V0aW9uX2xpc3RlbmVyXG4gICAgICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgICAgQFxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCwgYmFzZSA9IFwidGhpc1wiKS0+XG4gICAgICBpZiBvcD8gYW5kIG9wLl9nZXRNb2RlbD9cbiAgICAgICAgb3AgPSBvcC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgbm90IG9wP1xuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiBvcC5leGVjdXRlPyBvciBub3QgKG9wLm9wX251bWJlcj8gYW5kIG9wLmNyZWF0b3I/KVxuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZCwgb3Igb3AgaXMgc3RyaW5nLiBDdXJyZW50bHkgXCJEZWxpbWl0ZXJcIiBpcyBzYXZlZCBhcyBzdHJpbmdcbiAgICAgICAgIyAoaW4gY29tYmluYXRpb24gd2l0aCBAcGFyZW50IHlvdSBjYW4gcmV0cmlldmUgdGhlIGRlbGltaXRlci4uKVxuICAgICAgICBpZiBiYXNlIGlzIFwidGhpc1wiXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBkZXN0ID0gQFtiYXNlXVxuICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcbiAgICAgICAgICBsYXN0X3BhdGggPSBwYXRocy5wb3AoKVxuICAgICAgICAgIGZvciBwYXRoIGluIHBhdGhzXG4gICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxuICAgICAgICAgIGRlc3RbbGFzdF9wYXRoXSA9IG9wXG4gICAgICBlbHNlXG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW2Jhc2VdID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbYmFzZV1bbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSB0cnVlXG4gICAgICBmb3IgYmFzZV9uYW1lLCBiYXNlIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBiYXNlXG4gICAgICAgICAgb3AgPSBASEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICAgIGlmIG9wXG4gICAgICAgICAgICBpZiBiYXNlX25hbWUgaXMgXCJ0aGlzXCJcbiAgICAgICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIGRlc3QgPSBAW2Jhc2VfbmFtZV1cbiAgICAgICAgICAgICAgcGF0aHMgPSBuYW1lLnNwbGl0KFwiL1wiKVxuICAgICAgICAgICAgICBsYXN0X3BhdGggPSBwYXRocy5wb3AoKVxuICAgICAgICAgICAgICBmb3IgcGF0aCBpbiBwYXRoc1xuICAgICAgICAgICAgICAgIGRlc3QgPSBkZXN0W3BhdGhdXG4gICAgICAgICAgICAgIGRlc3RbbGFzdF9wYXRoXSA9IG9wXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdW5pbnN0YW50aWF0ZWRbYmFzZV9uYW1lXSA/PSB7fVxuICAgICAgICAgICAgdW5pbnN0YW50aWF0ZWRbYmFzZV9uYW1lXVtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgICAgc3VjY2VzcyA9IGZhbHNlXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICAgIHJldHVybiBAXG5cbiAgICBnZXRDdXN0b21UeXBlOiAoKS0+XG4gICAgICBpZiBub3QgQGN1c3RvbV90eXBlP1xuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlRoaXMgb3BlcmF0aW9uIHdhcyBub3QgaW5pdGlhbGl6ZWQgd2l0aCBhIGN1c3RvbSB0eXBlXCJcbiAgICAgICAgQFxuICAgICAgZWxzZVxuICAgICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXG4gICAgICAgICAgIyBoYXMgbm90IGJlZW4gaW5pdGlhbGl6ZWQgeWV0IChvbmx5IHRoZSBuYW1lIGlzIHNwZWNpZmllZClcbiAgICAgICAgICBUeXBlID0gQGN1c3RvbV90eXBlc1xuICAgICAgICAgIGZvciB0IGluIEBjdXN0b21fdHlwZS5zcGxpdChcIi5cIilcbiAgICAgICAgICAgIFR5cGUgPSBUeXBlW3RdXG4gICAgICAgICAgQGN1c3RvbV90eXBlID0gbmV3IFR5cGUoKVxuICAgICAgICAgIEBjdXN0b21fdHlwZS5fc2V0TW9kZWwgQFxuICAgICAgICBAY3VzdG9tX3R5cGVcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBqc29uLnR5cGUgPSBAdHlwZVxuICAgICAganNvbi51aWQgPSBAZ2V0VWlkKClcbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xuICAgICAgICAgIGpzb24uY3VzdG9tX3R5cGUgPSBAY3VzdG9tX3R5cGVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb24uY3VzdG9tX3R5cGUgPSBAY3VzdG9tX3R5cGUuX25hbWVcblxuICAgICAgaWYgQGNvbnRlbnQ/LmdldFVpZD9cbiAgICAgICAganNvbi5jb250ZW50ID0gQGNvbnRlbnQuZ2V0VWlkKClcbiAgICAgIGVsc2VcbiAgICAgICAganNvbi5jb250ZW50ID0gQGNvbnRlbnRcbiAgICAgIGlmIEBjb250ZW50X29wZXJhdGlvbnM/XG4gICAgICAgIG9wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIEBjb250ZW50X29wZXJhdGlvbnNcbiAgICAgICAgICBpZiBvLl9nZXRNb2RlbD9cbiAgICAgICAgICAgIG8gPSBvLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgICBvcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxuICAgICAgICBqc29uLmNvbnRlbnRfb3BlcmF0aW9ucyA9IG9wZXJhdGlvbnNcbiAgICAgIGpzb25cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgRGVsZXRlLXR5cGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyBhbiBvcGVyYXRpb24uXG4gICNcbiAgY2xhc3Mgb3BzLkRlbGV0ZSBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBkZWxldGVzKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnZGVsZXRlcycsIGRlbGV0ZXNcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiRGVsZXRlXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJlcyA9IHN1cGVyXG4gICAgICAgIGlmIHJlc1xuICAgICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgcmVzXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgI1xuICAjIERlZmluZSBob3cgdG8gcGFyc2UgRGVsZXRlIG9wZXJhdGlvbnMuXG4gICNcbiAgb3BzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyB0aGlzKG51bGwsIHVpZCwgZGVsZXRlc191aWQpXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWQgKHVuaW1wbGVtZW50ZWQsIGdvb2QgaWRlYT8pXG4gICMgICAtIFRoZSBjb21wbGV0ZS1saXN0IChhYmJyZXYuIGNsKSBtYWludGFpbnMgYWxsIG9wZXJhdGlvbnNcbiAgI1xuICBjbGFzcyBvcHMuSW5zZXJ0IGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMsIHBhcmVudCwgdWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgdmFsOiAoKS0+XG4gICAgICBAZ2V0Q29udGVudCgpXG5cbiAgICBnZXROZXh0OiAoaT0xKS0+XG4gICAgICBuID0gQFxuICAgICAgd2hpbGUgaSA+IDAgYW5kIG4ubmV4dF9jbD9cbiAgICAgICAgbiA9IG4ubmV4dF9jbFxuICAgICAgICBpZiBub3Qgbi5pc19kZWxldGVkXG4gICAgICAgICAgaS0tXG4gICAgICBpZiBuLmlzX2RlbGV0ZWRcbiAgICAgICAgbnVsbFxuICAgICAgblxuXG4gICAgZ2V0UHJldjogKGk9MSktPlxuICAgICAgbiA9IEBcbiAgICAgIHdoaWxlIGkgPiAwIGFuZCBuLnByZXZfY2w/XG4gICAgICAgIG4gPSBuLnByZXZfY2xcbiAgICAgICAgaWYgbm90IG4uaXNfZGVsZXRlZFxuICAgICAgICAgIGktLVxuICAgICAgaWYgbi5pc19kZWxldGVkXG4gICAgICAgIG51bGxcbiAgICAgIGVsc2VcbiAgICAgICAgblxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc19kZWxldGVkIGFuZCBvPyAjIG8/IDogaWYgbm90IG8/LCB0aGVuIHRoZSBkZWxpbWl0ZXIgZGVsZXRlZCB0aGlzIEluc2VydGlvbi4gRnVydGhlcm1vcmUsIGl0IHdvdWxkIGJlIHdyb25nIHRvIGNhbGwgaXQuIFRPRE86IG1ha2UgdGhpcyBtb3JlIGV4cHJlc3NpdmUgYW5kIHNhdmVcbiAgICAgICAgIyBjYWxsIGlmZiB3YXNuJ3QgZGVsZXRlZCBlYXJseWVyXG4gICAgICAgIGNhbGxMYXRlciA9IHRydWVcbiAgICAgIGlmIG8/XG4gICAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgZ2FyYmFnZWNvbGxlY3QgPSBmYWxzZVxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgZ2FyYmFnZWNvbGxlY3QgPSB0cnVlXG4gICAgICBzdXBlciBnYXJiYWdlY29sbGVjdFxuICAgICAgaWYgY2FsbExhdGVyXG4gICAgICAgIEBwYXJlbnQuY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzKHRoaXMsIG8pXG4gICAgICBpZiBAcHJldl9jbD8gYW5kIEBwcmV2X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgICMgZ2FyYmFnZSBjb2xsZWN0IHByZXZfY2xcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJyaWdodCBpcyBub3QgZGVsZXRlZC4gaW5jb25zaXN0ZW5jeSEsIHdyYXJhcmFyXCJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XG4gICAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgICB3aGlsZSBvLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxuICAgICAgICAgICAgby5vcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQG5leHRfY2xcbiAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBwcmV2X2NsXG5cbiAgICAgICAgIyBkZWxldGUgY29udGVudFxuICAgICAgICAjIC0gd2UgbXVzdCBub3QgZG8gdGhpcyBpbiBhcHBseURlbGV0ZSwgYmVjYXVzZSB0aGlzIHdvdWxkIGxlYWQgdG8gaW5jb25zaXN0ZW5jaWVzXG4gICAgICAgICMgKGUuZy4gdGhlIGZvbGxvd2luZyBvcGVyYXRpb24gb3JkZXIgbXVzdCBiZSBpbnZlcnRpYmxlIDpcbiAgICAgICAgIyAgIEluc2VydCByZWZlcnMgdG8gY29udGVudCwgdGhlbiB0aGUgY29udGVudCBpcyBkZWxldGVkKVxuICAgICAgICAjIFRoZXJlZm9yZSwgd2UgaGF2ZSB0byBkbyB0aGlzIGluIHRoZSBjbGVhbnVwXG4gICAgICAgICMgKiBOT0RFOiBXZSBuZXZlciBkZWxldGUgSW5zZXJ0aW9ucyFcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uIGFuZCBub3QgKEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLkluc2VydClcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5LS1cbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXG4gICAgICAgICAgICBAY29udGVudC5hcHBseURlbGV0ZSgpXG4gICAgICAgIGRlbGV0ZSBAY29udGVudFxuICAgICAgICBzdXBlclxuICAgICAgIyBlbHNlXG4gICAgICAjICAgU29tZW9uZSBpbnNlcnRlZCBzb21ldGhpbmcgaW4gdGhlIG1lYW50aW1lLlxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA/PSAwXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSsrXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgaXMgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAxXG4gICAgICAgICAgICAgICAgaWYgby51aWQuY3JlYXRvciA8IEB1aWQuY3JlYXRvclxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICMgbm9wXG4gICAgICAgICAgICAgIGVsc2UgaWYgby5nZXREaXN0YW5jZVRvT3JpZ2luKCkgPCBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDJcbiAgICAgICAgICAgICAgICBpZiBpIC0gZGlzdGFuY2VfdG9fb3JpZ2luIDw9IG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyh0aGlzKVxuICAgICAgICBAXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBqc29uLnByZXYgPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAganNvbi5uZXh0ID0gQG5leHRfY2wuZ2V0VWlkKClcblxuICAgICAgaWYgQG9yaWdpbi50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAganNvbi5vcmlnaW4gPSBcIkRlbGltaXRlclwiXG4gICAgICBlbHNlIGlmIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uLm9yaWdpbiA9IEBvcmlnaW4uZ2V0VWlkKClcblxuICAgICAgIyBpZiBub3QgKGpzb24ucHJldj8gYW5kIGpzb24ubmV4dD8pXG4gICAgICBqc29uLnBhcmVudCA9IEBwYXJlbnQuZ2V0VWlkKClcblxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5JbnNlcnQucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAncGFyZW50JyA6IHBhcmVudFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMgbnVsbCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zLCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3Mgb3BzLkRlbGltaXRlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIG51bGwsIHtub09wZXJhdGlvbjogdHJ1ZX1cblxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEB1bmNoZWNrZWQ/WydwcmV2X2NsJ11cbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUHJvYmFibHkgZHVwbGljYXRlZCBvcGVyYXRpb25zXCJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIHN1cGVyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBmYWxzZVxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IG9yIEBuZXh0X2NsPyBvciB0cnVlICMgVE9ETzogYXJlIHlvdSBzdXJlPyBUaGlzIGNhbiBoYXBwZW4gcmlnaHQ/XG4gICAgICAgIHN1cGVyXG4gICAgICAjZWxzZVxuICAgICAgIyAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBvcHMuRGVsaW1pdGVyLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkLCBwcmV2LCBuZXh0KVxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICdvcGVyYXRpb25zJyA6IG9wc1xuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9ICgpLT5cbiAgYmFzaWNfb3BzID0gYmFzaWNfb3BzX3VuaW5pdGlhbGl6ZWQoKVxuICBvcHMgPSBiYXNpY19vcHMub3BlcmF0aW9uc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIG1hcCBsaWtlIG9iamVjdHMuIEUuZy4gSnNvbi1UeXBlIGFuZCBYTUwgYXR0cmlidXRlcy5cbiAgI1xuICBjbGFzcyBvcHMuTWFwTWFuYWdlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cbiAgICAgIEBfbWFwID0ge31cbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xuXG4gICAgdHlwZTogXCJNYXBNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBmb3IgbmFtZSxwIG9mIEBfbWFwXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgbWFwOiAoZiktPlxuICAgICAgZm9yIG4sdiBvZiBAX21hcFxuICAgICAgICBmKG4sdilcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uT3BlcmF0aW9ucy52YWxcbiAgICAjXG4gICAgdmFsOiAobmFtZSwgY29udGVudCktPlxuICAgICAgaWYgYXJndW1lbnRzLmxlbmd0aCA+IDFcbiAgICAgICAgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuX2dldE1vZGVsP1xuICAgICAgICAgIHJlcCA9IGNvbnRlbnQuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmVwID0gY29udGVudFxuICAgICAgICBAcmV0cmlldmVTdWIobmFtZSkucmVwbGFjZSByZXBcbiAgICAgICAgQGdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBwcm9wID0gQF9tYXBbbmFtZV1cbiAgICAgICAgaWYgcHJvcD8gYW5kIG5vdCBwcm9wLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgIHJlcyA9IHByb3AudmFsKClcbiAgICAgICAgICBpZiByZXMgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgICByZXMuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgcmVzXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzdWx0ID0ge31cbiAgICAgICAgZm9yIG5hbWUsbyBvZiBAX21hcFxuICAgICAgICAgIGlmIG5vdCBvLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gby52YWwoKVxuICAgICAgICByZXN1bHRcblxuICAgIGRlbGV0ZTogKG5hbWUpLT5cbiAgICAgIEBfbWFwW25hbWVdPy5kZWxldGVDb250ZW50KClcbiAgICAgIEBcblxuICAgIHJldHJpZXZlU3ViOiAocHJvcGVydHlfbmFtZSktPlxuICAgICAgaWYgbm90IEBfbWFwW3Byb3BlcnR5X25hbWVdP1xuICAgICAgICBldmVudF9wcm9wZXJ0aWVzID1cbiAgICAgICAgICBuYW1lOiBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIGV2ZW50X3RoaXMgPSBAXG4gICAgICAgIHJtX3VpZCA9XG4gICAgICAgICAgbm9PcGVyYXRpb246IHRydWVcbiAgICAgICAgICBzdWI6IHByb3BlcnR5X25hbWVcbiAgICAgICAgICBhbHQ6IEBcbiAgICAgICAgcm0gPSBuZXcgb3BzLlJlcGxhY2VNYW5hZ2VyIG51bGwsIGV2ZW50X3Byb3BlcnRpZXMsIGV2ZW50X3RoaXMsIHJtX3VpZCAjIHRoaXMgb3BlcmF0aW9uIHNoYWxsIG5vdCBiZSBzYXZlZCBpbiB0aGUgSEJcbiAgICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV0gPSBybVxuICAgICAgICBybS5zZXRQYXJlbnQgQCwgcHJvcGVydHlfbmFtZVxuICAgICAgICBybS5leGVjdXRlKClcbiAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdXG5cbiAgb3BzLk1hcE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnIDogY3VzdG9tX3R5cGVcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyhjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpXG5cblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5MaXN0TWFuYWdlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEEgTGlzdE1hbmFnZXIgbWFpbnRhaW5zIGEgbm9uLWVtcHR5IGxpc3QgdGhhdCBoYXMgYSBiZWdpbm5pbmcgYW5kIGFuIGVuZCAoYm90aCBEZWxpbWl0ZXJzISlcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgQGJlZ2lubmluZyA9IG5ldyBvcHMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICBAZW5kID0gICAgICAgbmV3IG9wcy5EZWxpbWl0ZXIgQGJlZ2lubmluZywgdW5kZWZpbmVkXG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2wgPSBAZW5kXG4gICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgQGVuZC5leGVjdXRlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgZm9yIGksIG8gaW4gdmFsXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuT2JqZWN0XG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiBvcHMuTGlzdE1hbmFnZXJcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgbWFwOiAoZiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBmKG8pXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgZm9sZDogKGluaXQsIGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpbml0ID0gZihpbml0LCBvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBpbml0XG5cbiAgICB2YWw6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICBAdG9BcnJheSgpXG5cbiAgICByZWY6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxuICAgICAgICAgIG9cbiAgICAgICAgZWxzZVxuICAgICAgICAgIG51bGxcbiAgICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ5b3UgbXVzdCBzcGVjaWZ5IGEgcG9zaXRpb24gcGFyYW1ldGVyXCJcblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICMgZS5nLiBcImFiY1wiIDogdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBvLnByZXZfY2w/XG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgW2NvbnRlbnRdXG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnRzKS0+XG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG5cbiAgICAgICMgVE9ETzogYWx3YXlzIGV4cGVjdCBhbiBhcnJheSBhcyBjb250ZW50LiBUaGVuIHlvdSBjYW4gY29tYmluZSB0aGlzIHdpdGggdGhlIG90aGVyIG9wdGlvbiAoZWxzZSlcbiAgICAgIGlmIGNvbnRlbnRzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgIGVsc2VcbiAgICAgICAgZm9yIGMgaW4gY29udGVudHNcbiAgICAgICAgICBpZiBjPyBhbmQgYy5fbmFtZT8gYW5kIGMuX2dldE1vZGVsP1xuICAgICAgICAgICAgYyA9IGMuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICAgIHRtcCA9IChuZXcgb3BzLkluc2VydCBudWxsLCBjLCBudWxsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYW4gYXJyYXkgb2YgY29udGVudCBpbnRvIHRoaXMgbGlzdC5cbiAgICAjIEBOb3RlOiBUaGlzIGV4cGVjdHMgYW4gYXJyYXkgYXMgY29udGVudCFcbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50cyktPlxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50c1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XG4gICAgI1xuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGggPSAxKS0+XG4gICAgICBvID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24ocG9zaXRpb24rMSkgIyBwb3NpdGlvbiAwIGluIHRoaXMgY2FzZSBpcyB0aGUgZGVsZXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlclxuXG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQgPSAobmV3IG9wcy5EZWxldGUgbnVsbCwgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSAobm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcikpIGFuZCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBkZWxldGVfb3BzLnB1c2ggZC5fZW5jb2RlKClcbiAgICAgIEBcblxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGdldENvbnRlbnRUeXBlID0gKGNvbnRlbnQpLT5cbiAgICAgICAgaWYgY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY29udGVudFxuICAgICAgQGNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcbiAgICAgICAgcmVmZXJlbmNlOiBvcFxuICAgICAgICBwb3NpdGlvbjogb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKClcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICB2YWx1ZTogZ2V0Q29udGVudFR5cGUgb3AudmFsKClcbiAgICAgIF1cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cbiAgICAgIEBjYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXG4gICAgICAgIHJlZmVyZW5jZTogb3BcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpICMgVE9ETzogWW91IGNhbiBjb21iaW5lIGdldFBvc2l0aW9uICsgZ2V0UGFyZW50IGluIGEgbW9yZSBlZmZpY2llbnQgbWFubmVyISAob25seSBsZWZ0IERlbGltaXRlciB3aWxsIGhvbGQgQHBhcmVudClcbiAgICAgICAgbGVuZ3RoOiAxXG4gICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXG4gICAgICAgIG9sZFZhbHVlOiBvcC52YWwoKVxuICAgICAgXVxuXG4gIG9wcy5MaXN0TWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZSc6IGN1c3RvbV90eXBlXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKVxuXG4gIGNsYXNzIG9wcy5Db21wb3NpdGlvbiBleHRlbmRzIG9wcy5MaXN0TWFuYWdlclxuXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgQF9jb21wb3NpdGlvbl92YWx1ZSwgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucywgdWlkLCB0bXBfY29tcG9zaXRpb25fcmVmKS0+XG4gICAgICAjIHdlIGNhbid0IHVzZSBAc2V2ZU9wZXJhdGlvbiAnY29tcG9zaXRpb25fcmVmJywgdG1wX2NvbXBvc2l0aW9uX3JlZiBoZXJlLFxuICAgICAgIyBiZWNhdXNlIHRoZW4gdGhlcmUgaXMgYSBcImxvb3BcIiAoaW5zZXJ0aW9uIHJlZmVycyB0byBwYXJlbnQsIHJlZmVycyB0byBpbnNlcnRpb24uLilcbiAgICAgICMgVGhpcyBpcyB3aHkgd2UgaGF2ZSB0byBjaGVjayBpbiBAY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzIHVudGlsIHdlIGZpbmQgaXRcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcbiAgICAgIGlmIHRtcF9jb21wb3NpdGlvbl9yZWY/XG4gICAgICAgIEB0bXBfY29tcG9zaXRpb25fcmVmID0gdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgZWxzZVxuICAgICAgICBAY29tcG9zaXRpb25fcmVmID0gQGVuZC5wcmV2X2NsXG4gICAgICBpZiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xuICAgICAgICBAY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucyA9IHt9XG4gICAgICAgIGZvciBuLG8gb2YgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9uc1xuICAgICAgICAgIEBzYXZlT3BlcmF0aW9uIG4sIG8sICdfY29tcG9zaXRpb25fdmFsdWUnXG5cbiAgICB0eXBlOiBcIkNvbXBvc2l0aW9uXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBnZXRDdXN0b21UeXBlKCkuX3NldENvbXBvc2l0aW9uVmFsdWUgQF9jb21wb3NpdGlvbl92YWx1ZVxuICAgICAgICBkZWxldGUgQF9jb21wb3NpdGlvbl92YWx1ZVxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC1vcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBpZiBvcC51aWQuY3JlYXRvciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5jcmVhdG9yIGFuZCBvcC51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxuICAgICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBvcFxuICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIG9wID0gb3AubmV4dF9jbFxuICAgICAgICAgIGlmIG9wIGlzIEBlbmRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmV0dXJuXG5cbiAgICAgIG8gPSBAZW5kLnByZXZfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBvcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl91bmFwcGx5IG8udW5kb19kZWx0YVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBvLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBAZW5kLnByZXZfY2xcblxuICAgICAgQGNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBuZXdWYWx1ZTogQHZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICByZXR1cm5cblxuICAgICNcbiAgICAjIENyZWF0ZSBhIG5ldyBEZWx0YVxuICAgICMgLSBpbnNlcnRzIG5ldyBDb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fdmFsdWVcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fcmVmXG4gICAgI1xuICAgICMgQHBhcmFtIGRlbHRhIFRoZSBkZWx0YSB0aGF0IGlzIGFwcGxpZWQgdG8gdGhlIGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgI1xuICAgIGFwcGx5RGVsdGE6IChkZWx0YSwgb3BlcmF0aW9ucyktPlxuICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGRlbHRhLCBvcGVyYXRpb25zLCBALCBudWxsLCBAZW5kLnByZXZfY2wsIEBlbmQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBjdXN0b20gPSBAZ2V0Q3VzdG9tVHlwZSgpLl9nZXRDb21wb3NpdGlvblZhbHVlKClcbiAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWUgPSBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVcbiAgICAgIGlmIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxuICAgICAgaWYgQGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29tcG9zaXRpb25fcmVmID0gQHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuQ29tcG9zaXRpb24ucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICAnY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucycgOiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAnY29tcG9zaXRpb25fcmVmJyA6IGNvbXBvc2l0aW9uX3JlZlxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIGNvbXBvc2l0aW9uX3ZhbHVlLCBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zLCB1aWQsIGNvbXBvc2l0aW9uX3JlZilcblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkKS0+XG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xuICAgICAgICBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10gPSBAZXZlbnRfdGhpcy5nZXRDdXN0b21UeXBlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcC5wcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBvcC5pc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBvcC5wcmV2X2NsLnZhbCgpXG4gICAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgICAgICBvbGRWYWx1ZTogb2xkX3ZhbHVlXG4gICAgICAgICAgXVxuICAgICAgICBvcC5wcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgb3AubmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBvcC5hcHBseURlbGV0ZSgpXG4gICAgICBlbHNlICMgcHJldiBfYW5kXyBuZXh0IGFyZSBEZWxpbWl0ZXJzLiBUaGlzIGlzIHRoZSBmaXJzdCBjcmVhdGVkIFJlcGxhY2VhYmxlIGluIHRoZSBSTVxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIEBjYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBvcC52YWwoKVxuICAgICAgICBdXG5cblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIG51bGwsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIGxhc3Rfb3AgPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBpZiAobm90IGxhc3Rfb3AuaXNEZWxldGVkKCkpIGFuZCBsYXN0X29wLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgIChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cblxuXG4gIGJhc2ljX29wc1xuIiwiXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcblxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XG4gIHVzZXJfaWQgPSBudWxsXG4gIGlmIGNvbm5lY3Rvci51c2VyX2lkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLm9uX3VzZXJfaWRfc2V0ID0gKGlkKS0+XG4gICAgICB1c2VyX2lkID0gaWRcbiAgICAgIEhCLnJlc2V0VXNlcklkIGlkXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICBvcHNfbWFuYWdlciA9IHN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgSEIsIHRoaXMuY29uc3RydWN0b3JcbiAgb3BzID0gb3BzX21hbmFnZXIub3BlcmF0aW9uc1xuXG4gIGVuZ2luZSA9IG5ldyBFbmdpbmUgSEIsIG9wc1xuICBhZGFwdENvbm5lY3RvciBjb25uZWN0b3IsIGVuZ2luZSwgSEIsIG9wc19tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lclxuXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLkhCID0gSEJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUub3BlcmF0aW9ucyA9IG9wc1xuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY29ubmVjdG9yID0gY29ubmVjdG9yXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmN1c3RvbV90eXBlcyA9IHRoaXMuY29uc3RydWN0b3JcblxuICBjdCA9IG5ldyBjcmVhdGVZLk9iamVjdCgpXG4gIG1vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKGN0LCBIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKSkuZXhlY3V0ZSgpXG4gIGN0Ll9zZXRNb2RlbCBtb2RlbFxuICBjdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcbmlmIHdpbmRvdz9cbiAgd2luZG93LlkgPSBjcmVhdGVZXG5cbmNyZWF0ZVkuT2JqZWN0ID0gcmVxdWlyZSBcIi4vT2JqZWN0VHlwZVwiXG4iXX0=
