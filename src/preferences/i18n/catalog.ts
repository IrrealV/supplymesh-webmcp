import type { FilterCategory } from "../../app/state/useUiCoordinationStore";
import { en } from "./en";
import { es } from "./es";

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export type Catalog = { account: string; retry: string; webMcpChecking: string; webMcpRequired: string; all: string; ambient: string; cancel: string; cargo: string; chilled: string; clearanceComparison: string; closeInspection: string; collapseRail: string; consoleControls: string; consoleUnavailable: string; critical: string; currentRoute: string; delay: string; delete: string; deleteConsequence: string; deleteVehicle: string; destination: string; dimensions: string; driving: string; drivingRestRisk: string; eta: string; fleetFilters: string; fleetNumber: string; followVehicle: string; frozen: string; help: string; heightComparison: string; invalidLabel: string; label: string; language: string; languageEnglish: string; languageSpanish: string; length: string; meters: string; minutes: string; needsAttention: string; notAvailable: string; operationalMap: string; origin: string; plate: string; priority: string; priorityCritical: string; priorityStandard: string; priorityUrgent: string; refrigeration: string; remainingDrive: string; restDeadline: string; resting: string; riskComparison: string; roadRestrictionIssues: string; route: string; saveLabel: string; selectVehicle: string; status: string; statusCritical: string; statusDriving: string; statusNeedsAttention: string; statusResting: string; tonnes: string; vehicleHeight: string; vehicleInspection: string; vehicleType: string; weatherAffected: string; weight: string };

const catalogs: Record<Locale, Catalog> = { en, es };
const filterKeys: Record<FilterCategory, keyof Catalog> = { all: "all", resting: "resting", "needs-attention": "needsAttention", critical: "critical", "weather-affected": "weatherAffected", "driving-rest-risk": "drivingRestRisk", "road-restriction-issues": "roadRestrictionIssues" };

export function catalog(locale: Locale = "en"): Catalog { return catalogs[locale]; }
export function filterLabel(category: FilterCategory, locale: Locale = "en"): string { return catalog(locale)[filterKeys[category]]; }
export function interpolate(template: string, values: Record<string, string | number>): string { return Object.entries(values).reduce((message, [key, value]) => message.replaceAll(`{${key}}`, String(value)), template); }

export type OperationalCopy = { activeFilters: string; lowClearance: string; operationalOverview: string; removeFilter: string; restDeadlineRisk: string; roadClosure: string; severeWeather: string; severityCritical: string; severityHigh: string; severityLow: string; severityMedium: string; weightRestriction: string };
const operationalCatalogs: Record<Locale, OperationalCopy> = {
  en: { activeFilters: "{count} active filters", lowClearance: "Low clearance", operationalOverview: "Operational overview", removeFilter: "Remove {filter}", restDeadlineRisk: "Driving and rest deadline", roadClosure: "Road closure", severeWeather: "Severe weather", severityCritical: "Critical", severityHigh: "High", severityLow: "Low", severityMedium: "Medium", weightRestriction: "Weight restriction" },
  es: { activeFilters: "{count} filtros activos", lowClearance: "Gálibo reducido", operationalOverview: "Resumen operativo", removeFilter: "Quitar {filter}", restDeadlineRisk: "Límite de conducción y descanso", roadClosure: "Carretera cerrada", severeWeather: "Meteorología adversa", severityCritical: "Crítica", severityHigh: "Alta", severityLow: "Baja", severityMedium: "Media", weightRestriction: "Restricción de peso" },
};
export function operationalCopy(locale: Locale): OperationalCopy { return operationalCatalogs[locale]; }
