import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getVehicleDisplayName } from "../../domain/entities";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { deriveMapLayers, selectVisibleRisks } from "./layers";

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

  it("should hide rest deadlines until a vehicle is selected and then show only its deadline", () => {
    const scenario = createSpainScenario();
    const overview = deriveMapLayers(scenario, new Set(), "");
    const selected = deriveMapLayers(scenario, new Set(), "vehicle-001");

    expect(selectVisibleRisks(overview.risks, "").some(({ risk }) => risk.kind === "rest-deadline")).toBe(false);
    expect(selectVisibleRisks(selected.risks, "vehicle-001").filter(({ risk }) => risk.kind === "rest-deadline")).toHaveLength(1);
    expect(selectVisibleRisks(selected.risks, "vehicle-001").find(({ risk }) => risk.kind === "rest-deadline")?.risk.affectedVehicleIds).toContain("vehicle-001");
    expect(selectVisibleRisks(overview.risks, "").some(({ risk }) => risk.kind === "severe-snow")).toBe(true);
  });

  it("should present severe weather as an icon-led blue zone without an inline snow label", () => {
    const mapSource = readFileSync("src/features/map/FleetMap.tsx", "utf8");
    const styles = readFileSync("src/styles.css", "utf8");

    expect(mapSource).toContain("String.fromCodePoint(0x2744)");
    expect(mapSource).not.toContain('risk.kind === "severe-snow" ? "SNOW"');
    expect(mapSource).toContain('const WEATHER_RISK_COLOR = "#1268e8"');
    expect(mapSource).toContain('<Polygon key={shapeKey} {...pathOptions}');
    expect(mapSource).toContain('key={`${entry.route.id}:${entry.state}`} {...routeStyle(entry)}');
    expect(styles).toContain(".risk-severe-snow .risk-marker-label { display: none; }");
    expect(styles).toContain('.fleet-map[data-close-range-mode="active"] .leaflet-tile-pane');
    expect(styles).toContain('.fleet-map[data-close-range-mode="active"] .route-corridor-selected');
    expect(styles).toContain('.fleet-map[data-close-range-mode="active"]::after');
  });

  it("should allow only presentation and accepted scenario dependencies in visual map files", () => {
    const sources = ["FleetMap.tsx", "layers.ts", "VehicleMarkerLayer.tsx", "closeRangeMode.ts", "closeRangeMotion.ts", "labelPlacement.ts", "MapLegend.tsx", "MapEventCoordinator.ts"]
      .map((file) => readFileSync(`src/features/map/${file}`, "utf8"))
      .join("\n");
    const allowedImports = new Set(["@phosphor-icons/react", "leaflet", "react", "react-leaflet", "../../app/presentation/useTabletViewport", "../../app/state/useUiCoordinationStore", "../../domain/entities", "../../preferences/i18n/catalog", "../fleet/filtering", "../recovery-comparison/RecoveryComparisonLayers", "../recovery-comparison/unit211RecoveryComparisonModel", "./closeRangeMode", "./closeRangeMotion", "./layers", "./labelPlacement", "./MapEventCoordinator", "./MapLegend", "./VehicleMarkerLayer"]);
    const imports = [...sources.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    const networkCall = new RegExp(`\\b${["fet", "ch"].join("")}\\s*\\(`);

    expect(imports.every((dependency) => allowedImports.has(dependency))).toBe(true);
    expect(sources).not.toMatch(networkCall);
    expect(sources).toContain("scenario.routes");
    expect(sources).toContain("duration: 0.85");
    expect(sources).toContain("entry.route.id !== comparison?.alternative.id");
    expect(sources).toContain("(comparison ?? availableComparison)?.incident.riskId");
    expect(sources).toContain("maxZoom={18}");
    expect(sources).toContain("CLOSE_RANGE_FOCUS_ZOOM");
    expect(sources).toContain("}, [closeRangeVehicleId, map, vehicles]);");
  });
});
