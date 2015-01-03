(function() {
  var structured_types_uninitialized,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  structured_types_uninitialized = require("./StructuredTypes");

  module.exports = function(HB) {
    var TextDelete, TextInsert, WordType, parser, structured_types, types;
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
        var _ref;
        if (content != null ? (_ref = content.uid) != null ? _ref.creator : void 0 : void 0) {
          this.saveOperation('content', content);
        } else {
          this.content = content;
        }
        if (!((prev != null) && (next != null))) {
          throw new Error("You must define prev, and next for TextInsert-types!");
        }
        TextInsert.__super__.constructor.call(this, uid, prev, next, origin);
      }

      TextInsert.prototype.type = "TextInsert";

      TextInsert.prototype.getLength = function() {
        if (this.isDeleted()) {
          return 0;
        } else {
          return this.content.length;
        }
      };

      TextInsert.prototype.applyDelete = function() {
        TextInsert.__super__.applyDelete.apply(this, arguments);
        if (this.content instanceof types.Operation) {
          this.content.applyDelete();
        }
        return this.content = null;
      };

      TextInsert.prototype.execute = function() {
        if (!this.validateSavedOperations()) {
          return false;
        } else {
          if (this.content instanceof types.Operation) {
            this.content.insert_parent = this;
          }
          return TextInsert.__super__.execute.call(this);
        }
      };

      TextInsert.prototype.val = function(current_position) {
        if (this.isDeleted() || (this.content == null)) {
          return "";
        } else {
          return this.content;
        }
      };

      TextInsert.prototype._encode = function() {
        var json, _ref;
        json = {
          'type': "TextInsert",
          'uid': this.getUid(),
          'prev': this.prev_cl.getUid(),
          'next': this.next_cl.getUid()
        };
        if (((_ref = this.content) != null ? _ref.getUid : void 0) != null) {
          json['content'] = this.content.getUid();
        } else {
          json['content'] = this.content;
        }
        if (this.origin !== this.prev_cl) {
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
    WordType = (function(_super) {
      __extends(WordType, _super);

      function WordType(uid, beginning, end, prev, next, origin) {
        WordType.__super__.constructor.call(this, uid, beginning, end, prev, next, origin);
      }

      WordType.prototype.type = "WordType";

      WordType.prototype.applyDelete = function() {
        var o;
        o = this.beginning;
        while (o != null) {
          o.applyDelete();
          o = o.next_cl;
        }
        return WordType.__super__.applyDelete.call(this);
      };

      WordType.prototype.cleanup = function() {
        return WordType.__super__.cleanup.call(this);
      };

      WordType.prototype.push = function(content) {
        return this.insertAfter(this.end.prev_cl, content);
      };

      WordType.prototype.insertAfter = function(left, content) {
        var c, right, tmp, _i, _len;
        while (left.isDeleted()) {
          left = left.prev_cl;
        }
        right = left.next_cl;
        if (content.type != null) {
          (new TextInsert(content, void 0, left, right)).execute();
        } else {
          for (_i = 0, _len = content.length; _i < _len; _i++) {
            c = content[_i];
            tmp = (new TextInsert(c, void 0, left, right)).execute();
            left = tmp;
          }
        }
        return this;
      };

      WordType.prototype.insertText = function(position, content) {
        var ith;
        ith = this.getOperationByPosition(position);
        return this.insertAfter(ith, content);
      };

      WordType.prototype.deleteText = function(position, length) {
        var d, delete_ops, i, o, _i;
        o = this.getOperationByPosition(position + 1);
        delete_ops = [];
        for (i = _i = 0; 0 <= length ? _i < length : _i > length; i = 0 <= length ? ++_i : --_i) {
          if (o instanceof types.Delimiter) {
            break;
          }
          d = (new TextDelete(void 0, o)).execute();
          o = o.next_cl;
          while (!(o instanceof types.Delimiter) && o.isDeleted()) {
            o = o.next_cl;
          }
          delete_ops.push(d._encode());
        }
        return this;
      };

      WordType.prototype.val = function() {
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

      WordType.prototype.toString = function() {
        return this.val();
      };

      WordType.prototype.bind = function(textfield) {
        var word;
        word = this;
        textfield.value = this.val();
        this.observe(function(events) {
          var event, fix, left, o_pos, right, _i, _len, _results;
          _results = [];
          for (_i = 0, _len = events.length; _i < _len; _i++) {
            event = events[_i];
            if (event.type === "insert") {
              o_pos = event.position;
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
              _results.push(textfield.setSelectionRange(left, right));
            } else if (event.type === "delete") {
              o_pos = event.position;
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
              _results.push(textfield.setSelectionRange(left, right));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
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

      WordType.prototype._encode = function() {
        var json;
        json = {
          'type': "WordType",
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
        if (this.origin != null) {
          json["origin"] = this.origin().getUid();
        }
        return json;
      };

      return WordType;

    })(types.ListManager);
    parser['WordType'] = function(json) {
      var beginning, end, next, origin, prev, uid;
      uid = json['uid'], beginning = json['beginning'], end = json['end'], prev = json['prev'], next = json['next'], origin = json['origin'];
      return new WordType(uid, beginning, end, prev, next, origin);
    };
    types['TextInsert'] = TextInsert;
    types['TextDelete'] = TextDelete;
    types['WordType'] = WordType;
    return structured_types;
  };

}).call(this);

//# sourceMappingURL=../Types/TextTypes.js.map