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
Connector = require "../../Yatta-Connectors/lib/test-connector/test-connector.coffee"

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
    test_users = []
    connector = (new Connector 0, test_users)
    @test_user = @yTest.makeNewUser 0, connector
    test_users.push @test_user
    # test_user_listen listens to the actions of test_user. He will update his dom when he receives from test_user.
    @test_user_listen = @yTest.makeNewUser 2, connector
    test_users.push @test_user_listen
    @test_user2 = @yTest.makeNewUser 1, (Connector_uninitialized [])

    $("#test_dom").replaceWith('<div id="test_dom" test_attribute="the test" class="stuffy" style="color: blue"><p id="replaceme">replace me</p><p id="removeme">remove me</p><p>This is a test object for <b>XmlFramework</b></p><span class="span_element"><p>span</p></span></div>')
    @$dom = $("#test_dom")
    @dom = @$dom[0]
    @test_user.val(@dom)
    @test_user_listen.getConnector().flushAll()
    @test_user_listen_dom = @test_user_listen.val()

    @check = ()=>
      dom_ = @dom.outerHTML
      # now test if other collaborators can parse the HB and result in the same content
      hb = @test_user.HB._encode()
      @test_user2.engine.applyOps(hb)
      dom2 = @test_user2.val()
      expect(dom_).to.equal(dom2.outerHTML)
      @test_user_listen.getConnector().flushAll()
      expect(dom_).to.equal(@test_user_listen_dom.outerHTML)
    done()

  it "can transform to a new real Dom element", ->
    dom_ = @test_user.val(true)
    expect(dom_ isnt @dom).to.be.true

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
    $("p").appendTo("#test_dom")
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
    d = $("#test_dom p")
    d.empty()
    @check()

  it "supports jquery.insertAfter", ->
    $("<p>after span</p>").insertAfter(".span_element")
    @check()

  it "supports jquery.insertBefore", ->
    $("<p>before span</p>").insertBefore(".span_element")
    @check()

  it "supports jquery.prepend", ->
    d = $("#test_dom div")
    d.prepend("<p>prepended</p>")
    @check()

  it "supports jquery.prependTo", ->
    $("<p atone=false attwo=\"dtrn\" class=\"attr_node sudo su\">prepended to</p>").prependTo("#test_dom div")
    @check()

  it "supports jquery.remove", ->
    d = $("#test_dom b")
    d.remove()
    @check()

  it "supports jquery.removeAttr", ->
    d = $(".attr_node")
    d.removeAttr("attwo")
    @check()

  it "supports jquery.removeClass", ->
    d = $(".attr_node")
    d.removeClass("sudo")
    @check()

  it "supports jquery.attr", ->
    d = $(".attr_node")
    d.attr("atone", true)
    @check()

  it "supports jquery.replaceAll", ->
    $("<span>New span content </span>").replaceAll("#test_dom div")
    @check()

  it "supports jquery.replaceWith", ->
    d = $("#test_dom span")
    d.replaceWith("<div>me is div again </div>")
    @check()






