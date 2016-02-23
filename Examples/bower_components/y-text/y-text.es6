(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global Y, Element */
'use strict'

function extend (Y) {
  Y.requestModules(['Array']).then(function () {
    class YText extends Y.Array['class'] {
      constructor (os, _model, _content) {
        super(os, _model, _content)
        this.textfields = []
        this.aceInstances = []
      }
      _destroy () {
        this.unbindAll()
        this.textfields = null
        this.aceInstances = null
        super._destroy()
      }
      toString () {
        return this._content.map(function (c) {
          return c.val
        }).join('')
      }
      insert (pos, content) {
        super.insert(pos, content.split(''))
      }
      unbindAll () {
        for (let i = this.textfields.length - 1; i >= 0; i--) {
          this.unbindTextarea(this.textfields[i].editor)
        }
        for (let i = this.aceInstances.length - 1; i >= 0; i--) {
          this.unbindAce(this.aceInstances[i].editor)
        }
      }
      unbindAce (ace) {
        var i = this.aceInstances.findIndex(function (binding) {
          return binding.editor === ace
        })
        if (i >= 0) {
          var binding = this.aceInstances[i]
          this.unobserve(binding.yCallback)
          binding.editor.off('change', binding.aceCallback)
          this.aceInstances.splice(i, 1)
        }
      }
      bindAce (ace, options) {
        var self = this

        // this function makes sure that either the
        // ace event is executed, or the yjs observer is executed
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
        ace.markers = []
        var disableMarkers = false

        if (typeof options === 'object') {
          if (typeof options.disableMarkers !== 'undefined') {
            disableMarkers = options.disableMarkers
          }
        }

        ace.setValue(this.toString())

        function aceCallback (delta) {
          mutualExcluse(function () {
            var start = 0
            var length = 0

            var aceDocument = ace.getSession().getDocument()
            if (delta.action === 'insert') {
              start = aceDocument.positionToIndex(delta.start, 0)
              self.insert(start, delta.lines.join('\n'))
            } else if (delta.action === 'remove') {
              start = aceDocument.positionToIndex(delta.start, 0)
              length = delta.lines.join('\n').length
              self.delete(start, length)
            }
          })
        }
        ace.on('change', aceCallback)

        if (!disableMarkers) {
          if (this.inteval) {
            clearInterval(this.inteval)
          }
          this.inteval = setInterval(function () {
            var i = 0
            var now = Date.now()
            var timeVisible = 800

            while (i < ace.markers.length) {
              var marker = ace.markers[i]

              if (marker.timestamp + timeVisible < now) {
                ace.getSession().removeMarker(marker.id)
                ace.markers.splice(i, 1)
                i--
              }
              i++
            }
          }, 1000)
        }
        var Range = window.ace.require('ace/range').Range
        function setMarker (start, end, klazz) {
          if (disableMarkers) {
            return
          }
          var offset = 0
          if (start.row === end.row && start.column === end.column) {
            offset = 1
          }
          var range = new Range(start.row, start.column, end.row, end.column + offset)
          var marker = ace.session.addMarker(range, klazz, 'text')
          ace.markers.push({id: marker, timestamp: Date.now()})
        }

        function yCallback (events) {
          var aceDocument = ace.getSession().getDocument()
          mutualExcluse(function () {
            for (var i = 0; i < events.length; i++) {
              var event = events[i]
              if (event.type === 'insert') {
                let start = aceDocument.indexToPosition(event.index, 0)
                let end = aceDocument.indexToPosition(event.index + event.value.length, 0)
                aceDocument.insert(start, event.value)

                setMarker(start, end, 'inserted')
              } else if (event.type === 'delete') {
                let start = aceDocument.indexToPosition(event.index, 0)
                let end = aceDocument.indexToPosition(event.index + event.length, 0)
                var range = new Range(start.row, start.column, end.row, end.column)
                aceDocument.remove(range)

                setMarker(start, end, 'deleted')
              }
            }
          })
        }
        this.observe(yCallback)
        this.aceInstances.push({
          editor: ace,
          yCallback: yCallback,
          aceCallback: aceCallback
        })
      }
      bind () {
        var e = arguments[0]
        if (e instanceof Element) {
          this.bindTextarea.apply(this, arguments)
        } else if (e != null && e.session != null && e.getSession != null && e.setValue != null) {
          this.bindAce.apply(this, arguments)
        } else {
          console.error('Cannot bind, unsupported editor!')
        }
      }
      unbindTextarea (textarea) {
        var i = this.textfields.findIndex(function (binding) {
          return binding.editor === textarea
        })
        if (i >= 0) {
          var binding = this.textfields[i]
          this.unobserve(binding.yCallback)
          var e = binding.editor
          e.onkeydown = null
          e.onkeyup = null
          e.onkeypress = null
          e.onpaste = null
          e.oncut = null
          this.textfields.splice(i, 1)
        }
      }
      bindTextarea (textfield, domRoot) {
        domRoot = domRoot || window; // eslint-disable-line
        if (domRoot.getSelection == null) {
          domRoot = window; // eslint-disable-line
        }

        // don't duplicate!
        for (var t = 0; t < this.textfields.length; t++) {
          if (this.textfields[t].editor === textfield) {
            return
          }
        }
        var creatorToken = false

        var word = this
        textfield.value = this.toString()

        var createRange, writeRange, writeContent
        if (textfield.selectionStart != null && textfield.setSelectionRange != null) {
          createRange = function (fix) {
            var left = textfield.selectionStart
            var right = textfield.selectionEnd
            if (fix != null) {
              left = fix(left)
              right = fix(right)
            }
            return {
              left: left,
              right: right
            }
          }
          writeRange = function (range) {
            writeContent(word.toString())
            textfield.setSelectionRange(range.left, range.right)
          }
          writeContent = function (content) {
            textfield.value = content
          }
        } else {
          createRange = function (fix) {
            var range = {}
            var s = domRoot.getSelection()
            var clength = textfield.textContent.length
            range.left = Math.min(s.anchorOffset, clength)
            range.right = Math.min(s.focusOffset, clength)
            if (fix != null) {
              range.left = fix(range.left)
              range.right = fix(range.right)
            }
            var editedElement = s.focusNode
            if (editedElement === textfield || editedElement === textfield.childNodes[0]) {
              range.isReal = true
            } else {
              range.isReal = false
            }
            return range
          }

          writeRange = function (range) {
            writeContent(word.toString())
            var textnode = textfield.childNodes[0]
            if (range.isReal && textnode != null) {
              if (range.left < 0) {
                range.left = 0
              }
              range.right = Math.max(range.left, range.right)
              if (range.right > textnode.length) {
                range.right = textnode.length
              }
              range.left = Math.min(range.left, range.right)
              var r = document.createRange(); // eslint-disable-line
              r.setStart(textnode, range.left)
              r.setEnd(textnode, range.right)
              var s = window.getSelection(); // eslint-disable-line
              s.removeAllRanges()
              s.addRange(r)
            }
          }
          writeContent = function (content) {
            var contentArray = content.replace(new RegExp('\n', 'g'), ' ').split(' '); // eslint-disable-line
            textfield.innerText = ''
            for (var i = 0; i < contentArray.length; i++) {
              var c = contentArray[i]
              textfield.innerText += c
              if (i !== contentArray.length - 1) {
                textfield.innerHTML += '&nbsp;'
              }
            }
          }
        }
        writeContent(this.toString())

        function yCallback (events) {
          for (var e = 0; e < events.length; e++) {
            var event = events[e]
            if (!creatorToken) {
              var oPos, fix
              if (event.type === 'insert') {
                oPos = event.index
                fix = function (cursor) { // eslint-disable-line
                  if (cursor <= oPos) {
                    return cursor
                  } else {
                    cursor += 1
                    return cursor
                  }
                }
                var r = createRange(fix)
                writeRange(r)
              } else if (event.type === 'delete') {
                oPos = event.index
                fix = function (cursor) { // eslint-disable-line
                  if (cursor < oPos) {
                    return cursor
                  } else {
                    cursor -= 1
                    return cursor
                  }
                }
                r = createRange(fix)
                writeRange(r)
              }
            }
          }
        }
        this.observe(yCallback)
        // consume all text-insert changes.
        textfield.onkeypress = function (event) {
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.onkeypress = null
            return true
          }
          creatorToken = true
          var char
          if (event.keyCode === 13) {
            char = '\n'
          } else if (event.key != null) {
            if (event.charCode === 32) {
              char = ' '
            } else {
              char = event.key
            }
          } else {
            char = window.String.fromCharCode(event.keyCode); // eslint-disable-line
          }
          if (char.length > 1) {
            return true
          } else if (char.length > 0) {
            var r = createRange()
            var pos = Math.min(r.left, r.right, word.length)
            var diff = Math.abs(r.right - r.left)
            word.delete(pos, diff)
            word.insert(pos, char)
            r.left = pos + char.length
            r.right = r.left
            writeRange(r)
          }
          event.preventDefault()
          creatorToken = false
          return false
        }
        textfield.onpaste = function (event) {
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.onpaste = null
            return true
          }
          event.preventDefault()
        }
        textfield.oncut = function (event) {
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.oncut = null
            return true
          }
          event.preventDefault()
        }
        //
        // consume deletes. Note that
        //   chrome: won't consume deletions on keypress event.
        //   keyCode is deprecated. BUT: I don't see another way.
        //     since event.key is not implemented in the current version of chrome.
        //     Every browser supports keyCode. Let's stick with it for now..
        //
        textfield.onkeydown = function (event) {
          creatorToken = true
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.onkeydown = null
            return true
          }
          var r = createRange()
          var pos = Math.min(r.left, r.right, word.toString().length)
          var diff = Math.abs(r.left - r.right)
          if (event.keyCode != null && event.keyCode === 8) { // Backspace
            if (diff > 0) {
              word.delete(pos, diff)
              r.left = pos
              r.right = pos
              writeRange(r)
            } else {
              if (event.ctrlKey != null && event.ctrlKey) {
                var val = word.toString()
                var newPos = pos
                var delLength = 0
                if (pos > 0) {
                  newPos--
                  delLength++
                }
                while (newPos > 0 && val[newPos] !== ' ' && val[newPos] !== '\n') {
                  newPos--
                  delLength++
                }
                word.delete(newPos, pos - newPos)
                r.left = newPos
                r.right = newPos
                writeRange(r)
              } else {
                if (pos > 0) {
                  word.delete(pos - 1, 1)
                  r.left = pos - 1
                  r.right = pos - 1
                  writeRange(r)
                }
              }
            }
            event.preventDefault()
            creatorToken = false
            return false
          } else if (event.keyCode != null && event.keyCode === 46) { // Delete
            if (diff > 0) {
              word.delete(pos, diff)
              r.left = pos
              r.right = pos
              writeRange(r)
            } else {
              word.delete(pos, 1)
              r.left = pos
              r.right = pos
              writeRange(r)
            }
            event.preventDefault()
            creatorToken = false
            return false
          } else {
            creatorToken = false
            return true
          }
        }
        this.textfields.push({
          editor: textfield,
          yCallback: yCallback
        })
      }
    }
    Y.extend('Text', new Y.utils.CustomType({
      name: 'Text',
      class: YText,
      struct: 'List',
      initType: function * YTextInitializer (os, model) {
        var _content = yield* Y.Struct.List.map.call(this, model, function (c) {
          return {
            id: JSON.stringify(c.id),
            val: c.content
          }
        })
        return new YText(os, model.id, _content)
      }
    }))
  })
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}]},{},[1])

