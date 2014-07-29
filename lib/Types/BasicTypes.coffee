module.exports = (HB)->
  # @see Engine.parse
  parser = {}
  execution_listener = []

  #
  # A generic interface to operations.
  #
  class Operation
    # @param {Object} uid A unique identifier
    # @see HistoryBuffer.getNextOperationIdentifier
    constructor: ({'creator': @creator, 'op_number' : @op_number})->

    # Computes a unique identifier (uid).
    getUid: ()->
      { 'creator': @creator, 'op_number': @op_number }

    execute: ()->
      for l in execution_listener
        l @toJson()
      @

    #
    # Operations may depend on other operations (linked lists, etc.). The saveOperation and validateSavedOperations methods provide
    # an easy way to refer to these operations via an uid or object reference.
    #
    # For example: We can create a new Delete operation that deletes the operation $o like this
    #     - var d = new Delete(uid, $o);   or
    #     - var d = new Delete(uid, $o.getUid());
    # Either way we want to access $o via d.deletes. This is possible after calling validateSavedOperations.
    #
    # @overload saveOperation(name, op_uid)
    #   @param {String} name The name of the operation. After validating (with validateSavedOperations) the instantiated operation will be accessible via this[name].
    #   @param {Object} op_uid A uid that refers to an operation
    # @overload saveOperation(name, op)
    #   @param {String} name The name of the operation. After calling this function op is accessible via this[name].
    #   @param {Operation} op An Operation object
    #
    saveOperation: (name, op)->
      # Every instance of $Operation must have an $execute function.
      # We use duck-typing to check if op is instantiated since there
      # could exist multiple classes of $Operation
      if op?.execute?
        # is instantiated
        @[name] = op
      else if op?
        # not initialized. Do it when calling $validateSavedOperations()
        @unchecked ?= {}
        @unchecked[name] = op

    #
    # After calling this function all not instantiated operations will be accessible.
    # @see Operation.saveOperation
    #
    # @return [Boolean] Whether it was possible to instantiate all operations.
    #
    validateSavedOperations: ()->
      uninstantiated = {}
      success = @
      for name, op_uid of @unchecked
        op = HB.getOperation op_uid
        if op
          @[name] = op
        else
          uninstantiated[name] = op
          success = false
      delete @unchecked
      if not success
        @unchecked = uninstantiated
      success



  #
  # A simple delete-type operation.
  #
  class Delete extends Operation
    constructor: (uid, deletes)->
      @saveOperation 'deletes', deletes
      super uid

    #
    # Convert all relevant information of this operation to the json-format.
    # This result can be sent to other clients.
    #
    toJson: ()->
      {
        'type': "Delete"
        'uid': @getUid()
        'deletes': @deletes.getUid()
      }

    execute: ()->
      if @validateSavedOperations()
        @deletes.applyDelete @
        super
        @
      else
        false

  #
  # Define how to parse $Delete operations.
  #
  parser['Delete'] = ({'uid' : uid, 'deletes': deletes_uid})->
    new D uid, deletes_uid

  #
  # A simple insert-type operation.
  #
  # An insert operation is always positioned between two other insert operations.
  # Internally this is realized as associative lists, whereby each insert operation has a predecessor and a successor.
  # For the sake of efficiency we maintain two lists:
  #   - The short-list (abbrev. sl) maintains only the operations that are not deleted
  #   - The complete-list (abbrev. cl) maintains all operations
  #
  class Insert extends Operation
    # @param {Value} content The value of the insert operation. E.g. for strings content is a char.
    # @param {Object} creator A unique user identifier
    # @param {Integer} op_number This Number was assigned via getNextOperationIdentifier().
    # @param {Operation} prev_cl The predecessor of this operation in the complete-list (cl)
    # @param {Operation} next_cl The successor of this operation in the complete-list (cl)
    #
    # @see HistoryBuffer.getNextOperationIdentifier
    constructor: (uid, prev_cl, next_cl, origin)->
      @saveOperation 'prev_cl', prev_cl
      @saveOperation 'next_cl', next_cl
      if origin?
        @saveOperation 'origin', origin
      else
        @saveOperation 'origin', prev_cl
      super uid

    applyDelete: (o)->
      @deleted_by ?= []
      @deleted_by.push o

    #
    # If isDeleted() is true this operation won't be maintained in the sl
    #
    isDeleted: ()->
      @deleted_by?.length > 0

    #
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
    # Update the short list
    # TODO (Unused)
    update_sl: ()->
      o = @prev_cl
      update: (dest_cl,dest_sl)->
        while true
          if o.isDeleted()
            o = o[dest_cl]
          else
            @[dest_sl] = o

            break
      update "prev_cl", "prev_sl"
      update "next_cl", "prev_sl"



    #
    # Include this operation in the associative lists.
    #
    execute: ()->
      if not @validateSavedOperations()
        return false
      else
        if @prev_cl? and @next_cl?
          distance_to_origin = 0
          o = @prev_cl.next_cl
          i = 0
          # $this has to find a unique position between origin and the next known character
          # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
          #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
          #         o2,o3 and o4 origin is 1 (the position of o2)
          #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
          #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
          #         therefore $this would be always to the right of o3
          # case 2: $origin < $o.origin
          #         if current $this insert_position > $o origin: $this ins
          #         else $insert_position will not change (maybe we encounter case 1 later, then this will be to the right of $o)
          # case 3: $origin > $o.origin
          #         $this insert_position is to the left of $o (forever!)
          while true
            if not o?
              # TODO: Debugging
              console.log JSON.stringify @prev_cl.getUid()
              console.log JSON.stringify @next_cl.getUid()
            if o isnt @next_cl
              # $o happened concurrently
              if o.getDistanceToOrigin() is i
                # case 1
                if o.creator < @creator
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
        super # notify the execution_listeners
        @

    val: ()->
      throw new Error "Implement this function!"

  #
  # A delimiter is placed at the end and at the beginning of the associative lists.
  # This is necessary in order to have a beginning and an end even if the content
  # of the Engine is empty.
  #
  class Delimiter extends Insert

    isDeleted: ()->
      false

    getDistanceToOrigin: ()->
      0

    execute: ()->
      a = @validateSavedOperations()
      for l in execution_listener
        l @toJson()
      a

    toJson: ()->
      {
        'type' : "Delimiter"
        'uid' : @getUid()
        'prev' : @prev_cl.getUid()
        'next' : @next_cl.getUid()
      }

  parser['Delimiter'] = (json)->
      {
        'uid' : uid
        'prev' : prev
        'next' : next
      } = json
      new Delimiter uid, prev, next

  # This is what this module exports after initializing it with the HistoryBuffer
  {
    'types' :
      'Delete' : Delete
      'Insert' : Insert
      'Delimiter': Delimiter
      'Operation': Operation
    'parser' : parser
    'execution_listener' : execution_listener
  }




