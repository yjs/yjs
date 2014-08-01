(function() {
  var Connector_uninitialized, Yatta, chai, expect, should, sinon, sinonChai, _;

  chai = require('chai');

  expect = chai.expect;

  should = chai.should();

  sinon = require('sinon');

  sinonChai = require('sinon-chai');

  _ = require("underscore");

  chai.use(sinonChai);

  Yatta = require("../lib/Frameworks/JsonYatta.coffee");

  Connector_uninitialized = require("../lib/Connectors/TestConnector.coffee");

  describe("JsonYatta", function() {
    beforeEach(function(done) {
      var i, _i, _ref;
      this.last_user = 10;
      this.users = [];
      this.Connector = Connector_uninitialized(this.users);
      for (i = _i = 0, _ref = this.last_user + 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
        this.users.push(new Yatta(i, this.Connector));
      }
      return done();
    });
    return it("can handle many engines, many operations, concurrently (random)", function() {
      var Connector, applyRandomOp, doSomething, doSomething_amount, found_error, generateDeleteOp, generateInsertOp, generateRandomOp, generateReplaceOp, i, j, number_of_created_operations, number_of_engines, number_of_test_cases_multiplier, ops, ops_per_msek, printOpsInExecutionOrder, repeat_this, time_now, times, u, user, user_number, users, _i, _j, _k, _l, _len, _m, _ref, _results;
      number_of_test_cases_multiplier = 1;
      repeat_this = 1 * number_of_test_cases_multiplier;
      doSomething_amount = 200 * number_of_test_cases_multiplier;
      number_of_engines = 12 + number_of_test_cases_multiplier - 1;
      this.time = 0;
      this.ops = 0;
      users = [];
      generateInsertOp = function(user_num) {
        var chars, length, nextchar, pos, text;
        chars = "1234567890";
        pos = _.random(0, users[user_num].val('name').length - 1);
        length = 1;
        nextchar = chars[_.random(0, chars.length - 1)];
        text = "";
        _(length).times(function() {
          return text += nextchar;
        });
        users[user_num].val('name').insertText(pos, text);
        return null;
      };
      generateReplaceOp = function(user_num) {
        var chars, length, nextchar, text;
        chars = "abcdefghijklmnopqrstuvwxyz";
        length = _.random(0, 10);
        nextchar = chars[_.random(0, chars.length - 1)];
        text = "";
        _(length).times(function() {
          return text += nextchar;
        });
        return users[user_num].val('name').replaceText(text);
      };
      generateDeleteOp = function(user_num) {
        var length, ops1, pos;
        if (users[user_num].val('name').val().length > 0) {
          pos = _.random(0, users[user_num].val('name').val().length - 1);
          length = 1;
          ops1 = users[user_num].val('name').deleteText(pos, length);
        }
        return void 0;
      };
      generateRandomOp = function(user_num) {
        var i, op, op_gen;
        op_gen = [generateDeleteOp, generateInsertOp, generateReplaceOp];
        i = _.random(op_gen.length - 1);
        return op = op_gen[i](user_num);
      };
      applyRandomOp = function(user_num) {
        var user;
        user = users[user_num];
        return user.getConnector().flushOneRandom();
      };
      doSomething = (function() {
        return function() {
          var choice, choices, user_num;
          user_num = _.random(number_of_engines - 1);
          choices = [applyRandomOp, generateRandomOp];
          choice = _.random(choices.length - 1);
          return choices[choice](user_num);
        };
      })();
      console.log("");
      _results = [];
      for (times = _i = 1; 1 <= repeat_this ? _i <= repeat_this : _i >= repeat_this; times = 1 <= repeat_this ? ++_i : --_i) {
        users = [];
        Connector = Connector_uninitialized(users);
        users.push(new Yatta(0, Connector));
        users[0].val('name', "initial");
        for (i = _j = 1; 1 <= number_of_engines ? _j < number_of_engines : _j > number_of_engines; i = 1 <= number_of_engines ? ++_j : --_j) {
          users.push(new Yatta(i, Connector));
        }
        found_error = false;
        time_now = (new Date).getTime();
        for (i = _k = 1; 1 <= doSomething_amount ? _k <= doSomething_amount : _k >= doSomething_amount; i = 1 <= doSomething_amount ? ++_k : --_k) {
          doSomething();
        }
        for (user_number = _l = 0, _len = users.length; _l < _len; user_number = ++_l) {
          user = users[user_number];
          user.getConnector().flushAll();
        }
        this.time += (new Date()).getTime() - time_now;
        number_of_created_operations = 0;
        for (i = _m = 0, _ref = users.length; 0 <= _ref ? _m < _ref : _m > _ref; i = 0 <= _ref ? ++_m : --_m) {
          number_of_created_operations += users[i].getConnector().getOpsInExecutionOrder().length;
        }
        this.ops += number_of_created_operations * users.length;
        ops_per_msek = Math.floor(this.ops / this.time);
        console.log(("" + times + "/" + repeat_this + ": Every collaborator (" + users.length + ") applied " + number_of_created_operations + " ops in a different order.") + (" Over all we consumed " + this.ops + " operations in " + (this.time / 1000) + " seconds (" + ops_per_msek + " ops/msek)."));
        console.log(users[0].val('name').val());
        _results.push((function() {
          var _len1, _n, _o, _ref1, _results1;
          _results1 = [];
          for (i = _n = 0, _ref1 = users.length - 1; 0 <= _ref1 ? _n < _ref1 : _n > _ref1; i = 0 <= _ref1 ? ++_n : --_n) {
            if (users[i].val('name').val() !== users[i + 1].val('name').val()) {
              printOpsInExecutionOrder = function(otnumber, otherotnumber) {
                var j, o, ops, s, _len1, _len2, _o, _p;
                ops = users[otnumber].getConnector().getOpsInExecutionOrder();
                for (_o = 0, _len1 = ops.length; _o < _len1; _o++) {
                  s = ops[_o];
                  console.log(JSON.stringify(s));
                }
                console.log("");
                s = "ops = [";
                for (j = _p = 0, _len2 = ops.length; _p < _len2; j = ++_p) {
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
              for (j = _o = 0, _len1 = users.length; _o < _len1; j = ++_o) {
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
        })());
      }
      return _results;
    });
  });

}).call(this);
