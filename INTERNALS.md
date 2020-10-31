# Yjs Internals

This document roughly explains how Yjs works internally. There is a complete
walkthrough of the Yjs codebase available as a recording:
https://youtu.be/0l5XgnQ6rB4

The Yjs CRDT algorithm is described in the [YATA
paper](https://www.researchgate.net/publication/310212186_Near_Real-Time_Peer-to-Peer_Shared_Editing_on_Extensible_Data_Types)
from 2016. For an algorithmic view of how it works, the paper is a reasonable
place to start. There are a handful of small improvements implemented in Yjs
which aren't described in the paper. The most notable is that items have an
`originRight` as well as an `origin` property, which improves performance when
many concurrent inserts happen after the same character.

At its heart, Yjs is a list CRDT. Everything is squeezed into a list in order to
reuse the CRDT resolution algorithm:

- Arrays are easy - they're lists of arbitrary items.
- Text is a list of characters, optionally punctuated by formatting markers and
  embeds for rich text support. Several characters can be wrapped in a single
linked list `Item` (this is also known as the compound representation of
CRDTs). More information about this in [this blog
article](https://blog.kevinjahns.de/are-crdts-suitable-for-shared-editing/).
- Maps are lists of entries. The last inserted entry for each key is used, and
  all other duplicates for each key are flagged as deleted.

Each client is assigned a unique *clientID* property on first insert. This is a
random 53-bit integer (53 bits because that fits in the javascript safe integer
range).

## List items

Each item in a Yjs list is made up of two objects:

- An `Item` (*src/structs/Item.js*). This is used to relate the item to other
  adjacent items.
- An object in the `AbstractType` heirachy (subclasses of
  *src/types/AbstractType.js* - eg `YText`). This stores the actual content in
the Yjs document.

The item and type object pair have a 1-1 mapping. The item's `content` field
references the AbstractType object and the AbstractType object's `_item` field
references the item.

Everything inserted in a Yjs document is given a unique ID, formed from a
*ID(clientID, clock)* pair (also known as a [Lamport
Timestamp](https://en.wikipedia.org/wiki/Lamport_timestamp)). The clock counts
up from 0 with the first inserted character or item a client makes. This is
similar to automerge's operation IDs, but note that the clock is only
incremented by inserts. Deletes are handled in a very different way (see
below).

If a run of characters is inserted into a document (eg `"abc"`), the clock will
be incremented for each character (eg 3 times here). But Yjs will only add a
single `Item` into the list. This has no effect on the core CRDT algorithm, but
the optimization dramatically decreases the number of javascript objects
created during normal text editing. This optimization only applies if the
characters share the same clientID, they're inserted in order, and all
characters have either been deleted or all characters are not deleted. The item
will be split if the run is interrupted for any reason (eg a character in the
middle of the run is deleted).

When an item is created, it stores a reference to the IDs of the preceeding and
succeeding item. These are stored in the item's `origin` and `originRight`
fields, respectively. These are used when peers concurrently insert at the same
location in a document. Though quite rare in practice, Yjs needs to make sure
the list items always resolve to the same order on all peers. The actual logic
is relatively simple - its only a couple dozen lines of code and it lives in
the `Item#integrate()` method. The YATA paper has much more detail on the this
algorithm.

### Item Storage

The items themselves are stored in two data structures and a cache:

- The items are stored in a tree of doubly-linked lists in *document order*.
  Each item has `left` and `right` properties linking to its siblings in the
document. Items also have a `parent` property to reference their parent in the
document tree (null at the root). (And you can access an item's children, if
any, through `item.content`).
- All items are referenced in *insertion order* inside the struct store
  (*src/utils/StructStore.js*). This references the list of items inserted by
for each client, in chronological order. This is used to find an item in the
tree with a given ID (using a binary search). It is also used to efficiently
gather the operations a peer is missing during sync (more on this below).

When a local insert happens, Yjs needs to map the insert position in the
document (eg position 1000) to an ID. With just the linked list, this would
require a slow O(n) linear scan of the list. But when editing a document, most
inserts are either at the same position as the last insert, or nearby. To
improve performance, Yjs stores a cache of the 10 most recently looked up
insert positions in the document. This is consulted and updated when a position
is looked up to improve performance in the average case. The cache is updated
using a heuristic that is still changing (currently, it is updated when a new
position significantly diverges from existing markers in the cache). Internally
this is referred to as the skip list / fast search marker.

### Deletions

Deletions in Yjs are treated very differently from insertions. Insertions are
implemented as a sequential operation based CRDT, but deletions are treated as
a simpler state based CRDT.

When an item has been deleted by any peer, at any point in history, it is
flagged as deleted on the item. (Internally Yjs uses the `info` bitfield.) Yjs
does not record metadata about a deletion:

- No data is kept on *when* an item was deleted, or which user deleted it.
- The struct store does not contain deletion records
- The clientID's clock is not incremented

If garbage collection is enabled in Yjs, when an object is deleted its content
is discarded. If a deleted object contains children (eg a field is deleted in
an object), the content is replaced with a `GC` object (*src/structs/GC.js*).
This is a very lightweight structure - it only stores the length of the removed
content.

Yjs has some special logic to share which content in a document has been
deleted:

- When a delete happens, as well as marking the item, the deleted IDs are
  listed locally within the transaction. (See below for more information about
transactions.) When a transaction has been committed locally, the set of
deleted items is appended to a transaction's update message.
- A snapshot (a marked point in time in the Yjs history) is specified using
  both the set of (clientID, clock) pairs *and* the set of all deleted item
IDs. The deleted set is O(n), but because deletions usually happen in runs,
this data set is usually tiny in practice. (The real world editing trace from
the B4 benchmark document contains 182k inserts and 77k deleted characters. The
deleted set size in a snapshot is only 4.5Kb).

## Transactions

All updates in Yjs happen within a *transaction*. (Defined in
*src/utils/Transaction.js*.)

The transaction collects a set of updates to the Yjs document to be applied on
remote peers atomically. Once a transaction has been committed locally, it
generates a compressed *update message* which is broadcast to synchronized
remote peers to notify them of the local change. The update message contains:

- The set of newly inserted items
- The set of items deleted within the transaction.

## Network protocol

The network protocol is not really a part of Yjs. There are a few relevant
concepts that can be used to create a custom network protocol:

* `update`: The Yjs document can be encoded to an *update* object that can be
  parsed to reconstruct the document. Also every change on the document fires
an incremental document updates that allows clients to sync with each other.
The update object is an Uint8Array that efficiently encodes `Item` objects and
the delete set.
* `state vector`: A state vector defines the know state of each user (a set of
  tubles `(client, clock)`). This object is also efficiently encoded as a
Uint8Array.

The client can ask a remote client for missing document updates by sending
their state vector (often referred to as *sync step 1*). The remote peer can
compute the missing `Item` objects using the `clocks` of the respective clients
and compute a minimal update message that reflects all missing updates (sync
step 2).

An implementation of the syncing process is in
[y-protocols](https://github.com/yjs/y-protocols).

## Snapshots

A snapshot can be used to restore an old document state. It is a `state vector`
+ `delete set`. I client can restore an old document state by iterating through
the sequence CRDT and ignoring all Items that have an `id.clock >
stateVector[id.client].clock`. Instead of using `item.deleted` the client will
use the delete set to find out if an item was deleted or not.

It is not recommended to restore an old document state using snapshots,
although that would certainly be possible. Instead, the old state should be
computed by iterating through the newest state and using the additional
information from the state vector.
