
json_types_uninitialized = require "../Types/JsonTypes.coffee"
HistoryBuffer = require "../HistoryBuffer.coffee"
Engine = require "../Engine.coffee"

#
# Framework for Json data-structures.
# Known values that are supported:
# * String
# * Integer
# * Array
#
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

  #
  # @result JsonType
  #
  getRootElement: ()->
    @root_element

  #
  # @see Engine
  #
  getEngine: ()->
    @engine

  #
  # Get the initialized connector.
  #
  getConnector: ()->
    @connector

  #
  # @see HistoryBuffer
  #
  getHistoryBuffer: ()->
    @HB

  #
  # @see JsonType.setMutableDefault
  #
  setMutableDefault: (mutable)->
     @root_element.setMutableDefault(mutable)

  #
  # Get the UserId from the HistoryBuffer object.
  # In most cases this will be the same as the user_id value with which
  # JsonYatta was initialized (Depending on the HistoryBuffer implementation).
  #
  getUserId: ()->
    @HB.getUserId()

  #
  # @see JsonType.val
  #
  val : (name, content, mutable)->
    @root_element.val(name, content, mutable)

  #
  # @see JsonType.value
  #
  value : ()->
    @root_element.value

window?.JsonYatta = JsonYatta
module.exports = JsonYatta
