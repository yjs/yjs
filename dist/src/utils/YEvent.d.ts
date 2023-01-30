/**
 * @template {AbstractType<any>} T
 * YEvent describes the changes on a YType.
 */
export class YEvent<T extends AbstractType<any>> {
    /**
     * @param {T} target The changed type.
     * @param {Transaction} transaction
     */
    constructor(target: T, transaction: Transaction);
    /**
     * The type on which this event was created on.
     * @type {T}
     */
    target: T;
    /**
     * The current target on which the observe callback is called.
     * @type {AbstractType<any>}
     */
    currentTarget: AbstractType<any>;
    /**
     * The transaction that triggered this event.
     * @type {Transaction}
     */
    transaction: Transaction;
    /**
     * @type {Object|null}
     */
    _changes: Object | null;
    /**
     * @type {null | Map<string, { action: 'add' | 'update' | 'delete', oldValue: any, newValue: any }>}
     */
    _keys: Map<string, {
        action: 'add' | 'update' | 'delete';
        oldValue: any;
        newValue: any;
    }> | null;
    /**
     * @type {null | Array<{ insert?: string | Array<any> | object | AbstractType<any>, retain?: number, delete?: number, attributes?: Object<string, any> }>}
     */
    _delta: {
        insert?: string | object | any[] | AbstractType<any> | undefined;
        retain?: number | undefined;
        delete?: number | undefined;
        attributes?: {
            [x: string]: any;
        } | undefined;
    }[] | null;
    /**
     * Computes the path from `y` to the changed type.
     *
     * @todo v14 should standardize on path: Array<{parent, index}> because that is easier to work with.
     *
     * The following property holds:
     * @example
     *   let type = y
     *   event.path.forEach(dir => {
     *     type = type.get(dir)
     *   })
     *   type === event.target // => true
     */
    get path(): (string | number)[];
    /**
     * Check if a struct is deleted by this event.
     *
     * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
     *
     * @param {AbstractStruct} struct
     * @return {boolean}
     */
    deletes(struct: AbstractStruct): boolean;
    /**
     * @type {Map<string, { action: 'add' | 'update' | 'delete', oldValue: any, newValue: any }>}
     */
    get keys(): Map<string, {
        action: 'add' | 'update' | 'delete';
        oldValue: any;
        newValue: any;
    }>;
    /**
     * @type {Array<{insert?: string | Array<any> | object | AbstractType<any>, retain?: number, delete?: number, attributes?: Object<string, any>}>}
     */
    get delta(): {
        insert?: string | object | any[] | AbstractType<any> | undefined;
        retain?: number | undefined;
        delete?: number | undefined;
        attributes?: {
            [x: string]: any;
        } | undefined;
    }[];
    /**
     * Check if a struct is added by this event.
     *
     * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
     *
     * @param {AbstractStruct} struct
     * @return {boolean}
     */
    adds(struct: AbstractStruct): boolean;
    /**
     * @type {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert?:Array<any>|string, delete?:number, retain?:number}>}}
     */
    get changes(): {
        added: Set<Item>;
        deleted: Set<Item>;
        keys: Map<string, {
            action: 'add' | 'update' | 'delete';
            oldValue: any;
        }>;
        delta: Array<{
            insert?: Array<any> | string;
            delete?: number;
            retain?: number;
        }>;
    };
}
import { AbstractType } from "../types/AbstractType.js";
import { Transaction } from "./Transaction.js";
import { AbstractStruct } from "../structs/AbstractStruct.js";
import { Item } from "../structs/Item.js";
