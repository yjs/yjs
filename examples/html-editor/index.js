/* global Y, HTMLElement, customElements, CanvasJS */

window.onload = function () {
  window.yXmlType.bindToDom(document.body)
  let mt = document.createElement('magic-table')
  mt.innerHTML = '<table><tr><th>Amount</th></tr><tr><td>1</td></tr><tr><td>1</td></tr></table>'
  document.body.append(mt)
}

class MagicTable extends HTMLElement {
  constructor () {
    super()
    this.createShadowRoot()
  }
  get _yjsHook () {
    return 'magic-table'
  }
  showTable () {
    this.shadowRoot.innerHTML = ''
    this.shadowRoot.append(document.createElement('content'))
  }
  showDiagram () {
    let dataPoints = []
    this.querySelectorAll('td').forEach(td => {
      let number = Number(td.textContent)
      dataPoints.push({
        x: (dataPoints.length + 1) * 10,
        y: number,
        label: '<magic-table> content'
      })
    })
    this.shadowRoot.innerHTML = ''
    var chart = new CanvasJS.Chart(this.shadowRoot,
      {
        title: {
          text: 'Bar chart'
        },
        data: [
          {
            type: 'bar',

            dataPoints: dataPoints
          }
        ]
      })

    chart.render()

    // this.shadowRoot.innerHTML = '<p>dtrn</p>'
  }
}
customElements.define('magic-table', MagicTable)

Y.XmlHook.addHook('magic-table', {
  fillType: function (dom, type) {
    type.set('table', new Y.XmlElement(dom.querySelector('table')))
  },
  createDom: function (type) {
    const table = type.get('table').getDom()
    const dom = document.createElement('magic-table')
    dom.insertBefore(table, null)
    return dom
  }
})

// initialize a shared object. This function call returns a promise!
let y = new Y({
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234',
    room: 'html-editor-example6'
    // maxBufferLength: 100
  }
})
window.yXml = y
window.yXmlType = y.define('xml', Y.XmlFragment)
window.undoManager = new Y.utils.UndoManager(window.yXmlType, {
  captureTimeout: 500
})

document.onkeydown = function interceptUndoRedo (e) {
  if (e.keyCode === 90 && e.metaKey) {
    if (!e.shiftKey) {
      window.undoManager.undo()
    } else {
      window.undoManager.redo()
    }
    e.preventDefault()
  }
}
