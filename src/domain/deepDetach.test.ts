import { describe, expect, it } from "vitest";
import { deepDetachAndFreeze } from "./deepDetach";

describe("deepDetachAndFreeze", () => {
  it("should detach and recursively freeze plain objects and arrays", () => {
    const source = { geometry: { coordinates: [[1, 2], [3, 4]] }, checks: [{ status: "PASS" }] };

    const result = deepDetachAndFreeze(source);
    if (!result.ok) throw new Error("Expected detached data.");
    source.geometry.coordinates[0][0] = 99;

    expect(result.data.geometry.coordinates[0][0]).toBe(1);
    expect(Object.isFrozen(result.data)).toBe(true);
    expect(Object.isFrozen(result.data.geometry)).toBe(true);
    expect(Object.isFrozen(result.data.geometry.coordinates)).toBe(true);
    expect(Object.isFrozen(result.data.geometry.coordinates[0])).toBe(true);
    expect(Object.isFrozen(result.data.checks[0])).toBe(true);
    expect(Reflect.set(result.data.geometry.coordinates[0], "0", 77)).toBe(false);
  });

  it("should structurally reject cycles, accessors, sparse arrays, unsupported values, and non-plain objects", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const accessor = {};
    Object.defineProperty(accessor, "value", { enumerable: true, get: () => 1 });
    const sparse = Array(2);
    sparse[0] = "present";

    expect(deepDetachAndFreeze(cyclic)).toStrictEqual({ ok: false, reason: "MALFORMED_VALUE" });
    expect(deepDetachAndFreeze(accessor)).toStrictEqual({ ok: false, reason: "MALFORMED_VALUE" });
    expect(deepDetachAndFreeze(sparse)).toStrictEqual({ ok: false, reason: "MALFORMED_VALUE" });
    expect(deepDetachAndFreeze({ value: undefined })).toStrictEqual({ ok: false, reason: "MALFORMED_VALUE" });
    expect(deepDetachAndFreeze(new Date(0))).toStrictEqual({ ok: false, reason: "MALFORMED_VALUE" });
  });
});
