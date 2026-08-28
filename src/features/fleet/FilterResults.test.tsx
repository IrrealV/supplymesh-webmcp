import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { FilterResults } from "./FilterResults";

describe("FilterResults", () => {
  beforeEach(() => useUiCoordinationStore.setState(useUiCoordinationStore.getInitialState(), true));
  afterEach(cleanup);

  it("should distinguish OR context, render deduped cards, and select with one activation", async () => {
    const user = userEvent.setup();
    const scenario = createSpainScenario();
    scenario.vehicles[3] = { ...scenario.vehicles[3], label: "" };
    useUiCoordinationStore.getState().toggleFilter("critical", "filter-critical");
    useUiCoordinationStore.getState().toggleFilter("weather-affected", "filter-weather-affected");

    render(<FilterResults locale="en" scenario={scenario} />);

    expect(screen.getByRole("heading", { name: "2 active filters" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove Critical" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Remove Weather affected" })).not.toBeNull();
    const cards = screen.getAllByRole("button", { name: /Select/ });
    expect(cards).toHaveLength(5);
    expect(within(cards[0]).getByText("FM-204")).not.toBeNull();
    expect(within(cards[0]).getByText("Barcelona → Valencia")).not.toBeNull();
    expect(within(cards[0]).getByText("Critical")).not.toBeNull();
    expect(within(cards[0]).getByText("Severe weather")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Select Unit 209" }).textContent).toContain("Delay 25 min");

    await user.click(cards[0]);
    expect(useUiCoordinationStore.getState().selection).toEqual({ kind: "vehicle", vehicleId: "vehicle-004" });
    expect(useUiCoordinationStore.getState().panelContext).toEqual({ mode: "results", returnFocusId: "result-vehicle-004" });
  });

  it("should remove chips independently and restore All when the final chip is removed", async () => {
    const user = userEvent.setup();
    useUiCoordinationStore.getState().toggleFilter("critical", "filter-critical");
    useUiCoordinationStore.getState().toggleFilter("resting", "filter-resting");
    render(<FilterResults locale="en" scenario={createSpainScenario()} />);

    await user.click(screen.getByRole("button", { name: "Remove Critical" }));
    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["resting"]);
    await user.click(screen.getByRole("button", { name: "Remove Resting" }));
    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual([]);
    expect(useUiCoordinationStore.getState().panelContext.mode).toBe("overview");
  });
});
