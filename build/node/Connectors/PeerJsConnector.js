(function() {
  var createPeerJsConnector;

  createPeerJsConnector = function() {
    var PeerJsConnector, callback, peer;
    peer = null;
    if (arguments.length === 2) {
      peer = new Peer(arguments[0]);
      callback = arguments[1];
    } else {
      peer = new Peer(arguments[0], arguments[1]);
      peer.on('error', function(err) {
        throw new Error("Peerjs connector: " + err);
      });
      peer.on('disconnected', function() {
        throw new Error("Peerjs connector disconnected from signalling server. Cannot accept new connections. Not fatal, but not so good either..");
      });
      callback = arguments[2];
    }
    PeerJsConnector = (function() {
      function PeerJsConnector(engine, HB, execution_listener, yatta) {
        var send_, sync_every_collaborator;
        this.engine = engine;
        this.HB = HB;
        this.execution_listener = execution_listener;
        this.yatta = yatta;
        this.peer = peer;
        this.connections = {};
        this.peer.on('connection', (function(_this) {
          return function(conn) {
            return _this.addConnection(conn);
          };
        })(this));
        sync_every_collaborator = (function(_this) {
          return function() {
            var conn, conn_id, _ref, _results;
            _ref = _this.connections;
            _results = [];
            for (conn_id in _ref) {
              conn = _ref[conn_id];
              _results.push(conn.send({
                sync_state_vector: _this.HB.getOperationCounter()
              }));
            }
            return _results;
          };
        })(this);
        setInterval(sync_every_collaborator, 4000);
        send_ = (function(_this) {
          return function(o) {
            var conn, conn_id, _ref, _results;
            if (o.uid.creator === _this.HB.getUserId() && (typeof o.uid.op_number !== "string")) {
              _ref = _this.connections;
              _results = [];
              for (conn_id in _ref) {
                conn = _ref[conn_id];
                _results.push(conn.send({
                  op: o
                }));
              }
              return _results;
            }
          };
        })(this);
        this.execution_listener.push(send_);
      }

      PeerJsConnector.prototype.connectToPeer = function(id) {
        if ((this.connections[id] == null) && id !== this.yatta.getUserId()) {
          return this.addConnection(peer.connect(id));
        }
      };

      PeerJsConnector.prototype.getAllConnectionIds = function() {
        var conn_id, _results;
        _results = [];
        for (conn_id in this.connections) {
          _results.push(conn_id);
        }
        return _results;
      };

      PeerJsConnector.prototype.addConnection = function(conn) {
        var initialized_him, initialized_me, sendStateVector;
        this.connections[conn.peer] = conn;
        initialized_me = false;
        initialized_him = false;
        conn.on('data', (function(_this) {
          return function(data) {
            var conn_id, _i, _len, _ref, _results;
            if (data === "empty_message") {

            } else if (data.HB != null) {
              initialized_me = true;
              _this.engine.applyOpsCheckDouble(data.HB);
              if (!data.initialized) {
                return conn.send({
                  conns: _this.getAllConnectionIds()
                });
              }
            } else if (data.op != null) {
              return _this.engine.applyOp(data.op);
            } else if (data.conns != null) {
              _ref = data.conns;
              _results = [];
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                conn_id = _ref[_i];
                _results.push(_this.connectToPeer(conn_id));
              }
              return _results;
            } else if (data.sync_state_vector != null) {
              return conn.send({
                HB: _this.yatta.getHistoryBuffer()._encode(data.sync_state_vector),
                initialized: true
              });
            } else if (data.state_vector != null) {
              if (!initialized_him) {
                conn.send({
                  HB: _this.yatta.getHistoryBuffer()._encode(data.state_vector),
                  initialized: false
                });
                return initialized_him = true;
              }
            } else {
              throw new Error("Can't parse this operation: " + data);
            }
          };
        })(this));
        sendStateVector = (function(_this) {
          return function() {
            conn.send({
              state_vector: _this.HB.getOperationCounter()
            });
            if (!initialized_me) {
              return setTimeout(sendStateVector, 100);
            }
          };
        })(this);
        return sendStateVector();
      };

      return PeerJsConnector;

    })();
    return peer.on('open', function(id) {
      return callback(PeerJsConnector, id);
    });
  };

  module.exports = createPeerJsConnector;

  if (typeof window !== "undefined" && window !== null) {
    if (window.Y == null) {
      window.Y = {};
    }
    window.Y.createPeerJsConnector = createPeerJsConnector;
  }

}).call(this);

//# sourceMappingURL=../Connectors/PeerJsConnector.js.map