


class N {
  // A created node is always red!
  constructor (val) {
    this.val = val;
    this.color = true;
    this._left = null;
    this._right = null;
    this._parent = null;
    if (val.id == null) {
      throw new Error("You must define id!");
    }
  }
  isRed () { return this.color; }
  isBlack () { return !this.color; }
  redden () { this.color = true; return this; }
  blacken () { this.color = false; return this; }
  get grandparent () {
    return this.parent.parent;
  }
  get parent () {
    return this._parent;
  }
  get left () {
    return this._left;
  }
  get right () {
    return this._right;
  }
  set left (n) {
    if (n != null) {
      n._parent = this;
    }
    this._left = n;
  }
  set right (n) {
    if (n != null) {
      n._parent = this;
    }
    this._right = n;
  }
  rotateLeft (tree) {
    var parent = this.parent;
    var newParent = this.right;
    var newRight = this.right.left;
    newParent.left = this;
    this.right = newRight;
    if (parent == null) {
      tree.root = newParent;
    } else if (parent.left === this) {
      parent.left = newParent;
    } else if (parent.right === this) {
      parent.right = newParent;
    } else {
      throw new Error("The elements are wrongly connected!");
    }
  }
  rotateRight (tree) {
    var parent = this.parent;
    var newParent = this.left;
    var newLeft = this.left.right;
    newParent.right = this;
    this.left = newLeft;
    if (parent == null) {
      tree.root = newParent;
    } else if (parent.left === this) {
      parent.left = newParent;
    } else if (parent.right === this) {
      parent.right = newParent;
    } else {
      throw new Error("The elements are wrongly connected!");
    }
  }
  getUncle () {
    // we can assume that grandparent exists when this is called!
    if (this.parent === this.parent.parent.left) {
      return this.parent.parent.right;
    } else {
      return this.parent.parent.left;
    }
  }
}

class RBTree { //eslint-disable-line no-unused-vars
  constructor () {
    this.root = null;
  }
  find (id) {
    var o = this.root;
    if (o == null) {
      return false;
    } else {
      while (true) {
        if (o == null) {
          return false;
        }
        if (id < o.val.id) {
          o = o.left;
        } else if (o.val.id < id) {
          o = o.right;
        } else {
          return o.val;
        }
      }
    }
  }
  add (v) {
    var node = new N(v);
    if (this.root != null) {
      var p = this.root; // p abbrev. parent
      while (true) {
        if (node.val.id < p.val.id) {
          if (p.left == null) {
            p.left = node;
            break;
          } else {
            p = p.left;
          }
        } else if (p.val.id < node.val.id) {
          if (p.right == null) {
            p.right = node;
            break;
          } else {
            p = p.right;
          }
        } else {
          return false;
        }
      }
      this.fixInsert(node);
    } else {
      this.root = node;
    }
    this.root.blacken();
  }
  fixInsert (n) {
    if (n.parent == null) {
      n.blacken();
      return;
    } else if (n.parent.isBlack()) {
      return;
    }
    var uncle = n.getUncle();
    if (uncle != null && uncle.isRed()) {
      // Note: parend: red, uncle: red
      n.parent.blacken();
      uncle.blacken();
      n.grandparent.redden();
      this.fixInsert(n.grandparent);
    } else {
      // Note: parent: red, uncle: black or null
      // Now we transform the tree in such a way that
      // either of these holds:
      //   1) grandparent.left.isRed
      //     and grandparent.left.left.isRed
      //   2) grandparent.right.isRed
      //     and grandparent.right.right.isRed
      if (n === n.parent.right
        && n.parent === n.grandparent.left) {
          n.parent.rotateLeft(this);
          // Since we rotated and want to use the previous
          // cases, we need to set n in such a way that
          // n.parent.isRed again
          n = n.left;
      } else if (n === n.parent.left
        && n.parent === n.grandparent.right) {
          n.parent.rotateRight(this);
          // see above
          n = n.right;
      }
      // Case 1) or 2) hold from here on.
      // Now traverse grandparent, make parent a black node
      // on the highest level which holds two red nodes.
      n.parent.blacken();
      n.grandparent.redden();
      if (n === n.parent.left) {
        // Case 1
        n.grandparent.rotateRight(this);
      } else {
        // Case 2
        n.grandparent.rotateLeft(this);
      }
    }
  }
}
