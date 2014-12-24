(function() {
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

      MapManager.prototype.type = "MapManager";

      MapManager.prototype.applyDelete = function() {
        var name, p, _ref;
        _ref = this.map;
        for (name in _ref) {
          p = _ref[name];
          p.applyDelete();
        }
        return MapManager.__super__.applyDelete.call(this);
      };

      MapManager.prototype.cleanup = function() {
        return MapManager.__super__.cleanup.call(this);
      };

      MapManager.prototype.val = function(name, content) {
        var o, obj, qqq, result, x, _ref, _ref1;
        if (content != null) {
          if (this.map[name] == null) {
            (new AddName(void 0, this, name)).execute();
          }
          if (this.map[name] === null) {
            qqq = this;
            x = new AddName(void 0, this, name);
            x.execute();
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

      AddName.prototype.type = "AddName";

      AddName.prototype.applyDelete = function() {
        return AddName.__super__.applyDelete.call(this);
      };

      AddName.prototype.cleanup = function() {
        return AddName.__super__.cleanup.call(this);
      };

      AddName.prototype.execute = function() {
        var beg, clone, end, event_properties, event_this, uid_beg, uid_end, uid_r, _base;
        if (!this.validateSavedOperations()) {
          return false;
        } else {
          clone = function(o) {
            var name, p, value;
            p = {};
            for (name in o) {
              value = o[name];
              p[name] = value;
            }
            return p;
          };
          uid_r = clone(this.map_manager.getUid());
          uid_r.doSync = false;
          uid_r.op_number = "_" + uid_r.op_number + "_RM_" + this.name;
          if (HB.getOperation(uid_r) == null) {
            uid_beg = clone(uid_r);
            uid_beg.op_number = "" + uid_r.op_number + "_beginning";
            uid_end = clone(uid_r);
            uid_end.op_number = "" + uid_r.op_number + "_end";
            beg = (new types.Delimiter(uid_beg, void 0, uid_end)).execute();
            end = (new types.Delimiter(uid_end, beg, void 0)).execute();
            event_properties = {
              name: this.name
            };
            event_this = this.map_manager;
            this.map_manager.map[this.name] = new ReplaceManager(event_properties, event_this, uid_r, beg, end);
            this.map_manager.map[this.name].setParent(this.map_manager, this.name);
            ((_base = this.map_manager.map[this.name]).add_name_ops != null ? _base.add_name_ops : _base.add_name_ops = []).push(this);
            this.map_manager.map[this.name].execute();
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
          this.beginning = new types.Delimiter(void 0, void 0, void 0);
          this.end = new types.Delimiter(void 0, this.beginning, void 0);
          this.beginning.next_cl = this.end;
          this.beginning.execute();
          this.end.execute();
        }
        ListManager.__super__.constructor.call(this, uid, prev, next, origin);
      }

      ListManager.prototype.type = "ListManager";

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
        o = this.beginning;
        while (true) {
          if (o instanceof types.Delimiter && (o.prev_cl != null)) {
            o = o.prev_cl;
            while (o.isDeleted() || !(o instanceof types.Delimiter)) {
              o = o.prev_cl;
            }
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
        return o;
      };

      return ListManager;

    })(types.Operation);
    ReplaceManager = (function(_super) {
      __extends(ReplaceManager, _super);

      function ReplaceManager(event_porperties, event_this, uid, beginning, end, prev, next, origin) {
        this.event_porperties = event_porperties;
        this.event_this = event_this;
        ReplaceManager.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
      }

      ReplaceManager.prototype.type = "ReplaceManager";

      ReplaceManager.prototype.applyDelete = function() {
        var o, _i, _len, _ref;
        o = this.beginning;
        while (o != null) {
          o.applyDelete();
          o = o.next_cl;
        }
        if (this.add_name_ops != null) {
          _ref = this.add_name_ops;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            o = _ref[_i];
            o.applyDelete();
          }
        }
        return ReplaceManager.__super__.applyDelete.call(this);
      };

      ReplaceManager.prototype.cleanup = function() {
        return ReplaceManager.__super__.cleanup.call(this);
      };

      ReplaceManager.prototype.callEventDecorator = function(events) {
        var event, name, prop, _i, _len, _ref;
        if (!this.isDeleted()) {
          _ref = this.event_porperties;
          for (name in _ref) {
            prop = _ref[name];
            for (_i = 0, _len = events.length; _i < _len; _i++) {
              event = events[_i];
              event[name] = prop;
            }
          }
          this.event_this.callEvent(events);
        }
        return void 0;
      };

      ReplaceManager.prototype.replace = function(content, replaceable_uid) {
        var o;
        o = this.getLastOperation();
        (new Replaceable(content, this, replaceable_uid, o, o.next_cl)).execute();
        return void 0;
      };

      ReplaceManager.prototype.val = function() {
        var o;
        o = this.getLastOperation();
        return typeof o.val === "function" ? o.val() : void 0;
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
        if (this.origin != null) {
          json["origin"] = this.origin().getUid();
        }
        return json;
      };

      return ReplaceManager;

    })(ListManager);
    parser["ReplaceManager"] = function(json) {
      var beginning, end, next, origin, prev, uid;
      uid = json['uid'], prev = json['prev'], next = json['next'], origin = json['origin'], beginning = json['beginning'], end = json['end'];
      return new ReplaceManager(uid, beginning, end, prev, next, origin);
    };
    Replaceable = (function(_super) {
      __extends(Replaceable, _super);

      function Replaceable(content, parent, uid, prev, next, origin) {
        this.saveOperation('content', content);
        this.saveOperation('parent', parent);
        if (!((prev != null) && (next != null))) {
          throw new Error("You must define prev, and next for Replaceable-types!");
        }
        Replaceable.__super__.constructor.call(this, uid, prev, next, origin);
      }

      Replaceable.prototype.type = "Replaceable";

      Replaceable.prototype.val = function() {
        return this.content;
      };

      Replaceable.prototype.applyDelete = function() {
        if (this.content != null) {
          if (this.next_cl.type !== "Delimiter") {
            this.content.deleteAllObservers();
          }
          this.content.applyDelete();
          this.content.dontSync();
        }
        this.content = null;
        return Replaceable.__super__.applyDelete.apply(this, arguments);
      };

      Replaceable.prototype.cleanup = function() {
        return Replaceable.__super__.cleanup.apply(this, arguments);
      };

      Replaceable.prototype.callOperationSpecificEvents = function() {
        var old_value;
        if (this.next_cl.type === "Delimiter" && this.prev_cl.type !== "Delimiter") {
          old_value = this.prev_cl.content;
          this.prev_cl.applyDelete();
          this.parent.callEventDecorator([
            {
              type: "update",
              changed_by: this.uid.creator,
              oldValue: old_value
            }
          ]);
        } else if (this.next_cl.type !== "Delimiter") {
          this.applyDelete();
        } else {
          this.parent.callEventDecorator([
            {
              type: "add",
              changed_by: this.uid.creator
            }
          ]);
        }
        return void 0;
      };

      Replaceable.prototype._encode = function() {
        var json, _ref;
        json = {
          'type': "Replaceable",
          'content': (_ref = this.content) != null ? _ref.getUid() : void 0,
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

}).call(this);

//# sourceMappingURL=../Types/StructuredTypes.js.map