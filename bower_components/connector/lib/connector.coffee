
class Connector
  
  constructor: ()->
    # is set to true when this is synced with all other connections
    @is_synced = false
    # compute all of these functions when all connections are synced.
    @compute_when_synced = []
    # Peerjs Connections: key: conn-id, value: conn
    @connections = {}
    # Connections, that have been initialized, but have not been (fully) synced yet.
    @unsynced_connections = {}
    # List of functions that shall process incoming data
    @receive_handlers = []
    # A list of functions that are executed (left to right) when syncing with a peer. 
    @sync_process_order = []
  
  getUniqueConnectionId: ->
    @id # make sure, that every connector implementation does it like this
  
  #
  # Execute a function _when_ we are connected. If not connected, wait until connected.
  # @param f {Function} Will be executed on the PeerJs-Connector context.
  #
  whenSynced: (args)->
    if @is_synced
      args[0].apply this, args[1..]
    else
      @compute_when_synced.push args 
  
  #
  # Execute an function _when_ a message is received.
  # @param f {Function} Will be executed on the PeerJs-Connector context. f will be called with (sender_id, broadcast {true|false}, message).
  #
  whenReceiving: (f)->
    @receive_handlers.push f
  
  #
  # Send a message to a (sub)-set of all connected peers.
  # @param peers {Array<connection_ids>} A set of ids.
  # @param message {Object} The message to send.
  #
  multicast: (peers, message)->
    @whenSynced [_send, peers, message]
  
  #
  # Send a message to one of the connected peers.
  # @param peers {connection_id} A connection id.
  # @param message {Object} The message to send.
  #
  unicast: (peer, message)->
    @whenSynced [_send, peer, message]
  
  # 
  # Broadcast a message to all connected peers.
  # @param message {Object} The message to broadcast.
  # 
  broadcast: (message)->
    @whenSynced [()=>
      for peerid,peer of @connections
        @_send peerid, message]
 
  #
  # Define how you want to handle the sync process of two users.
  # This is a synchronous handshake. Every user will perform exactly the same actions at the same time. E.g.
  # @example
  #   whenSyncing(function(){ // first call must not have parameters!
  #       return this.id; // Send the id of this connector.
  #   },function(peerid){ // you receive the peerid of the other connections.
  #       // you can do something with the peerid
  #       // return "you are my friend"; // you could send another massage.
  #   }); // this is the end of the sync process.
  #
  whenSyncing: ()->
    for i in [(arguments.length-1)..0]
      @sync_process_order.unshift arguments[i]



module.exports = Connector
