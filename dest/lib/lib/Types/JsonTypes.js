var text_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_types_uninitialized = require("./TextTypes.coffee");

module.exports = function(HB) {
  var JsonType, parser, text_types, types;
  text_types = text_types_uninitialized(HB);
  types = text_types.types;
  parser = text_types.parser;
  JsonType = (function(_super) {
    __extends(JsonType, _super);

    function JsonType(uid, initial_value) {
      var name, o;
      JsonType.__super__.constructor.call(this, uid);
      if (initial_value != null) {
        if (typeof initial_value !== "object") {
          throw new Error("The initial value of JsonTypes must be of type Object! (current type: " + (typeof initial_value) + ")");
        }
        for (name in initial_value) {
          o = initial_value[name];
          this.val(name, o);
        }
      }
    }

    JsonType.prototype.val = function(name, content) {
      var json, word;
      if ((name != null) && (content != null)) {
        if (typeof content === 'string') {
          word = HB.addOperation(new types.Word(HB.getNextOperationIdentifier(), content)).execute();
          JsonType.__super__.val.call(this, name, word);
        } else if (typeof content === 'object') {
          json = HB.addOperation(JsonType(HB.getNextOperationIdentifier(), content)).execute();
          JsonType.__super__.val.call(this, name, json);
        } else {
          throw new Error("You must not set " + (typeof content) + "-types in collaborative Json-objects!");
        }
        return this;
      } else {
        return JsonType.__super__.val.call(this, name, content);
      }
    };

    JsonType.prototype.toJson = function() {
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

//# sourceMappingURL=JsonTypes.js.map
