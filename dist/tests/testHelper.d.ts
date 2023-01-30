export * from "../src/index.js";
export let useV2: boolean;
export namespace encV1 {
    const encodeStateAsUpdate: (doc: Y.Doc, encodedTargetStateVector?: Uint8Array | undefined) => Uint8Array;
    const mergeUpdates: (updates: Uint8Array[]) => Uint8Array;
    const applyUpdate: (ydoc: Y.Doc, update: Uint8Array, transactionOrigin?: any) => void;
    const logUpdate: (update: Uint8Array) => void;
    const updateEventName: string;
    const diffUpdate: (update: Uint8Array, sv: Uint8Array) => Uint8Array;
}
export namespace encV2 {
    const encodeStateAsUpdate_1: (doc: Y.Doc, encodedTargetStateVector?: Uint8Array | undefined, encoder?: import("../src/internals").UpdateEncoderV2 | Y.UpdateEncoderV1 | undefined) => Uint8Array;
    export { encodeStateAsUpdate_1 as encodeStateAsUpdate };
    const mergeUpdates_1: (updates: Uint8Array[], YDecoder?: typeof import("../src/internals").UpdateDecoderV1 | typeof import("../src/internals").UpdateDecoderV2 | undefined, YEncoder?: typeof import("../src/internals").UpdateEncoderV2 | typeof Y.UpdateEncoderV1 | undefined) => Uint8Array;
    export { mergeUpdates_1 as mergeUpdates };
    const applyUpdate_1: (ydoc: Y.Doc, update: Uint8Array, transactionOrigin?: any, YDecoder?: typeof import("../src/internals").UpdateDecoderV1 | typeof import("../src/internals").UpdateDecoderV2 | undefined) => void;
    export { applyUpdate_1 as applyUpdate };
    const logUpdate_1: (update: Uint8Array, YDecoder?: typeof import("../src/internals").UpdateDecoderV1 | typeof import("../src/internals").UpdateDecoderV2 | undefined) => void;
    export { logUpdate_1 as logUpdate };
    const updateEventName_1: string;
    export { updateEventName_1 as updateEventName };
    const diffUpdate_1: (update: Uint8Array, sv: Uint8Array, YDecoder?: typeof import("../src/internals").UpdateDecoderV1 | typeof import("../src/internals").UpdateDecoderV2 | undefined, YEncoder?: typeof import("../src/internals").UpdateEncoderV2 | typeof Y.UpdateEncoderV1 | undefined) => Uint8Array;
    export { diffUpdate_1 as diffUpdate };
}
export namespace enc { }
export class TestYInstance extends Y.Doc {
    /**
     * @param {TestConnector} testConnector
     * @param {number} clientID
     */
    constructor(testConnector: TestConnector, clientID: number);
    userID: number;
    /**
     * @type {TestConnector}
     */
    tc: TestConnector;
    /**
     * @type {Map<TestYInstance, Array<Uint8Array>>}
     */
    receiving: Map<TestYInstance, Array<Uint8Array>>;
    /**
     * The list of received updates.
     * We are going to merge them later using Y.mergeUpdates and check if the resulting document is correct.
     * @type {Array<Uint8Array>}
     */
    updates: Array<Uint8Array>;
    /**
     * Disconnect from TestConnector.
     */
    disconnect(): void;
    /**
     * Append yourself to the list of known Y instances in testconnector.
     * Also initiate sync with all clients.
     */
    connect(): void;
    /**
     * Receive a message from another client. This message is only appended to the list of receiving messages.
     * TestConnector decides when this client actually reads this message.
     *
     * @param {Uint8Array} message
     * @param {TestYInstance} remoteClient
     */
    _receive(message: Uint8Array, remoteClient: TestYInstance): void;
}
/**
 * Keeps track of TestYInstances.
 *
 * The TestYInstances add/remove themselves from the list of connections maiained in this object.
 * I think it makes sense. Deal with it.
 */
export class TestConnector {
    /**
     * @param {prng.PRNG} gen
     */
    constructor(gen: prng.PRNG);
    /**
     * @type {Set<TestYInstance>}
     */
    allConns: Set<TestYInstance>;
    /**
     * @type {Set<TestYInstance>}
     */
    onlineConns: Set<TestYInstance>;
    /**
     * @type {prng.PRNG}
     */
    prng: prng.PRNG;
    /**
     * Create a new Y instance and add it to the list of connections
     * @param {number} clientID
     */
    createY(clientID: number): TestYInstance;
    /**
     * Choose random connection and flush a random message from a random sender.
     *
     * If this function was unable to flush a message, because there are no more messages to flush, it returns false. true otherwise.
     * @return {boolean}
     */
    flushRandomMessage(): boolean;
    /**
     * @return {boolean} True iff this function actually flushed something
     */
    flushAllMessages(): boolean;
    reconnectAll(): void;
    disconnectAll(): void;
    syncAll(): void;
    /**
     * @return {boolean} Whether it was possible to disconnect a randon connection.
     */
    disconnectRandom(): boolean;
    /**
     * @return {boolean} Whether it was possible to reconnect a random connection.
     */
    reconnectRandom(): boolean;
}
export function init<T>(tc: t.TestCase, { users }?: {
    users?: number;
}, initTestObject?: InitTestObjectCallback<T> | undefined): {
    testObjects: Array<any>;
    testConnector: TestConnector;
    users: Array<TestYInstance>;
    array0: Y.Array<any>;
    array1: Y.Array<any>;
    array2: Y.Array<any>;
    map0: Y.Map<any>;
    map1: Y.Map<any>;
    map2: Y.Map<any>;
    map3: Y.Map<any>;
    text0: Y.Text;
    text1: Y.Text;
    text2: Y.Text;
    xml0: Y.XmlElement;
    xml1: Y.XmlElement;
    xml2: Y.XmlElement;
};
export function compare(users: Array<TestYInstance>): void;
export function compareItemIDs(a: Y.Item | null, b: Y.Item | null): boolean;
export function compareStructStores(ss1: import('../src/internals').StructStore, ss2: import('../src/internals').StructStore): undefined;
export function compareDS(ds1: import('../src/internals').DeleteSet, ds2: import('../src/internals').DeleteSet): void;
export function applyRandomTests<T>(tc: t.TestCase, mods: ((arg0: Y.Doc, arg1: prng.PRNG, arg2: T) => void)[], iterations: number, initTestObject?: InitTestObjectCallback<T> | undefined): {
    testObjects: Array<any>;
    testConnector: TestConnector;
    users: Array<TestYInstance>;
    array0: Y.Array<any>;
    array1: Y.Array<any>;
    array2: Y.Array<any>;
    map0: Y.Map<any>;
    map1: Y.Map<any>;
    map2: Y.Map<any>;
    map3: Y.Map<any>;
    text0: Y.Text;
    text1: Y.Text;
    text2: Y.Text;
    xml0: Y.XmlElement;
    xml1: Y.XmlElement;
    xml2: Y.XmlElement;
};
export type InitTestObjectCallback<T> = (y: TestYInstance) => T;
import * as Y from "../src/index.js";
import * as prng from "lib0/prng";
import * as t from "lib0/testing";
