basic_types_uninitialized = require "./BasicTypes"

module.exports = (HB)->
  basic_types = basic_types_uninitialized HB
  types = basic_types.types
  parser = basic_types.parser

  #
  # @nodoc
  # Manages map like objects. E.g. Json-Type and XML attributes.
  #
  class MapManager extends types.Operation

    #
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (uid)->
      @map = {}
      super uid

    type: "MapManager"

    applyDelete: ()->
      for name,p of @map
        p.applyDelete()
      super()

    cleanup: ()->
      super()

    #
    # @see JsonTypes.val
    #
    val: (name, content)->
      if content?
        if not @map[name]?
          (new AddName undefined, @, name).execute()
        @map[name].replace content
        @
      else if name?
        prop = @map[name]
        if prop? and not prop.isContentDeleted()
          obj = prop.val()
          if obj instanceof types.ImmutableObject
            obj.val()
          else
            obj
        else
          undefined
      else
        result = {}
        for name,o of @map
          if not o.isContentDeleted()
            obj = o.val()
            if obj instanceof types.ImmutableObject or obj instanceof MapManager
              obj = obj.val()
            result[name] = obj
        result

    delete: (name)->
      @map[name]?.deleteContent()
      @
  #
  # @nodoc
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

    type: "AddName"

    applyDelete: ()->
      super()

    cleanup: ()->
      super()

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
        # helper for cloning an object
        clone = (o)->
          p = {}
          for name,value of o
            p[name] = value
          p
        uid_r = clone(@map_manager.getUid())
        uid_r.doSync = false
        uid_r.op_number = "_#{uid_r.op_number}_RM_#{@name}"
        if not HB.getOperation(uid_r)?
          uid_beg = clone(uid_r)
          uid_beg.op_number = "#{uid_r.op_number}_beginning"
          uid_end = clone(uid_r)
          uid_end.op_number = "#{uid_r.op_number}_end"
          beg = (new types.Delimiter uid_beg, undefined, uid_end).execute()
          end = (new types.Delimiter uid_end, beg, undefined).execute()
          event_properties =
            name: @name
          event_this = @map_manager
          @map_manager.map[@name] = new ReplaceManager event_properties, event_this, uid_r, beg, end
          @map_manager.map[@name].setParent @map_manager, @name
          (@map_manager.map[@name].add_name_ops ?= []).push @
          @map_manager.map[@name].execute()
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
  # @nodoc
  # Manages a list of Insert-type operations.
  #
  class ListManager extends types.Operation

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
        @beginning = new types.Delimiter undefined, undefined, undefined
        @end =       new types.Delimiter undefined, @beginning, undefined
        @beginning.next_cl = @end
        @beginning.execute()
        @end.execute()
      super uid, prev, next, origin

    type: "ListManager"

    #
    # @private
    # @see Operation.execute
    #
    execute: ()->
      if @validateSavedOperations()
        @beginning.setParent @
        @end.setParent @
        super
      else
        false

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
    # e.g. "abc" : the 1th character is "a"
    # the 0th character is the left Delimiter
    #
    getOperationByPosition: (position)->
      o = @beginning
      while true
        # find the i-th op
        if o instanceof types.Delimiter and o.prev_cl?
          # the user or you gave a position parameter that is to big
          # for the current array. Therefore we reach a Delimiter.
          # Then, we'll just return the last character.
          o = o.prev_cl
          while o.isDeleted() or not (o instanceof types.Delimiter)
            o = o.prev_cl
          break
        if position <= 0 and not o.isDeleted()
          break

        o = o.next_cl
        if not o.isDeleted()
          position -= 1
      o

  #
  # @nodoc
  # Adds support for replace. The ReplaceManager manages Replaceable operations.
  # Each Replaceable holds a value that is now replaceable.
  #
  # The WordType-type has implemented support for replace
  # @see WordType
  #
  class ReplaceManager extends ListManager
    #
    # @param {Object} event_properties Decorates the event that is thrown by the RM
    # @param {Object} event_this The object on which the event shall be executed
    # @param {Operation} initial_content Initialize this with a Replaceable that holds the initial_content.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (@event_properties, @event_this, uid, beginning, end, prev, next, origin)->
      if not @event_properties['object']?
        @event_properties['object'] = @event_this
      super uid, beginning, end, prev, next, origin

    type: "ReplaceManager"

    applyDelete: ()->
      o = @beginning
      while o?
        o.applyDelete()
        o = o.next_cl
      # if this was created by an AddName operation, delete it too
      if @add_name_ops?
        for o in @add_name_ops
          o.applyDelete()
      super()

    cleanup: ()->
      super()

    #
    # This doesn't throw the same events as the ListManager. Therefore, the
    # Replaceables also not throw the same events.
    # So, ReplaceManager and ListManager both implement
    # these functions that are called when an Insertion is executed (at the end).
    #
    #
    callEventDecorator: (events)->
      if not @isDeleted()
        for event in events
          for name,prop of @event_properties
            event[name] = prop
        @event_this.callEvent events
      undefined

    #
    # Replace the existing word with a new word.
    #
    # @param content {Operation} The new value of this ReplaceManager.
    # @param replaceable_uid {UID} Optional: Unique id of the Replaceable that is created
    #
    replace: (content, replaceable_uid)->
      o = @getLastOperation()
      relp = (new Replaceable content, @, replaceable_uid, o, o.next_cl).execute()
      # TODO: delete repl (for debugging)
      undefined

    isContentDeleted: ()->
      @getLastOperation().isDeleted()

    deleteContent: ()->
      (new types.Delete undefined, @getLastOperation().uid).execute()
      undefined

    #
    # Get the value of this WordType
    # @return {String}
    #
    val: ()->
      o = @getLastOperation()
      #if o instanceof types.Delimiter
        # throw new Error "Replace Manager doesn't contain anything."
      o.val?() # ? - for the case that (currently) the RM does not contain anything (then o is a Delimiter)

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
      if @origin? # TODO: do this everywhere: and @origin isnt @prev_cl
        json["origin"] = @origin().getUid()
      json

  parser["ReplaceManager"] = (json)->
    {
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
      'beginning' : beginning
      'end' : end
    } = json
    new ReplaceManager uid, beginning, end, prev, next, origin


  #
  # @nodoc
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
      if not (prev? and next?)
        throw new Error "You must define prev, and next for Replaceable-types!"
      super uid, prev, next, origin

    type: "Replaceable"

    #
    # Return the content that this operation holds.
    #
    val: ()->
      @content

    applyDelete: ()->
      res = super
      if @content?
        if @next_cl.type isnt "Delimiter"
          @content.deleteAllObservers()
        @content.applyDelete()
        @content.dontSync()
      @content = null
      res

    cleanup: ()->
      super

    #
    # This is called, when the Insert-type was successfully executed.
    # TODO: consider doing this in a more consistent manner. This could also be
    # done with execute. But currently, there are no specital Insert-types for ListManager.
    #
    callOperationSpecificInsertEvents: ()->
      if @next_cl.type is "Delimiter" and @prev_cl.type isnt "Delimiter"
        # this replaces another Replaceable
        old_value = @prev_cl.content
        @parent.callEventDecorator [
          type: "update"
          changedBy: @uid.creator
          oldValue: old_value
        ]
        @prev_cl.applyDelete()
      else if @next_cl.type isnt "Delimiter"
        # This won't be recognized by the user, because another
        # concurrent operation is set as the current value of the RM
        @applyDelete()
      else # prev _and_ next are Delimiters. This is the first created Replaceable in the RM
        @parent.callEventDecorator [
          type: "add"
          changedBy: @uid.creator
        ]
      undefined

    callOperationSpecificDeleteEvents: (o)->
      if @next_cl.type is "Delimiter"
        @parent.callEventDecorator [
          type: "delete"
          changedBy: o.uid.creator
          oldValue: @content
        ]

    #
    # Encode this operation in such a way that it can be parsed by remote peers.
    #
    _encode: ()->
      json =
        {
          'type': "Replaceable"
          'content': @content?.getUid()
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






