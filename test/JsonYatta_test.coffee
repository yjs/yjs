chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Connector = require "../bower_components/connector/lib/test-connector/test-connector.coffee"
Yatta = require "../lib/yatta.coffee"

Test = require "./TestSuite"

class JsonTest extends Test
  makeNewUser: (userId)->
    conn = new Connector userId
    super new Yatta conn

  type: "JsonTest"

  getRandomRoot: (user_num, root)->
    root ?= @users[user_num]
    types = @users[user_num].types
    if _.random(0,1) is 1 # take root
      root
    else # take child
      properties =
        for oname,val of root.val()
          oname
      properties.filter (oname)->
        root[oname] instanceof types.Operation
      if properties.length is 0
        root
      else
        p = root[properties[_.random(0, properties.length-1)]]
        @getRandomRoot user_num, p

  getContent: (user_num)->
    @users[user_num].toJson(true)

  getGeneratingFunctions: (user_num)->
    types = @users[user_num].types
    super(user_num).concat [
        f : (y)=> # SET PROPERTY
          y.val(@getRandomKey(), @getRandomText(), 'immutable')
          null
        types : [types.JsonType]
      ,
        f : (y)=> # SET Object Property 1)
          y.val(@getRandomObject())
        types: [types.JsonType]
      ,
        f : (y)=> # SET Object Property 2)
          y.val(@getRandomKey(), @getRandomObject())
        types: [types.JsonType]
      ,
        f : (y)=> # SET PROPERTY TEXT
          y.val(@getRandomKey(), @getRandomText(), 'mutable')
        types: [types.JsonType]
    ]

describe "JsonFramework", ->
  beforeEach (done)->
    @timeout 50000
    @yTest = new JsonTest()
    @users = @yTest.users

    @test_user = @yTest.makeNewUser "test_user"
    done()

  it "can handle many engines, many operations, concurrently (random)", ->
    console.log "" # TODO
    @yTest.run()

  ### TODO
  it "has a update listener", ()->
    addName = false
    change = false
    change2 = 0
    @test_user.on 'add', (eventname, property_name)->
      if property_name is 'x'
        addName = true
    @test_user.val('x',5)
    @test_user.on 'change', (eventname, property_name)->
      if property_name is 'x'
        change = true
    @test_user.val('x', 6)
    @test_user.val('ins', "text", 'mutable')
    @test_user.on 'update', (eventname, property_name)->
      if property_name is 'ins'
        change2++
    @test_user.val('ins').insertText 4, " yay"
    @test_user.val('ins').deleteText 0, 4
    expect(addName).to.be.ok
    expect(change).to.be.ok
    expect(change2).to.equal 8
  ###

  it "has a working test suite", ->
    @yTest.compareAll()

  it "handles double-late-join", ->
    test = new JsonTest("double")
    test.run()
    @yTest.run()
    u1 = test.users[0]
    u2 = @yTest.users[1]
    ops1 = u1.HB._encode()
    ops2 = u2.HB._encode()
    u1.HB.renewStateVector u2.HB.getOperationCounter()
    u2.HB.renewStateVector u1.HB.getOperationCounter()
    u1.engine.applyOps ops2
    u2.engine.applyOps ops1
    expect(test.getContent(0)).to.deep.equal(@yTest.getContent(1))

  it "can handle creaton of complex json (1)", ->
    @yTest.users[0].val('a', 'q', "mutable")
    @yTest.users[1].val('a', 't', "mutable")
    @yTest.compareAll()
    q = @yTest.users[2].val('a')
    q.insertText(0,'A')
    @yTest.compareAll()
    expect(@yTest.getSomeUser().value.a.val()).to.equal("At")

  it "can handle creaton of complex json (2)", ->
    @yTest.getSomeUser().val('x', {'a':'b'})
    @yTest.getSomeUser().val('a', {'a':{q:"dtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt"}}, "mutable")
    @yTest.getSomeUser().val('b', {'a':{}})
    @yTest.getSomeUser().val('c', {'a':'c'})
    @yTest.getSomeUser().val('c', {'a':'b'})
    @yTest.compareAll()
    q = @yTest.getSomeUser().value.a.a.q
    q.insertText(0,'A')
    @yTest.compareAll()
    expect(@yTest.getSomeUser().value.a.a.q.val()).to.equal("Adtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt")

  it "handles immutables and primitive data types", ->
    @yTest.getSomeUser().val('string', "text", "immutable")
    @yTest.getSomeUser().val('number', 4, "immutable")
    @yTest.getSomeUser().val('object', {q:"rr"}, "immutable")
    @yTest.getSomeUser().val('null', null)
    @yTest.compareAll()
    expect(@yTest.getSomeUser().val('string')).to.equal "text"
    expect(@yTest.getSomeUser().val('number')).to.equal 4
    expect(@yTest.getSomeUser().val('object').val('q')).to.equal "rr"
    expect(@yTest.getSomeUser().val('null') is null).to.be.ok


  it "Observers work on JSON Types (add type observers, local and foreign)", ->
    u = @yTest.users[0]
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("add")
      expect(change.object).to.equal(u)
      expect(change.changedBy).to.equal('0')
      expect(change.name).to.equal("newStuff")
      last_task = "observer1"
    u.observe observer1
    u.val("newStuff","someStuff","mutable")
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("add")
      expect(change.object).to.equal(u)
      expect(change.changedBy).to.equal('1')
      expect(change.name).to.equal("moreStuff")
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1]
    v.val("moreStuff","someMoreStuff")
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2

  it "Observers work on JSON Types (update type observers, local and foreign)", ->
    u = @yTest.users[0].val("newStuff","oldStuff","mutable").val("moreStuff","moreOldStuff","mutable")
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("update")
      expect(change.object).to.equal(u)
      expect(change.changedBy).to.equal('0')
      expect(change.name).to.equal("newStuff")
      expect(change.oldValue.val()).to.equal("oldStuff")
      last_task = "observer1"
    u.observe observer1
    u.val("newStuff","someStuff")
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("update")
      expect(change.object).to.equal(u)
      expect(change.changedBy).to.equal('1')
      expect(change.name).to.equal("moreStuff")
      expect(change.oldValue.val()).to.equal("moreOldStuff")
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1]
    v.val("moreStuff","someMoreStuff")
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2


  it "Observers work on JSON Types (delete type observers, local and foreign)", ->
    u = @yTest.users[0].val("newStuff","oldStuff","mutable").val("moreStuff","moreOldStuff","mutable")
    @yTest.flushAll()
    last_task = null
    observer1 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("delete")
      expect(change.object).to.equal(u)
      expect(change.changedBy).to.equal('0')
      expect(change.name).to.equal("newStuff")
      expect(change.oldValue.val()).to.equal("oldStuff")
      last_task = "observer1"
    u.observe observer1
    u.delete("newStuff")
    expect(last_task).to.equal("observer1")
    u.unobserve observer1

    observer2 = (changes)->
      expect(changes.length).to.equal(1)
      change = changes[0]
      expect(change.type).to.equal("delete")
      expect(change.object).to.equal(u)
      expect(change.changedBy).to.equal('1')
      expect(change.name).to.equal("moreStuff")
      expect(change.oldValue.val()).to.equal("moreOldStuff")
      last_task = "observer2"
    u.observe observer2
    v = @yTest.users[1]
    v.delete("moreStuff")
    @yTest.flushAll()
    expect(last_task).to.equal("observer2")
    u.unobserve observer2



