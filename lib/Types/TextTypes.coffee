structured_types_uninitialized = require "./StructuredTypes.coffee"

module.exports = (HB)->
  structured_types = structured_types_uninitialized HB
  types = structured_types.types
  parser = structured_types.parser

  #
  # At the moment TextDelete type equals the Delete type in BasicTypes.
  # @see BasicTypes.Delete
  #
  class TextDelete extends types.Delete
  parser["TextDelete"] = parser["Delete"]

  #
  #  Extends the basic Insert type to an operation that holds a text value
  #
  class TextInsert extends types.Insert
    constructor: (@content, uid, prev, next, origin)->
      if not (prev? and next?)
        throw new Error "You must define prev, and next for TextInsert-types!"
      super uid, prev, next, origin
    #
    # Retrieve the effective length of the $content of this operation.
    #
    getLength: ()->
      if @isDeleted()
        0
      else
        @content.length

    #
    # The result will be concatenated with the results from the other insert operations
    # in order to retrieve the content of the engine.
    # @see HistoryBuffer.toExecutedArray
    #
    val: (current_position)->
      if @isDeleted()
        ""
      else
        @content

    #
    # Convert all relevant information of this operation to the json-format.
    # This result can be send to other clients.
    #
    toJson: ()->
      json =
        {
          'type': "TextInsert"
          'content': @content
          'uid' : @getUid()
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
        }
      if @origin? and @origin isnt @prev_cl
        json["origin"] = @origin.getUid()
      json

  parser["TextInsert"] = (json)->
    {
      'content' : content
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
    } = json
    new TextInsert content, uid, prev, next, origin

  #
  # Handles a Text-like data structures with support for insertText/deleteText at a word-position.
  #
  class Word extends types.ListManager
    constructor: (uid, initial_content, beginning, end, prev, next, origin)->
      super uid, beginning, end, prev, next, origin
      if initial_content?
        @insertText 0, initial_content
    #
    # Inserts a string into the word
    #
    insertText: (position, content)->
      o = @getOperationByPosition position
      for c in content
        op = new TextInsert c, HB.getNextOperationIdentifier(), o.prev_cl, o
        HB.addOperation(op).execute()

    #
    # Deletes a part of the word.
    #
    deleteText: (position, length)->
      o = @getOperationByPosition position

      for i in [0...length]
        d = HB.addOperation(new TextDelete HB.getNextOperationIdentifier(), o).execute()
        o = o.next_cl
        while o.isDeleted()
          if o instanceof types.Delimiter
            throw new Error "You can't delete more than there is.."
          o = o.next_cl
        d.toJson()

    #
    # Replace the content of this word with another one. Concurrent replacements are not merged!
    # Only one of the replacements will be used.
    #
    # Can only be used if the ReplaceManager was set!
    # @see Word.setReplaceManager
    #
    replaceText: (text)->
      if @replace_manager?
        word = HB.addOperation(new Word HB.getNextOperationIdentifier()).execute()
        word.insertText 0, text
        @replace_manager.replace(word)
      else
        throw new Error "This type is currently not maintained by a ReplaceManager!"

    #
    # @returns [Json] A Json object.
    #
    val: ()->
      c = for o in @toArray()
        if o.val?
          o.val()
        else
          ""
      c.join('')

    #
    # In most cases you would embed a Word in a Replaceable, wich is handled by the ReplaceManager in order
    # to provide replace functionality.
    #
    setReplaceManager: (op)->
      @saveOperation 'replace_manager', op
      @validateSavedOperations

    toJson: ()->
      json = {
        'type': "Word"
        'uid' : @getUid()
        'beginning' : @beginning.getUid()
        'end' : @end.getUid()
      }
      if @prev_cl?
        json['prev'] = @prev_cl.getUid()
      if @next_cl?
        json['next'] = @next_cl.getUid()
      if @origin? and @origin isnt @prev_cl
        json["origin"] = @origin.getUid()
      json

  parser['Word'] = (json)->
    {
      'uid' : uid
      'beginning' : beginning
      'end' : end
      'prev': prev
      'next': next
      'origin' : origin
    } = json
    new Word uid, undefined, beginning, end, prev, next, origin

  types['TextInsert'] = TextInsert
  types['TextDelete'] = TextDelete
  types['Word'] = Word

  structured_types


