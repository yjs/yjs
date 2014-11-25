(function() {
  var Engine, HistoryBuffer, XmlFramework, adaptConnector, json_types_uninitialized;

  json_types_uninitialized = require("../Types/XmlTypes");

  HistoryBuffer = require("../HistoryBuffer");

  Engine = require("../Engine");

  adaptConnector = require("../ConnectorAdapter");

  XmlFramework = (function() {
    function XmlFramework(user_id, connector) {
      var beg, end, type_manager, uid_beg, uid_end;
      this.connector = connector;
      this.HB = new HistoryBuffer(user_id);
      type_manager = json_types_uninitialized(this.HB);
      this.types = type_manager.types;
      this.engine = new Engine(this.HB, type_manager.parser);
      this.HB.engine = this.engine;
      adaptConnector(this.connector, this.engine, this.HB, type_manager.execution_listener);
      uid_beg = this.HB.getReservedUniqueIdentifier();
      uid_end = this.HB.getReservedUniqueIdentifier();
      beg = this.HB.addOperation(new this.types.Delimiter(uid_beg, void 0, uid_end)).execute();
      end = this.HB.addOperation(new this.types.Delimiter(uid_end, beg, void 0)).execute();
      this.root_element = new this.types.ReplaceManager(void 0, this.HB.getReservedUniqueIdentifier(), beg, end);
      this.HB.addOperation(this.root_element).execute();
    }

    XmlFramework.prototype.getSharedObject = function() {
      return this.root_element.val();
    };

    XmlFramework.prototype.getConnector = function() {
      return this.connector;
    };

    XmlFramework.prototype.getHistoryBuffer = function() {
      return this.HB;
    };

    XmlFramework.prototype.setMutableDefault = function(mutable) {
      return this.getSharedObject().setMutableDefault(mutable);
    };

    XmlFramework.prototype.getUserId = function() {
      return this.HB.getUserId();
    };

    XmlFramework.prototype.toJson = function() {
      return this.getSharedObject().toJson();
    };

    XmlFramework.prototype.val = function() {
      var newXml;
      if ((arguments.length === 0) || (typeof arguments[0] === "boolean")) {
        return this.getSharedObject().val(arguments[0]);
      } else if (arguments.length === 1) {
        newXml = new this.types.XmlType(void 0, void 0, void 0, void 0, arguments[0]);
        this.HB.addOperation(newXml).execute();
        this.root_element.replace(newXml);
        return newXml;
      } else {
        throw new Error("can only parse 0, or 1 parameter!");
      }
    };

    XmlFramework.prototype.on = function() {
      var _ref;
      return (_ref = this.getSharedObject()).on.apply(_ref, arguments);
    };

    return XmlFramework;

  })();

  module.exports = XmlFramework;

  if (typeof window !== "undefined" && window !== null) {
    if (window.Y == null) {
      window.Y = {};
    }
    window.Y.XmlFramework = XmlFramework;
  }

}).call(this);

//# sourceMappingURL=../Frameworks/XmlFramework.js.map