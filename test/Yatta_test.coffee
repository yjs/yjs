chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_ = require "underscore"

chai.use(sinonChai)

Yatta = require "../lib/Frameworks/JsonYatta.coffee"
Connector_uninitialized = require "../lib/Connectors/TestConnector.coffee"

class Test
  constructor: (@name_suffix = "")->
    @number_of_test_cases_multiplier = 1
    @repeat_this = 5 * @number_of_test_cases_multiplier
    @doSomething_amount = 1000 * @number_of_test_cases_multiplier
    @number_of_engines =  10 + @number_of_test_cases_multiplier - 1

    @time = 0
    @ops = 0
    @time_now = 0

    @debug = true

    @reinitialize()

  reinitialize: ()->

    @users = []
    @Connector = Connector_uninitialized @users
    for i in [0...@number_of_engines]
      @users.push(new Yatta (i+@name_suffix), @Connector)
    @users[0].val('name',"i")
    @flushAll()

  getSomeUser: ()->
    i = _.random 0, (@users.length-1)
    @users[i]

  getRandomText: ()->
    chars = "abcdefghijklmnopqrstuvwxyz"
    length = _.random 0, 10
    nextchar = chars[(_.random 0, (chars.length-1))]
    text = ""
    _(length).times ()-> text += nextchar
    text

  generateInsertOp: (user_num)=>
    pos = _.random 0, (@users[user_num].val('name').val().length-1)
    @users[user_num].val('name').insertText pos, @getRandomText()
    null

  generateReplaceOp: (user_num)=>
    @users[user_num].val('name').replaceText @getRandomText()
    null

  generateDeleteOp: (user_num)=>
    if @users[user_num].val('name').val().length > 0
      pos = _.random 0, (@users[user_num].val('name').val().length-1) # TODO!!!!
      length = _.random 0, (@users[user_num].val('name').val().length - pos)
      ops1 = @users[user_num].val('name').deleteText pos, length
    undefined

  generateRandomOp: (user_num)=>
    op_gen = [@generateInsertOp, @generateDeleteOp, @generateReplaceOp]
    i = _.random (op_gen.length - 1)
    op = op_gen[i](user_num)

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
    if test_number?
      console.log "#{test_number}/#{@repeat_this}: Every collaborator (#{@users.length}) applied #{number_of_created_operations} ops in a different order." + " Over all we consumed #{@ops} operations in #{@time/1000} seconds (#{ops_per_msek} ops/msek)."
    #console.log users[0].val('name').val()
    for i in [0...(@users.length-1)]
      if @debug
        if ((@users[i].val('name').val() isnt @users[i+1].val('name').val()) )# and (number_of_created_operations <= 6 or true)) or found_error
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
      if (@users[i].val('name').val() isnt @users[i+1].val('name').val())
        console.log "found error"
      expect(@users[i].val('name').val()).to.equal(@users[i+1].val('name').val())

  run: ()->
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
    user = new Yatta 'testuser', (Connector_uninitialized [])
    user.engine.applyOps @users[0].HB._encode()
    expect(user.value.name.val()).to.equal(@users[0].value.name.val())

describe "JsonYatta", ->
  beforeEach (done)->
    @timeout 50000
    @yTest = new Test()
    @users = @yTest.users

    @test_user = new Yatta 0, (Connector_uninitialized [])
    done()

  it "has a JsonWrapper", ->
    y = this.yTest.getSomeUser().root_element
    y.val('x',"dtrn", 'immutable')
    y.val('set',{x:"x"}, 'immutable')
    w = y.value
    w.x
    w.set = {y:""}
    w.x
    w.set
    w.set.x
    expect(w.x).to.equal("dtrn")
    expect(w.set.x).to.equal("x")

  it "handles double-late-join", ->
    test = new Test("doubble")
    test.run()
    @yTest.run()
    u1 = test.users[0]
    u2 = @yTest.users[1]
    ops1 = u1.HB._encode()
    ops2 = u2.HB._encode()
    u1.engine.applyOps ops2
    u2.engine.applyOps ops1
    expect(u2.value.name.val()).to.equal(u2.value.name.val())



  it "can handle creaton of complex json", ->
    @yTest.getSomeUser().val('x', {'a':'b'})
    @yTest.getSomeUser().val('a', {'a':{q:"dtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt"}})
    @yTest.getSomeUser().val('b', {'a':{}})
    @yTest.getSomeUser().val('c', {'a':'c'})
    @yTest.getSomeUser().val('c', {'a':'b'})
    @yTest.compareAll()
    @yTest.getSomeUser().value.a.a.q.insertText(0,'AAA')
    @yTest.compareAll()
    expect(@yTest.getSomeUser().value.a.a.q.val()).to.equal("AAAdtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt")


  it "handles some immutable tests", ->
    @yTest.getSomeUser().val('string', "text", "immutable")
    @yTest.getSomeUser().val('number', 4, "immutable")
    @yTest.getSomeUser().val('object', {q:"rr"}, "immutable")
    @yTest.compareAll()
    expect(@yTest.getSomeUser().val('string')).to.equal "text"
    expect(@yTest.getSomeUser().val('number')).to.equal 4
    expect(@yTest.getSomeUser().val('object').val('q')).to.equal "rr"

  it "can handle many engines, many operations, concurrently (random)", ->
    @yTest.run()

  it "converges t1", ->
    op0 = {"type":"Delimiter","uid":{"creator":0,"op_number":0},"next":{"creator":0,"op_number":1}}
    op1 = {"type":"Delimiter","uid":{"creator":0,"op_number":1},"prev":{"creator":0,"op_number":0}}
    op2 = {"type":"Word","uid":{"creator":0,"op_number":2},"beginning":{"creator":0,"op_number":0},"end":{"creator":0,"op_number":1}}
    op3 = {"type":"AddName","uid":{"creator":0,"op_number":3},"map_manager":{"creator":"_","op_number":"_"},"name":"name"}
    op4 = {"type":"Replaceable","content":{"creator":0,"op_number":2},"ReplaceManager":{"creator":"_","op_number":"___RM_name"},"prev":{"creator":"_","op_number":"___RM_name_beginning"},"next":{"creator":"_","op_number":"___RM_name_end"},"uid":{"creator":0,"op_number":4}}
    op5 = {"type":"TextInsert","content":"u","uid":{"creator":1,"op_number":2},"prev":{"creator":1,"op_number":0},"next":{"creator":1,"op_number":1}}
    op6 = {"type":"TextInsert","content":"w","uid":{"creator":2,"op_number":0},"prev":{"creator":0,"op_number":0},"next":{"creator":0,"op_number":1}}
    op7 = {"type":"TextInsert","content":"d","uid":{"creator":1,"op_number":0},"prev":{"creator":0,"op_number":0},"next":{"creator":2,"op_number":0}}
    op8 = {"type":"TextInsert","content":"a","uid":{"creator":1,"op_number":1},"prev":{"creator":1,"op_number":0},"next":{"creator":2,"op_number":0}}

    ops = [op0, op1, op2, op3, op4, op5, op6, op7, op8]
    @test_user.engine.applyOps ops
    expect(@test_user.val('name').val()).to.equal("duaw")

