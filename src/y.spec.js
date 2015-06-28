/* @flow */
/*eslint-env browser,jasmine */

describe("Yjs (basic)", function(){
  beforeEach(function(){
    this.users = [];
    for (var i = 0; i < 5; i++) {
      this.users.push(new Y({
        db: {
          name: "Memory"
        },
        connector: {
          name: "Test"
        }
      }));
    }
  });
  afterEach(function(){
    for (var y of this.users) {
      y.destroy();
    }
    this.users = [];
  });
  it("can List.insert and get value from the other user", function(done){
    this.users[0].val("name", 1);
    this.users[0].connector.whenSynced(function(){
      done();
    });
  });
});
