module.exports = ()->
  # @see Engine.parse
  ops = {}
  execution_listener = []

  #
  # @private
  # @abstract
  # @nodoc
  # A generic interface to ops.
  #
  # An operation has the following methods:
  # * _encode: encodes an operation (needed only if instance of this operation is sent).
  # * execute: execute the effects of this operations. Good examples are Insert-type and AddName-type
  # * val: in the case that the operation holds a value
  #
  # Furthermore an encodable operation has a parser. We extend the parser object in order to parse encoded operations.
  #
  class ops.Operation

    #
    # @param {Object} uid A unique identifier.
    # If uid is undefined, a new uid will be created before at the end of the execution sequence
    #
    constructor: (custom_type, uid, content, content_operations)->
      if custom_type?
        @custom_type = custom_type
      @is_deleted = false
      @garbage_collected = false
      @event_listeners = [] # TODO: rename to observers or sth like that
      if uid?
        @uid = uid

      # see encode to see, why we are doing it this way
      if content is undefined
        # nop
      else if content? and content.creator?
        @saveOperation 'content', content
      else
        @content = content
      if content_operations?
        @content_operations = {}
        for name, op of content_operations
          @saveOperation name, op, 'content_operations'

    type: "Operation"

    getContent: (name)->
      if @content?
        if @content.getCustomType?
          @content.getCustomType()
        else if @content.constructor is Object
          if name?
            if @content[name]?
              @content[name]
            else
              @content_operations[name].getCustomType()
          else
            content = {}
            for n,v of @content
              content[n] = v
            if @content_operations?
              for n,v of @content_operations
                v = v.getCustomType()
                content[n] = v
            content
        else
          @content
      else
        @content

    retrieveSub: ()->
      throw new Error "sub properties are not enable on this operation type!"

    #
    # Add an event listener. It depends on the operation which events are supported.
    # @param {Function} f f is executed in case the event fires.
    #
    observe: (f)->
      @event_listeners.push f

    #
    # Deletes function from the observer list
    # @see Operation.observe
    #
    # @overload unobserve(event, f)
    #   @param f     {Function} The function that you want to delete
    unobserve: (f)->
      @event_listeners = @event_listeners.filter (g)->
        f isnt g

    #
    # Deletes all subscribed event listeners.
    # This should be called, e.g. after this has been replaced.
    # (Then only one replace event should fire. )
    # This is also called in the cleanup method.
    deleteAllObservers: ()->
      @event_listeners = []

    delete: ()->
      (new ops.Delete undefined, @).execute()
      null

    #
    # Fire an event.
    # TODO: Do something with timeouts. You don't want this to fire for every operation (e.g. insert).
    # TODO: do you need callEvent+forwardEvent? Only one suffices probably
    callEvent: ()->
      if @custom_type?
        callon = @getCustomType()
      else
        callon = @
      @forwardEvent callon, arguments...

    #
    # Fire an event and specify in which context the listener is called (set 'this').
    # TODO: do you need this ?
    forwardEvent: (op, args...)->
      for f in @event_listeners
        f.call op, args...

    isDeleted: ()->
      @is_deleted

    applyDelete: (garbagecollect = true)->
      if not @garbage_collected
        #console.log "applyDelete: #{@type}"
        @is_deleted = true
        if garbagecollect
          @garbage_collected = true
          @HB.addToGarbageCollector @

    cleanup: ()->
      #console.log "cleanup: #{@type}"
      @HB.removeOperation @
      @deleteAllObservers()

    #
    # Set the parent of this operation.
    #
    setParent: (@parent)->

    #
    # Get the parent of this operation.
    #
    getParent: ()->
      @parent

    #
    # Computes a unique identifier (uid) that identifies this operation.
    #
    getUid: ()->
      if not @uid.noOperation?
        @uid
      else
        if @uid.alt? # could be (safely) undefined
          map_uid = @uid.alt.cloneUid()
          map_uid.sub = @uid.sub
          map_uid
        else
          undefined

    cloneUid: ()->
      uid = {}
      for n,v of @getUid()
        uid[n] = v
      uid

    #
    # @private
    # If not already done, set the uid
    # Add this to the HB
    # Notify the all the listeners.
    #
    execute: ()->
      if @validateSavedOperations()
        @is_executed = true
        if not @uid?
          # When this operation was created without a uid, then set it here.
          # There is only one other place, where this can be done - before an Insertion
          # is executed (because we need the creator_id)
          @uid = @HB.getNextOperationIdentifier()
        if not @uid.noOperation?
          @HB.addOperation @
          for l in execution_listener
            l @_encode()
        @
      else
        false

    #
    # @private
    # Operations may depend on other operations (linked lists, etc.).
    # The saveOperation and validateSavedOperations methods provide
    # an easy way to refer to these operations via an uid or object reference.
    #
    # For example: We can create a new Delete operation that deletes the operation $o like this
    #     - var d = new Delete(uid, $o);   or
    #     - var d = new Delete(uid, $o.getUid());
    # Either way we want to access $o via d.deletes. In the second case validateSavedOperations must be called first.
    #
    # @overload saveOperation(name, op_uid)
    #   @param {String} name The name of the operation. After validating (with validateSavedOperations) the instantiated operation will be accessible via this[name].
    #   @param {Object} op_uid A uid that refers to an operation
    # @overload saveOperation(name, op)
    #   @param {String} name The name of the operation. After calling this function op is accessible via this[name].
    #   @param {Operation} op An Operation object
    #
    saveOperation: (name, op, base = "this")->
      if op? and op._getModel?
        op = op._getModel(@custom_types, @operations)
      #
      # Every instance of $Operation must have an $execute function.
      # We use duck-typing to check if op is instantiated since there
      # could exist multiple classes of $Operation
      #
      if not op?
        # nop
      else if op.execute? or not (op.op_number? and op.creator?)
        # is instantiated, or op is string. Currently "Delimiter" is saved as string
        # (in combination with @parent you can retrieve the delimiter..)
        if base is "this"
          @[name] = op
        else
          dest = @[base]
          paths = name.split("/")
          last_path = paths.pop()
          for path in paths
            dest = dest[path]
          dest[last_path] = op
      else
        # not initialized. Do it when calling $validateSavedOperations()
        @unchecked ?= {}
        @unchecked[base] ?= {}
        @unchecked[base][name] = op

    #
    # @private
    # After calling this function all not instantiated operations will be accessible.
    # @see Operation.saveOperation
    #
    # @return [Boolean] Whether it was possible to instantiate all operations.
    #
    validateSavedOperations: ()->
      uninstantiated = {}
      success = true
      for base_name, base of @unchecked
        for name, op_uid of base
          op = @HB.getOperation op_uid
          if op
            if base_name is "this"
              @[name] = op
            else
              dest = @[base_name]
              paths = name.split("/")
              last_path = paths.pop()
              for path in paths
                dest = dest[path]
              dest[last_path] = op
          else
            uninstantiated[base_name] ?= {}
            uninstantiated[base_name][name] = op_uid
            success = false
      if not success
        @unchecked = uninstantiated
        return false
      else
        delete @unchecked
        return @

    getCustomType: ()->
      if not @custom_type?
        # throw new Error "This operation was not initialized with a custom type"
        @
      else
        if @custom_type.constructor is String
          # has not been initialized yet (only the name is specified)
          Type = @custom_types
          for t in @custom_type.split(".")
            Type = Type[t]
          @custom_type = new Type()
          @custom_type._setModel @
        @custom_type

    #
    # @private
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: (json = {})->
      json.type = @type
      json.uid = @getUid()
      if @custom_type?
        if @custom_type.constructor is String
          json.custom_type = @custom_type
        else
          json.custom_type = @custom_type._name

      if @content?.getUid?
        json.content = @content.getUid()
      else
        json.content = @content
      if @content_operations?
        operations = {}
        for n,o of @content_operations
          if o._getModel?
            o = o._getModel(@custom_types, @operations)
          operations[n] = o.getUid()
        json.content_operations = operations
      json

  #
  # @nodoc
  # A simple Delete-type operation that deletes an operation.
  #
  class ops.Delete extends ops.Operation

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Object} deletes UID or reference of the operation that this to be deleted.
    #
    constructor: (custom_type, uid, deletes)->
      @saveOperation 'deletes', deletes
      super custom_type, uid

    type: "Delete"

    #
    # @private
    # Convert all relevant information of this operation to the json-format.
    # This result can be sent to other clients.
    #
    _encode: ()->
      {
        'type': "Delete"
        'uid': @getUid()
        'deletes': @deletes.getUid()
      }

    #
    # @private
    # Apply the deletion.
    #
    execute: ()->
      if @validateSavedOperations()
        res = super
        if res
          @deletes.applyDelete @
        res
      else
        false

  #
  # Define how to parse Delete operations.
  #
  ops.Delete.parse = (o)->
    {
      'uid' : uid
      'deletes': deletes_uid
    } = o
    new this(null, uid, deletes_uid)

  #
  # @nodoc
  # A simple insert-type operation.
  #
  # An insert operation is always positioned between two other insert operations.
  # Internally this is realized as associative lists, whereby each insert operation has a predecessor and a successor.
  # For the sake of efficiency we maintain two lists:
  #   - The short-list (abbrev. sl) maintains only the operations that are not deleted (unimplemented, good idea?)
  #   - The complete-list (abbrev. cl) maintains all operations
  #
  class ops.Insert extends ops.Operation

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Operation} prev_cl The predecessor of this operation in the complete-list (cl)
    # @param {Operation} next_cl The successor of this operation in the complete-list (cl)
    #
    constructor: (custom_type, content, content_operations, parent, uid, prev_cl, next_cl, origin)->
      @saveOperation 'parent', parent
      @saveOperation 'prev_cl', prev_cl
      @saveOperation 'next_cl', next_cl
      if origin?
        @saveOperation 'origin', origin
      else
        @saveOperation 'origin', prev_cl
      super custom_type, uid, content, content_operations

    type: "Insert"

    val: ()->
      @getContent()

    getNext: (i=1)->
      n = @
      while i > 0 and n.next_cl?
        n = n.next_cl
        if not n.is_deleted
          i--
      if n.is_deleted
        null
      n

    getPrev: (i=1)->
      n = @
      while i > 0 and n.prev_cl?
        n = n.prev_cl
        if not n.is_deleted
          i--
      if n.is_deleted
        null
      else
        n

    #
    # set content to null and other stuff
    # @private
    #
    applyDelete: (o)->
      @deleted_by ?= []
      callLater = false
      if @parent? and not @is_deleted and o? # o? : if not o?, then the delimiter deleted this Insertion. Furthermore, it would be wrong to call it. TODO: make this more expressive and save
        # call iff wasn't deleted earlyer
        callLater = true
      if o?
        @deleted_by.push o
      garbagecollect = false
      if @next_cl.isDeleted()
        garbagecollect = true
      super garbagecollect
      if callLater
        @parent.callOperationSpecificDeleteEvents(this, o)
      if @prev_cl? and @prev_cl.isDeleted()
        # garbage collect prev_cl
        @prev_cl.applyDelete()

    cleanup: ()->
      if @next_cl.isDeleted()
        # delete all ops that delete this insertion
        for d in @deleted_by
          d.cleanup()

        # throw new Error "right is not deleted. inconsistency!, wrararar"
        # change origin references to the right
        o = @next_cl
        while o.type isnt "Delimiter"
          if o.origin is @
            o.origin = @prev_cl
          o = o.next_cl
        # reconnect left/right
        @prev_cl.next_cl = @next_cl
        @next_cl.prev_cl = @prev_cl

        # delete content
        # - we must not do this in applyDelete, because this would lead to inconsistencies
        # (e.g. the following operation order must be invertible :
        #   Insert refers to content, then the content is deleted)
        # Therefore, we have to do this in the cleanup
        # * NODE: We never delete Insertions!
        if @content instanceof ops.Operation and not (@content instanceof ops.Insert)
          @content.referenced_by--
          if @content.referenced_by <= 0 and not @content.is_deleted
            @content.applyDelete()
        delete @content
        super
      # else
      #   Someone inserted something in the meantime.
      #   Remember: this can only be garbage collected when next_cl is deleted

    #
    # @private
    # The amount of positions that $this operation was moved to the right.
    #
    getDistanceToOrigin: ()->
      d = 0
      o = @prev_cl
      while true
        if @origin is o
          break
        d++
        o = o.prev_cl
      d

    #
    # @private
    # Include this operation in the associative lists.
    execute: ()->
      if not @validateSavedOperations()
        return false
      else
        if @content instanceof ops.Operation
          @content.insert_parent = @ # TODO: this is probably not necessary and only nice for debugging
          @content.referenced_by ?= 0
          @content.referenced_by++
        if @parent?
          if not @prev_cl?
            @prev_cl = @parent.beginning
          if not @origin?
            @origin = @prev_cl
          else if @origin is "Delimiter"
            @origin = @parent.beginning
          if not @next_cl?
            @next_cl = @parent.end
        if @prev_cl?
          distance_to_origin = @getDistanceToOrigin() # most cases: 0
          o = @prev_cl.next_cl
          i = distance_to_origin # loop counter

          # $this has to find a unique position between origin and the next known character
          # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
          #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
          #         o2,o3 and o4 origin is 1 (the position of o2)
          #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
          #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
          #         therefore $this would be always to the right of o3
          # case 2: $origin < $o.origin
          #         if current $this insert_position > $o origin: $this ins
          #         else $insert_position will not change
          #         (maybe we encounter case 1 later, then this will be to the right of $o)
          # case 3: $origin > $o.origin
          #         $this insert_position is to the left of $o (forever!)
          while true
            if o isnt @next_cl
              # $o happened concurrently
              if o.getDistanceToOrigin() is i
                # case 1
                if o.uid.creator < @uid.creator
                  @prev_cl = o
                  distance_to_origin = i + 1
                else
                  # nop
              else if o.getDistanceToOrigin() < i
                # case 2
                if i - distance_to_origin <= o.getDistanceToOrigin()
                  @prev_cl = o
                  distance_to_origin = i + 1
                else
                  #nop
              else
                # case 3
                break
              i++
              o = o.next_cl
            else
              # $this knows that $o exists,
              break
          # now reconnect everything
          @next_cl = @prev_cl.next_cl
          @prev_cl.next_cl = @
          @next_cl.prev_cl = @

        @setParent @prev_cl.getParent() # do Insertions always have a parent?
        super # notify the execution_listeners
        @parent.callOperationSpecificInsertEvents(this)
        @

    #
    # Compute the position of this operation.
    #
    getPosition: ()->
      position = 0
      prev = @prev_cl
      while true
        if prev instanceof ops.Delimiter
          break
        if not prev.isDeleted()
          position++
        prev = prev.prev_cl
      position

    #
    # Convert all relevant information of this operation to the json-format.
    # This result can be send to other clients.
    #
    _encode: (json = {})->
      json.prev = @prev_cl.getUid()
      json.next = @next_cl.getUid()

      if @origin.type is "Delimiter"
        json.origin = "Delimiter"
      else if @origin isnt @prev_cl
        json.origin = @origin.getUid()

      # if not (json.prev? and json.next?)
      json.parent = @parent.getUid()

      super json

  ops.Insert.parse = (json)->
    {
      'content' : content
      'content_operations' : content_operations
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
      'parent' : parent
    } = json
    new this null, content, content_operations, parent, uid, prev, next, origin

  #
  # @nodoc
  # A delimiter is placed at the end and at the beginning of the associative lists.
  # This is necessary in order to have a beginning and an end even if the content
  # of the Engine is empty.
  #
  class ops.Delimiter extends ops.Operation
    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Operation} prev_cl The predecessor of this operation in the complete-list (cl)
    # @param {Operation} next_cl The successor of this operation in the complete-list (cl)
    #
    constructor: (prev_cl, next_cl, origin)->
      @saveOperation 'prev_cl', prev_cl
      @saveOperation 'next_cl', next_cl
      @saveOperation 'origin', prev_cl
      super null, {noOperation: true}

    type: "Delimiter"

    applyDelete: ()->
      super()
      o = @prev_cl
      while o?
        o.applyDelete()
        o = o.prev_cl
      undefined

    cleanup: ()->
      super()

    #
    # @private
    #
    execute: ()->
      if @unchecked?['next_cl']?
        super
      else if @unchecked?['prev_cl']
        if @validateSavedOperations()
          if @prev_cl.next_cl?
            throw new Error "Probably duplicated operations"
          @prev_cl.next_cl = @
          super
        else
          false
      else if @prev_cl? and not @prev_cl.next_cl?
        delete @prev_cl.unchecked.next_cl
        @prev_cl.next_cl = @
        super
      else if @prev_cl? or @next_cl? or true # TODO: are you sure? This can happen right?
        super
      #else
      #  throw new Error "Delimiter is unsufficient defined!"

    #
    # @private
    #
    _encode: ()->
      {
        'type' : @type
        'uid' : @getUid()
        'prev' : @prev_cl?.getUid()
        'next' : @next_cl?.getUid()
      }

  ops.Delimiter.parse = (json)->
    {
    'uid' : uid
    'prev' : prev
    'next' : next
    } = json
    new this(uid, prev, next)

  # This is what this module exports after initializing it with the HistoryBuffer
  {
    'operations' : ops
    'execution_listener' : execution_listener
  }
