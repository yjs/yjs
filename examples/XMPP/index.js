

connector = new Y.XMPP().join("testy-xmpp-json3", {syncMode: "syncAll"});
connector.debug = true

y = new Y(connector);

window.onload = function(){
  var textbox = document.getElementById("textfield");
  y.observe(function(events){
    for(var i=0; i<events.length; i++){
      var event = events[i];
      if(event.name === "textfield" && event.type !== "delete"){
        y.val("textfield").bind(textbox);
        y.val("headline").bind(document.querySelector("h1"))
      }
    }
  });
  connector.whenSynced(function(){
    if(y.val("textfield") == null){
      y.val("headline", new Y.Text("headline"));
      y.val("textfield",new Y.Text("stuff"))
    }
  })

};
