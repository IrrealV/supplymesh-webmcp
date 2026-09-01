export type DeepDetachResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; reason: "MALFORMED_VALUE" }>;

const DEPTH_MAX = 128;
const NODE_COUNT_MAX = 100_000;

export function deepDetachAndFreeze<T>(value: T): DeepDetachResult<T> {
  const clones = new WeakMap<object, object>();
  const active = new WeakSet<object>();
  let nodeCount = 0;

  function clone(current: unknown, depth: number): unknown | false {
    if (current === null || typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number") return current;
    if (typeof current !== "object" || depth > DEPTH_MAX) return false;
    nodeCount += 1;
    if (nodeCount > NODE_COUNT_MAX || active.has(current)) return false;
    const existing = clones.get(current);
    if (existing !== undefined) return existing;

    active.add(current);
    try {
      const keys = Reflect.ownKeys(current);
      if (Array.isArray(current)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current, "length");
        if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || keys.length !== lengthDescriptor.value + 1) return false;
        const copy: unknown[] = new Array(lengthDescriptor.value);
        clones.set(current, copy);
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return false;
          const child = clone(descriptor.value, depth + 1);
          if (child === false && descriptor.value !== false) return false;
          copy[index] = child;
        }
        return Object.freeze(copy);
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return false;
      const copy = Object.create(prototype) as Record<string, unknown>;
      clones.set(current, copy);
      for (const key of keys) {
        if (typeof key !== "string") return false;
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return false;
        const child = clone(descriptor.value, depth + 1);
        if (child === false && descriptor.value !== false) return false;
        Object.defineProperty(copy, key, { configurable: false, enumerable: true, value: child, writable: false });
      }
      return Object.freeze(copy);
    } catch {
      return false;
    } finally {
      active.delete(current);
    }
  }

  const detached = clone(value, 0);
  return detached === false && value !== false ? Object.freeze({ ok: false, reason: "MALFORMED_VALUE" as const }) : Object.freeze({ ok: true, data: detached as T });
}
