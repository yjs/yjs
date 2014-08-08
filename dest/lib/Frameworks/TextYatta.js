var Engine, HistoryBuffer, TextYatta, text_types_uninitialized;

text_types_uninitialized = require("../Types/TextTypes.coffee");

HistoryBuffer = require("../HistoryBuffer.coffee");

Engine = require("../Engine.coffee");

TextYatta = (function() {
  function TextYatta(user_id, Connector) {
    var first_word, text_types;
    this.HB = new HistoryBuffer(user_id);
    text_types = text_types_uninitialized(this.HB);
    this.engine = new Engine(this.HB, text_types.parser);
    this.connector = new Connector(this.engine, this.HB, text_types.execution_listener);
    first_word = new text_types.types.Word(void 0);
    this.HB.addOperation(first_word).execute();
    this.root_element = first_word;
  }

  TextYatta.prototype.getRootElement = function() {
    return this.root_element;
  };

  TextYatta.prototype.getEngine = function() {
    return this.engine;
  };

  TextYatta.prototype.getConnector = function() {
    return this.connector;
  };

  TextYatta.prototype.getHistoryBuffer = function() {
    return this.HB;
  };

  TextYatta.prototype.getUserId = function() {
    return this.HB.getUserId();
  };

  TextYatta.prototype.val = function() {
    return this.root_element.val();
  };

  TextYatta.prototype.insertText = function(pos, content) {
    return this.root_element.insertText(pos, content);
  };

  TextYatta.prototype.deleteText = function(pos, length) {
    return this.root_element.deleteText(pos, length);
  };

  TextYatta.prototype.replaceText = function(text) {
    return this.root_element.replaceText(text);
  };

  return TextYatta;

})();

module.exports = TextYatta;

//# sourceMappingURL=TextYatta.js.map
