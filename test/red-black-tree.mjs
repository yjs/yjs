import RedBlackTree from '../src/Util/Tree.mjs'
import ID from '../src/Util/ID/ID.mjs'
import Chance from 'chance'
import { test, proxyConsole } from 'cutest'

proxyConsole()

var numberOfRBTreeTests = 10000

function checkRedNodesDoNotHaveBlackChildren (t, tree) {
  let correct = true
  function traverse (n) {
    if (n == null) {
      return
    }
    if (n.isRed()) {
      if (n.left != null) {
        correct = correct && !n.left.isRed()
      }
      if (n.right != null) {
        correct = correct && !n.right.isRed()
      }
    }
    traverse(n.left)
    traverse(n.right)
  }
  traverse(tree.root)
  t.assert(correct, 'Red nodes do not have black children')
}

function checkBlackHeightOfSubTreesAreEqual (t, tree) {
  let correct = true
  function traverse (n) {
    if (n == null) {
      return 0
    }
    var sub1 = traverse(n.left)
    var sub2 = traverse(n.right)
    if (sub1 !== sub2) {
      correct = false
    }
    if (n.isRed()) {
      return sub1
    } else {
      return sub1 + 1
    }
  }
  traverse(tree.root)
  t.assert(correct, 'Black-height of sub-trees are equal')
}

function checkRootNodeIsBlack (t, tree) {
  t.assert(tree.root == null || tree.root.isBlack(), 'root node is black')
}

test('RedBlack Tree', async function redBlackTree (t) {
  let tree = new RedBlackTree()
  tree.put({_id: new ID(8433, 0)})
  tree.put({_id: new ID(12844, 0)})
  tree.put({_id: new ID(1795, 0)})
  tree.put({_id: new ID(30302, 0)})
  tree.put({_id: new ID(64287)})
  tree.delete(new ID(8433, 0))
  tree.put({_id: new ID(28996)})
  tree.delete(new ID(64287))
  tree.put({_id: new ID(22721)})
  checkRootNodeIsBlack(t, tree)
  checkBlackHeightOfSubTreesAreEqual(t, tree)
  checkRedNodesDoNotHaveBlackChildren(t, tree)
})

test(`random tests (${numberOfRBTreeTests})`, async function random (t) {
  let chance = new Chance(t.getSeed() * 1000000000)
  let tree = new RedBlackTree()
  let elements = []
  for (var i = 0; i < numberOfRBTreeTests; i++) {
    if (chance.bool({likelihood: 80})) {
      // 80% chance to insert an element
      let obj = new ID(chance.integer({min: 0, max: numberOfRBTreeTests}), chance.integer({min: 0, max: 1}))
      let nodeExists = tree.find(obj)
      if (nodeExists === null) {
        if (elements.some(e => e.equals(obj))) {
          t.assert(false, 'tree and elements contain different results')
        }
        elements.push(obj)
        tree.put({_id: obj})
      }
    } else if (elements.length > 0) {
      // ~20% chance to delete an element
      var elem = chance.pickone(elements)
      elements = elements.filter(function (e) {
        return !e.equals(elem)
      })
      tree.delete(elem)
    }
  }
  checkRootNodeIsBlack(t, tree)
  checkBlackHeightOfSubTreesAreEqual(t, tree)
  checkRedNodesDoNotHaveBlackChildren(t, tree)
  // TEST if all nodes exist
  let allNodesExist = true
  for (let id of elements) {
    let node = tree.find(id)
    if (!node._id.equals(id)) {
      allNodesExist = false
    }
  }
  t.assert(allNodesExist, 'All inserted nodes exist')
  // TEST lower bound search
  let findAllNodesWithLowerBoundSerach = true
  for (let id of elements) {
    let node = tree.findWithLowerBound(id)
    if (!node._id.equals(id)) {
      findAllNodesWithLowerBoundSerach = false
    }
  }
  t.assert(
    findAllNodesWithLowerBoundSerach,
    'Find every object with lower bound search'
  )
  // TEST iteration (with lower bound search)
  let lowerBound = chance.pickone(elements)
  let expectedResults = elements.filter((e, pos) =>
    (lowerBound.lessThan(e) || e.equals(lowerBound)) &&
    elements.indexOf(e) === pos
  ).length
  let actualResults = 0
  tree.iterate(lowerBound, null, function (val) {
    if (val == null) {
      t.assert(false, 'val is undefined!')
    }
    actualResults++
  })
  t.assert(
    expectedResults === actualResults,
    'Iterating over a tree with lower bound yields the right amount of results'
  )

  expectedResults = elements.filter((e, pos) =>
    elements.indexOf(e) === pos
  ).length
  actualResults = 0
  tree.iterate(null, null, function (val) {
    if (val == null) {
      t.assert(false, 'val is undefined!')
    }
    actualResults++
  })
  t.assert(
    expectedResults === actualResults,
    'iterating over a tree without bounds yields the right amount of results'
  )

  let upperBound = chance.pickone(elements)
  expectedResults = elements.filter((e, pos) =>
    (e.lessThan(upperBound) || e.equals(upperBound)) &&
    elements.indexOf(e) === pos
  ).length
  actualResults = 0
  tree.iterate(null, upperBound, function (val) {
    if (val == null) {
      t.assert(false, 'val is undefined!')
    }
    actualResults++
  })
  t.assert(
    expectedResults === actualResults,
    'iterating over a tree with upper bound yields the right amount of results'
  )

  upperBound = chance.pickone(elements)
  lowerBound = chance.pickone(elements)
  if (upperBound.lessThan(lowerBound)) {
    [lowerBound, upperBound] = [upperBound, lowerBound]
  }
  expectedResults = elements.filter((e, pos) =>
    (lowerBound.lessThan(e) || e.equals(lowerBound)) &&
    (e.lessThan(upperBound) || e.equals(upperBound)) &&
    elements.indexOf(e) === pos
  ).length
  actualResults = 0
  tree.iterate(lowerBound, upperBound, function (val) {
    if (val == null) {
      t.assert(false, 'val is undefined!')
    }
    actualResults++
  })
  t.assert(
    expectedResults === actualResults,
    'iterating over a tree with upper bound yields the right amount of results'
  )
})
