
_ = require "underscore"

module.exports = (user_list)->
  class TestConnector
    constructor: (@engine, @HB, @execution_listener)->
      send_ = (o)=>
        @send o
      @execution_listener.push send_

      @applied_operations = []
      appliedOperationsListener = (o)=>
        @applied_operations.push o
      @execution_listener.push appliedOperationsListener
      if not (user_list?.length is 0)
        @engine.applyOps user_list[0].getHistoryBuffer().toJson()

      @unexecuted = {}

    getOpsInExecutionOrder: ()->
      @applied_operations

    getRootElement: ()->
      if user_list.length > 0
        user_list[0].getRootElement().getUid()

    send: (o)->
      if (o.uid.creator is @HB.getUserId()) and (typeof o.uid.op_number isnt "string")
        for user in user_list
          if user.getUserId() isnt @HB.getUserId()
            user.getConnector().receive(o)

    receive: (o)->
      @unexecuted[o.creator] ?= []
      @unexecuted[o.creator].push o

    flushOne: (user)->
      if @unexecuted[user]?.length > 0
        @engine.applyOp @unexecuted[user].shift()

    flushOneRandom: ()->
      @flushOne (_.random 0, (user_list.length-1))

    flushAll: ()->
      for n,ops of @unexecuted
        @engine.applyOps ops
      @unexecuted = {}
    sync: ()->
      throw new Error "Can't use this a.t.m."
