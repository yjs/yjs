
import YWebsocketsConnector from '../../src/Connectors/WebsocketsConnector/WebsocketsConnector.mjs'
import Y from '../../src/Y.mjs'
import DomBinding from '../../src/Bindings/DomBinding/DomBinding.mjs'
import UndoManager from '../../src/Util/UndoManager.mjs'
import YXmlFragment from '../../src/Types/YXml/YXmlFragment.mjs'
import YIndexdDBPersistence from '../../src/Persistences/IndexedDBPersistence.mjs'

const connector = new YWebsocketsConnector()
const persistence = new YIndexdDBPersistence()

const roomInput = document.querySelector('#room')

let currentRoomName = null
let y = null
let domBinding = null

function setRoomName (roomName) {
  if (currentRoomName !== roomName) {
    console.log(`change room: "${roomName}"`)
    roomInput.value = roomName
    currentRoomName = roomName
    location.hash = '#' + roomName
    if (y !== null) {
      domBinding.destroy()
    }

    const room = connector._rooms.get(roomName)
    if (room !== undefined) {
      y = room.y
    } else {
      y = new Y(roomName, null, null, { gc: true })
      persistence.connectY(roomName, y).then(() => {
        // connect after persisted content was applied to y
        // If we don't wait for persistence, the other peer will send all data, waisting
        // network bandwidth..
        connector.connectY(roomName, y)
      })
    }

    window.y = y
    window.yXmlType = y.define('xml', YXmlFragment)

    domBinding = new DomBinding(window.yXmlType, document.querySelector('#content'), { scrollingElement: document.scrollingElement })
  }
}

connector.syncPersistence(persistence)

window.connector = connector
window.persistence = persistence

window.onload = function () {
  setRoomName((location.hash || '#default').slice(1))
  roomInput.addEventListener('input', e => {
    const roomName = e.target.value
    setRoomName(roomName)
  })
}
