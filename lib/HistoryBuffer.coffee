_ = require "underscore"

#
# An object that holds all applied operations.
#
# @note The HistoryBuffer is commonly abbreviated to HB.
#
class HistoryBuffer
  # @overload new HistoryBuffer()
  #   Creates an empty HB.
  #   @param {Object} user_id Creator of the HB.
  # @overload new HistoryBuffer(initial_content)
  #   Creates an HB with initial operations that represent the initial_value.
  #   @param {Array<Object>} initial_content Initial content of the DUC
  #   @see DUC DUC - Document Under Collaboration
  constructor: (@user_id)->
    @operation_counter = {}
    @buffer = {}
    @change_listeners = []

  getUserId: ()->
    @user_id

  getOperationCounter: ()->
    _.clone @operation_counter

  toJson: ()->
    json = []
    for user in @buffer
      for o of user
        json.push o.toJson()
    json

  # Get the number of operations that were created by a user.
  # Accordingly you will get the next operation number that is expected from that user.
  # You'll get new results only if you added the operation with $addOperation.
  #
  getNextOperationIdentifier: (user_id)->
    if not user_id?
      user_id = @user_id
    if not @operation_counter[user_id]?
      @operation_counter[user_id] = 0
    uid = {
        'creator' : user_id
        'op_number' : @operation_counter[user_id]
      }
    @operation_counter[user_id]++
    uid

  # Retrieve an operation from a unique id.
  getOperation: (uid)->
    if uid instanceof Object
      @buffer[uid.creator]?[uid.op_number]
    else
      throw new Error "This type of uid is not defined!"

  # Add an operation to the HB. Note that this will not link it against
  # other operations (it wont be executable)
  addOperation: (o)->
    if not @buffer[o.creator]?
      @buffer[o.creator] = {}
    if not @operation_counter[o.creator]?
      @operation_counter[o.creator] = 0
    #if @operation_counter[o.creator] isnt o.op_number and typeof o.op_number is 'number'
    #  throw new Error "You don't receive operations in the proper order. Try counting like this 0,1,2,3,4,.. ;)"
    if @buffer[o.creator][o.op_number]?
      throw new Error "You must not overwrite operations!"
    @buffer[o.creator][o.op_number] = o
    if typeof o.op_number is 'number' and o.creator isnt @getUserId()
      @operation_counter[o.creator]++
    o



module.exports = HistoryBuffer
