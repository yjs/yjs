var RBTReeByIndex, basic_ops_uninitialized,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

basic_ops_uninitialized = require("./Basic");

RBTReeByIndex = require('bintrees/lib/rbtree_by_index');

module.exports = function() {
  var basic_ops, ops;
  basic_ops = basic_ops_uninitialized();
  ops = basic_ops.operations;
  ops.MapManager = (function(superClass) {
    extend(MapManager, superClass);

    function MapManager(custom_type, uid, content, content_operations) {
      this._map = {};
      MapManager.__super__.constructor.call(this, custom_type, uid, content, content_operations);
    }

    MapManager.prototype.type = "MapManager";

    MapManager.prototype.applyDelete = function() {
      var name, p, ref;
      ref = this._map;
      for (name in ref) {
        p = ref[name];
        p.applyDelete();
      }
      return MapManager.__super__.applyDelete.call(this);
    };

    MapManager.prototype.cleanup = function() {
      return MapManager.__super__.cleanup.call(this);
    };

    MapManager.prototype.map = function(f) {
      var n, ref, v;
      ref = this._map;
      for (n in ref) {
        v = ref[n];
        f(n, v);
      }
      return void 0;
    };

    MapManager.prototype.val = function(name, content) {
      var o, prop, ref, rep, res, result;
      if (arguments.length > 1) {
        if ((content != null) && (content._getModel != null)) {
          rep = content._getModel(this.custom_types, this.operations);
        } else {
          rep = content;
        }
        this.retrieveSub(name).replace(rep);
        return this.getCustomType();
      } else if (name != null) {
        prop = this._map[name];
        if ((prop != null) && !prop.isContentDeleted()) {
          res = prop.val();
          if (res instanceof ops.Operation) {
            return res.getCustomType();
          } else {
            return res;
          }
        } else {
          return void 0;
        }
      } else {
        result = {};
        ref = this._map;
        for (name in ref) {
          o = ref[name];
          if (!o.isContentDeleted()) {
            result[name] = o.val();
          }
        }
        return result;
      }
    };

    MapManager.prototype["delete"] = function(name) {
      var ref;
      if ((ref = this._map[name]) != null) {
        ref.deleteContent();
      }
      return this;
    };

    MapManager.prototype.retrieveSub = function(property_name) {
      var event_properties, event_this, rm, rm_uid;
      if (this._map[property_name] == null) {
        event_properties = {
          name: property_name
        };
        event_this = this;
        rm_uid = {
          noOperation: true,
          sub: property_name,
          alt: this
        };
        rm = new ops.ReplaceManager(null, event_properties, event_this, rm_uid);
        this._map[property_name] = rm;
        rm.setParent(this, property_name);
        rm.execute();
      }
      return this._map[property_name];
    };

    return MapManager;

  })(ops.Operation);
  ops.MapManager.parse = function(json) {
    var content, content_operations, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], content = json['content'], content_operations = json['content_operations'];
    return new this(custom_type, uid, content, content_operations);
  };
  ops.ListManager = (function(superClass) {
    extend(ListManager, superClass);

    function ListManager(custom_type, uid, content, content_operations) {
      this.beginning = new ops.Delimiter(void 0, void 0);
      this.end = new ops.Delimiter(this.beginning, void 0);
      this.beginning.next_cl = this.end;
      this.beginning.execute();
      this.end.execute();
      this.shortTree = new RBTreeByIndex();
      this.completeTree = new RBTreeByIndex();
      ListManager.__super__.constructor.call(this, custom_type, uid, content, content_operations);
    }

    ListManager.prototype.type = "ListManager";

    ListManager.prototype.applyDelete = function() {
      var o;
      o = this.beginning;
      while (o != null) {
        o.applyDelete();
        o = o.next_cl;
      }
      return ListManager.__super__.applyDelete.call(this);
    };

    ListManager.prototype.cleanup = function() {
      return ListManager.__super__.cleanup.call(this);
    };

    ListManager.prototype.toJson = function(transform_to_value) {
      var i, j, len, o, results, val;
      if (transform_to_value == null) {
        transform_to_value = false;
      }
      val = this.val();
      results = [];
      for (o = j = 0, len = val.length; j < len; o = ++j) {
        i = val[o];
        if (o instanceof ops.Object) {
          results.push(o.toJson(transform_to_value));
        } else if (o instanceof ops.ListManager) {
          results.push(o.toJson(transform_to_value));
        } else if (transform_to_value && o instanceof ops.Operation) {
          results.push(o.val());
        } else {
          results.push(o);
        }
      }
      return results;
    };

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

    ListManager.prototype.getNextNonDeleted = function(start) {
      var operation;
      if (start.isDeleted() || (start.node == null)) {
        operation = start.next_cl;
        while (!(operation instanceof ops.Delimiter)) {
          if (operation.is_deleted) {
            operation = operation.next_cl;
          } else {
            break;
          }
        }
      } else {
        operation = start.node.next.node;
        if (!operation) {
          return false;
        }
      }
      return operation;
    };

    ListManager.prototype.getPrevNonDeleted = function(start) {
      var operation;
      if (start.isDeleted() || (start.node == null)) {
        operation = start.prev_cl;
        while (!(operation instanceof ops.Delimiter)) {
          if (operation.is_deleted) {
            operation = operation.prev_cl;
          } else {
            break;
          }
        }
      } else {
        operation = start.node.prev.node;
        if (!operation) {
          return false;
        }
      }
      return operation;
    };

    ListManager.prototype.toArray = function() {
      return this.shortTree.map(function(operation) {
        return operation.val();
      });
    };

    ListManager.prototype.map = function(fun) {
      return this.shortTree.map(fun);
    };

    ListManager.prototype.fold = function(init, fun) {
      return this.shortTree.map(function(operation) {
        return init = fun(init, operation);
      });
    };

    ListManager.prototype.val = function(pos) {
      if (pos != null) {
        return this.shortTree.find(pos).val();
      } else {
        return this.toArray();
      }
    };

    ListManager.prototype.ref = function(pos) {
      if (pos != null) {
        return this.shortTree.find(pos);
      } else {
        return this.shortTree.map(function(operation) {
          return operation;
        });
      }
    };

    ListManager.prototype.getOperationByPosition = function(position) {
      if (position === 0) {
        return this.beginning;
      } else if (position === this.shortTree.size + 1) {
        return this.end;
      } else {
        return this.shortTree.find(position - 1);
      }
    };

    ListManager.prototype.push = function(content) {
      return this.insertAfter(this.end.prev_cl, [content]);
    };

    ListManager.prototype.insertAfterHelper = function(root, content) {
      var right;
      if (!root.right) {
        root.bt.right = content;
        return content.bt.parent = root;
      } else {
        return right = root.next_cl;
      }
    };

    ListManager.prototype.insertAfter = function(left, contents) {
      var c, j, leftNode, len, right, rightNode, tmp;
      if (left === this.beginning) {
        leftNode = null;
        rightNode = this.shortTree.findNode(0);
        right = rightNode ? rightNode.data : this.end;
      } else {
        rightNode = left.node.next;
        leftNode = left.node;
        right = rightNode ? rightNode.data : this.end;
      }
      left = right.prev_cl;
      if (contents instanceof ops.Operation) {
        tmp = new ops.Insert(null, content, null, void 0, void 0, left, right);
        tmp.execute();
      } else {
        for (j = 0, len = contents.length; j < len; j++) {
          c = contents[j];
          if ((c != null) && (c._name != null) && (c._getModel != null)) {
            c = c._getModel(this.custom_types, this.operations);
          }
          tmp = new ops.Insert(null, c, null, void 0, void 0, left, right);
          tmp.execute();
          leftNode = tmp.node;
          left = tmp;
        }
      }
      return this;
    };

    ListManager.prototype.insert = function(position, contents) {
      var ith;
      ith = this.getOperationByPosition(position);
      return this.insertAfter(ith, contents);
    };

    ListManager.prototype.deleteRef = function(operation, length, dir) {
      var deleteOperation, i, j, nextOperation, ref;
      if (length == null) {
        length = 1;
      }
      if (dir == null) {
        dir = 'right';
      }
      nextOperation = (function(_this) {
        return function(operation) {
          if (dir === 'right') {
            return _this.getNextNonDeleted(operation);
          } else {
            return _this.getPrevNonDeleted(operation);
          }
        };
      })(this);
      for (i = j = 0, ref = length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
        if (operation instanceof ops.Delimiter) {
          break;
        }
        deleteOperation = (new ops.Delete(null, void 0, operation)).execute();
        operation = nextOperation(operation);
      }
      return this;
    };

    ListManager.prototype["delete"] = function(position, length) {
      var operation;
      if (length == null) {
        length = 1;
      }
      operation = this.getOperationByPosition(position + length);
      return this.deleteRef(operation, length, 'left');
    };

    ListManager.prototype.callOperationSpecificInsertEvents = function(operation) {
      var getContentType, next, nextNode, prev, prevNode;
      prev = (this.getPrevNonDeleted(operation)) || this.beginning;
      prevNode = prev ? prev.node : null;
      next = (this.getNextNonDeleted(operation)) || this.end;
      nextNode = next ? next.node : null;
      operation.node = operation.node || (this.shortTree.insert_between(prevNode, nextNode, operation));
      operation.completeNode = operation.completeNode || (this.completeTree.insert_between(operation.prev_cl.completeNode, operation.next_cl.completeNode, operation));
      getContentType = function(content) {
        if (content instanceof ops.Operation) {
          return content.getCustomType();
        } else {
          return content;
        }
      };
      return this.callEvent([
        {
          type: "insert",
          reference: operation,
          position: operation.node.position(),
          object: this.getCustomType(),
          changedBy: operation.uid.creator,
          value: getContentType(operation.val())
        }
      ]);
    };

    ListManager.prototype.callOperationSpecificDeleteEvents = function(operation, del_op) {
      var position;
      if (operation.node) {
        position = operation.node.position();
        this.shortTree.remove_node(operation.node);
        operation.node = null;
      }
      return this.callEvent([
        {
          type: "delete",
          reference: operation,
          position: position,
          object: this.getCustomType(),
          length: 1,
          changedBy: del_op.uid.creator,
          oldValue: operation.val()
        }
      ]);
    };

    return ListManager;

  })(ops.Operation);
  ops.ListManager.parse = function(json) {
    var content, content_operations, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], content = json['content'], content_operations = json['content_operations'];
    return new this(custom_type, uid, content, content_operations);
  };
  ops.Composition = (function(superClass) {
    extend(Composition, superClass);

    function Composition(custom_type, _composition_value, composition_value_operations, uid, tmp_composition_ref) {
      var n, o;
      this._composition_value = _composition_value;
      Composition.__super__.constructor.call(this, custom_type, uid);
      if (tmp_composition_ref != null) {
        this.tmp_composition_ref = tmp_composition_ref;
      } else {
        this.composition_ref = this.end.prev_cl;
      }
      if (composition_value_operations != null) {
        this.composition_value_operations = {};
        for (n in composition_value_operations) {
          o = composition_value_operations[n];
          this.saveOperation(n, o, '_composition_value');
        }
      }
    }

    Composition.prototype.type = "Composition";

    Composition.prototype.execute = function() {
      var composition_ref;
      if (this.validateSavedOperations()) {
        this.getCustomType()._setCompositionValue(this._composition_value);
        delete this._composition_value;
        if (this.tmp_composition_ref) {
          composition_ref = this.HB.getOperation(this.tmp_composition_ref);
          if (composition_ref != null) {
            delete this.tmp_composition_ref;
            this.composition_ref = composition_ref;
          }
        }
        return Composition.__super__.execute.apply(this, arguments);
      } else {
        return false;
      }
    };

    Composition.prototype.callOperationSpecificInsertEvents = function(operation) {
      var o;
      if (this.tmp_composition_ref != null) {
        if (operation.uid.creator === this.tmp_composition_ref.creator && operation.uid.op_number === this.tmp_composition_ref.op_number) {
          this.composition_ref = operation;
          delete this.tmp_composition_ref;
          operation = operation.next_cl;
          if (operation === this.end) {
            return;
          }
        } else {
          return;
        }
      }
      o = this.end.prev_cl;
      while (o !== operation) {
        this.getCustomType()._unapply(o.undo_delta);
        o = o.prev_cl;
      }
      while (o !== this.end) {
        o.undo_delta = this.getCustomType()._apply(o.val());
        o = o.next_cl;
      }
      this.composition_ref = this.end.prev_cl;
      return this.callEvent([
        {
          type: "update",
          changedBy: operation.uid.creator,
          newValue: this.val()
        }
      ]);
    };

    Composition.prototype.callOperationSpecificDeleteEvents = function(operation, del_op) {};

    Composition.prototype.applyDelta = function(delta, operations) {
      (new ops.Insert(null, delta, operations, this, null, this.end.prev_cl, this.end)).execute();
      return void 0;
    };

    Composition.prototype._encode = function(json) {
      var custom, n, o, ref;
      if (json == null) {
        json = {};
      }
      custom = this.getCustomType()._getCompositionValue();
      json.composition_value = custom.composition_value;
      if (custom.composition_value_operations != null) {
        json.composition_value_operations = {};
        ref = custom.composition_value_operations;
        for (n in ref) {
          o = ref[n];
          json.composition_value_operations[n] = o.getUid();
        }
      }
      if (this.composition_ref != null) {
        json.composition_ref = this.composition_ref.getUid();
      } else {
        json.composition_ref = this.tmp_composition_ref;
      }
      return Composition.__super__._encode.call(this, json);
    };

    return Composition;

  })(ops.ListManager);
  ops.Composition.parse = function(json) {
    var composition_ref, composition_value, composition_value_operations, custom_type, uid;
    uid = json['uid'], custom_type = json['custom_type'], composition_value = json['composition_value'], composition_value_operations = json['composition_value_operations'], composition_ref = json['composition_ref'];
    return new this(custom_type, composition_value, composition_value_operations, uid, composition_ref);
  };
  ops.ReplaceManager = (function(superClass) {
    extend(ReplaceManager, superClass);

    function ReplaceManager(custom_type, event_properties1, event_this1, uid) {
      this.event_properties = event_properties1;
      this.event_this = event_this1;
      if (this.event_properties['object'] == null) {
        this.event_properties['object'] = this.event_this.getCustomType();
      }
      ReplaceManager.__super__.constructor.call(this, custom_type, uid);
    }

    ReplaceManager.prototype.type = "ReplaceManager";

    ReplaceManager.prototype.callEventDecorator = function(events) {
      var event, j, len, name, prop, ref;
      if (!this.isDeleted()) {
        for (j = 0, len = events.length; j < len; j++) {
          event = events[j];
          ref = this.event_properties;
          for (name in ref) {
            prop = ref[name];
            event[name] = prop;
          }
        }
        this.event_this.callEvent(events);
      }
      return void 0;
    };

    ReplaceManager.prototype.callOperationSpecificInsertEvents = function(operation) {
      var old_value;
      if (operation.next_cl.type === "Delimiter" && operation.prev_cl.type !== "Delimiter") {
        if (!operation.is_deleted) {
          old_value = operation.prev_cl.val();
          this.callEventDecorator([
            {
              type: "update",
              changedBy: operation.uid.creator,
              oldValue: old_value
            }
          ]);
        }
        operation.prev_cl.applyDelete();
      } else if (operation.next_cl.type !== "Delimiter") {
        operation.applyDelete();
      } else {
        this.callEventDecorator([
          {
            type: "add",
            changedBy: operation.uid.creator
          }
        ]);
      }
      return void 0;
    };

    ReplaceManager.prototype.callOperationSpecificDeleteEvents = function(operation, del_op) {
      if (operation.next_cl.type === "Delimiter") {
        return this.callEventDecorator([
          {
            type: "delete",
            changedBy: del_op.uid.creator,
            oldValue: operation.val()
          }
        ]);
      }
    };

    ReplaceManager.prototype.replace = function(content, replaceable_uid) {
      var o, relp;
      o = this.getLastOperation();
      relp = (new ops.Insert(null, content, null, this, replaceable_uid, o, o.next_cl)).execute();
      return void 0;
    };

    ReplaceManager.prototype.isContentDeleted = function() {
      return this.getLastOperation().isDeleted();
    };

    ReplaceManager.prototype.deleteContent = function() {
      var last_op;
      last_op = this.getLastOperation();
      if ((!last_op.isDeleted()) && last_op.type !== "Delimiter") {
        (new ops.Delete(null, void 0, this.getLastOperation().uid)).execute();
      }
      return void 0;
    };

    ReplaceManager.prototype.val = function() {
      var o;
      o = this.getLastOperation();
      return typeof o.val === "function" ? o.val() : void 0;
    };

    return ReplaceManager;

  })(ops.ListManager);
  return basic_ops;
};
