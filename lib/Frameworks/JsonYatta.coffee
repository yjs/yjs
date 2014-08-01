
json_types_uninitialized = require "../Types/JsonTypes.coffee"
HistoryBuffer = require "../HistoryBuffer.coffee"
Engine = require "../Engine.coffee"

class JsonYatta
  constructor: (user_id, Connector)->
    @HB = new HistoryBuffer user_id
    json_types = json_types_uninitialized @HB
    @engine = new Engine @HB, json_types.parser
    @connector = new Connector @engine, @HB, json_types.execution_listener, @
    root_elem = @connector.getRootElement()
    if not root_elem?
      first_word = new json_types.types.JsonType @HB.getNextOperationIdentifier()
      @HB.addOperation(first_word)
      first_word.execute()
      @root_element = first_word
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

  val: (name, content)->
    @root_element.val(name, content)

window?.JsonYatta = JsonYatta
module.exports = JsonYatta
