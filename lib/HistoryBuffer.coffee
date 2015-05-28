
#
# @nodoc
# An object that holds all applied operations.
#
# @note The HistoryBuffer is commonly abbreviated to HB.
#
class HistoryBuffer

  #
  # Creates an empty HB.
  # @param {Object} user_id Creator of the HB.
  #
  constructor: (@user_id)->
    @operation_counter = {}
    @buffer = {}
    @change_listeners = []
    @garbage = [] # Will be cleaned on next call of garbageCollector
    @trash = [] # Is deleted. Wait until it is not used anymore.
    @performGarbageCollection = true
    @garbageCollectTimeout = 30000
    @reserved_identifier_counter = 0
    setTimeout @emptyGarbage, @garbageCollectTimeout

  # At the beginning (when the user id was not assigned yet),
  # the operations are added to buffer._temp. When you finally get your user id,
  # the operations are copies from buffer._temp to buffer[id]. Furthermore, when buffer[id] does already contain operations
  # (because of a previous session), the uid.op_numbers of the operations have to be reassigned.
  # This is what this function does. It adds them to buffer[id],
  # and assigns them the correct uid.op_number and uid.creator
  setUserId: (@user_id, state_vector)->
    @buffer[@user_id] ?= []
    buff = @buffer[@user_id]

    # we assumed that we started with counter = 0.
    # when we receive tha state_vector, and actually have
    # counter = 10. Then we have to add 10 to every op_counter
    counter_diff = state_vector[@user_id] or 0

    if @buffer._temp?
      for o_name,o of @buffer._temp
        o.uid.creator = @user_id
        o.uid.op_number += counter_diff
        buff[o.uid.op_number] = o

    @operation_counter[@user_id] = (@operation_counter._temp or 0) + counter_diff

    delete @operation_counter._temp
    delete @buffer._temp


  emptyGarbage: ()=>
    for o in @garbage
      #if @getOperationCounter(o.uid.creator) > o.uid.op_number
      o.cleanup?()

    @garbage = @trash
    @trash = []
    if @garbageCollectTimeout isnt -1
      @garbageCollectTimeoutId = setTimeout @emptyGarbage, @garbageCollectTimeout
    undefined

  #
  # Get the user id with wich the History Buffer was initialized.
  #
  getUserId: ()->
    @user_id

  addToGarbageCollector: ()->
    if @performGarbageCollection
      for o in arguments
        if o?
          @garbage.push o

  stopGarbageCollection: ()->
    @performGarbageCollection = false
    @setManualGarbageCollect()
    @garbage = []
    @trash = []

  setManualGarbageCollect: ()->
    @garbageCollectTimeout = -1
    clearTimeout @garbageCollectTimeoutId
    @garbageCollectTimeoutId = undefined

  setGarbageCollectTimeout: (@garbageCollectTimeout)->

  #
  # I propose to use it in your Framework, to create something like a root element.
  # An operation with this identifier is not propagated to other clients.
  # This is why everybode must create the same operation with this uid.
  #
  getReservedUniqueIdentifier: ()->
    {
      creator : '_'
      op_number : "_#{@reserved_identifier_counter++}"
    }

  #
  # Get the operation counter that describes the current state of the document.
  #
  getOperationCounter: (user_id)->
    if not user_id?
      res = {}
      for user,ctn of @operation_counter
        res[user] = ctn
      res
    else
      @operation_counter[user_id]

  isExpectedOperation: (o)->
    @operation_counter[o.uid.creator] ?= 0
    o.uid.op_number <= @operation_counter[o.uid.creator]
    true #TODO: !! this could break stuff. But I dunno why

  #
  # Encode this operation in such a way that it can be parsed by remote peers.
  # TODO: Make this more efficient!
  _encode: (state_vector={})->
    json = []
    unknown = (user, o_number)->
      if (not user?) or (not o_number?)
        throw new Error "dah!"
      not state_vector[user]? or state_vector[user] <= o_number

    for u_name,user of @buffer
      # TODO next, if @state_vector[user] <= state_vector[user]
      if u_name is "_"
        continue
      for o_number,o of user
        if (not o.uid.noOperation?) and unknown(u_name, o_number)
          # its necessary to send it, and not known in state_vector
          o_json = o._encode()
          if o.next_cl? # applies for all ops but the most right delimiter!
            # search for the next _known_ operation. (When state_vector is {} then this is the Delimiter)
            o_next = o.next_cl
            while o_next.next_cl? and unknown(o_next.uid.creator, o_next.uid.op_number)
              o_next = o_next.next_cl
            o_json.next = o_next.getUid()
          else if o.prev_cl? # most right delimiter only!
            # same as the above with prev.
            o_prev = o.prev_cl
            while o_prev.prev_cl? and unknown(o_prev.uid.creator, o_prev.uid.op_number)
              o_prev = o_prev.prev_cl
            o_json.prev = o_prev.getUid()
          json.push o_json

    json

  #
  # Get the number of operations that were created by a user.
  # Accordingly you will get the next operation number that is expected from that user.
  # This will increment the operation counter.
  #
  getNextOperationIdentifier: (user_id)->
    if not user_id?
      user_id = @user_id
    if not @operation_counter[user_id]?
      @operation_counter[user_id] = 0
    uid =
      'creator' : user_id
      'op_number' : @operation_counter[user_id]
    @operation_counter[user_id]++
    uid

  #
  # Retrieve an operation from a unique id.
  #
  # when uid has a "sub" property, the value of it will be applied
  # on the operations retrieveSub method (which must! be defined)
  #
  getOperation: (uid)->
    if uid.uid?
      uid = uid.uid
    o = @buffer[uid.creator]?[uid.op_number]
    if uid.sub? and o?
      o.retrieveSub uid.sub
    else
      o

  #
  # Add an operation to the HB. Note that this will not link it against
  # other operations (it wont executed)
  #
  addOperation: (o)->
    if not @buffer[o.uid.creator]?
      @buffer[o.uid.creator] = {}
    if @buffer[o.uid.creator][o.uid.op_number]?
      throw new Error "You must not overwrite operations!"
    if (o.uid.op_number.constructor isnt String) and (not @isExpectedOperation(o)) and (not o.fromHB?) # you already do this in the engine, so delete it here!
      throw new Error "this operation was not expected!"
    @addToCounter(o)
    @buffer[o.uid.creator][o.uid.op_number] = o
    o

  removeOperation: (o)->
    delete @buffer[o.uid.creator]?[o.uid.op_number]

  # When the HB determines inconsistencies, then the invokeSync
  # handler wil be called, which should somehow invoke the sync with another collaborator.
  # The parameter of the sync handler is the user_id with wich an inconsistency was determined
  setInvokeSyncHandler: (f)->
    @invokeSync = f

  # empty per default # TODO: do i need this?
  invokeSync: ()->

  # after you received the HB of another user (in the sync process),
  # you renew your own state_vector to the state_vector of the other user
  renewStateVector: (state_vector)->
    for user,state of state_vector
      if ((not @operation_counter[user]?) or (@operation_counter[user] < state_vector[user])) and state_vector[user]?
        @operation_counter[user] = state_vector[user]

  #
  # Increment the operation_counter that defines the current state of the Engine.
  #
  addToCounter: (o)->
    @operation_counter[o.uid.creator] ?= 0
    # TODO: check if operations are send in order
    if o.uid.op_number is @operation_counter[o.uid.creator]
      @operation_counter[o.uid.creator]++
    while @buffer[o.uid.creator][@operation_counter[o.uid.creator]]?
      @operation_counter[o.uid.creator]++
    undefined

module.exports = HistoryBuffer
