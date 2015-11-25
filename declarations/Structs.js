/* @flow */

type UserId = string
type Id = [UserId, number]

/*
type Struct = {
  id: Id,
  left?: Id,
  right?: Id,
  target?: Id,
  struct: 'Insert' | 'Delete'
}*/
type Struct = Insertion | Deletion

type Insertion = {
  id: Id,
  left: Id,
  right: Id,
  struct: 'Insert'
}

type Deletion = {
  target: Id,
  struct: 'Delete'
}