
# ![Yatta!](https://dadamonad.github.io/files/layout/yjs.svg)

[![Build Status](http://layers.dbis.rwth-aachen.de/jenkins/job/Yatta/badge/icon)](http://layers.dbis.rwth-aachen.de/jenkins/job/Yatta/)

Yjs is a framework for optimistic concurrency control and automatic conflict resolution on arbitrary data types. The framework implements a new OT-like concurrency algorithm and provides similar functionality as [ShareJs] and [OpenCoweb]. Yjs was designed to take away the pain from concurrently editing complex data types like Text, Json, and XML. You can find some applications for this framework [here](https://dadamonad.github.io/yjs/examples/).

In the future, we want to enable users to implement their own collaborative types. Currently we provide data types for
* Text
* Json
* XML

Unlike other frameworks, Yjs supports P2P message propagation and is not bound to a specific communication protocol. Therefore, Yjs is extremely scalable and can be used in a wide range of application scenarios.

We support several communication protocols as so called *Connectors*. You can create your own connector too - as it is described [here](https://dadamonad.github.io/yjs/connector/Howto-create-your-own-Connector.html). Currently, we support the following communication protocols:
* [XMPP-Connector](http://xmpp.org) - Propagates updates in a XMPP multi-user-chat room
* [WebRTC-Connector](http://peerjs.com) - Propagate updates directly with WebRTC
* [IWC-Connector](http://dbis.rwth-aachen.de/cms/projects/the-xmpp-experience#interwidget-communication) - Inter-widget Communication

You can use Yjs client-, and server- side. You can get it as via npm, and bower. We even provide a polymer element for Yjs!

The theoretical advantages over similar frameworks are support for
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

## Support
Please report _any_ issues to the [Github issue page](https://github.com/rwth-acis/yjs/issues)!
I would appreciate if developers give me feedback on how _convenient_ the framework is, and if it is easy to use. Particularly the XML-support may not support every DOM-methods - if you encounter a method that does not cause any change on other peers, please state function name, and sample parameters. However, there are browser-specific features, that Y won't support.

## License
Yjs is licensed under the [MIT License](./LICENSE.txt).

<kevin.jahns@rwth-aachen.de>

[ShareJs]: https://github.com/share/ShareJS
[OpenCoweb]: https://github.com/opencoweb/coweb


