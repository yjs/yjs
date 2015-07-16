
Y({
  db: {
    name: "Memory"
  },
  connector: {
    name: "WebRTC",
    room: "mineeeeeee",
    debug: true
  }
}).then(function(yconfig){
  window.y = yconfig.root;
  window.yconfig = yconfig;
  var textarea = document.getElementById("textfield");
  var contenteditable = document.getElementById("contenteditable");
  yconfig.root.observe(function(events){
    for (var e in events) {
      var event = events[e];
      if (event.name === "text" && (event.type === "add" || event.type === "update")) {
        event.object.get(event.name).then(function(text){ //eslint-disable-line
          text.bind(textarea);
          text.bind(contenteditable);
          window.ytext = text;
        });
      }
    }
  });
  yconfig.root.set("text", Y.TextBind);
});
