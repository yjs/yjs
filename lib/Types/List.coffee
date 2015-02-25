class YList

  #
  # @private
  # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
  #
  constructor: (list)->
    if not list?
      @_list = []
    else if list.constructor is Array
      @_list = list
    else
      throw new Error "Y.List expects an Array as a parameter"

  _name: "List"

  _getModel: (types, ops)->
    if not @_model?
      @_model = new ops.ListManager(@).execute()
      @_model.insert 0, @_list
    delete @_list
    @_model

  _setModel: (@_model)->
    delete @_list

  val: ()->
    @_model.val.apply @_model, arguments

  observe: ()->
    @_model.observe.apply @_model, arguments
    @

  unobserve: ()->
    @_model.unobserve.apply @_model, arguments
    @

  #
  # Inserts an Object into the list.
  #
  # @return {ListManager Type} This String object.
  #
  insert: (position, content)->
    if typeof position isnt "number"
      throw new Error "Y.List.insert expects a Number as the first parameter!"
    @_model.insert position, [content]
    @

  insertContents: (position, contents)->
    if typeof position isnt "number"
      throw new Error "Y.List.insert expects a Number as the first parameter!"
    @_model.insert position, contents
    @

  delete: (position, length)->
    @_model.delete position, length
    @

  push: (content)->
    @_model.push content
    @

if window?
  if window.Y?
    window.Y.List = YList
  else
    throw new Error "You must first import Y!"

if module?
  module.exports = YList










