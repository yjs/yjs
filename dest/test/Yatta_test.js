(function() {
  var Connector_uninitialized, Test, Yatta, chai, expect, should, sinon, sinonChai, _,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  chai = require('chai');

  expect = chai.expect;

  should = chai.should();

  sinon = require('sinon');

  sinonChai = require('sinon-chai');

  _ = require("underscore");

  chai.use(sinonChai);

  Yatta = require("../lib/Frameworks/JsonYatta.coffee");

  Connector_uninitialized = require("../lib/Connectors/TestConnector.coffee");

  Test = (function() {
    function Test(name_suffix) {
      this.name_suffix = name_suffix != null ? name_suffix : "";
      this.applyRandomOp = __bind(this.applyRandomOp, this);
      this.generateRandomOp = __bind(this.generateRandomOp, this);
      this.generateDeleteOp = __bind(this.generateDeleteOp, this);
      this.generateReplaceOp = __bind(this.generateReplaceOp, this);
      this.generateInsertOp = __bind(this.generateInsertOp, this);
      this.number_of_test_cases_multiplier = 1;
      this.repeat_this = 5 * this.number_of_test_cases_multiplier;
      this.doSomething_amount = 1000 * this.number_of_test_cases_multiplier;
      this.number_of_engines = 10 + this.number_of_test_cases_multiplier - 1;
      this.time = 0;
      this.ops = 0;
      this.time_now = 0;
      this.debug = true;
      this.reinitialize();
    }

    Test.prototype.reinitialize = function() {
      var i, _i, _ref;
      this.users = [];
      this.Connector = Connector_uninitialized(this.users);
      for (i = _i = 0, _ref = this.number_of_engines; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        this.users.push(new Yatta(i + this.name_suffix, this.Connector));
      }
      this.users[0].val('name', "i");
      return this.flushAll();
    };

    Test.prototype.getSomeUser = function() {
      var i;
      i = _.random(0, this.users.length - 1);
      return this.users[i];
    };

    Test.prototype.getRandomText = function() {
      var chars, length, nextchar, text;
      chars = "abcdefghijklmnopqrstuvwxyz";
      length = _.random(0, 10);
      nextchar = chars[_.random(0, chars.length - 1)];
      text = "";
      _(length).times(function() {
        return text += nextchar;
      });
      return text;
    };

    Test.prototype.generateInsertOp = function(user_num) {
      var pos;
      pos = _.random(0, this.users[user_num].val('name').val().length - 1);
      this.users[user_num].val('name').insertText(pos, this.getRandomText());
      return null;
    };

    Test.prototype.generateReplaceOp = function(user_num) {
      this.users[user_num].val('name').replaceText(this.getRandomText());
      return null;
    };

    Test.prototype.generateDeleteOp = function(user_num) {
      var length, ops1, pos;
      if (this.users[user_num].val('name').val().length > 0) {
        pos = _.random(0, this.users[user_num].val('name').val().length - 1);
        length = _.random(0, this.users[user_num].val('name').val().length - pos);
        ops1 = this.users[user_num].val('name').deleteText(pos, length);
      }
      return void 0;
    };

    Test.prototype.generateRandomOp = function(user_num) {
      var i, op, op_gen;
      op_gen = [this.generateInsertOp, this.generateDeleteOp, this.generateReplaceOp];
      i = _.random(op_gen.length - 1);
      return op = op_gen[i](user_num);
    };

    Test.prototype.applyRandomOp = function(user_num) {
      var user;
      user = this.users[user_num];
      return user.getConnector().flushOneRandom();
    };

    Test.prototype.doSomething = function() {
      var choice, choices, user_num;
      user_num = _.random(this.number_of_engines - 1);
      choices = [this.applyRandomOp, this.generateRandomOp];
      choice = _.random(choices.length - 1);
      return choices[choice](user_num);
    };

    Test.prototype.flushAll = function() {
      var user, user_number, _i, _len, _ref, _results;
      _ref = this.users;
      _results = [];
      for (user_number = _i = 0, _len = _ref.length; _i < _len; user_number = ++_i) {
        user = _ref[user_number];
        _results.push(user.getConnector().flushAll());
      }
      return _results;
    };

    Test.prototype.compareAll = function(test_number) {
      var i, j, number_of_created_operations, ops, ops_per_msek, printOpsInExecutionOrder, u, _i, _j, _k, _len, _ref, _ref1, _ref2, _results;
      this.flushAll();
      this.time += (new Date()).getTime() - this.time_now;
      number_of_created_operations = 0;
      for (i = _i = 0, _ref = this.users.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        number_of_created_operations += this.users[i].getConnector().getOpsInExecutionOrder().length;
      }
      this.ops += number_of_created_operations * this.users.length;
      ops_per_msek = Math.floor(this.ops / this.time);
      if (test_number != null) {
        console.log(("" + test_number + "/" + this.repeat_this + ": Every collaborator (" + this.users.length + ") applied " + number_of_created_operations + " ops in a different order.") + (" Over all we consumed " + this.ops + " operations in " + (this.time / 1000) + " seconds (" + ops_per_msek + " ops/msek)."));
      }
      _results = [];
      for (i = _j = 0, _ref1 = this.users.length - 1; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
        if (this.debug) {
          if (this.users[i].val('name').val() !== this.users[i + 1].val('name').val()) {
            printOpsInExecutionOrder = (function(_this) {
              return function(otnumber, otherotnumber) {
                var j, o, ops, s, _k, _l, _len, _len1;
                ops = _.filter(_this.users[otnumber].getConnector().getOpsInExecutionOrder(), function(o) {
                  return typeof o.uid.op_name !== 'string' && o.uid.creator !== '_';
                });
                for (j = _k = 0, _len = ops.length; _k < _len; j = ++_k) {
                  s = ops[j];
                  console.log(("op" + j + " = ") + (JSON.stringify(s)));
                }
                console.log("");
                s = "ops = [";
                for (j = _l = 0, _len1 = ops.length; _l < _len1; j = ++_l) {
                  o = ops[j];
                  if (j !== 0) {
                    s += ", ";
                  }
                  s += "op" + j;
                }
                s += "]";
                console.log(s);
                console.log("@test_user.engine.applyOps ops");
                console.log("expect(@test_user.val('name').val()).to.equal(\"" + (_this.users[otherotnumber].val('name').val()) + "\")");
                return ops;
              };
            })(this);
            console.log("");
            console.log("Found an OT Puzzle!");
            console.log("OT states:");
            _ref2 = this.users;
            for (j = _k = 0, _len = _ref2.length; _k < _len; j = ++_k) {
              u = _ref2[j];
              console.log(("OT" + j + ": ") + u.val('name').val());
            }
            console.log("\nOT execution order (" + i + "," + (i + 1) + "):");
            printOpsInExecutionOrder(i, i + 1);
            console.log("");
            ops = printOpsInExecutionOrder(i + 1, i);
            console.log("");
          }
        }
        if (this.users[i].val('name').val() !== this.users[i + 1].val('name').val()) {
          console.log("found error");
        }
        _results.push(expect(this.users[i].val('name').val()).to.equal(this.users[i + 1].val('name').val()));
      }
      return _results;
    };

    Test.prototype.run = function() {
      var i, times, _i, _j, _ref, _ref1, _results;
      console.log('');
      _results = [];
      for (times = _i = 1, _ref = this.repeat_this; 1 <= _ref ? _i <= _ref : _i >= _ref; times = 1 <= _ref ? ++_i : --_i) {
        this.time_now = (new Date).getTime();
        for (i = _j = 1, _ref1 = this.doSomething_amount; 1 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 1 <= _ref1 ? ++_j : --_j) {
          this.doSomething();
        }
        this.compareAll(times);
        this.testHBencoding();
        if (times !== this.repeat_this) {
          _results.push(this.reinitialize());
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Test.prototype.testHBencoding = function() {
      var user;
      user = new Yatta('testuser', Connector_uninitialized([]));
      user.engine.applyOps(this.users[0].HB._encode());
      return expect(user.value.name.val()).to.equal(this.users[0].value.name.val());
    };

    return Test;

  })();

  describe("JsonYatta", function() {
    beforeEach(function(done) {
      this.timeout(50000);
      this.yTest = new Test();
      this.users = this.yTest.users;
      this.test_user = new Yatta(0, Connector_uninitialized([]));
      return done();
    });
    it("has a JsonWrapper", function() {
      var w, y;
      y = this.yTest.getSomeUser().root_element;
      y.val('x', "dtrn", 'immutable');
      y.val('set', {
        x: "x"
      }, 'immutable');
      w = y.value;
      w.x;
      w.set = {
        y: ""
      };
      w.x;
      w.set;
      w.set.x;
      expect(w.x).to.equal("dtrn");
      return expect(w.set.x).to.equal("x");
    });
    it("handles double-late-join", function() {
      var ops1, ops2, test, u1, u2;
      test = new Test("doubble");
      test.run();
      this.yTest.run();
      u1 = test.users[0];
      u2 = this.yTest.users[1];
      ops1 = u1.HB._encode();
      ops2 = u2.HB._encode();
      u1.engine.applyOps(ops2);
      u2.engine.applyOps(ops1);
      return expect(u2.value.name.val()).to.equal(u2.value.name.val());
    });
    it("can handle creaton of complex json", function() {
      this.yTest.getSomeUser().val('x', {
        'a': 'b'
      });
      this.yTest.getSomeUser().val('a', {
        'a': {
          q: "dtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt"
        }
      });
      this.yTest.getSomeUser().val('b', {
        'a': {}
      });
      this.yTest.getSomeUser().val('c', {
        'a': 'c'
      });
      this.yTest.getSomeUser().val('c', {
        'a': 'b'
      });
      this.yTest.compareAll();
      this.yTest.getSomeUser().value.a.a.q.insertText(0, 'AAA');
      this.yTest.compareAll();
      return expect(this.yTest.getSomeUser().value.a.a.q.val()).to.equal("AAAdtrndtrtdrntdrnrtdnrtdnrtdnrtdnrdnrdt");
    });
    it("handles some immutable tests", function() {
      this.yTest.getSomeUser().val('string', "text", "immutable");
      this.yTest.getSomeUser().val('number', 4, "immutable");
      this.yTest.getSomeUser().val('object', {
        q: "rr"
      }, "immutable");
      this.yTest.compareAll();
      expect(this.yTest.getSomeUser().val('string')).to.equal("text");
      expect(this.yTest.getSomeUser().val('number')).to.equal(4);
      return expect(this.yTest.getSomeUser().val('object').val('q')).to.equal("rr");
    });
    it("can handle many engines, many operations, concurrently (random)", function() {
      return this.yTest.run();
    });
    return it("converges t1", function() {
      var op0, op1, op2, op3, op4, op5, op6, op7, op8, ops;
      op0 = {
        "type": "Delimiter",
        "uid": {
          "creator": 0,
          "op_number": 0
        },
        "next": {
          "creator": 0,
          "op_number": 1
        }
      };
      op1 = {
        "type": "Delimiter",
        "uid": {
          "creator": 0,
          "op_number": 1
        },
        "prev": {
          "creator": 0,
          "op_number": 0
        }
      };
      op2 = {
        "type": "Word",
        "uid": {
          "creator": 0,
          "op_number": 2
        },
        "beginning": {
          "creator": 0,
          "op_number": 0
        },
        "end": {
          "creator": 0,
          "op_number": 1
        }
      };
      op3 = {
        "type": "AddName",
        "uid": {
          "creator": 0,
          "op_number": 3
        },
        "map_manager": {
          "creator": "_",
          "op_number": "_"
        },
        "name": "name"
      };
      op4 = {
        "type": "Replaceable",
        "content": {
          "creator": 0,
          "op_number": 2
        },
        "ReplaceManager": {
          "creator": "_",
          "op_number": "___RM_name"
        },
        "prev": {
          "creator": "_",
          "op_number": "___RM_name_beginning"
        },
        "next": {
          "creator": "_",
          "op_number": "___RM_name_end"
        },
        "uid": {
          "creator": 0,
          "op_number": 4
        }
      };
      op5 = {
        "type": "TextInsert",
        "content": "u",
        "uid": {
          "creator": 1,
          "op_number": 2
        },
        "prev": {
          "creator": 1,
          "op_number": 0
        },
        "next": {
          "creator": 1,
          "op_number": 1
        }
      };
      op6 = {
        "type": "TextInsert",
        "content": "w",
        "uid": {
          "creator": 2,
          "op_number": 0
        },
        "prev": {
          "creator": 0,
          "op_number": 0
        },
        "next": {
          "creator": 0,
          "op_number": 1
        }
      };
      op7 = {
        "type": "TextInsert",
        "content": "d",
        "uid": {
          "creator": 1,
          "op_number": 0
        },
        "prev": {
          "creator": 0,
          "op_number": 0
        },
        "next": {
          "creator": 2,
          "op_number": 0
        }
      };
      op8 = {
        "type": "TextInsert",
        "content": "a",
        "uid": {
          "creator": 1,
          "op_number": 1
        },
        "prev": {
          "creator": 1,
          "op_number": 0
        },
        "next": {
          "creator": 2,
          "op_number": 0
        }
      };
      ops = [op0, op1, op2, op3, op4, op5, op6, op7, op8];
      this.test_user.engine.applyOps(ops);
      return expect(this.test_user.val('name').val()).to.equal("duaw");
    });
  });

}).call(this);
