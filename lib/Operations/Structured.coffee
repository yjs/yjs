basic_ops_uninitialized = require "./Basic"
RBTReeByIndex = require 'bintrees/lib/rbtree_by_index'

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


      # The short tree is storing the non deleted operations
      @shortTree = new RBTreeByIndex()
      # The complete tree is storing all the operations
      @completeTree = new RBTreeByIndex()

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

    # get the next non-deleted operation
    getNextNonDeleted: (start)->
      if start.isDeleted() or not start.node?
        operation = start.next_cl
        while not ((operation instanceof ops.Delimiter))
          if operation.is_deleted
            operation = operation.next_cl
          else
            break
      else
        operation = start.node.next.node
        if not operation
          return false

      operation

    getPrevNonDeleted: (start) ->
      if start.isDeleted() or not start.node?
        operation = start.prev_cl
        while not ((operation instanceof ops.Delimiter))
          if operation.is_deleted
            operation = operation.prev_cl
          else
            break
      else
        operation = start.node.prev.node
        if not operation
          return false

      operation


    # Transforms the list to an array
    # Doesn't return left-right delimiter.
    toArray: ()->
      @shortTree.map (operation) ->
        operation.val()

    map: (fun)->
      @shortTree.map fun

    fold: (init, fun)->
      @shortTree.map (operation) ->
        init = fun(init, operation)

    val: (pos)->
      if pos?
        @shortTree.find(pos).val()
      else
        @toArray()

    ref: (pos)->
      if pos?
        @shortTree.find(pos)
      else
        @shortTree.map (operation) ->
          operation

    #
    # Retrieves the x-th not deleted element.
    # e.g. "abc" : the 1th character is "a"
    # the 0th character is the left Delimiter
    #
    getOperationByPosition: (position)->
      if position == 0
        @beginning
      else if position == @shortTree.size + 1
        @end
      else
        @shortTree.find (position-1)

    push: (content)->
      @insertAfter @end.prev_cl, [content]

    insertAfterHelper: (root, content)->
      if !root.right
        root.bt.right = content
        content.bt.parent = root
      else
        right = root.next_cl


    insertAfter: (left, contents)->
      if left is @beginning
        leftNode = null
        rightNode = @shortTree.findNode 0
        right = if rightNode then rightNode.data else @end
      else
        # left.node should always exist (insert after a non-deleted element)
        rightNode = left.node.next
        leftNode = left.node
        right = if rightNode then rightNode.data else @end

      left = right.prev_cl

      # TODO: always expect an array as content. Then you can combine this with the other option (else)
      if contents instanceof ops.Operation
        tmp = new ops.Insert null, content, null, undefined, undefined, left, right
        tmp.execute()
      else
        for c in contents
          if c? and c._name? and c._getModel?
            c = c._getModel(@custom_types, @operations)
          tmp = new ops.Insert null, c, null, undefined, undefined, left, right
          tmp.execute()
          leftNode = tmp.node

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
    deleteRef: (operation, length = 1, dir = 'right') ->
      nextOperation = (operation) =>
        if dir == 'right' then @getNextNonDeleted operation else @getPrevNonDeleted operation

      for i in [0...length]
        if operation instanceof ops.Delimiter
          break
        deleteOperation = (new ops.Delete null, undefined, operation).execute()

        operation = nextOperation operation
      @

    delete: (position, length = 1)->
      operation = @getOperationByPosition(position+length) # position 0 in this case is the deletion of the first character

      @deleteRef operation, length, 'left'


    callOperationSpecificInsertEvents: (operation)->
      prev = (@getPrevNonDeleted operation) or @beginning
      prevNode = if prev then prev.node else null

      next = (@getNextNonDeleted operation) or @end
      nextNode = if next then next.node else null
      operation.node = operation.node or (@shortTree.insert_between prevNode, nextNode, operation)
      operation.completeNode = operation.completeNode or (@completeTree.insert_between operation.prev_cl.completeNode, operation.next_cl.completeNode, operation)

      getContentType = (content)->
        if content instanceof ops.Operation
          content.getCustomType()
        else
          content

      @callEvent [
        type: "insert"
        reference: operation
        position: operation.node.position()
        object: @getCustomType()
        changedBy: operation.uid.creator
        value: getContentType operation.val()
      ]

    callOperationSpecificDeleteEvents: (operation, del_op)->
      if operation.node
        position = operation.node.position()
        @shortTree.remove_node operation.node
        operation.node = null

      @callEvent [
        type: "delete"
        reference: operation
        position: position
        object: @getCustomType() # TODO: You can combine getPosition + getParent in a more efficient manner! (only left Delimiter will hold @parent)
        length: 1
        changedBy: del_op.uid.creator
        oldValue: operation.val()
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
    callOperationSpecificInsertEvents: (operation)->
      if @tmp_composition_ref?
        if operation.uid.creator is @tmp_composition_ref.creator and operation.uid.op_number is @tmp_composition_ref.op_number
          @composition_ref = operation
          delete @tmp_composition_ref
          operation = operation.next_cl
          if operation is @end
            return
        else
          return

      o = @end.prev_cl
      while o isnt operation
        @getCustomType()._unapply o.undo_delta
        o = o.prev_cl
      while o isnt @end
        o.undo_delta = @getCustomType()._apply o.val()
        o = o.next_cl
      @composition_ref = @end.prev_cl

      @callEvent [
        type: "update"
        changedBy: operation.uid.creator
        newValue: @val()
      ]

    callOperationSpecificDeleteEvents: (operation, del_op)->
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
    callOperationSpecificInsertEvents: (operation)->
      if operation.next_cl.type is "Delimiter" and operation.prev_cl.type isnt "Delimiter"
        # this replaces another Replaceable
        if not operation.is_deleted # When this is received from the HB, this could already be deleted!
          old_value = operation.prev_cl.val()
          @callEventDecorator [
            type: "update"
            changedBy: operation.uid.creator
            oldValue: old_value
          ]
        operation.prev_cl.applyDelete()
      else if operation.next_cl.type isnt "Delimiter"
        # This won't be recognized by the user, because another
        # concurrent operation is set as the current value of the RM
        operation.applyDelete()
      else # prev _and_ next are Delimiters. This is the first created Replaceable in the RM
        @callEventDecorator [
          type: "add"
          changedBy: operation.uid.creator
        ]
      undefined

    callOperationSpecificDeleteEvents: (operation, del_op)->
      if operation.next_cl.type is "Delimiter"
        @callEventDecorator [
          type: "delete"
          changedBy: del_op.uid.creator
          oldValue: operation.val()
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
