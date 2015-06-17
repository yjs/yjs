/* @flow */
/*eslint-env browser,jasmine,console */

var number = 0;
function llater(time){
  return new Promise(function(yay){
    setTimeout(function(){
      yay(number++);
    }, time); //eslint-disable-line no-undef
  });
}

describe("IndexedDB", function() {

  it("can create transactions", function(done) {
    requestTransaction(function*(numbers){
      expect(numbers).toEqual([1, 2, 3]);
      expect(yield llater(10)).toEqual(0);
      expect(yield llater(50)).toEqual(1);
      done();
      return 10;
    });
  });
});
