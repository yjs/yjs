
```js
(function() {
  var PeerJsConnector,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  window.PeerJsConnector = PeerJsConnector = (function() {
    function PeerJsConnector(id, options) {
      var exchangeConnections, joinConnections, that;
      this.id = id;
      this._addConnection = __bind(this._addConnection, this);
      that = this;
      this.isConnected = false;
      this.computeWhenConnected = [];
      this.connections = {};
      this.unsynced_connections = {};
      this.receive_handlers = [];
      this.conn = new Peer(arguments[0], arguments[1]);
      this.conn.on('error', function(err) {
        throw new Error("Peerjs connector: " + err);
      });
      this.conn.on('disconnected', function() {
        throw new Error("Peerjs connector disconnected from signalling server. Cannot accept new connections. Not fatal, but not so good either..");
      });
      this.conn.on('disconnect', function() {
        return that.conn.reconnect();
      });
      this.conn.on('connection', this._addConnection);
      exchangeConnections = function() {
        var conns, peer, peerid;
        conns = (function() {
          var _ref, _results;
          _ref = that.connections;
          _results = [];
          for (peerid in _ref) {
            peer = _ref[peerid];
            _results.push(peerid);
          }
          return _results;
        })();
        return conns;
      };
      joinConnections = function(peers) {
        var peer, _i, _len;
        for (_i = 0, _len = peers.length; _i < _len; _i++) {
          peer = peers[_i];
          if (this.unsynced_connections[peer.peer] == null) {
            this.unsynced_connections[peer.peer] = peer;
            that.join(peer);
          }
        }
        return true;
      };
      this.syncProcessOrder = [exchangeConnections, joinConnections];
    }

    PeerJsConnector.prototype.whenConnected = function(f) {
      if (this.isConnected) {
        return f.call(this);
      } else {
        return this.computeWhenConnected.push(f);
      }
    };

    PeerJsConnector.prototype.whenReceiving = function(f) {
      return this.receive_handlers.push(f);
    };

    PeerJsConnector.prototype.send = function(peers, message) {
      return this.whenConnected((function(_this) {
        return function() {
          var peer, _i, _len, _results;
          _results = [];
          for (_i = 0, _len = peers.length; _i < _len; _i++) {
            peer = peers[_i];
            _results.push(_this.connections[peer].send(message));
          }
          return _results;
        };
      })(this));
    };

    PeerJsConnector.prototype.broadcast = function(message) {
      return this.whenConnected((function(_this) {
        return function() {
          var peer, peerid, _ref, _results;
          _ref = _this.connections;
          _results = [];
          for (peerid in _ref) {
            peer = _ref[peerid];
            _results.push(peer.send(message));
          }
          return _results;
        };
      })(this));
    };

    PeerJsConnector.prototype.whenSyncing = function() {
      var f, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = arguments.length; _i < _len; _i++) {
        f = arguments[_i];
        _results.push(this.syncProcessOrder.push(f));
      }
      return _results;
    };

    PeerJsConnector.prototype.join = function(peerid) {
      var peer;
      if ((this.connections[peerid] == null) && peerid !== this.id) {
        peer = this.conn.connect(peerid, {
          reliable: true
        });
        this._addConnection(peer);
        return true;
      } else {
        return false;
      }
    };

    PeerJsConnector.prototype._addConnection = function(peer) {
      return peer.on('open', (function(_this) {
        return function() {
          var current_sync_function, current_sync_i, that;
          _this.currentlyadding = peer;
          that = _this;
          peer.send(that.syncProcessOrder[0]());
          current_sync_function = that.syncProcessOrder[1];
          current_sync_i = 0;
          return peer.on('data', function(data) {
            var f, isEmpty, _i, _j, _len, _len1, _ref, _ref1, _results;
            console.log("receive data: " + (JSON.stringify(data)));
            current_sync_i++;
            if (current_sync_i < that.syncProcessOrder.length) {
              peer.send(current_sync_function.call(that, data));
              return current_sync_function = that.syncProcessOrder[current_sync_i];
            } else if (current_sync_i === that.syncProcessOrder.length) {
              that.connections[peer.peer] = peer;
              peer.on('close', function() {
                return delete that.connections[peer.peer];
              });
              delete that.unsynced_connections[peer.peer];
              isEmpty = function(os) {
                var o;
                for (o in os) {
                  return false;
                }
                return true;
              };
              if (isEmpty(that.unsynced_connections)) {
                that.isConnected = true;
                _ref = that.computeWhenConnected;
                for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                  f = _ref[_i];
                  f.call(that);
                }
                return that.computeWhenConnected = [];
              }
            } else {
              _ref1 = that.receive_handlers;
              _results = [];
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                f = _ref1[_j];
                _results.push(f(peer.peer, data));
              }
              return _results;
            }
          });
        };
      })(this));
    };

    return PeerJsConnector;

  })();

}).call(this);

//# sourceMappingURL=sourcemaps/peerjs-connector.js.map
```
