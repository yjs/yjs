
class AbstractConnector {
  /*
    opts
     .role : String Role of this client ("master" or "slave")
     .userId : String that uniquely defines the user.
  */
  constructor (opts) {
    if (opts == null){
      opts = {};
    }
    if (opts.role == null || opts.role === "master") {
      this.role = "master";
    } else if (opts.role === "slave") {
      this.role = "slave";
    } else {
      throw new Error("Role must be either 'master' or 'slave'!");
    }
    this.role = opts.role;
    this.connections = {};
    this.userEventListeners = [];
    this.whenSyncedListeners = [];
    this.currentSyncTarget = null;
  }
  setUserId (userId) {
    this.os.setUserId(userId);
  }
  onUserEvent (f) {
    this.userEventListeners.push(f);
  }
  userLeft (user : string) {
    delete this.connections[user];
    if (user === this.currentSyncTarget){
      this.currentSyncTarget = null;
      this.findNextSyncTarget();
    }
    for (var f of this.userEventListeners){
      f({
        action: "userLeft",
        user: user
      });
    }
  }
  userJoined (user, role) {
    if(role == null){
      throw new Error("You must specify the role of the joined user!");
    }
    if (this.connections[user] != null) {
      throw new Error("This user already joined!");
    }
    this.connections[user] = {
      isSynced: false,
      role: role
    };
    for (var f of this.userEventListeners) {
      f({
        action: "userJoined",
        user: user,
        role: role
      });
    }
  }
  // Execute a function _when_ we are connected.
  // If not connected, wait until connected
  whenSynced (f) {
    if (this.isSynced === true) {
      f();
    } else {
      this.whenSyncedListeners.push(f);
    }
  }
  // returns false, if there is no sync target
  // true otherwise
  findNextSyncTarget () {
    if (this.currentSyncTarget != null && this.connections[this.currentSyncTarget].isSynced === false) {
      throw new Error("The current sync has not finished!")
    }

    for (var uid in this.connections) {
      var u = this.connections[uid];
      if (!u.isSynced) {
        this.currentSyncTarget = uid;
        this.send(uid, {
            type: "sync step 1",
            stateVector: hb.getStateVector()
        });
        return true;
      }
    }
    // set the state to synced!
    if (!this.isSynced) {
      this.isSynced = true;
      for (var f of this.whenSyncedListeners) {
        f()
      }
      this.whenSyncedListeners = null;
    }    return false;
  }
  // You received a raw message, and you know that it is intended for to Yjs. Then call this function.
  receiveMessage (sender, m) {
    if (m.type === "sync step 1") {
      // TODO: make transaction, stream the ops
      var ops = yield* this.os.getOperations(m.stateVector);
      // TODO: compare against m.sv!
      var sv = yield* this.getStateVector();
      this.send (sender, {
        type: "sync step 2"
        os: ops,
        stateVector: sv
      });
      this.syncingClients.push(sender);
      setTimeout(()=>{
        this.syncingClients = this.syncingClients.filter(function(client){
          return client !== sender;
        });
        this.send(sender, {
          type: "sync done"
        })
      }, this.syncingClientDuration);
    } else if (m.type === "sync step 2") {
      var ops = this.os.getOperations(m.stateVector);
      this.broadcast {
        type: "update",
        ops: ops
      }
    } else if (m.type === "sync done") {
      this.connections[sender].isSynced = true;
      this.findNextSyncTarget();
    }
    } else if (m.type === "update") {
      for (var client of this.syncingClients) {
        this.send(client, m);
      }
      this.os.apply(m.ops);
    }
  }
  // Currently, the HB encodes operations as JSON. For the moment I want to keep it
  // that way. Maybe we support encoding in the HB as XML in the future, but for now I don't want
  // too much overhead. Y is very likely to get changed a lot in the future
  //
  // Because we don't want to encode JSON as string (with character escaping, wich makes it pretty much unreadable)
  // we encode the JSON as XML.
  //
  // When the HB support encoding as XML, the format should look pretty much like this.
  //
  // does not support primitive values as array elements
  // expects an ltx (less than xml) object
  parseMessageFromXml (m) {
    function parseArray (node) {
      for (var n of node.children){
        if (n.getAttribute("isArray") === "true") {
          return parseArray(n);
        } else {
          return parseObject(n);
        }
      }
    }
    function parseObject (node) {
      var json = {};
      for (name in node.attrs) {
        var value = node.attrs[name];
        var int = parseInt(value);
        if (isNaN(int) or (""+int) !== value){
          json[name] = value;
        } else {
          json[name] = int;
        }
      }
      for (n in node.children){
        var name = n.name;
        if (n.getAttribute("isArray") === "true") {
          json[name] = parseArray(n);
        } else {
          json[name] = parseObject(n);
        }
      }
      return json;
    }
    parseObject(node);
  }
  // encode message in xml
  // we use string because Strophe only accepts an "xml-string"..
  // So {a:4,b:{c:5}} will look like
  // <y a="4">
  //   <b c="5"></b>
  // </y>
  // m - ltx element
  // json - Object
  encodeMessageToXml (m, json) {
    // attributes is optional
    function encodeObject (m, json) {
      for (name in json) {
        var value = json[name];
        if (name == null) {
          // nop
        } else if (value.constructor === Object) {
          encodeObject(m.c(name), value);
        } else if (value.constructor === Array) {
          encodeArray(m.c(name), value);
        } else {
          m.setAttribute(name, value);
        }
      }
    }
    function encodeArray (m, array) {
      m.setAttribute("isArray", "true");
      for (var e of array) {
        if (e.constructor === Object) {
          encodeObject(m.c("array-element"), e);
        } else {
          encodeArray(m.c("array-element"), e);
        }
      }
    }
    if (json.constructor === Object) {
      encodeObject(m.c("y", {xmlns:"http://y.ninja/connector-stanza"}), json);
    } else if (json.constructor === Array) {
      encodeArray(m.c("y", {xmlns:"http://y.ninja/connector-stanza"}), json);
    } else {
      throw new Error("I can't encode this json!");
    }
  }
}
