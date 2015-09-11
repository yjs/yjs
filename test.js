'use strict';

function * aaa (){}

class Y {
  constructor () {
    this.y = 4
  }
}

class X extends Y {
  constructor (a) {
    this.x = 'true'
  }
  stuff () {
    console.log("yay")
    var r = function * () {
      yield "dtrn"
    }
    var test = r()
    console.dir(r())
  }
}
var Q = {}
Q["X"] = X

var P = Q['X']
var x = new P( 44 )

(new Promise(function(resolve){
  resolve(true)
})).then(function(arg){
  console.log("yay", arg)
})
