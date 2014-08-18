chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Y = require "../lib/index"
Connector_uninitialized = require "../lib/Connectors/TestConnector"

module.exports = class Test
  constructor: (@name_suffix = "")->
    @number_of_test_cases_multiplier = 1
    @repeat_this = 1 * @number_of_test_cases_multiplier
    @doSomething_amount = 200 * @number_of_test_cases_multiplier
    @number_of_engines =  7 + @number_of_test_cases_multiplier - 1

    @time = 0
    @ops = 0
    @time_now = 0

    @debug = false

    @reinitialize()

  reinitialize: ()->
    @users = []
    @Connector = Connector_uninitialized @users
    for i in [0...@number_of_engines]
      @users.push @makeNewUser (i+@name_suffix), @Connector
    @users[0].val('name',"i")
    @flushAll()

  makeNewUser: (user_id, Connector)->
    throw new Error "overwrite me!"

  getSomeUser: ()->
    i = _.random 0, (@users.length-1)
    @users[i]

  getRandomText: (chars, min_length = 0)->
    chars ?= "abcdefghijklmnopqrstuvwxyz"
    length = _.random min_length, 10
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
    types = @users[user_num].types
    [
        f : (y)=> # INSERT TEXT
          y
          pos = _.random 0, (y.val().length-1)
          y.insertText pos, @getRandomText()
          null
        types: [types.Word]
      ,
        f : (y)=> # REPLACE TEXT
          y.replaceText @getRandomText()
          null
        types: [types.Word]
      ,
        f : (y)-> # DELETE TEXT
          if y.val().length > 0
            pos = _.random 0, (y.val().length-1)
            length = _.random 0, (y.val().length - pos)
            ops1 = y.deleteText pos, length
          undefined
        types : [types.Word]
    ]

  getRandomRoot: (user_num)->
    throw new Error "overwrite me!"

  getContent: (user_num)->
    throw new Error "overwrite me!"

  generateRandomOp: (user_num)=>
    y = @getRandomRoot(user_num)
    choices = @getGeneratingFunctions(user_num).filter (gf)->
      _.some gf.types, (type)->
        y instanceof type

    if choices.length is 0
      throw new Error "You forgot to specify a test generation methot for this Operation!"
    i = _.random 0, (choices.length-1)
    choices[i].f y

  applyRandomOp: (user_num)=>
    user = @users[user_num]
    user.getConnector().flushOneRandom()

  doSomething: ()->
    user_num = _.random (@number_of_engines-1)
    choices = [@applyRandomOp, @generateRandomOp]
    choice = _.random (choices.length-1)
    choices[choice](user_num)

  flushAll: ()->
    for user,user_number in @users
      user.getConnector().flushAll()

  compareAll: (test_number)->
    @flushAll()

    @time += (new Date()).getTime() - @time_now

    number_of_created_operations = 0
    for i in [0...(@users.length)]
      number_of_created_operations += @users[i].getConnector().getOpsInExecutionOrder().length
    @ops += number_of_created_operations*@users.length

    ops_per_msek = Math.floor(@ops/@time)
    if test_number? and @debug
      console.log "#{test_number}/#{@repeat_this}: Every collaborator (#{@users.length}) applied #{number_of_created_operations} ops in a different order." + " Over all we consumed #{@ops} operations in #{@time/1000} seconds (#{ops_per_msek} ops/msek)."

    for i in [0...(@users.length-1)]
      if @debug
        if not _.isEqual @getContent(i), @getContent(i+1)
          printOpsInExecutionOrder = (otnumber, otherotnumber)=>
            ops = _.filter @users[otnumber].getConnector().getOpsInExecutionOrder(), (o)->
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
      expect(@getContent(i)).to.deep.equal(@getContent(i+1))

  run: ()->
    if @debug
      console.log ''
    for times in [1..@repeat_this]
      @time_now = (new Date).getTime()
      for i in [1..@doSomething_amount]
        @doSomething()

      @compareAll(times)
      @testHBencoding()
      if times isnt @repeat_this
        @reinitialize()

  testHBencoding: ()->
    @users[@users.length] = @makeNewUser 'testuser', (Connector_uninitialized [])
    @users[@users.length-1].engine.applyOps @users[0].HB._encode()

    expect(@getContent(@users.length-1)).to.deep.equal(@getContent(0))

