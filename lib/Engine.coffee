
#
# The Engine handles how and in which order to execute operations and add operations to the HistoryBuffer.
#
class Engine
  constructor: (@HB, @parser)->
    @unprocessed_ops = []

  parseOperation: (json)->
    typeParser = @parser[json.type]
    if typeParser?
      typeParser json
    else
      throw new Error "You forgot to specify a parser for type #{json.type}. The message is #{JSON.stringify json}."

  applyOps: (ops_json)->
    ops = []
    for o in ops_json
      ops.push @parseOperation o
    for o in ops
      @HB.addOperation o
    for o in ops
      if not o.execute()
        @unprocessed_ops.push o
    @tryUnprocessed()

  applyOp: (op_json)->
    # $parse_and_execute will return false if $o_json was parsed and executed, otherwise the parsed operadion
    o = @parseOperation op_json
    @HB.addOperation o
    if not o.execute()
      @unprocessed_ops.push o
    @tryUnprocessed()

  tryUnprocessed: ()->
    while true
      old_length = @unprocessed_ops.length
      unprocessed = []
      for op in @unprocessed_ops
        if not op.execute()
          unprocessed.push op
      @unprocessed_ops = unprocessed
      if @unprocessed_ops.length is old_length
        break

  


module.exports = Engine












