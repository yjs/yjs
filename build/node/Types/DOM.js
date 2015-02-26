var json_types_uninitialized,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __hasProp = {}.hasOwnProperty;

json_types_uninitialized = require("./JsonTypes");

module.exports = function(HB) {
  var XmlType, json_types, parser, types;
  json_types = json_types_uninitialized(HB);
  types = json_types.types;
  parser = json_types.parser;
  XmlType = (function(_super) {
    __extends(XmlType, _super);

    function XmlType(uid, _at_tagname, attributes, elements, _at_xml) {
      this.tagname = _at_tagname;
      this.xml = _at_xml;
    }

    XmlType.prototype.setXmlProxy = function() {};

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
  return parser['XmlType'] = function(json) {
    var attributes, elements, tagname, uid;
    uid = json['uid'], attributes = json['attributes'], elements = json['elements'], tagname = json['tagname'];
    return new XmlType(uid, tagname, attributes, elements, void 0);
  };
};
