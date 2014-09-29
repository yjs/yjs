
json_types_uninitialized = require "./JsonTypes"

# some dom implementations may call another dom.method that simulates the behavior of another.
# For example xml.insertChild(dom) , wich inserts an element at the end, and xml.insertAfter(dom,null) wich does the same
# But yatta's proxy may be called only once!
proxy_token = false
_proxy = (f_name, f)->
  old_f = @[f_name]
  if old_f?
    @[f_name] = ()->
      if not proxy_token
        proxy_token = true
        old_f.apply this, arguments
        f.apply this, arguments
        proxy_token = false
      else
        old_f.apply this, arguments
  #else
  #  @[f_name] = f
Element?.prototype._proxy = _proxy


module.exports = (HB)->
  json_types = json_types_uninitialized HB
  types = json_types.types
  parser = json_types.parser

  #
  # Manages XML types
  # Not supported:
  # * Attribute nodes
  # * Real replace of child elements (to much overhead). Currently, the new element is inserted after the 'replaced' element, and then it is deleted.
  # * Namespaces (*NS)
  # * Browser specific methods (webkit-* operations)
  class XmlType extends types.Insert

    constructor: (uid, @tagname, attributes, elements, @xml)->
      ### In case you make this instanceof Insert again
      if prev? and (not next?) and prev.type?
        # adjust what you actually mean. you want to insert after prev, then
        # next is not defined. but we only insert after non-deleted elements.
        # This is also handled in TextInsert.
        while prev.isDeleted()
          prev = prev.prev_cl
        next = prev.next_cl
      ###

      super()

      if attributes? and elements?
        @saveOperation 'attributes', attributes
        @saveOperation 'elements', elements
      else if (not attributes?) and (not elements?)
        @attributes = new types.JsonType()
        HB.addOperation(@attributes).execute()
        @elements = new types.WordType()
        @elements.parent = @
        HB.addOperation(@elements).execute()
      else
        throw new Error "Either define attribute and elements both, or none of them"

      if @xml?
        @tagname = @xml.tagName
        for i in [0...@xml.attributes.length]
          attr = xml.attributes[i]
          @attributes.val(attr.name, attr.value)
        for n in @xml.childNodes
          if n.nodeType is n.TEXT_NODE
            word = new types.WordType()
            HB.addOperation(word).execute()
            word.push n.textContent
            @elements.push word
          else if n.nodeType is n.ELEMENT_NODE
            element = new XmlType undefined, undefined, undefined, undefined, n
            HB.addOperation(element).execute()
            @elements.push element
          else
            throw new Error "I don't know Node-type #{n.nodeType}!!"
        @setXmlProxy()
      undefined

    #
    # Identifies this class.
    # Use it in order to check whether this is an xml-type or something else.
    #
    type: "XmlType"

    applyDelete: ()->
      @attributes.applyDelete()
      @elements.applyDelete()
      super()

    cleanup: ()->
      super()

    setXmlProxy: ()->
      @xml._yatta = @
      that = @
      # you want to find a specific child element. Since they are carried by an Insert-Type, you want to find that Insert-Operation.
      # @param child {DomElement} Dom element.
      # @return {InsertType} This carries the XmlType that represents the DomElement (child). false if i couldn't find it.
      #
      findNode = (child)->
        child = child._yatta
        elem = that.elements.beginning.next_cl
        while elem.type isnt 'Delimiter' and elem.content isnt child
          elem = elem.next_cl
        if elem.type is 'Delimiter'
          false
        else
          elem

      insertBefore = (insertedNode, adjacentNode)->
        next = null
        if adjacentNode?
          next = findNode adjacentNode
        prev = null
        if next
          prev = next.prev_cl
        else
          prev = @_yatta.elements.end.prev_cl
        element = new XmlType undefined, undefined, undefined, undefined, insertedNode
        HB.addOperation(element).execute()
        that.elements.insertAfter prev, element
      @xml._proxy 'insertBefore', insertBefore
      @xml._proxy 'appendChild', insertBefore
      @xml._proxy 'removeAttribute', (name)->
        that.attributes.val(name, undefined)
      @xml._proxy 'setAttribute', (name, value)->
        that.attributes.val name, value

      renewClassList = ()->
        that.attributes.val('class', Array.prototype.join.call this, " ")
      _proxy.call @xml.classList, 'add', renewClassList
      _proxy.call @xml.classList, 'remove', renewClassList
      @xml.__defineSetter__ 'className', (val)->
        @setAttribute('class', val)
      @xml.__defineGetter__ 'className', ()->
        that.attributes.val('class')
      @xml.__defineSetter__ 'textContent', (val)->
        # remove all nodes
        elems = that.xml.childNodes
        for elem in elems
          that.xml.removeChild elem

        # insert word content
        if val isnt ""
          text_node = document.createTextNode val
          that.xml.appendChild text_node

      removeChild = (node)->
        elem = findNode node
        if not elem
          throw new Error "You are only allowed to delete existing (direct) child elements!"
        d = new types.Delete undefined, elem
        HB.addOperation(d).execute()
      @xml._proxy 'removeChild', removeChild
      @xml._proxy 'replaceChild', (insertedNode, replacedNode)->
        insertBefore.call this, insertedNode, replacedNode
        removeChild.call this, replacedNode



    val: (enforce = false)->
      if document?
        if (not @xml?) or enforce
          @xml = document.createElement @tagname

          attr = @attributes.val()
          for attr_name, value of attr
            if value?
              a = document.createAttribute attr_name
              a.value = value
              @xml.setAttributeNode a

          e = @elements.beginning.next_cl
          while e.type isnt "Delimiter"
            n = e.content
            if not e.isDeleted()
              if n.type is "XmlType"
                @xml.appendChild n.val(enforce)
              else if n.type is "WordType"
                text_node = document.createTextNode n.val()
                @xml.appendChild text_node
              else
                throw new Error "Internal structure cannot be transformed to dom"
            e = e.next_cl
        @setXmlProxy()
        @xml



    #
    # If possible set the replace manager in the content.
    # @see WordType.setReplaceManager
    #
    execute: ()->
      super
    ###
      if not @validateSavedOperations()
        return false
      else

        return true
    ###

    #
    # Get the parent of this JsonType.
    # @return {XmlType}
    #
    getParent: ()->
      @parent

    #
    # @private
    #
    # Convert all relevant information of this operation to the json-format.
    # This result can be send to other clients.
    #
    _encode: ()->
      json =
        {
          'type' : @type
          'attributes' : @attributes.getUid()
          'elements' : @elements.getUid()
          'tagname' : @tagname
          'uid' : @getUid()

        }
      json

  parser['XmlType'] = (json)->
    {
      'uid' : uid
      'attributes' : attributes
      'elements' : elements
      'tagname' : tagname
    } = json

    new XmlType uid, tagname, attributes, elements, undefined


  types['XmlType'] = XmlType

  json_types
