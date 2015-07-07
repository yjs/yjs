/* @flow */
/*eslint-env browser,jasmine */

var numberOfTests = 100000;

describe("RedBlack Tree", function(){
  beforeEach(function(){
    this.tree = new RBTree();
  });
  it("can add&retrieve 5 elements", function(){
    this.tree.add({val: "four", id: 4});
    this.tree.add({val: "one", id: 1});
    this.tree.add({val: "three", id: 3});
    this.tree.add({val: "two", id: 2});
    this.tree.add({val: "five", id: 5});
    expect(this.tree.find(1).val).toEqual("one");
    expect(this.tree.find(2).val).toEqual("two");
    expect(this.tree.find(3).val).toEqual("three");
    expect(this.tree.find(4).val).toEqual("four");
    expect(this.tree.find(5).val).toEqual("five");
  });

  describe(`After adding ${numberOfTests} random objects`, function () {
    var elements = [];
    var tree = new RBTree();
    for(var i = 0; i < numberOfTests; i++) {
      var obj = Math.floor(Math.random() * numberOfTests * 10000);
      elements.push(obj);
      tree.add({id: obj});
    }
    it("root node is black", function(){
      expect(tree.root.isBlack()).toBeTruthy();
    });
    it("can find every object", function(){
      for(var id of elements) {
        expect(tree.find(id).id).toEqual(id);
      }
    });
    it("Red nodes do not have black children", function(){
      function traverse (n) {
        if (n == null) {
          return;
        }
        if (n.isRed()) {
          if (n.left != null) {
            expect(n.left.isRed()).not.toBeTruthy();
          }
          if (n.right != null) {
            expect(n.right.isRed()).not.toBeTruthy();
          }
        }
        traverse(n.left);
        traverse(n.right);
      }
      traverse(tree.root);
    });
    it("Black-height of sub-trees are equal", function(){
      function traverse (n) {
        if (n == null) {
          return 0;
        }
        var sub1 = traverse(n.left);
        var sub2 = traverse(n.right);
        expect(sub1).toEqual(sub2);
        if(n.isRed()) {
          return sub1;
        } else {
          return sub1 + 1;
        }
      }
      traverse(tree.root);
    });
  });
});
