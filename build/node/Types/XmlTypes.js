(function() {
  var dont_proxy, json_types_uninitialized, proxy_token, _proxy,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  json_types_uninitialized = require("./JsonTypes");

  proxy_token = false;

  dont_proxy = function(f) {
    var e;
    proxy_token = true;
    try {
      f();
    } catch (_error) {
      e = _error;
      proxy_token = false;
      throw new Error(e);
    }
    return proxy_token = false;
  };

  _proxy = function(f_name, f) {
    var old_f;
    old_f = this[f_name];
    if (old_f != null) {
      return this[f_name] = function() {
        var args, that, _ref;
        if (!proxy_token && !((_ref = this._yatta) != null ? _ref.isDeleted() : void 0)) {
          that = this;
          args = arguments;
          return dont_proxy(function() {
            f.apply(that, args);
            return old_f.apply(that, args);
          });
        } else {
          return old_f.apply(this, arguments);
        }
      };
    }
  };

  if (typeof Element !== "undefined" && Element !== null) {
    Element.prototype._proxy = _proxy;
  }

  module.exports = function(HB) {
    var TextNodeType, XmlType, json_types, parser, types;
    json_types = json_types_uninitialized(HB);
    types = json_types.types;
    parser = json_types.parser;
    XmlType = (function(_super) {
      __extends(XmlType, _super);

      function XmlType(uid, tagname, attributes, elements, xml) {
        var attr, d, element, i, n, word, _i, _j, _len, _ref, _ref1, _ref2;
        this.tagname = tagname;
        this.xml = xml;

        /* In case you make this instanceof Insert again
        if prev? and (not next?) and prev.type?
           * adjust what you actually mean. you want to insert after prev, then
           * next is not defined. but we only insert after non-deleted elements.
           * This is also handled in TextInsert.
          while prev.isDeleted()
            prev = prev.prev_cl
          next = prev.next_cl
         */
        XmlType.__super__.constructor.call(this, uid);
        if (((_ref = this.xml) != null ? _ref._yatta : void 0) != null) {
          d = new types.Delete(void 0, this.xml._yatta);
          HB.addOperation(d).execute();
          this.xml._yatta = null;
        }
        if ((attributes != null) && (elements != null)) {
          this.saveOperation('attributes', attributes);
          this.saveOperation('elements', elements);
        } else if ((attributes == null) && (elements == null)) {
          this.attributes = new types.JsonType();
          this.attributes.setMutableDefault('immutable');
          HB.addOperation(this.attributes).execute();
          this.elements = new types.WordType();
          this.elements.parent = this;
          HB.addOperation(this.elements).execute();
        } else {
          throw new Error("Either define attribute and elements both, or none of them");
        }
        if (this.xml != null) {
          this.tagname = this.xml.tagName;
          for (i = _i = 0, _ref1 = this.xml.attributes.length; 0 <= _ref1 ? _i < _ref1 : _i > _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
            attr = xml.attributes[i];
            this.attributes.val(attr.name, attr.value);
          }
          _ref2 = this.xml.childNodes;
          for (_j = 0, _len = _ref2.length; _j < _len; _j++) {
            n = _ref2[_j];
            if (n.nodeType === n.TEXT_NODE) {
              word = new TextNodeType(void 0, n);
              HB.addOperation(word).execute();
              this.elements.push(word);
            } else if (n.nodeType === n.ELEMENT_NODE) {
              element = new XmlType(void 0, void 0, void 0, void 0, n);
              HB.addOperation(element).execute();
              this.elements.push(element);
            } else {
              throw new Error("I don't know Node-type " + n.nodeType + "!!");
            }
          }
          this.setXmlProxy();
        }
        void 0;
      }

      XmlType.prototype.type = "XmlType";

      XmlType.prototype.applyDelete = function(op) {
        if ((this.insert_parent != null) && !this.insert_parent.isDeleted()) {
          return this.insert_parent.applyDelete(op);
        } else {
          this.attributes.applyDelete();
          this.elements.applyDelete();
          return XmlType.__super__.applyDelete.apply(this, arguments);
        }
      };

      XmlType.prototype.cleanup = function() {
        return XmlType.__super__.cleanup.call(this);
      };

      XmlType.prototype.setXmlProxy = function() {
        var findNode, insertBefore, removeChild, renewClassList, that;
        this.xml._yatta = this;
        that = this;
        this.elements.on('insert', function(event, op) {
          var newNode, right, rightNode;
          if (op.creator !== HB.getUserId() && this === that.elements) {
            newNode = op.content.val();
            right = op.next_cl;
            while ((right != null) && right.isDeleted()) {
              right = right.next_cl;
            }
            rightNode = null;
            if (right.type !== 'Delimiter') {
              rightNode = right.val().val();
            }
            return dont_proxy(function() {
              return that.xml.insertBefore(newNode, rightNode);
            });
          }
        });
        this.elements.on('delete', function(event, op) {
          var del_op, deleted;
          del_op = op.deleted_by[0];
          if ((del_op != null) && del_op.creator !== HB.getUserId() && this === that.elements) {
            deleted = op.content.val();
            return dont_proxy(function() {
              return that.xml.removeChild(deleted);
            });
          }
        });
        this.attributes.on(['add', 'update'], function(event, property_name, op) {
          if (op.creator !== HB.getUserId() && this === that.attributes) {
            return dont_proxy(function() {
              var newval;
              newval = op.val().val();
              if (newval != null) {
                return that.xml.setAttribute(property_name, op.val().val());
              } else {
                return that.xml.removeAttribute(property_name);
              }
            });
          }
        });
        findNode = function(child) {
          var elem;
          if (child == null) {
            throw new Error("you must specify a parameter!");
          }
          child = child._yatta;
          elem = that.elements.beginning.next_cl;
          while (elem.type !== 'Delimiter' && elem.content !== child) {
            elem = elem.next_cl;
          }
          if (elem.type === 'Delimiter') {
            return false;
          } else {
            return elem;
          }
        };
        insertBefore = function(insertedNode_s, adjacentNode) {
          var child, element, inserted_nodes, next, prev, _results;
          next = null;
          if (adjacentNode != null) {
            next = findNode(adjacentNode);
          }
          prev = null;
          if (next) {
            prev = next.prev_cl;
          } else {
            prev = this._yatta.elements.end.prev_cl;
            while (prev.isDeleted()) {
              prev = prev.prev_cl;
            }
          }
          inserted_nodes = null;
          if (insertedNode_s.nodeType === insertedNode_s.DOCUMENT_FRAGMENT_NODE) {
            child = insertedNode_s.lastChild;
            _results = [];
            while (child != null) {
              element = new XmlType(void 0, void 0, void 0, void 0, child);
              HB.addOperation(element).execute();
              that.elements.insertAfter(prev, element);
              _results.push(child = child.previousSibling);
            }
            return _results;
          } else {
            element = new XmlType(void 0, void 0, void 0, void 0, insertedNode_s);
            HB.addOperation(element).execute();
            return that.elements.insertAfter(prev, element);
          }
        };
        this.xml._proxy('insertBefore', insertBefore);
        this.xml._proxy('appendChild', insertBefore);
        this.xml._proxy('removeAttribute', function(name) {
          return that.attributes.val(name, void 0);
        });
        this.xml._proxy('setAttribute', function(name, value) {
          return that.attributes.val(name, value);
        });
        renewClassList = function(newclass) {
          var dont_do_it, elem, value, _i, _len;
          dont_do_it = false;
          if (newclass != null) {
            for (_i = 0, _len = this.length; _i < _len; _i++) {
              elem = this[_i];
              if (newclass === elem) {
                dont_do_it = true;
              }
            }
          }
          value = Array.prototype.join.call(this, " ");
          if ((newclass != null) && !dont_do_it) {
            value += " " + newclass;
          }
          return that.attributes.val('class', value);
        };
        _proxy.call(this.xml.classList, 'add', renewClassList);
        _proxy.call(this.xml.classList, 'remove', renewClassList);
        this.xml.__defineSetter__('className', function(val) {
          return this.setAttribute('class', val);
        });
        this.xml.__defineGetter__('className', function() {
          return that.attributes.val('class');
        });
        this.xml.__defineSetter__('textContent', function(val) {
          var elem, remove, text_node;
          elem = that.xml.firstChild;
          while (elem != null) {
            remove = elem;
            elem = elem.nextSibling;
            that.xml.removeChild(remove);
          }
          if (val !== "") {
            text_node = document.createTextNode(val);
            return that.xml.appendChild(text_node);
          }
        });
        removeChild = function(node) {
          var d, elem;
          elem = findNode(node);
          if (!elem) {
            throw new Error("You are only allowed to delete existing (direct) child elements!");
          }
          d = new types.Delete(void 0, elem);
          HB.addOperation(d).execute();
          return node._yatta = null;
        };
        this.xml._proxy('removeChild', removeChild);
        return this.xml._proxy('replaceChild', function(insertedNode, replacedNode) {
          insertBefore.call(this, insertedNode, replacedNode);
          return removeChild.call(this, replacedNode);
        });
      };

      XmlType.prototype.val = function(enforce) {
        var a, attr, attr_name, e, n, text_node, value;
        if (enforce == null) {
          enforce = false;
        }
        if (typeof document !== "undefined" && document !== null) {
          if ((this.xml == null) || enforce) {
            this.xml = document.createElement(this.tagname);
            attr = this.attributes.val();
            for (attr_name in attr) {
              value = attr[attr_name];
              if (value != null) {
                a = document.createAttribute(attr_name);
                a.value = value;
                this.xml.setAttributeNode(a);
              }
            }
            e = this.elements.beginning.next_cl;
            while (e.type !== "Delimiter") {
              n = e.content;
              if (!e.isDeleted() && (e.content != null)) {
                if (n.type === "XmlType") {
                  this.xml.appendChild(n.val(enforce));
                } else if (n.type === "TextNodeType") {
                  text_node = n.val();
                  this.xml.appendChild(text_node);
                } else {
                  throw new Error("Internal structure cannot be transformed to dom");
                }
              }
              e = e.next_cl;
            }
          }
          this.setXmlProxy();
          return this.xml;
        }
      };

      XmlType.prototype.execute = function() {
        return XmlType.__super__.execute.call(this);
      };


      /*
        if not @validateSavedOperations()
          return false
        else
      
          return true
       */

      XmlType.prototype.getParent = function() {
        return this.parent;
      };

      XmlType.prototype._encode = function() {
        var json;
        json = {
          'type': this.type,
          'attributes': this.attributes.getUid(),
          'elements': this.elements.getUid(),
          'tagname': this.tagname,
          'uid': this.getUid()
        };
        return json;
      };

      return XmlType;

    })(types.Insert);
    parser['XmlType'] = function(json) {
      var attributes, elements, tagname, uid;
      uid = json['uid'], attributes = json['attributes'], elements = json['elements'], tagname = json['tagname'];
      return new XmlType(uid, tagname, attributes, elements, void 0);
    };
    TextNodeType = (function(_super) {
      __extends(TextNodeType, _super);

      function TextNodeType(uid, content) {
        var d;
        if (content._yatta != null) {
          d = new types.Delete(void 0, content._yatta);
          HB.addOperation(d).execute();
          content._yatta = null;
        }
        content._yatta = this;
        TextNodeType.__super__.constructor.call(this, uid, content);
      }

      TextNodeType.prototype.applyDelete = function(op) {
        if ((this.insert_parent != null) && !this.insert_parent.isDeleted()) {
          return this.insert_parent.applyDelete(op);
        } else {
          return TextNodeType.__super__.applyDelete.apply(this, arguments);
        }
      };

      TextNodeType.prototype.type = "TextNodeType";

      TextNodeType.prototype._encode = function() {
        var json;
        json = {
          'type': this.type,
          'uid': this.getUid(),
          'content': this.content.textContent
        };
        return json;
      };

      return TextNodeType;

    })(types.ImmutableObject);
    parser['TextNodeType'] = function(json) {
      var content, textnode, uid;
      uid = json['uid'], content = json['content'];
      textnode = document.createTextNode(content);
      return new TextNodeType(uid, textnode);
    };
    types['XmlType'] = XmlType;
    return json_types;
  };

}).call(this);

//# sourceMappingURL=../Types/XmlTypes.js.map