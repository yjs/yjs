/* @flow */
'use strict'

/*
  EventHandler is an helper class for constructing custom types.

  Why: When constructing custom types, you sometimes want your types to work
  synchronous: E.g.
  ``` Synchronous
    mytype.setSomething("yay")
    mytype.getSomething() === "yay"
  ```
  versus
  ``` Asynchronous
    mytype.setSomething("yay")
    mytype.getSomething() === undefined
    mytype.waitForSomething().then(function(){
      mytype.getSomething() === "yay"
    })
  ```

  The structures usually work asynchronously (you have to wait for the
  database request to finish). EventHandler will help you to make your type
  synchronous.
*/
module.exports = function (Y /* : YGlobal*/) {
  Y.utils = {}

  class EventHandler {
    /* ::
    waiting: Array<Insertion | Deletion>;
    awaiting: number;
    onevent: Function;
    eventListeners: Array<Function>;
    */
    /*
      onevent: is called when the structure changes.

      Note: "awaiting opertations" is used to denote operations that were
      prematurely called. Events for received operations can not be executed until
      all prematurely called operations were executed ("waiting operations")
    */
    constructor (onevent /* : Function */) {
      this.waiting = []
      this.awaiting = 0
      this.onevent = onevent
      this.eventListeners = []
    }
    /*
      Call this when a new operation arrives. It will be executed right away if
      there are no waiting operations, that you prematurely executed
    */
    receivedOp (op) {
      if (this.awaiting <= 0) {
        this.onevent([op])
      } else {
        this.waiting.push(Y.utils.copyObject(op))
      }
    }
    /*
      You created some operations, and you want the `onevent` function to be
      called right away. Received operations will not be executed untill all
      prematurely called operations are executed
    */
    awaitAndPrematurelyCall (ops) {
      this.awaiting++
      this.onevent(ops)
    }
    /*
      Basic event listener boilerplate...
      TODO: maybe put this in a different type..
    */
    addEventListener (f) {
      this.eventListeners.push(f)
    }
    removeEventListener (f) {
      this.eventListeners = this.eventListeners.filter(function (g) {
        return f !== g
      })
    }
    removeAllEventListeners () {
      this.eventListeners = []
    }
    callEventListeners (event) {
      for (var i = 0; i < this.eventListeners.length; i++) {
        try {
          this.eventListeners[i](event)
        } catch (e) {
          console.log('User events must not throw Errors!') // eslint-disable-line
        }
      }
    }
    /*
      Call this when you successfully awaited the execution of n Insert operations
    */
    awaitedInserts (n) {
      var ops = this.waiting.splice(this.waiting.length - n)
      for (var oid = 0; oid < ops.length; oid++) {
        var op = ops[oid]
        if (op.struct === 'Insert') {
          for (var i = this.waiting.length - 1; i >= 0; i--) {
            let w = this.waiting[i]
            if (w.struct === 'Insert') {
              if (Y.utils.compareIds(op.left, w.id)) {
                // include the effect of op in w
                w.right = op.id
                // exclude the effect of w in op
                op.left = w.left
              } else if (Y.utils.compareIds(op.right, w.id)) {
                // similar..
                w.left = op.id
                op.right = w.right
              }
            }
          }
        } else {
          throw new Error('Expected Insert Operation!')
        }
      }
      this._tryCallEvents()
    }
    /*
      Call this when you successfully awaited the execution of n Delete operations
    */
    awaitedDeletes (n, newLeft) {
      var ops = this.waiting.splice(this.waiting.length - n)
      for (var j = 0; j < ops.length; j++) {
        var del = ops[j]
        if (del.struct === 'Delete') {
          if (newLeft != null) {
            for (var i = 0; i < this.waiting.length; i++) {
              let w = this.waiting[i]
              // We will just care about w.left
              if (w.struct === 'Insert' && Y.utils.compareIds(del.target, w.left)) {
                w.left = newLeft
              }
            }
          }
        } else {
          throw new Error('Expected Delete Operation!')
        }
      }
      this._tryCallEvents()
    }
    /* (private)
      Try to execute the events for the waiting operations
    */
    _tryCallEvents () {
      this.awaiting--
      if (this.awaiting <= 0 && this.waiting.length > 0) {
        var events = this.waiting
        this.waiting = []
        this.onevent(events)
      }
    }
  }
  Y.utils.EventHandler = EventHandler

  /*
    A wrapper for the definition of a custom type.
    Every custom type must have three properties:

    * createType
      - Defines the model of a newly created custom type and returns the type
    * initType
      - Given a model, creates a custom type
    * class
      - the constructor of the custom type (e.g. in order to inherit from a type)
  */
  class CustomType { // eslint-disable-line
    /* ::
    createType: any;
    initType: any;
    class: Function;
    */
    constructor (def) {
      if (def.createType == null ||
        def.initType == null ||
        def.class == null
      ) {
        throw new Error('Custom type was not initialized correctly!')
      }
      this.createType = def.createType
      this.initType = def.initType
      this.class = def.class
    }
  }
  Y.utils.CustomType = CustomType

  /*
    Make a flat copy of an object
    (just copy properties)
  */
  function copyObject (o) {
    var c = {}
    for (var key in o) {
      c[key] = o[key]
    }
    return c
  }
  Y.utils.copyObject = copyObject

  /*
    Defines a smaller relation on Id's
  */
  function smaller (a, b) {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
  }
  Y.utils.smaller = smaller

  function compareIds (id1, id2) {
    if (id1 == null || id2 == null) {
      if (id1 == null && id2 == null) {
        return true
      }
      return false
    }
    if (id1[0] === id2[0] && id1[1] === id2[1]) {
      return true
    } else {
      return false
    }
  }
  Y.utils.compareIds = compareIds
}
