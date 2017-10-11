/* global Y */

// initialize a shared object. This function call returns a promise!
var y = new Y({
  connector: {
    name: 'websockets-client',
    room: 'chat-example'
  }
})

window.yChat = y

let chatprotocol = y.get('chatprotocol', Y.Array)

let chatcontainer = document.querySelector('#chat')

// This functions inserts a message at the specified position in the DOM
function appendMessage (message, position) {
  var p = document.createElement('p')
  var uname = document.createElement('span')
  uname.appendChild(document.createTextNode(message.username + ': '))
  p.appendChild(uname)
  p.appendChild(document.createTextNode(message.message))
  chatcontainer.insertBefore(p, chatcontainer.children[position] || null)
}
// This function makes sure that only 7 messages exist in the chat history.
// The rest is deleted
function cleanupChat () {
  if (chatprotocol.length > 7) {
    chatprotocol.delete(0, chatprotocol.length - 7)
  }
}
// Insert the initial content
chatprotocol.toArray().forEach(appendMessage)
cleanupChat()

// whenever content changes, make sure to reflect the changes in the DOM
chatprotocol.observe(function (event) {
  if (event.type === 'insert') {
    for (let i = 0; i < event.length; i++) {
      appendMessage(event.values[i], event.index + i)
    }
  } else if (event.type === 'delete') {
    for (let i = 0; i < event.length; i++) {
      chatcontainer.children[event.index].remove()
    }
  }
  // concurrent insertions may result in a history > 7, so cleanup here
  cleanupChat()
})
document.querySelector('#chatform').onsubmit = function (event) {
  // the form is submitted
  var message = {
    username: this.querySelector('[name=username]').value,
    message: this.querySelector('[name=message]').value
  }
  if (message.username.length > 0 && message.message.length > 0) {
    if (chatprotocol.length > 6) {
      // If we are goint to insert the 8th element, make sure to delete first.
      chatprotocol.delete(0)
    }
    // Here we insert a message in the shared chat type.
    // This will call the observe function (see line 40)
    // and reflect the change in the DOM
    chatprotocol.push([message])
    this.querySelector('[name=message]').value = ''
  }
  // Do not send this form!
  event.preventDefault()
  return false
}
