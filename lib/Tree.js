/**
 * @module tree
 */

const rotate = (tree, parent, newParent, n) => {
  if (parent === null) {
    tree.root = newParent
    newParent._parent = null
  } else if (parent.left === n) {
    parent.left = newParent
  } else if (parent.right === n) {
    parent.right = newParent
  } else {
    throw new Error('The elements are wrongly connected!')
  }
}

class N {
  // A created node is always red!
  constructor (val) {
    this.val = val
    this.color = true
    this._left = null
    this._right = null
    this._parent = null
  }
  isRed () { return this.color }
  isBlack () { return !this.color }
  redden () { this.color = true; return this }
  blacken () { this.color = false; return this }
  get grandparent () {
    return this.parent.parent
  }
  get parent () {
    return this._parent
  }
  get sibling () {
    return (this === this.parent.left)
      ? this.parent.right : this.parent.left
  }
  get left () {
    return this._left
  }
  get right () {
    return this._right
  }
  set left (n) {
    if (n !== null) {
      n._parent = this
    }
    this._left = n
  }
  set right (n) {
    if (n !== null) {
      n._parent = this
    }
    this._right = n
  }
  rotateLeft (tree) {
    const parent = this.parent
    const newParent = this.right
    const newRight = this.right.left
    newParent.left = this
    this.right = newRight
    rotate(tree, parent, newParent, this)
  }
  next () {
    if (this.right !== null) {
      // search the most left node in the right tree
      var o = this.right
      while (o.left !== null) {
        o = o.left
      }
      return o
    } else {
      var p = this
      while (p.parent !== null && p !== p.parent.left) {
        p = p.parent
      }
      return p.parent
    }
  }
  prev () {
    if (this.left !== null) {
      // search the most right node in the left tree
      var o = this.left
      while (o.right !== null) {
        o = o.right
      }
      return o
    } else {
      var p = this
      while (p.parent !== null && p !== p.parent.right) {
        p = p.parent
      }
      return p.parent
    }
  }
  rotateRight (tree) {
    const parent = this.parent
    const newParent = this.left
    const newLeft = this.left.right
    newParent.right = this
    this.left = newLeft
    rotate(tree, parent, newParent, this)
  }
  getUncle () {
    // we can assume that grandparent exists when this is called!
    if (this.parent === this.parent.parent.left) {
      return this.parent.parent.right
    } else {
      return this.parent.parent.left
    }
  }
}

const isBlack = node =>
  node !== null ? node.isBlack() : true

const isRed = (node) =>
  node !== null ? node.isRed() : false

/*
 * This is a Red Black Tree implementation
 */
export class Tree {
  constructor () {
    this.root = null
    this.length = 0
  }
  findNext (id) {
    var nextID = id.clone()
    nextID.clock += 1
    return this.findWithLowerBound(nextID)
  }
  findPrev (id) {
    let prevID = id.clone()
    prevID.clock -= 1
    return this.findWithUpperBound(prevID)
  }
  findNodeWithLowerBound (from) {
    var o = this.root
    if (o === null) {
      return null
    } else {
      while (true) {
        if (from === null || (from.lessThan(o.val._id) && o.left !== null)) {
          // o is included in the bound
          // try to find an element that is closer to the bound
          o = o.left
        } else if (from !== null && o.val._id.lessThan(from)) {
          // o is not within the bound, maybe one of the right elements is..
          if (o.right !== null) {
            o = o.right
          } else {
            // there is no right element. Search for the next bigger element,
            // this should be within the bounds
            return o.next()
          }
        } else {
          return o
        }
      }
    }
  }
  findNodeWithUpperBound (to) {
    if (to === void 0) {
      throw new Error('You must define from!')
    }
    var o = this.root
    if (o === null) {
      return null
    } else {
      while (true) {
        if ((to === null || o.val._id.lessThan(to)) && o.right !== null) {
          // o is included in the bound
          // try to find an element that is closer to the bound
          o = o.right
        } else if (to !== null && to.lessThan(o.val._id)) {
          // o is not within the bound, maybe one of the left elements is..
          if (o.left !== null) {
            o = o.left
          } else {
            // there is no left element. Search for the prev smaller element,
            // this should be within the bounds
            return o.prev()
          }
        } else {
          return o
        }
      }
    }
  }
  findSmallestNode () {
    var o = this.root
    while (o != null && o.left != null) {
      o = o.left
    }
    return o
  }
  findWithLowerBound (from) {
    var n = this.findNodeWithLowerBound(from)
    return n == null ? null : n.val
  }
  findWithUpperBound (to) {
    var n = this.findNodeWithUpperBound(to)
    return n == null ? null : n.val
  }
  iterate (from, to, f) {
    var o
    if (from === null) {
      o = this.findSmallestNode()
    } else {
      o = this.findNodeWithLowerBound(from)
    }
    while (
      o !== null &&
      (
        to === null || // eslint-disable-line no-unmodified-loop-condition
        o.val._id.lessThan(to) ||
        o.val._id.equals(to)
      )
    ) {
      f(o.val)
      o = o.next()
    }
  }
  find (id) {
    let n = this.findNode(id)
    if (n !== null) {
      return n.val
    } else {
      return null
    }
  }
  findNode (id) {
    var o = this.root
    if (o === null) {
      return null
    } else {
      while (true) {
        if (o === null) {
          return null
        }
        if (id.lessThan(o.val._id)) {
          o = o.left
        } else if (o.val._id.lessThan(id)) {
          o = o.right
        } else {
          return o
        }
      }
    }
  }
  delete (id) {
    var d = this.findNode(id)
    if (d == null) {
      // throw new Error('Element does not exist!')
      return
    }
    this.length--
    if (d.left !== null && d.right !== null) {
      // switch d with the greates element in the left subtree.
      // o should have at most one child.
      var o = d.left
      // find
      while (o.right !== null) {
        o = o.right
      }
      // switch
      d.val = o.val
      d = o
    }
    // d has at most one child
    // let n be the node that replaces d
    var isFakeChild
    var child = d.left || d.right
    if (child === null) {
      isFakeChild = true
      child = new N(null)
      child.blacken()
      d.right = child
    } else {
      isFakeChild = false
    }

    if (d.parent === null) {
      if (!isFakeChild) {
        this.root = child
        child.blacken()
        child._parent = null
      } else {
        this.root = null
      }
      return
    } else if (d.parent.left === d) {
      d.parent.left = child
    } else if (d.parent.right === d) {
      d.parent.right = child
    } else {
      throw new Error('Impossible!')
    }
    if (d.isBlack()) {
      if (child.isRed()) {
        child.blacken()
      } else {
        this._fixDelete(child)
      }
    }
    this.root.blacken()
    if (isFakeChild) {
      if (child.parent.left === child) {
        child.parent.left = null
      } else if (child.parent.right === child) {
        child.parent.right = null
      } else {
        throw new Error('Impossible #3')
      }
    }
  }
  _fixDelete (n) {
    if (n.parent === null) {
      // this can only be called after the first iteration of fixDelete.
      return
    }
    // d was already replaced by the child
    // d is not the root
    // d and child are black
    var sibling = n.sibling
    if (isRed(sibling)) {
      // make sibling the grandfather
      n.parent.redden()
      sibling.blacken()
      if (n === n.parent.left) {
        n.parent.rotateLeft(this)
      } else if (n === n.parent.right) {
        n.parent.rotateRight(this)
      } else {
        throw new Error('Impossible #2')
      }
      sibling = n.sibling
    }
    // parent, sibling, and children of n are black
    if (n.parent.isBlack() &&
      sibling.isBlack() &&
      isBlack(sibling.left) &&
      isBlack(sibling.right)
    ) {
      sibling.redden()
      this._fixDelete(n.parent)
    } else if (n.parent.isRed() &&
      sibling.isBlack() &&
      isBlack(sibling.left) &&
      isBlack(sibling.right)
    ) {
      sibling.redden()
      n.parent.blacken()
    } else {
      if (n === n.parent.left &&
        sibling.isBlack() &&
        isRed(sibling.left) &&
        isBlack(sibling.right)
      ) {
        sibling.redden()
        sibling.left.blacken()
        sibling.rotateRight(this)
        sibling = n.sibling
      } else if (n === n.parent.right &&
        sibling.isBlack() &&
        isRed(sibling.right) &&
        isBlack(sibling.left)
      ) {
        sibling.redden()
        sibling.right.blacken()
        sibling.rotateLeft(this)
        sibling = n.sibling
      }
      sibling.color = n.parent.color
      n.parent.blacken()
      if (n === n.parent.left) {
        sibling.right.blacken()
        n.parent.rotateLeft(this)
      } else {
        sibling.left.blacken()
        n.parent.rotateRight(this)
      }
    }
  }
  put (v) {
    var node = new N(v)
    if (this.root !== null) {
      var p = this.root // p abbrev. parent
      while (true) {
        if (node.val._id.lessThan(p.val._id)) {
          if (p.left === null) {
            p.left = node
            break
          } else {
            p = p.left
          }
        } else if (p.val._id.lessThan(node.val._id)) {
          if (p.right === null) {
            p.right = node
            break
          } else {
            p = p.right
          }
        } else {
          p.val = node.val
          return p
        }
      }
      this._fixInsert(node)
    } else {
      this.root = node
    }
    this.length++
    this.root.blacken()
    return node
  }
  _fixInsert (n) {
    if (n.parent === null) {
      n.blacken()
      return
    } else if (n.parent.isBlack()) {
      return
    }
    var uncle = n.getUncle()
    if (uncle !== null && uncle.isRed()) {
      // Note: parent: red, uncle: red
      n.parent.blacken()
      uncle.blacken()
      n.grandparent.redden()
      this._fixInsert(n.grandparent)
    } else {
      // Note: parent: red, uncle: black or null
      // Now we transform the tree in such a way that
      // either of these holds:
      //   1) grandparent.left.isRed
      //     and grandparent.left.left.isRed
      //   2) grandparent.right.isRed
      //     and grandparent.right.right.isRed
      if (n === n.parent.right && n.parent === n.grandparent.left) {
        n.parent.rotateLeft(this)
        // Since we rotated and want to use the previous
        // cases, we need to set n in such a way that
        // n.parent.isRed again
        n = n.left
      } else if (n === n.parent.left && n.parent === n.grandparent.right) {
        n.parent.rotateRight(this)
        // see above
        n = n.right
      }
      // Case 1) or 2) hold from here on.
      // Now traverse grandparent, make parent a black node
      // on the highest level which holds two red nodes.
      n.parent.blacken()
      n.grandparent.redden()
      if (n === n.parent.left) {
        // Case 1
        n.grandparent.rotateRight(this)
      } else {
        // Case 2
        n.grandparent.rotateLeft(this)
      }
    }
  }
}
