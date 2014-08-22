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
    callback = arguments[2];
  }
  PeerJsConnector = (function() {
    function PeerJsConnector(engine, HB, execution_listener, yatta) {
      var send_;
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
      send_ = (function(_this) {
        return function(o) {
          return _this.send(o);
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
            return conn.send({
              conns: _this.getAllConnectionIds()
            });
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
          } else if (data.state_vector != null) {
            if (!initialized_him) {
              conn.send({
                HB: _this.yatta.getHistoryBuffer()._encode(data.state_vector)
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

    PeerJsConnector.prototype.send = function(o) {
      var conn, conn_id, _ref, _results;
      if (o.uid.creator === this.HB.getUserId() && (typeof o.uid.op_number !== "string")) {
        _ref = this.connections;
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
  if (window.Y == null) {
    window.Y = {};
  }
  window.Y.createPeerJsConnector = createPeerJsConnector;
}


},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvUGVlckpzQ29ubmVjdG9yLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ1VBLElBQUEscUJBQUE7O0FBQUEscUJBQUEsR0FBd0IsU0FBQSxHQUFBO0FBQ3RCLE1BQUEsK0JBQUE7QUFBQSxFQUFBLElBQUEsR0FBTyxJQUFQLENBQUE7QUFDQSxFQUFBLElBQUcsU0FBUyxDQUFDLE1BQVYsS0FBb0IsQ0FBdkI7QUFDRSxJQUFBLElBQUEsR0FBVyxJQUFBLElBQUEsQ0FBSyxTQUFVLENBQUEsQ0FBQSxDQUFmLENBQVgsQ0FBQTtBQUFBLElBQ0EsUUFBQSxHQUFXLFNBQVUsQ0FBQSxDQUFBLENBRHJCLENBREY7R0FBQSxNQUFBO0FBSUUsSUFBQSxJQUFBLEdBQVcsSUFBQSxJQUFBLENBQUssU0FBVSxDQUFBLENBQUEsQ0FBZixFQUFtQixTQUFVLENBQUEsQ0FBQSxDQUE3QixDQUFYLENBQUE7QUFBQSxJQUNBLFFBQUEsR0FBVyxTQUFVLENBQUEsQ0FBQSxDQURyQixDQUpGO0dBREE7QUFBQSxFQVlNO0FBUVMsSUFBQSx5QkFBRSxNQUFGLEVBQVcsRUFBWCxFQUFnQixrQkFBaEIsRUFBcUMsS0FBckMsR0FBQTtBQUVYLFVBQUEsS0FBQTtBQUFBLE1BRlksSUFBQyxDQUFBLFNBQUEsTUFFYixDQUFBO0FBQUEsTUFGcUIsSUFBQyxDQUFBLEtBQUEsRUFFdEIsQ0FBQTtBQUFBLE1BRjBCLElBQUMsQ0FBQSxxQkFBQSxrQkFFM0IsQ0FBQTtBQUFBLE1BRitDLElBQUMsQ0FBQSxRQUFBLEtBRWhELENBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxJQUFELEdB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QUFULEVBQTBCLEVBQTFCLEVBRGM7RUFBQSxDQUFoQixFQXJHc0I7QUFBQSxDQUF4QixDQUFBOztBQUFBLE1BeUdNLENBQUMsT0FBUCxHQUFpQixxQkF6R2pCLENBQUE7O0FBMEdBLElBQUcsZ0RBQUg7QUFDRSxFQUFBLElBQU8sZ0JBQVA7QUFDRSxJQUFBLE1BQU0sQ0FBQyxDQUFQLEdBQVcsRUFBWCxDQURGO0dBQUE7QUFBQSxFQUVBLE1BQU0sQ0FBQyxDQUFDLENBQUMscUJBQVQsR0FBaUMscUJBRmpDLENBREY7Q0ExR0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4jXG4jIEBvdmVybG9hZCBjcmVhdGVQZWVySnNDb25uZWN0b3IgcGVlcmpzX29wdGlvbnMsIGNhbGxiYWNrXG4jICAgQHBhcmFtIHtPYmplY3R9IHBlZXJqc19vcHRpb25zIElzIHRoZSBvcHRpb25zIG9iamVjdCB0aGF0IGlzIHBhc3NlZCB0byBQZWVySnMuXG4jICAgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSBjb25uZWN0b3IgaXMgaW5pdGlhbGl6ZWQuXG4jIEBvdmVybG9hZCBjcmVhdGVQZWVySnNDb25uZWN0b3IgcGVlcmpzX3VzZXJfaWQsIHBlZXJqc19vcHRpb25zLCBjYWxsYmFja1xuIyAgIEBwYXJhbSB7U3RyaW5nfSBwZWVyanNfdXNlcl9pZCBUaGUgdXNlcl9pZCB0aGF0IGlzIHBhc3NlZCB0byBQZWVySnMgYXMgdGhlIHVzZXJfaWQgYW5kIHNob3VsZCBiZSB1bmlxdWUgYmV0d2VlbiBhbGwgKGFsc28gdGhlIHVuY29ubmVjdGVkKSBQZWVycy5cbiMgICBAcGFyYW0ge09iamVjdH0gcGVlcmpzX29wdGlvbnMgSXMgdGhlIG9wdGlvbnMgb2JqZWN0IHRoYXQgaXMgcGFzc2VkIHRvIFBlZXJKcy5cbiMgICBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbm5lY3RvciBpcyBpbml0aWFsaXplZC5cbiNcbmNyZWF0ZVBlZXJKc0Nvbm5lY3RvciA9ICgpLT5cbiAgcGVlciA9IG51bGxcbiAgaWYgYXJndW1lbnRzLmxlbmd0aCBpcyAyXG4gICAgcGVlciA9IG5ldyBQZWVyIGFyZ3VtZW50c1swXVxuICAgIGNhbGxiYWNrID0gYXJndW1lbnRzWzFdXG4gIGVsc2VcbiAgICBwZWVyID0gbmV3IFBlZXIgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV1cbiAgICBjYWxsYmFjayA9IGFyZ3VtZW50c1syXVxuXG5cbiAgI1xuICAjIEBzZWUgaHR0cDovL3BlZXJqcy5jb21cbiAgI1xuICBjbGFzcyBQZWVySnNDb25uZWN0b3JcblxuICAgICNcbiAgICAjIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuICAgICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAgICMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuICAgICMgQHBhcmFtIHtZYXR0YX0geWF0dGEgVGhlIFlhdHRhIGZyYW1ld29yay5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAZW5naW5lLCBASEIsIEBleGVjdXRpb25fbGlzdGVuZXIsIEB5YXR0YSktPlxuXG4gICAgICBAcGVlciA9IHBlZXJcbiAgICAgIEBjb25uZWN0aW9ucyA9IHt9XG5cbiAgICAgIEBwZWVyLm9uICdjb25uZWN0aW9uJywgKGNvbm4pPT5cbiAgICAgICAgQGFkZENvbm5lY3Rpb24gY29ublxuXG4gICAgICBzZW5kXyA9IChvKT0+XG4gICAgICAgIEBzZW5kIG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG4gICAgY29ubmVjdFRvUGVlcjogKGlkKS0+XG4gICAgICBpZiBub3QgQGNvbm5lY3Rpb25zW2lkXT8gYW5kIGlkIGlzbnQgQHlhdHRhLmdldFVzZXJJZCgpXG4gICAgICAgIEBhZGRDb25uZWN0aW9uIHBlZXIuY29ubmVjdCBpZFxuXG4gICAgZ2V0QWxsQ29ubmVjdGlvbklkczogKCktPlxuICAgICAgZm9yIGNvbm5faWQgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbm5faWRcblxuICAgICNcbiAgICAjIFdoYXQgdGhpcyBtZXRob2QgZG9lczpcbiAgICAjICogU2VuZCBzdGF0ZSB2ZWN0b3JcbiAgICAjICogUmVjZWl2ZSBIQiAtPiBhcHBseSB0aGVtXG4gICAgIyAqIFNlbmQgY29ubmVjdGlvbnNcbiAgICAjICogUmVjZWl2ZSBDb25uZWN0aW9ucyAtPiBDb25uZWN0IHRvIHVua25vdyBjb25uZWN0aW9uc1xuICAgICNcbiAgICBhZGRDb25uZWN0aW9uOiAoY29ubiktPlxuICAgICAgQGNvbm5lY3Rpb25zW2Nvbm4ucGVlcl0gPSBjb25uXG4gICAgICBpbml0aWFsaXplZF9tZSA9IGZhbHNlXG4gICAgICBpbml0aWFsaXplZF9oaW0gPSBmYWxzZVxuICAgICAgY29ubi5vbiAnZGF0YScsIChkYXRhKT0+XG4gICAgICAgIGlmIGRhdGEgaXMgXCJlbXB0eV9tZXNzYWdlXCJcbiAgICAgICAgICAjIG5vcFxuICAgICAgICBlbHNlIGlmIGRhdGEuSEI/XG4gICAgICAgICAgaW5pdGlhbGl6ZWRfbWUgPSB0cnVlXG4gICAgICAgICAgQGVuZ2luZS5hcHBseU9wc0NoZWNrRG91YmxlIGRhdGEuSEJcbiAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgIGNvbm5zOiBAZ2V0QWxsQ29ubmVjdGlvbklkcygpXG4gICAgICAgIGVsc2UgaWYgZGF0YS5vcD9cbiAgICAgICAgICBAZW5naW5lLmFwcGx5T3AgZGF0YS5vcFxuICAgICAgICBlbHNlIGlmIGRhdGEuY29ubnM/XG4gICAgICAgICAgZm9yIGNvbm5faWQgaW4gZGF0YS5jb25uc1xuICAgICAgICAgICAgQGNvbm5lY3RUb1BlZXIgY29ubl9pZFxuICAgICAgICBlbHNlIGlmIGRhdGEuc3RhdGVfdmVjdG9yP1xuICAgICAgICAgIGlmIG5vdCBpbml0aWFsaXplZF9oaW1cbiAgICAgICAgICAgICMgbWFrZSBzdXJlLCB0aGF0IGl0IGlzIHNlbnQgb25seSBvbmNlXG4gICAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgICAgSEI6IEB5YXR0YS5nZXRIaXN0b3J5QnVmZmVyKCkuX2VuY29kZShkYXRhLnN0YXRlX3ZlY3RvcilcbiAgICAgICAgICAgIGluaXRpYWxpemVkX2hpbSA9IHRydWVcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIkNhbid0IHBhcnNlIHRoaXMgb3BlcmF0aW9uXCJcblxuICAgICAgc2VuZFN0YXRlVmVjdG9yID0gKCk9PlxuICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICBzdGF0ZV92ZWN0b3I6IEBIQi5nZXRPcGVyYXRpb25Db3VudGVyKClcbiAgICAgICAgaWYgbm90IGluaXRpYWxpemVkX21lXG4gICAgICAgICAgIyBCZWNhdXNlIG9mIGEgYnVnIGluIFBlZXJKcyxcbiAgICAgICAgICAjIHdlIG5ldmVyIGtub3cgaWYgc3RhdGUgdmVjdG9yIHdhcyBhY3R1YWxseSBzZW50XG4gICAgICAgICAgc2V0VGltZW91dCBzZW5kU3RhdGVWZWN0b3IsIDEwMFxuICAgICAgc2VuZFN0YXRlVmVjdG9yKClcblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgZXhlY3V0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIGV4ZWN1dGVkLlxuICAgICNcbiAgICBzZW5kOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpcyBASEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgICAgZm9yIGNvbm5faWQsY29ubiBvZiBAY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICAgIG9wOiBvXG5cbiAgICAjXG4gICAgIyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aGVuZXZlciBhbiBvcGVyYXRpb24gd2FzIHJlY2VpdmVkIGZyb20gYW5vdGhlciBwZWVyLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG8gVGhlIG9wZXJhdGlvbiB0aGF0IHdhcyByZWNlaXZlZC5cbiAgICAjXG4gICAgcmVjZWl2ZTogKG8pLT5cbiAgICAgIGlmIG8udWlkLmNyZWF0b3IgaXNudCBASEIuZ2V0VXNlcklkKClcbiAgICAgICAgQGVuZ2luZS5hcHBseU9wIG9cblxuICBwZWVyLm9uICdvcGVuJywgKGlkKS0+XG4gICAgY2FsbGJhY2sgUGVlckpzQ29ubmVjdG9yLCBpZFxuXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlUGVlckpzQ29ubmVjdG9yXG5pZiB3aW5kb3c/XG4gIGlmIG5vdCB3aW5kb3cuWT9cbiAgICB3aW5kb3cuWSA9IHt9XG4gIHdpbmRvdy5ZLmNyZWF0ZVBlZXJKc0Nvbm5lY3RvciA9IGNyZWF0ZVBlZXJKc0Nvbm5lY3RvclxuXG4iXX0=
