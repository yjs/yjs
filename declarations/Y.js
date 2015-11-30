/* @flow */

type YGlobal = {
	utils: Object;
	Struct: Object;
	AbstractDatabase: any;
	AbstractConnector: any;
}

type YConfig = {
	db: Object,
	connector: Object,
	root: Object
}

declare var YConcurrency_TestingMode : boolean

type Transaction<A> = Generator<any, A, any>

type SyncRole = 'master' | 'slave'