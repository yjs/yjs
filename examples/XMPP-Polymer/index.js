
setTimeout(function(){
  window.y_test = document.querySelector("y-test");

  window.y_test.y.val("stuff",{otherstuff:{nostuff:"this is no stuff"}})
  setTimeout(function(){
    var res = y_test.y.val("stuff");
    if(!(y_test.nostuff === "this is no stuff")){
      console.log("Deep inherit doesn't work!")
    }
    window.y_stuff_property.val = {nostuff: "this is also no stuff"};
    setTimeout(function(){
      if(!(y_test.nostuff === "this is also no stuff")){
        console.log("Element val overwrite doesn't work")
      }
      console.log("Everything is fine :)");
    },500)
  },500);
},3000)