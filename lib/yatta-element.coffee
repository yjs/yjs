
Yatta = require './yatta'

bindToChildren = (that)->
  for i in [0...that.children.length]
    attr = that.children.item(i)
    if attr.name?
      attr.val = that.val.val(attr.name)
  that.val.observe (events)->
    for event in events
      if event.name?
        for i in [0...that.children.length]
          attr = that.children.item(i)
          if attr.name? and attr.name is event.name
            newVal = that.val.val(attr.name)
            if attr.val isnt newVal
              attr.val = newVal

Polymer "yatta-element",
  ready: ()->
    if @connector?
      @val = new Yatta @connector
      bindToChildren @
    else if @val?
      bindToChildren @

  valChanged: ()->
    if @val? and @val.type is "JsonType"
      bindToChildren @

Polymer "yatta-property",
  ready: ()->
    if @val? and @name?
      if @val.constructor is Object
        @val = @parentElement.val(@name,@val).val(@name)
        # TODO: please use instanceof instead of .type,
        # since it is more safe (consider someone putting a custom Object type here)
      else if typeof @val is "string"
        @parentElement.val(@name,@val)
      if @val.type is "JsonType"
        bindToChildren @

  valChanged: ()->
    if @val? and @name?
      if @val.constructor is Object
        @val = @parentElement.val.val(@name,@val).val(@name)
        # TODO: please use instanceof instead of .type,
        # since it is more safe (consider someone putting a custom Object type here)
      if @val.type is "JsonType"
        bindToChildren @


