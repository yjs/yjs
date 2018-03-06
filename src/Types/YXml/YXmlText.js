import YText from '../YText/YText.js'

/**
 * Represents text in a Dom Element. In the future this type will also handle
 * simple formatting information like bold and italic.
 *
 * @param {String} arg1 Initial value.
 */
export default class YXmlText extends YText {
  constructor (arg1) {
    let dom = null
    let initialText = null
    if (arg1 != null) {
      if (arg1.nodeType != null && arg1.nodeType === arg1.TEXT_NODE) {
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
    /*
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
    */
  }
  setDomFilter () {}
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement
  }

  /**
   * @private
   * Set Dom element / Text Node that represents the same content as this
   * YXmlElement.
   *
   * @param {Element} dom The Dom Element / Text Node that is set to be
   *                      equivalent to this Type.
   */
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
  }

  /**
   * Returns the Dom representation of this YXmlText.
   */
  getDom (_document) {
    _document = _document || document
    if (this._dom === null) {
      const dom = _document.createTextNode(this.toString())
      this._setDom(dom)
      return dom
    }
    return this._dom
  }

  /**
   * @private
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   */
  _delete (y, createDelete) {
    this._unbindFromDom()
    super._delete(y, createDelete)
  }

  /**
   * @private
   * Unbind this YXmlText from the Dom.
   */
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
