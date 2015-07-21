/* global copyObject, compareIds */

var GeneratorFunction = (function *() {}).constructor;// eslint-disable-line

class EventHandler { // eslint-disable-line
  constructor (onevent) {
    this.waiting = []
    this.awaiting = 0
    this.onevent = onevent
    this.userEventListeners = []
  }
  receivedOp (op) {
    if (this.awaiting <= 0) {
      this.onevent([op])
    } else {
      this.waiting.push(copyObject(op))
    }
  }
  awaitAndPrematurelyCall (ops) {
    this.awaiting++
    this.onevent(ops)
  }
  addUserEventListener (f) {
    this.userEventListeners.push(f)
  }
  removeUserEventListener (f) {
    this.userEventListeners = this.userEventListeners.filter(function (g) {
      return f !== g
    })
  }
  removeAllUserEventListeners () {
    this.userEventListeners = []
  }
  callUserEventListeners (event) {
    for (var i in this.userEventListeners) {
      try {
        this.userEventListeners[i](event)
      } catch (e) {
        console.log('User events must not throw Errors!');// eslint-disable-line
      }
    }
  }
  awaitedLastInserts (n) {
    var ops = this.waiting.splice(this.waiting.length - n)
    for (var oid = 0; oid < ops.length; oid++) {
      var op = ops[oid]
      for (var i = this.waiting.length - 1; i >= 0; i--) {
        let w = this.waiting[i]
        if (compareIds(op.left, w.id)) {
          // include the effect of op in w
          w.right = op.id
          // exclude the effect of w in op
          op.left = w.left
        } else if (compareIds(op.right, w.id)) {
          // similar..
          w.left = op.id
          op.right = w.right
        }
      }
    }
    this.tryCallEvents()
  }
  awaitedLastDeletes (n, newLeft) {
    var ops = this.waiting.splice(this.waiting.length - n)
    for (var j in ops) {
      var del = ops[j]
      if (newLeft != null) {
        for (var i in this.waiting) {
          let w = this.waiting[i]
          // We will just care about w.left
          if (compareIds(del.target, w.left)) {
            del.left = newLeft
          }
        }
      }
    }
    this.tryCallEvents()
  }
  tryCallEvents () {
    this.awaiting--
    if (this.awaiting <= 0 && this.waiting.length > 0) {
      var events = this.waiting
      this.waiting = []
      this.onevent(events)
    }
  }
}

class CustomType { // eslint-disable-line
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
