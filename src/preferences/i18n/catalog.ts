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
