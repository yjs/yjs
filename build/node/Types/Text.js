var YText;

YText = (function() {
  function YText(text) {
    this.textfields = [];
    if (text == null) {
      this._text = "";
    } else if (text.constructor === String) {
      this._text = text;
    } else {
      throw new Error("Y.Text expects a String as a constructor");
    }
  }

  YText.prototype._name = "Text";

  YText.prototype._getModel = function(types, ops) {
    if (this._model == null) {
      this._model = new ops.ListManager(this).execute();
      this.insert(0, this._text);
    }
    delete this._text;
    return this._model;
  };

  YText.prototype._setModel = function(_at__model) {
    this._model = _at__model;
    return delete this._text;
  };

  YText.prototype.val = function() {
    return this._model.fold("", function(left, o) {
      return left + o.val();
    });
  };

  YText.prototype.observe = function() {
    return this._model.observe.apply(this._model, arguments);
  };

  YText.prototype.unobserve = function() {
    return this._model.unobserve.apply(this._model, arguments);
  };

  YText.prototype.toString = function() {
    return this.val();
  };

  YText.prototype.insert = function(position, content) {
    var ith;
    if (content.constructor !== String) {
      throw new Error("Y.String.insert expects a String as the second parameter!");
    }
    if (typeof position !== "number") {
      throw new Error("Y.String.insert expects a Number as the second parameter!");
    }
    if (content.length > 0) {
      ith = this._model.getOperationByPosition(position);
      return this._model.insertAfter(ith, content);
    }
  };

  YText.prototype["delete"] = function(position, length) {
    return this._model["delete"](position, length);
  };

  YText.prototype.bind = function(textfield, dom_root) {
    var createRange, creator_token, t, word, writeContent, writeRange, _i, _len, _ref;
    if (dom_root == null) {
      dom_root = window;
    }
    if (dom_root.getSelection == null) {
      dom_root = window;
    }
    _ref = this.textfields;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      t = _ref[_i];
      if (t === textfield) {
        return;
      }
    }
    creator_token = false;
    word = this;
    textfield.value = this.val();
    this.textfields.push(textfield);
    if ((textfield.selectionStart != null) && (textfield.setSelectionRange != null)) {
      createRange = function(fix) {
        var left, right;
        left = textfield.selectionStart;
        right = textfield.selectionEnd;
        if (fix != null) {
          left = fix(left);
          right = fix(right);
        }
        return {
          left: left,
          right: right
        };
      };
      writeRange = function(range) {
        writeContent(word.val());
        return textfield.setSelectionRange(range.left, range.right);
      };
      writeContent = function(content) {
        return textfield.value = content;
      };
    } else {
      createRange = function(fix) {
        var clength, edited_element, range, s;
        range = {};
        s = dom_root.getSelection();
        clength = textfield.textContent.length;
        range.left = Math.min(s.anchorOffset, clength);
        range.right = Math.min(s.focusOffset, clength);
        if (fix != null) {
          range.left = fix(range.left);
          range.right = fix(range.right);
        }
        edited_element = s.focusNode;
        if (edited_element === textfield || edited_element === textfield.childNodes[0]) {
          range.isReal = true;
        } else {
          range.isReal = false;
        }
        return range;
      };
      writeRange = function(range) {
        var r, s, textnode;
        writeContent(word.val());
        textnode = textfield.childNodes[0];
        if (range.isReal && (textnode != null)) {
          if (range.left < 0) {
            range.left = 0;
          }
          range.right = Math.max(range.left, range.right);
          if (range.right > textnode.length) {
            range.right = textnode.length;
          }
          range.left = Math.min(range.left, range.right);
          r = document.createRange();
          r.setStart(textnode, range.left);
          r.setEnd(textnode, range.right);
          s = window.getSelection();
          s.removeAllRanges();
          return s.addRange(r);
        }
      };
      writeContent = function(content) {
        var c, content_array, i, _j, _len1, _results;
        content_array = content.replace(new RegExp("\n", 'g'), " ").split(" ");
        textfield.innerText = "";
        _results = [];
        for (i = _j = 0, _len1 = content_array.length; _j < _len1; i = ++_j) {
          c = content_array[i];
          textfield.innerText += c;
          if (i !== content_array.length - 1) {
            _results.push(textfield.innerHTML += '&nbsp;');
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      };
    }
    writeContent(this.val());
    this.observe(function(events) {
      var event, fix, o_pos, r, _j, _len1, _results;
      _results = [];
      for (_j = 0, _len1 = events.length; _j < _len1; _j++) {
        event = events[_j];
        if (!creator_token) {
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
            r = createRange(fix);
            _results.push(writeRange(r));
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
            r = createRange(fix);
            _results.push(writeRange(r));
          } else {
            _results.push(void 0);
          }
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    });
    textfield.onkeypress = function(event) {
      var char, diff, pos, r;
      if (word.is_deleted) {
        textfield.onkeypress = null;
        return true;
      }
      creator_token = true;
      char = null;
      if (event.keyCode === 13) {
        char = '\n';
      } else if (event.key != null) {
        if (event.charCode === 32) {
          char = " ";
        } else {
          char = event.key;
        }
      } else {
        char = window.String.fromCharCode(event.keyCode);
      }
      if (char.length > 1) {
        return true;
      } else if (char.length > 0) {
        r = createRange();
        pos = Math.min(r.left, r.right);
        diff = Math.abs(r.right - r.left);
        word["delete"](pos, diff);
        word.insert(pos, char);
        r.left = pos + char.length;
        r.right = r.left;
        writeRange(r);
      }
      event.preventDefault();
      creator_token = false;
      return false;
    };
    textfield.onpaste = function(event) {
      if (word.is_deleted) {
        textfield.onpaste = null;
        return true;
      }
      return event.preventDefault();
    };
    textfield.oncut = function(event) {
      if (word.is_deleted) {
        textfield.oncut = null;
        return true;
      }
      return event.preventDefault();
    };
    return textfield.onkeydown = function(event) {
      var del_length, diff, new_pos, pos, r, val;
      creator_token = true;
      if (word.is_deleted) {
        textfield.onkeydown = null;
        return true;
      }
      r = createRange();
      pos = Math.min(r.left, r.right, word.val().length);
      diff = Math.abs(r.left - r.right);
      if ((event.keyCode != null) && event.keyCode === 8) {
        if (diff > 0) {
          word["delete"](pos, diff);
          r.left = pos;
          r.right = pos;
          writeRange(r);
        } else {
          if ((event.ctrlKey != null) && event.ctrlKey) {
            val = word.val();
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
            word["delete"](new_pos, pos - new_pos);
            r.left = new_pos;
            r.right = new_pos;
            writeRange(r);
          } else {
            if (pos > 0) {
              word["delete"](pos - 1, 1);
              r.left = pos - 1;
              r.right = pos - 1;
              writeRange(r);
            }
          }
        }
        event.preventDefault();
        creator_token = false;
        return false;
      } else if ((event.keyCode != null) && event.keyCode === 46) {
        if (diff > 0) {
          word["delete"](pos, diff);
          r.left = pos;
          r.right = pos;
          writeRange(r);
        } else {
          word["delete"](pos, 1);
          r.left = pos;
          r.right = pos;
          writeRange(r);
        }
        event.preventDefault();
        creator_token = false;
        return false;
      } else {
        creator_token = false;
        return true;
      }
    };
  };

  return YText;

})();

if (typeof window !== "undefined" && window !== null) {
  if (window.Y != null) {
    window.Y.Text = YText;
  } else {
    throw new Error("You must first import Y!");
  }
}

if (typeof module !== "undefined" && module !== null) {
  module.exports = YText;
}
