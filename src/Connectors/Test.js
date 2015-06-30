// returns a random element of o
// works on Object, and Array
function getRandom (o) {
  if (o instanceof Array) {
    return o[Math.floor(Math.random() * o.length)];
  } else if (o.constructor === Object) {
    var keys = [];
    for (var key in o) {
      keys.push(key);
    }
    return o[getRandom(keys)];
  }
}

var globalRoom = {
  users: {},
  buffers: {},
  removeUser: function(user : AbstractConnector){

    for (var i in this.users) {
      this.users[i].userLeft(user);
    }
    delete this.users[user];
    delete this.buffers[user];
  },
  addUser: function(connector){
    this.users[connector.userId] = connector;
    this.buffers[connector.userId] = [];
    for (var uname in this.users) {
      if (uname !== connector.userId) {
        var u = this.users[uname];
        u.userJoined(connector.userId, "master");
        connector.userJoined(u.userId, "master");
      }
    }
  }
};
function flushOne(){
  var bufs = [];
  for (var i in globalRoom.buffers) {
    if (globalRoom.buffers[i].length > 0) {
      bufs.push(i);
    }
  }
  if (bufs.length > 0) {
    var userId = getRandom(bufs);
    var m = globalRoom.buffers[userId].shift();
    var user = globalRoom.users[userId];
    user.receiveMessage(m[0], m[1]);
    return true;
  } else {
    return false;
  }
}
setInterval(flushOne, 10);

var userIdCounter = 0;

class Test extends AbstractConnector {
  constructor (y, options) {
    if(options === undefined){
      throw new Error("Options must not be undefined!");
    }
    options.role = "master";
    options.forwardToSyncingClients = false;
    super(y, options);
    this.setUserId((userIdCounter++) + "");
    globalRoom.addUser(this);
    this.globalRoom = globalRoom;
  }
  send (userId, message) {
    globalRoom.buffers[userId].push([this.userId, message]);
  }
  broadcast (message) {
    for (var key in globalRoom.buffers) {
      globalRoom.buffers[key].push([this.userId, message]);
    }
  }
  disconnect () {
    globalRoom.removeUser(this.userId);
  }
  flushAll () {
    var c = true;
    while (c) {
      c = flushOne();
    }
  }
}

Y.Test = Test;
