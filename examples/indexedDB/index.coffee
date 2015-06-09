
class Buffer
  constructor: (@buffer)->
  set: (op)->
    that = this
    new Promise (resolve, reject)=>
      request = that.buffer.put op
      request.onsuccess = (event)->
        resolve op
      request.onerror = (event)->
        reject "Could not set value!"

  get: (uid)->
    that = this
    new Promise (resolve, reject)=>
      request = that.buffer.get uid
      request.onsuccess = (event)->
        resolve request.result
      request.onerror = (event)->
        reject "Could not set value!"

class window.HB
  constructor: ()->
    @ready = (new Promise (resolve, reject)->
      request = indexedDB.open "Testy", 7
      request.onerror = ()->
        reject "Couldn't open the IndexedDB database!"
      request.onsuccess = (event)->
        resolve event.target.result
      request.onupgradeneeded = (event)->
        db = event.target.result
        objectStore = db.createObjectStore "HistoryBuffer", {keyPath: "uid"}
    ).catch (message)->
      throw new Error message

  requestBuffer: ()->
    @ready.then (db)->
      new Promise (resolve, reject)->
        resolve new Buffer(db.transaction(["HistoryBuffer"], "readwrite").objectStore("HistoryBuffer"))

  removeDatabase: ()->
    req = indexedDB.deleteDatabase "Testy"
    req.onsuccess = ()->
      console.log("Deleted database successfully");
    req.onerror = ()->
      console.log("Couldn't delete database")

window.hb = new HB()
