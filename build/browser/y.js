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


},{"./ConnectorAdapter":1,"./Engine":3,"./HistoryBuffer":4,"./ObjectType":5,"./Operations/Structured":7}]},{},[8])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9naXQveWpzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9Db25uZWN0b3JBZGFwdGVyLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvZ2l0L3lqcy9saWIvRW5naW5lLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9IaXN0b3J5QnVmZmVyLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PcGVyYXRpb25zL0Jhc2ljLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi9PcGVyYXRpb25zL1N0cnVjdHVyZWQuY29mZmVlIiwiL2hvbWUvZG1vbmFkL2dpdC95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENBQWxCLENBREY7QUFBQSxHQUFBO0FBQUEsRUFHQSxTQUFTLENBQUMsYUFBVixDQUFBLENBSEEsQ0FBQTtBQUFBLEVBS0EsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEtBQWlCLEVBQUUsQ0FB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O0FBQUEsRUFvQkEsRUFBQSxHQUFTLElBQUEsT0FBTyxDQUFDLE1BQVIsQ0FBQSxDQXBCVCxDQUFBO0FBQUEsRUFxQkEsS0FBQSxHQUFZLElBQUEsR0FBRyxDQUFDLFVBQUosQ0FBZSxFQUFmLEVBQW1CLEVBQUUsQ0FBQywyQkFBSCxDQUFBLENBQW5CLENBQW9ELENBQUMsT0FBckQsQ0FBQSxDQXJCWixDQUFBO0FBQUEsRUFzQkEsRUFBRSxDQUFDLFNBQUgsQ0FBYSxLQUFiLENBdEJBLENBQUE7U0F1QkEsR0F4QlE7QUFBQSxDQU5WLENBQUE7O0FBQUEsTUFnQ00sQ0FBQyxPQUFQLEdBQWlCLE9BaENqQixDQUFBOztBQWlDQSxJQUFHLGdEQUFIO0FBQ0UsRUFBQSxNQUFNLENBQUMsQ0FBUCxHQUFXLE9BQVgsQ0FERjtDQWpDQTs7QUFBQSxPQW9DTyxDQUFDLE1BQVIsR0FBaUIsT0FBQSxDQUFRLGNBQVIsQ0FwQ2pCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5Db25uZWN0b3JDbGFzcyA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckNsYXNzXCJcbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cblxuICBmb3IgbmFtZSwgZiBvZiBDb25uZWN0b3JDbGFzc1xuICAgIGNvbm5lY3RvcltuYW1lXSA9IGZcblxuICBjb25uZWN0b3Iuc2V0SXNCb3VuZFRvWSgpXG5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEhCLmdldFVzZXJJZCgpKSBhbmRcbiAgICAgICAgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKSBhbmQgIyBUT0RPOiBpIGRvbid0IHRoaW5rIHRoYXQgd2UgbmVlZCB0aGlzIGFueW1vcmUuLlxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cblxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIGdldEhCID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcbiAgICBqc29uID1cbiAgICAgIGhiOiBoYlxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgIGpzb25cblxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXG5cbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXG5cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMgPz0gW11cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXG5cblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvclxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9XG4gICNcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnN5bmNNZXRob2Qge1N0cmluZ30gIGlzIGVpdGhlciBcInN5bmNBbGxcIiBvciBcIm1hc3Rlci1zbGF2ZVwiLlxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNZXRob2RcIiwgW1wic3luY0FsbFwiLCBcIm1hc3Rlci1zbGF2ZVwiXVxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cbiAgICByZXEgXCJ1c2VyX2lkXCJcbiAgICBAb25fdXNlcl9pZF9zZXQ/KEB1c2VyX2lkKVxuXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxuICAgICMgQnV0IHRoaXMgaXMgbm90IG5lY2Vzc2FyeSBpbiB0aGUgdGVzdC1jb25uZWN0b3JcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxuICAgIGVsc2VcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXG5cbiAgICAjIEEgTWFzdGVyIHNob3VsZCBzeW5jIHdpdGggZXZlcnlvbmUhIFRPRE86IHJlYWxseT8gLSBmb3Igbm93IGl0cyBzYWZlciB0aGlzIHdheSFcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXG5cbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcbiAgICAjIFBlZXJqcyBDb25uZWN0aW9uczoga2V5OiBjb25uLWlkLCB2YWx1ZTogb2JqZWN0XG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMgPz0gW11cblxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxuICAgIEBpc19pbml0aWFsaXplZCA9IHRydWVcblxuICBvblVzZXJFdmVudDogKGYpLT5cbiAgICBAY29ubmVjdGlvbnNfbGlzdGVuZXJzID89IFtdXG4gICAgQGNvbm5lY3Rpb25zX2xpc3RlbmVycy5wdXNoIGZcblxuICBpc1JvbGVNYXN0ZXI6IC0+XG4gICAgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuXG4gIGlzUm9sZVNsYXZlOiAtPlxuICAgIEByb2xlIGlzIFwic2xhdmVcIlxuXG4gIGZpbmROZXdTeW5jVGFyZ2V0OiAoKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGZvciB1c2VyLCBjIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBpZiBub3QgYy5pc19zeW5jZWRcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgICAgIGJyZWFrXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQHNldFN0YXRlU3luY2VkKClcbiAgICBudWxsXG5cbiAgdXNlckxlZnQ6ICh1c2VyKS0+XG4gICAgZGVsZXRlIEBjb25uZWN0aW9uc1t1c2VyXVxuICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG4gICAgaWYgQGNvbm5lY3Rpb25zX2xpc3RlbmVycz9cbiAgICAgIGZvciBmIGluIEBjb25uZWN0aW9uc19saXN0ZW5lcnNcbiAgICAgICAgZiB7XG4gICAgICAgICAgYWN0aW9uOiBcInVzZXJMZWZ0XCJcbiAgICAgICAgICB1c2VyOiB1c2VyXG4gICAgICAgIH1cblxuXG4gIHVzZXJKb2luZWQ6ICh1c2VyLCByb2xlKS0+XG4gICAgaWYgbm90IHJvbGU/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJbnRlcm5hbDogWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhIEUuZy4gdXNlckpvaW5lZCgndWlkOjM5MzknLCdzbGF2ZScpXCJcbiAgICAjIGEgdXNlciBqb2luZWQgdGhlIHJvb21cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0gPz0ge31cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0uaXNfc3luY2VkID0gZmFsc2VcblxuICAgIGlmIChub3QgQGlzX3N5bmNlZCkgb3IgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgICAjIFRPRE86IFdoYXQgaWYgdGhlcmUgYXJlIHR3byBtYXN0ZXJzPyBQcmV2ZW50IHNlbmRpbmcgZXZlcnl0aGluZyB0d28gdGltZXMhXG4gICAgICAgIEBwZXJmb3JtU3luY1dpdGhNYXN0ZXIgdXNlclxuXG4gICAgaWYgQGNvbm5lY3Rpb25zX2xpc3RlbmVycz9cbiAgICAgIGZvciBmIGluIEBjb25uZWN0aW9uc19saXN0ZW5lcnNcbiAgICAgICAgZiB7XG4gICAgICAgICAgYWN0aW9uOiBcInVzZXJKb2luZWRcIlxuICAgICAgICAgIHVzZXI6IHVzZXJcbiAgICAgICAgICByb2xlOiByb2xlXG4gICAgICAgIH1cblxuICAjXG4gICMgRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLiBJZiBub3QgY29ubmVjdGVkLCB3YWl0IHVudGlsIGNvbm5lY3RlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIENvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgYXJncy5jb25zdHJ1Y3RvciBpcyBGdW5jdGlvblxuICAgICAgYXJncyA9IFthcmdzXVxuICAgIGlmIEBpc19zeW5jZWRcbiAgICAgIGFyZ3NbMF0uYXBwbHkgdGhpcywgYXJnc1sxLi5dXG4gICAgZWxzZVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkLnB1c2ggYXJnc1xuXG4gICNcbiAgIyBFeGVjdXRlIGFuIGZ1bmN0aW9uIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LiBmIHdpbGwgYmUgY2FsbGVkIHdpdGggKHNlbmRlcl9pZCwgYnJvYWRjYXN0IHt0cnVlfGZhbHNlfSwgbWVzc2FnZSkuXG4gICNcbiAgb25SZWNlaXZlOiAoZiktPlxuICAgIEByZWNlaXZlX2hhbmRsZXJzLnB1c2ggZlxuXG4gICMjI1xuICAjIEJyb2FkY2FzdCBhIG1lc3NhZ2UgdG8gYWxsIGNvbm5lY3RlZCBwZWVycy5cbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXG4gICNcbiAgYnJvYWRjYXN0OiAobWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcblxuICAjXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcbiAgI1xuICBzZW5kOiAocGVlcl9zLCBtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcbiAgIyMjXG5cbiAgI1xuICAjIHBlcmZvcm0gYSBzeW5jIHdpdGggYSBzcGVjaWZpYyB1c2VyLlxuICAjXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgICAgQHNlbmQgdXNlcixcbiAgICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgZGF0YTogQGdldFN0YXRlVmVjdG9yKClcbiAgICAgIGlmIG5vdCBAc2VudF9oYl90b19hbGxfdXNlcnNcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxuXG4gICAgICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG5cblxuICAjXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxuICAjXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICBAc2VuZCB1c2VyLFxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICBkYXRhOiBAZ2V0U3RhdGVWZWN0b3IoKVxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgIF9oYiA9IFtdXG4gICAgZm9yIG8gaW4gaGJcbiAgICAgIF9oYi5wdXNoIG9cbiAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgX2hiID0gW11cbiAgICBAYnJvYWRjYXN0XG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICBkYXRhOiBfaGJcblxuICAjXG4gICMgWW91IGFyZSBzdXJlIHRoYXQgYWxsIGNsaWVudHMgYXJlIHN5bmNlZCwgY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XG4gICAgaWYgbm90IEBpc19zeW5jZWRcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cbiAgICAgICAgZm9yIGVsIGluIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICAgICAgZiA9IGVsWzBdXG4gICAgICAgICAgYXJncyA9IGVsWzEuLl1cbiAgICAgICAgICBmLmFwcGx5KGFyZ3MpXG4gICAgICAgIGRlbGV0ZSBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgbnVsbFxuXG4gICMgZXhlY3V0ZWQgd2hlbiB0aGUgYSBzdGF0ZV92ZWN0b3IgaXMgcmVjZWl2ZWQuIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIG9ubHkgb25jZSFcbiAgd2hlblJlY2VpdmVkU3RhdGVWZWN0b3I6IChmKS0+XG4gICAgQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVycyA/PSBbXVxuICAgIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnMucHVzaCBmXG5cblxuICAjXG4gICMgWW91IHJlY2VpdmVkIGEgcmF3IG1lc3NhZ2UsIGFuZCB5b3Uga25vdyB0aGF0IGl0IGlzIGludGVuZGVkIGZvciB0byBZanMuIFRoZW4gY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cbiAgICBpZiBub3QgcmVzLnN5bmNfc3RlcD9cbiAgICAgIGZvciBmIGluIEByZWNlaXZlX2hhbmRsZXJzXG4gICAgICAgIGYgc2VuZGVyLCByZXNcbiAgICBlbHNlXG4gICAgICBpZiBzZW5kZXIgaXMgQHVzZXJfaWRcbiAgICAgICAgcmV0dXJuXG4gICAgICBpZiByZXMuc3luY19zdGVwIGlzIFwiZ2V0SEJcIlxuICAgICAgICAjIGNhbGwgbGlzdGVuZXJzXG4gICAgICAgIGlmIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnM/XG4gICAgICAgICAgZm9yIGYgaW4gQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVyc1xuICAgICAgICAgICAgZi5jYWxsIHRoaXMsIHJlcy5kYXRhXG4gICAgICAgIGRlbGV0ZSBAd2hlbl9yZWNlaXZlZF9zdGF0ZV92ZWN0b3JfbGlzdGVuZXJzXG5cbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcbiAgICAgICAgaGIgPSBkYXRhLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxuICAgICAgICAjIFdoZW4gdGhpcyBjbGllbnQgb25seSBzeW5jcyB0byBvbmUgb3RoZXIgY2xpZW50cywgYnV0IGxvb3NlcyBjb25uZWN0b3JzLFxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcbiAgICAgICAgaWYgQGlzX3N5bmNlZFxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXG5cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG5cbiAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxuICAgICAgICAgICAgKCk9PlxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcbiAgICAgICAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgIyBBdCB0aGUgYmVnaW5uaW5nICh3aGVuIHRoZSB1c2VyIGlkIHdhcyBub3QgYXNzaWduZWQgeWV0KSxcbiAgIyB0aGUgb3BlcmF0aW9ucyBhcmUgYWRkZWQgdG8gYnVmZmVyLl90ZW1wLiBXaGVuIHlvdSBmaW5hbGx5IGdldCB5b3VyIHVzZXIgaWQsXG4gICMgdGhlIG9wZXJhdGlvbnMgYXJlIGNvcGllcyBmcm9tIGJ1ZmZlci5fdGVtcCB0byBidWZmZXJbaWRdLiBGdXJ0aGVybW9yZSwgd2hlbiBidWZmZXJbaWRdIGRvZXMgYWxyZWFkeSBjb250YWluIG9wZXJhdGlvbnNcbiAgIyAoYmVjYXVzZSBvZiBhIHByZXZpb3VzIHNlc3Npb24pLCB0aGUgdWlkLm9wX251bWJlcnMgb2YgdGhlIG9wZXJhdGlvbnMgaGF2ZSB0byBiZSByZWFzc2lnbmVkLlxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIGZ1bmN0aW9uIGRvZXMuIEl0IGFkZHMgdGhlbSB0byBidWZmZXJbaWRdLFxuICAjIGFuZCBhc3NpZ25zIHRoZW0gdGhlIGNvcnJlY3QgdWlkLm9wX251bWJlciBhbmQgdWlkLmNyZWF0b3JcbiAgc2V0VXNlcklkOiAoQHVzZXJfaWQsIHN0YXRlX3ZlY3RvciktPlxuICAgIEBidWZmZXJbQHVzZXJfaWRdID89IFtdXG4gICAgYnVmZiA9IEBidWZmZXJbQHVzZXJfaWRdXG5cbiAgICAjIHdlIGFzc3VtZWQgdGhhdCB3ZSBzdGFydGVkIHdpdGggY291bnRlciA9IDAuXG4gICAgIyB3aGVuIHdlIHJlY2VpdmUgdGhhIHN0YXRlX3ZlY3RvciwgYW5kIGFjdHVhbGx5IGhhdmVcbiAgICAjIGNvdW50ZXIgPSAxMC4gVGhlbiB3ZSBoYXZlIHRvIGFkZCAxMCB0byBldmVyeSBvcF9jb3VudGVyXG4gICAgY291bnRlcl9kaWZmID0gc3RhdGVfdmVjdG9yW0B1c2VyX2lkXSBvciAwXG5cbiAgICBpZiBAYnVmZmVyLl90ZW1wP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIEBidWZmZXIuX3RlbXBcbiAgICAgICAgby51aWQuY3JlYXRvciA9IEB1c2VyX2lkXG4gICAgICAgIG8udWlkLm9wX251bWJlciArPSBjb3VudGVyX2RpZmZcbiAgICAgICAgYnVmZltvLnVpZC5vcF9udW1iZXJdID0gb1xuXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXSA9IChAb3BlcmF0aW9uX2NvdW50ZXIuX3RlbXAgb3IgMCkgKyBjb3VudGVyX2RpZmZcblxuICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXIuX3RlbXBcbiAgICBkZWxldGUgQGJ1ZmZlci5fdGVtcFxuXG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxuICAgICAgby5jbGVhbnVwPygpXG5cbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxuICAgIEB0cmFzaCA9IFtdXG4gICAgaWYgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCBpc250IC0xXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcbiAgICB1bmRlZmluZWRcblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxuICAgICAgZm9yIG8gaW4gYXJndW1lbnRzXG4gICAgICAgIGlmIG8/XG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXG5cbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXG4gICAgQHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0KClcbiAgICBAZ2FyYmFnZSA9IFtdXG4gICAgQHRyYXNoID0gW11cblxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxuICAgIGNsZWFyVGltZW91dCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWRcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcblxuICBzZXRHYXJiYWdlQ29sbGVjdFRpbWVvdXQ6IChAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0KS0+XG5cbiAgI1xuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICByZXMgPSB7fVxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICAgIHJlc1xuICAgIGVsc2VcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBvLnVpZC5vcF9udW1iZXIgPD0gQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XG5cbiAgI1xuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXG4gICAgICBpZiB1X25hbWUgaXMgXCJfXCJcbiAgICAgICAgY29udGludWVcbiAgICAgIGZvciBvX251bWJlcixvIG9mIHVzZXJcbiAgICAgICAgaWYgKG5vdCBvLnVpZC5ub09wZXJhdGlvbj8pIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/ICMgYXBwbGllcyBmb3IgYWxsIG9wcyBidXQgdGhlIG1vc3QgcmlnaHQgZGVsaW1pdGVyIVxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQudWlkLmNyZWF0b3IsIG9fbmV4dC51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD8gIyBtb3N0IHJpZ2h0IGRlbGltaXRlciBvbmx5IVxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX3ByZXYudWlkLmNyZWF0b3IsIG9fcHJldi51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxuICAjIG9uIHRoZSBvcGVyYXRpb25zIHJldHJpZXZlU3ViIG1ldGhvZCAod2hpY2ggbXVzdCEgYmUgZGVmaW5lZClcbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBpZiB1aWQuc3ViPyBhbmQgbz9cbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxuICAgIGVsc2VcbiAgICAgIG9cblxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSkpIGFuZCBzdGF0ZV92ZWN0b3JbdXNlcl0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxuICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgd2hpbGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1dP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICB1bmRlZmluZWRcblxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXG4iLCJcbmNsYXNzIFlPYmplY3RcblxuICBjb25zdHJ1Y3RvcjogKEBfb2JqZWN0ID0ge30pLT5cbiAgICBpZiBAX29iamVjdC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgIGZvciBuYW1lLCB2YWwgb2YgQF9vYmplY3RcbiAgICAgICAgaWYgdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIEBfb2JqZWN0W25hbWVdID0gbmV3IFlPYmplY3QodmFsKVxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlkuT2JqZWN0IGFjY2VwdHMgSnNvbiBPYmplY3RzIG9ubHlcIlxuXG4gIF9uYW1lOiBcIk9iamVjdFwiXG5cbiAgX2dldE1vZGVsOiAodHlwZXMsIG9wcyktPlxuICAgIGlmIG5vdCBAX21vZGVsP1xuICAgICAgQF9tb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihAKS5leGVjdXRlKClcbiAgICAgIGZvciBuLG8gb2YgQF9vYmplY3RcbiAgICAgICAgQF9tb2RlbC52YWwgbiwgb1xuICAgIGRlbGV0ZSBAX29iamVjdFxuICAgIEBfbW9kZWxcblxuICBfc2V0TW9kZWw6IChAX21vZGVsKS0+XG4gICAgZGVsZXRlIEBfb2JqZWN0XG5cbiAgb2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLm9ic2VydmUgZlxuICAgIEBcblxuICB1bm9ic2VydmU6IChmKS0+XG4gICAgQF9tb2RlbC51bm9ic2VydmUgZlxuICAgIEBcblxuICAjXG4gICMgQG92ZXJsb2FkIHZhbCgpXG4gICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAjICAgQHJldHVybiBbSnNvbl1cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHJldHVybiBbKl0gRGVwZW5kcyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAjXG4gIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICBpZiBAX21vZGVsP1xuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXG4gICAgZWxzZVxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdXG4gICAgICBlbHNlXG4gICAgICAgIHJlcyA9IHt9XG4gICAgICAgIGZvciBuLHYgb2YgQF9vYmplY3RcbiAgICAgICAgICByZXNbbl0gPSB2XG4gICAgICAgIHJlc1xuXG4gIGRlbGV0ZTogKG5hbWUpLT5cbiAgICBAX21vZGVsLmRlbGV0ZShuYW1lKVxuICAgIEBcblxuaWYgd2luZG93P1xuICBpZiB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBmaXJzdCBpbXBvcnQgWSFcIlxuXG5pZiBtb2R1bGU/XG4gIG1vZHVsZS5leHBvcnRzID0gWU9iamVjdFxuIiwibW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgb3BzID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wcy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgaWYgY3VzdG9tX3R5cGU/XG4gICAgICAgIEBjdXN0b21fdHlwZSA9IGN1c3RvbV90eXBlXG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XG4gICAgICBpZiB1aWQ/XG4gICAgICAgIEB1aWQgPSB1aWRcblxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxuICAgICAgaWYgY29udGVudCBpcyB1bmRlZmluZWRcbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxuICAgICAgaWYgY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICBAY29udGVudF9vcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG5hbWUsIG9wIG9mIGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgIEBzYXZlT3BlcmF0aW9uIG5hbWUsIG9wLCAnY29udGVudF9vcGVyYXRpb25zJ1xuXG4gICAgdHlwZTogXCJPcGVyYXRpb25cIlxuXG4gICAgZ2V0Q29udGVudDogKG5hbWUpLT5cbiAgICAgIGlmIEBjb250ZW50P1xuICAgICAgICBpZiBAY29udGVudC5nZXRDdXN0b21UeXBlP1xuICAgICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBlbHNlIGlmIEBjb250ZW50LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGlmIG5hbWU/XG4gICAgICAgICAgICBpZiBAY29udGVudFtuYW1lXT9cbiAgICAgICAgICAgICAgQGNvbnRlbnRbbmFtZV1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9uc1tuYW1lXS5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjb250ZW50ID0ge31cbiAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRcbiAgICAgICAgICAgICAgY29udGVudFtuXSA9IHZcbiAgICAgICAgICAgIGlmIEBjb250ZW50X29wZXJhdGlvbnM/XG4gICAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgICAgICAgIHYgPSB2LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICAgICAgICAgIGNvbnRlbnRbbl0gPSB2XG4gICAgICAgICAgICBjb250ZW50XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBAY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcInN1YiBwcm9wZXJ0aWVzIGFyZSBub3QgZW5hYmxlIG9uIHRoaXMgb3BlcmF0aW9uIHR5cGUhXCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZVxuICAgIHVub2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBAZXZlbnRfbGlzdGVuZXJzLmZpbHRlciAoZyktPlxuICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgIyBUaGlzIHNob3VsZCBiZSBjYWxsZWQsIGUuZy4gYWZ0ZXIgdGhpcyBoYXMgYmVlbiByZXBsYWNlZC5cbiAgICAjIChUaGVuIG9ubHkgb25lIHJlcGxhY2UgZXZlbnQgc2hvdWxkIGZpcmUuIClcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxuICAgIGRlbGV0ZUFsbE9ic2VydmVyczogKCktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdXG5cbiAgICBkZWxldGU6ICgpLT5cbiAgICAgIChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIEApLmV4ZWN1dGUoKVxuICAgICAgbnVsbFxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cbiAgICAgICAgY2FsbG9uID0gQGdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZVxuICAgICAgICBjYWxsb24gPSBAXG4gICAgICBAZm9yd2FyZEV2ZW50IGNhbGxvbiwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBASEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxuICAgICAgQGRlbGV0ZUFsbE9ic2VydmVycygpXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEB1aWRcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXG4gICAgICAgICAgbWFwX3VpZCA9IEB1aWQuYWx0LmNsb25lVWlkKClcbiAgICAgICAgICBtYXBfdWlkLnN1YiA9IEB1aWQuc3ViXG4gICAgICAgICAgbWFwX3VpZFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbG9uZVVpZDogKCktPlxuICAgICAgdWlkID0ge31cbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXG4gICAgICAgIHVpZFtuXSA9IHZcbiAgICAgIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgICAgaWYgbm90IEB1aWQ/XG4gICAgICAgICAgIyBXaGVuIHRoaXMgb3BlcmF0aW9uIHdhcyBjcmVhdGVkIHdpdGhvdXQgYSB1aWQsIHRoZW4gc2V0IGl0IGhlcmUuXG4gICAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgICAjIGlzIGV4ZWN1dGVkIChiZWNhdXNlIHdlIG5lZWQgdGhlIGNyZWF0b3JfaWQpXG4gICAgICAgICAgQHVpZCA9IEBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICAgIEBIQi5hZGRPcGVyYXRpb24gQFxuICAgICAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICAgIEBcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3AsIGJhc2UgPSBcInRoaXNcIiktPlxuICAgICAgaWYgb3A/IGFuZCBvcC5fZ2V0TW9kZWw/XG4gICAgICAgIG9wID0gb3AuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG5vdCBvcD9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgb3AuZXhlY3V0ZT8gb3Igbm90IChvcC5vcF9udW1iZXI/IGFuZCBvcC5jcmVhdG9yPylcbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWQsIG9yIG9wIGlzIHN0cmluZy4gQ3VycmVudGx5IFwiRGVsaW1pdGVyXCIgaXMgc2F2ZWQgYXMgc3RyaW5nXG4gICAgICAgICMgKGluIGNvbWJpbmF0aW9uIHdpdGggQHBhcmVudCB5b3UgY2FuIHJldHJpZXZlIHRoZSBkZWxpbWl0ZXIuLilcbiAgICAgICAgaWYgYmFzZSBpcyBcInRoaXNcIlxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgZGVzdCA9IEBbYmFzZV1cbiAgICAgICAgICBwYXRocyA9IG5hbWUuc3BsaXQoXCIvXCIpXG4gICAgICAgICAgbGFzdF9wYXRoID0gcGF0aHMucG9wKClcbiAgICAgICAgICBmb3IgcGF0aCBpbiBwYXRoc1xuICAgICAgICAgICAgZGVzdCA9IGRlc3RbcGF0aF1cbiAgICAgICAgICBkZXN0W2xhc3RfcGF0aF0gPSBvcFxuICAgICAgZWxzZVxuICAgICAgICAjIG5vdCBpbml0aWFsaXplZC4gRG8gaXQgd2hlbiBjYWxsaW5nICR2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXSA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW2Jhc2VdW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gdHJ1ZVxuICAgICAgZm9yIGJhc2VfbmFtZSwgYmFzZSBvZiBAdW5jaGVja2VkXG4gICAgICAgIGZvciBuYW1lLCBvcF91aWQgb2YgYmFzZVxuICAgICAgICAgIG9wID0gQEhCLmdldE9wZXJhdGlvbiBvcF91aWRcbiAgICAgICAgICBpZiBvcFxuICAgICAgICAgICAgaWYgYmFzZV9uYW1lIGlzIFwidGhpc1wiXG4gICAgICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICBkZXN0ID0gQFtiYXNlX25hbWVdXG4gICAgICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcbiAgICAgICAgICAgICAgbGFzdF9wYXRoID0gcGF0aHMucG9wKClcbiAgICAgICAgICAgICAgZm9yIHBhdGggaW4gcGF0aHNcbiAgICAgICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxuICAgICAgICAgICAgICBkZXN0W2xhc3RfcGF0aF0gPSBvcFxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV0gPz0ge31cbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV1bbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgaWYgbm90IHN1Y2Nlc3NcbiAgICAgICAgQHVuY2hlY2tlZCA9IHVuaW5zdGFudGlhdGVkXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBkZWxldGUgQHVuY2hlY2tlZFxuICAgICAgICByZXR1cm4gQFxuXG4gICAgZ2V0Q3VzdG9tVHlwZTogKCktPlxuICAgICAgaWYgbm90IEBjdXN0b21fdHlwZT9cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXG4gICAgICAgIEBcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xuICAgICAgICAgICMgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldCAob25seSB0aGUgbmFtZSBpcyBzcGVjaWZpZWQpXG4gICAgICAgICAgVHlwZSA9IEBjdXN0b21fdHlwZXNcbiAgICAgICAgICBmb3IgdCBpbiBAY3VzdG9tX3R5cGUuc3BsaXQoXCIuXCIpXG4gICAgICAgICAgICBUeXBlID0gVHlwZVt0XVxuICAgICAgICAgIEBjdXN0b21fdHlwZSA9IG5ldyBUeXBlKClcbiAgICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcbiAgICAgICAgQGN1c3RvbV90eXBlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi50eXBlID0gQHR5cGVcbiAgICAgIGpzb24udWlkID0gQGdldFVpZCgpXG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XG4gICAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlLl9uYW1lXG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb24uY29udGVudCA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29udGVudCA9IEBjb250ZW50XG4gICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICBvcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG4sbyBvZiBAY29udGVudF9vcGVyYXRpb25zXG4gICAgICAgICAgaWYgby5fZ2V0TW9kZWw/XG4gICAgICAgICAgICBvID0gby5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgICAgb3BlcmF0aW9uc1tuXSA9IG8uZ2V0VWlkKClcbiAgICAgICAganNvbi5jb250ZW50X29wZXJhdGlvbnMgPSBvcGVyYXRpb25zXG4gICAgICBqc29uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIG9wcy5EZWxldGUucGFyc2UgPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkICh1bmltcGxlbWVudGVkLCBnb29kIGlkZWE/KVxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3Mgb3BzLkluc2VydCBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zLCBwYXJlbnQsIHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgIHZhbDogKCktPlxuICAgICAgQGdldENvbnRlbnQoKVxuXG4gICAgZ2V0TmV4dDogKGk9MSktPlxuICAgICAgbiA9IEBcbiAgICAgIHdoaWxlIGkgPiAwIGFuZCBuLm5leHRfY2w/XG4gICAgICAgIG4gPSBuLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG4uaXNfZGVsZXRlZFxuICAgICAgICAgIGktLVxuICAgICAgaWYgbi5pc19kZWxldGVkXG4gICAgICAgIG51bGxcbiAgICAgIG5cblxuICAgIGdldFByZXY6IChpPTEpLT5cbiAgICAgIG4gPSBAXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5wcmV2X2NsP1xuICAgICAgICBuID0gbi5wcmV2X2NsXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpLS1cbiAgICAgIGlmIG4uaXNfZGVsZXRlZFxuICAgICAgICBudWxsXG4gICAgICBlbHNlXG4gICAgICAgIG5cblxuICAgICNcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBjYWxsTGF0ZXIgPSBmYWxzZVxuICAgICAgaWYgQHBhcmVudD8gYW5kIG5vdCBAaXNfZGVsZXRlZCBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIGNhbGxMYXRlclxuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyh0aGlzLCBvKVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAcHJldl9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgICMgZGVsZXRlIGFsbCBvcHMgdGhhdCBkZWxldGUgdGhpcyBpbnNlcnRpb25cbiAgICAgICAgZm9yIGQgaW4gQGRlbGV0ZWRfYnlcbiAgICAgICAgICBkLmNsZWFudXAoKVxuXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwicmlnaHQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXG4gICAgICAgICMgY2hhbmdlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxuICAgICAgICBvID0gQG5leHRfY2xcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcbiAgICAgICAgICAgIG8ub3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxuXG4gICAgICAgICMgZGVsZXRlIGNvbnRlbnRcbiAgICAgICAgIyAtIHdlIG11c3Qgbm90IGRvIHRoaXMgaW4gYXBwbHlEZWxldGUsIGJlY2F1c2UgdGhpcyB3b3VsZCBsZWFkIHRvIGluY29uc2lzdGVuY2llc1xuICAgICAgICAjIChlLmcuIHRoZSBmb2xsb3dpbmcgb3BlcmF0aW9uIG9yZGVyIG11c3QgYmUgaW52ZXJ0aWJsZSA6XG4gICAgICAgICMgICBJbnNlcnQgcmVmZXJzIHRvIGNvbnRlbnQsIHRoZW4gdGhlIGNvbnRlbnQgaXMgZGVsZXRlZClcbiAgICAgICAgIyBUaGVyZWZvcmUsIHdlIGhhdmUgdG8gZG8gdGhpcyBpbiB0aGUgY2xlYW51cFxuICAgICAgICAjICogTk9ERTogV2UgbmV2ZXIgZGVsZXRlIEluc2VydGlvbnMhXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvbiBhbmQgbm90IChAY29udGVudCBpbnN0YW5jZW9mIG9wcy5JbnNlcnQpXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieS0tXG4gICAgICAgICAgaWYgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA8PSAwIGFuZCBub3QgQGNvbnRlbnQuaXNfZGVsZXRlZFxuICAgICAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgICBkZWxldGUgQGNvbnRlbnRcbiAgICAgICAgc3VwZXJcbiAgICAgICMgZWxzZVxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAICMgVE9ETzogdGhpcyBpcyBwcm9iYWJseSBub3QgbmVjZXNzYXJ5IGFuZCBvbmx5IG5pY2UgZm9yIGRlYnVnZ2luZ1xuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnkgPz0gMFxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnkrK1xuICAgICAgICBpZiBAcGFyZW50P1xuICAgICAgICAgIGlmIG5vdCBAcHJldl9jbD9cbiAgICAgICAgICAgIEBwcmV2X2NsID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG9yaWdpbj9cbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIGVsc2UgaWYgQG9yaWdpbiBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgICAgICBAb3JpZ2luID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG5leHRfY2w/XG4gICAgICAgICAgICBAbmV4dF9jbCA9IEBwYXJlbnQuZW5kXG4gICAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IEBnZXREaXN0YW5jZVRvT3JpZ2luKCkgIyBtb3N0IGNhc2VzOiAwXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBpID0gZGlzdGFuY2VfdG9fb3JpZ2luICMgbG9vcCBjb3VudGVyXG5cbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgICAgICMgICAgICAgICBsZXQgJE9MPSBbbzEsbzIsbzMsbzRdLCB3aGVyZWJ5ICR0aGlzIGlzIHRvIGJlIGluc2VydGVkIGJldHdlZW4gbzEgYW5kIG80XG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICAgICAjICAgICAgICAgdGhlbiBvMiBrbm93cyBvMy4gU2luY2Ugb24gYW5vdGhlciBjbGllbnQgJE9MIGNvdWxkIGJlIFtvMSxvMyxvNF0gdGhlIHByb2JsZW0gaXMgY29tcGxleFxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgIGlmIGN1cnJlbnQgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uID4gJG8gb3JpZ2luOiAkdGhpcyBpbnNcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxuICAgICAgICAgICMgICAgICAgICAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgICAgICMgY2FzZSAzOiAkb3JpZ2luID4gJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcblxuICAgICAgICBAc2V0UGFyZW50IEBwcmV2X2NsLmdldFBhcmVudCgpICMgZG8gSW5zZXJ0aW9ucyBhbHdheXMgaGF2ZSBhIHBhcmVudD9cbiAgICAgICAgc3VwZXIgIyBub3RpZnkgdGhlIGV4ZWN1dGlvbl9saXN0ZW5lcnNcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHModGhpcylcbiAgICAgICAgQFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi5wcmV2ID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGpzb24ubmV4dCA9IEBuZXh0X2NsLmdldFVpZCgpXG5cbiAgICAgIGlmIEBvcmlnaW4udHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIGpzb24ub3JpZ2luID0gXCJEZWxpbWl0ZXJcIlxuICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbi5vcmlnaW4gPSBAb3JpZ2luLmdldFVpZCgpXG5cbiAgICAgICMgaWYgbm90IChqc29uLnByZXY/IGFuZCBqc29uLm5leHQ/KVxuICAgICAganNvbi5wYXJlbnQgPSBAcGFyZW50LmdldFVpZCgpXG5cbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuSW5zZXJ0LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzIG51bGwsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucywgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIG9wcy5EZWxpbWl0ZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBudWxsLCB7bm9PcGVyYXRpb246IHRydWV9XG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xuICAgICAgICBzdXBlclxuICAgICAgI2Vsc2VcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAnb3BlcmF0aW9ucycgOiBvcHNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG4iLCJiYXNpY19vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gIGJhc2ljX29wcyA9IGJhc2ljX29wc191bmluaXRpYWxpemVkKClcbiAgb3BzID0gYmFzaWNfb3BzLm9wZXJhdGlvbnNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3Mgb3BzLk1hcE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XG4gICAgICBAX21hcCA9IHt9XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgZm9yIG5hbWUscCBvZiBAX21hcFxuICAgICAgICBwLmFwcGx5RGVsZXRlKClcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIG1hcDogKGYpLT5cbiAgICAgIGZvciBuLHYgb2YgQF9tYXBcbiAgICAgICAgZihuLHYpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEBzZWUgSnNvbk9wZXJhdGlvbnMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGFyZ3VtZW50cy5sZW5ndGggPiAxXG4gICAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50Ll9nZXRNb2RlbD9cbiAgICAgICAgICByZXAgPSBjb250ZW50Ll9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHJlcCA9IGNvbnRlbnRcbiAgICAgICAgQHJldHJpZXZlU3ViKG5hbWUpLnJlcGxhY2UgcmVwXG4gICAgICAgIEBnZXRDdXN0b21UeXBlKClcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgcHJvcCA9IEBfbWFwW25hbWVdXG4gICAgICAgIGlmIHByb3A/IGFuZCBub3QgcHJvcC5pc0NvbnRlbnREZWxldGVkKClcbiAgICAgICAgICByZXMgPSBwcm9wLnZhbCgpXG4gICAgICAgICAgaWYgcmVzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgICAgcmVzLmdldEN1c3RvbVR5cGUoKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJlc1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQF9tYXBcbiAgICAgICAgICBpZiBub3Qgby5pc0NvbnRlbnREZWxldGVkKClcbiAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG8udmFsKClcbiAgICAgICAgcmVzdWx0XG5cbiAgICBkZWxldGU6IChuYW1lKS0+XG4gICAgICBAX21hcFtuYW1lXT8uZGVsZXRlQ29udGVudCgpXG4gICAgICBAXG5cbiAgICByZXRyaWV2ZVN1YjogKHByb3BlcnR5X25hbWUpLT5cbiAgICAgIGlmIG5vdCBAX21hcFtwcm9wZXJ0eV9uYW1lXT9cbiAgICAgICAgZXZlbnRfcHJvcGVydGllcyA9XG4gICAgICAgICAgbmFtZTogcHJvcGVydHlfbmFtZVxuICAgICAgICBldmVudF90aGlzID0gQFxuICAgICAgICBybV91aWQgPVxuICAgICAgICAgIG5vT3BlcmF0aW9uOiB0cnVlXG4gICAgICAgICAgc3ViOiBwcm9wZXJ0eV9uYW1lXG4gICAgICAgICAgYWx0OiBAXG4gICAgICAgIHJtID0gbmV3IG9wcy5SZXBsYWNlTWFuYWdlciBudWxsLCBldmVudF9wcm9wZXJ0aWVzLCBldmVudF90aGlzLCBybV91aWQgIyB0aGlzIG9wZXJhdGlvbiBzaGFsbCBub3QgYmUgc2F2ZWQgaW4gdGhlIEhCXG4gICAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdID0gcm1cbiAgICAgICAgcm0uc2V0UGFyZW50IEAsIHByb3BlcnR5X25hbWVcbiAgICAgICAgcm0uZXhlY3V0ZSgpXG4gICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXVxuXG4gIG9wcy5NYXBNYW5hZ2VyLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2N1c3RvbV90eXBlJyA6IGN1c3RvbV90eXBlXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKVxuXG5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBvcHMuTGlzdE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cbiAgICAgIEBiZWdpbm5pbmcgPSBuZXcgb3BzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgQGVuZCA9ICAgICAgIG5ldyBvcHMuRGVsaW1pdGVyIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgQGJlZ2lubmluZy5leGVjdXRlKClcbiAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiTGlzdE1hbmFnZXJcIlxuXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cblxuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGZvciBpLCBvIGluIHZhbFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLk9iamVjdFxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2Ygb3BzLkxpc3RNYW5hZ2VyXG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggby52YWwoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIG1hcDogKGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggZihvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIGZvbGQ6IChpbml0LCBmKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgaW5pdCA9IGYoaW5pdCwgbylcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgaW5pdFxuXG4gICAgdmFsOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgQHRvQXJyYXkoKVxuXG4gICAgcmVmOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcbiAgICAgICAgICBvXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBudWxsXG4gICAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwieW91IG11c3Qgc3BlY2lmeSBhIHBvc2l0aW9uIHBhcmFtZXRlclwiXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIFtjb250ZW50XVxuXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50cyktPlxuICAgICAgcmlnaHQgPSBsZWZ0Lm5leHRfY2xcbiAgICAgIHdoaWxlIHJpZ2h0LmlzRGVsZXRlZCgpXG4gICAgICAgIHJpZ2h0ID0gcmlnaHQubmV4dF9jbCAjIGZpbmQgdGhlIGZpcnN0IGNoYXJhY3RlciB0byB0aGUgcmlnaHQsIHRoYXQgaXMgbm90IGRlbGV0ZWQuIEluIHRoZSBjYXNlIHRoYXQgcG9zaXRpb24gaXMgMCwgaXRzIHRoZSBEZWxpbWl0ZXIuXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxuXG4gICAgICAjIFRPRE86IGFsd2F5cyBleHBlY3QgYW4gYXJyYXkgYXMgY29udGVudC4gVGhlbiB5b3UgY2FuIGNvbWJpbmUgdGhpcyB3aXRoIHRoZSBvdGhlciBvcHRpb24gKGVsc2UpXG4gICAgICBpZiBjb250ZW50cyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIG51bGwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICBlbHNlXG4gICAgICAgIGZvciBjIGluIGNvbnRlbnRzXG4gICAgICAgICAgaWYgYz8gYW5kIGMuX25hbWU/IGFuZCBjLl9nZXRNb2RlbD9cbiAgICAgICAgICAgIGMgPSBjLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgICB0bXAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgYywgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgICAgICBsZWZ0ID0gdG1wXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGFuIGFycmF5IG9mIGNvbnRlbnQgaW50byB0aGlzIGxpc3QuXG4gICAgIyBATm90ZTogVGhpcyBleHBlY3RzIGFuIGFycmF5IGFzIGNvbnRlbnQhXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudHMpLT5cbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICAgQGluc2VydEFmdGVyIGl0aCwgY29udGVudHNcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdFxuICAgICNcbiAgICBkZWxldGU6IChwb3NpdGlvbiwgbGVuZ3RoID0gMSktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvc2l0aW9uKzEpICMgcG9zaXRpb24gMCBpbiB0aGlzIGNhc2UgaXMgdGhlIGRlbGV0aW9uIG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXJcblxuICAgICAgZGVsZXRlX29wcyA9IFtdXG4gICAgICBmb3IgaSBpbiBbMC4uLmxlbmd0aF1cbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgKG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBAXG5cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wKS0+XG4gICAgICBnZXRDb250ZW50VHlwZSA9IChjb250ZW50KS0+XG4gICAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNvbnRlbnRcbiAgICAgIEBjYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImluc2VydFwiXG4gICAgICAgIHJlZmVyZW5jZTogb3BcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgIGNoYW5nZWRCeTogb3AudWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIG9wLnZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICByZWZlcmVuY2U6IG9wXG4gICAgICAgIHBvc2l0aW9uOiBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQGdldEN1c3RvbVR5cGUoKSAjIFRPRE86IFlvdSBjYW4gY29tYmluZSBnZXRQb3NpdGlvbiArIGdldFBhcmVudCBpbiBhIG1vcmUgZWZmaWNpZW50IG1hbm5lciEgKG9ubHkgbGVmdCBEZWxpbWl0ZXIgd2lsbCBob2xkIEBwYXJlbnQpXG4gICAgICAgIGxlbmd0aDogMVxuICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICBvbGRWYWx1ZTogb3AudmFsKClcbiAgICAgIF1cblxuICBvcHMuTGlzdE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuICBjbGFzcyBvcHMuQ29tcG9zaXRpb24gZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcblxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBfY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgdG1wX2NvbXBvc2l0aW9uX3JlZiktPlxuICAgICAgIyB3ZSBjYW4ndCB1c2UgQHNldmVPcGVyYXRpb24gJ2NvbXBvc2l0aW9uX3JlZicsIHRtcF9jb21wb3NpdGlvbl9yZWYgaGVyZSxcbiAgICAgICMgYmVjYXVzZSB0aGVuIHRoZXJlIGlzIGEgXCJsb29wXCIgKGluc2VydGlvbiByZWZlcnMgdG8gcGFyZW50LCByZWZlcnMgdG8gaW5zZXJ0aW9uLi4pXG4gICAgICAjIFRoaXMgaXMgd2h5IHdlIGhhdmUgdG8gY2hlY2sgaW4gQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyB1bnRpbCB3ZSBmaW5kIGl0XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG4gICAgICBpZiB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBAdG1wX2NvbXBvc2l0aW9uX3JlZiA9IHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxuICAgICAgaWYgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucz9cbiAgICAgICAgQGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuLCBvLCAnX2NvbXBvc2l0aW9uX3ZhbHVlJ1xuXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl9zZXRDb21wb3NpdGlvblZhbHVlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgZGVsZXRlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgIyBjaGVjayBpZiB0bXBfY29tcG9zaXRpb25fcmVmIGFscmVhZHkgZXhpc3RzXG4gICAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICAgICAgY29tcG9zaXRpb25fcmVmID0gQEhCLmdldE9wZXJhdGlvbiBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIGlmIGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IGNvbXBvc2l0aW9uX3JlZlxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC1vcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBpZiBvcC51aWQuY3JlYXRvciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5jcmVhdG9yIGFuZCBvcC51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxuICAgICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBvcFxuICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIG9wID0gb3AubmV4dF9jbFxuICAgICAgICAgIGlmIG9wIGlzIEBlbmRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmV0dXJuXG5cbiAgICAgIG8gPSBAZW5kLnByZXZfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBvcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl91bmFwcGx5IG8udW5kb19kZWx0YVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBvLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBAZW5kLnByZXZfY2xcblxuICAgICAgQGNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBuZXdWYWx1ZTogQHZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICByZXR1cm5cblxuICAgICNcbiAgICAjIENyZWF0ZSBhIG5ldyBEZWx0YVxuICAgICMgLSBpbnNlcnRzIG5ldyBDb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fdmFsdWVcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fcmVmXG4gICAgI1xuICAgICMgQHBhcmFtIGRlbHRhIFRoZSBkZWx0YSB0aGF0IGlzIGFwcGxpZWQgdG8gdGhlIGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgI1xuICAgIGFwcGx5RGVsdGE6IChkZWx0YSwgb3BlcmF0aW9ucyktPlxuICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGRlbHRhLCBvcGVyYXRpb25zLCBALCBudWxsLCBAZW5kLnByZXZfY2wsIEBlbmQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBjdXN0b20gPSBAZ2V0Q3VzdG9tVHlwZSgpLl9nZXRDb21wb3NpdGlvblZhbHVlKClcbiAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWUgPSBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVcbiAgICAgIGlmIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxuICAgICAgaWYgQGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29tcG9zaXRpb25fcmVmID0gQHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuQ29tcG9zaXRpb24ucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICAnY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucycgOiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAnY29tcG9zaXRpb25fcmVmJyA6IGNvbXBvc2l0aW9uX3JlZlxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIGNvbXBvc2l0aW9uX3ZhbHVlLCBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zLCB1aWQsIGNvbXBvc2l0aW9uX3JlZilcblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkKS0+XG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xuICAgICAgICBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10gPSBAZXZlbnRfdGhpcy5nZXRDdXN0b21UeXBlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcC5wcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBvcC5pc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBvcC5wcmV2X2NsLnZhbCgpXG4gICAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgICAgICBvbGRWYWx1ZTogb2xkX3ZhbHVlXG4gICAgICAgICAgXVxuICAgICAgICBvcC5wcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgb3AubmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBvcC5hcHBseURlbGV0ZSgpXG4gICAgICBlbHNlICMgcHJldiBfYW5kXyBuZXh0IGFyZSBEZWxpbWl0ZXJzLiBUaGlzIGlzIHRoZSBmaXJzdCBjcmVhdGVkIFJlcGxhY2VhYmxlIGluIHRoZSBSTVxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIEBjYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBvcC52YWwoKVxuICAgICAgICBdXG5cblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIG51bGwsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIGxhc3Rfb3AgPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBpZiAobm90IGxhc3Rfb3AuaXNEZWxldGVkKCkpIGFuZCBsYXN0X29wLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgIChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cblxuXG4gIGJhc2ljX29wc1xuIiwiXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcblxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XG4gIGlmIGNvbm5lY3Rvci51c2VyX2lkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLndoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVycyA9IFsoc3RhdGVfdmVjdG9yKS0+XG4gICAgICAgIEhCLnNldFVzZXJJZCB0aGlzLnVzZXJfaWQsIHN0YXRlX3ZlY3RvclxuICAgICAgXVxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgb3BzX21hbmFnZXIgPSBzdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkIEhCLCB0aGlzLmNvbnN0cnVjdG9yXG4gIG9wcyA9IG9wc19tYW5hZ2VyLm9wZXJhdGlvbnNcblxuICBlbmdpbmUgPSBuZXcgRW5naW5lIEhCLCBvcHNcbiAgYWRhcHRDb25uZWN0b3IgY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBvcHNfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcblxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5IQiA9IEhCXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLm9wZXJhdGlvbnMgPSBvcHNcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuZW5naW5lID0gZW5naW5lXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmNvbm5lY3RvciA9IGNvbm5lY3RvclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jdXN0b21fdHlwZXMgPSB0aGlzLmNvbnN0cnVjdG9yXG5cbiAgY3QgPSBuZXcgY3JlYXRlWS5PYmplY3QoKVxuICBtb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihjdCwgSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxuICBjdC5fc2V0TW9kZWwgbW9kZWxcbiAgY3RcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZXG5pZiB3aW5kb3c/XG4gIHdpbmRvdy5ZID0gY3JlYXRlWVxuXG5jcmVhdGVZLk9iamVjdCA9IHJlcXVpcmUgXCIuL09iamVjdFR5cGVcIlxuIl19
