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
    constructor: (custom_type, uid, content, content_operations)->
      @_map = {}
      super custom_type, uid, content, content_operations

    type: "MapManager"

    applyDelete: ()->
      for name,p of @_map
        p.applyDelete()
      super()

    cleanup: ()->
      super()

    map: (f)->
      for n,v of @_map
        f(n,v)
      undefined

    #
    # @see JsonOperations.val
    #
    val: (name, content)->
      if arguments.length > 1
        if content? and content._getModel?
          rep = content._getModel(@custom_types, @operations)
        else
          rep = content
        @retrieveSub(name).replace rep
        @getCustomType()
      else if name?
        prop = @_map[name]
        if prop? and not prop.isContentDeleted()
          res = prop.val()
          if res instanceof ops.Operation
            res.getCustomType()
          else
            res
        else
          undefined
      else
        result = {}
        for name,o of @_map
          if not o.isContentDeleted()
            result[name] = o.val()
        result

    delete: (name)->
      @_map[name]?.deleteContent()
      @

    retrieveSub: (property_name)->
      if not @_map[property_name]?
        event_properties =
          name: property_name
        event_this = @
        rm_uid =
          noOperation: true
          sub: property_name
          alt: @
        rm = new ops.ReplaceManager null, event_properties, event_this, rm_uid # this operation shall not be saved in the HB
        @_map[property_name] = rm
        rm.setParent @, property_name
        rm.execute()
      @_map[property_name]

  ops.MapManager.parse = (json)->
    {
      'uid' : uid
      'custom_type' : custom_type
      'content' : content
      'content_operations' : content_operations
    } = json
    new this(custom_type, uid, content, content_operations)



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
    constructor: (custom_type, uid, content, content_operations)->
      @beginning = new ops.Delimiter undefined, undefined
      @end =       new ops.Delimiter @beginning, undefined
      @beginning.next_cl = @end
      @beginning.execute()
      @end.execute()
      super custom_type, uid, content, content_operations

    type: "ListManager"


    applyDelete: ()->
      o = @beginning
      while o?
        o.applyDelete()
        o = o.next_cl
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
          result.push o.val()
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

    ref: (pos)->
      if pos?
        o = @getOperationByPosition(pos+1)
        if not (o instanceof ops.Delimiter)
          o
        else
          null
          # throw new Error "this position does not exist"
      else
        throw new Error "you must specify a position parameter"

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
      @insertAfter @end.prev_cl, [content]

    insertAfter: (left, contents)->
      right = left.next_cl
      while right.isDeleted()
        right = right.next_cl # find the first character to the right, that is not deleted. In the case that position is 0, its the Delimiter.
      left = right.prev_cl

      # TODO: always expect an array as content. Then you can combine this with the other option (else)
      if contents instanceof ops.Operation
        (new ops.Insert null, content, null, undefined, undefined, left, right).execute()
      else
        for c in contents
          if c? and c._name? and c._getModel?
            c = c._getModel(@custom_types, @operations)
          tmp = (new ops.Insert null, c, null, undefined, undefined, left, right).execute()
          left = tmp
      @

    #
    # Inserts an array of content into this list.
    # @Note: This expects an array as content!
    #
    # @return {ListManager Type} This String object.
    #
    insert: (position, contents)->
      ith = @getOperationByPosition position
      # the (i-1)th character. e.g. "abc" the 1th character is "a"
      # the 0th character is the left Delimiter
      @insertAfter ith, contents

    #
    # Deletes a part of the word.
    #
    # @return {ListManager Type} This String object
    #
    delete: (position, length = 1)->
      o = @getOperationByPosition(position+1) # position 0 in this case is the deletion of the first character

      delete_ops = []
      for i in [0...length]
        if o instanceof ops.Delimiter
          break
        d = (new ops.Delete null, undefined, o).execute()
        o = o.next_cl
        while (not (o instanceof ops.Delimiter)) and o.isDeleted()
          o = o.next_cl
        delete_ops.push d._encode()
      @


    callOperationSpecificInsertEvents: (op)->
      getContentType = (content)->
        if content instanceof ops.Operation
          content.getCustomType()
        else
          content
      @callEvent [
        type: "insert"
        reference: op
        position: op.getPosition()
        object: @getCustomType()
        changedBy: op.uid.creator
        value: getContentType op.val()
      ]

    callOperationSpecificDeleteEvents: (op, del_op)->
      @callEvent [
        type: "delete"
        reference: op
        position: op.getPosition()
        object: @getCustomType() # TODO: You can combine getPosition + getParent in a more efficient manner! (only left Delimiter will hold @parent)
        length: 1
        changedBy: del_op.uid.creator
        oldValue: op.val()
      ]

  ops.ListManager.parse = (json)->
    {
      'uid' : uid
      'custom_type': custom_type
      'content' : content
      'content_operations' : content_operations
    } = json
    new this(custom_type, uid, content, content_operations)

  class ops.Composition extends ops.ListManager

    constructor: (custom_type, @_composition_value, composition_value_operations, uid, tmp_composition_ref)->
      # we can't use @seveOperation 'composition_ref', tmp_composition_ref here,
      # because then there is a "loop" (insertion refers to parent, refers to insertion..)
      # This is why we have to check in @callOperationSpecificInsertEvents until we find it
      super custom_type, uid
      if tmp_composition_ref?
        @tmp_composition_ref = tmp_composition_ref
      else
        @composition_ref = @end.prev_cl
      if composition_value_operations?
        @composition_value_operations = {}
        for n,o of composition_value_operations
          @saveOperation n, o, '_composition_value'

    type: "Composition"

    #
    # @private
    # @see Operation.execute
    #
    execute: ()->
      if @validateSavedOperations()
        @getCustomType()._setCompositionValue @_composition_value
        delete @_composition_value
        # check if tmp_composition_ref already exists
        if @tmp_composition_ref
          composition_ref = @HB.getOperation @tmp_composition_ref
          if composition_ref?
            delete @tmp_composition_ref
            @composition_ref = composition_ref
        super
      else
        false

    #
    # This is called, when the Insert-operation was successfully executed.
    #
    callOperationSpecificInsertEvents: (op)->
      if @tmp_composition_ref?
        if op.uid.creator is @tmp_composition_ref.creator and op.uid.op_number is @tmp_composition_ref.op_number
          @composition_ref = op
          delete @tmp_composition_ref
          op = op.next_cl
          if op is @end
            return
        else
          return

      o = @end.prev_cl
      while o isnt op
        @getCustomType()._unapply o.undo_delta
        o = o.prev_cl
      while o isnt @end
        o.undo_delta = @getCustomType()._apply o.val()
        o = o.next_cl
      @composition_ref = @end.prev_cl

      @callEvent [
        type: "update"
        changedBy: op.uid.creator
        newValue: @val()
      ]

    callOperationSpecificDeleteEvents: (op, del_op)->
      return

    #
    # Create a new Delta
    # - inserts new Content at the end of the list
    # - updates the composition_value
    # - updates the composition_ref
    #
    # @param delta The delta that is applied to the composition_value
    #
    applyDelta: (delta, operations)->
      (new ops.Insert null, delta, operations, @, null, @end.prev_cl, @end).execute()
      undefined

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: (json = {})->
      custom = @getCustomType()._getCompositionValue()
      json.composition_value = custom.composition_value
      if custom.composition_value_operations?
        json.composition_value_operations = {}
        for n,o of custom.composition_value_operations
          json.composition_value_operations[n] = o.getUid()
      if @composition_ref?
        json.composition_ref = @composition_ref.getUid()
      else
        json.composition_ref = @tmp_composition_ref
      super json

  ops.Composition.parse = (json)->
    {
      'uid' : uid
      'custom_type': custom_type
      'composition_value' : composition_value
      'composition_value_operations' : composition_value_operations
      'composition_ref' : composition_ref
    } = json
    new this(custom_type, composition_value, composition_value_operations, uid, composition_ref)


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
    constructor: (custom_type, @event_properties, @event_this, uid)->
      if not @event_properties['object']?
        @event_properties['object'] = @event_this.getCustomType()
      super custom_type, uid

    type: "ReplaceManager"

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
    # This is called, when the Insert-type was successfully executed.
    # TODO: consider doing this in a more consistent manner. This could also be
    # done with execute. But currently, there are no specital Insert-ops for ListManager.
    #
    callOperationSpecificInsertEvents: (op)->
      if op.next_cl.type is "Delimiter" and op.prev_cl.type isnt "Delimiter"
        # this replaces another Replaceable
        if not op.is_deleted # When this is received from the HB, this could already be deleted!
          old_value = op.prev_cl.val()
          @callEventDecorator [
            type: "update"
            changedBy: op.uid.creator
            oldValue: old_value
          ]
        op.prev_cl.applyDelete()
      else if op.next_cl.type isnt "Delimiter"
        # This won't be recognized by the user, because another
        # concurrent operation is set as the current value of the RM
        op.applyDelete()
      else # prev _and_ next are Delimiters. This is the first created Replaceable in the RM
        @callEventDecorator [
          type: "add"
          changedBy: op.uid.creator
        ]
      undefined

    callOperationSpecificDeleteEvents: (op, del_op)->
      if op.next_cl.type is "Delimiter"
        @callEventDecorator [
          type: "delete"
          changedBy: del_op.uid.creator
          oldValue: op.val()
        ]


    #
    # Replace the existing word with a new word.
    #
    # @param content {Operation} The new value of this ReplaceManager.
    # @param replaceable_uid {UID} Optional: Unique id of the Replaceable that is created
    #
    replace: (content, replaceable_uid)->
      o = @getLastOperation()
      relp = (new ops.Insert null, content, null, @, replaceable_uid, o, o.next_cl).execute()
      # TODO: delete repl (for debugging)
      undefined

    isContentDeleted: ()->
      @getLastOperation().isDeleted()

    deleteContent: ()->
      last_op = @getLastOperation()
      if (not last_op.isDeleted()) and last_op.type isnt "Delimiter"
        (new ops.Delete null, undefined, @getLastOperation().uid).execute()
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



  basic_ops
