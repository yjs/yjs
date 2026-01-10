# IdSets and IdMaps

`IdSet` is a data structure (formerly `DeleteSet`) that allows us to efficiently
represent ranges of ids in Yjs (all content is identifyable by ids).

`IdMap` is a new data structure that allows us to efficiently map ids to
attributes. It can be efficiently encoded.

We can perform all usual set operations on `IdMap`s and `IdSet`s: diff, merge,
intersect.

# Attribution of content

In order to implement a Google Docs-like versioning feature, we want to be able
to attribute content with additional information (who created the change,
when was this change created, ..).

When we click on a version in Google Docs, we might get annotated changes like
this:

```
# E.g. If Bob appends "world" to the previous version "hello "
[{ insert: 'hello' }, { insert: 'world', color: 'blue', creator: 'Bob', when: 'yesterday' }]
# E.g. If Bob deletes "world" from the previous version "hello world"
[{ insert: 'hello' }, { insert: 'world', backgroundColor: 'red', creator: 'Bob', when: 'yesterday' }]
```

In Yjs, we can now "attribute" changes with additional information. When we
render content using methods like `toString()` or `getDelta()`, Yjs will render
the unattributed content as-is, but it will render the attributed content with
the additional information. As all changes in Yjs are identifyable by Ids, we
can use `IdMap`s to map changes to "attributions". For example, we could
attribute deletions and insertions of a change and render them:

```js
// We create some initial content "Hello World!". Then we create another
// document that will have a bunch of changes (make "Hell" italic, replace "World"
// with "Attribution").
const ydocVersion0 = new Y.Doc({ gc: false })
ydocVersion0.getText().insert(0, 'Hello World!')
const ydoc = new Y.Doc({ gc: false })
Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(ydocVersion0))
const ytext = ydoc.getText()
ytext.applyDelta([{ retain: 4, attributes: { italic: true } }, { retain: 2 }, { delete: 5 }, { insert: 'attributions' }])
// this represents to all insertions of ydoc
const insertionSet = Y.createInsertionSetFromStructStore(ydoc.store)
const deleteSet = Y.createDeleteSetFromStructStore(ydoc.store)
// exclude the changes from `ydocVersion0`
const insertionSetDiff = Y.diffIdSet(insertionSet, Y.createInsertionSetFromStructStore(ydocVersion0.store))
const deleteSetDiff = Y.diffIdSet(deleteSet, Y.createDeleteSetFromStructStore(ydocVersion0.store))
// assign attributes to the diff
const attributedInsertions = createIdMapFromIdSet(insertionSetDiff, [new Y.Attribution('insert', 'Bob')])
const attributedDeletions = createIdMapFromIdSet(deleteSetDiff, [new Y.Attribution('delete', 'Bob')])
// now we can define an attribution manager that maps these changes to output. One of the
// implementations is the TwosetAttributionManager
const attributionManager = new TwosetAttributionManager(attributedInsertions, attributedDeletions)
// we render the attributed content with the attributionManager
let attributedContent = ytext.toDelta(attributionManager)
console.log(JSON.stringify(attributedContent.toJSON().ops, null, 2))
let expectedContent = delta.create().insert('Hell', { italic: true }, { attributes: { italic: ['Bob'] } }).insert('o ').insert('World', {}, { delete: ['Bob'] }).insert('attributions', {}, { insert: ['Bob'] }).insert('!')
t.assert(attributedContent.equals(expectedContent))

// this is how the output would look like
const output = [
  {
    "insert": "Hell",
    "attributes": {
      "italic": true
    },
    "attribution": {                // no "insert" attribution: the insertion "Hell" is not attributed to anyone
      "attributes": {
        "italic": [                 // the attribute "italic" was added by Bob
          "Bob"
        ]
      }
    }
  },
  {
    "insert": "o "                  // the insertion "o " has no attributions
  },
  {
    "insert": "World",
    "attribution": {                // the insertion "World" was deleted by Bob
      "delete": [
        "Bob"
      ]
    }
  },
  {
    "insert": "attributions",       // the insertion "attributions" was inserted by Bob
    "attribution": {
      "insert": [
        "Bob"
      ]
    }
  },
  {
    "insert": "!"                   // the insertion "!" has no attributions
  }
]
```

We get a similar output to Google Docs: Insertions, Deletions, and changes to
formatting (attributes) are clearly associated to users. It will be the job of
the editor to render those changes with background-color etc..

Of course, we could associated changes also to multiple users like this:

```js
const attributedDeletions = createIdMapFromIdSet(deleteSetDiff, [new Y.Attribution('insert', 'Bob'), new Y.Attribution('insert', 'OpenAI o3')])
```

You could use the same output to calculate a real diff as well (consisting of
deletions and insertions only, without Attributions). 

`AttributionManager` is an abstract class for mapping attributions. It is
possible to highlight arbitrary content with this approach. 

The AttributionManager is encodes very efficiently. The ids are encoded using
run-length encoding and the Attributes are de-duplicated and only encoded once.
The above example encodes in 20 bytes.
