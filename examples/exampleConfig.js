/* eslint-env browser */

const isDeployed = location.hostname === 'yjs.website'

if (!isDeployed) {
  console.log('%cYjs: Start your local websocket server by running %c`npm run websocket-server`', 'color:blue', 'color: grey; font-weight: bold')
}

export const serverAddress = isDeployed ? 'wss://api.yjs.website' : 'ws://localhost:1234'
