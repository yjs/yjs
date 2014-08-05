var Engine, HistoryBuffer, JsonYatta, json_types_uninitialized;

json_types_uninitialized = require("../Types/JsonTypes.coffee");

HistoryBuffer = require("../HistoryBuffer.coffee");

Engine = require("../Engine.coffee");

JsonYatta = (function() {
  function JsonYatta(user_id, Connector) {
    var first_word, json_types, root_elem;
    this.HB = new HistoryBuffer(user_id);
    json_types = json_types_uninitialized(this.HB);
    this.engine = new Engine(this.HB, json_types.parser);
    this.connector = new Connector(this.engine, this.HB, json_types.execution_listener, this);
    root_elem = this.connector.getRootElement();
    if (root_elem == null) {
      first_word = new json_types.types.JsonType(this.HB.getNextOperationIdentifier());
      this.HB.addOperation(first_word);
      first_word.execute();
      this.root_element = first_word;
    } else {
      this.root_element = this.HB.getOperation(root_elem);
    }
  }

  JsonYatta.prototype.getRootElement = function() {
    return this.root_element;
  };

  JsonYatta.prototype.getEngine = function() {
    return this.engine;
  };

  JsonYatta.prototype.getConnector = function() {
    return this.connector;
  };

  JsonYatta.prototype.getHistoryBuffer = function() {
    return this.HB;
  };

  JsonYatta.prototype.setMutableDefault = function(mutable) {
    return this.root_element.setMutableDefault(mutable);
  };

  JsonYatta.prototype.getUserId = function() {
    return this.HB.getUserId();
  };

  JsonYatta.prototype.val = function(name, content, mutable) {
    return this.root_element.val(name, content, mutable);
  };

  Object.defineProperty(JsonYatta.prototype, 'value', {
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

  return JsonYatta;

})();

if (typeof window !== "undefined" && window !== null) {
  window.JsonYatta = JsonYatta;
}

module.exports = JsonYatta;

//# sourceMappingURL=JsonYatta.js.map
