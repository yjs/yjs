
# ![Yjs](http://y-js.org/images/yjs.png)

Yjs is a framework for p2p shared editing on structured data like (rich-)text, json, and XML.
It is similar to [ShareJs] and [OpenCoweb], but easy to use.
For additional information, demos, and tutorials visit [y-js.org](http://y-js.org/).

### Extensions
Yjs only knows how to resolve conflicts on shared data. You have to choose a ..
* *Connector* - a communication protocol that propagates changes to the clients 
* *Database* - a database to store your changes
* one or more *Types* - that represent the shared data

Connectors, Databases, and Types are available as modules that extend Yjs. Here is a list of the modules we know of:

##### Connectors

|Name            | Description               |
|----------------|-----------------------------------|
|[webrtc](https://github.com/y-js/y-webrtc) | Propagate updates Browser2Browser via WebRTC|
|[websockets](https://github.com/y-js/y-websockets-client) | Set up [a central server](https://github.com/y-js/y-websockets-client), and connect to it via websockets |
|[xmpp](https://github.com/y-js/y-xmpp) | Propagate updates in a XMPP multi-user-chat room ([XEP-0045](http://xmpp.org/extensions/xep-0045.html))|
|[test](https://github.com/y-js/y-test) | A Connector for testing purposes. It is designed to simulate delays that happen in worst case scenarios|

##### Database adapters

|Name            | Description               |
|----------------|-----------------------------------|
|[memory](https://github.com/y-js/y-memory) | In-memory storage. |
|[indexeddb](https://github.com/y-js/y-indexeddb) | Offline storage for the browser |
|[leveldb](https://github.com/y-js/y-leveldb) | Persistent storage for node apps |


##### Types

| Name     | Description       |
|----------|-------------------|
|[map](https://github.com/y-js/y-map) | A shared Map implementation. Maps from text to any stringify-able object |
|[array](https://github.com/y-js/y-array) | A shared Array implementation |
|[xml](https://github.com/y-js/y-xml) | An implementation of the DOM. You can create a two way binding to Browser DOM objects |
|[text](https://github.com/y-js/y-text) | Collaborate on text. Supports two way binding to the [Ace Editor](https://ace.c9.io), textareas, input elements, and HTML elements (e.g. <*h1*>, or <*p*>) |
|[richtext](https://github.com/y-js/y-richtext) | Collaborate on rich text. Supports two way binding to the [Quill Rich Text Editor](http://quilljs.com/)|

## Use it! 
Install Yjs, and its modules with [bower](http://bower.io/), or [npm](https://www.npmjs.org/package/yjs).  

### Bower
```
bower install --save yjs y-array % add all y-* modules you want to use
```
You only need to include the `y.js` file. Yjs is able to automatically require missing modules.  
```
<script src="./bower_components/yjs/y.js"></script>
```

### Npm
```
npm install --save yjs % add all y-* modules you want to use
```

When using npm, you also need to import all modules you want to use.
```
Y = require('yjs')
require('y-array')(Y) // add the y-array type to Yjs
// require('y-websockets-client')(Y) // do the same for all modules you want to use
```

# Text editing example
```
Y({
  db: {
    name: 'memory' // store in memory.
    // name: 'indexeddb'
    // name: 'leveldb'
  },
  connector: {
    name: 'websockets-client', // choose the websockets connector
    // name: 'webrtc'
    // name: 'xmpp'
    room: 'Textarea-example-dev'
  },
  sourceDir: '/bower_components', // location of the y-* modules (bower only)
  share: {
    textarea: 'Text' // y.share.textarea is of type Y.Text
  }
  // types: ['Richtext', 'Array'] // optional list of types you want to import (bower only)
}).then(function (y) {
  // bind the textarea to a shared text element
  y.share.textarea.bind(document.getElementById('textfield'))
}
```
## Get help
There are some friendly people on [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/y-js/yjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) who are eager to help, and answer questions.

Please report _any_ issues to the [Github issue page](https://github.com/y-js/yjs/issues)! I try to fix them very soon, if possible.

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
* options.sourceDir (browser only)
  * Path where all y-* modules are stored
  * Defaults to `/bower_components`
  * Not required when running on `nodejs` / `iojs`
  * When using nodejs you need to manually extend Yjs:
```
var Y = require('yjs')
// you have to require a db, connector, and *all* types you use! 
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
     E.g. userA specifies `options.share.x = 'Array'`, and userB specifies `options.share.x = 'Text'`. But they only share data if they specified the same type with the same property name
* options.type (browser only)
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

## Changelog

### 12.0.0
* **Types are synchronous and never return a promise (except explicitly stated)**
  * `y.share.map.get('map type') // => returns a Y.Map instead of a promise`
  * The event property `oldValues`, and `values` contain a list of values (without wrapper)
* Support for the [y-leveldb](https://github.com/y-js/y-leveldb) database adapter
* [y-richtext](https://github.com/y-js/y-richtext) supports Quill@1.0.0-rc.2

### 11.0.0

* **All types return a single event instead of list of events**
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
Furthermore, incompatible yjs instances throw errors now when syncing - this feature was influenced by #48. The versioning jump was influenced by react (see [here](https://facebook.github.io/react/blog/2016/02/19/new-versioning-scheme.html))


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

