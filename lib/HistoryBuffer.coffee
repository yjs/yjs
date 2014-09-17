
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
    @garbageCollectTimeout = 1000
    @reserved_identifier_counter = 0
    setTimeout @emptyGarbage, @garbageCollectTimeout

  emptyGarbage: ()=>
    for o in @garbage
      #if @getOperationCounter(o.creator) > o.op_number
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
      for o_number,o of user
        if o.doSync and unknown(u_name, o_number)
          # its necessary to send it, and not known in state_vector
          o_json = o._encode()
          if o.next_cl? # applies for all ops but the most right delimiter!
            # search for the next _known_ operation. (When state_vector is {} then this is the Delimiter)
            o_next = o.next_cl
            while o_next.next_cl? and unknown(o_next.creator, o_next.op_number)
              o_next = o_next.next_cl
            o_json.next = o_next.getUid()
          else if o.prev_cl? # most right delimiter only!
            # same as the above with prev.
            o_prev = o.prev_cl
            while o_prev.prev_cl? and unknown(o_prev.creator, o_prev.op_number)
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
  getOperation: (uid)->
    if uid instanceof Object
      @buffer[uid.creator]?[uid.op_number]
    else if not uid?
    else
      throw new Error "This type of uid is not defined!"
  #
  # Add an operation to the HB. Note that this will not link it against
  # other operations (it wont executed)
  #
  addOperation: (o)->
    if not @buffer[o.creator]?
      @buffer[o.creator] = {}
    if @buffer[o.creator][o.op_number]?
      throw new Error "You must not overwrite operations!"
    @buffer[o.creator][o.op_number] = o
    o

  removeOperation: (o)->
    delete @buffer[o.creator]?[o.op_number]

  #
  # Increment the operation_counter that defines the current state of the Engine.
  #
  addToCounter: (o)->
    if not @operation_counter[o.creator]?
      @operation_counter[o.creator] = 0
    if typeof o.op_number is 'number' and o.creator isnt @getUserId()
      # TODO: fix this issue better.
      # Operations should income in order
      # Then you don't have to do this..
      if o.op_number is @operation_counter[o.creator]
        @operation_counter[o.creator]++
        while @getOperation({creator:o.creator, op_number: @operation_counter[o.creator]})?
          @operation_counter[o.creator]++

    #if @operation_counter[o.creator] isnt (o.op_number + 1)
      #console.log (@operation_counter[o.creator] - (o.op_number + 1))
      #console.log o
      #throw new Error "You don't receive operations in the proper order. Try counting like this 0,1,2,3,4,.. ;)"

module.exports = HistoryBuffer
