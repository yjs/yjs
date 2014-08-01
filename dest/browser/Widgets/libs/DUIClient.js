//get the iwc.Client class def.
/*
iwc = iwc || {};
iwc.Client = iwc.Client || {};

/**
 * Add a function to set the compnent name of the iwc.Client class.<br/>
 * This component name is for filtering incoming intent at the iwc.Client. The intent can be further processed
 * only when the intent.component attribute matches the component name of the iwc.Client or the intent.component is an empty string(pseudo broadcast).
 * @param componentName The component name
 */
/*
iwc.Client.prototype.setComponentName = function(componentName){
	this._componentName = componentName;
};
*/

DUIClient = function(){
	//in role framework the parent div of the widget ifr is IDed as "widget-{widgetId}-body" sth. like this
	var _widgetId = parent.document.getElementById(self.frameElement.id).parentNode.id.split("-")[1];
	var that = this;
	var _iwcClient = new iwc.Client(["*"]);
	_iwcClient._componentName = "duiclient-"+_widgetId;
	
	this.externalCallback = function(intent){};
	
/**
 * The target function when the intent is for updating widget state request
 */
	this._onUpdateState = function(intent){
		var isForMigration = intent.extras.isForMigration;
		if (isForMigration)
			this.finishMigration(intent);
		else
			this.updateState(intent);
	};

	/**
	 * The target function when the intent is for getting the current widget state.<br/>
	 * The intent.extras object here is always a Json object.
	 */
	this._onGetWidgetState = function(intent){
		var target = null;
		var forMigration = false;
		if (intent.extras.target != null){
			target = intent.extras.target;
			forMigration = true;
		}
		var states = this.getWidgetState(forMigration);
		
		var resIntent = {};
		if (forMigration)
			resIntent = {
					"action": "DUI_WS_MIG",
					"categories": ["DUI"],
					"component": "duimanager",
					"data":"",
					"dataType":"",
					"extras":{"target": target, "widgetId": _widgetId, "widgetStates": states}
			};
		else
			resIntent = {
				"action": "DUI_WS",
				"categories": ["DUI"],
				"component": intent.sender,
				"data":"",
				"dataType":"",
				"extras":{"widgetId": _widgetId, "widgetStates": states}
			};
		
		_iwcClient.publish(resIntent);
	};
	
	/**
	 * The target function when the intent is to inform a change in the scope of the application
	 */
	this._onAppStateChange = function(intent){
		this.changeWithApp(intent);
	};

	/**
	 * The target function when the intent is to inform a migration of this widget is waiting to be taken place
	 */
	this._prepareMigration = function(intent){
		console.log("do sth before the widget is removed");
		this.prepareMigration();
	};
	
	this._logOff = function(intent){
		var states = this.getWidgetState(false);
		resIntent = {
			"action": "DUI_WS_LOGOFF",
			"categories": ["DUI"],
			"component": "duimanager",
			"data":"",
			"dataType":"",
			"extras":{"widgetId": _widgetId, "widgetStates": states}
		};
		
		_iwcClient.publish(resIntent);
	};
	
	/**
	 * The intent dispatcher and the callback function connected to the private field of iwc.Client.onIntent.<br/>
	 * This function is called once an intent is received by the iwc.Client and passed the first level filter of the iwc.Client.<br/>
	 * @param intent The incoming intent. Technically all intents will come, the filter of the iwc.Client class is weak...
	 */
	var _iwcCallback = function(intent){
		that.externalCallback(intent);
		//does not accept global intents(global intents are processed by normal iwc.Client, normal iwc.Proxy and DUI manager)
		//does not accept intents that are not categorized as "DUI"
		if ((typeof intent.flags != "undefined" && intent.flags.indexOf("PUBLISH_GLOBAL")!=-1) 
				|| typeof intent.categories == "undefined" || intent.categories.indexOf("DUI") == -1)
			return;
		//then does not accept intents for other widgets
		//if the widget id is undefined here, this is an DUI intent from the DUI manager for all involved widget, e.g. application state changed
		var action = intent.action;
		if (typeof intent.extras.widgetId != "undefined" && intent.extras.widgetId == _widgetId){
			if (action == "DUI_UPDATE_STATE"){
				that._onUpdateState(intent);
				return;
			}
			if (action == "DUI_GET_WS"){
				that._onGetWidgetState(intent);
				return;
			}
			if (action == "DUI_PRE_MIG"){
				that._prepareMigration(intent);
				return;
			}
		}else if (typeof intent.extras.widgetId == "undefined"){		
			if (action == "DUI_LOG_OFF"){
				that._logOff(intent);
				return;
			}
			if (action == "DUI_APP_CHANGE"){
				that._onAppStateChange(intent);
				return;
			}
			if (action == "DUI_REG_CLIENT"){
				that.initOK();
				return;
			}
			if (action == "DUI_AS"){
				that.onAppState(intent.extras.appStates);
			}
		}
	};
	
	_iwcClient.connect(_iwcCallback);
	
	//remember to bind(this) the function when override
	
	/**
	 * The function is called when the dui manager wants the widget states.<br/>
	 * <strong>Notice</strong>: avoid putting complex data and data structure to the state value, the browser and Java JSON encoder and parser might cause inconsistent input and output.
	 * @param isForMigration A boolean. True if special state for migration is needed otherwise not.
	 * @returns an object containing the widget states, e.g. {"selectIndex":1, "phaseNum":2, "textinput":"iamatextvalueinatextinput"}
	 */
	this.getWidgetState = function(isForMigration){
		console.log("the widget collects it is state and return, overwrite it");
		var states = {};
		return states; 
	};
	
	/**
	 * The function is called when there detected a application state change at the dui manager and the manager informs the widget about the change.<br/>
	 * Override this function to apply changes to the widget according to the valuable application state changes.<br/>
	 * @param intent intent The infos are in intent.extras object e.g. intent.extras = {"oldStates":{}, "newStates":{"statename":value, "state2":value2}}. the property 'oldStates' can be null if the space has not set app state ever before.
	 */
	this.changeWithApp = function(intent){
		//sample
		var oldStates = intent.extras.oldStates;
		var newStates = intent.extras.newStates;
		console.log(oldStates);
		console.log(newStates);
		console.log("the widget may need to change something following the whole app");
	};

	/**
	 * The function is called right before a migration for this widget and the widget state is already saved to the server in previous migration phases.<br/>
	 * And it is the last chance to perform any moves before the widget is removed from current web page.<br/>
	 * Override this method to perform state update for each different widget.<br/>
	 * <strong>AND DO REMEMBER TO CALL {@link DUIClient#prepareMigDone} AT THE END OF THIS FUNCTION!</strong>
	 */
	this.prepareMigration = function(){
		//e.g. ..... just a joke....
		/*
		if (confirm("you sure to sign out?..."))
			parent.location = parent.location.protocol + "//" + parent.location.host + "/:authentication?return=&action=signout";
		console.log("the migration is at hand, the widget may need to do sth special before it is removed from the role widget container e.g. disconnect from the lasServer etc.");
		*/
		this.prepareMigDone();
	};

	/**
	 * The function is called when the dui manager asks the widget to update its states.<br/>
	 * Compared to the function DUIClient.finishMigration(), this is a typical normal state update for active widget on presence.<br/>
	 * This method will be called as a callback for DUIClient#requireWidgetState(); or DUIClient#initOK() when it is not a migration. 
	 * Override this method to perform state update for each different widget.
	 * @param intent The Intent object that contains infos of required widget states, the infos are in intent.extras.widgetStates e.g. {"state1":value1,"state2":value2}.
	 * The object might contain appStates as well if there is any application state, get it in intent.extras.appStates e.g. {"appstate1":value1,"appstate2":value2}.
	 */
	this.updateState = function(intent){
		var states = {};
		states = intent.extras.widgetStates;
		var appStates = intent.extras.appStates;
		console.log(states);
		if (typeof appStates != "undefined")
			console.log(appStates);
		console.log("update the widget state, widget need to overwrite it");
	};
	
	/**
	 * The function is called to finish the Migration and update the widget state.<br/>
	 * Compared to the method DUIClient.updateState(), this method is a special widget state update for the widget that has just migrated.<br/>
	 * Override this method to perform finishing moves for each different widget.
	 * @param intent The Intent object that contains infos to complete the migration, the infos are in intent.extras.states e.g. {"state1":value1, "state2":value2}.
	 *  The object might contain appStates as well if there is any application state, get it in intent.extras.appStates e.g. {"appstate1":value1,"appstate2":value2}.
	 */
	this.finishMigration = function(intent){
		var states = {};
		states = intent.extras.widgetStates;
		var appStates = intent.extras.appStates;
		console.log(states);
		if (typeof appStates != "undefined")
			console.log(appStates);
		console.log("the migration is done, the widget may need to perform special inits before update the widget state e.g. login to the lasServer again.");
	};
	
	/**
	 * The function to signal the dui manager that the preparation for the migration is ready on this widget.<br/>
	 * This function should be called at the end of the overwritten function {@link DUIClient#prepareMigration}<br/> 
	 * Do not override this method unless there is really an unstoppable reason.
	 */
	this.prepareMigDone = function(){
		//prepared and send OK response to DUIMgr
		var intent = {
				"component": "duimanager",
				"categories": ["DUI"],
				"action": "DUI_PRE_MIG_OK",
				"data": "",
				"dataType": "",
				"extras": {"widgetId": _widgetId}
			};
		_iwcClient.publish(intent);
	};

	/**
	 * The function to call the DUI manager to save the widget state on the server.<br/>
	 * Do not override this method unless there is really an unstoppable reason.
	 * @param states An array of widget state object {"stateName": stateValue}
	 */
	this.saveWidgetState = function(){
		var states = this.getWidgetState(false);
		var intent = {
			"action": "DUI_SAVE_WS",
			"categories": ["DUI"],
			"component": "duimanager",// the overwritten dui manager from the iwc.Proxy should have the _componentName set to "duimanager"
			"data":"",
			"dataType":"",
			"extras":{"widgetStates":states, "widgetId": _widgetId}
		};
		_iwcClient.publish(intent);
	};
	
	/**
	 * An open interface to send any intent
	 */
	this.sendIntent = function(intent){
		//or to send the intent to "duimanager"
		_iwcClient.publish(intent);
	};
	
	/**
	 * This function asks the framework for the states stored on the server.
	 * Do not override it.
	 */
	this.requireWidgetState = function(){
		var intent = {
				"action": "DUI_REQ_WS",
				"categories": ["DUI"],
				"component": "duimanager",// the overwritten dui manager from the iwc.Proxy should have the _componentName set to "duimanager"
				"data":"",
				"dataType":"",
				"extras":{"widgetId": _widgetId}
		};
		_iwcClient.publish(intent);
	};
	
	/**
	 * Store the global app state
	 * @param states the app state to be stored e.g. {"state1":value1, "state2":value2}
	 */
	this.setAppState = function(states){
		var intent = {
				"action": "DUI_SET_AS",
				"categories": ["DUI"],
				"component": "duimanager",// the overwritten dui manager from the iwc.Proxy should have the _componentName set to "duimanager"
				"data":"",
				"dataType":"",
				"extras":{"states": states}
		};
		_iwcClient.publish(intent);
	};
	
	/**
	 * Ask the dui manager for the app state.
	 */
	this.getAppState = function(){
		var intent = {
				"action": "DUI_GET_AS",
				"categories": ["DUI"],
				"component": "duimanager",// the overwritten dui manager from the iwc.Proxy should have the _componentName set to "duimanager"
				"data":"",
				"dataType":"",
		};
		_iwcClient.publish(intent);
	};
	
	/**
	 * Override this function to do something when the requested app state comes.
	 * @param appStates the json format of the app state:{"name1": value1, "name2": value2};
	 */
	this.onAppState = function(appStates){};
	
	/**
	 * call this function to register the duiclient to duimanager after all things are OK 
	 */
	this.initOK = function(){
		var okIntent = {
			"action": "DUI_CLIENT_OK",
			"categories": ["DUI"],
			"component": "duimanager",// the overwritten dui manager from the iwc.Proxy should have the _componentName set to "duimanager"
			"data":"",
			"dataType":"",
			"extras":{"widgetId": _widgetId}	
		};
		
		_iwcClient.publish(okIntent);
	};
	
	/**
	 * publish the intent in the domain of the user only
	 */
	this.publishToUser = function(intent){
		var wrap = {
				"action": "DUI_PUB_USER",
				"categories": ["DUI"],
				"component": "duimanager",
				"data": JSON.stringify(intent),
				"dataType": "application/json",
				"extras": {}
		};
		_iwcClient.publish(intent);
		_iwcClient.publish(wrap);
	};
	
	/**
	 * register the call back function of the widget to the DUI client.
	 */
	this.connect = function(callback){
		this.externalCallback = callback;
	};
};


// reminder to myself:.... the callback funcs injected into this DUIClient need to bind()
