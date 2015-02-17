var Engine, HistoryBuffer, adaptConnector, createY, json_types_uninitialized,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __hasProp = {}.hasOwnProperty;

json_types_uninitialized = require("./Types/JsonTypes");

HistoryBuffer = require("./HistoryBuffer");

Engine = require("./Engine");

adaptConnector = require("./ConnectorAdapter");

createY = function(connector) {
  var HB, Y, type_manager, types, user_id;
  user_id = null;
  if (connector.user_id != null) {
    user_id = connector.user_id;
  } else {
    user_id = "_temp";
    connector.on_user_id_set = function(id) {
      user_id = id;
      return HB.resetUserId(id);
    };
  }
  HB = new HistoryBuffer(user_id);
  type_manager = json_types_uninitialized(HB);
  types = type_manager.types;
  Y = (function(_super) {
    __extends(Y, _super);

    function Y() {
      this.connector = connector;
      this.HB = HB;
      this.types = types;
      this.engine = new Engine(this.HB, type_manager.types);
      adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
      Y.__super__.constructor.apply(this, arguments);
    }

    Y.prototype.getConnector = function() {
      return this.connector;
    };

    return Y;

  })(types.Object);
  return new Y(HB.getReservedUniqueIdentifier()).execute();
};

module.exports = createY;

if ((typeof window !== "undefined" && window !== null) && (window.Y == null)) {
  window.Y = createY;
}
