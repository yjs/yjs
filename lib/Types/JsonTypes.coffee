text_types_uninitialized = require "./TextTypes.coffee"

module.exports = (HB)->
  text_types = text_types_uninitialized HB
  types = text_types.types
  parser = text_types.parser

  #
  # Manages Object-like values.
  #
  class JsonType extends types.MapManager
    constructor: (uid, initial_value)->
      super uid
      if initial_value?
        if typeof initial_value isnt "object"
          throw new Error "The initial value of JsonTypes must be of type Object! (current type: #{typeof initial_value})"
        for name,o of initial_value
          @val name, o

    #
    # Get this as a Json object. Note that none of the values of the result is of type Operation.
    # @overload val()
    #   @results [Json]
    #
    # Get value of a property.
    # @overload val(name)
    #   @param {String} name Name of the object property.
    #   @results [JsonType|WordType]
    #
    # Set a new property.
    # @overload val(name, content)
    #   @param {String} name Name of the object property.
    #   @param {Object|String} content Content of the object property.
    #
    val: (name, content)->
      if name? and content?
        if typeof content is 'string'
          word = HB.addOperation(new types.Word HB.getNextOperationIdentifier(), content).execute()
          super name, word
        else if typeof content is 'object'
          json = HB.addOperation(JsonType HB.getNextOperationIdentifier(), content).execute()
          super name, json
        else
          throw new Error "You must not set #{typeof content}-types in collaborative Json-objects!"
        @
      else
        super name, content

    toJson: ()->
      {
        'type' : "JsonType"
        'uid' : @getUid()
      }

  parser['JsonType'] = (json)->
    {
      'uid' : uid
    } = json
    new JsonType uid


  types['JsonType'] = JsonType

  text_types


