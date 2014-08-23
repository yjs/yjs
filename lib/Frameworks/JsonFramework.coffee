
json_types_uninitialized = require "../Types/JsonTypes"
HistoryBuffer = require "../HistoryBuffer"
Engine = require "../Engine"

#
# Framework for Json data-structures.
# Known values that are supported:
# * String
# * Integer
# * Array
#
class JsonFramework

  #
  # @param {String} user_id Unique id of the peer.
  # @param {Connector} Connector the connector class.
  #
  constructor: (user_id, Connector)->
    @HB = new HistoryBuffer user_id
    type_manager = json_types_uninitialized @HB
    @types = type_manager.types
    @engine = new Engine @HB, type_manager.parser
    @connector = new Connector @engine, @HB, type_manager.execution_listener, @
    first_word = new @types.JsonType @HB.getReservedUniqueIdentifier()
    @HB.addOperation(first_word).execute()
    @root_element = first_word

  #
  # @return JsonType
  #
  getSharedObject: ()->
    @root_element

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
  # JsonFramework was initialized (Depending on the HistoryBuffer implementation).
  #
  getUserId: ()->
    @HB.getUserId()

  #
  # @see JsonType.toJson
  #
  toJson : ()->
    @root_element.toJson()

  #
  # @see JsonType.val
  #
  val : (name, content, mutable)->
    @root_element.val(name, content, mutable)

  #
  # @see Operation.on
  #
  on: ()->
    @root_element.on arguments...

  #
  # @see Operation.deleteListener
  #
  deleteListener: ()->
    @root_element.deleteListener arguments...

  #
  # @see JsonType.value
  #
  Object.defineProperty JsonFramework.prototype, 'value',
    get : -> @root_element.value
    set : (o)->
      if o.constructor is {}.constructor
        for o_name,o_obj of o
          @val(o_name, o_obj, 'immutable')
      else
        throw new Error "You must only set Object values!"

module.exports = JsonFramework
if window?
  if not window.Y?
    window.Y = {}
  window.Y.JsonFramework = JsonFramework
