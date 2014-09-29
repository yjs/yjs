
json_types_uninitialized = require "./JsonTypes"

Element?.prototype._proxy = (f_name, f)->
  old_f = @[f_name]
  if old_f?
    @[f_name] = ()->
      f.apply this, arguments
      old_f.apply this, arguments
  else
    @[f_name] = f


module.exports = (HB)->
  json_types = json_types_uninitialized HB
  types = json_types.types
  parser = json_types.parser

  #
  # Manages XML types
  #
  class XmlType extends types.Insert

    constructor: (uid, @tagname, attributes, elements, @xml, prev, next, origin)->
      if prev? and (not next?) and prev.type?
        # adjust what you actually mean. you want to insert after prev, then
        # next is not defined. but we only insert after non-deleted elements.
        # This is also handled in TextInsert.
        while prev.isDeleted()
          prev = prev.prev_cl
        next = prev.next_cl

      super uid, prev, next, origin

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
            last = @elements.end
            element = new XmlType undefined, undefined, undefined, undefined, n, last.prev_cl, last
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
      @xml._proxy 'insertBefore', (insertedNode, adjacentNode)->
        next = adjacentNode?._yatta
        prev = null
        if next?
          prev = next.prev_cl
        else
          prev = @_yatta.elements.end.prev_cl
        element = new XmlType undefined, undefined, undefined, undefined, insertedNode, prev
        HB.addOperation(element).execute()

    val: (enforce = false)->
      if document?
        if (not @xml?) or enforce
          @xml = document.createElement @tagname

          attr = @attributes.val()
          for attr_name, value of attr
            a = document.createAttribute attr_name
            a.value = value
            @xml.setAttributeNode a

          e = @elements.beginning.next_cl
          while e.type isnt "Delimiter"
            if not e.isDeleted()
              if e.type is "XmlType"
                @xml.appendChild e.val(enforce)
              else if e.type is "WordType"
                text_node = document.createTextNode e.val()
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
          'prev': @prev_cl?.getUid()
          'next': @next_cl?.getUid()
        }
      if @origin isnt @prev_cl
        json["origin"] = @origin?.getUid()
      json

  parser['XmlType'] = (json)->
    {
      'uid' : uid
      'attributes' : attributes
      'elements' : elements
      'tagname' : tagname
      'prev': prev
      'next': next
      'origin' : origin
    } = json

    new XmlType uid, tagname, attributes, elements, undefined, prev, next, origin


  types['XmlType'] = XmlType

  json_types
