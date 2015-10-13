/* global Y, SimpleWebRTC */
'use strict'

class WebRTC extends Y.AbstractConnector {
  constructor (y, options) {
    if (options === undefined) {
      throw new Error('Options must not be undefined!')
    }
    if (options.room == null) {
      throw new Error('You must define a room name!')
    }
    options.role = 'slave'
    super(y, options)
    this.webrtcOptions = {
      url: options.url || 'https://yatta.ninja:8888',
      room: options.room
    }
    var swr = new SimpleWebRTC(this.webrtcOptions)
    this.swr = swr
    var self = this
    swr.once('connectionReady', function (userId) {
      // SimpleWebRTC (swr) is initialized
      swr.joinRoom(self.webrtcOptions.room)

      swr.once('joinedRoom', function () {
        self.setUserId(userId)
        /*
        var i
        // notify the connector class about all the users that already
        // joined the session
        for(i in self.swr.webrtc.peers){
          self.userJoined(self.swr.webrtc.peers[i].id, "master")
        }*/
        swr.on('channelMessage', function (peer, room_, message) {
          // The client received a message
          // Check if the connector is already initialized,
          // only then forward the message to the connector class
          if (message.type != null) {
            self.receiveMessage(peer.id, message.payload)
          }
        })
      })

      swr.on('createdPeer', function (peer) {
        // a new peer/client joined the session.
        // Notify the connector class, if the connector
        // is already initialized
        self.userJoined(peer.id, 'master')
      })

      swr.on('peerStreamRemoved', function (peer) {
        // a client left the session.
        // Notify the connector class, if the connector
        // is already initialized
        self.userLeft(peer.id)
      })
    })
  }
  disconnect () {
    this.swr.leaveRoom()
    super.disconnect()
  }
  reconnect () {
    this.swr.joinRoom(this.webrtcOptions.room)
    super.reconnect()
  }
  send (uid, message) {
    var self = this
    // we have to make sure that the message is sent under all circumstances
    var send = function () {
      // check if the clients still exists
      var peer = self.swr.webrtc.getPeers(uid)[0]
      var success
      if (peer) {
        // success is true, if the message is successfully sent
        success = peer.sendDirectly('simplewebrtc', 'yjs', message)
      }
      if (!success) {
        // resend the message if it didn't work
        setTimeout(send, 500)
      }
    }
    // try to send the message
    send()
  }
  broadcast (message) {
    this.swr.sendDirectlyToAll('simplewebrtc', 'yjs', message)
  }
  isDisconnected () {
    return false
  }
}

Y.WebRTC = WebRTC
