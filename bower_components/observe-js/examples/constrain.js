/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

(function(global) {

  /* This is a very simple version of the QuickPlan algorithm for solving
  * mutli-variable contraints. (http://www.cs.utk.edu/~bvz/quickplan.html)
  * The implementation varies from the standard described approach in a few ways:
  *
  * -There is no notion of constraint heirarchy. Here, all constraints are
  *  considered REQUIRED.
  *
  * -There is no "improvement" phase where rejected constraints are added back
  *  in an attempt to find a "better solution"
  *
  * -In place of the above two, a heuristic is used to pick the "weakest"
  *  free constraint to remove. A function, "stayFunc" is passed to the
  *  Variable class and is expected to return a priority value for the variable
  *  0 being highest and 1, 2, 3, etc... being lower.
  *
  * I suspect these variations result in there being no guarentee of choosing the
  * optimal solution, but it does seem to work well for the examples I've tested.
  * Note also that the DeltaBlue planner can be used in a similar pattern,
  * but it only supports single variable assignment.
  *
  * Note also that this is hacky and thrown together. Don't expect it to work
  * much at all =-).
  */

  function Map() {
    this.map_ = new global.Map;
    this.keys_ = [];
  }

  Map.prototype = {
    get: function(key) {
      return this.map_.get(key);
    },

    set: function(key, value) {
      if (!this.map_.has(key))
        this.keys_.push(key);
      return this.map_.set(key, value);
    },

    has: function(key) {
      return this.map_.has(key);
    },

    delete: function(key) {
      this.keys_.splice(this.keys_.indexOf(key), 1);
      this.map_.delete(key);
    },

    keys: function() {
      return this.keys_.slice();
    }
  }

  function Variable(property, stayFunc) {
    this.property = property;
    this.stayFunc = stayFunc || function() {
      //console.log("Warning: using default stay func");
      return 0;
    };
    this.methods = [];
  };

  Variable.prototype = {
    addMethod: function(method) {
      this.methods.push(method);
    },

    removeMethod: function(method) {
      this.methods.splice(this.methods.indexOf(method), 1);
    },

    isFree: function() {
      return this.methods.length <= 1;
    },

    get stayPriority() {
      return this.stayFunc(this.property);
    }
  }

  function Method(opts) {
    opts = opts || {};
    this.name = opts.name || 'function() { ... }';
    this.outputs = opts.outputs || [];
    this.f = opts.f || function() {
      console.log('Warning: using default execution function');
    };
  };

  Method.prototype = {
    planned_: false,
    variables_: [],

    set planned(planned) {
      this.planned_ = planned;

      if (this.planned_) {
        if (this.variables_) {
          // Remove this method from all variables.
          this.variables_.forEach(function(variable) {
            variable.removeMethod(this);
          }, this);
        }

        this.variables_ = null;
      } else {
        this.variables_ = null;

        // Get & add this method to all variables.
        if (this.constraint && this.constraint.planner) {
          this.variables_ = this.outputs.map(function(output) {
            var variable = this.constraint.planner.getVariable(output);
            variable.addMethod(this);
            return variable;
          }, this);
        }
      }
    },

    get planned() {
      return this.planned_;
    },

    isFree: function() {
      // Return true only if all variables are free.
      var variables = this.variables_;
      for (var i = variables.length - 1; i >= 0; i--) {
        if (!variables[i].isFree())
          return false;
      }
      return true;
    },

    weakerOf: function(other) {
      if (!other) {
        return this;
      }

      // Prefer a method that assigns to fewer variables.
      if (this.variables_.length != other.variables_.length) {
        return this.variables_.length < other.variables_.length ? this : other;
      }

      // Note: A weaker stay priority is a higher number.
      return this.getStayPriority() >= other.getStayPriority() ? this : other;
    },

    getStayPriority: function() {
      // This returns the strongest (lowest) stay priority of this method's
      // output variables.
      return retval = this.variables_.reduce(function(min, variable) {
        return Math.min(min, variable.stayPriority);
      }, Infinity);
    },

    execute: function() {
      console.log(JSON.stringify(this.outputs) + ' <= ' + this.name);
      this.f();
    }
  };

  function Constraint(methods, when) {
    this.methods = methods;
    this.when = when;
  };

  Constraint.prototype = {
    executionMethod_: null,

    set executionMethod(executionMethod) {
      this.executionMethod_ = executionMethod;
      var planned = !!this.executionMethod_;

      this.methods.forEach(function(method) {
        method.constraint = this;
        method.planned = planned;
      }, this);
    },

    get executionMethod() {
      return this.executionMethod_;
    },

    getWeakestFreeMethod: function() {
      var methods = this.methods;
      var weakest = null;
      for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        if (method.isFree())
          weakest = method.weakerOf(weakest);
      }
      return weakest;
    },

    execute: function() {
      this.executionMethod.execute();
    }
  };

  function Planner(object) {
    this.object = object;
    this.properties = {};
    this.priority = []
    var self = this;

    this.stayFunc = function(property) {
      if (self.object[property] === undefined)
        return Infinity;
      var index = self.priority.indexOf(property);
      return index >= 0 ? index : Infinity;
    }

    Object.observe(this.object, internalCallback);
  };

  Planner.prototype = {
    plan_: null,

    deliverChanged: function(changeRecords) {
      var needsResolve = false;

      changeRecords.forEach(function(change) {
        var property = change.name;
        if (!(property in this.properties))
          return;

        var index = this.priority.indexOf(property);
        if (index >= 0)
          this.priority.splice(this.priority.indexOf(property), 1);

        this.priority.unshift(property);
        needsResolve = true;
      }, this);

      if (!needsResolve)
        return;

      console.log('Resolving: ' + Object.getPrototypeOf(changeRecords[0].object).constructor.name);

      Object.unobserve(this.object, internalCallback);
      this.execute();
      console.log('...Done: ' + JSON.stringify(this.object));
      Object.observe(this.object, internalCallback);
    },

    addConstraint: function(methods) {
      methods.forEach(function(method) {
        method.outputs.forEach(function(output) {
          this.properties[output] = true;
        }, this);
      }, this);

      var constraint = new Constraint(methods);

      this.constraints = this.constraints || [];
      if (this.constraints.indexOf(constraint) < 0) {
        this.plan_ = null;
        this.constraints.push(constraint);
      }
      return constraint;
    },

    removeConstraint: function(constraint) {
      var index = this.constraints.indexOf(constraint);
      if (index >= 0) {
        this.plan_ = null;
        var removed = this.constraints.splice(index, 1)[0];
      }
      return constraint;
    },

    getVariable: function(property) {
      var index = this.properties_.indexOf(property);
      if (index >= 0) {
        return this.variables_[index];
      }

      this.properties_.push(property);
      var variable = new Variable(property, this.stayFunc);
      this.variables_.push(variable);
      return variable;
    },

    get plan() {
      if (this.plan_) {
        return this.plan_;
      }

      this.plan_ = [];
      this.properties_ = [];
      this.variables_ = [];

      var unplanned = this.constraints.filter(function(constraint) {
        // Note: setting executionMethod must take place after setting planner.
        if (constraint.when && !constraint.when()) {
          // Conditional and currenty disabled => not in use.
          constraint.planner = null;
          constraint.executionMethod = null;
          return false;
        } else {
          // In use.
          constraint.planner = this;
          constraint.executionMethod = null;
          return true;
        }
      }, this);

      while (unplanned.length > 0) {
        var method = this.chooseNextMethod(unplanned);
        if (!method) {
          throw "Cycle detected";
        }

        var nextConstraint = method.constraint;
        unplanned.splice(unplanned.indexOf(nextConstraint), 1);
        this.plan_.unshift(nextConstraint);
        nextConstraint.executionMethod = method;
      }

      return this.plan_;
    },

    chooseNextMethod: function(constraints) {
      var weakest = null;
      for (var i = 0; i < constraints.length; i++) {
        var current = constraints[i].getWeakestFreeMethod();
        weakest = current ? current.weakerOf(weakest) : weakest;
      }
      return weakest;
    },

    run: function() {
      this.execute();
    },

    execute: function() {
      this.plan_ = null;
      this.executing = true;
      this.plan.forEach(function(constraint) {
        constraint.execute();
      });
      this.executing = false;
    }
  }

  var planners = new WeakMap;

  function internalCallback(changeRecords) {
    var changeMap = new Map;

    changeRecords.forEach(function(change) {
      if (!planners.has(change.object))
        return;

      var changes = changeMap.get(change.object);
      if (!changes) {
        changeMap.set(change.object, [change]);
        return;
      }

      changes.push(change);
    });

    changeMap.keys().forEach(function(object) {
      planners.get(object).deliverChanged(changeMap.get(object));
    });
  }

  // Register callback to assign delivery order.
  var register = {};
  Object.observe(register, internalCallback);
  Object.unobserve(register, internalCallback);

  global.constrain = function(obj, methodFunctions) {
    var planner = planners.get(obj);
    if (!planner) {
      planner = new Planner(obj);
      planners.set(obj, planner);
    }

    planner.addConstraint(Object.keys(methodFunctions).map(function(property) {
      var func = methodFunctions[property];

      return new Method({
        name: func.toString(),
        outputs: [ property ],
        f: function() { obj[property] = func.apply(obj); }
      });
    }));
  }
})(this);
