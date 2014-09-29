
#
# @overload createPeerJsConnector peerjs_options, callback
#   @param {Object} peerjs_options Is the options object that is passed to PeerJs.
#   @param {Function} callback The callback is called when the connector is initialized.
# @overload createPeerJsConnector peerjs_user_id, peerjs_options, callback
#   @param {String} peerjs_user_id The user_id that is passed to PeerJs as the user_id and should be unique between all (also the unconnected) Peers.
#   @param {Object} peerjs_options Is the options object that is passed to PeerJs.
#   @param {Function} callback The callback is called when the connector is initialized.
#
createPeerJsConnector = ()->
  peer = null
  if arguments.length is 2
    peer = new Peer arguments[0]
    callback = arguments[1]
  else
    peer = new Peer arguments[0], arguments[1]
    peer.on 'error', (err)->
      throw new Error "Peerjs connector: #{err}"
    peer.on 'disconnected', ()->
      throw new Error "Peerjs connector disconnected from signalling server. Cannot accept new connections. Not fatal, but not so good either.."
    callback = arguments[2]


  #
  # PeerJs is a Framework that enables you to connect to other peers. You just need the
  # user-id of the peer (browser/client). And then you can connect to it.
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
      @connections = {}

      @peer.on 'connection', (conn)=>
        @addConnection conn

      sync_every_collaborator = ()=>
          for conn_id, conn of @connections
            conn.send
              sync_state_vector: @HB.getOperationCounter()
      setInterval sync_every_collaborator, 8000

      send_ = (o)=>
        if o.uid.creator is @HB.getUserId() and (typeof o.uid.op_number isnt "string")
          for conn_id,conn of @connections
            conn.send
              op: o
      @execution_listener.push send_




    #
    # Connect the Framework to another peer. Therefore you have to receive his
    # user_id. If the other peer is connected to other peers, the PeerJsConnector
    # will automatically connect to them too.
    #
    # Transmitting the user_id is your job.
    # See [TextEditing](../../examples/TextEditing/) for a nice example
    # on how to do that with urls.
    #
    # @param id {String} Connection id
    #
    connectToPeer: (id)->
      if not @connections[id]? and id isnt @yatta.getUserId()
        @addConnection peer.connect id

    #
    # Receive the id of every connected peer.
    # @return {Array<String>} A list of Peer-Ids
    #
    getAllConnectionIds: ()->
      for conn_id of @connections
        conn_id

    #
    # Adds an existing connection to this connector.
    # @param conn {PeerJsConnection}
    #
    addConnection: (conn)->
      #
      # What this method does:
      # * Send state vector
      # * Receive HB -> apply them
      # * Send connections
      # * Receive Connections -> Connect to unknow connections
      @connections[conn.peer] = conn
      initialized_me = false
      initialized_him = false
      conn.on 'data', (data)=>
        if data is "empty_message"
          # nop
        else if data.HB?
          initialized_me = true
          @engine.applyOpsCheckDouble data.HB
          if not data.initialized
            conn.send
              conns: @getAllConnectionIds()
        else if data.op?
          @engine.applyOp data.op
        else if data.conns?
          for conn_id in data.conns
            @connectToPeer conn_id
        else if data.sync_state_vector?
          console.log "turinae"
          conn.send
            HB: @yatta.getHistoryBuffer()._encode(data.sync_state_vector)
            initialized: true
        else if data.state_vector?
          if not initialized_him
            # make sure, that it is sent only once
            conn.send
              HB: @yatta.getHistoryBuffer()._encode(data.state_vector)
              initialized: false
            initialized_him = true
        else
          throw new Error "Can't parse this operation"

      sendStateVector = ()=>
        conn.send
          state_vector: @HB.getOperationCounter()
        if not initialized_me
          # Because of a bug in PeerJs,
          # we never know if state vector was actually sent
          setTimeout sendStateVector, 100
      sendStateVector()

  peer.on 'open', (id)->
    callback PeerJsConnector, id


module.exports = createPeerJsConnector
if window?
  if not window.Y?
    window.Y = {}
  window.Y.createPeerJsConnector = createPeerJsConnector

