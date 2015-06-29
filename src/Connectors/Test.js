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
  removeUser: function(user){

    for (var i in this.users) {
      this.users[i].userLeft(user);
    }
    delete this.users[user];
    delete this.buffers[user];
  },
  addUser: function(connector){
    for (var u of this.users) {
      u.userJoined(connector.userId);
    }
    this.users[connector.userId] = connector;
    this.buffers[connector.userId] = [];
  }
};

setInterval(function(){
  var bufs = [];
  for (var i in globalRoom.buffers) {
    if (globalRoom.buffers[i].length > 0) {
      bufs.push(i);
    }
  }
  if (bufs.length > 0) {
    var userId = getRandom(bufs);
    var m = globalRoom.buffers[userId];
    var user = globalRoom.users[userId];
    user.receiveMessage(m);
  }
}, 10);

var userIdCounter = 0;

class Test extends AbstractConnector {
  constructor (y, options) {
    if(options === undefined){
      throw new Error("Options must not be undefined!");
    }
    super(y, {
      role: "master"
    });

    this.setUserId((userIdCounter++) + "");
  }
  send (uid, message) {
    globalRoom.buffers[uid].push(message);
  }
  broadcast (message) {
    for (var buf of globalRoom.buffers) {
      buf.push(message);
    }
  }
  disconnect () {
    globalRoom.removeUser(this.userId);
  }
}

Y.Test = Test;
