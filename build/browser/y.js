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
    if ((o.uid.creator === HB.getUserId()) && (typeof o.uid.op_number !== "string") && (o.uid.doSync === "true" || o.uid.doSync === true) && (HB.getUserId() !== "_temp")) {
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
    req("syncMode", ["syncAll", "master-slave"]);
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
      this.syncMode = "syncAll";
    }
    this.is_synced = false;
    this.connections = {};
    this.receive_handlers = [];
    this.is_bound_to_y = false;
    this.connections = {};
    this.current_sync_target = null;
    return this.sent_hb_to_all_users = false;
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
    if (this.syncMode === "syncAll") {
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
    if ((!this.is_synced) || this.syncMode === "syncAll") {
      if (this.syncMode === "syncAll") {
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
        if ((this.syncMode === "syncAll" || (res.sent_again != null)) && (!this.is_synced) && (this.current_sync_target === sender)) {
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
      op_number: "_" + (this.reserved_identifier_counter++),
      doSync: false
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
      for (o_number in user) {
        o = user[o_number];
        if ((o.uid.noOperation == null) && o.uid.doSync && unknown(u_name, o_number)) {
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
      'op_number': this.operation_counter[user_id],
      'doSync': true
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
    if (this.operation_counter[o.uid.creator] == null) {
      this.operation_counter[o.uid.creator] = 0;
    }
    if (typeof o.uid.op_number === 'number' && o.uid.creator !== this.getUserId()) {
      if (o.uid.op_number === this.operation_counter[o.uid.creator]) {
        return this.operation_counter[o.uid.creator]++;
      } else {
        return this.invokeSync(o.uid.creator);
      }
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
          map_uid.doSync = false;
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

    Operation.prototype.dontSync = function() {
      return this.uid.doSync = false;
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
      if ((op != null ? op.execute : void 0) != null) {
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
          while (o.isDeleted() || !(o instanceof types.Delimiter)) {
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
        'origin': this.origin.getUid(),
        'uid': this.getUid(),
        'is_deleted': this.is_deleted
      };
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
        json['content'] = this.content;
      }
      return json;
    };

    return TextInsert;

  })(types.Insert);
  types.TextInsert.parse = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], parent = json['parent'];
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
          var append;
          append = "";
          if (content[content.length - 1] === " ") {
            content = content.slice(0, content.length - 1);
            append = '&nbsp;';
          }
          textfield.textContent = content;
          return textfield.innerHTML += append;
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
        if (event.key != null) {
          if (event.charCode === 32) {
            char = " ";
          } else if (event.keyCode === 13) {
            char = '\n';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvQ29ubmVjdG9yQWRhcHRlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9Db25uZWN0b3JDbGFzcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9FbmdpbmUuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvSGlzdG9yeUJ1ZmZlci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9UeXBlcy9CYXNpY1R5cGVzLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL1R5cGVzL0pzb25UeXBlcy5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UveWpzL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvY29kaW8vd29ya3NwYWNlL3lqcy9saWIvVHlwZXMvVGV4dFR5cGVzLmNvZmZlZSIsIi9ob21lL2NvZGlvL3dvcmtzcGFjZS95anMvbGliL3kuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSw4QkFBQTs7QUFBQSxjQUFBLEdBQWlCLE9BQUEsQ0FBUSxrQkFBUixDQUFqQixDQUFBOztBQUFBLGNBTUEsR0FBaUIsU0FBQyxTQUFELEVBQVksTUFBWixFQUFvQixFQUFwQixFQUF3QixrQkFBeEIsR0FBQTtBQUVmLE1BQUEsdUZBQUE7QUFBQSxPQUFBLHNCQUFBOzZCQUFBO0FBQ0UsSUFBQSxTQUFVLENBQUEsSUFBQSxDQUFWLEdBQWtCLENBQWxCLENBREY7QUFBQSxHQUFBO0FBQUEsRUFHQSxTQUFTLENBQUMsYUFBVixDQUFB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QyxDQUFBLE1BQUQsR0FBYyxJQUFBLE1BQUEsQ0FBTyxJQUFDLENBQUEsRUFBUixFQUFZLFlBQVksQ0FBQyxLQUF6QixDQUhkLENBQUE7QUFBQSxNQUlBLGNBQUEsQ0FBZSxJQUFDLENBQUEsU0FBaEIsRUFBMkIsSUFBQyxDQUFBLE1BQTVCLEVBQW9DLElBQUMsQ0FBQSxFQUFyQyxFQUF5QyxZQUFZLENBQUMsa0JBQXRELENBSkEsQ0FBQTtBQUFBLE1BS0Esb0NBQUEsU0FBQSxDQUxBLENBRFc7SUFBQSxDQUFiOztBQUFBLGdCQVFBLFlBQUEsR0FBYyxTQUFBLEdBQUE7YUFDWixJQUFDLENBQUEsVUFEVztJQUFBLENBUmQsQ0FBQTs7YUFBQTs7S0FOYyxLQUFLLENBQUMsT0FuQnRCLENBQUE7QUFvQ0EsU0FBVyxJQUFBLENBQUEsQ0FBRSxFQUFFLENBQUMsMkJBQUgsQ0FBQSxDQUFGLENBQW1DLENBQUMsT0FBcEMsQ0FBQSxDQUFYLENBckNRO0FBQUEsQ0FMVixDQUFBOztBQUFBLE1BNENNLENBQUMsT0FBUCxHQUFpQixPQTVDakIsQ0FBQTs7QUE2Q0EsSUFBRyxrREFBQSxJQUFnQixrQkFBbkI7QUFDRSxFQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsT0FBWCxDQURGO0NBN0NBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuQ29ubmVjdG9yQ2xhc3MgPSByZXF1aXJlIFwiLi9Db25uZWN0b3JDbGFzc1wiXG4jXG4jIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4jIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiNcbmFkYXB0Q29ubmVjdG9yID0gKGNvbm5lY3RvciwgZW5naW5lLCBIQiwgZXhlY3V0aW9uX2xpc3RlbmVyKS0+XG5cbiAgZm9yIG5hbWUsIGYgb2YgQ29ubmVjdG9yQ2xhc3NcbiAgICBjb25uZWN0b3JbbmFtZV0gPSBmXG5cbiAgY29ubmVjdG9yLnNldElzQm91bmRUb1koKVxuXG4gIHNlbmRfID0gKG8pLT5cbiAgICBpZiAoby51aWQuY3JlYXRvciBpcyBIQi5nZXRVc2VySWQoKSkgYW5kXG4gICAgICAgICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIikgYW5kICMgVE9ETzogaSBkb24ndCB0aGluayB0aGF0IHdlIG5lZWQgdGhpcyBhbnltb3JlLi5cbiAgICAgICAgKG8udWlkLmRvU3luYyBpcyBcInRydWVcIiBvciBvLnVpZC5kb1N5bmMgaXMgdHJ1ZSkgYW5kICMgVE9ETzogZW5zdXJlLCB0aGF0IG9ubHkgdHJ1ZSBpcyB2YWxpZFxuICAgICAgICAoSEIuZ2V0VXNlcklkKCkgaXNudCBcIl90ZW1wXCIpXG4gICAgICBjb25uZWN0b3IuYnJvYWRjYXN0IG9cblxuICBpZiBjb25uZWN0b3IuaW52b2tlU3luYz9cbiAgICBIQi5zZXRJbnZva2VTeW5jSGFuZGxlciBjb25uZWN0b3IuaW52b2tlU3luY1xuXG4gIGV4ZWN1dGlvbl9saXN0ZW5lci5wdXNoIHNlbmRfXG4gICMgRm9yIHRoZSBYTVBQQ29ubmVjdG9yOiBsZXRzIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgIyB0aGVyZWZvcmUsIHdlIGhhdmUgdG8gcmVzdHJ1Y3R1cmUgaXQgbGF0ZXJcbiAgZW5jb2RlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgZm9yIG5hbWUsdmFsdWUgb2YgdlxuICAgICAgdXNlcjogbmFtZVxuICAgICAgc3RhdGU6IHZhbHVlXG4gIHBhcnNlX3N0YXRlX3ZlY3RvciA9ICh2KS0+XG4gICAgc3RhdGVfdmVjdG9yID0ge31cbiAgICBmb3IgcyBpbiB2XG4gICAgICBzdGF0ZV92ZWN0b3Jbcy51c2VyXSA9IHMuc3RhdGVcbiAgICBzdGF0ZV92ZWN0b3JcblxuICBnZXRTdGF0ZVZlY3RvciA9ICgpLT5cbiAgICBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuXG4gIGdldEhCID0gKHYpLT5cbiAgICBzdGF0ZV92ZWN0b3IgPSBwYXJzZV9zdGF0ZV92ZWN0b3IgdlxuICAgIGhiID0gSEIuX2VuY29kZSBzdGF0ZV92ZWN0b3JcbiAgICBqc29uID1cbiAgICAgIGhiOiBoYlxuICAgICAgc3RhdGVfdmVjdG9yOiBlbmNvZGVfc3RhdGVfdmVjdG9yIEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgIGpzb25cblxuICBhcHBseUhCID0gKGhiLCBmcm9tSEIpLT5cbiAgICBlbmdpbmUuYXBwbHlPcCBoYiwgZnJvbUhCXG5cbiAgY29ubmVjdG9yLmdldFN0YXRlVmVjdG9yID0gZ2V0U3RhdGVWZWN0b3JcbiAgY29ubmVjdG9yLmdldEhCID0gZ2V0SEJcbiAgY29ubmVjdG9yLmFwcGx5SEIgPSBhcHBseUhCXG5cbiAgY29ubmVjdG9yLnJlY2VpdmVfaGFuZGxlcnMucHVzaCAoc2VuZGVyLCBvcCktPlxuICAgIGlmIG9wLnVpZC5jcmVhdG9yIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgIGVuZ2luZS5hcHBseU9wIG9wXG5cblxubW9kdWxlLmV4cG9ydHMgPSBhZGFwdENvbm5lY3RvciIsIlxubW9kdWxlLmV4cG9ydHMgPVxuICAjXG4gICMgQHBhcmFtcyBuZXcgQ29ubmVjdG9yKG9wdGlvbnMpXG4gICMgICBAcGFyYW0gb3B0aW9ucy5zeW5jTW9kZSB7U3RyaW5nfSAgaXMgZWl0aGVyIFwic3luY0FsbFwiIG9yIFwibWFzdGVyLXNsYXZlXCIuXG4gICMgICBAcGFyYW0gb3B0aW9ucy5yb2xlIHtTdHJpbmd9IFRoZSByb2xlIG9mIHRoaXMgY2xpZW50XG4gICMgICAgICAgICAgICAoc2xhdmUgb3IgbWFzdGVyIChvbmx5IHVzZWQgd2hlbiBzeW5jTW9kZSBpcyBtYXN0ZXItc2xhdmUpKVxuICAjICAgQHBhcmFtIG9wdGlvbnMucGVyZm9ybV9zZW5kX2FnYWluIHtCb29sZWFufSBXaGV0ZWhyIHRvIHdoZXRoZXIgdG8gcmVzZW5kIHRoZSBIQiBhZnRlciBzb21lIHRpbWUgcGVyaW9kLiBUaGlzIHJlZHVjZXMgc3luYyBlcnJvcnMsIGJ1dCBoYXMgc29tZSBvdmVyaGVhZCAob3B0aW9uYWwpXG4gICNcbiAgaW5pdDogKG9wdGlvbnMpLT5cbiAgICByZXEgPSAobmFtZSwgY2hvaWNlcyk9PlxuICAgICAgaWYgb3B0aW9uc1tuYW1lXT9cbiAgICAgICAgaWYgKG5vdCBjaG9pY2VzPykgb3IgY2hvaWNlcy5zb21lKChjKS0+YyBpcyBvcHRpb25zW25hbWVdKVxuICAgICAgICAgIEBbbmFtZV0gPSBvcHRpb25zW25hbWVdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgY2FuIHNldCB0aGUgJ1wiK25hbWUrXCInIG9wdGlvbiB0byBvbmUgb2YgdGhlIGZvbGxvd2luZyBjaG9pY2VzOiBcIitKU09OLmVuY29kZShjaG9pY2VzKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBzcGVjaWZ5IFwiK25hbWUrXCIsIHdoZW4gaW5pdGlhbGl6aW5nIHRoZSBDb25uZWN0b3IhXCJcblxuICAgIHJlcSBcInN5bmNNb2RlXCIsIFtcInN5bmNBbGxcIiwgXCJtYXN0ZXItc2xhdmVcIl1cbiAgICByZXEgXCJyb2xlXCIsIFtcIm1hc3RlclwiLCBcInNsYXZlXCJdXG4gICAgcmVxIFwidXNlcl9pZFwiXG4gICAgQG9uX3VzZXJfaWRfc2V0PyhAdXNlcl9pZClcblxuICAgICMgd2hldGhlciB0byByZXNlbmQgdGhlIEhCIGFmdGVyIHNvbWUgdGltZSBwZXJpb2QuIFRoaXMgcmVkdWNlcyBzeW5jIGVycm9ycy5cbiAgICAjIEJ1dCB0aGlzIGlzIG5vdCBuZWNlc3NhcnkgaW4gdGhlIHRlc3QtY29ubmVjdG9yXG4gICAgaWYgb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW4/XG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gb3B0aW9ucy5wZXJmb3JtX3NlbmRfYWdhaW5cbiAgICBlbHNlXG4gICAgICBAcGVyZm9ybV9zZW5kX2FnYWluID0gdHJ1ZVxuXG4gICAgIyBBIE1hc3RlciBzaG91bGQgc3luYyB3aXRoIGV2ZXJ5b25lISBUT0RPOiByZWFsbHk/IC0gZm9yIG5vdyBpdHMgc2FmZXIgdGhpcyB3YXkhXG4gICAgaWYgQHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgQHN5bmNNb2RlID0gXCJzeW5jQWxsXCJcblxuICAgICMgaXMgc2V0IHRvIHRydWUgd2hlbiB0aGlzIGlzIHN5bmNlZCB3aXRoIGFsbCBvdGhlciBjb25uZWN0aW9uc1xuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxuICAgICMgUGVlcmpzIENvbm5lY3Rpb25zOiBrZXk6IGNvbm4taWQsIHZhbHVlOiBvYmplY3RcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgICMgTGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBzaGFsbCBwcm9jZXNzIGluY29taW5nIGRhdGFcbiAgICBAcmVjZWl2ZV9oYW5kbGVycyA9IFtdXG5cbiAgICAjIHdoZXRoZXIgdGhpcyBpbnN0YW5jZSBpcyBib3VuZCB0byBhbnkgeSBpbnN0YW5jZVxuICAgIEBpc19ib3VuZF90b195ID0gZmFsc2VcbiAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIEBzZW50X2hiX3RvX2FsbF91c2VycyA9IGZhbHNlXG5cbiAgaXNSb2xlTWFzdGVyOiAtPlxuICAgIEByb2xlIGlzIFwibWFzdGVyXCJcblxuICBpc1JvbGVTbGF2ZTogLT5cbiAgICBAcm9sZSBpcyBcInNsYXZlXCJcblxuICBmaW5kTmV3U3luY1RhcmdldDogKCktPlxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gbnVsbFxuICAgIGlmIEBzeW5jTW9kZSBpcyBcInN5bmNBbGxcIlxuICAgICAgZm9yIHVzZXIsIGMgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGlmIG5vdCBjLmlzX3N5bmNlZFxuICAgICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICAgICAgYnJlYWtcbiAgICBpZiBub3QgQGN1cnJlbnRfc3luY190YXJnZXQ/XG4gICAgICBAc2V0U3RhdGVTeW5jZWQoKVxuICAgIG51bGxcblxuICB1c2VyTGVmdDogKHVzZXIpLT5cbiAgICBkZWxldGUgQGNvbm5lY3Rpb25zW3VzZXJdXG4gICAgQGZpbmROZXdTeW5jVGFyZ2V0KClcblxuICB1c2VySm9pbmVkOiAodXNlciwgcm9sZSktPlxuICAgIGlmIG5vdCByb2xlP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiSW50ZXJuYWw6IFlvdSBtdXN0IHNwZWNpZnkgdGhlIHJvbGUgb2YgdGhlIGpvaW5lZCB1c2VyISBFLmcuIHVzZXJKb2luZWQoJ3VpZDozOTM5Jywnc2xhdmUnKVwiXG4gICAgIyBhIHVzZXIgam9pbmVkIHRoZSByb29tXG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdID89IHt9XG4gICAgQGNvbm5lY3Rpb25zW3VzZXJdLmlzX3N5bmNlZCA9IGZhbHNlXG5cbiAgICBpZiAobm90IEBpc19zeW5jZWQpIG9yIEBzeW5jTW9kZSBpcyBcInN5bmNBbGxcIlxuICAgICAgaWYgQHN5bmNNb2RlIGlzIFwic3luY0FsbFwiXG4gICAgICAgIEBwZXJmb3JtU3luYyB1c2VyXG4gICAgICBlbHNlIGlmIHJvbGUgaXMgXCJtYXN0ZXJcIlxuICAgICAgICAjIFRPRE86IFdoYXQgaWYgdGhlcmUgYXJlIHR3byBtYXN0ZXJzPyBQcmV2ZW50IHNlbmRpbmcgZXZlcnl0aGluZyB0d28gdGltZXMhXG4gICAgICAgIEBwZXJmb3JtU3luY1dpdGhNYXN0ZXIgdXNlclxuXG5cbiAgI1xuICAjIEV4ZWN1dGUgYSBmdW5jdGlvbiBfd2hlbl8gd2UgYXJlIGNvbm5lY3RlZC4gSWYgbm90IGNvbm5lY3RlZCwgd2FpdCB1bnRpbCBjb25uZWN0ZWQuXG4gICMgQHBhcmFtIGYge0Z1bmN0aW9ufSBXaWxsIGJlIGV4ZWN1dGVkIG9uIHRoZSBQZWVySnMtQ29ubmVjdG9yIGNvbnRleHQuXG4gICNcbiAgd2hlblN5bmNlZDogKGFyZ3MpLT5cbiAgICBpZiBhcmdzLmNvbnN0cnVjdG9yZSBpcyBGdW5jdGlvblxuICAgICAgYXJncyA9IFthcmdzXVxuICAgIGlmIEBpc19zeW5jZWRcbiAgICAgIGFyZ3NbMF0uYXBwbHkgdGhpcywgYXJnc1sxLi5dXG4gICAgZWxzZVxuICAgICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPz0gW11cbiAgICAgIEBjb21wdXRlX3doZW5fc3luY2VkLnB1c2ggYXJnc1xuXG4gICNcbiAgIyBFeGVjdXRlIGFuIGZ1bmN0aW9uIHdoZW4gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LiBmIHdpbGwgYmUgY2FsbGVkIHdpdGggKHNlbmRlcl9pZCwgYnJvYWRjYXN0IHt0cnVlfGZhbHNlfSwgbWVzc2FnZSkuXG4gICNcbiAgb25SZWNlaXZlOiAoZiktPlxuICAgIEByZWNlaXZlX2hhbmRsZXJzLnB1c2ggZlxuXG4gICMjI1xuICAjIEJyb2FkY2FzdCBhIG1lc3NhZ2UgdG8gYWxsIGNvbm5lY3RlZCBwZWVycy5cbiAgIyBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBUaGUgbWVzc2FnZSB0byBicm9hZGNhc3QuXG4gICNcbiAgYnJvYWRjYXN0OiAobWVzc2FnZSktPlxuICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IGltcGxlbWVudCBicm9hZGNhc3QhXCJcblxuICAjXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gYSBwZWVyLCBvciBzZXQgb2YgcGVlcnNcbiAgI1xuICBzZW5kOiAocGVlcl9zLCBtZXNzYWdlKS0+XG4gICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgaW1wbGVtZW50IHNlbmQhXCJcbiAgIyMjXG5cbiAgI1xuICAjIHBlcmZvcm0gYSBzeW5jIHdpdGggYSBzcGVjaWZpYyB1c2VyLlxuICAjXG4gIHBlcmZvcm1TeW5jOiAodXNlciktPlxuICAgIGlmIG5vdCBAY3VycmVudF9zeW5jX3RhcmdldD9cbiAgICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgICAgQHNlbmQgdXNlcixcbiAgICAgICAgc3luY19zdGVwOiBcImdldEhCXCJcbiAgICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgICAgZGF0YTogW10gIyBAZ2V0U3RhdGVWZWN0b3IoKVxuICAgICAgaWYgbm90IEBzZW50X2hiX3RvX2FsbF91c2Vyc1xuICAgICAgICBAc2VudF9oYl90b19hbGxfdXNlcnMgPSB0cnVlXG5cbiAgICAgICAgaGIgPSBAZ2V0SEIoW10pLmhiXG4gICAgICAgIF9oYiA9IFtdXG4gICAgICAgIGZvciBvIGluIGhiXG4gICAgICAgICAgX2hiLnB1c2ggb1xuICAgICAgICAgIGlmIF9oYi5sZW5ndGggPiAzMFxuICAgICAgICAgICAgQGJyb2FkY2FzdFxuICAgICAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgICAgICBkYXRhOiBfaGJcbiAgICAgICAgICAgIF9oYiA9IFtdXG4gICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQlwiXG4gICAgICAgICAgZGF0YTogX2hiXG5cblxuXG4gICNcbiAgIyBXaGVuIGEgbWFzdGVyIG5vZGUgam9pbmVkIHRoZSByb29tLCBwZXJmb3JtIHRoaXMgc3luYyB3aXRoIGhpbS4gSXQgd2lsbCBhc2sgdGhlIG1hc3RlciBmb3IgdGhlIEhCLFxuICAjIGFuZCB3aWxsIGJyb2FkY2FzdCBoaXMgb3duIEhCXG4gICNcbiAgcGVyZm9ybVN5bmNXaXRoTWFzdGVyOiAodXNlciktPlxuICAgIEBjdXJyZW50X3N5bmNfdGFyZ2V0ID0gdXNlclxuICAgIEBzZW5kIHVzZXIsXG4gICAgICBzeW5jX3N0ZXA6IFwiZ2V0SEJcIlxuICAgICAgc2VuZF9hZ2FpbjogXCJ0cnVlXCJcbiAgICAgIGRhdGE6IFtdXG4gICAgaGIgPSBAZ2V0SEIoW10pLmhiXG4gICAgX2hiID0gW11cbiAgICBmb3IgbyBpbiBoYlxuICAgICAgX2hiLnB1c2ggb1xuICAgICAgaWYgX2hiLmxlbmd0aCA+IDMwXG4gICAgICAgIEBicm9hZGNhc3RcbiAgICAgICAgICBzeW5jX3N0ZXA6IFwiYXBwbHlIQl9cIlxuICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICBfaGIgPSBbXVxuICAgIEBicm9hZGNhc3RcbiAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCXCJcbiAgICAgIGRhdGE6IF9oYlxuXG4gICNcbiAgIyBZb3UgYXJlIHN1cmUgdGhhdCBhbGwgY2xpZW50cyBhcmUgc3luY2VkLCBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gICNcbiAgc2V0U3RhdGVTeW5jZWQ6ICgpLT5cbiAgICBpZiBub3QgQGlzX3N5bmNlZFxuICAgICAgQGlzX3N5bmNlZCA9IHRydWVcbiAgICAgIGlmIEBjb21wdXRlX3doZW5fc3luY2VkP1xuICAgICAgICBmb3IgZiBpbiBAY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgICAgIGYoKVxuICAgICAgICBkZWxldGUgQGNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgIG51bGxcblxuICAjXG4gICMgWW91IHJlY2VpdmVkIGEgcmF3IG1lc3NhZ2UsIGFuZCB5b3Uga25vdyB0aGF0IGl0IGlzIGludGVuZGVkIGZvciB0byBZanMuIFRoZW4gY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAjXG4gIHJlY2VpdmVNZXNzYWdlOiAoc2VuZGVyLCByZXMpLT5cbiAgICBpZiBub3QgcmVzLnN5bmNfc3RlcD9cbiAgICAgIGZvciBmIGluIEByZWNlaXZlX2hhbmRsZXJzXG4gICAgICAgIGYgc2VuZGVyLCByZXNcbiAgICBlbHNlXG4gICAgICBpZiBzZW5kZXIgaXMgQHVzZXJfaWRcbiAgICAgICAgcmV0dXJuXG4gICAgICBpZiByZXMuc3luY19zdGVwIGlzIFwiZ2V0SEJcIlxuICAgICAgICBkYXRhID0gQGdldEhCKHJlcy5kYXRhKVxuICAgICAgICBoYiA9IGRhdGEuaGJcbiAgICAgICAgX2hiID0gW11cbiAgICAgICAgIyBhbHdheXMgYnJvYWRjYXN0LCB3aGVuIG5vdCBzeW5jZWQuXG4gICAgICAgICMgVGhpcyByZWR1Y2VzIGVycm9ycywgd2hlbiB0aGUgY2xpZW50cyBnb2VzIG9mZmxpbmUgcHJlbWF0dXJlbHkuXG4gICAgICAgICMgV2hlbiB0aGlzIGNsaWVudCBvbmx5IHN5bmNzIHRvIG9uZSBvdGhlciBjbGllbnRzLCBidXQgbG9vc2VzIGNvbm5lY3RvcnMsXG4gICAgICAgICMgYmVmb3JlIHN5bmNpbmcgdG8gdGhlIG90aGVyIGNsaWVudHMsIHRoZSBvbmxpbmUgY2xpZW50cyBoYXZlIGRpZmZlcmVudCBzdGF0ZXMuXG4gICAgICAgICMgU2luY2Ugd2UgZG8gbm90IHdhbnQgdG8gcGVyZm9ybSByZWd1bGFyIHN5bmNzLCB0aGlzIGlzIGEgZ29vZCBhbHRlcm5hdGl2ZVxuICAgICAgICBpZiBAaXNfc3luY2VkXG4gICAgICAgICAgc2VuZEFwcGx5SEIgPSAobSk9PlxuICAgICAgICAgICAgQHNlbmQgc2VuZGVyLCBtXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzZW5kQXBwbHlIQiA9IChtKT0+XG4gICAgICAgICAgICBAYnJvYWRjYXN0IG1cblxuICAgICAgICBmb3IgbyBpbiBoYlxuICAgICAgICAgIF9oYi5wdXNoIG9cbiAgICAgICAgICBpZiBfaGIubGVuZ3RoID4gMzBcbiAgICAgICAgICAgIHNlbmRBcHBseUhCXG4gICAgICAgICAgICAgIHN5bmNfc3RlcDogXCJhcHBseUhCX1wiXG4gICAgICAgICAgICAgIGRhdGE6IF9oYlxuICAgICAgICAgICAgX2hiID0gW11cblxuICAgICAgICBzZW5kQXBwbHlIQlxuICAgICAgICAgIHN5bmNfc3RlcCA6IFwiYXBwbHlIQlwiXG4gICAgICAgICAgZGF0YTogX2hiXG5cbiAgICAgICAgaWYgcmVzLnNlbmRfYWdhaW4/IGFuZCBAcGVyZm9ybV9zZW5kX2FnYWluXG4gICAgICAgICAgc2VuZF9hZ2FpbiA9IGRvIChzdiA9IGRhdGEuc3RhdGVfdmVjdG9yKT0+XG4gICAgICAgICAgICAoKT0+XG4gICAgICAgICAgICAgIGhiID0gQGdldEhCKHN2KS5oYlxuICAgICAgICAgICAgICBAc2VuZCBzZW5kZXIsXG4gICAgICAgICAgICAgICAgc3luY19zdGVwOiBcImFwcGx5SEJcIixcbiAgICAgICAgICAgICAgICBkYXRhOiBoYlxuICAgICAgICAgICAgICAgIHNlbnRfYWdhaW46IFwidHJ1ZVwiXG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kX2FnYWluLCAzMDAwXG4gICAgICBlbHNlIGlmIHJlcy5zeW5jX3N0ZXAgaXMgXCJhcHBseUhCXCJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcblxuICAgICAgICBpZiAoQHN5bmNNb2RlIGlzIFwic3luY0FsbFwiIG9yIHJlcy5zZW50X2FnYWluPykgYW5kIChub3QgQGlzX3N5bmNlZCkgYW5kIChAY3VycmVudF9zeW5jX3RhcmdldCBpcyBzZW5kZXIpXG4gICAgICAgICAgQGNvbm5lY3Rpb25zW3NlbmRlcl0uaXNfc3luY2VkID0gdHJ1ZVxuICAgICAgICAgIEBmaW5kTmV3U3luY1RhcmdldCgpXG5cbiAgICAgIGVsc2UgaWYgcmVzLnN5bmNfc3RlcCBpcyBcImFwcGx5SEJfXCJcbiAgICAgICAgQGFwcGx5SEIocmVzLmRhdGEsIHNlbmRlciBpcyBAY3VycmVudF9zeW5jX3RhcmdldClcblxuXG4gICMgQ3VycmVudGx5LCB0aGUgSEIgZW5jb2RlcyBvcGVyYXRpb25zIGFzIEpTT04uIEZvciB0aGUgbW9tZW50IEkgd2FudCB0byBrZWVwIGl0XG4gICMgdGhhdCB3YXkuIE1heWJlIHdlIHN1cHBvcnQgZW5jb2RpbmcgaW4gdGhlIEhCIGFzIFhNTCBpbiB0aGUgZnV0dXJlLCBidXQgZm9yIG5vdyBJIGRvbid0IHdhbnRcbiAgIyB0b28gbXVjaCBvdmVyaGVhZC4gWSBpcyB2ZXJ5IGxpa2VseSB0byBnZXQgY2hhbmdlZCBhIGxvdCBpbiB0aGUgZnV0dXJlXG4gICNcbiAgIyBCZWNhdXNlIHdlIGRvbid0IHdhbnQgdG8gZW5jb2RlIEpTT04gYXMgc3RyaW5nICh3aXRoIGNoYXJhY3RlciBlc2NhcGluZywgd2ljaCBtYWtlcyBpdCBwcmV0dHkgbXVjaCB1bnJlYWRhYmxlKVxuICAjIHdlIGVuY29kZSB0aGUgSlNPTiBhcyBYTUwuXG4gICNcbiAgIyBXaGVuIHRoZSBIQiBzdXBwb3J0IGVuY29kaW5nIGFzIFhNTCwgdGhlIGZvcm1hdCBzaG91bGQgbG9vayBwcmV0dHkgbXVjaCBsaWtlIHRoaXMuXG5cbiAgIyBkb2VzIG5vdCBzdXBwb3J0IHByaW1pdGl2ZSB2YWx1ZXMgYXMgYXJyYXkgZWxlbWVudHNcbiAgIyBleHBlY3RzIGFuIGx0eCAobGVzcyB0aGFuIHhtbCkgb2JqZWN0XG4gIHBhcnNlTWVzc2FnZUZyb21YbWw6IChtKS0+XG4gICAgcGFyc2VfYXJyYXkgPSAobm9kZSktPlxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxuICAgICAgICBpZiBuLmdldEF0dHJpYnV0ZShcImlzQXJyYXlcIikgaXMgXCJ0cnVlXCJcbiAgICAgICAgICBwYXJzZV9hcnJheSBuXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBwYXJzZV9vYmplY3QgblxuXG4gICAgcGFyc2Vfb2JqZWN0ID0gKG5vZGUpLT5cbiAgICAgIGpzb24gPSB7fVxuICAgICAgZm9yIG5hbWUsIHZhbHVlICBvZiBub2RlLmF0dHJzXG4gICAgICAgIGludCA9IHBhcnNlSW50KHZhbHVlKVxuICAgICAgICBpZiBpc05hTihpbnQpIG9yIChcIlwiK2ludCkgaXNudCB2YWx1ZVxuICAgICAgICAgIGpzb25bbmFtZV0gPSB2YWx1ZVxuICAgICAgICBlbHNlXG4gICAgICAgICAganNvbltuYW1lXSA9IGludFxuICAgICAgZm9yIG4gaW4gbm9kZS5jaGlsZHJlblxuICAgICAgICBuYW1lID0gbi5uYW1lXG4gICAgICAgIGlmIG4uZ2V0QXR0cmlidXRlKFwiaXNBcnJheVwiKSBpcyBcInRydWVcIlxuICAgICAgICAgIGpzb25bbmFtZV0gPSBwYXJzZV9hcnJheSBuXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBqc29uW25hbWVdID0gcGFyc2Vfb2JqZWN0IG5cbiAgICAgIGpzb25cbiAgICBwYXJzZV9vYmplY3QgbVxuXG4gICMgZW5jb2RlIG1lc3NhZ2UgaW4geG1sXG4gICMgd2UgdXNlIHN0cmluZyBiZWNhdXNlIFN0cm9waGUgb25seSBhY2NlcHRzIGFuIFwieG1sLXN0cmluZ1wiLi5cbiAgIyBTbyB7YTo0LGI6e2M6NX19IHdpbGwgbG9vayBsaWtlXG4gICMgPHkgYT1cIjRcIj5cbiAgIyAgIDxiIGM9XCI1XCI+PC9iPlxuICAjIDwveT5cbiAgIyBtIC0gbHR4IGVsZW1lbnRcbiAgIyBqc29uIC0gZ3Vlc3MgaXQgOylcbiAgI1xuICBlbmNvZGVNZXNzYWdlVG9YbWw6IChtLCBqc29uKS0+XG4gICAgIyBhdHRyaWJ1dGVzIGlzIG9wdGlvbmFsXG4gICAgZW5jb2RlX29iamVjdCA9IChtLCBqc29uKS0+XG4gICAgICBmb3IgbmFtZSx2YWx1ZSBvZiBqc29uXG4gICAgICAgIGlmIG5vdCB2YWx1ZT9cbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICAgIGVuY29kZV9vYmplY3QgbS5jKG5hbWUpLCB2YWx1ZVxuICAgICAgICBlbHNlIGlmIHZhbHVlLmNvbnN0cnVjdG9yIGlzIEFycmF5XG4gICAgICAgICAgZW5jb2RlX2FycmF5IG0uYyhuYW1lKSwgdmFsdWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG0uc2V0QXR0cmlidXRlKG5hbWUsdmFsdWUpXG4gICAgICBtXG4gICAgZW5jb2RlX2FycmF5ID0gKG0sIGFycmF5KS0+XG4gICAgICBtLnNldEF0dHJpYnV0ZShcImlzQXJyYXlcIixcInRydWVcIilcbiAgICAgIGZvciBlIGluIGFycmF5XG4gICAgICAgIGlmIGUuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgICAgZW5jb2RlX29iamVjdCBtLmMoXCJhcnJheS1lbGVtZW50XCIpLCBlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBlbmNvZGVfYXJyYXkgbS5jKFwiYXJyYXktZWxlbWVudFwiKSwgZVxuICAgICAgbVxuICAgIGlmIGpzb24uY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICBlbmNvZGVfb2JqZWN0IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxuICAgIGVsc2UgaWYganNvbi5jb25zdHJ1Y3RvciBpcyBBcnJheVxuICAgICAgZW5jb2RlX2FycmF5IG0uYyhcInlcIix7eG1sbnM6XCJodHRwOi8veS5uaW5qYS9jb25uZWN0b3Itc3RhbnphXCJ9KSwganNvblxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIkkgY2FuJ3QgZW5jb2RlIHRoaXMganNvbiFcIlxuXG4gIHNldElzQm91bmRUb1k6ICgpLT5cbiAgICBAb25fYm91bmRfdG9feT8oKVxuICAgIGRlbGV0ZSBAd2hlbl9ib3VuZF90b195XG4gICAgQGlzX2JvdW5kX3RvX3kgPSB0cnVlXG4iLCJcbndpbmRvdz8udW5wcm9jZXNzZWRfY291bnRlciA9IDAgIyBkZWwgdGhpc1xud2luZG93Py51bnByb2Nlc3NlZF9leGVjX2NvdW50ZXIgPSAwICMgVE9ET1xud2luZG93Py51bnByb2Nlc3NlZF90eXBlcyA9IFtdXG5cbiNcbiMgQG5vZG9jXG4jIFRoZSBFbmdpbmUgaGFuZGxlcyBob3cgYW5kIGluIHdoaWNoIG9yZGVyIHRvIGV4ZWN1dGUgb3BlcmF0aW9ucyBhbmQgYWRkIG9wZXJhdGlvbnMgdG8gdGhlIEhpc3RvcnlCdWZmZXIuXG4jXG5jbGFzcyBFbmdpbmVcblxuICAjXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAjIEBwYXJhbSB7T2JqZWN0fSB0eXBlcyBsaXN0IG9mIGF2YWlsYWJsZSB0eXBlc1xuICAjXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAdHlwZXMpLT5cbiAgICBAdW5wcm9jZXNzZWRfb3BzID0gW11cblxuICAjXG4gICMgUGFyc2VzIGFuIG9wZXJhdGlvIGZyb20gdGhlIGpzb24gZm9ybWF0LiBJdCB1c2VzIHRoZSBzcGVjaWZpZWQgcGFyc2VyIGluIHlvdXIgT3BlcmF0aW9uVHlwZSBtb2R1bGUuXG4gICNcbiAgcGFyc2VPcGVyYXRpb246IChqc29uKS0+XG4gICAgdHlwZSA9IEB0eXBlc1tqc29uLnR5cGVdXG4gICAgaWYgdHlwZT8ucGFyc2U/XG4gICAgICB0eXBlLnBhcnNlIGpzb25cbiAgICBlbHNlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgZm9yZ290IHRvIHNwZWNpZnkgYSBwYXJzZXIgZm9yIHR5cGUgI3tqc29uLnR5cGV9LiBUaGUgbWVzc2FnZSBpcyAje0pTT04uc3RyaW5naWZ5IGpzb259LlwiXG5cblxuICAjXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLl9lbmNvZGUoKS5cbiAgIyBAbm90ZSBZb3UgbXVzdCBub3QgdXNlIHRoaXMgbWV0aG9kIHdoZW4geW91IGFscmVhZHkgaGF2ZSBvcHMgaW4geW91ciBIQiFcbiAgIyMjXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cbiAgICBvcHMgPSBbXVxuICAgIGZvciBvIGluIG9wc19qc29uXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xuICAgIGZvciBvIGluIG9wc1xuICAgICAgaWYgbm90IG8uZXhlY3V0ZSgpXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXG4gICAgQHRyeVVucHJvY2Vzc2VkKClcbiAgIyMjXG5cbiAgI1xuICAjIFNhbWUgYXMgYXBwbHlPcHMgYnV0IG9wZXJhdGlvbnMgdGhhdCBhcmUgYWxyZWFkeSBpbiB0aGUgSEIgYXJlIG5vdCBhcHBsaWVkLlxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXG4gICNcbiAgYXBwbHlPcHNDaGVja0RvdWJsZTogKG9wc19qc29uKS0+XG4gICAgZm9yIG8gaW4gb3BzX2pzb25cbiAgICAgIGlmIG5vdCBASEIuZ2V0T3BlcmF0aW9uKG8udWlkKT9cbiAgICAgICAgQGFwcGx5T3Agb1xuXG4gICNcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcbiAgIyBAc2VlIEVuZ2luZS5hcHBseU9wXG4gIGFwcGx5T3BzOiAob3BzX2pzb24pLT5cbiAgICBAYXBwbHlPcCBvcHNfanNvblxuXG4gICNcbiAgIyBBcHBseSBhbiBvcGVyYXRpb24gdGhhdCB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICMgVE9ETzogbWFrZSB0aGlzIG1vcmUgZWZmaWNpZW50ISFcbiAgIyAtIG9wZXJhdGlvbnMgbWF5IG9ubHkgZXhlY3V0ZWQgaW4gb3JkZXIgYnkgY3JlYXRvciwgb3JkZXIgdGhlbSBpbiBvYmplY3Qgb2YgYXJyYXlzIChrZXkgYnkgY3JlYXRvcilcbiAgIyAtIHlvdSBjYW4gcHJvYmFibHkgbWFrZSBzb21ldGhpbmcgbGlrZSBkZXBlbmRlbmNpZXMgKGNyZWF0b3IxIHdhaXRzIGZvciBjcmVhdG9yMilcbiAgYXBwbHlPcDogKG9wX2pzb25fYXJyYXksIGZyb21IQiA9IGZhbHNlKS0+XG4gICAgaWYgb3BfanNvbl9hcnJheS5jb25zdHJ1Y3RvciBpc250IEFycmF5XG4gICAgICBvcF9qc29uX2FycmF5ID0gW29wX2pzb25fYXJyYXldXG4gICAgZm9yIG9wX2pzb24gaW4gb3BfanNvbl9hcnJheVxuICAgICAgaWYgZnJvbUhCXG4gICAgICAgIG9wX2pzb24uZnJvbUhCID0gXCJ0cnVlXCIgIyBleGVjdXRlIGltbWVkaWF0ZWx5LCBpZiBcbiAgICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxuICAgICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXG4gICAgICBpZiBvcF9qc29uLmZyb21IQj9cbiAgICAgICAgby5mcm9tSEIgPSBvcF9qc29uLmZyb21IQlxuICAgICAgIyBASEIuYWRkT3BlcmF0aW9uIG9cbiAgICAgIGlmIEBIQi5nZXRPcGVyYXRpb24obyk/XG4gICAgICAgICMgbm9wXG4gICAgICBlbHNlIGlmICgobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG8pKSBhbmQgKG5vdCBvLmZyb21IQj8pKSBvciAobm90IG8uZXhlY3V0ZSgpKVxuICAgICAgICBAdW5wcm9jZXNzZWRfb3BzLnB1c2ggb1xuICAgICAgICB3aW5kb3c/LnVucHJvY2Vzc2VkX3R5cGVzLnB1c2ggby50eXBlICMgVE9ETzogZGVsZXRlIHRoaXNcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxuXG4gICNcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxuICAjIEl0IGNoZWNrcyBpZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBwcmV2aW91c2x5IG5vdCBleGVjdXRhYmxlIGFyZSBub3cgZXhlY3V0YWJsZS5cbiAgI1xuICB0cnlVbnByb2Nlc3NlZDogKCktPlxuICAgIHdoaWxlIHRydWVcbiAgICAgIG9sZF9sZW5ndGggPSBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aFxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxuICAgICAgZm9yIG9wIGluIEB1bnByb2Nlc3NlZF9vcHNcbiAgICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvcCk/XG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiAobm90IEBIQi5pc0V4cGVjdGVkT3BlcmF0aW9uKG9wKSBhbmQgKG5vdCBvcC5mcm9tSEI/KSkgb3IgKG5vdCBvcC5leGVjdXRlKCkpXG4gICAgICAgICAgdW5wcm9jZXNzZWQucHVzaCBvcFxuICAgICAgQHVucHJvY2Vzc2VkX29wcyA9IHVucHJvY2Vzc2VkXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXG4gICAgICAgIGJyZWFrXG4gICAgaWYgQHVucHJvY2Vzc2VkX29wcy5sZW5ndGggaXNudCAwXG4gICAgICBASEIuaW52b2tlU3luYygpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBFbmdpbmVcblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsIlxuI1xuIyBAbm9kb2NcbiMgQW4gb2JqZWN0IHRoYXQgaG9sZHMgYWxsIGFwcGxpZWQgb3BlcmF0aW9ucy5cbiNcbiMgQG5vdGUgVGhlIEhpc3RvcnlCdWZmZXIgaXMgY29tbW9ubHkgYWJicmV2aWF0ZWQgdG8gSEIuXG4jXG5jbGFzcyBIaXN0b3J5QnVmZmVyXG5cbiAgI1xuICAjIENyZWF0ZXMgYW4gZW1wdHkgSEIuXG4gICMgQHBhcmFtIHtPYmplY3R9IHVzZXJfaWQgQ3JlYXRvciBvZiB0aGUgSEIuXG4gICNcbiAgY29uc3RydWN0b3I6IChAdXNlcl9pZCktPlxuICAgIEBvcGVyYXRpb25fY291bnRlciA9IHt9XG4gICAgQGJ1ZmZlciA9IHt9XG4gICAgQGNoYW5nZV9saXN0ZW5lcnMgPSBbXVxuICAgIEBnYXJiYWdlID0gW10gIyBXaWxsIGJlIGNsZWFuZWQgb24gbmV4dCBjYWxsIG9mIGdhcmJhZ2VDb2xsZWN0b3JcbiAgICBAdHJhc2ggPSBbXSAjIElzIGRlbGV0ZWQuIFdhaXQgdW50aWwgaXQgaXMgbm90IHVzZWQgYW55bW9yZS5cbiAgICBAcGVyZm9ybUdhcmJhZ2VDb2xsZWN0aW9uID0gdHJ1ZVxuICAgIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgPSAzMDAwMFxuICAgIEByZXNlcnZlZF9pZGVudGlmaWVyX2NvdW50ZXIgPSAwXG4gICAgc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG5cbiAgcmVzZXRVc2VySWQ6IChpZCktPlxuICAgIG93biA9IEBidWZmZXJbQHVzZXJfaWRdXG4gICAgaWYgb3duP1xuICAgICAgZm9yIG9fbmFtZSxvIG9mIG93blxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yP1xuICAgICAgICAgIG8udWlkLmNyZWF0b3IgPSBpZFxuICAgICAgICBpZiBvLnVpZC5hbHQ/XG4gICAgICAgICAgby51aWQuYWx0LmNyZWF0b3IgPSBpZFxuICAgICAgaWYgQGJ1ZmZlcltpZF0/XG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBhcmUgcmUtYXNzaWduaW5nIGFuIG9sZCB1c2VyIGlkIC0gdGhpcyBpcyBub3QgKHlldCkgcG9zc2libGUhXCJcbiAgICAgIEBidWZmZXJbaWRdID0gb3duXG4gICAgICBkZWxldGUgQGJ1ZmZlcltAdXNlcl9pZF1cbiAgICBpZiBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW2lkXSA9IEBvcGVyYXRpb25fY291bnRlcltAdXNlcl9pZF1cbiAgICAgIGRlbGV0ZSBAb3BlcmF0aW9uX2NvdW50ZXJbQHVzZXJfaWRdXG4gICAgQHVzZXJfaWQgPSBpZFxuXG4gIGVtcHR5R2FyYmFnZTogKCk9PlxuICAgIGZvciBvIGluIEBnYXJiYWdlXG4gICAgICAjaWYgQGdldE9wZXJhdGlvbkNvdW50ZXIoby51aWQuY3JlYXRvcikgPiBvLnVpZC5vcF9udW1iZXJcbiAgICAgIG8uY2xlYW51cD8oKVxuXG4gICAgQGdhcmJhZ2UgPSBAdHJhc2hcbiAgICBAdHJhc2ggPSBbXVxuICAgIGlmIEBnYXJiYWdlQ29sbGVjdFRpbWVvdXQgaXNudCAtMVxuICAgICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gc2V0VGltZW91dCBAZW1wdHlHYXJiYWdlLCBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0XG4gICAgdW5kZWZpbmVkXG5cbiAgI1xuICAjIEdldCB0aGUgdXNlciBpZCB3aXRoIHdpY2ggdGhlIEhpc3RvcnkgQnVmZmVyIHdhcyBpbml0aWFsaXplZC5cbiAgI1xuICBnZXRVc2VySWQ6ICgpLT5cbiAgICBAdXNlcl9pZFxuXG4gIGFkZFRvR2FyYmFnZUNvbGxlY3RvcjogKCktPlxuICAgIGlmIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb25cbiAgICAgIGZvciBvIGluIGFyZ3VtZW50c1xuICAgICAgICBpZiBvP1xuICAgICAgICAgIEBnYXJiYWdlLnB1c2ggb1xuXG4gIHN0b3BHYXJiYWdlQ29sbGVjdGlvbjogKCktPlxuICAgIEBwZXJmb3JtR2FyYmFnZUNvbGxlY3Rpb24gPSBmYWxzZVxuICAgIEBzZXRNYW51YWxHYXJiYWdlQ29sbGVjdCgpXG4gICAgQGdhcmJhZ2UgPSBbXVxuICAgIEB0cmFzaCA9IFtdXG5cbiAgc2V0TWFudWFsR2FyYmFnZUNvbGxlY3Q6ICgpLT5cbiAgICBAZ2FyYmFnZUNvbGxlY3RUaW1lb3V0ID0gLTFcbiAgICBjbGVhclRpbWVvdXQgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkXG4gICAgQGdhcmJhZ2VDb2xsZWN0VGltZW91dElkID0gdW5kZWZpbmVkXG5cbiAgc2V0R2FyYmFnZUNvbGxlY3RUaW1lb3V0OiAoQGdhcmJhZ2VDb2xsZWN0VGltZW91dCktPlxuXG4gICNcbiAgIyBJIHByb3Bvc2UgdG8gdXNlIGl0IGluIHlvdXIgRnJhbWV3b3JrLCB0byBjcmVhdGUgc29tZXRoaW5nIGxpa2UgYSByb290IGVsZW1lbnQuXG4gICMgQW4gb3BlcmF0aW9uIHdpdGggdGhpcyBpZGVudGlmaWVyIGlzIG5vdCBwcm9wYWdhdGVkIHRvIG90aGVyIGNsaWVudHMuXG4gICMgVGhpcyBpcyB3aHkgZXZlcnlib2RlIG11c3QgY3JlYXRlIHRoZSBzYW1lIG9wZXJhdGlvbiB3aXRoIHRoaXMgdWlkLlxuICAjXG4gIGdldFJlc2VydmVkVW5pcXVlSWRlbnRpZmllcjogKCktPlxuICAgIHtcbiAgICAgIGNyZWF0b3IgOiAnXydcbiAgICAgIG9wX251bWJlciA6IFwiXyN7QHJlc2VydmVkX2lkZW50aWZpZXJfY291bnRlcisrfVwiXG4gICAgICBkb1N5bmM6IGZhbHNlXG4gICAgfVxuXG4gICNcbiAgIyBHZXQgdGhlIG9wZXJhdGlvbiBjb3VudGVyIHRoYXQgZGVzY3JpYmVzIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBkb2N1bWVudC5cbiAgI1xuICBnZXRPcGVyYXRpb25Db3VudGVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgcmVzID0ge31cbiAgICAgIGZvciB1c2VyLGN0biBvZiBAb3BlcmF0aW9uX2NvdW50ZXJcbiAgICAgICAgcmVzW3VzZXJdID0gY3RuXG4gICAgICByZXNcbiAgICBlbHNlXG4gICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cblxuICBpc0V4cGVjdGVkT3BlcmF0aW9uOiAobyktPlxuICAgIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSA/PSAwXG4gICAgby51aWQub3BfbnVtYmVyIDw9IEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgIHRydWUgI1RPRE86ICEhIHRoaXMgY291bGQgYnJlYWsgc3R1ZmYuIEJ1dCBJIGR1bm5vIHdoeVxuXG4gICNcbiAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAjIFRPRE86IE1ha2UgdGhpcyBtb3JlIGVmZmljaWVudCFcbiAgX2VuY29kZTogKHN0YXRlX3ZlY3Rvcj17fSktPlxuICAgIGpzb24gPSBbXVxuICAgIHVua25vd24gPSAodXNlciwgb19udW1iZXIpLT5cbiAgICAgIGlmIChub3QgdXNlcj8pIG9yIChub3Qgb19udW1iZXI/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJkYWghXCJcbiAgICAgIG5vdCBzdGF0ZV92ZWN0b3JbdXNlcl0/IG9yIHN0YXRlX3ZlY3Rvclt1c2VyXSA8PSBvX251bWJlclxuXG4gICAgZm9yIHVfbmFtZSx1c2VyIG9mIEBidWZmZXJcbiAgICAgICMgVE9ETyBuZXh0LCBpZiBAc3RhdGVfdmVjdG9yW3VzZXJdIDw9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuICAgICAgZm9yIG9fbnVtYmVyLG8gb2YgdXNlclxuICAgICAgICBpZiAobm90IG8udWlkLm5vT3BlcmF0aW9uPykgYW5kIG8udWlkLmRvU3luYyBhbmQgdW5rbm93bih1X25hbWUsIG9fbnVtYmVyKVxuICAgICAgICAgICMgaXRzIG5lY2Vzc2FyeSB0byBzZW5kIGl0LCBhbmQgbm90IGtub3duIGluIHN0YXRlX3ZlY3RvclxuICAgICAgICAgIG9fanNvbiA9IG8uX2VuY29kZSgpXG4gICAgICAgICAgaWYgby5uZXh0X2NsPyAjIGFwcGxpZXMgZm9yIGFsbCBvcHMgYnV0IHRoZSBtb3N0IHJpZ2h0IGRlbGltaXRlciFcbiAgICAgICAgICAgICMgc2VhcmNoIGZvciB0aGUgbmV4dCBfa25vd25fIG9wZXJhdGlvbi4gKFdoZW4gc3RhdGVfdmVjdG9yIGlzIHt9IHRoZW4gdGhpcyBpcyB0aGUgRGVsaW1pdGVyKVxuICAgICAgICAgICAgb19uZXh0ID0gby5uZXh0X2NsXG4gICAgICAgICAgICB3aGlsZSBvX25leHQubmV4dF9jbD8gYW5kIHVua25vd24ob19uZXh0LnVpZC5jcmVhdG9yLCBvX25leHQudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19uZXh0ID0gb19uZXh0Lm5leHRfY2xcbiAgICAgICAgICAgIG9fanNvbi5uZXh0ID0gb19uZXh0LmdldFVpZCgpXG4gICAgICAgICAgZWxzZSBpZiBvLnByZXZfY2w/ICMgbW9zdCByaWdodCBkZWxpbWl0ZXIgb25seSFcbiAgICAgICAgICAgICMgc2FtZSBhcyB0aGUgYWJvdmUgd2l0aCBwcmV2LlxuICAgICAgICAgICAgb19wcmV2ID0gby5wcmV2X2NsXG4gICAgICAgICAgICB3aGlsZSBvX3ByZXYucHJldl9jbD8gYW5kIHVua25vd24ob19wcmV2LnVpZC5jcmVhdG9yLCBvX3ByZXYudWlkLm9wX251bWJlcilcbiAgICAgICAgICAgICAgb19wcmV2ID0gb19wcmV2LnByZXZfY2xcbiAgICAgICAgICAgIG9fanNvbi5wcmV2ID0gb19wcmV2LmdldFVpZCgpXG4gICAgICAgICAganNvbi5wdXNoIG9fanNvblxuXG4gICAganNvblxuXG4gICNcbiAgIyBHZXQgdGhlIG51bWJlciBvZiBvcGVyYXRpb25zIHRoYXQgd2VyZSBjcmVhdGVkIGJ5IGEgdXNlci5cbiAgIyBBY2NvcmRpbmdseSB5b3Ugd2lsbCBnZXQgdGhlIG5leHQgb3BlcmF0aW9uIG51bWJlciB0aGF0IGlzIGV4cGVjdGVkIGZyb20gdGhhdCB1c2VyLlxuICAjIFRoaXMgd2lsbCBpbmNyZW1lbnQgdGhlIG9wZXJhdGlvbiBjb3VudGVyLlxuICAjXG4gIGdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyOiAodXNlcl9pZCktPlxuICAgIGlmIG5vdCB1c2VyX2lkP1xuICAgICAgdXNlcl9pZCA9IEB1c2VyX2lkXG4gICAgaWYgbm90IEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXT9cbiAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSA9IDBcbiAgICB1aWQgPVxuICAgICAgJ2NyZWF0b3InIDogdXNlcl9pZFxuICAgICAgJ29wX251bWJlcicgOiBAb3BlcmF0aW9uX2NvdW50ZXJbdXNlcl9pZF1cbiAgICAgICdkb1N5bmMnIDogdHJ1ZVxuICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyX2lkXSsrXG4gICAgdWlkXG5cbiAgI1xuICAjIFJldHJpZXZlIGFuIG9wZXJhdGlvbiBmcm9tIGEgdW5pcXVlIGlkLlxuICAjXG4gICMgd2hlbiB1aWQgaGFzIGEgXCJzdWJcIiBwcm9wZXJ0eSwgdGhlIHZhbHVlIG9mIGl0IHdpbGwgYmUgYXBwbGllZFxuICAjIG9uIHRoZSBvcGVyYXRpb25zIHJldHJpZXZlU3ViIG1ldGhvZCAod2hpY2ggbXVzdCEgYmUgZGVmaW5lZClcbiAgI1xuICBnZXRPcGVyYXRpb246ICh1aWQpLT5cbiAgICBpZiB1aWQudWlkP1xuICAgICAgdWlkID0gdWlkLnVpZFxuICAgIG8gPSBAYnVmZmVyW3VpZC5jcmVhdG9yXT9bdWlkLm9wX251bWJlcl1cbiAgICBpZiB1aWQuc3ViPyBhbmQgbz9cbiAgICAgIG8ucmV0cmlldmVTdWIgdWlkLnN1YlxuICAgIGVsc2VcbiAgICAgIG9cblxuICAjXG4gICMgQWRkIGFuIG9wZXJhdGlvbiB0byB0aGUgSEIuIE5vdGUgdGhhdCB0aGlzIHdpbGwgbm90IGxpbmsgaXQgYWdhaW5zdFxuICAjIG90aGVyIG9wZXJhdGlvbnMgKGl0IHdvbnQgZXhlY3V0ZWQpXG4gICNcbiAgYWRkT3BlcmF0aW9uOiAobyktPlxuICAgIGlmIG5vdCBAYnVmZmVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXSA9IHt9XG4gICAgaWYgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXVtvLnVpZC5vcF9udW1iZXJdP1xuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IG92ZXJ3cml0ZSBvcGVyYXRpb25zIVwiXG4gICAgaWYgKG8udWlkLm9wX251bWJlci5jb25zdHJ1Y3RvciBpc250IFN0cmluZykgYW5kIChub3QgQGlzRXhwZWN0ZWRPcGVyYXRpb24obykpIGFuZCAobm90IG8uZnJvbUhCPykgIyB5b3UgYWxyZWFkeSBkbyB0aGlzIGluIHRoZSBlbmdpbmUsIHNvIGRlbGV0ZSBpdCBoZXJlIVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBvcGVyYXRpb24gd2FzIG5vdCBleHBlY3RlZCFcIlxuICAgIEBhZGRUb0NvdW50ZXIobylcbiAgICBAYnVmZmVyW28udWlkLmNyZWF0b3JdW28udWlkLm9wX251bWJlcl0gPSBvXG4gICAgb1xuXG4gIHJlbW92ZU9wZXJhdGlvbjogKG8pLT5cbiAgICBkZWxldGUgQGJ1ZmZlcltvLnVpZC5jcmVhdG9yXT9bby51aWQub3BfbnVtYmVyXVxuXG4gICMgV2hlbiB0aGUgSEIgZGV0ZXJtaW5lcyBpbmNvbnNpc3RlbmNpZXMsIHRoZW4gdGhlIGludm9rZVN5bmNcbiAgIyBoYW5kbGVyIHdpbCBiZSBjYWxsZWQsIHdoaWNoIHNob3VsZCBzb21laG93IGludm9rZSB0aGUgc3luYyB3aXRoIGFub3RoZXIgY29sbGFib3JhdG9yLlxuICAjIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIHN5bmMgaGFuZGxlciBpcyB0aGUgdXNlcl9pZCB3aXRoIHdpY2ggYW4gaW5jb25zaXN0ZW5jeSB3YXMgZGV0ZXJtaW5lZFxuICBzZXRJbnZva2VTeW5jSGFuZGxlcjogKGYpLT5cbiAgICBAaW52b2tlU3luYyA9IGZcblxuICAjIGVtcHR5IHBlciBkZWZhdWx0ICMgVE9ETzogZG8gaSBuZWVkIHRoaXM/XG4gIGludm9rZVN5bmM6ICgpLT5cblxuICAjIGFmdGVyIHlvdSByZWNlaXZlZCB0aGUgSEIgb2YgYW5vdGhlciB1c2VyIChpbiB0aGUgc3luYyBwcm9jZXNzKSxcbiAgIyB5b3UgcmVuZXcgeW91ciBvd24gc3RhdGVfdmVjdG9yIHRvIHRoZSBzdGF0ZV92ZWN0b3Igb2YgdGhlIG90aGVyIHVzZXJcbiAgcmVuZXdTdGF0ZVZlY3RvcjogKHN0YXRlX3ZlY3RvciktPlxuICAgIGZvciB1c2VyLHN0YXRlIG9mIHN0YXRlX3ZlY3RvclxuICAgICAgaWYgKChub3QgQG9wZXJhdGlvbl9jb3VudGVyW3VzZXJdPykgb3IgKEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA8IHN0YXRlX3ZlY3Rvclt1c2VyXSkpIGFuZCBzdGF0ZV92ZWN0b3JbdXNlcl0/XG4gICAgICAgIEBvcGVyYXRpb25fY291bnRlclt1c2VyXSA9IHN0YXRlX3ZlY3Rvclt1c2VyXVxuXG4gICNcbiAgIyBJbmNyZW1lbnQgdGhlIG9wZXJhdGlvbl9jb3VudGVyIHRoYXQgZGVmaW5lcyB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgRW5naW5lLlxuICAjXG4gIGFkZFRvQ291bnRlcjogKG8pLT5cbiAgICBpZiBub3QgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdP1xuICAgICAgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdID0gMFxuICAgIGlmIHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXMgJ251bWJlcicgYW5kIG8udWlkLmNyZWF0b3IgaXNudCBAZ2V0VXNlcklkKClcbiAgICAgICMgVE9ETzogY2hlY2sgaWYgb3BlcmF0aW9ucyBhcmUgc2VuZCBpbiBvcmRlclxuICAgICAgaWYgby51aWQub3BfbnVtYmVyIGlzIEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXVxuICAgICAgICBAb3BlcmF0aW9uX2NvdW50ZXJbby51aWQuY3JlYXRvcl0rK1xuICAgICAgZWxzZVxuICAgICAgICBAaW52b2tlU3luYyBvLnVpZC5jcmVhdG9yXG5cbiAgICAjaWYgQG9wZXJhdGlvbl9jb3VudGVyW28udWlkLmNyZWF0b3JdIGlzbnQgKG8udWlkLm9wX251bWJlciArIDEpXG4gICAgICAjY29uc29sZS5sb2cgKEBvcGVyYXRpb25fY291bnRlcltvLnVpZC5jcmVhdG9yXSAtIChvLnVpZC5vcF9udW1iZXIgKyAxKSlcbiAgICAgICNjb25zb2xlLmxvZyBvXG4gICAgICAjdGhyb3cgbmV3IEVycm9yIFwiWW91IGRvbid0IHJlY2VpdmUgb3BlcmF0aW9ucyBpbiB0aGUgcHJvcGVyIG9yZGVyLiBUcnkgY291bnRpbmcgbGlrZSB0aGlzIDAsMSwyLDMsNCwuLiA7KVwiXG5cbm1vZHVsZS5leHBvcnRzID0gSGlzdG9yeUJ1ZmZlclxuIiwibW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgIyBAc2VlIEVuZ2luZS5wYXJzZVxuICB0eXBlcyA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEBwcml2YXRlXG4gICMgQGFic3RyYWN0XG4gICMgQG5vZG9jXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgKiBfZW5jb2RlOiBlbmNvZGVzIGFuIG9wZXJhdGlvbiAobmVlZGVkIG9ubHkgaWYgaW5zdGFuY2Ugb2YgdGhpcyBvcGVyYXRpb24gaXMgc2VudCkuXG4gICMgKiBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxuICAjICogdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuIFdlIGV4dGVuZCB0aGUgcGFyc2VyIG9iamVjdCBpbiBvcmRlciB0byBwYXJzZSBlbmNvZGVkIG9wZXJhdGlvbnMuXG4gICNcbiAgY2xhc3MgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuXG4gICAgIyBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkIGJlZm9yZSBhdCB0aGUgZW5kIG9mIHRoZSBleGVjdXRpb24gc2VxdWVuY2VcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBpc19kZWxldGVkID0gZmFsc2VcbiAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IGZhbHNlXG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gW10gIyBUT0RPOiByZW5hbWUgdG8gb2JzZXJ2ZXJzIG9yIHN0aCBsaWtlIHRoYXRcbiAgICAgIGlmIHVpZD9cbiAgICAgICAgQHVpZCA9IHVpZFxuXG4gICAgdHlwZTogXCJPcGVyYXRpb25cIlxuXG4gICAgcmV0cmlldmVTdWI6ICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcInN1YiBwcm9wZXJ0aWVzIGFyZSBub3QgZW5hYmxlIG9uIHRoaXMgb3BlcmF0aW9uIHR5cGUhXCJcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvYnNlcnZlOiAoZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycy5wdXNoIGZcblxuICAgICNcbiAgICAjIERlbGV0ZXMgZnVuY3Rpb24gZnJvbSB0aGUgb2JzZXJ2ZXIgbGlzdFxuICAgICMgQHNlZSBPcGVyYXRpb24ub2JzZXJ2ZVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB1bm9ic2VydmUoZXZlbnQsIGYpXG4gICAgIyAgIEBwYXJhbSBmICAgICB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0aGF0IHlvdSB3YW50IHRvIGRlbGV0ZSBcbiAgICB1bm9ic2VydmU6IChmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID0gQGV2ZW50X2xpc3RlbmVycy5maWx0ZXIgKGcpLT5cbiAgICAgICAgZiBpc250IGdcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYWxsIHN1YnNjcmliZWQgZXZlbnQgbGlzdGVuZXJzLlxuICAgICMgVGhpcyBzaG91bGQgYmUgY2FsbGVkLCBlLmcuIGFmdGVyIHRoaXMgaGFzIGJlZW4gcmVwbGFjZWQuXG4gICAgIyAoVGhlbiBvbmx5IG9uZSByZXBsYWNlIGV2ZW50IHNob3VsZCBmaXJlLiApXG4gICAgIyBUaGlzIGlzIGFsc28gY2FsbGVkIGluIHRoZSBjbGVhbnVwIG1ldGhvZC5cbiAgICBkZWxldGVBbGxPYnNlcnZlcnM6ICgpLT5cbiAgICAgIEBldmVudF9saXN0ZW5lcnMgPSBbXVxuXG4gICAgZGVsZXRlOiAoKS0+XG4gICAgICAobmV3IHR5cGVzLkRlbGV0ZSB1bmRlZmluZWQsIEApLmV4ZWN1dGUoKVxuICAgICAgbnVsbFxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICMgVE9ETzogZG8geW91IG5lZWQgY2FsbEV2ZW50K2ZvcndhcmRFdmVudD8gT25seSBvbmUgc3VmZmljZXMgcHJvYmFibHlcbiAgICBjYWxsRXZlbnQ6ICgpLT5cbiAgICAgIEBmb3J3YXJkRXZlbnQgQCwgYXJndW1lbnRzLi4uXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50IGFuZCBzcGVjaWZ5IGluIHdoaWNoIGNvbnRleHQgdGhlIGxpc3RlbmVyIGlzIGNhbGxlZCAoc2V0ICd0aGlzJykuXG4gICAgIyBUT0RPOiBkbyB5b3UgbmVlZCB0aGlzID9cbiAgICBmb3J3YXJkRXZlbnQ6IChvcCwgYXJncy4uLiktPlxuICAgICAgZm9yIGYgaW4gQGV2ZW50X2xpc3RlbmVyc1xuICAgICAgICBmLmNhbGwgb3AsIGFyZ3MuLi5cblxuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGlzX2RlbGV0ZWRcblxuICAgIGFwcGx5RGVsZXRlOiAoZ2FyYmFnZWNvbGxlY3QgPSB0cnVlKS0+XG4gICAgICBpZiBub3QgQGdhcmJhZ2VfY29sbGVjdGVkXG4gICAgICAgICNjb25zb2xlLmxvZyBcImFwcGx5RGVsZXRlOiAje0B0eXBlfVwiXG4gICAgICAgIEBpc19kZWxldGVkID0gdHJ1ZVxuICAgICAgICBpZiBnYXJiYWdlY29sbGVjdFxuICAgICAgICAgIEBnYXJiYWdlX2NvbGxlY3RlZCA9IHRydWVcbiAgICAgICAgICBIQi5hZGRUb0dhcmJhZ2VDb2xsZWN0b3IgQFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgI2NvbnNvbGUubG9nIFwiY2xlYW51cDogI3tAdHlwZX1cIlxuICAgICAgSEIucmVtb3ZlT3BlcmF0aW9uIEBcbiAgICAgIEBkZWxldGVBbGxPYnNlcnZlcnMoKVxuXG4gICAgI1xuICAgICMgU2V0IHRoZSBwYXJlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHNldFBhcmVudDogKEBwYXJlbnQpLT5cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIGlmIG5vdCBAdWlkLm5vT3BlcmF0aW9uP1xuICAgICAgICBAdWlkXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEB1aWQuYWx0PyAjIGNvdWxkIGJlIChzYWZlbHkpIHVuZGVmaW5lZFxuICAgICAgICAgIG1hcF91aWQgPSBAdWlkLmFsdC5jbG9uZVVpZCgpXG4gICAgICAgICAgbWFwX3VpZC5zdWIgPSBAdWlkLnN1YlxuICAgICAgICAgIG1hcF91aWQuZG9TeW5jID0gZmFsc2VcbiAgICAgICAgICBtYXBfdWlkXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmRlZmluZWRcblxuICAgIGNsb25lVWlkOiAoKS0+XG4gICAgICB1aWQgPSB7fVxuICAgICAgZm9yIG4sdiBvZiBAZ2V0VWlkKClcbiAgICAgICAgdWlkW25dID0gdlxuICAgICAgdWlkXG5cbiAgICBkb250U3luYzogKCktPlxuICAgICAgQHVpZC5kb1N5bmMgPSBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIElmIG5vdCBhbHJlYWR5IGRvbmUsIHNldCB0aGUgdWlkXG4gICAgIyBBZGQgdGhpcyB0byB0aGUgSEJcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGlmIG5vdCBAdWlkP1xuICAgICAgICAjIFdoZW4gdGhpcyBvcGVyYXRpb24gd2FzIGNyZWF0ZWQgd2l0aG91dCBhIHVpZCwgdGhlbiBzZXQgaXQgaGVyZS5cbiAgICAgICAgIyBUaGVyZSBpcyBvbmx5IG9uZSBvdGhlciBwbGFjZSwgd2hlcmUgdGhpcyBjYW4gYmUgZG9uZSAtIGJlZm9yZSBhbiBJbnNlcnRpb25cbiAgICAgICAgIyBpcyBleGVjdXRlZCAoYmVjYXVzZSB3ZSBuZWVkIHRoZSBjcmVhdG9yX2lkKVxuICAgICAgICBAdWlkID0gSEIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXIoKVxuICAgICAgaWYgbm90IEB1aWQubm9PcGVyYXRpb24/XG4gICAgICAgIEhCLmFkZE9wZXJhdGlvbiBAXG4gICAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICAgIGwgQF9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE9wZXJhdGlvbnMgbWF5IGRlcGVuZCBvbiBvdGhlciBvcGVyYXRpb25zIChsaW5rZWQgbGlzdHMsIGV0Yy4pLlxuICAgICMgVGhlIHNhdmVPcGVyYXRpb24gYW5kIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG1ldGhvZHMgcHJvdmlkZVxuICAgICMgYW4gZWFzeSB3YXkgdG8gcmVmZXIgdG8gdGhlc2Ugb3BlcmF0aW9ucyB2aWEgYW4gdWlkIG9yIG9iamVjdCByZWZlcmVuY2UuXG4gICAgI1xuICAgICMgRm9yIGV4YW1wbGU6IFdlIGNhbiBjcmVhdGUgYSBuZXcgRGVsZXRlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgdGhlIG9wZXJhdGlvbiAkbyBsaWtlIHRoaXNcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvKTsgICBvclxuICAgICMgICAgIC0gdmFyIGQgPSBuZXcgRGVsZXRlKHVpZCwgJG8uZ2V0VWlkKCkpO1xuICAgICMgRWl0aGVyIHdheSB3ZSB3YW50IHRvIGFjY2VzcyAkbyB2aWEgZC5kZWxldGVzLiBJbiB0aGUgc2Vjb25kIGNhc2UgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMgbXVzdCBiZSBjYWxsZWQgZmlyc3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3BfdWlkKVxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgb3BlcmF0aW9uLiBBZnRlciB2YWxpZGF0aW5nICh3aXRoIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKSB0aGUgaW5zdGFudGlhdGVkIG9wZXJhdGlvbiB3aWxsIGJlIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T2JqZWN0fSBvcF91aWQgQSB1aWQgdGhhdCByZWZlcnMgdG8gYW4gb3BlcmF0aW9uXG4gICAgIyBAb3ZlcmxvYWQgc2F2ZU9wZXJhdGlvbihuYW1lLCBvcClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgY2FsbGluZyB0aGlzIGZ1bmN0aW9uIG9wIGlzIGFjY2Vzc2libGUgdmlhIHRoaXNbbmFtZV0uXG4gICAgIyAgIEBwYXJhbSB7T3BlcmF0aW9ufSBvcCBBbiBPcGVyYXRpb24gb2JqZWN0XG4gICAgI1xuICAgIHNhdmVPcGVyYXRpb246IChuYW1lLCBvcCktPlxuXG4gICAgICAjXG4gICAgICAjIEV2ZXJ5IGluc3RhbmNlIG9mICRPcGVyYXRpb24gbXVzdCBoYXZlIGFuICRleGVjdXRlIGZ1bmN0aW9uLlxuICAgICAgIyBXZSB1c2UgZHVjay10eXBpbmcgdG8gY2hlY2sgaWYgb3AgaXMgaW5zdGFudGlhdGVkIHNpbmNlIHRoZXJlXG4gICAgICAjIGNvdWxkIGV4aXN0IG11bHRpcGxlIGNsYXNzZXMgb2YgJE9wZXJhdGlvblxuICAgICAgI1xuICAgICAgaWYgb3A/LmV4ZWN1dGU/XG4gICAgICAgICMgaXMgaW5zdGFudGlhdGVkXG4gICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgZWxzZSBpZiBvcD9cbiAgICAgICAgIyBub3QgaW5pdGlhbGl6ZWQuIERvIGl0IHdoZW4gY2FsbGluZyAkdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICBAdW5jaGVja2VkID89IHt9XG4gICAgICAgIEB1bmNoZWNrZWRbbmFtZV0gPSBvcFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBhbGwgbm90IGluc3RhbnRpYXRlZCBvcGVyYXRpb25zIHdpbGwgYmUgYWNjZXNzaWJsZS5cbiAgICAjIEBzZWUgT3BlcmF0aW9uLnNhdmVPcGVyYXRpb25cbiAgICAjXG4gICAgIyBAcmV0dXJuIFtCb29sZWFuXSBXaGV0aGVyIGl0IHdhcyBwb3NzaWJsZSB0byBpbnN0YW50aWF0ZSBhbGwgb3BlcmF0aW9ucy5cbiAgICAjXG4gICAgdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnM6ICgpLT5cbiAgICAgIHVuaW5zdGFudGlhdGVkID0ge31cbiAgICAgIHN1Y2Nlc3MgPSBAXG4gICAgICBmb3IgbmFtZSwgb3BfdWlkIG9mIEB1bmNoZWNrZWRcbiAgICAgICAgb3AgPSBIQi5nZXRPcGVyYXRpb24gb3BfdWlkXG4gICAgICAgIGlmIG9wXG4gICAgICAgICAgQFtuYW1lXSA9IG9wXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB1bmluc3RhbnRpYXRlZFtuYW1lXSA9IG9wX3VpZFxuICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZVxuICAgICAgZGVsZXRlIEB1bmNoZWNrZWRcbiAgICAgIGlmIG5vdCBzdWNjZXNzXG4gICAgICAgIEB1bmNoZWNrZWQgPSB1bmluc3RhbnRpYXRlZFxuICAgICAgc3VjY2Vzc1xuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIHNpbXBsZSBEZWxldGUtdHlwZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIGFuIG9wZXJhdGlvbi5cbiAgI1xuICBjbGFzcyB0eXBlcy5EZWxldGUgZXh0ZW5kcyB0eXBlcy5PcGVyYXRpb25cblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSBkZWxldGVzIFVJRCBvciByZWZlcmVuY2Ugb2YgdGhlIG9wZXJhdGlvbiB0aGF0IHRoaXMgdG8gYmUgZGVsZXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGRlbGV0ZXMpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdkZWxldGVzJywgZGVsZXRlc1xuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkRlbGV0ZVwiXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbnQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZSc6IFwiRGVsZXRlXCJcbiAgICAgICAgJ3VpZCc6IEBnZXRVaWQoKVxuICAgICAgICAnZGVsZXRlcyc6IEBkZWxldGVzLmdldFVpZCgpXG4gICAgICB9XG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgQXBwbHkgdGhlIGRlbGV0aW9uLlxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXMgPSBzdXBlclxuICAgICAgICBpZiByZXNcbiAgICAgICAgICBAZGVsZXRlcy5hcHBseURlbGV0ZSBAXG4gICAgICAgIHJlc1xuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIHR5cGVzLkRlbGV0ZS5wYXJzZSA9IChvKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdkZWxldGVzJzogZGVsZXRlc191aWRcbiAgICB9ID0gb1xuICAgIG5ldyB0aGlzKHVpZCwgZGVsZXRlc191aWQpXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIHR5cGVzLkluc2VydCBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luLCBwYXJlbnQpLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgdHlwZTogXCJJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgc2V0IGNvbnRlbnQgdG8gbnVsbCBhbmQgb3RoZXIgc3R1ZmZcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIGNhbGxMYXRlciA9IGZhbHNlXG4gICAgICBpZiBAcGFyZW50PyBhbmQgbm90IEBpc0RlbGV0ZWQoKSBhbmQgbz8gIyBvPyA6IGlmIG5vdCBvPywgdGhlbiB0aGUgZGVsaW1pdGVyIGRlbGV0ZWQgdGhpcyBJbnNlcnRpb24uIEZ1cnRoZXJtb3JlLCBpdCB3b3VsZCBiZSB3cm9uZyB0byBjYWxsIGl0LiBUT0RPOiBtYWtlIHRoaXMgbW9yZSBleHByZXNzaXZlIGFuZCBzYXZlXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBjYWxsTGF0ZXIgPSB0cnVlXG4gICAgICBpZiBvP1xuICAgICAgICBAZGVsZXRlZF9ieS5wdXNoIG9cbiAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gZmFsc2VcbiAgICAgIGlmIEBuZXh0X2NsLmlzRGVsZXRlZCgpXG4gICAgICAgIGdhcmJhZ2Vjb2xsZWN0ID0gdHJ1ZVxuICAgICAgc3VwZXIgZ2FyYmFnZWNvbGxlY3RcbiAgICAgIGlmIGNhbGxMYXRlclxuICAgICAgICBAY2FsbE9wZXJhdGlvblNwZWNpZmljRGVsZXRlRXZlbnRzKG8pXG4gICAgICBpZiBAcHJldl9jbD8uaXNEZWxldGVkKClcbiAgICAgICAgIyBnYXJiYWdlIGNvbGxlY3QgcHJldl9jbFxuICAgICAgICBAcHJldl9jbC5hcHBseURlbGV0ZSgpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBpZiBAbmV4dF9jbC5pc0RlbGV0ZWQoKVxuICAgICAgICAjIGRlbGV0ZSBhbGwgb3BzIHRoYXQgZGVsZXRlIHRoaXMgaW5zZXJ0aW9uXG4gICAgICAgIGZvciBkIGluIEBkZWxldGVkX2J5XG4gICAgICAgICAgZC5jbGVhbnVwKClcblxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcInJpZ2h0IGlzIG5vdCBkZWxldGVkLiBpbmNvbnNpc3RlbmN5ISwgd3JhcmFyYXJcIlxuICAgICAgICAjIGNoYW5nZSBvcmlnaW4gcmVmZXJlbmNlcyB0byB0aGUgcmlnaHRcbiAgICAgICAgbyA9IEBuZXh0X2NsXG4gICAgICAgIHdoaWxlIG8udHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgICBpZiBvLm9yaWdpbiBpcyBAXG4gICAgICAgICAgICBvLm9yaWdpbiA9IEBwcmV2X2NsXG4gICAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICAjIHJlY29ubmVjdCBsZWZ0L3JpZ2h0XG4gICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAbmV4dF9jbFxuICAgICAgICBAbmV4dF9jbC5wcmV2X2NsID0gQHByZXZfY2xcbiAgICAgICAgc3VwZXJcbiAgICAgICMgZWxzZVxuICAgICAgIyAgIFNvbWVvbmUgaW5zZXJ0ZWQgc29tZXRoaW5nIGluIHRoZSBtZWFudGltZS5cbiAgICAgICMgICBSZW1lbWJlcjogdGhpcyBjYW4gb25seSBiZSBnYXJiYWdlIGNvbGxlY3RlZCB3aGVuIG5leHRfY2wgaXMgZGVsZXRlZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFRoZSBhbW91bnQgb2YgcG9zaXRpb25zIHRoYXQgJHRoaXMgb3BlcmF0aW9uIHdhcyBtb3ZlZCB0byB0aGUgcmlnaHQuXG4gICAgI1xuICAgIGdldERpc3RhbmNlVG9PcmlnaW46ICgpLT5cbiAgICAgIGQgPSAwXG4gICAgICBvID0gQHByZXZfY2xcbiAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgaWYgQG9yaWdpbiBpcyBvXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZCsrXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIGRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBJbmNsdWRlIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBhc3NvY2lhdGl2ZSBsaXN0cy5cbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIGlmIEBwYXJlbnQ/XG4gICAgICAgICAgaWYgbm90IEBwcmV2X2NsP1xuICAgICAgICAgICAgQHByZXZfY2wgPSBAcGFyZW50LmJlZ2lubmluZ1xuICAgICAgICAgIGlmIG5vdCBAb3JpZ2luP1xuICAgICAgICAgICAgQG9yaWdpbiA9IEBwYXJlbnQuYmVnaW5uaW5nXG4gICAgICAgICAgaWYgbm90IEBuZXh0X2NsP1xuICAgICAgICAgICAgQG5leHRfY2wgPSBAcGFyZW50LmVuZFxuICAgICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAgICBkaXN0YW5jZV90b19vcmlnaW4gPSBAZ2V0RGlzdGFuY2VUb09yaWdpbigpICMgbW9zdCBjYXNlczogMFxuICAgICAgICAgIG8gPSBAcHJldl9jbC5uZXh0X2NsXG4gICAgICAgICAgaSA9IGRpc3RhbmNlX3RvX29yaWdpbiAjIGxvb3AgY291bnRlclxuXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2VcbiAgICAgICAgICAjICAgICAgICAgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG8gaXNudCBAbmV4dF9jbFxuICAgICAgICAgICAgICAjICRvIGhhcHBlbmVkIGNvbmN1cnJlbnRseVxuICAgICAgICAgICAgICBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSBpcyBpXG4gICAgICAgICAgICAgICAgIyBjYXNlIDFcbiAgICAgICAgICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIDwgQHVpZC5jcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG5cbiAgICAgICAgQHNldFBhcmVudCBAcHJldl9jbC5nZXRQYXJlbnQoKSAjIGRvIEluc2VydGlvbnMgYWx3YXlzIGhhdmUgYSBwYXJlbnQ/XG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG4gICAgICAgIEBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHMoKVxuICAgICAgICBAXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIEBwYXJlbnQ/LmNhbGxFdmVudCBbXG4gICAgICAgIHR5cGU6IFwiaW5zZXJ0XCJcbiAgICAgICAgcG9zaXRpb246IEBnZXRQb3NpdGlvbigpXG4gICAgICAgIG9iamVjdDogQHBhcmVudFxuICAgICAgICBjaGFuZ2VkQnk6IEB1aWQuY3JlYXRvclxuICAgICAgICB2YWx1ZTogQGNvbnRlbnRcbiAgICAgIF1cblxuICAgIGNhbGxPcGVyYXRpb25TcGVjaWZpY0RlbGV0ZUV2ZW50czogKG8pLT5cbiAgICAgIEBwYXJlbnQuY2FsbEV2ZW50IFtcbiAgICAgICAgdHlwZTogXCJkZWxldGVcIlxuICAgICAgICBwb3NpdGlvbjogQGdldFBvc2l0aW9uKClcbiAgICAgICAgb2JqZWN0OiBAcGFyZW50ICMgVE9ETzogWW91IGNhbiBjb21iaW5lIGdldFBvc2l0aW9uICsgZ2V0UGFyZW50IGluIGEgbW9yZSBlZmZpY2llbnQgbWFubmVyISAob25seSBsZWZ0IERlbGltaXRlciB3aWxsIGhvbGQgQHBhcmVudClcbiAgICAgICAgbGVuZ3RoOiAxXG4gICAgICAgIGNoYW5nZWRCeTogby51aWQuY3JlYXRvclxuICAgICAgXVxuXG4gICAgI1xuICAgICMgQ29tcHV0ZSB0aGUgcG9zaXRpb24gb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIGdldFBvc2l0aW9uOiAoKS0+XG4gICAgICBwb3NpdGlvbiA9IDBcbiAgICAgIHByZXYgPSBAcHJldl9jbFxuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICBpZiBwcmV2IGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgaWYgbm90IHByZXYuaXNEZWxldGVkKClcbiAgICAgICAgICBwb3NpdGlvbisrXG4gICAgICAgIHByZXYgPSBwcmV2LnByZXZfY2xcbiAgICAgIHBvc2l0aW9uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIERlZmluZXMgYW4gb2JqZWN0IHRoYXQgaXMgY2Fubm90IGJlIGNoYW5nZWQuIFlvdSBjYW4gdXNlIHRoaXMgdG8gc2V0IGFuIGltbXV0YWJsZSBzdHJpbmcsIG9yIGEgbnVtYmVyLlxuICAjXG4gIGNsYXNzIHR5cGVzLkltbXV0YWJsZU9iamVjdCBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGNvbnRlbnRcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIEBjb250ZW50KS0+XG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiSW1tdXRhYmxlT2JqZWN0XCJcblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdjb250ZW50JyA6IEBjb250ZW50XG4gICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuSW1tdXRhYmxlT2JqZWN0LnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkLCBjb250ZW50KVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIHR5cGVzLkRlbGltaXRlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgcHJldl9jbFxuICAgICAgc3VwZXIge25vT3BlcmF0aW9uOiB0cnVlfVxuXG4gICAgdHlwZTogXCJEZWxpbWl0ZXJcIlxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyKClcbiAgICAgIG8gPSBAcHJldl9jbFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/IG9yIHRydWUgIyBUT0RPOiBhcmUgeW91IHN1cmU/IFRoaXMgY2FuIGhhcHBlbiByaWdodD9cbiAgICAgICAgc3VwZXJcbiAgICAgICNlbHNlXG4gICAgICAjICB0aHJvdyBuZXcgRXJyb3IgXCJEZWxpbWl0ZXIgaXMgdW5zdWZmaWNpZW50IGRlZmluZWQhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ3ByZXYnIDogQHByZXZfY2w/LmdldFVpZCgpXG4gICAgICAgICduZXh0JyA6IEBuZXh0X2NsPy5nZXRVaWQoKVxuICAgICAgfVxuXG4gIHR5cGVzLkRlbGltaXRlci5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICd1aWQnIDogdWlkXG4gICAgJ3ByZXYnIDogcHJldlxuICAgICduZXh0JyA6IG5leHRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZCwgcHJldiwgbmV4dClcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDogdHlwZXNcbiAgICAnZXhlY3V0aW9uX2xpc3RlbmVyJyA6IGV4ZWN1dGlvbl9saXN0ZW5lclxuICB9XG5cblxuXG5cbiIsInRleHRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1RleHRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHRleHRfdHlwZXMgPSB0ZXh0X3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSB0ZXh0X3R5cGVzLnR5cGVzXG5cbiAgI1xuICAjIE1hbmFnZXMgT2JqZWN0LWxpa2UgdmFsdWVzLlxuICAjXG4gIGNsYXNzIHR5cGVzLk9iamVjdCBleHRlbmRzIHR5cGVzLk1hcE1hbmFnZXJcblxuICAgICNcbiAgICAjIElkZW50aWZpZXMgdGhpcyBjbGFzcy5cbiAgICAjIFVzZSBpdCB0byBjaGVjayB3aGV0aGVyIHRoaXMgaXMgYSBqc29uLXR5cGUgb3Igc29tZXRoaW5nIGVsc2UuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHggPSB5LnZhbCgndW5rbm93bicpXG4gICAgIyAgIGlmICh4LnR5cGUgPT09IFwiT2JqZWN0XCIpIHtcbiAgICAjICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSh4LnRvSnNvbigpKVxuICAgICMgICB9XG4gICAgI1xuICAgIHR5cGU6IFwiT2JqZWN0XCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBzdXBlcigpXG5cbiAgICBjbGVhbnVwOiAoKS0+XG4gICAgICBzdXBlcigpXG5cblxuICAgICNcbiAgICAjIFRyYW5zZm9ybSB0aGlzIHRvIGEgSnNvbi4gSWYgeW91ciBicm93c2VyIHN1cHBvcnRzIE9iamVjdC5vYnNlcnZlIGl0IHdpbGwgYmUgdHJhbnNmb3JtZWQgYXV0b21hdGljYWxseSB3aGVuIGEgY2hhbmdlIGFycml2ZXMuXG4gICAgIyBPdGhlcndpc2UgeW91IHdpbGwgbG9vc2UgYWxsIHRoZSBzaGFyaW5nLWFiaWxpdGllcyAodGhlIG5ldyBvYmplY3Qgd2lsbCBiZSBhIGRlZXAgY2xvbmUpIVxuICAgICMgQHJldHVybiB7SnNvbn1cbiAgICAjXG4gICAgIyBUT0RPOiBhdCB0aGUgbW9tZW50IHlvdSBkb24ndCBjb25zaWRlciBjaGFuZ2luZyBvZiBwcm9wZXJ0aWVzLlxuICAgICMgRS5nLjogbGV0IHggPSB7YTpbXX0uIFRoZW4geC5hLnB1c2ggMSB3b3VsZG4ndCBjaGFuZ2UgYW55dGhpbmdcbiAgICAjXG4gICAgdG9Kc29uOiAodHJhbnNmb3JtX3RvX3ZhbHVlID0gZmFsc2UpLT5cbiAgICAgIGlmIG5vdCBAYm91bmRfanNvbj8gb3Igbm90IE9iamVjdC5vYnNlcnZlPyBvciB0cnVlICMgVE9ETzogY3VycmVudGx5LCB5b3UgYXJlIG5vdCB3YXRjaGluZyBtdXRhYmxlIHN0cmluZ3MgZm9yIGNoYW5nZXMsIGFuZCwgdGhlcmVmb3JlLCB0aGUgQGJvdW5kX2pzb24gaXMgbm90IHVwZGF0ZWQuIFRPRE8gVE9ETyAgd3Vhd3Vhd3VhIGVhc3lcbiAgICAgICAgdmFsID0gQHZhbCgpXG4gICAgICAgIGpzb24gPSB7fVxuICAgICAgICBmb3IgbmFtZSwgbyBvZiB2YWxcbiAgICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuT2JqZWN0XG4gICAgICAgICAgICBqc29uW25hbWVdID0gby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICAgIGVsc2UgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkFycmF5XG4gICAgICAgICAgICBqc29uW25hbWVdID0gby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICAgIGVsc2UgaWYgdHJhbnNmb3JtX3RvX3ZhbHVlIGFuZCBvIGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgICAgICBqc29uW25hbWVdID0gby52YWwoKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGpzb25bbmFtZV0gPSBvXG4gICAgICAgIEBib3VuZF9qc29uID0ganNvblxuICAgICAgICBpZiBPYmplY3Qub2JzZXJ2ZT9cbiAgICAgICAgICB0aGF0ID0gQFxuICAgICAgICAgIE9iamVjdC5vYnNlcnZlIEBib3VuZF9qc29uLCAoZXZlbnRzKS0+XG4gICAgICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgICAgIGlmIG5vdCBldmVudC5jaGFuZ2VkQnk/IGFuZCAoZXZlbnQudHlwZSBpcyBcImFkZFwiIG9yIGV2ZW50LnR5cGUgPSBcInVwZGF0ZVwiKVxuICAgICAgICAgICAgICAgICMgdGhpcyBldmVudCBpcyBub3QgY3JlYXRlZCBieSBZLlxuICAgICAgICAgICAgICAgIHRoYXQudmFsKGV2ZW50Lm5hbWUsIGV2ZW50Lm9iamVjdFtldmVudC5uYW1lXSlcbiAgICAgICAgICBAb2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgICAgICAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICAgICAgICAgIGlmIGV2ZW50LmNyZWF0ZWRfIGlzbnQgSEIuZ2V0VXNlcklkKClcbiAgICAgICAgICAgICAgICBub3RpZmllciA9IE9iamVjdC5nZXROb3RpZmllcih0aGF0LmJvdW5kX2pzb24pXG4gICAgICAgICAgICAgICAgb2xkVmFsID0gdGhhdC5ib3VuZF9qc29uW2V2ZW50Lm5hbWVdXG4gICAgICAgICAgICAgICAgaWYgb2xkVmFsP1xuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAndXBkYXRlJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3VwZGF0ZSdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTogZXZlbnQuY2hhbmdlZEJ5XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgbm90aWZpZXIucGVyZm9ybUNoYW5nZSAnYWRkJywgKCktPlxuICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYm91bmRfanNvbltldmVudC5uYW1lXSA9IHRoYXQudmFsKGV2ZW50Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICwgdGhhdC5ib3VuZF9qc29uXG4gICAgICAgICAgICAgICAgICBub3RpZmllci5ub3RpZnlcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0OiB0aGF0LmJvdW5kX2pzb25cbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZCdcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogZXZlbnQubmFtZVxuICAgICAgICAgICAgICAgICAgICBvbGRWYWx1ZTogb2xkVmFsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWRCeTpldmVudC5jaGFuZ2VkQnlcbiAgICAgIEBib3VuZF9qc29uXG5cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKClcbiAgICAjICAgR2V0IHRoaXMgYXMgYSBKc29uIG9iamVjdC5cbiAgICAjICAgQHJldHVybiBbSnNvbl1cbiAgICAjXG4gICAgIyBAb3ZlcmxvYWQgdmFsKG5hbWUpXG4gICAgIyAgIEdldCB2YWx1ZSBvZiBhIHByb3BlcnR5LlxuICAgICMgICBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBvYmplY3QgcHJvcGVydHkuXG4gICAgIyAgIEByZXR1cm4gW09iamVjdCBUeXBlfHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbT2JqZWN0IFR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIG5hbWU/IGFuZCBhcmd1bWVudHMubGVuZ3RoID4gMVxuICAgICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5jb25zdHJ1Y3Rvcj9cbiAgICAgICAgICB0eXBlID0gdHlwZXNbY29udGVudC5jb25zdHJ1Y3Rvci5uYW1lXVxuICAgICAgICAgIGlmIHR5cGU/IGFuZCB0eXBlLmNyZWF0ZT9cbiAgICAgICAgICAgIGFyZ3MgPSBbXVxuICAgICAgICAgICAgZm9yIGkgaW4gWzEuLi5hcmd1bWVudHMubGVuZ3RoXVxuICAgICAgICAgICAgICBhcmdzLnB1c2ggYXJndW1lbnRzW2ldXG4gICAgICAgICAgICBvID0gdHlwZS5jcmVhdGUuYXBwbHkgbnVsbCwgYXJnc1xuICAgICAgICAgICAgc3VwZXIgbmFtZSwgb1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoZSAje2NvbnRlbnQuY29uc3RydWN0b3IubmFtZX0tdHlwZSBpcyBub3QgKHlldCkgc3VwcG9ydGVkIGluIFkuXCJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHN1cGVyIG5hbWUsIGNvbnRlbnRcbiAgICAgIGVsc2UgIyBpcyB0aGlzIGV2ZW4gbmVjZXNzYXJ5ID8gSSBoYXZlIHRvIGRlZmluZSBldmVyeSB0eXBlIGFueXdheS4uIChzZWUgTnVtYmVyIHR5cGUgYmVsb3cpXG4gICAgICAgIHN1cGVyIG5hbWVcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cblxuICB0eXBlcy5PYmplY3QucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgfSA9IGpzb25cbiAgICBuZXcgdGhpcyh1aWQpXG5cbiAgdHlwZXMuT2JqZWN0LmNyZWF0ZSA9IChjb250ZW50LCBtdXRhYmxlKS0+XG4gICAganNvbiA9IG5ldyB0eXBlcy5PYmplY3QoKS5leGVjdXRlKClcbiAgICBmb3IgbixvIG9mIGNvbnRlbnRcbiAgICAgIGpzb24udmFsIG4sIG8sIG11dGFibGVcbiAgICBqc29uXG5cblxuICB0eXBlcy5OdW1iZXIgPSB7fVxuICB0eXBlcy5OdW1iZXIuY3JlYXRlID0gKGNvbnRlbnQpLT5cbiAgICBjb250ZW50XG5cbiAgdGV4dF90eXBlc1xuXG5cbiIsImJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgPSByZXF1aXJlIFwiLi9CYXNpY1R5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgYmFzaWNfdHlwZXMgPSBiYXNpY190eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gYmFzaWNfdHlwZXMudHlwZXNcblxuICAjXG4gICMgQG5vZG9jXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgdHlwZXMuTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgIHR5cGU6IFwiTWFwTWFuYWdlclwiXG5cbiAgICBhcHBseURlbGV0ZTogKCktPlxuICAgICAgZm9yIG5hbWUscCBvZiBAbWFwXG4gICAgICAgIHAuYXBwbHlEZWxldGUoKVxuICAgICAgc3VwZXIoKVxuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXIoKVxuXG4gICAgI1xuICAgICMgQHNlZSBKc29uVHlwZXMudmFsXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQpLT5cbiAgICAgIGlmIGFyZ3VtZW50cy5sZW5ndGggPiAxXG4gICAgICAgIEByZXRyaWV2ZVN1YihuYW1lKS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBwcm9wID0gQG1hcFtuYW1lXVxuICAgICAgICBpZiBwcm9wPyBhbmQgbm90IHByb3AuaXNDb250ZW50RGVsZXRlZCgpXG4gICAgICAgICAgcHJvcC52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5kZWZpbmVkXG4gICAgICBlbHNlXG4gICAgICAgIHJlc3VsdCA9IHt9XG4gICAgICAgIGZvciBuYW1lLG8gb2YgQG1hcFxuICAgICAgICAgIGlmIG5vdCBvLmlzQ29udGVudERlbGV0ZWQoKVxuICAgICAgICAgICAgcmVzdWx0W25hbWVdID0gby52YWwoKVxuICAgICAgICByZXN1bHRcblxuICAgIGRlbGV0ZTogKG5hbWUpLT5cbiAgICAgIEBtYXBbbmFtZV0/LmRlbGV0ZUNvbnRlbnQoKVxuICAgICAgQFxuXG4gICAgcmV0cmlldmVTdWI6IChwcm9wZXJ0eV9uYW1lKS0+XG4gICAgICBpZiBub3QgQG1hcFtwcm9wZXJ0eV9uYW1lXT9cbiAgICAgICAgZXZlbnRfcHJvcGVydGllcyA9XG4gICAgICAgICAgbmFtZTogcHJvcGVydHlfbmFtZVxuICAgICAgICBldmVudF90aGlzID0gQFxuICAgICAgICBybV91aWQgPVxuICAgICAgICAgIG5vT3BlcmF0aW9uOiB0cnVlXG4gICAgICAgICAgc3ViOiBwcm9wZXJ0eV9uYW1lXG4gICAgICAgICAgYWx0OiBAXG4gICAgICAgIHJtID0gbmV3IHR5cGVzLlJlcGxhY2VNYW5hZ2VyIGV2ZW50X3Byb3BlcnRpZXMsIGV2ZW50X3RoaXMsIHJtX3VpZCAjIHRoaXMgb3BlcmF0aW9uIHNoYWxsIG5vdCBiZSBzYXZlZCBpbiB0aGUgSEJcbiAgICAgICAgQG1hcFtwcm9wZXJ0eV9uYW1lXSA9IHJtXG4gICAgICAgIHJtLnNldFBhcmVudCBALCBwcm9wZXJ0eV9uYW1lXG4gICAgICAgIHJtLmV4ZWN1dGUoKVxuICAgICAgQG1hcFtwcm9wZXJ0eV9uYW1lXVxuXG4gICNcbiAgIyBAbm9kb2NcbiAgIyBNYW5hZ2VzIGEgbGlzdCBvZiBJbnNlcnQtdHlwZSBvcGVyYXRpb25zLlxuICAjXG4gIGNsYXNzIHR5cGVzLkxpc3RNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBBIExpc3RNYW5hZ2VyIG1haW50YWlucyBhIG5vbi1lbXB0eSBsaXN0IHRoYXQgaGFzIGEgYmVnaW5uaW5nIGFuZCBhbiBlbmQgKGJvdGggRGVsaW1pdGVycyEpXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEBiZWdpbm5pbmcgPSBuZXcgdHlwZXMuRGVsaW1pdGVyIHVuZGVmaW5lZCwgdW5kZWZpbmVkXG4gICAgICBAZW5kID0gICAgICAgbmV3IHR5cGVzLkRlbGltaXRlciBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbCA9IEBlbmRcbiAgICAgIEBiZWdpbm5pbmcuZXhlY3V0ZSgpXG4gICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgdWlkXG5cbiAgICB0eXBlOiBcIkxpc3RNYW5hZ2VyXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5leGVjdXRlXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIHJlc3VsdC5wdXNoIG9cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjIGUuZy4gXCJhYmNcIiA6IHRoZSAxdGggY2hhcmFjdGVyIGlzIFwiYVwiXG4gICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlciBhbmQgby5wcmV2X2NsP1xuICAgICAgICAgICMgdGhlIHVzZXIgb3IgeW91IGdhdmUgYSBwb3NpdGlvbiBwYXJhbWV0ZXIgdGhhdCBpcyB0byBiaWdcbiAgICAgICAgICAjIGZvciB0aGUgY3VycmVudCBhcnJheS4gVGhlcmVmb3JlIHdlIHJlYWNoIGEgRGVsaW1pdGVyLlxuICAgICAgICAgICMgVGhlbiwgd2UnbGwganVzdCByZXR1cm4gdGhlIGxhc3QgY2hhcmFjdGVyLlxuICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICB3aGlsZSBvLmlzRGVsZXRlZCgpIG9yIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBwb3NpdGlvbiA8PSAwIGFuZCBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIHBvc2l0aW9uIC09IDFcbiAgICAgIG9cblxuICAjXG4gICMgQG5vZG9jXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBUZXh0VHlwZS10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBUZXh0VHlwZVxuICAjXG4gIGNsYXNzIHR5cGVzLlJlcGxhY2VNYW5hZ2VyIGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gZXZlbnRfcHJvcGVydGllcyBEZWNvcmF0ZXMgdGhlIGV2ZW50IHRoYXQgaXMgdGhyb3duIGJ5IHRoZSBSTVxuICAgICMgQHBhcmFtIHtPYmplY3R9IGV2ZW50X3RoaXMgVGhlIG9iamVjdCBvbiB3aGljaCB0aGUgZXZlbnQgc2hhbGwgYmUgZXhlY3V0ZWRcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChAZXZlbnRfcHJvcGVydGllcywgQGV2ZW50X3RoaXMsIHVpZCwgYmVnaW5uaW5nLCBlbmQpLT5cbiAgICAgIGlmIG5vdCBAZXZlbnRfcHJvcGVydGllc1snb2JqZWN0J10/XG4gICAgICAgIEBldmVudF9wcm9wZXJ0aWVzWydvYmplY3QnXSA9IEBldmVudF90aGlzXG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kXG5cbiAgICB0eXBlOiBcIlJlcGxhY2VNYW5hZ2VyXCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGJlZ2lubmluZ1xuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIFRoaXMgZG9lc24ndCB0aHJvdyB0aGUgc2FtZSBldmVudHMgYXMgdGhlIExpc3RNYW5hZ2VyLiBUaGVyZWZvcmUsIHRoZVxuICAgICMgUmVwbGFjZWFibGVzIGFsc28gbm90IHRocm93IHRoZSBzYW1lIGV2ZW50cy5cbiAgICAjIFNvLCBSZXBsYWNlTWFuYWdlciBhbmQgTGlzdE1hbmFnZXIgYm90aCBpbXBsZW1lbnRcbiAgICAjIHRoZXNlIGZ1bmN0aW9ucyB0aGF0IGFyZSBjYWxsZWQgd2hlbiBhbiBJbnNlcnRpb24gaXMgZXhlY3V0ZWQgKGF0IHRoZSBlbmQpLlxuICAgICNcbiAgICAjXG4gICAgY2FsbEV2ZW50RGVjb3JhdG9yOiAoZXZlbnRzKS0+XG4gICAgICBpZiBub3QgQGlzRGVsZXRlZCgpXG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBmb3IgbmFtZSxwcm9wIG9mIEBldmVudF9wcm9wZXJ0aWVzXG4gICAgICAgICAgICBldmVudFtuYW1lXSA9IHByb3BcbiAgICAgICAgQGV2ZW50X3RoaXMuY2FsbEV2ZW50IGV2ZW50c1xuICAgICAgdW5kZWZpbmVkXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgIyBAcGFyYW0gY29udGVudCB7T3BlcmF0aW9ufSBUaGUgbmV3IHZhbHVlIG9mIHRoaXMgUmVwbGFjZU1hbmFnZXIuXG4gICAgIyBAcGFyYW0gcmVwbGFjZWFibGVfdWlkIHtVSUR9IE9wdGlvbmFsOiBVbmlxdWUgaWQgb2YgdGhlIFJlcGxhY2VhYmxlIHRoYXQgaXMgY3JlYXRlZFxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCwgcmVwbGFjZWFibGVfdWlkKS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgcmVscCA9IChuZXcgdHlwZXMuUmVwbGFjZWFibGUgY29udGVudCwgQCwgcmVwbGFjZWFibGVfdWlkLCBvLCBvLm5leHRfY2wpLmV4ZWN1dGUoKVxuICAgICAgIyBUT0RPOiBkZWxldGUgcmVwbCAoZm9yIGRlYnVnZ2luZylcbiAgICAgIHVuZGVmaW5lZFxuXG4gICAgaXNDb250ZW50RGVsZXRlZDogKCktPlxuICAgICAgQGdldExhc3RPcGVyYXRpb24oKS5pc0RlbGV0ZWQoKVxuXG4gICAgZGVsZXRlQ29udGVudDogKCktPlxuICAgICAgKG5ldyB0eXBlcy5EZWxldGUgdW5kZWZpbmVkLCBAZ2V0TGFzdE9wZXJhdGlvbigpLnVpZCkuZXhlY3V0ZSgpXG4gICAgICB1bmRlZmluZWRcblxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpc1xuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICAjaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAjIHRocm93IG5ldyBFcnJvciBcIlJlcGxhY2UgTWFuYWdlciBkb2Vzbid0IGNvbnRhaW4gYW55dGhpbmcuXCJcbiAgICAgIG8udmFsPygpICMgPyAtIGZvciB0aGUgY2FzZSB0aGF0IChjdXJyZW50bHkpIHRoZSBSTSBkb2VzIG5vdCBjb250YWluIGFueXRoaW5nICh0aGVuIG8gaXMgYSBEZWxpbWl0ZXIpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdiZWdpbm5pbmcnIDogQGJlZ2lubmluZy5nZXRVaWQoKVxuICAgICAgICAgICdlbmQnIDogQGVuZC5nZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBqc29uXG5cbiAgI1xuICAjIEBub2RvY1xuICAjIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlcy5cbiAgIyBAc2VlIFJlcGxhY2VNYW5hZ2VyXG4gICNcbiAgY2xhc3MgdHlwZXMuUmVwbGFjZWFibGUgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBjb250ZW50IFRoZSB2YWx1ZSB0aGF0IHRoaXMgUmVwbGFjZWFibGUgaG9sZHMuXG4gICAgIyBAcGFyYW0ge1JlcGxhY2VNYW5hZ2VyfSBwYXJlbnQgVXNlZCB0byByZXBsYWNlIHRoaXMgUmVwbGFjZWFibGUgd2l0aCBhbm90aGVyIG9uZS5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luLCBpc19kZWxldGVkKS0+XG4gICAgICAjIHNlZSBlbmNvZGUgdG8gc2VlLCB3aHkgd2UgYXJlIGRvaW5nIGl0IHRoaXMgd2F5XG4gICAgICBpZiBjb250ZW50PyBhbmQgY29udGVudC5jcmVhdG9yP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQgPSBjb250ZW50XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncGFyZW50JywgcGFyZW50XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiAjIFBhcmVudCBpcyBhbHJlYWR5IHNhdmVkIGJ5IFJlcGxhY2VhYmxlXG4gICAgICBAaXNfZGVsZXRlZCA9IGlzX2RlbGV0ZWRcblxuICAgIHR5cGU6IFwiUmVwbGFjZWFibGVcIlxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICByZXMgPSBzdXBlclxuICAgICAgaWYgQGNvbnRlbnQ/XG4gICAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXNudCBcIkRlbGltaXRlclwiXG4gICAgICAgICAgQGNvbnRlbnQuZGVsZXRlQWxsT2JzZXJ2ZXJzPygpXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlPygpXG4gICAgICAgIEBjb250ZW50LmRvbnRTeW5jPygpXG4gICAgICBAY29udGVudCA9IG51bGxcbiAgICAgIHJlc1xuXG4gICAgY2xlYW51cDogKCktPlxuICAgICAgc3VwZXJcblxuICAgICNcbiAgICAjIFRoaXMgaXMgY2FsbGVkLCB3aGVuIHRoZSBJbnNlcnQtdHlwZSB3YXMgc3VjY2Vzc2Z1bGx5IGV4ZWN1dGVkLlxuICAgICMgVE9ETzogY29uc2lkZXIgZG9pbmcgdGhpcyBpbiBhIG1vcmUgY29uc2lzdGVudCBtYW5uZXIuIFRoaXMgY291bGQgYWxzbyBiZVxuICAgICMgZG9uZSB3aXRoIGV4ZWN1dGUuIEJ1dCBjdXJyZW50bHksIHRoZXJlIGFyZSBubyBzcGVjaXRhbCBJbnNlcnQtdHlwZXMgZm9yIExpc3RNYW5hZ2VyLlxuICAgICNcbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNJbnNlcnRFdmVudHM6ICgpLT5cbiAgICAgIGlmIEBuZXh0X2NsLnR5cGUgaXMgXCJEZWxpbWl0ZXJcIiBhbmQgQHByZXZfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyB0aGlzIHJlcGxhY2VzIGFub3RoZXIgUmVwbGFjZWFibGVcbiAgICAgICAgaWYgbm90IEBpc19kZWxldGVkICMgV2hlbiB0aGlzIGlzIHJlY2VpdmVkIGZyb20gdGhlIEhCLCB0aGlzIGNvdWxkIGFscmVhZHkgYmUgZGVsZXRlZCFcbiAgICAgICAgICBvbGRfdmFsdWUgPSBAcHJldl9jbC5jb250ZW50XG4gICAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgICAgdHlwZTogXCJ1cGRhdGVcIlxuICAgICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgICAgIG9sZFZhbHVlOiBvbGRfdmFsdWVcbiAgICAgICAgICBdXG4gICAgICAgIEBwcmV2X2NsLmFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgaWYgQG5leHRfY2wudHlwZSBpc250IFwiRGVsaW1pdGVyXCJcbiAgICAgICAgIyBUaGlzIHdvbid0IGJlIHJlY29nbml6ZWQgYnkgdGhlIHVzZXIsIGJlY2F1c2UgYW5vdGhlclxuICAgICAgICAjIGNvbmN1cnJlbnQgb3BlcmF0aW9uIGlzIHNldCBhcyB0aGUgY3VycmVudCB2YWx1ZSBvZiB0aGUgUk1cbiAgICAgICAgQGFwcGx5RGVsZXRlKClcbiAgICAgIGVsc2UgIyBwcmV2IF9hbmRfIG5leHQgYXJlIERlbGltaXRlcnMuIFRoaXMgaXMgdGhlIGZpcnN0IGNyZWF0ZWQgUmVwbGFjZWFibGUgaW4gdGhlIFJNXG4gICAgICAgIEBwYXJlbnQuY2FsbEV2ZW50RGVjb3JhdG9yIFtcbiAgICAgICAgICB0eXBlOiBcImFkZFwiXG4gICAgICAgICAgY2hhbmdlZEJ5OiBAdWlkLmNyZWF0b3JcbiAgICAgICAgXVxuICAgICAgdW5kZWZpbmVkXG5cbiAgICBjYWxsT3BlcmF0aW9uU3BlY2lmaWNEZWxldGVFdmVudHM6IChvKS0+XG4gICAgICBpZiBAbmV4dF9jbC50eXBlIGlzIFwiRGVsaW1pdGVyXCJcbiAgICAgICAgQHBhcmVudC5jYWxsRXZlbnREZWNvcmF0b3IgW1xuICAgICAgICAgIHR5cGU6IFwiZGVsZXRlXCJcbiAgICAgICAgICBjaGFuZ2VkQnk6IG8udWlkLmNyZWF0b3JcbiAgICAgICAgICBvbGRWYWx1ZTogQGNvbnRlbnRcbiAgICAgICAgXVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICAgJ3BhcmVudCcgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAnb3JpZ2luJyA6IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAgICdpc19kZWxldGVkJzogQGlzX2RlbGV0ZWRcbiAgICAgICAgfVxuICAgICAgaWYgQGNvbnRlbnQgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAganNvblsnY29udGVudCddID0gQGNvbnRlbnQuZ2V0VWlkKClcbiAgICAgIGVsc2VcbiAgICAgICAgIyBUaGlzIGNvdWxkIGJlIGEgc2VjdXJpdHkgY29uY2Vybi5cbiAgICAgICAgIyBUaHJvdyBlcnJvciBpZiB0aGUgdXNlcnMgd2FudHMgdG8gdHJpY2sgdXNcbiAgICAgICAgaWYgQGNvbnRlbnQ/IGFuZCBAY29udGVudC5jcmVhdG9yP1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG5vdCBzZXQgY3JlYXRvciBoZXJlIVwiXG4gICAgICAgIGpzb25bJ2NvbnRlbnQnXSA9IEBjb250ZW50XG4gICAgICBqc29uXG5cbiAgdHlwZXMuUmVwbGFjZWFibGUucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ3ByZXYnOiBwcmV2XG4gICAgICAnbmV4dCc6IG5leHRcbiAgICAgICdvcmlnaW4nIDogb3JpZ2luXG4gICAgICAnaXNfZGVsZXRlZCc6IGlzX2RlbGV0ZWRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIGlzX2RlbGV0ZWQpXG5cblxuICBiYXNpY190eXBlc1xuXG5cblxuXG5cblxuIiwic3RydWN0dXJlZF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vU3RydWN0dXJlZFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgc3RydWN0dXJlZF90eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHN0cnVjdHVyZWRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gc3RydWN0dXJlZF90eXBlcy5wYXJzZXJcblxuICAjXG4gICMgQG5vZG9jXG4gICMgRXh0ZW5kcyB0aGUgYmFzaWMgSW5zZXJ0IHR5cGUgdG8gYW4gb3BlcmF0aW9uIHRoYXQgaG9sZHMgYSB0ZXh0IHZhbHVlXG4gICNcbiAgY2xhc3MgdHlwZXMuVGV4dEluc2VydCBleHRlbmRzIHR5cGVzLkluc2VydFxuICAgICNcbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50IFRoZSBjb250ZW50IG9mIHRoaXMgSW5zZXJ0LXR5cGUgT3BlcmF0aW9uLiBVc3VhbGx5IHlvdSByZXN0cmljdCB0aGUgbGVuZ3RoIG9mIGNvbnRlbnQgdG8gc2l6ZSAxXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4sIHBhcmVudCktPlxuICAgICAgaWYgY29udGVudD8uY3JlYXRvclxuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQgPSBjb250ZW50XG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgcGFyZW50XG5cbiAgICB0eXBlOiBcIlRleHRJbnNlcnRcIlxuXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgYXBwbHlEZWxldGU6ICgpLT5cbiAgICAgIHN1cGVyICMgbm8gYnJhY2VzIGluZGVlZCFcbiAgICAgIGlmIEBjb250ZW50IGluc3RhbmNlb2YgdHlwZXMuT3BlcmF0aW9uXG4gICAgICAgIEBjb250ZW50LmFwcGx5RGVsZXRlKClcbiAgICAgIEBjb250ZW50ID0gbnVsbFxuXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICBpZiBAY29udGVudCBpbnN0YW5jZW9mIHR5cGVzLk9wZXJhdGlvblxuICAgICAgICAgIEBjb250ZW50Lmluc2VydF9wYXJlbnQgPSBAXG4gICAgICAgIHN1cGVyKClcblxuICAgICNcbiAgICAjIFRoZSByZXN1bHQgd2lsbCBiZSBjb25jYXRlbmF0ZWQgd2l0aCB0aGUgcmVzdWx0cyBmcm9tIHRoZSBvdGhlciBpbnNlcnQgb3BlcmF0aW9uc1xuICAgICMgaW4gb3JkZXIgdG8gcmV0cmlldmUgdGhlIGNvbnRlbnQgb2YgdGhlIGVuZ2luZS5cbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci50b0V4ZWN1dGVkQXJyYXlcbiAgICAjXG4gICAgdmFsOiAoY3VycmVudF9wb3NpdGlvbiktPlxuICAgICAgaWYgQGlzRGVsZXRlZCgpIG9yIG5vdCBAY29udGVudD9cbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAncHJldic6IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgICAgJ25leHQnOiBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICdvcmlnaW4nOiBAb3JpZ2luLmdldFVpZCgpXG4gICAgICAgICAgJ3BhcmVudCc6IEBwYXJlbnQuZ2V0VWlkKClcbiAgICAgICAgfVxuXG4gICAgICBpZiBAY29udGVudD8uZ2V0VWlkP1xuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudC5nZXRVaWQoKVxuICAgICAgZWxzZVxuICAgICAgICBqc29uWydjb250ZW50J10gPSBAY29udGVudFxuICAgICAganNvblxuXG4gIHR5cGVzLlRleHRJbnNlcnQucGFyc2UgPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdwYXJlbnQnIDogcGFyZW50XG4gICAgfSA9IGpzb25cbiAgICBuZXcgdHlwZXMuVGV4dEluc2VydCBjb250ZW50LCB1aWQsIHByZXYsIG5leHQsIG9yaWdpbiwgcGFyZW50XG5cblxuICBjbGFzcyB0eXBlcy5BcnJheSBleHRlbmRzIHR5cGVzLkxpc3RNYW5hZ2VyXG5cbiAgICB0eXBlOiBcIkFycmF5XCJcblxuICAgIGFwcGx5RGVsZXRlOiAoKS0+XG4gICAgICBvID0gQGVuZFxuICAgICAgd2hpbGUgbz9cbiAgICAgICAgby5hcHBseURlbGV0ZSgpXG4gICAgICAgIG8gPSBvLnByZXZfY2xcbiAgICAgIHN1cGVyKClcblxuICAgIGNsZWFudXA6ICgpLT5cbiAgICAgIHN1cGVyKClcblxuICAgIHRvSnNvbjogKHRyYW5zZm9ybV90b192YWx1ZSA9IGZhbHNlKS0+XG4gICAgICB2YWwgPSBAdmFsKClcbiAgICAgIGZvciBpLCBvIGluIHZhbFxuICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuT2JqZWN0XG4gICAgICAgICAgby50b0pzb24odHJhbnNmb3JtX3RvX3ZhbHVlKVxuICAgICAgICBlbHNlIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5BcnJheVxuICAgICAgICAgIG8udG9Kc29uKHRyYW5zZm9ybV90b192YWx1ZSlcbiAgICAgICAgZWxzZSBpZiB0cmFuc2Zvcm1fdG9fdmFsdWUgYW5kIG8gaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgICBvLnZhbCgpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICBvXG5cbiAgICB2YWw6IChwb3MpLT5cbiAgICAgIGlmIHBvcz9cbiAgICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uKHBvcysxKVxuICAgICAgICBpZiBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwidGhpcyBwb3NpdGlvbiBkb2VzIG5vdCBleGlzdFwiXG4gICAgICBlbHNlXG4gICAgICAgIG8gPSBAYmVnaW5uaW5nLm5leHRfY2xcbiAgICAgICAgcmVzdWx0ID0gW11cbiAgICAgICAgd2hpbGUgbyBpc250IEBlbmRcbiAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgcmVzdWx0LnB1c2ggby52YWwoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgcmVzdWx0XG5cbiAgICBwdXNoOiAoY29udGVudCktPlxuICAgICAgQGluc2VydEFmdGVyIEBlbmQucHJldl9jbCwgY29udGVudFxuXG4gICAgaW5zZXJ0QWZ0ZXI6IChsZWZ0LCBjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICBjcmVhdGVDb250ZW50ID0gKGNvbnRlbnQsIG9wdGlvbnMpLT5cbiAgICAgICAgaWYgY29udGVudD8gYW5kIGNvbnRlbnQuY29uc3RydWN0b3I/XG4gICAgICAgICAgdHlwZSA9IHR5cGVzW2NvbnRlbnQuY29uc3RydWN0b3IubmFtZV1cbiAgICAgICAgICBpZiB0eXBlPyBhbmQgdHlwZS5jcmVhdGU/XG4gICAgICAgICAgICB0eXBlLmNyZWF0ZSBjb250ZW50LCBvcHRpb25zXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiVGhlICN7Y29udGVudC5jb25zdHJ1Y3Rvci5uYW1lfS10eXBlIGlzIG5vdCAoeWV0KSBzdXBwb3J0ZWQgaW4gWS5cIlxuICAgICAgICBlbHNlXG4gICAgICAgICAgY29udGVudFxuXG4gICAgICByaWdodCA9IGxlZnQubmV4dF9jbFxuICAgICAgd2hpbGUgcmlnaHQuaXNEZWxldGVkKClcbiAgICAgICAgcmlnaHQgPSByaWdodC5uZXh0X2NsICMgZmluZCB0aGUgZmlyc3QgY2hhcmFjdGVyIHRvIHRoZSByaWdodCwgdGhhdCBpcyBub3QgZGVsZXRlZC4gSW4gdGhlIGNhc2UgdGhhdCBwb3NpdGlvbiBpcyAwLCBpdHMgdGhlIERlbGltaXRlci5cbiAgICAgIGxlZnQgPSByaWdodC5wcmV2X2NsXG5cbiAgICAgIGlmIGNvbnRlbnQgaW5zdGFuY2VvZiB0eXBlcy5PcGVyYXRpb25cbiAgICAgICAgKG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNvbnRlbnQsIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgZWxzZVxuICAgICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgICAgdG1wID0gKG5ldyB0eXBlcy5UZXh0SW5zZXJ0IGNyZWF0ZUNvbnRlbnQoYywgb3B0aW9ucyksIHVuZGVmaW5lZCwgbGVmdCwgcmlnaHQpLmV4ZWN1dGUoKVxuICAgICAgICAgIGxlZnQgPSB0bXBcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtBcnJheSBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIFtjb250ZW50XSwgb3B0aW9uc1xuXG4gICAgI1xuICAgICMgRGVsZXRlcyBhIHBhcnQgb2YgdGhlIHdvcmQuXG4gICAgI1xuICAgICMgQHJldHVybiB7QXJyYXkgVHlwZX0gVGhpcyBTdHJpbmcgb2JqZWN0XG4gICAgI1xuICAgIGRlbGV0ZTogKHBvc2l0aW9uLCBsZW5ndGgpLT5cbiAgICAgIG8gPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbihwb3NpdGlvbisxKSAjIHBvc2l0aW9uIDAgaW4gdGhpcyBjYXNlIGlzIHRoZSBkZWxldGlvbiBvZiB0aGUgZmlyc3QgY2hhcmFjdGVyXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gKG5ldyB0eXBlcy5EZWxldGUgdW5kZWZpbmVkLCBvKS5leGVjdXRlKClcbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgICB3aGlsZSAobm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSkgYW5kIG8uaXNEZWxldGVkKClcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIGRlbGV0ZV9vcHMucHVzaCBkLl9lbmNvZGUoKVxuICAgICAgQFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEVuY29kZSB0aGlzIG9wZXJhdGlvbiBpbiBzdWNoIGEgd2F5IHRoYXQgaXQgY2FuIGJlIHBhcnNlZCBieSByZW1vdGUgcGVlcnMuXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIGpzb24gPSB7XG4gICAgICAgICd0eXBlJzogQHR5cGVcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgIH1cbiAgICAgIGpzb25cblxuICB0eXBlcy5BcnJheS5wYXJzZSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICB9ID0ganNvblxuICAgIG5ldyB0aGlzKHVpZClcblxuICB0eXBlcy5BcnJheS5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgbGlzdCA9IG5ldyB0eXBlcy5BcnJheSgpLmV4ZWN1dGUoKVxuICAgICAgaXRoID0gbGlzdC5nZXRPcGVyYXRpb25CeVBvc2l0aW9uIDBcbiAgICAgIGxpc3QuaW5zZXJ0QWZ0ZXIgaXRoLCBjb250ZW50XG4gICAgICBsaXN0XG4gICAgZWxzZSBpZiAobm90IG11dGFibGU/KSBvciAobXV0YWJsZSBpcyBcImltbXV0YWJsZVwiKVxuICAgICAgY29udGVudFxuICAgIGVsc2VcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlNwZWNpZnkgZWl0aGVyIFxcXCJtdXRhYmxlXFxcIiBvciBcXFwiaW1tdXRhYmxlXFxcIiEhXCJcblxuICAjXG4gICMgSGFuZGxlcyBhIFN0cmluZy1saWtlIGRhdGEgc3RydWN0dXJlcyB3aXRoIHN1cHBvcnQgZm9yIGluc2VydC9kZWxldGUgYXQgYSB3b3JkLXBvc2l0aW9uLlxuICAjIEBub3RlIEN1cnJlbnRseSwgb25seSBUZXh0IGlzIHN1cHBvcnRlZCFcbiAgI1xuICBjbGFzcyB0eXBlcy5TdHJpbmcgZXh0ZW5kcyB0eXBlcy5BcnJheVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIEB0ZXh0ZmllbGRzID0gW11cbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWRlbnRpZmllcyB0aGlzIGNsYXNzLlxuICAgICMgVXNlIGl0IHRvIGNoZWNrIHdoZXRoZXIgdGhpcyBpcyBhIHdvcmQtdHlwZSBvciBzb21ldGhpbmcgZWxzZS5cbiAgICAjXG4gICAgIyBAZXhhbXBsZVxuICAgICMgICB2YXIgeCA9IHkudmFsKCd1bmtub3duJylcbiAgICAjICAgaWYgKHgudHlwZSA9PT0gXCJTdHJpbmdcIikge1xuICAgICMgICAgIGNvbnNvbGUubG9nIEpTT04uc3RyaW5naWZ5KHgudG9Kc29uKCkpXG4gICAgIyAgIH1cbiAgICAjXG4gICAgdHlwZTogXCJTdHJpbmdcIlxuXG4gICAgI1xuICAgICMgR2V0IHRoZSBTdHJpbmctcmVwcmVzZW50YXRpb24gb2YgdGhpcyB3b3JkLlxuICAgICMgQHJldHVybiB7U3RyaW5nfSBUaGUgU3RyaW5nLXJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIFNhbWUgYXMgU3RyaW5nLnZhbFxuICAgICMgQHNlZSBTdHJpbmcudmFsXG4gICAgI1xuICAgIHRvU3RyaW5nOiAoKS0+XG4gICAgICBAdmFsKClcblxuICAgICNcbiAgICAjIEluc2VydHMgYSBzdHJpbmcgaW50byB0aGUgd29yZC5cbiAgICAjXG4gICAgIyBAcmV0dXJuIHtBcnJheSBUeXBlfSBUaGlzIFN0cmluZyBvYmplY3QuXG4gICAgI1xuICAgIGluc2VydDogKHBvc2l0aW9uLCBjb250ZW50LCBvcHRpb25zKS0+XG4gICAgICBpdGggPSBAZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbiBwb3NpdGlvblxuICAgICAgIyB0aGUgKGktMSl0aCBjaGFyYWN0ZXIuIGUuZy4gXCJhYmNcIiB0aGUgMXRoIGNoYXJhY3RlciBpcyBcImFcIlxuICAgICAgIyB0aGUgMHRoIGNoYXJhY3RlciBpcyB0aGUgbGVmdCBEZWxpbWl0ZXJcbiAgICAgIEBpbnNlcnRBZnRlciBpdGgsIGNvbnRlbnQsIG9wdGlvbnNcblxuICAgICNcbiAgICAjIEJpbmQgdGhpcyBTdHJpbmcgdG8gYSB0ZXh0ZmllbGQgb3IgaW5wdXQgZmllbGQuXG4gICAgI1xuICAgICMgQGV4YW1wbGVcbiAgICAjICAgdmFyIHRleHRib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInRleHRmaWVsZFwiKTtcbiAgICAjICAgeS5iaW5kKHRleHRib3gpO1xuICAgICNcbiAgICBiaW5kOiAodGV4dGZpZWxkLCBkb21fcm9vdCktPlxuICAgICAgZG9tX3Jvb3QgPz0gd2luZG93XG4gICAgICBpZiAobm90IGRvbV9yb290LmdldFNlbGVjdGlvbj8pXG4gICAgICAgIGRvbV9yb290ID0gd2luZG93XG5cbiAgICAgICMgZG9uJ3QgZHVwbGljYXRlIVxuICAgICAgZm9yIHQgaW4gQHRleHRmaWVsZHNcbiAgICAgICAgaWYgdCBpcyB0ZXh0ZmllbGRcbiAgICAgICAgICByZXR1cm5cbiAgICAgIGNyZWF0b3JfdG9rZW4gPSBmYWxzZTtcblxuICAgICAgd29yZCA9IEBcbiAgICAgIHRleHRmaWVsZC52YWx1ZSA9IEB2YWwoKVxuICAgICAgQHRleHRmaWVsZHMucHVzaCB0ZXh0ZmllbGRcblxuICAgICAgaWYgdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0PyBhbmQgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlP1xuICAgICAgICBjcmVhdGVSYW5nZSA9IChmaXgpLT5cbiAgICAgICAgICBsZWZ0ID0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgICAgcmlnaHQgPSB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgICAgaWYgZml4P1xuICAgICAgICAgICAgbGVmdCA9IGZpeCBsZWZ0XG4gICAgICAgICAgICByaWdodCA9IGZpeCByaWdodFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxlZnQ6IGxlZnRcbiAgICAgICAgICAgIHJpZ2h0OiByaWdodFxuICAgICAgICAgIH1cblxuICAgICAgICB3cml0ZVJhbmdlID0gKHJhbmdlKS0+XG4gICAgICAgICAgd3JpdGVDb250ZW50IHdvcmQudmFsKClcbiAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcmFuZ2UubGVmdCwgcmFuZ2UucmlnaHRcblxuICAgICAgICB3cml0ZUNvbnRlbnQgPSAoY29udGVudCktPlxuICAgICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IGNvbnRlbnRcbiAgICAgIGVsc2VcbiAgICAgICAgY3JlYXRlUmFuZ2UgPSAoZml4KS0+XG4gICAgICAgICAgcmFuZ2UgPSB7fVxuICAgICAgICAgIHMgPSBkb21fcm9vdC5nZXRTZWxlY3Rpb24oKVxuICAgICAgICAgIGNsZW5ndGggPSB0ZXh0ZmllbGQudGV4dENvbnRlbnQubGVuZ3RoXG4gICAgICAgICAgcmFuZ2UubGVmdCA9IE1hdGgubWluIHMuYW5jaG9yT2Zmc2V0LCBjbGVuZ3RoXG4gICAgICAgICAgcmFuZ2UucmlnaHQgPSBNYXRoLm1pbiBzLmZvY3VzT2Zmc2V0LCBjbGVuZ3RoXG4gICAgICAgICAgaWYgZml4P1xuICAgICAgICAgICAgcmFuZ2UubGVmdCA9IGZpeCByYW5nZS5sZWZ0XG4gICAgICAgICAgICByYW5nZS5yaWdodCA9IGZpeCByYW5nZS5yaWdodFxuXG4gICAgICAgICAgZWRpdGVkX2VsZW1lbnQgPSBzLmZvY3VzTm9kZVxuICAgICAgICAgIGlmIGVkaXRlZF9lbGVtZW50IGlzIHRleHRmaWVsZCBvciBlZGl0ZWRfZWxlbWVudCBpcyB0ZXh0ZmllbGQuY2hpbGROb2Rlc1swXVxuICAgICAgICAgICAgcmFuZ2UuaXNSZWFsID0gdHJ1ZVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJhbmdlLmlzUmVhbCA9IGZhbHNlXG4gICAgICAgICAgcmFuZ2VcblxuICAgICAgICB3cml0ZVJhbmdlID0gKHJhbmdlKS0+XG4gICAgICAgICAgd3JpdGVDb250ZW50IHdvcmQudmFsKClcbiAgICAgICAgICB0ZXh0bm9kZSA9IHRleHRmaWVsZC5jaGlsZE5vZGVzWzBdXG4gICAgICAgICAgaWYgcmFuZ2UuaXNSZWFsIGFuZCB0ZXh0bm9kZT9cbiAgICAgICAgICAgIGlmIHJhbmdlLmxlZnQgPCAwXG4gICAgICAgICAgICAgIHJhbmdlLmxlZnQgPSAwXG4gICAgICAgICAgICByYW5nZS5yaWdodCA9IE1hdGgubWF4IHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0XG4gICAgICAgICAgICBpZiByYW5nZS5yaWdodCA+IHRleHRub2RlLmxlbmd0aFxuICAgICAgICAgICAgICByYW5nZS5yaWdodCA9IHRleHRub2RlLmxlbmd0aFxuICAgICAgICAgICAgcmFuZ2UubGVmdCA9IE1hdGgubWluIHJhbmdlLmxlZnQsIHJhbmdlLnJpZ2h0XG4gICAgICAgICAgICByID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKVxuICAgICAgICAgICAgci5zZXRTdGFydCh0ZXh0bm9kZSwgcmFuZ2UubGVmdClcbiAgICAgICAgICAgIHIuc2V0RW5kKHRleHRub2RlLCByYW5nZS5yaWdodClcbiAgICAgICAgICAgIHMgPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKClcbiAgICAgICAgICAgIHMucmVtb3ZlQWxsUmFuZ2VzKClcbiAgICAgICAgICAgIHMuYWRkUmFuZ2UocilcbiAgICAgICAgd3JpdGVDb250ZW50ID0gKGNvbnRlbnQpLT5cbiAgICAgICAgICBhcHBlbmQgPSBcIlwiXG4gICAgICAgICAgaWYgY29udGVudFtjb250ZW50Lmxlbmd0aCAtIDFdIGlzIFwiIFwiXG4gICAgICAgICAgICBjb250ZW50ID0gY29udGVudC5zbGljZSgwLGNvbnRlbnQubGVuZ3RoLTEpXG4gICAgICAgICAgICBhcHBlbmQgPSAnJm5ic3A7J1xuICAgICAgICAgIHRleHRmaWVsZC50ZXh0Q29udGVudCA9IGNvbnRlbnRcbiAgICAgICAgICB0ZXh0ZmllbGQuaW5uZXJIVE1MICs9IGFwcGVuZFxuXG4gICAgICB3cml0ZUNvbnRlbnQgdGhpcy52YWwoKVxuXG4gICAgICBAb2JzZXJ2ZSAoZXZlbnRzKS0+XG4gICAgICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgICAgICBpZiBub3QgY3JlYXRvcl90b2tlblxuICAgICAgICAgICAgaWYgZXZlbnQudHlwZSBpcyBcImluc2VydFwiXG4gICAgICAgICAgICAgIG9fcG9zID0gZXZlbnQucG9zaXRpb25cbiAgICAgICAgICAgICAgZml4ID0gKGN1cnNvciktPlxuICAgICAgICAgICAgICAgIGlmIGN1cnNvciA8PSBvX3Bvc1xuICAgICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgY3Vyc29yICs9IDFcbiAgICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICByID0gY3JlYXRlUmFuZ2UgZml4XG4gICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAgICAgICBlbHNlIGlmIGV2ZW50LnR5cGUgaXMgXCJkZWxldGVcIlxuICAgICAgICAgICAgICBvX3BvcyA9IGV2ZW50LnBvc2l0aW9uXG4gICAgICAgICAgICAgIGZpeCA9IChjdXJzb3IpLT5cbiAgICAgICAgICAgICAgICBpZiBjdXJzb3IgPCBvX3Bvc1xuICAgICAgICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgY3Vyc29yIC09IDFcbiAgICAgICAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgICAgICByID0gY3JlYXRlUmFuZ2UgZml4XG4gICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAjIGNvbnN1bWUgYWxsIHRleHQtaW5zZXJ0IGNoYW5nZXMuXG4gICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlwcmVzcyA9IG51bGxcbiAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICBjcmVhdG9yX3Rva2VuID0gdHJ1ZVxuICAgICAgICBjaGFyID0gbnVsbFxuICAgICAgICBpZiBldmVudC5rZXk/XG4gICAgICAgICAgaWYgZXZlbnQuY2hhckNvZGUgaXMgMzJcbiAgICAgICAgICAgIGNoYXIgPSBcIiBcIlxuICAgICAgICAgIGVsc2UgaWYgZXZlbnQua2V5Q29kZSBpcyAxM1xuICAgICAgICAgICAgY2hhciA9ICdcXG4nXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgY2hhciA9IGV2ZW50LmtleVxuICAgICAgICBlbHNlXG4gICAgICAgICAgY2hhciA9IHdpbmRvdy5TdHJpbmcuZnJvbUNoYXJDb2RlIGV2ZW50LmtleUNvZGVcbiAgICAgICAgaWYgY2hhci5sZW5ndGggPiAxXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZWxzZSBpZiBjaGFyLmxlbmd0aCA+IDBcbiAgICAgICAgICByID0gY3JlYXRlUmFuZ2UoKVxuICAgICAgICAgIHBvcyA9IE1hdGgubWluIHIubGVmdCwgci5yaWdodFxuICAgICAgICAgIGRpZmYgPSBNYXRoLmFicyhyLnJpZ2h0IC0gci5sZWZ0KVxuICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgIHdvcmQuaW5zZXJ0IHBvcywgY2hhclxuICAgICAgICAgIHIubGVmdCA9IHBvcyArIGNoYXIubGVuZ3RoXG4gICAgICAgICAgci5yaWdodCA9IHIubGVmdFxuICAgICAgICAgIHdyaXRlUmFuZ2UgclxuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgY3JlYXRvcl90b2tlbiA9IGZhbHNlXG4gICAgICAgIGZhbHNlXG5cbiAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gKGV2ZW50KS0+XG4gICAgICAgIGlmIHdvcmQuaXNfZGVsZXRlZFxuICAgICAgICAgICMgaWYgd29yZCBpcyBkZWxldGVkLCBkbyBub3QgZG8gYW55dGhpbmcgZXZlciBhZ2FpblxuICAgICAgICAgIHRleHRmaWVsZC5vbnBhc3RlID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgIHRleHRmaWVsZC5vbmN1dCA9IChldmVudCktPlxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25jdXQgPSBudWxsXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAjXG4gICAgICAjIGNvbnN1bWUgZGVsZXRlcy4gTm90ZSB0aGF0XG4gICAgICAjICAgY2hyb21lOiB3b24ndCBjb25zdW1lIGRlbGV0aW9ucyBvbiBrZXlwcmVzcyBldmVudC5cbiAgICAgICMgICBrZXlDb2RlIGlzIGRlcHJlY2F0ZWQuIEJVVDogSSBkb24ndCBzZWUgYW5vdGhlciB3YXkuXG4gICAgICAjICAgICBzaW5jZSBldmVudC5rZXkgaXMgbm90IGltcGxlbWVudGVkIGluIHRoZSBjdXJyZW50IHZlcnNpb24gb2YgY2hyb21lLlxuICAgICAgIyAgICAgRXZlcnkgYnJvd3NlciBzdXBwb3J0cyBrZXlDb2RlLiBMZXQncyBzdGljayB3aXRoIGl0IGZvciBub3cuLlxuICAgICAgI1xuICAgICAgdGV4dGZpZWxkLm9ua2V5ZG93biA9IChldmVudCktPlxuICAgICAgICBjcmVhdG9yX3Rva2VuID0gdHJ1ZVxuICAgICAgICBpZiB3b3JkLmlzX2RlbGV0ZWRcbiAgICAgICAgICAjIGlmIHdvcmQgaXMgZGVsZXRlZCwgZG8gbm90IGRvIGFueXRoaW5nIGV2ZXIgYWdhaW5cbiAgICAgICAgICB0ZXh0ZmllbGQub25rZXlkb3duID0gbnVsbFxuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIHIgPSBjcmVhdGVSYW5nZSgpXG4gICAgICAgIHBvcyA9IE1hdGgubWluKHIubGVmdCwgci5yaWdodCwgd29yZC52YWwoKS5sZW5ndGgpXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyhyLmxlZnQgLSByLnJpZ2h0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlIHBvcywgZGlmZlxuICAgICAgICAgICAgci5sZWZ0ID0gcG9zXG4gICAgICAgICAgICByLnJpZ2h0ID0gcG9zXG4gICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBpZiBldmVudC5jdHJsS2V5PyBhbmQgZXZlbnQuY3RybEtleVxuICAgICAgICAgICAgICB2YWwgPSB3b3JkLnZhbCgpXG4gICAgICAgICAgICAgIG5ld19wb3MgPSBwb3NcbiAgICAgICAgICAgICAgZGVsX2xlbmd0aCA9IDBcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3aGlsZSBuZXdfcG9zID4gMCBhbmQgdmFsW25ld19wb3NdIGlzbnQgXCIgXCIgYW5kIHZhbFtuZXdfcG9zXSBpc250ICdcXG4nXG4gICAgICAgICAgICAgICAgbmV3X3Bvcy0tXG4gICAgICAgICAgICAgICAgZGVsX2xlbmd0aCsrXG4gICAgICAgICAgICAgIHdvcmQuZGVsZXRlIG5ld19wb3MsIChwb3MtbmV3X3BvcylcbiAgICAgICAgICAgICAgci5sZWZ0ID0gbmV3X3Bvc1xuICAgICAgICAgICAgICByLnJpZ2h0ID0gbmV3X3Bvc1xuICAgICAgICAgICAgICB3cml0ZVJhbmdlIHJcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgaWYgcG9zID4gMFxuICAgICAgICAgICAgICAgIHdvcmQuZGVsZXRlIChwb3MtMSksIDFcbiAgICAgICAgICAgICAgICByLmxlZnQgPSBwb3MtMVxuICAgICAgICAgICAgICAgIHIucmlnaHQgPSBwb3MtMVxuICAgICAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZSBwb3MsIGRpZmZcbiAgICAgICAgICAgIHIubGVmdCA9IHBvc1xuICAgICAgICAgICAgci5yaWdodCA9IHBvc1xuICAgICAgICAgICAgd3JpdGVSYW5nZSByXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgd29yZC5kZWxldGUgcG9zLCAxXG4gICAgICAgICAgICByLmxlZnQgPSBwb3NcbiAgICAgICAgICAgIHIucmlnaHQgPSBwb3NcbiAgICAgICAgICAgIHdyaXRlUmFuZ2UgclxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBjcmVhdG9yX3Rva2VuID0gZmFsc2VcbiAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNyZWF0b3JfdG9rZW4gPSBmYWxzZVxuICAgICAgICAgIHRydWVcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IEB0eXBlXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG4gICAgICBqc29uXG5cbiAgdHlwZXMuU3RyaW5nLnBhcnNlID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IHRoaXModWlkKVxuXG4gIHR5cGVzLlN0cmluZy5jcmVhdGUgPSAoY29udGVudCwgbXV0YWJsZSktPlxuICAgIGlmIChtdXRhYmxlIGlzIFwibXV0YWJsZVwiKVxuICAgICAgd29yZCA9IG5ldyB0eXBlcy5TdHJpbmcoKS5leGVjdXRlKClcbiAgICAgIHdvcmQuaW5zZXJ0IDAsIGNvbnRlbnRcbiAgICAgIHdvcmRcbiAgICBlbHNlIGlmIChub3QgbXV0YWJsZT8pIG9yIChtdXRhYmxlIGlzIFwiaW1tdXRhYmxlXCIpXG4gICAgICBjb250ZW50XG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiU3BlY2lmeSBlaXRoZXIgXFxcIm11dGFibGVcXFwiIG9yIFxcXCJpbW11dGFibGVcXFwiISFcIlxuXG5cbiAgc3RydWN0dXJlZF90eXBlc1xuXG5cbiIsIlxuanNvbl90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVHlwZXMvSnNvblR5cGVzXCJcbkhpc3RvcnlCdWZmZXIgPSByZXF1aXJlIFwiLi9IaXN0b3J5QnVmZmVyXCJcbkVuZ2luZSA9IHJlcXVpcmUgXCIuL0VuZ2luZVwiXG5hZGFwdENvbm5lY3RvciA9IHJlcXVpcmUgXCIuL0Nvbm5lY3RvckFkYXB0ZXJcIlxuXG5jcmVhdGVZID0gKGNvbm5lY3RvciktPlxuICB1c2VyX2lkID0gbnVsbFxuICBpZiBjb25uZWN0b3IudXNlcl9pZD9cbiAgICB1c2VyX2lkID0gY29ubmVjdG9yLnVzZXJfaWQgIyBUT0RPOiBjaGFuZ2UgdG8gZ2V0VW5pcXVlSWQoKVxuICBlbHNlXG4gICAgdXNlcl9pZCA9IFwiX3RlbXBcIlxuICAgIGNvbm5lY3Rvci5vbl91c2VyX2lkX3NldCA9IChpZCktPlxuICAgICAgdXNlcl9pZCA9IGlkXG4gICAgICBIQi5yZXNldFVzZXJJZCBpZFxuICBIQiA9IG5ldyBIaXN0b3J5QnVmZmVyIHVzZXJfaWRcbiAgdHlwZV9tYW5hZ2VyID0ganNvbl90eXBlc191bmluaXRpYWxpemVkIEhCXG4gIHR5cGVzID0gdHlwZV9tYW5hZ2VyLnR5cGVzXG5cbiAgI1xuICAjIEZyYW1ld29yayBmb3IgSnNvbiBkYXRhLXN0cnVjdHVyZXMuXG4gICMgS25vd24gdmFsdWVzIHRoYXQgYXJlIHN1cHBvcnRlZDpcbiAgIyAqIFN0cmluZ1xuICAjICogSW50ZWdlclxuICAjICogQXJyYXlcbiAgI1xuICBjbGFzcyBZIGV4dGVuZHMgdHlwZXMuT2JqZWN0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge1N0cmluZ30gdXNlcl9pZCBVbmlxdWUgaWQgb2YgdGhlIHBlZXIuXG4gICAgIyBAcGFyYW0ge0Nvbm5lY3Rvcn0gQ29ubmVjdG9yIHRoZSBjb25uZWN0b3IgY2xhc3MuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoKS0+XG4gICAgICBAY29ubmVjdG9yID0gY29ubmVjdG9yXG4gICAgICBASEIgPSBIQlxuICAgICAgQHR5cGVzID0gdHlwZXNcbiAgICAgIEBlbmdpbmUgPSBuZXcgRW5naW5lIEBIQiwgdHlwZV9tYW5hZ2VyLnR5cGVzXG4gICAgICBhZGFwdENvbm5lY3RvciBAY29ubmVjdG9yLCBAZW5naW5lLCBASEIsIHR5cGVfbWFuYWdlci5leGVjdXRpb25fbGlzdGVuZXJcbiAgICAgIHN1cGVyXG5cbiAgICBnZXRDb25uZWN0b3I6ICgpLT5cbiAgICAgIEBjb25uZWN0b3JcblxuICByZXR1cm4gbmV3IFkoSEIuZ2V0UmVzZXJ2ZWRVbmlxdWVJZGVudGlmaWVyKCkpLmV4ZWN1dGUoKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVlcbmlmIHdpbmRvdz8gYW5kIG5vdCB3aW5kb3cuWT9cbiAgd2luZG93LlkgPSBjcmVhdGVZXG4iXX0=
