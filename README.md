
# ![Yatta!](https://dadamonad.github.io/files/layout/Yatta_logo.png)

A Real-Time web framework that manages concurrency control for arbitrary data structures.
Yatta! provides similar functionality as [ShareJs](https://github.com/share/ShareJS) and [OpenCoweb](https://github.com/opencoweb/coweb),
but does not require you to understand how the internals work. The predefined data structures provide a simple API to access your shared data structures.

Predefined data structures:
* Text - [Collaborative Text Editing Example](http://dadamonad.github.io/Yatta/examples/TextEditing/)
* Json - [Tutorial](http://dadamonad.github.io/Yatta/examples/PeerJs-Json/)
* XML - [XML Example](http://dadamonad.github.io/Yatta/examples/XmlExample/) Collaboratively manipulate the dom with native dom-features and jQuery.

Unlike other frameworks, Yatta! supports P2P message propagation and is not bound to a specific communication protocol.

It is possible to add any communication protocol to Yatta. Currently it supports:
* [PeerJs](http://peerjs.com/) - A WebRTC Framework
* [SimpleWebRTC](http://simplewebrtc.com/) - Another WebRTC Framework (coming soon)
* [IWC](http://dbis.rwth-aachen.de/cms/projects/the-xmpp-experience#interwidget-communication) - Inter-widget Communication

## Use it!
The [examples](./examples/) provide an excellent starting point for beginners. Also the [API Documentation](http://dadamonad.github.io/Yatta/doc/) could prove to be very helpful.

Either clone this git repository, install it with [bower](http://bower.io/), or install it with [npm](https://www.npmjs.org/package/yatta).

### Bower
```
bower install Yatta
```
Then you include the libraries directly from the installation folder.

### Npm
```
npm install yatta --save
```

And use it like this with *npm*:
```
Y = require("yatta");
Y.createPeerJsConnector({key: 'xxx'}, function(Connector, user_id){
  yatta = new Y.JsonFramework(user_id, Connector);
```


## About
Find out more about the concurrent editing problem here
[Cooperation, Concurrency, Conflicts, and Convergence](http://opencoweb.org/ocwdocs/intro/openg.html) and here
[Operational Transformation (OT)](http://en.wikipedia.org/wiki/Operational_transformation)

My Bachelor Thesis project aim was to develop a P2P OT Framework that enables collaboration on XML documents and supports
[Intention Preservation](http://www3.ntu.edu.sg/home/czsun/projects/otfaq/#intentionPreservation).
After some time I realized that OT has significant drawbacks in P2P environments.

With my gained experiences I came up with a new approach. I named it *Yata* - Yet Another Transformation Approach.
It enables concurrent editing with the following space and time properties:
* Time complexity: O(S), whereby S is the number of operations that are inserted concurrently at the same position (no transformation against operations that happen on different positions).
* Space complexity = O(|Document|), whereby |Document| is the size of the shared document.

This means that my approach beats all OT time complexities. Furthermore, Yatta has a very strict definition of Intention Preservation, and I was able to
show that it is never violated.

Another advantage of Yata is that propagated messages are very small.
Background: In Real-Time P2P OT algorithms you have to send a state-vector with each message that defines the state of the History Buffer
on which the operation was created. This is not necessary in Yata.

The downside of this approach is that the History Buffer holds at least as many operations as there are characters in the document.
In contrast, an OT algorithm can have an empty History Buffer while the document size is very big.

Eventually (after my thesis), I will publish more information about Yata.

So, how did I come up with the name for the implementation (Yatta! is not Yata)?
Yatta! means "I did it!" in Japanese. You scream it when you accomplish something (for proper application I refer to the Yatta-man in [Heroes](http://heroeswiki.com/Yatta!)).
There is also this awesome video on the Internet that will change your life [Yatta](https://www.youtube.com/watch?v=kL5DDSglM_s).

## Status
Yatta! is still in an early development phase. Don't expect that everything is working fine.
But I would become really motivated if you gave me some feedback :) ([github](https://github.com/DadaMonad/Yatta/issues)).

### Current Issues
* HTML editable tag
* More efficient representation of text.
* Use a better data structure for the History Buffer - it should be possible to use Arrays.
* SimpleRTC support


## Support
Please report _any_ issues to the [Github issue page](https://github.com/DadaMonad/Yatta/issues)!
I would appreciate if developers gave me feedback on how _convenient_ the framework is, and if it is easy to use. Particularly the XML-support may not support every DOM-methods - if you encounter a method that does not cause any change on other peers,
please state function name, and sample parameters. However, there are browser-specific features, that Yatta won't support.

## License
Yatta! is licensed under the [MIT License](./LICENSE.txt).

<kevin.jahns@rwth-aachen.de>




