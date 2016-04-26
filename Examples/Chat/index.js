/* @flow */
/* global Y */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'chat-example'
  },
  sourceDir: '/bower_components',
  share: {
    chat: 'Array'
  }
}).then(function (y) {
  window.yChat = y
  // This functions inserts a message at the specified position in the DOM
  function appendMessage(message, position) { 
    var p = document.createElement('p')
    var uname = document.createElement('span')
    uname.appendChild(document.createTextNode(message.username + ": "))
    p.appendChild(uname)
    p.appendChild(document.createTextNode(message.message))
    document.querySelector('#chat').insertBefore(p, chat.children[position] || null)
  }
  // This function makes sure that only 7 messages exist in the chat history.
  // The rest is deleted
  function cleanupChat () {
    var len
    while ((len = y.share.chat.length) > 7) {
      y.share.chat.delete(0)        
    }
  }
  // Insert the initial content
  y.share.chat.toArray().forEach(appendMessage)
  cleanupChat()
  
  // whenever content changes, make sure to reflect the changes in the DOM
  y.share.chat.observe(function (event) {
    if (event.type === 'insert') {
      for (var i = 0; i < event.length; i++) {
        appendMessage(event.values[i], event.index + i)
      }
    } else if (event.type === 'delete') {
      for (var i = 0; i < event.length; i++) {
        chat.children[event.index].remove()
      }
    }
    // concurrent insertions may result in a history > 7, so cleanup here
    cleanupChat()
  })
  document.querySelector('#chatform').onsubmit = function (event) {
    // the form is submitted
    var message = {
      username: this.querySelector("[name=username]").value,
      message: this.querySelector("[name=message]").value
    }
    if (message.username.length > 0 && message.message.length > 0) {
      if (y.share.chat.length > 6) {
        // If we are goint to insert the 8th element, make sure to delete first.
        y.share.chat.delete(0)
      }
      // Here we insert a message in the shared chat type.
      // This will call the observe function (see line 40)
      // and reflect the change in the DOM
      y.share.chat.push([message])
      this.querySelector("[name=message]").value = ""
    }
    // Do not send this form!
    event.preventDefault()
    return false
  }
})