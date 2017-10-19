/* global getSelection, MutationObserver */

import diff from 'fast-diff'
import YText from '../YText.js'
import { getAnchorViewPosition, fixScrollPosition, getBoundingClientRect } from './utils.js'

function fixPosition (event, pos) {
  if (event.index <= pos) {
    if (event.type === 'delete') {
      return pos - Math.min(pos - event.index, event.length)
    } else {
      return pos + 1
    }
  } else {
    return pos
  }
}

export default class YXmlText extends YText {
  constructor (arg1) {
    let dom = null
    let initialText = null
    if (arg1 != null && arg1.nodeType === document.TEXT_NODE) {
      dom = arg1
      initialText = dom.nodeValue
    }
    super(initialText)
    this._dom = null
    this._domObserver = null
    this._domObserverListener = null
    this._scrollElement = null
    if (dom !== null) {
      this._setDom(arg1)
    }
    var token = true
    this._mutualExclude = f => {
      if (token) {
        token = false
        try {
          f()
        } catch (e) {
          console.error(e)
        }
        this._domObserver.takeRecords()
        token = true
      }
    }
    this.observe(event => {
      if (this._dom != null) {
        const dom = this._dom
        this._mutualExclude(() => {
          let selection = null
          let shouldUpdateSelection = false
          let anchorNode = null
          let anchorOffset = null
          let focusNode = null
          let focusOffset = null
          if (typeof getSelection !== 'undefined') {
            selection = getSelection()
            if (selection.anchorNode === dom) {
              anchorNode = selection.anchorNode
              anchorOffset = fixPosition(event, selection.anchorOffset)
              shouldUpdateSelection = true
            }
            if (selection.focusNode === dom) {
              focusNode = selection.focusNode
              focusOffset = fixPosition(event, selection.focusOffset)
              shouldUpdateSelection = true
            }
          }
          let anchorViewPosition = getAnchorViewPosition(this._scrollElement)
          let anchorViewFix
          if (anchorViewPosition !== null && (anchorViewPosition.anchor !== null || getBoundingClientRect(this._dom).top <= 0)) {
            anchorViewFix = anchorViewPosition
          } else {
            anchorViewFix = null
          }
          dom.nodeValue = this.toString()
          fixScrollPosition(this._scrollElement, anchorViewFix)

          if (shouldUpdateSelection) {
            selection.setBaseAndExtent(
              anchorNode || selection.anchorNode,
              anchorOffset || selection.anchorOffset,
              focusNode || selection.focusNode,
              focusOffset || selection.focusOffset
            )
          }
        })
      }
    })
  }
  setDomFilter () {}
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement
  }
  _setDom (dom) {
    if (this._dom != null) {
      this._unbindFromDom()
    }
    if (dom.__yxml != null) {
      dom.__yxml._unbindFromDom()
    }
    // set marker
    this._dom = dom
    dom.__yxml = this
    if (typeof MutationObserver === 'undefined') {
      return
    }
    this._domObserverListener = () => {
      this._mutualExclude(() => {
        var diffs = diff(this.toString(), dom.nodeValue)
        var pos = 0
        for (var i = 0; i < diffs.length; i++) {
          var d = diffs[i]
          if (d[0] === 0) { // EQUAL
            pos += d[1].length
          } else if (d[0] === -1) { // DELETE
            this.delete(pos, d[1].length)
          } else { // INSERT
            this.insert(pos, d[1])
            pos += d[1].length
          }
        }
      })
    }
    this._domObserver = new MutationObserver(this._domObserverListener)
    this._domObserver.observe(this._dom, { characterData: true })
  }
  getDom () {
    if (this._dom == null) {
      const dom = document.createTextNode(this.toString())
      this._setDom(dom)
      return dom
    }
    return this._dom
  }
  _beforeChange () {
    if (this._domObserver != null && this._y !== null) { // TODO: do I need th y condition
      this._domObserverListener(this._domObserver.takeRecords())
    }
  }
  _delete (y, createDelete) {
    this._unbindFromDom()
    super._delete(y, createDelete)
  }
  _unbindFromDom () {
    if (this._domObserver != null) {
      this._domObserver.disconnect()
      this._domObserver = null
    }
    if (this._dom != null) {
      this._dom.__yxml = null
      this._dom = null
    }
  }
}
