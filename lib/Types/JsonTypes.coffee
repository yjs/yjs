text_types_uninitialized = require "./TextTypes"

module.exports = (HB)->
  text_types = text_types_uninitialized HB
  types = text_types.types
  parser = text_types.parser

  createJsonTypeWrapper = (_jsonType)->

    #
    # @note EXPERIMENTAL
    #
    # A JsonTypeWrapper was intended to be a convenient wrapper for the JsonType.
    # But it can make things more difficult than they are.
    # @see JsonType
    #
    # @example create a JsonTypeWrapper
    #   # You get a JsonTypeWrapper from a JsonType by calling
    #   w = yatta.value
    #
    # It creates Javascripts -getter and -setter methods for each property that JsonType maintains.
    # @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
    #
    # @example Getter Example
    #   # you can access the x property of yatta by calling
    #   w.x
    #   # instead of
    #   yatta.val('x')
    #
    # @note You can only overwrite existing values! Setting a new property won't have any effect!
    #
    # @example Setter Example
    #   # you can set an existing x property of yatta by calling
    #   w.x = "text"
    #   # instead of
    #   yatta.val('x', "text")
    #
    # In order to set a new property you have to overwrite an existing property.
    # Therefore the JsonTypeWrapper supports a special feature that should make things more convenient
    # (we can argue about that, use the JsonType if you don't like it ;).
    # If you overwrite an object property of the JsonTypeWrapper with a new object, it will result in a merged version of the objects.
    # Let `yatta.value.p` the property that is to be overwritten and o the new value. E.g. `yatta.value.p = o`
    # * The result has all properties of o
    # * The result has all properties of w.p if they don't occur under the same property-name in o.
    #
    # @example Conflict Example
    #   yatta.value = {a : "string"}
    #   w = yatta.value
    #   console.log(w) # {a : "string"}
    #   w.a = {a : {b : "string"}}
    #   console.log(w) # {a : {b : "String"}}
    #   w.a = {a : {c : 4}}
    #   console.log(w) # {a : {b : "String", c : 4}}
    #
    # @example Common Pitfalls
    #   w = yatta.value
    #   # Setting a new property
    #   w.newProperty = "Awesome"
    #   console.log(w.newProperty == "Awesome") # false, w.newProperty is undefined
    #   # overwrite the w object
    #   w = {newProperty : "Awesome"}
    #   console.log(w.newProperty == "Awesome") # true!, but ..
    #   console.log(yatta.value.newProperty == "Awesome") # false, you are only allowed to set properties!
    #   # The solution
    #   yatta.value = {newProperty : "Awesome"}
    #   console.log(w.newProperty == "Awesome") # true!
    #
    class JsonTypeWrapper

      #
      # @param {JsonType} jsonType Instance of the JsonType that this class wrappes.
      #
      constructor: (jsonType)->
        for name, obj of jsonType.map
          do (name, obj)->
            Object.defineProperty JsonTypeWrapper.prototype, name,
              get : ->
                x = obj.val()
                if x instanceof JsonType
                  createJsonTypeWrapper x
                else if x instanceof types.ImmutableObject
                  x.val()
                else
                  x
              set : (o)->
                overwrite = jsonType.val(name)
                if o.constructor is {}.constructor and overwrite instanceof types.Operation
                  for o_name,o_obj of o
                    overwrite.val(o_name, o_obj, 'immutable')
                else
                  jsonType.val(name, o, 'immutable')
              enumerable: true
              configurable: false
    new JsonTypeWrapper _jsonType

  #
  # Manages Object-like values.
  #
  class JsonType extends types.MapManager

    #
    # Identifies this class.
    # Use it to check whether this is a json-type or something else.
    #
    # @example
    #   var x = yatta.val('unknown')
    #   if (x.type === "JsonType") {
    #     console.log JSON.stringify(x.toJson())
    #   }
    #
    type: "JsonType"

    applyDelete: ()->
      super()

    cleanup: ()->
      super()
      
    #
    # Transform this to a Json. If your browser supports Object.observe it will be transformed automatically when a change arrives. 
    # Otherwise you will loose all the sharing-abilities (the new object will be a deep clone)!
    # @return {Json}
    #
    toJson: ()->
      if not @bound_json? or not Object.observe? or true # TODO: currently, you are not watching mutable strings for changes, and, therefore, the @bound_json is not updated. TODO TODO  wuawuawua easy
        val = @val()
        json = {}
        for name, o of val
          if not o?
            json[name] = o
          else if o.constructor is {}.constructor
            json[name] = @val(name).toJson()
          else if o instanceof types.Operation
            while o instanceof types.Operation
              o = o.val()
            json[name] = o
          else
            json[name] = o
        @bound_json = json
        if Object.observe? 
          that = @
          Object.observe @bound_json, (events)->
            for event in events
              if not event.changed_by? and (event.type is "add" or event.type = "update")
                # this event is not created by Yatta.
                that.val(event.name, event.object[event.name])
          that.on 'change', (event_name, property_name, op)->
            if this is that and op.uid.creator isnt HB.getUserId()
              notifier = Object.getNotifier(that.bound_json)
              oldVal = that.bound_json[property_name]
              if oldVal?
                notifier.performChange 'update', ()->
                    that.bound_json[property_name] = that.val(property_name)
                  , that.bound_json
                notifier.notify 
                  object: that.bound_json
                  type: 'update'
                  name: property_name
                  oldValue: oldVal
                  changed_by: op.uid.creator
              else 
                notifier.performChange 'add', ()->
                    that.bound_json[property_name] = that.val(property_name)
                  , that.bound_json
                notifier.notify 
                  object: that.bound_json
                  type: 'add'
                  name: property_name
                  oldValue: oldVal
                  changed_by: op.uid.creator
      @bound_json

    #
    # @see WordType.setReplaceManager
    # Sets the parent of this JsonType object.
    #
    setReplaceManager: (replace_manager)->
      @replace_manager = replace_manager
      @on ['change','addProperty'], ()->
        if replace_manager.parent?
          replace_manager.parent.forwardEvent this, arguments...

    #
    # Get the parent of this JsonType.
    # @return {JsonType}
    #
    getParent: ()->
      @replace_manager.parent

    #
    # Whether the default is 'mutable' (true) or 'immutable' (false)
    #
    mutable_default:
      true

    #
    # Set if the default is 'mutable' or 'immutable'
    # @param {String|Boolean} mutable Set either 'mutable' / true or 'immutable' / false
    setMutableDefault: (mutable)->
      if mutable is true or mutable is 'mutable'
        JsonType.prototype.mutable_default = true
      else if mutable is false or mutable is 'immutable'
        JsonType.prototype.mutable_default = false
      else
        throw new Error 'Set mutable either "mutable" or "immutable"!'
      'OK'

    #
    # @overload val()
    #   Get this as a Json object.
    #   @return [Json]
    #
    # @overload val(name)
    #   Get value of a property.
    #   @param {String} name Name of the object property.
    #   @return [JsonType|WordType|String|Object] Depending on the value of the property. If mutable it will return a Operation-type object, if immutable it will return String/Object.
    #
    # @overload val(name, content)
    #   Set a new property.
    #   @param {String} name Name of the object property.
    #   @param {Object|String} content Content of the object property.
    #   @return [JsonType] This object. (supports chaining)
    #
    val: (name, content, mutable)->
      if typeof name is 'object'
        # Special case. First argument is an object. Then the second arg is mutable. 
        # (I refer to var name and content here)
        # Keep that in mind when reading the following..
        jt = new JsonType()
        @replace_manager.replace jt.execute()
        for n,o of name
          jt.val n, o, mutable
        @
      else if name? and arguments.length > 1
        if mutable?
          if mutable is true or mutable is 'mutable'
            mutable = true
          else
            mutable = false
        else
          mutable = @mutable_default
        if typeof content is 'function'
          @ # Just do nothing
        else if (not content?) or (((not mutable) or typeof content is 'number') and content.constructor isnt Object)
          super name, (new types.ImmutableObject undefined, content).execute()
        else
          if typeof content is 'string'
            word = (new types.WordType undefined).execute()
            word.insertText 0, content
            super name, word
          else if content.constructor is Object
            json = new JsonType().execute()
            for n,o of content
              json.val n, o, mutable
            super name, json
          else
            throw new Error "You must not set #{typeof content}-types in collaborative Json-objects!"
      else
        super name, content

    Object.defineProperty JsonType.prototype, 'value',
      get : -> createJsonTypeWrapper @
      set : (o)->
        if o.constructor is {}.constructor
          for o_name,o_obj of o
            @val(o_name, o_obj, 'immutable')
        else
          throw new Error "You must only set Object values!"

    #
    # @private
    #
    _encode: ()->
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


