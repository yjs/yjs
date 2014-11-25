
window.PeerJsConnector = class PeerJsConnector
  
  constructor: (@id, options)->
    that = this
    @isConnected = false
    @computeWhenConnected = []
    @connections = {}
    @unsynced_connections = {}
    @receive_handlers = []
    @conn = new Peer arguments[0], arguments[1]
    @conn.on 'error', (err)->
      throw new Error "Peerjs connector: #{err}"
    @conn.on 'disconnected', ()->
      throw new Error "Peerjs connector disconnected from signalling server. Cannot accept new connections. Not fatal, but not so good either.."
    @conn.on 'disconnect', ()->
      that.conn.reconnect()
    @conn.on 'connection', @_addConnection
    # send all connection ids
    exchangeConnections = ()->
      conns = for peerid,peer of that.connections 
        peerid
      conns
    joinConnections = (peers)->
      for peer in peers
        if not @unsynced_connections[peer.peer]?
          @unsynced_connections[peer.peer] = peer
          that.join peer
      true 
    @syncProcessOrder = [exchangeConnections, joinConnections]
      
  
  #
  # Execute an function _when_ we are connected. If not connected, wait until connected.
  # @param f {Function} Will be executed on the PeerJs-Connector context. No parameters.
  #
  whenConnected: (f)->
    if @isConnected
      f.call this
    else
      @computeWhenConnected.push f
  
  #
  # Execute an function _when_ a message is received.
  # @param f {Function} Will be executed on the PeerJs-Connector context. f will be called with (sender_id, broadcast {true|false}, message).
  #
  whenReceiving: (f)->
    @receive_handlers.push f
  
  #
  # Send a message to a (sub)-set of peers. 
  # @param peers {Array<connection_ids>} A set of ids.
  # @param message {Object} The message to send.
  #
  send: (peers, message)->
    @whenConnected ()=>
      for peer in peers
        @connections[peer].send message
  
  # 
  # Broadcast a message to all connected peers.
  # @param message {Object} The message to broadcast.
  # 
  broadcast: (message)->
    @whenConnected ()=>
      for peerid,peer of @connections
        peer.send message
 
    
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
    for f in arguments 
      @syncProcessOrder.push f
    
  #
  # Join a communication room. In case of peerjs, you just have to join to one other client. This connector will join to the other peers automatically.
  # @param id {String} The connection id of another client.
  #
  join: (peerid)->
    if not @connections[peerid]? and peerid isnt @id
      peer = @conn.connect peerid, {reliable: true} 
      @_addConnection peer
      true
    else
      false
        
  _addConnection: (peer)=>
    peer.on 'open', ()=>
      @currentlyadding = peer
      that = @
      peer.send that.syncProcessOrder[0]()
      current_sync_function = that.syncProcessOrder[1];
      current_sync_i = 0
      peer.on 'data', (data)->
        console.log("receive data: #{JSON.stringify data}")
        current_sync_i++
        if current_sync_i < that.syncProcessOrder.length
          peer.send current_sync_function.call that, data
          current_sync_function = that.syncProcessOrder[current_sync_i]
        else if current_sync_i is that.syncProcessOrder.length
          that.connections[peer.peer] = peer
          peer.on 'close', ()->
            delete that.connections[peer.peer]
          delete that.unsynced_connections[peer.peer]
          isEmpty = (os)->
            for o of os
              return false
            return true
          if isEmpty(that.unsynced_connections)
            that.isConnected = true
            for f in that.computeWhenConnected
              f.call(that)
            that.computeWhenConnected = []
        else 
          for f in that.receive_handlers 
            f peer.peer, data


      
      
      
      
      
      
      
      
      
      