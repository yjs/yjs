/**
 * @module provider/ydb
 */

import * as ydbclient from './YdbClient.mjs'

/**
 * @param {string} url
 * @return {Promise<ydbclient.YdbClient>}
 */
export const createYdbClient = url => ydbclient.get(url)
