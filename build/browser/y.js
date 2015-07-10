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
    if (args.constructor === Function) {
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
        data: this.getStateVector()
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
      data: this.getStateVector()
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
    var args, el, f, _i, _len, _ref;
    if (!this.is_synced) {
      this.is_synced = true;
      if (this.compute_when_synced != null) {
        _ref = this.compute_when_synced;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          el = _ref[_i];
          f = el[0];
          args = el.slice(1);
          f.apply(args);
        }
        delete this.compute_when_synced;
      }
      return null;
    }
  },
  whenReceivedStateVector: function(f) {
    if (this.when_received_state_vector_listeners == null) {
      this.when_received_state_vector_listeners = [];
    }
    return this.when_received_state_vector_listeners.push(f);
  },
  receiveMessage: function(sender, res) {
    var data, f, hb, o, sendApplyHB, send_again, _hb, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _results;
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
        if (this.when_received_state_vector_listeners != null) {
          _ref1 = this.when_received_state_vector_listeners;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            f = _ref1[_j];
            f.call(this, res.data);
          }
        }
        delete this.when_received_state_vector_listeners;
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
        for (_k = 0, _len2 = hb.length; _k < _len2; _k++) {
          o = hb[_k];
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
                var _l, _len3;
                hb = _this.getHB(sv).hb;
                for (_l = 0, _len3 = hb.length; _l < _len3; _l++) {
                  o = hb[_l];
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

  HistoryBuffer.prototype.setUserId = function(user_id, state_vector) {
    var buff, counter_diff, o, o_name, _base, _name, _ref;
    this.user_id = user_id;
    if ((_base = this.buffer)[_name = this.user_id] == null) {
      _base[_name] = [];
    }
    buff = this.buffer[this.user_id];
    counter_diff = state_vector[this.user_id] || 0;
    if (this.buffer._temp != null) {
      _ref = this.buffer._temp;
      for (o_name in _ref) {
        o = _ref[o_name];
        o.uid.creator = this.user_id;
        o.uid.op_number += counter_diff;
        buff[o.uid.op_number] = o;
      }
    }
    this.operation_counter[this.user_id] = (this.operation_counter._temp || 0) + counter_diff;
    delete this.operation_counter._temp;
    return delete this.buffer._temp;
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
    if (o.uid.op_number === this.operation_counter[o.uid.creator]) {
      this.operation_counter[o.uid.creator]++;
    }
    while (this.buffer[o.uid.creator][this.operation_counter[o.uid.creator]] != null) {
      this.operation_counter[o.uid.creator]++;
    }
    return void 0;
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
      if ((this.prev_cl != null) && this.prev_cl.isDeleted() && this.prev_cl.garbage_collected !== true) {
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
      var distance_to_origin, i, o, oDistance, _base;
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
            oDistance = o.getDistanceToOrigin();
            if (o !== this.next_cl) {
              if (o.getDistanceToOrigin() === i) {
                if (o.uid.creator < this.uid.creator) {
                  this.prev_cl = o;
                  distance_to_origin = i + 1;
                } else {

                }
              } else if (oDistance < i) {
                if (i - distance_to_origin <= oDistance) {
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
var RBTReeByIndex, basic_ops_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

basic_ops_uninitialized = require("./Basic");

RBTReeByIndex = require('bintrees/lib/rbtree_by_index');

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

    ListManager.prototype.getNext = function(start) {
      var o;
      o = start.next_cl;
      while (!(o instanceof ops.Delimiter)) {
        if (o.is_deleted) {
          o = o.next_cl;
        } else if (o instanceof ops.Delimiter) {
          return false;
        } else {
          break;
        }
      }
      return o;
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

    ListManager.prototype.insertAfterHelper = function(root, content) {
      var right;
      if (!root.right) {
        root.bt.right = content;
        return content.bt.parent = root;
      } else {
        return right = root.next_cl;
      }
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

    ListManager.prototype.deleteRef = function(o, length) {
      var d, delete_ops, i, _i;
      if (length == null) {
        length = 1;
      }
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

    ListManager.prototype["delete"] = function(position, length) {
      var o;
      if (length == null) {
        length = 1;
      }
      o = this.getOperationByPosition(position + 1);
      return this.deleteRef(o, length);
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
      var composition_ref;
      if (this.validateSavedOperations()) {
        this.getCustomType()._setCompositionValue(this._composition_value);
        delete this._composition_value;
        if (this.tmp_composition_ref) {
          composition_ref = this.HB.getOperation(this.tmp_composition_ref);
          if (composition_ref != null) {
            delete this.tmp_composition_ref;
            this.composition_ref = composition_ref;
          }
        }
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
  ops.FastListManager = (function(_super) {
    __extends(FastListManager, _super);

    function FastListManager() {
      this.shortTree = new RBTreeByIndex();
      FastListManager.__super__.constructor.apply(this, arguments);
    }

    FastListManager.prototype.type = 'FastListManager';

    FastListManager.prototype.getNext = function(start) {
      return start.node.next().data;
    };

    FastListManager.prototype.getPrev = function(start) {
      return start.node.prev().data;
    };

    FastListManager.prototype.map = function(fun) {
      return this.shortTree.map(function(operation) {
        return fun(operation);
      });
    };

    FastListManager.prototype.fold = function(init, f) {
      this.shortTree.each(function(operation) {
        return init = f(init, operation);
      });
      return init;
    };

    FastListManager.prototype.val = function(position) {
      if (position != null) {
        return (this.shortTree.find(position)).val();
      } else {
        return this.shortTree.map(function(operation) {
          return operation.val();
        });
      }
    };

    FastListManager.prototype.ref = function(position) {
      if (position != null) {
        return this.shortTree.find(position);
      } else {
        return this.shortTree.map(function(operation) {
          return operation;
        });
      }
    };

    FastListManager.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, [content]);
    };

    FastListManager.prototype.insertAfter = function(left, contents) {
      var nodeOnLeft, nodeOnRight, operation, right;
      nodeOnLeft = left === this.beginning ? null : left.node;
      nodeOnRight = nodeOnLeft ? nodeOnLeft.next() : this.shortTree.find(0);
      right = nodeOnRight ? nodeOnRight.data : this.end;
      left = right.prev_cl;
      if (contents instanceof ops.Operation) {
        operation = new ops.Insert(null, content, null, void 0, void 0, left, right);
        operation.node = this.shortTree.insertAfter(nodeOnLeft, operation);
        operation.execute();
      } else {
        contents.forEach(function(content) {
          if ((content != null) && (content._name != null) && (content._getModel != null)) {
            content = content._getModel(this.custom_types, this.operations);
          }
          operation = new ops.Insert(null, c, null, void 0, void 0, left, right);
          operation.node = this.shortTree.insertAfter(nodeOnLeft, operation);
          operation.execute();
          left = operation;
          return nodeOnLeft = operation.node;
        });
      }
      return this;
    };

    FastListManager.prototype.insert = function(position, contents) {
      var left;
      left = (this.shortTree.find(position - 1)) || this.beginning;
      return this.insertAfter(left, contents);
    };

    FastListManager.prototype["delete"] = function(position, length) {
      var deleteOp, delete_ops, i, nextNode, operation, _i;
      if (length == null) {
        length = 1;
      }
      delete_ops = [];
      operation = this.shortTree.find(position);
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (operation instanceof ops.Delimiter) {
          break;
        }
        deleteOp = new ops.Delete(null, void 0, operation);
        deleteOp.execute();
        nextNode = operation.node.next();
        operation = nextNode ? nextNode.data : this.end;
        this.shortTree.remove_node(operation.node);
        operation.node = null;
        delete_ops.push(d._encode());
      }
      return this;
    };

    FastListManager.prototype.getLength = function() {
      return this.tree.size;
    };

    return FastListManager;

  })(ops.ListManager);
  return basic_ops;
};


},{"./Basic":6,"bintrees/lib/rbtree_by_index":9}],8:[function(require,module,exports){
var Engine, HistoryBuffer, adaptConnector, createY, structured_ops_uninitialized;

structured_ops_uninitialized = require("./Operations/Structured");

HistoryBuffer = require("./HistoryBuffer");

Engine = require("./Engine");

adaptConnector = require("./ConnectorAdapter");

createY = function(connector) {
  var HB, ct, engine, model, ops, ops_manager, user_id;
  if (connector.user_id != null) {
    user_id = connector.user_id;
  } else {
    user_id = "_temp";
    connector.when_received_state_vector_listeners = [
      function(state_vector) {
        return HB.setUserId(this.user_id, state_vector);
      }
    ];
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


},{"./ConnectorAdapter":1,"./Engine":3,"./HistoryBuffer":4,"./ObjectType":5,"./Operations/Structured":7}],9:[function(require,module,exports){
var TreeBase = require('./treebase');
/** algorithm from Cormen, Leiserson - Introduction to algorithm **/

function RBTree(comparator) {
    this._root = null;
    this.size = 0;
    this._nil = new Node('nil');
    this._nil.red = false;
    this._nil.weight = 0;
}

RBTree.prototype = new TreeBase();

RBTree.prototype.insert = function(position, data) {
  var nodeToInsert = new Node(data);
  if (this.insert_node(position, nodeToInsert)) {
    return nodeToInsert;
  } else {
    return false;
  }
};

RBTree.prototype.insert_node = function(position, nodeToInsert) {
  this.size += 1;
  var node = this._root;
  var insertAfter;

  if (!node) {
    this._root = nodeToInsert;
    this._root.red = false;
    return true;
  }

  while (true) {
    if (node.weight === position) { // Insert after max of node subtree
      insertAfter = node.max_tree(function(node) {
        node.weight += 1;
      });
      insertAfter.set_child('right', nodeToInsert);
      nodeToInsert.parent = insertAfter;
      break;
    } else {
      left = node.get_child('left');
      right = node.get_child('right');
      if (!left && position === 0) {
        node.weight += 1;
        node.set_child('left', nodeToInsert);
        nodeToInsert.parent = node;
        break;

      } else if (left && left.weight >= position) {
        node.weight += 1;
        node = left;

      } else if (right) {
        position -= (left? left.weight: 0) + 1;
        node.weight += 1;
        node = right;

      } else {
        node.weight += 1;
        node.set_child('right', nodeToInsert);
        nodeToInsert.parent = node;
        break;
      }
    }
  }

  this.insert_correction(nodeToInsert);
  return true;
};

RBTree.prototype.insert_between = function(onLeft, onRight, data) {
  var newNode = new Node(data);
  // onLeft and onRight are neighbors, so they can't have an element in between.
  // For example, if onLeft exists, its right neighbor is either nil or right. If it's onRight,
  // then onRight has no child. If neither left and right exist, the tree is empty.
  if (onLeft && !onLeft.right) {
    onLeft.right = newNode;
    newNode.parent = onLeft;

    this.size ++;
    this.insert_correction(newNode);
  } else if (onRight && !onRight.left) {
    onRight.left = newNode;
    newNode.parent = onRight;

    this.size ++;
    this.insert_correction(newNode);
  } else {
    this.insert_node(0, newNode);
  }
  newNode.traverse_up(function(node, parent) {
    parent.weight -= 1;
  });

  return newNode;
};

RBTree.prototype.rotate = function(side, node) {
  // all the comment are with the assumption that side === 'left'
  var neighbor;

  // get right neighbor
  neighbor = node.get_child(side, true);
  // neighbor's left tree becomes node's right tree
  node.set_child(side, neighbor.get_child(side), true);

  // if this right tree was non-empty
  if (neighbor.get_child(side)) {
    neighbor.get_child(side).parent = node; // attach neighbor's left child to node
  }
  neighbor.parent = node.parent; // link neighbor's parent to node's parent

  if (!node.parent) { // no parent === is_root
    this._root = neighbor;
  } else if (node === node.parent.get_child(side)){ // node is left child
    node.parent.set_child(side, neighbor); // node's parent left child is now neighbor
  } else {
    node.parent.set_child(side, neighbor, true); // node's parent right child is now neighbor
  }

  neighbor.set_child(side, node); // attach node on left of child
  node.parent = neighbor; // set node's parent to neighbor

  // update node's weight first, then
  node.weight = (node.left? node.left.weight: 0) + (node.right? node.right.weight: 0) + 1;
  neighbor.weight = (neighbor.left? neighbor.left.weight: 0) + (neighbor.right? neighbor.right.weight: 0) + 1;
};

RBTree.prototype.insert_correction = function(node) {
  var self = this;
  function helper(side) {
    var uncle;
    uncle = node.parent.parent.get_child(side, true);

    if (uncle && uncle.red) { // if uncle is undefined, it's a leaf so it's black
      node.parent.red        = false;
      uncle.red              = false;
      node.parent.parent.red = true;

      node = node.parent.parent;
    } else {
      if (node === node.parent.get_child(side, true)) {
        node = node.parent;
        self.rotate(side, node);
      }

      node.parent.red        = false;
      node.parent.parent.red = true;

      var oppositeSide = side === 'left'? 'right': 'left';
      self.rotate(oppositeSide, node.parent.parent);
    }
  }


  while (node.parent && node.parent.red) { // is there's no node.parent, then it means the parent
    // is nil which is black

    // if node's parent is on left of his parent
    if (node.parent === node.parent.parent.get_child('left')) { // Check that there is a grandparent
      helper('left');
    } else if (node.parent === node.parent.parent.get_child('right')){
      helper('right');
    }
  }

  this._root.red = false;

};

RBTree.prototype.find = function() {
  var node = this.findNode.apply(this, arguments);
  if (node) {
    return node.data;
  } else {
    return null;
  }
};

/** Find the node at position @position and return it. If no node is found, returns null.
 * It is also possible to pass a function as second argument. It will be called
 * with each node traversed except for the one found.
**/
RBTree.prototype.findNode = function(position, fun) {
  // if the weight is 'n', the biggest index is n-1, so we check that position >= size
  if (position >= this.size || position < 0) {
    return null;
  }
  var node = this._root;

  if (!node) {
    return null;
  }

  // Find node to delete
  while (position > 0 || (position === 0 && node.left)) {
    left = node.left;
    right = node.right;

    if (left && left.weight > position) {
      // when there's a left neighbor with a weight > position to remove,
      // go into this subtree and decrease the subtree weight
      if (fun) {
        fun(node);
      }
      node = left;

    } else if ((!left && position === 0) || (left && left.weight === position)) {
      break;
    } else if (right) {
      // when there's a right subtee, go into it and decrease the position
      // by the weight of the left subtree - 1 + 1 (for the previous node)
      if (fun) {
        fun(node);
      }
      node = right;
      position -= (left? left.weight: 0) + 1;

    } else {
      // this should not happen, except if the position is greater than the size of the tree
      throw new Error('this should not happen');
    }
  }
  return node;
};

RBTree.prototype.remove = function(position) {
  // if the weight is 'n', the biggest index is n-1, so we check that position >= size
  var nodeToRemove;

  nodeToRemove = this.findNode(position, function(node) { node.weight --; });
  this.size -= 1;

  return this.remove_helper(nodeToRemove);
};

RBTree.prototype.remove_helper = function(nodeToRemove) {
  var left, right, nextNode, childNode, parent;

  // if there's only one child, replace the nodeToRemove to delete by it's child and update
  // the refs.
  // if there's two children, find it's successor and replace the nodeToRemove to delete by his successor
  // and update the refs

  if (!nodeToRemove.left || !nodeToRemove.right) {
    nextNode = nodeToRemove;
  } else {
    nextNode = nodeToRemove.next(function(node) {
      node.weight -= 1;
    });
  }

  if (nextNode.left) {
    childNode = nextNode.left;
    parent = nextNode.parent;
  } else {
    childNode = nextNode.right;
    parent = nextNode.parent;
  }

  if (childNode) {
    childNode.parent = nextNode.parent;
  }


  if (!nextNode.parent) {
    this._root = childNode;
  } else {
    if (nextNode === nextNode.parent.left) {
      nextNode.parent.left = childNode;
    } else {
      nextNode.parent.right = childNode;
    }
  }

  // replace nodeToRemove's data by nextNode's (same as removing nodeToRemove, then inserting nextNode at his place
  // but easier and more efficient)
  if (nextNode !== nodeToRemove) {
    nodeToRemove.data = nextNode.data;
    nodeToRemove.weight = (nodeToRemove.left? nodeToRemove.left.weight: 0) +
      (nodeToRemove.right? nodeToRemove.right.weight: 0) + 1;
  }

  if (!nextNode.red) {
    this.remove_correction(childNode, parent);
  }

  return nextNode;
};

RBTree.prototype.remove_node = function(node) {
  node.traverse_up(function() {
    parent.weight --;
  });

  return this.remove_helper(node);
};

RBTree.prototype.remove_correction = function(node, parent) {
  var self = this;
  var oppositeSide;
  var helper = function(side) {
    var neighbor = parent.get_child(side, true);

    if (neighbor && neighbor.red) {
      neighbor.red = false;
      parent.red   = true;

      self.rotate(side, parent);
      neighbor = parent.get_child(side, true);
    }

    if ((!neighbor.left || !neighbor.left.red) && (!neighbor.right || !neighbor.right.red )) {
      neighbor.red = true;
      node = parent;
      parent = node.parent;
    } else {
      if (!neighbor.get_child(side, true) || !neighbor.get_child(side, true).red) {
        if (neighbor.get_child(side)) {
          neighbor.get_child(side).red = false;
        }
        neighbor.red = true;

        oppositeSide = side === 'left'? 'right': 'left';
        self.rotate(oppositeSide, neighbor);
        neighbor = parent.get_child(side, true);
      }

      neighbor.red = parent? parent.red: fals;
      parent.red   = false;
      if (neighbor.get_child(side, true)) {
        neighbor.get_child(side, true).red = false;
      }

      self.rotate(side, parent);
      node = self._root;
      parent = node.parent;
    }
  };
  while (node !== this._root && (!node || !node.red)) {
    if (node === parent.get_child('left')) {
      tmp = helper('left');
    } else if (node === parent.get_child('right')) {
      tmp = helper('right');
    }
  }

  if (node) {
    node.red = false;
  }
};

function Node(data) {
    this.data = data;
    this.left = null;
    this.right = null;
    this.parent = null;
    this.red = true;
    this.weight = 1;
}

Node.prototype.get_child = function(side, opposite) {
  if (opposite) {
    side = (side === 'left')? 'right': 'left';
  }
  return side === 'left'? this.left: this.right;
};

Node.prototype.set_child = function(side, node, opposite) {
  if (opposite) {
    side = (side === 'left')? 'right': 'left';
  }

  if (side === 'left') {
    this.left = node;
  } else {
    this.right = node;
  }
};

Node.prototype.max_tree = function(fun) {
  var node = this;

  if (fun) {
    fun(node);
  }

  while (node.right) {
    node = node.right;
    if (fun) {
      fun(node);
    }
  }

  return node;
};

Node.prototype.min_tree = function(fun) {
  var node = this;

  if (fun) {
    fun(node);
  }

  while (node.left) {
    node = node.left;
    if (fun) {
      fun(node);
    }
  }

  return node;
};


Node.prototype.next = function(fun) {
  var node, parent;
  if (this.get_child('right')) {
    return this.get_child('right').min_tree(fun);
  }

  if (fun) {
    fun(this);
  }
  node = this;
  parent = this.parent;
  while (parent && node === parent.get_child('right')) {
    node = parent;
    parent = node.parent;

    if (fun) {
      fun(parent);
    }
  }

  return parent;
};

Node.prototype.prev = function(fun) {
  var node, parent;
  if (this.get_child('left')) {
    return this.get_child('left').max_tree(fun);
  }

  if (fun) {
    fun(this);
  }
  node = this;
  parent = this.parent;
  while (parent && node === parent.get_child('left')) {
    node = parent;
    parent = node.parent;

    if (fun) {
      fun(parent);
    }
  }

  return parent;
};

/** Traverse the tree upwards until it reaches the top. For each node traversed,
  * call the function passed as argument with arguments node, parent.
  * The function will be called h-1 times, h being the height of the branch.
  **/
Node.prototype.traverse_up = function(fun) {
  var parent = this.parent;
  var node = this;

  while(parent) {
    fun(node, parent);
    node = parent;
    parent = parent.parent;
  }
};

Node.prototype.depth = function() {
  var depth = 0;
  this.traverse_up(function() {
    depth ++;
  });
  return depth;
};

Node.prototype.position = function() {
  var position = this.left? this.left.weight: 0;
  var countFun = function(node, parent) {
    if (parent.right === node) {
      // for the left subtree
      if (parent.left) {
        position += parent.left.weight;
      }
      position += 1; // for the parent
    }
  };

  this.traverse_up(countFun);
  return position;
};

module.exports = RBTree;

},{"./treebase":10}],10:[function(require,module,exports){

function TreeBase() {}

// removes all nodes from the tree
TreeBase.prototype.clear = function() {
    this._root = null;
    this.size = 0;
};

// returns node data if found, null otherwise
TreeBase.prototype.find = function(data) {
    var res = this._root;

    while(res !== null) {
        var c = this._comparator(data, res.data);
        if(c === 0) {
            return res.data;
        }
        else {
            res = res.get_child(c > 0);
        }
    }

    return null;
};

// returns iterator to node if found, null otherwise
TreeBase.prototype.findIter = function(data) {
    var res = this._root;
    var iter = this.iterator();

    while(res !== null) {
        var c = this._comparator(data, res.data);
        if(c === 0) {
            iter._cursor = res;
            return iter;
        }
        else {
            iter._ancestors.push(res);
            res = res.get_child(c > 0);
        }
    }

    return null;
};

// Returns an interator to the tree node at or immediately after the item
TreeBase.prototype.lowerBound = function(item) {
    var cur = this._root;
    var iter = this.iterator();
    var cmp = this._comparator;

    while(cur !== null) {
        var c = cmp(item, cur.data);
        if(c === 0) {
            iter._cursor = cur;
            return iter;
        }
        iter._ancestors.push(cur);
        cur = cur.get_child(c > 0);
    }

    for(var i=iter._ancestors.length - 1; i >= 0; --i) {
        cur = iter._ancestors[i];
        if(cmp(item, cur.data) < 0) {
            iter._cursor = cur;
            iter._ancestors.length = i;
            return iter;
        }
    }

    iter._ancestors.length = 0;
    return iter;
};

// Returns an interator to the tree node immediately after the item
TreeBase.prototype.upperBound = function(item) {
    var iter = this.lowerBound(item);
    var cmp = this._comparator;

    while(cmp(iter.data(), item) === 0) {
        iter.next();
    }

    return iter;
};

// returns null if tree is empty
TreeBase.prototype.min = function() {
    var res = this._root;
    if(res === null) {
        return null;
    }

    while(res.left !== null) {
        res = res.left;
    }

    return res.data;
};

// returns null if tree is empty
TreeBase.prototype.max = function() {
    var res = this._root;
    if(res === null) {
        return null;
    }

    while(res.right !== null) {
        res = res.right;
    }

    return res.data;
};

// returns a null iterator
// call next() or prev() to point to an element
TreeBase.prototype.iterator = function() {
    return new Iterator(this);
};


TreeBase.prototype.eachNode = function(cb) {
    var it=this.iterator(), node;
    var index = 0;
    while((node = it.next()) !== null) {
        cb(node, index);
        index++;
    }
};

// calls cb on each node's data, in order
TreeBase.prototype.each = function(cb) {
    this.eachNode(function(node, index) {
        cb(node.data, index);
    });
};


TreeBase.prototype.mapNode = function(cb) {
    var it=this.iterator(), node;
    var results = [];
    var index = 0;
    while((node = it.next()) !== null) {
        results.push(cb(node, index));
        index ++;
    }
    return results;
};

// calls cb on each node-s data, store the result and return it
TreeBase.prototype.map = function(cb) {
    return this.mapNode(function(node, index) {
        return cb(node.data, index);
    });
};

function Iterator(tree) {
    this._tree = tree;
    this._ancestors = [];
    this._cursor = null;
}

Iterator.prototype.data = function() {
    return this._cursor !== null ? this._cursor.data : null;
};

// if null-iterator, returns first node
// otherwise, returns next node
Iterator.prototype.next = function() {
    if(this._cursor === null) {
        var root = this._tree._root;
        if(root !== null) {
            this._minNode(root);
        }
    }
    else {
        if(this._cursor.right === null) {
            // no greater node in subtree, go up to parent
            // if coming from a right child, continue up the stack
            var save;
            do {
                save = this._cursor;
                if(this._ancestors.length) {
                    this._cursor = this._ancestors.pop();
                }
                else {
                    this._cursor = null;
                    break;
                }
            } while(this._cursor.right === save);
        }
        else {
            // get the next node from the subtree
            this._ancestors.push(this._cursor);
            this._minNode(this._cursor.right);
        }
    }
    return this._cursor !== null ? this._cursor : null;
};

// if null-iterator, returns last node
// otherwise, returns previous node
Iterator.prototype.prev = function() {
    if(this._cursor === null) {
        var root = this._tree._root;
        if(root !== null) {
            this._maxNode(root);
        }
    }
    else {
        if(this._cursor.left === null) {
            var save;
            do {
                save = this._cursor;
                if(this._ancestors.length) {
                    this._cursor = this._ancestors.pop();
                }
                else {
                    this._cursor = null;
                    break;
                }
            } while(this._cursor.left === save);
        }
        else {
            this._ancestors.push(this._cursor);
            this._maxNode(this._cursor.left);
        }
    }
    return this._cursor !== null ? this._cursor : null;
};

Iterator.prototype._minNode = function(start) {
    while(start.left !== null) {
        this._ancestors.push(start);
        start = start.left;
    }
    this._cursor = start;
};

Iterator.prototype._maxNode = function(start) {
    while(start.right !== null) {
        this._ancestors.push(start);
        start = start.right;
    }
    this._cursor = start;
};

module.exports = TreeBase;

},{}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NjYy9Eb2N1bWVudHMvcHJvZy9MaW5hZ29yYS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY2NjL0RvY3VtZW50cy9wcm9nL0xpbmFnb3JhL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jY2MvRG9jdW1lbnRzL3Byb2cvTGluYWdvcmEveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jY2MvRG9jdW1lbnRzL3Byb2cvTGluYWdvcmEveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY2NjL0RvY3VtZW50cy9wcm9nL0xpbmFnb3JhL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jY2MvRG9jdW1lbnRzL3Byb2cvTGluYWdvcmEveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2NjYy9Eb2N1bWVudHMvcHJvZy9MaW5hZ29yYS95anMvbGliL09wZXJhdGlvbnMvQmFzaWMuY29mZmVlIiwiL2hvbWUvY2NjL0RvY3VtZW50cy9wcm9nL0xpbmFnb3JhL3lqcy9saWIvT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkLmNvZmZlZSIsIi9ob21lL2NjYy9Eb2N1bWVudHMvcHJvZy9MaW5hZ29yYS95anMvbGliL3kuY29mZmVlIiwiL2hvbWUvY2NjL0RvY3VtZW50cy9wcm9nL0xpbmFnb3JhL3lqcy9ub2RlX21vZHVsZXMvYmludHJlZXMvbGliL3JidHJlZV9ieV9pbmRleC5qcyIsIi9ob21lL2NjYy9Eb2N1bWVudHMvcHJvZy9MaW5hZ29yYS95anMvbm9kZV9tb2R1bGVzL2JpbnRyZWVzL2xpYi90cmVlYmFzZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0NBLElBQUEsOEJBQUE7O0FBQUEsY0FBQSxHQUFpQixPQUFBLENB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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5Db25uZWN0b3JDbGFzcyA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckNsYXNzXCJcbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cblxuICBmb3IgbmFtZSwgZiBvZiBDb25uZWN0b3JDbGFzc1xuICAgIGNvbm5lY3RvcltuYW1lXSA9IGZcblxuICBjb25uZWN0b3Iuc2V0SXNCb3VuZFRvWSgpXG5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEhCLmdldFVzZXJJZCgpKSBhbmRcbiAgICAgICAgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKSBhbmQgIyBUT0RPOiBpIGRvbid0IHRoaW5rIHRoYXQgd2UgbmVlZCB0aGlzIGFueW1vcmUuLlxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cblxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIGdldEhCID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcbiAgICBqc29uID1cbiAgICAgIGhiOiBoYlxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgIGpzb25cblxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXG5cbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXG5cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMgPz0gW11cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXG5cblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvclxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9XG4gICNcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnN5bmNNZXRob2Qge1N0cmluZ30gIGlzIGVpdGhlciBcInN5bmNBbGxcIiBvciBcIm1hc3Rlci1zbGF2ZVwiLlxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNZXRob2RcIiwgW1wic3luY0FsbFwiLCBcIm1hc3Rlci1zbGF2ZVwiXVxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cbiAgICByZXEgXCJ1c2VyX2lkXCJcbiAgICBAb25fdXNlcl9pZF9zZXQ/KEB1c2VyX2lkKVxuXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxuICAgICMgQnV0IHRoaXMgaXMgbm90IG5lY2Vzc2FyeSBpbiB0aGUgdGVzdC1jb25uZWN0b3JcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxuICAgIGVsc2VcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXG5cbiAgICAjIEEgTWFzdGVyIHNob3VsZCBzeW5jIHdpdGggZXZlcnlvbmUhIFRPRE86IHJlYWxseT8gLSBmb3Igbm93IGl0cyBzYWZlciB0aGlzIHdheSFcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXG5cbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcbiAgICAjIFBlZXJqcyBDb25uZWN0aW9uczoga2V5OiBjb25uLWlkLCB2YWx1ZTogb2JqZWN0XG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMgPz0gW11cblxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxuICAgIEBpc19pbml0aWFsaXplZCA9IHRydWVcblxuICBvblVzZXJFdmVudDogKGYpLT5cbiAgICBAY29ubmVjdGlvbnNfbGlzdGVuZXJzID89IFtdXG4gICAgQGNvbm5lY3Rpb25zX2xpc3RlbmVycy5wdXNoIGZcblxuICBpc1JvbGVNYXN0ZXI6IC0+XG4gICAgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuXG4gIGlzUm9sZVNsYXZlOiAtPlxuICAgIEByb2xlIGlzIFwic2xhdmVcIlxuXG4gIGZpbmROZXdTeW5jVGFyZ2V0OiAoKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGZvciB1c2VyLCBjIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBpZiBub3QgYy5pc19zeW5jZWRcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgICAgIGJyZWFrXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQHNldFN0YXRlU3luY2VkKClcbiAgICBudWxsXG5cbiAgdXNlckxlZnQ6ICh1c2VyKS0+XG4gICAgZGVsZXRlIEBjb25uZWN0aW9uc1t1c2VyXVxuICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG4gICAgaWYgQGNvbm5lY3Rpb25zX2xpc3RlbmVycz9cbiAgICAgIGZvciBmIGluIEBjb25uZWN0aW9uc19saXN0ZW5lcnNcbiAgICAgICAgZiB7XG4gICAgICAgICAgYWN0aW9uOiBcInVzZXJMZWZ0XCJcbiAgICAgICAgICB1c2VyOiB1c2VyXG4gICAgICAgIH1cblxuXG4gIHVzZXJKb2luZWQ6ICh1c2VyLCByb2xlKS0+XG4gICAgaWYgbm90IHJvbGU/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJbnRlcm5hbDogWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhIEUuZy4gdXNlckpvaW5lZCgndWlkOjM5MzknLCdzbGF2ZScpXCJcbiAgICAjIGEgdXNlciBqb2luZWQgdGhlIHJvb21cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0gPz0ge31cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0uaXNfc3luY2VkID0gZmFsc2VcblxuICAgIGlmIChub3QgQGlzX3N5bmNlZCkgb3IgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgICAjIFRPRE86IFdoYXQgaWYgdGhlcmUgYXJlIHR3byBtYXN0ZXJzPyBQcmV2ZW50IHNlbmRpbmcgZXZlcnl0aGluZyB0d28gdGltZXMhXG4gICAgICAgIEBwZXJmb3JtU3luY1dpdGhNYXN0ZXIgdXNlclxuXG4gICAgaWYgQGNvbm5lY3Rpb25zX2xpc3RlbmVycz9cbiAgICAgIGZvciBmIGluIEBjb25uZWN0aW9uc19saXN0ZW5lcnNcbiAgICAgICAgZiB7XG4gICAgICAgICAgYWN0aW9uOiBcInVzZXJKb2luZWRcIlxuICAgICAgICAgIHVzZXI6IHVzZXJcbiAgICAgICAgICByb2xlOiByb2xlXG4gICAgICAgIH1cblxuICAjXG4gICMgRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLiBJZiBub3QgY29ubmVjdGVkLCB3YWl0IHVudGlsIGNvbm5lY3RlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIENvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgYXJncy5jb25zdHJ1Y3RvciBpcyBGdW5jdGlvblxuICAgICAgYXJncyA9IFthcmdzXVxuICAgIGlmIEBpc19zeW5jZWRcbiAgICAgIGFyZ3NbMF0uYXBwbHkgdGhpcywgYXJnc1sxLi5dXG4gICAgZWxzZVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkLnB1c2ggYXJnc1xuXG4gICNcbiAgIyBFeGVjdXRlIGFuIGZ1bmN0aW9uIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LiBmIHdpbGwgYmUgY2FsbGVkIHdpdGggKHNlbmRlcl9pZCwgYnJvYWRjYXN0IHt0cnVlfGZhbHNlfSwgbWVzc2FnZSkuXG4gICNcbiAgb25SZWNlaXZlOiAoZiktPlxuICAgIEByZWNlaXZlX2hhbmRsZXJzLnB1c2ggZlxuXG4gICMjI1xuICAjIEJyb2FkY2FzdCBhIG1lc3NhZ2UgdG8gYWxsIGNvbm5lY3RlZCBwZWVycy5cbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXG4gICNcbiAgYnJvYWRjYXN0OiAobWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcblxuICAjXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcbiAgI1xuICBzZW5kOiAocGVlcl9zLCBtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcbiAgIyMjXG5cbiAgI1xuICAjIHBlcmZvcm0gYSBzeW5jIHdpdGggYSBzcGVjaWZpYyB1c2VyLlxuICAjXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgICAgQHNlbmQgdXNlcixcbiAgICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgZGF0YTogQGdldFN0YXRlVmVjdG9yKClcbiAgICAgIGlmIG5vdCBAc2VudF9oYl90b19hbGxfdXNlcnNcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxuXG4gICAgICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG5cblxuICAjXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxuICAjXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICBAc2VuZCB1c2VyLFxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICBkYXRhOiBAZ2V0U3RhdGVWZWN0b3IoKVxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgIF9oYiA9IFtdXG4gICAgZm9yIG8gaW4gaGJcbiAgICAgIF9oYi5wdXNoIG9cbiAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgX2hiID0gW11cbiAgICBAYnJvYWRjYXN0XG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICBkYXRhOiBfaGJcblxuICAjXG4gICMgWW91IGFyZSBzdXJlIHRoYXQgYWxsIGNsaWVudHMgYXJlIHN5bmNlZCwgY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XG4gICAgaWYgbm90IEBpc19zeW5jZWRcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cbiAgICAgICAgZm9yIGVsIGluIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICAgICAgZiA9IGVsWzBdXG4gICAgICAgICAgYXJncyA9IGVsWzEuLl1cbiAgICAgICAgICBmLmFwcGx5KGFyZ3MpXG4gICAgICAgIGRlbGV0ZSBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgbnVsbFxuXG4gICMgZXhlY3V0ZWQgd2hlbiB0aGUgYSBzdGF0ZV92ZWN0b3IgaXMgcmVjZWl2ZWQuIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIG9ubHkgb25jZSFcbiAgd2hlblJlY2VpdmVkU3RhdGVWZWN0b3I6IChmKS0+XG4gICAgQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVycyA/PSBbXVxuICAgIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnMucHVzaCBmXG5cblxuICAjXG4gICMgWW91IHJlY2VpdmVkIGEgcmF3IG1lc3NhZ2UsIGFuZCB5b3Uga25vdyB0aGF0IGl0IGlzIGludGVuZGVkIGZvciB0byBZanMuIFRoZW4gY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cbiAgICBpZiBub3QgcmVzLnN5bmNfc3RlcD9cbiAgICAgIGZvciBmIGluIEByZWNlaXZlX2hhbmRsZXJzXG4gICAgICAgIGYgc2VuZGVyLCByZXNcbiAgICBlbHNlXG4gICAgICBpZiBzZW5kZXIgaXMgQHVzZXJfaWRcbiAgICAgICAgcmV0dXJuXG4gICAgICBpZiByZXMuc3luY19zdGVwIGlzIFwiZ2V0SEJcIlxuICAgICAgICAjIGNhbGwgbGlzdGVuZXJzXG4gICAgICAgIGlmIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnM/XG4gICAgICAgICAgZm9yIGYgaW4gQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVyc1xuICAgICAgICAgICAgZi5jYWxsIHRoaXMsIHJlcy5kYXRhXG4gICAgICAgIGRlbGV0ZSBAd2hlbl9yZWNlaXZlZF9zdGF0ZV92ZWN0b3JfbGlzdGVuZXJzXG5cbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcbiAgICAgICAgaGIgPSBkYXRhLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxuICAgICAgICAjIFdoZW4gdGhpcyBjbGllbnQgb25seSBzeW5jcyB0byBvbmUgb3RoZXIgY2xpZW50cywgYnV0IGxvb3NlcyBjb25uZWN0b3JzLFxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcbiAgICAgICAgaWYgQGlzX3N5bmNlZFxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXG5cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG5cbiAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxuICAgICAgICAgICAgKCk9PlxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcbiAgICAgICAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgIyBBdCB0aGUgYmVnaW5uaW5nICh3aGVuIHRoZSB1c2VyIGlkIHdhcyBub3QgYXNzaWduZWQgeWV0KSxcbiAgIyB0aGUgb3BlcmF0aW9ucyBhcmUgYWRkZWQgdG8gYnVmZmVyLl90ZW1wLiBXaGVuIHlvdSBmaW5hbGx5IGdldCB5b3VyIHVzZXIgaWQsXG4gICMgdGhlIG9wZXJhdGlvbnMgYXJlIGNvcGllcyBmcm9tIGJ1ZmZlci5fdGVtcCB0byBidWZmZXJbaWRdLiBGdXJ0aGVybW9yZSwgd2hlbiBidWZmZXJbaWRdIGRvZXMgYWxyZWFkeSBjb250YWluIG9wZXJhdGlvbnNcbiAgIyAoYmVjYXVzZSBvZiBhIHByZXZpb3VzIHNlc3Npb24pLCB0aGUgdWlkLm9wX251bWJlcnMgb2YgdGhlIG9wZXJhdGlvbnMgaGF2ZSB0byBiZSByZWFzc2lnbmVkLlxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIGZ1bmN0aW9uIGRvZXMuIEl0IGFkZHMgdGhlbSB0byBidWZmZXJbaWRdLFxuICAjIGFuZCBhc3NpZ25zIHRoZW0gdGhlIGNvcnJlY3QgdWlkLm9wX251bWJlciBhbmQgdWlkLmNyZWF0b3JcbiAgc2V0VXNlcklkOiAoQHVzZXJfaWQsIHN0YXRlX3ZlY3RvciktPlxuICAgIEBidWZmZXJbQHVzZXJfaWRdID89IFtdXG4gICAgYnVmZiA9IEBidWZmZXJbQHVzZXJfaWRdXG5cbiAgICAjIHdlIGFzc3VtZWQgdGhhdCB3ZSBzdGFydGVkIHdpdGggY291bnRlciA9IDAuXG4gICAgIyB3aGVuIHdlIHJlY2VpdmUgdGhhIHN0YXRlX3ZlY3RvciwgYW5kIGFjdHVhbGx5IGhhdmVcbiAgICAjIGNvdW50ZXIgPSAxMC4gVGhlbiB3ZSBoYXZlIHRvIGFkZCAxMCB0byBldmVyeSBvcF9jb3VudGVyXG4gICAgY291bnRlcl9kaWZmID0gc3RhdGVfdmVjdG9yW0B1c2VyX2lkXSBvciAwXG5cbiAgICBpZiBAYnVmZmVyLl90ZW1wP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIEBidWZmZXIuX3RlbXBcbiAgICAgICAgby51aWQuY3JlYXRvciA9IEB1c2VyX2lkXG4gICAgICAgIG8udWlkLm9wX251bWJlciArPSBjb3VudGVyX2RpZmZcbiAgICAgICAgYnVmZltvLnVpZC5vcF9udW1iZXJdID0gb1xuXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXSA9IChAb3BlcmF0aW9uX2NvdW50ZXIuX3RlbXAgb3IgMCkgKyBjb3VudGVyX2RpZmZcblxuICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXIuX3RlbXBcbiAgICBkZWxldGUgQGJ1ZmZlci5fdGVtcFxuXG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxuICAgICAgby5jbGVhbnVwPygpXG5cbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxuICAgIEB0cmFzaCA9IFtdXG4gICAgaWYgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCBpc250IC0xXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcbiAgICB1bmRlZmluZWRcblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxuICAgICAgZm9yIG8gaW4gYXJndW1lbnRzXG4gICAgICAgIGlmIG8/XG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXG5cbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXG4gICAgQHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0KClcbiAgICBAZ2FyYmFnZSA9IFtdXG4gICAgQHRyYXNoID0gW11cblxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxuICAgIGNsZWFyVGltZW91dCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWRcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcblxuICBzZXRHYXJiYWdlQ29sbGVjdFRpbWVvdXQ6IChAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0KS0+XG5cbiAgI1xuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICByZXMgPSB7fVxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICAgIHJlc1xuICAgIGVsc2VcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBvLnVpZC5vcF9udW1iZXIgPD0gQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XG5cbiAgI1xuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXG4gICAgICBpZiB1X25hbWUgaXMgXCJfXCJcbiAgICAgICAgY29udGludWVcbiAgICAgIGZvciBvX251bWJlcixvIG9mIHVzZXJcbiAgICAgICAgaWYgKG5vdCBvLnVpZC5ub09wZXJhdGlvbj8pIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/ICMgYXBwbGllcyBmb3IgYWxsIG9wcyBidXQgdGhlIG1vc3QgcmlnaHQgZGVsaW1pdGVyIVxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQudWlkLmNyZWF0b3IsIG9fbmV4dC51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD8gIyBtb3N0IHJpZ2h0IGRlbGltaXRlciBvbmx5IVxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX3ByZXYudWlkLmNyZWF0b3IsIG9fcHJldi51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxuICAjIG9uIHRoZSBvcGVyYXRpb25zIHJldHJpZXZlU3ViIG1ldGhvZCAod2hpY2ggbXVzdCEgYmUgZGVmaW5lZClcbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBpZiB1aWQuc3ViPyBhbmQgbz9cbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxuICAgIGVsc2VcbiAgICAgIG9cblxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSkpIGFuZCBzdGF0ZV92ZWN0b3JbdXNlcl0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxuICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgd2hpbGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1dP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICB1bmRlZmluZWRcblxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXG4iLCJcbmNsYXNzIFlPYmplY3RcblxuICBjb25zdHJ1Y3RvcjogKEBfb2JqZWN0ID0ge30pLT5cbiAgICBpZiBAX29iamVjdC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgIGZvciBuYW1lLCB2YWwgb2YgQF9vYmplY3RcbiAgICAgICAgaWYgdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIEBfb2JqZWN0W25hbWVdID0gbmV3IFlPYmplY3QodmFsKVxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlkuT2JqZWN0IGFjY2VwdHMgSnNvbiBPYmplY3RzIG9ubHlcIlxuXG4gIF9uYW1lOiBcIk9iamVjdFwiXG5cbiAgX2dldE1vZGVsOiAodHlwZXMsIG9wcyktPlxuICAgIGlmIG5vdCBAX21vZGVsP1xuICAgICAgQF9tb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihAKS5leGVjdXRlKClcbiAgICAgIGZvciBuLG8gb2YgQF9vYmplY3RcbiAgICAgICAgQF9tb2RlbC52YWwgbiwgb1xuICAgIGRlbGV0ZSBAX29iamVjdFxuICAgIEBfbW9kZWxcblxuICBfc2V0TW9kZWw6IChAX21vZGVsKS0+XG4gICAgZGVsZXRlIEBfb2JqZWN0XG5cbiAgb2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLm9ic2VydmUgZlxuICAgIEBcblxuICB1bm9ic2VydmU6IChmKS0+XG4gICAgQF9tb2RlbC51bm9ic2VydmUgZlxuICAgIEBcblxuICAjXG4gICMgQG92ZXJsb2FkIHZhbCgpXG4gICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAjICAgQHJldHVybiBbSnNvbl1cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHJldHVybiBbKl0gRGVwZW5kcyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAjXG4gIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICBpZiBAX21vZGVsP1xuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXG4gICAgZWxzZVxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdXG4gICAgICBlbHNlXG4gICAgICAgIHJlcyA9IHt9XG4gICAgICAgIGZvciBuLHYgb2YgQF9vYmplY3RcbiAgICAgICAgICByZXNbbl0gPSB2XG4gICAgICAgIHJlc1xuXG4gIGRlbGV0ZTogKG5hbWUpLT5cbiAgICBAX21vZGVsLmRlbGV0ZShuYW1lKVxuICAgIEBcblxuaWYgd2luZG93P1xuICBpZiB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBmaXJzdCBpbXBvcnQgWSFcIlxuXG5pZiBtb2R1bGU/XG4gIG1vZHVsZS5leHBvcnRzID0gWU9iamVjdFxuIiwibW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgb3BzID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wcy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgaWYgY3VzdG9tX3R5cGU/XG4gICAgICAgIEBjdXN0b21fdHlwZSA9IGN1c3RvbV90eXBlXG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XG4gICAgICBpZiB1aWQ/XG4gICAgICAgIEB1aWQgPSB1aWRcblxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxuICAgICAgaWYgY29udGVudCBpcyB1bmRlZmluZWRcbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxuICAgICAgaWYgY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICBAY29udGVudF9vcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG5hbWUsIG9wIG9mIGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgIEBzYXZlT3BlcmF0aW9uIG5hbWUsIG9wLCAnY29udGVudF9vcGVyYXRpb25zJ1xuXG4gICAgdHlwZTogXCJPcGVyYXRpb25cIlxuXG4gICAgZ2V0Q29udGVudDogKG5hbWUpLT5cbiAgICAgIGlmIEBjb250ZW50P1xuICAgICAgICBpZiBAY29udGVudC5nZXRDdXN0b21UeXBlP1xuICAgICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBlbHNlIGlmIEBjb250ZW50LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGlmIG5hbWU/XG4gICAgICAgICAgICBpZiBAY29udGVudFtuYW1lXT9cbiAgICAgICAgICAgICAgQGNvbnRlbnRbbmFtZV1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9uc1tuYW1lXS5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjb250ZW50ID0ge31cbiAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRcbiAgICAgICAgICAgICAgY29udGVudFtuXSA9IHZcbiAgICAgICAgICAgIGlmIEBjb250ZW50X29wZXJhdGlvbnM/XG4gICAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgICAgICAgIHYgPSB2LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICAgICAgICAgIGNvbnRlbnRbbl0gPSB2XG4gICAgICAgICAgICBjb250ZW50XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBAY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcInN1YiBwcm9wZXJ0aWVzIGFyZSBub3QgZW5hYmxlIG9uIHRoaXMgb3BlcmF0aW9uIHR5cGUhXCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZVxuICAgIHVub2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBAZXZlbnRfbGlzdGVuZXJzLmZpbHRlciAoZyktPlxuICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgIyBUaGlzIHNob3VsZCBiZSBjYWxsZWQsIGUuZy4gYWZ0ZXIgdGhpcyBoYXMgYmVlbiByZXBsYWNlZC5cbiAgICAjIChUaGVuIG9ubHkgb25lIHJlcGxhY2UgZXZlbnQgc2hvdWxkIGZpcmUuIClcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxuICAgIGRlbGV0ZUFsbE9ic2VydmVyczogKCktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdXG5cbiAgICBkZWxldGU6ICgpLT5cbiAgICAgIChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIEApLmV4ZWN1dGUoKVxuICAgICAgbnVsbFxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cbiAgICAgICAgY2FsbG9uID0gQGdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZVxuICAgICAgICBjYWxsb24gPSBAXG4gICAgICBAZm9yd2FyZEV2ZW50IGNhbGxvbiwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBASEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxuICAgICAgQGRlbGV0ZUFsbE9ic2VydmVycygpXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEB1aWRcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXG4gICAgICAgICAgbWFwX3VpZCA9IEB1aWQuYWx0LmNsb25lVWlkKClcbiAgICAgICAgICBtYXBfdWlkLnN1YiA9IEB1aWQuc3ViXG4gICAgICAgICAgbWFwX3VpZFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbG9uZVVpZDogKCktPlxuICAgICAgdWlkID0ge31cbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXG4gICAgICAgIHVpZFtuXSA9IHZcbiAgICAgIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgICAgaWYgbm90IEB1aWQ/XG4gICAgICAgICAgIyBXaGVuIHRoaXMgb3BlcmF0aW9uIHdhcyBjcmVhdGVkIHdpdGhvdXQgYSB1aWQsIHRoZW4gc2V0IGl0IGhlcmUuXG4gICAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgICAjIGlzIGV4ZWN1dGVkIChiZWNhdXNlIHdlIG5lZWQgdGhlIGNyZWF0b3JfaWQpXG4gICAgICAgICAgQHVpZCA9IEBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICAgIEBIQi5hZGRPcGVyYXRpb24gQFxuICAgICAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICAgIEBcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3AsIGJhc2UgPSBcInRoaXNcIiktPlxuICAgICAgaWYgb3A/IGFuZCBvcC5fZ2V0TW9kZWw/XG4gICAgICAgIG9wID0gb3AuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG5vdCBvcD9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgb3AuZXhlY3V0ZT8gb3Igbm90IChvcC5vcF9udW1iZXI/IGFuZCBvcC5jcmVhdG9yPylcbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWQsIG9yIG9wIGlzIHN0cmluZy4gQ3VycmVudGx5IFwiRGVsaW1pdGVyXCIgaXMgc2F2ZWQgYXMgc3RyaW5nXG4gICAgICAgICMgKGluIGNvbWJpbmF0aW9uIHdpdGggQHBhcmVudCB5b3UgY2FuIHJldHJpZXZlIHRoZSBkZWxpbWl0ZXIuLilcbiAgICAgICAgaWYgYmFzZSBpcyBcInRoaXNcIlxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgZGVzdCA9IEBbYmFzZV1cbiAgICAgICAgICBwYXRocyA9IG5hbWUuc3BsaXQoXCIvXCIpXG4gICAgICAgICAgbGFzdF9wYXRoID0gcGF0aHMucG9wKClcbiAgICAgICAgICBmb3IgcGF0aCBpbiBwYXRoc1xuICAgICAgICAgICAgZGVzdCA9IGRlc3RbcGF0aF1cbiAgICAgICAgICBkZXN0W2xhc3RfcGF0aF0gPSBvcFxuICAgICAgZWxzZVxuICAgICAgICAjIG5vdCBpbml0aWFsaXplZC4gRG8gaXQgd2hlbiBjYWxsaW5nICR2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXSA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW2Jhc2VdW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gdHJ1ZVxuICAgICAgZm9yIGJhc2VfbmFtZSwgYmFzZSBvZiBAdW5jaGVja2VkXG4gICAgICAgIGZvciBuYW1lLCBvcF91aWQgb2YgYmFzZVxuICAgICAgICAgIG9wID0gQEhCLmdldE9wZXJhdGlvbiBvcF91aWRcbiAgICAgICAgICBpZiBvcFxuICAgICAgICAgICAgaWYgYmFzZV9uYW1lIGlzIFwidGhpc1wiXG4gICAgICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICBkZXN0ID0gQFtiYXNlX25hbWVdXG4gICAgICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcbiAgICAgICAgICAgICAgbGFzdF9wYXRoID0gcGF0aHMucG9wKClcbiAgICAgICAgICAgICAgZm9yIHBhdGggaW4gcGF0aHNcbiAgICAgICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxuICAgICAgICAgICAgICBkZXN0W2xhc3RfcGF0aF0gPSBvcFxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV0gPz0ge31cbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV1bbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgaWYgbm90IHN1Y2Nlc3NcbiAgICAgICAgQHVuY2hlY2tlZCA9IHVuaW5zdGFudGlhdGVkXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBkZWxldGUgQHVuY2hlY2tlZFxuICAgICAgICByZXR1cm4gQFxuXG4gICAgZ2V0Q3VzdG9tVHlwZTogKCktPlxuICAgICAgaWYgbm90IEBjdXN0b21fdHlwZT9cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXG4gICAgICAgIEBcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xuICAgICAgICAgICMgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldCAob25seSB0aGUgbmFtZSBpcyBzcGVjaWZpZWQpXG4gICAgICAgICAgVHlwZSA9IEBjdXN0b21fdHlwZXNcbiAgICAgICAgICBmb3IgdCBpbiBAY3VzdG9tX3R5cGUuc3BsaXQoXCIuXCIpXG4gICAgICAgICAgICBUeXBlID0gVHlwZVt0XVxuICAgICAgICAgIEBjdXN0b21fdHlwZSA9IG5ldyBUeXBlKClcbiAgICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcbiAgICAgICAgQGN1c3RvbV90eXBlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi50eXBlID0gQHR5cGVcbiAgICAgIGpzb24udWlkID0gQGdldFVpZCgpXG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XG4gICAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlLl9uYW1lXG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb24uY29udGVudCA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29udGVudCA9IEBjb250ZW50XG4gICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICBvcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG4sbyBvZiBAY29udGVudF9vcGVyYXRpb25zXG4gICAgICAgICAgaWYgby5fZ2V0TW9kZWw/XG4gICAgICAgICAgICBvID0gby5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgICAgb3BlcmF0aW9uc1tuXSA9IG8uZ2V0VWlkKClcbiAgICAgICAganNvbi5jb250ZW50X29wZXJhdGlvbnMgPSBvcGVyYXRpb25zXG4gICAgICBqc29uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIG9wcy5EZWxldGUucGFyc2UgPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkICh1bmltcGxlbWVudGVkLCBnb29kIGlkZWE/KVxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3Mgb3BzLkluc2VydCBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zLCBwYXJlbnQsIHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgIHZhbDogKCktPlxuICAgICAgQGdldENvbnRlbnQoKVxuXG4gICAgZ2V0TmV4dDogKGk9MSktPlxuICAgICAgbiA9IEBcbiAgICAgIHdoaWxlIGkgPiAwIGFuZCBuLm5leHRfY2w/XG4gICAgICAgIG4gPSBuLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG4uaXNfZGVsZXRlZFxuICAgICAgICAgIGktLVxuICAgICAgaWYgbi5pc19kZWxldGVkXG4gICAgICAgIG51bGxcbiAgICAgIG5cblxuICAgIGdldFByZXY6IChpPTEpLT5cbiAgICAgIG4gPSBAXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5wcmV2X2NsP1xuICAgICAgICBuID0gbi5wcmV2X2NsXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpLS1cbiAgICAgIGlmIG4uaXNfZGVsZXRlZFxuICAgICAgICBudWxsXG4gICAgICBlbHNlXG4gICAgICAgIG5cblxuICAgICNcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBjYWxsTGF0ZXIgPSBmYWxzZVxuICAgICAgaWYgQHBhcmVudD8gYW5kIG5vdCBAaXNfZGVsZXRlZCBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIGNhbGxMYXRlclxuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyh0aGlzLCBvKVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAcHJldl9jbC5pc0RlbGV0ZWQoKSBhbmQgQHByZXZfY2wuZ2FyYmFnZV9jb2xsZWN0ZWQgaXNudCB0cnVlXG4gICAgICAgICMgZ2FyYmFnZSBjb2xsZWN0IHByZXZfY2xcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJyaWdodCBpcyBub3QgZGVsZXRlZC4gaW5jb25zaXN0ZW5jeSEsIHdyYXJhcmFyXCJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XG4gICAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgICB3aGlsZSBvLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxuICAgICAgICAgICAgby5vcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQG5leHRfY2xcbiAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBwcmV2X2NsXG5cbiAgICAgICAgIyBkZWxldGUgY29udGVudFxuICAgICAgICAjIC0gd2UgbXVzdCBub3QgZG8gdGhpcyBpbiBhcHBseURlbGV0ZSwgYmVjYXVzZSB0aGlzIHdvdWxkIGxlYWQgdG8gaW5jb25zaXN0ZW5jaWVzXG4gICAgICAgICMgKGUuZy4gdGhlIGZvbGxvd2luZyBvcGVyYXRpb24gb3JkZXIgbXVzdCBiZSBpbnZlcnRpYmxlIDpcbiAgICAgICAgIyAgIEluc2VydCByZWZlcnMgdG8gY29udGVudCwgdGhlbiB0aGUgY29udGVudCBpcyBkZWxldGVkKVxuICAgICAgICAjIFRoZXJlZm9yZSwgd2UgaGF2ZSB0byBkbyB0aGlzIGluIHRoZSBjbGVhbnVwXG4gICAgICAgICMgKiBOT0RFOiBXZSBuZXZlciBkZWxldGUgSW5zZXJ0aW9ucyFcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uIGFuZCBub3QgKEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLkluc2VydClcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5LS1cbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXG4gICAgICAgICAgICBAY29udGVudC5hcHBseURlbGV0ZSgpXG4gICAgICAgIGRlbGV0ZSBAY29udGVudFxuICAgICAgICBzdXBlclxuICAgICAgIyBlbHNlXG4gICAgICAjICAgU29tZW9uZSBpbnNlcnRlZCBzb21ldGhpbmcgaW4gdGhlIG1lYW50aW1lLlxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA/PSAwXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSsrXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBvRGlzdGFuY2UgPSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG9EaXN0YW5jZSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gb0Rpc3RhbmNlXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyh0aGlzKVxuICAgICAgICBAXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBqc29uLnByZXYgPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAganNvbi5uZXh0ID0gQG5leHRfY2wuZ2V0VWlkKClcblxuICAgICAgaWYgQG9yaWdpbi50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAganNvbi5vcmlnaW4gPSBcIkRlbGltaXRlclwiXG4gICAgICBlbHNlIGlmIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uLm9yaWdpbiA9IEBvcmlnaW4uZ2V0VWlkKClcblxuICAgICAgIyBpZiBub3QgKGpzb24ucHJldj8gYW5kIGpzb24ubmV4dD8pXG4gICAgICBqc29uLnBhcmVudCA9IEBwYXJlbnQuZ2V0VWlkKClcblxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5JbnNlcnQucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAncGFyZW50JyA6IHBhcmVudFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMgbnVsbCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zLCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3Mgb3BzLkRlbGltaXRlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIG51bGwsIHtub09wZXJhdGlvbjogdHJ1ZX1cblxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEB1bmNoZWNrZWQ/WydwcmV2X2NsJ11cbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUHJvYmFibHkgZHVwbGljYXRlZCBvcGVyYXRpb25zXCJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIHN1cGVyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBmYWxzZVxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IG9yIEBuZXh0X2NsPyBvciB0cnVlICMgVE9ETzogYXJlIHlvdSBzdXJlPyBUaGlzIGNhbiBoYXBwZW4gcmlnaHQ/XG4gICAgICAgIHN1cGVyXG4gICAgICAjZWxzZVxuICAgICAgIyAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBvcHMuRGVsaW1pdGVyLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkLCBwcmV2LCBuZXh0KVxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICdvcGVyYXRpb25zJyA6IG9wc1xuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxuUkJUUmVlQnlJbmRleCA9IHJlcXVpcmUgJ2JpbnRyZWVzL2xpYi9yYnRyZWVfYnlfaW5kZXgnXG5cbm1vZHVsZS5leHBvcnRzID0gKCktPlxuICBiYXNpY19vcHMgPSBiYXNpY19vcHNfdW5pbml0aWFsaXplZCgpXG4gIG9wcyA9IGJhc2ljX29wcy5vcGVyYXRpb25zXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgbWFwIGxpa2Ugb2JqZWN0cy4gRS5nLiBKc29uLVR5cGUgYW5kIFhNTCBhdHRyaWJ1dGVzLlxuICAjXG4gIGNsYXNzIG9wcy5NYXBNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgQF9tYXAgPSB7fVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQF9tYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBtYXA6IChmKS0+XG4gICAgICBmb3Igbix2IG9mIEBfbWFwXG4gICAgICAgIGYobix2KVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XG4gICAgICAgICAgcmVwID0gY29udGVudC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXAgPSBjb250ZW50XG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIHJlcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIHByb3AgPSBAX21hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIHJlcyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICAgIHJlcy5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXNcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQF9tYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXSA9IHJtXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxuICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV1cblxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XG4gICAgICBAYmVnaW5uaW5nID0gbmV3IG9wcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgb3BzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcblxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG5cbiAgICB0b0pzb246ICh0cmFuc2Zvcm1fdG9fdmFsdWUgPSBmYWxzZSktPlxuICAgICAgdmFsID0gQHZhbCgpXG4gICAgICBmb3IgaSwgbyBpbiB2YWxcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5PYmplY3RcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIG9wcy5MaXN0TWFuYWdlclxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiB0cmFuc2Zvcm1fdG9fdmFsdWUgYW5kIG8gaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgb1xuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBzZWUgT3BlcmF0aW9uLmV4ZWN1dGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQGJlZ2lubmluZy5zZXRQYXJlbnQgQFxuICAgICAgICBAZW5kLnNldFBhcmVudCBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjIEdldCB0aGUgZWxlbWVudCBwcmV2aW91cyB0byB0aGUgZGVsZW1pdGVyIGF0IHRoZSBlbmRcbiAgICBnZXRMYXN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAZW5kLnByZXZfY2xcblxuICAgICMgc2ltaWxhciB0byB0aGUgYWJvdmVcbiAgICBnZXRGaXJzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsXG5cbiAgICAjIGdldCB0aGUgbmV4dCBub24tZGVsZXRlZCBvcGVyYXRpb25cbiAgICBnZXROZXh0OiAoc3RhcnQpLT5cbiAgICAgIG8gPSBzdGFydC5uZXh0X2NsXG4gICAgICB3aGlsZSBub3QgKChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcikpXG4gICAgICAgIGlmIG8uaXNfZGVsZXRlZFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICBlbHNlIGJyZWFrXG5cbiAgICAgIG9cblxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgbWFwOiAoZiktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICByZXN1bHQucHVzaCBmKG8pXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHJlc3VsdFxuXG4gICAgZm9sZDogKGluaXQsIGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIGlmIG5vdCBvLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpbml0ID0gZihpbml0LCBvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBpbml0XG5cbiAgICB2YWw6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICBAdG9BcnJheSgpXG5cbiAgICByZWY6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKVxuICAgICAgICAgIG9cbiAgICAgICAgZWxzZVxuICAgICAgICAgIG51bGxcbiAgICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInRoaXMgcG9zaXRpb24gZG9lcyBub3QgZXhpc3RcIlxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ5b3UgbXVzdCBzcGVjaWZ5IGEgcG9zaXRpb24gcGFyYW1ldGVyXCJcblxuICAgICNcbiAgICAjIFJldHJpZXZlcyB0aGUgeC10aCBub3QgZGVsZXRlZCBlbGVtZW50LlxuICAgICMgZS5nLiBcImFiY1wiIDogdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICNcbiAgICBnZXRPcGVyYXRpb25CeVBvc2l0aW9uOiAocG9zaXRpb24pLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgICMgZmluZCB0aGUgaS10aCBvcFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIGFuZCBvLnByZXZfY2w/XG4gICAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgcG9zaXRpb24gPD0gMCBhbmQgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG8uaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbiAtPSAxXG4gICAgICBvXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgW2NvbnRlbnRdXG5cbiAgICBpbnNlcnRBZnRlckhlbHBlcjogKHJvb3QsIGNvbnRlbnQpLT5cbiAgICAgIGlmICFyb290LnJpZ2h0XG4gICAgICAgIHJvb3QuYnQucmlnaHQgPSBjb250ZW50XG4gICAgICAgIGNvbnRlbnQuYnQucGFyZW50ID0gcm9vdFxuICAgICAgZWxzZVxuICAgICAgICByaWdodCA9IHJvb3QubmV4dF9jbFxuXG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnRzKS0+XG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG5cbiAgICAgICMgVE9ETzogYWx3YXlzIGV4cGVjdCBhbiBhcnJheSBhcyBjb250ZW50LiBUaGVuIHlvdSBjYW4gY29tYmluZSB0aGlzIHdpdGggdGhlIG90aGVyIG9wdGlvbiAoZWxzZSlcbiAgICAgIGlmIGNvbnRlbnRzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgIGVsc2VcbiAgICAgICAgZm9yIGMgaW4gY29udGVudHNcbiAgICAgICAgICBpZiBjPyBhbmQgYy5fbmFtZT8gYW5kIGMuX2dldE1vZGVsP1xuICAgICAgICAgICAgYyA9IGMuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICAgIHRtcCA9IChuZXcgb3BzLkluc2VydCBudWxsLCBjLCBudWxsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYW4gYXJyYXkgb2YgY29udGVudCBpbnRvIHRoaXMgbGlzdC5cbiAgICAjIEBOb3RlOiBUaGlzIGV4cGVjdHMgYW4gYXJyYXkgYXMgY29udGVudCFcbiAgICAjXG4gICAgIyBAcmV0dXJuIHtMaXN0TWFuYWdlciBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50cyktPlxuICAgICAgaXRoID0gQGdldE9wZXJhdGlvbkJ5UG9zaXRpb24gcG9zaXRpb25cbiAgICAgICMgdGhlIChpLTEpdGggY2hhcmFjdGVyLiBlLmcuIFwiYWJjXCIgdGhlIDF0aCBjaGFyYWN0ZXIgaXMgXCJhXCJcbiAgICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgICBAaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50c1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XG4gICAgI1xuXG4gICAgZGVsZXRlUmVmOiAobywgbGVuZ3RoID0gMSkgLT5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCA9IChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIG8pLmV4ZWN1dGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIChub3QgKG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgZGVsZXRlOiAocG9zaXRpb24sIGxlbmd0aCA9IDEpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIEBkZWxldGVSZWYgbywgbGVuZ3RoXG5cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wKS0+XG4gICAgICBnZXRDb250ZW50VHlwZSA9IChjb250ZW50KS0+XG4gICAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNvbnRlbnRcbiAgICAgIEBjYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImluc2VydFwiXG4gICAgICAgIHJlZmVyZW5jZTogb3BcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgIGNoYW5nZWRCeTogb3AudWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIG9wLnZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICByZWZlcmVuY2U6IG9wXG4gICAgICAgIHBvc2l0aW9uOiBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQGdldEN1c3RvbVR5cGUoKSAjIFRPRE86IFlvdSBjYW4gY29tYmluZSBnZXRQb3NpdGlvbiArIGdldFBhcmVudCBpbiBhIG1vcmUgZWZmaWNpZW50IG1hbm5lciEgKG9ubHkgbGVmdCBEZWxpbWl0ZXIgd2lsbCBob2xkIEBwYXJlbnQpXG4gICAgICAgIGxlbmd0aDogMVxuICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICBvbGRWYWx1ZTogb3AudmFsKClcbiAgICAgIF1cblxuICBvcHMuTGlzdE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuICBjbGFzcyBvcHMuQ29tcG9zaXRpb24gZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcblxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBfY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgdG1wX2NvbXBvc2l0aW9uX3JlZiktPlxuICAgICAgIyB3ZSBjYW4ndCB1c2UgQHNldmVPcGVyYXRpb24gJ2NvbXBvc2l0aW9uX3JlZicsIHRtcF9jb21wb3NpdGlvbl9yZWYgaGVyZSxcbiAgICAgICMgYmVjYXVzZSB0aGVuIHRoZXJlIGlzIGEgXCJsb29wXCIgKGluc2VydGlvbiByZWZlcnMgdG8gcGFyZW50LCByZWZlcnMgdG8gaW5zZXJ0aW9uLi4pXG4gICAgICAjIFRoaXMgaXMgd2h5IHdlIGhhdmUgdG8gY2hlY2sgaW4gQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyB1bnRpbCB3ZSBmaW5kIGl0XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG4gICAgICBpZiB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBAdG1wX2NvbXBvc2l0aW9uX3JlZiA9IHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxuICAgICAgaWYgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucz9cbiAgICAgICAgQGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuLCBvLCAnX2NvbXBvc2l0aW9uX3ZhbHVlJ1xuXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl9zZXRDb21wb3NpdGlvblZhbHVlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgZGVsZXRlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgIyBjaGVjayBpZiB0bXBfY29tcG9zaXRpb25fcmVmIGFscmVhZHkgZXhpc3RzXG4gICAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICAgICAgY29tcG9zaXRpb25fcmVmID0gQEhCLmdldE9wZXJhdGlvbiBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIGlmIGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IGNvbXBvc2l0aW9uX3JlZlxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC1vcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBpZiBvcC51aWQuY3JlYXRvciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5jcmVhdG9yIGFuZCBvcC51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxuICAgICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBvcFxuICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIG9wID0gb3AubmV4dF9jbFxuICAgICAgICAgIGlmIG9wIGlzIEBlbmRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmV0dXJuXG5cbiAgICAgIG8gPSBAZW5kLnByZXZfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBvcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl91bmFwcGx5IG8udW5kb19kZWx0YVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBvLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBAZW5kLnByZXZfY2xcblxuICAgICAgQGNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBuZXdWYWx1ZTogQHZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICByZXR1cm5cblxuICAgICNcbiAgICAjIENyZWF0ZSBhIG5ldyBEZWx0YVxuICAgICMgLSBpbnNlcnRzIG5ldyBDb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fdmFsdWVcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fcmVmXG4gICAgI1xuICAgICMgQHBhcmFtIGRlbHRhIFRoZSBkZWx0YSB0aGF0IGlzIGFwcGxpZWQgdG8gdGhlIGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgI1xuICAgIGFwcGx5RGVsdGE6IChkZWx0YSwgb3BlcmF0aW9ucyktPlxuICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGRlbHRhLCBvcGVyYXRpb25zLCBALCBudWxsLCBAZW5kLnByZXZfY2wsIEBlbmQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBjdXN0b20gPSBAZ2V0Q3VzdG9tVHlwZSgpLl9nZXRDb21wb3NpdGlvblZhbHVlKClcbiAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWUgPSBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVcbiAgICAgIGlmIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxuICAgICAgaWYgQGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29tcG9zaXRpb25fcmVmID0gQHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuQ29tcG9zaXRpb24ucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICAnY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucycgOiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAnY29tcG9zaXRpb25fcmVmJyA6IGNvbXBvc2l0aW9uX3JlZlxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIGNvbXBvc2l0aW9uX3ZhbHVlLCBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zLCB1aWQsIGNvbXBvc2l0aW9uX3JlZilcblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkKS0+XG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xuICAgICAgICBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10gPSBAZXZlbnRfdGhpcy5nZXRDdXN0b21UeXBlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcC5wcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBvcC5pc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBvcC5wcmV2X2NsLnZhbCgpXG4gICAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgICAgICBvbGRWYWx1ZTogb2xkX3ZhbHVlXG4gICAgICAgICAgXVxuICAgICAgICBvcC5wcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgb3AubmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBvcC5hcHBseURlbGV0ZSgpXG4gICAgICBlbHNlICMgcHJldiBfYW5kXyBuZXh0IGFyZSBEZWxpbWl0ZXJzLiBUaGlzIGlzIHRoZSBmaXJzdCBjcmVhdGVkIFJlcGxhY2VhYmxlIGluIHRoZSBSTVxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIEBjYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBvcC52YWwoKVxuICAgICAgICBdXG5cblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIG51bGwsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIGxhc3Rfb3AgPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBpZiAobm90IGxhc3Rfb3AuaXNEZWxldGVkKCkpIGFuZCBsYXN0X29wLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgIChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cblxuICBjbGFzcyBvcHMuRmFzdExpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgY29uc3RydWN0b3I6ICgpIC0+XG4gICAgICBAc2hvcnRUcmVlID0gbmV3IFJCVHJlZUJ5SW5kZXgoKVxuXG4gICAgICBzdXBlciBhcmd1bWVudHMuLi5cblxuICAgIHR5cGU6ICdGYXN0TGlzdE1hbmFnZXInXG5cbiAgICBnZXROZXh0OiAoc3RhcnQpLT5cbiAgICAgIHN0YXJ0Lm5vZGUubmV4dCgpLmRhdGFcblxuICAgIGdldFByZXY6IChzdGFydCktPlxuICAgICAgc3RhcnQubm9kZS5wcmV2KCkuZGF0YVxuXG4gICAgbWFwOiAoZnVuKS0+XG4gICAgICBAc2hvcnRUcmVlLm1hcCAob3BlcmF0aW9uKSAtPlxuICAgICAgICBmdW4gb3BlcmF0aW9uXG5cbiAgICBmb2xkOiAoaW5pdCwgZikgLT5cbiAgICAgIEBzaG9ydFRyZWUuZWFjaCAob3BlcmF0aW9uKSAtPlxuICAgICAgICBpbml0ID0gZihpbml0LCBvcGVyYXRpb24pXG4gICAgICBpbml0XG5cbiAgICB2YWw6IChwb3NpdGlvbiktPlxuICAgICAgaWYgcG9zaXRpb24/XG4gICAgICAgIChAc2hvcnRUcmVlLmZpbmQgcG9zaXRpb24pLnZhbCgpXG4gICAgICBlbHNlXG4gICAgICAgIEBzaG9ydFRyZWUubWFwIChvcGVyYXRpb24pIC0+XG4gICAgICAgICAgb3BlcmF0aW9uLnZhbCgpXG5cbiAgICByZWY6IChwb3NpdGlvbiktPlxuICAgICAgaWYgcG9zaXRpb24/XG4gICAgICAgIEBzaG9ydFRyZWUuZmluZCBwb3NpdGlvblxuICAgICAgZWxzZVxuICAgICAgICBAc2hvcnRUcmVlLm1hcCAob3BlcmF0aW9uKSAtPlxuICAgICAgICAgIG9wZXJhdGlvblxuXG4gICAgcHVzaDogKGNvbnRlbnQpIC0+XG4gICAgICBAaW5zZXJ0QWZ0ZXIgQGVuZC5wcmV2X2NsLCBbY29udGVudF1cblxuICAgIGluc2VydEFmdGVyOiAobGVmdCwgY29udGVudHMpIC0+XG4gICAgICAjIHRoZSBvcGVyYXRpb24gaXMgaW5zZXJ0ZWQganVzdCBiZWZvcmUgdGhlIG5leHQgbm9uIGRlbGV0ZWQgaW5zZXJ0aW9uXG4gICAgICAjIHRoZSBvcGVyYXRpb24gaXMgc3RvcmVkIGluIHRoZSB0cmVlIGp1c3QgYWZ0ZXIgbGVmdFxuICAgICAgbm9kZU9uTGVmdCA9IGlmIGxlZnQgaXMgQGJlZ2lubmluZyB0aGVuIG51bGwgZWxzZSBsZWZ0Lm5vZGVcblxuICAgICAgbm9kZU9uUmlnaHQgPSBpZiBub2RlT25MZWZ0IHRoZW4gbm9kZU9uTGVmdC5uZXh0KCkgZWxzZSBAc2hvcnRUcmVlLmZpbmQgMFxuICAgICAgcmlnaHQgPSBpZiBub2RlT25SaWdodCB0aGVuIG5vZGVPblJpZ2h0LmRhdGEgZWxzZSBAZW5kXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxuXG4gICAgICBpZiBjb250ZW50cyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgb3BlcmF0aW9uID0gbmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0XG4gICAgICAgIG9wZXJhdGlvbi5ub2RlID0gQHNob3J0VHJlZS5pbnNlcnRBZnRlciBub2RlT25MZWZ0LCBvcGVyYXRpb25cblxuICAgICAgICBvcGVyYXRpb24uZXhlY3V0ZSgpXG5cbiAgICAgIGVsc2VcbiAgICAgICAgY29udGVudHMuZm9yRWFjaCAoY29udGVudCkgLT5cbiAgICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fbmFtZT8gYW5kIGNvbnRlbnQuX2dldE1vZGVsP1xuICAgICAgICAgICAgY29udGVudCA9IGNvbnRlbnQuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICAgICNUT0RPOiBvdmVycmlkZSBJbnNlcnQucHJvdG90eXBlLmdldERpc3RhbmNlVG9PcmlnaW4gKGluIEluc2VydC5wcm90b3R5cGUuZXhlY3V0ZSlcbiAgICAgICAgICBvcGVyYXRpb24gPSBuZXcgb3BzLkluc2VydCBudWxsLCBjLCBudWxsLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHRcbiAgICAgICAgICBvcGVyYXRpb24ubm9kZSA9IEBzaG9ydFRyZWUuaW5zZXJ0QWZ0ZXIgbm9kZU9uTGVmdCwgb3BlcmF0aW9uXG5cbiAgICAgICAgICBvcGVyYXRpb24uZXhlY3V0ZSgpXG5cbiAgICAgICAgICBsZWZ0ID0gb3BlcmF0aW9uXG4gICAgICAgICAgbm9kZU9uTGVmdCA9IG9wZXJhdGlvbi5ub2RlXG4gICAgICBAXG5cbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudHMpIC0+XG4gICAgICBsZWZ0ID0gKEBzaG9ydFRyZWUuZmluZCAocG9zaXRpb24tMSkpIG9yIEBiZWdpbm5pbmdcbiAgICAgIEBpbnNlcnRBZnRlciBsZWZ0LCBjb250ZW50c1xuXG4gICAgZGVsZXRlOiAocG9zaXRpb24sIGxlbmd0aCA9IDEpIC0+XG4gICAgICBkZWxldGVfb3BzID0gW11cbiAgICAgIG9wZXJhdGlvbiA9IEBzaG9ydFRyZWUuZmluZCBwb3NpdGlvblxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG9wZXJhdGlvbiBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWxldGVPcCA9IG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgb3BlcmF0aW9uXG5cbiAgICAgICAgIyBleGVjdXRlIHRoZSBkZWxldGUgb3BlcmF0aW9uXG4gICAgICAgIGRlbGV0ZU9wLmV4ZWN1dGUoKVxuXG4gICAgICAgICMgZ2V0IHRoZSBuZXh0IG9wZXJhdGlvbiBmcm9tIHRoZSBzaG9ydFRyZWVcbiAgICAgICAgbmV4dE5vZGUgPSBvcGVyYXRpb24ubm9kZS5uZXh0KClcbiAgICAgICAgb3BlcmF0aW9uID0gaWYgbmV4dE5vZGUgdGhlbiBuZXh0Tm9kZS5kYXRhIGVsc2UgQGVuZFxuXG4gICAgICAgICMgcmVtb3ZlIHRoZSBvcGVyYXRpb24gZnJvbSB0aGUgc2hvcnRUcmVlXG4gICAgICAgIEBzaG9ydFRyZWUucmVtb3ZlX25vZGUgb3BlcmF0aW9uLm5vZGVcbiAgICAgICAgb3BlcmF0aW9uLm5vZGUgPSBudWxsXG5cbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBAXG5cbiAgICBnZXRMZW5ndGg6ICgpIC0+XG4gICAgICBAdHJlZS5zaXplXG5cbiAgYmFzaWNfb3BzXG4iLCJcbnN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9PcGVyYXRpb25zL1N0cnVjdHVyZWRcIlxuXG5IaXN0b3J5QnVmZmVyID0gcmVxdWlyZSBcIi4vSGlzdG9yeUJ1ZmZlclwiXG5FbmdpbmUgPSByZXF1aXJlIFwiLi9FbmdpbmVcIlxuYWRhcHRDb25uZWN0b3IgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JBZGFwdGVyXCJcblxuY3JlYXRlWSA9IChjb25uZWN0b3IpLT5cbiAgaWYgY29ubmVjdG9yLnVzZXJfaWQ/XG4gICAgdXNlcl9pZCA9IGNvbm5lY3Rvci51c2VyX2lkICMgVE9ETzogY2hhbmdlIHRvIGdldFVuaXF1ZUlkKClcbiAgZWxzZVxuICAgIHVzZXJfaWQgPSBcIl90ZW1wXCJcbiAgICBjb25uZWN0b3Iud2hlbl9yZWNlaXZlZF9zdGF0ZV92ZWN0b3JfbGlzdGVuZXJzID0gWyhzdGF0ZV92ZWN0b3IpLT5cbiAgICAgICAgSEIuc2V0VXNlcklkIHRoaXMudXNlcl9pZCwgc3RhdGVfdmVjdG9yXG4gICAgICBdXG4gIEhCID0gbmV3IEhpc3RvcnlCdWZmZXIgdXNlcl9pZFxuICBvcHNfbWFuYWdlciA9IHN0cnVjdHVyZWRfb3BzX3VuaW5pdGlhbGl6ZWQgSEIsIHRoaXMuY29uc3RydWN0b3JcbiAgb3BzID0gb3BzX21hbmFnZXIub3BlcmF0aW9uc1xuXG4gIGVuZ2luZSA9IG5ldyBFbmdpbmUgSEIsIG9wc1xuICBhZGFwdENvbm5lY3RvciBjb25uZWN0b3IsIGVuZ2luZSwgSEIsIG9wc19tYW5hZ2VyLmV4ZWN1dGlvbl9saXN0ZW5lclxuXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLkhCID0gSEJcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUub3BlcmF0aW9ucyA9IG9wc1xuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5lbmdpbmUgPSBlbmdpbmVcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY29ubmVjdG9yID0gY29ubmVjdG9yXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmN1c3RvbV90eXBlcyA9IHRoaXMuY29uc3RydWN0b3JcblxuICBjdCA9IG5ldyBjcmVhdGVZLk9iamVjdCgpXG4gIG1vZGVsID0gbmV3IG9wcy5NYXBNYW5hZ2VyKGN0LCBIQi5nZXRSZXNlcnZlZFVuaXF1ZUlkZW50aWZpZXIoKSkuZXhlY3V0ZSgpXG4gIGN0Ll9zZXRNb2RlbCBtb2RlbFxuICBjdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcbmlmIHdpbmRvdz9cbiAgd2luZG93LlkgPSBjcmVhdGVZXG5cbmNyZWF0ZVkuT2JqZWN0ID0gcmVxdWlyZSBcIi4vT2JqZWN0VHlwZVwiXG4iLCJ2YXIgVHJlZUJhc2UgPSByZXF1aXJlKCcuL3RyZWViYXNlJyk7XG4vKiogYWxnb3JpdGhtIGZyb20gQ29ybWVuLCBMZWlzZXJzb24gLSBJbnRyb2R1Y3Rpb24gdG8gYWxnb3JpdGhtICoqL1xuXG5mdW5jdGlvbiBSQlRyZWUoY29tcGFyYXRvcikge1xuICAgIHRoaXMuX3Jvb3QgPSBudWxsO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG4gICAgdGhpcy5fbmlsID0gbmV3IE5vZGUoJ25pbCcpO1xuICAgIHRoaXMuX25pbC5yZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9uaWwud2VpZ2h0ID0gMDtcbn1cblxuUkJUcmVlLnByb3RvdHlwZSA9IG5ldyBUcmVlQmFzZSgpO1xuXG5SQlRyZWUucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uKHBvc2l0aW9uLCBkYXRhKSB7XG4gIHZhciBub2RlVG9JbnNlcnQgPSBuZXcgTm9kZShkYXRhKTtcbiAgaWYgKHRoaXMuaW5zZXJ0X25vZGUocG9zaXRpb24sIG5vZGVUb0luc2VydCkpIHtcbiAgICByZXR1cm4gbm9kZVRvSW5zZXJ0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufTtcblxuUkJUcmVlLnByb3RvdHlwZS5pbnNlcnRfbm9kZSA9IGZ1bmN0aW9uKHBvc2l0aW9uLCBub2RlVG9JbnNlcnQpIHtcbiAgdGhpcy5zaXplICs9IDE7XG4gIHZhciBub2RlID0gdGhpcy5fcm9vdDtcbiAgdmFyIGluc2VydEFmdGVyO1xuXG4gIGlmICghbm9kZSkge1xuICAgIHRoaXMuX3Jvb3QgPSBub2RlVG9JbnNlcnQ7XG4gICAgdGhpcy5fcm9vdC5yZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgaWYgKG5vZGUud2VpZ2h0ID09PSBwb3NpdGlvbikgeyAvLyBJbnNlcnQgYWZ0ZXIgbWF4IG9mIG5vZGUgc3VidHJlZVxuICAgICAgaW5zZXJ0QWZ0ZXIgPSBub2RlLm1heF90cmVlKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgbm9kZS53ZWlnaHQgKz0gMTtcbiAgICAgIH0pO1xuICAgICAgaW5zZXJ0QWZ0ZXIuc2V0X2NoaWxkKCdyaWdodCcsIG5vZGVUb0luc2VydCk7XG4gICAgICBub2RlVG9JbnNlcnQucGFyZW50ID0gaW5zZXJ0QWZ0ZXI7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2Uge1xuICAgICAgbGVmdCA9IG5vZGUuZ2V0X2NoaWxkKCdsZWZ0Jyk7XG4gICAgICByaWdodCA9IG5vZGUuZ2V0X2NoaWxkKCdyaWdodCcpO1xuICAgICAgaWYgKCFsZWZ0ICYmIHBvc2l0aW9uID09PSAwKSB7XG4gICAgICAgIG5vZGUud2VpZ2h0ICs9IDE7XG4gICAgICAgIG5vZGUuc2V0X2NoaWxkKCdsZWZ0Jywgbm9kZVRvSW5zZXJ0KTtcbiAgICAgICAgbm9kZVRvSW5zZXJ0LnBhcmVudCA9IG5vZGU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICB9IGVsc2UgaWYgKGxlZnQgJiYgbGVmdC53ZWlnaHQgPj0gcG9zaXRpb24pIHtcbiAgICAgICAgbm9kZS53ZWlnaHQgKz0gMTtcbiAgICAgICAgbm9kZSA9IGxlZnQ7XG5cbiAgICAgIH0gZWxzZSBpZiAocmlnaHQpIHtcbiAgICAgICAgcG9zaXRpb24gLT0gKGxlZnQ/IGxlZnQud2VpZ2h0OiAwKSArIDE7XG4gICAgICAgIG5vZGUud2VpZ2h0ICs9IDE7XG4gICAgICAgIG5vZGUgPSByaWdodDtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS53ZWlnaHQgKz0gMTtcbiAgICAgICAgbm9kZS5zZXRfY2hpbGQoJ3JpZ2h0Jywgbm9kZVRvSW5zZXJ0KTtcbiAgICAgICAgbm9kZVRvSW5zZXJ0LnBhcmVudCA9IG5vZGU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRoaXMuaW5zZXJ0X2NvcnJlY3Rpb24obm9kZVRvSW5zZXJ0KTtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmluc2VydF9iZXR3ZWVuID0gZnVuY3Rpb24ob25MZWZ0LCBvblJpZ2h0LCBkYXRhKSB7XG4gIHZhciBuZXdOb2RlID0gbmV3IE5vZGUoZGF0YSk7XG4gIC8vIG9uTGVmdCBhbmQgb25SaWdodCBhcmUgbmVpZ2hib3JzLCBzbyB0aGV5IGNhbid0IGhhdmUgYW4gZWxlbWVudCBpbiBiZXR3ZWVuLlxuICAvLyBGb3IgZXhhbXBsZSwgaWYgb25MZWZ0IGV4aXN0cywgaXRzIHJpZ2h0IG5laWdoYm9yIGlzIGVpdGhlciBuaWwgb3IgcmlnaHQuIElmIGl0J3Mgb25SaWdodCxcbiAgLy8gdGhlbiBvblJpZ2h0IGhhcyBubyBjaGlsZC4gSWYgbmVpdGhlciBsZWZ0IGFuZCByaWdodCBleGlzdCwgdGhlIHRyZWUgaXMgZW1wdHkuXG4gIGlmIChvbkxlZnQgJiYgIW9uTGVmdC5yaWdodCkge1xuICAgIG9uTGVmdC5yaWdodCA9IG5ld05vZGU7XG4gICAgbmV3Tm9kZS5wYXJlbnQgPSBvbkxlZnQ7XG5cbiAgICB0aGlzLnNpemUgKys7XG4gICAgdGhpcy5pbnNlcnRfY29ycmVjdGlvbihuZXdOb2RlKTtcbiAgfSBlbHNlIGlmIChvblJpZ2h0ICYmICFvblJpZ2h0LmxlZnQpIHtcbiAgICBvblJpZ2h0LmxlZnQgPSBuZXdOb2RlO1xuICAgIG5ld05vZGUucGFyZW50ID0gb25SaWdodDtcblxuICAgIHRoaXMuc2l6ZSArKztcbiAgICB0aGlzLmluc2VydF9jb3JyZWN0aW9uKG5ld05vZGUpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuaW5zZXJ0X25vZGUoMCwgbmV3Tm9kZSk7XG4gIH1cbiAgbmV3Tm9kZS50cmF2ZXJzZV91cChmdW5jdGlvbihub2RlLCBwYXJlbnQpIHtcbiAgICBwYXJlbnQud2VpZ2h0IC09IDE7XG4gIH0pO1xuXG4gIHJldHVybiBuZXdOb2RlO1xufTtcblxuUkJUcmVlLnByb3RvdHlwZS5yb3RhdGUgPSBmdW5jdGlvbihzaWRlLCBub2RlKSB7XG4gIC8vIGFsbCB0aGUgY29tbWVudCBhcmUgd2l0aCB0aGUgYXNzdW1wdGlvbiB0aGF0IHNpZGUgPT09ICdsZWZ0J1xuICB2YXIgbmVpZ2hib3I7XG5cbiAgLy8gZ2V0IHJpZ2h0IG5laWdoYm9yXG4gIG5laWdoYm9yID0gbm9kZS5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSk7XG4gIC8vIG5laWdoYm9yJ3MgbGVmdCB0cmVlIGJlY29tZXMgbm9kZSdzIHJpZ2h0IHRyZWVcbiAgbm9kZS5zZXRfY2hpbGQoc2lkZSwgbmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpLCB0cnVlKTtcblxuICAvLyBpZiB0aGlzIHJpZ2h0IHRyZWUgd2FzIG5vbi1lbXB0eVxuICBpZiAobmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpKSB7XG4gICAgbmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpLnBhcmVudCA9IG5vZGU7IC8vIGF0dGFjaCBuZWlnaGJvcidzIGxlZnQgY2hpbGQgdG8gbm9kZVxuICB9XG4gIG5laWdoYm9yLnBhcmVudCA9IG5vZGUucGFyZW50OyAvLyBsaW5rIG5laWdoYm9yJ3MgcGFyZW50IHRvIG5vZGUncyBwYXJlbnRcblxuICBpZiAoIW5vZGUucGFyZW50KSB7IC8vIG5vIHBhcmVudCA9PT0gaXNfcm9vdFxuICAgIHRoaXMuX3Jvb3QgPSBuZWlnaGJvcjtcbiAgfSBlbHNlIGlmIChub2RlID09PSBub2RlLnBhcmVudC5nZXRfY2hpbGQoc2lkZSkpeyAvLyBub2RlIGlzIGxlZnQgY2hpbGRcbiAgICBub2RlLnBhcmVudC5zZXRfY2hpbGQoc2lkZSwgbmVpZ2hib3IpOyAvLyBub2RlJ3MgcGFyZW50IGxlZnQgY2hpbGQgaXMgbm93IG5laWdoYm9yXG4gIH0gZWxzZSB7XG4gICAgbm9kZS5wYXJlbnQuc2V0X2NoaWxkKHNpZGUsIG5laWdoYm9yLCB0cnVlKTsgLy8gbm9kZSdzIHBhcmVudCByaWdodCBjaGlsZCBpcyBub3cgbmVpZ2hib3JcbiAgfVxuXG4gIG5laWdoYm9yLnNldF9jaGlsZChzaWRlLCBub2RlKTsgLy8gYXR0YWNoIG5vZGUgb24gbGVmdCBvZiBjaGlsZFxuICBub2RlLnBhcmVudCA9IG5laWdoYm9yOyAvLyBzZXQgbm9kZSdzIHBhcmVudCB0byBuZWlnaGJvclxuXG4gIC8vIHVwZGF0ZSBub2RlJ3Mgd2VpZ2h0IGZpcnN0LCB0aGVuXG4gIG5vZGUud2VpZ2h0ID0gKG5vZGUubGVmdD8gbm9kZS5sZWZ0LndlaWdodDogMCkgKyAobm9kZS5yaWdodD8gbm9kZS5yaWdodC53ZWlnaHQ6IDApICsgMTtcbiAgbmVpZ2hib3Iud2VpZ2h0ID0gKG5laWdoYm9yLmxlZnQ/IG5laWdoYm9yLmxlZnQud2VpZ2h0OiAwKSArIChuZWlnaGJvci5yaWdodD8gbmVpZ2hib3IucmlnaHQud2VpZ2h0OiAwKSArIDE7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmluc2VydF9jb3JyZWN0aW9uID0gZnVuY3Rpb24obm9kZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGZ1bmN0aW9uIGhlbHBlcihzaWRlKSB7XG4gICAgdmFyIHVuY2xlO1xuICAgIHVuY2xlID0gbm9kZS5wYXJlbnQucGFyZW50LmdldF9jaGlsZChzaWRlLCB0cnVlKTtcblxuICAgIGlmICh1bmNsZSAmJiB1bmNsZS5yZWQpIHsgLy8gaWYgdW5jbGUgaXMgdW5kZWZpbmVkLCBpdCdzIGEgbGVhZiBzbyBpdCdzIGJsYWNrXG4gICAgICBub2RlLnBhcmVudC5yZWQgICAgICAgID0gZmFsc2U7XG4gICAgICB1bmNsZS5yZWQgICAgICAgICAgICAgID0gZmFsc2U7XG4gICAgICBub2RlLnBhcmVudC5wYXJlbnQucmVkID0gdHJ1ZTtcblxuICAgICAgbm9kZSA9IG5vZGUucGFyZW50LnBhcmVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5vZGUgPT09IG5vZGUucGFyZW50LmdldF9jaGlsZChzaWRlLCB0cnVlKSkge1xuICAgICAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gICAgICAgIHNlbGYucm90YXRlKHNpZGUsIG5vZGUpO1xuICAgICAgfVxuXG4gICAgICBub2RlLnBhcmVudC5yZWQgICAgICAgID0gZmFsc2U7XG4gICAgICBub2RlLnBhcmVudC5wYXJlbnQucmVkID0gdHJ1ZTtcblxuICAgICAgdmFyIG9wcG9zaXRlU2lkZSA9IHNpZGUgPT09ICdsZWZ0Jz8gJ3JpZ2h0JzogJ2xlZnQnO1xuICAgICAgc2VsZi5yb3RhdGUob3Bwb3NpdGVTaWRlLCBub2RlLnBhcmVudC5wYXJlbnQpO1xuICAgIH1cbiAgfVxuXG5cbiAgd2hpbGUgKG5vZGUucGFyZW50ICYmIG5vZGUucGFyZW50LnJlZCkgeyAvLyBpcyB0aGVyZSdzIG5vIG5vZGUucGFyZW50LCB0aGVuIGl0IG1lYW5zIHRoZSBwYXJlbnRcbiAgICAvLyBpcyBuaWwgd2hpY2ggaXMgYmxhY2tcblxuICAgIC8vIGlmIG5vZGUncyBwYXJlbnQgaXMgb24gbGVmdCBvZiBoaXMgcGFyZW50XG4gICAgaWYgKG5vZGUucGFyZW50ID09PSBub2RlLnBhcmVudC5wYXJlbnQuZ2V0X2NoaWxkKCdsZWZ0JykpIHsgLy8gQ2hlY2sgdGhhdCB0aGVyZSBpcyBhIGdyYW5kcGFyZW50XG4gICAgICBoZWxwZXIoJ2xlZnQnKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUucGFyZW50ID09PSBub2RlLnBhcmVudC5wYXJlbnQuZ2V0X2NoaWxkKCdyaWdodCcpKXtcbiAgICAgIGhlbHBlcigncmlnaHQnKTtcbiAgICB9XG4gIH1cblxuICB0aGlzLl9yb290LnJlZCA9IGZhbHNlO1xuXG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5vZGUgPSB0aGlzLmZpbmROb2RlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIGlmIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUuZGF0YTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLyoqIEZpbmQgdGhlIG5vZGUgYXQgcG9zaXRpb24gQHBvc2l0aW9uIGFuZCByZXR1cm4gaXQuIElmIG5vIG5vZGUgaXMgZm91bmQsIHJldHVybnMgbnVsbC5cbiAqIEl0IGlzIGFsc28gcG9zc2libGUgdG8gcGFzcyBhIGZ1bmN0aW9uIGFzIHNlY29uZCBhcmd1bWVudC4gSXQgd2lsbCBiZSBjYWxsZWRcbiAqIHdpdGggZWFjaCBub2RlIHRyYXZlcnNlZCBleGNlcHQgZm9yIHRoZSBvbmUgZm91bmQuXG4qKi9cblJCVHJlZS5wcm90b3R5cGUuZmluZE5vZGUgPSBmdW5jdGlvbihwb3NpdGlvbiwgZnVuKSB7XG4gIC8vIGlmIHRoZSB3ZWlnaHQgaXMgJ24nLCB0aGUgYmlnZ2VzdCBpbmRleCBpcyBuLTEsIHNvIHdlIGNoZWNrIHRoYXQgcG9zaXRpb24gPj0gc2l6ZVxuICBpZiAocG9zaXRpb24gPj0gdGhpcy5zaXplIHx8IHBvc2l0aW9uIDwgMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZhciBub2RlID0gdGhpcy5fcm9vdDtcblxuICBpZiAoIW5vZGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEZpbmQgbm9kZSB0byBkZWxldGVcbiAgd2hpbGUgKHBvc2l0aW9uID4gMCB8fCAocG9zaXRpb24gPT09IDAgJiYgbm9kZS5sZWZ0KSkge1xuICAgIGxlZnQgPSBub2RlLmxlZnQ7XG4gICAgcmlnaHQgPSBub2RlLnJpZ2h0O1xuXG4gICAgaWYgKGxlZnQgJiYgbGVmdC53ZWlnaHQgPiBwb3NpdGlvbikge1xuICAgICAgLy8gd2hlbiB0aGVyZSdzIGEgbGVmdCBuZWlnaGJvciB3aXRoIGEgd2VpZ2h0ID4gcG9zaXRpb24gdG8gcmVtb3ZlLFxuICAgICAgLy8gZ28gaW50byB0aGlzIHN1YnRyZWUgYW5kIGRlY3JlYXNlIHRoZSBzdWJ0cmVlIHdlaWdodFxuICAgICAgaWYgKGZ1bikge1xuICAgICAgICBmdW4obm9kZSk7XG4gICAgICB9XG4gICAgICBub2RlID0gbGVmdDtcblxuICAgIH0gZWxzZSBpZiAoKCFsZWZ0ICYmIHBvc2l0aW9uID09PSAwKSB8fCAobGVmdCAmJiBsZWZ0LndlaWdodCA9PT0gcG9zaXRpb24pKSB7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2UgaWYgKHJpZ2h0KSB7XG4gICAgICAvLyB3aGVuIHRoZXJlJ3MgYSByaWdodCBzdWJ0ZWUsIGdvIGludG8gaXQgYW5kIGRlY3JlYXNlIHRoZSBwb3NpdGlvblxuICAgICAgLy8gYnkgdGhlIHdlaWdodCBvZiB0aGUgbGVmdCBzdWJ0cmVlIC0gMSArIDEgKGZvciB0aGUgcHJldmlvdXMgbm9kZSlcbiAgICAgIGlmIChmdW4pIHtcbiAgICAgICAgZnVuKG5vZGUpO1xuICAgICAgfVxuICAgICAgbm9kZSA9IHJpZ2h0O1xuICAgICAgcG9zaXRpb24gLT0gKGxlZnQ/IGxlZnQud2VpZ2h0OiAwKSArIDE7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzaG91bGQgbm90IGhhcHBlbiwgZXhjZXB0IGlmIHRoZSBwb3NpdGlvbiBpcyBncmVhdGVyIHRoYW4gdGhlIHNpemUgb2YgdGhlIHRyZWVcbiAgICAgIHRocm93IG5ldyBFcnJvcigndGhpcyBzaG91bGQgbm90IGhhcHBlbicpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbm9kZTtcbn07XG5cblJCVHJlZS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgLy8gaWYgdGhlIHdlaWdodCBpcyAnbicsIHRoZSBiaWdnZXN0IGluZGV4IGlzIG4tMSwgc28gd2UgY2hlY2sgdGhhdCBwb3NpdGlvbiA+PSBzaXplXG4gIHZhciBub2RlVG9SZW1vdmU7XG5cbiAgbm9kZVRvUmVtb3ZlID0gdGhpcy5maW5kTm9kZShwb3NpdGlvbiwgZnVuY3Rpb24obm9kZSkgeyBub2RlLndlaWdodCAtLTsgfSk7XG4gIHRoaXMuc2l6ZSAtPSAxO1xuXG4gIHJldHVybiB0aGlzLnJlbW92ZV9oZWxwZXIobm9kZVRvUmVtb3ZlKTtcbn07XG5cblJCVHJlZS5wcm90b3R5cGUucmVtb3ZlX2hlbHBlciA9IGZ1bmN0aW9uKG5vZGVUb1JlbW92ZSkge1xuICB2YXIgbGVmdCwgcmlnaHQsIG5leHROb2RlLCBjaGlsZE5vZGUsIHBhcmVudDtcblxuICAvLyBpZiB0aGVyZSdzIG9ubHkgb25lIGNoaWxkLCByZXBsYWNlIHRoZSBub2RlVG9SZW1vdmUgdG8gZGVsZXRlIGJ5IGl0J3MgY2hpbGQgYW5kIHVwZGF0ZVxuICAvLyB0aGUgcmVmcy5cbiAgLy8gaWYgdGhlcmUncyB0d28gY2hpbGRyZW4sIGZpbmQgaXQncyBzdWNjZXNzb3IgYW5kIHJlcGxhY2UgdGhlIG5vZGVUb1JlbW92ZSB0byBkZWxldGUgYnkgaGlzIHN1Y2Nlc3NvclxuICAvLyBhbmQgdXBkYXRlIHRoZSByZWZzXG5cbiAgaWYgKCFub2RlVG9SZW1vdmUubGVmdCB8fCAhbm9kZVRvUmVtb3ZlLnJpZ2h0KSB7XG4gICAgbmV4dE5vZGUgPSBub2RlVG9SZW1vdmU7XG4gIH0gZWxzZSB7XG4gICAgbmV4dE5vZGUgPSBub2RlVG9SZW1vdmUubmV4dChmdW5jdGlvbihub2RlKSB7XG4gICAgICBub2RlLndlaWdodCAtPSAxO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG5leHROb2RlLmxlZnQpIHtcbiAgICBjaGlsZE5vZGUgPSBuZXh0Tm9kZS5sZWZ0O1xuICAgIHBhcmVudCA9IG5leHROb2RlLnBhcmVudDtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGUgPSBuZXh0Tm9kZS5yaWdodDtcbiAgICBwYXJlbnQgPSBuZXh0Tm9kZS5wYXJlbnQ7XG4gIH1cblxuICBpZiAoY2hpbGROb2RlKSB7XG4gICAgY2hpbGROb2RlLnBhcmVudCA9IG5leHROb2RlLnBhcmVudDtcbiAgfVxuXG5cbiAgaWYgKCFuZXh0Tm9kZS5wYXJlbnQpIHtcbiAgICB0aGlzLl9yb290ID0gY2hpbGROb2RlO1xuICB9IGVsc2Uge1xuICAgIGlmIChuZXh0Tm9kZSA9PT0gbmV4dE5vZGUucGFyZW50LmxlZnQpIHtcbiAgICAgIG5leHROb2RlLnBhcmVudC5sZWZ0ID0gY2hpbGROb2RlO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0Tm9kZS5wYXJlbnQucmlnaHQgPSBjaGlsZE5vZGU7XG4gICAgfVxuICB9XG5cbiAgLy8gcmVwbGFjZSBub2RlVG9SZW1vdmUncyBkYXRhIGJ5IG5leHROb2RlJ3MgKHNhbWUgYXMgcmVtb3Zpbmcgbm9kZVRvUmVtb3ZlLCB0aGVuIGluc2VydGluZyBuZXh0Tm9kZSBhdCBoaXMgcGxhY2VcbiAgLy8gYnV0IGVhc2llciBhbmQgbW9yZSBlZmZpY2llbnQpXG4gIGlmIChuZXh0Tm9kZSAhPT0gbm9kZVRvUmVtb3ZlKSB7XG4gICAgbm9kZVRvUmVtb3ZlLmRhdGEgPSBuZXh0Tm9kZS5kYXRhO1xuICAgIG5vZGVUb1JlbW92ZS53ZWlnaHQgPSAobm9kZVRvUmVtb3ZlLmxlZnQ/IG5vZGVUb1JlbW92ZS5sZWZ0LndlaWdodDogMCkgK1xuICAgICAgKG5vZGVUb1JlbW92ZS5yaWdodD8gbm9kZVRvUmVtb3ZlLnJpZ2h0LndlaWdodDogMCkgKyAxO1xuICB9XG5cbiAgaWYgKCFuZXh0Tm9kZS5yZWQpIHtcbiAgICB0aGlzLnJlbW92ZV9jb3JyZWN0aW9uKGNoaWxkTm9kZSwgcGFyZW50KTtcbiAgfVxuXG4gIHJldHVybiBuZXh0Tm9kZTtcbn07XG5cblJCVHJlZS5wcm90b3R5cGUucmVtb3ZlX25vZGUgPSBmdW5jdGlvbihub2RlKSB7XG4gIG5vZGUudHJhdmVyc2VfdXAoZnVuY3Rpb24oKSB7XG4gICAgcGFyZW50LndlaWdodCAtLTtcbiAgfSk7XG5cbiAgcmV0dXJuIHRoaXMucmVtb3ZlX2hlbHBlcihub2RlKTtcbn07XG5cblJCVHJlZS5wcm90b3R5cGUucmVtb3ZlX2NvcnJlY3Rpb24gPSBmdW5jdGlvbihub2RlLCBwYXJlbnQpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgb3Bwb3NpdGVTaWRlO1xuICB2YXIgaGVscGVyID0gZnVuY3Rpb24oc2lkZSkge1xuICAgIHZhciBuZWlnaGJvciA9IHBhcmVudC5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSk7XG5cbiAgICBpZiAobmVpZ2hib3IgJiYgbmVpZ2hib3IucmVkKSB7XG4gICAgICBuZWlnaGJvci5yZWQgPSBmYWxzZTtcbiAgICAgIHBhcmVudC5yZWQgICA9IHRydWU7XG5cbiAgICAgIHNlbGYucm90YXRlKHNpZGUsIHBhcmVudCk7XG4gICAgICBuZWlnaGJvciA9IHBhcmVudC5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKCghbmVpZ2hib3IubGVmdCB8fCAhbmVpZ2hib3IubGVmdC5yZWQpICYmICghbmVpZ2hib3IucmlnaHQgfHwgIW5laWdoYm9yLnJpZ2h0LnJlZCApKSB7XG4gICAgICBuZWlnaGJvci5yZWQgPSB0cnVlO1xuICAgICAgbm9kZSA9IHBhcmVudDtcbiAgICAgIHBhcmVudCA9IG5vZGUucGFyZW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIW5laWdoYm9yLmdldF9jaGlsZChzaWRlLCB0cnVlKSB8fCAhbmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUsIHRydWUpLnJlZCkge1xuICAgICAgICBpZiAobmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpKSB7XG4gICAgICAgICAgbmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpLnJlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIG5laWdoYm9yLnJlZCA9IHRydWU7XG5cbiAgICAgICAgb3Bwb3NpdGVTaWRlID0gc2lkZSA9PT0gJ2xlZnQnPyAncmlnaHQnOiAnbGVmdCc7XG4gICAgICAgIHNlbGYucm90YXRlKG9wcG9zaXRlU2lkZSwgbmVpZ2hib3IpO1xuICAgICAgICBuZWlnaGJvciA9IHBhcmVudC5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIG5laWdoYm9yLnJlZCA9IHBhcmVudD8gcGFyZW50LnJlZDogZmFscztcbiAgICAgIHBhcmVudC5yZWQgICA9IGZhbHNlO1xuICAgICAgaWYgKG5laWdoYm9yLmdldF9jaGlsZChzaWRlLCB0cnVlKSkge1xuICAgICAgICBuZWlnaGJvci5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSkucmVkID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHNlbGYucm90YXRlKHNpZGUsIHBhcmVudCk7XG4gICAgICBub2RlID0gc2VsZi5fcm9vdDtcbiAgICAgIHBhcmVudCA9IG5vZGUucGFyZW50O1xuICAgIH1cbiAgfTtcbiAgd2hpbGUgKG5vZGUgIT09IHRoaXMuX3Jvb3QgJiYgKCFub2RlIHx8ICFub2RlLnJlZCkpIHtcbiAgICBpZiAobm9kZSA9PT0gcGFyZW50LmdldF9jaGlsZCgnbGVmdCcpKSB7XG4gICAgICB0bXAgPSBoZWxwZXIoJ2xlZnQnKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgPT09IHBhcmVudC5nZXRfY2hpbGQoJ3JpZ2h0JykpIHtcbiAgICAgIHRtcCA9IGhlbHBlcigncmlnaHQnKTtcbiAgICB9XG4gIH1cblxuICBpZiAobm9kZSkge1xuICAgIG5vZGUucmVkID0gZmFsc2U7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIE5vZGUoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgdGhpcy5sZWZ0ID0gbnVsbDtcbiAgICB0aGlzLnJpZ2h0ID0gbnVsbDtcbiAgICB0aGlzLnBhcmVudCA9IG51bGw7XG4gICAgdGhpcy5yZWQgPSB0cnVlO1xuICAgIHRoaXMud2VpZ2h0ID0gMTtcbn1cblxuTm9kZS5wcm90b3R5cGUuZ2V0X2NoaWxkID0gZnVuY3Rpb24oc2lkZSwgb3Bwb3NpdGUpIHtcbiAgaWYgKG9wcG9zaXRlKSB7XG4gICAgc2lkZSA9IChzaWRlID09PSAnbGVmdCcpPyAncmlnaHQnOiAnbGVmdCc7XG4gIH1cbiAgcmV0dXJuIHNpZGUgPT09ICdsZWZ0Jz8gdGhpcy5sZWZ0OiB0aGlzLnJpZ2h0O1xufTtcblxuTm9kZS5wcm90b3R5cGUuc2V0X2NoaWxkID0gZnVuY3Rpb24oc2lkZSwgbm9kZSwgb3Bwb3NpdGUpIHtcbiAgaWYgKG9wcG9zaXRlKSB7XG4gICAgc2lkZSA9IChzaWRlID09PSAnbGVmdCcpPyAncmlnaHQnOiAnbGVmdCc7XG4gIH1cblxuICBpZiAoc2lkZSA9PT0gJ2xlZnQnKSB7XG4gICAgdGhpcy5sZWZ0ID0gbm9kZTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnJpZ2h0ID0gbm9kZTtcbiAgfVxufTtcblxuTm9kZS5wcm90b3R5cGUubWF4X3RyZWUgPSBmdW5jdGlvbihmdW4pIHtcbiAgdmFyIG5vZGUgPSB0aGlzO1xuXG4gIGlmIChmdW4pIHtcbiAgICBmdW4obm9kZSk7XG4gIH1cblxuICB3aGlsZSAobm9kZS5yaWdodCkge1xuICAgIG5vZGUgPSBub2RlLnJpZ2h0O1xuICAgIGlmIChmdW4pIHtcbiAgICAgIGZ1bihub2RlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbm9kZTtcbn07XG5cbk5vZGUucHJvdG90eXBlLm1pbl90cmVlID0gZnVuY3Rpb24oZnVuKSB7XG4gIHZhciBub2RlID0gdGhpcztcblxuICBpZiAoZnVuKSB7XG4gICAgZnVuKG5vZGUpO1xuICB9XG5cbiAgd2hpbGUgKG5vZGUubGVmdCkge1xuICAgIG5vZGUgPSBub2RlLmxlZnQ7XG4gICAgaWYgKGZ1bikge1xuICAgICAgZnVuKG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub2RlO1xufTtcblxuXG5Ob2RlLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24oZnVuKSB7XG4gIHZhciBub2RlLCBwYXJlbnQ7XG4gIGlmICh0aGlzLmdldF9jaGlsZCgncmlnaHQnKSkge1xuICAgIHJldHVybiB0aGlzLmdldF9jaGlsZCgncmlnaHQnKS5taW5fdHJlZShmdW4pO1xuICB9XG5cbiAgaWYgKGZ1bikge1xuICAgIGZ1bih0aGlzKTtcbiAgfVxuICBub2RlID0gdGhpcztcbiAgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG4gIHdoaWxlIChwYXJlbnQgJiYgbm9kZSA9PT0gcGFyZW50LmdldF9jaGlsZCgncmlnaHQnKSkge1xuICAgIG5vZGUgPSBwYXJlbnQ7XG4gICAgcGFyZW50ID0gbm9kZS5wYXJlbnQ7XG5cbiAgICBpZiAoZnVuKSB7XG4gICAgICBmdW4ocGFyZW50KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFyZW50O1xufTtcblxuTm9kZS5wcm90b3R5cGUucHJldiA9IGZ1bmN0aW9uKGZ1bikge1xuICB2YXIgbm9kZSwgcGFyZW50O1xuICBpZiAodGhpcy5nZXRfY2hpbGQoJ2xlZnQnKSkge1xuICAgIHJldHVybiB0aGlzLmdldF9jaGlsZCgnbGVmdCcpLm1heF90cmVlKGZ1bik7XG4gIH1cblxuICBpZiAoZnVuKSB7XG4gICAgZnVuKHRoaXMpO1xuICB9XG4gIG5vZGUgPSB0aGlzO1xuICBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgd2hpbGUgKHBhcmVudCAmJiBub2RlID09PSBwYXJlbnQuZ2V0X2NoaWxkKCdsZWZ0JykpIHtcbiAgICBub2RlID0gcGFyZW50O1xuICAgIHBhcmVudCA9IG5vZGUucGFyZW50O1xuXG4gICAgaWYgKGZ1bikge1xuICAgICAgZnVuKHBhcmVudCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhcmVudDtcbn07XG5cbi8qKiBUcmF2ZXJzZSB0aGUgdHJlZSB1cHdhcmRzIHVudGlsIGl0IHJlYWNoZXMgdGhlIHRvcC4gRm9yIGVhY2ggbm9kZSB0cmF2ZXJzZWQsXG4gICogY2FsbCB0aGUgZnVuY3Rpb24gcGFzc2VkIGFzIGFyZ3VtZW50IHdpdGggYXJndW1lbnRzIG5vZGUsIHBhcmVudC5cbiAgKiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgaC0xIHRpbWVzLCBoIGJlaW5nIHRoZSBoZWlnaHQgb2YgdGhlIGJyYW5jaC5cbiAgKiovXG5Ob2RlLnByb3RvdHlwZS50cmF2ZXJzZV91cCA9IGZ1bmN0aW9uKGZ1bikge1xuICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG4gIHZhciBub2RlID0gdGhpcztcblxuICB3aGlsZShwYXJlbnQpIHtcbiAgICBmdW4obm9kZSwgcGFyZW50KTtcbiAgICBub2RlID0gcGFyZW50O1xuICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gIH1cbn07XG5cbk5vZGUucHJvdG90eXBlLmRlcHRoID0gZnVuY3Rpb24oKSB7XG4gIHZhciBkZXB0aCA9IDA7XG4gIHRoaXMudHJhdmVyc2VfdXAoZnVuY3Rpb24oKSB7XG4gICAgZGVwdGggKys7XG4gIH0pO1xuICByZXR1cm4gZGVwdGg7XG59O1xuXG5Ob2RlLnByb3RvdHlwZS5wb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcG9zaXRpb24gPSB0aGlzLmxlZnQ/IHRoaXMubGVmdC53ZWlnaHQ6IDA7XG4gIHZhciBjb3VudEZ1biA9IGZ1bmN0aW9uKG5vZGUsIHBhcmVudCkge1xuICAgIGlmIChwYXJlbnQucmlnaHQgPT09IG5vZGUpIHtcbiAgICAgIC8vIGZvciB0aGUgbGVmdCBzdWJ0cmVlXG4gICAgICBpZiAocGFyZW50LmxlZnQpIHtcbiAgICAgICAgcG9zaXRpb24gKz0gcGFyZW50LmxlZnQud2VpZ2h0O1xuICAgICAgfVxuICAgICAgcG9zaXRpb24gKz0gMTsgLy8gZm9yIHRoZSBwYXJlbnRcbiAgICB9XG4gIH07XG5cbiAgdGhpcy50cmF2ZXJzZV91cChjb3VudEZ1bik7XG4gIHJldHVybiBwb3NpdGlvbjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUkJUcmVlO1xuIiwiXG5mdW5jdGlvbiBUcmVlQmFzZSgpIHt9XG5cbi8vIHJlbW92ZXMgYWxsIG5vZGVzIGZyb20gdGhlIHRyZWVcblRyZWVCYXNlLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Jvb3QgPSBudWxsO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG59O1xuXG4vLyByZXR1cm5zIG5vZGUgZGF0YSBpZiBmb3VuZCwgbnVsbCBvdGhlcndpc2VcblRyZWVCYXNlLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xuXG4gICAgd2hpbGUocmVzICE9PSBudWxsKSB7XG4gICAgICAgIHZhciBjID0gdGhpcy5fY29tcGFyYXRvcihkYXRhLCByZXMuZGF0YSk7XG4gICAgICAgIGlmKGMgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiByZXMuZGF0YTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcyA9IHJlcy5nZXRfY2hpbGQoYyA+IDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyByZXR1cm5zIGl0ZXJhdG9yIHRvIG5vZGUgaWYgZm91bmQsIG51bGwgb3RoZXJ3aXNlXG5UcmVlQmFzZS5wcm90b3R5cGUuZmluZEl0ZXIgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHJlcyA9IHRoaXMuX3Jvb3Q7XG4gICAgdmFyIGl0ZXIgPSB0aGlzLml0ZXJhdG9yKCk7XG5cbiAgICB3aGlsZShyZXMgIT09IG51bGwpIHtcbiAgICAgICAgdmFyIGMgPSB0aGlzLl9jb21wYXJhdG9yKGRhdGEsIHJlcy5kYXRhKTtcbiAgICAgICAgaWYoYyA9PT0gMCkge1xuICAgICAgICAgICAgaXRlci5fY3Vyc29yID0gcmVzO1xuICAgICAgICAgICAgcmV0dXJuIGl0ZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpdGVyLl9hbmNlc3RvcnMucHVzaChyZXMpO1xuICAgICAgICAgICAgcmVzID0gcmVzLmdldF9jaGlsZChjID4gMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbi8vIFJldHVybnMgYW4gaW50ZXJhdG9yIHRvIHRoZSB0cmVlIG5vZGUgYXQgb3IgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIGl0ZW1cblRyZWVCYXNlLnByb3RvdHlwZS5sb3dlckJvdW5kID0gZnVuY3Rpb24oaXRlbSkge1xuICAgIHZhciBjdXIgPSB0aGlzLl9yb290O1xuICAgIHZhciBpdGVyID0gdGhpcy5pdGVyYXRvcigpO1xuICAgIHZhciBjbXAgPSB0aGlzLl9jb21wYXJhdG9yO1xuXG4gICAgd2hpbGUoY3VyICE9PSBudWxsKSB7XG4gICAgICAgIHZhciBjID0gY21wKGl0ZW0sIGN1ci5kYXRhKTtcbiAgICAgICAgaWYoYyA9PT0gMCkge1xuICAgICAgICAgICAgaXRlci5fY3Vyc29yID0gY3VyO1xuICAgICAgICAgICAgcmV0dXJuIGl0ZXI7XG4gICAgICAgIH1cbiAgICAgICAgaXRlci5fYW5jZXN0b3JzLnB1c2goY3VyKTtcbiAgICAgICAgY3VyID0gY3VyLmdldF9jaGlsZChjID4gMCk7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpPWl0ZXIuX2FuY2VzdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICBjdXIgPSBpdGVyLl9hbmNlc3RvcnNbaV07XG4gICAgICAgIGlmKGNtcChpdGVtLCBjdXIuZGF0YSkgPCAwKSB7XG4gICAgICAgICAgICBpdGVyLl9jdXJzb3IgPSBjdXI7XG4gICAgICAgICAgICBpdGVyLl9hbmNlc3RvcnMubGVuZ3RoID0gaTtcbiAgICAgICAgICAgIHJldHVybiBpdGVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaXRlci5fYW5jZXN0b3JzLmxlbmd0aCA9IDA7XG4gICAgcmV0dXJuIGl0ZXI7XG59O1xuXG4vLyBSZXR1cm5zIGFuIGludGVyYXRvciB0byB0aGUgdHJlZSBub2RlIGltbWVkaWF0ZWx5IGFmdGVyIHRoZSBpdGVtXG5UcmVlQmFzZS5wcm90b3R5cGUudXBwZXJCb3VuZCA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICB2YXIgaXRlciA9IHRoaXMubG93ZXJCb3VuZChpdGVtKTtcbiAgICB2YXIgY21wID0gdGhpcy5fY29tcGFyYXRvcjtcblxuICAgIHdoaWxlKGNtcChpdGVyLmRhdGEoKSwgaXRlbSkgPT09IDApIHtcbiAgICAgICAgaXRlci5uZXh0KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZXI7XG59O1xuXG4vLyByZXR1cm5zIG51bGwgaWYgdHJlZSBpcyBlbXB0eVxuVHJlZUJhc2UucHJvdG90eXBlLm1pbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xuICAgIGlmKHJlcyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB3aGlsZShyZXMubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICByZXMgPSByZXMubGVmdDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzLmRhdGE7XG59O1xuXG4vLyByZXR1cm5zIG51bGwgaWYgdHJlZSBpcyBlbXB0eVxuVHJlZUJhc2UucHJvdG90eXBlLm1heCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xuICAgIGlmKHJlcyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB3aGlsZShyZXMucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgcmVzID0gcmVzLnJpZ2h0O1xuICAgIH1cblxuICAgIHJldHVybiByZXMuZGF0YTtcbn07XG5cbi8vIHJldHVybnMgYSBudWxsIGl0ZXJhdG9yXG4vLyBjYWxsIG5leHQoKSBvciBwcmV2KCkgdG8gcG9pbnQgdG8gYW4gZWxlbWVudFxuVHJlZUJhc2UucHJvdG90eXBlLml0ZXJhdG9yID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJdGVyYXRvcih0aGlzKTtcbn07XG5cblxuVHJlZUJhc2UucHJvdG90eXBlLmVhY2hOb2RlID0gZnVuY3Rpb24oY2IpIHtcbiAgICB2YXIgaXQ9dGhpcy5pdGVyYXRvcigpLCBub2RlO1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgd2hpbGUoKG5vZGUgPSBpdC5uZXh0KCkpICE9PSBudWxsKSB7XG4gICAgICAgIGNiKG5vZGUsIGluZGV4KTtcbiAgICAgICAgaW5kZXgrKztcbiAgICB9XG59O1xuXG4vLyBjYWxscyBjYiBvbiBlYWNoIG5vZGUncyBkYXRhLCBpbiBvcmRlclxuVHJlZUJhc2UucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbihjYikge1xuICAgIHRoaXMuZWFjaE5vZGUoZnVuY3Rpb24obm9kZSwgaW5kZXgpIHtcbiAgICAgICAgY2Iobm9kZS5kYXRhLCBpbmRleCk7XG4gICAgfSk7XG59O1xuXG5cblRyZWVCYXNlLnByb3RvdHlwZS5tYXBOb2RlID0gZnVuY3Rpb24oY2IpIHtcbiAgICB2YXIgaXQ9dGhpcy5pdGVyYXRvcigpLCBub2RlO1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB3aGlsZSgobm9kZSA9IGl0Lm5leHQoKSkgIT09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGNiKG5vZGUsIGluZGV4KSk7XG4gICAgICAgIGluZGV4ICsrO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbi8vIGNhbGxzIGNiIG9uIGVhY2ggbm9kZS1zIGRhdGEsIHN0b3JlIHRoZSByZXN1bHQgYW5kIHJldHVybiBpdFxuVHJlZUJhc2UucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uKGNiKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwTm9kZShmdW5jdGlvbihub2RlLCBpbmRleCkge1xuICAgICAgICByZXR1cm4gY2Iobm9kZS5kYXRhLCBpbmRleCk7XG4gICAgfSk7XG59O1xuXG5mdW5jdGlvbiBJdGVyYXRvcih0cmVlKSB7XG4gICAgdGhpcy5fdHJlZSA9IHRyZWU7XG4gICAgdGhpcy5fYW5jZXN0b3JzID0gW107XG4gICAgdGhpcy5fY3Vyc29yID0gbnVsbDtcbn1cblxuSXRlcmF0b3IucHJvdG90eXBlLmRhdGEgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yICE9PSBudWxsID8gdGhpcy5fY3Vyc29yLmRhdGEgOiBudWxsO1xufTtcblxuLy8gaWYgbnVsbC1pdGVyYXRvciwgcmV0dXJucyBmaXJzdCBub2RlXG4vLyBvdGhlcndpc2UsIHJldHVybnMgbmV4dCBub2RlXG5JdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmKHRoaXMuX2N1cnNvciA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgcm9vdCA9IHRoaXMuX3RyZWUuX3Jvb3Q7XG4gICAgICAgIGlmKHJvb3QgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX21pbk5vZGUocm9vdCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmKHRoaXMuX2N1cnNvci5yaWdodCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gbm8gZ3JlYXRlciBub2RlIGluIHN1YnRyZWUsIGdvIHVwIHRvIHBhcmVudFxuICAgICAgICAgICAgLy8gaWYgY29taW5nIGZyb20gYSByaWdodCBjaGlsZCwgY29udGludWUgdXAgdGhlIHN0YWNrXG4gICAgICAgICAgICB2YXIgc2F2ZTtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBzYXZlID0gdGhpcy5fY3Vyc29yO1xuICAgICAgICAgICAgICAgIGlmKHRoaXMuX2FuY2VzdG9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3Vyc29yID0gdGhpcy5fYW5jZXN0b3JzLnBvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY3Vyc29yID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSB3aGlsZSh0aGlzLl9jdXJzb3IucmlnaHQgPT09IHNhdmUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gZ2V0IHRoZSBuZXh0IG5vZGUgZnJvbSB0aGUgc3VidHJlZVxuICAgICAgICAgICAgdGhpcy5fYW5jZXN0b3JzLnB1c2godGhpcy5fY3Vyc29yKTtcbiAgICAgICAgICAgIHRoaXMuX21pbk5vZGUodGhpcy5fY3Vyc29yLnJpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yICE9PSBudWxsID8gdGhpcy5fY3Vyc29yIDogbnVsbDtcbn07XG5cbi8vIGlmIG51bGwtaXRlcmF0b3IsIHJldHVybnMgbGFzdCBub2RlXG4vLyBvdGhlcndpc2UsIHJldHVybnMgcHJldmlvdXMgbm9kZVxuSXRlcmF0b3IucHJvdG90eXBlLnByZXYgPSBmdW5jdGlvbigpIHtcbiAgICBpZih0aGlzLl9jdXJzb3IgPT09IG51bGwpIHtcbiAgICAgICAgdmFyIHJvb3QgPSB0aGlzLl90cmVlLl9yb290O1xuICAgICAgICBpZihyb290ICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXhOb2RlKHJvb3QpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZih0aGlzLl9jdXJzb3IubGVmdCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIHNhdmU7XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgc2F2ZSA9IHRoaXMuX2N1cnNvcjtcbiAgICAgICAgICAgICAgICBpZih0aGlzLl9hbmNlc3RvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2N1cnNvciA9IHRoaXMuX2FuY2VzdG9ycy5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2N1cnNvciA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gd2hpbGUodGhpcy5fY3Vyc29yLmxlZnQgPT09IHNhdmUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fYW5jZXN0b3JzLnB1c2godGhpcy5fY3Vyc29yKTtcbiAgICAgICAgICAgIHRoaXMuX21heE5vZGUodGhpcy5fY3Vyc29yLmxlZnQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jdXJzb3IgIT09IG51bGwgPyB0aGlzLl9jdXJzb3IgOiBudWxsO1xufTtcblxuSXRlcmF0b3IucHJvdG90eXBlLl9taW5Ob2RlID0gZnVuY3Rpb24oc3RhcnQpIHtcbiAgICB3aGlsZShzdGFydC5sZWZ0ICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX2FuY2VzdG9ycy5wdXNoKHN0YXJ0KTtcbiAgICAgICAgc3RhcnQgPSBzdGFydC5sZWZ0O1xuICAgIH1cbiAgICB0aGlzLl9jdXJzb3IgPSBzdGFydDtcbn07XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5fbWF4Tm9kZSA9IGZ1bmN0aW9uKHN0YXJ0KSB7XG4gICAgd2hpbGUoc3RhcnQucmlnaHQgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYW5jZXN0b3JzLnB1c2goc3RhcnQpO1xuICAgICAgICBzdGFydCA9IHN0YXJ0LnJpZ2h0O1xuICAgIH1cbiAgICB0aGlzLl9jdXJzb3IgPSBzdGFydDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVHJlZUJhc2U7XG4iXX0=
