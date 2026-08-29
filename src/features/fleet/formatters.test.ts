import { describe, expect, it } from "vitest";
import { catalog } from "../../preferences/i18n/catalog";
import { formatDateTime, formatDuration, formatNumberUnit, formatRiskKind, formatStatus } from "./formatters";

describe("inspection formatters", () => {
  it.each([
    { locale: "en" as const, expected: "4h 33m" },
    { locale: "es" as const, expected: "4 h 33 min" },
  ])("should humanize minutes in $locale", ({ expected, locale }) => {
    expect(formatDuration(273, locale, catalog(locale).notAvailable)).toBe(expected);
  });

  it("should localize dates and numeric units without exposing ISO values", () => {
    const english = formatDateTime("2026-08-28T10:30:00Z", "en", "Not available");
    const spanish = formatDateTime("2026-08-28T10:30:00Z", "es", "No disponible");

    expect(english).toContain("28 Aug 2026");
    expect(spanish).toContain("28 ago 2026");
    expect(spanish).not.toContain("2026-08-28T10:30:00Z");
    expect(formatNumberUnit(3.8, "m", "es", "No disponible")).toBe("3,8 m");
  });

  it("should localize status and risk enums through the typed catalog", () => {
    expect(formatStatus("needs-attention", catalog("es"))).toBe("Requiere atención");
    expect(formatRiskKind("rest-deadline", catalog("es"))).toBe("Límite de conducción y descanso");
  });
});
