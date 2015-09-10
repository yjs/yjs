'use strict';

function * aaa (){}

class X {
  stuff () {
    console.log("yay")
    var r = function * () {
      yield "dtrn"
    }
    var test = r()
    console.dir(r())
  }
}

(new X).stuff()

