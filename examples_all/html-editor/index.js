
import YWebsocketsConnector from '../../src/Connectors/WebsocketsConnector/WebsocketsConnector.js'
import Y from '../../src/Y.js'
import DomBinding from '../../bindings/DomBinding/DomBinding.js'
import UndoManager from '../../src/Util/UndoManager.js'
import YXmlFragment from '../../src/Types/YXml/YXmlFragment.js'
import YXmlText from '../../src/Types/YXml/YXmlText.js'
import YXmlElement from '../../src/Types/YXml/YXmlElement.js'
import YIndexdDBPersistence from '../../src/Persistences/IndexedDBPersistence.js'

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
      window.y = y
    }

    window.y = y
    window.yXmlType = y.define('xml', YXmlFragment)

    domBinding = new DomBinding(window.yXmlType, document.querySelector('#content'), { scrollingElement: document.scrollingElement })
  }
}
window.setRoomName = setRoomName

window.createRooms = function (i = 0) {
  setInterval(function () {
    setRoomName(i + '')
    i++
    const nodes = []
    for (let j = 0; j < 100; j++) {
      const node = new YXmlElement('p')
      node.insert(0, [new YXmlText(`This is the ${i}th paragraph of room ${i}`)])
      nodes.push(node)
    }
    y.share.xml.insert(0, nodes)
  }, 100)
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
