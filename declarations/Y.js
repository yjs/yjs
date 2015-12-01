/* @flow */

type YGlobal = {
	utils: Object,
	Struct: any,
	AbstractDatabase: any,
	AbstractConnector: any,
	Transaction: any
}

type YConfig = {
	db: Object,
	connector: Object,
	root: Object
}

type TypeName = 'array' | 'map' | 'text'

declare var YConcurrency_TestingMode : boolean

type Transaction<A> = Generator<any, A, any>

type SyncRole = 'master' | 'slave'

declare class Store {
	find: (id:Id) => Transaction<any>;
	put: (n:any) => Transaction<void>;
	delete: (id:Id) => Transaction<void>;
	findWithLowerBound: (start:Id) => Transaction<any>;
	findWithUpperBound: (end:Id) => Transaction<any>;
	findNext: (id:Id) => Transaction<any>;
	findPrev: (id:Id) => Transaction<any>;
	iterate: (t:any,start:?Id,end:?Id,gen:any) => Transaction<any>;
}