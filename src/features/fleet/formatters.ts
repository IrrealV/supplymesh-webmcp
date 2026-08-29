import type { OperationalRisk, RiskKind, VehicleStatus } from "../../domain/entities";
import { catalog, interpolate, type Catalog, type Locale } from "../../preferences/i18n/catalog";

function localeTag(locale: Locale): string { return locale === "es" ? "es-ES" : "en-GB"; }

export function present(value: string, fallback: string): string { return value.trim() || fallback; }

export function formatDuration(minutes: number, locale: Locale, fallback: string): string {
  if (!Number.isFinite(minutes) || minutes < 0) return fallback;
  const copy = catalog(locale);
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  const spacer = locale === "es" ? " " : "";
  return [hours > 0 ? `${hours}${spacer}${copy.hoursShort}` : "", remainder > 0 || hours === 0 ? `${remainder}${spacer}${copy.minutesShort}` : ""].filter(Boolean).join(" ");
}

export function formatDateTime(value: string, locale: Locale, fallback: string): string {
  const date = new Date(value);
  if (!value.trim() || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(localeTag(locale), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date);
}

export function formatNumberUnit(value: number, unit: string, locale: Locale, fallback: string): string {
  return Number.isFinite(value) ? `${new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 1 }).format(value)} ${unit}` : fallback;
}

export function formatStatus(status: VehicleStatus, copy: Catalog): string {
  return status === "driving" ? copy.statusDriving : status === "resting" ? copy.statusResting : status === "needs-attention" ? copy.statusNeedsAttention : copy.statusCritical;
}

export function formatRiskKind(kind: RiskKind, copy: Catalog): string {
  if (kind === "height-restriction") return copy.riskHeight;
  if (kind === "weight-restriction") return copy.riskWeight;
  if (kind === "road-closure") return copy.riskClosure;
  if (kind === "severe-snow") return copy.riskSnow;
  return copy.riskRest;
}

export function formatRiskImpact(kind: RiskKind, copy: Catalog): string {
  if (kind === "height-restriction") return copy.riskImpactHeight;
  if (kind === "weight-restriction") return copy.riskImpactWeight;
  if (kind === "road-closure") return copy.riskImpactClosure;
  if (kind === "severe-snow") return copy.riskImpactSnow;
  return copy.riskImpactRest;
}

export function riskComparison(risk: OperationalRisk, height: number, weight: number, locale: Locale, copy: Catalog): string {
  if (risk.limitMeters !== undefined) return interpolate(copy.heightComparison, { height: new Intl.NumberFormat(localeTag(locale)).format(height), clearance: new Intl.NumberFormat(localeTag(locale)).format(risk.limitMeters) });
  if (risk.limitTonnes !== undefined) return interpolate(copy.clearanceComparison, { weight: new Intl.NumberFormat(localeTag(locale)).format(weight), limit: new Intl.NumberFormat(localeTag(locale)).format(risk.limitTonnes) });
  return "";
}

export function coordinateDistanceKilometers(from: number[], to: number[]): number {
  if (from.length < 2 || to.length < 2) return Number.NaN;
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const latitudeDelta = radians(to[1] - from[1]);
  const longitudeDelta = radians(to[0] - from[0]);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
