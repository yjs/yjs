
# ![Yjs](https://yjs.dev/images/logo/yjs-120x120.png)

> A CRDT framework with a powerful abstraction of shared data

Yjs is a [CRDT implementation](#Yjs-CRDT-Algorithm) that exposes its internal
data structure as *shared types*. Shared types are common data types like `Map`
or `Array` with superpowers: changes are automatically distributed to other
peers and merged without merge conflicts.

Yjs is **network agnostic** (p2p!), supports many existing **rich text
editors**, **offline editing**, **version snapshots**, **undo/redo** and
**shared cursors**. It scales well with an unlimited number of users and is well
suited for even large documents.

* Demos: [https://github.com/yjs/yjs-demos](https://github.com/yjs/yjs-demos)
* Discuss: [https://discuss.yjs.dev](https://discuss.yjs.dev)
* Benchmark Yjs vs. Automerge:
  [https://github.com/dmonad/crdt-benchmarks](https://github.com/dmonad/crdt-benchmarks)
* Podcast [**"Yjs Deep Dive into real time collaborative editing solutions":**](https://www.tag1consulting.com/blog/deep-dive-real-time-collaborative-editing-solutions-tagteamtalk-001-0)
* Podcast [**"Google Docs-style editing in Gutenberg with the YJS framework":**](https://publishpress.com/blog/yjs/)

:construction_worker_woman: If you are looking for professional (paid) support to
build collaborative or distributed applications ping us at
<yjs@tag1consulting.com>. Otherwise you can find help on our
[discussion board](https://discuss.yjs.dev).

## Sponsors

I'm currently looking for sponsors that allow me to be less dependent on
contracting work. These awesome backers already fund further development of
Yjs:

[![Ifiok Jr.](https://github.com/ifiokjr.png?size=60)](https://github.com/ifiokjr)
[![Burke Libbey](https://github.com/burke.png?size=60)](https://github.com/burke)
[![Beni Cherniavsky-Paskin](https://github.com/cben.png?size=60)](https://github.com/cben)
[![Tom Moor](https://github.com/tommoor.png?size=60)](https://github.com/tommoor)
[![Michael Meyers](https://github.com/michaelemeyers.png?size=60)](https://github.com/michaelemeyers)
[![Cristiano Benjamin](https://github.com/csbenjamin.png?size=60)](https://github.com/csbenjamin)
[![Braden](https://github.com/AdventureBeard.png?size=60)](https://github.com/AdventureBeard)
[![nimbuswebinc](https://nimbusweb.me/new-style-img/note-icon.svg)](https://github.com/nimbuswebinc)
[![JourneyApps](https://github.com/journeyapps.png?size=60)](https://github.com/journeyapps)
[![Adam Brunnmeier](https://github.com/adabru.png?size=60)](https://github.com/adabru)
[![Nathanael Anderson](https://github.com/NathanaelA.png?size=60)](https://github.com/NathanaelA)
[<img src="https://room.sh/img/icons/android-chrome-192x192.png" height="60px" />](https://room.sh/)

Sponsorship also comes with special perks! [![Become a Sponsor](https://img.shields.io/static/v1?label=Become%20a%20Sponsor&message=%E2%9D%A4&logo=GitHub&style=flat&color=d42f2d)](https://github.com/sponsors/dmonad)

## Who is using Yjs

* [Relm](https://www.relm.us/) A collaborative gameworld for teamwork and
  community. :star2:
* [Input](https://input.com/) A collaborative note taking app. :star2:
* [Room.sh](https://room.sh/) A meeting application with integrated
  collaborative drawing, editing, and coding tools. :star:
* [https://coronavirustechhandbook.com/](https://coronavirustechhandbook.com/)
  A collaborative wiki that is edited by thousands of different people to work
  on a rapid and sophisticated response to the coronavirus outbreak and
  subsequent impacts. :star:
* [Nimbus Note](https://nimbusweb.me/note.php) A note-taking app designed by
  Nimbus Web.
* [JoeDocs](https://joedocs.com/) An open collaborative wiki.
* [Pluxbox RadioManager](https://pluxbox.com/) A web-based app to
  collaboratively organize radio broadcasts.
* [Cattaz](http://cattaz.io/) A wiki that can run custom applications in the
  wiki pages.

## Table of Contents

* [Overview](#Overview)
  * [Bindings](#Bindings)
  * [Providers](#Providers)
* [Getting Started](#Getting-Started)
* [API](#API)
  * [Shared Types](#Shared-Types)
  * [Y.Doc](#YDoc)
  * [Document Updates](#Document-Updates)
  * [Relative Positions](#Relative-Positions)
  * [Y.UndoManager](#YUndoManager)
* [Yjs CRDT Algorithm](#Yjs-CRDT-Algorithm)
* [License and Author](#License-and-Author)

## Overview

This repository contains a collection of shared types that can be observed for
changes and manipulated concurrently. Network functionality and two-way-bindings
are implemented in separate modules.

### Bindings

| Name | Cursors | Binding |  Demo |
|---|:-:|---|---|
| [ProseMirror](https://prosemirror.net/) &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | ✔ | [y-prosemirror](https://github.com/yjs/y-prosemirror) | [demo](https://demos.yjs.dev/prosemirror/prosemirror.html) |
| [Quill](https://quilljs.com/) | ✔ | [y-quill](https://github.com/yjs/y-quill) | [demo](https://demos.yjs.dev/quill/quill.html) |
| [CodeMirror](https://codemirror.net/) | ✔ | [y-codemirror](https://github.com/yjs/y-codemirror) | [demo](https://demos.yjs.dev/codemirror/codemirror.html) |
| [Monaco](https://microsoft.github.io/monaco-editor/) | ✔ | [y-monaco](https://github.com/yjs/y-monaco) | [demo](https://demos.yjs.dev/monaco/monaco.html) |

### Providers

Setting up the communication between clients, managing awareness information,
and storing shared data for offline usage is quite a hassle. **Providers**
manage all that for you and are the perfect starting point for your
collaborative app.

<dl>
  <dt><a href="https://github.com/yjs/y-webrtc">y-webrtc</a></dt>
  <dd>
Propagates document updates peer-to-peer using WebRTC. The peers exchange
signaling data over signaling servers. Publically available signaling servers
are available. Communication over the signaling servers can be encrypted by
providing a shared secret, keeping the connection information and the shared
document private.
  </dd>
  <dt><a href="https://github.com/yjs/y-websocket">y-websocket</a></dt>
  <dd>
A module that contains a simple websocket backend and a websocket client that
connects to that backend. The backend can be extended to persist updates in a
leveldb database.
  </dd>
  <dt><a href="https://github.com/yjs/y-indexeddb">y-indexeddb</a></dt>
  <dd>
Efficiently persists document updates to the browsers indexeddb database.
The document is immediately available and only diffs need to be synced through the
network provider.
  </dd>
  <dt><a href="https://github.com/yjs/y-dat">y-dat</a></dt>
  <dd>
[WIP] Write document updates effinciently to the dat network using
<a href="https://github.com/kappa-db/multifeed">multifeed</a>. Each client has
an append-only log of CRDT local updates (hypercore). Multifeed manages and sync
hypercores and y-dat listens to changes and applies them to the Yjs document.
</dd>
</dl>

## Getting Started

Install Yjs and a provider with your favorite package manager:

```sh
npm i yjs y-websocket
```

Start the y-websocket server:

```sh
PORT=1234 node ./node_modules/y-websocket/bin/server.js
```

### Example: Observe types

```js
const yarray = doc.getArray('my-array')
yarray.observe(event => {
  console.log('yarray was modified')
})
// every time a local or remote client modifies yarray, the observer is called
yarray.insert(0, ['val']) // => "yarray was modified"
```

### Example: Nest types

Remember, shared types are just plain old data types. The only limitation is
that a shared type must exist only once in the shared document.

```js
const ymap = doc.getMap('map')
const foodArray = new Y.Array()
foodArray.insert(0, ['apple', 'banana'])
ymap.set('food', foodArray)
ymap.get('food') === foodArray // => true
ymap.set('fruit', foodArray) // => Error! foodArray is already defined
```

Now you understand how types are defined on a shared document. Next you can jump
to the [demo repository](https://github.com/yjs/yjs-demos) or continue reading
the API docs.

### Example: Using and combining providers

Any of the Yjs providers can be combined with each other. So you can sync data
over different network technologies.

In most cases you want to use a network provider (like y-websocket or y-webrtc)
in combination with a persistence provider (y-indexeddb in the browser).
Persistence allows you to load the document faster and to persist data that is
created while offline.

For the sake of this demo we combine two different network providers with a
persistence provider.

```js
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

const ydoc = new Y.Doc()

// this allows you to instantly get the (cached) documents data
const indexeddbProvider = new IndexeddbPersistence('count-demo', ydoc)
indexeddbProvider.whenSynced.then(() => {
  console.log('loaded data from indexed db')
})

// Sync clients with the y-webrtc provider.
const webrtcProvider = new WebrtcProvider('count-demo', ydoc)

// Sync clients with the y-websocket provider
const websocketProvider = new WebsocketProvider(
  'wss://demos.yjs.dev', 'count-demo', ydoc
)

// array of numbers which produce a sum
const yarray = ydoc.getArray('count')

// observe changes of the sum
yarray.observe(event => {
  // print updates when the data changes
  console.log('new sum: ' + yarray.toArray().reduce((a,b) => a + b))
})

// add 1 to the sum
yarray.push([1]) // => "new sum: 1"
```

## API

```js
import * as Y from 'yjs'
```

### Shared Types

<details>
  <summary><b>Y.Array</b></summary>
  <br>
  <p>
A shareable Array-like type that supports efficient insert/delete of elements
at any position. Internally it uses a linked list of Arrays that is split when
necessary.
  </p>
  <pre>const yarray = new Y.Array()</pre>
  <dl>
    <b><code>insert(index:number, content:Array&lt;object|boolean|Array|string|number|Uint8Array|Y.Type&gt;)</code></b>
    <dd>
Insert content at <var>index</var>. Note that content is an array of elements.
I.e. <code>array.insert(0, [1])</code> splices the list and inserts 1 at
position 0.
    </dd>
    <b><code>push(Array&lt;Object|boolean|Array|string|number|Uint8Array|Y.Type&gt;)</code></b>
    <dd></dd>
    <b><code>unshift(Array&lt;Object|boolean|Array|string|number|Uint8Array|Y.Type&gt;)</code></b>
    <dd></dd>
    <b><code>delete(index:number, length:number)</code></b>
    <dd></dd>
    <b><code>get(index:number)</code></b>
    <dd></dd>
    <b><code>slice(start:number, end:number):Array&lt;Object|boolean|Array|string|number|Uint8Array|Y.Type&gt;</code></b>
    <dd>Retrieve a range of content</dd>
    <b><code>length:number</code></b>
    <dd></dd>
    <b>
      <code>
forEach(function(value:object|boolean|Array|string|number|Uint8Array|Y.Type,
 index:number, array: Y.Array))
      </code>
    </b>
    <dd></dd>
    <b><code>map(function(T, number, YArray):M):Array&lt;M&gt;</code></b>
    <dd></dd>
    <b><code>toArray():Array&lt;object|boolean|Array|string|number|Uint8Array|Y.Type&gt;</code></b>
    <dd>Copies the content of this YArray to a new Array.</dd>
    <b><code>toJSON():Array&lt;Object|boolean|Array|string|number&gt;</code></b>
    <dd>
Copies the content of this YArray to a new Array. It transforms all child types
to JSON using their <code>toJSON</code> method.
    </dd>
    <b><code>[Symbol.Iterator]</code></b>
    <dd>
      Returns an YArray Iterator that contains the values for each index in the array.
      <pre>for (let value of yarray) { .. }</pre>
    </dd>
    <b><code>observe(function(YArrayEvent, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type is modified. In the case this type is modified in the event listener,
the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YArrayEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type or any of its children is modified. In the case this type is modified
in the event listener, the event listener will be called again after the current
event listener returns. The event listener receives all Events created by itself
or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>
<details>
  <summary><b>Y.Map</b></summary>
  <br>
  <p>
    A shareable Map type.
  </p>
  <pre><code>const ymap = new Y.Map()</code></pre>
  <dl>
    <b><code>get(key:string):object|boolean|string|number|Uint8Array|Y.Type</code></b>
    <dd></dd>
    <b><code>set(key:string, value:object|boolean|string|number|Uint8Array|Y.Type)</code></b>
    <dd></dd>
    <b><code>delete(key:string)</code></b>
    <dd></dd>
    <b><code>has(key:string):boolean</code></b>
    <dd></dd>
    <b><code>get(index:number)</code></b>
    <dd></dd>
    <b><code>clone():Y.Map</code></b>
    <dd>Clone this type into a fresh Yjs type.</dd>
    <b><code>toJSON():Object&lt;string, Object|boolean|Array|string|number|Uint8Array&gt;</code></b>
    <dd>
Copies the <code>[key,value]</code> pairs of this YMap to a new Object.It
transforms all child types to JSON using their <code>toJSON</code> method.
    </dd>
    <b><code>forEach(function(value:object|boolean|Array|string|number|Uint8Array|Y.Type,
 key:string, map: Y.Map))</code></b>
    <dd>
      Execute the provided function once for every key-value pair.
    </dd>
    <b><code>[Symbol.Iterator]</code></b>
    <dd>
      Returns an Iterator of <code>[key, value]</code> pairs.
      <pre>for (let [key, value] of ymap) { .. }</pre>
    </dd>
    <b><code>entries()</code></b>
    <dd>
      Returns an Iterator of <code>[key, value]</code> pairs.
    </dd>
    <b><code>values()</code></b>
    <dd>
      Returns an Iterator of all values.
    </dd>
    <b><code>keys()</code></b>
    <dd>
      Returns an Iterator of all keys.
    </dd>
    <b><code>observe(function(YMapEvent, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type is modified. In the case this type is modified in the event listener,
the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YMapEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type or any of its children is modified. In the case this type is modified
in the event listener, the event listener will be called again after the current
event listener returns. The event listener receives all Events created by itself
or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>

<details>
  <summary><b>Y.Text</b></summary>
  <br>
  <p>
A shareable type that is optimized for shared editing on text. It allows to
assign properties to ranges in the text. This makes it possible to implement
rich-text bindings to this type.
  </p>
  <p>
This type can also be transformed to the
<a href="https://quilljs.com/docs/delta">delta format</a>. Similarly the
YTextEvents compute changes as deltas.
  </p>
  <pre>const ytext = new Y.Text()</pre>
  <dl>
    <b><code>insert(index:number, content:string, [formattingAttributes:Object&lt;string,string&gt;])</code></b>
    <dd>
      Insert a string at <var>index</var> and assign formatting attributes to it.
      <pre>ytext.insert(0, 'bold text', { bold: true })</pre>
    </dd>
    <b><code>delete(index:number, length:number)</code></b>
    <dd></dd>
    <b><code>format(index:number, length:number, formattingAttributes:Object&lt;string,string&gt;)</code></b>
    <dd>Assign formatting attributes to a range in the text</dd>
    <b><code>applyDelta(delta, opts:Object&lt;string,any&gt;)</code></b>
    <dd>
        See <a href="https://quilljs.com/docs/delta/">Quill Delta</a>
        Can set options for preventing remove ending newLines, default is true.
        <pre>ytext.applyDelta(delta, { sanitize: false })</pre>
    </dd>
    <b><code>length:number</code></b>
    <dd></dd>
    <b><code>toString():string</code></b>
    <dd>Transforms this type, without formatting options, into a string.</dd>
    <b><code>toJSON():string</code></b>
    <dd>See <code>toString</code></dd>
    <b><code>toDelta():Delta</code></b>
    <dd>
Transforms this type to a <a href="https://quilljs.com/docs/delta/">Quill Delta</a>
    </dd>
    <b><code>observe(function(YTextEvent, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type is modified. In the case this type is modified in the event listener,
the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YTextEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type or any of its children is modified. In the case this type is modified
in the event listener, the event listener will be called again after the current
event listener returns. The event listener receives all Events created by itself
or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>

<details>
  <summary><b>Y.XmlFragment</b></summary>
  <br>
  <p>
    A container that holds an Array of Y.XmlElements.
  </p>
  <pre><code>const yxml = new Y.XmlFragment()</code></pre>
  <dl>
    <b><code>insert(index:number, content:Array&lt;Y.XmlElement|Y.XmlText&gt;)</code></b>
    <dd></dd>
    <b><code>delete(index:number, length:number)</code></b>
    <dd></dd>
    <b><code>get(index:number)</code></b>
    <dd></dd>
    <b><code>slice(start:number, end:number):Array&lt;Y.XmlElement|Y.XmlText&gt;</code></b>
    <dd>Retrieve a range of content</dd>
    <b><code>length:number</code></b>
    <dd></dd>
    <b><code>clone():Y.XmlFragment</code></b>
    <dd>Clone this type into a fresh Yjs type.</dd>
    <b><code>toArray():Array&lt;Y.XmlElement|Y.XmlText&gt;</code></b>
    <dd>Copies the children to a new Array.</dd>
    <b><code>toDOM():DocumentFragment</code></b>
    <dd>Transforms this type and all children to new DOM elements.</dd>
    <b><code>toString():string</code></b>
    <dd>Get the XML serialization of all descendants.</dd>
    <b><code>toJSON():string</code></b>
    <dd>See <code>toString</code>.</dd>
    <b><code>observe(function(YXmlEvent, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type is modified. In the case this type is modified in the event listener,
the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YXmlEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type or any of its children is modified. In the case this type is modified
in the event listener, the event listener will be called again after the current
event listener returns. The event listener receives all Events created by itself
or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>

<details>
  <summary><b>Y.XmlElement</b></summary>
  <br>
  <p>
A shareable type that represents an XML Element. It has a <code>nodeName</code>,
attributes, and a list of children. But it makes no effort to validate its
content and be actually XML compliant.
  </p>
  <pre><code>const yxml = new Y.XmlElement()</code></pre>
  <dl>
    <b><code>insert(index:number, content:Array&lt;Y.XmlElement|Y.XmlText&gt;)</code></b>
    <dd></dd>
    <b><code>delete(index:number, length:number)</code></b>
    <dd></dd>
    <b><code>get(index:number)</code></b>
    <dd></dd>
    <b><code>length:number</code></b>
    <dd></dd>
    <b><code>setAttribute(attributeName:string, attributeValue:string)</code></b>
    <dd></dd>
    <b><code>removeAttribute(attributeName:string)</code></b>
    <dd></dd>
    <b><code>getAttribute(attributeName:string):string</code></b>
    <dd></dd>
    <b><code>getAttributes(attributeName:string):Object&lt;string,string&gt;</code></b>
    <dd></dd>
    <b><code>get(i:number):Y.XmlElement|Y.XmlText</code></b>
    <dd>Retrieve the i-th element.</dd>
    <b><code>slice(start:number, end:number):Array&lt;Y.XmlElement|Y.XmlText&gt;</code></b>
    <dd>Retrieve a range of content</dd>
    <b><code>clone():Y.XmlElement</code></b>
    <dd>Clone this type into a fresh Yjs type.</dd>
    <b><code>toArray():Array&lt;Y.XmlElement|Y.XmlText&gt;</code></b>
    <dd>Copies the children to a new Array.</dd>
    <b><code>toDOM():Element</code></b>
    <dd>Transforms this type and all children to a new DOM element.</dd>
    <b><code>toString():string</code></b>
    <dd>Get the XML serialization of all descendants.</dd>
    <b><code>toJSON():string</code></b>
    <dd>See <code>toString</code>.</dd>
    <b><code>observe(function(YXmlEvent, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every
time this type is modified. In the case this type is modified in the event
listener, the event listener will be called again after the current event
listener returns.
    </dd>
    <b><code>unobserve(function(YXmlEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
Adds an event listener to this type that will be called synchronously every time
this type or any of its children is modified. In the case this type is modified
in the event listener, the event listener will be called again after the current
event listener returns. The event listener receives all Events created by itself
or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>

### Y.Doc

```js
const doc = new Y.Doc()
```

<dl>
  <b><code>clientID</code></b>
  <dd>A unique id that identifies this client. (readonly)</dd>
  <b><code>gc</code></b>
  <dd>
Whether garbage collection is enabled on this doc instance. Set `doc.gc = false`
in order to disable gc and be able to restore old content. See https://github.com/yjs/yjs#yjs-crdt-algorithm
for more information about gc in Yjs.
  </dd>
  <b><code>transact(function(Transaction):void [, origin:any])</code></b>
  <dd>
Every change on the shared document happens in a transaction. Observer calls and
the <code>update</code> event are called after each transaction. You should
<i>bundle</i> changes into a single transaction to reduce the amount of event
calls. I.e. <code>doc.transact(() => { yarray.insert(..); ymap.set(..) })</code>
triggers a single change event. <br>You can specify an optional <code>origin</code>
parameter that is stored on <code>transaction.origin</code> and
<code>on('update', (update, origin) => ..)</code>.
  </dd>
  <b><code>toJSON():any</code></b>
  <dd>
Converts the entire document into a js object, recursively traversing each yjs type.
  </dd>
  <b><code>get(string, Y.[TypeClass]):[Type]</code></b>
  <dd>Define a shared type.</dd>
  <b><code>getArray(string):Y.Array</code></b>
  <dd>Define a shared Y.Array type. Is equivalent to <code>y.get(string, Y.Array)</code>.</dd>
  <b><code>getMap(string):Y.Map</code></b>
  <dd>Define a shared Y.Map type. Is equivalent to <code>y.get(string, Y.Map)</code>.</dd>
  <b><code>getXmlFragment(string):Y.XmlFragment</code></b>
  <dd>Define a shared Y.XmlFragment type. Is equivalent to <code>y.get(string, Y.XmlFragment)</code>.</dd>
  <b><code>on(string, function)</code></b>
  <dd>Register an event listener on the shared type</dd>
  <b><code>off(string, function)</code></b>
  <dd>Unregister an event listener from the shared type</dd>
</dl>

#### Y.Doc Events

<dl>
  <b><code>on('update', function(updateMessage:Uint8Array, origin:any, Y.Doc):void)</code></b>
  <dd>
Listen to document updates. Document updates must be transmitted to all other
peers. You can apply document updates in any order and multiple times.
  </dd>
  <b><code>on('beforeTransaction', function(Y.Transaction, Y.Doc):void)</code></b>
  <dd>Emitted before each transaction.</dd>
  <b><code>on('afterTransaction', function(Y.Transaction, Y.Doc):void)</code></b>
  <dd>Emitted after each transaction.</dd>
  <b><code>on('beforeAllTransactions', function(Y.Doc):void)</code></b>
  <dd>
Transactions can be nested (e.g. when an event within a transaction calls another
transaction). Emitted before the first transaction.
  </dd>
  <b><code>on('afterAllTransactions', function(Y.Doc, Array&lt;Y.Transaction&gt;):void)</code></b>
  <dd>Emitted after the last transaction is cleaned up.</dd>
</dl>

### Document Updates

Changes on the shared document are encoded into *document updates*. Document
updates are *commutative* and *idempotent*. This means that they can be applied
in any order and multiple times.

#### Example: Listen to update events and apply them on remote client

```js
const doc1 = new Y.Doc()
const doc2 = new Y.Doc()

doc1.on('update', update => {
  Y.applyUpdate(doc2, update)
})

doc2.on('update', update => {
  Y.applyUpdate(doc1, update)
})

// All changes are also applied to the other document
doc1.getArray('myarray').insert(0, ['Hello doc2, you got this?'])
doc2.getArray('myarray').get(0) // => 'Hello doc2, you got this?'
```

Yjs internally maintains a [state vector](#State-Vector) that denotes the next
expected clock from each client. In a different interpretation it holds the
number of structs created by each client. When two clients sync, you can either
exchange the complete document structure or only the differences by sending the
state vector to compute the differences.

#### Example: Sync two clients by exchanging the complete document structure

```js
const state1 = Y.encodeStateAsUpdate(ydoc1)
const state2 = Y.encodeStateAsUpdate(ydoc2)
Y.applyUpdate(ydoc1, state2)
Y.applyUpdate(ydoc2, state1)
```

#### Example: Sync two clients by computing the differences

This example shows how to sync two clients with the minimal amount of exchanged
data by computing only the differences using the state vector of the remote
client. Syncing clients using the state vector requires another roundtrip, but
can safe a lot of bandwidth.

```js
const stateVector1 = Y.encodeStateVector(ydoc1)
const stateVector2 = Y.encodeStateVector(ydoc2)
const diff1 = Y.encodeStateAsUpdate(ydoc1, stateVector2)
const diff2 = Y.encodeStateAsUpdate(ydoc2, stateVector1)
Y.applyUpdate(ydoc1, diff2)
Y.applyUpdate(ydoc2, diff1)
```

<dl>
  <b><code>Y.applyUpdate(Y.Doc, update:Uint8Array, [transactionOrigin:any])</code></b>
  <dd>
Apply a document update on the shared document. Optionally you can specify
<code>transactionOrigin</code> that will be stored on
<code>transaction.origin</code>
and <code>ydoc.on('update', (update, origin) => ..)</code>.
  </dd>
  <b><code>Y.encodeStateAsUpdate(Y.Doc, [encodedTargetStateVector:Uint8Array]):Uint8Array</code></b>
  <dd>
Encode the document state as a single update message that can be applied on the
remote document. Optionally specify the target state vector to only write the
differences to the update message.
  </dd>
  <b><code>Y.encodeStateVector(Y.Doc):Uint8Array</code></b>
  <dd>Computes the state vector and encodes it into an Uint8Array.</dd>
</dl>

### Relative Positions

> This API is not stable yet

This feature is intended for managing selections / cursors. When working with
other users that manipulate the shared document, you can't trust that an index
position (an integer) will stay at the intended location. A *relative position*
is fixated to an element in the shared document and is not affected by remote
changes. I.e. given the document `"a|c"`, the relative position is attached to
`c`. When a remote user modifies the document by inserting a character before
the cursor, the cursor will stay attached to the character `c`. `insert(1,
'x')("a|c") = "ax|c"`. When the *relative position* is set to the end of the
document, it will stay attached to the end of the document.

#### Example: Transform to RelativePosition and back

```js
const relPos = Y.createRelativePositionFromTypeIndex(ytext, 2)
const pos = Y.createAbsolutePositionFromRelativePosition(relPos, doc)
pos.type === ytext // => true
pos.index === 2 // => true
```

#### Example: Send relative position to remote client (json)

```js
const relPos = Y.createRelativePositionFromTypeIndex(ytext, 2)
const encodedRelPos = JSON.stringify(relPos)
// send encodedRelPos to remote client..
const parsedRelPos = JSON.parse(encodedRelPos)
const pos = Y.createAbsolutePositionFromRelativePosition(parsedRelPos, remoteDoc)
pos.type === remoteytext // => true
pos.index === 2 // => true
```

#### Example: Send relative position to remote client (Uint8Array)

```js
const relPos = Y.createRelativePositionFromTypeIndex(ytext, 2)
const encodedRelPos = Y.encodeRelativePosition(relPos)
// send encodedRelPos to remote client..
const parsedRelPos = Y.decodeRelativePosition(encodedRelPos)
const pos = Y.createAbsolutePositionFromRelativePosition(parsedRelPos, remoteDoc)
pos.type === remoteytext // => true
pos.index === 2 // => true
```

<dl>
  <b><code>Y.createRelativePositionFromTypeIndex(Uint8Array|Y.Type, number)</code></b>
  <dd></dd>
  <b><code>Y.createAbsolutePositionFromRelativePosition(RelativePosition, Y.Doc)</code></b>
  <dd></dd>
  <b><code>Y.encodeRelativePosition(RelativePosition):Uint8Array</code></b>
  <dd></dd>
  <b><code>Y.decodeRelativePosition(Uint8Array):RelativePosition</code></b>
  <dd></dd>
</dl>

### Y.UndoManager

Yjs ships with an Undo/Redo manager for selective undo/redo of of changes on a
Yjs type. The changes can be optionally scoped to transaction origins.

```js
const ytext = doc.getText('text')
const undoManager = new Y.UndoManager(ytext)

ytext.insert(0, 'abc')
undoManager.undo()
ytext.toString() // => ''
undoManager.redo()
ytext.toString() // => 'abc'
```

<dl>
  <b><code>constructor(scope:Y.AbstractType|Array&lt;Y.AbstractType&gt;
  [, {captureTimeout:number,trackedOrigins:Set&lt;any&gt;,deleteFilter:function(item):boolean}])</code></b>
  <dd>Accepts either single type as scope or an array of types.</dd>
  <b><code>undo()</code></b>
  <dd></dd>
  <b><code>redo()</code></b>
  <dd></dd>
  <b><code>stopCapturing()</code></b>
  <dd></dd>
  <b>
    <code>
on('stack-item-added', { stackItem: { meta: Map&lt;any,any&gt; }, type: 'undo'
| 'redo' })
    </code>
  </b>
  <dd>
Register an event that is called when a <code>StackItem</code> is added to the
undo- or the redo-stack.
  </dd>
  <b>
    <code>
on('stack-item-popped', { stackItem: { meta: Map&lt;any,any&gt; }, type: 'undo'
| 'redo' })
    </code>
  </b>
  <dd>
Register an event that is called when a <code>StackItem</code> is popped from
the undo- or the redo-stack.
  </dd>
</dl>

#### Example: Stop Capturing

UndoManager merges Undo-StackItems if they are created within time-gap
smaller than `options.captureTimeout`. Call `um.stopCapturing()` so that the next
StackItem won't be merged.

```js
// without stopCapturing
ytext.insert(0, 'a')
ytext.insert(1, 'b')
undoManager.undo()
ytext.toString() // => '' (note that 'ab' was removed)
// with stopCapturing
ytext.insert(0, 'a')
undoManager.stopCapturing()
ytext.insert(0, 'b')
undoManager.undo()
ytext.toString() // => 'a' (note that only 'b' was removed)
```

#### Example: Specify tracked origins

Every change on the shared document has an origin. If no origin was specified,
it defaults to `null`. By specifying `trackedOrigins` you can
selectively specify which changes should be tracked by `UndoManager`. The
UndoManager instance is always added to `trackedOrigins`.

```js
class CustomBinding {}

const ytext = doc.getText('text')
const undoManager = new Y.UndoManager(ytext, {
  trackedOrigins: new Set([42, CustomBinding])
})

ytext.insert(0, 'abc')
undoManager.undo()
ytext.toString() // => 'abc' (does not track because origin `null` and not part
                 //           of `trackedTransactionOrigins`)
ytext.delete(0, 3) // revert change

doc.transact(() => {
  ytext.insert(0, 'abc')
}, 42)
undoManager.undo()
ytext.toString() // => '' (tracked because origin is an instance of `trackedTransactionorigins`)

doc.transact(() => {
  ytext.insert(0, 'abc')
}, 41)
undoManager.undo()
ytext.toString() // => '' (not tracked because 41 is not an instance of
                 //        `trackedTransactionorigins`)
ytext.delete(0, 3) // revert change

doc.transact(() => {
  ytext.insert(0, 'abc')
}, new CustomBinding())
undoManager.undo()
ytext.toString() // => '' (tracked because origin is a `CustomBinding` and
                 //        `CustomBinding` is in `trackedTransactionorigins`)
```

#### Example: Add additional information to the StackItems

When undoing or redoing a previous action, it is often expected to restore
additional meta information like the cursor location or the view on the
document. You can assign meta-information to Undo-/Redo-StackItems.

```js
const ytext = doc.getText('text')
const undoManager = new Y.UndoManager(ytext, {
  trackedOrigins: new Set([42, CustomBinding])
})

undoManager.on('stack-item-added', event => {
  // save the current cursor location on the stack-item
  event.stackItem.meta.set('cursor-location', getRelativeCursorLocation())
})

undoManager.on('stack-item-popped', event => {
  // restore the current cursor location on the stack-item
  restoreCursorLocation(event.stackItem.meta.get('cursor-location'))
})
```

## Yjs CRDT Algorithm

*Conflict-free replicated data types* (CRDT) for collaborative editing are an
alternative approach to *operational transformation* (OT). A very simple
differenciation between the two approaches is that OT attempts to transform
index positions to ensure convergence (all clients end up with the same
content), while CRDTs use mathematical models that usually do not involve index
transformations, like linked lists. OT is currently the de-facto standard for
shared editing on text. OT approaches that support shared editing without a
central source of truth (a central server) require too much bookkeeping to be
viable in practice. CRDTs are better suited for distributed systems, provide
additional guarantees that the document can be synced with remote clients, and
do not require a central source of truth.

Yjs implements a modified version of the algorithm described in [this
paper](https://www.researchgate.net/publication/310212186_Near_Real-Time_Peer-to-Peer_Shared_Editing_on_Extensible_Data_Types).
This [article](https://blog.kevinjahns.de/are-crdts-suitable-for-shared-editing/)
explains a simple optimization on the CRDT model and
gives more insight about the performance characteristics in Yjs.
More information about the specific implementation is available in
[INTERNALS.md](./INTERNALS.md) and in
[this walkthrough of the Yjs codebase](https://youtu.be/0l5XgnQ6rB4).

CRDTs that suitable for shared text editing suffer from the fact that they only grow
in size. There are CRDTs that do not grow in size, but they do not have the
characteristics that are benificial for shared text editing (like intention
preservation). Yjs implements many improvements to the original algorithm that
diminish the trade-off that the document only grows in size. We can't garbage
collect deleted structs (tombstones) while ensuring a unique order of the
structs. But we can 1. merge preceeding structs into a single struct to reduce
the amount of meta information, 2. we can delete content from the struct if it
is deleted, and 3. we can garbage collect tombstones if we don't care about the
order of the structs anymore (e.g. if the parent was deleted).

**Examples:**

1. If a user inserts elements in sequence, the struct will be merged into a
   single struct. E.g. `array.insert(0, ['a']), array.insert(0, ['b']);` is
   first represented as two structs (`[{id: {client, clock: 0}, content: 'a'},
   {id: {client, clock: 1}, content: 'b'}`) and then merged into a single
   struct: `[{id: {client, clock: 0}, content: 'ab'}]`.
2. When a struct that contains content (e.g. `ItemString`) is deleted, the
   struct will be replaced with an `ItemDeleted` that does not contain content
   anymore.
3. When a type is deleted, all child elements are transformed to `GC` structs. A
   `GC` struct only denotes the existence of a struct and that it is deleted.
   `GC` structs can always be merged with other `GC` structs if the id's are
   adjacent.

Especially when working on structured content (e.g. shared editing on
ProseMirror), these improvements yield very good results when
[benchmarking](https://github.com/dmonad/crdt-benchmarks) random document edits.
In practice they show even better results, because users usually edit text in
sequence, resulting in structs that can easily be merged. The benchmarks show
that even in the worst case scenario that a user edits text from right to left,
Yjs achieves good performance even for huge documents.

### State Vector

Yjs has the ability to exchange only the differences when syncing two clients.
We use lamport timestamps to identify structs and to track in which order a
client created them. Each struct has an `struct.id = { client: number, clock:
number}` that uniquely identifies a struct. We define the next expected `clock`
by each client as the *state vector*. This data structure is similar to the
[version vectors](https://en.wikipedia.org/wiki/Version_vector) data structure.
But we use state vectors only to describe the state of the local document, so we
can compute the missing struct of the remote client. We do not use it to track
causality.

## License and Author

Yjs and all related projects are [**MIT licensed**](./LICENSE).

Yjs is based on my research as a student at the [RWTH
i5](http://dbis.rwth-aachen.de/). Now I am working on Yjs in my spare time.

Fund this project by donating on [GitHub Sponsors](https://github.com/sponsors/dmonad)
or hiring [me](https://github.com/dmonad) as a contractor for your collaborative
app.
