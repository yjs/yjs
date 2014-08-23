(function() {
  var Engine, HistoryBuffer, JsonFramework, json_types_uninitialized;

  json_types_uninitialized = require("../Types/JsonTypes");

  HistoryBuffer = require("../HistoryBuffer");

  Engine = require("../Engine");

  JsonFramework = (function() {
    function JsonFramework(user_id, Connector) {
      var first_word, type_manager;
      this.HB = new HistoryBuffer(user_id);
      type_manager = json_types_uninitialized(this.HB);
      this.types = type_manager.types;
      this.engine = new Engine(this.HB, type_manager.parser);
      this.connector = new Connector(this.engine, this.HB, type_manager.execution_listener, this);
      first_word = new this.types.JsonType(this.HB.getReservedUniqueIdentifier());
      this.HB.addOperation(first_word).execute();
      this.root_element = first_word;
    }

    JsonFramework.prototype.getSharedObject = function() {
      return this.root_element;
    };

    JsonFramework.prototype.getConnector = function() {
      return this.connector;
    };

    JsonFramework.prototype.getHistoryBuffer = function() {
      return this.HB;
    };

    JsonFramework.prototype.setMutableDefault = function(mutable) {
      return this.root_element.setMutableDefault(mutable);
    };

    JsonFramework.prototype.getUserId = function() {
      return this.HB.getUserId();
    };

    JsonFramework.prototype.toJson = function() {
      return this.root_element.toJson();
    };

    JsonFramework.prototype.val = function(name, content, mutable) {
      return this.root_element.val(name, content, mutable);
    };

    JsonFramework.prototype.on = function() {
      var _ref;
      return (_ref = this.root_element).on.apply(_ref, arguments);
    };

    JsonFramework.prototype.deleteListener = function() {
      var _ref;
      return (_ref = this.root_element).deleteListener.apply(_ref, arguments);
    };

    Object.defineProperty(JsonFramework.prototype, 'value', {
      get: function() {
        return this.root_element.value;
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

    return JsonFramework;

  })();

  module.exports = JsonFramework;

  if (typeof window !== "undefined" && window !== null) {
    if (window.Y == null) {
      window.Y = {};
    }
    window.Y.JsonFramework = JsonFramework;
  }

}).call(this);

//# sourceMappingURL=../Frameworks/JsonFramework.js.map