
# Attribution Feature

The Attribution feature extends Yjs types to provide rich metadata about content
changes, including information about who created, deleted, or formatted content.
This enables powerful collaborative editing features such as authorship tracking
and change visualization. The information about who performed which changes can
be handled by a separate CRDT (which is part of the attribution manager).

## Core Concepts

### Attribution Manager

The `attributionManager` is the central component that tracks and manages
attribution data. It must be passed to methods that support attribution to
enable the feature.

Different implementations of AttributionManager are available for different use cases:
- `DiffingAttributionManager`: Highlights the differences between two Yjs documents
- `SnapshotAttributionManager`: Highlights the differences between two snapshots

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

#### `getDelta([attributionManager])`

Returns the delta representation of the YText content, optionally with attribution information.

**Parameters:**
- `attributionManager` (optional): The attribution manager instance

**Returns:**
- Array of delta operations, with attribution metadata if `attributionManager` is provided

**Examples:**

```javascript
const ytext = new Y.Text()
// Content is inserted during collaborative editing
// Attribution is handled automatically by the server

// Without attribution
const delta = ytext.getDelta()
// [{ insert: 'hello world' }]

// With attribution
const attributedDelta = ytext.getDelta(attributionManager)
// [
//   { insert: 'hello', attribution: { insert: ['kevin'] } },
//   { insert: ' world', attribution: { insert: ['alice'] } }
// ]
```

#### `toDelta([attributionManager])`

Returns the content representation with optional attribution information.

**Parameters:**
- `toDelta` (optional): The attribution manager instance

**Returns:**
- Content representation with attribution metadata if `attributionManager` is provided

### YArray

#### `toDelta([attributionManager])`

Returns the array content with optional attribution information for each element.

**Parameters:**
- `attributionManager` (optional): The attribution manager instance

**Returns:**
- Array content with attribution metadata if `attributionManager` is provided

### YMap

#### `toDelta([attributionManager])`

Returns the map content with optional attribution information for each key-value pair.

**Parameters:**
- `attributionManager` (optional): The attribution manager instance

**Returns:**
- Map content with attribution metadata if `attributionManager` is provided

## Position Adjustments

When working with attributed content, position calculations must account for deleted content that appears in the attributed representation but not in the standard representation.

### Example: Position Adjustment

```javascript
// Standard content (length: 5)
ytext.toString() // "world"

// Attributed content (includes deleted content)
ytext.getDelta(attributionManager)
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

When an `attributionManager` is used, event positions are automatically adjusted to account for deleted content.

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
  
  // Attributed event (with attribution manager)
  const attributedDelta = event.getDelta(attributionManager)
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
function renderWithAuthorship(ytext, attributionManager) {
  const attributedDelta = ytext.getDelta(attributionManager)
  
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
function trackChanges(ytext, attributionManager) {
  ytext.observe((event, transaction) => {
    const changes = event.changes.getAttributedDelta?.(attributionManager) || event.changes.delta
    
    changes.forEach(change => {
      if (change.attribution) {
        console.log(`Change by ${change.attribution.insert?.[0] || change.attribution.delete?.[0]}:`, change)
      }
    })
  })
}
```

## Best Practices

### Attribution Manager Lifecycle

- Create one attribution manager per document or collaboration session
- Ensure the attribution manager is consistently used across all operations
- Pass the same attribution manager instance to all methods that need attribution

## Migration Guide

### Upgrading Existing Code

To add attribution support to existing Yjs applications:

1. **Add attribution manager**: Create and configure an attribution manager
2. **Update method calls**: Add the attribution manager parameter to relevant method calls
3. **Handle attributed content**: Update code to handle the new attribution metadata format
4. **Adjust position calculations**: Update position calculations to account for deleted content

### Backward Compatibility

The Attribution feature is fully backward compatible:
- All existing methods work without the attribution manager parameter
- Existing code continues to work unchanged
- Attribution is opt-in and doesn't affect performance when not used
