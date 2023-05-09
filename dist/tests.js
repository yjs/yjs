(function () {
  'use strict';

  /**
   * Utility module to work with key-value stores.
   *
   * @module map
   */

  /**
   * Creates a new Map instance.
   *
   * @function
   * @return {Map<any, any>}
   *
   * @function
   */
  const create$6 = () => new Map();

  /**
   * Copy a Map object into a fresh Map object.
   *
   * @function
   * @template X,Y
   * @param {Map<X,Y>} m
   * @return {Map<X,Y>}
   */
  const copy = m => {
    const r = create$6();
    m.forEach((v, k) => { r.set(k, v); });
    return r
  };

  /**
   * Get map property. Create T if property is undefined and set T on map.
   *
   * ```js
   * const listeners = map.setIfUndefined(events, 'eventName', set.create)
   * listeners.add(listener)
   * ```
   *
   * @function
   * @template V,K
   * @template {Map<K,V>} MAP
   * @param {MAP} map
   * @param {K} key
   * @param {function():V} createT
   * @return {V}
   */
  const setIfUndefined = (map, key, createT) => {
    let set = map.get(key);
    if (set === undefined) {
      map.set(key, set = createT());
    }
    return set
  };

  /**
   * Creates an Array and populates it with the content of all key-value pairs using the `f(value, key)` function.
   *
   * @function
   * @template K
   * @template V
   * @template R
   * @param {Map<K,V>} m
   * @param {function(V,K):R} f
   * @return {Array<R>}
   */
  const map$2 = (m, f) => {
    const res = [];
    for (const [key, value] of m) {
      res.push(f(value, key));
    }
    return res
  };

  /**
   * Tests whether any key-value pairs pass the test implemented by `f(value, key)`.
   *
   * @todo should rename to some - similarly to Array.some
   *
   * @function
   * @template K
   * @template V
   * @param {Map<K,V>} m
   * @param {function(V,K):boolean} f
   * @return {boolean}
   */
  const any = (m, f) => {
    for (const [key, value] of m) {
      if (f(value, key)) {
        return true
      }
    }
    return false
  };

  /**
   * Utility module to work with sets.
   *
   * @module set
   */

  const create$5 = () => new Set();

  /**
   * Utility module to work with Arrays.
   *
   * @module array
   */

  /**
   * Return the last element of an array. The element must exist
   *
   * @template L
   * @param {ArrayLike<L>} arr
   * @return {L}
   */
  const last = arr => arr[arr.length - 1];

  /**
   * Append elements from src to dest
   *
   * @template M
   * @param {Array<M>} dest
   * @param {Array<M>} src
   */
  const appendTo = (dest, src) => {
    for (let i = 0; i < src.length; i++) {
      dest.push(src[i]);
    }
  };

  /**
   * Transforms something array-like to an actual Array.
   *
   * @function
   * @template T
   * @param {ArrayLike<T>|Iterable<T>} arraylike
   * @return {T}
   */
  const from = Array.from;

  /**
   * True iff condition holds on some element in the Array.
   *
   * @function
   * @template S
   * @template {ArrayLike<S>} ARR
   * @param {ARR} arr
   * @param {function(S, number, ARR):boolean} f
   * @return {boolean}
   */
  const some = (arr, f) => {
    for (let i = 0; i < arr.length; i++) {
      if (f(arr[i], i, arr)) {
        return true
      }
    }
    return false
  };

  /**
   * @template T
   * @param {number} len
   * @param {function(number, Array<T>):T} f
   * @return {Array<T>}
   */
  const unfold = (len, f) => {
    const array = new Array(len);
    for (let i = 0; i < len; i++) {
      array[i] = f(i, array);
    }
    return array
  };

  const isArray = Array.isArray;

  /**
   * Utility module to work with strings.
   *
   * @module string
   */

  const fromCharCode = String.fromCharCode;
  const fromCodePoint = String.fromCodePoint;

  /**
   * @param {string} s
   * @return {string}
   */
  const toLowerCase = s => s.toLowerCase();

  const trimLeftRegex = /^\s*/g;

  /**
   * @param {string} s
   * @return {string}
   */
  const trimLeft = s => s.replace(trimLeftRegex, '');

  const fromCamelCaseRegex = /([A-Z])/g;

  /**
   * @param {string} s
   * @param {string} separator
   * @return {string}
   */
  const fromCamelCase = (s, separator) => trimLeft(s.replace(fromCamelCaseRegex, match => `${separator}${toLowerCase(match)}`));

  /**
   * @param {string} str
   * @return {Uint8Array}
   */
  const _encodeUtf8Polyfill = str => {
    const encodedString = unescape(encodeURIComponent(str));
    const len = encodedString.length;
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buf[i] = /** @type {number} */ (encodedString.codePointAt(i));
    }
    return buf
  };

  /* c8 ignore next */
  const utf8TextEncoder = /** @type {TextEncoder} */ (typeof TextEncoder !== 'undefined' ? new TextEncoder() : null);

  /**
   * @param {string} str
   * @return {Uint8Array}
   */
  const _encodeUtf8Native = str => utf8TextEncoder.encode(str);

  /**
   * @param {string} str
   * @return {Uint8Array}
   */
  /* c8 ignore next */
  const encodeUtf8 = utf8TextEncoder ? _encodeUtf8Native : _encodeUtf8Polyfill;

  /* c8 ignore next */
  let utf8TextDecoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

  /* c8 ignore start */
  if (utf8TextDecoder && utf8TextDecoder.decode(new Uint8Array()).length === 1) {
    // Safari doesn't handle BOM correctly.
    // This fixes a bug in Safari 13.0.5 where it produces a BOM the first time it is called.
    // utf8TextDecoder.decode(new Uint8Array()).length === 1 on the first call and
    // utf8TextDecoder.decode(new Uint8Array()).length === 1 on the second call
    // Another issue is that from then on no BOM chars are recognized anymore
    /* c8 ignore next */
    utf8TextDecoder = null;
  }

  /**
   * @param {string} source
   * @param {number} n
   */
  const repeat = (source, n) => unfold(n, () => source).join('');

  /**
   * Often used conditions.
   *
   * @module conditions
   */

  /**
   * @template T
   * @param {T|null|undefined} v
   * @return {T|null}
   */
  /* c8 ignore next */
  const undefinedToNull = v => v === undefined ? null : v;

  /* eslint-env browser */

  /**
   * Isomorphic variable storage.
   *
   * Uses LocalStorage in the browser and falls back to in-memory storage.
   *
   * @module storage
   */

  /* c8 ignore start */
  class VarStoragePolyfill {
    constructor () {
      this.map = new Map();
    }

    /**
     * @param {string} key
     * @param {any} newValue
     */
    setItem (key, newValue) {
      this.map.set(key, newValue);
    }

    /**
     * @param {string} key
     */
    getItem (key) {
      return this.map.get(key)
    }
  }
  /* c8 ignore stop */

  /**
   * @type {any}
   */
  let _localStorage = new VarStoragePolyfill();
  let usePolyfill = true;

  /* c8 ignore start */
  try {
    // if the same-origin rule is violated, accessing localStorage might thrown an error
    if (typeof localStorage !== 'undefined') {
      _localStorage = localStorage;
      usePolyfill = false;
    }
  } catch (e) { }
  /* c8 ignore stop */

  /**
   * This is basically localStorage in browser, or a polyfill in nodejs
   */
  /* c8 ignore next */
  const varStorage = _localStorage;

  /**
   * Utility functions for working with EcmaScript objects.
   *
   * @module object
   */

  /**
   * Object.assign
   */
  const assign = Object.assign;

  /**
   * @param {Object<string,any>} obj
   */
  const keys = Object.keys;

  /**
   * @template V
   * @param {{[k:string]:V}} obj
   * @param {function(V,string):any} f
   */
  const forEach$1 = (obj, f) => {
    for (const key in obj) {
      f(obj[key], key);
    }
  };

  /**
   * @todo implement mapToArray & map
   *
   * @template R
   * @param {Object<string,any>} obj
   * @param {function(any,string):R} f
   * @return {Array<R>}
   */
  const map$1 = (obj, f) => {
    const results = [];
    for (const key in obj) {
      results.push(f(obj[key], key));
    }
    return results
  };

  /**
   * @param {Object<string,any>} obj
   * @return {number}
   */
  const length$1 = obj => keys(obj).length;

  /**
   * @param {Object|undefined} obj
   */
  const isEmpty = obj => {
    for (const _k in obj) {
      return false
    }
    return true
  };

  /**
   * @param {Object<string,any>} obj
   * @param {function(any,string):boolean} f
   * @return {boolean}
   */
  const every = (obj, f) => {
    for (const key in obj) {
      if (!f(obj[key], key)) {
        return false
      }
    }
    return true
  };

  /**
   * Calls `Object.prototype.hasOwnProperty`.
   *
   * @param {any} obj
   * @param {string|symbol} key
   * @return {boolean}
   */
  const hasProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  /**
   * @param {Object<string,any>} a
   * @param {Object<string,any>} b
   * @return {boolean}
   */
  const equalFlat = (a, b) => a === b || (length$1(a) === length$1(b) && every(a, (val, key) => (val !== undefined || hasProperty(b, key)) && b[key] === val));

  /**
   * Common functions and function call helpers.
   *
   * @module function
   */

  /**
   * Calls all functions in `fs` with args. Only throws after all functions were called.
   *
   * @param {Array<function>} fs
   * @param {Array<any>} args
   */
  const callAll = (fs, args, i = 0) => {
    try {
      for (; i < fs.length; i++) {
        fs[i](...args);
      }
    } finally {
      if (i < fs.length) {
        callAll(fs, args, i + 1);
      }
    }
  };

  /**
   * @template A
   *
   * @param {A} a
   * @return {A}
   */
  const id$1 = a => a;

  /**
   * @template V
   * @template {V} OPTS
   *
   * @param {V} value
   * @param {Array<OPTS>} options
   */
  // @ts-ignore
  const isOneOf = (value, options) => options.includes(value);
  /* c8 ignore stop */

  /**
   * Isomorphic module to work access the environment (query params, env variables).
   *
   * @module map
   */

  /* c8 ignore next */
  // @ts-ignore
  const isNode = typeof process !== 'undefined' && process.release &&
    /node|io\.js/.test(process.release.name);
  /* c8 ignore next */
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && !isNode;

  /**
   * @type {Map<string,string>}
   */
  let params;

  /* c8 ignore start */
  const computeParams = () => {
    if (params === undefined) {
      if (isNode) {
        params = create$6();
        const pargs = process.argv;
        let currParamName = null;
        for (let i = 0; i < pargs.length; i++) {
          const parg = pargs[i];
          if (parg[0] === '-') {
            if (currParamName !== null) {
              params.set(currParamName, '');
            }
            currParamName = parg;
          } else {
            if (currParamName !== null) {
              params.set(currParamName, parg);
              currParamName = null;
            }
          }
        }
        if (currParamName !== null) {
          params.set(currParamName, '');
        }
        // in ReactNative for example this would not be true (unless connected to the Remote Debugger)
      } else if (typeof location === 'object') {
        params = create$6(); // eslint-disable-next-line no-undef
        (location.search || '?').slice(1).split('&').forEach((kv) => {
          if (kv.length !== 0) {
            const [key, value] = kv.split('=');
            params.set(`--${fromCamelCase(key, '-')}`, value);
            params.set(`-${fromCamelCase(key, '-')}`, value);
          }
        });
      } else {
        params = create$6();
      }
    }
    return params
  };
  /* c8 ignore stop */

  /**
   * @param {string} name
   * @return {boolean}
   */
  /* c8 ignore next */
  const hasParam = (name) => computeParams().has(name);

  /**
   * @param {string} name
   * @param {string} defaultVal
   * @return {string}
   */
  /* c8 ignore next 2 */
  const getParam = (name, defaultVal) =>
    computeParams().get(name) || defaultVal;

  /**
   * @param {string} name
   * @return {string|null}
   */
  /* c8 ignore next 4 */
  const getVariable = (name) =>
    isNode
      ? undefinedToNull(process.env[name.toUpperCase()])
      : undefinedToNull(varStorage.getItem(name));

  /**
   * @param {string} name
   * @return {boolean}
   */
  /* c8 ignore next 2 */
  const hasConf = (name) =>
    hasParam('--' + name) || getVariable(name) !== null;

  /* c8 ignore next */
  const production = hasConf('production');

  /* c8 ignore next 2 */
  const forceColor = isNode &&
    isOneOf(process.env.FORCE_COLOR, ['true', '1', '2']);

  /* c8 ignore start */
  const supportsColor = !hasParam('no-colors') &&
    (!isNode || process.stdout.isTTY || forceColor) && (
    !isNode || hasParam('color') || forceColor ||
      getVariable('COLORTERM') !== null ||
      (getVariable('TERM') || '').includes('color')
  );
  /* c8 ignore stop */

  /**
   * Working with value pairs.
   *
   * @module pair
   */

  /**
   * @template L,R
   */
  class Pair {
    /**
     * @param {L} left
     * @param {R} right
     */
    constructor (left, right) {
      this.left = left;
      this.right = right;
    }
  }

  /**
   * @template L,R
   * @param {L} left
   * @param {R} right
   * @return {Pair<L,R>}
   */
  const create$4 = (left, right) => new Pair(left, right);

  /**
   * @template L,R
   * @param {Array<Pair<L,R>>} arr
   * @param {function(L, R):any} f
   */
  const forEach = (arr, f) => arr.forEach(p => f(p.left, p.right));

  /* eslint-env browser */

  /* c8 ignore start */
  /**
   * @type {Document}
   */
  const doc$1 = /** @type {Document} */ (typeof document !== 'undefined' ? document : {});

  /**
   * @param {string} name
   * @return {HTMLElement}
   */
  const createElement = name => doc$1.createElement(name);

  /**
   * @return {DocumentFragment}
   */
  const createDocumentFragment = () => doc$1.createDocumentFragment();

  /**
   * @param {string} text
   * @return {Text}
   */
  const createTextNode = text => doc$1.createTextNode(text);

  /** @type {DOMParser} */ (typeof DOMParser !== 'undefined' ? new DOMParser() : null);

  /**
   * @param {Element} el
   * @param {Array<pair.Pair<string,string|boolean>>} attrs Array of key-value pairs
   * @return {Element}
   */
  const setAttributes = (el, attrs) => {
    forEach(attrs, (key, value) => {
      if (value === false) {
        el.removeAttribute(key);
      } else if (value === true) {
        el.setAttribute(key, '');
      } else {
        // @ts-ignore
        el.setAttribute(key, value);
      }
    });
    return el
  };

  /**
   * @param {Array<Node>|HTMLCollection} children
   * @return {DocumentFragment}
   */
  const fragment = children => {
    const fragment = createDocumentFragment();
    for (let i = 0; i < children.length; i++) {
      appendChild(fragment, children[i]);
    }
    return fragment
  };

  /**
   * @param {Element} parent
   * @param {Array<Node>} nodes
   * @return {Element}
   */
  const append = (parent, nodes) => {
    appendChild(parent, fragment(nodes));
    return parent
  };

  /**
   * @param {EventTarget} el
   * @param {string} name
   * @param {EventListener} f
   */
  const addEventListener = (el, name, f) => el.addEventListener(name, f);

  /**
   * @param {string} name
   * @param {Array<pair.Pair<string,string>|pair.Pair<string,boolean>>} attrs Array of key-value pairs
   * @param {Array<Node>} children
   * @return {Element}
   */
  const element = (name, attrs = [], children = []) =>
    append(setAttributes(createElement(name), attrs), children);

  /**
   * @param {string} t
   * @return {Text}
   */
  const text$1 = createTextNode;

  /**
   * @param {Map<string,string>} m
   * @return {string}
   */
  const mapToStyleString = m => map$2(m, (value, key) => `${key}:${value};`).join('');

  /**
   * @param {Node} parent
   * @param {Node} child
   * @return {Node}
   */
  const appendChild = (parent, child) => parent.appendChild(child);

  doc$1.ELEMENT_NODE;
  doc$1.TEXT_NODE;
  doc$1.CDATA_SECTION_NODE;
  doc$1.COMMENT_NODE;
  doc$1.DOCUMENT_NODE;
  doc$1.DOCUMENT_TYPE_NODE;
  doc$1.DOCUMENT_FRAGMENT_NODE;
  /* c8 ignore stop */

  /**
   * JSON utility functions.
   *
   * @module json
   */

  /**
   * Transform JavaScript object to JSON.
   *
   * @param {any} object
   * @return {string}
   */
  const stringify = JSON.stringify;

  /* global requestIdleCallback, requestAnimationFrame, cancelIdleCallback, cancelAnimationFrame */

  /**
   * Utility module to work with EcmaScript's event loop.
   *
   * @module eventloop
   */

  /**
   * @type {Array<function>}
   */
  let queue = [];

  const _runQueue = () => {
    for (let i = 0; i < queue.length; i++) {
      queue[i]();
    }
    queue = [];
  };

  /**
   * @param {function():void} f
   */
  const enqueue = f => {
    queue.push(f);
    if (queue.length === 1) {
      setTimeout(_runQueue, 0);
    }
  };

  /**
   * Common Math expressions.
   *
   * @module math
   */

  const floor = Math.floor;
  const ceil = Math.ceil;
  const abs = Math.abs;
  const round = Math.round;
  const log10 = Math.log10;

  /**
   * @function
   * @param {number} a
   * @param {number} b
   * @return {number} The sum of a and b
   */
  const add = (a, b) => a + b;

  /**
   * @function
   * @param {number} a
   * @param {number} b
   * @return {number} The smaller element of a and b
   */
  const min = (a, b) => a < b ? a : b;

  /**
   * @function
   * @param {number} a
   * @param {number} b
   * @return {number} The bigger element of a and b
   */
  const max = (a, b) => a > b ? a : b;
  /**
   * Base 10 exponential function. Returns the value of 10 raised to the power of pow.
   *
   * @param {number} exp
   * @return {number}
   */
  const exp10 = exp => Math.pow(10, exp);

  /**
   * @param {number} n
   * @return {boolean} Wether n is negative. This function also differentiates between -0 and +0
   */
  const isNegativeZero = n => n !== 0 ? n < 0 : 1 / n < 0;

  /**
   * Utility module to work with EcmaScript Symbols.
   *
   * @module symbol
   */

  /**
   * Return fresh symbol.
   *
   * @return {Symbol}
   */
  const create$3 = Symbol;

  /**
   * Utility module to convert metric values.
   *
   * @module metric
   */

  const prefixUp = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  const prefixDown = ['', 'm', 'μ', 'n', 'p', 'f', 'a', 'z', 'y'];

  /**
   * Calculate the metric prefix for a number. Assumes E.g. `prefix(1000) = { n: 1, prefix: 'k' }`
   *
   * @param {number} n
   * @param {number} [baseMultiplier] Multiplier of the base (10^(3*baseMultiplier)). E.g. `convert(time, -3)` if time is already in milli seconds
   * @return {{n:number,prefix:string}}
   */
  const prefix = (n, baseMultiplier = 0) => {
    const nPow = n === 0 ? 0 : log10(n);
    let mult = 0;
    while (nPow < mult * 3 && baseMultiplier > -8) {
      baseMultiplier--;
      mult--;
    }
    while (nPow >= 3 + mult * 3 && baseMultiplier < 8) {
      baseMultiplier++;
      mult++;
    }
    const prefix = baseMultiplier < 0 ? prefixDown[-baseMultiplier] : prefixUp[baseMultiplier];
    return {
      n: round((mult > 0 ? n / exp10(mult * 3) : n * exp10(mult * -3)) * 1e12) / 1e12,
      prefix
    }
  };

  /**
   * Utility module to work with time.
   *
   * @module time
   */

  /**
   * Return current unix time.
   *
   * @return {number}
   */
  const getUnixTime = Date.now;

  /**
   * Transform time (in ms) to a human readable format. E.g. 1100 => 1.1s. 60s => 1min. .001 => 10μs.
   *
   * @param {number} d duration in milliseconds
   * @return {string} humanized approximation of time
   */
  const humanizeDuration = d => {
    if (d < 60000) {
      const p = prefix(d, -1);
      return round(p.n * 100) / 100 + p.prefix + 's'
    }
    d = floor(d / 1000);
    const seconds = d % 60;
    const minutes = floor(d / 60) % 60;
    const hours = floor(d / 3600) % 24;
    const days = floor(d / 86400);
    if (days > 0) {
      return days + 'd' + ((hours > 0 || minutes > 30) ? ' ' + (minutes > 30 ? hours + 1 : hours) + 'h' : '')
    }
    if (hours > 0) {
      /* c8 ignore next */
      return hours + 'h' + ((minutes > 0 || seconds > 30) ? ' ' + (seconds > 30 ? minutes + 1 : minutes) + 'min' : '')
    }
    return minutes + 'min' + (seconds > 0 ? ' ' + seconds + 's' : '')
  };

  const BOLD = create$3();
  const UNBOLD = create$3();
  const BLUE = create$3();
  const GREY = create$3();
  const GREEN = create$3();
  const RED = create$3();
  const PURPLE = create$3();
  const ORANGE = create$3();
  const UNCOLOR = create$3();

  /* c8 ignore start */
  /**
   * @param {Array<string|Symbol|Object|number>} args
   * @return {Array<string|object|number>}
   */
  const computeNoColorLoggingArgs = args => {
    const logArgs = [];
    // try with formatting until we find something unsupported
    let i = 0;
    for (; i < args.length; i++) {
      const arg = args[i];
      if (arg.constructor === String || arg.constructor === Number) ; else if (arg.constructor === Object) {
        logArgs.push(JSON.stringify(arg));
      }
    }
    return logArgs
  };
  /* c8 ignore stop */

  /**
   * Isomorphic logging module with support for colors!
   *
   * @module logging
   */

  /**
   * @type {Object<Symbol,pair.Pair<string,string>>}
   */
  const _browserStyleMap = {
    [BOLD]: create$4('font-weight', 'bold'),
    [UNBOLD]: create$4('font-weight', 'normal'),
    [BLUE]: create$4('color', 'blue'),
    [GREEN]: create$4('color', 'green'),
    [GREY]: create$4('color', 'grey'),
    [RED]: create$4('color', 'red'),
    [PURPLE]: create$4('color', 'purple'),
    [ORANGE]: create$4('color', 'orange'), // not well supported in chrome when debugging node with inspector - TODO: deprecate
    [UNCOLOR]: create$4('color', 'black')
  };

  /**
   * @param {Array<string|Symbol|Object|number>} args
   * @return {Array<string|object|number>}
   */
  /* c8 ignore start */
  const computeBrowserLoggingArgs = (args) => {
    const strBuilder = [];
    const styles = [];
    const currentStyle = create$6();
    /**
     * @type {Array<string|Object|number>}
     */
    let logArgs = [];
    // try with formatting until we find something unsupported
    let i = 0;
    for (; i < args.length; i++) {
      const arg = args[i];
      // @ts-ignore
      const style = _browserStyleMap[arg];
      if (style !== undefined) {
        currentStyle.set(style.left, style.right);
      } else {
        if (arg.constructor === String || arg.constructor === Number) {
          const style = mapToStyleString(currentStyle);
          if (i > 0 || style.length > 0) {
            strBuilder.push('%c' + arg);
            styles.push(style);
          } else {
            strBuilder.push(arg);
          }
        } else {
          break
        }
      }
    }
    if (i > 0) {
      // create logArgs with what we have so far
      logArgs = styles;
      logArgs.unshift(strBuilder.join(''));
    }
    // append the rest
    for (; i < args.length; i++) {
      const arg = args[i];
      if (!(arg instanceof Symbol)) {
        logArgs.push(arg);
      }
    }
    return logArgs
  };
  /* c8 ignore stop */

  /* c8 ignore start */
  const computeLoggingArgs = supportsColor
    ? computeBrowserLoggingArgs
    : computeNoColorLoggingArgs;
  /* c8 ignore stop */

  /**
   * @param {Array<string|Symbol|Object|number>} args
   */
  const print = (...args) => {
    console.log(...computeLoggingArgs(args));
    /* c8 ignore next */
    vconsoles.forEach((vc) => vc.print(args));
  };
  /* c8 ignore stop */

  /**
   * @param {Error} err
   */
  /* c8 ignore start */
  const printError = (err) => {
    console.error(err);
    vconsoles.forEach((vc) => vc.printError(err));
  };
  /* c8 ignore stop */

  /**
   * @param {string} url image location
   * @param {number} height height of the image in pixel
   */
  /* c8 ignore start */
  const printImg = (url, height) => {
    if (isBrowser) {
      console.log(
        '%c                      ',
        `font-size: ${height}px; background-size: contain; background-repeat: no-repeat; background-image: url(${url})`
      );
      // console.log('%c                ', `font-size: ${height}x; background: url(${url}) no-repeat;`)
    }
    vconsoles.forEach((vc) => vc.printImg(url, height));
  };
  /* c8 ignore stop */

  /**
   * @param {string} base64
   * @param {number} height
   */
  /* c8 ignore next 2 */
  const printImgBase64 = (base64, height) =>
    printImg(`data:image/gif;base64,${base64}`, height);

  /**
   * @param {Array<string|Symbol|Object|number>} args
   */
  const group = (...args) => {
    console.group(...computeLoggingArgs(args));
    /* c8 ignore next */
    vconsoles.forEach((vc) => vc.group(args));
  };

  /**
   * @param {Array<string|Symbol|Object|number>} args
   */
  const groupCollapsed = (...args) => {
    console.groupCollapsed(...computeLoggingArgs(args));
    /* c8 ignore next */
    vconsoles.forEach((vc) => vc.groupCollapsed(args));
  };

  const groupEnd = () => {
    console.groupEnd();
    /* c8 ignore next */
    vconsoles.forEach((vc) => vc.groupEnd());
  };

  const vconsoles = create$5();

  /**
   * @param {Array<string|Symbol|Object|number>} args
   * @return {Array<Element>}
   */
  /* c8 ignore start */
  const _computeLineSpans = (args) => {
    const spans = [];
    const currentStyle = new Map();
    // try with formatting until we find something unsupported
    let i = 0;
    for (; i < args.length; i++) {
      const arg = args[i];
      // @ts-ignore
      const style = _browserStyleMap[arg];
      if (style !== undefined) {
        currentStyle.set(style.left, style.right);
      } else {
        if (arg.constructor === String || arg.constructor === Number) {
          // @ts-ignore
          const span = element('span', [
            create$4('style', mapToStyleString(currentStyle))
          ], [text$1(arg.toString())]);
          if (span.innerHTML === '') {
            span.innerHTML = '&nbsp;';
          }
          spans.push(span);
        } else {
          break
        }
      }
    }
    // append the rest
    for (; i < args.length; i++) {
      let content = args[i];
      if (!(content instanceof Symbol)) {
        if (content.constructor !== String && content.constructor !== Number) {
          content = ' ' + stringify(content) + ' ';
        }
        spans.push(
          element('span', [], [text$1(/** @type {string} */ (content))])
        );
      }
    }
    return spans
  };
  /* c8 ignore stop */

  const lineStyle =
    'font-family:monospace;border-bottom:1px solid #e2e2e2;padding:2px;';

  /* c8 ignore start */
  class VConsole {
    /**
     * @param {Element} dom
     */
    constructor (dom) {
      this.dom = dom;
      /**
       * @type {Element}
       */
      this.ccontainer = this.dom;
      this.depth = 0;
      vconsoles.add(this);
    }

    /**
     * @param {Array<string|Symbol|Object|number>} args
     * @param {boolean} collapsed
     */
    group (args, collapsed = false) {
      enqueue(() => {
        const triangleDown = element('span', [
          create$4('hidden', collapsed),
          create$4('style', 'color:grey;font-size:120%;')
        ], [text$1('▼')]);
        const triangleRight = element('span', [
          create$4('hidden', !collapsed),
          create$4('style', 'color:grey;font-size:125%;')
        ], [text$1('▶')]);
        const content = element(
          'div',
          [create$4(
            'style',
            `${lineStyle};padding-left:${this.depth * 10}px`
          )],
          [triangleDown, triangleRight, text$1(' ')].concat(
            _computeLineSpans(args)
          )
        );
        const nextContainer = element('div', [
          create$4('hidden', collapsed)
        ]);
        const nextLine = element('div', [], [content, nextContainer]);
        append(this.ccontainer, [nextLine]);
        this.ccontainer = nextContainer;
        this.depth++;
        // when header is clicked, collapse/uncollapse container
        addEventListener(content, 'click', (_event) => {
          nextContainer.toggleAttribute('hidden');
          triangleDown.toggleAttribute('hidden');
          triangleRight.toggleAttribute('hidden');
        });
      });
    }

    /**
     * @param {Array<string|Symbol|Object|number>} args
     */
    groupCollapsed (args) {
      this.group(args, true);
    }

    groupEnd () {
      enqueue(() => {
        if (this.depth > 0) {
          this.depth--;
          // @ts-ignore
          this.ccontainer = this.ccontainer.parentElement.parentElement;
        }
      });
    }

    /**
     * @param {Array<string|Symbol|Object|number>} args
     */
    print (args) {
      enqueue(() => {
        append(this.ccontainer, [
          element('div', [
            create$4(
              'style',
              `${lineStyle};padding-left:${this.depth * 10}px`
            )
          ], _computeLineSpans(args))
        ]);
      });
    }

    /**
     * @param {Error} err
     */
    printError (err) {
      this.print([RED, BOLD, err.toString()]);
    }

    /**
     * @param {string} url
     * @param {number} height
     */
    printImg (url, height) {
      enqueue(() => {
        append(this.ccontainer, [
          element('img', [
            create$4('src', url),
            create$4('height', `${round(height * 1.5)}px`)
          ])
        ]);
      });
    }

    /**
     * @param {Node} node
     */
    printDom (node) {
      enqueue(() => {
        append(this.ccontainer, [node]);
      });
    }

    destroy () {
      enqueue(() => {
        vconsoles.delete(this);
      });
    }
  }
  /* c8 ignore stop */

  /**
   * @param {Element} dom
   */
  /* c8 ignore next */
  const createVConsole = (dom) => new VConsole(dom);

  /**
   * Efficient diffs.
   *
   * @module diff
   */

  /**
   * A SimpleDiff describes a change on a String.
   *
   * ```js
   * console.log(a) // the old value
   * console.log(b) // the updated value
   * // Apply changes of diff (pseudocode)
   * a.remove(diff.index, diff.remove) // Remove `diff.remove` characters
   * a.insert(diff.index, diff.insert) // Insert `diff.insert`
   * a === b // values match
   * ```
   *
   * @typedef {Object} SimpleDiff
   * @property {Number} index The index where changes were applied
   * @property {Number} remove The number of characters to delete starting
   *                                  at `index`.
   * @property {T} insert The new text to insert at `index` after applying
   *                           `delete`
   *
   * @template T
   */

  const highSurrogateRegex = /[\uD800-\uDBFF]/;
  const lowSurrogateRegex = /[\uDC00-\uDFFF]/;

  /**
   * Create a diff between two strings. This diff implementation is highly
   * efficient, but not very sophisticated.
   *
   * @function
   *
   * @param {string} a The old version of the string
   * @param {string} b The updated version of the string
   * @return {SimpleDiff<string>} The diff description.
   */
  const simpleDiffString = (a, b) => {
    let left = 0; // number of same characters counting from left
    let right = 0; // number of same characters counting from right
    while (left < a.length && left < b.length && a[left] === b[left]) {
      left++;
    }
    // If the last same character is a high surrogate, we need to rollback to the previous character
    if (left > 0 && highSurrogateRegex.test(a[left - 1])) left--;
    while (right + left < a.length && right + left < b.length && a[a.length - right - 1] === b[b.length - right - 1]) {
      right++;
    }
    // If the last same character is a low surrogate, we need to rollback to the previous character
    if (right > 0 && lowSurrogateRegex.test(a[a.length - right])) right--;
    return {
      index: left,
      remove: a.length - left - right,
      insert: b.slice(left, b.length - right)
    }
  };

  /* eslint-env browser */

  /**
   * Binary data constants.
   *
   * @module binary
   */

  /**
   * n-th bit activated.
   *
   * @type {number}
   */
  const BIT1 = 1;
  const BIT2 = 2;
  const BIT3 = 4;
  const BIT4 = 8;
  const BIT6 = 32;
  const BIT7 = 64;
  const BIT8 = 128;
  const BITS5 = 31;
  const BITS6 = 63;
  const BITS7 = 127;
  /**
   * @type {number}
   */
  const BITS31 = 0x7FFFFFFF;
  /**
   * @type {number}
   */
  const BITS32 = 0xFFFFFFFF;

  /* eslint-env browser */
  const getRandomValues = crypto.getRandomValues.bind(crypto);

  const uint32$1 = () => getRandomValues(new Uint32Array(1))[0];

  // @ts-ignore
  const uuidv4Template = [1e7] + -1e3 + -4e3 + -8e3 + -1e11;
  const uuidv4 = () => uuidv4Template.replace(/[018]/g, /** @param {number} c */ c =>
    (c ^ uint32$1() & 15 >> c / 4).toString(16)
  );

  /**
   * @module prng
   */

  /**
   * Xorshift32 is a very simple but elegang PRNG with a period of `2^32-1`.
   */
  class Xorshift32 {
    /**
     * @param {number} seed Unsigned 32 bit number
     */
    constructor (seed) {
      this.seed = seed;
      /**
       * @type {number}
       */
      this._state = seed;
    }

    /**
     * Generate a random signed integer.
     *
     * @return {Number} A 32 bit signed integer.
     */
    next () {
      let x = this._state;
      x ^= x << 13;
      x ^= x >> 17;
      x ^= x << 5;
      this._state = x;
      return (x >>> 0) / (BITS32 + 1)
    }
  }

  /**
   * @module prng
   */

  /**
   * This is a variant of xoroshiro128plus - the fastest full-period generator passing BigCrush without systematic failures.
   *
   * This implementation follows the idea of the original xoroshiro128plus implementation,
   * but is optimized for the JavaScript runtime. I.e.
   * * The operations are performed on 32bit integers (the original implementation works with 64bit values).
   * * The initial 128bit state is computed based on a 32bit seed and Xorshift32.
   * * This implementation returns two 32bit values based on the 64bit value that is computed by xoroshiro128plus.
   *   Caution: The last addition step works slightly different than in the original implementation - the add carry of the
   *   first 32bit addition is not carried over to the last 32bit.
   *
   * [Reference implementation](http://vigna.di.unimi.it/xorshift/xoroshiro128plus.c)
   */
  class Xoroshiro128plus {
    /**
     * @param {number} seed Unsigned 32 bit number
     */
    constructor (seed) {
      this.seed = seed;
      // This is a variant of Xoroshiro128plus to fill the initial state
      const xorshift32 = new Xorshift32(seed);
      this.state = new Uint32Array(4);
      for (let i = 0; i < 4; i++) {
        this.state[i] = xorshift32.next() * BITS32;
      }
      this._fresh = true;
    }

    /**
     * @return {number} Float/Double in [0,1)
     */
    next () {
      const state = this.state;
      if (this._fresh) {
        this._fresh = false;
        return ((state[0] + state[2]) >>> 0) / (BITS32 + 1)
      } else {
        this._fresh = true;
        const s0 = state[0];
        const s1 = state[1];
        const s2 = state[2] ^ s0;
        const s3 = state[3] ^ s1;
        // function js_rotl (x, k) {
        //   k = k - 32
        //   const x1 = x[0]
        //   const x2 = x[1]
        //   x[0] = x2 << k | x1 >>> (32 - k)
        //   x[1] = x1 << k | x2 >>> (32 - k)
        // }
        // rotl(s0, 55) // k = 23 = 55 - 32; j = 9 =  32 - 23
        state[0] = (s1 << 23 | s0 >>> 9) ^ s2 ^ (s2 << 14 | s3 >>> 18);
        state[1] = (s0 << 23 | s1 >>> 9) ^ s3 ^ (s3 << 14);
        // rol(s1, 36) // k = 4 = 36 - 32; j = 23 = 32 - 9
        state[2] = s3 << 4 | s2 >>> 28;
        state[3] = s2 << 4 | s3 >>> 28;
        return (((state[1] + state[3]) >>> 0) / (BITS32 + 1))
      }
    }
  }

  /*
  // Reference implementation
  // Source: http://vigna.di.unimi.it/xorshift/xoroshiro128plus.c
  // By David Blackman and Sebastiano Vigna
  // Who published the reference implementation under Public Domain (CC0)

  #include <stdint.h>
  #include <stdio.h>

  uint64_t s[2];

  static inline uint64_t rotl(const uint64_t x, int k) {
      return (x << k) | (x >> (64 - k));
  }

  uint64_t next(void) {
      const uint64_t s0 = s[0];
      uint64_t s1 = s[1];
      s1 ^= s0;
      s[0] = rotl(s0, 55) ^ s1 ^ (s1 << 14); // a, b
      s[1] = rotl(s1, 36); // c
      return (s[0] + s[1]) & 0xFFFFFFFF;
  }

  int main(void)
  {
      int i;
      s[0] = 1111 | (1337ul << 32);
      s[1] = 1234 | (9999ul << 32);

      printf("1000 outputs of genrand_int31()\n");
      for (i=0; i<100; i++) {
          printf("%10lu ", i);
          printf("%10lu ", next());
          printf("- %10lu ", s[0] >> 32);
          printf("%10lu ", (s[0] << 32) >> 32);
          printf("%10lu ", s[1] >> 32);
          printf("%10lu ", (s[1] << 32) >> 32);
          printf("\n");
          // if (i%5==4) printf("\n");
      }
      return 0;
  }
  */

  /**
   * Utility helpers for working with numbers.
   *
   * @module number
   */

  const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

  /**
   * @module number
   */

  /* c8 ignore next */
  const isInteger = Number.isInteger || (num => typeof num === 'number' && isFinite(num) && floor(num) === num);

  /**
   * Efficient schema-less binary encoding with support for variable length encoding.
   *
   * Use [lib0/encoding] with [lib0/decoding]. Every encoding function has a corresponding decoding function.
   *
   * Encodes numbers in little-endian order (least to most significant byte order)
   * and is compatible with Golang's binary encoding (https://golang.org/pkg/encoding/binary/)
   * which is also used in Protocol Buffers.
   *
   * ```js
   * // encoding step
   * const encoder = encoding.createEncoder()
   * encoding.writeVarUint(encoder, 256)
   * encoding.writeVarString(encoder, 'Hello world!')
   * const buf = encoding.toUint8Array(encoder)
   * ```
   *
   * ```js
   * // decoding step
   * const decoder = decoding.createDecoder(buf)
   * decoding.readVarUint(decoder) // => 256
   * decoding.readVarString(decoder) // => 'Hello world!'
   * decoding.hasContent(decoder) // => false - all data is read
   * ```
   *
   * @module encoding
   */

  /**
   * A BinaryEncoder handles the encoding to an Uint8Array.
   */
  class Encoder {
    constructor () {
      this.cpos = 0;
      this.cbuf = new Uint8Array(100);
      /**
       * @type {Array<Uint8Array>}
       */
      this.bufs = [];
    }
  }

  /**
   * @function
   * @return {Encoder}
   */
  const createEncoder = () => new Encoder();

  /**
   * The current length of the encoded data.
   *
   * @function
   * @param {Encoder} encoder
   * @return {number}
   */
  const length = encoder => {
    let len = encoder.cpos;
    for (let i = 0; i < encoder.bufs.length; i++) {
      len += encoder.bufs[i].length;
    }
    return len
  };

  /**
   * Transform to Uint8Array.
   *
   * @function
   * @param {Encoder} encoder
   * @return {Uint8Array} The created ArrayBuffer.
   */
  const toUint8Array = encoder => {
    const uint8arr = new Uint8Array(length(encoder));
    let curPos = 0;
    for (let i = 0; i < encoder.bufs.length; i++) {
      const d = encoder.bufs[i];
      uint8arr.set(d, curPos);
      curPos += d.length;
    }
    uint8arr.set(createUint8ArrayViewFromArrayBuffer(encoder.cbuf.buffer, 0, encoder.cpos), curPos);
    return uint8arr
  };

  /**
   * Verify that it is possible to write `len` bytes wtihout checking. If
   * necessary, a new Buffer with the required length is attached.
   *
   * @param {Encoder} encoder
   * @param {number} len
   */
  const verifyLen = (encoder, len) => {
    const bufferLen = encoder.cbuf.length;
    if (bufferLen - encoder.cpos < len) {
      encoder.bufs.push(createUint8ArrayViewFromArrayBuffer(encoder.cbuf.buffer, 0, encoder.cpos));
      encoder.cbuf = new Uint8Array(max(bufferLen, len) * 2);
      encoder.cpos = 0;
    }
  };

  /**
   * Write one byte to the encoder.
   *
   * @function
   * @param {Encoder} encoder
   * @param {number} num The byte that is to be encoded.
   */
  const write = (encoder, num) => {
    const bufferLen = encoder.cbuf.length;
    if (encoder.cpos === bufferLen) {
      encoder.bufs.push(encoder.cbuf);
      encoder.cbuf = new Uint8Array(bufferLen * 2);
      encoder.cpos = 0;
    }
    encoder.cbuf[encoder.cpos++] = num;
  };

  /**
   * Write one byte as an unsigned integer.
   *
   * @function
   * @param {Encoder} encoder
   * @param {number} num The number that is to be encoded.
   */
  const writeUint8 = write;

  /**
   * Write a variable length unsigned integer. Max encodable integer is 2^53.
   *
   * @function
   * @param {Encoder} encoder
   * @param {number} num The number that is to be encoded.
   */
  const writeVarUint = (encoder, num) => {
    while (num > BITS7) {
      write(encoder, BIT8 | (BITS7 & num));
      num = floor(num / 128); // shift >>> 7
    }
    write(encoder, BITS7 & num);
  };

  /**
   * Write a variable length integer.
   *
   * We use the 7th bit instead for signaling that this is a negative number.
   *
   * @function
   * @param {Encoder} encoder
   * @param {number} num The number that is to be encoded.
   */
  const writeVarInt = (encoder, num) => {
    const isNegative = isNegativeZero(num);
    if (isNegative) {
      num = -num;
    }
    //             |- whether to continue reading         |- whether is negative     |- number
    write(encoder, (num > BITS6 ? BIT8 : 0) | (isNegative ? BIT7 : 0) | (BITS6 & num));
    num = floor(num / 64); // shift >>> 6
    // We don't need to consider the case of num === 0 so we can use a different
    // pattern here than above.
    while (num > 0) {
      write(encoder, (num > BITS7 ? BIT8 : 0) | (BITS7 & num));
      num = floor(num / 128); // shift >>> 7
    }
  };

  /**
   * A cache to store strings temporarily
   */
  const _strBuffer = new Uint8Array(30000);
  const _maxStrBSize = _strBuffer.length / 3;

  /**
   * Write a variable length string.
   *
   * @function
   * @param {Encoder} encoder
   * @param {String} str The string that is to be encoded.
   */
  const _writeVarStringNative = (encoder, str) => {
    if (str.length < _maxStrBSize) {
      // We can encode the string into the existing buffer
      /* c8 ignore next */
      const written = utf8TextEncoder.encodeInto(str, _strBuffer).written || 0;
      writeVarUint(encoder, written);
      for (let i = 0; i < written; i++) {
        write(encoder, _strBuffer[i]);
      }
    } else {
      writeVarUint8Array(encoder, encodeUtf8(str));
    }
  };

  /**
   * Write a variable length string.
   *
   * @function
   * @param {Encoder} encoder
   * @param {String} str The string that is to be encoded.
   */
  const _writeVarStringPolyfill = (encoder, str) => {
    const encodedString = unescape(encodeURIComponent(str));
    const len = encodedString.length;
    writeVarUint(encoder, len);
    for (let i = 0; i < len; i++) {
      write(encoder, /** @type {number} */ (encodedString.codePointAt(i)));
    }
  };

  /**
   * Write a variable length string.
   *
   * @function
   * @param {Encoder} encoder
   * @param {String} str The string that is to be encoded.
   */
  /* c8 ignore next */
  const writeVarString = (utf8TextEncoder && /** @type {any} */ (utf8TextEncoder).encodeInto) ? _writeVarStringNative : _writeVarStringPolyfill;

  /**
   * Write the content of another Encoder.
   *
   * @TODO: can be improved!
   *        - Note: Should consider that when appending a lot of small Encoders, we should rather clone than referencing the old structure.
   *                Encoders start with a rather big initial buffer.
   *
   * @function
   * @param {Encoder} encoder The enUint8Arr
   * @param {Encoder} append The BinaryEncoder to be written.
   */
  const writeBinaryEncoder = (encoder, append) => writeUint8Array(encoder, toUint8Array(append));

  /**
   * Append fixed-length Uint8Array to the encoder.
   *
   * @function
   * @param {Encoder} encoder
   * @param {Uint8Array} uint8Array
   */
  const writeUint8Array = (encoder, uint8Array) => {
    const bufferLen = encoder.cbuf.length;
    const cpos = encoder.cpos;
    const leftCopyLen = min(bufferLen - cpos, uint8Array.length);
    const rightCopyLen = uint8Array.length - leftCopyLen;
    encoder.cbuf.set(uint8Array.subarray(0, leftCopyLen), cpos);
    encoder.cpos += leftCopyLen;
    if (rightCopyLen > 0) {
      // Still something to write, write right half..
      // Append new buffer
      encoder.bufs.push(encoder.cbuf);
      // must have at least size of remaining buffer
      encoder.cbuf = new Uint8Array(max(bufferLen * 2, rightCopyLen));
      // copy array
      encoder.cbuf.set(uint8Array.subarray(leftCopyLen));
      encoder.cpos = rightCopyLen;
    }
  };

  /**
   * Append an Uint8Array to Encoder.
   *
   * @function
   * @param {Encoder} encoder
   * @param {Uint8Array} uint8Array
   */
  const writeVarUint8Array = (encoder, uint8Array) => {
    writeVarUint(encoder, uint8Array.byteLength);
    writeUint8Array(encoder, uint8Array);
  };

  /**
   * Create an DataView of the next `len` bytes. Use it to write data after
   * calling this function.
   *
   * ```js
   * // write float32 using DataView
   * const dv = writeOnDataView(encoder, 4)
   * dv.setFloat32(0, 1.1)
   * // read float32 using DataView
   * const dv = readFromDataView(encoder, 4)
   * dv.getFloat32(0) // => 1.100000023841858 (leaving it to the reader to find out why this is the correct result)
   * ```
   *
   * @param {Encoder} encoder
   * @param {number} len
   * @return {DataView}
   */
  const writeOnDataView = (encoder, len) => {
    verifyLen(encoder, len);
    const dview = new DataView(encoder.cbuf.buffer, encoder.cpos, len);
    encoder.cpos += len;
    return dview
  };

  /**
   * @param {Encoder} encoder
   * @param {number} num
   */
  const writeFloat32 = (encoder, num) => writeOnDataView(encoder, 4).setFloat32(0, num, false);

  /**
   * @param {Encoder} encoder
   * @param {number} num
   */
  const writeFloat64 = (encoder, num) => writeOnDataView(encoder, 8).setFloat64(0, num, false);

  /**
   * @param {Encoder} encoder
   * @param {bigint} num
   */
  const writeBigInt64 = (encoder, num) => /** @type {any} */ (writeOnDataView(encoder, 8)).setBigInt64(0, num, false);

  const floatTestBed = new DataView(new ArrayBuffer(4));
  /**
   * Check if a number can be encoded as a 32 bit float.
   *
   * @param {number} num
   * @return {boolean}
   */
  const isFloat32 = num => {
    floatTestBed.setFloat32(0, num);
    return floatTestBed.getFloat32(0) === num
  };

  /**
   * Encode data with efficient binary format.
   *
   * Differences to JSON:
   * • Transforms data to a binary format (not to a string)
   * • Encodes undefined, NaN, and ArrayBuffer (these can't be represented in JSON)
   * • Numbers are efficiently encoded either as a variable length integer, as a
   *   32 bit float, as a 64 bit float, or as a 64 bit bigint.
   *
   * Encoding table:
   *
   * | Data Type           | Prefix   | Encoding Method    | Comment |
   * | ------------------- | -------- | ------------------ | ------- |
   * | undefined           | 127      |                    | Functions, symbol, and everything that cannot be identified is encoded as undefined |
   * | null                | 126      |                    | |
   * | integer             | 125      | writeVarInt        | Only encodes 32 bit signed integers |
   * | float32             | 124      | writeFloat32       | |
   * | float64             | 123      | writeFloat64       | |
   * | bigint              | 122      | writeBigInt64      | |
   * | boolean (false)     | 121      |                    | True and false are different data types so we save the following byte |
   * | boolean (true)      | 120      |                    | - 0b01111000 so the last bit determines whether true or false |
   * | string              | 119      | writeVarString     | |
   * | object<string,any>  | 118      | custom             | Writes {length} then {length} key-value pairs |
   * | array<any>          | 117      | custom             | Writes {length} then {length} json values |
   * | Uint8Array          | 116      | writeVarUint8Array | We use Uint8Array for any kind of binary data |
   *
   * Reasons for the decreasing prefix:
   * We need the first bit for extendability (later we may want to encode the
   * prefix with writeVarUint). The remaining 7 bits are divided as follows:
   * [0-30]   the beginning of the data range is used for custom purposes
   *          (defined by the function that uses this library)
   * [31-127] the end of the data range is used for data encoding by
   *          lib0/encoding.js
   *
   * @param {Encoder} encoder
   * @param {undefined|null|number|bigint|boolean|string|Object<string,any>|Array<any>|Uint8Array} data
   */
  const writeAny = (encoder, data) => {
    switch (typeof data) {
      case 'string':
        // TYPE 119: STRING
        write(encoder, 119);
        writeVarString(encoder, data);
        break
      case 'number':
        if (isInteger(data) && abs(data) <= BITS31) {
          // TYPE 125: INTEGER
          write(encoder, 125);
          writeVarInt(encoder, data);
        } else if (isFloat32(data)) {
          // TYPE 124: FLOAT32
          write(encoder, 124);
          writeFloat32(encoder, data);
        } else {
          // TYPE 123: FLOAT64
          write(encoder, 123);
          writeFloat64(encoder, data);
        }
        break
      case 'bigint':
        // TYPE 122: BigInt
        write(encoder, 122);
        writeBigInt64(encoder, data);
        break
      case 'object':
        if (data === null) {
          // TYPE 126: null
          write(encoder, 126);
        } else if (isArray(data)) {
          // TYPE 117: Array
          write(encoder, 117);
          writeVarUint(encoder, data.length);
          for (let i = 0; i < data.length; i++) {
            writeAny(encoder, data[i]);
          }
        } else if (data instanceof Uint8Array) {
          // TYPE 116: ArrayBuffer
          write(encoder, 116);
          writeVarUint8Array(encoder, data);
        } else {
          // TYPE 118: Object
          write(encoder, 118);
          const keys = Object.keys(data);
          writeVarUint(encoder, keys.length);
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            writeVarString(encoder, key);
            writeAny(encoder, data[key]);
          }
        }
        break
      case 'boolean':
        // TYPE 120/121: boolean (true/false)
        write(encoder, data ? 120 : 121);
        break
      default:
        // TYPE 127: undefined
        write(encoder, 127);
    }
  };

  /**
   * Now come a few stateful encoder that have their own classes.
   */

  /**
   * Basic Run Length Encoder - a basic compression implementation.
   *
   * Encodes [1,1,1,7] to [1,3,7,1] (3 times 1, 1 time 7). This encoder might do more harm than good if there are a lot of values that are not repeated.
   *
   * It was originally used for image compression. Cool .. article http://csbruce.com/cbm/transactor/pdfs/trans_v7_i06.pdf
   *
   * @note T must not be null!
   *
   * @template T
   */
  class RleEncoder extends Encoder {
    /**
     * @param {function(Encoder, T):void} writer
     */
    constructor (writer) {
      super();
      /**
       * The writer
       */
      this.w = writer;
      /**
       * Current state
       * @type {T|null}
       */
      this.s = null;
      this.count = 0;
    }

    /**
     * @param {T} v
     */
    write (v) {
      if (this.s === v) {
        this.count++;
      } else {
        if (this.count > 0) {
          // flush counter, unless this is the first value (count = 0)
          writeVarUint(this, this.count - 1); // since count is always > 0, we can decrement by one. non-standard encoding ftw
        }
        this.count = 1;
        // write first value
        this.w(this, v);
        this.s = v;
      }
    }
  }

  /**
   * @param {UintOptRleEncoder} encoder
   */
  const flushUintOptRleEncoder = encoder => {
    if (encoder.count > 0) {
      // flush counter, unless this is the first value (count = 0)
      // case 1: just a single value. set sign to positive
      // case 2: write several values. set sign to negative to indicate that there is a length coming
      writeVarInt(encoder.encoder, encoder.count === 1 ? encoder.s : -encoder.s);
      if (encoder.count > 1) {
        writeVarUint(encoder.encoder, encoder.count - 2); // since count is always > 1, we can decrement by one. non-standard encoding ftw
      }
    }
  };

  /**
   * Optimized Rle encoder that does not suffer from the mentioned problem of the basic Rle encoder.
   *
   * Internally uses VarInt encoder to write unsigned integers. If the input occurs multiple times, we write
   * write it as a negative number. The UintOptRleDecoder then understands that it needs to read a count.
   *
   * Encodes [1,2,3,3,3] as [1,2,-3,3] (once 1, once 2, three times 3)
   */
  class UintOptRleEncoder {
    constructor () {
      this.encoder = new Encoder();
      /**
       * @type {number}
       */
      this.s = 0;
      this.count = 0;
    }

    /**
     * @param {number} v
     */
    write (v) {
      if (this.s === v) {
        this.count++;
      } else {
        flushUintOptRleEncoder(this);
        this.count = 1;
        this.s = v;
      }
    }

    toUint8Array () {
      flushUintOptRleEncoder(this);
      return toUint8Array(this.encoder)
    }
  }

  /**
   * @param {IntDiffOptRleEncoder} encoder
   */
  const flushIntDiffOptRleEncoder = encoder => {
    if (encoder.count > 0) {
      //          31 bit making up the diff | wether to write the counter
      // const encodedDiff = encoder.diff << 1 | (encoder.count === 1 ? 0 : 1)
      const encodedDiff = encoder.diff * 2 + (encoder.count === 1 ? 0 : 1);
      // flush counter, unless this is the first value (count = 0)
      // case 1: just a single value. set first bit to positive
      // case 2: write several values. set first bit to negative to indicate that there is a length coming
      writeVarInt(encoder.encoder, encodedDiff);
      if (encoder.count > 1) {
        writeVarUint(encoder.encoder, encoder.count - 2); // since count is always > 1, we can decrement by one. non-standard encoding ftw
      }
    }
  };

  /**
   * A combination of the IntDiffEncoder and the UintOptRleEncoder.
   *
   * The count approach is similar to the UintDiffOptRleEncoder, but instead of using the negative bitflag, it encodes
   * in the LSB whether a count is to be read. Therefore this Encoder only supports 31 bit integers!
   *
   * Encodes [1, 2, 3, 2] as [3, 1, 6, -1] (more specifically [(1 << 1) | 1, (3 << 0) | 0, -1])
   *
   * Internally uses variable length encoding. Contrary to normal UintVar encoding, the first byte contains:
   * * 1 bit that denotes whether the next value is a count (LSB)
   * * 1 bit that denotes whether this value is negative (MSB - 1)
   * * 1 bit that denotes whether to continue reading the variable length integer (MSB)
   *
   * Therefore, only five bits remain to encode diff ranges.
   *
   * Use this Encoder only when appropriate. In most cases, this is probably a bad idea.
   */
  class IntDiffOptRleEncoder {
    constructor () {
      this.encoder = new Encoder();
      /**
       * @type {number}
       */
      this.s = 0;
      this.count = 0;
      this.diff = 0;
    }

    /**
     * @param {number} v
     */
    write (v) {
      if (this.diff === v - this.s) {
        this.s = v;
        this.count++;
      } else {
        flushIntDiffOptRleEncoder(this);
        this.count = 1;
        this.diff = v - this.s;
        this.s = v;
      }
    }

    toUint8Array () {
      flushIntDiffOptRleEncoder(this);
      return toUint8Array(this.encoder)
    }
  }

  /**
   * Optimized String Encoder.
   *
   * Encoding many small strings in a simple Encoder is not very efficient. The function call to decode a string takes some time and creates references that must be eventually deleted.
   * In practice, when decoding several million small strings, the GC will kick in more and more often to collect orphaned string objects (or maybe there is another reason?).
   *
   * This string encoder solves the above problem. All strings are concatenated and written as a single string using a single encoding call.
   *
   * The lengths are encoded using a UintOptRleEncoder.
   */
  class StringEncoder {
    constructor () {
      /**
       * @type {Array<string>}
       */
      this.sarr = [];
      this.s = '';
      this.lensE = new UintOptRleEncoder();
    }

    /**
     * @param {string} string
     */
    write (string) {
      this.s += string;
      if (this.s.length > 19) {
        this.sarr.push(this.s);
        this.s = '';
      }
      this.lensE.write(string.length);
    }

    toUint8Array () {
      const encoder = new Encoder();
      this.sarr.push(this.s);
      this.s = '';
      writeVarString(encoder, this.sarr.join(''));
      writeUint8Array(encoder, this.lensE.toUint8Array());
      return toUint8Array(encoder)
    }
  }

  /**
   * Error helpers.
   *
   * @module error
   */

  /**
   * @param {string} s
   * @return {Error}
   */
  /* c8 ignore next */
  const create$2 = s => new Error(s);

  /**
   * @throws {Error}
   * @return {never}
   */
  /* c8 ignore next 3 */
  const methodUnimplemented = () => {
    throw create$2('Method unimplemented')
  };

  /**
   * @throws {Error}
   * @return {never}
   */
  /* c8 ignore next 3 */
  const unexpectedCase = () => {
    throw create$2('Unexpected case')
  };

  /**
   * Efficient schema-less binary decoding with support for variable length encoding.
   *
   * Use [lib0/decoding] with [lib0/encoding]. Every encoding function has a corresponding decoding function.
   *
   * Encodes numbers in little-endian order (least to most significant byte order)
   * and is compatible with Golang's binary encoding (https://golang.org/pkg/encoding/binary/)
   * which is also used in Protocol Buffers.
   *
   * ```js
   * // encoding step
   * const encoder = encoding.createEncoder()
   * encoding.writeVarUint(encoder, 256)
   * encoding.writeVarString(encoder, 'Hello world!')
   * const buf = encoding.toUint8Array(encoder)
   * ```
   *
   * ```js
   * // decoding step
   * const decoder = decoding.createDecoder(buf)
   * decoding.readVarUint(decoder) // => 256
   * decoding.readVarString(decoder) // => 'Hello world!'
   * decoding.hasContent(decoder) // => false - all data is read
   * ```
   *
   * @module decoding
   */

  const errorUnexpectedEndOfArray = create$2('Unexpected end of array');
  const errorIntegerOutOfRange = create$2('Integer out of Range');

  /**
   * A Decoder handles the decoding of an Uint8Array.
   */
  class Decoder {
    /**
     * @param {Uint8Array} uint8Array Binary data to decode
     */
    constructor (uint8Array) {
      /**
       * Decoding target.
       *
       * @type {Uint8Array}
       */
      this.arr = uint8Array;
      /**
       * Current decoding position.
       *
       * @type {number}
       */
      this.pos = 0;
    }
  }

  /**
   * @function
   * @param {Uint8Array} uint8Array
   * @return {Decoder}
   */
  const createDecoder = uint8Array => new Decoder(uint8Array);

  /**
   * @function
   * @param {Decoder} decoder
   * @return {boolean}
   */
  const hasContent = decoder => decoder.pos !== decoder.arr.length;

  /**
   * Create an Uint8Array view of the next `len` bytes and advance the position by `len`.
   *
   * Important: The Uint8Array still points to the underlying ArrayBuffer. Make sure to discard the result as soon as possible to prevent any memory leaks.
   *            Use `buffer.copyUint8Array` to copy the result into a new Uint8Array.
   *
   * @function
   * @param {Decoder} decoder The decoder instance
   * @param {number} len The length of bytes to read
   * @return {Uint8Array}
   */
  const readUint8Array = (decoder, len) => {
    const view = createUint8ArrayViewFromArrayBuffer(decoder.arr.buffer, decoder.pos + decoder.arr.byteOffset, len);
    decoder.pos += len;
    return view
  };

  /**
   * Read variable length Uint8Array.
   *
   * Important: The Uint8Array still points to the underlying ArrayBuffer. Make sure to discard the result as soon as possible to prevent any memory leaks.
   *            Use `buffer.copyUint8Array` to copy the result into a new Uint8Array.
   *
   * @function
   * @param {Decoder} decoder
   * @return {Uint8Array}
   */
  const readVarUint8Array = decoder => readUint8Array(decoder, readVarUint(decoder));

  /**
   * Read one byte as unsigned integer.
   * @function
   * @param {Decoder} decoder The decoder instance
   * @return {number} Unsigned 8-bit integer
   */
  const readUint8 = decoder => decoder.arr[decoder.pos++];

  /**
   * Read unsigned integer (32bit) with variable length.
   * 1/8th of the storage is used as encoding overhead.
   *  * numbers < 2^7 is stored in one bytlength
   *  * numbers < 2^14 is stored in two bylength
   *
   * @function
   * @param {Decoder} decoder
   * @return {number} An unsigned integer.length
   */
  const readVarUint = decoder => {
    let num = 0;
    let mult = 1;
    const len = decoder.arr.length;
    while (decoder.pos < len) {
      const r = decoder.arr[decoder.pos++];
      // num = num | ((r & binary.BITS7) << len)
      num = num + (r & BITS7) * mult; // shift $r << (7*#iterations) and add it to num
      mult *= 128; // next iteration, shift 7 "more" to the left
      if (r < BIT8) {
        return num
      }
      /* c8 ignore start */
      if (num > MAX_SAFE_INTEGER) {
        throw errorIntegerOutOfRange
      }
      /* c8 ignore stop */
    }
    throw errorUnexpectedEndOfArray
  };

  /**
   * Read signed integer (32bit) with variable length.
   * 1/8th of the storage is used as encoding overhead.
   *  * numbers < 2^7 is stored in one bytlength
   *  * numbers < 2^14 is stored in two bylength
   * @todo This should probably create the inverse ~num if number is negative - but this would be a breaking change.
   *
   * @function
   * @param {Decoder} decoder
   * @return {number} An unsigned integer.length
   */
  const readVarInt = decoder => {
    let r = decoder.arr[decoder.pos++];
    let num = r & BITS6;
    let mult = 64;
    const sign = (r & BIT7) > 0 ? -1 : 1;
    if ((r & BIT8) === 0) {
      // don't continue reading
      return sign * num
    }
    const len = decoder.arr.length;
    while (decoder.pos < len) {
      r = decoder.arr[decoder.pos++];
      // num = num | ((r & binary.BITS7) << len)
      num = num + (r & BITS7) * mult;
      mult *= 128;
      if (r < BIT8) {
        return sign * num
      }
      /* c8 ignore start */
      if (num > MAX_SAFE_INTEGER) {
        throw errorIntegerOutOfRange
      }
      /* c8 ignore stop */
    }
    throw errorUnexpectedEndOfArray
  };

  /**
   * We don't test this function anymore as we use native decoding/encoding by default now.
   * Better not modify this anymore..
   *
   * Transforming utf8 to a string is pretty expensive. The code performs 10x better
   * when String.fromCodePoint is fed with all characters as arguments.
   * But most environments have a maximum number of arguments per functions.
   * For effiency reasons we apply a maximum of 10000 characters at once.
   *
   * @function
   * @param {Decoder} decoder
   * @return {String} The read String.
   */
  /* c8 ignore start */
  const _readVarStringPolyfill = decoder => {
    let remainingLen = readVarUint(decoder);
    if (remainingLen === 0) {
      return ''
    } else {
      let encodedString = String.fromCodePoint(readUint8(decoder)); // remember to decrease remainingLen
      if (--remainingLen < 100) { // do not create a Uint8Array for small strings
        while (remainingLen--) {
          encodedString += String.fromCodePoint(readUint8(decoder));
        }
      } else {
        while (remainingLen > 0) {
          const nextLen = remainingLen < 10000 ? remainingLen : 10000;
          // this is dangerous, we create a fresh array view from the existing buffer
          const bytes = decoder.arr.subarray(decoder.pos, decoder.pos + nextLen);
          decoder.pos += nextLen;
          // Starting with ES5.1 we can supply a generic array-like object as arguments
          encodedString += String.fromCodePoint.apply(null, /** @type {any} */ (bytes));
          remainingLen -= nextLen;
        }
      }
      return decodeURIComponent(escape(encodedString))
    }
  };
  /* c8 ignore stop */

  /**
   * @function
   * @param {Decoder} decoder
   * @return {String} The read String
   */
  const _readVarStringNative = decoder =>
    /** @type any */ (utf8TextDecoder).decode(readVarUint8Array(decoder));

  /**
   * Read string of variable length
   * * varUint is used to store the length of the string
   *
   * @function
   * @param {Decoder} decoder
   * @return {String} The read String
   *
   */
  /* c8 ignore next */
  const readVarString = utf8TextDecoder ? _readVarStringNative : _readVarStringPolyfill;

  /**
   * @param {Decoder} decoder
   * @param {number} len
   * @return {DataView}
   */
  const readFromDataView = (decoder, len) => {
    const dv = new DataView(decoder.arr.buffer, decoder.arr.byteOffset + decoder.pos, len);
    decoder.pos += len;
    return dv
  };

  /**
   * @param {Decoder} decoder
   */
  const readFloat32 = decoder => readFromDataView(decoder, 4).getFloat32(0, false);

  /**
   * @param {Decoder} decoder
   */
  const readFloat64 = decoder => readFromDataView(decoder, 8).getFloat64(0, false);

  /**
   * @param {Decoder} decoder
   */
  const readBigInt64 = decoder => /** @type {any} */ (readFromDataView(decoder, 8)).getBigInt64(0, false);

  /**
   * @type {Array<function(Decoder):any>}
   */
  const readAnyLookupTable = [
    decoder => undefined, // CASE 127: undefined
    decoder => null, // CASE 126: null
    readVarInt, // CASE 125: integer
    readFloat32, // CASE 124: float32
    readFloat64, // CASE 123: float64
    readBigInt64, // CASE 122: bigint
    decoder => false, // CASE 121: boolean (false)
    decoder => true, // CASE 120: boolean (true)
    readVarString, // CASE 119: string
    decoder => { // CASE 118: object<string,any>
      const len = readVarUint(decoder);
      /**
       * @type {Object<string,any>}
       */
      const obj = {};
      for (let i = 0; i < len; i++) {
        const key = readVarString(decoder);
        obj[key] = readAny(decoder);
      }
      return obj
    },
    decoder => { // CASE 117: array<any>
      const len = readVarUint(decoder);
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(readAny(decoder));
      }
      return arr
    },
    readVarUint8Array // CASE 116: Uint8Array
  ];

  /**
   * @param {Decoder} decoder
   */
  const readAny = decoder => readAnyLookupTable[127 - readUint8(decoder)](decoder);

  /**
   * T must not be null.
   *
   * @template T
   */
  class RleDecoder extends Decoder {
    /**
     * @param {Uint8Array} uint8Array
     * @param {function(Decoder):T} reader
     */
    constructor (uint8Array, reader) {
      super(uint8Array);
      /**
       * The reader
       */
      this.reader = reader;
      /**
       * Current state
       * @type {T|null}
       */
      this.s = null;
      this.count = 0;
    }

    read () {
      if (this.count === 0) {
        this.s = this.reader(this);
        if (hasContent(this)) {
          this.count = readVarUint(this) + 1; // see encoder implementation for the reason why this is incremented
        } else {
          this.count = -1; // read the current value forever
        }
      }
      this.count--;
      return /** @type {T} */ (this.s)
    }
  }

  class UintOptRleDecoder extends Decoder {
    /**
     * @param {Uint8Array} uint8Array
     */
    constructor (uint8Array) {
      super(uint8Array);
      /**
       * @type {number}
       */
      this.s = 0;
      this.count = 0;
    }

    read () {
      if (this.count === 0) {
        this.s = readVarInt(this);
        // if the sign is negative, we read the count too, otherwise count is 1
        const isNegative = isNegativeZero(this.s);
        this.count = 1;
        if (isNegative) {
          this.s = -this.s;
          this.count = readVarUint(this) + 2;
        }
      }
      this.count--;
      return /** @type {number} */ (this.s)
    }
  }

  class IntDiffOptRleDecoder extends Decoder {
    /**
     * @param {Uint8Array} uint8Array
     */
    constructor (uint8Array) {
      super(uint8Array);
      /**
       * @type {number}
       */
      this.s = 0;
      this.count = 0;
      this.diff = 0;
    }

    /**
     * @return {number}
     */
    read () {
      if (this.count === 0) {
        const diff = readVarInt(this);
        // if the first bit is set, we read more data
        const hasCount = diff & 1;
        this.diff = floor(diff / 2); // shift >> 1
        this.count = 1;
        if (hasCount) {
          this.count = readVarUint(this) + 2;
        }
      }
      this.s += this.diff;
      this.count--;
      return this.s
    }
  }

  class StringDecoder {
    /**
     * @param {Uint8Array} uint8Array
     */
    constructor (uint8Array) {
      this.decoder = new UintOptRleDecoder(uint8Array);
      this.str = readVarString(this.decoder);
      /**
       * @type {number}
       */
      this.spos = 0;
    }

    /**
     * @return {string}
     */
    read () {
      const end = this.spos + this.decoder.read();
      const res = this.str.slice(this.spos, end);
      this.spos = end;
      return res
    }
  }

  /**
   * Utility functions to work with buffers (Uint8Array).
   *
   * @module buffer
   */

  /**
   * @param {number} len
   */
  const createUint8ArrayFromLen = len => new Uint8Array(len);

  /**
   * Create Uint8Array with initial content from buffer
   *
   * @param {ArrayBuffer} buffer
   * @param {number} byteOffset
   * @param {number} length
   */
  const createUint8ArrayViewFromArrayBuffer = (buffer, byteOffset, length) => new Uint8Array(buffer, byteOffset, length);

  /* c8 ignore start */
  /**
   * @param {string} s
   * @return {Uint8Array}
   */
  const fromBase64Browser = s => {
    // eslint-disable-next-line no-undef
    const a = atob(s);
    const bytes = createUint8ArrayFromLen(a.length);
    for (let i = 0; i < a.length; i++) {
      bytes[i] = a.charCodeAt(i);
    }
    return bytes
  };
  /* c8 ignore stop */

  /**
   * @param {string} s
   */
  const fromBase64Node = s => {
    const buf = Buffer.from(s, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  };

  /* c8 ignore next */
  const fromBase64 = isBrowser ? fromBase64Browser : fromBase64Node;

  /**
   * Copy the content of an Uint8Array view to a new ArrayBuffer.
   *
   * @param {Uint8Array} uint8Array
   * @return {Uint8Array}
   */
  const copyUint8Array = uint8Array => {
    const newBuf = createUint8ArrayFromLen(uint8Array.byteLength);
    newBuf.set(uint8Array);
    return newBuf
  };

  /**
   * Fast Pseudo Random Number Generators.
   *
   * Given a seed a PRNG generates a sequence of numbers that cannot be reasonably predicted.
   * Two PRNGs must generate the same random sequence of numbers if  given the same seed.
   *
   * @module prng
   */

  /**
   * Description of the function
   *  @callback generatorNext
   *  @return {number} A random float in the cange of [0,1)
   */

  /**
   * A random type generator.
   *
   * @typedef {Object} PRNG
   * @property {generatorNext} next Generate new number
   */
  const DefaultPRNG = Xoroshiro128plus;

  /**
   * Create a Xoroshiro128plus Pseudo-Random-Number-Generator.
   * This is the fastest full-period generator passing BigCrush without systematic failures.
   * But there are more PRNGs available in ./PRNG/.
   *
   * @param {number} seed A positive 32bit integer. Do not use negative numbers.
   * @return {PRNG}
   */
  const create$1 = seed => new DefaultPRNG(seed);

  /**
   * Generates a single random bool.
   *
   * @param {PRNG} gen A random number generator.
   * @return {Boolean} A random boolean
   */
  const bool = gen => (gen.next() >= 0.5);

  /**
   * Generates a random integer with 32 bit resolution.
   *
   * @param {PRNG} gen A random number generator.
   * @param {Number} min The lower bound of the allowed return values (inclusive).
   * @param {Number} max The upper bound of the allowed return values (inclusive).
   * @return {Number} A random integer on [min, max]
   */
  const int32 = (gen, min, max) => floor(gen.next() * (max + 1 - min) + min);

  /**
   * Generates a random integer with 53 bit resolution.
   *
   * @param {PRNG} gen A random number generator.
   * @param {Number} min The lower bound of the allowed return values (inclusive).
   * @param {Number} max The upper bound of the allowed return values (inclusive).
   * @return {Number} A random integer on [min, max]
   */
  const uint32 = (gen, min, max) => int32(gen, min, max) >>> 0;

  /**
   * @deprecated
   * Optimized version of prng.int32. It has the same precision as prng.int32, but should be preferred when
   * openaring on smaller ranges.
   *
   * @param {PRNG} gen A random number generator.
   * @param {Number} min The lower bound of the allowed return values (inclusive).
   * @param {Number} max The upper bound of the allowed return values (inclusive). The max inclusive number is `binary.BITS31-1`
   * @return {Number} A random integer on [min, max]
   */
  const int31 = (gen, min, max) => int32(gen, min, max);

  /**
   * @param {PRNG} gen
   * @return {string} A single letter (a-z)
   */
  const letter = gen => fromCharCode(int31(gen, 97, 122));

  /**
   * @param {PRNG} gen
   * @param {number} [minLen=0]
   * @param {number} [maxLen=20]
   * @return {string} A random word (0-20 characters) without spaces consisting of letters (a-z)
   */
  const word = (gen, minLen = 0, maxLen = 20) => {
    const len = int31(gen, minLen, maxLen);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += letter(gen);
    }
    return str
  };

  /**
   * TODO: this function produces invalid runes. Does not cover all of utf16!!
   *
   * @param {PRNG} gen
   * @return {string}
   */
  const utf16Rune = gen => {
    const codepoint = int31(gen, 0, 256);
    return fromCodePoint(codepoint)
  };

  /**
   * @param {PRNG} gen
   * @param {number} [maxlen = 20]
   */
  const utf16String = (gen, maxlen = 20) => {
    const len = int31(gen, 0, maxlen);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += utf16Rune(gen);
    }
    return str
  };

  /**
   * Returns one element of a given array.
   *
   * @param {PRNG} gen A random number generator.
   * @param {Array<T>} array Non empty Array of possible values.
   * @return {T} One of the values of the supplied Array.
   * @template T
   */
  const oneOf = (gen, array) => array[int31(gen, 0, array.length - 1)];
  /* c8 ignore stop */

  /**
   * Utility helpers for generating statistics.
   *
   * @module statistics
   */

  /**
   * @param {Array<number>} arr Array of values
   * @return {number} Returns null if the array is empty
   */
  const median = arr => arr.length === 0 ? NaN : (arr.length % 2 === 1 ? arr[(arr.length - 1) / 2] : (arr[floor((arr.length - 1) / 2)] + arr[ceil((arr.length - 1) / 2)]) / 2);

  /**
   * @param {Array<number>} arr
   * @return {number}
   */
  const average = arr => arr.reduce(add, 0) / arr.length;

  /**
   * Utility helpers to work with promises.
   *
   * @module promise
   */

  /**
   * @template T
   * @callback PromiseResolve
   * @param {T|PromiseLike<T>} [result]
   */

  /**
   * @template T
   * @param {function(PromiseResolve<T>,function(Error):void):any} f
   * @return {Promise<T>}
   */
  const create = f => /** @type {Promise<T>} */ (new Promise(f));

  /**
   * @param {number} timeout
   * @return {Promise<undefined>}
   */
  const wait = timeout => create((resolve, reject) => setTimeout(resolve, timeout));

  /**
   * Checks if an object is a promise using ducktyping.
   *
   * Promises are often polyfilled, so it makes sense to add some additional guarantees if the user of this
   * library has some insane environment where global Promise objects are overwritten.
   *
   * @param {any} p
   * @return {boolean}
   */
  const isPromise = p => p instanceof Promise || (p && p.then && p.catch && p.finally);

  /* eslint-env browser */

  const measure = performance.measure.bind(performance);
  const now = performance.now.bind(performance);
  const mark = performance.mark.bind(performance);

  /**
   * Testing framework with support for generating tests.
   *
   * ```js
   * // test.js template for creating a test executable
   * import { runTests } from 'lib0/testing'
   * import * as log from 'lib0/logging'
   * import * as mod1 from './mod1.test.js'
   * import * as mod2 from './mod2.test.js'

   * import { isBrowser, isNode } from 'lib0/environment.js'
   *
   * if (isBrowser) {
   *   // optional: if this is ran in the browser, attach a virtual console to the dom
   *   log.createVConsole(document.body)
   * }
   *
   * runTests({
   *  mod1,
   *  mod2,
   * }).then(success => {
   *   if (isNode) {
   *     process.exit(success ? 0 : 1)
   *   }
   * })
   * ```
   *
   * ```js
   * // mod1.test.js
   * /**
   *  * runTests automatically tests all exported functions that start with "test".
   *  * The name of the function should be in camelCase and is used for the logging output.
   *  *
   *  * @param {t.TestCase} tc
   *  *\/
   * export const testMyFirstTest = tc => {
   *   t.compare({ a: 4 }, { a: 4 }, 'objects are equal')
   * }
   * ```
   *
   * Now you can simply run `node test.js` to run your test or run test.js in the browser.
   *
   * @module testing
   */

  hasConf('extensive');

  /* c8 ignore next */
  const envSeed = hasParam('--seed') ? Number.parseInt(getParam('--seed', '0')) : null;

  class TestCase {
    /**
     * @param {string} moduleName
     * @param {string} testName
     */
    constructor (moduleName, testName) {
      /**
       * @type {string}
       */
      this.moduleName = moduleName;
      /**
       * @type {string}
       */
      this.testName = testName;
      this._seed = null;
      this._prng = null;
    }

    resetSeed () {
      this._seed = null;
      this._prng = null;
    }

    /**
     * @type {number}
     */
    /* c8 ignore next */
    get seed () {
      /* c8 ignore else */
      if (this._seed === null) {
        /* c8 ignore next */
        this._seed = envSeed === null ? uint32$1() : envSeed;
      }
      return this._seed
    }

    /**
     * A PRNG for this test case. Use only this PRNG for randomness to make the test case reproducible.
     *
     * @type {prng.PRNG}
     */
    get prng () {
      /* c8 ignore else */
      if (this._prng === null) {
        this._prng = create$1(this.seed);
      }
      return this._prng
    }
  }

  const repetitionTime = Number(getParam('--repetition-time', '50'));
  /* c8 ignore next */
  const testFilter = hasParam('--filter') ? getParam('--filter', '') : null;

  /* c8 ignore next */
  const testFilterRegExp = testFilter !== null ? new RegExp(testFilter) : new RegExp('.*');

  const repeatTestRegex = /^(repeat|repeating)\s/;

  /**
   * @param {string} moduleName
   * @param {string} name
   * @param {function(TestCase):void|Promise<any>} f
   * @param {number} i
   * @param {number} numberOfTests
   */
  const run = async (moduleName, name, f, i, numberOfTests) => {
    const uncamelized = fromCamelCase(name.slice(4), ' ');
    const filtered = !testFilterRegExp.test(`[${i + 1}/${numberOfTests}] ${moduleName}: ${uncamelized}`);
    /* c8 ignore next 3 */
    if (filtered) {
      return true
    }
    const tc = new TestCase(moduleName, name);
    const repeat = repeatTestRegex.test(uncamelized);
    const groupArgs = [GREY, `[${i + 1}/${numberOfTests}] `, PURPLE, `${moduleName}: `, BLUE, uncamelized];
    /* c8 ignore next 5 */
    if (testFilter === null) {
      groupCollapsed(...groupArgs);
    } else {
      group(...groupArgs);
    }
    const times = [];
    const start = now();
    let lastTime = start;
    /**
     * @type {any}
     */
    let err = null;
    mark(`${name}-start`);
    do {
      try {
        const p = f(tc);
        if (isPromise(p)) {
          await p;
        }
      } catch (_err) {
        err = _err;
      }
      const currTime = now();
      times.push(currTime - lastTime);
      lastTime = currTime;
      if (repeat && err === null && (lastTime - start) < repetitionTime) {
        tc.resetSeed();
      } else {
        break
      }
    } while (err === null && (lastTime - start) < repetitionTime)
    mark(`${name}-end`);
    /* c8 ignore next 3 */
    if (err !== null && err.constructor !== SkipError) {
      printError(err);
    }
    measure(name, `${name}-start`, `${name}-end`);
    groupEnd();
    const duration = lastTime - start;
    let success = true;
    times.sort((a, b) => a - b);
    /* c8 ignore next 3 */
    const againMessage = isBrowser
      ? `     - ${window.location.host + window.location.pathname}?filter=\\[${i + 1}/${tc._seed === null ? '' : `&seed=${tc._seed}`}`
      : `\nrepeat: npm run test -- --filter "\\[${i + 1}/" ${tc._seed === null ? '' : `--seed ${tc._seed}`}`;
    const timeInfo = (repeat && err === null)
      ? ` - ${times.length} repetitions in ${humanizeDuration(duration)} (best: ${humanizeDuration(times[0])}, worst: ${humanizeDuration(last(times))}, median: ${humanizeDuration(median(times))}, average: ${humanizeDuration(average(times))})`
      : ` in ${humanizeDuration(duration)}`;
    if (err !== null) {
      /* c8 ignore start */
      if (err.constructor === SkipError) {
        print(GREY, BOLD, 'Skipped: ', UNBOLD, uncamelized);
      } else {
        success = false;
        print(RED, BOLD, 'Failure: ', UNBOLD, UNCOLOR, uncamelized, GREY, timeInfo, againMessage);
      }
      /* c8 ignore stop */
    } else {
      print(GREEN, BOLD, 'Success: ', UNBOLD, UNCOLOR, uncamelized, GREY, timeInfo, againMessage);
    }
    return success
  };

  /**
   * Describe what you are currently testing. The message will be logged.
   *
   * ```js
   * export const testMyFirstTest = tc => {
   *   t.describe('crunching numbers', 'already crunched 4 numbers!') // the optional second argument can describe the state.
   * }
   * ```
   *
   * @param {string} description
   * @param {string} info
   */
  const describe = (description, info = '') => print(BLUE, description, ' ', GREY, info);

  /**
   * Describe the state of the current computation.
   * ```js
   * export const testMyFirstTest = tc => {
   *   t.info(already crunched 4 numbers!') // the optional second argument can describe the state.
   * }
   * ```
   *
   * @param {string} info
   */
  const info = info => describe('', info);

  /**
   * Measure the time that it takes to calculate something.
   *
   * ```js
   * export const testMyFirstTest = async tc => {
   *   t.measureTime('measurement', () => {
   *     heavyCalculation()
   *   })
   *   await t.groupAsync('async measurement', async () => {
   *     await heavyAsyncCalculation()
   *   })
   * }
   * ```
   *
   * @param {string} message
   * @param {function():void} f
   * @return {number} Returns a promise that resolves the measured duration to apply f
   */
  const measureTime = (message, f) => {
    let duration;
    const start = now();
    try {
      f();
    } finally {
      duration = now() - start;
      print(PURPLE, message, GREY, ` ${humanizeDuration(duration)}`);
    }
    return duration
  };

  /**
   * @template T
   * @param {Array<T>} as
   * @param {Array<T>} bs
   * @param {string} [m]
   * @return {boolean}
   */
  const compareArrays = (as, bs, m = 'Arrays match') => {
    if (as.length !== bs.length) {
      fail(m);
    }
    for (let i = 0; i < as.length; i++) {
      if (as[i] !== bs[i]) {
        fail(m);
      }
    }
    return true
  };

  /**
   * @param {string} a
   * @param {string} b
   * @param {string} [m]
   * @throws {TestError} Throws if tests fails
   */
  const compareStrings = (a, b, m = 'Strings match') => {
    if (a !== b) {
      const diff = simpleDiffString(a, b);
      print(GREY, a.slice(0, diff.index), RED, a.slice(diff.index, diff.remove), GREEN, diff.insert, GREY, a.slice(diff.index + diff.remove));
      fail(m);
    }
  };

  /**
   * @param {any} _constructor
   * @param {any} a
   * @param {any} b
   * @param {string} path
   * @throws {TestError}
   */
  const compareValues = (_constructor, a, b, path) => {
    if (a !== b) {
      fail(`Values ${stringify(a)} and ${stringify(b)} don't match (${path})`);
    }
    return true
  };

  /**
   * @param {string?} message
   * @param {string} reason
   * @param {string} path
   * @throws {TestError}
   */
  const _failMessage = (message, reason, path) => fail(
    message === null
      ? `${reason} ${path}`
      : `${message} (${reason}) ${path}`
  );

  /**
   * @param {any} a
   * @param {any} b
   * @param {string} path
   * @param {string?} message
   * @param {function(any,any,any,string,any):boolean} customCompare
   */
  const _compare = (a, b, path, message, customCompare) => {
    // we don't use assert here because we want to test all branches (istanbul errors if one branch is not tested)
    if (a == null || b == null) {
      return compareValues(null, a, b, path)
    }
    if (a.constructor !== b.constructor) {
      _failMessage(message, 'Constructors don\'t match', path);
    }
    let success = true;
    switch (a.constructor) {
      case ArrayBuffer:
        a = new Uint8Array(a);
        b = new Uint8Array(b);
      // eslint-disable-next-line no-fallthrough
      case Uint8Array: {
        if (a.byteLength !== b.byteLength) {
          _failMessage(message, 'ArrayBuffer lengths match', path);
        }
        for (let i = 0; success && i < a.length; i++) {
          success = success && a[i] === b[i];
        }
        break
      }
      case Set: {
        if (a.size !== b.size) {
          _failMessage(message, 'Sets have different number of attributes', path);
        }
        // @ts-ignore
        a.forEach(value => {
          if (!b.has(value)) {
            _failMessage(message, `b.${path} does have ${value}`, path);
          }
        });
        break
      }
      case Map: {
        if (a.size !== b.size) {
          _failMessage(message, 'Maps have different number of attributes', path);
        }
        // @ts-ignore
        a.forEach((value, key) => {
          if (!b.has(key)) {
            _failMessage(message, `Property ${path}["${key}"] does not exist on second argument`, path);
          }
          _compare(value, b.get(key), `${path}["${key}"]`, message, customCompare);
        });
        break
      }
      case Object:
        if (length$1(a) !== length$1(b)) {
          _failMessage(message, 'Objects have a different number of attributes', path);
        }
        forEach$1(a, (value, key) => {
          if (!hasProperty(b, key)) {
            _failMessage(message, `Property ${path} does not exist on second argument`, path);
          }
          _compare(value, b[key], `${path}["${key}"]`, message, customCompare);
        });
        break
      case Array:
        if (a.length !== b.length) {
          _failMessage(message, 'Arrays have a different number of attributes', path);
        }
        // @ts-ignore
        a.forEach((value, i) => _compare(value, b[i], `${path}[${i}]`, message, customCompare));
        break
      /* c8 ignore next 4 */
      default:
        if (!customCompare(a.constructor, a, b, path, compareValues)) {
          _failMessage(message, `Values ${stringify(a)} and ${stringify(b)} don't match`, path);
        }
    }
    assert(success, message);
    return true
  };

  /**
   * @template T
   * @param {T} a
   * @param {T} b
   * @param {string?} [message]
   * @param {function(any,T,T,string,any):boolean} [customCompare]
   */
  const compare$2 = (a, b, message = null, customCompare = compareValues) => _compare(a, b, 'obj', message, customCompare);

  /**
   * @template T
   * @param {T} property
   * @param {string?} [message]
   * @return {asserts property is NonNullable<T>}
   * @throws {TestError}
   */
  /* c8 ignore next */
  const assert = (property, message = null) => { property || fail(`Assertion failed${message !== null ? `: ${message}` : ''}`); };

  /**
   * @param {function():void} f
   * @throws {TestError}
   */
  const fails = f => {
    try {
      f();
    } catch (_err) {
      print(GREEN, '⇖ This Error was expected');
      return
    }
    fail('Expected this to fail');
  };

  /**
   * @param {Object<string, Object<string, function(TestCase):void|Promise<any>>>} tests
   */
  const runTests = async tests => {
    /**
     * @param {string} testname
     */
    const filterTest = testname => testname.startsWith('test') || testname.startsWith('benchmark');
    const numberOfTests = map$1(tests, mod => map$1(mod, (f, fname) => /* c8 ignore next */ f && filterTest(fname) ? 1 : 0).reduce(add, 0)).reduce(add, 0);
    let successfulTests = 0;
    let testnumber = 0;
    const start = now();
    for (const modName in tests) {
      const mod = tests[modName];
      for (const fname in mod) {
        const f = mod[fname];
        /* c8 ignore else */
        if (f && filterTest(fname)) {
          const repeatEachTest = 1;
          let success = true;
          for (let i = 0; success && i < repeatEachTest; i++) {
            success = await run(modName, fname, f, testnumber, numberOfTests);
          }
          testnumber++;
          /* c8 ignore else */
          if (success) {
            successfulTests++;
          }
        }
      }
    }
    const end = now();
    print('');
    const success = successfulTests === numberOfTests;
    /* c8 ignore start */
    if (success) {
      print(GREEN, BOLD, 'All tests successful!', GREY, UNBOLD, ` in ${humanizeDuration(end - start)}`);
      printImgBase64(nyanCatImage, 50);
    } else {
      const failedTests = numberOfTests - successfulTests;
      print(RED, BOLD, `> ${failedTests} test${failedTests > 1 ? 's' : ''} failed`);
    }
    /* c8 ignore stop */
    return success
  };

  class TestError extends Error {}

  /**
   * @param {string} reason
   * @throws {TestError}
   */
  const fail = reason => {
    print(RED, BOLD, 'X ', UNBOLD, reason);
    throw new TestError('Test Failed')
  };

  class SkipError extends Error {}

  /**
   * @param {boolean} cond If true, this tests will be skipped
   * @throws {SkipError}
   */
  const skip = (cond = true) => {
    if (cond) {
      throw new SkipError('skipping..')
    }
  };

  // eslint-disable-next-line
  const nyanCatImage = 'R0lGODlhjABMAPcAAMiSE0xMTEzMzUKJzjQ0NFsoKPc7//FM/9mH/z9x0HIiIoKCgmBHN+frGSkZLdDQ0LCwsDk71g0KCUzDdrQQEOFz/8yYdelmBdTiHFxcXDU2erR/mLrTHCgoKK5szBQUFNgSCTk6ymfpCB9VZS2Bl+cGBt2N8kWm0uDcGXhZRUvGq94NCFPhDiwsLGVlZTgqIPMDA1g3aEzS5D6xAURERDtG9JmBjJsZGWs2AD1W6Hp6eswyDeJ4CFNTU1LcEoJRmTMzSd14CTg5ser2GmDzBd17/xkZGUzMvoSMDiEhIfKruCwNAJaWlvRzA8kNDXDrCfi0pe1U/+GS6SZrAB4eHpZwVhoabsx9oiYmJt/TGHFxcYyMjOid0+Zl/0rF6j09PeRr/0zU9DxO6j+z0lXtBtp8qJhMAEssLGhoaPL/GVn/AAsWJ/9/AE3Z/zs9/3cAAOlf/+aa2RIyADo85uhh/0i84WtrazQ0UyMlmDMzPwUFBe16BTMmHau0E03X+g8pMEAoS1MBAf++kkzO8pBaqSZoe9uB/zE0BUQ3Sv///4WFheuiyzo880gzNDIyNissBNqF/8RiAOF2qG5ubj0vL1z6Avl5ASsgGkgUSy8vL/8n/z4zJy8lOv96uEssV1csAN5ZCDQ0Wz1a3tbEGHLeDdYKCg4PATE7PiMVFSoqU83eHEi43gUPAOZ8reGogeKU5dBBC8faHEez2lHYF4bQFMukFtl4CzY3kkzBVJfMGZkAAMfSFf27mP0t//g4/9R6Dfsy/1DRIUnSAPRD/0fMAFQ0Q+l7rnbaD0vEntCDD6rSGtO8GNpUCU/MK07LPNEfC7RaABUWWkgtOst+71v9AfD7GfDw8P19ATtA/NJpAONgB9yL+fm6jzIxMdnNGJxht1/2A9x//9jHGOSX3+5tBP27l35+fk5OTvZ9AhYgTjo0PUhGSDs9+LZjCFf2Aw0IDwcVAA8PD5lwg9+Q7YaChC0kJP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpGNEM2MUEyMzE0QTRFMTExOUQzRkE3QTBCRDNBMjdBQyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpERjQ0NEY0QkI2MTcxMUUxOUJEQkUzNUNGQTkwRTU2MiIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpERjQ0NEY0QUI2MTcxMUUxOUJEQkUzNUNGQTkwRTU2MiIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M1IFdpbmRvd3MiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo1OEE3RTIwRjcyQTlFMTExOTQ1QkY2QTU5QzVCQjJBOSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpGNEM2MUEyMzE0QTRFMTExOUQzRkE3QTBCRDNBMjdBQyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAkKABEAIf4jUmVzaXplZCBvbiBodHRwczovL2V6Z2lmLmNvbS9yZXNpemUALAAAAACMAEwAAAj/ACMIHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHEmypMmTKFOqXLkxEcuXMAm6jElTZaKZNXOOvOnyps6fInECHdpRKNGjSJMqXZrSKNOnC51CnUq1qtWrWLNC9GmQq9avYMOKHUs2aFmmUs8SlcC2rdu3cNWeTEG3rt27eBnIHflBj6C/gAMLHpxCz16QElJw+7tom+PHkCOP+8utiuHDHRP/5WICgefPkIYV8RAjxudtkwVZjqCnNeaMmheZqADm8+coHn5kyPBt2udFvKrc+7A7gITXFzV77hLF9ucYGRaYo+FhWhHPUKokobFgQYbjyCsq/3fuHHr3BV88HMBeZd357+HFpxBEvnz0961b3+8OP37DtgON5xxznpl3ng5aJKiFDud5B55/Ct3TQwY93COQgLZV0AUC39ihRYMggjhJDw9CeNA9kyygxT2G6TGfcxUY8pkeH3YHgTkMNrgFBJOYs8Akl5l4Yoor3mPki6BpUsGMNS6QiA772WjNPR8CSRAjWBI0B5ZYikGQGFwyMseVYWoZppcDhSkmmVyaySWaAqk5pkBbljnQlnNYEZ05fGaAJGieVQAMjd2ZY+R+X2Rgh5FVBhmBG5BGKumklFZq6aWYZqrpppTOIQQNNPjoJ31RbGibIRXQuIExrSSY4wI66P9gToJlGHOFo374MQg2vGLjRa65etErNoMA68ew2Bi7a6+/Aitsr8UCi6yywzYb7LDR5jotsMvyau0qJJCwGw0vdrEkeTRe0UknC7hQYwYMQrmAMZ2U4WgY+Lahbxt+4Ovvvm34i68fAAscBsD9+kvwvgYDHLDACAu8sL4NFwzxvgkP3EYhhYzw52dFhOPZD5Ns0Iok6PUwyaIuTJLBBwuUIckG8RCkhhrUHKHzEUTcfLM7Ox/hjs9qBH0E0ZUE3bPPQO9cCdFGIx300EwH/bTPUfuc9M5U30zEzhN87NkwcDyXgY/oxaP22vFQIR2JBT3xBDhEUyO33FffXMndT1D/QzTfdPts9915qwEO3377DHjdfBd++N2J47y44Ij7PMN85UgBxzCeQQKJbd9wFyKI6jgqUBqoD6G66qinvvoQ1bSexutDyF4N7bLTHnvruLd+++u5v76766vb3jvxM0wxnyBQxHEued8Y8cX01Fc/fQcHZaG97A1or30DsqPgfRbDpzF+FtyPD37r4ns/fDXnp+/9+qif//74KMj/fRp9TEIDAxb4ixIWQcACFrAMFkigAhPIAAmwyHQDYYMEJ0jBClrwghjMoAY3yMEOYhAdQaCBFtBAAD244oQoTKEKV5iCbizEHjCkoCVgCENLULAJNLTHNSZ4jRzaQ4Y5tOEE+X24Qwn2MIdApKEQJUhEHvowiTBkhh7QVqT8GOmKWHwgFiWghR5AkCA+DKMYx0jGMprxjGhMYw5XMEXvGAZF5piEhQyih1CZ4wt6kIARfORFhjwDBoCEQQkIUoJAwmAFBDEkDAhSCkMOciCFDCQiB6JIgoDAkYQ0JAgSaUhLYnIgFLjH9AggkHsQYHo1oyMVptcCgUjvCx34opAWkp/L1BIhtxxILmfJy17KxJcrSQswhykWYRLzI8Y8pjKXycxfNvOZMEkmNC0izWlSpJrWlAg2s8kQnkRgJt7kpja92ZNwivOcNdkmOqOyzoyos50IeSc850nPegIzIAAh+QQJCgARACwAAAAAjABMAAAI/wAjCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJcmKikihTZkx0UqXLlw5ZwpxJ02DLmjhz6twJkqVMnz55Ch1KtGhCmUaTYkSqtKnJm05rMl0aVefUqlhtFryatavXr2DDHoRKkKzYs2jTqpW61exani3jun0rlCvdrhLy6t3Lt+9dlykCCx5MuDCDvyU/6BHEuLHjx5BT6EEsUkIKbowXbdvMubPncYy5VZlM+aNlxlxMIFjNGtKwIggqDGO9DbSg0aVNpxC0yEQFMKxZRwmHoEiU4AgW8cKdu+Pp1V2OI6c9bdq2cLARQGEeIV7zjM+nT//3oEfPNDiztTOXoMf7d4vhxbP+ts6cORrfIK3efq+8FnN2kPbeRPEFF918NCywgBZafLNfFffEM4k5C0wi4IARFchaBV0gqGCFDX6zQQqZZPChhRgSuBtyFRiC3DcJfqgFDTTSYOKJF6boUIGQaFLBizF+KOSQKA7EyJEEzXHkkWIQJMaSjMxBEJSMJAllk0ZCKWWWS1q5JJYCUbllBEpC6SWTEehxzz0rBqdfbL1AEsONQ9b5oQ73DOTGnnz26eefgAYq6KCEFmoooCHccosdk5yzYhQdBmfIj3N++AAEdCqoiDU62LGAOXkK5Icfg2BjKjZejDqqF6diM4iqfrT/ig2spZ6aqqqsnvqqqrLS2uqtq7a666i9qlqrqbeeQEIGN2awYhc/ilepghAssM6JaCwAQQ8ufBpqBGGE28a4bfgR7rnktnFuuH6ku24Y6Zp7brvkvpuuuuvGuy6949rrbr7kmltHIS6Yw6AWjgoyXRHErTYnPRtskMEXdLrQgzlffKHDBjZ8q4Ya1Bwh8hFEfPyxOyMf4Y7JaqR8BMuVpFyyySiPXAnLLsOc8so0p3yzyTmbHPPIK8sxyYJr9tdmcMPAwdqcG3TSyQZ2fniF1N8+8QQ4LFOjtdY/f1zJ109QwzLZXJvs9ddhqwEO2WabjHbXZLf99tdxgzy32k8Y/70gK+5UMsNu5UiB3mqQvIkA1FJLfO0CFH8ajxZXd/JtGpgPobnmmGe++RDVdJ7G50OIXg3popMeeueod37656l/vrrnm5uOOgZIfJECBpr3sZsgUMQRLXLTEJJBxPRkkETGRmSS8T1a2CCPZANlYb3oDVhvfQOio6B9FrOn8X0W2H/Pfefeaz97NeOXr/35mI+//vcouJ9MO7V03gcDFjCmxCIADGAAr1CFG2mBWQhEoA600IMLseGBEIygBCdIwQpa8IIYzKAGMcgDaGTMFSAMoQhDaAE9HOyEKOyBewZijxZG0BItbKElItiEGNrjGhC8hg3t8UIbzhCCO8ThA+Z1aMMexvCHDwxiDndoRBk+8A03Slp/1CTFKpaHiv3JS9IMssMuevGLYAyjGMdIxjJ6EYoK0oNivmCfL+RIINAD0GT0YCI8rdAgz4CBHmFQAoKUYI8wWAFBAAkDgpQCkH0cyB/3KMiBEJIgIECkHwEJgkECEpKSVKQe39CCjH0gTUbIWAsQcg8CZMw78TDlF76lowxdUSBXfONArrhC9pSnlbjMpS7rssuZzKWXPQHKL4HZEWESMyXDPKZHkqnMZjrzLnZ5pjSnSc1qWmQuzLSmQrCpzW5685vfjCY4x0nOcprznB4JCAAh+QQJCgBIACwAAAAAjABMAAAI/wCRCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJcmGiRCVTqsyIcqXLlzBjypxJs6bNmzgPtjR4MqfPn0CDCh1KtKjNnkaTPtyptKlToEyfShUYderTqlaNnkSJNGvTrl6dYg1bdCzZs2jTqvUpoa3bt3DjrnWZoq7du3jzMphb8oMeQYADCx5MOIUeviIlpOAGeNG2x5AjSx4HmFuVw4g/KgbMxQSCz6AhDSuCoMIw0NsoC7qcWXMKQYtMVAADGnSUcAiKRKmNYBEv1q07bv7cZTfvz9OSfw5HGgEU1vHiBdc4/Djvb3refY5y2jlrPeCnY/+sbv1zjAzmzFGZBgnS5+f3PqTvIUG8RfK1i5vPsGDBpB8egPbcF5P0l0F99jV0z4ILCoQfaBV0sV9/C7jwwzcYblAFGhQemGBDX9BAAwH3HKbHa7xVYEht51FYoYgictghgh8iZMQ95vSnBYP3oBiaJhWwyJ+LRLrooUGlwKCkkgSVsCQMKxD0JAwEgfBkCU0+GeVAUxK0wpVZLrmlQF0O9OWSTpRY4ALp0dCjILy5Vxow72hR5J0U2oGZQPb06eefgAYq6KCEFmrooYj6CQMIICgAIw0unINiFBLWZkgFetjZnzU62EEkEw/QoIN/eyLh5zWoXmPJn5akek0TrLr/Cqirq/rZaqqw2ppqrX02QWusuAKr6p++7trnDtAka8o5NKDYRZDHZUohBBkMWaEWTEBwj52TlMrGt+CGK+645JZr7rnopquuuejU9YmPtRWBGwKZ2rCBDV98IeMCPaChRb7ybCBPqVkUnMbBaTRQcMENIJwGCgtnUY3DEWfhsMILN4wwxAtPfHA1EaNwccQaH8xxwR6nAfLCIiOMMcMI9wEvaMPA8VmmV3TSCZ4UGtNJGaV+PMTQQztMNNFGH+1wNUcPkbTSCDe9tNRRH51yGlQLDfXBR8ssSDlSwNFdezdrkfPOX7jAZjzcUrGAz0ATBA44lahhtxrUzD133XdX/6I3ONTcrcbf4Aiet96B9/134nb/zbfdh8/NuBp+I3535HQbvrjdM0zxmiBQxAFtbR74u8EGC3yRSb73qPMFAR8sYIM8KdCIBORH5H4EGYITofsR7gj++xGCV/I773f7rnvwdw9f/O9E9P7742o4f7c70AtOxhEzuEADAxYApsQi5JdPvgUb9udCteyzX2EAtiMRxvxt1N+GH/PP74f9beRPP//+CwP/8Je//dkvgPzrn/8G6D8D1g+BAFyg/QiYv1XQQAtoIIAeXMHBDnqQg1VQhxZGSMISjlCDBvGDHwaBjRZiwwsqVKEXXIiNQcTQDzWg4Q1Z6EIYxnCGLrRhDP9z6MId0tCHMqShEFVIxBYasYc3PIEecrSAHZUIPDzK4hV5pAcJ6IFBCHGDGMdIxjKa8YxoTKMa18jGNqJxDlNcQAYOc49JmGMS9ziIHr6Qni+Axwg56kGpDMKIQhIkAoUs5BwIIoZEMiICBHGkGAgyB0cuciCNTGRBJElJSzLSkZtM5CQHUslECuEe+SKAQO5BgHxJxyB6oEK+WiAQI+SrA4Os0UPAEx4k8DKXAvklQXQwR2DqMiVgOeZLkqnMlTCzmdCcy1aQwJVpRjMk06zmM6/pEbNwEyTb/OZHwinOjpCznNREJzaj4k11TiSZ7XSnPHESz3lW5JnntKc+94kTFnjyUyP1/OdSBErQghr0oB0JCAAh+QQFCgAjACwAAAAAjABMAAAI/wBHCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJkmCikihTWjw5giVLlTBjHkz0UmBNmThz6tzJs6fPkTRn3vxJtKjRo0iTbgxqUqlTiC5tPt05dOXUnkyval2YdatXg12/ih07lmZQs2bJql27NSzbqW7fOo0rN2nViBLy6t3Lt29dmfGqCB5MuLBhBvH+pmSQQpAgKJAjS54M2XEVBopLSmjseBGCz6BDi37lWFAVPZlHbnb8SvRnSL0qIKjQK/Q2y6hTh1z9ahuYKK4rGEJgSHboV1BO697d+HOFLq4/e/j2zTmYz8lR37u3vOPq6KGnEf/68mXaNjrAEWT/QL5b943fwX+OkWGBOT3TQie/92HBggwSvCeRHgQSKFB8osExzHz12UdDddhVQYM5/gEoYET3ZDBJBveghmBoRRhHn38LaKHFDyimYIcWJFp44UP39KCFDhno0WFzocERTmgjkrhhBkCy2GKALzq03Tk6LEADFffg+NowshU3jR1okGjllf658EWRMN7zhX80NCkIeLTpISSWaC4wSW4ElQLDm28SVAKcMKxAEJ0wEAQCnSXISaedA+FJ0Ap8+gknoAIJOhChcPYpUCAdUphBc8PAEZ2ZJCZC45UQWIPpmgTZI+qopJZq6qmopqrqqqy2eioMTtz/QwMNmTRXQRGXnqnIFw0u0EOVC9zDIqgDjXrNsddYQqolyF7TxLLNltqssqMyi+yz1SJLrahNTAvttd8mS2q32pJ6ATTQfCKma10YZ+YGV1wRJIkuzAgkvPKwOQIb/Pbr778AByzwwAQXbPDBBZvxSWNSbBMOrghEAR0CZl7RSSclJlkiheawaEwnZeibxchplJxGAyOP3IDJaaCQchbVsPxyFiyjnPLKJruccswlV/MyCjW/jHPJOo/Mcxo+pwy0yTarbHIfnL2ioGvvaGExxrzaJ+wCdvT3ccgE9TzE2GOzTDbZZp/NcjVnD5G22ia3vbbccZ99dBp0iw13yWdD/10aF5BERx899CzwhQTxxHMP4hL0R08GlxQEDjiVqGG5GtRMPnnll1eiOTjUXK7G5+CInrnmoXf+eeqWf8655adPzroanqN+eeyUm7665TNMsQlnUCgh/PDCu1JFD/6ZqPzyvhJgEOxHRH8EGaITIf0R7oh+/RGiV3I99ZdbL332l2/f/fVEVH/962qYf7k76ItOxhEzuABkBhbkr//++aeQyf0ADKDzDBKGArbhgG3wQwEL6AcEtmGBBnQgBMPgQAUusIEInKADHwjBCkIQgwfUoAQ7iEALMtAPa5iEfbTQIT0YgTxGKJAMvfSFDhDoHgT4AgE6hBA/+GEQ2AgiNvy84EMfekGI2BhEEf1QAyQuEYhCJGIRjyhEJRaxiUJ8IhKlaEQkWtGHWAyiFqO4RC/UIIUl2s4H9PAlw+lrBPHQQ4UCtDU7vJEgbsijHvfIxz768Y+ADKQgB0lIQGJjDdvZjkBstJ3EHCSRRLLRHQnCiEoSJAKVrOQcCCKGTDIiApTMpBgIMgdPbnIgncxkQTw5yoGUMpOnFEgqLRnKSrZSIK/U5Ag+kLjEDaSXCQGmQHzJpWIasyV3OaYyl8nMZi7nLsl0ZkagKc1qWvOa2JxLNLPJzW6+ZZvevAhdwrkStJCTI2gZ5zknos51shOc7oynPOdJz3ra857hDAgAOw==';

  /**
   * Observable class prototype.
   *
   * @module observable
   */

  /**
   * Handles named events.
   *
   * @template N
   */
  class Observable {
    constructor () {
      /**
       * Some desc.
       * @type {Map<N, any>}
       */
      this._observers = create$6();
    }

    /**
     * @param {N} name
     * @param {function} f
     */
    on (name, f) {
      setIfUndefined(this._observers, name, create$5).add(f);
    }

    /**
     * @param {N} name
     * @param {function} f
     */
    once (name, f) {
      /**
       * @param  {...any} args
       */
      const _f = (...args) => {
        this.off(name, _f);
        f(...args);
      };
      this.on(name, _f);
    }

    /**
     * @param {N} name
     * @param {function} f
     */
    off (name, f) {
      const observers = this._observers.get(name);
      if (observers !== undefined) {
        observers.delete(f);
        if (observers.size === 0) {
          this._observers.delete(name);
        }
      }
    }

    /**
     * Emit a named event. All registered event listeners that listen to the
     * specified name will receive the event.
     *
     * @todo This should catch exceptions
     *
     * @param {N} name The event name.
     * @param {Array<any>} args The arguments that are applied to the event listener.
     */
    emit (name, args) {
      // copy all listeners to an array first to make sure that no event is emitted to listeners that are subscribed while the event handler is called.
      return from((this._observers.get(name) || create$6()).values()).forEach(f => f(...args))
    }

    destroy () {
      this._observers = create$6();
    }
  }

  /**
   * This is an abstract interface that all Connectors should implement to keep them interchangeable.
   *
   * @note This interface is experimental and it is not advised to actually inherit this class.
   *       It just serves as typing information.
   *
   * @extends {Observable<any>}
   */
  class AbstractConnector extends Observable {
    /**
     * @param {Doc} ydoc
     * @param {any} awareness
     */
    constructor (ydoc, awareness) {
      super();
      this.doc = ydoc;
      this.awareness = awareness;
    }
  }

  class DeleteItem {
    /**
     * @param {number} clock
     * @param {number} len
     */
    constructor (clock, len) {
      /**
       * @type {number}
       */
      this.clock = clock;
      /**
       * @type {number}
       */
      this.len = len;
    }
  }

  /**
   * We no longer maintain a DeleteStore. DeleteSet is a temporary object that is created when needed.
   * - When created in a transaction, it must only be accessed after sorting, and merging
   *   - This DeleteSet is send to other clients
   * - We do not create a DeleteSet when we send a sync message. The DeleteSet message is created directly from StructStore
   * - We read a DeleteSet as part of a sync/update message. In this case the DeleteSet is already sorted and merged.
   */
  class DeleteSet {
    constructor () {
      /**
       * @type {Map<number,Array<DeleteItem>>}
       */
      this.clients = new Map();
    }
  }

  /**
   * Iterate over all structs that the DeleteSet gc's.
   *
   * @param {Transaction} transaction
   * @param {DeleteSet} ds
   * @param {function(GC|Item):void} f
   *
   * @function
   */
  const iterateDeletedStructs = (transaction, ds, f) =>
    ds.clients.forEach((deletes, clientid) => {
      const structs = /** @type {Array<GC|Item>} */ (transaction.doc.store.clients.get(clientid));
      for (let i = 0; i < deletes.length; i++) {
        const del = deletes[i];
        iterateStructs(transaction, structs, del.clock, del.len, f);
      }
    });

  /**
   * @param {Array<DeleteItem>} dis
   * @param {number} clock
   * @return {number|null}
   *
   * @private
   * @function
   */
  const findIndexDS = (dis, clock) => {
    let left = 0;
    let right = dis.length - 1;
    while (left <= right) {
      const midindex = floor((left + right) / 2);
      const mid = dis[midindex];
      const midclock = mid.clock;
      if (midclock <= clock) {
        if (clock < midclock + mid.len) {
          return midindex
        }
        left = midindex + 1;
      } else {
        right = midindex - 1;
      }
    }
    return null
  };

  /**
   * @param {DeleteSet} ds
   * @param {ID} id
   * @return {boolean}
   *
   * @private
   * @function
   */
  const isDeleted = (ds, id) => {
    const dis = ds.clients.get(id.client);
    return dis !== undefined && findIndexDS(dis, id.clock) !== null
  };

  /**
   * @param {DeleteSet} ds
   *
   * @private
   * @function
   */
  const sortAndMergeDeleteSet = ds => {
    ds.clients.forEach(dels => {
      dels.sort((a, b) => a.clock - b.clock);
      // merge items without filtering or splicing the array
      // i is the current pointer
      // j refers to the current insert position for the pointed item
      // try to merge dels[i] into dels[j-1] or set dels[j]=dels[i]
      let i, j;
      for (i = 1, j = 1; i < dels.length; i++) {
        const left = dels[j - 1];
        const right = dels[i];
        if (left.clock + left.len >= right.clock) {
          left.len = max(left.len, right.clock + right.len - left.clock);
        } else {
          if (j < i) {
            dels[j] = right;
          }
          j++;
        }
      }
      dels.length = j;
    });
  };

  /**
   * @param {Array<DeleteSet>} dss
   * @return {DeleteSet} A fresh DeleteSet
   */
  const mergeDeleteSets = dss => {
    const merged = new DeleteSet();
    for (let dssI = 0; dssI < dss.length; dssI++) {
      dss[dssI].clients.forEach((delsLeft, client) => {
        if (!merged.clients.has(client)) {
          // Write all missing keys from current ds and all following.
          // If merged already contains `client` current ds has already been added.
          /**
           * @type {Array<DeleteItem>}
           */
          const dels = delsLeft.slice();
          for (let i = dssI + 1; i < dss.length; i++) {
            appendTo(dels, dss[i].clients.get(client) || []);
          }
          merged.clients.set(client, dels);
        }
      });
    }
    sortAndMergeDeleteSet(merged);
    return merged
  };

  /**
   * @param {DeleteSet} ds
   * @param {number} client
   * @param {number} clock
   * @param {number} length
   *
   * @private
   * @function
   */
  const addToDeleteSet = (ds, client, clock, length) => {
    setIfUndefined(ds.clients, client, () => /** @type {Array<DeleteItem>} */ ([])).push(new DeleteItem(clock, length));
  };

  const createDeleteSet = () => new DeleteSet();

  /**
   * @param {StructStore} ss
   * @return {DeleteSet} Merged and sorted DeleteSet
   *
   * @private
   * @function
   */
  const createDeleteSetFromStructStore = ss => {
    const ds = createDeleteSet();
    ss.clients.forEach((structs, client) => {
      /**
       * @type {Array<DeleteItem>}
       */
      const dsitems = [];
      for (let i = 0; i < structs.length; i++) {
        const struct = structs[i];
        if (struct.deleted) {
          const clock = struct.id.clock;
          let len = struct.length;
          if (i + 1 < structs.length) {
            for (let next = structs[i + 1]; i + 1 < structs.length && next.deleted; next = structs[++i + 1]) {
              len += next.length;
            }
          }
          dsitems.push(new DeleteItem(clock, len));
        }
      }
      if (dsitems.length > 0) {
        ds.clients.set(client, dsitems);
      }
    });
    return ds
  };

  /**
   * @param {DSEncoderV1 | DSEncoderV2} encoder
   * @param {DeleteSet} ds
   *
   * @private
   * @function
   */
  const writeDeleteSet = (encoder, ds) => {
    writeVarUint(encoder.restEncoder, ds.clients.size);

    // Ensure that the delete set is written in a deterministic order
    from(ds.clients.entries())
      .sort((a, b) => b[0] - a[0])
      .forEach(([client, dsitems]) => {
        encoder.resetDsCurVal();
        writeVarUint(encoder.restEncoder, client);
        const len = dsitems.length;
        writeVarUint(encoder.restEncoder, len);
        for (let i = 0; i < len; i++) {
          const item = dsitems[i];
          encoder.writeDsClock(item.clock);
          encoder.writeDsLen(item.len);
        }
      });
  };

  /**
   * @param {DSDecoderV1 | DSDecoderV2} decoder
   * @return {DeleteSet}
   *
   * @private
   * @function
   */
  const readDeleteSet = decoder => {
    const ds = new DeleteSet();
    const numClients = readVarUint(decoder.restDecoder);
    for (let i = 0; i < numClients; i++) {
      decoder.resetDsCurVal();
      const client = readVarUint(decoder.restDecoder);
      const numberOfDeletes = readVarUint(decoder.restDecoder);
      if (numberOfDeletes > 0) {
        const dsField = setIfUndefined(ds.clients, client, () => /** @type {Array<DeleteItem>} */ ([]));
        for (let i = 0; i < numberOfDeletes; i++) {
          dsField.push(new DeleteItem(decoder.readDsClock(), decoder.readDsLen()));
        }
      }
    }
    return ds
  };

  /**
   * @todo YDecoder also contains references to String and other Decoders. Would make sense to exchange YDecoder.toUint8Array for YDecoder.DsToUint8Array()..
   */

  /**
   * @param {DSDecoderV1 | DSDecoderV2} decoder
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @return {Uint8Array|null} Returns a v2 update containing all deletes that couldn't be applied yet; or null if all deletes were applied successfully.
   *
   * @private
   * @function
   */
  const readAndApplyDeleteSet = (decoder, transaction, store) => {
    const unappliedDS = new DeleteSet();
    const numClients = readVarUint(decoder.restDecoder);
    for (let i = 0; i < numClients; i++) {
      decoder.resetDsCurVal();
      const client = readVarUint(decoder.restDecoder);
      const numberOfDeletes = readVarUint(decoder.restDecoder);
      const structs = store.clients.get(client) || [];
      const state = getState(store, client);
      for (let i = 0; i < numberOfDeletes; i++) {
        const clock = decoder.readDsClock();
        const clockEnd = clock + decoder.readDsLen();
        if (clock < state) {
          if (state < clockEnd) {
            addToDeleteSet(unappliedDS, client, state, clockEnd - state);
          }
          let index = findIndexSS(structs, clock);
          /**
           * We can ignore the case of GC and Delete structs, because we are going to skip them
           * @type {Item}
           */
          // @ts-ignore
          let struct = structs[index];
          // split the first item if necessary
          if (!struct.deleted && struct.id.clock < clock) {
            structs.splice(index + 1, 0, splitItem(transaction, struct, clock - struct.id.clock));
            index++; // increase we now want to use the next struct
          }
          while (index < structs.length) {
            // @ts-ignore
            struct = structs[index++];
            if (struct.id.clock < clockEnd) {
              if (!struct.deleted) {
                if (clockEnd < struct.id.clock + struct.length) {
                  structs.splice(index, 0, splitItem(transaction, struct, clockEnd - struct.id.clock));
                }
                struct.delete(transaction);
              }
            } else {
              break
            }
          }
        } else {
          addToDeleteSet(unappliedDS, client, clock, clockEnd - clock);
        }
      }
    }
    if (unappliedDS.clients.size > 0) {
      const ds = new UpdateEncoderV2();
      writeVarUint(ds.restEncoder, 0); // encode 0 structs
      writeDeleteSet(ds, unappliedDS);
      return ds.toUint8Array()
    }
    return null
  };

  /**
   * @module Y
   */

  const generateNewClientId = uint32$1;

  /**
   * @typedef {Object} DocOpts
   * @property {boolean} [DocOpts.gc=true] Disable garbage collection (default: gc=true)
   * @property {function(Item):boolean} [DocOpts.gcFilter] Will be called before an Item is garbage collected. Return false to keep the Item.
   * @property {string} [DocOpts.guid] Define a globally unique identifier for this document
   * @property {string | null} [DocOpts.collectionid] Associate this document with a collection. This only plays a role if your provider has a concept of collection.
   * @property {any} [DocOpts.meta] Any kind of meta information you want to associate with this document. If this is a subdocument, remote peers will store the meta information as well.
   * @property {boolean} [DocOpts.autoLoad] If a subdocument, automatically load document. If this is a subdocument, remote peers will load the document as well automatically.
   * @property {boolean} [DocOpts.shouldLoad] Whether the document should be synced by the provider now. This is toggled to true when you call ydoc.load()
   */

  /**
   * A Yjs instance handles the state of shared data.
   * @extends Observable<string>
   */
  class Doc extends Observable {
    /**
     * @param {DocOpts} opts configuration
     */
    constructor ({ guid = uuidv4(), collectionid = null, gc = true, gcFilter = () => true, meta = null, autoLoad = false, shouldLoad = true } = {}) {
      super();
      this.gc = gc;
      this.gcFilter = gcFilter;
      this.clientID = generateNewClientId();
      this.guid = guid;
      this.collectionid = collectionid;
      /**
       * @type {Map<string, AbstractType<YEvent<any>>>}
       */
      this.share = new Map();
      this.store = new StructStore();
      /**
       * @type {Transaction | null}
       */
      this._transaction = null;
      /**
       * @type {Array<Transaction>}
       */
      this._transactionCleanups = [];
      /**
       * @type {Set<Doc>}
       */
      this.subdocs = new Set();
      /**
       * If this document is a subdocument - a document integrated into another document - then _item is defined.
       * @type {Item?}
       */
      this._item = null;
      this.shouldLoad = shouldLoad;
      this.autoLoad = autoLoad;
      this.meta = meta;
      /**
       * This is set to true when the persistence provider loaded the document from the database or when the `sync` event fires.
       * Note that not all providers implement this feature. Provider authors are encouraged to fire the `load` event when the doc content is loaded from the database.
       *
       * @type {boolean}
       */
      this.isLoaded = false;
      /**
       * This is set to true when the connection provider has successfully synced with a backend.
       * Note that when using peer-to-peer providers this event may not provide very useful.
       * Also note that not all providers implement this feature. Provider authors are encouraged to fire
       * the `sync` event when the doc has been synced (with `true` as a parameter) or if connection is
       * lost (with false as a parameter).
       */
      this.isSynced = false;
      /**
       * Promise that resolves once the document has been loaded from a presistence provider.
       */
      this.whenLoaded = create(resolve => {
        this.on('load', () => {
          this.isLoaded = true;
          resolve(this);
        });
      });
      const provideSyncedPromise = () => create(resolve => {
        /**
         * @param {boolean} isSynced
         */
        const eventHandler = (isSynced) => {
          if (isSynced === undefined || isSynced === true) {
            this.off('sync', eventHandler);
            resolve();
          }
        };
        this.on('sync', eventHandler);
      });
      this.on('sync', isSynced => {
        if (isSynced === false && this.isSynced) {
          this.whenSynced = provideSyncedPromise();
        }
        this.isSynced = isSynced === undefined || isSynced === true;
        if (!this.isLoaded) {
          this.emit('load', []);
        }
      });
      /**
       * Promise that resolves once the document has been synced with a backend.
       * This promise is recreated when the connection is lost.
       * Note the documentation about the `isSynced` property.
       */
      this.whenSynced = provideSyncedPromise();
    }

    /**
     * Notify the parent document that you request to load data into this subdocument (if it is a subdocument).
     *
     * `load()` might be used in the future to request any provider to load the most current data.
     *
     * It is safe to call `load()` multiple times.
     */
    load () {
      const item = this._item;
      if (item !== null && !this.shouldLoad) {
        transact(/** @type {any} */ (item.parent).doc, transaction => {
          transaction.subdocsLoaded.add(this);
        }, null, true);
      }
      this.shouldLoad = true;
    }

    getSubdocs () {
      return this.subdocs
    }

    getSubdocGuids () {
      return new Set(from(this.subdocs).map(doc => doc.guid))
    }

    /**
     * Changes that happen inside of a transaction are bundled. This means that
     * the observer fires _after_ the transaction is finished and that all changes
     * that happened inside of the transaction are sent as one message to the
     * other peers.
     *
     * @template T
     * @param {function(Transaction):T} f The function that should be executed as a transaction
     * @param {any} [origin] Origin of who started the transaction. Will be stored on transaction.origin
     * @return T
     *
     * @public
     */
    transact (f, origin = null) {
      return transact(this, f, origin)
    }

    /**
     * Define a shared data type.
     *
     * Multiple calls of `y.get(name, TypeConstructor)` yield the same result
     * and do not overwrite each other. I.e.
     * `y.define(name, Y.Array) === y.define(name, Y.Array)`
     *
     * After this method is called, the type is also available on `y.share.get(name)`.
     *
     * *Best Practices:*
     * Define all types right after the Yjs instance is created and store them in a separate object.
     * Also use the typed methods `getText(name)`, `getArray(name)`, ..
     *
     * @example
     *   const y = new Y(..)
     *   const appState = {
     *     document: y.getText('document')
     *     comments: y.getArray('comments')
     *   }
     *
     * @param {string} name
     * @param {Function} TypeConstructor The constructor of the type definition. E.g. Y.Text, Y.Array, Y.Map, ...
     * @return {AbstractType<any>} The created type. Constructed with TypeConstructor
     *
     * @public
     */
    get (name, TypeConstructor = AbstractType) {
      const type = setIfUndefined(this.share, name, () => {
        // @ts-ignore
        const t = new TypeConstructor();
        t._integrate(this, null);
        return t
      });
      const Constr = type.constructor;
      if (TypeConstructor !== AbstractType && Constr !== TypeConstructor) {
        if (Constr === AbstractType) {
          // @ts-ignore
          const t = new TypeConstructor();
          t._map = type._map;
          type._map.forEach(/** @param {Item?} n */ n => {
            for (; n !== null; n = n.left) {
              // @ts-ignore
              n.parent = t;
            }
          });
          t._start = type._start;
          for (let n = t._start; n !== null; n = n.right) {
            n.parent = t;
          }
          t._length = type._length;
          this.share.set(name, t);
          t._integrate(this, null);
          return t
        } else {
          throw new Error(`Type with the name ${name} has already been defined with a different constructor`)
        }
      }
      return type
    }

    /**
     * @template T
     * @param {string} [name]
     * @return {YArray<T>}
     *
     * @public
     */
    getArray (name = '') {
      // @ts-ignore
      return this.get(name, YArray)
    }

    /**
     * @param {string} [name]
     * @return {YText}
     *
     * @public
     */
    getText (name = '') {
      // @ts-ignore
      return this.get(name, YText)
    }

    /**
     * @template T
     * @param {string} [name]
     * @return {YMap<T>}
     *
     * @public
     */
    getMap (name = '') {
      // @ts-ignore
      return this.get(name, YMap)
    }

    /**
     * @param {string} [name]
     * @return {YXmlFragment}
     *
     * @public
     */
    getXmlFragment (name = '') {
      // @ts-ignore
      return this.get(name, YXmlFragment)
    }

    /**
     * Converts the entire document into a js object, recursively traversing each yjs type
     * Doesn't log types that have not been defined (using ydoc.getType(..)).
     *
     * @deprecated Do not use this method and rather call toJSON directly on the shared types.
     *
     * @return {Object<string, any>}
     */
    toJSON () {
      /**
       * @type {Object<string, any>}
       */
      const doc = {};

      this.share.forEach((value, key) => {
        doc[key] = value.toJSON();
      });

      return doc
    }

    /**
     * Emit `destroy` event and unregister all event handlers.
     */
    destroy () {
      from(this.subdocs).forEach(subdoc => subdoc.destroy());
      const item = this._item;
      if (item !== null) {
        this._item = null;
        const content = /** @type {ContentDoc} */ (item.content);
        content.doc = new Doc({ guid: this.guid, ...content.opts, shouldLoad: false });
        content.doc._item = item;
        transact(/** @type {any} */ (item).parent.doc, transaction => {
          const doc = content.doc;
          if (!item.deleted) {
            transaction.subdocsAdded.add(doc);
          }
          transaction.subdocsRemoved.add(this);
        }, null, true);
      }
      this.emit('destroyed', [true]);
      this.emit('destroy', [this]);
      super.destroy();
    }

    /**
     * @param {string} eventName
     * @param {function(...any):any} f
     */
    on (eventName, f) {
      super.on(eventName, f);
    }

    /**
     * @param {string} eventName
     * @param {function} f
     */
    off (eventName, f) {
      super.off(eventName, f);
    }
  }

  class DSDecoderV1 {
    /**
     * @param {decoding.Decoder} decoder
     */
    constructor (decoder) {
      this.restDecoder = decoder;
    }

    resetDsCurVal () {
      // nop
    }

    /**
     * @return {number}
     */
    readDsClock () {
      return readVarUint(this.restDecoder)
    }

    /**
     * @return {number}
     */
    readDsLen () {
      return readVarUint(this.restDecoder)
    }
  }

  class UpdateDecoderV1 extends DSDecoderV1 {
    /**
     * @return {ID}
     */
    readLeftID () {
      return createID(readVarUint(this.restDecoder), readVarUint(this.restDecoder))
    }

    /**
     * @return {ID}
     */
    readRightID () {
      return createID(readVarUint(this.restDecoder), readVarUint(this.restDecoder))
    }

    /**
     * Read the next client id.
     * Use this in favor of readID whenever possible to reduce the number of objects created.
     */
    readClient () {
      return readVarUint(this.restDecoder)
    }

    /**
     * @return {number} info An unsigned 8-bit integer
     */
    readInfo () {
      return readUint8(this.restDecoder)
    }

    /**
     * @return {string}
     */
    readString () {
      return readVarString(this.restDecoder)
    }

    /**
     * @return {boolean} isKey
     */
    readParentInfo () {
      return readVarUint(this.restDecoder) === 1
    }

    /**
     * @return {number} info An unsigned 8-bit integer
     */
    readTypeRef () {
      return readVarUint(this.restDecoder)
    }

    /**
     * Write len of a struct - well suited for Opt RLE encoder.
     *
     * @return {number} len
     */
    readLen () {
      return readVarUint(this.restDecoder)
    }

    /**
     * @return {any}
     */
    readAny () {
      return readAny(this.restDecoder)
    }

    /**
     * @return {Uint8Array}
     */
    readBuf () {
      return copyUint8Array(readVarUint8Array(this.restDecoder))
    }

    /**
     * Legacy implementation uses JSON parse. We use any-decoding in v2.
     *
     * @return {any}
     */
    readJSON () {
      return JSON.parse(readVarString(this.restDecoder))
    }

    /**
     * @return {string}
     */
    readKey () {
      return readVarString(this.restDecoder)
    }
  }

  class DSDecoderV2 {
    /**
     * @param {decoding.Decoder} decoder
     */
    constructor (decoder) {
      /**
       * @private
       */
      this.dsCurrVal = 0;
      this.restDecoder = decoder;
    }

    resetDsCurVal () {
      this.dsCurrVal = 0;
    }

    /**
     * @return {number}
     */
    readDsClock () {
      this.dsCurrVal += readVarUint(this.restDecoder);
      return this.dsCurrVal
    }

    /**
     * @return {number}
     */
    readDsLen () {
      const diff = readVarUint(this.restDecoder) + 1;
      this.dsCurrVal += diff;
      return diff
    }
  }

  class UpdateDecoderV2 extends DSDecoderV2 {
    /**
     * @param {decoding.Decoder} decoder
     */
    constructor (decoder) {
      super(decoder);
      /**
       * List of cached keys. If the keys[id] does not exist, we read a new key
       * from stringEncoder and push it to keys.
       *
       * @type {Array<string>}
       */
      this.keys = [];
      readVarUint(decoder); // read feature flag - currently unused
      this.keyClockDecoder = new IntDiffOptRleDecoder(readVarUint8Array(decoder));
      this.clientDecoder = new UintOptRleDecoder(readVarUint8Array(decoder));
      this.leftClockDecoder = new IntDiffOptRleDecoder(readVarUint8Array(decoder));
      this.rightClockDecoder = new IntDiffOptRleDecoder(readVarUint8Array(decoder));
      this.infoDecoder = new RleDecoder(readVarUint8Array(decoder), readUint8);
      this.stringDecoder = new StringDecoder(readVarUint8Array(decoder));
      this.parentInfoDecoder = new RleDecoder(readVarUint8Array(decoder), readUint8);
      this.typeRefDecoder = new UintOptRleDecoder(readVarUint8Array(decoder));
      this.lenDecoder = new UintOptRleDecoder(readVarUint8Array(decoder));
    }

    /**
     * @return {ID}
     */
    readLeftID () {
      return new ID(this.clientDecoder.read(), this.leftClockDecoder.read())
    }

    /**
     * @return {ID}
     */
    readRightID () {
      return new ID(this.clientDecoder.read(), this.rightClockDecoder.read())
    }

    /**
     * Read the next client id.
     * Use this in favor of readID whenever possible to reduce the number of objects created.
     */
    readClient () {
      return this.clientDecoder.read()
    }

    /**
     * @return {number} info An unsigned 8-bit integer
     */
    readInfo () {
      return /** @type {number} */ (this.infoDecoder.read())
    }

    /**
     * @return {string}
     */
    readString () {
      return this.stringDecoder.read()
    }

    /**
     * @return {boolean}
     */
    readParentInfo () {
      return this.parentInfoDecoder.read() === 1
    }

    /**
     * @return {number} An unsigned 8-bit integer
     */
    readTypeRef () {
      return this.typeRefDecoder.read()
    }

    /**
     * Write len of a struct - well suited for Opt RLE encoder.
     *
     * @return {number}
     */
    readLen () {
      return this.lenDecoder.read()
    }

    /**
     * @return {any}
     */
    readAny () {
      return readAny(this.restDecoder)
    }

    /**
     * @return {Uint8Array}
     */
    readBuf () {
      return readVarUint8Array(this.restDecoder)
    }

    /**
     * This is mainly here for legacy purposes.
     *
     * Initial we incoded objects using JSON. Now we use the much faster lib0/any-encoder. This method mainly exists for legacy purposes for the v1 encoder.
     *
     * @return {any}
     */
    readJSON () {
      return readAny(this.restDecoder)
    }

    /**
     * @return {string}
     */
    readKey () {
      const keyClock = this.keyClockDecoder.read();
      if (keyClock < this.keys.length) {
        return this.keys[keyClock]
      } else {
        const key = this.stringDecoder.read();
        this.keys.push(key);
        return key
      }
    }
  }

  class DSEncoderV1 {
    constructor () {
      this.restEncoder = createEncoder();
    }

    toUint8Array () {
      return toUint8Array(this.restEncoder)
    }

    resetDsCurVal () {
      // nop
    }

    /**
     * @param {number} clock
     */
    writeDsClock (clock) {
      writeVarUint(this.restEncoder, clock);
    }

    /**
     * @param {number} len
     */
    writeDsLen (len) {
      writeVarUint(this.restEncoder, len);
    }
  }

  class UpdateEncoderV1 extends DSEncoderV1 {
    /**
     * @param {ID} id
     */
    writeLeftID (id) {
      writeVarUint(this.restEncoder, id.client);
      writeVarUint(this.restEncoder, id.clock);
    }

    /**
     * @param {ID} id
     */
    writeRightID (id) {
      writeVarUint(this.restEncoder, id.client);
      writeVarUint(this.restEncoder, id.clock);
    }

    /**
     * Use writeClient and writeClock instead of writeID if possible.
     * @param {number} client
     */
    writeClient (client) {
      writeVarUint(this.restEncoder, client);
    }

    /**
     * @param {number} info An unsigned 8-bit integer
     */
    writeInfo (info) {
      writeUint8(this.restEncoder, info);
    }

    /**
     * @param {string} s
     */
    writeString (s) {
      writeVarString(this.restEncoder, s);
    }

    /**
     * @param {boolean} isYKey
     */
    writeParentInfo (isYKey) {
      writeVarUint(this.restEncoder, isYKey ? 1 : 0);
    }

    /**
     * @param {number} info An unsigned 8-bit integer
     */
    writeTypeRef (info) {
      writeVarUint(this.restEncoder, info);
    }

    /**
     * Write len of a struct - well suited for Opt RLE encoder.
     *
     * @param {number} len
     */
    writeLen (len) {
      writeVarUint(this.restEncoder, len);
    }

    /**
     * @param {any} any
     */
    writeAny (any) {
      writeAny(this.restEncoder, any);
    }

    /**
     * @param {Uint8Array} buf
     */
    writeBuf (buf) {
      writeVarUint8Array(this.restEncoder, buf);
    }

    /**
     * @param {any} embed
     */
    writeJSON (embed) {
      writeVarString(this.restEncoder, JSON.stringify(embed));
    }

    /**
     * @param {string} key
     */
    writeKey (key) {
      writeVarString(this.restEncoder, key);
    }
  }

  class DSEncoderV2 {
    constructor () {
      this.restEncoder = createEncoder(); // encodes all the rest / non-optimized
      this.dsCurrVal = 0;
    }

    toUint8Array () {
      return toUint8Array(this.restEncoder)
    }

    resetDsCurVal () {
      this.dsCurrVal = 0;
    }

    /**
     * @param {number} clock
     */
    writeDsClock (clock) {
      const diff = clock - this.dsCurrVal;
      this.dsCurrVal = clock;
      writeVarUint(this.restEncoder, diff);
    }

    /**
     * @param {number} len
     */
    writeDsLen (len) {
      if (len === 0) {
        unexpectedCase();
      }
      writeVarUint(this.restEncoder, len - 1);
      this.dsCurrVal += len;
    }
  }

  class UpdateEncoderV2 extends DSEncoderV2 {
    constructor () {
      super();
      /**
       * @type {Map<string,number>}
       */
      this.keyMap = new Map();
      /**
       * Refers to the next uniqe key-identifier to me used.
       * See writeKey method for more information.
       *
       * @type {number}
       */
      this.keyClock = 0;
      this.keyClockEncoder = new IntDiffOptRleEncoder();
      this.clientEncoder = new UintOptRleEncoder();
      this.leftClockEncoder = new IntDiffOptRleEncoder();
      this.rightClockEncoder = new IntDiffOptRleEncoder();
      this.infoEncoder = new RleEncoder(writeUint8);
      this.stringEncoder = new StringEncoder();
      this.parentInfoEncoder = new RleEncoder(writeUint8);
      this.typeRefEncoder = new UintOptRleEncoder();
      this.lenEncoder = new UintOptRleEncoder();
    }

    toUint8Array () {
      const encoder = createEncoder();
      writeVarUint(encoder, 0); // this is a feature flag that we might use in the future
      writeVarUint8Array(encoder, this.keyClockEncoder.toUint8Array());
      writeVarUint8Array(encoder, this.clientEncoder.toUint8Array());
      writeVarUint8Array(encoder, this.leftClockEncoder.toUint8Array());
      writeVarUint8Array(encoder, this.rightClockEncoder.toUint8Array());
      writeVarUint8Array(encoder, toUint8Array(this.infoEncoder));
      writeVarUint8Array(encoder, this.stringEncoder.toUint8Array());
      writeVarUint8Array(encoder, toUint8Array(this.parentInfoEncoder));
      writeVarUint8Array(encoder, this.typeRefEncoder.toUint8Array());
      writeVarUint8Array(encoder, this.lenEncoder.toUint8Array());
      // @note The rest encoder is appended! (note the missing var)
      writeUint8Array(encoder, toUint8Array(this.restEncoder));
      return toUint8Array(encoder)
    }

    /**
     * @param {ID} id
     */
    writeLeftID (id) {
      this.clientEncoder.write(id.client);
      this.leftClockEncoder.write(id.clock);
    }

    /**
     * @param {ID} id
     */
    writeRightID (id) {
      this.clientEncoder.write(id.client);
      this.rightClockEncoder.write(id.clock);
    }

    /**
     * @param {number} client
     */
    writeClient (client) {
      this.clientEncoder.write(client);
    }

    /**
     * @param {number} info An unsigned 8-bit integer
     */
    writeInfo (info) {
      this.infoEncoder.write(info);
    }

    /**
     * @param {string} s
     */
    writeString (s) {
      this.stringEncoder.write(s);
    }

    /**
     * @param {boolean} isYKey
     */
    writeParentInfo (isYKey) {
      this.parentInfoEncoder.write(isYKey ? 1 : 0);
    }

    /**
     * @param {number} info An unsigned 8-bit integer
     */
    writeTypeRef (info) {
      this.typeRefEncoder.write(info);
    }

    /**
     * Write len of a struct - well suited for Opt RLE encoder.
     *
     * @param {number} len
     */
    writeLen (len) {
      this.lenEncoder.write(len);
    }

    /**
     * @param {any} any
     */
    writeAny (any) {
      writeAny(this.restEncoder, any);
    }

    /**
     * @param {Uint8Array} buf
     */
    writeBuf (buf) {
      writeVarUint8Array(this.restEncoder, buf);
    }

    /**
     * This is mainly here for legacy purposes.
     *
     * Initial we incoded objects using JSON. Now we use the much faster lib0/any-encoder. This method mainly exists for legacy purposes for the v1 encoder.
     *
     * @param {any} embed
     */
    writeJSON (embed) {
      writeAny(this.restEncoder, embed);
    }

    /**
     * Property keys are often reused. For example, in y-prosemirror the key `bold` might
     * occur very often. For a 3d application, the key `position` might occur very often.
     *
     * We cache these keys in a Map and refer to them via a unique number.
     *
     * @param {string} key
     */
    writeKey (key) {
      const clock = this.keyMap.get(key);
      if (clock === undefined) {
        /**
         * @todo uncomment to introduce this feature finally
         *
         * Background. The ContentFormat object was always encoded using writeKey, but the decoder used to use readString.
         * Furthermore, I forgot to set the keyclock. So everything was working fine.
         *
         * However, this feature here is basically useless as it is not being used (it actually only consumes extra memory).
         *
         * I don't know yet how to reintroduce this feature..
         *
         * Older clients won't be able to read updates when we reintroduce this feature. So this should probably be done using a flag.
         *
         */
        // this.keyMap.set(key, this.keyClock)
        this.keyClockEncoder.write(this.keyClock++);
        this.stringEncoder.write(key);
      } else {
        this.keyClockEncoder.write(clock);
      }
    }
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {Array<GC|Item>} structs All structs by `client`
   * @param {number} client
   * @param {number} clock write structs starting with `ID(client,clock)`
   *
   * @function
   */
  const writeStructs = (encoder, structs, client, clock) => {
    // write first id
    clock = max(clock, structs[0].id.clock); // make sure the first id exists
    const startNewStructs = findIndexSS(structs, clock);
    // write # encoded structs
    writeVarUint(encoder.restEncoder, structs.length - startNewStructs);
    encoder.writeClient(client);
    writeVarUint(encoder.restEncoder, clock);
    const firstStruct = structs[startNewStructs];
    // write first struct with an offset
    firstStruct.write(encoder, clock - firstStruct.id.clock);
    for (let i = startNewStructs + 1; i < structs.length; i++) {
      structs[i].write(encoder, 0);
    }
  };

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {StructStore} store
   * @param {Map<number,number>} _sm
   *
   * @private
   * @function
   */
  const writeClientsStructs = (encoder, store, _sm) => {
    // we filter all valid _sm entries into sm
    const sm = new Map();
    _sm.forEach((clock, client) => {
      // only write if new structs are available
      if (getState(store, client) > clock) {
        sm.set(client, clock);
      }
    });
    getStateVector(store).forEach((clock, client) => {
      if (!_sm.has(client)) {
        sm.set(client, 0);
      }
    });
    // write # states that were updated
    writeVarUint(encoder.restEncoder, sm.size);
    // Write items with higher client ids first
    // This heavily improves the conflict algorithm.
    from(sm.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
      // @ts-ignore
      writeStructs(encoder, store.clients.get(client), client, clock);
    });
  };

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder The decoder object to read data from.
   * @param {Doc} doc
   * @return {Map<number, { i: number, refs: Array<Item | GC> }>}
   *
   * @private
   * @function
   */
  const readClientsStructRefs = (decoder, doc) => {
    /**
     * @type {Map<number, { i: number, refs: Array<Item | GC> }>}
     */
    const clientRefs = create$6();
    const numOfStateUpdates = readVarUint(decoder.restDecoder);
    for (let i = 0; i < numOfStateUpdates; i++) {
      const numberOfStructs = readVarUint(decoder.restDecoder);
      /**
       * @type {Array<GC|Item>}
       */
      const refs = new Array(numberOfStructs);
      const client = decoder.readClient();
      let clock = readVarUint(decoder.restDecoder);
      // const start = performance.now()
      clientRefs.set(client, { i: 0, refs });
      for (let i = 0; i < numberOfStructs; i++) {
        const info = decoder.readInfo();
        switch (BITS5 & info) {
          case 0: { // GC
            const len = decoder.readLen();
            refs[i] = new GC(createID(client, clock), len);
            clock += len;
            break
          }
          case 10: { // Skip Struct (nothing to apply)
            // @todo we could reduce the amount of checks by adding Skip struct to clientRefs so we know that something is missing.
            const len = readVarUint(decoder.restDecoder);
            refs[i] = new Skip(createID(client, clock), len);
            clock += len;
            break
          }
          default: { // Item with content
            /**
             * The optimized implementation doesn't use any variables because inlining variables is faster.
             * Below a non-optimized version is shown that implements the basic algorithm with
             * a few comments
             */
            const cantCopyParentInfo = (info & (BIT7 | BIT8)) === 0;
            // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
            // and we read the next string as parentYKey.
            // It indicates how we store/retrieve parent from `y.share`
            // @type {string|null}
            const struct = new Item(
              createID(client, clock),
              null, // leftd
              (info & BIT8) === BIT8 ? decoder.readLeftID() : null, // origin
              null, // right
              (info & BIT7) === BIT7 ? decoder.readRightID() : null, // right origin
              cantCopyParentInfo ? (decoder.readParentInfo() ? doc.get(decoder.readString()) : decoder.readLeftID()) : null, // parent
              cantCopyParentInfo && (info & BIT6) === BIT6 ? decoder.readString() : null, // parentSub
              readItemContent(decoder, info) // item content
            );
            /* A non-optimized implementation of the above algorithm:

            // The item that was originally to the left of this item.
            const origin = (info & binary.BIT8) === binary.BIT8 ? decoder.readLeftID() : null
            // The item that was originally to the right of this item.
            const rightOrigin = (info & binary.BIT7) === binary.BIT7 ? decoder.readRightID() : null
            const cantCopyParentInfo = (info & (binary.BIT7 | binary.BIT8)) === 0
            const hasParentYKey = cantCopyParentInfo ? decoder.readParentInfo() : false
            // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
            // and we read the next string as parentYKey.
            // It indicates how we store/retrieve parent from `y.share`
            // @type {string|null}
            const parentYKey = cantCopyParentInfo && hasParentYKey ? decoder.readString() : null

            const struct = new Item(
              createID(client, clock),
              null, // leftd
              origin, // origin
              null, // right
              rightOrigin, // right origin
              cantCopyParentInfo && !hasParentYKey ? decoder.readLeftID() : (parentYKey !== null ? doc.get(parentYKey) : null), // parent
              cantCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoder.readString() : null, // parentSub
              readItemContent(decoder, info) // item content
            )
            */
            refs[i] = struct;
            clock += struct.length;
          }
        }
      }
      // console.log('time to read: ', performance.now() - start) // @todo remove
    }
    return clientRefs
  };

  /**
   * Resume computing structs generated by struct readers.
   *
   * While there is something to do, we integrate structs in this order
   * 1. top element on stack, if stack is not empty
   * 2. next element from current struct reader (if empty, use next struct reader)
   *
   * If struct causally depends on another struct (ref.missing), we put next reader of
   * `ref.id.client` on top of stack.
   *
   * At some point we find a struct that has no causal dependencies,
   * then we start emptying the stack.
   *
   * It is not possible to have circles: i.e. struct1 (from client1) depends on struct2 (from client2)
   * depends on struct3 (from client1). Therefore the max stack size is eqaul to `structReaders.length`.
   *
   * This method is implemented in a way so that we can resume computation if this update
   * causally depends on another update.
   *
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {Map<number, { i: number, refs: (GC | Item)[] }>} clientsStructRefs
   * @return { null | { update: Uint8Array, missing: Map<number,number> } }
   *
   * @private
   * @function
   */
  const integrateStructs = (transaction, store, clientsStructRefs) => {
    /**
     * @type {Array<Item | GC>}
     */
    const stack = [];
    // sort them so that we take the higher id first, in case of conflicts the lower id will probably not conflict with the id from the higher user.
    let clientsStructRefsIds = from(clientsStructRefs.keys()).sort((a, b) => a - b);
    if (clientsStructRefsIds.length === 0) {
      return null
    }
    const getNextStructTarget = () => {
      if (clientsStructRefsIds.length === 0) {
        return null
      }
      let nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]));
      while (nextStructsTarget.refs.length === nextStructsTarget.i) {
        clientsStructRefsIds.pop();
        if (clientsStructRefsIds.length > 0) {
          nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]));
        } else {
          return null
        }
      }
      return nextStructsTarget
    };
    let curStructsTarget = getNextStructTarget();
    if (curStructsTarget === null && stack.length === 0) {
      return null
    }

    /**
     * @type {StructStore}
     */
    const restStructs = new StructStore();
    const missingSV = new Map();
    /**
     * @param {number} client
     * @param {number} clock
     */
    const updateMissingSv = (client, clock) => {
      const mclock = missingSV.get(client);
      if (mclock == null || mclock > clock) {
        missingSV.set(client, clock);
      }
    };
    /**
     * @type {GC|Item}
     */
    let stackHead = /** @type {any} */ (curStructsTarget).refs[/** @type {any} */ (curStructsTarget).i++];
    // caching the state because it is used very often
    const state = new Map();

    const addStackToRestSS = () => {
      for (const item of stack) {
        const client = item.id.client;
        const unapplicableItems = clientsStructRefs.get(client);
        if (unapplicableItems) {
          // decrement because we weren't able to apply previous operation
          unapplicableItems.i--;
          restStructs.clients.set(client, unapplicableItems.refs.slice(unapplicableItems.i));
          clientsStructRefs.delete(client);
          unapplicableItems.i = 0;
          unapplicableItems.refs = [];
        } else {
          // item was the last item on clientsStructRefs and the field was already cleared. Add item to restStructs and continue
          restStructs.clients.set(client, [item]);
        }
        // remove client from clientsStructRefsIds to prevent users from applying the same update again
        clientsStructRefsIds = clientsStructRefsIds.filter(c => c !== client);
      }
      stack.length = 0;
    };

    // iterate over all struct readers until we are done
    while (true) {
      if (stackHead.constructor !== Skip) {
        const localClock = setIfUndefined(state, stackHead.id.client, () => getState(store, stackHead.id.client));
        const offset = localClock - stackHead.id.clock;
        if (offset < 0) {
          // update from the same client is missing
          stack.push(stackHead);
          updateMissingSv(stackHead.id.client, stackHead.id.clock - 1);
          // hid a dead wall, add all items from stack to restSS
          addStackToRestSS();
        } else {
          const missing = stackHead.getMissing(transaction, store);
          if (missing !== null) {
            stack.push(stackHead);
            // get the struct reader that has the missing struct
            /**
             * @type {{ refs: Array<GC|Item>, i: number }}
             */
            const structRefs = clientsStructRefs.get(/** @type {number} */ (missing)) || { refs: [], i: 0 };
            if (structRefs.refs.length === structRefs.i) {
              // This update message causally depends on another update message that doesn't exist yet
              updateMissingSv(/** @type {number} */ (missing), getState(store, missing));
              addStackToRestSS();
            } else {
              stackHead = structRefs.refs[structRefs.i++];
              continue
            }
          } else if (offset === 0 || offset < stackHead.length) {
            // all fine, apply the stackhead
            stackHead.integrate(transaction, offset);
            state.set(stackHead.id.client, stackHead.id.clock + stackHead.length);
          }
        }
      }
      // iterate to next stackHead
      if (stack.length > 0) {
        stackHead = /** @type {GC|Item} */ (stack.pop());
      } else if (curStructsTarget !== null && curStructsTarget.i < curStructsTarget.refs.length) {
        stackHead = /** @type {GC|Item} */ (curStructsTarget.refs[curStructsTarget.i++]);
      } else {
        curStructsTarget = getNextStructTarget();
        if (curStructsTarget === null) {
          // we are done!
          break
        } else {
          stackHead = /** @type {GC|Item} */ (curStructsTarget.refs[curStructsTarget.i++]);
        }
      }
    }
    if (restStructs.clients.size > 0) {
      const encoder = new UpdateEncoderV2();
      writeClientsStructs(encoder, restStructs, new Map());
      // write empty deleteset
      // writeDeleteSet(encoder, new DeleteSet())
      writeVarUint(encoder.restEncoder, 0); // => no need for an extra function call, just write 0 deletes
      return { missing: missingSV, update: encoder.toUint8Array() }
    }
    return null
  };

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {Transaction} transaction
   *
   * @private
   * @function
   */
  const writeStructsFromTransaction = (encoder, transaction) => writeClientsStructs(encoder, transaction.doc.store, transaction.beforeState);

  /**
   * Read and apply a document update.
   *
   * This function has the same effect as `applyUpdate` but accepts an decoder.
   *
   * @param {decoding.Decoder} decoder
   * @param {Doc} ydoc
   * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
   * @param {UpdateDecoderV1 | UpdateDecoderV2} [structDecoder]
   *
   * @function
   */
  const readUpdateV2 = (decoder, ydoc, transactionOrigin, structDecoder = new UpdateDecoderV2(decoder)) =>
    transact(ydoc, transaction => {
      // force that transaction.local is set to non-local
      transaction.local = false;
      let retry = false;
      const doc = transaction.doc;
      const store = doc.store;
      // let start = performance.now()
      const ss = readClientsStructRefs(structDecoder, doc);
      // console.log('time to read structs: ', performance.now() - start) // @todo remove
      // start = performance.now()
      // console.log('time to merge: ', performance.now() - start) // @todo remove
      // start = performance.now()
      const restStructs = integrateStructs(transaction, store, ss);
      const pending = store.pendingStructs;
      if (pending) {
        // check if we can apply something
        for (const [client, clock] of pending.missing) {
          if (clock < getState(store, client)) {
            retry = true;
            break
          }
        }
        if (restStructs) {
          // merge restStructs into store.pending
          for (const [client, clock] of restStructs.missing) {
            const mclock = pending.missing.get(client);
            if (mclock == null || mclock > clock) {
              pending.missing.set(client, clock);
            }
          }
          pending.update = mergeUpdatesV2([pending.update, restStructs.update]);
        }
      } else {
        store.pendingStructs = restStructs;
      }
      // console.log('time to integrate: ', performance.now() - start) // @todo remove
      // start = performance.now()
      const dsRest = readAndApplyDeleteSet(structDecoder, transaction, store);
      if (store.pendingDs) {
        // @todo we could make a lower-bound state-vector check as we do above
        const pendingDSUpdate = new UpdateDecoderV2(createDecoder(store.pendingDs));
        readVarUint(pendingDSUpdate.restDecoder); // read 0 structs, because we only encode deletes in pendingdsupdate
        const dsRest2 = readAndApplyDeleteSet(pendingDSUpdate, transaction, store);
        if (dsRest && dsRest2) {
          // case 1: ds1 != null && ds2 != null
          store.pendingDs = mergeUpdatesV2([dsRest, dsRest2]);
        } else {
          // case 2: ds1 != null
          // case 3: ds2 != null
          // case 4: ds1 == null && ds2 == null
          store.pendingDs = dsRest || dsRest2;
        }
      } else {
        // Either dsRest == null && pendingDs == null OR dsRest != null
        store.pendingDs = dsRest;
      }
      // console.log('time to cleanup: ', performance.now() - start) // @todo remove
      // start = performance.now()

      // console.log('time to resume delete readers: ', performance.now() - start) // @todo remove
      // start = performance.now()
      if (retry) {
        const update = /** @type {{update: Uint8Array}} */ (store.pendingStructs).update;
        store.pendingStructs = null;
        applyUpdateV2(transaction.doc, update);
      }
    }, transactionOrigin, false);

  /**
   * Read and apply a document update.
   *
   * This function has the same effect as `applyUpdate` but accepts an decoder.
   *
   * @param {decoding.Decoder} decoder
   * @param {Doc} ydoc
   * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
   *
   * @function
   */
  const readUpdate$1 = (decoder, ydoc, transactionOrigin) => readUpdateV2(decoder, ydoc, transactionOrigin, new UpdateDecoderV1(decoder));

  /**
   * Apply a document update created by, for example, `y.on('update', update => ..)` or `update = encodeStateAsUpdate()`.
   *
   * This function has the same effect as `readUpdate` but accepts an Uint8Array instead of a Decoder.
   *
   * @param {Doc} ydoc
   * @param {Uint8Array} update
   * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
   * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
   *
   * @function
   */
  const applyUpdateV2 = (ydoc, update, transactionOrigin, YDecoder = UpdateDecoderV2) => {
    const decoder = createDecoder(update);
    readUpdateV2(decoder, ydoc, transactionOrigin, new YDecoder(decoder));
  };

  /**
   * Apply a document update created by, for example, `y.on('update', update => ..)` or `update = encodeStateAsUpdate()`.
   *
   * This function has the same effect as `readUpdate` but accepts an Uint8Array instead of a Decoder.
   *
   * @param {Doc} ydoc
   * @param {Uint8Array} update
   * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
   *
   * @function
   */
  const applyUpdate = (ydoc, update, transactionOrigin) => applyUpdateV2(ydoc, update, transactionOrigin, UpdateDecoderV1);

  /**
   * Write all the document as a single update message. If you specify the state of the remote client (`targetStateVector`) it will
   * only write the operations that are missing.
   *
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {Doc} doc
   * @param {Map<number,number>} [targetStateVector] The state of the target that receives the update. Leave empty to write all known structs
   *
   * @function
   */
  const writeStateAsUpdate = (encoder, doc, targetStateVector = new Map()) => {
    writeClientsStructs(encoder, doc.store, targetStateVector);
    writeDeleteSet(encoder, createDeleteSetFromStructStore(doc.store));
  };

  /**
   * Write all the document as a single update message that can be applied on the remote document. If you specify the state of the remote client (`targetState`) it will
   * only write the operations that are missing.
   *
   * Use `writeStateAsUpdate` instead if you are working with lib0/encoding.js#Encoder
   *
   * @param {Doc} doc
   * @param {Uint8Array} [encodedTargetStateVector] The state of the target that receives the update. Leave empty to write all known structs
   * @param {UpdateEncoderV1 | UpdateEncoderV2} [encoder]
   * @return {Uint8Array}
   *
   * @function
   */
  const encodeStateAsUpdateV2 = (doc, encodedTargetStateVector = new Uint8Array([0]), encoder = new UpdateEncoderV2()) => {
    const targetStateVector = decodeStateVector(encodedTargetStateVector);
    writeStateAsUpdate(encoder, doc, targetStateVector);
    const updates = [encoder.toUint8Array()];
    // also add the pending updates (if there are any)
    if (doc.store.pendingDs) {
      updates.push(doc.store.pendingDs);
    }
    if (doc.store.pendingStructs) {
      updates.push(diffUpdateV2(doc.store.pendingStructs.update, encodedTargetStateVector));
    }
    if (updates.length > 1) {
      if (encoder.constructor === UpdateEncoderV1) {
        return mergeUpdates(updates.map((update, i) => i === 0 ? update : convertUpdateFormatV2ToV1(update)))
      } else if (encoder.constructor === UpdateEncoderV2) {
        return mergeUpdatesV2(updates)
      }
    }
    return updates[0]
  };

  /**
   * Write all the document as a single update message that can be applied on the remote document. If you specify the state of the remote client (`targetState`) it will
   * only write the operations that are missing.
   *
   * Use `writeStateAsUpdate` instead if you are working with lib0/encoding.js#Encoder
   *
   * @param {Doc} doc
   * @param {Uint8Array} [encodedTargetStateVector] The state of the target that receives the update. Leave empty to write all known structs
   * @return {Uint8Array}
   *
   * @function
   */
  const encodeStateAsUpdate = (doc, encodedTargetStateVector) => encodeStateAsUpdateV2(doc, encodedTargetStateVector, new UpdateEncoderV1());

  /**
   * Read state vector from Decoder and return as Map
   *
   * @param {DSDecoderV1 | DSDecoderV2} decoder
   * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
   *
   * @function
   */
  const readStateVector = decoder => {
    const ss = new Map();
    const ssLength = readVarUint(decoder.restDecoder);
    for (let i = 0; i < ssLength; i++) {
      const client = readVarUint(decoder.restDecoder);
      const clock = readVarUint(decoder.restDecoder);
      ss.set(client, clock);
    }
    return ss
  };

  /**
   * Read decodedState and return State as Map.
   *
   * @param {Uint8Array} decodedState
   * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
   *
   * @function
   */
  // export const decodeStateVectorV2 = decodedState => readStateVector(new DSDecoderV2(decoding.createDecoder(decodedState)))

  /**
   * Read decodedState and return State as Map.
   *
   * @param {Uint8Array} decodedState
   * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
   *
   * @function
   */
  const decodeStateVector = decodedState => readStateVector(new DSDecoderV1(createDecoder(decodedState)));

  /**
   * @param {DSEncoderV1 | DSEncoderV2} encoder
   * @param {Map<number,number>} sv
   * @function
   */
  const writeStateVector = (encoder, sv) => {
    writeVarUint(encoder.restEncoder, sv.size);
    from(sv.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
      writeVarUint(encoder.restEncoder, client); // @todo use a special client decoder that is based on mapping
      writeVarUint(encoder.restEncoder, clock);
    });
    return encoder
  };

  /**
   * @param {DSEncoderV1 | DSEncoderV2} encoder
   * @param {Doc} doc
   *
   * @function
   */
  const writeDocumentStateVector = (encoder, doc) => writeStateVector(encoder, getStateVector(doc.store));

  /**
   * Encode State as Uint8Array.
   *
   * @param {Doc|Map<number,number>} doc
   * @param {DSEncoderV1 | DSEncoderV2} [encoder]
   * @return {Uint8Array}
   *
   * @function
   */
  const encodeStateVectorV2 = (doc, encoder = new DSEncoderV2()) => {
    if (doc instanceof Map) {
      writeStateVector(encoder, doc);
    } else {
      writeDocumentStateVector(encoder, doc);
    }
    return encoder.toUint8Array()
  };

  /**
   * Encode State as Uint8Array.
   *
   * @param {Doc|Map<number,number>} doc
   * @return {Uint8Array}
   *
   * @function
   */
  const encodeStateVector = doc => encodeStateVectorV2(doc, new DSEncoderV1());

  /**
   * General event handler implementation.
   *
   * @template ARG0, ARG1
   *
   * @private
   */
  class EventHandler {
    constructor () {
      /**
       * @type {Array<function(ARG0, ARG1):void>}
       */
      this.l = [];
    }
  }

  /**
   * @template ARG0,ARG1
   * @returns {EventHandler<ARG0,ARG1>}
   *
   * @private
   * @function
   */
  const createEventHandler = () => new EventHandler();

  /**
   * Adds an event listener that is called when
   * {@link EventHandler#callEventListeners} is called.
   *
   * @template ARG0,ARG1
   * @param {EventHandler<ARG0,ARG1>} eventHandler
   * @param {function(ARG0,ARG1):void} f The event handler.
   *
   * @private
   * @function
   */
  const addEventHandlerListener = (eventHandler, f) =>
    eventHandler.l.push(f);

  /**
   * Removes an event listener.
   *
   * @template ARG0,ARG1
   * @param {EventHandler<ARG0,ARG1>} eventHandler
   * @param {function(ARG0,ARG1):void} f The event handler that was added with
   *                     {@link EventHandler#addEventListener}
   *
   * @private
   * @function
   */
  const removeEventHandlerListener = (eventHandler, f) => {
    const l = eventHandler.l;
    const len = l.length;
    eventHandler.l = l.filter(g => f !== g);
    if (len === eventHandler.l.length) {
      console.error('[yjs] Tried to remove event handler that doesn\'t exist.');
    }
  };

  /**
   * Call all event listeners that were added via
   * {@link EventHandler#addEventListener}.
   *
   * @template ARG0,ARG1
   * @param {EventHandler<ARG0,ARG1>} eventHandler
   * @param {ARG0} arg0
   * @param {ARG1} arg1
   *
   * @private
   * @function
   */
  const callEventHandlerListeners = (eventHandler, arg0, arg1) =>
    callAll(eventHandler.l, [arg0, arg1]);

  class ID {
    /**
     * @param {number} client client id
     * @param {number} clock unique per client id, continuous number
     */
    constructor (client, clock) {
      /**
       * Client id
       * @type {number}
       */
      this.client = client;
      /**
       * unique per client id, continuous number
       * @type {number}
       */
      this.clock = clock;
    }
  }

  /**
   * @param {ID | null} a
   * @param {ID | null} b
   * @return {boolean}
   *
   * @function
   */
  const compareIDs = (a, b) => a === b || (a !== null && b !== null && a.client === b.client && a.clock === b.clock);

  /**
   * @param {number} client
   * @param {number} clock
   *
   * @private
   * @function
   */
  const createID = (client, clock) => new ID(client, clock);

  /**
   * @param {encoding.Encoder} encoder
   * @param {ID} id
   *
   * @private
   * @function
   */
  const writeID = (encoder, id) => {
    writeVarUint(encoder, id.client);
    writeVarUint(encoder, id.clock);
  };

  /**
   * Read ID.
   * * If first varUint read is 0xFFFFFF a RootID is returned.
   * * Otherwise an ID is returned
   *
   * @param {decoding.Decoder} decoder
   * @return {ID}
   *
   * @private
   * @function
   */
  const readID = decoder =>
    createID(readVarUint(decoder), readVarUint(decoder));

  /**
   * The top types are mapped from y.share.get(keyname) => type.
   * `type` does not store any information about the `keyname`.
   * This function finds the correct `keyname` for `type` and throws otherwise.
   *
   * @param {AbstractType<any>} type
   * @return {string}
   *
   * @private
   * @function
   */
  const findRootTypeKey = type => {
    // @ts-ignore _y must be defined, otherwise unexpected case
    for (const [key, value] of type.doc.share.entries()) {
      if (value === type) {
        return key
      }
    }
    throw unexpectedCase()
  };

  /**
   * Check if `parent` is a parent of `child`.
   *
   * @param {AbstractType<any>} parent
   * @param {Item|null} child
   * @return {Boolean} Whether `parent` is a parent of `child`.
   *
   * @private
   * @function
   */
  const isParentOf = (parent, child) => {
    while (child !== null) {
      if (child.parent === parent) {
        return true
      }
      child = /** @type {AbstractType<any>} */ (child.parent)._item;
    }
    return false
  };

  /**
   * Convenient helper to log type information.
   *
   * Do not use in productive systems as the output can be immense!
   *
   * @param {AbstractType<any>} type
   */
  const logType = type => {
    const res = [];
    let n = type._start;
    while (n) {
      res.push(n);
      n = n.right;
    }
    console.log('Children: ', res);
    console.log('Children content: ', res.filter(m => !m.deleted).map(m => m.content));
  };

  class PermanentUserData {
    /**
     * @param {Doc} doc
     * @param {YMap<any>} [storeType]
     */
    constructor (doc, storeType = doc.getMap('users')) {
      /**
       * @type {Map<string,DeleteSet>}
       */
      const dss = new Map();
      this.yusers = storeType;
      this.doc = doc;
      /**
       * Maps from clientid to userDescription
       *
       * @type {Map<number,string>}
       */
      this.clients = new Map();
      this.dss = dss;
      /**
       * @param {YMap<any>} user
       * @param {string} userDescription
       */
      const initUser = (user, userDescription) => {
        /**
         * @type {YArray<Uint8Array>}
         */
        const ds = user.get('ds');
        const ids = user.get('ids');
        const addClientId = /** @param {number} clientid */ clientid => this.clients.set(clientid, userDescription);
        ds.observe(/** @param {YArrayEvent<any>} event */ event => {
          event.changes.added.forEach(item => {
            item.content.getContent().forEach(encodedDs => {
              if (encodedDs instanceof Uint8Array) {
                this.dss.set(userDescription, mergeDeleteSets([this.dss.get(userDescription) || createDeleteSet(), readDeleteSet(new DSDecoderV1(createDecoder(encodedDs)))]));
              }
            });
          });
        });
        this.dss.set(userDescription, mergeDeleteSets(ds.map(encodedDs => readDeleteSet(new DSDecoderV1(createDecoder(encodedDs))))));
        ids.observe(/** @param {YArrayEvent<any>} event */ event =>
          event.changes.added.forEach(item => item.content.getContent().forEach(addClientId))
        );
        ids.forEach(addClientId);
      };
      // observe users
      storeType.observe(event => {
        event.keysChanged.forEach(userDescription =>
          initUser(storeType.get(userDescription), userDescription)
        );
      });
      // add intial data
      storeType.forEach(initUser);
    }

    /**
     * @param {Doc} doc
     * @param {number} clientid
     * @param {string} userDescription
     * @param {Object} conf
     * @param {function(Transaction, DeleteSet):boolean} [conf.filter]
     */
    setUserMapping (doc, clientid, userDescription, { filter = () => true } = {}) {
      const users = this.yusers;
      let user = users.get(userDescription);
      if (!user) {
        user = new YMap();
        user.set('ids', new YArray());
        user.set('ds', new YArray());
        users.set(userDescription, user);
      }
      user.get('ids').push([clientid]);
      users.observe(_event => {
        setTimeout(() => {
          const userOverwrite = users.get(userDescription);
          if (userOverwrite !== user) {
            // user was overwritten, port all data over to the next user object
            // @todo Experiment with Y.Sets here
            user = userOverwrite;
            // @todo iterate over old type
            this.clients.forEach((_userDescription, clientid) => {
              if (userDescription === _userDescription) {
                user.get('ids').push([clientid]);
              }
            });
            const encoder = new DSEncoderV1();
            const ds = this.dss.get(userDescription);
            if (ds) {
              writeDeleteSet(encoder, ds);
              user.get('ds').push([encoder.toUint8Array()]);
            }
          }
        }, 0);
      });
      doc.on('afterTransaction', /** @param {Transaction} transaction */ transaction => {
        setTimeout(() => {
          const yds = user.get('ds');
          const ds = transaction.deleteSet;
          if (transaction.local && ds.clients.size > 0 && filter(transaction, ds)) {
            const encoder = new DSEncoderV1();
            writeDeleteSet(encoder, ds);
            yds.push([encoder.toUint8Array()]);
          }
        });
      });
    }

    /**
     * @param {number} clientid
     * @return {any}
     */
    getUserByClientId (clientid) {
      return this.clients.get(clientid) || null
    }

    /**
     * @param {ID} id
     * @return {string | null}
     */
    getUserByDeletedId (id) {
      for (const [userDescription, ds] of this.dss.entries()) {
        if (isDeleted(ds, id)) {
          return userDescription
        }
      }
      return null
    }
  }

  /**
   * A relative position is based on the Yjs model and is not affected by document changes.
   * E.g. If you place a relative position before a certain character, it will always point to this character.
   * If you place a relative position at the end of a type, it will always point to the end of the type.
   *
   * A numeric position is often unsuited for user selections, because it does not change when content is inserted
   * before or after.
   *
   * ```Insert(0, 'x')('a|bc') = 'xa|bc'``` Where | is the relative position.
   *
   * One of the properties must be defined.
   *
   * @example
   *   // Current cursor position is at position 10
   *   const relativePosition = createRelativePositionFromIndex(yText, 10)
   *   // modify yText
   *   yText.insert(0, 'abc')
   *   yText.delete(3, 10)
   *   // Compute the cursor position
   *   const absolutePosition = createAbsolutePositionFromRelativePosition(y, relativePosition)
   *   absolutePosition.type === yText // => true
   *   console.log('cursor location is ' + absolutePosition.index) // => cursor location is 3
   *
   */
  class RelativePosition {
    /**
     * @param {ID|null} type
     * @param {string|null} tname
     * @param {ID|null} item
     * @param {number} assoc
     */
    constructor (type, tname, item, assoc = 0) {
      /**
       * @type {ID|null}
       */
      this.type = type;
      /**
       * @type {string|null}
       */
      this.tname = tname;
      /**
       * @type {ID | null}
       */
      this.item = item;
      /**
       * A relative position is associated to a specific character. By default
       * assoc >= 0, the relative position is associated to the character
       * after the meant position.
       * I.e. position 1 in 'ab' is associated to character 'b'.
       *
       * If assoc < 0, then the relative position is associated to the caharacter
       * before the meant position.
       *
       * @type {number}
       */
      this.assoc = assoc;
    }
  }

  /**
   * @param {RelativePosition} rpos
   * @return {any}
   */
  const relativePositionToJSON = rpos => {
    const json = {};
    if (rpos.type) {
      json.type = rpos.type;
    }
    if (rpos.tname) {
      json.tname = rpos.tname;
    }
    if (rpos.item) {
      json.item = rpos.item;
    }
    if (rpos.assoc != null) {
      json.assoc = rpos.assoc;
    }
    return json
  };

  /**
   * @param {any} json
   * @return {RelativePosition}
   *
   * @function
   */
  const createRelativePositionFromJSON = json => new RelativePosition(json.type == null ? null : createID(json.type.client, json.type.clock), json.tname || null, json.item == null ? null : createID(json.item.client, json.item.clock), json.assoc == null ? 0 : json.assoc);

  class AbsolutePosition {
    /**
     * @param {AbstractType<any>} type
     * @param {number} index
     * @param {number} [assoc]
     */
    constructor (type, index, assoc = 0) {
      /**
       * @type {AbstractType<any>}
       */
      this.type = type;
      /**
       * @type {number}
       */
      this.index = index;
      this.assoc = assoc;
    }
  }

  /**
   * @param {AbstractType<any>} type
   * @param {number} index
   * @param {number} [assoc]
   *
   * @function
   */
  const createAbsolutePosition = (type, index, assoc = 0) => new AbsolutePosition(type, index, assoc);

  /**
   * @param {AbstractType<any>} type
   * @param {ID|null} item
   * @param {number} [assoc]
   *
   * @function
   */
  const createRelativePosition = (type, item, assoc) => {
    let typeid = null;
    let tname = null;
    if (type._item === null) {
      tname = findRootTypeKey(type);
    } else {
      typeid = createID(type._item.id.client, type._item.id.clock);
    }
    return new RelativePosition(typeid, tname, item, assoc)
  };

  /**
   * Create a relativePosition based on a absolute position.
   *
   * @param {AbstractType<any>} type The base type (e.g. YText or YArray).
   * @param {number} index The absolute position.
   * @param {number} [assoc]
   * @return {RelativePosition}
   *
   * @function
   */
  const createRelativePositionFromTypeIndex = (type, index, assoc = 0) => {
    let t = type._start;
    if (assoc < 0) {
      // associated to the left character or the beginning of a type, increment index if possible.
      if (index === 0) {
        return createRelativePosition(type, null, assoc)
      }
      index--;
    }
    while (t !== null) {
      if (!t.deleted && t.countable) {
        if (t.length > index) {
          // case 1: found position somewhere in the linked list
          return createRelativePosition(type, createID(t.id.client, t.id.clock + index), assoc)
        }
        index -= t.length;
      }
      if (t.right === null && assoc < 0) {
        // left-associated position, return last available id
        return createRelativePosition(type, t.lastId, assoc)
      }
      t = t.right;
    }
    return createRelativePosition(type, null, assoc)
  };

  /**
   * @param {encoding.Encoder} encoder
   * @param {RelativePosition} rpos
   *
   * @function
   */
  const writeRelativePosition = (encoder, rpos) => {
    const { type, tname, item, assoc } = rpos;
    if (item !== null) {
      writeVarUint(encoder, 0);
      writeID(encoder, item);
    } else if (tname !== null) {
      // case 2: found position at the end of the list and type is stored in y.share
      writeUint8(encoder, 1);
      writeVarString(encoder, tname);
    } else if (type !== null) {
      // case 3: found position at the end of the list and type is attached to an item
      writeUint8(encoder, 2);
      writeID(encoder, type);
    } else {
      throw unexpectedCase()
    }
    writeVarInt(encoder, assoc);
    return encoder
  };

  /**
   * @param {RelativePosition} rpos
   * @return {Uint8Array}
   */
  const encodeRelativePosition = rpos => {
    const encoder = createEncoder();
    writeRelativePosition(encoder, rpos);
    return toUint8Array(encoder)
  };

  /**
   * @param {decoding.Decoder} decoder
   * @return {RelativePosition}
   *
   * @function
   */
  const readRelativePosition = decoder => {
    let type = null;
    let tname = null;
    let itemID = null;
    switch (readVarUint(decoder)) {
      case 0:
        // case 1: found position somewhere in the linked list
        itemID = readID(decoder);
        break
      case 1:
        // case 2: found position at the end of the list and type is stored in y.share
        tname = readVarString(decoder);
        break
      case 2: {
        // case 3: found position at the end of the list and type is attached to an item
        type = readID(decoder);
      }
    }
    const assoc = hasContent(decoder) ? readVarInt(decoder) : 0;
    return new RelativePosition(type, tname, itemID, assoc)
  };

  /**
   * @param {Uint8Array} uint8Array
   * @return {RelativePosition}
   */
  const decodeRelativePosition = uint8Array => readRelativePosition(createDecoder(uint8Array));

  /**
   * @param {RelativePosition} rpos
   * @param {Doc} doc
   * @return {AbsolutePosition|null}
   *
   * @function
   */
  const createAbsolutePositionFromRelativePosition = (rpos, doc) => {
    const store = doc.store;
    const rightID = rpos.item;
    const typeID = rpos.type;
    const tname = rpos.tname;
    const assoc = rpos.assoc;
    let type = null;
    let index = 0;
    if (rightID !== null) {
      if (getState(store, rightID.client) <= rightID.clock) {
        return null
      }
      const res = followRedone(store, rightID);
      const right = res.item;
      if (!(right instanceof Item)) {
        return null
      }
      type = /** @type {AbstractType<any>} */ (right.parent);
      if (type._item === null || !type._item.deleted) {
        index = (right.deleted || !right.countable) ? 0 : (res.diff + (assoc >= 0 ? 0 : 1)); // adjust position based on left association if necessary
        let n = right.left;
        while (n !== null) {
          if (!n.deleted && n.countable) {
            index += n.length;
          }
          n = n.left;
        }
      }
    } else {
      if (tname !== null) {
        type = doc.get(tname);
      } else if (typeID !== null) {
        if (getState(store, typeID.client) <= typeID.clock) {
          // type does not exist yet
          return null
        }
        const { item } = followRedone(store, typeID);
        if (item instanceof Item && item.content instanceof ContentType) {
          type = item.content.type;
        } else {
          // struct is garbage collected
          return null
        }
      } else {
        throw unexpectedCase()
      }
      if (assoc >= 0) {
        index = type._length;
      } else {
        index = 0;
      }
    }
    return createAbsolutePosition(type, index, rpos.assoc)
  };

  /**
   * @param {RelativePosition|null} a
   * @param {RelativePosition|null} b
   * @return {boolean}
   *
   * @function
   */
  const compareRelativePositions = (a, b) => a === b || (
    a !== null && b !== null && a.tname === b.tname && compareIDs(a.item, b.item) && compareIDs(a.type, b.type) && a.assoc === b.assoc
  );

  class Snapshot {
    /**
     * @param {DeleteSet} ds
     * @param {Map<number,number>} sv state map
     */
    constructor (ds, sv) {
      /**
       * @type {DeleteSet}
       */
      this.ds = ds;
      /**
       * State Map
       * @type {Map<number,number>}
       */
      this.sv = sv;
    }
  }

  /**
   * @param {Snapshot} snap1
   * @param {Snapshot} snap2
   * @return {boolean}
   */
  const equalSnapshots = (snap1, snap2) => {
    const ds1 = snap1.ds.clients;
    const ds2 = snap2.ds.clients;
    const sv1 = snap1.sv;
    const sv2 = snap2.sv;
    if (sv1.size !== sv2.size || ds1.size !== ds2.size) {
      return false
    }
    for (const [key, value] of sv1.entries()) {
      if (sv2.get(key) !== value) {
        return false
      }
    }
    for (const [client, dsitems1] of ds1.entries()) {
      const dsitems2 = ds2.get(client) || [];
      if (dsitems1.length !== dsitems2.length) {
        return false
      }
      for (let i = 0; i < dsitems1.length; i++) {
        const dsitem1 = dsitems1[i];
        const dsitem2 = dsitems2[i];
        if (dsitem1.clock !== dsitem2.clock || dsitem1.len !== dsitem2.len) {
          return false
        }
      }
    }
    return true
  };

  /**
   * @param {Snapshot} snapshot
   * @param {DSEncoderV1 | DSEncoderV2} [encoder]
   * @return {Uint8Array}
   */
  const encodeSnapshotV2 = (snapshot, encoder = new DSEncoderV2()) => {
    writeDeleteSet(encoder, snapshot.ds);
    writeStateVector(encoder, snapshot.sv);
    return encoder.toUint8Array()
  };

  /**
   * @param {Snapshot} snapshot
   * @return {Uint8Array}
   */
  const encodeSnapshot = snapshot => encodeSnapshotV2(snapshot, new DSEncoderV1());

  /**
   * @param {Uint8Array} buf
   * @param {DSDecoderV1 | DSDecoderV2} [decoder]
   * @return {Snapshot}
   */
  const decodeSnapshotV2 = (buf, decoder = new DSDecoderV2(createDecoder(buf))) => {
    return new Snapshot(readDeleteSet(decoder), readStateVector(decoder))
  };

  /**
   * @param {Uint8Array} buf
   * @return {Snapshot}
   */
  const decodeSnapshot = buf => decodeSnapshotV2(buf, new DSDecoderV1(createDecoder(buf)));

  /**
   * @param {DeleteSet} ds
   * @param {Map<number,number>} sm
   * @return {Snapshot}
   */
  const createSnapshot = (ds, sm) => new Snapshot(ds, sm);

  const emptySnapshot = createSnapshot(createDeleteSet(), new Map());

  /**
   * @param {Doc} doc
   * @return {Snapshot}
   */
  const snapshot$1 = doc => createSnapshot(createDeleteSetFromStructStore(doc.store), getStateVector(doc.store));

  /**
   * @param {Item} item
   * @param {Snapshot|undefined} snapshot
   *
   * @protected
   * @function
   */
  const isVisible = (item, snapshot) => snapshot === undefined
    ? !item.deleted
    : snapshot.sv.has(item.id.client) && (snapshot.sv.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id);

  /**
   * @param {Transaction} transaction
   * @param {Snapshot} snapshot
   */
  const splitSnapshotAffectedStructs = (transaction, snapshot) => {
    const meta = setIfUndefined(transaction.meta, splitSnapshotAffectedStructs, create$5);
    const store = transaction.doc.store;
    // check if we already split for this snapshot
    if (!meta.has(snapshot)) {
      snapshot.sv.forEach((clock, client) => {
        if (clock < getState(store, client)) {
          getItemCleanStart(transaction, createID(client, clock));
        }
      });
      iterateDeletedStructs(transaction, snapshot.ds, item => {});
      meta.add(snapshot);
    }
  };

  /**
   * @example
   *  const ydoc = new Y.Doc({ gc: false })
   *  ydoc.getText().insert(0, 'world!')
   *  const snapshot = Y.snapshot(ydoc)
   *  ydoc.getText().insert(0, 'hello ')
   *  const restored = Y.createDocFromSnapshot(ydoc, snapshot)
   *  assert(restored.getText().toString() === 'world!')
   *
   * @param {Doc} originDoc
   * @param {Snapshot} snapshot
   * @param {Doc} [newDoc] Optionally, you may define the Yjs document that receives the data from originDoc
   * @return {Doc}
   */
  const createDocFromSnapshot = (originDoc, snapshot, newDoc = new Doc()) => {
    if (originDoc.gc) {
      // we should not try to restore a GC-ed document, because some of the restored items might have their content deleted
      throw new Error('Garbage-collection must be disabled in `originDoc`!')
    }
    const { sv, ds } = snapshot;

    const encoder = new UpdateEncoderV2();
    originDoc.transact(transaction => {
      let size = 0;
      sv.forEach(clock => {
        if (clock > 0) {
          size++;
        }
      });
      writeVarUint(encoder.restEncoder, size);
      // splitting the structs before writing them to the encoder
      for (const [client, clock] of sv) {
        if (clock === 0) {
          continue
        }
        if (clock < getState(originDoc.store, client)) {
          getItemCleanStart(transaction, createID(client, clock));
        }
        const structs = originDoc.store.clients.get(client) || [];
        const lastStructIndex = findIndexSS(structs, clock - 1);
        // write # encoded structs
        writeVarUint(encoder.restEncoder, lastStructIndex + 1);
        encoder.writeClient(client);
        // first clock written is 0
        writeVarUint(encoder.restEncoder, 0);
        for (let i = 0; i <= lastStructIndex; i++) {
          structs[i].write(encoder, 0);
        }
      }
      writeDeleteSet(encoder, ds);
    });

    applyUpdateV2(newDoc, encoder.toUint8Array(), 'snapshot');
    return newDoc
  };

  class StructStore {
    constructor () {
      /**
       * @type {Map<number,Array<GC|Item>>}
       */
      this.clients = new Map();
      /**
       * @type {null | { missing: Map<number, number>, update: Uint8Array }}
       */
      this.pendingStructs = null;
      /**
       * @type {null | Uint8Array}
       */
      this.pendingDs = null;
    }
  }

  /**
   * Return the states as a Map<client,clock>.
   * Note that clock refers to the next expected clock id.
   *
   * @param {StructStore} store
   * @return {Map<number,number>}
   *
   * @public
   * @function
   */
  const getStateVector = store => {
    const sm = new Map();
    store.clients.forEach((structs, client) => {
      const struct = structs[structs.length - 1];
      sm.set(client, struct.id.clock + struct.length);
    });
    return sm
  };

  /**
   * @param {StructStore} store
   * @param {number} client
   * @return {number}
   *
   * @public
   * @function
   */
  const getState = (store, client) => {
    const structs = store.clients.get(client);
    if (structs === undefined) {
      return 0
    }
    const lastStruct = structs[structs.length - 1];
    return lastStruct.id.clock + lastStruct.length
  };

  /**
   * @param {StructStore} store
   * @param {GC|Item} struct
   *
   * @private
   * @function
   */
  const addStruct = (store, struct) => {
    let structs = store.clients.get(struct.id.client);
    if (structs === undefined) {
      structs = [];
      store.clients.set(struct.id.client, structs);
    } else {
      const lastStruct = structs[structs.length - 1];
      if (lastStruct.id.clock + lastStruct.length !== struct.id.clock) {
        throw unexpectedCase()
      }
    }
    structs.push(struct);
  };

  /**
   * Perform a binary search on a sorted array
   * @param {Array<Item|GC>} structs
   * @param {number} clock
   * @return {number}
   *
   * @private
   * @function
   */
  const findIndexSS = (structs, clock) => {
    let left = 0;
    let right = structs.length - 1;
    let mid = structs[right];
    let midclock = mid.id.clock;
    if (midclock === clock) {
      return right
    }
    // @todo does it even make sense to pivot the search?
    // If a good split misses, it might actually increase the time to find the correct item.
    // Currently, the only advantage is that search with pivoting might find the item on the first try.
    let midindex = floor((clock / (midclock + mid.length - 1)) * right); // pivoting the search
    while (left <= right) {
      mid = structs[midindex];
      midclock = mid.id.clock;
      if (midclock <= clock) {
        if (clock < midclock + mid.length) {
          return midindex
        }
        left = midindex + 1;
      } else {
        right = midindex - 1;
      }
      midindex = floor((left + right) / 2);
    }
    // Always check state before looking for a struct in StructStore
    // Therefore the case of not finding a struct is unexpected
    throw unexpectedCase()
  };

  /**
   * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
   *
   * @param {StructStore} store
   * @param {ID} id
   * @return {GC|Item}
   *
   * @private
   * @function
   */
  const find = (store, id) => {
    /**
     * @type {Array<GC|Item>}
     */
    // @ts-ignore
    const structs = store.clients.get(id.client);
    return structs[findIndexSS(structs, id.clock)]
  };

  /**
   * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
   * @private
   * @function
   */
  const getItem = /** @type {function(StructStore,ID):Item} */ (find);

  /**
   * @param {Transaction} transaction
   * @param {Array<Item|GC>} structs
   * @param {number} clock
   */
  const findIndexCleanStart = (transaction, structs, clock) => {
    const index = findIndexSS(structs, clock);
    const struct = structs[index];
    if (struct.id.clock < clock && struct instanceof Item) {
      structs.splice(index + 1, 0, splitItem(transaction, struct, clock - struct.id.clock));
      return index + 1
    }
    return index
  };

  /**
   * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
   *
   * @param {Transaction} transaction
   * @param {ID} id
   * @return {Item}
   *
   * @private
   * @function
   */
  const getItemCleanStart = (transaction, id) => {
    const structs = /** @type {Array<Item>} */ (transaction.doc.store.clients.get(id.client));
    return structs[findIndexCleanStart(transaction, structs, id.clock)]
  };

  /**
   * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
   *
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {ID} id
   * @return {Item}
   *
   * @private
   * @function
   */
  const getItemCleanEnd = (transaction, store, id) => {
    /**
     * @type {Array<Item>}
     */
    // @ts-ignore
    const structs = store.clients.get(id.client);
    const index = findIndexSS(structs, id.clock);
    const struct = structs[index];
    if (id.clock !== struct.id.clock + struct.length - 1 && struct.constructor !== GC) {
      structs.splice(index + 1, 0, splitItem(transaction, struct, id.clock - struct.id.clock + 1));
    }
    return struct
  };

  /**
   * Replace `item` with `newitem` in store
   * @param {StructStore} store
   * @param {GC|Item} struct
   * @param {GC|Item} newStruct
   *
   * @private
   * @function
   */
  const replaceStruct = (store, struct, newStruct) => {
    const structs = /** @type {Array<GC|Item>} */ (store.clients.get(struct.id.client));
    structs[findIndexSS(structs, struct.id.clock)] = newStruct;
  };

  /**
   * Iterate over a range of structs
   *
   * @param {Transaction} transaction
   * @param {Array<Item|GC>} structs
   * @param {number} clockStart Inclusive start
   * @param {number} len
   * @param {function(GC|Item):void} f
   *
   * @function
   */
  const iterateStructs = (transaction, structs, clockStart, len, f) => {
    if (len === 0) {
      return
    }
    const clockEnd = clockStart + len;
    let index = findIndexCleanStart(transaction, structs, clockStart);
    let struct;
    do {
      struct = structs[index++];
      if (clockEnd < struct.id.clock + struct.length) {
        findIndexCleanStart(transaction, structs, clockEnd);
      }
      f(struct);
    } while (index < structs.length && structs[index].id.clock < clockEnd)
  };

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
   * map.observe(() => {
   *   console.log('change triggered')
   * })
   * // Each change on the map type triggers a log message:
   * map.set('a', 0) // => "change triggered"
   * map.set('b', 0) // => "change triggered"
   * // When put in a transaction, it will trigger the log after the transaction:
   * y.transact(() => {
   *   map.set('a', 1)
   *   map.set('b', 1)
   * }) // => "change triggered"
   *
   * @public
   */
  class Transaction {
    /**
     * @param {Doc} doc
     * @param {any} origin
     * @param {boolean} local
     */
    constructor (doc, origin, local) {
      /**
       * The Yjs instance.
       * @type {Doc}
       */
      this.doc = doc;
      /**
       * Describes the set of deleted items by ids
       * @type {DeleteSet}
       */
      this.deleteSet = new DeleteSet();
      /**
       * Holds the state before the transaction started.
       * @type {Map<Number,Number>}
       */
      this.beforeState = getStateVector(doc.store);
      /**
       * Holds the state after the transaction.
       * @type {Map<Number,Number>}
       */
      this.afterState = new Map();
      /**
       * All types that were directly modified (property added or child
       * inserted/deleted). New types are not included in this Set.
       * Maps from type to parentSubs (`item.parentSub = null` for YArray)
       * @type {Map<AbstractType<YEvent<any>>,Set<String|null>>}
       */
      this.changed = new Map();
      /**
       * Stores the events for the types that observe also child elements.
       * It is mainly used by `observeDeep`.
       * @type {Map<AbstractType<YEvent<any>>,Array<YEvent<any>>>}
       */
      this.changedParentTypes = new Map();
      /**
       * @type {Array<AbstractStruct>}
       */
      this._mergeStructs = [];
      /**
       * @type {any}
       */
      this.origin = origin;
      /**
       * Stores meta information on the transaction
       * @type {Map<any,any>}
       */
      this.meta = new Map();
      /**
       * Whether this change originates from this doc.
       * @type {boolean}
       */
      this.local = local;
      /**
       * @type {Set<Doc>}
       */
      this.subdocsAdded = new Set();
      /**
       * @type {Set<Doc>}
       */
      this.subdocsRemoved = new Set();
      /**
       * @type {Set<Doc>}
       */
      this.subdocsLoaded = new Set();
    }
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {Transaction} transaction
   * @return {boolean} Whether data was written.
   */
  const writeUpdateMessageFromTransaction = (encoder, transaction) => {
    if (transaction.deleteSet.clients.size === 0 && !any(transaction.afterState, (clock, client) => transaction.beforeState.get(client) !== clock)) {
      return false
    }
    sortAndMergeDeleteSet(transaction.deleteSet);
    writeStructsFromTransaction(encoder, transaction);
    writeDeleteSet(encoder, transaction.deleteSet);
    return true
  };

  /**
   * If `type.parent` was added in current transaction, `type` technically
   * did not change, it was just added and we should not fire events for `type`.
   *
   * @param {Transaction} transaction
   * @param {AbstractType<YEvent<any>>} type
   * @param {string|null} parentSub
   */
  const addChangedTypeToTransaction = (transaction, type, parentSub) => {
    const item = type._item;
    if (item === null || (item.id.clock < (transaction.beforeState.get(item.id.client) || 0) && !item.deleted)) {
      setIfUndefined(transaction.changed, type, create$5).add(parentSub);
    }
  };

  /**
   * @param {Array<AbstractStruct>} structs
   * @param {number} pos
   */
  const tryToMergeWithLeft = (structs, pos) => {
    const left = structs[pos - 1];
    const right = structs[pos];
    if (left.deleted === right.deleted && left.constructor === right.constructor) {
      if (left.mergeWith(right)) {
        structs.splice(pos, 1);
        if (right instanceof Item && right.parentSub !== null && /** @type {AbstractType<any>} */ (right.parent)._map.get(right.parentSub) === right) {
          /** @type {AbstractType<any>} */ (right.parent)._map.set(right.parentSub, /** @type {Item} */ (left));
        }
      }
    }
  };

  /**
   * @param {DeleteSet} ds
   * @param {StructStore} store
   * @param {function(Item):boolean} gcFilter
   */
  const tryGcDeleteSet = (ds, store, gcFilter) => {
    for (const [client, deleteItems] of ds.clients.entries()) {
      const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
      for (let di = deleteItems.length - 1; di >= 0; di--) {
        const deleteItem = deleteItems[di];
        const endDeleteItemClock = deleteItem.clock + deleteItem.len;
        for (
          let si = findIndexSS(structs, deleteItem.clock), struct = structs[si];
          si < structs.length && struct.id.clock < endDeleteItemClock;
          struct = structs[++si]
        ) {
          const struct = structs[si];
          if (deleteItem.clock + deleteItem.len <= struct.id.clock) {
            break
          }
          if (struct instanceof Item && struct.deleted && !struct.keep && gcFilter(struct)) {
            struct.gc(store, false);
          }
        }
      }
    }
  };

  /**
   * @param {DeleteSet} ds
   * @param {StructStore} store
   */
  const tryMergeDeleteSet = (ds, store) => {
    // try to merge deleted / gc'd items
    // merge from right to left for better efficiecy and so we don't miss any merge targets
    ds.clients.forEach((deleteItems, client) => {
      const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
      for (let di = deleteItems.length - 1; di >= 0; di--) {
        const deleteItem = deleteItems[di];
        // start with merging the item next to the last deleted item
        const mostRightIndexToCheck = min(structs.length - 1, 1 + findIndexSS(structs, deleteItem.clock + deleteItem.len - 1));
        for (
          let si = mostRightIndexToCheck, struct = structs[si];
          si > 0 && struct.id.clock >= deleteItem.clock;
          struct = structs[--si]
        ) {
          tryToMergeWithLeft(structs, si);
        }
      }
    });
  };

  /**
   * @param {DeleteSet} ds
   * @param {StructStore} store
   * @param {function(Item):boolean} gcFilter
   */
  const tryGc$1 = (ds, store, gcFilter) => {
    tryGcDeleteSet(ds, store, gcFilter);
    tryMergeDeleteSet(ds, store);
  };

  /**
   * @param {Array<Transaction>} transactionCleanups
   * @param {number} i
   */
  const cleanupTransactions = (transactionCleanups, i) => {
    if (i < transactionCleanups.length) {
      const transaction = transactionCleanups[i];
      const doc = transaction.doc;
      const store = doc.store;
      const ds = transaction.deleteSet;
      const mergeStructs = transaction._mergeStructs;
      try {
        sortAndMergeDeleteSet(ds);
        transaction.afterState = getStateVector(transaction.doc.store);
        doc.emit('beforeObserverCalls', [transaction, doc]);
        /**
         * An array of event callbacks.
         *
         * Each callback is called even if the other ones throw errors.
         *
         * @type {Array<function():void>}
         */
        const fs = [];
        // observe events on changed types
        transaction.changed.forEach((subs, itemtype) =>
          fs.push(() => {
            if (itemtype._item === null || !itemtype._item.deleted) {
              itemtype._callObserver(transaction, subs);
            }
          })
        );
        fs.push(() => {
          // deep observe events
          transaction.changedParentTypes.forEach((events, type) =>
            fs.push(() => {
              // We need to think about the possibility that the user transforms the
              // Y.Doc in the event.
              if (type._item === null || !type._item.deleted) {
                events = events
                  .filter(event =>
                    event.target._item === null || !event.target._item.deleted
                  );
                events
                  .forEach(event => {
                    event.currentTarget = type;
                  });
                // sort events by path length so that top-level events are fired first.
                events
                  .sort((event1, event2) => event1.path.length - event2.path.length);
                // We don't need to check for events.length
                // because we know it has at least one element
                callEventHandlerListeners(type._dEH, events, transaction);
              }
            })
          );
          fs.push(() => doc.emit('afterTransaction', [transaction, doc]));
        });
        callAll(fs, []);
      } finally {
        // Replace deleted items with ItemDeleted / GC.
        // This is where content is actually remove from the Yjs Doc.
        if (doc.gc) {
          tryGcDeleteSet(ds, store, doc.gcFilter);
        }
        tryMergeDeleteSet(ds, store);

        // on all affected store.clients props, try to merge
        transaction.afterState.forEach((clock, client) => {
          const beforeClock = transaction.beforeState.get(client) || 0;
          if (beforeClock !== clock) {
            const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
            // we iterate from right to left so we can safely remove entries
            const firstChangePos = max(findIndexSS(structs, beforeClock), 1);
            for (let i = structs.length - 1; i >= firstChangePos; i--) {
              tryToMergeWithLeft(structs, i);
            }
          }
        });
        // try to merge mergeStructs
        // @todo: it makes more sense to transform mergeStructs to a DS, sort it, and merge from right to left
        //        but at the moment DS does not handle duplicates
        for (let i = 0; i < mergeStructs.length; i++) {
          const { client, clock } = mergeStructs[i].id;
          const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
          const replacedStructPos = findIndexSS(structs, clock);
          if (replacedStructPos + 1 < structs.length) {
            tryToMergeWithLeft(structs, replacedStructPos + 1);
          }
          if (replacedStructPos > 0) {
            tryToMergeWithLeft(structs, replacedStructPos);
          }
        }
        if (!transaction.local && transaction.afterState.get(doc.clientID) !== transaction.beforeState.get(doc.clientID)) {
          print(ORANGE, BOLD, '[yjs] ', UNBOLD, RED, 'Changed the client-id because another client seems to be using it.');
          doc.clientID = generateNewClientId();
        }
        // @todo Merge all the transactions into one and provide send the data as a single update message
        doc.emit('afterTransactionCleanup', [transaction, doc]);
        if (doc._observers.has('update')) {
          const encoder = new UpdateEncoderV1();
          const hasContent = writeUpdateMessageFromTransaction(encoder, transaction);
          if (hasContent) {
            doc.emit('update', [encoder.toUint8Array(), transaction.origin, doc, transaction]);
          }
        }
        if (doc._observers.has('updateV2')) {
          const encoder = new UpdateEncoderV2();
          const hasContent = writeUpdateMessageFromTransaction(encoder, transaction);
          if (hasContent) {
            doc.emit('updateV2', [encoder.toUint8Array(), transaction.origin, doc, transaction]);
          }
        }
        const { subdocsAdded, subdocsLoaded, subdocsRemoved } = transaction;
        if (subdocsAdded.size > 0 || subdocsRemoved.size > 0 || subdocsLoaded.size > 0) {
          subdocsAdded.forEach(subdoc => {
            subdoc.clientID = doc.clientID;
            if (subdoc.collectionid == null) {
              subdoc.collectionid = doc.collectionid;
            }
            doc.subdocs.add(subdoc);
          });
          subdocsRemoved.forEach(subdoc => doc.subdocs.delete(subdoc));
          doc.emit('subdocs', [{ loaded: subdocsLoaded, added: subdocsAdded, removed: subdocsRemoved }, doc, transaction]);
          subdocsRemoved.forEach(subdoc => subdoc.destroy());
        }

        if (transactionCleanups.length <= i + 1) {
          doc._transactionCleanups = [];
          doc.emit('afterAllTransactions', [doc, transactionCleanups]);
        } else {
          cleanupTransactions(transactionCleanups, i + 1);
        }
      }
    }
  };

  /**
   * Implements the functionality of `y.transact(()=>{..})`
   *
   * @template T
   * @param {Doc} doc
   * @param {function(Transaction):T} f
   * @param {any} [origin=true]
   * @return {T}
   *
   * @function
   */
  const transact = (doc, f, origin = null, local = true) => {
    const transactionCleanups = doc._transactionCleanups;
    let initialCall = false;
    /**
     * @type {any}
     */
    let result = null;
    if (doc._transaction === null) {
      initialCall = true;
      doc._transaction = new Transaction(doc, origin, local);
      transactionCleanups.push(doc._transaction);
      if (transactionCleanups.length === 1) {
        doc.emit('beforeAllTransactions', [doc]);
      }
      doc.emit('beforeTransaction', [doc._transaction, doc]);
    }
    try {
      result = f(doc._transaction);
    } finally {
      if (initialCall) {
        const finishCleanup = doc._transaction === transactionCleanups[0];
        doc._transaction = null;
        if (finishCleanup) {
          // The first transaction ended, now process observer calls.
          // Observer call may create new transactions for which we need to call the observers and do cleanup.
          // We don't want to nest these calls, so we execute these calls one after
          // another.
          // Also we need to ensure that all cleanups are called, even if the
          // observes throw errors.
          // This file is full of hacky try {} finally {} blocks to ensure that an
          // event can throw errors and also that the cleanup is called.
          cleanupTransactions(transactionCleanups, 0);
        }
      }
    }
    return result
  };

  class StackItem {
    /**
     * @param {DeleteSet} deletions
     * @param {DeleteSet} insertions
     */
    constructor (deletions, insertions) {
      this.insertions = insertions;
      this.deletions = deletions;
      /**
       * Use this to save and restore metadata like selection range
       */
      this.meta = new Map();
    }
  }
  /**
   * @param {Transaction} tr
   * @param {UndoManager} um
   * @param {StackItem} stackItem
   */
  const clearUndoManagerStackItem = (tr, um, stackItem) => {
    iterateDeletedStructs(tr, stackItem.deletions, item => {
      if (item instanceof Item && um.scope.some(type => isParentOf(type, item))) {
        keepItem(item, false);
      }
    });
  };

  /**
   * @param {UndoManager} undoManager
   * @param {Array<StackItem>} stack
   * @param {string} eventType
   * @return {StackItem?}
   */
  const popStackItem = (undoManager, stack, eventType) => {
    /**
     * Whether a change happened
     * @type {StackItem?}
     */
    let result = null;
    /**
     * Keep a reference to the transaction so we can fire the event with the changedParentTypes
     * @type {any}
     */
    let _tr = null;
    const doc = undoManager.doc;
    const scope = undoManager.scope;
    transact(doc, transaction => {
      while (stack.length > 0 && result === null) {
        const store = doc.store;
        const stackItem = /** @type {StackItem} */ (stack.pop());
        /**
         * @type {Set<Item>}
         */
        const itemsToRedo = new Set();
        /**
         * @type {Array<Item>}
         */
        const itemsToDelete = [];
        let performedChange = false;
        iterateDeletedStructs(transaction, stackItem.insertions, struct => {
          if (struct instanceof Item) {
            if (struct.redone !== null) {
              let { item, diff } = followRedone(store, struct.id);
              if (diff > 0) {
                item = getItemCleanStart(transaction, createID(item.id.client, item.id.clock + diff));
              }
              struct = item;
            }
            if (!struct.deleted && scope.some(type => isParentOf(type, /** @type {Item} */ (struct)))) {
              itemsToDelete.push(struct);
            }
          }
        });
        iterateDeletedStructs(transaction, stackItem.deletions, struct => {
          if (
            struct instanceof Item &&
            scope.some(type => isParentOf(type, struct)) &&
            // Never redo structs in stackItem.insertions because they were created and deleted in the same capture interval.
            !isDeleted(stackItem.insertions, struct.id)
          ) {
            itemsToRedo.add(struct);
          }
        });
        itemsToRedo.forEach(struct => {
          performedChange = redoItem(transaction, struct, itemsToRedo, stackItem.insertions, undoManager.ignoreRemoteMapChanges, undoManager) !== null || performedChange;
        });
        // We want to delete in reverse order so that children are deleted before
        // parents, so we have more information available when items are filtered.
        for (let i = itemsToDelete.length - 1; i >= 0; i--) {
          const item = itemsToDelete[i];
          if (undoManager.deleteFilter(item)) {
            item.delete(transaction);
            performedChange = true;
          }
        }
        result = performedChange ? stackItem : null;
      }
      transaction.changed.forEach((subProps, type) => {
        // destroy search marker if necessary
        if (subProps.has(null) && type._searchMarker) {
          type._searchMarker.length = 0;
        }
      });
      _tr = transaction;
    }, undoManager);
    if (result != null) {
      const changedParentTypes = _tr.changedParentTypes;
      undoManager.emit('stack-item-popped', [{ stackItem: result, type: eventType, changedParentTypes }, undoManager]);
    }
    return result
  };

  /**
   * @typedef {Object} UndoManagerOptions
   * @property {number} [UndoManagerOptions.captureTimeout=500]
   * @property {function(Transaction):boolean} [UndoManagerOptions.captureTransaction] Do not capture changes of a Transaction if result false.
   * @property {function(Item):boolean} [UndoManagerOptions.deleteFilter=()=>true] Sometimes
   * it is necessary to filter what an Undo/Redo operation can delete. If this
   * filter returns false, the type/item won't be deleted even it is in the
   * undo/redo scope.
   * @property {Set<any>} [UndoManagerOptions.trackedOrigins=new Set([null])]
   * @property {boolean} [ignoreRemoteMapChanges] Experimental. By default, the UndoManager will never overwrite remote changes. Enable this property to enable overwriting remote changes on key-value changes (Y.Map, properties on Y.Xml, etc..).
   * @property {Doc} [doc] The document that this UndoManager operates on. Only needed if typeScope is empty.
   */

  /**
   * Fires 'stack-item-added' event when a stack item was added to either the undo- or
   * the redo-stack. You may store additional stack information via the
   * metadata property on `event.stackItem.meta` (it is a `Map` of metadata properties).
   * Fires 'stack-item-popped' event when a stack item was popped from either the
   * undo- or the redo-stack. You may restore the saved stack information from `event.stackItem.meta`.
   *
   * @extends {Observable<'stack-item-added'|'stack-item-popped'|'stack-cleared'|'stack-item-updated'>}
   */
  class UndoManager extends Observable {
    /**
     * @param {AbstractType<any>|Array<AbstractType<any>>} typeScope Accepts either a single type, or an array of types
     * @param {UndoManagerOptions} options
     */
    constructor (typeScope, {
      captureTimeout = 500,
      captureTransaction = _tr => true,
      deleteFilter = () => true,
      trackedOrigins = new Set([null]),
      ignoreRemoteMapChanges = false,
      doc = /** @type {Doc} */ (isArray(typeScope) ? typeScope[0].doc : typeScope.doc)
    } = {}) {
      super();
      /**
       * @type {Array<AbstractType<any>>}
       */
      this.scope = [];
      this.addToScope(typeScope);
      this.deleteFilter = deleteFilter;
      trackedOrigins.add(this);
      this.trackedOrigins = trackedOrigins;
      this.captureTransaction = captureTransaction;
      /**
       * @type {Array<StackItem>}
       */
      this.undoStack = [];
      /**
       * @type {Array<StackItem>}
       */
      this.redoStack = [];
      /**
       * Whether the client is currently undoing (calling UndoManager.undo)
       *
       * @type {boolean}
       */
      this.undoing = false;
      this.redoing = false;
      this.doc = doc;
      this.lastChange = 0;
      this.ignoreRemoteMapChanges = ignoreRemoteMapChanges;
      this.captureTimeout = captureTimeout;
      /**
       * @param {Transaction} transaction
       */
      this.afterTransactionHandler = transaction => {
        // Only track certain transactions
        if (
          !this.captureTransaction(transaction) ||
          !this.scope.some(type => transaction.changedParentTypes.has(type)) ||
          (!this.trackedOrigins.has(transaction.origin) && (!transaction.origin || !this.trackedOrigins.has(transaction.origin.constructor)))
        ) {
          return
        }
        const undoing = this.undoing;
        const redoing = this.redoing;
        const stack = undoing ? this.redoStack : this.undoStack;
        if (undoing) {
          this.stopCapturing(); // next undo should not be appended to last stack item
        } else if (!redoing) {
          // neither undoing nor redoing: delete redoStack
          this.clear(false, true);
        }
        const insertions = new DeleteSet();
        transaction.afterState.forEach((endClock, client) => {
          const startClock = transaction.beforeState.get(client) || 0;
          const len = endClock - startClock;
          if (len > 0) {
            addToDeleteSet(insertions, client, startClock, len);
          }
        });
        const now = getUnixTime();
        let didAdd = false;
        if (this.lastChange > 0 && now - this.lastChange < this.captureTimeout && stack.length > 0 && !undoing && !redoing) {
          // append change to last stack op
          const lastOp = stack[stack.length - 1];
          lastOp.deletions = mergeDeleteSets([lastOp.deletions, transaction.deleteSet]);
          lastOp.insertions = mergeDeleteSets([lastOp.insertions, insertions]);
        } else {
          // create a new stack op
          stack.push(new StackItem(transaction.deleteSet, insertions));
          didAdd = true;
        }
        if (!undoing && !redoing) {
          this.lastChange = now;
        }
        // make sure that deleted structs are not gc'd
        iterateDeletedStructs(transaction, transaction.deleteSet, /** @param {Item|GC} item */ item => {
          if (item instanceof Item && this.scope.some(type => isParentOf(type, item))) {
            keepItem(item, true);
          }
        });
        const changeEvent = [{ stackItem: stack[stack.length - 1], origin: transaction.origin, type: undoing ? 'redo' : 'undo', changedParentTypes: transaction.changedParentTypes }, this];
        if (didAdd) {
          this.emit('stack-item-added', changeEvent);
        } else {
          this.emit('stack-item-updated', changeEvent);
        }
      };
      this.doc.on('afterTransaction', this.afterTransactionHandler);
      this.doc.on('destroy', () => {
        this.destroy();
      });
    }

    /**
     * @param {Array<AbstractType<any>> | AbstractType<any>} ytypes
     */
    addToScope (ytypes) {
      ytypes = isArray(ytypes) ? ytypes : [ytypes];
      ytypes.forEach(ytype => {
        if (this.scope.every(yt => yt !== ytype)) {
          this.scope.push(ytype);
        }
      });
    }

    /**
     * @param {any} origin
     */
    addTrackedOrigin (origin) {
      this.trackedOrigins.add(origin);
    }

    /**
     * @param {any} origin
     */
    removeTrackedOrigin (origin) {
      this.trackedOrigins.delete(origin);
    }

    clear (clearUndoStack = true, clearRedoStack = true) {
      if ((clearUndoStack && this.canUndo()) || (clearRedoStack && this.canRedo())) {
        this.doc.transact(tr => {
          if (clearUndoStack) {
            this.undoStack.forEach(item => clearUndoManagerStackItem(tr, this, item));
            this.undoStack = [];
          }
          if (clearRedoStack) {
            this.redoStack.forEach(item => clearUndoManagerStackItem(tr, this, item));
            this.redoStack = [];
          }
          this.emit('stack-cleared', [{ undoStackCleared: clearUndoStack, redoStackCleared: clearRedoStack }]);
        });
      }
    }

    /**
     * UndoManager merges Undo-StackItem if they are created within time-gap
     * smaller than `options.captureTimeout`. Call `um.stopCapturing()` so that the next
     * StackItem won't be merged.
     *
     *
     * @example
     *     // without stopCapturing
     *     ytext.insert(0, 'a')
     *     ytext.insert(1, 'b')
     *     um.undo()
     *     ytext.toString() // => '' (note that 'ab' was removed)
     *     // with stopCapturing
     *     ytext.insert(0, 'a')
     *     um.stopCapturing()
     *     ytext.insert(0, 'b')
     *     um.undo()
     *     ytext.toString() // => 'a' (note that only 'b' was removed)
     *
     */
    stopCapturing () {
      this.lastChange = 0;
    }

    /**
     * Undo last changes on type.
     *
     * @return {StackItem?} Returns StackItem if a change was applied
     */
    undo () {
      this.undoing = true;
      let res;
      try {
        res = popStackItem(this, this.undoStack, 'undo');
      } finally {
        this.undoing = false;
      }
      return res
    }

    /**
     * Redo last undo operation.
     *
     * @return {StackItem?} Returns StackItem if a change was applied
     */
    redo () {
      this.redoing = true;
      let res;
      try {
        res = popStackItem(this, this.redoStack, 'redo');
      } finally {
        this.redoing = false;
      }
      return res
    }

    /**
     * Are undo steps available?
     *
     * @return {boolean} `true` if undo is possible
     */
    canUndo () {
      return this.undoStack.length > 0
    }

    /**
     * Are redo steps available?
     *
     * @return {boolean} `true` if redo is possible
     */
    canRedo () {
      return this.redoStack.length > 0
    }

    destroy () {
      this.trackedOrigins.delete(this);
      this.doc.off('afterTransaction', this.afterTransactionHandler);
      super.destroy();
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   */
  function * lazyStructReaderGenerator (decoder) {
    const numOfStateUpdates = readVarUint(decoder.restDecoder);
    for (let i = 0; i < numOfStateUpdates; i++) {
      const numberOfStructs = readVarUint(decoder.restDecoder);
      const client = decoder.readClient();
      let clock = readVarUint(decoder.restDecoder);
      for (let i = 0; i < numberOfStructs; i++) {
        const info = decoder.readInfo();
        // @todo use switch instead of ifs
        if (info === 10) {
          const len = readVarUint(decoder.restDecoder);
          yield new Skip(createID(client, clock), len);
          clock += len;
        } else if ((BITS5 & info) !== 0) {
          const cantCopyParentInfo = (info & (BIT7 | BIT8)) === 0;
          // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
          // and we read the next string as parentYKey.
          // It indicates how we store/retrieve parent from `y.share`
          // @type {string|null}
          const struct = new Item(
            createID(client, clock),
            null, // left
            (info & BIT8) === BIT8 ? decoder.readLeftID() : null, // origin
            null, // right
            (info & BIT7) === BIT7 ? decoder.readRightID() : null, // right origin
            // @ts-ignore Force writing a string here.
            cantCopyParentInfo ? (decoder.readParentInfo() ? decoder.readString() : decoder.readLeftID()) : null, // parent
            cantCopyParentInfo && (info & BIT6) === BIT6 ? decoder.readString() : null, // parentSub
            readItemContent(decoder, info) // item content
          );
          yield struct;
          clock += struct.length;
        } else {
          const len = decoder.readLen();
          yield new GC(createID(client, clock), len);
          clock += len;
        }
      }
    }
  }

  class LazyStructReader {
    /**
     * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
     * @param {boolean} filterSkips
     */
    constructor (decoder, filterSkips) {
      this.gen = lazyStructReaderGenerator(decoder);
      /**
       * @type {null | Item | Skip | GC}
       */
      this.curr = null;
      this.done = false;
      this.filterSkips = filterSkips;
      this.next();
    }

    /**
     * @return {Item | GC | Skip |null}
     */
    next () {
      // ignore "Skip" structs
      do {
        this.curr = this.gen.next().value || null;
      } while (this.filterSkips && this.curr !== null && this.curr.constructor === Skip)
      return this.curr
    }
  }

  /**
   * @param {Uint8Array} update
   *
   */
  const logUpdate = update => logUpdateV2(update, UpdateDecoderV1);

  /**
   * @param {Uint8Array} update
   * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} [YDecoder]
   *
   */
  const logUpdateV2 = (update, YDecoder = UpdateDecoderV2) => {
    const structs = [];
    const updateDecoder = new YDecoder(createDecoder(update));
    const lazyDecoder = new LazyStructReader(updateDecoder, false);
    for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
      structs.push(curr);
    }
    print('Structs: ', structs);
    const ds = readDeleteSet(updateDecoder);
    print('DeleteSet: ', ds);
  };

  /**
   * @param {Uint8Array} update
   *
   */
  const decodeUpdate = (update) => decodeUpdateV2(update, UpdateDecoderV1);

  /**
   * @param {Uint8Array} update
   * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} [YDecoder]
   *
   */
  const decodeUpdateV2 = (update, YDecoder = UpdateDecoderV2) => {
    const structs = [];
    const updateDecoder = new YDecoder(createDecoder(update));
    const lazyDecoder = new LazyStructReader(updateDecoder, false);
    for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
      structs.push(curr);
    }
    return {
      structs,
      ds: readDeleteSet(updateDecoder)
    }
  };

  class LazyStructWriter {
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     */
    constructor (encoder) {
      this.currClient = 0;
      this.startClock = 0;
      this.written = 0;
      this.encoder = encoder;
      /**
       * We want to write operations lazily, but also we need to know beforehand how many operations we want to write for each client.
       *
       * This kind of meta-information (#clients, #structs-per-client-written) is written to the restEncoder.
       *
       * We fragment the restEncoder and store a slice of it per-client until we know how many clients there are.
       * When we flush (toUint8Array) we write the restEncoder using the fragments and the meta-information.
       *
       * @type {Array<{ written: number, restEncoder: Uint8Array }>}
       */
      this.clientStructs = [];
    }
  }

  /**
   * @param {Array<Uint8Array>} updates
   * @return {Uint8Array}
   */
  const mergeUpdates = updates => mergeUpdatesV2(updates, UpdateDecoderV1, UpdateEncoderV1);

  /**
   * @param {Uint8Array} update
   * @param {typeof DSEncoderV1 | typeof DSEncoderV2} YEncoder
   * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} YDecoder
   * @return {Uint8Array}
   */
  const encodeStateVectorFromUpdateV2 = (update, YEncoder = DSEncoderV2, YDecoder = UpdateDecoderV2) => {
    const encoder = new YEncoder();
    const updateDecoder = new LazyStructReader(new YDecoder(createDecoder(update)), false);
    let curr = updateDecoder.curr;
    if (curr !== null) {
      let size = 0;
      let currClient = curr.id.client;
      let stopCounting = curr.id.clock !== 0; // must start at 0
      let currClock = stopCounting ? 0 : curr.id.clock + curr.length;
      for (; curr !== null; curr = updateDecoder.next()) {
        if (currClient !== curr.id.client) {
          if (currClock !== 0) {
            size++;
            // We found a new client
            // write what we have to the encoder
            writeVarUint(encoder.restEncoder, currClient);
            writeVarUint(encoder.restEncoder, currClock);
          }
          currClient = curr.id.client;
          currClock = 0;
          stopCounting = curr.id.clock !== 0;
        }
        // we ignore skips
        if (curr.constructor === Skip) {
          stopCounting = true;
        }
        if (!stopCounting) {
          currClock = curr.id.clock + curr.length;
        }
      }
      // write what we have
      if (currClock !== 0) {
        size++;
        writeVarUint(encoder.restEncoder, currClient);
        writeVarUint(encoder.restEncoder, currClock);
      }
      // prepend the size of the state vector
      const enc = createEncoder();
      writeVarUint(enc, size);
      writeBinaryEncoder(enc, encoder.restEncoder);
      encoder.restEncoder = enc;
      return encoder.toUint8Array()
    } else {
      writeVarUint(encoder.restEncoder, 0);
      return encoder.toUint8Array()
    }
  };

  /**
   * @param {Uint8Array} update
   * @return {Uint8Array}
   */
  const encodeStateVectorFromUpdate = update => encodeStateVectorFromUpdateV2(update, DSEncoderV1, UpdateDecoderV1);

  /**
   * @param {Uint8Array} update
   * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} YDecoder
   * @return {{ from: Map<number,number>, to: Map<number,number> }}
   */
  const parseUpdateMetaV2 = (update, YDecoder = UpdateDecoderV2) => {
    /**
     * @type {Map<number, number>}
     */
    const from = new Map();
    /**
     * @type {Map<number, number>}
     */
    const to = new Map();
    const updateDecoder = new LazyStructReader(new YDecoder(createDecoder(update)), false);
    let curr = updateDecoder.curr;
    if (curr !== null) {
      let currClient = curr.id.client;
      let currClock = curr.id.clock;
      // write the beginning to `from`
      from.set(currClient, currClock);
      for (; curr !== null; curr = updateDecoder.next()) {
        if (currClient !== curr.id.client) {
          // We found a new client
          // write the end to `to`
          to.set(currClient, currClock);
          // write the beginning to `from`
          from.set(curr.id.client, curr.id.clock);
          // update currClient
          currClient = curr.id.client;
        }
        currClock = curr.id.clock + curr.length;
      }
      // write the end to `to`
      to.set(currClient, currClock);
    }
    return { from, to }
  };

  /**
   * @param {Uint8Array} update
   * @return {{ from: Map<number,number>, to: Map<number,number> }}
   */
  const parseUpdateMeta = update => parseUpdateMetaV2(update, UpdateDecoderV1);

  /**
   * This method is intended to slice any kind of struct and retrieve the right part.
   * It does not handle side-effects, so it should only be used by the lazy-encoder.
   *
   * @param {Item | GC | Skip} left
   * @param {number} diff
   * @return {Item | GC}
   */
  const sliceStruct = (left, diff) => {
    if (left.constructor === GC) {
      const { client, clock } = left.id;
      return new GC(createID(client, clock + diff), left.length - diff)
    } else if (left.constructor === Skip) {
      const { client, clock } = left.id;
      return new Skip(createID(client, clock + diff), left.length - diff)
    } else {
      const leftItem = /** @type {Item} */ (left);
      const { client, clock } = leftItem.id;
      return new Item(
        createID(client, clock + diff),
        null,
        createID(client, clock + diff - 1),
        null,
        leftItem.rightOrigin,
        leftItem.parent,
        leftItem.parentSub,
        leftItem.content.splice(diff)
      )
    }
  };

  /**
   *
   * This function works similarly to `readUpdateV2`.
   *
   * @param {Array<Uint8Array>} updates
   * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
   * @param {typeof UpdateEncoderV1 | typeof UpdateEncoderV2} [YEncoder]
   * @return {Uint8Array}
   */
  const mergeUpdatesV2 = (updates, YDecoder = UpdateDecoderV2, YEncoder = UpdateEncoderV2) => {
    if (updates.length === 1) {
      return updates[0]
    }
    const updateDecoders = updates.map(update => new YDecoder(createDecoder(update)));
    let lazyStructDecoders = updateDecoders.map(decoder => new LazyStructReader(decoder, true));

    /**
     * @todo we don't need offset because we always slice before
     * @type {null | { struct: Item | GC | Skip, offset: number }}
     */
    let currWrite = null;

    const updateEncoder = new YEncoder();
    // write structs lazily
    const lazyStructEncoder = new LazyStructWriter(updateEncoder);

    // Note: We need to ensure that all lazyStructDecoders are fully consumed
    // Note: Should merge document updates whenever possible - even from different updates
    // Note: Should handle that some operations cannot be applied yet ()

    while (true) {
      // Write higher clients first ⇒ sort by clientID & clock and remove decoders without content
      lazyStructDecoders = lazyStructDecoders.filter(dec => dec.curr !== null);
      lazyStructDecoders.sort(
        /** @type {function(any,any):number} */ (dec1, dec2) => {
          if (dec1.curr.id.client === dec2.curr.id.client) {
            const clockDiff = dec1.curr.id.clock - dec2.curr.id.clock;
            if (clockDiff === 0) {
              // @todo remove references to skip since the structDecoders must filter Skips.
              return dec1.curr.constructor === dec2.curr.constructor
                ? 0
                : dec1.curr.constructor === Skip ? 1 : -1 // we are filtering skips anyway.
            } else {
              return clockDiff
            }
          } else {
            return dec2.curr.id.client - dec1.curr.id.client
          }
        }
      );
      if (lazyStructDecoders.length === 0) {
        break
      }
      const currDecoder = lazyStructDecoders[0];
      // write from currDecoder until the next operation is from another client or if filler-struct
      // then we need to reorder the decoders and find the next operation to write
      const firstClient = /** @type {Item | GC} */ (currDecoder.curr).id.client;

      if (currWrite !== null) {
        let curr = /** @type {Item | GC | null} */ (currDecoder.curr);
        let iterated = false;

        // iterate until we find something that we haven't written already
        // remember: first the high client-ids are written
        while (curr !== null && curr.id.clock + curr.length <= currWrite.struct.id.clock + currWrite.struct.length && curr.id.client >= currWrite.struct.id.client) {
          curr = currDecoder.next();
          iterated = true;
        }
        if (
          curr === null || // current decoder is empty
          curr.id.client !== firstClient || // check whether there is another decoder that has has updates from `firstClient`
          (iterated && curr.id.clock > currWrite.struct.id.clock + currWrite.struct.length) // the above while loop was used and we are potentially missing updates
        ) {
          continue
        }

        if (firstClient !== currWrite.struct.id.client) {
          writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset);
          currWrite = { struct: curr, offset: 0 };
          currDecoder.next();
        } else {
          if (currWrite.struct.id.clock + currWrite.struct.length < curr.id.clock) {
            // @todo write currStruct & set currStruct = Skip(clock = currStruct.id.clock + currStruct.length, length = curr.id.clock - self.clock)
            if (currWrite.struct.constructor === Skip) {
              // extend existing skip
              currWrite.struct.length = curr.id.clock + curr.length - currWrite.struct.id.clock;
            } else {
              writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset);
              const diff = curr.id.clock - currWrite.struct.id.clock - currWrite.struct.length;
              /**
               * @type {Skip}
               */
              const struct = new Skip(createID(firstClient, currWrite.struct.id.clock + currWrite.struct.length), diff);
              currWrite = { struct, offset: 0 };
            }
          } else { // if (currWrite.struct.id.clock + currWrite.struct.length >= curr.id.clock) {
            const diff = currWrite.struct.id.clock + currWrite.struct.length - curr.id.clock;
            if (diff > 0) {
              if (currWrite.struct.constructor === Skip) {
                // prefer to slice Skip because the other struct might contain more information
                currWrite.struct.length -= diff;
              } else {
                curr = sliceStruct(curr, diff);
              }
            }
            if (!currWrite.struct.mergeWith(/** @type {any} */ (curr))) {
              writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset);
              currWrite = { struct: curr, offset: 0 };
              currDecoder.next();
            }
          }
        }
      } else {
        currWrite = { struct: /** @type {Item | GC} */ (currDecoder.curr), offset: 0 };
        currDecoder.next();
      }
      for (
        let next = currDecoder.curr;
        next !== null && next.id.client === firstClient && next.id.clock === currWrite.struct.id.clock + currWrite.struct.length && next.constructor !== Skip;
        next = currDecoder.next()
      ) {
        writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset);
        currWrite = { struct: next, offset: 0 };
      }
    }
    if (currWrite !== null) {
      writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset);
      currWrite = null;
    }
    finishLazyStructWriting(lazyStructEncoder);

    const dss = updateDecoders.map(decoder => readDeleteSet(decoder));
    const ds = mergeDeleteSets(dss);
    writeDeleteSet(updateEncoder, ds);
    return updateEncoder.toUint8Array()
  };

  /**
   * @param {Uint8Array} update
   * @param {Uint8Array} sv
   * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
   * @param {typeof UpdateEncoderV1 | typeof UpdateEncoderV2} [YEncoder]
   */
  const diffUpdateV2 = (update, sv, YDecoder = UpdateDecoderV2, YEncoder = UpdateEncoderV2) => {
    const state = decodeStateVector(sv);
    const encoder = new YEncoder();
    const lazyStructWriter = new LazyStructWriter(encoder);
    const decoder = new YDecoder(createDecoder(update));
    const reader = new LazyStructReader(decoder, false);
    while (reader.curr) {
      const curr = reader.curr;
      const currClient = curr.id.client;
      const svClock = state.get(currClient) || 0;
      if (reader.curr.constructor === Skip) {
        // the first written struct shouldn't be a skip
        reader.next();
        continue
      }
      if (curr.id.clock + curr.length > svClock) {
        writeStructToLazyStructWriter(lazyStructWriter, curr, max(svClock - curr.id.clock, 0));
        reader.next();
        while (reader.curr && reader.curr.id.client === currClient) {
          writeStructToLazyStructWriter(lazyStructWriter, reader.curr, 0);
          reader.next();
        }
      } else {
        // read until something new comes up
        while (reader.curr && reader.curr.id.client === currClient && reader.curr.id.clock + reader.curr.length <= svClock) {
          reader.next();
        }
      }
    }
    finishLazyStructWriting(lazyStructWriter);
    // write ds
    const ds = readDeleteSet(decoder);
    writeDeleteSet(encoder, ds);
    return encoder.toUint8Array()
  };

  /**
   * @param {Uint8Array} update
   * @param {Uint8Array} sv
   */
  const diffUpdate = (update, sv) => diffUpdateV2(update, sv, UpdateDecoderV1, UpdateEncoderV1);

  /**
   * @param {LazyStructWriter} lazyWriter
   */
  const flushLazyStructWriter = lazyWriter => {
    if (lazyWriter.written > 0) {
      lazyWriter.clientStructs.push({ written: lazyWriter.written, restEncoder: toUint8Array(lazyWriter.encoder.restEncoder) });
      lazyWriter.encoder.restEncoder = createEncoder();
      lazyWriter.written = 0;
    }
  };

  /**
   * @param {LazyStructWriter} lazyWriter
   * @param {Item | GC} struct
   * @param {number} offset
   */
  const writeStructToLazyStructWriter = (lazyWriter, struct, offset) => {
    // flush curr if we start another client
    if (lazyWriter.written > 0 && lazyWriter.currClient !== struct.id.client) {
      flushLazyStructWriter(lazyWriter);
    }
    if (lazyWriter.written === 0) {
      lazyWriter.currClient = struct.id.client;
      // write next client
      lazyWriter.encoder.writeClient(struct.id.client);
      // write startClock
      writeVarUint(lazyWriter.encoder.restEncoder, struct.id.clock + offset);
    }
    struct.write(lazyWriter.encoder, offset);
    lazyWriter.written++;
  };
  /**
   * Call this function when we collected all parts and want to
   * put all the parts together. After calling this method,
   * you can continue using the UpdateEncoder.
   *
   * @param {LazyStructWriter} lazyWriter
   */
  const finishLazyStructWriting = (lazyWriter) => {
    flushLazyStructWriter(lazyWriter);

    // this is a fresh encoder because we called flushCurr
    const restEncoder = lazyWriter.encoder.restEncoder;

    /**
     * Now we put all the fragments together.
     * This works similarly to `writeClientsStructs`
     */

    // write # states that were updated - i.e. the clients
    writeVarUint(restEncoder, lazyWriter.clientStructs.length);

    for (let i = 0; i < lazyWriter.clientStructs.length; i++) {
      const partStructs = lazyWriter.clientStructs[i];
      /**
       * Works similarly to `writeStructs`
       */
      // write # encoded structs
      writeVarUint(restEncoder, partStructs.written);
      // write the rest of the fragment
      writeUint8Array(restEncoder, partStructs.restEncoder);
    }
  };

  /**
   * @param {Uint8Array} update
   * @param {function(Item|GC|Skip):Item|GC|Skip} blockTransformer
   * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} YDecoder
   * @param {typeof UpdateEncoderV2 | typeof UpdateEncoderV1 } YEncoder
   */
  const convertUpdateFormat = (update, blockTransformer, YDecoder, YEncoder) => {
    const updateDecoder = new YDecoder(createDecoder(update));
    const lazyDecoder = new LazyStructReader(updateDecoder, false);
    const updateEncoder = new YEncoder();
    const lazyWriter = new LazyStructWriter(updateEncoder);
    for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
      writeStructToLazyStructWriter(lazyWriter, blockTransformer(curr), 0);
    }
    finishLazyStructWriting(lazyWriter);
    const ds = readDeleteSet(updateDecoder);
    writeDeleteSet(updateEncoder, ds);
    return updateEncoder.toUint8Array()
  };

  /**
   * @typedef {Object} ObfuscatorOptions
   * @property {boolean} [ObfuscatorOptions.formatting=true]
   * @property {boolean} [ObfuscatorOptions.subdocs=true]
   * @property {boolean} [ObfuscatorOptions.yxml=true] Whether to obfuscate nodeName / hookName
   */

  /**
   * @param {ObfuscatorOptions} obfuscator
   */
  const createObfuscator = ({ formatting = true, subdocs = true, yxml = true } = {}) => {
    let i = 0;
    const mapKeyCache = create$6();
    const nodeNameCache = create$6();
    const formattingKeyCache = create$6();
    const formattingValueCache = create$6();
    formattingValueCache.set(null, null); // end of a formatting range should always be the end of a formatting range
    /**
     * @param {Item|GC|Skip} block
     * @return {Item|GC|Skip}
     */
    return block => {
      switch (block.constructor) {
        case GC:
        case Skip:
          return block
        case Item: {
          const item = /** @type {Item} */ (block);
          const content = item.content;
          switch (content.constructor) {
            case ContentDeleted:
              break
            case ContentType: {
              if (yxml) {
                const type = /** @type {ContentType} */ (content).type;
                if (type instanceof YXmlElement) {
                  type.nodeName = setIfUndefined(nodeNameCache, type.nodeName, () => 'node-' + i);
                }
                if (type instanceof YXmlHook) {
                  type.hookName = setIfUndefined(nodeNameCache, type.hookName, () => 'hook-' + i);
                }
              }
              break
            }
            case ContentAny: {
              const c = /** @type {ContentAny} */ (content);
              c.arr = c.arr.map(() => i);
              break
            }
            case ContentBinary: {
              const c = /** @type {ContentBinary} */ (content);
              c.content = new Uint8Array([i]);
              break
            }
            case ContentDoc: {
              const c = /** @type {ContentDoc} */ (content);
              if (subdocs) {
                c.opts = {};
                c.doc.guid = i + '';
              }
              break
            }
            case ContentEmbed: {
              const c = /** @type {ContentEmbed} */ (content);
              c.embed = {};
              break
            }
            case ContentFormat: {
              const c = /** @type {ContentFormat} */ (content);
              if (formatting) {
                c.key = setIfUndefined(formattingKeyCache, c.key, () => i + '');
                c.value = setIfUndefined(formattingValueCache, c.value, () => ({ i }));
              }
              break
            }
            case ContentJSON: {
              const c = /** @type {ContentJSON} */ (content);
              c.arr = c.arr.map(() => i);
              break
            }
            case ContentString: {
              const c = /** @type {ContentString} */ (content);
              c.str = repeat((i % 10) + '', c.str.length);
              break
            }
            default:
              // unknown content type
              unexpectedCase();
          }
          if (item.parentSub) {
            item.parentSub = setIfUndefined(mapKeyCache, item.parentSub, () => i + '');
          }
          i++;
          return block
        }
        default:
          // unknown block-type
          unexpectedCase();
      }
    }
  };

  /**
   * This function obfuscates the content of a Yjs update. This is useful to share
   * buggy Yjs documents while significantly limiting the possibility that a
   * developer can on the user. Note that it might still be possible to deduce
   * some information by analyzing the "structure" of the document or by analyzing
   * the typing behavior using the CRDT-related metadata that is still kept fully
   * intact.
   *
   * @param {Uint8Array} update
   * @param {ObfuscatorOptions} [opts]
   */
  const obfuscateUpdate = (update, opts) => convertUpdateFormat(update, createObfuscator(opts), UpdateDecoderV1, UpdateEncoderV1);

  /**
   * @param {Uint8Array} update
   * @param {ObfuscatorOptions} [opts]
   */
  const obfuscateUpdateV2 = (update, opts) => convertUpdateFormat(update, createObfuscator(opts), UpdateDecoderV2, UpdateEncoderV2);

  /**
   * @param {Uint8Array} update
   */
  const convertUpdateFormatV1ToV2 = update => convertUpdateFormat(update, id$1, UpdateDecoderV1, UpdateEncoderV2);

  /**
   * @param {Uint8Array} update
   */
  const convertUpdateFormatV2ToV1 = update => convertUpdateFormat(update, id$1, UpdateDecoderV2, UpdateEncoderV1);

  /**
   * @template {AbstractType<any>} T
   * YEvent describes the changes on a YType.
   */
  class YEvent {
    /**
     * @param {T} target The changed type.
     * @param {Transaction} transaction
     */
    constructor (target, transaction) {
      /**
       * The type on which this event was created on.
       * @type {T}
       */
      this.target = target;
      /**
       * The current target on which the observe callback is called.
       * @type {AbstractType<any>}
       */
      this.currentTarget = target;
      /**
       * The transaction that triggered this event.
       * @type {Transaction}
       */
      this.transaction = transaction;
      /**
       * @type {Object|null}
       */
      this._changes = null;
      /**
       * @type {null | Map<string, { action: 'add' | 'update' | 'delete', oldValue: any, newValue: any }>}
       */
      this._keys = null;
      /**
       * @type {null | Array<{ insert?: string | Array<any> | object | AbstractType<any>, retain?: number, delete?: number, attributes?: Object<string, any> }>}
       */
      this._delta = null;
    }

    /**
     * Computes the path from `y` to the changed type.
     *
     * @todo v14 should standardize on path: Array<{parent, index}> because that is easier to work with.
     *
     * The following property holds:
     * @example
     *   let type = y
     *   event.path.forEach(dir => {
     *     type = type.get(dir)
     *   })
     *   type === event.target // => true
     */
    get path () {
      // @ts-ignore _item is defined because target is integrated
      return getPathTo(this.currentTarget, this.target)
    }

    /**
     * Check if a struct is deleted by this event.
     *
     * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
     *
     * @param {AbstractStruct} struct
     * @return {boolean}
     */
    deletes (struct) {
      return isDeleted(this.transaction.deleteSet, struct.id)
    }

    /**
     * @type {Map<string, { action: 'add' | 'update' | 'delete', oldValue: any, newValue: any }>}
     */
    get keys () {
      if (this._keys === null) {
        const keys = new Map();
        const target = this.target;
        const changed = /** @type Set<string|null> */ (this.transaction.changed.get(target));
        changed.forEach(key => {
          if (key !== null) {
            const item = /** @type {Item} */ (target._map.get(key));
            /**
             * @type {'delete' | 'add' | 'update'}
             */
            let action;
            let oldValue;
            if (this.adds(item)) {
              let prev = item.left;
              while (prev !== null && this.adds(prev)) {
                prev = prev.left;
              }
              if (this.deletes(item)) {
                if (prev !== null && this.deletes(prev)) {
                  action = 'delete';
                  oldValue = last(prev.content.getContent());
                } else {
                  return
                }
              } else {
                if (prev !== null && this.deletes(prev)) {
                  action = 'update';
                  oldValue = last(prev.content.getContent());
                } else {
                  action = 'add';
                  oldValue = undefined;
                }
              }
            } else {
              if (this.deletes(item)) {
                action = 'delete';
                oldValue = last(/** @type {Item} */ item.content.getContent());
              } else {
                return // nop
              }
            }
            keys.set(key, { action, oldValue });
          }
        });
        this._keys = keys;
      }
      return this._keys
    }

    /**
     * This is a computed property. Note that this can only be safely computed during the
     * event call. Computing this property after other changes happened might result in
     * unexpected behavior (incorrect computation of deltas). A safe way to collect changes
     * is to store the `changes` or the `delta` object. Avoid storing the `transaction` object.
     *
     * @type {Array<{insert?: string | Array<any> | object | AbstractType<any>, retain?: number, delete?: number, attributes?: Object<string, any>}>}
     */
    get delta () {
      return this.changes.delta
    }

    /**
     * Check if a struct is added by this event.
     *
     * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
     *
     * @param {AbstractStruct} struct
     * @return {boolean}
     */
    adds (struct) {
      return struct.id.clock >= (this.transaction.beforeState.get(struct.id.client) || 0)
    }

    /**
     * This is a computed property. Note that this can only be safely computed during the
     * event call. Computing this property after other changes happened might result in
     * unexpected behavior (incorrect computation of deltas). A safe way to collect changes
     * is to store the `changes` or the `delta` object. Avoid storing the `transaction` object.
     *
     * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert?:Array<any>|string, delete?:number, retain?:number}>}}
     */
    get changes () {
      let changes = this._changes;
      if (changes === null) {
        const target = this.target;
        const added = create$5();
        const deleted = create$5();
        /**
         * @type {Array<{insert:Array<any>}|{delete:number}|{retain:number}>}
         */
        const delta = [];
        changes = {
          added,
          deleted,
          delta,
          keys: this.keys
        };
        const changed = /** @type Set<string|null> */ (this.transaction.changed.get(target));
        if (changed.has(null)) {
          /**
           * @type {any}
           */
          let lastOp = null;
          const packOp = () => {
            if (lastOp) {
              delta.push(lastOp);
            }
          };
          for (let item = target._start; item !== null; item = item.right) {
            if (item.deleted) {
              if (this.deletes(item) && !this.adds(item)) {
                if (lastOp === null || lastOp.delete === undefined) {
                  packOp();
                  lastOp = { delete: 0 };
                }
                lastOp.delete += item.length;
                deleted.add(item);
              } // else nop
            } else {
              if (this.adds(item)) {
                if (lastOp === null || lastOp.insert === undefined) {
                  packOp();
                  lastOp = { insert: [] };
                }
                lastOp.insert = lastOp.insert.concat(item.content.getContent());
                added.add(item);
              } else {
                if (lastOp === null || lastOp.retain === undefined) {
                  packOp();
                  lastOp = { retain: 0 };
                }
                lastOp.retain += item.length;
              }
            }
          }
          if (lastOp !== null && lastOp.retain === undefined) {
            packOp();
          }
        }
        this._changes = changes;
      }
      return /** @type {any} */ (changes)
    }
  }

  /**
   * Compute the path from this type to the specified target.
   *
   * @example
   *   // `child` should be accessible via `type.get(path[0]).get(path[1])..`
   *   const path = type.getPathTo(child)
   *   // assuming `type instanceof YArray`
   *   console.log(path) // might look like => [2, 'key1']
   *   child === type.get(path[0]).get(path[1])
   *
   * @param {AbstractType<any>} parent
   * @param {AbstractType<any>} child target
   * @return {Array<string|number>} Path to the target
   *
   * @private
   * @function
   */
  const getPathTo = (parent, child) => {
    const path = [];
    while (child._item !== null && child !== parent) {
      if (child._item.parentSub !== null) {
        // parent is map-ish
        path.unshift(child._item.parentSub);
      } else {
        // parent is array-ish
        let i = 0;
        let c = /** @type {AbstractType<any>} */ (child._item.parent)._start;
        while (c !== child._item && c !== null) {
          if (!c.deleted) {
            i++;
          }
          c = c.right;
        }
        path.unshift(i);
      }
      child = /** @type {AbstractType<any>} */ (child._item.parent);
    }
    return path
  };

  /**
   * Utility module to create and manipulate Iterators.
   *
   * @module iterator
   */

  /**
   * @template T
   * @param {function():IteratorResult<T>} next
   * @return {IterableIterator<T>}
   */
  const createIterator = next => ({
    /**
     * @return {IterableIterator<T>}
     */
    [Symbol.iterator] () {
      return this
    },
    // @ts-ignore
    next
  });

  /**
   * @template T
   * @param {Iterator<T>} iterator
   * @param {function(T):boolean} filter
   */
  const iteratorFilter = (iterator, filter) => createIterator(() => {
    let res;
    do {
      res = iterator.next();
    } while (!res.done && !filter(res.value))
    return res
  });

  /**
   * @template T,M
   * @param {Iterator<T>} iterator
   * @param {function(T):M} fmap
   */
  const iteratorMap = (iterator, fmap) => createIterator(() => {
    const { done, value } = iterator.next();
    return { done, value: done ? undefined : fmap(value) }
  });

  const maxSearchMarker = 80;

  /**
   * A unique timestamp that identifies each marker.
   *
   * Time is relative,.. this is more like an ever-increasing clock.
   *
   * @type {number}
   */
  let globalSearchMarkerTimestamp = 0;

  class ArraySearchMarker {
    /**
     * @param {Item} p
     * @param {number} index
     */
    constructor (p, index) {
      p.marker = true;
      this.p = p;
      this.index = index;
      this.timestamp = globalSearchMarkerTimestamp++;
    }
  }

  /**
   * @param {ArraySearchMarker} marker
   */
  const refreshMarkerTimestamp = marker => { marker.timestamp = globalSearchMarkerTimestamp++; };

  /**
   * This is rather complex so this function is the only thing that should overwrite a marker
   *
   * @param {ArraySearchMarker} marker
   * @param {Item} p
   * @param {number} index
   */
  const overwriteMarker = (marker, p, index) => {
    marker.p.marker = false;
    marker.p = p;
    p.marker = true;
    marker.index = index;
    marker.timestamp = globalSearchMarkerTimestamp++;
  };

  /**
   * @param {Array<ArraySearchMarker>} searchMarker
   * @param {Item} p
   * @param {number} index
   */
  const markPosition = (searchMarker, p, index) => {
    if (searchMarker.length >= maxSearchMarker) {
      // override oldest marker (we don't want to create more objects)
      const marker = searchMarker.reduce((a, b) => a.timestamp < b.timestamp ? a : b);
      overwriteMarker(marker, p, index);
      return marker
    } else {
      // create new marker
      const pm = new ArraySearchMarker(p, index);
      searchMarker.push(pm);
      return pm
    }
  };

  /**
   * Search marker help us to find positions in the associative array faster.
   *
   * They speed up the process of finding a position without much bookkeeping.
   *
   * A maximum of `maxSearchMarker` objects are created.
   *
   * This function always returns a refreshed marker (updated timestamp)
   *
   * @param {AbstractType<any>} yarray
   * @param {number} index
   */
  const findMarker = (yarray, index) => {
    if (yarray._start === null || index === 0 || yarray._searchMarker === null) {
      return null
    }
    const marker = yarray._searchMarker.length === 0 ? null : yarray._searchMarker.reduce((a, b) => abs(index - a.index) < abs(index - b.index) ? a : b);
    let p = yarray._start;
    let pindex = 0;
    if (marker !== null) {
      p = marker.p;
      pindex = marker.index;
      refreshMarkerTimestamp(marker); // we used it, we might need to use it again
    }
    // iterate to right if possible
    while (p.right !== null && pindex < index) {
      if (!p.deleted && p.countable) {
        if (index < pindex + p.length) {
          break
        }
        pindex += p.length;
      }
      p = p.right;
    }
    // iterate to left if necessary (might be that pindex > index)
    while (p.left !== null && pindex > index) {
      p = p.left;
      if (!p.deleted && p.countable) {
        pindex -= p.length;
      }
    }
    // we want to make sure that p can't be merged with left, because that would screw up everything
    // in that cas just return what we have (it is most likely the best marker anyway)
    // iterate to left until p can't be merged with left
    while (p.left !== null && p.left.id.client === p.id.client && p.left.id.clock + p.left.length === p.id.clock) {
      p = p.left;
      if (!p.deleted && p.countable) {
        pindex -= p.length;
      }
    }

    // @todo remove!
    // assure position
    // {
    //   let start = yarray._start
    //   let pos = 0
    //   while (start !== p) {
    //     if (!start.deleted && start.countable) {
    //       pos += start.length
    //     }
    //     start = /** @type {Item} */ (start.right)
    //   }
    //   if (pos !== pindex) {
    //     debugger
    //     throw new Error('Gotcha position fail!')
    //   }
    // }
    // if (marker) {
    //   if (window.lengthes == null) {
    //     window.lengthes = []
    //     window.getLengthes = () => window.lengthes.sort((a, b) => a - b)
    //   }
    //   window.lengthes.push(marker.index - pindex)
    //   console.log('distance', marker.index - pindex, 'len', p && p.parent.length)
    // }
    if (marker !== null && abs(marker.index - pindex) < /** @type {YText|YArray<any>} */ (p.parent).length / maxSearchMarker) {
      // adjust existing marker
      overwriteMarker(marker, p, pindex);
      return marker
    } else {
      // create new marker
      return markPosition(yarray._searchMarker, p, pindex)
    }
  };

  /**
   * Update markers when a change happened.
   *
   * This should be called before doing a deletion!
   *
   * @param {Array<ArraySearchMarker>} searchMarker
   * @param {number} index
   * @param {number} len If insertion, len is positive. If deletion, len is negative.
   */
  const updateMarkerChanges = (searchMarker, index, len) => {
    for (let i = searchMarker.length - 1; i >= 0; i--) {
      const m = searchMarker[i];
      if (len > 0) {
        /**
         * @type {Item|null}
         */
        let p = m.p;
        p.marker = false;
        // Ideally we just want to do a simple position comparison, but this will only work if
        // search markers don't point to deleted items for formats.
        // Iterate marker to prev undeleted countable position so we know what to do when updating a position
        while (p && (p.deleted || !p.countable)) {
          p = p.left;
          if (p && !p.deleted && p.countable) {
            // adjust position. the loop should break now
            m.index -= p.length;
          }
        }
        if (p === null || p.marker === true) {
          // remove search marker if updated position is null or if position is already marked
          searchMarker.splice(i, 1);
          continue
        }
        m.p = p;
        p.marker = true;
      }
      if (index < m.index || (len > 0 && index === m.index)) { // a simple index <= m.index check would actually suffice
        m.index = max(index, m.index + len);
      }
    }
  };

  /**
   * Accumulate all (list) children of a type and return them as an Array.
   *
   * @param {AbstractType<any>} t
   * @return {Array<Item>}
   */
  const getTypeChildren = t => {
    let s = t._start;
    const arr = [];
    while (s) {
      arr.push(s);
      s = s.right;
    }
    return arr
  };

  /**
   * Call event listeners with an event. This will also add an event to all
   * parents (for `.observeDeep` handlers).
   *
   * @template EventType
   * @param {AbstractType<EventType>} type
   * @param {Transaction} transaction
   * @param {EventType} event
   */
  const callTypeObservers = (type, transaction, event) => {
    const changedType = type;
    const changedParentTypes = transaction.changedParentTypes;
    while (true) {
      // @ts-ignore
      setIfUndefined(changedParentTypes, type, () => []).push(event);
      if (type._item === null) {
        break
      }
      type = /** @type {AbstractType<any>} */ (type._item.parent);
    }
    callEventHandlerListeners(changedType._eH, event, transaction);
  };

  /**
   * @template EventType
   * Abstract Yjs Type class
   */
  class AbstractType {
    constructor () {
      /**
       * @type {Item|null}
       */
      this._item = null;
      /**
       * @type {Map<string,Item>}
       */
      this._map = new Map();
      /**
       * @type {Item|null}
       */
      this._start = null;
      /**
       * @type {Doc|null}
       */
      this.doc = null;
      this._length = 0;
      /**
       * Event handlers
       * @type {EventHandler<EventType,Transaction>}
       */
      this._eH = createEventHandler();
      /**
       * Deep event handlers
       * @type {EventHandler<Array<YEvent<any>>,Transaction>}
       */
      this._dEH = createEventHandler();
      /**
       * @type {null | Array<ArraySearchMarker>}
       */
      this._searchMarker = null;
    }

    /**
     * @return {AbstractType<any>|null}
     */
    get parent () {
      return this._item ? /** @type {AbstractType<any>} */ (this._item.parent) : null
    }

    /**
     * Integrate this type into the Yjs instance.
     *
     * * Save this struct in the os
     * * This type is sent to other client
     * * Observer functions are fired
     *
     * @param {Doc} y The Yjs instance
     * @param {Item|null} item
     */
    _integrate (y, item) {
      this.doc = y;
      this._item = item;
    }

    /**
     * @return {AbstractType<EventType>}
     */
    _copy () {
      throw methodUnimplemented()
    }

    /**
     * @return {AbstractType<EventType>}
     */
    clone () {
      throw methodUnimplemented()
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} _encoder
     */
    _write (_encoder) { }

    /**
     * The first non-deleted item
     */
    get _first () {
      let n = this._start;
      while (n !== null && n.deleted) {
        n = n.right;
      }
      return n
    }

    /**
     * Creates YEvent and calls all type observers.
     * Must be implemented by each type.
     *
     * @param {Transaction} transaction
     * @param {Set<null|string>} _parentSubs Keys changed on this type. `null` if list was modified.
     */
    _callObserver (transaction, _parentSubs) {
      if (!transaction.local && this._searchMarker) {
        this._searchMarker.length = 0;
      }
    }

    /**
     * Observe all events that are created on this type.
     *
     * @param {function(EventType, Transaction):void} f Observer function
     */
    observe (f) {
      addEventHandlerListener(this._eH, f);
    }

    /**
     * Observe all events that are created by this type and its children.
     *
     * @param {function(Array<YEvent<any>>,Transaction):void} f Observer function
     */
    observeDeep (f) {
      addEventHandlerListener(this._dEH, f);
    }

    /**
     * Unregister an observer function.
     *
     * @param {function(EventType,Transaction):void} f Observer function
     */
    unobserve (f) {
      removeEventHandlerListener(this._eH, f);
    }

    /**
     * Unregister an observer function.
     *
     * @param {function(Array<YEvent<any>>,Transaction):void} f Observer function
     */
    unobserveDeep (f) {
      removeEventHandlerListener(this._dEH, f);
    }

    /**
     * @abstract
     * @return {any}
     */
    toJSON () {}
  }

  /**
   * @param {AbstractType<any>} type
   * @param {number} start
   * @param {number} end
   * @return {Array<any>}
   *
   * @private
   * @function
   */
  const typeListSlice = (type, start, end) => {
    if (start < 0) {
      start = type._length + start;
    }
    if (end < 0) {
      end = type._length + end;
    }
    let len = end - start;
    const cs = [];
    let n = type._start;
    while (n !== null && len > 0) {
      if (n.countable && !n.deleted) {
        const c = n.content.getContent();
        if (c.length <= start) {
          start -= c.length;
        } else {
          for (let i = start; i < c.length && len > 0; i++) {
            cs.push(c[i]);
            len--;
          }
          start = 0;
        }
      }
      n = n.right;
    }
    return cs
  };

  /**
   * @param {AbstractType<any>} type
   * @return {Array<any>}
   *
   * @private
   * @function
   */
  const typeListToArray = type => {
    const cs = [];
    let n = type._start;
    while (n !== null) {
      if (n.countable && !n.deleted) {
        const c = n.content.getContent();
        for (let i = 0; i < c.length; i++) {
          cs.push(c[i]);
        }
      }
      n = n.right;
    }
    return cs
  };

  /**
   * @param {AbstractType<any>} type
   * @param {Snapshot} snapshot
   * @return {Array<any>}
   *
   * @private
   * @function
   */
  const typeListToArraySnapshot = (type, snapshot) => {
    const cs = [];
    let n = type._start;
    while (n !== null) {
      if (n.countable && isVisible(n, snapshot)) {
        const c = n.content.getContent();
        for (let i = 0; i < c.length; i++) {
          cs.push(c[i]);
        }
      }
      n = n.right;
    }
    return cs
  };

  /**
   * Executes a provided function on once on overy element of this YArray.
   *
   * @param {AbstractType<any>} type
   * @param {function(any,number,any):void} f A function to execute on every element of this YArray.
   *
   * @private
   * @function
   */
  const typeListForEach = (type, f) => {
    let index = 0;
    let n = type._start;
    while (n !== null) {
      if (n.countable && !n.deleted) {
        const c = n.content.getContent();
        for (let i = 0; i < c.length; i++) {
          f(c[i], index++, type);
        }
      }
      n = n.right;
    }
  };

  /**
   * @template C,R
   * @param {AbstractType<any>} type
   * @param {function(C,number,AbstractType<any>):R} f
   * @return {Array<R>}
   *
   * @private
   * @function
   */
  const typeListMap = (type, f) => {
    /**
     * @type {Array<any>}
     */
    const result = [];
    typeListForEach(type, (c, i) => {
      result.push(f(c, i, type));
    });
    return result
  };

  /**
   * @param {AbstractType<any>} type
   * @return {IterableIterator<any>}
   *
   * @private
   * @function
   */
  const typeListCreateIterator = type => {
    let n = type._start;
    /**
     * @type {Array<any>|null}
     */
    let currentContent = null;
    let currentContentIndex = 0;
    return {
      [Symbol.iterator] () {
        return this
      },
      next: () => {
        // find some content
        if (currentContent === null) {
          while (n !== null && n.deleted) {
            n = n.right;
          }
          // check if we reached the end, no need to check currentContent, because it does not exist
          if (n === null) {
            return {
              done: true,
              value: undefined
            }
          }
          // we found n, so we can set currentContent
          currentContent = n.content.getContent();
          currentContentIndex = 0;
          n = n.right; // we used the content of n, now iterate to next
        }
        const value = currentContent[currentContentIndex++];
        // check if we need to empty currentContent
        if (currentContent.length <= currentContentIndex) {
          currentContent = null;
        }
        return {
          done: false,
          value
        }
      }
    }
  };

  /**
   * @param {AbstractType<any>} type
   * @param {number} index
   * @return {any}
   *
   * @private
   * @function
   */
  const typeListGet = (type, index) => {
    const marker = findMarker(type, index);
    let n = type._start;
    if (marker !== null) {
      n = marker.p;
      index -= marker.index;
    }
    for (; n !== null; n = n.right) {
      if (!n.deleted && n.countable) {
        if (index < n.length) {
          return n.content.getContent()[index]
        }
        index -= n.length;
      }
    }
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {Item?} referenceItem
   * @param {Array<Object<string,any>|Array<any>|boolean|number|null|string|Uint8Array>} content
   *
   * @private
   * @function
   */
  const typeListInsertGenericsAfter = (transaction, parent, referenceItem, content) => {
    let left = referenceItem;
    const doc = transaction.doc;
    const ownClientId = doc.clientID;
    const store = doc.store;
    const right = referenceItem === null ? parent._start : referenceItem.right;
    /**
     * @type {Array<Object|Array<any>|number|null>}
     */
    let jsonContent = [];
    const packJsonContent = () => {
      if (jsonContent.length > 0) {
        left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentAny(jsonContent));
        left.integrate(transaction, 0);
        jsonContent = [];
      }
    };
    content.forEach(c => {
      if (c === null) {
        jsonContent.push(c);
      } else {
        switch (c.constructor) {
          case Number:
          case Object:
          case Boolean:
          case Array:
          case String:
            jsonContent.push(c);
            break
          default:
            packJsonContent();
            switch (c.constructor) {
              case Uint8Array:
              case ArrayBuffer:
                left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentBinary(new Uint8Array(/** @type {Uint8Array} */ (c))));
                left.integrate(transaction, 0);
                break
              case Doc:
                left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentDoc(/** @type {Doc} */ (c)));
                left.integrate(transaction, 0);
                break
              default:
                if (c instanceof AbstractType) {
                  left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentType(c));
                  left.integrate(transaction, 0);
                } else {
                  throw new Error('Unexpected content type in insert operation')
                }
            }
        }
      }
    });
    packJsonContent();
  };

  const lengthExceeded = create$2('Length exceeded!');

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {number} index
   * @param {Array<Object<string,any>|Array<any>|number|null|string|Uint8Array>} content
   *
   * @private
   * @function
   */
  const typeListInsertGenerics = (transaction, parent, index, content) => {
    if (index > parent._length) {
      throw lengthExceeded
    }
    if (index === 0) {
      if (parent._searchMarker) {
        updateMarkerChanges(parent._searchMarker, index, content.length);
      }
      return typeListInsertGenericsAfter(transaction, parent, null, content)
    }
    const startIndex = index;
    const marker = findMarker(parent, index);
    let n = parent._start;
    if (marker !== null) {
      n = marker.p;
      index -= marker.index;
      // we need to iterate one to the left so that the algorithm works
      if (index === 0) {
        // @todo refactor this as it actually doesn't consider formats
        n = n.prev; // important! get the left undeleted item so that we can actually decrease index
        index += (n && n.countable && !n.deleted) ? n.length : 0;
      }
    }
    for (; n !== null; n = n.right) {
      if (!n.deleted && n.countable) {
        if (index <= n.length) {
          if (index < n.length) {
            // insert in-between
            getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index));
          }
          break
        }
        index -= n.length;
      }
    }
    if (parent._searchMarker) {
      updateMarkerChanges(parent._searchMarker, startIndex, content.length);
    }
    return typeListInsertGenericsAfter(transaction, parent, n, content)
  };

  /**
   * Pushing content is special as we generally want to push after the last item. So we don't have to update
   * the serach marker.
   *
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {Array<Object<string,any>|Array<any>|number|null|string|Uint8Array>} content
   *
   * @private
   * @function
   */
  const typeListPushGenerics = (transaction, parent, content) => {
    // Use the marker with the highest index and iterate to the right.
    const marker = (parent._searchMarker || []).reduce((maxMarker, currMarker) => currMarker.index > maxMarker.index ? currMarker : maxMarker, { index: 0, p: parent._start });
    let n = marker.p;
    if (n) {
      while (n.right) {
        n = n.right;
      }
    }
    return typeListInsertGenericsAfter(transaction, parent, n, content)
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {number} index
   * @param {number} length
   *
   * @private
   * @function
   */
  const typeListDelete = (transaction, parent, index, length) => {
    if (length === 0) { return }
    const startIndex = index;
    const startLength = length;
    const marker = findMarker(parent, index);
    let n = parent._start;
    if (marker !== null) {
      n = marker.p;
      index -= marker.index;
    }
    // compute the first item to be deleted
    for (; n !== null && index > 0; n = n.right) {
      if (!n.deleted && n.countable) {
        if (index < n.length) {
          getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index));
        }
        index -= n.length;
      }
    }
    // delete all items until done
    while (length > 0 && n !== null) {
      if (!n.deleted) {
        if (length < n.length) {
          getItemCleanStart(transaction, createID(n.id.client, n.id.clock + length));
        }
        n.delete(transaction);
        length -= n.length;
      }
      n = n.right;
    }
    if (length > 0) {
      throw lengthExceeded
    }
    if (parent._searchMarker) {
      updateMarkerChanges(parent._searchMarker, startIndex, -startLength + length /* in case we remove the above exception */);
    }
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {string} key
   *
   * @private
   * @function
   */
  const typeMapDelete = (transaction, parent, key) => {
    const c = parent._map.get(key);
    if (c !== undefined) {
      c.delete(transaction);
    }
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {string} key
   * @param {Object|number|null|Array<any>|string|Uint8Array|AbstractType<any>} value
   *
   * @private
   * @function
   */
  const typeMapSet = (transaction, parent, key, value) => {
    const left = parent._map.get(key) || null;
    const doc = transaction.doc;
    const ownClientId = doc.clientID;
    let content;
    if (value == null) {
      content = new ContentAny([value]);
    } else {
      switch (value.constructor) {
        case Number:
        case Object:
        case Boolean:
        case Array:
        case String:
          content = new ContentAny([value]);
          break
        case Uint8Array:
          content = new ContentBinary(/** @type {Uint8Array} */ (value));
          break
        case Doc:
          content = new ContentDoc(/** @type {Doc} */ (value));
          break
        default:
          if (value instanceof AbstractType) {
            content = new ContentType(value);
          } else {
            throw new Error('Unexpected content type')
          }
      }
    }
    new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, null, null, parent, key, content).integrate(transaction, 0);
  };

  /**
   * @param {AbstractType<any>} parent
   * @param {string} key
   * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
   *
   * @private
   * @function
   */
  const typeMapGet = (parent, key) => {
    const val = parent._map.get(key);
    return val !== undefined && !val.deleted ? val.content.getContent()[val.length - 1] : undefined
  };

  /**
   * @param {AbstractType<any>} parent
   * @return {Object<string,Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined>}
   *
   * @private
   * @function
   */
  const typeMapGetAll = (parent) => {
    /**
     * @type {Object<string,any>}
     */
    const res = {};
    parent._map.forEach((value, key) => {
      if (!value.deleted) {
        res[key] = value.content.getContent()[value.length - 1];
      }
    });
    return res
  };

  /**
   * @param {AbstractType<any>} parent
   * @param {string} key
   * @return {boolean}
   *
   * @private
   * @function
   */
  const typeMapHas = (parent, key) => {
    const val = parent._map.get(key);
    return val !== undefined && !val.deleted
  };

  /**
   * @param {AbstractType<any>} parent
   * @param {string} key
   * @param {Snapshot} snapshot
   * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
   *
   * @private
   * @function
   */
  const typeMapGetSnapshot = (parent, key, snapshot) => {
    let v = parent._map.get(key) || null;
    while (v !== null && (!snapshot.sv.has(v.id.client) || v.id.clock >= (snapshot.sv.get(v.id.client) || 0))) {
      v = v.left;
    }
    return v !== null && isVisible(v, snapshot) ? v.content.getContent()[v.length - 1] : undefined
  };

  /**
   * @param {Map<string,Item>} map
   * @return {IterableIterator<Array<any>>}
   *
   * @private
   * @function
   */
  const createMapIterator = map => iteratorFilter(map.entries(), /** @param {any} entry */ entry => !entry[1].deleted);

  /**
   * @module YArray
   */

  /**
   * Event that describes the changes on a YArray
   * @template T
   * @extends YEvent<YArray<T>>
   */
  class YArrayEvent extends YEvent {
    /**
     * @param {YArray<T>} yarray The changed type
     * @param {Transaction} transaction The transaction object
     */
    constructor (yarray, transaction) {
      super(yarray, transaction);
      this._transaction = transaction;
    }
  }

  /**
   * A shared Array implementation.
   * @template T
   * @extends AbstractType<YArrayEvent<T>>
   * @implements {Iterable<T>}
   */
  class YArray extends AbstractType {
    constructor () {
      super();
      /**
       * @type {Array<any>?}
       * @private
       */
      this._prelimContent = [];
      /**
       * @type {Array<ArraySearchMarker>}
       */
      this._searchMarker = [];
    }

    /**
     * Construct a new YArray containing the specified items.
     * @template {Object<string,any>|Array<any>|number|null|string|Uint8Array} T
     * @param {Array<T>} items
     * @return {YArray<T>}
     */
    static from (items) {
      /**
       * @type {YArray<T>}
       */
      const a = new YArray();
      a.push(items);
      return a
    }

    /**
     * Integrate this type into the Yjs instance.
     *
     * * Save this struct in the os
     * * This type is sent to other client
     * * Observer functions are fired
     *
     * @param {Doc} y The Yjs instance
     * @param {Item} item
     */
    _integrate (y, item) {
      super._integrate(y, item);
      this.insert(0, /** @type {Array<any>} */ (this._prelimContent));
      this._prelimContent = null;
    }

    /**
     * @return {YArray<T>}
     */
    _copy () {
      return new YArray()
    }

    /**
     * @return {YArray<T>}
     */
    clone () {
      /**
       * @type {YArray<T>}
       */
      const arr = new YArray();
      arr.insert(0, this.toArray().map(el =>
        el instanceof AbstractType ? /** @type {typeof el} */ (el.clone()) : el
      ));
      return arr
    }

    get length () {
      return this._prelimContent === null ? this._length : this._prelimContent.length
    }

    /**
     * Creates YArrayEvent and calls observers.
     *
     * @param {Transaction} transaction
     * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
     */
    _callObserver (transaction, parentSubs) {
      super._callObserver(transaction, parentSubs);
      callTypeObservers(this, transaction, new YArrayEvent(this, transaction));
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
     *  yarray.insert(1, [1, 2])
     *
     * @param {number} index The index to insert content at.
     * @param {Array<T>} content The array of content
     */
    insert (index, content) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeListInsertGenerics(transaction, this, index, /** @type {any} */ (content));
        });
      } else {
        /** @type {Array<any>} */ (this._prelimContent).splice(index, 0, ...content);
      }
    }

    /**
     * Appends content to this YArray.
     *
     * @param {Array<T>} content Array of content to append.
     *
     * @todo Use the following implementation in all types.
     */
    push (content) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeListPushGenerics(transaction, this, /** @type {any} */ (content));
        });
      } else {
        /** @type {Array<any>} */ (this._prelimContent).push(...content);
      }
    }

    /**
     * Preppends content to this YArray.
     *
     * @param {Array<T>} content Array of content to preppend.
     */
    unshift (content) {
      this.insert(0, content);
    }

    /**
     * Deletes elements starting from an index.
     *
     * @param {number} index Index at which to start deleting elements
     * @param {number} length The number of elements to remove. Defaults to 1.
     */
    delete (index, length = 1) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeListDelete(transaction, this, index, length);
        });
      } else {
        /** @type {Array<any>} */ (this._prelimContent).splice(index, length);
      }
    }

    /**
     * Returns the i-th element from a YArray.
     *
     * @param {number} index The index of the element to return from the YArray
     * @return {T}
     */
    get (index) {
      return typeListGet(this, index)
    }

    /**
     * Transforms this YArray to a JavaScript Array.
     *
     * @return {Array<T>}
     */
    toArray () {
      return typeListToArray(this)
    }

    /**
     * Transforms this YArray to a JavaScript Array.
     *
     * @param {number} [start]
     * @param {number} [end]
     * @return {Array<T>}
     */
    slice (start = 0, end = this.length) {
      return typeListSlice(this, start, end)
    }

    /**
     * Transforms this Shared Type to a JSON object.
     *
     * @return {Array<any>}
     */
    toJSON () {
      return this.map(c => c instanceof AbstractType ? c.toJSON() : c)
    }

    /**
     * Returns an Array with the result of calling a provided function on every
     * element of this YArray.
     *
     * @template M
     * @param {function(T,number,YArray<T>):M} f Function that produces an element of the new Array
     * @return {Array<M>} A new array with each element being the result of the
     *                 callback function
     */
    map (f) {
      return typeListMap(this, /** @type {any} */ (f))
    }

    /**
     * Executes a provided function once on overy element of this YArray.
     *
     * @param {function(T,number,YArray<T>):void} f A function to execute on every element of this YArray.
     */
    forEach (f) {
      typeListForEach(this, f);
    }

    /**
     * @return {IterableIterator<T>}
     */
    [Symbol.iterator] () {
      return typeListCreateIterator(this)
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     */
    _write (encoder) {
      encoder.writeTypeRef(YArrayRefID);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
   *
   * @private
   * @function
   */
  const readYArray = _decoder => new YArray();

  /**
   * @template T
   * @extends YEvent<YMap<T>>
   * Event that describes the changes on a YMap.
   */
  class YMapEvent extends YEvent {
    /**
     * @param {YMap<T>} ymap The YArray that changed.
     * @param {Transaction} transaction
     * @param {Set<any>} subs The keys that changed.
     */
    constructor (ymap, transaction, subs) {
      super(ymap, transaction);
      this.keysChanged = subs;
    }
  }

  /**
   * @template MapType
   * A shared Map implementation.
   *
   * @extends AbstractType<YMapEvent<MapType>>
   * @implements {Iterable<MapType>}
   */
  class YMap extends AbstractType {
    /**
     *
     * @param {Iterable<readonly [string, any]>=} entries - an optional iterable to initialize the YMap
     */
    constructor (entries) {
      super();
      /**
       * @type {Map<string,any>?}
       * @private
       */
      this._prelimContent = null;

      if (entries === undefined) {
        this._prelimContent = new Map();
      } else {
        this._prelimContent = new Map(entries);
      }
    }

    /**
     * Integrate this type into the Yjs instance.
     *
     * * Save this struct in the os
     * * This type is sent to other client
     * * Observer functions are fired
     *
     * @param {Doc} y The Yjs instance
     * @param {Item} item
     */
    _integrate (y, item) {
      super._integrate(y, item)
      ;/** @type {Map<string, any>} */ (this._prelimContent).forEach((value, key) => {
        this.set(key, value);
      });
      this._prelimContent = null;
    }

    /**
     * @return {YMap<MapType>}
     */
    _copy () {
      return new YMap()
    }

    /**
     * @return {YMap<MapType>}
     */
    clone () {
      /**
       * @type {YMap<MapType>}
       */
      const map = new YMap();
      this.forEach((value, key) => {
        map.set(key, value instanceof AbstractType ? /** @type {typeof value} */ (value.clone()) : value);
      });
      return map
    }

    /**
     * Creates YMapEvent and calls observers.
     *
     * @param {Transaction} transaction
     * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
     */
    _callObserver (transaction, parentSubs) {
      callTypeObservers(this, transaction, new YMapEvent(this, transaction, parentSubs));
    }

    /**
     * Transforms this Shared Type to a JSON object.
     *
     * @return {Object<string,any>}
     */
    toJSON () {
      /**
       * @type {Object<string,MapType>}
       */
      const map = {};
      this._map.forEach((item, key) => {
        if (!item.deleted) {
          const v = item.content.getContent()[item.length - 1];
          map[key] = v instanceof AbstractType ? v.toJSON() : v;
        }
      });
      return map
    }

    /**
     * Returns the size of the YMap (count of key/value pairs)
     *
     * @return {number}
     */
    get size () {
      return [...createMapIterator(this._map)].length
    }

    /**
     * Returns the keys for each element in the YMap Type.
     *
     * @return {IterableIterator<string>}
     */
    keys () {
      return iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[0])
    }

    /**
     * Returns the values for each element in the YMap Type.
     *
     * @return {IterableIterator<any>}
     */
    values () {
      return iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[1].content.getContent()[v[1].length - 1])
    }

    /**
     * Returns an Iterator of [key, value] pairs
     *
     * @return {IterableIterator<any>}
     */
    entries () {
      return iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => [v[0], v[1].content.getContent()[v[1].length - 1]])
    }

    /**
     * Executes a provided function on once on every key-value pair.
     *
     * @param {function(MapType,string,YMap<MapType>):void} f A function to execute on every element of this YArray.
     */
    forEach (f) {
      this._map.forEach((item, key) => {
        if (!item.deleted) {
          f(item.content.getContent()[item.length - 1], key, this);
        }
      });
    }

    /**
     * Returns an Iterator of [key, value] pairs
     *
     * @return {IterableIterator<any>}
     */
    [Symbol.iterator] () {
      return this.entries()
    }

    /**
     * Remove a specified element from this YMap.
     *
     * @param {string} key The key of the element to remove.
     */
    delete (key) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeMapDelete(transaction, this, key);
        });
      } else {
        /** @type {Map<string, any>} */ (this._prelimContent).delete(key);
      }
    }

    /**
     * Adds or updates an element with a specified key and value.
     * @template {MapType} VAL
     *
     * @param {string} key The key of the element to add to this YMap
     * @param {VAL} value The value of the element to add
     * @return {VAL}
     */
    set (key, value) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeMapSet(transaction, this, key, /** @type {any} */ (value));
        });
      } else {
        /** @type {Map<string, any>} */ (this._prelimContent).set(key, value);
      }
      return value
    }

    /**
     * Returns a specified element from this YMap.
     *
     * @param {string} key
     * @return {MapType|undefined}
     */
    get (key) {
      return /** @type {any} */ (typeMapGet(this, key))
    }

    /**
     * Returns a boolean indicating whether the specified key exists or not.
     *
     * @param {string} key The key to test.
     * @return {boolean}
     */
    has (key) {
      return typeMapHas(this, key)
    }

    /**
     * Removes all elements from this YMap.
     */
    clear () {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          this.forEach(function (_value, key, map) {
            typeMapDelete(transaction, map, key);
          });
        });
      } else {
        /** @type {Map<string, any>} */ (this._prelimContent).clear();
      }
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     */
    _write (encoder) {
      encoder.writeTypeRef(YMapRefID);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
   *
   * @private
   * @function
   */
  const readYMap = _decoder => new YMap();

  /**
   * @param {any} a
   * @param {any} b
   * @return {boolean}
   */
  const equalAttrs = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b && equalFlat(a, b));

  class ItemTextListPosition {
    /**
     * @param {Item|null} left
     * @param {Item|null} right
     * @param {number} index
     * @param {Map<string,any>} currentAttributes
     */
    constructor (left, right, index, currentAttributes) {
      this.left = left;
      this.right = right;
      this.index = index;
      this.currentAttributes = currentAttributes;
    }

    /**
     * Only call this if you know that this.right is defined
     */
    forward () {
      if (this.right === null) {
        unexpectedCase();
      }
      switch (this.right.content.constructor) {
        case ContentFormat:
          if (!this.right.deleted) {
            updateCurrentAttributes(this.currentAttributes, /** @type {ContentFormat} */ (this.right.content));
          }
          break
        default:
          if (!this.right.deleted) {
            this.index += this.right.length;
          }
          break
      }
      this.left = this.right;
      this.right = this.right.right;
    }
  }

  /**
   * @param {Transaction} transaction
   * @param {ItemTextListPosition} pos
   * @param {number} count steps to move forward
   * @return {ItemTextListPosition}
   *
   * @private
   * @function
   */
  const findNextPosition = (transaction, pos, count) => {
    while (pos.right !== null && count > 0) {
      switch (pos.right.content.constructor) {
        case ContentFormat:
          if (!pos.right.deleted) {
            updateCurrentAttributes(pos.currentAttributes, /** @type {ContentFormat} */ (pos.right.content));
          }
          break
        default:
          if (!pos.right.deleted) {
            if (count < pos.right.length) {
              // split right
              getItemCleanStart(transaction, createID(pos.right.id.client, pos.right.id.clock + count));
            }
            pos.index += pos.right.length;
            count -= pos.right.length;
          }
          break
      }
      pos.left = pos.right;
      pos.right = pos.right.right;
      // pos.forward() - we don't forward because that would halve the performance because we already do the checks above
    }
    return pos
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {number} index
   * @return {ItemTextListPosition}
   *
   * @private
   * @function
   */
  const findPosition = (transaction, parent, index) => {
    const currentAttributes = new Map();
    const marker = findMarker(parent, index);
    if (marker) {
      const pos = new ItemTextListPosition(marker.p.left, marker.p, marker.index, currentAttributes);
      return findNextPosition(transaction, pos, index - marker.index)
    } else {
      const pos = new ItemTextListPosition(null, parent._start, 0, currentAttributes);
      return findNextPosition(transaction, pos, index)
    }
  };

  /**
   * Negate applied formats
   *
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {ItemTextListPosition} currPos
   * @param {Map<string,any>} negatedAttributes
   *
   * @private
   * @function
   */
  const insertNegatedAttributes = (transaction, parent, currPos, negatedAttributes) => {
    // check if we really need to remove attributes
    while (
      currPos.right !== null && (
        currPos.right.deleted === true || (
          currPos.right.content.constructor === ContentFormat &&
          equalAttrs(negatedAttributes.get(/** @type {ContentFormat} */ (currPos.right.content).key), /** @type {ContentFormat} */ (currPos.right.content).value)
        )
      )
    ) {
      if (!currPos.right.deleted) {
        negatedAttributes.delete(/** @type {ContentFormat} */ (currPos.right.content).key);
      }
      currPos.forward();
    }
    const doc = transaction.doc;
    const ownClientId = doc.clientID;
    negatedAttributes.forEach((val, key) => {
      const left = currPos.left;
      const right = currPos.right;
      const nextFormat = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val));
      nextFormat.integrate(transaction, 0);
      currPos.right = nextFormat;
      currPos.forward();
    });
  };

  /**
   * @param {Map<string,any>} currentAttributes
   * @param {ContentFormat} format
   *
   * @private
   * @function
   */
  const updateCurrentAttributes = (currentAttributes, format) => {
    const { key, value } = format;
    if (value === null) {
      currentAttributes.delete(key);
    } else {
      currentAttributes.set(key, value);
    }
  };

  /**
   * @param {ItemTextListPosition} currPos
   * @param {Object<string,any>} attributes
   *
   * @private
   * @function
   */
  const minimizeAttributeChanges = (currPos, attributes) => {
    // go right while attributes[right.key] === right.value (or right is deleted)
    while (true) {
      if (currPos.right === null) {
        break
      } else if (currPos.right.deleted || (currPos.right.content.constructor === ContentFormat && equalAttrs(attributes[(/** @type {ContentFormat} */ (currPos.right.content)).key] || null, /** @type {ContentFormat} */ (currPos.right.content).value))) ; else {
        break
      }
      currPos.forward();
    }
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {ItemTextListPosition} currPos
   * @param {Object<string,any>} attributes
   * @return {Map<string,any>}
   *
   * @private
   * @function
   **/
  const insertAttributes = (transaction, parent, currPos, attributes) => {
    const doc = transaction.doc;
    const ownClientId = doc.clientID;
    const negatedAttributes = new Map();
    // insert format-start items
    for (const key in attributes) {
      const val = attributes[key];
      const currentVal = currPos.currentAttributes.get(key) || null;
      if (!equalAttrs(currentVal, val)) {
        // save negated attribute (set null if currentVal undefined)
        negatedAttributes.set(key, currentVal);
        const { left, right } = currPos;
        currPos.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val));
        currPos.right.integrate(transaction, 0);
        currPos.forward();
      }
    }
    return negatedAttributes
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {ItemTextListPosition} currPos
   * @param {string|object|AbstractType<any>} text
   * @param {Object<string,any>} attributes
   *
   * @private
   * @function
   **/
  const insertText = (transaction, parent, currPos, text, attributes) => {
    currPos.currentAttributes.forEach((_val, key) => {
      if (attributes[key] === undefined) {
        attributes[key] = null;
      }
    });
    const doc = transaction.doc;
    const ownClientId = doc.clientID;
    minimizeAttributeChanges(currPos, attributes);
    const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes);
    // insert content
    const content = text.constructor === String ? new ContentString(/** @type {string} */ (text)) : (text instanceof AbstractType ? new ContentType(text) : new ContentEmbed(text));
    let { left, right, index } = currPos;
    if (parent._searchMarker) {
      updateMarkerChanges(parent._searchMarker, currPos.index, content.getLength());
    }
    right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, content);
    right.integrate(transaction, 0);
    currPos.right = right;
    currPos.index = index;
    currPos.forward();
    insertNegatedAttributes(transaction, parent, currPos, negatedAttributes);
  };

  /**
   * @param {Transaction} transaction
   * @param {AbstractType<any>} parent
   * @param {ItemTextListPosition} currPos
   * @param {number} length
   * @param {Object<string,any>} attributes
   *
   * @private
   * @function
   */
  const formatText = (transaction, parent, currPos, length, attributes) => {
    const doc = transaction.doc;
    const ownClientId = doc.clientID;
    minimizeAttributeChanges(currPos, attributes);
    const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes);
    // iterate until first non-format or null is found
    // delete all formats with attributes[format.key] != null
    // also check the attributes after the first non-format as we do not want to insert redundant negated attributes there
    // eslint-disable-next-line no-labels
    iterationLoop: while (
      currPos.right !== null &&
      (length > 0 ||
        (
          negatedAttributes.size > 0 &&
          (currPos.right.deleted || currPos.right.content.constructor === ContentFormat)
        )
      )
    ) {
      if (!currPos.right.deleted) {
        switch (currPos.right.content.constructor) {
          case ContentFormat: {
            const { key, value } = /** @type {ContentFormat} */ (currPos.right.content);
            const attr = attributes[key];
            if (attr !== undefined) {
              if (equalAttrs(attr, value)) {
                negatedAttributes.delete(key);
              } else {
                if (length === 0) {
                  // no need to further extend negatedAttributes
                  // eslint-disable-next-line no-labels
                  break iterationLoop
                }
                negatedAttributes.set(key, value);
              }
              currPos.right.delete(transaction);
            } else {
              currPos.currentAttributes.set(key, value);
            }
            break
          }
          default:
            if (length < currPos.right.length) {
              getItemCleanStart(transaction, createID(currPos.right.id.client, currPos.right.id.clock + length));
            }
            length -= currPos.right.length;
            break
        }
      }
      currPos.forward();
    }
    // Quill just assumes that the editor starts with a newline and that it always
    // ends with a newline. We only insert that newline when a new newline is
    // inserted - i.e when length is bigger than type.length
    if (length > 0) {
      let newlines = '';
      for (; length > 0; length--) {
        newlines += '\n';
      }
      currPos.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), currPos.left, currPos.left && currPos.left.lastId, currPos.right, currPos.right && currPos.right.id, parent, null, new ContentString(newlines));
      currPos.right.integrate(transaction, 0);
      currPos.forward();
    }
    insertNegatedAttributes(transaction, parent, currPos, negatedAttributes);
  };

  /**
   * Call this function after string content has been deleted in order to
   * clean up formatting Items.
   *
   * @param {Transaction} transaction
   * @param {Item} start
   * @param {Item|null} curr exclusive end, automatically iterates to the next Content Item
   * @param {Map<string,any>} startAttributes
   * @param {Map<string,any>} currAttributes
   * @return {number} The amount of formatting Items deleted.
   *
   * @function
   */
  const cleanupFormattingGap = (transaction, start, curr, startAttributes, currAttributes) => {
    /**
     * @type {Item|null}
     */
    let end = start;
    /**
     * @type {Map<string,ContentFormat>}
     */
    const endFormats = create$6();
    while (end && (!end.countable || end.deleted)) {
      if (!end.deleted && end.content.constructor === ContentFormat) {
        const cf = /** @type {ContentFormat} */ (end.content);
        endFormats.set(cf.key, cf);
      }
      end = end.right;
    }
    let cleanups = 0;
    let reachedCurr = false;
    while (start !== end) {
      if (curr === start) {
        reachedCurr = true;
      }
      if (!start.deleted) {
        const content = start.content;
        switch (content.constructor) {
          case ContentFormat: {
            const { key, value } = /** @type {ContentFormat} */ (content);
            const startAttrValue = startAttributes.get(key) || null;
            if (endFormats.get(key) !== content || startAttrValue === value) {
              // Either this format is overwritten or it is not necessary because the attribute already existed.
              start.delete(transaction);
              cleanups++;
              if (!reachedCurr && (currAttributes.get(key) || null) === value && startAttrValue !== value) {
                if (startAttrValue === null) {
                  currAttributes.delete(key);
                } else {
                  currAttributes.set(key, startAttrValue);
                }
              }
            }
            if (!reachedCurr && !start.deleted) {
              updateCurrentAttributes(currAttributes, /** @type {ContentFormat} */ (content));
            }
            break
          }
        }
      }
      start = /** @type {Item} */ (start.right);
    }
    return cleanups
  };

  /**
   * @param {Transaction} transaction
   * @param {Item | null} item
   */
  const cleanupContextlessFormattingGap = (transaction, item) => {
    // iterate until item.right is null or content
    while (item && item.right && (item.right.deleted || !item.right.countable)) {
      item = item.right;
    }
    const attrs = new Set();
    // iterate back until a content item is found
    while (item && (item.deleted || !item.countable)) {
      if (!item.deleted && item.content.constructor === ContentFormat) {
        const key = /** @type {ContentFormat} */ (item.content).key;
        if (attrs.has(key)) {
          item.delete(transaction);
        } else {
          attrs.add(key);
        }
      }
      item = item.left;
    }
  };

  /**
   * This function is experimental and subject to change / be removed.
   *
   * Ideally, we don't need this function at all. Formatting attributes should be cleaned up
   * automatically after each change. This function iterates twice over the complete YText type
   * and removes unnecessary formatting attributes. This is also helpful for testing.
   *
   * This function won't be exported anymore as soon as there is confidence that the YText type works as intended.
   *
   * @param {YText} type
   * @return {number} How many formatting attributes have been cleaned up.
   */
  const cleanupYTextFormatting = type => {
    let res = 0;
    transact(/** @type {Doc} */ (type.doc), transaction => {
      let start = /** @type {Item} */ (type._start);
      let end = type._start;
      let startAttributes = create$6();
      const currentAttributes = copy(startAttributes);
      while (end) {
        if (end.deleted === false) {
          switch (end.content.constructor) {
            case ContentFormat:
              updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (end.content));
              break
            default:
              res += cleanupFormattingGap(transaction, start, end, startAttributes, currentAttributes);
              startAttributes = copy(currentAttributes);
              start = end;
              break
          }
        }
        end = end.right;
      }
    });
    return res
  };

  /**
   * @param {Transaction} transaction
   * @param {ItemTextListPosition} currPos
   * @param {number} length
   * @return {ItemTextListPosition}
   *
   * @private
   * @function
   */
  const deleteText = (transaction, currPos, length) => {
    const startLength = length;
    const startAttrs = copy(currPos.currentAttributes);
    const start = currPos.right;
    while (length > 0 && currPos.right !== null) {
      if (currPos.right.deleted === false) {
        switch (currPos.right.content.constructor) {
          case ContentType:
          case ContentEmbed:
          case ContentString:
            if (length < currPos.right.length) {
              getItemCleanStart(transaction, createID(currPos.right.id.client, currPos.right.id.clock + length));
            }
            length -= currPos.right.length;
            currPos.right.delete(transaction);
            break
        }
      }
      currPos.forward();
    }
    if (start) {
      cleanupFormattingGap(transaction, start, currPos.right, startAttrs, currPos.currentAttributes);
    }
    const parent = /** @type {AbstractType<any>} */ (/** @type {Item} */ (currPos.left || currPos.right).parent);
    if (parent._searchMarker) {
      updateMarkerChanges(parent._searchMarker, currPos.index, -startLength + length);
    }
    return currPos
  };

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
   * @extends YEvent<YText>
   * Event that describes the changes on a YText type.
   */
  class YTextEvent extends YEvent {
    /**
     * @param {YText} ytext
     * @param {Transaction} transaction
     * @param {Set<any>} subs The keys that changed
     */
    constructor (ytext, transaction, subs) {
      super(ytext, transaction);
      /**
       * Whether the children changed.
       * @type {Boolean}
       * @private
       */
      this.childListChanged = false;
      /**
       * Set of all changed attributes.
       * @type {Set<string>}
       */
      this.keysChanged = new Set();
      subs.forEach((sub) => {
        if (sub === null) {
          this.childListChanged = true;
        } else {
          this.keysChanged.add(sub);
        }
      });
    }

    /**
     * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert?:Array<any>|string, delete?:number, retain?:number}>}}
     */
    get changes () {
      if (this._changes === null) {
        /**
         * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert?:Array<any>|string|AbstractType<any>|object, delete?:number, retain?:number}>}}
         */
        const changes = {
          keys: this.keys,
          delta: this.delta,
          added: new Set(),
          deleted: new Set()
        };
        this._changes = changes;
      }
      return /** @type {any} */ (this._changes)
    }

    /**
     * Compute the changes in the delta format.
     * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
     *
     * @type {Array<{insert?:string|object|AbstractType<any>, delete?:number, retain?:number, attributes?: Object<string,any>}>}
     *
     * @public
     */
    get delta () {
      if (this._delta === null) {
        const y = /** @type {Doc} */ (this.target.doc);
        /**
         * @type {Array<{insert?:string|object|AbstractType<any>, delete?:number, retain?:number, attributes?: Object<string,any>}>}
         */
        const delta = [];
        transact(y, transaction => {
          const currentAttributes = new Map(); // saves all current attributes for insert
          const oldAttributes = new Map();
          let item = this.target._start;
          /**
           * @type {string?}
           */
          let action = null;
          /**
           * @type {Object<string,any>}
           */
          const attributes = {}; // counts added or removed new attributes for retain
          /**
           * @type {string|object}
           */
          let insert = '';
          let retain = 0;
          let deleteLen = 0;
          const addOp = () => {
            if (action !== null) {
              /**
               * @type {any}
               */
              let op = null;
              switch (action) {
                case 'delete':
                  if (deleteLen > 0) {
                    op = { delete: deleteLen };
                  }
                  deleteLen = 0;
                  break
                case 'insert':
                  if (typeof insert === 'object' || insert.length > 0) {
                    op = { insert };
                    if (currentAttributes.size > 0) {
                      op.attributes = {};
                      currentAttributes.forEach((value, key) => {
                        if (value !== null) {
                          op.attributes[key] = value;
                        }
                      });
                    }
                  }
                  insert = '';
                  break
                case 'retain':
                  if (retain > 0) {
                    op = { retain };
                    if (!isEmpty(attributes)) {
                      op.attributes = assign({}, attributes);
                    }
                  }
                  retain = 0;
                  break
              }
              if (op) delta.push(op);
              action = null;
            }
          };
          while (item !== null) {
            switch (item.content.constructor) {
              case ContentType:
              case ContentEmbed:
                if (this.adds(item)) {
                  if (!this.deletes(item)) {
                    addOp();
                    action = 'insert';
                    insert = item.content.getContent()[0];
                    addOp();
                  }
                } else if (this.deletes(item)) {
                  if (action !== 'delete') {
                    addOp();
                    action = 'delete';
                  }
                  deleteLen += 1;
                } else if (!item.deleted) {
                  if (action !== 'retain') {
                    addOp();
                    action = 'retain';
                  }
                  retain += 1;
                }
                break
              case ContentString:
                if (this.adds(item)) {
                  if (!this.deletes(item)) {
                    if (action !== 'insert') {
                      addOp();
                      action = 'insert';
                    }
                    insert += /** @type {ContentString} */ (item.content).str;
                  }
                } else if (this.deletes(item)) {
                  if (action !== 'delete') {
                    addOp();
                    action = 'delete';
                  }
                  deleteLen += item.length;
                } else if (!item.deleted) {
                  if (action !== 'retain') {
                    addOp();
                    action = 'retain';
                  }
                  retain += item.length;
                }
                break
              case ContentFormat: {
                const { key, value } = /** @type {ContentFormat} */ (item.content);
                if (this.adds(item)) {
                  if (!this.deletes(item)) {
                    const curVal = currentAttributes.get(key) || null;
                    if (!equalAttrs(curVal, value)) {
                      if (action === 'retain') {
                        addOp();
                      }
                      if (equalAttrs(value, (oldAttributes.get(key) || null))) {
                        delete attributes[key];
                      } else {
                        attributes[key] = value;
                      }
                    } else if (value !== null) {
                      item.delete(transaction);
                    }
                  }
                } else if (this.deletes(item)) {
                  oldAttributes.set(key, value);
                  const curVal = currentAttributes.get(key) || null;
                  if (!equalAttrs(curVal, value)) {
                    if (action === 'retain') {
                      addOp();
                    }
                    attributes[key] = curVal;
                  }
                } else if (!item.deleted) {
                  oldAttributes.set(key, value);
                  const attr = attributes[key];
                  if (attr !== undefined) {
                    if (!equalAttrs(attr, value)) {
                      if (action === 'retain') {
                        addOp();
                      }
                      if (value === null) {
                        delete attributes[key];
                      } else {
                        attributes[key] = value;
                      }
                    } else if (attr !== null) { // this will be cleaned up automatically by the contextless cleanup function
                      item.delete(transaction);
                    }
                  }
                }
                if (!item.deleted) {
                  if (action === 'insert') {
                    addOp();
                  }
                  updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (item.content));
                }
                break
              }
            }
            item = item.right;
          }
          addOp();
          while (delta.length > 0) {
            const lastOp = delta[delta.length - 1];
            if (lastOp.retain !== undefined && lastOp.attributes === undefined) {
              // retain delta's if they don't assign attributes
              delta.pop();
            } else {
              break
            }
          }
        });
        this._delta = delta;
      }
      return /** @type {any} */ (this._delta)
    }
  }

  /**
   * Type that represents text with formatting information.
   *
   * This type replaces y-richtext as this implementation is able to handle
   * block formats (format information on a paragraph), embeds (complex elements
   * like pictures and videos), and text formats (**bold**, *italic*).
   *
   * @extends AbstractType<YTextEvent>
   */
  class YText extends AbstractType {
    /**
     * @param {String} [string] The initial value of the YText.
     */
    constructor (string) {
      super();
      /**
       * Array of pending operations on this type
       * @type {Array<function():void>?}
       */
      this._pending = string !== undefined ? [() => this.insert(0, string)] : [];
      /**
       * @type {Array<ArraySearchMarker>}
       */
      this._searchMarker = [];
    }

    /**
     * Number of characters of this text type.
     *
     * @type {number}
     */
    get length () {
      return this._length
    }

    /**
     * @param {Doc} y
     * @param {Item} item
     */
    _integrate (y, item) {
      super._integrate(y, item);
      try {
        /** @type {Array<function>} */ (this._pending).forEach(f => f());
      } catch (e) {
        console.error(e);
      }
      this._pending = null;
    }

    _copy () {
      return new YText()
    }

    /**
     * @return {YText}
     */
    clone () {
      const text = new YText();
      text.applyDelta(this.toDelta());
      return text
    }

    /**
     * Creates YTextEvent and calls observers.
     *
     * @param {Transaction} transaction
     * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
     */
    _callObserver (transaction, parentSubs) {
      super._callObserver(transaction, parentSubs);
      const event = new YTextEvent(this, transaction, parentSubs);
      const doc = transaction.doc;
      callTypeObservers(this, transaction, event);
      // If a remote change happened, we try to cleanup potential formatting duplicates.
      if (!transaction.local) {
        // check if another formatting item was inserted
        let foundFormattingItem = false;
        for (const [client, afterClock] of transaction.afterState.entries()) {
          const clock = transaction.beforeState.get(client) || 0;
          if (afterClock === clock) {
            continue
          }
          iterateStructs(transaction, /** @type {Array<Item|GC>} */ (doc.store.clients.get(client)), clock, afterClock, item => {
            if (!item.deleted && /** @type {Item} */ (item).content.constructor === ContentFormat) {
              foundFormattingItem = true;
            }
          });
          if (foundFormattingItem) {
            break
          }
        }
        if (!foundFormattingItem) {
          iterateDeletedStructs(transaction, transaction.deleteSet, item => {
            if (item instanceof GC || foundFormattingItem) {
              return
            }
            if (item.parent === this && item.content.constructor === ContentFormat) {
              foundFormattingItem = true;
            }
          });
        }
        transact(doc, (t) => {
          if (foundFormattingItem) {
            // If a formatting item was inserted, we simply clean the whole type.
            // We need to compute currentAttributes for the current position anyway.
            cleanupYTextFormatting(this);
          } else {
            // If no formatting attribute was inserted, we can make due with contextless
            // formatting cleanups.
            // Contextless: it is not necessary to compute currentAttributes for the affected position.
            iterateDeletedStructs(t, t.deleteSet, item => {
              if (item instanceof GC) {
                return
              }
              if (item.parent === this) {
                cleanupContextlessFormattingGap(t, item);
              }
            });
          }
        });
      }
    }

    /**
     * Returns the unformatted string representation of this YText type.
     *
     * @public
     */
    toString () {
      let str = '';
      /**
       * @type {Item|null}
       */
      let n = this._start;
      while (n !== null) {
        if (!n.deleted && n.countable && n.content.constructor === ContentString) {
          str += /** @type {ContentString} */ (n.content).str;
        }
        n = n.right;
      }
      return str
    }

    /**
     * Returns the unformatted string representation of this YText type.
     *
     * @return {string}
     * @public
     */
    toJSON () {
      return this.toString()
    }

    /**
     * Apply a {@link Delta} on this shared YText type.
     *
     * @param {any} delta The changes to apply on this element.
     * @param {object}  opts
     * @param {boolean} [opts.sanitize] Sanitize input delta. Removes ending newlines if set to true.
     *
     *
     * @public
     */
    applyDelta (delta, { sanitize = true } = {}) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          const currPos = new ItemTextListPosition(null, this._start, 0, new Map());
          for (let i = 0; i < delta.length; i++) {
            const op = delta[i];
            if (op.insert !== undefined) {
              // Quill assumes that the content starts with an empty paragraph.
              // Yjs/Y.Text assumes that it starts empty. We always hide that
              // there is a newline at the end of the content.
              // If we omit this step, clients will see a different number of
              // paragraphs, but nothing bad will happen.
              const ins = (!sanitize && typeof op.insert === 'string' && i === delta.length - 1 && currPos.right === null && op.insert.slice(-1) === '\n') ? op.insert.slice(0, -1) : op.insert;
              if (typeof ins !== 'string' || ins.length > 0) {
                insertText(transaction, this, currPos, ins, op.attributes || {});
              }
            } else if (op.retain !== undefined) {
              formatText(transaction, this, currPos, op.retain, op.attributes || {});
            } else if (op.delete !== undefined) {
              deleteText(transaction, currPos, op.delete);
            }
          }
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.applyDelta(delta));
      }
    }

    /**
     * Returns the Delta representation of this YText type.
     *
     * @param {Snapshot} [snapshot]
     * @param {Snapshot} [prevSnapshot]
     * @param {function('removed' | 'added', ID):any} [computeYChange]
     * @return {any} The Delta representation of this type.
     *
     * @public
     */
    toDelta (snapshot, prevSnapshot, computeYChange) {
      /**
       * @type{Array<any>}
       */
      const ops = [];
      const currentAttributes = new Map();
      const doc = /** @type {Doc} */ (this.doc);
      let str = '';
      let n = this._start;
      function packStr () {
        if (str.length > 0) {
          // pack str with attributes to ops
          /**
           * @type {Object<string,any>}
           */
          const attributes = {};
          let addAttributes = false;
          currentAttributes.forEach((value, key) => {
            addAttributes = true;
            attributes[key] = value;
          });
          /**
           * @type {Object<string,any>}
           */
          const op = { insert: str };
          if (addAttributes) {
            op.attributes = attributes;
          }
          ops.push(op);
          str = '';
        }
      }
      const computeDelta = () => {
        while (n !== null) {
          if (isVisible(n, snapshot) || (prevSnapshot !== undefined && isVisible(n, prevSnapshot))) {
            switch (n.content.constructor) {
              case ContentString: {
                const cur = currentAttributes.get('ychange');
                if (snapshot !== undefined && !isVisible(n, snapshot)) {
                  if (cur === undefined || cur.user !== n.id.client || cur.type !== 'removed') {
                    packStr();
                    currentAttributes.set('ychange', computeYChange ? computeYChange('removed', n.id) : { type: 'removed' });
                  }
                } else if (prevSnapshot !== undefined && !isVisible(n, prevSnapshot)) {
                  if (cur === undefined || cur.user !== n.id.client || cur.type !== 'added') {
                    packStr();
                    currentAttributes.set('ychange', computeYChange ? computeYChange('added', n.id) : { type: 'added' });
                  }
                } else if (cur !== undefined) {
                  packStr();
                  currentAttributes.delete('ychange');
                }
                str += /** @type {ContentString} */ (n.content).str;
                break
              }
              case ContentType:
              case ContentEmbed: {
                packStr();
                /**
                 * @type {Object<string,any>}
                 */
                const op = {
                  insert: n.content.getContent()[0]
                };
                if (currentAttributes.size > 0) {
                  const attrs = /** @type {Object<string,any>} */ ({});
                  op.attributes = attrs;
                  currentAttributes.forEach((value, key) => {
                    attrs[key] = value;
                  });
                }
                ops.push(op);
                break
              }
              case ContentFormat:
                if (isVisible(n, snapshot)) {
                  packStr();
                  updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (n.content));
                }
                break
            }
          }
          n = n.right;
        }
        packStr();
      };
      if (snapshot || prevSnapshot) {
        // snapshots are merged again after the transaction, so we need to keep the
        // transaction alive until we are done
        transact(doc, transaction => {
          if (snapshot) {
            splitSnapshotAffectedStructs(transaction, snapshot);
          }
          if (prevSnapshot) {
            splitSnapshotAffectedStructs(transaction, prevSnapshot);
          }
          computeDelta();
        }, 'cleanup');
      } else {
        computeDelta();
      }
      return ops
    }

    /**
     * Insert text at a given index.
     *
     * @param {number} index The index at which to start inserting.
     * @param {String} text The text to insert at the specified position.
     * @param {TextAttributes} [attributes] Optionally define some formatting
     *                                    information to apply on the inserted
     *                                    Text.
     * @public
     */
    insert (index, text, attributes) {
      if (text.length <= 0) {
        return
      }
      const y = this.doc;
      if (y !== null) {
        transact(y, transaction => {
          const pos = findPosition(transaction, this, index);
          if (!attributes) {
            attributes = {};
            // @ts-ignore
            pos.currentAttributes.forEach((v, k) => { attributes[k] = v; });
          }
          insertText(transaction, this, pos, text, attributes);
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.insert(index, text, attributes));
      }
    }

    /**
     * Inserts an embed at a index.
     *
     * @param {number} index The index to insert the embed at.
     * @param {Object | AbstractType<any>} embed The Object that represents the embed.
     * @param {TextAttributes} attributes Attribute information to apply on the
     *                                    embed
     *
     * @public
     */
    insertEmbed (index, embed, attributes = {}) {
      const y = this.doc;
      if (y !== null) {
        transact(y, transaction => {
          const pos = findPosition(transaction, this, index);
          insertText(transaction, this, pos, embed, attributes);
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.insertEmbed(index, embed, attributes));
      }
    }

    /**
     * Deletes text starting from an index.
     *
     * @param {number} index Index at which to start deleting.
     * @param {number} length The number of characters to remove. Defaults to 1.
     *
     * @public
     */
    delete (index, length) {
      if (length === 0) {
        return
      }
      const y = this.doc;
      if (y !== null) {
        transact(y, transaction => {
          deleteText(transaction, findPosition(transaction, this, index), length);
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.delete(index, length));
      }
    }

    /**
     * Assigns properties to a range of text.
     *
     * @param {number} index The position where to start formatting.
     * @param {number} length The amount of characters to assign properties to.
     * @param {TextAttributes} attributes Attribute information to apply on the
     *                                    text.
     *
     * @public
     */
    format (index, length, attributes) {
      if (length === 0) {
        return
      }
      const y = this.doc;
      if (y !== null) {
        transact(y, transaction => {
          const pos = findPosition(transaction, this, index);
          if (pos.right === null) {
            return
          }
          formatText(transaction, this, pos, length, attributes);
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.format(index, length, attributes));
      }
    }

    /**
     * Removes an attribute.
     *
     * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
     *
     * @param {String} attributeName The attribute name that is to be removed.
     *
     * @public
     */
    removeAttribute (attributeName) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeMapDelete(transaction, this, attributeName);
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.removeAttribute(attributeName));
      }
    }

    /**
     * Sets or updates an attribute.
     *
     * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
     *
     * @param {String} attributeName The attribute name that is to be set.
     * @param {any} attributeValue The attribute value that is to be set.
     *
     * @public
     */
    setAttribute (attributeName, attributeValue) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeMapSet(transaction, this, attributeName, attributeValue);
        });
      } else {
        /** @type {Array<function>} */ (this._pending).push(() => this.setAttribute(attributeName, attributeValue));
      }
    }

    /**
     * Returns an attribute value that belongs to the attribute name.
     *
     * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
     *
     * @param {String} attributeName The attribute name that identifies the
     *                               queried value.
     * @return {any} The queried attribute value.
     *
     * @public
     */
    getAttribute (attributeName) {
      return /** @type {any} */ (typeMapGet(this, attributeName))
    }

    /**
     * Returns all attribute name/value pairs in a JSON Object.
     *
     * @note Xml-Text nodes don't have attributes. You can use this feature to assign properties to complete text-blocks.
     *
     * @return {Object<string, any>} A JSON Object that describes the attributes.
     *
     * @public
     */
    getAttributes () {
      return typeMapGetAll(this)
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     */
    _write (encoder) {
      encoder.writeTypeRef(YTextRefID);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
   * @return {YText}
   *
   * @private
   * @function
   */
  const readYText = _decoder => new YText();

  /**
   * @module YXml
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
   * Dom filter function.
   *
   * @callback domFilter
   * @param {string} nodeName The nodeName of the element
   * @param {Map} attributes The map of attributes.
   * @return {boolean} Whether to include the Dom node in the YXmlElement.
   */

  /**
   * Represents a subset of the nodes of a YXmlElement / YXmlFragment and a
   * position within them.
   *
   * Can be created with {@link YXmlFragment#createTreeWalker}
   *
   * @public
   * @implements {Iterable<YXmlElement|YXmlText|YXmlElement|YXmlHook>}
   */
  class YXmlTreeWalker {
    /**
     * @param {YXmlFragment | YXmlElement} root
     * @param {function(AbstractType<any>):boolean} [f]
     */
    constructor (root, f = () => true) {
      this._filter = f;
      this._root = root;
      /**
       * @type {Item}
       */
      this._currentNode = /** @type {Item} */ (root._start);
      this._firstCall = true;
    }

    [Symbol.iterator] () {
      return this
    }

    /**
     * Get the next node.
     *
     * @return {IteratorResult<YXmlElement|YXmlText|YXmlHook>} The next node.
     *
     * @public
     */
    next () {
      /**
       * @type {Item|null}
       */
      let n = this._currentNode;
      let type = n && n.content && /** @type {any} */ (n.content).type;
      if (n !== null && (!this._firstCall || n.deleted || !this._filter(type))) { // if first call, we check if we can use the first item
        do {
          type = /** @type {any} */ (n.content).type;
          if (!n.deleted && (type.constructor === YXmlElement || type.constructor === YXmlFragment) && type._start !== null) {
            // walk down in the tree
            n = type._start;
          } else {
            // walk right or up in the tree
            while (n !== null) {
              if (n.right !== null) {
                n = n.right;
                break
              } else if (n.parent === this._root) {
                n = null;
              } else {
                n = /** @type {AbstractType<any>} */ (n.parent)._item;
              }
            }
          }
        } while (n !== null && (n.deleted || !this._filter(/** @type {ContentType} */ (n.content).type)))
      }
      this._firstCall = false;
      if (n === null) {
        // @ts-ignore
        return { value: undefined, done: true }
      }
      this._currentNode = n;
      return { value: /** @type {any} */ (n.content).type, done: false }
    }
  }

  /**
   * Represents a list of {@link YXmlElement}.and {@link YXmlText} types.
   * A YxmlFragment is similar to a {@link YXmlElement}, but it does not have a
   * nodeName and it does not have attributes. Though it can be bound to a DOM
   * element - in this case the attributes and the nodeName are not shared.
   *
   * @public
   * @extends AbstractType<YXmlEvent>
   */
  class YXmlFragment extends AbstractType {
    constructor () {
      super();
      /**
       * @type {Array<any>|null}
       */
      this._prelimContent = [];
    }

    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get firstChild () {
      const first = this._first;
      return first ? first.content.getContent()[0] : null
    }

    /**
     * Integrate this type into the Yjs instance.
     *
     * * Save this struct in the os
     * * This type is sent to other client
     * * Observer functions are fired
     *
     * @param {Doc} y The Yjs instance
     * @param {Item} item
     */
    _integrate (y, item) {
      super._integrate(y, item);
      this.insert(0, /** @type {Array<any>} */ (this._prelimContent));
      this._prelimContent = null;
    }

    _copy () {
      return new YXmlFragment()
    }

    /**
     * @return {YXmlFragment}
     */
    clone () {
      const el = new YXmlFragment();
      // @ts-ignore
      el.insert(0, this.toArray().map(item => item instanceof AbstractType ? item.clone() : item));
      return el
    }

    get length () {
      return this._prelimContent === null ? this._length : this._prelimContent.length
    }

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
     * @param {function(AbstractType<any>):boolean} filter Function that is called on each child element and
     *                          returns a Boolean indicating whether the child
     *                          is to be included in the subtree.
     * @return {YXmlTreeWalker} A subtree and a position within it.
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
     * @return {YXmlElement|YXmlText|YXmlHook|null} The first element that matches the query or null.
     *
     * @public
     */
    querySelector (query) {
      query = query.toUpperCase();
      // @ts-ignore
      const iterator = new YXmlTreeWalker(this, element => element.nodeName && element.nodeName.toUpperCase() === query);
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
     * @todo Does not yet support all queries. Currently only query by tagName.
     *
     * @param {CSS_Selector} query The query on the children
     * @return {Array<YXmlElement|YXmlText|YXmlHook|null>} The elements that match this query.
     *
     * @public
     */
    querySelectorAll (query) {
      query = query.toUpperCase();
      // @ts-ignore
      return from(new YXmlTreeWalker(this, element => element.nodeName && element.nodeName.toUpperCase() === query))
    }

    /**
     * Creates YXmlEvent and calls observers.
     *
     * @param {Transaction} transaction
     * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
     */
    _callObserver (transaction, parentSubs) {
      callTypeObservers(this, transaction, new YXmlEvent(this, parentSubs, transaction));
    }

    /**
     * Get the string representation of all the children of this YXmlFragment.
     *
     * @return {string} The string representation of all children.
     */
    toString () {
      return typeListMap(this, xml => xml.toString()).join('')
    }

    /**
     * @return {string}
     */
    toJSON () {
      return this.toString()
    }

    /**
     * Creates a Dom Element that mirrors this YXmlElement.
     *
     * @param {Document} [_document=document] The document object (you must define
     *                                        this when calling this method in
     *                                        nodejs)
     * @param {Object<string, any>} [hooks={}] Optional property to customize how hooks
     *                                             are presented in the DOM
     * @param {any} [binding] You should not set this property. This is
     *                               used if DomBinding wants to create a
     *                               association to the created DOM type.
     * @return {Node} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
     *
     * @public
     */
    toDOM (_document = document, hooks = {}, binding) {
      const fragment = _document.createDocumentFragment();
      if (binding !== undefined) {
        binding._createAssociation(fragment, this);
      }
      typeListForEach(this, xmlType => {
        fragment.insertBefore(xmlType.toDOM(_document, hooks, binding), null);
      });
      return fragment
    }

    /**
     * Inserts new content at an index.
     *
     * @example
     *  // Insert character 'a' at position 0
     *  xml.insert(0, [new Y.XmlText('text')])
     *
     * @param {number} index The index to insert content at
     * @param {Array<YXmlElement|YXmlText>} content The array of content
     */
    insert (index, content) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeListInsertGenerics(transaction, this, index, content);
        });
      } else {
        // @ts-ignore _prelimContent is defined because this is not yet integrated
        this._prelimContent.splice(index, 0, ...content);
      }
    }

    /**
     * Inserts new content at an index.
     *
     * @example
     *  // Insert character 'a' at position 0
     *  xml.insert(0, [new Y.XmlText('text')])
     *
     * @param {null|Item|YXmlElement|YXmlText} ref The index to insert content at
     * @param {Array<YXmlElement|YXmlText>} content The array of content
     */
    insertAfter (ref, content) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          const refItem = (ref && ref instanceof AbstractType) ? ref._item : ref;
          typeListInsertGenericsAfter(transaction, this, refItem, content);
        });
      } else {
        const pc = /** @type {Array<any>} */ (this._prelimContent);
        const index = ref === null ? 0 : pc.findIndex(el => el === ref) + 1;
        if (index === 0 && ref !== null) {
          throw create$2('Reference item not found')
        }
        pc.splice(index, 0, ...content);
      }
    }

    /**
     * Deletes elements starting from an index.
     *
     * @param {number} index Index at which to start deleting elements
     * @param {number} [length=1] The number of elements to remove. Defaults to 1.
     */
    delete (index, length = 1) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeListDelete(transaction, this, index, length);
        });
      } else {
        // @ts-ignore _prelimContent is defined because this is not yet integrated
        this._prelimContent.splice(index, length);
      }
    }

    /**
     * Transforms this YArray to a JavaScript Array.
     *
     * @return {Array<YXmlElement|YXmlText|YXmlHook>}
     */
    toArray () {
      return typeListToArray(this)
    }

    /**
     * Appends content to this YArray.
     *
     * @param {Array<YXmlElement|YXmlText>} content Array of content to append.
     */
    push (content) {
      this.insert(this.length, content);
    }

    /**
     * Preppends content to this YArray.
     *
     * @param {Array<YXmlElement|YXmlText>} content Array of content to preppend.
     */
    unshift (content) {
      this.insert(0, content);
    }

    /**
     * Returns the i-th element from a YArray.
     *
     * @param {number} index The index of the element to return from the YArray
     * @return {YXmlElement|YXmlText}
     */
    get (index) {
      return typeListGet(this, index)
    }

    /**
     * Transforms this YArray to a JavaScript Array.
     *
     * @param {number} [start]
     * @param {number} [end]
     * @return {Array<YXmlElement|YXmlText>}
     */
    slice (start = 0, end = this.length) {
      return typeListSlice(this, start, end)
    }

    /**
     * Executes a provided function on once on overy child element.
     *
     * @param {function(YXmlElement|YXmlText,number, typeof self):void} f A function to execute on every element of this YArray.
     */
    forEach (f) {
      typeListForEach(this, f);
    }

    /**
     * Transform the properties of this type to binary and write it to an
     * BinaryEncoder.
     *
     * This is called when this Item is sent to a remote peer.
     *
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
     */
    _write (encoder) {
      encoder.writeTypeRef(YXmlFragmentRefID);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} _decoder
   * @return {YXmlFragment}
   *
   * @private
   * @function
   */
  const readYXmlFragment = _decoder => new YXmlFragment();

  /**
   * @typedef {Object|number|null|Array<any>|string|Uint8Array|AbstractType<any>} ValueTypes
   */

  /**
   * An YXmlElement imitates the behavior of a
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}.
   *
   * * An YXmlElement has attributes (key value pairs)
   * * An YXmlElement has childElements that must inherit from YXmlElement
   *
   * @template {{ [key: string]: ValueTypes }} [KV={ [key: string]: string }]
   */
  class YXmlElement extends YXmlFragment {
    constructor (nodeName = 'UNDEFINED') {
      super();
      this.nodeName = nodeName;
      /**
       * @type {Map<string, any>|null}
       */
      this._prelimAttrs = new Map();
    }

    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get nextSibling () {
      const n = this._item ? this._item.next : null;
      return n ? /** @type {YXmlElement|YXmlText} */ (/** @type {ContentType} */ (n.content).type) : null
    }

    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get prevSibling () {
      const n = this._item ? this._item.prev : null;
      return n ? /** @type {YXmlElement|YXmlText} */ (/** @type {ContentType} */ (n.content).type) : null
    }

    /**
     * Integrate this type into the Yjs instance.
     *
     * * Save this struct in the os
     * * This type is sent to other client
     * * Observer functions are fired
     *
     * @param {Doc} y The Yjs instance
     * @param {Item} item
     */
    _integrate (y, item) {
      super._integrate(y, item)
      ;(/** @type {Map<string, any>} */ (this._prelimAttrs)).forEach((value, key) => {
        this.setAttribute(key, value);
      });
      this._prelimAttrs = null;
    }

    /**
     * Creates an Item with the same effect as this Item (without position effect)
     *
     * @return {YXmlElement}
     */
    _copy () {
      return new YXmlElement(this.nodeName)
    }

    /**
     * @return {YXmlElement<KV>}
     */
    clone () {
      /**
       * @type {YXmlElement<KV>}
       */
      const el = new YXmlElement(this.nodeName);
      const attrs = this.getAttributes();
      forEach$1(attrs, (value, key) => {
        if (typeof value === 'string') {
          el.setAttribute(key, value);
        }
      });
      // @ts-ignore
      el.insert(0, this.toArray().map(item => item instanceof AbstractType ? item.clone() : item));
      return el
    }

    /**
     * Returns the XML serialization of this YXmlElement.
     * The attributes are ordered by attribute-name, so you can easily use this
     * method to compare YXmlElements
     *
     * @return {string} The string representation of this type.
     *
     * @public
     */
    toString () {
      const attrs = this.getAttributes();
      const stringBuilder = [];
      const keys = [];
      for (const key in attrs) {
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
     * @param {string} attributeName The attribute name that is to be removed.
     *
     * @public
     */
    removeAttribute (attributeName) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeMapDelete(transaction, this, attributeName);
        });
      } else {
        /** @type {Map<string,any>} */ (this._prelimAttrs).delete(attributeName);
      }
    }

    /**
     * Sets or updates an attribute.
     *
     * @template {keyof KV & string} KEY
     *
     * @param {KEY} attributeName The attribute name that is to be set.
     * @param {KV[KEY]} attributeValue The attribute value that is to be set.
     *
     * @public
     */
    setAttribute (attributeName, attributeValue) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          typeMapSet(transaction, this, attributeName, attributeValue);
        });
      } else {
        /** @type {Map<string, any>} */ (this._prelimAttrs).set(attributeName, attributeValue);
      }
    }

    /**
     * Returns an attribute value that belongs to the attribute name.
     *
     * @template {keyof KV & string} KEY
     *
     * @param {KEY} attributeName The attribute name that identifies the
     *                               queried value.
     * @return {KV[KEY]|undefined} The queried attribute value.
     *
     * @public
     */
    getAttribute (attributeName) {
      return /** @type {any} */ (typeMapGet(this, attributeName))
    }

    /**
     * Returns whether an attribute exists
     *
     * @param {string} attributeName The attribute name to check for existence.
     * @return {boolean} whether the attribute exists.
     *
     * @public
     */
    hasAttribute (attributeName) {
      return /** @type {any} */ (typeMapHas(this, attributeName))
    }

    /**
     * Returns all attribute name/value pairs in a JSON Object.
     *
     * @return {{ [Key in Extract<keyof KV,string>]?: KV[Key]}} A JSON Object that describes the attributes.
     *
     * @public
     */
    getAttributes () {
      return /** @type {any} */ (typeMapGetAll(this))
    }

    /**
     * Creates a Dom Element that mirrors this YXmlElement.
     *
     * @param {Document} [_document=document] The document object (you must define
     *                                        this when calling this method in
     *                                        nodejs)
     * @param {Object<string, any>} [hooks={}] Optional property to customize how hooks
     *                                             are presented in the DOM
     * @param {any} [binding] You should not set this property. This is
     *                               used if DomBinding wants to create a
     *                               association to the created DOM type.
     * @return {Node} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
     *
     * @public
     */
    toDOM (_document = document, hooks = {}, binding) {
      const dom = _document.createElement(this.nodeName);
      const attrs = this.getAttributes();
      for (const key in attrs) {
        const value = attrs[key];
        if (typeof value === 'string') {
          dom.setAttribute(key, value);
        }
      }
      typeListForEach(this, yxml => {
        dom.appendChild(yxml.toDOM(_document, hooks, binding));
      });
      if (binding !== undefined) {
        binding._createAssociation(dom, this);
      }
      return dom
    }

    /**
     * Transform the properties of this type to binary and write it to an
     * BinaryEncoder.
     *
     * This is called when this Item is sent to a remote peer.
     *
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
     */
    _write (encoder) {
      encoder.writeTypeRef(YXmlElementRefID);
      encoder.writeKey(this.nodeName);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {YXmlElement}
   *
   * @function
   */
  const readYXmlElement = decoder => new YXmlElement(decoder.readKey());

  /**
   * @extends YEvent<YXmlElement|YXmlText|YXmlFragment>
   * An Event that describes changes on a YXml Element or Yxml Fragment
   */
  class YXmlEvent extends YEvent {
    /**
     * @param {YXmlElement|YXmlText|YXmlFragment} target The target on which the event is created.
     * @param {Set<string|null>} subs The set of changed attributes. `null` is included if the
     *                   child list changed.
     * @param {Transaction} transaction The transaction instance with wich the
     *                                  change was created.
     */
    constructor (target, subs, transaction) {
      super(target, transaction);
      /**
       * Whether the children changed.
       * @type {Boolean}
       * @private
       */
      this.childListChanged = false;
      /**
       * Set of all changed attributes.
       * @type {Set<string>}
       */
      this.attributesChanged = new Set();
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
   * You can manage binding to a custom type with YXmlHook.
   *
   * @extends {YMap<any>}
   */
  class YXmlHook extends YMap {
    /**
     * @param {string} hookName nodeName of the Dom Node.
     */
    constructor (hookName) {
      super();
      /**
       * @type {string}
       */
      this.hookName = hookName;
    }

    /**
     * Creates an Item with the same effect as this Item (without position effect)
     */
    _copy () {
      return new YXmlHook(this.hookName)
    }

    /**
     * @return {YXmlHook}
     */
    clone () {
      const el = new YXmlHook(this.hookName);
      this.forEach((value, key) => {
        el.set(key, value);
      });
      return el
    }

    /**
     * Creates a Dom Element that mirrors this YXmlElement.
     *
     * @param {Document} [_document=document] The document object (you must define
     *                                        this when calling this method in
     *                                        nodejs)
     * @param {Object.<string, any>} [hooks] Optional property to customize how hooks
     *                                             are presented in the DOM
     * @param {any} [binding] You should not set this property. This is
     *                               used if DomBinding wants to create a
     *                               association to the created DOM type
     * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
     *
     * @public
     */
    toDOM (_document = document, hooks = {}, binding) {
      const hook = hooks[this.hookName];
      let dom;
      if (hook !== undefined) {
        dom = hook.createDom(this);
      } else {
        dom = document.createElement(this.hookName);
      }
      dom.setAttribute('data-yjs-hook', this.hookName);
      if (binding !== undefined) {
        binding._createAssociation(dom, this);
      }
      return dom
    }

    /**
     * Transform the properties of this type to binary and write it to an
     * BinaryEncoder.
     *
     * This is called when this Item is sent to a remote peer.
     *
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
     */
    _write (encoder) {
      encoder.writeTypeRef(YXmlHookRefID);
      encoder.writeKey(this.hookName);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {YXmlHook}
   *
   * @private
   * @function
   */
  const readYXmlHook = decoder =>
    new YXmlHook(decoder.readKey());

  /**
   * Represents text in a Dom Element. In the future this type will also handle
   * simple formatting information like bold and italic.
   */
  class YXmlText extends YText {
    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get nextSibling () {
      const n = this._item ? this._item.next : null;
      return n ? /** @type {YXmlElement|YXmlText} */ (/** @type {ContentType} */ (n.content).type) : null
    }

    /**
     * @type {YXmlElement|YXmlText|null}
     */
    get prevSibling () {
      const n = this._item ? this._item.prev : null;
      return n ? /** @type {YXmlElement|YXmlText} */ (/** @type {ContentType} */ (n.content).type) : null
    }

    _copy () {
      return new YXmlText()
    }

    /**
     * @return {YXmlText}
     */
    clone () {
      const text = new YXmlText();
      text.applyDelta(this.toDelta());
      return text
    }

    /**
     * Creates a Dom Element that mirrors this YXmlText.
     *
     * @param {Document} [_document=document] The document object (you must define
     *                                        this when calling this method in
     *                                        nodejs)
     * @param {Object<string, any>} [hooks] Optional property to customize how hooks
     *                                             are presented in the DOM
     * @param {any} [binding] You should not set this property. This is
     *                               used if DomBinding wants to create a
     *                               association to the created DOM type.
     * @return {Text} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
     *
     * @public
     */
    toDOM (_document = document, hooks, binding) {
      const dom = _document.createTextNode(this.toString());
      if (binding !== undefined) {
        binding._createAssociation(dom, this);
      }
      return dom
    }

    toString () {
      // @ts-ignore
      return this.toDelta().map(delta => {
        const nestedNodes = [];
        for (const nodeName in delta.attributes) {
          const attrs = [];
          for (const key in delta.attributes[nodeName]) {
            attrs.push({ key, value: delta.attributes[nodeName][key] });
          }
          // sort attributes to get a unique order
          attrs.sort((a, b) => a.key < b.key ? -1 : 1);
          nestedNodes.push({ nodeName, attrs });
        }
        // sort node order to get a unique order
        nestedNodes.sort((a, b) => a.nodeName < b.nodeName ? -1 : 1);
        // now convert to dom string
        let str = '';
        for (let i = 0; i < nestedNodes.length; i++) {
          const node = nestedNodes[i];
          str += `<${node.nodeName}`;
          for (let j = 0; j < node.attrs.length; j++) {
            const attr = node.attrs[j];
            str += ` ${attr.key}="${attr.value}"`;
          }
          str += '>';
        }
        str += delta.insert;
        for (let i = nestedNodes.length - 1; i >= 0; i--) {
          str += `</${nestedNodes[i].nodeName}>`;
        }
        return str
      }).join('')
    }

    /**
     * @return {string}
     */
    toJSON () {
      return this.toString()
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     */
    _write (encoder) {
      encoder.writeTypeRef(YXmlTextRefID);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {YXmlText}
   *
   * @private
   * @function
   */
  const readYXmlText = decoder => new YXmlText();

  class AbstractStruct {
    /**
     * @param {ID} id
     * @param {number} length
     */
    constructor (id, length) {
      this.id = id;
      this.length = length;
    }

    /**
     * @type {boolean}
     */
    get deleted () {
      throw methodUnimplemented()
    }

    /**
     * Merge this struct with the item to the right.
     * This method is already assuming that `this.id.clock + this.length === this.id.clock`.
     * Also this method does *not* remove right from StructStore!
     * @param {AbstractStruct} right
     * @return {boolean} wether this merged with right
     */
    mergeWith (right) {
      return false
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
     * @param {number} offset
     * @param {number} encodingRef
     */
    write (encoder, offset, encodingRef) {
      throw methodUnimplemented()
    }

    /**
     * @param {Transaction} transaction
     * @param {number} offset
     */
    integrate (transaction, offset) {
      throw methodUnimplemented()
    }
  }

  const structGCRefNumber = 0;

  /**
   * @private
   */
  class GC extends AbstractStruct {
    get deleted () {
      return true
    }

    delete () {}

    /**
     * @param {GC} right
     * @return {boolean}
     */
    mergeWith (right) {
      if (this.constructor !== right.constructor) {
        return false
      }
      this.length += right.length;
      return true
    }

    /**
     * @param {Transaction} transaction
     * @param {number} offset
     */
    integrate (transaction, offset) {
      if (offset > 0) {
        this.id.clock += offset;
        this.length -= offset;
      }
      addStruct(transaction.doc.store, this);
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeInfo(structGCRefNumber);
      encoder.writeLen(this.length - offset);
    }

    /**
     * @param {Transaction} transaction
     * @param {StructStore} store
     * @return {null | number}
     */
    getMissing (transaction, store) {
      return null
    }
  }

  class ContentBinary {
    /**
     * @param {Uint8Array} content
     */
    constructor (content) {
      this.content = content;
    }

    /**
     * @return {number}
     */
    getLength () {
      return 1
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return [this.content]
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentBinary}
     */
    copy () {
      return new ContentBinary(this.content)
    }

    /**
     * @param {number} offset
     * @return {ContentBinary}
     */
    splice (offset) {
      throw methodUnimplemented()
    }

    /**
     * @param {ContentBinary} right
     * @return {boolean}
     */
    mergeWith (right) {
      return false
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {}
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeBuf(this.content);
    }

    /**
     * @return {number}
     */
    getRef () {
      return 3
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2 } decoder
   * @return {ContentBinary}
   */
  const readContentBinary = decoder => new ContentBinary(decoder.readBuf());

  class ContentDeleted {
    /**
     * @param {number} len
     */
    constructor (len) {
      this.len = len;
    }

    /**
     * @return {number}
     */
    getLength () {
      return this.len
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return []
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return false
    }

    /**
     * @return {ContentDeleted}
     */
    copy () {
      return new ContentDeleted(this.len)
    }

    /**
     * @param {number} offset
     * @return {ContentDeleted}
     */
    splice (offset) {
      const right = new ContentDeleted(this.len - offset);
      this.len = offset;
      return right
    }

    /**
     * @param {ContentDeleted} right
     * @return {boolean}
     */
    mergeWith (right) {
      this.len += right.len;
      return true
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {
      addToDeleteSet(transaction.deleteSet, item.id.client, item.id.clock, this.len);
      item.markDeleted();
    }

    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeLen(this.len - offset);
    }

    /**
     * @return {number}
     */
    getRef () {
      return 1
    }
  }

  /**
   * @private
   *
   * @param {UpdateDecoderV1 | UpdateDecoderV2 } decoder
   * @return {ContentDeleted}
   */
  const readContentDeleted = decoder => new ContentDeleted(decoder.readLen());

  /**
   * @param {string} guid
   * @param {Object<string, any>} opts
   */
  const createDocFromOpts = (guid, opts) => new Doc({ guid, ...opts, shouldLoad: opts.shouldLoad || opts.autoLoad || false });

  /**
   * @private
   */
  class ContentDoc {
    /**
     * @param {Doc} doc
     */
    constructor (doc) {
      if (doc._item) {
        console.error('This document was already integrated as a sub-document. You should create a second instance instead with the same guid.');
      }
      /**
       * @type {Doc}
       */
      this.doc = doc;
      /**
       * @type {any}
       */
      const opts = {};
      this.opts = opts;
      if (!doc.gc) {
        opts.gc = false;
      }
      if (doc.autoLoad) {
        opts.autoLoad = true;
      }
      if (doc.meta !== null) {
        opts.meta = doc.meta;
      }
    }

    /**
     * @return {number}
     */
    getLength () {
      return 1
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return [this.doc]
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentDoc}
     */
    copy () {
      return new ContentDoc(createDocFromOpts(this.doc.guid, this.opts))
    }

    /**
     * @param {number} offset
     * @return {ContentDoc}
     */
    splice (offset) {
      throw methodUnimplemented()
    }

    /**
     * @param {ContentDoc} right
     * @return {boolean}
     */
    mergeWith (right) {
      return false
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {
      // this needs to be reflected in doc.destroy as well
      this.doc._item = item;
      transaction.subdocsAdded.add(this.doc);
      if (this.doc.shouldLoad) {
        transaction.subdocsLoaded.add(this.doc);
      }
    }

    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {
      if (transaction.subdocsAdded.has(this.doc)) {
        transaction.subdocsAdded.delete(this.doc);
      } else {
        transaction.subdocsRemoved.add(this.doc);
      }
    }

    /**
     * @param {StructStore} store
     */
    gc (store) { }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeString(this.doc.guid);
      encoder.writeAny(this.opts);
    }

    /**
     * @return {number}
     */
    getRef () {
      return 9
    }
  }

  /**
   * @private
   *
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentDoc}
   */
  const readContentDoc = decoder => new ContentDoc(createDocFromOpts(decoder.readString(), decoder.readAny()));

  /**
   * @private
   */
  class ContentEmbed {
    /**
     * @param {Object} embed
     */
    constructor (embed) {
      this.embed = embed;
    }

    /**
     * @return {number}
     */
    getLength () {
      return 1
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return [this.embed]
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentEmbed}
     */
    copy () {
      return new ContentEmbed(this.embed)
    }

    /**
     * @param {number} offset
     * @return {ContentEmbed}
     */
    splice (offset) {
      throw methodUnimplemented()
    }

    /**
     * @param {ContentEmbed} right
     * @return {boolean}
     */
    mergeWith (right) {
      return false
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {}
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeJSON(this.embed);
    }

    /**
     * @return {number}
     */
    getRef () {
      return 5
    }
  }

  /**
   * @private
   *
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentEmbed}
   */
  const readContentEmbed = decoder => new ContentEmbed(decoder.readJSON());

  /**
   * @private
   */
  class ContentFormat {
    /**
     * @param {string} key
     * @param {Object} value
     */
    constructor (key, value) {
      this.key = key;
      this.value = value;
    }

    /**
     * @return {number}
     */
    getLength () {
      return 1
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return []
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return false
    }

    /**
     * @return {ContentFormat}
     */
    copy () {
      return new ContentFormat(this.key, this.value)
    }

    /**
     * @param {number} offset
     * @return {ContentFormat}
     */
    splice (offset) {
      throw methodUnimplemented()
    }

    /**
     * @param {ContentFormat} right
     * @return {boolean}
     */
    mergeWith (right) {
      return false
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {
      // @todo searchmarker are currently unsupported for rich text documents
      /** @type {AbstractType<any>} */ (item.parent)._searchMarker = null;
    }

    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeKey(this.key);
      encoder.writeJSON(this.value);
    }

    /**
     * @return {number}
     */
    getRef () {
      return 6
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentFormat}
   */
  const readContentFormat = decoder => new ContentFormat(decoder.readKey(), decoder.readJSON());

  /**
   * @private
   */
  class ContentJSON {
    /**
     * @param {Array<any>} arr
     */
    constructor (arr) {
      /**
       * @type {Array<any>}
       */
      this.arr = arr;
    }

    /**
     * @return {number}
     */
    getLength () {
      return this.arr.length
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return this.arr
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentJSON}
     */
    copy () {
      return new ContentJSON(this.arr)
    }

    /**
     * @param {number} offset
     * @return {ContentJSON}
     */
    splice (offset) {
      const right = new ContentJSON(this.arr.slice(offset));
      this.arr = this.arr.slice(0, offset);
      return right
    }

    /**
     * @param {ContentJSON} right
     * @return {boolean}
     */
    mergeWith (right) {
      this.arr = this.arr.concat(right.arr);
      return true
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {}
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      const len = this.arr.length;
      encoder.writeLen(len - offset);
      for (let i = offset; i < len; i++) {
        const c = this.arr[i];
        encoder.writeString(c === undefined ? 'undefined' : JSON.stringify(c));
      }
    }

    /**
     * @return {number}
     */
    getRef () {
      return 2
    }
  }

  /**
   * @private
   *
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentJSON}
   */
  const readContentJSON = decoder => {
    const len = decoder.readLen();
    const cs = [];
    for (let i = 0; i < len; i++) {
      const c = decoder.readString();
      if (c === 'undefined') {
        cs.push(undefined);
      } else {
        cs.push(JSON.parse(c));
      }
    }
    return new ContentJSON(cs)
  };

  class ContentAny {
    /**
     * @param {Array<any>} arr
     */
    constructor (arr) {
      /**
       * @type {Array<any>}
       */
      this.arr = arr;
    }

    /**
     * @return {number}
     */
    getLength () {
      return this.arr.length
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return this.arr
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentAny}
     */
    copy () {
      return new ContentAny(this.arr)
    }

    /**
     * @param {number} offset
     * @return {ContentAny}
     */
    splice (offset) {
      const right = new ContentAny(this.arr.slice(offset));
      this.arr = this.arr.slice(0, offset);
      return right
    }

    /**
     * @param {ContentAny} right
     * @return {boolean}
     */
    mergeWith (right) {
      this.arr = this.arr.concat(right.arr);
      return true
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {}
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      const len = this.arr.length;
      encoder.writeLen(len - offset);
      for (let i = offset; i < len; i++) {
        const c = this.arr[i];
        encoder.writeAny(c);
      }
    }

    /**
     * @return {number}
     */
    getRef () {
      return 8
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentAny}
   */
  const readContentAny = decoder => {
    const len = decoder.readLen();
    const cs = [];
    for (let i = 0; i < len; i++) {
      cs.push(decoder.readAny());
    }
    return new ContentAny(cs)
  };

  /**
   * @private
   */
  class ContentString {
    /**
     * @param {string} str
     */
    constructor (str) {
      /**
       * @type {string}
       */
      this.str = str;
    }

    /**
     * @return {number}
     */
    getLength () {
      return this.str.length
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return this.str.split('')
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentString}
     */
    copy () {
      return new ContentString(this.str)
    }

    /**
     * @param {number} offset
     * @return {ContentString}
     */
    splice (offset) {
      const right = new ContentString(this.str.slice(offset));
      this.str = this.str.slice(0, offset);

      // Prevent encoding invalid documents because of splitting of surrogate pairs: https://github.com/yjs/yjs/issues/248
      const firstCharCode = this.str.charCodeAt(offset - 1);
      if (firstCharCode >= 0xD800 && firstCharCode <= 0xDBFF) {
        // Last character of the left split is the start of a surrogate utf16/ucs2 pair.
        // We don't support splitting of surrogate pairs because this may lead to invalid documents.
        // Replace the invalid character with a unicode replacement character (� / U+FFFD)
        this.str = this.str.slice(0, offset - 1) + '�';
        // replace right as well
        right.str = '�' + right.str.slice(1);
      }
      return right
    }

    /**
     * @param {ContentString} right
     * @return {boolean}
     */
    mergeWith (right) {
      this.str += right.str;
      return true
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {}
    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {}
    /**
     * @param {StructStore} store
     */
    gc (store) {}
    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeString(offset === 0 ? this.str : this.str.slice(offset));
    }

    /**
     * @return {number}
     */
    getRef () {
      return 4
    }
  }

  /**
   * @private
   *
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentString}
   */
  const readContentString = decoder => new ContentString(decoder.readString());

  /**
   * @type {Array<function(UpdateDecoderV1 | UpdateDecoderV2):AbstractType<any>>}
   * @private
   */
  const typeRefs = [
    readYArray,
    readYMap,
    readYText,
    readYXmlElement,
    readYXmlFragment,
    readYXmlHook,
    readYXmlText
  ];

  const YArrayRefID = 0;
  const YMapRefID = 1;
  const YTextRefID = 2;
  const YXmlElementRefID = 3;
  const YXmlFragmentRefID = 4;
  const YXmlHookRefID = 5;
  const YXmlTextRefID = 6;

  /**
   * @private
   */
  class ContentType {
    /**
     * @param {AbstractType<any>} type
     */
    constructor (type) {
      /**
       * @type {AbstractType<any>}
       */
      this.type = type;
    }

    /**
     * @return {number}
     */
    getLength () {
      return 1
    }

    /**
     * @return {Array<any>}
     */
    getContent () {
      return [this.type]
    }

    /**
     * @return {boolean}
     */
    isCountable () {
      return true
    }

    /**
     * @return {ContentType}
     */
    copy () {
      return new ContentType(this.type._copy())
    }

    /**
     * @param {number} offset
     * @return {ContentType}
     */
    splice (offset) {
      throw methodUnimplemented()
    }

    /**
     * @param {ContentType} right
     * @return {boolean}
     */
    mergeWith (right) {
      return false
    }

    /**
     * @param {Transaction} transaction
     * @param {Item} item
     */
    integrate (transaction, item) {
      this.type._integrate(transaction.doc, item);
    }

    /**
     * @param {Transaction} transaction
     */
    delete (transaction) {
      let item = this.type._start;
      while (item !== null) {
        if (!item.deleted) {
          item.delete(transaction);
        } else {
          // This will be gc'd later and we want to merge it if possible
          // We try to merge all deleted items after each transaction,
          // but we have no knowledge about that this needs to be merged
          // since it is not in transaction.ds. Hence we add it to transaction._mergeStructs
          transaction._mergeStructs.push(item);
        }
        item = item.right;
      }
      this.type._map.forEach(item => {
        if (!item.deleted) {
          item.delete(transaction);
        } else {
          // same as above
          transaction._mergeStructs.push(item);
        }
      });
      transaction.changed.delete(this.type);
    }

    /**
     * @param {StructStore} store
     */
    gc (store) {
      let item = this.type._start;
      while (item !== null) {
        item.gc(store, true);
        item = item.right;
      }
      this.type._start = null;
      this.type._map.forEach(/** @param {Item | null} item */ (item) => {
        while (item !== null) {
          item.gc(store, true);
          item = item.left;
        }
      });
      this.type._map = new Map();
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      this.type._write(encoder);
    }

    /**
     * @return {number}
     */
    getRef () {
      return 7
    }
  }

  /**
   * @private
   *
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @return {ContentType}
   */
  const readContentType = decoder => new ContentType(typeRefs[decoder.readTypeRef()](decoder));

  /**
   * @todo This should return several items
   *
   * @param {StructStore} store
   * @param {ID} id
   * @return {{item:Item, diff:number}}
   */
  const followRedone = (store, id) => {
    /**
     * @type {ID|null}
     */
    let nextID = id;
    let diff = 0;
    let item;
    do {
      if (diff > 0) {
        nextID = createID(nextID.client, nextID.clock + diff);
      }
      item = getItem(store, nextID);
      diff = nextID.clock - item.id.clock;
      nextID = item.redone;
    } while (nextID !== null && item instanceof Item)
    return {
      item, diff
    }
  };

  /**
   * Make sure that neither item nor any of its parents is ever deleted.
   *
   * This property does not persist when storing it into a database or when
   * sending it to other peers
   *
   * @param {Item|null} item
   * @param {boolean} keep
   */
  const keepItem = (item, keep) => {
    while (item !== null && item.keep !== keep) {
      item.keep = keep;
      item = /** @type {AbstractType<any>} */ (item.parent)._item;
    }
  };

  /**
   * Split leftItem into two items
   * @param {Transaction} transaction
   * @param {Item} leftItem
   * @param {number} diff
   * @return {Item}
   *
   * @function
   * @private
   */
  const splitItem = (transaction, leftItem, diff) => {
    // create rightItem
    const { client, clock } = leftItem.id;
    const rightItem = new Item(
      createID(client, clock + diff),
      leftItem,
      createID(client, clock + diff - 1),
      leftItem.right,
      leftItem.rightOrigin,
      leftItem.parent,
      leftItem.parentSub,
      leftItem.content.splice(diff)
    );
    if (leftItem.deleted) {
      rightItem.markDeleted();
    }
    if (leftItem.keep) {
      rightItem.keep = true;
    }
    if (leftItem.redone !== null) {
      rightItem.redone = createID(leftItem.redone.client, leftItem.redone.clock + diff);
    }
    // update left (do not set leftItem.rightOrigin as it will lead to problems when syncing)
    leftItem.right = rightItem;
    // update right
    if (rightItem.right !== null) {
      rightItem.right.left = rightItem;
    }
    // right is more specific.
    transaction._mergeStructs.push(rightItem);
    // update parent._map
    if (rightItem.parentSub !== null && rightItem.right === null) {
      /** @type {AbstractType<any>} */ (rightItem.parent)._map.set(rightItem.parentSub, rightItem);
    }
    leftItem.length = diff;
    return rightItem
  };

  /**
   * @param {Array<StackItem>} stack
   * @param {ID} id
   */
  const isDeletedByUndoStack = (stack, id) => some(stack, /** @param {StackItem} s */ s => isDeleted(s.deletions, id));

  /**
   * Redoes the effect of this operation.
   *
   * @param {Transaction} transaction The Yjs instance.
   * @param {Item} item
   * @param {Set<Item>} redoitems
   * @param {DeleteSet} itemsToDelete
   * @param {boolean} ignoreRemoteMapChanges
   * @param {import('../utils/UndoManager.js').UndoManager} um
   *
   * @return {Item|null}
   *
   * @private
   */
  const redoItem = (transaction, item, redoitems, itemsToDelete, ignoreRemoteMapChanges, um) => {
    const doc = transaction.doc;
    const store = doc.store;
    const ownClientID = doc.clientID;
    const redone = item.redone;
    if (redone !== null) {
      return getItemCleanStart(transaction, redone)
    }
    let parentItem = /** @type {AbstractType<any>} */ (item.parent)._item;
    /**
     * @type {Item|null}
     */
    let left = null;
    /**
     * @type {Item|null}
     */
    let right;
    // make sure that parent is redone
    if (parentItem !== null && parentItem.deleted === true) {
      // try to undo parent if it will be undone anyway
      if (parentItem.redone === null && (!redoitems.has(parentItem) || redoItem(transaction, parentItem, redoitems, itemsToDelete, ignoreRemoteMapChanges, um) === null)) {
        return null
      }
      while (parentItem.redone !== null) {
        parentItem = getItemCleanStart(transaction, parentItem.redone);
      }
    }
    const parentType = parentItem === null ? /** @type {AbstractType<any>} */ (item.parent) : /** @type {ContentType} */ (parentItem.content).type;

    if (item.parentSub === null) {
      // Is an array item. Insert at the old position
      left = item.left;
      right = item;
      // find next cloned_redo items
      while (left !== null) {
        /**
         * @type {Item|null}
         */
        let leftTrace = left;
        // trace redone until parent matches
        while (leftTrace !== null && /** @type {AbstractType<any>} */ (leftTrace.parent)._item !== parentItem) {
          leftTrace = leftTrace.redone === null ? null : getItemCleanStart(transaction, leftTrace.redone);
        }
        if (leftTrace !== null && /** @type {AbstractType<any>} */ (leftTrace.parent)._item === parentItem) {
          left = leftTrace;
          break
        }
        left = left.left;
      }
      while (right !== null) {
        /**
         * @type {Item|null}
         */
        let rightTrace = right;
        // trace redone until parent matches
        while (rightTrace !== null && /** @type {AbstractType<any>} */ (rightTrace.parent)._item !== parentItem) {
          rightTrace = rightTrace.redone === null ? null : getItemCleanStart(transaction, rightTrace.redone);
        }
        if (rightTrace !== null && /** @type {AbstractType<any>} */ (rightTrace.parent)._item === parentItem) {
          right = rightTrace;
          break
        }
        right = right.right;
      }
    } else {
      right = null;
      if (item.right && !ignoreRemoteMapChanges) {
        left = item;
        // Iterate right while right is in itemsToDelete
        // If it is intended to delete right while item is redone, we can expect that item should replace right.
        while (left !== null && left.right !== null && (left.right.redone || isDeleted(itemsToDelete, left.right.id) || isDeletedByUndoStack(um.undoStack, left.right.id) || isDeletedByUndoStack(um.redoStack, left.right.id))) {
          left = left.right;
          // follow redone
          while (left.redone) left = getItemCleanStart(transaction, left.redone);
        }
        if (left && left.right !== null) {
          // It is not possible to redo this item because it conflicts with a
          // change from another client
          return null
        }
      } else {
        left = parentType._map.get(item.parentSub) || null;
      }
    }
    const nextClock = getState(store, ownClientID);
    const nextId = createID(ownClientID, nextClock);
    const redoneItem = new Item(
      nextId,
      left, left && left.lastId,
      right, right && right.id,
      parentType,
      item.parentSub,
      item.content.copy()
    );
    item.redone = nextId;
    keepItem(redoneItem, true);
    redoneItem.integrate(transaction, 0);
    return redoneItem
  };

  /**
   * Abstract class that represents any content.
   */
  class Item extends AbstractStruct {
    /**
     * @param {ID} id
     * @param {Item | null} left
     * @param {ID | null} origin
     * @param {Item | null} right
     * @param {ID | null} rightOrigin
     * @param {AbstractType<any>|ID|null} parent Is a type if integrated, is null if it is possible to copy parent from left or right, is ID before integration to search for it.
     * @param {string | null} parentSub
     * @param {AbstractContent} content
     */
    constructor (id, left, origin, right, rightOrigin, parent, parentSub, content) {
      super(id, content.getLength());
      /**
       * The item that was originally to the left of this item.
       * @type {ID | null}
       */
      this.origin = origin;
      /**
       * The item that is currently to the left of this item.
       * @type {Item | null}
       */
      this.left = left;
      /**
       * The item that is currently to the right of this item.
       * @type {Item | null}
       */
      this.right = right;
      /**
       * The item that was originally to the right of this item.
       * @type {ID | null}
       */
      this.rightOrigin = rightOrigin;
      /**
       * @type {AbstractType<any>|ID|null}
       */
      this.parent = parent;
      /**
       * If the parent refers to this item with some kind of key (e.g. YMap, the
       * key is specified here. The key is then used to refer to the list in which
       * to insert this item. If `parentSub = null` type._start is the list in
       * which to insert to. Otherwise it is `parent._map`.
       * @type {String | null}
       */
      this.parentSub = parentSub;
      /**
       * If this type's effect is redone this type refers to the type that undid
       * this operation.
       * @type {ID | null}
       */
      this.redone = null;
      /**
       * @type {AbstractContent}
       */
      this.content = content;
      /**
       * bit1: keep
       * bit2: countable
       * bit3: deleted
       * bit4: mark - mark node as fast-search-marker
       * @type {number} byte
       */
      this.info = this.content.isCountable() ? BIT2 : 0;
    }

    /**
     * This is used to mark the item as an indexed fast-search marker
     *
     * @type {boolean}
     */
    set marker (isMarked) {
      if (((this.info & BIT4) > 0) !== isMarked) {
        this.info ^= BIT4;
      }
    }

    get marker () {
      return (this.info & BIT4) > 0
    }

    /**
     * If true, do not garbage collect this Item.
     */
    get keep () {
      return (this.info & BIT1) > 0
    }

    set keep (doKeep) {
      if (this.keep !== doKeep) {
        this.info ^= BIT1;
      }
    }

    get countable () {
      return (this.info & BIT2) > 0
    }

    /**
     * Whether this item was deleted or not.
     * @type {Boolean}
     */
    get deleted () {
      return (this.info & BIT3) > 0
    }

    set deleted (doDelete) {
      if (this.deleted !== doDelete) {
        this.info ^= BIT3;
      }
    }

    markDeleted () {
      this.info |= BIT3;
    }

    /**
     * Return the creator clientID of the missing op or define missing items and return null.
     *
     * @param {Transaction} transaction
     * @param {StructStore} store
     * @return {null | number}
     */
    getMissing (transaction, store) {
      if (this.origin && this.origin.client !== this.id.client && this.origin.clock >= getState(store, this.origin.client)) {
        return this.origin.client
      }
      if (this.rightOrigin && this.rightOrigin.client !== this.id.client && this.rightOrigin.clock >= getState(store, this.rightOrigin.client)) {
        return this.rightOrigin.client
      }
      if (this.parent && this.parent.constructor === ID && this.id.client !== this.parent.client && this.parent.clock >= getState(store, this.parent.client)) {
        return this.parent.client
      }

      // We have all missing ids, now find the items

      if (this.origin) {
        this.left = getItemCleanEnd(transaction, store, this.origin);
        this.origin = this.left.lastId;
      }
      if (this.rightOrigin) {
        this.right = getItemCleanStart(transaction, this.rightOrigin);
        this.rightOrigin = this.right.id;
      }
      if ((this.left && this.left.constructor === GC) || (this.right && this.right.constructor === GC)) {
        this.parent = null;
      }
      // only set parent if this shouldn't be garbage collected
      if (!this.parent) {
        if (this.left && this.left.constructor === Item) {
          this.parent = this.left.parent;
          this.parentSub = this.left.parentSub;
        }
        if (this.right && this.right.constructor === Item) {
          this.parent = this.right.parent;
          this.parentSub = this.right.parentSub;
        }
      } else if (this.parent.constructor === ID) {
        const parentItem = getItem(store, this.parent);
        if (parentItem.constructor === GC) {
          this.parent = null;
        } else {
          this.parent = /** @type {ContentType} */ (parentItem.content).type;
        }
      }
      return null
    }

    /**
     * @param {Transaction} transaction
     * @param {number} offset
     */
    integrate (transaction, offset) {
      if (offset > 0) {
        this.id.clock += offset;
        this.left = getItemCleanEnd(transaction, transaction.doc.store, createID(this.id.client, this.id.clock - 1));
        this.origin = this.left.lastId;
        this.content = this.content.splice(offset);
        this.length -= offset;
      }

      if (this.parent) {
        if ((!this.left && (!this.right || this.right.left !== null)) || (this.left && this.left.right !== this.right)) {
          /**
           * @type {Item|null}
           */
          let left = this.left;

          /**
           * @type {Item|null}
           */
          let o;
          // set o to the first conflicting item
          if (left !== null) {
            o = left.right;
          } else if (this.parentSub !== null) {
            o = /** @type {AbstractType<any>} */ (this.parent)._map.get(this.parentSub) || null;
            while (o !== null && o.left !== null) {
              o = o.left;
            }
          } else {
            o = /** @type {AbstractType<any>} */ (this.parent)._start;
          }
          // TODO: use something like DeleteSet here (a tree implementation would be best)
          // @todo use global set definitions
          /**
           * @type {Set<Item>}
           */
          const conflictingItems = new Set();
          /**
           * @type {Set<Item>}
           */
          const itemsBeforeOrigin = new Set();
          // Let c in conflictingItems, b in itemsBeforeOrigin
          // ***{origin}bbbb{this}{c,b}{c,b}{o}***
          // Note that conflictingItems is a subset of itemsBeforeOrigin
          while (o !== null && o !== this.right) {
            itemsBeforeOrigin.add(o);
            conflictingItems.add(o);
            if (compareIDs(this.origin, o.origin)) {
              // case 1
              if (o.id.client < this.id.client) {
                left = o;
                conflictingItems.clear();
              } else if (compareIDs(this.rightOrigin, o.rightOrigin)) {
                // this and o are conflicting and point to the same integration points. The id decides which item comes first.
                // Since this is to the left of o, we can break here
                break
              } // else, o might be integrated before an item that this conflicts with. If so, we will find it in the next iterations
            } else if (o.origin !== null && itemsBeforeOrigin.has(getItem(transaction.doc.store, o.origin))) { // use getItem instead of getItemCleanEnd because we don't want / need to split items.
              // case 2
              if (!conflictingItems.has(getItem(transaction.doc.store, o.origin))) {
                left = o;
                conflictingItems.clear();
              }
            } else {
              break
            }
            o = o.right;
          }
          this.left = left;
        }
        // reconnect left/right + update parent map/start if necessary
        if (this.left !== null) {
          const right = this.left.right;
          this.right = right;
          this.left.right = this;
        } else {
          let r;
          if (this.parentSub !== null) {
            r = /** @type {AbstractType<any>} */ (this.parent)._map.get(this.parentSub) || null;
            while (r !== null && r.left !== null) {
              r = r.left;
            }
          } else {
            r = /** @type {AbstractType<any>} */ (this.parent)._start
            ;/** @type {AbstractType<any>} */ (this.parent)._start = this;
          }
          this.right = r;
        }
        if (this.right !== null) {
          this.right.left = this;
        } else if (this.parentSub !== null) {
          // set as current parent value if right === null and this is parentSub
          /** @type {AbstractType<any>} */ (this.parent)._map.set(this.parentSub, this);
          if (this.left !== null) {
            // this is the current attribute value of parent. delete right
            this.left.delete(transaction);
          }
        }
        // adjust length of parent
        if (this.parentSub === null && this.countable && !this.deleted) {
          /** @type {AbstractType<any>} */ (this.parent)._length += this.length;
        }
        addStruct(transaction.doc.store, this);
        this.content.integrate(transaction, this);
        // add parent to transaction.changed
        addChangedTypeToTransaction(transaction, /** @type {AbstractType<any>} */ (this.parent), this.parentSub);
        if ((/** @type {AbstractType<any>} */ (this.parent)._item !== null && /** @type {AbstractType<any>} */ (this.parent)._item.deleted) || (this.parentSub !== null && this.right !== null)) {
          // delete if parent is deleted or if this is not the current attribute value of parent
          this.delete(transaction);
        }
      } else {
        // parent is not defined. Integrate GC struct instead
        new GC(this.id, this.length).integrate(transaction, 0);
      }
    }

    /**
     * Returns the next non-deleted item
     */
    get next () {
      let n = this.right;
      while (n !== null && n.deleted) {
        n = n.right;
      }
      return n
    }

    /**
     * Returns the previous non-deleted item
     */
    get prev () {
      let n = this.left;
      while (n !== null && n.deleted) {
        n = n.left;
      }
      return n
    }

    /**
     * Computes the last content address of this Item.
     */
    get lastId () {
      // allocating ids is pretty costly because of the amount of ids created, so we try to reuse whenever possible
      return this.length === 1 ? this.id : createID(this.id.client, this.id.clock + this.length - 1)
    }

    /**
     * Try to merge two items
     *
     * @param {Item} right
     * @return {boolean}
     */
    mergeWith (right) {
      if (
        this.constructor === right.constructor &&
        compareIDs(right.origin, this.lastId) &&
        this.right === right &&
        compareIDs(this.rightOrigin, right.rightOrigin) &&
        this.id.client === right.id.client &&
        this.id.clock + this.length === right.id.clock &&
        this.deleted === right.deleted &&
        this.redone === null &&
        right.redone === null &&
        this.content.constructor === right.content.constructor &&
        this.content.mergeWith(right.content)
      ) {
        const searchMarker = /** @type {AbstractType<any>} */ (this.parent)._searchMarker;
        if (searchMarker) {
          searchMarker.forEach(marker => {
            if (marker.p === right) {
              // right is going to be "forgotten" so we need to update the marker
              marker.p = this;
              // adjust marker index
              if (!this.deleted && this.countable) {
                marker.index -= this.length;
              }
            }
          });
        }
        if (right.keep) {
          this.keep = true;
        }
        this.right = right.right;
        if (this.right !== null) {
          this.right.left = this;
        }
        this.length += right.length;
        return true
      }
      return false
    }

    /**
     * Mark this Item as deleted.
     *
     * @param {Transaction} transaction
     */
    delete (transaction) {
      if (!this.deleted) {
        const parent = /** @type {AbstractType<any>} */ (this.parent);
        // adjust the length of parent
        if (this.countable && this.parentSub === null) {
          parent._length -= this.length;
        }
        this.markDeleted();
        addToDeleteSet(transaction.deleteSet, this.id.client, this.id.clock, this.length);
        addChangedTypeToTransaction(transaction, parent, this.parentSub);
        this.content.delete(transaction);
      }
    }

    /**
     * @param {StructStore} store
     * @param {boolean} parentGCd
     */
    gc (store, parentGCd) {
      if (!this.deleted) {
        throw unexpectedCase()
      }
      this.content.gc(store);
      if (parentGCd) {
        replaceStruct(store, this, new GC(this.id, this.length));
      } else {
        this.content = new ContentDeleted(this.length);
      }
    }

    /**
     * Transform the properties of this type to binary and write it to an
     * BinaryEncoder.
     *
     * This is called when this Item is sent to a remote peer.
     *
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder The encoder to write data to.
     * @param {number} offset
     */
    write (encoder, offset) {
      const origin = offset > 0 ? createID(this.id.client, this.id.clock + offset - 1) : this.origin;
      const rightOrigin = this.rightOrigin;
      const parentSub = this.parentSub;
      const info = (this.content.getRef() & BITS5) |
        (origin === null ? 0 : BIT8) | // origin is defined
        (rightOrigin === null ? 0 : BIT7) | // right origin is defined
        (parentSub === null ? 0 : BIT6); // parentSub is non-null
      encoder.writeInfo(info);
      if (origin !== null) {
        encoder.writeLeftID(origin);
      }
      if (rightOrigin !== null) {
        encoder.writeRightID(rightOrigin);
      }
      if (origin === null && rightOrigin === null) {
        const parent = /** @type {AbstractType<any>} */ (this.parent);
        if (parent._item !== undefined) {
          const parentItem = parent._item;
          if (parentItem === null) {
            // parent type on y._map
            // find the correct key
            const ykey = findRootTypeKey(parent);
            encoder.writeParentInfo(true); // write parentYKey
            encoder.writeString(ykey);
          } else {
            encoder.writeParentInfo(false); // write parent id
            encoder.writeLeftID(parentItem.id);
          }
        } else if (parent.constructor === String) { // this edge case was added by differential updates
          encoder.writeParentInfo(true); // write parentYKey
          encoder.writeString(parent);
        } else if (parent.constructor === ID) {
          encoder.writeParentInfo(false); // write parent id
          encoder.writeLeftID(parent);
        } else {
          unexpectedCase();
        }
        if (parentSub !== null) {
          encoder.writeString(parentSub);
        }
      }
      this.content.write(encoder, offset);
    }
  }

  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @param {number} info
   */
  const readItemContent = (decoder, info) => contentRefs[info & BITS5](decoder);

  /**
   * A lookup map for reading Item content.
   *
   * @type {Array<function(UpdateDecoderV1 | UpdateDecoderV2):AbstractContent>}
   */
  const contentRefs = [
    () => { unexpectedCase(); }, // GC is not ItemContent
    readContentDeleted, // 1
    readContentJSON, // 2
    readContentBinary, // 3
    readContentString, // 4
    readContentEmbed, // 5
    readContentFormat, // 6
    readContentType, // 7
    readContentAny, // 8
    readContentDoc, // 9
    () => { unexpectedCase(); } // 10 - Skip is not ItemContent
  ];

  const structSkipRefNumber = 10;

  /**
   * @private
   */
  class Skip extends AbstractStruct {
    get deleted () {
      return true
    }

    delete () {}

    /**
     * @param {Skip} right
     * @return {boolean}
     */
    mergeWith (right) {
      if (this.constructor !== right.constructor) {
        return false
      }
      this.length += right.length;
      return true
    }

    /**
     * @param {Transaction} transaction
     * @param {number} offset
     */
    integrate (transaction, offset) {
      // skip structs cannot be integrated
      unexpectedCase();
    }

    /**
     * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
     * @param {number} offset
     */
    write (encoder, offset) {
      encoder.writeInfo(structSkipRefNumber);
      // write as VarUint because Skips can't make use of predictable length-encoding
      writeVarUint(encoder.restEncoder, this.length - offset);
    }

    /**
     * @param {Transaction} transaction
     * @param {StructStore} store
     * @return {null | number}
     */
    getMissing (transaction, store) {
      return null
    }
  }

  /** eslint-env browser */

  const glo = /** @type {any} */ (typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      // @ts-ignore
      : typeof global !== 'undefined' ? global : {});

  const importIdentifier = '__ $YJS$ __';

  if (glo[importIdentifier] === true) {
    /**
     * Dear reader of this message. Please take this seriously.
     *
     * If you see this message, make sure that you only import one version of Yjs. In many cases,
     * your package manager installs two versions of Yjs that are used by different packages within your project.
     * Another reason for this message is that some parts of your project use the commonjs version of Yjs
     * and others use the EcmaScript version of Yjs.
     *
     * This often leads to issues that are hard to debug. We often need to perform constructor checks,
     * e.g. `struct instanceof GC`. If you imported different versions of Yjs, it is impossible for us to
     * do the constructor checks anymore - which might break the CRDT algorithm.
     *
     * https://github.com/yjs/yjs/issues/438
     */
    console.error('Yjs was already imported. This breaks constructor checks and will lead to issues! - https://github.com/yjs/yjs/issues/438');
  }
  glo[importIdentifier] = true;

  var Y$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AbsolutePosition: AbsolutePosition,
    AbstractConnector: AbstractConnector,
    AbstractStruct: AbstractStruct,
    AbstractType: AbstractType,
    Array: YArray,
    ContentAny: ContentAny,
    ContentBinary: ContentBinary,
    ContentDeleted: ContentDeleted,
    ContentEmbed: ContentEmbed,
    ContentFormat: ContentFormat,
    ContentJSON: ContentJSON,
    ContentString: ContentString,
    ContentType: ContentType,
    Doc: Doc,
    GC: GC,
    ID: ID,
    Item: Item,
    Map: YMap,
    PermanentUserData: PermanentUserData,
    RelativePosition: RelativePosition,
    Snapshot: Snapshot,
    Text: YText,
    Transaction: Transaction,
    UndoManager: UndoManager,
    UpdateEncoderV1: UpdateEncoderV1,
    XmlElement: YXmlElement,
    XmlFragment: YXmlFragment,
    XmlHook: YXmlHook,
    XmlText: YXmlText,
    YArrayEvent: YArrayEvent,
    YEvent: YEvent,
    YMapEvent: YMapEvent,
    YTextEvent: YTextEvent,
    YXmlEvent: YXmlEvent,
    applyUpdate: applyUpdate,
    applyUpdateV2: applyUpdateV2,
    cleanupYTextFormatting: cleanupYTextFormatting,
    compareIDs: compareIDs,
    compareRelativePositions: compareRelativePositions,
    convertUpdateFormatV1ToV2: convertUpdateFormatV1ToV2,
    convertUpdateFormatV2ToV1: convertUpdateFormatV2ToV1,
    createAbsolutePositionFromRelativePosition: createAbsolutePositionFromRelativePosition,
    createDeleteSet: createDeleteSet,
    createDeleteSetFromStructStore: createDeleteSetFromStructStore,
    createDocFromSnapshot: createDocFromSnapshot,
    createID: createID,
    createRelativePositionFromJSON: createRelativePositionFromJSON,
    createRelativePositionFromTypeIndex: createRelativePositionFromTypeIndex,
    createSnapshot: createSnapshot,
    decodeRelativePosition: decodeRelativePosition,
    decodeSnapshot: decodeSnapshot,
    decodeSnapshotV2: decodeSnapshotV2,
    decodeStateVector: decodeStateVector,
    decodeUpdate: decodeUpdate,
    decodeUpdateV2: decodeUpdateV2,
    diffUpdate: diffUpdate,
    diffUpdateV2: diffUpdateV2,
    emptySnapshot: emptySnapshot,
    encodeRelativePosition: encodeRelativePosition,
    encodeSnapshot: encodeSnapshot,
    encodeSnapshotV2: encodeSnapshotV2,
    encodeStateAsUpdate: encodeStateAsUpdate,
    encodeStateAsUpdateV2: encodeStateAsUpdateV2,
    encodeStateVector: encodeStateVector,
    encodeStateVectorFromUpdate: encodeStateVectorFromUpdate,
    encodeStateVectorFromUpdateV2: encodeStateVectorFromUpdateV2,
    equalSnapshots: equalSnapshots,
    findIndexSS: findIndexSS,
    findRootTypeKey: findRootTypeKey,
    getItem: getItem,
    getState: getState,
    getTypeChildren: getTypeChildren,
    isDeleted: isDeleted,
    isParentOf: isParentOf,
    iterateDeletedStructs: iterateDeletedStructs,
    logType: logType,
    logUpdate: logUpdate,
    logUpdateV2: logUpdateV2,
    mergeUpdates: mergeUpdates,
    mergeUpdatesV2: mergeUpdatesV2,
    obfuscateUpdate: obfuscateUpdate,
    obfuscateUpdateV2: obfuscateUpdateV2,
    parseUpdateMeta: parseUpdateMeta,
    parseUpdateMetaV2: parseUpdateMetaV2,
    readUpdate: readUpdate$1,
    readUpdateV2: readUpdateV2,
    relativePositionToJSON: relativePositionToJSON,
    snapshot: snapshot$1,
    transact: transact,
    tryGc: tryGc$1,
    typeListToArraySnapshot: typeListToArraySnapshot,
    typeMapGetSnapshot: typeMapGetSnapshot
  });

  /**
   * @module sync-protocol
   */

  /**
   * @typedef {Map<number, number>} StateMap
   */

  /**
   * Core Yjs defines two message types:
   * • YjsSyncStep1: Includes the State Set of the sending client. When received, the client should reply with YjsSyncStep2.
   * • YjsSyncStep2: Includes all missing structs and the complete delete set. When received, the client is assured that it
   *   received all information from the remote client.
   *
   * In a peer-to-peer network, you may want to introduce a SyncDone message type. Both parties should initiate the connection
   * with SyncStep1. When a client received SyncStep2, it should reply with SyncDone. When the local client received both
   * SyncStep2 and SyncDone, it is assured that it is synced to the remote client.
   *
   * In a client-server model, you want to handle this differently: The client should initiate the connection with SyncStep1.
   * When the server receives SyncStep1, it should reply with SyncStep2 immediately followed by SyncStep1. The client replies
   * with SyncStep2 when it receives SyncStep1. Optionally the server may send a SyncDone after it received SyncStep2, so the
   * client knows that the sync is finished.  There are two reasons for this more elaborated sync model: 1. This protocol can
   * easily be implemented on top of http and websockets. 2. The server shoul only reply to requests, and not initiate them.
   * Therefore it is necesarry that the client initiates the sync.
   *
   * Construction of a message:
   * [messageType : varUint, message definition..]
   *
   * Note: A message does not include information about the room name. This must to be handled by the upper layer protocol!
   *
   * stringify[messageType] stringifies a message definition (messageType is already read from the bufffer)
   */

  const messageYjsSyncStep1 = 0;
  const messageYjsSyncStep2 = 1;
  const messageYjsUpdate = 2;

  /**
   * Create a sync step 1 message based on the state of the current shared document.
   *
   * @param {encoding.Encoder} encoder
   * @param {Y.Doc} doc
   */
  const writeSyncStep1 = (encoder, doc) => {
    writeVarUint(encoder, messageYjsSyncStep1);
    const sv = encodeStateVector(doc);
    writeVarUint8Array(encoder, sv);
  };

  /**
   * @param {encoding.Encoder} encoder
   * @param {Y.Doc} doc
   * @param {Uint8Array} [encodedStateVector]
   */
  const writeSyncStep2 = (encoder, doc, encodedStateVector) => {
    writeVarUint(encoder, messageYjsSyncStep2);
    writeVarUint8Array(encoder, encodeStateAsUpdate(doc, encodedStateVector));
  };

  /**
   * Read SyncStep1 message and reply with SyncStep2.
   *
   * @param {decoding.Decoder} decoder The reply to the received message
   * @param {encoding.Encoder} encoder The received message
   * @param {Y.Doc} doc
   */
  const readSyncStep1 = (decoder, encoder, doc) =>
    writeSyncStep2(encoder, doc, readVarUint8Array(decoder));

  /**
   * Read and apply Structs and then DeleteStore to a y instance.
   *
   * @param {decoding.Decoder} decoder
   * @param {Y.Doc} doc
   * @param {any} transactionOrigin
   */
  const readSyncStep2 = (decoder, doc, transactionOrigin) => {
    try {
      applyUpdate(doc, readVarUint8Array(decoder), transactionOrigin);
    } catch (error) {
      // This catches errors that are thrown by event handlers
      console.error('Caught error while handling a Yjs update', error);
    }
  };

  /**
   * @param {encoding.Encoder} encoder
   * @param {Uint8Array} update
   */
  const writeUpdate = (encoder, update) => {
    writeVarUint(encoder, messageYjsUpdate);
    writeVarUint8Array(encoder, update);
  };

  /**
   * Read and apply Structs and then DeleteStore to a y instance.
   *
   * @param {decoding.Decoder} decoder
   * @param {Y.Doc} doc
   * @param {any} transactionOrigin
   */
  const readUpdate = readSyncStep2;

  /**
   * @param {decoding.Decoder} decoder A message received from another client
   * @param {encoding.Encoder} encoder The reply message. Will not be sent if empty.
   * @param {Y.Doc} doc
   * @param {any} transactionOrigin
   */
  const readSyncMessage = (decoder, encoder, doc, transactionOrigin) => {
    const messageType = readVarUint(decoder);
    switch (messageType) {
      case messageYjsSyncStep1:
        readSyncStep1(decoder, encoder, doc);
        break
      case messageYjsSyncStep2:
        readSyncStep2(decoder, doc, transactionOrigin);
        break
      case messageYjsUpdate:
        readUpdate(decoder, doc, transactionOrigin);
        break
      default:
        throw new Error('Unknown message type')
    }
    return messageType
  };

  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.Y = Y$1; // eslint-disable-line
  }

  /**
   * @param {TestYInstance} y // publish message created by `y` to all other online clients
   * @param {Uint8Array} m
   */
  const broadcastMessage = (y, m) => {
    if (y.tc.onlineConns.has(y)) {
      y.tc.onlineConns.forEach(remoteYInstance => {
        if (remoteYInstance !== y) {
          remoteYInstance._receive(m, y);
        }
      });
    }
  };

  let useV2 = false;

  const encV1$1 = {
    encodeStateAsUpdate: encodeStateAsUpdate,
    mergeUpdates: mergeUpdates,
    applyUpdate: applyUpdate,
    logUpdate: logUpdate,
    updateEventName: 'update',
    diffUpdate: diffUpdate
  };

  const encV2$1 = {
    encodeStateAsUpdate: encodeStateAsUpdateV2,
    mergeUpdates: mergeUpdatesV2,
    applyUpdate: applyUpdateV2,
    logUpdate: logUpdateV2,
    updateEventName: 'updateV2',
    diffUpdate: diffUpdateV2
  };

  let enc = encV1$1;

  const useV1Encoding = () => {
    useV2 = false;
    enc = encV1$1;
  };

  const useV2Encoding = () => {
    console.error('sync protocol doesnt support v2 protocol yet, fallback to v1 encoding'); // @Todo
    useV2 = false;
    enc = encV1$1;
  };

  class TestYInstance extends Doc {
    /**
     * @param {TestConnector} testConnector
     * @param {number} clientID
     */
    constructor (testConnector, clientID) {
      super();
      this.userID = clientID; // overwriting clientID
      /**
       * @type {TestConnector}
       */
      this.tc = testConnector;
      /**
       * @type {Map<TestYInstance, Array<Uint8Array>>}
       */
      this.receiving = new Map();
      testConnector.allConns.add(this);
      /**
       * The list of received updates.
       * We are going to merge them later using Y.mergeUpdates and check if the resulting document is correct.
       * @type {Array<Uint8Array>}
       */
      this.updates = [];
      // set up observe on local model
      this.on(enc.updateEventName, /** @param {Uint8Array} update @param {any} origin */ (update, origin) => {
        if (origin !== testConnector) {
          const encoder = createEncoder();
          writeUpdate(encoder, update);
          broadcastMessage(this, toUint8Array(encoder));
        }
        this.updates.push(update);
      });
      this.connect();
    }

    /**
     * Disconnect from TestConnector.
     */
    disconnect () {
      this.receiving = new Map();
      this.tc.onlineConns.delete(this);
    }

    /**
     * Append yourself to the list of known Y instances in testconnector.
     * Also initiate sync with all clients.
     */
    connect () {
      if (!this.tc.onlineConns.has(this)) {
        this.tc.onlineConns.add(this);
        const encoder = createEncoder();
        writeSyncStep1(encoder, this);
        // publish SyncStep1
        broadcastMessage(this, toUint8Array(encoder));
        this.tc.onlineConns.forEach(remoteYInstance => {
          if (remoteYInstance !== this) {
            // remote instance sends instance to this instance
            const encoder = createEncoder();
            writeSyncStep1(encoder, remoteYInstance);
            this._receive(toUint8Array(encoder), remoteYInstance);
          }
        });
      }
    }

    /**
     * Receive a message from another client. This message is only appended to the list of receiving messages.
     * TestConnector decides when this client actually reads this message.
     *
     * @param {Uint8Array} message
     * @param {TestYInstance} remoteClient
     */
    _receive (message, remoteClient) {
      setIfUndefined(this.receiving, remoteClient, () => /** @type {Array<Uint8Array>} */ ([])).push(message);
    }
  }

  /**
   * Keeps track of TestYInstances.
   *
   * The TestYInstances add/remove themselves from the list of connections maiained in this object.
   * I think it makes sense. Deal with it.
   */
  class TestConnector {
    /**
     * @param {prng.PRNG} gen
     */
    constructor (gen) {
      /**
       * @type {Set<TestYInstance>}
       */
      this.allConns = new Set();
      /**
       * @type {Set<TestYInstance>}
       */
      this.onlineConns = new Set();
      /**
       * @type {prng.PRNG}
       */
      this.prng = gen;
    }

    /**
     * Create a new Y instance and add it to the list of connections
     * @param {number} clientID
     */
    createY (clientID) {
      return new TestYInstance(this, clientID)
    }

    /**
     * Choose random connection and flush a random message from a random sender.
     *
     * If this function was unable to flush a message, because there are no more messages to flush, it returns false. true otherwise.
     * @return {boolean}
     */
    flushRandomMessage () {
      const gen = this.prng;
      const conns = Array.from(this.onlineConns).filter(conn => conn.receiving.size > 0);
      if (conns.length > 0) {
        const receiver = oneOf(gen, conns);
        const [sender, messages] = oneOf(gen, Array.from(receiver.receiving));
        const m = messages.shift();
        if (messages.length === 0) {
          receiver.receiving.delete(sender);
        }
        if (m === undefined) {
          return this.flushRandomMessage()
        }
        const encoder = createEncoder();
        // console.log('receive (' + sender.userID + '->' + receiver.userID + '):\n', syncProtocol.stringifySyncMessage(decoding.createDecoder(m), receiver))
        // do not publish data created when this function is executed (could be ss2 or update message)
        readSyncMessage(createDecoder(m), encoder, receiver, receiver.tc);
        if (length(encoder) > 0) {
          // send reply message
          sender._receive(toUint8Array(encoder), receiver);
        }
        return true
      }
      return false
    }

    /**
     * @return {boolean} True iff this function actually flushed something
     */
    flushAllMessages () {
      let didSomething = false;
      while (this.flushRandomMessage()) {
        didSomething = true;
      }
      return didSomething
    }

    reconnectAll () {
      this.allConns.forEach(conn => conn.connect());
    }

    disconnectAll () {
      this.allConns.forEach(conn => conn.disconnect());
    }

    syncAll () {
      this.reconnectAll();
      this.flushAllMessages();
    }

    /**
     * @return {boolean} Whether it was possible to disconnect a randon connection.
     */
    disconnectRandom () {
      if (this.onlineConns.size === 0) {
        return false
      }
      oneOf(this.prng, Array.from(this.onlineConns)).disconnect();
      return true
    }

    /**
     * @return {boolean} Whether it was possible to reconnect a random connection.
     */
    reconnectRandom () {
      /**
       * @type {Array<TestYInstance>}
       */
      const reconnectable = [];
      this.allConns.forEach(conn => {
        if (!this.onlineConns.has(conn)) {
          reconnectable.push(conn);
        }
      });
      if (reconnectable.length === 0) {
        return false
      }
      oneOf(this.prng, reconnectable).connect();
      return true
    }
  }

  /**
   * @template T
   * @param {t.TestCase} tc
   * @param {{users?:number}} conf
   * @param {InitTestObjectCallback<T>} [initTestObject]
   * @return {{testObjects:Array<any>,testConnector:TestConnector,users:Array<TestYInstance>,array0:Y.Array<any>,array1:Y.Array<any>,array2:Y.Array<any>,map0:Y.Map<any>,map1:Y.Map<any>,map2:Y.Map<any>,map3:Y.Map<any>,text0:Y.Text,text1:Y.Text,text2:Y.Text,xml0:Y.XmlElement,xml1:Y.XmlElement,xml2:Y.XmlElement}}
   */
  const init$1 = (tc, { users = 5 } = {}, initTestObject) => {
    /**
     * @type {Object<string,any>}
     */
    const result = {
      users: []
    };
    const gen = tc.prng;
    // choose an encoding approach at random
    if (bool(gen)) {
      useV2Encoding();
    } else {
      useV1Encoding();
    }

    const testConnector = new TestConnector(gen);
    result.testConnector = testConnector;
    for (let i = 0; i < users; i++) {
      const y = testConnector.createY(i);
      y.clientID = i;
      result.users.push(y);
      result['array' + i] = y.getArray('array');
      result['map' + i] = y.getMap('map');
      result['xml' + i] = y.get('xml', YXmlElement);
      result['text' + i] = y.getText('text');
    }
    testConnector.syncAll();
    result.testObjects = result.users.map(initTestObject || (() => null));
    useV1Encoding();
    return /** @type {any} */ (result)
  };

  /**
   * 1. reconnect and flush all
   * 2. user 0 gc
   * 3. get type content
   * 4. disconnect & reconnect all (so gc is propagated)
   * 5. compare os, ds, ss
   *
   * @param {Array<TestYInstance>} users
   */
  const compare$1 = users => {
    users.forEach(u => u.connect());
    while (users[0].tc.flushAllMessages()) {} // eslint-disable-line
    // For each document, merge all received document updates with Y.mergeUpdates and create a new document which will be added to the list of "users"
    // This ensures that mergeUpdates works correctly
    const mergedDocs = users.map(user => {
      const ydoc = new Doc();
      enc.applyUpdate(ydoc, enc.mergeUpdates(user.updates));
      return ydoc
    });
    users.push(.../** @type {any} */(mergedDocs));
    const userArrayValues = users.map(u => u.getArray('array').toJSON());
    const userMapValues = users.map(u => u.getMap('map').toJSON());
    const userXmlValues = users.map(u => u.get('xml', YXmlElement).toString());
    const userTextValues = users.map(u => u.getText('text').toDelta());
    for (const u of users) {
      assert(u.store.pendingDs === null);
      assert(u.store.pendingStructs === null);
    }
    // Test Array iterator
    compare$2(users[0].getArray('array').toArray(), Array.from(users[0].getArray('array')));
    // Test Map iterator
    const ymapkeys = Array.from(users[0].getMap('map').keys());
    assert(ymapkeys.length === Object.keys(userMapValues[0]).length);
    ymapkeys.forEach(key => assert(hasProperty(userMapValues[0], key)));
    /**
     * @type {Object<string,any>}
     */
    const mapRes = {};
    for (const [k, v] of users[0].getMap('map')) {
      mapRes[k] = v instanceof AbstractType ? v.toJSON() : v;
    }
    compare$2(userMapValues[0], mapRes);
    // Compare all users
    for (let i = 0; i < users.length - 1; i++) {
      compare$2(userArrayValues[i].length, users[i].getArray('array').length);
      compare$2(userArrayValues[i], userArrayValues[i + 1]);
      compare$2(userMapValues[i], userMapValues[i + 1]);
      compare$2(userXmlValues[i], userXmlValues[i + 1]);
      compare$2(userTextValues[i].map(/** @param {any} a */ a => typeof a.insert === 'string' ? a.insert : ' ').join('').length, users[i].getText('text').length);
      compare$2(userTextValues[i], userTextValues[i + 1], '', (_constructor, a, b) => {
        if (a instanceof AbstractType) {
          compare$2(a.toJSON(), b.toJSON());
        } else if (a !== b) {
          fail('Deltas dont match');
        }
        return true
      });
      compare$2(encodeStateVector(users[i]), encodeStateVector(users[i + 1]));
      compareDS(createDeleteSetFromStructStore(users[i].store), createDeleteSetFromStructStore(users[i + 1].store));
      compareStructStores(users[i].store, users[i + 1].store);
    }
    users.map(u => u.destroy());
  };

  /**
   * @param {Y.Item?} a
   * @param {Y.Item?} b
   * @return {boolean}
   */
  const compareItemIDs = (a, b) => a === b || (a !== null && b != null && compareIDs(a.id, b.id));

  /**
   * @param {import('../src/internals.js').StructStore} ss1
   * @param {import('../src/internals.js').StructStore} ss2
   */
  const compareStructStores = (ss1, ss2) => {
    assert(ss1.clients.size === ss2.clients.size);
    for (const [client, structs1] of ss1.clients) {
      const structs2 = /** @type {Array<Y.AbstractStruct>} */ (ss2.clients.get(client));
      assert(structs2 !== undefined && structs1.length === structs2.length);
      for (let i = 0; i < structs1.length; i++) {
        const s1 = structs1[i];
        const s2 = structs2[i];
        // checks for abstract struct
        if (
          s1.constructor !== s2.constructor ||
          !compareIDs(s1.id, s2.id) ||
          s1.deleted !== s2.deleted ||
          // @ts-ignore
          s1.length !== s2.length
        ) {
          fail('Structs dont match');
        }
        if (s1 instanceof Item) {
          if (
            !(s2 instanceof Item) ||
            !((s1.left === null && s2.left === null) || (s1.left !== null && s2.left !== null && compareIDs(s1.left.lastId, s2.left.lastId))) ||
            !compareItemIDs(s1.right, s2.right) ||
            !compareIDs(s1.origin, s2.origin) ||
            !compareIDs(s1.rightOrigin, s2.rightOrigin) ||
            s1.parentSub !== s2.parentSub
          ) {
            return fail('Items dont match')
          }
          // make sure that items are connected correctly
          assert(s1.left === null || s1.left.right === s1);
          assert(s1.right === null || s1.right.left === s1);
          assert(s2.left === null || s2.left.right === s2);
          assert(s2.right === null || s2.right.left === s2);
        }
      }
    }
  };

  /**
   * @param {import('../src/internals.js').DeleteSet} ds1
   * @param {import('../src/internals.js').DeleteSet} ds2
   */
  const compareDS = (ds1, ds2) => {
    assert(ds1.clients.size === ds2.clients.size);
    ds1.clients.forEach((deleteItems1, client) => {
      const deleteItems2 = /** @type {Array<import('../src/internals.js').DeleteItem>} */ (ds2.clients.get(client));
      assert(deleteItems2 !== undefined && deleteItems1.length === deleteItems2.length);
      for (let i = 0; i < deleteItems1.length; i++) {
        const di1 = deleteItems1[i];
        const di2 = deleteItems2[i];
        if (di1.clock !== di2.clock || di1.len !== di2.len) {
          fail('DeleteSets dont match');
        }
      }
    });
  };

  /**
   * @template T
   * @callback InitTestObjectCallback
   * @param {TestYInstance} y
   * @return {T}
   */

  /**
   * @template T
   * @param {t.TestCase} tc
   * @param {Array<function(Y.Doc,prng.PRNG,T):void>} mods
   * @param {number} iterations
   * @param {InitTestObjectCallback<T>} [initTestObject]
   */
  const applyRandomTests = (tc, mods, iterations, initTestObject) => {
    const gen = tc.prng;
    const result = init$1(tc, { users: 5 }, initTestObject);
    const { testConnector, users } = result;
    for (let i = 0; i < iterations; i++) {
      if (int32(gen, 0, 100) <= 2) {
        // 2% chance to disconnect/reconnect a random user
        if (bool(gen)) {
          testConnector.disconnectRandom();
        } else {
          testConnector.reconnectRandom();
        }
      } else if (int32(gen, 0, 100) <= 1) {
        // 1% chance to flush all
        testConnector.flushAllMessages();
      } else if (int32(gen, 0, 100) <= 50) {
        // 50% chance to flush a random message
        testConnector.flushRandomMessage();
      }
      const user = int32(gen, 0, users.length - 1);
      const test = oneOf(gen, mods);
      test(users[user], gen, result.testObjects[user]);
    }
    compare$1(users);
    return result
  };

  var Y = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AbsolutePosition: AbsolutePosition,
    AbstractConnector: AbstractConnector,
    AbstractStruct: AbstractStruct,
    AbstractType: AbstractType,
    Array: YArray,
    ContentAny: ContentAny,
    ContentBinary: ContentBinary,
    ContentDeleted: ContentDeleted,
    ContentEmbed: ContentEmbed,
    ContentFormat: ContentFormat,
    ContentJSON: ContentJSON,
    ContentString: ContentString,
    ContentType: ContentType,
    Doc: Doc,
    GC: GC,
    ID: ID,
    Item: Item,
    Map: YMap,
    PermanentUserData: PermanentUserData,
    RelativePosition: RelativePosition,
    Snapshot: Snapshot,
    TestConnector: TestConnector,
    TestYInstance: TestYInstance,
    Text: YText,
    Transaction: Transaction,
    UndoManager: UndoManager,
    UpdateEncoderV1: UpdateEncoderV1,
    XmlElement: YXmlElement,
    XmlFragment: YXmlFragment,
    XmlHook: YXmlHook,
    XmlText: YXmlText,
    YArrayEvent: YArrayEvent,
    YEvent: YEvent,
    YMapEvent: YMapEvent,
    YTextEvent: YTextEvent,
    YXmlEvent: YXmlEvent,
    applyRandomTests: applyRandomTests,
    applyUpdate: applyUpdate,
    applyUpdateV2: applyUpdateV2,
    cleanupYTextFormatting: cleanupYTextFormatting,
    compare: compare$1,
    compareDS: compareDS,
    compareIDs: compareIDs,
    compareItemIDs: compareItemIDs,
    compareRelativePositions: compareRelativePositions,
    compareStructStores: compareStructStores,
    convertUpdateFormatV1ToV2: convertUpdateFormatV1ToV2,
    convertUpdateFormatV2ToV1: convertUpdateFormatV2ToV1,
    createAbsolutePositionFromRelativePosition: createAbsolutePositionFromRelativePosition,
    createDeleteSet: createDeleteSet,
    createDeleteSetFromStructStore: createDeleteSetFromStructStore,
    createDocFromSnapshot: createDocFromSnapshot,
    createID: createID,
    createRelativePositionFromJSON: createRelativePositionFromJSON,
    createRelativePositionFromTypeIndex: createRelativePositionFromTypeIndex,
    createSnapshot: createSnapshot,
    decodeRelativePosition: decodeRelativePosition,
    decodeSnapshot: decodeSnapshot,
    decodeSnapshotV2: decodeSnapshotV2,
    decodeStateVector: decodeStateVector,
    decodeUpdate: decodeUpdate,
    decodeUpdateV2: decodeUpdateV2,
    diffUpdate: diffUpdate,
    diffUpdateV2: diffUpdateV2,
    emptySnapshot: emptySnapshot,
    get enc () { return enc; },
    encV1: encV1$1,
    encV2: encV2$1,
    encodeRelativePosition: encodeRelativePosition,
    encodeSnapshot: encodeSnapshot,
    encodeSnapshotV2: encodeSnapshotV2,
    encodeStateAsUpdate: encodeStateAsUpdate,
    encodeStateAsUpdateV2: encodeStateAsUpdateV2,
    encodeStateVector: encodeStateVector,
    encodeStateVectorFromUpdate: encodeStateVectorFromUpdate,
    encodeStateVectorFromUpdateV2: encodeStateVectorFromUpdateV2,
    equalSnapshots: equalSnapshots,
    findIndexSS: findIndexSS,
    findRootTypeKey: findRootTypeKey,
    getItem: getItem,
    getState: getState,
    getTypeChildren: getTypeChildren,
    init: init$1,
    isDeleted: isDeleted,
    isParentOf: isParentOf,
    iterateDeletedStructs: iterateDeletedStructs,
    logType: logType,
    logUpdate: logUpdate,
    logUpdateV2: logUpdateV2,
    mergeUpdates: mergeUpdates,
    mergeUpdatesV2: mergeUpdatesV2,
    obfuscateUpdate: obfuscateUpdate,
    obfuscateUpdateV2: obfuscateUpdateV2,
    parseUpdateMeta: parseUpdateMeta,
    parseUpdateMetaV2: parseUpdateMetaV2,
    readUpdate: readUpdate$1,
    readUpdateV2: readUpdateV2,
    relativePositionToJSON: relativePositionToJSON,
    snapshot: snapshot$1,
    transact: transact,
    tryGc: tryGc$1,
    typeListToArraySnapshot: typeListToArraySnapshot,
    typeMapGetSnapshot: typeMapGetSnapshot,
    get useV2 () { return useV2; }
  });

  /**
   * @param {t.TestCase} tc
   */
  const testMapHavingIterableAsConstructorParamTests = tc => {
    const { map0 } = init$1(tc, { users: 1 });

    const m1 = new YMap(Object.entries({ number: 1, string: 'hello' }));
    map0.set('m1', m1);
    assert(m1.get('number') === 1);
    assert(m1.get('string') === 'hello');

    const m2 = new YMap([
      ['object', { x: 1 }],
      ['boolean', true]
    ]);
    map0.set('m2', m2);
    assert(m2.get('object').x === 1);
    assert(m2.get('boolean') === true);

    const m3 = new YMap([...m1, ...m2]);
    map0.set('m3', m3);
    assert(m3.get('number') === 1);
    assert(m3.get('string') === 'hello');
    assert(m3.get('object').x === 1);
    assert(m3.get('boolean') === true);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testBasicMapTests = tc => {
    const { testConnector, users, map0, map1, map2 } = init$1(tc, { users: 3 });
    users[2].disconnect();

    map0.set('null', null);
    map0.set('number', 1);
    map0.set('string', 'hello Y');
    map0.set('object', { key: { key2: 'value' } });
    map0.set('y-map', new YMap());
    map0.set('boolean1', true);
    map0.set('boolean0', false);
    const map = map0.get('y-map');
    map.set('y-array', new YArray());
    const array = map.get('y-array');
    array.insert(0, [0]);
    array.insert(0, [-1]);

    assert(map0.get('null') === null, 'client 0 computed the change (null)');
    assert(map0.get('number') === 1, 'client 0 computed the change (number)');
    assert(map0.get('string') === 'hello Y', 'client 0 computed the change (string)');
    assert(map0.get('boolean0') === false, 'client 0 computed the change (boolean)');
    assert(map0.get('boolean1') === true, 'client 0 computed the change (boolean)');
    compare$2(map0.get('object'), { key: { key2: 'value' } }, 'client 0 computed the change (object)');
    assert(map0.get('y-map').get('y-array').get(0) === -1, 'client 0 computed the change (type)');
    assert(map0.size === 7, 'client 0 map has correct size');

    users[2].connect();
    testConnector.flushAllMessages();

    assert(map1.get('null') === null, 'client 1 received the update (null)');
    assert(map1.get('number') === 1, 'client 1 received the update (number)');
    assert(map1.get('string') === 'hello Y', 'client 1 received the update (string)');
    assert(map1.get('boolean0') === false, 'client 1 computed the change (boolean)');
    assert(map1.get('boolean1') === true, 'client 1 computed the change (boolean)');
    compare$2(map1.get('object'), { key: { key2: 'value' } }, 'client 1 received the update (object)');
    assert(map1.get('y-map').get('y-array').get(0) === -1, 'client 1 received the update (type)');
    assert(map1.size === 7, 'client 1 map has correct size');

    // compare disconnected user
    assert(map2.get('null') === null, 'client 2 received the update (null) - was disconnected');
    assert(map2.get('number') === 1, 'client 2 received the update (number) - was disconnected');
    assert(map2.get('string') === 'hello Y', 'client 2 received the update (string) - was disconnected');
    assert(map2.get('boolean0') === false, 'client 2 computed the change (boolean)');
    assert(map2.get('boolean1') === true, 'client 2 computed the change (boolean)');
    compare$2(map2.get('object'), { key: { key2: 'value' } }, 'client 2 received the update (object) - was disconnected');
    assert(map2.get('y-map').get('y-array').get(0) === -1, 'client 2 received the update (type) - was disconnected');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetAndSetOfMapProperty = tc => {
    const { testConnector, users, map0 } = init$1(tc, { users: 2 });
    map0.set('stuff', 'stuffy');
    map0.set('undefined', undefined);
    map0.set('null', null);
    compare$2(map0.get('stuff'), 'stuffy');

    testConnector.flushAllMessages();

    for (const user of users) {
      const u = user.getMap('map');
      compare$2(u.get('stuff'), 'stuffy');
      assert(u.get('undefined') === undefined, 'undefined');
      compare$2(u.get('null'), null, 'null');
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testYmapSetsYmap = tc => {
    const { users, map0 } = init$1(tc, { users: 2 });
    const map = map0.set('Map', new YMap());
    assert(map0.get('Map') === map);
    map.set('one', 1);
    compare$2(map.get('one'), 1);
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testYmapSetsYarray = tc => {
    const { users, map0 } = init$1(tc, { users: 2 });
    const array = map0.set('Array', new YArray());
    assert(array === map0.get('Array'));
    array.insert(0, [1, 2, 3]);
    // @ts-ignore
    compare$2(map0.toJSON(), { Array: [1, 2, 3] });
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetAndSetOfMapPropertySyncs = tc => {
    const { testConnector, users, map0 } = init$1(tc, { users: 2 });
    map0.set('stuff', 'stuffy');
    compare$2(map0.get('stuff'), 'stuffy');
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      compare$2(u.get('stuff'), 'stuffy');
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetAndSetOfMapPropertyWithConflict = tc => {
    const { testConnector, users, map0, map1 } = init$1(tc, { users: 3 });
    map0.set('stuff', 'c0');
    map1.set('stuff', 'c1');
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      compare$2(u.get('stuff'), 'c1');
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSizeAndDeleteOfMapProperty = tc => {
    const { map0 } = init$1(tc, { users: 1 });
    map0.set('stuff', 'c0');
    map0.set('otherstuff', 'c1');
    assert(map0.size === 2, `map size is ${map0.size} expected 2`);
    map0.delete('stuff');
    assert(map0.size === 1, `map size after delete is ${map0.size}, expected 1`);
    map0.delete('otherstuff');
    assert(map0.size === 0, `map size after delete is ${map0.size}, expected 0`);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetAndSetAndDeleteOfMapProperty = tc => {
    const { testConnector, users, map0, map1 } = init$1(tc, { users: 3 });
    map0.set('stuff', 'c0');
    map1.set('stuff', 'c1');
    map1.delete('stuff');
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      assert(u.get('stuff') === undefined);
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSetAndClearOfMapProperties = tc => {
    const { testConnector, users, map0 } = init$1(tc, { users: 1 });
    map0.set('stuff', 'c0');
    map0.set('otherstuff', 'c1');
    map0.clear();
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      assert(u.get('stuff') === undefined);
      assert(u.get('otherstuff') === undefined);
      assert(u.size === 0, `map size after clear is ${u.size}, expected 0`);
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSetAndClearOfMapPropertiesWithConflicts = tc => {
    const { testConnector, users, map0, map1, map2, map3 } = init$1(tc, { users: 4 });
    map0.set('stuff', 'c0');
    map1.set('stuff', 'c1');
    map1.set('stuff', 'c2');
    map2.set('stuff', 'c3');
    testConnector.flushAllMessages();
    map0.set('otherstuff', 'c0');
    map1.set('otherstuff', 'c1');
    map2.set('otherstuff', 'c2');
    map3.set('otherstuff', 'c3');
    map3.clear();
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      assert(u.get('stuff') === undefined);
      assert(u.get('otherstuff') === undefined);
      assert(u.size === 0, `map size after clear is ${u.size}, expected 0`);
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetAndSetOfMapPropertyWithThreeConflicts = tc => {
    const { testConnector, users, map0, map1, map2 } = init$1(tc, { users: 3 });
    map0.set('stuff', 'c0');
    map1.set('stuff', 'c1');
    map1.set('stuff', 'c2');
    map2.set('stuff', 'c3');
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      compare$2(u.get('stuff'), 'c3');
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetAndSetAndDeleteOfMapPropertyWithThreeConflicts = tc => {
    const { testConnector, users, map0, map1, map2, map3 } = init$1(tc, { users: 4 });
    map0.set('stuff', 'c0');
    map1.set('stuff', 'c1');
    map1.set('stuff', 'c2');
    map2.set('stuff', 'c3');
    testConnector.flushAllMessages();
    map0.set('stuff', 'deleteme');
    map1.set('stuff', 'c1');
    map2.set('stuff', 'c2');
    map3.set('stuff', 'c3');
    map3.delete('stuff');
    testConnector.flushAllMessages();
    for (const user of users) {
      const u = user.getMap('map');
      assert(u.get('stuff') === undefined);
    }
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testObserveDeepProperties = tc => {
    const { testConnector, users, map1, map2, map3 } = init$1(tc, { users: 4 });
    const _map1 = map1.set('map', new YMap());
    let calls = 0;
    let dmapid;
    map1.observeDeep(events => {
      events.forEach(event => {
        calls++;
        // @ts-ignore
        assert(event.keysChanged.has('deepmap'));
        assert(event.path.length === 1);
        assert(event.path[0] === 'map');
        // @ts-ignore
        dmapid = event.target.get('deepmap')._item.id;
      });
    });
    testConnector.flushAllMessages();
    const _map3 = map3.get('map');
    _map3.set('deepmap', new YMap());
    testConnector.flushAllMessages();
    const _map2 = map2.get('map');
    _map2.set('deepmap', new YMap());
    testConnector.flushAllMessages();
    const dmap1 = _map1.get('deepmap');
    const dmap2 = _map2.get('deepmap');
    const dmap3 = _map3.get('deepmap');
    assert(calls > 0);
    assert(compareIDs(dmap1._item.id, dmap2._item.id));
    assert(compareIDs(dmap1._item.id, dmap3._item.id));
    // @ts-ignore we want the possibility of dmapid being undefined
    assert(compareIDs(dmap1._item.id, dmapid));
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testObserversUsingObservedeep = tc => {
    const { users, map0 } = init$1(tc, { users: 2 });
    /**
     * @type {Array<Array<string|number>>}
     */
    const pathes = [];
    let calls = 0;
    map0.observeDeep(events => {
      events.forEach(event => {
        pathes.push(event.path);
      });
      calls++;
    });
    map0.set('map', new YMap());
    map0.get('map').set('array', new YArray());
    map0.get('map').get('array').insert(0, ['content']);
    assert(calls === 3);
    compare$2(pathes, [[], ['map'], ['map', 'array']]);
    compare$1(users);
  };

  // TODO: Test events in Y.Map
  /**
   * @param {Object<string,any>} is
   * @param {Object<string,any>} should
   */
  const compareEvent = (is, should) => {
    for (const key in should) {
      compare$2(should[key], is[key]);
    }
  };

  /**
   * @param {t.TestCase} tc
   */
  const testThrowsAddAndUpdateAndDeleteEvents = tc => {
    const { users, map0 } = init$1(tc, { users: 2 });
    /**
     * @type {Object<string,any>}
     */
    let event = {};
    map0.observe(e => {
      event = e; // just put it on event, should be thrown synchronously anyway
    });
    map0.set('stuff', 4);
    compareEvent(event, {
      target: map0,
      keysChanged: new Set(['stuff'])
    });
    // update, oldValue is in contents
    map0.set('stuff', new YArray());
    compareEvent(event, {
      target: map0,
      keysChanged: new Set(['stuff'])
    });
    // update, oldValue is in opContents
    map0.set('stuff', 5);
    // delete
    map0.delete('stuff');
    compareEvent(event, {
      keysChanged: new Set(['stuff']),
      target: map0
    });
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testThrowsDeleteEventsOnClear = tc => {
    const { users, map0 } = init$1(tc, { users: 2 });
    /**
     * @type {Object<string,any>}
     */
    let event = {};
    map0.observe(e => {
      event = e; // just put it on event, should be thrown synchronously anyway
    });
    // set values
    map0.set('stuff', 4);
    map0.set('otherstuff', new YArray());
    // clear
    map0.clear();
    compareEvent(event, {
      keysChanged: new Set(['stuff', 'otherstuff']),
      target: map0
    });
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testChangeEvent$1 = tc => {
    const { map0, users } = init$1(tc, { users: 2 });
    /**
     * @type {any}
     */
    let changes = null;
    /**
     * @type {any}
     */
    let keyChange = null;
    map0.observe(e => {
      changes = e.changes;
    });
    map0.set('a', 1);
    keyChange = changes.keys.get('a');
    assert(changes !== null && keyChange.action === 'add' && keyChange.oldValue === undefined);
    map0.set('a', 2);
    keyChange = changes.keys.get('a');
    assert(changes !== null && keyChange.action === 'update' && keyChange.oldValue === 1);
    users[0].transact(() => {
      map0.set('a', 3);
      map0.set('a', 4);
    });
    keyChange = changes.keys.get('a');
    assert(changes !== null && keyChange.action === 'update' && keyChange.oldValue === 2);
    users[0].transact(() => {
      map0.set('b', 1);
      map0.set('b', 2);
    });
    keyChange = changes.keys.get('b');
    assert(changes !== null && keyChange.action === 'add' && keyChange.oldValue === undefined);
    users[0].transact(() => {
      map0.set('c', 1);
      map0.delete('c');
    });
    assert(changes !== null && changes.keys.size === 0);
    users[0].transact(() => {
      map0.set('d', 1);
      map0.set('d', 2);
    });
    keyChange = changes.keys.get('d');
    assert(changes !== null && keyChange.action === 'add' && keyChange.oldValue === undefined);
    compare$1(users);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testYmapEventExceptionsShouldCompleteTransaction = _tc => {
    const doc = new Doc();
    const map = doc.getMap('map');

    let updateCalled = false;
    let throwingObserverCalled = false;
    let throwingDeepObserverCalled = false;
    doc.on('update', () => {
      updateCalled = true;
    });

    const throwingObserver = () => {
      throwingObserverCalled = true;
      throw new Error('Failure')
    };

    const throwingDeepObserver = () => {
      throwingDeepObserverCalled = true;
      throw new Error('Failure')
    };

    map.observe(throwingObserver);
    map.observeDeep(throwingDeepObserver);

    fails(() => {
      map.set('y', '2');
    });

    assert(updateCalled);
    assert(throwingObserverCalled);
    assert(throwingDeepObserverCalled);

    // check if it works again
    updateCalled = false;
    throwingObserverCalled = false;
    throwingDeepObserverCalled = false;
    fails(() => {
      map.set('z', '3');
    });

    assert(updateCalled);
    assert(throwingObserverCalled);
    assert(throwingDeepObserverCalled);

    assert(map.get('z') === '3');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testYmapEventHasCorrectValueWhenSettingAPrimitive = tc => {
    const { users, map0 } = init$1(tc, { users: 3 });
    /**
     * @type {Object<string,any>}
     */
    let event = {};
    map0.observe(e => {
      event = e;
    });
    map0.set('stuff', 2);
    compare$2(event.value, event.target.get(event.name));
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testYmapEventHasCorrectValueWhenSettingAPrimitiveFromOtherUser = tc => {
    const { users, map0, map1, testConnector } = init$1(tc, { users: 3 });
    /**
     * @type {Object<string,any>}
     */
    let event = {};
    map0.observe(e => {
      event = e;
    });
    map1.set('stuff', 2);
    testConnector.flushAllMessages();
    compare$2(event.value, event.target.get(event.name));
    compare$1(users);
  };

  /**
   * @type {Array<function(Doc,prng.PRNG):void>}
   */
  const mapTransactions = [
    function set (user, gen) {
      const key = oneOf(gen, ['one', 'two']);
      const value = utf16String(gen);
      user.getMap('map').set(key, value);
    },
    function setType (user, gen) {
      const key = oneOf(gen, ['one', 'two']);
      const type = oneOf(gen, [new YArray(), new YMap()]);
      user.getMap('map').set(key, type);
      if (type instanceof YArray) {
        type.insert(0, [1, 2, 3, 4]);
      } else {
        type.set('deepkey', 'deepvalue');
      }
    },
    function _delete (user, gen) {
      const key = oneOf(gen, ['one', 'two']);
      user.getMap('map').delete(key);
    }
  ];

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests10 = tc => {
    applyRandomTests(tc, mapTransactions, 3);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests40 = tc => {
    applyRandomTests(tc, mapTransactions, 40);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests42 = tc => {
    applyRandomTests(tc, mapTransactions, 42);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests43 = tc => {
    applyRandomTests(tc, mapTransactions, 43);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests44 = tc => {
    applyRandomTests(tc, mapTransactions, 44);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests45 = tc => {
    applyRandomTests(tc, mapTransactions, 45);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests46 = tc => {
    applyRandomTests(tc, mapTransactions, 46);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests300 = tc => {
    applyRandomTests(tc, mapTransactions, 300);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests400 = tc => {
    applyRandomTests(tc, mapTransactions, 400);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests500 = tc => {
    applyRandomTests(tc, mapTransactions, 500);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests600 = tc => {
    applyRandomTests(tc, mapTransactions, 600);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests1000 = tc => {
    applyRandomTests(tc, mapTransactions, 1000);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests1800 = tc => {
    applyRandomTests(tc, mapTransactions, 1800);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests5000 = tc => {
    skip(!production);
    applyRandomTests(tc, mapTransactions, 5000);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests10000 = tc => {
    skip(!production);
    applyRandomTests(tc, mapTransactions, 10000);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYmapTests100000 = tc => {
    skip(!production);
    applyRandomTests(tc, mapTransactions, 100000);
  };

  var map = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testBasicMapTests: testBasicMapTests,
    testChangeEvent: testChangeEvent$1,
    testGetAndSetAndDeleteOfMapProperty: testGetAndSetAndDeleteOfMapProperty,
    testGetAndSetAndDeleteOfMapPropertyWithThreeConflicts: testGetAndSetAndDeleteOfMapPropertyWithThreeConflicts,
    testGetAndSetOfMapProperty: testGetAndSetOfMapProperty,
    testGetAndSetOfMapPropertySyncs: testGetAndSetOfMapPropertySyncs,
    testGetAndSetOfMapPropertyWithConflict: testGetAndSetOfMapPropertyWithConflict,
    testGetAndSetOfMapPropertyWithThreeConflicts: testGetAndSetOfMapPropertyWithThreeConflicts,
    testMapHavingIterableAsConstructorParamTests: testMapHavingIterableAsConstructorParamTests,
    testObserveDeepProperties: testObserveDeepProperties,
    testObserversUsingObservedeep: testObserversUsingObservedeep,
    testRepeatGeneratingYmapTests10: testRepeatGeneratingYmapTests10,
    testRepeatGeneratingYmapTests1000: testRepeatGeneratingYmapTests1000,
    testRepeatGeneratingYmapTests10000: testRepeatGeneratingYmapTests10000,
    testRepeatGeneratingYmapTests100000: testRepeatGeneratingYmapTests100000,
    testRepeatGeneratingYmapTests1800: testRepeatGeneratingYmapTests1800,
    testRepeatGeneratingYmapTests300: testRepeatGeneratingYmapTests300,
    testRepeatGeneratingYmapTests40: testRepeatGeneratingYmapTests40,
    testRepeatGeneratingYmapTests400: testRepeatGeneratingYmapTests400,
    testRepeatGeneratingYmapTests42: testRepeatGeneratingYmapTests42,
    testRepeatGeneratingYmapTests43: testRepeatGeneratingYmapTests43,
    testRepeatGeneratingYmapTests44: testRepeatGeneratingYmapTests44,
    testRepeatGeneratingYmapTests45: testRepeatGeneratingYmapTests45,
    testRepeatGeneratingYmapTests46: testRepeatGeneratingYmapTests46,
    testRepeatGeneratingYmapTests500: testRepeatGeneratingYmapTests500,
    testRepeatGeneratingYmapTests5000: testRepeatGeneratingYmapTests5000,
    testRepeatGeneratingYmapTests600: testRepeatGeneratingYmapTests600,
    testSetAndClearOfMapProperties: testSetAndClearOfMapProperties,
    testSetAndClearOfMapPropertiesWithConflicts: testSetAndClearOfMapPropertiesWithConflicts,
    testSizeAndDeleteOfMapProperty: testSizeAndDeleteOfMapProperty,
    testThrowsAddAndUpdateAndDeleteEvents: testThrowsAddAndUpdateAndDeleteEvents,
    testThrowsDeleteEventsOnClear: testThrowsDeleteEventsOnClear,
    testYmapEventExceptionsShouldCompleteTransaction: testYmapEventExceptionsShouldCompleteTransaction,
    testYmapEventHasCorrectValueWhenSettingAPrimitive: testYmapEventHasCorrectValueWhenSettingAPrimitive,
    testYmapEventHasCorrectValueWhenSettingAPrimitiveFromOtherUser: testYmapEventHasCorrectValueWhenSettingAPrimitiveFromOtherUser,
    testYmapSetsYarray: testYmapSetsYarray,
    testYmapSetsYmap: testYmapSetsYmap
  });

  /**
   * @param {t.TestCase} tc
   */
  const testBasicUpdate = tc => {
    const doc1 = new Doc();
    const doc2 = new Doc();
    doc1.getArray('array').insert(0, ['hi']);
    const update = encodeStateAsUpdate(doc1);
    applyUpdate(doc2, update);
    compare$2(doc2.getArray('array').toArray(), ['hi']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSlice = tc => {
    const doc1 = new Doc();
    const arr = doc1.getArray('array');
    arr.insert(0, [1, 2, 3]);
    compareArrays(arr.slice(0), [1, 2, 3]);
    compareArrays(arr.slice(1), [2, 3]);
    compareArrays(arr.slice(0, -1), [1, 2]);
    arr.insert(0, [0]);
    compareArrays(arr.slice(0), [0, 1, 2, 3]);
    compareArrays(arr.slice(0, 2), [0, 1]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testArrayFrom = tc => {
    const doc1 = new Doc();
    const db1 = doc1.getMap('root');
    const nestedArray1 = YArray.from([0, 1, 2]);
    db1.set('array', nestedArray1);
    compare$2(nestedArray1.toArray(), [0, 1, 2]);
  };

  /**
   * Debugging yjs#297 - a critical bug connected to the search-marker approach
   *
   * @param {t.TestCase} tc
   */
  const testLengthIssue = tc => {
    const doc1 = new Doc();
    const arr = doc1.getArray('array');
    arr.push([0, 1, 2, 3]);
    arr.delete(0);
    arr.insert(0, [0]);
    assert(arr.length === arr.toArray().length);
    doc1.transact(() => {
      arr.delete(1);
      assert(arr.length === arr.toArray().length);
      arr.insert(1, [1]);
      assert(arr.length === arr.toArray().length);
      arr.delete(2);
      assert(arr.length === arr.toArray().length);
      arr.insert(2, [2]);
      assert(arr.length === arr.toArray().length);
    });
    assert(arr.length === arr.toArray().length);
    arr.delete(1);
    assert(arr.length === arr.toArray().length);
    arr.insert(1, [1]);
    assert(arr.length === arr.toArray().length);
  };

  /**
   * Debugging yjs#314
   *
   * @param {t.TestCase} tc
   */
  const testLengthIssue2 = tc => {
    const doc = new Doc();
    const next = doc.getArray();
    doc.transact(() => {
      next.insert(0, ['group2']);
    });
    doc.transact(() => {
      next.insert(1, ['rectangle3']);
    });
    doc.transact(() => {
      next.delete(0);
      next.insert(0, ['rectangle3']);
    });
    next.delete(1);
    doc.transact(() => {
      next.insert(1, ['ellipse4']);
    });
    doc.transact(() => {
      next.insert(2, ['ellipse3']);
    });
    doc.transact(() => {
      next.insert(3, ['ellipse2']);
    });
    doc.transact(() => {
      doc.transact(() => {
        fails(() => {
          next.insert(5, ['rectangle2']);
        });
        next.insert(4, ['rectangle2']);
      });
      doc.transact(() => {
        // this should not throw an error message
        next.delete(4);
      });
    });
    console.log(next.toArray());
  };

  /**
   * @param {t.TestCase} tc
   */
  const testDeleteInsert = tc => {
    const { users, array0 } = init$1(tc, { users: 2 });
    array0.delete(0, 0);
    describe('Does not throw when deleting zero elements with position 0');
    fails(() => {
      array0.delete(1, 1);
    });
    array0.insert(0, ['A']);
    array0.delete(1, 0);
    describe('Does not throw when deleting zero elements with valid position 1');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertThreeElementsTryRegetProperty = tc => {
    const { testConnector, users, array0, array1 } = init$1(tc, { users: 2 });
    array0.insert(0, [1, true, false]);
    compare$2(array0.toJSON(), [1, true, false], '.toJSON() works');
    testConnector.flushAllMessages();
    compare$2(array1.toJSON(), [1, true, false], '.toJSON() works after sync');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testConcurrentInsertWithThreeConflicts = tc => {
    const { users, array0, array1, array2 } = init$1(tc, { users: 3 });
    array0.insert(0, [0]);
    array1.insert(0, [1]);
    array2.insert(0, [2]);
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testConcurrentInsertDeleteWithThreeConflicts = tc => {
    const { testConnector, users, array0, array1, array2 } = init$1(tc, { users: 3 });
    array0.insert(0, ['x', 'y', 'z']);
    testConnector.flushAllMessages();
    array0.insert(1, [0]);
    array1.delete(0);
    array1.delete(1, 1);
    array2.insert(1, [2]);
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertionsInLateSync = tc => {
    const { testConnector, users, array0, array1, array2 } = init$1(tc, { users: 3 });
    array0.insert(0, ['x', 'y']);
    testConnector.flushAllMessages();
    users[1].disconnect();
    users[2].disconnect();
    array0.insert(1, ['user0']);
    array1.insert(1, ['user1']);
    array2.insert(1, ['user2']);
    users[1].connect();
    users[2].connect();
    testConnector.flushAllMessages();
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testDisconnectReallyPreventsSendingMessages = tc => {
    const { testConnector, users, array0, array1 } = init$1(tc, { users: 3 });
    array0.insert(0, ['x', 'y']);
    testConnector.flushAllMessages();
    users[1].disconnect();
    users[2].disconnect();
    array0.insert(1, ['user0']);
    array1.insert(1, ['user1']);
    compare$2(array0.toJSON(), ['x', 'user0', 'y']);
    compare$2(array1.toJSON(), ['x', 'user1', 'y']);
    users[1].connect();
    users[2].connect();
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testDeletionsInLateSync = tc => {
    const { testConnector, users, array0, array1 } = init$1(tc, { users: 2 });
    array0.insert(0, ['x', 'y']);
    testConnector.flushAllMessages();
    users[1].disconnect();
    array1.delete(1, 1);
    array0.delete(0, 2);
    users[1].connect();
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertThenMergeDeleteOnSync = tc => {
    const { testConnector, users, array0, array1 } = init$1(tc, { users: 2 });
    array0.insert(0, ['x', 'y', 'z']);
    testConnector.flushAllMessages();
    users[0].disconnect();
    array1.delete(0, 3);
    users[0].connect();
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertAndDeleteEvents = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    /**
     * @type {Object<string,any>?}
     */
    let event = null;
    array0.observe(e => {
      event = e;
    });
    array0.insert(0, [0, 1, 2]);
    assert(event !== null);
    event = null;
    array0.delete(0);
    assert(event !== null);
    event = null;
    array0.delete(0, 2);
    assert(event !== null);
    event = null;
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testNestedObserverEvents = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    /**
     * @type {Array<number>}
     */
    const vals = [];
    array0.observe(e => {
      if (array0.length === 1) {
        // inserting, will call this observer again
        // we expect that this observer is called after this event handler finishedn
        array0.insert(1, [1]);
        vals.push(0);
      } else {
        // this should be called the second time an element is inserted (above case)
        vals.push(1);
      }
    });
    array0.insert(0, [0]);
    compareArrays(vals, [0, 1]);
    compareArrays(array0.toArray(), [0, 1]);
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertAndDeleteEventsForTypes = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    /**
     * @type {Object<string,any>|null}
     */
    let event = null;
    array0.observe(e => {
      event = e;
    });
    array0.insert(0, [new YArray()]);
    assert(event !== null);
    event = null;
    array0.delete(0);
    assert(event !== null);
    event = null;
    compare$1(users);
  };

  /**
   * This issue has been reported in https://discuss.yjs.dev/t/order-in-which-events-yielded-by-observedeep-should-be-applied/261/2
   *
   * Deep observers generate multiple events. When an array added at item at, say, position 0,
   * and item 1 changed then the array-add event should fire first so that the change event
   * path is correct. A array binding might lead to an inconsistent state otherwise.
   *
   * @param {t.TestCase} tc
   */
  const testObserveDeepEventOrder = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    /**
     * @type {Array<any>}
     */
    let events = [];
    array0.observeDeep(e => {
      events = e;
    });
    array0.insert(0, [new YMap()]);
    users[0].transact(() => {
      array0.get(0).set('a', 'a');
      array0.insert(0, [0]);
    });
    for (let i = 1; i < events.length; i++) {
      assert(events[i - 1].path.length <= events[i].path.length, 'path size increases, fire top-level events first');
    }
  };

  /**
   * @param {t.TestCase} tc
   */
  const testChangeEvent = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    /**
     * @type {any}
     */
    let changes = null;
    array0.observe(e => {
      changes = e.changes;
    });
    const newArr = new YArray();
    array0.insert(0, [newArr, 4, 'dtrn']);
    assert(changes !== null && changes.added.size === 2 && changes.deleted.size === 0);
    compare$2(changes.delta, [{ insert: [newArr, 4, 'dtrn'] }]);
    changes = null;
    array0.delete(0, 2);
    assert(changes !== null && changes.added.size === 0 && changes.deleted.size === 2);
    compare$2(changes.delta, [{ delete: 2 }]);
    changes = null;
    array0.insert(1, [0.1]);
    assert(changes !== null && changes.added.size === 1 && changes.deleted.size === 0);
    compare$2(changes.delta, [{ retain: 1 }, { insert: [0.1] }]);
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertAndDeleteEventsForTypes2 = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    /**
     * @type {Array<Object<string,any>>}
     */
    const events = [];
    array0.observe(e => {
      events.push(e);
    });
    array0.insert(0, ['hi', new YMap()]);
    assert(events.length === 1, 'Event is triggered exactly once for insertion of two elements');
    array0.delete(1);
    assert(events.length === 2, 'Event is triggered exactly once for deletion');
    compare$1(users);
  };

  /**
   * This issue has been reported here https://github.com/yjs/yjs/issues/155
   * @param {t.TestCase} tc
   */
  const testNewChildDoesNotEmitEventInTransaction = tc => {
    const { array0, users } = init$1(tc, { users: 2 });
    let fired = false;
    users[0].transact(() => {
      const newMap = new YMap();
      newMap.observe(() => {
        fired = true;
      });
      array0.insert(0, [newMap]);
      newMap.set('tst', 42);
    });
    assert(!fired, 'Event does not trigger');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGarbageCollector = tc => {
    const { testConnector, users, array0 } = init$1(tc, { users: 3 });
    array0.insert(0, ['x', 'y', 'z']);
    testConnector.flushAllMessages();
    users[0].disconnect();
    array0.delete(0, 3);
    users[0].connect();
    testConnector.flushAllMessages();
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testEventTargetIsSetCorrectlyOnLocal = tc => {
    const { array0, users } = init$1(tc, { users: 3 });
    /**
     * @type {any}
     */
    let event;
    array0.observe(e => {
      event = e;
    });
    array0.insert(0, ['stuff']);
    assert(event.target === array0, '"target" property is set correctly');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testEventTargetIsSetCorrectlyOnRemote = tc => {
    const { testConnector, array0, array1, users } = init$1(tc, { users: 3 });
    /**
     * @type {any}
     */
    let event;
    array0.observe(e => {
      event = e;
    });
    array1.insert(0, ['stuff']);
    testConnector.flushAllMessages();
    assert(event.target === array0, '"target" property is set correctly');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testIteratingArrayContainingTypes = tc => {
    const y = new Doc();
    const arr = y.getArray('arr');
    const numItems = 10;
    for (let i = 0; i < numItems; i++) {
      const map = new YMap();
      map.set('value', i);
      arr.push([map]);
    }
    let cnt = 0;
    for (const item of arr) {
      assert(item.get('value') === cnt++, 'value is correct');
    }
    y.destroy();
  };

  let _uniqueNumber = 0;
  const getUniqueNumber = () => _uniqueNumber++;

  /**
   * @type {Array<function(Doc,prng.PRNG,any):void>}
   */
  const arrayTransactions = [
    function insert (user, gen) {
      const yarray = user.getArray('array');
      const uniqueNumber = getUniqueNumber();
      const content = [];
      const len = int32(gen, 1, 4);
      for (let i = 0; i < len; i++) {
        content.push(uniqueNumber);
      }
      const pos = int32(gen, 0, yarray.length);
      const oldContent = yarray.toArray();
      yarray.insert(pos, content);
      oldContent.splice(pos, 0, ...content);
      compareArrays(yarray.toArray(), oldContent); // we want to make sure that fastSearch markers insert at the correct position
    },
    function insertTypeArray (user, gen) {
      const yarray = user.getArray('array');
      const pos = int32(gen, 0, yarray.length);
      yarray.insert(pos, [new YArray()]);
      const array2 = yarray.get(pos);
      array2.insert(0, [1, 2, 3, 4]);
    },
    function insertTypeMap (user, gen) {
      const yarray = user.getArray('array');
      const pos = int32(gen, 0, yarray.length);
      yarray.insert(pos, [new YMap()]);
      const map = yarray.get(pos);
      map.set('someprop', 42);
      map.set('someprop', 43);
      map.set('someprop', 44);
    },
    function insertTypeNull (user, gen) {
      const yarray = user.getArray('array');
      const pos = int32(gen, 0, yarray.length);
      yarray.insert(pos, [null]);
    },
    function _delete (user, gen) {
      const yarray = user.getArray('array');
      const length = yarray.length;
      if (length > 0) {
        let somePos = int32(gen, 0, length - 1);
        let delLength = int32(gen, 1, min(2, length - somePos));
        if (bool(gen)) {
          const type = yarray.get(somePos);
          if (type instanceof YArray && type.length > 0) {
            somePos = int32(gen, 0, type.length - 1);
            delLength = int32(gen, 0, min(2, type.length - somePos));
            type.delete(somePos, delLength);
          }
        } else {
          const oldContent = yarray.toArray();
          yarray.delete(somePos, delLength);
          oldContent.splice(somePos, delLength);
          compareArrays(yarray.toArray(), oldContent);
        }
      }
    }
  ];

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests6 = tc => {
    applyRandomTests(tc, arrayTransactions, 6);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests40 = tc => {
    applyRandomTests(tc, arrayTransactions, 40);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests42 = tc => {
    applyRandomTests(tc, arrayTransactions, 42);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests43 = tc => {
    applyRandomTests(tc, arrayTransactions, 43);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests44 = tc => {
    applyRandomTests(tc, arrayTransactions, 44);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests45 = tc => {
    applyRandomTests(tc, arrayTransactions, 45);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests46 = tc => {
    applyRandomTests(tc, arrayTransactions, 46);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests300 = tc => {
    applyRandomTests(tc, arrayTransactions, 300);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests400 = tc => {
    applyRandomTests(tc, arrayTransactions, 400);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests500 = tc => {
    applyRandomTests(tc, arrayTransactions, 500);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests600 = tc => {
    applyRandomTests(tc, arrayTransactions, 600);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests1000 = tc => {
    applyRandomTests(tc, arrayTransactions, 1000);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests1800 = tc => {
    applyRandomTests(tc, arrayTransactions, 1800);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests3000 = tc => {
    skip(!production);
    applyRandomTests(tc, arrayTransactions, 3000);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests5000 = tc => {
    skip(!production);
    applyRandomTests(tc, arrayTransactions, 5000);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGeneratingYarrayTests30000 = tc => {
    skip(!production);
    applyRandomTests(tc, arrayTransactions, 30000);
  };

  var array = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testArrayFrom: testArrayFrom,
    testBasicUpdate: testBasicUpdate,
    testChangeEvent: testChangeEvent,
    testConcurrentInsertDeleteWithThreeConflicts: testConcurrentInsertDeleteWithThreeConflicts,
    testConcurrentInsertWithThreeConflicts: testConcurrentInsertWithThreeConflicts,
    testDeleteInsert: testDeleteInsert,
    testDeletionsInLateSync: testDeletionsInLateSync,
    testDisconnectReallyPreventsSendingMessages: testDisconnectReallyPreventsSendingMessages,
    testEventTargetIsSetCorrectlyOnLocal: testEventTargetIsSetCorrectlyOnLocal,
    testEventTargetIsSetCorrectlyOnRemote: testEventTargetIsSetCorrectlyOnRemote,
    testGarbageCollector: testGarbageCollector,
    testInsertAndDeleteEvents: testInsertAndDeleteEvents,
    testInsertAndDeleteEventsForTypes: testInsertAndDeleteEventsForTypes,
    testInsertAndDeleteEventsForTypes2: testInsertAndDeleteEventsForTypes2,
    testInsertThenMergeDeleteOnSync: testInsertThenMergeDeleteOnSync,
    testInsertThreeElementsTryRegetProperty: testInsertThreeElementsTryRegetProperty,
    testInsertionsInLateSync: testInsertionsInLateSync,
    testIteratingArrayContainingTypes: testIteratingArrayContainingTypes,
    testLengthIssue: testLengthIssue,
    testLengthIssue2: testLengthIssue2,
    testNestedObserverEvents: testNestedObserverEvents,
    testNewChildDoesNotEmitEventInTransaction: testNewChildDoesNotEmitEventInTransaction,
    testObserveDeepEventOrder: testObserveDeepEventOrder,
    testRepeatGeneratingYarrayTests1000: testRepeatGeneratingYarrayTests1000,
    testRepeatGeneratingYarrayTests1800: testRepeatGeneratingYarrayTests1800,
    testRepeatGeneratingYarrayTests300: testRepeatGeneratingYarrayTests300,
    testRepeatGeneratingYarrayTests3000: testRepeatGeneratingYarrayTests3000,
    testRepeatGeneratingYarrayTests30000: testRepeatGeneratingYarrayTests30000,
    testRepeatGeneratingYarrayTests40: testRepeatGeneratingYarrayTests40,
    testRepeatGeneratingYarrayTests400: testRepeatGeneratingYarrayTests400,
    testRepeatGeneratingYarrayTests42: testRepeatGeneratingYarrayTests42,
    testRepeatGeneratingYarrayTests43: testRepeatGeneratingYarrayTests43,
    testRepeatGeneratingYarrayTests44: testRepeatGeneratingYarrayTests44,
    testRepeatGeneratingYarrayTests45: testRepeatGeneratingYarrayTests45,
    testRepeatGeneratingYarrayTests46: testRepeatGeneratingYarrayTests46,
    testRepeatGeneratingYarrayTests500: testRepeatGeneratingYarrayTests500,
    testRepeatGeneratingYarrayTests5000: testRepeatGeneratingYarrayTests5000,
    testRepeatGeneratingYarrayTests6: testRepeatGeneratingYarrayTests6,
    testRepeatGeneratingYarrayTests600: testRepeatGeneratingYarrayTests600,
    testSlice: testSlice
  });

  const { init, compare } = Y;

  /**
   * https://github.com/yjs/yjs/issues/474
   * @todo Remove debug: 127.0.0.1:8080/test.html?filter=\[88/
   * @param {t.TestCase} _tc
   */
  const testDeltaBug = _tc => {
    const initialDelta = [{
      attributes: {
        'block-id': 'block-28eea923-9cbb-4b6f-a950-cf7fd82bc087'
      },
      insert: '\n'
    },
    {
      attributes: {
        'table-col': {
          width: '150'
        }
      },
      insert: '\n\n\n'
    },
    {
      attributes: {
        'block-id': 'block-9144be72-e528-4f91-b0b2-82d20408e9ea',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-6kv2ls',
          cell: 'cell-apba4k'
        },
        row: 'row-6kv2ls',
        cell: 'cell-apba4k',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-639adacb-1516-43ed-b272-937c55669a1c',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-6kv2ls',
          cell: 'cell-a8qf0r'
        },
        row: 'row-6kv2ls',
        cell: 'cell-a8qf0r',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-6302ca4a-73a3-4c25-8c1e-b542f048f1c6',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-6kv2ls',
          cell: 'cell-oi9ikb'
        },
        row: 'row-6kv2ls',
        cell: 'cell-oi9ikb',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-ceeddd05-330e-4f86-8017-4a3a060c4627',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-d1sv2g',
          cell: 'cell-dt6ks2'
        },
        row: 'row-d1sv2g',
        cell: 'cell-dt6ks2',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-37b19322-cb57-4e6f-8fad-0d1401cae53f',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-d1sv2g',
          cell: 'cell-qah2ay'
        },
        row: 'row-d1sv2g',
        cell: 'cell-qah2ay',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-468a69b5-9332-450b-9107-381d593de249',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-d1sv2g',
          cell: 'cell-fpcz5a'
        },
        row: 'row-d1sv2g',
        cell: 'cell-fpcz5a',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-26b1d252-9b2e-4808-9b29-04e76696aa3c',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-zrhylp'
        },
        row: 'row-pflz90',
        cell: 'cell-zrhylp',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-6af97ba7-8cf9-497a-9365-7075b938837b',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-s1q9nt'
        },
        row: 'row-pflz90',
        cell: 'cell-s1q9nt',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-107e273e-86bc-44fd-b0d7-41ab55aca484',
        'table-cell-line': {
          rowspan: '1',
          colspan: '1',
          row: 'row-pflz90',
          cell: 'cell-20b0j9'
        },
        row: 'row-pflz90',
        cell: 'cell-20b0j9',
        rowspan: '1',
        colspan: '1'
      },
      insert: '\n'
    },
    {
      attributes: {
        'block-id': 'block-38161f9c-6f6d-44c5-b086-54cc6490f1e3'
      },
      insert: '\n'
    },
    {
      insert: 'Content after table'
    },
    {
      attributes: {
        'block-id': 'block-15630542-ef45-412d-9415-88f0052238ce'
      },
      insert: '\n'
    }
    ];
    const ydoc1 = new Doc();
    const ytext = ydoc1.getText();
    ytext.applyDelta(initialDelta);
    const addingDash = [
      {
        retain: 12
      },
      {
        insert: '-'
      }
    ];
    ytext.applyDelta(addingDash);
    const addingSpace = [
      {
        retain: 13
      },
      {
        insert: ' '
      }
    ];
    ytext.applyDelta(addingSpace);
    const addingList = [
      {
        retain: 12
      },
      {
        delete: 2
      },
      {
        retain: 1,
        attributes: {
          // Clear table line attribute
          'table-cell-line': null,
          // Add list attribute in place of table-cell-line
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-pflz90',
            cell: 'cell-20b0j9',
            list: 'bullet'
          }
        }
      }
    ];
    ytext.applyDelta(addingList);
    const result = ytext.toDelta();
    const expectedResult = [
      {
        attributes: {
          'block-id': 'block-28eea923-9cbb-4b6f-a950-cf7fd82bc087'
        },
        insert: '\n'
      },
      {
        attributes: {
          'table-col': {
            width: '150'
          }
        },
        insert: '\n\n\n'
      },
      {
        attributes: {
          'block-id': 'block-9144be72-e528-4f91-b0b2-82d20408e9ea',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-6kv2ls',
            cell: 'cell-apba4k'
          },
          row: 'row-6kv2ls',
          cell: 'cell-apba4k',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-639adacb-1516-43ed-b272-937c55669a1c',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-6kv2ls',
            cell: 'cell-a8qf0r'
          },
          row: 'row-6kv2ls',
          cell: 'cell-a8qf0r',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-6302ca4a-73a3-4c25-8c1e-b542f048f1c6',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-6kv2ls',
            cell: 'cell-oi9ikb'
          },
          row: 'row-6kv2ls',
          cell: 'cell-oi9ikb',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-ceeddd05-330e-4f86-8017-4a3a060c4627',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-d1sv2g',
            cell: 'cell-dt6ks2'
          },
          row: 'row-d1sv2g',
          cell: 'cell-dt6ks2',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-37b19322-cb57-4e6f-8fad-0d1401cae53f',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-d1sv2g',
            cell: 'cell-qah2ay'
          },
          row: 'row-d1sv2g',
          cell: 'cell-qah2ay',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-468a69b5-9332-450b-9107-381d593de249',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-d1sv2g',
            cell: 'cell-fpcz5a'
          },
          row: 'row-d1sv2g',
          cell: 'cell-fpcz5a',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-26b1d252-9b2e-4808-9b29-04e76696aa3c',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-pflz90',
            cell: 'cell-zrhylp'
          },
          row: 'row-pflz90',
          cell: 'cell-zrhylp',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        attributes: {
          'block-id': 'block-6af97ba7-8cf9-497a-9365-7075b938837b',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-pflz90',
            cell: 'cell-s1q9nt'
          },
          row: 'row-pflz90',
          cell: 'cell-s1q9nt',
          rowspan: '1',
          colspan: '1'
        },
        insert: '\n'
      },
      {
        insert: '\n',
        // This attibutes has only list and no table-cell-line
        attributes: {
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-pflz90',
            cell: 'cell-20b0j9',
            list: 'bullet'
          },
          'block-id': 'block-107e273e-86bc-44fd-b0d7-41ab55aca484',
          row: 'row-pflz90',
          cell: 'cell-20b0j9',
          rowspan: '1',
          colspan: '1'
        }
      },
      // No table-cell-line below here
      {
        attributes: {
          'block-id': 'block-38161f9c-6f6d-44c5-b086-54cc6490f1e3'
        },
        insert: '\n'
      },
      {
        insert: 'Content after table'
      },
      {
        attributes: {
          'block-id': 'block-15630542-ef45-412d-9415-88f0052238ce'
        },
        insert: '\n'
      }
    ];
    compare$2(result, expectedResult);
  };

  /**
   * https://github.com/yjs/yjs/issues/503
   * @param {t.TestCase} _tc
   */
  const testDeltaBug2 = _tc => {
    const initialContent = [
      { insert: "Thomas' section" },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-61ae80ac-a469-4eae-bac9-3b6a2c380118' }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-d265d93f-1cc7-40ee-bb58-8270fca2619f' }
      },
      { insert: '123' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-592a7bee-76a3-4e28-9c25-7a84344f8813',
          list: { list: 'toggled', 'toggle-id': 'list-66xfft' }
        }
      },
      { insert: '456' },
      {
        insert: '\n',
        attributes: {
          indent: 1,
          'block-id': 'block-3ee2bd70-b97f-45b2-9115-f1e8910235b1',
          list: { list: 'toggled', 'toggle-id': 'list-6vh0t0' }
        }
      },
      { insert: '789' },
      {
        insert: '\n',
        attributes: {
          indent: 1,
          'block-id': 'block-78150cf3-9bb5-4dea-a6f5-0ce1d2a98b9c',
          list: { list: 'toggled', 'toggle-id': 'list-7jr0l2' }
        }
      },
      { insert: '901' },
      {
        insert: '\n',
        attributes: {
          indent: 1,
          'block-id': 'block-13c6416f-f522-41d5-9fd4-ce4eb1cde5ba',
          list: { list: 'toggled', 'toggle-id': 'list-7uk8qu' }
        }
      },
      {
        insert: {
          slash_command: {
            id: 'doc_94zq-2436',
            sessionId: 'nkwc70p2j',
            replace: '/'
          }
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-8a1d2bb6-23c2-4bcf-af3c-3919ffea1697' }
      },
      { insert: '\n\n', attributes: { 'table-col': { width: '150' } } },
      {
        insert: '\n',
        attributes: { 'table-col': { width: '150' } }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-84ec3ea4-da6a-4e03-b430-0e5f432936a9',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-blmd4s',
            cell: 'cell-m0u5za'
          },
          row: 'row-blmd4s',
          cell: 'cell-m0u5za',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-83144ca8-aace-401e-8aa5-c05928a8ccf0',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-blmd4s',
            cell: 'cell-1v8s8t'
          },
          row: 'row-blmd4s',
          cell: 'cell-1v8s8t',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-9a493387-d27f-4b58-b2f7-731dfafda32a',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-blmd4s',
            cell: 'cell-126947'
          },
          row: 'row-blmd4s',
          cell: 'cell-126947',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-3484f86e-ae42-440f-8de6-857f0d8011ea',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-hmmljo',
            cell: 'cell-wvutl9'
          },
          row: 'row-hmmljo',
          cell: 'cell-wvutl9',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d4e0b741-9dea-47a5-85e1-4ded0efbc89d',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-hmmljo',
            cell: 'cell-nkablr'
          },
          row: 'row-hmmljo',
          cell: 'cell-nkablr',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-352f0d5a-d1b9-422f-b136-4bacefd00b1a',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-hmmljo',
            cell: 'cell-n8xtd0'
          },
          row: 'row-hmmljo',
          cell: 'cell-n8xtd0',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-95823e57-f29c-44cf-a69d-2b4494b7144b',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-ev4xwq',
            cell: 'cell-ua9bvu'
          },
          row: 'row-ev4xwq',
          cell: 'cell-ua9bvu',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-cde5c027-15d3-4780-9e76-1e1a9d97a8e8',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-ev4xwq',
            cell: 'cell-7bwuvk'
          },
          row: 'row-ev4xwq',
          cell: 'cell-7bwuvk',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-11a23ed4-b04d-4e45-8065-8120889cd4a4',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-ev4xwq',
            cell: 'cell-aouka5'
          },
          row: 'row-ev4xwq',
          cell: 'cell-aouka5',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-15b4483c-da98-4ded-91d3-c3d6ebc82582' }
      },
      { insert: { divider: true } },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-68552c8e-b57b-4f4a-9f36-6cc1ef6b3461' }
      },
      { insert: 'jklasjdf' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-c8b2df7d-8ec5-4dd4-81f1-8d8efc40b1b4',
          list: { list: 'toggled', 'toggle-id': 'list-9ss39s' }
        }
      },
      { insert: 'asdf' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-4f252ceb-14da-49ae-8cbd-69a701d18e2a',
          list: { list: 'toggled', 'toggle-id': 'list-uvo013' }
        }
      },
      { insert: 'adg' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-ccb9b72e-b94d-45a0-aae4-9b0a1961c533',
          list: { list: 'toggled', 'toggle-id': 'list-k53iwe' }
        }
      },
      { insert: 'asdfasdfasdf' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-ccb9b72e-b94d-45a0-aae4-9b0a1961c533',
          list: { list: 'none' },
          indent: 1
        }
      },
      { insert: 'asdf' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-f406f76d-f338-4261-abe7-5c9131f7f1ad',
          list: { list: 'toggled', 'toggle-id': 'list-en86ur' }
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-be18141c-9b6b-434e-8fd0-2c214437d560' }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-36922db3-4af5-48a1-9ea4-0788b3b5d7cf' }
      },
      { insert: { table_content: true } },
      { insert: ' ' },
      {
        insert: {
          slash_command: {
            id: 'doc_94zq-2436',
            sessionId: 'hiyrt6fny',
            replace: '/'
          }
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-9d6566a1-be55-4e20-999a-b990bc15e143' }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-4b545085-114d-4d07-844c-789710ec3aab',
          layout:
          '12d887e1-d1a2-4814-a1a3-0c904e950b46_1185cd29-ef1b-45d5-8fda-51a70b704e64',
          'layout-width': '0.25'
        }
      },
      {
        insert: '\n',
        attributes: {

          'block-id': 'block-4d3f2321-33d1-470e-9b7c-d5a683570148',
          layout:
          '12d887e1-d1a2-4814-a1a3-0c904e950b46_75523ea3-c67f-4f5f-a85f-ac7c8fc0a992',
          'layout-width': '0.5'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-4c7ae1e6-758e-470f-8d7c-ae0325e4ee8a',
          layout:
          '12d887e1-d1a2-4814-a1a3-0c904e950b46_54c740ef-fd7b-48c6-85aa-c14e1bfc9297',
          'layout-width': '0.25'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-2d6ff0f4-ff00-42b7-a8e2-b816463d8fb5' }
      },
      { insert: { divider: true } },
      {
        insert: '\n',
        attributes: { 'table-col': { width: '150' } }
      },
      { insert: '\n', attributes: { 'table-col': { width: '154' } } },
      {
        insert: '\n',
        attributes: { 'table-col': { width: '150' } }
      },

      {
        insert: '\n',
        attributes: {
          'block-id': 'block-38545d56-224b-464c-b779-51fcec24dbbf',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-q0qfck',
            cell: 'cell-hmapv4'
          },
          row: 'row-q0qfck',
          cell: 'cell-hmapv4',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d413a094-5f52-4fd4-a4aa-00774f6fdb44',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-q0qfck',
            cell: 'cell-c0czb2'
          },
          row: 'row-q0qfck',
          cell: 'cell-c0czb2',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-ff855cbc-8871-4e0a-9ba7-de0c1c2aa585',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-q0qfck',
            cell: 'cell-hcpqmm'
          },
          row: 'row-q0qfck',
          cell: 'cell-hcpqmm',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-4841e6ee-fef8-4473-bf04-f5ba62db17f0',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-etopyl',
            cell: 'cell-0io73v'
          },
          row: 'row-etopyl',
          cell: 'cell-0io73v',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-adeec631-d4fe-4f38-9d5e-e67ba068bd24',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-etopyl',
            cell: 'cell-gt2waa'
          },
          row: 'row-etopyl',
          cell: 'cell-gt2waa',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d38a7308-c858-4ce0-b1f3-0f9092384961',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-etopyl',
            cell: 'cell-os9ksy'
          },
          row: 'row-etopyl',
          cell: 'cell-os9ksy',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-a9df6568-1838-40d1-9d16-3c073b6ce169',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-hbx9ri'
          },
          row: 'row-0jwjg3',
          cell: 'cell-hbx9ri',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-e26a0cf2-fe62-44a5-a4ca-8678a56d62f1',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-yg5m2w'
          },
          row: 'row-0jwjg3',
          cell: 'cell-yg5m2w',
          rowspan: '1',
          colspan: '1'
        }
      },
      { insert: 'a' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-bfbc5ac2-7417-44b9-9aa5-8e36e4095627',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      { insert: 'b' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-f011c089-6389-47c0-8396-7477a29aa56f',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      { insert: 'c' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-4497788d-1e02-4fd5-a80a-48b61a6185cb',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      { insert: 'd' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-5d73a2c7-f98b-47c7-a3f5-0d8527962b02',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      { insert: 'e' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-bfda76ee-ffdd-45db-a22e-a6707e11cf68',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      { insert: 'd' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-35242e64-a69d-4cdb-bd85-2a93766bfab4',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      { insert: 'f' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-8baa22c8-491b-4f1b-9502-44179d5ae744',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-0jwjg3',
            cell: 'cell-1azhl2',
            list: 'ordered'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-0jwjg3',
          cell: 'cell-1azhl2'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-7fa64af0-6974-4205-8cee-529f8bd46852' }
      },
      { insert: { divider: true } },
      { insert: "Brandon's Section" },
      {
        insert: '\n',
        attributes: {
          header: 2,
          'block-id': 'block-cf49462c-2370-48ff-969d-576cb32c39a1'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-30ef8361-0dd6-4eee-b4eb-c9012d0e9070' }
      },
      {
        insert: {
          slash_command: {
            id: 'doc_94zq-2436',
            sessionId: 'x9x08o916',
            replace: '/'
          }
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-166ed856-cf8c-486a-9365-f499b21d91b3' }
      },
      { insert: { divider: true } },
      {
        insert: '\n',
        attributes: {
          row: 'row-kssn15',
          rowspan: '1',
          colspan: '1',
          'block-id': 'block-e8079594-4559-4259-98bb-da5280e2a692',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-kssn15',
            cell: 'cell-qxbksf'
          },
          cell: 'cell-qxbksf'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-70132663-14cc-4701-b5c5-eb99e875e2bd',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-kssn15',
            cell: 'cell-lsohbx'
          },
          cell: 'cell-lsohbx',
          row: 'row-kssn15',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-47a3899c-e3c5-4a7a-a8c4-46e0ae73a4fa',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-kssn15',
            cell: 'cell-hner9k'
          },
          cell: 'cell-hner9k',
          row: 'row-kssn15',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-0f9e650a-7841-412e-b4f2-5571b6d352c2',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-juxwc0',
            cell: 'cell-ei4yqp'
          },
          cell: 'cell-ei4yqp',
          row: 'row-juxwc0',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-53a158a9-8c82-4c82-9d4e-f5298257ca43',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-juxwc0',
            cell: 'cell-25pf5x'
          },
          cell: 'cell-25pf5x',
          row: 'row-juxwc0',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-da8ba35e-ce6e-4518-8605-c51d781eb07a',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-juxwc0',
            cell: 'cell-m8reor'
          },
          cell: 'cell-m8reor',
          row: 'row-juxwc0',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-2dce37c7-2978-4127-bed0-9549781babcb',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-ot4wy5',
            cell: 'cell-dinh0i'
          },
          cell: 'cell-dinh0i',
          row: 'row-ot4wy5',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-7b593f8c-4ea3-44b4-8ad9-4a0abffe759b',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-ot4wy5',
            cell: 'cell-d115b2'
          },
          cell: 'cell-d115b2',
          row: 'row-ot4wy5',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-272c28e6-2bde-4477-9d99-ce35b3045895',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-ot4wy5',
            cell: 'cell-fuapvo'
          },
          cell: 'cell-fuapvo',
          row: 'row-ot4wy5',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-fbf23cab-1ce9-4ede-9953-f2f8250004cf' }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-c3fbb8c9-495c-40b0-b0dd-f6e33dd64b1b' }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-3417ad09-92a3-4a43-b5db-6dbcb0f16db4' }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-b9eacdce-4ba3-4e66-8b69-3eace5656057' }
      },
      { insert: 'Dan Gornstein' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d7c6ae0d-a17c-433e-85fd-5efc52b587fb',
          header: 1
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-814521bd-0e14-4fbf-b332-799c6452a624' }
      },
      { insert: 'aaa' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-6aaf4dcf-dc21-45c6-b723-afb25fe0f498',
          list: { list: 'toggled', 'toggle-id': 'list-idl93b' }
        }
      },
      { insert: 'bb' },
      {
        insert: '\n',
        attributes: {
          indent: 1,
          'block-id': 'block-3dd75392-fa50-4bfb-ba6b-3b7d6bd3f1a1',
          list: { list: 'toggled', 'toggle-id': 'list-mrq7j2' }
        }
      },
      { insert: 'ccc' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-2528578b-ecda-4f74-9fd7-8741d72dc8b3',
          indent: 2,
          list: { list: 'toggled', 'toggle-id': 'list-liu7dl' }
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-18bf68c3-9ef3-4874-929c-9b6bb1a00325' }
      },
      {
        insert: '\n',
        attributes: { 'table-col': { width: '150' } }
      },
      { insert: '\n', attributes: { 'table-col': { width: '150' } } },
      {
        insert: '\n',
        attributes: { 'table-col': { width: '150' } }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d44e74b4-b37f-48e0-b319-6327a6295a57',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-cpybie'
          },
          row: 'row-si1nah',
          cell: 'cell-cpybie',
          rowspan: '1',
          colspan: '1'
        }
      },
      { insert: 'aaa' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-3e545ee9-0c9a-42d7-a4d0-833edb8087f3',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-cpybie',
            list: 'toggled',
            'toggle-id': 'list-kjl2ik'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie'
        }
      },
      { insert: 'bb' },
      {
        insert: '\n',
        attributes: {
          indent: 1,
          'block-id': 'block-5f1225ad-370f-46ab-8f1e-18b277b5095f',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-cpybie',
            list: 'toggled',
            'toggle-id': 'list-eei1x5'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie'
        }
      },
      { insert: 'ccc' },
      {
        insert: '\n',
        attributes: {
          indent: 2,
          'block-id': 'block-a77fdc11-ad24-431b-9ca2-09e32db94ac2',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-cpybie',
            list: 'toggled',
            'toggle-id': 'list-30us3c'
          },
          rowspan: '1',
          colspan: '1',
          row: 'row-si1nah',
          cell: 'cell-cpybie'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d44e74b4-b37f-48e0-b319-6327a6295a57',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-cpybie'
          },
          row: 'row-si1nah',
          cell: 'cell-cpybie',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-2c274c8a-757d-4892-8db8-1a7999f7ab51',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-al1z64'
          },
          row: 'row-si1nah',
          cell: 'cell-al1z64',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-85931afe-1879-471c-bb4b-89e7bd517fe9',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-si1nah',
            cell: 'cell-q186pb'
          },
          row: 'row-si1nah',
          cell: 'cell-q186pb',
          rowspan: '1',
          colspan: '1'
        }
      },
      { insert: 'asdfasdfasdf' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-6e0522e8-c1eb-4c07-98df-2b07c533a139',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-7x2d1o',
            cell: 'cell-6eid2t'
          },
          row: 'row-7x2d1o',
          cell: 'cell-6eid2t',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-4b3d0bd0-9175-45e9-955c-e8164f4b5376',
          row: 'row-7x2d1o',
          cell: 'cell-m1alad',
          rowspan: '1',
          colspan: '1',
          list: {
            rowspan: '1',
            colspan: '1',
            row: 'row-7x2d1o',
            cell: 'cell-m1alad',
            list: 'ordered'
          }
        }
      },
      { insert: 'asdfasdfasdf' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-08610089-cb05-4366-bb1e-a0787d5b11bf',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-7x2d1o',
            cell: 'cell-dm1l2p'
          },
          row: 'row-7x2d1o',
          cell: 'cell-dm1l2p',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-c22b5125-8df3-432f-bd55-5ff456e41b4e',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-o0ujua',
            cell: 'cell-82g0ca'
          },
          row: 'row-o0ujua',
          cell: 'cell-82g0ca',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-7c6320e4-acaf-4ab4-8355-c9b00408c9c1',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-o0ujua',
            cell: 'cell-wv6ozp'
          },
          row: 'row-o0ujua',
          cell: 'cell-wv6ozp',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-d1bb7bed-e69e-4807-8d20-2d28fef8d08f',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-o0ujua',
            cell: 'cell-ldt53x'
          },
          row: 'row-o0ujua',
          cell: 'cell-ldt53x',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-28f28cb8-51a2-4156-acf9-2380e1349745' }
      },
      { insert: { divider: true } },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-a1193252-c0c8-47fe-b9f6-32c8b01a1619' }
      },
      { insert: '\n', attributes: { 'table-col': { width: '150' } } },
      {
        insert: '\n\n',
        attributes: { 'table-col': { width: '150' } }
      },
      { insert: '/This is a test.' },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-14188df0-a63f-4317-9a6d-91b96a7ac9fe',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-5ixdvv',
            cell: 'cell-9tgyed'
          },
          row: 'row-5ixdvv',
          cell: 'cell-9tgyed',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-7e5ba2af-9903-457d-adf4-2a79be81d823',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-5ixdvv',
            cell: 'cell-xc56e9'
          },
          row: 'row-5ixdvv',
          cell: 'cell-xc56e9',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-eb6cad93-caf7-4848-8adf-415255139268',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-5ixdvv',
            cell: 'cell-xrze3u'
          },
          row: 'row-5ixdvv',
          cell: 'cell-xrze3u',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-5bb547a2-6f71-4624-80c7-d0e1318c81a2',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-xbzv98',
            cell: 'cell-lie0ng'
          },
          row: 'row-xbzv98',
          cell: 'cell-lie0ng',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-b506de0d-efb6-4bd7-ba8e-2186cc57903e',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-xbzv98',
            cell: 'cell-s9sow1'
          },
          row: 'row-xbzv98',
          cell: 'cell-s9sow1',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-42d2ad20-5521-40e3-a88d-fe6906176e61',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-xbzv98',
            cell: 'cell-nodtcj'
          },
          row: 'row-xbzv98',
          cell: 'cell-nodtcj',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-7d3e4216-3f68-4dd6-bc77-4a9fad4ba008',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-5bqfil',
            cell: 'cell-c8c0f3'
          },
          row: 'row-5bqfil',
          cell: 'cell-c8c0f3',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-6671f221-551e-47fb-9b7d-9043b6b12cdc',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-5bqfil',
            cell: 'cell-jvxxif'
          },
          row: 'row-5bqfil',
          cell: 'cell-jvxxif',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: {
          'block-id': 'block-51e3161b-0437-4fe3-ac4f-129a93a93fc3',
          'table-cell-line': {
            rowspan: '1',
            colspan: '1',
            row: 'row-5bqfil',
            cell: 'cell-rmjpze'
          },
          row: 'row-5bqfil',
          cell: 'cell-rmjpze',
          rowspan: '1',
          colspan: '1'
        }
      },
      {
        insert: '\n',
        attributes: { 'block-id': 'block-21099df0-afb2-4cd3-834d-bb37800eb06a' }
      }
    ];
    const ydoc = new Doc();
    const ytext = ydoc.getText('id');
    ytext.applyDelta(initialContent);
    const changeEvent = [
      { retain: 90 },
      { delete: 4 },
      {
        retain: 1,
        attributes: {
          layout: null,
          'layout-width': null,
          'block-id': 'block-9d6566a1-be55-4e20-999a-b990bc15e143'
        }
      }
    ];
    ytext.applyDelta(changeEvent);
    const delta = ytext.toDelta();
    compare$2(delta[41], {
      insert: '\n',
      attributes: {
        'block-id': 'block-9d6566a1-be55-4e20-999a-b990bc15e143'
      }
    });
  };

  /**
   * In this test we are mainly interested in the cleanup behavior and whether the resulting delta makes sense.
   * It is fine if the resulting delta is not minimal. But applying the delta to a rich-text editor should result in a
   * synced document.
   *
   * @param {t.TestCase} tc
   */
  const testDeltaAfterConcurrentFormatting = tc => {
    const { text0, text1, testConnector } = init(tc, { users: 2 });
    text0.insert(0, 'abcde');
    testConnector.flushAllMessages();
    text0.format(0, 3, { bold: true });
    text1.format(2, 2, { bold: true });
    /**
     * @type {any}
     */
    const deltas = [];
    text1.observe(event => {
      if (event.delta.length > 0) {
        deltas.push(event.delta);
      }
    });
    testConnector.flushAllMessages();
    compare$2(deltas, [[{ retain: 3, attributes: { bold: true } }, { retain: 2, attributes: { bold: null } }]]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testBasicInsertAndDelete = tc => {
    const { users, text0 } = init(tc, { users: 2 });
    let delta;

    text0.observe(event => {
      delta = event.delta;
    });

    text0.delete(0, 0);
    assert(true, 'Does not throw when deleting zero elements with position 0');

    text0.insert(0, 'abc');
    assert(text0.toString() === 'abc', 'Basic insert works');
    compare$2(delta, [{ insert: 'abc' }]);

    text0.delete(0, 1);
    assert(text0.toString() === 'bc', 'Basic delete works (position 0)');
    compare$2(delta, [{ delete: 1 }]);

    text0.delete(1, 1);
    assert(text0.toString() === 'b', 'Basic delete works (position 1)');
    compare$2(delta, [{ retain: 1 }, { delete: 1 }]);

    users[0].transact(() => {
      text0.insert(0, '1');
      text0.delete(0, 1);
    });
    compare$2(delta, []);

    compare(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testBasicFormat = tc => {
    const { users, text0 } = init(tc, { users: 2 });
    let delta;
    text0.observe(event => {
      delta = event.delta;
    });
    text0.insert(0, 'abc', { bold: true });
    assert(text0.toString() === 'abc', 'Basic insert with attributes works');
    compare$2(text0.toDelta(), [{ insert: 'abc', attributes: { bold: true } }]);
    compare$2(delta, [{ insert: 'abc', attributes: { bold: true } }]);
    text0.delete(0, 1);
    assert(text0.toString() === 'bc', 'Basic delete on formatted works (position 0)');
    compare$2(text0.toDelta(), [{ insert: 'bc', attributes: { bold: true } }]);
    compare$2(delta, [{ delete: 1 }]);
    text0.delete(1, 1);
    assert(text0.toString() === 'b', 'Basic delete works (position 1)');
    compare$2(text0.toDelta(), [{ insert: 'b', attributes: { bold: true } }]);
    compare$2(delta, [{ retain: 1 }, { delete: 1 }]);
    text0.insert(0, 'z', { bold: true });
    assert(text0.toString() === 'zb');
    compare$2(text0.toDelta(), [{ insert: 'zb', attributes: { bold: true } }]);
    compare$2(delta, [{ insert: 'z', attributes: { bold: true } }]);
    // @ts-ignore
    assert(text0._start.right.right.right.content.str === 'b', 'Does not insert duplicate attribute marker');
    text0.insert(0, 'y');
    assert(text0.toString() === 'yzb');
    compare$2(text0.toDelta(), [{ insert: 'y' }, { insert: 'zb', attributes: { bold: true } }]);
    compare$2(delta, [{ insert: 'y' }]);
    text0.format(0, 2, { bold: null });
    assert(text0.toString() === 'yzb');
    compare$2(text0.toDelta(), [{ insert: 'yz' }, { insert: 'b', attributes: { bold: true } }]);
    compare$2(delta, [{ retain: 1 }, { retain: 1, attributes: { bold: null } }]);
    compare(users);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testMultilineFormat = _tc => {
    const ydoc = new Doc();
    const testText = ydoc.getText('test');
    testText.insert(0, 'Test\nMulti-line\nFormatting');
    testText.applyDelta([
      { retain: 4, attributes: { bold: true } },
      { retain: 1 }, // newline character
      { retain: 10, attributes: { bold: true } },
      { retain: 1 }, // newline character
      { retain: 10, attributes: { bold: true } }
    ]);
    compare$2(testText.toDelta(), [
      { insert: 'Test', attributes: { bold: true } },
      { insert: '\n' },
      { insert: 'Multi-line', attributes: { bold: true } },
      { insert: '\n' },
      { insert: 'Formatting', attributes: { bold: true } }
    ]);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testNotMergeEmptyLinesFormat = _tc => {
    const ydoc = new Doc();
    const testText = ydoc.getText('test');
    testText.applyDelta([
      { insert: 'Text' },
      { insert: '\n', attributes: { title: true } },
      { insert: '\nText' },
      { insert: '\n', attributes: { title: true } }
    ]);
    compare$2(testText.toDelta(), [
      { insert: 'Text' },
      { insert: '\n', attributes: { title: true } },
      { insert: '\nText' },
      { insert: '\n', attributes: { title: true } }
    ]);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testPreserveAttributesThroughDelete = _tc => {
    const ydoc = new Doc();
    const testText = ydoc.getText('test');
    testText.applyDelta([
      { insert: 'Text' },
      { insert: '\n', attributes: { title: true } },
      { insert: '\n' }
    ]);
    testText.applyDelta([
      { retain: 4 },
      { delete: 1 },
      { retain: 1, attributes: { title: true } }
    ]);
    compare$2(testText.toDelta(), [
      { insert: 'Text' },
      { insert: '\n', attributes: { title: true } }
    ]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testGetDeltaWithEmbeds = tc => {
    const { text0 } = init(tc, { users: 1 });
    text0.applyDelta([{
      insert: { linebreak: 's' }
    }]);
    compare$2(text0.toDelta(), [{
      insert: { linebreak: 's' }
    }]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testTypesAsEmbed = tc => {
    const { text0, text1, testConnector } = init(tc, { users: 2 });
    text0.applyDelta([{
      insert: new YMap([['key', 'val']])
    }]);
    compare$2(text0.toDelta()[0].insert.toJSON(), { key: 'val' });
    let firedEvent = false;
    text1.observe(event => {
      const d = event.delta;
      assert(d.length === 1);
      compare$2(d.map(x => /** @type {Y.AbstractType<any>} */ (x.insert).toJSON()), [{ key: 'val' }]);
      firedEvent = true;
    });
    testConnector.flushAllMessages();
    const delta = text1.toDelta();
    assert(delta.length === 1);
    compare$2(delta[0].insert.toJSON(), { key: 'val' });
    assert(firedEvent, 'fired the event observer containing a Type-Embed');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSnapshot = tc => {
    const { text0 } = init(tc, { users: 1 });
    const doc0 = /** @type {Y.Doc} */ (text0.doc);
    doc0.gc = false;
    text0.applyDelta([{
      insert: 'abcd'
    }]);
    const snapshot1 = snapshot$1(doc0);
    text0.applyDelta([{
      retain: 1
    }, {
      insert: 'x'
    }, {
      delete: 1
    }]);
    const snapshot2 = snapshot$1(doc0);
    text0.applyDelta([{
      retain: 2
    }, {
      delete: 3
    }, {
      insert: 'x'
    }, {
      delete: 1
    }]);
    const state1 = text0.toDelta(snapshot1);
    compare$2(state1, [{ insert: 'abcd' }]);
    const state2 = text0.toDelta(snapshot2);
    compare$2(state2, [{ insert: 'axcd' }]);
    const state2Diff = text0.toDelta(snapshot2, snapshot1);
    // @ts-ignore Remove userid info
    state2Diff.forEach(v => {
      if (v.attributes && v.attributes.ychange) {
        delete v.attributes.ychange.user;
      }
    });
    compare$2(state2Diff, [{ insert: 'a' }, { insert: 'x', attributes: { ychange: { type: 'added' } } }, { insert: 'b', attributes: { ychange: { type: 'removed' } } }, { insert: 'cd' }]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSnapshotDeleteAfter = tc => {
    const { text0 } = init(tc, { users: 1 });
    const doc0 = /** @type {Y.Doc} */ (text0.doc);
    doc0.gc = false;
    text0.applyDelta([{
      insert: 'abcd'
    }]);
    const snapshot1 = snapshot$1(doc0);
    text0.applyDelta([{
      retain: 4
    }, {
      insert: 'e'
    }]);
    const state1 = text0.toDelta(snapshot1);
    compare$2(state1, [{ insert: 'abcd' }]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testToJson = tc => {
    const { text0 } = init(tc, { users: 1 });
    text0.insert(0, 'abc', { bold: true });
    assert(text0.toJSON() === 'abc', 'toJSON returns the unformatted text');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testToDeltaEmbedAttributes = tc => {
    const { text0 } = init(tc, { users: 1 });
    text0.insert(0, 'ab', { bold: true });
    text0.insertEmbed(1, { image: 'imageSrc.png' }, { width: 100 });
    const delta0 = text0.toDelta();
    compare$2(delta0, [{ insert: 'a', attributes: { bold: true } }, { insert: { image: 'imageSrc.png' }, attributes: { width: 100 } }, { insert: 'b', attributes: { bold: true } }]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testToDeltaEmbedNoAttributes = tc => {
    const { text0 } = init(tc, { users: 1 });
    text0.insert(0, 'ab', { bold: true });
    text0.insertEmbed(1, { image: 'imageSrc.png' });
    const delta0 = text0.toDelta();
    compare$2(delta0, [{ insert: 'a', attributes: { bold: true } }, { insert: { image: 'imageSrc.png' } }, { insert: 'b', attributes: { bold: true } }], 'toDelta does not set attributes key when no attributes are present');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testFormattingRemoved = tc => {
    const { text0 } = init(tc, { users: 1 });
    text0.insert(0, 'ab', { bold: true });
    text0.delete(0, 2);
    assert(getTypeChildren(text0).length === 1);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testFormattingRemovedInMidText = tc => {
    const { text0 } = init(tc, { users: 1 });
    text0.insert(0, '1234');
    text0.insert(2, 'ab', { bold: true });
    text0.delete(2, 2);
    assert(getTypeChildren(text0).length === 3);
  };

  /**
   * Reported in https://github.com/yjs/yjs/issues/344
   *
   * @param {t.TestCase} tc
   */
  const testFormattingDeltaUnnecessaryAttributeChange = tc => {
    const { text0, text1, testConnector } = init(tc, { users: 2 });
    text0.insert(0, '\n', {
      PARAGRAPH_STYLES: 'normal',
      LIST_STYLES: 'bullet'
    });
    text0.insert(1, 'abc', {
      PARAGRAPH_STYLES: 'normal'
    });
    testConnector.flushAllMessages();
    /**
     * @type {Array<any>}
     */
    const deltas = [];
    text0.observe(event => {
      deltas.push(event.delta);
    });
    text1.observe(event => {
      deltas.push(event.delta);
    });
    text1.format(0, 1, { LIST_STYLES: 'number' });
    testConnector.flushAllMessages();
    const filteredDeltas = deltas.filter(d => d.length > 0);
    assert(filteredDeltas.length === 2);
    compare$2(filteredDeltas[0], [
      { retain: 1, attributes: { LIST_STYLES: 'number' } }
    ]);
    compare$2(filteredDeltas[0], filteredDeltas[1]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testInsertAndDeleteAtRandomPositions = tc => {
    const N = 100000;
    const { text0 } = init(tc, { users: 1 });
    const gen = tc.prng;

    // create initial content
    // let expectedResult = init
    text0.insert(0, word(gen, N / 2, N / 2));

    // apply changes
    for (let i = 0; i < N; i++) {
      const pos = uint32(gen, 0, text0.length);
      if (bool(gen)) {
        const len = uint32(gen, 1, 5);
        const word$1 = word(gen, 0, len);
        text0.insert(pos, word$1);
        // expectedResult = expectedResult.slice(0, pos) + word + expectedResult.slice(pos)
      } else {
        const len = uint32(gen, 0, min(3, text0.length - pos));
        text0.delete(pos, len);
        // expectedResult = expectedResult.slice(0, pos) + expectedResult.slice(pos + len)
      }
    }
    // t.compareStrings(text0.toString(), expectedResult)
    describe('final length', '' + text0.length);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testAppendChars = tc => {
    const N = 10000;
    const { text0 } = init(tc, { users: 1 });

    // apply changes
    for (let i = 0; i < N; i++) {
      text0.insert(text0.length, 'a');
    }
    assert(text0.length === N);
  };

  const largeDocumentSize = 100000;

  const id = createID(0, 0);
  const c = new ContentString('a');

  /**
   * @param {t.TestCase} _tc
   */
  const testBestCase = _tc => {
    const N = largeDocumentSize;
    const items = new Array(N);
    measureTime('time to create two million items in the best case', () => {
      const parent = /** @type {any} */ ({});
      let prevItem = null;
      for (let i = 0; i < N; i++) {
        /**
         * @type {Y.Item}
         */
        const n = new Item(createID(0, 0), null, null, null, null, null, null, c);
        // items.push(n)
        items[i] = n;
        n.right = prevItem;
        n.rightOrigin = prevItem ? id : null;
        n.content = c;
        n.parent = parent;
        prevItem = n;
      }
    });
    const newArray = new Array(N);
    measureTime('time to copy two million items to new Array', () => {
      for (let i = 0; i < N; i++) {
        newArray[i] = items[i];
      }
    });
  };

  const tryGc = () => {
    // @ts-ignore
    if (typeof global !== 'undefined' && global.gc) {
      // @ts-ignore
      global.gc();
    }
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testLargeFragmentedDocument = _tc => {
    const itemsToInsert = largeDocumentSize;
    let update = /** @type {any} */ (null)
    ;(() => {
      const doc1 = new Doc();
      const text0 = doc1.getText('txt');
      tryGc();
      measureTime(`time to insert ${itemsToInsert} items`, () => {
        doc1.transact(() => {
          for (let i = 0; i < itemsToInsert; i++) {
            text0.insert(0, '0');
          }
        });
      });
      tryGc();
      measureTime('time to encode document', () => {
        update = encodeStateAsUpdateV2(doc1);
      });
      describe('Document size:', update.byteLength);
    })()
    ;(() => {
      const doc2 = new Doc();
      tryGc();
      measureTime(`time to apply ${itemsToInsert} updates`, () => {
        applyUpdateV2(doc2, update);
      });
    })();
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testIncrementalUpdatesPerformanceOnLargeFragmentedDocument = _tc => {
    const itemsToInsert = largeDocumentSize;
    const updates = /** @type {Array<Uint8Array>} */ ([])
    ;(() => {
      const doc1 = new Doc();
      doc1.on('update', update => {
        updates.push(update);
      });
      const text0 = doc1.getText('txt');
      tryGc();
      measureTime(`time to insert ${itemsToInsert} items`, () => {
        doc1.transact(() => {
          for (let i = 0; i < itemsToInsert; i++) {
            text0.insert(0, '0');
          }
        });
      });
      tryGc();
    })()
    ;(() => {
      measureTime(`time to merge ${itemsToInsert} updates (differential updates)`, () => {
        mergeUpdates(updates);
      });
      tryGc();
      measureTime(`time to merge ${itemsToInsert} updates (ydoc updates)`, () => {
        const ydoc = new Doc();
        updates.forEach(update => {
          applyUpdate(ydoc, update);
        });
      });
    })();
  };

  /**
   * Splitting surrogates can lead to invalid encoded documents.
   *
   * https://github.com/yjs/yjs/issues/248
   *
   * @param {t.TestCase} tc
   */
  const testSplitSurrogateCharacter = tc => {
    {
      const { users, text0 } = init(tc, { users: 2 });
      users[1].disconnect(); // disconnecting forces the user to encode the split surrogate
      text0.insert(0, '👾'); // insert surrogate character
      // split surrogate, which should not lead to an encoding error
      text0.insert(1, 'hi!');
      compare(users);
    }
    {
      const { users, text0 } = init(tc, { users: 2 });
      users[1].disconnect(); // disconnecting forces the user to encode the split surrogate
      text0.insert(0, '👾👾'); // insert surrogate character
      // partially delete surrogate
      text0.delete(1, 2);
      compare(users);
    }
    {
      const { users, text0 } = init(tc, { users: 2 });
      users[1].disconnect(); // disconnecting forces the user to encode the split surrogate
      text0.insert(0, '👾👾'); // insert surrogate character
      // formatting will also split surrogates
      text0.format(1, 2, { bold: true });
      compare(users);
    }
  };

  /**
   * Search marker bug https://github.com/yjs/yjs/issues/307
   *
   * @param {t.TestCase} tc
   */
  const testSearchMarkerBug1 = tc => {
    const { users, text0, text1, testConnector } = init(tc, { users: 2 });

    users[0].on('update', update => {
      users[0].transact(() => {
        applyUpdate(users[0], update);
      });
    });
    users[0].on('update', update => {
      users[1].transact(() => {
        applyUpdate(users[1], update);
      });
    });

    text0.insert(0, 'a_a');
    testConnector.flushAllMessages();
    text0.insert(2, 's');
    testConnector.flushAllMessages();
    text1.insert(3, 'd');
    testConnector.flushAllMessages();
    text0.delete(0, 5);
    testConnector.flushAllMessages();
    text0.insert(0, 'a_a');
    testConnector.flushAllMessages();
    text0.insert(2, 's');
    testConnector.flushAllMessages();
    text1.insert(3, 'd');
    testConnector.flushAllMessages();
    compareStrings(text0.toString(), text1.toString());
    compareStrings(text0.toString(), 'a_sda');
    compare(users);
  };

  /**
   * Reported in https://github.com/yjs/yjs/pull/32
   *
   * @param {t.TestCase} _tc
   */
  const testFormattingBug$1 = async _tc => {
    const ydoc1 = new Doc();
    const ydoc2 = new Doc();
    const text1 = ydoc1.getText();
    text1.insert(0, '\n\n\n');
    text1.format(0, 3, { url: 'http://example.com' });
    ydoc1.getText().format(1, 1, { url: 'http://docs.yjs.dev' });
    ydoc2.getText().format(1, 1, { url: 'http://docs.yjs.dev' });
    applyUpdate(ydoc2, encodeStateAsUpdate(ydoc1));
    const text2 = ydoc2.getText();
    const expectedResult = [
      { insert: '\n', attributes: { url: 'http://example.com' } },
      { insert: '\n', attributes: { url: 'http://docs.yjs.dev' } },
      { insert: '\n', attributes: { url: 'http://example.com' } }
    ];
    compare$2(text1.toDelta(), expectedResult);
    compare$2(text1.toDelta(), text2.toDelta());
    console.log(text1.toDelta());
  };

  /**
   * Delete formatting should not leave redundant formatting items.
   *
   * @param {t.TestCase} _tc
   */
  const testDeleteFormatting = _tc => {
    const doc = new Doc();
    const text = doc.getText();
    text.insert(0, 'Attack ships on fire off the shoulder of Orion.');

    const doc2 = new Doc();
    const text2 = doc2.getText();
    applyUpdate(doc2, encodeStateAsUpdate(doc));

    text.format(13, 7, { bold: true });
    applyUpdate(doc2, encodeStateAsUpdate(doc));

    text.format(16, 4, { bold: null });
    applyUpdate(doc2, encodeStateAsUpdate(doc));

    const expected = [
      { insert: 'Attack ships ' },
      { insert: 'on ', attributes: { bold: true } },
      { insert: 'fire off the shoulder of Orion.' }
    ];
    compare$2(text.toDelta(), expected);
    compare$2(text2.toDelta(), expected);
  };

  // RANDOM TESTS

  let charCounter = 0;

  /**
   * Random tests for pure text operations without formatting.
   *
   * @type Array<function(any,prng.PRNG):void>
   */
  const textChanges = [
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // insert text
      const ytext = y.getText('text');
      const insertPos = int32(gen, 0, ytext.length);
      const text = charCounter++ + word(gen);
      const prevText = ytext.toString();
      ytext.insert(insertPos, text);
      compareStrings(ytext.toString(), prevText.slice(0, insertPos) + text + prevText.slice(insertPos));
    },
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // delete text
      const ytext = y.getText('text');
      const contentLen = ytext.toString().length;
      const insertPos = int32(gen, 0, contentLen);
      const overwrite = min(int32(gen, 0, contentLen - insertPos), 2);
      const prevText = ytext.toString();
      ytext.delete(insertPos, overwrite);
      compareStrings(ytext.toString(), prevText.slice(0, insertPos) + prevText.slice(insertPos + overwrite));
    }
  ];

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges5 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 5));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges30 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 30));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges40 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 40));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges50 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 50));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges70 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 70));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges90 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 90));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateTextChanges300 = tc => {
    const { users } = checkResult(applyRandomTests(tc, textChanges, 300));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  const marks = [
    { bold: true },
    { italic: true },
    { italic: true, color: '#888' }
  ];

  const marksChoices = [
    undefined,
    ...marks
  ];

  /**
   * Random tests for all features of y-text (formatting, embeds, ..).
   *
   * @type Array<function(any,prng.PRNG):void>
   */
  const qChanges = [
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // insert text
      const ytext = y.getText('text');
      const insertPos = int32(gen, 0, ytext.length);
      const attrs = oneOf(gen, marksChoices);
      const text = charCounter++ + word(gen);
      ytext.insert(insertPos, text, attrs);
    },
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // insert embed
      const ytext = y.getText('text');
      const insertPos = int32(gen, 0, ytext.length);
      if (bool(gen)) {
        ytext.insertEmbed(insertPos, { image: 'https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png' });
      } else {
        ytext.insertEmbed(insertPos, new YMap([[word(gen), word(gen)]]));
      }
    },
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // delete text
      const ytext = y.getText('text');
      const contentLen = ytext.toString().length;
      const insertPos = int32(gen, 0, contentLen);
      const overwrite = min(int32(gen, 0, contentLen - insertPos), 2);
      ytext.delete(insertPos, overwrite);
    },
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // format text
      const ytext = y.getText('text');
      const contentLen = ytext.toString().length;
      const insertPos = int32(gen, 0, contentLen);
      const overwrite = min(int32(gen, 0, contentLen - insertPos), 2);
      const format = oneOf(gen, marks);
      ytext.format(insertPos, overwrite, format);
    },
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // insert codeblock
      const ytext = y.getText('text');
      const insertPos = int32(gen, 0, ytext.toString().length);
      const text = charCounter++ + word(gen);
      const ops = [];
      if (insertPos > 0) {
        ops.push({ retain: insertPos });
      }
      ops.push({ insert: text }, { insert: '\n', format: { 'code-block': true } });
      ytext.applyDelta(ops);
    },
    /**
     * @param {Y.Doc} y
     * @param {prng.PRNG} gen
     */
    (y, gen) => { // complex delta op
      const ytext = y.getText('text');
      const contentLen = ytext.toString().length;
      let currentPos = max(0, int32(gen, 0, contentLen - 1));
      /**
       * @type {Array<any>}
       */
      const ops = currentPos > 0 ? [{ retain: currentPos }] : [];
      // create max 3 ops
      for (let i = 0; i < 7 && currentPos < contentLen; i++) {
        oneOf(gen, [
          () => { // format
            const retain = min(int32(gen, 0, contentLen - currentPos), 5);
            const format = oneOf(gen, marks);
            ops.push({ retain, attributes: format });
            currentPos += retain;
          },
          () => { // insert
            const attrs = oneOf(gen, marksChoices);
            const text = word(gen, 1, 3);
            ops.push({ insert: text, attributes: attrs });
          },
          () => { // delete
            const delLen = min(int32(gen, 0, contentLen - currentPos), 10);
            ops.push({ delete: delLen });
            currentPos += delLen;
          }
        ])();
      }
      ytext.applyDelta(ops);
    }
  ];

  /**
   * @param {any} result
   */
  const checkResult = result => {
    for (let i = 1; i < result.testObjects.length; i++) {
      /**
       * @param {any} d
       */
      const typeToObject = d => d.insert instanceof AbstractType ? d.insert.toJSON() : d;
      const p1 = result.users[i].getText('text').toDelta().map(typeToObject);
      const p2 = result.users[i].getText('text').toDelta().map(typeToObject);
      compare$2(p1, p2);
    }
    // Uncomment this to find formatting-cleanup issues
    // const cleanups = Y.cleanupYTextFormatting(result.users[0].getText('text'))
    // t.assert(cleanups === 0)
    return result
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges1 = tc => {
    const { users } = checkResult(applyRandomTests(tc, qChanges, 1));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges2 = tc => {
    const { users } = checkResult(applyRandomTests(tc, qChanges, 2));
    const cleanups = cleanupYTextFormatting(users[0].getText('text'));
    assert(cleanups === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges2Repeat = tc => {
    for (let i = 0; i < 1000; i++) {
      const { users } = checkResult(applyRandomTests(tc, qChanges, 2));
      const cleanups = cleanupYTextFormatting(users[0].getText('text'));
      assert(cleanups === 0);
    }
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges3 = tc => {
    checkResult(applyRandomTests(tc, qChanges, 3));
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges30 = tc => {
    checkResult(applyRandomTests(tc, qChanges, 30));
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges40 = tc => {
    checkResult(applyRandomTests(tc, qChanges, 40));
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges70 = tc => {
    checkResult(applyRandomTests(tc, qChanges, 70));
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges100 = tc => {
    checkResult(applyRandomTests(tc, qChanges, 100));
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRepeatGenerateQuillChanges300 = tc => {
    checkResult(applyRandomTests(tc, qChanges, 300));
  };

  var text = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testAppendChars: testAppendChars,
    testBasicFormat: testBasicFormat,
    testBasicInsertAndDelete: testBasicInsertAndDelete,
    testBestCase: testBestCase,
    testDeleteFormatting: testDeleteFormatting,
    testDeltaAfterConcurrentFormatting: testDeltaAfterConcurrentFormatting,
    testDeltaBug: testDeltaBug,
    testDeltaBug2: testDeltaBug2,
    testFormattingBug: testFormattingBug$1,
    testFormattingDeltaUnnecessaryAttributeChange: testFormattingDeltaUnnecessaryAttributeChange,
    testFormattingRemoved: testFormattingRemoved,
    testFormattingRemovedInMidText: testFormattingRemovedInMidText,
    testGetDeltaWithEmbeds: testGetDeltaWithEmbeds,
    testIncrementalUpdatesPerformanceOnLargeFragmentedDocument: testIncrementalUpdatesPerformanceOnLargeFragmentedDocument,
    testInsertAndDeleteAtRandomPositions: testInsertAndDeleteAtRandomPositions,
    testLargeFragmentedDocument: testLargeFragmentedDocument,
    testMultilineFormat: testMultilineFormat,
    testNotMergeEmptyLinesFormat: testNotMergeEmptyLinesFormat,
    testPreserveAttributesThroughDelete: testPreserveAttributesThroughDelete,
    testRepeatGenerateQuillChanges1: testRepeatGenerateQuillChanges1,
    testRepeatGenerateQuillChanges100: testRepeatGenerateQuillChanges100,
    testRepeatGenerateQuillChanges2: testRepeatGenerateQuillChanges2,
    testRepeatGenerateQuillChanges2Repeat: testRepeatGenerateQuillChanges2Repeat,
    testRepeatGenerateQuillChanges3: testRepeatGenerateQuillChanges3,
    testRepeatGenerateQuillChanges30: testRepeatGenerateQuillChanges30,
    testRepeatGenerateQuillChanges300: testRepeatGenerateQuillChanges300,
    testRepeatGenerateQuillChanges40: testRepeatGenerateQuillChanges40,
    testRepeatGenerateQuillChanges70: testRepeatGenerateQuillChanges70,
    testRepeatGenerateTextChanges30: testRepeatGenerateTextChanges30,
    testRepeatGenerateTextChanges300: testRepeatGenerateTextChanges300,
    testRepeatGenerateTextChanges40: testRepeatGenerateTextChanges40,
    testRepeatGenerateTextChanges5: testRepeatGenerateTextChanges5,
    testRepeatGenerateTextChanges50: testRepeatGenerateTextChanges50,
    testRepeatGenerateTextChanges70: testRepeatGenerateTextChanges70,
    testRepeatGenerateTextChanges90: testRepeatGenerateTextChanges90,
    testSearchMarkerBug1: testSearchMarkerBug1,
    testSnapshot: testSnapshot,
    testSnapshotDeleteAfter: testSnapshotDeleteAfter,
    testSplitSurrogateCharacter: testSplitSurrogateCharacter,
    testToDeltaEmbedAttributes: testToDeltaEmbedAttributes,
    testToDeltaEmbedNoAttributes: testToDeltaEmbedNoAttributes,
    testToJson: testToJson,
    testTypesAsEmbed: testTypesAsEmbed
  });

  const testCustomTypings = () => {
    const ydoc = new Doc();
    const ymap = ydoc.getMap();
    /**
     * @type {Y.XmlElement<{ num: number, str: string, [k:string]: object|number|string }>}
     */
    const yxml = ymap.set('yxml', new YXmlElement('test'));
    /**
     * @type {number|undefined}
     */
    const num = yxml.getAttribute('num');
    /**
     * @type {string|undefined}
     */
    const str = yxml.getAttribute('str');
    /**
     * @type {object|number|string|undefined}
     */
    const dtrn = yxml.getAttribute('dtrn');
    const attrs = yxml.getAttributes();
    /**
     * @type {object|number|string|undefined}
     */
    const any = attrs.shouldBeAny;
    console.log({ num, str, dtrn, attrs, any });
  };

  /**
   * @param {t.TestCase} tc
   */
  const testSetProperty = tc => {
    const { testConnector, users, xml0, xml1 } = init$1(tc, { users: 2 });
    xml0.setAttribute('height', '10');
    assert(xml0.getAttribute('height') === '10', 'Simple set+get works');
    testConnector.flushAllMessages();
    assert(xml1.getAttribute('height') === '10', 'Simple set+get works (remote)');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testHasProperty = tc => {
    const { testConnector, users, xml0, xml1 } = init$1(tc, { users: 2 });
    xml0.setAttribute('height', '10');
    assert(xml0.hasAttribute('height'), 'Simple set+has works');
    testConnector.flushAllMessages();
    assert(xml1.hasAttribute('height'), 'Simple set+has works (remote)');

    xml0.removeAttribute('height');
    assert(!xml0.hasAttribute('height'), 'Simple set+remove+has works');
    testConnector.flushAllMessages();
    assert(!xml1.hasAttribute('height'), 'Simple set+remove+has works (remote)');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testEvents = tc => {
    const { testConnector, users, xml0, xml1 } = init$1(tc, { users: 2 });
    /**
     * @type {any}
     */
    let event;
    /**
     * @type {any}
     */
    let remoteEvent;
    xml0.observe(e => {
      event = e;
    });
    xml1.observe(e => {
      remoteEvent = e;
    });
    xml0.setAttribute('key', 'value');
    assert(event.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on updated key');
    testConnector.flushAllMessages();
    assert(remoteEvent.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on updated key (remote)');
    // check attributeRemoved
    xml0.removeAttribute('key');
    assert(event.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on removed attribute');
    testConnector.flushAllMessages();
    assert(remoteEvent.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on removed attribute (remote)');
    xml0.insert(0, [new YXmlText('some text')]);
    assert(event.childListChanged, 'YXmlEvent.childListChanged on inserted element');
    testConnector.flushAllMessages();
    assert(remoteEvent.childListChanged, 'YXmlEvent.childListChanged on inserted element (remote)');
    // test childRemoved
    xml0.delete(0);
    assert(event.childListChanged, 'YXmlEvent.childListChanged on deleted element');
    testConnector.flushAllMessages();
    assert(remoteEvent.childListChanged, 'YXmlEvent.childListChanged on deleted element (remote)');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testTreewalker = tc => {
    const { users, xml0 } = init$1(tc, { users: 3 });
    const paragraph1 = new YXmlElement('p');
    const paragraph2 = new YXmlElement('p');
    const text1 = new YXmlText('init');
    const text2 = new YXmlText('text');
    paragraph1.insert(0, [text1, text2]);
    xml0.insert(0, [paragraph1, paragraph2, new YXmlElement('img')]);
    const allParagraphs = xml0.querySelectorAll('p');
    assert(allParagraphs.length === 2, 'found exactly two paragraphs');
    assert(allParagraphs[0] === paragraph1, 'querySelectorAll found paragraph1');
    assert(allParagraphs[1] === paragraph2, 'querySelectorAll found paragraph2');
    assert(xml0.querySelector('p') === paragraph1, 'querySelector found paragraph1');
    compare$1(users);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testYtextAttributes = _tc => {
    const ydoc = new Doc();
    const ytext = /** @type {Y.XmlText} */ (ydoc.get('', YXmlText));
    ytext.observe(event => {
      compare$2(event.changes.keys.get('test'), { action: 'add', oldValue: undefined });
    });
    ytext.setAttribute('test', 42);
    compare$2(ytext.getAttribute('test'), 42);
    compare$2(ytext.getAttributes(), { test: 42 });
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testSiblings = _tc => {
    const ydoc = new Doc();
    const yxml = ydoc.getXmlFragment();
    const first = new YXmlText();
    const second = new YXmlElement('p');
    yxml.insert(0, [first, second]);
    assert(first.nextSibling === second);
    assert(second.prevSibling === first);
    assert(first.parent === yxml);
    assert(yxml.parent === null);
    assert(yxml.firstChild === first);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testInsertafter = _tc => {
    const ydoc = new Doc();
    const yxml = ydoc.getXmlFragment();
    const first = new YXmlText();
    const second = new YXmlElement('p');
    const third = new YXmlElement('p');

    const deepsecond1 = new YXmlElement('span');
    const deepsecond2 = new YXmlText();
    second.insertAfter(null, [deepsecond1]);
    second.insertAfter(deepsecond1, [deepsecond2]);

    yxml.insertAfter(null, [first, second]);
    yxml.insertAfter(second, [third]);

    assert(yxml.length === 3);
    assert(second.get(0) === deepsecond1);
    assert(second.get(1) === deepsecond2);

    compareArrays(yxml.toArray(), [first, second, third]);

    fails(() => {
      const el = new YXmlElement('p');
      el.insertAfter(deepsecond1, [new YXmlText()]);
    });
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testClone = _tc => {
    const ydoc = new Doc();
    const yxml = ydoc.getXmlFragment();
    const first = new YXmlText('text');
    const second = new YXmlElement('p');
    const third = new YXmlElement('p');
    yxml.push([first, second, third]);
    compareArrays(yxml.toArray(), [first, second, third]);

    const cloneYxml = yxml.clone();
    ydoc.getArray('copyarr').insert(0, [cloneYxml]);
    assert(cloneYxml.length === 3);
    compare$2(cloneYxml.toJSON(), yxml.toJSON());
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testFormattingBug = _tc => {
    const ydoc = new Doc();
    const yxml = /** @type {Y.XmlText} */ (ydoc.get('', YXmlText));
    const delta = [
      { insert: 'A', attributes: { em: {}, strong: {} } },
      { insert: 'B', attributes: { em: {} } },
      { insert: 'C', attributes: { em: {}, strong: {} } }
    ];
    yxml.applyDelta(delta);
    compare$2(yxml.toDelta(), delta);
  };

  var xml = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testClone: testClone,
    testCustomTypings: testCustomTypings,
    testEvents: testEvents,
    testFormattingBug: testFormattingBug,
    testHasProperty: testHasProperty,
    testInsertafter: testInsertafter,
    testSetProperty: testSetProperty,
    testSiblings: testSiblings,
    testTreewalker: testTreewalker,
    testYtextAttributes: testYtextAttributes
  });

  /**
   * @param {t.TestCase} tc
   */
  const testStructReferences = tc => {
    assert(contentRefs.length === 11);
    assert(contentRefs[1] === readContentDeleted);
    assert(contentRefs[2] === readContentJSON); // TODO: deprecate content json?
    assert(contentRefs[3] === readContentBinary);
    assert(contentRefs[4] === readContentString);
    assert(contentRefs[5] === readContentEmbed);
    assert(contentRefs[6] === readContentFormat);
    assert(contentRefs[7] === readContentType);
    assert(contentRefs[8] === readContentAny);
    assert(contentRefs[9] === readContentDoc);
    // contentRefs[10] is reserved for Skip structs
  };

  /**
   * There is some custom encoding/decoding happening in PermanentUserData.
   * This is why it landed here.
   *
   * @param {t.TestCase} tc
   */
  const testPermanentUserData = async tc => {
    const ydoc1 = new Doc();
    const ydoc2 = new Doc();
    const pd1 = new PermanentUserData(ydoc1);
    const pd2 = new PermanentUserData(ydoc2);
    pd1.setUserMapping(ydoc1, ydoc1.clientID, 'user a');
    pd2.setUserMapping(ydoc2, ydoc2.clientID, 'user b');
    ydoc1.getText().insert(0, 'xhi');
    ydoc1.getText().delete(0, 1);
    ydoc2.getText().insert(0, 'hxxi');
    ydoc2.getText().delete(1, 2);
    await wait(10);
    applyUpdate(ydoc2, encodeStateAsUpdate(ydoc1));
    applyUpdate(ydoc1, encodeStateAsUpdate(ydoc2));

    // now sync a third doc with same name as doc1 and then create PermanentUserData
    const ydoc3 = new Doc();
    applyUpdate(ydoc3, encodeStateAsUpdate(ydoc1));
    const pd3 = new PermanentUserData(ydoc3);
    pd3.setUserMapping(ydoc3, ydoc3.clientID, 'user a');
  };

  /**
   * Reported here: https://github.com/yjs/yjs/issues/308
   * @param {t.TestCase} tc
   */
  const testDiffStateVectorOfUpdateIsEmpty = tc => {
    const ydoc = new Doc();
    /**
     * @type {any}
     */
    let sv = null;
    ydoc.getText().insert(0, 'a');
    ydoc.on('update', update => {
      sv = encodeStateVectorFromUpdate(update);
    });
    // should produce an update with an empty state vector (because previous ops are missing)
    ydoc.getText().insert(0, 'a');
    assert(sv !== null && sv.byteLength === 1 && sv[0] === 0);
  };

  /**
   * Reported here: https://github.com/yjs/yjs/issues/308
   * @param {t.TestCase} tc
   */
  const testDiffStateVectorOfUpdateIgnoresSkips = tc => {
    const ydoc = new Doc();
    /**
     * @type {Array<Uint8Array>}
     */
    const updates = [];
    ydoc.on('update', update => {
      updates.push(update);
    });
    ydoc.getText().insert(0, 'a');
    ydoc.getText().insert(0, 'b');
    ydoc.getText().insert(0, 'c');
    const update13 = mergeUpdates([updates[0], updates[2]]);
    const sv = encodeStateVectorFromUpdate(update13);
    const state = decodeStateVector(sv);
    assert(state.get(ydoc.clientID) === 1);
    assert(state.size === 1);
  };

  var encoding = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testDiffStateVectorOfUpdateIgnoresSkips: testDiffStateVectorOfUpdateIgnoresSkips,
    testDiffStateVectorOfUpdateIsEmpty: testDiffStateVectorOfUpdateIsEmpty,
    testPermanentUserData: testPermanentUserData,
    testStructReferences: testStructReferences
  });

  /**
   * @param {t.TestCase} tc
   */
  const testInfiniteCaptureTimeout = tc => {
    const { array0 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(array0, { captureTimeout: Number.MAX_VALUE });
    array0.push([1, 2, 3]);
    undoManager.stopCapturing();
    array0.push([4, 5, 6]);
    undoManager.undo();
    compare$2(array0.toArray(), [1, 2, 3]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoText = tc => {
    const { testConnector, text0, text1 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(text0);

    // items that are added & deleted in the same transaction won't be undo
    text0.insert(0, 'test');
    text0.delete(0, 4);
    undoManager.undo();
    assert(text0.toString() === '');

    // follow redone items
    text0.insert(0, 'a');
    undoManager.stopCapturing();
    text0.delete(0, 1);
    undoManager.stopCapturing();
    undoManager.undo();
    assert(text0.toString() === 'a');
    undoManager.undo();
    assert(text0.toString() === '');

    text0.insert(0, 'abc');
    text1.insert(0, 'xyz');
    testConnector.syncAll();
    undoManager.undo();
    assert(text0.toString() === 'xyz');
    undoManager.redo();
    assert(text0.toString() === 'abcxyz');
    testConnector.syncAll();
    text1.delete(0, 1);
    testConnector.syncAll();
    undoManager.undo();
    assert(text0.toString() === 'xyz');
    undoManager.redo();
    assert(text0.toString() === 'bcxyz');
    // test marks
    text0.format(1, 3, { bold: true });
    compare$2(text0.toDelta(), [{ insert: 'b' }, { insert: 'cxy', attributes: { bold: true } }, { insert: 'z' }]);
    undoManager.undo();
    compare$2(text0.toDelta(), [{ insert: 'bcxyz' }]);
    undoManager.redo();
    compare$2(text0.toDelta(), [{ insert: 'b' }, { insert: 'cxy', attributes: { bold: true } }, { insert: 'z' }]);
  };

  /**
   * Test case to fix #241
   * @param {t.TestCase} _tc
   */
  const testEmptyTypeScope = _tc => {
    const ydoc = new Doc();
    const um = new UndoManager([], { doc: ydoc });
    const yarray = ydoc.getArray();
    um.addToScope(yarray);
    yarray.insert(0, [1]);
    um.undo();
    assert(yarray.length === 0);
  };

  /**
   * Test case to fix #241
   * @param {t.TestCase} _tc
   */
  const testDoubleUndo = _tc => {
    const doc = new Doc();
    const text = doc.getText();
    text.insert(0, '1221');

    const manager = new UndoManager(text);

    text.insert(2, '3');
    text.insert(3, '3');

    manager.undo();
    manager.undo();

    text.insert(2, '3');

    compareStrings(text.toString(), '12321');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoMap = tc => {
    const { testConnector, map0, map1 } = init$1(tc, { users: 2 });
    map0.set('a', 0);
    const undoManager = new UndoManager(map0);
    map0.set('a', 1);
    undoManager.undo();
    assert(map0.get('a') === 0);
    undoManager.redo();
    assert(map0.get('a') === 1);
    // testing sub-types and if it can restore a whole type
    const subType = new YMap();
    map0.set('a', subType);
    subType.set('x', 42);
    compare$2(map0.toJSON(), /** @type {any} */ ({ a: { x: 42 } }));
    undoManager.undo();
    assert(map0.get('a') === 1);
    undoManager.redo();
    compare$2(map0.toJSON(), /** @type {any} */ ({ a: { x: 42 } }));
    testConnector.syncAll();
    // if content is overwritten by another user, undo operations should be skipped
    map1.set('a', 44);
    testConnector.syncAll();
    undoManager.undo();
    assert(map0.get('a') === 44);
    undoManager.redo();
    assert(map0.get('a') === 44);

    // test setting value multiple times
    map0.set('b', 'initial');
    undoManager.stopCapturing();
    map0.set('b', 'val1');
    map0.set('b', 'val2');
    undoManager.stopCapturing();
    undoManager.undo();
    assert(map0.get('b') === 'initial');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoArray = tc => {
    const { testConnector, array0, array1 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(array0);
    array0.insert(0, [1, 2, 3]);
    array1.insert(0, [4, 5, 6]);
    testConnector.syncAll();
    compare$2(array0.toArray(), [1, 2, 3, 4, 5, 6]);
    undoManager.undo();
    compare$2(array0.toArray(), [4, 5, 6]);
    undoManager.redo();
    compare$2(array0.toArray(), [1, 2, 3, 4, 5, 6]);
    testConnector.syncAll();
    array1.delete(0, 1); // user1 deletes [1]
    testConnector.syncAll();
    undoManager.undo();
    compare$2(array0.toArray(), [4, 5, 6]);
    undoManager.redo();
    compare$2(array0.toArray(), [2, 3, 4, 5, 6]);
    array0.delete(0, 5);
    // test nested structure
    const ymap = new YMap();
    array0.insert(0, [ymap]);
    compare$2(array0.toJSON(), [{}]);
    undoManager.stopCapturing();
    ymap.set('a', 1);
    compare$2(array0.toJSON(), [{ a: 1 }]);
    undoManager.undo();
    compare$2(array0.toJSON(), [{}]);
    undoManager.undo();
    compare$2(array0.toJSON(), [2, 3, 4, 5, 6]);
    undoManager.redo();
    compare$2(array0.toJSON(), [{}]);
    undoManager.redo();
    compare$2(array0.toJSON(), [{ a: 1 }]);
    testConnector.syncAll();
    array1.get(0).set('b', 2);
    testConnector.syncAll();
    compare$2(array0.toJSON(), [{ a: 1, b: 2 }]);
    undoManager.undo();
    compare$2(array0.toJSON(), [{ b: 2 }]);
    undoManager.undo();
    compare$2(array0.toJSON(), [2, 3, 4, 5, 6]);
    undoManager.redo();
    compare$2(array0.toJSON(), [{ b: 2 }]);
    undoManager.redo();
    compare$2(array0.toJSON(), [{ a: 1, b: 2 }]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoXml = tc => {
    const { xml0 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(xml0);
    const child = new YXmlElement('p');
    xml0.insert(0, [child]);
    const textchild = new YXmlText('content');
    child.insert(0, [textchild]);
    assert(xml0.toString() === '<undefined><p>content</p></undefined>');
    // format textchild and revert that change
    undoManager.stopCapturing();
    textchild.format(3, 4, { bold: {} });
    assert(xml0.toString() === '<undefined><p>con<bold>tent</bold></p></undefined>');
    undoManager.undo();
    assert(xml0.toString() === '<undefined><p>content</p></undefined>');
    undoManager.redo();
    assert(xml0.toString() === '<undefined><p>con<bold>tent</bold></p></undefined>');
    xml0.delete(0, 1);
    assert(xml0.toString() === '<undefined></undefined>');
    undoManager.undo();
    assert(xml0.toString() === '<undefined><p>con<bold>tent</bold></p></undefined>');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoEvents = tc => {
    const { text0 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(text0);
    let counter = 0;
    let receivedMetadata = -1;
    undoManager.on('stack-item-added', /** @param {any} event */ event => {
      assert(event.type != null);
      assert(event.changedParentTypes != null && event.changedParentTypes.has(text0));
      event.stackItem.meta.set('test', counter++);
    });
    undoManager.on('stack-item-popped', /** @param {any} event */ event => {
      assert(event.type != null);
      assert(event.changedParentTypes != null && event.changedParentTypes.has(text0));
      receivedMetadata = event.stackItem.meta.get('test');
    });
    text0.insert(0, 'abc');
    undoManager.undo();
    assert(receivedMetadata === 0);
    undoManager.redo();
    assert(receivedMetadata === 1);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testTrackClass = tc => {
    const { users, text0 } = init$1(tc, { users: 3 });
    // only track origins that are numbers
    const undoManager = new UndoManager(text0, { trackedOrigins: new Set([Number]) });
    users[0].transact(() => {
      text0.insert(0, 'abc');
    }, 42);
    assert(text0.toString() === 'abc');
    undoManager.undo();
    assert(text0.toString() === '');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testTypeScope = tc => {
    const { array0 } = init$1(tc, { users: 3 });
    // only track origins that are numbers
    const text0 = new YText();
    const text1 = new YText();
    array0.insert(0, [text0, text1]);
    const undoManager = new UndoManager(text0);
    const undoManagerBoth = new UndoManager([text0, text1]);
    text1.insert(0, 'abc');
    assert(undoManager.undoStack.length === 0);
    assert(undoManagerBoth.undoStack.length === 1);
    assert(text1.toString() === 'abc');
    undoManager.undo();
    assert(text1.toString() === 'abc');
    undoManagerBoth.undo();
    assert(text1.toString() === '');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoInEmbed = tc => {
    const { text0 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(text0);
    const nestedText = new YText('initial text');
    undoManager.stopCapturing();
    text0.insertEmbed(0, nestedText, { bold: true });
    assert(nestedText.toString() === 'initial text');
    undoManager.stopCapturing();
    nestedText.delete(0, nestedText.length);
    nestedText.insert(0, 'other text');
    assert(nestedText.toString() === 'other text');
    undoManager.undo();
    assert(nestedText.toString() === 'initial text');
    undoManager.undo();
    assert(text0.length === 0);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testUndoDeleteFilter = tc => {
    /**
     * @type {Y.Array<any>}
     */
    const array0 = /** @type {any} */ (init$1(tc, { users: 3 }).array0);
    const undoManager = new UndoManager(array0, { deleteFilter: item => !(item instanceof Item) || (item.content instanceof ContentType && item.content.type._map.size === 0) });
    const map0 = new YMap();
    map0.set('hi', 1);
    const map1 = new YMap();
    array0.insert(0, [map0, map1]);
    undoManager.undo();
    assert(array0.length === 1);
    array0.get(0);
    assert(Array.from(array0.get(0).keys()).length === 1);
  };

  /**
   * This issue has been reported in https://discuss.yjs.dev/t/undomanager-with-external-updates/454/6
   * @param {t.TestCase} _tc
   */
  const testUndoUntilChangePerformed = _tc => {
    const doc = new Doc();
    const doc2 = new Doc();
    doc.on('update', update => applyUpdate(doc2, update));
    doc2.on('update', update => applyUpdate(doc, update));

    const yArray = doc.getArray('array');
    const yArray2 = doc2.getArray('array');
    const yMap = new YMap();
    yMap.set('hello', 'world');
    yArray.push([yMap]);
    const yMap2 = new YMap();
    yMap2.set('key', 'value');
    yArray.push([yMap2]);

    const undoManager = new UndoManager([yArray], { trackedOrigins: new Set([doc.clientID]) });
    const undoManager2 = new UndoManager([doc2.get('array')], { trackedOrigins: new Set([doc2.clientID]) });

    transact(doc, () => yMap2.set('key', 'value modified'), doc.clientID);
    undoManager.stopCapturing();
    transact(doc, () => yMap.set('hello', 'world modified'), doc.clientID);
    transact(doc2, () => yArray2.delete(0), doc2.clientID);
    undoManager2.undo();
    undoManager.undo();
    compareStrings(yMap2.get('key'), 'value');
  };

  /**
   * This issue has been reported in https://github.com/yjs/yjs/issues/317
   * @param {t.TestCase} _tc
   */
  const testUndoNestedUndoIssue = _tc => {
    const doc = new Doc({ gc: false });
    const design = doc.getMap();
    const undoManager = new UndoManager(design, { captureTimeout: 0 });

    /**
     * @type {Y.Map<any>}
     */
    const text = new YMap();

    const blocks1 = new YArray();
    const blocks1block = new YMap();

    doc.transact(() => {
      blocks1block.set('text', 'Type Something');
      blocks1.push([blocks1block]);
      text.set('blocks', blocks1block);
      design.set('text', text);
    });

    const blocks2 = new YArray();
    const blocks2block = new YMap();
    doc.transact(() => {
      blocks2block.set('text', 'Something');
      blocks2.push([blocks2block]);
      text.set('blocks', blocks2block);
    });

    const blocks3 = new YArray();
    const blocks3block = new YMap();
    doc.transact(() => {
      blocks3block.set('text', 'Something Else');
      blocks3.push([blocks3block]);
      text.set('blocks', blocks3block);
    });

    compare$2(design.toJSON(), { text: { blocks: { text: 'Something Else' } } });
    undoManager.undo();
    compare$2(design.toJSON(), { text: { blocks: { text: 'Something' } } });
    undoManager.undo();
    compare$2(design.toJSON(), { text: { blocks: { text: 'Type Something' } } });
    undoManager.undo();
    compare$2(design.toJSON(), { });
    undoManager.redo();
    compare$2(design.toJSON(), { text: { blocks: { text: 'Type Something' } } });
    undoManager.redo();
    compare$2(design.toJSON(), { text: { blocks: { text: 'Something' } } });
    undoManager.redo();
    compare$2(design.toJSON(), { text: { blocks: { text: 'Something Else' } } });
  };

  /**
   * This issue has been reported in https://github.com/yjs/yjs/issues/355
   *
   * @param {t.TestCase} _tc
   */
  const testConsecutiveRedoBug = _tc => {
    const doc = new Doc();
    const yRoot = doc.getMap();
    const undoMgr = new UndoManager(yRoot);

    let yPoint = new YMap();
    yPoint.set('x', 0);
    yPoint.set('y', 0);
    yRoot.set('a', yPoint);
    undoMgr.stopCapturing();

    yPoint.set('x', 100);
    yPoint.set('y', 100);
    undoMgr.stopCapturing();

    yPoint.set('x', 200);
    yPoint.set('y', 200);
    undoMgr.stopCapturing();

    yPoint.set('x', 300);
    yPoint.set('y', 300);
    undoMgr.stopCapturing();

    compare$2(yPoint.toJSON(), { x: 300, y: 300 });

    undoMgr.undo(); // x=200, y=200
    compare$2(yPoint.toJSON(), { x: 200, y: 200 });
    undoMgr.undo(); // x=100, y=100
    compare$2(yPoint.toJSON(), { x: 100, y: 100 });
    undoMgr.undo(); // x=0, y=0
    compare$2(yPoint.toJSON(), { x: 0, y: 0 });
    undoMgr.undo(); // nil
    compare$2(yRoot.get('a'), undefined);

    undoMgr.redo(); // x=0, y=0
    yPoint = yRoot.get('a');

    compare$2(yPoint.toJSON(), { x: 0, y: 0 });
    undoMgr.redo(); // x=100, y=100
    compare$2(yPoint.toJSON(), { x: 100, y: 100 });
    undoMgr.redo(); // x=200, y=200
    compare$2(yPoint.toJSON(), { x: 200, y: 200 });
    undoMgr.redo(); // expected x=300, y=300, actually nil
    compare$2(yPoint.toJSON(), { x: 300, y: 300 });
  };

  /**
   * This issue has been reported in https://github.com/yjs/yjs/issues/304
   *
   * @param {t.TestCase} _tc
   */
  const testUndoXmlBug = _tc => {
    const origin = 'origin';
    const doc = new Doc();
    const fragment = doc.getXmlFragment('t');
    const undoManager = new UndoManager(fragment, {
      captureTimeout: 0,
      trackedOrigins: new Set([origin])
    });

    // create element
    doc.transact(() => {
      const e = new YXmlElement('test-node');
      e.setAttribute('a', '100');
      e.setAttribute('b', '0');
      fragment.insert(fragment.length, [e]);
    }, origin);

    // change one attribute
    doc.transact(() => {
      const e = fragment.get(0);
      e.setAttribute('a', '200');
    }, origin);

    // change both attributes
    doc.transact(() => {
      const e = fragment.get(0);
      e.setAttribute('a', '180');
      e.setAttribute('b', '50');
    }, origin);

    undoManager.undo();
    undoManager.undo();
    undoManager.undo();

    undoManager.redo();
    undoManager.redo();
    undoManager.redo();
    compare$2(fragment.toString(), '<test-node a="180" b="50"></test-node>');
  };

  /**
   * This issue has been reported in https://github.com/yjs/yjs/issues/343
   *
   * @param {t.TestCase} _tc
   */
  const testUndoBlockBug = _tc => {
    const doc = new Doc({ gc: false });
    const design = doc.getMap();

    const undoManager = new UndoManager(design, { captureTimeout: 0 });

    const text = new YMap();

    const blocks1 = new YArray();
    const blocks1block = new YMap();
    doc.transact(() => {
      blocks1block.set('text', '1');
      blocks1.push([blocks1block]);

      text.set('blocks', blocks1block);
      design.set('text', text);
    });

    const blocks2 = new YArray();
    const blocks2block = new YMap();
    doc.transact(() => {
      blocks2block.set('text', '2');
      blocks2.push([blocks2block]);
      text.set('blocks', blocks2block);
    });

    const blocks3 = new YArray();
    const blocks3block = new YMap();
    doc.transact(() => {
      blocks3block.set('text', '3');
      blocks3.push([blocks3block]);
      text.set('blocks', blocks3block);
    });

    const blocks4 = new YArray();
    const blocks4block = new YMap();
    doc.transact(() => {
      blocks4block.set('text', '4');
      blocks4.push([blocks4block]);
      text.set('blocks', blocks4block);
    });

    // {"text":{"blocks":{"text":"4"}}}
    undoManager.undo(); // {"text":{"blocks":{"3"}}}
    undoManager.undo(); // {"text":{"blocks":{"text":"2"}}}
    undoManager.undo(); // {"text":{"blocks":{"text":"1"}}}
    undoManager.undo(); // {}
    undoManager.redo(); // {"text":{"blocks":{"text":"1"}}}
    undoManager.redo(); // {"text":{"blocks":{"text":"2"}}}
    undoManager.redo(); // {"text":{"blocks":{"text":"3"}}}
    undoManager.redo(); // {"text":{}}
    compare$2(design.toJSON(), { text: { blocks: { text: '4' } } });
  };

  /**
   * Undo text formatting delete should not corrupt peer state.
   *
   * @see https://github.com/yjs/yjs/issues/392
   * @param {t.TestCase} _tc
   */
  const testUndoDeleteTextFormat = _tc => {
    const doc = new Doc();
    const text = doc.getText();
    text.insert(0, 'Attack ships on fire off the shoulder of Orion.');
    const doc2 = new Doc();
    const text2 = doc2.getText();
    applyUpdate(doc2, encodeStateAsUpdate(doc));
    const undoManager = new UndoManager(text);

    text.format(13, 7, { bold: true });
    undoManager.stopCapturing();
    applyUpdate(doc2, encodeStateAsUpdate(doc));

    text.format(16, 4, { bold: null });
    undoManager.stopCapturing();
    applyUpdate(doc2, encodeStateAsUpdate(doc));

    undoManager.undo();
    applyUpdate(doc2, encodeStateAsUpdate(doc));

    const expect = [
      { insert: 'Attack ships ' },
      {
        insert: 'on fire',
        attributes: { bold: true }
      },
      { insert: ' off the shoulder of Orion.' }
    ];
    compare$2(text.toDelta(), expect);
    compare$2(text2.toDelta(), expect);
  };

  /**
   * Undo text formatting delete should not corrupt peer state.
   *
   * @see https://github.com/yjs/yjs/issues/392
   * @param {t.TestCase} _tc
   */
  const testBehaviorOfIgnoreremotemapchangesProperty = _tc => {
    const doc = new Doc();
    const doc2 = new Doc();
    doc.on('update', update => applyUpdate(doc2, update, doc));
    doc2.on('update', update => applyUpdate(doc, update, doc2));
    const map1 = doc.getMap();
    const map2 = doc2.getMap();
    const um1 = new UndoManager(map1, { ignoreRemoteMapChanges: true });
    map1.set('x', 1);
    map2.set('x', 2);
    map1.set('x', 3);
    map2.set('x', 4);
    um1.undo();
    assert(map1.get('x') === 2);
    assert(map2.get('x') === 2);
  };

  /**
   * Special deletion case.
   *
   * @see https://github.com/yjs/yjs/issues/447
   * @param {t.TestCase} _tc
   */
  const testSpecialDeletionCase = _tc => {
    const origin = 'undoable';
    const doc = new Doc();
    const fragment = doc.getXmlFragment();
    const undoManager = new UndoManager(fragment, { trackedOrigins: new Set([origin]) });
    doc.transact(() => {
      const e = new YXmlElement('test');
      e.setAttribute('a', '1');
      e.setAttribute('b', '2');
      fragment.insert(0, [e]);
    });
    compareStrings(fragment.toString(), '<test a="1" b="2"></test>');
    doc.transact(() => {
      // change attribute "b" and delete test-node
      const e = fragment.get(0);
      e.setAttribute('b', '3');
      fragment.delete(0);
    }, origin);
    compareStrings(fragment.toString(), '');
    undoManager.undo();
    compareStrings(fragment.toString(), '<test a="1" b="2"></test>');
  };

  /**
   * Deleted entries in a map should be restored on undo.
   *
   * @see https://github.com/yjs/yjs/issues/500
   * @param {t.TestCase} tc
   */
  const testUndoDeleteInMap = (tc) => {
    const { map0 } = init$1(tc, { users: 3 });
    const undoManager = new UndoManager(map0, { captureTimeout: 0 });
    map0.set('a', 'a');
    map0.delete('a');
    map0.set('a', 'b');
    map0.delete('a');
    map0.set('a', 'c');
    map0.delete('a');
    map0.set('a', 'd');
    compare$2(map0.toJSON(), { a: 'd' });
    undoManager.undo();
    compare$2(map0.toJSON(), {});
    undoManager.undo();
    compare$2(map0.toJSON(), { a: 'c' });
    undoManager.undo();
    compare$2(map0.toJSON(), {});
    undoManager.undo();
    compare$2(map0.toJSON(), { a: 'b' });
    undoManager.undo();
    compare$2(map0.toJSON(), {});
    undoManager.undo();
    compare$2(map0.toJSON(), { a: 'a' });
  };

  var undoredo = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testBehaviorOfIgnoreremotemapchangesProperty: testBehaviorOfIgnoreremotemapchangesProperty,
    testConsecutiveRedoBug: testConsecutiveRedoBug,
    testDoubleUndo: testDoubleUndo,
    testEmptyTypeScope: testEmptyTypeScope,
    testInfiniteCaptureTimeout: testInfiniteCaptureTimeout,
    testSpecialDeletionCase: testSpecialDeletionCase,
    testTrackClass: testTrackClass,
    testTypeScope: testTypeScope,
    testUndoArray: testUndoArray,
    testUndoBlockBug: testUndoBlockBug,
    testUndoDeleteFilter: testUndoDeleteFilter,
    testUndoDeleteInMap: testUndoDeleteInMap,
    testUndoDeleteTextFormat: testUndoDeleteTextFormat,
    testUndoEvents: testUndoEvents,
    testUndoInEmbed: testUndoInEmbed,
    testUndoMap: testUndoMap,
    testUndoNestedUndoIssue: testUndoNestedUndoIssue,
    testUndoText: testUndoText,
    testUndoUntilChangePerformed: testUndoUntilChangePerformed,
    testUndoXml: testUndoXml,
    testUndoXmlBug: testUndoXmlBug
  });

  /**
   * @param {t.TestCase} tc
   */
  const testArrayCompatibilityV1 = tc => {
    const oldDoc = 'BV8EAAcBBWFycmF5AAgABAADfQF9An0DgQQDAYEEAAEABMEDAAQAAccEAAQFASEABAsIc29tZXByb3ACqAQNAX0syAQLBAUBfYoHwQQPBAUBwQQQBAUByAQRBAUBfYoHyAQQBBEBfY0HyAQTBBEBfY0HyAQUBBEBfY0HyAQVBBEBfY0HyAQQBBMBfY4HyAQXBBMBfY4HwQQYBBMBxwQXBBgACAAEGgR9AX0CfQN9BMEBAAEBAQADxwQLBA8BIQAEIwhzb21lcHJvcAKoBCUBfSzHBBkEEwEhAAQnCHNvbWVwcm9wAqgEKQF9LMcCAAMAASEABCsIc29tZXByb3ACqAQtAX0syAEBAQIBfZMHyAQvAQIBfZMHwQEGAQcBAAPBBDEBBwEABMcBGQEVAAgABDoEfQF9An0DfQTHAAgADgAIAAQ/BH0BfQJ9A30ExwQYBBkACAAERAR9AX0CfQN9BMcEIwQPASEABEkIc29tZXByb3ACqARLAX0swQAKAAkBxwEZBDoACAAETgR9AX0CfQN9BMcEEAQXAAgABFMEfQF9An0DfQTHAxsDHAAIAARYBH0BfQJ9A30ExwECAQ0BIQAEXQhzb21lcHJvcAKoBF8BfSzHAQQBBQAIAARhBH0BfQJ9A30ExwABAAYBIQAEZghzb21lcHJvcAKoBGgBfSzHAywDLQEhAARqCHNvbWVwcm9wAqgEbAF9LMcCCgMPASEABG4Ic29tZXByb3ACqARwAX0sxwMfAQABIQAEcghzb21lcHJvcAKoBHQBfSzHABcAGAEhAAR2CHNvbWVwcm9wAqgEeAF9LMcCEwMfAAgABHoEfQF9An0DfQTHARYBFwAIAAR/BH0BfQJ9A30ExwAIBD8BIQAEhAEIc29tZXByb3ACqASGAQF9LMcAGQAPAAgABIgBBH0BfQJ9A30ExwMBAScACAAEjQEEfQF9An0DfQTHAB4CDgEhAASSAQhzb21lcHJvcAKoBJQBAX0syAErAR4EfYQIfYQIfYQIfYQIxwB7AHwBIQAEmgEIc29tZXByb3ACqAScAQF9LMgBRgIrA32ICH2ICH2ICMgAEgAIAn2KCH2KCHADAAEBBWFycmF5AYcDAAEhAAMBCHNvbWVwcm9wAqgDAwF9LIEDAQEABIEDBQEABEECAAHIAw8CAAF9hwfIAxACAAF9hwfBAxECAAHHAAEAAgEhAAMTCHNvbWVwcm9wAqgDFQF9LIEEAAKIAxgBfYwHyAMPAxABfY8HwQMaAxAByAMbAxABfY8HyAMPAxoBfZAHyAMdAxoBfZAHxwACAw8BIQADHwhzb21lcHJvcAKoAyEBfSzHAxoDGwEhAAMjCHNvbWVwcm9wAqgDJQF9LMcCAAMAASEAAycIc29tZXByb3ACqAMpAX0swQMQAxEByAMrAxEBfZIHyAMsAxEBfZIHyAMtAxEBfZIHwQMYAxkBAATIAQYBBwF9lAfIAzQBBwF9lAfHAQcELwAIAAM2BH0BfQJ9A30EyAEBAR4CfZUHfZUHyAMsAy0DfZcHfZcHfZcHxwQTBBQBIQADQAhzb21lcHJvcAKoA0IBfSxIAAACfZgHfZgHyANFAAABfZgHxwEEAQUACAADRwR9AX0CfQN9BMgDQAQUAX2ZB8EDTAQUAscABgIXASEAA08Ic29tZXByb3ACqANRAX0syAM/Ay0BfZwHyAMfAQABfZ0HxwM2BC8ACAADVQR9AX0CfQN9BMcDRQNGASEAA1oIc29tZXByb3ACqANcAX0sxwMPAx0BIQADXghzb21lcHJvcAKoA2ABfSzIAQgBBgF9pAfIAQQDRwN9pwd9pwd9pwfIAA8AEAJ9rAd9rAfHAAAAAwAIAANoBH0BfQJ9A30EyAMQAysDfbIHfbIHfbIHxwQxAQcACAADcAR9AX0CfQN9BMcBAAQfASEAA3UIc29tZXByb3ACqAN3AX0syAM/A1MBfbUHyAN5A1MCfbUHfbUHyAMtAy4DfbcHfbcHfbcHyAACAhMCfbkHfbkHyAOAAQITAX25B8cBKwM7AAgAA4IBBH0BfQJ9A30ExwEZARUBIQADhwEIc29tZXByb3ACqAOJAQF9LMcCHAQLAAgAA4sBBH0BfQJ9A30EyAQZBCcBfbsHyAOQAQQnAn27B327B8cDkAEDkQEBIQADkwEIc29tZXByb3ACqAOVAQF9LMcDaAADAAgAA5cBBH0BfQJ9A30ExwN5A3oACAADnAEEfQF9An0DfQTHA4sBBAsACAADoQEEfQF9An0DfQTHA5MBA5EBASEAA6YBCHNvbWVwcm9wAqgDqAEBfSzHAAADaAAIAAOqAQR9AX0CfQN9BMgADgAZA328B328B328B8gECwQjBH2CCH2CCH2CCH2CCMcDLQN8ASEAA7YBCHNvbWVwcm9wAqgDuAEBfSzHBAoEAAAIAAO6AQR9AX0CfQN9BMgDgAEDgQECfYUIfYUIWgIAAQEFYXJyYXkBAARHAgAACAACBQR9AX0CfQN9BMECBQIAAQADwQIFAgoBAATBAAICBQEAA8cABgAHAAgAAhcEfQF9An0DfQTHAxkECwEhAAIcCHNvbWVwcm9wAqgCHgF9LMcABAAFASEAAiAIc29tZXByb3ACqAIiAX0syAAIAA4BfZYHyAMRAxIBfZoHxwMdAx4ACAACJgR9AX0CfQN9BMcEFgQRAAgAAisEfQF9An0DfQTHBAoEAAAIAAIwBH0BfQJ9A30EyAAOABkDfaAHfaAHfaAHxwEFACIACAACOAR9AX0CfQN9BMcDJwQrAAgAAj0EfQF9An0DfQTHAhcABwAIAAJCBH0BfQJ9A30EyAEABB8CfaUHfaUHxwQrAwABIQACSQhzb21lcHJvcAKoAksBfSzHBCcEEwAIAAJNBH0BfQJ9A30ExwMbAxwACAACUgR9AX0CfQN9BMcEJwJNASEAAlcIc29tZXByb3ACqAJZAX0sxwQvBDAACAACWwR9AX0CfQN9BMcCPQQrASEAAmAIc29tZXByb3ACqAJiAX0sxwAYAycBIQACZAhzb21lcHJvcAKoAmYBfSzIAQEBHgJ9swd9swfIAmQDJwN9tAd9tAd9tAfHAkkDAAAIAAJtBH0BfQJ9A30ExwJkAmoACAACcgR9AX0CfQN9BMcCJgMeAAgAAncEfQF9An0DfQTHAiUDEgEhAAJ8CHNvbWVwcm9wAqgCfgF9LMgBFwEYBH24B324B324B324B8cBAQJoASEAAoQBCHNvbWVwcm9wAqgChgEBfSzHAkkCbQAIAAKIAQR9AX0CfQN9BMcCSAQfASEAAo0BCHNvbWVwcm9wAqgCjwEBfSzIAQYEMQR9vgd9vgd9vgd9vgfHAAAAAwEhAAKVAQhzb21lcHJvcAKoApcBAX0sxwJNBBMBIQACmQEIc29tZXByb3ACqAKbAQF9LMcCJgJ3ASEAAp0BCHNvbWVwcm9wAqgCnwEBfSzHAAEABgAIAAKhAQR9AX0CfQN9BMgCjQEEHwF9gwjIAyMDGwF9hgjHBF0BDQAIAAKoAQR9AX0CfQN9BMcDPAEeAAgAAq0BBH0BfQJ9A30EagEAAQEFYXJyYXkByAEAAwABfYMHyAEBAwABfYMHwQECAwAByAEBAQIBfYYHyAEEAQIBfYYHyAEFAQIBfYYHwQEGAQIBxwEFAQYACAABCAR9AX0CfQN9BMEBAgEDAQAEwQEFAQgByAESAQgBfYsHyAETAQgBfYsHyAEUAQgBfYsHgQQAAYEBFgGIARcBfZEHxwEUARUACAABGQR9AX0CfQN9BMcBAQEEAAgAAR4EfQF9An0DfQTHARQBGQEhAAEjCHNvbWVwcm9wAqgBJQF9LMEDAQMFAQADxwEBAR4BIQABKwhzb21lcHJvcAKoAS0BfSzHAgUAHgEhAAEvCHNvbWVwcm9wAqgBMQF9LMcECwQjASEAATMIc29tZXByb3ACqAE1AX0sxwMtAy4ACAABNwR9AX0CfQN9BMcDDwMdAAgAATwEfQF9An0DfQTHAQIBDQAIAAFBBH0BfQJ9A30ExwQWBBEBIQABRghzb21lcHJvcAKoAUgBfSzBABgDJwHIAUoDJwF9nwfHBBcEGgAIAAFMBH0BfQJ9A30ExwEABB8BIQABUQhzb21lcHJvcAKoAVMBfSzIAx0DHgJ9oQd9oQfIARkBFQF9ogfIAhwECwN9qAd9qAd9qAfIAxEDEgF9qgfIBAABFgJ9qwd9qwfIABAAEQF9rQfIAV4AEQF9rQfIAV8AEQJ9rQd9rQfIAV4BXwR9rwd9rwd9rwd9rwfIABABXgN9sAd9sAd9sAfIAWgBXgF9sAfHBA8EEAAIAAFqBH0BfQJ9A30ExwQYBBkBIQABbwhzb21lcHJvcAKoAXEBfSzHAAcAEgEhAAFzCHNvbWVwcm9wAqgBdQF9LEcAAAAIAAF3BH0BfQJ9A30ExwMPATwBIQABfAhzb21lcHJvcAKoAX4BfSzIAXwBPAJ9ugd9ugfBAYEBATwCxwFoAWkACAABhAEEfQF9An0DfQTHAV8BYAAIAAGJAQR9AX0CfQN9BMcADgAZASEAAY4BCHNvbWVwcm9wAqgBkAEBfSzIAx8BAAF9vQfIAZIBAQABfb0HyAQVBBYCfb8Hfb8HxwQaBBgBIQABlgEIc29tZXByb3ACqAGYAQF9LMgBHgEEA32ACH2ACH2ACMcEGAFvAAgAAZ0BBH0BfQJ9A30ExwMTAAIBIQABogEIc29tZXByb3ACqAGkAQF9LMcBkgEBkwEBIQABpgEIc29tZXByb3ACqAGoAQF9LMcBnAEBBAEhAAGqAQhzb21lcHJvcAKoAawBAX0syAF8AYABBH2HCH2HCH2HCH2HCMgBpgEBkwEDfYkIfYkIfYkIYQAAAQEFYXJyYXkBiAAAAX2AB4EAAQHBAAAAAQLIAAQAAQF9gQfIAAEAAgF9hAfIAAYAAgF9hAfIAAcAAgF9hAfBAAgAAgHBAAgACQEAA8gACAAKAX2FB8EADgAKAcgADwAKAX2FB8gAEAAKAX2FB8cABwAIAAgAABIEfQF9An0DfQTIAgADAAF9iQfIABcDAAF9iQfHAA4ADwAIAAAZBH0BfQJ9A30ExwIFAgABIQAAHghzb21lcHJvcAKoACABfSzHAQUBEgEhAAAiCHNvbWVwcm9wAqgAJAF9LMcAHgIOAAgAACYEfQF9An0DfQTHBBQEFQAIAAArBH0BfQJ9A30ExwAAAAMACAAAMAR9AX0CfQN9BMcBBQAiAAgAADUEfQF9An0DfQTIAx4DGgN9mwd9mwd9mwfHAhcABwAIAAA9BH0BfQJ9A30ExwEYAxcBIQAAQghzb21lcHJvcAKoAEQBfSzBACIBEgEABMcDDwMdASEAAEsIc29tZXByb3ACqABNAX0sxwQYBBkBIQAATwhzb21lcHJvcAKoAFEBfSzHACIARgAIAABTBH0BfQJ9A30ExwMdAx4BIQAAWAhzb21lcHJvcAKoAFoBfSzIAB4AJgF9owfHAzYELwAIAABdBH0BfQJ9A30EyAQwAQIDfaYHfaYHfaYHyABkAQIBfakHyAAXABgCfa4Hfa4HxwQjBA8BIQAAaAhzb21lcHJvcAKoAGoBfSzHAycEKwAIAABsBH0BfQJ9A30ExwABAAYACAAAcQR9AX0CfQN9BMcAZABlAAgAAHYEfQF9An0DfQTIAAcAEgF9sQfIAHsAEgN9sQd9sQd9sQfIAA8AEAF9tgfHARMBFAAIAACAAQR9AX0CfQN9BMcDIwMbAAgAAIUBBH0BfQJ9A30ExwEVAQgACAAAigEEfQF9An0DfQTHAIoBAQgBIQAAjwEIc29tZXByb3ACqACRAQF9LMcCFwA9AAgAAJMBBH0BfQJ9A30ExwEYAEIACAAAmAEEfQF9An0DfQTHAzQDNQEhAACdAQhzb21lcHJvcAKoAJ8BAX0sxwAQABEBIQAAoQEIc29tZXByb3ACqACjAQF9LMgAgAEBFAF9gQjHBBYEEQEhAACmAQhzb21lcHJvcAKoAKgBAX0sxwAHAHsACAAAqgEEfQF9An0DfQQFABAAAQIDCQUPAR8CIwJDAkYFTAJQAlkCaQKQAQKeAQKiAQKnAQICDgAFCg0dAiECSgJYAmECZQJ9AoUBAo4BApYBApoBAp4BAgQUBAcMAhACGQEfBCQCKAIsAjEJSgJNAV4CZwJrAm8CcwJ3AoUBApMBApsBAgMWAAECAgULEgEUAhcCGwEgAiQCKAIrAS8FQQJNAlACWwJfAnYCiAEClAECpwECtwECARYAAQMBBwENBhYCJAInBCwCMAI0AkcCSgFSAnACdAJ9AoIBAo8BApcBAqMBAqcBAqsBAg==';
    const oldVal = JSON.parse('[[1,2,3,4],472,472,{"someprop":44},472,[1,2,3,4],{"someprop":44},[1,2,3,4],[1,2,3,4],[1,2,3,4],{"someprop":44},449,448,[1,2,3,4],[1,2,3,4],{"someprop":44},452,{"someprop":44},[1,2,3,4],[1,2,3,4],[1,2,3,4],[1,2,3,4],452,[1,2,3,4],497,{"someprop":44},497,497,497,{"someprop":44},[1,2,3,4],522,522,452,470,{"someprop":44},[1,2,3,4],453,{"someprop":44},480,480,480,508,508,508,[1,2,3,4],[1,2,3,4],502,492,492,453,{"someprop":44},496,496,496,[1,2,3,4],496,493,495,495,495,495,493,[1,2,3,4],493,493,453,{"someprop":44},{"someprop":44},505,505,517,517,505,[1,2,3,4],{"someprop":44},509,{"someprop":44},521,521,521,509,477,{"someprop":44},{"someprop":44},485,485,{"someprop":44},515,{"someprop":44},451,{"someprop":44},[1,2,3,4],516,516,516,516,{"someprop":44},499,499,469,469,[1,2,3,4],[1,2,3,4],512,512,512,{"someprop":44},454,487,487,487,[1,2,3,4],[1,2,3,4],454,[1,2,3,4],[1,2,3,4],{"someprop":44},[1,2,3,4],459,[1,2,3,4],513,459,{"someprop":44},[1,2,3,4],482,{"someprop":44},[1,2,3,4],[1,2,3,4],459,[1,2,3,4],{"someprop":44},[1,2,3,4],484,454,510,510,510,510,468,{"someprop":44},468,[1,2,3,4],[1,2,3,4],[1,2,3,4],[1,2,3,4],467,[1,2,3,4],467,486,486,486,[1,2,3,4],489,451,[1,2,3,4],{"someprop":44},[1,2,3,4],[1,2,3,4],{"someprop":44},{"someprop":44},483,[1,2,3,4],{"someprop":44},{"someprop":44},{"someprop":44},{"someprop":44},519,519,519,519,506,506,[1,2,3,4],{"someprop":44},464,{"someprop":44},481,481,[1,2,3,4],{"someprop":44},[1,2,3,4],464,475,475,475,463,{"someprop":44},[1,2,3,4],518,[1,2,3,4],[1,2,3,4],463,455,498,498,498,466,471,471,471,501,[1,2,3,4],501,501,476,{"someprop":44},466,[1,2,3,4],{"someprop":44},503,503,503,466,455,490,474,{"someprop":44},457,494,494,{"someprop":44},457,479,{"someprop":44},[1,2,3,4],500,500,500,{"someprop":44},[1,2,3,4],[1,2,3,4],{"someprop":44},{"someprop":44},{"someprop":44},[1,2,3,4],[1,2,3,4],{"someprop":44},[1,2,3,4],[1,2,3,4],[1,2,3,4],[1,2,3],491,491,[1,2,3,4],504,504,504,504,465,[1,2,3,4],{"someprop":44},460,{"someprop":44},488,488,488,[1,2,3,4],[1,2,3,4],{"someprop":44},{"someprop":44},514,514,514,514,{"someprop":44},{"someprop":44},{"someprop":44},458,[1,2,3,4],[1,2,3,4],462,[1,2,3,4],[1,2,3,4],{"someprop":44},462,{"someprop":44},[1,2,3,4],{"someprop":44},[1,2,3,4],507,{"someprop":44},{"someprop":44},507,507,{"someprop":44},{"someprop":44},[1,2,3,4],{"someprop":44},461,{"someprop":44},473,461,[1,2,3,4],461,511,511,461,{"someprop":44},{"someprop":44},520,520,520,[1,2,3,4],458]');
    const doc = new Doc();
    applyUpdate(doc, fromBase64(oldDoc));
    compare$2(doc.getArray('array').toJSON(), oldVal);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testMapDecodingCompatibilityV1 = tc => {
    const oldDoc = 'BVcEAKEBAAGhAwEBAAShBAABAAGhBAECoQEKAgAEoQQLAQAEoQMcAaEEFQGhAiECAAShAS4BoQQYAaEEHgGhBB8BoQQdAQABoQQhAaEEIAGhBCMBAAGhBCUCoQQkAqEEKAEABKEEKgGhBCsBoQQwAQABoQQxAaEEMgGhBDQBAAGhBDYBoQQ1AQAEoQQ5AQABoQQ4AQAEoQM6AQAEoQRFAaEESgEAAaEESwEABKEETQGhBEABoQRSAgABoQRTAgAEoQRVAgABoQReAaEEWAEABKEEYAEAAaEEZgKhBGECAAShBGsBAAGhAaUBAgAEoQRwAgABoQRzAQAEoQR5AQABoQSAAQEABKEEggEBAAGhBIcBAwABoQGzAQEAAaEEjQECpwHMAQAIAASRAQR9AX0CfQN9BGcDACEBA21hcAN0d28BoQMAAQAEoQMBAQABoQMGAQAEIQEDbWFwA29uZQOhBAEBAAShAw8CoQMQAaEDFgEAAaEDFwEAAaEDGAGhAxwBAAGhAx0BoQIaBAAEoQMjAgABoQMpAQABoQMfAQABoQMrAQABoQMvAaEDLQEAAaEDMQIABKEDNQGhAzIBoQM6AaEDPAGhBCMBAAGhAU8BAAGhA0ADoQJCAQABoQNEAgABoQNFAgAEoQJEAQABoQNLAaEEQAEABKEESgEAAaEDWAGhA1MBAAGhA1oBAAGhA10DoQNbAQABoQNhAwABoQNiAQAEoQNmAaEDaAWhA20BAAShA3IBAAGhA3MBAAShA3gBoQN6A6EDfwEAAaEDgwEBAAShA4UBAgABoQOLAQGhA4IBAaEDjQEBoQOOAQEAAaEDjwEBAAShA5ABAaEDkgEBoQOXAQEABKEDmQEBAAGhA5gBAQABoQOgAQEAAaEDngEBaQIAIQEDbWFwA3R3bwGhAwABoQEAAQABoQIBAQAEoQIEAaEDAQKhAQwDAAShAg4BAAShAhMBoQQJBAABoQQVAQABoQIeAaECHAGhBBgBAAShAiICAAShBB4BAAShBB8BAAGhAzwBAAGhBCMCoQM9AqEDPgEAAaECOQEABKECPAGhAkEBAAGhAjoBAAGhAkIBAAShAkQBAAShAksBAAGhA0UCAAShAlMCoQJQAQAEoQJZAaECWgEAAaECYAKhAl8BAAShAmMCAAGhAmoBoQJkAgAEoQRSAQABoQJzAQAEoQRTAQAEoQJ6AQAEoQJ1AQABoQKEAQEABKEChgEBoQJ/AgABoQKLAQEABKECjwECAAGhApUBAQABoQKXAQGhAo0BAQABoQKaAQGhApkBAQABoQKcAQEAAaECnwEBAAShAqEBAaECnQEBAAShAqYBAaECpwEBAAGhAqwBAQABoQKtAQEABKECrwECAAF5AQAhAQNtYXADb25lASEBA21hcAN0d28CAAGhAQABoQMAAaEBBAEAAaEBBQGhAQYBoQMPAaEEAQGhAQoBoQELAaEBDAEABKEBDgEAAaEBDQEABKEBFQEABKEDHAKhBBUBAAShASECAAShAScBoQQWAwAEoQIhAgABoQEvAaECIgEABKEBOAEAAaEBNwEAAaEBPwGhAzoBAAShAUIBoQQjAQABoQFIAQABoQFKAaEDPgEAAaECOgEAAaEBTwIAAaEBUgEAAaECQQGhAVQCoQFWAgABoQFYAQAEoQFcAqEBWgEAAaEBYgShAWMBAAGhAWgBAAGhAWkCAAGhAW4BAAGhAWsBAAShAXABAAShAXcCAAShAX0BAAShAYIBAaEBcgEAAaEBhwEBoQGIAQEABKEBigEBAAShAZABAQAEoQGLAQIABKEBlQEBAAShBGkEAAGhAagBAQAEoQRzAQABoQGvAQKhBHsBAAGhAbMBAgAEoQSAAQEAAaEBuwECAAGhAbYBAqEEiwEBAAShAcIBAQAEoQHHAQEABKEEkAEBpwHRAQEoAAHSAQdkZWVwa2V5AXcJZGVlcHZhbHVloQHMAQFiAAAhAQNtYXADb25lAwABoQACASEBA21hcAN0d28CAAShAAQBoQAGAaEACwEAAaEADQIABKEADAEABKEAEAEABKEAGgEABKEAHwEABKEAFQGhACQBAAGhACoBoQApAaEALAGhAC0BoQAuAaEALwEAAaEAMAIAAaEANAEABKEAMQEABKEANgEAAaEAQAIAAaEAOwGhAEMCAAShAEcBAAShAEwBoQBFAQAEoQBRAQAEoQBXAqEAUgEABKEAXgIAAaEAZAKhAF0BoQBnAqEAaAEABKEAawGhAGoCoQBwAQABoQBzAQAEoQB1AQABoQB6AaEAcgGhAHwBAAShAH4BoQB9AgABoQCFAQEABKEAhwEBAAShAIwBAaEAgwEBAAShAJIBAQAEoQCXAQIABKEAkQEBAAGhAJ0BAQAEoQCiAQEABKEApAECAAGhAK8BAqEAqQEBAAGhALMBAQABBQABALcBAQIA0gHUAQEEAQCRAQMBAKUBAgEAuQE=';
    // eslint-disable-next-line
    const oldVal = /** @type {any} */ ({"one":[1,2,3,4],"two":{"deepkey":"deepvalue"}});
    const doc = new Doc();
    applyUpdate(doc, fromBase64(oldDoc));
    compare$2(doc.getMap('map').toJSON(), oldVal);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testTextDecodingCompatibilityV1 = tc => {
    const oldDoc = 'BS8EAAUBBHRleHRveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9RAQAATHBBAEEAAHBBAIEAAHEBAMEAAQxdXUKxQQCBANveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9xQMJBAFveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9xQMJBAlveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9xgMBAwIGaXRhbGljBHRydWXGBAsDAgVjb2xvcgYiIzg4OCLEBAwDAgExxAQNAwIBMsEEDgMCAsYEEAMCBml0YWxpYwRudWxsxgQRAwIFY29sb3IEbnVsbMQDAQQLATHEBBMECwIyOcQEFQQLCzl6anpueXdvaHB4xAQgBAsIY25icmNhcQrBAxADEQHGAR8BIARib2xkBHRydWXGAgACAQRib2xkBG51bGzFAwkECm97ImltYWdlIjoiaHR0cHM6Ly91c2VyLWltYWdlcy5naXRodWJ1c2VyY29udGVudC5jb20vNTU1Mzc1Ny80ODk3NTMwNy02MWVmYjEwMC1mMDZkLTExZTgtOTE3Ny1lZTg5NWU1OTE2ZTUucG5nIn3GARABEQZpdGFsaWMEdHJ1ZcYELQERBWNvbG9yBiIjODg4IsYBEgETBml0YWxpYwRudWxsxgQvARMFY29sb3IEbnVsbMYCKwIsBGJvbGQEdHJ1ZcYCLQIuBGJvbGQEbnVsbMYCjAECjQEGaXRhbGljBHRydWXGAo4BAo8BBml0YWxpYwRudWxswQA2ADcBxgQ1ADcFY29sb3IGIiM4ODgixgNlA2YFY29sb3IEbnVsbMYDUwNUBGJvbGQEdHJ1ZcQEOANUFjEzMTZ6bHBrbWN0b3FvbWdmdGhicGfGBE4DVARib2xkBG51bGzGAk0CTgZpdGFsaWMEdHJ1ZcYEUAJOBWNvbG9yBiIjODg4IsYCTwJQBml0YWxpYwRudWxsxgRSAlAFY29sb3IEbnVsbMYChAEChQEGaXRhbGljBHRydWXGBFQChQEFY29sb3IGIiM4ODgixgKGAQKHAQZpdGFsaWMEbnVsbMYEVgKHAQVjb2xvcgRudWxsxAMpAyoRMTMyMWFwZ2l2eWRxc2pmc2XFBBIDAm97ImltYWdlIjoiaHR0cHM6Ly91c2VyLWltYWdlcy5naXRodWJ1c2VyY29udGVudC5jb20vNTU1Mzc1Ny80ODk3NTMwNy02MWVmYjEwMC1mMDZkLTExZTgtOTE3Ny1lZTg5NWU1OTE2ZTUucG5nIn0zAwAEAQR0ZXh0AjEyhAMBAzkwboQDBAF4gQMFAoQDBwJyCsQDBAMFBjEyOTd6bcQDDwMFAXbEAxADBQFwwQMRAwUBxAMSAwUFa3pxY2rEAxcDBQJzYcQDGQMFBHNqeQrBAxIDEwHBAAwAEAHEAA0ADgkxMzAyeGNpd2HEAygADgF5xAMpAA4KaGhlenVraXF0dMQDMwAOBWhudGsKxgMoAykEYm9sZAR0cnVlxAM5AykGMTMwNXJswQM/AykCxANBAykDZXlrxgNEAykEYm9sZARudWxsxAMzAzQJMTMwN3R2amllwQNOAzQCxANQAzQDamxoxANTAzQCZ3bEA1UDNAJsYsQDVwM0AmYKxgNBA0IEYm9sZARudWxswQNaA0ICxANcA0ICMDjBA14DQgLEA2ADQgEKxgNhA0IEYm9sZAR0cnVlxQIaAhtveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9wQA3ADgCwQNlADgBxANmADgKMTVteml3YWJ6a8EDcAA4AsQDcgA4BnJybXNjdsEDeAA4AcQCYgJjATHEA3oCYwIzMsQDfAJjCTRyb3J5d3RoccQDhQECYwEKxAOFAQOGARkxMzI1aW9kYnppenhobWxpYnZweXJ4bXEKwQN6A3sBxgOgAQN7BWNvbG9yBiIjODg4IsYDfAN9Bml0YWxpYwRudWxsxgOiAQN9BWNvbG9yBG51bGxSAgAEAQR0ZXh0ATGEAgACMjiEAgIBOYECAwKEAgUBdYQCBgJ0Y4QCCAJqZYECCgKEAgwBaoECDQGBAg4BhAIPAnVmhAIRAQrEAg4CDwgxMjkycXJtZsQCGgIPAmsKxgIGAgcGaXRhbGljBHRydWXGAggCCQZpdGFsaWMEbnVsbMYCEQISBml0YWxpYwR0cnVlxAIfAhIBMcECIAISAsQCIgISAzRoc8QCJQISAXrGAiYCEgZpdGFsaWMEbnVsbMEAFQAWAsQCKQAWATDEAioAFgEwxAIrABYCaHjEAi0AFglvamVldHJqaHjBAjYAFgLEAjgAFgJrcsQCOgAWAXHBAjsAFgHBAjwAFgHEAj0AFgFuxAI+ABYCZQrGAiUCJgZpdGFsaWMEbnVsbMQCQQImAjEzwQJDAiYCxAJFAiYIZGNjeGR5eGfEAk0CJgJ6Y8QCTwImA2Fwb8QCUgImAnRuxAJUAiYBcsQCVQImAmduwQJXAiYCxAJZAiYBCsYCWgImBml0YWxpYwR0cnVlxAI6AjsEMTMwM8QCXwI7A3VodsQCYgI7BmdhbmxuCsUCVQJWb3siaW1hZ2UiOiJodHRwczovL3VzZXItaW1hZ2VzLmdpdGh1YnVzZXJjb250ZW50LmNvbS81NTUzNzU3LzQ4OTc1MzA3LTYxZWZiMTAwLWYwNmQtMTFlOC05MTc3LWVlODk1ZTU5MTZlNS5wbmcifcECPAI9AcECPgI/AcYDFwMYBml0YWxpYwR0cnVlxgJsAxgFY29sb3IGIiM4ODgixgMZAxoGaXRhbGljBG51bGzGAm4DGgVjb2xvcgRudWxswQMQBCkBxAJwBCkKMTMwOXpsZ3ZqeMQCegQpAWfBAnsEKQLGBA0EDgZpdGFsaWMEbnVsbMYCfgQOBWNvbG9yBG51bGzEAn8EDgUxMzEwZ8QChAEEDgJ3c8QChgEEDgZoeHd5Y2jEAowBBA4Ca3HEAo4BBA4Ec2RydcQCkgEEDgRqcWljwQKWAQQOBMQCmgEEDgEKxgKbAQQOBml0YWxpYwR0cnVlxgKcAQQOBWNvbG9yBiIjODg4IsECaAI7AcQCCgEBFjEzMThqd3NramFiZG5kcmRsbWphZQrGA1UDVgRib2xkBHRydWXGA1cDWARib2xkBG51bGzGAEAAQQZpdGFsaWMEdHJ1ZcYCtwEAQQRib2xkBG51bGzEArgBAEESMTMyNnJwY3pucWFob3BjcnRkxgLKAQBBBml0YWxpYwRudWxsxgLLAQBBBGJvbGQEdHJ1ZRkBAMUCAgIDb3siaW1hZ2UiOiJodHRwczovL3VzZXItaW1hZ2VzLmdpdGh1YnVzZXJjb250ZW50LmNvbS81NTUzNzU3LzQ4OTc1MzA3LTYxZWZiMTAwLWYwNmQtMTFlOC05MTc3LWVlODk1ZTU5MTZlNS5wbmcifcQCCgILBzEyOTN0agrGABgAGQRib2xkBHRydWXGAA0ADgRib2xkBG51bGxEAgAHMTMwNnJ1cMQBEAIAAnVqxAESAgANaWtrY2pucmNwc2Nrd8QBHwIAAQrFBBMEFG97ImltYWdlIjoiaHR0cHM6Ly91c2VyLWltYWdlcy5naXRodWJ1c2VyY29udGVudC5jb20vNTU1Mzc1Ny80ODk3NTMwNy02MWVmYjEwMC1mMDZkLTExZTgtOTE3Ny1lZTg5NWU1OTE2ZTUucG5nIn3FAx0DBW97ImltYWdlIjoiaHR0cHM6Ly91c2VyLWltYWdlcy5naXRodWJ1c2VyY29udGVudC5jb20vNTU1Mzc1Ny80ODk3NTMwNy02MWVmYjEwMC1mMDZkLTExZTgtOTE3Ny1lZTg5NWU1OTE2ZTUucG5nIn3GAlICUwRib2xkBHRydWXGAlQCVQRib2xkBG51bGzGAnsCfAZpdGFsaWMEdHJ1ZcYBJQJ8BWNvbG9yBiIjODg4IsYBJgJ8BGJvbGQEbnVsbMQBJwJ8CjEzMTRweWNhdnXGATECfAZpdGFsaWMEbnVsbMYBMgJ8BWNvbG9yBG51bGzBATMCfAHFADEAMm97ImltYWdlIjoiaHR0cHM6Ly91c2VyLWltYWdlcy5naXRodWJ1c2VyY29udGVudC5jb20vNTU1Mzc1Ny80ODk3NTMwNy02MWVmYjEwMC1mMDZkLTExZTgtOTE3Ny1lZTg5NWU1OTE2ZTUucG5nIn3GADUANgZpdGFsaWMEdHJ1ZcEANwA4AcQAMgAzEzEzMjJybmJhb2tvcml4ZW52cArEAgUCBhcxMzIzbnVjdnhzcWx6bndsZmF2bXBjCsYDDwMQBGJvbGQEdHJ1ZR0AAMQEAwQEDTEyOTVxZnJ2bHlmYXDEAAwEBAFjxAANBAQCanbBAAwADQHEABAADQEywQARAA0ExAAVAA0DZHZmxAAYAA0BYcYCAwIEBml0YWxpYwR0cnVlwQAaAgQCxAAcAgQEMDRrdcYAIAIEBml0YWxpYwRudWxsxQQgBCFveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9xQJAABZveyJpbWFnZSI6Imh0dHBzOi8vdXNlci1pbWFnZXMuZ2l0aHVidXNlcmNvbnRlbnQuY29tLzU1NTM3NTcvNDg5NzUzMDctNjFlZmIxMDAtZjA2ZC0xMWU4LTkxNzctZWU4OTVlNTkxNmU1LnBuZyJ9xAQVBBYGMTMxMWtrxAIqAisIMTMxMnFyd3TEADECKwFixAAyAisDcnhxxAA1AisBasQANgIrAXjEADcCKwZkb3ZhbwrEAgAEKwMxMzHEAEAEKwkzYXhoa3RoaHXGAnoCewRib2xkBG51bGzFAEoCe297ImltYWdlIjoiaHR0cHM6Ly91c2VyLWltYWdlcy5naXRodWJ1c2VyY29udGVudC5jb20vNTU1Mzc1Ny80ODk3NTMwNy02MWVmYjEwMC1mMDZkLTExZTgtOTE3Ny1lZTg5NWU1OTE2ZTUucG5nIn3GAEsCewRib2xkBHRydWXEAl8CYBExMzE3cGZjeWhrc3JrcGt0CsQBHwQqCzEzMTliY2Nna3AKxAKSAQKTARUxMzIwY29oYnZjcmtycGpuZ2RvYwoFBAQCAg8CKQE1AQADEAESBBsCAwsGAhIBHgJAAk8CWwJfAmQDcQJ5AaABAQIOBAILAg4CIQIoAjcCPAJEAlgCagJwAXwClwEEngEBAQI0ATcB';
    // eslint-disable-next-line
    const oldVal = [{"insert":"1306rup"},{"insert":"uj","attributes":{"italic":true,"color":"#888"}},{"insert":"ikkcjnrcpsckw1319bccgkp\n"},{"insert":"\n1131","attributes":{"bold":true}},{"insert":"1326rpcznqahopcrtd","attributes":{"italic":true}},{"insert":"3axhkthhu","attributes":{"bold":true}},{"insert":"28"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"9"},{"insert":"04ku","attributes":{"italic":true}},{"insert":"1323nucvxsqlznwlfavmpc\nu"},{"insert":"tc","attributes":{"italic":true}},{"insert":"je1318jwskjabdndrdlmjae\n1293tj\nj1292qrmf"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"k\nuf"},{"insert":"14hs","attributes":{"italic":true}},{"insert":"13dccxdyxg"},{"insert":"zc","attributes":{"italic":true,"color":"#888"}},{"insert":"apo"},{"insert":"tn","attributes":{"bold":true}},{"insert":"r"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"gn\n"},{"insert":"z","attributes":{"italic":true}},{"insert":"\n121"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"291311kk9zjznywohpx"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"cnbrcaq\n"},{"insert":"1","attributes":{"italic":true,"color":"#888"}},{"insert":"1310g"},{"insert":"ws","attributes":{"italic":true,"color":"#888"}},{"insert":"hxwych"},{"insert":"kq","attributes":{"italic":true}},{"insert":"sdru1320cohbvcrkrpjngdoc\njqic\n"},{"insert":"2","attributes":{"italic":true,"color":"#888"}},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"90n1297zm"},{"insert":"v1309zlgvjx","attributes":{"bold":true}},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"g","attributes":{"bold":true}},{"insert":"1314pycavu","attributes":{"italic":true,"color":"#888"}},{"insert":"pkzqcj"},{"insert":"sa","attributes":{"italic":true,"color":"#888"}},{"insert":"sjy\n"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"xr\n"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"1"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"1295qfrvlyfap201312qrwt"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"b1322rnbaokorixenvp\nrxq"},{"insert":"j","attributes":{"italic":true}},{"insert":"x","attributes":{"italic":true,"color":"#888"}},{"insert":"15mziwabzkrrmscvdovao\n0","attributes":{"italic":true}},{"insert":"hx","attributes":{"italic":true,"bold":true}},{"insert":"ojeetrjhxkr13031317pfcyhksrkpkt\nuhv1","attributes":{"italic":true}},{"insert":"32","attributes":{"italic":true,"color":"#888"}},{"insert":"4rorywthq1325iodbzizxhmlibvpyrxmq\n\nganln\nqne\n"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}},{"insert":"dvf"},{"insert":"ac","attributes":{"bold":true}},{"insert":"1302xciwa"},{"insert":"1305rl","attributes":{"bold":true}},{"insert":"08\n"},{"insert":"eyk","attributes":{"bold":true}},{"insert":"y1321apgivydqsjfsehhezukiqtt1307tvjiejlh"},{"insert":"1316zlpkmctoqomgfthbpg","attributes":{"bold":true}},{"insert":"gv"},{"insert":"lb","attributes":{"bold":true}},{"insert":"f\nhntk\njv1uu\n"},{"insert":{"image":"https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png"}}];
    const doc = new Doc();
    applyUpdate(doc, fromBase64(oldDoc));
    compare$2(doc.getText('text').toDelta(), oldVal);
  };

  var compatibility = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testArrayCompatibilityV1: testArrayCompatibilityV1,
    testMapDecodingCompatibilityV1: testMapDecodingCompatibilityV1,
    testTextDecodingCompatibilityV1: testTextDecodingCompatibilityV1
  });

  /**
   * @param {t.TestCase} _tc
   */
  const testAfterTransactionRecursion = _tc => {
    const ydoc = new Doc();
    const yxml = ydoc.getXmlFragment('');
    ydoc.on('afterTransaction', tr => {
      if (tr.origin === 'test') {
        yxml.toJSON();
      }
    });
    ydoc.transact(_tr => {
      for (let i = 0; i < 15000; i++) {
        yxml.push([new YXmlText('a')]);
      }
    }, 'test');
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testOriginInTransaction = _tc => {
    const doc = new Doc();
    const ytext = doc.getText();
    /**
     * @type {Array<string>}
     */
    const origins = [];
    doc.on('afterTransaction', (tr) => {
      origins.push(tr.origin);
      if (origins.length <= 1) {
        ytext.toDelta(snapshot$1(doc)); // adding a snapshot forces toDelta to create a cleanup transaction
        doc.transact(() => {
          ytext.insert(0, 'a');
        }, 'nested');
      }
    });
    doc.transact(() => {
      ytext.insert(0, '0');
    }, 'first');
    compareArrays(origins, ['first', 'cleanup', 'nested']);
  };

  /**
   * Client id should be changed when an instance receives updates from another client using the same client id.
   *
   * @param {t.TestCase} _tc
   */
  const testClientIdDuplicateChange = _tc => {
    const doc1 = new Doc();
    doc1.clientID = 0;
    const doc2 = new Doc();
    doc2.clientID = 0;
    assert(doc2.clientID === doc1.clientID);
    doc1.getArray('a').insert(0, [1, 2]);
    applyUpdate(doc2, encodeStateAsUpdate(doc1));
    assert(doc2.clientID !== doc1.clientID);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testGetTypeEmptyId = _tc => {
    const doc1 = new Doc();
    doc1.getText('').insert(0, 'h');
    doc1.getText().insert(1, 'i');
    const doc2 = new Doc();
    applyUpdate(doc2, encodeStateAsUpdate(doc1));
    assert(doc2.getText().toString() === 'hi');
    assert(doc2.getText('').toString() === 'hi');
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testToJSON = _tc => {
    const doc = new Doc();
    compare$2(doc.toJSON(), {}, 'doc.toJSON yields empty object');

    const arr = doc.getArray('array');
    arr.push(['test1']);

    const map = doc.getMap('map');
    map.set('k1', 'v1');
    const map2 = new YMap();
    map.set('k2', map2);
    map2.set('m2k1', 'm2v1');

    compare$2(doc.toJSON(), {
      array: ['test1'],
      map: {
        k1: 'v1',
        k2: {
          m2k1: 'm2v1'
        }
      }
    }, 'doc.toJSON has array and recursive map');
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testSubdoc = _tc => {
    const doc = new Doc();
    doc.load(); // doesn't do anything
    {
      /**
       * @type {Array<any>|null}
       */
      let event = /** @type {any} */ (null);
      doc.on('subdocs', subdocs => {
        event = [Array.from(subdocs.added).map(x => x.guid), Array.from(subdocs.removed).map(x => x.guid), Array.from(subdocs.loaded).map(x => x.guid)];
      });
      const subdocs = doc.getMap('mysubdocs');
      const docA = new Doc({ guid: 'a' });
      docA.load();
      subdocs.set('a', docA);
      compare$2(event, [['a'], [], ['a']]);

      event = null;
      subdocs.get('a').load();
      assert(event === null);

      event = null;
      subdocs.get('a').destroy();
      compare$2(event, [['a'], ['a'], []]);
      subdocs.get('a').load();
      compare$2(event, [[], [], ['a']]);

      subdocs.set('b', new Doc({ guid: 'a', shouldLoad: false }));
      compare$2(event, [['a'], [], []]);
      subdocs.get('b').load();
      compare$2(event, [[], [], ['a']]);

      const docC = new Doc({ guid: 'c' });
      docC.load();
      subdocs.set('c', docC);
      compare$2(event, [['c'], [], ['c']]);

      compare$2(Array.from(doc.getSubdocGuids()), ['a', 'c']);
    }

    const doc2 = new Doc();
    {
      compare$2(Array.from(doc2.getSubdocs()), []);
      /**
       * @type {Array<any>|null}
       */
      let event = /** @type {any} */ (null);
      doc2.on('subdocs', subdocs => {
        event = [Array.from(subdocs.added).map(d => d.guid), Array.from(subdocs.removed).map(d => d.guid), Array.from(subdocs.loaded).map(d => d.guid)];
      });
      applyUpdate(doc2, encodeStateAsUpdate(doc));
      compare$2(event, [['a', 'a', 'c'], [], []]);

      doc2.getMap('mysubdocs').get('a').load();
      compare$2(event, [[], [], ['a']]);

      compare$2(Array.from(doc2.getSubdocGuids()), ['a', 'c']);

      doc2.getMap('mysubdocs').delete('a');
      compare$2(event, [[], ['a'], []]);
      compare$2(Array.from(doc2.getSubdocGuids()), ['a', 'c']);
    }
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testSubdocLoadEdgeCases = _tc => {
    const ydoc = new Doc();
    const yarray = ydoc.getArray();
    const subdoc1 = new Doc();
    /**
     * @type {any}
     */
    let lastEvent = null;
    ydoc.on('subdocs', event => {
      lastEvent = event;
    });
    yarray.insert(0, [subdoc1]);
    assert(subdoc1.shouldLoad);
    assert(subdoc1.autoLoad === false);
    assert(lastEvent !== null && lastEvent.loaded.has(subdoc1));
    assert(lastEvent !== null && lastEvent.added.has(subdoc1));
    // destroy and check whether lastEvent adds it again to added (it shouldn't)
    subdoc1.destroy();
    const subdoc2 = yarray.get(0);
    assert(subdoc1 !== subdoc2);
    assert(lastEvent !== null && lastEvent.added.has(subdoc2));
    assert(lastEvent !== null && !lastEvent.loaded.has(subdoc2));
    // load
    subdoc2.load();
    assert(lastEvent !== null && !lastEvent.added.has(subdoc2));
    assert(lastEvent !== null && lastEvent.loaded.has(subdoc2));
    // apply from remote
    const ydoc2 = new Doc();
    ydoc2.on('subdocs', event => {
      lastEvent = event;
    });
    applyUpdate(ydoc2, encodeStateAsUpdate(ydoc));
    const subdoc3 = ydoc2.getArray().get(0);
    assert(subdoc3.shouldLoad === false);
    assert(subdoc3.autoLoad === false);
    assert(lastEvent !== null && lastEvent.added.has(subdoc3));
    assert(lastEvent !== null && !lastEvent.loaded.has(subdoc3));
    // load
    subdoc3.load();
    assert(subdoc3.shouldLoad);
    assert(lastEvent !== null && !lastEvent.added.has(subdoc3));
    assert(lastEvent !== null && lastEvent.loaded.has(subdoc3));
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testSubdocLoadEdgeCasesAutoload = _tc => {
    const ydoc = new Doc();
    const yarray = ydoc.getArray();
    const subdoc1 = new Doc({ autoLoad: true });
    /**
     * @type {any}
     */
    let lastEvent = null;
    ydoc.on('subdocs', event => {
      lastEvent = event;
    });
    yarray.insert(0, [subdoc1]);
    assert(subdoc1.shouldLoad);
    assert(subdoc1.autoLoad);
    assert(lastEvent !== null && lastEvent.loaded.has(subdoc1));
    assert(lastEvent !== null && lastEvent.added.has(subdoc1));
    // destroy and check whether lastEvent adds it again to added (it shouldn't)
    subdoc1.destroy();
    const subdoc2 = yarray.get(0);
    assert(subdoc1 !== subdoc2);
    assert(lastEvent !== null && lastEvent.added.has(subdoc2));
    assert(lastEvent !== null && !lastEvent.loaded.has(subdoc2));
    // load
    subdoc2.load();
    assert(lastEvent !== null && !lastEvent.added.has(subdoc2));
    assert(lastEvent !== null && lastEvent.loaded.has(subdoc2));
    // apply from remote
    const ydoc2 = new Doc();
    ydoc2.on('subdocs', event => {
      lastEvent = event;
    });
    applyUpdate(ydoc2, encodeStateAsUpdate(ydoc));
    const subdoc3 = ydoc2.getArray().get(0);
    assert(subdoc1.shouldLoad);
    assert(subdoc1.autoLoad);
    assert(lastEvent !== null && lastEvent.added.has(subdoc3));
    assert(lastEvent !== null && lastEvent.loaded.has(subdoc3));
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testSubdocsUndo = _tc => {
    const ydoc = new Doc();
    const elems = ydoc.getXmlFragment();
    const undoManager = new UndoManager(elems);
    const subdoc = new Doc();
    // @ts-ignore
    elems.insert(0, [subdoc]);
    undoManager.undo();
    undoManager.redo();
    assert(elems.length === 1);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testLoadDocsEvent = async _tc => {
    const ydoc = new Doc();
    assert(ydoc.isLoaded === false);
    let loadedEvent = false;
    ydoc.on('load', () => {
      loadedEvent = true;
    });
    ydoc.emit('load', [ydoc]);
    await ydoc.whenLoaded;
    assert(loadedEvent);
    assert(ydoc.isLoaded);
  };

  /**
   * @param {t.TestCase} _tc
   */
  const testSyncDocsEvent = async _tc => {
    const ydoc = new Doc();
    assert(ydoc.isLoaded === false);
    assert(ydoc.isSynced === false);
    let loadedEvent = false;
    ydoc.once('load', () => {
      loadedEvent = true;
    });
    let syncedEvent = false;
    ydoc.once('sync', /** @param {any} isSynced */ (isSynced) => {
      syncedEvent = true;
      assert(isSynced);
    });
    ydoc.emit('sync', [true, ydoc]);
    await ydoc.whenLoaded;
    const oldWhenSynced = ydoc.whenSynced;
    await ydoc.whenSynced;
    assert(loadedEvent);
    assert(syncedEvent);
    assert(ydoc.isLoaded);
    assert(ydoc.isSynced);
    let loadedEvent2 = false;
    ydoc.on('load', () => {
      loadedEvent2 = true;
    });
    let syncedEvent2 = false;
    ydoc.on('sync', (isSynced) => {
      syncedEvent2 = true;
      assert(isSynced === false);
    });
    ydoc.emit('sync', [false, ydoc]);
    assert(!loadedEvent2);
    assert(syncedEvent2);
    assert(ydoc.isLoaded);
    assert(!ydoc.isSynced);
    assert(ydoc.whenSynced !== oldWhenSynced);
  };

  var doc = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testAfterTransactionRecursion: testAfterTransactionRecursion,
    testClientIdDuplicateChange: testClientIdDuplicateChange,
    testGetTypeEmptyId: testGetTypeEmptyId,
    testLoadDocsEvent: testLoadDocsEvent,
    testOriginInTransaction: testOriginInTransaction,
    testSubdoc: testSubdoc,
    testSubdocLoadEdgeCases: testSubdocLoadEdgeCases,
    testSubdocLoadEdgeCasesAutoload: testSubdocLoadEdgeCasesAutoload,
    testSubdocsUndo: testSubdocsUndo,
    testSyncDocsEvent: testSyncDocsEvent,
    testToJSON: testToJSON
  });

  /**
   * @param {t.TestCase} tc
   */
  const testBasic = tc => {
    const ydoc = new Doc({ gc: false });
    ydoc.getText().insert(0, 'world!');
    const snapshot = snapshot$1(ydoc);
    ydoc.getText().insert(0, 'hello ');
    const restored = createDocFromSnapshot(ydoc, snapshot);
    assert(restored.getText().toString() === 'world!');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testBasicRestoreSnapshot = tc => {
    const doc = new Doc({ gc: false });
    doc.getArray('array').insert(0, ['hello']);
    const snap = snapshot$1(doc);
    doc.getArray('array').insert(1, ['world']);

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray('array').toArray(), ['hello']);
    compare$2(doc.getArray('array').toArray(), ['hello', 'world']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testEmptyRestoreSnapshot = tc => {
    const doc = new Doc({ gc: false });
    const snap = snapshot$1(doc);
    snap.sv.set(9999, 0);
    doc.getArray().insert(0, ['world']);

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray().toArray(), []);
    compare$2(doc.getArray().toArray(), ['world']);

    // now this snapshot reflects the latest state. It shoult still work.
    const snap2 = snapshot$1(doc);
    const docRestored2 = createDocFromSnapshot(doc, snap2);
    compare$2(docRestored2.getArray().toArray(), ['world']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRestoreSnapshotWithSubType = tc => {
    const doc = new Doc({ gc: false });
    doc.getArray('array').insert(0, [new YMap()]);
    const subMap = doc.getArray('array').get(0);
    subMap.set('key1', 'value1');

    const snap = snapshot$1(doc);
    subMap.set('key2', 'value2');

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray('array').toJSON(), [{
      key1: 'value1'
    }]);
    compare$2(doc.getArray('array').toJSON(), [{
      key1: 'value1',
      key2: 'value2'
    }]);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRestoreDeletedItem1 = tc => {
    const doc = new Doc({ gc: false });
    doc.getArray('array').insert(0, ['item1', 'item2']);

    const snap = snapshot$1(doc);
    doc.getArray('array').delete(0);

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray('array').toArray(), ['item1', 'item2']);
    compare$2(doc.getArray('array').toArray(), ['item2']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRestoreLeftItem = tc => {
    const doc = new Doc({ gc: false });
    doc.getArray('array').insert(0, ['item1']);
    doc.getMap('map').set('test', 1);
    doc.getArray('array').insert(0, ['item0']);

    const snap = snapshot$1(doc);
    doc.getArray('array').delete(1);

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray('array').toArray(), ['item0', 'item1']);
    compare$2(doc.getArray('array').toArray(), ['item0']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testDeletedItemsBase = tc => {
    const doc = new Doc({ gc: false });
    doc.getArray('array').insert(0, ['item1']);
    doc.getArray('array').delete(0);
    const snap = snapshot$1(doc);
    doc.getArray('array').insert(0, ['item0']);

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray('array').toArray(), []);
    compare$2(doc.getArray('array').toArray(), ['item0']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testDeletedItems2 = tc => {
    const doc = new Doc({ gc: false });
    doc.getArray('array').insert(0, ['item1', 'item2', 'item3']);
    doc.getArray('array').delete(1);
    const snap = snapshot$1(doc);
    doc.getArray('array').insert(0, ['item0']);

    const docRestored = createDocFromSnapshot(doc, snap);

    compare$2(docRestored.getArray('array').toArray(), ['item1', 'item3']);
    compare$2(doc.getArray('array').toArray(), ['item0', 'item1', 'item3']);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testDependentChanges = tc => {
    const { array0, array1, testConnector } = init$1(tc, { users: 2 });

    if (!array0.doc) {
      throw new Error('no document 0')
    }
    if (!array1.doc) {
      throw new Error('no document 1')
    }

    /**
     * @type {Y.Doc}
     */
    const doc0 = array0.doc;
    /**
     * @type {Y.Doc}
     */
    const doc1 = array1.doc;

    doc0.gc = false;
    doc1.gc = false;

    array0.insert(0, ['user1item1']);
    testConnector.syncAll();
    array1.insert(1, ['user2item1']);
    testConnector.syncAll();

    const snap = snapshot$1(array0.doc);

    array0.insert(2, ['user1item2']);
    testConnector.syncAll();
    array1.insert(3, ['user2item2']);
    testConnector.syncAll();

    const docRestored0 = createDocFromSnapshot(array0.doc, snap);
    compare$2(docRestored0.getArray('array').toArray(), ['user1item1', 'user2item1']);

    const docRestored1 = createDocFromSnapshot(array1.doc, snap);
    compare$2(docRestored1.getArray('array').toArray(), ['user1item1', 'user2item1']);
  };

  var snapshot = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testBasic: testBasic,
    testBasicRestoreSnapshot: testBasicRestoreSnapshot,
    testDeletedItems2: testDeletedItems2,
    testDeletedItemsBase: testDeletedItemsBase,
    testDependentChanges: testDependentChanges,
    testEmptyRestoreSnapshot: testEmptyRestoreSnapshot,
    testRestoreDeletedItem1: testRestoreDeletedItem1,
    testRestoreLeftItem: testRestoreLeftItem,
    testRestoreSnapshotWithSubType: testRestoreSnapshotWithSubType
  });

  /**
   * @typedef {Object} Enc
   * @property {function(Array<Uint8Array>):Uint8Array} Enc.mergeUpdates
   * @property {function(Y.Doc):Uint8Array} Enc.encodeStateAsUpdate
   * @property {function(Y.Doc, Uint8Array):void} Enc.applyUpdate
   * @property {function(Uint8Array):void} Enc.logUpdate
   * @property {function(Uint8Array):{from:Map<number,number>,to:Map<number,number>}} Enc.parseUpdateMeta
   * @property {function(Y.Doc):Uint8Array} Enc.encodeStateVector
   * @property {function(Uint8Array):Uint8Array} Enc.encodeStateVectorFromUpdate
   * @property {string} Enc.updateEventName
   * @property {string} Enc.description
   * @property {function(Uint8Array, Uint8Array):Uint8Array} Enc.diffUpdate
   */

  /**
   * @type {Enc}
   */
  const encV1 = {
    mergeUpdates: mergeUpdates,
    encodeStateAsUpdate: encodeStateAsUpdate,
    applyUpdate: applyUpdate,
    logUpdate: logUpdate,
    parseUpdateMeta: parseUpdateMeta,
    encodeStateVectorFromUpdate: encodeStateVectorFromUpdate,
    encodeStateVector: encodeStateVector,
    updateEventName: 'update',
    description: 'V1',
    diffUpdate: diffUpdate
  };

  /**
   * @type {Enc}
   */
  const encV2 = {
    mergeUpdates: mergeUpdatesV2,
    encodeStateAsUpdate: encodeStateAsUpdateV2,
    applyUpdate: applyUpdateV2,
    logUpdate: logUpdateV2,
    parseUpdateMeta: parseUpdateMetaV2,
    encodeStateVectorFromUpdate: encodeStateVectorFromUpdateV2,
    encodeStateVector: encodeStateVector,
    updateEventName: 'updateV2',
    description: 'V2',
    diffUpdate: diffUpdateV2
  };

  /**
   * @type {Enc}
   */
  const encDoc = {
    mergeUpdates: (updates) => {
      const ydoc = new Doc({ gc: false });
      updates.forEach(update => {
        applyUpdateV2(ydoc, update);
      });
      return encodeStateAsUpdateV2(ydoc)
    },
    encodeStateAsUpdate: encodeStateAsUpdateV2,
    applyUpdate: applyUpdateV2,
    logUpdate: logUpdateV2,
    parseUpdateMeta: parseUpdateMetaV2,
    encodeStateVectorFromUpdate: encodeStateVectorFromUpdateV2,
    encodeStateVector: encodeStateVector,
    updateEventName: 'updateV2',
    description: 'Merge via Y.Doc',
    /**
     * @param {Uint8Array} update
     * @param {Uint8Array} sv
     */
    diffUpdate: (update, sv) => {
      const ydoc = new Doc({ gc: false });
      applyUpdateV2(ydoc, update);
      return encodeStateAsUpdateV2(ydoc, sv)
    }
  };

  const encoders = [encV1, encV2, encDoc];

  /**
   * @param {Array<Y.Doc>} users
   * @param {Enc} enc
   */
  const fromUpdates = (users, enc) => {
    const updates = users.map(user =>
      enc.encodeStateAsUpdate(user)
    );
    const ydoc = new Doc();
    enc.applyUpdate(ydoc, enc.mergeUpdates(updates));
    return ydoc
  };

  /**
   * @param {t.TestCase} tc
   */
  const testMergeUpdates = tc => {
    const { users, array0, array1 } = init$1(tc, { users: 3 });

    array0.insert(0, [1]);
    array1.insert(0, [2]);

    compare$1(users);
    encoders.forEach(enc => {
      const merged = fromUpdates(users, enc);
      compareArrays(array0.toArray(), merged.getArray('array').toArray());
    });
  };

  /**
   * @param {t.TestCase} tc
   */
  const testKeyEncoding = tc => {
    const { users, text0, text1 } = init$1(tc, { users: 2 });

    text0.insert(0, 'a', { italic: true });
    text0.insert(0, 'b');
    text0.insert(0, 'c', { italic: true });

    const update = encodeStateAsUpdateV2(users[0]);
    applyUpdateV2(users[1], update);

    compare$2(text1.toDelta(), [{ insert: 'c', attributes: { italic: true } }, { insert: 'b' }, { insert: 'a', attributes: { italic: true } }]);

    compare$1(users);
  };

  /**
   * @param {Y.Doc} ydoc
   * @param {Array<Uint8Array>} updates - expecting at least 4 updates
   * @param {Enc} enc
   * @param {boolean} hasDeletes
   */
  const checkUpdateCases = (ydoc, updates, enc, hasDeletes) => {
    const cases = [];
    // Case 1: Simple case, simply merge everything
    cases.push(enc.mergeUpdates(updates));

    // Case 2: Overlapping updates
    cases.push(enc.mergeUpdates([
      enc.mergeUpdates(updates.slice(2)),
      enc.mergeUpdates(updates.slice(0, 2))
    ]));

    // Case 3: Overlapping updates
    cases.push(enc.mergeUpdates([
      enc.mergeUpdates(updates.slice(2)),
      enc.mergeUpdates(updates.slice(1, 3)),
      updates[0]
    ]));

    // Case 4: Separated updates (containing skips)
    cases.push(enc.mergeUpdates([
      enc.mergeUpdates([updates[0], updates[2]]),
      enc.mergeUpdates([updates[1], updates[3]]),
      enc.mergeUpdates(updates.slice(4))
    ]));

    // Case 5: overlapping with many duplicates
    cases.push(enc.mergeUpdates(cases));

    // const targetState = enc.encodeStateAsUpdate(ydoc)
    // t.info('Target State: ')
    // enc.logUpdate(targetState)

    cases.forEach((mergedUpdates, i) => {
      // t.info('State Case $' + i + ':')
      // enc.logUpdate(updates)
      const merged = new Doc({ gc: false });
      enc.applyUpdate(merged, mergedUpdates);
      compareArrays(merged.getArray().toArray(), ydoc.getArray().toArray());
      compare$2(enc.encodeStateVector(merged), enc.encodeStateVectorFromUpdate(mergedUpdates));

      if (enc.updateEventName !== 'update') { // @todo should this also work on legacy updates?
        for (let j = 1; j < updates.length; j++) {
          const partMerged = enc.mergeUpdates(updates.slice(j));
          const partMeta = enc.parseUpdateMeta(partMerged);
          const targetSV = encodeStateVectorFromUpdateV2(mergeUpdatesV2(updates.slice(0, j)));
          const diffed = enc.diffUpdate(mergedUpdates, targetSV);
          const diffedMeta = enc.parseUpdateMeta(diffed);
          compare$2(partMeta, diffedMeta);
          {
            // We can'd do the following
            //  - t.compare(diffed, mergedDeletes)
            // because diffed contains the set of all deletes.
            // So we add all deletes from `diffed` to `partDeletes` and compare then
            const decoder = createDecoder(diffed);
            const updateDecoder = new UpdateDecoderV2(decoder);
            readClientsStructRefs(updateDecoder, new Doc());
            const ds = readDeleteSet(updateDecoder);
            const updateEncoder = new UpdateEncoderV2();
            writeVarUint(updateEncoder.restEncoder, 0); // 0 structs
            writeDeleteSet(updateEncoder, ds);
            const deletesUpdate = updateEncoder.toUint8Array();
            const mergedDeletes = mergeUpdatesV2([deletesUpdate, partMerged]);
            if (!hasDeletes || enc !== encDoc) {
              // deletes will almost definitely lead to different encoders because of the mergeStruct feature that is present in encDoc
              compare$2(diffed, mergedDeletes);
            }
          }
        }
      }

      const meta = enc.parseUpdateMeta(mergedUpdates);
      meta.from.forEach((clock, client) => assert(clock === 0));
      meta.to.forEach((clock, client) => {
        const structs = /** @type {Array<Y.Item>} */ (merged.store.clients.get(client));
        const lastStruct = structs[structs.length - 1];
        assert(lastStruct.id.clock + lastStruct.length === clock);
      });
    });
  };

  /**
   * @param {t.TestCase} tc
   */
  const testMergeUpdates1 = tc => {
    encoders.forEach((enc, i) => {
      info(`Using encoder: ${enc.description}`);
      const ydoc = new Doc({ gc: false });
      const updates = /** @type {Array<Uint8Array>} */ ([]);
      ydoc.on(enc.updateEventName, update => { updates.push(update); });

      const array = ydoc.getArray();
      array.insert(0, [1]);
      array.insert(0, [2]);
      array.insert(0, [3]);
      array.insert(0, [4]);

      checkUpdateCases(ydoc, updates, enc, false);
    });
  };

  /**
   * @param {t.TestCase} tc
   */
  const testMergeUpdates2 = tc => {
    encoders.forEach((enc, i) => {
      info(`Using encoder: ${enc.description}`);
      const ydoc = new Doc({ gc: false });
      const updates = /** @type {Array<Uint8Array>} */ ([]);
      ydoc.on(enc.updateEventName, update => { updates.push(update); });

      const array = ydoc.getArray();
      array.insert(0, [1, 2]);
      array.delete(1, 1);
      array.insert(0, [3, 4]);
      array.delete(1, 2);

      checkUpdateCases(ydoc, updates, enc, true);
    });
  };

  /**
   * @param {t.TestCase} tc
   */
  const testMergePendingUpdates = tc => {
    const yDoc = new Doc();
    /**
     * @type {Array<Uint8Array>}
     */
    const serverUpdates = [];
    yDoc.on('update', (update, origin, c) => {
      serverUpdates.splice(serverUpdates.length, 0, update);
    });
    const yText = yDoc.getText('textBlock');
    yText.applyDelta([{ insert: 'r' }]);
    yText.applyDelta([{ insert: 'o' }]);
    yText.applyDelta([{ insert: 'n' }]);
    yText.applyDelta([{ insert: 'e' }]);
    yText.applyDelta([{ insert: 'n' }]);

    const yDoc1 = new Doc();
    applyUpdate(yDoc1, serverUpdates[0]);
    const update1 = encodeStateAsUpdate(yDoc1);

    const yDoc2 = new Doc();
    applyUpdate(yDoc2, update1);
    applyUpdate(yDoc2, serverUpdates[1]);
    const update2 = encodeStateAsUpdate(yDoc2);

    const yDoc3 = new Doc();
    applyUpdate(yDoc3, update2);
    applyUpdate(yDoc3, serverUpdates[3]);
    const update3 = encodeStateAsUpdate(yDoc3);

    const yDoc4 = new Doc();
    applyUpdate(yDoc4, update3);
    applyUpdate(yDoc4, serverUpdates[2]);
    const update4 = encodeStateAsUpdate(yDoc4);

    const yDoc5 = new Doc();
    applyUpdate(yDoc5, update4);
    applyUpdate(yDoc5, serverUpdates[4]);
    // @ts-ignore
    encodeStateAsUpdate(yDoc5); // eslint-disable-line

    const yText5 = yDoc5.getText('textBlock');
    compareStrings(yText5.toString(), 'nenor');
  };

  /**
   * @param {t.TestCase} tc
   */
  const testObfuscateUpdates = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText('text');
    const ymap = ydoc.getMap('map');
    const yarray = ydoc.getArray('array');
    // test ytext
    ytext.applyDelta([{ insert: 'text', attributes: { bold: true } }, { insert: { href: 'supersecreturl' } }]);
    // test ymap
    ymap.set('key', 'secret1');
    ymap.set('key', 'secret2');
    // test yarray with subtype & subdoc
    const subtype = new YXmlElement('secretnodename');
    const subdoc = new Doc({ guid: 'secret' });
    subtype.setAttribute('attr', 'val');
    yarray.insert(0, ['teststring', 42, subtype, subdoc]);
    // obfuscate the content and put it into a new document
    const obfuscatedUpdate = obfuscateUpdate(encodeStateAsUpdate(ydoc));
    const odoc = new Doc();
    applyUpdate(odoc, obfuscatedUpdate);
    const otext = odoc.getText('text');
    const omap = odoc.getMap('map');
    const oarray = odoc.getArray('array');
    // test ytext
    const delta = otext.toDelta();
    assert(delta.length === 2);
    assert(delta[0].insert !== 'text' && delta[0].insert.length === 4);
    assert(length$1(delta[0].attributes) === 1);
    assert(!hasProperty(delta[0].attributes, 'bold'));
    assert(length$1(delta[1]) === 1);
    assert(hasProperty(delta[1], 'insert'));
    // test ymap
    assert(omap.size === 1);
    assert(!omap.has('key'));
    // test yarray with subtype & subdoc
    const result = oarray.toArray();
    assert(result.length === 4);
    assert(result[0] !== 'teststring');
    assert(result[1] !== 42);
    const osubtype = /** @type {Y.XmlElement} */ (result[2]);
    const osubdoc = result[3];
    // test subtype
    assert(osubtype.nodeName !== subtype.nodeName);
    assert(length$1(osubtype.getAttributes()) === 1);
    assert(osubtype.getAttribute('attr') === undefined);
    // test subdoc
    assert(osubdoc.guid !== subdoc.guid);
  };

  var updates = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testKeyEncoding: testKeyEncoding,
    testMergePendingUpdates: testMergePendingUpdates,
    testMergeUpdates: testMergeUpdates,
    testMergeUpdates1: testMergeUpdates1,
    testMergeUpdates2: testMergeUpdates2,
    testObfuscateUpdates: testObfuscateUpdates
  });

  /**
   * @param {Y.Text} ytext
   */
  const checkRelativePositions = ytext => {
    // test if all positions are encoded and restored correctly
    for (let i = 0; i < ytext.length; i++) {
      // for all types of associations..
      for (let assoc = -1; assoc < 2; assoc++) {
        const rpos = createRelativePositionFromTypeIndex(ytext, i, assoc);
        const encodedRpos = encodeRelativePosition(rpos);
        const decodedRpos = decodeRelativePosition(encodedRpos);
        const absPos = /** @type {Y.AbsolutePosition} */ (createAbsolutePositionFromRelativePosition(decodedRpos, /** @type {Y.Doc} */ (ytext.doc)));
        assert(absPos.index === i);
        assert(absPos.assoc === assoc);
      }
    }
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionCase1 = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    ytext.insert(0, '1');
    ytext.insert(0, 'abc');
    ytext.insert(0, 'z');
    ytext.insert(0, 'y');
    ytext.insert(0, 'x');
    checkRelativePositions(ytext);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionCase2 = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    ytext.insert(0, 'abc');
    checkRelativePositions(ytext);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionCase3 = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    ytext.insert(0, 'abc');
    ytext.insert(0, '1');
    ytext.insert(0, 'xyz');
    checkRelativePositions(ytext);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionCase4 = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    ytext.insert(0, '1');
    checkRelativePositions(ytext);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionCase5 = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    ytext.insert(0, '2');
    ytext.insert(0, '1');
    checkRelativePositions(ytext);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionCase6 = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    checkRelativePositions(ytext);
  };

  /**
   * @param {t.TestCase} tc
   */
  const testRelativePositionAssociationDifference = tc => {
    const ydoc = new Doc();
    const ytext = ydoc.getText();
    ytext.insert(0, '2');
    ytext.insert(0, '1');
    const rposRight = createRelativePositionFromTypeIndex(ytext, 1, 0);
    const rposLeft = createRelativePositionFromTypeIndex(ytext, 1, -1);
    ytext.insert(1, 'x');
    const posRight = createAbsolutePositionFromRelativePosition(rposRight, ydoc);
    const posLeft = createAbsolutePositionFromRelativePosition(rposLeft, ydoc);
    assert(posRight != null && posRight.index === 2);
    assert(posLeft != null && posLeft.index === 1);
  };

  var relativePositions = /*#__PURE__*/Object.freeze({
    __proto__: null,
    testRelativePositionAssociationDifference: testRelativePositionAssociationDifference,
    testRelativePositionCase1: testRelativePositionCase1,
    testRelativePositionCase2: testRelativePositionCase2,
    testRelativePositionCase3: testRelativePositionCase3,
    testRelativePositionCase4: testRelativePositionCase4,
    testRelativePositionCase5: testRelativePositionCase5,
    testRelativePositionCase6: testRelativePositionCase6
  });

  /* eslint-env node */

  if (isBrowser) {
    createVConsole(document.body);
  }
  runTests({
    doc, map, array, text, xml, encoding, undoredo, compatibility, snapshot, updates, relativePositions
  }).then(success => {
    /* istanbul ignore next */
    if (isNode) {
      process.exit(success ? 0 : 1);
    }
  });

})();
//# sourceMappingURL=tests.js.map
