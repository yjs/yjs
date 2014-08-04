
Here, I will give a short overview on how to use the IwcYatta Framework.

    function init(){
        window.createIwcConnector(function(Connector){
          console.log("initializing..");
          yatta = new window.JsonYatta(1, Connector);
          var dui = yatta.getConnector().duiClient
          dui.getAppState()
          console.log("initialized!");

        })
    }
    $(document).ready(init)
