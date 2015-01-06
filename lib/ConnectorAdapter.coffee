

#
# @param {Engine} engine The transformation engine
# @param {HistoryBuffer} HB
# @param {Array<Function>} execution_listener You must ensure that whenever an operation is executed, every function in this Array is called.
#
adaptConnector = (connector, engine, HB, execution_listener)->
  send_ = (o)->
    if o.uid.creator is HB.getUserId() and (typeof o.uid.op_number isnt "string")
      connector.broadcast o

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

  sendStateVector = ()->
    encode_state_vector HB.getOperationCounter()

  sendHb = (v)->
    state_vector = parse_state_vector v
    json =
      hb: HB._encode(state_vector)
      state_vector: encode_state_vector HB.getOperationCounter()
    json

  applyHb = (res)->
    HB.renewStateVector parse_state_vector res.state_vector
    engine.applyOpsCheckDouble res.hb

  connector.whenSyncing sendStateVector, sendHb, applyHb

  connector.whenReceiving (sender, op)->
    if op.uid.creator isnt HB.getUserId()
      engine.applyOp op

  HB.setInvokeSyncHandler connector.invokeSync

module.exports = adaptConnector