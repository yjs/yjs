
import Y from '../src/Y.js'
import yWebsocketsClient from '../../y-websockets-client/src/y-websockets-client.js'
import IndexedDBPersistence from '../../y-indexeddb/src/y-indexeddb.js'

Y.extend(yWebsocketsClient)
Y.IndexedDBPersistence = IndexedDBPersistence

export default Y
