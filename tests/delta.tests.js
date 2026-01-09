import * as Y from '../src/index.js'
import * as delta from 'lib0/delta'
import * as t from 'lib0/testing'
import * as s from 'lib0/schema'

/**
 * Delta is a versatile format enabling you to efficiently describe changes. It is part of lib0, so
 * that non-yjs applications can use it without consuming the full Yjs package. It is well suited
 * for efficiently describing state & changesets.
 *
 * Assume we start with the text "hello world". Now we want to delete " world" and add an
 * exclamation mark. The final content should be "hello!" ("hello world" => "hello!")
 *
 * In most editors, you would describe the necessary changes as replace operations using indexes.
 * However, this might become ambiguous when many changes are involved.
 *
 * - delete range 5-11
 * - insert "!" at position 11
 *
 * Using the delta format, you can describe the changes similar to what you would do in an text editor.
 * The "|" describes the current cursor position.
 *
 * - d.retain(5) - "|hello world" => "hello| world" - jump over the next five characters
 * - d.delete(6) - "hello| world" => "hello|" - delete the next 6 characres
 * - d.insert('!') - "hello!|" - insert "!" at the current position
 * => compact form: d.retain(5).delete(6).insert('!')
 *
 * You can also apply the changes in two distinct steps and then rebase the op so that you can apply
 * them in two distinct steps.
 * - delete " world":              d1 = delta.create().retain(5).delete(6)
 * - insert "!":                   d2 = delta.create().retain(11).insert('!')
 * - rebase d2 on-top of d1:       d2.rebase(d1)    == delta.create().retain(5).insert('!')
 * - merge into a single change:   d1.apply(d2)     == delta.create().retain(5).delete(6).insert(!)
 *
 * @param {t.TestCase} _tc
 */
export const testDeltaBasics = _tc => {
  // the state of our text document
  const state = delta.create().insert('hello world')
  // describe changes: delete " world" & insert "!"
  const change = delta.create().retain(5).delete(6).insert('!')
  // apply changes to state
  state.apply(change)
  // compare state to expected state
  t.assert(state.equals(delta.create().insert('hello!')))
}

/**
 * lib0 also ships a schema library that can be used to validate JSON objects and custom data types,
 * like Yjs types.
 *
 * As a convention, schemas are usually prefixed with a $ sign. This clarifies the difference
 * between a schema, and an instance of a schema.
 *
 * const $myobj = s.$object({ key: s.$number })
 * let inputValue: any
 * if ($myobj.check(inputValue)) {
 *   inputValue // is validated and of type $myobj
 * }
 *
 * We can also define the expected values on a delta.
 *
 * @param {t.TestCase} _tc
 */
export const testDeltaBasicSchema = _tc => {
  const $d = delta.$delta({ attrs: { key: s.$string }, children: s.$number, text: false })
  const d = delta.create($d)
  // @ts-expect-error
  d.setAttr('key', false) // invalid change: will throw a type error
  t.fails(() => {
    // @ts-expect-error
    d.apply(delta.create().setAttr('key', false)) // invalid delta: will throw a type error
  })
}

/**
 * Deltas can describe changes on attributes and children. Textual insertions are children. But we
 * may also insert json-objects and other deltas as children.
 * Key-value pairs can be represented as attributes. This "convoluted" changeset enables us to
 * describe many changes in the same breath:
 *
 * delta.create().setAttr('a', 42).retain(5).delete(6).insert('!').deleteAttr('b')
 *
 * @param {t.TestCase} _tc
 */
export const testDeltaValues = _tc => {
  const change = delta.create().setAttr('a', 42).deleteAttr('b').retain(5).delete(6).insert('!').insert([{ my: 'custom object' }])
  // iterate through attribute changes
  for (const attrChange of change.attrs) {
    if (delta.$insertOp.check(attrChange)) {
      console.log(`set ${attrChange.key} to ${attrChange.value}`)
    } else if (delta.$deleteOp.check(attrChange)) {
      console.log(`delete ${attrChange.key}`)
    }
  }
  // iterate through child changes
  for (const childChange of change.children) {
    if (delta.$retainOp.check(childChange)) {
      console.log(`retain ${childChange.retain} child items`)
    } else if (delta.$deleteOp.check(childChange)) {
      console.log(`delete ${childChange.delete} child items`)
    } else if (delta.$insertOp.check(childChange)) {
      console.log('insert child items:', childChange.insert)
    } else if (delta.$textOp.check(childChange)) {
      console.log('insert textual content', childChange.insert)
    }
  }
}

/**
 * The new delta defines changes on attributes (key-value) and child elements (list & text), but can
 * also be used to describe the current state of a document.
 *
 * 1. apply a delta to change a yjs type
 * 2. observe deltas to read the differences
 * 3. merge deltas to reflect multiple changes in a single delta
 * 4. All Yjs types fully support the delta format. It is no longer necessary to define the type (such as Y.Array)
 *
 * @param {t.TestCase} _tc
 */
export const testBasics = _tc => {
  const ydoc = new Y.Doc()
  const ytype = ydoc.get('my data')
  /**
   * @type {delta.Delta<{attrs: { a: number }, children: { my: string }, text: true }>}
   */
  let observedDelta = delta.create()
  ytype.observe(event => {
    observedDelta = event.deltaDeep
    console.log('ytype changed:', observedDelta.toJSON())
  })
  // define a change: set attribute: a=42
  const attrChange = delta.create().setAttr('a', 42).done()
  // define a change: insert textual content and an object
  const childChange = delta.create().insert('hello').insert([{ my: 'object' }]).done()
  // merge changes
  const mergedChanges = delta.create(delta.$deltaAny).apply(attrChange).apply(childChange).done()
  console.log('merged changes: ', mergedChanges.toJSON())
  ytype.applyDelta(mergedChanges)
  // the observed change should equal the applied change
  t.assert(observedDelta.equals(mergedChanges))
  // read the current state of the yjs types as a delta
  const currState = ytype.getContentDeep()
  t.assert(currState.equals(mergedChanges)) // equal to the changes that we applied
}

/**
 * Deltas allow us to describe the differences between two Yjs documents though "Attributions".
 *
 * - We can attribute changes to a user, or a group of users
 * - There are 'insert', 'delete', and 'format' attributions
 * - When we render attributions, we render inserted & deleted content as an insertions with special
 *   attributes which allow you to..
 * -- Render deleted content using a strikethrough: I.e. `hello w̶o̶r̶l̶d̶!`
 * -- Render attributed insertions using a background color.
 *
 * @param {t.TestCase} _tc
 */
export const testAttributions = _tc => {
  const ydocV1 = new Y.Doc()
  const ytypeV1 = ydocV1.get('txt')
  ytypeV1.applyDelta(delta.create().insert('hello world'))
  // create a new version with updated content
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(ydocV1))
  const ytype = ydoc.get('txt')
  // delete " world" and insert exclamation mark "!".
  ytype.applyDelta(delta.create().retain(5).delete(6).insert('!'))
  const am = Y.createAttributionManagerFromDiff(ydocV1, ydoc)
  // get the attributed differences
  const attributedContent = ytype.getContent(am)
  console.log('attributed content', attributedContent.toJSON())
  t.assert(attributedContent.equals(delta.create().insert('hello').insert(' world', null, { delete: [] }).insert('!', null, { insert: [] })))
  // for editor bindings, it is also necessary to observe changes and get the attributed changes
  ytype.observe(event => {
    const attributedChange = event.getDelta(am)
    console.log('the attributed change', attributedChange.toJSON())
    t.assert(attributedChange.done().equals(delta.create().retain(11).insert('!', null, { insert: [] })))
    const unattributedChange = event.delta
    console.log('the UNattributed change', unattributedChange.toJSON())
    t.assert(unattributedChange.equals(delta.create().retain(5).insert('!')))
  })
  /**
   * Content now has different representations.
   * - The UNattributed representation renders the latest state, without history.
   * - The attributed representation renders the differences.
   *
   * Attributed: 'hello<delete> world</delete><insert>!</insert>'
   * UNattributed: 'world!'
   */
  // Apply a change to the attributed content
  ytype.applyDelta(delta.create().retain(11).insert('!'), am)
  // // Equivalent to applying a change to the UNattributed content:
  // ytype.applyDelta(delta.create().retain(5).insert('!'))
}
