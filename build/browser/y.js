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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9naXQveS0wNS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvZG1vbmFkL2dpdC95LTA1L3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvZ2l0L3ktMDUveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvZ2l0L3ktMDUveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvZG1vbmFkL2dpdC95LTA1L3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9kbW9uYWQvZ2l0L3ktMDUveWpzL2xpYi9PYmplY3RUeXBlLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveS0wNS95anMvbGliL09wZXJhdGlvbnMvQmFzaWMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL2dpdC95LTA1L3lqcy9saWIvT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkLmNvZmZlZSIsIi9ob21lL2Rtb25hZC9naXQveS0wNS95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENBQWxCLENBREY7QUFBQSxHQUFBO0FBQUEsRUFHQSxTQUFTLENBQUMsYUFBVixDQUFBLENBSEEsQ0FBQTtBQUFBLEVBS0EsS0FBQSxHQUFRLFNBQUMsQ0FBRCxHQUFBO0FBQ04sSUFBQSxJQUFH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QyxTQWpCcEMsQ0FBQTtBQUFBLEVBa0JBLEdBQUcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFlBQXhCLEdBQXVDLElBQUksQ0FBQyxXQWxCNUMsQ0FBQTtBQUFBLEVBb0JBLEVBQUEsR0FBUyxJQUFBLE9BQU8sQ0FBQyxNQUFSLENBQUEsQ0FwQlQsQ0FBQTtBQUFBLEVBcUJBLEtBQUEsR0FBWSxJQUFBLEdBQUcsQ0FBQyxVQUFKLENBQWUsRUFBZixFQUFtQixFQUFFLENBQUMsMkJBQUgsQ0FBQSxDQUFuQixDQUFvRCxDQUFDLE9BQXJELENBQUEsQ0FyQlosQ0FBQTtBQUFBLEVBc0JBLEVBQUUsQ0FBQyxTQUFILENBQWEsS0FBYixDQXRCQSxDQUFBO1NBdUJBLEdBeEJRO0FBQUEsQ0FOVixDQUFBOztBQUFBLE1BZ0NNLENBQUMsT0FBUCxHQUFpQixPQWhDakIsQ0FBQTs7QUFpQ0EsSUFBRyxnREFBSDtBQUNFLEVBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxPQUFYLENBREY7Q0FqQ0E7O0FBQUEsT0FvQ08sQ0FBQyxNQUFSLEdBQWlCLE9BQUEsQ0FBUSxjQUFSLENBcENqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuQ29ubmVjdG9yQ2xhc3MgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JDbGFzc1wiXG4jXG4jIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4jIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiNcbmFkYXB0Q29ubmVjdG9yID0gKGNvbm5lY3RvciwgZW5naW5lLCBIQiwgZXhlY3V0aW9uX2xpc3RlbmVyKS0+XG5cbiAgZm9yIG5hbWUsIGYgb2YgQ29ubmVjdG9yQ2xhc3NcbiAgICBjb25uZWN0b3JbbmFtZV0gPSBmXG5cbiAgY29ubmVjdG9yLnNldElzQm91bmRUb1koKVxuXG4gIHNlbmRfID0gKG8pLT5cbiAgICBpZiAoby51aWQuY3JlYXRvciBpcyBIQi5nZXRVc2VySWQoKSkgYW5kXG4gICAgICAgICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIikgYW5kICMgVE9ETzogaSBkb24ndCB0aGluayB0aGF0IHdlIG5lZWQgdGhpcyBhbnltb3JlLi5cbiAgICAgICAgKEhCLmdldFVzZXJJZCgpIGlzbnQgXCJfdGVtcFwiKVxuICAgICAgY29ubmVjdG9yLmJyb2FkY2FzdCBvXG5cbiAgaWYgY29ubmVjdG9yLmludm9rZVN5bmM/XG4gICAgSEIuc2V0SW52b2tlU3luY0hhbmRsZXIgY29ubmVjdG9yLmludm9rZVN5bmNcblxuICBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuICAjIEZvciB0aGUgWE1QUENvbm5lY3RvcjogbGV0cyBzZW5kIGl0IGFzIGFuIGFycmF5XG4gICMgdGhlcmVmb3JlLCB3ZSBoYXZlIHRvIHJlc3RydWN0dXJlIGl0IGxhdGVyXG4gIGVuY29kZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxuICAgIGZvciBuYW1lLHZhbHVlIG9mIHZcbiAgICAgIHVzZXI6IG5hbWVcbiAgICAgIHN0YXRlOiB2YWx1ZVxuICBwYXJzZV9zdGF0ZV92ZWN0b3IgPSAodiktPlxuICAgIHN0YXRlX3ZlY3RvciA9IHt9XG4gICAgZm9yIHMgaW4gdlxuICAgICAgc3RhdGVfdmVjdG9yW3MudXNlcl0gPSBzLnN0YXRlXG4gICAgc3RhdGVfdmVjdG9yXG5cbiAgZ2V0U3RhdGVWZWN0b3IgPSAoKS0+XG4gICAgZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcblxuICBnZXRIQiA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0gcGFyc2Vfc3RhdGVfdmVjdG9yIHZcbiAgICBoYiA9IEhCLl9lbmNvZGUgc3RhdGVfdmVjdG9yXG4gICAganNvbiA9XG4gICAgICBoYjogaGJcbiAgICAgIHN0YXRlX3ZlY3RvcjogZW5jb2RlX3N0YXRlX3ZlY3RvciBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICBqc29uXG5cbiAgYXBwbHlIQiA9IChoYiwgZnJvbUhCKS0+XG4gICAgZW5naW5lLmFwcGx5T3AgaGIsIGZyb21IQlxuXG4gIGNvbm5lY3Rvci5nZXRTdGF0ZVZlY3RvciA9IGdldFN0YXRlVmVjdG9yXG4gIGNvbm5lY3Rvci5nZXRIQiA9IGdldEhCXG4gIGNvbm5lY3Rvci5hcHBseUhCID0gYXBwbHlIQlxuXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzID89IFtdXG4gIGNvbm5lY3Rvci5yZWNlaXZlX2hhbmRsZXJzLnB1c2ggKHNlbmRlciwgb3ApLT5cbiAgICBpZiBvcC51aWQuY3JlYXRvciBpc250IEhCLmdldFVzZXJJZCgpXG4gICAgICBlbmdpbmUuYXBwbHlPcCBvcFxuXG5cbm1vZHVsZS5leHBvcnRzID0gYWRhcHRDb25uZWN0b3JcbiIsIlxubW9kdWxlLmV4cG9ydHMgPVxuICAjXG4gICMgQHBhcmFtcyBuZXcgQ29ubmVjdG9yKG9wdGlvbnMpXG4gICMgICBAcGFyYW0gb3B0aW9ucy5zeW5jTWV0aG9kIHtTdHJpbmd9ICBpcyBlaXRoZXIgXCJzeW5jQWxsXCIgb3IgXCJtYXN0ZXItc2xhdmVcIi5cbiAgIyAgIEBwYXJhbSBvcHRpb25zLnJvbGUge1N0cmluZ30gVGhlIHJvbGUgb2YgdGhpcyBjbGllbnRcbiAgIyAgICAgICAgICAgIChzbGF2ZSBvciBtYXN0ZXIgKG9ubHkgdXNlZCB3aGVuIHN5bmNNZXRob2QgaXMgbWFzdGVyLXNsYXZlKSlcbiAgIyAgIEBwYXJhbSBvcHRpb25zLnBlcmZvcm1fc2VuZF9hZ2FpbiB7Qm9vbGVhbn0gV2hldGVociB0byB3aGV0aGVyIHRvIHJlc2VuZCB0aGUgSEIgYWZ0ZXIgc29tZSB0aW1lIHBlcmlvZC4gVGhpcyByZWR1Y2VzIHN5bmMgZXJyb3JzLCBidXQgaGFzIHNvbWUgb3ZlcmhlYWQgKG9wdGlvbmFsKVxuICAjXG4gIGluaXQ6IChvcHRpb25zKS0+XG4gICAgcmVxID0gKG5hbWUsIGNob2ljZXMpPT5cbiAgICAgIGlmIG9wdGlvbnNbbmFtZV0/XG4gICAgICAgIGlmIChub3QgY2hvaWNlcz8pIG9yIGNob2ljZXMuc29tZSgoYyktPmMgaXMgb3B0aW9uc1tuYW1lXSlcbiAgICAgICAgICBAW25hbWVdID0gb3B0aW9uc1tuYW1lXVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IGNhbiBzZXQgdGhlICdcIituYW1lK1wiJyBvcHRpb24gdG8gb25lIG9mIHRoZSBmb2xsb3dpbmcgY2hvaWNlczogXCIrSlNPTi5lbmNvZGUoY2hvaWNlcylcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgc3BlY2lmeSBcIituYW1lK1wiLCB3aGVuIGluaXRpYWxpemluZyB0aGUgQ29ubmVjdG9yIVwiXG5cbiAgICByZXEgXCJzeW5jTWV0aG9kXCIsIFtcInN5bmNBbGxcIiwgXCJtYXN0ZXItc2xhdmVcIl1cbiAgICByZXEgXCJyb2xlXCIsIFtcIm1hc3RlclwiLCBcInNsYXZlXCJdXG4gICAgcmVxIFwidXNlcl9pZFwiXG4gICAgQG9uX3VzZXJfaWRfc2V0PyhAdXNlcl9pZClcblxuICAgICMgd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycy5cbiAgICAjIEJ1dCB0aGlzIGlzIG5vdCBuZWNlc3NhcnkgaW4gdGhlIHRlc3QtY29ubmVjdG9yXG4gICAgaWYgb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4/XG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW5cbiAgICBlbHNlXG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gdHJ1ZVxuXG4gICAgIyBBIE1hc3RlciBzaG91bGQgc3luYyB3aXRoIGV2ZXJ5b25lISBUT0RPOiByZWFsbHk/IC0gZm9yIG5vdyBpdHMgc2FmZXIgdGhpcyB3YXkhXG4gICAgaWYgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgQHN5bmNNZXRob2QgPSBcInN5bmNBbGxcIlxuXG4gICAgIyBpcyBzZXQgdG8gdHJ1ZSB3aGVuIHRoaXMgaXMgc3luY2VkIHdpdGggYWxsIG90aGVyIGNvbm5lY3Rpb25zXG4gICAgQGlzX3N5bmNlZCA9IGZhbHNlXG4gICAgIyBQZWVyanMgQ29ubmVjdGlvbnM6IGtleTogY29ubi1pZCwgdmFsdWU6IG9iamVjdFxuICAgIEBjb25uZWN0aW9ucyA9IHt9XG4gICAgIyBMaXN0IG9mIGZ1bmN0aW9ucyB0aGF0IHNoYWxsIHByb2Nlc3MgaW5jb21pbmcgZGF0YVxuICAgIEByZWNlaXZlX2hhbmRsZXJzID89IFtdXG5cbiAgICAjIHdoZXRoZXIgdGhpcyBpbnN0YW5jZSBpcyBib3VuZCB0byBhbnkgeSBpbnN0YW5jZVxuICAgIEBjb25uZWN0aW9ucyA9IHt9XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSBudWxsXG4gICAgQHNlbnRfaGJfdG9fYWxsX3VzZXJzID0gZmFsc2VcbiAgICBAaXNfaW5pdGlhbGl6ZWQgPSB0cnVlXG5cbiAgb25Vc2VyRXZlbnQ6IChmKS0+XG4gICAgQGNvbm5lY3Rpb25zX2xpc3RlbmVycyA/PSBbXVxuICAgIEBjb25uZWN0aW9uc19saXN0ZW5lcnMucHVzaCBmXG5cbiAgaXNSb2xlTWFzdGVyOiAtPlxuICAgIEByb2xlIGlzIFwibWFzdGVyXCJcblxuICBpc1JvbGVTbGF2ZTogLT5cbiAgICBAcm9sZSBpcyBcInNsYXZlXCJcblxuICBmaW5kTmV3U3luY1RhcmdldDogKCktPlxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIGlmIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICBmb3IgdXNlciwgYyBvZiBAY29ubmVjdGlvbnNcbiAgICAgICAgaWYgbm90IGMuaXNfc3luY2VkXG4gICAgICAgICAgQHBlcmZvcm1TeW5jIHVzZXJcbiAgICAgICAgICBicmVha1xuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBzZXRTdGF0ZVN5bmNlZCgpXG4gICAgbnVsbFxuXG4gIHVzZXJMZWZ0OiAodXNlciktPlxuICAgIGRlbGV0ZSBAY29ubmVjdGlvbnNbdXNlcl1cbiAgICBAZmluZE5ld1N5bmNUYXJnZXQoKVxuICAgIGlmIEBjb25uZWN0aW9uc19saXN0ZW5lcnM/XG4gICAgICBmb3IgZiBpbiBAY29ubmVjdGlvbnNfbGlzdGVuZXJzXG4gICAgICAgIGYge1xuICAgICAgICAgIGFjdGlvbjogXCJ1c2VyTGVmdFwiXG4gICAgICAgICAgdXNlcjogdXNlclxuICAgICAgICB9XG5cblxuICB1c2VySm9pbmVkOiAodXNlciwgcm9sZSktPlxuICAgIGlmIG5vdCByb2xlP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSW50ZXJuYWw6IFlvdSBtdXN0IHNwZWNpZnkgdGhlIHJvbGUgb2YgdGhlIGpvaW5lZCB1c2VyISBFLmcuIHVzZXJKb2luZWQoJ3VpZDozOTM5Jywnc2xhdmUnKVwiXG4gICAgIyBhIHVzZXIgam9pbmVkIHRoZSByb29tXG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdID89IHt9XG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdLmlzX3N5bmNlZCA9IGZhbHNlXG5cbiAgICBpZiAobm90IEBpc19zeW5jZWQpIG9yIEBzeW5jTWV0aG9kIGlzIFwic3luY0FsbFwiXG4gICAgICBpZiBAc3luY01ldGhvZCBpcyBcInN5bmNBbGxcIlxuICAgICAgICBAcGVyZm9ybVN5bmMgdXNlclxuICAgICAgZWxzZSBpZiByb2xlIGlzIFwibWFzdGVyXCJcbiAgICAgICAgIyBUT0RPOiBXaGF0IGlmIHRoZXJlIGFyZSB0d28gbWFzdGVycz8gUHJldmVudCBzZW5kaW5nIGV2ZXJ5dGhpbmcgdHdvIHRpbWVzIVxuICAgICAgICBAcGVyZm9ybVN5bmNXaXRoTWFzdGVyIHVzZXJcblxuICAgIGlmIEBjb25uZWN0aW9uc19saXN0ZW5lcnM/XG4gICAgICBmb3IgZiBpbiBAY29ubmVjdGlvbnNfbGlzdGVuZXJzXG4gICAgICAgIGYge1xuICAgICAgICAgIGFjdGlvbjogXCJ1c2VySm9pbmVkXCJcbiAgICAgICAgICB1c2VyOiB1c2VyXG4gICAgICAgICAgcm9sZTogcm9sZVxuICAgICAgICB9XG5cbiAgI1xuICAjIEV4ZWN1dGUgYSBmdW5jdGlvbiBfd2hlbl8gd2UgYXJlIGNvbm5lY3RlZC4gSWYgbm90IGNvbm5lY3RlZCwgd2FpdCB1bnRpbCBjb25uZWN0ZWQuXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBDb25uZWN0b3IgY29udGV4dC5cbiAgI1xuICB3aGVuU3luY2VkOiAoYXJncyktPlxuICAgIGlmIGFyZ3MuY29uc3RydWN0b3IgaXMgRnVuY3Rpb25cbiAgICAgIGFyZ3MgPSBbYXJnc11cbiAgICBpZiBAaXNfc3luY2VkXG4gICAgICBhcmdzWzBdLmFwcGx5IHRoaXMsIGFyZ3NbMS4uXVxuICAgIGVsc2VcbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkID89IFtdXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZC5wdXNoIGFyZ3NcblxuICAjXG4gICMgRXhlY3V0ZSBhbiBmdW5jdGlvbiB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgIyBAcGFyYW0gZiB7RnVuY3Rpb259IFdpbGwgYmUgZXhlY3V0ZWQgb24gdGhlIFBlZXJKcy1Db25uZWN0b3IgY29udGV4dC4gZiB3aWxsIGJlIGNhbGxlZCB3aXRoIChzZW5kZXJfaWQsIGJyb2FkY2FzdCB7dHJ1ZXxmYWxzZX0sIG1lc3NhZ2UpLlxuICAjXG4gIG9uUmVjZWl2ZTogKGYpLT5cbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcblxuICAjIyNcbiAgIyBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBjb25uZWN0ZWQgcGVlcnMuXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gYnJvYWRjYXN0LlxuICAjXG4gIGJyb2FkY2FzdDogKG1lc3NhZ2UpLT5cbiAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBpbXBsZW1lbnQgYnJvYWRjYXN0IVwiXG5cbiAgI1xuICAjIFNlbmQgYSBtZXNzYWdlIHRvIGEgcGVlciwgb3Igc2V0IG9mIHBlZXJzXG4gICNcbiAgc2VuZDogKHBlZXJfcywgbWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBzZW5kIVwiXG4gICMjI1xuXG4gICNcbiAgIyBwZXJmb3JtIGEgc3luYyB3aXRoIGEgc3BlY2lmaWMgdXNlci5cbiAgI1xuICBwZXJmb3JtU3luYzogKHVzZXIpLT5cbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAY3VycmVudF9zeW5jX3RhcmdldCA9IHVzZXJcbiAgICAgIEBzZW5kIHVzZXIsXG4gICAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICAgIHNlbmRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgIGRhdGE6IEBnZXRTdGF0ZVZlY3RvcigpXG4gICAgICBpZiBub3QgQHNlbnRfaGJfdG9fYWxsX3VzZXJzXG4gICAgICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IHRydWVcblxuICAgICAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICAgICAgX2hiID0gW11cbiAgICAgICAgZm9yIG8gaW4gaGJcbiAgICAgICAgICBfaGIucHVzaCBvXG4gICAgICAgICAgaWYgX2hiLmxlbmd0aCA+IDEwXG4gICAgICAgICAgICBAYnJvYWRjYXN0XG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgX2hiID0gW11cbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuXG5cbiAgI1xuICAjIFdoZW4gYSBtYXN0ZXIgbm9kZSBqb2luZWQgdGhlIHJvb20sIHBlcmZvcm0gdGhpcyBzeW5jIHdpdGggaGltLiBJdCB3aWxsIGFzayB0aGUgbWFzdGVyIGZvciB0aGUgSEIsXG4gICMgYW5kIHdpbGwgYnJvYWRjYXN0IGhpcyBvd24gSEJcbiAgI1xuICBwZXJmb3JtU3luY1dpdGhNYXN0ZXI6ICh1c2VyKS0+XG4gICAgQGN1cnJlbnRfc3luY190YXJnZXQgPSB1c2VyXG4gICAgQHNlbmQgdXNlcixcbiAgICAgIHN5bmNfc3RlcDogXCJnZXRIQlwiXG4gICAgICBzZW5kX2FnYWluOiBcInRydWVcIlxuICAgICAgZGF0YTogQGdldFN0YXRlVmVjdG9yKClcbiAgICBoYiA9IEBnZXRIQihbXSkuaGJcbiAgICBfaGIgPSBbXVxuICAgIGZvciBvIGluIGhiXG4gICAgICBfaGIucHVzaCBvXG4gICAgICBpZiBfaGIubGVuZ3RoID4gMTBcbiAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgQGJyb2FkY2FzdFxuICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIlxuICAgICAgZGF0YTogX2hiXG5cbiAgI1xuICAjIFlvdSBhcmUgc3VyZSB0aGF0IGFsbCBjbGllbnRzIGFyZSBzeW5jZWQsIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICBzZXRTdGF0ZVN5bmNlZDogKCktPlxuICAgIGlmIG5vdCBAaXNfc3luY2VkXG4gICAgICBAaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgaWYgQGNvbXB1dGVfd2hlbl9zeW5jZWQ/XG4gICAgICAgIGZvciBlbCBpbiBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgICAgIGYgPSBlbFswXVxuICAgICAgICAgIGFyZ3MgPSBlbFsxLi5dXG4gICAgICAgICAgZi5hcHBseShhcmdzKVxuICAgICAgICBkZWxldGUgQGNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgIG51bGxcblxuICAjIGV4ZWN1dGVkIHdoZW4gdGhlIGEgc3RhdGVfdmVjdG9yIGlzIHJlY2VpdmVkLiBsaXN0ZW5lciB3aWxsIGJlIGNhbGxlZCBvbmx5IG9uY2UhXG4gIHdoZW5SZWNlaXZlZFN0YXRlVmVjdG9yOiAoZiktPlxuICAgIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnMgPz0gW11cbiAgICBAd2hlbl9yZWNlaXZlZF9zdGF0ZV92ZWN0b3JfbGlzdGVuZXJzLnB1c2ggZlxuXG5cbiAgI1xuICAjIFlvdSByZWNlaXZlZCBhIHJhdyBtZXNzYWdlLCBhbmQgeW91IGtub3cgdGhhdCBpdCBpcyBpbnRlbmRlZCBmb3IgdG8gWWpzLiBUaGVuIGNhbGwgdGhpcyBmdW5jdGlvbi5cbiAgI1xuICByZWNlaXZlTWVzc2FnZTogKHNlbmRlciwgcmVzKS0+XG4gICAgaWYgbm90IHJlcy5zeW5jX3N0ZXA/XG4gICAgICBmb3IgZiBpbiBAcmVjZWl2ZV9oYW5kbGVyc1xuICAgICAgICBmIHNlbmRlciwgcmVzXG4gICAgZWxzZVxuICAgICAgaWYgc2VuZGVyIGlzIEB1c2VyX2lkXG4gICAgICAgIHJldHVyblxuICAgICAgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImdldEhCXCJcbiAgICAgICAgIyBjYWxsIGxpc3RlbmVyc1xuICAgICAgICBpZiBAd2hlbl9yZWNlaXZlZF9zdGF0ZV92ZWN0b3JfbGlzdGVuZXJzP1xuICAgICAgICAgIGZvciBmIGluIEB3aGVuX3JlY2VpdmVkX3N0YXRlX3ZlY3Rvcl9saXN0ZW5lcnNcbiAgICAgICAgICAgIGYuY2FsbCB0aGlzLCByZXMuZGF0YVxuICAgICAgICBkZWxldGUgQHdoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVyc1xuXG4gICAgICAgIGRhdGEgPSBAZ2V0SEIocmVzLmRhdGEpXG4gICAgICAgIGhiID0gZGF0YS5oYlxuICAgICAgICBfaGIgPSBbXVxuICAgICAgICAjIGFsd2F5cyBicm9hZGNhc3QsIHdoZW4gbm90IHN5bmNlZC5cbiAgICAgICAgIyBUaGlzIHJlZHVjZXMgZXJyb3JzLCB3aGVuIHRoZSBjbGllbnRzIGdvZXMgb2ZmbGluZSBwcmVtYXR1cmVseS5cbiAgICAgICAgIyBXaGVuIHRoaXMgY2xpZW50IG9ubHkgc3luY3MgdG8gb25lIG90aGVyIGNsaWVudHMsIGJ1dCBsb29zZXMgY29ubmVjdG9ycyxcbiAgICAgICAgIyBiZWZvcmUgc3luY2luZyB0byB0aGUgb3RoZXIgY2xpZW50cywgdGhlIG9ubGluZSBjbGllbnRzIGhhdmUgZGlmZmVyZW50IHN0YXRlcy5cbiAgICAgICAgIyBTaW5jZSB3ZSBkbyBub3Qgd2FudCB0byBwZXJmb3JtIHJlZ3VsYXIgc3luY3MsIHRoaXMgaXMgYSBnb29kIGFsdGVybmF0aXZlXG4gICAgICAgIGlmIEBpc19zeW5jZWRcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XG4gICAgICAgICAgICBAc2VuZCBzZW5kZXIsIG1cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHNlbmRBcHBseUhCID0gKG0pPT5cbiAgICAgICAgICAgIEBicm9hZGNhc3QgbVxuXG4gICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICAgICAgc2VuZEFwcGx5SEJcbiAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJfXCJcbiAgICAgICAgICAgICAgZGF0YTogX2hiXG4gICAgICAgICAgICBfaGIgPSBbXVxuXG4gICAgICAgIHNlbmRBcHBseUhCXG4gICAgICAgICAgc3luY19zdGVwIDogXCJhcHBseUhCXCJcbiAgICAgICAgICBkYXRhOiBfaGJcblxuICAgICAgICBpZiByZXMuc2VuZF9hZ2Fpbj8gYW5kIEBwZXJmb3JtX3NlbmRfYWdhaW5cbiAgICAgICAgICBzZW5kX2FnYWluID0gZG8gKHN2ID0gZGF0YS5zdGF0ZV92ZWN0b3IpPT5cbiAgICAgICAgICAgICgpPT5cbiAgICAgICAgICAgICAgaGIgPSBAZ2V0SEIoc3YpLmhiXG4gICAgICAgICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAxMFxuICAgICAgICAgICAgICAgICAgQHNlbmQgc2VuZGVyLFxuICAgICAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgICAgICAgIF9oYiA9IFtdXG4gICAgICAgICAgICAgIEBzZW5kIHNlbmRlcixcbiAgICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiLFxuICAgICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgICAgIHNlbnRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kX2FnYWluLCAzMDAwXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCXCJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcblxuICAgICAgICBpZiAoQHN5bmNNZXRob2QgaXMgXCJzeW5jQWxsXCIgb3IgcmVzLnNlbnRfYWdhaW4/KSBhbmQgKG5vdCBAaXNfc3luY2VkKSBhbmQgKChAY3VycmVudF9zeW5jX3RhcmdldCBpcyBzZW5kZXIpIG9yIChub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/KSlcbiAgICAgICAgICBAY29ubmVjdGlvbnNbc2VuZGVyXS5pc19zeW5jZWQgPSB0cnVlXG4gICAgICAgICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcblxuICAgICAgZWxzZSBpZiByZXMuc3luY19zdGVwIGlzIFwiYXBwbHlIQl9cIlxuICAgICAgICBAYXBwbHlIQihyZXMuZGF0YSwgc2VuZGVyIGlzIEBjdXJyZW50X3N5bmNfdGFyZ2V0KVxuXG5cbiAgIyBDdXJyZW50bHksIHRoZSBIQiBlbmNvZGVzIG9wZXJhdGlvbnMgYXMgSlNPTi4gRm9yIHRoZSBtb21lbnQgSSB3YW50IHRvIGtlZXAgaXRcbiAgIyB0aGF0IHdheS4gTWF5YmUgd2Ugc3VwcG9ydCBlbmNvZGluZyBpbiB0aGUgSEIgYXMgWE1MIGluIHRoZSBmdXR1cmUsIGJ1dCBmb3Igbm93IEkgZG9uJ3Qgd2FudFxuICAjIHRvbyBtdWNoIG92ZXJoZWFkLiBZIGlzIHZlcnkgbGlrZWx5IHRvIGdldCBjaGFuZ2VkIGEgbG90IGluIHRoZSBmdXR1cmVcbiAgI1xuICAjIEJlY2F1c2Ugd2UgZG9uJ3Qgd2FudCB0byBlbmNvZGUgSlNPTiBhcyBzdHJpbmcgKHdpdGggY2hhcmFjdGVyIGVzY2FwaW5nLCB3aWNoIG1ha2VzIGl0IHByZXR0eSBtdWNoIHVucmVhZGFibGUpXG4gICMgd2UgZW5jb2RlIHRoZSBKU09OIGFzIFhNTC5cbiAgI1xuICAjIFdoZW4gdGhlIEhCIHN1cHBvcnQgZW5jb2RpbmcgYXMgWE1MLCB0aGUgZm9ybWF0IHNob3VsZCBsb29rIHByZXR0eSBtdWNoIGxpa2UgdGhpcy5cblxuICAjIGRvZXMgbm90IHN1cHBvcnQgcHJpbWl0aXZlIHZhbHVlcyBhcyBhcnJheSBlbGVtZW50c1xuICAjIGV4cGVjdHMgYW4gbHR4IChsZXNzIHRoYW4geG1sKSBvYmplY3RcbiAgcGFyc2VNZXNzYWdlRnJvbVhtbDogKG0pLT5cbiAgICBwYXJzZV9hcnJheSA9IChub2RlKS0+XG4gICAgICBmb3IgbiBpbiBub2RlLmNoaWxkcmVuXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxuICAgICAgICAgIHBhcnNlX2FycmF5IG5cbiAgICAgICAgZWxzZVxuICAgICAgICAgIHBhcnNlX29iamVjdCBuXG5cbiAgICBwYXJzZV9vYmplY3QgPSAobm9kZSktPlxuICAgICAganNvbiA9IHt9XG4gICAgICBmb3IgbmFtZSwgdmFsdWUgIG9mIG5vZGUuYXR0cnNcbiAgICAgICAgaW50ID0gcGFyc2VJbnQodmFsdWUpXG4gICAgICAgIGlmIGlzTmFOKGludCkgb3IgKFwiXCIraW50KSBpc250IHZhbHVlXG4gICAgICAgICAganNvbltuYW1lXSA9IHZhbHVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uW25hbWVdID0gaW50XG4gICAgICBmb3IgbiBpbiBub2RlLmNoaWxkcmVuXG4gICAgICAgIG5hbWUgPSBuLm5hbWVcbiAgICAgICAgaWYgbi5nZXRBdHRyaWJ1dGUoXCJpc0FycmF5XCIpIGlzIFwidHJ1ZVwiXG4gICAgICAgICAganNvbltuYW1lXSA9IHBhcnNlX2FycmF5IG5cbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9vYmplY3QgblxuICAgICAganNvblxuICAgIHBhcnNlX29iamVjdCBtXG5cbiAgIyBlbmNvZGUgbWVzc2FnZSBpbiB4bWxcbiAgIyB3ZSB1c2Ugc3RyaW5nIGJlY2F1c2UgU3Ryb3BoZSBvbmx5IGFjY2VwdHMgYW4gXCJ4bWwtc3RyaW5nXCIuLlxuICAjIFNvIHthOjQsYjp7Yzo1fX0gd2lsbCBsb29rIGxpa2VcbiAgIyA8eSBhPVwiNFwiPlxuICAjICAgPGIgYz1cIjVcIj48L2I+XG4gICMgPC95PlxuICAjIG0gLSBsdHggZWxlbWVudFxuICAjIGpzb24gLSBndWVzcyBpdCA7KVxuICAjXG4gIGVuY29kZU1lc3NhZ2VUb1htbDogKG0sIGpzb24pLT5cbiAgICAjIGF0dHJpYnV0ZXMgaXMgb3B0aW9uYWxcbiAgICBlbmNvZGVfb2JqZWN0ID0gKG0sIGpzb24pLT5cbiAgICAgIGZvciBuYW1lLHZhbHVlIG9mIGpzb25cbiAgICAgICAgaWYgbm90IHZhbHVlP1xuICAgICAgICAgICMgbm9wXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgZW5jb2RlX29iamVjdCBtLmMobmFtZSksIHZhbHVlXG4gICAgICAgIGVsc2UgaWYgdmFsdWUuY29uc3RydWN0b3IgaXMgQXJyYXlcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKG5hbWUpLCB2YWx1ZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgbS5zZXRBdHRyaWJ1dGUobmFtZSx2YWx1ZSlcbiAgICAgIG1cbiAgICBlbmNvZGVfYXJyYXkgPSAobSwgYXJyYXkpLT5cbiAgICAgIG0uc2V0QXR0cmlidXRlKFwiaXNBcnJheVwiLFwidHJ1ZVwiKVxuICAgICAgZm9yIGUgaW4gYXJyYXlcbiAgICAgICAgaWYgZS5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcImFycmF5LWVsZW1lbnRcIiksIGVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGVuY29kZV9hcnJheSBtLmMoXCJhcnJheS1lbGVtZW50XCIpLCBlXG4gICAgICBtXG4gICAgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgIGVuY29kZV9vYmplY3QgbS5jKFwieVwiLHt4bWxuczpcImh0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemFcIn0pLCBqc29uXG4gICAgZWxzZSBpZiBqc29uLmNvbnN0cnVjdG9yIGlzIEFycmF5XG4gICAgICBlbmNvZGVfYXJyYXkgbS5jKFwieVwiLHt4bWxuczpcImh0dHA6Ly95Lm5pbmphL2Nvbm5lY3Rvci1zdGFuemFcIn0pLCBqc29uXG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSSBjYW4ndCBlbmNvZGUgdGhpcyBqc29uIVwiXG5cbiAgc2V0SXNCb3VuZFRvWTogKCktPlxuICAgIEBvbl9ib3VuZF90b195PygpXG4gICAgZGVsZXRlIEB3aGVuX2JvdW5kX3RvX3lcbiAgICBAaXNfYm91bmRfdG9feSA9IHRydWVcbiIsIlxud2luZG93Py51bnByb2Nlc3NlZF9jb3VudGVyID0gMCAjIGRlbCB0aGlzXG53aW5kb3c/LnVucHJvY2Vzc2VkX2V4ZWNfY291bnRlciA9IDAgIyBUT0RPXG53aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzID0gW11cblxuI1xuIyBAbm9kb2NcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cbiNcbmNsYXNzIEVuZ2luZVxuXG4gICNcbiAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICMgQHBhcmFtIHtPYmplY3R9IHR5cGVzIGxpc3Qgb2YgYXZhaWxhYmxlIHR5cGVzXG4gICNcbiAgY29uc3RydWN0b3I6IChASEIsIEB0eXBlcyktPlxuICAgIEB1bnByb2Nlc3NlZF9vcHMgPSBbXVxuXG4gICNcbiAgIyBQYXJzZXMgYW4gb3BlcmF0aW8gZnJvbSB0aGUganNvbiBmb3JtYXQuIEl0IHVzZXMgdGhlIHNwZWNpZmllZCBwYXJzZXIgaW4geW91ciBPcGVyYXRpb25UeXBlIG1vZHVsZS5cbiAgI1xuICBwYXJzZU9wZXJhdGlvbjogKGpzb24pLT5cbiAgICB0eXBlID0gQHR5cGVzW2pzb24udHlwZV1cbiAgICBpZiB0eXBlPy5wYXJzZT9cbiAgICAgIHR5cGUucGFyc2UganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcblxuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiBFLmcuIHRoZSBvcGVyYXRpb25zIHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgdXNlcnMgSEIuX2VuY29kZSgpLlxuICAjIEBub3RlIFlvdSBtdXN0IG5vdCB1c2UgdGhpcyBtZXRob2Qgd2hlbiB5b3UgYWxyZWFkeSBoYXZlIG9wcyBpbiB5b3VyIEhCIVxuICAjIyNcbiAgYXBwbHlPcHNCdW5kbGU6IChvcHNfanNvbiktPlxuICAgIG9wcyA9IFtdXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIG9wcy5wdXNoIEBwYXJzZU9wZXJhdGlvbiBvXG4gICAgZm9yIG8gaW4gb3BzXG4gICAgICBpZiBub3Qgby5leGVjdXRlKClcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuICAjIyNcblxuICAjXG4gICMgU2FtZSBhcyBhcHBseU9wcyBidXQgb3BlcmF0aW9ucyB0aGF0IGFyZSBhbHJlYWR5IGluIHRoZSBIQiBhcmUgbm90IGFwcGxpZWQuXG4gICMgQHNlZSBFbmdpbmUuYXBwbHlPcHNcbiAgI1xuICBhcHBseU9wc0NoZWNrRG91YmxlOiAob3BzX2pzb24pLT5cbiAgICBmb3IgbyBpbiBvcHNfanNvblxuICAgICAgaWYgbm90IEBIQi5nZXRPcGVyYXRpb24oby51aWQpP1xuICAgICAgICBAYXBwbHlPcCBvXG5cbiAgI1xuICAjIEFwcGx5IGEgc2V0IG9mIG9wZXJhdGlvbnMuIChIZWxwZXIgZm9yIHVzaW5nIGFwcGx5T3Agb24gQXJyYXlzKVxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcbiAgYXBwbHlPcHM6IChvcHNfanNvbiktPlxuICAgIEBhcHBseU9wIG9wc19qc29uXG5cbiAgI1xuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cbiAgIyBUT0RPOiBtYWtlIHRoaXMgbW9yZSBlZmZpY2llbnQhIVxuICAjIC0gb3BlcmF0aW9ucyBtYXkgb25seSBleGVjdXRlZCBpbiBvcmRlciBieSBjcmVhdG9yLCBvcmRlciB0aGVtIGluIG9iamVjdCBvZiBhcnJheXMgKGtleSBieSBjcmVhdG9yKVxuICAjIC0geW91IGNhbiBwcm9iYWJseSBtYWtlIHNvbWV0aGluZyBsaWtlIGRlcGVuZGVuY2llcyAoY3JlYXRvcjEgd2FpdHMgZm9yIGNyZWF0b3IyKVxuICBhcHBseU9wOiAob3BfanNvbl9hcnJheSwgZnJvbUhCID0gZmFsc2UpLT5cbiAgICBpZiBvcF9qc29uX2FycmF5LmNvbnN0cnVjdG9yIGlzbnQgQXJyYXlcbiAgICAgIG9wX2pzb25fYXJyYXkgPSBbb3BfanNvbl9hcnJheV1cbiAgICBmb3Igb3BfanNvbiBpbiBvcF9qc29uX2FycmF5XG4gICAgICBpZiBmcm9tSEJcbiAgICAgICAgb3BfanNvbi5mcm9tSEIgPSBcInRydWVcIiAjIGV4ZWN1dGUgaW1tZWRpYXRlbHksIGlmXG4gICAgICAjICRwYXJzZV9hbmRfZXhlY3V0ZSB3aWxsIHJldHVybiBmYWxzZSBpZiAkb19qc29uIHdhcyBwYXJzZWQgYW5kIGV4ZWN1dGVkLCBvdGhlcndpc2UgdGhlIHBhcnNlZCBvcGVyYWRpb25cbiAgICAgIG8gPSBAcGFyc2VPcGVyYXRpb24gb3BfanNvblxuICAgICAgby5wYXJzZWRfZnJvbV9qc29uID0gb3BfanNvblxuICAgICAgaWYgb3BfanNvbi5mcm9tSEI/XG4gICAgICAgIG8uZnJvbUhCID0gb3BfanNvbi5mcm9tSEJcbiAgICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXG4gICAgICBpZiBASEIuZ2V0T3BlcmF0aW9uKG8pP1xuICAgICAgICAjIG5vcFxuICAgICAgZWxzZSBpZiAoKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvKSkgYW5kIChub3Qgby5mcm9tSEI/KSkgb3IgKG5vdCBvLmV4ZWN1dGUoKSlcbiAgICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cbiAgICAgICAgd2luZG93Py51bnByb2Nlc3NlZF90eXBlcy5wdXNoIG8udHlwZSAjIFRPRE86IGRlbGV0ZSB0aGlzXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcblxuICAjXG4gICMgQ2FsbCB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhcHBsaWVkIGEgbmV3IG9wZXJhdGlvbi5cbiAgIyBJdCBjaGVja3MgaWYgb3BlcmF0aW9ucyB0aGF0IHdlcmUgcHJldmlvdXNseSBub3QgZXhlY3V0YWJsZSBhcmUgbm93IGV4ZWN1dGFibGUuXG4gICNcbiAgdHJ5VW5wcm9jZXNzZWQ6ICgpLT5cbiAgICB3aGlsZSB0cnVlXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcbiAgICAgIHVucHJvY2Vzc2VkID0gW11cbiAgICAgIGZvciBvcCBpbiBAdW5wcm9jZXNzZWRfb3BzXG4gICAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24ob3ApP1xuICAgICAgICAgICMgbm9wXG4gICAgICAgIGVsc2UgaWYgKG5vdCBASEIuaXNFeHBlY3RlZE9wZXJhdGlvbihvcCkgYW5kIChub3Qgb3AuZnJvbUhCPykpIG9yIChub3Qgb3AuZXhlY3V0ZSgpKVxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxuICAgICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXMgb2xkX2xlbmd0aFxuICAgICAgICBicmVha1xuICAgIGlmIEB1bnByb2Nlc3NlZF9vcHMubGVuZ3RoIGlzbnQgMFxuICAgICAgQEhCLmludm9rZVN5bmMoKVxuXG5cbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCJcbiNcbiMgQG5vZG9jXG4jIEFuIG9iamVjdCB0aGF0IGhvbGRzIGFsbCBhcHBsaWVkIG9wZXJhdGlvbnMuXG4jXG4jIEBub3RlIFRoZSBIaXN0b3J5QnVmZmVyIGlzIGNvbW1vbmx5IGFiYnJldmlhdGVkIHRvIEhCLlxuI1xuY2xhc3MgSGlzdG9yeUJ1ZmZlclxuXG4gICNcbiAgIyBDcmVhdGVzIGFuIGVtcHR5IEhCLlxuICAjIEBwYXJhbSB7T2JqZWN0fSB1c2VyX2lkIENyZWF0b3Igb2YgdGhlIEhCLlxuICAjXG4gIGNvbnN0cnVjdG9yOiAoQHVzZXJfaWQpLT5cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXIgPSB7fVxuICAgIEBidWZmZXIgPSB7fVxuICAgIEBjaGFuZ2VfbGlzdGVuZXJzID0gW11cbiAgICBAZ2FyYmFnZSA9IFtdICMgV2lsbCBiZSBjbGVhbmVkIG9uIG5leHQgY2FsbCBvZiBnYXJiYWdlQ29sbGVjdG9yXG4gICAgQHRyYXNoID0gW10gIyBJcyBkZWxldGVkLiBXYWl0IHVudGlsIGl0IGlzIG5vdCB1c2VkIGFueW1vcmUuXG4gICAgQHBlcmZvcm1HYXJiYWdlQ29sbGVjdGlvbiA9IHRydWVcbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gMzAwMDBcbiAgICBAcmVzZXJ2ZWRfaWRlbnRpZmllcl9jb3VudGVyID0gMFxuICAgIHNldFRpbWVvdXQgQGVtcHR5R2FyYmFnZSwgQGdhcmJhZ2VDb2xsZWN0VGltZW91dFxuXG4gICMgQXQgdGhlIGJlZ2lubmluZyAod2hlbiB0aGUgdXNlciBpZCB3YXMgbm90IGFzc2lnbmVkIHlldCksXG4gICMgdGhlIG9wZXJhdGlvbnMgYXJlIGFkZGVkIHRvIGJ1ZmZlci5fdGVtcC4gV2hlbiB5b3UgZmluYWxseSBnZXQgeW91ciB1c2VyIGlkLFxuICAjIHRoZSBvcGVyYXRpb25zIGFyZSBjb3BpZXMgZnJvbSBidWZmZXIuX3RlbXAgdG8gYnVmZmVyW2lkXS4gRnVydGhlcm1vcmUsIHdoZW4gYnVmZmVyW2lkXSBkb2VzIGFscmVhZHkgY29udGFpbiBvcGVyYXRpb25zXG4gICMgKGJlY2F1c2Ugb2YgYSBwcmV2aW91cyBzZXNzaW9uKSwgdGhlIHVpZC5vcF9udW1iZXJzIG9mIHRoZSBvcGVyYXRpb25zIGhhdmUgdG8gYmUgcmVhc3NpZ25lZC5cbiAgIyBUaGlzIGlzIHdoYXQgdGhpcyBmdW5jdGlvbiBkb2VzLiBJdCBhZGRzIHRoZW0gdG8gYnVmZmVyW2lkXSxcbiAgIyBhbmQgYXNzaWducyB0aGVtIHRoZSBjb3JyZWN0IHVpZC5vcF9udW1iZXIgYW5kIHVpZC5jcmVhdG9yXG4gIHNldFVzZXJJZDogKEB1c2VyX2lkLCBzdGF0ZV92ZWN0b3IpLT5cbiAgICBAYnVmZmVyW0B1c2VyX2lkXSA/PSBbXVxuICAgIGJ1ZmYgPSBAYnVmZmVyW0B1c2VyX2lkXVxuXG4gICAgIyB3ZSBhc3N1bWVkIHRoYXQgd2Ugc3RhcnRlZCB3aXRoIGNvdW50ZXIgPSAwLlxuICAgICMgd2hlbiB3ZSByZWNlaXZlIHRoYSBzdGF0ZV92ZWN0b3IsIGFuZCBhY3R1YWxseSBoYXZlXG4gICAgIyBjb3VudGVyID0gMTAuIFRoZW4gd2UgaGF2ZSB0byBhZGQgMTAgdG8gZXZlcnkgb3BfY291bnRlclxuICAgIGNvdW50ZXJfZGlmZiA9IHN0YXRlX3ZlY3RvcltAdXNlcl9pZF0gb3IgMFxuXG4gICAgaWYgQGJ1ZmZlci5fdGVtcD9cbiAgICAgIGZvciBvX25hbWUsbyBvZiBAYnVmZmVyLl90ZW1wXG4gICAgICAgIG8udWlkLmNyZWF0b3IgPSBAdXNlcl9pZFxuICAgICAgICBvLnVpZC5vcF9udW1iZXIgKz0gY291bnRlcl9kaWZmXG4gICAgICAgIGJ1ZmZbby51aWQub3BfbnVtYmVyXSA9IG9cblxuICAgIEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF0gPSAoQG9wZXJhdGlvbl9jb3VudGVyLl90ZW1wIG9yIDApICsgY291bnRlcl9kaWZmXG5cbiAgICBkZWxldGUgQG9wZXJhdGlvbl9jb3VudGVyLl90ZW1wXG4gICAgZGVsZXRlIEBidWZmZXIuX3RlbXBcblxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgaWYgdV9uYW1lIGlzIFwiX1wiXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICBmb3Igb19udW1iZXIsbyBvZiB1c2VyXG4gICAgICAgIGlmIChub3Qgby51aWQubm9PcGVyYXRpb24/KSBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF0rK1xuICAgIHVpZFxuXG4gICNcbiAgIyBSZXRyaWV2ZSBhbiBvcGVyYXRpb24gZnJvbSBhIHVuaXF1ZSBpZC5cbiAgI1xuICAjIHdoZW4gdWlkIGhhcyBhIFwic3ViXCIgcHJvcGVydHksIHRoZSB2YWx1ZSBvZiBpdCB3aWxsIGJlIGFwcGxpZWRcbiAgIyBvbiB0aGUgb3BlcmF0aW9ucyByZXRyaWV2ZVN1YiBtZXRob2QgKHdoaWNoIG11c3QhIGJlIGRlZmluZWQpXG4gICNcbiAgZ2V0T3BlcmF0aW9uOiAodWlkKS0+XG4gICAgaWYgdWlkLnVpZD9cbiAgICAgIHVpZCA9IHVpZC51aWRcbiAgICBvID0gQGJ1ZmZlclt1aWQuY3JlYXRvcl0/W3VpZC5vcF9udW1iZXJdXG4gICAgaWYgdWlkLnN1Yj8gYW5kIG8/XG4gICAgICBvLnJldHJpZXZlU3ViIHVpZC5zdWJcbiAgICBlbHNlXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZCBhbiBvcGVyYXRpb24gdG8gdGhlIEhCLiBOb3RlIHRoYXQgdGhpcyB3aWxsIG5vdCBsaW5rIGl0IGFnYWluc3RcbiAgIyBvdGhlciBvcGVyYXRpb25zIChpdCB3b250IGV4ZWN1dGVkKVxuICAjXG4gIGFkZE9wZXJhdGlvbjogKG8pLT5cbiAgICBpZiBub3QgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9cbiAgICAgIEBidWZmZXJbby51aWQuY3JlYXRvcl0gPSB7fVxuICAgIGlmIEBidWZmZXJbby51aWQuY3JlYXRvcl1bby51aWQub3BfbnVtYmVyXT9cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBvdmVyd3JpdGUgb3BlcmF0aW9ucyFcIlxuICAgIGlmIChvLnVpZC5vcF9udW1iZXIuY29uc3RydWN0b3IgaXNudCBTdHJpbmcpIGFuZCAobm90IEBpc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pICMgeW91IGFscmVhZHkgZG8gdGhpcyBpbiB0aGUgZW5naW5lLCBzbyBkZWxldGUgaXQgaGVyZSFcbiAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgb3BlcmF0aW9uIHdhcyBub3QgZXhwZWN0ZWQhXCJcbiAgICBAYWRkVG9Db3VudGVyKG8pXG4gICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdID0gb1xuICAgIG9cblxuICByZW1vdmVPcGVyYXRpb246IChvKS0+XG4gICAgZGVsZXRlIEBidWZmZXJbby51aWQuY3JlYXRvcl0/W28udWlkLm9wX251bWJlcl1cblxuICAjIFdoZW4gdGhlIEhCIGRldGVybWluZXMgaW5jb25zaXN0ZW5jaWVzLCB0aGVuIHRoZSBpbnZva2VTeW5jXG4gICMgaGFuZGxlciB3aWwgYmUgY2FsbGVkLCB3aGljaCBzaG91bGQgc29tZWhvdyBpbnZva2UgdGhlIHN5bmMgd2l0aCBhbm90aGVyIGNvbGxhYm9yYXRvci5cbiAgIyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBzeW5jIGhhbmRsZXIgaXMgdGhlIHVzZXJfaWQgd2l0aCB3aWNoIGFuIGluY29uc2lzdGVuY3kgd2FzIGRldGVybWluZWRcbiAgc2V0SW52b2tlU3luY0hhbmRsZXI6IChmKS0+XG4gICAgQGludm9rZVN5bmMgPSBmXG5cbiAgIyBlbXB0eSBwZXIgZGVmYXVsdCAjIFRPRE86IGRvIGkgbmVlZCB0aGlzP1xuICBpbnZva2VTeW5jOiAoKS0+XG5cbiAgIyBhZnRlciB5b3UgcmVjZWl2ZWQgdGhlIEhCIG9mIGFub3RoZXIgdXNlciAoaW4gdGhlIHN5bmMgcHJvY2VzcyksXG4gICMgeW91IHJlbmV3IHlvdXIgb3duIHN0YXRlX3ZlY3RvciB0byB0aGUgc3RhdGVfdmVjdG9yIG9mIHRoZSBvdGhlciB1c2VyXG4gIHJlbmV3U3RhdGVWZWN0b3I6IChzdGF0ZV92ZWN0b3IpLT5cbiAgICBmb3IgdXNlcixzdGF0ZSBvZiBzdGF0ZV92ZWN0b3JcbiAgICAgIGlmICgobm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyXT8pIG9yIChAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPCBzdGF0ZV92ZWN0b3JbdXNlcl0pKSBhbmQgc3RhdGVfdmVjdG9yW3VzZXJdP1xuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl0gPSBzdGF0ZV92ZWN0b3JbdXNlcl1cblxuICAjXG4gICMgSW5jcmVtZW50IHRoZSBvcGVyYXRpb25fY291bnRlciB0aGF0IGRlZmluZXMgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIEVuZ2luZS5cbiAgI1xuICBhZGRUb0NvdW50ZXI6IChvKS0+XG4gICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID89IDBcbiAgICAjIFRPRE86IGNoZWNrIGlmIG9wZXJhdGlvbnMgYXJlIHNlbmQgaW4gb3JkZXJcbiAgICBpZiBvLnVpZC5vcF9udW1iZXIgaXMgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgIHdoaWxlIEBidWZmZXJbby51aWQuY3JlYXRvcl1bQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSsrXG4gICAgdW5kZWZpbmVkXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwiXG5jbGFzcyBZT2JqZWN0XG5cbiAgY29uc3RydWN0b3I6IChAX29iamVjdCA9IHt9KS0+XG4gICAgaWYgQF9vYmplY3QuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICBmb3IgbmFtZSwgdmFsIG9mIEBfb2JqZWN0XG4gICAgICAgIGlmIHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBAX29iamVjdFtuYW1lXSA9IG5ldyBZT2JqZWN0KHZhbClcbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZLk9iamVjdCBhY2NlcHRzIEpzb24gT2JqZWN0cyBvbmx5XCJcblxuICBfbmFtZTogXCJPYmplY3RcIlxuXG4gIF9nZXRNb2RlbDogKHR5cGVzLCBvcHMpLT5cbiAgICBpZiBub3QgQF9tb2RlbD9cbiAgICAgIEBfbW9kZWwgPSBuZXcgb3BzLk1hcE1hbmFnZXIoQCkuZXhlY3V0ZSgpXG4gICAgICBmb3IgbixvIG9mIEBfb2JqZWN0XG4gICAgICAgIEBfbW9kZWwudmFsIG4sIG9cbiAgICBkZWxldGUgQF9vYmplY3RcbiAgICBAX21vZGVsXG5cbiAgX3NldE1vZGVsOiAoQF9tb2RlbCktPlxuICAgIGRlbGV0ZSBAX29iamVjdFxuXG4gIG9ic2VydmU6IChmKS0+XG4gICAgQF9tb2RlbC5vYnNlcnZlIGZcbiAgICBAXG5cbiAgdW5vYnNlcnZlOiAoZiktPlxuICAgIEBfbW9kZWwudW5vYnNlcnZlIGZcbiAgICBAXG5cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwoKVxuICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgIyAgIEByZXR1cm4gW0pzb25dXG4gICNcbiAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICMgICBHZXQgdmFsdWUgb2YgYSBwcm9wZXJ0eS5cbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEByZXR1cm4gWypdIERlcGVuZHMgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS5cbiAgI1xuICAjIEBvdmVybG9hZCB2YWwobmFtZSwgY29udGVudClcbiAgIyAgIFNldCBhIG5ldyBwcm9wZXJ0eS5cbiAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgIyAgIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gY29udGVudCBDb250ZW50IG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICMgICBAcmV0dXJuIFtPYmplY3QgVHlwZV0gVGhpcyBvYmplY3QuIChzdXBwb3J0cyBjaGFpbmluZylcbiAgI1xuICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgaWYgQF9tb2RlbD9cbiAgICAgIEBfbW9kZWwudmFsLmFwcGx5IEBfbW9kZWwsIGFyZ3VtZW50c1xuICAgIGVsc2VcbiAgICAgIGlmIGNvbnRlbnQ/XG4gICAgICAgIEBfb2JqZWN0W25hbWVdID0gY29udGVudFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBAX29iamVjdFtuYW1lXVxuICAgICAgZWxzZVxuICAgICAgICByZXMgPSB7fVxuICAgICAgICBmb3Igbix2IG9mIEBfb2JqZWN0XG4gICAgICAgICAgcmVzW25dID0gdlxuICAgICAgICByZXNcblxuICBkZWxldGU6IChuYW1lKS0+XG4gICAgQF9tb2RlbC5kZWxldGUobmFtZSlcbiAgICBAXG5cbmlmIHdpbmRvdz9cbiAgaWYgd2luZG93Llk/XG4gICAgd2luZG93LlkuT2JqZWN0ID0gWU9iamVjdFxuICBlbHNlXG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZmlyc3QgaW1wb3J0IFkhXCJcblxuaWYgbW9kdWxlP1xuICBtb2R1bGUuZXhwb3J0cyA9IFlPYmplY3RcbiIsIm1vZHVsZS5leHBvcnRzID0gKCktPlxuICAjIEBzZWUgRW5naW5lLnBhcnNlXG4gIG9wcyA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEBwcml2YXRlXG4gICMgQGFic3RyYWN0XG4gICMgQG5vZG9jXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcHMuXG4gICNcbiAgIyBBbiBvcGVyYXRpb24gaGFzIHRoZSBmb2xsb3dpbmcgbWV0aG9kczpcbiAgIyAqIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyAqIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgKiB2YWw6IGluIHRoZSBjYXNlIHRoYXQgdGhlIG9wZXJhdGlvbiBob2xkcyBhIHZhbHVlXG4gICNcbiAgIyBGdXJ0aGVybW9yZSBhbiBlbmNvZGFibGUgb3BlcmF0aW9uIGhhcyBhIHBhcnNlci4gV2UgZXh0ZW5kIHRoZSBwYXJzZXIgb2JqZWN0IGluIG9yZGVyIHRvIHBhcnNlIGVuY29kZWQgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cbiAgICAgIGlmIGN1c3RvbV90eXBlP1xuICAgICAgICBAY3VzdG9tX3R5cGUgPSBjdXN0b21fdHlwZVxuICAgICAgQGlzX2RlbGV0ZWQgPSBmYWxzZVxuICAgICAgQGdhcmJhZ2VfY29sbGVjdGVkID0gZmFsc2VcbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXSAjIFRPRE86IHJlbmFtZSB0byBvYnNlcnZlcnMgb3Igc3RoIGxpa2UgdGhhdFxuICAgICAgaWYgdWlkP1xuICAgICAgICBAdWlkID0gdWlkXG5cbiAgICAgICMgc2VlIGVuY29kZSB0byBzZWUsIHdoeSB3ZSBhcmUgZG9pbmcgaXQgdGhpcyB3YXlcbiAgICAgIGlmIGNvbnRlbnQgaXMgdW5kZWZpbmVkXG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50LmNyZWF0b3I/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudCA9IGNvbnRlbnRcbiAgICAgIGlmIGNvbnRlbnRfb3BlcmF0aW9ucz9cbiAgICAgICAgQGNvbnRlbnRfb3BlcmF0aW9ucyA9IHt9XG4gICAgICAgIGZvciBuYW1lLCBvcCBvZiBjb250ZW50X29wZXJhdGlvbnNcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuYW1lLCBvcCwgJ2NvbnRlbnRfb3BlcmF0aW9ucydcblxuICAgIHR5cGU6IFwiT3BlcmF0aW9uXCJcblxuICAgIGdldENvbnRlbnQ6IChuYW1lKS0+XG4gICAgICBpZiBAY29udGVudD9cbiAgICAgICAgaWYgQGNvbnRlbnQuZ2V0Q3VzdG9tVHlwZT9cbiAgICAgICAgICBAY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZSBpZiBAY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICBpZiBuYW1lP1xuICAgICAgICAgICAgaWYgQGNvbnRlbnRbbmFtZV0/XG4gICAgICAgICAgICAgIEBjb250ZW50W25hbWVdXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIEBjb250ZW50X29wZXJhdGlvbnNbbmFtZV0uZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY29udGVudCA9IHt9XG4gICAgICAgICAgICBmb3Igbix2IG9mIEBjb250ZW50XG4gICAgICAgICAgICAgIGNvbnRlbnRbbl0gPSB2XG4gICAgICAgICAgICBpZiBAY29udGVudF9vcGVyYXRpb25zP1xuICAgICAgICAgICAgICBmb3Igbix2IG9mIEBjb250ZW50X29wZXJhdGlvbnNcbiAgICAgICAgICAgICAgICB2ID0gdi5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgICAgICAgICBjb250ZW50W25dID0gdlxuICAgICAgICAgICAgY29udGVudFxuICAgICAgICBlbHNlXG4gICAgICAgICAgQGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnRcblxuICAgIHJldHJpZXZlU3ViOiAoKS0+XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJzdWIgcHJvcGVydGllcyBhcmUgbm90IGVuYWJsZSBvbiB0aGlzIG9wZXJhdGlvbiB0eXBlIVwiXG5cbiAgICAjXG4gICAgIyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIuIEl0IGRlcGVuZHMgb24gdGhlIG9wZXJhdGlvbiB3aGljaCBldmVudHMgYXJlIHN1cHBvcnRlZC5cbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cbiAgICAjXG4gICAgb2JzZXJ2ZTogKGYpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMucHVzaCBmXG5cbiAgICAjXG4gICAgIyBEZWxldGVzIGZ1bmN0aW9uIGZyb20gdGhlIG9ic2VydmVyIGxpc3RcbiAgICAjIEBzZWUgT3BlcmF0aW9uLm9ic2VydmVcbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdW5vYnNlcnZlKGV2ZW50LCBmKVxuICAgICMgICBAcGFyYW0gZiAgICAge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdGhhdCB5b3Ugd2FudCB0byBkZWxldGVcbiAgICB1bm9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cbiAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYWxsIHN1YnNjcmliZWQgZXZlbnQgbGlzdGVuZXJzLlxuICAgICMgVGhpcyBzaG91bGQgYmUgY2FsbGVkLCBlLmcuIGFmdGVyIHRoaXMgaGFzIGJlZW4gcmVwbGFjZWQuXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXG4gICAgIyBUaGlzIGlzIGFsc28gY2FsbGVkIGluIHRoZSBjbGVhbnVwIG1ldGhvZC5cbiAgICBkZWxldGVBbGxPYnNlcnZlcnM6ICgpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxuXG4gICAgZGVsZXRlOiAoKS0+XG4gICAgICAobmV3IG9wcy5EZWxldGUgdW5kZWZpbmVkLCBAKS5leGVjdXRlKClcbiAgICAgIG51bGxcblxuICAgICNcbiAgICAjIEZpcmUgYW4gZXZlbnQuXG4gICAgIyBUT0RPOiBEbyBzb21ldGhpbmcgd2l0aCB0aW1lb3V0cy4gWW91IGRvbid0IHdhbnQgdGhpcyB0byBmaXJlIGZvciBldmVyeSBvcGVyYXRpb24gKGUuZy4gaW5zZXJ0KS5cbiAgICAjIFRPRE86IGRvIHlvdSBuZWVkIGNhbGxFdmVudCtmb3J3YXJkRXZlbnQ/IE9ubHkgb25lIHN1ZmZpY2VzIHByb2JhYmx5XG4gICAgY2FsbEV2ZW50OiAoKS0+XG4gICAgICBpZiBAY3VzdG9tX3R5cGU/XG4gICAgICAgIGNhbGxvbiA9IEBnZXRDdXN0b21UeXBlKClcbiAgICAgIGVsc2VcbiAgICAgICAgY2FsbG9uID0gQFxuICAgICAgQGZvcndhcmRFdmVudCBjYWxsb24sIGFyZ3VtZW50cy4uLlxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudCBhbmQgc3BlY2lmeSBpbiB3aGljaCBjb250ZXh0IHRoZSBsaXN0ZW5lciBpcyBjYWxsZWQgKHNldCAndGhpcycpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgdGhpcyA/XG4gICAgZm9yd2FyZEV2ZW50OiAob3AsIGFyZ3MuLi4pLT5cbiAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNcbiAgICAgICAgZi5jYWxsIG9wLCBhcmdzLi4uXG5cbiAgICBpc0RlbGV0ZWQ6ICgpLT5cbiAgICAgIEBpc19kZWxldGVkXG5cbiAgICBhcHBseURlbGV0ZTogKGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZSktPlxuICAgICAgaWYgbm90IEBnYXJiYWdlX2NvbGxlY3RlZFxuICAgICAgICAjY29uc29sZS5sb2cgXCJhcHBseURlbGV0ZTogI3tAdHlwZX1cIlxuICAgICAgICBAaXNfZGVsZXRlZCA9IHRydWVcbiAgICAgICAgaWYgZ2FyYmFnZWNvbGxlY3RcbiAgICAgICAgICBAZ2FyYmFnZV9jb2xsZWN0ZWQgPSB0cnVlXG4gICAgICAgICAgQEhCLmFkZFRvR2FyYmFnZUNvbGxlY3RvciBAXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICAjY29uc29sZS5sb2cgXCJjbGVhbnVwOiAje0B0eXBlfVwiXG4gICAgICBASEIucmVtb3ZlT3BlcmF0aW9uIEBcbiAgICAgIEBkZWxldGVBbGxPYnNlcnZlcnMoKVxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBAdWlkXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEB1aWQuYWx0PyAjIGNvdWxkIGJlIChzYWZlbHkpIHVuZGVmaW5lZFxuICAgICAgICAgIG1hcF91aWQgPSBAdWlkLmFsdC5jbG9uZVVpZCgpXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxuICAgICAgICAgIG1hcF91aWRcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xvbmVVaWQ6ICgpLT5cbiAgICAgIHVpZCA9IHt9XG4gICAgICBmb3Igbix2IG9mIEBnZXRVaWQoKVxuICAgICAgICB1aWRbbl0gPSB2XG4gICAgICB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJZiBub3QgYWxyZWFkeSBkb25lLCBzZXQgdGhlIHVpZFxuICAgICMgQWRkIHRoaXMgdG8gdGhlIEhCXG4gICAgIyBOb3RpZnkgdGhlIGFsbCB0aGUgbGlzdGVuZXJzLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAaXNfZXhlY3V0ZWQgPSB0cnVlXG4gICAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAgICMgV2hlbiB0aGlzIG9wZXJhdGlvbiB3YXMgY3JlYXRlZCB3aXRob3V0IGEgdWlkLCB0aGVuIHNldCBpdCBoZXJlLlxuICAgICAgICAgICMgVGhlcmUgaXMgb25seSBvbmUgb3RoZXIgcGxhY2UsIHdoZXJlIHRoaXMgY2FuIGJlIGRvbmUgLSBiZWZvcmUgYW4gSW5zZXJ0aW9uXG4gICAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICAgIEB1aWQgPSBASEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgICBpZiBub3QgQHVpZC5ub09wZXJhdGlvbj9cbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIEBcbiAgICAgICAgICBmb3IgbCBpbiBleGVjdXRpb25fbGlzdGVuZXJcbiAgICAgICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgICBAXG4gICAgICBlbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgT3BlcmF0aW9ucyBtYXkgZGVwZW5kIG9uIG90aGVyIG9wZXJhdGlvbnMgKGxpbmtlZCBsaXN0cywgZXRjLikuXG4gICAgIyBUaGUgc2F2ZU9wZXJhdGlvbiBhbmQgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbWV0aG9kcyBwcm92aWRlXG4gICAgIyBhbiBlYXN5IHdheSB0byByZWZlciB0byB0aGVzZSBvcGVyYXRpb25zIHZpYSBhbiB1aWQgb3Igb2JqZWN0IHJlZmVyZW5jZS5cbiAgICAjXG4gICAgIyBGb3IgZXhhbXBsZTogV2UgY2FuIGNyZWF0ZSBhIG5ldyBEZWxldGUgb3BlcmF0aW9uIHRoYXQgZGVsZXRlcyB0aGUgb3BlcmF0aW9uICRvIGxpa2UgdGhpc1xuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8pOyAgIG9yXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkby5nZXRVaWQoKSk7XG4gICAgIyBFaXRoZXIgd2F5IHdlIHdhbnQgdG8gYWNjZXNzICRvIHZpYSBkLmRlbGV0ZXMuIEluIHRoZSBzZWNvbmQgY2FzZSB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtdXN0IGJlIGNhbGxlZCBmaXJzdC5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcF91aWQpXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIHZhbGlkYXRpbmcgKHdpdGggdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMpIHRoZSBpbnN0YW50aWF0ZWQgb3BlcmF0aW9uIHdpbGwgYmUgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R9IG9wX3VpZCBBIHVpZCB0aGF0IHJlZmVycyB0byBhbiBvcGVyYXRpb25cbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gb3AgaXMgYWNjZXNzaWJsZSB2aWEgdGhpc1tuYW1lXS5cbiAgICAjICAgQHBhcmFtIHtPcGVyYXRpb259IG9wIEFuIE9wZXJhdGlvbiBvYmplY3RcbiAgICAjXG4gICAgc2F2ZU9wZXJhdGlvbjogKG5hbWUsIG9wLCBiYXNlID0gXCJ0aGlzXCIpLT5cbiAgICAgIGlmIG9wPyBhbmQgb3AuX2dldE1vZGVsP1xuICAgICAgICBvcCA9IG9wLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICNcbiAgICAgICMgRXZlcnkgaW5zdGFuY2Ugb2YgJE9wZXJhdGlvbiBtdXN0IGhhdmUgYW4gJGV4ZWN1dGUgZnVuY3Rpb24uXG4gICAgICAjIFdlIHVzZSBkdWNrLXR5cGluZyB0byBjaGVjayBpZiBvcCBpcyBpbnN0YW50aWF0ZWQgc2luY2UgdGhlcmVcbiAgICAgICMgY291bGQgZXhpc3QgbXVsdGlwbGUgY2xhc3NlcyBvZiAkT3BlcmF0aW9uXG4gICAgICAjXG4gICAgICBpZiBub3Qgb3A/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmIG9wLmV4ZWN1dGU/IG9yIG5vdCAob3Aub3BfbnVtYmVyPyBhbmQgb3AuY3JlYXRvcj8pXG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkLCBvciBvcCBpcyBzdHJpbmcuIEN1cnJlbnRseSBcIkRlbGltaXRlclwiIGlzIHNhdmVkIGFzIHN0cmluZ1xuICAgICAgICAjIChpbiBjb21iaW5hdGlvbiB3aXRoIEBwYXJlbnQgeW91IGNhbiByZXRyaWV2ZSB0aGUgZGVsaW1pdGVyLi4pXG4gICAgICAgIGlmIGJhc2UgaXMgXCJ0aGlzXCJcbiAgICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGRlc3QgPSBAW2Jhc2VdXG4gICAgICAgICAgcGF0aHMgPSBuYW1lLnNwbGl0KFwiL1wiKVxuICAgICAgICAgIGxhc3RfcGF0aCA9IHBhdGhzLnBvcCgpXG4gICAgICAgICAgZm9yIHBhdGggaW4gcGF0aHNcbiAgICAgICAgICAgIGRlc3QgPSBkZXN0W3BhdGhdXG4gICAgICAgICAgZGVzdFtsYXN0X3BhdGhdID0gb3BcbiAgICAgIGVsc2VcbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbYmFzZV0gPz0ge31cbiAgICAgICAgQHVuY2hlY2tlZFtiYXNlXVtuYW1lXSA9IG9wXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIGFsbCBub3QgaW5zdGFudGlhdGVkIG9wZXJhdGlvbnMgd2lsbCBiZSBhY2Nlc3NpYmxlLlxuICAgICMgQHNlZSBPcGVyYXRpb24uc2F2ZU9wZXJhdGlvblxuICAgICNcbiAgICAjIEByZXR1cm4gW0Jvb2xlYW5dIFdoZXRoZXIgaXQgd2FzIHBvc3NpYmxlIHRvIGluc3RhbnRpYXRlIGFsbCBvcGVyYXRpb25zLlxuICAgICNcbiAgICB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9uczogKCktPlxuICAgICAgdW5pbnN0YW50aWF0ZWQgPSB7fVxuICAgICAgc3VjY2VzcyA9IHRydWVcbiAgICAgIGZvciBiYXNlX25hbWUsIGJhc2Ugb2YgQHVuY2hlY2tlZFxuICAgICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIGJhc2VcbiAgICAgICAgICBvcCA9IEBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgICAgaWYgb3BcbiAgICAgICAgICAgIGlmIGJhc2VfbmFtZSBpcyBcInRoaXNcIlxuICAgICAgICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgZGVzdCA9IEBbYmFzZV9uYW1lXVxuICAgICAgICAgICAgICBwYXRocyA9IG5hbWUuc3BsaXQoXCIvXCIpXG4gICAgICAgICAgICAgIGxhc3RfcGF0aCA9IHBhdGhzLnBvcCgpXG4gICAgICAgICAgICAgIGZvciBwYXRoIGluIHBhdGhzXG4gICAgICAgICAgICAgICAgZGVzdCA9IGRlc3RbcGF0aF1cbiAgICAgICAgICAgICAgZGVzdFtsYXN0X3BhdGhdID0gb3BcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB1bmluc3RhbnRpYXRlZFtiYXNlX25hbWVdID89IHt9XG4gICAgICAgICAgICB1bmluc3RhbnRpYXRlZFtiYXNlX25hbWVdW25hbWVdID0gb3BfdWlkXG4gICAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgICAgcmV0dXJuIEBcblxuICAgIGdldEN1c3RvbVR5cGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAY3VzdG9tX3R5cGU/XG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwiVGhpcyBvcGVyYXRpb24gd2FzIG5vdCBpbml0aWFsaXplZCB3aXRoIGEgY3VzdG9tIHR5cGVcIlxuICAgICAgICBAXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjdXN0b21fdHlwZS5jb25zdHJ1Y3RvciBpcyBTdHJpbmdcbiAgICAgICAgICAjIGhhcyBub3QgYmVlbiBpbml0aWFsaXplZCB5ZXQgKG9ubHkgdGhlIG5hbWUgaXMgc3BlY2lmaWVkKVxuICAgICAgICAgIFR5cGUgPSBAY3VzdG9tX3R5cGVzXG4gICAgICAgICAgZm9yIHQgaW4gQGN1c3RvbV90eXBlLnNwbGl0KFwiLlwiKVxuICAgICAgICAgICAgVHlwZSA9IFR5cGVbdF1cbiAgICAgICAgICBAY3VzdG9tX3R5cGUgPSBuZXcgVHlwZSgpXG4gICAgICAgICAgQGN1c3RvbV90eXBlLl9zZXRNb2RlbCBAXG4gICAgICAgIEBjdXN0b21fdHlwZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6IChqc29uID0ge30pLT5cbiAgICAgIGpzb24udHlwZSA9IEB0eXBlXG4gICAgICBqc29uLnVpZCA9IEBnZXRVaWQoKVxuICAgICAgaWYgQGN1c3RvbV90eXBlP1xuICAgICAgICBpZiBAY3VzdG9tX3R5cGUuY29uc3RydWN0b3IgaXMgU3RyaW5nXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZVxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbi5jdXN0b21fdHlwZSA9IEBjdXN0b21fdHlwZS5fbmFtZVxuXG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uLmNvbnRlbnQgPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uLmNvbnRlbnQgPSBAY29udGVudFxuICAgICAgaWYgQGNvbnRlbnRfb3BlcmF0aW9ucz9cbiAgICAgICAgb3BlcmF0aW9ucyA9IHt9XG4gICAgICAgIGZvciBuLG8gb2YgQGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgICAgIGlmIG8uX2dldE1vZGVsP1xuICAgICAgICAgICAgbyA9IG8uX2dldE1vZGVsKEBjdXN0b21fdHlwZXMsIEBvcGVyYXRpb25zKVxuICAgICAgICAgIG9wZXJhdGlvbnNbbl0gPSBvLmdldFVpZCgpXG4gICAgICAgIGpzb24uY29udGVudF9vcGVyYXRpb25zID0gb3BlcmF0aW9uc1xuICAgICAganNvblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyBvcHMuRGVsZXRlIGV4dGVuZHMgb3BzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGN1c3RvbV90eXBlLCB1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZFxuXG4gICAgdHlwZTogXCJEZWxldGVcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIENvbnZlcnQgYWxsIHJlbGV2YW50IGluZm9ybWF0aW9uIG9mIHRoaXMgb3BlcmF0aW9uIHRvIHRoZSBqc29uLWZvcm1hdC5cbiAgICAjIFRoaXMgcmVzdWx0IGNhbiBiZSBzZW50IHRvIG90aGVyIGNsaWVudHMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnOiBcIkRlbGV0ZVwiXG4gICAgICAgICd1aWQnOiBAZ2V0VWlkKClcbiAgICAgICAgJ2RlbGV0ZXMnOiBAZGVsZXRlcy5nZXRVaWQoKVxuICAgICAgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFwcGx5IHRoZSBkZWxldGlvbi5cbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmVzID0gc3VwZXJcbiAgICAgICAgaWYgcmVzXG4gICAgICAgICAgQGRlbGV0ZXMuYXBwbHlEZWxldGUgQFxuICAgICAgICByZXNcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBvcHMuRGVsZXRlLnBhcnNlID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IHRoaXMobnVsbCwgdWlkLCBkZWxldGVzX3VpZClcblxuICAjXG4gICMgQG5vZG9jXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZCAodW5pbXBsZW1lbnRlZCwgZ29vZCBpZGVhPylcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIG9wcy5JbnNlcnQgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucywgcGFyZW50LCB1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIGlmIG9yaWdpbj9cbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIG9yaWdpblxuICAgICAgZWxzZVxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIgY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zXG5cbiAgICB0eXBlOiBcIkluc2VydFwiXG5cbiAgICB2YWw6ICgpLT5cbiAgICAgIEBnZXRDb250ZW50KClcblxuICAgIGdldE5leHQ6IChpPTEpLT5cbiAgICAgIG4gPSBAXG4gICAgICB3aGlsZSBpID4gMCBhbmQgbi5uZXh0X2NsP1xuICAgICAgICBuID0gbi5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBuLmlzX2RlbGV0ZWRcbiAgICAgICAgICBpLS1cbiAgICAgIGlmIG4uaXNfZGVsZXRlZFxuICAgICAgICBudWxsXG4gICAgICBuXG5cbiAgICBnZXRQcmV2OiAoaT0xKS0+XG4gICAgICBuID0gQFxuICAgICAgd2hpbGUgaSA+IDAgYW5kIG4ucHJldl9jbD9cbiAgICAgICAgbiA9IG4ucHJldl9jbFxuICAgICAgICBpZiBub3Qgbi5pc19kZWxldGVkXG4gICAgICAgICAgaS0tXG4gICAgICBpZiBuLmlzX2RlbGV0ZWRcbiAgICAgICAgbnVsbFxuICAgICAgZWxzZVxuICAgICAgICBuXG5cbiAgICAjXG4gICAgIyBzZXQgY29udGVudCB0byBudWxsIGFuZCBvdGhlciBzdHVmZlxuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgY2FsbExhdGVyID0gZmFsc2VcbiAgICAgIGlmIEBwYXJlbnQ/IGFuZCBub3QgQGlzX2RlbGV0ZWQgYW5kIG8/ICMgbz8gOiBpZiBub3Qgbz8sIHRoZW4gdGhlIGRlbGltaXRlciBkZWxldGVkIHRoaXMgSW5zZXJ0aW9uLiBGdXJ0aGVybW9yZSwgaXQgd291bGQgYmUgd3JvbmcgdG8gY2FsbCBpdC4gVE9ETzogbWFrZSB0aGlzIG1vcmUgZXhwcmVzc2l2ZSBhbmQgc2F2ZVxuICAgICAgICAjIGNhbGwgaWZmIHdhc24ndCBkZWxldGVkIGVhcmx5ZXJcbiAgICAgICAgY2FsbExhdGVyID0gdHJ1ZVxuICAgICAgaWYgbz9cbiAgICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG4gICAgICBnYXJiYWdlY29sbGVjdCA9IGZhbHNlXG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICBnYXJiYWdlY29sbGVjdCA9IHRydWVcbiAgICAgIHN1cGVyIGdhcmJhZ2Vjb2xsZWN0XG4gICAgICBpZiBjYWxsTGF0ZXJcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHModGhpcywgbylcbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQHByZXZfY2wuaXNEZWxldGVkKCkgYW5kIEBwcmV2X2NsLmdhcmJhZ2VfY29sbGVjdGVkIGlzbnQgdHJ1ZVxuICAgICAgICAjIGdhcmJhZ2UgY29sbGVjdCBwcmV2X2NsXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgICMgZGVsZXRlIGFsbCBvcHMgdGhhdCBkZWxldGUgdGhpcyBpbnNlcnRpb25cbiAgICAgICAgZm9yIGQgaW4gQGRlbGV0ZWRfYnlcbiAgICAgICAgICBkLmNsZWFudXAoKVxuXG4gICAgICAgICMgdGhyb3cgbmV3IEVycm9yIFwicmlnaHQgaXMgbm90IGRlbGV0ZWQuIGluY29uc2lzdGVuY3khLCB3cmFyYXJhclwiXG4gICAgICAgICMgY2hhbmdlIG9yaWdpbiByZWZlcmVuY2VzIHRvIHRoZSByaWdodFxuICAgICAgICBvID0gQG5leHRfY2xcbiAgICAgICAgd2hpbGUgby50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAgIGlmIG8ub3JpZ2luIGlzIEBcbiAgICAgICAgICAgIG8ub3JpZ2luID0gQHByZXZfY2xcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICMgcmVjb25uZWN0IGxlZnQvcmlnaHRcbiAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBuZXh0X2NsXG4gICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAcHJldl9jbFxuXG4gICAgICAgICMgZGVsZXRlIGNvbnRlbnRcbiAgICAgICAgIyAtIHdlIG11c3Qgbm90IGRvIHRoaXMgaW4gYXBwbHlEZWxldGUsIGJlY2F1c2UgdGhpcyB3b3VsZCBsZWFkIHRvIGluY29uc2lzdGVuY2llc1xuICAgICAgICAjIChlLmcuIHRoZSBmb2xsb3dpbmcgb3BlcmF0aW9uIG9yZGVyIG11c3QgYmUgaW52ZXJ0aWJsZSA6XG4gICAgICAgICMgICBJbnNlcnQgcmVmZXJzIHRvIGNvbnRlbnQsIHRoZW4gdGhlIGNvbnRlbnQgaXMgZGVsZXRlZClcbiAgICAgICAgIyBUaGVyZWZvcmUsIHdlIGhhdmUgdG8gZG8gdGhpcyBpbiB0aGUgY2xlYW51cFxuICAgICAgICAjICogTk9ERTogV2UgbmV2ZXIgZGVsZXRlIEluc2VydGlvbnMhXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvbiBhbmQgbm90IChAY29udGVudCBpbnN0YW5jZW9mIG9wcy5JbnNlcnQpXG4gICAgICAgICAgQGNvbnRlbnQucmVmZXJlbmNlZF9ieS0tXG4gICAgICAgICAgaWYgQGNvbnRlbnQucmVmZXJlbmNlZF9ieSA8PSAwIGFuZCBub3QgQGNvbnRlbnQuaXNfZGVsZXRlZFxuICAgICAgICAgICAgQGNvbnRlbnQuYXBwbHlEZWxldGUoKVxuICAgICAgICBkZWxldGUgQGNvbnRlbnRcbiAgICAgICAgc3VwZXJcbiAgICAgICMgZWxzZVxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAICMgVE9ETzogdGhpcyBpcyBwcm9iYWJseSBub3QgbmVjZXNzYXJ5IGFuZCBvbmx5IG5pY2UgZm9yIGRlYnVnZ2luZ1xuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnkgPz0gMFxuICAgICAgICAgIEBjb250ZW50LnJlZmVyZW5jZWRfYnkrK1xuICAgICAgICBpZiBAcGFyZW50P1xuICAgICAgICAgIGlmIG5vdCBAcHJldl9jbD9cbiAgICAgICAgICAgIEBwcmV2X2NsID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG9yaWdpbj9cbiAgICAgICAgICAgIEBvcmlnaW4gPSBAcHJldl9jbFxuICAgICAgICAgIGVsc2UgaWYgQG9yaWdpbiBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgICAgICBAb3JpZ2luID0gQHBhcmVudC5iZWdpbm5pbmdcbiAgICAgICAgICBpZiBub3QgQG5leHRfY2w/XG4gICAgICAgICAgICBAbmV4dF9jbCA9IEBwYXJlbnQuZW5kXG4gICAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IEBnZXREaXN0YW5jZVRvT3JpZ2luKCkgIyBtb3N0IGNhc2VzOiAwXG4gICAgICAgICAgbyA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBpID0gZGlzdGFuY2VfdG9fb3JpZ2luICMgbG9vcCBjb3VudGVyXG5cbiAgICAgICAgICAjICR0aGlzIGhhcyB0byBmaW5kIGEgdW5pcXVlIHBvc2l0aW9uIGJldHdlZW4gb3JpZ2luIGFuZCB0aGUgbmV4dCBrbm93biBjaGFyYWN0ZXJcbiAgICAgICAgICAjIGNhc2UgMTogJG9yaWdpbiBlcXVhbHMgJG8ub3JpZ2luOiB0aGUgJGNyZWF0b3IgcGFyYW1ldGVyIGRlY2lkZXMgaWYgbGVmdCBvciByaWdodFxuICAgICAgICAgICMgICAgICAgICBsZXQgJE9MPSBbbzEsbzIsbzMsbzRdLCB3aGVyZWJ5ICR0aGlzIGlzIHRvIGJlIGluc2VydGVkIGJldHdlZW4gbzEgYW5kIG80XG4gICAgICAgICAgIyAgICAgICAgIG8yLG8zIGFuZCBvNCBvcmlnaW4gaXMgMSAodGhlIHBvc2l0aW9uIG9mIG8yKVxuICAgICAgICAgICMgICAgICAgICB0aGVyZSBpcyB0aGUgY2FzZSB0aGF0ICR0aGlzLmNyZWF0b3IgPCBvMi5jcmVhdG9yLCBidXQgbzMuY3JlYXRvciA8ICR0aGlzLmNyZWF0b3JcbiAgICAgICAgICAjICAgICAgICAgdGhlbiBvMiBrbm93cyBvMy4gU2luY2Ugb24gYW5vdGhlciBjbGllbnQgJE9MIGNvdWxkIGJlIFtvMSxvMyxvNF0gdGhlIHByb2JsZW0gaXMgY29tcGxleFxuICAgICAgICAgICMgICAgICAgICB0aGVyZWZvcmUgJHRoaXMgd291bGQgYmUgYWx3YXlzIHRvIHRoZSByaWdodCBvZiBvM1xuICAgICAgICAgICMgY2FzZSAyOiAkb3JpZ2luIDwgJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgIGlmIGN1cnJlbnQgJHRoaXMgaW5zZXJ0X3Bvc2l0aW9uID4gJG8gb3JpZ2luOiAkdGhpcyBpbnNcbiAgICAgICAgICAjICAgICAgICAgZWxzZSAkaW5zZXJ0X3Bvc2l0aW9uIHdpbGwgbm90IGNoYW5nZVxuICAgICAgICAgICMgICAgICAgICAobWF5YmUgd2UgZW5jb3VudGVyIGNhc2UgMSBsYXRlciwgdGhlbiB0aGlzIHdpbGwgYmUgdG8gdGhlIHJpZ2h0IG9mICRvKVxuICAgICAgICAgICMgY2FzZSAzOiAkb3JpZ2luID4gJG8ub3JpZ2luXG4gICAgICAgICAgIyAgICAgICAgICR0aGlzIGluc2VydF9wb3NpdGlvbiBpcyB0byB0aGUgbGVmdCBvZiAkbyAoZm9yZXZlciEpXG4gICAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8udWlkLmNyZWF0b3IgPCBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjIG5vcFxuICAgICAgICAgICAgICBlbHNlIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIDwgaVxuICAgICAgICAgICAgICAgICMgY2FzZSAyXG4gICAgICAgICAgICAgICAgaWYgaSAtIGRpc3RhbmNlX3RvX29yaWdpbiA8PSBvLmdldERpc3RhbmNlVG9PcmlnaW4oKVxuICAgICAgICAgICAgICAgICAgQHByZXZfY2wgPSBvXG4gICAgICAgICAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBpICsgMVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICNub3BcbiAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICMgY2FzZSAzXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgIyAkdGhpcyBrbm93cyB0aGF0ICRvIGV4aXN0cyxcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAjIG5vdyByZWNvbm5lY3QgZXZlcnl0aGluZ1xuICAgICAgICAgIEBuZXh0X2NsID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgQG5leHRfY2wucHJldl9jbCA9IEBcblxuICAgICAgICBAc2V0UGFyZW50IEBwcmV2X2NsLmdldFBhcmVudCgpICMgZG8gSW5zZXJ0aW9ucyBhbHdheXMgaGF2ZSBhIHBhcmVudD9cbiAgICAgICAgc3VwZXIgIyBub3RpZnkgdGhlIGV4ZWN1dGlvbl9saXN0ZW5lcnNcbiAgICAgICAgQHBhcmVudC5jYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHModGhpcylcbiAgICAgICAgQFxuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKGpzb24gPSB7fSktPlxuICAgICAganNvbi5wcmV2ID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGpzb24ubmV4dCA9IEBuZXh0X2NsLmdldFVpZCgpXG5cbiAgICAgIGlmIEBvcmlnaW4udHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIGpzb24ub3JpZ2luID0gXCJEZWxpbWl0ZXJcIlxuICAgICAgZWxzZSBpZiBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbi5vcmlnaW4gPSBAb3JpZ2luLmdldFVpZCgpXG5cbiAgICAgICMgaWYgbm90IChqc29uLnByZXY/IGFuZCBqc29uLm5leHQ/KVxuICAgICAganNvbi5wYXJlbnQgPSBAcGFyZW50LmdldFVpZCgpXG5cbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuSW5zZXJ0LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ3BhcmVudCcgOiBwYXJlbnRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzIG51bGwsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucywgcGFyZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIG9wcy5EZWxpbWl0ZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciBudWxsLCB7bm9PcGVyYXRpb246IHRydWV9XG5cbiAgICB0eXBlOiBcIkRlbGltaXRlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgc3VwZXIoKVxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSBvP1xuICAgICAgICBvLmFwcGx5RGVsZXRlKClcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdW5jaGVja2VkP1snbmV4dF9jbCddP1xuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAdW5jaGVja2VkP1sncHJldl9jbCddXG4gICAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgICAgaWYgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlByb2JhYmx5IGR1cGxpY2F0ZWQgb3BlcmF0aW9uc1wiXG4gICAgICAgICAgQHByZXZfY2wubmV4dF9jbCA9IEBcbiAgICAgICAgICBzdXBlclxuICAgICAgICBlbHNlXG4gICAgICAgICAgZmFsc2VcbiAgICAgIGVsc2UgaWYgQHByZXZfY2w/IGFuZCBub3QgQHByZXZfY2wubmV4dF9jbD9cbiAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBvciBAbmV4dF9jbD8gb3IgdHJ1ZSAjIFRPRE86IGFyZSB5b3Ugc3VyZT8gVGhpcyBjYW4gaGFwcGVuIHJpZ2h0P1xuICAgICAgICBzdXBlclxuICAgICAgI2Vsc2VcbiAgICAgICMgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBAdHlwZVxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAncHJldicgOiBAcHJldl9jbD8uZ2V0VWlkKClcbiAgICAgICAgJ25leHQnIDogQG5leHRfY2w/LmdldFVpZCgpXG4gICAgICB9XG5cbiAgb3BzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAnb3BlcmF0aW9ucycgOiBvcHNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG4iLCJiYXNpY19vcHNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoKS0+XG4gIGJhc2ljX29wcyA9IGJhc2ljX29wc191bmluaXRpYWxpemVkKClcbiAgb3BzID0gYmFzaWNfb3BzLm9wZXJhdGlvbnNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3Mgb3BzLk1hcE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKS0+XG4gICAgICBAX21hcCA9IHt9XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgZm9yIG5hbWUscCBvZiBAX21hcFxuICAgICAgICBwLmFwcGx5RGVsZXRlKClcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIG1hcDogKGYpLT5cbiAgICAgIGZvciBuLHYgb2YgQF9tYXBcbiAgICAgICAgZihuLHYpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEBzZWUgSnNvbk9wZXJhdGlvbnMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGFyZ3VtZW50cy5sZW5ndGggPiAxXG4gICAgICAgIGlmIGNvbnRlbnQ/IGFuZCBjb250ZW50Ll9nZXRNb2RlbD9cbiAgICAgICAgICByZXAgPSBjb250ZW50Ll9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHJlcCA9IGNvbnRlbnRcbiAgICAgICAgQHJldHJpZXZlU3ViKG5hbWUpLnJlcGxhY2UgcmVwXG4gICAgICAgIEBnZXRDdXN0b21UeXBlKClcbiAgICAgIGVsc2UgaWYgbmFtZT9cbiAgICAgICAgcHJvcCA9IEBfbWFwW25hbWVdXG4gICAgICAgIGlmIHByb3A/IGFuZCBub3QgcHJvcC5pc0NvbnRlbnREZWxldGVkKClcbiAgICAgICAgICByZXMgPSBwcm9wLnZhbCgpXG4gICAgICAgICAgaWYgcmVzIGluc3RhbmNlb2Ygb3BzLk9wZXJhdGlvblxuICAgICAgICAgICAgcmVzLmdldEN1c3RvbVR5cGUoKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJlc1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQF9tYXBcbiAgICAgICAgICBpZiBub3Qgby5pc0NvbnRlbnREZWxldGVkKClcbiAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG8udmFsKClcbiAgICAgICAgcmVzdWx0XG5cbiAgICBkZWxldGU6IChuYW1lKS0+XG4gICAgICBAX21hcFtuYW1lXT8uZGVsZXRlQ29udGVudCgpXG4gICAgICBAXG5cbiAgICByZXRyaWV2ZVN1YjogKHByb3BlcnR5X25hbWUpLT5cbiAgICAgIGlmIG5vdCBAX21hcFtwcm9wZXJ0eV9uYW1lXT9cbiAgICAgICAgZXZlbnRfcHJvcGVydGllcyA9XG4gICAgICAgICAgbmFtZTogcHJvcGVydHlfbmFtZVxuICAgICAgICBldmVudF90aGlzID0gQFxuICAgICAgICBybV91aWQgPVxuICAgICAgICAgIG5vT3BlcmF0aW9uOiB0cnVlXG4gICAgICAgICAgc3ViOiBwcm9wZXJ0eV9uYW1lXG4gICAgICAgICAgYWx0OiBAXG4gICAgICAgIHJtID0gbmV3IG9wcy5SZXBsYWNlTWFuYWdlciBudWxsLCBldmVudF9wcm9wZXJ0aWVzLCBldmVudF90aGlzLCBybV91aWQgIyB0aGlzIG9wZXJhdGlvbiBzaGFsbCBub3QgYmUgc2F2ZWQgaW4gdGhlIEhCXG4gICAgICAgIEBfbWFwW3Byb3BlcnR5X25hbWVdID0gcm1cbiAgICAgICAgcm0uc2V0UGFyZW50IEAsIHByb3BlcnR5X25hbWVcbiAgICAgICAgcm0uZXhlY3V0ZSgpXG4gICAgICBAX21hcFtwcm9wZXJ0eV9uYW1lXVxuXG4gIG9wcy5NYXBNYW5hZ2VyLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2N1c3RvbV90eXBlJyA6IGN1c3RvbV90eXBlXG4gICAgICAnY29udGVudCcgOiBjb250ZW50XG4gICAgICAnY29udGVudF9vcGVyYXRpb25zJyA6IGNvbnRlbnRfb3BlcmF0aW9uc1xuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIHVpZCwgY29udGVudCwgY29udGVudF9vcGVyYXRpb25zKVxuXG5cblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBvcHMuTGlzdE1hbmFnZXIgZXh0ZW5kcyBvcHMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnMpLT5cbiAgICAgIEBiZWdpbm5pbmcgPSBuZXcgb3BzLkRlbGltaXRlciB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgQGVuZCA9ICAgICAgIG5ldyBvcHMuRGVsaW1pdGVyIEBiZWdpbm5pbmcsIHVuZGVmaW5lZFxuICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgQGJlZ2lubmluZy5leGVjdXRlKClcbiAgICAgIEBlbmQuZXhlY3V0ZSgpXG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkLCBjb250ZW50LCBjb250ZW50X29wZXJhdGlvbnNcblxuICAgIHR5cGU6IFwiTGlzdE1hbmFnZXJcIlxuXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmdcbiAgICAgIHdoaWxlIG8/XG4gICAgICAgIG8uYXBwbHlEZWxldGUoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cblxuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGZvciBpLCBvIGluIHZhbFxuICAgICAgICBpZiBvIGluc3RhbmNlb2Ygb3BzLk9iamVjdFxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiBvIGluc3RhbmNlb2Ygb3BzLkxpc3RNYW5hZ2VyXG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIHRyYW5zZm9ybV90b192YWx1ZSBhbmQgbyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAYmVnaW5uaW5nLnNldFBhcmVudCBAXG4gICAgICAgIEBlbmQuc2V0UGFyZW50IEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAgICMgR2V0IHRoZSBlbGVtZW50IHByZXZpb3VzIHRvIHRoZSBkZWxlbWl0ZXIgYXQgdGhlIGVuZFxuICAgIGdldExhc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBlbmQucHJldl9jbFxuXG4gICAgIyBzaW1pbGFyIHRvIHRoZSBhYm92ZVxuICAgIGdldEZpcnN0T3BlcmF0aW9uOiAoKS0+XG4gICAgICBAYmVnaW5uaW5nLm5leHRfY2xcblxuICAgICMgVHJhbnNmb3JtcyB0aGUgdGhlIGxpc3QgdG8gYW4gYXJyYXlcbiAgICAjIERvZXNuJ3QgcmV0dXJuIGxlZnQtcmlnaHQgZGVsaW1pdGVyLlxuICAgIHRvQXJyYXk6ICgpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggby52YWwoKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIG1hcDogKGYpLT5cbiAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgIHJlc3VsdCA9IFtdXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgcmVzdWx0LnB1c2ggZihvKVxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICByZXN1bHRcblxuICAgIGZvbGQ6IChpbml0LCBmKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBpZiBub3Qgby5pc19kZWxldGVkXG4gICAgICAgICAgaW5pdCA9IGYoaW5pdCwgbylcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgaW5pdFxuXG4gICAgdmFsOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgQHRvQXJyYXkoKVxuXG4gICAgcmVmOiAocG9zKS0+XG4gICAgICBpZiBwb3M/XG4gICAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3MrMSlcbiAgICAgICAgaWYgbm90IChvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlcilcbiAgICAgICAgICBvXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBudWxsXG4gICAgICAgICAgIyB0aHJvdyBuZXcgRXJyb3IgXCJ0aGlzIHBvc2l0aW9uIGRvZXMgbm90IGV4aXN0XCJcbiAgICAgIGVsc2VcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwieW91IG11c3Qgc3BlY2lmeSBhIHBvc2l0aW9uIHBhcmFtZXRlclwiXG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIgYW5kIG8ucHJldl9jbD9cbiAgICAgICAgICAjIHRoZSB1c2VyIG9yIHlvdSBnYXZlIGEgcG9zaXRpb24gcGFyYW1ldGVyIHRoYXQgaXMgdG8gYmlnXG4gICAgICAgICAgIyBmb3IgdGhlIGN1cnJlbnQgYXJyYXkuIFRoZXJlZm9yZSB3ZSByZWFjaCBhIERlbGltaXRlci5cbiAgICAgICAgICAjIFRoZW4sIHdlJ2xsIGp1c3QgcmV0dXJuIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKSBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGlmIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgb1xuXG4gICAgcHVzaDogKGNvbnRlbnQpLT5cbiAgICAgIEBpbnNlcnRBZnRlciBAZW5kLnByZXZfY2wsIFtjb250ZW50XVxuXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50cyktPlxuICAgICAgcmlnaHQgPSBsZWZ0Lm5leHRfY2xcbiAgICAgIHdoaWxlIHJpZ2h0LmlzRGVsZXRlZCgpXG4gICAgICAgIHJpZ2h0ID0gcmlnaHQubmV4dF9jbCAjIGZpbmQgdGhlIGZpcnN0IGNoYXJhY3RlciB0byB0aGUgcmlnaHQsIHRoYXQgaXMgbm90IGRlbGV0ZWQuIEluIHRoZSBjYXNlIHRoYXQgcG9zaXRpb24gaXMgMCwgaXRzIHRoZSBEZWxpbWl0ZXIuXG4gICAgICBsZWZ0ID0gcmlnaHQucHJldl9jbFxuXG4gICAgICAjIFRPRE86IGFsd2F5cyBleHBlY3QgYW4gYXJyYXkgYXMgY29udGVudC4gVGhlbiB5b3UgY2FuIGNvbWJpbmUgdGhpcyB3aXRoIHRoZSBvdGhlciBvcHRpb24gKGVsc2UpXG4gICAgICBpZiBjb250ZW50cyBpbnN0YW5jZW9mIG9wcy5PcGVyYXRpb25cbiAgICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIG51bGwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBsZWZ0LCByaWdodCkuZXhlY3V0ZSgpXG4gICAgICBlbHNlXG4gICAgICAgIGZvciBjIGluIGNvbnRlbnRzXG4gICAgICAgICAgaWYgYz8gYW5kIGMuX25hbWU/IGFuZCBjLl9nZXRNb2RlbD9cbiAgICAgICAgICAgIGMgPSBjLl9nZXRNb2RlbChAY3VzdG9tX3R5cGVzLCBAb3BlcmF0aW9ucylcbiAgICAgICAgICB0bXAgPSAobmV3IG9wcy5JbnNlcnQgbnVsbCwgYywgbnVsbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGxlZnQsIHJpZ2h0KS5leGVjdXRlKClcbiAgICAgICAgICBsZWZ0ID0gdG1wXG4gICAgICBAXG5cbiAgICAjXG4gICAgIyBJbnNlcnRzIGFuIGFycmF5IG9mIGNvbnRlbnQgaW50byB0aGlzIGxpc3QuXG4gICAgIyBATm90ZTogVGhpcyBleHBlY3RzIGFuIGFycmF5IGFzIGNvbnRlbnQhXG4gICAgI1xuICAgICMgQHJldHVybiB7TGlzdE1hbmFnZXIgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0LlxuICAgICNcbiAgICBpbnNlcnQ6IChwb3NpdGlvbiwgY29udGVudHMpLT5cbiAgICAgIGl0aCA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICAjIHRoZSAoaS0xKXRoIGNoYXJhY3Rlci4gZS5nLiBcImFiY1wiIHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgICAjIHRoZSAwdGggY2hhcmFjdGVyIGlzIHRoZSBsZWZ0IERlbGltaXRlclxuICAgICAgQGluc2VydEFmdGVyIGl0aCwgY29udGVudHNcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICAjIEByZXR1cm4ge0xpc3RNYW5hZ2VyIFR5cGV9IFRoaXMgU3RyaW5nIG9iamVjdFxuICAgICNcbiAgICBkZWxldGU6IChwb3NpdGlvbiwgbGVuZ3RoID0gMSktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvc2l0aW9uKzEpICMgcG9zaXRpb24gMCBpbiB0aGlzIGNhc2UgaXMgdGhlIGRlbGV0aW9uIG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXJcblxuICAgICAgZGVsZXRlX29wcyA9IFtdXG4gICAgICBmb3IgaSBpbiBbMC4uLmxlbmd0aF1cbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gKG5ldyBvcHMuRGVsZXRlIG51bGwsIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgKG5vdCAobyBpbnN0YW5jZW9mIG9wcy5EZWxpbWl0ZXIpKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBAXG5cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50czogKG9wKS0+XG4gICAgICBnZXRDb250ZW50VHlwZSA9IChjb250ZW50KS0+XG4gICAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiBvcHMuT3BlcmF0aW9uXG4gICAgICAgICAgY29udGVudC5nZXRDdXN0b21UeXBlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNvbnRlbnRcbiAgICAgIEBjYWxsRXZlbnQgW1xuICAgICAgICB0eXBlOiBcImluc2VydFwiXG4gICAgICAgIHJlZmVyZW5jZTogb3BcbiAgICAgICAgcG9zaXRpb246IG9wLmdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAZ2V0Q3VzdG9tVHlwZSgpXG4gICAgICAgIGNoYW5nZWRCeTogb3AudWlkLmNyZWF0b3JcbiAgICAgICAgdmFsdWU6IGdldENvbnRlbnRUeXBlIG9wLnZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICBAY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICByZWZlcmVuY2U6IG9wXG4gICAgICAgIHBvc2l0aW9uOiBvcC5nZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQGdldEN1c3RvbVR5cGUoKSAjIFRPRE86IFlvdSBjYW4gY29tYmluZSBnZXRQb3NpdGlvbiArIGdldFBhcmVudCBpbiBhIG1vcmUgZWZmaWNpZW50IG1hbm5lciEgKG9ubHkgbGVmdCBEZWxpbWl0ZXIgd2lsbCBob2xkIEBwYXJlbnQpXG4gICAgICAgIGxlbmd0aDogMVxuICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICBvbGRWYWx1ZTogb3AudmFsKClcbiAgICAgIF1cblxuICBvcHMuTGlzdE1hbmFnZXIucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ2NvbnRlbnRfb3BlcmF0aW9ucycgOiBjb250ZW50X29wZXJhdGlvbnNcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGN1c3RvbV90eXBlLCB1aWQsIGNvbnRlbnQsIGNvbnRlbnRfb3BlcmF0aW9ucylcblxuICBjbGFzcyBvcHMuQ29tcG9zaXRpb24gZXh0ZW5kcyBvcHMuTGlzdE1hbmFnZXJcblxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBfY29tcG9zaXRpb25fdmFsdWUsIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMsIHVpZCwgdG1wX2NvbXBvc2l0aW9uX3JlZiktPlxuICAgICAgIyB3ZSBjYW4ndCB1c2UgQHNldmVPcGVyYXRpb24gJ2NvbXBvc2l0aW9uX3JlZicsIHRtcF9jb21wb3NpdGlvbl9yZWYgaGVyZSxcbiAgICAgICMgYmVjYXVzZSB0aGVuIHRoZXJlIGlzIGEgXCJsb29wXCIgKGluc2VydGlvbiByZWZlcnMgdG8gcGFyZW50LCByZWZlcnMgdG8gaW5zZXJ0aW9uLi4pXG4gICAgICAjIFRoaXMgaXMgd2h5IHdlIGhhdmUgdG8gY2hlY2sgaW4gQGNhbGxPcGVyYXRpb25TcGVjaWZpY0luc2VydEV2ZW50cyB1bnRpbCB3ZSBmaW5kIGl0XG4gICAgICBzdXBlciBjdXN0b21fdHlwZSwgdWlkXG4gICAgICBpZiB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBAdG1wX2NvbXBvc2l0aW9uX3JlZiA9IHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IEBlbmQucHJldl9jbFxuICAgICAgaWYgY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucz9cbiAgICAgICAgQGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnNcbiAgICAgICAgICBAc2F2ZU9wZXJhdGlvbiBuLCBvLCAnX2NvbXBvc2l0aW9uX3ZhbHVlJ1xuXG4gICAgdHlwZTogXCJDb21wb3NpdGlvblwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQHNlZSBPcGVyYXRpb24uZXhlY3V0ZVxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl9zZXRDb21wb3NpdGlvblZhbHVlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgZGVsZXRlIEBfY29tcG9zaXRpb25fdmFsdWVcbiAgICAgICAgIyBjaGVjayBpZiB0bXBfY29tcG9zaXRpb25fcmVmIGFscmVhZHkgZXhpc3RzXG4gICAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmXG4gICAgICAgICAgY29tcG9zaXRpb25fcmVmID0gQEhCLmdldE9wZXJhdGlvbiBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIGlmIGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgICAgQGNvbXBvc2l0aW9uX3JlZiA9IGNvbXBvc2l0aW9uX3JlZlxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgVGhpcyBpcyBjYWxsZWQsIHdoZW4gdGhlIEluc2VydC1vcGVyYXRpb24gd2FzIHN1Y2Nlc3NmdWxseSBleGVjdXRlZC5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIEB0bXBfY29tcG9zaXRpb25fcmVmP1xuICAgICAgICBpZiBvcC51aWQuY3JlYXRvciBpcyBAdG1wX2NvbXBvc2l0aW9uX3JlZi5jcmVhdG9yIGFuZCBvcC51aWQub3BfbnVtYmVyIGlzIEB0bXBfY29tcG9zaXRpb25fcmVmLm9wX251bWJlclxuICAgICAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBvcFxuICAgICAgICAgIGRlbGV0ZSBAdG1wX2NvbXBvc2l0aW9uX3JlZlxuICAgICAgICAgIG9wID0gb3AubmV4dF9jbFxuICAgICAgICAgIGlmIG9wIGlzIEBlbmRcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmV0dXJuXG5cbiAgICAgIG8gPSBAZW5kLnByZXZfY2xcbiAgICAgIHdoaWxlIG8gaXNudCBvcFxuICAgICAgICBAZ2V0Q3VzdG9tVHlwZSgpLl91bmFwcGx5IG8udW5kb19kZWx0YVxuICAgICAgICBvID0gby5wcmV2X2NsXG4gICAgICB3aGlsZSBvIGlzbnQgQGVuZFxuICAgICAgICBvLnVuZG9fZGVsdGEgPSBAZ2V0Q3VzdG9tVHlwZSgpLl9hcHBseSBvLnZhbCgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIEBjb21wb3NpdGlvbl9yZWYgPSBAZW5kLnByZXZfY2xcblxuICAgICAgQGNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwidXBkYXRlXCJcbiAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBuZXdWYWx1ZTogQHZhbCgpXG4gICAgICBdXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvcCwgZGVsX29wKS0+XG4gICAgICByZXR1cm5cblxuICAgICNcbiAgICAjIENyZWF0ZSBhIG5ldyBEZWx0YVxuICAgICMgLSBpbnNlcnRzIG5ldyBDb250ZW50IGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fdmFsdWVcbiAgICAjIC0gdXBkYXRlcyB0aGUgY29tcG9zaXRpb25fcmVmXG4gICAgI1xuICAgICMgQHBhcmFtIGRlbHRhIFRoZSBkZWx0YSB0aGF0IGlzIGFwcGxpZWQgdG8gdGhlIGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgI1xuICAgIGFwcGx5RGVsdGE6IChkZWx0YSwgb3BlcmF0aW9ucyktPlxuICAgICAgKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGRlbHRhLCBvcGVyYXRpb25zLCBALCBudWxsLCBAZW5kLnByZXZfY2wsIEBlbmQpLmV4ZWN1dGUoKVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoanNvbiA9IHt9KS0+XG4gICAgICBjdXN0b20gPSBAZ2V0Q3VzdG9tVHlwZSgpLl9nZXRDb21wb3NpdGlvblZhbHVlKClcbiAgICAgIGpzb24uY29tcG9zaXRpb25fdmFsdWUgPSBjdXN0b20uY29tcG9zaXRpb25fdmFsdWVcbiAgICAgIGlmIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zP1xuICAgICAgICBqc29uLmNvbXBvc2l0aW9uX3ZhbHVlX29wZXJhdGlvbnMgPSB7fVxuICAgICAgICBmb3IgbixvIG9mIGN1c3RvbS5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAgICAganNvbi5jb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zW25dID0gby5nZXRVaWQoKVxuICAgICAgaWYgQGNvbXBvc2l0aW9uX3JlZj9cbiAgICAgICAganNvbi5jb21wb3NpdGlvbl9yZWYgPSBAY29tcG9zaXRpb25fcmVmLmdldFVpZCgpXG4gICAgICBlbHNlXG4gICAgICAgIGpzb24uY29tcG9zaXRpb25fcmVmID0gQHRtcF9jb21wb3NpdGlvbl9yZWZcbiAgICAgIHN1cGVyIGpzb25cblxuICBvcHMuQ29tcG9zaXRpb24ucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnY3VzdG9tX3R5cGUnOiBjdXN0b21fdHlwZVxuICAgICAgJ2NvbXBvc2l0aW9uX3ZhbHVlJyA6IGNvbXBvc2l0aW9uX3ZhbHVlXG4gICAgICAnY29tcG9zaXRpb25fdmFsdWVfb3BlcmF0aW9ucycgOiBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zXG4gICAgICAnY29tcG9zaXRpb25fcmVmJyA6IGNvbXBvc2l0aW9uX3JlZlxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXMoY3VzdG9tX3R5cGUsIGNvbXBvc2l0aW9uX3ZhbHVlLCBjb21wb3NpdGlvbl92YWx1ZV9vcGVyYXRpb25zLCB1aWQsIGNvbXBvc2l0aW9uX3JlZilcblxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBZGRzIHN1cHBvcnQgZm9yIHJlcGxhY2UuIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlIG9wZXJhdGlvbnMuXG4gICMgRWFjaCBSZXBsYWNlYWJsZSBob2xkcyBhIHZhbHVlIHRoYXQgaXMgbm93IHJlcGxhY2VhYmxlLlxuICAjXG4gICMgVGhlIFRleHRUeXBlLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFRleHRUeXBlXG4gICNcbiAgY2xhc3Mgb3BzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgb3BzLkxpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3Byb3BlcnRpZXMgRGVjb3JhdGVzIHRoZSBldmVudCB0aGF0IGlzIHRocm93biBieSB0aGUgUk1cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBldmVudF90aGlzIFRoZSBvYmplY3Qgb24gd2hpY2ggdGhlIGV2ZW50IHNoYWxsIGJlIGV4ZWN1dGVkXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gaW5pdGlhbF9jb250ZW50IEluaXRpYWxpemUgdGhpcyB3aXRoIGEgUmVwbGFjZWFibGUgdGhhdCBob2xkcyB0aGUgaW5pdGlhbF9jb250ZW50LlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAoY3VzdG9tX3R5cGUsIEBldmVudF9wcm9wZXJ0aWVzLCBAZXZlbnRfdGhpcywgdWlkKS0+XG4gICAgICBpZiBub3QgQGV2ZW50X3Byb3BlcnRpZXNbJ29iamVjdCddP1xuICAgICAgICBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10gPSBAZXZlbnRfdGhpcy5nZXRDdXN0b21UeXBlKClcbiAgICAgIHN1cGVyIGN1c3RvbV90eXBlLCB1aWRcblxuICAgIHR5cGU6IFwiUmVwbGFjZU1hbmFnZXJcIlxuXG4gICAgI1xuICAgICMgVGhpcyBkb2Vzbid0IHRocm93IHRoZSBzYW1lIGV2ZW50cyBhcyB0aGUgTGlzdE1hbmFnZXIuIFRoZXJlZm9yZSwgdGhlXG4gICAgIyBSZXBsYWNlYWJsZXMgYWxzbyBub3QgdGhyb3cgdGhlIHNhbWUgZXZlbnRzLlxuICAgICMgU28sIFJlcGxhY2VNYW5hZ2VyIGFuZCBMaXN0TWFuYWdlciBib3RoIGltcGxlbWVudFxuICAgICMgdGhlc2UgZnVuY3Rpb25zIHRoYXQgYXJlIGNhbGxlZCB3aGVuIGFuIEluc2VydGlvbiBpcyBleGVjdXRlZCAoYXQgdGhlIGVuZCkuXG4gICAgI1xuICAgICNcbiAgICBjYWxsRXZlbnREZWNvcmF0b3I6IChldmVudHMpLT5cbiAgICAgIGlmIG5vdCBAaXNEZWxldGVkKClcbiAgICAgICAgZm9yIGV2ZW50IGluIGV2ZW50c1xuICAgICAgICAgIGZvciBuYW1lLHByb3Agb2YgQGV2ZW50X3Byb3BlcnRpZXNcbiAgICAgICAgICAgIGV2ZW50W25hbWVdID0gcHJvcFxuICAgICAgICBAZXZlbnRfdGhpcy5jYWxsRXZlbnQgZXZlbnRzXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtb3BzIGZvciBMaXN0TWFuYWdlci5cbiAgICAjXG4gICAgY2FsbE9wZXJhdGlvblNwZWNpZmljSW5zZXJ0RXZlbnRzOiAob3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiIGFuZCBvcC5wcmV2X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICMgdGhpcyByZXBsYWNlcyBhbm90aGVyIFJlcGxhY2VhYmxlXG4gICAgICAgIGlmIG5vdCBvcC5pc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBvcC5wcmV2X2NsLnZhbCgpXG4gICAgICAgICAgQGNhbGxFdmVudERlY29yYXRvciBbXG4gICAgICAgICAgICB0eXBlOiBcInVwZGF0ZVwiXG4gICAgICAgICAgICBjaGFuZ2VkQnk6IG9wLnVpZC5jcmVhdG9yXG4gICAgICAgICAgICBvbGRWYWx1ZTogb2xkX3ZhbHVlXG4gICAgICAgICAgXVxuICAgICAgICBvcC5wcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgb3AubmV4dF9jbC50eXBlIGlzbnQgXCJEZWxpbWl0ZXJcIlxuICAgICAgICAjIFRoaXMgd29uJ3QgYmUgcmVjb2duaXplZCBieSB0aGUgdXNlciwgYmVjYXVzZSBhbm90aGVyXG4gICAgICAgICMgY29uY3VycmVudCBvcGVyYXRpb24gaXMgc2V0IGFzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBSTVxuICAgICAgICBvcC5hcHBseURlbGV0ZSgpXG4gICAgICBlbHNlICMgcHJldiBfYW5kXyBuZXh0IGFyZSBEZWxpbWl0ZXJzLiBUaGlzIGlzIHRoZSBmaXJzdCBjcmVhdGVkIFJlcGxhY2VhYmxlIGluIHRoZSBSTVxuICAgICAgICBAY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBvcC51aWQuY3JlYXRvclxuICAgICAgICBdXG4gICAgICB1bmRlZmluZWRcblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG9wLCBkZWxfb3ApLT5cbiAgICAgIGlmIG9wLm5leHRfY2wudHlwZSBpcyBcIkRlbGltaXRlclwiXG4gICAgICAgIEBjYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IGRlbF9vcC51aWQuY3JlYXRvclxuICAgICAgICAgIG9sZFZhbHVlOiBvcC52YWwoKVxuICAgICAgICBdXG5cblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGV4aXN0aW5nIHdvcmQgd2l0aCBhIG5ldyB3b3JkLlxuICAgICNcbiAgICAjIEBwYXJhbSBjb250ZW50IHtPcGVyYXRpb259IFRoZSBuZXcgdmFsdWUgb2YgdGhpcyBSZXBsYWNlTWFuYWdlci5cbiAgICAjIEBwYXJhbSByZXBsYWNlYWJsZV91aWQge1VJRH0gT3B0aW9uYWw6IFVuaXF1ZSBpZCBvZiB0aGUgUmVwbGFjZWFibGUgdGhhdCBpcyBjcmVhdGVkXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50LCByZXBsYWNlYWJsZV91aWQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICByZWxwID0gKG5ldyBvcHMuSW5zZXJ0IG51bGwsIGNvbnRlbnQsIG51bGwsIEAsIHJlcGxhY2VhYmxlX3VpZCwgbywgby5uZXh0X2NsKS5leGVjdXRlKClcbiAgICAgICMgVE9ETzogZGVsZXRlIHJlcGwgKGZvciBkZWJ1Z2dpbmcpXG4gICAgICB1bmRlZmluZWRcblxuICAgIGlzQ29udGVudERlbGV0ZWQ6ICgpLT5cbiAgICAgIEBnZXRMYXN0T3BlcmF0aW9uKCkuaXNEZWxldGVkKClcblxuICAgIGRlbGV0ZUNvbnRlbnQ6ICgpLT5cbiAgICAgIGxhc3Rfb3AgPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBpZiAobm90IGxhc3Rfb3AuaXNEZWxldGVkKCkpIGFuZCBsYXN0X29wLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgIChuZXcgb3BzLkRlbGV0ZSBudWxsLCB1bmRlZmluZWQsIEBnZXRMYXN0T3BlcmF0aW9uKCkudWlkKS5leGVjdXRlKClcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgI1xuICAgICMgR2V0IHRoZSB2YWx1ZSBvZiB0aGlzXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgICNpZiBvIGluc3RhbmNlb2Ygb3BzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cblxuXG4gIGJhc2ljX29wc1xuIiwiXG5zdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vT3BlcmF0aW9ucy9TdHJ1Y3R1cmVkXCJcblxuSGlzdG9yeUJ1ZmZlciA9IHJlcXVpcmUgXCIuL0hpc3RvcnlCdWZmZXJcIlxuRW5naW5lID0gcmVxdWlyZSBcIi4vRW5naW5lXCJcbmFkYXB0Q29ubmVjdG9yID0gcmVxdWlyZSBcIi4vQ29ubmVjdG9yQWRhcHRlclwiXG5cbmNyZWF0ZVkgPSAoY29ubmVjdG9yKS0+XG4gIGlmIGNvbm5lY3Rvci51c2VyX2lkP1xuICAgIHVzZXJfaWQgPSBjb25uZWN0b3IudXNlcl9pZCAjIFRPRE86IGNoYW5nZSB0byBnZXRVbmlxdWVJZCgpXG4gIGVsc2VcbiAgICB1c2VyX2lkID0gXCJfdGVtcFwiXG4gICAgY29ubmVjdG9yLndoZW5fcmVjZWl2ZWRfc3RhdGVfdmVjdG9yX2xpc3RlbmVycyA9IFsoc3RhdGVfdmVjdG9yKS0+XG4gICAgICAgIEhCLnNldFVzZXJJZCB0aGlzLnVzZXJfaWQsIHN0YXRlX3ZlY3RvclxuICAgICAgXVxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgb3BzX21hbmFnZXIgPSBzdHJ1Y3R1cmVkX29wc191bmluaXRpYWxpemVkIEhCLCB0aGlzLmNvbnN0cnVjdG9yXG4gIG9wcyA9IG9wc19tYW5hZ2VyLm9wZXJhdGlvbnNcblxuICBlbmdpbmUgPSBuZXcgRW5naW5lIEhCLCBvcHNcbiAgYWRhcHRDb25uZWN0b3IgY29ubmVjdG9yLCBlbmdpbmUsIEhCLCBvcHNfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcblxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5IQiA9IEhCXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLm9wZXJhdGlvbnMgPSBvcHNcbiAgb3BzLk9wZXJhdGlvbi5wcm90b3R5cGUuZW5naW5lID0gZW5naW5lXG4gIG9wcy5PcGVyYXRpb24ucHJvdG90eXBlLmNvbm5lY3RvciA9IGNvbm5lY3RvclxuICBvcHMuT3BlcmF0aW9uLnByb3RvdHlwZS5jdXN0b21fdHlwZXMgPSB0aGlzLmNvbnN0cnVjdG9yXG5cbiAgY3QgPSBuZXcgY3JlYXRlWS5PYmplY3QoKVxuICBtb2RlbCA9IG5ldyBvcHMuTWFwTWFuYWdlcihjdCwgSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxuICBjdC5fc2V0TW9kZWwgbW9kZWxcbiAgY3RcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVZXG5pZiB3aW5kb3c/XG4gIHdpbmRvdy5ZID0gY3JlYXRlWVxuXG5jcmVhdGVZLk9iamVjdCA9IHJlcXVpcmUgXCIuL09iamVjdFR5cGVcIlxuIl19
