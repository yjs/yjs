(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
new Polymer('peerjs-connector', {
  join: function(id) {},
  idChanged: function(old_val, new_val) {
    if (this.is_initialized) {
      throw new Error("You must not set the user_id twice!");
    } else {
      return this.initializeConnection();
    }
  },
  initializeConnection: function() {
    var options, writeIfAvailable;
    if (this.conn_id != null) {
      console.log("now initializing");
      options = {};
      writeIfAvailable = function(name, value) {
        if (value != null) {
          return options[name] = value;
        }
      };
      writeIfAvailable('key', this.key);
      writeIfAvailable('host', this.host);
      writeIfAvailable('port', this.port);
      writeIfAvailable('path', this.path);
      writeIfAvailable('secure', this.secure);
      writeIfAvailable('debug', this.debug);
      this.is_initialized = true;
      return this.connector = new PeerJsConnector(this.conn_id, options);
    }
  },
  ready: function() {
    if (this.conn_id !== null) {
      return this.initializeConnection();
    }
  }
});



},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NvZGlvL3dvcmtzcGFjZS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9jb2Rpby93b3Jrc3BhY2UvbGliL3BlZXJqcy1jb25uZWN0b3IvcGVlcmpzLWNvbm5lY3Rvci1wb2x5bWVyLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0NBLElBQUksT0FBQSxDQUFRLGtCQUFSLEVBQ0Y7QUFBQSxFQUFBLElBQUEsRUFBTSxTQUFDLEVBQUQsR0FBQSxDQUFOO0FBQUEsRUFDQSxTQUFBLEVBQVcsU0FBQyxPQUFELEVBQVMsT0FBVCxHQUFBO0FBQ1QsSUFBQSxJQUFHLElBQUksQ0FBQyxjQUFSO0FBQ0UsWUFBVSxJQUFBLEtBQUEsQ0FBTSxxQ0FBTixDQUFWLENBREY7S0FBQSxNQUFBO2FBR0UsSUFBSSxDQUFDLG9CQUFMLENBQUEsRUFIRjtLQURTO0VBQUEsQ0FEWDtBQUFBLEVBT0Esb0JBQUEsRUFBc0IsU0FBQSxHQUFBO0FBQ3BCLFFBQUEseUJBQUE7QUFBQSxJQUFBLElBQUcsb0JBQUg7QUFDRSxNQUFBLE9BQU8sQ0FBQyxHQUFSLENBQVksa0JBQVosQ0FBQSxDQUFBO0FBQUEsTUFDQSxPQUFBLEdBQVUsRUFEVixDQUFBO0FBQUEsTUFFQSxnQkFBQSxHQUFtQixTQUFDLElBQUQsRUFBTyxLQUFQLEdBQUE7QUFDakIsUUFBQSxJQUFHLGFBQUg7aUJBQ0UsT0FBUSxDQUFBLElBQUEsQ0FBUixHQUFnQixNQURsQjtTQURpQjtNQUFBLENBRm5CLENBQUE7QUFBQSxNQUtBLGdCQUFBLENBQWlCLEtBQWpCLEVBQXdCLElBQUksQ0FBQyxHQUE3QixDQUxBLENBQUE7QUFBQSxNQU1BLGdCQUFBLENBQWlCLE1BQWpCLEVBQXlCLElBQUksQ0FBQyxJQUE5QixDQU5BLENBQUE7QUFBQSxNQU9BLGdCQUFBLENBQWlCLE1BQWpCLEVBQXlCLElBQUksQ0FBQyxJQUE5QixDQVBBLENBQUE7QUFBQSxNQVFBLGdCQUFBLENBQWlCLE1BQWpCLEVBQXlCLElBQUksQ0FBQyxJQUE5QixDQVJBLENBQUE7QUFBQSxNQVNBLGdCQUFBLENBQWlCLFFBQWpCLEVBQTJCLElBQUksQ0FBQyxNQUFoQyxDQVRBLENBQUE7QUFBQSxNQVVBLGdCQUFBLENBQWlCLE9BQWpCLEVBQTBCLElBQUksQ0FBQyxLQUEvQixDQVZBLENBQUE7QUFBQSxNQVdBLElBQUksQ0FBQyxjQUFMLEdBQXNCLElBWHRCLENBQUE7YUFZQSxJQUFJLENBQUMsU0FBTCxHQUFxQixJQUFBLGVBQUEsQ0FBZ0IsSUFBSSxDQUFDLE9BQXJCLEVBQThCLE9BQTlCLEVBYnZCO0tBRG9CO0VBQUEsQ0FQdEI7QUFBQSxFQXVCQSxLQUFBLEVBQU8sU0FBQSxHQUFBO0FBQ0wsSUFBQSxJQUFHLElBQUksQ0FBQyxPQUFMLEtBQWdCLElBQW5CO2FBQ0UsSUFBSSxDQUFDLG9CQUFMLENBQUEsRUFERjtLQURLO0VBQUEsQ0F2QlA7Q0FERSxDQUFKLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG5uZXcgUG9seW1lciAncGVlcmpzLWNvbm5lY3RvcicsXG4gIGpvaW46IChpZCktPlxuICBpZENoYW5nZWQ6IChvbGRfdmFsLG5ld192YWwpLT5cbiAgICBpZiB0aGlzLmlzX2luaXRpYWxpemVkXG4gICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBub3Qgc2V0IHRoZSB1c2VyX2lkIHR3aWNlIVwiXG4gICAgZWxzZVxuICAgICAgdGhpcy5pbml0aWFsaXplQ29ubmVjdGlvbigpICAgICAgICBcblxuICBpbml0aWFsaXplQ29ubmVjdGlvbjogKCktPiBcbiAgICBpZiB0aGlzLmNvbm5faWQ/XG4gICAgICBjb25zb2xlLmxvZyhcIm5vdyBpbml0aWFsaXppbmdcIilcbiAgICAgIG9wdGlvbnMgPSB7fVxuICAgICAgd3JpdGVJZkF2YWlsYWJsZSA9IChuYW1lLCB2YWx1ZSktPlxuICAgICAgICBpZiB2YWx1ZT9cbiAgICAgICAgICBvcHRpb25zW25hbWVdID0gdmFsdWVcbiAgICAgIHdyaXRlSWZBdmFpbGFibGUgJ2tleScsIHRoaXMua2V5XG4gICAgICB3cml0ZUlmQXZhaWxhYmxlICdob3N0JywgdGhpcy5ob3N0XG4gICAgICB3cml0ZUlmQXZhaWxhYmxlICdwb3J0JywgdGhpcy5wb3J0XG4gICAgICB3cml0ZUlmQXZhaWxhYmxlICdwYXRoJywgdGhpcy5wYXRoXG4gICAgICB3cml0ZUlmQXZhaWxhYmxlICdzZWN1cmUnLCB0aGlzLnNlY3VyZVxuICAgICAgd3JpdGVJZkF2YWlsYWJsZSAnZGVidWcnLCB0aGlzLmRlYnVnXG4gICAgICB0aGlzLmlzX2luaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuY29ubmVjdG9yID0gbmV3IFBlZXJKc0Nvbm5lY3RvciB0aGlzLmNvbm5faWQsIG9wdGlvbnNcbiAgICBcbiAgcmVhZHk6ICgpLT5cbiAgICBpZiB0aGlzLmNvbm5faWQgIT0gbnVsbFxuICAgICAgdGhpcy5pbml0aWFsaXplQ29ubmVjdGlvbigpXG4gIFxuIl19
