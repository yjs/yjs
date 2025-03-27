/**
 * This file serves to validate the public TypeScript API for YJS.
 *
 * It is not included in `npm run lint` or any other automated type checking, but can be used
 * by those working on YJS types to ensure that the public-facing type interface remains valid.
 *
 * Any lines which are supposed to demonstrate statements that _would_ generate type errors
 * should be clearly marked with the type error that is expected to result, to provide a
 * negative test case.
 */

import * as Y from "../dist/src/index";

/*
 * Typed maps
 *
 * - Key names are autocompleted in first parameter of `get` and `set`.
 * - `MapType` value types are constrained to valid Y.Map contents.
 */
type MyType = {
  foo: string;
  bar: number | null;
  baz?: boolean;
};

// Constructor argument keys & values are typechecked, and keys are autocompleted.
// Multiple items for each key and partial initialization are allowed.
const map = new Y.Map<MyType>([
  ["foo", ""],
  ["foo", "even better"],
  // ERROR: Type '["baz", number]' is not assignable to type '["foo", string] | ["bar", number | null] | ["baz", boolean | undefined]'.
  ["baz", 3],
]);

// Entries are still allowed to be omitted, so get() still returns <type> | undefined.
const defaultMap = new Y.Map<MyType>();

// `json` has a type of `Partial<MyType>`
const json = defaultMap.toJSON();

// string | undefined
const fooValue = map.get("foo");
// literal "hi" (string)
const fooSet = map.set("foo", "hi");
// number | null | undefined
const barValue = map.get("bar");
// ERROR: Argument of type '"hi"' is not assignable to parameter of type 'number | null'.
const barSet = map.set("bar", "hi");
// ERROR: Argument of type '"bomb"' is not assignable to parameter of type 'keyof MyType'.
const missingGet = map.get("bomb");
// Escape hatch: get<any>()
const migrateGet = map.get<any>("extraneousKey");

// ERROR: Type '<type>' does not satisfy the constraint 'Record<string, MapValue>'.
const invalidMap = new Y.Map<{ invalid: () => void }>();
const invalidMap2 = new Y.Map<{ invalid: Blob }>();
// Arbitrarily complex valid types are still allowed
type ComplexType = {
  n: null;
  b: boolean;
  s: string;
  i: number;
  u: Uint8Array;
  a: null | boolean | string | number | Uint8Array[];
};
const complexValidType = new Y.Map<
  ComplexType & { nested: ComplexType & { deeper: ComplexType[] } }
>();

/*
 * Default behavior
 *
 * Provides basic typechecking over the range of possible map values.
 */
const untyped = new Y.Map();

// MapValue | undefined
const boop = untyped.get("default");
// Still validates value types: ERROR: Argument of type '() => string' is not assignable to parameter of type 'MapValue'.
const moop = untyped.set("anything", () => "whoops");

/*
 * `any` maps (bypass typechecking)
 */
const anyMap = new Y.Map<any>();

// any
const fooValueAny = anyMap.get("foo");
// literal "hi" (string)
const fooSetAny = anyMap.set("foo", "hi");
// Allowed because `any` unlocks cowboy mode
const barSetAny = anyMap.set("bar", () => "hi");
