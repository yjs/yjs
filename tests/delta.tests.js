import * as t from 'lib0/testing'
import * as delta from '../src/utils/Delta.js'
import * as Y from 'yjs'
import * as schema from 'lib0/schema'

/**
 * @param {t.TestCase} _tc
 */
export const testDelta = _tc => {
  const d = delta.createTextDelta().insert('hello').insert(' ').useAttributes({ bold: true }).insert('world').useAttribution({ insert: ['tester'] }).insert('!').done()
  t.compare(d.toJSON(), [{ insert: 'hello ' }, { insert: 'world', attributes: { bold: true } }, { insert: '!', attributes: { bold: true }, attribution: { insert: ['tester'] } }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeltaMerging = _tc => {
  const d = delta.createTextDelta()
    .insert('hello')
    .insert('world')
    .insert(' ', { italic: true })
    .insert({})
    .insert([1])
    .insert([2])
    .done()
  t.compare(d.toJSON(), [{ insert: 'helloworld' }, { insert: ' ', attributes: { italic: true } }, { insert: {} }, { insert: [1, 2] }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testUseAttributes = _tc => {
  const d = delta.createTextDelta()
    .insert('a')
    .updateUsedAttributes('bold', true)
    .insert('b')
    .insert('c', { bold: 4 })
    .updateUsedAttributes('bold', null)
    .insert('d')
    .useAttributes({ italic: true })
    .insert('e')
    .useAttributes(null)
    .insert('f')
    .done()
  const d2 = delta.createTextDelta()
    .insert('a')
    .insert('b', { bold: true })
    .insert('c', { bold: 4 })
    .insert('d')
    .insert('e', { italic: true })
    .insert('f')
    .done()
  t.compare(d, d2)
}

/**
 * @param {t.TestCase} _tc
 */
export const testUseAttribution = _tc => {
  const d = delta.createTextDelta()
    .insert('a')
    .updateUsedAttribution('insert', ['me'])
    .insert('b')
    .insert('c', null, { insert: ['you'] })
    .updateUsedAttribution('insert', null)
    .insert('d')
    .useAttribution({ insert: ['me'] })
    .insert('e')
    .useAttribution(null)
    .insert('f')
    .done()
  const d2 = delta.createTextDelta()
    .insert('a')
    .insert('b', null, { insert: ['me'] })
    .insert('c', null, { insert: ['you'] })
    .insert('d')
    .insert('e', null, { insert: ['me'] })
    .insert('f')
    .done()
  t.compare(d, d2)
}

/**
 * @param {t.TestCase} _tc
 */
export const testMapDelta = _tc => {
  const d = /** @type {delta.MapDeltaBuilder<{ key: string, v: number, over: string }>} */ (delta.createMapDelta())
  d.set('key', 'value')
    .useAttribution({ delete: ['me'] })
    .delete('v', 94)
    .useAttribution(null)
    .set('over', 'andout', 'i existed before')
    .done()
  t.compare(d.toJSON(), {
    key: { type: 'insert', value: 'value', prevValue: undefined, attribution: null },
    v: { type: 'delete', prevValue: 94, attribution: { delete: ['me'] } },
    over: { type: 'insert', value: 'andout', prevValue: 'i existed before', attribution: null }
  })
  t.compare(d.origin, null)
  t.compare(d.remote, false)
  t.compare(d.isDiff, true)
  d.forEach((change, key) => {
    if (key === 'v') {
      t.assert(d.get(key)?.prevValue === 94) // should know that value is number
      t.assert(change.prevValue === 94)
    } else if (key === 'key') {
      t.assert(d.get(key)?.value === 'value') // show know that value is a string
      t.assert(change.value === 'value')
    } else if (key === 'over') {
      t.assert(change.value === 'andout')
    } else {
      throw new Error()
    }
  })
  for (const [key, change] of d) {
    if (key === 'v') {
      t.assert(d.get(key)?.prevValue === 94)
      t.assert(change.prevValue === 94) // should know that value is number
    } else if (key === 'key') {
      t.assert(change.value === 'value') // should know that value is string
    } else if (key === 'over') {
      t.assert(change.value === 'andout')
    } else {
      throw new Error()
    }
  }
}

/**
 * @param {t.TestCase} _tc
 */
export const testXmlDelta = _tc => {
  const d = /** @type {delta.XmlDelta<string, string, { a: 1 }>} */ (delta.createXmlDelta())
  d.children.insert(['hi'])
  d.attributes.set('a', 1)
  d.attributes.delete('a', 1)
  /**
   * @type {Array<Array<string>| number>}
   */
  const arr = []
  d.children.forEach(
    (op, index) => {
      if (op instanceof delta.InsertArrayOp) {
        arr.push(op.insert, index)
      }
    },
    (op, index) => {
      arr.push(op.insert, index)
    },
    (op, _index) => {
      arr.push(op.retain)
    },
    (op, _index) => {
      arr.push(op.delete)
    }
  )
  t.compare(arr, [['hi'], 0, ['hi'], 0])
  const x = d.done()
  console.log(x)
}

const textDeltaSchema = schema.object({
  ops: schema.array(
    schema.any
  )
})

/**
 * @param {t.TestCase} _tc
 */
export const testTextModifyingDelta = _tc => {
  const d = /** @type {delta.TextDelta<Y.Map<any>|Y.Array<any>,undefined>} */ (delta.createTextDelta().insert('hi').insert(new Y.Map()).done())
  schema.assert(d, textDeltaSchema)
  console.log(d)
}

/**
 * @param {t.TestCase} _tc
 */
export const testYtypeDeltaTypings = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  {
    const yarray = /** @type {Y.Array<Y.Text|number>} */ (ydoc.getArray('numbers'))
    const content = yarray.getContent()
    content.forEach(
      op => {
        schema.union(
          schema.constructedBy(delta.InsertArrayOp),
          schema.constructedBy(delta.RetainOp),
          schema.constructedBy(delta.DeleteOp)
        ).ensure(op)
      },
      op => {
        schema.constructedBy(delta.InsertArrayOp).ensure(op)
      },
      op => {
        schema.constructedBy(delta.RetainOp).ensure(op)
      },
      op => {
        schema.constructedBy(delta.DeleteOp).ensure(op)
      }
    )
    const cdeep = yarray.getContentDeep()
    cdeep.forEach(
      op => {
        schema.union(
          schema.constructedBy(delta.InsertArrayOp),
          schema.constructedBy(delta.RetainOp),
          schema.constructedBy(delta.DeleteOp),
          schema.constructedBy(delta.ModifyOp)
        ).ensure(op)
      },
      op => {
        schema.constructedBy(delta.InsertArrayOp).ensure(op)
      },
      op => {
        schema.constructedBy(delta.RetainOp).ensure(op)
      },
      op => {
        schema.constructedBy(delta.DeleteOp).ensure(op)
      },
      op => {
        schema.constructedBy(delta.ModifyOp).ensure(op)
      }
    )
  }
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
