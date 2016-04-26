
# ![Yjs](http://y-js.org/images/yjs.png)

Yjs is a framework for optimistic concurrency control and automatic conflict resolution on shared data.
The framework provides similar functionality as [ShareJs] and [OpenCoweb], but supports peer-to-peer
communication protocols by default. Yjs was designed to handle concurrent actions on arbitrary data
like Text, Json, and XML. We also provide support for storing and manipulating your shared data offline.
For more information and demo applications visit our [homepage](http://y-js.org/).

You can create you own shared types easily.
Therefore, you can design the structure of your custom type,
and ensure data validity, while Yjs ensures data consistency (everyone will eventually end up with the same data).
We already provide abstract data types for

| Name     | Description       |
|----------|-------------------|
|[map](https://github.com/y-js/y-map) | A shared Map implementation. Maps from text to any stringify-able object |
|[array](https://github.com/y-js/y-array) | A shared Array implementation |
|[xml](https://github.com/y-js/y-xml) | An implementation of the DOM. You can create a two way binding to Browser DOM objects |
|[text](https://github.com/y-js/y-text) | Collaborate on text. Supports two way binding to textareas, input elements, or HTML elements (e.g. <*h1*>, or <*p*>). Also supports the [Ace Editor](https://ace.c9.io) |
|[richtext](https://github.com/y-js/y-richtext) | Collaborate on rich text. Supports two way binding to the [Quill Rich Text Editor](http://quilljs.com/)|

Yjs supports P2P message propagation, and is not bound to a specific communication protocol. Therefore, Yjs is extremely scalable and can be used in a wide range of application scenarios.

We support several communication protocols as so called *Connectors*.
You can create your own connector too - read [this wiki page](https://github.com/y-js/yjs/wiki/Custom-Connectors).
Currently, we support the following communication protocols:

|Name            | Description               |
|----------------|-----------------------------------|
|[xmpp](https://github.com/y-js/y-xmpp) | Propagate updates in a XMPP multi-user-chat room ([XEP-0045](http://xmpp.org/extensions/xep-0045.html))|
|[webrtc](https://github.com/y-js/y-webrtc) | Propagate updates Browser2Browser via WebRTC|
|[websockets](https://github.com/y-js/y-websockets-client) | Exchange updates efficiently in the classical client-server model |
|[test](https://github.com/y-js/y-test) | A Connector for testing purposes. It is designed to simulate delays that happen in worst case scenarios|

You are not limited to use a specific database to store the shared data. We provide the following database adapters:

|Name            | Description               |
|----------------|-----------------------------------|
|[memory](https://github.com/y-js/y-memory) | In-memory storage. |
|[indexeddb](https://github.com/y-js/y-indexeddb) | Offline storage for the browser |

The advantages over similar frameworks are support for
* .. P2P message propagation and arbitrary communication protocols
* .. share any type of data. The types provide a convenient interface
* .. offline support: Changes are stored persistently and only relevant changes are propagated on rejoin
* .. Intention Preservation: When working on Text, the intention of your changes are preserved. This is particularily important when working offline. Every type has a notion on how we define Intention Preservation on it.

## Use it!
Install yjs and its modules with [bower](http://bower.io/), or with [npm](https://www.npmjs.org/package/yjs).

### Bower
```
bower install yjs --save
```
Then you include the libraries directly from the installation folder.
```
<script src="./bower_components/yjs/y.js"></script>
```

### Npm
```
npm install yjs --save
```

And use it like this with *npm*:
```
Y = require("yjs");
```

# Text editing example
```
Y({
  db: {
    name: 'memory' // store in memory.
    // name: 'indexeddb'
  },
  connector: {
    name: 'websockets-client', // choose the websockets connector
    // name: 'webrtc'
    // name: 'xmpp'
    room: 'Textarea-example-dev'
  },
  sourceDir: '/bower_components', // location of the y-* modules
  share: {
    textarea: 'Text' // y.share.textarea is of type Y.Text
  }
  // types: ['Richtext', 'Array'] // optional list of types you want to import
}).then(function (y) {
  // bind the textarea to a shared text element
  y.share.textarea.bind(document.getElementById('textfield'))
}
```

# Api

### Y(options)
* options.db
  * Will be forwarded to the database adapter. Specify the database adaper on `options.db.name`.
  * Have a look at the used database adapter repository to see all available options.
* options.connector
  * Will be forwarded to the connector adapter. Specify the connector adaper on `options.connector.name`.
  * All our connectors implement a `room` property. Clients that specify the same room share the same data.
  * All of our connectors specify an `url` property that defines the connection endpoint of the used connector.
    * All of our connectors also have a default connection endpoint that you can use for development. 
  * Have a look at the used connector repository to see all available options.
* options.sourceDir
  * Path where all y-* modules are stored.
  * Defaults to `/bower_components`
  * Not required when running on `nodejs` / `iojs`
  * When using browserify you can specify all used modules like this:
```
var Y = require('yjs')
// you need to require the db, connector, and *all* types you use! 
require('y-memory')(Y)
require('y-webrtc')(Y)
require('y-map')(Y)
// ..
``` 
* options.share
  * Specify on `options.share[arbitraryName]` types that are shared among all users.
  * E.g. Specify `options.share[arbitraryName] = 'Array'` to require y-array and create an Y.Array type on `y.share[arbitraryName]`.
  * If userA doesn't specify `options.share[arbitraryName]`, it won't be available for userA.
  * If userB specifies `options.share[arbitraryName]`, it still won't be available for userA. But all the updates are send from userB to userA.
  * In contrast to Y.Map, types on `y.share.*` cannot be overwritten or deleted. Instead, they are merged among all users. This feature is only available on `y.share.*`
  * Weird behavior: It is supported that two users specify different types with the same property name.
     E.g. userA specifies `options.share.x = 'Array'`, and userB specifies `options.share.x = 'Text'`. But they'll only share data if they specified the same type with the same property name
* options.type
  * Array of modules that Yjs needs to require, before instantiating a shared type.
  * By default Yjs requires the specified database adapter, the specified connector, and all modules that are used in `options.share.*`
  * Put all types here that you intend to use, but are not used in y.share.*

### Instantiated Y object (y)
`Y(options)` returns a promise that is fulfilled when..

* All modules are loaded
  * The specified database adapter is loaded
  * The specified connector is loaded
  * All types are included
* The connector is initialized, and a unique user id is set (received from the server)
  * Note: When using y-indexeddb, a retrieved user id is stored on `localStorage`

The promise returns an instance of Y. We denote it with a lower case `y`.

* y.share.*
  * Instances of the types you specified on options.share.*
  * y.share.* can only be defined once when you instantiate Y!
* y.connector is an instance of Y.AbstractConnector
* y.connector.onUserEvent(function (event) {..})
  * Observe user events (event.action is either 'userLeft' or 'userJoined')
* y.connector.whenSynced(listener)
  * `listener` is executed when y synced with at least one user.
  * `listener` is not called when no other user is in the same room.
  * y-websockets-client aways waits to sync with the server
* y.connector.disconnect()
  * Force to disconnect this instance from the other instances
* y.connector.reconnect()
  * Try to reconnect to the other instances (needs to be supported by the connector)
  * Not supported by y-xmpp 
* y.destroy()
  * Destroy this object.
  * Destroys all types (they will throw weird errors if you still use them)
  * Disconnects from the other instances (via connector)
  * Removes all data from the database
* y.db.stopGarbageCollector()
  * Stop the garbage collector. Call y.db.garbageCollect() to continue garbage collection
* y.db.gcTimeout :: Number (defaults to 50000 ms)
  * Time interval between two garbage collect cycles
  * It is required that all instances exchanged all messages after two garbage collect cycles (after 100000 ms per default)
* y.db.userId :: String
  * The used user id for this client. **Never overwrite this**

## Get help
There are some friendly people on [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/y-js/yjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) who may help you with your problem, and answer your questions.

Please report _any_ issues to the [Github issue page](https://github.com/y-js/yjs/issues)! I try to fix them very soon, if possible.
If you want to see an issue fixed, please subscribe to the thread (or remind me via gitter).


## Changelog

### 11.0.0

* **All types now return a single event instead of list of events**
  * Insert events contain a list of values
* Improved performance for large insertions & deletions
* Several bugfixes (offline editing related)
* Native support for node 4 (see #49)

### 10.0.0

* Support for more complex types (a type can be a composition of several types)
* Fixes several memory leaks

### 9.0.0
There were several rolling updates from 0.6 to 0.8. We consider Yjs stable since a long time, 
and intend to continue stable releases. From this release forward y-* modules will implement peer-dependencies for npm, and dependencies for bower.
Furthermore, incompatible yjs instances will now throw errors when syncing - this feature was influenced by #48. The versioning jump was influenced by react (see [here](https://facebook.github.io/react/blog/2016/02/19/new-versioning-scheme.html))


### 0.6.0
This is a complete rewrite of the 0.5 version of Yjs. Since Yjs 0.6.0 it is possible to work asynchronously on a persistent database, which enables offline support.
* Switched to semver versioning
* Requires a promise implementation in environment (es6 promises suffice, included in all the major browsers). Otherwise you have to include a polyfill
* Y.Object has been renamed to Y.Map
* Y.Map exchanges `.val(name [, value])` in favor of `.set(name, value)` and `.get(name)`
* Y.Map `.get(name)` returns a promise, if the value is a custom type
* The Connector definition slightly changed (I'll update the wiki)
* The Type definitions completely changed, so you have to rewrite them (I'll rewrite the article in the wiki)
* Support for several packaging systems
* Flowtype


## Contribution
I created this framework during my bachelor thesis at the chair of computer science 5 [(i5)](http://dbis.rwth-aachen.de/cms), RWTH University. Since December 2014 I'm working on Yjs as a part of my student worker job at the i5.

## License
Yjs is licensed under the [MIT License](./LICENSE.txt).

<yjs@dbis.rwth-aachen.de>

[ShareJs]: https://github.com/share/ShareJS
[OpenCoweb]: https://github.com/opencoweb/coweb/wiki

