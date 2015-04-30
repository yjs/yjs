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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9naXQveWpzL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL2Rtb25hZC9naXQveWpzL2xpYi95LW9iamVjdC5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNDQSxJQUFBLGNBQUE7O0FBQUEsY0FBQSxHQUFpQixTQUFDLElBQUQsR0FBQTtBQUNmLE1BQUEsaUJBQUE7QUFBQSxPQUFTLHVHQUFULEdBQUE7QUFDRSxJQUFBLElBQUEsR0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQWQsQ0FBbUIsQ0FBbkIsQ0FBUCxDQUFBO0FBQ0EsSUFBQSxJQUFHLGlCQUFIO0FBQ0UsTUFBQSxJQUFJLENBQUMsR0FBTCxHQUFXLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBVCxDQUFhLElBQUksQ0FBQyxJQUFsQixDQUFYLENBREY7S0FGRjtBQUFBLEdBQUE7U0FJQSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQVQsQ0FBaUIsU0FBQyxNQUFELEdBQUE7QUFDZixRQUFBLGlDQUFBO0FBQUE7U0FBQSw2Q0FBQTt5QkFBQTtBQUNFLE1BQUEsSUFBRyxrQkFBSDs7O0FBQ0U7ZUFBUyw0R0FBVCxHQUFBO0FBQ0UsWUFBQSxJQUFBLEdBQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFkLENBQW1CLENBQW5CLENBQVAsQ0FBQTtBQUNBLFlBQUEsSUFBRyxtQkFBQSxJQUFlLElBQUksQ0FBQyxJQUFMLEtBQWEsS0FBSyxDQUFDLElBQXJDO0FBQ0UsY0FBQSxNQUFBLEdBQVMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFULENBQWEsSUFBSSxDQUFDLElBQWxCLENBQVQsQ0FBQTtBQUNBLGNBQUEsSUFBRyxJQUFJLENBQUMsR0FBTCxLQUFjLE1BQWpCOytCQUNFLElBQUksQ0FBQyxHQUFMLEdBQVcsUUFEYjtlQUFBLE1B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O09BUFA7S0FEVTtFQUFBLENBWFo7Q0FERixDQWhDQSxDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuYmluZFRvQ2hpbGRyZW4gPSAodGhhdCktPlxuICBmb3IgaSBpbiBbMC4uLnRoYXQuY2hpbGRyZW4ubGVuZ3RoXVxuICAgIGF0dHIgPSB0aGF0LmNoaWxkcmVuLml0ZW0oaSlcbiAgICBpZiBhdHRyLm5hbWU/XG4gICAgICBhdHRyLnZhbCA9IHRoYXQudmFsLnZhbChhdHRyLm5hbWUpXG4gIHRoYXQudmFsLm9ic2VydmUgKGV2ZW50cyktPlxuICAgIGZvciBldmVudCBpbiBldmVudHNcbiAgICAgIGlmIGV2ZW50Lm5hbWU/XG4gICAgICAgIGZvciBpIGluIFswLi4udGhhdC5jaGlsZHJlbi5sZW5ndGhdXG4gICAgICAgICAgYXR0ciA9IHRoYXQuY2hpbGRyZW4uaXRlbShpKVxuICAgICAgICAgIGlmIGF0dHIubmFtZT8gYW5kIGF0dHIubmFtZSBpcyBldmVudC5uYW1lXG4gICAgICAgICAgICBuZXdWYWwgPSB0aGF0LnZhbC52YWwoYXR0ci5uYW1lKVxuICAgICAgICAgICAgaWYgYXR0ci52YWwgaXNudCBuZXdWYWxcbiAgICAgICAgICAgICAgYXR0ci52YWwgPSBuZXdWYWxcblxuUG9seW1lciBcInktb2JqZWN0XCIsXG4gIHJlYWR5OiAoKS0+XG4gICAgaWYgQGNvbm5lY3Rvcj9cbiAgICAgIEB2YWwgPSBuZXcgWSBAY29ubmVjdG9yXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgZWxzZSBpZiBAdmFsP1xuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQHZhbC5fbmFtZSBpcyBcIk9iamVjdFwiXG4gICAgICBiaW5kVG9DaGlsZHJlbiBAXG5cbiAgY29ubmVjdG9yQ2hhbmdlZDogKCktPlxuICAgIGlmIChub3QgQHZhbD8pXG4gICAgICBAdmFsID0gbmV3IFkgQGNvbm5lY3RvclxuICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG5Qb2x5bWVyIFwieS1wcm9wZXJ0eVwiLFxuICByZWFkeTogKCktPlxuICAgIGlmIEB2YWw/IGFuZCBAbmFtZT9cbiAgICAgIGlmIEB2YWwuY29uc3RydWN0b3IgaXMgT2JqZWN0XG4gICAgICAgIEB2YWwgPSBAcGFyZW50RWxlbWVudC52YWwoQG5hbWUsbmV3IFkuT2JqZWN0KEB2YWwpKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLl9uYW1lLFxuICAgICAgICAjIHNpbmNlIGl0IGlzIG1vcmUgc2FmZSAoY29uc2lkZXIgc29tZW9uZSBwdXR0aW5nIGEgY3VzdG9tIE9iamVjdCB0eXBlIGhlcmUpXG4gICAgICBlbHNlIGlmIHR5cGVvZiBAdmFsIGlzIFwic3RyaW5nXCJcbiAgICAgICAgQHBhcmVudEVsZW1lbnQudmFsKEBuYW1lLEB2YWwpXG4gICAgICBpZiBAdmFsLl9uYW1lIGlzIFwiT2JqZWN0XCJcbiAgICAgICAgYmluZFRvQ2hpbGRyZW4gQFxuXG4gIHZhbENoYW5nZWQ6ICgpLT5cbiAgICBpZiBAdmFsPyBhbmQgQG5hbWU/XG4gICAgICBpZiBAdmFsLmNvbnN0cnVjdG9yIGlzIE9iamVjdFxuICAgICAgICBAdmFsID0gQHBhcmVudEVsZW1lbnQudmFsLnZhbChAbmFtZSwgbmV3IFkuT2JqZWN0KEB2YWwpKS52YWwoQG5hbWUpXG4gICAgICAgICMgVE9ETzogcGxlYXNlIHVzZSBpbnN0YW5jZW9mIGluc3RlYWQgb2YgLl9uYW1lLFxuICAgICAgICAjIHNpbmNlIGl0IGlzIG1vcmUgc2FmZSAoY29uc2lkZXIgc29tZW9uZSBwdXR0aW5nIGEgY3VzdG9tIE9iamVjdCB0eXBlIGhlcmUpXG4gICAgICBlbHNlIGlmIEB2YWwuX25hbWUgaXMgXCJPYmplY3RcIlxuICAgICAgICBiaW5kVG9DaGlsZHJlbiBAXG4gICAgICBlbHNlIGlmIEBwYXJlbnRFbGVtZW50LnZhbD8udmFsPyBhbmQgQHZhbCBpc250IEBwYXJlbnRFbGVtZW50LnZhbC52YWwoQG5hbWUpXG4gICAgICAgIEBwYXJlbnRFbGVtZW50LnZhbC52YWwgQG5hbWUsIEB2YWxcbiJdfQ==
