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
          console.log("received conn");
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
          console.log("data: " + data);
          if (data.HB != null) {
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
          console.log("sending...");
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
        console.log("trying to send ops");
        _ref = this.connections;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          conn = _ref[_i];
          console.log("sent op");
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
    console.log(id);
    return callback(PeerJsConnector, id);
  });
};

module.exports = createPeerJsConnector;

if (typeof window !== "undefined" && window !== null) {
  window.createPeerJsConnector = createPeerJsConnector;
}


},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvUGVlckpzQ29ubmVjdG9yLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0lBLElBQUEscUJBQUE7O0FBQUEscUJBQUEsR0FBd0IsU0FBQyxRQUFELEdBQUE7QUFFdEIsTUFBQSxxQkFBQTtBQUFBLEVBQUEsSUFBQSxHQUFXLElBQUEsSUFBQSxDQUFLO0FBQUEsSUFBQyxHQUFBLEVBQUssaUJBQU47R0FBTCxDQUFYLENBQUE7QUFBQSxFQUtNO0FBUVMsSUFBQSx5QkFBRSxNQUFGLEVBQVcsRUFBWCxFQUFnQixrQkFBaEIsRUFBcUMsS0FBckMsR0FBQTtBQUVYLFVBQUEsS0FBQTtBQUFBLE1BRlksSUFBQyxDQUFBLFNBQUEsTUFFYixDQUFBO0FBQUEsTUFGcUIsSUFBQyxDQUFBLEtBQUEsRUFFdEIsQ0FBQTtBQUFBLE1BRjBCLElBQUMsQ0FBQSxxQkFBQSxrQkFFM0IsQ0FBQTtBQUFBLE1BRitDLElBQUMsQ0FBQSxRQUFBLEtBRWhELENBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxJQUFELEdBQVEsSUFBUixDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsV0FBRCxHQUFlLEVBRGYsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLElBQUksQ0FBQyxFQUFOLENBQVMsWUFBVCxFQUF1QixDQUFBLFNBQUEsS0FBQSxHQUFBO2VBQUEsU0FBQyxJQUFELEdBQUE7QUFDckIsVUFBQSxPQUFPLENBQUMsR0FBUixDQUFZLGVBQVosQ0FBQSxDQUFBO2lCQUNBLEtBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUZxQjtRQUFBLEVBQUE7TUFBQSxDQUFBLENBQUEsQ0FB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cUVBLElBQUksQ0FBQyxFQUFMLENBQVEsTUFBUixFQUFnQixTQUFDLEVBQUQsR0FBQTtBQUNkLElBQUEsT0FBTyxDQUFDLEdBQVIsQ0FBWSxFQUFaLENBQUEsQ0FBQTtXQUNBLFFBQUEsQ0FBUyxlQUFULEVBQTBCLEVBQTFCLEVBRmM7RUFBQSxDQUFoQixFQXZFc0I7QUFBQSxDQUF4QixDQUFBOztBQUFBLE1BNEVNLENBQUMsT0FBUCxHQUFpQixxQkE1RWpCLENBQUE7OztFQTZFQSxNQUFNLENBQUUscUJBQVIsR0FBZ0M7Q0E3RWhDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuI1xuIyBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbm5lY3RvciBpcyBpbml0aWFsaXplZC5cbiNcbmNyZWF0ZVBlZXJKc0Nvbm5lY3RvciA9IChjYWxsYmFjayktPlxuXG4gIHBlZXIgPSBuZXcgUGVlciB7a2V5OiAnaDdubGVmYmdhdmgxdHQ5J31cblxuICAjXG4gICMgQHNlZSBodHRwOi8vcGVlcmpzLmNvbVxuICAjXG4gIGNsYXNzIFBlZXJKc0Nvbm5lY3RvclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtFbmdpbmV9IGVuZ2luZSBUaGUgdHJhbnNmb3JtYXRpb24gZW5naW5lXG4gICAgIyBAcGFyYW0ge0hpc3RvcnlCdWZmZXJ9IEhCXG4gICAgIyBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gZXhlY3V0aW9uX2xpc3RlbmVyIFlvdSBtdXN0IGVuc3VyZSB0aGF0IHdoZW5ldmVyIGFuIG9wZXJhdGlvbiBpcyBleGVjdXRlZCwgZXZlcnkgZnVuY3Rpb24gaW4gdGhpcyBBcnJheSBpcyBjYWxsZWQuXG4gICAgIyBAcGFyYW0ge1lhdHRhfSB5YXR0YSBUaGUgWWF0dGEgZnJhbWV3b3JrLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKEBlbmdpbmUsIEBIQiwgQGV4ZWN1dGlvbl9saXN0ZW5lciwgQHlhdHRhKS0+XG5cbiAgICAgIEBwZWVyID0gcGVlclxuICAgICAgQGNvbm5lY3Rpb25zID0gW11cblxuICAgICAgQHBlZXIub24gJ2Nvbm5lY3Rpb24nLCAoY29ubik9PlxuICAgICAgICBjb25zb2xlLmxvZyBcInJlY2VpdmVkIGNvbm5cIlxuICAgICAgICBAYWRkQ29ubmVjdGlvbiBjb25uXG5cblxuXG4gICAgICBzZW5kXyA9IChvKT0+XG4gICAgICAgIEBzZW5kIG9cbiAgICAgIEBleGVjdXRpb25fbGlzdGVuZXIucHVzaCBzZW5kX1xuXG4gICAgY29ubmVjdFRvUGVlcjogKGlkKS0+XG4gICAgICBAYWRkQ29ubmVjdGlvbiBwZWVyLmNvbm5lY3QgaWRcblxuICAgIGFkZENvbm5lY3Rpb246IChjb25uKS0+XG4gICAgICBAY29ubmVjdGlvbnMucHVzaCBjb25uXG5cbiAgICAgIGNvbm4ub24gJ2RhdGEnLCAoZGF0YSk9PlxuICAgICAgICBjb25zb2xlLmxvZyBcImRhdGE6ICN7ZGF0YX1cIlxuICAgICAgICBpZiBkYXRhLkhCP1xuICAgICAgICAgIEBlbmdpbmUuYXBwbHlPcHNDaGVja0RvdWJsZSBkYXRhLkhCXG4gICAgICAgIGVsc2UgaWYgZGF0YS5vcD9cbiAgICAgICAgICBAZW5naW5lLmFwcGx5T3AgZGF0YS5vcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiQ2FuJ3QgcGFyc2UgdGhpcyBvcGVyYXRpb25cIlxuXG4gICAgICBzZW5kSEIgPSAoKT0+XG4gICAgICAgIGNvbnNvbGUubG9nIFwic2VuZGluZy4uLlwiXG4gICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgIEhCOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoKVxuICAgICAgc2V0VGltZW91dCBzZW5kSEIsIDEwMDBcblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgZXhlY3V0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIGV4ZWN1dGVkLlxuICAgICNcbiAgICBzZW5kOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpcyBASEIuZ2V0VXNlcklkKCkgYW5kICh0eXBlb2Ygby51aWQub3BfbnVtYmVyIGlzbnQgXCJzdHJpbmdcIilcbiAgICAgICAgY29uc29sZS5sb2cgXCJ0cnlpbmcgdG8gc2VuZCBvcHNcIlxuICAgICAgICBmb3IgY29ubiBpbiBAY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zb2xlLmxvZyBcInNlbnQgb3BcIlxuICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgb3A6IG9cblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIHJlY2VpdmVkLlxuICAgICNcbiAgICByZWNlaXZlOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpc250IEBIQi5nZXRVc2VySWQoKVxuICAgICAgICBAZW5naW5lLmFwcGx5T3Agb1xuXG4gIHBlZXIub24gJ29wZW4nLCAoaWQpLT5cbiAgICBjb25zb2xlLmxvZyBpZFxuICAgIGNhbGxiYWNrIFBlZXJKc0Nvbm5lY3RvciwgaWRcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVBlZXJKc0Nvbm5lY3Rvclxud2luZG93Py5jcmVhdGVQZWVySnNDb25uZWN0b3IgPSBjcmVhdGVQZWVySnNDb25uZWN0b3JcblxuIl19
