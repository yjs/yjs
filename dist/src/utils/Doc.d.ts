export const generateNewClientId: typeof random.uint32;
/**
 * @typedef {Object} DocOpts
 * @property {boolean} [DocOpts.gc=true] Disable garbage collection (default: gc=true)
 * @property {function(Item):boolean} [DocOpts.gcFilter] Will be called before an Item is garbage collected. Return false to keep the Item.
 * @property {string} [DocOpts.guid] Define a globally unique identifier for this document
 * @property {string | null} [DocOpts.collectionid] Associate this document with a collection. This only plays a role if your provider has a concept of collection.
 * @property {any} [DocOpts.meta] Any kind of meta information you want to associate with this document. If this is a subdocument, remote peers will store the meta information as well.
 * @property {boolean} [DocOpts.autoLoad] If a subdocument, automatically load document. If this is a subdocument, remote peers will load the document as well automatically.
 * @property {boolean} [DocOpts.shouldLoad] Whether the document should be synced by the provider now. This is toggled to true when you call ydoc.load()
 */
/**
 * A Yjs instance handles the state of shared data.
 * @extends Observable<string>
 */
export class Doc extends Observable<string> {
    /**
     * @param {DocOpts} opts configuration
     */
    constructor({ guid, collectionid, gc, gcFilter, meta, autoLoad, shouldLoad }?: DocOpts);
    gc: boolean;
    gcFilter: (arg0: Item) => boolean;
    clientID: number;
    guid: string;
    collectionid: string | null;
    /**
     * @type {Map<string, AbstractType<YEvent<any>>>}
     */
    share: Map<string, AbstractType<YEvent<any>>>;
    store: StructStore;
    /**
     * @type {Transaction | null}
     */
    _transaction: Transaction | null;
    /**
     * @type {Array<Transaction>}
     */
    _transactionCleanups: Array<Transaction>;
    /**
     * @type {Set<Doc>}
     */
    subdocs: Set<Doc>;
    /**
     * If this document is a subdocument - a document integrated into another document - then _item is defined.
     * @type {Item?}
     */
    _item: Item | null;
    shouldLoad: boolean;
    autoLoad: boolean;
    meta: any;
    /**
     * This is set to true when the persistence provider loaded the document from the database or when the `sync` event fires.
     * Note that not all providers implement this feature. Provider authors are encouraged to fire the `load` event when the doc content is loaded from the database.
     *
     * @type {boolean}
     */
    isLoaded: boolean;
    /**
     * This is set to true when the connection provider has successfully synced with a backend.
     * Note that when using peer-to-peer providers this event may not provide very useful.
     * Also note that not all providers implement this feature. Provider authors are encouraged to fire
     * the `sync` event when the doc has been synced (with `true` as a parameter) or if connection is
     * lost (with false as a parameter).
     */
    isSynced: boolean;
    /**
     * Promise that resolves once the document has been loaded from a presistence provider.
     */
    whenLoaded: Promise<any>;
    whenSynced: Promise<any>;
    /**
     * Notify the parent document that you request to load data into this subdocument (if it is a subdocument).
     *
     * `load()` might be used in the future to request any provider to load the most current data.
     *
     * It is safe to call `load()` multiple times.
     */
    load(): void;
    getSubdocs(): Set<Doc>;
    getSubdocGuids(): Set<string>;
    /**
     * Changes that happen inside of a transaction are bundled. This means that
     * the observer fires _after_ the transaction is finished and that all changes
     * that happened inside of the transaction are sent as one message to the
     * other peers.
     *
     * @template T
     * @param {function(Transaction):T} f The function that should be executed as a transaction
     * @param {any} [origin] Origin of who started the transaction. Will be stored on transaction.origin
     * @return T
     *
     * @public
     */
    public transact<T>(f: (arg0: Transaction) => T, origin?: any): T;
    /**
     * Define a shared data type.
     *
     * Multiple calls of `y.get(name, TypeConstructor)` yield the same result
     * and do not overwrite each other. I.e.
     * `y.define(name, Y.Array) === y.define(name, Y.Array)`
     *
     * After this method is called, the type is also available on `y.share.get(name)`.
     *
     * *Best Practices:*
     * Define all types right after the Yjs instance is created and store them in a separate object.
     * Also use the typed methods `getText(name)`, `getArray(name)`, ..
     *
     * @example
     *   const y = new Y(..)
     *   const appState = {
     *     document: y.getText('document')
     *     comments: y.getArray('comments')
     *   }
     *
     * @param {string} name
     * @param {Function} TypeConstructor The constructor of the type definition. E.g. Y.Text, Y.Array, Y.Map, ...
     * @return {AbstractType<any>} The created type. Constructed with TypeConstructor
     *
     * @public
     */
    public get(name: string, TypeConstructor?: Function): AbstractType<any>;
    /**
     * @template T
     * @param {string} [name]
     * @return {YArray<T>}
     *
     * @public
     */
    public getArray<T_1>(name?: string | undefined): YArray<T_1>;
    /**
     * @param {string} [name]
     * @return {YText}
     *
     * @public
     */
    public getText(name?: string | undefined): YText;
    /**
     * @template T
     * @param {string} [name]
     * @return {YMap<T>}
     *
     * @public
     */
    public getMap<T_2>(name?: string | undefined): YMap<T_2>;
    /**
     * @param {string} [name]
     * @return {YXmlFragment}
     *
     * @public
     */
    public getXmlFragment(name?: string | undefined): YXmlFragment;
    /**
     * Converts the entire document into a js object, recursively traversing each yjs type
     * Doesn't log types that have not been defined (using ydoc.getType(..)).
     *
     * @deprecated Do not use this method and rather call toJSON directly on the shared types.
     *
     * @return {Object<string, any>}
     */
    toJSON(): {
        [x: string]: any;
    };
    /**
     * @param {string} eventName
     * @param {function(...any):any} f
     */
    on(eventName: string, f: (...args: any[]) => any): void;
}
export type DocOpts = {
    /**
     * Disable garbage collection (default: gc=true)
     */
    gc?: boolean | undefined;
    /**
     * Will be called before an Item is garbage collected. Return false to keep the Item.
     */
    gcFilter?: ((arg0: Item) => boolean) | undefined;
    /**
     * Define a globally unique identifier for this document
     */
    guid?: string | undefined;
    /**
     * Associate this document with a collection. This only plays a role if your provider has a concept of collection.
     */
    collectionid?: string | null | undefined;
    /**
     * Any kind of meta information you want to associate with this document. If this is a subdocument, remote peers will store the meta information as well.
     */
    meta?: any;
    /**
     * If a subdocument, automatically load document. If this is a subdocument, remote peers will load the document as well automatically.
     */
    autoLoad?: boolean | undefined;
    /**
     * Whether the document should be synced by the provider now. This is toggled to true when you call ydoc.load()
     */
    shouldLoad?: boolean | undefined;
};
import * as random from "lib0/random";
import { Observable } from "lib0/observable";
import { Item } from "../structs/Item.js";
import { AbstractType } from "../types/AbstractType.js";
import { YEvent } from "./YEvent.js";
import { StructStore } from "./StructStore.js";
import { Transaction } from "./Transaction.js";
import { YArray } from "../types/YArray.js";
import { YText } from "../types/YText.js";
import { YMap } from "../types/YMap.js";
import { YXmlFragment } from "../types/YXmlFragment.js";
//# sourceMappingURL=Doc.d.ts.map