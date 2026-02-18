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
  const currState = ytype.toDeltaDeep()
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
  const attributedContent = ytype.toDelta(am)
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

/**
 * @param {t.TestCase} _tc
 */
export const testRetainBasic = _tc => {
  // Test basic retain operation - retain content without applying any attributes
  const d = delta.createTextDelta()
    .insert('hello world')
    .retain(5) 
    .done() // The last retain operation without attributes will be cleaned up
  t.compare(d.toJSON(), [
    { insert: 'hello world' }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainWithAttributes = _tc => {
  // Test retain operation with formatting attributes
  const d = delta.createTextDelta()
    .insert('hello world')
    .retain(5, { bold: true, italic: true })
    .done()
  t.compare(d.toJSON(), [
    { insert: 'hello world' },
    { retain: 5, attributes: { bold: true, italic: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainWithAttribution = _tc => {
  // Test retain operation with attribution information
  const d = delta.createTextDelta()
    .insert('hello world')
    .retain(5, null, { insert: ['user1'] })
    .done()
  t.compare(d.toJSON(), [
    { insert: 'hello world' },
    { retain: 5, attribution: { insert: ['user1'] } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainWithAttributesAndAttribution = _tc => {
  // Test retain operation with both formatting attributes and attribution information
  const d = delta.createTextDelta()
    .insert('hello world')
    .retain(5, { bold: true }, { insert: ['user1'] })
    .done()
  t.compare(d.toJSON(), [
    { insert: 'hello world' },
    { retain: 5, attributes: { bold: true }, attribution: { insert: ['user1'] } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainMerging = _tc => {
  // Test that consecutive retain operations with same attributes are merged
  const d = delta.createTextDelta()
    .insert('hello world')
    .retain(3, { bold: true })
    .retain(2, { bold: true }) // Same attributes, should be merged
    .retain(1, { italic: true }) // Different attributes, should not be merged
    .done()
  t.compare(d.toJSON(), [
    { insert: 'hello world' },
    { retain: 5, attributes: { bold: true } },
    { retain: 1, attributes: { italic: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainComplexScenario = _tc => {
  // Test complex retain scenarios - simulating text editor operations
  const d = delta.createTextDelta()
    .insert('Hello, this is a test document.')
    .retain(6, { bold: true }) // Set "Hello," to bold
    .retain(5) // Skip " this"
    .retain(4, { italic: true }) // Set "is a" to italic
    .retain(1) // Skip space
    .retain(4, { bold: true, italic: true }) // Set "test" to bold italic
    .retain(10) // Skip remaining content
    .done()
  t.compare(d.toJSON(), [
    { insert: 'Hello, this is a test document.' },
    { retain: 6, attributes: { bold: true } },
    { retain: 5 },
    { retain: 4, attributes: { italic: true } },
    { retain: 1 },
    { retain: 4, attributes: { bold: true, italic: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainInArrayDelta = _tc => {
  // Test using retain in array Delta
  const d = delta.createArrayDelta()
    .insert(['a', 'b', 'c', 'd', 'e'])
    .retain(2) // Retain first two elements
    .retain(1, { highlight: true }) // Add highlight attribute to third element
    .retain(2) // Retain last two elements
    .done()
  t.compare(d.toJSON(), [
    { insert: ['a', 'b', 'c', 'd', 'e'] },
    { retain: 2 },
    { retain: 1, attributes: { highlight: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRetainAfterDelete = _tc => {
  // Test using retain after delete operation
  const d = delta.createTextDelta()
    .insert('hello world')
    .delete(5) // Delete "hello"
    .retain(5, { bold: true }) // Apply bold to remaining "world"
    .done()
  t.compare(d.toJSON(), [
    { insert: 'hello world' },
    { delete: 5 },
    { retain: 5, attributes: { bold: true } }
  ])
}

/**
 * @param {t.TestCase} _tc
 */
export const testFromJson = _tc => {
  // Test creating Delta from JSON operations
  const jsonOps = [
    { insert: 'hello' },
    { insert: ' ', attributes: { bold: true } },
    { insert: 'world', attributes: { bold: true, italic: true } },
    { retain: 5, attributes: { color: 'red' } },
    { delete: 3 }
  ]
  
  const d = delta.fromJSON(jsonOps, 'text')
  
  // Verify the created Delta has the correct structure
  t.compare(d.toJSON(), jsonOps)
  
  // Test that the Delta can be used for iteration
  let totalCallCount = 0
  let insertCount = 0
  let retainCount = 0
  let deleteCount = 0
  
  d.forEach(
    (op) => {
      totalCallCount++
    },
    (op) => {
      insertCount++
    },
    (op) => {
      retainCount++
    },
    (op) => {
      deleteCount++
    }
  )
  t.compare(totalCallCount, 5)   // 5 calls
  t.compare(insertCount, 3)      // 3 insert operations
  t.compare(retainCount, 1)      // 1 retain operation
  t.compare(deleteCount, 1)      // 1 delete operation
}

/**
 * @param {t.TestCase} _tc
 */
export const testFromJsonWithAttribution = _tc => {
  // Test creating Delta from JSON with attribution information
  const jsonOps = [
    { insert: 'hello', attribution: { insert: ['user1'] } },
    { retain: 5, attributes: { bold: true }, attribution: { insert: ['user2'] } },
    { delete: 3 }
  ]
  
  const d = delta.fromJSON(jsonOps, 'text')
  
  // Verify the created Delta preserves attribution
  t.compare(d.toJSON(), jsonOps)
  
  // Test that attribution is properly handled
  const result = d.toJSON()
  t.compare(/** @type {any} */ (result[0]).attribution, { insert: ['user1'] })
  t.compare(/** @type {any} */ (result[1]).attribution, { insert: ['user2'] })
}

/**
 * @param {t.TestCase} _tc
 */
export const testFromJsonArrayDelta = _tc => {
  // Test creating Array Delta from JSON
  const jsonOps = [
    { insert: ['a', 'b', 'c'] },
    { retain: 2, attributes: { highlight: true } },
    { delete: 1 }
  ]
  
  const d = delta.fromJSON(jsonOps, 'array')
  
  // Verify the created Array Delta
  t.compare(d.toJSON(), jsonOps)
  
  // Test that it's an array delta
  t.assert(d.type === 'array')
}

/**
 * @param {t.TestCase} _tc
 */
export const testFromJsonComplexScenario = _tc => {
  // Test creating Delta from complex JSON scenario
  const jsonOps = [
    { insert: 'Hello, ' },
    { insert: 'this is a ', attributes: { bold: true } },
    { insert: 'test', attributes: { bold: true, italic: true } },
    { insert: ' document.', attributes: { bold: true } },
    { retain: 6, attributes: { color: 'blue' } },
    { retain: 5 },
    { retain: 4, attributes: { underline: true } },
    { delete: 2 } // delete operation is not counted
  ]
  
  const d = delta.fromJSON(jsonOps, 'text')
  
  // Verify the complex Delta structure
  t.compare(d.toJSON(), jsonOps)
  
  // Test that all operations are properly reconstructed
  let totalLength = 0
  let insertLength = 0
  let retainLength = 0
  let deleteLength = 0

  d.forEach(
    (op) => {
      totalLength += op.length
    },
    (op) => {
      insertLength += op.length
    },
    (op) => {
      retainLength += op.length
    },
    (op) => {
      deleteLength += op.length
    }
  )
  
  // Calculate expected length: "Hello, this is a test document.".length = 31; 31 + 6 + 5 + 4 = 46 characters
  t.compare(totalLength, 46)
  t.compare(insertLength, 31)
  t.compare(retainLength, 15)
  t.compare(deleteLength, 0)
}
