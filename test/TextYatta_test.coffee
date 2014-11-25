chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Y = require "../lib/index"
Connector = require "../bower_components/connector/lib/test-connector/test-connector.coffee"

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
    test_user_connector = new Connector 'test_user'
    @test_user = @yTest.makeNewUser 'test_user', test_user_connector
    test_user_connector.join @users[0].connector
    done()
    
  it "simple multi-char insert", ->
    u = @yTest.users[0]
    u.insertText 0, "abc"
    u = @yTest.users[1]
    u.insertText 0, "xyz"
    @yTest.compareAll()
    expect(u.val()).to.equal("abcxyz")

  it "can handle many engines, many operations, concurrently (random)", ->
    @yTest.run()


