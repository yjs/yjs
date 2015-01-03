structured_types_uninitialized = require "./StructuredTypes"

module.exports = (HB)->
  structured_types = structured_types_uninitialized HB
  types = structured_types.types
  parser = structured_types.parser

  #
  # @nodoc
  # At the moment TextDelete type equals the Delete type in BasicTypes.
  # @see BasicTypes.Delete
  #
  class TextDelete extends types.Delete
  parser["TextDelete"] = parser["Delete"]

  #
  # @nodoc
  # Extends the basic Insert type to an operation that holds a text value
  #
  class TextInsert extends types.Insert
    #
    # @param {String} content The content of this Insert-type Operation. Usually you restrict the length of content to size 1
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (content, uid, prev, next, origin)->
      if content?.uid?.creator
        @saveOperation 'content', content
      else
        @content = content
      if not (prev? and next?)
        throw new Error "You must define prev, and next for TextInsert-types!"
      super uid, prev, next, origin

    type: "TextInsert"

    #
    # Retrieve the effective length of the $content of this operation.
    #
    getLength: ()->
      if @isDeleted()
        0
      else
        @content.length

    applyDelete: ()->
      super # no braces indeed!
      if @content instanceof types.Operation
        @content.applyDelete()
      @content = null

    execute: ()->
      if not @validateSavedOperations()
        return false
      else
        if @content instanceof types.Operation
          @content.insert_parent = @
        super()

    #
    # The result will be concatenated with the results from the other insert operations
    # in order to retrieve the content of the engine.
    # @see HistoryBuffer.toExecutedArray
    #
    val: (current_position)->
      if @isDeleted() or not @content?
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
          'uid' : @getUid()
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
        }
      if @content?.getUid?
        json['content'] = @content.getUid()
      else
        json['content'] = @content
      if @origin isnt @prev_cl
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
  # Handles a WordType-like data structures with support for insertText/deleteText at a word-position.
  # @note Currently, only Text is supported!
  #
  class WordType extends types.ListManager

    #
    # @private
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (uid, beginning, end, prev, next, origin)->
      @textfields = []
      super uid, beginning, end, prev, next, origin

    #
    # Identifies this class.
    # Use it to check whether this is a word-type or something else.
    #
    # @example
    #   var x = yatta.val('unknown')
    #   if (x.type === "WordType") {
    #     console.log JSON.stringify(x.toJson())
    #   }
    #
    type: "WordType"

    applyDelete: ()->
      for textfield in @textfields
        textfield.onkeypress = null
        textfield.onpaste = null
        textfield.oncut = null
      o = @beginning
      while o?
        o.applyDelete()
        o = o.next_cl
      super()

    cleanup: ()->
      super()

    push: (content)->
      @insertAfter @end.prev_cl, content

    insertAfter: (left, content)->
      while left.isDeleted()
        left = left.prev_cl # find the first character to the left, that is not deleted. Case position is 0, its the Delimiter.
      right = left.next_cl
      if content.type?
        (new TextInsert content, undefined, left, right).execute()
      else
        for c in content
          tmp = (new TextInsert c, undefined, left, right).execute()
          left = tmp
      @
    #
    # Inserts a string into the word.
    #
    # @return {WordType} This WordType object.
    #
    insertText: (position, content)->
      ith = @getOperationByPosition position
      # the (i-1)th character. e.g. "abc" the 1th character is "a"
      # the 0th character is the left Delimiter
      @insertAfter ith, content

    #
    # Deletes a part of the word.
    #
    # @return {WordType} This WordType object
    #
    deleteText: (position, length)->
      o = @getOperationByPosition(position+1) # position 0 in this case is the deletion of the first character

      delete_ops = []
      for i in [0...length]
        if o instanceof types.Delimiter
          break
        d = (new TextDelete undefined, o).execute()
        o = o.next_cl
        while not (o instanceof types.Delimiter) and o.isDeleted()
          o = o.next_cl
        delete_ops.push d._encode()
      @

    #
    # Get the String-representation of this word.
    # @return {String} The String-representation of this object.
    #
    val: ()->
      c = for o in @toArray()
        if o.val?
          o.val()
        else
          ""
      c.join('')

    #
    # Same as WordType.val
    # @see WordType.val
    #
    toString: ()->
      @val()

    #
    # Bind this WordType to a textfield or input field.
    #
    # @example
    #   var textbox = document.getElementById("textfield");
    #   yatta.bind(textbox);
    #
    bind: (textfield)->
      word = @
      textfield.value = @val()
      @textfields.push textfield

      @observe (events)->
        for event in events
          if event.type is "insert"
            o_pos = event.position
            fix = (cursor)->
              if cursor <= o_pos
                cursor
              else
                cursor += 1
                cursor
            left = fix textfield.selectionStart
            right = fix textfield.selectionEnd

            textfield.value = word.val()
            textfield.setSelectionRange left, right
          else if event.type is "delete"
            o_pos = event.position
            fix = (cursor)->
              if cursor < o_pos
                cursor
              else
                cursor -= 1
                cursor
            left = fix textfield.selectionStart
            right = fix textfield.selectionEnd

            textfield.value = word.val()
            textfield.setSelectionRange left, right

      # consume all text-insert changes.
      textfield.onkeypress = (event)->
        char = null
        if event.key?
          if event.charCode is 32
            char = " "
          else if event.keyCode is 13
            char = '\n'
          else
            char = event.key
        else
          char = String.fromCharCode event.keyCode
        if char.length > 0
          pos = Math.min textfield.selectionStart, textfield.selectionEnd
          diff = Math.abs(textfield.selectionEnd - textfield.selectionStart)
          word.deleteText (pos), diff
          word.insertText pos, char
          new_pos = pos + char.length
          textfield.setSelectionRange new_pos, new_pos
          event.preventDefault()
        else
          event.preventDefault()

      textfield.onpaste = (event)->
        event.preventDefault()
      textfield.oncut = (event)->
        event.preventDefault()

      #
      # consume deletes. Note that
      #   chrome: won't consume deletions on keypress event.
      #   keyCode is deprecated. BUT: I don't see another way.
      #     since event.key is not implemented in the current version of chrome.
      #     Every browser supports keyCode. Let's stick with it for now..
      #
      textfield.onkeydown = (event)->
        pos = Math.min textfield.selectionStart, textfield.selectionEnd
        diff = Math.abs(textfield.selectionEnd - textfield.selectionStart)
        if event.keyCode? and event.keyCode is 8 # Backspace
          if diff > 0
            word.deleteText pos, diff
            textfield.setSelectionRange pos, pos
          else
            if event.ctrlKey? and event.ctrlKey
              val = textfield.value
              new_pos = pos
              del_length = 0
              if pos > 0
                new_pos--
                del_length++
              while new_pos > 0 and val[new_pos] isnt " " and val[new_pos] isnt '\n'
                new_pos--
                del_length++
              word.deleteText new_pos, (pos-new_pos)
              textfield.setSelectionRange new_pos, new_pos
            else
              word.deleteText (pos-1), 1
          event.preventDefault()
        else if event.keyCode? and event.keyCode is 46 # Delete
          if diff > 0
            word.deleteText pos, diff
            textfield.setSelectionRange pos, pos
          else
            word.deleteText pos, 1
            textfield.setSelectionRange pos, pos
          event.preventDefault()



    #
    # @private
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
      json = {
        'type': "WordType"
        'uid' : @getUid()
        'beginning' : @beginning.getUid()
        'end' : @end.getUid()
      }
      if @prev_cl?
        json['prev'] = @prev_cl.getUid()
      if @next_cl?
        json['next'] = @next_cl.getUid()
      if @origin? # and @origin isnt @prev_cl
        json["origin"] = @origin().getUid()
      json

  parser['WordType'] = (json)->
    {
      'uid' : uid
      'beginning' : beginning
      'end' : end
      'prev': prev
      'next': next
      'origin' : origin
    } = json
    new WordType uid, beginning, end, prev, next, origin

  types['TextInsert'] = TextInsert
  types['TextDelete'] = TextDelete
  types['WordType'] = WordType
  structured_types


