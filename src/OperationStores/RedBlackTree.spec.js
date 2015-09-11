/* global Y */
/* eslint-env browser,jasmine,console */

var numberOfRBTreeTests = 1000

function itRedNodesDoNotHaveBlackChildren (tree) {
  it('Red nodes do not have black children', function () {
    function traverse (n) {
      if (n == null) {
        return
      }
      if (n.isRed()) {
        if (n.left != null) {
          expect(n.left.isRed()).not.toBeTruthy()
        }
        if (n.right != null) {
          expect(n.right.isRed()).not.toBeTruthy()
        }
      }
      traverse(n.left)
      traverse(n.right)
    }
    traverse(tree.root)
  })
}

function itBlackHeightOfSubTreesAreEqual (tree) {
  it('Black-height of sub-trees are equal', function () {
    function traverse (n) {
      if (n == null) {
        return 0
      }
      var sub1 = traverse(n.left)
      var sub2 = traverse(n.right)
      expect(sub1).toEqual(sub2)
      if (n.isRed()) {
        return sub1
      } else {
        return sub1 + 1
      }
    }
    traverse(tree.root)
  })
}

function itRootNodeIsBlack (tree) {
  it('root node is black', function () {
    expect(tree.root == null || tree.root.isBlack()).toBeTruthy()
  })
}

describe('RedBlack Tree', function () {
  beforeEach(function () {
    this.tree = new Y.utils.RBTree()
  })
  it('can add&retrieve 5 elements', function () {
    this.tree.add({val: 'four', id: [4]})
    this.tree.add({val: 'one', id: [1]})
    this.tree.add({val: 'three', id: [3]})
    this.tree.add({val: 'two', id: [2]})
    this.tree.add({val: 'five', id: [5]})
    expect(this.tree.find([1]).val).toEqual('one')
    expect(this.tree.find([2]).val).toEqual('two')
    expect(this.tree.find([3]).val).toEqual('three')
    expect(this.tree.find([4]).val).toEqual('four')
    expect(this.tree.find([5]).val).toEqual('five')
  })

  it('5 elements do not exist anymore after deleting them', function () {
    this.tree.add({val: 'four', id: [4]})
    this.tree.add({val: 'one', id: [1]})
    this.tree.add({val: 'three', id: [3]})
    this.tree.add({val: 'two', id: [2]})
    this.tree.add({val: 'five', id: [5]})
    this.tree.delete([4])
    expect(this.tree.find([4])).not.toBeTruthy()
    this.tree.delete([3])
    expect(this.tree.find([3])).not.toBeTruthy()
    this.tree.delete([2])
    expect(this.tree.find([2])).not.toBeTruthy()
    this.tree.delete([1])
    expect(this.tree.find([1])).not.toBeTruthy()
    this.tree.delete([5])
    expect(this.tree.find([5])).not.toBeTruthy()
  })

  it('debug #1', function () {
    this.tree.add({id: [2]})
    this.tree.add({id: [0]})
    this.tree.delete([2])
    this.tree.add({id: [1]})
    expect(this.tree.find([0])).not.toBeUndefined()
    expect(this.tree.find([1])).not.toBeUndefined()
    expect(this.tree.find([2])).toBeUndefined()
  })
  describe('debug #2', function () {
    var tree = new Y.utils.RBTree()
    tree.add({id: [8433]})
    tree.add({id: [12844]})
    tree.add({id: [1795]})
    tree.add({id: [30302]})
    tree.add({id: [64287]})
    tree.delete([8433])
    tree.add({id: [28996]})
    tree.delete([64287])
    tree.add({id: [22721]})

    itRootNodeIsBlack(tree, [])
    itBlackHeightOfSubTreesAreEqual(tree, [])
  })

  describe(`After adding&deleting (0.8/0.2) ${numberOfRBTreeTests} times`, function () {
    var elements = []
    var tree = new Y.utils.RBTree()
    for (var i = 0; i < numberOfRBTreeTests; i++) {
      var r = Math.random()
      if (r < 0.8) {
        var obj = [Math.floor(Math.random() * numberOfRBTreeTests * 10000)]
        if (!tree.findNode(obj)) {
          elements.push(obj)
          tree.add({id: obj})
        }
      } else if (elements.length > 0) {
        var elemid = Math.floor(Math.random() * elements.length)
        var elem = elements[elemid]
        elements = elements.filter(function (e) {return !Y.utils.compareIds(e, elem); }); // eslint-disable-line
        tree.delete(elem)
      }
    }
    itRootNodeIsBlack(tree)

    it('can find every object', function () {
      for (var id of elements) {
        expect(tree.find(id).id).toEqual(id)
      }
    })

    it('can find every object with lower bound search', function () {
      for (var id of elements) {
        expect(tree.findNodeWithLowerBound(id).val.id).toEqual(id)
      }
    })
    itRedNodesDoNotHaveBlackChildren(tree)

    itBlackHeightOfSubTreesAreEqual(tree)

    it('iterating over a tree with lower bound yields the right amount of results', function () {
      var lowerBound = elements[Math.floor(Math.random() * elements.length)]
      var expectedResults = elements.filter(function (e, pos) {
        return (Y.utils.smaller(lowerBound, e) || Y.utils.compareIds(e, lowerBound)) && elements.indexOf(e) === pos
      }).length

      var actualResults = 0
      tree.iterate(lowerBound, null, function (val) {
        expect(val).not.toBeUndefined()
        actualResults++
      })
      expect(expectedResults).toEqual(actualResults)
    })

    it('iterating over a tree without bounds yield the right amount of results', function () {
      var lowerBound = null
      var expectedResults = elements.filter(function (e, pos) {
        return elements.indexOf(e) === pos
      }).length
      var actualResults = 0
      tree.iterate(lowerBound, null, function (val) {
        expect(val).not.toBeUndefined()
        actualResults++
      })
      expect(expectedResults).toEqual(actualResults)
    })

    it('iterating over a tree with upper bound yields the right amount of results', function () {
      var upperBound = elements[Math.floor(Math.random() * elements.length)]
      var expectedResults = elements.filter(function (e, pos) {
        return (Y.utils.smaller(e, upperBound) || Y.utils.compareIds(e, upperBound)) && elements.indexOf(e) === pos
      }).length

      var actualResults = 0
      tree.iterate(null, upperBound, function (val) {
        expect(val).not.toBeUndefined()
        actualResults++
      })
      expect(expectedResults).toEqual(actualResults)
    })

    it('iterating over a tree with upper and lower bounds yield the right amount of results', function () {
      var b1 = elements[Math.floor(Math.random() * elements.length)]
      var b2 = elements[Math.floor(Math.random() * elements.length)]
      var upperBound, lowerBound
      if (Y.utils.smaller(b1, b2)) {
        lowerBound = b1
        upperBound = b2
      } else {
        lowerBound = b2
        upperBound = b1
      }
      var expectedResults = elements.filter(function (e, pos) {
        return (Y.utils.smaller(lowerBound, e) || Y.utils.compareIds(e, lowerBound)) &&
          (Y.utils.smaller(e, upperBound) || Y.utils.compareIds(e, upperBound)) && elements.indexOf(e) === pos
      }).length
      var actualResults = 0
      tree.iterate(lowerBound, upperBound, function (val) {
        expect(val).not.toBeUndefined()
        actualResults++
      })
      expect(expectedResults).toEqual(actualResults)
    })
  })
})
