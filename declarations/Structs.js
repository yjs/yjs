/* @flow */

type UserId = string
type Id = [UserId, number|string]

/*
type Struct = {
  id: Id,
  left?: Id,
  right?: Id,
  target?: Id,
  struct: 'Insert' | 'Delete'
}*/

type Struct = Insertion | Deletion
type Operation = Struct

type Insertion = {
  id: Id,
  left: ?Id,
  origin: ?Id,
  right: ?Id,
  parent: Id,
  parentSub: ?Id,
  opContent: ?Id,
  content: ?any,
  struct: 'Insert'
}

type Deletion = {
  target: Id,
  struct: 'Delete'
}

type MapStruct = {
  id: Id,
  type: TypeNames,
  map: any
}

type ListStruct = {
  id: Id,
  type: TypeNames,
  start: Id,
  end: Id
}


type MessageSyncStep1 = {
  type: 'sync step 1',
  deleteSet: any,
  stateSet: any
}

type MessageSyncStep2 = {
  type: 'sync step 2',
  os: Array<Operation>,
  deleteSet: any,
  stateSet: any
}

type MessageUpdate = {
  type: 'update',
  ops: Array<Operation>
}

type MessageSyncDone = {
  type: 'sync done'
}

type Message = MessageSyncStep1 | MessageSyncStep2 | MessageUpdate | MessageSyncDone

