
#
# @param {Function} callback The callback is called when the connector is initialized.
#
createPeerJsConnector = (callback)->

  peer = new Peer {key: 'h7nlefbgavh1tt9'}

  #
  # @see http://peerjs.com
  #
  class PeerJsConnector

    #
    # @param {Engine} engine The transformation engine
    # @param {HistoryBuffer} HB
    # @param {Array<Function>} execution_listener You must ensure that whenever an operation is executed, every function in this Array is called.
    # @param {Yatta} yatta The Yatta framework.
    #
    constructor: (@engine, @HB, @execution_listener, @yatta)->

      @peer = peer
      @connections = []

      @peer.on 'connection', (conn)=>
        conn.send "hey"
        @addConnection conn




      send_ = (o)=>
        @send o
      @execution_listener.push send_

    connectToPeer: (id)->
      @addConnection peer.connect id

    addConnection: (conn)->
      @connections.push conn

      conn.on 'data', (data)=>
        if data is "hey"
        else if data.HB?
          @engine.applyOpsCheckDouble data.HB
        else if data.op?
          @engine.applyOp data.op
        else
          throw new Error "Can't parse this operation"

      sendHB = ()=>
        conn.send
          HB: @yatta.getHistoryBuffer()._encode()
      setTimeout sendHB, 1000

    #
    # This function is called whenever an operation was executed.
    # @param {Operation} o The operation that was executed.
    #
    send: (o)->
      if o.uid.creator is @HB.getUserId() and (typeof o.uid.op_number isnt "string")
        for conn in @connections
          conn.send
            op: o

    #
    # This function is called whenever an operation was received from another peer.
    # @param {Operation} o The operation that was received.
    #
    receive: (o)->
      if o.uid.creator isnt @HB.getUserId()
        @engine.applyOp o

  peer.on 'open', (id)->
    callback PeerJsConnector, id


module.exports = createPeerJsConnector
if window?
  if not window.Y?
    window.Y = {}
  window.Y.createPeerJsConnector = createPeerJsConnector

