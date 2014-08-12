(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Engine;

Engine = (function() {
  function Engine(HB, parser) {
    this.HB = HB;
    this.parser = parser;
    this.unprocessed_ops = [];
  }

  Engine.prototype.parseOperation = function(json) {
    var typeParser;
    typeParser = this.parser[json.type];
    if (typeParser != null) {
      return typeParser(json);
    } else {
      throw new Error("You forgot to specify a parser for type " + json.type + ". The message is " + (JSON.stringify(json)) + ".");
    }
  };

  Engine.prototype.applyOpsBundle = function(ops_json) {
    var o, ops, _i, _j, _k, _len, _len1, _len2;
    ops = [];
    for (_i = 0, _len = ops_json.length; _i < _len; _i++) {
      o = ops_json[_i];
      ops.push(this.parseOperation(o));
    }
    for (_j = 0, _len1 = ops.length; _j < _len1; _j++) {
      o = ops[_j];
      this.HB.addOperation(o);
    }
    for (_k = 0, _len2 = ops.length; _k < _len2; _k++) {
      o = ops[_k];
      if (!o.execute()) {
        this.unprocessed_ops.push(o);
      }
    }
    return this.tryUnprocessed();
  };

  Engine.prototype.applyOpsCheckDouble = function(ops_json) {
    var o, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = ops_json.length; _i < _len; _i++) {
      o = ops_json[_i];
      if (this.HB.getOperation(o.uid) != null) {
        _results.push(this.applyOp(o));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  Engine.prototype.applyOps = function(ops_json) {
    var o, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = ops_json.length; _i < _len; _i++) {
      o = ops_json[_i];
      _results.push(this.applyOp(o));
    }
    return _results;
  };

  Engine.prototype.applyOp = function(op_json) {
    var o;
    o = this.parseOperation(op_json);
    this.HB.addToCounter(o);
    if (!o.execute()) {
      this.unprocessed_ops.push(o);
    } else {
      this.HB.addOperation(o);
    }
    return this.tryUnprocessed();
  };

  Engine.prototype.tryUnprocessed = function() {
    var old_length, op, unprocessed, _i, _len, _ref, _results;
    _results = [];
    while (true) {
      old_length = this.unprocessed_ops.length;
      unprocessed = [];
      _ref = this.unprocessed_ops;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        op = _ref[_i];
        if (!op.execute()) {
          unprocessed.push(op);
        } else {
          this.HB.addOperation(op);
        }
      }
      this.unprocessed_ops = unprocessed;
      if (this.unprocessed_ops.length === old_length) {
        break;
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  return Engine;

})();

module.exports = Engine;


},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL0VuZ2luZS5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNJQSxJQUFBLE1BQUE7O0FBQUE7QUFNZSxFQUFBLGdCQUFFLEVBQUYsRUFBTyxNQUFQLEdBQUE7QUFDWCxJQURZLElBQUMsQ0FBQSxLQUFBLEVBQ2IsQ0FBQTtBQUFBLElBRGlCLElBQUMsQ0FBQSxTQUFBLE1BQ2xCLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxlQUFELEdBQW1CLEVBQW5CLENBRFc7RUFBQSxDQUFiOztBQUFBLG1CQU1BLGNBQUEsR0FBZ0IsU0FBQyxJQUFELEdBQUE7QUFDZCxRQUFBLFVBQUE7QUFBQSxJQUFBLFVBQUEsR0FBYSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUksQ0FBQyxJQUFMLENBQXJCLENBQUE7QUFDQSxJQUFBLElBQUcsa0JBQUg7YUFDRSxVQUFBLENBQVcsSUFBWCxFQURGO0tBQUEsTUFBQTtBQUdFLFlBQVUsSUFBQSxLQUFBLENBQU8sMENBQUEsR0FBeUMsSUFBSSxDQUFDLElBQTlDLEdBQW9ELG1CQUFwRCxHQUFzRSxDQUFBLElBQUksQ0FBQyxTQUFMLENBQWUsSUFBZixDQUFBLENBQXRFLEdBQTJGLEdBQWxHLENBQVYsQ0FIRjtLQUZjO0VBQUEsQ0FOaEIsQ0FBQTs7QUFBQSxtQkFpQkEsY0FBQSxHQUFnQixTQUFDLFFBQUQsR0FBQTtBQUNkLFFBQUEsc0NBQUE7QUFBQSxJQUFBLEdBQUEsR0FBTSxFQUFOLENBQUE7QUFDQSxTQUFBLCtDQUFBO3VCQUFBO0FBQ0UsTUFBQSxHQUFHLENBQUMsSUFBSixDQUFTLElBQUMsQ0FBQSxjQUFELENBQWdCLENBQWhCLENBQVQsQ0FBQSxDQURGO0FBQUEsS0FEQTtBQUdBLFNBQUEsNENBQUE7a0JBQUE7QUFDRSxNQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFpQixDQUFqQixDQUFBLENBREY7QUFBQSxLQUhBO0FBS0EsU0FBQSw0Q0FBQTtrQkFBQTtBQUNFLE1BQUEsSUFBRyxDQUFBLENBQUssQ0FBQyxPQUFGLENBQUEsQ0FBUDtBQUNFLFFBQUEsSUFBQyxDQUFBLGVBQWUsQ0FBQyxJQUFqQixDQUFzQixDQUF0QixDQUFBLENBREY7T0FERjtBQUFBLEtBTEE7V0FRQSxJQUFDLENBQUEsY0FBRCxDQUFBLEVBVGM7RUFBQSxDQWpCaEIsQ0FBQTs7QUFBQSxtQkFnQ0EsbUJBQUEsR0FBcUIsU0FBQyxRQUFELEdBQUE7QUFDbkIsUUFBQSxxQkFBQTtBQUFBO1NBQUEsK0NBQUE7dUJBQUE7QUFDRSxNQUFBLElBQUcsbUNBQUg7c0JBQ0UsSUFBQyxDQUFBLE9BQUQsQ0FBUyxDQUFULEdBREY7T0FBQSxNQUFBOzhCQUFBO09BREY7QUFBQTtvQkFEbUI7RUFBQSxDQWhDckIsQ0FBQTs7QUFBQSxtQkF3Q0EsUUFBQSxHQUFVLFNBQUMsUUFBRCxHQUFBO0FBQ1IsUUFBQSxxQkFBQTtBQUFBO1NBQUEsK0NBQUE7dUJBQUE7QUFDRSxvQkFBQSxJQUFDLENBQUEsT0FBRCxDQUFTLENBQVQsRUFBQSxDQURGO0FBQUE7b0JBRFE7RUFBQSxDQXhDVixDQUFBOztBQUFBLG1CQStDQSxPQUFBLEdBQVMsU0FBQyxPQUFELEdBQUE7QUFFUCxRQUFBLENBQUE7QUFBQSxJQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsY0FBRCxDQUFnQixPQUFoQixDQUFKLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFpQixDQUFqQixDQURBLENBQUE7QUFHQSxJQUFBLElBQUcsQ0FBQSxDQUFLLENBQUMsT0FBRixDQUFBLENBQVA7QUFDRSxNQUFBLElBQUMsQ0FBQSxlQUFlLENBQUMsSUFBakIsQ0FBc0IsQ0FBdEIsQ0FBQSxDQURGO0tBQUEsTUFBQTtBQUdFLE1BQUEsSUFBQyxDQUFBLEVBQUUsQ0FBQyxZQUFKLENBQWlCLENBQWpCLENBQUEsQ0FIRjtLQUhBO1dBT0EsSUFBQyxDQUFBLGNBQUQsQ0FBQSxFQVRPO0VBQUEsQ0EvQ1QsQ0FBQTs7QUFBQSxtQkE4REEsY0FBQSxHQUFnQixTQUFBLEdBQUE7QUFDZCxRQUFBLHFEQUFBO0FBQUE7V0FBTSxJQUFOLEdBQUE7QUFDRSxNQUFBLFVBQUEsR0FBYSxJQUFDLENBQUEsZUFBZSxDQUFDLE1BQTlCLENBQUE7QUFBQSxNQUNBLFdBQUEsR0FBYyxFQURkLENBQUE7QUFFQTtBQUFBLFdBQUEsMkNBQUE7c0JBQUE7QUFDRSxRQUFBLElBQUcsQ0FBQSxFQUFNLENBQUMsT0FBSCxDQUFBLENBQVA7QUFDRSxVQUFBLFdBQVcsQ0FBQyxJQUFaLENBQWlCLEVBQWpCLENBQUEsQ0FERjtTQUFBLE1BQUE7QUFHRSxVQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsWUFBSixDQUFpQixFQUFqQixDQUFBLENBSEY7U0FERjtBQUFBLE9BRkE7QUFBQSxNQU9BLElBQUMsQ0FBQSxlQUFELEdBQW1CLFdBUG5CLENBQUE7QUFRQSxNQUFBLElBQUcsSUFBQyxDQUFBLGVBQWUsQ0FBQyxNQUFqQixLQUEyQixVQUE5QjtBQUNFLGNBREY7T0FBQSxNQUFBOzhCQUFBO09BVEY7SUFBQSxDQUFBO29CQURjO0VBQUEsQ0E5RGhCLENBQUE7O2dCQUFBOztJQU5GLENBQUE7O0FBQUEsTUFvRk0sQ0FBQyxPQUFQLEdBQWlCLE1BcEZqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxyXG4jXHJcbiMgVGhlIEVuZ2luZSBoYW5kbGVzIGhvdyBhbmQgaW4gd2hpY2ggb3JkZXIgdG8gZXhlY3V0ZSBvcGVyYXRpb25zIGFuZCBhZGQgb3BlcmF0aW9ucyB0byB0aGUgSGlzdG9yeUJ1ZmZlci5cclxuI1xyXG5jbGFzcyBFbmdpbmVcclxuXHJcbiAgI1xyXG4gICMgQHBhcmFtIHtIaXN0b3J5QnVmZmVyfSBIQlxyXG4gICMgQHBhcmFtIHtBcnJheX0gcGFyc2VyIERlZmluZXMgaG93IHRvIHBhcnNlIGVuY29kZWQgbWVzc2FnZXMuXHJcbiAgI1xyXG4gIGNvbnN0cnVjdG9yOiAoQEhCLCBAcGFyc2VyKS0+XHJcbiAgICBAdW5wcm9jZXNzZWRfb3BzID0gW11cclxuXHJcbiAgI1xyXG4gICMgUGFyc2VzIGFuIG9wZXJhdGlvIGZyb20gdGhlIGpzb24gZm9ybWF0LiBJdCB1c2VzIHRoZSBzcGVjaWZpZWQgcGFyc2VyIGluIHlvdXIgT3BlcmF0aW9uVHlwZSBtb2R1bGUuXHJcbiAgI1xyXG4gIHBhcnNlT3BlcmF0aW9uOiAoanNvbiktPlxyXG4gICAgdHlwZVBhcnNlciA9IEBwYXJzZXJbanNvbi50eXBlXVxyXG4gICAgaWYgdHlwZVBhcnNlcj9cclxuICAgICAgdHlwZVBhcnNlciBqc29uXHJcbiAgICBlbHNlXHJcbiAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBmb3Jnb3QgdG8gc3BlY2lmeSBhIHBhcnNlciBmb3IgdHlwZSAje2pzb24udHlwZX0uIFRoZSBtZXNzYWdlIGlzICN7SlNPTi5zdHJpbmdpZnkganNvbn0uXCJcclxuXHJcbiAgI1xyXG4gICMgQXBwbHkgYSBzZXQgb2Ygb3BlcmF0aW9ucy4gRS5nLiB0aGUgb3BlcmF0aW9ucyB5b3UgcmVjZWl2ZWQgZnJvbSBhbm90aGVyIHVzZXJzIEhCLnRvSnNvbigpLlxyXG4gICMgQG5vdGUgWW91IG11c3Qgbm90IHVzZSB0aGlzIG1ldGhvZCB3aGVuIHlvdSBhbHJlYWR5IGhhdmUgb3BzIGluIHlvdXIgSEIhXHJcbiAgI1xyXG4gIGFwcGx5T3BzQnVuZGxlOiAob3BzX2pzb24pLT5cclxuICAgIG9wcyA9IFtdXHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBvcHMucHVzaCBAcGFyc2VPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIEBIQi5hZGRPcGVyYXRpb24gb1xyXG4gICAgZm9yIG8gaW4gb3BzXHJcbiAgICAgIGlmIG5vdCBvLmV4ZWN1dGUoKVxyXG4gICAgICAgIEB1bnByb2Nlc3NlZF9vcHMucHVzaCBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBTYW1lIGFzIGFwcGx5T3BzIGJ1dCBvcGVyYXRpb25zIHRoYXQgYXJlIGFscmVhZHkgaW4gdGhlIEhCIGFyZSBub3QgYXBwbGllZC5cclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BzXHJcbiAgI1xyXG4gIGFwcGx5T3BzQ2hlY2tEb3VibGU6IChvcHNfanNvbiktPlxyXG4gICAgZm9yIG8gaW4gb3BzX2pzb25cclxuICAgICAgaWYgQEhCLmdldE9wZXJhdGlvbihvLnVpZCk/XHJcbiAgICAgICAgQGFwcGx5T3Agb1xyXG5cclxuICAjXHJcbiAgIyBBcHBseSBhIHNldCBvZiBvcGVyYXRpb25zLiAoSGVscGVyIGZvciB1c2luZyBhcHBseU9wIG9uIEFycmF5cylcclxuICAjIEBzZWUgRW5naW5lLmFwcGx5T3BcclxuICBhcHBseU9wczogKG9wc19qc29uKS0+XHJcbiAgICBmb3IgbyBpbiBvcHNfanNvblxyXG4gICAgICBAYXBwbHlPcCBvXHJcblxyXG4gICNcclxuICAjIEFwcGx5IGFuIG9wZXJhdGlvbiB0aGF0IHlvdSByZWNlaXZlZCBmcm9tIGFub3RoZXIgcGVlci5cclxuICAjXHJcbiAgYXBwbHlPcDogKG9wX2pzb24pLT5cclxuICAgICMgJHBhcnNlX2FuZF9leGVjdXRlIHdpbGwgcmV0dXJuIGZhbHNlIGlmICRvX2pzb24gd2FzIHBhcnNlZCBhbmQgZXhlY3V0ZWQsIG90aGVyd2lzZSB0aGUgcGFyc2VkIG9wZXJhZGlvblxyXG4gICAgbyA9IEBwYXJzZU9wZXJhdGlvbiBvcF9qc29uXHJcbiAgICBASEIuYWRkVG9Db3VudGVyIG9cclxuICAgICMgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBpZiBub3Qgby5leGVjdXRlKClcclxuICAgICAgQHVucHJvY2Vzc2VkX29wcy5wdXNoIG9cclxuICAgIGVsc2VcclxuICAgICAgQEhCLmFkZE9wZXJhdGlvbiBvXHJcbiAgICBAdHJ5VW5wcm9jZXNzZWQoKVxyXG5cclxuICAjXHJcbiAgIyBDYWxsIHRoaXMgbWV0aG9kIHdoZW4geW91IGFwcGxpZWQgYSBuZXcgb3BlcmF0aW9uLlxyXG4gICMgSXQgY2hlY2tzIGlmIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgbm90IGV4ZWN1dGFibGUgYXJlIG5vdyBleGVjdXRhYmxlLlxyXG4gICNcclxuICB0cnlVbnByb2Nlc3NlZDogKCktPlxyXG4gICAgd2hpbGUgdHJ1ZVxyXG4gICAgICBvbGRfbGVuZ3RoID0gQHVucHJvY2Vzc2VkX29wcy5sZW5ndGhcclxuICAgICAgdW5wcm9jZXNzZWQgPSBbXVxyXG4gICAgICBmb3Igb3AgaW4gQHVucHJvY2Vzc2VkX29wc1xyXG4gICAgICAgIGlmIG5vdCBvcC5leGVjdXRlKClcclxuICAgICAgICAgIHVucHJvY2Vzc2VkLnB1c2ggb3BcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICBASEIuYWRkT3BlcmF0aW9uIG9wXHJcbiAgICAgIEB1bnByb2Nlc3NlZF9vcHMgPSB1bnByb2Nlc3NlZFxyXG4gICAgICBpZiBAdW5wcm9jZXNzZWRfb3BzLmxlbmd0aCBpcyBvbGRfbGVuZ3RoXHJcbiAgICAgICAgYnJlYWtcclxuXHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRW5naW5lXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiJdfQ==
