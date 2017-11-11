
/**
 * yjs - A framework for real-time p2p shared editing on any data
 * @version v13.0.0-28
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
    return this.user < id.user || (this.user === id.user && this.clock < id.clock)
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

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

/*! http://mths.be/fromcodepoint v0.2.1 by @mathias */
if (!String.fromCodePoint) {
	(function() {
		var defineProperty = (function() {
			// IE 8 only supports `Object.defineProperty` on DOM elements
			try {
				var object = {};
				var $defineProperty = Object.defineProperty;
				var result = $defineProperty(object, object, object) && $defineProperty;
			} catch(error) {}
			return result;
		}());
		var stringFromCharCode = String.fromCharCode;
		var floor = Math.floor;
		var fromCodePoint = function(_) {
			var MAX_SIZE = 0x4000;
			var codeUnits = [];
			var highSurrogate;
			var lowSurrogate;
			var index = -1;
			var length = arguments.length;
			if (!length) {
				return '';
			}
			var result = '';
			while (++index < length) {
				var codePoint = Number(arguments[index]);
				if (
					!isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
					codePoint < 0 || // not a valid Unicode code point
					codePoint > 0x10FFFF || // not a valid Unicode code point
					floor(codePoint) != codePoint // not an integer
				) {
					throw RangeError('Invalid code point: ' + codePoint);
				}
				if (codePoint <= 0xFFFF) { // BMP code point
					codeUnits.push(codePoint);
				} else { // Astral code point; split in surrogate halves
					// http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
					codePoint -= 0x10000;
					highSurrogate = (codePoint >> 10) + 0xD800;
					lowSurrogate = (codePoint % 0x400) + 0xDC00;
					codeUnits.push(highSurrogate, lowSurrogate);
				}
				if (index + 1 == length || codeUnits.length > MAX_SIZE) {
					result += stringFromCharCode.apply(null, codeUnits);
					codeUnits.length = 0;
				}
			}
			return result;
		};
		if (defineProperty) {
			defineProperty(String, 'fromCodePoint', {
				'value': fromCodePoint,
				'configurable': true,
				'writable': true
			});
		} else {
			String.fromCodePoint = fromCodePoint;
		}
	}());
}

/*! http://mths.be/codepointat v0.2.0 by @mathias */
if (!String.prototype.codePointAt) {
	(function() {
		var defineProperty = (function() {
			// IE 8 only supports `Object.defineProperty` on DOM elements
			try {
				var object = {};
				var $defineProperty = Object.defineProperty;
				var result = $defineProperty(object, object, object) && $defineProperty;
			} catch(error) {}
			return result;
		}());
		var codePointAt = function(position) {
			if (this == null) {
				throw TypeError();
			}
			var string = String(this);
			var size = string.length;
			// `ToInteger`
			var index = position ? Number(position) : 0;
			if (index != index) { // better `isNaN`
				index = 0;
			}
			// Account for out-of-bounds indices:
			if (index < 0 || index >= size) {
				return undefined;
			}
			// Get the first code unit
			var first = string.charCodeAt(index);
			var second;
			if ( // check if it’s the start of a surrogate pair
				first >= 0xD800 && first <= 0xDBFF && // high surrogate
				size > index + 1 // there is a next code unit
			) {
				second = string.charCodeAt(index + 1);
				if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
					// http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
					return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
				}
			}
			return first;
		};
		if (defineProperty) {
			defineProperty(String.prototype, 'codePointAt', {
				'value': codePointAt,
				'configurable': true,
				'writable': true
			});
		} else {
			String.prototype.codePointAt = codePointAt;
		}
	}());
}

var UTF8_1 = createCommonjsModule(function (module) {
// UTF8 : Manage UTF-8 strings in ArrayBuffers
if(module.require) {
  
  
}

var UTF8={
  // non UTF8 encoding detection (cf README file for details)
  'isNotUTF8': function(bytes, byteOffset, byteLength) {
    try {
      UTF8.getStringFromBytes(bytes, byteOffset, byteLength, true);
    } catch(e) {
      return true;
    }
    return false;
  },
  // UTF8 decoding functions
  'getCharLength': function(theByte) {
    // 4 bytes encoded char (mask 11110000)
    if(0xF0 == (theByte&0xF0)) {
      return 4;
    // 3 bytes encoded char (mask 11100000)
    } else if(0xE0 == (theByte&0xE0)) {
      return 3;
    // 2 bytes encoded char (mask 11000000)
    } else if(0xC0 == (theByte&0xC0)) {
      return 2;
    // 1 bytes encoded char
    } else if(theByte == (theByte&0x7F)) {
      return 1;
    }
    return 0;
  },
  'getCharCode': function(bytes, byteOffset, charLength) {
    var charCode = 0, mask = '';
    byteOffset = byteOffset || 0;
    // Retrieve charLength if not given
    charLength = charLength || UTF8.getCharLength(bytes[byteOffset]);
    if(charLength == 0) {
      throw new Error(bytes[byteOffset].toString(2)+' is not a significative' +
        ' byte (offset:'+byteOffset+').');
    }
    // Return byte value if charlength is 1
    if(1 === charLength) {
      return bytes[byteOffset];
    }
    // Test UTF8 integrity
    mask = '00000000'.slice(0, charLength) + 1 + '00000000'.slice(charLength + 1);
    if(bytes[byteOffset]&(parseInt(mask, 2))) {
      throw Error('Index ' + byteOffset + ': A ' + charLength + ' bytes' +
        ' encoded char' +' cannot encode the '+(charLength+1)+'th rank bit to 1.');
    }
    // Reading the first byte
    mask='0000'.slice(0,charLength+1)+'11111111'.slice(charLength+1);
    charCode+=(bytes[byteOffset]&parseInt(mask,2))<<((--charLength)*6);
    // Reading the next bytes
    while(charLength) {
      if(0x80!==(bytes[byteOffset+1]&0x80)
        ||0x40===(bytes[byteOffset+1]&0x40)) {
        throw Error('Index '+(byteOffset+1)+': Next bytes of encoded char'
          +' must begin with a "10" bit sequence.');
      }
      charCode += ((bytes[++byteOffset]&0x3F) << ((--charLength) * 6));
    }
    return charCode;
  },
  'getStringFromBytes': function(bytes, byteOffset, byteLength, strict) {
    var charLength, chars = [];
    byteOffset = byteOffset|0;
    byteLength=('number' === typeof byteLength ?
      byteLength :
      bytes.byteLength || bytes.length
    );
    for(; byteOffset < byteLength; byteOffset++) {
      charLength = UTF8.getCharLength(bytes[byteOffset]);
      if(byteOffset + charLength > byteLength) {
        if(strict) {
          throw Error('Index ' + byteOffset + ': Found a ' + charLength +
            ' bytes encoded char declaration but only ' +
            (byteLength - byteOffset) +' bytes are available.');
        }
      } else {
        chars.push(String.fromCodePoint(
          UTF8.getCharCode(bytes, byteOffset, charLength, strict)
        ));
      }
      byteOffset += charLength - 1;
    }
    return chars.join('');
  },
  // UTF8 encoding functions
  'getBytesForCharCode': function(charCode) {
    if(charCode < 128) {
      return 1;
    } else if(charCode < 2048) {
      return 2;
    } else if(charCode < 65536) {
      return 3;
    } else if(charCode < 2097152) {
      return 4;
    }
    throw new Error('CharCode '+charCode+' cannot be encoded with UTF8.');
  },
  'setBytesFromCharCode': function(charCode, bytes, byteOffset, neededBytes) {
    charCode = charCode|0;
    bytes = bytes || [];
    byteOffset = byteOffset|0;
    neededBytes = neededBytes || UTF8.getBytesForCharCode(charCode);
    // Setting the charCode as it to bytes if the byte length is 1
    if(1 == neededBytes) {
      bytes[byteOffset] = charCode;
    } else {
      // Computing the first byte
      bytes[byteOffset++] =
        (parseInt('1111'.slice(0, neededBytes), 2) << 8 - neededBytes) +
        (charCode >>> ((--neededBytes) * 6));
      // Computing next bytes
      for(;neededBytes>0;) {
        bytes[byteOffset++] = ((charCode>>>((--neededBytes) * 6))&0x3F)|0x80;
      }
    }
    return bytes;
  },
  'setBytesFromString': function(string, bytes, byteOffset, byteLength, strict) {
    string = string || '';
    bytes = bytes || [];
    byteOffset = byteOffset|0;
    byteLength = ('number' === typeof byteLength ?
      byteLength :
      bytes.byteLength||Infinity
    );
    for(var i = 0, j = string.length; i < j; i++) {
      var neededBytes = UTF8.getBytesForCharCode(string[i].codePointAt(0));
      if(strict && byteOffset + neededBytes > byteLength) {
        throw new Error('Not enought bytes to encode the char "' + string[i] +
          '" at the offset "' + byteOffset + '".');
      }
      UTF8.setBytesFromCharCode(string[i].codePointAt(0),
        bytes, byteOffset, neededBytes, strict);
      byteOffset += neededBytes;
    }
    return bytes;
  }
};

{
  module.exports = UTF8;
}
});

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
    return UTF8_1.getStringFromBytes(bytes)
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

function integrateRemoteStructs (decoder, encoder, y) {
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
    let bytes = UTF8_1.setBytesFromString(str);
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

function writeStructs (encoder, decoder, y, ss) {
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
  writeStructs(encoder, decoder, y, ss);
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
  integrateRemoteStructs(decoder, encoder, y);
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
  const createDelete = y.connector._forwardAppliedStructs;
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
    } else {
      // from local
      y.connector.broadcastStruct(this);
    }
    if (y.persistence !== null) {
      y.persistence.saveOperations(this);
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
      if (y.connector._forwardAppliedStructs || this._id.user === y.userID) {
        y.connector.broadcastStruct(this);
      }
      if (y.persistence !== null) {
        y.persistence.saveOperations(this);
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
  callEventListeners (event) {
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
  _callEventHandler (event) {
    const changedParentTypes = this._y._transaction.changedParentTypes;
    this._eventHandler.callEventListeners(event);
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
  constructor (yarray, remote) {
    super(yarray);
    this.remote = remote;
  }
}

class YArray extends Type {
  _callObserver (parentSubs, remote) {
    this._callEventHandler(new YArrayEvent(this, remote));
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
      if (prevJsonIns !== null && y !== null) {
        prevJsonIns._integrate(y);
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
  _callObserver (parentSubs, remote) {
    this._callEventHandler(new YMapEvent(this, parentSubs, remote));
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
        if (old instanceof ItemJSON && old._content[0] === value) {
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
    this._transact(y => {
      let left = null;
      let right = this._start;
      let count = 0;
      while (right !== null) {
        if (count <= pos && pos < count + right._length) {
          const splitDiff = pos - count;
          right = right._splitAt(this._y, pos - count);
          left = right._left;
          count += splitDiff;
          break
        }
        count += right._length;
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

function reflectChangesOnDom (events) {
  // Make sure that no filtered attributes are applied to the structure
  // if they were, delete them
  events.forEach(event => {
    const target = event.target;
    const keys = this._domFilter(target.nodeName, Array.from(event.keysChanged));
    if (keys === null) {
      target._delete();
    } else {
      const removeKeys = new Set(); // is a copy of event.keysChanged
      event.keysChanged.forEach(key => { removeKeys.add(key); });
      keys.forEach(key => {
        // remove all accepted keys from removeKeys
        removeKeys.delete(key);
      });
      // remove the filtered attribute
      removeKeys.forEach(key => {
        target.removeAttribute(key);
      });
    }
  });
  this._mutualExclude(() => {
    events.forEach(event => {
      const yxml = event.target;
      const dom = yxml._dom;
      if (dom != null) {
        // TODO: do this once before applying stuff
        // let anchorViewPosition = getAnchorViewPosition(yxml._scrollElement)
        if (yxml.constructor === YXmlText) {
          yxml._dom.nodeValue = yxml.toString();
        } else {
          // update attributes
          event.attributesChanged.forEach(attributeName => {
            const value = yxml.getAttribute(attributeName);
            if (value === undefined) {
              dom.removeAttribute(attributeName);
            } else {
              dom.setAttribute(attributeName, value);
            }
          });
          if (event.childListChanged) {
            // create fragment of undeleted nodes
            const fragment = document.createDocumentFragment();
            yxml.forEach(function (t) {
              fragment.append(t.getDom());
            });
            // remove remainding nodes
            let lastChild = dom.lastChild;
            while (lastChild !== null) {
              dom.removeChild(lastChild);
              lastChild = dom.lastChild;
            }
            // insert fragment of undeleted nodes
            dom.append(fragment);
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
  if (offset === 0) {
    return ['startof', type._id.user, type._id.clock || null, type._id.name || null, type._id.type || null]
  } else {
    let t = type._start;
    while (t !== null) {
      if (t._length >= offset) {
        return [t._id.user, t._id.clock + offset - 1]
      }
      if (t._right === null) {
        return [t._id.user, t._id.clock + t._length - 1]
      }
      if (!t._deleted) {
        offset -= t._length;
      }
      t = t._right;
    }
    return null
  }
}

function fromRelativePosition (y, rpos) {
  if (rpos[0] === 'startof') {
    let id;
    if (rpos[3] === null) {
      id = new ID(rpos[1], rpos[2]);
    } else {
      id = new RootID(rpos[3], rpos[4]);
    }
    return {
      type: y.os.get(id),
      offset: 0
    }
  } else {
    let offset = 0;
    let struct = y.os.findNodeWithUpperBound(new ID(rpos[0], rpos[1])).val;
    const parent = struct._parent;
    if (parent._deleted) {
      return null
    }
    if (!struct._deleted) {
      offset = rpos[1] - struct._id.clock + 1;
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
  beforeTransactionSelectionFixer = function _beforeTransactionSelectionFixer (y, remote) {
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

function afterTransactionSelectionFixer (y, remote) {
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
      shouldUpdate = true;
      anchorNode = sel.type.getDom();
      anchorOffset = sel.offset;
    }
  }
  if (to !== null) {
    let sel = fromRelativePosition(toY, to);
    if (sel !== null) {
      focusNode = sel.type.getDom();
      focusOffset = sel.offset;
      shouldUpdate = true;
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
  // delete, so the objects can be gc'd
  relativeSelection = null;
  browserSelection = null;
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

/**
 * This library modifies the diff-patch-match library by Neil Fraser
 * by removing the patch and match functionality and certain advanced
 * options in the diff function. The original license is as follows:
 *
 * ===
 *
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;


/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {Int} cursor_pos Expected edit position in text1 (optional)
 * @return {Array} Array of diff tuples.
 */
function diff_main(text1, text2, cursor_pos) {
  // Check for equality (speedup).
  if (text1 == text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  // Check cursor_pos within bounds
  if (cursor_pos < 0 || text1.length < cursor_pos) {
    cursor_pos = null;
  }

  // Trim off common prefix (speedup).
  var commonlength = diff_commonPrefix(text1, text2);
  var commonprefix = text1.substring(0, commonlength);
  text1 = text1.substring(commonlength);
  text2 = text2.substring(commonlength);

  // Trim off common suffix (speedup).
  commonlength = diff_commonSuffix(text1, text2);
  var commonsuffix = text1.substring(text1.length - commonlength);
  text1 = text1.substring(0, text1.length - commonlength);
  text2 = text2.substring(0, text2.length - commonlength);

  // Compute the diff on the middle block.
  var diffs = diff_compute_(text1, text2);

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix]);
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix]);
  }
  diff_cleanupMerge(diffs);
  if (cursor_pos != null) {
    diffs = fix_cursor(diffs, cursor_pos);
  }
  diffs = fix_emoji(diffs);
  return diffs;
}


/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_compute_(text1, text2) {
  var diffs;

  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]];
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]];
  }

  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  var i = longtext.indexOf(shorttext);
  if (i != -1) {
    // Shorter text is inside the longer text (speedup).
    diffs = [[DIFF_INSERT, longtext.substring(0, i)],
             [DIFF_EQUAL, shorttext],
             [DIFF_INSERT, longtext.substring(i + shorttext.length)]];
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length == 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  }

  // Check to see if the problem can be split in two.
  var hm = diff_halfMatch_(text1, text2);
  if (hm) {
    // A half-match was found, sort out the return data.
    var text1_a = hm[0];
    var text1_b = hm[1];
    var text2_a = hm[2];
    var text2_b = hm[3];
    var mid_common = hm[4];
    // Send both pairs off for separate processing.
    var diffs_a = diff_main(text1_a, text2_a);
    var diffs_b = diff_main(text1_b, text2_b);
    // Merge the results.
    return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
  }

  return diff_bisect_(text1, text2);
}


/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 * @private
 */
function diff_bisect_(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  var max_d = Math.ceil((text1_length + text2_length) / 2);
  var v_offset = max_d;
  var v_length = 2 * max_d;
  var v1 = new Array(v_length);
  var v2 = new Array(v_length);
  // Setting all elements to -1 is faster in Chrome & Firefox than mixing
  // integers and undefined.
  for (var x = 0; x < v_length; x++) {
    v1[x] = -1;
    v2[x] = -1;
  }
  v1[v_offset + 1] = 0;
  v2[v_offset + 1] = 0;
  var delta = text1_length - text2_length;
  // If the total number of characters is odd, then the front path will collide
  // with the reverse path.
  var front = (delta % 2 != 0);
  // Offsets for start and end of k loop.
  // Prevents mapping of space beyond the grid.
  var k1start = 0;
  var k1end = 0;
  var k2start = 0;
  var k2end = 0;
  for (var d = 0; d < max_d; d++) {
    // Walk the front path one step.
    for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      var k1_offset = v_offset + k1;
      var x1;
      if (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
        x1 = v1[k1_offset + 1];
      } else {
        x1 = v1[k1_offset - 1] + 1;
      }
      var y1 = x1 - k1;
      while (x1 < text1_length && y1 < text2_length &&
             text1.charAt(x1) == text2.charAt(y1)) {
        x1++;
        y1++;
      }
      v1[k1_offset] = x1;
      if (x1 > text1_length) {
        // Ran off the right of the graph.
        k1end += 2;
      } else if (y1 > text2_length) {
        // Ran off the bottom of the graph.
        k1start += 2;
      } else if (front) {
        var k2_offset = v_offset + delta - k1;
        if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
          // Mirror x2 onto top-left coordinate system.
          var x2 = text1_length - v2[k2_offset];
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      var k2_offset = v_offset + k2;
      var x2;
      if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
        x2 = v2[k2_offset + 1];
      } else {
        x2 = v2[k2_offset - 1] + 1;
      }
      var y2 = x2 - k2;
      while (x2 < text1_length && y2 < text2_length &&
             text1.charAt(text1_length - x2 - 1) ==
             text2.charAt(text2_length - y2 - 1)) {
        x2++;
        y2++;
      }
      v2[k2_offset] = x2;
      if (x2 > text1_length) {
        // Ran off the left of the graph.
        k2end += 2;
      } else if (y2 > text2_length) {
        // Ran off the top of the graph.
        k2start += 2;
      } else if (!front) {
        var k1_offset = v_offset + delta - k2;
        if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
          var x1 = v1[k1_offset];
          var y1 = v_offset + x1 - k1_offset;
          // Mirror x2 onto top-left coordinate system.
          x2 = text1_length - x2;
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or
  // number of diffs equals number of characters, no commonality at all.
  return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
}


/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @return {Array} Array of diff tuples.
 */
function diff_bisectSplit_(text1, text2, x, y) {
  var text1a = text1.substring(0, x);
  var text2a = text2.substring(0, y);
  var text1b = text1.substring(x);
  var text2b = text2.substring(y);

  // Compute both diffs serially.
  var diffs = diff_main(text1a, text2a);
  var diffsb = diff_main(text1b, text2b);

  return diffs.concat(diffsb);
}


/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
}


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
}


/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 */
function diff_halfMatch_(text1, text2) {
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) != -1) {
      var prefixLength = diff_commonPrefix(longtext.substring(i),
                                           shorttext.substring(j));
      var suffixLength = diff_commonSuffix(longtext.substring(0, i),
                                           shorttext.substring(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.substring(j - suffixLength, j) +
            shorttext.substring(j, j + prefixLength);
        best_longtext_a = longtext.substring(0, i - suffixLength);
        best_longtext_b = longtext.substring(i + prefixLength);
        best_shorttext_a = shorttext.substring(0, j - suffixLength);
        best_shorttext_b = shorttext.substring(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [best_longtext_a, best_longtext_b,
              best_shorttext_a, best_shorttext_b, best_common];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
}


/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {Array} diffs Array of diff tuples.
 */
function diff_cleanupMerge(diffs) {
  diffs.push([DIFF_EQUAL, '']);  // Add a dummy entry at the end.
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete + count_insert > 1) {
          if (count_delete !== 0 && count_insert !== 0) {
            // Factor out any common prefixies.
            commonlength = diff_commonPrefix(text_insert, text_delete);
            if (commonlength !== 0) {
              if ((pointer - count_delete - count_insert) > 0 &&
                  diffs[pointer - count_delete - count_insert - 1][0] ==
                  DIFF_EQUAL) {
                diffs[pointer - count_delete - count_insert - 1][1] +=
                    text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL,
                                    text_insert.substring(0, commonlength)]);
                pointer++;
              }
              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            }
            // Factor out any common suffixies.
            commonlength = diff_commonSuffix(text_insert, text_delete);
            if (commonlength !== 0) {
              diffs[pointer][1] = text_insert.substring(text_insert.length -
                  commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length -
                  commonlength);
              text_delete = text_delete.substring(0, text_delete.length -
                  commonlength);
            }
          }
          // Delete the offending records and add the merged ones.
          if (count_delete === 0) {
            diffs.splice(pointer - count_insert,
                count_delete + count_insert, [DIFF_INSERT, text_insert]);
          } else if (count_insert === 0) {
            diffs.splice(pointer - count_delete,
                count_delete + count_insert, [DIFF_DELETE, text_delete]);
          } else {
            diffs.splice(pointer - count_delete - count_insert,
                count_delete + count_insert, [DIFF_DELETE, text_delete],
                [DIFF_INSERT, text_insert]);
          }
          pointer = pointer - count_delete - count_insert +
                    (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
        } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop();  // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  var changes = false;
  pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL &&
        diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length -
          diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] +
            diffs[pointer][1].substring(0, diffs[pointer][1].length -
                                        diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
          diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] =
            diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
            diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    diff_cleanupMerge(diffs);
  }
}


var diff = diff_main;
diff.INSERT = DIFF_INSERT;
diff.DELETE = DIFF_DELETE;
diff.EQUAL = DIFF_EQUAL;

var diff_1 = diff;

/*
 * Modify a diff such that the cursor position points to the start of a change:
 * E.g.
 *   cursor_normalize_diff([[DIFF_EQUAL, 'abc']], 1)
 *     => [1, [[DIFF_EQUAL, 'a'], [DIFF_EQUAL, 'bc']]]
 *   cursor_normalize_diff([[DIFF_INSERT, 'new'], [DIFF_DELETE, 'xyz']], 2)
 *     => [2, [[DIFF_INSERT, 'new'], [DIFF_DELETE, 'xy'], [DIFF_DELETE, 'z']]]
 *
 * @param {Array} diffs Array of diff tuples
 * @param {Int} cursor_pos Suggested edit position. Must not be out of bounds!
 * @return {Array} A tuple [cursor location in the modified diff, modified diff]
 */
function cursor_normalize_diff (diffs, cursor_pos) {
  if (cursor_pos === 0) {
    return [DIFF_EQUAL, diffs];
  }
  for (var current_pos = 0, i = 0; i < diffs.length; i++) {
    var d = diffs[i];
    if (d[0] === DIFF_DELETE || d[0] === DIFF_EQUAL) {
      var next_pos = current_pos + d[1].length;
      if (cursor_pos === next_pos) {
        return [i + 1, diffs];
      } else if (cursor_pos < next_pos) {
        // copy to prevent side effects
        diffs = diffs.slice();
        // split d into two diff changes
        var split_pos = cursor_pos - current_pos;
        var d_left = [d[0], d[1].slice(0, split_pos)];
        var d_right = [d[0], d[1].slice(split_pos)];
        diffs.splice(i, 1, d_left, d_right);
        return [i + 1, diffs];
      } else {
        current_pos = next_pos;
      }
    }
  }
  throw new Error('cursor_pos is out of bounds!')
}

/*
 * Modify a diff such that the edit position is "shifted" to the proposed edit location (cursor_position).
 *
 * Case 1)
 *   Check if a naive shift is possible:
 *     [0, X], [ 1, Y] -> [ 1, Y], [0, X]    (if X + Y === Y + X)
 *     [0, X], [-1, Y] -> [-1, Y], [0, X]    (if X + Y === Y + X) - holds same result
 * Case 2)
 *   Check if the following shifts are possible:
 *     [0, 'pre'], [ 1, 'prefix'] -> [ 1, 'pre'], [0, 'pre'], [ 1, 'fix']
 *     [0, 'pre'], [-1, 'prefix'] -> [-1, 'pre'], [0, 'pre'], [-1, 'fix']
 *         ^            ^
 *         d          d_next
 *
 * @param {Array} diffs Array of diff tuples
 * @param {Int} cursor_pos Suggested edit position. Must not be out of bounds!
 * @return {Array} Array of diff tuples
 */
function fix_cursor (diffs, cursor_pos) {
  var norm = cursor_normalize_diff(diffs, cursor_pos);
  var ndiffs = norm[1];
  var cursor_pointer = norm[0];
  var d = ndiffs[cursor_pointer];
  var d_next = ndiffs[cursor_pointer + 1];

  if (d == null) {
    // Text was deleted from end of original string,
    // cursor is now out of bounds in new string
    return diffs;
  } else if (d[0] !== DIFF_EQUAL) {
    // A modification happened at the cursor location.
    // This is the expected outcome, so we can return the original diff.
    return diffs;
  } else {
    if (d_next != null && d[1] + d_next[1] === d_next[1] + d[1]) {
      // Case 1)
      // It is possible to perform a naive shift
      ndiffs.splice(cursor_pointer, 2, d_next, d);
      return merge_tuples(ndiffs, cursor_pointer, 2)
    } else if (d_next != null && d_next[1].indexOf(d[1]) === 0) {
      // Case 2)
      // d[1] is a prefix of d_next[1]
      // We can assume that d_next[0] !== 0, since d[0] === 0
      // Shift edit locations..
      ndiffs.splice(cursor_pointer, 2, [d_next[0], d[1]], [0, d[1]]);
      var suffix = d_next[1].slice(d[1].length);
      if (suffix.length > 0) {
        ndiffs.splice(cursor_pointer + 2, 0, [d_next[0], suffix]);
      }
      return merge_tuples(ndiffs, cursor_pointer, 3)
    } else {
      // Not possible to perform any modification
      return diffs;
    }
  }
}

/*
 * Check diff did not split surrogate pairs.
 * Ex. [0, '\uD83D'], [-1, '\uDC36'], [1, '\uDC2F'] -> [-1, '\uD83D\uDC36'], [1, '\uD83D\uDC2F']
 *     '\uD83D\uDC36' === '🐶', '\uD83D\uDC2F' === '🐯'
 *
 * @param {Array} diffs Array of diff tuples
 * @return {Array} Array of diff tuples
 */
function fix_emoji (diffs) {
  var compact = false;
  var starts_with_pair_end = function(str) {
    return str.charCodeAt(0) >= 0xDC00 && str.charCodeAt(0) <= 0xDFFF;
  };
  var ends_with_pair_start = function(str) {
    return str.charCodeAt(str.length-1) >= 0xD800 && str.charCodeAt(str.length-1) <= 0xDBFF;
  };
  for (var i = 2; i < diffs.length; i += 1) {
    if (diffs[i-2][0] === DIFF_EQUAL && ends_with_pair_start(diffs[i-2][1]) &&
        diffs[i-1][0] === DIFF_DELETE && starts_with_pair_end(diffs[i-1][1]) &&
        diffs[i][0] === DIFF_INSERT && starts_with_pair_end(diffs[i][1])) {
      compact = true;

      diffs[i-1][1] = diffs[i-2][1].slice(-1) + diffs[i-1][1];
      diffs[i][1] = diffs[i-2][1].slice(-1) + diffs[i][1];

      diffs[i-2][1] = diffs[i-2][1].slice(0, -1);
    }
  }
  if (!compact) {
    return diffs;
  }
  var fixed_diffs = [];
  for (var i = 0; i < diffs.length; i += 1) {
    if (diffs[i][1].length > 0) {
      fixed_diffs.push(diffs[i]);
    }
  }
  return fixed_diffs;
}

/*
 * Try to merge tuples with their neigbors in a given range.
 * E.g. [0, 'a'], [0, 'b'] -> [0, 'ab']
 *
 * @param {Array} diffs Array of diff tuples.
 * @param {Int} start Position of the first element to merge (diffs[start] is also merged with diffs[start - 1]).
 * @param {Int} length Number of consecutive elements to check.
 * @return {Array} Array of merged diff tuples.
 */
function merge_tuples (diffs, start, length) {
  // Check from (start-1) to (start+length).
  for (var i = start + length - 1; i >= 0 && i >= start - 1; i--) {
    if (i + 1 < diffs.length) {
      var left_d = diffs[i];
      var right_d = diffs[i+1];
      if (left_d[0] === right_d[1]) {
        diffs.splice(i, 2, [left_d[0], left_d[1] + right_d[1]]);
      }
    }
  }
  return diffs;
}

/* global MutationObserver */

function domToYXml (parent, doms) {
  const types = [];
  doms.forEach(d => {
    if (d._yxml != null && d._yxml !== false) {
      d._yxml._unbindFromDom();
    }
    if (parent._domFilter(d, []) !== null) {
      let type;
      if (d.nodeType === d.TEXT_NODE) {
        type = new YXmlText(d);
      } else if (d.nodeType === d.ELEMENT_NODE) {
        type = new YXmlFragment._YXmlElement(d, parent._domFilter);
      } else {
        throw new Error('Unsupported node!')
      }
      type.enableSmartScrolling(parent._scrollElement);
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
      if (!n._deleted && n.constructor === YXmlFragment._YXmlElement && n._start !== null) {
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
        this._domObserver.takeRecords();
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
    this.forEach(xml => {
      xml.setDomFilter(f);
    });
  }
  _callObserver (parentSubs, remote) {
    this._callEventHandler(new YXmlEvent(this, parentSubs, remote));
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
  }
  insertDomElementsAfter (prev, doms) {
    const types = domToYXml(this, doms);
    this.insertAfter(prev, types);
    return types
  }
  insertDomElements (pos, doms) {
    const types = domToYXml(this, doms);
    this.insert(pos, types);
    return types
  }
  getDom () {
    return this._dom
  }
  bindToDom (dom) {
    if (this._dom != null) {
      this._unbindFromDom();
    }
    if (dom._yxml != null) {
      dom._yxml._unbindFromDom();
    }
    if (MutationObserver == null) {
      throw new Error('Not able to bind to a DOM element, because MutationObserver is not available!')
    }
    dom.innerHTML = '';
    this._dom = dom;
    dom._yxml = this;
    this.forEach(t => {
      dom.insertBefore(t.getDom(), null);
    });
    this._bindToDom(dom);
  }
  // binds to a dom element
  // Only call if dom and YXml are isomorph
  _bindToDom (dom) {
    if (this._parent === null || this._parent._dom != null || typeof MutationObserver === 'undefined') {
      // only bind if parent did not already bind
      return
    }
    this._y.on('beforeTransaction', () => {
      this._domObserverListener(this._domObserver.takeRecords());
    });
    this._y.on('beforeTransaction', beforeTransactionSelectionFixer);
    this._y.on('afterTransaction', afterTransactionSelectionFixer);
    // Apply Y.Xml events to dom
    this.observeDeep(reflectChangesOnDom.bind(this));
    // Apply Dom changes on Y.Xml
    this._domObserverListener = mutations => {
      this._mutualExclude(() => {
        this._y.transact(() => {
          let diffChildren = new Set();
          mutations.forEach(mutation => {
            const dom = mutation.target;
            const yxml = dom._yxml;
            if (yxml == null) {
              // dom element is filtered
              return
            }
            switch (mutation.type) {
              case 'characterData':
                var diffs = diff_1(yxml.toString(), dom.nodeValue);
                var pos = 0;
                for (var i = 0; i < diffs.length; i++) {
                  var d = diffs[i];
                  if (d[0] === 0) { // EQUAL
                    pos += d[1].length;
                  } else if (d[0] === -1) { // DELETE
                    yxml.delete(pos, d[1].length);
                  } else { // INSERT
                    yxml.insert(pos, d[1]);
                    pos += d[1].length;
                  }
                }
                break
              case 'attributes':
                let name = mutation.attributeName;
                // check if filter accepts attribute
                if (this._domFilter(dom, [name]).length > 0 && this.constructor !== YXmlFragment) {
                  var val = dom.getAttribute(name);
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
    return dom
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null;
    const origin = this._origin !== null ? this._origin._lastId : null;
    return `YXml(id:${logID(this._id)},left:${logID(left)},origin:${logID(origin)},right:${this._right},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}

// import diff from 'fast-diff'
class YXmlElement extends YXmlFragment {
  constructor (arg1, arg2) {
    super();
    this.nodeName = null;
    this._scrollElement = null;
    if (typeof arg1 === 'string') {
      this.nodeName = arg1.toUpperCase();
    } else if (arg1 != null && arg1.nodeType != null && arg1.nodeType === arg1.ELEMENT_NODE) {
      this.nodeName = arg1.nodeName;
      this._setDom(arg1);
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
  _setDom (dom) {
    if (this._dom != null) {
      throw new Error('Only call this method if you know what you are doing ;)')
    } else if (dom._yxml != null) { // TODO do i need to check this? - no.. but for dev purps..
      throw new Error('Already bound to an YXml type')
    } else {
      this._dom = dom;
      dom._yxml = this;
      // tag is already set in constructor
      // set attributes
      let attrNames = [];
      for (let i = 0; i < dom.attributes.length; i++) {
        attrNames.push(dom.attributes[i].name);
      }
      attrNames = this._domFilter(dom, attrNames);
      for (let i = 0; i < attrNames.length; i++) {
        let attrName = attrNames[i];
        let attrValue = dom.getAttribute(attrName);
        this.setAttribute(attrName, attrValue);
      }
      this.insertDomElements(0, Array.prototype.slice.call(dom.childNodes));
      this._bindToDom(dom);
      return dom
    }
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
    if (this._domFilter === defaultDomFilter && this._parent instanceof YXmlFragment) {
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
      obj[key] = value._content[0];
    }
    return obj
  }
  getDom (_document) {
    _document = _document || document;
    let dom = this._dom;
    if (dom == null) {
      dom = _document.createElement(this.nodeName);
      this._dom = dom;
      dom._yxml = this;
      let attrs = this.getAttributes();
      for (let key in attrs) {
        dom.setAttribute(key, attrs[key]);
      }
      this.forEach(yxml => {
        dom.appendChild(yxml.getDom(_document));
      });
      this._bindToDom(dom);
    }
    return dom
  }
}

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
    return this.user < id.user || (this.user === id.user && (this.name < id.name || (this.name === id.name && this.type < id.type)))
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
  off (name, f) {
    if (name == null || f == null) {
      throw new Error('You must specify event name and function!')
    }
    const listener = this._eventListener.get(name);
    if (listener !== undefined) {
      listener.remove(f);
    }
  }
  emit (name, ...args) {
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
  constructor (y) {
    this.created = new Date();
    const beforeState = y._transaction.beforeState;
    this.toState = new ID(y.userID, y.ss.getState(y.userID) - 1);
    if (beforeState.has(y.userID)) {
      this.fromState = new ID(y.userID, beforeState.get(y.userID));
    } else {
      this.fromState = this.toState;
    }
    this.deletedStructs = y._transaction.deletedStructs;
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
    y.on('afterTransaction', (y, remote) => {
      if (!remote && y._transaction.changedParentTypes.has(scope)) {
        let reverseOperation = new ReverseOperation(y);
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
          integrateRemoteStructs(decoder, encoder, y, senderConn, sender);
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

// import BinaryEncoder from './Binary/Encoder.js'

function extendPersistence (Y) {
  class AbstractPersistence {
    constructor (y, opts) {
      this.y = y;
      this.opts = opts;
      this.saveOperationsBuffer = [];
      this.log = Y.debug('y:persistence');
    }

    saveToMessageQueue (binary) {
      this.log('Room %s: Save message to message queue', this.y.options.connector.room);
    }

    saveOperations (ops) {
      ops = ops.map(function (op) {
        return Y.Struct[op.struct].encode(op)
      });
      /*
      const saveOperations = () => {
        if (this.saveOperationsBuffer.length > 0) {
          let encoder = new BinaryEncoder()
          encoder.writeVarString(this.opts.room)
          encoder.writeVarString('update')
          let ops = this.saveOperationsBuffer
          this.saveOperationsBuffer = []
          let length = ops.length
          encoder.writeUint32(length)
          for (var i = 0; i < length; i++) {
            let op = ops[i]
            Y.Struct[op.struct].binaryEncode(encoder, op)
          }
          this.saveToMessageQueue(encoder.createBuffer())
        }
      }
      */
      if (this.saveOperationsBuffer.length === 0) {
        this.saveOperationsBuffer = ops;
      } else {
        this.saveOperationsBuffer = this.saveOperationsBuffer.concat(ops);
      }
    }
  }

  Y.AbstractPersistence = AbstractPersistence;
}

YXmlFragment._YXmlElement = YXmlElement;

class Y$1 extends NamedEventHandler {
  constructor (opts) {
    super();
    this._opts = opts;
    this.userID = opts._userID != null ? opts._userID : generateUserID();
    this.share = {};
    this.ds = new DeleteStore(this);
    this.os = new OperationStore(this);
    this.ss = new StateStore(this);
    this.connector = new Y$1[opts.connector.name](this, opts.connector);
    if (opts.persistence != null) {
      this.persistence = new Y$1[opts.persistence.name](this, opts.persistence);
      this.persistence.retrieveContent();
    } else {
      this.persistence = null;
    }
    this.connected = true;
    this._missingStructs = new Map();
    this._readyToIntegrate = [];
    this._transaction = null;
  }
  _beforeChange () {}
  transact (f, remote = false) {
    let initialCall = this._transaction === null;
    if (initialCall) {
      this.emit('beforeTransaction', this, remote);
      this._transaction = new Transaction(this);
    }
    try {
      f(this);
    } catch (e) {
      console.error(e);
    }
    if (initialCall) {
      // emit change events on changed types
      this._transaction.changedTypes.forEach(function (subs, type) {
        if (!type._deleted) {
          type._callObserver(subs, remote);
        }
      });
      this._transaction.changedParentTypes.forEach(function (events, type) {
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
          type._deepEventHandler.callEventListeners(events);
        }
      });
      // when all changes & events are processed, emit afterTransaction event
      this.emit('afterTransaction', this, remote);
      this._transaction = null;
    }
  }
  // fake _start for root properties (y.set('name', type))
  get _start () {
    return null
  }
  set _start (start) {
    return null
  }
  get room () {
    return this._opts.connector.room
  }
  define (name, TypeConstructor) {
    let id = new RootID(name, TypeConstructor);
    let type = this.os.get(id);
    if (type === null) {
      type = new TypeConstructor();
      type._id = id;
      type._parent = this;
      type._integrate(this);
      if (this.share[name] !== undefined) {
        throw new Error('Type is already defined with a different constructor!')
      }
    }
    if (this.share[name] === undefined) {
      this.share[name] = type;
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
    this.share = null;
    if (this.connector.destroy != null) {
      this.connector.destroy();
    } else {
      this.connector.disconnect();
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
Y$1.Persisence = extendPersistence;
Y$1.Array = YArray;
Y$1.Map = YMap;
Y$1.Text = YText;
Y$1.XmlElement = YXmlElement;
Y$1.XmlFragment = YXmlFragment;
Y$1.XmlText = YXmlText;

Y$1.utils = {
  BinaryDecoder,
  UndoManager
};

Y$1.debug = browser;
browser.formatters.Y = messageToString;
browser.formatters.y = messageToRoomname;

module.exports = Y$1;
//# sourceMappingURL=y.node.js.map
