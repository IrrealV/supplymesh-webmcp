import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { OperationalShell } from "./OperationalShell";

vi.mock("../map/FleetMap", () => ({ FleetMap: () => <div data-testid="fleet-map" /> }));

function resetUi(): void {
  useUiCoordinationStore.setState({ activeFilter: "", drawerOpen: false, isRailExpanded: false, isFollowing: false, selectedVehicleId: "" });
}

describe("OperationalShell", () => {
  beforeEach(resetUi);
  afterEach(cleanup);

  it("should render only approved topbar chrome without a drawer before selection", async () => {
    const user = userEvent.setup();
    render(<OperationalShell scenario={createSpainScenario()} />);

    expect(screen.getByText("SupplyMesh")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Help" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Account" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByText("English")).not.toBeNull();
    expect(screen.getByText("Español")).not.toBeNull();
    expect(screen.getByTestId("fleet-map")).not.toBeNull();
    expect(screen.queryByText(/LIVE|WebMCP|Agent|Simulation|Chat/i)).toBeNull();
    expect(screen.queryByRole("complementary", { name: /inspection/i })).toBeNull();
  });

  it("should coordinate replacement selection and close without mutating scenario data", () => {
    const scenario = createSpainScenario();

    useUiCoordinationStore.getState().selectVehicle("vehicle-001");
    useUiCoordinationStore.getState().selectVehicle("vehicle-002");
    useUiCoordinationStore.getState().closeDrawer();

    expect(useUiCoordinationStore.getState().selectedVehicleId).toBe("");
    expect(useUiCoordinationStore.getState().drawerOpen).toBe(false);
    expect(scenario.vehicles).toHaveLength(15);
  });
});
