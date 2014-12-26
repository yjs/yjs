
new Polymer 'peerjs-connector',
  join: (id)->
  idChanged: (old_val,new_val)->
    if this.is_initialized
      throw new Error "You must not set the user_id twice!"
    else
      this.initializeConnection()

  initializeConnection: ()-> 
    if this.conn_id?
      console.log("now initializing")
      options = {}
      writeIfAvailable = (name, value)->
        if value?
          options[name] = value
      writeIfAvailable 'key', this.key
      writeIfAvailable 'host', this.host
      writeIfAvailable 'port', this.port
      writeIfAvailable 'path', this.path
      writeIfAvailable 'secure', this.secure
      writeIfAvailable 'debug', this.debug
      this.is_initialized = true;
      this.connector = new PeerJsConnector this.conn_id, options

  ready: ()->
    if this.conn_id != null
      this.initializeConnection()
