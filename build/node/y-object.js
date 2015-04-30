var bindToChildren;

bindToChildren = function(that) {
  var attr, i, j, ref;
  for (i = j = 0, ref = that.children.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
    attr = that.children.item(i);
    if (attr.name != null) {
      attr.val = that.val.val(attr.name);
    }
  }
  return that.val.observe(function(events) {
    var event, k, len, newVal, results;
    results = [];
    for (k = 0, len = events.length; k < len; k++) {
      event = events[k];
      if (event.name != null) {
        results.push((function() {
          var l, ref1, results1;
          results1 = [];
          for (i = l = 0, ref1 = that.children.length; 0 <= ref1 ? l < ref1 : l > ref1; i = 0 <= ref1 ? ++l : --l) {
            attr = that.children.item(i);
            if ((attr.name != null) && attr.name === event.name) {
              newVal = that.val.val(attr.name);
              if (attr.val !== newVal) {
                results1.push(attr.val = newVal);
              } else {
                results1.push(void 0);
              }
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        })());
      } else {
        results.push(void 0);
      }
    }
    return results;
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
    var ref;
    if ((this.val != null) && (this.name != null)) {
      if (this.val.constructor === Object) {
        return this.val = this.parentElement.val.val(this.name, new Y.Object(this.val)).val(this.name);
      } else if (this.val._name === "Object") {
        return bindToChildren(this);
      } else if ((((ref = this.parentElement.val) != null ? ref.val : void 0) != null) && this.val !== this.parentElement.val.val(this.name)) {
        return this.parentElement.val.val(this.name, this.val);
      }
    }
  }
});
