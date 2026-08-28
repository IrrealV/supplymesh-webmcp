import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { OperationalShell } from "./OperationalShell";
import { Topbar } from "./Topbar";

vi.mock("../map/FleetMap", () => ({ FleetMap: () => <div data-testid="fleet-map" /> }));

function resetUi(): void {
  useUiCoordinationStore.setState({ activeFilter: "", drawerOpen: false, isRailExpanded: false, isFollowing: false, selectedVehicleId: "" });
}

describe("OperationalShell", () => {
  beforeEach(resetUi);
  afterEach(cleanup);

  it("should render only approved topbar chrome without a drawer before selection", async () => {
    const user = userEvent.setup();
    render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createOperationsApi(createZustandScenarioRepository())} scenario={createSpainScenario()} />);

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
    expect(useUiCoordinationStore.getState().selectedVehicleId).toBe("vehicle-002");
    useUiCoordinationStore.getState().closeDrawer();

    expect(useUiCoordinationStore.getState().selectedVehicleId).toBe("");
    expect(useUiCoordinationStore.getState().drawerOpen).toBe(false);
    expect(scenario.vehicles).toHaveLength(15);
  });

  it("should switch the visible language immediately", async () => {
    const user = userEvent.setup();
    function LocalizedTopbar() { const [locale, setLocale] = useState<"en" | "es">("en"); return <Topbar locale={locale} onLocaleChange={setLocale} />; }
    render(<LocalizedTopbar />);

    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByRole("menuitem", { name: "Español" }));

    expect(screen.getByRole("button", { name: "Ayuda" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Idioma" })).not.toBeNull();
  });
});
