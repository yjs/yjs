
json_types_uninitialized = require "./Types/JsonTypes"
HistoryBuffer = require "./HistoryBuffer"
Engine = require "./Engine"
adaptConnector = require "./ConnectorAdapter"

createY = (connector)->
  user_id = null
  if connector.id?
    user_id = connector.id # TODO: change to getUniqueId()
  else
    user_id = "_temp"
    connector.onUserIdSet (id)->
      user_id = id
      HB.resetUserId id
  HB = new HistoryBuffer user_id
  type_manager = json_types_uninitialized HB
  types = type_manager.types

  #
  # Framework for Json data-structures.
  # Known values that are supported:
  # * String
  # * Integer
  # * Array
  #
  class Y extends types.Object

    #
    # @param {String} user_id Unique id of the peer.
    # @param {Connector} Connector the connector class.
    #
    constructor: ()->
      @connector = connector
      @HB = HB
      @types = types
      @engine = new Engine @HB, type_manager.types
      adaptConnector @connector, @engine, @HB, type_manager.execution_listener
      super

    getConnector: ()->
      @connector

  return new Y(HB.getReservedUniqueIdentifier()).execute()

module.exports = createY
if window? and not window.Y?
  window.Y = createY
