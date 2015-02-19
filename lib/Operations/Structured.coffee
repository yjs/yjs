basic_ops_uninitialized = require "./Basic"

module.exports = ()->
  basic_ops = basic_ops_uninitialized()
  ops = basic_ops.operations

  #
  # @nodoc
  # Manages map like objects. E.g. Json-Type and XML attributes.
  #
  class ops.MapManager extends ops.Operation

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (uid)->
      @map = {}
      super uid

    type: "MapManager"

    applyDelete: ()->
      for name,p of @map
        p.applyDelete()
      super()

    cleanup: ()->
      super()

    #
    # @see JsonOperations.val
    #
    val: (name, content)->
      if arguments.length > 1
        @retrieveSub(name).replace content
        @
      else if name?
        prop = @map[name]
        if prop? and not prop.isContentDeleted()
          prop.val()
        else
          undefined
      else
        result = {}
        for name,o of @map
          if not o.isContentDeleted()
            result[name] = o.val()
        result

    delete: (name)->
      @map[name]?.deleteContent()
      @

    retrieveSub: (property_name)->
      if not @map[property_name]?
        event_properties =
          name: property_name
        event_this = @
        rm_uid =
          noOperation: true
          sub: property_name
          alt: @
        rm = new ops.ReplaceManager event_properties, event_this, rm_uid # this operation shall not be saved in the HB
        @map[property_name] = rm
        rm.setParent @, property_name
        rm.execute()
      @map[property_name]

  #
  # @nodoc
  # Manages a list of Insert-type operations.
  #
  class ops.ListManager extends ops.Operation

    #
    # A ListManager maintains a non-empty list that has a beginning and an end (both Delimiters!)
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (uid)->
      @beginning = new ops.Delimiter undefined, undefined
      @end =       new ops.Delimiter @beginning, undefined
      @beginning.next_cl = @end
      @beginning.execute()
      @end.execute()
      super uid

    type: "ListManager"

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
        if o instanceof ops.Object
          o.toJson(transform_to_value)
        else if o instanceof ops.ListManager
          o.toJson(transform_to_value)
        else if transform_to_value and o instanceof ops.Operation
          o.val()
        else
          o

    #
    # @private
    # @see Operation.execute
    #
    execute: ()->
      if @validateSavedOperations()
        @beginning.setParent @
        @end.setParent @
        super
      else
        false

    # Get the element previous to the delemiter at the end
    getLastOperation: ()->
      @end.prev_cl

    # similar to the above
    getFirstOperation: ()->
      @beginning.next_cl

    # Transforms the the list to an array
    # Doesn't return left-right delimiter.
    toArray: ()->
      o = @beginning.next_cl
      result = []
      while o isnt @end
        if not o.is_deleted
          result.push o
        o = o.next_cl
      result

    map: (f)->
      o = @beginning.next_cl
      result = []
      while o isnt @end
        if not o.is_deleted
          result.push f(o)
        o = o.next_cl
      result

    fold: (init, f)->
      o = @beginning.next_cl
      while o isnt @end
        if not o.is_deleted
          init = f(init, o)
        o = o.next_cl
      init

    val: (pos)->
      if pos?
        o = @getOperationByPosition(pos+1)
        if not (o instanceof ops.Delimiter)
          o.val()
        else
          throw new Error "this position does not exist"
      else
        @toArray()


    #
    # Retrieves the x-th not deleted element.
    # e.g. "abc" : the 1th character is "a"
    # the 0th character is the left Delimiter
    #
    getOperationByPosition: (position)->
      o = @beginning
      while true
        # find the i-th op
        if o instanceof ops.Delimiter and o.prev_cl?
          # the user or you gave a position parameter that is to big
          # for the current array. Therefore we reach a Delimiter.
          # Then, we'll just return the last character.
          o = o.prev_cl
          while o.isDeleted() and o.prev_cl?
            o = o.prev_cl
          break
        if position <= 0 and not o.isDeleted()
          break

        o = o.next_cl
        if not o.isDeleted()
          position -= 1
      o

    push: (content)->
      @insertAfter @end.prev_cl, content

    insertAfter: (left, content, options)->
      createContent = (content, options)->
        if content? and content.constructor?
          type = ops[content.constructor.name]
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

      if content instanceof ops.Operation
        (new ops.Insert content, undefined, left, right).execute()
      else
        for c in content
          tmp = (new ops.Insert createContent(c, options), undefined, left, right).execute()
          left = tmp
      @

    #
    # Inserts a string into the word.
    #
    # @return {ListManager Type} This String object.
    #
    insert: (position, content, options)->
      ith = @getOperationByPosition position
      # the (i-1)th character. e.g. "abc" the 1th character is "a"
      # the 0th character is the left Delimiter
      @insertAfter ith, [content], options

    #
    # Deletes a part of the word.
    #
    # @return {ListManager Type} This String object
    #
    delete: (position, length)->
      o = @getOperationByPosition(position+1) # position 0 in this case is the deletion of the first character

      delete_ops = []
      for i in [0...length]
        if o instanceof ops.Delimiter
          break
        d = (new ops.Delete undefined, o).execute()
        o = o.next_cl
        while (not (o instanceof ops.Delimiter)) and o.isDeleted()
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

  ops.ListManager.parse = (json)->
    {
      'uid' : uid
    } = json
    new this(uid)

  ops.Array = ()->
  ops.Array.create = (content, mutable)->
      if (mutable is "mutable")
        list = new ops.ListManager().execute()
        ith = list.getOperationByPosition 0
        list.insertAfter ith, content
        list
      else if (not mutable?) or (mutable is "immutable")
        content
      else
        throw new Error "Specify either \"mutable\" or \"immutable\"!!"


  #
  # @nodoc
  # Adds support for replace. The ReplaceManager manages Replaceable operations.
  # Each Replaceable holds a value that is now replaceable.
  #
  # The TextType-type has implemented support for replace
  # @see TextType
  #
  class ops.ReplaceManager extends ops.ListManager
    #
    # @param {Object} event_properties Decorates the event that is thrown by the RM
    # @param {Object} event_this The object on which the event shall be executed
    # @param {Operation} initial_content Initialize this with a Replaceable that holds the initial_content.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (@event_properties, @event_this, uid, beginning, end)->
      if not @event_properties['object']?
        @event_properties['object'] = @event_this
      super uid, beginning, end

    type: "ReplaceManager"

    applyDelete: ()->
      o = @beginning
      while o?
        o.applyDelete()
        o = o.next_cl
      super()

    cleanup: ()->
      super()

    #
    # This doesn't throw the same events as the ListManager. Therefore, the
    # Replaceables also not throw the same events.
    # So, ReplaceManager and ListManager both implement
    # these functions that are called when an Insertion is executed (at the end).
    #
    #
    callEventDecorator: (events)->
      if not @isDeleted()
        for event in events
          for name,prop of @event_properties
            event[name] = prop
        @event_this.callEvent events
      undefined

    #
    # Replace the existing word with a new word.
    #
    # @param content {Operation} The new value of this ReplaceManager.
    # @param replaceable_uid {UID} Optional: Unique id of the Replaceable that is created
    #
    replace: (content, replaceable_uid)->
      o = @getLastOperation()
      relp = (new ops.Replaceable content, @, replaceable_uid, o, o.next_cl).execute()
      # TODO: delete repl (for debugging)
      undefined

    isContentDeleted: ()->
      @getLastOperation().isDeleted()

    deleteContent: ()->
      (new ops.Delete undefined, @getLastOperation().uid).execute()
      undefined

    #
    # Get the value of this
    # @return {String}
    #
    val: ()->
      o = @getLastOperation()
      #if o instanceof ops.Delimiter
        # throw new Error "Replace Manager doesn't contain anything."
      o.val?() # ? - for the case that (currently) the RM does not contain anything (then o is a Delimiter)

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
      json =
        {
          'type': @type
          'uid' : @getUid()
          'beginning' : @beginning.getUid()
          'end' : @end.getUid()
        }
      json

  #
  # @nodoc
  # The ReplaceManager manages Replaceables.
  # @see ReplaceManager
  #
  class ops.Replaceable extends ops.Insert

    #
    # @param {Operation} content The value that this Replaceable holds.
    # @param {ReplaceManager} parent Used to replace this Replaceable with another one.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (content, parent, uid, prev, next, origin, is_deleted)->
      @saveOperation 'parent', parent
      super content, uid, prev, next, origin # Parent is already saved by Replaceable
      @is_deleted = is_deleted

    type: "Replaceable"

    #
    # Return the content that this operation holds.
    #
    val: ()->
      @content

    applyDelete: ()->
      res = super
      if @content?
        if @next_cl.type isnt "Delimiter"
          @content.deleteAllObservers?()
        @content.applyDelete?()
        @content.dontSync?()
      @content = null
      res

    cleanup: ()->
      super

    #
    # This is called, when the Insert-type was successfully executed.
    # TODO: consider doing this in a more consistent manner. This could also be
    # done with execute. But currently, there are no specital Insert-ops for ListManager.
    #
    callOperationSpecificInsertEvents: ()->
      if @next_cl.type is "Delimiter" and @prev_cl.type isnt "Delimiter"
        # this replaces another Replaceable
        if not @is_deleted # When this is received from the HB, this could already be deleted!
          old_value = @prev_cl.content
          @parent.callEventDecorator [
            type: "update"
            changedBy: @uid.creator
            oldValue: old_value
          ]
        @prev_cl.applyDelete()
      else if @next_cl.type isnt "Delimiter"
        # This won't be recognized by the user, because another
        # concurrent operation is set as the current value of the RM
        @applyDelete()
      else # prev _and_ next are Delimiters. This is the first created Replaceable in the RM
        @parent.callEventDecorator [
          type: "add"
          changedBy: @uid.creator
        ]
      undefined

    callOperationSpecificDeleteEvents: (o)->
      if @next_cl.type is "Delimiter"
        @parent.callEventDecorator [
          type: "delete"
          changedBy: o.uid.creator
          oldValue: @content
        ]

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
      json =
        {
          'type': @type
          'parent' : @parent.getUid()
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
          'uid' : @getUid()
          'is_deleted': @is_deleted
        }
      if @origin.type is "Delimiter"
        json.origin = "Delimiter"
      else if @origin isnt @prev_cl
        json.origin = @origin.getUid()

      if @content instanceof ops.Operation
        json['content'] = @content.getUid()
      else
        # This could be a security concern.
        # Throw error if the users wants to trick us
        if @content? and @content.creator?
          throw new Error "You must not set creator here!"
        json['content'] = @content
      json

  ops.Replaceable.parse = (json)->
    {
      'content' : content
      'parent' : parent
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
      'is_deleted': is_deleted
    } = json
    new this(content, parent, uid, prev, next, origin, is_deleted)


  basic_ops






