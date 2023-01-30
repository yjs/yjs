/**
 * @template T
 * @extends YEvent<YMap<T>>
 * Event that describes the changes on a YMap.
 */
export class YMapEvent<T> extends YEvent<YMap<T>> {
    /**
     * @param {YMap<T>} ymap The YArray that changed.
     * @param {Transaction} transaction
     * @param {Set<any>} subs The keys that changed.
     */
    constructor(ymap: YMap<T>, transaction: Transaction, subs: Set<any>);
    keysChanged: Set<any>;
}
/**
 * @template MapType
 * A shared Map implementation.
 *
 * @extends AbstractType<YMapEvent<MapType>>
 * @implements {Iterable<MapType>}
 */
export class YMap<MapType> extends AbstractType<YMapEvent<MapType>> implements Iterable<MapType> {
    /**
     *
     * @param {Iterable<readonly [string, any]>=} entries - an optional iterable to initialize the YMap
     */
    constructor(entries?: Iterable<readonly [string, any]> | undefined);
    /**
     * @type {Map<string,any>?}
     * @private
     */
    private _prelimContent;
    /**
     * Integrate this type into the Yjs instance.
     *
     * * Save this struct in the os
     * * This type is sent to other client
     * * Observer functions are fired
     *
     * @param {Doc} y The Yjs instance
     * @param {Item} item
     */
    _integrate(y: Doc, item: Item): void;
    _copy(): YMap<any>;
    /**
     * @return {YMap<MapType>}
     */
    clone(): YMap<MapType>;
    /**
     * Transforms this Shared Type to a JSON object.
     *
     * @return {Object<string,any>}
     */
    toJSON(): {
        [x: string]: any;
    };
    /**
     * Returns the size of the YMap (count of key/value pairs)
     *
     * @return {number}
     */
    get size(): number;
    /**
     * Returns the keys for each element in the YMap Type.
     *
     * @return {IterableIterator<string>}
     */
    keys(): IterableIterator<string>;
    /**
     * Returns the values for each element in the YMap Type.
     *
     * @return {IterableIterator<any>}
     */
    values(): IterableIterator<any>;
    /**
     * Returns an Iterator of [key, value] pairs
     *
     * @return {IterableIterator<any>}
     */
    entries(): IterableIterator<any>;
    /**
     * Executes a provided function on once on every key-value pair.
     *
     * @param {function(MapType,string,YMap<MapType>):void} f A function to execute on every element of this YArray.
     */
    forEach(f: (arg0: MapType, arg1: string, arg2: YMap<MapType>) => void): void;
    /**
     * Remove a specified element from this YMap.
     *
     * @param {string} key The key of the element to remove.
     */
    delete(key: string): void;
    /**
     * Adds or updates an element with a specified key and value.
     *
     * @param {string} key The key of the element to add to this YMap
     * @param {MapType} value The value of the element to add
     */
    set(key: string, value: MapType): MapType;
    /**
     * Returns a specified element from this YMap.
     *
     * @param {string} key
     * @return {MapType|undefined}
     */
    get(key: string): MapType | undefined;
    /**
     * Returns a boolean indicating whether the specified key exists or not.
     *
     * @param {string} key The key to test.
     * @return {boolean}
     */
    has(key: string): boolean;
    /**
     * Removes all elements from this YMap.
     */
    clear(): void;
    /**
     * Returns an Iterator of [key, value] pairs
     *
     * @return {IterableIterator<any>}
     */
    [Symbol.iterator](): IterableIterator<any>;
}
export function readYMap(decoder: UpdateDecoderV1 | UpdateDecoderV2): YMap<any>;
import { YEvent } from "../utils/YEvent.js";
import { Transaction } from "../utils/Transaction.js";
import { AbstractType } from "./AbstractType.js";
import { Doc } from "../utils/Doc.js";
import { Item } from "../structs/Item.js";
import { UpdateDecoderV1 } from "../utils/UpdateDecoder.js";
import { UpdateDecoderV2 } from "../utils/UpdateDecoder.js";
