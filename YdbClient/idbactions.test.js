import * as globals from './globals.js'
import * as idbactions from './idbactions.js'
import * as test from './test.js'

idbactions.deleteDB().then(() => idbactions.openDB()).then(db => {
  test.run('update lifetime 1', async (testname) => {
    const update = new Uint8Array([1, 2, 3]).buffer
    const t = idbactions.createTransaction(db)
    idbactions.writeInitialRoomData(t, testname, 42, 1, new Uint8Array([0]).buffer)
    const clientConf = await idbactions.writeClientUnconfirmed(t, testname, update)
    await idbactions.writeHostUnconfirmedByClient(t, clientConf, 0)
    await idbactions.writeConfirmedByHost(t, testname, 4)
    const metas = await idbactions.getRoomMetas(t)
    const roommeta = metas.find(meta => meta.room === testname)
    if (roommeta == null || roommeta.offset !== 4 || roommeta.roomsid !== 42) {
      throw globals.error()
    }
    const data = await idbactions.getRoomData(t, testname)
    if (!test.compareArrays(new Uint8Array(data), new Uint8Array([0, 1, 2, 3]))) {
      throw globals.error()
    }
  })
})
