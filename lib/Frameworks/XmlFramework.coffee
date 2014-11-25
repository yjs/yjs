
json_types_uninitialized = require "../Types/XmlTypes"
HistoryBuffer = require "../HistoryBuffer"
Engine = require "../Engine"
adaptConnector = require "../ConnectorAdapter"

#
# Framework for Xml-like data-structures.
# Known values that are supported:
#
class XmlFramework

  #
  # @param {String} user_id Unique id of the peer.
  # @param {Connector} Connector the connector class.
  #
  constructor: (user_id, @connector)->
    @HB = new HistoryBuffer user_id
    type_manager = json_types_uninitialized @HB
    @types = type_manager.types
    @engine = new Engine @HB, type_manager.parser
    @HB.engine = @engine # TODO: !! only for debugging
    adaptConnector @connector, @engine, @HB, type_manager.execution_listener
    #first_word = new @types.XmlType(undefined, undefined, undefined, undefined, document.createElement("shared"))
    #@HB.addOperation(first_word).execute()

    uid_beg = @HB.getReservedUniqueIdentifier()
    uid_end = @HB.getReservedUniqueIdentifier()
    beg = @HB.addOperation(new @types.Delimiter uid_beg, undefined, uid_end).execute()
    end = @HB.addOperation(new @types.Delimiter uid_end, beg, undefined).execute()

    @root_element = new @types.ReplaceManager undefined, @HB.getReservedUniqueIdentifier(), beg, end
    @HB.addOperation(@root_element).execute()
    #@root_element.replace first_word

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
  # JsonFramework was initialized (Depending on the HistoryBuffer implementation).
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
    if (arguments.length is 0) or (typeof arguments[0] is "boolean")
      @getSharedObject().val(arguments[0])
    else if arguments.length is 1
      newXml = new @types.XmlType(undefined, undefined, undefined, undefined, arguments[0])
      @HB.addOperation(newXml).execute()
      @root_element.replace newXml
      newXml
    else
      throw new Error "can only parse 0, or 1 parameter!"


  #
  # @see Operation.on
  #
  on: ()->
    @getSharedObject().on arguments...



module.exports = XmlFramework
if window?
  if not window.Y?
    window.Y = {}
  window.Y.XmlFramework = XmlFramework
