structured_types_uninitialized = require "./StructuredTypes"

module.exports = (HB)->
  structured_types = structured_types_uninitialized HB
  types = structured_types.types
  parser = structured_types.parser

  #
  # @nodoc
  # Extends the basic Insert type to an operation that holds a text value
  #
  class types.TextInsert extends types.Insert
    #
    # @param {String} content The content of this Insert-type Operation. Usually you restrict the length of content to size 1
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (content, uid, prev, next, origin, parent)->
      if content?.uid?.creator
        @saveOperation 'content', content
      else
        @content = content
      super uid, prev, next, origin, parent

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
          'type': @type
          'uid' : @getUid()
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
          'origin': @origin.getUid()
          'parent': @parent.getUid()
        }

      if @content?.getUid?
        json['content'] = @content.getUid()
      else
        json['content'] = @content
      json

  types.TextInsert.parse = (json)->
    {
      'content' : content
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
      'parent' : parent
    } = json
    new types.TextInsert content, uid, prev, next, origin, parent


  class types.Array extends types.ListManager

    type: "Array"

    applyDelete: ()->
      o = @end
      while o?
        o.applyDelete()
        o = o.prev_cl
      super()

    cleanup: ()->
      super()

    val: ()->
      o = @beginning.next_cl
      result = []
      while o isnt @end
        result.push o.val()
        o = o.next_cl
      result

    push: (content)->
      @insertAfter @end.prev_cl, content

    insertAfter: (left, content)->
      right = left.next_cl
      while right.isDeleted()
        right = right.next_cl # find the first character to the right, that is not deleted. In the case that position is 0, its the Delimiter.
      left = right.prev_cl
      if content.type?
        (new types.TextInsert content, undefined, left, right).execute()
      else
        for c in content
          tmp = (new types.TextInsert c, undefined, left, right).execute()
          left = tmp
      @

    #
    # Inserts a string into the word.
    #
    # @return {Array Type} This String object.
    #
    insert: (position, content)->
      ith = @getOperationByPosition position
      # the (i-1)th character. e.g. "abc" the 1th character is "a"
      # the 0th character is the left Delimiter
      @insertAfter ith, content

    #
    # Deletes a part of the word.
    #
    # @return {Array Type} This String object
    #
    delete: (position, length)->
      o = @getOperationByPosition(position+1) # position 0 in this case is the deletion of the first character

      delete_ops = []
      for i in [0...length]
        if o instanceof types.Delimiter
          break
        d = (new types.Delete undefined, o).execute()
        o = o.next_cl
        while not (o instanceof types.Delimiter) and o.isDeleted()
          o = o.next_cl
        delete_ops.push d._encode()
      @

    #
    # @private
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
      json = {
        'type': @type
        'uid' : @getUid()
      }
      json

  types.Array.parse = (json)->
    {
      'uid' : uid
    } = json
    new this(uid)

  types.Array.create = (content, mutable)->
    if (mutable is "mutable")
      list = new types.Array().execute()
      list.insert 0, content
      list
    else if (not mutable?) or (mutable is "immutable")
      content
    else
      throw new Error "Specify either \"mutable\" or \"immutable\"!!"

  #
  # Handles a String-like data structures with support for insert/delete at a word-position.
  # @note Currently, only Text is supported!
  #
  class types.String extends types.Array

    #
    # @private
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (uid)->
      @textfields = []
      super uid

    #
    # Identifies this class.
    # Use it to check whether this is a word-type or something else.
    #
    # @example
    #   var x = yatta.val('unknown')
    #   if (x.type === "String") {
    #     console.log JSON.stringify(x.toJson())
    #   }
    #
    type: "String"

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
    # Same as String.val
    # @see String.val
    #
    toString: ()->
      @val()

    #
    # Bind this String to a textfield or input field.
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
        if word.is_deleted
          # if word is deleted, do not do anything ever again
          textfield.onkeypress = null
          return true
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
          word.delete (pos), diff
          word.insert pos, char
          new_pos = pos + char.length
          textfield.setSelectionRange new_pos, new_pos
          event.preventDefault()
        else
          event.preventDefault()

      textfield.onpaste = (event)->
        if word.is_deleted
          # if word is deleted, do not do anything ever again
          textfield.onpaste = null
          return true
        event.preventDefault()
      textfield.oncut = (event)->
        if word.is_deleted
          # if word is deleted, do not do anything ever again
          textfield.oncut = null
          return true
        event.preventDefault()

      #
      # consume deletes. Note that
      #   chrome: won't consume deletions on keypress event.
      #   keyCode is deprecated. BUT: I don't see another way.
      #     since event.key is not implemented in the current version of chrome.
      #     Every browser supports keyCode. Let's stick with it for now..
      #
      textfield.onkeydown = (event)->
        if word.is_deleted
          # if word is deleted, do not do anything ever again
          textfield.onkeydown = null
          return true
        pos = Math.min textfield.selectionStart, textfield.selectionEnd
        diff = Math.abs(textfield.selectionEnd - textfield.selectionStart)
        if event.keyCode? and event.keyCode is 8 # Backspace
          if diff > 0
            word.delete pos, diff
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
              word.delete new_pos, (pos-new_pos)
              textfield.setSelectionRange new_pos, new_pos
            else
              word.delete (pos-1), 1
          event.preventDefault()
        else if event.keyCode? and event.keyCode is 46 # Delete
          if diff > 0
            word.delete pos, diff
            textfield.setSelectionRange pos, pos
          else
            word.delete pos, 1
            textfield.setSelectionRange pos, pos
          event.preventDefault()

    #
    # @private
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
      json = {
        'type': @type
        'uid' : @getUid()
      }
      json

  types.String.parse = (json)->
    {
      'uid' : uid
    } = json
    new this(uid)

  types.String.create = (content, mutable)->
    if (mutable is "mutable")
      word = new types.String().execute()
      word.insert 0, content
      word
    else if (not mutable?) or (mutable is "immutable")
      content
    else
      throw new Error "Specify either \"mutable\" or \"immutable\"!!"


  structured_types


