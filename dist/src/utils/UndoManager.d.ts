/**
 * @typedef {Object} UndoManagerOptions
 * @property {number} [UndoManagerOptions.captureTimeout=500]
 * @property {function(Transaction):boolean} [UndoManagerOptions.captureTransaction] Do not capture changes of a Transaction if result false.
 * @property {function(Item):boolean} [UndoManagerOptions.deleteFilter=()=>true] Sometimes
 * it is necessary to filter what an Undo/Redo operation can delete. If this
 * filter returns false, the type/item won't be deleted even it is in the
 * undo/redo scope.
 * @property {Set<any>} [UndoManagerOptions.trackedOrigins=new Set([null])]
 * @property {boolean} [ignoreRemoteMapChanges] Experimental. By default, the UndoManager will never overwrite remote changes. Enable this property to enable overwriting remote changes on key-value changes (Y.Map, properties on Y.Xml, etc..).
 * @property {Doc} [doc] The document that this UndoManager operates on. Only needed if typeScope is empty.
 */
/**
 * Fires 'stack-item-added' event when a stack item was added to either the undo- or
 * the redo-stack. You may store additional stack information via the
 * metadata property on `event.stackItem.meta` (it is a `Map` of metadata properties).
 * Fires 'stack-item-popped' event when a stack item was popped from either the
 * undo- or the redo-stack. You may restore the saved stack information from `event.stackItem.meta`.
 *
 * @extends {Observable<'stack-item-added'|'stack-item-popped'|'stack-cleared'|'stack-item-updated'>}
 */
export class UndoManager extends Observable<"stack-item-added" | "stack-item-popped" | "stack-cleared" | "stack-item-updated"> {
    /**
     * @param {AbstractType<any>|Array<AbstractType<any>>} typeScope Accepts either a single type, or an array of types
     * @param {UndoManagerOptions} options
     */
    constructor(typeScope: AbstractType<any> | Array<AbstractType<any>>, { captureTimeout, captureTransaction, deleteFilter, trackedOrigins, ignoreRemoteMapChanges, doc }?: UndoManagerOptions);
    /**
     * @type {Array<AbstractType<any>>}
     */
    scope: Array<AbstractType<any>>;
    deleteFilter: (arg0: Item) => boolean;
    trackedOrigins: Set<any>;
    captureTransaction: (arg0: Transaction) => boolean;
    /**
     * @type {Array<StackItem>}
     */
    undoStack: Array<StackItem>;
    /**
     * @type {Array<StackItem>}
     */
    redoStack: Array<StackItem>;
    /**
     * Whether the client is currently undoing (calling UndoManager.undo)
     *
     * @type {boolean}
     */
    undoing: boolean;
    redoing: boolean;
    doc: Doc;
    lastChange: number;
    ignoreRemoteMapChanges: boolean;
    captureTimeout: number;
    /**
     * @param {Transaction} transaction
     */
    afterTransactionHandler: (transaction: Transaction) => void;
    /**
     * @param {Array<AbstractType<any>> | AbstractType<any>} ytypes
     */
    addToScope(ytypes: Array<AbstractType<any>> | AbstractType<any>): void;
    /**
     * @param {any} origin
     */
    addTrackedOrigin(origin: any): void;
    /**
     * @param {any} origin
     */
    removeTrackedOrigin(origin: any): void;
    clear(clearUndoStack?: boolean, clearRedoStack?: boolean): void;
    /**
     * UndoManager merges Undo-StackItem if they are created within time-gap
     * smaller than `options.captureTimeout`. Call `um.stopCapturing()` so that the next
     * StackItem won't be merged.
     *
     *
     * @example
     *     // without stopCapturing
     *     ytext.insert(0, 'a')
     *     ytext.insert(1, 'b')
     *     um.undo()
     *     ytext.toString() // => '' (note that 'ab' was removed)
     *     // with stopCapturing
     *     ytext.insert(0, 'a')
     *     um.stopCapturing()
     *     ytext.insert(0, 'b')
     *     um.undo()
     *     ytext.toString() // => 'a' (note that only 'b' was removed)
     *
     */
    stopCapturing(): void;
    /**
     * Undo last changes on type.
     *
     * @return {StackItem?} Returns StackItem if a change was applied
     */
    undo(): StackItem | null;
    /**
     * Redo last undo operation.
     *
     * @return {StackItem?} Returns StackItem if a change was applied
     */
    redo(): StackItem | null;
    /**
     * Are undo steps available?
     *
     * @return {boolean} `true` if undo is possible
     */
    canUndo(): boolean;
    /**
     * Are redo steps available?
     *
     * @return {boolean} `true` if redo is possible
     */
    canRedo(): boolean;
}
export type UndoManagerOptions = {
    captureTimeout?: number | undefined;
    /**
     * Do not capture changes of a Transaction if result false.
     */
    captureTransaction?: ((arg0: Transaction) => boolean) | undefined;
    /**
     * Sometimes
     * it is necessary to filter what an Undo/Redo operation can delete. If this
     * filter returns false, the type/item won't be deleted even it is in the
     * undo/redo scope.
     */
    deleteFilter?: ((arg0: Item) => boolean) | undefined;
    trackedOrigins?: Set<any> | undefined;
    /**
     * Experimental. By default, the UndoManager will never overwrite remote changes. Enable this property to enable overwriting remote changes on key-value changes (Y.Map, properties on Y.Xml, etc..).
     */
    ignoreRemoteMapChanges?: boolean | undefined;
    /**
     * The document that this UndoManager operates on. Only needed if typeScope is empty.
     */
    doc?: Doc | undefined;
};
import { Observable } from "lib0/observable";
import { AbstractType } from "../types/AbstractType.js";
import { Item } from "../structs/Item.js";
import { Transaction } from "./Transaction.js";
declare class StackItem {
    /**
     * @param {DeleteSet} deletions
     * @param {DeleteSet} insertions
     */
    constructor(deletions: DeleteSet, insertions: DeleteSet);
    insertions: DeleteSet;
    deletions: DeleteSet;
    /**
     * Use this to save and restore metadata like selection range
     */
    meta: Map<any, any>;
}
import { Doc } from "./Doc.js";
import { DeleteSet } from "./DeleteSet.js";
export {};
