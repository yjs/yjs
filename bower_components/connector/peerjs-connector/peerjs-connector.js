(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Connector;

Connector = (function() {
  function Connector() {
    this.is_synced = false;
    this.compute_when_synced = [];
    this.connections = {};
    this.unsynced_connections = {};
    this.receive_handlers = [];
    this.sync_process_order = [];
  }

  Connector.prototype.whenSynced = function(args) {
    if (this.is_synced) {
      return args[0].apply(this, args.slice(1));
    } else {
      return this.compute_when_synced.push(args);
    }
  };

  Connector.prototype.whenReceiving = function(f) {
    return this.receive_handlers.push(f);
  };

  Connector.prototype.multicast = function(peers, message) {
    return this.whenSynced([_send, peers, message]);
  };

  Connector.prototype.unicast = function(peer, message) {
    return this.whenSynced([_send, peer, message]);
  };

  Connector.prototype.broadcast = function(message) {
    return this.whenSynced([
      (function(_this) {
        return function() {
          var peer, peerid, _ref, _results;
          _ref = _this.connections;
          _results = [];
          for (peerid in _ref) {
            peer = _ref[peerid];
            _results.push(_this._send(peerid, message));
          }
          return _results;
        };
      })(this)
    ]);
  };

  Connector.prototype.whenSyncing = function() {
    var i, _i, _ref, _results;
    _results = [];
    for (i = _i = _ref = arguments.length - 1; _ref <= 0 ? _i <= 0 : _i >= 0; i = _ref <= 0 ? ++_i : --_i) {
      _results.push(this.sync_process_order.unshift(arguments[i]));
    }
    return _results;
  };

  return Connector;

})();

module.exports = Connector;



},{}],2:[function(require,module,exports){
var Connector, PeerJsConnector,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Connector = require('../connector');

window.PeerJsConnector = PeerJsConnector = (function(_super) {
  __extends(PeerJsConnector, _super);

  function PeerJsConnector(id, options) {
    var that;
    this.id = id;
    this._addConnection = __bind(this._addConnection, this);
    PeerJsConnector.__super__.constructor.call(this);
    that = this;
    this.sync_process_order.push(function() {
      var conn, peerid, peers;
      peers = (function() {
        var _ref, _results;
        _ref = that.connections;
        _results = [];
        for (peerid in _ref) {
          conn = _ref[peerid];
          _results.push(peerid);
        }
        return _results;
      })();
      return peers;
    });
    this.sync_process_order.push(function(peers) {
      var peerid, _i, _len;
      for (_i = 0, _len = peers.length; _i < _len; _i++) {
        peerid = peers[_i];
        that.join(peerid);
      }
      return true;
    });
    this.conn = new Peer(this.id, options);
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
  }

  PeerJsConnector.prototype.join = function(peerid) {
    var peer;
    if ((this.unsynced_connections[peerid] == null) && (this.connections[peerid] == null) && peerid !== this.id) {
      peer = this.conn.connect(peerid, {
        reliable: true
      });
      this.unsynced_connections[peerid] = peer;
      this._addConnection(peer);
      return true;
    } else {
      return false;
    }
  };

  PeerJsConnector.prototype._send = function(peer_s, message) {
    var error, errors, peer, _i, _len;
    if (peer_s.constructor === [].constructor) {
      errors = [];
      for (_i = 0, _len = peer_s.length; _i < _len; _i++) {
        peer = peer_s[_i];
        try {
          this.connection[peer].send(message);
        } catch (_error) {
          error = _error;
          errors.push(error + "");
        }
      }
      if (errors.length > 0) {
        throw new Error(errors);
      }
    } else {
      return this.connections[peer_s].send(message);
    }
  };

  PeerJsConnector.prototype._addConnection = function(peer) {
    return peer.on('open', (function(_this) {
      return function() {
        var current_sync_i, that;
        that = _this;
        peer.send(that.sync_process_order[0]());
        current_sync_i = 1;
        return peer.on('data', function(data) {
          var comp, f, isEmpty, _i, _j, _len, _len1, _ref, _ref1, _results;
          console.log("receive data: " + (JSON.stringify(data)));
          if (current_sync_i < that.sync_process_order.length) {
            return peer.send(that.sync_process_order[current_sync_i++].call(that, data));
          } else if (current_sync_i === that.sync_process_order.length) {
            current_sync_i++;
            delete that.unsynced_connections[peer.peer];
            that.connections[peer.peer] = peer;
            peer.on('close', function() {
              return delete that.connections[peer.peer];
            });
            isEmpty = function(os) {
              var o;
              for (o in os) {
                return false;
              }
              return true;
            };
            if (isEmpty(that.unsynced_connections)) {
              that.is_synced = true;
              _ref = that.compute_when_synced;
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                comp = _ref[_i];
                comp[0].apply(that, comp.slice(1));
              }
              return that.compute_when_synced = [];
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

})(Connector);



},{"../connector":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvbGliL2Nvbm5lY3Rvci5jb2ZmZWUiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvbGliL3BlZXJqcy1jb25uZWN0b3IvcGVlcmpzLWNvbm5lY3Rvci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNDQSxJQUFBLFNBQUE7O0FBQUE7QUFFZSxFQUFBLG1CQUFBLEdBQUE7QUFFWCxJQUFBLElBQUMsQ0FBQSxTQUFELEdBQWEsS0FBYixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsbUJBQUQsR0FBdUIsRUFGdkIsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLFdBQUQsR0FBZSxFQUpmLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxvQkFBRCxHQUF3QixFQU54QixDQUFBO0FBQUEsSUFRQSxJQUFDLENBQUEsZ0JBQUQsR0FBb0IsRUFScEIsQ0FBQTtBQUFBLElBVUEsSUFBQyxDQUFBLGtCQUFELEdBQXNCLEVBVnRCLENBRlc7RUFBQSxDQUFiOztBQUFBLHNCQWtCQSxVQUFBLEdBQVksU0FBQyxJQUFELEdBQUE7QUFDVixJQUFBLElBQUcsSUFBQyxDQUFBLFNBQUo7YUFDRSxJQUFLLENBQUEsQ0FBQSxDQUFFLENBQUMsS0FBUixDQUFjLElBQWQsRUFBb0IsSUFBSyxTQUF6QixFQURGO0tBQUEsTUFBQTthQUdFLElBQUMsQ0FBQSxtQkFBbUIsQ0FBQyxJQUFyQixDQUEwQixJQUExQixFQUhGO0tBRFU7RUFBQSxDQWxCWixDQUFBOztBQUFBLHNCQTRCQSxhQUFBLEdBQWUsU0FBQyxDQUFELEdBQUE7V0FDYixJQUFDLENBQUEsZ0JBQWdCLENBQUMsSUFBbEIsQ0FBdUIsQ0FBdkIsRUFEYTtFQUFBLENBNUJm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QUEsSUFBSSxDQUFDLElBQUwsQ0FGakMsQ0FBQTtBQUFBLFlBR0EsSUFBSSxDQUFDLFdBQVksQ0FBQSxJQUFJLENBQUMsSUFBTCxDQUFqQixHQUE4QixJQUg5QixDQUFBO0FBQUEsWUFLQSxJQUFJLENBQUMsRUFBTCxDQUFRLE9BQVIsRUFBaUIsU0FBQSxHQUFBO3FCQUNmLE1BQUEsQ0FBQSxJQUFXLENBQUMsV0FBWSxDQUFBLElBQUksQ0FBQyxJQUFMLEVBRFQ7WUFBQSxDQUFqQixDQUxBLENBQUE7QUFBQSxZQVFBLE9BQUEsR0FBVSxTQUFDLEVBQUQsR0FBQTtBQUNSLGtCQUFBLENBQUE7QUFBQSxtQkFBQSxPQUFBLEdBQUE7QUFDRSx1QkFBTyxLQUFQLENBREY7QUFBQSxlQUFBO0FBRUEscUJBQU8sSUFBUCxDQUhRO1lBQUEsQ0FSVixDQUFBO0FBWUEsWUFBQSxJQUFHLE9BQUEsQ0FBUSxJQUFJLENBQUMsb0JBQWIsQ0FBSDtBQUdFLGNBQUEsSUFBSSxDQUFDLFNBQUwsR0FBaUIsSUFBakIsQ0FBQTtBQUNBO0FBQUEsbUJBQUEsMkNBQUE7Z0NBQUE7QUFDRSxnQkFBQSxJQUFLLENBQUEsQ0FBQSxDQUFFLENBQUMsS0FBUixDQUFjLElBQWQsRUFBb0IsSUFBSyxTQUF6QixDQUFBLENBREY7QUFBQSxlQURBO3FCQUdBLElBQUksQ0FBQyxtQkFBTCxHQUEyQixHQU43QjthQWRHO1dBQUEsTUFBQTtBQXdCSDtBQUFBO2lCQUFBLDhDQUFBOzRCQUFBO0FBQ0UsNEJBQUEsQ0FBQSxDQUFFLElBQUksQ0FBQyxJQUFQLEVBQWEsSUFBYixFQUFBLENBREY7QUFBQTs0QkF4Qkc7V0FKUztRQUFBLENBQWhCLEVBSmM7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFoQixFQURjO0VBQUEsQ0FsRWhCLENBQUE7O3lCQUFBOztHQUZxRCxVQUZ2RCxDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuY2xhc3MgQ29ubmVjdG9yXG4gIFxuICBjb25zdHJ1Y3RvcjogKCktPlxuICAgICMgaXMgc2V0IHRvIHRydWUgd2hlbiB0aGlzIGlzIHN5bmNlZCB3aXRoIGFsbCBvdGhlciBjb25uZWN0aW9uc1xuICAgIEBpc19zeW5jZWQgPSBmYWxzZVxuICAgICMgY29tcHV0ZSBhbGwgb2YgdGhlc2UgZnVuY3Rpb25zIHdoZW4gYWxsIGNvbm5lY3Rpb25zIGFyZSBzeW5jZWQuXG4gICAgQGNvbXB1dGVfd2hlbl9zeW5jZWQgPSBbXVxuICAgICMgUGVlcmpzIENvbm5lY3Rpb25zOiBrZXk6IGNvbm4taWQsIHZhbHVlOiBjb25uXG4gICAgQGNvbm5lY3Rpb25zID0ge31cbiAgICAjIENvbm5lY3Rpb25zLCB0aGF0IGhhdmUgYmVlbiBpbml0aWFsaXplZCwgYnV0IGhhdmUgbm90IGJlZW4gKGZ1bGx5KSBzeW5jZWQgeWV0LlxuICAgIEB1bnN5bmNlZF9jb25uZWN0aW9ucyA9IHt9XG4gICAgIyBMaXN0IG9mIGZ1bmN0aW9ucyB0aGF0IHNoYWxsIHByb2Nlc3MgaW5jb21pbmcgZGF0YVxuICAgIEByZWNlaXZlX2hhbmRsZXJzID0gW11cbiAgICAjIEEgbGlzdCBvZiBmdW5jdGlvbnMgdGhhdCBhcmUgZXhlY3V0ZWQgKGxlZnQgdG8gcmlnaHQpIHdoZW4gc3luY2luZyB3aXRoIGEgcGVlci4gXG4gICAgQHN5bmNfcHJvY2Vzc19vcmRlciA9IFtdXG4gICAgXG4gICNcbiAgIyBFeGVjdXRlIGEgZnVuY3Rpb24gX3doZW5fIHdlIGFyZSBjb25uZWN0ZWQuIElmIG5vdCBjb25uZWN0ZWQsIHdhaXQgdW50aWwgY29ubmVjdGVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LlxuICAjXG4gIHdoZW5TeW5jZWQ6IChhcmdzKS0+XG4gICAgaWYgQGlzX3N5bmNlZFxuICAgICAgYXJnc1swXS5hcHBseSB0aGlzLCBhcmdzWzEuLl1cbiAgICBlbHNlXG4gICAgICBAY29tcHV0ZV93aGVuX3N5bmNlZC5wdXNoIGFyZ3MgXG4gIFxuICAjXG4gICMgRXhlY3V0ZSBhbiBmdW5jdGlvbiBfd2hlbl8gYSBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAjIEBwYXJhbSBmIHtGdW5jdGlvbn0gV2lsbCBiZSBleGVjdXRlZCBvbiB0aGUgUGVlckpzLUNvbm5lY3RvciBjb250ZXh0LiBmIHdpbGwgYmUgY2FsbGVkIHdpdGggKHNlbmRlcl9pZCwgYnJvYWRjYXN0IHt0cnVlfGZhbHNlfSwgbWVzc2FnZSkuXG4gICNcbiAgd2hlblJlY2VpdmluZzogKGYpLT5cbiAgICBAcmVjZWl2ZV9oYW5kbGVycy5wdXNoIGZcbiAgXG4gICNcbiAgIyBTZW5kIGEgbWVzc2FnZSB0byBhIChzdWIpLXNldCBvZiBhbGwgY29ubmVjdGVkIHBlZXJzLlxuICAjIEBwYXJhbSBwZWVycyB7QXJyYXk8Y29ubmVjdGlvbl9pZHM+fSBBIHNldCBvZiBpZHMuXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gc2VuZC5cbiAgI1xuICBtdWx0aWNhc3Q6IChwZWVycywgbWVzc2FnZSktPlxuICAgIEB3aGVuU3luY2VkIFtfc2VuZCwgcGVlcnMsIG1lc3NhZ2VdXG4gIFxuICAjXG4gICMgU2VuZCBhIG1lc3NhZ2UgdG8gb25lIG9mIHRoZSBjb25uZWN0ZWQgcGVlcnMuXG4gICMgQHBhcmFtIHBlZXJzIHtjb25uZWN0aW9uX2lkfSBBIGNvbm5lY3Rpb24gaWQuXG4gICMgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gVGhlIG1lc3NhZ2UgdG8gc2VuZC5cbiAgI1xuICB1bmljYXN0OiAocGVlciwgbWVzc2FnZSktPlxuICAgIEB3aGVuU3luY2VkIFtfc2VuZCwgcGVlciwgbWVzc2FnZV1cbiAgXG4gICMgXG4gICMgQnJvYWRjYXN0IGEgbWVzc2FnZSB0byBhbGwgY29ubmVjdGVkIHBlZXJzLlxuICAjIEBwYXJhbSBtZXNzYWdlIHtPYmplY3R9IFRoZSBtZXNzYWdlIHRvIGJyb2FkY2FzdC5cbiAgIyBcbiAgYnJvYWRjYXN0OiAobWVzc2FnZSktPlxuICAgIEB3aGVuU3luY2VkIFsoKT0+XG4gICAgICBmb3IgcGVlcmlkLHBlZXIgb2YgQGNvbm5lY3Rpb25zXG4gICAgICAgIEBfc2VuZCBwZWVyaWQsIG1lc3NhZ2VdXG4gXG4gICNcbiAgIyBEZWZpbmUgaG93IHlvdSB3YW50IHRvIGhhbmRsZSB0aGUgc3luYyBwcm9jZXNzIG9mIHR3byB1c2Vycy5cbiAgIyBUaGlzIGlzIGEgc3luY2hyb25vdXMgaGFuZHNoYWtlLiBFdmVyeSB1c2VyIHdpbGwgcGVyZm9ybSBleGFjdGx5IHRoZSBzYW1lIGFjdGlvbnMgYXQgdGhlIHNhbWUgdGltZS4gRS5nLlxuICAjIEBleGFtcGxlXG4gICMgICB3aGVuU3luY2luZyhmdW5jdGlvbigpeyAvLyBmaXJzdCBjYWxsIG11c3Qgbm90IGhhdmUgcGFyYW1ldGVycyFcbiAgIyAgICAgICByZXR1cm4gdGhpcy5pZDsgLy8gU2VuZCB0aGUgaWQgb2YgdGhpcyBjb25uZWN0b3IuXG4gICMgICB9LGZ1bmN0aW9uKHBlZXJpZCl7IC8vIHlvdSByZWNlaXZlIHRoZSBwZWVyaWQgb2YgdGhlIG90aGVyIGNvbm5lY3Rpb25zLlxuICAjICAgICAgIC8vIHlvdSBjYW4gZG8gc29tZXRoaW5nIHdpdGggdGhlIHBlZXJpZFxuICAjICAgICAgIC8vIHJldHVybiBcInlvdSBhcmUgbXkgZnJpZW5kXCI7IC8vIHlvdSBjb3VsZCBzZW5kIGFub3RoZXIgbWFzc2FnZS5cbiAgIyAgIH0pOyAvLyB0aGlzIGlzIHRoZSBlbmQgb2YgdGhlIHN5bmMgcHJvY2Vzcy5cbiAgI1xuICB3aGVuU3luY2luZzogKCktPlxuICAgIGZvciBpIGluIFsoYXJndW1lbnRzLmxlbmd0aC0xKS4uMF1cbiAgICAgIEBzeW5jX3Byb2Nlc3Nfb3JkZXIudW5zaGlmdCBhcmd1bWVudHNbaV1cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gQ29ubmVjdG9yXG4iLCJDb25uZWN0b3IgPSByZXF1aXJlICcuLi9jb25uZWN0b3InXG4gICAgICBcbndpbmRvdy5QZWVySnNDb25uZWN0b3IgPSBjbGFzcyBQZWVySnNDb25uZWN0b3IgZXh0ZW5kcyBDb25uZWN0b3JcbiAgXG4gIGNvbnN0cnVjdG9yOiAoQGlkLCBvcHRpb25zKS0+XG4gICAgc3VwZXIoKVxuICAgIHRoYXQgPSB0aGlzXG4gICAgIyBUaGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnMgc2hvdWxkIGJlIHBlcmZvcm1lZCBhdCB0aGUgZW5kIG9mIHRoZSBzeW5jaW5nIHByb2Nlc3MuXG4gICAgIyBJbiBwZWVyanMgYWxsIGNvbm5lY3Rpb24gaWRzIG11c3QgYmUgc2VuZC4gXG4gICAgQHN5bmNfcHJvY2Vzc19vcmRlci5wdXNoICgpLT5cbiAgICAgIHBlZXJzID0gZm9yIHBlZXJpZCxjb25uIG9mIHRoYXQuY29ubmVjdGlvbnMgXG4gICAgICAgIHBlZXJpZFxuICAgICAgcGVlcnMgXG4gICAgIyBUaGVuIGNvbm5lY3QgdG8gdGhlIGNvbm5lY3Rpb24gaWRzLiBcbiAgICBAc3luY19wcm9jZXNzX29yZGVyLnB1c2ggKHBlZXJzKS0+XG4gICAgICBmb3IgcGVlcmlkIGluIHBlZXJzIFxuICAgICAgICAgIHRoYXQuam9pbiBwZWVyaWRcbiAgICAgIHRydWUgXG4gICAgIyBDcmVhdGUgdGhlIFBlZXJqcyBpbnN0YW5jZVxuICAgIEBjb25uID0gbmV3IFBlZXIgQGlkLCBvcHRpb25zXG4gICAgIyBUT0RPOiBpbXByb3ZlIGVycm9yIGhhbmRsaW5nLCB3aGF0IGhhcHBlbnMgaWYgZGlzY29ubmVjdGVkPyBwcm92aWRlIGZlZWRiYWNrXG4gICAgQGNvbm4ub24gJ2Vycm9yJywgKGVyciktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUGVlcmpzIGNvbm5lY3RvcjogI3tlcnJ9XCJcbiAgICBAY29ubi5vbiAnZGlzY29ubmVjdGVkJywgKCktPlxuICAgICAgdGhyb3cgbmV3IEVycm9yIFwiUGVlcmpzIGNvbm5lY3RvciBkaXNjb25uZWN0ZWQgZnJvbSBzaWduYWxsaW5nIHNlcnZlci4gQ2Fubm90IGFjY2VwdCBuZXcgY29ubmVjdGlvbnMuIE5vdCBmYXRhbCwgYnV0IG5vdCBzbyBnb29kIGVpdGhlci4uXCJcbiAgICBAY29ubi5vbiAnZGlzY29ubmVjdCcsICgpLT5cbiAgICAgIHRoYXQuY29ubi5yZWNvbm5lY3QoKVxuICAgIEBjb25uLm9uICdjb25uZWN0aW9uJywgQF9hZGRDb25uZWN0aW9uXG4gIFxuICAjXG4gICMgSm9pbiBhIGNvbW11bmljYXRpb24gcm9vbS4gSW4gY2FzZSBvZiBwZWVyanMsIHlvdSBqdXN0IGhhdmUgdG8gam9pbiB0byBvbmUgb3RoZXIgY2xpZW50LiBUaGlzIGNvbm5lY3RvciB3aWxsIGpvaW4gdG8gdGhlIG90aGVyIHBlZXJzIGF1dG9tYXRpY2FsbHkuXG4gICMgQHBhcmFtIGlkIHtTdHJpbmd9IFRoZSBjb25uZWN0aW9uIGlkIG9mIGFub3RoZXIgY2xpZW50LlxuICAjXG4gIGpvaW46IChwZWVyaWQpLT5cbiAgICBpZiBub3QgQHVuc3luY2VkX2Nvbm5lY3Rpb25zW3BlZXJpZF0/IGFuZCBub3QgQGNvbm5lY3Rpb25zW3BlZXJpZF0/IGFuZCBwZWVyaWQgaXNudCBAaWRcbiAgICAgIHBlZXIgPSBAY29ubi5jb25uZWN0IHBlZXJpZCwge3JlbGlhYmxlOiB0cnVlfSBcbiAgICAgIEB1bnN5bmNlZF9jb25uZWN0aW9uc1twZWVyaWRdID0gcGVlclxuICAgICAgQF9hZGRDb25uZWN0aW9uIHBlZXJcbiAgICAgIHRydWVcbiAgICBlbHNlXG4gICAgICBmYWxzZVxuICBcbiAgI1xuICAjIFNlbmQgYSBtZXNzYWdlIHRvIGEgcGVlciBvciBzZXQgb2YgcGVlcnMuIFRoaXMgaXMgcGVlcmpzIHNwZWNpZmljLlxuICAjIEBvdmVybG9hZCBfc2VuZChwZWVyaWQsIG1lc3NhZ2UpXG4gICMgICBAcGFyYW0gcGVlcmlkIHtTdHJpbmd9IFBlZXJKcyBjb25uZWN0aW9uIGlkIG9mIF9hbm90aGVyXyBwZWVyXG4gICMgICBAcGFyYW0gbWVzc2FnZSB7T2JqZWN0fSBTb21lIG9iamVjdCB0aGF0IHNoYWxsIGJlIHNlbmRcbiAgIyBAb3ZlcmxvYWQgX3NlbmQocGVlcmlkcywgbWVzc2FnZSlcbiAgIyAgIEBwYXJhbSBwZWVyaWRzIHtBcnJheTxTdHJpbmc+fSBQZWVySnMgY29ubmVjdGlvbiBpZHMgb2YgX290aGVyXyBwZWVyc1xuICAjICAgQHBhcmFtIG1lc3NhZ2Uge09iamVjdH0gU29tZSBvYmplY3QgdGhhdCBzaGFsbCBiZSBzZW5kXG4gICNcbiAgX3NlbmQ6IChwZWVyX3MsIG1lc3NhZ2UpLT5cbiAgICBpZiBwZWVyX3MuY29uc3RydWN0b3IgaXMgW10uY29uc3RydWN0b3JcbiAgICAgICMgVGhyb3cgZXJyb3JzIF9hZnRlcl8gdGhlIG1lc3NhZ2UgaGFzIGJlZW4gc2VuZCB0byBhbGwgb3RoZXIgcGVlcnMuIFxuICAgICAgIyBKdXN0IGluIGNhc2UgYSBjb25uZWN0aW9uIGlzIGludmFsaWQuXG4gICAgICBlcnJvcnMgPSBbXVxuICAgICAgZm9yIHBlZXIgaW4gcGVlcl9zXG4gICAgICAgIHRyeVxuICAgICAgICAgIEBjb25uZWN0aW9uW3BlZXJdLnNlbmQgbWVzc2FnZVxuICAgICAgICBjYXRjaCBlcnJvciBcbiAgICAgICAgICBlcnJvcnMucHVzaChlcnJvcitcIlwiKVxuICAgICAgaWYgZXJyb3JzLmxlbmd0aCA+IDBcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIGVycm9ycyBcbiAgICBlbHNlXG4gICAgICBAY29ubmVjdGlvbnNbcGVlcl9zXS5zZW5kIG1lc3NhZ2VcbiAgICBcbiAgI1xuICAjIEBwcml2YXRlXG4gICMgVGhpcyBpcyBhIGhlbHBlciBmdW5jdGlvbiB0aGF0IGlzIG9ubHkgcmVsYXRlZCB0byB0aGUgcGVlcmpzIGNvbm5lY3Rvci4gXG4gICMgQ29ubmVjdCB0byBhbm90aGVyIHBlZXIuXG4gIF9hZGRDb25uZWN0aW9uOiAocGVlcik9PlxuICAgIHBlZXIub24gJ29wZW4nLCAoKT0+XG4gICAgICB0aGF0ID0gQFxuICAgICAgcGVlci5zZW5kIHRoYXQuc3luY19wcm9jZXNzX29yZGVyWzBdKClcbiAgICAgIGN1cnJlbnRfc3luY19pID0gMVxuICAgICAgcGVlci5vbiAnZGF0YScsIChkYXRhKS0+XG4gICAgICAgIGNvbnNvbGUubG9nKFwicmVjZWl2ZSBkYXRhOiAje0pTT04uc3RyaW5naWZ5IGRhdGF9XCIpXG4gICAgICAgIGlmIGN1cnJlbnRfc3luY19pIDwgdGhhdC5zeW5jX3Byb2Nlc3Nfb3JkZXIubGVuZ3RoXG4gICAgICAgICAgcGVlci5zZW5kIHRoYXQuc3luY19wcm9jZXNzX29yZGVyW2N1cnJlbnRfc3luY19pKytdLmNhbGwgdGhhdCwgZGF0YVxuICAgICAgICBlbHNlIGlmIGN1cnJlbnRfc3luY19pIGlzIHRoYXQuc3luY19wcm9jZXNzX29yZGVyLmxlbmd0aFxuICAgICAgICAgICMgQWxsIHN5bmMgZnVuY3Rpb25zIGhhdmUgYmVlbiBjYWxsZWQuIEluY3JlbWVudCBjdXJyZW50X3N5bmNfaSBvbmUgbGFzdCB0aW1lXG4gICAgICAgICAgY3VycmVudF9zeW5jX2krK1xuICAgICAgICAgICMgYWRkIGl0IHRvIHRoZSBjb25uZWN0aW9ucyBvYmplY3RcbiAgICAgICAgICBkZWxldGUgdGhhdC51bnN5bmNlZF9jb25uZWN0aW9uc1twZWVyLnBlZXJdXG4gICAgICAgICAgdGhhdC5jb25uZWN0aW9uc1twZWVyLnBlZXJdID0gcGVlclxuICAgICAgICAgICMgd2hlbiB0aGUgY29ubiBjbG9zZXMsIGRlbGV0ZSBpdCBmcm9tIHRoZSBjb25uZWN0aW9ucyBvYmplY3RcbiAgICAgICAgICBwZWVyLm9uICdjbG9zZScsICgpLT5cbiAgICAgICAgICAgIGRlbGV0ZSB0aGF0LmNvbm5lY3Rpb25zW3BlZXIucGVlcl1cbiAgICAgICAgICAjIGhlbHBlciBma3QuIHRydWUgaWZmIG9zIGlzIGFuIG9iamVjdCB0aGF0IGRvZXMgbm90IGhvbGQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzXG4gICAgICAgICAgaXNFbXB0eSA9IChvcyktPlxuICAgICAgICAgICAgZm9yIG8gb2Ygb3NcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgIGlmIGlzRW1wdHkodGhhdC51bnN5bmNlZF9jb25uZWN0aW9ucylcbiAgICAgICAgICAgICMgdGhlcmUgYXJlIG5vIHVuc3luY2VkIGNvbm5lY3Rpb25zLiB3ZSBhcmUgbm93IHN5bmNlZC4gXG4gICAgICAgICAgICAjIHRoZXJlZm9yZSBleGVjdXRlIGFsbCBma3RzIGluIHRoaXMuY29tcHV0ZV93aGVuX3N5bmNlZFxuICAgICAgICAgICAgdGhhdC5pc19zeW5jZWQgPSB0cnVlXG4gICAgICAgICAgICBmb3IgY29tcCBpbiB0aGF0LmNvbXB1dGVfd2hlbl9zeW5jZWRcbiAgICAgICAgICAgICAgY29tcFswXS5hcHBseSB0aGF0LCBjb21wWzEuLl1cbiAgICAgICAgICAgIHRoYXQuY29tcHV0ZV93aGVuX3N5bmNlZCA9IFtdXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAjIHlvdSByZWNlaXZlZCBhIG5ldyBtZXNzYWdlLCB0aGF0IGlzIG5vdCBhIHN5bmMgbWVzc2FnZS5cbiAgICAgICAgICAjIG5vdGlmeSB0aGUgcmVjZWl2ZV9oYW5kbGVyc1xuICAgICAgICAgIGZvciBmIGluIHRoYXQucmVjZWl2ZV9oYW5kbGVycyBcbiAgICAgICAgICAgIGYgcGVlci5wZWVyLCBkYXRhXG5cblxuICAgICAgIl19
