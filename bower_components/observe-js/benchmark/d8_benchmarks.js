/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

var console = {
  log: print
};

var requestAnimationFrame = function(callback) {
  callback();
}

recordCount = 0;

var alert = print;

function reportResults(times) {
  console.log(JSON.stringify(times));
}

function reportStatus(b, variation, count) {
  console.log(b.objectCount + ' objects, ' + count + ' runs.');
}

var objectCounts = [ 4000, 8000, 16000 ];

var benchmarks = [];

objectCounts.forEach(function(objectCount, i) {
  benchmarks.push(
    new SetupPathBenchmark('', objectCount));
});

Benchmark.all(benchmarks, 0, reportStatus).then(reportResults);

