import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { deriveMapLayers } from "./layers";
import { VehicleMarkerLayer } from "./VehicleMarkerLayer";

const styles = readFileSync("src/styles.css", "utf8");

const mapMock = vi.hoisted(() => ({
  container: undefined as HTMLDivElement | undefined,
  handlers: new Map<string, () => void>(),
  zoom: 6.5,
}));

vi.mock("react-leaflet", () => ({
  Marker: ({ eventHandlers, icon, title, zIndexOffset }: { eventHandlers: { click(): void }; icon: { options: { html: string } }; title: string; zIndexOffset: number }) => (
    <button aria-label={title} data-html={icon.options.html} data-z-index={zIndexOffset} onClick={eventHandlers.click} type="button" />
  ),
  useMap: () => ({
    getContainer: () => mapMock.container!,
    getZoom: () => mapMock.zoom,
    off: vi.fn((events: string) => mapMock.handlers.delete(events)),
    on: vi.fn((events: string, handler: () => void) => mapMock.handlers.set(events, handler)),
  }),
}));

beforeEach(() => {
  mapMock.container = document.createElement("div");
  mapMock.handlers.clear();
  mapMock.zoom = 6.5;
});
afterEach(cleanup);

describe("VehicleMarkerLayer", () => {
  it("should render separate accessible truck and label controls with status pins", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const layers = deriveMapLayers(createSpainScenario(), new Set(["critical"]), "vehicle-004");
    render(<VehicleMarkerLayer locale="en" onSelect={onSelect} vehicles={layers.vehicles} />);

    const truckControls = screen.getAllByRole("button", { name: /^Select .* truck$/ });
    const labelControls = screen.getAllByRole("button", { name: /^Select .* label$/ });
    expect(truckControls).toHaveLength(15);
    expect(labelControls).toHaveLength(15);
    expect(truckControls[0].getAttribute("data-html")).toContain("fleet-status-pin");
    expect(truckControls[0].getAttribute("data-html")).toContain("fleet-selection-aura");
    expect(Number(labelControls[3].getAttribute("data-z-index"))).toBeGreaterThan(Number(labelControls[0].getAttribute("data-z-index")));

    await user.click(labelControls[3]);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("vehicle-004");
  });

  it("should run a noticeable breath-in breath-out cycle from inside the selected truck", () => {
    expect(styles).toContain(".map-layer-selected .fleet-selection-aura");
    expect(styles).toContain("animation: vehicle-selection-breath-in-out 2.4s 900ms cubic-bezier(.45, 0, .55, 1) infinite alternate both");
    expect(styles).toContain("scale(.72)");
    expect(styles).toContain("scale(1.35)");
    expect(styles).toContain("will-change: opacity, transform");
    expect(styles).toContain("@keyframes vehicle-selection-breath-in-out");
    expect(styles).toContain(".map-layer-selected .fleet-selection-aura { animation: none;");
  });

  it("should reveal labels only once the map reaches zoom 7.5", () => {
    const layers = deriveMapLayers(createSpainScenario(), new Set(), "");
    render(<VehicleMarkerLayer locale="en" onSelect={vi.fn()} vehicles={layers.vehicles} />);

    expect(mapMock.container?.classList.contains("map-labels-visible")).toBe(false);

    mapMock.zoom = 7.5;
    mapMock.handlers.get("zoom zoomend")?.();

    expect(mapMock.container?.classList.contains("map-labels-visible")).toBe(true);

    mapMock.zoom = 7;
    mapMock.handlers.get("zoom zoomend")?.();

    expect(mapMock.container?.classList.contains("map-labels-visible")).toBe(false);
  });
});
