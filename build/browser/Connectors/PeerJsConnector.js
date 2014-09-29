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
      setInterval(sync_every_collaborator, 8000);
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
            console.log("turinae");
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
            throw new Error("Can't parse this operation");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvUGVlckpzQ29ubmVjdG9yLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ1VBLElBQUEscUJBQUE7O0FBQUEscUJBQUEsR0FBd0IsU0FBQSxHQUFBO0FBQ3RCLE1BQUEsK0JBQUE7QUFBQSxFQUFBLElBQUEsR0FBTyxJQUFQLENBQUE7QUFDQSxFQUFBLElBQUcsU0FBUyxDQUFDLE1BQVYsS0FBb0IsQ0FBdkI7QUFDRSxJQUFBLElBQUEsR0FBVyxJQUFBLElBQUEsQ0FBSyxTQUFVLENBQUEsQ0FBQSxDQUFmLENBQVgsQ0FBQTtBQUFBLElBQ0EsUUFBQSxHQUFXLFNBQVUsQ0FBQSxDQUFBLENBRHJCLENBREY7R0FBQSxNQUFBO0FBSUUsSUFBQSxJQUFBLEdBQVcsSUFBQSxJQUFBLENBQUssU0FBVSxDQUFBLENBQUEsQ0FBZixFQUFtQixTQUFVLENBQUEsQ0FBQSxDQUE3QixDQUFYLENBQUE7QUFBQSxJQUNBLElBQUksQ0FBQyxFQUFMLENBQVEsT0FBUixFQUFpQixTQUFDLEdBQUQsR0FBQTtBQUNmLFlBQVUsSUFBQSxLQUFBLENBQU8sb0JBQUEsR0FBbUIsR0FBMUIsQ0FBVixDQURlO0lBQUEsQ0FBakIsQ0FEQSxDQUFBO0FBQUEsSUFHQSxJQUFJLENBQUMsRUFBTCxDQUFRLGNBQVIsRUFBd0IsU0FBQSxHQUFBO0FBQ3RCLFlBQVUsSUFBQSxLQUFBLENBQU0sMEhBQU4sQ0FBVixDQURzQjtJQUFBLENBQXhCLENBSEEsQ0FBQTtBQUFBLElBS0EsUUFBQSxHQUFXLFNBQVUsQ0FBQSxDQUFBLENBTHJCLENBSkY7R0FEQTtBQUFBLEVBa0JNO0FBUVMs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QUFBLGdCQUNBLFdBQUEsRUFBYSxLQURiO2VBREYsQ0FBQSxDQUFBO3FCQUdBLGVBQUEsR0FBa0IsS0FMcEI7YUFERztXQUFBLE1BQUE7QUFRSCxrQkFBVSxJQUFBLEtBQUEsQ0FBTSw0QkFBTixDQUFWLENBUkc7V0FuQlM7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFoQixDQUhBLENBQUE7QUFBQSxNQWdDQSxlQUFBLEdBQWtCLENBQUEsU0FBQSxLQUFBLEdBQUE7ZUFBQSxTQUFBLEdBQUE7QUFDaEIsVUFBQSxJQUFJLENBQUMsSUFBTCxDQUNFO0FBQUEsWUFBQSxZQUFBLEVBQWMsS0FBQyxDQUFBLEVBQUUsQ0FBQyxtQkFBSixDQUFBLENBQWQ7V0FERixDQUFBLENBQUE7QUFFQSxVQUFBLElBQUcsQ0FBQSxjQUFIO21CQUdFLFVBQUEsQ0FBVyxlQUFYLEVBQTRCLEdBQTVCLEVBSEY7V0FIZ0I7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQWhDbEIsQ0FBQTthQXVDQSxlQUFBLENBQUEsRUE5Q2E7SUFBQSxDQW5EZixDQUFBOzsyQkFBQTs7TUExQkYsQ0FBQTtTQTZIQSxJQUFJLENBQUMsRUFBTCxDQUFRLE1BQVIsRUFBZ0IsU0FBQyxFQUFELEdBQUE7V0FDZCxRQUFBLENBQVMsZUFBVCxFQUEwQixFQUExQixFQURjO0VBQUEsQ0FBaEIsRUE5SHNCO0FBQUEsQ0FBeEIsQ0FBQTs7QUFBQSxNQWtJTSxDQUFDLE9BQVAsR0FBaUIscUJBbElqQixDQUFBOztBQW1JQSxJQUFHLGdEQUFIO0FBQ0UsRUFBQSxJQUFPLGdCQUFQO0FBQ0UsSUFBQSxNQUFNLENBQUMsQ0FBUCxHQUFXLEVBQVgsQ0FERjtHQUFBO0FBQUEsRUFFQSxNQUFNLENBQUMsQ0FBQyxDQUFDLHFCQUFULEdBQWlDLHFCQUZqQyxDQURGO0NBbklBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuI1xuIyBAb3ZlcmxvYWQgY3JlYXRlUGVlckpzQ29ubmVjdG9yIHBlZXJqc19vcHRpb25zLCBjYWxsYmFja1xuIyAgIEBwYXJhbSB7T2JqZWN0fSBwZWVyanNfb3B0aW9ucyBJcyB0aGUgb3B0aW9ucyBvYmplY3QgdGhhdCBpcyBwYXNzZWQgdG8gUGVlckpzLlxuIyAgIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgY29ubmVjdG9yIGlzIGluaXRpYWxpemVkLlxuIyBAb3ZlcmxvYWQgY3JlYXRlUGVlckpzQ29ubmVjdG9yIHBlZXJqc191c2VyX2lkLCBwZWVyanNfb3B0aW9ucywgY2FsbGJhY2tcbiMgICBAcGFyYW0ge1N0cmluZ30gcGVlcmpzX3VzZXJfaWQgVGhlIHVzZXJfaWQgdGhhdCBpcyBwYXNzZWQgdG8gUGVlckpzIGFzIHRoZSB1c2VyX2lkIGFuZCBzaG91bGQgYmUgdW5pcXVlIGJldHdlZW4gYWxsIChhbHNvIHRoZSB1bmNvbm5lY3RlZCkgUGVlcnMuXG4jICAgQHBhcmFtIHtPYmplY3R9IHBlZXJqc19vcHRpb25zIElzIHRoZSBvcHRpb25zIG9iamVjdCB0aGF0IGlzIHBhc3NlZCB0byBQZWVySnMuXG4jICAgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSBjb25uZWN0b3IgaXMgaW5pdGlhbGl6ZWQuXG4jXG5jcmVhdGVQZWVySnNDb25uZWN0b3IgPSAoKS0+XG4gIHBlZXIgPSBudWxsXG4gIGlmIGFyZ3VtZW50cy5sZW5ndGggaXMgMlxuICAgIHBlZXIgPSBuZXcgUGVlciBhcmd1bWVudHNbMF1cbiAgICBjYWxsYmFjayA9IGFyZ3VtZW50c1sxXVxuICBlbHNlXG4gICAgcGVlciA9IG5ldyBQZWVyIGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdXG4gICAgcGVlci5vbiAnZXJyb3InLCAoZXJyKS0+XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQZWVyanMgY29ubmVjdG9yOiAje2Vycn1cIlxuICAgIHBlZXIub24gJ2Rpc2Nvbm5lY3RlZCcsICgpLT5cbiAgICAgIHRocm93IG5ldyBFcnJvciBcIlBlZXJqcyBjb25uZWN0b3IgZGlzY29ubmVjdGVkIGZyb20gc2lnbmFsbGluZyBzZXJ2ZXIuIENhbm5vdCBhY2NlcHQgbmV3IGNvbm5lY3Rpb25zLiBOb3QgZmF0YWwsIGJ1dCBub3Qgc28gZ29vZCBlaXRoZXIuLlwiXG4gICAgY2FsbGJhY2sgPSBhcmd1bWVudHNbMl1cblxuXG4gICNcbiAgIyBQZWVySnMgaXMgYSBGcmFtZXdvcmsgdGhhdCBlbmFibGVzIHlvdSB0byBjb25uZWN0IHRvIG90aGVyIHBlZXJzLiBZb3UganVzdCBuZWVkIHRoZVxuICAjIHVzZXItaWQgb2YgdGhlIHBlZXIgKGJyb3dzZXIvY2xpZW50KS4gQW5kIHRoZW4geW91IGNhbiBjb25uZWN0IHRvIGl0LlxuICAjIEBzZWUgaHR0cDovL3BlZXJqcy5jb21cbiAgI1xuICBjbGFzcyBQZWVySnNDb25uZWN0b3JcblxuICAgICNcbiAgICAjIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuICAgICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAgICMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuICAgICMgQHBhcmFtIHtZYXR0YX0geWF0dGEgVGhlIFlhdHRhIGZyYW1ld29yay5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAZW5naW5lLCBASEIsIEBleGVjdXRpb25fbGlzdGVuZXIsIEB5YXR0YSktPlxuXG4gICAgICBAcGVlciA9IHBlZXJcbiAgICAgIEBjb25uZWN0aW9ucyA9IHt9XG5cbiAgICAgIEBwZWVyLm9uICdjb25uZWN0aW9uJywgKGNvbm4pPT5cbiAgICAgICAgQGFkZENvbm5lY3Rpb24gY29ublxuXG4gICAgICBzeW5jX2V2ZXJ5X2NvbGxhYm9yYXRvciA9ICgpPT5cbiAgICAgICAgICBmb3IgY29ubl9pZCwgY29ubiBvZiBAY29ubmVjdGlvbnNcbiAgICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgICBzeW5jX3N0YXRlX3ZlY3RvcjogQEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgICAgc2V0SW50ZXJ2YWwgc3luY19ldmVyeV9jb2xsYWJvcmF0b3IsIDgwMDBcblxuICAgICAgc2VuZF8gPSAobyk9PlxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIGlzIEBIQi5nZXRVc2VySWQoKSBhbmQgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKVxuICAgICAgICAgIGZvciBjb25uX2lkLGNvbm4gb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgICAgb3A6IG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG5cblxuXG4gICAgI1xuICAgICMgQ29ubmVjdCB0aGUgRnJhbWV3b3JrIHRvIGFub3RoZXIgcGVlci4gVGhlcmVmb3JlIHlvdSBoYXZlIHRvIHJlY2VpdmUgaGlzXG4gICAgIyB1c2VyX2lkLiBJZiB0aGUgb3RoZXIgcGVlciBpcyBjb25uZWN0ZWQgdG8gb3RoZXIgcGVlcnMsIHRoZSBQZWVySnNDb25uZWN0b3JcbiAgICAjIHdpbGwgYXV0b21hdGljYWxseSBjb25uZWN0IHRvIHRoZW0gdG9vLlxuICAgICNcbiAgICAjIFRyYW5zbWl0dGluZyB0aGUgdXNlcl9pZCBpcyB5b3VyIGpvYi5cbiAgICAjIFNlZSBbVGV4dEVkaXRpbmddKC4uLy4uL2V4YW1wbGVzL1RleHRFZGl0aW5nLykgZm9yIGEgbmljZSBleGFtcGxlXG4gICAgIyBvbiBob3cgdG8gZG8gdGhhdCB3aXRoIHVybHMuXG4gICAgI1xuICAgICMgQHBhcmFtIGlkIHtTdHJpbmd9IENvbm5lY3Rpb24gaWRcbiAgICAjXG4gICAgY29ubmVjdFRvUGVlcjogKGlkKS0+XG4gICAgICBpZiBub3QgQGNvbm5lY3Rpb25zW2lkXT8gYW5kIGlkIGlzbnQgQHlhdHRhLmdldFVzZXJJZCgpXG4gICAgICAgIEBhZGRDb25uZWN0aW9uIHBlZXIuY29ubmVjdCBpZFxuXG4gICAgI1xuICAgICMgUmVjZWl2ZSB0aGUgaWQgb2YgZXZlcnkgY29ubmVjdGVkIHBlZXIuXG4gICAgIyBAcmV0dXJuIHtBcnJheTxTdHJpbmc+fSBBIGxpc3Qgb2YgUGVlci1JZHNcbiAgICAjXG4gICAgZ2V0QWxsQ29ubmVjdGlvbklkczogKCktPlxuICAgICAgZm9yIGNvbm5faWQgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbm5faWRcblxuICAgICNcbiAgICAjIEFkZHMgYW4gZXhpc3RpbmcgY29ubmVjdGlvbiB0byB0aGlzIGNvbm5lY3Rvci5cbiAgICAjIEBwYXJhbSBjb25uIHtQZWVySnNDb25uZWN0aW9ufVxuICAgICNcbiAgICBhZGRDb25uZWN0aW9uOiAoY29ubiktPlxuICAgICAgI1xuICAgICAgIyBXaGF0IHRoaXMgbWV0aG9kIGRvZXM6XG4gICAgICAjICogU2VuZCBzdGF0ZSB2ZWN0b3JcbiAgICAgICMgKiBSZWNlaXZlIEhCIC0+IGFwcGx5IHRoZW1cbiAgICAgICMgKiBTZW5kIGNvbm5lY3Rpb25zXG4gICAgICAjICogUmVjZWl2ZSBDb25uZWN0aW9ucyAtPiBDb25uZWN0IHRvIHVua25vdyBjb25uZWN0aW9uc1xuICAgICAgQGNvbm5lY3Rpb25zW2Nvbm4ucGVlcl0gPSBjb25uXG4gICAgICBpbml0aWFsaXplZF9tZSA9IGZhbHNlXG4gICAgICBpbml0aWFsaXplZF9oaW0gPSBmYWxzZVxuICAgICAgY29ubi5vbiAnZGF0YScsIChkYXRhKT0+XG4gICAgICAgIGlmIGRhdGEgaXMgXCJlbXB0eV9tZXNzYWdlXCJcbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIGRhdGEuSEI/XG4gICAgICAgICAgaW5pdGlhbGl6ZWRfbWUgPSB0cnVlXG4gICAgICAgICAgQGVuZ2luZS5hcHBseU9wc0NoZWNrRG91YmxlIGRhdGEuSEJcbiAgICAgICAgICBpZiBub3QgZGF0YS5pbml0aWFsaXplZFxuICAgICAgICAgICAgY29ubi5zZW5kXG4gICAgICAgICAgICAgIGNvbm5zOiBAZ2V0QWxsQ29ubmVjdGlvbklkcygpXG4gICAgICAgIGVsc2UgaWYgZGF0YS5vcD9cbiAgICAgICAgICBAZW5naW5lLmFwcGx5T3AgZGF0YS5vcFxuICAgICAgICBlbHNlIGlmIGRhdGEuY29ubnM/XG4gICAgICAgICAgZm9yIGNvbm5faWQgaW4gZGF0YS5jb25uc1xuICAgICAgICAgICAgQGNvbm5lY3RUb1BlZXIgY29ubl9pZFxuICAgICAgICBlbHNlIGlmIGRhdGEuc3luY19zdGF0ZV92ZWN0b3I/XG4gICAgICAgICAgY29uc29sZS5sb2cgXCJ0dXJpbmFlXCJcbiAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgIEhCOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoZGF0YS5zeW5jX3N0YXRlX3ZlY3RvcilcbiAgICAgICAgICAgIGluaXRpYWxpemVkOiB0cnVlXG4gICAgICAgIGVsc2UgaWYgZGF0YS5zdGF0ZV92ZWN0b3I/XG4gICAgICAgICAgaWYgbm90IGluaXRpYWxpemVkX2hpbVxuICAgICAgICAgICAgIyBtYWtlIHN1cmUsIHRoYXQgaXQgaXMgc2VudCBvbmx5IG9uY2VcbiAgICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgICBIQjogQHlhdHRhLmdldEhpc3RvcnlCdWZmZXIoKS5fZW5jb2RlKGRhdGEuc3RhdGVfdmVjdG9yKVxuICAgICAgICAgICAgICBpbml0aWFsaXplZDogZmFsc2VcbiAgICAgICAgICAgIGluaXRpYWxpemVkX2hpbSA9IHRydWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIkNhbid0IHBhcnNlIHRoaXMgb3BlcmF0aW9uXCJcblxuICAgICAgc2VuZFN0YXRlVmVjdG9yID0gKCk9PlxuICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICBzdGF0ZV92ZWN0b3I6IEBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICAgICAgaWYgbm90IGluaXRpYWxpemVkX21lXG4gICAgICAgICAgIyBCZWNhdXNlIG9mIGEgYnVnIGluIFBlZXJKcyxcbiAgICAgICAgICAjIHdlIG5ldmVyIGtub3cgaWYgc3RhdGUgdmVjdG9yIHdhcyBhY3R1YWxseSBzZW50XG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kU3RhdGVWZWN0b3IsIDEwMFxuICAgICAgc2VuZFN0YXRlVmVjdG9yKClcblxuICBwZWVyLm9uICdvcGVuJywgKGlkKS0+XG4gICAgY2FsbGJhY2sgUGVlckpzQ29ubmVjdG9yLCBpZFxuXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlUGVlckpzQ29ubmVjdG9yXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLmNyZWF0ZVBlZXJKc0Nvbm5lY3RvciA9IGNyZWF0ZVBlZXJKc0Nvbm5lY3RvclxuXG4iXX0=
