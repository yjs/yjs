// Copyright 2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(global) {

  "use strict";

  function ArraySet() {
    this.entries = [];
  }

  ArraySet.prototype = {
    add: function(key) {
      if (this.entries.indexOf(key) >= 0)
        return;

      this.entries.push(key);
    },

    delete: function(key) {
      var i = this.entries.indexOf(key);
      if (i < 0)
        return;

      this.entries.splice(i, 1);
    },

    first: function() {
      return this.entries[0];
    },

    get size() {
      return this.entries.length;
    }
  };

  function UIDSet() {
    this.entries = {};
    this.size = 0;
  }

  UIDSet.prototype = {
    add: function(key) {
      if (this.entries[key.__UID__] !== undefined)
        return;

      this.entries[key.__UID__] = key;
      this.size++;
    },

    delete: function(key) {
      if (this.entries[key.__UID__] === undefined)
        return;

      this.entries[key.__UID__] = undefined;
      this.size--;
    }
  };

  function Heap(scoreFunction, populate) {
    this.scoreFunction = scoreFunction;
    this.content = populate || [];
    if (this.content.length)
      this.build();
  }

  Heap.prototype = {
    get size() {
      return this.content.length;
    },

    build: function() {
      var lastNonLeaf = Math.floor(this.content.length / 2) - 1;
      for (var i = lastNonLeaf; i >= 0; i--)
        this.sinkDown(i);
    },

    push: function(element) {
      this.content.push(element);
      this.bubbleUp(this.content.length - 1);
    },

    pop: function() {
      var result = this.content[0];
      var end = this.content.pop();
      if (this.content.length) {
        this.content[0] = end;
        this.sinkDown(0);
      }
      return result;
    },

    delete: function(element) {
      var len = this.content.length;
      for (var i = 0; i < len; i++) {
        if (this.content[i] == element) {
          var end = this.content.pop();
          if (i != len - 1) {
            this.content[i] = end;
            if (this.scoreFunction(end) < this.scoreFunction(node)) this.bubbleUp(i);
            else this.sinkDown(i);
          }
          return;
        }
      }
    },

    bubbleUp: function(n) {
      var element = this.content[n];
      while (n > 0) {
        var parentN = Math.floor((n + 1) / 2) - 1,
        parent = this.content[parentN];

        if (this.scoreFunction(element) <= this.scoreFunction(parent))
          break;

        this.content[parentN] = element;
        this.content[n] = parent;
        n = parentN;
      }
    },

    sinkDown: function(n) {
      var length = this.content.length,
      element = this.content[n],
      elemScore = this.scoreFunction(element);

      do {
        var child2N = (n + 1) * 2
        var child1N = child2N - 1;

        var swap = null;
        var swapScore = elemScore;

        if (child1N < length) {
          var child1 = this.content[child1N],
          child1Score = this.scoreFunction(child1);
          if (child1Score > elemScore) {
            swap = child1N;
            swapScore = child1Score;
          }
        }

        if (child2N < length) {
          var child2 = this.content[child2N],
          child2Score = this.scoreFunction(child2);
          if (child2Score > swapScore)
            swap = child2N;
        }

        if (swap != null) {
          this.content[n] = this.content[swap];
          this.content[swap] = element;
          n = swap;
        }
      } while (swap != null);
    }
  };

  function Variable(stayFunc) {
    this.stayFunc = stayFunc;
    this.methods = new ArraySet;
  };

  Variable.prototype = {
    freeMethod: function() {
      return this.methods.first();
    }
  }

  function Method(constraint, variable) {
    this.constraint = constraint;
    this.variable = variable;
  };

  function Constraint(planner) {
    this.planner = planner;
    this.methods = [];
  };

  Constraint.prototype = {
    addMethod: function(variable) {
      var method = new Method(this, variable);
      this.methods.push(method);
      method.__UID__ = this.planner.methodUIDCounter++;
      return method;
    },

    reset: function() {
      this.methods.forEach(function(method) {
        method.variable.methods.add(method);
      });
    },

    remove: function() {
      this.methods.forEach(function(method) {
        method.variable.methods.delete(method);
      });
    }
  };

  function Planner() {
    this.variables = [];
    this.constraints = [];
    this.variableUIDCounter = 1;
    this.methodUIDCounter = 1;
  };

  Planner.prototype = {
    addVariable: function(stayFunc) {
      var variable = new Variable(stayFunc);
      variable.__UID__ = this.variableUIDCounter++;
      this.variables.push(variable);
      return variable;
    },

    addConstraint: function() {
      var constraint = new Constraint(this);
      this.constraints.push(constraint);
      return constraint;
    },

    removeConstraint: function(constraint) {
      var index = this.constraints.indexOf(constraint);
      if (index < 0)
        return;

      constraint.remove();
      this.constraints.splice(index, 1);

      this.constraints.forEach(function(constraint) {
        constraint.reset();
      });

      this.variables = this.variables.filter(function(variable) {
        return variable.methods.size;
      });
    },

    getPlan: function() {
      this.variables.forEach(function(variable) {
        variable.priority = variable.stayFunc();
      });

      this.constraints.forEach(function(constraint) {
        constraint.reset();
      });

      var methods = [];
      var free = [];
      var overconstrained = new UIDSet;

      this.variables.forEach(function(variable) {
        var methodCount = variable.methods.size;

        if (methodCount > 1)
          overconstrained.add(variable);
        else if (methodCount == 1)
          free.push(variable);
      });

      free = new Heap(function(variable) {
        return variable.priority;
      }, free);

      while (free.size) {
        var lowest;
        do {
          lowest = free.pop();
        } while (free.size && !lowest.methods.size);

        if (!lowest.methods.size)
          break;

        var method = lowest.freeMethod();
        var constraint = method.constraint;

        constraint.remove();
        constraint.methods.forEach(function(method) {
          var variable = method.variable;
          if (variable.methods.size == 1) {
            overconstrained.delete(variable);
            free.push(variable);
          }
        });

        methods.push(method);
      }

      if (overconstrained.size)
        return undefined;

      return methods.reverse();
    }
  }

  global.Planner = Planner;
})(this);
