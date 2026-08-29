import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getVehicleDisplayName } from "../../domain/entities";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { deriveMapLayers } from "./layers";

describe("FleetMap layers", () => {
  it("should preserve all accepted route coordinates and fallback marker labels", () => {
    const scenario = createSpainScenario();
    const layers = deriveMapLayers(scenario, new Set(), "");

    expect(layers.vehicles).toHaveLength(15);
    expect(layers.routes).toHaveLength(15);
    expect(layers.risks).toHaveLength(19);
    expect(getVehicleDisplayName(scenario.vehicles[0])).toBe("FM-201");
    expect(layers.routes.every((entry, index) => entry.route.geometry.geometry.coordinates === scenario.routes[index].geometry.geometry.coordinates)).toBe(true);
    expect(layers.vehicles.every((entry) => entry.state === "normal")).toBe(true);
  });

  it("should distinguish OR matches, muted context, selection, and selected z-order", () => {
    const scenario = createSpainScenario();
    const filtered = deriveMapLayers(scenario, new Set(["critical", "weather-affected"]), "");
    const selected = deriveMapLayers(scenario, new Set(["critical"]), "vehicle-001");

    expect(filtered.vehicles.filter((entry) => entry.state === "matched")).toHaveLength(5);
    expect(filtered.vehicles.filter((entry) => entry.state === "muted")).toHaveLength(10);
    expect(filtered.risks.filter((entry) => entry.state === "matched").every((entry) => entry.risk.kind === "severe-snow")).toBe(true);
    expect(filtered.risks.filter((entry) => entry.risk.kind === "rest-deadline").every((entry) => entry.state === "muted")).toBe(true);
    expect(selected.vehicles.find((entry) => entry.state === "selected")?.zIndex).toBeGreaterThan(1000);
    expect(selected.routes.at(-1)?.state).toBe("selected");
    expect(selected.risks.filter((entry) => entry.state === "selected").every((entry) => entry.risk.affectedVehicleIds.includes("vehicle-001"))).toBe(true);
  });

  it("should allow only presentation and accepted scenario dependencies in visual map files", () => {
    const sources = ["FleetMap.tsx", "layers.ts", "VehicleMarkerLayer.tsx", "labelPlacement.ts", "MapLegend.tsx", "MapEventCoordinator.ts"]
      .map((file) => readFileSync(`src/features/map/${file}`, "utf8"))
      .join("\n");
    const allowedImports = new Set(["leaflet", "react", "react-leaflet", "../../app/state/useUiCoordinationStore", "../../domain/entities", "../../preferences/i18n/catalog", "../fleet/filtering", "./layers", "./labelPlacement", "./MapEventCoordinator", "./MapLegend", "./VehicleMarkerLayer"]);
    const imports = [...sources.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    const networkCall = new RegExp(`\\b${["fet", "ch"].join("")}\\s*\\(`);

    expect(imports.every((dependency) => allowedImports.has(dependency))).toBe(true);
    expect(sources).not.toMatch(networkCall);
    expect(sources).toContain("scenario.routes");
  });
});
