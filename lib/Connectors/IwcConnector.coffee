
createIwcConnector = (callback)->
  iwcHandler = {}
  duiClient = new DUIClient()
  #@duiClient = new iwc.Client()
  duiClient.connect (intent)->
    #console.log "intent received iwc: #{JSON.stringify(intent)}"
    #console.log "#{JSON.stringify(@iwcHandler)}"
    iwcHandler[intent.action]?.map (f)->
      setTimeout ()->
          f intent
        , 0

  duiClient.initOK()

  received_HB = null

  #
  # The Iwc Connector adds support for the Inter-Widget-Communication protocol that is used in the Role-SDK.
  # @see http://dbis.rwth-aachen.de/cms/projects/the-xmpp-experience#interwidget-communication
  # @see http://dbis.rwth-aachen.de/cms/projects/ROLE
  #
  class IwcConnector
    constructor: (@engine, @HB, @execution_listener, @yatta)->
      @duiClient = duiClient
      @iwcHandler = iwcHandler

      send_ = (o)=>
        @send o
      @execution_listener.push send_

      receive_ = (intent)=>
        o = intent.extras
        @receive o
      @iwcHandler["Yatta_new_operation"] = [receive_]

      if received_HB?
        @engine.applyOpsCheckDouble received_HB

      sendHistoryBuffer = ()=>
        json = {
            HB : @yatta.getHistoryBuffer()._encode()
          }
        @sendIwcIntent "Yatta_push_HB_element", json
      @iwcHandler["Yatta_get_HB_element"] = [sendHistoryBuffer]

    send: (o)->
      if o.uid.creator is @HB.getUserId() and (typeof o.uid.op_number isnt "string")
        @sendIwcIntent "Yatta_new_operation", o

    receive: (o)->
      if o.uid.creator isnt @HB.getUserId()
        @engine.applyOp o

    sendIwcIntent: (action_name, content)->
      intent =
        action: action_name
        component: ""
        data: ""
        dataType: ""
        extras: content

      @duiClient.sendIntent(intent)

    sync: ()->
      throw new Error "Can't use this a.t.m."

  get_HB_intent =
    action: "Yatta_get_HB_element"
    component: ""
    data: ""
    dataType: ""
    extras: {}

  init = ()->
    duiClient.sendIntent(get_HB_intent)

    is_initialized = false
    receiveHB = (json)->
      proposed_user_id = duiClient.getIwcClient()._componentName
      received_HB = json?.extras.HB
      if not is_initialized
        is_initialized = true
        callback IwcConnector, proposed_user_id
    iwcHandler["Yatta_push_HB_element"] = [receiveHB]
    setTimeout receiveHB, 0

  setTimeout init, (Math.random()*0)

  undefined
module.exports = createIwcConnector
window?.createConnector = createIwcConnector

