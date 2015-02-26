
json_types_uninitialized = require "./JsonTypes"

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



    setXmlProxy: ()->

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
            if not e.isDeleted() and e.content? # TODO: how can this happen?  Probably because listeners
              if n.type is "XmlType"
                @xml.appendChild n.val(enforce)
              else if n.type is "TextNodeType"
                text_node = n.val()
                @xml.appendChild text_node
              else
                throw new Error "Internal structure cannot be transformed to dom"
            e = e.next_cl
        @setXmlProxy()
        @xml


    execute: ()->
      super()
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
