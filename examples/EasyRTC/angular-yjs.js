'use strict';

angular.module('yjs', ['op.live-conference'])
  .factory('YjsConnectorFactory', ['$log', function($log) {
    function EasyRTCConnector(webrtc) {
      var connector = this;
      connector.webrtc = webrtc;
      this.connected_peers = [];
      var add_missing_peers = function() {
        if (connector.is_initialized) {
          var peer = connector.connected_peers.pop();
          while (peer !== undefined) {
            connector.userJoined(peer, 'slave');
            peer = connector.connected_peers.pop();
          }
        }
      };
      var when_bound_to_y = function() {
        connector.init({
          role: 'slave',
          syncMethod: 'syncAll',
          user_id: webrtc.myEasyrtcid()
        });
        connector.connected_peers = webrtc.getOpenedDataChannels();
        add_missing_peers();
      };

      webrtc.connection().then(function() {
        if (connector.is_bound_to_y) {
          when_bound_to_y();
        } else {
          connector.on_bound_to_y = when_bound_to_y();
        }
      }, function(errorCode, message) {
        $log.error('Error while getting connection to server.', errorCode, message);
      });

      webrtc.addDataChannelOpenListener(function(peerId) {
        if (connector.is_initialized) {
          connector.connected_peers.push(peerId);
          add_missing_peers();
        }
      });

      webrtc.addPeerListener(function(id, msgType, msgData) {
        if (connector.is_initialized) {
          connector.receiveMessage(id, JSON.parse(msgData));
        }
      }, 'yjs');

      webrtc.addDataChannelCloseListener(function(peerId) {
        var index = connector.connected_peers.indexOf(peerId);
        if (index > -1) {
          connector.connected_peers.splice(index, 1);
        }
        if (connector.is_initialized) {
          connector.userLeft(peerId);
        }
      });
    }

    EasyRTCConnector.prototype.send = function(user_id, message) {
      this.webrtc.sendData(user_id, 'yjs', message);
    };
    EasyRTCConnector.prototype.broadcast = function(message) {
      this.webrtc.broadcastData('yjs', JSON.stringify(message));
    };
    return EasyRTCConnector;
  }])
  .service('yjsService', ['easyRTCService', 'YjsConnectorFactory', '$log', function(easyRTCService, YjsConnectorFactory, $log) {
    var connector = new YjsConnectorFactory(easyRTCService);
    var y = new window.Y(connector);
    $log.info('Created yjs instance', y, connector);
    return function() {
      return {
        y: y,
        connector: connector
      };
    };
  }]);
