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

class JsonTest extends Test
  makeNewUser: (user, conn)->
    new Y.JsonYatta user, conn

  getRandomRoot: (user_num, root)->
    root ?= @users[user_num].getRootElement()
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
    @users[user_num].toJson()

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



describe "JsonYatta", ->
  beforeEach (done)->
    @timeout 50000
    @yTest = new JsonTest()
    @users = @yTest.users

    @test_user = @yTest.makeNewUser 0, (Connector_uninitialized [])
    done()

  it "can handle many engines, many operations, concurrently (random)", ->
    @yTest.run()

  it "has a JsonWrapper", ->
    y = this.yTest.getSomeUser().root_element
    y.val('x',"dtrn", 'immutable')
    y.val('set',{x:"x"}, 'immutable')
    w = y.value
    w.x
    w.set = {y:""}
    w.x
    w.set
    w.set.x
    expect(w.x).to.equal("dtrn")
    expect(w.set.x).to.equal("x")
    y.value.x = {q:4}
    expect(y.value.x.q).to.equal(4)

  it "handles double-late-join", ->
    test = new JsonTest("double")
    test.run()
    @yTest.run()
    u1 = test.users[0]
    u2 = @yTest.users[1]
    ops1 = u1.HB._encode()
    ops2 = u2.HB._encode()
    u1.engine.applyOps ops2
    u2.engine.applyOps ops1
    expect(u2.value.name.val()).to.equal(u2.value.name.val())



  it "can handle creaton of complex json", ->
    @yTest.getSomeUser().val('x', {'a':'b'})
    @yTest.getSomeUser().val('a', {'a':{q:"dtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt"}})
    @yTest.getSomeUser().val('b', {'a':{}})
    @yTest.getSomeUser().val('c', {'a':'c'})
    @yTest.getSomeUser().val('c', {'a':'b'})
    @yTest.compareAll()
    @yTest.getSomeUser().value.a.a.q.insertText(0,'AAA')
    @yTest.compareAll()
    expect(@yTest.getSomeUser().value.a.a.q.val()).to.equal("AAAdtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt")


  it "handles some immutable tests", ->
    @yTest.getSomeUser().val('string', "text", "immutable")
    @yTest.getSomeUser().val('number', 4, "immutable")
    @yTest.getSomeUser().val('object', {q:"rr"}, "immutable")
    @yTest.compareAll()
    expect(@yTest.getSomeUser().val('string')).to.equal "text"
    expect(@yTest.getSomeUser().val('number')).to.equal 4
    expect(@yTest.getSomeUser().val('object').val('q')).to.equal "rr"

  it "converges t1", ->
    op0 = {"type":"Delimiter","uid":{"creator":0,"op_number":0},"next":{"creator":0,"op_number":1}}
    op1 = {"type":"Delimiter","uid":{"creator":0,"op_number":1},"prev":{"creator":0,"op_number":0}}
    op2 = {"type":"Word","uid":{"creator":0,"op_number":2},"beginning":{"creator":0,"op_number":0},"end":{"creator":0,"op_number":1}}
    op3 = {"type":"AddName","uid":{"creator":0,"op_number":3},"map_manager":{"creator":"_","op_number":"_"},"name":"name"}
    op4 = {"type":"Replaceable","content":{"creator":0,"op_number":2},"ReplaceManager":{"creator":"_","op_number":"___RM_name"},"prev":{"creator":"_","op_number":"___RM_name_beginning"},"next":{"creator":"_","op_number":"___RM_name_end"},"uid":{"creator":0,"op_number":4}}
    op5 = {"type":"TextInsert","content":"u","uid":{"creator":1,"op_number":2},"prev":{"creator":1,"op_number":0},"next":{"creator":1,"op_number":1}}
    op6 = {"type":"TextInsert","content":"w","uid":{"creator":2,"op_number":0},"prev":{"creator":0,"op_number":0},"next":{"creator":0,"op_number":1}}
    op7 = {"type":"TextInsert","content":"d","uid":{"creator":1,"op_number":0},"prev":{"creator":0,"op_number":0},"next":{"creator":2,"op_number":0}}
    op8 = {"type":"TextInsert","content":"a","uid":{"creator":1,"op_number":1},"prev":{"creator":1,"op_number":0},"next":{"creator":2,"op_number":0}}

    ops = [op0, op1, op2, op3, op4, op5, op6, op7, op8]
    @test_user.engine.applyOps ops
    expect(@test_user.val('name').val()).to.equal("duaw")

