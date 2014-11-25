
```js
var rid = Math.ceil(Math.random()*100 + 1);
var conn = {key: 'h7nlefbgavh1tt9'};
var connector = new PeerJsConnector(rid,conn);
var yatta = new Y.JsonFramework(rid, connector)
```
