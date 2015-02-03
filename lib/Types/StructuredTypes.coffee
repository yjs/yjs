basic_types_uninitialized = require "./BasicTypes"

module.exports = (HB)->
  basic_types = basic_types_uninitialized HB
  types = basic_types.types

  #
  # @nodoc
  # Manages map like objects. E.g. Json-Type and XML attributes.
  #
  class types.MapManager extends types.Operation

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
      if arguments.length > 1
        @retrieveSub(name).replace content
        @
      else if name?
        prop = @map[name]
        if prop? and not prop.isContentDeleted()
          prop.val()
        else
          undefined
      else
        result = {}
        for name,o of @map
          if not o.isContentDeleted()
            result[name] = o.val()
        result

    delete: (name)->
      @map[name]?.deleteContent()
      @

    retrieveSub: (property_name)->
      if not @map[property_name]?
        event_properties =
          name: property_name
        event_this = @
        map_uid = @cloneUid()
        map_uid.sub = property_name
        rm_uid =
          noOperation: true
          alt: map_uid
        rm = new types.ReplaceManager event_properties, event_this, rm_uid # this operation shall not be saved in the HB
        @map[property_name] = rm
        rm.setParent @, property_name
        rm.execute()
      @map[property_name]

  #
  # @nodoc
  # Manages a list of Insert-type operations.
  #
  class types.ListManager extends types.Operation

    #
    # A ListManager maintains a non-empty list that has a beginning and an end (both Delimiters!)
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (uid)->
      @beginning = new types.Delimiter undefined, undefined
      @end =       new types.Delimiter @beginning, undefined
      @beginning.next_cl = @end
      @beginning.execute()
      @end.execute()
      super uid

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
  # The TextType-type has implemented support for replace
  # @see TextType
  #
  class types.ReplaceManager extends types.ListManager
    #
    # @param {Object} event_properties Decorates the event that is thrown by the RM
    # @param {Object} event_this The object on which the event shall be executed
    # @param {Operation} initial_content Initialize this with a Replaceable that holds the initial_content.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    # @param {Delimiter} beginning Reference or Object.
    # @param {Delimiter} end Reference or Object.
    constructor: (@event_properties, @event_this, uid, beginning, end)->
      if not @event_properties['object']?
        @event_properties['object'] = @event_this
      super uid, beginning, end

    type: "ReplaceManager"

    applyDelete: ()->
      o = @beginning
      while o?
        o.applyDelete()
        o = o.next_cl
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
      if not (@isDeleted() or @getLastOperation().isDeleted())
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
      relp = (new types.Replaceable content, @, replaceable_uid, o, o.next_cl).execute()
      # TODO: delete repl (for debugging)
      undefined

    isContentDeleted: ()->
      @getLastOperation().isDeleted()

    deleteContent: ()->
      (new types.Delete undefined, @getLastOperation().uid).execute()
      undefined

    #
    # Get the value of this
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
          'type': @type
          'uid' : @getUid()
          'beginning' : @beginning.getUid()
          'end' : @end.getUid()
        }
      json

  #
  # @nodoc
  # The ReplaceManager manages Replaceables.
  # @see ReplaceManager
  #
  class types.Replaceable extends types.Insert

    #
    # @param {Operation} content The value that this Replaceable holds.
    # @param {ReplaceManager} parent Used to replace this Replaceable with another one.
    # @param {Object} uid A unique identifier. If uid is undefined, a new uid will be created.
    #
    constructor: (content, parent, uid, prev, next, origin, is_deleted)->
      # see encode to see, why we are doing it this way
      if content? and content.creator?
        @saveOperation 'content', content
      else
        @content = content
      @saveOperation 'parent', parent
      super uid, prev, next, origin # Parent is already saved by Replaceable
      @is_deleted = is_deleted

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
          @content.deleteAllObservers?()
        @content.applyDelete?()
        @content.dontSync?()
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
        if not @is_deleted # When this is received from the HB, this could already be deleted!
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
          'type': @type
          'parent' : @parent.getUid()
          'prev': @prev_cl.getUid()
          'next': @next_cl.getUid()
          'origin' : @origin.getUid()
          'uid' : @getUid()
          'is_deleted': @is_deleted
        }
      if @content instanceof types.Operation
        json['content'] = @content.getUid()
      else
        # This could be a security concern.
        # Throw error if the users wants to trick us
        if @content? and @content.creator?
          throw new Error "You must not set creator here!"
        json['content'] = @content
      json

  types.Replaceable.parse = (json)->
    {
      'content' : content
      'parent' : parent
      'uid' : uid
      'prev': prev
      'next': next
      'origin' : origin
      'is_deleted': is_deleted
    } = json
    new this(content, parent, uid, prev, next, origin, is_deleted)


  basic_types






