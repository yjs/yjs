// exported expect, sinon

global.expect = require('expect.js');
global.sinon = require('sinon');
require('../lib/observe-shim.js');
require('./Object.observe');
require('./bugs');
