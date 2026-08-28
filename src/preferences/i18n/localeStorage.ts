import type { StorageLike } from "../../scenario/persistence/overrideStorage";
import type { Locale } from "./catalog";

export const LOCALE_STORAGE_KEY = "locale:v1";

export function loadLocale(storage: StorageLike): Locale {
  return storage.getItem(LOCALE_STORAGE_KEY) === "es" ? "es" : "en";
}

export function saveLocale(storage: StorageLike, locale: Locale): boolean {
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

export function browserLocaleStorage(): StorageLike {
  try { return globalThis.localStorage ?? { getItem: () => null, setItem: () => undefined }; } catch { return { getItem: () => null, setItem: () => undefined }; }
}
