(function() {
  var text_types_uninitialized,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  text_types_uninitialized = require("./TextTypes");

  module.exports = function(HB) {
    var JsonType, createJsonTypeWrapper, parser, text_types, types;
    text_types = text_types_uninitialized(HB);
    types = text_types.types;
    parser = text_types.parser;
    createJsonTypeWrapper = function(_jsonType) {
      var JsonTypeWrapper;
      JsonTypeWrapper = (function() {
        function JsonTypeWrapper(jsonType) {
          var name, obj, _fn, _ref;
          _ref = jsonType.map;
          _fn = function(name, obj) {
            return Object.defineProperty(JsonTypeWrapper.prototype, name, {
              get: function() {
                var x;
                x = obj.val();
                if (x instanceof JsonType) {
                  return createJsonTypeWrapper(x);
                } else if (x instanceof types.ImmutableObject) {
                  return x.val();
                } else {
                  return x;
                }
              },
              set: function(o) {
                var o_name, o_obj, overwrite, _results;
                overwrite = jsonType.val(name);
                if (o.constructor === {}.constructor && overwrite instanceof types.Operation) {
                  _results = [];
                  for (o_name in o) {
                    o_obj = o[o_name];
                    _results.push(overwrite.val(o_name, o_obj, 'immutable'));
                  }
                  return _results;
                } else {
                  return jsonType.val(name, o, 'immutable');
                }
              },
              enumerable: true,
              configurable: false
            });
          };
          for (name in _ref) {
            obj = _ref[name];
            _fn(name, obj);
          }
        }

        return JsonTypeWrapper;

      })();
      return new JsonTypeWrapper(_jsonType);
    };
    JsonType = (function(_super) {
      __extends(JsonType, _super);

      function JsonType(uid, initial_value, mutable) {
        var name, o;
        JsonType.__super__.constructor.call(this, uid);
        if (initial_value != null) {
          if (typeof initial_value !== "object") {
            throw new Error("The initial value of JsonTypes must be of type Object! (current type: " + (typeof initial_value) + ")");
          }
          for (name in initial_value) {
            o = initial_value[name];
            this.val(name, o, mutable);
          }
        }
      }

      JsonType.prototype.type = "JsonType";

      JsonType.prototype.applyDelete = function() {
        return JsonType.__super__.applyDelete.call(this);
      };

      JsonType.prototype.cleanup = function() {
        return JsonType.__super__.cleanup.call(this);
      };

      JsonType.prototype.toJson = function() {
        var json, name, o, that, val;
        if ((this.bound_json == null) || (Object.observe == null) || true) {
          val = this.val();
          json = {};
          for (name in val) {
            o = val[name];
            if (o === null) {
              json[name] = o;
            } else if (o.constructor === {}.constructor) {
              json[name] = this.val(name).toJson();
            } else if (o instanceof types.Operation) {
              while (o instanceof types.Operation) {
                o = o.val();
              }
              json[name] = o;
            } else {
              json[name] = o;
            }
          }
          this.bound_json = json;
          if ((Object.observe != null) && false) {
            that = this;
            Object.observe(this.bound_json, function(events) {
              var event, _i, _len, _results;
              _results = [];
              for (_i = 0, _len = events.length; _i < _len; _i++) {
                event = events[_i];
                if (event.type === "add" || (event.type = "update")) {
                  _results.push(that.val(event.name, event.object[event.name]));
                } else {
                  _results.push(void 0);
                }
              }
              return _results;
            });
            that.on('change', function(event_name, property_name, op) {
              var notifier, oldVal;
              if (this === that) {
                notifier = Object.getNotifier(that.bound_json);
                oldVal = that.bound_json[property_name];
                if (oldVal != null) {
                  notifier.performChange('update', function() {
                    return that.bound_json[property_name] = that.val(property_name);
                  }, that.bound_json);
                  return notifier.notify({
                    object: that.bound_json,
                    type: 'update',
                    name: property_name,
                    oldValue: oldVal,
                    changed_by: op.creator
                  });
                } else {
                  notifier.performChange('add', function() {
                    return that.bound_json[property_name] = that.val(property_name);
                  }, that.bound_json);
                  return notifier.notify({
                    object: that.bound_json,
                    type: 'add',
                    name: property_name,
                    oldValue: oldVal,
                    changed_by: op.creator
                  });
                }
              }
            });
          }
        }
        return this.bound_json;
      };

      JsonType.prototype.setReplaceManager = function(replace_manager) {
        this.replace_manager = replace_manager;
        return this.on(['change', 'addProperty'], function() {
          var _ref;
          if (replace_manager.parent != null) {
            return (_ref = replace_manager.parent).forwardEvent.apply(_ref, [this].concat(__slice.call(arguments)));
          }
        });
      };

      JsonType.prototype.getParent = function() {
        return this.replace_manager.parent;
      };

      JsonType.prototype.mutable_default = true;

      JsonType.prototype.setMutableDefault = function(mutable) {
        if (mutable === true || mutable === 'mutable') {
          JsonType.prototype.mutable_default = true;
        } else if (mutable === false || mutable === 'immutable') {
          JsonType.prototype.mutable_default = false;
        } else {
          throw new Error('Set mutable either "mutable" or "immutable"!');
        }
        return 'OK';
      };

      JsonType.prototype.val = function(name, content, mutable) {
        var json, obj, word;
        if (typeof name === 'object') {
          json = new JsonType(void 0, name, content);
          HB.addOperation(json).execute();
          this.replace_manager.replace(json);
          return this;
        } else if ((name != null) && arguments.length > 1) {
          if (mutable != null) {
            if (mutable === true || mutable === 'mutable') {
              mutable = true;
            } else {
              mutable = false;
            }
          } else {
            mutable = this.mutable_default;
          }
          if (typeof content === 'function') {
            return this;
          } else if ((content == null) || (((!mutable) || typeof content === 'number') && content.constructor !== Object)) {
            obj = HB.addOperation(new types.ImmutableObject(void 0, content)).execute();
            return JsonType.__super__.val.call(this, name, obj);
          } else {
            if (typeof content === 'string') {
              word = HB.addOperation(new types.WordType(void 0)).execute();
              word.insertText(0, content);
              return JsonType.__super__.val.call(this, name, word);
            } else if (content.constructor === Object) {
              json = HB.addOperation(new JsonType(void 0, content, mutable)).execute();
              return JsonType.__super__.val.call(this, name, json);
            } else {
              throw new Error("You must not set " + (typeof content) + "-types in collaborative Json-objects!");
            }
          }
        } else {
          return JsonType.__super__.val.call(this, name, content);
        }
      };

      Object.defineProperty(JsonType.prototype, 'value', {
        get: function() {
          return createJsonTypeWrapper(this);
        },
        set: function(o) {
          var o_name, o_obj, _results;
          if (o.constructor === {}.constructor) {
            _results = [];
            for (o_name in o) {
              o_obj = o[o_name];
              _results.push(this.val(o_name, o_obj, 'immutable'));
            }
            return _results;
          } else {
            throw new Error("You must only set Object values!");
          }
        }
      });

      JsonType.prototype._encode = function() {
        return {
          'type': "JsonType",
          'uid': this.getUid()
        };
      };

      return JsonType;

    })(types.MapManager);
    parser['JsonType'] = function(json) {
      var uid;
      uid = json['uid'];
      return new JsonType(uid);
    };
    types['JsonType'] = JsonType;
    return text_types;
  };

}).call(this);

//# sourceMappingURL=../Types/JsonTypes.js.map