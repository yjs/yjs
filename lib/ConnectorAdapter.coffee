

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
  sendStateVector = ()->
    HB.getOperationCounter()
  sendHb = (state_vector)->
    HB._encode(state_vector)
  applyHb = (hb)->
    engine.applyOpsCheckDouble hb
  connector.whenSyncing sendStateVector, sendHb, applyHb
   
  connector.whenReceiving (sender, op)->
    if op.uid.creator isnt HB.getUserId()
      engine.applyOp op
      
module.exports = adaptConnector