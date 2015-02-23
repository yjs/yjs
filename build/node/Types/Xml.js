var YXml;

YXml = (function() {
  function YXml(tagname, attributes, children, classes) {
    var a, a_name, c, c_name, _classes, _i, _len, _ref;
    if (attributes == null) {
      attributes = {};
    }
    if (children == null) {
      children = [];
    }
    if (classes == null) {
      classes = {};
    }
    this._xml = {};
    if (tagname == null) {
      throw new Error("You must specify a tagname");
    }
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
    if (classes.constructor !== Object) {
      throw new Error("The classes must be specified as an Array");
    }
    this._xml.classes = classes;
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
    if (children.constructor !== Array) {
      throw new Error("You must specify the children as an Array that contains Strings and Y.Xml objects only");
    }
  }

  YXml.prototype._name = "Xml";

  YXml.prototype._getModel = function(types, ops) {
    if (this._model == null) {
      this._model = new ops.MapManager(this).execute();
      this._model.val("attributes", new Y.Object(this._xml.attributes)).val("classes", new Y.Object(this._xml.classes)).val("tagname", this._xml.tagname).val("children", this._xml.children);
    }
    delete this._xml;
    return this._model;
  };

  YXml.prototype._setModel = function(_at__model) {
    this._model = _at__model;
    return delete this._xml;
  };

  YXml.prototype.attr = function(name, value) {
    if (arguments.length > 1) {
      if (value.constructor !== Strings) {
        throw new Error("The attributes must be of type String!");
      }
      this._model.val("attributes").val(name, value);
      return this;
    } else if (arguments.length > 0) {
      return this._model.val("attributes").val(name);
    } else {
      return this._model.val("attributes").val();
    }
  };

  YXml.prototype.addClass = function(name) {
    this._model.val("classes").val(name, true);
    return this;
  };

  YXml.prototype.removeClass = function(name) {
    return this._model.val("classes")["delete"](name);
  };

  return YXml;

})();
