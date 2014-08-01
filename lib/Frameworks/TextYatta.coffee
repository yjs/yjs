
text_types_uninitialized = require "../Types/TextTypes.coffee"
HistoryBuffer = require "../HistoryBuffer.coffee"
Engine = require "../Engine.coffee"

class TextYatta
  constructor: (user_id, Connector)->
    @HB = new HistoryBuffer user_id
    text_types = text_types_uninitialized @HB
    @engine = new Engine @HB, text_types.parser
    @connector = new Connector @engine, @HB, text_types.execution_listener
    root_elem = @connector.getRootElement()
    if not root_elem?
      first_word = new text_types.types.Word @HB.getNextOperationIdentifier()
      @HB.addOperation(first_word)
      first_word.execute()
      @root_element = @HB.addOperation(new text_types.types.ReplaceManager first_word, @HB.getNextOperationIdentifier()).execute()
    else
      @root_element = @HB.getOperation(root_elem)

  getRootElement: ()->
    @root_element

  getEngine: ()->
    @engine

  getConnector: ()->
    @connector

  getHistoryBuffer: ()->
    @HB

  getUserId: ()->
    @HB.getUserId()

  val: ()->
    @root_element.val().val()

  insertText: (pos, content)->
    @root_element.val().insertText pos, content

  deleteText: (pos, length)->
    @root_element.val().deleteText pos, length

  replaceText: (text)->
    @root_element.val().replaceText text


module.exports = TextYatta
