structured_ops_uninitialized = require "./Structured"

module.exports = ()->
  structured_ops = structured_ops_uninitialized()
  ops = structured_ops.operations

  #
  # Handles a String-like data structures with support for insert/delete at a word-position.
  # @note Currently, only Text is supported!
  #
  class ops.String extends ops.ListManager

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
      @fold "", (left, o)->
        left + o.val()

    #
    # Same as String.val
    # @see String.val
    #
    toString: ()->
      @val()

    #
    # Inserts a string into the word.
    #
    # @return {ListManager Type} This String object.
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
          content_array = content.replace(new RegExp("\n",'g')," ").split(" ")
          textfield.innerText = ""
          for c, i in content_array
            textfield.innerText += c
            if i isnt content_array.length-1
              textfield.innerHTML += '&nbsp;'

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
        if event.keyCode is 13
          char = '\n'
        else if event.key?
          if event.charCode is 32
            char = " "
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

  ops.String.parse = (json)->
    {
      'uid' : uid
    } = json
    new this(uid)

  ops.String.create = (content, mutable)->
    if (mutable is "mutable")
      word = new ops.String().execute()
      word.insert 0, content
      word
    else if (not mutable?) or (mutable is "immutable")
      content
    else
      throw new Error "Specify either \"mutable\" or \"immutable\"!!"


  structured_ops


