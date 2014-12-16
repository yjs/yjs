
json_types_uninitialized = require "./Types/JsonTypes"
HistoryBuffer = require "./HistoryBuffer"
Engine = require "./Engine"
adaptConnector = require "./ConnectorAdapter"


#
# Framework for Json data-structures.
# Known values that are supported:
# * String
# * Integer
# * Array
#
class Yatta

  #
  # @param {String} user_id Unique id of the peer.
  # @param {Connector} Connector the connector class.
  #
  constructor: (@connector)->
    user_id = @connector.id # TODO: change to getUniqueId()
    @HB = new HistoryBuffer user_id
    type_manager = json_types_uninitialized @HB
    @types = type_manager.types
    @engine = new Engine @HB, type_manager.parser
    @HB.engine = @engine # TODO: !! only for debugging
    adaptConnector @connector, @engine, @HB, type_manager.execution_listener
    first_word = new @types.JsonType(@HB.getReservedUniqueIdentifier()).execute()

    uid_beg = @HB.getReservedUniqueIdentifier()
    uid_end = @HB.getReservedUniqueIdentifier()
    beg = (new @types.Delimiter uid_beg, undefined, uid_end).execute()
    end = (new @types.Delimiter uid_end, beg, undefined).execute()

    @root_element = (new @types.ReplaceManager undefined, @HB.getReservedUniqueIdentifier(), beg, end).execute()
    @root_element.replace first_word, @HB.getReservedUniqueIdentifier()

  #
  # @return JsonType
  #
  getSharedObject: ()->
    @root_element.val()

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
    @getSharedObject().setMutableDefault(mutable)

  #
  # Get the UserId from the HistoryBuffer object.
  # In most cases this will be the same as the user_id value with which
  # Yatta was initialized (Depending on the HistoryBuffer implementation).
  #
  getUserId: ()->
    @HB.getUserId()

  #
  # @see JsonType.toJson
  #
  toJson : ()->
    @getSharedObject().toJson()

  #
  # @see JsonType.val
  #
  val : ()->
    @getSharedObject().val arguments...

  #
  # @see Operation.on
  #
  on: ()->
    @getSharedObject().on arguments...

  #
  # @see Operation.deleteListener
  #
  deleteListener: ()->
    @getSharedObject().deleteListener arguments...

  #
  # @see JsonType.value
  #
  Object.defineProperty Yatta.prototype, 'value',
    get : -> @getSharedObject().value
    set : (o)->
      if o.constructor is {}.constructor
        for o_name,o_obj of o
          @val(o_name, o_obj, 'immutable')
      else
        throw new Error "You must only set Object values!"

module.exports = Yatta
if window? and not window.Yatta?
  window.Yatta = Yatta
