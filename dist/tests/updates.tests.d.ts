export function testMergeUpdates(tc: t.TestCase): void;
export function testKeyEncoding(tc: t.TestCase): void;
export function testMergeUpdates1(tc: t.TestCase): void;
export function testMergeUpdates2(tc: t.TestCase): void;
export function testMergePendingUpdates(tc: t.TestCase): void;
export type Enc = {
    mergeUpdates: (arg0: Array<Uint8Array>) => Uint8Array;
    encodeStateAsUpdate: (arg0: Y.Doc) => Uint8Array;
    applyUpdate: (arg0: Y.Doc, arg1: Uint8Array) => void;
    logUpdate: (arg0: Uint8Array) => void;
    parseUpdateMeta: (arg0: Uint8Array) => {
        from: Map<number, number>;
        to: Map<number, number>;
    };
    encodeStateVector: (arg0: Y.Doc) => Uint8Array;
    encodeStateVectorFromUpdate: (arg0: Uint8Array) => Uint8Array;
    updateEventName: string;
    description: string;
    diffUpdate: (arg0: Uint8Array, arg1: Uint8Array) => Uint8Array;
};
import * as t from "lib0/testing";
import * as Y from "../src/index.js";
