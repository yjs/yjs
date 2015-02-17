chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Y = require "../lib/y"
Connector = require "../../y-test/lib/y-test.coffee"

Test = require "./TestSuite"
class TextTest extends Test

  type: "TextTest"

  makeNewUser: (userId)->
    conn = new Connector userId
    new Y conn

  initUsers: (u)->
    u.val("TextTest","","mutable")

  getRandomRoot: (user_num)->
    @users[user_num].val("TextTest")

  getContent: (user_num)->
    @users[user_num].val("TextTest").val()

describe "TextFramework", ->
  @timeout 50000

  beforeEach (done)->
    @timeout 50000
    @yTest = new TextTest()
    done()

  it "simple multi-char insert", ->
    u = @yTest.users[0].val("TextTest")
    u.insert 0, "abc"
    u = @yTest.users[1].val("TextTest")
    u.insert 0, "xyz"
    @yTest.compareAll()
    u.delete 0, 1
    @yTest.compareAll()
    expect(u.val()).to.equal("bcxyz")

  it "Observers work on shared Text (insert type observers, local and foreign)", ->
    u = @yTest.users[0].val("TextTest","my awesome Text","mutable").val("TextTest")
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("insert")
      expect(change.object).to.equal(u)
      expect(change.value).to.equal("a")
      expect(change.position).to.equal(1)
      expect(change.changedBy).to.equal('0')
      last_task = "observer1"
    u.observe observer1
    u.insert 1, "a"
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("insert")
      expect(change.object).to.equal(u)
      expect(change.value).to.equal("x")
      expect(change.position).to.equal(0)
      expect(change.changedBy).to.equal('1')
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1].val("TextTest")
    v.insert 0, "x"
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2

  it "Observers work on shared Text (delete type observers, local and foreign)", ->
    u = @yTest.users[0].val("TextTest","my awesome Text","mutable").val("TextTest")
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("delete")
      expect(change.object).to.equal(u)
      expect(change.position).to.equal(1)
      expect(change.length).to.equal(1)
      expect(change.changedBy).to.equal('0')
      last_task = "observer1"
    u.observe observer1
    u.delete 1, 1
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("delete")
      expect(change.object).to.equal(u)
      expect(change.position).to.equal(0)
      expect(change.length).to.equal(1)
      expect(change.changedBy).to.equal('1')
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1].val("TextTest")
    v.delete 0, 1
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2

  it "can handle many engines, many operations, concurrently (random)", ->
    console.log("testiy deleted this TODO:dtrn")
    @yTest.run()


