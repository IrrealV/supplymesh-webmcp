import { RecoveryErrorCodes, recoveryFailure, recoverySuccess, type RecoveryResult } from "./recoveryContracts";

export type JsonPrimitive = string | number | boolean | null;
export type CanonicalJsonValue = JsonPrimitive | readonly CanonicalJsonValue[] | { readonly [key: string]: CanonicalJsonValue };
export type Sha256Crypto = Readonly<{ digest(bytes: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> }>;

type Canonicalization = Readonly<{ ok: true; value: string }> | Readonly<{ ok: false }>;

function quoted(value: string): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("A JSON string could not be serialized.");
  }
  return serialized;
}

function canonicalizeArray(value: unknown[], active: WeakSet<object>): Canonicalization {
  let keys: (string | symbol)[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    keys = Reflect.ownKeys(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return { ok: false };
  }
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
    return { ok: false };
  }
  const length = lengthDescriptor.value as number;
  if (keys.length !== length + 1 || !keys.includes("length") || keys.some((key) => {
    if (key === "length") return false;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return true;
    const index = Number(key);
    return !Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key;
  })) return { ok: false };

  const entries: string[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      return { ok: false };
    }
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return { ok: false };
    }
    const entry = canonicalize(descriptor.value, active);
    if (!entry.ok) {
      return entry;
    }
    entries.push(entry.value);
  }
  return { ok: true, value: `[${entries.join(",")}]` };
}

function canonicalizeObject(value: object, active: WeakSet<object>): Canonicalization {
  let prototype: object | null;
  let keys: (string | symbol)[];
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return { ok: false };
  }
  if ((prototype !== Object.prototype && prototype !== null) || keys.some((key) => typeof key === "symbol")) {
    return { ok: false };
  }

  const stringKeys = (keys as string[]).sort();
  const entries: string[] = [];
  for (const key of stringKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return { ok: false };
    }
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return { ok: false };
    }
    const entry = canonicalize(descriptor.value, active);
    if (!entry.ok) {
      return entry;
    }
    entries.push(`${quoted(key)}:${entry.value}`);
  }
  return { ok: true, value: `{${entries.join(",")}}` };
}

function canonicalize(value: unknown, active: WeakSet<object>): Canonicalization {
  if (value === null) {
    return { ok: true, value: "null" };
  }
  if (typeof value === "string") {
    return { ok: true, value: quoted(value) };
  }
  if (typeof value === "boolean") {
    return { ok: true, value: value ? "true" : "false" };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false };
    }
    return { ok: true, value: Object.is(value, -0) ? "0" : String(value) };
  }
  if (typeof value !== "object") {
    return { ok: false };
  }
  if (active.has(value)) {
    return { ok: false };
  }

  active.add(value);
  const result = Array.isArray(value) ? canonicalizeArray(value, active) : canonicalizeObject(value, active);
  active.delete(value);
  return result;
}

export function canonicalJson(value: unknown): RecoveryResult<string> {
  try {
    const result = canonicalize(value, new WeakSet<object>());
    return result.ok
      ? recoverySuccess(result.value)
      : recoveryFailure(RecoveryErrorCodes.canonicalizationFailed, "The value cannot be represented as strict canonical JSON.", ["CONTACT_OPERATOR"]);
  } catch {
    return recoveryFailure(RecoveryErrorCodes.canonicalizationFailed, "The value cannot be represented as strict canonical JSON.", ["CONTACT_OPERATOR"]);
  }
}

export function browserSha256Crypto(): Sha256Crypto | undefined {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle === undefined) {
      return undefined;
    }
    return { digest: (bytes) => subtle.digest("SHA-256", bytes) };
  } catch {
    return undefined;
  }
}

export async function sha256Fingerprint(value: unknown, cryptoCapability: Sha256Crypto | null | undefined = browserSha256Crypto()): Promise<RecoveryResult<`sha256:${string}`>> {
  const canonical = canonicalJson(value);
  if (!canonical.ok) {
    return recoveryFailure(canonical.error.code, canonical.error.message, canonical.error.actions);
  }
  if (cryptoCapability === undefined || cryptoCapability === null) {
    return recoveryFailure(RecoveryErrorCodes.cryptoUnavailable, "SHA-256 is unavailable in this browser context.", ["RETRY", "CONTACT_OPERATOR"]);
  }

  try {
    const digest = await cryptoCapability.digest(new TextEncoder().encode(canonical.data));
    const bytes = new Uint8Array(digest);
    if (bytes.length !== 32) {
      return recoveryFailure(RecoveryErrorCodes.cryptoFailure, "SHA-256 returned an invalid digest.", ["RETRY", "CONTACT_OPERATOR"]);
    }
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return recoverySuccess<`sha256:${string}`>(`sha256:${hex}`);
  } catch {
    return recoveryFailure(RecoveryErrorCodes.cryptoFailure, "SHA-256 could not fingerprint the recovery plan.", ["RETRY", "CONTACT_OPERATOR"]);
  }
}
