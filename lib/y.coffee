
structured_ops_uninitialized = require "./Operations/Structured"

HistoryBuffer = require "./HistoryBuffer"
Engine = require "./Engine"
adaptConnector = require "./ConnectorAdapter"

createY = (connector)->
  user_id = null
  if connector.user_id?
    user_id = connector.user_id # TODO: change to getUniqueId()
  else
    user_id = "_temp"
    connector.on_user_id_set = (id)->
      user_id = id
      HB.resetUserId id
  HB = new HistoryBuffer user_id
  ops_manager = structured_ops_uninitialized HB, this.constructor
  ops = ops_manager.operations

  engine = new Engine HB, ops
  adaptConnector connector, engine, HB, ops_manager.execution_listener

  ops.Operation.prototype.HB = HB
  ops.Operation.prototype.operations = ops
  ops.Operation.prototype.engine = engine
  ops.Operation.prototype.connector = connector
  ops.Operation.prototype.custom_types = this.constructor

  ct = new createY.Object()
  model = new ops.MapManager(ct, HB.getReservedUniqueIdentifier()).execute()
  ct._setModel model
  ct

module.exports = createY
if window?
  window.Y = createY

createY.Object = require "./ObjectType"
