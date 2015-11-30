(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
(function (process,global){
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

!(function(global) {
  "use strict";

  var hasOwn = Object.prototype.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided, then outerFn.prototype instanceof Generator.
    var generator = Object.create((outerFn || Generator).prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype;
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] = GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `value instanceof AwaitArgument` to determine if the yielded value is
  // meant to be awaited. Some may consider the name of this method too
  // cutesy, but they are curmudgeons.
  runtime.awrap = function(arg) {
    return new AwaitArgument(arg);
  };

  function AwaitArgument(arg) {
    this.arg = arg;
  }

  function AsyncIterator(generator) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value instanceof AwaitArgument) {
          return Promise.resolve(value.arg).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return Promise.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration. If the Promise is rejected, however, the
          // result for this iteration will be rejected with the same
          // reason. Note that rejections of yielded Promises are not
          // thrown back into the generator function, as is the case
          // when an awaited Promise is rejected. This difference in
          // behavior between yield and await is important, because it
          // allows the consumer to decide what to do with the yielded
          // rejection (swallow it and continue, manually .throw it back
          // into the generator, abandon iteration, whatever). With
          // await, by contrast, there is no opportunity to examine the
          // rejection reason outside the generator function, so the
          // only option is to throw it from the await expression, and
          // let the generator function handle the exception.
          result.value = unwrapped;
          resolve(result);
        }, reject);
      }
    }

    if (typeof process === "object" && process.domain) {
      invoke = process.domain.bind(invoke);
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new Promise(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          if (method === "return" ||
              (method === "throw" && delegate.iterator[method] === undefined)) {
            // A return or throw (when the delegate iterator has no throw
            // method) always terminates the yield* loop.
            context.delegate = null;

            // If the delegate iterator has a return method, give it a
            // chance to clean up.
            var returnMethod = delegate.iterator["return"];
            if (returnMethod) {
              var record = tryCatch(returnMethod, delegate.iterator, arg);
              if (record.type === "throw") {
                // If the return method threw an exception, let that
                // exception prevail over the original return or throw.
                method = "throw";
                arg = record.arg;
                continue;
              }
            }

            if (method === "return") {
              // Continue with the outer return, now that the delegate
              // iterator has been terminated.
              continue;
            }
          }

          var record = tryCatch(
            delegate.iterator[method],
            delegate.iterator,
            arg
          );

          if (record.type === "throw") {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = record.arg;
            continue;
          }

          // Delegate generator ran and handled its own exceptions so
          // regardless of what the method was, we continue as if it is
          // "next" with an undefined arg.
          method = "next";
          arg = undefined;

          var info = record.arg;
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            context.sent = undefined;
          }

        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          if (context.dispatchException(arg)) {
            // If the dispatched exception was caught by a catch block,
            // then let that catch block handle the exception normally.
            method = "next";
            arg = undefined;
          }

        } else if (method === "return") {
          context.abrupt("return", arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          var info = {
            value: record.arg,
            done: context.done
          };

          if (record.arg === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = undefined;
            }
          } else {
            return info;
          }

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(arg) call above.
          method = "throw";
          arg = record.arg;
        }
      }
    };
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp[toStringTagSymbol] = "Generator";

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      this.sent = undefined;
      this.done = false;
      this.delegate = null;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;
        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.next = finallyEntry.finallyLoc;
      } else {
        this.complete(record);
      }

      return ContinueSentinel;
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = record.arg;
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
})(
  // Among the various tricks for obtaining a reference to the global
  // object, this seems to be the most reliable technique that does not
  // use indirect eval (which violates Content Security Policy).
  typeof global === "object" ? global :
  typeof window === "object" ? window :
  typeof self === "object" ? self : this
);

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":1}],3:[function(require,module,exports){
/* @flow */
'use strict'

module.exports = function (Y/* :any */) {
  class AbstractConnector {
    /* ::
    y: YConfig;
    role: SyncRole;
    connections: Object;
    isSynced: boolean;
    userEventListeners: Array<Function>;
    whenSyncedListeners: Array<Function>;
    currentSyncTarget: ?UserId;
    syncingClients: Array<UserId>;
    forwardToSyncingClients: boolean;
    debug: boolean;
    broadcastedHB: boolean;
    syncStep2: Promise;
    userId: UserId;
    send: Function;
    broadcast: Function;
    */
    /*
      opts contains the following information:
       role : String Role of this client ("master" or "slave")
       userId : String Uniquely defines the user.
       debug: Boolean Whether to print debug messages (optional)
    */
    constructor (y, opts) {
      this.y = y
      if (opts == null) {
        opts = {}
      }
      if (opts.role == null || opts.role === 'master') {
        this.role = 'master'
      } else if (opts.role === 'slave') {
        this.role = 'slave'
      } else {
        throw new Error("Role must be either 'master' or 'slave'!")
      }
      this.y.db.forwardAppliedOperations = opts.forwardAppliedOperations || false
      this.role = opts.role
      this.connections = {}
      this.isSynced = false
      this.userEventListeners = []
      this.whenSyncedListeners = []
      this.currentSyncTarget = null
      this.syncingClients = []
      this.forwardToSyncingClients = opts.forwardToSyncingClients !== false
      this.debug = opts.debug === true
      this.broadcastedHB = false
      this.syncStep2 = Promise.resolve()
    }
    reconnect () {
    }
    disconnect () {
      this.connections = {}
      this.isSynced = false
      this.currentSyncTarget = null
      this.broadcastedHB = false
      this.syncingClients = []
      this.whenSyncedListeners = []
      return this.y.db.stopGarbageCollector()
    }
    setUserId (userId) {
      this.userId = userId
      return this.y.db.setUserId(userId)
    }
    onUserEvent (f) {
      this.userEventListeners.push(f)
    }
    userLeft (user) {
      delete this.connections[user]
      if (user === this.currentSyncTarget) {
        this.currentSyncTarget = null
        this.findNextSyncTarget()
      }
      this.syncingClients = this.syncingClients.filter(function (cli) {
        return cli !== user
      })
      for (var f of this.userEventListeners) {
        f({
          action: 'userLeft',
          user: user
        })
      }
    }
    userJoined (user, role) {
      if (role == null) {
        throw new Error('You must specify the role of the joined user!')
      }
      if (this.connections[user] != null) {
        throw new Error('This user already joined!')
      }
      this.connections[user] = {
        isSynced: false,
        role: role
      }
      for (var f of this.userEventListeners) {
        f({
          action: 'userJoined',
          user: user,
          role: role
        })
      }
      if (this.currentSyncTarget == null) {
        this.findNextSyncTarget()
      }
    }
    // Execute a function _when_ we are connected.
    // If not connected, wait until connected
    whenSynced (f) {
      if (this.isSynced) {
        f()
      } else {
        this.whenSyncedListeners.push(f)
      }
    }
    /*

     returns false, if there is no sync target
     true otherwise
    */
    findNextSyncTarget () {
      if (this.currentSyncTarget != null || this.isSynced) {
        return // "The current sync has not finished!"
      }

      var syncUser = null
      for (var uid in this.connections) {
        if (!this.connections[uid].isSynced) {
          syncUser = uid
          break
        }
      }
      if (syncUser != null) {
        var conn = this
        this.currentSyncTarget = syncUser
        this.y.db.requestTransaction(function *() {
          var stateSet = yield* this.getStateSet()
          var deleteSet = yield* this.getDeleteSet()
          conn.send(syncUser, {
            type: 'sync step 1',
            stateSet: stateSet,
            deleteSet: deleteSet
          })
        })
      } else {
        this.isSynced = true
        // call when synced listeners
        for (var f of this.whenSyncedListeners) {
          f()
        }
        this.whenSyncedListeners = []
        this.y.db.requestTransaction(function *() {
          yield* this.garbageCollectAfterSync()
        })
      }
    }
    send (uid, message) {
      if (this.debug) {
        console.log(`send ${this.userId} -> ${uid}: ${message.type}`, message) // eslint-disable-line
      }
    }
    /*
      You received a raw message, and you know that it is intended for Yjs. Then call this function.
    */
    receiveMessage (sender/* :UserId */, message/* :Message */) {
      if (sender === this.userId) {
        return
      }
      if (this.debug) {
        console.log(`receive ${sender} -> ${this.userId}: ${message.type}`, JSON.parse(JSON.stringify(message))) // eslint-disable-line
      }
      if (message.type === 'sync step 1') {
        // TODO: make transaction, stream the ops
        let conn = this
        let m = message
        this.y.db.requestTransaction(function *() {
          var currentStateSet = yield* this.getStateSet()
          yield* this.applyDeleteSet(m.deleteSet)

          var ds = yield* this.getDeleteSet()
          var ops = yield* this.getOperations(m.stateSet)
          conn.send(sender, {
            type: 'sync step 2',
            os: ops,
            stateSet: currentStateSet,
            deleteSet: ds
          })
          if (this.forwardToSyncingClients) {
            conn.syncingClients.push(sender)
            setTimeout(function () {
              conn.syncingClients = conn.syncingClients.filter(function (cli) {
                return cli !== sender
              })
              conn.send(sender, {
                type: 'sync done'
              })
            }, 5000) // TODO: conn.syncingClientDuration)
          } else {
            conn.send(sender, {
              type: 'sync done'
            })
          }
          conn._setSyncedWith(sender)
        })
      } else if (message.type === 'sync step 2') {
        let conn = this
        var broadcastHB = !this.broadcastedHB
        this.broadcastedHB = true
        var db = this.y.db
        var defer = {}
        defer.promise = new Promise(function (resolve) {
          defer.resolve = resolve
        })
        this.syncStep2 = defer.promise
        let m /* :MessageSyncStep2 */ = message
        db.requestTransaction(function * () {
          yield* this.applyDeleteSet(m.deleteSet)
          this.store.apply(m.os)
          db.requestTransaction(function * () {
            var ops = yield* this.getOperations(m.stateSet)
            if (ops.length > 0) {
              var update /* :MessageUpdate */ = {
                type: 'update',
                ops: ops
              }
              if (!broadcastHB) { // TODO: consider to broadcast here..
                conn.send(sender, update)
              } else {
                // broadcast only once!
                conn.broadcast(update)
              }
            }
            defer.resolve()
          })
        })
      } else if (message.type === 'sync done') {
        var self = this
        this.syncStep2.then(function () {
          self._setSyncedWith(sender)
        })
      } else if (message.type === 'update') {
        if (this.forwardToSyncingClients) {
          for (var client of this.syncingClients) {
            this.send(client, message)
          }
        }
        if (this.y.db.forwardAppliedOperations) {
          var delops = message.ops.filter(function (o) {
            return o.struct === 'Delete'
          })
          if (delops.length > 0) {
            this.broadcast({
              type: 'update',
              ops: delops
            })
          }
        }
        this.y.db.apply(message.ops)
      }
    }
    _setSyncedWith (user) {
      var conn = this.connections[user]
      if (conn != null) {
        conn.isSynced = true
      }
      if (user === this.currentSyncTarget) {
        this.currentSyncTarget = null
        this.findNextSyncTarget()
      }
    }
    /*
      Currently, the HB encodes operations as JSON. For the moment I want to keep it
      that way. Maybe we support encoding in the HB as XML in the future, but for now I don't want
      too much overhead. Y is very likely to get changed a lot in the future

      Because we don't want to encode JSON as string (with character escaping, wich makes it pretty much unreadable)
      we encode the JSON as XML.

      When the HB support encoding as XML, the format should look pretty much like this.

      does not support primitive values as array elements
      expects an ltx (less than xml) object
    */
    parseMessageFromXml (m/* :any */) {
      function parseArray (node) {
        for (var n of node.children) {
          if (n.getAttribute('isArray') === 'true') {
            return parseArray(n)
          } else {
            return parseObject(n)
          }
        }
      }
      function parseObject (node/* :any */) {
        var json = {}
        for (var attrName in node.attrs) {
          var value = node.attrs[attrName]
          var int = parseInt(value, 10)
          if (isNaN(int) || ('' + int) !== value) {
            json[attrName] = value
          } else {
            json[attrName] = int
          }
        }
        for (var n/* :any */ in node.children) {
          var name = n.name
          if (n.getAttribute('isArray') === 'true') {
            json[name] = parseArray(n)
          } else {
            json[name] = parseObject(n)
          }
        }
        return json
      }
      parseObject(m)
    }
    /*
      encode message in xml
      we use string because Strophe only accepts an "xml-string"..
      So {a:4,b:{c:5}} will look like
      <y a="4">
        <b c="5"></b>
      </y>
      m - ltx element
      json - Object
    */
    encodeMessageToXml (msg, obj) {
      // attributes is optional
      function encodeObject (m, json) {
        for (var name in json) {
          var value = json[name]
          if (name == null) {
            // nop
          } else if (value.constructor === Object) {
            encodeObject(m.c(name), value)
          } else if (value.constructor === Array) {
            encodeArray(m.c(name), value)
          } else {
            m.setAttribute(name, value)
          }
        }
      }
      function encodeArray (m, array) {
        m.setAttribute('isArray', 'true')
        for (var e of array) {
          if (e.constructor === Object) {
            encodeObject(m.c('array-element'), e)
          } else {
            encodeArray(m.c('array-element'), e)
          }
        }
      }
      if (obj.constructor === Object) {
        encodeObject(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj)
      } else if (obj.constructor === Array) {
        encodeArray(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj)
      } else {
        throw new Error("I can't encode this json!")
      }
    }
  }
  Y.AbstractConnector = AbstractConnector
}

},{}],4:[function(require,module,exports){
/* global getRandom, async */
'use strict'

module.exports = function (Y) {
  var globalRoom = {
    users: {},
    buffers: {},
    removeUser: function (user) {
      for (var i in this.users) {
        this.users[i].userLeft(user)
      }
      delete this.users[user]
      delete this.buffers[user]
    },
    addUser: function (connector) {
      this.users[connector.userId] = connector
      this.buffers[connector.userId] = []
      for (var uname in this.users) {
        if (uname !== connector.userId) {
          var u = this.users[uname]
          u.userJoined(connector.userId, 'master')
          connector.userJoined(u.userId, 'master')
        }
      }
    },
    whenTransactionsFinished: function () {
      var ps = []
      for (var name in this.users) {
        ps.push(this.users[name].y.db.whenTransactionsFinished())
      }
      return Promise.all(ps)
    },
    flushOne: function flushOne () {
      var bufs = []
      for (var i in globalRoom.buffers) {
        if (globalRoom.buffers[i].length > 0) {
          bufs.push(i)
        }
      }
      if (bufs.length > 0) {
        var userId = getRandom(bufs)
        var m = globalRoom.buffers[userId].shift()
        var user = globalRoom.users[userId]
        user.receiveMessage(m[0], m[1])
        return user.y.db.whenTransactionsFinished()
      } else {
        return false
      }
    },
    flushAll: function () {
      return new Promise(function (resolve) {
        // flushes may result in more created operations,
        // flush until there is nothing more to flush
        function nextFlush () {
          var c = globalRoom.flushOne()
          if (c) {
            while (c) {
              c = globalRoom.flushOne()
            }
            globalRoom.whenTransactionsFinished().then(nextFlush)
          } else {
            setTimeout(function () {
              var c = globalRoom.flushOne()
              if (c) {
                c.then(function () {
                  globalRoom.whenTransactionsFinished().then(nextFlush)
                })
              } else {
                resolve()
              }
            }, 10)
          }
        }
        globalRoom.whenTransactionsFinished().then(nextFlush)
      })
    }
  }
  Y.utils.globalRoom = globalRoom

  var userIdCounter = 0

  class Test extends Y.AbstractConnector {
    constructor (y, options) {
      if (options === undefined) {
        throw new Error('Options must not be undefined!')
      }
      options.role = 'master'
      options.forwardToSyncingClients = false
      super(y, options)
      this.setUserId((userIdCounter++) + '').then(() => {
        globalRoom.addUser(this)
      })
      this.globalRoom = globalRoom
      this.syncingClientDuration = 0
    }
    receiveMessage (sender, m) {
      super.receiveMessage(sender, JSON.parse(JSON.stringify(m)))
    }
    send (userId, message) {
      var buffer = globalRoom.buffers[userId]
      if (buffer != null) {
        buffer.push(JSON.parse(JSON.stringify([this.userId, message])))
      }
    }
    broadcast (message) {
      for (var key in globalRoom.buffers) {
        globalRoom.buffers[key].push(JSON.parse(JSON.stringify([this.userId, message])))
      }
    }
    isDisconnected () {
      return globalRoom.users[this.userId] == null
    }
    reconnect () {
      if (this.isDisconnected()) {
        globalRoom.addUser(this)
        super.reconnect()
      }
      return Y.utils.globalRoom.flushAll()
    }
    disconnect () {
      if (!this.isDisconnected()) {
        globalRoom.removeUser(this.userId)
        super.disconnect()
      }
      return this.y.db.whenTransactionsFinished()
    }
    flush () {
      var self = this
      return async(function * () {
        while (globalRoom.buffers[self.userId].length > 0) {
          var m = globalRoom.buffers[self.userId].shift()
          this.receiveMessage(m[0], m[1])
        }
        yield self.whenTransactionsFinished()
      })
    }
  }

  Y.Test = Test
}

},{}],5:[function(require,module,exports){
/* @flow */
'use strict'

module.exports = function (Y /* :any */) {
  /*
    Partial definition of an OperationStore.
    TODO: name it Database, operation store only holds operations.

    A database definition must alse define the following methods:
    * logTable() (optional)
      - show relevant information information in a table
    * requestTransaction(makeGen)
      - request a transaction
    * destroy()
      - destroy the database
  */
  class AbstractDatabase {
    /* ::
    y: YConfig;
    forwardAppliedOperations: boolean;
    listenersById: Object;
    listenersByIdExecuteNow: Array<Object>;
    listenersByIdRequestPending: boolean;
    initializedTypes: Object;
    whenUserIdSetListener: ?Function;
    waitingTransactions: Array<Transaction>;
    transactionInProgress: boolean;
    executeOrder: Array<Object>;
    gc1: Array<Struct>;
    gc2: Array<Struct>;
    gcTimeout: number;
    gcInterval: any;
    garbageCollect: Function;
    executeOrder: Array<any>; // for debugging only
    userId: UserId;
    opClock: number;
    transactionsFinished: ?{promise: Promise, resolve: any};
    transact: (x: ?Generator) => any;
    */
    constructor (y, opts) {
      this.y = y
      // whether to broadcast all applied operations (insert & delete hook)
      this.forwardAppliedOperations = false
      // E.g. this.listenersById[id] : Array<Listener>
      this.listenersById = {}
      // Execute the next time a transaction is requested
      this.listenersByIdExecuteNow = []
      // A transaction is requested
      this.listenersByIdRequestPending = false
      /* To make things more clear, the following naming conventions:
         * ls : we put this.listenersById on ls
         * l : Array<Listener>
         * id : Id (can't use as property name)
         * sid : String (converted from id via JSON.stringify
                         so we can use it as a property name)

        Always remember to first overwrite
        a property before you iterate over it!
      */
      // TODO: Use ES7 Weak Maps. This way types that are no longer user,
      // wont be kept in memory.
      this.initializedTypes = {}
      this.whenUserIdSetListener = null
      this.waitingTransactions = []
      this.transactionInProgress = false
      if (typeof YConcurrency_TestingMode !== 'undefined') {
        this.executeOrder = []
      }
      this.gc1 = [] // first stage
      this.gc2 = [] // second stage -> after that, remove the op
      this.gcTimeout = opts.gcTimeout || 5000
      var os = this
      function garbageCollect () {
        return new Promise((resolve) => {
          os.requestTransaction(function * () {
            if (os.y.connector != null && os.y.connector.isSynced) {
              for (var i = 0; i < os.gc2.length; i++) {
                var oid = os.gc2[i]
                yield* this.garbageCollectOperation(oid)
              }
              os.gc2 = os.gc1
              os.gc1 = []
            }
            if (os.gcTimeout > 0) {
              os.gcInterval = setTimeout(garbageCollect, os.gcTimeout)
            }
            resolve()
          })
        })
      }
      this.garbageCollect = garbageCollect
      if (this.gcTimeout > 0) {
        garbageCollect()
      }
    }
    addToDebug () {
      if (typeof YConcurrency_TestingMode !== 'undefined') {
        var command /* :string */ = Array.prototype.map.call(arguments, function (s) {
          if (typeof s === 'string') {
            return s
          } else {
            return JSON.stringify(s)
          }
        }).join('').replace(/"/g, "'").replace(/,/g, ', ').replace(/:/g, ': ')
        this.executeOrder.push(command)
      }
    }
    getDebugData () {
      console.log(this.executeOrder.join('\n'))
    }
    stopGarbageCollector () {
      var self = this
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          var ungc /* :Array<Struct> */ = self.gc1.concat(self.gc2)
          self.gc1 = []
          self.gc2 = []
          for (var i = 0; i < ungc.length; i++) {
            var op = yield* this.getOperation(ungc[i])
            delete op.gc
            yield* this.setOperation(op)
          }
          resolve()
        })
      })
    }
    /*
      Try to add to GC.

      TODO: rename this function

      Rulez:
      * Only gc if this user is online
      * The most left element in a list must not be gc'd.
        => There is at least one element in the list

      returns true iff op was added to GC
    */
    addToGarbageCollector (op, left) {
      if (
        op.gc == null &&
        op.deleted === true &&
        this.y.connector.isSynced &&
        left != null &&
        left.deleted === true
      ) {
        op.gc = true
        this.gc1.push(op.id)
        return true
      } else {
        return false
      }
    }
    removeFromGarbageCollector (op) {
      function filter (o) {
        return !Y.utils.compareIds(o, op.id)
      }
      this.gc1 = this.gc1.filter(filter)
      this.gc2 = this.gc2.filter(filter)
      delete op.gc
    }
    destroy () {
      clearInterval(this.gcInterval)
      this.gcInterval = null
    }
    setUserId (userId) {
      var self = this
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          self.userId = userId
          var state = yield* this.getState(userId)
          self.opClock = state.clock
          if (self.whenUserIdSetListener != null) {
            self.whenUserIdSetListener()
            self.whenUserIdSetListener = null
          }
          resolve()
        })
      })
    }
    whenUserIdSet (f) {
      if (this.userId != null) {
        f()
      } else {
        this.whenUserIdSetListener = f
      }
    }
    getNextOpId () {
      if (this.userId == null) {
        throw new Error('OperationStore not yet initialized!')
      }
      return [this.userId, this.opClock++]
    }
    /*
      Apply a list of operations.

      * get a transaction
      * check whether all Struct.*.requiredOps are in the OS
      * check if it is an expected op (otherwise wait for it)
      * check if was deleted, apply a delete operation after op was applied
    */
    apply (ops) {
      for (var key in ops) {
        var o = ops[key]
        var required = Y.Struct[o.struct].requiredOps(o)
        this.whenOperationsExist(required, o)
      }
    }
    /*
      op is executed as soon as every operation requested is available.
      Note that Transaction can (and should) buffer requests.
    */
    whenOperationsExist (ids, op) {
      if (ids.length > 0) {
        let listener = {
          op: op,
          missing: ids.length
        }

        for (let key in ids) {
          let id = ids[key]
          let sid = JSON.stringify(id)
          let l = this.listenersById[sid]
          if (l == null) {
            l = []
            this.listenersById[sid] = l
          }
          l.push(listener)
        }
      } else {
        this.listenersByIdExecuteNow.push({
          op: op
        })
      }

      if (this.listenersByIdRequestPending) {
        return
      }

      this.listenersByIdRequestPending = true
      var store = this

      this.requestTransaction(function * () {
        var exeNow = store.listenersByIdExecuteNow
        store.listenersByIdExecuteNow = []

        var ls = store.listenersById
        store.listenersById = {}

        store.listenersByIdRequestPending = false

        for (let key = 0; key < exeNow.length; key++) {
          let o = exeNow[key].op
          yield* store.tryExecute.call(this, o)
        }

        for (var sid in ls) {
          var l = ls[sid]
          var id = JSON.parse(sid)
          var op = yield* this.getOperation(id)
          if (op == null) {
            store.listenersById[sid] = l
          } else {
            for (let key in l) {
              let listener = l[key]
              let o = listener.op
              if (--listener.missing === 0) {
                yield* store.tryExecute.call(this, o)
              }
            }
          }
        }
      })
    }
    /*
      Actually execute an operation, when all expected operations are available.
    */
    /* :: // TODO: this belongs somehow to transaction
    store: Object;
    getOperation: any;
    isGarbageCollected: any;
    addOperation: any;
    whenOperationsExist: any;
    */
    * tryExecute (op) {
      this.store.addToDebug('yield* this.store.tryExecute.call(this, ', JSON.stringify(op), ')')
      if (op.struct === 'Delete') {
        yield* Y.Struct.Delete.execute.call(this, op)
        yield* this.store.operationAdded(this, op)
      } else {
        var defined = yield* this.getOperation(op.id)
        if (defined == null) {
          var isGarbageCollected = yield* this.isGarbageCollected(op.id)
          if (!isGarbageCollected) {
            yield* Y.Struct[op.struct].execute.call(this, op)
            yield* this.addOperation(op)
            yield* this.store.operationAdded(this, op)
          }
        }
      }
    }
    // called by a transaction when an operation is added
    * operationAdded (transaction, op) {
      if (op.struct === 'Delete') {
        var target = yield* transaction.getOperation(op.target)
        if (target != null) {
          var type = transaction.store.initializedTypes[JSON.stringify(target.parent)]
          if (type != null) {
            yield* type._changed(transaction, {
              struct: 'Delete',
              target: op.target
            })
          }
        }
      } else {
        // increase SS
        var o = op
        var state = yield* transaction.getState(op.id[0])
        while (o != null && o.id[1] === state.clock && op.id[0] === o.id[0]) {
          // either its a new operation (1. case), or it is an operation that was deleted, but is not yet in the OS
          state.clock++
          yield* transaction.checkDeleteStoreForState(state)
          o = yield* transaction.os.findNext(o.id)
        }
        yield* transaction.setState(state)

        // notify whenOperation listeners (by id)
        var sid = JSON.stringify(op.id)
        var l = this.listenersById[sid]
        delete this.listenersById[sid]

        if (l != null) {
          for (var key in l) {
            var listener = l[key]
            if (--listener.missing === 0) {
              this.whenOperationsExist([], listener.op)
            }
          }
        }
        var t = this.initializedTypes[JSON.stringify(op.parent)]

        // Delete if DS says this is actually deleted
        var opIsDeleted = yield* transaction.isDeleted(op.id)
        if (!op.deleted && opIsDeleted) {
          var delop = {
            struct: 'Delete',
            target: op.id
          }
          yield* Y.Struct['Delete'].execute.call(transaction, delop)
        }

        // notify parent, if it has been initialized as a custom type
        if (t != null) {
          yield* t._changed(transaction, Y.utils.copyObject(op))
        }
      }
    }
    whenTransactionsFinished () {
      if (this.transactionInProgress) {
        if (this.transactionsFinished == null) {
          var resolve
          var promise = new Promise(function (r) {
            resolve = r
          })
          this.transactionsFinished = {
            resolve: resolve,
            promise: promise
          }
          return promise
        } else {
          return this.transactionsFinished.promise
        }
      } else {
        return Promise.resolve()
      }
    }
    getNextRequest () {
      if (this.waitingTransactions.length === 0) {
        this.transactionInProgress = false
        if (this.transactionsFinished != null) {
          this.transactionsFinished.resolve()
          this.transactionsFinished = null
        }
        return null
      } else {
        return this.waitingTransactions.shift()
      }
    }
    requestTransaction (makeGen/* :any */, callImmediately) {
      if (callImmediately) {
        this.waitingTransactions.push(makeGen)
        if (!this.transactionInProgress) {
          this.transactionInProgress = true
          this.transact(this.getNextRequest())
        }
      } else {
        this.waitingTransactions.push(makeGen)
        if (!this.transactionInProgress) {
          this.transactionInProgress = true
          var self = this
          setTimeout(function () {
            self.transact(self.getNextRequest())
          }, 0)
        }
      }
    }
  }
  Y.AbstractDatabase = AbstractDatabase
}

},{}],6:[function(require,module,exports){
/* @flow */
'use strict'

/*
 An operation also defines the structure of a type. This is why operation and
 structure are used interchangeably here.

 It must be of the type Object. I hope to achieve some performance
 improvements when working on databases that support the json format.

 An operation must have the following properties:

 * encode
     - Encode the structure in a readable format (preferably string- todo)
 * decode (todo)
     - decode structure to json
 * execute
     - Execute the semantics of an operation.
 * requiredOps
     - Operations that are required to execute this operation.
*/
module.exports = function (Y/* :any */) {
  var Struct = {
    /* This is the only operation that is actually not a structure, because
    it is not stored in the OS. This is why it _does not_ have an id

    op = {
      target: Id
    }
    */
    Delete: {
      encode: function (op) {
        return op
      },
      requiredOps: function (op) {
        return [] // [op.target]
      },
      execute: function * (op) {
        return yield* this.deleteOperation(op.target)
      }
    },
    Insert: {
      /* {
          content: any,
          id: Id,
          left: Id,
          origin: Id,
          right: Id,
          parent: Id,
          parentSub: string (optional), // child of Map type
        }
      */
      encode: function (op/* :Insertion */) /* :Insertion */ {
        // TODO: you could not send the "left" property, then you also have to
        // "op.left = null" in $execute or $decode
        var e/* :any */ = {
          id: op.id,
          left: op.left,
          right: op.right,
          origin: op.origin,
          parent: op.parent,
          struct: op.struct
        }
        if (op.parentSub != null) {
          e.parentSub = op.parentSub
        }
        if (op.opContent != null) {
          e.opContent = op.opContent
        } else {
          e.content = op.content
        }

        return e
      },
      requiredOps: function (op) {
        var ids = []
        if (op.left != null) {
          ids.push(op.left)
        }
        if (op.right != null) {
          ids.push(op.right)
        }
        if (op.origin != null && !Y.utils.compareIds(op.left, op.origin)) {
          ids.push(op.origin)
        }
        // if (op.right == null && op.left == null) {
        ids.push(op.parent)

        if (op.opContent != null) {
          ids.push(op.opContent)
        }
        return ids
      },
      getDistanceToOrigin: function * (op) {
        if (op.left == null) {
          return 0
        } else {
          var d = 0
          var o = yield* this.getOperation(op.left)
          while (!Y.utils.compareIds(op.origin, (o ? o.id : null))) {
            d++
            if (o.left == null) {
              break
            } else {
              o = yield* this.getOperation(o.left)
            }
          }
          return d
        }
      },
      /*
      # $this has to find a unique position between origin and the next known character
      # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
      #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
      #         o2,o3 and o4 origin is 1 (the position of o2)
      #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
      #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
      #         therefore $this would be always to the right of o3
      # case 2: $origin < $o.origin
      #         if current $this insert_position > $o origin: $this ins
      #         else $insert_position will not change
      #         (maybe we encounter case 1 later, then this will be to the right of $o)
      # case 3: $origin > $o.origin
      #         $this insert_position is to the left of $o (forever!)
      */
      execute: function *(op) {
        var i // loop counter
        var distanceToOrigin = i = yield* Struct.Insert.getDistanceToOrigin.call(this, op) // most cases: 0 (starts from 0)
        var o
        var parent
        var start

        // find o. o is the first conflicting operation
        if (op.left != null) {
          o = yield* this.getOperation(op.left)
          o = (o.right == null) ? null : yield* this.getOperation(o.right)
        } else { // left == null
          parent = yield* this.getOperation(op.parent)
          let startId = op.parentSub ? parent.map[op.parentSub] : parent.start
          start = startId == null ? null : yield* this.getOperation(startId)
          o = start
        }

        // handle conflicts
        while (true) {
          if (o != null && !Y.utils.compareIds(o.id, op.right)) {
            var oOriginDistance = yield* Struct.Insert.getDistanceToOrigin.call(this, o)
            if (oOriginDistance === i) {
              // case 1
              if (o.id[0] < op.id[0]) {
                op.left = o.id
                distanceToOrigin = i + 1
              }
            } else if (oOriginDistance < i) {
              // case 2
              if (i - distanceToOrigin <= oOriginDistance) {
                op.left = o.id
                distanceToOrigin = i + 1
              }
            } else {
              break
            }
            i++
            if (o.right != null) {
              o = yield* this.getOperation(o.right)
            } else {
              o = null
            }
          } else {
            break
          }
        }

        // reconnect..
        var left = null
        var right = null
        if (parent == null) {
          parent = yield* this.getOperation(op.parent)
        }

        // reconnect left and set right of op
        if (op.left != null) {
          left = yield* this.getOperation(op.left)
          op.right = left.right
          left.right = op.id

          yield* this.setOperation(left)
        } else {
          op.right = op.parentSub ? parent.map[op.parentSub] || null : parent.start
        }
        // reconnect right
        if (op.right != null) {
          right = yield* this.getOperation(op.right)
          right.left = op.id

          // if right exists, and it is supposed to be gc'd. Remove it from the gc
          if (right.gc != null) {
            this.store.removeFromGarbageCollector(right)
          }
          yield* this.setOperation(right)
        }

        // update parents .map/start/end properties
        if (op.parentSub != null) {
          if (left == null) {
            parent.map[op.parentSub] = op.id
            yield* this.setOperation(parent)
          }
          // is a child of a map struct.
          // Then also make sure that only the most left element is not deleted
          if (op.right != null) {
            yield* this.deleteOperation(op.right, true)
          }
          if (op.left != null) {
            yield* this.deleteOperation(op.id, true)
          }
        } else {
          if (right == null || left == null) {
            if (right == null) {
              parent.end = op.id
            }
            if (left == null) {
              parent.start = op.id
            }
            yield* this.setOperation(parent)
          }
        }
      }
    },
    List: {
      /*
      {
        start: null,
        end: null,
        struct: "List",
        type: "",
        id: this.os.getNextOpId()
      }
      */
      encode: function (op) {
        return {
          struct: 'List',
          id: op.id,
          type: op.type
        }
      },
      requiredOps: function () {
        /*
        var ids = []
        if (op.start != null) {
          ids.push(op.start)
        }
        if (op.end != null){
          ids.push(op.end)
        }
        return ids
        */
        return []
      },
      execute: function * (op) {
        op.start = null
        op.end = null
      },
      ref: function * (op, pos) {
        if (op.start == null) {
          return null
        }
        var res = null
        var o = yield* this.getOperation(op.start)

        while (true) {
          if (!o.deleted) {
            res = o
            pos--
          }
          if (pos >= 0 && o.right != null) {
            o = yield* this.getOperation(o.right)
          } else {
            break
          }
        }
        return res
      },
      map: function * (o, f) {
        o = o.start
        var res = []
        while (o != null) { // TODO: change to != (at least some convention)
          var operation = yield* this.getOperation(o)
          if (!operation.deleted) {
            res.push(f(operation))
          }
          o = operation.right
        }
        return res
      }
    },
    Map: {
      /*
        {
          map: {},
          struct: "Map",
          type: "",
          id: this.os.getNextOpId()
        }
      */
      encode: function (op) {
        return {
          struct: 'Map',
          type: op.type,
          id: op.id,
          map: {} // overwrite map!!
        }
      },
      requiredOps: function () {
        return []
      },
      execute: function * () {},
      /*
        Get a property by name
      */
      get: function * (op, name) {
        var oid = op.map[name]
        if (oid != null) {
          var res = yield* this.getOperation(oid)
          if (res == null || res.deleted) {
            return void 0
          } else if (res.opContent == null) {
            return res.content
          } else {
            return yield* this.getType(res.opContent)
          }
        }
      }
    }
  }
  Y.Struct = Struct
}

},{}],7:[function(require,module,exports){
/* @flow */
'use strict'

/*
  Partial definition of a transaction

  A transaction provides all the the async functionality on a database.

  By convention, a transaction has the following properties:
  * ss for StateSet
  * os for OperationStore
  * ds for DeleteStore

  A transaction must also define the following methods:
  * checkDeleteStoreForState(state)
    - When increasing the state of a user, an operation with an higher id
      may already be garbage collected, and therefore it will never be received.
      update the state to reflect this knowledge. This won't call a method to save the state!
  * getDeleteSet(id)
    - Get the delete set in a readable format:
      {
        "userX": [
          [5,1], // starting from position 5, one operations is deleted
          [9,4]  // starting from position 9, four operations are deleted
        ],
        "userY": ...
      }
  * getOpsFromDeleteSet(ds) -- TODO: just call this.deleteOperation(id) here
    - get a set of deletions that need to be applied in order to get to
      achieve the state of the supplied ds
  * setOperation(op)
    - write `op` to the database.
      Note: this is allowed to return an in-memory object.
      E.g. the Memory adapter returns the object that it has in-memory.
      Changing values on this object will be stored directly in the database
      without calling this function. Therefore,
      setOperation may have no functionality in some adapters. This also has
      implications on the way we use operations that were served from the database.
      We try not to call copyObject, if not necessary.
  * addOperation(op)
    - add an operation to the database.
      This may only be called once for every op.id
      Must return a function that returns the next operation in the database (ordered by id)
  * getOperation(id)
  * removeOperation(id)
    - remove an operation from the database. This is called when an operation
      is garbage collected.
  * setState(state)
    - `state` is of the form
      {
        user: "1",
        clock: 4
      } <- meaning that we have four operations from user "1"
           (with these id's respectively: 0, 1, 2, and 3)
  * getState(user)
  * getStateVector()
    - Get the state of the OS in the form
    [{
      user: "userX",
      clock: 11
    },
     ..
    ]
  * getStateSet()
    - Get the state of the OS in the form
    {
      "userX": 11,
      "userY": 22
    }
   * getOperations(startSS)
     - Get the all the operations that are necessary in order to achive the
       stateSet of this user, starting from a stateSet supplied by another user
   * makeOperationReady(ss, op)
     - this is called only by `getOperations(startSS)`. It makes an operation
       applyable on a given SS.
*/
module.exports = function (Y/* :any */) {
  class TransactionInterface {
    /* ::
    store: Y.AbstractDatabase;
    ds: Store;
    os: Store;
    ss: Store;
    */
    /*
      Get a type based on the id of its model.
      If it does not exist yes, create it.
      TODO: delete type from store.initializedTypes[id] when corresponding id was deleted!
    */
    * getType (id) {
      var sid = JSON.stringify(id)
      var t = this.store.initializedTypes[sid]
      if (t == null) {
        var op = yield* this.getOperation(id)
        if (op != null) {
          t = yield* Y[op.type].initType.call(this, this.store, op)
          this.store.initializedTypes[sid] = t
        }
      }
      return t
    }
    /*
      Apply operations that this user created (no remote ones!)
        * does not check for Struct.*.requiredOps()
        * also broadcasts it through the connector
    */
    * applyCreatedOperations (ops) {
      var send = []
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i]
        yield* this.store.tryExecute.call(this, op)
        send.push(Y.Struct[op.struct].encode(op))
      }
      if (!this.store.y.connector.isDisconnected()) { // TODO: && !this.store.forwardAppliedOperations (but then i don't send delete ops)
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcast({
          type: 'update',
          ops: send
        })
      }
    }

    * deleteList (start) {
      if (this.store.y.connector.isSynced) {
        while (start != null && this.store.y.connector.isSynced) {
          start = yield* this.getOperation(start)
          start.gc = true
          yield* this.setOperation(start)
          // TODO: will always reset the parent..
          this.store.gc1.push(start.id)
          start = start.right
        }
      } else {
        // TODO: when not possible??? do later in (gcWhenSynced)
      }
    }

    /*
      Mark an operation as deleted, and add it to the GC, if possible.
    */
    * deleteOperation (targetId, preventCallType) /* :Generator<any, any, any> */ {
      var target = yield* this.getOperation(targetId)
      var callType = false

      if (target == null || !target.deleted) {
        yield* this.markDeleted(targetId)
      }

      if (target != null && target.gc == null) {
        if (!target.deleted) {
          callType = true
          // set deleted & notify type
          target.deleted = true
          /*
          if (!preventCallType) {
            var type = this.store.initializedTypes[JSON.stringify(target.parent)]
            if (type != null) {
              yield* type._changed(this, {
                struct: 'Delete',
                target: targetId
              })
            }
          }
          */
          // delete containing lists
          if (target.start != null) {
            // TODO: don't do it like this .. -.-
            yield* this.deleteList(target.start)
            yield* this.deleteList(target.id)
          }
          if (target.map != null) {
            for (var name in target.map) {
              yield* this.deleteList(target.map[name])
            }
            // TODO: here to..  (see above)
            yield* this.deleteList(target.id)
          }
          if (target.opContent != null) {
            yield* this.deleteOperation(target.opContent)
            target.opContent = null
          }
        }
        var left
        if (target.left != null) {
          left = yield* this.getOperation(target.left)
        } else {
          left = null
        }

        this.store.addToGarbageCollector(target, left)

        // set here because it was deleted and/or gc'd
        yield* this.setOperation(target)

        /*
          Check if it is possible to add right to the gc.
          Because this delete can't be responsible for left being gc'd,
          we don't have to add left to the gc..
        */
        var right
        if (target.right != null) {
          right = yield* this.getOperation(target.right)
        } else {
          right = null
        }
        if (
          right != null &&
          this.store.addToGarbageCollector(right, target)
        ) {
          yield* this.setOperation(right)
        }
        return callType
      }
    }
    /*
      Mark an operation as deleted&gc'd
    */
    * markGarbageCollected (id) {
      // this.mem.push(["gc", id]);
      var n = yield* this.markDeleted(id)
      if (!n.gc) {
        if (n.id[1] < id[1]) {
          // un-extend left
          var newlen = n.len - (id[1] - n.id[1])
          n.len -= newlen
          yield* this.ds.put(n)
          n = {id: id, len: newlen, gc: false}
          yield* this.ds.put(n)
        }
        // get prev&next before adding a new operation
        var prev = yield* this.ds.findPrev(id)
        var next = yield* this.ds.findNext(id)

        if (id[1] < n.id[1] + n.len - 1) {
          // un-extend right
          yield* this.ds.put({id: [id[0], id[1] + 1], len: n.len - 1, gc: false})
          n.len = 1
        }
        // set gc'd
        n.gc = true
        // can extend left?
        if (
          prev != null &&
          prev.gc &&
          Y.utils.compareIds([prev.id[0], prev.id[1] + prev.len], n.id)
        ) {
          prev.len += n.len
          yield* this.ds.delete(n.id)
          n = prev
          // ds.put n here?
        }
        // can extend right?
        if (
          next != null &&
          next.gc &&
          Y.utils.compareIds([n.id[0], n.id[1] + n.len], next.id)
        ) {
          n.len += next.len
          yield* this.ds.delete(next.id)
        }
        yield* this.ds.put(n)
      }
    }
    /*
      Mark an operation as deleted.

      returns the delete node
    */
    * markDeleted (id) {
      // this.mem.push(["del", id]);
      var n = yield* this.ds.findWithUpperBound(id)
      if (n != null && n.id[0] === id[0]) {
        if (n.id[1] <= id[1] && id[1] < n.id[1] + n.len) {
          // already deleted
          return n
        } else if (n.id[1] + n.len === id[1] && !n.gc) {
          // can extend existing deletion
          n.len++
        } else {
          // cannot extend left
          n = {id: id, len: 1, gc: false}
          yield* this.ds.put(n)
        }
      } else {
        // cannot extend left
        n = {id: id, len: 1, gc: false}
        yield* this.ds.put(n)
      }
      // can extend right?
      var next = yield* this.ds.findNext(n.id)
      if (
        next != null &&
        Y.utils.compareIds([n.id[0], n.id[1] + n.len], next.id) &&
        !next.gc
      ) {
        n.len = n.len + next.len
        yield* this.ds.delete(next.id)
      }
      yield* this.ds.put(n)
      return n
    }
    /*
      Call this method when the client is connected&synced with the
      other clients (e.g. master). This will query the database for
      operations that can be gc'd and add them to the garbage collector.
    */
    * garbageCollectAfterSync () {
      yield* this.os.iterate(this, null, null, function * (op) {
        if (op.deleted && op.left != null) {
          var left = yield* this.getOperation(op.left)
          this.store.addToGarbageCollector(op, left)
        }
      })
    }
    /*
      Really remove an op and all its effects.
      The complicated case here is the Insert operation:
      * reset left
      * reset right
      * reset parent.start
      * reset parent.end
      * reset origins of all right ops
    */
    * garbageCollectOperation (id) {
      this.store.addToDebug('yield* this.garbageCollectOperation(', id, ')')
      // check to increase the state of the respective user
      var state = yield* this.getState(id[0])
      if (state.clock === id[1]) {
        state.clock++
        // also check if more expected operations were gc'd
        yield* this.checkDeleteStoreForState(state)
        // then set the state
        yield* this.setState(state)
      }
      yield* this.markGarbageCollected(id)

      // if op exists, then clean that mess up..
      var o = yield* this.getOperation(id)
      if (o != null) {
        /*
        if (!o.deleted) {
          yield* this.deleteOperation(id)
          o = yield* this.getOperation(id)
        }
        */

        // remove gc'd op from the left op, if it exists
        if (o.left != null) {
          var left = yield* this.getOperation(o.left)
          left.right = o.right
          yield* this.setOperation(left)
        }
        // remove gc'd op from the right op, if it exists
        // also reset origins of right ops
        if (o.right != null) {
          var right = yield* this.getOperation(o.right)
          right.left = o.left
          if (Y.utils.compareIds(right.origin, o.id)) { // rights origin is o
            // find new origin of right ops
            // origin is the first left deleted operation
            var neworigin = o.left
            while (neworigin != null) {
              var neworigin_ = yield* this.getOperation(neworigin)
              if (neworigin_.deleted) {
                break
              }
              neworigin = neworigin_.left
            }

            // reset origin of right
            right.origin = neworigin

            // reset origin of all right ops (except first right - duh!),
            // until you find origin pointer to the left of o
            if (right.right != null) {
              var i = yield* this.getOperation(right.right)
              var ids = [o.id, o.right]
              while (ids.some(function (id) {
                return Y.utils.compareIds(id, i.origin)
              })) {
                if (Y.utils.compareIds(i.origin, o.id)) {
                  // reset origin of i
                  i.origin = neworigin
                  yield* this.setOperation(i)
                }
                // get next i
                if (i.right == null) {
                  break
                } else {
                  i = yield* this.getOperation(i.right)
                }
              }
            }
          } /* otherwise, rights origin is to the left of o,
               then there is no right op (from o), that origins in o */
          yield* this.setOperation(right)
        }

        if (o.parent != null) {
          // remove gc'd op from parent, if it exists
          var parent = yield* this.getOperation(o.parent)
          var setParent = false // whether to save parent to the os
          if (o.parentSub != null) {
            if (Y.utils.compareIds(parent.map[o.parentSub], o.id)) {
              setParent = true
              parent.map[o.parentSub] = o.right
            }
          } else {
            if (Y.utils.compareIds(parent.start, o.id)) {
              // gc'd op is the start
              setParent = true
              parent.start = o.right
            }
            if (Y.utils.compareIds(parent.end, o.id)) {
              // gc'd op is the end
              setParent = true
              parent.end = o.left
            }
          }
          if (setParent) {
            yield* this.setOperation(parent)
          }
        }
        // finally remove it from the os
        yield* this.removeOperation(o.id)
      }
    }
    * checkDeleteStoreForState (state) {
      var n = yield* this.ds.findWithUpperBound([state.user, state.clock])
      if (n != null && n.id[0] === state.user && n.gc) {
        state.clock = Math.max(state.clock, n.id[1] + n.len)
      }
    }
    /*
      apply a delete set in order to get
      the state of the supplied ds
    */
    * applyDeleteSet (ds) {
      var deletions = []
      function createDeletions (user, start, len, gc) {
        for (var c = start; c < start + len; c++) {
          deletions.push([user, c, gc])
        }
      }

      for (var user in ds) {
        var dv = ds[user]
        var pos = 0
        var d = dv[pos]
        yield* this.ds.iterate(this, [user, 0], [user, Number.MAX_VALUE], function * (n) {
          // cases:
          // 1. d deletes something to the right of n
          //  => go to next n (break)
          // 2. d deletes something to the left of n
          //  => create deletions
          //  => reset d accordingly
          //  *)=> if d doesn't delete anything anymore, go to next d (continue)
          // 3. not 2) and d deletes something that also n deletes
          //  => reset d so that it doesn't contain n's deletion
          //  *)=> if d does not delete anything anymore, go to next d (continue)
          while (d != null) {
            var diff = 0 // describe the diff of length in 1) and 2)
            if (n.id[1] + n.len <= d[0]) {
              // 1)
              break
            } else if (d[0] < n.id[1]) {
              // 2)
              // delete maximum the len of d
              // else delete as much as possible
              diff = Math.min(n.id[1] - d[0], d[1])
              createDeletions(user, d[0], diff, d[2])
            } else {
              // 3)
              diff = n.id[1] + n.len - d[0] // never null (see 1)
              if (d[2] && !n.gc) {
                // d marks as gc'd but n does not
                // then delete either way
                createDeletions(user, d[0], Math.min(diff, d[1]), d[2])
              }
            }
            if (d[1] <= diff) {
              // d doesn't delete anything anymore
              d = dv[++pos]
            } else {
              d[0] = d[0] + diff // reset pos
              d[1] = d[1] - diff // reset length
            }
          }
        })
        // for the rest.. just apply it
        for (; pos < dv.length; pos++) {
          d = dv[pos]
          createDeletions(user, d[0], d[1], d[2])
        }
      }
      for (var i = 0; i < deletions.length; i++) {
        var del = deletions[i]
        var id = [del[0], del[1]]
        // always try to delete..
        var addOperation = yield* this.deleteOperation(id)
        if (addOperation) {
          // TODO:.. really .. here? You could prevent calling all these functions in operationAdded
          yield* this.store.operationAdded(this, {struct: 'Delete', target: id})
        }
        if (del[2]) {
          // gc
          yield* this.garbageCollectOperation(id)
        }
      }
      if (this.store.forwardAppliedOperations) {
        var ops = deletions.map(function (d) {
          return {struct: 'Delete', target: [d[0], d[1]]}
        })
        this.store.y.connector.broadcast({
          type: 'update',
          ops: ops
        })
      }
    }
    * isGarbageCollected (id) {
      var n = yield* this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len && n.gc
    }
    /*
      A DeleteSet (ds) describes all the deleted ops in the OS
    */
    * getDeleteSet () {
      var ds = {}
      yield* this.ds.iterate(this, null, null, function * (n) {
        var user = n.id[0]
        var counter = n.id[1]
        var len = n.len
        var gc = n.gc
        var dv = ds[user]
        if (dv === void 0) {
          dv = []
          ds[user] = dv
        }
        dv.push([counter, len, gc])
      })
      return ds
    }
    * isDeleted (id) {
      var n = yield* this.ds.findWithUpperBound(id)
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len
    }
    * setOperation (op) {
      yield* this.os.put(op)
      return op
    }
    * addOperation (op) {
      yield* this.os.put(op)
      if (!this.store.y.connector.isDisconnected() && this.store.forwardAppliedOperations) {
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcast({
          type: 'update',
          ops: [op]
        })
      }
    }
    * getOperation (id) {
      return yield* this.os.find(id)
    }
    * removeOperation (id) {
      yield* this.os.delete(id)
    }
    * setState (state) {
      var val = {
        id: [state.user],
        clock: state.clock
      }
      yield* this.ss.put(val)
    }
    * getState (user) {
      var n = yield* this.ss.find([user])
      var clock = n == null ? null : n.clock
      if (clock == null) {
        clock = 0
      }
      return {
        user: user,
        clock: clock
      }
    }
    * getStateVector () {
      var stateVector = []
      yield* this.ss.iterate(this, null, null, function * (n) {
        stateVector.push({
          user: n.id[0],
          clock: n.clock
        })
      })
      return stateVector
    }
    * getStateSet () {
      var ss = {}
      yield* this.ss.iterate(this, null, null, function * (n) {
        ss[n.id[0]] = n.clock
      })
      return ss
    }
    * getOperations (startSS) {
      // TODO: use bounds here!
      if (startSS == null) {
        startSS = {}
      }
      var ops = []

      var endSV = yield* this.getStateVector()
      for (var endState of endSV) {
        var user = endState.user
        if (user === '_') {
          continue
        }
        var startPos = startSS[user] || 0

        yield* this.os.iterate(this, [user, startPos], [user, Number.MAX_VALUE], function * (op) {
          ops.push(op)
        })
      }
      var res = []
      for (var op of ops) {
        var o = yield* this.makeOperationReady(startSS, op)
        res.push(o)
      }
      return res
    }
    /*
      Here, we make op executable for the receiving user.

      Notes:
        startSS: denotes to the SV that the remote user sent
        currSS:  denotes to the state vector that the user should have if he
                 applies all already sent operations (increases is each step)

      We face several problems:
      * Execute op as is won't work because ops depend on each other
       -> find a way so that they do not anymore
      * When changing left, must not go more to the left than the origin
      * When changing right, you have to consider that other ops may have op
        as their origin, this means that you must not set one of these ops
        as the new right (interdependencies of ops)
      * can't just go to the right until you find the first known operation,
        With currSS
          -> interdependency of ops is a problem
        With startSS
          -> leads to inconsistencies when two users join at the same time.
             Then the position depends on the order of execution -> error!

        Solution:
        -> re-create originial situation
          -> set op.left = op.origin (which never changes)
          -> set op.right
               to the first operation that is known (according to startSS)
               or to the first operation that has an origin that is not to the
               right of op.
          -> Enforces unique execution order -> happy user

        Improvements: TODO
          * Could set left to origin, or the first known operation
            (startSS or currSS.. ?)
            -> Could be necessary when I turn GC again.
            -> Is a bad(ish) idea because it requires more computation
    */
    * makeOperationReady (startSS, op) {
      op = Y.Struct[op.struct].encode(op)
      op = Y.utils.copyObject(op)
      var o = op
      var ids = [op.id]
      // search for the new op.right
      // it is either the first known op (according to startSS)
      // or the o that has no origin to the right of op
      // (this is why we use the ids array)
      while (o.right != null) {
        var right = yield* this.getOperation(o.right)
        if (o.right[1] < (startSS[o.right[0]] || 0) || !ids.some(function (id) {
          return Y.utils.compareIds(id, right.origin)
        })) {
          break
        }
        ids.push(o.right)
        o = right
      }
      op.right = o.right
      op.left = op.origin
      return op
    }
  }
  Y.Transaction = TransactionInterface
}

},{}],8:[function(require,module,exports){
/* @flow */
'use strict'

module.exports = function (Y /* :any */) {
  class YMap {
    /* ::
    _model: Id;
    os: Y.AbstractDatabase;
    map: Object;
    contents: any;
    opContents: Object;
    eventHandler: Function;
    */
    constructor (os, model, contents, opContents) {
      this._model = model.id
      this.os = os
      this.map = Y.utils.copyObject(model.map)
      this.contents = contents
      this.opContents = opContents
      this.eventHandler = new Y.utils.EventHandler(ops => {
        var userEvents = []
        for (var i in ops) {
          var op = ops[i]
          var oldValue
          // key is the name to use to access (op)content
          var key = op.struct === 'Delete' ? op.key : op.parentSub

          // compute oldValue
          if (this.opContents[key] != null) {
            let prevType = this.opContents[key]
            oldValue = () => {// eslint-disable-line
              return new Promise((resolve) => {
                this.os.requestTransaction(function *() {// eslint-disable-line
                  var type = yield* this.getType(prevType)
                  resolve(type)
                })
              })
            }
          } else {
            oldValue = this.contents[key]
          }
          // compute op event
          if (op.struct === 'Insert') {
            if (op.left === null) {
              if (op.opContent != null) {
                delete this.contents[key]
                if (op.deleted) {
                  delete this.opContents[key]
                } else {
                  this.opContents[key] = op.opContent
                }
              } else {
                delete this.opContents[key]
                if (op.deleted) {
                  delete this.contents[key]
                } else {
                  this.contents[key] = op.content
                }
              }
              this.map[key] = op.id
              var insertEvent
              if (oldValue === undefined) {
                insertEvent = {
                  name: key,
                  object: this,
                  type: 'add'
                }
              } else {
                insertEvent = {
                  name: key,
                  object: this,
                  oldValue: oldValue,
                  type: 'update'
                }
              }
              userEvents.push(insertEvent)
            }
          } else if (op.struct === 'Delete') {
            if (Y.utils.compareIds(this.map[key], op.target)) {
              delete this.opContents[key]
              delete this.contents[key]
              var deleteEvent = {
                name: key,
                object: this,
                oldValue: oldValue,
                type: 'delete'
              }
              userEvents.push(deleteEvent)
            }
          } else {
            throw new Error('Unexpected Operation!')
          }
        }
        this.eventHandler.callEventListeners(userEvents)
      })
    }
    get (key) {
      // return property.
      // if property does not exist, return null
      // if property is a type, return a promise
      if (key == null) {
        throw new Error('You must specify key!')
      }
      if (this.opContents[key] == null) {
        return this.contents[key]
      } else {
        return new Promise((resolve) => {
          var oid = this.opContents[key]
          this.os.requestTransaction(function *() {
            var type = yield* this.getType(oid)
            resolve(type)
          })
        })
      }
    }
    /*
      If there is a primitive (not a custom type), then return it.
      Returns all primitive values, if propertyName is specified!
      Note: modifying the return value could result in inconsistencies!
        -- so make sure to copy it first!
    */
    getPrimitive (key) {
      if (key == null) {
        return Y.utils.copyObject(this.contents)
      } else {
        return this.contents[key]
      }
    }
    delete (key) {
      var right = this.map[key]
      if (right != null) {
        var del = {
          target: right,
          struct: 'Delete'
        }
        var eventHandler = this.eventHandler
        var modDel = Y.utils.copyObject(del)
        modDel.key = key
        eventHandler.awaitAndPrematurelyCall([modDel])
        this.os.requestTransaction(function *() {
          yield* this.applyCreatedOperations([del])
          eventHandler.awaitedDeletes(1)
        })
      }
    }
    set (key, value) {
      // set property.
      // if property is a type, return a promise
      // if not, apply immediately on this type an call event

      var right = this.map[key] || null
      var insert /* :any */ = {
        left: null,
        right: right,
        origin: null,
        parent: this._model,
        parentSub: key,
        struct: 'Insert'
      }
      return new Promise((resolve) => {
        if (value instanceof Y.utils.CustomType) {
          // construct a new type
          this.os.requestTransaction(function *() {
            var typeid = yield* value.createType.call(this)
            var type = yield* this.getType(typeid)
            insert.opContent = typeid
            insert.id = this.store.getNextOpId()
            yield* this.applyCreatedOperations([insert])
            resolve(type)
          })
        } else {
          insert.content = value
          insert.id = this.os.getNextOpId()
          var eventHandler = this.eventHandler
          eventHandler.awaitAndPrematurelyCall([insert])
          this.os.requestTransaction(function *() {
            yield* this.applyCreatedOperations([insert])
            eventHandler.awaitedInserts(1)
          })
          resolve(value)
        }
      })
    }
    observe (f) {
      this.eventHandler.addEventListener(f)
    }
    unobserve (f) {
      this.eventHandler.removeEventListener(f)
    }
    /*
      Observe a path.

      E.g.
      ```
      o.set('textarea', Y.TextBind)
      o.observePath(['textarea'], function(t){
        // is called whenever textarea is replaced
        t.bind(textarea)
      })

      returns a Promise that contains a function that removes the observer from the path.
    */
    observePath (path, f) {
      var self = this
      function observeProperty (events) {
        // call f whenever path changes
        for (var i = 0; i < events.length; i++) {
          var event = events[i]
          if (event.name === propertyName) {
            // call this also for delete events!
            var property = self.get(propertyName)
            if (property instanceof Promise) {
              property.then(f)
            } else {
              f(property)
            }
          }
        }
      }

      if (path.length < 1) {
        throw new Error('Path must contain at least one element!')
      } else if (path.length === 1) {
        var propertyName = path[0]
        var property = self.get(propertyName)
        if (property instanceof Promise) {
          property.then(f)
        } else {
          f(property)
        }
        this.observe(observeProperty)
        return Promise.resolve(function () {
          self.unobserve(f)
        })
      } else {
        var deleteChildObservers
        var resetObserverPath = function () {
          var promise = self.get(path[0])
          if (!promise instanceof Promise) {
            // its either not defined or a primitive value
            promise = self.set(path[0], Y.Map)
          }
          return promise.then(function (map) {
            return map.observePath(path.slice(1), f)
          }).then(function (_deleteChildObservers) {
            // update deleteChildObservers
            deleteChildObservers = _deleteChildObservers
            return Promise.resolve() // Promise does not return anything
          })
        }
        var observer = function (events) {
          for (var e in events) {
            var event = events[e]
            if (event.name === path[0]) {
              if (deleteChildObservers != null) {
                deleteChildObservers()
              }
              if (event.type === 'add' || event.type === 'update') {
                resetObserverPath()
              }
              // TODO: what about the delete events?
            }
          }
        }
        self.observe(observer)
        return resetObserverPath().then(
          // this promise contains a function that deletes all the child observers
          // and how to unobserve the observe from this object
          new Promise.resolve(function () { // eslint-disable-line
            if (deleteChildObservers != null) {
              deleteChildObservers()
            }
            self.unobserve(observer)
          })
        )
      }
    }
    * _changed (transaction, op) {
      if (op.struct === 'Delete') {
        var target = yield* transaction.getOperation(op.target)
        op.key = target.parentSub
      }
      this.eventHandler.receivedOp(op)
    }
  }
  Y.Map = new Y.utils.CustomType({
    class: YMap,
    createType: function * YMapCreator () {
      var modelid = this.store.getNextOpId()
      var model = {
        map: {},
        struct: 'Map',
        type: 'Map',
        id: modelid
      }
      yield* this.applyCreatedOperations([model])
      return modelid
    },
    initType: function * YMapInitializer (os, model) {
      var contents = {}
      var opContents = {}
      var map = model.map
      for (var name in map) {
        var op = yield* this.getOperation(map[name])
        if (op.opContent != null) {
          opContents[name] = op.opContent
        } else {
          contents[name] = op.content
        }
      }
      return new YMap(os, model, contents, opContents)
    }
  })
}

},{}],9:[function(require,module,exports){
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
module.exports = function (Y /* : any*/) {
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

},{}],10:[function(require,module,exports){
/* @flow */
'use strict'

require('./Connector.js')(Y)
require('./Database.js')(Y)
require('./Transaction.js')(Y)
require('./Struct.js')(Y)
require('./Utils.js')(Y)
require('./Connectors/Test.js')(Y)

var requiringModules = {}

module.exports = Y

Y.extend = function (name, value) {
  Y[name] = value
  if (requiringModules[name] != null) {
    requiringModules[name].resolve()
    delete requiringModules[name]
  }
}

Y.requestModules = requestModules
function requestModules (modules) {
  var promises = []
  for (var i = 0; i < modules.length; i++) {
    var modulename = 'y-' + modules[i].toLowerCase()
    if (Y[modules[i]] == null) {
      if (requiringModules[modules[i]] == null) {
        try {
          require(modulename)(Y)
        } catch (e) {
          // module does not exist
          if (typeof window !== 'undefined') {
            var imported = document.createElement('script')
            imported.src = Y.sourceDir + '/' + modulename + '/' + modulename + '.js'
            document.head.appendChild(imported)

            let requireModule = {}
            requiringModules[modules[i]] = requireModule
            requireModule.promise = new Promise(function (resolve) {
              requireModule.resolve = resolve
            })
            promises.push(requireModule.promise)
          } else {
            throw e
          }
        }
      } else {
        promises.push(requiringModules[modules[i]].promise)
      }
    }
  }
  return Promise.all(promises)
}

require('./Types/Map.js')(Y)

/* ::
type MemoryOptions = {
  name: 'memory'
}
type IndexedDBOptions = {
  name: 'indexeddb',
  namespace: string
}
type DbOptions = MemoryOptions | IndexedDBOptions

type WebRTCOptions = {
  name: 'webrtc',
  room: string
}
type WebsocketsClientOptions = {
  name: 'websockets-client',
  room: string
}
type ConnectionOptions = WebRTCOptions | WebsocketsClientOptions

type TypesOptions = Array<'array'|'map'|'text'>

type YOptions = {
  connector: ConnectionOptions,
  db: DbOptions,
  types: TypesOptions,
  sourceDir: string
}
*/

function Y (opts/* :YOptions */) /* :Promise<YConfig> */ {
  opts.types = opts.types != null ? opts.types : []
  var modules = [opts.db.name, opts.connector.name].concat(opts.types)
  Y.sourceDir = opts.sourceDir
  return Y.requestModules(modules).then(function () {
    return new Promise(function (resolve) {
      var yconfig = new YConfig(opts, function () {
        yconfig.db.whenUserIdSet(function () {
          resolve(yconfig)
        })
      })
    })
  })
}

class YConfig {
  /* ::
  db: Y.AbstractDatabase;
  connector: Y.AbstractConnector;
  */
  constructor (opts, callback) {
    this.db = new Y[opts.db.name](this, opts.db)
    this.connector = new Y[opts.connector.name](this, opts.connector)
    this.db.requestTransaction(function * requestTransaction () {
      // create initial Map type
      var model = {
        id: ['_', 0],
        struct: 'Map',
        type: 'Map',
        map: {}
      }
      yield* this.store.tryExecute.call(this, model)
      var root = yield* this.getType(model.id)
      this.store.y.root = root
      setTimeout(function () {
        callback()
      }, 0)
    })
  }
  isConnected () {
    return this.connector.isSynced
  }
  disconnect () {
    return this.connector.disconnect()
  }
  reconnect () {
    return this.connector.reconnect()
  }
  destroy () {
    this.disconnect()
    this.db.destroy()
    this.connector = null
    this.db = null
  }
}

if (typeof window !== 'undefined') {
  window.Y = Y
}

},{"./Connector.js":3,"./Connectors/Test.js":4,"./Database.js":5,"./Struct.js":6,"./Transaction.js":7,"./Types/Map.js":8,"./Utils.js":9}]},{},[2,10])

