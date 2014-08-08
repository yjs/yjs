var createIwcConnector;

createIwcConnector = function(callback) {
  var IwcConnector, duiClient, get_HB_intent, init, iwcHandler, received_HB;
  iwcHandler = {};
  duiClient = new DUIClient();
  duiClient.connect(function(intent) {
    var _ref;
    return (_ref = iwcHandler[intent.action]) != null ? _ref.map(function(f) {
      return setTimeout(function() {
        return f(intent);
      }, 0);
    }) : void 0;
  });
  duiClient.initOK();
  received_HB = null;
  IwcConnector = (function() {
    function IwcConnector(engine, HB, execution_listener, yatta) {
      var receive_, sendHistoryBuffer, send_;
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
      if (received_HB != null) {
        this.engine.applyOpsCheckDouble(received_HB);
      }
      sendHistoryBuffer = (function(_this) {
        return function() {
          var json;
          json = {
            HB: _this.yatta.getHistoryBuffer()._encode()
          };
          return _this.sendIwcIntent("Yatta_push_HB_element", json);
        };
      })(this);
      this.iwcHandler["Yatta_get_HB_element"] = [sendHistoryBuffer];
    }

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
      return this.duiClient.sendIntent(intent);
    };

    return IwcConnector;

  })();
  get_HB_intent = {
    action: "Yatta_get_HB_element",
    component: "",
    data: "",
    dataType: "",
    extras: {}
  };
  init = function() {
    var is_initialized, receiveHB;
    duiClient.sendIntent(get_HB_intent);
    is_initialized = false;
    receiveHB = function(json) {
      var proposed_user_id;
      proposed_user_id = duiClient.getIwcClient()._componentName;
      received_HB = json != null ? json.extras.HB : void 0;
      if (!is_initialized) {
        is_initialized = true;
        return callback(IwcConnector, proposed_user_id);
      }
    };
    iwcHandler["Yatta_push_HB_element"] = [receiveHB];
    return setTimeout(receiveHB, 0);
  };
  setTimeout(init, Math.random() * 0);
  return void 0;
};

module.exports = createIwcConnector;

if (typeof window !== "undefined" && window !== null) {
  window.createConnector = createIwcConnector;
}

//# sourceMappingURL=IwcConnector.js.map
