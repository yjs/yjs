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
  makeNewUser: (user, conn)->
    new Y.TextYatta user, conn

  getRandomRoot: (user_num)->
    @users[user_num].getSharedObject()

  getContent: (user_num)->
    @users[user_num].val()


describe "TextYatta", ->
  beforeEach (done)->
    @timeout 50000
    @yTest = new TextTest()
    @users = @yTest.users

    @test_user = @yTest.makeNewUser 0, (Connector_uninitialized [])
    done()

  it "can handle many engines, many operations, concurrently (random)", ->
    @yTest.run()
