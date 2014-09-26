
json_types_uninitialized = require "./JsonTypes"

module.exports = (HB)->
  json_types = json_types_uninitialized HB
  types = json_types.types
  parser = json_types.parser

  #
  # Manages XML types
  #
  class XmlType extends types.Insert

    constructor: (uid, @tagname, attributes, elements, prev_cl, next_cl, origin)->
      super uid, prev_cl, next_cl, origin

      if attributes? and elements?
        @saveOperation 'attributes', attributes
        @saveOperation 'elements', elements
      else if (not attributes?) and (not elements?)
        @attributes = new types.JsonType()
        HB.addOperation(@attributes).execute()
        @elements = new types.WordType()
        HB.addOperation(@elements).execute()
      else
        throw new Error "Either define attribute and elements both, or none of them"


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

    val: ()->
      if document?
        if arguments.length is 0
          if not @xml?
            @xml = document.createElement @tagname

            attr = @attributes.val()
            for attr_name, value of attr
              a = document.createAttribute attr_name
              a.value = value
              @xml.setAttributeNode a

            e = @elements.beginning.next_cl
            while e.type isnt "Delimiter"
              if not e.isDeleted()
                @xml.appendChild e.val()
              e.next_cl
          @xml
        else if arguments.length is 1
          
        else
          throw new Error "Can only parse one parameter"


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
          'uid' : @getUid()
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
        }
      if @origin isnt @prev_cl
        json["origin"] = @origin.getUid()
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
    new XmlType uid, tagname, attributes, elements, prev, next, origin


  types['XmlType'] = XmlType

  json_types
