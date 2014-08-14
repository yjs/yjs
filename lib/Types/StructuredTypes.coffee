basic_types_uninitialized = require "./BasicTypes"

module.exports = (HB)->
  basic_types = basic_types_uninitialized HB
  types = basic_types.types
  parser = basic_types.parser

  #
  # Manages map like objects. E.g. Json-Type and XML attributes.
  #
  class MapManager extends types.Operation

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (uid)->
      @map = {}
      super uid

    #
    # @see JsonTypes.val
    #
    val: (name, content)->
      if content?
        if not @map[name]?
          HB.addOperation(new AddName undefined, @, name).execute()
        @map[name].replace content
        @
      else if name?
        obj = @map[name]?.val()
        if obj instanceof types.ImmutableObject
          obj.val()
        else
          obj
      else
        result = {}
        for name,o of @map
          obj = o.val()
          if obj instanceof types.ImmutableObject or obj instanceof MapManager
            obj = obj.val()
          result[name] = obj
        result

  #
  # When a new property in a map manager is created, then the uids of the inserted Operations
  # must be unique (think about concurrent operations). Therefore only an AddName operation is allowed to
  # add a property in a MapManager. If two AddName operations on the same MapManager name happen concurrently
  # only one will AddName operation will be executed.
  #
  class AddName extends types.Operation

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Object} map_manager Uid or reference to the MapManager.
    # @param {String} name Name of the property that will be added.
    #
    constructor: (uid, map_manager, @name)->
      @saveOperation 'map_manager', map_manager
      super uid

    #
    # If map_manager doesn't have the property name, then add it.
    # The ReplaceManager that is being written on the property is unique
    # in such a way that if AddName is executed (from another peer) it will
    # always have the same result (ReplaceManager, and its beginning and end are the same)
    #
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
          beg = HB.addOperation(new types.Delimiter uid_beg, undefined, uid_end).execute()
          end = HB.addOperation(new types.Delimiter uid_end, beg, undefined).execute()
          #beg.execute()
          @map_manager.map[@name] = HB.addOperation(new ReplaceManager undefined, uid_r, beg, end).execute()
        super

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
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

    #
    # A ListManager maintains a non-empty list that has a beginning and an end (both Delimiters!)
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (uid, beginning, end, prev, next, origin)->
      if beginning? and end?
        @saveOperation 'beginning', beginning
        @saveOperation 'end', end
      else
        @beginning = HB.addOperation new types.Delimiter undefined, undefined, undefined
        @end =       HB.addOperation new types.Delimiter undefined, @beginning, undefined
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
    #
    # @param {Operation} initial_content Initialize this with a Replaceable that holds the initial_content.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (initial_content, uid, beginning, end, prev, next, origin)->
      super uid, beginning, end, prev, next, origin
      if initial_content?
        @replace initial_content

    #
    # Replace the existing word with a new word.
    #
    replace: (content)->
      o = @getLastOperation()
      op = new Replaceable content, @, undefined, o, o.next_cl
      HB.addOperation(op).execute()

    #
    # Get the value of this Word
    # @return {String}
    #
    val: ()->
      o = @getLastOperation()
      if o instanceof types.Delimiter
        throw new Error "dtrn"
      o.val()

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
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

    #
    # @param {Operation} content The value that this Replaceable holds.
    # @param {ReplaceManager} parent Used to replace this Replaceable with another one.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (content, parent, uid, prev, next, origin)->
      @saveOperation 'content', content
      @saveOperation 'parent', parent
      if not (prev? and next? and content?)
        throw new Error "You must define content, prev, and next for Replaceable-types!"
      super uid, prev, next, origin

    #
    # Return the content that this operation holds.
    #
    val: ()->
      @content

    #
    # Replace the content of this replaceable with new content.
    #
    replace: (content)->
      @parent.replace content

    #
    # If possible set the replace manager in the content.
    # @see Word.setReplaceManager
    #
    execute: ()->
      if not @validateSavedOperations()
        return false
      else
        @content.setReplaceManager?(@parent)
        super

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
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






