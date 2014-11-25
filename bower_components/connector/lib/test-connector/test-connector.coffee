
_ = require "underscore"
Connector = require '../connector'

#
# A trivial Connector that simulates network delay.
#
class TestConnector extends Connector

  #
  # @param id {String} Some unique id
  # @param user_connectors {Array<TestConnector>} List of TestConnectors instances
  #
  constructor: (@id)->
    super()
    # If you think of operations, this will mirror the 
    # execiton order of operations (when a message is send, or received it is put into this)
    @execution_order = []
    # The messages are buffered under the name of teh sending user.
    @receive_buffer = {}
    @connections = {}

    @whenReceiving (user, message)=>
      @execution_order.push message
    @is_synced = true
    
  # join another user connector
  join: (conn)->
    @_addConnection conn.id, conn
    for cid,c of conn.connections
      @_addConnection cid, c
    for comp in @compute_when_synced
      comp[0].apply @, comp[1..]
    
  
  #
  # @private
  # This is a helper function that is only related to the peerjs connector. 
  # Connect to another peer.
  _addConnection: (id, user_connector)->
    if not @connections[id]? and id isnt @id
      data = null
      user_data = null
      for i in [0...@sync_process_order.length]
        data_ = @sync_process_order[i].call @, user_data
        user_data = user_connector.sync_process_order[i].call user_connector, data
        data = data_
      @connections[id]=user_connector
      user_connector.connections[@id] = @
      
  #
  # Get the ops in the execution order.
  #
  getOpsInExecutionOrder: ()->
    @execution_order
    
  #
  # Send a message to another peer
  # @param {Operation} o The operation that was executed.
  #
  _send: (uid, message)->
    rb = @connections[uid].receive_buffer
    rb[@id] ?= []
    rb[@id].push message

  #
  # Flush one operation from the line of a specific user.
  #
  flushOne: (uid)->
    if @receive_buffer[uid]?.length > 0
      message = @receive_buffer[uid].shift()
      for f in @receive_handlers
        f uid, message
        
  #
  # Flush one operation on a random line.
  #
  flushOneRandom: ()->
    connlist = for cid,c of @receive_buffer
      cid
    @flushOne connlist[(_.random 0, (connlist.length-1))]

  #
  # Flush all operations on every line.
  #
  flushAll: ()->
    for n,messages of @receive_buffer
      for message in messages
        for f in @receive_handlers
          f n, message
    @receive_buffer = {}


if window?
  window.TestConnector = TestConnector

if module?
  module.exports = TestConnector
