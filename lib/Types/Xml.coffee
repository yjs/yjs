class YXml

  constructor: (tagname, attributes = {})->
    @_xml = {}
    #TODO: How to force the user to specify parameters?
    #if not tagname?
    #  throw new Error "You must specify a tagname"
    @_xml.tagname = tagname
    if attributes.constructor isnt Object
      throw new Error "The attributes must be specified as a Object"
    for a_name, a of attributes
      if a.constructor isnt String
        throw new Error "The attributes must be of type String!"
    @_xml.attributes = attributes
    @_xml.classes = {}
    _classes = @_xml.attributes.class
    delete @_xml.attributes.class
    if _classes?
      for c_name, c in _classes.split(" ")
        if c.length > 0
          @_xml.classes[c_name] = c
    undefined

  _name: "Xml"

  _getModel: (Y, ops)->
    if not @_model?
      @_model = new ops.MapManager(@).execute()
      @_model.val("attributes", new Y.Object(@_xml.attributes))
      @_model.val("classes", new Y.Object(@_xml.classes))
      @_model.val("tagname", @_xml.tagname)
      @_model.val("children", new Y.List())
      if @_xml.parent?
        @_model.val("parent", @_xml.parent)
    @_setModel @_model
    @_model

  _setModel: (@_model)->
    delete @_xml
    @_model.observe (events)->
      for event in events
        if event.name is "parent" and event.type isnt "add"
          parent = event.oldValue
          children = parent._model.val("children")?.val()
          if children?
            for c,i in children
              if c is @
                parent._model.val("children").delete i
                break
      undefined


  _setParent: (parent)->
    if parent instanceof YXml
      if @_model?
        @remove()
        @_model.val("parent", parent)
      else
        @_xml.parent = parent
    else
      throw new Error "parent must be of type Y.Xml!"

  toString: ()->
    xml = "<"+@_model.val("tagname")
    for name, value of @attr()
      xml += " "+name+'="'+value+'"'
    xml += ">"
    for child in @_model.val("children").val()
      xml += child.toString()
    xml += '</'+@_model.val("tagname")+'>'
    xml

  #
  # Get/set the attribute(s) of this element.
  # .attr()
  # .attr(name)
  # .attr(name, value)
  #
  attr: (name, value)->
    if arguments.length > 1
      if value.constructor isnt String
        throw new Error "The attributes must be of type String!"
      @_model.val("attributes").val(name, value)
      @
    else if arguments.length > 0
      if name is "class"
        Object.keys(@_model.val("classes").val()).join(" ")
      else
        @_model.val("attributes").val(name)
    else
      attrs = @_model.val("attributes").val()
      classes = Object.keys(@_model.val("classes").val()).join(" ")
      if classes.length > 0
        attrs["class"] = classes
      attrs

  #
  # Adds the specified class(es) to this element
  #
  addClass: (names)->
    for name in names.split(" ")
      @_model.val("classes").val(name, true)
    @

  #
  # Insert content, specified by the parameter, after this element
  # .after(content [, content])
  #
  after: ()->
    parent = @_model.val("parent")
    if not parent?
      throw new Error "This Xml Element must not have siblings! (for it does not have a parent)"

    # find the position of this element
    for c,position in parent.getChildren()
      if c is @
        break

    contents = []
    for content in arguments
      if content instanceof YXml
        content._setParent(@_model.val("parent"))
      else if content.constructor isnt String
        throw new Error "Y.Xml.after expects instances of YXml or String as a parameter"
      contents.push content

    parent._model.val("children").insertContents(position+1, contents)

  #
  # Insert content, specified by the parameter, to the end of this element
  # .append(content [, content])
  #
  append: ()->
    for content in arguments
      if content instanceof YXml
        content._setParent(@)
      else if content.constructor isnt String
        throw new Error "Y.Xml.after expects instances of YXml or String as a parameter"
      @_model.val("children").push(content)
    @

  #
  # Insert content, specified by the parameter, after this element
  # .after(content [, content])
  #
  before: ()->
    parent = @_model.val("parent")
    if not parent?
      throw new Error "This Xml Element must not have siblings! (for it does not have a parent)"

    # find the position of this element
    for c,position in parent.getChildren()
      if c is @
        break

    contents = []
    for content in arguments
      if content instanceof YXml
        content._setParent(@_model.val("parent"))
      else if content.constructor isnt String
        throw new Error "Y.Xml.after expects instances of YXml or String as a parameter"
      contents.push content

    parent._model.val("children").insertContents(position, contents)

  #
  # Remove all child nodes of the set of matched elements from the DOM.
  # .empty()
  #
  empty: ()->
    # TODO: do it like this : @_model.val("children", new Y.List())
    children = @_model.val("children")
    for child in children.val()
      if child.constructor is String
        children.delete(0)
      else
        child.remove()

  #
  # Determine whether any of the matched elements are assigned the given class.
  # .hasClass(className)
  #
  hasClass: (className)->
    if @_model.val("classes").val(className)?
      true
    else
      false

  #
  # Insert content, specified by the parameter, to the beginning of this element.
  # .prepend(content [, content])
  #
  prepend: ()->
    for content in arguments
      if content instanceof YXml
        content._setParent(@)
      else if content.constructor isnt String
        throw new Error "Y.Xml.after expects instances of YXml or String as a parameter"
      @_model.val("children").insert(0, content)
    @

  #
  # Remove this element from the DOM
  # .remove()
  #
  remove: ()->
    parent = @_model.delete("parent")
    @

  #
  # Remove an attribute from this element
  # .removeAttr(attrName)
  #
  removeAttr: (attrName)->
    if attrName is "class"
      @_model.val("classes", new @_model.custom_types.Object())
    else
      @_model.val("attributes").delete(attrName)
    @

  #
  # Remove a single class, multiple classes, or all classes from this element
  # .removeClass([className])
  #
  removeClass: ()->
    if arguments.length is 0
      @_model.val("classes", new @_model.custom_types.Object())
    else
      for className in arguments
        @_model.val("classes").delete(className)
    @

  #
  # Add or remove one or more classes from this element,
  # depending on either the class’s presence or the value of the state argument.
  # .toggleClass([className])
  #
  toggleClass: ()->
    for className in arguments
      classes = @_model.val("classes")
      if classes.val(className)?
        classes.delete(className)
      else
        classes.val(className, true)
    @

  #
  # Get the parent of this Element
  # @Note: Every XML element can only have one parent
  # .getParent()
  #
  getParent: ()->
    @_model.val("parent")

  #
  # Get all the children of this XML Element as an Array
  # @Note: The children are either of type Y.Xml or String
  # .getChildren()
  #
  getChildren: ()->
    @_model.val("children").val()


if window?
  if window.Y?
    window.Y.Xml = YXml
  else
    throw new Error "You must first import Y!"

if module?
  module.exports = YXml









