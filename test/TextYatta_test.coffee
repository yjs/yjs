chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Y = require "../lib/index"
Connector_uninitialized = require "../lib/Connectors/TestConnector"

Test = require "./TestSuite"
class TextTest extends Test

  type: "TextTest"

  makeNewUser: (user, conn)->
    super new Y.TextFramework user, conn

  getRandomRoot: (user_num)->
    @users[user_num].getSharedObject()

  getContent: (user_num)->
    @users[user_num].val()

describe "TextFramework", ->
  beforeEach (done)->
    @timeout 50000
    @yTest = new TextTest()
    @users = @yTest.users

    @test_user = @yTest.makeNewUser 0, (Connector_uninitialized [])
    done()

  it "simple multi-char insert", ->
    u = @yTest.getSomeUser()
    u.insertText 0, "abc"
    @yTest.compareAll()
    expect(u.val()).to.equal("abc")
  
  number_of_concurrent_operations = 100000
  it "concurrent against #{number_of_concurrent_operations}", ->
    a = @yTest.users[0]
    b = @yTest.users[1]
    str = ""
    for i in [0...number_of_concurrent_operations]
      str += "a"
    
    countTime = (name, task)->
      start = (new Date()).getTime()
      task()
      console.log "Time needed to complete task '#{name}': #{(new Date().getTime())-start}"
    
    countTime "insert #{number_of_concurrent_operations} characters", ()->
      a.insertText 0, str
    
    b.insertText 0, "b"
    b_hb = b.HB._encode()
    b.engine.applyOps a.HB._encode()  
    countTime "transform one operation against #{number_of_concurrent_operations} operations", ()->
      a.engine.applyOps b_hb
    
    console.log a.val()
    expect(a.val()).to.equal(b.val())

  it "can handle many engines, many operations, concurrently (random)", ->
    @yTest.run()



