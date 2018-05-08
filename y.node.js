
/**
 * yjs - A framework for real-time p2p shared editing on any data
 * @version v13.0.0-60
 * @license MIT
 */

'use strict';

function rotate (tree, parent, newParent, n) {
  if (parent === null) {
    tree.root = newParent;
    newParent._parent = null;
  } else if (parent.left === n) {
    parent.left = newParent;
  } else if (parent.right === n) {
    parent.right = newParent;
  } else {
    throw new Error('The elements are wrongly connected!')
  }
}

class N {
  // A created node is always red!
  constructor (val) {
    this.val = val;
    this.color = true;
    this._left = null;
    this._right = null;
    this._parent = null;
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
      n._parent = this;
    }
    this._left = n;
  }
  set right (n) {
    if (n !== null) {
      n._parent = this;
    }
    this._right = n;
  }
  rotateLeft (tree) {
    const parent = this.parent;
    const newParent = this.right;
    const newRight = this.right.left;
    newParent.left = this;
    this.right = newRight;
    rotate(tree, parent, newParent, this);
  }
  next () {
    if (this.right !== null) {
      // search the most left node in the right tree
      var o = this.right;
      while (o.left !== null) {
        o = o.left;
      }
      return o
    } else {
      var p = this;
      while (p.parent !== null && p !== p.parent.left) {
        p = p.parent;
      }
      return p.parent
    }
  }
  prev () {
    if (this.left !== null) {
      // search the most right node in the left tree
      var o = this.left;
      while (o.right !== null) {
        o = o.right;
      }
      return o
    } else {
      var p = this;
      while (p.parent !== null && p !== p.parent.right) {
        p = p.parent;
      }
      return p.parent
    }
  }
  rotateRight (tree) {
    const parent = this.parent;
    const newParent = this.left;
    const newLeft = this.left.right;
    newParent.right = this;
    this.left = newLeft;
    rotate(tree, parent, newParent, this);
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

/*
 * This is a Red Black Tree implementation
 */
class Tree {
  constructor () {
    this.root = null;
    this.length = 0;
  }
  findNext (id) {
    var nextID = id.clone();
    nextID.clock += 1;
    return this.findWithLowerBound(nextID)
  }
  findPrev (id) {
    let prevID = id.clone();
    prevID.clock -= 1;
    return this.findWithUpperBound(prevID)
  }
  findNodeWithLowerBound (from) {
    var o = this.root;
    if (o === null) {
      return null
    } else {
      while (true) {
        if (from === null || (from.lessThan(o.val._id) && o.left !== null)) {
          // o is included in the bound
          // try to find an element that is closer to the bound
          o = o.left;
        } else if (from !== null && o.val._id.lessThan(from)) {
          // o is not within the bound, maybe one of the right elements is..
          if (o.right !== null) {
            o = o.right;
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
    var o = this.root;
    if (o === null) {
      return null
    } else {
      while (true) {
        if ((to === null || o.val._id.lessThan(to)) && o.right !== null) {
          // o is included in the bound
          // try to find an element that is closer to the bound
          o = o.right;
        } else if (to !== null && to.lessThan(o.val._id)) {
          // o is not within the bound, maybe one of the left elements is..
          if (o.left !== null) {
            o = o.left;
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
    var o = this.root;
    while (o != null && o.left != null) {
      o = o.left;
    }
    return o
  }
  findWithLowerBound (from) {
    var n = this.findNodeWithLowerBound(from);
    return n == null ? null : n.val
  }
  findWithUpperBound (to) {
    var n = this.findNodeWithUpperBound(to);
    return n == null ? null : n.val
  }
  iterate (from, to, f) {
    var o;
    if (from === null) {
      o = this.findSmallestNode();
    } else {
      o = this.findNodeWithLowerBound(from);
    }
    while (
      o !== null &&
      (
        to === null || // eslint-disable-line no-unmodified-loop-condition
        o.val._id.lessThan(to) ||
        o.val._id.equals(to)
      )
    ) {
      f(o.val);
      o = o.next();
    }
  }
  find (id) {
    let n = this.findNode(id);
    if (n !== null) {
      return n.val
    } else {
      return null
    }
  }
  findNode (id) {
    var o = this.root;
    if (o === null) {
      return null
    } else {
      while (true) {
        if (o === null) {
          return null
        }
        if (id.lessThan(o.val._id)) {
          o = o.left;
        } else if (o.val._id.lessThan(id)) {
          o = o.right;
        } else {
          return o
        }
      }
    }
  }
  delete (id) {
    var d = this.findNode(id);
    if (d == null) {
      // throw new Error('Element does not exist!')
      return
    }
    this.length--;
    if (d.left !== null && d.right !== null) {
      // switch d with the greates element in the left subtree.
      // o should have at most one child.
      var o = d.left;
      // find
      while (o.right !== null) {
        o = o.right;
      }
      // switch
      d.val = o.val;
      d = o;
    }
    // d has at most one child
    // let n be the node that replaces d
    var isFakeChild;
    var child = d.left || d.right;
    if (child === null) {
      isFakeChild = true;
      child = new N(null);
      child.blacken();
      d.right = child;
    } else {
      isFakeChild = false;
    }

    if (d.parent === null) {
      if (!isFakeChild) {
        this.root = child;
        child.blacken();
        child._parent = null;
      } else {
        this.root = null;
      }
      return
    } else if (d.parent.left === d) {
      d.parent.left = child;
    } else if (d.parent.right === d) {
      d.parent.right = child;
    } else {
      throw new Error('Impossible!')
    }
    if (d.isBlack()) {
      if (child.isRed()) {
        child.blacken();
      } else {
        this._fixDelete(child);
      }
    }
    this.root.blacken();
    if (isFakeChild) {
      if (child.parent.left === child) {
        child.parent.left = null;
      } else if (child.parent.right === child) {
        child.parent.right = null;
      } else {
        throw new Error('Impossible #3')
      }
    }
  }
  _fixDelete (n) {
    function isBlack (node) {
      return node !== null ? node.isBlack() : true
    }
    function isRed (node) {
      return node !== null ? node.isRed() : false
    }
    if (n.parent === null) {
      // this can only be called after the first iteration of fixDelete.
      return
    }
    // d was already replaced by the child
    // d is not the root
    // d and child are black
    var sibling = n.sibling;
    if (isRed(sibling)) {
      // make sibling the grandfather
      n.parent.redden();
      sibling.blacken();
      if (n === n.parent.left) {
        n.parent.rotateLeft(this);
      } else if (n === n.parent.right) {
        n.parent.rotateRight(this);
      } else {
        throw new Error('Impossible #2')
      }
      sibling = n.sibling;
    }
    // parent, sibling, and children of n are black
    if (n.parent.isBlack() &&
      sibling.isBlack() &&
      isBlack(sibling.left) &&
      isBlack(sibling.right)
    ) {
      sibling.redden();
      this._fixDelete(n.parent);
    } else if (n.parent.isRed() &&
      sibling.isBlack() &&
      isBlack(sibling.left) &&
      isBlack(sibling.right)
    ) {
      sibling.redden();
      n.parent.blacken();
    } else {
      if (n === n.parent.left &&
        sibling.isBlack() &&
        isRed(sibling.left) &&
        isBlack(sibling.right)
      ) {
        sibling.redden();
        sibling.left.blacken();
        sibling.rotateRight(this);
        sibling = n.sibling;
      } else if (n === n.parent.right &&
        sibling.isBlack() &&
        isRed(sibling.right) &&
        isBlack(sibling.left)
      ) {
        sibling.redden();
        sibling.right.blacken();
        sibling.rotateLeft(this);
        sibling = n.sibling;
      }
      sibling.color = n.parent.color;
      n.parent.blacken();
      if (n === n.parent.left) {
        sibling.right.blacken();
        n.parent.rotateLeft(this);
      } else {
        sibling.left.blacken();
        n.parent.rotateRight(this);
      }
    }
  }
  put (v) {
    var node = new N(v);
    if (this.root !== null) {
      var p = this.root; // p abbrev. parent
      while (true) {
        if (node.val._id.lessThan(p.val._id)) {
          if (p.left === null) {
            p.left = node;
            break
          } else {
            p = p.left;
          }
        } else if (p.val._id.lessThan(node.val._id)) {
          if (p.right === null) {
            p.right = node;
            break
          } else {
            p = p.right;
          }
        } else {
          p.val = node.val;
          return p
        }
      }
      this._fixInsert(node);
    } else {
      this.root = node;
    }
    this.length++;
    this.root.blacken();
    return node
  }
  _fixInsert (n) {
    if (n.parent === null) {
      n.blacken();
      return
    } else if (n.parent.isBlack()) {
      return
    }
    var uncle = n.getUncle();
    if (uncle !== null && uncle.isRed()) {
      // Note: parent: red, uncle: red
      n.parent.blacken();
      uncle.blacken();
      n.grandparent.redden();
      this._fixInsert(n.grandparent);
    } else {
      // Note: parent: red, uncle: black or null
      // Now we transform the tree in such a way that
      // either of these holds:
      //   1) grandparent.left.isRed
      //     and grandparent.left.left.isRed
      //   2) grandparent.right.isRed
      //     and grandparent.right.right.isRed
      if (n === n.parent.right && n.parent === n.grandparent.left) {
        n.parent.rotateLeft(this);
        // Since we rotated and want to use the previous
        // cases, we need to set n in such a way that
        // n.parent.isRed again
        n = n.left;
      } else if (n === n.parent.left && n.parent === n.grandparent.right) {
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

class ID {
  constructor (user, clock) {
    this.user = user; // TODO: rename to client
    this.clock = clock;
  }
  clone () {
    return new ID(this.user, this.clock)
  }
  equals (id) {
    return id !== null && id.user === this.user && id.clock === this.clock
  }
  lessThan (id) {
    if (id.constructor === ID) {
      return this.user < id.user || (this.user === id.user && this.clock < id.clock)
    } else {
      return false
    }
  }
}

class DSNode {
  constructor (id, len, gc) {
    this._id = id;
    this.len = len;
    this.gc = gc;
  }
  clone () {
    return new DSNode(this._id, this.len, this.gc)
  }
}

class DeleteStore extends Tree {
  logTable () {
    const deletes = [];
    this.iterate(null, null, function (n) {
      deletes.push({
        user: n._id.user,
        clock: n._id.clock,
        len: n.len,
        gc: n.gc
      });
    });
    console.table(deletes);
  }
  isDeleted (id) {
    var n = this.findWithUpperBound(id);
    return n !== null && n._id.user === id.user && id.clock < n._id.clock + n.len
  }
  mark (id, length, gc) {
    if (length === 0) return
    // Step 1. Unmark range
    const leftD = this.findWithUpperBound(new ID(id.user, id.clock - 1));
    // Resize left DSNode if necessary
    if (leftD !== null && leftD._id.user === id.user) {
      if (leftD._id.clock < id.clock && id.clock < leftD._id.clock + leftD.len) {
        // node is overlapping. need to resize
        if (id.clock + length < leftD._id.clock + leftD.len) {
          // overlaps new mark range and some more
          // create another DSNode to the right of new mark
          this.put(new DSNode(new ID(id.user, id.clock + length), leftD._id.clock + leftD.len - id.clock - length, leftD.gc));
        }
        // resize left DSNode
        leftD.len = id.clock - leftD._id.clock;
      } // Otherwise there is no overlapping
    }
    // Resize right DSNode if necessary
    const upper = new ID(id.user, id.clock + length - 1);
    const rightD = this.findWithUpperBound(upper);
    if (rightD !== null && rightD._id.user === id.user) {
      if (rightD._id.clock < id.clock + length && id.clock <= rightD._id.clock && id.clock + length < rightD._id.clock + rightD.len) { // we only consider the case where we resize the node
        const d = id.clock + length - rightD._id.clock;
        rightD._id = new ID(rightD._id.user, rightD._id.clock + d);
        rightD.len -= d;
      }
    }
    // Now we only have to delete all inner marks
    const deleteNodeIds = [];
    this.iterate(id, upper, m => {
      deleteNodeIds.push(m._id);
    });
    for (let i = deleteNodeIds.length - 1; i >= 0; i--) {
      this.delete(deleteNodeIds[i]);
    }
    let newMark = new DSNode(id, length, gc);
    // Step 2. Check if we can extend left or right
    if (leftD !== null && leftD._id.user === id.user && leftD._id.clock + leftD.len === id.clock && leftD.gc === gc) {
      // We can extend left
      leftD.len += length;
      newMark = leftD;
    }
    const rightNext = this.find(new ID(id.user, id.clock + length));
    if (rightNext !== null && rightNext._id.user === id.user && id.clock + length === rightNext._id.clock && gc === rightNext.gc) {
      // We can merge newMark and rightNext
      newMark.len += rightNext.len;
      this.delete(rightNext._id);
    }
    if (leftD !== newMark) {
      // only put if we didn't extend left
      this.put(newMark);
    }
  }
  // TODO: exchange markDeleted for mark()
  markDeleted (id, length) {
    this.mark(id, length, false);
  }
}

/**
 * A BinaryDecoder handles the decoding of an ArrayBuffer.
 */
class BinaryDecoder {
  /**
   * @param {Uint8Array|Buffer} buffer The binary data that this instance
   *                                   decodes.
   */
  constructor (buffer) {
    if (buffer instanceof ArrayBuffer) {
      this.uint8arr = new Uint8Array(buffer);
    } else if (
      buffer instanceof Uint8Array ||
      (
        typeof Buffer !== 'undefined' && buffer instanceof Buffer
      )
    ) {
      this.uint8arr = buffer;
    } else {
      throw new Error('Expected an ArrayBuffer or Uint8Array!')
    }
    this.pos = 0;
  }

  /**
   * Clone this decoder instance.
   * Optionally set a new position parameter.
   */
  clone (newPos = this.pos) {
    let decoder = new BinaryDecoder(this.uint8arr);
    decoder.pos = newPos;
    return decoder
  }

  /**
   * Number of bytes.
   */
  get length () {
    return this.uint8arr.length
  }

  /**
   * Skip one byte, jump to the next position.
   */
  skip8 () {
    this.pos++;
  }

  /**
   * Read one byte as unsigned integer.
   */
  readUint8 () {
    return this.uint8arr[this.pos++]
  }

  /**
   * Read 4 bytes as unsigned integer.
   *
   * @return {number} An unsigned integer.
   */
  readUint32 () {
    let uint =
      this.uint8arr[this.pos] +
      (this.uint8arr[this.pos + 1] << 8) +
      (this.uint8arr[this.pos + 2] << 16) +
      (this.uint8arr[this.pos + 3] << 24);
    this.pos += 4;
    return uint
  }

  /**
   * Look ahead without incrementing position.
   * to the next byte and read it as unsigned integer.
   *
   * @return {number} An unsigned integer.
   */
  peekUint8 () {
    return this.uint8arr[this.pos]
  }

  /**
   * Read unsigned integer (32bit) with variable length.
   * 1/8th of the storage is used as encoding overhead.
   *  * numbers < 2^7 is stored in one byte.
   *  * numbers < 2^14 is stored in two bytes.
   *
   * @return {number} An unsigned integer.
   */
  readVarUint () {
    let num = 0;
    let len = 0;
    while (true) {
      let r = this.uint8arr[this.pos++];
      num = num | ((r & 0b1111111) << len);
      len += 7;
      if (r < 1 << 7) {
        return num >>> 0 // return unsigned number!
      }
      if (len > 35) {
        throw new Error('Integer out of range!')
      }
    }
  }

  /**
   * Read string of variable length
   * * varUint is used to store the length of the string
   *
   * @return {String} The read String.
   */
  readVarString () {
    let len = this.readVarUint();
    let bytes = new Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = this.uint8arr[this.pos++];
    }
    let encodedString = bytes.map(b => String.fromCodePoint(b)).join('');
    return decodeURIComponent(escape(encodedString))
  }

  /**
   * Look ahead and read varString without incrementing position
   */
  peekVarString () {
    let pos = this.pos;
    let s = this.readVarString();
    this.pos = pos;
    return s
  }

  /**
   * Read ID.
   * * If first varUint read is 0xFFFFFF a RootID is returned.
   * * Otherwise an ID is returned.
   *
   * @return ID
   */
  readID () {
    let user = this.readVarUint();
    if (user === RootFakeUserID) {
      // read property name and type id
      const rid = new RootID(this.readVarString(), null);
      rid.type = this.readVarUint();
      return rid
    }
    return new ID(user, this.readVarUint())
  }
}

// TODO should have the same base class as Item
class GC {
  constructor () {
    this._id = null;
    this._length = 0;
  }

  get _deleted () {
    return true
  }

  _integrate (y) {
    const id = this._id;
    const userState = y.ss.getState(id.user);
    if (id.clock === userState) {
      y.ss.setState(id.user, id.clock + this._length);
    }
    y.ds.mark(this._id, this._length, true);
    let n = y.os.put(this);
    const prev = n.prev().val;
    if (prev !== null && prev.constructor === GC && prev._id.user === n.val._id.user && prev._id.clock + prev._length === n.val._id.clock) {
      // TODO: do merging for all items!
      prev._length += n.val._length;
      y.os.delete(n.val._id);
      n = prev;
    }
    if (n.val) {
      n = n.val;
    }
    const next = y.os.findNext(n._id);
    if (next !== null && next.constructor === GC && next._id.user === n._id.user && next._id.clock === n._id.clock + n._length) {
      n._length += next._length;
      y.os.delete(next._id);
    }
    if (id.user !== RootFakeUserID) {
      if (y.connector !== null && (y.connector._forwardAppliedStructs || id.user === y.userID)) {
        y.connector.broadcastStruct(this);
      }
      if (y.persistence !== null) {
        y.persistence.saveStruct(y, this);
      }
    }
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   * @private
   */
  _toBinary (encoder) {
    encoder.writeUint8(getStructReference(this.constructor));
    encoder.writeID(this._id);
    encoder.writeVarUint(this._length);
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   * @private
   */
  _fromBinary (y, decoder) {
    const id = decoder.readID();
    this._id = id;
    this._length = decoder.readVarUint();
    const missing = [];
    if (y.ss.getState(id.user) < id.clock) {
      missing.push(new ID(id.user, id.clock - 1));
    }
    return missing
  }

  _splitAt () {
    return this
  }

  _clonePartial (diff) {
    const gc = new GC();
    gc._id = new ID(this._id.user, this._id.clock + diff);
    gc._length = this._length - diff;
    return gc
  }
}

class MissingEntry {
  constructor (decoder, missing, struct) {
    this.decoder = decoder;
    this.missing = missing.length;
    this.struct = struct;
  }
}

/**
 * @private
 * Integrate remote struct
 * When a remote struct is integrated, other structs might be ready to ready to
 * integrate.
 */
function _integrateRemoteStructHelper (y, struct) {
  const id = struct._id;
  if (id === undefined) {
    struct._integrate(y);
  } else {
    if (y.ss.getState(id.user) > id.clock) {
      return
    }
    if (!y.gcEnabled || struct.constructor === GC || (struct._parent.constructor !== GC && struct._parent._deleted === false)) {
      // Is either a GC or Item with an undeleted parent
      // save to integrate
      struct._integrate(y);
    } else {
      // Is an Item. parent was deleted.
      struct._gc(y);
    }
    let msu = y._missingStructs.get(id.user);
    if (msu != null) {
      let clock = id.clock;
      const finalClock = clock + struct._length;
      for (;clock < finalClock; clock++) {
        const missingStructs = msu.get(clock);
        if (missingStructs !== undefined) {
          missingStructs.forEach(missingDef => {
            missingDef.missing--;
            if (missingDef.missing === 0) {
              const decoder = missingDef.decoder;
              let oldPos = decoder.pos;
              let missing = missingDef.struct._fromBinary(y, decoder);
              decoder.pos = oldPos;
              if (missing.length === 0) {
                y._readyToIntegrate.push(missingDef.struct);
              }
            }
          });
          msu.delete(clock);
        }
      }
    }
  }
}

function stringifyStructs (y, decoder, strBuilder) {
  const len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let reference = decoder.readVarUint();
    let Constr = getStruct(reference);
    let struct = new Constr();
    let missing = struct._fromBinary(y, decoder);
    let logMessage = '  ' + struct._logString();
    if (missing.length > 0) {
      logMessage += ' .. missing: ' + missing.map(logID).join(', ');
    }
    strBuilder.push(logMessage);
  }
}

function integrateRemoteStructs (y, decoder) {
  const len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let reference = decoder.readVarUint();
    let Constr = getStruct(reference);
    let struct = new Constr();
    let decoderPos = decoder.pos;
    let missing = struct._fromBinary(y, decoder);
    if (missing.length === 0) {
      while (struct != null) {
        _integrateRemoteStructHelper(y, struct);
        struct = y._readyToIntegrate.shift();
      }
    } else {
      let _decoder = new BinaryDecoder(decoder.uint8arr);
      _decoder.pos = decoderPos;
      let missingEntry = new MissingEntry(_decoder, missing, struct);
      let missingStructs = y._missingStructs;
      for (let i = missing.length - 1; i >= 0; i--) {
        let m = missing[i];
        if (!missingStructs.has(m.user)) {
          missingStructs.set(m.user, new Map());
        }
        let msu = missingStructs.get(m.user);
        if (!msu.has(m.clock)) {
          msu.set(m.clock, []);
        }
        let mArray = msu = msu.get(m.clock);
        mArray.push(missingEntry);
      }
    }
  }
}

const bits7 = 0b1111111;
const bits8 = 0b11111111;

/**
 * A BinaryEncoder handles the encoding to an ArrayBuffer.
 */
class BinaryEncoder {
  constructor () {
    // TODO: implement chained Uint8Array buffers instead of Array buffer
    // TODO: Rewrite all methods as functions!
    this.data = [];
  }

  /**
   * The current length of the encoded data.
   */
  get length () {
    return this.data.length
  }

  /**
   * The current write pointer (the same as {@link length}).
   */
  get pos () {
    return this.data.length
  }

  /**
   * Create an ArrayBuffer.
   *
   * @return {Uint8Array} A Uint8Array that represents the written data.
   */
  createBuffer () {
    return Uint8Array.from(this.data).buffer
  }

  /**
   * Write one byte as an unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint8 (num) {
    this.data.push(num & bits8);
  }

  /**
   * Write one byte as an unsigned Integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint8 (pos, num) {
    this.data[pos] = num & bits8;
  }

  /**
   * Write two bytes as an unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint16 (num) {
    this.data.push(num & bits8, (num >>> 8) & bits8);
  }
  /**
   * Write two bytes as an unsigned integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint16 (pos, num) {
    this.data[pos] = num & bits8;
    this.data[pos + 1] = (num >>> 8) & bits8;
  }

  /**
   * Write two bytes as an unsigned integer
   *
   * @param {number} num The number that is to be encoded.
   */
  writeUint32 (num) {
    for (let i = 0; i < 4; i++) {
      this.data.push(num & bits8);
      num >>>= 8;
    }
  }

  /**
   * Write two bytes as an unsigned integer at a specific location.
   *
   * @param {number} pos The location where the data will be written.
   * @param {number} num The number that is to be encoded.
   */
  setUint32 (pos, num) {
    for (let i = 0; i < 4; i++) {
      this.data[pos + i] = num & bits8;
      num >>>= 8;
    }
  }

  /**
   * Write a variable length unsigned integer.
   *
   * @param {number} num The number that is to be encoded.
   */
  writeVarUint (num) {
    while (num >= 0b10000000) {
      this.data.push(0b10000000 | (bits7 & num));
      num >>>= 7;
    }
    this.data.push(bits7 & num);
  }

  /**
   * Write a variable length string.
   *
   * @param {String} str The string that is to be encoded.
   */
  writeVarString (str) {
    let encodedString = unescape(encodeURIComponent(str));
    let bytes = encodedString.split('').map(c => c.codePointAt());
    let len = bytes.length;
    this.writeVarUint(len);
    for (let i = 0; i < len; i++) {
      this.data.push(bytes[i]);
    }
  }

  /**
   * Write an ID at the current position.
   *
   * @param {ID} id The ID that is to be written.
   */
  writeID (id) {
    const user = id.user;
    this.writeVarUint(user);
    if (user !== RootFakeUserID) {
      this.writeVarUint(id.clock);
    } else {
      this.writeVarString(id.name);
      this.writeVarUint(id.type);
    }
  }
}

function readStateSet (decoder) {
  let ss = new Map();
  let ssLength = decoder.readUint32();
  for (let i = 0; i < ssLength; i++) {
    let user = decoder.readVarUint();
    let clock = decoder.readVarUint();
    ss.set(user, clock);
  }
  return ss
}

function writeStateSet (y, encoder) {
  let lenPosition = encoder.pos;
  let len = 0;
  encoder.writeUint32(0);
  for (let [user, clock] of y.ss.state) {
    encoder.writeVarUint(user);
    encoder.writeVarUint(clock);
    len++;
  }
  encoder.setUint32(lenPosition, len);
}

function writeDeleteSet (y, encoder) {
  let currentUser = null;
  let currentLength;
  let lastLenPos;

  let numberOfUsers = 0;
  let laterDSLenPus = encoder.pos;
  encoder.writeUint32(0);

  y.ds.iterate(null, null, function (n) {
    var user = n._id.user;
    var clock = n._id.clock;
    var len = n.len;
    var gc = n.gc;
    if (currentUser !== user) {
      numberOfUsers++;
      // a new user was found
      if (currentUser !== null) { // happens on first iteration
        encoder.setUint32(lastLenPos, currentLength);
      }
      currentUser = user;
      encoder.writeVarUint(user);
      // pseudo-fill pos
      lastLenPos = encoder.pos;
      encoder.writeUint32(0);
      currentLength = 0;
    }
    encoder.writeVarUint(clock);
    encoder.writeVarUint(len);
    encoder.writeUint8(gc ? 1 : 0);
    currentLength++;
  });
  if (currentUser !== null) { // happens on first iteration
    encoder.setUint32(lastLenPos, currentLength);
  }
  encoder.setUint32(laterDSLenPus, numberOfUsers);
}

function readDeleteSet (y, decoder) {
  let dsLength = decoder.readUint32();
  for (let i = 0; i < dsLength; i++) {
    let user = decoder.readVarUint();
    let dv = [];
    let dvLength = decoder.readUint32();
    for (let j = 0; j < dvLength; j++) {
      let from = decoder.readVarUint();
      let len = decoder.readVarUint();
      let gc = decoder.readUint8() === 1;
      dv.push([from, len, gc]);
    }
    if (dvLength > 0) {
      let pos = 0;
      let d = dv[pos];
      let deletions = [];
      y.ds.iterate(new ID(user, 0), new ID(user, Number.MAX_VALUE), function (n) {
        // cases:
        // 1. d deletes something to the right of n
        //  => go to next n (break)
        // 2. d deletes something to the left of n
        //  => create deletions
        //  => reset d accordingly
        //  *)=> if d doesn't delete anything anymore, go to next d (continue)
        // 3. not 2) and d deletes something that also n deletes
        //  => reset d so that it doesn't contain n's deletion
        //  *)=> if d does not delete anything anymore, go to next d (continue)
        while (d != null) {
          var diff = 0; // describe the diff of length in 1) and 2)
          if (n._id.clock + n.len <= d[0]) {
            // 1)
            break
          } else if (d[0] < n._id.clock) {
            // 2)
            // delete maximum the len of d
            // else delete as much as possible
            diff = Math.min(n._id.clock - d[0], d[1]);
            // deleteItemRange(y, user, d[0], diff, true)
            deletions.push([user, d[0], diff]);
          } else {
            // 3)
            diff = n._id.clock + n.len - d[0]; // never null (see 1)
            if (d[2] && !n.gc) {
              // d marks as gc'd but n does not
              // then delete either way
              // deleteItemRange(y, user, d[0], Math.min(diff, d[1]), true)
              deletions.push([user, d[0], Math.min(diff, d[1])]);
            }
          }
          if (d[1] <= diff) {
            // d doesn't delete anything anymore
            d = dv[++pos];
          } else {
            d[0] = d[0] + diff; // reset pos
            d[1] = d[1] - diff; // reset length
          }
        }
      });
      // TODO: It would be more performant to apply the deletes in the above loop
      // Adapt the Tree implementation to support delete while iterating
      for (let i = deletions.length - 1; i >= 0; i--) {
        const del = deletions[i];
        deleteItemRange(y, del[0], del[1], del[2], true);
      }
      // for the rest.. just apply it
      for (; pos < dv.length; pos++) {
        d = dv[pos];
        deleteItemRange(y, user, d[0], d[1], true);
        // deletions.push([user, d[0], d[1], d[2]])
      }
    }
  }
}

function stringifySyncStep1 (y, decoder, strBuilder) {
  let auth = decoder.readVarString();
  let protocolVersion = decoder.readVarUint();
  strBuilder.push(`  - auth: "${auth}"`);
  strBuilder.push(`  - protocolVersion: ${protocolVersion}`);
  // write SS
  let ssBuilder = [];
  let len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint();
    let clock = decoder.readVarUint();
    ssBuilder.push(`(${user}:${clock})`);
  }
  strBuilder.push('  == SS: ' + ssBuilder.join(','));
}

function sendSyncStep1 (connector, syncUser) {
  let encoder = new BinaryEncoder();
  encoder.writeVarString(connector.y.room);
  encoder.writeVarString('sync step 1');
  encoder.writeVarString(connector.authInfo || '');
  encoder.writeVarUint(connector.protocolVersion);
  writeStateSet(connector.y, encoder);
  connector.send(syncUser, encoder.createBuffer());
}

/**
 * @private
 * Write all Items that are not not included in ss to
 * the encoder object.
 */
function writeStructs (y, encoder, ss) {
  const lenPos = encoder.pos;
  encoder.writeUint32(0);
  let len = 0;
  for (let user of y.ss.state.keys()) {
    let clock = ss.get(user) || 0;
    if (user !== RootFakeUserID) {
      const minBound = new ID(user, clock);
      const overlappingLeft = y.os.findPrev(minBound);
      const rightID = overlappingLeft === null ? null : overlappingLeft._id;
      if (rightID !== null && rightID.user === user && rightID.clock + overlappingLeft._length > clock) {
        const struct = overlappingLeft._clonePartial(clock - rightID.clock);
        struct._toBinary(encoder);
        len++;
      }
      y.os.iterate(minBound, new ID(user, Number.MAX_VALUE), function (struct) {
        struct._toBinary(encoder);
        len++;
      });
    }
  }
  encoder.setUint32(lenPos, len);
}

function readSyncStep1 (decoder, encoder, y, senderConn, sender) {
  let protocolVersion = decoder.readVarUint();
  // check protocol version
  if (protocolVersion !== y.connector.protocolVersion) {
    console.warn(
      `You tried to sync with a Yjs instance that has a different protocol version
      (You: ${protocolVersion}, Client: ${protocolVersion}).
      `);
    y.destroy();
  }
  // write sync step 2
  encoder.writeVarString('sync step 2');
  encoder.writeVarString(y.connector.authInfo || '');
  const ss = readStateSet(decoder);
  writeStructs(y, encoder, ss);
  writeDeleteSet(y, encoder);
  y.connector.send(senderConn.uid, encoder.createBuffer());
  senderConn.receivedSyncStep2 = true;
  if (y.connector.role === 'slave') {
    sendSyncStep1(y.connector, sender);
  }
}

function stringifySyncStep2 (y, decoder, strBuilder) {
  strBuilder.push('     - auth: ' + decoder.readVarString());
  strBuilder.push('  == OS:');
  stringifyStructs(y, decoder, strBuilder);
  // write DS to string
  strBuilder.push('  == DS:');
  let len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint();
    strBuilder.push(`    User: ${user}: `);
    let len2 = decoder.readUint32();
    for (let j = 0; j < len2; j++) {
      let from = decoder.readVarUint();
      let to = decoder.readVarUint();
      let gc = decoder.readUint8() === 1;
      strBuilder.push(`[${from}, ${to}, ${gc}]`);
    }
  }
}

function readSyncStep2 (decoder, encoder, y, senderConn, sender) {
  integrateRemoteStructs(y, decoder);
  readDeleteSet(y, decoder);
  y.connector._setSyncedWith(sender);
}

function messageToString ([y, buffer]) {
  let decoder = new BinaryDecoder(buffer);
  decoder.readVarString(); // read roomname
  let type = decoder.readVarString();
  let strBuilder = [];
  strBuilder.push('\n === ' + type + ' ===');
  if (type === 'update') {
    stringifyStructs(y, decoder, strBuilder);
  } else if (type === 'sync step 1') {
    stringifySyncStep1(y, decoder, strBuilder);
  } else if (type === 'sync step 2') {
    stringifySyncStep2(y, decoder, strBuilder);
  } else {
    strBuilder.push('-- Unknown message type - probably an encoding issue!!!');
  }
  return strBuilder.join('\n')
}

function messageToRoomname (buffer) {
  let decoder = new BinaryDecoder(buffer);
  decoder.readVarString(); // roomname
  return decoder.readVarString() // messageType
}

function logID (id) {
  if (id !== null && id._id != null) {
    id = id._id;
  }
  if (id === null) {
    return '()'
  } else if (id instanceof ID) {
    return `(${id.user},${id.clock})`
  } else if (id instanceof RootID) {
    return `(${id.name},${id.type})`
  } else if (id.constructor === Y$1) {
    return `y`
  } else {
    throw new Error('This is not a valid ID!')
  }
}

/**
 * Helper utility to convert an item to a readable format.
 *
 * @param {String} name The name of the item class (YText, ItemString, ..).
 * @param {Item} item The item instance.
 * @param {String} [append] Additional information to append to the returned
 *                          string.
 * @return {String} A readable string that represents the item object.
 *
 * @private
 */
function logItemHelper (name, item, append) {
  const left = item._left !== null ? item._left._lastId : null;
  const origin = item._origin !== null ? item._origin._lastId : null;
  return `${name}(id:${logID(item._id)},start:${logID(item._start)},left:${logID(left)},origin:${logID(origin)},right:${logID(item._right)},parent:${logID(item._parent)},parentSub:${item._parentSub}${append !== undefined ? ' - ' + append : ''})`
}

/**
 * @private
 * Delete all items in an ID-range
 * TODO: implement getItemCleanStartNode for better performance (only one lookup)
 */
function deleteItemRange (y, user, clock, range, gcChildren) {
  const createDelete = y.connector !== null && y.connector._forwardAppliedStructs;
  let item = y.os.getItemCleanStart(new ID(user, clock));
  if (item !== null) {
    if (!item._deleted) {
      item._splitAt(y, range);
      item._delete(y, createDelete, true);
    }
    let itemLen = item._length;
    range -= itemLen;
    clock += itemLen;
    if (range > 0) {
      let node = y.os.findNode(new ID(user, clock));
      while (node !== null && node.val !== null && range > 0 && node.val._id.equals(new ID(user, clock))) {
        const nodeVal = node.val;
        if (!nodeVal._deleted) {
          nodeVal._splitAt(y, range);
          nodeVal._delete(y, createDelete, gcChildren);
        }
        const nodeLen = nodeVal._length;
        range -= nodeLen;
        clock += nodeLen;
        node = node.next();
      }
    }
  }
}

/**
 * @private
 * A Delete change is not a real Item, but it provides the same interface as an
 * Item. The only difference is that it will not be saved in the ItemStore
 * (OperationStore), but instead it is safed in the DeleteStore.
 */
class Delete {
  constructor () {
    this._target = null;
    this._length = null;
  }

  /**
   * @private
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   */
  _fromBinary (y, decoder) {
    // TODO: set target, and add it to missing if not found
    // There is an edge case in p2p networks!
    const targetID = decoder.readID();
    this._targetID = targetID;
    this._length = decoder.readVarUint();
    if (y.os.getItem(targetID) === null) {
      return [targetID]
    } else {
      return []
    }
  }

  /**
   * @private
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   */
  _toBinary (encoder) {
    encoder.writeUint8(getStructReference(this.constructor));
    encoder.writeID(this._targetID);
    encoder.writeVarUint(this._length);
  }

  /**
   * @private
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In the case of
   * Delete it marks the delete target as deleted.
   *
   * * If created remotely (a remote user deleted something),
   *   this Delete is applied to all structs in id-range.
   * * If created lokally (e.g. when y-array deletes a range of elements),
   *   this struct is broadcasted only (it is already executed)
   */
  _integrate (y, locallyCreated = false) {
    if (!locallyCreated) {
      // from remote
      const id = this._targetID;
      deleteItemRange(y, id.user, id.clock, this._length, false);
    } else if (y.connector !== null) {
      // from local
      y.connector.broadcastStruct(this);
    }
    if (y.persistence !== null) {
      y.persistence.saveStruct(y, this);
    }
  }

  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return `Delete - target: ${logID(this._targetID)}, len: ${this._length}`
  }
}

/**
 * A transaction is created for every change on the Yjs model. It is possible
 * to bundle changes on the Yjs model in a single transaction to
 * minimize the number on messages sent and the number of observer calls.
 * If possible the user of this library should bundle as many changes as
 * possible. Here is an example to illustrate the advantages of bundling:
 *
 * @example
 * const map = y.define('map', YMap)
 * // Log content when change is triggered
 * map.observe(function () {
 *   console.log('change triggered')
 * })
 * // Each change on the map type triggers a log message:
 * map.set('a', 0) // => "change triggered"
 * map.set('b', 0) // => "change triggered"
 * // When put in a transaction, it will trigger the log after the transaction:
 * y.transact(function () {
 *   map.set('a', 1)
 *   map.set('b', 1)
 * }) // => "change triggered"
 *
 */
class Transaction {
  constructor (y) {
    /**
     * @type {Y} The Yjs instance.
     */
    this.y = y;
    /**
     * All new types that are added during a transaction.
     * @type {Set<Item>}
     */
    this.newTypes = new Set();
    /**
     * All types that were directly modified (property added or child
     * inserted/deleted). New types are not included in this Set.
     * Maps from type to parentSubs (`item._parentSub = null` for YArray)
     * @type {Set<YType,String>}
     */
    this.changedTypes = new Map();
    // TODO: rename deletedTypes
    /**
     * Set of all deleted Types and Structs.
     * @type {Set<Item>}
     */
    this.deletedStructs = new Set();
    /**
     * Saves the old state set of the Yjs instance. If a state was modified,
     * the original value is saved here.
     * @type {Map<Number,Number>}
     */
    this.beforeState = new Map();
    /**
     * Stores the events for the types that observe also child elements.
     * It is mainly used by `observeDeep`.
     * @type {Map<YType,Array<YEvent>>}
     */
    this.changedParentTypes = new Map();
  }
}

/**
 * @private
 */
function transactionTypeChanged (y, type, sub) {
  if (type !== y && !type._deleted && !y._transaction.newTypes.has(type)) {
    const changedTypes = y._transaction.changedTypes;
    let subs = changedTypes.get(type);
    if (subs === undefined) {
      // create if it doesn't exist yet
      subs = new Set();
      changedTypes.set(type, subs);
    }
    subs.add(sub);
  }
}

/**
 * @private
 * Helper utility to split an Item (see {@link Item#_splitAt})
 * - copies all properties from a to b
 * - connects a to b
 * - assigns the correct _id
 * - saves b to os
 */
function splitHelper (y, a, b, diff) {
  const aID = a._id;
  b._id = new ID(aID.user, aID.clock + diff);
  b._origin = a;
  b._left = a;
  b._right = a._right;
  if (b._right !== null) {
    b._right._left = b;
  }
  b._right_origin = a._right_origin;
  // do not set a._right_origin, as this will lead to problems when syncing
  a._right = b;
  b._parent = a._parent;
  b._parentSub = a._parentSub;
  b._deleted = a._deleted;
  // now search all relevant items to the right and update origin
  // if origin is not it foundOrigins, we don't have to search any longer
  let foundOrigins = new Set();
  foundOrigins.add(a);
  let o = b._right;
  while (o !== null && foundOrigins.has(o._origin)) {
    if (o._origin === a) {
      o._origin = b;
    }
    foundOrigins.add(o);
    o = o._right;
  }
  y.os.put(b);
  if (y._transaction.newTypes.has(a)) {
    y._transaction.newTypes.add(b);
  } else if (y._transaction.deletedStructs.has(a)) {
    y._transaction.deletedStructs.add(b);
  }
}

/**
 * Abstract class that represents any content.
 */
class Item {
  constructor () {
    /**
     * The uniqe identifier of this type.
     * @type {ID}
     */
    this._id = null;
    /**
     * The item that was originally to the left of this item.
     * @type {Item}
     */
    this._origin = null;
    /**
     * The item that is currently to the left of this item.
     * @type {Item}
     */
    this._left = null;
    /**
     * The item that is currently to the right of this item.
     * @type {Item}
     */
    this._right = null;
    /**
     * The item that was originally to the right of this item.
     * @type {Item}
     */
    this._right_origin = null;
    /**
     * The parent type.
     * @type {Y|YType}
     */
    this._parent = null;
    /**
     * If the parent refers to this item with some kind of key (e.g. YMap, the
     * key is specified here. The key is then used to refer to the list in which
     * to insert this item. If `parentSub = null` type._start is the list in
     * which to insert to. Otherwise it is `parent._start`.
     * @type {String}
     */
    this._parentSub = null;
    /**
     * Whether this item was deleted or not.
     * @type {Boolean}
     */
    this._deleted = false;
    /**
     * If this type's effect is reundone this type refers to the type that undid
     * this operation.
     * @type {Item}
     */
    this._redone = null;
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @private
   */
  _copy () {
    return new this.constructor()
  }

  /**
   * Redoes the effect of this operation.
   *
   * @param {Y} y The Yjs instance.
   *
   * @private
   */
  _redo (y) {
    if (this._redone !== null) {
      return this._redone
    }
    let struct = this._copy();
    let left = this._left;
    let right = this;
    let parent = this._parent;
    // make sure that parent is redone
    if (parent._deleted === true && parent._redone === null) {
      parent._redo(y);
    }
    if (parent._redone !== null) {
      parent = parent._redone;
      // find next cloned items
      while (left !== null) {
        if (left._redone !== null && left._redone._parent === parent) {
          left = left._redone;
          break
        }
        left = left._left;
      }
      while (right !== null) {
        if (right._redone !== null && right._redone._parent === parent) {
          right = right._redone;
        }
        right = right._right;
      }
    }
    struct._origin = left;
    struct._left = left;
    struct._right = right;
    struct._right_origin = right;
    struct._parent = parent;
    struct._parentSub = this._parentSub;
    struct._integrate(y);
    this._redone = struct;
    return struct
  }

  /**
   * Computes the last content address of this Item.
   *
   * @private
   */
  get _lastId () {
    return new ID(this._id.user, this._id.clock + this._length - 1)
  }

  /**
   * Computes the length of this Item.
   *
   * @private
   */
  get _length () {
    return 1
  }

  /**
   * Should return false if this Item is some kind of meta information
   * (e.g. format information).
   *
   * * Whether this Item should be addressable via `yarray.get(i)`
   * * Whether this Item should be counted when computing yarray.length
   *
   * @private
   */
  get _countable () {
    return true
  }

  /**
   * Splits this Item so that another Items can be inserted in-between.
   * This must be overwritten if _length > 1
   * Returns right part after split
   * * diff === 0 => this
   * * diff === length => this._right
   * * otherwise => split _content and return right part of split
   * (see {@link ItemJSON}/{@link ItemString} for implementation)
   *
   * @private
   */
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    }
    return this._right
  }

  /**
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   *
   * @private
   */
  _delete (y, createDelete = true) {
    if (!this._deleted) {
      this._deleted = true;
      y.ds.mark(this._id, this._length, false);
      let del = new Delete();
      del._targetID = this._id;
      del._length = this._length;
      if (createDelete) {
        // broadcast and persists Delete
        del._integrate(y, true);
      } else if (y.persistence !== null) {
        // only persist Delete
        y.persistence.saveStruct(y, del);
      }
      transactionTypeChanged(y, this._parent, this._parentSub);
      y._transaction.deletedStructs.add(this);
    }
  }

  _gcChildren (y) {}

  _gc (y) {
    const gc = new GC();
    gc._id = this._id;
    gc._length = this._length;
    y.os.delete(this._id);
    gc._integrate(y);
  }

  /**
   * This is called right before this Item receives any children.
   * It can be overwritten to apply pending changes before applying remote changes
   *
   * @private
   */
  _beforeChange () {
    // nop
  }

  /**
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In case of
   * Item it connects _left and _right to this Item and calls the
   * {@link Item#beforeChange} method.
   *
   * * Integrate the struct so that other types/structs can see it
   * * Add this struct to y.os
   * * Check if this is struct deleted
   *
   * @private
   */
  _integrate (y) {
    y._transaction.newTypes.add(this);
    const parent = this._parent;
    const selfID = this._id;
    const user = selfID === null ? y.userID : selfID.user;
    const userState = y.ss.getState(user);
    if (selfID === null) {
      this._id = y.ss.getNextID(this._length);
    } else if (selfID.user === RootFakeUserID) {
      // nop
    } else if (selfID.clock < userState) {
      // already applied..
      return []
    } else if (selfID.clock === userState) {
      y.ss.setState(selfID.user, userState + this._length);
    } else {
      // missing content from user
      throw new Error('Can not apply yet!')
    }
    if (!parent._deleted && !y._transaction.changedTypes.has(parent) && !y._transaction.newTypes.has(parent)) {
      // this is the first time parent is updated
      // or this types is new
      this._parent._beforeChange();
    }

    /*
    # $this has to find a unique position between origin and the next known character
    # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
    #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
    #         o2,o3 and o4 origin is 1 (the position of o2)
    #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
    #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
    #         therefore $this would be always to the right of o3
    # case 2: $origin < $o.origin
    #         if current $this insert_position > $o origin: $this ins
    #         else $insert_position will not change
    #         (maybe we encounter case 1 later, then this will be to the right of $o)
    # case 3: $origin > $o.origin
    #         $this insert_position is to the left of $o (forever!)
    */
    // handle conflicts
    let o;
    // set o to the first conflicting item
    if (this._left !== null) {
      o = this._left._right;
    } else if (this._parentSub !== null) {
      o = this._parent._map.get(this._parentSub) || null;
    } else {
      o = this._parent._start;
    }
    let conflictingItems = new Set();
    let itemsBeforeOrigin = new Set();
    // Let c in conflictingItems, b in itemsBeforeOrigin
    // ***{origin}bbbb{this}{c,b}{c,b}{o}***
    // Note that conflictingItems is a subset of itemsBeforeOrigin
    while (o !== null && o !== this._right) {
      itemsBeforeOrigin.add(o);
      conflictingItems.add(o);
      if (this._origin === o._origin) {
        // case 1
        if (o._id.user < this._id.user) {
          this._left = o;
          conflictingItems.clear();
        }
      } else if (itemsBeforeOrigin.has(o._origin)) {
        // case 2
        if (!conflictingItems.has(o._origin)) {
          this._left = o;
          conflictingItems.clear();
        }
      } else {
        break
      }
      // TODO: try to use right_origin instead.
      // Then you could basically omit conflictingItems!
      // Note: you probably can't use right_origin in every case.. only when setting _left
      o = o._right;
    }
    // reconnect left/right + update parent map/start if necessary
    const parentSub = this._parentSub;
    if (this._left === null) {
      let right;
      if (parentSub !== null) {
        const pmap = parent._map;
        right = pmap.get(parentSub) || null;
        pmap.set(parentSub, this);
      } else {
        right = parent._start;
        parent._start = this;
      }
      this._right = right;
      if (right !== null) {
        right._left = this;
      }
    } else {
      const left = this._left;
      const right = left._right;
      this._right = right;
      left._right = this;
      if (right !== null) {
        right._left = this;
      }
    }
    if (parent._deleted) {
      this._delete(y, false);
    }
    y.os.put(this);
    transactionTypeChanged(y, parent, parentSub);
    if (this._id.user !== RootFakeUserID) {
      if (y.connector !== null && (y.connector._forwardAppliedStructs || this._id.user === y.userID)) {
        y.connector.broadcastStruct(this);
      }
      if (y.persistence !== null) {
        y.persistence.saveStruct(y, this);
      }
    }
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   *
   * @private
   */
  _toBinary (encoder) {
    encoder.writeUint8(getStructReference(this.constructor));
    let info = 0;
    if (this._origin !== null) {
      info += 0b1; // origin is defined
    }
    // TODO: remove
    /* no longer send _left
    if (this._left !== this._origin) {
      info += 0b10 // do not copy origin to left
    }
    */
    if (this._right_origin !== null) {
      info += 0b100;
    }
    if (this._parentSub !== null) {
      info += 0b1000;
    }
    encoder.writeUint8(info);
    encoder.writeID(this._id);
    if (info & 0b1) {
      encoder.writeID(this._origin._lastId);
    }
    // TODO: remove
    /* see above
    if (info & 0b10) {
      encoder.writeID(this._left._lastId)
    }
    */
    if (info & 0b100) {
      encoder.writeID(this._right_origin._id);
    }
    if ((info & 0b101) === 0) {
      // neither origin nor right is defined
      encoder.writeID(this._parent._id);
    }
    if (info & 0b1000) {
      encoder.writeVarString(JSON.stringify(this._parentSub));
    }
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   *
   * @private
   */
  _fromBinary (y, decoder) {
    let missing = [];
    const info = decoder.readUint8();
    const id = decoder.readID();
    this._id = id;
    // read origin
    if (info & 0b1) {
      // origin != null
      const originID = decoder.readID();
      // we have to query for left again because it might have been split/merged..
      const origin = y.os.getItemCleanEnd(originID);
      if (origin === null) {
        missing.push(originID);
      } else {
        this._origin = origin;
        this._left = this._origin;
      }
    }
    // read right
    if (info & 0b100) {
      // right != null
      const rightID = decoder.readID();
      // we have to query for right again because it might have been split/merged..
      const right = y.os.getItemCleanStart(rightID);
      if (right === null) {
        missing.push(rightID);
      } else {
        this._right = right;
        this._right_origin = right;
      }
    }
    // read parent
    if ((info & 0b101) === 0) {
      // neither origin nor right is defined
      const parentID = decoder.readID();
      // parent does not change, so we don't have to search for it again
      if (this._parent === null) {
        let parent;
        if (parentID.constructor === RootID) {
          parent = y.os.get(parentID);
        } else {
          parent = y.os.getItem(parentID);
        }
        if (parent === null) {
          missing.push(parentID);
        } else {
          this._parent = parent;
        }
      }
    } else if (this._parent === null) {
      if (this._origin !== null) {
        if (this._origin.constructor === GC) {
          // if origin is a gc, set parent also gc'd
          this._parent = this._origin;
        } else {
          this._parent = this._origin._parent;
        }
      } else if (this._right_origin !== null) {
        // if origin is a gc, set parent also gc'd
        if (this._right_origin.constructor === GC) {
          this._parent = this._right_origin;
        } else {
          this._parent = this._right_origin._parent;
        }
      }
    }
    if (info & 0b1000) {
      // TODO: maybe put this in read parent condition (you can also read parentsub from left/right)
      this._parentSub = JSON.parse(decoder.readVarString());
    }
    if (y.ss.getState(id.user) < id.clock) {
      missing.push(new ID(id.user, id.clock - 1));
    }
    return missing
  }
}

/**
 * General event handler implementation.
 */
class EventHandler {
  constructor () {
    this.eventListeners = [];
  }

  /**
   * To prevent memory leaks, call this method when the eventListeners won't be
   * used anymore.
   */
  destroy () {
    this.eventListeners = null;
  }

  /**
   * Adds an event listener that is called when
   * {@link EventHandler#callEventListeners} is called.
   *
   * @param {Function} f The event handler.
   */
  addEventListener (f) {
    this.eventListeners.push(f);
  }

  /**
   * Removes an event listener.
   *
   * @param {Function} f The event handler that was added with
   *                     {@link EventHandler#addEventListener}
   */
  removeEventListener (f) {
    this.eventListeners = this.eventListeners.filter(function (g) {
      return f !== g
    });
  }

  /**
   * Removes all event listeners.
   */
  removeAllEventListeners () {
    this.eventListeners = [];
  }

  /**
   * Call all event listeners that were added via
   * {@link EventHandler#addEventListener}.
   *
   * @param {Transaction} transaction The transaction object // TODO: do we need this?
   * @param {YEvent} event An event object that describes the change on a type.
   */
  callEventListeners (transaction, event) {
    for (var i = 0; i < this.eventListeners.length; i++) {
      try {
        const f = this.eventListeners[i];
        f(event);
      } catch (e) {
        /*
          Your observer threw an error. This error was caught so that Yjs
          can ensure data consistency! In order to debug this error you
          have to check "Pause On Caught Exceptions" in developer tools.
        */
        console.error(e);
      }
    }
  }
}

// restructure children as if they were inserted one after another
function integrateChildren (y, start) {
  let right;
  do {
    right = start._right;
    start._right = null;
    start._right_origin = null;
    start._origin = start._left;
    start._integrate(y);
    start = right;
  } while (right !== null)
}



function gcChildren (y, item) {
  while (item !== null) {
    item._delete(y, false, true);
    item._gc(y);
    item = item._right;
  }
}

/**
 * Abstract Yjs Type class
 */
class Type extends Item {
  constructor () {
    super();
    this._map = new Map();
    this._start = null;
    this._y = null;
    this._eventHandler = new EventHandler();
    this._deepEventHandler = new EventHandler();
  }

  /**
   * Compute the path from this type to the specified target.
   *
   * @example
   * It should be accessible via `this.get(result[0]).get(result[1])..`
   * const path = type.getPathTo(child)
   * // assuming `type instanceof YArray`
   * console.log(path) // might look like => [2, 'key1']
   * child === type.get(path[0]).get(path[1])
   *
   * @param {YType} type Type target
   * @return {Array<string>} Path to the target
   */
  getPathTo (type) {
    if (type === this) {
      return []
    }
    const path = [];
    const y = this._y;
    while (type !== this && type !== y) {
      let parent = type._parent;
      if (type._parentSub !== null) {
        path.unshift(type._parentSub);
      } else {
        // parent is array-ish
        for (let [i, child] of parent) {
          if (child === type) {
            path.unshift(i);
            break
          }
        }
      }
      type = parent;
    }
    if (type !== this) {
      throw new Error('The type is not a child of this node')
    }
    return path
  }

  /**
   * @private
   * Call event listeners with an event. This will also add an event to all
   * parents (for `.observeDeep` handlers).
   */
  _callEventHandler (transaction, event) {
    const changedParentTypes = transaction.changedParentTypes;
    this._eventHandler.callEventListeners(transaction, event);
    let type = this;
    while (type !== this._y) {
      let events = changedParentTypes.get(type);
      if (events === undefined) {
        events = [];
        changedParentTypes.set(type, events);
      }
      events.push(event);
      type = type._parent;
    }
  }

  /**
   * @private
   * Helper method to transact if the y instance is available.
   *
   * TODO: Currently event handlers are not thrown when a type is not registered
   *       with a Yjs instance.
   */
  _transact (f) {
    const y = this._y;
    if (y !== null) {
      y.transact(f);
    } else {
      f(y);
    }
  }

  /**
   * Observe all events that are created on this type.
   *
   * @param {Function} f Observer function
   */
  observe (f) {
    this._eventHandler.addEventListener(f);
  }

  /**
   * Observe all events that are created by this type and its children.
   *
   * @param {Function} f Observer function
   */
  observeDeep (f) {
    this._deepEventHandler.addEventListener(f);
  }

  /**
   * Unregister an observer function.
   *
   * @param {Function} f Observer function
   */
  unobserve (f) {
    this._eventHandler.removeEventListener(f);
  }

  /**
   * Unregister an observer function.
   *
   * @param {Function} f Observer function
   */
  unobserveDeep (f) {
    this._deepEventHandler.removeEventListener(f);
  }

  /**
   * @private
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   */
  _integrate (y) {
    super._integrate(y);
    this._y = y;
    // when integrating children we must make sure to
    // integrate start
    const start = this._start;
    if (start !== null) {
      this._start = null;
      integrateChildren(y, start);
    }
    // integrate map children
    const map = this._map;
    this._map = new Map();
    for (let t of map.values()) {
      // TODO make sure that right elements are deleted!
      integrateChildren(y, t);
    }
  }

  _gcChildren (y) {
    gcChildren(y, this._start);
    this._start = null;
    this._map.forEach(item => {
      gcChildren(y, item);
    });
    this._map = new Map();
  }

  _gc (y) {
    this._gcChildren(y);
    super._gc(y);
  }

  /**
   * @private
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   * @param {boolean} [gcChildren=y._hasUndoManager===false] Whether to garbage
   *                                         collect the children of this type.
   */
  _delete (y, createDelete, gcChildren) {
    if (gcChildren === undefined || !y.gcEnabled) {
      gcChildren = y._hasUndoManager === false && y.gcEnabled;
    }
    super._delete(y, createDelete, gcChildren);
    y._transaction.changedTypes.delete(this);
    // delete map types
    for (let value of this._map.values()) {
      if (value instanceof Item && !value._deleted) {
        value._delete(y, false, gcChildren);
      }
    }
    // delete array types
    let t = this._start;
    while (t !== null) {
      if (!t._deleted) {
        t._delete(y, false, gcChildren);
      }
      t = t._right;
    }
    if (gcChildren) {
      this._gcChildren(y);
    }
  }
}

class ItemJSON extends Item {
  constructor () {
    super();
    this._content = null;
  }
  _copy () {
    let struct = super._copy();
    struct._content = this._content;
    return struct
  }
  get _length () {
    return this._content.length
  }
  _fromBinary (y, decoder) {
    let missing = super._fromBinary(y, decoder);
    let len = decoder.readVarUint();
    this._content = new Array(len);
    for (let i = 0; i < len; i++) {
      const ctnt = decoder.readVarString();
      let parsed;
      if (ctnt === 'undefined') {
        parsed = undefined;
      } else {
        parsed = JSON.parse(ctnt);
      }
      this._content[i] = parsed;
    }
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder);
    let len = this._content.length;
    encoder.writeVarUint(len);
    for (let i = 0; i < len; i++) {
      let encoded;
      let content = this._content[i];
      if (content === undefined) {
        encoded = 'undefined';
      } else {
        encoded = JSON.stringify(content);
      }
      encoder.writeVarString(encoded);
    }
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemJSON', this, `content:${JSON.stringify(this._content)}`)
  }
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    } else if (diff >= this._length) {
      return this._right
    }
    let item = new ItemJSON();
    item._content = this._content.splice(diff);
    splitHelper(y, this, item, diff);
    return item
  }
}

class ItemString extends Item {
  constructor () {
    super();
    this._content = null;
  }
  _copy () {
    let struct = super._copy();
    struct._content = this._content;
    return struct
  }
  get _length () {
    return this._content.length
  }
  _fromBinary (y, decoder) {
    let missing = super._fromBinary(y, decoder);
    this._content = decoder.readVarString();
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(this._content);
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemString', this, `content:"${this._content}"`)
  }
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    } else if (diff >= this._length) {
      return this._right
    }
    let item = new ItemString();
    item._content = this._content.slice(diff);
    this._content = this._content.slice(0, diff);
    splitHelper(y, this, item, diff);
    return item
  }
}

/**
 * YEvent describes the changes on a YType.
 */
class YEvent {
  /**
   * @param {YType} target The changed type.
   */
  constructor (target) {
    /**
     * The type on which this event was created on.
     * @type {YType}
     */
    this.target = target;
    /**
     * The current target on which the observe callback is called.
     * @type {YType}
     */
    this.currentTarget = target;
  }

  /**
   * Computes the path from `y` to the changed type.
   *
   * The following property holds:
   * @example
   *   let type = y
   *   event.path.forEach(function (dir) {
   *     type = type.get(dir)
   *   })
   *   type === event.target // => true
   */
  get path () {
    return this.currentTarget.getPathTo(this.target)
  }
}

/**
 * Event that describes the changes on a YArray
 *
 * @param {YArray} yarray The changed type
 * @param {Boolean} remote Whether the changed was caused by a remote peer
 * @param {Transaction} transaction The transaction object
 */
class YArrayEvent extends YEvent {
  constructor (yarray, remote, transaction) {
    super(yarray);
    this.remote = remote;
    this._transaction = transaction;
    this._addedElements = null;
    this._removedElements = null;
  }

  /**
   * Child elements that were added in this transaction.
   *
   * @return {Set}
   */
  get addedElements () {
    if (this._addedElements === null) {
      const target = this.target;
      const transaction = this._transaction;
      const addedElements = new Set();
      transaction.newTypes.forEach(function (type) {
        if (type._parent === target && !transaction.deletedStructs.has(type)) {
          addedElements.add(type);
        }
      });
      this._addedElements = addedElements;
    }
    return this._addedElements
  }

  /**
   * Child elements that were removed in this transaction.
   *
   * @return {Set}
   */
  get removedElements () {
    if (this._removedElements === null) {
      const target = this.target;
      const transaction = this._transaction;
      const removedElements = new Set();
      transaction.deletedStructs.forEach(function (struct) {
        if (struct._parent === target && !transaction.newTypes.has(struct)) {
          removedElements.add(struct);
        }
      });
      this._removedElements = removedElements;
    }
    return this._removedElements
  }
}

/**
 * A shared Array implementation.
 */
class YArray extends Type {
  /**
   * @private
   * Creates YArray Event and calls observers.
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YArrayEvent(this, remote, transaction));
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {Integer} index The index of the element to return from the YArray
   */
  get (index) {
    let n = this._start;
    while (n !== null) {
      if (!n._deleted && n._countable) {
        if (index < n._length) {
          if (n.constructor === ItemJSON || n.constructor === ItemString) {
            return n._content[index]
          } else {
            return n
          }
        }
        index -= n._length;
      }
      n = n._right;
    }
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @return {Array}
   */
  toArray () {
    return this.map(c => c)
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Array}
   */
  toJSON () {
    return this.map(c => {
      if (c instanceof Type) {
        if (c.toJSON !== null) {
          return c.toJSON()
        } else {
          return c.toString()
        }
      }
      return c
    })
  }

  /**
   * Returns an Array with the result of calling a provided function on every
   * element of this YArray.
   *
   * @param {Function} f Function that produces an element of the new Array
   * @return {Array} A new array with each element being the result of the
   *                 callback function
   */
  map (f) {
    const res = [];
    this.forEach((c, i) => {
      res.push(f(c, i, this));
    });
    return res
  }

  /**
   * Executes a provided function on once on overy element of this YArray.
   *
   * @param {Function} f A function to execute on every element of this YArray.
   */
  forEach (f) {
    let index = 0;
    let n = this._start;
    while (n !== null) {
      if (!n._deleted && n._countable) {
        if (n instanceof Type) {
          f(n, index++, this);
        } else {
          const content = n._content;
          const contentLen = content.length;
          for (let i = 0; i < contentLen; i++) {
            index++;
            f(content[i], index, this);
          }
        }
      }
      n = n._right;
    }
  }

  /**
   * Computes the length of this YArray.
   */
  get length () {
    let length = 0;
    let n = this._start;
    while (n !== null) {
      if (!n._deleted && n._countable) {
        length += n._length;
      }
      n = n._right;
    }
    return length
  }

  [Symbol.iterator] () {
    return {
      next: function () {
        while (this._item !== null && (this._item._deleted || this._item._length <= this._itemElement)) {
          // item is deleted or itemElement does not exist (is deleted)
          this._item = this._item._right;
          this._itemElement = 0;
        }
        if (this._item === null) {
          return {
            done: true
          }
        }
        let content;
        if (this._item instanceof Type) {
          content = this._item;
        } else {
          content = this._item._content[this._itemElement++];
        }
        return {
          value: content,
          done: false
        }
      },
      _item: this._start,
      _itemElement: 0,
      _count: 0
    }
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {Integer} index Index at which to start deleting elements
   * @param {Integer} length The number of elements to remove. Defaults to 1.
   */
  delete (index, length = 1) {
    this._y.transact(() => {
      let item = this._start;
      let count = 0;
      while (item !== null && length > 0) {
        if (!item._deleted && item._countable) {
          if (count <= index && index < count + item._length) {
            const diffDel = index - count;
            item = item._splitAt(this._y, diffDel);
            item._splitAt(this._y, length);
            length -= item._length;
            item._delete(this._y);
            count += diffDel;
          } else {
            count += item._length;
          }
        }
        item = item._right;
      }
    });
    if (length > 0) {
      throw new Error('Delete exceeds the range of the YArray')
    }
  }

  /**
   * @private
   * Inserts content after an element container.
   *
   * @param {Item} left The element container to use as a reference.
   * @param {Array} content The Array of content to insert (see {@see insert})
   */
  insertAfter (left, content) {
    this._transact(y => {
      let right;
      if (left === null) {
        right = this._start;
      } else {
        right = left._right;
      }
      let prevJsonIns = null;
      for (let i = 0; i < content.length; i++) {
        let c = content[i];
        if (typeof c === 'function') {
          c = new c(); // eslint-disable-line new-cap
        }
        if (c instanceof Type) {
          if (prevJsonIns !== null) {
            if (y !== null) {
              prevJsonIns._integrate(y);
            }
            left = prevJsonIns;
            prevJsonIns = null;
          }
          c._origin = left;
          c._left = left;
          c._right = right;
          c._right_origin = right;
          c._parent = this;
          if (y !== null) {
            c._integrate(y);
          } else if (left === null) {
            this._start = c;
          } else {
            left._right = c;
          }
          left = c;
        } else {
          if (prevJsonIns === null) {
            prevJsonIns = new ItemJSON();
            prevJsonIns._origin = left;
            prevJsonIns._left = left;
            prevJsonIns._right = right;
            prevJsonIns._right_origin = right;
            prevJsonIns._parent = this;
            prevJsonIns._content = [];
          }
          prevJsonIns._content.push(c);
        }
      }
      if (prevJsonIns !== null) {
        if (y !== null) {
          prevJsonIns._integrate(y);
        } else if (prevJsonIns._left === null) {
          this._start = prevJsonIns;
        }
      }
    });
    return content
  }

  /**
   * Inserts new content at an index.
   *
   * Important: This function expects an array of content. Not just a content
   * object. The reason for this "weirdness" is that inserting several elements
   * is very efficient when it is done as a single operation.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  yarray.insert(0, ['a'])
   *  // Insert numbers 1, 2 at position 1
   *  yarray.insert(2, [1, 2])
   *
   * @param {Integer} index The index to insert content at.
   * @param {Array} content The array of content
   */
  insert (index, content) {
    this._transact(() => {
      let left = null;
      let right = this._start;
      let count = 0;
      const y = this._y;
      while (right !== null) {
        const rightLen = right._deleted ? 0 : (right._length - 1);
        if (count <= index && index <= count + rightLen) {
          const splitDiff = index - count;
          right = right._splitAt(y, splitDiff);
          left = right._left;
          count += splitDiff;
          break
        }
        if (!right._deleted) {
          count += right._length;
        }
        left = right;
        right = right._right;
      }
      if (index > count) {
        throw new Error('Index exceeds array range!')
      }
      this.insertAfter(left, content);
    });
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array} content Array of content to append.
   */
  push (content) {
    let n = this._start;
    let lastUndeleted = null;
    while (n !== null) {
      if (!n._deleted) {
        lastUndeleted = n;
      }
      n = n._right;
    }
    this.insertAfter(lastUndeleted, content);
  }

  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('YArray', this, `start:${logID(this._start)}"`)
  }
}

/**
 * Event that describes the changes on a YMap.
 *
 * @param {YMap} ymap The YArray that changed.
 * @param {Set<any>} subs The keys that changed.
 * @param {boolean} remote Whether the change was created by a remote peer.
 */
class YMapEvent extends YEvent {
  constructor (ymap, subs, remote) {
    super(ymap);
    this.keysChanged = subs;
    this.remote = remote;
  }
}

/**
 * A shared Map implementation.
 */
class YMap extends Type {
  /**
   * @private
   * Creates YMap Event and calls observers.
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YMapEvent(this, parentSubs, remote));
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Object}
   */
  toJSON () {
    const map = {};
    for (let [key, item] of this._map) {
      if (!item._deleted) {
        let res;
        if (item instanceof Type) {
          if (item.toJSON !== undefined) {
            res = item.toJSON();
          } else {
            res = item.toString();
          }
        } else {
          res = item._content[0];
        }
        map[key] = res;
      }
    }
    return map
  }

  /**
   * Returns the keys for each element in the YMap Type.
   *
   * @return {Array}
   */
  keys () {
    // TODO: Should return either Iterator or Set!
    let keys = [];
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        keys.push(key);
      }
    }
    return keys
  }

  /**
   * Remove a specified element from this YMap.
   *
   * @param {encodable} key The key of the element to remove.
   */
  delete (key) {
    this._transact((y) => {
      let c = this._map.get(key);
      if (y !== null && c !== undefined) {
        c._delete(y);
      }
    });
  }

  /**
   * Adds or updates an element with a specified key and value.
   *
   * @param {encodable} key The key of the element to add to this YMap.
   * @param {encodable | YType} value The value of the element to add to this
   *                                  YMap.
   */
  set (key, value) {
    this._transact(y => {
      const old = this._map.get(key) || null;
      if (old !== null) {
        if (
          old.constructor === ItemJSON &&
          !old._deleted && old._content[0] === value
        ) {
          // Trying to overwrite with same value
          // break here
          return value
        }
        if (y !== null) {
          old._delete(y);
        }
      }
      let v;
      if (typeof value === 'function') {
        v = new value(); // eslint-disable-line new-cap
        value = v;
      } else if (value instanceof Item) {
        v = value;
      } else {
        v = new ItemJSON();
        v._content = [value];
      }
      v._right = old;
      v._right_origin = old;
      v._parent = this;
      v._parentSub = key;
      if (y !== null) {
        v._integrate(y);
      } else {
        this._map.set(key, v);
      }
    });
    return value
  }

  /**
   * Returns a specified element from this YMap.
   *
   * @param {encodable} key The key of the element to return.
   */
  get (key) {
    let v = this._map.get(key);
    if (v === undefined || v._deleted) {
      return undefined
    }
    if (v instanceof Type) {
      return v
    } else {
      return v._content[v._content.length - 1]
    }
  }

  /**
   * Returns a boolean indicating whether the specified key exists or not.
   *
   * @param {encodable} key The key to test.
   */
  has (key) {
    let v = this._map.get(key);
    if (v === undefined || v._deleted) {
      return false
    } else {
      return true
    }
  }

  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('YMap', this, `mapSize:${this._map.size}`)
  }
}

class ItemEmbed extends Item {
  constructor () {
    super();
    this.embed = null;
  }
  _copy (undeleteChildren, copyPosition) {
    let struct = super._copy(undeleteChildren, copyPosition);
    struct.embed = this.embed;
    return struct
  }
  get _length () {
    return 1
  }
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder);
    this.embed = JSON.parse(decoder.readVarString());
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(JSON.stringify(this.embed));
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemEmbed', this, `embed:${JSON.stringify(this.embed)}`)
  }
}

class ItemFormat extends Item {
  constructor () {
    super();
    this.key = null;
    this.value = null;
  }
  _copy (undeleteChildren, copyPosition) {
    let struct = super._copy(undeleteChildren, copyPosition);
    struct.key = this.key;
    struct.value = this.value;
    return struct
  }
  get _length () {
    return 1
  }
  get _countable () {
    return false
  }
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder);
    this.key = decoder.readVarString();
    this.value = JSON.parse(decoder.readVarString());
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(this.key);
    encoder.writeVarString(JSON.stringify(this.value));
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('ItemFormat', this, `key:${JSON.stringify(this.key)},value:${JSON.stringify(this.value)}`)
  }
}

/**
 * @private
 */
function integrateItem (item, parent, y, left, right) {
  item._origin = left;
  item._left = left;
  item._right = right;
  item._right_origin = right;
  item._parent = parent;
  if (y !== null) {
    item._integrate(y);
  } else if (left === null) {
    parent._start = item;
  } else {
    left._right = item;
  }
}

/**
 * @private
 */
function findNextPosition (currentAttributes, parent, left, right, count) {
  while (right !== null && count > 0) {
    switch (right.constructor) {
      case ItemEmbed:
      case ItemString:
        const rightLen = right._deleted ? 0 : (right._length - 1);
        if (count <= rightLen) {
          right = right._splitAt(parent._y, count);
          left = right._left;
          return [left, right, currentAttributes]
        }
        if (right._deleted === false) {
          count -= right._length;
        }
        break
      case ItemFormat:
        if (right._deleted === false) {
          updateCurrentAttributes(currentAttributes, right);
        }
        break
    }
    left = right;
    right = right._right;
  }
  return [left, right, currentAttributes]
}

/**
 * @private
 */
function findPosition (parent, index) {
  let currentAttributes = new Map();
  let left = null;
  let right = parent._start;
  return findNextPosition(currentAttributes, parent, left, right, index)
}

/**
 * Negate applied formats
 *
 * @private
 */
function insertNegatedAttributes (y, parent, left, right, negatedAttributes) {
  // check if we really need to remove attributes
  while (
    right !== null && (
      right._deleted === true || (
        right.constructor === ItemFormat &&
        (negatedAttributes.get(right.key) === right.value)
      )
    )
  ) {
    if (right._deleted === false) {
      negatedAttributes.delete(right.key);
    }
    left = right;
    right = right._right;
  }
  for (let [key, val] of negatedAttributes) {
    let format = new ItemFormat();
    format.key = key;
    format.value = val;
    integrateItem(format, parent, y, left, right);
    left = format;
  }
  return [left, right]
}

/**
 * @private
 */
function updateCurrentAttributes (currentAttributes, item) {
  const value = item.value;
  const key = item.key;
  if (value === null) {
    currentAttributes.delete(key);
  } else {
    currentAttributes.set(key, value);
  }
}

/**
 * @private
 */
function minimizeAttributeChanges (left, right, currentAttributes, attributes) {
  // go right while attributes[right.key] === right.value (or right is deleted)
  while (true) {
    if (right === null) {
      break
    } else if (right._deleted === true) {
      // continue
    } else if (right.constructor === ItemFormat && (attributes[right.key] || null) === right.value) {
      // found a format, update currentAttributes and continue
      updateCurrentAttributes(currentAttributes, right);
    } else {
      break
    }
    left = right;
    right = right._right;
  }
  return [left, right]
}

/**
 * @private
 */
function insertAttributes (y, parent, left, right, attributes, currentAttributes) {
  const negatedAttributes = new Map();
  // insert format-start items
  for (let key in attributes) {
    const val = attributes[key];
    const currentVal = currentAttributes.get(key);
    if (currentVal !== val) {
      // save negated attribute (set null if currentVal undefined)
      negatedAttributes.set(key, currentVal || null);
      let format = new ItemFormat();
      format.key = key;
      format.value = val;
      integrateItem(format, parent, y, left, right);
      left = format;
    }
  }
  return [left, right, negatedAttributes]
}

/**
 * @private
 */
function insertText (y, text, parent, left, right, currentAttributes, attributes) {
  for (let [key] of currentAttributes) {
    if (attributes.hasOwnProperty(key) === false) {
      attributes[key] = null;
    }
  }
  [left, right] = minimizeAttributeChanges(left, right, currentAttributes, attributes);
  let negatedAttributes;
  [left, right, negatedAttributes] = insertAttributes(y, parent, left, right, attributes, currentAttributes);
  // insert content
  let item;
  if (text.constructor === String) {
    item = new ItemString();
    item._content = text;
  } else {
    item = new ItemEmbed();
    item.embed = text;
  }
  integrateItem(item, parent, y, left, right);
  left = item;
  return insertNegatedAttributes(y, parent, left, right, negatedAttributes)
}

/**
 * @private
 */
function formatText (y, length, parent, left, right, currentAttributes, attributes) {
  [left, right] = minimizeAttributeChanges(left, right, currentAttributes, attributes);
  let negatedAttributes;
  [left, right, negatedAttributes] = insertAttributes(y, parent, left, right, attributes, currentAttributes);
  // iterate until first non-format or null is found
  // delete all formats with attributes[format.key] != null
  while (length > 0 && right !== null) {
    if (right._deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          if (attributes.hasOwnProperty(right.key)) {
            if (attributes[right.key] === right.value) {
              negatedAttributes.delete(right.key);
            } else {
              negatedAttributes.set(right.key, right.value);
            }
            right._delete(y);
          }
          updateCurrentAttributes(currentAttributes, right);
          break
        case ItemEmbed:
        case ItemString:
          right._splitAt(y, length);
          length -= right._length;
          break
      }
    }
    left = right;
    right = right._right;
  }
  return insertNegatedAttributes(y, parent, left, right, negatedAttributes)
}

/**
 * @private
 */
function deleteText (y, length, parent, left, right, currentAttributes) {
  while (length > 0 && right !== null) {
    if (right._deleted === false) {
      switch (right.constructor) {
        case ItemFormat:
          updateCurrentAttributes(currentAttributes, right);
          break
        case ItemEmbed:
        case ItemString:
          right._splitAt(y, length);
          length -= right._length;
          right._delete(y);
          break
      }
    }
    left = right;
    right = right._right;
  }
  return [left, right]
}

// TODO: In the quill delta representation we should also use the format {ops:[..]}
/**
 * The Quill Delta format represents changes on a text document with
 * formatting information. For mor information visit {@link https://quilljs.com/docs/delta/|Quill Delta}
 *
 * @example
 *   {
 *     ops: [
 *       { insert: 'Gandalf', attributes: { bold: true } },
 *       { insert: ' the ' },
 *       { insert: 'Grey', attributes: { color: '#cccccc' } }
 *     ]
 *   }
 *
 * @typedef {Array<Object>} Delta
 */

 /**
  * Attributes that can be assigned to a selection of text.
  *
  * @example
  *   {
  *     bold: true,
  *     font-size: '40px'
  *   }
  *
  * @typedef {Object} TextAttributes
  */

/**
 * Event that describes the changes on a YText type.
 *
 * @private
 */
class YTextEvent extends YArrayEvent {
  constructor (ytext, remote, transaction) {
    super(ytext, remote, transaction);
    this._delta = null;
  }
  // TODO: Should put this in a separate function. toDelta shouldn't be included
  //       in every Yjs distribution
  /**
   * Compute the changes in the delta format.
   *
   * @return {Delta} A {@link https://quilljs.com/docs/delta/|Quill Delta}) that
   *                 represents the changes on the document.
   *
   * @public
   */
  get delta () {
    if (this._delta === null) {
      const y = this.target._y;
      y.transact(() => {
        let item = this.target._start;
        const delta = [];
        const added = this.addedElements;
        const removed = this.removedElements;
        this._delta = delta;
        let action = null;
        let attributes = {}; // counts added or removed new attributes for retain
        const currentAttributes = new Map(); // saves all current attributes for insert
        const oldAttributes = new Map();
        let insert = '';
        let retain = 0;
        let deleteLen = 0;
        const addOp = function addOp () {
          if (action !== null) {
            let op;
            switch (action) {
              case 'delete':
                op = { delete: deleteLen };
                deleteLen = 0;
                break
              case 'insert':
                op = { insert };
                if (currentAttributes.size > 0) {
                  op.attributes = {};
                  for (let [key, value] of currentAttributes) {
                    if (value !== null) {
                      op.attributes[key] = value;
                    }
                  }
                }
                insert = '';
                break
              case 'retain':
                op = { retain };
                if (Object.keys(attributes).length > 0) {
                  op.attributes = {};
                  for (let key in attributes) {
                    op.attributes[key] = attributes[key];
                  }
                }
                retain = 0;
                break
            }
            delta.push(op);
            action = null;
          }
        };
        while (item !== null) {
          switch (item.constructor) {
            case ItemEmbed:
              if (added.has(item)) {
                addOp();
                action = 'insert';
                insert = item.embed;
                addOp();
              } else if (removed.has(item)) {
                if (action !== 'delete') {
                  addOp();
                  action = 'delete';
                }
                deleteLen += 1;
              } else if (item._deleted === false) {
                if (action !== 'retain') {
                  addOp();
                  action = 'retain';
                }
                retain += 1;
              }
              break
            case ItemString:
              if (added.has(item)) {
                if (action !== 'insert') {
                  addOp();
                  action = 'insert';
                }
                insert += item._content;
              } else if (removed.has(item)) {
                if (action !== 'delete') {
                  addOp();
                  action = 'delete';
                }
                deleteLen += item._length;
              } else if (item._deleted === false) {
                if (action !== 'retain') {
                  addOp();
                  action = 'retain';
                }
                retain += item._length;
              }
              break
            case ItemFormat:
              if (added.has(item)) {
                const curVal = currentAttributes.get(item.key) || null;
                if (curVal !== item.value) {
                  if (action === 'retain') {
                    addOp();
                  }
                  if (item.value === (oldAttributes.get(item.key) || null)) {
                    delete attributes[item.key];
                  } else {
                    attributes[item.key] = item.value;
                  }
                } else {
                  item._delete(y);
                }
              } else if (removed.has(item)) {
                oldAttributes.set(item.key, item.value);
                const curVal = currentAttributes.get(item.key) || null;
                if (curVal !== item.value) {
                  if (action === 'retain') {
                    addOp();
                  }
                  attributes[item.key] = curVal;
                }
              } else if (item._deleted === false) {
                oldAttributes.set(item.key, item.value);
                if (attributes.hasOwnProperty(item.key)) {
                  if (attributes[item.key] !== item.value) {
                    if (action === 'retain') {
                      addOp();
                    }
                    if (item.value === null) {
                      attributes[item.key] = item.value;
                    } else {
                      delete attributes[item.key];
                    }
                  } else {
                    item._delete(y);
                  }
                }
              }
              if (item._deleted === false) {
                if (action === 'insert') {
                  addOp();
                }
                updateCurrentAttributes(currentAttributes, item);
              }
              break
          }
          item = item._right;
        }
        addOp();
        while (this._delta.length > 0) {
          let lastOp = this._delta[this._delta.length - 1];
          if (lastOp.hasOwnProperty('retain') && !lastOp.hasOwnProperty('attributes')) {
            // retain delta's if they don't assign attributes
            this._delta.pop();
          } else {
            break
          }
        }
      });
    }
    return this._delta
  }
}

/**
 * Type that represents text with formatting information.
 *
 * This type replaces y-richtext as this implementation is able to handle
 * block formats (format information on a paragraph), embeds (complex elements
 * like pictures and videos), and text formats (**bold**, *italic*).
 *
 * @param {String} string The initial value of the YText.
 */
class YText extends YArray {
  constructor (string) {
    super();
    if (typeof string === 'string') {
      const start = new ItemString();
      start._parent = this;
      start._content = string;
      this._start = start;
    }
  }

  /**
   * @private
   * Creates YMap Event and calls observers.
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YTextEvent(this, remote, transaction));
  }

  /**
   * Returns the unformatted string representation of this YText type.
   *
   * @public
   */
  toString () {
    let str = '';
    let n = this._start;
    while (n !== null) {
      if (!n._deleted && n._countable) {
        str += n._content;
      }
      n = n._right;
    }
    return str
  }

  /**
   * Apply a {@link Delta} on this shared YText type.
   *
   * @param {Delta} delta The changes to apply on this element.
   *
   * @public
   */
  applyDelta (delta) {
    this._transact(y => {
      let left = null;
      let right = this._start;
      const currentAttributes = new Map();
      for (let i = 0; i < delta.length; i++) {
        let op = delta[i];
        if (op.hasOwnProperty('insert')) {
          [left, right] = insertText(y, op.insert, this, left, right, currentAttributes, op.attributes || {});
        } else if (op.hasOwnProperty('retain')) {
          [left, right] = formatText(y, op.retain, this, left, right, currentAttributes, op.attributes || {});
        } else if (op.hasOwnProperty('delete')) {
          [left, right] = deleteText(y, op.delete, this, left, right, currentAttributes);
        }
      }
    });
  }

  /**
   * Returns the Delta representation of this YText type.
   *
   * @return {Delta} The Delta representation of this type.
   *
   * @public
   */
  toDelta () {
    let ops = [];
    let currentAttributes = new Map();
    let str = '';
    let n = this._start;
    function packStr () {
      if (str.length > 0) {
        // pack str with attributes to ops
        let attributes = {};
        let addAttributes = false;
        for (let [key, value] of currentAttributes) {
          addAttributes = true;
          attributes[key] = value;
        }
        let op = { insert: str };
        if (addAttributes) {
          op.attributes = attributes;
        }
        ops.push(op);
        str = '';
      }
    }
    while (n !== null) {
      if (!n._deleted) {
        switch (n.constructor) {
          case ItemString:
            str += n._content;
            break
          case ItemFormat:
            packStr();
            updateCurrentAttributes(currentAttributes, n);
            break
        }
      }
      n = n._right;
    }
    packStr();
    return ops
  }

  /**
   * Insert text at a given index.
   *
   * @param {Integer} index The index at which to start inserting.
   * @param {String} text The text to insert at the specified position.
   * @param {TextAttributes} attributes Optionally define some formatting
   *                                    information to apply on the inserted
   *                                    Text.
   *
   * @public
   */
  insert (index, text, attributes = {}) {
    if (text.length <= 0) {
      return
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index);
      insertText(y, text, this, left, right, currentAttributes, attributes);
    });
  }

  /**
   * Inserts an embed at a index.
   *
   * @param {Integer} index The index to insert the embed at.
   * @param {Object} embed The Object that represents the embed.
   * @param {TextAttributes} attributes Attribute information to apply on the
   *                                    embed
   *
   * @public
   */
  insertEmbed (index, embed, attributes = {}) {
    if (embed.constructor !== Object) {
      throw new Error('Embed must be an Object')
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index);
      insertText(y, embed, this, left, right, currentAttributes, attributes);
    });
  }

  /**
   * Deletes text starting from an index.
   *
   * @param {Integer} index Index at which to start deleting.
   * @param {Integer} length The number of characters to remove. Defaults to 1.
   *
   * @public
   */
  delete (index, length) {
    if (length === 0) {
      return
    }
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index);
      deleteText(y, length, this, left, right, currentAttributes);
    });
  }

  /**
   * Assigns properties to a range of text.
   *
   * @param {Integer} index The position where to start formatting.
   * @param {Integer} length The amount of characters to assign properties to.
   * @param {TextAttributes} attributes Attribute information to apply on the
   *                                    text.
   *
   * @public
   */
  format (index, length, attributes) {
    this._transact(y => {
      let [left, right, currentAttributes] = findPosition(this, index);
      if (right === null) {
        return
      }
      formatText(y, length, this, left, right, currentAttributes, attributes);
    });
  }
  // TODO: De-duplicate code. The following code is in every type.
  /**
   * Transform this YText to a readable format.
   * Useful for logging as all Items implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('YText', this)
  }
}

/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {Type} parent
 * @param {Type} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
 *
 * @public
 */
function isParentOf (parent, child) {
  child = child._parent;
  while (child !== null) {
    if (child === parent) {
      return true
    }
    child = child._parent;
  }
  return false
}

/**
 * Default filter method (does nothing).
 *
 * @param {String} nodeName The nodeName of the element
 * @param {Map} attrs Map of key-value pairs that are attributes of the node.
 * @return {Map | null} The allowed attributes or null, if the element should be
 *                      filtered.
 */
function defaultFilter (nodeName, attrs) {
  // TODO: implement basic filter that filters out dangerous properties!
  return attrs
}

/**
 *
 */
function filterDomAttributes (dom, filter) {
  const attrs = new Map();
  for (let i = dom.attributes.length - 1; i >= 0; i--) {
    const attr = dom.attributes[i];
    attrs.set(attr.name, attr.value);
  }
  return filter(dom.nodeName, attrs)
}

/**
 * Applies a filter on a type.
 *
 * @param {Y} y The Yjs instance.
 * @param {DomBinding} binding The DOM binding instance that has the dom filter.
 * @param {YXmlElement | YXmlFragment } type The type to apply the filter to.
 *
 * @private
 */
function applyFilterOnType (y, binding, type) {
  if (isParentOf(binding.type, type)) {
    const nodeName = type.nodeName;
    let attributes = new Map();
    if (type.getAttributes !== undefined) {
      let attrs = type.getAttributes();
      for (let key in attrs) {
        attributes.set(key, attrs[key]);
      }
    }
    const filteredAttributes = binding.filter(nodeName, new Map(attributes));
    if (filteredAttributes === null) {
      type._delete(y);
    } else {
      // iterate original attributes
      attributes.forEach((value, key) => {
        // delete all attributes that are not in filteredAttributes
        if (filteredAttributes.has(key) === false) {
          type.removeAttribute(key);
        }
      });
    }
  }
}

/**
 * Creates a Yjs type (YXml) based on the contents of a DOM Element.
 *
 * @param {Element|TextNode} element The DOM Element
 * @param {?Document} _document Optional. Provide the global document object
 * @param {Hooks} [hooks = {}] Optional. Set of Yjs Hooks
 * @param {Filter} [filter=defaultFilter] Optional. Dom element filter
 * @param {?DomBinding} binding Warning: This property is for internal use only!
 * @return {YXmlElement | YXmlText}
 */
function domToType (element, _document = document, hooks = {}, filter = defaultFilter, binding) {
  let type;
  switch (element.nodeType) {
    case _document.ELEMENT_NODE:
      let hookName = null;
      let hook;
      // configure `hookName !== undefined` if element is a hook.
      if (element.hasAttribute('data-yjs-hook')) {
        hookName = element.getAttribute('data-yjs-hook');
        hook = hooks[hookName];
        if (hook === undefined) {
          console.error(`Unknown hook "${hookName}". Deleting yjsHook dataset property.`);
          delete element.removeAttribute('data-yjs-hook');
          hookName = null;
        }
      }
      if (hookName === null) {
        // Not a hook
        const attrs = filterDomAttributes(element, filter);
        if (attrs === null) {
          type = false;
        } else {
          type = new YXmlElement(element.nodeName);
          attrs.forEach((val, key) => {
            type.setAttribute(key, val);
          });
          type.insert(0, domsToTypes(element.childNodes, document, hooks, filter, binding));
        }
      } else {
        // Is a hook
        type = new YXmlHook(hookName);
        hook.fillType(element, type);
      }
      break
    case _document.TEXT_NODE:
      type = new YXmlText();
      type.insert(0, element.nodeValue);
      break
    default:
      throw new Error('Can\'t transform this node type to a YXml type!')
  }
  createAssociation(binding, element, type);
  return type
}

/**
 * Iterates items until an undeleted item is found.
 *
 * @private
 */
function iterateUntilUndeleted (item) {
  while (item !== null && item._deleted) {
    item = item._right;
  }
  return item
}

/**
 * Removes an association (the information that a DOM element belongs to a
 * type).
 *
 * @param {DomBinding} domBinding The binding object
 * @param {Element} dom The dom that is to be associated with type
 * @param {YXmlElement|YXmlHook} type The type that is to be associated with dom
 *
 */
function removeAssociation (domBinding, dom, type) {
  domBinding.domToType.delete(dom);
  domBinding.typeToDom.delete(type);
}

/**
 * Creates an association (the information that a DOM element belongs to a
 * type).
 *
 * @param {DomBinding} domBinding The binding object
 * @param {Element} dom The dom that is to be associated with type
 * @param {YXmlElement|YXmlHook} type The type that is to be associated with dom
 *
 */
function createAssociation (domBinding, dom, type) {
  if (domBinding !== undefined) {
    domBinding.domToType.set(dom, type);
    domBinding.typeToDom.set(type, dom);
  }
}

/**
 * If oldDom is associated with a type, associate newDom with the type and
 * forget about oldDom. If oldDom is not associated with any type, nothing happens.
 *
 * @param {DomBinding} domBinding The binding object
 * @param {Element} oldDom The existing dom
 * @param {Element} newDom The new dom object
 */
function switchAssociation (domBinding, oldDom, newDom) {
  if (domBinding !== undefined) {
    const type = domBinding.domToType.get(oldDom);
    if (type !== undefined) {
      removeAssociation(domBinding, oldDom, type);
      createAssociation(domBinding, newDom, type);
    }
  }
}

/**
 * Insert Dom Elements after one of the children of this YXmlFragment.
 * The Dom elements will be bound to a new YXmlElement and inserted at the
 * specified position.
 *
 * @param {YXmlElement} type The type in which to insert DOM elements.
 * @param {YXmlElement|null} prev The reference node. New YxmlElements are
 *                           inserted after this node. Set null to insert at
 *                           the beginning.
 * @param {Array<Element>} doms The Dom elements to insert.
 * @param {?Document} _document Optional. Provide the global document object.
 * @param {DomBinding} binding The dom binding
 * @return {Array<YXmlElement>} The YxmlElements that are inserted.
 *
 * @private
 */
function insertDomElementsAfter (type, prev, doms, _document, binding) {
  const types = domsToTypes(doms, _document, binding.opts.hooks, binding.filter, binding);
  return type.insertAfter(prev, types)
}

function domsToTypes (doms, _document, hooks, filter, binding) {
  const types = [];
  for (let dom of doms) {
    const t = domToType(dom, _document, hooks, filter, binding);
    if (t !== false) {
      types.push(t);
    }
  }
  return types
}

/**
 * @private
 */
function insertNodeHelper (yxml, prevExpectedNode, child, _document, binding) {
  let insertedNodes = insertDomElementsAfter(yxml, prevExpectedNode, [child], _document, binding);
  if (insertedNodes.length > 0) {
    return insertedNodes[0]
  } else {
    return prevExpectedNode
  }
}

/**
 * Remove children until `elem` is found.
 *
 * @param {Element} parent The parent of `elem` and `currentChild`.
 * @param {Element} currentChild Start removing elements with `currentChild`. If
 *                               `currentChild` is `elem` it won't be removed.
 * @param {Element|null} elem The elemnt to look for.
 *
 * @private
 */
function removeDomChildrenUntilElementFound (parent, currentChild, elem) {
  while (currentChild !== elem) {
    const del = currentChild;
    currentChild = currentChild.nextSibling;
    parent.removeChild(del);
  }
}

/**
 * Define the elements to which a set of CSS queries apply.
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors|CSS_Selectors}
 *
 * @example
 *   query = '.classSelector'
 *   query = 'nodeSelector'
 *   query = '#idSelector'
 *
 * @typedef {string} CSS_Selector
 */

/**
 * Represents a subset of the nodes of a YXmlElement / YXmlFragment and a
 * position within them.
 *
 * Can be created with {@link YXmlFragment#createTreeWalker}
 *
 * @public
 */
class YXmlTreeWalker {
  constructor (root, f) {
    this._filter = f || (() => true);
    this._root = root;
    this._currentNode = root;
    this._firstCall = true;
  }
  [Symbol.iterator] () {
    return this
  }
  /**
   * Get the next node.
   *
   * @return {YXmlElement} The next node.
   *
   * @public
   */
  next () {
    let n = this._currentNode;
    if (this._firstCall) {
      this._firstCall = false;
      if (!n._deleted && this._filter(n)) {
        return { value: n, done: false }
      }
    }
    do {
      if (!n._deleted && (n.constructor === YXmlFragment._YXmlElement || n.constructor === YXmlFragment) && n._start !== null) {
        // walk down in the tree
        n = n._start;
      } else {
        // walk right or up in the tree
        while (n !== this._root) {
          if (n._right !== null) {
            n = n._right;
            break
          }
          n = n._parent;
        }
        if (n === this._root) {
          n = null;
        }
      }
      if (n === this._root) {
        break
      }
    } while (n !== null && (n._deleted || !this._filter(n)))
    this._currentNode = n;
    if (n === null) {
      return { done: true }
    } else {
      return { value: n, done: false }
    }
  }
}

/**
 * An Event that describes changes on a YXml Element or Yxml Fragment
 *
 * @protected
 */
class YXmlEvent extends YEvent {
  /**
   * @param {YType} target The target on which the event is created.
   * @param {Set} subs The set of changed attributes. `null` is included if the
   *                   child list changed.
   * @param {Boolean} remote Whether this change was created by a remote peer.
   * @param {Transaction} transaction The transaction instance with wich the
   *                                  change was created.
   */
  constructor (target, subs, remote, transaction) {
    super(target);
    /**
     * The transaction instance for the computed change.
     * @type {Transaction}
     */
    this._transaction = transaction;
    /**
     * Whether the children changed.
     * @type {Boolean}
     */
    this.childListChanged = false;
    /**
     * Set of all changed attributes.
     * @type {Set}
     */
    this.attributesChanged = new Set();
    /**
     * Whether this change was created by a remote peer.
     * @type {Boolean}
     */
    this.remote = remote;
    subs.forEach((sub) => {
      if (sub === null) {
        this.childListChanged = true;
      } else {
        this.attributesChanged.add(sub);
      }
    });
  }
}

/**
 * Dom filter function.
 *
 * @callback domFilter
 * @param {string} nodeName The nodeName of the element
 * @param {Map} attributes The map of attributes.
 * @return {boolean} Whether to include the Dom node in the YXmlElement.
 */

/**
 * Define the elements to which a set of CSS queries apply.
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors|CSS_Selectors}
 *
 * @example
 *   query = '.classSelector'
 *   query = 'nodeSelector'
 *   query = '#idSelector'
 *
 * @typedef {string} CSS_Selector
 */

/**
 * Represents a list of {@link YXmlElement}.and {@link YXmlText} types.
 * A YxmlFragment is similar to a {@link YXmlElement}, but it does not have a
 * nodeName and it does not have attributes. Though it can be bound to a DOM
 * element - in this case the attributes and the nodeName are not shared.
 *
 * @public
 */
class YXmlFragment extends YArray {
  /**
   * Create a subtree of childNodes.
   *
   * @example
   * const walker = elem.createTreeWalker(dom => dom.nodeName === 'div')
   * for (let node in walker) {
   *   // `node` is a div node
   *   nop(node)
   * }
   *
   * @param {Function} filter Function that is called on each child element and
   *                          returns a Boolean indicating whether the child
   *                          is to be included in the subtree.
   * @return {TreeWalker} A subtree and a position within it.
   *
   * @public
   */
  createTreeWalker (filter) {
    return new YXmlTreeWalker(this, filter)
  }

  /**
   * Returns the first YXmlElement that matches the query.
   * Similar to DOM's {@link querySelector}.
   *
   * Query support:
   *   - tagname
   * TODO:
   *   - id
   *   - attribute
   *
   * @param {CSS_Selector} query The query on the children.
   * @return {?YXmlElement} The first element that matches the query or null.
   *
   * @public
   */
  querySelector (query) {
    query = query.toUpperCase();
    const iterator = new YXmlTreeWalker(this, element => element.nodeName === query);
    const next = iterator.next();
    if (next.done) {
      return null
    } else {
      return next.value
    }
  }

  /**
   * Returns all YXmlElements that match the query.
   * Similar to Dom's {@link querySelectorAll}.
   *
   * TODO: Does not yet support all queries. Currently only query by tagName.
   *
   * @param {CSS_Selector} query The query on the children
   * @return {Array<YXmlElement>} The elements that match this query.
   *
   * @public
   */
  querySelectorAll (query) {
    query = query.toUpperCase();
    return Array.from(new YXmlTreeWalker(this, element => element.nodeName === query))
  }

  /**
   * Creates YArray Event and calls observers.
   *
   * @private
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YXmlEvent(this, parentSubs, remote, transaction));
  }

  /**
   * Get the string representation of all the children of this YXmlFragment.
   *
   * @return {string} The string representation of all children.
   */
  toString () {
    return this.map(xml => xml.toString()).join('')
  }

  /**
   * @private
   * Unbind from Dom and mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   * @param {boolean} [gcChildren=y._hasUndoManager===false] Whether to garbage
   *                                         collect the children of this type.
   *
   * @private
   */
  _delete (y, createDelete, gcChildren) {
    super._delete(y, createDelete, gcChildren);
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<key:hookDefinition>} [hooks={}] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks = {}, binding) {
    const fragment = _document.createDocumentFragment();
    createAssociation(binding, fragment, this);
    this.forEach(xmlType => {
      fragment.insertBefore(xmlType.toDom(_document, hooks, binding), null);
    });
    return fragment
  }
  /**
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  _logString () {
    return logItemHelper('YXml', this)
  }
}

/**
 * An YXmlElement imitates the behavior of a
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}.
 *
 * * An YXmlElement has attributes (key value pairs)
 * * An YXmlElement has childElements that must inherit from YXmlElement
 *
 * @param {String} nodeName Node name
 */
class YXmlElement extends YXmlFragment {
  constructor (nodeName = 'UNDEFINED') {
    super();
    this.nodeName = nodeName.toUpperCase();
  }

  /**
   * @private
   * Creates an Item with the same effect as this Item (without position effect)
   */
  _copy () {
    let struct = super._copy();
    struct.nodeName = this.nodeName;
    return struct
  }

  /**
   * @private
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder);
    this.nodeName = decoder.readVarString();
    return missing
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   *
   * @private
   */
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(this.nodeName);
  }

  /**
   * Integrates this Item into the shared structure.
   *
   * This method actually applies the change to the Yjs instance. In case of
   * Item it connects _left and _right to this Item and calls the
   * {@link Item#beforeChange} method.
   *
   * * Checks for nodeName
   * * Sets domFilter
   *
   * @param {Y} y The Yjs instance
   *
   * @private
   */
  _integrate (y) {
    if (this.nodeName === null) {
      throw new Error('nodeName must be defined!')
    }
    super._integrate(y);
  }

  /**
   * Returns the string representation of this YXmlElement.
   * The attributes are ordered by attribute-name, so you can easily use this
   * method to compare YXmlElements
   *
   * @return {String} The string representation of this type.
   *
   * @public
   */
  toString () {
    const attrs = this.getAttributes();
    const stringBuilder = [];
    const keys = [];
    for (let key in attrs) {
      keys.push(key);
    }
    keys.sort();
    const keysLen = keys.length;
    for (let i = 0; i < keysLen; i++) {
      const key = keys[i];
      stringBuilder.push(key + '="' + attrs[key] + '"');
    }
    const nodeName = this.nodeName.toLocaleLowerCase();
    const attrsString = stringBuilder.length > 0 ? ' ' + stringBuilder.join(' ') : '';
    return `<${nodeName}${attrsString}>${super.toString()}</${nodeName}>`
  }

  /**
   * Removes an attribute from this YXmlElement.
   *
   * @param {String} attributeName The attribute name that is to be removed.
   *
   * @public
   */
  removeAttribute (attributeName) {
    return YMap.prototype.delete.call(this, attributeName)
  }

  /**
   * Sets or updates an attribute.
   *
   * @param {String} attributeName The attribute name that is to be set.
   * @param {String} attributeValue The attribute value that is to be set.
   *
   * @public
   */
  setAttribute (attributeName, attributeValue) {
    return YMap.prototype.set.call(this, attributeName, attributeValue)
  }

  /**
   * Returns an attribute value that belongs to the attribute name.
   *
   * @param {String} attributeName The attribute name that identifies the
   *                               queried value.
   * @return {String} The queried attribute value.
   *
   * @public
   */
  getAttribute (attributeName) {
    return YMap.prototype.get.call(this, attributeName)
  }

  /**
   * Returns all attribute name/value pairs in a JSON Object.
   *
   * @return {Object} A JSON Object that describes the attributes.
   *
   * @public
   */
  getAttributes () {
    const obj = {};
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        obj[key] = value._content[0];
      }
    }
    return obj
  }
  // TODO: outsource the binding property.
  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<key:hookDefinition>} [hooks={}] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type.
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks = {}, binding) {
    const dom = _document.createElement(this.nodeName);
    let attrs = this.getAttributes();
    for (let key in attrs) {
      dom.setAttribute(key, attrs[key]);
    }
    this.forEach(yxml => {
      dom.appendChild(yxml.toDom(_document, hooks, binding));
    });
    createAssociation(binding, dom, this);
    return dom
  }
}

/**
 * You can manage binding to a custom type with YXmlHook.
 *
 * @public
 */
class YXmlHook extends YMap {
  /**
   * @param {String} hookName nodeName of the Dom Node.
   */
  constructor (hookName) {
    super();
    this.hookName = null;
    if (hookName !== undefined) {
      this.hookName = hookName;
    }
  }

  /**
   * Creates an Item with the same effect as this Item (without position effect)
   *
   * @private
   */
  _copy () {
    const struct = super._copy();
    struct.hookName = this.hookName;
    return struct
  }

  /**
   * Creates a Dom Element that mirrors this YXmlElement.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<key:hookDefinition>} [hooks] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks = {}, binding) {
    const hook = hooks[this.hookName];
    let dom;
    if (hook !== undefined) {
      dom = hook.createDom(this);
    } else {
      dom = document.createElement(this.hookName);
    }
    dom.setAttribute('data-yjs-hook', this.hookName);
    createAssociation(binding, dom, this);
    return dom
  }

  /**
   * Read the next Item in a Decoder and fill this Item with the read data.
   *
   * This is called when data is received from a remote peer.
   *
   * @param {Y} y The Yjs instance that this Item belongs to.
   * @param {BinaryDecoder} decoder The decoder object to read data from.
   *
   * @private
   */
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder);
    this.hookName = decoder.readVarString();
    return missing
  }

  /**
   * Transform the properties of this type to binary and write it to an
   * BinaryEncoder.
   *
   * This is called when this Item is sent to a remote peer.
   *
   * @param {BinaryEncoder} encoder The encoder to write data to.
   *
   * @private
   */
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(this.hookName);
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   *
   * @private
   */
  _integrate (y) {
    if (this.hookName === null) {
      throw new Error('hookName must be defined!')
    }
    super._integrate(y);
  }
}

/**
 * Represents text in a Dom Element. In the future this type will also handle
 * simple formatting information like bold and italic.
 *
 * @param {String} arg1 Initial value.
 */
class YXmlText extends YText {
  /**
   * Creates a Dom Element that mirrors this YXmlText.
   *
   * @param {Document} [_document=document] The document object (you must define
   *                                        this when calling this method in
   *                                        nodejs)
   * @param {Object<key:hookDefinition>} [hooks] Optional property to customize how hooks
   *                                             are presented in the DOM
   * @param {DomBinding} [binding] You should not set this property. This is
   *                               used if DomBinding wants to create a
   *                               association to the created DOM type.
   * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
   *
   * @public
   */
  toDom (_document = document, hooks, binding) {
    const dom = _document.createTextNode(this.toString());
    createAssociation(binding, dom, this);
    return dom
  }

  /**
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   * @param {boolean} [gcChildren=y._hasUndoManager===false] Whether to garbage
   *                                         collect the children of this type.
   *
   * @private
   */
  _delete (y, createDelete, gcChildren) {
    super._delete(y, createDelete, gcChildren);
  }
}

YXmlFragment._YXmlElement = YXmlElement;
YXmlFragment._YXmlHook = YXmlHook;

const structs = new Map();
const references = new Map();

/**
 * Register a new Yjs types. The same type must be defined with the same
 * reference on all clients!
 *
 * @param {Number} reference
 * @param {class} structConstructor
 *
 * @public
 */
function registerStruct (reference, structConstructor) {
  structs.set(reference, structConstructor);
  references.set(structConstructor, reference);
}

/**
 * @private
 */
function getStruct (reference) {
  return structs.get(reference)
}

/**
 * @private
 */
function getStructReference (typeConstructor) {
  return references.get(typeConstructor)
}

// TODO: reorder (Item* should have low numbers)
registerStruct(0, ItemJSON);
registerStruct(1, ItemString);
registerStruct(10, ItemFormat);
registerStruct(11, ItemEmbed);
registerStruct(2, Delete);

registerStruct(3, YArray);
registerStruct(4, YMap);
registerStruct(5, YText);
registerStruct(6, YXmlFragment);
registerStruct(7, YXmlElement);
registerStruct(8, YXmlText);
registerStruct(9, YXmlHook);

registerStruct(12, GC);

const RootFakeUserID = 0xFFFFFF;

class RootID {
  constructor (name, typeConstructor) {
    this.user = RootFakeUserID;
    this.name = name;
    this.type = getStructReference(typeConstructor);
  }
  equals (id) {
    return id !== null && id.user === this.user && id.name === this.name && id.type === this.type
  }
  lessThan (id) {
    if (id.constructor === RootID) {
      return this.user < id.user || (this.user === id.user && (this.name < id.name || (this.name === id.name && this.type < id.type)))
    } else {
      return true
    }
  }
}

class OperationStore extends Tree {
  constructor (y) {
    super();
    this.y = y;
  }
  logTable () {
    const items = [];
    this.iterate(null, null, function (item) {
      if (item.constructor === GC) {
        items.push({
          id: logID(item),
          content: item._length,
          deleted: 'GC'
        });
      } else {
        items.push({
          id: logID(item),
          origin: logID(item._origin === null ? null : item._origin._lastId),
          left: logID(item._left === null ? null : item._left._lastId),
          right: logID(item._right),
          right_origin: logID(item._right_origin),
          parent: logID(item._parent),
          parentSub: item._parentSub,
          deleted: item._deleted,
          content: JSON.stringify(item._content)
        });
      }
    });
    console.table(items);
  }
  get (id) {
    let struct = this.find(id);
    if (struct === null && id instanceof RootID) {
      const Constr = getStruct(id.type);
      const y = this.y;
      struct = new Constr();
      struct._id = id;
      struct._parent = y;
      y.transact(() => {
        struct._integrate(y);
      });
      this.put(struct);
    }
    return struct
  }
  // Use getItem for structs with _length > 1
  getItem (id) {
    var item = this.findWithUpperBound(id);
    if (item === null) {
      return null
    }
    const itemID = item._id;
    if (id.user === itemID.user && id.clock < itemID.clock + item._length) {
      return item
    } else {
      return null
    }
  }
  // Return an insertion such that id is the first element of content
  // This function manipulates an item, if necessary
  getItemCleanStart (id) {
    var ins = this.getItem(id);
    if (ins === null || ins._length === 1) {
      return ins
    }
    const insID = ins._id;
    if (insID.clock === id.clock) {
      return ins
    } else {
      return ins._splitAt(this.y, id.clock - insID.clock)
    }
  }
  // Return an insertion such that id is the last element of content
  // This function manipulates an operation, if necessary
  getItemCleanEnd (id) {
    var ins = this.getItem(id);
    if (ins === null || ins._length === 1) {
      return ins
    }
    const insID = ins._id;
    if (insID.clock + ins._length - 1 === id.clock) {
      return ins
    } else {
      ins._splitAt(this.y, id.clock - insID.clock + 1);
      return ins
    }
  }
}

class StateStore {
  constructor (y) {
    this.y = y;
    this.state = new Map();
  }
  logTable () {
    const entries = [];
    for (let [user, state] of this.state) {
      entries.push({
        user, state
      });
    }
    console.table(entries);
  }
  getNextID (len) {
    const user = this.y.userID;
    const state = this.getState(user);
    this.setState(user, state + len);
    return new ID(user, state)
  }
  updateRemoteState (struct) {
    let user = struct._id.user;
    let userState = this.state.get(user);
    while (struct !== null && struct._id.clock === userState) {
      userState += struct._length;
      struct = this.y.os.get(new ID(user, userState));
    }
    this.state.set(user, userState);
  }
  getState (user) {
    let state = this.state.get(user);
    if (state == null) {
      return 0
    }
    return state
  }
  setState (user, state) {
    // TODO: modify missingi structs here
    const beforeState = this.y._transaction.beforeState;
    if (!beforeState.has(user)) {
      beforeState.set(user, this.getState(user));
    }
    this.state.set(user, state);
  }
}

/* global crypto */

function generateRandomUint32 () {
  if (typeof crypto !== 'undefined' && crypto.getRandomValue != null) {
    // browser
    let arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0]
  } else if (typeof crypto !== 'undefined' && crypto.randomBytes != null) {
    // node
    let buf = crypto.randomBytes(4);
    return new Uint32Array(buf.buffer)[0]
  } else {
    return Math.ceil(Math.random() * 0xFFFFFFFF)
  }
}

/**
 * Handles named events.
 */
class NamedEventHandler {
  constructor () {
    this._eventListener = new Map();
    this._stateListener = new Map();
  }

  /**
   * @private
   * Returns all listeners that listen to a specified name.
   *
   * @param {String} name The query event name.
   */
  _getListener (name) {
    let listeners = this._eventListener.get(name);
    if (listeners === undefined) {
      listeners = {
        once: new Set(),
        on: new Set()
      };
      this._eventListener.set(name, listeners);
    }
    return listeners
  }

  /**
   * Adds a named event listener. The listener is removed after it has been
   * called once.
   *
   * @param {String} name The event name to listen to.
   * @param {Function} f The function that is executed when the event is fired.
   */
  once (name, f) {
    let listeners = this._getListener(name);
    listeners.once.add(f);
  }

  /**
   * Adds a named event listener.
   *
   * @param {String} name The event name to listen to.
   * @param {Function} f The function that is executed when the event is fired.
   */
  on (name, f) {
    let listeners = this._getListener(name);
    listeners.on.add(f);
  }

  /**
   * @private
   * Init the saved state for an event name.
   */
  _initStateListener (name) {
    let state = this._stateListener.get(name);
    if (state === undefined) {
      state = {};
      state.promise = new Promise(function (resolve) {
        state.resolve = resolve;
      });
      this._stateListener.set(name, state);
    }
    return state
  }

  /**
   * Returns a Promise that is resolved when the event name is called.
   * The Promise is immediately resolved when the event name was called in the
   * past.
   */
  when (name) {
    return this._initStateListener(name).promise
  }

  /**
   * Remove an event listener that was registered with either
   * {@link EventHandler#on} or {@link EventHandler#once}.
   */
  off (name, f) {
    if (name == null || f == null) {
      throw new Error('You must specify event name and function!')
    }
    const listener = this._eventListener.get(name);
    if (listener !== undefined) {
      listener.on.delete(f);
      listener.once.delete(f);
    }
  }

  /**
   * Emit a named event. All registered event listeners that listen to the
   * specified name will receive the event.
   *
   * @param {String} name The event name.
   * @param {Array} args The arguments that are applied to the event listener.
   */
  emit (name, ...args) {
    this._initStateListener(name).resolve();
    const listener = this._eventListener.get(name);
    if (listener !== undefined) {
      listener.on.forEach(f => f.apply(null, args));
      listener.once.forEach(f => f.apply(null, args));
      listener.once = new Set();
    } else if (name === 'error') {
      console.error(args[0]);
    }
  }
  destroy () {
    this._eventListener = null;
  }
}

// TODO: rename mutex

/**
 * Creates a mutual exclude function with the following property:
 *
 * @example
 * const mutualExclude = createMutualExclude()
 * mutualExclude(function () {
 *   // This function is immediately executed
 *   mutualExclude(function () {
 *     // This function is never executed, as it is called with the same
 *     // mutualExclude
 *   })
 * })
 *
 * @return {Function} A mutual exclude function
 * @public
 */
function createMutualExclude () {
  var token = true;
  return function mutualExclude (f) {
    if (token) {
      token = false;
      try {
        f();
      } catch (e) {
        console.error(e);
      }
      token = true;
    }
  }
}

/**
 * Abstract class for bindings.
 *
 * A binding handles data binding from a Yjs type to a data object. For example,
 * you can bind a Quill editor instance to a YText instance with the `QuillBinding` class.
 *
 * It is expected that a concrete implementation accepts two parameters
 * (type and binding target).
 *
 * @example
 *   const quill = new Quill(document.createElement('div'))
 *   const type = y.define('quill', Y.Text)
 *   const binding = new Y.QuillBinding(quill, type)
 *
 */
class Binding {
  /**
   * @param {YType} type Yjs type.
   * @param {any} target Binding Target.
   */
  constructor (type, target) {
    /**
     * The Yjs type that is bound to `target`
     * @type {YType}
     */
    this.type = type;
    /**
     * The target that `type` is bound to.
     * @type {*}
     */
    this.target = target;
    /**
     * @private
     */
    this._mutualExclude = createMutualExclude();
  }
  /**
   * Remove all data observers (both from the type and the target).
   */
  destroy () {
    this.type = null;
    this.target = null;
  }
}

// TODO: Implement function to describe ranges

/**
 * A relative position that is based on the Yjs model. In contrast to an
 * absolute position (position by index), the relative position can be
 * recomputed when remote changes are received. For example:
 *
 * ```Insert(0, 'x')('a|bc') = 'xa|bc'``` Where | is the cursor position.
 *
 * A relative cursor position can be obtained with the function
 * {@link getRelativePosition} and it can be transformed to an absolute position
 * with {@link fromRelativePosition}.
 *
 * Pro tip: Use this to implement shared cursor locations in YText or YXml!
 * The relative position is {@link encodable}, so you can send it to other
 * clients.
 *
 * @example
 * // Current cursor position is at position 10
 * let relativePosition = getRelativePosition(yText, 10)
 * // modify yText
 * yText.insert(0, 'abc')
 * yText.delete(3, 10)
 * // Compute the cursor position
 * let absolutePosition = fromRelativePosition(y, relativePosition)
 * absolutePosition.type // => yText
 * console.log('cursor location is ' + absolutePosition.offset) // => cursor location is 3
 *
 * @typedef {encodable} RelativePosition
 */

/**
 * Create a relativePosition based on a absolute position.
 *
 * @param {YType} type The base type (e.g. YText or YArray).
 * @param {Integer} offset The absolute position.
 */
function getRelativePosition (type, offset) {
  // TODO: rename to createRelativePosition
  let t = type._start;
  while (t !== null) {
    if (t._deleted === false) {
      if (t._length > offset) {
        return [t._id.user, t._id.clock + offset]
      }
      offset -= t._length;
    }
    t = t._right;
  }
  return ['endof', type._id.user, type._id.clock || null, type._id.name || null, type._id.type || null]
}

/**
 * @typedef {Object} AbsolutePosition The result of {@link fromRelativePosition}
 * @property {YType} type The type on which to apply the absolute position.
 * @property {Integer} offset The absolute offset.r
 */

/**
 * Transforms a relative position back to a relative position.
 *
 * @param {Y} y The Yjs instance in which to query for the absolute position.
 * @param {RelativePosition} rpos The relative position.
 * @return {AbsolutePosition} The absolute position in the Yjs model
 *                            (type + offset).
 */
function fromRelativePosition (y, rpos) {
  if (rpos[0] === 'endof') {
    let id;
    if (rpos[3] === null) {
      id = new ID(rpos[1], rpos[2]);
    } else {
      id = new RootID(rpos[3], rpos[4]);
    }
    const type = y.os.get(id);
    if (type === null || type.constructor === GC) {
      return null
    }
    return {
      type,
      offset: type.length
    }
  } else {
    let offset = 0;
    let struct = y.os.findNodeWithUpperBound(new ID(rpos[0], rpos[1])).val;
    const parent = struct._parent;
    if (struct.constructor === GC || parent._deleted) {
      return null
    }
    if (!struct._deleted) {
      offset = rpos[1] - struct._id.clock;
    }
    struct = struct._left;
    while (struct !== null) {
      if (!struct._deleted) {
        offset += struct._length;
      }
      struct = struct._left;
    }
    return {
      type: parent,
      offset: offset
    }
  }
}

/* globals getSelection */

let browserSelection = null;
let relativeSelection = null;

/**
 * @private
 */
let beforeTransactionSelectionFixer;
if (typeof getSelection !== 'undefined') {
  beforeTransactionSelectionFixer = function _beforeTransactionSelectionFixer (y, domBinding, transaction, remote) {
    if (!remote) {
      return
    }
    relativeSelection = { from: null, to: null, fromY: null, toY: null };
    browserSelection = getSelection();
    const anchorNode = browserSelection.anchorNode;
    const anchorNodeType = domBinding.domToType.get(anchorNode);
    if (anchorNode !== null && anchorNodeType !== undefined) {
      relativeSelection.from = getRelativePosition(anchorNodeType, browserSelection.anchorOffset);
      relativeSelection.fromY = anchorNodeType._y;
    }
    const focusNode = browserSelection.focusNode;
    const focusNodeType = domBinding.domToType.get(focusNode);
    if (focusNode !== null && focusNodeType !== undefined) {
      relativeSelection.to = getRelativePosition(focusNodeType, browserSelection.focusOffset);
      relativeSelection.toY = focusNodeType._y;
    }
  };
} else {
  beforeTransactionSelectionFixer = function _fakeBeforeTransactionSelectionFixer () {};
}

/**
 * @private
 */
function afterTransactionSelectionFixer (y, domBinding, transaction, remote) {
  if (relativeSelection === null || !remote) {
    return
  }
  const to = relativeSelection.to;
  const from = relativeSelection.from;
  const fromY = relativeSelection.fromY;
  const toY = relativeSelection.toY;
  let shouldUpdate = false;
  let anchorNode = browserSelection.anchorNode;
  let anchorOffset = browserSelection.anchorOffset;
  let focusNode = browserSelection.focusNode;
  let focusOffset = browserSelection.focusOffset;
  if (from !== null) {
    let sel = fromRelativePosition(fromY, from);
    if (sel !== null) {
      let node = domBinding.typeToDom.get(sel.type);
      let offset = sel.offset;
      if (node !== anchorNode || offset !== anchorOffset) {
        anchorNode = node;
        anchorOffset = offset;
        shouldUpdate = true;
      }
    }
  }
  if (to !== null) {
    let sel = fromRelativePosition(toY, to);
    if (sel !== null) {
      let node = domBinding.typeToDom.get(sel.type);
      let offset = sel.offset;
      if (node !== focusNode || offset !== focusOffset) {
        focusNode = node;
        focusOffset = offset;
        shouldUpdate = true;
      }
    }
  }
  if (shouldUpdate) {
    browserSelection.setBaseAndExtent(
      anchorNode,
      anchorOffset,
      focusNode,
      focusOffset
    );
  }
}

/* global getSelection */

function findScrollReference (scrollingElement) {
  if (scrollingElement !== null) {
    let anchor = getSelection().anchorNode;
    if (anchor == null) {
      let children = scrollingElement.children; // only iterate through non-text nodes
      for (let i = 0; i < children.length; i++) {
        const elem = children[i];
        const rect = elem.getBoundingClientRect();
        if (rect.top >= 0) {
          return { elem, top: rect.top }
        }
      }
    } else {
      if (anchor.nodeType === document.TEXT_NODE) {
        anchor = anchor.parentElement;
      }
      const top = anchor.getBoundingClientRect().top;
      return { elem: anchor, top: top }
    }
  }
  return null
}

function fixScroll (scrollingElement, ref) {
  if (ref !== null) {
    const { elem, top } = ref;
    const currentTop = elem.getBoundingClientRect().top;
    const newScroll = scrollingElement.scrollTop + currentTop - top;
    if (newScroll >= 0) {
      scrollingElement.scrollTop = newScroll;
    }
  }
}

/**
 * @private
 */
function typeObserver (events) {
  this._mutualExclude(() => {
    const scrollRef = findScrollReference(this.scrollingElement);
    events.forEach(event => {
      const yxml = event.target;
      const dom = this.typeToDom.get(yxml);
      if (dom !== undefined && dom !== false) {
        if (yxml.constructor === YXmlText) {
          dom.nodeValue = yxml.toString();
          // TODO: use hasOwnProperty instead of === undefined check
        } else if (event.attributesChanged !== undefined) {
          // update attributes
          event.attributesChanged.forEach(attributeName => {
            const value = yxml.getAttribute(attributeName);
            if (value === undefined) {
              dom.removeAttribute(attributeName);
            } else {
              dom.setAttribute(attributeName, value);
            }
          });
          /*
           * TODO: instead of hard-checking the types, it would be best to
           *       specify the type's features. E.g.
           *         - _yxmlHasAttributes
           *         - _yxmlHasChildren
           *       Furthermore, the features shouldn't be encoded in the types,
           *       only in the attributes (above)
           */
          if (event.childListChanged && yxml.constructor !== YXmlHook) {
            let currentChild = dom.firstChild;
            yxml.forEach(childType => {
              const childNode = this.typeToDom.get(childType);
              switch (childNode) {
                case undefined:
                  // Does not exist. Create it.
                  const node = childType.toDom(this.opts.document, this.opts.hooks, this);
                  dom.insertBefore(node, currentChild);
                  break
                case false:
                  // nop
                  break
                default:
                  // Is already attached to the dom.
                  // Find it and remove all dom nodes in-between.
                  removeDomChildrenUntilElementFound(dom, currentChild, childNode);
                  currentChild = childNode.nextSibling;
                  break
              }
            });
            removeDomChildrenUntilElementFound(dom, currentChild, null);
          }
        }
      }
    });
    fixScroll(this.scrollingElement, scrollRef);
  });
}

/**
 * A SimpleDiff describes a change on a String.
 *
 * @example
 * console.log(a) // the old value
 * console.log(b) // the updated value
 * // Apply changes of diff (pseudocode)
 * a.remove(diff.pos, diff.remove) // Remove `diff.remove` characters
 * a.insert(diff.pos, diff.insert) // Insert `diff.insert`
 * a === b // values match
 *
 * @typedef {Object} SimpleDiff
 * @property {Number} pos The index where changes were applied
 * @property {Number} delete The number of characters to delete starting
 *                                  at `index`.
 * @property {String} insert The new text to insert at `index` after applying
 *                           `delete`
 */

/**
 * Create a diff between two strings. This diff implementation is highly
 * efficient, but not very sophisticated.
 *
 * @public
 * @param {String} a The old version of the string
 * @param {String} b The updated version of the string
 * @return {SimpleDiff} The diff description.
 */
function simpleDiff (a, b) {
  let left = 0; // number of same characters counting from left
  let right = 0; // number of same characters counting from right
  while (left < a.length && left < b.length && a[left] === b[left]) {
    left++;
  }
  if (left !== a.length || left !== b.length) {
    // Only check right if a !== b
    while (right + left < a.length && right + left < b.length && a[a.length - right - 1] === b[b.length - right - 1]) {
      right++;
    }
  }
  return {
    pos: left, // TODO: rename to index (also in type above)
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  }
}

/**
 * 1. Check if any of the nodes was deleted
 * 2. Iterate over the children.
 *    2.1 If a node exists that is not yet bound to a type, insert a new node
 *    2.2 If _contents.length < dom.childNodes.length, fill the
 *        rest of _content with childNodes
 *    2.3 If a node was moved, delete it and
 *       recreate a new yxml element that is bound to that node.
 *       You can detect that a node was moved because expectedId
 *       !== actualId in the list
 * @private
 */
function applyChangesFromDom (binding, dom, yxml, _document) {
  if (yxml == null || yxml === false || yxml.constructor === YXmlHook) {
    return
  }
  const y = yxml._y;
  const knownChildren = new Set();
  for (let i = dom.childNodes.length - 1; i >= 0; i--) {
    const type = binding.domToType.get(dom.childNodes[i]);
    if (type !== undefined && type !== false) {
      knownChildren.add(type);
    }
  }
  // 1. Check if any of the nodes was deleted
  yxml.forEach(function (childType) {
    if (knownChildren.has(childType) === false) {
      childType._delete(y);
      removeAssociation(binding, binding.typeToDom.get(childType), childType);
    }
  });
  // 2. iterate
  const childNodes = dom.childNodes;
  const len = childNodes.length;
  let prevExpectedType = null;
  let expectedType = iterateUntilUndeleted(yxml._start);
  for (let domCnt = 0; domCnt < len; domCnt++) {
    const childNode = childNodes[domCnt];
    const childType = binding.domToType.get(childNode);
    if (childType !== undefined) {
      if (childType === false) {
        // should be ignored or is going to be deleted
        continue
      }
      if (expectedType !== null) {
        if (expectedType !== childType) {
          // 2.3 Not expected node
          if (childType._parent !== yxml) {
            // child was moved from another parent
            // childType is going to be deleted by its previous parent
            removeAssociation(binding, childNode, childType);
          } else {
            // child was moved to a different position.
            removeAssociation(binding, childNode, childType);
            childType._delete(y);
          }
          prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode, _document, binding);
        } else {
          // Found expected node. Continue.
          prevExpectedType = expectedType;
          expectedType = iterateUntilUndeleted(expectedType._right);
        }
      } else {
        // 2.2 Fill _content with child nodes
        prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode, _document, binding);
      }
    } else {
      // 2.1 A new node was found
      prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode, _document, binding);
    }
  }
}

/**
 * @private
 */
function domObserver (mutations, _document) {
  this._mutualExclude(() => {
    this.type._y.transact(() => {
      let diffChildren = new Set();
      mutations.forEach(mutation => {
        const dom = mutation.target;
        const yxml = this.domToType.get(dom);
        if (yxml === undefined) { // In case yxml is undefined, we double check if we forgot to bind the dom
          let parent = dom;
          let yParent;
          do {
            parent = parent.parentNode;
            yParent = this.domToType.get(parent);
          } while (yParent === undefined && parent !== null)
          if (yParent !== false && yParent !== undefined && yParent.constructor !== YXmlHook) {
            diffChildren.add(parent);
          }
          return
        } else if (yxml === false || yxml.constructor === YXmlHook) {
          // dom element is filtered / a dom hook
          return
        }
        switch (mutation.type) {
          case 'characterData':
            var change = simpleDiff(yxml.toString(), dom.nodeValue);
            yxml.delete(change.pos, change.remove);
            yxml.insert(change.pos, change.insert);
            break
          case 'attributes':
            if (yxml.constructor === YXmlFragment) {
              break
            }
            let name = mutation.attributeName;
            let val = dom.getAttribute(name);
            // check if filter accepts attribute
            let attributes = new Map();
            attributes.set(name, val);
            if (yxml.constructor !== YXmlFragment && this.filter(dom.nodeName, attributes).size > 0) {
              if (yxml.getAttribute(name) !== val) {
                if (val == null) {
                  yxml.removeAttribute(name);
                } else {
                  yxml.setAttribute(name, val);
                }
              }
            }
            break
          case 'childList':
            diffChildren.add(mutation.target);
            break
        }
      });
      for (let dom of diffChildren) {
        const yxml = this.domToType.get(dom);
        applyChangesFromDom(this, dom, yxml, _document);
      }
    });
  });
}

/* global MutationObserver */

/**
 * A binding that binds the children of a YXmlFragment to a DOM element.
 *
 * This binding is automatically destroyed when its parent is deleted.
 *
 * @example
 * const div = document.createElement('div')
 * const type = y.define('xml', Y.XmlFragment)
 * const binding = new Y.QuillBinding(type, div)
 *
 */
class DomBinding extends Binding {
  /**
   * @param {YXmlFragment} type The bind source. This is the ultimate source of
   *                            truth.
   * @param {Element} target The bind target. Mirrors the target.
   * @param {Object} [opts] Optional configurations

   * @param {FilterFunction} [opts.filter=defaultFilter] The filter function to use.
   */
  constructor (type, target, opts = {}) {
    // Binding handles textType as this.type and domTextarea as this.target
    super(type, target);
    this.opts = opts;
    opts.document = opts.document || document;
    opts.hooks = opts.hooks || {};
    this.scrollingElement = opts.scrollingElement || null;
    /**
     * Maps each DOM element to the type that it is associated with.
     * @type {Map}
     */
    this.domToType = new Map();
    /**
     * Maps each YXml type to the DOM element that it is associated with.
     * @type {Map}
     */
    this.typeToDom = new Map();
    /**
     * Defines which DOM attributes and elements to filter out.
     * Also filters remote changes.
     * @type {FilterFunction}
     */
    this.filter = opts.filter || defaultFilter;
    // set initial value
    target.innerHTML = '';
    type.forEach(child => {
      target.insertBefore(child.toDom(opts.document, opts.hooks, this), null);
    });
    this._typeObserver = typeObserver.bind(this);
    this._domObserver = (mutations) => {
      domObserver.call(this, mutations, opts.document);
    };
    type.observeDeep(this._typeObserver);
    this._mutationObserver = new MutationObserver(this._domObserver);
    this._mutationObserver.observe(target, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    });
    const y = type._y;
    // Force flush dom changes before Type changes are applied (they might
    // modify the dom)
    this._beforeTransactionHandler = (y, transaction, remote) => {
      this._domObserver(this._mutationObserver.takeRecords());
      beforeTransactionSelectionFixer(y, this, transaction, remote);
    };
    y.on('beforeTransaction', this._beforeTransactionHandler);
    this._afterTransactionHandler = (y, transaction, remote) => {
      afterTransactionSelectionFixer(y, this, transaction, remote);
      // remove associations
      // TODO: this could be done more efficiently
      // e.g. Always delete using the following approach, or removeAssociation
      // in dom/type-observer..
      transaction.deletedStructs.forEach(type => {
        const dom = this.typeToDom.get(type);
        if (dom !== undefined) {
          removeAssociation(this, dom, type);
        }
      });
    };
    y.on('afterTransaction', this._afterTransactionHandler);
    // Before calling observers, apply dom filter to all changed and new types.
    this._beforeObserverCallsHandler = (y, transaction) => {
      // Apply dom filter to new and changed types
      transaction.changedTypes.forEach((subs, type) => {
        // Only check attributes. New types are filtered below.
        if ((subs.size > 1 || (subs.size === 1 && subs.has(null) === false))) {
          applyFilterOnType(y, this, type);
        }
      });
      transaction.newTypes.forEach(type => {
        applyFilterOnType(y, this, type);
      });
    };
    y.on('beforeObserverCalls', this._beforeObserverCallsHandler);
    createAssociation(this, target, type);
  }

  /**
   * NOTE: currently does not apply filter to existing elements!
   * @param {FilterFunction} filter The filter function to use from now on.
   */
  setFilter (filter) {
    this.filter = filter;
    // TODO: apply filter to all elements
  }

  /**
   * Remove all properties that are handled by this class.
   */
  destroy () {
    this.domToType = null;
    this.typeToDom = null;
    this.type.unobserve(this._typeObserver);
    this._mutationObserver.disconnect();
    const y = this.type._y;
    y.off('beforeTransaction', this._beforeTransactionHandler);
    y.off('beforeObserverCalls', this._beforeObserverCallsHandler);
    y.off('afterObserverCalls', this._afterObserverCallsHandler);
    y.off('afterTransaction', this._afterTransactionHandler);
    super.destroy();
  }
}

  /**
   * A filter defines which elements and attributes to share.
   * Return null if the node should be filtered. Otherwise return the Map of
   * accepted attributes.
   *
   * @typedef {function(nodeName: String, attrs: Map): Map|null} FilterFunction
   */

/**
 * Anything that can be encoded with `JSON.stringify` and can be decoded with
 * `JSON.parse`.
 *
 * The following property should hold:
 * `JSON.parse(JSON.stringify(key))===key`
 *
 * At the moment the only safe values are number and string.
 *
 * @typedef {(number|string)} encodable
 */

/**
 * A Yjs instance handles the state of shared data.
 *
 * @param {string} room Users in the same room share the same content
 * @param {Object} opts Connector definition
 * @param {AbstractPersistence} persistence Persistence adapter instance
 */
class Y$1 extends NamedEventHandler {
  constructor (room, opts, persistence, conf = {}) {
    super();
    this.gcEnabled = conf.gc || false;
    /**
     * The room name that this Yjs instance connects to.
     * @type {String}
     */
    this.room = room;
    if (opts != null) {
      opts.connector.room = room;
    }
    this._contentReady = false;
    this._opts = opts;
    if (typeof opts.userID !== 'number') {
      this.userID = generateRandomUint32();
    } else {
      this.userID = opts.userID;
    }
    // TODO: This should be a Map so we can use encodables as keys
    this.share = {};
    this.ds = new DeleteStore(this);
    this.os = new OperationStore(this);
    this.ss = new StateStore(this);
    this._missingStructs = new Map();
    this._readyToIntegrate = [];
    this._transaction = null;
    /**
     * The {@link AbstractConnector}.that is used by this Yjs instance.
     * @type {AbstractConnector}
     */
    this.connector = null;
    this.connected = false;
    let initConnection = () => {
      if (opts != null) {
        this.connector = new Y$1[opts.connector.name](this, opts.connector);
        this.connected = true;
        this.emit('connectorReady');
      }
    };
    /**
     * The {@link AbstractPersistence} that is used by this Yjs instance.
     * @type {AbstractPersistence}
     */
    this.persistence = null;
    if (persistence != null) {
      this.persistence = persistence;
      persistence._init(this).then(initConnection);
    } else {
      initConnection();
    }
    // for compatibility with isParentOf
    this._parent = null;
    this._hasUndoManager = false;
  }
  _setContentReady () {
    if (!this._contentReady) {
      this._contentReady = true;
      this.emit('content');
    }
  }
  whenContentReady () {
    if (this._contentReady) {
      return Promise.resolve()
    } else {
      return new Promise(resolve => {
        this.once('content', resolve);
      })
    }
  }
  _beforeChange () {}
  /**
   * Changes that happen inside of a transaction are bundled. This means that
   * the observer fires _after_ the transaction is finished and that all changes
   * that happened inside of the transaction are sent as one message to the
   * other peers.
   *
   * @param {Function} f The function that should be executed as a transaction
   * @param {?Boolean} remote Optional. Whether this transaction is initiated by
   *                          a remote peer. This should not be set manually!
   *                          Defaults to false.
   */
  transact (f, remote = false) {
    let initialCall = this._transaction === null;
    if (initialCall) {
      this._transaction = new Transaction(this);
      this.emit('beforeTransaction', this, this._transaction, remote);
    }
    try {
      f(this);
    } catch (e) {
      console.error(e);
    }
    if (initialCall) {
      this.emit('beforeObserverCalls', this, this._transaction, remote);
      const transaction = this._transaction;
      this._transaction = null;
      // emit change events on changed types
      transaction.changedTypes.forEach(function (subs, type) {
        if (!type._deleted) {
          type._callObserver(transaction, subs, remote);
        }
      });
      transaction.changedParentTypes.forEach(function (events, type) {
        if (!type._deleted) {
          events = events
            .filter(event =>
              !event.target._deleted
            );
          events
            .forEach(event => {
              event.currentTarget = type;
            });
          // we don't have to check for events.length
          // because there is no way events is empty..
          type._deepEventHandler.callEventListeners(transaction, events);
        }
      });
      // when all changes & events are processed, emit afterTransaction event
      this.emit('afterTransaction', this, transaction, remote);
    }
  }

  /**
   * @private
   * Fake _start for root properties (y.set('name', type))
   */
  get _start () {
    return null
  }

  /**
   * @private
   * Fake _start for root properties (y.set('name', type))
   */
  set _start (start) {
    return null
  }

  /**
   * Define a shared data type.
   *
   * Multiple calls of `y.define(name, TypeConstructor)` yield the same result
   * and do not overwrite each other. I.e.
   * `y.define(name, type) === y.define(name, type)`
   *
   * After this method is called, the type is also available on `y.share[name]`.
   *
   * *Best Practices:*
   * Either define all types right after the Yjs instance is created or always
   * use `y.define(..)` when accessing a type.
   *
   * @example
   *   // Option 1
   *   const y = new Y(..)
   *   y.define('myArray', YArray)
   *   y.define('myMap', YMap)
   *   // .. when accessing the type use y.share[name]
   *   y.share.myArray.insert(..)
   *   y.share.myMap.set(..)
   *
   *   // Option2
   *   const y = new Y(..)
   *   // .. when accessing the type use `y.define(..)`
   *   y.define('myArray', YArray).insert(..)
   *   y.define('myMap', YMap).set(..)
   *
   * @param {String} name
   * @param {YType Constructor} TypeConstructor The constructor of the type definition
   * @returns {YType} The created type
   */
  define (name, TypeConstructor) {
    let id = new RootID(name, TypeConstructor);
    let type = this.os.get(id);
    if (this.share[name] === undefined) {
      this.share[name] = type;
    } else if (this.share[name] !== type) {
      throw new Error('Type is already defined with a different constructor')
    }
    return type
  }

  /**
   * Get a defined type. The type must be defined locally. First define the
   * type with {@link define}.
   *
   * This returns the same value as `y.share[name]`
   *
   * @param {String} name The typename
   */
  get (name) {
    return this.share[name]
  }

  /**
   * Disconnect this Yjs Instance from the network. The connector will
   * unsubscribe from the room and document updates are not shared anymore.
   */
  disconnect () {
    if (this.connected) {
      this.connected = false;
      return this.connector.disconnect()
    } else {
      return Promise.resolve()
    }
  }

  /**
   * If disconnected, tell the connector to reconnect to the room.
   */
  reconnect () {
    if (!this.connected) {
      this.connected = true;
      return this.connector.reconnect()
    } else {
      return Promise.resolve()
    }
  }

  /**
   * Disconnect from the room, and destroy all traces of this Yjs instance.
   * Persisted data will remain until removed by the persistence adapter.
   */
  destroy () {
    super.destroy();
    this.share = null;
    if (this.connector != null) {
      if (this.connector.destroy != null) {
        this.connector.destroy();
      } else {
        this.connector.disconnect();
      }
    }
    if (this.persistence !== null) {
      this.persistence.deinit(this);
      this.persistence = null;
    }
    this.os = null;
    this.ds = null;
    this.ss = null;
  }
}

Y$1.extend = function extendYjs () {
  for (var i = 0; i < arguments.length; i++) {
    var f = arguments[i];
    if (typeof f === 'function') {
      f(Y$1);
    } else {
      throw new Error('Expected a function!')
    }
  }
};

class ReverseOperation {
  constructor (y, transaction) {
    this.created = new Date();
    const beforeState = transaction.beforeState;
    if (beforeState.has(y.userID)) {
      this.toState = new ID(y.userID, y.ss.getState(y.userID) - 1);
      this.fromState = new ID(y.userID, beforeState.get(y.userID));
    } else {
      this.toState = null;
      this.fromState = null;
    }
    this.deletedStructs = transaction.deletedStructs;
  }
}

function applyReverseOperation (y, scope, reverseBuffer) {
  let performedUndo = false;
  y.transact(() => {
    while (!performedUndo && reverseBuffer.length > 0) {
      let undoOp = reverseBuffer.pop();
      // make sure that it is possible to iterate {from}-{to}
      if (undoOp.fromState !== null) {
        y.os.getItemCleanStart(undoOp.fromState);
        y.os.getItemCleanEnd(undoOp.toState);
        y.os.iterate(undoOp.fromState, undoOp.toState, op => {
          while (op._deleted && op._redone !== null) {
            op = op._redone;
          }
          if (op._deleted === false && isParentOf(scope, op)) {
            performedUndo = true;
            op._delete(y);
          }
        });
      }
      for (let op of undoOp.deletedStructs) {
        if (
          isParentOf(scope, op) &&
          op._parent !== y &&
          (
            op._id.user !== y.userID ||
            undoOp.fromState === null ||
            op._id.clock < undoOp.fromState.clock ||
            op._id.clock > undoOp.toState.clock
          )
        ) {
          performedUndo = true;
          op._redo(y);
        }
      }
    }
  });
  return performedUndo
}

/**
 * Saves a history of locally applied operations. The UndoManager handles the
 * undoing and redoing of locally created changes.
 */
class UndoManager {
  /**
   * @param {YType} scope The scope on which to listen for changes.
   * @param {Object} options Optionally provided configuration.
   */
  constructor (scope, options = {}) {
    this.options = options;
    options.captureTimeout = options.captureTimeout == null ? 500 : options.captureTimeout;
    this._undoBuffer = [];
    this._redoBuffer = [];
    this._scope = scope;
    this._undoing = false;
    this._redoing = false;
    this._lastTransactionWasUndo = false;
    const y = scope._y;
    this.y = y;
    y._hasUndoManager = true;
    y.on('afterTransaction', (y, transaction, remote) => {
      if (!remote && transaction.changedParentTypes.has(scope)) {
        let reverseOperation = new ReverseOperation(y, transaction);
        if (!this._undoing) {
          let lastUndoOp = this._undoBuffer.length > 0 ? this._undoBuffer[this._undoBuffer.length - 1] : null;
          if (
            this._redoing === false &&
            this._lastTransactionWasUndo === false &&
            lastUndoOp !== null &&
            reverseOperation.created - lastUndoOp.created <= options.captureTimeout
          ) {
            lastUndoOp.created = reverseOperation.created;
            if (reverseOperation.toState !== null) {
              lastUndoOp.toState = reverseOperation.toState;
              if (lastUndoOp.fromState === null) {
                lastUndoOp.fromState = reverseOperation.fromState;
              }
            }
            reverseOperation.deletedStructs.forEach(lastUndoOp.deletedStructs.add, lastUndoOp.deletedStructs);
          } else {
            this._lastTransactionWasUndo = false;
            this._undoBuffer.push(reverseOperation);
          }
          if (!this._redoing) {
            this._redoBuffer = [];
          }
        } else {
          this._lastTransactionWasUndo = true;
          this._redoBuffer.push(reverseOperation);
        }
      }
    });
  }

  /**
   * Undo the last locally created change.
   */
  undo () {
    this._undoing = true;
    const performedUndo = applyReverseOperation(this.y, this._scope, this._undoBuffer);
    this._undoing = false;
    return performedUndo
  }

  /**
   * Redo the last locally created change.
   */
  redo () {
    this._redoing = true;
    const performedRedo = applyReverseOperation(this.y, this._scope, this._redoBuffer);
    this._redoing = false;
    return performedRedo
  }
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var ms = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

var debug$1 = createCommonjsModule(function (module, exports) {
/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = ms;

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms$$1 = curr - (prevTime || curr);
    self.diff = ms$$1;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}
});

var debug_1 = debug$1.coerce;
var debug_2 = debug$1.disable;
var debug_3 = debug$1.enable;
var debug_4 = debug$1.enabled;
var debug_5 = debug$1.humanize;
var debug_6 = debug$1.names;
var debug_7 = debug$1.skips;
var debug_8 = debug$1.formatters;

var browser = createCommonjsModule(function (module, exports) {
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug$1;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit');

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}
});

var browser_1 = browser.log;
var browser_2 = browser.formatArgs;
var browser_3 = browser.save;
var browser_4 = browser.load;
var browser_5 = browser.useColors;
var browser_6 = browser.storage;
var browser_7 = browser.colors;

// TODO: rename Connector

class AbstractConnector {
  constructor (y, opts) {
    this.y = y;
    this.opts = opts;
    if (opts.role == null || opts.role === 'master') {
      this.role = 'master';
    } else if (opts.role === 'slave') {
      this.role = 'slave';
    } else {
      throw new Error("Role must be either 'master' or 'slave'!")
    }
    this.log = browser('y:connector');
    this.logMessage = browser('y:connector-message');
    this._forwardAppliedStructs = opts.forwardAppliedOperations || false; // TODO: rename
    this.role = opts.role;
    this.connections = new Map();
    this.isSynced = false;
    this.userEventListeners = [];
    this.whenSyncedListeners = [];
    this.currentSyncTarget = null;
    this.debug = opts.debug === true;
    this.broadcastBuffer = new BinaryEncoder();
    this.broadcastBufferSize = 0;
    this.protocolVersion = 11;
    this.authInfo = opts.auth || null;
    this.checkAuth = opts.checkAuth || function () { return Promise.resolve('write') }; // default is everyone has write access
    if (opts.maxBufferLength == null) {
      this.maxBufferLength = -1;
    } else {
      this.maxBufferLength = opts.maxBufferLength;
    }
  }

  reconnect () {
    this.log('reconnecting..');
  }

  disconnect () {
    this.log('discronnecting..');
    this.connections = new Map();
    this.isSynced = false;
    this.currentSyncTarget = null;
    this.whenSyncedListeners = [];
    return Promise.resolve()
  }

  onUserEvent (f) {
    this.userEventListeners.push(f);
  }

  removeUserEventListener (f) {
    this.userEventListeners = this.userEventListeners.filter(g => f !== g);
  }

  userLeft (user) {
    if (this.connections.has(user)) {
      this.log('%s: User left %s', this.y.userID, user);
      this.connections.delete(user);
      // check if isSynced event can be sent now
      this._setSyncedWith(null);
      for (var f of this.userEventListeners) {
        f({
          action: 'userLeft',
          user: user
        });
      }
    }
  }

  userJoined (user, role, auth) {
    if (role == null) {
      throw new Error('You must specify the role of the joined user!')
    }
    if (this.connections.has(user)) {
      throw new Error('This user already joined!')
    }
    this.log('%s: User joined %s', this.y.userID, user);
    this.connections.set(user, {
      uid: user,
      isSynced: false,
      role: role,
      processAfterAuth: [],
      processAfterSync: [],
      auth: auth || null,
      receivedSyncStep2: false
    });
    let defer = {};
    defer.promise = new Promise(function (resolve) { defer.resolve = resolve; });
    this.connections.get(user).syncStep2 = defer;
    for (var f of this.userEventListeners) {
      f({
        action: 'userJoined',
        user: user,
        role: role
      });
    }
    this._syncWithUser(user);
  }

  // Execute a function _when_ we are connected.
  // If not connected, wait until connected
  whenSynced (f) {
    if (this.isSynced) {
      f();
    } else {
      this.whenSyncedListeners.push(f);
    }
  }

  _syncWithUser (userID) {
    if (this.role === 'slave') {
      return // "The current sync has not finished or this is controlled by a master!"
    }
    sendSyncStep1(this, userID);
  }

  _fireIsSyncedListeners () {
    if (!this.isSynced) {
      this.isSynced = true;
      // It is safer to remove this!
      // call whensynced listeners
      for (var f of this.whenSyncedListeners) {
        f();
      }
      this.whenSyncedListeners = [];
      this.y._setContentReady();
      this.y.emit('synced');
    }
  }

  send (uid, buffer) {
    const y = this.y;
    if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
      throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - don\'t use this method to send custom messages')
    }
    this.log('User%s to User%s: Send \'%y\'', y.userID, uid, buffer);
    this.logMessage('User%s to User%s: Send %Y', y.userID, uid, [y, buffer]);
  }

  broadcast (buffer) {
    const y = this.y;
    if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
      throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - don\'t use this method to send custom messages')
    }
    this.log('User%s: Broadcast \'%y\'', y.userID, buffer);
    this.logMessage('User%s: Broadcast: %Y', y.userID, [y, buffer]);
  }

  /*
    Buffer operations, and broadcast them when ready.
  */
  broadcastStruct (struct) {
    const firstContent = this.broadcastBuffer.length === 0;
    if (firstContent) {
      this.broadcastBuffer.writeVarString(this.y.room);
      this.broadcastBuffer.writeVarString('update');
      this.broadcastBufferSize = 0;
      this.broadcastBufferSizePos = this.broadcastBuffer.pos;
      this.broadcastBuffer.writeUint32(0);
    }
    this.broadcastBufferSize++;
    struct._toBinary(this.broadcastBuffer);
    if (this.maxBufferLength > 0 && this.broadcastBuffer.length > this.maxBufferLength) {
      // it is necessary to send the buffer now
      // cache the buffer and check if server is responsive
      const buffer = this.broadcastBuffer;
      buffer.setUint32(this.broadcastBufferSizePos, this.broadcastBufferSize);
      this.broadcastBuffer = new BinaryEncoder();
      this.whenRemoteResponsive().then(() => {
        this.broadcast(buffer.createBuffer());
      });
    } else if (firstContent) {
      // send the buffer when all transactions are finished
      // (or buffer exceeds maxBufferLength)
      setTimeout(() => {
        if (this.broadcastBuffer.length > 0) {
          const buffer = this.broadcastBuffer;
          buffer.setUint32(this.broadcastBufferSizePos, this.broadcastBufferSize);
          this.broadcast(buffer.createBuffer());
          this.broadcastBuffer = new BinaryEncoder();
        }
      }, 0);
    }
  }

  /*
   * Somehow check the responsiveness of the remote clients/server
   * Default behavior:
   *   Wait 100ms before broadcasting the next batch of operations
   *
   * Only used when maxBufferLength is set
   *
   */
  whenRemoteResponsive () {
    return new Promise(function (resolve) {
      setTimeout(resolve, 100);
    })
  }

  /*
    You received a raw message, and you know that it is intended for Yjs. Then call this function.
  */
  receiveMessage (sender, buffer, skipAuth) {
    const y = this.y;
    const userID = y.userID;
    skipAuth = skipAuth || false;
    if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
      return Promise.reject(new Error('Expected Message to be an ArrayBuffer or Uint8Array!'))
    }
    if (sender === userID) {
      return Promise.resolve()
    }
    let decoder = new BinaryDecoder(buffer);
    let encoder = new BinaryEncoder();
    let roomname = decoder.readVarString(); // read room name
    encoder.writeVarString(roomname);
    let messageType = decoder.readVarString();
    let senderConn = this.connections.get(sender);
    this.log('User%s from User%s: Receive \'%s\'', userID, sender, messageType);
    this.logMessage('User%s from User%s: Receive %Y', userID, sender, [y, buffer]);
    if (senderConn == null && !skipAuth) {
      throw new Error('Received message from unknown peer!')
    }
    if (messageType === 'sync step 1' || messageType === 'sync step 2') {
      let auth = decoder.readVarUint();
      if (senderConn.auth == null) {
        senderConn.processAfterAuth.push([messageType, senderConn, decoder, encoder, sender]);
        // check auth
        return this.checkAuth(auth, y, sender).then(authPermissions => {
          if (senderConn.auth == null) {
            senderConn.auth = authPermissions;
            y.emit('userAuthenticated', {
              user: senderConn.uid,
              auth: authPermissions
            });
          }
          let messages = senderConn.processAfterAuth;
          senderConn.processAfterAuth = [];

          messages.forEach(m =>
            this.computeMessage(m[0], m[1], m[2], m[3], m[4])
          );
        })
      }
    }
    if ((skipAuth || senderConn.auth != null) && (messageType !== 'update' || senderConn.isSynced)) {
      this.computeMessage(messageType, senderConn, decoder, encoder, sender, skipAuth);
    } else {
      senderConn.processAfterSync.push([messageType, senderConn, decoder, encoder, sender, false]);
    }
  }

  computeMessage (messageType, senderConn, decoder, encoder, sender, skipAuth) {
    if (messageType === 'sync step 1' && (senderConn.auth === 'write' || senderConn.auth === 'read')) {
      // cannot wait for sync step 1 to finish, because we may wait for sync step 2 in sync step 1 (->lock)
      readSyncStep1(decoder, encoder, this.y, senderConn, sender);
    } else {
      const y = this.y;
      y.transact(function () {
        if (messageType === 'sync step 2' && senderConn.auth === 'write') {
          readSyncStep2(decoder, encoder, y, senderConn, sender);
        } else if (messageType === 'update' && (skipAuth || senderConn.auth === 'write')) {
          integrateRemoteStructs(y, decoder);
        } else {
          throw new Error('Unable to receive message')
        }
      }, true);
    }
  }

  _setSyncedWith (user) {
    if (user != null) {
      const userConn = this.connections.get(user);
      userConn.isSynced = true;
      const messages = userConn.processAfterSync;
      userConn.processAfterSync = [];
      messages.forEach(m => {
        this.computeMessage(m[0], m[1], m[2], m[3], m[4]);
      });
    }
    const conns = Array.from(this.connections.values());
    if (conns.length > 0 && conns.every(u => u.isSynced)) {
      this._fireIsSyncedListeners();
    }
  }
}

/**
 * Read the Decoder and fill the Yjs instance with data in the decoder.
 *
 * @param {Y} y The Yjs instance
 * @param {BinaryDecoder} decoder The BinaryDecoder to read from.
 */
function fromBinary (y, decoder) {
  y.transact(function () {
    integrateRemoteStructs(y, decoder);
    readDeleteSet(y, decoder);
  });
}

/**
 * Encode the Yjs model to binary format.
 *
 * @param {Y} y The Yjs instance
 * @return {BinaryEncoder} The encoder instance that can be transformed
 *                         to ArrayBuffer or Buffer.
 */
function toBinary (y) {
  let encoder = new BinaryEncoder();
  writeStructs(y, encoder, new Map());
  writeDeleteSet(y, encoder);
  return encoder
}

function getFreshCnf () {
  let buffer = new BinaryEncoder();
  buffer.writeUint32(0);
  return {
    len: 0,
    buffer
  }
}

/**
 * Abstract persistence class.
 */
class AbstractPersistence {
  constructor (opts) {
    this.opts = opts;
    this.ys = new Map();
  }

  _init (y) {
    let cnf = this.ys.get(y);
    if (cnf === undefined) {
      cnf = getFreshCnf();
      cnf.mutualExclude = createMutualExclude();
      this.ys.set(y, cnf);
      return this.init(y).then(() => {
        y.on('afterTransaction', (y, transaction) => {
          let cnf = this.ys.get(y);
          if (cnf.len > 0) {
            cnf.buffer.setUint32(0, cnf.len);
            this.saveUpdate(y, cnf.buffer.createBuffer(), transaction);
            let _cnf = getFreshCnf();
            for (let key in _cnf) {
              cnf[key] = _cnf[key];
            }
          }
        });
        return this.retrieve(y)
      }).then(function () {
        return Promise.resolve(cnf)
      })
    } else {
      return Promise.resolve(cnf)
    }
  }
  deinit (y) {
    this.ys.delete(y);
    y.persistence = null;
  }

  destroy () {
    this.ys = null;
  }

  /**
   * Remove all persisted data that belongs to a room.
   * Automatically destroys all Yjs all Yjs instances that persist to
   * the room. If `destroyYjsInstances = false` the persistence functionality
   * will be removed from the Yjs instances.
   *
   * ** Must be overwritten! **
   */
  removePersistedData (room, destroyYjsInstances = true) {
    this.ys.forEach((cnf, y) => {
      if (y.room === room) {
        if (destroyYjsInstances) {
          y.destroy();
        } else {
          this.deinit(y);
        }
      }
    });
  }

  /* overwrite */
  saveUpdate (buffer) {
  }

  /**
   * Save struct to update buffer.
   * saveUpdate is called when transaction ends
   */
  saveStruct (y, struct) {
    let cnf = this.ys.get(y);
    if (cnf !== undefined) {
      cnf.mutualExclude(function () {
        struct._toBinary(cnf.buffer);
        cnf.len++;
      });
    }
  }

  /* overwrite */
  retrieve (y, model, updates) {
    let cnf = this.ys.get(y);
    if (cnf !== undefined) {
      cnf.mutualExclude(function () {
        y.transact(function () {
          if (model != null) {
            fromBinary(y, new BinaryDecoder(new Uint8Array(model)));
          }
          if (updates != null) {
            for (let i = 0; i < updates.length; i++) {
              integrateRemoteStructs(y, new BinaryDecoder(new Uint8Array(updates[i])));
            }
          }
        });
        y.emit('persistenceReady');
      });
    }
  }

  /* overwrite */
  persist (y) {
    return toBinary(y).createBuffer()
  }
}

function typeObserver$1 () {
  this._mutualExclude(() => {
    const textarea = this.target;
    const textType = this.type;
    const relativeStart = getRelativePosition(textType, textarea.selectionStart);
    const relativeEnd = getRelativePosition(textType, textarea.selectionEnd);
    textarea.value = textType.toString();
    const start = fromRelativePosition(textType._y, relativeStart);
    const end = fromRelativePosition(textType._y, relativeEnd);
    textarea.setSelectionRange(start, end);
  });
}

function domObserver$1 () {
  this._mutualExclude(() => {
    let diff = simpleDiff(this.type.toString(), this.target.value);
    this.type.delete(diff.pos, diff.remove);
    this.type.insert(diff.pos, diff.insert);
  });
}

/**
 * A binding that binds a YText to a dom textarea.
 *
 * This binding is automatically destroyed when its parent is deleted.
 *
 * @example
 *   const textare = document.createElement('textarea')
 *   const type = y.define('textarea', Y.Text)
 *   const binding = new Y.QuillBinding(type, textarea)
 *
 */
class TextareaBinding extends Binding {
  constructor (textType, domTextarea) {
    // Binding handles textType as this.type and domTextarea as this.target
    super(textType, domTextarea);
    // set initial value
    domTextarea.value = textType.toString();
    // Observers are handled by this class
    this._typeObserver = typeObserver$1.bind(this);
    this._domObserver = domObserver$1.bind(this);
    textType.observe(this._typeObserver);
    domTextarea.addEventListener('input', this._domObserver);
  }
  destroy () {
    // Remove everything that is handled by this class
    this.type.unobserve(this._typeObserver);
    this.target.unobserve(this._domObserver);
    super.destroy();
  }
}

function typeObserver$2 (event) {
  const quill = this.target;
  // Force flush Quill changes.
  quill.update('yjs');
  this._mutualExclude(function () {
    // Apply computed delta.
    quill.updateContents(event.delta, 'yjs');
    // Force flush Quill changes. Ignore applied changes.
    quill.update('yjs');
  });
}

function quillObserver (delta) {
  this._mutualExclude(() => {
    this.type.applyDelta(delta.ops);
  });
}

/**
 * A Binding that binds a YText type to a Quill editor.
 *
 * @example
 * const quill = new Quill(document.createElement('div'))
 * const type = y.define('quill', Y.Text)
 * const binding = new Y.QuillBinding(quill, type)
 * // Now modifications on the DOM will be reflected in the Type, and the other
 * // way around!
 */
class QuillBinding extends Binding {
  /**
   * @param {YText} textType
   * @param {Quill} quill
   */
  constructor (textType, quill) {
    // Binding handles textType as this.type and quill as this.target.
    super(textType, quill);
    // Set initial value.
    quill.setContents(textType.toDelta(), 'yjs');
    // Observers are handled by this class.
    this._typeObserver = typeObserver$2.bind(this);
    this._quillObserver = quillObserver.bind(this);
    textType.observe(this._typeObserver);
    quill.on('text-change', this._quillObserver);
  }
  destroy () {
    // Remove everything that is handled by this class.
    this.type.unobserve(this._typeObserver);
    this.target.off('text-change', this._quillObserver);
    super.destroy();
  }
}

// TODO: The following assignments should be moved to yjs-dist
Y$1.AbstractConnector = AbstractConnector;
Y$1.AbstractPersistence = AbstractPersistence;
Y$1.Array = YArray;
Y$1.Map = YMap;
Y$1.Text = YText;
Y$1.XmlElement = YXmlElement;
Y$1.XmlFragment = YXmlFragment;
Y$1.XmlText = YXmlText;
Y$1.XmlHook = YXmlHook;

Y$1.TextareaBinding = TextareaBinding;
Y$1.QuillBinding = QuillBinding;
Y$1.DomBinding = DomBinding;

DomBinding.domToType = domToType;
DomBinding.domsToTypes = domsToTypes;
DomBinding.switchAssociation = switchAssociation;

Y$1.utils = {
  BinaryDecoder,
  UndoManager,
  getRelativePosition,
  fromRelativePosition,
  registerStruct,
  integrateRemoteStructs,
  toBinary,
  fromBinary
};

Y$1.debug = browser;
browser.formatters.Y = messageToString;
browser.formatters.y = messageToRoomname;

module.exports = Y$1;
//# sourceMappingURL=y.node.js.map
