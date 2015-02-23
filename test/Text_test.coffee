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
    u.val("TextTest",new Y.Text())

  getRandomRoot: (user_num)->
    @users[user_num].val("TextTest")

  getContent: (user_num)->
    @users[user_num].val("TextTest").val()

describe "TextFramework", ->
  @timeout 500000

  beforeEach (done)->
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
    u = @yTest.users[0].val("TextTest",new Y.Text("my awesome Text")).val("TextTest")
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
    u = @yTest.users[0].val("TextTest",new Y.Text("my awesome Text")).val("TextTest")
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

  it "handles double-late-join", ->
    test = new TextTest("double")
    test.run()
    @yTest.run()
    u1 = test.users[0]
    u2 = @yTest.users[1]
    ops1 = u1._model.HB._encode()
    ops2 = u2._model.HB._encode()
    u1._model.engine.applyOp ops2, true
    u2._model.engine.applyOp ops1, true
    compare = (o1, o2)->
      if o1._name? and o1._name isnt o2._name
        throw new Error "different types"
      else if o1._name is "Object"
        for name, val of o1.val()
          compare(val, o2.val(name))
      else if o1._name?
        compare(o1.val(), o2.val())
      else if o1 isnt o2
        throw new Error "different values"
    compare u1, u2
    expect(test.getContent(0)).to.deep.equal(@yTest.getContent(1))

























