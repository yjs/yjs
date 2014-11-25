(function() {
  var Engine, HistoryBuffer, TextFramework, adaptConnector, text_types_uninitialized;

  text_types_uninitialized = require("../Types/TextTypes");

  HistoryBuffer = require("../HistoryBuffer");

  Engine = require("../Engine");

  adaptConnector = require("../ConnectorAdapter");

  TextFramework = (function() {
    function TextFramework(user_id, connector) {
      var beg, beginning, end, first_word, text_types, uid_beg, uid_end, uid_r;
      this.connector = connector;
      this.HB = new HistoryBuffer(user_id);
      text_types = text_types_uninitialized(this.HB);
      this.types = text_types.types;
      this.engine = new Engine(this.HB, text_types.parser);
      adaptConnector(this.connector, this.engine, this.HB, text_types.execution_listener);
      beginning = this.HB.addOperation(new this.types.Delimiter({
        creator: '_',
        op_number: '_beginning'
      }, void 0, void 0));
      end = this.HB.addOperation(new this.types.Delimiter({
        creator: '_',
        op_number: '_end'
      }, beginning, void 0));
      beginning.next_cl = end;
      beginning.execute();
      end.execute();
      first_word = new this.types.WordType({
        creator: '_',
        op_number: '_'
      }, beginning, end);
      this.HB.addOperation(first_word).execute();
      uid_r = {
        creator: '_',
        op_number: "RM"
      };
      uid_beg = {
        creator: '_',
        op_number: "_RM_beginning"
      };
      uid_end = {
        creator: '_',
        op_number: "_RM_end"
      };
      beg = this.HB.addOperation(new this.types.Delimiter(uid_beg, void 0, uid_end)).execute();
      end = this.HB.addOperation(new this.types.Delimiter(uid_end, beg, void 0)).execute();
      this.root_element = this.HB.addOperation(new this.types.ReplaceManager(void 0, uid_r, beg, end)).execute();
      this.root_element.replace(first_word, {
        creator: '_',
        op_number: 'Replaceable'
      });
    }

    TextFramework.prototype.getSharedObject = function() {
      return this.root_element.val();
    };

    TextFramework.prototype.getConnector = function() {
      return this.connector;
    };

    TextFramework.prototype.getHistoryBuffer = function() {
      return this.HB;
    };

    TextFramework.prototype.getUserId = function() {
      return this.HB.getUserId();
    };

    TextFramework.prototype.val = function() {
      return this.getSharedObject().val();
    };

    TextFramework.prototype.insertText = function(pos, content) {
      return this.getSharedObject().insertText(pos, content);
    };

    TextFramework.prototype.deleteText = function(pos, length) {
      return this.getSharedObject().deleteText(pos, length);
    };

    TextFramework.prototype.bind = function(textarea) {
      return this.getSharedObject().bind(textarea);
    };

    TextFramework.prototype.replaceText = function(text) {
      return this.getSharedObject().replaceText(text);
    };

    TextFramework.prototype.on = function() {
      var _ref;
      return (_ref = this.root_element).on.apply(_ref, arguments);
    };

    return TextFramework;

  })();

  module.exports = TextFramework;

  if (typeof window !== "undefined" && window !== null) {
    if (window.Y == null) {
      window.Y = {};
    }
    window.Y.TextFramework = TextFramework;
  }

}).call(this);

//# sourceMappingURL=../Frameworks/TextFramework.js.map