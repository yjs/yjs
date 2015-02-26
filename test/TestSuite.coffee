chai      = require('chai')
expect    = chai.expect
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Connector = require "../../y-test/lib/y-test.coffee"
Y = null

module.exports = class Test
  constructor: (@name_suffix = "", Yjs)->
    Y = Yjs
    @number_of_test_cases_multiplier = 1
    @repeat_this = 1 * @number_of_test_cases_multiplier
    @doSomething_amount = 123 * @number_of_test_cases_multiplier
    @number_of_engines = 5 + @number_of_test_cases_multiplier - 1

    @time = 0 # denotes to the time when run was started
    @ops = 0 # number of operations (used with @time)
    @time_now = 0 # current time
    @max_depth = 10

    @debug = false

    @reinitialize()
    for gf in @getGeneratingFunctions(0)
      if not (gf.types? and gf.f?)
        throw new Error "Generating Functions are not initialized properly!"
      for t in gf.types
        if not t?
          throw new Error "You havent includedt this type in Y (do require 'y-whatever')"

  reinitialize: ()->
    @users = []
    for i in [0...@number_of_engines]
      u = @makeNewUser (i+@name_suffix)
      for user in @users
        u._model.connector.join(user._model.connector) # TODO: change the test-connector to make this more convenient
      @users.push u
    @initUsers?(@users[0])
    @flushAll()

  # is called by implementing class
  makeNewUser: (user)->
    user._model.HB.stopGarbageCollection()
    user

  getSomeUser: ()->
    i = _.random 0, (@users.length-1)
    @users[i]

  getRandomText: (chars, min_length = 0)->
    chars ?= "abcdefghijklmnopqrstuvwxyz"
    length = _.random min_length, 10
    #length = 1
    nextchar = chars[(_.random 0, (chars.length-1))]
    text = ""
    _(length).times ()-> text += nextchar
    text

  getRandomObject: ()->
    result = {}
    key1 = @getRandomKey()
    key2 = @getRandomKey()
    val1 = @getRandomText()
    val2 = null
    if _.random(0,1) is 1
      val2 = @getRandomObject()
    else
      val2 = @getRandomText()
    result[key1] = val1
    result[key2] = val2
    result

  getRandomKey: ()->
    @getRandomText [1,2,'x','y'], 1 # only 4 keys

  getGeneratingFunctions: (user_num)=>
    types = @users[user_num]._model.operations
    [
        f : (y)=> # INSERT TEXT
          y
          pos = _.random 0, (y.val().length-1)
          y.insert pos, @getRandomText()
          null
        types: [Y.Text]
      ,
        f : (y)-> # DELETE TEXT
          if y.val().length > 0
            pos = _.random 0, (y.val().length-1) # TODO: put here also arbitrary number (test behaviour in error cases)
            length = _.random 0, (y.val().length - pos)
            ops1 = y.delete pos, length
          undefined
        types : [Y.Text]
    ]
  getRandomRoot: (user_num)->
    throw new Error "implement me!"

  compare: (o1, o2, depth = (@max_depth+1))->
    if o1 is o2 or depth <= 0
      true
    else if o1._name? and o1._name isnt o2._name
      throw new Error "different types"
    else if o1._name is "Object" or o1.type is "MapManager"
      for name, val of o1.val()
        @compare(val, o2.val(name), depth-1)
    else if o1._name?
      @compare(o1.val(), o2.val(), depth-1)
    else if o1.constructor is Array and o2.constructor is Array
      if o1.length isnt o2.length
        throw new Error "The Arrays do not have the same size!"
      for o,i in o1
        @compare o, o2[i], (depth-1)
    else if o1 isnt o2
      throw new Error "different values"
    else
      throw new Error "I don't know what to do .. "

  generateRandomOp: (user_num)=>
    y = @getRandomRoot(user_num)
    choices = @getGeneratingFunctions(user_num).filter (gf)->
      _.some gf.types, (type)->
        y instanceof type

    if choices.length is 0
      console.dir(y)
      throw new Error "You forgot to specify a test generation methot for this Operation! (#{y.type})"
    i = _.random 0, (choices.length-1)
    choices[i].f y

  applyRandomOp: (user_num)=>
    user = @users[user_num]
    user._model.connector.flushOneRandom()

  doSomething: ()->
    user_num = _.random (@number_of_engines-1)
    choices = [@applyRandomOp, @generateRandomOp]
    choice = _.random (choices.length-1)
    choices[choice](user_num)

  flushAll: (final)->
    # TODO:!!
    final = false
    if @users.length <= 1 or not final
      for user,user_number in @users
        user._model.connector.flushAll()
    else
      for user,user_number in @users[1..]
        user._model.connector.flushAll()
      ops = @users[1].getHistoryBuffer()._encode @users[0].HB.getOperationCounter()
      @users[0].engine.applyOpsCheckDouble ops


  compareAll: (test_number)->
    @flushAll(true)

    @time += (new Date()).getTime() - @time_now

    number_of_created_operations = 0
    for i in [0...(@users.length)]
      number_of_created_operations += @users[i]._model.connector.getOpsInExecutionOrder().length
    @ops += number_of_created_operations*@users.length

    ops_per_msek = Math.floor(@ops/@time)
    if test_number? # and @debug
      console.log "#{test_number}/#{@repeat_this}: #{number_of_created_operations} were created and applied on (#{@users.length}) users ops in a different order." + " Over all we consumed #{@ops} operations in #{@time/1000} seconds (#{ops_per_msek} ops/msek)."

    for i in [0...(@users.length-1)]
      if @debug
        if not _.isEqual @getContent(i), @getContent(i+1)
          printOpsInExecutionOrder = (otnumber, otherotnumber)=>
            ops = _.filter @users[otnumber]._model.connector.getOpsInExecutionOrder(), (o)->
              typeof o.uid.op_name isnt 'string' and o.uid.creator isnt '_'
            for s,j in ops
              console.log "op#{j} = " + (JSON.stringify s)
            console.log ""
            s = "ops = ["
            for o,j in ops
              if j isnt 0
                s += ", "
              s += "op#{j}"
            s += "]"
            console.log s
            console.log "@test_user.engine.applyOps ops"
            console.log "expect(@test_user.val('name').val()).to.equal(\"#{@users[otherotnumber].val('name').val()}\")"
            ops
          console.log ""
          console.log "Found an OT Puzzle!"
          console.log "OT states:"
          for u,j in @users
            console.log "OT#{j}: "+u.val('name').val()
          console.log "\nOT execution order (#{i},#{i+1}):"
          printOpsInExecutionOrder i, i+1
          console.log ""
          ops = printOpsInExecutionOrder i+1, i

          console.log ""
      expect(@compare(@users[i], @users[i+1])).to.not.be.undefined

  run: ()->
    if @debug
      console.log ''
    for times in [1..@repeat_this]
      @time_now = (new Date).getTime()
      for i in [1..Math.floor(@doSomething_amount/2)]
        @doSomething()
      @flushAll(false)
      for u in @users
        u._model.HB.emptyGarbage()
      for i in [1..Math.floor(@doSomething_amount/2)]
        @doSomething()

      @compareAll(times)
      @testHBencoding()
      if times isnt @repeat_this
        @reinitialize()

  testHBencoding: ()->
    # in case of JsonFramework, every user will create its JSON first! therefore, the testusers id must be small than all the others (see InsertType)
    @users[@users.length] = @makeNewUser (-1) # this does not want to join with anymody

    @users[@users.length-1]._model.HB.renewStateVector @users[0]._model.HB.getOperationCounter()
    @users[@users.length-1]._model.engine.applyOps @users[0]._model.HB._encode()

    #if @getContent(@users.length-1) isnt @getContent(0)
    #  console.log "testHBencoding:"
    #  console.log "Unprocessed ops first: #{@users[0].engine.unprocessed_ops.length}"
    #  console.log "Unprocessed ops last: #{@users[@users.length-1].engine.unprocessed_ops.length}"
    expect(@compare(@users[@users.length-1], @users[0])).to.not.be.undefined
