chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")
$         = require("jquery")
document?.$ = $ # for browser
require 'coffee-errors'

chai.use(sinonChai)

Y = require "../lib/index"
Connector_uninitialized = require "../lib/Connectors/TestConnector"

Test = require "./TestSuite"
class XmlTest extends Test

  type: "XmlTest"

  makeNewUser: (user, conn)->
    super new Y.XmlFramework user, conn

  getRandomRoot: (user_num)->
    @users[user_num].getSharedObject()

  getContent: (user_num)->
    @users[user_num].val()


describe "XmlFramework", ->
  beforeEach (done)->
    @timeout 50000
    @yTest = new XmlTest()
    ###

    @users = @yTest.users
    ###
    @test_user = @yTest.makeNewUser 0, (Connector_uninitialized [])
    done()

  it "can transform to a real Dom element", ->
    dom = $("#test_dom")[0]
    @test_user.val(dom)
    dom_ = @test_user.val(true)
    expect(dom_ isnt dom).to.be.true
    expect(dom_.outerHTML).to.equal(dom.outerHTML)
    console.log "dtrn"

