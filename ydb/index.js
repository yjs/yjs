import * as ydbclient from './ydb-client.js'

/**
 * @param {string} url
 * @return {Promise<ydbclient.YdbClient>}
 */
export const createYdbClient = url => ydbclient.get(url)
