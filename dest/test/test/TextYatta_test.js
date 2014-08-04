(function() {
  var Connector_uninitialized, Yatta, chai, expect, should, sinon, sinonChai, _;

  chai = require('chai');

  expect = chai.expect;

  should = chai.should();

  sinon = require('sinon');

  sinonChai = require('sinon-chai');

  _ = require("underscore");

  chai.use(sinonChai);

  Yatta = require("../lib/Frameworks/TextYatta.coffee");

  Connector_uninitialized = require("../lib/Connectors/TestConnector.coffee");


  /*
  describe "TextYatta", ->
    beforeEach (done)->
      @last_user = 10
      @users = []
      @Connector = Connector_uninitialized @users
      for i in [0..(@last_user+1)]
        @users.push(new Yatta i, @Connector)
      done()
  
    it "handles inserts correctly", ->
  
  
    it "can handle many engines, many operations, concurrently (random)", ->
      number_of_test_cases_multiplier = 1
      repeat_this = 1 * number_of_test_cases_multiplier
      doSomething_amount = 500 * number_of_test_cases_multiplier
      number_of_engines =  12 + number_of_test_cases_multiplier - 1
       *maximum_ops_per_engine = 20 * number_of_test_cases_multiplier
  
      @time = 0
      @ops = 0
      users = []
  
      generateInsertOp = (user_num)->
            chars = "1234567890"
  
            pos = _.random 0, (users[user_num].val().length-1)
            length = 1 #_.random 0, 10
  
            nextchar = chars[(_.random 0, (chars.length-1))]
  
            text = ""
            _(length).times ()-> text += nextchar
  
            users[user_num].insertText pos, text
            null
  
      generateReplaceOp = (user_num)->
            chars = "abcdefghijklmnopqrstuvwxyz"
            length = _.random 0, 10
  
            nextchar = chars[(_.random 0, (chars.length-1))]
  
            text = ""
            _(length).times ()-> text += nextchar
            users[user_num].replaceText text
  
      generateDeleteOp = (user_num)->
          if users[user_num].val().length > 0
            pos = _.random 0, (users[user_num].val().length-1)
            length = 1 # _.random 0, ot.val().length - pos
            ops1 = users[user_num].deleteText pos, length
          undefined
  
      generateRandomOp = (user_num)->
        op_gen = [generateDeleteOp, generateInsertOp, generateReplaceOp]
        i = _.random (op_gen.length - 1)
        op = op_gen[i](user_num)
  
      applyRandomOp = (user_num)->
        user = users[user_num]
        user.getConnector().flushOneRandom()
  
      doSomething = do ()->
        ()->
          user_num = _.random (number_of_engines-1)
          choices = [applyRandomOp, generateRandomOp]
           *if (users[user_num].buffer[user_num].length < maximum_ops_per_engine)
           *  choices = choices.concat generateRandomOp
  
          choice = _.random (choices.length-1)
  
          choices[choice](user_num)
  
      console.log ""
      for times in [1..repeat_this]
         *console.log "repeated_this x #{times} times"
        users = []
        Connector = Connector_uninitialized users
        for i in [0..number_of_engines]
          users.push(new Yatta i, Connector)
  
        found_error = false
  
         *try
        time_now = (new Date).getTime()
        for i in [1..doSomething_amount]
          doSomething()
  
        for user,user_number in users
          user.getConnector().flushAll()
  
        @time += (new Date()).getTime() - time_now
  
        number_of_created_operations = 0
        for i in [0...(users.length)]
          number_of_created_operations += users[i].getConnector().getOpsInExecutionOrder().length
        @ops += number_of_created_operations*users.length
  
        ops_per_msek = Math.floor(@ops/@time)
        console.log "#{times}/#{repeat_this}: Every collaborator (#{users.length}) applied #{number_of_created_operations} ops in a different order." + " Over all we consumed #{@ops} operations in #{@time/1000} seconds (#{ops_per_msek} ops/msek)."
  
        console.log users[0].val()
        found_inconsistency = false
        for i in [0...(users.length-1)]
          if ((users[i].val() isnt users[i+1].val()) )# and (number_of_created_operations <= 6 or true)) or found_error
            found_inconsistency =true
            printOpsInExecutionOrder = (otnumber, otherotnumber)->
              ops = users[otnumber].getConnector().getOpsInExecutionOrder()
              for s,j in ops
                console.log "op#{j} = #{JSON.stringify s}"
              console.log ""
              s = "ops = ["
              for o,j in ops
                if j isnt 0
                  s += ", "
                s += "op#{j}"
              s += "]"
              console.log s
              console.log "@users[@last_user].ot.applyOps ops"
              console.log "expect(@users[@last_user].val()).to.equal(\"#{users[otherotnumber].val()}\")"
              ops
            console.log ""
            console.log "Found an OT Puzzle!"
            console.log "OT states:"
            for u,j in users
              console.log "OT#{j}: "+u.val()
            console.log "\nOT execution order (#{i},#{i+1}):"
            printOpsInExecutionOrder i, i+1
            console.log ""
            ops = printOpsInExecutionOrder i+1, i
  
            console.log ""
        if found_inconsistency
          throw new Error "dtrn"
  
             * expect(users[i].ot.val()).to.equal(users[i+1].ot.val())
   */

}).call(this);
