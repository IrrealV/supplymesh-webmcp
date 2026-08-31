import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Fingerprint, type Sha256Crypto } from "./canonicalJson";

function expectCanonical(value: unknown): string {
  const result = canonicalJson(value);
  if (!result.ok) throw new Error(`Expected canonical JSON, received ${result.error.code}.`);
  return result.data;
}

describe("canonicalJson", () => {
  it("should sort object keys recursively while preserving arrays, UTF-8 text, and normalized negative zero", () => {
    const value = { zero: -0, text: "café 🚚", nested: { z: true, a: null }, array: [{ b: 2, a: 1 }, "é", -0] };

    const result = expectCanonical(value);

    expect(result).toBe('{"array":[{"a":1,"b":2},"é",0],"nested":{"a":null,"z":true},"text":"café 🚚","zero":0}');
    expect(Object.is(JSON.parse(result).zero, -0)).toBe(false);
  });

  it("should read each data property descriptor once and never invoke a changing getter", () => {
    let getterReads = 0;
    let descriptorReads = 0;
    const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => { getterReads += 1; return getterReads; } });
    const changingData = new Proxy({ value: 1 }, {
      getOwnPropertyDescriptor: (_target, key) => {
        descriptorReads += 1;
        return { configurable: true, enumerable: true, writable: true, value: key === "value" ? descriptorReads : 0 };
      },
    });

    const accessorResult = canonicalJson(accessor);
    const dataResult = canonicalJson(changingData);

    expect(accessorResult).toStrictEqual({ ok: false, error: { code: "CANONICALIZATION_FAILED", message: "The value cannot be represented as strict canonical JSON.", actions: ["CONTACT_OPERATOR"] } });
    expect(getterReads).toBe(0);
    expect(dataResult).toStrictEqual({ ok: true, data: '{"value":1}' });
    expect(descriptorReads).toBe(1);
  });

  it("should capture array length and entries once through descriptors without property gets", () => {
    const descriptorReads = new Map<PropertyKey, number>();
    let getReads = 0;
    let ownKeyReads = 0;
    const target = ["first", "second"];
    const value = new Proxy(target, {
      get: (array, key, receiver) => { getReads += 1; return Reflect.get(array, key, receiver); },
      getOwnPropertyDescriptor: (array, key) => {
        descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1);
        return Object.getOwnPropertyDescriptor(array, key);
      },
      ownKeys: (array) => { ownKeyReads += 1; return Reflect.ownKeys(array); },
    });

    const result = canonicalJson(value);

    expect(result).toStrictEqual({ ok: true, data: '["first","second"]' });
    expect(getReads).toBe(0);
    expect(ownKeyReads).toBe(1);
    expect(Object.fromEntries(descriptorReads)).toStrictEqual({ "0": 1, "1": 1, length: 1 });
  });

  it.each([
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["undefined", undefined],
    ["function", () => undefined],
    ["symbol", Symbol("unsupported")],
    ["bigint", 1n],
    ["sparse array", Array(2)],
    ["array accessor", Object.defineProperty([1], "0", { configurable: true, enumerable: true, get: () => 1 })],
    ["date", new Date("2026-08-28T09:00:00.000Z")],
    ["map", new Map([["a", 1]])],
    ["class instance", new (class Unsupported { public value = 1; })()],
    ["symbol-keyed object", { [Symbol("key")]: 1 }],
    ["non-enumerable property", Object.defineProperty({}, "hidden", { value: 1 })],
    ["array with an extra property", Object.assign([1], { extra: 2 })],
  ])("should reject unsupported %s input", (_label, value) => {
    expect(canonicalJson(value)).toStrictEqual({ ok: false, error: { code: "CANONICALIZATION_FAILED", message: "The value cannot be represented as strict canonical JSON.", actions: ["CONTACT_OPERATOR"] } });
  });

  it("should reject direct and indirect cycles without rejecting shared acyclic values", () => {
    const direct: Record<string, unknown> = {};
    direct.self = direct;
    const left: Record<string, unknown> = {};
    const right: Record<string, unknown> = { left };
    left.right = right;
    const shared = { value: 1 };

    expect(canonicalJson(direct).ok).toBe(false);
    expect(canonicalJson(left).ok).toBe(false);
    expectCanonical({ first: shared, second: shared });
  });
});

describe("sha256Fingerprint", () => {
  it("should match the known SHA-256 vector for the canonical UTF-8 JSON string", async () => {
    const result = await sha256Fingerprint("abc");

    expect(result).toStrictEqual({ ok: true, data: "sha256:6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25" });
  });

  it("should fail structurally when crypto is unavailable or rejects", async () => {
    const rejectingCrypto: Sha256Crypto = { digest: async () => { throw new Error("digest rejected"); } };

    expect(await sha256Fingerprint({ value: 1 }, null)).toStrictEqual({ ok: false, error: { code: "CRYPTO_UNAVAILABLE", message: "SHA-256 is unavailable in this browser context.", actions: ["RETRY", "CONTACT_OPERATOR"] } });
    expect(await sha256Fingerprint({ value: 1 }, rejectingCrypto)).toStrictEqual({ ok: false, error: { code: "CRYPTO_FAILURE", message: "SHA-256 could not fingerprint the recovery plan.", actions: ["RETRY", "CONTACT_OPERATOR"] } });
  });
});
