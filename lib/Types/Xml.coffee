class YXml

  constructor: (tagname, attributes = {}, children = [], classes = {})->
    @_xml = {}
    if not tagname?
      throw new Error "You must specify a tagname"
    @_xml.tagname = tagname
    if attributes.constructor isnt Object
      throw new Error "The attributes must be specified as a Object"
    for a_name, a of attributes
      if a.constructor isnt String
        throw new Error "The attributes must be of type String!"
    @_xml.attributes = attributes
    if classes.constructor isnt Object
      throw new Error "The classes must be specified as an Array"
    @_xml.classes = classes
    _classes = @_xml.attributes.class
    delete @_xml.attributes.class
    if _classes?
      for c_name, c in _classes.split(" ")
        if c.length > 0
          @_xml.classes[c_name] = c
    if children.constructor isnt Array
      throw new Error "You must specify the children as an Array that contains Strings and Y.Xml objects only"

  _name: "Xml"

  _getModel: (types, ops)->
    if not @_model?
      @_model = new ops.MapManager(@).execute()
      @_model.val("attributes", new Y.Object(@_xml.attributes))
             .val("classes", new Y.Object(@_xml.classes))
             .val("tagname", @_xml.tagname)
             .val("children", @_xml.children)

    delete @_xml
    @_model

  _setModel: (@_model)->
    delete @_xml

  attr: (name, value)->
    if arguments.length > 1
      if value.constructor isnt Strings
        throw new Error "The attributes must be of type String!"
      @_model.val("attributes").val(name, value)
      @
    else if arguments.length > 0
      @_model.val("attributes").val(name)
    else
      @_model.val("attributes").val()

  addClass: (name)->
    @_model.val("classes").val(name, true)
    @

  removeClass: (name)->
    @_model.val("classes").delete(name)

  





