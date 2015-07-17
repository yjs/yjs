
class AbstractConnector { //eslint-disable-line no-unused-vars
  /*
    opts
     .role : String Role of this client ("master" or "slave")
     .userId : String that uniquely defines the user.
  */
  constructor (y, opts) {
    this.y = y;
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
    this.syncingClients = [];
    this.forwardToSyncingClients = (opts.forwardToSyncingClients === false) ? false : true;
    this.debug = opts.debug ? true : false;
    this.broadcastedHB = false;
  }
  setUserId (userId) {
    this.userId = userId;
    this.y.db.setUserId(userId);
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
    if (this.currentSyncTarget == null) {
      this.findNextSyncTarget();
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
      throw new Error("The current sync has not finished!");
    }

    var syncUser = null;
    for (var uid in this.connections) {
      syncUser = this.connections[uid];
      if (!syncUser.isSynced) {
        break;
      }
    }
    if (syncUser != null){
      var conn = this;
      this.y.db.requestTransaction(function*(){
        conn.currentSyncTarget = uid;
        conn.send(uid, {
          type: "sync step 1",
          stateVector: yield* this.getStateVector()
        });
      });
    }
    // set the state to synced!
    if (!this.isSynced) {
      this.isSynced = true;
      for (var f of this.whenSyncedListeners) {
        f();
      }
      this.whenSyncedListeners = null;
    }
    return false;
  }
  // You received a raw message, and you know that it is intended for to Yjs. Then call this function.
  receiveMessage (sender, m){
    if (sender === this.userId) {
      return;
    }
    if (this.debug) {
      console.log(`${sender} -> me: ${m.type}`);//eslint-disable-line
      console.dir(m); //eslint-disable-line
    }
    if (m.type === "sync step 1") {
      // TODO: make transaction, stream the ops
      let conn = this;
      this.y.db.requestTransaction(function*(){
        var ops = yield* this.getOperations(m.stateVector);
        var sv = yield* this.getStateVector();
        conn.send(sender, {
          type: "sync step 2",
          os: ops,
          stateVector: sv
        });
        if (this.forwardToSyncingClients) {
          conn.syncingClients.push(sender);
          setTimeout(function(){
            conn.syncingClients = conn.syncingClients.filter(function(cli){
              return cli !== sender;
            });
            conn.send(sender, {
              type: "sync done"
            });
          }, conn.syncingClientDuration);
        }
      });
    } else if (m.type === "sync step 2") {
      this.y.db.apply(m.os);
      let conn = this;
      this.y.db.requestTransaction(function*(){
        var ops = yield* this.getOperations(m.stateVector);
        conn.broadcastedHB = true;
        if (ops.length > 0) {
          conn.broadcast({
            type: "update",
            ops: ops
          });
        }
      });
    } else if (m.type === "sync done") {
      this.connections[sender].isSynced = true;
      this.findNextSyncTarget();
    } else if (m.type === "update") {
      if (this.forwardToSyncingClients) {
        for (var client of this.syncingClients) {
          this.send(client, m);
        }
      }
      this.y.db.apply(m.ops);
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
      for (var attrName in node.attrs) {
        var value = node.attrs[attrName];
        var int = parseInt(value);
        if (isNaN(int) || ("" + int) !== value){
          json[attrName] = value;
        } else {
          json[attrName] = int;
        }
      }
      for (var n in node.children){
        var name = n.name;
        if (n.getAttribute("isArray") === "true") {
          json[name] = parseArray(n);
        } else {
          json[name] = parseObject(n);
        }
      }
      return json;
    }
    parseObject(m);
  }
  // encode message in xml
  // we use string because Strophe only accepts an "xml-string"..
  // So {a:4,b:{c:5}} will look like
  // <y a="4">
  //   <b c="5"></b>
  // </y>
  // m - ltx element
  // json - Object
  encodeMessageToXml (msg, obj) {
    // attributes is optional
    function encodeObject (m, json) {
      for (var name in json) {
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
    if (obj.constructor === Object) {
      encodeObject(msg.c("y", { xmlns: "http://y.ninja/connector-stanza" }), obj);
    } else if (obj.constructor === Array) {
      encodeArray(msg.c("y", { xmlns: "http://y.ninja/connector-stanza" }), obj);
    } else {
      throw new Error("I can't encode this json!");
    }
  }
}
