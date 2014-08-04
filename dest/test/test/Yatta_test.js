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
    function Test() {
      this.applyRandomOp = __bind(this.applyRandomOp, this);
      this.generateRandomOp = __bind(this.generateRandomOp, this);
      this.generateDeleteOp = __bind(this.generateDeleteOp, this);
      this.generateReplaceOp = __bind(this.generateReplaceOp, this);
      this.generateInsertOp = __bind(this.generateInsertOp, this);
      this.number_of_test_cases_multiplier = 1;
      this.repeat_this = 100 * this.number_of_test_cases_multiplier;
      this.doSomething_amount = 200 * this.number_of_test_cases_multiplier;
      this.number_of_engines = 12 + this.number_of_test_cases_multiplier - 1;
      this.time = 0;
      this.ops = 0;
      this.reinitialize();
    }

    Test.prototype.reinitialize = function() {
      var i, _i, _ref, _results;
      this.users = [];
      this.Connector = Connector_uninitialized(this.users);
      this.users.push(new Yatta(0, this.Connector));
      this.users[0].val('name', "initial");
      _results = [];
      for (i = _i = 1, _ref = this.number_of_engines; 1 <= _ref ? _i < _ref : _i > _ref; i = 1 <= _ref ? ++_i : --_i) {
        _results.push(this.users.push(new Yatta(i, this.Connector)));
      }
      return _results;
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
        length = 1;
        ops1 = this.users[user_num].val('name').deleteText(pos, length);
      }
      return void 0;
    };

    Test.prototype.generateRandomOp = function(user_num) {
      var i, op, op_gen;
      op_gen = [this.generateDeleteOp, this.generateInsertOp, this.generateReplaceOp];
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

    Test.prototype.run = function() {
      var i, j, number_of_created_operations, ops, ops_per_msek, printOpsInExecutionOrder, time_now, times, u, _i, _j, _k, _ref, _ref1, _ref2, _results;
      _results = [];
      for (times = _i = 1, _ref = this.repeat_this; 1 <= _ref ? _i <= _ref : _i >= _ref; times = 1 <= _ref ? ++_i : --_i) {
        this.reinitialize();
        time_now = (new Date).getTime();
        for (i = _j = 1, _ref1 = this.doSomething_amount; 1 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 1 <= _ref1 ? ++_j : --_j) {
          this.doSomething();
        }
        this.flushAll();
        this.time += (new Date()).getTime() - time_now;
        number_of_created_operations = 0;
        for (i = _k = 0, _ref2 = this.users.length; 0 <= _ref2 ? _k < _ref2 : _k > _ref2; i = 0 <= _ref2 ? ++_k : --_k) {
          number_of_created_operations += this.users[i].getConnector().getOpsInExecutionOrder().length;
        }
        this.ops += number_of_created_operations * this.users.length;
        ops_per_msek = Math.floor(this.ops / this.time);
        console.log(("" + times + "/" + this.repeat_this + ": Every collaborator (" + this.users.length + ") applied " + this.number_of_created_operations + " ops in a different order.") + (" Over all we consumed " + this.ops + " operations in " + (this.time / 1000) + " seconds (" + ops_per_msek + " ops/msek)."));
        _results.push((function() {
          var _l, _len, _m, _ref3, _results1;
          _results1 = [];
          for (i = _l = 0, _ref3 = this.users.length - 1; 0 <= _ref3 ? _l < _ref3 : _l > _ref3; i = 0 <= _ref3 ? ++_l : --_l) {
            if (this.users[i].val('name').val() !== this.users[i + 1].val('name').val()) {
              printOpsInExecutionOrder = function(otnumber, otherotnumber) {
                var j, o, ops, s, _len, _len1, _m, _n;
                ops = this.users[otnumber].getConnector().getOpsInExecutionOrder();
                for (_m = 0, _len = ops.length; _m < _len; _m++) {
                  s = ops[_m];
                  console.log(JSON.stringify(s));
                }
                console.log("");
                s = "ops = [";
                for (j = _n = 0, _len1 = ops.length; _n < _len1; j = ++_n) {
                  o = ops[j];
                  if (j !== 0) {
                    s += ", ";
                  }
                  s += "op" + j;
                }
                s += "]";
                console.log(s);
                console.log("@users[@last_user].ot.applyOps ops");
                console.log("expect(@users[@last_user].ot.val('name')).to.equal(\"" + (users[otherotnumber].val('name')) + "\")");
                return ops;
              };
              console.log("");
              console.log("Found an OT Puzzle!");
              console.log("OT states:");
              for (j = _m = 0, _len = users.length; _m < _len; j = ++_m) {
                u = users[j];
                console.log(("OT" + j + ": ") + u.val('name'));
              }
              console.log("\nOT execution order (" + i + "," + (i + 1) + "):");
              printOpsInExecutionOrder(i, i + 1);
              console.log("");
              ops = printOpsInExecutionOrder(i + 1, i);
              _results1.push(console.log(""));
            } else {
              _results1.push(void 0);
            }
          }
          return _results1;
        }).call(this));
      }
      return _results;
    };

    return Test;

  })();

  describe("JsonYatta", function() {
    return it("can handle many engines, many operations, concurrently (random)", function() {
      var yTest;
      yTest = new Test();
      return yTest.run();
    });
  });

}).call(this);
