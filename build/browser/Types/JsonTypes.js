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
      var f, _i, _len, _ref, _results;
      if (this.event_listeners[event] != null) {
        _ref = this.event_listeners[event];
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          f = _ref[_i];
          _results.push(f.call(this, event, args));
        }
        return _results;
      }
    };

    Operation.prototype.setParent = function(o) {
      return this.parent = o;
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
        Delete.__super__.execute.apply(this, arguments);
        return this;
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
      return this.deleted_by.push(o);
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
      var distance_to_origin, i, o, _ref, _ref1;
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
        Insert.__super__.execute.apply(this, arguments);
        return this;
      }
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
      if (position > 0) {
        while (true) {
          o = o.next_cl;
          if (!o.isDeleted()) {
            position -= 1;
          }
          if (position === 0) {
            break;
          }
          if (o instanceof types.Delimiter) {
            throw new Error("position parameter exceeded the length of the document!");
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
        Replaceable.__super__.execute.apply(this, arguments);
        return this;
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
      var d, i, o, _i, _results;
      o = this.getOperationByPosition(position);
      _results = [];
      for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
        d = HB.addOperation(new TextDelete(void 0, o)).execute();
        o = o.next_cl;
        while (o.isDeleted()) {
          if (o instanceof types.Delimiter) {
            throw new Error("You can't delete more than there is..");
          }
          o = o.next_cl;
        }
        _results.push(d._encode());
      }
      return _results;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL2Rtb25hZC9Ecm9wYm94L1lhdHRhIS9ub2RlX21vZHVsZXMvZ3VscC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9kbW9uYWQvRHJvcGJveC9ZYXR0YSEvbGliL1R5cGVzL0Jhc2ljVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9Kc29uVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9TdHJ1Y3R1cmVkVHlwZXMuY29mZmVlIiwiL2hvbWUvZG1vbmFkL0Ryb3Bib3gvWWF0dGEhL2xpYi9UeXBlcy9UZXh0VHlwZXMuY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsSUFBQTtpU0FBQTs7QUFBQSxNQUFNLENBQUMsT0FBUCxHQUFpQixTQUFDLEVBQUQsR0FBQTtBQUVmLE1BQUEsaUZBQUE7QUFBQSxFQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7QUFBQSxFQUNBLGtCQUFBLEdBQXFCLEVBRHJCLENBQUE7QUFBQSxFQWFNO0FBTVMsSUFBQSxtQkFBQyxHQUFELEdBQUE7QUFDWCxNQUFBLElBQU8sV0FBUDtBQUNFLFFBQUEsR0FBQSxHQUFNLEVBQUUsQ0FBQywwQkFBSCxDQUFBLENBQU4sQ0FERjtPQUFBO0FBQUEsTUFHYSxJQUFDLENBQUEsY0FBWixVQURGLEVBRWdCLElBQUMsQ0FBQSxnQkFBZixZQUpGLENBRFc7SUFBQSxDQUFiOztBQUFBLHdCQWFBLEVBQUEsR0FBSSxTQUFDLEtBQUQsRUFBUSxDQUFSLEdBQUE7QUFDRixVQUFBLEtBQUE7O1FBQUEsSUFBQyxDQUFBLGtCQUFtQjtPQUFwQjs7YUFDaUIsQ0FBQSxLQUFBLElBQVU7T0FEM0I7YUFFQSxJQUFDLENBQUEsZUFBZ0IsQ0FBQSxLQUFBLENBQU0sQ0FBQyxJQUF4QixDQUE2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cmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICAjIEBzZWUgRW5naW5lLnBhcnNlXG4gIHBhcnNlciA9IHt9XG4gIGV4ZWN1dGlvbl9saXN0ZW5lciA9IFtdXG5cbiAgI1xuICAjIEEgZ2VuZXJpYyBpbnRlcmZhY2UgdG8gb3BlcmF0aW9ucy5cbiAgI1xuICAjIEFuIG9wZXJhdGlvbiBoYXMgdGhlIGZvbGxvd2luZyBtZXRob2RzOlxuICAjIF9lbmNvZGU6IGVuY29kZXMgYW4gb3BlcmF0aW9uIChuZWVkZWQgb25seSBpZiBpbnN0YW5jZSBvZiB0aGlzIG9wZXJhdGlvbiBpcyBzZW50KS5cbiAgIyBleGVjdXRlOiBleGVjdXRlIHRoZSBlZmZlY3RzIG9mIHRoaXMgb3BlcmF0aW9ucy4gR29vZCBleGFtcGxlcyBhcmUgSW5zZXJ0LXR5cGUgYW5kIEFkZE5hbWUtdHlwZVxuICAjIHZhbDogaW4gdGhlIGNhc2UgdGhhdCB0aGUgb3BlcmF0aW9uIGhvbGRzIGEgdmFsdWVcbiAgI1xuICAjIEZ1cnRoZXJtb3JlIGFuIGVuY29kYWJsZSBvcGVyYXRpb24gaGFzIGEgcGFyc2VyLlxuICAjXG4gIGNsYXNzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkKS0+XG4gICAgICBpZiBub3QgdWlkP1xuICAgICAgICB1aWQgPSBIQi5nZXROZXh0T3BlcmF0aW9uSWRlbnRpZmllcigpXG4gICAgICB7XG4gICAgICAgICdjcmVhdG9yJzogQGNyZWF0b3JcbiAgICAgICAgJ29wX251bWJlcicgOiBAb3BfbnVtYmVyXG4gICAgICB9ID0gdWlkXG5cbiAgICAjXG4gICAgIyBBZGQgYW4gZXZlbnQgbGlzdGVuZXIuIEl0IGRlcGVuZHMgb24gdGhlIG9wZXJhdGlvbiB3aGljaCBldmVudHMgYXJlIHN1cHBvcnRlZC5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBldmVudCBOYW1lIG9mIHRoZSBldmVudC5cbiAgICAjIEBwYXJhbSB7RnVuY3Rpb259IGYgZiBpcyBleGVjdXRlZCBpbiBjYXNlIHRoZSBldmVudCBmaXJlcy5cbiAgICAjXG4gICAgb246IChldmVudCwgZiktPlxuICAgICAgQGV2ZW50X2xpc3RlbmVycyA/PSB7fVxuICAgICAgQGV2ZW50X2xpc3RlbmVyc1tldmVudF0gPz0gW11cbiAgICAgIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdLnB1c2ggZlxuXG4gICAgI1xuICAgICMgRmlyZSBhbiBldmVudC5cbiAgICAjIFRPRE86IERvIHNvbWV0aGluZyB3aXRoIHRpbWVvdXRzLiBZb3UgZG9uJ3Qgd2FudCB0aGlzIHRvIGZpcmUgZm9yIGV2ZXJ5IG9wZXJhdGlvbiAoZS5nLiBpbnNlcnQpLlxuICAgICNcbiAgICBjYWxsRXZlbnQ6IChldmVudCwgYXJncyktPlxuICAgICAgaWYgQGV2ZW50X2xpc3RlbmVyc1tldmVudF0/XG4gICAgICAgIGZvciBmIGluIEBldmVudF9saXN0ZW5lcnNbZXZlbnRdXG4gICAgICAgICAgZi5jYWxsIEAsIGV2ZW50LCBhcmdzXG5cbiAgICAjXG4gICAgIyBTZXQgdGhlIHBhcmVudCBvZiB0aGlzIG9wZXJhdGlvbi5cbiAgICAjXG4gICAgc2V0UGFyZW50OiAobyktPlxuICAgICAgQHBhcmVudCA9IG9cblxuICAgICNcbiAgICAjIENvbXB1dGVzIGEgdW5pcXVlIGlkZW50aWZpZXIgKHVpZCkgdGhhdCBpZGVudGlmaWVzIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRVaWQ6ICgpLT5cbiAgICAgIHsgJ2NyZWF0b3InOiBAY3JlYXRvciwgJ29wX251bWJlcic6IEBvcF9udW1iZXIgfVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIE5vdGlmeSB0aGUgYWxsIHRoZSBsaXN0ZW5lcnMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIEBpc19leGVjdXRlZCA9IHRydWVcbiAgICAgIGZvciBsIGluIGV4ZWN1dGlvbl9saXN0ZW5lclxuICAgICAgICBsIEBfZW5jb2RlKClcbiAgICAgIEBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBPcGVyYXRpb25zIG1heSBkZXBlbmQgb24gb3RoZXIgb3BlcmF0aW9ucyAobGlua2VkIGxpc3RzLCBldGMuKS5cbiAgICAjIFRoZSBzYXZlT3BlcmF0aW9uIGFuZCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucyBtZXRob2RzIHByb3ZpZGVcbiAgICAjIGFuIGVhc3kgd2F5IHRvIHJlZmVyIHRvIHRoZXNlIG9wZXJhdGlvbnMgdmlhIGFuIHVpZCBvciBvYmplY3QgcmVmZXJlbmNlLlxuICAgICNcbiAgICAjIEZvciBleGFtcGxlOiBXZSBjYW4gY3JlYXRlIGEgbmV3IERlbGV0ZSBvcGVyYXRpb24gdGhhdCBkZWxldGVzIHRoZSBvcGVyYXRpb24gJG8gbGlrZSB0aGlzXG4gICAgIyAgICAgLSB2YXIgZCA9IG5ldyBEZWxldGUodWlkLCAkbyk7ICAgb3JcbiAgICAjICAgICAtIHZhciBkID0gbmV3IERlbGV0ZSh1aWQsICRvLmdldFVpZCgpKTtcbiAgICAjIEVpdGhlciB3YXkgd2Ugd2FudCB0byBhY2Nlc3MgJG8gdmlhIGQuZGVsZXRlcy4gSW4gdGhlIHNlY29uZCBjYXNlIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zIG11c3QgYmUgY2FsbGVkIGZpcnN0LlxuICAgICNcbiAgICAjIEBvdmVybG9hZCBzYXZlT3BlcmF0aW9uKG5hbWUsIG9wX3VpZClcbiAgICAjICAgQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIG9wZXJhdGlvbi4gQWZ0ZXIgdmFsaWRhdGluZyAod2l0aCB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucykgdGhlIGluc3RhbnRpYXRlZCBvcGVyYXRpb24gd2lsbCBiZSBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09iamVjdH0gb3BfdWlkIEEgdWlkIHRoYXQgcmVmZXJzIHRvIGFuIG9wZXJhdGlvblxuICAgICMgQG92ZXJsb2FkIHNhdmVPcGVyYXRpb24obmFtZSwgb3ApXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpb24uIEFmdGVyIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiBvcCBpcyBhY2Nlc3NpYmxlIHZpYSB0aGlzW25hbWVdLlxuICAgICMgICBAcGFyYW0ge09wZXJhdGlvbn0gb3AgQW4gT3BlcmF0aW9uIG9iamVjdFxuICAgICNcbiAgICBzYXZlT3BlcmF0aW9uOiAobmFtZSwgb3ApLT5cblxuICAgICAgI1xuICAgICAgIyBFdmVyeSBpbnN0YW5jZSBvZiAkT3BlcmF0aW9uIG11c3QgaGF2ZSBhbiAkZXhlY3V0ZSBmdW5jdGlvbi5cbiAgICAgICMgV2UgdXNlIGR1Y2stdHlwaW5nIHRvIGNoZWNrIGlmIG9wIGlzIGluc3RhbnRpYXRlZCBzaW5jZSB0aGVyZVxuICAgICAgIyBjb3VsZCBleGlzdCBtdWx0aXBsZSBjbGFzc2VzIG9mICRPcGVyYXRpb25cbiAgICAgICNcbiAgICAgIGlmIG9wPy5leGVjdXRlP1xuICAgICAgICAjIGlzIGluc3RhbnRpYXRlZFxuICAgICAgICBAW25hbWVdID0gb3BcbiAgICAgIGVsc2UgaWYgb3A/XG4gICAgICAgICMgbm90IGluaXRpYWxpemVkLiBEbyBpdCB3aGVuIGNhbGxpbmcgJHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgQHVuY2hlY2tlZCA/PSB7fVxuICAgICAgICBAdW5jaGVja2VkW25hbWVdID0gb3BcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBZnRlciBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWxsIG5vdCBpbnN0YW50aWF0ZWQgb3BlcmF0aW9ucyB3aWxsIGJlIGFjY2Vzc2libGUuXG4gICAgIyBAc2VlIE9wZXJhdGlvbi5zYXZlT3BlcmF0aW9uXG4gICAgI1xuICAgICMgQHJldHVybiBbQm9vbGVhbl0gV2hldGhlciBpdCB3YXMgcG9zc2libGUgdG8gaW5zdGFudGlhdGUgYWxsIG9wZXJhdGlvbnMuXG4gICAgI1xuICAgIHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zOiAoKS0+XG4gICAgICB1bmluc3RhbnRpYXRlZCA9IHt9XG4gICAgICBzdWNjZXNzID0gQFxuICAgICAgZm9yIG5hbWUsIG9wX3VpZCBvZiBAdW5jaGVja2VkXG4gICAgICAgIG9wID0gSEIuZ2V0T3BlcmF0aW9uIG9wX3VpZFxuICAgICAgICBpZiBvcFxuICAgICAgICAgIEBbbmFtZV0gPSBvcFxuICAgICAgICBlbHNlXG4gICAgICAgICAgdW5pbnN0YW50aWF0ZWRbbmFtZV0gPSBvcF91aWRcbiAgICAgICAgICBzdWNjZXNzID0gZmFsc2VcbiAgICAgIGRlbGV0ZSBAdW5jaGVja2VkXG4gICAgICBpZiBub3Qgc3VjY2Vzc1xuICAgICAgICBAdW5jaGVja2VkID0gdW5pbnN0YW50aWF0ZWRcbiAgICAgIHN1Y2Nlc3NcblxuXG5cbiAgI1xuICAjIEEgc2ltcGxlIERlbGV0ZS10eXBlIG9wZXJhdGlvbiB0aGF0IGRlbGV0ZXMgYW4gSW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gIGNsYXNzIERlbGV0ZSBleHRlbmRzIE9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGRlbGV0ZXMgVUlEIG9yIHJlZmVyZW5jZSBvZiB0aGUgb3BlcmF0aW9uIHRoYXQgdGhpcyB0byBiZSBkZWxldGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgZGVsZXRlcyktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ2RlbGV0ZXMnLCBkZWxldGVzXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBDb252ZXJ0IGFsbCByZWxldmFudCBpbmZvcm1hdGlvbiBvZiB0aGlzIG9wZXJhdGlvbiB0byB0aGUganNvbi1mb3JtYXQuXG4gICAgIyBUaGlzIHJlc3VsdCBjYW4gYmUgc2VudCB0byBvdGhlciBjbGllbnRzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICB7XG4gICAgICAgICd0eXBlJzogXCJEZWxldGVcIlxuICAgICAgICAndWlkJzogQGdldFVpZCgpXG4gICAgICAgICdkZWxldGVzJzogQGRlbGV0ZXMuZ2V0VWlkKClcbiAgICAgIH1cblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBBcHBseSB0aGUgZGVsZXRpb24uXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIEBkZWxldGVzLmFwcGx5RGVsZXRlIEBcbiAgICAgICAgc3VwZXJcbiAgICAgICAgQFxuICAgICAgZWxzZVxuICAgICAgICBmYWxzZVxuXG4gICNcbiAgIyBEZWZpbmUgaG93IHRvIHBhcnNlIERlbGV0ZSBvcGVyYXRpb25zLlxuICAjXG4gIHBhcnNlclsnRGVsZXRlJ10gPSAobyktPlxuICAgIHtcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAnZGVsZXRlcyc6IGRlbGV0ZXNfdWlkXG4gICAgfSA9IG9cbiAgICBuZXcgRGVsZXRlIHVpZCwgZGVsZXRlc191aWRcblxuICAjXG4gICMgQSBzaW1wbGUgaW5zZXJ0LXR5cGUgb3BlcmF0aW9uLlxuICAjXG4gICMgQW4gaW5zZXJ0IG9wZXJhdGlvbiBpcyBhbHdheXMgcG9zaXRpb25lZCBiZXR3ZWVuIHR3byBvdGhlciBpbnNlcnQgb3BlcmF0aW9ucy5cbiAgIyBJbnRlcm5hbGx5IHRoaXMgaXMgcmVhbGl6ZWQgYXMgYXNzb2NpYXRpdmUgbGlzdHMsIHdoZXJlYnkgZWFjaCBpbnNlcnQgb3BlcmF0aW9uIGhhcyBhIHByZWRlY2Vzc29yIGFuZCBhIHN1Y2Nlc3Nvci5cbiAgIyBGb3IgdGhlIHNha2Ugb2YgZWZmaWNpZW5jeSB3ZSBtYWludGFpbiB0d28gbGlzdHM6XG4gICMgICAtIFRoZSBzaG9ydC1saXN0IChhYmJyZXYuIHNsKSBtYWludGFpbnMgb25seSB0aGUgb3BlcmF0aW9ucyB0aGF0IGFyZSBub3QgZGVsZXRlZFxuICAjICAgLSBUaGUgY29tcGxldGUtbGlzdCAoYWJicmV2LiBjbCkgbWFpbnRhaW5zIGFsbCBvcGVyYXRpb25zXG4gICNcbiAgY2xhc3MgSW5zZXJ0IGV4dGVuZHMgT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gcHJldl9jbCBUaGUgcHJlZGVjZXNzb3Igb2YgdGhpcyBvcGVyYXRpb24gaW4gdGhlIGNvbXBsZXRlLWxpc3QgKGNsKVxuICAgICMgQHBhcmFtIHtPcGVyYXRpb259IG5leHRfY2wgVGhlIHN1Y2Nlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgI1xuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLmdldE5leHRPcGVyYXRpb25JZGVudGlmaWVyXG4gICAgI1xuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBwcmV2X2NsLCBuZXh0X2NsLCBvcmlnaW4pLT5cbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwcmV2X2NsJywgcHJldl9jbFxuICAgICAgQHNhdmVPcGVyYXRpb24gJ25leHRfY2wnLCBuZXh0X2NsXG4gICAgICBpZiBvcmlnaW4/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBvcmlnaW5cbiAgICAgIGVsc2VcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ29yaWdpbicsIHByZXZfY2xcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgYXBwbHlEZWxldGU6IChvKS0+XG4gICAgICBAZGVsZXRlZF9ieSA/PSBbXVxuICAgICAgQGRlbGV0ZWRfYnkucHVzaCBvXG5cbiAgICAjXG4gICAgIyBJZiBpc0RlbGV0ZWQoKSBpcyB0cnVlIHRoaXMgb3BlcmF0aW9uIHdvbid0IGJlIG1haW50YWluZWQgaW4gdGhlIHNsXG4gICAgI1xuICAgIGlzRGVsZXRlZDogKCktPlxuICAgICAgQGRlbGV0ZWRfYnk/Lmxlbmd0aCA+IDBcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgIyBUaGUgYW1vdW50IG9mIHBvc2l0aW9ucyB0aGF0ICR0aGlzIG9wZXJhdGlvbiB3YXMgbW92ZWQgdG8gdGhlIHJpZ2h0LlxuICAgICNcbiAgICBnZXREaXN0YW5jZVRvT3JpZ2luOiAoKS0+XG4gICAgICBkID0gMFxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB3aGlsZSB0cnVlXG4gICAgICAgIGlmIEBvcmlnaW4gaXMgb1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGQrK1xuICAgICAgICAjVE9ETzogZGVsZXRlIHRoaXNcbiAgICAgICAgaWYgQCBpcyBAcHJldl9jbFxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcInRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gOykgXCJcbiAgICAgICAgbyA9IG8ucHJldl9jbFxuICAgICAgZFxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjIFVwZGF0ZSB0aGUgc2hvcnQgbGlzdFxuICAgICMgVE9ETyAoVW51c2VkKVxuICAgIHVwZGF0ZV9zbDogKCktPlxuICAgICAgbyA9IEBwcmV2X2NsXG4gICAgICB1cGRhdGU6IChkZXN0X2NsLGRlc3Rfc2wpLT5cbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgIGlmIG8uaXNEZWxldGVkKClcbiAgICAgICAgICAgIG8gPSBvW2Rlc3RfY2xdXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgQFtkZXN0X3NsXSA9IG9cblxuICAgICAgICAgICAgYnJlYWtcbiAgICAgIHVwZGF0ZSBcInByZXZfY2xcIiwgXCJwcmV2X3NsXCJcbiAgICAgIHVwZGF0ZSBcIm5leHRfY2xcIiwgXCJwcmV2X3NsXCJcblxuXG5cbiAgICAjXG4gICAgIyBAcHJpdmF0ZVxuICAgICMgSW5jbHVkZSB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICAgI1xuICAgIGV4ZWN1dGU6ICgpLT5cbiAgICAgIGlmIEBpc19leGVjdXRlZD9cbiAgICAgICAgcmV0dXJuIEBcbiAgICAgIGlmIG5vdCBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIGVsc2VcbiAgICAgICAgaWYgQHByZXZfY2w/LnZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKCkgYW5kIEBuZXh0X2NsPy52YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpIGFuZCBAcHJldl9jbC5uZXh0X2NsIGlzbnQgQFxuICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IDBcbiAgICAgICAgICBvID0gQHByZXZfY2wubmV4dF9jbFxuICAgICAgICAgIGkgPSAwXG4gICAgICAgICAgIyAkdGhpcyBoYXMgdG8gZmluZCBhIHVuaXF1ZSBwb3NpdGlvbiBiZXR3ZWVuIG9yaWdpbiBhbmQgdGhlIG5leHQga25vd24gY2hhcmFjdGVyXG4gICAgICAgICAgIyBjYXNlIDE6ICRvcmlnaW4gZXF1YWxzICRvLm9yaWdpbjogdGhlICRjcmVhdG9yIHBhcmFtZXRlciBkZWNpZGVzIGlmIGxlZnQgb3IgcmlnaHRcbiAgICAgICAgICAjICAgICAgICAgbGV0ICRPTD0gW28xLG8yLG8zLG80XSwgd2hlcmVieSAkdGhpcyBpcyB0byBiZSBpbnNlcnRlZCBiZXR3ZWVuIG8xIGFuZCBvNFxuICAgICAgICAgICMgICAgICAgICBvMixvMyBhbmQgbzQgb3JpZ2luIGlzIDEgKHRoZSBwb3NpdGlvbiBvZiBvMilcbiAgICAgICAgICAjICAgICAgICAgdGhlcmUgaXMgdGhlIGNhc2UgdGhhdCAkdGhpcy5jcmVhdG9yIDwgbzIuY3JlYXRvciwgYnV0IG8zLmNyZWF0b3IgPCAkdGhpcy5jcmVhdG9yXG4gICAgICAgICAgIyAgICAgICAgIHRoZW4gbzIga25vd3MgbzMuIFNpbmNlIG9uIGFub3RoZXIgY2xpZW50ICRPTCBjb3VsZCBiZSBbbzEsbzMsbzRdIHRoZSBwcm9ibGVtIGlzIGNvbXBsZXhcbiAgICAgICAgICAjICAgICAgICAgdGhlcmVmb3JlICR0aGlzIHdvdWxkIGJlIGFsd2F5cyB0byB0aGUgcmlnaHQgb2YgbzNcbiAgICAgICAgICAjIGNhc2UgMjogJG9yaWdpbiA8ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICBpZiBjdXJyZW50ICR0aGlzIGluc2VydF9wb3NpdGlvbiA+ICRvIG9yaWdpbjogJHRoaXMgaW5zXG4gICAgICAgICAgIyAgICAgICAgIGVsc2UgJGluc2VydF9wb3NpdGlvbiB3aWxsIG5vdCBjaGFuZ2UgKG1heWJlIHdlIGVuY291bnRlciBjYXNlIDEgbGF0ZXIsIHRoZW4gdGhpcyB3aWxsIGJlIHRvIHRoZSByaWdodCBvZiAkbylcbiAgICAgICAgICAjIGNhc2UgMzogJG9yaWdpbiA+ICRvLm9yaWdpblxuICAgICAgICAgICMgICAgICAgICAkdGhpcyBpbnNlcnRfcG9zaXRpb24gaXMgdG8gdGhlIGxlZnQgb2YgJG8gKGZvcmV2ZXIhKVxuICAgICAgICAgIHdoaWxlIHRydWVcbiAgICAgICAgICAgIGlmIG5vdCBvP1xuICAgICAgICAgICAgICAjIFRPRE86IERlYnVnZ2luZ1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyBKU09OLnN0cmluZ2lmeSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgICAgICAgaWYgbyBpc250IEBuZXh0X2NsXG4gICAgICAgICAgICAgICMgJG8gaGFwcGVuZWQgY29uY3VycmVudGx5XG4gICAgICAgICAgICAgIGlmIG8uZ2V0RGlzdGFuY2VUb09yaWdpbigpIGlzIGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMVxuICAgICAgICAgICAgICAgIGlmIG8uY3JlYXRvciA8IEBjcmVhdG9yXG4gICAgICAgICAgICAgICAgICBAcHJldl9jbCA9IG9cbiAgICAgICAgICAgICAgICAgIGRpc3RhbmNlX3RvX29yaWdpbiA9IGkgKyAxXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgIyBub3BcbiAgICAgICAgICAgICAgZWxzZSBpZiBvLmdldERpc3RhbmNlVG9PcmlnaW4oKSA8IGlcbiAgICAgICAgICAgICAgICAjIGNhc2UgMlxuICAgICAgICAgICAgICAgIGlmIGkgLSBkaXN0YW5jZV90b19vcmlnaW4gPD0gby5nZXREaXN0YW5jZVRvT3JpZ2luKClcbiAgICAgICAgICAgICAgICAgIEBwcmV2X2NsID0gb1xuICAgICAgICAgICAgICAgICAgZGlzdGFuY2VfdG9fb3JpZ2luID0gaSArIDFcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAjbm9wXG4gICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAjIGNhc2UgM1xuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgICBvID0gby5uZXh0X2NsXG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICMgJHRoaXMga25vd3MgdGhhdCAkbyBleGlzdHMsXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgIyBub3cgcmVjb25uZWN0IGV2ZXJ5dGhpbmdcbiAgICAgICAgICBAbmV4dF9jbCA9IEBwcmV2X2NsLm5leHRfY2xcbiAgICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgICAgIEBuZXh0X2NsLnByZXZfY2wgPSBAXG4gICAgICAgIHN1cGVyICMgbm90aWZ5IHRoZSBleGVjdXRpb25fbGlzdGVuZXJzXG4gICAgICAgIEBcblxuICAjXG4gICMgRGVmaW5lcyBhbiBvYmplY3QgdGhhdCBpcyBjYW5ub3QgYmUgY2hhbmdlZC4gWW91IGNhbiB1c2UgdGhpcyB0byBzZXQgYW4gaW1tdXRhYmxlIHN0cmluZywgb3IgYSBudW1iZXIuXG4gICNcbiAgY2xhc3MgSW1tdXRhYmxlT2JqZWN0IGV4dGVuZHMgSW5zZXJ0XG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gY29udGVudFxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgQGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIEByZXR1cm4gW1N0cmluZ10gVGhlIGNvbnRlbnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgI1xuICAgIHZhbCA6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID0ge1xuICAgICAgICAndHlwZSc6IFwiSW1tdXRhYmxlT2JqZWN0XCJcbiAgICAgICAgJ3VpZCcgOiBAZ2V0VWlkKClcbiAgICAgICAgJ2NvbnRlbnQnIDogQGNvbnRlbnRcbiAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsP1xuICAgICAgICBqc29uWydwcmV2J10gPSBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyWydJbW11dGFibGVPYmplY3QnXSA9IChqc29uKS0+XG4gICAge1xuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdwcmV2JzogcHJldlxuICAgICAgJ25leHQnOiBuZXh0XG4gICAgICAnb3JpZ2luJyA6IG9yaWdpblxuICAgIH0gPSBqc29uXG4gICAgbmV3IEltbXV0YWJsZU9iamVjdCB1aWQsIGNvbnRlbnQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICNcbiAgIyBBIGRlbGltaXRlciBpcyBwbGFjZWQgYXQgdGhlIGVuZCBhbmQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXNzb2NpYXRpdmUgbGlzdHMuXG4gICMgVGhpcyBpcyBuZWNlc3NhcnkgaW4gb3JkZXIgdG8gaGF2ZSBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIGV2ZW4gaWYgdGhlIGNvbnRlbnRcbiAgIyBvZiB0aGUgRW5naW5lIGlzIGVtcHR5LlxuICAjXG4gIGNsYXNzIERlbGltaXRlciBleHRlbmRzIE9wZXJhdGlvblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBwcmV2X2NsIFRoZSBwcmVkZWNlc3NvciBvZiB0aGlzIG9wZXJhdGlvbiBpbiB0aGUgY29tcGxldGUtbGlzdCAoY2wpXG4gICAgIyBAcGFyYW0ge09wZXJhdGlvbn0gbmV4dF9jbCBUaGUgc3VjY2Vzc29yIG9mIHRoaXMgb3BlcmF0aW9uIGluIHRoZSBjb21wbGV0ZS1saXN0IChjbClcbiAgICAjXG4gICAgIyBAc2VlIEhpc3RvcnlCdWZmZXIuZ2V0TmV4dE9wZXJhdGlvbklkZW50aWZpZXJcbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIHByZXZfY2wsIG5leHRfY2wsIG9yaWdpbiktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ3ByZXZfY2wnLCBwcmV2X2NsXG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnbmV4dF9jbCcsIG5leHRfY2xcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdvcmlnaW4nLCBwcmV2X2NsXG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIElmIGlzRGVsZXRlZCgpIGlzIHRydWUgdGhpcyBvcGVyYXRpb24gd29uJ3QgYmUgbWFpbnRhaW5lZCBpbiB0aGUgc2xcbiAgICAjXG4gICAgaXNEZWxldGVkOiAoKS0+XG4gICAgICBmYWxzZVxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgQHVuY2hlY2tlZD9bJ25leHRfY2wnXT9cbiAgICAgICAgc3VwZXJcbiAgICAgIGVsc2UgaWYgQHVuY2hlY2tlZD9bJ3ByZXZfY2wnXVxuICAgICAgICBpZiBAdmFsaWRhdGVTYXZlZE9wZXJhdGlvbnMoKVxuICAgICAgICAgIGlmIEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJQcm9iYWJseSBkdXBsaWNhdGVkIG9wZXJhdGlvbnNcIlxuICAgICAgICAgIEBwcmV2X2NsLm5leHRfY2wgPSBAXG4gICAgICAgICAgZGVsZXRlIEBwcmV2X2NsLnVuY2hlY2tlZC5uZXh0X2NsXG4gICAgICAgICAgc3VwZXJcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGZhbHNlXG4gICAgICBlbHNlIGlmIEBwcmV2X2NsPyBhbmQgbm90IEBwcmV2X2NsLm5leHRfY2w/XG4gICAgICAgIGRlbGV0ZSBAcHJldl9jbC51bmNoZWNrZWQubmV4dF9jbFxuICAgICAgICBAcHJldl9jbC5uZXh0X2NsID0gQFxuICAgICAgZWxzZSBpZiBAcHJldl9jbD8gb3IgQG5leHRfY2w/XG4gICAgICAgIHN1cGVyXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIkRlbGltaXRlciBpcyB1bnN1ZmZpY2llbnQgZGVmaW5lZCFcIlxuXG4gICAgI1xuICAgICMgQHByaXZhdGVcbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkRlbGltaXRlclwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICdwcmV2JyA6IEBwcmV2X2NsPy5nZXRVaWQoKVxuICAgICAgICAnbmV4dCcgOiBAbmV4dF9jbD8uZ2V0VWlkKClcbiAgICAgIH1cblxuICBwYXJzZXJbJ0RlbGltaXRlciddID0gKGpzb24pLT5cbiAgICB7XG4gICAgJ3VpZCcgOiB1aWRcbiAgICAncHJldicgOiBwcmV2XG4gICAgJ25leHQnIDogbmV4dFxuICAgIH0gPSBqc29uXG4gICAgbmV3IERlbGltaXRlciB1aWQsIHByZXYsIG5leHRcblxuICAjIFRoaXMgaXMgd2hhdCB0aGlzIG1vZHVsZSBleHBvcnRzIGFmdGVyIGluaXRpYWxpemluZyBpdCB3aXRoIHRoZSBIaXN0b3J5QnVmZmVyXG4gIHtcbiAgICAndHlwZXMnIDpcbiAgICAgICdEZWxldGUnIDogRGVsZXRlXG4gICAgICAnSW5zZXJ0JyA6IEluc2VydFxuICAgICAgJ0RlbGltaXRlcic6IERlbGltaXRlclxuICAgICAgJ09wZXJhdGlvbic6IE9wZXJhdGlvblxuICAgICAgJ0ltbXV0YWJsZU9iamVjdCcgOiBJbW11dGFibGVPYmplY3RcbiAgICAncGFyc2VyJyA6IHBhcnNlclxuICAgICdleGVjdXRpb25fbGlzdGVuZXInIDogZXhlY3V0aW9uX2xpc3RlbmVyXG4gIH1cblxuXG5cblxuIiwidGV4dF90eXBlc191bmluaXRpYWxpemVkID0gcmVxdWlyZSBcIi4vVGV4dFR5cGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSAoSEIpLT5cbiAgdGV4dF90eXBlcyA9IHRleHRfdHlwZXNfdW5pbml0aWFsaXplZCBIQlxuICB0eXBlcyA9IHRleHRfdHlwZXMudHlwZXNcbiAgcGFyc2VyID0gdGV4dF90eXBlcy5wYXJzZXJcblxuICBjcmVhdGVKc29uV3JhcHBlciA9IChfanNvblR5cGUpLT5cblxuICAgICNcbiAgICAjIEEgSnNvbldyYXBwZXIgd2FzIGludGVuZGVkIHRvIGJlIGEgY29udmVuaWVudCB3cmFwcGVyIGZvciB0aGUgSnNvblR5cGUuXG4gICAgIyBCdXQgaXQgY2FuIG1ha2UgdGhpbmdzIG1vcmUgZGlmZmljdWx0IHRoYW4gdGhleSBhcmUuXG4gICAgIyBAc2VlIEpzb25UeXBlXG4gICAgI1xuICAgICMgQGV4YW1wbGUgY3JlYXRlIGEgSnNvbldyYXBwZXJcbiAgICAjICAgIyBZb3UgZ2V0IGEgSnNvbldyYXBwZXIgZnJvbSBhIEpzb25UeXBlIGJ5IGNhbGxpbmdcbiAgICAjICAgdyA9IHlhdHRhLnZhbHVlXG4gICAgI1xuICAgICMgSXQgY3JlYXRlcyBKYXZhc2NyaXB0cyAtZ2V0dGVyIGFuZCAtc2V0dGVyIG1ldGhvZHMgZm9yIGVhY2ggcHJvcGVydHkgdGhhdCBKc29uVHlwZSBtYWludGFpbnMuXG4gICAgIyBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9kZWZpbmVQcm9wZXJ0eVxuICAgICNcbiAgICAjIEBleGFtcGxlIEdldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBhY2Nlc3MgdGhlIHggcHJvcGVydHkgb2YgeWF0dGEgYnkgY2FsbGluZ1xuICAgICMgICB3LnhcbiAgICAjICAgIyBpbnN0ZWFkIG9mXG4gICAgIyAgIHlhdHRhLnZhbCgneCcpXG4gICAgI1xuICAgICMgQG5vdGUgWW91IGNhbiBvbmx5IG92ZXJ3cml0ZSBleGlzdGluZyB2YWx1ZXMhIFNldHRpbmcgYSBuZXcgcHJvcGVydHkgd29uJ3QgaGF2ZSBhbnkgZWZmZWN0IVxuICAgICNcbiAgICAjIEBleGFtcGxlIFNldHRlciBFeGFtcGxlXG4gICAgIyAgICMgeW91IGNhbiBzZXQgYW4gZXhpc3RpbmcgeCBwcm9wZXJ0eSBvZiB5YXR0YSBieSBjYWxsaW5nXG4gICAgIyAgIHcueCA9IFwidGV4dFwiXG4gICAgIyAgICMgaW5zdGVhZCBvZlxuICAgICMgICB5YXR0YS52YWwoJ3gnLCBcInRleHRcIilcbiAgICAjXG4gICAgIyBJbiBvcmRlciB0byBzZXQgYSBuZXcgcHJvcGVydHkgeW91IGhhdmUgdG8gb3ZlcndyaXRlIGFuIGV4aXN0aW5nIHByb3BlcnR5LlxuICAgICMgVGhlcmVmb3JlIHRoZSBKc29uV3JhcHBlciBzdXBwb3J0cyBhIHNwZWNpYWwgZmVhdHVyZSB0aGF0IHNob3VsZCBtYWtlIHRoaW5ncyBtb3JlIGNvbnZlbmllbnRcbiAgICAjICh3ZSBjYW4gYXJndWUgYWJvdXQgdGhhdCwgdXNlIHRoZSBKc29uVHlwZSBpZiB5b3UgZG9uJ3QgbGlrZSBpdCA7KS5cbiAgICAjIElmIHlvdSBvdmVyd3JpdGUgYW4gb2JqZWN0IHByb3BlcnR5IG9mIHRoZSBKc29uV3JhcHBlciB3aXRoIGEgbmV3IG9iamVjdCwgaXQgd2lsbCByZXN1bHQgaW4gYSBtZXJnZWQgdmVyc2lvbiBvZiB0aGUgb2JqZWN0cy5cbiAgICAjIExldCB3LnAgdGhlIHByb3BlcnR5IHRoYXQgaXMgdG8gYmUgb3ZlcndyaXR0ZW4gYW5kIG8gdGhlIG5ldyB2YWx1ZS4gRS5nLiB3LnAgPSBvXG4gICAgIyAqIFRoZSByZXN1bHQgaGFzIGFsbCBwcm9wZXJ0aWVzIG9mIG9cbiAgICAjICogVGhlIHJlc3VsdCBoYXMgYWxsIHByb3BlcnRpZXMgb2Ygdy5wIGlmIHRoZXkgZG9uJ3Qgb2NjdXIgdW5kZXIgdGhlIHNhbWUgcHJvcGVydHktbmFtZSBpbiBvLlxuICAgICNcbiAgICAjIEBleGFtcGxlIENvbmZsaWN0IEV4YW1wbGVcbiAgICAjICAgeWF0dGEudmFsdWUgPSB7YSA6IFwic3RyaW5nXCJ9XG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDogXCJzdHJpbmdcIn1cbiAgICAjICAgdy5hID0ge2EgOiB7YiA6IFwic3RyaW5nXCJ9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wifX1cbiAgICAjICAgdy5hID0ge2EgOiB7YyA6IDR9fVxuICAgICMgICBjb25zb2xlLmxvZyh3KSAjIHthIDoge2IgOiBcIlN0cmluZ1wiLCBjIDogNH19XG4gICAgI1xuICAgICMgQGV4YW1wbGUgQ29tbW9uIFBpdGZhbGxzXG4gICAgIyAgIHcgPSB5YXR0YS52YWx1ZVxuICAgICMgICAjIFNldHRpbmcgYSBuZXcgcHJvcGVydHlcbiAgICAjICAgdy5uZXdQcm9wZXJ0eSA9IFwiQXdlc29tZVwiXG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgZmFsc2UsIHcubmV3UHJvcGVydHkgaXMgdW5kZWZpbmVkXG4gICAgIyAgICMgb3ZlcndyaXRlIHRoZSB3IG9iamVjdFxuICAgICMgICB3ID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSEsIGJ1dCAuLlxuICAgICMgICBjb25zb2xlLmxvZyh5YXR0YS52YWx1ZS5uZXdQcm9wZXJ0eSA9PSBcIkF3ZXNvbWVcIikgIyBmYWxzZSwgeW91IGFyZSBvbmx5IGFsbG93ZWQgdG8gc2V0IHByb3BlcnRpZXMhXG4gICAgIyAgICMgVGhlIHNvbHV0aW9uXG4gICAgIyAgIHlhdHRhLnZhbHVlID0ge25ld1Byb3BlcnR5IDogXCJBd2Vzb21lXCJ9XG4gICAgIyAgIGNvbnNvbGUubG9nKHcubmV3UHJvcGVydHkgPT0gXCJBd2Vzb21lXCIpICMgdHJ1ZSFcbiAgICAjXG4gICAgY2xhc3MgSnNvbldyYXBwZXJcblxuICAgICAgI1xuICAgICAgIyBAcGFyYW0ge0pzb25UeXBlfSBqc29uVHlwZSBJbnN0YW5jZSBvZiB0aGUgSnNvblR5cGUgdGhhdCB0aGlzIGNsYXNzIHdyYXBwZXMuXG4gICAgICAjXG4gICAgICBjb25zdHJ1Y3RvcjogKGpzb25UeXBlKS0+XG4gICAgICAgIGZvciBuYW1lLCBvYmogb2YganNvblR5cGUubWFwXG4gICAgICAgICAgZG8gKG5hbWUsIG9iaiktPlxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5IEpzb25XcmFwcGVyLnByb3RvdHlwZSwgbmFtZSxcbiAgICAgICAgICAgICAgZ2V0IDogLT5cbiAgICAgICAgICAgICAgICB4ID0gb2JqLnZhbCgpXG4gICAgICAgICAgICAgICAgaWYgeCBpbnN0YW5jZW9mIEpzb25UeXBlXG4gICAgICAgICAgICAgICAgICBjcmVhdGVKc29uV3JhcHBlciB4XG4gICAgICAgICAgICAgICAgZWxzZSBpZiB4IGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0XG4gICAgICAgICAgICAgICAgICB4LnZhbCgpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgeFxuICAgICAgICAgICAgICBzZXQgOiAobyktPlxuICAgICAgICAgICAgICAgIGlmIG8uY29uc3RydWN0b3IgaXMge30uY29uc3RydWN0b3JcbiAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZSA9IGpzb25UeXBlLnZhbChuYW1lKVxuICAgICAgICAgICAgICAgICAgZm9yIG9fbmFtZSxvX29iaiBvZiBvXG4gICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZS52YWwob19uYW1lLCBvX29iaiwgJ2ltbXV0YWJsZScpXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAganNvblR5cGUudmFsKG5hbWUsIG8sICdpbW11dGFibGUnKVxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICBuZXcgSnNvbldyYXBwZXIgX2pzb25UeXBlXG5cbiAgI1xuICAjIE1hbmFnZXMgT2JqZWN0LWxpa2UgdmFsdWVzLlxuICAjXG4gIGNsYXNzIEpzb25UeXBlIGV4dGVuZHMgdHlwZXMuTWFwTWFuYWdlclxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtPYmplY3R9IGluaXRpYWxfdmFsdWUgQ3JlYXRlIHRoaXMgb3BlcmF0aW9uIHdpdGggYW4gaW5pdGlhbCB2YWx1ZS5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfEJvb2xlYW59IFdoZXRoZXIgdGhlIGluaXRpYWxfdmFsdWUgc2hvdWxkIGJlIGNyZWF0ZWQgYXMgbXV0YWJsZS4gKE9wdGlvbmFsIC0gc2VlIHNldE11dGFibGVEZWZhdWx0KVxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCwgaW5pdGlhbF92YWx1ZSwgbXV0YWJsZSktPlxuICAgICAgc3VwZXIgdWlkXG4gICAgICBpZiBpbml0aWFsX3ZhbHVlP1xuICAgICAgICBpZiB0eXBlb2YgaW5pdGlhbF92YWx1ZSBpc250IFwib2JqZWN0XCJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJUaGUgaW5pdGlhbCB2YWx1ZSBvZiBKc29uVHlwZXMgbXVzdCBiZSBvZiB0eXBlIE9iamVjdCEgKGN1cnJlbnQgdHlwZTogI3t0eXBlb2YgaW5pdGlhbF92YWx1ZX0pXCJcbiAgICAgICAgZm9yIG5hbWUsbyBvZiBpbml0aWFsX3ZhbHVlXG4gICAgICAgICAgQHZhbCBuYW1lLCBvLCBtdXRhYmxlXG5cbiAgICAjXG4gICAgIyBXaGV0aGVyIHRoZSBkZWZhdWx0IGlzICdtdXRhYmxlJyAodHJ1ZSkgb3IgJ2ltbXV0YWJsZScgKGZhbHNlKVxuICAgICNcbiAgICBtdXRhYmxlX2RlZmF1bHQ6XG4gICAgICB0cnVlXG5cbiAgICAjXG4gICAgIyBTZXQgaWYgdGhlIGRlZmF1bHQgaXMgJ211dGFibGUnIG9yICdpbW11dGFibGUnXG4gICAgIyBAcGFyYW0ge1N0cmluZ3xCb29sZWFufSBtdXRhYmxlIFNldCBlaXRoZXIgJ211dGFibGUnIC8gdHJ1ZSBvciAnaW1tdXRhYmxlJyAvIGZhbHNlXG4gICAgc2V0TXV0YWJsZURlZmF1bHQ6IChtdXRhYmxlKS0+XG4gICAgICBpZiBtdXRhYmxlIGlzIHRydWUgb3IgbXV0YWJsZSBpcyAnbXV0YWJsZSdcbiAgICAgICAgSnNvblR5cGUucHJvdG90eXBlLm11dGFibGVfZGVmYXVsdCA9IHRydWVcbiAgICAgIGVsc2UgaWYgbXV0YWJsZSBpcyBmYWxzZSBvciBtdXRhYmxlIGlzICdpbW11dGFibGUnXG4gICAgICAgIEpzb25UeXBlLnByb3RvdHlwZS5tdXRhYmxlX2RlZmF1bHQgPSBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgJ1NldCBtdXRhYmxlIGVpdGhlciBcIm11dGFibGVcIiBvciBcImltbXV0YWJsZVwiISdcbiAgICAgICdPSydcblxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwoKVxuICAgICMgICBHZXQgdGhpcyBhcyBhIEpzb24gb2JqZWN0LlxuICAgICMgICBAcmV0dXJuIFtKc29uXVxuICAgICNcbiAgICAjIEBvdmVybG9hZCB2YWwobmFtZSlcbiAgICAjICAgR2V0IHZhbHVlIG9mIGEgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGV8V29yZHxTdHJpbmd8T2JqZWN0XSBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eS4gSWYgbXV0YWJsZSBpdCB3aWxsIHJldHVybiBhIE9wZXJhdGlvbi10eXBlIG9iamVjdCwgaWYgaW1tdXRhYmxlIGl0IHdpbGwgcmV0dXJuIFN0cmluZy9PYmplY3QuXG4gICAgI1xuICAgICMgQG92ZXJsb2FkIHZhbChuYW1lLCBjb250ZW50KVxuICAgICMgICBTZXQgYSBuZXcgcHJvcGVydHkuXG4gICAgIyAgIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBjb250ZW50IENvbnRlbnQgb2YgdGhlIG9iamVjdCBwcm9wZXJ0eS5cbiAgICAjICAgQHJldHVybiBbSnNvblR5cGVdIFRoaXMgb2JqZWN0LiAoc3VwcG9ydHMgY2hhaW5pbmcpXG4gICAgI1xuICAgIHZhbDogKG5hbWUsIGNvbnRlbnQsIG11dGFibGUpLT5cbiAgICAgIGlmIHR5cGVvZiBuYW1lIGlzICdvYmplY3QnXG4gICAgICAgICMgU3BlY2lhbCBjYXNlLiBGaXJzdCBhcmd1bWVudCBpcyBhbiBvYmplY3QuIFRoZW4gdGhlIHNlY29uZCBhcmcgaXMgbXV0YWJsZS5cbiAgICAgICAgIyBLZWVwIHRoYXQgaW4gbWluZCB3aGVuIHJlYWRpbmcgdGhlIGZvbGxvd2luZy4uXG4gICAgICAgIGZvciBvX25hbWUsbyBvZiBuYW1lXG4gICAgICAgICAgQHZhbChvX25hbWUsbyxjb250ZW50KVxuICAgICAgICBAXG4gICAgICBlbHNlIGlmIG5hbWU/IGFuZCBjb250ZW50P1xuICAgICAgICBpZiBtdXRhYmxlP1xuICAgICAgICAgIGlmIG11dGFibGUgaXMgdHJ1ZSBvciBtdXRhYmxlIGlzICdtdXRhYmxlJ1xuICAgICAgICAgICAgbXV0YWJsZSA9IHRydWVcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBtdXRhYmxlID0gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG11dGFibGUgPSBAbXV0YWJsZV9kZWZhdWx0XG4gICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdmdW5jdGlvbidcbiAgICAgICAgICBAICMgSnVzdCBkbyBub3RoaW5nXG4gICAgICAgIGVsc2UgaWYgKChub3QgbXV0YWJsZSkgb3IgdHlwZW9mIGNvbnRlbnQgaXMgJ251bWJlcicpIGFuZCBjb250ZW50LmNvbnN0cnVjdG9yIGlzbnQgT2JqZWN0XG4gICAgICAgICAgb2JqID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5JbW11dGFibGVPYmplY3QgdW5kZWZpbmVkLCBjb250ZW50KS5leGVjdXRlKClcbiAgICAgICAgICBzdXBlciBuYW1lLCBvYmpcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGlmIHR5cGVvZiBjb250ZW50IGlzICdzdHJpbmcnXG4gICAgICAgICAgICB3b3JkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5Xb3JkIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgICB3b3JkLmluc2VydFRleHQgMCwgY29udGVudFxuICAgICAgICAgICAgc3VwZXIgbmFtZSwgd29yZFxuICAgICAgICAgIGVsc2UgaWYgY29udGVudC5jb25zdHJ1Y3RvciBpcyBPYmplY3RcbiAgICAgICAgICAgIGpzb24gPSBIQi5hZGRPcGVyYXRpb24obmV3IEpzb25UeXBlIHVuZGVmaW5lZCwgY29udGVudCwgbXV0YWJsZSkuZXhlY3V0ZSgpXG4gICAgICAgICAgICBzdXBlciBuYW1lLCBqc29uXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3Qgbm90IHNldCAje3R5cGVvZiBjb250ZW50fS10eXBlcyBpbiBjb2xsYWJvcmF0aXZlIEpzb24tb2JqZWN0cyFcIlxuICAgICAgZWxzZVxuICAgICAgICBzdXBlciBuYW1lLCBjb250ZW50XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkgSnNvblR5cGUucHJvdG90eXBlLCAndmFsdWUnLFxuICAgICAgZ2V0IDogLT4gY3JlYXRlSnNvbldyYXBwZXIgQFxuICAgICAgc2V0IDogKG8pLT5cbiAgICAgICAgaWYgby5jb25zdHJ1Y3RvciBpcyB7fS5jb25zdHJ1Y3RvclxuICAgICAgICAgIGZvciBvX25hbWUsb19vYmogb2Ygb1xuICAgICAgICAgICAgQHZhbChvX25hbWUsIG9fb2JqLCAnaW1tdXRhYmxlJylcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBtdXN0IG9ubHkgc2V0IE9iamVjdCB2YWx1ZXMhXCJcblxuICAgICNcbiAgICAjIEBwcml2YXRlXG4gICAgI1xuICAgIF9lbmNvZGU6ICgpLT5cbiAgICAgIHtcbiAgICAgICAgJ3R5cGUnIDogXCJKc29uVHlwZVwiXG4gICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICB9XG5cbiAgcGFyc2VyWydKc29uVHlwZSddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IEpzb25UeXBlIHVpZFxuXG5cblxuXG4gIHR5cGVzWydKc29uVHlwZSddID0gSnNvblR5cGVcblxuICB0ZXh0X3R5cGVzXG5cblxuIiwiYmFzaWNfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL0Jhc2ljVHlwZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IChIQiktPlxuICBiYXNpY190eXBlcyA9IGJhc2ljX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBiYXNpY190eXBlcy50eXBlc1xuICBwYXJzZXIgPSBiYXNpY190eXBlcy5wYXJzZXJcblxuICAjXG4gICMgTWFuYWdlcyBtYXAgbGlrZSBvYmplY3RzLiBFLmcuIEpzb24tVHlwZSBhbmQgWE1MIGF0dHJpYnV0ZXMuXG4gICNcbiAgY2xhc3MgTWFwTWFuYWdlciBleHRlbmRzIHR5cGVzLk9wZXJhdGlvblxuXG4gICAgI1xuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICNcbiAgICBjb25zdHJ1Y3RvcjogKHVpZCktPlxuICAgICAgQG1hcCA9IHt9XG4gICAgICBzdXBlciB1aWRcblxuICAgICNcbiAgICAjIEBzZWUgSnNvblR5cGVzLnZhbFxuICAgICNcbiAgICB2YWw6IChuYW1lLCBjb250ZW50KS0+XG4gICAgICBpZiBjb250ZW50P1xuICAgICAgICBpZiBub3QgQG1hcFtuYW1lXT9cbiAgICAgICAgICBIQi5hZGRPcGVyYXRpb24obmV3IEFkZE5hbWUgdW5kZWZpbmVkLCBALCBuYW1lKS5leGVjdXRlKClcbiAgICAgICAgQG1hcFtuYW1lXS5yZXBsYWNlIGNvbnRlbnRcbiAgICAgICAgQFxuICAgICAgZWxzZSBpZiBuYW1lP1xuICAgICAgICBvYmogPSBAbWFwW25hbWVdPy52YWwoKVxuICAgICAgICBpZiBvYmogaW5zdGFuY2VvZiB0eXBlcy5JbW11dGFibGVPYmplY3RcbiAgICAgICAgICBvYmoudmFsKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG9ialxuICAgICAgZWxzZVxuICAgICAgICByZXN1bHQgPSB7fVxuICAgICAgICBmb3IgbmFtZSxvIG9mIEBtYXBcbiAgICAgICAgICBvYmogPSBvLnZhbCgpXG4gICAgICAgICAgaWYgb2JqIGluc3RhbmNlb2YgdHlwZXMuSW1tdXRhYmxlT2JqZWN0IG9yIG9iaiBpbnN0YW5jZW9mIE1hcE1hbmFnZXJcbiAgICAgICAgICAgIG9iaiA9IG9iai52YWwoKVxuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IG9ialxuICAgICAgICByZXN1bHRcblxuICAjXG4gICMgV2hlbiBhIG5ldyBwcm9wZXJ0eSBpbiBhIG1hcCBtYW5hZ2VyIGlzIGNyZWF0ZWQsIHRoZW4gdGhlIHVpZHMgb2YgdGhlIGluc2VydGVkIE9wZXJhdGlvbnNcbiAgIyBtdXN0IGJlIHVuaXF1ZSAodGhpbmsgYWJvdXQgY29uY3VycmVudCBvcGVyYXRpb25zKS4gVGhlcmVmb3JlIG9ubHkgYW4gQWRkTmFtZSBvcGVyYXRpb24gaXMgYWxsb3dlZCB0b1xuICAjIGFkZCBhIHByb3BlcnR5IGluIGEgTWFwTWFuYWdlci4gSWYgdHdvIEFkZE5hbWUgb3BlcmF0aW9ucyBvbiB0aGUgc2FtZSBNYXBNYW5hZ2VyIG5hbWUgaGFwcGVuIGNvbmN1cnJlbnRseVxuICAjIG9ubHkgb25lIHdpbGwgQWRkTmFtZSBvcGVyYXRpb24gd2lsbCBiZSBleGVjdXRlZC5cbiAgI1xuICBjbGFzcyBBZGROYW1lIGV4dGVuZHMgdHlwZXMuT3BlcmF0aW9uXG5cbiAgICAjXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gbWFwX21hbmFnZXIgVWlkIG9yIHJlZmVyZW5jZSB0byB0aGUgTWFwTWFuYWdlci5cbiAgICAjIEBwYXJhbSB7U3RyaW5nfSBuYW1lIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgd2lsbCBiZSBhZGRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIG1hcF9tYW5hZ2VyLCBAbmFtZSktPlxuICAgICAgQHNhdmVPcGVyYXRpb24gJ21hcF9tYW5hZ2VyJywgbWFwX21hbmFnZXJcbiAgICAgIHN1cGVyIHVpZFxuXG4gICAgI1xuICAgICMgSWYgbWFwX21hbmFnZXIgZG9lc24ndCBoYXZlIHRoZSBwcm9wZXJ0eSBuYW1lLCB0aGVuIGFkZCBpdC5cbiAgICAjIFRoZSBSZXBsYWNlTWFuYWdlciB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gb24gdGhlIHByb3BlcnR5IGlzIHVuaXF1ZVxuICAgICMgaW4gc3VjaCBhIHdheSB0aGF0IGlmIEFkZE5hbWUgaXMgZXhlY3V0ZWQgKGZyb20gYW5vdGhlciBwZWVyKSBpdCB3aWxsXG4gICAgIyBhbHdheXMgaGF2ZSB0aGUgc2FtZSByZXN1bHQgKFJlcGxhY2VNYW5hZ2VyLCBhbmQgaXRzIGJlZ2lubmluZyBhbmQgZW5kIGFyZSB0aGUgc2FtZSlcbiAgICAjXG4gICAgZXhlY3V0ZTogKCktPlxuICAgICAgaWYgbm90IEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9ucygpXG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgZWxzZVxuICAgICAgICB1aWRfciA9IEBtYXBfbWFuYWdlci5nZXRVaWQoKVxuICAgICAgICB1aWRfci5vcF9udW1iZXIgPSBcIl8je3VpZF9yLm9wX251bWJlcn1fUk1fI3tAbmFtZX1cIlxuICAgICAgICBpZiBub3QgSEIuZ2V0T3BlcmF0aW9uKHVpZF9yKT9cbiAgICAgICAgICB1aWRfYmVnID0gQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICAgdWlkX2JlZy5vcF9udW1iZXIgPSBcIl8je3VpZF9iZWcub3BfbnVtYmVyfV9STV8je0BuYW1lfV9iZWdpbm5pbmdcIlxuICAgICAgICAgIHVpZF9lbmQgPSBAbWFwX21hbmFnZXIuZ2V0VWlkKClcbiAgICAgICAgICB1aWRfZW5kLm9wX251bWJlciA9IFwiXyN7dWlkX2VuZC5vcF9udW1iZXJ9X1JNXyN7QG5hbWV9X2VuZFwiXG4gICAgICAgICAgYmVnID0gSEIuYWRkT3BlcmF0aW9uKG5ldyB0eXBlcy5EZWxpbWl0ZXIgdWlkX2JlZywgdW5kZWZpbmVkLCB1aWRfZW5kKS5leGVjdXRlKClcbiAgICAgICAgICBlbmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IHR5cGVzLkRlbGltaXRlciB1aWRfZW5kLCBiZWcsIHVuZGVmaW5lZCkuZXhlY3V0ZSgpXG4gICAgICAgICAgI2JlZy5leGVjdXRlKClcbiAgICAgICAgICBAbWFwX21hbmFnZXIubWFwW0BuYW1lXSA9IEhCLmFkZE9wZXJhdGlvbihuZXcgUmVwbGFjZU1hbmFnZXIgdW5kZWZpbmVkLCB1aWRfciwgYmVnLCBlbmQpLmV4ZWN1dGUoKVxuICAgICAgICBzdXBlclxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAge1xuICAgICAgICAndHlwZScgOiBcIkFkZE5hbWVcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnbWFwX21hbmFnZXInIDogQG1hcF9tYW5hZ2VyLmdldFVpZCgpXG4gICAgICAgICduYW1lJyA6IEBuYW1lXG4gICAgICB9XG5cbiAgcGFyc2VyWydBZGROYW1lJ10gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdtYXBfbWFuYWdlcicgOiBtYXBfbWFuYWdlclxuICAgICAgJ3VpZCcgOiB1aWRcbiAgICAgICduYW1lJyA6IG5hbWVcbiAgICB9ID0ganNvblxuICAgIG5ldyBBZGROYW1lIHVpZCwgbWFwX21hbmFnZXIsIG5hbWVcblxuICAjXG4gICMgTWFuYWdlcyBhIGxpc3Qgb2YgSW5zZXJ0LXR5cGUgb3BlcmF0aW9ucy5cbiAgI1xuICBjbGFzcyBMaXN0TWFuYWdlciBleHRlbmRzIHR5cGVzLkluc2VydFxuXG4gICAgI1xuICAgICMgQSBMaXN0TWFuYWdlciBtYWludGFpbnMgYSBub24tZW1wdHkgbGlzdCB0aGF0IGhhcyBhIGJlZ2lubmluZyBhbmQgYW4gZW5kIChib3RoIERlbGltaXRlcnMhKVxuICAgICMgQHBhcmFtIHtPYmplY3R9IHVpZCBBIHVuaXF1ZSBpZGVudGlmaWVyLiBJZiB1aWQgaXMgdW5kZWZpbmVkLCBhIG5ldyB1aWQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGJlZ2lubmluZyBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgICMgQHBhcmFtIHtEZWxpbWl0ZXJ9IGVuZCBSZWZlcmVuY2Ugb3IgT2JqZWN0LlxuICAgIGNvbnN0cnVjdG9yOiAodWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBpZiBiZWdpbm5pbmc/IGFuZCBlbmQ/XG4gICAgICAgIEBzYXZlT3BlcmF0aW9uICdiZWdpbm5pbmcnLCBiZWdpbm5pbmdcbiAgICAgICAgQHNhdmVPcGVyYXRpb24gJ2VuZCcsIGVuZFxuICAgICAgZWxzZVxuICAgICAgICBAYmVnaW5uaW5nID0gSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZFxuICAgICAgICBAZW5kID0gICAgICAgSEIuYWRkT3BlcmF0aW9uIG5ldyB0eXBlcy5EZWxpbWl0ZXIgdW5kZWZpbmVkLCBAYmVnaW5uaW5nLCB1bmRlZmluZWRcbiAgICAgICAgQGJlZ2lubmluZy5uZXh0X2NsID0gQGVuZFxuICAgICAgICBAYmVnaW5uaW5nLmV4ZWN1dGUoKVxuICAgICAgICBAZW5kLmV4ZWN1dGUoKVxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuXG4gICAgIyBHZXQgdGhlIGVsZW1lbnQgcHJldmlvdXMgdG8gdGhlIGRlbGVtaXRlciBhdCB0aGUgZW5kXG4gICAgZ2V0TGFzdE9wZXJhdGlvbjogKCktPlxuICAgICAgQGVuZC5wcmV2X2NsXG5cbiAgICAjIHNpbWlsYXIgdG8gdGhlIGFib3ZlXG4gICAgZ2V0Rmlyc3RPcGVyYXRpb246ICgpLT5cbiAgICAgIEBiZWdpbm5pbmcubmV4dF9jbFxuXG4gICAgIyBUcmFuc2Zvcm1zIHRoZSB0aGUgbGlzdCB0byBhbiBhcnJheVxuICAgICMgRG9lc24ndCByZXR1cm4gbGVmdC1yaWdodCBkZWxpbWl0ZXIuXG4gICAgdG9BcnJheTogKCktPlxuICAgICAgbyA9IEBiZWdpbm5pbmcubmV4dF9jbFxuICAgICAgcmVzdWx0ID0gW11cbiAgICAgIHdoaWxlIG8gaXNudCBAZW5kXG4gICAgICAgIHJlc3VsdC5wdXNoIG9cbiAgICAgICAgbyA9IG8ubmV4dF9jbFxuICAgICAgcmVzdWx0XG5cbiAgICAjXG4gICAgIyBSZXRyaWV2ZXMgdGhlIHgtdGggbm90IGRlbGV0ZWQgZWxlbWVudC5cbiAgICAjXG4gICAgZ2V0T3BlcmF0aW9uQnlQb3NpdGlvbjogKHBvc2l0aW9uKS0+XG4gICAgICBvID0gQGJlZ2lubmluZy5uZXh0X2NsXG4gICAgICBpZiBwb3NpdGlvbiA+IDBcbiAgICAgICAgd2hpbGUgdHJ1ZVxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgICBpZiBub3Qgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgICAgcG9zaXRpb24gLT0gMVxuICAgICAgICAgIGlmIHBvc2l0aW9uIGlzIDBcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgaWYgbyBpbnN0YW5jZW9mIHR5cGVzLkRlbGltaXRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwicG9zaXRpb24gcGFyYW1ldGVyIGV4Y2VlZGVkIHRoZSBsZW5ndGggb2YgdGhlIGRvY3VtZW50IVwiXG4gICAgICBvXG5cbiAgI1xuICAjIEFkZHMgc3VwcG9ydCBmb3IgcmVwbGFjZS4gVGhlIFJlcGxhY2VNYW5hZ2VyIG1hbmFnZXMgUmVwbGFjZWFibGUgb3BlcmF0aW9ucy5cbiAgIyBFYWNoIFJlcGxhY2VhYmxlIGhvbGRzIGEgdmFsdWUgdGhhdCBpcyBub3cgcmVwbGFjZWFibGUuXG4gICNcbiAgIyBUaGUgV29yZC10eXBlIGhhcyBpbXBsZW1lbnRlZCBzdXBwb3J0IGZvciByZXBsYWNlXG4gICMgQHNlZSBXb3JkXG4gICNcbiAgY2xhc3MgUmVwbGFjZU1hbmFnZXIgZXh0ZW5kcyBMaXN0TWFuYWdlclxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBpbml0aWFsX2NvbnRlbnQgSW5pdGlhbGl6ZSB0aGlzIHdpdGggYSBSZXBsYWNlYWJsZSB0aGF0IGhvbGRzIHRoZSBpbml0aWFsX2NvbnRlbnQuXG4gICAgIyBAcGFyYW0ge09iamVjdH0gdWlkIEEgdW5pcXVlIGlkZW50aWZpZXIuIElmIHVpZCBpcyB1bmRlZmluZWQsIGEgbmV3IHVpZCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gYmVnaW5uaW5nIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgIyBAcGFyYW0ge0RlbGltaXRlcn0gZW5kIFJlZmVyZW5jZSBvciBPYmplY3QuXG4gICAgY29uc3RydWN0b3I6IChpbml0aWFsX2NvbnRlbnQsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpbiktPlxuICAgICAgc3VwZXIgdWlkLCBiZWdpbm5pbmcsIGVuZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgICBpZiBpbml0aWFsX2NvbnRlbnQ/XG4gICAgICAgIEByZXBsYWNlIGluaXRpYWxfY29udGVudFxuXG4gICAgI1xuICAgICMgUmVwbGFjZSB0aGUgZXhpc3Rpbmcgd29yZCB3aXRoIGEgbmV3IHdvcmQuXG4gICAgI1xuICAgIHJlcGxhY2U6IChjb250ZW50KS0+XG4gICAgICBvID0gQGdldExhc3RPcGVyYXRpb24oKVxuICAgICAgb3AgPSBuZXcgUmVwbGFjZWFibGUgY29udGVudCwgQCwgdW5kZWZpbmVkLCBvLCBvLm5leHRfY2xcbiAgICAgIEhCLmFkZE9wZXJhdGlvbihvcCkuZXhlY3V0ZSgpXG5cbiAgICAjXG4gICAgIyBHZXQgdGhlIHZhbHVlIG9mIHRoaXMgV29yZFxuICAgICMgQHJldHVybiB7U3RyaW5nfVxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIG8gPSBAZ2V0TGFzdE9wZXJhdGlvbigpXG4gICAgICBpZiBvIGluc3RhbmNlb2YgdHlwZXMuRGVsaW1pdGVyXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcImR0cm5cIlxuICAgICAgby52YWwoKVxuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiUmVwbGFjZU1hbmFnZXJcIlxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ2JlZ2lubmluZycgOiBAYmVnaW5uaW5nLmdldFVpZCgpXG4gICAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICAgIH1cbiAgICAgIGlmIEBwcmV2X2NsPyBhbmQgQG5leHRfY2w/XG4gICAgICAgIGpzb25bJ3ByZXYnXSA9IEBwcmV2X2NsLmdldFVpZCgpXG4gICAgICAgIGpzb25bJ25leHQnXSA9IEBuZXh0X2NsLmdldFVpZCgpXG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZU1hbmFnZXJcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICAgICdiZWdpbm5pbmcnIDogYmVnaW5uaW5nXG4gICAgICAnZW5kJyA6IGVuZFxuICAgIH0gPSBqc29uXG4gICAgbmV3IFJlcGxhY2VNYW5hZ2VyIGNvbnRlbnQsIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG5cbiAgI1xuICAjIFRoZSBSZXBsYWNlTWFuYWdlciBtYW5hZ2VzIFJlcGxhY2VhYmxlcy5cbiAgIyBAc2VlIFJlcGxhY2VNYW5hZ2VyXG4gICNcbiAgY2xhc3MgUmVwbGFjZWFibGUgZXh0ZW5kcyB0eXBlcy5JbnNlcnRcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T3BlcmF0aW9ufSBjb250ZW50IFRoZSB2YWx1ZSB0aGF0IHRoaXMgUmVwbGFjZWFibGUgaG9sZHMuXG4gICAgIyBAcGFyYW0ge1JlcGxhY2VNYW5hZ2VyfSBwYXJlbnQgVXNlZCB0byByZXBsYWNlIHRoaXMgUmVwbGFjZWFibGUgd2l0aCBhbm90aGVyIG9uZS5cbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAnY29udGVudCcsIGNvbnRlbnRcbiAgICAgIEBzYXZlT3BlcmF0aW9uICdwYXJlbnQnLCBwYXJlbnRcbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/IGFuZCBjb250ZW50PylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIFwiWW91IG11c3QgZGVmaW5lIGNvbnRlbnQsIHByZXYsIGFuZCBuZXh0IGZvciBSZXBsYWNlYWJsZS10eXBlcyFcIlxuICAgICAgc3VwZXIgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW5cblxuICAgICNcbiAgICAjIFJldHVybiB0aGUgY29udGVudCB0aGF0IHRoaXMgb3BlcmF0aW9uIGhvbGRzLlxuICAgICNcbiAgICB2YWw6ICgpLT5cbiAgICAgIEBjb250ZW50XG5cbiAgICAjXG4gICAgIyBSZXBsYWNlIHRoZSBjb250ZW50IG9mIHRoaXMgcmVwbGFjZWFibGUgd2l0aCBuZXcgY29udGVudC5cbiAgICAjXG4gICAgcmVwbGFjZTogKGNvbnRlbnQpLT5cbiAgICAgIEBwYXJlbnQucmVwbGFjZSBjb250ZW50XG5cbiAgICAjXG4gICAgIyBJZiBwb3NzaWJsZSBzZXQgdGhlIHJlcGxhY2UgbWFuYWdlciBpbiB0aGUgY29udGVudC5cbiAgICAjIEBzZWUgV29yZC5zZXRSZXBsYWNlTWFuYWdlclxuICAgICNcbiAgICBleGVjdXRlOiAoKS0+XG4gICAgICBpZiBub3QgQHZhbGlkYXRlU2F2ZWRPcGVyYXRpb25zKClcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50LnNldFJlcGxhY2VNYW5hZ2VyPyhAcGFyZW50KVxuICAgICAgICBzdXBlclxuICAgICAgICBAXG5cbiAgICAjXG4gICAgIyBFbmNvZGUgdGhpcyBvcGVyYXRpb24gaW4gc3VjaCBhIHdheSB0aGF0IGl0IGNhbiBiZSBwYXJzZWQgYnkgcmVtb3RlIHBlZXJzLlxuICAgICNcbiAgICBfZW5jb2RlOiAoKS0+XG4gICAgICBqc29uID1cbiAgICAgICAge1xuICAgICAgICAgICd0eXBlJzogXCJSZXBsYWNlYWJsZVwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudC5nZXRVaWQoKVxuICAgICAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBAcGFyZW50LmdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICB9XG4gICAgICBpZiBAb3JpZ2luPyBhbmQgQG9yaWdpbiBpc250IEBwcmV2X2NsXG4gICAgICAgIGpzb25bXCJvcmlnaW5cIl0gPSBAb3JpZ2luLmdldFVpZCgpXG4gICAgICBqc29uXG5cbiAgcGFyc2VyW1wiUmVwbGFjZWFibGVcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICdSZXBsYWNlTWFuYWdlcicgOiBwYXJlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBSZXBsYWNlYWJsZSBjb250ZW50LCBwYXJlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cblxuXG4gIHR5cGVzWydMaXN0TWFuYWdlciddID0gTGlzdE1hbmFnZXJcbiAgdHlwZXNbJ01hcE1hbmFnZXInXSA9IE1hcE1hbmFnZXJcbiAgdHlwZXNbJ1JlcGxhY2VNYW5hZ2VyJ10gPSBSZXBsYWNlTWFuYWdlclxuICB0eXBlc1snUmVwbGFjZWFibGUnXSA9IFJlcGxhY2VhYmxlXG5cbiAgYmFzaWNfdHlwZXNcblxuXG5cblxuXG5cbiIsInN0cnVjdHVyZWRfdHlwZXNfdW5pbml0aWFsaXplZCA9IHJlcXVpcmUgXCIuL1N0cnVjdHVyZWRUeXBlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gKEhCKS0+XG4gIHN0cnVjdHVyZWRfdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzX3VuaW5pdGlhbGl6ZWQgSEJcbiAgdHlwZXMgPSBzdHJ1Y3R1cmVkX3R5cGVzLnR5cGVzXG4gIHBhcnNlciA9IHN0cnVjdHVyZWRfdHlwZXMucGFyc2VyXG5cbiAgI1xuICAjIEF0IHRoZSBtb21lbnQgVGV4dERlbGV0ZSB0eXBlIGVxdWFscyB0aGUgRGVsZXRlIHR5cGUgaW4gQmFzaWNUeXBlcy5cbiAgIyBAc2VlIEJhc2ljVHlwZXMuRGVsZXRlXG4gICNcbiAgY2xhc3MgVGV4dERlbGV0ZSBleHRlbmRzIHR5cGVzLkRlbGV0ZVxuICBwYXJzZXJbXCJUZXh0RGVsZXRlXCJdID0gcGFyc2VyW1wiRGVsZXRlXCJdXG5cbiAgI1xuICAjICBFeHRlbmRzIHRoZSBiYXNpYyBJbnNlcnQgdHlwZSB0byBhbiBvcGVyYXRpb24gdGhhdCBob2xkcyBhIHRleHQgdmFsdWVcbiAgI1xuICBjbGFzcyBUZXh0SW5zZXJ0IGV4dGVuZHMgdHlwZXMuSW5zZXJ0XG4gICAgI1xuICAgICMgQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnQgVGhlIGNvbnRlbnQgb2YgdGhpcyBJbnNlcnQtdHlwZSBPcGVyYXRpb24uIFVzdWFsbHkgeW91IHJlc3RyaWN0IHRoZSBsZW5ndGggb2YgY29udGVudCB0byBzaXplIDFcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6IChAY29udGVudCwgdWlkLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIGlmIG5vdCAocHJldj8gYW5kIG5leHQ/KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgXCJZb3UgbXVzdCBkZWZpbmUgcHJldiwgYW5kIG5leHQgZm9yIFRleHRJbnNlcnQtdHlwZXMhXCJcbiAgICAgIHN1cGVyIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG4gICAgI1xuICAgICMgUmV0cmlldmUgdGhlIGVmZmVjdGl2ZSBsZW5ndGggb2YgdGhlICRjb250ZW50IG9mIHRoaXMgb3BlcmF0aW9uLlxuICAgICNcbiAgICBnZXRMZW5ndGg6ICgpLT5cbiAgICAgIGlmIEBpc0RlbGV0ZWQoKVxuICAgICAgICAwXG4gICAgICBlbHNlXG4gICAgICAgIEBjb250ZW50Lmxlbmd0aFxuXG4gICAgI1xuICAgICMgVGhlIHJlc3VsdCB3aWxsIGJlIGNvbmNhdGVuYXRlZCB3aXRoIHRoZSByZXN1bHRzIGZyb20gdGhlIG90aGVyIGluc2VydCBvcGVyYXRpb25zXG4gICAgIyBpbiBvcmRlciB0byByZXRyaWV2ZSB0aGUgY29udGVudCBvZiB0aGUgZW5naW5lLlxuICAgICMgQHNlZSBIaXN0b3J5QnVmZmVyLnRvRXhlY3V0ZWRBcnJheVxuICAgICNcbiAgICB2YWw6IChjdXJyZW50X3Bvc2l0aW9uKS0+XG4gICAgICBpZiBAaXNEZWxldGVkKClcbiAgICAgICAgXCJcIlxuICAgICAgZWxzZVxuICAgICAgICBAY29udGVudFxuXG4gICAgI1xuICAgICMgQ29udmVydCBhbGwgcmVsZXZhbnQgaW5mb3JtYXRpb24gb2YgdGhpcyBvcGVyYXRpb24gdG8gdGhlIGpzb24tZm9ybWF0LlxuICAgICMgVGhpcyByZXN1bHQgY2FuIGJlIHNlbmQgdG8gb3RoZXIgY2xpZW50cy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9XG4gICAgICAgIHtcbiAgICAgICAgICAndHlwZSc6IFwiVGV4dEluc2VydFwiXG4gICAgICAgICAgJ2NvbnRlbnQnOiBAY29udGVudFxuICAgICAgICAgICd1aWQnIDogQGdldFVpZCgpXG4gICAgICAgICAgJ3ByZXYnOiBAcHJldl9jbC5nZXRVaWQoKVxuICAgICAgICAgICduZXh0JzogQG5leHRfY2wuZ2V0VWlkKClcbiAgICAgICAgfVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlcltcIlRleHRJbnNlcnRcIl0gPSAoanNvbiktPlxuICAgIHtcbiAgICAgICdjb250ZW50JyA6IGNvbnRlbnRcbiAgICAgICd1aWQnIDogdWlkXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBUZXh0SW5zZXJ0IGNvbnRlbnQsIHVpZCwgcHJldiwgbmV4dCwgb3JpZ2luXG5cbiAgI1xuICAjIEhhbmRsZXMgYSBUZXh0LWxpa2UgZGF0YSBzdHJ1Y3R1cmVzIHdpdGggc3VwcG9ydCBmb3IgaW5zZXJ0VGV4dC9kZWxldGVUZXh0IGF0IGEgd29yZC1wb3NpdGlvbi5cbiAgI1xuICBjbGFzcyBXb3JkIGV4dGVuZHMgdHlwZXMuTGlzdE1hbmFnZXJcblxuICAgICNcbiAgICAjIEBwYXJhbSB7T2JqZWN0fSB1aWQgQSB1bmlxdWUgaWRlbnRpZmllci4gSWYgdWlkIGlzIHVuZGVmaW5lZCwgYSBuZXcgdWlkIHdpbGwgYmUgY3JlYXRlZC5cbiAgICAjXG4gICAgY29uc3RydWN0b3I6ICh1aWQsIGJlZ2lubmluZywgZW5kLCBwcmV2LCBuZXh0LCBvcmlnaW4pLT5cbiAgICAgIHN1cGVyIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gICAgI1xuICAgICMgSW5zZXJ0cyBhIHN0cmluZyBpbnRvIHRoZSB3b3JkXG4gICAgI1xuICAgIGluc2VydFRleHQ6IChwb3NpdGlvbiwgY29udGVudCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG4gICAgICBmb3IgYyBpbiBjb250ZW50XG4gICAgICAgIG9wID0gbmV3IFRleHRJbnNlcnQgYywgdW5kZWZpbmVkLCBvLnByZXZfY2wsIG9cbiAgICAgICAgSEIuYWRkT3BlcmF0aW9uKG9wKS5leGVjdXRlKClcblxuICAgICNcbiAgICAjIERlbGV0ZXMgYSBwYXJ0IG9mIHRoZSB3b3JkLlxuICAgICNcbiAgICBkZWxldGVUZXh0OiAocG9zaXRpb24sIGxlbmd0aCktPlxuICAgICAgbyA9IEBnZXRPcGVyYXRpb25CeVBvc2l0aW9uIHBvc2l0aW9uXG5cbiAgICAgIGZvciBpIGluIFswLi4ubGVuZ3RoXVxuICAgICAgICBkID0gSEIuYWRkT3BlcmF0aW9uKG5ldyBUZXh0RGVsZXRlIHVuZGVmaW5lZCwgbykuZXhlY3V0ZSgpXG4gICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgd2hpbGUgby5pc0RlbGV0ZWQoKVxuICAgICAgICAgIGlmIG8gaW5zdGFuY2VvZiB0eXBlcy5EZWxpbWl0ZXJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciBcIllvdSBjYW4ndCBkZWxldGUgbW9yZSB0aGFuIHRoZXJlIGlzLi5cIlxuICAgICAgICAgIG8gPSBvLm5leHRfY2xcbiAgICAgICAgZC5fZW5jb2RlKClcblxuICAgICNcbiAgICAjIFJlcGxhY2UgdGhlIGNvbnRlbnQgb2YgdGhpcyB3b3JkIHdpdGggYW5vdGhlciBvbmUuIENvbmN1cnJlbnQgcmVwbGFjZW1lbnRzIGFyZSBub3QgbWVyZ2VkIVxuICAgICMgT25seSBvbmUgb2YgdGhlIHJlcGxhY2VtZW50cyB3aWxsIGJlIHVzZWQuXG4gICAgI1xuICAgICMgQ2FuIG9ubHkgYmUgdXNlZCBpZiB0aGUgUmVwbGFjZU1hbmFnZXIgd2FzIHNldCFcbiAgICAjIEBzZWUgV29yZC5zZXRSZXBsYWNlTWFuYWdlclxuICAgICNcbiAgICByZXBsYWNlVGV4dDogKHRleHQpLT5cbiAgICAgIGlmIEByZXBsYWNlX21hbmFnZXI/XG4gICAgICAgIHdvcmQgPSBIQi5hZGRPcGVyYXRpb24obmV3IFdvcmQgdW5kZWZpbmVkKS5leGVjdXRlKClcbiAgICAgICAgd29yZC5pbnNlcnRUZXh0IDAsIHRleHRcbiAgICAgICAgQHJlcGxhY2VfbWFuYWdlci5yZXBsYWNlKHdvcmQpXG4gICAgICBlbHNlXG4gICAgICAgIHRocm93IG5ldyBFcnJvciBcIlRoaXMgdHlwZSBpcyBjdXJyZW50bHkgbm90IG1haW50YWluZWQgYnkgYSBSZXBsYWNlTWFuYWdlciFcIlxuXG4gICAgI1xuICAgICMgQHJldHVybnMgW0pzb25dIEEgSnNvbiBvYmplY3QuXG4gICAgI1xuICAgIHZhbDogKCktPlxuICAgICAgYyA9IGZvciBvIGluIEB0b0FycmF5KClcbiAgICAgICAgaWYgby52YWw/XG4gICAgICAgICAgby52YWwoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgXCJcIlxuICAgICAgYy5qb2luKCcnKVxuXG4gICAgI1xuICAgICMgSW4gbW9zdCBjYXNlcyB5b3Ugd291bGQgZW1iZWQgYSBXb3JkIGluIGEgUmVwbGFjZWFibGUsIHdpY2ggaXMgaGFuZGxlZCBieSB0aGUgUmVwbGFjZU1hbmFnZXIgaW4gb3JkZXJcbiAgICAjIHRvIHByb3ZpZGUgcmVwbGFjZSBmdW5jdGlvbmFsaXR5LlxuICAgICNcbiAgICBzZXRSZXBsYWNlTWFuYWdlcjogKG9wKS0+XG4gICAgICBAc2F2ZU9wZXJhdGlvbiAncmVwbGFjZV9tYW5hZ2VyJywgb3BcbiAgICAgIEB2YWxpZGF0ZVNhdmVkT3BlcmF0aW9uc1xuXG4gICAgI1xuICAgICMgRW5jb2RlIHRoaXMgb3BlcmF0aW9uIGluIHN1Y2ggYSB3YXkgdGhhdCBpdCBjYW4gYmUgcGFyc2VkIGJ5IHJlbW90ZSBwZWVycy5cbiAgICAjXG4gICAgX2VuY29kZTogKCktPlxuICAgICAganNvbiA9IHtcbiAgICAgICAgJ3R5cGUnOiBcIldvcmRcIlxuICAgICAgICAndWlkJyA6IEBnZXRVaWQoKVxuICAgICAgICAnYmVnaW5uaW5nJyA6IEBiZWdpbm5pbmcuZ2V0VWlkKClcbiAgICAgICAgJ2VuZCcgOiBAZW5kLmdldFVpZCgpXG4gICAgICB9XG4gICAgICBpZiBAcHJldl9jbD9cbiAgICAgICAganNvblsncHJldiddID0gQHByZXZfY2wuZ2V0VWlkKClcbiAgICAgIGlmIEBuZXh0X2NsP1xuICAgICAgICBqc29uWyduZXh0J10gPSBAbmV4dF9jbC5nZXRVaWQoKVxuICAgICAgaWYgQG9yaWdpbj8gYW5kIEBvcmlnaW4gaXNudCBAcHJldl9jbFxuICAgICAgICBqc29uW1wib3JpZ2luXCJdID0gQG9yaWdpbi5nZXRVaWQoKVxuICAgICAganNvblxuXG4gIHBhcnNlclsnV29yZCddID0gKGpzb24pLT5cbiAgICB7XG4gICAgICAndWlkJyA6IHVpZFxuICAgICAgJ2JlZ2lubmluZycgOiBiZWdpbm5pbmdcbiAgICAgICdlbmQnIDogZW5kXG4gICAgICAncHJldic6IHByZXZcbiAgICAgICduZXh0JzogbmV4dFxuICAgICAgJ29yaWdpbicgOiBvcmlnaW5cbiAgICB9ID0ganNvblxuICAgIG5ldyBXb3JkIHVpZCwgYmVnaW5uaW5nLCBlbmQsIHByZXYsIG5leHQsIG9yaWdpblxuXG4gIHR5cGVzWydUZXh0SW5zZXJ0J10gPSBUZXh0SW5zZXJ0XG4gIHR5cGVzWydUZXh0RGVsZXRlJ10gPSBUZXh0RGVsZXRlXG4gIHR5cGVzWydXb3JkJ10gPSBXb3JkXG4gIHN0cnVjdHVyZWRfdHlwZXNcblxuXG4iXX0=
