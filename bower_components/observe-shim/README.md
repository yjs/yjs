Object.observe shim
===================

See : [The harmony proposal page](http://wiki.ecmascript.org/doku.php?id=harmony:observe).

Goal:
----

This shim provides an implementation of the algorithms described in the harmony proposal, and is intended to work on all ES5-compliant browsers.


Dependencies :
--------------

While this implementation does not have dependencies, it tries to use "setImmediate" if present, and fall back on setTimeout if it is not, it is recommended to use a setImmediate shim for browsers that do not support it natively. ( A good one can be found [here](https://github.com/NobleJS/setImmediate) )

Limitations :
-------------

While this shim provides an implementation for the Object methods, and the Notifier prototype described in the proposal, it does not try to catch and notify by any means changes made to an object.
Instead it let you call manually the notify method :

    Object.getNotifier(myObject).notify({ type : "updated" , ....});

ObserveUtils :
--------------

The ['observe-utils.js'](http://github.com/kapit/observe-utils/) utilities that facilitate the use of this shim can be found on his [own repository](http://github.com/kapit/observe-utils/)


Example :
-------

    var myObject = {};
    ObserveUtils.defineObservableProperties(myObject, "foo", "bar");
    Object.observe(myObject, function (changes) {
        console.log(changes);
    });
    myObject.foo = "Hello";
    myObject.bar = "World";

    //log

    [
        {
            name : "foo",
            object : myObject,
            oldValue : undefined,
            type : "updated"
        },
        {
            name : "bar",
            object : myObject,
            oldValue : undefined,
            type : "updated"
        }
    ]

Build And Test:
---------------

Require [bower](https://github.com/twitter/bower) and [grunt-cli](https://github.com/gruntjs/grunt-cli) installed on your machine.

    npm install & bower install
    grunt // test and build
    grunt test // test only

