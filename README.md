
# ![Yatta!](https://dadamonad.github.io/files/layout/yjs.svg)

[![Build Status](https://travis-ci.org/rwth-acis/yjs.svg)](https://travis-ci.org/rwth-acis/yjs)

Yjs is a framework for optimistic concurrency control and automatic conflict resolution on arbitrary data types. The framework implements a new OT-like concurrency algorithm and provides similar functionality as [ShareJs] and [OpenCoweb]. Yjs was designed to take away the pain from concurrently editing complex data types like Text, Json, and XML. You can find some applications for this framework [here](https://dadamonad.github.io/yjs/examples/).

You can create your own shared data types easily. Therefore, you can take matters into your own hand by defining the meaning of the shared types and ensure that it is valid, while Yjs ensures data consistency (everyone will eventually end up with the same data).
You can use existing types in your custom data type as well. We provide data types for
* (circular) Json Object
* [Text](https://github.com/rwth-acis/y-text)
* [List](https://github.com/rwth-acis/y-list)
* [XML](https://github.com/rwth-acis/y-xml)

Unlike other frameworks, Yjs supports P2P message propagation and is not bound to a specific communication protocol. Therefore, Yjs is extremely scalable and can be used in a wide range of application scenarios.

We support several communication protocols as so called *Connectors*. You can create your own connector too - read [this blog post](https://dadamonad.github.io/yjs/connector/Howto-create-your-own-Connector.html). Currently, we support the following communication protocols:
* [XMPP](https://github.com/rwth-acis/y-xmpp) - Propagates updates in a XMPP multi-user-chat room
* [WebRTC](https://github.com/rwth-acis/y-webrtc) - Propagate updates directly with WebRTC

You can use Yjs client-, and server- side. You can get it as via npm, and bower. We even provide polymer element for Yjs!

The advantages over similar frameworks are support for
* .. P2P message propagation and arbitrary communication protocols
* .. arbitrary complex data types
* .. offline editing: Only relevant changes are propagated on rejoin (unimplemented)
* .. AnyUndo: Undo *any* action that was executed in constant time (unimplemented)
* .. Intention Preservation: When working on Text, the intention of your changes are preserved. This is particularily important when working offline.


## Use it!
You find a tutorial, examples, and documentation on the [website](https://dadamonad.github.io/yjs/).

Either clone this git repository, install it with [bower](http://bower.io/), or install it with [npm](https://www.npmjs.org/package/yjs).

### Bower
```
bower install rwth-acis/yjs
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

## Status
Yjs is still in an early development phase. Don't expect that everything is working fine.
But I would become really motivated if you gave me some feedback :) ([github](https://github.com/rwth-acis/yjs/issues)).

### Current Issues
* The History Buffer should be able to store operations in a database
* Documentation
* Reimplement support for XML as a data type
* Custom data types


## Get help
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/rwth-acis/yjs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Please report _any_ issues to the [Github issue page](https://github.com/rwth-acis/yjs/issues)! I try to fix them very soon, if possible.

## Contribution
I created this framework during my bachelor thesis at the chair of computer science 5 [(i5)](http://dbis.rwth-aachen.de/cms), RWTH University. Since December 2014 I'm working on Yjs as a part of my student worker job at the i5.

## License
Yjs is licensed under the [MIT License](./LICENSE.txt).

<kevin.jahns@rwth-aachen.de>

[ShareJs]: https://github.com/share/ShareJS
[OpenCoweb]: https://github.com/opencoweb/coweb


