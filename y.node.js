
/**
 * yjs - A framework for real-time p2p shared editing on any data
 * @version v13.0.0-9
 * @license MIT
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Y = factory());
}(this, (function () { 'use strict';

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
		'use strict'; // needed to support `apply`/`call` with `undefined`/`null`
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

const bits7 = 0b1111111;
const bits8 = 0b11111111;

class BinaryEncoder {
  constructor () {
    this.data = [];
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
  writeOpID (id) {
    let user = id[0];
    this.writeVarUint(user);
    if (user !== 0xFFFFFF) {
      this.writeVarUint(id[1]);
    } else {
      this.writeVarString(id[1]);
    }
  }
}

class BinaryDecoder {
  constructor (buffer) {
    if (buffer instanceof ArrayBuffer) {
      this.uint8arr = new Uint8Array(buffer);
    } else if (buffer instanceof Uint8Array) {
      this.uint8arr = buffer;
    } else {
      throw new Error('Expected an ArrayBuffer or Uint8Array!')
    }
    this.pos = 0;
  }
  skip8 () {
    this.pos++;
  }
  readUint8 () {
    return this.uint8arr[this.pos++]
  }
  readUint32 () {
    let uint =
      this.uint8arr[this.pos] +
      (this.uint8arr[this.pos + 1] << 8) +
      (this.uint8arr[this.pos + 2] << 16) +
      (this.uint8arr[this.pos + 3] << 24);
    this.pos += 4;
    return uint
  }
  peekUint8 () {
    return this.uint8arr[this.pos]
  }
  readVarUint () {
    let num = 0;
    let len = 0;
    while (true) {
      let r = this.uint8arr[this.pos++];
      num = num | ((r & bits7) << len);
      len += 7;
      if (r < 1 << 7) {
        return num >>> 0 // return unsigned number!
      }
      if (len > 35) {
        throw new Error('Integer out of range!')
      }
    }
  }
  readVarString () {
    let len = this.readVarUint();
    let bytes = new Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = this.uint8arr[this.pos++];
    }
    return UTF8_1.getStringFromBytes(bytes)
  }
  peekVarString () {
    let pos = this.pos;
    let s = this.readVarString();
    this.pos = pos;
    return s
  }
  readOpID () {
    let user = this.readVarUint();
    if (user !== 0xFFFFFF) {
      return [user, this.readVarUint()]
    } else {
      return [user, this.readVarString()]
    }
  }
}

function formatYjsMessage (buffer) {
  let decoder = new BinaryDecoder(buffer);
  decoder.readVarString(); // read roomname
  let type = decoder.readVarString();
  let strBuilder = [];
  strBuilder.push('\n === ' + type + ' ===\n');
  if (type === 'update') {
    logMessageUpdate(decoder, strBuilder);
  } else if (type === 'sync step 1') {
    logMessageSyncStep1(decoder, strBuilder);
  } else if (type === 'sync step 2') {
    logMessageSyncStep2(decoder, strBuilder);
  } else {
    strBuilder.push('-- Unknown message type - probably an encoding issue!!!');
  }
  return strBuilder.join('')
}

function formatYjsMessageType (buffer) {
  let decoder = new BinaryDecoder(buffer);
  decoder.readVarString(); // roomname
  return decoder.readVarString()
}

function logMessageUpdate (decoder, strBuilder) {
  let len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    strBuilder.push(JSON.stringify(Y.Struct.binaryDecodeOperation(decoder)) + '\n');
  }
}

function computeMessageUpdate (decoder, encoder, conn) {
  if (conn.y.db.forwardAppliedOperations) {
    let messagePosition = decoder.pos;
    let len = decoder.readUint32();
    let delops = [];
    for (let i = 0; i < len; i++) {
      let op = Y.Struct.binaryDecodeOperation(decoder);
      if (op.struct === 'Delete') {
        delops.push(op);
      }
    }
    if (delops.length > 0) {
      conn.broadcastOps(delops);
    }
    decoder.pos = messagePosition;
  }
  conn.y.db.applyOperations(decoder);
}

function sendSyncStep1 (conn, syncUser) {
  conn.y.db.requestTransaction(function * () {
    let encoder = new BinaryEncoder();
    encoder.writeVarString(conn.opts.room || '');
    encoder.writeVarString('sync step 1');
    encoder.writeVarString(conn.authInfo || '');
    encoder.writeVarUint(conn.protocolVersion);
    let preferUntransformed = conn.preferUntransformed && this.os.length === 0; // TODO: length may not be defined
    encoder.writeUint8(preferUntransformed ? 1 : 0);
    yield * this.writeStateSet(encoder);
    conn.send(syncUser, encoder.createBuffer());
  });
}

function logMessageSyncStep1 (decoder, strBuilder) {
  let auth = decoder.readVarString();
  let protocolVersion = decoder.readVarUint();
  let preferUntransformed = decoder.readUint8() === 1;
  strBuilder.push(`
  - auth: "${auth}"
  - protocolVersion: ${protocolVersion}
  - preferUntransformed: ${preferUntransformed}
`);
  logSS(decoder, strBuilder);
}

function computeMessageSyncStep1 (decoder, encoder, conn, senderConn, sender) {
  let protocolVersion = decoder.readVarUint();
  let preferUntransformed = decoder.readUint8() === 1;

  // check protocol version
  if (protocolVersion !== conn.protocolVersion) {
    console.warn(
      `You tried to sync with a yjs instance that has a different protocol version
      (You: ${protocolVersion}, Client: ${protocolVersion}).
      The sync was stopped. You need to upgrade your dependencies (especially Yjs & the Connector)!
      `);
    conn.y.destroy();
  }

  // send sync step 2
  conn.y.db.requestTransaction(function * () {
    encoder.writeVarString('sync step 2');
    encoder.writeVarString(conn.authInfo || '');

    if (preferUntransformed) {
      encoder.writeUint8(1);
      yield * this.writeOperationsUntransformed(encoder);
    } else {
      encoder.writeUint8(0);
      yield * this.writeOperations(encoder, decoder);
    }

    yield * this.writeDeleteSet(encoder);
    conn.send(senderConn.uid, encoder.createBuffer());
    senderConn.receivedSyncStep2 = true;
  });
  if (conn.role === 'slave') {
    sendSyncStep1(conn, sender);
  }
  return conn.y.db.whenTransactionsFinished()
}

function logSS (decoder, strBuilder) {
  strBuilder.push('  == SS: \n');
  let len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint();
    let clock = decoder.readVarUint();
    strBuilder.push(`     ${user}: ${clock}\n`);
  }
}

function logOS (decoder, strBuilder) {
  strBuilder.push('  == OS: \n');
  let len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let op = Y.Struct.binaryDecodeOperation(decoder);
    strBuilder.push(JSON.stringify(op) + '\n');
  }
}

function logDS (decoder, strBuilder) {
  strBuilder.push('  == DS: \n');
  let len = decoder.readUint32();
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint();
    strBuilder.push(`    User: ${user}: `);
    let len2 = decoder.readVarUint();
    for (let j = 0; j < len2; j++) {
      let from = decoder.readVarUint();
      let to = decoder.readVarUint();
      let gc = decoder.readUint8() === 1;
      strBuilder.push(`[${from}, ${to}, ${gc}]`);
    }
  }
}

function logMessageSyncStep2 (decoder, strBuilder) {
  strBuilder.push('     - auth: ' + decoder.readVarString() + '\n');
  let osTransformed = decoder.readUint8() === 1;
  strBuilder.push('     - osUntransformed: ' + osTransformed + '\n');
  logOS(decoder, strBuilder);
  if (osTransformed) {
    logSS(decoder, strBuilder);
  }
  logDS(decoder, strBuilder);
}

function computeMessageSyncStep2 (decoder, encoder, conn, senderConn, sender) {
  var db = conn.y.db;
  let defer = senderConn.syncStep2;

  // apply operations first
  db.requestTransaction(function * () {
    let osUntransformed = decoder.readUint8();
    if (osUntransformed === 1) {
      yield * this.applyOperationsUntransformed(decoder);
    } else {
      this.store.applyOperations(decoder);
    }
  });
  // then apply ds
  db.requestTransaction(function * () {
    yield * this.applyDeleteSet(decoder);
  });
  return db.whenTransactionsFinished().then(() => {
    conn._setSyncedWith(sender);
    defer.resolve();
  })
}

function extendConnector (Y/* :any */) {
  class AbstractConnector {
    /*
      opts contains the following information:
       role : String Role of this client ("master" or "slave")
    */
    constructor (y, opts) {
      this.y = y;
      if (opts == null) {
        opts = {};
      }
      this.opts = opts;
      // Prefer to receive untransformed operations. This does only work if
      // this client receives operations from only one other client.
      // In particular, this does not work with y-webrtc.
      // It will work with y-websockets-client
      this.preferUntransformed = opts.preferUntransformed || false;
      if (opts.role == null || opts.role === 'master') {
        this.role = 'master';
      } else if (opts.role === 'slave') {
        this.role = 'slave';
      } else {
        throw new Error("Role must be either 'master' or 'slave'!")
      }
      this.log = Y.debug('y:connector');
      this.logMessage = Y.debug('y:connector-message');
      this.y.db.forwardAppliedOperations = opts.forwardAppliedOperations || false;
      this.role = opts.role;
      this.connections = new Map();
      this.isSynced = false;
      this.userEventListeners = [];
      this.whenSyncedListeners = [];
      this.currentSyncTarget = null;
      this.debug = opts.debug === true;
      this.broadcastOpBuffer = [];
      this.protocolVersion = 11;
      this.authInfo = opts.auth || null;
      this.checkAuth = opts.checkAuth || function () { return Promise.resolve('write') }; // default is everyone has write access
      if (opts.generateUserId !== false) {
        this.setUserId(Y.utils.generateUserId());
      }
    }
    reconnect () {
      this.log('reconnecting..');
      return this.y.db.startGarbageCollector()
    }
    disconnect () {
      this.log('discronnecting..');
      this.connections = new Map();
      this.isSynced = false;
      this.currentSyncTarget = null;
      this.whenSyncedListeners = [];
      this.y.db.stopGarbageCollector();
      return this.y.db.whenTransactionsFinished()
    }
    repair () {
      this.log('Repairing the state of Yjs. This can happen if messages get lost, and Yjs detects that something is wrong. If this happens often, please report an issue here: https://github.com/y-js/yjs/issues');
      this.connections.forEach(user => { user.isSynced = false; });
      this.isSynced = false;
      this.currentSyncTarget = null;
      this.findNextSyncTarget();
    }
    setUserId (userId) {
      if (this.userId == null) {
        if (!Number.isInteger(userId)) {
          let err = new Error('UserId must be an integer!');
          this.y.emit('error', err);
          throw err
        }
        this.log('Set userId to "%s"', userId);
        this.userId = userId;
        return this.y.db.setUserId(userId)
      } else {
        return null
      }
    }
    onUserEvent (f) {
      this.userEventListeners.push(f);
    }
    removeUserEventListener (f) {
      this.userEventListeners = this.userEventListeners.filter(g => f !== g);
    }
    userLeft (user) {
      if (this.connections.has(user)) {
        this.log('%s: User left %s', this.userId, user);
        this.connections.delete(user);
        if (user === this.currentSyncTarget) {
          this.currentSyncTarget = null;
          this.findNextSyncTarget();
        }
        for (var f of this.userEventListeners) {
          f({
            action: 'userLeft',
            user: user
          });
        }
      }
    }
    userJoined (user, role) {
      if (role == null) {
        throw new Error('You must specify the role of the joined user!')
      }
      if (this.connections.has(user)) {
        throw new Error('This user already joined!')
      }
      this.log('%s: User joined %s', this.userId, user);
      this.connections.set(user, {
        uid: user,
        isSynced: false,
        role: role,
        processAfterAuth: [],
        auth: null,
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
      if (this.currentSyncTarget == null) {
        this.findNextSyncTarget();
      }
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
    findNextSyncTarget () {
      if (this.currentSyncTarget != null || this.role === 'slave') {
        return // "The current sync has not finished or this is controlled by a master!"
      }

      var syncUser = null;
      for (var [uid, user] of this.connections) {
        if (!user.isSynced) {
          syncUser = uid;
          break
        }
      }
      var conn = this;
      if (syncUser != null) {
        this.currentSyncTarget = syncUser;
        sendSyncStep1(this, syncUser);
      } else {
        if (!conn.isSynced) {
          this.y.db.requestTransaction(function * () {
            if (!conn.isSynced) {
              // it is crucial that isSynced is set at the time garbageCollectAfterSync is called
              conn.isSynced = true;
              // It is safer to remove this!
              // TODO: remove: yield * this.garbageCollectAfterSync()
              // call whensynced listeners
              for (var f of conn.whenSyncedListeners) {
                f();
              }
              conn.whenSyncedListeners = [];
            }
          });
        }
      }
    }
    send (uid, buffer) {
      if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
        throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - please don\'t use this method to send custom messages')
      }
      this.log('%s: Send \'%y\' to %s', this.userId, buffer, uid);
      this.logMessage('Message: %Y', buffer);
    }
    broadcast (buffer) {
      if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
        throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - please don\'t use this method to send custom messages')
      }
      this.log('%s: Broadcast \'%y\'', this.userId, buffer);
      this.logMessage('Message: %Y', buffer);
    }
    /*
      Buffer operations, and broadcast them when ready.
    */
    broadcastOps (ops) {
      ops = ops.map(function (op) {
        return Y.Struct[op.struct].encode(op)
      });
      var self = this;
      function broadcastOperations () {
        if (self.broadcastOpBuffer.length > 0) {
          let encoder = new BinaryEncoder();
          encoder.writeVarString(self.opts.room);
          encoder.writeVarString('update');
          let ops = self.broadcastOpBuffer;
          self.broadcastOpBuffer = [];
          let length = ops.length;
          encoder.writeUint32(length);
          for (var i = 0; i < length; i++) {
            let op = ops[i];
            Y.Struct[op.struct].binaryEncode(encoder, op);
          }
          self.broadcast(encoder.createBuffer());
        }
      }
      if (this.broadcastOpBuffer.length === 0) {
        this.broadcastOpBuffer = ops;
        this.y.db.whenTransactionsFinished().then(broadcastOperations);
      } else {
        this.broadcastOpBuffer = this.broadcastOpBuffer.concat(ops);
      }
    }
    /*
      You received a raw message, and you know that it is intended for Yjs. Then call this function.
    */
    receiveMessage (sender, buffer) {
      if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
        throw new Error('Expected Message to be an ArrayBuffer or Uint8Array!')
      }
      if (sender === this.userId) {
        return
      }
      let decoder = new BinaryDecoder(buffer);
      let encoder = new BinaryEncoder();
      let roomname = decoder.readVarString(); // read room name
      encoder.writeVarString(roomname);
      let messageType = decoder.readVarString();
      let senderConn = this.connections.get(sender);

      this.log('%s: Receive \'%s\' from %s', this.userId, messageType, sender);
      this.logMessage('Message: %Y', buffer);

      if (senderConn == null) {
        throw new Error('Received message from unknown peer!')
      }

      if (messageType === 'sync step 1' || messageType === 'sync step 2') {
        let auth = decoder.readVarUint();
        if (senderConn.auth == null) {
          senderConn.processAfterAuth.push([sender, buffer]);

          // check auth
          return this.checkAuth(auth, this.y, sender).then(authPermissions => {
            senderConn.auth = authPermissions;
            this.y.emit('userAuthenticated', {
              user: senderConn.uid,
              auth: authPermissions
            });
            return senderConn.syncStep2.promise
          }).then(() => {
            if (senderConn.processAfterAuth == null) {
              return Promise.resolve()
            }
            let messages = senderConn.processAfterAuth;
            senderConn.processAfterAuth = null;
            return Promise.all(messages.map(m =>
              this.receiveMessage(m[0], m[1])
            ))
          })
        }
      }

      if (messageType === 'sync step 1' && (senderConn.auth === 'write' || senderConn.auth === 'read')) {
        // cannot wait for sync step 1 to finish, because we may wait for sync step 2 in sync step 1 (->lock)
        computeMessageSyncStep1(decoder, encoder, this, senderConn, sender);
        return this.y.db.whenTransactionsFinished()
      } else if (messageType === 'sync step 2' && senderConn.auth === 'write') {
        return computeMessageSyncStep2(decoder, encoder, this, senderConn, sender)
      } else if (messageType === 'update' && senderConn.auth === 'write') {
        return computeMessageUpdate(decoder, encoder, this, senderConn, sender)
      } else {
        Promise.reject(new Error('Unable to receive message'));
      }
    }
    _setSyncedWith (user) {
      var conn = this.connections.get(user);
      if (conn != null) {
        conn.isSynced = true;
      }
      if (user === this.currentSyncTarget) {
        this.currentSyncTarget = null;
        this.findNextSyncTarget();
      }
    }
    /*
      Currently, the HB encodes operations as JSON. For the moment I want to keep it
      that way. Maybe we support encoding in the HB as XML in the future, but for now I don't want
      too much overhead. Y is very likely to get changed a lot in the future

      Because we don't want to encode JSON as string (with character escaping, wich makes it pretty much unreadable)
      we encode the JSON as XML.

      When the HB support encoding as XML, the format should look pretty much like this.

      does not support primitive values as array elements
      expects an ltx (less than xml) object
    */
    parseMessageFromXml (m/* :any */) {
      function parseArray (node) {
        for (var n of node.children) {
          if (n.getAttribute('isArray') === 'true') {
            return parseArray(n)
          } else {
            return parseObject(n)
          }
        }
      }
      function parseObject (node/* :any */) {
        var json = {};
        for (var attrName in node.attrs) {
          var value = node.attrs[attrName];
          var int = parseInt(value, 10);
          if (isNaN(int) || ('' + int) !== value) {
            json[attrName] = value;
          } else {
            json[attrName] = int;
          }
        }
        for (var n/* :any */ in node.children) {
          var name = n.name;
          if (n.getAttribute('isArray') === 'true') {
            json[name] = parseArray(n);
          } else {
            json[name] = parseObject(n);
          }
        }
        return json
      }
      parseObject(m);
    }
    /*
      encode message in xml
      we use string because Strophe only accepts an "xml-string"..
      So {a:4,b:{c:5}} will look like
      <y a="4">
        <b c="5"></b>
      </y>
      m - ltx element
      json - Object
    */
    encodeMessageToXml (msg, obj) {
      // attributes is optional
      function encodeObject (m, json) {
        for (var name in json) {
          var value = json[name];
          if (name == null) {
            // nop
          } else if (value.constructor === Object) {
            encodeObject(m.c(name), value);
          } else if (value.constructor === Array) {
            encodeArray(m.c(name), value);
          } else {
            m.setAttribute(name, value);
          }
        }
      }
      function encodeArray (m, array) {
        m.setAttribute('isArray', 'true');
        for (var e of array) {
          if (e.constructor === Object) {
            encodeObject(m.c('array-element'), e);
          } else {
            encodeArray(m.c('array-element'), e);
          }
        }
      }
      if (obj.constructor === Object) {
        encodeObject(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj);
      } else if (obj.constructor === Array) {
        encodeArray(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj);
      } else {
        throw new Error("I can't encode this json!")
      }
    }
  }
  Y.AbstractConnector = AbstractConnector;
}

/* @flow */
function extendDatabase (Y /* :any */) {
  /*
    Partial definition of an OperationStore.
    TODO: name it Database, operation store only holds operations.

    A database definition must alse define the following methods:
    * logTable() (optional)
      - show relevant information information in a table
    * requestTransaction(makeGen)
      - request a transaction
    * destroy()
      - destroy the database
  */
  class AbstractDatabase {
    /* ::
    y: YConfig;
    forwardAppliedOperations: boolean;
    listenersById: Object;
    listenersByIdExecuteNow: Array<Object>;
    listenersByIdRequestPending: boolean;
    initializedTypes: Object;
    whenUserIdSetListener: ?Function;
    waitingTransactions: Array<Transaction>;
    transactionInProgress: boolean;
    executeOrder: Array<Object>;
    gc1: Array<Struct>;
    gc2: Array<Struct>;
    gcTimeout: number;
    gcInterval: any;
    garbageCollect: Function;
    executeOrder: Array<any>; // for debugging only
    userId: UserId;
    opClock: number;
    transactionsFinished: ?{promise: Promise, resolve: any};
    transact: (x: ?Generator) => any;
    */
    constructor (y, opts) {
      this.y = y;
      opts.gc = opts.gc === true;
      this.dbOpts = opts;
      var os = this;
      this.userId = null;
      var resolve_;
      this.userIdPromise = new Promise(function (resolve) {
        resolve_ = resolve;
      });
      this.userIdPromise.resolve = resolve_;
      // whether to broadcast all applied operations (insert & delete hook)
      this.forwardAppliedOperations = false;
      // E.g. this.listenersById[id] : Array<Listener>
      this.listenersById = {};
      // Execute the next time a transaction is requested
      this.listenersByIdExecuteNow = [];
      // A transaction is requested
      this.listenersByIdRequestPending = false;
      /* To make things more clear, the following naming conventions:
         * ls : we put this.listenersById on ls
         * l : Array<Listener>
         * id : Id (can't use as property name)
         * sid : String (converted from id via JSON.stringify
                         so we can use it as a property name)

        Always remember to first overwrite
        a property before you iterate over it!
      */
      // TODO: Use ES7 Weak Maps. This way types that are no longer user,
      // wont be kept in memory.
      this.initializedTypes = {};
      this.waitingTransactions = [];
      this.transactionInProgress = false;
      this.transactionIsFlushed = false;
      if (typeof YConcurrencyTestingMode !== 'undefined') {
        this.executeOrder = [];
      }
      this.gc1 = []; // first stage
      this.gc2 = []; // second stage -> after that, remove the op

      function garbageCollect () {
        return os.whenTransactionsFinished().then(function () {
          if (os.gcTimeout > 0 && (os.gc1.length > 0 || os.gc2.length > 0)) {
            if (!os.y.connector.isSynced) {
              console.warn('gc should be empty when not synced!');
            }
            return new Promise((resolve) => {
              os.requestTransaction(function * () {
                if (os.y.connector != null && os.y.connector.isSynced) {
                  for (var i = 0; i < os.gc2.length; i++) {
                    var oid = os.gc2[i];
                    yield * this.garbageCollectOperation(oid);
                  }
                  os.gc2 = os.gc1;
                  os.gc1 = [];
                }
                // TODO: Use setInterval here instead (when garbageCollect is called several times there will be several timeouts..)
                if (os.gcTimeout > 0) {
                  os.gcInterval = setTimeout(garbageCollect, os.gcTimeout);
                }
                resolve();
              });
            })
          } else {
            // TODO: see above
            if (os.gcTimeout > 0) {
              os.gcInterval = setTimeout(garbageCollect, os.gcTimeout);
            }
            return Promise.resolve()
          }
        })
      }
      this.garbageCollect = garbageCollect;
      this.startGarbageCollector();

      this.repairCheckInterval = !opts.repairCheckInterval ? 6000 : opts.repairCheckInterval;
      this.opsReceivedTimestamp = new Date();
      this.startRepairCheck();
    }
    startGarbageCollector () {
      this.gc = this.dbOpts.gc;
      if (this.gc) {
        this.gcTimeout = !this.dbOpts.gcTimeout ? 100000 : this.dbOpts.gcTimeout;
      } else {
        this.gcTimeout = -1;
      }
      if (this.gcTimeout > 0) {
        this.garbageCollect();
      }
    }
    startRepairCheck () {
      var os = this;
      if (this.repairCheckInterval > 0) {
        this.repairCheckIntervalHandler = setInterval(function repairOnMissingOperations () {
          /*
            Case 1. No ops have been received in a while (new Date() - os.opsReceivedTimestamp > os.repairCheckInterval)
              - 1.1 os.listenersById is empty. Then the state was correct the whole time. -> Nothing to do (nor to update)
              - 1.2 os.listenersById is not empty.
                      * Then the state was incorrect for at least {os.repairCheckInterval} seconds.
                      * -> Remove everything in os.listenersById and sync again (connector.repair())
            Case 2. An op has been received in the last {os.repairCheckInterval } seconds.
                    It is not yet necessary to check for faulty behavior. Everything can still resolve itself. Wait for more messages.
                    If nothing was received for a while and os.listenersById is still not emty, we are in case 1.2
                    -> Do nothing

            Baseline here is: we really only have to catch case 1.2..
          */
          if (
            new Date() - os.opsReceivedTimestamp > os.repairCheckInterval &&
            Object.keys(os.listenersById).length > 0 // os.listenersById is not empty
          ) {
            // haven't received operations for over {os.repairCheckInterval} seconds, resend state vector
            os.listenersById = {};
            os.opsReceivedTimestamp = new Date(); // update so you don't send repair several times in a row
            os.y.connector.repair();
          }
        }, this.repairCheckInterval);
      }
    }
    stopRepairCheck () {
      clearInterval(this.repairCheckIntervalHandler);
    }
    queueGarbageCollector (id) {
      if (this.y.connector.isSynced && this.gc) {
        this.gc1.push(id);
      }
    }
    emptyGarbageCollector () {
      return new Promise(resolve => {
        var check = () => {
          if (this.gc1.length > 0 || this.gc2.length > 0) {
            this.garbageCollect().then(check);
          } else {
            resolve();
          }
        };
        setTimeout(check, 0);
      })
    }
    addToDebug () {
      if (typeof YConcurrencyTestingMode !== 'undefined') {
        var command /* :string */ = Array.prototype.map.call(arguments, function (s) {
          if (typeof s === 'string') {
            return s
          } else {
            return JSON.stringify(s)
          }
        }).join('').replace(/"/g, "'").replace(/,/g, ', ').replace(/:/g, ': ');
        this.executeOrder.push(command);
      }
    }
    getDebugData () {
      console.log(this.executeOrder.join('\n'));
    }
    stopGarbageCollector () {
      var self = this;
      this.gc = false;
      this.gcTimeout = -1;
      return new Promise(function (resolve) {
        self.requestTransaction(function * () {
          var ungc /* :Array<Struct> */ = self.gc1.concat(self.gc2);
          self.gc1 = [];
          self.gc2 = [];
          for (var i = 0; i < ungc.length; i++) {
            var op = yield * this.getOperation(ungc[i]);
            if (op != null) {
              delete op.gc;
              yield * this.setOperation(op);
            }
          }
          resolve();
        });
      })
    }
    /*
      Try to add to GC.

      TODO: rename this function

      Rulez:
      * Only gc if this user is online & gc turned on
      * The most left element in a list must not be gc'd.
        => There is at least one element in the list

      returns true iff op was added to GC
    */
    * addToGarbageCollector (op, left) {
      if (
        op.gc == null &&
        op.deleted === true &&
        this.store.gc &&
        this.store.y.connector.isSynced
      ) {
        var gc = false;
        if (left != null && left.deleted === true) {
          gc = true;
        } else if (op.content != null && op.content.length > 1) {
          op = yield * this.getInsertionCleanStart([op.id[0], op.id[1] + 1]);
          gc = true;
        }
        if (gc) {
          op.gc = true;
          yield * this.setOperation(op);
          this.store.queueGarbageCollector(op.id);
          return true
        }
      }
      return false
    }
    removeFromGarbageCollector (op) {
      function filter (o) {
        return !Y.utils.compareIds(o, op.id)
      }
      this.gc1 = this.gc1.filter(filter);
      this.gc2 = this.gc2.filter(filter);
      delete op.gc;
    }
    destroyTypes () {
      for (var key in this.initializedTypes) {
        var type = this.initializedTypes[key];
        if (type._destroy != null) {
          type._destroy();
        } else {
          console.error('The type you included does not provide destroy functionality, it will remain in memory (updating your packages will help).');
        }
      }
    }
    * destroy () {
      clearTimeout(this.gcInterval);
      this.gcInterval = null;
      this.stopRepairCheck();
    }
    setUserId (userId) {
      if (!this.userIdPromise.inProgress) {
        this.userIdPromise.inProgress = true;
        var self = this;
        self.requestTransaction(function * () {
          self.userId = userId;
          var state = yield * this.getState(userId);
          self.opClock = state.clock;
          self.userIdPromise.resolve(userId);
        });
      }
      return this.userIdPromise
    }
    whenUserIdSet (f) {
      this.userIdPromise.then(f);
    }
    getNextOpId (numberOfIds) {
      if (numberOfIds == null) {
        throw new Error('getNextOpId expects the number of created ids to create!')
      } else if (this.userId == null) {
        throw new Error('OperationStore not yet initialized!')
      } else {
        var id = [this.userId, this.opClock];
        this.opClock += numberOfIds;
        return id
      }
    }
    /*
      Apply a list of operations.

      * we save a timestamp, because we received new operations that could resolve ops in this.listenersById (see this.startRepairCheck)
      * get a transaction
      * check whether all Struct.*.requiredOps are in the OS
      * check if it is an expected op (otherwise wait for it)
      * check if was deleted, apply a delete operation after op was applied
    */
    applyOperations (decoder) {
      this.opsReceivedTimestamp = new Date();
      let length = decoder.readUint32();

      for (var i = 0; i < length; i++) {
        let o = Y.Struct.binaryDecodeOperation(decoder);
        if (o.id == null || o.id[0] !== this.y.connector.userId) {
          var required = Y.Struct[o.struct].requiredOps(o);
          if (o.requires != null) {
            required = required.concat(o.requires);
          }
          this.whenOperationsExist(required, o);
        }
      }
    }
    /*
      op is executed as soon as every operation requested is available.
      Note that Transaction can (and should) buffer requests.
    */
    whenOperationsExist (ids, op) {
      if (ids.length > 0) {
        let listener = {
          op: op,
          missing: ids.length
        };

        for (let i = 0; i < ids.length; i++) {
          let id = ids[i];
          let sid = JSON.stringify(id);
          let l = this.listenersById[sid];
          if (l == null) {
            l = [];
            this.listenersById[sid] = l;
          }
          l.push(listener);
        }
      } else {
        this.listenersByIdExecuteNow.push({
          op: op
        });
      }

      if (this.listenersByIdRequestPending) {
        return
      }

      this.listenersByIdRequestPending = true;
      var store = this;

      this.requestTransaction(function * () {
        var exeNow = store.listenersByIdExecuteNow;
        store.listenersByIdExecuteNow = [];

        var ls = store.listenersById;
        store.listenersById = {};

        store.listenersByIdRequestPending = false;

        for (let key = 0; key < exeNow.length; key++) {
          let o = exeNow[key].op;
          yield * store.tryExecute.call(this, o);
        }

        for (var sid in ls) {
          var l = ls[sid];
          var id = JSON.parse(sid);
          var op;
          if (typeof id[1] === 'string') {
            op = yield * this.getOperation(id);
          } else {
            op = yield * this.getInsertion(id);
          }
          if (op == null) {
            store.listenersById[sid] = l;
          } else {
            for (let i = 0; i < l.length; i++) {
              let listener = l[i];
              let o = listener.op;
              if (--listener.missing === 0) {
                yield * store.tryExecute.call(this, o);
              }
            }
          }
        }
      });
    }
    /*
      Actually execute an operation, when all expected operations are available.
    */
    /* :: // TODO: this belongs somehow to transaction
    store: Object;
    getOperation: any;
    isGarbageCollected: any;
    addOperation: any;
    whenOperationsExist: any;
    */
    * tryExecute (op) {
      this.store.addToDebug('yield * this.store.tryExecute.call(this, ', JSON.stringify(op), ')');
      if (op.struct === 'Delete') {
        yield * Y.Struct.Delete.execute.call(this, op);
        // this is now called in Transaction.deleteOperation!
        // yield * this.store.operationAdded(this, op)
      } else {
        // check if this op was defined
        var defined = yield * this.getInsertion(op.id);
        while (defined != null && defined.content != null) {
          // check if this op has a longer content in the case it is defined
          if (defined.id[1] + defined.content.length < op.id[1] + op.content.length) {
            var overlapSize = defined.content.length - (op.id[1] - defined.id[1]);
            op.content.splice(0, overlapSize);
            op.id = [op.id[0], op.id[1] + overlapSize];
            op.left = Y.utils.getLastId(defined);
            op.origin = op.left;
            defined = yield * this.getOperation(op.id); // getOperation suffices here
          } else {
            break
          }
        }
        if (defined == null) {
          var opid = op.id;
          var isGarbageCollected = yield * this.isGarbageCollected(opid);
          if (!isGarbageCollected) {
            // TODO: reduce number of get / put calls for op ..
            yield * Y.Struct[op.struct].execute.call(this, op);
            yield * this.addOperation(op);
            yield * this.store.operationAdded(this, op);
            // operationAdded can change op..
            op = yield * this.getOperation(opid);
            // if insertion, try to combine with left
            yield * this.tryCombineWithLeft(op);
          }
        }
      }
    }
    /*
     * Called by a transaction when an operation is added.
     * This function is especially important for y-indexeddb, where several instances may share a single database.
     * Every time an operation is created by one instance, it is send to all other instances and operationAdded is called
     *
     * If it's not a Delete operation:
     *   * Checks if another operation is executable (listenersById)
     *   * Update state, if possible
     *
     * Always:
     *   * Call type
     */
    * operationAdded (transaction, op) {
      if (op.struct === 'Delete') {
        var type = this.initializedTypes[JSON.stringify(op.targetParent)];
        if (type != null) {
          yield * type._changed(transaction, op);
        }
      } else {
        // increase SS
        yield * transaction.updateState(op.id[0]);
        var opLen = op.content != null ? op.content.length : 1;
        for (let i = 0; i < opLen; i++) {
          // notify whenOperation listeners (by id)
          var sid = JSON.stringify([op.id[0], op.id[1] + i]);
          var l = this.listenersById[sid];
          delete this.listenersById[sid];
          if (l != null) {
            for (var key in l) {
              var listener = l[key];
              if (--listener.missing === 0) {
                this.whenOperationsExist([], listener.op);
              }
            }
          }
        }
        var t = this.initializedTypes[JSON.stringify(op.parent)];

        // if parent is deleted, mark as gc'd and return
        if (op.parent != null) {
          var parentIsDeleted = yield * transaction.isDeleted(op.parent);
          if (parentIsDeleted) {
            yield * transaction.deleteList(op.id);
            return
          }
        }

        // notify parent, if it was instanciated as a custom type
        if (t != null) {
          let o = Y.utils.copyOperation(op);
          yield * t._changed(transaction, o);
        }
        if (!op.deleted) {
          // Delete if DS says this is actually deleted
          var len = op.content != null ? op.content.length : 1;
          var startId = op.id; // You must not use op.id in the following loop, because op will change when deleted
            // TODO: !! console.log('TODO: change this before commiting')
          for (let i = 0; i < len; i++) {
            var id = [startId[0], startId[1] + i];
            var opIsDeleted = yield * transaction.isDeleted(id);
            if (opIsDeleted) {
              var delop = {
                struct: 'Delete',
                target: id
              };
              yield * this.tryExecute.call(transaction, delop);
            }
          }
        }
      }
    }
    whenTransactionsFinished () {
      if (this.transactionInProgress) {
        if (this.transactionsFinished == null) {
          var resolve_;
          var promise = new Promise(function (resolve) {
            resolve_ = resolve;
          });
          this.transactionsFinished = {
            resolve: resolve_,
            promise: promise
          };
        }
        return this.transactionsFinished.promise
      } else {
        return Promise.resolve()
      }
    }
    // Check if there is another transaction request.
    // * the last transaction is always a flush :)
    getNextRequest () {
      if (this.waitingTransactions.length === 0) {
        if (this.transactionIsFlushed) {
          this.transactionInProgress = false;
          this.transactionIsFlushed = false;
          if (this.transactionsFinished != null) {
            this.transactionsFinished.resolve();
            this.transactionsFinished = null;
          }
          return null
        } else {
          this.transactionIsFlushed = true;
          return function * () {
            yield * this.flush();
          }
        }
      } else {
        this.transactionIsFlushed = false;
        return this.waitingTransactions.shift()
      }
    }
    requestTransaction (makeGen/* :any */, callImmediately) {
      this.waitingTransactions.push(makeGen);
      if (!this.transactionInProgress) {
        this.transactionInProgress = true;
        setTimeout(() => {
          this.transact(this.getNextRequest());
        }, 0);
      }
    }
    /*
      Get a created/initialized type.
    */
    getType (id) {
      return this.initializedTypes[JSON.stringify(id)]
    }
    /*
      Init type. This is called when a remote operation is retrieved, and transformed to a type
      TODO: delete type from store.initializedTypes[id] when corresponding id was deleted!
    */
    * initType (id, args) {
      var sid = JSON.stringify(id);
      var t = this.store.initializedTypes[sid];
      if (t == null) {
        var op/* :MapStruct | ListStruct */ = yield * this.getOperation(id);
        if (op != null) {
          t = yield * Y[op.type].typeDefinition.initType.call(this, this.store, op, args);
          this.store.initializedTypes[sid] = t;
        }
      }
      return t
    }
    /*
     Create type. This is called when the local user creates a type (which is a synchronous action)
    */
    createType (typedefinition, id) {
      var structname = typedefinition[0].struct;
      id = id || this.getNextOpId(1);
      var op = Y.Struct[structname].create(id);
      op.type = typedefinition[0].name;

      this.requestTransaction(function * () {
        if (op.id[0] === 0xFFFFFF) {
          yield * this.setOperation(op);
        } else {
          yield * this.applyCreatedOperations([op]);
        }
      });
      var t = Y[op.type].typeDefinition.createType(this, op, typedefinition[1]);
      this.initializedTypes[JSON.stringify(op.id)] = t;
      return t
    }
  }
  Y.AbstractDatabase = AbstractDatabase;
}

/*
  Partial definition of a transaction

  A transaction provides all the the async functionality on a database.

  By convention, a transaction has the following properties:
  * ss for StateSet
  * os for OperationStore
  * ds for DeleteStore

  A transaction must also define the following methods:
  * checkDeleteStoreForState(state)
    - When increasing the state of a user, an operation with an higher id
      may already be garbage collected, and therefore it will never be received.
      update the state to reflect this knowledge. This won't call a method to save the state!
  * getDeleteSet(id)
    - Get the delete set in a readable format:
      {
        "userX": [
          [5,1], // starting from position 5, one operations is deleted
          [9,4]  // starting from position 9, four operations are deleted
        ],
        "userY": ...
      }
  * getOpsFromDeleteSet(ds) -- TODO: just call this.deleteOperation(id) here
    - get a set of deletions that need to be applied in order to get to
      achieve the state of the supplied ds
  * setOperation(op)
    - write `op` to the database.
      Note: this is allowed to return an in-memory object.
      E.g. the Memory adapter returns the object that it has in-memory.
      Changing values on this object will be stored directly in the database
      without calling this function. Therefore,
      setOperation may have no functionality in some adapters. This also has
      implications on the way we use operations that were served from the database.
      We try not to call copyObject, if not necessary.
  * addOperation(op)
    - add an operation to the database.
      This may only be called once for every op.id
      Must return a function that returns the next operation in the database (ordered by id)
  * getOperation(id)
  * removeOperation(id)
    - remove an operation from the database. This is called when an operation
      is garbage collected.
  * setState(state)
    - `state` is of the form
      {
        user: "1",
        clock: 4
      } <- meaning that we have four operations from user "1"
           (with these id's respectively: 0, 1, 2, and 3)
  * getState(user)
  * getStateVector()
    - Get the state of the OS in the form
    [{
      user: "userX",
      clock: 11
    },
     ..
    ]
  * getStateSet()
    - Get the state of the OS in the form
    {
      "userX": 11,
      "userY": 22
    }
   * getOperations(startSS)
     - Get the all the operations that are necessary in order to achive the
       stateSet of this user, starting from a stateSet supplied by another user
   * makeOperationReady(ss, op)
     - this is called only by `getOperations(startSS)`. It makes an operation
       applyable on a given SS.
*/
function extendTransaction (Y) {
  class TransactionInterface {
    /* ::
    store: Y.AbstractDatabase;
    ds: Store;
    os: Store;
    ss: Store;
    */
    /*
      Apply operations that this user created (no remote ones!)
        * does not check for Struct.*.requiredOps()
        * also broadcasts it through the connector
    */
    * applyCreatedOperations (ops) {
      var send = [];
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        yield * this.store.tryExecute.call(this, op);
        if (op.id == null || typeof op.id[1] !== 'string') {
          send.push(Y.Struct[op.struct].encode(op));
        }
      }
      if (send.length > 0) { // TODO: && !this.store.forwardAppliedOperations (but then i don't send delete ops)
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcastOps(send);
      }
    }

    * deleteList (start) {
      while (start != null) {
        start = yield * this.getOperation(start);
        if (!start.gc) {
          start.gc = true;
          start.deleted = true;
          yield * this.setOperation(start);
          var delLength = start.content != null ? start.content.length : 1;
          yield * this.markDeleted(start.id, delLength);
          if (start.opContent != null) {
            yield * this.deleteOperation(start.opContent);
          }
          this.store.queueGarbageCollector(start.id);
        }
        start = start.right;
      }
    }

    /*
      Mark an operation as deleted, and add it to the GC, if possible.
    */
    * deleteOperation (targetId, length, preventCallType) /* :Generator<any, any, any> */ {
      if (length == null) {
        length = 1;
      }
      yield * this.markDeleted(targetId, length);
      while (length > 0) {
        var callType = false;
        var target = yield * this.os.findWithUpperBound([targetId[0], targetId[1] + length - 1]);
        var targetLength = target != null && target.content != null ? target.content.length : 1;
        if (target == null || target.id[0] !== targetId[0] || target.id[1] + targetLength <= targetId[1]) {
          // does not exist or is not in the range of the deletion
          target = null;
          length = 0;
        } else {
          // does exist, check if it is too long
          if (!target.deleted) {
            if (target.id[1] < targetId[1]) {
              // starts to the left of the deletion range
              target = yield * this.getInsertionCleanStart(targetId);
              targetLength = target.content.length; // must have content property!
            }
            if (target.id[1] + targetLength > targetId[1] + length) {
              // ends to the right of the deletion range
              target = yield * this.getInsertionCleanEnd([targetId[0], targetId[1] + length - 1]);
              targetLength = target.content.length;
            }
          }
          length = target.id[1] - targetId[1];
        }

        if (target != null) {
          if (!target.deleted) {
            callType = true;
            // set deleted & notify type
            target.deleted = true;
            // delete containing lists
            if (target.start != null) {
              // TODO: don't do it like this .. -.-
              yield * this.deleteList(target.start);
              // yield * this.deleteList(target.id) -- do not gc itself because this may still get referenced
            }
            if (target.map != null) {
              for (var name in target.map) {
                yield * this.deleteList(target.map[name]);
              }
              // TODO: here to..  (see above)
              // yield * this.deleteList(target.id) -- see above
            }
            if (target.opContent != null) {
              yield * this.deleteOperation(target.opContent);
              // target.opContent = null
            }
            if (target.requires != null) {
              for (var i = 0; i < target.requires.length; i++) {
                yield * this.deleteOperation(target.requires[i]);
              }
            }
          }
          var left;
          if (target.left != null) {
            left = yield * this.getInsertion(target.left);
          } else {
            left = null;
          }

          // set here because it was deleted and/or gc'd
          yield * this.setOperation(target);

          /*
            Check if it is possible to add right to the gc.
            Because this delete can't be responsible for left being gc'd,
            we don't have to add left to the gc..
          */
          var right;
          if (target.right != null) {
            right = yield * this.getOperation(target.right);
          } else {
            right = null;
          }
          if (callType && !preventCallType) {
            yield * this.store.operationAdded(this, {
              struct: 'Delete',
              target: target.id,
              length: targetLength,
              targetParent: target.parent
            });
          }
          // need to gc in the end!
          yield * this.store.addToGarbageCollector.call(this, target, left);
          if (right != null) {
            yield * this.store.addToGarbageCollector.call(this, right, target);
          }
        }
      }
    }
    /*
      Mark an operation as deleted&gc'd
    */
    * markGarbageCollected (id, len) {
      // this.mem.push(["gc", id]);
      this.store.addToDebug('yield * this.markGarbageCollected(', id, ', ', len, ')');
      var n = yield * this.markDeleted(id, len);
      if (n.id[1] < id[1] && !n.gc) {
        // un-extend left
        var newlen = n.len - (id[1] - n.id[1]);
        n.len -= newlen;
        yield * this.ds.put(n);
        n = {id: id, len: newlen, gc: false};
        yield * this.ds.put(n);
      }
      // get prev&next before adding a new operation
      var prev = yield * this.ds.findPrev(id);
      var next = yield * this.ds.findNext(id);

      if (id[1] + len < n.id[1] + n.len && !n.gc) {
        // un-extend right
        yield * this.ds.put({id: [id[0], id[1] + len], len: n.len - len, gc: false});
        n.len = len;
      }
      // set gc'd
      n.gc = true;
      // can extend left?
      if (
        prev != null &&
        prev.gc &&
        Y.utils.compareIds([prev.id[0], prev.id[1] + prev.len], n.id)
      ) {
        prev.len += n.len;
        yield * this.ds.delete(n.id);
        n = prev;
        // ds.put n here?
      }
      // can extend right?
      if (
        next != null &&
        next.gc &&
        Y.utils.compareIds([n.id[0], n.id[1] + n.len], next.id)
      ) {
        n.len += next.len;
        yield * this.ds.delete(next.id);
      }
      yield * this.ds.put(n);
      yield * this.updateState(n.id[0]);
    }
    /*
      Mark an operation as deleted.

      returns the delete node
    */
    * markDeleted (id, length) {
      if (length == null) {
        length = 1;
      }
      // this.mem.push(["del", id]);
      var n = yield * this.ds.findWithUpperBound(id);
      if (n != null && n.id[0] === id[0]) {
        if (n.id[1] <= id[1] && id[1] <= n.id[1] + n.len) {
          // id is in n's range
          var diff = id[1] + length - (n.id[1] + n.len); // overlapping right
          if (diff > 0) {
            // id+length overlaps n
            if (!n.gc) {
              n.len += diff;
            } else {
              diff = n.id[1] + n.len - id[1]; // overlapping left (id till n.end)
              if (diff < length) {
                // a partial deletion
                n = {id: [id[0], id[1] + diff], len: length - diff, gc: false};
                yield * this.ds.put(n);
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
          n = {id: id, len: length, gc: false};
          yield * this.ds.put(n); // TODO: you double-put !!
        }
      } else {
        // cannot extend left
        n = {id: id, len: length, gc: false};
        yield * this.ds.put(n);
      }
      // can extend right?
      var next = yield * this.ds.findNext(n.id);
      if (
        next != null &&
        n.id[0] === next.id[0] &&
        n.id[1] + n.len >= next.id[1]
      ) {
        diff = n.id[1] + n.len - next.id[1]; // from next.start to n.end
        while (diff >= 0) {
          // n overlaps with next
          if (next.gc) {
            // gc is stronger, so reduce length of n
            n.len -= diff;
            if (diff >= next.len) {
              // delete the missing range after next
              diff = diff - next.len; // missing range after next
              if (diff > 0) {
                yield * this.ds.put(n); // unneccessary? TODO!
                yield * this.markDeleted([next.id[0], next.id[1] + next.len], diff);
              }
            }
            break
          } else {
            // we can extend n with next
            if (diff > next.len) {
              // n is even longer than next
              // get next.next, and try to extend it
              var _next = yield * this.ds.findNext(next.id);
              yield * this.ds.delete(next.id);
              if (_next == null || n.id[0] !== _next.id[0]) {
                break
              } else {
                next = _next;
                diff = n.id[1] + n.len - next.id[1]; // from next.start to n.end
                // continue!
              }
            } else {
              // n just partially overlaps with next. extend n, delete next, and break this loop
              n.len += next.len - diff;
              yield * this.ds.delete(next.id);
              break
            }
          }
        }
      }
      yield * this.ds.put(n);
      return n
    }
    /*
      Call this method when the client is connected&synced with the
      other clients (e.g. master). This will query the database for
      operations that can be gc'd and add them to the garbage collector.
    */
    * garbageCollectAfterSync () {
      // debugger
      if (this.store.gc1.length > 0 || this.store.gc2.length > 0) {
        console.warn('gc should be empty after sync');
      }
      if (!this.store.gc) {
        return
      }
      yield * this.os.iterate(this, null, null, function * (op) {
        if (op.gc) {
          delete op.gc;
          yield * this.setOperation(op);
        }
        if (op.parent != null) {
          var parentDeleted = yield * this.isDeleted(op.parent);
          if (parentDeleted) {
            op.gc = true;
            if (!op.deleted) {
              yield * this.markDeleted(op.id, op.content != null ? op.content.length : 1);
              op.deleted = true;
              if (op.opContent != null) {
                yield * this.deleteOperation(op.opContent);
              }
              if (op.requires != null) {
                for (var i = 0; i < op.requires.length; i++) {
                  yield * this.deleteOperation(op.requires[i]);
                }
              }
            }
            yield * this.setOperation(op);
            this.store.gc1.push(op.id); // this is ok becaues its shortly before sync (otherwise use queueGarbageCollector!)
            return
          }
        }
        if (op.deleted) {
          var left = null;
          if (op.left != null) {
            left = yield * this.getInsertion(op.left);
          }
          yield * this.store.addToGarbageCollector.call(this, op, left);
        }
      });
    }
    /*
      Really remove an op and all its effects.
      The complicated case here is the Insert operation:
      * reset left
      * reset right
      * reset parent.start
      * reset parent.end
      * reset origins of all right ops
    */
    * garbageCollectOperation (id) {
      this.store.addToDebug('yield * this.garbageCollectOperation(', id, ')');
      var o = yield * this.getOperation(id);
      yield * this.markGarbageCollected(id, (o != null && o.content != null) ? o.content.length : 1); // always mark gc'd
      // if op exists, then clean that mess up..
      if (o != null) {
        var deps = [];
        if (o.opContent != null) {
          deps.push(o.opContent);
        }
        if (o.requires != null) {
          deps = deps.concat(o.requires);
        }
        for (var i = 0; i < deps.length; i++) {
          var dep = yield * this.getOperation(deps[i]);
          if (dep != null) {
            if (!dep.deleted) {
              yield * this.deleteOperation(dep.id);
              dep = yield * this.getOperation(dep.id);
            }
            dep.gc = true;
            yield * this.setOperation(dep);
            this.store.queueGarbageCollector(dep.id);
          } else {
            yield * this.markGarbageCollected(deps[i], 1);
          }
        }

        // remove gc'd op from the left op, if it exists
        if (o.left != null) {
          var left = yield * this.getInsertion(o.left);
          left.right = o.right;
          yield * this.setOperation(left);
        }
        // remove gc'd op from the right op, if it exists
        // also reset origins of right ops
        if (o.right != null) {
          var right = yield * this.getOperation(o.right);
          right.left = o.left;
          yield * this.setOperation(right);

          if (o.originOf != null && o.originOf.length > 0) {
            // find new origin of right ops
            // origin is the first left operation
            var neworigin = o.left;

            // reset origin of all right ops (except first right - duh!),

            /* ** The following code does not rely on the the originOf property **
                  I recently added originOf to all Insert Operations (see Struct.Insert.execute),
                  which saves which operations originate in a Insert operation.
                  Garbage collecting without originOf is more memory efficient, but is nearly impossible for large texts, or lists!
                  But I keep this code for now
            ```
            // reset origin of right
            right.origin = neworigin
            // search until you find origin pointer to the left of o
            if (right.right != null) {
              var i = yield * this.getOperation(right.right)
              var ids = [o.id, o.right]
              while (ids.some(function (id) {
                return Y.utils.compareIds(id, i.origin)
              })) {
                if (Y.utils.compareIds(i.origin, o.id)) {
                  // reset origin of i
                  i.origin = neworigin
                  yield * this.setOperation(i)
                }
                // get next i
                if (i.right == null) {
                  break
                } else {
                  ids.push(i.id)
                  i = yield * this.getOperation(i.right)
                }
              }
            }
            ```
            */
            // ** Now the new implementation starts **
            // reset neworigin of all originOf[*]
            for (var _i in o.originOf) {
              var originsIn = yield * this.getOperation(o.originOf[_i]);
              if (originsIn != null) {
                originsIn.origin = neworigin;
                yield * this.setOperation(originsIn);
              }
            }
            if (neworigin != null) {
              var neworigin_ = yield * this.getInsertion(neworigin);
              if (neworigin_.originOf == null) {
                neworigin_.originOf = o.originOf;
              } else {
                neworigin_.originOf = o.originOf.concat(neworigin_.originOf);
              }
              yield * this.setOperation(neworigin_);
            }
            // we don't need to set right here, because
            // right should be in o.originOf => it is set it the previous for loop
          }
        }
        // o may originate in another operation.
        // Since o is deleted, we have to reset o.origin's `originOf` property
        if (o.origin != null) {
          var origin = yield * this.getInsertion(o.origin);
          origin.originOf = origin.originOf.filter(function (_id) {
            return !Y.utils.compareIds(id, _id)
          });
          yield * this.setOperation(origin);
        }
        var parent;
        if (o.parent != null) {
          parent = yield * this.getOperation(o.parent);
        }
        // remove gc'd op from parent, if it exists
        if (parent != null) {
          var setParent = false; // whether to save parent to the os
          if (o.parentSub != null) {
            if (Y.utils.compareIds(parent.map[o.parentSub], o.id)) {
              setParent = true;
              if (o.right != null) {
                parent.map[o.parentSub] = o.right;
              } else {
                delete parent.map[o.parentSub];
              }
            }
          } else {
            if (Y.utils.compareIds(parent.start, o.id)) {
              // gc'd op is the start
              setParent = true;
              parent.start = o.right;
            }
            if (Y.utils.matchesId(o, parent.end)) {
              // gc'd op is the end
              setParent = true;
              parent.end = o.left;
            }
          }
          if (setParent) {
            yield * this.setOperation(parent);
          }
        }
        // finally remove it from the os
        yield * this.removeOperation(o.id);
      }
    }
    * checkDeleteStoreForState (state) {
      var n = yield * this.ds.findWithUpperBound([state.user, state.clock]);
      if (n != null && n.id[0] === state.user && n.gc) {
        state.clock = Math.max(state.clock, n.id[1] + n.len);
      }
    }
    * updateState (user) {
      var state = yield * this.getState(user);
      yield * this.checkDeleteStoreForState(state);
      var o = yield * this.getInsertion([user, state.clock]);
      var oLength = (o != null && o.content != null) ? o.content.length : 1;
      while (o != null && user === o.id[0] && o.id[1] <= state.clock && o.id[1] + oLength > state.clock) {
        // either its a new operation (1. case), or it is an operation that was deleted, but is not yet in the OS
        state.clock += oLength;
        yield * this.checkDeleteStoreForState(state);
        o = yield * this.os.findNext(o.id);
        oLength = (o != null && o.content != null) ? o.content.length : 1;
      }
      yield * this.setState(state);
    }
    /*
      apply a delete set in order to get
      the state of the supplied ds
    */
    * applyDeleteSet (decoder) {
      var deletions = [];

      let dsLength = decoder.readUint32();
      for (let i = 0; i < dsLength; i++) {
        let user = decoder.readVarUint();
        let dv = [];
        let dvLength = decoder.readVarUint();
        for (let j = 0; j < dvLength; j++) {
          let from = decoder.readVarUint();
          let len = decoder.readVarUint();
          let gc = decoder.readUint8() === 1;
          dv.push([from, len, gc]);
        }
        var pos = 0;
        var d = dv[pos];
        yield * this.ds.iterate(this, [user, 0], [user, Number.MAX_VALUE], function * (n) {
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
            if (n.id[1] + n.len <= d[0]) {
              // 1)
              break
            } else if (d[0] < n.id[1]) {
              // 2)
              // delete maximum the len of d
              // else delete as much as possible
              diff = Math.min(n.id[1] - d[0], d[1]);
              deletions.push([user, d[0], diff, d[2]]);
            } else {
              // 3)
              diff = n.id[1] + n.len - d[0]; // never null (see 1)
              if (d[2] && !n.gc) {
                // d marks as gc'd but n does not
                // then delete either way
                deletions.push([user, d[0], Math.min(diff, d[1]), d[2]]);
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
        // for the rest.. just apply it
        for (; pos < dv.length; pos++) {
          d = dv[pos];
          deletions.push([user, d[0], d[1], d[2]]);
        }
      }
      for (var i = 0; i < deletions.length; i++) {
        var del = deletions[i];
        // always try to delete..
        yield * this.deleteOperation([del[0], del[1]], del[2]);
        if (del[3]) {
          // gc..
          yield * this.markGarbageCollected([del[0], del[1]], del[2]); // always mark gc'd
          // remove operation..
          var counter = del[1] + del[2];
          while (counter >= del[1]) {
            var o = yield * this.os.findWithUpperBound([del[0], counter - 1]);
            if (o == null) {
              break
            }
            var oLen = o.content != null ? o.content.length : 1;
            if (o.id[0] !== del[0] || o.id[1] + oLen <= del[1]) {
              // not in range
              break
            }
            if (o.id[1] + oLen > del[1] + del[2]) {
              // overlaps right
              o = yield * this.getInsertionCleanEnd([del[0], del[1] + del[2] - 1]);
            }
            if (o.id[1] < del[1]) {
              // overlaps left
              o = yield * this.getInsertionCleanStart([del[0], del[1]]);
            }
            counter = o.id[1];
            yield * this.garbageCollectOperation(o.id);
          }
        }
        if (this.store.forwardAppliedOperations) {
          var ops = [];
          ops.push({struct: 'Delete', target: [del[0], del[1]], length: del[2]});
          this.store.y.connector.broadcastOps(ops);
        }
      }
    }
    * isGarbageCollected (id) {
      var n = yield * this.ds.findWithUpperBound(id);
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len && n.gc
    }
    /*
      A DeleteSet (ds) describes all the deleted ops in the OS
    */
    * writeDeleteSet (encoder) {
      var ds = new Map();
      yield * this.ds.iterate(this, null, null, function * (n) {
        var user = n.id[0];
        var counter = n.id[1];
        var len = n.len;
        var gc = n.gc;
        var dv = ds.get(user);
        if (dv === void 0) {
          dv = [];
          ds.set(user, dv);
        }
        dv.push([counter, len, gc]);
      });
      let keys = Array.from(ds.keys());
      encoder.writeUint32(keys.length);
      for (var i = 0; i < keys.length; i++) {
        let user = keys[i];
        let deletions = ds.get(user);
        encoder.writeVarUint(user);
        encoder.writeVarUint(deletions.length);
        for (var j = 0; j < deletions.length; j++) {
          let del = deletions[j];
          encoder.writeVarUint(del[0]);
          encoder.writeVarUint(del[1]);
          encoder.writeUint8(del[2] ? 1 : 0);
        }
      }
    }
    * isDeleted (id) {
      var n = yield * this.ds.findWithUpperBound(id);
      return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len
    }
    * setOperation (op) {
      yield * this.os.put(op);
      return op
    }
    * addOperation (op) {
      yield * this.os.put(op);
      // case op is created by this user, op is already broadcasted in applyCreatedOperations
      if (op.id[0] !== this.store.userId && this.store.forwardAppliedOperations && typeof op.id[1] !== 'string') {
        // is connected, and this is not going to be send in addOperation
        this.store.y.connector.broadcastOps([op]);
      }
    }
    // if insertion, try to combine with left insertion (if both have content property)
    * tryCombineWithLeft (op) {
      if (
        op != null &&
        op.left != null &&
        op.content != null &&
        op.left[0] === op.id[0] &&
        Y.utils.compareIds(op.left, op.origin)
      ) {
        var left = yield * this.getInsertion(op.left);
        if (left.content != null &&
            left.id[1] + left.content.length === op.id[1] &&
            left.originOf.length === 1 &&
            !left.gc && !left.deleted &&
            !op.gc && !op.deleted
        ) {
          // combine!
          if (op.originOf != null) {
            left.originOf = op.originOf;
          } else {
            delete left.originOf;
          }
          left.content = left.content.concat(op.content);
          left.right = op.right;
          yield * this.os.delete(op.id);
          yield * this.setOperation(left);
        }
      }
    }
    * getInsertion (id) {
      var ins = yield * this.os.findWithUpperBound(id);
      if (ins == null) {
        return null
      } else {
        var len = ins.content != null ? ins.content.length : 1; // in case of opContent
        if (id[0] === ins.id[0] && id[1] < ins.id[1] + len) {
          return ins
        } else {
          return null
        }
      }
    }
    * getInsertionCleanStartEnd (id) {
      yield * this.getInsertionCleanStart(id);
      return yield * this.getInsertionCleanEnd(id)
    }
    // Return an insertion such that id is the first element of content
    // This function manipulates an operation, if necessary
    * getInsertionCleanStart (id) {
      var ins = yield * this.getInsertion(id);
      if (ins != null) {
        if (ins.id[1] === id[1]) {
          return ins
        } else {
          var left = Y.utils.copyObject(ins);
          ins.content = left.content.splice(id[1] - ins.id[1]);
          ins.id = id;
          var leftLid = Y.utils.getLastId(left);
          ins.origin = leftLid;
          left.originOf = [ins.id];
          left.right = ins.id;
          ins.left = leftLid;
          // debugger // check
          yield * this.setOperation(left);
          yield * this.setOperation(ins);
          if (left.gc) {
            this.store.queueGarbageCollector(ins.id);
          }
          return ins
        }
      } else {
        return null
      }
    }
    // Return an insertion such that id is the last element of content
    // This function manipulates an operation, if necessary
    * getInsertionCleanEnd (id) {
      var ins = yield * this.getInsertion(id);
      if (ins != null) {
        if (ins.content == null || (ins.id[1] + ins.content.length - 1 === id[1])) {
          return ins
        } else {
          var right = Y.utils.copyObject(ins);
          right.content = ins.content.splice(id[1] - ins.id[1] + 1); // cut off remainder
          right.id = [id[0], id[1] + 1];
          var insLid = Y.utils.getLastId(ins);
          right.origin = insLid;
          ins.originOf = [right.id];
          ins.right = right.id;
          right.left = insLid;
          // debugger // check
          yield * this.setOperation(right);
          yield * this.setOperation(ins);
          if (ins.gc) {
            this.store.queueGarbageCollector(right.id);
          }
          return ins
        }
      } else {
        return null
      }
    }
    * getOperation (id/* :any */)/* :Transaction<any> */ {
      var o = yield * this.os.find(id);
      if (id[0] !== 0xFFFFFF || o != null) {
        return o
      } else { // type is string
        // generate this operation?
        var comp = id[1].split('_');
        if (comp.length > 1) {
          var struct = comp[0];
          var op = Y.Struct[struct].create(id);
          op.type = comp[1];
          yield * this.setOperation(op);
          return op
        } else {
          throw new Error(
            'Unexpected case. Operation cannot be generated correctly!' +
            'Incompatible Yjs version?'
          )
        }
      }
    }
    * removeOperation (id) {
      yield * this.os.delete(id);
    }
    * setState (state) {
      var val = {
        id: [state.user],
        clock: state.clock
      };
      yield * this.ss.put(val);
    }
    * getState (user) {
      var n = yield * this.ss.find([user]);
      var clock = n == null ? null : n.clock;
      if (clock == null) {
        clock = 0;
      }
      return {
        user: user,
        clock: clock
      }
    }
    * getStateVector () {
      var stateVector = [];
      yield * this.ss.iterate(this, null, null, function * (n) {
        stateVector.push({
          user: n.id[0],
          clock: n.clock
        });
      });
      return stateVector
    }
    * getStateSet () {
      var ss = {};
      yield * this.ss.iterate(this, null, null, function * (n) {
        ss[n.id[0]] = n.clock;
      });
      return ss
    }
    * writeStateSet (encoder) {
      let lenPosition = encoder.pos;
      let len = 0;
      encoder.writeUint32(0);
      yield * this.ss.iterate(this, null, null, function * (n) {
        encoder.writeVarUint(n.id[0]);
        encoder.writeVarUint(n.clock);
        len++;
      });
      encoder.setUint32(lenPosition, len);
      return len === 0
    }
    /*
      Here, we make all missing operations executable for the receiving user.

      Notes:
        startSS: denotes to the SV that the remote user sent
        currSS:  denotes to the state vector that the user should have if he
                 applies all already sent operations (increases is each step)

      We face several problems:
      * Execute op as is won't work because ops depend on each other
       -> find a way so that they do not anymore
      * When changing left, must not go more to the left than the origin
      * When changing right, you have to consider that other ops may have op
        as their origin, this means that you must not set one of these ops
        as the new right (interdependencies of ops)
      * can't just go to the right until you find the first known operation,
        With currSS
          -> interdependency of ops is a problem
        With startSS
          -> leads to inconsistencies when two users join at the same time.
             Then the position depends on the order of execution -> error!

        Solution:
        -> re-create originial situation
          -> set op.left = op.origin (which never changes)
          -> set op.right
               to the first operation that is known (according to startSS)
               or to the first operation that has an origin that is not to the
               right of op.
          -> Enforces unique execution order -> happy user

        Improvements: TODO
          * Could set left to origin, or the first known operation
            (startSS or currSS.. ?)
            -> Could be necessary when I turn GC again.
            -> Is a bad(ish) idea because it requires more computation

      What we do:
      * Iterate over all missing operations.
      * When there is an operation, where the right op is known, send this op all missing ops to the left to the user
      * I explained above what we have to do with each operation. Here is how we do it efficiently:
        1. Go to the left until you find either op.origin, or a known operation (let o denote current operation in the iteration)
        2. Found a known operation -> set op.left = o, and send it to the user. stop
        3. Found o = op.origin -> set op.left = op.origin, and send it to the user. start again from 1. (set op = o)
        4. Found some o -> set o.right = op, o.left = o.origin, send it to the user, continue
    */
    * getOperations (startSS) {
      // TODO: use bounds here!
      if (startSS == null) {
        startSS = new Map();
      }
      var send = [];

      var endSV = yield * this.getStateVector();
      for (let endState of endSV) {
        let user = endState.user;
        if (user === 0xFFFFFF) {
          continue
        }
        let startPos = startSS.get(user) || 0;
        if (startPos > 0) {
          // There is a change that [user, startPos] is in a composed Insertion (with a smaller counter)
          // find out if that is the case
          let firstMissing = yield * this.getInsertion([user, startPos]);
          if (firstMissing != null) {
            // update startPos
            startPos = firstMissing.id[1];
          }
        }
        startSS.set(user, startPos);
      }
      for (let endState of endSV) {
        let user = endState.user;
        let startPos = startSS.get(user);
        if (user === 0xFFFFFF) {
          continue
        }
        yield * this.os.iterate(this, [user, startPos], [user, Number.MAX_VALUE], function * (op) {
          op = Y.Struct[op.struct].encode(op);
          if (op.struct !== 'Insert') {
            send.push(op);
          } else if (op.right == null || op.right[1] < (startSS.get(op.right[0]) || 0)) {
            // case 1. op.right is known
            // this case is only reached if op.right is known.
            // => this is not called for op.left, as op.right is unknown
            let o = op;
            // Remember: ?
            // -> set op.right
            //    1. to the first operation that is known (according to startSS)
            //    2. or to the first operation that has an origin that is not to the
            //      right of op.
            // For this we maintain a list of ops which origins are not found yet.
            var missingOrigins = [op];
            var newright = op.right;
            while (true) {
              if (o.left == null) {
                op.left = null;
                send.push(op);
                /* not necessary, as o is already sent..
                if (!Y.utils.compareIds(o.id, op.id) && o.id[1] >= (startSS.get(o.id[0]) || 0)) {
                  // o is not op && o is unknown
                  o = Y.Struct[op.struct].encode(o)
                  o.right = missingOrigins[missingOrigins.length - 1].id
                  send.push(o)
                }
                */
                break
              }
              o = yield * this.getInsertion(o.left);
              // we set another o, check if we can reduce $missingOrigins
              while (missingOrigins.length > 0 && Y.utils.matchesId(o, missingOrigins[missingOrigins.length - 1].origin)) {
                missingOrigins.pop();
              }
              if (o.id[1] < (startSS.get(o.id[0]) || 0)) {
                // case 2. o is known
                op.left = Y.utils.getLastId(o);
                send.push(op);
                break
              } else if (Y.utils.matchesId(o, op.origin)) {
                // case 3. o is op.origin
                op.left = op.origin;
                send.push(op);
                op = Y.Struct[op.struct].encode(o);
                op.right = newright;
                if (missingOrigins.length > 0) {
                  throw new Error(
                    'Reached inconsistent OS state.' +
                    'Operations are not correctly connected.'
                  )
                }
                missingOrigins = [op];
              } else {
                // case 4. send o, continue to find op.origin
                var s = Y.Struct[op.struct].encode(o);
                s.right = missingOrigins[missingOrigins.length - 1].id;
                s.left = s.origin;
                send.push(s);
                missingOrigins.push(o);
              }
            }
          }
        });
      }
      return send.reverse()
    }

    * writeOperations (encoder, decoder) {
      let ss = new Map();
      let ssLength = decoder.readUint32();
      for (let i = 0; i < ssLength; i++) {
        let user = decoder.readVarUint();
        let clock = decoder.readVarUint();
        ss.set(user, clock);
      }
      let ops = yield * this.getOperations(ss);
      encoder.writeUint32(ops.length);
      for (let i = 0; i < ops.length; i++) {
        let op = ops[i];
        Y.Struct[op.struct].binaryEncode(encoder, Y.Struct[op.struct].encode(op));
      }
    }
    /*
     * Get the plain untransformed operations from the database.
     * You can apply these operations using .applyOperationsUntransformed(ops)
     *
     */
    * writeOperationsUntransformed (encoder) {
      let lenPosition = encoder.pos;
      let len = 0;
      encoder.writeUint32(0); // placeholder
      yield * this.os.iterate(this, null, null, function * (op) {
        if (op.id[0] !== 0xFFFFFF) {
          len++;
          Y.Struct[op.struct].binaryEncode(encoder, Y.Struct[op.struct].encode(op));
        }
      });
      encoder.setUint32(lenPosition, len);
      yield * this.writeStateSet(encoder);
    }
    * applyOperationsUntransformed (decoder) {
      let len = decoder.readUint32();
      for (let i = 0; i < len; i++) {
        let op = Y.Struct.binaryDecodeOperation(decoder);
        yield * this.os.put(op);
      }
      yield * this.os.iterate(this, null, null, function * (op) {
        if (op.parent != null) {
          if (op.struct === 'Insert') {
            // update parents .map/start/end properties
            if (op.parentSub != null && op.left == null) {
              // op is child of Map
              let parent = yield * this.getOperation(op.parent);
              parent.map[op.parentSub] = op.id;
              yield * this.setOperation(parent);
            } else if (op.right == null || op.left == null) {
              let parent = yield * this.getOperation(op.parent);
              if (op.right == null) {
                parent.end = Y.utils.getLastId(op);
              }
              if (op.left == null) {
                parent.start = op.id;
              }
              yield * this.setOperation(parent);
            }
          }
        }
      });
      let stateSetLength = decoder.readUint32();
      for (let i = 0; i < stateSetLength; i++) {
        let user = decoder.readVarUint();
        let clock = decoder.readVarUint();
        yield * this.ss.put({
          id: [user],
          clock: clock
        });
      }
    }
    /* this is what we used before.. use this as a reference..
    * makeOperationReady (startSS, op) {
      op = Y.Struct[op.struct].encode(op)
      op = Y.utils.copyObject(op) -- use copyoperation instead now!
      var o = op
      var ids = [op.id]
      // search for the new op.right
      // it is either the first known op (according to startSS)
      // or the o that has no origin to the right of op
      // (this is why we use the ids array)
      while (o.right != null) {
        var right = yield * this.getOperation(o.right)
        if (o.right[1] < (startSS[o.right[0]] || 0) || !ids.some(function (id) {
          return Y.utils.compareIds(id, right.origin)
        })) {
          break
        }
        ids.push(o.right)
        o = right
      }
      op.right = o.right
      op.left = op.origin
      return op
    }
    */
    * flush () {
      yield * this.os.flush();
      yield * this.ss.flush();
      yield * this.ds.flush();
    }
  }
  Y.Transaction = TransactionInterface;
}

const CDELETE = 0;
const CINSERT = 1;
const CLIST = 2;
const CMAP = 3;

/*
 An operation also defines the structure of a type. This is why operation and
 structure are used interchangeably here.

 It must be of the type Object. I hope to achieve some performance
 improvements when working on databases that support the json format.

 An operation must have the following properties:

 * encode
     - Encode the structure in a readable format (preferably string- todo)
 * decode (todo)
     - decode structure to json
 * execute
     - Execute the semantics of an operation.
 * requiredOps
     - Operations that are required to execute this operation.
*/
function extendStruct (Y) {
  var Struct = {
    binaryDecodeOperation: function (decoder) {
      let code = decoder.peekUint8();
      if (code === CDELETE) {
        return Y.Struct.Delete.binaryDecode(decoder)
      } else if (code === CINSERT) {
        return Y.Struct.Insert.binaryDecode(decoder)
      } else if (code === CLIST) {
        return Y.Struct.List.binaryDecode(decoder)
      } else if (code === CMAP) {
        return Y.Struct.Map.binaryDecode(decoder)
      } else {
        throw new Error('Unable to decode operation!')
      }
    },
    /* This is the only operation that is actually not a structure, because
    it is not stored in the OS. This is why it _does not_ have an id

    op = {
      target: Id
    }
    */
    Delete: {
      encode: function (op) {
        return {
          target: op.target,
          length: op.length || 0,
          struct: 'Delete'
        }
      },
      binaryEncode: function (encoder, op) {
        encoder.writeUint8(CDELETE);
        encoder.writeOpID(op.target);
        encoder.writeVarUint(op.length || 0);
      },
      binaryDecode: function (decoder) {
        decoder.skip8();
        return {
          target: decoder.readOpID(),
          length: decoder.readVarUint(),
          struct: 'Delete'
        }
      },
      requiredOps: function (op) {
        return [] // [op.target]
      },
      execute: function * (op) {
        return yield * this.deleteOperation(op.target, op.length || 1)
      }
    },
    Insert: {
      /* {
          content: [any],
          opContent: Id,
          id: Id,
          left: Id,
          origin: Id,
          right: Id,
          parent: Id,
          parentSub: string (optional), // child of Map type
        }
      */
      encode: function (op/* :Insertion */) /* :Insertion */ {
        // TODO: you could not send the "left" property, then you also have to
        // "op.left = null" in $execute or $decode
        var e/* :any */ = {
          id: op.id,
          left: op.left,
          right: op.right,
          origin: op.origin,
          parent: op.parent,
          struct: op.struct
        };
        if (op.parentSub != null) {
          e.parentSub = op.parentSub;
        }
        if (op.hasOwnProperty('opContent')) {
          e.opContent = op.opContent;
        } else {
          e.content = op.content.slice();
        }

        return e
      },
      binaryEncode: function (encoder, op) {
        encoder.writeUint8(CINSERT);
        // compute info property
        let contentIsText = op.content != null && op.content.every(c => typeof c === 'string' && c.length === 1);
        let originIsLeft = Y.utils.compareIds(op.left, op.origin);
        let info =
          (op.parentSub != null ? 1 : 0) |
          (op.opContent != null ? 2 : 0) |
          (contentIsText ? 4 : 0) |
          (originIsLeft ? 8 : 0) |
          (op.left != null ? 16 : 0) |
          (op.right != null ? 32 : 0) |
          (op.origin != null ? 64 : 0);
        encoder.writeUint8(info);
        encoder.writeOpID(op.id);
        encoder.writeOpID(op.parent);
        if (info & 16) {
          encoder.writeOpID(op.left);
        }
        if (info & 32) {
          encoder.writeOpID(op.right);
        }
        if (!originIsLeft && info & 64) {
          encoder.writeOpID(op.origin);
        }
        if (info & 1) {
          // write parentSub
          encoder.writeVarString(op.parentSub);
        }
        if (info & 2) {
          // write opContent
          encoder.writeOpID(op.opContent);
        } else if (info & 4) {
          // write text
          encoder.writeVarString(op.content.join(''));
        } else {
          // convert to JSON and write
          encoder.writeVarString(JSON.stringify(op.content));
        }
      },
      binaryDecode: function (decoder) {
        let op = {
          struct: 'Insert'
        };
        decoder.skip8();
        // get info property
        let info = decoder.readUint8();

        op.id = decoder.readOpID();
        op.parent = decoder.readOpID();
        if (info & 16) {
          op.left = decoder.readOpID();
        } else {
          op.left = null;
        }
        if (info & 32) {
          op.right = decoder.readOpID();
        } else {
          op.right = null;
        }
        if (info & 8) {
          // origin is left
          op.origin = op.left;
        } else if (info & 64) {
          op.origin = decoder.readOpID();
        } else {
          op.origin = null;
        }
        if (info & 1) {
          // has parentSub
          op.parentSub = decoder.readVarString();
        }
        if (info & 2) {
          // has opContent
          op.opContent = decoder.readOpID();
        } else if (info & 4) {
          // has pure text content
          op.content = decoder.readVarString().split('');
        } else {
          // has mixed content
          let s = decoder.readVarString();
          op.content = JSON.parse(s);
        }
        return op
      },
      requiredOps: function (op) {
        var ids = [];
        if (op.left != null) {
          ids.push(op.left);
        }
        if (op.right != null) {
          ids.push(op.right);
        }
        if (op.origin != null && !Y.utils.compareIds(op.left, op.origin)) {
          ids.push(op.origin);
        }
        // if (op.right == null && op.left == null) {
        ids.push(op.parent);

        if (op.opContent != null) {
          ids.push(op.opContent);
        }
        return ids
      },
      getDistanceToOrigin: function * (op) {
        if (op.left == null) {
          return 0
        } else {
          var d = 0;
          var o = yield * this.getInsertion(op.left);
          while (!Y.utils.matchesId(o, op.origin)) {
            d++;
            if (o.left == null) {
              break
            } else {
              o = yield * this.getInsertion(o.left);
            }
          }
          return d
        }
      },
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
      execute: function * (op) {
        var i; // loop counter

        // during this function some ops may get split into two pieces (e.g. with getInsertionCleanEnd)
        // We try to merge them later, if possible
        var tryToRemergeLater = [];

        if (op.origin != null) { // TODO: !== instead of !=
          // we save in origin that op originates in it
          // we need that later when we eventually garbage collect origin (see transaction)
          var origin = yield * this.getInsertionCleanEnd(op.origin);
          if (origin.originOf == null) {
            origin.originOf = [];
          }
          origin.originOf.push(op.id);
          yield * this.setOperation(origin);
          if (origin.right != null) {
            tryToRemergeLater.push(origin.right);
          }
        }
        var distanceToOrigin = i = yield * Struct.Insert.getDistanceToOrigin.call(this, op); // most cases: 0 (starts from 0)

        // now we begin to insert op in the list of insertions..
        var o;
        var parent;
        var start;

        // find o. o is the first conflicting operation
        if (op.left != null) {
          o = yield * this.getInsertionCleanEnd(op.left);
          if (!Y.utils.compareIds(op.left, op.origin) && o.right != null) {
            // only if not added previously
            tryToRemergeLater.push(o.right);
          }
          o = (o.right == null) ? null : yield * this.getOperation(o.right);
        } else { // left == null
          parent = yield * this.getOperation(op.parent);
          let startId = op.parentSub ? parent.map[op.parentSub] : parent.start;
          start = startId == null ? null : yield * this.getOperation(startId);
          o = start;
        }

        // make sure to split op.right if necessary (also add to tryCombineWithLeft)
        if (op.right != null) {
          tryToRemergeLater.push(op.right);
          yield * this.getInsertionCleanStart(op.right);
        }

        // handle conflicts
        while (true) {
          if (o != null && !Y.utils.compareIds(o.id, op.right)) {
            var oOriginDistance = yield * Struct.Insert.getDistanceToOrigin.call(this, o);
            if (oOriginDistance === i) {
              // case 1
              if (o.id[0] < op.id[0]) {
                op.left = Y.utils.getLastId(o);
                distanceToOrigin = i + 1; // just ignore o.content.length, doesn't make a difference
              }
            } else if (oOriginDistance < i) {
              // case 2
              if (i - distanceToOrigin <= oOriginDistance) {
                op.left = Y.utils.getLastId(o);
                distanceToOrigin = i + 1; // just ignore o.content.length, doesn't make a difference
              }
            } else {
              break
            }
            i++;
            if (o.right != null) {
              o = yield * this.getInsertion(o.right);
            } else {
              o = null;
            }
          } else {
            break
          }
        }

        // reconnect..
        var left = null;
        var right = null;
        if (parent == null) {
          parent = yield * this.getOperation(op.parent);
        }

        // reconnect left and set right of op
        if (op.left != null) {
          left = yield * this.getInsertion(op.left);
          // link left
          op.right = left.right;
          left.right = op.id;

          yield * this.setOperation(left);
        } else {
          // set op.right from parent, if necessary
          op.right = op.parentSub ? parent.map[op.parentSub] || null : parent.start;
        }
        // reconnect right
        if (op.right != null) {
          // TODO: wanna connect right too?
          right = yield * this.getOperation(op.right);
          right.left = Y.utils.getLastId(op);

          // if right exists, and it is supposed to be gc'd. Remove it from the gc
          if (right.gc != null) {
            if (right.content != null && right.content.length > 1) {
              right = yield * this.getInsertionCleanEnd(right.id);
            }
            this.store.removeFromGarbageCollector(right);
          }
          yield * this.setOperation(right);
        }

        // update parents .map/start/end properties
        if (op.parentSub != null) {
          if (left == null) {
            parent.map[op.parentSub] = op.id;
            yield * this.setOperation(parent);
          }
          // is a child of a map struct.
          // Then also make sure that only the most left element is not deleted
          // We do not call the type in this case (this is what the third parameter is for)
          if (op.right != null) {
            yield * this.deleteOperation(op.right, 1, true);
          }
          if (op.left != null) {
            yield * this.deleteOperation(op.id, 1, true);
          }
        } else {
          if (right == null || left == null) {
            if (right == null) {
              parent.end = Y.utils.getLastId(op);
            }
            if (left == null) {
              parent.start = op.id;
            }
            yield * this.setOperation(parent);
          }
        }

        // try to merge original op.left and op.origin
        for (i = 0; i < tryToRemergeLater.length; i++) {
          var m = yield * this.getOperation(tryToRemergeLater[i]);
          yield * this.tryCombineWithLeft(m);
        }
      }
    },
    List: {
      /*
      {
        start: null,
        end: null,
        struct: "List",
        type: "",
        id: this.os.getNextOpId(1)
      }
      */
      create: function (id) {
        return {
          start: null,
          end: null,
          struct: 'List',
          id: id
        }
      },
      encode: function (op) {
        var e = {
          struct: 'List',
          id: op.id,
          type: op.type
        };
        if (op.info != null) {
          e.info = op.info;
        }
        return e
      },
      binaryEncode: function (encoder, op) {
        encoder.writeUint8(CLIST);
        encoder.writeOpID(op.id);
        encoder.writeVarString(op.type);
        let info = op.info != null ? JSON.stringify(op.info) : '';
        encoder.writeVarString(info);
      },
      binaryDecode: function (decoder) {
        decoder.skip8();
        let op = {
          id: decoder.readOpID(),
          type: decoder.readVarString(),
          struct: 'List'
        };
        let info = decoder.readVarString();
        if (info.length > 0) {
          op.info = JSON.parse(info);
        }
        return op
      },
      requiredOps: function () {
        /*
        var ids = []
        if (op.start != null) {
          ids.push(op.start)
        }
        if (op.end != null){
          ids.push(op.end)
        }
        return ids
        */
        return []
      },
      execute: function * (op) {
        op.start = null;
        op.end = null;
      },
      ref: function * (op, pos) {
        if (op.start == null) {
          return null
        }
        var res = null;
        var o = yield * this.getOperation(op.start);

        while (true) {
          if (!o.deleted) {
            res = o;
            pos--;
          }
          if (pos >= 0 && o.right != null) {
            o = yield * this.getOperation(o.right);
          } else {
            break
          }
        }
        return res
      },
      map: function * (o, f) {
        o = o.start;
        var res = [];
        while (o != null) { // TODO: change to != (at least some convention)
          var operation = yield * this.getOperation(o);
          if (!operation.deleted) {
            res.push(f(operation));
          }
          o = operation.right;
        }
        return res
      }
    },
    Map: {
      /*
        {
          map: {},
          struct: "Map",
          type: "",
          id: this.os.getNextOpId(1)
        }
      */
      create: function (id) {
        return {
          id: id,
          map: {},
          struct: 'Map'
        }
      },
      encode: function (op) {
        var e = {
          struct: 'Map',
          type: op.type,
          id: op.id,
          map: {} // overwrite map!!
        };
        if (op.requires != null) {
          e.requires = op.require;
          // TODO: !!
          console.warn('requires is used! see same note above for List');
        }
        if (op.info != null) {
          e.info = op.info;
        }
        return e
      },
      binaryEncode: function (encoder, op) {
        encoder.writeUint8(CMAP);
        encoder.writeOpID(op.id);
        encoder.writeVarString(op.type);
        let info = op.info != null ? JSON.stringify(op.info) : '';
        encoder.writeVarString(info);
      },
      binaryDecode: function (decoder) {
        decoder.skip8();
        let op = {
          id: decoder.readOpID(),
          type: decoder.readVarString(),
          struct: 'Map',
          map: {}
        };
        let info = decoder.readVarString();
        if (info.length > 0) {
          op.info = JSON.parse(info);
        }
        return op
      },
      requiredOps: function () {
        return []
      },
      execute: function * () {},
      /*
        Get a property by name
      */
      get: function * (op, name) {
        var oid = op.map[name];
        if (oid != null) {
          var res = yield * this.getOperation(oid);
          if (res == null || res.deleted) {
            return void 0
          } else if (res.opContent == null) {
            return res.content[0]
          } else {
            return yield * this.getType(res.opContent)
          }
        }
      }
    }
  };
  Y.Struct = Struct;
}

/* globals crypto */

/*
  EventHandler is an helper class for constructing custom types.

  Why: When constructing custom types, you sometimes want your types to work
  synchronous: E.g.
  ``` Synchronous
    mytype.setSomething("yay")
    mytype.getSomething() === "yay"
  ```
  versus
  ``` Asynchronous
    mytype.setSomething("yay")
    mytype.getSomething() === undefined
    mytype.waitForSomething().then(function(){
      mytype.getSomething() === "yay"
    })
  ```

  The structures usually work asynchronously (you have to wait for the
  database request to finish). EventHandler helps you to make your type
  synchronous.
*/

function Utils (Y) {
  Y.utils = {
    BinaryDecoder: BinaryDecoder,
    BinaryEncoder: BinaryEncoder
  };

  Y.utils.bubbleEvent = function (type, event) {
    type.eventHandler.callEventListeners(event);
    event.path = [];
    while (type != null && type._deepEventHandler != null) {
      type._deepEventHandler.callEventListeners(event);
      var parent = null;
      if (type._parent != null) {
        parent = type.os.getType(type._parent);
      }
      if (parent != null && parent._getPathToChild != null) {
        event.path = [parent._getPathToChild(type._model)].concat(event.path);
        type = parent;
      } else {
        type = null;
      }
    }
  };

  class NamedEventHandler {
    constructor () {
      this._eventListener = {};
    }
    on (name, f) {
      if (this._eventListener[name] == null) {
        this._eventListener[name] = [];
      }
      this._eventListener[name].push(f);
    }
    off (name, f) {
      if (name == null || f == null) {
        throw new Error('You must specify event name and function!')
      }
      let listener = this._eventListener[name] || [];
      this._eventListener[name] = listener.filter(e => e !== f);
    }
    emit (name, value) {
      (this._eventListener[name] || []).forEach(l => l(value));
    }
    destroy () {
      this._eventListener = null;
    }
  }
  Y.utils.NamedEventHandler = NamedEventHandler;

  class EventListenerHandler {
    constructor () {
      this.eventListeners = [];
    }
    destroy () {
      this.eventListeners = null;
    }
     /*
      Basic event listener boilerplate...
    */
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
          var _event = {};
          for (var name in event) {
            _event[name] = event[name];
          }
          this.eventListeners[i](_event);
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
  Y.utils.EventListenerHandler = EventListenerHandler;

  class EventHandler extends EventListenerHandler {
    /* ::
    waiting: Array<Insertion | Deletion>;
    awaiting: number;
    onevent: Function;
    eventListeners: Array<Function>;
    */
    /*
      onevent: is called when the structure changes.

      Note: "awaiting opertations" is used to denote operations that were
      prematurely called. Events for received operations can not be executed until
      all prematurely called operations were executed ("waiting operations")
    */
    constructor (onevent /* : Function */) {
      super();
      this.waiting = [];
      this.awaiting = 0;
      this.onevent = onevent;
    }
    destroy () {
      super.destroy();
      this.waiting = null;
      this.onevent = null;
    }
    /*
      Call this when a new operation arrives. It will be executed right away if
      there are no waiting operations, that you prematurely executed
    */
    receivedOp (op) {
      if (this.awaiting <= 0) {
        this.onevent(op);
      } else if (op.struct === 'Delete') {
        var self = this;
        var checkDelete = function checkDelete (d) {
          if (d.length == null) {
            throw new Error('This shouldn\'t happen! d.length must be defined!')
          }
          // we check if o deletes something in self.waiting
          // if so, we remove the deleted operation
          for (var w = 0; w < self.waiting.length; w++) {
            var i = self.waiting[w];
            if (i.struct === 'Insert' && i.id[0] === d.target[0]) {
              var iLength = i.hasOwnProperty('content') ? i.content.length : 1;
              var dStart = d.target[1];
              var dEnd = d.target[1] + (d.length || 1);
              var iStart = i.id[1];
              var iEnd = i.id[1] + iLength;
              // Check if they don't overlap
              if (iEnd <= dStart || dEnd <= iStart) {
                // no overlapping
                continue
              }
              // we check all overlapping cases. All cases:
              /*
                1)  iiiii
                      ddddd
                    --> modify i and d
                2)  iiiiiii
                      ddddd
                    --> modify i, remove d
                3)  iiiiiii
                      ddd
                    --> remove d, modify i, and create another i (for the right hand side)
                4)  iiiii
                    ddddddd
                    --> remove i, modify d
                5)  iiiiiii
                    ddddddd
                    --> remove both i and d (**)
                6)  iiiiiii
                    ddddd
                    --> modify i, remove d
                7)    iii
                    ddddddd
                    --> remove i, create and apply two d with checkDelete(d) (**)
                8)    iiiii
                    ddddddd
                    --> remove i, modify d (**)
                9)    iiiii
                    ddddd
                    --> modify i and d
                (**) (also check if i contains content or type)
              */
              // TODO: I left some debugger statements, because I want to debug all cases once in production. REMEMBER END TODO
              if (iStart < dStart) {
                if (dStart < iEnd) {
                  if (iEnd < dEnd) {
                    // Case 1
                    // remove the right part of i's content
                    i.content.splice(dStart - iStart);
                    // remove the start of d's deletion
                    d.length = dEnd - iEnd;
                    d.target = [d.target[0], iEnd];
                    continue
                  } else if (iEnd === dEnd) {
                    // Case 2
                    i.content.splice(dStart - iStart);
                    // remove d, we do that by simply ending this function
                    return
                  } else { // (dEnd < iEnd)
                    // Case 3
                    var newI = {
                      id: [i.id[0], dEnd],
                      content: i.content.slice(dEnd - iStart),
                      struct: 'Insert'
                    };
                    self.waiting.push(newI);
                    i.content.splice(dStart - iStart);
                    return
                  }
                }
              } else if (dStart === iStart) {
                if (iEnd < dEnd) {
                  // Case 4
                  d.length = dEnd - iEnd;
                  d.target = [d.target[0], iEnd];
                  i.content = [];
                  continue
                } else if (iEnd === dEnd) {
                  // Case 5
                  self.waiting.splice(w, 1);
                  return
                } else { // (dEnd < iEnd)
                  // Case 6
                  i.content = i.content.slice(dEnd - iStart);
                  i.id = [i.id[0], dEnd];
                  return
                }
              } else { // (dStart < iStart)
                if (iStart < dEnd) {
                  // they overlap
                  /*
                  7)    iii
                      ddddddd
                      --> remove i, create and apply two d with checkDelete(d) (**)
                  8)    iiiii
                      ddddddd
                      --> remove i, modify d (**)
                  9)    iiiii
                      ddddd
                      --> modify i and d
                  */
                  if (iEnd < dEnd) {
                    // Case 7
                    // debugger // TODO: You did not test this case yet!!!! (add the debugger here)
                    self.waiting.splice(w, 1);
                    checkDelete({
                      target: [d.target[0], dStart],
                      length: iStart - dStart,
                      struct: 'Delete'
                    });
                    checkDelete({
                      target: [d.target[0], iEnd],
                      length: iEnd - dEnd,
                      struct: 'Delete'
                    });
                    return
                  } else if (iEnd === dEnd) {
                    // Case 8
                    self.waiting.splice(w, 1);
                    w--;
                    d.length -= iLength;
                    continue
                  } else { // dEnd < iEnd
                    // Case 9
                    d.length = iStart - dStart;
                    i.content.splice(0, dEnd - iStart);
                    i.id = [i.id[0], dEnd];
                    continue
                  }
                }
              }
            }
          }
          // finished with remaining operations
          self.waiting.push(d);
        };
        if (op.key == null) {
          // deletes in list
          checkDelete(op);
        } else {
          // deletes in map
          this.waiting.push(op);
        }
      } else {
        this.waiting.push(op);
      }
    }
    /*
      You created some operations, and you want the `onevent` function to be
      called right away. Received operations will not be executed untill all
      prematurely called operations are executed
    */
    awaitAndPrematurelyCall (ops) {
      this.awaiting++;
      ops.map(Y.utils.copyOperation).forEach(this.onevent);
    }
    * awaitOps (transaction, f, args) {
      function notSoSmartSort (array) {
        // this function sorts insertions in a executable order
        var result = [];
        while (array.length > 0) {
          for (var i = 0; i < array.length; i++) {
            var independent = true;
            for (var j = 0; j < array.length; j++) {
              if (Y.utils.matchesId(array[j], array[i].left)) {
                // array[i] depends on array[j]
                independent = false;
                break
              }
            }
            if (independent) {
              result.push(array.splice(i, 1)[0]);
              i--;
            }
          }
        }
        return result
      }
      var before = this.waiting.length;
      // somehow create new operations
      yield * f.apply(transaction, args);
      // remove all appended ops / awaited ops
      this.waiting.splice(before);
      if (this.awaiting > 0) this.awaiting--;
      // if there are no awaited ops anymore, we can update all waiting ops, and send execute them (if there are still no awaited ops)
      if (this.awaiting === 0 && this.waiting.length > 0) {
        // update all waiting ops
        for (let i = 0; i < this.waiting.length; i++) {
          var o = this.waiting[i];
          if (o.struct === 'Insert') {
            var _o = yield * transaction.getInsertion(o.id);
            if (_o.parentSub != null && _o.left != null) {
              // if o is an insertion of a map struc (parentSub is defined), then it shouldn't be necessary to compute left
              this.waiting.splice(i, 1);
              i--; // update index
            } else if (!Y.utils.compareIds(_o.id, o.id)) {
              // o got extended
              o.left = [o.id[0], o.id[1] - 1];
            } else if (_o.left == null) {
              o.left = null;
            } else {
              // find next undeleted op
              var left = yield * transaction.getInsertion(_o.left);
              while (left.deleted != null) {
                if (left.left != null) {
                  left = yield * transaction.getInsertion(left.left);
                } else {
                  left = null;
                  break
                }
              }
              o.left = left != null ? Y.utils.getLastId(left) : null;
            }
          }
        }
        // the previous stuff was async, so we have to check again!
        // We also pull changes from the bindings, if there exists such a method, this could increase awaiting too
        if (this._pullChanges != null) {
          this._pullChanges();
        }
        if (this.awaiting === 0) {
          // sort by type, execute inserts first
          var ins = [];
          var dels = [];
          this.waiting.forEach(function (o) {
            if (o.struct === 'Delete') {
              dels.push(o);
            } else {
              ins.push(o);
            }
          });
          this.waiting = [];
          // put in executable order
          ins = notSoSmartSort(ins);
          // this.onevent can trigger the creation of another operation
          // -> check if this.awaiting increased & stop computation if it does
          for (var i = 0; i < ins.length; i++) {
            if (this.awaiting === 0) {
              this.onevent(ins[i]);
            } else {
              this.waiting = this.waiting.concat(ins.slice(i));
              break
            }
          }
          for (i = 0; i < dels.length; i++) {
            if (this.awaiting === 0) {
              this.onevent(dels[i]);
            } else {
              this.waiting = this.waiting.concat(dels.slice(i));
              break
            }
          }
        }
      }
    }
    // TODO: Remove awaitedInserts and awaitedDeletes in favor of awaitedOps, as they are deprecated and do not always work
    // Do this in one of the coming releases that are breaking anyway
    /*
      Call this when you successfully awaited the execution of n Insert operations
    */
    awaitedInserts (n) {
      var ops = this.waiting.splice(this.waiting.length - n);
      for (var oid = 0; oid < ops.length; oid++) {
        var op = ops[oid];
        if (op.struct === 'Insert') {
          for (var i = this.waiting.length - 1; i >= 0; i--) {
            let w = this.waiting[i];
            // TODO: do I handle split operations correctly here? Super unlikely, but yeah..
            // Also: can this case happen? Can op be inserted in the middle of a larger op that is in $waiting?
            if (w.struct === 'Insert') {
              if (Y.utils.matchesId(w, op.left)) {
                // include the effect of op in w
                w.right = op.id;
                // exclude the effect of w in op
                op.left = w.left;
              } else if (Y.utils.compareIds(w.id, op.right)) {
                // similar..
                w.left = Y.utils.getLastId(op);
                op.right = w.right;
              }
            }
          }
        } else {
          throw new Error('Expected Insert Operation!')
        }
      }
      this._tryCallEvents(n);
    }
    /*
      Call this when you successfully awaited the execution of n Delete operations
    */
    awaitedDeletes (n, newLeft) {
      var ops = this.waiting.splice(this.waiting.length - n);
      for (var j = 0; j < ops.length; j++) {
        var del = ops[j];
        if (del.struct === 'Delete') {
          if (newLeft != null) {
            for (var i = 0; i < this.waiting.length; i++) {
              let w = this.waiting[i];
              // We will just care about w.left
              if (w.struct === 'Insert' && Y.utils.compareIds(del.target, w.left)) {
                w.left = newLeft;
              }
            }
          }
        } else {
          throw new Error('Expected Delete Operation!')
        }
      }
      this._tryCallEvents(n);
    }
    /* (private)
      Try to execute the events for the waiting operations
    */
    _tryCallEvents () {
      function notSoSmartSort (array) {
        var result = [];
        while (array.length > 0) {
          for (var i = 0; i < array.length; i++) {
            var independent = true;
            for (var j = 0; j < array.length; j++) {
              if (Y.utils.matchesId(array[j], array[i].left)) {
                // array[i] depends on array[j]
                independent = false;
                break
              }
            }
            if (independent) {
              result.push(array.splice(i, 1)[0]);
              i--;
            }
          }
        }
        return result
      }
      if (this.awaiting > 0) this.awaiting--;
      if (this.awaiting === 0 && this.waiting.length > 0) {
        var ins = [];
        var dels = [];
        this.waiting.forEach(function (o) {
          if (o.struct === 'Delete') {
            dels.push(o);
          } else {
            ins.push(o);
          }
        });
        ins = notSoSmartSort(ins);
        ins.forEach(this.onevent);
        dels.forEach(this.onevent);
        this.waiting = [];
      }
    }
  }
  Y.utils.EventHandler = EventHandler;

  /*
    Default class of custom types!
  */
  class CustomType {
    getPath () {
      var parent = null;
      if (this._parent != null) {
        parent = this.os.getType(this._parent);
      }
      if (parent != null && parent._getPathToChild != null) {
        var firstKey = parent._getPathToChild(this._model);
        var parentKeys = parent.getPath();
        parentKeys.push(firstKey);
        return parentKeys
      } else {
        return []
      }
    }
  }
  Y.utils.CustomType = CustomType;

  /*
    A wrapper for the definition of a custom type.
    Every custom type must have three properties:

    * struct
      - Structname of this type
    * initType
      - Given a model, creates a custom type
    * class
      - the constructor of the custom type (e.g. in order to inherit from a type)
  */
  class CustomTypeDefinition { // eslint-disable-line
    /* ::
    struct: any;
    initType: any;
    class: Function;
    name: String;
    */
    constructor (def) {
      if (def.struct == null ||
        def.initType == null ||
        def.class == null ||
        def.name == null ||
        def.createType == null
      ) {
        throw new Error('Custom type was not initialized correctly!')
      }
      this.struct = def.struct;
      this.initType = def.initType;
      this.createType = def.createType;
      this.class = def.class;
      this.name = def.name;
      if (def.appendAdditionalInfo != null) {
        this.appendAdditionalInfo = def.appendAdditionalInfo;
      }
      this.parseArguments = (def.parseArguments || function () {
        return [this]
      }).bind(this);
      this.parseArguments.typeDefinition = this;
    }
  }
  Y.utils.CustomTypeDefinition = CustomTypeDefinition;

  Y.utils.isTypeDefinition = function isTypeDefinition (v) {
    if (v != null) {
      if (v instanceof Y.utils.CustomTypeDefinition) return [v]
      else if (v.constructor === Array && v[0] instanceof Y.utils.CustomTypeDefinition) return v
      else if (v instanceof Function && v.typeDefinition instanceof Y.utils.CustomTypeDefinition) return [v.typeDefinition]
    }
    return false
  };

  /*
    Make a flat copy of an object
    (just copy properties)
  */
  function copyObject (o) {
    var c = {};
    for (var key in o) {
      c[key] = o[key];
    }
    return c
  }
  Y.utils.copyObject = copyObject;

  /*
    Copy an operation, so that it can be manipulated.
    Note: You must not change subproperties (except o.content)!
  */
  function copyOperation (o) {
    o = copyObject(o);
    if (o.content != null) {
      o.content = o.content.map(function (c) { return c });
    }
    return o
  }

  Y.utils.copyOperation = copyOperation;

  /*
    Defines a smaller relation on Id's
  */
  function smaller (a, b) {
    return a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || typeof a[1] < typeof b[1]))
  }
  Y.utils.smaller = smaller;

  function inDeletionRange (del, ins) {
    return del.target[0] === ins[0] && del.target[1] <= ins[1] && ins[1] < del.target[1] + (del.length || 1)
  }
  Y.utils.inDeletionRange = inDeletionRange;

  function compareIds (id1, id2) {
    if (id1 == null || id2 == null) {
      return id1 === id2
    } else {
      return id1[0] === id2[0] && id1[1] === id2[1]
    }
  }
  Y.utils.compareIds = compareIds;

  function matchesId (op, id) {
    if (id == null || op == null) {
      return id === op
    } else {
      if (id[0] === op.id[0]) {
        if (op.content == null) {
          return id[1] === op.id[1]
        } else {
          return id[1] >= op.id[1] && id[1] < op.id[1] + op.content.length
        }
      }
    }
    return false
  }
  Y.utils.matchesId = matchesId;

  function getLastId (op) {
    if (op.content == null || op.content.length === 1) {
      return op.id
    } else {
      return [op.id[0], op.id[1] + op.content.length - 1]
    }
  }
  Y.utils.getLastId = getLastId;

  function createEmptyOpsArray (n) {
    var a = new Array(n);
    for (var i = 0; i < a.length; i++) {
      a[i] = {
        id: [null, null]
      };
    }
    return a
  }

  function createSmallLookupBuffer (Store) {
    /*
      This buffer implements a very small buffer that temporarily stores operations
      after they are read / before they are written.
      The buffer basically implements FIFO. Often requested lookups will be re-queued every time they are looked up / written.

      It can speed up lookups on Operation Stores and State Stores. But it does not require notable use of memory or processing power.

      Good for os and ss, bot not for ds (because it often uses methods that require a flush)

      I tried to optimize this for performance, therefore no highlevel operations.
    */
    class SmallLookupBuffer extends Store {
      constructor (arg1, arg2) {
        // super(...arguments) -- do this when this is supported by stable nodejs
        super(arg1, arg2);
        this.writeBuffer = createEmptyOpsArray(5);
        this.readBuffer = createEmptyOpsArray(10);
      }
      * find (id, noSuperCall) {
        var i, r;
        for (i = this.readBuffer.length - 1; i >= 0; i--) {
          r = this.readBuffer[i];
          // we don't have to use compareids, because id is always defined!
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            // found r
            // move r to the end of readBuffer
            for (; i < this.readBuffer.length - 1; i++) {
              this.readBuffer[i] = this.readBuffer[i + 1];
            }
            this.readBuffer[this.readBuffer.length - 1] = r;
            return r
          }
        }
        var o;
        for (i = this.writeBuffer.length - 1; i >= 0; i--) {
          r = this.writeBuffer[i];
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            o = r;
            break
          }
        }
        if (i < 0 && noSuperCall === undefined) {
          // did not reach break in last loop
          // read id and put it to the end of readBuffer
          o = yield * super.find(id);
        }
        if (o != null) {
          for (i = 0; i < this.readBuffer.length - 1; i++) {
            this.readBuffer[i] = this.readBuffer[i + 1];
          }
          this.readBuffer[this.readBuffer.length - 1] = o;
        }
        return o
      }
      * put (o) {
        var id = o.id;
        var i, r; // helper variables
        for (i = this.writeBuffer.length - 1; i >= 0; i--) {
          r = this.writeBuffer[i];
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            // is already in buffer
            // forget r, and move o to the end of writeBuffer
            for (; i < this.writeBuffer.length - 1; i++) {
              this.writeBuffer[i] = this.writeBuffer[i + 1];
            }
            this.writeBuffer[this.writeBuffer.length - 1] = o;
            break
          }
        }
        if (i < 0) {
          // did not reach break in last loop
          // write writeBuffer[0]
          var write = this.writeBuffer[0];
          if (write.id[0] !== null) {
            yield * super.put(write);
          }
          // put o to the end of writeBuffer
          for (i = 0; i < this.writeBuffer.length - 1; i++) {
            this.writeBuffer[i] = this.writeBuffer[i + 1];
          }
          this.writeBuffer[this.writeBuffer.length - 1] = o;
        }
        // check readBuffer for every occurence of o.id, overwrite if found
        // whether found or not, we'll append o to the readbuffer
        for (i = 0; i < this.readBuffer.length - 1; i++) {
          r = this.readBuffer[i + 1];
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            this.readBuffer[i] = o;
          } else {
            this.readBuffer[i] = r;
          }
        }
        this.readBuffer[this.readBuffer.length - 1] = o;
      }
      * delete (id) {
        var i, r;
        for (i = 0; i < this.readBuffer.length; i++) {
          r = this.readBuffer[i];
          if (r.id[1] === id[1] && r.id[0] === id[0]) {
            this.readBuffer[i] = {
              id: [null, null]
            };
          }
        }
        yield * this.flush();
        yield * super.delete(id);
      }
      * findWithLowerBound (id) {
        var o = yield * this.find(id, true);
        if (o != null) {
          return o
        } else {
          yield * this.flush();
          return yield * super.findWithLowerBound.apply(this, arguments)
        }
      }
      * findWithUpperBound (id) {
        var o = yield * this.find(id, true);
        if (o != null) {
          return o
        } else {
          yield * this.flush();
          return yield * super.findWithUpperBound.apply(this, arguments)
        }
      }
      * findNext () {
        yield * this.flush();
        return yield * super.findNext.apply(this, arguments)
      }
      * findPrev () {
        yield * this.flush();
        return yield * super.findPrev.apply(this, arguments)
      }
      * iterate () {
        yield * this.flush();
        yield * super.iterate.apply(this, arguments);
      }
      * flush () {
        for (var i = 0; i < this.writeBuffer.length; i++) {
          var write = this.writeBuffer[i];
          if (write.id[0] !== null) {
            yield * super.put(write);
            this.writeBuffer[i] = {
              id: [null, null]
            };
          }
        }
      }
    }
    return SmallLookupBuffer
  }
  Y.utils.createSmallLookupBuffer = createSmallLookupBuffer;

  function generateUserId () {
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
  Y.utils.generateUserId = generateUserId;
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

var index = function(val, options) {
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
exports.humanize = index;

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
    var ms = curr - (prevTime || curr);
    self.diff = ms;
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
    var index$$1 = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index$$1++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index$$1];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index$$1, 1);
        index$$1--;
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

extendConnector(Y);
extendDatabase(Y);
extendTransaction(Y);
extendStruct(Y);
Utils(Y);

Y.debug = browser;
browser.formatters.Y = formatYjsMessage;
browser.formatters.y = formatYjsMessageType;

var requiringModules = {};

Y.requiringModules = requiringModules;

Y.extend = function (name, value) {
  if (arguments.length === 2 && typeof name === 'string') {
    if (value instanceof Y.utils.CustomTypeDefinition) {
      Y[name] = value.parseArguments;
    } else {
      Y[name] = value;
    }
    if (requiringModules[name] != null) {
      requiringModules[name].resolve();
      delete requiringModules[name];
    }
  } else {
    for (var i = 0; i < arguments.length; i++) {
      var f = arguments[i];
      if (typeof f === 'function') {
        f(Y);
      } else {
        throw new Error('Expected function!')
      }
    }
  }
};

Y.requestModules = requestModules;
function requestModules (modules) {
  var sourceDir;
  if (Y.sourceDir === null) {
    sourceDir = null;
  } else {
    sourceDir = Y.sourceDir || '/bower_components';
  }
  // determine if this module was compiled for es5 or es6 (y.js vs. y.es6)
  // if Insert.execute is a Function, then it isnt a generator..
  // then load the es5(.js) files..
  var extention = typeof regeneratorRuntime !== 'undefined' ? '.js' : '.es6';
  var promises = [];
  for (var i = 0; i < modules.length; i++) {
    var module = modules[i].split('(')[0];
    var modulename = 'y-' + module.toLowerCase();
    if (Y[module] == null) {
      if (requiringModules[module] == null) {
        // module does not exist
        if (typeof window !== 'undefined' && window.Y !== 'undefined') {
          if (sourceDir != null) {
            var imported = document.createElement('script');
            imported.src = sourceDir + '/' + modulename + '/' + modulename + extention;
            document.head.appendChild(imported);
          }
          let requireModule = {};
          requiringModules[module] = requireModule;
          requireModule.promise = new Promise(function (resolve) {
            requireModule.resolve = resolve;
          });
          promises.push(requireModule.promise);
        } else {
          console.info('YJS: Please do not depend on automatic requiring of modules anymore! Extend modules as follows `require(\'y-modulename\')(Y)`');
          require(modulename)(Y);
        }
      } else {
        promises.push(requiringModules[modules[i]].promise);
      }
    }
  }
  return Promise.all(promises)
}

/* ::
type MemoryOptions = {
  name: 'memory'
}
type IndexedDBOptions = {
  name: 'indexeddb',
  namespace: string
}
type DbOptions = MemoryOptions | IndexedDBOptions

type WebRTCOptions = {
  name: 'webrtc',
  room: string
}
type WebsocketsClientOptions = {
  name: 'websockets-client',
  room: string
}
type ConnectionOptions = WebRTCOptions | WebsocketsClientOptions

type YOptions = {
  connector: ConnectionOptions,
  db: DbOptions,
  types: Array<TypeName>,
  sourceDir: string,
  share: {[key: string]: TypeName}
}
*/

function Y (opts/* :YOptions */) /* :Promise<YConfig> */ {
  if (opts.hasOwnProperty('sourceDir')) {
    Y.sourceDir = opts.sourceDir;
  }
  opts.types = opts.types != null ? opts.types : [];
  var modules = [opts.db.name, opts.connector.name].concat(opts.types);
  for (var name in opts.share) {
    modules.push(opts.share[name]);
  }
  return new Promise(function (resolve, reject) {
    if (opts == null) reject(new Error('An options object is expected!'));
    else if (opts.connector == null) reject(new Error('You must specify a connector! (missing connector property)'));
    else if (opts.connector.name == null) reject(new Error('You must specify connector name! (missing connector.name property)'));
    else if (opts.db == null) reject(new Error('You must specify a database! (missing db property)'));
    else if (opts.connector.name == null) reject(new Error('You must specify db name! (missing db.name property)'));
    else {
      opts = Y.utils.copyObject(opts);
      opts.connector = Y.utils.copyObject(opts.connector);
      opts.db = Y.utils.copyObject(opts.db);
      opts.share = Y.utils.copyObject(opts.share);
      Y.requestModules(modules).then(function () {
        var yconfig = new YConfig(opts);
        yconfig.db.whenUserIdSet(function () {
          yconfig.init(function () {
            resolve(yconfig);
          });
        });
      }).catch(reject);
    }
  })
}

class YConfig extends Y.utils.NamedEventHandler {
  /* ::
  db: Y.AbstractDatabase;
  connector: Y.AbstractConnector;
  share: {[key: string]: any};
  options: Object;
  */
  constructor (opts, callback) {
    super();
    this.options = opts;
    this.db = new Y[opts.db.name](this, opts.db);
    this.connector = new Y[opts.connector.name](this, opts.connector);
    this.connected = true;
  }
  init (callback) {
    var opts = this.options;
    var share = {};
    this.share = share;
    this.db.requestTransaction(function * requestTransaction () {
      // create shared object
      for (var propertyname in opts.share) {
        var typeConstructor = opts.share[propertyname].split('(');
        var typeName = typeConstructor.splice(0, 1);
        var type = Y[typeName];
        var typedef = type.typeDefinition;
        var id = [0xFFFFFF, typedef.struct + '_' + typeName + '_' + propertyname + '_' + typeConstructor];
        var args = [];
        if (typeConstructor.length === 1) {
          try {
            args = JSON.parse('[' + typeConstructor[0].split(')')[0] + ']');
          } catch (e) {
            throw new Error('Was not able to parse type definition! (share.' + propertyname + ')')
          }
          if (type.typeDefinition.parseArguments == null) {
            throw new Error(typeName + ' does not expect arguments!')
          } else {
            args = typedef.parseArguments(args[0])[1];
          }
        }
        share[propertyname] = yield * this.store.initType.call(this, id, args);
      }
      this.store.whenTransactionsFinished()
        .then(callback);
    });
  }
  isConnected () {
    return this.connector.isSynced
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
    var self = this;
    return this.close().then(function () {
      if (self.db.deleteDB != null) {
        return self.db.deleteDB()
      } else {
        return Promise.resolve()
      }
    }).then(() => {
      // remove existing event listener
      super.destroy();
    })
  }
  close () {
    var self = this;
    this.share = null;
    if (this.connector.destroy != null) {
      this.connector.destroy();
    } else {
      this.connector.disconnect();
    }
    return this.db.whenTransactionsFinished().then(function () {
      self.db.destroyTypes();
      // make sure to wait for all transactions before destroying the db
      self.db.requestTransaction(function * () {
        yield * self.db.destroy();
      });
      return self.db.whenTransactionsFinished()
    })
  }
}

return Y;

})));
//# sourceMappingURL=y.node.js.map
