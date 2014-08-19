
#
# @param {Function} callback The callback is called when the connector is initialized.
# @param {String} initial_user_id Optional. You can set you own user_id (since the ids of duiclient are not always unique)
#
createIwcConnector = (callback, options)->
  userIwcHandler = null
  if options?
    {iwcHandler: userIwcHandler} = options

  iwcHandler = {}
  duiClient = new DUIClient()
  #@duiClient = new iwc.Client()
  duiClient.connect (intent)->
    iwcHandler[intent.action]?.map (f)->
      setTimeout ()->
        f intent
      , 0
    if userIwcHandler?
      userIwcHandler intent

  duiClient.initOK()

  received_HB = null

  #
  # The Iwc Connector adds support for the Inter-Widget-Communication protocol that is used in the Role-SDK.
  # @see http://dbis.rwth-aachen.de/cms/projects/the-xmpp-experience#interwidget-communication
  # @see http://dbis.rwth-aachen.de/cms/projects/ROLE
  #
  class IwcConnector

    #
    # @param {Engine} engine The transformation engine
    # @param {HistoryBuffer} HB
    # @param {Array<Function>} execution_listener You must ensure that whenever an operation is executed, every function in this Array is called.
    # @param {Yatta} yatta The Yatta framework.
    #
    constructor: (@engine, @HB, @execution_listener, @yatta)->
      @duiClient = duiClient
      @iwcHandler = iwcHandler

      send_ = (o)=>
        if Object.getOwnPropertyNames(@initialized).length isnt 0
          @send o
      @execution_listener.push send_

      @initialized = {}
      receiveHB = (json)=>
        HB = json.extras.HB
        him = json.extras.user
        this.engine.applyOpsCheckDouble HB
        @initialized[him] = true
      iwcHandler["Yatta_push_HB_element"] = [receiveHB]

      @sendIwcIntent "Yatta_get_HB_element", {}

      receive_ = (intent)=>
        o = intent.extras
        if @initialized[o.uid.creator]? # initialize first
          @receive o

      @iwcHandler["Yatta_new_operation"] = [receive_]

      if received_HB?
        @engine.applyOpsCheckDouble received_HB

      sendHistoryBuffer = ()=>
        json =
          HB : @yatta.getHistoryBuffer()._encode()
          user : @yatta.getUserId()
        @sendIwcIntent "Yatta_push_HB_element", json
      @iwcHandler["Yatta_get_HB_element"] = [sendHistoryBuffer]

    #
    # This function is called whenever an operation was executed.
    # @param {Operation} o The operation that was executed.
    #
    send: (o)->
      if o.uid.creator is @HB.getUserId() and (typeof o.uid.op_number isnt "string")
        @sendIwcIntent "Yatta_new_operation", o

    #
    # This function is called whenever an operation was received from another peer.
    # @param {Operation} o The operation that was received.
    #
    receive: (o)->
      if o.uid.creator isnt @HB.getUserId()
        @engine.applyOp o

    #
    # Helper for sending iwc intents.
    # @overload sendIwcIntent intent
    #   @param {Object} intent The intent object.
    # @overload sendIwcIntent action_name, content
    #   @param {String} action_name The name of the action that is going to be send.
    #   @param {String} content The content that is atteched to the intent.
    #
    sendIwcIntent: (action_name, content)->
      intent = null
      if arguments.length >= 2
        [action_name, content] = arguments
        intent =
          action: action_name
          component: ""
          data: ""
          dataType: ""
          flags: ["PUBLISH_GLOBAL"]
          extras: content
      else
        intent = arguments[0]

      @duiClient.sendIntent(intent)

    setIwcHandler: (f)->
      userIwcHandler = f


  init = ()->
    # proposed_user_id = duiClient.getIwcClient()._componentName #TODO: This is stupid! why can't i use this?
    proposed_user_id = Math.floor(Math.random()*1000000)
    callback IwcConnector, proposed_user_id

  setTimeout init, 5000

  undefined


module.exports = createIwcConnector
if window?
  if not window.Y?
    window.Y = {}
  window.Y.createIwcConnector = createIwcConnector

