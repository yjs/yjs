# WebRTC Connector for [Yjs](https://github.com/y-js/yjs)


It propagates document updates directly to all users via WebRTC. While WebRTC is not the most reliable connector, messages are propagated with almost no delay.

* Very fast message propagation (not noticeable)
* Very easy to use
* Very little server load (you still have to set up a [signaling server](http://www.html5rocks.com/en/tutorials/webrtc/infrastructure/))
* Not suited for a large amount of collaborators
* WebRTC is not supported in all browsers, and some have troubles communicating with each other

We provide you with a free signaling server (it is used by default), but in production you should set up your own signaling server. You could use the [signalmaster](https://github.com/andyet/signalmaster) from &yet, which is very easy to set up.

## Use it!
Retrieve this with bower or npm, and use it as a js library or as a custom polymer element.

##### NPM
```
npm install y-webrtc --save
```
and put it on the `Y` object.

```
Y.WebRTC = require("y-webrtc");
```

##### Bower
```
bower install y-webrtc --save
```

##### Polymer
On the website you find a bunch of examples on how you can use Yjs as polymer element.
```
<link rel="import" href="../y-webrtc/y-webrtc.html">
<y-webrtc connector={{connector}} room="my-room-name"></y-webrtc>
```

### Create the connection object
This connector uses [SimpleWebRTC](https://simplewebrtc.com/) as an underlaying WebRTC framework, which supports the concept of rooms.

```
var options = {};
var conn = new Y.WebRTC("my_room_name", options); // will connect to the default signaling server
```

On the options object you can put the following properties:
* url (optional)
  * Set the url of your signaling server. E.g. url = "https://yatta.ninja:8888" (which is the default endpoint)
* debug (optional)
  * Whether to enable debugging mode (defaults to false)

# Start Hacking
This connector is also a nice starting point to build your own connector. The only 75 SLOCs of code are pretty well documented and understandable. If you have any troubles, don't hesitate to ask me for help!

### Directory Structure
* lib/
  * Source files
* build/browser
  * Unminified, but [browserified](http://browserify.org/) source files
* build/node
  * npm modules


## License
Yjs is licensed under the [MIT License](./LICENSE.txt).

<kevin.jahns@rwth-aachen.de>


