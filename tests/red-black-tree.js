import { Tree as RedBlackTree } from '../lib/Tree.js'
import * as ID from '../utils/ID.js'
import { test, proxyConsole } from 'cutest'
import * as random from '../lib/prng/prng.js'

proxyConsole()

var numberOfRBTreeTests = 10000

const checkRedNodesDoNotHaveBlackChildren = (t, tree) => {
  let correct = true
  const traverse = n => {
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

const checkBlackHeightOfSubTreesAreEqual = (t, tree) => {
  let correct = true
  const traverse = n => {
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

const checkRootNodeIsBlack = (t, tree) => {
  t.assert(tree.root == null || tree.root.isBlack(), 'root node is black')
}

test('RedBlack Tree', async function redBlackTree (t) {
  let tree = new RedBlackTree()
  tree.put({_id: ID.createID(8433, 0)})
  tree.put({_id: ID.createID(12844, 0)})
  tree.put({_id: ID.createID(1795, 0)})
  tree.put({_id: ID.createID(30302, 0)})
  tree.put({_id: ID.createID(64287)})
  tree.delete(ID.createID(8433, 0))
  tree.put({_id: ID.createID(28996)})
  tree.delete(ID.createID(64287))
  tree.put({_id: ID.createID(22721)})
  checkRootNodeIsBlack(t, tree)
  checkBlackHeightOfSubTreesAreEqual(t, tree)
  checkRedNodesDoNotHaveBlackChildren(t, tree)
})

test(`random tests (${numberOfRBTreeTests})`, async function randomRBTree (t) {
  let prng = random.createPRNG(t.getSeed() * 1000000000)
  let tree = new RedBlackTree()
  let elements = []
  for (var i = 0; i < numberOfRBTreeTests; i++) {
    if (random.int32(prng, 0, 100) < 80) {
      // 80% chance to insert an element
      let obj = ID.createID(random.int32(prng, 0, numberOfRBTreeTests), random.int32(prng, 0, 1))
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
      var elem = random.oneOf(prng, elements)
      elements = elements.filter(e => {
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
  let lowerBound = random.oneOf(prng, elements)
  let expectedResults = elements.filter((e, pos) =>
    (lowerBound.lessThan(e) || e.equals(lowerBound)) &&
    elements.indexOf(e) === pos
  ).length
  let actualResults = 0
  tree.iterate(lowerBound, null, val => {
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
  tree.iterate(null, null, val => {
    if (val == null) {
      t.assert(false, 'val is undefined!')
    }
    actualResults++
  })
  t.assert(
    expectedResults === actualResults,
    'iterating over a tree without bounds yields the right amount of results'
  )

  let upperBound = random.oneOf(prng, elements)
  expectedResults = elements.filter((e, pos) =>
    (e.lessThan(upperBound) || e.equals(upperBound)) &&
    elements.indexOf(e) === pos
  ).length
  actualResults = 0
  tree.iterate(null, upperBound, val => {
    if (val == null) {
      t.assert(false, 'val is undefined!')
    }
    actualResults++
  })
  t.assert(
    expectedResults === actualResults,
    'iterating over a tree with upper bound yields the right amount of results'
  )

  upperBound = random.oneOf(prng, elements)
  lowerBound = random.oneOf(prng, elements)
  if (upperBound.lessThan(lowerBound)) {
    [lowerBound, upperBound] = [upperBound, lowerBound]
  }
  expectedResults = elements.filter((e, pos) =>
    (lowerBound.lessThan(e) || e.equals(lowerBound)) &&
    (e.lessThan(upperBound) || e.equals(upperBound)) &&
    elements.indexOf(e) === pos
  ).length
  actualResults = 0
  tree.iterate(lowerBound, upperBound, val => {
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
