(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var createIwcConnector;

createIwcConnector = function(callback) {
  var IwcConnector, duiClient, get_root_intent, init, iwcHandler, received_HB, root_element;
  iwcHandler = {};
  duiClient = new DUIClient();
  duiClient.connect((function(_this) {
    return function(intent) {
      var _ref;
      console.log("intent received iwc: " + (JSON.stringify(intent)));
      console.log("" + (JSON.stringify(_this.iwcHandler)));
      return (_ref = iwcHandler[intent.action]) != null ? _ref.map(function(f) {
        return setTimeout(function() {
          return f(intent);
        }, 0);
      }) : void 0;
    };
  })(this));
  duiClient.initOK();
  root_element = null;
  received_HB = null;
  IwcConnector = (function() {
    function IwcConnector(engine, HB, execution_listener, yatta) {
      var receive_, sendRootElement, send_;
      this.engine = engine;
      this.HB = HB;
      this.execution_listener = execution_listener;
      this.yatta = yatta;
      this.duiClient = duiClient;
      this.iwcHandler = iwcHandler;
      send_ = (function(_this) {
        return function(o) {
          return _this.send(o);
        };
      })(this);
      this.execution_listener.push(send_);
      receive_ = (function(_this) {
        return function(intent) {
          var o;
          o = intent.extras;
          return _this.receive(o);
        };
      })(this);
      this.iwcHandler["Yatta_new_operation"] = [receive_];
      if (root_element != null) {
        this.engine.applyOps(received_HB);
      }
      sendRootElement = (function(_this) {
        return function() {
          var json;
          json = {
            root_element: _this.yatta.getRootElement(),
            HB: _this.yatta.getHistoryBuffer().toJson()
          };
          return _this.sendIwcIntent("Yatta_push_root_element", json);
        };
      })(this);
      this.iwcHandler["Yatta_get_root_element"] = [sendRootElement];
    }

    IwcConnector.prototype.getRootElement = function() {
      return root_element;
    };

    IwcConnector.prototype.send = function(o) {
      if (o.uid.creator === this.HB.getUserId() && (typeof o.uid.op_number !== "string")) {
        return this.sendIwcIntent("Yatta_new_operation", o);
      }
    };

    IwcConnector.prototype.receive = function(o) {
      if (o.uid.creator !== this.HB.getUserId()) {
        return this.engine.applyOp(o);
      }
    };

    IwcConnector.prototype.sendIwcIntent = function(action_name, content) {
      var intent;
      intent = {
        action: action_name,
        component: "",
        data: "",
        dataType: "",
        extras: content
      };
      return this.duiClient.publishToUser(intent);
    };

    IwcConnector.prototype.sync = function() {
      throw new Error("Can't use this a.t.m.");
    };

    return IwcConnector;

  })();
  get_root_intent = {
    action: "Yatta_get_root_element",
    component: "",
    data: "",
    dataType: "",
    extras: {}
  };
  init = function() {
    var is_initialized, receiveRootElement;
    duiClient.publishToUser(get_root_intent);
    is_initialized = false;
    receiveRootElement = function(json) {
      root_element = json != null ? json.extras.root_element : void 0;
      received_HB = json != null ? json.extras.HB : void 0;
      if (!is_initialized) {
        is_initialized = true;
        return callback(IwcConnector);
      }
    };
    iwcHandler["Yatta_push_root_element"] = [receiveRootElement];
    return setTimeout(receiveRootElement, 3000);
  };
  setTimeout(init, 10);
  return void 0;
};

module.exports = createIwcConnector;

if (typeof window !== "undefined" && window !== null) {
  window.createIwcConnector = createIwcConnector;
}


},{}]},{},[1]);