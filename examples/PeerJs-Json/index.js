
/**
 ## PeerJs + JSON Example
 Here, I will give a short overview on how to enable collaborative json with the
 [PeerJs](http://peerjs.com/) Connector and the JsonYatta Framework. Open
 [index.html](http://dadamonad.github.io/Yatta/examples/PeerJs-Json/index.html) in your Browser and
 use the console to explore Yatta!

 [PeerJs](http://peerjs.com) is a Framework that enables you to connect to other peers. You just need the
 user-id of the peer (browser/client). And then you can connect to it.

 First you have to include the following libraries in your html file:
 ```
<script src="http://cdn.peerjs.com/0.3/peer.js"></script>
<script src="../../build/browser/Frameworks/JsonFramework.js"></script>
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

/**
You can also specify your own user_id with peerjs.
But you have to make sure that no other client associated to your API-key has the same user_id.
*/
// Y.createPeerJsConnector("unique_id", {key: 'h7nlefbgavh1tt9'}, function(Connector, user_id){


  /**
    ### Yatta
    yatta is the shared json object. If you change something on this object,
    it will be instantly shared with all the other collaborators.
  */
  yatta = new Y.JsonFramework(user_id, Connector);

  /**
    Next, you may want to connect to another peer. Therefore you have to receive his
    user_id. If the other peer is connected to other peers, the PeerJsConnector
    will automatically connect to them too.

    Transmitting the user_id is your job.
    See [TextEditing](../../examples/TextEditing/) for a nice example
    on how to do that with urls.
  */
    console.log("This is your user-id: "+user_id);

  // yatta.connector.connectToPeer(peer_user_id);

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

  /**
   Did you recognize that we have to use anoter `.val()` for mutable strings?
   Thats because yatta.val('mutable_string') is of type WordType.
   Since we implemented `toString` in this for WordType's, you can use it like a string:
   */
  console.log(""+yatta.val("mutable_string") === "eXXXxt") // true, concatenating it with a string will implicitly invoke toString()

  /**
    You can omit the mutable - parameter. In that case the default will be used.
    Initially the default is 'mutable'. You can set it like this:
    */
  yatta.setMutableDefault('mutable');
  // or
  yatta.setMutableDefault('immutable');

  yatta.val('new_string', "string");
  console.log(yatta.val('new_string') === "string"); // true

  /**
    yatta is chainable:
    */
  yatta.val('a', 4).val('b',5);
  console.log(yatta.val('a') === 4); // true
  console.log(yatta.val('b') === 5); // true

  /**
    You can alse set objects.
    */
  yatta.val('object', {a : {b : "b"}, c : { d : 5 }});
  console.log(yatta.val('object').val('c').val('d') === 5); // true

  /**
    Lists are always immutable.
  */
  yatta.val('list', [1,2,3]);
  console.log(yatta.val('list')[2] === 3); // true

  /**
    ### Check Types
    Certainly you want to check types!

    Here, we create a function that parses a Yatta type to a string.
  */
  function show(o){
    if (o.type === "JsonType"){
      return JSON.stringify(o.toJson());
    } else if (o.type === "WordType") {
      return o.val();
    } else if (o.constructor === {}.constructor) { // It's an Object
      return JSON.stringify(o);
    } else { // It's a primitive data type (E.g. string, int)
      return o;
    }
  }

  /**
    ### Add listeners
    Apply a 'addProperty' - listener to a JsonType.
  */
  function addProperty(event_name, property_name){
    console.log("Property '" + property_name + "' was created!");
    console.log("Value: " + show(this.val(property_name))); // 'this' is the object on which the property was created.
  };
  yatta.on('addProperty', addProperty);
  yatta.val('new', {z: 7}); // Property 'new' was created!

  /**
    Apply a 'change' - listener to a JsonType.
  */
  function change(event_name, property_name){
    console.log("Value of property '" + property_name + "' changed!");
    console.log("New value: " + show(this.val(property_name)) + ""); // 'this' is the object on which the property changed.
  };
  yatta.on('change', change);
  yatta.val('mutable_string', "text", 'mutable'); // Property 'mutable_string' was replaced or changed!

  /**
    'change' and 'addProperty' do also fire for nested properties.
  */
  yatta.val('new').val('z', {'replace' : "x"}); // Property 'z' was replaced or changed!
  yatta.val('new').val('z').val('new', {"true": true}); // Property 'z' was replaced or changed! + Property 'new' was created!

  /**
    Apply 'insert' and 'delete' - listeners to Words.
  */
  function insert_delete(event_name, op){
    if (event_name === "insert"){
      console.log("Inserted '" + op.content + "' at position " + op.getPosition());
    } else if (event_name === "delete"){
      console.log("Deleted character at position " + op.getPosition());
    }
  };
  yatta.val('mutable_string').on(['insert', 'delete'], insert_delete);
  yatta.val('mutable_string').insertText(0, 'a'); // Inserted 'a' at position 0
  yatta.val('mutable_string').deleteText(0, 1); // Deleted character at position 0

  yatta.deleteListener('addProperty', addProperty);
  yatta.deleteListener('change', change);
  yatta.val('mutable_string').deleteListener('insert_delete', insert_delete);


  /**
    ### Experimental method
    But there is a much more convenient way!
  */
  console.log(yatta.value.list[2] === 3) // true
  yatta.value.list = [3,4,5]
  console.log(yatta.val('list')[2] === 5) // true
  yatta.value.object = {c : 4}
  console.log(yatta.value.object.c === 4) // true

  /**
    The downside is that you are only allowed to overwrite existing properties.
  */
  yatta.value.newProperty = "Awesome"
  console.log(yatta.value.newProperty !== "Awesome") // true, yatta.value.newProperty is undefined.

  /**
    So, how do we create new properties?
  */
  yatta.value = {newProperty : "Awesome"}
  console.log(yatta.value.newProperty === "Awesome") // true, it's awesome ;)

  /**
    This is stupid! I need to create new properties!
    Very well.. The solution is that we merge yatta.value with the new assignment.
    For example: assuming we want to overwrite yatta.value with some object o.
    Then these two rules apply:
    * The result has all properties of o
    * The result has all properties of yatta.value if they don't occur under the same property-name in o
  */
  yatta.value = {newProperty : {Awesome : true }}
  console.log(yatta.value.list[2] === 5) // true, old value list still exists.
  console.log(yatta.value.newProperty.Awesome === true) // true, newProperty is overwritten.

  /**
    Consider this case.
  */
  yatta.value = {newProperty : { x : 4} }
  console.log(yatta.value.newProperty.Awesome == null) // true, newProperty was replaced, therefore it is now undefined

  /**
    Did you notice that you always set immutable objects if you set properties like this?
    Even if the default is 'mutable'. If you want to work with mutable objects you have to work with .val().

    One last thing. You are only allowed to set properties like this `yatta.value = o`.
    Yatta can't observe if you overwrite object references `yatta = "Awesome"`.
  */
  w = yatta.value.newProperty
  w = "Awesome"
  console.log(yatta.value.newProperty !== "Awesome") // true, still not awesome..

  /**
    Please also read [JsonWrapper](https://rawgit.com/DadaMonad/Yatta/master/doc/class/JsonWrapper.html)
  */
});
