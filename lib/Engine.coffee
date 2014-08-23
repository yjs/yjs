
#
# @nodoc
# The Engine handles how and in which order to execute operations and add operations to the HistoryBuffer.
#
class Engine

  #
  # @param {HistoryBuffer} HB
  # @param {Array} parser Defines how to parse encoded messages.
  #
  constructor: (@HB, @parser)->
    @unprocessed_ops = []

  #
  # Parses an operatio from the json format. It uses the specified parser in your OperationType module.
  #
  parseOperation: (json)->
    typeParser = @parser[json.type]
    if typeParser?
      typeParser json
    else
      throw new Error "You forgot to specify a parser for type #{json.type}. The message is #{JSON.stringify json}."

  #
  # Apply a set of operations. E.g. the operations you received from another users HB._encode().
  # @note You must not use this method when you already have ops in your HB!
  #
  applyOpsBundle: (ops_json)->
    ops = []
    for o in ops_json
      ops.push @parseOperation o
    for o in ops
      @HB.addOperation o
    for o in ops
      if not o.execute()
        @unprocessed_ops.push o
    @tryUnprocessed()

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
    for o in ops_json
      @applyOp o

  #
  # Apply an operation that you received from another peer.
  #
  applyOp: (op_json)->
    # $parse_and_execute will return false if $o_json was parsed and executed, otherwise the parsed operadion
    o = @parseOperation op_json
    @HB.addToCounter o
    # @HB.addOperation o
    if not o.execute()
      @unprocessed_ops.push o
    else
      @HB.addOperation o
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
        if not op.execute()
          unprocessed.push op
        else
          @HB.addOperation op
      @unprocessed_ops = unprocessed
      if @unprocessed_ops.length is old_length
        break




module.exports = Engine












