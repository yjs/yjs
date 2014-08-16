(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = function(HB) {
  var Delete, Delimiter, ImmutableObject, Insert, Operation, execution_listener, parser;
  parser = {};
  execution_listener = [];
  Operation = (function() {
    function Operation(uid) {
      if (uid == null) {
        uid = HB.getNextOperationIdentifier();
      }
      this.creator = uid['creator'], this.op_number = uid['op_number'];
    }

    Operation.prototype.on = function(event, f) {
      var _base;
      if (this.event_listeners == null) {
        this.event_listeners = {};
      }
      if ((_base = this.event_listeners)[event] == null) {
        _base[event] = [];
      }
      return this.event_listeners[event].push(f);
    };

    Operation.prototype.callEvent = function(event, args) {
      var f, _i, _len, _ref, _ref1, _results;
      if (((_ref = this.event_listeners) != null ? _ref[event] : void 0) != null) {
        _ref1 = this.event_listeners[event];
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          f = _ref1[_i];
          _results.push(f.call(this, event, args));
        }
        return _results;
      }
    };

    Operation.prototype.setParent = function(o) {
      return this.parent = o;
    };

    Operation.prototype.getParent = function() {
      return this.parent;
    };

    Operation.prototype.getUid = function() {
      return {
        'creator': this.creator,
        'op_number': this.op_number
      };
    };

    Operation.prototype.execute = function() {
      var l, _i, _len;
      this.is_executed = true;
      for (_i = 0, _len = execution_listener.length; _i < _len; _i++) {
        l = execution_listener[_i];
        l(this._encode());
      }
      return this;
    };

    Operation.prototype.saveOperation = function(name, op) {
      if ((op != null ? op.execute : void 0) != null) {
        return this[name] = op;
      } else if (op != null) {
        if (this.unchecked == null) {
          this.unchecked = {};
        }
        return this.unchecked[name] = op;
      }
    };

    Operation.prototype.validateSavedOperations = function() {
      var name, op, op_uid, success, uninstantiated, _ref;
      uninstantiated = {};
      success = this;
      _ref = this.unchecked;
      for (name in _ref) {
        op_uid = _ref[name];
        op = HB.getOperation(op_uid);
        if (op) {
          this[name] = op;
        } else {
          uninstantiated[name] = op_uid;
          success = false;
        }
      }
      delete this.unchecked;
      if (!success) {
        this.unchecked = uninstantiated;
      }
      return success;
    };

    return Operation;

  })();
  Delete = (function(_super) {
    __extends(Delete, _super);

    function Delete(uid, deletes) {
      this.saveOperation('deletes', deletes);
      Delete.__super__.constructor.call(this, uid);
    }

    Delete.prototype._encode = function() {
      return {
        'type': "Delete",
        'uid': this.getUid(),
        'deletes': this.deletes.getUid()
      };
    };

    Delete.prototype.execute = function() {
      if (this.validateSavedOperations()) {
        this.deletes.applyDelete(this);
        return Delete.__super__.execute.apply(this, arguments);
      } else {
        return false;
      }
    };

    return Delete;

  })(Operation);
  parser['Delete'] = function(o) {
    var deletes_uid, uid;
    uid = o['uid'], deletes_uid = o['deletes'];
    return new Delete(uid, deletes_uid);
  };
  Insert = (function(_super) {
    __extends(Insert, _super);

    function Insert(uid, prev_cl, next_cl, origin) {
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      if (origin != null) {
        this.saveOperation('origin', origin);
      } else {
        this.saveOperation('origin', prev_cl);
      }
      Insert.__super__.constructor.call(this, uid);
    }

    Insert.prototype.applyDelete = function(o) {
      if (this.deleted_by == null) {
        this.deleted_by = [];
      }
      this.deleted_by.push(o);
      if ((this.parent != null) && this.deleted_by.length === 1) {
        return this.parent.callEvent("delete", this);
      }
    };

    Insert.prototype.isDeleted = function() {
      var _ref;
      return ((_ref = this.deleted_by) != null ? _ref.length : void 0) > 0;
    };

    Insert.prototype.getDistanceToOrigin = function() {
      var d, o;
      d = 0;
      o = this.prev_cl;
      while (true) {
        if (this.origin === o) {
          break;
        }
        d++;
        if (this === this.prev_cl) {
          throw new Error("this should not happen ;) ");
        }
        o = o.prev_cl;
      }
      return d;
    };

    Insert.prototype.update_sl = function() {
      var o;
      o = this.prev_cl;
      ({
        update: function(dest_cl, dest_sl) {
          var _results;
          _results = [];
          while (true) {
            if (o.isDeleted()) {
              _results.push(o = o[dest_cl]);
            } else {
              this[dest_sl] = o;
              break;
            }
          }
          return _results;
        }
      });
      update("prev_cl", "prev_sl");
      return update("next_cl", "prev_sl");
    };

    Insert.prototype.execute = function() {
      var distance_to_origin, i, o, parent, _ref, _ref1, _ref2;
      if (this.is_executed != null) {
        return this;
      }
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (((_ref = this.prev_cl) != null ? _ref.validateSavedOperations() : void 0) && ((_ref1 = this.next_cl) != null ? _ref1.validateSavedOperations() : void 0) && this.prev_cl.next_cl !== this) {
          distance_to_origin = 0;
          o = this.prev_cl.next_cl;
          i = 0;
          while (true) {
            if (o == null) {
              console.log(JSON.stringify(this.prev_cl.getUid()));
              console.log(JSON.stringify(this.next_cl.getUid()));
            }
            if (o !== this.next_cl) {
              if (o.getDistanceToOrigin() === i) {
                if (o.creator < this.creator) {
                  this.prev_cl = o;
                  distance_to_origin = i + 1;
                } else {

                }
              } else if (o.getDistanceToOrigin() < i) {
                if (i - distance_to_origin <= o.getDistanceToOrigin()) {
                  this.prev_cl = o;
                  distance_to_origin = i + 1;
                } else {

                }
              } else {
                break;
              }
              i++;
              o = o.next_cl;
            } else {
              break;
            }
          }
          this.next_cl = this.prev_cl.next_cl;
          this.prev_cl.next_cl = this;
          this.next_cl.prev_cl = this;
        }
        parent = (_ref2 = this.prev_cl) != null ? _ref2.getParent() : void 0;
        if (parent != null) {
          this.setParent(parent);
          this.parent.callEvent("insert", this);
        }
        return Insert.__super__.execute.apply(this, arguments);
      }
    };

    Insert.prototype.getPosition = function() {
      var position, prev;
      position = 0;
      prev = this.prev_cl;
      while (true) {
        if (prev instanceof Delimiter) {
          break;
        }
        if ((prev.isDeleted != null) && !prev.isDeleted()) {
          position++;
        }
        prev = prev.prev_cl;
      }
      return position;
    };

    return Insert;

  })(Operation);
  ImmutableObject = (function(_super) {
    __extends(ImmutableObject, _super);

    function ImmutableObject(uid, content, prev, next, origin) {
      this.content = content;
      ImmutableObject.__super__.constructor.call(this, uid, prev, next, origin);
    }

    ImmutableObject.prototype.val = function() {
      return this.content;
    };

    ImmutableObject.prototype._encode = function() {
      var json;
      json = {
        'type': "ImmutableObject",
        'uid': this.getUid(),
        'content': this.content
      };
      if (this.prev_cl != null) {
        json['prev'] = this.prev_cl.getUid();
      }
      if (this.next_cl != null) {
        json['next'] = this.next_cl.getUid();
      }
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return ImmutableObject;

  })(Insert);
  parser['ImmutableObject'] = function(json) {
    var content, next, origin, prev, uid;
    uid = json['uid'], content = json['content'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new ImmutableObject(uid, content, prev, next, origin);
  };
  Delimiter = (function(_super) {
    __extends(Delimiter, _super);

    function Delimiter(uid, prev_cl, next_cl, origin) {
      this.saveOperation('prev_cl', prev_cl);
      this.saveOperation('next_cl', next_cl);
      this.saveOperation('origin', prev_cl);
      Delimiter.__super__.constructor.call(this, uid);
    }

    Delimiter.prototype.isDeleted = function() {
      return false;
    };

    Delimiter.prototype.execute = function() {
      var _ref, _ref1;
      if (((_ref = this.unchecked) != null ? _ref['next_cl'] : void 0) != null) {
        return Delimiter.__super__.execute.apply(this, arguments);
      } else if ((_ref1 = this.unchecked) != null ? _ref1['prev_cl'] : void 0) {
        if (this.validateSavedOperations()) {
          if (this.prev_cl.next_cl != null) {
            throw new Error("Probably duplicated operations");
          }
          this.prev_cl.next_cl = this;
          delete this.prev_cl.unchecked.next_cl;
          return Delimiter.__super__.execute.apply(this, arguments);
        } else {
          return false;
        }
      } else if ((this.prev_cl != null) && (this.prev_cl.next_cl == null)) {
        delete this.prev_cl.unchecked.next_cl;
        return this.prev_cl.next_cl = this;
      } else if ((this.prev_cl != null) || (this.next_cl != null)) {
        return Delimiter.__super__.execute.apply(this, arguments);
      } else {
        throw new Error("Delimiter is unsufficient defined!");
      }
    };

    Delimiter.prototype._encode = function() {
      var _ref, _ref1;
      return {
        'type': "Delimiter",
        'uid': this.getUid(),
        'prev': (_ref = this.prev_cl) != null ? _ref.getUid() : void 0,
        'next': (_ref1 = this.next_cl) != null ? _ref1.getUid() : void 0
      };
    };

    return Delimiter;

  })(Operation);
  parser['Delimiter'] = function(json) {
    var next, prev, uid;
    uid = json['uid'], prev = json['prev'], next = json['next'];
    return new Delimiter(uid, prev, next);
  };
  return {
    'types': {
      'Delete': Delete,
      'Insert': Insert,
      'Delimiter': Delimiter,
      'Operation': Operation,
      'ImmutableObject': ImmutableObject
    },
    'parser': parser,
    'execution_listener': execution_listener
  };
};


},{}],2:[function(require,module,exports){
var text_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

text_types_uninitialized = require("./TextTypes");

module.exports = function(HB) {
  var JsonType, createJsonWrapper, parser, text_types, types;
  text_types = text_types_uninitialized(HB);
  types = text_types.types;
  parser = text_types.parser;
  createJsonWrapper = function(_jsonType) {
    var JsonWrapper;
    JsonWrapper = (function() {
      function JsonWrapper(jsonType) {
        var name, obj, _fn, _ref;
        _ref = jsonType.map;
        _fn = function(name, obj) {
          return Object.defineProperty(JsonWrapper.prototype, name, {
            get: function() {
              var x;
              x = obj.val();
              if (x instanceof JsonType) {
                return createJsonWrapper(x);
              } else if (x instanceof types.ImmutableObject) {
                return x.val();
              } else {
                return x;
              }
            },
            set: function(o) {
              var o_name, o_obj, overwrite, _results;
              if (o.constructor === {}.constructor) {
                overwrite = jsonType.val(name);
                _results = [];
                for (o_name in o) {
                  o_obj = o[o_name];
                  _results.push(overwrite.val(o_name, o_obj, 'immutable'));
                }
                return _results;
              } else {
                return jsonType.val(name, o, 'immutable');
              }
            },
            enumerable: true,
            configurable: false
          });
        };
        for (name in _ref) {
          obj = _ref[name];
          _fn(name, obj);
        }
      }

      return JsonWrapper;

    })();
    return new JsonWrapper(_jsonType);
  };
  JsonType = (function(_super) {
    __extends(JsonType, _super);

    function JsonType(uid, initial_value, mutable) {
      var name, o;
      JsonType.__super__.constructor.call(this, uid);
      if (initial_value != null) {
        if (typeof initial_value !== "object") {
          throw new Error("The initial value of JsonTypes must be of type Object! (current type: " + (typeof initial_value) + ")");
        }
        for (name in initial_value) {
          o = initial_value[name];
          this.val(name, o, mutable);
        }
      }
    }

    JsonType.prototype.mutable_default = true;

    JsonType.prototype.setMutableDefault = function(mutable) {
      if (mutable === true || mutable === 'mutable') {
        JsonType.prototype.mutable_default = true;
      } else if (mutable === false || mutable === 'immutable') {
        JsonType.prototype.mutable_default = false;
      } else {
        throw new Error('Set mutable either "mutable" or "immutable"!');
      }
      return 'OK';
    };

    JsonType.prototype.val = function(name, content, mutable) {
      var json, o, o_name, obj, word;
      if (typeof name === 'object') {
        for (o_name in name) {
          o = name[o_name];
          this.val(o_name, o, content);
        }
        return this;
      } else if ((name != null) && (content != null)) {
        if (mutable != null) {
          if (mutable === true || mutable === 'mutable') {
            mutable = true;
          } else {
            mutable = false;
          }
        } else {
          mutable = this.mutable_default;
        }
        if (typeof content === 'function') {
          return this;
        } else if (((!mutable) || typeof content === 'number') && content.constructor !== Object) {
          obj = HB.addOperation(new types.ImmutableObject(void 0, content)).execute();
          return JsonType.__super__.val.call(this, name, obj);
        } else {
          if (typeof content === 'string') {
            word = HB.addOperation(new types.Word(void 0)).execute();
            word.insertText(0, content);
            return JsonType.__super__.val.call(this, name, word);
          } else if (content.constructor === Object) {
            json = HB.addOperation(new JsonType(void 0, content, mutable)).execute();
            return JsonType.__super__.val.call(this, name, json);
          } else {
            throw new Error("You must not set " + (typeof content) + "-types in collaborative Json-objects!");
          }
        }
      } else {
        return JsonType.__super__.val.call(this, name, content);
      }
    };

    Object.defineProperty(JsonType.prototype, 'value', {
      get: function() {
        return createJsonWrapper(this);
      },
      set: function(o) {
        var o_name, o_obj, _results;
        if (o.constructor === {}.constructor) {
          _results = [];
          for (o_name in o) {
            o_obj = o[o_name];
            _results.push(this.val(o_name, o_obj, 'immutable'));
          }
          return _results;
        } else {
          throw new Error("You must only set Object values!");
        }
      }
    });

    JsonType.prototype._encode = function() {
      return {
        'type': "JsonType",
        'uid': this.getUid()
      };
    };

    return JsonType;

  })(types.MapManager);
  parser['JsonType'] = function(json) {
    var uid;
    uid = json['uid'];
    return new JsonType(uid);
  };
  types['JsonType'] = JsonType;
  return text_types;
};


},{"./TextTypes":4}],3:[function(require,module,exports){
var basic_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

basic_types_uninitialized = require("./BasicTypes");

module.exports = function(HB) {
  var AddName, ListManager, MapManager, ReplaceManager, Replaceable, basic_types, parser, types;
  basic_types = basic_types_uninitialized(HB);
  types = basic_types.types;
  parser = basic_types.parser;
  MapManager = (function(_super) {
    __extends(MapManager, _super);

    function MapManager(uid) {
      this.map = {};
      MapManager.__super__.constructor.call(this, uid);
    }

    MapManager.prototype.val = function(name, content) {
      var o, obj, result, _ref, _ref1;
      if (content != null) {
        if (this.map[name] == null) {
          HB.addOperation(new AddName(void 0, this, name)).execute();
        }
        this.map[name].replace(content);
        return this;
      } else if (name != null) {
        obj = (_ref = this.map[name]) != null ? _ref.val() : void 0;
        if (obj instanceof types.ImmutableObject) {
          return obj.val();
        } else {
          return obj;
        }
      } else {
        result = {};
        _ref1 = this.map;
        for (name in _ref1) {
          o = _ref1[name];
          obj = o.val();
          if (obj instanceof types.ImmutableObject || obj instanceof MapManager) {
            obj = obj.val();
          }
          result[name] = obj;
        }
        return result;
      }
    };

    return MapManager;

  })(types.Operation);
  AddName = (function(_super) {
    __extends(AddName, _super);

    function AddName(uid, map_manager, name) {
      this.name = name;
      this.saveOperation('map_manager', map_manager);
      AddName.__super__.constructor.call(this, uid);
    }

    AddName.prototype.execute = function() {
      var beg, end, uid_beg, uid_end, uid_r;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        uid_r = this.map_manager.getUid();
        uid_r.op_number = "_" + uid_r.op_number + "_RM_" + this.name;
        if (HB.getOperation(uid_r) == null) {
          uid_beg = this.map_manager.getUid();
          uid_beg.op_number = "_" + uid_beg.op_number + "_RM_" + this.name + "_beginning";
          uid_end = this.map_manager.getUid();
          uid_end.op_number = "_" + uid_end.op_number + "_RM_" + this.name + "_end";
          beg = HB.addOperation(new types.Delimiter(uid_beg, void 0, uid_end)).execute();
          end = HB.addOperation(new types.Delimiter(uid_end, beg, void 0)).execute();
          this.map_manager.map[this.name] = HB.addOperation(new ReplaceManager(void 0, uid_r, beg, end)).execute();
        }
        return AddName.__super__.execute.apply(this, arguments);
      }
    };

    AddName.prototype._encode = function() {
      return {
        'type': "AddName",
        'uid': this.getUid(),
        'map_manager': this.map_manager.getUid(),
        'name': this.name
      };
    };

    return AddName;

  })(types.Operation);
  parser['AddName'] = function(json) {
    var map_manager, name, uid;
    map_manager = json['map_manager'], uid = json['uid'], name = json['name'];
    return new AddName(uid, map_manager, name);
  };
  ListManager = (function(_super) {
    __extends(ListManager, _super);

    function ListManager(uid, beginning, end, prev, next, origin) {
      if ((beginning != null) && (end != null)) {
        this.saveOperation('beginning', beginning);
        this.saveOperation('end', end);
      } else {
        this.beginning = HB.addOperation(new types.Delimiter(void 0, void 0, void 0));
        this.end = HB.addOperation(new types.Delimiter(void 0, this.beginning, void 0));
        this.beginning.next_cl = this.end;
        this.beginning.execute();
        this.end.execute();
      }
      ListManager.__super__.constructor.call(this, uid, prev, next, origin);
    }

    ListManager.prototype.execute = function() {
      if (this.validateSavedOperations()) {
        this.beginning.setParent(this);
        this.end.setParent(this);
        return ListManager.__super__.execute.apply(this, arguments);
      } else {
        return false;
      }
    };

    ListManager.prototype.getLastOperation = function() {
      return this.end.prev_cl;
    };

    ListManager.prototype.getFirstOperation = function() {
      return this.beginning.next_cl;
    };

    ListManager.prototype.toArray = function() {
      var o, result;
      o = this.beginning.next_cl;
      result = [];
      while (o !== this.end) {
        result.push(o);
        o = o.next_cl;
      }
      return result;
    };

    ListManager.prototype.getOperationByPosition = function(position) {
      var o;
      o = this.beginning.next_cl;
      if ((position > 0 || o.isDeleted()) && !(o instanceof types.Delimiter)) {
        while (o.isDeleted() && !(o instanceof types.Delimiter)) {
          o = o.next_cl;
        }
        while (true) {
          if (o instanceof types.Delimiter) {
            break;
          }
          if (position <= 0 && !o.isDeleted()) {
            break;
          }
          o = o.next_cl;
          if (!o.isDeleted()) {
            position -= 1;
          }
        }
      }
      return o;
    };

    return ListManager;

  })(types.Insert);
  ReplaceManager = (function(_super) {
    __extends(ReplaceManager, _super);

    function ReplaceManager(initial_content, uid, beginning, end, prev, next, origin) {
      ReplaceManager.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
      if (initial_content != null) {
        this.replace(initial_content);
      }
    }

    ReplaceManager.prototype.replace = function(content) {
      var o, op;
      o = this.getLastOperation();
      op = new Replaceable(content, this, void 0, o, o.next_cl);
      return HB.addOperation(op).execute();
    };

    ReplaceManager.prototype.val = function() {
      var o;
      o = this.getLastOperation();
      if (o instanceof types.Delimiter) {
        throw new Error("dtrn");
      }
      return o.val();
    };

    ReplaceManager.prototype._encode = function() {
      var json;
      json = {
        'type': "ReplaceManager",
        'uid': this.getUid(),
        'beginning': this.beginning.getUid(),
        'end': this.end.getUid()
      };
      if ((this.prev_cl != null) && (this.next_cl != null)) {
        json['prev'] = this.prev_cl.getUid();
        json['next'] = this.next_cl.getUid();
      }
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return ReplaceManager;

  })(ListManager);
  parser["ReplaceManager"] = function(json) {
    var beginning, content, end, next, origin, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], beginning = json['beginning'], end = json['end'];
    return new ReplaceManager(content, uid, beginning, end, prev, next, origin);
  };
  Replaceable = (function(_super) {
    __extends(Replaceable, _super);

    function Replaceable(content, parent, uid, prev, next, origin) {
      this.saveOperation('content', content);
      this.saveOperation('parent', parent);
      if (!((prev != null) && (next != null) && (content != null))) {
        throw new Error("You must define content, prev, and next for Replaceable-types!");
      }
      Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
    }

    Replaceable.prototype.val = function() {
      return this.content;
    };

    Replaceable.prototype.replace = function(content) {
      return this.parent.replace(content);
    };

    Replaceable.prototype.execute = function() {
      var _base;
      if (!this.validateSavedOperations()) {
        return false;
      } else {
        if (typeof (_base = this.content).setReplaceManager === "function") {
          _base.setReplaceManager(this.parent);
        }
        return Replaceable.__super__.execute.apply(this, arguments);
      }
    };

    Replaceable.prototype._encode = function() {
      var json;
      json = {
        'type': "Replaceable",
        'content': this.content.getUid(),
        'ReplaceManager': this.parent.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid(),
        'uid': this.getUid()
      };
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return Replaceable;

  })(types.Insert);
  parser["Replaceable"] = function(json) {
    var content, next, origin, parent, prev, uid;
    content = json['content'], parent = json['ReplaceManager'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new Replaceable(content, parent, uid, prev, next, origin);
  };
  types['ListManager'] = ListManager;
  types['MapManager'] = MapManager;
  types['ReplaceManager'] = ReplaceManager;
  types['Replaceable'] = Replaceable;
  return basic_types;
};


},{"./BasicTypes":1}],4:[function(require,module,exports){
var structured_types_uninitialized,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

structured_types_uninitialized = require("./StructuredTypes");

module.exports = function(HB) {
  var TextDelete, TextInsert, Word, parser, structured_types, types;
  structured_types = structured_types_uninitialized(HB);
  types = structured_types.types;
  parser = structured_types.parser;
  TextDelete = (function(_super) {
    __extends(TextDelete, _super);

    function TextDelete() {
      return TextDelete.__super__.constructor.apply(this, arguments);
    }

    return TextDelete;

  })(types.Delete);
  parser["TextDelete"] = parser["Delete"];
  TextInsert = (function(_super) {
    __extends(TextInsert, _super);

    function TextInsert(content, uid, prev, next, origin) {
      this.content = content;
      if (!((prev != null) && (next != null))) {
        throw new Error("You must define prev, and next for TextInsert-types!");
      }
      TextInsert.__super__.constructor.call(this, uid, prev, next, origin);
    }

    TextInsert.prototype.getLength = function() {
      if (this.isDeleted()) {
        return 0;
      } else {
        return this.content.length;
      }
    };

    TextInsert.prototype.val = function(current_position) {
      if (this.isDeleted()) {
        return "";
      } else {
        return this.content;
      }
    };

    TextInsert.prototype._encode = function() {
      var json;
      json = {
        'type': "TextInsert",
        'content': this.content,
        'uid': this.getUid(),
        'prev': this.prev_cl.getUid(),
        'next': this.next_cl.getUid()
      };
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return TextInsert;

  })(types.Insert);
  parser["TextInsert"] = function(json) {
    var content, next, origin, prev, uid;
    content = json['content'], uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new TextInsert(content, uid, prev, next, origin);
  };
  Word = (function(_super) {
    __extends(Word, _super);

    function Word(uid, beginning, end, prev, next, origin) {
      Word.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
    }

    Word.prototype.insertText = function(position, content) {
      var c, o, op, _i, _len, _results;
      o = this.getOperationByPosition(position);
      _results = [];
      for (_i = 0, _len = content.length; _i < _len; _i++) {
        c = content[_i];
        op = new TextInsert(c, void 0, o.prev_cl, o);
        _results.push(HB.addOperation(op).execute());
      }
      return _results;
    };

    Word.prototype.deleteText = function(position, length) {
      var d, delete_ops, i, o, _i;
      o = this.getOperationByPosition(position);
      delete_ops = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        if (o instanceof types.Delimiter) {
          break;
        }
        d = HB.addOperation(new TextDelete(void 0, o)).execute();
        o = o.next_cl;
        while (!(o instanceof types.Delimiter) && o.isDeleted()) {
          o = o.next_cl;
        }
        delete_ops.push(d._encode());
      }
      return delete_ops;
    };

    Word.prototype.replaceText = function(text) {
      var word;
      if (this.replace_manager != null) {
        word = HB.addOperation(new Word(void 0)).execute();
        word.insertText(0, text);
        return this.replace_manager.replace(word);
      } else {
        throw new Error("This type is currently not maintained by a ReplaceManager!");
      }
    };

    Word.prototype.val = function() {
      var c, o;
      c = (function() {
        var _i, _len, _ref, _results;
        _ref = this.toArray();
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          o = _ref[_i];
          if (o.val != null) {
            _results.push(o.val());
          } else {
            _results.push("");
          }
        }
        return _results;
      }).call(this);
      return c.join('');
    };

    Word.prototype.setReplaceManager = function(op) {
      this.saveOperation('replace_manager', op);
      return this.validateSavedOperations;
    };

    Word.prototype.bind = function(textfield) {
      var word;
      word = this;
      textfield.value = this.val();
      this.on("insert", function(event, op) {
        var fix, left, o_pos, right;
        o_pos = op.getPosition();
        fix = function(cursor) {
          if (cursor <= o_pos) {
            return cursor;
          } else {
            cursor += 1;
            return cursor;
          }
        };
        left = fix(textfield.selectionStart);
        right = fix(textfield.selectionEnd);
        textfield.value = word.val();
        return textfield.setSelectionRange(left, right);
      });
      this.on("delete", function(event, op) {
        var fix, left, o_pos, right;
        o_pos = op.getPosition();
        fix = function(cursor) {
          if (cursor < o_pos) {
            return cursor;
          } else {
            cursor -= 1;
            return cursor;
          }
        };
        left = fix(textfield.selectionStart);
        right = fix(textfield.selectionEnd);
        textfield.value = word.val();
        return textfield.setSelectionRange(left, right);
      });
      textfield.onkeypress = function(event) {
        var char, diff, new_pos, pos;
        char = null;
        if (event.key != null) {
          if (event.charCode === 32) {
            char = " ";
          } else if (event.keyCode === 13) {
            char = '\n';
          } else {
            char = event.key;
          }
        } else {
          char = String.fromCharCode(event.keyCode);
        }
        if (char.length > 0) {
          pos = Math.min(textfield.selectionStart, textfield.selectionEnd);
          diff = Math.abs(textfield.selectionEnd - textfield.selectionStart);
          word.deleteText(pos, diff);
          word.insertText(pos, char);
          new_pos = pos + char.length;
          textfield.setSelectionRange(new_pos, new_pos);
          return event.preventDefault();
        } else {
          return event.preventDefault();
        }
      };
      textfield.onpaste = function(event) {
        return event.preventDefault();
      };
      textfield.oncut = function(event) {
        return event.preventDefault();
      };
      return textfield.onkeydown = function(event) {
        var del_length, diff, new_pos, pos, val;
        pos = Math.min(textfield.selectionStart, textfield.selectionEnd);
        diff = Math.abs(textfield.selectionEnd - textfield.selectionStart);
        if ((event.keyCode != null) && event.keyCode === 8) {
          if (diff > 0) {
            word.deleteText(pos, diff);
            textfield.setSelectionRange(pos, pos);
          } else {
            if ((event.ctrlKey != null) && event.ctrlKey) {
              val = textfield.value;
              new_pos = pos;
              del_length = 0;
              if (pos > 0) {
                new_pos--;
                del_length++;
              }
              while (new_pos > 0 && val[new_pos] !== " " && val[new_pos] !== '\n') {
                new_pos--;
                del_length++;
              }
              word.deleteText(new_pos, pos - new_pos);
              textfield.setSelectionRange(new_pos, new_pos);
            } else {
              word.deleteText(pos - 1, 1);
            }
          }
          return event.preventDefault();
        } else if ((event.keyCode != null) && event.keyCode === 46) {
          if (diff > 0) {
            word.deleteText(pos, diff);
            textfield.setSelectionRange(pos, pos);
          } else {
            word.deleteText(pos, 1);
            textfield.setSelectionRange(pos, pos);
          }
          return event.preventDefault();
        }
      };
    };

    Word.prototype._encode = function() {
      var json;
      json = {
        'type': "Word",
        'uid': this.getUid(),
        'beginning': this.beginning.getUid(),
        'end': this.end.getUid()
      };
      if (this.prev_cl != null) {
        json['prev'] = this.prev_cl.getUid();
      }
      if (this.next_cl != null) {
        json['next'] = this.next_cl.getUid();
      }
      if ((this.origin != null) && this.origin !== this.prev_cl) {
        json["origin"] = this.origin.getUid();
      }
      return json;
    };

    return Word;

  })(types.ListManager);
  parser['Word'] = function(json) {
    var beginning, end, next, origin, prev, uid;
    uid = json['uid'], beginning = json['beginning'], end = json['end'], prev = json['prev'], next = json['next'], origin = json['origin'];
    return new Word(uid, beginning, end, prev, next, origin);
  };
  types['TextInsert'] = TextInsert;
  types['TextDelete'] = TextDelete;
  types['Word'] = Word;
  return structured_types;
};


},{"./StructuredTypes":3}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL1R5cGVzL0Jhc2ljVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9Kc29uVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9UZXh0VHlwZXMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsSUFBQTtpU0FBQTs7QUFBQSxNQUFNLENBQUMsT0FBUCxHQUFpQixTQUFDLEVBQUQsR0FBQTtBQUVmLE1BQUEsaUZBQUE7QUFBQSxFQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7QUFBQSxFQUNBLGtCQUFBLEdBQXFCLEVBRHJCLENBQUE7QUFBQSxFQWFNO0FBTVMsSUFBQSxtQkFBQyxHQUFELEdBQUE7QUFDWCxNQUFBLElBQU8sV0FBUDtBQUNFLFFBQUEsR0FBQSxHQUFNLEVBQUUsQ0FBQywwQkFBSCxDQUFBLENBQU4sQ0FERjtPQUFBO0FBQUEsTUFHYSxJQUFDLENBQUEsY0FBWixVQURGLEVBRWdCLElBQUMsQ0FBQSxnQkFBZixZQUpGLENBRFc7SUFBQSxDQUFiOztBQUFBLHdCQWFBLEVBQUEsR0FBSSxTQUFDLEtBQUQsRUFBUSxDQUFSLEdBQUE7QUFDRixVQUFBLEtBQUE7O1FBQUEsSUFBQyxDQUFBLGtCQUFtQjtPQUFwQjs7YUFDaUIsQ0FBQSxLQUFBLElBQVU7T0FEM0I7YUFFQSxJQUFDLENBQUEsZUFBZ0IsQ0FBQSxLQUFBLENBQU0sQ0FBQyxJQUF4QixDQUE2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QUFBLE1BQU0sQ0FBQyxNQUFSLENBQUEsQ0FBakIsQ0FERjtPQVZBO2FBWUEsS0FiTztJQUFBLENBM0tULENBQUE7O2dCQUFBOztLQUxpQixLQUFLLENBQUMsWUF6RXpCLENBQUE7QUFBQSxFQXdRQSxNQUFPLENBQUEsTUFBQSxDQUFQLEdBQWlCLFNBQUMsSUFBRCxHQUFBO0FBQ2YsUUFBQSx1Q0FBQTtBQUFBLElBQ1UsV0FBUixNQURGLEVBRWdCLGlCQUFkLFlBRkYsRUFHVSxXQUFSLE1BSEYsRUFJVSxZQUFSLE9BSkYsRUFLVSxZQUFSLE9BTEYsRUFNYSxjQUFYLFNBTkYsQ0FBQTtXQVFJLElBQUEsSUFBQSxDQUFLLEdBQUwsRUFBVSxTQUFWLEVBQXFCLEdBQXJCLEVBQTBCLElBQTFCLEVBQWdDLElBQWhDLEVBQXNDLE1BQXRDLEVBVFc7RUFBQSxDQXhRakIsQ0FBQTtBQUFBLEVBbVJBLEtBQU0sQ0FBQSxZQUFBLENBQU4sR0FBc0IsVUFuUnRCLENBQUE7QUFBQSxFQW9SQSxLQUFNLENBQUEsWUFBQSxDQUFOLEdBQXNCLFVBcFJ0QixDQUFBO0FBQUEsRUFxUkEsS0FBTSxDQUFBLE1BQUEsQ0FBTixHQUFnQixJQXJSaEIsQ0FBQTtTQXNSQSxpQkF2UmU7QUFBQSxDQUZqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gICMgQHNlZSBFbmdpbmUucGFyc2VcbiAgcGFyc2VyID0ge31cbiAgZXhlY3V0aW9uX2xpc3RlbmVyID0gW11cblxuICAjXG4gICMgQSBnZW5lcmljIGludGVyZmFjZSB0byBvcGVyYXRpb25zLlxuICAjXG4gICMgQW4gb3BlcmF0aW9uIGhhcyB0aGUgZm9sbG93aW5nIG1ldGhvZHM6XG4gICMgX2VuY29kZTogZW5jb2RlcyBhbiBvcGVyYXRpb24gKG5lZWRlZCBvbmx5IGlmIGluc3RhbmNlIG9mIHRoaXMgb3BlcmF0aW9uIGlzIHNlbnQpLlxuICAjIGV4ZWN1dGU6IGV4ZWN1dGUgdGhlIGVmZmVjdHMgb2YgdGhpcyBvcGVyYXRpb25zLiBHb29kIGV4YW1wbGVzIGFyZSBJbnNlcnQtdHlwZSBhbmQgQWRkTmFtZS10eXBlXG4gICMgdmFsOiBpbiB0aGUgY2FzZSB0aGF0IHRoZSBvcGVyYXRpb24gaG9sZHMgYSB2YWx1ZVxuICAjXG4gICMgRnVydGhlcm1vcmUgYW4gZW5jb2RhYmxlIG9wZXJhdGlvbiBoYXMgYSBwYXJzZXIuXG4gICNcbiAgY2xhc3MgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQpLT5cbiAgICAgIGlmIG5vdCB1aWQ/XG4gICAgICAgIHVpZCA9IEhCLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyKClcbiAgICAgIHtcbiAgICAgICAgJ2NyZWF0b3InOiBAY3JlYXRvclxuICAgICAgICAnb3BfbnVtYmVyJyA6IEBvcF9udW1iZXJcbiAgICAgIH0gPSB1aWRcblxuICAgICNcbiAgICAjIEFkZCBhbiBldmVudCBsaXN0ZW5lci4gSXQgZGVwZW5kcyBvbiB0aGUgb3BlcmF0aW9uIHdoaWNoIGV2ZW50cyBhcmUgc3VwcG9ydGVkLlxuICAgICMgQHBhcmFtIHtTdHJpbmd9IGV2ZW50IE5hbWUgb2YgdGhlIGV2ZW50LlxuICAgICMgQHBhcmFtIHtGdW5jdGlvbn0gZiBmIGlzIGV4ZWN1dGVkIGluIGNhc2UgdGhlIGV2ZW50IGZpcmVzLlxuICAgICNcbiAgICBvbjogKGV2ZW50LCBmKS0+XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzID89IHt9XG4gICAgICBAZXZlbnRfbGlzdGVuZXJzW2V2ZW50XSA/PSBbXVxuICAgICAgQGV2ZW50X2xpc3RlbmVyc1tldmVudF0ucHVzaCBmXG5cbiAgICAjXG4gICAgIyBGaXJlIGFuIGV2ZW50LlxuICAgICMgVE9ETzogRG8gc29tZXRoaW5nIHdpdGggdGltZW91dHMuIFlvdSBkb24ndCB3YW50IHRoaXMgdG8gZmlyZSBmb3IgZXZlcnkgb3BlcmF0aW9uIChlLmcuIGluc2VydCkuXG4gICAgI1xuICAgIGNhbGxFdmVudDogKGV2ZW50LCBhcmdzKS0+XG4gICAgICBpZiBAZXZlbnRfbGlzdGVuZXJzP1tldmVudF0/XG4gICAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdXG4gICAgICAgICAgZi5jYWxsIEAsIGV2ZW50LCBhcmdzXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAobyktPlxuICAgICAgQHBhcmVudCA9IG9cblxuICAgICNcbiAgICAjIEdldCB0aGUgcGFyZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRQYXJlbnQ6ICgpLT5cbiAgICAgIEBwYXJlbnRcblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIHsgJ2NyZWF0b3InOiBAY3JlYXRvciwgJ29wX251bWJlcic6IEBvcF9udW1iZXIgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gSW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2VcbiAgICAgICAgZmFsc2VcblxuICAjXG4gICMgRGVmaW5lIGhvdyB0byBwYXJzZSBEZWxldGUgb3BlcmF0aW9ucy5cbiAgI1xuICBwYXJzZXJbJ0RlbGV0ZSddID0gKG8pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2RlbGV0ZXMnOiBkZWxldGVzX3VpZFxuICAgIH0gPSBvXG4gICAgbmV3IERlbGV0ZSB1aWQsIGRlbGV0ZXNfdWlkXG5cbiAgI1xuICAjIEEgc2ltcGxlIGluc2VydC10eXBlIG9wZXJhdGlvbi5cbiAgI1xuICAjIEFuIGluc2VydCBvcGVyYXRpb24gaXMgYWx3YXlzIHBvc2l0aW9uZWQgYmV0d2VlbiB0d28gb3RoZXIgaW5zZXJ0IG9wZXJhdGlvbnMuXG4gICMgSW50ZXJuYWxseSB0aGlzIGlzIHJlYWxpemVkIGFzIGFzc29jaWF0aXZlIGxpc3RzLCB3aGVyZWJ5IGVhY2ggaW5zZXJ0IG9wZXJhdGlvbiBoYXMgYSBwcmVkZWNlc3NvciBhbmQgYSBzdWNjZXNzb3IuXG4gICMgRm9yIHRoZSBzYWtlIG9mIGVmZmljaWVuY3kgd2UgbWFpbnRhaW4gdHdvIGxpc3RzOlxuICAjICAgLSBUaGUgc2hvcnQtbGlzdCAoYWJicmV2LiBzbCkgbWFpbnRhaW5zIG9ubHkgdGhlIG9wZXJhdGlvbnMgdGhhdCBhcmUgbm90IGRlbGV0ZWRcbiAgIyAgIC0gVGhlIGNvbXBsZXRlLWxpc3QgKGFiYnJldi4gY2wpIG1haW50YWlucyBhbGwgb3BlcmF0aW9uc1xuICAjXG4gIGNsYXNzIEluc2VydCBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IHByZXZfY2wgVGhlIHByZWRlY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBuZXh0X2NsIFRoZSBzdWNjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICNcbiAgICAjIEBzZWUgSGlzdG9yeUJ1ZmZlci5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllclxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgcHJldl9jbCwgbmV4dF9jbCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncHJldl9jbCcsIHByZXZfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICduZXh0X2NsJywgbmV4dF9jbFxuICAgICAgaWYgb3JpZ2luP1xuICAgICAgICBAc2F2ZU9wZXJhdGlvbiAnb3JpZ2luJywgb3JpZ2luXG4gICAgICBlbHNlXG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIGFwcGx5RGVsZXRlOiAobyktPlxuICAgICAgQGRlbGV0ZWRfYnkgPz0gW11cbiAgICAgIEBkZWxldGVkX2J5LnB1c2ggb1xuICAgICAgaWYgQHBhcmVudD8gYW5kIEBkZWxldGVkX2J5Lmxlbmd0aCBpcyAxXG4gICAgICAgICMgY2FsbCBpZmYgd2Fzbid0IGRlbGV0ZWQgZWFybHllclxuICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImRlbGV0ZVwiLCBAXG5cbiAgICAjXG4gICAgIyBJZiBpc0RlbGV0ZWQoKSBpcyB0cnVlIHRoaXMgb3BlcmF0aW9uIHdvbid0IGJlIG1haW50YWluZWQgaW4gdGhlIHNsXG4gICAgI1xuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGRlbGV0ZWRfYnk/Lmxlbmd0aCA+IDBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICAjVE9ETzogZGVsZXRlIHRoaXNcbiAgICAgICAgaWYgQCBpcyBAcHJldl9jbFxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gOykgXCJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFVwZGF0ZSB0aGUgc2hvcnQgbGlzdFxuICAgICMgVE9ETyAoVW51c2VkKVxuICAgIHVwZGF0ZV9zbDogKCktPlxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB1cGRhdGU6IChkZXN0X2NsLGRlc3Rfc2wpLT5cbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgIGlmIG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIG8gPSBvW2Rlc3RfY2xdXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgQFtkZXN0X3NsXSA9IG9cblxuICAgICAgICAgICAgYnJlYWtcbiAgICAgIHVwZGF0ZSBcInByZXZfY2xcIiwgXCJwcmV2X3NsXCJcbiAgICAgIHVwZGF0ZSBcIm5leHRfY2xcIiwgXCJwcmV2X3NsXCJcblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEBpc19leGVjdXRlZD9cbiAgICAgICAgcmV0dXJuIEBcbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHByZXZfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBuZXh0X2NsPy52YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpIGFuZCBAcHJldl9jbC5uZXh0X2NsIGlzbnQgQFxuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSAwXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2UgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG5vdCBvP1xuICAgICAgICAgICAgICAjIFRPRE86IERlYnVnZ2luZ1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8uY3JlYXRvciA8IEBjcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG4gICAgICAgIHBhcmVudCA9IEBwcmV2X2NsPy5nZXRQYXJlbnQoKVxuICAgICAgICBpZiBwYXJlbnQ/XG4gICAgICAgICAgQHNldFBhcmVudCBwYXJlbnRcbiAgICAgICAgICBAcGFyZW50LmNhbGxFdmVudCBcImluc2VydFwiLCBAXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG5cbiAgICAjXG4gICAgIyBDb21wdXRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgZ2V0UG9zaXRpb246ICgpLT5cbiAgICAgIHBvc2l0aW9uID0gMFxuICAgICAgcHJldiA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIHByZXYgaW5zdGFuY2VvZiBEZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBpZiBwcmV2LmlzRGVsZXRlZD8gYW5kIG5vdCBwcmV2LmlzRGVsZXRlZCgpXG4gICAgICAgICAgcG9zaXRpb24rK1xuICAgICAgICBwcmV2ID0gcHJldi5wcmV2X2NsXG4gICAgICBwb3NpdGlvblxuICAjXG4gICMgRGVmaW5lcyBhbiBvYmplY3QgdGhhdCBpcyBjYW5ub3QgYmUgY2hhbmdlZC4gWW91IGNhbiB1c2UgdGhpcyB0byBzZXQgYW4gaW1tdXRhYmxlIHN0cmluZywgb3IgYSBudW1iZXIuXG4gICNcbiAgY2xhc3MgSW1tdXRhYmxlT2JqZWN0IGV4dGVuZHMgSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gY29udGVudFxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgQGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiSW1tdXRhYmxlT2JqZWN0XCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2NvbnRlbnQnIDogQGNvbnRlbnRcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyWydJbW11dGFibGVPYmplY3QnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IEltbXV0YWJsZU9iamVjdCB1aWQsIGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIERlbGltaXRlciBleHRlbmRzIE9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElmIGlzRGVsZXRlZCgpIGlzIHRydWUgdGhpcyBvcGVyYXRpb24gd29uJ3QgYmUgbWFpbnRhaW5lZCBpbiB0aGUgc2xcbiAgICAjXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkRlbGltaXRlclwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0RlbGltaXRlciddID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IERlbGltaXRlciB1aWQsIHByZXYsIG5leHRcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDpcbiAgICAgICdEZWxldGUnIDogRGVsZXRlXG4gICAgICAnSW5zZXJ0JyA6IEluc2VydFxuICAgICAgJ0RlbGltaXRlcic6IERlbGltaXRlclxuICAgICAgJ09wZXJhdGlvbic6IE9wZXJhdGlvblxuICAgICAgJ0ltbXV0YWJsZU9iamVjdCcgOiBJbW11dGFibGVPYmplY3RcbiAgICAncGFyc2VyJyA6IHBhcnNlclxuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cblxuXG5cblxuIiwidGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVGV4dFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgdGV4dF90eXBlcyA9IHRleHRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHRleHRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gdGV4dF90eXBlcy5wYXJzZXJcblxuICBjcmVhdGVKc29uV3JhcHBlciA9IChfanNvblR5cGUpLT5cblxuICAgICNcbiAgICAjIEEgSnNvbldyYXBwZXIgd2FzIGludGVuZGVkIHRvIGJlIGEgY29udmVuaWVudCB3cmFwcGVyIGZvciB0aGUgSnNvblR5cGUuXG4gICAgIyBCdXQgaXQgY2FuIG1ha2UgdGhpbmdzIG1vcmUgZGlmZmljdWx0IHRoYW4gdGhleSBhcmUuXG4gICAgIyBAc2VlIEpzb25UeXBlXG4gICAgI1xuICAgICMgQGV4YW1wbGUgY3JlYXRlIGEgSnNvbldyYXBwZXJcbiAgICAjICAgIyBZb3UgZ2V0IGEgSnNvbldyYXBwZXIgZnJvbSBhIEpzb25UeXBlIGJ5IGNhbGxpbmdcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgI1xuICAgICMgSXQgY3JlYXRlcyBKYXZhc2NyaXB0cyAtZ2V0dGVyIGFuZCAtc2V0dGVyIG1ldGhvZHMgZm9yIGVhY2ggcHJvcGVydHkgdGhhdCBKc29uVHlwZSBtYWludGFpbnMuXG4gICAgIyBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9kZWZpbmVQcm9wZXJ0eVxuICAgICNcbiAgICAjIEBleGFtcGxlIEdldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBhY2Nlc3MgdGhlIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnhcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcpXG4gICAgI1xuICAgICMgQG5vdGUgWW91IGNhbiBvbmx5IG92ZXJ3cml0ZSBleGlzdGluZyB2YWx1ZXMhIFNldHRpbmcgYSBuZXcgcHJvcGVydHkgd29uJ3QgaGF2ZSBhbnkgZWZmZWN0IVxuICAgICNcbiAgICAjIEBleGFtcGxlIFNldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBzZXQgYW4gZXhpc3RpbmcgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueCA9IFwidGV4dFwiXG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnLCBcInRleHRcIilcbiAgICAjXG4gICAgIyBJbiBvcmRlciB0byBzZXQgYSBuZXcgcHJvcGVydHkgeW91IGhhdmUgdG8gb3ZlcndyaXRlIGFuIGV4aXN0aW5nIHByb3BlcnR5LlxuICAgICMgVGhlcmVmb3JlIHRoZSBKc29uV3JhcHBlciBzdXBwb3J0cyBhIHNwZWNpYWwgZmVhdHVyZSB0aGF0IHNob3VsZCBtYWtlIHRoaW5ncyBtb3JlIGNvbnZlbmllbnRcbiAgICAjICh3ZSBjYW4gYXJndWUgYWJvdXQgdGhhdCwgdXNlIHRoZSBKc29uVHlwZSBpZiB5b3UgZG9uJ3QgbGlrZSBpdCA7KS5cbiAgICAjIElmIHlvdSBvdmVyd3JpdGUgYW4gb2JqZWN0IHByb3BlcnR5IG9mIHRoZSBKc29uV3JhcHBlciB3aXRoIGEgbmV3IG9iamVjdCwgaXQgd2lsbCByZXN1bHQgaW4gYSBtZXJnZWQgdmVyc2lvbiBvZiB0aGUgb2JqZWN0cy5cbiAgICAjIExldCB3LnAgdGhlIHByb3BlcnR5IHRoYXQgaXMgdG8gYmUgb3ZlcndyaXR0ZW4gYW5kIG8gdGhlIG5ldyB2YWx1ZS4gRS5nLiB3LnAgPSBvXG4gICAgIyAqIFRoZSByZXN1bHQgaGFzIGFsbCBwcm9wZXJ0aWVzIG9mIG9cbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygdy5wIGlmIHRoZXkgZG9uJ3Qgb2NjdXIgdW5kZXIgdGhlIHNhbWUgcHJvcGVydHktbmFtZSBpbiBvLlxuICAgICNcbiAgICAjIEBleGFtcGxlIENvbmZsaWN0IEV4YW1wbGVcbiAgICAjICAgeWF0dGEudmFsdWUgPSB7YSA6IFwic3RyaW5nXCJ9XG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdy5hID0ge2EgOiB7YiA6IFwic3RyaW5nXCJ9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wifX1cbiAgICAjICAgdy5hID0ge2EgOiB7YyA6IDR9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wiLCBjIDogNH19XG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29tbW9uIFBpdGZhbGxzXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICAjIFNldHRpbmcgYSBuZXcgcHJvcGVydHlcbiAgICAjICAgdy5uZXdQcm9wZXJ0eSA9IFwiQXdlc29tZVwiXG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgZmFsc2UsIHcubmV3UHJvcGVydHkgaXMgdW5kZWZpbmVkXG4gICAgIyAgICMgb3ZlcndyaXRlIHRoZSB3IG9iamVjdFxuICAgICMgICB3ID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSEsIGJ1dCAuLlxuICAgICMgICBjb25zb2xlLmxvZyh5YXR0YS52YWx1ZS5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgeW91IGFyZSBvbmx5IGFsbG93ZWQgdG8gc2V0IHByb3BlcnRpZXMhXG4gICAgIyAgICMgVGhlIHNvbHV0aW9uXG4gICAgIyAgIHlhdHRhLnZhbHVlID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSFcbiAgICAjXG4gICAgY2xhc3MgSnNvbldyYXBwZXJcblxuICAgICAgI1xuICAgICAgIyBAcGFyYW0ge0pzb25UeXBlfSBqc29uVHlwZSBJbnN0YW5jZSBvZiB0aGUgSnNvblR5cGUgdGhhdCB0aGlzIGNsYXNzIHdyYXBwZXMuXG4gICAgICAjXG4gICAgICBjb25zdHJ1Y3RvcjogKGpzb25UeXBlKS0+XG4gICAgICAgIGZvciBuYW1lLCBvYmogb2YganNvblR5cGUubWFwXG4gICAgICAgICAgZG8gKG5hbWUsIG9iaiktPlxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25XcmFwcGVyLnByb3RvdHlwZSwgbmFtZSxcbiAgICAgICAgICAgICAgZ2V0IDogLT5cbiAgICAgICAgICAgICAgICB4ID0gb2JqLnZhbCgpXG4gICAgICAgICAgICAgICAgaWYgeCBpbnN0YW5jZW9mIEpzb25UeXBlXG4gICAgICAgICAgICAgICAgICBjcmVhdGVKc29uV3JhcHBlciB4XG4gICAgICAgICAgICAgICAgZWxzZSBpZiB4IGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgICAgICAgICB4LnZhbCgpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgeFxuICAgICAgICAgICAgICBzZXQgOiAobyktPlxuICAgICAgICAgICAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZSA9IGpzb25UeXBlLnZhbChuYW1lKVxuICAgICAgICAgICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZS52YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAganNvblR5cGUudmFsKG5hbWUsIG8sICdpbW11dGFibGUnKVxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICBuZXcgSnNvbldyYXBwZXIgX2pzb25UeXBlXG5cbiAgI1xuICAjIE1hbmFnZXMgT2JqZWN0LWxpa2UgdmFsdWVzLlxuICAjXG4gIGNsYXNzIEpzb25UeXBlIGV4dGVuZHMgdHlwZXMuTWFwTWFuYWdlclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGluaXRpYWxfdmFsdWUgQ3JlYXRlIHRoaXMgb3BlcmF0aW9uIHdpdGggYW4gaW5pdGlhbCB2YWx1ZS5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IFdoZXRoZXIgdGhlIGluaXRpYWxfdmFsdWUgc2hvdWxkIGJlIGNyZWF0ZWQgYXMgbXV0YWJsZS4gKE9wdGlvbmFsIC0gc2VlIHNldE11dGFibGVEZWZhdWx0KVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgaW5pdGlhbF92YWx1ZSwgbXV0YWJsZSktPlxuICAgICAgc3VwZXIgdWlkXG4gICAgICBpZiBpbml0aWFsX3ZhbHVlP1xuICAgICAgICBpZiB0eXBlb2YgaW5pdGlhbF92YWx1ZSBpc250IFwib2JqZWN0XCJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgaW5pdGlhbCB2YWx1ZSBvZiBKc29uVHlwZXMgbXVzdCBiZSBvZiB0eXBlIE9iamVjdCEgKGN1cnJlbnQgdHlwZTogI3t0eXBlb2YgaW5pdGlhbF92YWx1ZX0pXCJcbiAgICAgICAgZm9yIG5hbWUsbyBvZiBpbml0aWFsX3ZhbHVlXG4gICAgICAgICAgQHZhbCBuYW1lLCBvLCBtdXRhYmxlXG5cbiAgICAjXG4gICAgIyBXaGV0aGVyIHRoZSBkZWZhdWx0IGlzICdtdXRhYmxlJyAodHJ1ZSkgb3IgJ2ltbXV0YWJsZScgKGZhbHNlKVxuICAgICNcbiAgICBtdXRhYmxlX2RlZmF1bHQ6XG4gICAgICB0cnVlXG5cbiAgICAjXG4gICAgIyBTZXQgaWYgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnIG9yICdpbW11dGFibGUnXG4gICAgIyBAcGFyYW0ge1N0cmluZ3xCb29sZWFufSBtdXRhYmxlIFNldCBlaXRoZXIgJ211dGFibGUnIC8gdHJ1ZSBvciAnaW1tdXRhYmxlJyAvIGZhbHNlXG4gICAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgICBpZiBtdXRhYmxlIGlzIHRydWUgb3IgbXV0YWJsZSBpcyAnbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IHRydWVcbiAgICAgIGVsc2UgaWYgbXV0YWJsZSBpcyBmYWxzZSBvciBtdXRhYmxlIGlzICdpbW11dGFibGUnXG4gICAgICAgIEpzb25UeXBlLnByb3RvdHlwZS5tdXRhYmxlX2RlZmF1bHQgPSBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgJ1NldCBtdXRhYmxlIGVpdGhlciBcIm11dGFibGVcIiBvciBcImltbXV0YWJsZVwiISdcbiAgICAgICdPSydcblxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwoKVxuICAgICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAgICMgICBAcmV0dXJuIFtKc29uXVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGV8V29yZHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICAgIGlmIHR5cGVvZiBuYW1lIGlzICdvYmplY3QnXG4gICAgICAgICMgU3BlY2lhbCBjYXNlLiBGaXJzdCBhcmd1bWVudCBpcyBhbiBvYmplY3QuIFRoZW4gdGhlIHNlY29uZCBhcmcgaXMgbXV0YWJsZS5cbiAgICAgICAgIyBLZWVwIHRoYXQgaW4gbWluZCB3aGVuIHJlYWRpbmcgdGhlIGZvbGxvd2luZy4uXG4gICAgICAgIGZvciBvX25hbWUsbyBvZiBuYW1lXG4gICAgICAgICAgQHZhbChvX25hbWUsbyxjb250ZW50KVxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/IGFuZCBjb250ZW50P1xuICAgICAgICBpZiBtdXRhYmxlP1xuICAgICAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICAgICAgbXV0YWJsZSA9IHRydWVcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBtdXRhYmxlID0gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG11dGFibGUgPSBAbXV0YWJsZV9kZWZhdWx0XG4gICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdmdW5jdGlvbidcbiAgICAgICAgICBAICMgSnVzdCBkbyBub3RoaW5nXG4gICAgICAgIGVsc2UgaWYgKChub3QgbXV0YWJsZSkgb3IgdHlwZW9mIGNvbnRlbnQgaXMgJ251bWJlcicpIGFuZCBjb250ZW50LmNvbnN0cnVjdG9yIGlzbnQgT2JqZWN0XG4gICAgICAgICAgb2JqID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICAgICAgICBzdXBlciBuYW1lLCBvYmpcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdzdHJpbmcnXG4gICAgICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5Xb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgICB3b3JkLmluc2VydFRleHQgMCwgY29udGVudFxuICAgICAgICAgICAgc3VwZXIgbmFtZSwgd29yZFxuICAgICAgICAgIGVsc2UgaWYgY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICAgIGpzb24gPSBIQi5hZGRPcGVyYXRpb24obmV3IEpzb25UeXBlIHVuZGVmaW5lZCwgY29udGVudCwgbXV0YWJsZSkuZXhlY3V0ZSgpXG4gICAgICAgICAgICBzdXBlciBuYW1lLCBqc29uXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCAje3R5cGVvZiBjb250ZW50fS10eXBlcyBpbiBjb2xsYWJvcmF0aXZlIEpzb24tb2JqZWN0cyFcIlxuICAgICAgZWxzZVxuICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvblR5cGUucHJvdG90eXBlLCAndmFsdWUnLFxuICAgICAgZ2V0IDogLT4gY3JlYXRlSnNvbldyYXBwZXIgQFxuICAgICAgc2V0IDogKG8pLT5cbiAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgICAgQHZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG9ubHkgc2V0IE9iamVjdCB2YWx1ZXMhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJKc29uVHlwZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG5cbiAgcGFyc2VyWydKc29uVHlwZSddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IEpzb25UeXBlIHVpZFxuXG5cblxuXG4gIHR5cGVzWydKc29uVHlwZSddID0gSnNvblR5cGVcblxuICB0ZXh0X3R5cGVzXG5cblxuIiwiYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBiYXNpY190eXBlcyA9IGJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBiYXNpY190eXBlcy50eXBlc1xuICBwYXJzZXIgPSBiYXNpY190eXBlcy5wYXJzZXJcblxuICAjXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBzZWUgSnNvblR5cGVzLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBpZiBub3QgQG1hcFtuYW1lXT9cbiAgICAgICAgICBIQi5hZGRPcGVyYXRpb24obmV3IEFkZE5hbWUgdW5kZWZpbmVkLCBALCBuYW1lKS5leGVjdXRlKClcbiAgICAgICAgQG1hcFtuYW1lXS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBvYmogPSBAbWFwW25hbWVdPy52YWwoKVxuICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICBvYmoudmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9ialxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBtYXBcbiAgICAgICAgICBvYmogPSBvLnZhbCgpXG4gICAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0IG9yIG9iaiBpbnN0YW5jZW9mIE1hcE1hbmFnZXJcbiAgICAgICAgICAgIG9iaiA9IG9iai52YWwoKVxuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG9ialxuICAgICAgICByZXN1bHRcblxuICAjXG4gICMgV2hlbiBhIG5ldyBwcm9wZXJ0eSBpbiBhIG1hcCBtYW5hZ2VyIGlzIGNyZWF0ZWQsIHRoZW4gdGhlIHVpZHMgb2YgdGhlIGluc2VydGVkIE9wZXJhdGlvbnNcbiAgIyBtdXN0IGJlIHVuaXF1ZSAodGhpbmsgYWJvdXQgY29uY3VycmVudCBvcGVyYXRpb25zKS4gVGhlcmVmb3JlIG9ubHkgYW4gQWRkTmFtZSBvcGVyYXRpb24gaXMgYWxsb3dlZCB0b1xuICAjIGFkZCBhIHByb3BlcnR5IGluIGEgTWFwTWFuYWdlci4gSWYgdHdvIEFkZE5hbWUgb3BlcmF0aW9ucyBvbiB0aGUgc2FtZSBNYXBNYW5hZ2VyIG5hbWUgaGFwcGVuIGNvbmN1cnJlbnRseVxuICAjIG9ubHkgb25lIHdpbGwgQWRkTmFtZSBvcGVyYXRpb24gd2lsbCBiZSBleGVjdXRlZC5cbiAgI1xuICBjbGFzcyBBZGROYW1lIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gbWFwX21hbmFnZXIgVWlkIG9yIHJlZmVyZW5jZSB0byB0aGUgTWFwTWFuYWdlci5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgd2lsbCBiZSBhZGRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIG1hcF9tYW5hZ2VyLCBAbmFtZSktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ21hcF9tYW5hZ2VyJywgbWFwX21hbmFnZXJcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgbWFwX21hbmFnZXIgZG9lc24ndCBoYXZlIHRoZSBwcm9wZXJ0eSBuYW1lLCB0aGVuIGFkZCBpdC5cbiAgICAjIFRoZSBSZXBsYWNlTWFuYWdlciB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gb24gdGhlIHByb3BlcnR5IGlzIHVuaXF1ZVxuICAgICMgaW4gc3VjaCBhIHdheSB0aGF0IGlmIEFkZE5hbWUgaXMgZXhlY3V0ZWQgKGZyb20gYW5vdGhlciBwZWVyKSBpdCB3aWxsXG4gICAgIyBhbHdheXMgaGF2ZSB0aGUgc2FtZSByZXN1bHQgKFJlcGxhY2VNYW5hZ2VyLCBhbmQgaXRzIGJlZ2lubmluZyBhbmQgZW5kIGFyZSB0aGUgc2FtZSlcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB1aWRfciA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIl8je3VpZF9iZWcub3BfbnVtYmVyfV9STV8je0BuYW1lfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiXyN7dWlkX2VuZC5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2VuZFwiXG4gICAgICAgICAgYmVnID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgI2JlZy5leGVjdXRlKClcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXSA9IEhCLmFkZE9wZXJhdGlvbihuZXcgUmVwbGFjZU1hbmFnZXIgdW5kZWZpbmVkLCB1aWRfciwgYmVnLCBlbmQpLmV4ZWN1dGUoKVxuICAgICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkFkZE5hbWVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnbWFwX21hbmFnZXInIDogQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICduYW1lJyA6IEBuYW1lXG4gICAgICB9XG5cbiAgcGFyc2VyWydBZGROYW1lJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdtYXBfbWFuYWdlcicgOiBtYXBfbWFuYWdlclxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICduYW1lJyA6IG5hbWVcbiAgICB9ID0ganNvblxuICAgIG5ldyBBZGROYW1lIHVpZCwgbWFwX21hbmFnZXIsIG5hbWVcblxuICAjXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBMaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBpZiBiZWdpbm5pbmc/IGFuZCBlbmQ/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdiZWdpbm5pbmcnLCBiZWdpbm5pbmdcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2VuZCcsIGVuZFxuICAgICAgZWxzZVxuICAgICAgICBAYmVnaW5uaW5nID0gSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgICBAZW5kID0gICAgICAgSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBiZWdpbm5pbmcuc2V0UGFyZW50IEBcbiAgICAgICAgQGVuZC5zZXRQYXJlbnQgQFxuICAgICAgICBzdXBlclxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIHJlc3VsdC5wdXNoIG9cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICBpZiAocG9zaXRpb24gPiAwIG9yIG8uaXNEZWxldGVkKCkpIGFuZCBub3QgKG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXIpXG4gICAgICAgIHdoaWxlIG8uaXNEZWxldGVkKCkgYW5kIG5vdCAobyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlcilcbiAgICAgICAgICAjIGZpbmQgZmlyc3Qgbm9uIGRlbGV0ZWQgb3BcbiAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAjIGZpbmQgdGhlIGktdGggb3BcbiAgICAgICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGlmIHBvc2l0aW9uIDw9IDAgYW5kIG5vdCBvLmlzRGVsZXRlZCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgcG9zaXRpb24gLT0gMVxuXG5cbiAgICAgIG9cblxuICAjXG4gICMgQWRkcyBzdXBwb3J0IGZvciByZXBsYWNlLiBUaGUgUmVwbGFjZU1hbmFnZXIgbWFuYWdlcyBSZXBsYWNlYWJsZSBvcGVyYXRpb25zLlxuICAjIEVhY2ggUmVwbGFjZWFibGUgaG9sZHMgYSB2YWx1ZSB0aGF0IGlzIG5vdyByZXBsYWNlYWJsZS5cbiAgI1xuICAjIFRoZSBXb3JkLXR5cGUgaGFzIGltcGxlbWVudGVkIHN1cHBvcnQgZm9yIHJlcGxhY2VcbiAgIyBAc2VlIFdvcmRcbiAgI1xuICBjbGFzcyBSZXBsYWNlTWFuYWdlciBleHRlbmRzIExpc3RNYW5hZ2VyXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGluaXRpYWxfY29udGVudCBJbml0aWFsaXplIHRoaXMgd2l0aCBhIFJlcGxhY2VhYmxlIHRoYXQgaG9sZHMgdGhlIGluaXRpYWxfY29udGVudC5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBiZWdpbm5pbmcgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICAjIEBwYXJhbSB7RGVsaW1pdGVyfSBlbmQgUmVmZXJlbmNlIG9yIE9iamVjdC5cbiAgICBjb25zdHJ1Y3RvcjogKGluaXRpYWxfY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBzdXBlciB1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW5cbiAgICAgIGlmIGluaXRpYWxfY29udGVudD9cbiAgICAgICAgQHJlcGxhY2UgaW5pdGlhbF9jb250ZW50XG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBleGlzdGluZyB3b3JkIHdpdGggYSBuZXcgd29yZC5cbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBvcCA9IG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBALCB1bmRlZmluZWQsIG8sIG8ubmV4dF9jbFxuICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcblxuICAgICNcbiAgICAjIEdldCB0aGUgdmFsdWUgb2YgdGhpcyBXb3JkXG4gICAgIyBAcmV0dXJuIHtTdHJpbmd9XG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgbyA9IEBnZXRMYXN0T3BlcmF0aW9uKClcbiAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiZHRyblwiXG4gICAgICBvLnZhbCgpXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlTWFuYWdlclwiXG4gICAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgICAnZW5kJyA6IEBlbmQuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQHByZXZfY2w/IGFuZCBAbmV4dF9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgICAganNvblsnbmV4dCddID0gQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBvcmlnaW4/IGFuZCBAb3JpZ2luIGlzbnQgQHByZXZfY2xcbiAgICAgICAganNvbltcIm9yaWdpblwiXSA9IEBvcmlnaW4uZ2V0VWlkKClcbiAgICAgIGpzb25cblxuICBwYXJzZXJbXCJSZXBsYWNlTWFuYWdlclwiXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ2NvbnRlbnQnIDogY29udGVudFxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgfSA9IGpzb25cbiAgICBuZXcgUmVwbGFjZU1hbmFnZXIgY29udGVudCwgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuICAjXG4gICMgVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGVzLlxuICAjIEBzZWUgUmVwbGFjZU1hbmFnZXJcbiAgI1xuICBjbGFzcyBSZXBsYWNlYWJsZSBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IGNvbnRlbnQgVGhlIHZhbHVlIHRoYXQgdGhpcyBSZXBsYWNlYWJsZSBob2xkcy5cbiAgICAjIEBwYXJhbSB7UmVwbGFjZU1hbmFnZXJ9IHBhcmVudCBVc2VkIHRvIHJlcGxhY2UgdGhpcyBSZXBsYWNlYWJsZSB3aXRoIGFub3RoZXIgb25lLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKGNvbnRlbnQsIHBhcmVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdjb250ZW50JywgY29udGVudFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3BhcmVudCcsIHBhcmVudFxuICAgICAgaWYgbm90IChwcmV2PyBhbmQgbmV4dD8gYW5kIGNvbnRlbnQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgY29udGVudCwgcHJldiwgYW5kIG5leHQgZm9yIFJlcGxhY2VhYmxlLXR5cGVzIVwiXG4gICAgICBzdXBlciB1aWQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgUmV0dXJuIHRoZSBjb250ZW50IHRoYXQgdGhpcyBvcGVyYXRpb24gaG9sZHMuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgQGNvbnRlbnRcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyByZXBsYWNlYWJsZSB3aXRoIG5ldyBjb250ZW50LlxuICAgICNcbiAgICByZXBsYWNlOiAoY29udGVudCktPlxuICAgICAgQHBhcmVudC5yZXBsYWNlIGNvbnRlbnRcblxuICAgICNcbiAgICAjIElmIHBvc3NpYmxlIHNldCB0aGUgcmVwbGFjZSBtYW5hZ2VyIGluIHRoZSBjb250ZW50LlxuICAgICMgQHNlZSBXb3JkLnNldFJlcGxhY2VNYW5hZ2VyXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgQGNvbnRlbnQuc2V0UmVwbGFjZU1hbmFnZXI/KEBwYXJlbnQpXG4gICAgICAgIHN1cGVyXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlYWJsZVwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudC5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuXG4gIHR5cGVzWydMaXN0TWFuYWdlciddID0gTGlzdE1hbmFnZXJcbiAgdHlwZXNbJ01hcE1hbmFnZXInXSA9IE1hcE1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VNYW5hZ2VyJ10gPSBSZXBsYWNlTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZWFibGUnXSA9IFJlcGxhY2VhYmxlXG5cbiAgYmFzaWNfdHlwZXNcblxuXG5cblxuXG5cbiIsInN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHN0cnVjdHVyZWRfdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHN0cnVjdHVyZWRfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEF0IHRoZSBtb21lbnQgVGV4dERlbGV0ZSB0eXBlIGVxdWFscyB0aGUgRGVsZXRlIHR5cGUgaW4gQmFzaWNUeXBlcy5cbiAgIyBAc2VlIEJhc2ljVHlwZXMuRGVsZXRlXG4gICNcbiAgY2xhc3MgVGV4dERlbGV0ZSBleHRlbmRzIHR5cGVzLkRlbGV0ZVxuICBwYXJzZXJbXCJUZXh0RGVsZXRlXCJdID0gcGFyc2VyW1wiRGVsZXRlXCJdXG5cbiAgI1xuICAjICBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyBUZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKClcbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudFxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlRleHRJbnNlcnRcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBUZXh0SW5zZXJ0IGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEhhbmRsZXMgYSBUZXh0LWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgI1xuICBjbGFzcyBXb3JkIGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkXG4gICAgI1xuICAgIGluc2VydFRleHQ6IChwb3NpdGlvbiwgY29udGVudCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgIG9wID0gbmV3IFRleHRJbnNlcnQgYywgdW5kZWZpbmVkLCBvLnByZXZfY2wsIG9cbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG5cbiAgICAgIGRlbGV0ZV9vcHMgPSBbXVxuICAgICAgZm9yIGkgaW4gWzAuLi5sZW5ndGhdXG4gICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICBicmVha1xuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgbm90IChvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyKSBhbmQgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZGVsZXRlX29wcy5wdXNoIGQuX2VuY29kZSgpXG4gICAgICBkZWxldGVfb3BzXG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgd29yZCB3aXRoIGFub3RoZXIgb25lLiBDb25jdXJyZW50IHJlcGxhY2VtZW50cyBhcmUgbm90IG1lcmdlZCFcbiAgICAjIE9ubHkgb25lIG9mIHRoZSByZXBsYWNlbWVudHMgd2lsbCBiZSB1c2VkLlxuICAgICNcbiAgICAjIENhbiBvbmx5IGJlIHVzZWQgaWYgdGhlIFJlcGxhY2VNYW5hZ2VyIHdhcyBzZXQhXG4gICAgIyBAc2VlIFdvcmQuc2V0UmVwbGFjZU1hbmFnZXJcbiAgICAjXG4gICAgcmVwbGFjZVRleHQ6ICh0ZXh0KS0+XG4gICAgICBpZiBAcmVwbGFjZV9tYW5hZ2VyP1xuICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBXb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgIHdvcmQuaW5zZXJ0VGV4dCAwLCB0ZXh0XG4gICAgICAgIEByZXBsYWNlX21hbmFnZXIucmVwbGFjZSh3b3JkKVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGlzIHR5cGUgaXMgY3VycmVudGx5IG5vdCBtYWludGFpbmVkIGJ5IGEgUmVwbGFjZU1hbmFnZXIhXCJcblxuICAgICNcbiAgICAjIEByZXR1cm5zIFtKc29uXSBBIEpzb24gb2JqZWN0LlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIGMgPSBmb3IgbyBpbiBAdG9BcnJheSgpXG4gICAgICAgIGlmIG8udmFsP1xuICAgICAgICAgIG8udmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIFwiXCJcbiAgICAgIGMuam9pbignJylcblxuICAgICNcbiAgICAjIEluIG1vc3QgY2FzZXMgeW91IHdvdWxkIGVtYmVkIGEgV29yZCBpbiBhIFJlcGxhY2VhYmxlLCB3aWNoIGlzIGhhbmRsZWQgYnkgdGhlIFJlcGxhY2VNYW5hZ2VyIGluIG9yZGVyXG4gICAgIyB0byBwcm92aWRlIHJlcGxhY2UgZnVuY3Rpb25hbGl0eS5cbiAgICAjXG4gICAgc2V0UmVwbGFjZU1hbmFnZXI6IChvcCktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3JlcGxhY2VfbWFuYWdlcicsIG9wXG4gICAgICBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnNcblxuICAgICNcbiAgICAjIEJpbmQgdGhpcyBXb3JkIHRvIGEgdGV4dGZpZWxkLlxuICAgICNcbiAgICBiaW5kOiAodGV4dGZpZWxkKS0+XG4gICAgICB3b3JkID0gQFxuICAgICAgdGV4dGZpZWxkLnZhbHVlID0gQHZhbCgpXG5cbiAgICAgIEBvbiBcImluc2VydFwiLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIG9fcG9zID0gb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgaWYgY3Vyc29yIDw9IG9fcG9zXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjdXJzb3IgKz0gMVxuICAgICAgICAgICAgY3Vyc29yXG4gICAgICAgIGxlZnQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0XG4gICAgICAgIHJpZ2h0ID0gZml4IHRleHRmaWVsZC5zZWxlY3Rpb25FbmRcblxuICAgICAgICB0ZXh0ZmllbGQudmFsdWUgPSB3b3JkLnZhbCgpXG4gICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBsZWZ0LCByaWdodFxuXG5cbiAgICAgIEBvbiBcImRlbGV0ZVwiLCAoZXZlbnQsIG9wKS0+XG4gICAgICAgIG9fcG9zID0gb3AuZ2V0UG9zaXRpb24oKVxuICAgICAgICBmaXggPSAoY3Vyc29yKS0+XG4gICAgICAgICAgaWYgY3Vyc29yIDwgb19wb3NcbiAgICAgICAgICAgIGN1cnNvclxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGN1cnNvciAtPSAxXG4gICAgICAgICAgICBjdXJzb3JcbiAgICAgICAgbGVmdCA9IGZpeCB0ZXh0ZmllbGQuc2VsZWN0aW9uU3RhcnRcbiAgICAgICAgcmlnaHQgPSBmaXggdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuXG4gICAgICAgIHRleHRmaWVsZC52YWx1ZSA9IHdvcmQudmFsKClcbiAgICAgICAgdGV4dGZpZWxkLnNldFNlbGVjdGlvblJhbmdlIGxlZnQsIHJpZ2h0XG5cbiAgICAgICMgY29uc3VtZSBhbGwgdGV4dC1pbnNlcnQgY2hhbmdlcy5cbiAgICAgIHRleHRmaWVsZC5vbmtleXByZXNzID0gKGV2ZW50KS0+XG4gICAgICAgIGNoYXIgPSBudWxsXG4gICAgICAgIGlmIGV2ZW50LmtleT9cbiAgICAgICAgICBpZiBldmVudC5jaGFyQ29kZSBpcyAzMlxuICAgICAgICAgICAgY2hhciA9IFwiIFwiXG4gICAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlIGlzIDEzXG4gICAgICAgICAgICBjaGFyID0gJ1xcbidcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjaGFyID0gZXZlbnQua2V5XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBjaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZSBldmVudC5rZXlDb2RlXG4gICAgICAgIGlmIGNoYXIubGVuZ3RoID4gMFxuICAgICAgICAgIHBvcyA9IE1hdGgubWluIHRleHRmaWVsZC5zZWxlY3Rpb25TdGFydCwgdGV4dGZpZWxkLnNlbGVjdGlvbkVuZFxuICAgICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCAocG9zKSwgZGlmZlxuICAgICAgICAgIHdvcmQuaW5zZXJ0VGV4dCBwb3MsIGNoYXJcbiAgICAgICAgICBuZXdfcG9zID0gcG9zICsgY2hhci5sZW5ndGhcbiAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgdGV4dGZpZWxkLm9ucGFzdGUgPSAoZXZlbnQpLT5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuICAgICAgdGV4dGZpZWxkLm9uY3V0ID0gKGV2ZW50KS0+XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgICAgI1xuICAgICAgIyBjb25zdW1lIGRlbGV0ZXMuIE5vdGUgdGhhdFxuICAgICAgIyAgIGNocm9tZTogd29uJ3QgY29uc3VtZSBkZWxldGlvbnMgb24ga2V5cHJlc3MgZXZlbnQuXG4gICAgICAjICAga2V5Q29kZSBpcyBkZXByZWNhdGVkLiBCVVQ6IEkgZG9uJ3Qgc2VlIGFub3RoZXIgd2F5LlxuICAgICAgIyAgICAgc2luY2UgZXZlbnQua2V5IGlzIG5vdCBpbXBsZW1lbnRlZCBpbiB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIGNocm9tZS5cbiAgICAgICMgICAgIEV2ZXJ5IGJyb3dzZXIgc3VwcG9ydHMga2V5Q29kZS4gTGV0J3Mgc3RpY2sgd2l0aCBpdCBmb3Igbm93Li5cbiAgICAgICNcbiAgICAgIHRleHRmaWVsZC5vbmtleWRvd24gPSAoZXZlbnQpLT5cbiAgICAgICAgcG9zID0gTWF0aC5taW4gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0LCB0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kXG4gICAgICAgIGRpZmYgPSBNYXRoLmFicyh0ZXh0ZmllbGQuc2VsZWN0aW9uRW5kIC0gdGV4dGZpZWxkLnNlbGVjdGlvblN0YXJ0KVxuICAgICAgICBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA4ICMgQmFja3NwYWNlXG4gICAgICAgICAgaWYgZGlmZiA+IDBcbiAgICAgICAgICAgIHdvcmQuZGVsZXRlVGV4dCBwb3MsIGRpZmZcbiAgICAgICAgICAgIHRleHRmaWVsZC5zZXRTZWxlY3Rpb25SYW5nZSBwb3MsIHBvc1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIGlmIGV2ZW50LmN0cmxLZXk/IGFuZCBldmVudC5jdHJsS2V5XG4gICAgICAgICAgICAgIHZhbCA9IHRleHRmaWVsZC52YWx1ZVxuICAgICAgICAgICAgICBuZXdfcG9zID0gcG9zXG4gICAgICAgICAgICAgIGRlbF9sZW5ndGggPSAwXG4gICAgICAgICAgICAgIGlmIHBvcyA+IDBcbiAgICAgICAgICAgICAgICBuZXdfcG9zLS1cbiAgICAgICAgICAgICAgICBkZWxfbGVuZ3RoKytcbiAgICAgICAgICAgICAgd2hpbGUgbmV3X3BvcyA+IDAgYW5kIHZhbFtuZXdfcG9zXSBpc250IFwiIFwiIGFuZCB2YWxbbmV3X3Bvc10gaXNudCAnXFxuJ1xuICAgICAgICAgICAgICAgIG5ld19wb3MtLVxuICAgICAgICAgICAgICAgIGRlbF9sZW5ndGgrK1xuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgbmV3X3BvcywgKHBvcy1uZXdfcG9zKVxuICAgICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgbmV3X3BvcywgbmV3X3Bvc1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgKHBvcy0xKSwgMVxuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgZWxzZSBpZiBldmVudC5rZXlDb2RlPyBhbmQgZXZlbnQua2V5Q29kZSBpcyA0NiAjIERlbGV0ZVxuICAgICAgICAgIGlmIGRpZmYgPiAwXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCBkaWZmXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB3b3JkLmRlbGV0ZVRleHQgcG9zLCAxXG4gICAgICAgICAgICB0ZXh0ZmllbGQuc2V0U2VsZWN0aW9uUmFuZ2UgcG9zLCBwb3NcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cblxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIldvcmRcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnV29yZCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBXb3JkIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkJ10gPSBXb3JkXG4gIHN0cnVjdHVyZWRfdHlwZXNcblxuXG4iXX0=
