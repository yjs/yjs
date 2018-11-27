/**
 * @module provider/ydb
 */

import * as ydbclient from './YdbClient.js'

/**
 * @param {string} url
 * @return {Promise<ydbclient.YdbClient>}
 */
export const createYdbClient = url => ydbclient.get(url)
