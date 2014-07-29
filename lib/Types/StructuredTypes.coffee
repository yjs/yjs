_ = require "underscore"
basic_types_uninitialized = require "./BasicTypes.coffee"

module.exports = (HB)->
  basic_types = basic_types_uninitialized HB
  types = basic_types.types
  parser = basic_types.parser

  class MapManager
    constructor: ()->
      @map = {}

    set: (name, content)->
      if not @map[name]?
        @map[name] = new Replaceable HB,
        @map[name].replace content

  class ListManager extends types.Insert
    constructor: (uid, beginning, end, prev, next, origin)->
      if beginning? and end?
        saveOperation "beginning", beginning
        saveOperation "end", end
      else
        @beginning = HB.addOperation new types.Delimiter HB.getNextOperationIdentifier(), undefined, undefined
        @end =       HB.addOperation new types.Delimiter HB.getNextOperationIdentifier(), @beginning, undefined
        @beginning.next_cl = @end
      super uid, prev, next, origin

    # Get the element previous to the delemiter at the end
    getLastOperation: ()->
      @end.prev_cl

    # similar to the above
    getFirstOperation: ()->
      @beginning.next_cl

    # Transforms the the list to an array
    # Doesn't return left-right delimiter.
    toArray: ()->
      o = @beginning.next_cl
      result = []
      while o isnt @end
        result.push o
        o = o.next_cl
      result

    #
    # Retrieves the x-th not deleted element.
    #
    getOperationByPosition: (position)->
      o = @beginning.next_cl
      if position > 0
        while true
          o = o.next_cl
          if not o.isDeleted()
            position -= 1
          if position is 0
            break
          if o instanceof types.Delimiter
            throw new Error "position parameter exceeded the length of the document!"
      o


  class ReplaceManager extends ListManager
    constructor: (initial_content, uid, beginning, end, prev, next, origin)->
      super uid, beginning, end, prev, next, origin
      if initial_content?
        @replace initial_content

    replace: (content)->
      o = @getLastOperation()
      op = new Replaceable content, @, HB.getNextOperationIdentifier(), o, o.next_cl
      HB.addOperation(op).execute()

    val: ()->
      o = @getLastOperation()
      if o instanceof types.Delimiter
        throw new Error "dtrn"
      o.val()

    toJson: ()->
      json =
        {
          'type': "ReplaceManager"
          'uid' : @getUid()
          'beginning' : @beginning
          'end' : @end
        }
      if @prev_cl? and @next_cl?
        json['prev'] = @prev_cl.getUid()
        json['next'] = @next_cl.getUid()
      if @origin? and @origin isnt @prev_cl
        json["origin"] = @origin.getUid()
      json

  parser["ReplaceManager"] = (json)->
    {
      'content' : content
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
      'beginning' : beginning
      'end' : end
    } = json
    new ReplaceManager content, uid, beginning, end, prev, next, origin


  #
  #  Extends the basic Insert type.
  #
  class Replaceable extends types.Insert
    constructor: (content, parent, uid, prev, next, origin)->
      @saveOperation 'content', content
      @saveOperation 'parent', parent
      if not (prev? and next?)
        throw new Error "You must define prev, and next for Replaceable-types!"
      super uid, prev, next, origin

    #
    #
    val: ()->
      @content

    replace: (content)->
      @parent.replace content

    execute: ()->
      super
      @content.setReplaceManager?(@parent)
      @

    #
    # Convert all relevant information of this operation to the json-format.
    # This result can be send to other clients.
    #
    toJson: ()->
      json =
        {
          'type': "Replaceable"
          'content': @content.getUid()
          'ReplaceManager' : @parent
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
          'uid' : @getUid()
        }
      if @origin? and @origin isnt @prev_cl
        json["origin"] = @origin.getUid()
      json

  parser["Replaceable"] = (json)->
    {
      'content' : content
      'ReplaceManager' : parent
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
    } = json
    new Replaceable content, parent, uid, prev, next, origin



  types['ListManager'] = ListManager
  types['MapManager'] = MapManager
  types['ReplaceManager'] = ReplaceManager
  types['Replaceable'] = Replaceable

  basic_types






