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
      if content?.creator
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

    toJson: (transform_to_value = false)->
      val = @val()
      for i, o in val
        if o instanceof types.Object
          o.toJson(transform_to_value)
        else if o instanceof types.Array
          o.toJson(transform_to_value)
        else if transform_to_value and o instanceof types.Operation
          o.val()
        else
          o

    val: (pos)->
      if pos?
        o = @getOperationByPosition(pos+1)
        if not (o instanceof types.Delimiter)
          o.val()
        else
          throw new Error "this position does not exist"
      else
        o = @beginning.next_cl
        result = []
        while o isnt @end
          if not o.isDeleted()
            result.push o.val()
          o = o.next_cl
        result

    push: (content)->
      @insertAfter @end.prev_cl, content

    insertAfter: (left, content, options)->
      createContent = (content, options)->
        if content? and content.constructor?
          type = types[content.constructor.name]
          if type? and type.create?
            type.create content, options
          else
            throw new Error "The #{content.constructor.name}-type is not (yet) supported in Y."
        else
          content

      right = left.next_cl
      while right.isDeleted()
        right = right.next_cl # find the first character to the right, that is not deleted. In the case that position is 0, its the Delimiter.
      left = right.prev_cl

      if content instanceof types.Operation
        (new types.TextInsert content, undefined, left, right).execute()
      else
        for c in content
          tmp = (new types.TextInsert createContent(c, options), undefined, left, right).execute()
          left = tmp
      @

    #
    # Inserts a string into the word.
    #
    # @return {Array Type} This String object.
    #
    insert: (position, content, options)->
      ith = @getOperationByPosition position
      # the (i-1)th character. e.g. "abc" the 1th character is "a"
      # the 0th character is the left Delimiter
      @insertAfter ith, [content], options

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
        while (not (o instanceof types.Delimiter)) and o.isDeleted()
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
      ith = list.getOperationByPosition 0
      list.insertAfter ith, content
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
    #   var x = y.val('unknown')
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
    # Inserts a string into the word.
    #
    # @return {Array Type} This String object.
    #
    insert: (position, content, options)->
      ith = @getOperationByPosition position
      # the (i-1)th character. e.g. "abc" the 1th character is "a"
      # the 0th character is the left Delimiter
      @insertAfter ith, content, options

    #
    # Bind this String to a textfield or input field.
    #
    # @example
    #   var textbox = document.getElementById("textfield");
    #   y.bind(textbox);
    #
    bind: (textfield, dom_root)->
      dom_root ?= window
      if (not dom_root.getSelection?)
        dom_root = window

      # don't duplicate!
      for t in @textfields
        if t is textfield
          return
      creator_token = false;

      word = @
      textfield.value = @val()
      @textfields.push textfield

      if textfield.selectionStart? and textfield.setSelectionRange?
        createRange = (fix)->
          left = textfield.selectionStart
          right = textfield.selectionEnd
          if fix?
            left = fix left
            right = fix right
          {
            left: left
            right: right
          }

        writeRange = (range)->
          writeContent word.val()
          textfield.setSelectionRange range.left, range.right

        writeContent = (content)->
          textfield.value = content
      else
        createRange = (fix)->
          range = {}
          s = dom_root.getSelection()
          clength = textfield.textContent.length
          range.left = Math.min s.anchorOffset, clength
          range.right = Math.min s.focusOffset, clength
          if fix?
            range.left = fix range.left
            range.right = fix range.right

          edited_element = s.focusNode
          if edited_element is textfield or edited_element is textfield.childNodes[0]
            range.isReal = true
          else
            range.isReal = false
          range

        writeRange = (range)->
          writeContent word.val()
          textnode = textfield.childNodes[0]
          if range.isReal and textnode?
            if range.left < 0
              range.left = 0
            range.right = Math.max range.left, range.right
            if range.right > textnode.length
              range.right = textnode.length
            range.left = Math.min range.left, range.right
            r = document.createRange()
            r.setStart(textnode, range.left)
            r.setEnd(textnode, range.right)
            s = window.getSelection()
            s.removeAllRanges()
            s.addRange(r)
        writeContent = (content)->
          append = ""
          if content[content.length - 1] is " "
            content = content.slice(0,content.length-1)
            append = '&nbsp;'
          textfield.textContent = content
          textfield.innerHTML += append

      writeContent this.val()

      @observe (events)->
        for event in events
          if not creator_token
            if event.type is "insert"
              o_pos = event.position
              fix = (cursor)->
                if cursor <= o_pos
                  cursor
                else
                  cursor += 1
                  cursor
              r = createRange fix
              writeRange r

            else if event.type is "delete"
              o_pos = event.position
              fix = (cursor)->
                if cursor < o_pos
                  cursor
                else
                  cursor -= 1
                  cursor
              r = createRange fix
              writeRange r

      # consume all text-insert changes.
      textfield.onkeypress = (event)->
        if word.is_deleted
          # if word is deleted, do not do anything ever again
          textfield.onkeypress = null
          return true
        creator_token = true
        char = null
        if event.key?
          if event.charCode is 32
            char = " "
          else if event.keyCode is 13
            char = '\n'
          else
            char = event.key
        else
          char = window.String.fromCharCode event.keyCode
        if char.length > 1
          return true
        else if char.length > 0
          r = createRange()
          pos = Math.min r.left, r.right
          diff = Math.abs(r.right - r.left)
          word.delete pos, diff
          word.insert pos, char
          r.left = pos + char.length
          r.right = r.left
          writeRange r

        event.preventDefault()
        creator_token = false
        false

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
        creator_token = true
        if word.is_deleted
          # if word is deleted, do not do anything ever again
          textfield.onkeydown = null
          return true
        r = createRange()
        pos = Math.min(r.left, r.right, word.val().length)
        diff = Math.abs(r.left - r.right)
        if event.keyCode? and event.keyCode is 8 # Backspace
          if diff > 0
            word.delete pos, diff
            r.left = pos
            r.right = pos
            writeRange r
          else
            if event.ctrlKey? and event.ctrlKey
              val = word.val()
              new_pos = pos
              del_length = 0
              if pos > 0
                new_pos--
                del_length++
              while new_pos > 0 and val[new_pos] isnt " " and val[new_pos] isnt '\n'
                new_pos--
                del_length++
              word.delete new_pos, (pos-new_pos)
              r.left = new_pos
              r.right = new_pos
              writeRange r
            else
              if pos > 0
                word.delete (pos-1), 1
                r.left = pos-1
                r.right = pos-1
                writeRange r
          event.preventDefault()
          creator_token = false
          return false
        else if event.keyCode? and event.keyCode is 46 # Delete
          if diff > 0
            word.delete pos, diff
            r.left = pos
            r.right = pos
            writeRange r
          else
            word.delete pos, 1
            r.left = pos
            r.right = pos
            writeRange r
          event.preventDefault()
          creator_token = false
          return false
        else
          creator_token = false
          true

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


