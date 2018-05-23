
import Y from '../src/Y..mjs'
import yWebsocketsClient from '../../y-websockets-client/src/y-websockets-client.mjs'
import extendYIndexedDBPersistence from '../../y-indexeddb/src/y-indexeddb.mjs'

Y.extend(yWebsocketsClient)
extendYIndexedDBPersistence(Y)

export default Y
