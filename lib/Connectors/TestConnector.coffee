
_ = require "underscore"

module.exports = (user_list)->

  #
  # @nodoc
  # A trivial Connector that simulates network delay.
  #
  class TestConnector

    #
    # @param {Engine} engine The transformation engine
    # @param {HistoryBuffer} HB
    # @param {Array<Function>} execution_listener You must ensure that whenever an operation is executed, every function in this Array is called.
    # @param {Yatta} yatta The Yatta framework.
    #
    constructor: (@engine, @HB, @execution_listener)->
      send_ = (o)=>
        @send o
      @execution_listener.push send_

      @applied_operations = []
      appliedOperationsListener = (o)=>
        @applied_operations.push o
      @execution_listener.push appliedOperationsListener
      if not (user_list?.length is 0)
        @engine.applyOps user_list[0].getHistoryBuffer()._encode()

      @unexecuted = {}

    #
    # This engine applied operations in a specific order.
    # Get the ops in the right order.
    #
    getOpsInExecutionOrder: ()->
      @applied_operations

    #
    # This function is called whenever an operation was executed.
    # @param {Operation} o The operation that was executed.
    #
    send: (o)->
      if (o.uid.creator is @HB.getUserId()) and (typeof o.uid.op_number isnt "string")
        for user in user_list
          if user.getUserId() isnt @HB.getUserId()
            user.getConnector().receive(o)

    #
    # This function is called whenever an operation was received from another peer.
    # @param {Operation} o The operation that was received.
    #
    receive: (o)->
      @unexecuted[o.uid.creator] ?= []
      @unexecuted[o.uid.creator].push o

    #
    # Flush one operation from the line of a specific user.
    #
    flushOne: (user)->
      if @unexecuted[user]?.length > 0
        @engine.applyOp @unexecuted[user].shift()

    #
    # Flush one operation on a random line.
    #
    flushOneRandom: ()->
      @flushOne (_.random 0, (user_list.length-1))

    #
    # Flush all operations on every line.
    #
    flushAll: ()->
      for n,ops of @unexecuted
        @engine.applyOps ops
      @unexecuted = {}

