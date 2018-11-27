import { test } from 'cutest'
import * as random from '../lib/prng/prng.js'
import * as Y from '../index.js'

import { prosemirrorPlugin } from '../bindings/prosemirror.js'
import {EditorState} from 'prosemirror-state'
import {EditorView} from 'prosemirror-view'
import {schema} from 'prosemirror-schema-basic'
import {exampleSetup} from 'prosemirror-example-setup'

const createNewProsemirrorView = y => {
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({
      schema,
      plugins: exampleSetup({schema}).concat([prosemirrorPlugin(y.define('prosemirror', Y.XmlFragment))])
    })
  })
  return view
}

test('random prosemirror insertions', async t => {
  const gen = random.createPRNG(t.getSeed())
  const y = new Y.Y()
  const p1 = createNewProsemirrorView(y)
  const p2 = createNewProsemirrorView(y)
  for (let i = 0; i < 10; i++) {
    const p = random.oneOf(gen, [p1, p2])
    const insertPos = random.int32(gen, 0, p.state.doc.content.size)
    const overwrite = random.int32(gen, 0, p.state.doc.content.size - insertPos)
    p.dispatch(p.state.tr.insertText('' + i, insertPos, insertPos + overwrite))
  }
  t.compare(
    p1.state.doc.toJSON(),
    p2.state.doc.toJSON(),
    'compare prosemirror models'
  )
})
