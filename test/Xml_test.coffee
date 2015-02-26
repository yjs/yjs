chai      = require('chai')
expect    = chai.expect
should    = chai.should()
sinon     = require('sinon')
sinonChai = require('sinon-chai')
_         = require("underscore")
$         = require('jquery')

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
    @doSomething_amount *= 20

  makeNewUser: (userId)->
    conn = new Y.Test userId
    super new Y conn

  initUsers: (u)->
    u.val("xml",new Y.Xml("div"))

  type: "XmlTest"

  compare: (o1, o2, depth)->
    if o1.constructor is Y.Xml
      super o1._model, o2._model, depth
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

  getRandomXmlElement: ()->
    if _.random(0,1) is 0
      new Y.Xml(@getRandomKey())
    else
      @getRandomText()

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
          child = that.getRandomXmlElement()
          y.append(child)
        types : [Y.Xml]
      ,
        f : (y)-> # pepend XML
          child = that.getRandomXmlElement()
          y.prepend child
        types : [Y.Xml]
      ,
        f : (y)-> # after XML
          if y.getParent()?
            child = that.getRandomXmlElement()
            y.after child
        types : [Y.Xml]
      ,
        f : (y)-> # before XML
          if y.getParent()?
            child = that.getRandomXmlElement()
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
      expect(@u1.toString()).to.equal("<div><child></child><child2></child2></div>")
      @yTest.compareAll()

    it "prepend", ->
      child = new Y.Xml("child")
      child2 = new Y.Xml("child2")
      @u1.prepend child2
      @u1.prepend child
      expect(@u1.toString()).to.equal("<div><child></child><child2></child2></div>")
      @yTest.compareAll()

    it "after", ->
      child = new Y.Xml("child")
      @u1.append child
      child.after new Y.Xml("right-child")
      expect(@u1.toString()).to.equal("<div><child></child><right-child></right-child></div>")
      @yTest.compareAll()

    it "before", ->
      child = new Y.Xml("child")
      @u1.append child
      child.before new Y.Xml("left-child")
      expect(@u1.toString()).to.equal("<div><left-child></left-child><child></child></div>")
      @yTest.compareAll()

    it "empty", ->
      child = new Y.Xml("child")
      @u1.append child
      child.before new Y.Xml("left-child")
      expect(@u1.toString()).to.equal("<div><left-child></left-child><child></child></div>")
      @yTest.compareAll()
      @u1.empty()
      expect(@u1.toString()).to.equal("<div></div>")
      @yTest.compareAll()

    it "remove", ->
      child = new Y.Xml("child")
      child2 = new Y.Xml("child2")
      @u1.prepend child2
      @u1.prepend child
      expect(@u1.toString()).to.equal("<div><child></child><child2></child2></div>")
      @yTest.compareAll()
      child2.remove()
      expect(@u1.toString()).to.equal("<div><child></child></div>")

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

  if not window?
    describe "skip DOM tests (only in browser environment)", ->
      it "", ->
  else
    describe "DOM binding ", ->
      beforeEach (done)->
        @dom = @u1.getDom()
        @j = $(@dom)
        done()

      it "can transform to a new real Dom element", ->
        expect(@dom).to.not.be.undefined

      it "supports dom.insertBefore", ->
        newdom = $("<p>dtrn</p>")[0]
        newdom2 = $("<p>dtrn2</p>")[0]
        @dom.insertBefore(newdom2, null)
        @dom.insertBefore(newdom, newdom2)
        expect(@u1+"").to.equal("<div><p>dtrn</p><p>dtrn2</p></div>")
        expect(@dom.outerHTML).to.equal("<div><p>dtrn</p><p>dtrn2</p></div>")

      it "supports dom.appendChild", ->
        newdom = $("<p>dtrn</p>")[0]
        @dom.appendChild(newdom)
        expect(@u1+"").to.equal("<div><p>dtrn</p></div>")

      it "supports dom.setAttribute", ->
        @dom.setAttribute("test_attribute", "newVal")
        expect(@u1.attr("test_attribute")).to.equal("newVal")
        expect(@dom.getAttribute("test_attribute")).to.equal("newVal")

      it "supports dom.removeAttribute", ->
        @dom.setAttribute("test_attribute", "newVal")
        expect(@u1.attr("test_attribute")).to.equal("newVal")
        expect(@dom.getAttribute("test_attribute")).to.equal("newVal")
        @dom.removeAttribute("test_attribute")
        expect(@u1.attr("test_attribute")).to.be.undefined
        expect(@dom.getAttribute("test_attribute")).to.be.undefined

      it "supports dom.removeChild", ->
        newdom = $("<p>dtrn</p>")[0]
        @dom.appendChild(newdom)
        expect(@u1+"").to.equal("<div><p>dtrn</p></div>")
        expect(@dom.outerHTML).to.equal("<div><p>dtrn</p></div>")

        @dom.removeChild(newdom)
        expect(@dom.childNodes.length).to.equal(0)
        expect(@u1.getChildren().length).to.equal(0)

      it "supports dom.replaceChild", ->
        dom = $("<p>dtrn</p>")[0]
        @dom.appendChild(newdom)
        expect(@u1+"").to.equal("<div><p>dtrn</p></div>")
        expect(@dom.outerHTML).to.equal("<div><p>dtrn</p></div>")

        newdom = $("<p>replaced</p>")[0]
        @dom.replaceChild(dom,newdom)
        expect(@dom.outerHTML).to.equal("<div><p>replaced</p></div>")
        expect(@u1+"").to.equal("<div><p>replaced</p></div>")

      it "supports dom.classList.add", ->
        @dom.classList.add "classy"
        @dom.classList.add "moreclassy"
        expect(@u1.attr("class")).to.equal("classy moreclassy")
        expect(@dom.getAttribute("class")).to.equal("classy moreclassy")


      it "supports dom.textContent", ->
        dom = $("<p>dtrn</p>")[0]
        @dom.appendChild(newdom)
        expect(@u1+"").to.equal("<div><p>dtrn</p></div>")
        expect(@dom.outerHTML).to.equal("<div><p>dtrn</p></div>")

        @dom.textContent = ""
        expect(@u1+"").to.equal("<div></div>")
        expect(@dom.outerHTML).to.equal("<div></div>")

      it "suppports dom.textContent (non empty string)", ->
        dom = $("<p>dtrn</p>")[0]
        @dom.appendChild(newdom)
        expect(@u1+"").to.equal("<div><p>dtrn</p></div>")
        expect(@dom.outerHTML).to.equal("<div><p>dtrn</p></div>")

        @dom.textContent = "stuff"
        expect(@u1+"").to.equal("<div>stuff</div>")
        expect(@dom.outerHTML).to.equal("<div>stuff</div>")

      it "supports jquery.addClass", ->
        @j.addClass("testy")
        @j.addClass("testedy tested")
        expect(@dom.getAttribute("class")).to.equal("testy testedy tested")

      it "supports jquery.after", ->
        d = $("<span></span>")
        @dom.appendChild(d[0], null)
        d.after("<div>after</div>")
        expect(@dom.outerHTML).to.equal("<div><span></span><div>after</div></div>")
        expect(@u1+"").to.equal("<div><span></span><div>after</div></div>")

      it "supports jquery.append", ->
        d = $("<span></span>")[0]
        @j.append(d)
        d = $("<div></div>")[0]
        @dom.append(d)
        expect(@dom.outerHTML).to.equal("<div><span></span><div></div></div>")
        expect(@u1+"").to.equal("<div><span></span><div></div></div>")

      it "supports jquery.appendTo", ->
        $("<b>appendedTo</b>").appendTo(@dom)
        $("p").appendTo(@dom)
        expect(@dom.outerHTML).to.equal("<div><b>appendedTo</b><p></p></div>")
        expect(@u1+"").to.equal("<div><b>appendedTo</b><p></p></div>")

      it "supports jquery.before", ->
        newdom = $("p")
        $(@dom).append(newdom)
        newdom.before("<div>before</div>")
        expect(@dom.outerHTML).to.equal("<div><div>before</div><p></p></div>")
        expect(@u1+"").to.equal("<div><div>before</div><p></p></div>")

      it "supports jquery.detach", ->
        d = $("p")
        $j.append(d)
        $j.detach("p")
        expect(@dom.outerHTML).to.equal("<div></div>")
        expect(@u1+"").to.equal("<div></div>")

      it "supports jquery.empty", ->
        d = $("<p />")
        d.appendTo(@dom)
        d = $("<div />")
        d.appendTo(@dom)
        @j.empty()
        expect(@dom.outerHTML).to.equal("<div></div>")
        expect(@u1+"").to.equal("<div></div>")

      it "supports jquery.insertAfter", ->
        d = $("span")
        d.appendTo(@dom)
        $("<p>after</p>").insertAfter(d)
        expect(@dom.outerHTML).to.equal("<div><span></span><p>after</p></div>")
        expect(@u1+"").to.equal("<div><span></span><p>after</p></div>")

      it "supports jquery.insertBefore", ->
        d = $("span")
        d.appendTo(@j)
        $("<p>after</p>").insertAfter(d)
        expect(@dom.outerHTML).to.equal("<div><p>before</p><span></span></div>")
        expect(@u1+"").to.equal("<div><p>before</p><span></span></div>")

      it "supports jquery.prepend", ->
        @j.prepend("<p>prepended2</p>")
        @j.prepend("<p>prepended1</p>")
        expect(@dom.outerHTML).to.equal("<div><p>prepended1</p><p>prepended2</p></div>")
        expect(@u1+"").to.equal("<div><p>prepended1</p><p>prepended2</p></div>")

      it "supports jquery.prependTo", ->
        $("<p>prepended2</p>").prependTo(@j)
        $("<p>prepended1</p>").prependTo(@j)
        expect(@dom.outerHTML).to.equal("<div><p>prepended1</p><p>prepended2</p></div>")
        expect(@u1+"").to.equal("<div><p>prepended1</p><p>prepended2</p></div>")

      it "supports jquery.remove", ->
        d = $("<div />")
        d.prependTo(@j)
        d.remove()
        expect(@dom.outerHTML).to.equal("<div></div>")
        expect(@u1+"").to.equal("<div></div>")

      it "supports jquery.removeAttr", ->
        @dom.setAttribute("test_attribute", "newVal")
        expect(@u1.attr("test_attribute")).to.equal("newVal")
        expect(@dom.getAttribute("test_attribute")).to.equal("newVal")

        @j.removeAttr("test_attribute")
        expect(@u1.attr("test_attribute")).to.be.undefined
        expect(@j.attr("test_attribute")).to.be.undefined

      it "supports jquery.removeClass", ->
        @j.addClass("testy")
        @j.addClass("testedy tested")
        expect(@dom.getAttribute("class")).to.equal("testy testedy tested")

        @j.removeClass("testedy")
        expect(@dom.getAttribute("class")).to.equal("testy tested")
        expect(@u1.hasClass("testedy")).to.be.false

      it "supports jquery.attr", ->
        @j.attr("atone", "yeah")
        expect(@u1.attr("atone")).to.equal("yeah")

      it "supports jquery.replaceAll", ->
        $("<span>New span content </span>").replaceAll("#test_dom div")
        @check()

      it "supports jquery.replaceWith", ->
        d = $("span")
        @j.prepend(d)
        d = $("span")
        @j.prepend(d)
        d = $("span")
        @j.prepend(d)
        d = @j.getElementsByTagName("span")
        d.replaceWith("<div></div>")

        expect(@dom.outerHTML).to.equal("<div><div></div><div></div><div></div></div>")
        expect(@u1+"").to.equal("<div><div></div><div></div><div></div></div>")






