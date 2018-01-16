
import Y from '../src/Y.js'
import yWebsocketsClient from '../../y-websockets-client/src/y-websockets-client.js'
import extendYIndexedDBPersistence from '../../y-indexeddb/src/y-indexeddb.js'

Y.extend(yWebsocketsClient)
extendYIndexedDBPersistence(Y)

export default Y
