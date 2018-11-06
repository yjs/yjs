
# Prosemirror Example

### Run basic websockets server

```sh
node /provider/websocket/server.js
```

### Bundle Prosemirror Example

This example requires external modules and needs to be bundled before shipping it to the browser.

```sh
cd /examples/prosemirror/
# bundle prosemirror example
npx rollup -wc
# serve example
npx serve .
```

