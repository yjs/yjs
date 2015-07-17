/* @flow */
/*eslint-env browser,jasmine */

describe("TextBind Type", function(){
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
  beforeEach(function(done){
    createUsers(this, 5, done);
  });

  describe("debug tests", function(){
    it("#1", function(done){
      var y = this.users[0].root;
      var y2 = this.users[1].root;
      var y3 = this.users[2].root;
      var c1 = this.users[0].connector;
      var c2 = this.users[1].connector;
      var c3 = this.users[2].connector;
      function flushOneAndTwo(){
        c1.flush();
        c2.flush();
      }
      var u1, u2;
      y.set("text", Y.TextBind);
      flushOneAndTwo();
      y.get("text").then(function(array) {
        u1 = array;
        flushOneAndTwo();
        return y2.get("text");
      }).then(function(array){
        u2 = array;
        u1.insert(0, "a");
        flushOneAndTwo();
        u2.insert(1, "b");
        flushOneAndTwo();
        u1.insert(2, "c");
        flushOneAndTwo();
        u2.insert(3, "d");
        y3.observe(function(events){
          for (var event of events) {
            if (event.name === "text") {
              y3.get("text");
            }
          }
        });
        c3.flush();
        done();
      });
    });
  });
});
