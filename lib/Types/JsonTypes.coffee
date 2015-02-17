text_types_uninitialized = require "./TextTypes"

module.exports = (HB)->
  text_types = text_types_uninitialized HB
  types = text_types.types

  #
  # Manages Object-like values.
  #
  class types.Object extends types.MapManager

    #
    # Identifies this class.
    # Use it to check whether this is a json-type or something else.
    #
    # @example
    #   var x = y.val('unknown')
    #   if (x.type === "Object") {
    #     console.log JSON.stringify(x.toJson())
    #   }
    #
    type: "Object"

    applyDelete: ()->
      super()

    cleanup: ()->
      super()

    #
    # Transform this to a Json. If your browser supports Object.observe it will be transformed automatically when a change arrives.
    # Otherwise you will loose all the sharing-abilities (the new object will be a deep clone)!
    # @return {Json}
    #
    # TODO: at the moment you don't consider changing of properties.
    # E.g.: let x = {a:[]}. Then x.a.push 1 wouldn't change anything
    #
    toJson: (transform_to_value = false)->
      if not @bound_json? or not Object.observe? or true # TODO: currently, you are not watching mutable strings for changes, and, therefore, the @bound_json is not updated. TODO TODO  wuawuawua easy
        val = @val()
        json = {}
        for name, o of val
          if o instanceof types.Object
            json[name] = o.toJson(transform_to_value)
          else if o instanceof types.ListManager
            json[name] = o.toJson(transform_to_value)
          else if transform_to_value and o instanceof types.Operation
            json[name] = o.val()
          else
            json[name] = o
        @bound_json = json
        if Object.observe?
          that = @
          Object.observe @bound_json, (events)->
            for event in events
              if not event.changedBy? and (event.type is "add" or event.type = "update")
                # this event is not created by Y.
                that.val(event.name, event.object[event.name])
          @observe (events)->
            for event in events
              if event.created_ isnt HB.getUserId()
                notifier = Object.getNotifier(that.bound_json)
                oldVal = that.bound_json[event.name]
                if oldVal?
                  notifier.performChange 'update', ()->
                      that.bound_json[event.name] = that.val(event.name)
                    , that.bound_json
                  notifier.notify
                    object: that.bound_json
                    type: 'update'
                    name: event.name
                    oldValue: oldVal
                    changedBy: event.changedBy
                else
                  notifier.performChange 'add', ()->
                      that.bound_json[event.name] = that.val(event.name)
                    , that.bound_json
                  notifier.notify
                    object: that.bound_json
                    type: 'add'
                    name: event.name
                    oldValue: oldVal
                    changedBy:event.changedBy
      @bound_json

    #
    # @overload val()
    #   Get this as a Json object.
    #   @return [Json]
    #
    # @overload val(name)
    #   Get value of a property.
    #   @param {String} name Name of the object property.
    #   @return [Object Type||String|Object] Depending on the value of the property. If mutable it will return a Operation-type object, if immutable it will return String/Object.
    #
    # @overload val(name, content)
    #   Set a new property.
    #   @param {String} name Name of the object property.
    #   @param {Object|String} content Content of the object property.
    #   @return [Object Type] This object. (supports chaining)
    #
    val: (name, content)->
      if name? and arguments.length > 1
        if content? and content.constructor?
          type = types[content.constructor.name]
          if type? and type.create?
            args = []
            for i in [1...arguments.length]
              args.push arguments[i]
            o = type.create.apply null, args
            super name, o
          else
            throw new Error "The #{content.constructor.name}-type is not (yet) supported in Y."
        else
          super name, content
      else # is this even necessary ? I have to define every type anyway.. (see Number type below)
        super name

    #
    # @private
    #
    _encode: ()->
      {
        'type' : @type
        'uid' : @getUid()
      }

  types.Object.parse = (json)->
    {
      'uid' : uid
    } = json
    new this(uid)

  types.Object.create = (content, mutable)->
    json = new types.Object().execute()
    for n,o of content
      json.val n, o, mutable
    json


  types.Number = {}
  types.Number.create = (content)->
    content

  text_types


