structured_types_uninitialized = require "./StructuredTypes"

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
    #
    # @param {String} content The content of this Insert-type Operation. Usually you restrict the length of content to size 1
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
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
    _encode: ()->
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

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (uid, beginning, end, prev, next, origin)->
      super uid, beginning, end, prev, next, origin

    #
    # Inserts a string into the word
    #
    insertText: (position, content)->
      o = @getOperationByPosition position
      for c in content
        op = new TextInsert c, undefined, o.prev_cl, o
        HB.addOperation(op).execute()

    #
    # Deletes a part of the word.
    #
    deleteText: (position, length)->
      o = @getOperationByPosition position

      delete_ops = []
      for i in [0...length]
        d = HB.addOperation(new TextDelete undefined, o).execute()
        o = o.next_cl
        while o.isDeleted() and not (o instanceof types.Delimiter)
          if o instanceof types.Delimiter
            throw new Error "You can't delete more than there is.."
          o = o.next_cl
        delete_ops.push d._encode()
        if o instanceof types.Delimiter
          break


    #
    # Replace the content of this word with another one. Concurrent replacements are not merged!
    # Only one of the replacements will be used.
    #
    # Can only be used if the ReplaceManager was set!
    # @see Word.setReplaceManager
    #
    replaceText: (text)->
      if @replace_manager?
        word = HB.addOperation(new Word undefined).execute()
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

    #
    # Bind this Word to a textfield.
    # TODO:
    #   insert_pressing+mouse new position
    #   concurrent pressing (two user pressing stuff)
    bind: (textfield)->
      word = @
      textfield.value = @val()
      position_start = null
      document_length = null

      @on "insert", (event, op)->
        if op.creator isnt HB.getUserId()
          o_pos = op.getPosition()
          fix = (cursor)->
            if cursor <= o_pos
              cursor
            else
              cursor += 1
              cursor
          left = fix textfield.selectionStart
          right = fix textfield.selectionEnd
          if position_start?
            document_length += 1
            position_start = fix position_start

          textfield.value = word.val()
          textfield.setSelectionRange left, right


      @on "delete", (event, op)->
        if op.creator isnt HB.getUserId()
          o_pos = op.getPosition()
          fix = (cursor)->
            if cursor <= o_pos
              cursor
            else
              cursor -= 1
              cursor
          left = fix textfield.selectionStart
          right = fix textfield.selectionEnd
          if position_start?
            document_length -= 1
            position_start = fix position_start

          textfield.value = word.val()
          textfield.setSelectionRange left, right


      update_yatta = ()->
        if position_start?
          document_length_diff = textfield.value.length - document_length
          current_position = Math.min textfield.selectionStart, textfield.selectionEnd
          if document_length_diff < 0 # deletion
            deletion_position = Math.min current_position, position_start
            word.deleteText deletion_position, Math.abs document_length_diff
          else if document_length_diff > 0 # insertion
            text_insert = textfield.value.substring position_start, (position_start + document_length_diff)
            word.insertText position_start, text_insert

          position_start = null
          document_length = null

      textfield.onkeydown = (event)->
        #console.log "down"
        if position_start?
          update_yatta()

        selection_range = Math.abs(textfield.selectionEnd - textfield.selectionStart)
        position_start = Math.min(textfield.selectionStart, textfield.selectionEnd)
        word.deleteText position_start, selection_range
        document_length = textfield.value.length - selection_range

      textfield.onkeyup = (event)->
        #console.log "up"
        update_yatta()
    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
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
    new Word uid, beginning, end, prev, next, origin

  types['TextInsert'] = TextInsert
  types['TextDelete'] = TextDelete
  types['Word'] = Word
  structured_types


