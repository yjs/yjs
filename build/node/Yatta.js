(function() {
  var Engine, HistoryBuffer, Yatta, adaptConnector, json_types_uninitialized;

  json_types_uninitialized = require("./Types/JsonTypes");

  HistoryBuffer = require("./HistoryBuffer");

  Engine = require("./Engine");

  adaptConnector = require("./ConnectorAdapter");

  Yatta = (function() {
    function Yatta(connector) {
      var beg, end, first_word, type_manager, uid_beg, uid_end, user_id;
      this.connector = connector;
      user_id = this.connector.id;
      this.HB = new HistoryBuffer(user_id);
      type_manager = json_types_uninitialized(this.HB);
      this.types = type_manager.types;
      this.engine = new Engine(this.HB, type_manager.parser);
      this.HB.engine = this.engine;
      adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
      first_word = new this.types.JsonType(this.HB.getReservedUniqueIdentifier()).execute();
      uid_beg = this.HB.getReservedUniqueIdentifier();
      uid_end = this.HB.getReservedUniqueIdentifier();
      beg = (new this.types.Delimiter(uid_beg, void 0, uid_end)).execute();
      end = (new this.types.Delimiter(uid_end, beg, void 0)).execute();
      this.root_element = (new this.types.ReplaceManager(void 0, this.HB.getReservedUniqueIdentifier(), beg, end)).execute();
      this.root_element.replace(first_word, this.HB.getReservedUniqueIdentifier());
    }

    Yatta.prototype.getSharedObject = function() {
      return this.root_element.val();
    };

    Yatta.prototype.getConnector = function() {
      return this.connector;
    };

    Yatta.prototype.getHistoryBuffer = function() {
      return this.HB;
    };

    Yatta.prototype.setMutableDefault = function(mutable) {
      return this.getSharedObject().setMutableDefault(mutable);
    };

    Yatta.prototype.getUserId = function() {
      return this.HB.getUserId();
    };

    Yatta.prototype.toJson = function() {
      return this.getSharedObject().toJson();
    };

    Yatta.prototype.val = function() {
      var _ref;
      return (_ref = this.getSharedObject()).val.apply(_ref, arguments);
    };

    Yatta.prototype.on = function() {
      var _ref;
      return (_ref = this.getSharedObject()).on.apply(_ref, arguments);
    };

    Yatta.prototype.deleteListener = function() {
      var _ref;
      return (_ref = this.getSharedObject()).deleteListener.apply(_ref, arguments);
    };

    Object.defineProperty(Yatta.prototype, 'value', {
      get: function() {
        return this.getSharedObject().value;
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

    return Yatta;

  })();

  module.exports = Yatta;

  if ((typeof window !== "undefined" && window !== null) && (window.Yatta == null)) {
    window.Yatta = Yatta;
  }

}).call(this);

//# sourceMappingURL=Yatta.js.map