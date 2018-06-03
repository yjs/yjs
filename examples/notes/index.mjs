
import IndexedDBPersistence from '../../src/Persistences/IndexeddbPersistence.mjs'
import YWebsocketsConnector from '../../src/Connectors/WebsocketsConnector/WebsocketsConnector.mjs'
import Y from '../../src/Y.mjs'
import YXmlFragment from '../../src/Types/YXml/YXmlFragment.mjs'

const yCollection = new YCollection(new YWebsocketsConnector(), new IndexedDBPersistence())

const y = yCollection.getDocument('my-notes')





persistence.addConnector(persistence)

const y = new Y()
await persistence.persistY(y)


connector.connectY('html-editor', y)
persistence.connectY('html-editor', y)




window.connector = connector

window.onload = function () {
  window.domBinding = new DomBinding(window.yXmlType, document.body, { scrollingElement: document.scrollingElement })
}

window.y = y
window.yXmlType = y.define('xml', YXmlFragment)
window.undoManager = new UndoManager(window.yXmlType, {
  captureTimeout: 500
})

document.onkeydown = function interceptUndoRedo (e) {
  if (e.keyCode === 90 && (e.metaKey || e.ctrlKey)) {
    if (!e.shiftKey) {
      window.undoManager.undo()
    } else {
      window.undoManager.redo()
    }
    e.preventDefault()
  }
}
