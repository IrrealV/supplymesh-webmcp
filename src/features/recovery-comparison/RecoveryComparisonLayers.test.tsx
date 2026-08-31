import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplication } from "../../app/createApplication";
import { RecoveryComparisonLayers } from "./RecoveryComparisonLayers";
import { createUnit211RecoveryComparisonModel } from "./unit211RecoveryComparisonModel";
vi.mock("leaflet", () => ({ divIcon: (options: object) => options }));
vi.mock("react-leaflet", () => ({
  Marker: ({ eventHandlers, position, title }: { eventHandlers?: { click(): void }; position: [number, number]; title: string }) => <button aria-label={title} data-position={JSON.stringify(position)} onClick={eventHandlers?.click} type="button" />,
  Pane: () => null,
  Polygon: ({ positions }: { positions: readonly unknown[] }) => <i data-count={positions.length} data-testid="comparison-exclusion" />,
  Polyline: ({ pathOptions, positions }: { pathOptions: { className: string }; positions: readonly unknown[] }) => <i data-count={positions.length} data-testid={pathOptions.className} />,
}));
afterEach(cleanup);
describe("RecoveryComparisonLayers", () => {
  it("should select the operation-derived incident and reveal only exact comparison geometry on review", () => {
    const model = createUnit211RecoveryComparisonModel(createApplication().unit211PreDispatchContext(), "en"); const onIncidentSelect = vi.fn<(vehicleId: string) => void>();
    if (model.kind !== "ready") throw new Error(model.reasonCode);
    const view = render(<RecoveryComparisonLayers comparison={false} locale="en" model={model} onIncidentSelect={onIncidentSelect} />);
    const incident = screen.getByRole("button", { name: "Select Unit 211 clearance incident" });
    expect(incident.dataset.position).toBe(JSON.stringify([model.incident.position[1], model.incident.position[0]]));
    fireEvent.click(incident); expect(onIncidentSelect).toHaveBeenCalledWith(model.vehicle.id);
    expect(screen.queryByTestId("recovery-current-route")).toBeNull();
    view.rerender(<RecoveryComparisonLayers comparison locale="en" model={model} />);
    expect(screen.getByTestId("recovery-current-route").dataset.count).toBe("1120");
    expect(screen.getByTestId("recovery-alternative-route").dataset.count).toBe("743");
    expect(screen.getByTestId("comparison-exclusion").dataset.count).toBe("65");
  });
});
