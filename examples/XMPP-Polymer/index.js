
setTimeout(function(){
  window.x = document.querySelector("yatta-test");
  // x.yatta.HB.stopGarbageCollection();
  x.yatta.val("stuff",{otherstuff:{nostuff:"this is no stuff"}})
  setTimeout(function(){
    var res = x.yatta.val("stuff");
    if(!(x.nostuff === "this is no stuff")){
      console.log("Deep inherit doesn't work!")
    }
    window.y_stuff_property.val = {nostuff: "this is also no stuff"};
    setTimeout(function(){
      if(!(x.nostuff === "this is also no stuff")){
        console.log("Element val overwrite doesn't work")
      }
      console.log("Everything is fine :)");
    },500)
  },500);
},3000)