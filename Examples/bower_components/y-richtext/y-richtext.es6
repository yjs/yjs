(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y) {
  Y.requestModules(['Array']).then(function () {
    class YRichtext extends Y.Array['class'] {
      constructor (os, _model, _content) {
        super(os, _model, _content)
        this.instances = []
      }
      _destroy () {
        for (var i = this.instances.length - 1; i >= 0; i--) {
          this.unbindQuill(this.instances[i].editor)
        }
        super._destroy()
      }
      get length () {
        /*
          TODO: I must not use observe to compute the length.
          But since I inherit from Y.Array, I can't set observe
          the changes at the right momet (for that I would require direct access to EventHandler).
          This is the most elegant solution, for now.
          But at some time you should re-write Y.Richtext more elegantly!!
        */
        return this.toString().length
      }
      toString () {
        return this._content.map(function (v) {
          if (typeof v.val === 'string') {
            return v.val
          }
        }).join('')
      }
      toOTOps () {
        var ops = []
        var op = {
          insert: [],
          attributes: {}
        }
        function createNewOp () {
          var attrs = {}
          // copy attributes
          for (var name in op.attributes) {
            attrs[name] = op.attributes[name]
          }
          op = {
            insert: [],
            attributes: attrs
          }
        }
        var i = 0
        for (; i < this._content.length; i++) {
          let v = this._content[i].val
          if (v.constructor === Array) {
            if (op.insert.length > 0) {
              op.insert = op.insert.join('')
              ops.push(op)
              createNewOp()
            }
            if (v[1] === null) {
              delete op.attributes[v[0]]
            } else {
              op.attributes[v[0]] = v[1]
            }
          } else {
            op.insert.push(v)
          }
        }
        if (op.insert.length > 0) {
          op.insert = op.insert.join('')
          ops.push(op)
        }
        return ops
      }
      insert (pos, content) {
        var curPos = 0
        var selection = {}
        for (var i = 0; i < this._content.length; i++) {
          if (curPos === pos) {
            break
          }
          var v = this._content[i].val
          if (typeof v === 'string') {
            curPos++
          } else if (v.constructor === Array) {
            if (v[1] === null) {
              delete selection[v[0]]
            } else {
              selection[v[0]] = v[1]
            }
          }
        }
        super.insert(i, content.split(''))
        return selection
      }
      delete (pos, length) {
        /*
          let x = to be deleted string
          let s = some string
          let * = some selection
          E.g.
          sss*s***x*xxxxx***xx*x**ss*s
               |---delete-range--|
             delStart         delEnd

          We'll check the following
          * is it possible to delete some of the selections?
            1. a dominating selection to the right could be the same as the selection (curSel) to delStart
            2. a selections could be overwritten by another selection to the right
        */
        var curPos = 0
        var curSel = {}
        var endPos = pos + length
        if (length <= 0) return
        var delStart // relative to _content
        var delEnd // ..
        var v, i // helper variable for elements of _content

        for (delStart = 0; curPos < pos && delStart < this._content.length; delStart++) {
          v = this._content[delStart].val
          if (typeof v === 'string') {
            curPos++
          } else if (v.constructor === Array) {
            curSel[v[0]] = v[1]
          }
        }
        for (delEnd = delStart; curPos < endPos && delEnd < this._content.length; delEnd++) {
          v = this._content[delEnd].val
          if (typeof v === 'string') {
            curPos++
          }
        }
        if (delEnd === this._content.length) {
          // yay, you can delete everything without checking
          for (i = delEnd - 1; i >= delStart; i--) {
            v = this._content[i].val
            super.delete(i, 1)
          }
        } else {
          if (typeof v === 'string') {
            delEnd--
          }
          var rightSel = {}
          for (i = delEnd; i >= delStart; i--) {
            v = this._content[i].val
            if (v.constructor === Array) {
              if (rightSel[v[0]] === undefined) {
                if (v[1] === curSel[v[0]]) {
                  // case 1.
                  super.delete(i, 1)
                }
                rightSel[v[0]] = v[1]
              } else {
                // case 2.
                super.delete(i, 1)
              }
            } else if (typeof v === 'string') {
              // always delete the strings
              super.delete(i, 1)
            }
          }
        }
      }
      /*
      1. get selection attributes from position $from
         (name it antiAttrs, and we'll use it to make sure that selection ends in antiAttrs)
      2. Insert selection $attr, if necessary
      3. Between from and to, we'll delete all selections that do not match $attr.
         Furthermore, we'll update antiAttrs, if necessary
      4. In the end well insert a selection that makes sure that selection($to) ends in antiAttrs
      */
      select (from, to, attrName, attrValue) {
        if (from == null || to == null || attrName == null || attrValue === undefined) {
          throw new Error('You must define four parameters')
        } else {
          var step2i
          var step2sel
          var antiAttrs = [attrName, null]
          var curPos = 0
          var i = 0
          // 1. compute antiAttrs
          for (; i < this._content.length; i++) {
            let v = this._content[i].val
            if (curPos === from) {
              break
            }
            if (v.constructor === Array) {
              if (v[0] === attrName) {
                antiAttrs[1] = v[1]
              }
            } else if (typeof v === 'string') {
              curPos++
            }
          }
          // 2. Insert attr
          if (antiAttrs[1] !== attrValue) {
            // we'll execute this later
            step2i = i
            step2sel = [attrName, attrValue]
          }

          // 3. update antiAttrs, modify selection
          var deletes = []
          for (; i < this._content.length; i++) {
            let v = this._content[i].val
            if (curPos === to) {
              break
            }
            if (v.constructor === Array) {
              if (v[0] === attrName) {
                antiAttrs[1] = v[1]
                deletes.push(i)
              }
            } else if (typeof v === 'string') {
              curPos++
            }
          }
          // actually delete the found selections
          // also.. we have to delete from right to left (so that the positions dont change)
          for (var j = deletes.length - 1; j >= 0; j--) {
            var del = deletes[j]
            super.delete(del, 1)
            // update i, rel. to
            if (del < i) {
              i--
            }
            if (del < step2i) {
              step2i--
            }
          }
          // 4. Update selection to match antiAttrs
          // never insert, if not necessary
          //  1. when it is the last position ~ i < _content.length)
          //  2. when a similar attrName already exists between i and the next character
          if (antiAttrs[1] !== attrValue && i < this._content.length) { // check 1.
            var performStep4 = true
            var v
            for (j = i; j < this._content.length; j++) {
              v = this._content[j].val
              if (v.constructor !== Array) {
                break
              }
              if (v[0] === attrName) {
                performStep4 = false // check 2.
                if (v[1] === attrValue) {
                  super.delete(j, 1)
                }
                break
              }
            }
            if (performStep4) {
              var sel = [attrName, antiAttrs[1]]
              super.insert(i, [sel])
            }
          }
          if (step2i != null) {
            super.insert(step2i, [step2sel])
            // if there are some selections to the left of step2sel, delete them if possible
            // * have same attribute name
            // * no insert between step2sel and selection
            for (j = step2i - 1; j >= 0; j--) {
              v = this._content[j].val
              if (v.constructor !== Array) {
                break
              }
              if (v[0] === attrName) {
                super.delete(j, 1)
              }
            }
          }
        }
      }
      bind () {
        this.bindQuill.apply(this, arguments)
      }
      unbindQuill (quill) {
        var i = this.instances.findIndex(function (binding) {
          return binding.editor === quill
        })
        if (i >= 0) {
          var binding = this.instances[i]
          this.unobserve(binding.yCallback)
          binding.editor.off('text-change', binding.quillCallback)
          this.instances.splice(i, 1)
        }
      }
      bindQuill (quill) {
        var self = this

        // this function makes sure that either the
        // quill event is executed, or the yjs observer is executed
        var token = true
        function mutualExcluse (f) {
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              token = true
              throw new Error(e)
            }
            token = true
          }
        }

        quill.setContents(this.toOTOps())

        function quillCallback (delta) {
          mutualExcluse(function () {
            var pos = 0
            var name // helper variable
            for (var i = 0; i < delta.ops.length; i++) {
              var op = delta.ops[i]
              if (op.insert != null) {
                var attrs = self.insert(pos, op.insert)
                // create new selection
                for (name in op.attributes) {
                  if (op.attributes[name] !== attrs[name]) {
                    self.select(pos, pos + op.insert.length, name, op.attributes[name])
                  }
                }
                // not-existence of an attribute in op.attributes denotes
                // that we have to unselect (set to null)
                for (name in attrs) {
                  if (op.attributes == null || attrs[name] !== op.attributes[name]) {
                    self.select(pos, pos + op.insert.length, name, null)
                  }
                }
                pos += op.insert.length
              }
              if (op.delete != null) {
                self.delete(pos, op.delete)
              }
              if (op.retain != null) {
                var afterRetain = pos + op.retain
                if (afterRetain > self.length) {
                  let additionalContent = quill.getText(self.length)
                  quill.insertText(self.length, additionalContent)
                  // quill.deleteText(self.length + additionalContent.length, quill.getLength())
                  for (name in op.attributes) {
                    quill.formatText(self.length + additionalContent.length, self.length + additionalContent.length * 2, name, null)
                    // quill.deleteText(self.length, self.length + op.retain)
                  }
                  self.insert(self.length, additionalContent)
                  // op.attributes = null
                }
                for (name in op.attributes) {
                  self.select(pos, pos + op.retain, name, op.attributes[name])
                  quill.formatText(pos, pos + op.retain, name, op.attributes[name])
                }
                pos = afterRetain
              }
            }
          })
        }
        quill.on('text-change', quillCallback)

        function yCallback (events) {
          mutualExcluse(function () {
            var v // helper variable
            var curSel // helper variable (current selection)
            for (var i = 0; i < events.length; i++) {
              var event = events[i]
              if (event.type === 'insert') {
                if (typeof event.value === 'string') {
                  var position = 0
                  var insertSel = {}
                  for (var l = event.index - 1; l >= 0; l--) {
                    v = self._content[l].val
                    if (typeof v === 'string') {
                      position++
                    } else if (v.constructor === Array && typeof insertSel[v[0]] === 'undefined') {
                      insertSel[v[0]] = v[1]
                    }
                  }
                  quill.insertText(position, event.value, insertSel)
                } else if (event.value.constructor === Array) {
                  // a new selection is created
                  // find left selection that matches newSel[0]
                  curSel = null
                  var newSel = event.value
                  // denotes the start position of the selection
                  // (without the selection objects)
                  var selectionStart = 0
                  for (var j = event.index - 1; j >= 0; j--) {
                    v = self._content[j].val
                    if (v.constructor === Array) {
                      // check if v matches newSel
                      if (newSel[0] === v[0]) {
                        // found a selection
                        // update curSel and go to next step
                        curSel = v[1]
                        break
                      }
                    } else if (typeof v === 'string') {
                      selectionStart++
                    }
                  }
                  // make sure to decrement j, so we correctly compute selectionStart
                  for (; j >= 0; j--) {
                    v = self._content[j].val
                    if (typeof v === 'string') {
                      selectionStart++
                    }
                  }
                  // either a selection was found {then curSel was updated}, or not (then curSel = null)
                  if (newSel[1] === curSel) {
                    // both are the same. not necessary to do anything
                    return
                  }
                  // now find out the range over which newSel has to be created
                  var selectionEnd = selectionStart
                  for (var k = event.index + 1; k < self._content.length; k++) {
                    v = self._content[k].val
                    if (v.constructor === Array) {
                      if (v[0] === newSel[0]) {
                        // found another selection with same attr name
                        break
                      }
                    } else if (typeof v === 'string') {
                      selectionEnd++
                    }
                  }
                  // create a selection from selectionStart to selectionEnd
                  if (selectionStart !== selectionEnd) {
                    quill.formatText(selectionStart, selectionEnd, newSel[0], newSel[1])
                  }
                }
              } else if (event.type === 'delete') {
                if (typeof event.value === 'string') { // TODO: see button. add  || `event.length > 1`
                  // only if these conditions are true, we have to actually check if we have to delete sth.
                  // Then we have to check if between pos and pos + event.length are selections:
                  // delete till pos + (event.length - number of selections)
                  var pos = 0
                  for (var u = 0; u < event.index; u++) {
                    v = self._content[u].val
                    if (typeof v === 'string') {
                      pos++
                    }
                  }
                  var delLength = event.length
                  /* TODO!!
                  they do not exist anymore.. so i can't query. you have to query over event.value(s) - but that not yet implemented
                  for (; i < event.index + event.length; i++) {
                    if (self._content[i].val.constructor === Array) {
                      delLength--
                    }
                  }*/
                  quill.deleteText(pos, pos + delLength)
                } else if (event.value.constructor === Array) {
                  curSel = null
                  var from = 0
                  var x
                  for (x = event.index - 1; x >= 0; x--) {
                    v = self._content[x].val
                    if (v.constructor === Array) {
                      if (v[0] === event.value[0]) {
                        curSel = v[1]
                        break
                      }
                    } else if (typeof v === 'string') {
                      from++
                    }
                  }
                  for (; x >= 0; x--) {
                    v = self._content[x].val
                    if (typeof v === 'string') {
                      from++
                    }
                  }
                  var to = from
                  for (x = event.index; x < self._content.length; x++) {
                    v = self._content[x].val
                    if (v.constructor === Array) {
                      if (v[0] === event.value[0]) {
                        break
                      }
                    } else if (typeof v === 'string') {
                      to++
                    }
                  }
                  if (curSel !== event.value[1] && from !== to) {
                    quill.formatText(from, to, event.value[0], curSel)
                  }
                }
              }
            }
            quill.editor.checkUpdate()
          })
        }
        this.observe(yCallback)
        this.instances.push({
          editor: quill,
          yCallback: yCallback,
          quillCallback: quillCallback
        })
      }
      * _changed () {
        this.instances.forEach(function (instance) {
          instance.editor.editor.checkUpdate()
        })
        yield* Y.Array.class.prototype._changed.apply(this, arguments)
      }
    }
    Y.extend('Richtext', new Y.utils.CustomType({
      name: 'Richtext',
      class: YRichtext,
      struct: 'List',
      initType: function * YTextInitializer (os, model) {
        var _content = yield* Y.Struct.List.map.call(this, model, function (c) {
          return {
            id: JSON.stringify(c.id),
            val: c.content
          }
        })
        return new YRichtext(os, model.id, _content)
      }
    }))
  })
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}]},{},[1])

