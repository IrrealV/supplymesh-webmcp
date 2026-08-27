import type { FilterCategory } from "../../app/state/useUiCoordinationStore";

export type Locale = "en" | "es";
type Catalog = {
  account: string;
  all: string;
  collapseRail: string;
  drivingRestRisk: string;
  help: string;
  language: string;
  needsAttention: string;
  roadRestrictionIssues: string;
  resting: string;
  critical: string;
  weatherAffected: string;
};

const catalogs: Record<Locale, Catalog> = {
  en: {
    account: "Account", all: "All vehicles", collapseRail: "Collapse filters", drivingRestRisk: "Driving and rest risk",
    help: "Help", language: "Language", needsAttention: "Needs attention", roadRestrictionIssues: "Road and restriction issues",
    resting: "Resting", critical: "Critical", weatherAffected: "Weather affected",
  },
  es: {
    account: "Cuenta", all: "Todos los vehículos", collapseRail: "Contraer filtros", drivingRestRisk: "Riesgo de conducción y descanso",
    help: "Ayuda", language: "Idioma", needsAttention: "Requiere atención", roadRestrictionIssues: "Incidencias viales y restricciones",
    resting: "En descanso", critical: "Crítico", weatherAffected: "Afectado por el clima",
  },
};

const filterKeys: Record<FilterCategory, keyof Catalog> = {
  all: "all", resting: "resting", "needs-attention": "needsAttention", critical: "critical",
  "weather-affected": "weatherAffected", "driving-rest-risk": "drivingRestRisk", "road-restriction-issues": "roadRestrictionIssues",
};

export function catalog(locale: Locale = "en"): Catalog {
  return catalogs[locale];
}

export function filterLabel(category: FilterCategory, locale: Locale = "en"): string {
  return catalogs[locale][filterKeys[category]];
}
