
# ![Yjs](http://y-js.org/images/yjs.png)

Yjs is a framework for optimistic concurrency control and automatic conflict resolution on shared data. The framework provides similar functionality as [ShareJs] and [OpenCoweb], but it implements a new algorithm that also support peer-to-peer communication protocols. Yjs was designed to handle concurrent actions on arbitrary data types like Text, Json, and XML. We also provide support for storing and manipulating your shared data offline. For more information and demo applications visit our [homepage](http://y-js.org/).

**NOTE** This project is currently migrating. So there may exist some information that is not true anymore..

You can create you own shared types easily. Therefore, you can take matters into your own hand by defining the meaning of the shared types, and ensure that it is valid, while Yjs ensures data consistency (everyone will eventually end up with the same data). We already provide data types for

| Name     | Description       |
|----------|-------------------|
|[map](https://github.com/y-js/y-map) | Add, update, and remove properties of an object. Included in Yjs|
|[array](https://github.com/y-js/y-array) | A shared linked list implementation |
|[xml](https://github.com/y-js/y-xml) | An implementation of the DOM. You can create a two way binding to Browser DOM objects|
|[text](https://github.com/y-js/y-text) | Collaborate on text. Supports two way binding to textareas, input elements, or HTML elements (e.g. *h1*, or *p*)|
|[richtext](https://github.com/y-js/y-richtext) | Collaborate on rich text. Supports two way binding to several editors|

Unlike other frameworks, Yjs supports P2P message propagation and is not bound to a specific communication protocol. Therefore, Yjs is extremely scalable and can be used in a wide range of application scenarios.

We support several communication protocols as so called *Connectors*. You can create your own connector too - read [this wiki page](https://github.com/y-js/yjs/wiki/Custom-Connectors). Currently, we support the following communication protocols:

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
|[IndexedDb](https://github.com/y-js/y-indexeddb) | Offline storage for the browser |

You can use Yjs client-, and server- side. You can get it as via npm, and bower. We even provide polymer elements for Yjs!

The advantages over similar frameworks are support for
* .. P2P message propagation and arbitrary communication protocols
* .. arbitrary complex data types
* .. offline support: Changes are stored persistently and only relevant changes are propagated on rejoin
* .. Intention Preservation: When working on Text, the intention of your changes are preserved. This is particularily important when working offline. Every type has a notion on how we define Intention Preservation on it.

## Use it!
Install yjs and its modules with [bower](http://bower.io/), or with [npm](https://www.npmjs.org/package/yjs).

### Bower
```
bower install yjs
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
  // modules: ['Richtext', 'Array'] // optional list of modules you want to import
}).then(function (y) {
  // bind the textarea to a shared text element
  y.share.textarea.bind(document.getElementById('textfield'))
}
```

# Status
Yjs is a work in progress. Different versions of the *y-* repositories may not work together. Just drop me a line if you run into troubles.

## Get help
There are some friendly people on [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/y-js/yjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) who may help you with your problem, and answer your questions.

Please report _any_ issues to the [Github issue page](https://github.com/y-js/yjs/issues)! I try to fix them very soon, if possible.

## Changelog
### 1.0.0
This is a complete rewrite of the 0.5 version of Yjs. Since Yjs 1.0 it is possible to work asynchronously on a persistent database, which enables offline support.
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

