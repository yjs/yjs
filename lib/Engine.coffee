_ = require "underscore"

class Engine
  constructor: (@HB, @parser)->
    @unprocessed_ops = []

  parseOperation: (json)->
    typeParser = @parser[json.type]
    if typeParser?
      typeParser json
    else
      throw new Error "You forgot to specify a parser for type #{json.type}. The message is #{JSON.stringify json}."

  # TODO:
  applyOps: (ops)->
    for o in ops
      @applyOp o

  applyOp: (op_json)->
    # $parse_and_execute will return false if $o_json was parsed and executed, otherwise the parsed operadion
    o = @parseOperation o_json
    @HB.addOperation o
    if not o.execute()
      @unprocessed_ops.push o
    unprocessed = []
    for op in @unprocessed_ops
      if not op.execute()
        unprocessed.push op
    @unprocessed_ops = unprocessed


module.exports = Engine












