
# Attribution Feature

The Attribution feature extends Yjs types to provide rich metadata about content
changes, including information about who created, deleted, or formatted content.
This enables powerful collaborative editing features such as authorship tracking
and change visualization. The information about who performed which changes can
be handled by a separate CRDT (which is part of the renderer).

## Core Concepts

### Renderer

A `renderer` renders Content (with its Attributions) to a delta. It is the
central component for the attribution feature: pass it to methods like
`toDelta()` / `getDelta()` to render content together with attribution metadata.

Different implementations of Renderer are available for different use cases:
- `DiffRenderer`: Highlights the differences between two Yjs documents
- `SnapshotRenderer`: Highlights the differences between two snapshots

### Attributed Content

Attributed content includes standard Yjs operations enhanced with attribution metadata:

```javascript
// Standard content
[{ insert: 'hello world' }]

// Attributed content
[
  { insert: 'hello', attribution: { insert: ['kevin'] } },
  { insert: ' world', attribution: { insert: ['alice'] } }
]
```

### Delete Attribution

Deleted content is represented in attributed results to maintain authorship information and proper position tracking:

```javascript
// Shows deleted content with attribution
[
  { insert: 'hello ', attribution: { delete: ['kevin'] } },
  { insert: 'world' }
]
```

## API Reference

### YText

#### `getDelta([renderer])`

Returns the delta representation of the YText content, optionally with attribution information.

**Parameters:**
- `renderer` (optional): The renderer instance

**Returns:**
- Array of delta operations, with attribution metadata if `renderer` is provided

**Examples:**

```javascript
const ytext = new Y.Text()
// Content is inserted during collaborative editing
// Attribution is handled automatically by the server

// Without attribution
const delta = ytext.getDelta()
// [{ insert: 'hello world' }]

// With attribution
const attributedDelta = ytext.getDelta({ renderer })
// [
//   { insert: 'hello', attribution: { insert: ['kevin'] } },
//   { insert: ' world', attribution: { insert: ['alice'] } }
// ]
```

#### `toDelta([renderer])`

Returns the content representation with optional attribution information.

**Parameters:**
- `renderer` (optional): The renderer instance

**Returns:**
- Content representation with attribution metadata if `renderer` is provided

### YArray

#### `toDelta([renderer])`

Returns the array content with optional attribution information for each element.

**Parameters:**
- `renderer` (optional): The renderer instance

**Returns:**
- Array content with attribution metadata if `renderer` is provided

### YMap

#### `toDelta([renderer])`

Returns the map content with optional attribution information for each key-value pair.

**Parameters:**
- `renderer` (optional): The renderer instance

**Returns:**
- Map content with attribution metadata if `renderer` is provided

## Position Adjustments

When working with attributed content, position calculations must account for deleted content that appears in the attributed representation but not in the standard representation.

### Example: Position Adjustment

```javascript
// Standard content (length: 5)
ytext.toString() // "world"

// Attributed content (includes deleted content)
ytext.getDelta({ renderer })
// [
//   { insert: 'hello ', attribution: { delete: ['kevin'] } },  // positions 0-5
//   { insert: 'world' }                                         // positions 6-10
// ]

// To insert after "world":
// - Standard position: 5 (after "world")
// - Attributed position: 11 (after "world" accounting for deleted "hello ")
```

## Use Cases

Events in Yjs are enhanced to work with attributed content, automatically adjusting positions when attribution is considered.

### Event Position Adjustment

When a `renderer` is used, event positions are automatically adjusted to account for deleted content.

**Example:**

```javascript
// Initial content: "hello world"
// User deletes "hello " (positions 0-6)
// Current visible content: "world"

ytext.observe((event, transaction) => {
  // User wants to insert "!" after "world"
  
  // Standard event (without attribution)
  const standardDelta = event.getDelta()
  // Shows insertion at position 5 (after "world" in visible content)
  
  // Attributed event (with renderer)
  const attributedDelta = event.getDelta({ renderer })
  // Shows insertion at position 11 (accounting for deleted "hello ")
  // [
  //   { insert: 'hello ', attribution: { delete: ['kevin'] } },
  //   { insert: 'world' },
  //   { insert: '!' }  // inserted at attributed position 11
  // ]
})
```

## Use Cases

### Authorship Visualization

Display content with visual indicators of who created each part:

```javascript
function renderWithAuthorship(ytext, renderer) {
  const attributedDelta = ytext.getDelta({ renderer })
  
  return attributedDelta.map(op => {
    const author = op.attribution?.insert?.[0] || 'unknown'
    const isDeleted = op.attribution?.delete
    
    return {
      content: op.insert,
      author,
      isDeleted,
      className: `author-${author} ${isDeleted ? 'deleted' : ''}`
    }
  })
}
```

### Change Tracking

Track who made specific changes to content:

```javascript
function trackChanges(ytext, renderer) {
  ytext.observe((event, transaction) => {
    const changes = event.changes.getAttributedDelta?.(renderer) || event.changes.delta
    
    changes.forEach(change => {
      if (change.attribution) {
        console.log(`Change by ${change.attribution.insert?.[0] || change.attribution.delete?.[0]}:`, change)
      }
    })
  })
}
```

## Best Practices

### Renderer Lifecycle

- Create one renderer per document or collaboration session
- Ensure the renderer is consistently used across all operations
- Pass the same renderer instance to all methods that need attribution

## Migration Guide

### Upgrading Existing Code

To add attribution support to existing Yjs applications:

1. **Add renderer**: Create and configure a renderer
2. **Update method calls**: Add the renderer parameter to relevant method calls
3. **Handle attributed content**: Update code to handle the new attribution metadata format
4. **Adjust position calculations**: Update position calculations to account for deleted content

### Backward Compatibility

The Attribution feature is fully backward compatible:
- All existing methods work without the renderer parameter
- Existing code continues to work unchanged
- Attribution is opt-in and doesn't affect performance when not used
