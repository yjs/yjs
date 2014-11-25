Connector = require '../connector'
      
window.PeerJsConnector = class PeerJsConnector extends Connector
  
  constructor: (@id, options)->
    super()
    that = this
    # The following two functions should be performed at the end of the syncing process.
    # In peerjs all connection ids must be send. 
    @sync_process_order.push ()->
      peers = for peerid,conn of that.connections 
        peerid
      peers 
    # Then connect to the connection ids. 
    @sync_process_order.push (peers)->
      for peerid in peers 
          that.join peerid
      true 
    # Create the Peerjs instance
    @conn = new Peer @id, options
    # TODO: improve error handling, what happens if disconnected? provide feedback
    @conn.on 'error', (err)->
      throw new Error "Peerjs connector: #{err}"
    @conn.on 'disconnected', ()->
      throw new Error "Peerjs connector disconnected from signalling server. Cannot accept new connections. Not fatal, but not so good either.."
    @conn.on 'disconnect', ()->
      that.conn.reconnect()
    @conn.on 'connection', @_addConnection
  
  #
  # Join a communication room. In case of peerjs, you just have to join to one other client. This connector will join to the other peers automatically.
  # @param id {String} The connection id of another client.
  #
  join: (peerid)->
    if not @unsynced_connections[peerid]? and not @connections[peerid]? and peerid isnt @id
      peer = @conn.connect peerid, {reliable: true} 
      @unsynced_connections[peerid] = peer
      @_addConnection peer
      true
    else
      false
  
  #
  # Send a message to a peer or set of peers. This is peerjs specific.
  # @overload _send(peerid, message)
  #   @param peerid {String} PeerJs connection id of _another_ peer
  #   @param message {Object} Some object that shall be send
  # @overload _send(peerids, message)
  #   @param peerids {Array<String>} PeerJs connection ids of _other_ peers
  #   @param message {Object} Some object that shall be send
  #
  _send: (peer_s, message)->
    if peer_s.constructor is [].constructor
      # Throw errors _after_ the message has been send to all other peers. 
      # Just in case a connection is invalid.
      errors = []
      for peer in peer_s
        try
          @connection[peer].send message
        catch error 
          errors.push(error+"")
      if errors.length > 0
        throw new Error errors 
    else
      @connections[peer_s].send message
    
  #
  # @private
  # This is a helper function that is only related to the peerjs connector. 
  # Connect to another peer.
  _addConnection: (peer)=>
    peer.on 'open', ()=>
      that = @
      peer.send that.sync_process_order[0]()
      current_sync_i = 1
      peer.on 'data', (data)->
        console.log("receive data: #{JSON.stringify data}")
        if current_sync_i < that.sync_process_order.length
          peer.send that.sync_process_order[current_sync_i++].call that, data
        else if current_sync_i is that.sync_process_order.length
          # All sync functions have been called. Increment current_sync_i one last time
          current_sync_i++
          # add it to the connections object
          delete that.unsynced_connections[peer.peer]
          that.connections[peer.peer] = peer
          # when the conn closes, delete it from the connections object
          peer.on 'close', ()->
            delete that.connections[peer.peer]
          # helper fkt. true iff os is an object that does not hold enumerable properties
          isEmpty = (os)->
            for o of os
              return false
            return true
          if isEmpty(that.unsynced_connections)
            # there are no unsynced connections. we are now synced. 
            # therefore execute all fkts in this.compute_when_synced
            that.is_synced = true
            for comp in that.compute_when_synced
              comp[0].apply that, comp[1..]
            that.compute_when_synced = []
        else
          # you received a new message, that is not a sync message.
          # notify the receive_handlers
          for f in that.receive_handlers 
            f peer.peer, data


      