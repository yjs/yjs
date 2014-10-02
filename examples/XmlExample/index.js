
/**
 ## PeerJs + JSON Example
 Here, I will give a short overview on how to enable collaborative json with the
 [PeerJs](http://peerjs.com/) Connector and the Json Framework. Open
 [index.html](http://dadamonad.github.io/Yatta/examples/PeerJs-Json/index.html) in your Browser and
 use the console to explore Yatta!

 [PeerJs](http://peerjs.com) is a Framework that enables you to connect to other peers. You just need the
 user-id of the peer (browser/client). And then you can connect to it.

 First you have to include the following libraries in your html file:
 ```
<script src="http://cdn.peerjs.com/0.3/peer.js"></script>
<script src="../../build/browser/Frameworks/XmlFramework.js"></script>
<script src="../../build/browser/Connectors/PeerJsConnector.js"></script>
<script src="./index.js"></script>
 ```
### Create Connector

The PeerJs Framework requires an API key, or you need to set up your own PeerJs server.
Get an API key from the [Website](http://peerjs.com/peerserver).
The first parameter of `createPeerJsConnector` is forwarded as the options object in PeerJs.
Therefore, you may also specify the server/port here, if you have set up your own server.
 */
var yatta, yattaHandler;
Y.createPeerJsConnector({key: 'h7nlefbgavh1tt9'}, function(Connector, user_id){

  yatta = new Y.XmlFramework(user_id, Connector);

   /**
      Get the url of this frame. If it has a url-encoded parameter
      we will connect to the foreign peer.
    */
    var url = window.location.href;
    var peer_id = location.search
    var url = url.substring(0,-peer_id.length);
    peer_id = peer_id.substring(1);

    /**
      Set the shareable link.
      */
    document.getElementById("peer_link").setAttribute("href",url+"?"+user_id);

    /**
      Connect to other peer.
      */
    if (peer_id.length > 0){
      yatta.connector.connectToPeer(peer_id);
    }
    yatta.connector.onNewConnection(function(){
      $("#collaborative").replaceWith(yatta.val())
    });

    yatta.val($("#collaborative")[0])
    console.log(yatta.getUserId());
});
