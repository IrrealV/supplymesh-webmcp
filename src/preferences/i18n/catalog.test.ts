import { describe, expect, it } from "vitest";
import { catalog, locales } from "./catalog";
import { LOCALE_STORAGE_KEY, loadLocale, saveLocale } from "./localeStorage";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("locale catalog", () => {
  it("should provide complete English and Spanish copy for every locale", () => {
    const englishKeys = Object.keys(catalog("en")).sort();
    const spanishKeys = Object.keys(catalog("es")).sort();

    expect(locales).toEqual(["en", "es"]);
    expect(spanishKeys).toEqual(englishKeys);
    expect(Object.values(catalog("en")).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(catalog("es")).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("should persist a selected locale and recover English from corrupt storage", () => {
    const storage = new MemoryStorage();

    saveLocale(storage, "es");
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
    expect(loadLocale(storage)).toBe("es");

    storage.setItem(LOCALE_STORAGE_KEY, "fr");
    expect(loadLocale(storage)).toBe("en");
  });
});
