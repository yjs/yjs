
window?.unprocessed_counter = 0 # del this
window?.unprocessed_exec_counter = 0 # TODO
window?.unprocessed_types = []

#
# @nodoc
# The Engine handles how and in which order to execute operations and add operations to the HistoryBuffer.
#
class Engine

  #
  # @param {HistoryBuffer} HB
  # @param {Object} types list of available types
  #
  constructor: (@HB, @types)->
    @unprocessed_ops = []

  #
  # Parses an operatio from the json format. It uses the specified parser in your OperationType module.
  #
  parseOperation: (json)->
    type = @types[json.type]
    if type?.parse?
      type.parse json
    else
      throw new Error "You forgot to specify a parser for type #{json.type}. The message is #{JSON.stringify json}."


  #
  # Apply a set of operations. E.g. the operations you received from another users HB._encode().
  # @note You must not use this method when you already have ops in your HB!
  ###
  applyOpsBundle: (ops_json)->
    ops = []
    for o in ops_json
      ops.push @parseOperation o
    for o in ops
      if not o.execute()
        @unprocessed_ops.push o
    @tryUnprocessed()
  ###

  #
  # Same as applyOps but operations that are already in the HB are not applied.
  # @see Engine.applyOps
  #
  applyOpsCheckDouble: (ops_json)->
    for o in ops_json
      if not @HB.getOperation(o.uid)?
        @applyOp o

  #
  # Apply a set of operations. (Helper for using applyOp on Arrays)
  # @see Engine.applyOp
  applyOps: (ops_json)->
    @applyOp ops_json

  #
  # Apply an operation that you received from another peer.
  # TODO: make this more efficient!!
  # - operations may only executed in order by creator, order them in object of arrays (key by creator)
  # - you can probably make something like dependencies (creator1 waits for creator2)
  applyOp: (op_json_array, fromHB = false)->
    if op_json_array.constructor isnt Array
      op_json_array = [op_json_array]
    for op_json in op_json_array
      if fromHB
        op_json.fromHB = "true" # execute immediately, if
      # $parse_and_execute will return false if $o_json was parsed and executed, otherwise the parsed operadion
      o = @parseOperation op_json
      o.parsed_from_json = op_json
      if op_json.fromHB?
        o.fromHB = op_json.fromHB
      # @HB.addOperation o
      if @HB.getOperation(o)?
        # nop
      else if ((not @HB.isExpectedOperation(o)) and (not o.fromHB?)) or (not o.execute())
        @unprocessed_ops.push o
        window?.unprocessed_types.push o.type # TODO: delete this
    @tryUnprocessed()

  #
  # Call this method when you applied a new operation.
  # It checks if operations that were previously not executable are now executable.
  #
  tryUnprocessed: ()->
    while true
      old_length = @unprocessed_ops.length
      unprocessed = []
      for op in @unprocessed_ops
        if @HB.getOperation(op)?
          # nop
        else if (not @HB.isExpectedOperation(op) and (not op.fromHB?)) or (not op.execute())
          unprocessed.push op
      @unprocessed_ops = unprocessed
      if @unprocessed_ops.length is old_length
        break
    if @unprocessed_ops.length isnt 0
      @HB.invokeSync()


module.exports = Engine












