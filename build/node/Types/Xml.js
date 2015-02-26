var YXml, dont_proxy, initialize_proxies, proxies_are_initialized, proxy_token;

YXml = (function() {
  function YXml(tag_or_dom, attributes) {
    var a, a_name, c, c_name, tagname, _classes, _i, _len, _ref;
    if (attributes == null) {
      attributes = {};
    }
    if (tag_or_dom == null) {

    } else if (tag_or_dom.constructor === String) {
      tagname = tag_or_dom;
      this._xml = {};
      this._xml.children = [];
      this._xml.tagname = tagname;
      if (attributes.constructor !== Object) {
        throw new Error("The attributes must be specified as a Object");
      }
      for (a_name in attributes) {
        a = attributes[a_name];
        if (a.constructor !== String) {
          throw new Error("The attributes must be of type String!");
        }
      }
      this._xml.attributes = attributes;
      this._xml.classes = {};
      _classes = this._xml.attributes["class"];
      delete this._xml.attributes["class"];
      if (_classes != null) {
        _ref = _classes.split(" ");
        for (c = _i = 0, _len = _ref.length; _i < _len; c = ++_i) {
          c_name = _ref[c];
          if (c.length > 0) {
            this._xml.classes[c_name] = c;
          }
        }
      }
      void 0;
    } else if (tag_or_dom instanceof Element) {
      this._dom = tag_or_dom;
      this._xml = {};
    }
  }

  YXml.prototype._name = "Xml";

  YXml.prototype._getModel = function(Y, ops) {
    var attribute, c, child, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    if (this._model == null) {
      if (this._dom != null) {
        this._xml.tagname = this._dom.tagName.toLowerCase();
        this._xml.attributes = {};
        this._xml.classes = {};
        _ref = this._dom.attributes;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          attribute = _ref[_i];
          if (attribute.name === "class") {
            _ref1 = attribute.value.split(" ");
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              c = _ref1[_j];
              this._xml.classes[c] = true;
            }
          } else {
            this._xml.attributes[attribute.name] = attribute.value;
          }
        }
        this._xml.children = [];
        _ref2 = this._dom.childNodes;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          child = _ref2[_k];
          if (child.nodeType === child.TEXT_NODE) {
            this._xml.children.push(child.textContent);
          } else {
            this._xml.children.push(new YXml(child));
          }
        }
      }
      this._model = new ops.MapManager(this).execute();
      this._model.val("attributes", new Y.Object(this._xml.attributes));
      this._model.val("classes", new Y.Object(this._xml.classes));
      this._model.val("tagname", this._xml.tagname);
      this._model.val("children", new Y.List(this._xml.children));
      if (this._xml.parent != null) {
        this._model.val("parent", this._xml.parent);
      }
      if (this._dom != null) {
        this.getDom();
      }
      this._setModel(this._model);
    }
    return this._model;
  };

  YXml.prototype._setModel = function(_at__model) {
    this._model = _at__model;
    this._model.observe(function(events) {
      var c, children, event, i, parent, _i, _len, _ref, _results;
      _results = [];
      for (_i = 0, _len = events.length; _i < _len; _i++) {
        event = events[_i];
        if (event.name === "parent" && event.type !== "add") {
          parent = event.oldValue;
          children = (_ref = parent._model.val("children")) != null ? _ref.val() : void 0;
          if (children != null) {
            _results.push((function() {
              var _j, _len1, _results1;
              _results1 = [];
              for (i = _j = 0, _len1 = children.length; _j < _len1; i = ++_j) {
                c = children[i];
                if (c === this) {
                  parent._model.val("children")["delete"](i);
                  break;
                } else {
                  _results1.push(void 0);
                }
              }
              return _results1;
            }).call(this));
          } else {
            _results.push(void 0);
          }
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    });
    return delete this._xml;
  };

  YXml.prototype._setParent = function(parent) {
    if (parent instanceof YXml) {
      if (this._model != null) {
        this.remove();
        return this._model.val("parent", parent);
      } else {
        return this._xml.parent = parent;
      }
    } else {
      throw new Error("parent must be of type Y.Xml!");
    }
  };

  YXml.prototype.toString = function() {
    var child, name, value, xml, _i, _len, _ref, _ref1;
    xml = "<" + this._model.val("tagname");
    _ref = this.attr();
    for (name in _ref) {
      value = _ref[name];
      xml += " " + name + '="' + value + '"';
    }
    xml += ">";
    _ref1 = this._model.val("children").val();
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      child = _ref1[_i];
      xml += child.toString();
    }
    xml += '</' + this._model.val("tagname") + '>';
    return xml;
  };

  YXml.prototype.attr = function(name, value) {
    var attrs, classes;
    if (arguments.length > 1) {
      if (value.constructor !== String) {
        throw new Error("The attributes must be of type String!");
      }
      this._model.val("attributes").val(name, value);
      return this;
    } else if (arguments.length > 0) {
      if (name === "class") {
        return Object.keys(this._model.val("classes").val()).join(" ");
      } else {
        return this._model.val("attributes").val(name);
      }
    } else {
      attrs = this._model.val("attributes").val();
      classes = Object.keys(this._model.val("classes").val()).join(" ");
      if (classes.length > 0) {
        attrs["class"] = classes;
      }
      return attrs;
    }
  };

  YXml.prototype.addClass = function(names) {
    var name, _i, _len, _ref;
    _ref = names.split(" ");
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      name = _ref[_i];
      this._model.val("classes").val(name, true);
    }
    return this;
  };

  YXml.prototype.after = function() {
    var c, content, contents, parent, position, _i, _j, _len, _len1, _ref;
    parent = this._model.val("parent");
    if (parent == null) {
      throw new Error("This Xml Element must not have siblings! (for it does not have a parent)");
    }
    _ref = parent.getChildren();
    for (position = _i = 0, _len = _ref.length; _i < _len; position = ++_i) {
      c = _ref[position];
      if (c === this) {
        break;
      }
    }
    contents = [];
    for (_j = 0, _len1 = arguments.length; _j < _len1; _j++) {
      content = arguments[_j];
      if (content instanceof YXml) {
        content._setParent(this._model.val("parent"));
      } else if (content.constructor !== String) {
        throw new Error("Y.Xml.after expects instances of YXml or String as a parameter");
      }
      contents.push(content);
    }
    return parent._model.val("children").insertContents(position + 1, contents);
  };

  YXml.prototype.append = function() {
    var content, _i, _len;
    for (_i = 0, _len = arguments.length; _i < _len; _i++) {
      content = arguments[_i];
      if (content instanceof YXml) {
        content._setParent(this);
      } else if (content.constructor !== String) {
        throw new Error("Y.Xml.after expects instances of YXml or String as a parameter");
      }
      this._model.val("children").push(content);
    }
    return this;
  };

  YXml.prototype.before = function() {
    var c, content, contents, parent, position, _i, _j, _len, _len1, _ref;
    parent = this._model.val("parent");
    if (parent == null) {
      throw new Error("This Xml Element must not have siblings! (for it does not have a parent)");
    }
    _ref = parent.getChildren();
    for (position = _i = 0, _len = _ref.length; _i < _len; position = ++_i) {
      c = _ref[position];
      if (c === this) {
        break;
      }
    }
    contents = [];
    for (_j = 0, _len1 = arguments.length; _j < _len1; _j++) {
      content = arguments[_j];
      if (content instanceof YXml) {
        content._setParent(this._model.val("parent"));
      } else if (content.constructor !== String) {
        throw new Error("Y.Xml.after expects instances of YXml or String as a parameter");
      }
      contents.push(content);
    }
    return parent._model.val("children").insertContents(position, contents);
  };

  YXml.prototype.empty = function() {
    var child, children, _i, _len, _ref, _results;
    children = this._model.val("children");
    _ref = children.val();
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child.constructor === String) {
        _results.push(children["delete"](0));
      } else {
        _results.push(child.remove());
      }
    }
    return _results;
  };

  YXml.prototype.hasClass = function(className) {
    if (this._model.val("classes").val(className) != null) {
      return true;
    } else {
      return false;
    }
  };

  YXml.prototype.prepend = function() {
    var content, _i, _len;
    for (_i = 0, _len = arguments.length; _i < _len; _i++) {
      content = arguments[_i];
      if (content instanceof YXml) {
        content._setParent(this);
      } else if (content.constructor !== String) {
        throw new Error("Y.Xml.after expects instances of YXml or String as a parameter");
      }
      this._model.val("children").insert(0, content);
    }
    return this;
  };

  YXml.prototype.remove = function() {
    var parent;
    parent = this._model["delete"]("parent");
    return this;
  };

  YXml.prototype.removeAttr = function(attrName) {
    if (attrName === "class") {
      this._model.val("classes", new this._model.custom_types.Object());
    } else {
      this._model.val("attributes")["delete"](attrName);
    }
    return this;
  };

  YXml.prototype.removeClass = function() {
    var className, _i, _len;
    if (arguments.length === 0) {
      this._model.val("classes", new this._model.custom_types.Object());
    } else {
      for (_i = 0, _len = arguments.length; _i < _len; _i++) {
        className = arguments[_i];
        this._model.val("classes")["delete"](className);
      }
    }
    return this;
  };

  YXml.prototype.toggleClass = function() {
    var className, classes, _i, _len;
    for (_i = 0, _len = arguments.length; _i < _len; _i++) {
      className = arguments[_i];
      classes = this._model.val("classes");
      if (classes.val(className) != null) {
        classes["delete"](className);
      } else {
        classes.val(className, true);
      }
    }
    return this;
  };

  YXml.prototype.getParent = function() {
    return this._model.val("parent");
  };

  YXml.prototype.getChildren = function() {
    return this._model.val("children").val();
  };

  YXml.prototype.getPosition = function() {
    var c, i, parent, _i, _len, _ref;
    parent = this._model.val("parent");
    if (parent != null) {
      _ref = parent._model.val("children").val();
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        c = _ref[i];
        if (c === this) {
          return i;
        }
      }
      throw new Error("This is not a child of its parent (should not happen in Y.Xml!)");
    } else {
      return null;
    }
  };

  YXml.prototype.getDom = function() {
    var attr_name, attr_value, child, dom, i, that, _i, _len, _ref, _ref1;
    if (this._dom == null) {
      this._dom = document.createElement(this._model.val("tagname"));
      _ref = this.attr();
      for (attr_name in _ref) {
        attr_value = _ref[attr_name];
        this._dom.setAttribute(attr_name, attr_value);
      }
      _ref1 = this.getChildren();
      for (i = _i = 0, _len = _ref1.length; _i < _len; i = ++_i) {
        child = _ref1[i];
        if (child.constructor === String) {
          dom = document.createTextNode(child);
        } else {
          dom = child.getDom();
        }
        this._dom.insertBefore(dom);
      }
    }
    that = this;
    if (this._dom._y_xml == null) {
      this._dom._y_xml = this;
      initialize_proxies.call(this);
      this._model.val("children").observe(function(events) {
        var children, deleted, event, newNode, rightNode, _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = events.length; _j < _len1; _j++) {
          event = events[_j];
          if (event.type === "insert") {
            newNode = event.value.getDom();
            children = that._dom.childNodes;
            if (children.length > 0) {
              rightNode = children[0];
            } else {
              rightNode = null;
            }
            event.value._setParent(that);
            _results.push(dont_proxy(function() {
              return that._dom.insertBefore(newNode, rightNode);
            }));
          } else if (event.type === "delete") {
            deleted = event.oldValue.getDom();
            _results.push(dont_proxy(function() {
              return that._dom.removeChild(deleted);
            }));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
      this._model.val("attributes").observe(function(events) {
        var event, newval, _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = events.length; _j < _len1; _j++) {
          event = events[_j];
          if (event.type === "add" || event.type === "update") {
            newval = event.object.val(event.name);
            _results.push(dont_proxy(function() {
              return that._dom.setAttribute(event.name, newval);
            }));
          } else if (event.type === "delete") {
            _results.push(dont_proxy(function() {
              return that._dom.removeAttribute(event.name);
            }));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
      this._model.val("classes").observe(function(events) {
        var event, _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = events.length; _j < _len1; _j++) {
          event = events[_j];
          if (event.type === "add" || event.type === "update") {
            _results.push(dont_proxy(function() {
              return that._dom.classList.add(event.name);
            }));
          } else if (event.type === "delete") {
            _results.push(dont_proxy(function() {
              return that._dom.classList.remove(event.name);
            }));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
    }
    return this._dom;
  };

  return YXml;

})();

proxies_are_initialized = false;

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

initialize_proxies = function() {
  var insertBefore, removeChild, replaceChild, that, _proxy;
  _proxy = function(f_name, f, source) {
    var old_f;
    if (source == null) {
      source = Element.prototype;
    }
    old_f = source[f_name];
    return source[f_name] = function() {
      if ((this._y_xml == null) || proxy_token) {
        return old_f.apply(this, arguments);
      } else {
        return f.apply(this._y_xml, arguments);
      }
    };
  };
  that = this;
  this._dom.classList.add = function(c) {
    return that.addClass(c);
  };
  this._dom.classList.remove = function(c) {
    return that.removeClass(c);
  };
  this._dom.__defineSetter__('className', function(val) {
    return that.attr('class', val);
  });
  this._dom.__defineGetter__('className', function() {
    return that.attr('class');
  });
  this._dom.__defineSetter__('textContent', function(val) {
    that.empty();
    if (val !== "") {
      return that.append(val);
    }
  });
  if (proxies_are_initialized) {
    return;
  }
  proxies_are_initialized = true;
  insertBefore = function(insertedNode_s, adjacentNode) {
    var child, new_childs, pos;
    if (adjacentNode != null) {
      pos = adjacentNode._y_xml.getPosition();
    } else {
      pos = this.getChildren().length;
    }
    new_childs = [];
    if (insertedNode_s.nodeType === insertedNode_s.DOCUMENT_FRAGMENT_NODE) {
      child = insertedNode_s.firstChild;
      while (child != null) {
        new_childs.push(child);
        child = child.nextSibling;
      }
    } else {
      new_childs.push(insertedNode_s);
    }
    new_childs = new_childs.map(function(child) {
      if (child._y_xml != null) {
        return child._y_xml;
      } else if (child.nodeType === child.TEXT_NODE) {
        return child.textContent;
      } else {
        return new YXml(child);
      }
    });
    return this._model.val("children").insertContents(pos, new_childs);
  };
  _proxy('insertBefore', insertBefore);
  _proxy('appendChild', insertBefore);
  _proxy('removeAttribute', function(name) {
    return this.removeAttr(name);
  });
  _proxy('setAttribute', function(name, value) {
    return this.attr(name, value);
  });
  removeChild = function(node) {
    return node._y_xml.remove();
  };
  _proxy('removeChild', removeChild, this._dom);
  replaceChild = function(insertedNode, replacedNode) {
    insertBefore.call(this, insertedNode, replacedNode);
    return removeChild.call(this, replacedNode);
  };
  return _proxy('replaceChild', replaceChild, this._dom);
};

if (typeof window !== "undefined" && window !== null) {
  if (window.Y != null) {
    window.Y.Xml = YXml;
  } else {
    throw new Error("You must first import Y!");
  }
}

if (typeof module !== "undefined" && module !== null) {
  module.exports = YXml;
}
