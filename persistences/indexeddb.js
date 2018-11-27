import * as idb from '../lib/idb.js'

const bc = new BroadcastChannel('ydb-client')

idb.openDB()