## PeerJs + JSON Example
Here, I will give a short overview on how to enable collaborative json with the
[PeerJs](http://peerjs.com/) Connector and the JsonYatta Framework.
First you have to include the following libraries in your html file:
```
<script src="http://cdn.peerjs.com/0.3/peer.js"></script>
<script src="../../build/browser/Frameworks/JsonYatta.js"></script>
<script src="../../build/browser/Connectors/PeerJsConnector.js"></script>
<script src="./index.js"></script>
```
### Create Connector

The PeerJs Framework requires an API key, or you need to set up your own PeerJs server.
Get an API key from the [Website](http://peerjs.com/peerserver).
The first parameter of `createPeerJsConnector` is forwarded as the options object in PeerJs.
Therefore, you may also specify the server/port here, if you have set up your own server.


```js
var yatta, yattaHandler;
Y.createPeerJsConnector({key: 'h7nlefbgavh1tt9'}, function(Connector, user_id){
```


### Yatta
yatta is the shared json object. If you change something on this object,
it will be instantly shared with all the other collaborators.


```js
  yatta = new Y.JsonYatta(user_id, Connector);
```


Next, you may want to connect to another peer. Therefore you have to receive his
user_id. If the other peer is connected to other peers, the PeerJsConnector
will automatically connect to them too.

Transmitting the user_id is your job.
See the [TextEditing](../TextEditing/) an example on how to do that with urls.


```js
  // yatta.connector.connectToPeer(peer_user_id);
```


Add a integer-property like this


```js
  yatta.val('x', 7);
```


Get the value of property x like this


```js
  console.log(yatta.val('x') === 7); // true
```


A string property can be either mutable or immutable.


```js
  yatta.val('mutable_string', "text", "mutable");
  yatta.val('immutable_string', "text", "immutable");

  console.log(yatta.val('immutable_string') === "text"); // true
  yatta.val('mutable_string').insertText(2,"XXX"); // position, string
  yatta.val('mutable_string').deleteText(0,1); // position, deletion length
  console.log(yatta.val('mutable_string').val() === "eXXXxt"); // true
```


You can omit the mutable - parameter. In that case the default will be used.
Initially the default is 'mutable'. You can set it like this:


```js
  yatta.setMutableDefault('mutable');
  // or
  yatta.setMutableDefault('immutable');

  yatta.val('new_string', "string");
  console.log(yatta.val('new_string') === "string"); // true
```


yatta is chainable:


```js
  yatta.val('a', 4).val('b',5);
  console.log(yatta.val('a') === 4); // true
  console.log(yatta.val('b') === 5); // true
```


You can alse set objects.


```js
  yatta.val('object', {a : {b : "b"}, c : { d : 5 }});
  console.log(yatta.val('object').val('c').val('d') === 5); // true
```


Lists are always immutable.


```js
  yatta.val('list', [1,2,3]);
  console.log(yatta.val('list')[2] === 3); // true
```


### Add listeners
Apply a 'addProperty' - listener to a JsonType.


```js
  function addProperty(event_name, property_name){
    console.log("Property '" + property_name + "' was created!");
  };
  yatta.on('addProperty', addProperty);
  yatta.val('new', {z: 7}); // Property 'new' was created!
```


Apply a 'change' - listener to a JsonType.


```js
  function change(event_name, property_name){
    console.log("Property '" + property_name + "' was replaced or changed!");
    console.log("New value: \"" + this.val(property_name).val() + "\""); // 'this' is the new/created value
  };
  yatta.on('change', change);
  yatta.val('mutable_string', "text", 'mutable'); // Property 'mutable_string' was replaced or changed!
```


Does not fire for nested properties.


```js
  yatta.val('q').val('z', 8); // No output!
```


Apply 'insert' and 'delete' - listeners to Words.


```js
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
  yatta.deleteListener('insert_delete', insert_delete);
```


### Experimental method
But there is a much more convenient way!


```js
  console.log(yatta.value.list[2] === 3) // true
  yatta.value.list = [3,4,5]
  console.log(yatta.val('list')[2] === 5) // true
  yatta.value.object = {c : 4}
  console.log(yatta.value.object.c === 4) // true
```


The downside is that you are only allowed to overwrite existing properties.


```js
  yatta.value.newProperty = "Awesome"
  console.log(yatta.value.newProperty !== "Awesome") // true, yatta.value.newProperty is undefined.
```


So, how do we create new properties?


```js
  yatta.value = {newProperty : "Awesome"}
  console.log(yatta.value.newProperty === "Awesome") // true, it's awesome ;)
```


This is stupid! I need to create new properties!
Very well.. The solution is that we merge yatta.value with the new assignment.
For example: assuming we want to overwrite yatta.value with some object o.
Then these two rules apply:
* The result has all properties of o
* The result has all properties of yatta.value if they don't occur under the same property-name in o


```js
  yatta.value = {newProperty : {Awesome : true }}
  console.log(yatta.value.list[2] === 5) // true, old value list still exists.
  console.log(yatta.value.newProperty.Awesome === true) // true, newProperty is overwritten.
```


Consider this case.


```js
  yatta.value = {newProperty : { x : 4} }
  console.log(yatta.value.newProperty.Awesome == null) // true, newProperty was replaced, therefore it is now undefined
```


Did you notice that you always set immutable objects if you set properties like this?
Even if the default is 'mutable'. If you want to work with mutable objects you have to work with .val().

One last thing. You are only allowed to set properties like this `yatta.value = o`.
Yatta can't observe if you overwrite object references `yatta = "Awesome"`.


```js
  w = yatta.value.newProperty
  w = "Awesome"
  console.log(yatta.value.newProperty !== "Awesome") // true, still not awesome..
```


Please also read [JsonWrapper](https://rawgit.com/DadaMonad/Yatta/master/doc/class/JsonWrapper.html)


```js
});
```
