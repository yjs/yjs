(function() {
  var json_types_uninitialized,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  json_types_uninitialized = require("./JsonTypes");

  if (typeof Element !== "undefined" && Element !== null) {
    Element.prototype._proxy = function(f_name, f) {
      var old_f;
      old_f = this[f_name];
      if (old_f != null) {
        return this[f_name] = function() {
          f.apply(this, arguments);
          return old_f.apply(this, arguments);
        };
      } else {
        return this[f_name] = f;
      }
    };
  }

  module.exports = function(HB) {
    var XmlType, json_types, parser, types;
    json_types = json_types_uninitialized(HB);
    types = json_types.types;
    parser = json_types.parser;
    XmlType = (function(_super) {
      __extends(XmlType, _super);

      function XmlType(uid, tagname, attributes, elements, xml) {
        var attr, element, i, n, word, _i, _j, _len, _ref, _ref1;
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
        XmlType.__super__.constructor.call(this);
        if ((attributes != null) && (elements != null)) {
          this.saveOperation('attributes', attributes);
          this.saveOperation('elements', elements);
        } else if ((attributes == null) && (elements == null)) {
          this.attributes = new types.JsonType();
          HB.addOperation(this.attributes).execute();
          this.elements = new types.WordType();
          this.elements.parent = this;
          HB.addOperation(this.elements).execute();
        } else {
          throw new Error("Either define attribute and elements both, or none of them");
        }
        if (this.xml != null) {
          this.tagname = this.xml.tagName;
          for (i = _i = 0, _ref = this.xml.attributes.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            attr = xml.attributes[i];
            this.attributes.val(attr.name, attr.value);
          }
          _ref1 = this.xml.childNodes;
          for (_j = 0, _len = _ref1.length; _j < _len; _j++) {
            n = _ref1[_j];
            if (n.nodeType === n.TEXT_NODE) {
              word = new types.WordType();
              HB.addOperation(word).execute();
              word.push(n.textContent);
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

      XmlType.prototype.applyDelete = function() {
        this.attributes.applyDelete();
        this.elements.applyDelete();
        return XmlType.__super__.applyDelete.call(this);
      };

      XmlType.prototype.cleanup = function() {
        return XmlType.__super__.cleanup.call(this);
      };

      XmlType.prototype.setXmlProxy = function() {
        this.xml._yatta = this;
        return this.xml._proxy('insertBefore', function(insertedNode, adjacentNode) {
          var element, next, prev;
          next = adjacentNode != null ? adjacentNode._yatta : void 0;
          prev = null;
          if (next != null) {
            prev = next.prev_cl;
          } else {
            prev = this._yatta.elements.end.prev_cl;
          }
          element = new XmlType(void 0, void 0, void 0, void 0);
          HB.addOperation(element).execute();
          return this.elements.insertAfter(prev, element);
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
              a = document.createAttribute(attr_name);
              a.value = value;
              this.xml.setAttributeNode(a);
            }
            e = this.elements.beginning.next_cl;
            while (e.type !== "Delimiter") {
              n = e.content;
              if (!n.isDeleted()) {
                if (n.type === "XmlType") {
                  this.xml.appendChild(n.val(enforce));
                } else if (n.type === "WordType") {
                  text_node = document.createTextNode(n.val());
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
        return XmlType.__super__.execute.apply(this, arguments);
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
    types['XmlType'] = XmlType;
    return json_types;
  };

}).call(this);

//# sourceMappingURL=../Types/XmlTypes.js.map