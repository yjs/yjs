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
  constructor: ()->
    @number_of_test_cases_multiplier = 1
    @repeat_this = 10 * @number_of_test_cases_multiplier
    @doSomething_amount = 200 * @number_of_test_cases_multiplier
    @number_of_engines =  12 + @number_of_test_cases_multiplier - 1

    @time = 0
    @ops = 0
    @time_now = 0

    @reinitialize()

  reinitialize: ()->

    @users = []
    @Connector = Connector_uninitialized @users
    @users.push(new Yatta 0, @Connector)
    @users[0].val('name',"initial")
    for i in [1...@number_of_engines]
      @users.push(new Yatta i, @Connector)

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
      length = 1 # _.random 0, ot.val('name').length - pos TODO:!!!
      ops1 = @users[user_num].val('name').deleteText pos, length
    undefined

  generateRandomOp: (user_num)=>
    op_gen = [@generateDeleteOp, @generateInsertOp, @generateReplaceOp]
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
      console.log "#{test_number}/#{@repeat_this}: Every collaborator (#{@users.length}) applied #{@number_of_created_operations} ops in a different order." + " Over all we consumed #{@ops} operations in #{@time/1000} seconds (#{ops_per_msek} ops/msek)."

    #console.log users[0].val('name').val()
    for i in [0...(@users.length-1)]
      if ((@users[i].val('name').val() isnt @users[i+1].val('name').val()) )# and (number_of_created_operations <= 6 or true)) or found_error

        printOpsInExecutionOrder = (otnumber, otherotnumber)->
          ops = @users[otnumber].getConnector().getOpsInExecutionOrder()
          for s in ops
            console.log JSON.stringify s
          console.log ""
          s = "ops = ["
          for o,j in ops
            if j isnt 0
              s += ", "
            s += "op#{j}"
          s += "]"
          console.log s
          console.log "@users[@last_user].ot.applyOps ops"
          console.log "expect(@users[@last_user].ot.val('name')).to.equal(\"#{users[otherotnumber].val('name')}\")"
          ops
        console.log ""
        console.log "Found an OT Puzzle!"
        console.log "OT states:"
        for u,j in users
          console.log "OT#{j}: "+u.val('name')
        console.log "\nOT execution order (#{i},#{i+1}):"
        printOpsInExecutionOrder i, i+1
        console.log ""
        ops = printOpsInExecutionOrder i+1, i

        console.log ""

  run: ()->
    console.log ''
    for times in [1..@repeat_this]
      @time_now = (new Date).getTime()
      for i in [1..@doSomething_amount]
        @doSomething()

      @compareAll(times)
      @reinitialize()

describe "JsonYatta", ->
  beforeEach (done)->
    @yTest = new Test()
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

  it "can handle creaton of complex json", ->
    @yTest.getSomeUser().val('x', {'a':'b'})
    @yTest.getSomeUser().val('a', {'a':{q:"dtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt"}})
    @yTest.getSomeUser().val('b', {'a':{}})
    @yTest.getSomeUser().val('c', {'a':'b'})
    @yTest.compareAll()

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




