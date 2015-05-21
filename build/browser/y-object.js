(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var bindToChildren;

bindToChildren = function(that) {
  var attr, i, _i, _ref;
  for (i = _i = 0, _ref = that.children.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
    attr = that.children.item(i);
    if (attr.name != null) {
      attr.val = that.val.val(attr.name);
    }
  }
  return that.val.observe(function(events) {
    var event, newVal, _j, _len, _results;
    _results = [];
    for (_j = 0, _len = events.length; _j < _len; _j++) {
      event = events[_j];
      if (event.name != null) {
        _results.push((function() {
          var _k, _ref1, _results1;
          _results1 = [];
          for (i = _k = 0, _ref1 = that.children.length; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
            attr = that.children.item(i);
            if ((attr.name != null) && attr.name === event.name) {
              newVal = that.val.val(attr.name);
              if (attr.val !== newVal) {
                _results1.push(attr.val = newVal);
              } else {
                _results1.push(void 0);
              }
            } else {
              _results1.push(void 0);
            }
          }
          return _results1;
        })());
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  });
};

Polymer("y-object", {
  ready: function() {
    if (this.connector != null) {
      this.val = new Y(this.connector);
      return bindToChildren(this);
    } else if (this.val != null) {
      return bindToChildren(this);
    }
  },
  valChanged: function() {
    if ((this.val != null) && this.val._name === "Object") {
      return bindToChildren(this);
    }
  },
  connectorChanged: function() {
    if (this.val == null) {
      this.val = new Y(this.connector);
      return bindToChildren(this);
    }
  }
});

Polymer("y-property", {
  ready: function() {
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        this.val = this.parentElement.val(this.name, new Y.Object(this.val)).val(this.name);
      } else if (typeof this.val === "string") {
        this.parentElement.val(this.name, this.val);
      }
      if (this.val._name === "Object") {
        return bindToChildren(this);
      }
    }
  },
  valChanged: function() {
    var _ref;
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        return this.val = this.parentElement.val.val(this.name, new Y.Object(this.val)).val(this.name);
      } else if (this.val._name === "Object") {
        return bindToChildren(this);
      } else if ((((_ref = this.parentElement.val) != null ? _ref.val : void 0) != null) && this.val !== this.parentElement.val.val(this.name)) {
        return this.parentElement.val.val(this.name, this.val);
      }
    }
  }
});


},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2NjYy9Eb2N1bWVudHMvcHJvZy9MaW5hZ29yYS95anMvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvY2NjL0RvY3VtZW50cy9wcm9nL0xpbmFnb3JhL3lqcy9saWIveS1vYmplY3QuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQ0EsSUFBQSxjQUFBOztBQUFBLGNBQUEsR0FBaUIsU0FBQyxJQUFELEdBQUE7QUFDZixNQUFBLGlCQUFBO0FBQUEsT0FBUyx1R0FBVCxHQUFBO0FBQ0UsSUFBQSxJQUFBLEdBQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFkLENBQW1CLENBQW5CLENBQVAsQ0FBQTtBQUNBLElBQUEsSUFBRyxpQkFBSDtBQUNFLE1BQUEsSUFBSSxDQUFDLEdBQUwsR0FBVyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQVQsQ0FBYSxJQUFJLENBQUMsSUFBbEIsQ0FBWCxDQURGO0tBRkY7QUFBQSxHQUFBO1NBSUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFULENBQWlCLFNBQUMsTUFBRCxHQUFBO0FBQ2YsUUFBQSxpQ0FBQTtBQUFBO1NBQUEsNkNBQUE7eUJBQUE7QUFDRSxNQUFBLElBQUcsa0JBQUg7OztBQUNFO2VBQVMsNEdBQVQsR0FBQTtBQUNFLFlBQUEsSUFBQSxHQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBZCxDQUFtQixDQUFuQixDQUFQLENBQUE7QUFDQSxZQUFBLElBQUcsbUJBQUEsSUFBZSxJQUFJLENBQUMsSUFBTCxLQUFhLEtBQUssQ0FBQyxJQUFyQztBQUNFLGNBQUEsTUFBQSxHQUFTLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBVCxDQUFhLElBQUksQ0FBQyxJQUFsQixDQUFULENBQUE7QUFDQSxjQUFBLElBQUcsSUFBSSxDQUFDLEdBQUwsS0FBYyxNQUFqQjsrQkFD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QSxJQUF4QixFQUE4QixJQUFDLENBQUEsR0FBL0IsRUFERztPQVBQO0tBRFU7RUFBQSxDQVhaO0NBREYsQ0FoQ0EsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbmJpbmRUb0NoaWxkcmVuID0gKHRoYXQpLT5cbiAgZm9yIGkgaW4gWzAuLi50aGF0LmNoaWxkcmVuLmxlbmd0aF1cbiAgICBhdHRyID0gdGhhdC5jaGlsZHJlbi5pdGVtKGkpXG4gICAgaWYgYXR0ci5uYW1lP1xuICAgICAgYXR0ci52YWwgPSB0aGF0LnZhbC52YWwoYXR0ci5uYW1lKVxuICB0aGF0LnZhbC5vYnNlcnZlIChldmVudHMpLT5cbiAgICBmb3IgZXZlbnQgaW4gZXZlbnRzXG4gICAgICBpZiBldmVudC5uYW1lP1xuICAgICAgICBmb3IgaSBpbiBbMC4uLnRoYXQuY2hpbGRyZW4ubGVuZ3RoXVxuICAgICAgICAgIGF0dHIgPSB0aGF0LmNoaWxkcmVuLml0ZW0oaSlcbiAgICAgICAgICBpZiBhdHRyLm5hbWU/IGFuZCBhdHRyLm5hbWUgaXMgZXZlbnQubmFtZVxuICAgICAgICAgICAgbmV3VmFsID0gdGhhdC52YWwudmFsKGF0dHIubmFtZSlcbiAgICAgICAgICAgIGlmIGF0dHIudmFsIGlzbnQgbmV3VmFsXG4gICAgICAgICAgICAgIGF0dHIudmFsID0gbmV3VmFsXG5cblBvbHltZXIgXCJ5LW9iamVjdFwiLFxuICByZWFkeTogKCktPlxuICAgIGlmIEBjb25uZWN0b3I/XG4gICAgICBAdmFsID0gbmV3IFkgQGNvbm5lY3RvclxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuICAgIGVsc2UgaWYgQHZhbD9cbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuICB2YWxDaGFuZ2VkOiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEB2YWwuX25hbWUgaXMgXCJPYmplY3RcIlxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIGNvbm5lY3RvckNoYW5nZWQ6ICgpLT5cbiAgICBpZiAobm90IEB2YWw/KVxuICAgICAgQHZhbCA9IG5ldyBZIEBjb25uZWN0b3JcbiAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuUG9seW1lciBcInktcHJvcGVydHlcIixcbiAgcmVhZHk6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsKEBuYW1lLG5ldyBZLk9iamVjdChAdmFsKSkudmFsKEBuYW1lKVxuICAgICAgICAjIFRPRE86IHBsZWFzZSB1c2UgaW5zdGFuY2VvZiBpbnN0ZWFkIG9mIC5fbmFtZSxcbiAgICAgICAgIyBzaW5jZSBpdCBpcyBtb3JlIHNhZmUgKGNvbnNpZGVyIHNvbWVvbmUgcHV0dGluZyBhIGN1c3RvbSBPYmplY3QgdHlwZSBoZXJlKVxuICAgICAgZWxzZSBpZiB0eXBlb2YgQHZhbCBpcyBcInN0cmluZ1wiXG4gICAgICAgIEBwYXJlbnRFbGVtZW50LnZhbChAbmFtZSxAdmFsKVxuICAgICAgaWYgQHZhbC5fbmFtZSBpcyBcIk9iamVjdFwiXG4gICAgICAgIGJpbmRUb0NoaWxkcmVuIEBcblxuICB2YWxDaGFuZ2VkOiAoKS0+XG4gICAgaWYgQHZhbD8gYW5kIEBuYW1lP1xuICAgICAgaWYgQHZhbC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgQHZhbCA9IEBwYXJlbnRFbGVtZW50LnZhbC52YWwoQG5hbWUsIG5ldyBZLk9iamVjdChAdmFsKSkudmFsKEBuYW1lKVxuICAgICAgICAjIFRPRE86IHBsZWFzZSB1c2UgaW5zdGFuY2VvZiBpbnN0ZWFkIG9mIC5fbmFtZSxcbiAgICAgICAgIyBzaW5jZSBpdCBpcyBtb3JlIHNhZmUgKGNvbnNpZGVyIHNvbWVvbmUgcHV0dGluZyBhIGN1c3RvbSBPYmplY3QgdHlwZSBoZXJlKVxuICAgICAgZWxzZSBpZiBAdmFsLl9uYW1lIGlzIFwiT2JqZWN0XCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuICAgICAgZWxzZSBpZiBAcGFyZW50RWxlbWVudC52YWw/LnZhbD8gYW5kIEB2YWwgaXNudCBAcGFyZW50RWxlbWVudC52YWwudmFsKEBuYW1lKVxuICAgICAgICBAcGFyZW50RWxlbWVudC52YWwudmFsIEBuYW1lLCBAdmFsXG4iXX0=
