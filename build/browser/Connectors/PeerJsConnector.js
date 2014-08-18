(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var createPeerJsConnector;

createPeerJsConnector = function(peer_js_parameters, callback) {
  var PeerJsConnector, peer;
  peer = new Peer(peer_js_parameters);
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
      var sendHB;
      this.connections[conn.peer] = conn;
      conn.on('data', (function(_this) {
        return function(data) {
          var conn_id, _i, _len, _ref, _results;
          if (data === "hey") {
            return console.log("Yatta: Connection received with init message (debug)");
          } else if (data.HB != null) {
            return _this.engine.applyOpsCheckDouble(data.HB);
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
          } else {
            throw new Error("Can't parse this operation");
          }
        };
      })(this));
      sendHB = (function(_this) {
        return function() {
          conn.send({
            HB: _this.yatta.getHistoryBuffer()._encode()
          });
          return conn.send({
            conns: _this.getAllConnectionIds()
          });
        };
      })(this);
      return setTimeout(sendHB, 1000);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvUGVlckpzQ29ubmVjdG9yLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0lBLElBQUEscUJBQUE7O0FBQUEscUJBQUEsR0FBd0IsU0FBQyxrQkFBRCxFQUFxQixRQUFyQixHQUFBO0FBRXRCLE1BQUEscUJBQUE7QUFBQSxFQUFBLElBQUEsR0FBVyxJQUFBLElBQUEsQ0FBSyxrQkFBTCxDQUFYLENBQUE7QUFBQSxFQUtNO0FBUVMsSUFBQSx5QkFBRSxNQUFGLEVBQVcsRUFBWCxFQUFnQixrQkFBaEIsRUFBcUMsS0FBckMsR0FBQTtBQUVYLFVBQUEsS0FBQTtBQUFBLE1BRlksSUFBQyxDQUFBLFNBQUEsTUFFYixDQUFBO0FBQUEsTUFGcUIsSUFBQyxDQUFBLEtBQUEsRUFFdEIsQ0FBQTtBQUFBLE1BRjBCLElBQUMsQ0FBQSxxQkFBQSxrQkFFM0IsQ0FBQTtBQUFBLE1BRitDLElBQUMsQ0FBQSxRQUFBLEtBRWhELENBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxJQUFELEdBQVEsSUFBUixDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsV0FBRCxHQUFlLEVBRGYsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLElBQUksQ0FBQyxFQUFOLENBQVMsWUFBVCxFQUF1QixDQUFBLFNBQUEsS0FBQSxHQUFBO2VBQUEsU0FBQyxJQUFELEdBQUE7QUFDckIsVUFBQSxJQUFJLENBQUMsSUFBTCxDQUFVLEtBQVYsQ0FBQSxDQUFBO2lCQUNBLEtBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUZxQjtRQUFBLEVBQUE7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQXZC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TCxDQUNFO0FBQUEsWUFBQSxFQUFBLEVBQUksQ0FBSjtXQURGLEVBQUEsQ0FERjtBQUFBO3dCQURGO09BREk7SUFBQSxDQWpETixDQUFBOztBQUFBLDhCQTJEQSxPQUFBLEdBQVMsU0FBQyxDQUFELEdBQUE7QUFDUCxNQUFBLElBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEtBQW1CLElBQUMsQ0FBQSxFQUFFLENBQUMsU0FBSixDQUFBLENBQXRCO2VBQ0UsSUFBQyxDQUFBLE1BQU0sQ0FBQyxPQUFSLENBQWdCLENBQWhCLEVBREY7T0FETztJQUFBLENBM0RULENBQUE7OzJCQUFBOztNQWJGLENBQUE7U0E0RUEsSUFBSSxDQUFDLEVBQUwsQ0FBUSxNQUFSLEVBQWdCLFNBQUMsRUFBRCxHQUFBO1dBQ2QsUUFBQSxDQUFTLGVBQVQsRUFBMEIsRUFBMUIsRUFEYztFQUFBLENBQWhCLEVBOUVzQjtBQUFBLENBQXhCLENBQUE7O0FBQUEsTUFrRk0sQ0FBQyxPQUFQLEdBQWlCLHFCQWxGakIsQ0FBQTs7QUFtRkEsSUFBRyxnREFBSDtBQUNFLEVBQUEsSUFBTyxnQkFBUDtBQUNFLElBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxFQUFYLENBREY7R0FBQTtBQUFBLEVBRUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxxQkFBVCxHQUFpQyxxQkFGakMsQ0FERjtDQW5GQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbiNcbiMgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSBjb25uZWN0b3IgaXMgaW5pdGlhbGl6ZWQuXG4jXG5jcmVhdGVQZWVySnNDb25uZWN0b3IgPSAocGVlcl9qc19wYXJhbWV0ZXJzLCBjYWxsYmFjayktPlxuXG4gIHBlZXIgPSBuZXcgUGVlciBwZWVyX2pzX3BhcmFtZXRlcnNcblxuICAjXG4gICMgQHNlZSBodHRwOi8vcGVlcmpzLmNvbVxuICAjXG4gIGNsYXNzIFBlZXJKc0Nvbm5lY3RvclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4gICAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICAgIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4gICAgIyBAcGFyYW0ge1lhdHRhfSB5YXR0YSBUaGUgWWF0dGEgZnJhbWV3b3JrLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBlbmdpbmUsIEBIQiwgQGV4ZWN1dGlvbl9saXN0ZW5lciwgQHlhdHRhKS0+XG5cbiAgICAgIEBwZWVyID0gcGVlclxuICAgICAgQGNvbm5lY3Rpb25zID0ge31cblxuICAgICAgQHBlZXIub24gJ2Nvbm5lY3Rpb24nLCAoY29ubik9PlxuICAgICAgICBjb25uLnNlbmQgXCJoZXlcIiAjIGlzIG5ldmVyIHNlbmQuIEJ1dCB3aXRob3V0IGl0IGl0IHdvbid0IHdvcmsgZWl0aGVyLi5cbiAgICAgICAgQGFkZENvbm5lY3Rpb24gY29ublxuXG4gICAgICBzZW5kXyA9IChvKT0+XG4gICAgICAgIEBzZW5kIG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG4gICAgY29ubmVjdFRvUGVlcjogKGlkKS0+XG4gICAgICBpZiBub3QgQGNvbm5lY3Rpb25zW2lkXT8gYW5kIGlkIGlzbnQgQHlhdHRhLmdldFVzZXJJZCgpXG4gICAgICAgIEBhZGRDb25uZWN0aW9uIHBlZXIuY29ubmVjdCBpZFxuXG4gICAgZ2V0QWxsQ29ubmVjdGlvbklkczogKCktPlxuICAgICAgZm9yIGNvbm5faWQgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbm5faWRcblxuICAgIGFkZENvbm5lY3Rpb246IChjb25uKS0+XG4gICAgICBAY29ubmVjdGlvbnNbY29ubi5wZWVyXSA9IGNvbm5cblxuICAgICAgY29ubi5vbiAnZGF0YScsIChkYXRhKT0+XG4gICAgICAgIGlmIGRhdGEgaXMgXCJoZXlcIlxuICAgICAgICAgIGNvbnNvbGUubG9nIFwiWWF0dGE6IENvbm5lY3Rpb24gcmVjZWl2ZWQgd2l0aCBpbml0IG1lc3NhZ2UgKGRlYnVnKVwiICMgSSBjYW4gcmVtb3ZlIHRoaXMgaGV5IHN0dWZmIHdoZW4gdGhpcyBoYXBwZW5zLlxuICAgICAgICBlbHNlIGlmIGRhdGEuSEI/XG4gICAgICAgICAgQGVuZ2luZS5hcHBseU9wc0NoZWNrRG91YmxlIGRhdGEuSEJcbiAgICAgICAgZWxzZSBpZiBkYXRhLm9wP1xuICAgICAgICAgIEBlbmdpbmUuYXBwbHlPcCBkYXRhLm9wXG4gICAgICAgIGVsc2UgaWYgZGF0YS5jb25ucz9cbiAgICAgICAgICBmb3IgY29ubl9pZCBpbiBkYXRhLmNvbm5zXG4gICAgICAgICAgICBAY29ubmVjdFRvUGVlciBjb25uX2lkXG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJDYW4ndCBwYXJzZSB0aGlzIG9wZXJhdGlvblwiXG5cbiAgICAgIHNlbmRIQiA9ICgpPT5cbiAgICAgICAgY29ubi5zZW5kXG4gICAgICAgICAgSEI6IEB5YXR0YS5nZXRIaXN0b3J5QnVmZmVyKCkuX2VuY29kZSgpXG4gICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgIGNvbm5zOiBAZ2V0QWxsQ29ubmVjdGlvbklkcygpXG5cbiAgICAgIHNldFRpbWVvdXQgc2VuZEhCLCAxMDAwXG5cbiAgICAjXG4gICAgIyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aGVuZXZlciBhbiBvcGVyYXRpb24gd2FzIGV4ZWN1dGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG8gVGhlIG9wZXJhdGlvbiB0aGF0IHdhcyBleGVjdXRlZC5cbiAgICAjXG4gICAgc2VuZDogKG8pLT5cbiAgICAgIGlmIG8udWlkLmNyZWF0b3IgaXMgQEhCLmdldFVzZXJJZCgpIGFuZCAodHlwZW9mIG8udWlkLm9wX251bWJlciBpc250IFwic3RyaW5nXCIpXG4gICAgICAgIGZvciBjb25uX2lkLGNvbm4gb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29ubi5zZW5kXG4gICAgICAgICAgICBvcDogb1xuXG4gICAgI1xuICAgICMgVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIHdhcyByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBvIFRoZSBvcGVyYXRpb24gdGhhdCB3YXMgcmVjZWl2ZWQuXG4gICAgI1xuICAgIHJlY2VpdmU6IChvKS0+XG4gICAgICBpZiBvLnVpZC5jcmVhdG9yIGlzbnQgQEhCLmdldFVzZXJJZCgpXG4gICAgICAgIEBlbmdpbmUuYXBwbHlPcCBvXG5cbiAgcGVlci5vbiAnb3BlbicsIChpZCktPlxuICAgIGNhbGxiYWNrIFBlZXJKc0Nvbm5lY3RvciwgaWRcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVBlZXJKc0Nvbm5lY3RvclxuaWYgd2luZG93P1xuICBpZiBub3Qgd2luZG93Llk/XG4gICAgd2luZG93LlkgPSB7fVxuICB3aW5kb3cuWS5jcmVhdGVQZWVySnNDb25uZWN0b3IgPSBjcmVhdGVQZWVySnNDb25uZWN0b3JcblxuIl19
