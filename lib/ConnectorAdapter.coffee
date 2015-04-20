
ConnectorClass = require "./ConnectorClass"
#
# @param {Engine} engine The transformation engine
# @param {HistoryBuffer} HB
# @param {Array<Function>} execution_listener You must ensure that whenever an operation is executed, every function in this Array is called.
#
adaptConnector = (connector, engine, HB, execution_listener)->

  for name, f of ConnectorClass
    connector[name] = f

  connector.setIsBoundToY()

  send_ = (o)->
    if (o.uid.creator is HB.getUserId()) and
        (typeof o.uid.op_number isnt "string") and # TODO: i don't think that we need this anymore..
        (HB.getUserId() isnt "_temp")
      connector.broadcast o

  if connector.invokeSync?
    HB.setInvokeSyncHandler connector.invokeSync

  execution_listener.push send_
  # For the XMPPConnector: lets send it as an array
  # therefore, we have to restructure it later
  encode_state_vector = (v)->
    for name,value of v
      user: name
      state: value
  parse_state_vector = (v)->
    state_vector = {}
    for s in v
      state_vector[s.user] = s.state
    state_vector

  getStateVector = ()->
    encode_state_vector HB.getOperationCounter()

  getHB = (v)->
    state_vector = parse_state_vector v
    hb = HB._encode state_vector
    json =
      hb: hb
      state_vector: encode_state_vector HB.getOperationCounter()
    json

  applyHB = (hb, fromHB)->
    engine.applyOp hb, fromHB

  connector.getStateVector = getStateVector
  connector.getHB = getHB
  connector.applyHB = applyHB

  connector.receive_handlers ?= []
  connector.receive_handlers.push (sender, op)->
    if op.uid.creator isnt HB.getUserId()
      engine.applyOp op


module.exports = adaptConnector
