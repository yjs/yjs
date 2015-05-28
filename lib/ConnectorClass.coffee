
module.exports =
  #
  # @params new Connector(options)
  #   @param options.syncMethod {String}  is either "syncAll" or "master-slave".
  #   @param options.role {String} The role of this client
  #            (slave or master (only used when syncMethod is master-slave))
  #   @param options.perform_send_again {Boolean} Whetehr to whether to resend the HB after some time period. This reduces sync errors, but has some overhead (optional)
  #
  init: (options)->
    req = (name, choices)=>
      if options[name]?
        if (not choices?) or choices.some((c)->c is options[name])
          @[name] = options[name]
        else
          throw new Error "You can set the '"+name+"' option to one of the following choices: "+JSON.encode(choices)
      else
        throw new Error "You must specify "+name+", when initializing the Connector!"

    req "syncMethod", ["syncAll", "master-slave"]
    req "role", ["master", "slave"]
    req "user_id"
    @on_user_id_set?(@user_id)

    # whether to resend the HB after some time period. This reduces sync errors.
    # But this is not necessary in the test-connector
    if options.perform_send_again?
      @perform_send_again = options.perform_send_again
    else
      @perform_send_again = true

    # A Master should sync with everyone! TODO: really? - for now its safer this way!
    if @role is "master"
      @syncMethod = "syncAll"

    # is set to true when this is synced with all other connections
    @is_synced = false
    # Peerjs Connections: key: conn-id, value: object
    @connections = {}
    # List of functions that shall process incoming data
    @receive_handlers ?= []

    # whether this instance is bound to any y instance
    @connections = {}
    @current_sync_target = null
    @sent_hb_to_all_users = false
    @is_initialized = true

  onUserEvent: (f)->
    @connections_listeners ?= []
    @connections_listeners.push f

  isRoleMaster: ->
    @role is "master"

  isRoleSlave: ->
    @role is "slave"

  findNewSyncTarget: ()->
    @current_sync_target = null
    if @syncMethod is "syncAll"
      for user, c of @connections
        if not c.is_synced
          @performSync user
          break
    if not @current_sync_target?
      @setStateSynced()
    null

  userLeft: (user)->
    delete @connections[user]
    @findNewSyncTarget()
    if @connections_listeners?
      for f in @connections_listeners
        f {
          action: "userLeft"
          user: user
        }


  userJoined: (user, role)->
    if not role?
      throw new Error "Internal: You must specify the role of the joined user! E.g. userJoined('uid:3939','slave')"
    # a user joined the room
    @connections[user] ?= {}
    @connections[user].is_synced = false

    if (not @is_synced) or @syncMethod is "syncAll"
      if @syncMethod is "syncAll"
        @performSync user
      else if role is "master"
        # TODO: What if there are two masters? Prevent sending everything two times!
        @performSyncWithMaster user

    if @connections_listeners?
      for f in @connections_listeners
        f {
          action: "userJoined"
          user: user
          role: role
        }

  #
  # Execute a function _when_ we are connected. If not connected, wait until connected.
  # @param f {Function} Will be executed on the Connector context.
  #
  whenSynced: (args)->
    if args.constructor is Function
      args = [args]
    if @is_synced
      args[0].apply this, args[1..]
    else
      @compute_when_synced ?= []
      @compute_when_synced.push args

  #
  # Execute an function when a message is received.
  # @param f {Function} Will be executed on the PeerJs-Connector context. f will be called with (sender_id, broadcast {true|false}, message).
  #
  onReceive: (f)->
    @receive_handlers.push f

  ###
  # Broadcast a message to all connected peers.
  # @param message {Object} The message to broadcast.
  #
  broadcast: (message)->
    throw new Error "You must implement broadcast!"

  #
  # Send a message to a peer, or set of peers
  #
  send: (peer_s, message)->
    throw new Error "You must implement send!"
  ###

  #
  # perform a sync with a specific user.
  #
  performSync: (user)->
    if not @current_sync_target?
      @current_sync_target = user
      @send user,
        sync_step: "getHB"
        send_again: "true"
        data: @getStateVector()
      if not @sent_hb_to_all_users
        @sent_hb_to_all_users = true

        hb = @getHB([]).hb
        _hb = []
        for o in hb
          _hb.push o
          if _hb.length > 10
            @broadcast
              sync_step: "applyHB_"
              data: _hb
            _hb = []
        @broadcast
          sync_step: "applyHB"
          data: _hb



  #
  # When a master node joined the room, perform this sync with him. It will ask the master for the HB,
  # and will broadcast his own HB
  #
  performSyncWithMaster: (user)->
    @current_sync_target = user
    @send user,
      sync_step: "getHB"
      send_again: "true"
      data: @getStateVector()
    hb = @getHB([]).hb
    _hb = []
    for o in hb
      _hb.push o
      if _hb.length > 10
        @broadcast
          sync_step: "applyHB_"
          data: _hb
        _hb = []
    @broadcast
      sync_step: "applyHB"
      data: _hb

  #
  # You are sure that all clients are synced, call this function.
  #
  setStateSynced: ()->
    if not @is_synced
      @is_synced = true
      if @compute_when_synced?
        for el in @compute_when_synced
          f = el[0]
          args = el[1..]
          f.apply(args)
        delete @compute_when_synced
      null

  # executed when the a state_vector is received. listener will be called only once!
  whenReceivedStateVector: (f)->
    @when_received_state_vector_listeners ?= []
    @when_received_state_vector_listeners.push f


  #
  # You received a raw message, and you know that it is intended for to Yjs. Then call this function.
  #
  receiveMessage: (sender, res)->
    if not res.sync_step?
      for f in @receive_handlers
        f sender, res
    else
      if sender is @user_id
        return
      if res.sync_step is "getHB"
        # call listeners
        if @when_received_state_vector_listeners?
          for f in @when_received_state_vector_listeners
            f.call this, res.data
        delete @when_received_state_vector_listeners

        data = @getHB(res.data)
        hb = data.hb
        _hb = []
        # always broadcast, when not synced.
        # This reduces errors, when the clients goes offline prematurely.
        # When this client only syncs to one other clients, but looses connectors,
        # before syncing to the other clients, the online clients have different states.
        # Since we do not want to perform regular syncs, this is a good alternative
        if @is_synced
          sendApplyHB = (m)=>
            @send sender, m
        else
          sendApplyHB = (m)=>
            @broadcast m

        for o in hb
          _hb.push o
          if _hb.length > 10
            sendApplyHB
              sync_step: "applyHB_"
              data: _hb
            _hb = []

        sendApplyHB
          sync_step : "applyHB"
          data: _hb

        if res.send_again? and @perform_send_again
          send_again = do (sv = data.state_vector)=>
            ()=>
              hb = @getHB(sv).hb
              for o in hb
                _hb.push o
                if _hb.length > 10
                  @send sender,
                    sync_step: "applyHB_"
                    data: _hb
                  _hb = []
              @send sender,
                sync_step: "applyHB",
                data: _hb
                sent_again: "true"
          setTimeout send_again, 3000
      else if res.sync_step is "applyHB"
        @applyHB(res.data, sender is @current_sync_target)

        if (@syncMethod is "syncAll" or res.sent_again?) and (not @is_synced) and ((@current_sync_target is sender) or (not @current_sync_target?))
          @connections[sender].is_synced = true
          @findNewSyncTarget()

      else if res.sync_step is "applyHB_"
        @applyHB(res.data, sender is @current_sync_target)


  # Currently, the HB encodes operations as JSON. For the moment I want to keep it
  # that way. Maybe we support encoding in the HB as XML in the future, but for now I don't want
  # too much overhead. Y is very likely to get changed a lot in the future
  #
  # Because we don't want to encode JSON as string (with character escaping, wich makes it pretty much unreadable)
  # we encode the JSON as XML.
  #
  # When the HB support encoding as XML, the format should look pretty much like this.

  # does not support primitive values as array elements
  # expects an ltx (less than xml) object
  parseMessageFromXml: (m)->
    parse_array = (node)->
      for n in node.children
        if n.getAttribute("isArray") is "true"
          parse_array n
        else
          parse_object n

    parse_object = (node)->
      json = {}
      for name, value  of node.attrs
        int = parseInt(value)
        if isNaN(int) or (""+int) isnt value
          json[name] = value
        else
          json[name] = int
      for n in node.children
        name = n.name
        if n.getAttribute("isArray") is "true"
          json[name] = parse_array n
        else
          json[name] = parse_object n
      json
    parse_object m

  # encode message in xml
  # we use string because Strophe only accepts an "xml-string"..
  # So {a:4,b:{c:5}} will look like
  # <y a="4">
  #   <b c="5"></b>
  # </y>
  # m - ltx element
  # json - guess it ;)
  #
  encodeMessageToXml: (m, json)->
    # attributes is optional
    encode_object = (m, json)->
      for name,value of json
        if not value?
          # nop
        else if value.constructor is Object
          encode_object m.c(name), value
        else if value.constructor is Array
          encode_array m.c(name), value
        else
          m.setAttribute(name,value)
      m
    encode_array = (m, array)->
      m.setAttribute("isArray","true")
      for e in array
        if e.constructor is Object
          encode_object m.c("array-element"), e
        else
          encode_array m.c("array-element"), e
      m
    if json.constructor is Object
      encode_object m.c("y",{xmlns:"http://y.ninja/connector-stanza"}), json
    else if json.constructor is Array
      encode_array m.c("y",{xmlns:"http://y.ninja/connector-stanza"}), json
    else
      throw new Error "I can't encode this json!"

  setIsBoundToY: ()->
    @on_bound_to_y?()
    delete @when_bound_to_y
    @is_bound_to_y = true
