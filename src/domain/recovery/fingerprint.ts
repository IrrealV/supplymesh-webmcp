function canonicalValue(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Unsupported canonical number.");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new Error("Unsupported canonical value.");
  }
  if (ancestors.has(value)) {
    throw new Error("Cyclic canonical value.");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalValue(entry, ancestors)).join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Unsupported canonical object.");
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key], ancestors)}`);
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalSerialize(value: unknown): string {
  return canonicalValue(value, new Set<object>());
}

function fnv1a64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createPlanFingerprint(payload: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalSerialize(payload))}`;
}
