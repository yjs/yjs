(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var createPeerJsConnector;

createPeerJsConnector = function(callback) {
  var PeerJsConnector, peer;
  peer = new Peer({
    key: 'h7nlefbgavh1tt9'
  });
  PeerJsConnector = (function() {
    function PeerJsConnector(engine, HB, execution_listener, yatta) {
      var send_;
      this.engine = engine;
      this.HB = HB;
      this.execution_listener = execution_listener;
      this.yatta = yatta;
      this.peer = peer;
      this.connections = [];
      this.peer.on('connection', (function(_this) {
        return function(conn) {
          conn.send("hey");
          return _this.addConnection(conn);
        };
      })(this));
      send_ = (function(_this) {
        return function(o) {
          return _this.send(o);
        };
      })(this);
      this.execution_listener.push(send_);
    }

    PeerJsConnector.prototype.connectToPeer = function(id) {
      return this.addConnection(peer.connect(id));
    };

    PeerJsConnector.prototype.addConnection = function(conn) {
      var sendHB;
      this.connections.push(conn);
      conn.on('data', (function(_this) {
        return function(data) {
          if (data === "hey") {

          } else if (data.HB != null) {
            return _this.engine.applyOpsCheckDouble(data.HB);
          } else if (data.op != null) {
            return _this.engine.applyOp(data.op);
          } else {
            throw new Error("Can't parse this operation");
          }
        };
      })(this));
      sendHB = (function(_this) {
        return function() {
          return conn.send({
            HB: _this.yatta.getHistoryBuffer()._encode()
          });
        };
      })(this);
      return setTimeout(sendHB, 1000);
    };

    PeerJsConnector.prototype.send = function(o) {
      var conn, _i, _len, _ref, _results;
      if (o.uid.creator === this.HB.getUserId() && (typeof o.uid.op_number !== "string")) {
        _ref = this.connections;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          conn = _ref[_i];
          _results.push(conn.send({
            op: o
          }));
        }
        return _results;
      }
    };

    PeerJsConnector.prototype.receive = function(o) {
      if (o.uid.creator !== this.HB.getUserId()) {
        return this.engine.applyOp(o);
      }
    };

    return PeerJsConnector;

  })();
  return peer.on('open', function(id) {
    return callback(PeerJsConnector, id);
  });
};

module.exports = createPeerJsConnector;

if (typeof window !== "undefined" && window !== null) {
  window.createPeerJsConnector = createPeerJsConnector;
}


},{}]},{},[1])