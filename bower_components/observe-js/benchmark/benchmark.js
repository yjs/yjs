/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {
  'use strict';

  function now() {
    return global.performance && typeof performance.now == 'function' ?
        performance.now() : Date.now();
  }

  function checkpoint() {
    if (global.Platform &&
        typeof Platform.performMicrotaskCheckpoint == 'function') {
      Platform.performMicrotaskCheckpoint();
    }
  }

  // TODO(rafaelw): Add simple Promise polyfill for IE.

  var TESTING_TICKS = 400;
  var TICKS_PER_FRAME = 16;
  var MAX_RUNS = 50;

  function Benchmark(testingTicks, ticksPerFrame, maxRuns) {
    this.testingTicks = testingTicks || TESTING_TICKS;
    this.ticksPerFrame = ticksPerFrame || TICKS_PER_FRAME;
    this.maxRuns = maxRuns || 50;
    this.average = 0;
  }

  Benchmark.prototype = {
    // Abstract API
    setup: function(variation) {},
    test: function() {
      throw Error('Not test function found');
    },
    cleanup: function() {},

    runOne: function(variation) {
      this.setup(variation);

      var before = now();
      this.test(variation);

      var self = this;

      return Promise.resolve().then(function() {
        checkpoint();

        var after = now();

        self.cleanup(variation);
        return after - before;
      });
    },

    runMany: function(count, variation) {
      var self = this;

      return new Promise(function(fulfill) {
        var total = 0;

        function next(time) {
          if (!count) {
            fulfill(total);
            return;
          }

          self.runOne(variation).then(function(time) {
            count--;
            total += time;
            next();
          });
        }

        requestAnimationFrame(next);
      });
    },

    runVariation: function(variation, reportFn) {
      var self = this;
      reportFn = reportFn || function() {}

      return new Promise(function(fulfill) {
        self.runMany(3, variation).then(function(time) {
          return time/3;
        }).then(function(estimate) {
          var runsPerFrame = Math.ceil(self.ticksPerFrame / estimate);
          var frames = Math.ceil(self.testingTicks / self.ticksPerFrame);
          var maxFrames = Math.ceil(self.maxRuns / runsPerFrame);

          frames = Math.min(frames, maxFrames);
          var count = 0;
          var total = 0;

          function next() {
            if (!frames) {
              self.average = total / count;
              self.dispose();
              fulfill(self.average);
              return;
            }

            self.runMany(runsPerFrame, variation).then(function(time) {
              frames--;
              total += time;
              count += runsPerFrame;
              reportFn(variation, count);
              next();
            });
          }

          next();
        });
      });
    },

    run: function(variations, reportFn) {
      if (!Array.isArray(variations)) {
        return this.runVariation(variations, reportFn);
      }

      var self = this;
      variations = variations.slice();
      return new Promise(function(fulfill) {
        var results = [];

        function next() {
          if (!variations.length) {
            fulfill(results);
            return;
          }

          var variation = variations.shift();
          self.runVariation(variation, reportFn).then(function(time) {
            results.push(time);
            next();
          });
        }

        next();
      });
    }
  };

  function all(benchmarks, variations, statusFn) {
    return new Promise(function(fulfill) {
      var results = [];
      var current;

      function next() {
        current = benchmarks.shift();

        if (!current) {
          fulfill(results);
          return;
        }

        function update(variation, runs) {
          statusFn(current, variation, runs);
        }

        current.run(variations, update).then(function(time) {
          results.push(time);
          next();
        });
      }

      next();
    });
  }

  global.Benchmark = Benchmark;
  global.Benchmark.all = all;

})(this);
