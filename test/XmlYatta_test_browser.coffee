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
    @$dom = $("#test_dom")
    @dom = @$dom[0]
    @test_user.val(@dom)

    @check = ()=>
      dom_ = @test_user.val(true)
      expect(dom_.outerHTML).to.equal(@dom.outerHTML)
    done()

  it "can transform to a new real Dom element", ->
    dom_ = @test_user.val(true)
    expect(dom_ isnt @dom).to.be.true
    @check()

  it "supports dom.insertBefore", ->
    newdom = $("<p>dtrn</p>")[0]
    newdom2 = $("<p>dtrn2</p>")[0]
    n = $("#removeme")[0]
    @dom.insertBefore(newdom, null)
    @dom.insertBefore(newdom2, n)
    @check()

  it "supports dom.appendChild", ->
    newdom = $("<p>dtrn</p>")[0]
    @dom.appendChild(newdom)
    @check()

  it "supports dom.setAttribute", ->
    @dom.setAttribute("test_attribute", "newVal")
    @check()

  it "supports dom.removeAttribute", ->
    @dom.removeAttribute("test_attribute")
    @check()

  it "supports dom.removeChild", ->
    @dom.removeChild($("#removeme")[0])
    expect($("#removeme").length).to.equal(0)
    @check()

  it "supports dom.replaceChild", ->
    newdom = $("<p>replaced</p>")[0]
    replace = $("#replaceme")[0]
    @dom.replaceChild(newdom,replace)
    expect($("#replaceme").length).to.equal(0)
    @check()

  it "supports dom.classList.add", ->
    @dom.classList.add "classy"
    @check()


  it "supports dom.textcontent", -> #TODO!!!!
    @dom.classList.add "classy"
    @check()



  it "supports jquery.addClass", ->
    @$dom.addClass("testy")
    @check()

  it "supports jquery.after", ->
    d = $("#test_dom p")
    d.after("<div class=\"inserted_after\">after</div>")
    @check()

  it "supports jquery.append", ->
    d = $("#test_dom p")
    d.after("<b>appended</b>")
    @check()

  it "supports jquery.appendTo", ->
    $("<b>appendedTo</b>").appendTo("#test_dom p")
    @check()

  it "supports jquery.before", ->
    d = $("#test_dom p")
    d.before("<div>before</div>")
    @check()

  it "supports jquery.detach", ->
    d = $(".inserted_after")
    d.detach()
    @check()

  it "supports jquery.empty", ->
    d = $("p") 
    d.empty()
    @check()

  it "supports jquery.insertAfter", ->
    $("<p>after span</p>").insertAfter(".span_element")
    @check()

  it "supports jquery.insertBefore", ->
    $("<p>before span</p>").insertBefore(".span_element")
    @check()

  it "supports jquery.insertBefore", ->
    d = $("p")
    d.empty()
    @check()




