import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { deriveMapLayers } from "./layers";
import { VehicleMarkerLayer } from "./VehicleMarkerLayer";

vi.mock("react-leaflet", () => ({
  Marker: ({ eventHandlers, icon, title, zIndexOffset }: { eventHandlers: { click(): void }; icon: { options: { html: string } }; title: string; zIndexOffset: number }) => (
    <button aria-label={title} data-html={icon.options.html} data-z-index={zIndexOffset} onClick={eventHandlers.click} type="button" />
  ),
}));

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
    expect(Number(labelControls[3].getAttribute("data-z-index"))).toBeGreaterThan(Number(labelControls[0].getAttribute("data-z-index")));

    await user.click(labelControls[3]);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("vehicle-004");
  });
});
