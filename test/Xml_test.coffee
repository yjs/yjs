chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")

chai.use(sinonChai)

Y = require "../lib/y.coffee"
Y.Test = require "../../y-test/lib/y-test.coffee"

Y.List = require "../lib/Types/List"
Y.Xml = require "../lib/Types/Xml"
Y.Text = require "../lib/Types/Text"

Test = require "./TestSuite"

class XmlTest extends Test

  constructor: (suffix)->
    super suffix, Y

  makeNewUser: (userId)->
    conn = new Y.Test userId
    super new Y conn

  initUsers: (u)->
    u.val("xml",new Y.Xml("root"))

  type: "XmlTest"

  compare: (o1, o2, depth)->
    if o1.constructor is Y.Xml
      @compare o1._model, o2._model, depth
    else
      super

  getRandomRoot: (user_num, root, depth = @max_depth)->
    root ?= @users[user_num].val("xml")
    if depth is 0 or _.random(0,1) is 1 # take root
      root
    else # take child
      elems = null
      if root._name is "Xml"
        elems = root.getChildren()
      else
        return root

      elems = elems.filter (elem)->
        elem._name is "Xml"
      if elems.length is 0
        root
      else
        p = elems[_.random(0, elems.length-1)]
        @getRandomRoot user_num, p, depth--

  getGeneratingFunctions: (user_num)->
    that = @
    super(user_num).concat [
        f : (y)=> # set Attribute
          y.attr(that.getRandomKey(), that.getRandomText())
        types: [Y.Xml]
      ,
        f : (y)-> # DELETE Attribute
          keys = Object.keys(y.attr())
          y.removeAttr(keys[_.random(0,keys.length-1)])
        types : [Y.Xml]
      ,
        f : (y)-> # Add Class
          y.addClass(that.getRandomKey())
        types : [Y.Xml]
      ,
        f : (y)-> # toggleClass
          y.toggleClass(that.getRandomKey())
        types : [Y.Xml]
      ,
        f : (y)-> # Remove Class
          keys = y.attr("class").split(" ")
          y.removeClass(keys[_.random(0,keys.length-1)])
        types : [Y.Xml]
      ,
        f : (y)-> # append XML
          child = new Y.Xml(that.getRandomKey())
          y.append(child)
        types : [Y.Xml]
      ,
        f : (y)-> # pepend XML
          child = new Y.Xml(that.getRandomKey())
          y.prepend child
        types : [Y.Xml]
      ,
        f : (y)-> # after XML
          if y.getParent()?
            child = new Y.Xml(that.getRandomKey())
            y.after child
        types : [Y.Xml]
      ,
        f : (y)-> # before XML
          if y.getParent()?
            child = new Y.Xml(that.getRandomKey())
            y.before child
        types : [Y.Xml]
      ,
        f : (y)-> # empty
          y.empty()
        types : [Y.Xml]
      ,
        f : (y)-> # remove
          if y.getParent()?
            y.remove()
        types : [Y.Xml]
    ]

describe "Y-Xml", ->
  @timeout 500000

  beforeEach (done)->
    @yTest = new XmlTest()
    @users = @yTest.users

    @u1 = @users[1].val("xml")
    @u2 = @users[2].val("xml")
    @u3 = @users[3].val("xml")
    done()

  it "can handle many engines, many operations, concurrently (random)", ->
    console.log "" # TODO
    @yTest.run()
    console.log(@yTest.users[0].val("xml")+"")

  it "has a working test suite", ->
    @yTest.compareAll()

  it "handles double-late-join", ->
    test = new XmlTest("double")
    test.run()
    @yTest.run()
    u1 = test.users[0]
    u2 = @yTest.users[1]
    ops1 = u1._model.HB._encode()
    ops2 = u2._model.HB._encode()
    u1._model.engine.applyOp ops2, true
    u2._model.engine.applyOp ops1, true

  it "Create Xml Element", ->
    @u1.attr("stuff", "true")
    console.log(@u1.toString())
    @yTest.compareAll()

  describe "has method ", ->
    it "attr", ->
      @u1.attr("attr", "newAttr")
      @u1.attr("other_attr", "newAttr")
      @yTest.compareAll()
      expect(@u2.attr("attr")).to.equal("newAttr")
      expect(@u2.attr().other_attr).to.equal("newAttr")

    it "addClass", ->
      @u1.addClass("newClass")
      @u2.addClass("otherClass")
      @yTest.compareAll()
      expect(@u1.attr("class")).to.equal("newClass otherClass") # 1 < 2 and therefore this is the proper order


    it "append", ->
      child = new Y.Xml("child")
      child2 = new Y.Xml("child2")
      @u1.append child
      @u1.append child2
      expect(@u1.toString()).to.equal("<root><child></child><child2></child2></root>")
      @yTest.compareAll()

    it "prepend", ->
      child = new Y.Xml("child")
      child2 = new Y.Xml("child2")
      @u1.prepend child2
      @u1.prepend child
      expect(@u1.toString()).to.equal("<root><child></child><child2></child2></root>")
      @yTest.compareAll()

    it "after", ->
      child = new Y.Xml("child")
      @u1.append child
      child.after new Y.Xml("right-child")
      expect(@u1.toString()).to.equal("<root><child></child><right-child></right-child></root>")
      @yTest.compareAll()

    it "before", ->
      child = new Y.Xml("child")
      @u1.append child
      child.before new Y.Xml("left-child")
      expect(@u1.toString()).to.equal("<root><left-child></left-child><child></child></root>")
      @yTest.compareAll()

    it "empty", ->
      child = new Y.Xml("child")
      @u1.append child
      child.before new Y.Xml("left-child")
      expect(@u1.toString()).to.equal("<root><left-child></left-child><child></child></root>")
      @yTest.compareAll()
      @u1.empty()
      expect(@u1.toString()).to.equal("<root></root>")
      @yTest.compareAll()

    it "remove", ->
      child = new Y.Xml("child")
      child2 = new Y.Xml("child2")
      @u1.prepend child2
      @u1.prepend child
      expect(@u1.toString()).to.equal("<root><child></child><child2></child2></root>")
      @yTest.compareAll()
      child2.remove()
      expect(@u1.toString()).to.equal("<root><child></child></root>")

    it "removeAttr", ->
      @u1.attr("dtrn", "stuff")
      @u1.attr("dutrianern", "stuff")
      @yTest.compareAll()
      @u2.removeAttr("dtrn")
      @yTest.compareAll()
      expect(@u3.attr("dtrn")).to.be.undefined

    it "removeClass", ->
      @u1.addClass("dtrn")
      @u1.addClass("iExist")
      @yTest.compareAll()
      @u2.removeClass("dtrn")
      @yTest.compareAll()
      expect(@u3.attr("class")).to.equal("iExist")

    it "toggleClass", ->
      @u1.addClass("dtrn")
      @u1.addClass("iExist")
      @yTest.compareAll()
      @u2.removeClass("dtrn")
      @yTest.compareAll()
      expect(@u3.attr("class")).to.equal("iExist")
      @u3.toggleClass("iExist")
      @u3.toggleClass("wraa")
      @yTest.compareAll()
      expect(@u1.attr("class")).to.equal("wraa")

    it "getParent", ->
      child = new Y.Xml("child")
      @u1.prepend(child)
      expect(@u1).to.equal(child.getParent())

    it "getChildren", ->
      child = new Y.Xml("child")
      @u1.prepend(child)
      expect(@u1.getChildren()[0]).to.equal(child)


