(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
      this.new_connection_listeners = [];
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

    PeerJsConnector.prototype.onNewConnection = function(f) {
      return this.new_connection_listeners.push(f);
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
              conn.send({
                conns: _this.getAllConnectionIds()
              });
              return _this.new_connection_listeners.map(function(f) {
                return f(conn);
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


},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvbGliL0Nvbm5lY3RvcnMvUGVlckpzQ29ubmVjdG9yLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ1VBLElBQUEscUJBQUE7O0FBQUEscUJBQUEsR0FBd0IsU0FBQSxHQUFBO0FBQ3RCLE1BQUEsK0JBQUE7QUFBQSxFQUFBLElBQUEsR0FBTyxJQUFQLENBQUE7QUFDQSxFQUFBLElBQUcsU0FBUyxDQUFDLE1BQVYsS0FBb0IsQ0FBdkI7QUFDRSxJQUFBLElBQUEsR0FBVyxJQUFBLElBQUEsQ0FBSyxTQUFVLENBQUEsQ0FBQSxDQUFmLENBQVgsQ0FBQTtBQUFBLElBQ0EsUUFBQSxHQUFXLFNBQVUsQ0FBQSxDQUFBLENBRHJCLENBREY7R0FBQSxNQUFBO0FBSUUsSUFBQSxJQUFBLEdBQVcsSUFBQSxJQUFBLENBQUssU0FBVSxDQUFBLENBQUEsQ0FBZixFQUFtQixTQUFVLENBQUEsQ0FBQSxDQUE3QixDQUFYLENBQUE7QUFBQSxJQUNBLElBQUksQ0FBQyxFQUFMLENBQVEsT0FBUixFQUFpQixTQUFDLEdBQUQsR0FBQTtBQUNmLFlBQVUsSUFBQSxLQUFBLENBQU8sb0JBQUEsR0FBbUIsR0FBMUIsQ0FBVixDQURlO0lBQUEsQ0FBakIsQ0FEQSxDQUFBO0FBQUEsSUFHQSxJQUFJLENBQUMsRUFBTCxDQUFRLGNBQVIsRUFBd0IsU0FBQSxHQUFBO0FBQ3RCLFlBQVUsSUFBQSxLQUFBLENBQU0sMEhBQU4sQ0FBVixDQURzQjtJQUFBLENBQXhCLENBSEEsQ0FBQTtBQUFBLElBS0EsUUFBQSxHQUFXLFNBQVUsQ0FBQSxDQUFBLENBTHJCLENBSkY7R0FEQTtBQUFBLEVBa0JNO0FBUVMsSUFBQSx5QkFBRSxN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QUg7QUFDRSxFQUFBLElBQU8sZ0JBQVA7QUFDRSxJQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsRUFBWCxDQURGO0dBQUE7QUFBQSxFQUVBLE1BQU0sQ0FBQyxDQUFDLENBQUMscUJBQVQsR0FBaUMscUJBRmpDLENBREY7Q0F4SUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4jXG4jIEBvdmVybG9hZCBjcmVhdGVQZWVySnNDb25uZWN0b3IgcGVlcmpzX29wdGlvbnMsIGNhbGxiYWNrXG4jICAgQHBhcmFtIHtPYmplY3R9IHBlZXJqc19vcHRpb25zIElzIHRoZSBvcHRpb25zIG9iamVjdCB0aGF0IGlzIHBhc3NlZCB0byBQZWVySnMuXG4jICAgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSBjb25uZWN0b3IgaXMgaW5pdGlhbGl6ZWQuXG4jIEBvdmVybG9hZCBjcmVhdGVQZWVySnNDb25uZWN0b3IgcGVlcmpzX3VzZXJfaWQsIHBlZXJqc19vcHRpb25zLCBjYWxsYmFja1xuIyAgIEBwYXJhbSB7U3RyaW5nfSBwZWVyanNfdXNlcl9pZCBUaGUgdXNlcl9pZCB0aGF0IGlzIHBhc3NlZCB0byBQZWVySnMgYXMgdGhlIHVzZXJfaWQgYW5kIHNob3VsZCBiZSB1bmlxdWUgYmV0d2VlbiBhbGwgKGFsc28gdGhlIHVuY29ubmVjdGVkKSBQZWVycy5cbiMgICBAcGFyYW0ge09iamVjdH0gcGVlcmpzX29wdGlvbnMgSXMgdGhlIG9wdGlvbnMgb2JqZWN0IHRoYXQgaXMgcGFzc2VkIHRvIFBlZXJKcy5cbiMgICBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbm5lY3RvciBpcyBpbml0aWFsaXplZC5cbiNcbmNyZWF0ZVBlZXJKc0Nvbm5lY3RvciA9ICgpLT5cbiAgcGVlciA9IG51bGxcbiAgaWYgYXJndW1lbnRzLmxlbmd0aCBpcyAyXG4gICAgcGVlciA9IG5ldyBQZWVyIGFyZ3VtZW50c1swXVxuICAgIGNhbGxiYWNrID0gYXJndW1lbnRzWzFdXG4gIGVsc2VcbiAgICBwZWVyID0gbmV3IFBlZXIgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV1cbiAgICBwZWVyLm9uICdlcnJvcicsIChlcnIpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlBlZXJqcyBjb25uZWN0b3I6ICN7ZXJyfVwiXG4gICAgcGVlci5vbiAnZGlzY29ubmVjdGVkJywgKCktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUGVlcmpzIGNvbm5lY3RvciBkaXNjb25uZWN0ZWQgZnJvbSBzaWduYWxsaW5nIHNlcnZlci4gQ2Fubm90IGFjY2VwdCBuZXcgY29ubmVjdGlvbnMuIE5vdCBmYXRhbCwgYnV0IG5vdCBzbyBnb29kIGVpdGhlci4uXCJcbiAgICBjYWxsYmFjayA9IGFyZ3VtZW50c1syXVxuXG5cbiAgI1xuICAjIFBlZXJKcyBpcyBhIEZyYW1ld29yayB0aGF0IGVuYWJsZXMgeW91IHRvIGNvbm5lY3QgdG8gb3RoZXIgcGVlcnMuIFlvdSBqdXN0IG5lZWQgdGhlXG4gICMgdXNlci1pZCBvZiB0aGUgcGVlciAoYnJvd3Nlci9jbGllbnQpLiBBbmQgdGhlbiB5b3UgY2FuIGNvbm5lY3QgdG8gaXQuXG4gICMgQHNlZSBodHRwOi8vcGVlcmpzLmNvbVxuICAjXG4gIGNsYXNzIFBlZXJKc0Nvbm5lY3RvclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4gICAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICAgIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4gICAgIyBAcGFyYW0ge1lhdHRhfSB5YXR0YSBUaGUgWWF0dGEgZnJhbWV3b3JrLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBlbmdpbmUsIEBIQiwgQGV4ZWN1dGlvbl9saXN0ZW5lciwgQHlhdHRhKS0+XG5cbiAgICAgIEBwZWVyID0gcGVlclxuICAgICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAgIEBuZXdfY29ubmVjdGlvbl9saXN0ZW5lcnMgPSBbXVxuXG4gICAgICBAcGVlci5vbiAnY29ubmVjdGlvbicsIChjb25uKT0+XG4gICAgICAgIEBhZGRDb25uZWN0aW9uIGNvbm5cblxuICAgICAgc3luY19ldmVyeV9jb2xsYWJvcmF0b3IgPSAoKT0+XG4gICAgICAgIGZvciBjb25uX2lkLCBjb25uIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgc3luY19zdGF0ZV92ZWN0b3I6IEBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICAgIHNldEludGVydmFsIHN5bmNfZXZlcnlfY29sbGFib3JhdG9yLCA0MDAwXG5cbiAgICAgIHNlbmRfID0gKG8pPT5cbiAgICAgICAgaWYgby51aWQuY3JlYXRvciBpcyBASEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgICAgICBmb3IgY29ubl9pZCxjb25uIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICAgICAgY29ubi5zZW5kXG4gICAgICAgICAgICAgIG9wOiBvXG4gICAgICBAZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cblxuXG5cblxuICAgICNcbiAgICAjIENvbm5lY3QgdGhlIEZyYW1ld29yayB0byBhbm90aGVyIHBlZXIuIFRoZXJlZm9yZSB5b3UgaGF2ZSB0byByZWNlaXZlIGhpc1xuICAgICMgdXNlcl9pZC4gSWYgdGhlIG90aGVyIHBlZXIgaXMgY29ubmVjdGVkIHRvIG90aGVyIHBlZXJzLCB0aGUgUGVlckpzQ29ubmVjdG9yXG4gICAgIyB3aWxsIGF1dG9tYXRpY2FsbHkgY29ubmVjdCB0byB0aGVtIHRvby5cbiAgICAjXG4gICAgIyBUcmFuc21pdHRpbmcgdGhlIHVzZXJfaWQgaXMgeW91ciBqb2IuXG4gICAgIyBTZWUgW1RleHRFZGl0aW5nXSguLi8uLi9leGFtcGxlcy9UZXh0RWRpdGluZy8pIGZvciBhIG5pY2UgZXhhbXBsZVxuICAgICMgb24gaG93IHRvIGRvIHRoYXQgd2l0aCB1cmxzLlxuICAgICNcbiAgICAjIEBwYXJhbSBpZCB7U3RyaW5nfSBDb25uZWN0aW9uIGlkXG4gICAgI1xuICAgIGNvbm5lY3RUb1BlZXI6IChpZCktPlxuICAgICAgaWYgbm90IEBjb25uZWN0aW9uc1tpZF0/IGFuZCBpZCBpc250IEB5YXR0YS5nZXRVc2VySWQoKVxuICAgICAgICBAYWRkQ29ubmVjdGlvbiBwZWVyLmNvbm5lY3QgaWRcblxuICAgICNcbiAgICAjIFJlY2VpdmUgdGhlIGlkIG9mIGV2ZXJ5IGNvbm5lY3RlZCBwZWVyLlxuICAgICMgQHJldHVybiB7QXJyYXk8U3RyaW5nPn0gQSBsaXN0IG9mIFBlZXItSWRzXG4gICAgI1xuICAgIGdldEFsbENvbm5lY3Rpb25JZHM6ICgpLT5cbiAgICAgIGZvciBjb25uX2lkIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBjb25uX2lkXG5cbiAgICBvbk5ld0Nvbm5lY3Rpb246IChmKS0+XG4gICAgICBAbmV3X2Nvbm5lY3Rpb25fbGlzdGVuZXJzLnB1c2ggZlxuXG4gICAgI1xuICAgICMgQWRkcyBhbiBleGlzdGluZyBjb25uZWN0aW9uIHRvIHRoaXMgY29ubmVjdG9yLlxuICAgICMgQHBhcmFtIGNvbm4ge1BlZXJKc0Nvbm5lY3Rpb259XG4gICAgI1xuICAgIGFkZENvbm5lY3Rpb246IChjb25uKS0+XG4gICAgICAjXG4gICAgICAjIFdoYXQgdGhpcyBtZXRob2QgZG9lczpcbiAgICAgICMgKiBTZW5kIHN0YXRlIHZlY3RvclxuICAgICAgIyAqIFJlY2VpdmUgSEIgLT4gYXBwbHkgdGhlbVxuICAgICAgIyAqIFNlbmQgY29ubmVjdGlvbnNcbiAgICAgICMgKiBSZWNlaXZlIENvbm5lY3Rpb25zIC0+IENvbm5lY3QgdG8gdW5rbm93IGNvbm5lY3Rpb25zXG4gICAgICBAY29ubmVjdGlvbnNbY29ubi5wZWVyXSA9IGNvbm5cbiAgICAgIGluaXRpYWxpemVkX21lID0gZmFsc2VcbiAgICAgIGluaXRpYWxpemVkX2hpbSA9IGZhbHNlXG4gICAgICBjb25uLm9uICdkYXRhJywgKGRhdGEpPT5cbiAgICAgICAgaWYgZGF0YSBpcyBcImVtcHR5X21lc3NhZ2VcIlxuICAgICAgICAgICMgbm9wXG4gICAgICAgIGVsc2UgaWYgZGF0YS5IQj9cbiAgICAgICAgICBpbml0aWFsaXplZF9tZSA9IHRydWVcbiAgICAgICAgICBAZW5naW5lLmFwcGx5T3BzQ2hlY2tEb3VibGUgZGF0YS5IQlxuICAgICAgICAgIGlmIG5vdCBkYXRhLmluaXRpYWxpemVkXG4gICAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgICAgY29ubnM6IEBnZXRBbGxDb25uZWN0aW9uSWRzKClcbiAgICAgICAgICAgIEBuZXdfY29ubmVjdGlvbl9saXN0ZW5lcnMubWFwIChmKS0+XG4gICAgICAgICAgICAgIGYoY29ubilcbiAgICAgICAgZWxzZSBpZiBkYXRhLm9wP1xuICAgICAgICAgIEBlbmdpbmUuYXBwbHlPcCBkYXRhLm9wXG4gICAgICAgIGVsc2UgaWYgZGF0YS5jb25ucz9cbiAgICAgICAgICBmb3IgY29ubl9pZCBpbiBkYXRhLmNvbm5zXG4gICAgICAgICAgICBAY29ubmVjdFRvUGVlciBjb25uX2lkXG4gICAgICAgIGVsc2UgaWYgZGF0YS5zeW5jX3N0YXRlX3ZlY3Rvcj9cbiAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgIEhCOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoZGF0YS5zeW5jX3N0YXRlX3ZlY3RvcilcbiAgICAgICAgICAgIGluaXRpYWxpemVkOiB0cnVlXG4gICAgICAgIGVsc2UgaWYgZGF0YS5zdGF0ZV92ZWN0b3I/XG4gICAgICAgICAgaWYgbm90IGluaXRpYWxpemVkX2hpbVxuICAgICAgICAgICAgIyBtYWtlIHN1cmUsIHRoYXQgaXQgaXMgc2VudCBvbmx5IG9uY2VcbiAgICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgICBIQjogQHlhdHRhLmdldEhpc3RvcnlCdWZmZXIoKS5fZW5jb2RlKGRhdGEuc3RhdGVfdmVjdG9yKVxuICAgICAgICAgICAgICBpbml0aWFsaXplZDogZmFsc2VcbiAgICAgICAgICAgIGluaXRpYWxpemVkX2hpbSA9IHRydWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIkNhbid0IHBhcnNlIHRoaXMgb3BlcmF0aW9uOiAje2RhdGF9XCJcblxuICAgICAgc2VuZFN0YXRlVmVjdG9yID0gKCk9PlxuICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICBzdGF0ZV92ZWN0b3I6IEBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICAgICAgaWYgbm90IGluaXRpYWxpemVkX21lXG4gICAgICAgICAgIyBCZWNhdXNlIG9mIGEgYnVnIGluIFBlZXJKcyxcbiAgICAgICAgICAjIHdlIG5ldmVyIGtub3cgaWYgc3RhdGUgdmVjdG9yIHdhcyBhY3R1YWxseSBzZW50XG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kU3RhdGVWZWN0b3IsIDEwMFxuICAgICAgc2VuZFN0YXRlVmVjdG9yKClcblxuICBwZWVyLm9uICdvcGVuJywgKGlkKS0+XG4gICAgY2FsbGJhY2sgUGVlckpzQ29ubmVjdG9yLCBpZFxuXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlUGVlckpzQ29ubmVjdG9yXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLmNyZWF0ZVBlZXJKc0Nvbm5lY3RvciA9IGNyZWF0ZVBlZXJKc0Nvbm5lY3RvclxuXG4iXX0=
