(function() {
  var Engine, HistoryBuffer, adaptConnector, createYatta, json_types_uninitialized,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  json_types_uninitialized = require("./Types/JsonTypes");

  HistoryBuffer = require("./HistoryBuffer");

  Engine = require("./Engine");

  adaptConnector = require("./ConnectorAdapter");

  createYatta = function(connector) {
    var HB, Yatta, type_manager, types, user_id;
    user_id = connector.id;
    HB = new HistoryBuffer(user_id);
    type_manager = json_types_uninitialized(HB);
    types = type_manager.types;
    Yatta = (function(_super) {
      __extends(Yatta, _super);

      function Yatta() {
        this.connector = connector;
        this.HB = HB;
        this.types = types;
        this.engine = new Engine(this.HB, type_manager.parser);
        adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
        Yatta.__super__.constructor.apply(this, arguments);
      }

      Yatta.prototype.getConnector = function() {
        return this.connector;
      };

      return Yatta;

    })(types.JsonType);
    return new Yatta(HB.getReservedUniqueIdentifier()).execute();
  };

  module.exports = createYatta;

  if ((typeof window !== "undefined" && window !== null) && (window.Yatta == null)) {
    window.Yatta = createYatta;
  }

}).call(this);

//# sourceMappingURL=Yatta.js.map