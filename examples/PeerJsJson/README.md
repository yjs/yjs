## IWC + JSON Example
Here, I will give a short overview on how to use the IwcJson Framework in Role-SDK widgets.
First you have to include the following libraries in your widget file:
```
<script src="http://open-app.googlecode.com/files/openapp.js"></script>
<script src="http://dbis.rwth-aachen.de/gadgets/iwc/lib/iwc.js"></script>
<script src="http://dbis.rwth-aachen.de/~jahns/role-widgets/widgetbundles/libraries/DUIClient.js"></script>
<script src="../../build/browser/Frameworks/JsonYatta.min.js"></script>
<script src="../../build/browser/Connectors/PeerJsConnector.min.js"></script>
<script src="./index.js"></script>
```
A working widget implementation is [IwcJson.xml](./IwcJson.xml) and the js-file is [index.js](./index.js)


```js
var yatta;

function init(){
    Y.createPeerJsConnector(function(Connector, user_id){
```


yatta is the shared json object. If you change something on this object,
it will be instantly shared with all the other collaborators.


```js
      yatta = new Y.JsonYatta(user_id, Connector);

      var url = window.location.href;
      var peer_id = location.search
      var url = url.substring(0,-peer_id.length);
      peer_id = peer_id.substring(1);
      document.getElementById("peer_link").setAttribute("href",url+"?"+user_id);

      var textbox = document.getElementById("textfield");
      if (peer_id.length > 0) {
        yatta.connector.connectToPeer(peer_id);
        function f() {
          if (yatta.val('x') == null) {
            setTimeout(f, 500);
          } else {
            yatta.val('x').bind(textbox);
          }
        }
        f();
      } else {
        yatta.val('x', "");
        yatta.val('x').bind(textbox);
      }
    });
}
window.onload = init
```
