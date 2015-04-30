
class YObject

  constructor: (@_object = {})->
    if @_object.constructor is Object
      for name, val of @_object
        if val.constructor is Object
          @_object[name] = new YObject(val)
    else
      throw new Error "Y.Object accepts Json Objects only"

  _name: "Object"

  _getModel: (types, ops)->
    if not @_model?
      @_model = new ops.MapManager(@).execute()
      for n,o of @_object
        @_model.val n, o
    delete @_object
    @_model

  _setModel: (@_model)->
    delete @_object

  observe: (f)->
    @_model.observe f
    @

  unobserve: (f)->
    @_model.unobserve f
    @

  #
  # @overload val()
  #   Get this as a Json object.
  #   @return [Json]
  #
  # @overload val(name)
  #   Get value of a property.
  #   @param {String} name Name of the object property.
  #   @return [*] Depends on the value of the property.
  #
  # @overload val(name, content)
  #   Set a new property.
  #   @param {String} name Name of the object property.
  #   @param {Object|String} content Content of the object property.
  #   @return [Object Type] This object. (supports chaining)
  #
  val: (name, content)->
    if @_model?
      @_model.val.apply @_model, arguments
    else
      if content?
        @_object[name] = content
      else if name?
        @_object[name]
      else
        res = {}
        for n,v of @_object
          res[n] = v
        res

  delete: (name)->
    @_model.delete(name)
    @

if window?
  if window.Y?
    window.Y.Object = YObject
  else
    throw new Error "You must first import Y!"

if module?
  module.exports = YObject
