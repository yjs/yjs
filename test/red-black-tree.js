import Y from '../src/y.js'
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
  let memory = new Y.memory(null, { // eslint-disable-line
    name: 'Memory',
    gcTimeout: -1
  })
  let tree = memory.os
  memory.requestTransaction(function () {
    tree.put({id: [8433]})
    tree.put({id: [12844]})
    tree.put({id: [1795]})
    tree.put({id: [30302]})
    tree.put({id: [64287]})
    tree.delete([8433])
    tree.put({id: [28996]})
    tree.delete([64287])
    tree.put({id: [22721]})
  })
  await memory.whenTransactionsFinished()
  checkRootNodeIsBlack(t, tree)
  checkBlackHeightOfSubTreesAreEqual(t, tree)
  checkRedNodesDoNotHaveBlackChildren(t, tree)
})

test(`random tests (${numberOfRBTreeTests})`, async function random (t) {
  let chance = new Chance(t.getSeed() * 1000000000)
  let memory = new Y.memory(null, { // eslint-disable-line
    name: 'Memory',
    gcTimeout: -1
  })
  let tree = memory.os
  let elements = []
  memory.requestTransaction(function () {
    for (var i = 0; i < numberOfRBTreeTests; i++) {
      if (chance.bool({likelihood: 80})) {
        // 80% chance to insert an element
        let obj = [chance.integer({min: 0, max: numberOfRBTreeTests})]
        let nodeExists = tree.find(obj)
        if (!nodeExists) {
          if (elements.some(e => e[0] === obj[0])) {
            t.assert(false, 'tree and elements contain different results')
          }
          elements.push(obj)
          tree.put({id: obj})
        }
      } else if (elements.length > 0) {
        // ~20% chance to delete an element
        var elem = chance.pickone(elements)
        elements = elements.filter(function (e) {
          return !Y.utils.compareIds(e, elem)
        })
        tree.delete(elem)
      }
    }
  })
  await memory.whenTransactionsFinished()
  checkRootNodeIsBlack(t, tree)
  checkBlackHeightOfSubTreesAreEqual(t, tree)
  checkRedNodesDoNotHaveBlackChildren(t, tree)
  memory.requestTransaction(function () {
    let allNodesExist = true
    for (let id of elements) {
      let node = tree.find(id)
      if (!Y.utils.compareIds(node.id, id)) {
        allNodesExist = false
      }
    }
    t.assert(allNodesExist, 'All inserted nodes exist')
  })
  memory.requestTransaction(function () {
    let findAllNodesWithLowerBoundSerach = true
    for (let id of elements) {
      let node = tree.findWithLowerBound(id)
      if (!Y.utils.compareIds(node.id, id)) {
        findAllNodesWithLowerBoundSerach = false
      }
    }
    t.assert(
      findAllNodesWithLowerBoundSerach,
      'Find every object with lower bound search'
    )
  })

  memory.requestTransaction(function () {
    let lowerBound = chance.pickone(elements)
    let expectedResults = elements.filter((e, pos) =>
      (Y.utils.smaller(lowerBound, e) || Y.utils.compareIds(e, lowerBound)) &&
      elements.indexOf(e) === pos
    ).length
    let actualResults = 0
    tree.iterate(this, lowerBound, null, function (val) {
      if (val == null) {
        t.assert(false, 'val is undefined!')
      }
      actualResults++
    })
    t.assert(
      expectedResults === actualResults,
      'Iterating over a tree with lower bound yields the right amount of results'
    )
  })

  memory.requestTransaction(function () {
    let expectedResults = elements.filter((e, pos) =>
      elements.indexOf(e) === pos
    ).length
    let actualResults = 0
    tree.iterate(this, null, null, function (val) {
      if (val == null) {
        t.assert(false, 'val is undefined!')
      }
      actualResults++
    })
    t.assert(
      expectedResults === actualResults,
      'iterating over a tree without bounds yields the right amount of results'
    )
  })

  memory.requestTransaction(function () {
    let upperBound = chance.pickone(elements)
    let expectedResults = elements.filter((e, pos) =>
      (Y.utils.smaller(e, upperBound) || Y.utils.compareIds(e, upperBound)) &&
      elements.indexOf(e) === pos
    ).length
    let actualResults = 0
    tree.iterate(this, null, upperBound, function (val) {
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

  memory.requestTransaction(function () {
    let upperBound = chance.pickone(elements)
    let lowerBound = chance.pickone(elements)
    if (Y.utils.smaller(upperBound, lowerBound)) {
      [lowerBound, upperBound] = [upperBound, lowerBound]
    }
    let expectedResults = elements.filter((e, pos) =>
      (Y.utils.smaller(lowerBound, e) || Y.utils.compareIds(e, lowerBound)) &&
      (Y.utils.smaller(e, upperBound) || Y.utils.compareIds(e, upperBound)) &&
      elements.indexOf(e) === pos
    ).length
    let actualResults = 0
    tree.iterate(this, lowerBound, upperBound, function (val) {
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

  await memory.whenTransactionsFinished()
})
