
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

Polymer "y-object",
  ready: ()->
    if @connector?
      @val = new Y @connector
      bindToChildren @
    else if @val?
      bindToChildren @

  valChanged: ()->
    if @val? and @val._name is "Object"
      bindToChildren @

  connectorChanged: ()->
    if (not @val?)
      @val = new Y @connector
      bindToChildren @

Polymer "y-property",
  ready: ()->
    if @val? and @name?
      if @val.constructor is Object
        @val = @parentElement.val(@name,new Y.Object(@val)).val(@name)
        # TODO: please use instanceof instead of ._name,
        # since it is more safe (consider someone putting a custom Object type here)
      else if typeof @val is "string"
        @parentElement.val(@name,@val)
      if @val._name is "Object"
        bindToChildren @

  valChanged: ()->
    if @val? and @name?
      if @val.constructor is Object
        @val = @parentElement.val.val(@name, new Y.Object(@val)).val(@name)
        # TODO: please use instanceof instead of ._name,
        # since it is more safe (consider someone putting a custom Object type here)
      else if @val._name is "Object"
        bindToChildren @
      else if @parentElement.val?.val? and @val isnt @parentElement.val.val(@name)
        @parentElement.val.val @name, @val
