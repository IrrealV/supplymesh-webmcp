import type { FilterCategory } from "../../app/state/useUiCoordinationStore";
import { en } from "./en";
import { es } from "./es";

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export type Catalog = {
  account: string; actions: string; all: string; ambient: string; approximateDistance: string; cancel: string; cargo: string; cargoTab: string; chilled: string; clearanceComparison: string; closeInspection: string; closeResults: string; collapseRail: string; expandRail: string; consoleControls: string; consoleUnavailable: string; critical: string; currentRisk: string; currentRoute: string; delay: string; delete: string; deleteConsequence: string; deleteVehicle: string; destination: string; dimensions: string; driverTab: string; driving: string; drivingRestRisk: string; eta: string; fleetFilters: string; fleetNumber: string; followVehicle: string; frozen: string; help: string; heightComparison: string; hoursShort: string; identity: string; impact: string; invalidLabel: string; label: string; labelSaved: string; language: string; languageEnglish: string; languageSpanish: string; length: string; meters: string; minutes: string; minutesShort: string; needsAttention: string; noCurrentRisk: string; notAvailable: string; operationalMap: string; operationalSummary: string; origin: string; plate: string; priority: string; priorityCritical: string; priorityStandard: string; priorityUrgent: string; refrigeration: string; remainingDrive: string; restDeadline: string; resting: string; retry: string; riskClosure: string; riskComparison: string; riskHeight: string; riskImpactClosure: string; riskImpactHeight: string; riskImpactRest: string; riskImpactSnow: string; riskImpactWeight: string; riskRest: string; riskSnow: string; riskWeight: string; roadRestrictionIssues: string; route: string; saveLabel: string; selectVehicle: string; status: string; statusCritical: string; statusDriving: string; statusNeedsAttention: string; statusResting: string; tonnes: string; vehicleHeight: string; vehicleInspection: string; vehicleTab: string; vehicleType: string; viewOnRoute: string; weatherAffected: string; webMcpChecking: string; webMcpRequired: string; weight: string; whyAttention: string;
};

const catalogs: Record<Locale, Catalog> = { en, es };
const filterKeys: Record<FilterCategory, keyof Catalog> = { all: "all", resting: "resting", "needs-attention": "needsAttention", critical: "critical", "weather-affected": "weatherAffected", "driving-rest-risk": "drivingRestRisk", "road-restriction-issues": "roadRestrictionIssues" };

export function catalog(locale: Locale = "en"): Catalog { return catalogs[locale]; }
export function filterLabel(category: FilterCategory, locale: Locale = "en"): string { return catalog(locale)[filterKeys[category]]; }
export function interpolate(template: string, values: Record<string, string | number>): string { return Object.entries(values).reduce((message, [key, value]) => message.replaceAll(`{${key}}`, String(value)), template); }

export type OperationalCopy = { activeFilters: string; closeOverview: string; lowClearance: string; openOverview: string; operationalOverview: string; removeFilter: string; restDeadlineRisk: string; roadClosure: string; severeWeather: string; severityCritical: string; severityHigh: string; severityLow: string; severityMedium: string; weightRestriction: string };
const operationalCatalogs: Record<Locale, OperationalCopy> = {
  en: { activeFilters: "{count} active filters", closeOverview: "Close operational overview", lowClearance: "Low clearance", openOverview: "Open operational overview", operationalOverview: "Operational overview", removeFilter: "Remove {filter}", restDeadlineRisk: "Driving and rest deadline", roadClosure: "Road closure", severeWeather: "Severe weather", severityCritical: "Critical", severityHigh: "High", severityLow: "Low", severityMedium: "Medium", weightRestriction: "Weight restriction" },
  es: { activeFilters: "{count} filtros activos", closeOverview: "Cerrar resumen operativo", lowClearance: "Gálibo reducido", openOverview: "Abrir resumen operativo", operationalOverview: "Resumen operativo", removeFilter: "Quitar {filter}", restDeadlineRisk: "Límite de conducción y descanso", roadClosure: "Carretera cerrada", severeWeather: "Meteorología adversa", severityCritical: "Crítica", severityHigh: "Alta", severityLow: "Baja", severityMedium: "Media", weightRestriction: "Restricción de peso" },
};
export function operationalCopy(locale: Locale): OperationalCopy { return operationalCatalogs[locale]; }
