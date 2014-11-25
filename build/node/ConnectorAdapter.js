(function() {
  var adaptConnector;

  adaptConnector = function(connector, engine, HB, execution_listener) {
    var applyHb, sendHb, sendStateVector, send_;
    send_ = function(o) {
      if (o.uid.creator === HB.getUserId() && (typeof o.uid.op_number !== "string")) {
        return connector.broadcast(o);
      }
    };
    execution_listener.push(send_);
    sendStateVector = function() {
      return HB.getOperationCounter();
    };
    sendHb = function(state_vector) {
      return HB._encode(state_vector);
    };
    applyHb = function(hb) {
      return engine.applyOpsCheckDouble(hb);
    };
    connector.whenSyncing(sendStateVector, sendHb, applyHb);
    return connector.whenReceiving(function(sender, op) {
      if (op.uid.creator !== HB.getUserId()) {
        return engine.applyOp(op);
      }
    });
  };

  module.exports = adaptConnector;

}).call(this);

//# sourceMappingURL=ConnectorAdapter.js.map