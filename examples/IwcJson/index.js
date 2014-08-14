
/**
 ## IWC + JSON Example
 Here, I will give a short overview on how to use the IwcJson Framework in Role-SDK widgets.
 First you have to include the following libraries in your widget file:
 ```
<script src="http://open-app.googlecode.com/files/openapp.js"></script>
<script src="http://dbis.rwth-aachen.de/gadgets/iwc/lib/iwc.js"></script>
<script src="http://dbis.rwth-aachen.de/~jahns/role-widgets/widgetbundles/libraries/DUIClient.js"></script>
<script src="../../build/browser/Frameworks/JsonYatta.min.js"></script>
<script src="../../build/browser/Connectors/IwcConnector.min.js"></script>
<script src="./index.js"></script>
 ```
A working widget implementation is [IwcJson.xml](./IwcJson.xml) and the js-file is [index.js](./index.js)
 */
function init(){
    createIwcConnector(function(Connector, user_id){
      /**
       yatta is the shared json object. If you change something on this object,
       it will be instantly shared with all the other collaborators.
      */
      yatta = new JsonYatta(user_id, Connector);

      /**
       Add a integer-property like this
      */
      yatta.val('x', 7);

      /**
       Get the value of property x like this
      */
      console.log(yatta.val('x') === 7); // true

      /**
       A string property can be either mutable or immutable.
      */
      yatta.val('mutable_string', "text", "mutable");
      yatta.val('immutable_string', "text", "immutable");

      console.log(yatta.val('immutable_string') === "text"); // true
      yatta.val('mutable_string').insertText(2,"XXX"); // position, string
      yatta.val('mutable_string').deleteText(0,1); // position, deletion length
      console.log(yatta.val('mutable_string').val() === "eXXXxt"); // true



    })
}
window.onload = init
