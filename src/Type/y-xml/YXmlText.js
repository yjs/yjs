/* global MutationObserver */

import diff from 'fast-diff'
import YText from '../YText.js'
import { getAnchorViewPosition, fixScrollPosition, getBoundingClientRect } from './utils.js'
import { beforeTransactionSelectionFixer, afterTransactionSelectionFixer } from './selection.js'

export default class YXmlText extends YText {
  constructor (arg1) {
    let dom = null
    let initialText = null
    if (arg1 != null) {
      if (arg1.nodeType === document.TEXT_NODE) {
        dom = arg1
        initialText = dom.nodeValue
      } else if (typeof arg1 === 'string') {
        initialText = arg1
      }
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
          let anchorViewPosition = getAnchorViewPosition(this._scrollElement)
          let anchorViewFix
          if (anchorViewPosition !== null && (anchorViewPosition.anchor !== null || getBoundingClientRect(this._dom).top <= 0)) {
            anchorViewFix = anchorViewPosition
          } else {
            anchorViewFix = null
          }
          dom.nodeValue = this.toString()
          fixScrollPosition(this._scrollElement, anchorViewFix)
        })
      }
    })
  }
  _integrate (y) {
    super._integrate(y)
    y.on('beforeTransaction', beforeTransactionSelectionFixer)
    y.on('afterTransaction', afterTransactionSelectionFixer)
  }
  setDomFilter () {}
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement
  }
  _setDom (dom) {
    if (this._dom != null) {
      this._unbindFromDom()
    }
    if (dom._yxml != null) {
      dom._yxml._unbindFromDom()
    }
    // set marker
    this._dom = dom
    dom._yxml = this
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
      this._dom._yxml = null
      this._dom = null
    }
  }
}
