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
            if (o !== this.next_cl) {
              oDistance = o.getDistanceToOrigin();
              if (oDistance === i) {
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
      this.shortTree = new RBTreeByIndex();
      this.completeTree = new RBTreeByIndex();
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

    ListManager.prototype.getNextNonDeleted = function(start) {
      var operation;
      if (start.isDeleted() || (start.node == null)) {
        operation = start.next_cl;
        while (!(operation instanceof ops.Delimiter)) {
          if (operation.is_deleted) {
            operation = operation.next_cl;
          } else {
            break;
          }
        }
      } else {
        operation = start.node.next.node;
        if (!operation) {
          return false;
        }
      }
      return operation;
    };

    ListManager.prototype.getPrevNonDeleted = function(start) {
      var operation;
      if (start.isDeleted() || (start.node == null)) {
        operation = start.prev_cl;
        while (!(operation instanceof ops.Delimiter)) {
          if (operation.is_deleted) {
            operation = operation.prev_cl;
          } else {
            break;
          }
        }
      } else {
        operation = start.node.prev.node;
        if (!operation) {
          return false;
        }
      }
      return operation;
    };

    ListManager.prototype.toArray = function() {
      return this.shortTree.map(function(operation) {
        return operation.val();
      });
    };

    ListManager.prototype.map = function(fun) {
      return this.shortTree.map(fun);
    };

    ListManager.prototype.fold = function(init, fun) {
      return this.shortTree.map(function(operation) {
        return init = fun(init, operation);
      });
    };

    ListManager.prototype.val = function(pos) {
      if (pos != null) {
        return this.shortTree.find(pos).val();
      } else {
        return this.toArray();
      }
    };

    ListManager.prototype.ref = function(pos) {
      if (pos != null) {
        return this.shortTree.find(pos);
      } else {
        return this.shortTree.map(function(operation) {
          return operation;
        });
      }
    };

    ListManager.prototype.getOperationByPosition = function(position) {
      if (position === 0) {
        return this.beginning;
      } else if (position === this.shortTree.size + 1) {
        return this.end;
      } else {
        return this.shortTree.find(position - 1);
      }
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
      var c, leftNode, right, rightNode, tmp, _i, _len;
      if (left === this.beginning) {
        leftNode = null;
        rightNode = this.shortTree.findNode(0);
        right = rightNode ? rightNode.data : this.end;
      } else {
        rightNode = left.node.next;
        leftNode = left.node;
        right = rightNode ? rightNode.data : this.end;
      }
      left = right.prev_cl;
      if (contents instanceof ops.Operation) {
        tmp = new ops.Insert(null, content, null, void 0, void 0, left, right);
        tmp.execute();
      } else {
        for (_i = 0, _len = contents.length; _i < _len; _i++) {
          c = contents[_i];
          if ((c != null) && (c._name != null) && (c._getModel != null)) {
            c = c._getModel(this.custom_types, this.operations);
          }
          tmp = new ops.Insert(null, c, null, void 0, void 0, left, right);
          tmp.execute();
          leftNode = tmp.node;
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

    ListManager.prototype.deleteRef = function(operation, length, dir) {
      var deleteOperation, i, nextOperation, _i;
      if (length == null) {
        length = 1;
      }
      if (dir == null) {
        dir = 'right';
      }
      nextOperation = (function(_this) {
        return function(operation) {
          if (dir === 'right') {
            return _this.getNextNonDeleted(operation);
          } else {
            return _this.getPrevNonDeleted(operation);
          }
        };
      })(this);
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (operation instanceof ops.Delimiter) {
          break;
        }
        deleteOperation = (new ops.Delete(null, void 0, operation)).execute();
        operation = nextOperation(operation);
      }
      return this;
    };

    ListManager.prototype["delete"] = function(position, length) {
      var operation;
      if (length == null) {
        length = 1;
      }
      operation = this.getOperationByPosition(position + length);
      return this.deleteRef(operation, length, 'left');
    };

    ListManager.prototype.callOperationSpecificInsertEvents = function(operation) {
      var getContentType, next, nextNode, prev, prevNode;
      prev = (this.getPrevNonDeleted(operation)) || this.beginning;
      prevNode = prev ? prev.node : null;
      next = (this.getNextNonDeleted(operation)) || this.end;
      nextNode = next ? next.node : null;
      operation.node = operation.node || (this.shortTree.insert_between(prevNode, nextNode, operation));
      operation.completeNode = operation.completeNode || (this.completeTree.insert_between(operation.prev_cl.completeNode, operation.next_cl.completeNode, operation));
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
          reference: operation,
          position: operation.node.position(),
          object: this.getCustomType(),
          changedBy: operation.uid.creator,
          value: getContentType(operation.val())
        }
      ]);
    };

    ListManager.prototype.callOperationSpecificDeleteEvents = function(operation, del_op) {
      var position;
      if (operation.node) {
        position = operation.node.position();
        this.shortTree.remove_node(operation.node);
        operation.node = null;
      }
      return this.callEvent([
        {
          type: "delete",
          reference: operation,
          position: position,
          object: this.getCustomType(),
          length: 1,
          changedBy: del_op.uid.creator,
          oldValue: operation.val()
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

    Composition.prototype.callOperationSpecificInsertEvents = function(operation) {
      var o;
      if (this.tmp_composition_ref != null) {
        if (operation.uid.creator === this.tmp_composition_ref.creator && operation.uid.op_number === this.tmp_composition_ref.op_number) {
          this.composition_ref = operation;
          delete this.tmp_composition_ref;
          operation = operation.next_cl;
          if (operation === this.end) {
            return;
          }
        } else {
          return;
        }
      }
      o = this.end.prev_cl;
      while (o !== operation) {
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
          changedBy: operation.uid.creator,
          newValue: this.val()
        }
      ]);
    };

    Composition.prototype.callOperationSpecificDeleteEvents = function(operation, del_op) {};

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

    ReplaceManager.prototype.callOperationSpecificInsertEvents = function(operation) {
      var old_value;
      if (operation.next_cl.type === "Delimiter" && operation.prev_cl.type !== "Delimiter") {
        if (!operation.is_deleted) {
          old_value = operation.prev_cl.val();
          this.callEventDecorator([
            {
              type: "update",
              changedBy: operation.uid.creator,
              oldValue: old_value
            }
          ]);
        }
        operation.prev_cl.applyDelete();
      } else if (operation.next_cl.type !== "Delimiter") {
        operation.applyDelete();
      } else {
        this.callEventDecorator([
          {
            type: "add",
            changedBy: operation.uid.creator
          }
        ]);
      }
      return void 0;
    };

    ReplaceManager.prototype.callOperationSpecificDeleteEvents = function(operation, del_op) {
      if (operation.next_cl.type === "Delimiter") {
        return this.callEventDecorator([
          {
            type: "delete",
            changedBy: del_op.uid.creator,
            oldValue: operation.val()
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
    this._nil = new Node('nil');
    this._nil.red = false;
    this._nil.weight = 0;

    Object.defineProperty(this, 'size', {
        get: function() {
            return this._root ? this._root.weight : 0;
        }
    });
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

    this.insert_correction(newNode);
  } else if (onRight && !onRight.left) {
    onRight.left = newNode;
    newNode.parent = onRight;

    this.insert_correction(newNode);
  } else {
    this.insert_node(0, newNode);
  }
  newNode.traverse_up(function(node, parent) {
    parent.weight = (parent.left ? parent.left.weight : 0) +
        (parent.right ? parent.right.weight : 0) + 1;
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
    nextNode = nodeToRemove.getNext(function(node) {
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
  node.traverse_up(function(node, parent) {
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

      neighbor.red = parent? parent.red: false;
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


function Node(data, name) {
    this._dataBindName = name || 'node';
    this._data = data;

    this.left = null;
    this.right = null;
    this.parent = null;
    this.red = true;
    this.weight = 1;

    Object.defineProperty(this, 'next', {
        get: function() {
            return this.getNext();
        }
    });
    Object.defineProperty(this, 'prev', {
        get: function() {
            return this.getPrev();
        }
    });

    Object.defineProperty(this, 'data', {
        get: function() {
            return this._data;
        },
        set: function(data) {
            this._data = data;
            // bind the data to this
            data[this._dataBindName] = this;
        }
    });

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

Node.prototype.getNext = function(fun) {
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
Node.prototype.getPrev = function(fun) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NjYy8yL3lqcy9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jY2MvMi95anMvbGliL0Nvbm5lY3RvckFkYXB0ZXIuY29mZmVlIiwiL2hvbWUvY2NjLzIveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jY2MvMi95anMvbGliL0VuZ2luZS5jb2ZmZWUiLCIvaG9tZS9jY2MvMi95anMvbGliL0hpc3RvcnlCdWZmZXIuY29mZmVlIiwiL2hvbWUvY2NjLzIveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2NjYy8yL3lqcy9saWIvT3BlcmF0aW9ucy9CYXNpYy5jb2ZmZWUiLCIvaG9tZS9jY2MvMi95anMvbGliL09wZXJhdGlvbnMvU3RydWN0dXJlZC5jb2ZmZWUiLCIvaG9tZS9jY2MvMi95anMvbGliL3kuY29mZmVlIiwiL2hvbWUvY2NjLzIveWpzL25vZGVfbW9kdWxlcy9iaW50cmVlcy9saWIvcmJ0cmVlX2J5X2luZGV4LmpzIiwiL2hvbWUvY2NjLzIveWpzL25vZGVfbW9kdWxlcy9iaW50cmVlcy9saWIvdHJlZWJhc2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNDQSxJQUFBLDhCQUFBOztBQUFBLGNBQUEsR0FBaUIsT0FBQSxDQUFRLGtCQUFSLENBQWpCLENBQUE7O0FBQUEsY0FNQSxHQUFpQixTQUFDLFNBQUQsRUFBWSxNQUFaLEVBQW9CLEVBQXBCLEVBQXdCLGtCQUF4QixHQUFBO0FBRWYsTUFBQSx1RkFBQTtBQUFBLE9BQUEsc0JBQUE7NkJBQUE7QUFDRSxJQUFBLFNBQVUsQ0FBQSxJQUFBLENBQVYsR0FBa0IsQ0FBbEIsQ0FERjtBQUFBLEdBQUE7QUFBQSxFQUdBLFNBQVMsQ0FBQyxhQUFWLENBQUEsQ0FIQSxDQUFBO0FBQUEsRUFLQSxLQUFBLEdBQVEs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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdnQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5Db25uZWN0b3JDbGFzcyA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckNsYXNzXCJcbiNcbiMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4jIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuI1xuYWRhcHRDb25uZWN0b3IgPSAoY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBleGVjdXRpb25fbGlzdGVuZXIpLT5cblxuICBmb3IgbmFtZSwgZiBvZiBDb25uZWN0b3JDbGFzc1xuICAgIGNvbm5lY3RvcltuYW1lXSA9IGZcblxuICBjb25uZWN0b3Iuc2V0SXNCb3VuZFRvWSgpXG5cbiAgc2VuZF8gPSAobyktPlxuICAgIGlmIChvLnVpZC5jcmVhdG9yIGlzIEhCLmdldFVzZXJJZCgpKSBhbmRcbiAgICAgICAgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKSBhbmQgIyBUT0RPOiBpIGRvbid0IHRoaW5rIHRoYXQgd2UgbmVlZCB0aGlzIGFueW1vcmUuLlxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cblxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIGdldEhCID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcbiAgICBqc29uID1cbiAgICAgIGhiOiBoYlxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgIGpzb25cblxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXG5cbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXG5cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMgPz0gW11cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXG5cblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvclxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9XG4gICNcbiAgIyBAcGFyYW1zIG5ldyBDb25uZWN0b3Iob3B0aW9ucylcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnN5bmNNZXRob2Qge1N0cmluZ30gIGlzIGVpdGhlciBcInN5bmNBbGxcIiBvciBcIm1hc3Rlci1zbGF2ZVwiLlxuICAjICAgQHBhcmFtIG9wdGlvbnMucm9sZSB7U3RyaW5nfSBUaGUgcm9sZSBvZiB0aGlzIGNsaWVudFxuICAjICAgICAgICAgICAgKHNsYXZlIG9yIG1hc3RlciAob25seSB1c2VkIHdoZW4gc3luY01ldGhvZCBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNZXRob2RcIiwgW1wic3luY0FsbFwiLCBcIm1hc3Rlci1zbGF2ZVwiXVxuICAgIHJlcSBcInJvbGVcIiwgW1wibWFzdGVyXCIsIFwic2xhdmVcIl1cbiAgICByZXEgXCJ1c2VyX2lkXCJcbiAgICBAb25fdXNlcl9pZF9zZXQ/KEB1c2VyX2lkKVxuXG4gICAgIyB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLlxuICAgICMgQnV0IHRoaXMgaXMgbm90IG5lY2Vzc2FyeSBpbiB0aGUgdGVzdC1jb25uZWN0b3JcbiAgICBpZiBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2Fpbj9cbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpblxuICAgIGVsc2VcbiAgICAgIEBwZXJmb3JtX3NlbmRfYWdhaW4gPSB0cnVlXG5cbiAgICAjIEEgTWFzdGVyIHNob3VsZCBzeW5jIHdpdGggZXZlcnlvbmUhIFRPRE86IHJlYWxseT8gLSBmb3Igbm93IGl0cyBzYWZlciB0aGlzIHdheSFcbiAgICBpZiBAcm9sZSBpcyBcIm1hc3RlclwiXG4gICAgICBAc3luY01ldGhvZCA9IFwic3luY0FsbFwiXG5cbiAgICAjIGlzIHNldCB0byB0cnVlIHdoZW4gdGhpcyBpcyBzeW5jZWQgd2l0aCBhbGwgb3RoZXIgY29ubmVjdGlvbnNcbiAgICBAaXNfc3luY2VkID0gZmFsc2VcbiAgICAjIFBlZXJqcyBDb25uZWN0aW9uczoga2V5OiBjb25uLWlkLCB2YWx1ZTogb2JqZWN0XG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIExpc3Qgb2YgZnVuY3Rpb25zIHRoYXQgc2hhbGwgcHJvY2VzcyBpbmNvbWluZyBkYXRhXG4gICAgQHJlY2VpdmVfaGFuZGxlcnMgPz0gW11cblxuICAgICMgd2hldGhlciB0aGlzIGluc3RhbmNlIGlzIGJvdW5kIHRvIGFueSB5IGluc3RhbmNlXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IG51bGxcbiAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSBmYWxzZVxuICAgIEBpc19pbml0aWFsaXplZCA9IHRydWVcblxuICBvblVzZXJFdmVudDogKGYpLT5cbiAgICBAY29ubmVjdGlvbnNfbGlzdGVuZXJzID89IFtdXG4gICAgQGNvbm5lY3Rpb25zX2xpc3RlbmVycy5wdXNoIGZcblxuICBpc1JvbGVNYXN0ZXI6IC0+XG4gICAgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuXG4gIGlzUm9sZVNsYXZlOiAtPlxuICAgIEByb2xlIGlzIFwic2xhdmVcIlxuXG4gIGZpbmROZXdTeW5jVGFyZ2V0OiAoKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgaWYgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGZvciB1c2VyLCBjIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBpZiBub3QgYy5pc19zeW5jZWRcbiAgICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgICAgIGJyZWFrXG4gICAgaWYgbm90IEBjdXJyZW50X3N5bmNfdGFyZ2V0P1xuICAgICAgQHNldFN0YXRlU3luY2VkKClcbiAgICBudWxsXG5cbiAgdXNlckxlZnQ6ICh1c2VyKS0+XG4gICAgZGVsZXRlIEBjb25uZWN0aW9uc1t1c2VyXVxuICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG4gICAgaWYgQGNvbm5lY3Rpb25zX2xpc3RlbmVycz9cbiAgICAgIGZvciBmIGluIEBjb25uZWN0aW9uc19saXN0ZW5lcnNcbiAgICAgICAgZiB7XG4gICAgICAgICAgYWN0aW9uOiBcInVzZXJMZWZ0XCJcbiAgICAgICAgICB1c2VyOiB1c2VyXG4gICAgICAgIH1cblxuXG4gIHVzZXJKb2luZWQ6ICh1c2VyLCByb2xlKS0+XG4gICAgaWYgbm90IHJvbGU/XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJbnRlcm5hbDogWW91IG11c3Qgc3BlY2lmeSB0aGUgcm9sZSBvZiB0aGUgam9pbmVkIHVzZXIhIEUuZy4gdXNlckpvaW5lZCgndWlkOjM5MzknLCdzbGF2ZScpXCJcbiAgICAjIGEgdXNlciBqb2luZWQgdGhlIHJvb21cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0gPz0ge31cbiAgICBAY29ubmVjdGlvbnNbdXNlcl0uaXNfc3luY2VkID0gZmFsc2VcblxuICAgIGlmIChub3QgQGlzX3N5bmNlZCkgb3IgQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCJcbiAgICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgICAjIFRPRE86IFdoYXQgaWYgdGhlcmUgYXJlIHR3byBtYXN0ZXJzPyBQcmV2ZW50IHNlbmRpbmcgZXZlcnl0aGluZyB0d28gdGltZXMhXG4gICAgICAgIEBwZXJmb3JtU3luY1dpdGhNYXN0ZXIgdXNlclxuXG4gICAgaWYgQGNvbm5lY3Rpb25zX2xpc3RlbmVycz9cbiAgICAgIGZvciBmIGluIEBjb25uZWN0aW9uc19saXN0ZW5lcnNcbiAgICAgICAgZiB7XG4gICAgICAgICAgYWN0aW9uOiBcInVzZXJKb2luZWRcIlxuICAgICAgICAgIHVzZXI6IHVzZXJcbiAgICAgICAgICByb2xlOiByb2xlXG4gICAgICAgIH1cblxuICAjXG4gICMgRXhlY3V0ZSBhIGZ1bmN0aW9uIF93aGVuXyB3ZSBhcmUgY29ubmVjdGVkLiBJZiBub3QgY29ubmVjdGVkLCB3YWl0IHVudGlsIGNvbm5lY3RlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIENvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgYXJncy5jb25zdHJ1Y3RvciBpcyBGdW5jdGlvblxuICAgICAgYXJncyA9IFthcmdzXVxuICAgIGlmIEBpc19zeW5jZWRcbiAgICAgIGFyZ3NbMF0uYXBwbHkgdGhpcywgYXJnc1sxLi5dXG4gICAgZWxzZVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkLnB1c2ggYXJnc1xuXG4gICNcbiAgIyBFeGVjdXRlIGFuIGZ1bmN0aW9uIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LiBmIHdpbGwgYmUgY2FsbGVkIHdpdGggKHNlbmRlcl9pZCwgYnJvYWRjYXN0IHt0cnVlfGZhbHNlfSwgbWVzc2FnZSkuXG4gICNcbiAgb25SZWNlaXZlOiAoZiktPlxuICAgIEByZWNlaXZlX2hhbmRsZXJzLnB1c2ggZlxuXG4gICMjI1xuICAjIEJyb2FkY2FzdCBhIG1lc3NhZ2UgdG8gYWxsIGNvbm5lY3RlZCBwZWVycy5cbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXG4gICNcbiAgYnJvYWRjYXN0OiAobWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcblxuICAjXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcbiAgI1xuICBzZW5kOiAocGVlcl9zLCBtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcbiAgIyMjXG5cbiAgI1xuICAjIHBlcmZvcm0gYSBzeW5jIHdpdGggYSBzcGVjaWZpYyB1c2VyLlxuICAjXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgICAgQHNlbmQgdXNlcixcbiAgICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgZGF0YTogQGdldFN0YXRlVmVjdG9yKClcbiAgICAgIGlmIG5vdCBAc2VudF9oYl90b19hbGxfdXNlcnNcbiAgICAgICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gdHJ1ZVxuXG4gICAgICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG5cblxuICAjXG4gICMgV2hlbiBhIG1hc3RlciBub2RlIGpvaW5lZCB0aGUgcm9vbSwgcGVyZm9ybSB0aGlzIHN5bmMgd2l0aCBoaW0uIEl0IHdpbGwgYXNrIHRoZSBtYXN0ZXIgZm9yIHRoZSBIQixcbiAgIyBhbmQgd2lsbCBicm9hZGNhc3QgaGlzIG93biBIQlxuICAjXG4gIHBlcmZvcm1TeW5jV2l0aE1hc3RlcjogKHVzZXIpLT5cbiAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICBAc2VuZCB1c2VyLFxuICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICBkYXRhOiBAZ2V0U3RhdGVWZWN0b3IoKVxuICAgIGhiID0gQGdldEhCKFtdKS5oYlxuICAgIF9oYiA9IFtdXG4gICAgZm9yIG8gaW4gaGJcbiAgICAgIF9oYi5wdXNoIG9cbiAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgX2hiID0gW11cbiAgICBAYnJvYWRjYXN0XG4gICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICBkYXRhOiBfaGJcblxuICAjXG4gICMgWW91IGFyZSBzdXJlIHRoYXQgYWxsIGNsaWVudHMgYXJlIHN5bmNlZCwgY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHNldFN0YXRlU3luY2VkOiAoKS0+XG4gICAgaWYgbm90IEBpc19zeW5jZWRcbiAgICAgIEBpc19zeW5jZWQgPSB0cnVlXG4gICAgICBpZiBAY29tcHV0ZV93aGVuX3N5bmNlZD9cbiAgICAgICAgZm9yIGVsIGluIEBjb21wdXRlX3doZW5fc3luY2VkXG4gICAgICAgICAgZiA9IGVsWzBdXG4gICAgICAgICAgYXJncyA9IGVsWzEuLl1cbiAgICAgICAgICBmLmFwcGx5KGFyZ3MpXG4gICAgICAgIGRlbGV0ZSBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgbnVsbFxuXG4gICMgZXhlY3V0ZWQgd2hlbiB0aGUgYSBzdGF0ZV92ZWN0b3IgaXMgcmVjZWl2ZWQuIGxpc3RlbmVyIHdpbGwgYmUgY2FsbGVkIG9ubHkgb25jZSFcbiAgd2hlblJlY2VpdmVkU3RhdGVWZWN0b3I6IChmKS0+XG4gICAgQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVycyA/PSBbXVxuICAgIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnMucHVzaCBmXG5cblxuICAjXG4gICMgWW91IHJlY2VpdmVkIGEgcmF3IG1lc3NhZ2UsIGFuZCB5b3Uga25vdyB0aGF0IGl0IGlzIGludGVuZGVkIGZvciB0byBZanMuIFRoZW4gY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cbiAgICBpZiBub3QgcmVzLnN5bmNfc3RlcD9cbiAgICAgIGZvciBmIGluIEByZWNlaXZlX2hhbmRsZXJzXG4gICAgICAgIGYgc2VuZGVyLCByZXNcbiAgICBlbHNlXG4gICAgICBpZiBzZW5kZXIgaXMgQHVzZXJfaWRcbiAgICAgICAgcmV0dXJuXG4gICAgICBpZiByZXMuc3luY19zdGVwIGlzIFwiZ2V0SEJcIlxuICAgICAgICAjIGNhbGwgbGlzdGVuZXJzXG4gICAgICAgIGlmIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnM/XG4gICAgICAgICAgZm9yIGYgaW4gQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVyc1xuICAgICAgICAgICAgZi5jYWxsIHRoaXMsIHJlcy5kYXRhXG4gICAgICAgIGRlbGV0ZSBAd2hlbl9yZWNlaXZlZF9zdGF0ZV92ZWN0b3JfbGlzdGVuZXJzXG5cbiAgICAgICAgZGF0YSA9IEBnZXRIQihyZXMuZGF0YSlcbiAgICAgICAgaGIgPSBkYXRhLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgICMgYWx3YXlzIGJyb2FkY2FzdCwgd2hlbiBub3Qgc3luY2VkLlxuICAgICAgICAjIFRoaXMgcmVkdWNlcyBlcnJvcnMsIHdoZW4gdGhlIGNsaWVudHMgZ29lcyBvZmZsaW5lIHByZW1hdHVyZWx5LlxuICAgICAgICAjIFdoZW4gdGhpcyBjbGllbnQgb25seSBzeW5jcyB0byBvbmUgb3RoZXIgY2xpZW50cywgYnV0IGxvb3NlcyBjb25uZWN0b3JzLFxuICAgICAgICAjIGJlZm9yZSBzeW5jaW5nIHRvIHRoZSBvdGhlciBjbGllbnRzLCB0aGUgb25saW5lIGNsaWVudHMgaGF2ZSBkaWZmZXJlbnQgc3RhdGVzLlxuICAgICAgICAjIFNpbmNlIHdlIGRvIG5vdCB3YW50IHRvIHBlcmZvcm0gcmVndWxhciBzeW5jcywgdGhpcyBpcyBhIGdvb2QgYWx0ZXJuYXRpdmVcbiAgICAgICAgaWYgQGlzX3N5bmNlZFxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBzZW5kIHNlbmRlciwgbVxuICAgICAgICBlbHNlXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQGJyb2FkY2FzdCBtXG5cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG5cbiAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICBzeW5jX3N0ZXAgOiBcImFwcGx5SEJcIlxuICAgICAgICAgIGRhdGE6IF9oYlxuXG4gICAgICAgIGlmIHJlcy5zZW5kX2FnYWluPyBhbmQgQHBlcmZvcm1fc2VuZF9hZ2FpblxuICAgICAgICAgIHNlbmRfYWdhaW4gPSBkbyAoc3YgPSBkYXRhLnN0YXRlX3ZlY3Rvcik9PlxuICAgICAgICAgICAgKCk9PlxuICAgICAgICAgICAgICBoYiA9IEBnZXRIQihzdikuaGJcbiAgICAgICAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXG4gICAgICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICAgICAgc2VudF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRfYWdhaW4sIDMwMDBcbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJcIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG4gICAgICAgIGlmIChAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIiBvciByZXMuc2VudF9hZ2Fpbj8pIGFuZCAobm90IEBpc19zeW5jZWQpIGFuZCAoKEBjdXJyZW50X3N5bmNfdGFyZ2V0IGlzIHNlbmRlcikgb3IgKG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD8pKVxuICAgICAgICAgIEBjb25uZWN0aW9uc1tzZW5kZXJdLmlzX3N5bmNlZCA9IHRydWVcbiAgICAgICAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCX1wiXG4gICAgICAgIEBhcHBseUhCKHJlcy5kYXRhLCBzZW5kZXIgaXMgQGN1cnJlbnRfc3luY190YXJnZXQpXG5cblxuICAjIEN1cnJlbnRseSwgdGhlIEhCIGVuY29kZXMgb3BlcmF0aW9ucyBhcyBKU09OLiBGb3IgdGhlIG1vbWVudCBJIHdhbnQgdG8ga2VlcCBpdFxuICAjIHRoYXQgd2F5LiBNYXliZSB3ZSBzdXBwb3J0IGVuY29kaW5nIGluIHRoZSBIQiBhcyBYTUwgaW4gdGhlIGZ1dHVyZSwgYnV0IGZvciBub3cgSSBkb24ndCB3YW50XG4gICMgdG9vIG11Y2ggb3ZlcmhlYWQuIFkgaXMgdmVyeSBsaWtlbHkgdG8gZ2V0IGNoYW5nZWQgYSBsb3QgaW4gdGhlIGZ1dHVyZVxuICAjXG4gICMgQmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvIGVuY29kZSBKU09OIGFzIHN0cmluZyAod2l0aCBjaGFyYWN0ZXIgZXNjYXBpbmcsIHdpY2ggbWFrZXMgaXQgcHJldHR5IG11Y2ggdW5yZWFkYWJsZSlcbiAgIyB3ZSBlbmNvZGUgdGhlIEpTT04gYXMgWE1MLlxuICAjXG4gICMgV2hlbiB0aGUgSEIgc3VwcG9ydCBlbmNvZGluZyBhcyBYTUwsIHRoZSBmb3JtYXQgc2hvdWxkIGxvb2sgcHJldHR5IG11Y2ggbGlrZSB0aGlzLlxuXG4gICMgZG9lcyBub3Qgc3VwcG9ydCBwcmltaXRpdmUgdmFsdWVzIGFzIGFycmF5IGVsZW1lbnRzXG4gICMgZXhwZWN0cyBhbiBsdHggKGxlc3MgdGhhbiB4bWwpIG9iamVjdFxuICBwYXJzZU1lc3NhZ2VGcm9tWG1sOiAobSktPlxuICAgIHBhcnNlX2FycmF5ID0gKG5vZGUpLT5cbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAgcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcGFyc2Vfb2JqZWN0IG5cblxuICAgIHBhcnNlX29iamVjdCA9IChub2RlKS0+XG4gICAgICBqc29uID0ge31cbiAgICAgIGZvciBuYW1lLCB2YWx1ZSAgb2Ygbm9kZS5hdHRyc1xuICAgICAgICBpbnQgPSBwYXJzZUludCh2YWx1ZSlcbiAgICAgICAgaWYgaXNOYU4oaW50KSBvciAoXCJcIitpbnQpIGlzbnQgdmFsdWVcbiAgICAgICAgICBqc29uW25hbWVdID0gdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBpbnRcbiAgICAgIGZvciBuIGluIG5vZGUuY2hpbGRyZW5cbiAgICAgICAgbmFtZSA9IG4ubmFtZVxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2VfYXJyYXkgblxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX29iamVjdCBuXG4gICAgICBqc29uXG4gICAgcGFyc2Vfb2JqZWN0IG1cblxuICAjIGVuY29kZSBtZXNzYWdlIGluIHhtbFxuICAjIHdlIHVzZSBzdHJpbmcgYmVjYXVzZSBTdHJvcGhlIG9ubHkgYWNjZXB0cyBhbiBcInhtbC1zdHJpbmdcIi4uXG4gICMgU28ge2E6NCxiOntjOjV9fSB3aWxsIGxvb2sgbGlrZVxuICAjIDx5IGE9XCI0XCI+XG4gICMgICA8YiBjPVwiNVwiPjwvYj5cbiAgIyA8L3k+XG4gICMgbSAtIGx0eCBlbGVtZW50XG4gICMganNvbiAtIGd1ZXNzIGl0IDspXG4gICNcbiAgZW5jb2RlTWVzc2FnZVRvWG1sOiAobSwganNvbiktPlxuICAgICMgYXR0cmlidXRlcyBpcyBvcHRpb25hbFxuICAgIGVuY29kZV9vYmplY3QgPSAobSwganNvbiktPlxuICAgICAgZm9yIG5hbWUsdmFsdWUgb2YganNvblxuICAgICAgICBpZiBub3QgdmFsdWU/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZSBpZiB2YWx1ZS5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBtLnNldEF0dHJpYnV0ZShuYW1lLHZhbHVlKVxuICAgICAgbVxuICAgIGVuY29kZV9hcnJheSA9IChtLCBhcnJheSktPlxuICAgICAgbS5zZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIsXCJ0cnVlXCIpXG4gICAgICBmb3IgZSBpbiBhcnJheVxuICAgICAgICBpZiBlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgIG1cbiAgICBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlIGlmIGpzb24uY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJ5XCIse3htbG5zOlwiaHR0cDovL3kubmluamEvY29ubmVjdG9yLXN0YW56YVwifSksIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJJIGNhbid0IGVuY29kZSB0aGlzIGpzb24hXCJcblxuICBzZXRJc0JvdW5kVG9ZOiAoKS0+XG4gICAgQG9uX2JvdW5kX3RvX3k/KClcbiAgICBkZWxldGUgQHdoZW5fYm91bmRfdG9feVxuICAgIEBpc19ib3VuZF90b195ID0gdHJ1ZVxuIiwiXG53aW5kb3c/LnVucHJvY2Vzc2VkX2NvdW50ZXIgPSAwICMgZGVsIHRoaXNcbndpbmRvdz8udW5wcm9jZXNzZWRfZXhlY19jb3VudGVyID0gMCAjIFRPRE9cbndpbmRvdz8udW5wcm9jZXNzZWRfdHlwZXMgPSBbXVxuXG4jXG4jIEBub2RvY1xuIyBUaGUgRW5naW5lIGhhbmRsZXMgaG93IGFuZCBpbiB3aGljaCBvcmRlciB0byBleGVjdXRlIG9wZXJhdGlvbnMgYW5kIGFkZCBvcGVyYXRpb25zIHRvIHRoZSBIaXN0b3J5QnVmZmVyLlxuI1xuY2xhc3MgRW5naW5lXG5cbiAgI1xuICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgIyBAcGFyYW0ge09iamVjdH0gdHlwZXMgbGlzdCBvZiBhdmFpbGFibGUgdHlwZXNcbiAgI1xuICBjb25zdHJ1Y3RvcjogKEBIQiwgQHR5cGVzKS0+XG4gICAgQHVucHJvY2Vzc2VkX29wcyA9IFtdXG5cbiAgI1xuICAjIFBhcnNlcyBhbiBvcGVyYXRpbyBmcm9tIHRoZSBqc29uIGZvcm1hdC4gSXQgdXNlcyB0aGUgc3BlY2lmaWVkIHBhcnNlciBpbiB5b3VyIE9wZXJhdGlvblR5cGUgbW9kdWxlLlxuICAjXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxuICAgIHR5cGUgPSBAdHlwZXNbanNvbi50eXBlXVxuICAgIGlmIHR5cGU/LnBhcnNlP1xuICAgICAgdHlwZS5wYXJzZSBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGZvcmdvdCB0byBzcGVjaWZ5IGEgcGFyc2VyIGZvciB0eXBlICN7anNvbi50eXBlfS4gVGhlIG1lc3NhZ2UgaXMgI3tKU09OLnN0cmluZ2lmeSBqc29ufS5cIlxuXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIEUuZy4gdGhlIG9wZXJhdGlvbnMgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciB1c2VycyBIQi5fZW5jb2RlKCkuXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXG4gICMjI1xuICBhcHBseU9wc0J1bmRsZTogKG9wc19qc29uKS0+XG4gICAgb3BzID0gW11cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgb3BzLnB1c2ggQHBhcnNlT3BlcmF0aW9uIG9cbiAgICBmb3IgbyBpbiBvcHNcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgIEB0cnlVbnByb2Nlc3NlZCgpXG4gICMjI1xuXG4gICNcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wc1xuICAjXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBpZiBub3QgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XG4gICAgICAgIEBhcHBseU9wIG9cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gKEhlbHBlciBmb3IgdXNpbmcgYXBwbHlPcCBvbiBBcnJheXMpXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcFxuICBhcHBseU9wczogKG9wc19qc29uKS0+XG4gICAgQGFwcGx5T3Agb3BzX2pzb25cblxuICAjXG4gICMgQXBwbHkgYW4gb3BlcmF0aW9uIHRoYXQgeW91IHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAjIFRPRE86IG1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCEhXG4gICMgLSBvcGVyYXRpb25zIG1heSBvbmx5IGV4ZWN1dGVkIGluIG9yZGVyIGJ5IGNyZWF0b3IsIG9yZGVyIHRoZW0gaW4gb2JqZWN0IG9mIGFycmF5cyAoa2V5IGJ5IGNyZWF0b3IpXG4gICMgLSB5b3UgY2FuIHByb2JhYmx5IG1ha2Ugc29tZXRoaW5nIGxpa2UgZGVwZW5kZW5jaWVzIChjcmVhdG9yMSB3YWl0cyBmb3IgY3JlYXRvcjIpXG4gIGFwcGx5T3A6IChvcF9qc29uX2FycmF5LCBmcm9tSEIgPSBmYWxzZSktPlxuICAgIGlmIG9wX2pzb25fYXJyYXkuY29uc3RydWN0b3IgaXNudCBBcnJheVxuICAgICAgb3BfanNvbl9hcnJheSA9IFtvcF9qc29uX2FycmF5XVxuICAgIGZvciBvcF9qc29uIGluIG9wX2pzb25fYXJyYXlcbiAgICAgIGlmIGZyb21IQlxuICAgICAgICBvcF9qc29uLmZyb21IQiA9IFwidHJ1ZVwiICMgZXhlY3V0ZSBpbW1lZGlhdGVseSwgaWZcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBvLnBhcnNlZF9mcm9tX2pzb24gPSBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgIyBBdCB0aGUgYmVnaW5uaW5nICh3aGVuIHRoZSB1c2VyIGlkIHdhcyBub3QgYXNzaWduZWQgeWV0KSxcbiAgIyB0aGUgb3BlcmF0aW9ucyBhcmUgYWRkZWQgdG8gYnVmZmVyLl90ZW1wLiBXaGVuIHlvdSBmaW5hbGx5IGdldCB5b3VyIHVzZXIgaWQsXG4gICMgdGhlIG9wZXJhdGlvbnMgYXJlIGNvcGllcyBmcm9tIGJ1ZmZlci5fdGVtcCB0byBidWZmZXJbaWRdLiBGdXJ0aGVybW9yZSwgd2hlbiBidWZmZXJbaWRdIGRvZXMgYWxyZWFkeSBjb250YWluIG9wZXJhdGlvbnNcbiAgIyAoYmVjYXVzZSBvZiBhIHByZXZpb3VzIHNlc3Npb24pLCB0aGUgdWlkLm9wX251bWJlcnMgb2YgdGhlIG9wZXJhdGlvbnMgaGF2ZSB0byBiZSByZWFzc2lnbmVkLlxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIGZ1bmN0aW9uIGRvZXMuIEl0IGFkZHMgdGhlbSB0byBidWZmZXJbaWRdLFxuICAjIGFuZCBhc3NpZ25zIHRoZW0gdGhlIGNvcnJlY3QgdWlkLm9wX251bWJlciBhbmQgdWlkLmNyZWF0b3JcbiAgc2V0VXNlcklkOiAoQHVzZXJfaWQsIHN0YXRlX3ZlY3RvciktPlxuICAgIEBidWZmZXJbQHVzZXJfaWRdID89IFtdXG4gICAgYnVmZiA9IEBidWZmZXJbQHVzZXJfaWRdXG5cbiAgICAjIHdlIGFzc3VtZWQgdGhhdCB3ZSBzdGFydGVkIHdpdGggY291bnRlciA9IDAuXG4gICAgIyB3aGVuIHdlIHJlY2VpdmUgdGhhIHN0YXRlX3ZlY3RvciwgYW5kIGFjdHVhbGx5IGhhdmVcbiAgICAjIGNvdW50ZXIgPSAxMC4gVGhlbiB3ZSBoYXZlIHRvIGFkZCAxMCB0byBldmVyeSBvcF9jb3VudGVyXG4gICAgY291bnRlcl9kaWZmID0gc3RhdGVfdmVjdG9yW0B1c2VyX2lkXSBvciAwXG5cbiAgICBpZiBAYnVmZmVyLl90ZW1wP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIEBidWZmZXIuX3RlbXBcbiAgICAgICAgby51aWQuY3JlYXRvciA9IEB1c2VyX2lkXG4gICAgICAgIG8udWlkLm9wX251bWJlciArPSBjb3VudGVyX2RpZmZcbiAgICAgICAgYnVmZltvLnVpZC5vcF9udW1iZXJdID0gb1xuXG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW0B1c2VyX2lkXSA9IChAb3BlcmF0aW9uX2NvdW50ZXIuX3RlbXAgb3IgMCkgKyBjb3VudGVyX2RpZmZcblxuICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXIuX3RlbXBcbiAgICBkZWxldGUgQGJ1ZmZlci5fdGVtcFxuXG5cbiAgZW1wdHlHYXJiYWdlOiAoKT0+XG4gICAgZm9yIG8gaW4gQGdhcmJhZ2VcbiAgICAgICNpZiBAZ2V0T3BlcmF0aW9uQ291bnRlcihvLnVpZC5jcmVhdG9yKSA+IG8udWlkLm9wX251bWJlclxuICAgICAgby5jbGVhbnVwPygpXG5cbiAgICBAZ2FyYmFnZSA9IEB0cmFzaFxuICAgIEB0cmFzaCA9IFtdXG4gICAgaWYgQGdhcmJhZ2VDb2xsZWN0VGltZW91dCBpc250IC0xXG4gICAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSBzZXRUaW1lb3V0IEBlbXB0eUdhcmJhZ2UsIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXRcbiAgICB1bmRlZmluZWRcblxuICAjXG4gICMgR2V0IHRoZSB1c2VyIGlkIHdpdGggd2ljaCB0aGUgSGlzdG9yeSBCdWZmZXIgd2FzIGluaXRpYWxpemVkLlxuICAjXG4gIGdldFVzZXJJZDogKCktPlxuICAgIEB1c2VyX2lkXG5cbiAgYWRkVG9HYXJiYWdlQ29sbGVjdG9yOiAoKS0+XG4gICAgaWYgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvblxuICAgICAgZm9yIG8gaW4gYXJndW1lbnRzXG4gICAgICAgIGlmIG8/XG4gICAgICAgICAgQGdhcmJhZ2UucHVzaCBvXG5cbiAgc3RvcEdhcmJhZ2VDb2xsZWN0aW9uOiAoKS0+XG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IGZhbHNlXG4gICAgQHNldE1hbnVhbEdhcmJhZ2VDb2xsZWN0KClcbiAgICBAZ2FyYmFnZSA9IFtdXG4gICAgQHRyYXNoID0gW11cblxuICBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdDogKCktPlxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAtMVxuICAgIGNsZWFyVGltZW91dCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWRcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0SWQgPSB1bmRlZmluZWRcblxuICBzZXRHYXJiYWdlQ29sbGVjdFRpbWVvdXQ6IChAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0KS0+XG5cbiAgI1xuICAjIEkgcHJvcG9zZSB0byB1c2UgaXQgaW4geW91ciBGcmFtZXdvcmssIHRvIGNyZWF0ZSBzb21ldGhpbmcgbGlrZSBhIHJvb3QgZWxlbWVudC5cbiAgIyBBbiBvcGVyYXRpb24gd2l0aCB0aGlzIGlkZW50aWZpZXIgaXMgbm90IHByb3BhZ2F0ZWQgdG8gb3RoZXIgY2xpZW50cy5cbiAgIyBUaGlzIGlzIHdoeSBldmVyeWJvZGUgbXVzdCBjcmVhdGUgdGhlIHNhbWUgb3BlcmF0aW9uIHdpdGggdGhpcyB1aWQuXG4gICNcbiAgZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyOiAoKS0+XG4gICAge1xuICAgICAgY3JlYXRvciA6ICdfJ1xuICAgICAgb3BfbnVtYmVyIDogXCJfI3tAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyKyt9XCJcbiAgICB9XG5cbiAgI1xuICAjIEdldCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIgdGhhdCBkZXNjcmliZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGRvY3VtZW50LlxuICAjXG4gIGdldE9wZXJhdGlvbkNvdW50ZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICByZXMgPSB7fVxuICAgICAgZm9yIHVzZXIsY3RuIG9mIEBvcGVyYXRpb25fY291bnRlclxuICAgICAgICByZXNbdXNlcl0gPSBjdG5cbiAgICAgIHJlc1xuICAgIGVsc2VcbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuXG4gIGlzRXhwZWN0ZWRPcGVyYXRpb246IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICBvLnVpZC5vcF9udW1iZXIgPD0gQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgdHJ1ZSAjVE9ETzogISEgdGhpcyBjb3VsZCBicmVhayBzdHVmZi4gQnV0IEkgZHVubm8gd2h5XG5cbiAgI1xuICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICMgVE9ETzogTWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50IVxuICBfZW5jb2RlOiAoc3RhdGVfdmVjdG9yPXt9KS0+XG4gICAganNvbiA9IFtdXG4gICAgdW5rbm93biA9ICh1c2VyLCBvX251bWJlciktPlxuICAgICAgaWYgKG5vdCB1c2VyPykgb3IgKG5vdCBvX251bWJlcj8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImRhaCFcIlxuICAgICAgbm90IHN0YXRlX3ZlY3Rvclt1c2VyXT8gb3Igc3RhdGVfdmVjdG9yW3VzZXJdIDw9IG9fbnVtYmVyXG5cbiAgICBmb3IgdV9uYW1lLHVzZXIgb2YgQGJ1ZmZlclxuICAgICAgIyBUT0RPIG5leHQsIGlmIEBzdGF0ZV92ZWN0b3JbdXNlcl0gPD0gc3RhdGVfdmVjdG9yW3VzZXJdXG4gICAgICBpZiB1X25hbWUgaXMgXCJfXCJcbiAgICAgICAgY29udGludWVcbiAgICAgIGZvciBvX251bWJlcixvIG9mIHVzZXJcbiAgICAgICAgaWYgKG5vdCBvLnVpZC5ub09wZXJhdGlvbj8pIGFuZCB1bmtub3duKHVfbmFtZSwgb19udW1iZXIpXG4gICAgICAgICAgIyBpdHMgbmVjZXNzYXJ5IHRvIHNlbmQgaXQsIGFuZCBub3Qga25vd24gaW4gc3RhdGVfdmVjdG9yXG4gICAgICAgICAgb19qc29uID0gby5fZW5jb2RlKClcbiAgICAgICAgICBpZiBvLm5leHRfY2w/ICMgYXBwbGllcyBmb3IgYWxsIG9wcyBidXQgdGhlIG1vc3QgcmlnaHQgZGVsaW1pdGVyIVxuICAgICAgICAgICAgIyBzZWFyY2ggZm9yIHRoZSBuZXh0IF9rbm93bl8gb3BlcmF0aW9uLiAoV2hlbiBzdGF0ZV92ZWN0b3IgaXMge30gdGhlbiB0aGlzIGlzIHRoZSBEZWxpbWl0ZXIpXG4gICAgICAgICAgICBvX25leHQgPSBvLm5leHRfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fbmV4dC5uZXh0X2NsPyBhbmQgdW5rbm93bihvX25leHQudWlkLmNyZWF0b3IsIG9fbmV4dC51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX25leHQgPSBvX25leHQubmV4dF9jbFxuICAgICAgICAgICAgb19qc29uLm5leHQgPSBvX25leHQuZ2V0VWlkKClcbiAgICAgICAgICBlbHNlIGlmIG8ucHJldl9jbD8gIyBtb3N0IHJpZ2h0IGRlbGltaXRlciBvbmx5IVxuICAgICAgICAgICAgIyBzYW1lIGFzIHRoZSBhYm92ZSB3aXRoIHByZXYuXG4gICAgICAgICAgICBvX3ByZXYgPSBvLnByZXZfY2xcbiAgICAgICAgICAgIHdoaWxlIG9fcHJldi5wcmV2X2NsPyBhbmQgdW5rbm93bihvX3ByZXYudWlkLmNyZWF0b3IsIG9fcHJldi51aWQub3BfbnVtYmVyKVxuICAgICAgICAgICAgICBvX3ByZXYgPSBvX3ByZXYucHJldl9jbFxuICAgICAgICAgICAgb19qc29uLnByZXYgPSBvX3ByZXYuZ2V0VWlkKClcbiAgICAgICAgICBqc29uLnB1c2ggb19qc29uXG5cbiAgICBqc29uXG5cbiAgI1xuICAjIEdldCB0aGUgbnVtYmVyIG9mIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGNyZWF0ZWQgYnkgYSB1c2VyLlxuICAjIEFjY29yZGluZ2x5IHlvdSB3aWxsIGdldCB0aGUgbmV4dCBvcGVyYXRpb24gbnVtYmVyIHRoYXQgaXMgZXhwZWN0ZWQgZnJvbSB0aGF0IHVzZXIuXG4gICMgVGhpcyB3aWxsIGluY3JlbWVudCB0aGUgb3BlcmF0aW9uIGNvdW50ZXIuXG4gICNcbiAgZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXI6ICh1c2VyX2lkKS0+XG4gICAgaWYgbm90IHVzZXJfaWQ/XG4gICAgICB1c2VyX2lkID0gQHVzZXJfaWRcbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJfaWRdID0gMFxuICAgIHVpZCA9XG4gICAgICAnY3JlYXRvcicgOiB1c2VyX2lkXG4gICAgICAnb3BfbnVtYmVyJyA6IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxuICAjIG9uIHRoZSBvcGVyYXRpb25zIHJldHJpZXZlU3ViIG1ldGhvZCAod2hpY2ggbXVzdCEgYmUgZGVmaW5lZClcbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBpZiB1aWQuc3ViPyBhbmQgbz9cbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxuICAgIGVsc2VcbiAgICAgIG9cblxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSkpIGFuZCBzdGF0ZV92ZWN0b3JbdXNlcl0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0gPz0gMFxuICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgIGlmIG8udWlkLm9wX251bWJlciBpcyBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgd2hpbGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl1dP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdKytcbiAgICB1bmRlZmluZWRcblxubW9kdWxlLmV4cG9ydHMgPSBIaXN0b3J5QnVmZmVyXG4iLCJcbmNsYXNzIFlPYmplY3RcblxuICBjb25zdHJ1Y3RvcjogKEBfb2JqZWN0ID0ge30pLT5cbiAgICBpZiBAX29iamVjdC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgIGZvciBuYW1lLCB2YWwgb2YgQF9vYmplY3RcbiAgICAgICAgaWYgdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIEBfb2JqZWN0W25hbWVdID0gbmV3IFlPYmplY3QodmFsKVxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlkuT2JqZWN0IGFjY2VwdHMgSnNvbiBPYmplY3RzIG9ubHlcIlxuXG4gIF9uYW1lOiBcIk9iamVjdFwiXG5cbiAgX2dldE1vZGVsOiAodHlwZXMsIG9wcyktPlxuICAgIGlmIG5vdCBAX21vZGVsP1xuICAgICAgQF9tb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihAKS5leGVjdXRlKClcbiAgICAgIGZvciBuLG8gb2YgQF9vYmplY3RcbiAgICAgICAgQF9tb2RlbC52YWwgbiwgb1xuICAgIGRlbGV0ZSBAX29iamVjdFxuICAgIEBfbW9kZWxcblxuICBfc2V0TW9kZWw6IChAX21vZGVsKS0+XG4gICAgZGVsZXRlIEBfb2JqZWN0XG5cbiAgb2JzZXJ2ZTogKGYpLT5cbiAgICBAX21vZGVsLm9ic2VydmUgZlxuICAgIEBcblxuICB1bm9ic2VydmU6IChmKS0+XG4gICAgQF9tb2RlbC51bm9ic2VydmUgZlxuICAgIEBcblxuICAjXG4gICMgQG92ZXJsb2FkIHZhbCgpXG4gICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAjICAgQHJldHVybiBbSnNvbl1cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHJldHVybiBbKl0gRGVwZW5kcyBvbiB0aGUgdmFsdWUgb2YgdGhlIHByb3BlcnR5LlxuICAjXG4gICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAjICAgU2V0IGEgbmV3IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgb2JqZWN0IHByb3BlcnR5LlxuICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlXSBUaGlzIG9iamVjdC4gKHN1cHBvcnRzIGNoYWluaW5nKVxuICAjXG4gIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICBpZiBAX21vZGVsP1xuICAgICAgQF9tb2RlbC52YWwuYXBwbHkgQF9tb2RlbCwgYXJndW1lbnRzXG4gICAgZWxzZVxuICAgICAgaWYgY29udGVudD9cbiAgICAgICAgQF9vYmplY3RbbmFtZV0gPSBjb250ZW50XG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdXG4gICAgICBlbHNlXG4gICAgICAgIHJlcyA9IHt9XG4gICAgICAgIGZvciBuLHYgb2YgQF9vYmplY3RcbiAgICAgICAgICByZXNbbl0gPSB2XG4gICAgICAgIHJlc1xuXG4gIGRlbGV0ZTogKG5hbWUpLT5cbiAgICBAX21vZGVsLmRlbGV0ZShuYW1lKVxuICAgIEBcblxuaWYgd2luZG93P1xuICBpZiB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWS5PYmplY3QgPSBZT2JqZWN0XG4gIGVsc2VcbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBmaXJzdCBpbXBvcnQgWSFcIlxuXG5pZiBtb2R1bGU/XG4gIG1vZHVsZS5leHBvcnRzID0gWU9iamVjdFxuIiwibW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgb3BzID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQHByaXZhdGVcbiAgIyBAYWJzdHJhY3RcbiAgIyBAbm9kb2NcbiAgIyBBIGdlbmVyaWMgaW50ZXJmYWNlIHRvIG9wcy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjICogX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjICogZXhlY3V0ZTogZXhlY3V0ZSB0aGUgZWZmZWN0cyBvZiB0aGlzIG9wZXJhdGlvbnMuIEdvb2QgZXhhbXBsZXMgYXJlIEluc2VydC10eXBlIGFuZCBBZGROYW1lLXR5cGVcbiAgIyAqIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLiBXZSBleHRlbmQgdGhlIHBhcnNlciBvYmplY3QgaW4gb3JkZXIgdG8gcGFyc2UgZW5jb2RlZCBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci5cbiAgICAjIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQgYmVmb3JlIGF0IHRoZSBlbmQgb2YgdGhlIGV4ZWN1dGlvbiBzZXF1ZW5jZVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgaWYgY3VzdG9tX3R5cGU/XG4gICAgICAgIEBjdXN0b21fdHlwZSA9IGN1c3RvbV90eXBlXG4gICAgICBAaXNfZGVsZXRlZCA9IGZhbHNlXG4gICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSBmYWxzZVxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdICMgVE9ETzogcmVuYW1lIHRvIG9ic2VydmVycyBvciBzdGggbGlrZSB0aGF0XG4gICAgICBpZiB1aWQ/XG4gICAgICAgIEB1aWQgPSB1aWRcblxuICAgICAgIyBzZWUgZW5jb2RlIHRvIHNlZSwgd2h5IHdlIGFyZSBkb2luZyBpdCB0aGlzIHdheVxuICAgICAgaWYgY29udGVudCBpcyB1bmRlZmluZWRcbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY3JlYXRvcj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2NvbnRlbnQnLCBjb250ZW50XG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50ID0gY29udGVudFxuICAgICAgaWYgY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICBAY29udGVudF9vcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG5hbWUsIG9wIG9mIGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgIEBzYXZlT3BlcmF0aW9uIG5hbWUsIG9wLCAnY29udGVudF9vcGVyYXRpb25zJ1xuXG4gICAgdHlwZTogXCJPcGVyYXRpb25cIlxuXG4gICAgZ2V0Q29udGVudDogKG5hbWUpLT5cbiAgICAgIGlmIEBjb250ZW50P1xuICAgICAgICBpZiBAY29udGVudC5nZXRDdXN0b21UeXBlP1xuICAgICAgICAgIEBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBlbHNlIGlmIEBjb250ZW50LmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGlmIG5hbWU/XG4gICAgICAgICAgICBpZiBAY29udGVudFtuYW1lXT9cbiAgICAgICAgICAgICAgQGNvbnRlbnRbbmFtZV1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9uc1tuYW1lXS5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjb250ZW50ID0ge31cbiAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRcbiAgICAgICAgICAgICAgY29udGVudFtuXSA9IHZcbiAgICAgICAgICAgIGlmIEBjb250ZW50X29wZXJhdGlvbnM/XG4gICAgICAgICAgICAgIGZvciBuLHYgb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgICAgICAgIHYgPSB2LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICAgICAgICAgIGNvbnRlbnRbbl0gPSB2XG4gICAgICAgICAgICBjb250ZW50XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBAY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcInN1YiBwcm9wZXJ0aWVzIGFyZSBub3QgZW5hYmxlIG9uIHRoaXMgb3BlcmF0aW9uIHR5cGUhXCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZVxuICAgIHVub2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBAZXZlbnRfbGlzdGVuZXJzLmZpbHRlciAoZyktPlxuICAgICAgICBmIGlzbnQgZ1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhbGwgc3Vic2NyaWJlZCBldmVudCBsaXN0ZW5lcnMuXG4gICAgIyBUaGlzIHNob3VsZCBiZSBjYWxsZWQsIGUuZy4gYWZ0ZXIgdGhpcyBoYXMgYmVlbiByZXBsYWNlZC5cbiAgICAjIChUaGVuIG9ubHkgb25lIHJlcGxhY2UgZXZlbnQgc2hvdWxkIGZpcmUuIClcbiAgICAjIFRoaXMgaXMgYWxzbyBjYWxsZWQgaW4gdGhlIGNsZWFudXAgbWV0aG9kLlxuICAgIGRlbGV0ZUFsbE9ic2VydmVyczogKCktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA9IFtdXG5cbiAgICBkZWxldGU6ICgpLT5cbiAgICAgIChuZXcgb3BzLkRlbGV0ZSB1bmRlZmluZWQsIEApLmV4ZWN1dGUoKVxuICAgICAgbnVsbFxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIGlmIEBjdXN0b21fdHlwZT9cbiAgICAgICAgY2FsbG9uID0gQGdldEN1c3RvbVR5cGUoKVxuICAgICAgZWxzZVxuICAgICAgICBjYWxsb24gPSBAXG4gICAgICBAZm9yd2FyZEV2ZW50IGNhbGxvbiwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBASEIuYWRkVG9HYXJiYWdlQ29sbGVjdG9yIEBcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgICNjb25zb2xlLmxvZyBcImNsZWFudXA6ICN7QHR5cGV9XCJcbiAgICAgIEBIQi5yZW1vdmVPcGVyYXRpb24gQFxuICAgICAgQGRlbGV0ZUFsbE9ic2VydmVycygpXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAoQHBhcmVudCktPlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBhcmVudDogKCktPlxuICAgICAgQHBhcmVudFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZXMgYSB1bmlxdWUgaWRlbnRpZmllciAodWlkKSB0aGF0IGlkZW50aWZpZXMgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFVpZDogKCktPlxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEB1aWRcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHVpZC5hbHQ/ICMgY291bGQgYmUgKHNhZmVseSkgdW5kZWZpbmVkXG4gICAgICAgICAgbWFwX3VpZCA9IEB1aWQuYWx0LmNsb25lVWlkKClcbiAgICAgICAgICBtYXBfdWlkLnN1YiA9IEB1aWQuc3ViXG4gICAgICAgICAgbWFwX3VpZFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbG9uZVVpZDogKCktPlxuICAgICAgdWlkID0ge31cbiAgICAgIGZvciBuLHYgb2YgQGdldFVpZCgpXG4gICAgICAgIHVpZFtuXSA9IHZcbiAgICAgIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgICAgaWYgbm90IEB1aWQ/XG4gICAgICAgICAgIyBXaGVuIHRoaXMgb3BlcmF0aW9uIHdhcyBjcmVhdGVkIHdpdGhvdXQgYSB1aWQsIHRoZW4gc2V0IGl0IGhlcmUuXG4gICAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgICAjIGlzIGV4ZWN1dGVkIChiZWNhdXNlIHdlIG5lZWQgdGhlIGNyZWF0b3JfaWQpXG4gICAgICAgICAgQHVpZCA9IEBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICAgIEBIQi5hZGRPcGVyYXRpb24gQFxuICAgICAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICAgICAgbCBAX2VuY29kZSgpXG4gICAgICAgIEBcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3AsIGJhc2UgPSBcInRoaXNcIiktPlxuICAgICAgaWYgb3A/IGFuZCBvcC5fZ2V0TW9kZWw/XG4gICAgICAgIG9wID0gb3AuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG5vdCBvcD9cbiAgICAgICAgIyBub3BcbiAgICAgIGVsc2UgaWYgb3AuZXhlY3V0ZT8gb3Igbm90IChvcC5vcF9udW1iZXI/IGFuZCBvcC5jcmVhdG9yPylcbiAgICAgICAgIyBpcyBpbnN0YW50aWF0ZWQsIG9yIG9wIGlzIHN0cmluZy4gQ3VycmVudGx5IFwiRGVsaW1pdGVyXCIgaXMgc2F2ZWQgYXMgc3RyaW5nXG4gICAgICAgICMgKGluIGNvbWJpbmF0aW9uIHdpdGggQHBhcmVudCB5b3UgY2FuIHJldHJpZXZlIHRoZSBkZWxpbWl0ZXIuLilcbiAgICAgICAgaWYgYmFzZSBpcyBcInRoaXNcIlxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgZGVzdCA9IEBbYmFzZV1cbiAgICAgICAgICBwYXRocyA9IG5hbWUuc3BsaXQoXCIvXCIpXG4gICAgICAgICAgbGFzdF9wYXRoID0gcGF0aHMucG9wKClcbiAgICAgICAgICBmb3IgcGF0aCBpbiBwYXRoc1xuICAgICAgICAgICAgZGVzdCA9IGRlc3RbcGF0aF1cbiAgICAgICAgICBkZXN0W2xhc3RfcGF0aF0gPSBvcFxuICAgICAgZWxzZVxuICAgICAgICAjIG5vdCBpbml0aWFsaXplZC4gRG8gaXQgd2hlbiBjYWxsaW5nICR2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEB1bmNoZWNrZWQgPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXSA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW2Jhc2VdW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gdHJ1ZVxuICAgICAgZm9yIGJhc2VfbmFtZSwgYmFzZSBvZiBAdW5jaGVja2VkXG4gICAgICAgIGZvciBuYW1lLCBvcF91aWQgb2YgYmFzZVxuICAgICAgICAgIG9wID0gQEhCLmdldE9wZXJhdGlvbiBvcF91aWRcbiAgICAgICAgICBpZiBvcFxuICAgICAgICAgICAgaWYgYmFzZV9uYW1lIGlzIFwidGhpc1wiXG4gICAgICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICBkZXN0ID0gQFtiYXNlX25hbWVdXG4gICAgICAgICAgICAgIHBhdGhzID0gbmFtZS5zcGxpdChcIi9cIilcbiAgICAgICAgICAgICAgbGFzdF9wYXRoID0gcGF0aHMucG9wKClcbiAgICAgICAgICAgICAgZm9yIHBhdGggaW4gcGF0aHNcbiAgICAgICAgICAgICAgICBkZXN0ID0gZGVzdFtwYXRoXVxuICAgICAgICAgICAgICBkZXN0W2xhc3RfcGF0aF0gPSBvcFxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV0gPz0ge31cbiAgICAgICAgICAgIHVuaW5zdGFudGlhdGVkW2Jhc2VfbmFtZV1bbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgaWYgbm90IHN1Y2Nlc3NcbiAgICAgICAgQHVuY2hlY2tlZCA9IHVuaW5zdGFudGlhdGVkXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBkZWxldGUgQHVuY2hlY2tlZFxuICAgICAgICByZXR1cm4gQFxuXG4gICAgZ2V0Q3VzdG9tVHlwZTogKCktPlxuICAgICAgaWYgbm90IEBjdXN0b21fdHlwZT9cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIG9wZXJhdGlvbiB3YXMgbm90IGluaXRpYWxpemVkIHdpdGggYSBjdXN0b20gdHlwZVwiXG4gICAgICAgIEBcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGN1c3RvbV90eXBlLmNvbnN0cnVjdG9yIGlzIFN0cmluZ1xuICAgICAgICAgICMgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldCAob25seSB0aGUgbmFtZSBpcyBzcGVjaWZpZWQpXG4gICAgICAgICAgVHlwZSA9IEBjdXN0b21fdHlwZXNcbiAgICAgICAgICBmb3IgdCBpbiBAY3VzdG9tX3R5cGUuc3BsaXQoXCIuXCIpXG4gICAgICAgICAgICBUeXBlID0gVHlwZVt0XVxuICAgICAgICAgIEBjdXN0b21fdHlwZSA9IG5ldyBUeXBlKClcbiAgICAgICAgICBAY3VzdG9tX3R5cGUuX3NldE1vZGVsIEBcbiAgICAgICAgQGN1c3RvbV90eXBlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi50eXBlID0gQHR5cGVcbiAgICAgIGpzb24udWlkID0gQGdldFVpZCgpXG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XG4gICAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uLmN1c3RvbV90eXBlID0gQGN1c3RvbV90eXBlLl9uYW1lXG5cbiAgICAgIGlmIEBjb250ZW50Py5nZXRVaWQ/XG4gICAgICAgIGpzb24uY29udGVudCA9IEBjb250ZW50LmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29udGVudCA9IEBjb250ZW50XG4gICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICBvcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG4sbyBvZiBAY29udGVudF9vcGVyYXRpb25zXG4gICAgICAgICAgaWYgby5fZ2V0TW9kZWw/XG4gICAgICAgICAgICBvID0gby5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgICAgb3BlcmF0aW9uc1tuXSA9IG8uZ2V0VWlkKClcbiAgICAgICAganNvbi5jb250ZW50X29wZXJhdGlvbnMgPSBvcGVyYXRpb25zXG4gICAgICBqc29uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIG9wcy5EZWxldGUgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZGVsZXRlcyBVSUQgb3IgcmVmZXJlbmNlIG9mIHRoZSBvcGVyYXRpb24gdGhhdCB0aGlzIHRvIGJlIGRlbGV0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIG9wcy5EZWxldGUucGFyc2UgPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgdGhpcyhudWxsLCB1aWQsIGRlbGV0ZXNfdWlkKVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBpbnNlcnQtdHlwZSBvcGVyYXRpb24uXG4gICNcbiAgIyBBbiBpbnNlcnQgb3BlcmF0aW9uIGlzIGFsd2F5cyBwb3NpdGlvbmVkIGJldHdlZW4gdHdvIG90aGVyIGluc2VydCBvcGVyYXRpb25zLlxuICAjIEludGVybmFsbHkgdGhpcyBpcyByZWFsaXplZCBhcyBhc3NvY2lhdGl2ZSBsaXN0cywgd2hlcmVieSBlYWNoIGluc2VydCBvcGVyYXRpb24gaGFzIGEgcHJlZGVjZXNzb3IgYW5kIGEgc3VjY2Vzc29yLlxuICAjIEZvciB0aGUgc2FrZSBvZiBlZmZpY2llbmN5IHdlIG1haW50YWluIHR3byBsaXN0czpcbiAgIyAgIC0gVGhlIHNob3J0LWxpc3QgKGFiYnJldi4gc2wpIG1haW50YWlucyBvbmx5IHRoZSBvcGVyYXRpb25zIHRoYXQgYXJlIG5vdCBkZWxldGVkICh1bmltcGxlbWVudGVkLCBnb29kIGlkZWE/KVxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3Mgb3BzLkluc2VydCBleHRlbmRzIG9wcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zLCBwYXJlbnQsIHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiSW5zZXJ0XCJcblxuICAgIHZhbDogKCktPlxuICAgICAgQGdldENvbnRlbnQoKVxuXG4gICAgZ2V0TmV4dDogKGk9MSktPlxuICAgICAgbiA9IEBcbiAgICAgIHdoaWxlIGkgPiAwIGFuZCBuLm5leHRfY2w/XG4gICAgICAgIG4gPSBuLm5leHRfY2xcbiAgICAgICAgaWYgbm90IG4uaXNfZGVsZXRlZFxuICAgICAgICAgIGktLVxuICAgICAgaWYgbi5pc19kZWxldGVkXG4gICAgICAgIG51bGxcbiAgICAgIG5cblxuICAgIGdldFByZXY6IChpPTEpLT5cbiAgICAgIG4gPSBAXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5wcmV2X2NsP1xuICAgICAgICBuID0gbi5wcmV2X2NsXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpLS1cbiAgICAgIGlmIG4uaXNfZGVsZXRlZFxuICAgICAgICBudWxsXG4gICAgICBlbHNlXG4gICAgICAgIG5cblxuICAgICNcbiAgICAjIHNldCBjb250ZW50IHRvIG51bGwgYW5kIG90aGVyIHN0dWZmXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBhcHBseURlbGV0ZTogKG8pLT5cbiAgICAgIEBkZWxldGVkX2J5ID89IFtdXG4gICAgICBjYWxsTGF0ZXIgPSBmYWxzZVxuICAgICAgaWYgQHBhcmVudD8gYW5kIG5vdCBAaXNfZGVsZXRlZCBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIGNhbGxMYXRlclxuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50cyh0aGlzLCBvKVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAcHJldl9jbC5pc0RlbGV0ZWQoKSBhbmQgQHByZXZfY2wuZ2FyYmFnZV9jb2xsZWN0ZWQgaXNudCB0cnVlXG4gICAgICAgICMgZ2FyYmFnZSBjb2xsZWN0IHByZXZfY2xcbiAgICAgICAgQHByZXZfY2wuYXBwbHlEZWxldGUoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgaWYgQG5leHRfY2wuaXNEZWxldGVkKClcbiAgICAgICAgIyBkZWxldGUgYWxsIG9wcyB0aGF0IGRlbGV0ZSB0aGlzIGluc2VydGlvblxuICAgICAgICBmb3IgZCBpbiBAZGVsZXRlZF9ieVxuICAgICAgICAgIGQuY2xlYW51cCgpXG5cbiAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJyaWdodCBpcyBub3QgZGVsZXRlZC4gaW5jb25zaXN0ZW5jeSEsIHdyYXJhcmFyXCJcbiAgICAgICAgIyBjaGFuZ2Ugb3JpZ2luIHJlZmVyZW5jZXMgdG8gdGhlIHJpZ2h0XG4gICAgICAgIG8gPSBAbmV4dF9jbFxuICAgICAgICB3aGlsZSBvLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgaWYgby5vcmlnaW4gaXMgQFxuICAgICAgICAgICAgby5vcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgIyByZWNvbm5lY3QgbGVmdC9yaWdodFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQG5leHRfY2xcbiAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBwcmV2X2NsXG5cbiAgICAgICAgIyBkZWxldGUgY29udGVudFxuICAgICAgICAjIC0gd2UgbXVzdCBub3QgZG8gdGhpcyBpbiBhcHBseURlbGV0ZSwgYmVjYXVzZSB0aGlzIHdvdWxkIGxlYWQgdG8gaW5jb25zaXN0ZW5jaWVzXG4gICAgICAgICMgKGUuZy4gdGhlIGZvbGxvd2luZyBvcGVyYXRpb24gb3JkZXIgbXVzdCBiZSBpbnZlcnRpYmxlIDpcbiAgICAgICAgIyAgIEluc2VydCByZWZlcnMgdG8gY29udGVudCwgdGhlbiB0aGUgY29udGVudCBpcyBkZWxldGVkKVxuICAgICAgICAjIFRoZXJlZm9yZSwgd2UgaGF2ZSB0byBkbyB0aGlzIGluIHRoZSBjbGVhbnVwXG4gICAgICAgICMgKiBOT0RFOiBXZSBuZXZlciBkZWxldGUgSW5zZXJ0aW9ucyFcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uIGFuZCBub3QgKEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLkluc2VydClcbiAgICAgICAgICBAY29udGVudC5yZWZlcmVuY2VkX2J5LS1cbiAgICAgICAgICBpZiBAY29udGVudC5yZWZlcmVuY2VkX2J5IDw9IDAgYW5kIG5vdCBAY29udGVudC5pc19kZWxldGVkXG4gICAgICAgICAgICBAY29udGVudC5hcHBseURlbGV0ZSgpXG4gICAgICAgIGRlbGV0ZSBAY29udGVudFxuICAgICAgICBzdXBlclxuICAgICAgIyBlbHNlXG4gICAgICAjICAgU29tZW9uZSBpbnNlcnRlZCBzb21ldGhpbmcgaW4gdGhlIG1lYW50aW1lLlxuICAgICAgIyAgIFJlbWVtYmVyOiB0aGlzIGNhbiBvbmx5IGJlIGdhcmJhZ2UgY29sbGVjdGVkIHdoZW4gbmV4dF9jbCBpcyBkZWxldGVkXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgVGhlIGFtb3VudCBvZiBwb3NpdGlvbnMgdGhhdCAkdGhpcyBvcGVyYXRpb24gd2FzIG1vdmVkIHRvIHRoZSByaWdodC5cbiAgICAjXG4gICAgZ2V0RGlzdGFuY2VUb09yaWdpbjogKCktPlxuICAgICAgZCA9IDBcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBAb3JpZ2luIGlzIG9cbiAgICAgICAgICBicmVha1xuICAgICAgICBkKytcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEluY2x1ZGUgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGFzc29jaWF0aXZlIGxpc3RzLlxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgQGNvbnRlbnQuaW5zZXJ0X3BhcmVudCA9IEAgIyBUT0RPOiB0aGlzIGlzIHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYW5kIG9ubHkgbmljZSBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA/PSAwXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSsrXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAbmV4dF9jbD9cbiAgICAgICAgICAgIEBuZXh0X2NsID0gQHBhcmVudC5lbmRcbiAgICAgICAgaWYgQHByZXZfY2w/XG4gICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gQGdldERpc3RhbmNlVG9PcmlnaW4oKSAjIG1vc3QgY2FzZXM6IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSBkaXN0YW5jZV90b19vcmlnaW4gIyBsb29wIGNvdW50ZXJcblxuICAgICAgICAgICMgJHRoaXMgaGFzIHRvIGZpbmQgYSB1bmlxdWUgcG9zaXRpb24gYmV0d2VlbiBvcmlnaW4gYW5kIHRoZSBuZXh0IGtub3duIGNoYXJhY3RlclxuICAgICAgICAgICMgY2FzZSAxOiAkb3JpZ2luIGVxdWFscyAkby5vcmlnaW46IHRoZSAkY3JlYXRvciBwYXJhbWV0ZXIgZGVjaWRlcyBpZiBsZWZ0IG9yIHJpZ2h0XG4gICAgICAgICAgIyAgICAgICAgIGxldCAkT0w9IFtvMSxvMixvMyxvNF0sIHdoZXJlYnkgJHRoaXMgaXMgdG8gYmUgaW5zZXJ0ZWQgYmV0d2VlbiBvMSBhbmQgbzRcbiAgICAgICAgICAjICAgICAgICAgbzIsbzMgYW5kIG80IG9yaWdpbiBpcyAxICh0aGUgcG9zaXRpb24gb2YgbzIpXG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlIGlzIHRoZSBjYXNlIHRoYXQgJHRoaXMuY3JlYXRvciA8IG8yLmNyZWF0b3IsIGJ1dCBvMy5jcmVhdG9yIDwgJHRoaXMuY3JlYXRvclxuICAgICAgICAgICMgICAgICAgICB0aGVuIG8yIGtub3dzIG8zLiBTaW5jZSBvbiBhbm90aGVyIGNsaWVudCAkT0wgY291bGQgYmUgW28xLG8zLG80XSB0aGUgcHJvYmxlbSBpcyBjb21wbGV4XG4gICAgICAgICAgIyAgICAgICAgIHRoZXJlZm9yZSAkdGhpcyB3b3VsZCBiZSBhbHdheXMgdG8gdGhlIHJpZ2h0IG9mIG8zXG4gICAgICAgICAgIyBjYXNlIDI6ICRvcmlnaW4gPCAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgaWYgY3VycmVudCAkdGhpcyBpbnNlcnRfcG9zaXRpb24gPiAkbyBvcmlnaW46ICR0aGlzIGluc1xuICAgICAgICAgICMgICAgICAgICBlbHNlICRpbnNlcnRfcG9zaXRpb24gd2lsbCBub3QgY2hhbmdlXG4gICAgICAgICAgIyAgICAgICAgIChtYXliZSB3ZSBlbmNvdW50ZXIgY2FzZSAxIGxhdGVyLCB0aGVuIHRoaXMgd2lsbCBiZSB0byB0aGUgcmlnaHQgb2YgJG8pXG4gICAgICAgICAgIyBjYXNlIDM6ICRvcmlnaW4gPiAkby5vcmlnaW5cbiAgICAgICAgICAjICAgICAgICAgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uIGlzIHRvIHRoZSBsZWZ0IG9mICRvIChmb3JldmVyISlcbiAgICAgICAgICB3aGlsZSB0cnVlXG4gICAgICAgICAgICBpZiBvIGlzbnQgQG5leHRfY2xcbiAgICAgICAgICAgICAgb0Rpc3RhbmNlID0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgIyAkbyBoYXBwZW5lZCBjb25jdXJyZW50bHlcbiAgICAgICAgICAgICAgaWYgb0Rpc3RhbmNlIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG9EaXN0YW5jZSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gb0Rpc3RhbmNlXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgI25vcFxuICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgIyBjYXNlIDNcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAjICR0aGlzIGtub3dzIHRoYXQgJG8gZXhpc3RzLFxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICMgbm93IHJlY29ubmVjdCBldmVyeXRoaW5nXG4gICAgICAgICAgQG5leHRfY2wgPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQFxuXG4gICAgICAgIEBzZXRQYXJlbnQgQHByZXZfY2wuZ2V0UGFyZW50KCkgIyBkbyBJbnNlcnRpb25zIGFsd2F5cyBoYXZlIGEgcGFyZW50P1xuICAgICAgICBzdXBlciAjIG5vdGlmeSB0aGUgZXhlY3V0aW9uX2xpc3RlbmVyc1xuICAgICAgICBAcGFyZW50LmNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyh0aGlzKVxuICAgICAgICBAXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgICAjXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VuZCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBqc29uLnByZXYgPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAganNvbi5uZXh0ID0gQG5leHRfY2wuZ2V0VWlkKClcblxuICAgICAgaWYgQG9yaWdpbi50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAganNvbi5vcmlnaW4gPSBcIkRlbGltaXRlclwiXG4gICAgICBlbHNlIGlmIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uLm9yaWdpbiA9IEBvcmlnaW4uZ2V0VWlkKClcblxuICAgICAgIyBpZiBub3QgKGpzb24ucHJldj8gYW5kIGpzb24ubmV4dD8pXG4gICAgICBqc29uLnBhcmVudCA9IEBwYXJlbnQuZ2V0VWlkKClcblxuICAgICAgc3VwZXIganNvblxuXG4gIG9wcy5JbnNlcnQucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdjb250ZW50X29wZXJhdGlvbnMnIDogY29udGVudF9vcGVyYXRpb25zXG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAncGFyZW50JyA6IHBhcmVudFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMgbnVsbCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zLCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgZGVsaW1pdGVyIGlzIHBsYWNlZCBhdCB0aGUgZW5kIGFuZCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgIyBUaGlzIGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBoYXZlIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgZXZlbiBpZiB0aGUgY29udGVudFxuICAjIG9mIHRoZSBFbmdpbmUgaXMgZW1wdHkuXG4gICNcbiAgY2xhc3Mgb3BzLkRlbGltaXRlciBleHRlbmRzIG9wcy5PcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAocHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIG51bGwsIHtub09wZXJhdGlvbjogdHJ1ZX1cblxuICAgIHR5cGU6IFwiRGVsaW1pdGVyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB1bmNoZWNrZWQ/WyduZXh0X2NsJ10/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEB1bmNoZWNrZWQ/WydwcmV2X2NsJ11cbiAgICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgICBpZiBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUHJvYmFibHkgZHVwbGljYXRlZCBvcGVyYXRpb25zXCJcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIHN1cGVyXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBmYWxzZVxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gYW5kIG5vdCBAcHJldl9jbC5uZXh0X2NsP1xuICAgICAgICBkZWxldGUgQHByZXZfY2wudW5jaGVja2VkLm5leHRfY2xcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IG9yIEBuZXh0X2NsPyBvciB0cnVlICMgVE9ETzogYXJlIHlvdSBzdXJlPyBUaGlzIGNhbiBoYXBwZW4gcmlnaHQ/XG4gICAgICAgIHN1cGVyXG4gICAgICAjZWxzZVxuICAgICAgIyAgdGhyb3cgbmV3IEVycm9yIFwiRGVsaW1pdGVyIGlzIHVuc3VmZmljaWVudCBkZWZpbmVkIVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJyA6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBvcHMuRGVsaW1pdGVyLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkLCBwcmV2LCBuZXh0KVxuXG4gICMgVGhpcyBpcyB3aGF0IHRoaXMgbW9kdWxlIGV4cG9ydHMgYWZ0ZXIgaW5pdGlhbGl6aW5nIGl0IHdpdGggdGhlIEhpc3RvcnlCdWZmZXJcbiAge1xuICAgICdvcGVyYXRpb25zJyA6IG9wc1xuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cbiIsImJhc2ljX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vQmFzaWNcIlxuUkJUUmVlQnlJbmRleCA9IHJlcXVpcmUgJ2JpbnRyZWVzL2xpYi9yYnRyZWVfYnlfaW5kZXgnXG5cbm1vZHVsZS5leHBvcnRzID0gKCktPlxuICBiYXNpY19vcHMgPSBiYXNpY19vcHNfdW5pbml0aWFsaXplZCgpXG4gIG9wcyA9IGJhc2ljX29wcy5vcGVyYXRpb25zXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgbWFwIGxpa2Ugb2JqZWN0cy4gRS5nLiBKc29uLVR5cGUgYW5kIFhNTCBhdHRyaWJ1dGVzLlxuICAjXG4gIGNsYXNzIG9wcy5NYXBNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucyktPlxuICAgICAgQF9tYXAgPSB7fVxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIk1hcE1hbmFnZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIGZvciBuYW1lLHAgb2YgQF9tYXBcbiAgICAgICAgcC5hcHBseURlbGV0ZSgpXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBtYXA6IChmKS0+XG4gICAgICBmb3Igbix2IG9mIEBfbWFwXG4gICAgICAgIGYobix2KVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBAc2VlIEpzb25PcGVyYXRpb25zLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5fZ2V0TW9kZWw/XG4gICAgICAgICAgcmVwID0gY29udGVudC5fZ2V0TW9kZWwoQGN1c3RvbV90eXBlcywgQG9wZXJhdGlvbnMpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXAgPSBjb250ZW50XG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIHJlcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBlbHNlIGlmIG5hbWU/XG4gICAgICAgIHByb3AgPSBAX21hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcmVzID0gcHJvcC52YWwoKVxuICAgICAgICAgIGlmIHJlcyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICAgIHJlcy5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXNcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBfbWFwXG4gICAgICAgICAgaWYgbm90IG8uaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgICByZXN1bHRbbmFtZV0gPSBvLnZhbCgpXG4gICAgICAgIHJlc3VsdFxuXG4gICAgZGVsZXRlOiAobmFtZSktPlxuICAgICAgQF9tYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQF9tYXBbcHJvcGVydHlfbmFtZV0/XG4gICAgICAgIGV2ZW50X3Byb3BlcnRpZXMgPVxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5X25hbWVcbiAgICAgICAgZXZlbnRfdGhpcyA9IEBcbiAgICAgICAgcm1fdWlkID1cbiAgICAgICAgICBub09wZXJhdGlvbjogdHJ1ZVxuICAgICAgICAgIHN1YjogcHJvcGVydHlfbmFtZVxuICAgICAgICAgIGFsdDogQFxuICAgICAgICBybSA9IG5ldyBvcHMuUmVwbGFjZU1hbmFnZXIgbnVsbCwgZXZlbnRfcHJvcGVydGllcywgZXZlbnRfdGhpcywgcm1fdWlkICMgdGhpcyBvcGVyYXRpb24gc2hhbGwgbm90IGJlIHNhdmVkIGluIHRoZSBIQlxuICAgICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXSA9IHJtXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxuICAgICAgQF9tYXBbcHJvcGVydHlfbmFtZV1cblxuICBvcHMuTWFwTWFuYWdlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjdXN0b21fdHlwZScgOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIE1hbmFnZXMgYSBsaXN0IG9mIEluc2VydC10eXBlIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3Mgb3BzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XG4gICAgICBAYmVnaW5uaW5nID0gbmV3IG9wcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWRcbiAgICAgIEBlbmQgPSAgICAgICBuZXcgb3BzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxuXG5cbiAgICAgICMgVGhlIHNob3J0IHRyZWUgaXMgc3RvcmluZyB0aGUgbm9uIGRlbGV0ZWQgb3BlcmF0aW9uc1xuICAgICAgQHNob3J0VHJlZSA9IG5ldyBSQlRyZWVCeUluZGV4KClcbiAgICAgICMgVGhlIGNvbXBsZXRlIHRyZWUgaXMgc3RvcmluZyBhbGwgdGhlIG9wZXJhdGlvbnNcbiAgICAgIEBjb21wbGV0ZVRyZWUgPSBuZXcgUkJUcmVlQnlJbmRleCgpXG5cbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9uc1xuXG4gICAgdHlwZTogXCJMaXN0TWFuYWdlclwiXG5cblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cbiAgICAgIHZhbCA9IEB2YWwoKVxuICAgICAgZm9yIGksIG8gaW4gdmFsXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiBvcHMuT2JqZWN0XG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiBvcHMuTGlzdE1hbmFnZXJcbiAgICAgICAgICBvLnRvSnNvbih0cmFuc2Zvcm1fdG9fdmFsdWUpXG4gICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBnZXQgdGhlIG5leHQgbm9uLWRlbGV0ZWQgb3BlcmF0aW9uXG4gICAgZ2V0TmV4dE5vbkRlbGV0ZWQ6IChzdGFydCktPlxuICAgICAgaWYgc3RhcnQuaXNEZWxldGVkKCkgb3Igbm90IHN0YXJ0Lm5vZGU/XG4gICAgICAgIG9wZXJhdGlvbiA9IHN0YXJ0Lm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90ICgob3BlcmF0aW9uIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcikpXG4gICAgICAgICAgaWYgb3BlcmF0aW9uLmlzX2RlbGV0ZWRcbiAgICAgICAgICAgIG9wZXJhdGlvbiA9IG9wZXJhdGlvbi5uZXh0X2NsXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgIGVsc2VcbiAgICAgICAgb3BlcmF0aW9uID0gc3RhcnQubm9kZS5uZXh0Lm5vZGVcbiAgICAgICAgaWYgbm90IG9wZXJhdGlvblxuICAgICAgICAgIHJldHVybiBmYWxzZVxuXG4gICAgICBvcGVyYXRpb25cblxuICAgIGdldFByZXZOb25EZWxldGVkOiAoc3RhcnQpIC0+XG4gICAgICBpZiBzdGFydC5pc0RlbGV0ZWQoKSBvciBub3Qgc3RhcnQubm9kZT9cbiAgICAgICAgb3BlcmF0aW9uID0gc3RhcnQucHJldl9jbFxuICAgICAgICB3aGlsZSBub3QgKChvcGVyYXRpb24gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyKSlcbiAgICAgICAgICBpZiBvcGVyYXRpb24uaXNfZGVsZXRlZFxuICAgICAgICAgICAgb3BlcmF0aW9uID0gb3BlcmF0aW9uLnByZXZfY2xcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBicmVha1xuICAgICAgZWxzZVxuICAgICAgICBvcGVyYXRpb24gPSBzdGFydC5ub2RlLnByZXYubm9kZVxuICAgICAgICBpZiBub3Qgb3BlcmF0aW9uXG4gICAgICAgICAgcmV0dXJuIGZhbHNlXG5cbiAgICAgIG9wZXJhdGlvblxuXG5cbiAgICAjIFRyYW5zZm9ybXMgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIEBzaG9ydFRyZWUubWFwIChvcGVyYXRpb24pIC0+XG4gICAgICAgIG9wZXJhdGlvbi52YWwoKVxuXG4gICAgbWFwOiAoZnVuKS0+XG4gICAgICBAc2hvcnRUcmVlLm1hcCBmdW5cblxuICAgIGZvbGQ6IChpbml0LCBmdW4pLT5cbiAgICAgIEBzaG9ydFRyZWUubWFwIChvcGVyYXRpb24pIC0+XG4gICAgICAgIGluaXQgPSBmdW4oaW5pdCwgb3BlcmF0aW9uKVxuXG4gICAgdmFsOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIEBzaG9ydFRyZWUuZmluZChwb3MpLnZhbCgpXG4gICAgICBlbHNlXG4gICAgICAgIEB0b0FycmF5KClcblxuICAgIHJlZjogKHBvcyktPlxuICAgICAgaWYgcG9zP1xuICAgICAgICBAc2hvcnRUcmVlLmZpbmQocG9zKVxuICAgICAgZWxzZVxuICAgICAgICBAc2hvcnRUcmVlLm1hcCAob3BlcmF0aW9uKSAtPlxuICAgICAgICAgIG9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgUmV0cmlldmVzIHRoZSB4LXRoIG5vdCBkZWxldGVkIGVsZW1lbnQuXG4gICAgIyBlLmcuIFwiYWJjXCIgOiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICMgdGhlIDB0aCBjaGFyYWN0ZXIgaXMgdGhlIGxlZnQgRGVsaW1pdGVyXG4gICAgI1xuICAgIGdldE9wZXJhdGlvbkJ5UG9zaXRpb246IChwb3NpdGlvbiktPlxuICAgICAgaWYgcG9zaXRpb24gPT0gMFxuICAgICAgICBAYmVnaW5uaW5nXG4gICAgICBlbHNlIGlmIHBvc2l0aW9uID09IEBzaG9ydFRyZWUuc2l6ZSArIDFcbiAgICAgICAgQGVuZFxuICAgICAgZWxzZVxuICAgICAgICBAc2hvcnRUcmVlLmZpbmQgKHBvc2l0aW9uLTEpXG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgW2NvbnRlbnRdXG5cbiAgICBpbnNlcnRBZnRlckhlbHBlcjogKHJvb3QsIGNvbnRlbnQpLT5cbiAgICAgIGlmICFyb290LnJpZ2h0XG4gICAgICAgIHJvb3QuYnQucmlnaHQgPSBjb250ZW50XG4gICAgICAgIGNvbnRlbnQuYnQucGFyZW50ID0gcm9vdFxuICAgICAgZWxzZVxuICAgICAgICByaWdodCA9IHJvb3QubmV4dF9jbFxuXG5cbiAgICBpbnNlcnRBZnRlcjogKGxlZnQsIGNvbnRlbnRzKS0+XG4gICAgICBpZiBsZWZ0IGlzIEBiZWdpbm5pbmdcbiAgICAgICAgbGVmdE5vZGUgPSBudWxsXG4gICAgICAgIHJpZ2h0Tm9kZSA9IEBzaG9ydFRyZWUuZmluZE5vZGUgMFxuICAgICAgICByaWdodCA9IGlmIHJpZ2h0Tm9kZSB0aGVuIHJpZ2h0Tm9kZS5kYXRhIGVsc2UgQGVuZFxuICAgICAgZWxzZVxuICAgICAgICAjIGxlZnQubm9kZSBzaG91bGQgYWx3YXlzIGV4aXN0IChpbnNlcnQgYWZ0ZXIgYSBub24tZGVsZXRlZCBlbGVtZW50KVxuICAgICAgICByaWdodE5vZGUgPSBsZWZ0Lm5vZGUubmV4dFxuICAgICAgICBsZWZ0Tm9kZSA9IGxlZnQubm9kZVxuICAgICAgICByaWdodCA9IGlmIHJpZ2h0Tm9kZSB0aGVuIHJpZ2h0Tm9kZS5kYXRhIGVsc2UgQGVuZFxuXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxuXG4gICAgICAjIFRPRE86IGFsd2F5cyBleHBlY3QgYW4gYXJyYXkgYXMgY29udGVudC4gVGhlbiB5b3UgY2FuIGNvbWJpbmUgdGhpcyB3aXRoIHRoZSBvdGhlciBvcHRpb24gKGVsc2UpXG4gICAgICBpZiBjb250ZW50cyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgdG1wID0gbmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0XG4gICAgICAgIHRtcC5leGVjdXRlKClcbiAgICAgIGVsc2VcbiAgICAgICAgZm9yIGMgaW4gY29udGVudHNcbiAgICAgICAgICBpZiBjPyBhbmQgYy5fbmFtZT8gYW5kIGMuX2dldE1vZGVsP1xuICAgICAgICAgICAgYyA9IGMuX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICAgIHRtcCA9IG5ldyBvcHMuSW5zZXJ0IG51bGwsIGMsIG51bGwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodFxuICAgICAgICAgIHRtcC5leGVjdXRlKClcbiAgICAgICAgICBsZWZ0Tm9kZSA9IHRtcC5ub2RlXG5cbiAgICAgICAgICBsZWZ0ID0gdG1wXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGFuIGFycmF5IG9mIGNvbnRlbnQgaW50byB0aGlzIGxpc3QuXG4gICAgIyBATm90ZTogVGhpcyBleHBlY3RzIGFuIGFycmF5IGFzIGNvbnRlbnQhXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudHMpLT5cbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICAgQGluc2VydEFmdGVyIGl0aCwgY29udGVudHNcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdFxuICAgICNcbiAgICBkZWxldGVSZWY6IChvcGVyYXRpb24sIGxlbmd0aCA9IDEsIGRpciA9ICdyaWdodCcpIC0+XG4gICAgICBuZXh0T3BlcmF0aW9uID0gKG9wZXJhdGlvbikgPT5cbiAgICAgICAgaWYgZGlyID09ICdyaWdodCcgdGhlbiBAZ2V0TmV4dE5vbkRlbGV0ZWQgb3BlcmF0aW9uIGVsc2UgQGdldFByZXZOb25EZWxldGVkIG9wZXJhdGlvblxuXG4gICAgICBmb3IgaSBpbiBbMC4uLmxlbmd0aF1cbiAgICAgICAgaWYgb3BlcmF0aW9uIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlbGV0ZU9wZXJhdGlvbiA9IChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIG9wZXJhdGlvbikuZXhlY3V0ZSgpXG5cbiAgICAgICAgb3BlcmF0aW9uID0gbmV4dE9wZXJhdGlvbiBvcGVyYXRpb25cbiAgICAgIEBcblxuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGggPSAxKS0+XG4gICAgICBvcGVyYXRpb24gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbitsZW5ndGgpICMgcG9zaXRpb24gMCBpbiB0aGlzIGNhc2UgaXMgdGhlIGRlbGV0aW9uIG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXJcblxuICAgICAgQGRlbGV0ZVJlZiBvcGVyYXRpb24sIGxlbmd0aCwgJ2xlZnQnXG5cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wZXJhdGlvbiktPlxuICAgICAgcHJldiA9IChAZ2V0UHJldk5vbkRlbGV0ZWQgb3BlcmF0aW9uKSBvciBAYmVnaW5uaW5nXG4gICAgICBwcmV2Tm9kZSA9IGlmIHByZXYgdGhlbiBwcmV2Lm5vZGUgZWxzZSBudWxsXG5cbiAgICAgIG5leHQgPSAoQGdldE5leHROb25EZWxldGVkIG9wZXJhdGlvbikgb3IgQGVuZFxuICAgICAgbmV4dE5vZGUgPSBpZiBuZXh0IHRoZW4gbmV4dC5ub2RlIGVsc2UgbnVsbFxuICAgICAgb3BlcmF0aW9uLm5vZGUgPSBvcGVyYXRpb24ubm9kZSBvciAoQHNob3J0VHJlZS5pbnNlcnRfYmV0d2VlbiBwcmV2Tm9kZSwgbmV4dE5vZGUsIG9wZXJhdGlvbilcbiAgICAgIG9wZXJhdGlvbi5jb21wbGV0ZU5vZGUgPSBvcGVyYXRpb24uY29tcGxldGVOb2RlIG9yIChAY29tcGxldGVUcmVlLmluc2VydF9iZXR3ZWVuIG9wZXJhdGlvbi5wcmV2X2NsLmNvbXBsZXRlTm9kZSwgb3BlcmF0aW9uLm5leHRfY2wuY29tcGxldGVOb2RlLCBvcGVyYXRpb24pXG5cbiAgICAgIGdldENvbnRlbnRUeXBlID0gKGNvbnRlbnQpLT5cbiAgICAgICAgaWYgY29udGVudCBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBjb250ZW50LmdldEN1c3RvbVR5cGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY29udGVudFxuXG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJpbnNlcnRcIlxuICAgICAgICByZWZlcmVuY2U6IG9wZXJhdGlvblxuICAgICAgICBwb3NpdGlvbjogb3BlcmF0aW9uLm5vZGUucG9zaXRpb24oKVxuICAgICAgICBvYmplY3Q6IEBnZXRDdXN0b21UeXBlKClcbiAgICAgICAgY2hhbmdlZEJ5OiBvcGVyYXRpb24udWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIG9wZXJhdGlvbi52YWwoKVxuICAgICAgXVxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAob3BlcmF0aW9uLCBkZWxfb3ApLT5cbiAgICAgIGlmIG9wZXJhdGlvbi5ub2RlXG4gICAgICAgIHBvc2l0aW9uID0gb3BlcmF0aW9uLm5vZGUucG9zaXRpb24oKVxuICAgICAgICBAc2hvcnRUcmVlLnJlbW92ZV9ub2RlIG9wZXJhdGlvbi5ub2RlXG4gICAgICAgIG9wZXJhdGlvbi5ub2RlID0gbnVsbFxuXG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICByZWZlcmVuY2U6IG9wZXJhdGlvblxuICAgICAgICBwb3NpdGlvbjogcG9zaXRpb25cbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpICMgVE9ETzogWW91IGNhbiBjb21iaW5lIGdldFBvc2l0aW9uICsgZ2V0UGFyZW50IGluIGEgbW9yZSBlZmZpY2llbnQgbWFubmVyISAob25seSBsZWZ0IERlbGltaXRlciB3aWxsIGhvbGQgQHBhcmVudClcbiAgICAgICAgbGVuZ3RoOiAxXG4gICAgICAgIGNoYW5nZWRCeTogZGVsX29wLnVpZC5jcmVhdG9yXG4gICAgICAgIG9sZFZhbHVlOiBvcGVyYXRpb24udmFsKClcbiAgICAgIF1cblxuICBvcHMuTGlzdE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuICBjbGFzcyBvcHMuQ29tcG9zaXRpb24gZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcblxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBfY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgdG1wX2NvbXBvc2l0aW9uX3JlZiktPlxuICAgICAgIyB3ZSBjYW4ndCB1c2UgQHNldmVPcGVyYXRpb24gJ2NvbXBvc2l0aW9uX3JlZicsIHRtcF9jb21wb3NpdGlvbl9yZWYgaGVyZSxcbiAgICAgICMgYmVjYXVzZSB0aGVuIHRoZXJlIGlzIGEgXCJsb29wXCIgKGluc2VydGlvbiByZWZlcnMgdG8gcGFyZW50LCByZWZlcnMgdG8gaW5zZXJ0aW9uLi4pXG4gICAgICAjIFRoaXMgaXMgd2h5IHdlIGhhdmUgdG8gY2hlY2sgaW4gQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyB1bnRpbCB3ZSBmaW5kIGl0XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG4gICAgICBpZiB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBAdG1wX2NvbXBvc2l0aW9uX3JlZiA9IHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxuICAgICAgaWYgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucz9cbiAgICAgICAgQGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuLCBvLCAnX2NvbXBvc2l0aW9uX3ZhbHVlJ1xuXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl9zZXRDb21wb3NpdGlvblZhbHVlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgZGVsZXRlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgIyBjaGVjayBpZiB0bXBfY29tcG9zaXRpb25fcmVmIGFscmVhZHkgZXhpc3RzXG4gICAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICAgICAgY29tcG9zaXRpb25fcmVmID0gQEhCLmdldE9wZXJhdGlvbiBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIGlmIGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IGNvbXBvc2l0aW9uX3JlZlxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC1vcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3BlcmF0aW9uKS0+XG4gICAgICBpZiBAdG1wX2NvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAgaWYgb3BlcmF0aW9uLnVpZC5jcmVhdG9yIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLmNyZWF0b3IgYW5kIG9wZXJhdGlvbi51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxuICAgICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBvcGVyYXRpb25cbiAgICAgICAgICBkZWxldGUgQHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgICAgICBvcGVyYXRpb24gPSBvcGVyYXRpb24ubmV4dF9jbFxuICAgICAgICAgIGlmIG9wZXJhdGlvbiBpcyBAZW5kXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHJldHVyblxuXG4gICAgICBvID0gQGVuZC5wcmV2X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgb3BlcmF0aW9uXG4gICAgICAgIEBnZXRDdXN0b21UeXBlKCkuX3VuYXBwbHkgby51bmRvX2RlbHRhXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIG8udW5kb19kZWx0YSA9IEBnZXRDdXN0b21UeXBlKCkuX2FwcGx5IG8udmFsKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxuXG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxuICAgICAgICBjaGFuZ2VkQnk6IG9wZXJhdGlvbi51aWQuY3JlYXRvclxuICAgICAgICBuZXdWYWx1ZTogQHZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcGVyYXRpb24sIGRlbF9vcCktPlxuICAgICAgcmV0dXJuXG5cbiAgICAjXG4gICAgIyBDcmVhdGUgYSBuZXcgRGVsdGFcbiAgICAjIC0gaW5zZXJ0cyBuZXcgQ29udGVudCBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0XG4gICAgIyAtIHVwZGF0ZXMgdGhlIGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgIyAtIHVwZGF0ZXMgdGhlIGNvbXBvc2l0aW9uX3JlZlxuICAgICNcbiAgICAjIEBwYXJhbSBkZWx0YSBUaGUgZGVsdGEgdGhhdCBpcyBhcHBsaWVkIHRvIHRoZSBjb21wb3NpdGlvbl92YWx1ZVxuICAgICNcbiAgICBhcHBseURlbHRhOiAoZGVsdGEsIG9wZXJhdGlvbnMpLT5cbiAgICAgIChuZXcgb3BzLkluc2VydCBudWxsLCBkZWx0YSwgb3BlcmF0aW9ucywgQCwgbnVsbCwgQGVuZC5wcmV2X2NsLCBAZW5kKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAgY3VzdG9tID0gQGdldEN1c3RvbVR5cGUoKS5fZ2V0Q29tcG9zaXRpb25WYWx1ZSgpXG4gICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlID0gY3VzdG9tLmNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICBpZiBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucz9cbiAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zID0ge31cbiAgICAgICAgZm9yIG4sbyBvZiBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9uc1xuICAgICAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9uc1tuXSA9IG8uZ2V0VWlkKClcbiAgICAgIGlmIEBjb21wb3NpdGlvbl9yZWY/XG4gICAgICAgIGpzb24uY29tcG9zaXRpb25fcmVmID0gQGNvbXBvc2l0aW9uX3JlZi5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3JlZiA9IEB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICBzdXBlciBqc29uXG5cbiAgb3BzLkNvbXBvc2l0aW9uLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2N1c3RvbV90eXBlJzogY3VzdG9tX3R5cGVcbiAgICAgICdjb21wb3NpdGlvbl92YWx1ZScgOiBjb21wb3NpdGlvbl92YWx1ZVxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMnIDogY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9uc1xuICAgICAgJ2NvbXBvc2l0aW9uX3JlZicgOiBjb21wb3NpdGlvbl9yZWZcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCBjb21wb3NpdGlvbl92YWx1ZSwgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucywgdWlkLCBjb21wb3NpdGlvbl9yZWYpXG5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBUZXh0VHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBUZXh0VHlwZVxuICAjXG4gIGNsYXNzIG9wcy5SZXBsYWNlTWFuYWdlciBleHRlbmRzIG9wcy5MaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF9wcm9wZXJ0aWVzIERlY29yYXRlcyB0aGUgZXZlbnQgdGhhdCBpcyB0aHJvd24gYnkgdGhlIFJNXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfdGhpcyBUaGUgb2JqZWN0IG9uIHdoaWNoIHRoZSBldmVudCBzaGFsbCBiZSBleGVjdXRlZFxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCBAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCktPlxuICAgICAgaWYgbm90IEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXT9cbiAgICAgICAgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddID0gQGV2ZW50X3RoaXMuZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VNYW5hZ2VyXCJcblxuICAgICNcbiAgICAjIFRoaXMgZG9lc24ndCB0aHJvdyB0aGUgc2FtZSBldmVudHMgYXMgdGhlIExpc3RNYW5hZ2VyLiBUaGVyZWZvcmUsIHRoZVxuICAgICMgUmVwbGFjZWFibGVzIGFsc28gbm90IHRocm93IHRoZSBzYW1lIGV2ZW50cy5cbiAgICAjIFNvLCBSZXBsYWNlTWFuYWdlciBhbmQgTGlzdE1hbmFnZXIgYm90aCBpbXBsZW1lbnRcbiAgICAjIHRoZXNlIGZ1bmN0aW9ucyB0aGF0IGFyZSBjYWxsZWQgd2hlbiBhbiBJbnNlcnRpb24gaXMgZXhlY3V0ZWQgKGF0IHRoZSBlbmQpLlxuICAgICNcbiAgICAjXG4gICAgY2FsbEV2ZW50RGVjb3JhdG9yOiAoZXZlbnRzKS0+XG4gICAgICBpZiBub3QgQGlzRGVsZXRlZCgpXG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBmb3IgbmFtZSxwcm9wIG9mIEBldmVudF9wcm9wZXJ0aWVzXG4gICAgICAgICAgICBldmVudFtuYW1lXSA9IHByb3BcbiAgICAgICAgQGV2ZW50X3RoaXMuY2FsbEV2ZW50IGV2ZW50c1xuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBUaGlzIGlzIGNhbGxlZCwgd2hlbiB0aGUgSW5zZXJ0LXR5cGUgd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjIFRPRE86IGNvbnNpZGVyIGRvaW5nIHRoaXMgaW4gYSBtb3JlIGNvbnNpc3RlbnQgbWFubmVyLiBUaGlzIGNvdWxkIGFsc28gYmVcbiAgICAjIGRvbmUgd2l0aCBleGVjdXRlLiBCdXQgY3VycmVudGx5LCB0aGVyZSBhcmUgbm8gc3BlY2l0YWwgSW5zZXJ0LW9wcyBmb3IgTGlzdE1hbmFnZXIuXG4gICAgI1xuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wZXJhdGlvbiktPlxuICAgICAgaWYgb3BlcmF0aW9uLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcGVyYXRpb24ucHJldl9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIHRoaXMgcmVwbGFjZXMgYW5vdGhlciBSZXBsYWNlYWJsZVxuICAgICAgICBpZiBub3Qgb3BlcmF0aW9uLmlzX2RlbGV0ZWQgIyBXaGVuIHRoaXMgaXMgcmVjZWl2ZWQgZnJvbSB0aGUgSEIsIHRoaXMgY291bGQgYWxyZWFkeSBiZSBkZWxldGVkIVxuICAgICAgICAgIG9sZF92YWx1ZSA9IG9wZXJhdGlvbi5wcmV2X2NsLnZhbCgpXG4gICAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wZXJhdGlvbi51aWQuY3JlYXRvclxuICAgICAgICAgICAgb2xkVmFsdWU6IG9sZF92YWx1ZVxuICAgICAgICAgIF1cbiAgICAgICAgb3BlcmF0aW9uLnByZXZfY2wuYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSBpZiBvcGVyYXRpb24ubmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBvcGVyYXRpb24uYXBwbHlEZWxldGUoKVxuICAgICAgZWxzZSAjIHByZXYgX2FuZF8gbmV4dCBhcmUgRGVsaW1pdGVycy4gVGhpcyBpcyB0aGUgZmlyc3QgY3JlYXRlZCBSZXBsYWNlYWJsZSBpbiB0aGUgUk1cbiAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgdHlwZTogXCJhZGRcIlxuICAgICAgICAgIGNoYW5nZWRCeTogb3BlcmF0aW9uLnVpZC5jcmVhdG9yXG4gICAgICAgIF1cbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzOiAob3BlcmF0aW9uLCBkZWxfb3ApLT5cbiAgICAgIGlmIG9wZXJhdGlvbi5uZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIlxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImRlbGV0ZVwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBkZWxfb3AudWlkLmNyZWF0b3JcbiAgICAgICAgICBvbGRWYWx1ZTogb3BlcmF0aW9uLnZhbCgpXG4gICAgICAgIF1cblxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgICMgQHBhcmFtIGNvbnRlbnQge09wZXJhdGlvbn0gVGhlIG5ldyB2YWx1ZSBvZiB0aGlzIFJlcGxhY2VNYW5hZ2VyLlxuICAgICMgQHBhcmFtIHJlcGxhY2VhYmxlX3VpZCB7VUlEfSBPcHRpb25hbDogVW5pcXVlIGlkIG9mIHRoZSBSZXBsYWNlYWJsZSB0aGF0IGlzIGNyZWF0ZWRcbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQsIHJlcGxhY2VhYmxlX3VpZCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIHJlbHAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgY29udGVudCwgbnVsbCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2wpLmV4ZWN1dGUoKVxuICAgICAgIyBUT0RPOiBkZWxldGUgcmVwbCAoZm9yIGRlYnVnZ2luZylcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgaXNDb250ZW50RGVsZXRlZDogKCktPlxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxuXG4gICAgZGVsZXRlQ29udGVudDogKCktPlxuICAgICAgbGFzdF9vcCA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIGlmIChub3QgbGFzdF9vcC5pc0RlbGV0ZWQoKSkgYW5kIGxhc3Rfb3AudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgQGdldExhc3RPcGVyYXRpb24oKS51aWQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXNcbiAgICAjIEByZXR1cm4ge1N0cmluZ31cbiAgICAjXG4gICAgdmFsOiAoKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgI2lmIG8gaW5zdGFuY2VvZiBvcHMuRGVsaW1pdGVyXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiUmVwbGFjZSBNYW5hZ2VyIGRvZXNuJ3QgY29udGFpbiBhbnl0aGluZy5cIlxuICAgICAgby52YWw/KCkgIyA/IC0gZm9yIHRoZSBjYXNlIHRoYXQgKGN1cnJlbnRseSkgdGhlIFJNIGRvZXMgbm90IGNvbnRhaW4gYW55dGhpbmcgKHRoZW4gbyBpcyBhIERlbGltaXRlcilcblxuICBiYXNpY19vcHNcbiIsIlxuc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL09wZXJhdGlvbnMvU3RydWN0dXJlZFwiXG5cbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuL0VuZ2luZVwiXG5hZGFwdENvbm5lY3RvciA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckFkYXB0ZXJcIlxuXG5jcmVhdGVZID0gKGNvbm5lY3RvciktPlxuICBpZiBjb25uZWN0b3IudXNlcl9pZD9cbiAgICB1c2VyX2lkID0gY29ubmVjdG9yLnVzZXJfaWQgIyBUT0RPOiBjaGFuZ2UgdG8gZ2V0VW5pcXVlSWQoKVxuICBlbHNlXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxuICAgIGNvbm5lY3Rvci53aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnMgPSBbKHN0YXRlX3ZlY3RvciktPlxuICAgICAgICBIQi5zZXRVc2VySWQgdGhpcy51c2VyX2lkLCBzdGF0ZV92ZWN0b3JcbiAgICAgIF1cbiAgSEIgPSBuZXcgSGlzdG9yeUJ1ZmZlciB1c2VyX2lkXG4gIG9wc19tYW5hZ2VyID0gc3RydWN0dXJlZF9vcHNfdW5pbml0aWFsaXplZCBIQiwgdGhpcy5jb25zdHJ1Y3RvclxuICBvcHMgPSBvcHNfbWFuYWdlci5vcGVyYXRpb25zXG5cbiAgZW5naW5lID0gbmV3IEVuZ2luZSBIQiwgb3BzXG4gIGFkYXB0Q29ubmVjdG9yIGNvbm5lY3RvciwgZW5naW5lLCBIQiwgb3BzX21hbmFnZXIuZXhlY3V0aW9uX2xpc3RlbmVyXG5cbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuSEIgPSBIQlxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5vcGVyYXRpb25zID0gb3BzXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmVuZ2luZSA9IGVuZ2luZVxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jb25uZWN0b3IgPSBjb25uZWN0b3JcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuY3VzdG9tX3R5cGVzID0gdGhpcy5jb25zdHJ1Y3RvclxuXG4gIGN0ID0gbmV3IGNyZWF0ZVkuT2JqZWN0KClcbiAgbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoY3QsIEhCLmdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcigpKS5leGVjdXRlKClcbiAgY3QuX3NldE1vZGVsIG1vZGVsXG4gIGN0XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlWVxuaWYgd2luZG93P1xuICB3aW5kb3cuWSA9IGNyZWF0ZVlcblxuY3JlYXRlWS5PYmplY3QgPSByZXF1aXJlIFwiLi9PYmplY3RUeXBlXCJcbiIsInZhciBUcmVlQmFzZSA9IHJlcXVpcmUoJy4vdHJlZWJhc2UnKTtcbi8qKiBhbGdvcml0aG0gZnJvbSBDb3JtZW4sIExlaXNlcnNvbiAtIEludHJvZHVjdGlvbiB0byBhbGdvcml0aG0gKiovXG5cbmZ1bmN0aW9uIFJCVHJlZShjb21wYXJhdG9yKSB7XG4gICAgdGhpcy5fcm9vdCA9IG51bGw7XG4gICAgdGhpcy5fbmlsID0gbmV3IE5vZGUoJ25pbCcpO1xuICAgIHRoaXMuX25pbC5yZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9uaWwud2VpZ2h0ID0gMDtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnc2l6ZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yb290ID8gdGhpcy5fcm9vdC53ZWlnaHQgOiAwO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cblJCVHJlZS5wcm90b3R5cGUgPSBuZXcgVHJlZUJhc2UoKTtcblxuUkJUcmVlLnByb3RvdHlwZS5pbnNlcnQgPSBmdW5jdGlvbihwb3NpdGlvbiwgZGF0YSkge1xuICB2YXIgbm9kZVRvSW5zZXJ0ID0gbmV3IE5vZGUoZGF0YSk7XG4gIGlmICh0aGlzLmluc2VydF9ub2RlKHBvc2l0aW9uLCBub2RlVG9JbnNlcnQpKSB7XG4gICAgcmV0dXJuIG5vZGVUb0luc2VydDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn07XG5cblJCVHJlZS5wcm90b3R5cGUuaW5zZXJ0X25vZGUgPSBmdW5jdGlvbihwb3NpdGlvbiwgbm9kZVRvSW5zZXJ0KSB7XG4gIHZhciBub2RlID0gdGhpcy5fcm9vdDtcbiAgdmFyIGluc2VydEFmdGVyO1xuXG4gIGlmICghbm9kZSkge1xuICAgIHRoaXMuX3Jvb3QgPSBub2RlVG9JbnNlcnQ7XG4gICAgdGhpcy5fcm9vdC5yZWQgPSBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgaWYgKG5vZGUud2VpZ2h0ID09PSBwb3NpdGlvbikgeyAvLyBJbnNlcnQgYWZ0ZXIgbWF4IG9mIG5vZGUgc3VidHJlZVxuICAgICAgaW5zZXJ0QWZ0ZXIgPSBub2RlLm1heF90cmVlKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgbm9kZS53ZWlnaHQgKz0gMTtcbiAgICAgIH0pO1xuICAgICAgaW5zZXJ0QWZ0ZXIuc2V0X2NoaWxkKCdyaWdodCcsIG5vZGVUb0luc2VydCk7XG4gICAgICBub2RlVG9JbnNlcnQucGFyZW50ID0gaW5zZXJ0QWZ0ZXI7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2Uge1xuICAgICAgbGVmdCA9IG5vZGUuZ2V0X2NoaWxkKCdsZWZ0Jyk7XG4gICAgICByaWdodCA9IG5vZGUuZ2V0X2NoaWxkKCdyaWdodCcpO1xuICAgICAgaWYgKCFsZWZ0ICYmIHBvc2l0aW9uID09PSAwKSB7XG4gICAgICAgIG5vZGUud2VpZ2h0ICs9IDE7XG4gICAgICAgIG5vZGUuc2V0X2NoaWxkKCdsZWZ0Jywgbm9kZVRvSW5zZXJ0KTtcbiAgICAgICAgbm9kZVRvSW5zZXJ0LnBhcmVudCA9IG5vZGU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICB9IGVsc2UgaWYgKGxlZnQgJiYgbGVmdC53ZWlnaHQgPj0gcG9zaXRpb24pIHtcbiAgICAgICAgbm9kZS53ZWlnaHQgKz0gMTtcbiAgICAgICAgbm9kZSA9IGxlZnQ7XG5cbiAgICAgIH0gZWxzZSBpZiAocmlnaHQpIHtcbiAgICAgICAgcG9zaXRpb24gLT0gKGxlZnQ/IGxlZnQud2VpZ2h0OiAwKSArIDE7XG4gICAgICAgIG5vZGUud2VpZ2h0ICs9IDE7XG4gICAgICAgIG5vZGUgPSByaWdodDtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZS53ZWlnaHQgKz0gMTtcbiAgICAgICAgbm9kZS5zZXRfY2hpbGQoJ3JpZ2h0Jywgbm9kZVRvSW5zZXJ0KTtcbiAgICAgICAgbm9kZVRvSW5zZXJ0LnBhcmVudCA9IG5vZGU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHRoaXMuaW5zZXJ0X2NvcnJlY3Rpb24obm9kZVRvSW5zZXJ0KTtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmluc2VydF9iZXR3ZWVuID0gZnVuY3Rpb24ob25MZWZ0LCBvblJpZ2h0LCBkYXRhKSB7XG4gIHZhciBuZXdOb2RlID0gbmV3IE5vZGUoZGF0YSk7XG4gIC8vIG9uTGVmdCBhbmQgb25SaWdodCBhcmUgbmVpZ2hib3JzLCBzbyB0aGV5IGNhbid0IGhhdmUgYW4gZWxlbWVudCBpbiBiZXR3ZWVuLlxuICAvLyBGb3IgZXhhbXBsZSwgaWYgb25MZWZ0IGV4aXN0cywgaXRzIHJpZ2h0IG5laWdoYm9yIGlzIGVpdGhlciBuaWwgb3IgcmlnaHQuIElmIGl0J3Mgb25SaWdodCxcbiAgLy8gdGhlbiBvblJpZ2h0IGhhcyBubyBjaGlsZC4gSWYgbmVpdGhlciBsZWZ0IGFuZCByaWdodCBleGlzdCwgdGhlIHRyZWUgaXMgZW1wdHkuXG4gIGlmIChvbkxlZnQgJiYgIW9uTGVmdC5yaWdodCkge1xuICAgIG9uTGVmdC5yaWdodCA9IG5ld05vZGU7XG4gICAgbmV3Tm9kZS5wYXJlbnQgPSBvbkxlZnQ7XG5cbiAgICB0aGlzLmluc2VydF9jb3JyZWN0aW9uKG5ld05vZGUpO1xuICB9IGVsc2UgaWYgKG9uUmlnaHQgJiYgIW9uUmlnaHQubGVmdCkge1xuICAgIG9uUmlnaHQubGVmdCA9IG5ld05vZGU7XG4gICAgbmV3Tm9kZS5wYXJlbnQgPSBvblJpZ2h0O1xuXG4gICAgdGhpcy5pbnNlcnRfY29ycmVjdGlvbihuZXdOb2RlKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmluc2VydF9ub2RlKDAsIG5ld05vZGUpO1xuICB9XG4gIG5ld05vZGUudHJhdmVyc2VfdXAoZnVuY3Rpb24obm9kZSwgcGFyZW50KSB7XG4gICAgcGFyZW50LndlaWdodCA9IChwYXJlbnQubGVmdCA/IHBhcmVudC5sZWZ0LndlaWdodCA6IDApICtcbiAgICAgICAgKHBhcmVudC5yaWdodCA/IHBhcmVudC5yaWdodC53ZWlnaHQgOiAwKSArIDE7XG4gIH0pO1xuXG4gIHJldHVybiBuZXdOb2RlO1xufTtcblxuUkJUcmVlLnByb3RvdHlwZS5yb3RhdGUgPSBmdW5jdGlvbihzaWRlLCBub2RlKSB7XG4gIC8vIGFsbCB0aGUgY29tbWVudCBhcmUgd2l0aCB0aGUgYXNzdW1wdGlvbiB0aGF0IHNpZGUgPT09ICdsZWZ0J1xuICB2YXIgbmVpZ2hib3I7XG5cbiAgLy8gZ2V0IHJpZ2h0IG5laWdoYm9yXG4gIG5laWdoYm9yID0gbm9kZS5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSk7XG4gIC8vIG5laWdoYm9yJ3MgbGVmdCB0cmVlIGJlY29tZXMgbm9kZSdzIHJpZ2h0IHRyZWVcbiAgbm9kZS5zZXRfY2hpbGQoc2lkZSwgbmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpLCB0cnVlKTtcblxuICAvLyBpZiB0aGlzIHJpZ2h0IHRyZWUgd2FzIG5vbi1lbXB0eVxuICBpZiAobmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpKSB7XG4gICAgbmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUpLnBhcmVudCA9IG5vZGU7IC8vIGF0dGFjaCBuZWlnaGJvcidzIGxlZnQgY2hpbGQgdG8gbm9kZVxuICB9XG4gIG5laWdoYm9yLnBhcmVudCA9IG5vZGUucGFyZW50OyAvLyBsaW5rIG5laWdoYm9yJ3MgcGFyZW50IHRvIG5vZGUncyBwYXJlbnRcblxuICBpZiAoIW5vZGUucGFyZW50KSB7IC8vIG5vIHBhcmVudCA9PT0gaXNfcm9vdFxuICAgIHRoaXMuX3Jvb3QgPSBuZWlnaGJvcjtcbiAgfSBlbHNlIGlmIChub2RlID09PSBub2RlLnBhcmVudC5nZXRfY2hpbGQoc2lkZSkpeyAvLyBub2RlIGlzIGxlZnQgY2hpbGRcbiAgICBub2RlLnBhcmVudC5zZXRfY2hpbGQoc2lkZSwgbmVpZ2hib3IpOyAvLyBub2RlJ3MgcGFyZW50IGxlZnQgY2hpbGQgaXMgbm93IG5laWdoYm9yXG4gIH0gZWxzZSB7XG4gICAgbm9kZS5wYXJlbnQuc2V0X2NoaWxkKHNpZGUsIG5laWdoYm9yLCB0cnVlKTsgLy8gbm9kZSdzIHBhcmVudCByaWdodCBjaGlsZCBpcyBub3cgbmVpZ2hib3JcbiAgfVxuXG4gIG5laWdoYm9yLnNldF9jaGlsZChzaWRlLCBub2RlKTsgLy8gYXR0YWNoIG5vZGUgb24gbGVmdCBvZiBjaGlsZFxuICBub2RlLnBhcmVudCA9IG5laWdoYm9yOyAvLyBzZXQgbm9kZSdzIHBhcmVudCB0byBuZWlnaGJvclxuXG4gIC8vIHVwZGF0ZSBub2RlJ3Mgd2VpZ2h0IGZpcnN0LCB0aGVuXG4gIG5vZGUud2VpZ2h0ID0gKG5vZGUubGVmdD8gbm9kZS5sZWZ0LndlaWdodDogMCkgKyAobm9kZS5yaWdodD8gbm9kZS5yaWdodC53ZWlnaHQ6IDApICsgMTtcbiAgbmVpZ2hib3Iud2VpZ2h0ID0gKG5laWdoYm9yLmxlZnQ/IG5laWdoYm9yLmxlZnQud2VpZ2h0OiAwKSArIChuZWlnaGJvci5yaWdodD8gbmVpZ2hib3IucmlnaHQud2VpZ2h0OiAwKSArIDE7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmluc2VydF9jb3JyZWN0aW9uID0gZnVuY3Rpb24obm9kZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGZ1bmN0aW9uIGhlbHBlcihzaWRlKSB7XG4gICAgdmFyIHVuY2xlO1xuICAgIHVuY2xlID0gbm9kZS5wYXJlbnQucGFyZW50LmdldF9jaGlsZChzaWRlLCB0cnVlKTtcblxuICAgIGlmICh1bmNsZSAmJiB1bmNsZS5yZWQpIHsgLy8gaWYgdW5jbGUgaXMgdW5kZWZpbmVkLCBpdCdzIGEgbGVhZiBzbyBpdCdzIGJsYWNrXG4gICAgICBub2RlLnBhcmVudC5yZWQgICAgICAgID0gZmFsc2U7XG4gICAgICB1bmNsZS5yZWQgICAgICAgICAgICAgID0gZmFsc2U7XG4gICAgICBub2RlLnBhcmVudC5wYXJlbnQucmVkID0gdHJ1ZTtcblxuICAgICAgbm9kZSA9IG5vZGUucGFyZW50LnBhcmVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG5vZGUgPT09IG5vZGUucGFyZW50LmdldF9jaGlsZChzaWRlLCB0cnVlKSkge1xuICAgICAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gICAgICAgIHNlbGYucm90YXRlKHNpZGUsIG5vZGUpO1xuICAgICAgfVxuXG4gICAgICBub2RlLnBhcmVudC5yZWQgICAgICAgID0gZmFsc2U7XG4gICAgICBub2RlLnBhcmVudC5wYXJlbnQucmVkID0gdHJ1ZTtcblxuICAgICAgdmFyIG9wcG9zaXRlU2lkZSA9IHNpZGUgPT09ICdsZWZ0Jz8gJ3JpZ2h0JzogJ2xlZnQnO1xuICAgICAgc2VsZi5yb3RhdGUob3Bwb3NpdGVTaWRlLCBub2RlLnBhcmVudC5wYXJlbnQpO1xuICAgIH1cbiAgfVxuXG5cbiAgd2hpbGUgKG5vZGUucGFyZW50ICYmIG5vZGUucGFyZW50LnJlZCkgeyAvLyBpcyB0aGVyZSdzIG5vIG5vZGUucGFyZW50LCB0aGVuIGl0IG1lYW5zIHRoZSBwYXJlbnRcbiAgICAvLyBpcyBuaWwgd2hpY2ggaXMgYmxhY2tcblxuICAgIC8vIGlmIG5vZGUncyBwYXJlbnQgaXMgb24gbGVmdCBvZiBoaXMgcGFyZW50XG4gICAgaWYgKG5vZGUucGFyZW50ID09PSBub2RlLnBhcmVudC5wYXJlbnQuZ2V0X2NoaWxkKCdsZWZ0JykpIHsgLy8gQ2hlY2sgdGhhdCB0aGVyZSBpcyBhIGdyYW5kcGFyZW50XG4gICAgICBoZWxwZXIoJ2xlZnQnKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUucGFyZW50ID09PSBub2RlLnBhcmVudC5wYXJlbnQuZ2V0X2NoaWxkKCdyaWdodCcpKXtcbiAgICAgIGhlbHBlcigncmlnaHQnKTtcbiAgICB9XG4gIH1cblxuICB0aGlzLl9yb290LnJlZCA9IGZhbHNlO1xuXG59O1xuXG5SQlRyZWUucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIG5vZGUgPSB0aGlzLmZpbmROb2RlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIGlmIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUuZGF0YTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLyoqIEZpbmQgdGhlIG5vZGUgYXQgcG9zaXRpb24gQHBvc2l0aW9uIGFuZCByZXR1cm4gaXQuIElmIG5vIG5vZGUgaXMgZm91bmQsIHJldHVybnMgbnVsbC5cbiAqIEl0IGlzIGFsc28gcG9zc2libGUgdG8gcGFzcyBhIGZ1bmN0aW9uIGFzIHNlY29uZCBhcmd1bWVudC4gSXQgd2lsbCBiZSBjYWxsZWRcbiAqIHdpdGggZWFjaCBub2RlIHRyYXZlcnNlZCBleGNlcHQgZm9yIHRoZSBvbmUgZm91bmQuXG4qKi9cblJCVHJlZS5wcm90b3R5cGUuZmluZE5vZGUgPSBmdW5jdGlvbihwb3NpdGlvbiwgZnVuKSB7XG4gIC8vIGlmIHRoZSB3ZWlnaHQgaXMgJ24nLCB0aGUgYmlnZ2VzdCBpbmRleCBpcyBuLTEsIHNvIHdlIGNoZWNrIHRoYXQgcG9zaXRpb24gPj0gc2l6ZVxuICBpZiAocG9zaXRpb24gPj0gdGhpcy5zaXplIHx8IHBvc2l0aW9uIDwgMCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZhciBub2RlID0gdGhpcy5fcm9vdDtcblxuICBpZiAoIW5vZGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEZpbmQgbm9kZSB0byBkZWxldGVcbiAgd2hpbGUgKHBvc2l0aW9uID4gMCB8fCAocG9zaXRpb24gPT09IDAgJiYgbm9kZS5sZWZ0KSkge1xuICAgIGxlZnQgPSBub2RlLmxlZnQ7XG4gICAgcmlnaHQgPSBub2RlLnJpZ2h0O1xuXG4gICAgaWYgKGxlZnQgJiYgbGVmdC53ZWlnaHQgPiBwb3NpdGlvbikge1xuICAgICAgLy8gd2hlbiB0aGVyZSdzIGEgbGVmdCBuZWlnaGJvciB3aXRoIGEgd2VpZ2h0ID4gcG9zaXRpb24gdG8gcmVtb3ZlLFxuICAgICAgLy8gZ28gaW50byB0aGlzIHN1YnRyZWUgYW5kIGRlY3JlYXNlIHRoZSBzdWJ0cmVlIHdlaWdodFxuICAgICAgaWYgKGZ1bikge1xuICAgICAgICBmdW4obm9kZSk7XG4gICAgICB9XG4gICAgICBub2RlID0gbGVmdDtcblxuICAgIH0gZWxzZSBpZiAoKCFsZWZ0ICYmIHBvc2l0aW9uID09PSAwKSB8fCAobGVmdCAmJiBsZWZ0LndlaWdodCA9PT0gcG9zaXRpb24pKSB7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2UgaWYgKHJpZ2h0KSB7XG4gICAgICAvLyB3aGVuIHRoZXJlJ3MgYSByaWdodCBzdWJ0ZWUsIGdvIGludG8gaXQgYW5kIGRlY3JlYXNlIHRoZSBwb3NpdGlvblxuICAgICAgLy8gYnkgdGhlIHdlaWdodCBvZiB0aGUgbGVmdCBzdWJ0cmVlIC0gMSArIDEgKGZvciB0aGUgcHJldmlvdXMgbm9kZSlcbiAgICAgIGlmIChmdW4pIHtcbiAgICAgICAgZnVuKG5vZGUpO1xuICAgICAgfVxuICAgICAgbm9kZSA9IHJpZ2h0O1xuICAgICAgcG9zaXRpb24gLT0gKGxlZnQ/IGxlZnQud2VpZ2h0OiAwKSArIDE7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzaG91bGQgbm90IGhhcHBlbiwgZXhjZXB0IGlmIHRoZSBwb3NpdGlvbiBpcyBncmVhdGVyIHRoYW4gdGhlIHNpemUgb2YgdGhlIHRyZWVcbiAgICAgIHRocm93IG5ldyBFcnJvcigndGhpcyBzaG91bGQgbm90IGhhcHBlbicpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbm9kZTtcbn07XG5cblJCVHJlZS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgLy8gaWYgdGhlIHdlaWdodCBpcyAnbicsIHRoZSBiaWdnZXN0IGluZGV4IGlzIG4tMSwgc28gd2UgY2hlY2sgdGhhdCBwb3NpdGlvbiA+PSBzaXplXG4gIHZhciBub2RlVG9SZW1vdmU7XG5cbiAgbm9kZVRvUmVtb3ZlID0gdGhpcy5maW5kTm9kZShwb3NpdGlvbiwgZnVuY3Rpb24obm9kZSkgeyBub2RlLndlaWdodCAtLTsgfSk7XG5cbiAgcmV0dXJuIHRoaXMucmVtb3ZlX2hlbHBlcihub2RlVG9SZW1vdmUpO1xufTtcblxuUkJUcmVlLnByb3RvdHlwZS5yZW1vdmVfaGVscGVyID0gZnVuY3Rpb24obm9kZVRvUmVtb3ZlKSB7XG4gIHZhciBsZWZ0LCByaWdodCwgbmV4dE5vZGUsIGNoaWxkTm9kZSwgcGFyZW50O1xuXG4gIC8vIGlmIHRoZXJlJ3Mgb25seSBvbmUgY2hpbGQsIHJlcGxhY2UgdGhlIG5vZGVUb1JlbW92ZSB0byBkZWxldGUgYnkgaXQncyBjaGlsZCBhbmQgdXBkYXRlXG4gIC8vIHRoZSByZWZzLlxuICAvLyBpZiB0aGVyZSdzIHR3byBjaGlsZHJlbiwgZmluZCBpdCdzIHN1Y2Nlc3NvciBhbmQgcmVwbGFjZSB0aGUgbm9kZVRvUmVtb3ZlIHRvIGRlbGV0ZSBieSBoaXMgc3VjY2Vzc29yXG4gIC8vIGFuZCB1cGRhdGUgdGhlIHJlZnNcblxuICBpZiAoIW5vZGVUb1JlbW92ZS5sZWZ0IHx8ICFub2RlVG9SZW1vdmUucmlnaHQpIHtcbiAgICBuZXh0Tm9kZSA9IG5vZGVUb1JlbW92ZTtcbiAgfSBlbHNlIHtcbiAgICBuZXh0Tm9kZSA9IG5vZGVUb1JlbW92ZS5nZXROZXh0KGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgIG5vZGUud2VpZ2h0IC09IDE7XG4gICAgfSk7XG4gIH1cblxuICBpZiAobmV4dE5vZGUubGVmdCkge1xuICAgIGNoaWxkTm9kZSA9IG5leHROb2RlLmxlZnQ7XG4gICAgcGFyZW50ID0gbmV4dE5vZGUucGFyZW50O1xuICB9IGVsc2Uge1xuICAgIGNoaWxkTm9kZSA9IG5leHROb2RlLnJpZ2h0O1xuICAgIHBhcmVudCA9IG5leHROb2RlLnBhcmVudDtcbiAgfVxuXG4gIGlmIChjaGlsZE5vZGUpIHtcbiAgICBjaGlsZE5vZGUucGFyZW50ID0gbmV4dE5vZGUucGFyZW50O1xuICB9XG5cblxuICBpZiAoIW5leHROb2RlLnBhcmVudCkge1xuICAgIHRoaXMuX3Jvb3QgPSBjaGlsZE5vZGU7XG4gIH0gZWxzZSB7XG4gICAgaWYgKG5leHROb2RlID09PSBuZXh0Tm9kZS5wYXJlbnQubGVmdCkge1xuICAgICAgbmV4dE5vZGUucGFyZW50LmxlZnQgPSBjaGlsZE5vZGU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHROb2RlLnBhcmVudC5yaWdodCA9IGNoaWxkTm9kZTtcbiAgICB9XG4gIH1cblxuICAvLyByZXBsYWNlIG5vZGVUb1JlbW92ZSdzIGRhdGEgYnkgbmV4dE5vZGUncyAoc2FtZSBhcyByZW1vdmluZyBub2RlVG9SZW1vdmUsIHRoZW4gaW5zZXJ0aW5nIG5leHROb2RlIGF0IGhpcyBwbGFjZVxuICAvLyBidXQgZWFzaWVyIGFuZCBtb3JlIGVmZmljaWVudClcbiAgaWYgKG5leHROb2RlICE9PSBub2RlVG9SZW1vdmUpIHtcbiAgICBub2RlVG9SZW1vdmUuZGF0YSA9IG5leHROb2RlLmRhdGE7XG4gICAgbm9kZVRvUmVtb3ZlLndlaWdodCA9IChub2RlVG9SZW1vdmUubGVmdD8gbm9kZVRvUmVtb3ZlLmxlZnQud2VpZ2h0OiAwKSArXG4gICAgICAobm9kZVRvUmVtb3ZlLnJpZ2h0PyBub2RlVG9SZW1vdmUucmlnaHQud2VpZ2h0OiAwKSArIDE7XG5cbiAgfVxuXG4gIGlmICghbmV4dE5vZGUucmVkKSB7XG4gICAgdGhpcy5yZW1vdmVfY29ycmVjdGlvbihjaGlsZE5vZGUsIHBhcmVudCk7XG4gIH1cblxuICByZXR1cm4gbmV4dE5vZGU7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLnJlbW92ZV9ub2RlID0gZnVuY3Rpb24obm9kZSkge1xuICBub2RlLnRyYXZlcnNlX3VwKGZ1bmN0aW9uKG5vZGUsIHBhcmVudCkge1xuICAgIHBhcmVudC53ZWlnaHQgLS07XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzLnJlbW92ZV9oZWxwZXIobm9kZSk7XG59O1xuXG5SQlRyZWUucHJvdG90eXBlLnJlbW92ZV9jb3JyZWN0aW9uID0gZnVuY3Rpb24obm9kZSwgcGFyZW50KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIG9wcG9zaXRlU2lkZTtcbiAgdmFyIGhlbHBlciA9IGZ1bmN0aW9uKHNpZGUpIHtcbiAgICB2YXIgbmVpZ2hib3IgPSBwYXJlbnQuZ2V0X2NoaWxkKHNpZGUsIHRydWUpO1xuXG4gICAgaWYgKG5laWdoYm9yICYmIG5laWdoYm9yLnJlZCkge1xuICAgICAgbmVpZ2hib3IucmVkID0gZmFsc2U7XG4gICAgICBwYXJlbnQucmVkICAgPSB0cnVlO1xuXG4gICAgICBzZWxmLnJvdGF0ZShzaWRlLCBwYXJlbnQpO1xuICAgICAgbmVpZ2hib3IgPSBwYXJlbnQuZ2V0X2NoaWxkKHNpZGUsIHRydWUpO1xuICAgIH1cblxuICAgIGlmICgoIW5laWdoYm9yLmxlZnQgfHwgIW5laWdoYm9yLmxlZnQucmVkKSAmJiAoIW5laWdoYm9yLnJpZ2h0IHx8ICFuZWlnaGJvci5yaWdodC5yZWQgKSkge1xuICAgICAgbmVpZ2hib3IucmVkID0gdHJ1ZTtcbiAgICAgIG5vZGUgPSBwYXJlbnQ7XG4gICAgICBwYXJlbnQgPSBub2RlLnBhcmVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFuZWlnaGJvci5nZXRfY2hpbGQoc2lkZSwgdHJ1ZSkgfHwgIW5laWdoYm9yLmdldF9jaGlsZChzaWRlLCB0cnVlKS5yZWQpIHtcbiAgICAgICAgaWYgKG5laWdoYm9yLmdldF9jaGlsZChzaWRlKSkge1xuICAgICAgICAgIG5laWdoYm9yLmdldF9jaGlsZChzaWRlKS5yZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBuZWlnaGJvci5yZWQgPSB0cnVlO1xuXG4gICAgICAgIG9wcG9zaXRlU2lkZSA9IHNpZGUgPT09ICdsZWZ0Jz8gJ3JpZ2h0JzogJ2xlZnQnO1xuICAgICAgICBzZWxmLnJvdGF0ZShvcHBvc2l0ZVNpZGUsIG5laWdoYm9yKTtcbiAgICAgICAgbmVpZ2hib3IgPSBwYXJlbnQuZ2V0X2NoaWxkKHNpZGUsIHRydWUpO1xuICAgICAgfVxuXG4gICAgICBuZWlnaGJvci5yZWQgPSBwYXJlbnQ/IHBhcmVudC5yZWQ6IGZhbHNlO1xuICAgICAgcGFyZW50LnJlZCAgID0gZmFsc2U7XG4gICAgICBpZiAobmVpZ2hib3IuZ2V0X2NoaWxkKHNpZGUsIHRydWUpKSB7XG4gICAgICAgIG5laWdoYm9yLmdldF9jaGlsZChzaWRlLCB0cnVlKS5yZWQgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5yb3RhdGUoc2lkZSwgcGFyZW50KTtcbiAgICAgIG5vZGUgPSBzZWxmLl9yb290O1xuICAgICAgcGFyZW50ID0gbm9kZS5wYXJlbnQ7XG4gICAgfVxuICB9O1xuICB3aGlsZSAobm9kZSAhPT0gdGhpcy5fcm9vdCAmJiAoIW5vZGUgfHwgIW5vZGUucmVkKSkge1xuICAgIGlmIChub2RlID09PSBwYXJlbnQuZ2V0X2NoaWxkKCdsZWZ0JykpIHtcbiAgICAgIHRtcCA9IGhlbHBlcignbGVmdCcpO1xuICAgIH0gZWxzZSBpZiAobm9kZSA9PT0gcGFyZW50LmdldF9jaGlsZCgncmlnaHQnKSkge1xuICAgICAgdG1wID0gaGVscGVyKCdyaWdodCcpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChub2RlKSB7XG4gICAgbm9kZS5yZWQgPSBmYWxzZTtcbiAgfVxufTtcblxuXG5mdW5jdGlvbiBOb2RlKGRhdGEsIG5hbWUpIHtcbiAgICB0aGlzLl9kYXRhQmluZE5hbWUgPSBuYW1lIHx8ICdub2RlJztcbiAgICB0aGlzLl9kYXRhID0gZGF0YTtcblxuICAgIHRoaXMubGVmdCA9IG51bGw7XG4gICAgdGhpcy5yaWdodCA9IG51bGw7XG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xuICAgIHRoaXMucmVkID0gdHJ1ZTtcbiAgICB0aGlzLndlaWdodCA9IDE7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ25leHQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXROZXh0KCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3ByZXYnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcmV2KCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnZGF0YScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xuICAgICAgICAgICAgLy8gYmluZCB0aGUgZGF0YSB0byB0aGlzXG4gICAgICAgICAgICBkYXRhW3RoaXMuX2RhdGFCaW5kTmFtZV0gPSB0aGlzO1xuICAgICAgICB9XG4gICAgfSk7XG5cbn1cblxuTm9kZS5wcm90b3R5cGUuZ2V0X2NoaWxkID0gZnVuY3Rpb24oc2lkZSwgb3Bwb3NpdGUpIHtcbiAgaWYgKG9wcG9zaXRlKSB7XG4gICAgc2lkZSA9IChzaWRlID09PSAnbGVmdCcpPyAncmlnaHQnOiAnbGVmdCc7XG4gIH1cbiAgcmV0dXJuIHNpZGUgPT09ICdsZWZ0Jz8gdGhpcy5sZWZ0OiB0aGlzLnJpZ2h0O1xufTtcblxuTm9kZS5wcm90b3R5cGUuc2V0X2NoaWxkID0gZnVuY3Rpb24oc2lkZSwgbm9kZSwgb3Bwb3NpdGUpIHtcbiAgaWYgKG9wcG9zaXRlKSB7XG4gICAgc2lkZSA9IChzaWRlID09PSAnbGVmdCcpPyAncmlnaHQnOiAnbGVmdCc7XG4gIH1cblxuICBpZiAoc2lkZSA9PT0gJ2xlZnQnKSB7XG4gICAgdGhpcy5sZWZ0ID0gbm9kZTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnJpZ2h0ID0gbm9kZTtcbiAgfVxufTtcblxuTm9kZS5wcm90b3R5cGUubWF4X3RyZWUgPSBmdW5jdGlvbihmdW4pIHtcbiAgdmFyIG5vZGUgPSB0aGlzO1xuXG4gIGlmIChmdW4pIHtcbiAgICBmdW4obm9kZSk7XG4gIH1cblxuICB3aGlsZSAobm9kZS5yaWdodCkge1xuICAgIG5vZGUgPSBub2RlLnJpZ2h0O1xuICAgIGlmIChmdW4pIHtcbiAgICAgIGZ1bihub2RlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbm9kZTtcbn07XG5cbk5vZGUucHJvdG90eXBlLm1pbl90cmVlID0gZnVuY3Rpb24oZnVuKSB7XG4gIHZhciBub2RlID0gdGhpcztcblxuICBpZiAoZnVuKSB7XG4gICAgZnVuKG5vZGUpO1xuICB9XG5cbiAgd2hpbGUgKG5vZGUubGVmdCkge1xuICAgIG5vZGUgPSBub2RlLmxlZnQ7XG4gICAgaWYgKGZ1bikge1xuICAgICAgZnVuKG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub2RlO1xufTtcblxuTm9kZS5wcm90b3R5cGUuZ2V0TmV4dCA9IGZ1bmN0aW9uKGZ1bikge1xuICB2YXIgbm9kZSwgcGFyZW50O1xuICBpZiAodGhpcy5nZXRfY2hpbGQoJ3JpZ2h0JykpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRfY2hpbGQoJ3JpZ2h0JykubWluX3RyZWUoZnVuKTtcbiAgfVxuICBpZiAoZnVuKSB7XG4gICAgZnVuKHRoaXMpO1xuICB9XG4gIG5vZGUgPSB0aGlzO1xuICBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgd2hpbGUgKHBhcmVudCAmJiBub2RlID09PSBwYXJlbnQuZ2V0X2NoaWxkKCdyaWdodCcpKSB7XG4gICAgbm9kZSA9IHBhcmVudDtcbiAgICBwYXJlbnQgPSBub2RlLnBhcmVudDtcbiAgICBpZiAoZnVuKSB7XG4gICAgICBmdW4ocGFyZW50KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBhcmVudDtcbn07XG5Ob2RlLnByb3RvdHlwZS5nZXRQcmV2ID0gZnVuY3Rpb24oZnVuKSB7XG4gIHZhciBub2RlLCBwYXJlbnQ7XG4gIGlmICh0aGlzLmdldF9jaGlsZCgnbGVmdCcpKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0X2NoaWxkKCdsZWZ0JykubWF4X3RyZWUoZnVuKTtcbiAgfVxuICBpZiAoZnVuKSB7XG4gICAgZnVuKHRoaXMpO1xuICB9XG4gIG5vZGUgPSB0aGlzO1xuICBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgd2hpbGUgKHBhcmVudCAmJiBub2RlID09PSBwYXJlbnQuZ2V0X2NoaWxkKCdsZWZ0JykpIHtcbiAgICBub2RlID0gcGFyZW50O1xuICAgIHBhcmVudCA9IG5vZGUucGFyZW50O1xuICAgIGlmIChmdW4pIHtcbiAgICAgIGZ1bihwYXJlbnQpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcGFyZW50O1xufTtcblxuXG4vKiogVHJhdmVyc2UgdGhlIHRyZWUgdXB3YXJkcyB1bnRpbCBpdCByZWFjaGVzIHRoZSB0b3AuIEZvciBlYWNoIG5vZGUgdHJhdmVyc2VkLFxuICAqIGNhbGwgdGhlIGZ1bmN0aW9uIHBhc3NlZCBhcyBhcmd1bWVudCB3aXRoIGFyZ3VtZW50cyBub2RlLCBwYXJlbnQuXG4gICogVGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIGgtMSB0aW1lcywgaCBiZWluZyB0aGUgaGVpZ2h0IG9mIHRoZSBicmFuY2guXG4gICoqL1xuTm9kZS5wcm90b3R5cGUudHJhdmVyc2VfdXAgPSBmdW5jdGlvbihmdW4pIHtcbiAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICB2YXIgbm9kZSA9IHRoaXM7XG5cbiAgd2hpbGUocGFyZW50KSB7XG4gICAgZnVuKG5vZGUsIHBhcmVudCk7XG4gICAgbm9kZSA9IHBhcmVudDtcbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICB9XG59O1xuXG5Ob2RlLnByb3RvdHlwZS5kZXB0aCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZGVwdGggPSAwO1xuICB0aGlzLnRyYXZlcnNlX3VwKGZ1bmN0aW9uKCkge1xuICAgIGRlcHRoICsrO1xuICB9KTtcbiAgcmV0dXJuIGRlcHRoO1xufTtcblxuTm9kZS5wcm90b3R5cGUucG9zaXRpb24gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBvc2l0aW9uID0gdGhpcy5sZWZ0PyB0aGlzLmxlZnQud2VpZ2h0OiAwO1xuICB2YXIgY291bnRGdW4gPSBmdW5jdGlvbihub2RlLCBwYXJlbnQpIHtcbiAgICBpZiAocGFyZW50LnJpZ2h0ID09PSBub2RlKSB7XG4gICAgICAvLyBmb3IgdGhlIGxlZnQgc3VidHJlZVxuICAgICAgaWYgKHBhcmVudC5sZWZ0KSB7XG4gICAgICAgIHBvc2l0aW9uICs9IHBhcmVudC5sZWZ0LndlaWdodDtcbiAgICAgIH1cbiAgICAgIHBvc2l0aW9uICs9IDE7IC8vIGZvciB0aGUgcGFyZW50XG4gICAgfVxuICB9O1xuXG4gIHRoaXMudHJhdmVyc2VfdXAoY291bnRGdW4pO1xuICByZXR1cm4gcG9zaXRpb247XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJCVHJlZTtcbiIsIlxuZnVuY3Rpb24gVHJlZUJhc2UoKSB7fVxuXG4vLyByZW1vdmVzIGFsbCBub2RlcyBmcm9tIHRoZSB0cmVlXG5UcmVlQmFzZS5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9yb290ID0gbnVsbDtcbiAgICB0aGlzLnNpemUgPSAwO1xufTtcblxuLy8gcmV0dXJucyBub2RlIGRhdGEgaWYgZm91bmQsIG51bGwgb3RoZXJ3aXNlXG5UcmVlQmFzZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB2YXIgcmVzID0gdGhpcy5fcm9vdDtcblxuICAgIHdoaWxlKHJlcyAhPT0gbnVsbCkge1xuICAgICAgICB2YXIgYyA9IHRoaXMuX2NvbXBhcmF0b3IoZGF0YSwgcmVzLmRhdGEpO1xuICAgICAgICBpZihjID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMgPSByZXMuZ2V0X2NoaWxkKGMgPiAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufTtcblxuLy8gcmV0dXJucyBpdGVyYXRvciB0byBub2RlIGlmIGZvdW5kLCBudWxsIG90aGVyd2lzZVxuVHJlZUJhc2UucHJvdG90eXBlLmZpbmRJdGVyID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciByZXMgPSB0aGlzLl9yb290O1xuICAgIHZhciBpdGVyID0gdGhpcy5pdGVyYXRvcigpO1xuXG4gICAgd2hpbGUocmVzICE9PSBudWxsKSB7XG4gICAgICAgIHZhciBjID0gdGhpcy5fY29tcGFyYXRvcihkYXRhLCByZXMuZGF0YSk7XG4gICAgICAgIGlmKGMgPT09IDApIHtcbiAgICAgICAgICAgIGl0ZXIuX2N1cnNvciA9IHJlcztcbiAgICAgICAgICAgIHJldHVybiBpdGVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaXRlci5fYW5jZXN0b3JzLnB1c2gocmVzKTtcbiAgICAgICAgICAgIHJlcyA9IHJlcy5nZXRfY2hpbGQoYyA+IDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyBSZXR1cm5zIGFuIGludGVyYXRvciB0byB0aGUgdHJlZSBub2RlIGF0IG9yIGltbWVkaWF0ZWx5IGFmdGVyIHRoZSBpdGVtXG5UcmVlQmFzZS5wcm90b3R5cGUubG93ZXJCb3VuZCA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICB2YXIgY3VyID0gdGhpcy5fcm9vdDtcbiAgICB2YXIgaXRlciA9IHRoaXMuaXRlcmF0b3IoKTtcbiAgICB2YXIgY21wID0gdGhpcy5fY29tcGFyYXRvcjtcblxuICAgIHdoaWxlKGN1ciAhPT0gbnVsbCkge1xuICAgICAgICB2YXIgYyA9IGNtcChpdGVtLCBjdXIuZGF0YSk7XG4gICAgICAgIGlmKGMgPT09IDApIHtcbiAgICAgICAgICAgIGl0ZXIuX2N1cnNvciA9IGN1cjtcbiAgICAgICAgICAgIHJldHVybiBpdGVyO1xuICAgICAgICB9XG4gICAgICAgIGl0ZXIuX2FuY2VzdG9ycy5wdXNoKGN1cik7XG4gICAgICAgIGN1ciA9IGN1ci5nZXRfY2hpbGQoYyA+IDApO1xuICAgIH1cblxuICAgIGZvcih2YXIgaT1pdGVyLl9hbmNlc3RvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgY3VyID0gaXRlci5fYW5jZXN0b3JzW2ldO1xuICAgICAgICBpZihjbXAoaXRlbSwgY3VyLmRhdGEpIDwgMCkge1xuICAgICAgICAgICAgaXRlci5fY3Vyc29yID0gY3VyO1xuICAgICAgICAgICAgaXRlci5fYW5jZXN0b3JzLmxlbmd0aCA9IGk7XG4gICAgICAgICAgICByZXR1cm4gaXRlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGl0ZXIuX2FuY2VzdG9ycy5sZW5ndGggPSAwO1xuICAgIHJldHVybiBpdGVyO1xufTtcblxuLy8gUmV0dXJucyBhbiBpbnRlcmF0b3IgdG8gdGhlIHRyZWUgbm9kZSBpbW1lZGlhdGVseSBhZnRlciB0aGUgaXRlbVxuVHJlZUJhc2UucHJvdG90eXBlLnVwcGVyQm91bmQgPSBmdW5jdGlvbihpdGVtKSB7XG4gICAgdmFyIGl0ZXIgPSB0aGlzLmxvd2VyQm91bmQoaXRlbSk7XG4gICAgdmFyIGNtcCA9IHRoaXMuX2NvbXBhcmF0b3I7XG5cbiAgICB3aGlsZShjbXAoaXRlci5kYXRhKCksIGl0ZW0pID09PSAwKSB7XG4gICAgICAgIGl0ZXIubmV4dCgpO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVyO1xufTtcblxuLy8gcmV0dXJucyBudWxsIGlmIHRyZWUgaXMgZW1wdHlcblRyZWVCYXNlLnByb3RvdHlwZS5taW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmVzID0gdGhpcy5fcm9vdDtcbiAgICBpZihyZXMgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgd2hpbGUocmVzLmxlZnQgIT09IG51bGwpIHtcbiAgICAgICAgcmVzID0gcmVzLmxlZnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcy5kYXRhO1xufTtcblxuLy8gcmV0dXJucyBudWxsIGlmIHRyZWUgaXMgZW1wdHlcblRyZWVCYXNlLnByb3RvdHlwZS5tYXggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmVzID0gdGhpcy5fcm9vdDtcbiAgICBpZihyZXMgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgd2hpbGUocmVzLnJpZ2h0ICE9PSBudWxsKSB7XG4gICAgICAgIHJlcyA9IHJlcy5yaWdodDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzLmRhdGE7XG59O1xuXG4vLyByZXR1cm5zIGEgbnVsbCBpdGVyYXRvclxuLy8gY2FsbCBuZXh0KCkgb3IgcHJldigpIHRvIHBvaW50IHRvIGFuIGVsZW1lbnRcblRyZWVCYXNlLnByb3RvdHlwZS5pdGVyYXRvciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSXRlcmF0b3IodGhpcyk7XG59O1xuXG5cblRyZWVCYXNlLnByb3RvdHlwZS5lYWNoTm9kZSA9IGZ1bmN0aW9uKGNiKSB7XG4gICAgdmFyIGl0PXRoaXMuaXRlcmF0b3IoKSwgbm9kZTtcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHdoaWxlKChub2RlID0gaXQubmV4dCgpKSAhPT0gbnVsbCkge1xuICAgICAgICBjYihub2RlLCBpbmRleCk7XG4gICAgICAgIGluZGV4Kys7XG4gICAgfVxufTtcblxuLy8gY2FsbHMgY2Igb24gZWFjaCBub2RlJ3MgZGF0YSwgaW4gb3JkZXJcblRyZWVCYXNlLnByb3RvdHlwZS5lYWNoID0gZnVuY3Rpb24oY2IpIHtcbiAgICB0aGlzLmVhY2hOb2RlKGZ1bmN0aW9uKG5vZGUsIGluZGV4KSB7XG4gICAgICAgIGNiKG5vZGUuZGF0YSwgaW5kZXgpO1xuICAgIH0pO1xufTtcblxuXG5UcmVlQmFzZS5wcm90b3R5cGUubWFwTm9kZSA9IGZ1bmN0aW9uKGNiKSB7XG4gICAgdmFyIGl0PXRoaXMuaXRlcmF0b3IoKSwgbm9kZTtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgd2hpbGUoKG5vZGUgPSBpdC5uZXh0KCkpICE9PSBudWxsKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChjYihub2RlLCBpbmRleCkpO1xuICAgICAgICBpbmRleCArKztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vLyBjYWxscyBjYiBvbiBlYWNoIG5vZGUtcyBkYXRhLCBzdG9yZSB0aGUgcmVzdWx0IGFuZCByZXR1cm4gaXRcblRyZWVCYXNlLnByb3RvdHlwZS5tYXAgPSBmdW5jdGlvbihjYikge1xuICAgIHJldHVybiB0aGlzLm1hcE5vZGUoZnVuY3Rpb24obm9kZSwgaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGNiKG5vZGUuZGF0YSwgaW5kZXgpO1xuICAgIH0pO1xufTtcblxuZnVuY3Rpb24gSXRlcmF0b3IodHJlZSkge1xuICAgIHRoaXMuX3RyZWUgPSB0cmVlO1xuICAgIHRoaXMuX2FuY2VzdG9ycyA9IFtdO1xuICAgIHRoaXMuX2N1cnNvciA9IG51bGw7XG59XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5kYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2N1cnNvciAhPT0gbnVsbCA/IHRoaXMuX2N1cnNvci5kYXRhIDogbnVsbDtcbn07XG5cbi8vIGlmIG51bGwtaXRlcmF0b3IsIHJldHVybnMgZmlyc3Qgbm9kZVxuLy8gb3RoZXJ3aXNlLCByZXR1cm5zIG5leHQgbm9kZVxuSXRlcmF0b3IucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbigpIHtcbiAgICBpZih0aGlzLl9jdXJzb3IgPT09IG51bGwpIHtcbiAgICAgICAgdmFyIHJvb3QgPSB0aGlzLl90cmVlLl9yb290O1xuICAgICAgICBpZihyb290ICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9taW5Ob2RlKHJvb3QpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZih0aGlzLl9jdXJzb3IucmlnaHQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIG5vIGdyZWF0ZXIgbm9kZSBpbiBzdWJ0cmVlLCBnbyB1cCB0byBwYXJlbnRcbiAgICAgICAgICAgIC8vIGlmIGNvbWluZyBmcm9tIGEgcmlnaHQgY2hpbGQsIGNvbnRpbnVlIHVwIHRoZSBzdGFja1xuICAgICAgICAgICAgdmFyIHNhdmU7XG4gICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgc2F2ZSA9IHRoaXMuX2N1cnNvcjtcbiAgICAgICAgICAgICAgICBpZih0aGlzLl9hbmNlc3RvcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2N1cnNvciA9IHRoaXMuX2FuY2VzdG9ycy5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2N1cnNvciA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gd2hpbGUodGhpcy5fY3Vyc29yLnJpZ2h0ID09PSBzYXZlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIGdldCB0aGUgbmV4dCBub2RlIGZyb20gdGhlIHN1YnRyZWVcbiAgICAgICAgICAgIHRoaXMuX2FuY2VzdG9ycy5wdXNoKHRoaXMuX2N1cnNvcik7XG4gICAgICAgICAgICB0aGlzLl9taW5Ob2RlKHRoaXMuX2N1cnNvci5yaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2N1cnNvciAhPT0gbnVsbCA/IHRoaXMuX2N1cnNvciA6IG51bGw7XG59O1xuXG4vLyBpZiBudWxsLWl0ZXJhdG9yLCByZXR1cm5zIGxhc3Qgbm9kZVxuLy8gb3RoZXJ3aXNlLCByZXR1cm5zIHByZXZpb3VzIG5vZGVcbkl0ZXJhdG9yLnByb3RvdHlwZS5wcmV2ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYodGhpcy5fY3Vyc29yID09PSBudWxsKSB7XG4gICAgICAgIHZhciByb290ID0gdGhpcy5fdHJlZS5fcm9vdDtcbiAgICAgICAgaWYocm9vdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fbWF4Tm9kZShyb290KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYodGhpcy5fY3Vyc29yLmxlZnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBzYXZlO1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIHNhdmUgPSB0aGlzLl9jdXJzb3I7XG4gICAgICAgICAgICAgICAgaWYodGhpcy5fYW5jZXN0b3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdXJzb3IgPSB0aGlzLl9hbmNlc3RvcnMucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jdXJzb3IgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IHdoaWxlKHRoaXMuX2N1cnNvci5sZWZ0ID09PSBzYXZlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2VzdG9ycy5wdXNoKHRoaXMuX2N1cnNvcik7XG4gICAgICAgICAgICB0aGlzLl9tYXhOb2RlKHRoaXMuX2N1cnNvci5sZWZ0KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yICE9PSBudWxsID8gdGhpcy5fY3Vyc29yIDogbnVsbDtcbn07XG5cbkl0ZXJhdG9yLnByb3RvdHlwZS5fbWluTm9kZSA9IGZ1bmN0aW9uKHN0YXJ0KSB7XG4gICAgd2hpbGUoc3RhcnQubGVmdCAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9hbmNlc3RvcnMucHVzaChzdGFydCk7XG4gICAgICAgIHN0YXJ0ID0gc3RhcnQubGVmdDtcbiAgICB9XG4gICAgdGhpcy5fY3Vyc29yID0gc3RhcnQ7XG59O1xuXG5JdGVyYXRvci5wcm90b3R5cGUuX21heE5vZGUgPSBmdW5jdGlvbihzdGFydCkge1xuICAgIHdoaWxlKHN0YXJ0LnJpZ2h0ICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX2FuY2VzdG9ycy5wdXNoKHN0YXJ0KTtcbiAgICAgICAgc3RhcnQgPSBzdGFydC5yaWdodDtcbiAgICB9XG4gICAgdGhpcy5fY3Vyc29yID0gc3RhcnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRyZWVCYXNlO1xuIl19
