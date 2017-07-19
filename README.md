
# ![Yjs](http://y-js.org/images/yjs.png)

Yjs is a framework for offline-first p2p shared editing on structured data like
text, richtext, json, or XML. It is fairly easy to get started, as Yjs hides
most of the complexity of concurrent editing. For additional information, demos,
and tutorials visit [y-js.org](http://y-js.org/).

### Extensions
Yjs only knows how to resolve conflicts on shared data. You have to choose a ..
* *Connector* - a communication protocol that propagates changes to the clients
* *Database* - a database to store your changes
* one or more *Types* - that represent the shared data

Connectors, Databases, and Types are available as modules that extend Yjs. Here
is a list of the modules we know of:

##### Connectors

|Name            | Description               |
|----------------|-----------------------------------|
|[webrtc](https://github.com/y-js/y-webrtc) | Propagate updates Browser2Browser via WebRTC|
|[websockets](https://github.com/y-js/y-websockets-client) | Set up [a central server](https://github.com/y-js/y-websockets-client), and connect to it via websockets |
|[xmpp](https://github.com/y-js/y-xmpp) | Propagate updates in a XMPP multi-user-chat room ([XEP-0045](http://xmpp.org/extensions/xep-0045.html))|
|[ipfs](https://github.com/ipfs-labs/y-ipfs-connector) | Connector for the [Interplanetary File System](https://ipfs.io/)!|
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
|[text](https://github.com/y-js/y-text) | Collaborate on text. Supports two way binding to the [Ace Editor](https://ace.c9.io), [CodeMirror](https://codemirror.net/), [Monaco](https://github.com/Microsoft/monaco-editor), textareas, input elements, and HTML elements (e.g. <*h1*>, or <*p*>) |
|[richtext](https://github.com/y-js/y-richtext) | Collaborate on rich text. Supports two way binding to the [Quill Rich Text Editor](http://quilljs.com/)|

##### Other

| Name      | Description       |
|-----------|-------------------|
|[y-element](http://y-js.org/y-element/) | Yjs Polymer Element |

## Use it!
Install Yjs, and its modules with [bower](http://bower.io/), or
[npm](https://www.npmjs.org/package/yjs).

### Bower
```sh
bower install --save yjs y-array % add all y-* modules you want to use
```
You only need to include the `y.js` file. Yjs is able to automatically require
missing modules.  
```html
<script src="./bower_components/yjs/y.js"></script>
```

### Npm
```sh
npm install --save yjs % add all y-* modules you want to use
```

If you don't include via script tag, you have to explicitly include all modules!
(Same goes for other module systems)
```js
var Y = require('yjs')
require('y-array')(Y) // add the y-array type to Yjs
require('y-websockets-client')(Y)
require('y-memory')(Y)
require('y-array')(Y)
require('y-map')(Y)
require('y-text')(Y)
// ..
// do the same for all modules you want to use
```

### ES6 Syntax
```js
import Y from 'yjs'
import yArray from 'y-array'
import yWebsocketsClient from 'y-webrtc'
import yMemory from 'y-memory'
import yArray from 'y-array'
import yMap from 'y-map'
import yText from 'y-text'
// ..
Y.extend(yArray, yWebsocketsClient, yMemory, yArray, yMap, yText /*, .. */)
```

# Text editing example
Install dependencies
```sh
bower i yjs y-memory y-webrtc y-array y-text
```

Here is a simple example of a shared textarea
```HTML
  <!DOCTYPE html>
  <html>
    <body>
      <script src="./bower_components/yjs/y.js"></script>
      <!-- Yjs automatically includes all missing dependencies (browser only) -->
      <script>
        Y({
          db: {
            name: 'memory' // use memory database adapter.
            // name: 'indexeddb' // use indexeddb database adapter instead for offline apps
          },
          connector: {
            name: 'webrtc', // use webrtc connector
            // name: 'websockets-client'
            // name: 'xmpp'
            room: 'my-room' // clients connecting to the same room share data
          },
          sourceDir: '/bower_components', // location of the y-* modules (browser only)
          share: {
            textarea: 'Text' // y.share.textarea is of type y-text
          }
        }).then(function (y) {
          // The Yjs instance `y` is available
          // y.share.* contains the shared types

          // Bind `y.share.textarea` to `<textarea/>`
          y.share.textarea.bind(document.querySelector('textarea'))
        })
      </script>
      <textarea></textarea>
    </body>
  </html>
```

## Get Help & Give Help
There are some friendly people on [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/y-js/yjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) who are eager to help, and answer questions. Please join!

Report _any_ issues to the
[Github issue page](https://github.com/y-js/yjs/issues)! I try to fix them very
soon, if possible.

# API

### Y(options)
* Y.extend(module1, module2, ..)
  * Add extensions to Y
  * `Y.extend(require('y-webrtc'))` has the same semantics as
    `require('y-webrtc')(Y)`
* options.db
  * Will be forwarded to the database adapter. Specify the database adaper on
    `options.db.name`.
  * Have a look at the used database adapter repository to see all available
    options.
* options.connector
  * Will be forwarded to the connector adapter. Specify the connector adaper on
    `options.connector.name`.
  * All our connectors implement a `room` property. Clients that specify the
    same room share the same data.
  * All of our connectors specify an `url` property that defines the connection
    endpoint of the used connector.
    * All of our connectors also have a default connection endpoint that you can
      use for development.
  * We provide basic authentification for all connectors. The value of
    `options.connector.auth` (this can be a passphase) is sent to all connected
    Yjs instances. `options.connector.checkAuth` may grant read or write access
    depending on the `auth` information.
    Example: A client specifies `options.connector.auth = 'superSecretPassword`.
    A server specifies
    ```js
    options.connector.checkAuth = function (auth, yjsInstance, sender) {
      return new Promise(function (resolve, reject){
        if (auth === 'superSecretPassword') {
          resolve('write') // grant read-write access
        } else if (auth === 'different password') {
          resolve('read') // grant read-only access
        } else {
          reject('wrong password!') // reject connection
        }
      })
    }
    ```
  * Set `options.connector.generateUserId = true` in order to genenerate a
    userid, instead of receiving one from the server. This way the `Y(..)` is
    immediately going to be resolved, without waiting for any confirmation from
    the server. Use with caution.
  * Have a look at the used connector repository to see all available options.
  * *Only if you know what you are doing:* Set
    `options.connector.preferUntransformed = true` in order receive the shared
    data untransformed. This is very efficient as the database content is simply
    copied to this client. This does only work if this client receives content
    from only one client.
* options.sourceDir (browser only)
  * Path where all y-* modules are stored
  * Defaults to `/bower_components`
  * Not required when running on `nodejs` / `iojs`
  * When using nodejs you need to manually extend Yjs:
```js
var Y = require('yjs')
// you have to require a db, connector, and *all* types you use!
require('y-memory')(Y)
require('y-webrtc')(Y)
require('y-map')(Y)
// ..
```
* options.share
  * Specify on `options.share[arbitraryName]` types that are shared among all
    users.
  * E.g. Specify `options.share[arbitraryName] = 'Array'` to require y-array and
    create an y-array type on `y.share[arbitraryName]`.
  * If userA doesn't specify `options.share[arbitraryName]`, it won't be
    available for userA.
  * If userB specifies `options.share[arbitraryName]`, it still won't be
    available for userA. But all the updates are send from userB to userA.
  * In contrast to y-map, types on `y.share.*` cannot be overwritten or deleted.
    Instead, they are merged among all users. This feature is only available on
    `y.share.*`
  * Weird behavior: It is supported that two users specify different types with
    the same property name.
     E.g. userA specifies `options.share.x = 'Array'`, and userB specifies
     `options.share.x = 'Text'`. But they only share data if they specified the
     same type with the same property name
* options.type (browser only)
  * Array of modules that Yjs needs to require, before instantiating a shared
    type.
  * By default Yjs requires the specified database adapter, the specified
    connector, and all modules that are used in `options.share.*`
  * Put all types here that you intend to use, but are not used in y.share.*

### Instantiated Y object (y)
`Y(options)` returns a promise that is fulfilled when..

* All modules are loaded
  * The specified database adapter is loaded
  * The specified connector is loaded
  * All types are included
* The connector is initialized, and a unique user id is set (received from the
  server)
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
  * Try to reconnect to the other instances (needs to be supported by the
    connector)
  * Not supported by y-xmpp
* y.close()
  * Destroy this object.
  * Destroys all types (they will throw weird errors if you still use them)
  * Disconnects from the other instances (via connector)
  * Returns a promise
* y.destroy()
  * calls y.close()
  * Removes all data from the database
  * Returns a promise
* y.db.stopGarbageCollector()
  * Stop the garbage collector. Call y.db.garbageCollect() to continue garbage
    collection
* y.db.gc :: Boolean
  * Whether gc is turned on
* y.db.gcTimeout :: Number (defaults to 50000 ms)
  * Time interval between two garbage collect cycles
  * It is required that all instances exchanged all messages after two garbage
    collect cycles (after 100000 ms per default)
* y.db.userId :: String
  * The used user id for this client. **Never overwrite this**

### Logging
Yjs uses [debug](https://github.com/visionmedia/debug) for logging. The flag
`y*` enables logging for all y-* components. You can selectively remove
components you are not interested in: E.g. The flag `y*,-y:connector-message`
will not log the long `y:connector-message` messages.

##### Enable logging in Node.js
```sh
DEBUG=y* node app.js
```

Remove the colors in order to log to a file:
```sh
DEBUG_COLORS=0 DEBUG=y* node app.js > log
```

##### Enable logging in the browser
```js
localStorage.debug = 'y*'
```

## Contribution
I created this framework during my bachelor thesis at the chair of computer
science 5 [(i5)](http://dbis.rwth-aachen.de/cms), RWTH University. Since
December 2014 I'm working on Yjs as a part of my student worker job at the i5.

## License
Yjs is licensed under the [MIT License](./LICENSE).

<yjs@dbis.rwth-aachen.de>
