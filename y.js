/* @flow */

"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = function Buffer() {
  _classCallCheck(this, Buffer);
};

function add(x) {
  return x + 4;
}

add("5");

/* @flow */
/* global Buffer */

var buffer = new Buffer(3);

/* @flow */
/*eslint-env node, jasmine */

describe("A suite", function () {
  it("contains spec with an expectation", function () {
    throw new Error("dtrn");
    expect(new Buffer()).toBe(true);
  });
});