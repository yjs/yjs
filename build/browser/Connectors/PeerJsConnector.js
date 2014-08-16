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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0Nvbm5lY3RvcnMvUGVlckpzQ29ubmVjdG9yLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0lBLElBQUEscUJBQUE7O0FBQUEscUJBQUEsR0FBd0IsU0FBQyxRQUFELEdBQUE7QUFFdEIsTUFBQSxxQkFBQTtBQUFBLEVBQUEsSUFBQSxHQUFXLElBQUEsSUFBQSxDQUFLO0FBQUEsSUFBQyxHQUFBLEVBQUssaUJBQU47R0FBTCxDQUFYLENBQUE7QUFBQSxFQUtNO0FBUVMsSUFBQSx5QkFBRSxNQUFGLEVBQVcsRUFBWCxFQUFnQixrQkFBaEIsRUFBcUMsS0FBckMsR0FBQTtBQUVYLFVBQUEsS0FBQTtBQUFBLE1BRlksSUFBQyxDQUFBLFNBQUEsTUFFYixDQUFBO0FBQUEsTUFGcUIsSUFBQyxDQUFBLEtBQUEsRUFFdEIsQ0FBQTtBQUFBLE1BRjBCLElBQUMsQ0FBQSxxQkFBQSxrQkFFM0IsQ0FBQTtBQUFBLE1BRitDLElBQUMsQ0FBQSxRQUFBLEtBRWhELENBQUE7QUFBQSxNQUFBLElBQUMsQ0FBQSxJQUFELEdBQVEsSUFBUixDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsV0FBRCxHQUFlLEVBRGYsQ0FBQTtBQUFBLE1BR0EsSUFBQyxDQUFBLElBQUksQ0FBQyxFQUFOLENBQVMsWUFBVCxFQUF1QixDQUFBLFNBQUEsS0FBQSxHQUFBO2VBQUEsU0FBQyxJQUFELEdBQUE7QUFDckIsVUFBQSxJQUFJLENBQUMsSUFBTCxDQUFVLEtBQVYsQ0FBQSxDQUFBO2lCQUNBLEtBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUZxQjtRQUFBLEVBQUE7TUFBQSxDQUFBLENBQUEsQ0FB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QUFJLENBQUMsSUFBTCxDQUNFO0FBQUEsWUFBQSxFQUFBLEVBQUksQ0FBSjtXQURGLEVBQUEsQ0FERjtBQUFBO3dCQURGO09BREk7SUFBQSxDQWpETixDQUFBOztBQUFBLDhCQTJEQSxPQUFBLEdBQVMsU0FBQyxDQUFELEdBQUE7QUFDUCxNQUFBLElBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFOLEtBQW1CLElBQUMsQ0FBQSxFQUFFLENBQUMsU0FBSixDQUFBLENBQXRCO2VBQ0UsSUFBQyxDQUFBLE1BQU0sQ0FBQyxPQUFSLENBQWdCLENBQWhCLEVBREY7T0FETztJQUFBLENBM0RULENBQUE7OzJCQUFBOztNQWJGLENBQUE7U0E0RUEsSUFBSSxDQUFDLEVBQUwsQ0FBUSxNQUFSLEVBQWdCLFNBQUMsRUFBRCxHQUFBO1dBQ2QsUUFBQSxDQUFTLGVBQVQsRUFBMEIsRUFBMUIsRUFEYztFQUFBLENBQWhCLEVBOUVzQjtBQUFBLENBQXhCLENBQUE7O0FBQUEsTUFrRk0sQ0FBQyxPQUFQLEdBQWlCLHFCQWxGakIsQ0FBQTs7QUFtRkEsSUFBRyxnREFBSDtBQUNFLEVBQUEsSUFBTyxnQkFBUDtBQUNFLElBQUEsTUFBTSxDQUFDLENBQVAsR0FBVyxFQUFYLENBREY7R0FBQTtBQUFBLEVBRUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxxQkFBVCxHQUFpQyxxQkFGakMsQ0FERjtDQW5GQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbiNcbiMgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGlzIGNhbGxlZCB3aGVuIHRoZSBjb25uZWN0b3IgaXMgaW5pdGlhbGl6ZWQuXG4jXG5jcmVhdGVQZWVySnNDb25uZWN0b3IgPSAoY2FsbGJhY2spLT5cblxuICBwZWVyID0gbmV3IFBlZXIge2tleTogJ2g3bmxlZmJnYXZoMXR0OSd9XG5cbiAgI1xuICAjIEBzZWUgaHR0cDovL3BlZXJqcy5jb21cbiAgI1xuICBjbGFzcyBQZWVySnNDb25uZWN0b3JcblxuICAgICNcbiAgICAjIEBwYXJhbSB7RW5naW5lfSBlbmdpbmUgVGhlIHRyYW5zZm9ybWF0aW9uIGVuZ2luZVxuICAgICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxuICAgICMgQHBhcmFtIHtBcnJheTxGdW5jdGlvbj59IGV4ZWN1dGlvbl9saXN0ZW5lciBZb3UgbXVzdCBlbnN1cmUgdGhhdCB3aGVuZXZlciBhbiBvcGVyYXRpb24gaXMgZXhlY3V0ZWQsIGV2ZXJ5IGZ1bmN0aW9uIGluIHRoaXMgQXJyYXkgaXMgY2FsbGVkLlxuICAgICMgQHBhcmFtIHtZYXR0YX0geWF0dGEgVGhlIFlhdHRhIGZyYW1ld29yay5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAZW5naW5lLCBASEIsIEBleGVjdXRpb25fbGlzdGVuZXIsIEB5YXR0YSktPlxuXG4gICAgICBAcGVlciA9IHBlZXJcbiAgICAgIEBjb25uZWN0aW9ucyA9IHt9XG5cbiAgICAgIEBwZWVyLm9uICdjb25uZWN0aW9uJywgKGNvbm4pPT5cbiAgICAgICAgY29ubi5zZW5kIFwiaGV5XCIgIyBpcyBuZXZlciBzZW5kLiBCdXQgd2l0aG91dCBpdCBpdCB3b24ndCB3b3JrIGVpdGhlci4uXG4gICAgICAgIEBhZGRDb25uZWN0aW9uIGNvbm5cblxuICAgICAgc2VuZF8gPSAobyk9PlxuICAgICAgICBAc2VuZCBvXG4gICAgICBAZXhlY3V0aW9uX2xpc3RlbmVyLnB1c2ggc2VuZF9cblxuICAgIGNvbm5lY3RUb1BlZXI6IChpZCktPlxuICAgICAgaWYgbm90IEBjb25uZWN0aW9uc1tpZF0/IGFuZCBpZCBpc250IEB5YXR0YS5nZXRVc2VySWQoKVxuICAgICAgICBAYWRkQ29ubmVjdGlvbiBwZWVyLmNvbm5lY3QgaWRcblxuICAgIGdldEFsbENvbm5lY3Rpb25JZHM6ICgpLT5cbiAgICAgIGZvciBjb25uX2lkIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICBjb25uX2lkXG5cbiAgICBhZGRDb25uZWN0aW9uOiAoY29ubiktPlxuICAgICAgQGNvbm5lY3Rpb25zW2Nvbm4ucGVlcl0gPSBjb25uXG5cbiAgICAgIGNvbm4ub24gJ2RhdGEnLCAoZGF0YSk9PlxuICAgICAgICBpZiBkYXRhIGlzIFwiaGV5XCJcbiAgICAgICAgICBjb25zb2xlLmxvZyBcIllhdHRhOiBDb25uZWN0aW9uIHJlY2VpdmVkIHdpdGggaW5pdCBtZXNzYWdlIChkZWJ1ZylcIiAjIEkgY2FuIHJlbW92ZSB0aGlzIGhleSBzdHVmZiB3aGVuIHRoaXMgaGFwcGVucy5cbiAgICAgICAgZWxzZSBpZiBkYXRhLkhCP1xuICAgICAgICAgIEBlbmdpbmUuYXBwbHlPcHNDaGVja0RvdWJsZSBkYXRhLkhCXG4gICAgICAgIGVsc2UgaWYgZGF0YS5vcD9cbiAgICAgICAgICBAZW5naW5lLmFwcGx5T3AgZGF0YS5vcFxuICAgICAgICBlbHNlIGlmIGRhdGEuY29ubnM/XG4gICAgICAgICAgZm9yIGNvbm5faWQgaW4gZGF0YS5jb25uc1xuICAgICAgICAgICAgQGNvbm5lY3RUb1BlZXIgY29ubl9pZFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiQ2FuJ3QgcGFyc2UgdGhpcyBvcGVyYXRpb25cIlxuXG4gICAgICBzZW5kSEIgPSAoKT0+XG4gICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgIEhCOiBAeWF0dGEuZ2V0SGlzdG9yeUJ1ZmZlcigpLl9lbmNvZGUoKVxuICAgICAgICBjb25uLnNlbmRcbiAgICAgICAgICBjb25uczogQGdldEFsbENvbm5lY3Rpb25JZHMoKVxuXG4gICAgICBzZXRUaW1lb3V0IHNlbmRIQiwgMTAwMFxuXG4gICAgI1xuICAgICMgVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2hlbmV2ZXIgYW4gb3BlcmF0aW9uIHdhcyBleGVjdXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBvIFRoZSBvcGVyYXRpb24gdGhhdCB3YXMgZXhlY3V0ZWQuXG4gICAgI1xuICAgIHNlbmQ6IChvKS0+XG4gICAgICBpZiBvLnVpZC5jcmVhdG9yIGlzIEBIQi5nZXRVc2VySWQoKSBhbmQgKHR5cGVvZiBvLnVpZC5vcF9udW1iZXIgaXNudCBcInN0cmluZ1wiKVxuICAgICAgICBmb3IgY29ubl9pZCxjb25uIG9mIEBjb25uZWN0aW9uc1xuICAgICAgICAgIGNvbm4uc2VuZFxuICAgICAgICAgICAgb3A6IG9cblxuICAgICNcbiAgICAjIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdoZW5ldmVyIGFuIG9wZXJhdGlvbiB3YXMgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHBlZXIuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbyBUaGUgb3BlcmF0aW9uIHRoYXQgd2FzIHJlY2VpdmVkLlxuICAgICNcbiAgICByZWNlaXZlOiAobyktPlxuICAgICAgaWYgby51aWQuY3JlYXRvciBpc250IEBIQi5nZXRVc2VySWQoKVxuICAgICAgICBAZW5naW5lLmFwcGx5T3Agb1xuXG4gIHBlZXIub24gJ29wZW4nLCAoaWQpLT5cbiAgICBjYWxsYmFjayBQZWVySnNDb25uZWN0b3IsIGlkXG5cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVQZWVySnNDb25uZWN0b3JcbmlmIHdpbmRvdz9cbiAgaWYgbm90IHdpbmRvdy5ZP1xuICAgIHdpbmRvdy5ZID0ge31cbiAgd2luZG93LlkuY3JlYXRlUGVlckpzQ29ubmVjdG9yID0gY3JlYXRlUGVlckpzQ29ubmVjdG9yXG5cbiJdfQ==
