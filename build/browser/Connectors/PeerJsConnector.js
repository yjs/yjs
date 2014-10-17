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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL3VidW50dS93b3Jrc3BhY2Uvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvdWJ1bnR1L3dvcmtzcGFjZS9saWIvQ29ubmVjdG9ycy9QZWVySnNDb25uZWN0b3IuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDVUEsSUFBQSxxQkFBQTs7QUFBQSxxQkFBQSxHQUF3QixTQUFBLEdBQUE7QUFDdEIsTUFBQSwrQkFBQTtBQUFBLEVBQUEsSUFBQSxHQUFPLElBQVAsQ0FBQTtBQUNBLEVBQUEsSUFBRyxTQUFTLENBQUMsTUFBVixLQUFvQixDQUF2QjtBQUNFLElBQUEsSUFBQSxHQUFXLElBQUEsSUFBQSxDQUFLLFNBQVUsQ0FBQSxDQUFBLENBQWYsQ0FBWCxDQUFBO0FBQUEsSUFDQSxRQUFBLEdBQVcsU0FBVSxDQUFBLENBQUEsQ0FEckIsQ0FERjtHQUFBLE1BQUE7QUFJRSxJQUFBLElBQUEsR0FBVyxJQUFBLElBQUEsQ0FBSyxTQUFVLENBQUEsQ0FBQSxDQUFmLEVBQW1CLFNBQVUsQ0FBQSxDQUFBLENBQTdCLENBQVgsQ0FBQTtBQUFBLElBQ0EsSUFBSSxDQUFDLEVBQUwsQ0FBUSxPQUFSLEVBQWlCLFNBQUMsR0FBRCxHQUFBO0FBQ2YsWUFBVSxJQUFBLEtBQUEsQ0FBTyxvQkFBQSxHQUFtQixHQUExQixDQUFWLENBRGU7SUFBQSxDQUFqQixDQURBLENBQUE7QUFBQSxJQUdBLElBQUksQ0FBQyxFQUFMLENBQVEsY0FBUixFQUF3QixTQUFBLEdBQUE7QUFDdEIsWUFBVSxJQUFBLEtBQUEsQ0FBTSwwSEFBTixDQUFWLENBRHNCO0lBQUEsQ0FBeEIsQ0FIQSxDQUFBO0FBQUEsSUFLQSxRQUFBLEdBQVcsU0FBVSxDQUFBLENBQUEsQ0FMckIsQ0FKRjtHQURBO0FBQUEsRUFrQk07QUFRUyxJQUFBLHlCQUFF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REFBSDtBQUNFLEVBQUEsSUFBTyxnQkFBUDtBQUNFLElBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxFQUFYLENBREY7R0FBQTtBQUFBLEVBRUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxxQkFBVCxHQUFpQyxxQkFGakMsQ0FERjtDQXhJQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbiNcbiMgQG92ZXJsb2FkIGNyZWF0ZVBlZXJKc0Nvbm5lY3RvciBwZWVyanNfb3B0aW9ucywgY2FsbGJhY2tcbiMgICBAcGFyYW0ge09iamVjdH0gcGVlcmpzX29wdGlvbnMgSXMgdGhlIG9wdGlvbnMgb2JqZWN0IHRoYXQgaXMgcGFzc2VkIHRvIFBlZXJKcy5cbiMgICBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbm5lY3RvciBpcyBpbml0aWFsaXplZC5cbiMgQG92ZXJsb2FkIGNyZWF0ZVBlZXJKc0Nvbm5lY3RvciBwZWVyanNfdXNlcl9pZCwgcGVlcmpzX29wdGlvbnMsIGNhbGxiYWNrXG4jICAgQHBhcmFtIHtTdHJpbmd9IHBlZXJqc191c2VyX2lkIFRoZSB1c2VyX2lkIHRoYXQgaXMgcGFzc2VkIHRvIFBlZXJKcyBhcyB0aGUgdXNlcl9pZCBhbmQgc2hvdWxkIGJlIHVuaXF1ZSBiZXR3ZWVuIGFsbCAoYWxzbyB0aGUgdW5jb25uZWN0ZWQpIFBlZXJzLlxuIyAgIEBwYXJhbSB7T2JqZWN0fSBwZWVyanNfb3B0aW9ucyBJcyB0aGUgb3B0aW9ucyBvYmplY3QgdGhhdCBpcyBwYXNzZWQgdG8gUGVlckpzLlxuIyAgIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgY29ubmVjdG9yIGlzIGluaXRpYWxpemVkLlxuI1xuY3JlYXRlUGVlckpzQ29ubmVjdG9yID0gKCktPlxuICBwZWVyID0gbnVsbFxuICBpZiBhcmd1bWVudHMubGVuZ3RoIGlzIDJcbiAgICBwZWVyID0gbmV3IFBlZXIgYXJndW1lbnRzWzBdXG4gICAgY2FsbGJhY2sgPSBhcmd1bWVudHNbMV1cbiAgZWxzZVxuICAgIHBlZXIgPSBuZXcgUGVlciBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXVxuICAgIHBlZXIub24gJ2Vycm9yJywgKGVyciktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUGVlcmpzIGNvbm5lY3RvcjogI3tlcnJ9XCJcbiAgICBwZWVyLm9uICdkaXNjb25uZWN0ZWQnLCAoKS0+XG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQZWVyanMgY29ubmVjdG9yIGRpc2Nvbm5lY3RlZCBmcm9tIHNpZ25hbGxpbmcgc2VydmVyLiBDYW5ub3QgYWNjZXB0IG5ldyBjb25uZWN0aW9ucy4gTm90IGZhdGFsLCBidXQgbm90IHNvIGdvb2QgZWl0aGVyLi5cIlxuICAgIGNhbGxiYWNrID0gYXJndW1lbnRzWzJdXG5cblxuICAjXG4gICMgUGVlckpzIGlzIGEgRnJhbWV3b3JrIHRoYXQgZW5hYmxlcyB5b3UgdG8gY29ubmVjdCB0byBvdGhlciBwZWVycy4gWW91IGp1c3QgbmVlZCB0aGVcbiAgIyB1c2VyLWlkIG9mIHRoZSBwZWVyIChicm93c2VyL2NsaWVudCkuIEFuZCB0aGVuIHlvdSBjYW4gY29ubmVjdCB0byBpdC5cbiAgIyBAc2VlIGh0dHA6Ly9wZWVyanMuY29tXG4gICNcbiAgY2xhc3MgUGVlckpzQ29ubmVjdG9yXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge0VuZ2luZX0gZW5naW5lIFRoZSB0cmFuc2Zvcm1hdGlvbiBlbmdpbmVcbiAgICAjIEBwYXJhbSB7SGlzdG9yeUJ1ZmZlcn0gSEJcbiAgICAjIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBleGVjdXRpb25fbGlzdGVuZXIgWW91IG11c3QgZW5zdXJlIHRoYXQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIGlzIGV4ZWN1dGVkLCBldmVyeSBmdW5jdGlvbiBpbiB0aGlzIEFycmF5IGlzIGNhbGxlZC5cbiAgICAjIEBwYXJhbSB7WWF0dGF9IHlhdHRhIFRoZSBZYXR0YSBmcmFtZXdvcmsuXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAoQGVuZ2luZSwgQEhCLCBAZXhlY3V0aW9uX2xpc3RlbmVyLCBAeWF0dGEpLT5cblxuICAgICAgQHBlZXIgPSBwZWVyXG4gICAgICBAY29ubmVjdGlvbnMgPSB7fVxuICAgICAgQG5ld19jb25uZWN0aW9uX2xpc3RlbmVycyA9IFtdXG5cbiAgICAgIEBwZWVyLm9uICdjb25uZWN0aW9uJywgKGNvbm4pPT5cbiAgICAgICAgQGFkZENvbm5lY3Rpb24gY29ublxuXG4gICAgICBzeW5jX2V2ZXJ5X2NvbGxhYm9yYXRvciA9ICgpPT5cbiAgICAgICAgZm9yIGNvbm5faWQsIGNvbm4gb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29ubi5zZW5kXG4gICAgICAgICAgICBzeW5jX3N0YXRlX3ZlY3RvcjogQEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgICAgc2V0SW50ZXJ2YWwgc3luY19ldmVyeV9jb2xsYWJvcmF0b3IsIDQwMDBcblxuICAgICAgc2VuZF8gPSAobyk9PlxuICAgICAgICBpZiBvLnVpZC5jcmVhdG9yIGlzIEBIQi5nZXRVc2VySWQoKSBhbmQgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKVxuICAgICAgICAgIGZvciBjb25uX2lkLGNvbm4gb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgICAgb3A6IG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG5cblxuXG4gICAgI1xuICAgICMgQ29ubmVjdCB0aGUgRnJhbWV3b3JrIHRvIGFub3RoZXIgcGVlci4gVGhlcmVmb3JlIHlvdSBoYXZlIHRvIHJlY2VpdmUgaGlzXG4gICAgIyB1c2VyX2lkLiBJZiB0aGUgb3RoZXIgcGVlciBpcyBjb25uZWN0ZWQgdG8gb3RoZXIgcGVlcnMsIHRoZSBQZWVySnNDb25uZWN0b3JcbiAgICAjIHdpbGwgYXV0b21hdGljYWxseSBjb25uZWN0IHRvIHRoZW0gdG9vLlxuICAgICNcbiAgICAjIFRyYW5zbWl0dGluZyB0aGUgdXNlcl9pZCBpcyB5b3VyIGpvYi5cbiAgICAjIFNlZSBbVGV4dEVkaXRpbmddKC4uLy4uL2V4YW1wbGVzL1RleHRFZGl0aW5nLykgZm9yIGEgbmljZSBleGFtcGxlXG4gICAgIyBvbiBob3cgdG8gZG8gdGhhdCB3aXRoIHVybHMuXG4gICAgI1xuICAgICMgQHBhcmFtIGlkIHtTdHJpbmd9IENvbm5lY3Rpb24gaWRcbiAgICAjXG4gICAgY29ubmVjdFRvUGVlcjogKGlkKS0+XG4gICAgICBpZiBub3QgQGNvbm5lY3Rpb25zW2lkXT8gYW5kIGlkIGlzbnQgQHlhdHRhLmdldFVzZXJJZCgpXG4gICAgICAgIEBhZGRDb25uZWN0aW9uIHBlZXIuY29ubmVjdCBpZFxuXG4gICAgI1xuICAgICMgUmVjZWl2ZSB0aGUgaWQgb2YgZXZlcnkgY29ubmVjdGVkIHBlZXIuXG4gICAgIyBAcmV0dXJuIHtBcnJheTxTdHJpbmc+fSBBIGxpc3Qgb2YgUGVlci1JZHNcbiAgICAjXG4gICAgZ2V0QWxsQ29ubmVjdGlvbklkczogKCktPlxuICAgICAgZm9yIGNvbm5faWQgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbm5faWRcblxuICAgIG9uTmV3Q29ubmVjdGlvbjogKGYpLT5cbiAgICAgIEBuZXdfY29ubmVjdGlvbl9saXN0ZW5lcnMucHVzaCBmXG5cbiAgICAjXG4gICAgIyBBZGRzIGFuIGV4aXN0aW5nIGNvbm5lY3Rpb24gdG8gdGhpcyBjb25uZWN0b3IuXG4gICAgIyBAcGFyYW0gY29ubiB7UGVlckpzQ29ubmVjdGlvbn1cbiAgICAjXG4gICAgYWRkQ29ubmVjdGlvbjogKGNvbm4pLT5cbiAgICAgICNcbiAgICAgICMgV2hhdCB0aGlzIG1ldGhvZCBkb2VzOlxuICAgICAgIyAqIFNlbmQgc3RhdGUgdmVjdG9yXG4gICAgICAjICogUmVjZWl2ZSBIQiAtPiBhcHBseSB0aGVtXG4gICAgICAjICogU2VuZCBjb25uZWN0aW9uc1xuICAgICAgIyAqIFJlY2VpdmUgQ29ubmVjdGlvbnMgLT4gQ29ubmVjdCB0byB1bmtub3cgY29ubmVjdGlvbnNcbiAgICAgIEBjb25uZWN0aW9uc1tjb25uLnBlZXJdID0gY29ublxuICAgICAgaW5pdGlhbGl6ZWRfbWUgPSBmYWxzZVxuICAgICAgaW5pdGlhbGl6ZWRfaGltID0gZmFsc2VcbiAgICAgIGNvbm4ub24gJ2RhdGEnLCAoZGF0YSk9PlxuICAgICAgICBpZiBkYXRhIGlzIFwiZW1wdHlfbWVzc2FnZVwiXG4gICAgICAgICAgIyBub3BcbiAgICAgICAgZWxzZSBpZiBkYXRhLkhCP1xuICAgICAgICAgIGluaXRpYWxpemVkX21lID0gdHJ1ZVxuICAgICAgICAgIEBlbmdpbmUuYXBwbHlPcHNDaGVja0RvdWJsZSBkYXRhLkhCXG4gICAgICAgICAgaWYgbm90IGRhdGEuaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgICBjb25uczogQGdldEFsbENvbm5lY3Rpb25JZHMoKVxuICAgICAgICAgICAgQG5ld19jb25uZWN0aW9uX2xpc3RlbmVycy5tYXAgKGYpLT5cbiAgICAgICAgICAgICAgZihjb25uKVxuICAgICAgICBlbHNlIGlmIGRhdGEub3A/XG4gICAgICAgICAgQGVuZ2luZS5hcHBseU9wIGRhdGEub3BcbiAgICAgICAgZWxzZSBpZiBkYXRhLmNvbm5zP1xuICAgICAgICAgIGZvciBjb25uX2lkIGluIGRhdGEuY29ubnNcbiAgICAgICAgICAgIEBjb25uZWN0VG9QZWVyIGNvbm5faWRcbiAgICAgICAgZWxzZSBpZiBkYXRhLnN5bmNfc3RhdGVfdmVjdG9yP1xuICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgSEI6IEB5YXR0YS5nZXRIaXN0b3J5QnVmZmVyKCkuX2VuY29kZShkYXRhLnN5bmNfc3RhdGVfdmVjdG9yKVxuICAgICAgICAgICAgaW5pdGlhbGl6ZWQ6IHRydWVcbiAgICAgICAgZWxzZSBpZiBkYXRhLnN0YXRlX3ZlY3Rvcj9cbiAgICAgICAgICBpZiBub3QgaW5pdGlhbGl6ZWRfaGltXG4gICAgICAgICAgICAjIG1ha2Ugc3VyZSwgdGhhdCBpdCBpcyBzZW50IG9ubHkgb25jZVxuICAgICAgICAgICAgY29ubi5zZW5kXG4gICAgICAgICAgICAgIEhCOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoZGF0YS5zdGF0ZV92ZWN0b3IpXG4gICAgICAgICAgICAgIGluaXRpYWxpemVkOiBmYWxzZVxuICAgICAgICAgICAgaW5pdGlhbGl6ZWRfaGltID0gdHJ1ZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiQ2FuJ3QgcGFyc2UgdGhpcyBvcGVyYXRpb246ICN7ZGF0YX1cIlxuXG4gICAgICBzZW5kU3RhdGVWZWN0b3IgPSAoKT0+XG4gICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgIHN0YXRlX3ZlY3RvcjogQEhCLmdldE9wZXJhdGlvbkNvdW50ZXIoKVxuICAgICAgICBpZiBub3QgaW5pdGlhbGl6ZWRfbWVcbiAgICAgICAgICAjIEJlY2F1c2Ugb2YgYSBidWcgaW4gUGVlckpzLFxuICAgICAgICAgICMgd2UgbmV2ZXIga25vdyBpZiBzdGF0ZSB2ZWN0b3Igd2FzIGFjdHVhbGx5IHNlbnRcbiAgICAgICAgICBzZXRUaW1lb3V0IHNlbmRTdGF0ZVZlY3RvciwgMTAwXG4gICAgICBzZW5kU3RhdGVWZWN0b3IoKVxuXG4gIHBlZXIub24gJ29wZW4nLCAoaWQpLT5cbiAgICBjYWxsYmFjayBQZWVySnNDb25uZWN0b3IsIGlkXG5cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVQZWVySnNDb25uZWN0b3JcbmlmIHdpbmRvdz9cbiAgaWYgbm90IHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZID0ge31cbiAgd2luZG93LlkuY3JlYXRlUGVlckpzQ29ubmVjdG9yID0gY3JlYXRlUGVlckpzQ29ubmVjdG9yXG5cbiJdfQ==
