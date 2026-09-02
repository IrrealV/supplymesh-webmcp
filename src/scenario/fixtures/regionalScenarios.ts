import { createSpainScenario } from "./spain-v1";
import { createFranceScenario } from "./france-v1";
import { createGermanyScenario } from "./germany-v1";
import type { OperatingRegion } from "../../domain/entities";

export function getScenarioForRegion(regionId: string): OperatingRegion | undefined {
  switch (regionId) {
    case "spain-v1": return createSpainScenario();
    case "france-v1": return createFranceScenario();
    case "germany-v1": return createGermanyScenario();
    default: return undefined;
  }
}
export const regionalCatalog = [
  { id: "spain-v1", name: "Spain · Iberia Core" },
  { id: "france-v1", name: "France · Occitanie & Rhône" },
  { id: "germany-v1", name: "Germany · Rhine-Ruhr & Bavaria" }
];
