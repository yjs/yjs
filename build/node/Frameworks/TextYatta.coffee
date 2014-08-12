
text_types_uninitialized = require "../Types/TextTypes"
HistoryBuffer = require "../HistoryBuffer"
Engine = require "../Engine"

#
# Framework for Text Datastructures.
#
class TextYatta

  #
  # @param {String} user_id Uniqe user id that defines this peer.
  # @param {Connector} Connector The connector defines how you connect to the other peers.
  #
  constructor: (user_id, Connector)->
    @HB = new HistoryBuffer user_id
    text_types = text_types_uninitialized @HB
    @engine = new Engine @HB, text_types.parser
    @connector = new Connector @engine, @HB, text_types.execution_listener

    first_word = new text_types.types.Word undefined
    @HB.addOperation(first_word).execute()
    @root_element = first_word

  #
  # @result Word
  #
  getRootElement: ()->
    @root_element

  #
  # @see Engine
  #
  getEngine: ()->
    @engine

  #
  # Get the initialized connector.
  #
  getConnector: ()->
    @connector

  #
  # @see HistoryBuffer
  #
  getHistoryBuffer: ()->
    @HB

  #
  # Get the UserId from the HistoryBuffer object.
  # In most cases this will be the same as the user_id value with which
  # JsonYatta was initialized (Depending on the HistoryBuffer implementation).
  #
  getUserId: ()->
    @HB.getUserId()

  #
  # @see JsonType.val
  #
  val: ()->
    @root_element.val()

  #
  # @see Word.insertText
  #
  insertText: (pos, content)->
    @root_element.insertText pos, content

  #
  # @see Word.deleteText
  #
  deleteText: (pos, length)->
    @root_element.deleteText pos, length

  #
  # @see Word.replaceText
  #
  replaceText: (text)->
    @root_element.replaceText text


module.exports = TextYatta
