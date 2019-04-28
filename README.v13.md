# ![Yjs](https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png)
> The shared editing library

Yjs is a library for automatic conflict resolution on shared state. It implements an [operation-based CRDT](#Yjs-CRDT-Algorithm) and exposes its internal model as shared types. Shared types are common data types like `Map` or `Array` with superpowers: changes are automatically distributed to other peers and merged without merge conflicts.

Yjs is **network agnostic** (p2p!), supports many existing **rich text editors**, **offline editing**, **version snapshots**, **shared cursors**, and encodes update messages using **binary protocol encoding**.

* Chat: [https://gitter.im/y-js/yjs](https://gitter.im/y-js/yjs)
* Demos: [https://github.com/y-js/yjs-demos](https://github.com/y-js/yjs-demos)
* API Docs: [https://yjs.website/](https://yjs.website/)

# Table of Contents

* [Overview](#Overview)
  * [Bindings](#Bindings)
  * [Providers](#Providers)
* [Getting Started](#Getting-Started)
* [API](#API)
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


## Overview

This repository contains a collection of shared types that can be observed for changes and manipulated concurrently. Network functionality and two-way-bindings are implemented in separate modules.

### Bindings

| Name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Cursors | Binding |  Demo |
|---|:-:|---|---|
| [ProseMirror](https://prosemirror.net/) | ✔ | [y-prosemirror](http://github.com/y-js/y-prosemirror) | [link](https://yjs.website/tutorial-prosemirror.html) |
| [Quill](https://quilljs.com/) |  | [y-quill](http://github.com/y-js/y-quill) | [link](https://yjs.website/tutorial-quill.html) |
| [CodeMirror](https://codemirror.net/) | ✔ | [y-codemirror](http://github.com/y-js/y-codemirror) | [link](https://yjs.website/tutorial-codemirror.html) |
| [Ace](https://ace.c9.io/) | | [y-ace](http://github.com/y-js/y-ace) | [link]() |
| [Monaco](https://microsoft.github.io/monaco-editor/) | | [y-monaco](http://github.com/y-js/y-monaco) | [link]() |


### Providers

Setting up the communication between clients, managing awareness information, and storing shared data for offline usage is quite a hassle. **Providers** manage all that for you and are a good off-the-shelf solution.

<dl>
  <dt><a href="http://github.com/y-js/y-websocket">y-websocket</a></dt>
  <dd>A module that contains a simple websocket backend and a websocket client that connects to that backend. The backend can be extended to persist updates in a leveldb database.</dd>
  <dt><a href="http://github.com/y-js/y-mesh">y-mesh</a></dt>
  <dd>[WIP] Creates a connected graph of webrtc connections with a high <a href="https://en.wikipedia.org/wiki/Strength_of_a_graph">strength</a>. It requires a signalling server that connects a client to the first peer. But after that the network manages itself. It is well suited for large and small networks.</dd>
  <dt><a href="http://github.com/y-js/y-dat">y-dat</a></dt>
  <dd>[WIP] Writes updates effinciently in the dat network using <a href="https://github.com/kappa-db/multifeed">multifeed</a>. Each client has an append-only log of CRDT local updates (hypercore). Multifeed manages and sync hypercores and y-dat listens to changes and applies them to the Yjs document.</dd>
</dl>

## Getting Started

Install Yjs and a provider with your favorite package manager. In this section we are going to bind a YText to a DOM textarea.

```sh
npm i yjs@13.0.0-80 y-websocket@1.0.0-1 y-textarea
```

**Start the y-websocket server**

```sh
PORT=1234 node ./node_modules/y-websocket/bin/server.js
```

**Textarea Binding Example**

```js
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { TextareaBinding } from 'y-textarea'

const provider = new WebsocketProvider('http://localhost:1234')
const sharedDocument = provider.get('my-favourites')

// Define a shared type on the document.
const ytext = sharedDocument.getText('my resume')

// bind to a textarea
const binding = new TextareaBinding(ytext, document.querySelector('textarea'))
```

Now you understand how types are defined on a shared document. Next you can jump to the [demo repository](https://github.com/y-js/yjs-demos) or continue reading the API docs.

## API

```js
import * as Y from 'yjs'
```

<details>
  <summary><b>Y.Array</b></summary>
  <br>
  <p>
    A shareable Array-like type that supports efficient insert/delete of elements at any position. Internally it uses a linked list of Arrays that is split when necessary.
  </p>
  <pre>const yarray = new Y.Array()</pre>
  <dl>
    <b><code>insert(index:number, content:Array&lt;object|string|number|Y.Type&gt;)</code></b>
    <dd>
      Insert content at <var>index</var>. Note that content is an array of elements. I.e. <code>array.insert(0, [1]</code> splices the list and inserts 1 at position 0.
    </dd>
    <b><code>push(Array&lt;Object|Array|string|number|Y.Type&gt;)</code></b>
    <dd></dd>
    <b><code>delete(index:number, length:number)</code></b>
    <dd></dd>
    <b><code>get(index:number)</code></b>
    <dd></dd>
    <b><code>length:number</code></b>
    <dd></dd>
    <b><code>map(function(T, number, YArray):M):Array&lt;M&gt;</code></b>
    <dd></dd>
    <b><code>toArray():Array&lt;Object|Array|string|number|Y.Type&gt;</code></b>
    <dd>Copies the content of this YArray to a new Array.</dd>
    <b><code>toJSON():Array&lt;Object|Array|string|number&gt;</code></b>
    <dd>Copies the content of this YArray to a new Array. It transforms all child types to JSON using their <code>toJSON</code> method.</dd>
    <b><code>[Symbol.Iterator]</code></b>
    <dd>
      Returns an YArray Iterator that contains the values for each index in the array.
      <pre>for (let value of yarray) { .. }</pre>
    </dd>
    <b><code>observe(function(YArrayEvent, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YArrayEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type or any of its children is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns. The event listener receives all Events created by itself or any of its children.
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
    <b><code>get(key:string):object|string|number|Y.Type</code></b>
    <dd></dd>
    <b><code>set(key:string, value:object|string|number|Y.Type)</code></b>
    <dd></dd>
    <b><code>delete(key:string)</code></b>
    <dd></dd>
    <b><code>has(key:string):boolean</code></b>
    <dd></dd>
    <b><code>get(index:number)</code></b>
    <dd></dd>
    <b><code>toJSON():Object&lt;string, Object|Array|string|number&gt;</code></b>
    <dd>Copies the <code>[key,value]</code> pairs of this YMap to a new Object. It transforms all child types to JSON using their <code>toJSON</code> method.</dd>
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
      Adds an event listener to this type that will be called synchronously every time this type is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YMapEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type or any of its children is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns. The event listener receives all Events created by itself or any of its children.
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
    A shareable type that is optimized for shared editing on text. It allows to assign properties to ranges in the text. This makes it possible to implement rich-text bindings to this type.
  </p>
  <p>
    This type can also be transformed to the <a href="https://quilljs.com/docs/delta">delta format</a>. Similarly the YTextEvents compute changes as deltas.
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
    <b><code>applyDelta(delta)</code></b>
    <dd>See <a href="https://quilljs.com/docs/delta/">Quill Delta</a></dd>
    <b><code>length:number</code></b>
    <dd></dd>
    <b><code>toString():string</code></b>
    <dd>Transforms this type, without formatting options, into a string.</dd>
    <b><code>toJSON():string</code></b>
    <dd>See <code>toString</code></dd>
    <b><code>toDelta():Delta</code></b>
    <dd>Transforms this type to a <a href="https://quilljs.com/docs/delta/">Quill Delta</a></dd>
    <b><code>observe(function(YTextEvent, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YTextEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type or any of its children is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns. The event listener receives all Events created by itself or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>

<details>
  <summary><b>YXmlFragment</b></summary>
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
    <b><code>length:number</code></b>
    <dd></dd>
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
      Adds an event listener to this type that will be called synchronously every time this type is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YXmlEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type or any of its children is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns. The event listener receives all Events created by itself or any of its children.
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
    A shareable type that represents an XML Element. It has a <code>nodeName</code>, attributes, and a list of children. But it makes no effort to validate its content and be actually XML compliant.
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
      Adds an event listener to this type that will be called synchronously every time this type is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns.
    </dd>
    <b><code>unobserve(function(YXmlEvent, Transaction):void)</code></b>
    <dd>
      Removes an <code>observe</code> event listener from this type.
    </dd>
    <b><code>observeDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Adds an event listener to this type that will be called synchronously every time this type or any of its children is modified. In the case this type is modified in the event listener, the event listener will be called again after the current event listener returns. The event listener receives all Events created by itself or any of its children.
    </dd>
    <b><code>unobserveDeep(function(Array&lt;YEvent&gt;, Transaction):void)</code></b>
    <dd>
      Removes an <code>observeDeep</code> event listener from this type.
    </dd>
  </dl>
</details>

### Custom Types

## Bindings

## Transaction

## Binary Encoding Protocols

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
  },
  "maxNodeModuleJsDepth": 5
}
```

## Yjs CRDT Algorithm

## License and Author

Yjs and all related projects are [**MIT licensed**](./LICENSE).

Yjs is based on the research I did as a student at the [RWTH i5](http://dbis.rwth-aachen.de/). Now I am working on Yjs in my spare time.

Support me on [Patreon](https://www.patreon.com/dmonad) to fund this project or hire [me](https://github.com/dmonad) for professional support.
