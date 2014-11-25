(function() {
  new Polymer('peerjs-connector', {
    join: function(id) {},
    idChanged: function(old_val, new_val) {
      if (this.is_initialized) {
        throw new Error("You must not set the user_id twice!");
      } else {
        return this.initializeConnection();
      }
    },
    initializeConnection: function() {
      var options, writeIfAvailable;
      if (this.conn_id != null) {
        console.log("now initializing");
        options = {};
        writeIfAvailable = function(name, value) {
          if (value != null) {
            return options[name] = value;
          }
        };
        writeIfAvailable('key', this.key);
        writeIfAvailable('host', this.host);
        writeIfAvailable('port', this.port);
        writeIfAvailable('path', this.path);
        writeIfAvailable('secure', this.secure);
        writeIfAvailable('debug', this.debug);
        this.is_initialized = true;
        return this.connector = new PeerJsConnector(this.conn_id, options);
      }
    },
    ready: function() {
      if (this.conn_id !== null) {
        return this.initializeConnection();
      }
    }
  });

}).call(this);

//# sourceMappingURL=sourcemaps/peerjs-connector-polymer.js.map