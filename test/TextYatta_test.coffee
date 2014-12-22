chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Yatta = require "../lib/Yatta"
Connector = require "../bower_components/connector/lib/test-connector/test-connector.coffee"

Test = require "./TestSuite"
class TextTest extends Test

  type: "TextTest"

  makeNewUser: (userId)->
    conn = new Connector userId
    y = new Yatta conn
    y.val("TextTest","","mutable")
    y

  getRandomRoot: (user_num)->
    @users[user_num].val("TextTest")

  getContent: (user_num)->
    @users[user_num].val("TextTest").val()

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
    u = @yTest.users[0].val("TextTest")
    u.insertText 0, "abc"
    u = @yTest.users[1].val("TextTest")
    u.insertText 0, "xyz"
    @yTest.compareAll()
    expect(u.val()).to.equal("abcxyz")

  it "Observers work on shared Text (insert type observers, local and foreign)", ->
    u = @yTest.users[0].val("TextTest","my awesome Text").val("TextTest")
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("insert")
      expect(change.object).to.equal(u)
      expect(change.value).to.equal("a")
      expect(change.position).to.equal(1)
      expect(change.changed_by).to.equal('0')
      last_task = "observer1"
    u.observe observer1
    u.insertText 1, "a"
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("insert")
      expect(change.object).to.equal(u)
      expect(change.value).to.equal("x")
      expect(change.position).to.equal(0)
      expect(change.changed_by).to.equal('1')
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1].val("TextTest")
    v.insertText 0, "x"
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2

  it "Observers work on shared Text (delete type observers, local and foreign)", ->
    u = @yTest.users[0].val("TextTest","my awesome Text").val("TextTest")
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("delete")
      expect(change.object).to.equal(u)
      expect(change.position).to.equal(1)
      expect(change.length).to.equal(1)
      expect(change.changed_by).to.equal('0')
      last_task = "observer1"
    u.observe observer1
    u.deleteText 1
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("delete")
      expect(change.object).to.equal(u)
      expect(change.position).to.equal(0)
      expect(change.length).to.equal(0)
      expect(change.changed_by).to.equal('1')
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1].val("TextTest")
    v.deleteText 0
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2

  it "can handle many engines, many operations, concurrently (random)", ->
    @yTest.run()


