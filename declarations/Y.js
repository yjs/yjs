/* @flow */

type YGlobal = {
	utils: Object;
	Struct: Object;
	AbstractDatabase: any;
}

type YInstance = {
	db: Object,
	connector: Object,
	root: Object
}

declare var YConcurrency_TestingMode : boolean

type Transaction<A> = Generator<any, A, any>