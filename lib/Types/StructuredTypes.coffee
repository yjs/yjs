basic_types_uninitialized = require "./BasicTypes.coffee"

module.exports = (HB)->
  basic_types = basic_types_uninitialized HB
  types = basic_types.types
  parser = basic_types.parser

  #
  # Manages map like objects. E.g. Json-Type and XML attributes.
  #
  class MapManager extends types.Operation
    constructor: (uid)->
      @map = {}
      super uid

    val: (name, content)->
      if content?
        if not @map[name]?
          HB.addOperation(new AddName HB.getNextOperationIdentifier(), @, name).execute()
        @map[name].replace content
      else if name?
        @map[name]?.val()
      else
        result = {}
        for name,o of @map
          result[name] = o.val()
        result

  #
  # When a new property in a map manager is created, then the uids of the inserted Operations
  # must be unique (think about concurrent operations). Therefore only an AddName operation is allowed to
  # add a property in a MapManager. If two AddName operations on the same MapManager name happen concurrently
  # only one will AddName operation will be executed.
  #
  class AddName extends types.Operation
    constructor: (uid, map_manager, @name)->
      @saveOperation 'map_manager', map_manager
      super uid

    execute: ()->
      if not @validateSavedOperations()
        return false
      else
        uid_r = @map_manager.getUid()
        uid_r.op_number = "_#{uid_r.op_number}_RM_#{@name}"
        if not HB.getOperation(uid_r)?
          uid_beg = @map_manager.getUid()
          uid_beg.op_number = "_#{uid_beg.op_number}_RM_#{@name}_beginning"
          uid_end = @map_manager.getUid()
          uid_end.op_number = "_#{uid_end.op_number}_RM_#{@name}_end"
          beg = HB.addOperation(new types.Delimiter uid_beg, undefined, uid_end)
          end = HB.addOperation(new types.Delimiter uid_end, beg, undefined).execute()
          beg.execute()
          @map_manager.map[@name] = HB.addOperation(new ReplaceManager undefined, uid_r, beg, end).execute()
        super

    toJson: ()->
      {
        'type' : "AddName"
        'uid' : @getUid()
        'map_manager' : @map_manager.getUid()
        'name' : @name
      }

  parser['AddName'] = (json)->
    {
      'map_manager' : map_manager
      'uid' : uid
      'name' : name
    } = json
    new AddName uid, map_manager, name

  #
  # Manages a list of Insert-type operations.
  #
  class ListManager extends types.Insert
    constructor: (uid, beginning, end, prev, next, origin)->
      if beginning? and end?
        @saveOperation 'beginning', beginning
        @saveOperation 'end', end
      else
        @beginning = HB.addOperation new types.Delimiter HB.getNextOperationIdentifier(), undefined, undefined
        @end =       HB.addOperation new types.Delimiter HB.getNextOperationIdentifier(), @beginning, undefined
        @beginning.next_cl = @end
        @beginning.execute()
        @end.execute()

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

  #
  # Adds support for replace. The ReplaceManager manages Replaceable operations.
  # Each Replaceable holds a value that is now replaceable.
  #
  # The Word-type has implemented support for replace
  # @see Word
  #
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
          'beginning' : @beginning.getUid()
          'end' : @end.getUid()
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
  # The ReplaceManager manages Replaceables.
  # @see ReplaceManager
  #
  class Replaceable extends types.Insert
    constructor: (content, parent, uid, prev, next, origin)->
      @saveOperation 'content', content
      @saveOperation 'parent', parent
      if not (prev? and next? and content?)
        throw new Error "You must define content, prev, and next for Replaceable-types!"
      super uid, prev, next, origin

    val: ()->
      @content

    replace: (content)->
      @parent.replace content

    execute: ()->
      if not @validateSavedOperations()
        return false
      else
        @content.setReplaceManager?(@parent)
        super
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
          'ReplaceManager' : @parent.getUid()
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






