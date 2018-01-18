
/**
 * yjs - A framework for real-time p2p shared editing on any data
 * @version v13.0.0-47
 * @license MIT
 */

'use strict';

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
    var parent = this.parent;
    var newParent = this.right;
    var newRight = this.right.left;
    newParent.left = this;
    this.right = newRight;
    if (parent === null) {
      tree.root = newParent;
      newParent._parent = null;
    } else if (parent.left === this) {
      parent.left = newParent;
    } else if (parent.right === this) {
      parent.right = newParent;
    } else {
      throw new Error('The elements are wrongly connected!')
    }
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
    var parent = this.parent;
    var newParent = this.left;
    var newLeft = this.left.right;
    newParent.right = this;
    this.left = newLeft;
    if (parent === null) {
      tree.root = newParent;
      newParent._parent = null;
    } else if (parent.left === this) {
      parent.left = newParent;
    } else if (parent.right === this) {
      parent.right = newParent;
    } else {
      throw new Error('The elements are wrongly connected!')
    }
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
  flush () {}
}

class ID {
  constructor (user, clock) {
    this.user = user;
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
  /*
   * Mark an operation as deleted. returns the deleted node
   */
  markDeleted (id, length) {
    if (length == null) {
      throw new Error('length must be defined')
    }
    var n = this.findWithUpperBound(id);
    if (n != null && n._id.user === id.user) {
      if (n._id.clock <= id.clock && id.clock <= n._id.clock + n.len) {
        // id is in n's range
        var diff = id.clock + length - (n._id.clock + n.len); // overlapping right
        if (diff > 0) {
          // id+length overlaps n
          if (!n.gc) {
            n.len += diff;
          } else {
            diff = n._id.clock + n.len - id.clock; // overlapping left (id till n.end)
            if (diff < length) {
              // a partial deletion
              let nId = id.clone();
              nId.clock += diff;
              n = new DSNode(nId, length - diff, false);
              this.put(n);
            } else {
              // already gc'd
              throw new Error(
                'DS reached an inconsistent state. Please report this issue!'
              )
            }
          }
        } else {
          // no overlapping, already deleted
          return n
        }
      } else {
        // cannot extend left (there is no left!)
        n = new DSNode(id, length, false);
        this.put(n); // TODO: you double-put !!
      }
    } else {
      // cannot extend left
      n = new DSNode(id, length, false);
      this.put(n);
    }
    // can extend right?
    var next = this.findNext(n._id);
    if (
      next != null &&
      n._id.user === next._id.user &&
      n._id.clock + n.len >= next._id.clock
    ) {
      diff = n._id.clock + n.len - next._id.clock; // from next.start to n.end
      while (diff >= 0) {
        // n overlaps with next
        if (next.gc) {
          // gc is stronger, so reduce length of n
          n.len -= diff;
          if (diff >= next.len) {
            // delete the missing range after next
            diff = diff - next.len; // missing range after next
            if (diff > 0) {
              this.put(n); // unneccessary? TODO!
              this.markDeleted(new ID(next._id.user, next._id.clock + next.len), diff);
            }
          }
          break
        } else {
          // we can extend n with next
          if (diff > next.len) {
            // n is even longer than next
            // get next.next, and try to extend it
            var _next = this.findNext(next._id);
            this.delete(next._id);
            if (_next == null || n._id.user !== _next._id.user) {
              break
            } else {
              next = _next;
              diff = n._id.clock + n.len - next._id.clock; // from next.start to n.end
              // continue!
            }
          } else {
            // n just partially overlaps with next. extend n, delete next, and break this loop
            n.len += next.len - diff;
            this.delete(next._id);
            break
          }
        }
      }
    }
    this.put(n);
    return n
  }
}

class BinaryDecoder {
  constructor (buffer) {
    if (buffer instanceof ArrayBuffer) {
      this.uint8arr = new Uint8Array(buffer);
    } else if (buffer instanceof Uint8Array || (typeof Buffer !== 'undefined' && buffer instanceof Buffer)) {
      this.uint8arr = buffer;
    } else {
      throw new Error('Expected an ArrayBuffer or Uint8Array!')
    }
    this.pos = 0;
  }
  /**
   * Clone this decoder instance
   * Optionally set a new position parameter
   */
  clone (newPos = this.pos) {
    let decoder = new BinaryDecoder(this.uint8arr);
    decoder.pos = newPos;
    return decoder
  }
  /**
   * Number of bytes
   */
  get length () {
    return this.uint8arr.length
  }
  /**
   * Skip one byte, jump to the next position
   */
  skip8 () {
    this.pos++;
  }
  /**
   * Read one byte as unsigned integer
   */
  readUint8 () {
    return this.uint8arr[this.pos++]
  }
  /**
   * Read 4 bytes as unsigned integer
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
   * Look ahead without incrementing position
   * to the next byte and read it as unsigned integer
   */
  peekUint8 () {
    return this.uint8arr[this.pos]
  }
  /**
   * Read unsigned integer (32bit) with variable length
   * 1/8th of the storage is used as encoding overhead
   *  - numbers < 2^7 is stored in one byte
   *  - numbers < 2^14 is stored in two bytes
   *  ..
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
   * - varUint is used to store the length of the string
   */
  readVarString () {
    let len = this.readVarUint();
    let bytes = new Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = this.uint8arr[this.pos++];
    }
    let encodedString = String.fromCodePoint(...bytes);
    return decodeURIComponent(escape(encodedString))
  }
  /**
   *  Look ahead and read varString without incrementing position
   */
  peekVarString () {
    let pos = this.pos;
    let s = this.readVarString();
    this.pos = pos;
    return s
  }
  /**
   * Read ID
   * - If first varUint read is 0xFFFFFF a RootID is returned
   * - Otherwise an ID is returned
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

class MissingEntry {
  constructor (decoder, missing, struct) {
    this.decoder = decoder;
    this.missing = missing.length;
    this.struct = struct;
  }
}

/**
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
    struct._integrate(y);
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

class BinaryEncoder {
  constructor () {
    // TODO: implement chained Uint8Array buffers instead of Array buffer
    this.data = [];
  }

  get length () {
    return this.data.length
  }

  get pos () {
    return this.data.length
  }

  createBuffer () {
    return Uint8Array.from(this.data).buffer
  }

  writeUint8 (num) {
    this.data.push(num & bits8);
  }

  setUint8 (pos, num) {
    this.data[pos] = num & bits8;
  }

  writeUint16 (num) {
    this.data.push(num & bits8, (num >>> 8) & bits8);
  }

  setUint16 (pos, num) {
    this.data[pos] = num & bits8;
    this.data[pos + 1] = (num >>> 8) & bits8;
  }

  writeUint32 (num) {
    for (let i = 0; i < 4; i++) {
      this.data.push(num & bits8);
      num >>>= 8;
    }
  }

  setUint32 (pos, num) {
    for (let i = 0; i < 4; i++) {
      this.data[pos + i] = num & bits8;
      num >>>= 8;
    }
  }

  writeVarUint (num) {
    while (num >= 0b10000000) {
      this.data.push(0b10000000 | (bits7 & num));
      num >>>= 7;
    }
    this.data.push(bits7 & num);
  }

  writeVarString (str) {
    let encodedString = unescape(encodeURIComponent(str));
    let bytes = encodedString.split('').map(c => c.codePointAt());
    let len = bytes.length;
    this.writeVarUint(len);
    for (let i = 0; i < len; i++) {
      this.data.push(bytes[i]);
    }
  }

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
            // deleteItemRange(y, user, d[0], diff)
            deletions.push([user, d[0], diff]);
          } else {
            // 3)
            diff = n._id.clock + n.len - d[0]; // never null (see 1)
            if (d[2] && !n.gc) {
              // d marks as gc'd but n does not
              // then delete either way
              // deleteItemRange(y, user, d[0], Math.min(diff, d[1]))
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
        deleteItemRange(y, del[0], del[1], del[2]);
      }
      // for the rest.. just apply it
      for (; pos < dv.length; pos++) {
        d = dv[pos];
        deleteItemRange(y, user, d[0], d[1]);
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

function writeStructs (y, encoder, ss) {
  const lenPos = encoder.pos;
  encoder.writeUint32(0);
  let len = 0;
  for (let user of y.ss.state.keys()) {
    let clock = ss.get(user) || 0;
    if (user !== RootFakeUserID) {
      y.os.iterate(new ID(user, clock), new ID(user, Number.MAX_VALUE), function (struct) {
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
 * Delete all items in an ID-range
 * TODO: implement getItemCleanStartNode for better performance (only one lookup)
 */
function deleteItemRange (y, user, clock, range) {
  const createDelete = y.connector !== null && y.connector._forwardAppliedStructs;
  let item = y.os.getItemCleanStart(new ID(user, clock));
  if (item !== null) {
    if (!item._deleted) {
      item._splitAt(y, range);
      item._delete(y, createDelete);
    }
    let itemLen = item._length;
    range -= itemLen;
    clock += itemLen;
    if (range > 0) {
      let node = y.os.findNode(new ID(user, clock));
      while (node !== null && range > 0 && node.val._id.equals(new ID(user, clock))) {
        const nodeVal = node.val;
        if (!nodeVal._deleted) {
          nodeVal._splitAt(y, range);
          nodeVal._delete(y, createDelete);
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
 * Delete is not a real struct. It will not be saved in OS
 */
class Delete {
  constructor () {
    this._target = null;
    this._length = null;
  }
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
  _toBinary (encoder) {
    encoder.writeUint8(getReference(this.constructor));
    encoder.writeID(this._targetID);
    encoder.writeVarUint(this._length);
  }
  /**
   * - If created remotely (a remote user deleted something),
   *   this Delete is applied to all structs in id-range.
   * - If created lokally (e.g. when y-array deletes a range of elements),
   *   this struct is broadcasted only (it is already executed)
   */
  _integrate (y, locallyCreated = false) {
    if (!locallyCreated) {
      // from remote
      const id = this._targetID;
      deleteItemRange(y, id.user, id.clock, this._length);
    } else if (y.connector !== null) {
      // from local
      y.connector.broadcastStruct(this);
    }
    if (y.persistence !== null) {
      y.persistence.saveStruct(y, this);
    }
  }
  _logString () {
    return `Delete - target: ${logID(this._targetID)}, len: ${this._length}`
  }
}

class Transaction {
  constructor (y) {
    this.y = y;
    // types added during transaction
    this.newTypes = new Set();
    // changed types (does not include new types)
    // maps from type to parentSubs (item._parentSub = null for array elements)
    this.changedTypes = new Map();
    this.deletedStructs = new Set();
    this.beforeState = new Map();
    this.changedParentTypes = new Map();
  }
}

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
 * Helper utility to split an Item (see _splitAt)
 * - copy all properties from a to b
 * - connect a to b
 * - assigns the correct _id
 * - save b to os
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
}

class Item {
  constructor () {
    this._id = null;
    this._origin = null;
    this._left = null;
    this._right = null;
    this._right_origin = null;
    this._parent = null;
    this._parentSub = null;
    this._deleted = false;
  }
  /**
   * Copy the effect of struct
   */
  _copy () {
    let struct = new this.constructor();
    struct._origin = this._left;
    struct._left = this._left;
    struct._right = this;
    struct._right_origin = this;
    struct._parent = this._parent;
    struct._parentSub = this._parentSub;
    return struct
  }
  get _lastId () {
    return new ID(this._id.user, this._id.clock + this._length - 1)
  }
  get _length () {
    return 1
  }
  /**
   * Splits this struct so that another struct can be inserted in-between.
   * This must be overwritten if _length > 1
   * Returns right part after split
   * - diff === 0 => this
   * - diff === length => this._right
   * - otherwise => split _content and return right part of split
   * (see ItemJSON/ItemString for implementation)
   */
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    }
    return this._right
  }
  _delete (y, createDelete = true) {
    if (!this._deleted) {
      this._deleted = true;
      y.ds.markDeleted(this._id, this._length);
      if (createDelete) {
        let del = new Delete();
        del._targetID = this._id;
        del._length = this._length;
        del._integrate(y, true);
      }
      transactionTypeChanged(y, this._parent, this._parentSub);
      y._transaction.deletedStructs.add(this);
    }
  }
  /**
   * This is called right before this struct receives any children.
   * It can be overwritten to apply pending changes before applying remote changes
   */
  _beforeChange () {
    // nop
  }
  /*
   * - Integrate the struct so that other types/structs can see it
   * - Add this struct to y.os
   * - Check if this is struct deleted
   */
  _integrate (y) {
    const parent = this._parent;
    const selfID = this._id;
    const userState = selfID === null ? 0 : y.ss.getState(selfID.user);
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
  _toBinary (encoder) {
    encoder.writeUint8(getReference(this.constructor));
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
        const parent = y.os.get(parentID);
        if (parent === null) {
          missing.push(parentID);
        } else {
          this._parent = parent;
        }
      }
    } else if (this._parent === null) {
      if (this._origin !== null) {
        this._parent = this._origin._parent;
      } else if (this._right_origin !== null) {
        this._parent = this._right_origin._parent;
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

class EventHandler {
  constructor () {
    this.eventListeners = [];
  }
  destroy () {
    this.eventListeners = null;
  }
  addEventListener (f) {
    this.eventListeners.push(f);
  }
  removeEventListener (f) {
    this.eventListeners = this.eventListeners.filter(function (g) {
      return f !== g
    });
  }
  removeAllEventListeners () {
    this.eventListeners = [];
  }
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



class Type extends Item {
  constructor () {
    super();
    this._map = new Map();
    this._start = null;
    this._y = null;
    this._eventHandler = new EventHandler();
    this._deepEventHandler = new EventHandler();
  }
  getPathTo (type) {
    if (type === this) {
      return []
    }
    const path = [];
    const y = this._y;
    while (type._parent !== this && this._parent !== y) {
      let parent = type._parent;
      if (type._parentSub !== null) {
        path.push(type._parentSub);
      } else {
        // parent is array-ish
        for (let [i, child] of parent) {
          if (child === type) {
            path.push(i);
            break
          }
        }
      }
      type = parent;
    }
    if (this._parent !== this) {
      throw new Error('The type is not a child of this node')
    }
    return path
  }
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
  _copy (undeleteChildren) {
    let copy = super._copy();
    let map = new Map();
    copy._map = map;
    for (let [key, value] of this._map) {
      if (undeleteChildren.has(value) || !value.deleted) {
        let _item = value._copy(undeleteChildren);
        _item._parent = copy;
        map.set(key, value._copy(undeleteChildren));
      }
    }
    let prevUndeleted = null;
    copy._start = null;
    let item = this._start;
    while (item !== null) {
      if (undeleteChildren.has(item) || !item.deleted) {
        let _item = item._copy(undeleteChildren);
        _item._left = prevUndeleted;
        _item._origin = prevUndeleted;
        _item._right = null;
        _item._right_origin = null;
        _item._parent = copy;
        if (prevUndeleted === null) {
          copy._start = _item;
        } else {
          prevUndeleted._right = _item;
        }
        prevUndeleted = _item;
      }
      item = item._right;
    }
    return copy
  }
  _transact (f) {
    const y = this._y;
    if (y !== null) {
      y.transact(f);
    } else {
      f(y);
    }
  }
  observe (f) {
    this._eventHandler.addEventListener(f);
  }
  observeDeep (f) {
    this._deepEventHandler.addEventListener(f);
  }
  unobserve (f) {
    this._eventHandler.removeEventListener(f);
  }
  unobserveDeep (f) {
    this._deepEventHandler.removeEventListener(f);
  }
  _integrate (y) {
    y._transaction.newTypes.add(this);
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
  _delete (y, createDelete) {
    super._delete(y, createDelete);
    y._transaction.changedTypes.delete(this);
    // delete map types
    for (let value of this._map.values()) {
      if (value instanceof Item && !value._deleted) {
        value._delete(y, false);
      }
    }
    // delete array types
    let t = this._start;
    while (t !== null) {
      if (!t._deleted) {
        t._delete(y, false);
      }
      t = t._right;
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
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `ItemJSON(id:${logID(this._id)},content:${JSON.stringify(this._content)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
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
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `ItemJSON(id:${logID(this._id)},content:${JSON.stringify(this._content)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
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

class YEvent {
  constructor (target) {
    this.target = target;
    this.currentTarget = target;
  }
  get path () {
    const path = [];
    let type = this.target;
    const y = type._y;
    while (type !== this.currentTarget && type !== y) {
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
    return path
  }
}

class YArrayEvent extends YEvent {
  constructor (yarray, remote, transaction) {
    super(yarray);
    this.remote = remote;
    this._transaction = transaction;
  }
  get addedElements () {
    const target = this.target;
    const transaction = this._transaction;
    const addedElements = new Set();
    transaction.newTypes.forEach(function (type) {
      if (type._parent === target && !transaction.deletedStructs.has(type)) {
        addedElements.add(type);
      }
    });
    return addedElements
  }
  get removedElements () {
    const target = this.target;
    const transaction = this._transaction;
    const removedElements = new Set();
    transaction.deletedStructs.forEach(function (struct) {
      if (struct._parent === target && !transaction.newTypes.has(struct)) {
        removedElements.add(struct);
      }
    });
    return removedElements
  }
}

class YArray extends Type {
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YArrayEvent(this, remote, transaction));
  }
  get (pos) {
    let n = this._start;
    while (n !== null) {
      if (!n._deleted) {
        if (pos < n._length) {
          if (n.constructor === ItemJSON || n.constructor === ItemString) {
            return n._content[pos]
          } else {
            return n
          }
        }
        pos -= n._length;
      }
      n = n._right;
    }
  }
  toArray () {
    return this.map(c => c)
  }
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
  map (f) {
    const res = [];
    this.forEach((c, i) => {
      res.push(f(c, i, this));
    });
    return res
  }
  forEach (f) {
    let pos = 0;
    let n = this._start;
    while (n !== null) {
      if (!n._deleted) {
        if (n instanceof Type) {
          f(n, pos++, this);
        } else {
          const content = n._content;
          const contentLen = content.length;
          for (let i = 0; i < contentLen; i++) {
            pos++;
            f(content[i], pos, this);
          }
        }
      }
      n = n._right;
    }
  }
  get length () {
    let length = 0;
    let n = this._start;
    while (n !== null) {
      if (!n._deleted) {
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
          value: [this._count, content],
          done: false
        }
      },
      _item: this._start,
      _itemElement: 0,
      _count: 0
    }
  }
  delete (pos, length = 1) {
    this._y.transact(() => {
      let item = this._start;
      let count = 0;
      while (item !== null && length > 0) {
        if (!item._deleted) {
          if (count <= pos && pos < count + item._length) {
            const diffDel = pos - count;
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
  }
  insert (pos, content) {
    let left = null;
    let right = this._start;
    let count = 0;
    const y = this._y;
    while (right !== null) {
      const rightLen = right._deleted ? 0 : (right._length - 1);
      if (count <= pos && pos <= count + rightLen) {
        const splitDiff = pos - count;
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
    if (pos > count) {
      throw new Error('Position exceeds array range!')
    }
    this.insertAfter(left, content);
  }
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
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `YArray(id:${logID(this._id)},start:${logID(this._start)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}

class YMapEvent extends YEvent {
  constructor (ymap, subs, remote) {
    super(ymap);
    this.keysChanged = subs;
    this.remote = remote;
  }
}

class YMap extends Type {
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YMapEvent(this, parentSubs, remote));
  }
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
  keys () {
    let keys = [];
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        keys.push(key);
      }
    }
    return keys
  }
  delete (key) {
    this._transact((y) => {
      let c = this._map.get(key);
      if (y !== null && c !== undefined) {
        c._delete(y);
      }
    });
  }
  set (key, value) {
    this._transact(y => {
      const old = this._map.get(key) || null;
      if (old !== null) {
        if (old.constructor === ItemJSON && !old._deleted && old._content[0] === value) {
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
  has (key) {
    let v = this._map.get(key);
    if (v === undefined || v._deleted) {
      return false
    } else {
      return true
    }
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `YMap(id:${logID(this._id)},mapSize:${this._map.size},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}

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
  toString () {
    const strBuilder = [];
    let n = this._start;
    while (n !== null) {
      if (!n._deleted) {
        strBuilder.push(n._content);
      }
      n = n._right;
    }
    return strBuilder.join('')
  }
  insert (pos, text) {
    if (text.length <= 0) {
      return
    }
    this._transact(y => {
      let left = null;
      let right = this._start;
      let count = 0;
      while (right !== null) {
        const rightLen = right._deleted ? 0 : (right._length - 1);
        if (count <= pos && pos <= count + rightLen) {
          const splitDiff = pos - count;
          right = right._splitAt(this._y, splitDiff);
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
      if (pos > count) {
        throw new Error('Position exceeds array range!')
      }
      let item = new ItemString();
      item._origin = left;
      item._left = left;
      item._right = right;
      item._right_origin = right;
      item._parent = this;
      item._content = text;
      if (y !== null) {
        item._integrate(this._y);
      } else if (left === null) {
        this._start = item;
      } else {
        left._right = item;
      }
    });
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `YText(id:${logID(this._id)},start:${logID(this._start)},left:${logID(left)},origin:${logID(origin)},right:${logID(this._right)},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}

function defaultDomFilter (node, attributes) {
  return attributes
}



// get BoundingClientRect that works on text nodes




function iterateUntilUndeleted (item) {
  while (item !== null && item._deleted) {
    item = item._right;
  }
  return item
}

function _insertNodeHelper (yxml, prevExpectedNode, child) {
  let insertedNodes = yxml.insertDomElementsAfter(prevExpectedNode, [child]);
  if (insertedNodes.length > 0) {
    return insertedNodes[0]
  } else {
    return prevExpectedNode
  }
}

/*
 * 1. Check if any of the nodes was deleted
 * 2. Iterate over the children.
 *    2.1 If a node exists without _yxml property, insert a new node
 *    2.2 If _contents.length < dom.childNodes.length, fill the
 *        rest of _content with childNodes
 *    2.3 If a node was moved, delete it and
 *       recreate a new yxml element that is bound to that node.
 *       You can detect that a node was moved because expectedId
 *       !== actualId in the list
 */
function applyChangesFromDom (dom) {
  const yxml = dom._yxml;
  if (yxml.constructor === YXmlHook) {
    return
  }
  const y = yxml._y;
  let knownChildren =
    new Set(
      Array.prototype.map.call(dom.childNodes, child => child._yxml)
      .filter(id => id !== undefined)
    );
  // 1. Check if any of the nodes was deleted
  yxml.forEach(function (childType, i) {
    if (!knownChildren.has(childType)) {
      childType._delete(y);
    }
  });
  // 2. iterate
  let childNodes = dom.childNodes;
  let len = childNodes.length;
  let prevExpectedNode = null;
  let expectedNode = iterateUntilUndeleted(yxml._start);
  for (let domCnt = 0; domCnt < len; domCnt++) {
    const child = childNodes[domCnt];
    const childYXml = child._yxml;
    if (childYXml != null) {
      if (childYXml === false) {
        // should be ignored or is going to be deleted
        continue
      }
      if (expectedNode !== null) {
        if (expectedNode !== childYXml) {
          // 2.3 Not expected node
          if (childYXml._parent !== this) {
            // element is going to be deleted by its previous parent
            child._yxml = null;
          } else {
            childYXml._delete(y);
          }
          prevExpectedNode = _insertNodeHelper(yxml, prevExpectedNode, child);
        } else {
          prevExpectedNode = expectedNode;
          expectedNode = iterateUntilUndeleted(expectedNode._right);
        }
        // if this is the expected node id, just continue
      } else {
        // 2.2 fill _conten with child nodes
        prevExpectedNode = _insertNodeHelper(yxml, prevExpectedNode, child);
      }
    } else {
      // 2.1 A new node was found
      prevExpectedNode = _insertNodeHelper(yxml, prevExpectedNode, child);
    }
  }
}

function reflectChangesOnDom (events, _document) {
  // Make sure that no filtered attributes are applied to the structure
  // if they were, delete them
  /*
  events.forEach(event => {
    const target = event.target
    if (event.attributesChanged === undefined) {
      // event.target is Y.XmlText
      return
    }
    const keys = this._domFilter(target.nodeName, Array.from(event.attributesChanged))
    if (keys === null) {
      target._delete()
    } else {
      const removeKeys = new Set() // is a copy of event.attributesChanged
      event.attributesChanged.forEach(key => { removeKeys.add(key) })
      keys.forEach(key => {
        // remove all accepted keys from removeKeys
        removeKeys.delete(key)
      })
      // remove the filtered attribute
      removeKeys.forEach(key => {
        target.removeAttribute(key)
      })
    }
  })
  */
  this._mutualExclude(() => {
    events.forEach(event => {
      const yxml = event.target;
      const dom = yxml._dom;
      if (dom != null) {
        // TODO: do this once before applying stuff
        // let anchorViewPosition = getAnchorViewPosition(yxml._scrollElement)
        if (yxml.constructor === YXmlText) {
          yxml._dom.nodeValue = yxml.toString();
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
          /**
           * TODO: instead of chard-checking the types, it would be best to
           *       specify the type's features. E.g.
           *         - _yxmlHasAttributes
           *         - _yxmlHasChildren
           *       Furthermore, the features shouldn't be encoded in the types,
           *       only in the attributes (above)
           */
          if (event.childListChanged && yxml.constructor !== YXmlHook) {
            let currentChild = dom.firstChild;
            yxml.forEach(function (t) {
              let expectedChild = t.getDom(_document);
              if (expectedChild.parentNode === dom) {
                // is already attached to the dom. Look for it
                while (currentChild !== expectedChild) {
                  let del = currentChild;
                  currentChild = currentChild.nextSibling;
                  dom.removeChild(del);
                }
                currentChild = currentChild.nextSibling;
              } else {
                // this dom is not yet attached to dom
                dom.insertBefore(expectedChild, currentChild);
              }
            });
            while (currentChild !== null) {
              let tmp = currentChild.nextSibling;
              dom.removeChild(currentChild);
              currentChild = tmp;
            }
          }
        }
        /* TODO: smartscrolling
        .. else if (event.type === 'childInserted' || event.type === 'insert') {
          let nodes = event.values
          for (let i = nodes.length - 1; i >= 0; i--) {
            let node = nodes[i]
            node.setDomFilter(yxml._domFilter)
            node.enableSmartScrolling(yxml._scrollElement)
            let dom = node.getDom()
            let fixPosition = null
            let nextDom = null
            if (yxml._content.length > event.index + i + 1) {
              nextDom = yxml.get(event.index + i + 1).getDom()
            }
            yxml._dom.insertBefore(dom, nextDom)
            if (anchorViewPosition === null) {
              // nop
            } else if (anchorViewPosition.anchor !== null) {
              // no scrolling when current selection
              if (!dom.contains(anchorViewPosition.anchor) && !anchorViewPosition.anchor.contains(dom)) {
                fixPosition = anchorViewPosition
              }
            } else if (getBoundingClientRect(dom).top <= 0) {
              // adjust scrolling if modified element is out of view,
              // there is no anchor element, and the browser did not adjust scrollTop (this is checked later)
              fixPosition = anchorViewPosition
            }
            fixScrollPosition(yxml._scrollElement, fixPosition)
          }
        } else if (event.type === 'childRemoved' || event.type === 'delete') {
          for (let i = event.values.length - 1; i >= 0; i--) {
            let dom = event.values[i]._dom
            let fixPosition = null
            if (anchorViewPosition === null) {
              // nop
            } else if (anchorViewPosition.anchor !== null) {
              // no scrolling when current selection
              if (!dom.contains(anchorViewPosition.anchor) && !anchorViewPosition.anchor.contains(dom)) {
                fixPosition = anchorViewPosition
              }
            } else if (getBoundingClientRect(dom).top <= 0) {
              // adjust scrolling if modified element is out of view,
              // there is no anchor element, and the browser did not adjust scrollTop (this is checked later)
              fixPosition = anchorViewPosition
            }
            dom.remove()
            fixScrollPosition(yxml._scrollElement, fixPosition)
          }
        }
        */
      }
    });
  });
}

function getRelativePosition (type, offset) {
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

function fromRelativePosition (y, rpos) {
  if (rpos[0] === 'endof') {
    let id;
    if (rpos[3] === null) {
      id = new ID(rpos[1], rpos[2]);
    } else {
      id = new RootID(rpos[3], rpos[4]);
    }
    const type = y.os.get(id);
    return {
      type,
      offset: type.length
    }
  } else {
    let offset = 0;
    let struct = y.os.findNodeWithUpperBound(new ID(rpos[0], rpos[1])).val;
    const parent = struct._parent;
    if (parent._deleted) {
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

let beforeTransactionSelectionFixer;
if (typeof getSelection !== 'undefined') {
  beforeTransactionSelectionFixer = function _beforeTransactionSelectionFixer (y, transaction, remote) {
    if (!remote) {
      return
    }
    relativeSelection = { from: null, to: null, fromY: null, toY: null };
    browserSelection = getSelection();
    const anchorNode = browserSelection.anchorNode;
    if (anchorNode !== null && anchorNode._yxml != null) {
      const yxml = anchorNode._yxml;
      relativeSelection.from = getRelativePosition(yxml, browserSelection.anchorOffset);
      relativeSelection.fromY = yxml._y;
    }
    const focusNode = browserSelection.focusNode;
    if (focusNode !== null && focusNode._yxml != null) {
      const yxml = focusNode._yxml;
      relativeSelection.to = getRelativePosition(yxml, browserSelection.focusOffset);
      relativeSelection.toY = yxml._y;
    }
  };
} else {
  beforeTransactionSelectionFixer = function _fakeBeforeTransactionSelectionFixer () {};
}

function afterTransactionSelectionFixer (y, transaction, remote) {
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
      let node = sel.type.getDom();
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
      let node = sel.type.getDom();
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

class YXmlEvent extends YEvent {
  constructor (target, subs, remote) {
    super(target);
    this.childListChanged = false;
    this.attributesChanged = new Set();
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
    pos: left,
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  }
}

/* global MutationObserver */

function domToYXml (parent, doms, _document) {
  const types = [];
  doms.forEach(d => {
    if (d._yxml != null && d._yxml !== false) {
      d._yxml._unbindFromDom();
    }
    if (parent._domFilter(d.nodeName, new Map()) !== null) {
      let type;
      const hookName = d._yjsHook || (d.dataset != null ? d.dataset.yjsHook : undefined);
      if (hookName !== undefined) {
        type = new YXmlHook(hookName, d);
      } else if (d.nodeType === d.TEXT_NODE) {
        type = new YXmlText(d);
      } else if (d.nodeType === d.ELEMENT_NODE) {
        type = new YXmlFragment._YXmlElement(d, parent._domFilter, _document);
      } else {
        throw new Error('Unsupported node!')
      }
      // type.enableSmartScrolling(parent._scrollElement)
      types.push(type);
    } else {
      d._yxml = false;
    }
  });
  return types
}

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

class YXmlFragment extends YArray {
  constructor () {
    super();
    this._dom = null;
    this._domFilter = defaultDomFilter;
    this._domObserver = null;
    // this function makes sure that either the
    // dom event is executed, or the yjs observer is executed
    var token = true;
    this._mutualExclude = f => {
      if (token) {
        token = false;
        try {
          f();
        } catch (e) {
          console.error(e);
        }
        /*
        if (this._domObserver !== null) {
          this._domObserver.takeRecords()
        }
        */
        token = true;
      }
    };
  }
  createTreeWalker (filter) {
    return new YXmlTreeWalker(this, filter)
  }
  /**
   * Retrieve first element that matches *query*
   * Similar to DOM's querySelector, but only accepts a subset of its queries
   *
   * Query support:
   *   - tagname
   * TODO:
   *   - id
   *   - attribute
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
  querySelectorAll (query) {
    query = query.toUpperCase();
    return Array.from(new YXmlTreeWalker(this, element => element.nodeName === query))
  }
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement;
    this.forEach(xml => {
      xml.enableSmartScrolling(scrollElement);
    });
  }
  setDomFilter (f) {
    this._domFilter = f;
    let attributes = new Map();
    if (this.getAttributes !== undefined) {
      let attrs = this.getAttributes();
      for (let key in attrs) {
        attributes.set(key, attrs[key]);
      }
    }
    let result = this._domFilter(this.nodeName, new Map(attributes));
    if (result === null) {
      this._delete(this._y);
    } else {
      attributes.forEach((value, key) => {
        if (!result.has(key)) {
          this.removeAttribute(key);
        }
      });
    }
    this.forEach(xml => {
      xml.setDomFilter(f);
    });
  }
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YXmlEvent(this, parentSubs, remote));
  }
  toString () {
    return this.map(xml => xml.toString()).join('')
  }
  _delete (y, createDelete) {
    this._unbindFromDom();
    super._delete(y, createDelete);
  }
  _unbindFromDom () {
    if (this._domObserver != null) {
      this._domObserver.disconnect();
      this._domObserver = null;
    }
    if (this._dom != null) {
      this._dom._yxml = null;
      this._dom = null;
    }
    if (this._beforeTransactionHandler !== undefined) {
      this._y.off('beforeTransaction', this._beforeTransactionHandler);
    }
  }
  insertDomElementsAfter (prev, doms, _document) {
    const types = domToYXml(this, doms, _document);
    this.insertAfter(prev, types);
    return types
  }
  insertDomElements (pos, doms, _document) {
    const types = domToYXml(this, doms, _document);
    this.insert(pos, types);
    return types
  }
  getDom () {
    return this._dom
  }
  bindToDom (dom, _document) {
    if (this._dom != null) {
      this._unbindFromDom();
    }
    if (dom._yxml != null) {
      dom._yxml._unbindFromDom();
    }
    dom.innerHTML = '';
    this.forEach(t => {
      dom.insertBefore(t.getDom(_document), null);
    });
    this._bindToDom(dom, _document);
  }
  // binds to a dom element
  // Only call if dom and YXml are isomorph
  _bindToDom (dom, _document) {
    _document = _document || document;
    this._dom = dom;
    dom._yxml = this;
    if (this._parent === null) {
      return
    }
    this._y.on('beforeTransaction', beforeTransactionSelectionFixer);
    this._y.on('afterTransaction', afterTransactionSelectionFixer);
    const applyFilter = (type) => {
      if (type._deleted) {
        return
      }
      // check if type is a child of this
      let isChild = false;
      let p = type;
      while (p !== this._y) {
        if (p === this) {
          isChild = true;
          break
        }
        p = p._parent;
      }
      if (!isChild) {
        return
      }
      // filter attributes
      let attributes = new Map();
      if (type.getAttributes !== undefined) {
        let attrs = type.getAttributes();
        for (let key in attrs) {
          attributes.set(key, attrs[key]);
        }
      }
      let result = this._domFilter(type.nodeName, new Map(attributes));
      if (result === null) {
        type._delete(this._y);
      } else {
        attributes.forEach((value, key) => {
          if (!result.has(key)) {
            type.removeAttribute(key);
          }
        });
      }
    };
    this._y.on('beforeObserverCalls', function (y, transaction) {
      // apply dom filter to new and changed types
      transaction.changedTypes.forEach(function (subs, type) {
        if (subs.size > 1 || !subs.has(null)) {
          // only apply changes on attributes
          applyFilter(type);
        }
      });
      transaction.newTypes.forEach(applyFilter);
    });
    // Apply Y.Xml events to dom
    this.observeDeep(events => {
      reflectChangesOnDom.call(this, events, _document);
    });
    // Apply Dom changes on Y.Xml
    if (typeof MutationObserver !== 'undefined') {
      this._beforeTransactionHandler = () => {
        this._domObserverListener(this._domObserver.takeRecords());
      };
      this._y.on('beforeTransaction', this._beforeTransactionHandler);
      this._domObserverListener = mutations => {
        this._mutualExclude(() => {
          this._y.transact(() => {
            let diffChildren = new Set();
            mutations.forEach(mutation => {
              const dom = mutation.target;
              const yxml = dom._yxml;
              if (yxml == null || yxml.constructor === YXmlHook) {
                // dom element is filtered
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
                  if (this._domFilter(dom.nodeName, attributes).size > 0 && yxml.constructor !== YXmlFragment) {
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
              if (dom.yOnChildrenChanged !== undefined) {
                dom.yOnChildrenChanged();
              }
              if (dom._yxml != null && dom._yxml !== false) {
                applyChangesFromDom(dom);
              }
            }
          });
        });
      };
      this._domObserver = new MutationObserver(this._domObserverListener);
      this._domObserver.observe(dom, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true
      });
    }
    return dom
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `YXml(id:${logID(this._id)},left:${logID(left)},origin:${logID(origin)},right:${this._right},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}

class YXmlElement extends YXmlFragment {
  constructor (arg1, arg2, _document) {
    super();
    this.nodeName = null;
    this._scrollElement = null;
    if (typeof arg1 === 'string') {
      this.nodeName = arg1.toUpperCase();
    } else if (arg1 != null && arg1.nodeType != null && arg1.nodeType === arg1.ELEMENT_NODE) {
      this.nodeName = arg1.nodeName;
      this._setDom(arg1, _document);
    } else {
      this.nodeName = 'UNDEFINED';
    }
    if (typeof arg2 === 'function') {
      this._domFilter = arg2;
    }
  }
  _copy (undeleteChildren) {
    let struct = super._copy(undeleteChildren);
    struct.nodeName = this.nodeName;
    return struct
  }
  _setDom (dom, _document) {
    if (this._dom != null) {
      throw new Error('Only call this method if you know what you are doing ;)')
    } else if (dom._yxml != null) { // TODO do i need to check this? - no.. but for dev purps..
      throw new Error('Already bound to an YXml type')
    } else {
      // tag is already set in constructor
      // set attributes
      let attributes = new Map();
      for (let i = 0; i < dom.attributes.length; i++) {
        let attr = dom.attributes[i];
        attributes.set(attr.name, attr.value);
      }
      attributes = this._domFilter(dom, attributes);
      attributes.forEach((value, name) => {
        this.setAttribute(name, value);
      });
      this.insertDomElements(0, Array.prototype.slice.call(dom.childNodes), _document);
      this._bindToDom(dom, _document);
      return dom
    }
  }
  _bindToDom (dom, _document) {
    _document = _document || document;
    this._dom = dom;
    dom._yxml = this;
  }
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder);
    this.nodeName = decoder.readVarString();
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(this.nodeName);
  }
  _integrate (y) {
    if (this.nodeName === null) {
      throw new Error('nodeName must be defined!')
    }
    if (this._domFilter === defaultDomFilter && this._parent._domFilter !== undefined) {
      this._domFilter = this._parent._domFilter;
    }
    super._integrate(y);
  }
  /**
   * Returns the string representation of the XML document.
   * The attributes are ordered by attribute-name, so you can easily use this
   * method to compare YXmlElements
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
  removeAttribute () {
    return YMap.prototype.delete.apply(this, arguments)
  }

  setAttribute () {
    return YMap.prototype.set.apply(this, arguments)
  }

  getAttribute () {
    return YMap.prototype.get.apply(this, arguments)
  }

  getAttributes () {
    const obj = {};
    for (let [key, value] of this._map) {
      if (!value._deleted) {
        obj[key] = value._content[0];
      }
    }
    return obj
  }
  getDom (_document) {
    _document = _document || document;
    let dom = this._dom;
    if (dom == null) {
      dom = _document.createElement(this.nodeName);
      dom._yxml = this;
      let attrs = this.getAttributes();
      for (let key in attrs) {
        dom.setAttribute(key, attrs[key]);
      }
      this.forEach(yxml => {
        dom.appendChild(yxml.getDom(_document));
      });
      this._bindToDom(dom, _document);
    }
    return dom
  }
}

const xmlHooks = {};

function addHook (name, hook) {
  xmlHooks[name] = hook;
}

function getHook (name) {
  const hook = xmlHooks[name];
  if (hook === undefined) {
    throw new Error(`The hook "${name}" is not specified! You must not access this hook!`)
  }
  return hook
}

class YXmlHook extends YMap {
  constructor (hookName, dom) {
    super();
    this._dom = null;
    this.hookName = null;
    if (hookName !== undefined) {
      this.hookName = hookName;
      this._dom = dom;
      dom._yjsHook = hookName;
      dom._yxml = this;
      getHook(hookName).fillType(dom, this);
    }
  }
  getDom (_document) {
    _document = _document || document;
    if (this._dom === null) {
      const dom = getHook(this.hookName).createDom(this);
      this._dom = dom;
      dom._yxml = this;
      dom._yjsHook = this.hookName;
    }
    return this._dom
  }
  _unbindFromDom () {
    this._dom._yxml = null;
    this._yxml = null;
    // TODO: cleanup hook?
  }
  _fromBinary (y, decoder) {
    const missing = super._fromBinary(y, decoder);
    this.hookName = decoder.readVarString();
    return missing
  }
  _toBinary (encoder) {
    super._toBinary(encoder);
    encoder.writeVarString(this.hookName);
  }
  _integrate (y) {
    if (this.hookName === null) {
      throw new Error('hookName must be defined!')
    }
    super._integrate(y);
  }
  setDomFilter () {
    // TODO: implement new modfilter method!
  }
  enableSmartScrolling () {
    // TODO: implement new smartscrolling method!
  }
}
YXmlHook.addHook = addHook;

class YXmlText extends YText {
  constructor (arg1) {
    let dom = null;
    let initialText = null;
    if (arg1 != null) {
      if (arg1.nodeType != null && arg1.nodeType === arg1.TEXT_NODE) {
        dom = arg1;
        initialText = dom.nodeValue;
      } else if (typeof arg1 === 'string') {
        initialText = arg1;
      }
    }
    super(initialText);
    this._dom = null;
    this._domObserver = null;
    this._domObserverListener = null;
    this._scrollElement = null;
    if (dom !== null) {
      this._setDom(arg1);
    }
    /*
    var token = true
    this._mutualExclude = f => {
      if (token) {
        token = false
        try {
          f()
        } catch (e) {
          console.error(e)
        }
        this._domObserver.takeRecords()
        token = true
      }
    }
    this.observe(event => {
      if (this._dom != null) {
        const dom = this._dom
        this._mutualExclude(() => {
          let anchorViewPosition = getAnchorViewPosition(this._scrollElement)
          let anchorViewFix
          if (anchorViewPosition !== null && (anchorViewPosition.anchor !== null || getBoundingClientRect(this._dom).top <= 0)) {
            anchorViewFix = anchorViewPosition
          } else {
            anchorViewFix = null
          }
          dom.nodeValue = this.toString()
          fixScrollPosition(this._scrollElement, anchorViewFix)
        })
      }
    })
    */
  }
  setDomFilter () {}
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement;
  }
  _setDom (dom) {
    if (this._dom != null) {
      this._unbindFromDom();
    }
    if (dom._yxml != null) {
      dom._yxml._unbindFromDom();
    }
    // set marker
    this._dom = dom;
    dom._yxml = this;
  }
  getDom (_document) {
    _document = _document || document;
    if (this._dom === null) {
      const dom = _document.createTextNode(this.toString());
      this._setDom(dom);
      return dom
    }
    return this._dom
  }
  _delete (y, createDelete) {
    this._unbindFromDom();
    super._delete(y, createDelete);
  }
  _unbindFromDom () {
    if (this._domObserver != null) {
      this._domObserver.disconnect();
      this._domObserver = null;
    }
    if (this._dom != null) {
      this._dom._yxml = null;
      this._dom = null;
    }
  }
}

YXmlFragment._YXmlElement = YXmlElement;
YXmlFragment._YXmlHook = YXmlHook;

const structs = new Map();
const references = new Map();

function addStruct (reference, structConstructor) {
  structs.set(reference, structConstructor);
  references.set(structConstructor, reference);
}

function getStruct (reference) {
  return structs.get(reference)
}

function getReference (typeConstructor) {
  return references.get(typeConstructor)
}

addStruct(0, ItemJSON);
addStruct(1, ItemString);
addStruct(2, Delete);

addStruct(3, YArray);
addStruct(4, YMap);
addStruct(5, YText);
addStruct(6, YXmlFragment);
addStruct(7, YXmlElement);
addStruct(8, YXmlText);
addStruct(9, YXmlHook);

const RootFakeUserID = 0xFFFFFF;

class RootID {
  constructor (name, typeConstructor) {
    this.user = RootFakeUserID;
    this.name = name;
    this.type = getReference(typeConstructor);
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

function generateUserID () {
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

class NamedEventHandler {
  constructor () {
    this._eventListener = new Map();
    this._stateListener = new Map();
  }
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
  once (name, f) {
    let listeners = this._getListener(name);
    listeners.once.add(f);
  }
  on (name, f) {
    let listeners = this._getListener(name);
    listeners.on.add(f);
  }
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
  when (name) {
    return this._initStateListener(name).promise
  }
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

class ReverseOperation {
  constructor (y, transaction) {
    this.created = new Date();
    const beforeState = transaction.beforeState;
    this.toState = new ID(y.userID, y.ss.getState(y.userID) - 1);
    if (beforeState.has(y.userID)) {
      this.fromState = new ID(y.userID, beforeState.get(y.userID));
    } else {
      this.fromState = this.toState;
    }
    this.deletedStructs = transaction.deletedStructs;
  }
}

function isStructInScope (y, struct, scope) {
  while (struct !== y) {
    if (struct === scope) {
      return true
    }
    struct = struct._parent;
  }
  return false
}

function applyReverseOperation (y, scope, reverseBuffer) {
  let performedUndo = false;
  y.transact(() => {
    while (!performedUndo && reverseBuffer.length > 0) {
      let undoOp = reverseBuffer.pop();
      // make sure that it is possible to iterate {from}-{to}
      y.os.getItemCleanStart(undoOp.fromState);
      y.os.getItemCleanEnd(undoOp.toState);
      y.os.iterate(undoOp.fromState, undoOp.toState, op => {
        if (!op._deleted && isStructInScope(y, op, scope)) {
          performedUndo = true;
          op._delete(y);
        }
      });
      for (let op of undoOp.deletedStructs) {
        if (
          isStructInScope(y, op, scope) &&
          op._parent !== y &&
          !op._parent._deleted &&
          (
            op._parent._id.user !== y.userID ||
            op._parent._id.clock < undoOp.fromState.clock ||
            op._parent._id.clock > undoOp.fromState.clock
          )
        ) {
          performedUndo = true;
          op = op._copy(undoOp.deletedStructs);
          op._integrate(y);
        }
      }
    }
  });
  return performedUndo
}

class UndoManager {
  constructor (scope, options = {}) {
    this.options = options;
    options.captureTimeout = options.captureTimeout == null ? 500 : options.captureTimeout;
    this._undoBuffer = [];
    this._redoBuffer = [];
    this._scope = scope;
    this._undoing = false;
    this._redoing = false;
    const y = scope._y;
    this.y = y;
    y.on('afterTransaction', (y, transaction, remote) => {
      if (!remote && transaction.changedParentTypes.has(scope)) {
        let reverseOperation = new ReverseOperation(y, transaction);
        if (!this._undoing) {
          let lastUndoOp = this._undoBuffer.length > 0 ? this._undoBuffer[this._undoBuffer.length - 1] : null;
          if (lastUndoOp !== null && reverseOperation.created - lastUndoOp.created <= options.captureTimeout) {
            lastUndoOp.created = reverseOperation.created;
            lastUndoOp.toState = reverseOperation.toState;
            reverseOperation.deletedStructs.forEach(lastUndoOp.deletedStructs.add, lastUndoOp.deletedStructs);
          } else {
            this._undoBuffer.push(reverseOperation);
          }
          if (!this._redoing) {
            this._redoBuffer = [];
          }
        } else {
          this._redoBuffer.push(reverseOperation);
        }
      }
    });
  }
  undo () {
    this._undoing = true;
    const performedUndo = applyReverseOperation(this.y, this._scope, this._undoBuffer);
    this._undoing = false;
    return performedUndo
  }
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

function fromBinary (y, decoder) {
  integrateRemoteStructs(y, decoder);
  readDeleteSet(y, decoder);
}

function toBinary (y) {
  let encoder = new BinaryEncoder();
  writeStructs(y, encoder, new Map());
  writeDeleteSet(y, encoder);
  return encoder
}

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

function getFreshCnf () {
  let buffer = new BinaryEncoder();
  buffer.writeUint32(0);
  return {
    len: 0,
    buffer
  }
}

class AbstractPersistence {
  constructor (opts) {
    this.opts = opts;
    this.ys = new Map();
    this.mutualExclude = createMutualExclude();
  }

  _init (y) {
    let cnf = this.ys.get(y);
    if (cnf === undefined) {
      cnf = getFreshCnf();
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
      this.mutualExclude(function () {
        struct._toBinary(cnf.buffer);
        cnf.len++;
      });
    }
  }

  /* overwrite */
  retrieve (y, model, updates) {
    this.mutualExclude(function () {
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

  /* overwrite */
  persist (y) {
    return toBinary(y).createBuffer()
  }
}

class Y$1 extends NamedEventHandler {
  constructor (room, opts, persistence) {
    super();
    this.room = room;
    if (opts != null) {
      opts.connector.room = room;
    }
    this._contentReady = false;
    this._opts = opts;
    this.userID = generateUserID();
    this.share = {};
    this.ds = new DeleteStore(this);
    this.os = new OperationStore(this);
    this.ss = new StateStore(this);
    this._missingStructs = new Map();
    this._readyToIntegrate = [];
    this._transaction = null;
    this.connector = null;
    this.connected = false;
    let initConnection = () => {
      if (opts != null) {
        this.connector = new Y$1[opts.connector.name](this, opts.connector);
        this.connected = true;
        this.emit('connectorReady');
      }
    };
    if (persistence != null) {
      this.persistence = persistence;
      persistence._init(this).then(initConnection);
    } else {
      this.persistence = null;
      initConnection();
    }
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
  // fake _start for root properties (y.set('name', type))
  get _start () {
    return null
  }
  set _start (start) {
    return null
  }
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
  get (name) {
    return this.share[name]
  }
  disconnect () {
    if (this.connected) {
      this.connected = false;
      return this.connector.disconnect()
    } else {
      return Promise.resolve()
    }
  }
  reconnect () {
    if (!this.connected) {
      this.connected = true;
      return this.connector.reconnect()
    } else {
      return Promise.resolve()
    }
  }
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
  whenSynced () {
    return new Promise(resolve => {
      this.once('synced', () => {
        resolve();
      });
    })
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

Y$1.utils = {
  BinaryDecoder,
  UndoManager,
  getRelativePosition,
  fromRelativePosition,
  addType: addStruct,
  integrateRemoteStructs
};

Y$1.debug = browser;
browser.formatters.Y = messageToString;
browser.formatters.y = messageToRoomname;

module.exports = Y$1;
//# sourceMappingURL=y.node.js.map
