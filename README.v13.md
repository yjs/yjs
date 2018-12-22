# ![Yjs](https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png)
> A CRDT library with a powerful abstraction of shared data

Yjs is a CRDT implementatation that exposes its internal structure as actual data types that can be manipulated and fire changes when remote or local changes happen. While Yjs can be used for all kinds of state management, we lay a special focus on shared editing.

* Chat: [https://gitter.im/y-js/yjs](https://gitter.im/y-js/yjs)
* Demos: [https://yjs.website/tutorial-prosemirror.html](https://yjs.website/tutorial-prosemirror.html)
* API Docs: [https://yjs.website/](https://yjs.website/)

### Supported Editors:

| Name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Cursors |  Demo |
|---|:-:|---|
| [ProseMirror](https://prosemirror.net/) | ✔ | [link](https://yjs.website/tutorial-prosemirror.html) |
| [Quill](https://quilljs.com/) |  | [link](https://yjs.website/tutorial-quill.html) |
| [CodeMirror](https://codemirror.net/) | ✔ | [link](https://yjs.website/tutorial-codemirror.html) |
| [Ace](https://ace.c9.io/) | | [link]() |
| [Monaco](https://microsoft.github.io/monaco-editor/) | | [link]() |

### Distinguishing Features

* **Binary Encoding:**
* **Undo/Redo:**
* **Types:**
* **Offline:** Yjs is designed to support offline editing. Read [this section](#Offline) about the limitations of offline editing in Yjs. The only provider supporting full offline editing is Ydb.
* **Network-agnostic:** Yjs ships with many providers that handle connection and distribution of updates to other peers. Yjs itself is network-agnostic and does not depend on a central source of truth that distributes updates to other peers. Check [this section](#Create-a-Custom-Provider) to find out how the sync mechanism works and how to implement your custom provider.

# Table of Contents

* [Getting Started](#Getting-Started)
  * [Tutorial](#Short-Tutorial)
* [Providers](#Providers)
  * [Websocket](#Websocket)
  * [Ydb](#Ydb)
  * [Create a Custom Provider](#Create-a-Custom-Provider)
* [Shared Types](#Shared-Types)
  * [YArray](#Yarray)
  * [YMap](#YMap)
  * [YText](#YText)
  * [YXmlFragment and YXmlElement](#YXmlFragment-and-YXmlElement)
  * [Create a Custom Type](#Create-a-Custom-Type)
* [Bindings](#Bindings)
  * [PromeMirror](#ProseMirror)
  * [Quill](#Quill)
  * [CodeMirror](#CodeMirror)
  * [Ace](#Ace)
  * [Monaco](#Monace)
  * [DOM](#DOM)
  * [Textarea](#Textarea)
  * [Create a Custom Binding](#Create-a-Custom-Binding)
* [Transaction](#Transaction)
* [Offline Editing](#Offline-Editing)
* [Awareness](#Awareness)
* [Working with Yjs](#Working-with-Yjs)
  * [Typescript Declarations](#Typescript-Declarations)
* [Binary Protocols](#Binary-Protocols)
  * [Sync Protocol](#Sync-Protocols)
  * [Awareness Protocol](#Awareness-Protocols)
  * [Auth Protocol](#Auth-Protocol)
* [Yjs CRDT Algorithm](#Yjs-CRDT-Algorithm)
* [Evaluation](#Evaluation)
  * [Existing shared editing libraries](#Exisisting-Javascript-Products)
  * [CRDT Algorithms](#CRDT-Algorithms)
  * [Comparison of CRDT with OT](#Comparing-CRDT-with-OT)
  * [Comparison of CRDT Algorithms](#Comparing-CRDT-Algorithms)
  * [Comparison of Yjs with other Implementations](#Comparing-Yjs-with-other-Implementations)
* [License and Author](#License-and-Author)

## Getting Started

Yjs does not hava any dependencies. Install this package with your favorite package manager, or just copy the files into your project.

```sh
npm i yjs
```

##### Tutorial

In this *short* tutorial I will give an overview of the basic concepts in Yjs.

Yjs itself only knows how to do conflict resolution. You need to choose a provider, that handles how document updates are distributed over the network.

We will start by running a websocket server (part of the [websocket provider](#Websocket-Provider)):

```sh
PORT=1234 node ./node_modules/yjs/provider/websocket/server.js
```

The following client-side code connects to the websocket server and opens a shared document.

```js
import * as Y from 'yjs'
import { WebsocketProvider } from 'yjs/provider/websocket.js'

const provider = new WebsocketProvider('http://localhost:1234')
const sharedDocument = provider.get('my-favourites')
```

All content created in a shared document is shared among all peers that request the same document. Now we define types on the shared document:

```js
sharedDocument.define('movie-ratings', Y.Map)
sharedDocument.define('favourite-food', Y.Array)
```

All clients that define `'movie-ratings'` as `Y.Map` on the shared document named `'my-favourites'` have access to the same shared type. Example:

**Client 1:**

```js
sharedDocument.define('movie-ratings', Y.Map)
sharedDocument.define('favourite-food', Y.Array)

const movies = sharedDocument.get('movie-ratings')
const food = sharedDocument.get('fovourite-food')

movies.set('deadpool', 10)
food.insert(0, ['burger'])
```

**Client 2:**

```js
sharedDocument.define('movie-ratings', Y.Map)
sharedDocument.define('favourite-food', Y.Map) // <- note that this definition differs from client1

const movies = sharedDocument.get('movie-ratings')
const food = sharedDocument.get('fovourite-food')

movies.set('yt rewind', -10)
food.set('pancake', 10)

// after some time, when client1 and client2 synced, the movie list will be merged:
movies.toJSON() // => { 'deadpool': 10, 'yt rewind': -10 }

// But since client1 and client2 defined the types differently,
// they do not have access to each others food list.
food.toJSON() // => { pancake: 10 }
```

Now you understand how types are defined on a shared document. Next you can jump to one of the [tutorials on our website](https://yjs.website/tutorial-prosemirror.html) or continue reading about [Providers](#Providers), [Shared Types](#Shared-Types), and [Bindings](#Bindings).

## Providers

In Yjs, a provider handles the communication channel to *authenticate*, *authorize*, and *exchange document updates*. Yjs ships with some existing providers. 

### Websocket Provider

The websocket provider implements a classical client server model. Clients connect to a single endpoint over websocket. The server distributes awareness information and document updates among clients.

The Websocket Provider is a solid choice if you want a central source that handles authentication and authorization. Websockets also send header information and cookies, so you can use existing authentication mechanisms with this server. I recommend that you slightly adapt the server in `./provider/websocket/server.js` to your needs.

* Supports cross-tab communication. When you open the same document in the same browser, changes on the document are exchanged via cross-tab communication ([Broadcast Channel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) as fallback).
* Supports exange of awareness information (e.g. cursors)

##### Start a Websocket Server:

```sh
PORT=1234 node ./node_modules/yjs/provider/websocket/server.js
```

**Websocket Server with Persistence**

Persist document updates in a LevelDB database.

See [LevelDB Persistence](#LevelDB Persistence) for more info.

```sh
PORT=1234 YPERSISTENCE=./dbDir node ./node_modules/yjs/provider/websocket/server.js
```

##### Client Code:

```js
import * as Y from 'yjs'
import { WebsocketProvider } from 'yjs/provider/websocket.js'

const provider = new WebsocketProvider('http://localhost:1234')

// open a websocket connection to http://localhost:1234/my-document-name
const sharedDocument = provider.get('my-document-name')

sharedDocument.on('status', event => {
  console.log(event.status) // logs "connected" or "disconnected"
})
```

#### Scaling

These are mere suggestions how you could scale your server environment.

**Option 1:** Websocket servers communicate with each other via a PubSub server. A room is represented by a PubSub channel. The downside of this approach is that the same shared document may be handled by many servers. But the upside is that this approach is fault tolerant, does not have a single point of failure, and is perfectly fit for route balancing.

**Option 2:** Sharding with *consistent hashing*. Each document is handled by a unique server. This patterns requires an entity, like etcd, that performs regular health checks and manages servers. Based on the list of available servers (which is managed by etcd) a proxy calculates which server is responsible for each requested document. The disadvantage of this approach is that it is that load distribution may not be fair. Still, this approach may be the preferred solution if you want to store the shared document in a database - e.g. for indexing.

### Ydb Provider

TODO

### Create Custom Provider

A provider is only a concept. I encourage you to implement the same provider interface found above. This makes it easy to exchange communication protocols.

Since providers handle the communication channel, they will necessarily interact with the [binary protocols](#Binary-Protocols). I suggest that you build upon the existing protocols. But you may also implement a custom communication protocol.

Read section [Sync Protocol](#Sync-Protocol) to learn how syncing works.

## Shared Types

A shared type is just a normal data type like [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) or [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array). But a shared type may also be modified by a remote client. Conflicts are automatically resolved by the rules described in this section - but please note that this is only a rough overview of how conflict resolution works. Please read the [Yjs CRDT Algorithm](#Yjs-CRDT-Algorithm) section for an in-depth description of the conflict resolution approach.

As explained in [Tutorial](#Tutorial), a shared type is shared among all peers when they are defined with the same name on the same shared document. I.e.

```js
sharedDocument.define('my-array', Y.Array)

const myArray = sharedDocument.get('my-array')
```

You may define a shared types several times, as long as you don't change the type definition.

```js
sharedDocument.define('my-array', Y.Array)

const myArray = sharedDocument.get('my-array')

const alsoMyArray = sharedDocument.define('my-array', Y.Array)

console.log(myArray === alsoMyArray) // => true
```

All shared types have an `type.observe(event => ..)` method that allows you to observe any changes. You may also observe all changes on a type and any of its children with the `type.observeDeep(events => ..)` method. Here, `events` is the [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) of events that were fired on type, or any of its children.

All Events inherit from [YEvent](https://yjs.website/module-utils.YEvent.html).

### YMap
> Complete API docs: [https://yjs.website/module-types.ymap](https://yjs.website/module-types.ymap)

The YMap type is very similar to the JavaScript [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). 

YMap fires [YMapEvents](https://yjs.website/module-types.YMapEvent.html).

```js
import * as Y from 'yjs'

const ymap = new Y.Map()

ymap.observe(event => {
  console.log('ymap keys changed:', event.keysChanged, event.remote)
})

ymap.set('key', 'value') // => ymap keys changed: Set{ 'key' } false
ymap.delete('key') // => ymap keys changed: Set{ 'key' }

const ymap2 = new YMap()
ymap2.set(1, 'two')

ymap.set('type', ymap2) // => ymap keys changed: Set{ 'type' }
```

##### Concurrent YMap changes

* Concurrent edits on different keys do not affect each other. E.g. if client1 does `ymap.set('a', 1)` and client2 does `ymap.set('b', 2)`, both clients will end up with `YMap{ a: 1, b: 2 }`
* If client1 and client2 `set` the same property at the same time, the edit from the client with the smaller userID will prevail (`sharedDocument.userID`)
* If client1 sets a property `ymap.set('a', 1)` and client2 deletes a property `ymap.delete('a')`, the set operation always prevails.

### YArray
> Complete API docs: [https://yjs.website/module-types.yarray](https://yjs.website/module-types.yarray)

YArray fires [YArrayEvents](https://yjs.website/module-types.YMapEvent.html).


```js
import * as Y from 'yjs'

const yarray = new Y.Array()

yarray.observe(event => {
  console.log('yarray changed:', event.addedElements, event.removedElements, event.remote)
})

// insert two elements at position 0
yarray.insert(0, ['a', 1]) // => yarray changed: Set{Item{'a'}, Item{1}}, Set{}, false 
console.log(yarray.toArray()) // => ['a', 1]
yarray.delete(1, 1) // yarray changed: Set{}, Set{Item{1}}, false

yarray.insert(1, new Y.Map()) // => yarray changed: Set{YMap{}}, Set{}, false

// The difference between .toArray and .toJSON:
console.log(yarray.toArray()) // => ['a', YMap{}]
console.log(yarray.toJSON()) // => ['a', {}]
```

As you can see from the above example, primitive data is wrapped into an Item. This makes it possible to find the exact location of the change.

##### Concurrent YArray changes

* YArray internally represents the data as a doubly linked list. The Array `['a', YMap{}, 1]` is internally represented as `Item{'a'} <-> YMap{} <-> Item{1}`. Accordingly, the insert operation `yarray.insert(1, ['b'])` is internally transformed to `insert Item{'b'} between Item{'a'} and YMap{}`.
* When an Item is deleted, it is only marked as deleted. Only its content is garbage collected and freed from memory.
* Therefore, the remote operation `insert x between a and b` can still be fulfilled when item `a` or item `b` are deleted.
* In case that two clients insert content between the same items (a concurrent insertion), the order of the insertions is decided based on the `sharedDocument.userID`.

### YText
> Complete API docs: [https://yjs.website/module-types.ytext](https://yjs.website/module-types.ytext)

A YText is basically a [YArray](#YArray) that is optimized for text content. 

### YXmlFragment and YXmlElement
> Complete API docs: [https://yjs.website/module-types.yxmlfragment](https://yjs.website/module-types.yxmlfragment) and [https://yjs.website/module-types.yxmlelement](https://yjs.website/module-types.yxmlelement)

### Custom Types

## Bindings

## Transaction



## Binary Protocols

### Sync Protocol

Sync steps

### Awareness Protocol

### Auth Protocol

## Offline Editing

It is trivial with Yjs to persist the local state to indexeddb, so it is always available when working offline. But there are two non-trivial questions that need to answered when implementing a professional offline editing app:

1. How does a client sync down all rooms that were modified while offline?
2. How does a client sync up all rooms that were modified while offline?

Assuming 5000 documents are stored on each client for offline usage. How do we sync up/down each of those documents after a client comes online? It would be inefficient to sync each of those rooms separately. The only provider that currently supports syncing many rooms efficiently is Ydb, because its database layer is optimized to sync many rooms with each client.

If you do not care about 1. and 2. you can use `/persistences/indexeddb.js` to mirror the local state to indexeddb.

## Working with Yjs

### Typescript Declarations

Until [this](https://github.com/Microsoft/TypeScript/issues/7546) is fixed, the only way to get type declarations is by adding Yjs to the list of checked files:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    ..
  },
  "include": [
    "./node_modules/yjs/"
  ]
}
```

## CRDT Algorithm

## License and Author

Yjs and all related projects are [**MIT licensed**](./LICENSE). Some files also contain an additional copyright notice that allows you to copy and modify the code without shipping the copyright notice (e.g. `./provider/websocket/WebsocketProvider.js` and `./provider/websocket/server.js`)

Yjs is based on the research I did as a student at the RWTH i5. I am working on Yjs in my spare time. Please help me by donating or hiring me for consulting, so I can continue to work on this project.

kevin.jahns@protonmail.com