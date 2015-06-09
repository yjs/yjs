
class DBTransaction
  constructor: (@t)->

  setOperation: (op)->
    that = this
    new Promise (resolve, reject)->
      req = that.t.objectStore("HistoryBuffer").put op
      req.onsuccess = (event)->
        resolve op
      req.onerror = (event)->
        reject "Could not set Operation!"

  getOperation: (uid)->
    that = this
    new Promise (resolve, reject)->
      req = that.t.objectStore("HistoryBuffer").get uid
      req.onsuccess = (event)->
        resolve req.result
      req.onerror = (event)->
        reject "Could not get Operation!"

  getOperations: (state_map)->
    flow = Promise.resolve()
    ops = []
    that = this
    hb = that.t.objectStore("HistoryBuffer")

    that.getStateVector().then (end_state_vector)->
      for end_state of end_state_vector
        # convert to the db-structure
        do (end_state = end_state)->
          start_state =
            user: end_state.name
            state: state_map[end_state] ? 0

          flow = flow.then ()->
            from = [start_state.user, start_state.number]
            to = [end_state.user, end_state.number]
            range = IDBKeyRange.bound from, to
            defer = Promise.defer()

            hb.openCursor(range).onsuccess = ()->
              cursor = event.target.result
              if cursor?
                ops.push cursor.value # add Operation
                cursor.continue()
              else
                # got all ops from this user
                defer.resolve ops
            defer.promise

  setState: (state)->
    that = this
    new Promise (resolve, reject)->
      req = that.t.objectStore("StateVector").put state
      req.onsuccess = (event)->
        resolve state
      req.onerror = (event)->
        reject "Could not set state vector!"

  getState: (user)->
    defer = Promise.defer()
    req = @t.objectStore("StateVector").get user
    req.onsuccess = (event)->
      defer.resolve req.result
    req.onerror = (event)->
      defer.reject "Could not get state vector!"
    defer.promise

  getStateVector: ()->
    defer = Promise.defer()
    state_vector = []
    @t.objectStore("StateVector").openCursor().onsuccess = ()->
      cursor = event.target.result
      if cursor?
        state = cursor.value
        state_vector.push state
        cursor.continue()
      else
        # got all ops from this user
        defer.resolve state_vector
    defer.promise



class Transaction
  constructor: (@t)->

  updateOperation: (op)->
    @t.setOperation op

  addOperation: (op)->
    that = this
    @t.getState op.uid[0]
      .then (state)->
        # only add operation if this is an expected operation
        if not state?
          state =
            user: op.uid[0]
            number: 0
        if op.uid[1] is state.number
          state.number++
          that.t.setState state
        else
          return Promise.reject("Unexpected Operation")
      .then that.t.setOperation op

  getOperation: (uid)->
    @t.getOperation uid

  getState: (user)->
    @t.getState user

  getOperations: (state_vector)->
    @t.getOperations state_vector


class window.DB
  constructor: ()->
    @ready = (new Promise (resolve, reject)->
      req = indexedDB.open "Testy", 7
      req.onerror = ()->
        reject "Couldn't open the IndexedDB database!"
      req.onsuccess = (event)->
        resolve event.target.result
      req.onupgradeneeded = (event)->
        db = event.target.result
        objectStore = db.createObjectStore "HistoryBuffer", {keyPath: "uid"}
        objectStore = db.createObjectStore "StateVector", {keyPath: "user"}

    ).catch (message)->
      throw new Error message

  requestTransaction: ()->
    @ready.then (db)->
      new Promise (resolve, reject)->
        resolve new Transaction( new DBTransaction(db.transaction(["HistoryBuffer", "StateVector"], "readwrite")) )

  removeDatabase: ()->
    req = indexedDB.deleteDatabase "Testy"
    req.onsuccess = ()->
      console.log("Deleted database successfully");
    req.onblocked = ()->
      console.log("Database is currently being blocked")
      console.dir arguments
    req.onerror = ()->
      console.log("Couldn't delete database")
      console.dir arguments
    null

window.db = new DB()

window.addDummyDataSet = ()->
  db.requestTransaction().then (t)->
    t.getState("dmonad").then (state)->
      state ?= {number: 0}
      t.addOperation({uid: ["dmonad", state.number]})

window.getOp = (num = 3)->
  db.requestTransaction().then (t)->
    t.getOperation(["dmonad", num])
      .then (op)->
        console.log("yay:")
        console.log(op)

window.getOps = (state_map = {dmonad: 5})->
  db.requestTransaction().then (t)->
    t.getOperations(state_map)
      .then (op)->
        console.log("yay:")
        console.log(op)
