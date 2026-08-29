import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { FilterRail } from "./FilterRail";
import { filterCount } from "./filtering";

const scenario = createSpainScenario();

function resetUi(): void {
  useUiCoordinationStore.setState(useUiCoordinationStore.getInitialState(), true);
}

describe("FilterRail", () => {
  beforeEach(resetUi);
  afterEach(cleanup);

  it("should render seven compact categories with deterministic counts and tooltips", async () => {
    const user = userEvent.setup();
    render(<FilterRail locale="en" scenario={scenario} />);

    const controls = screen.getAllByRole("button");
    await user.hover(controls[1]);

    expect(controls).toHaveLength(7);
    expect(controls[0].getAttribute("aria-describedby")).toBe("filter-all-count");
    expect(screen.getByText("Resting")).not.toBeNull();
    expect(filterCount("all", scenario)).toBe(15);
    expect(filterCount("weather-affected", scenario)).toBe(3);
  });

  it("should expand and toggle the active filter while preserving compact collapse behavior", async () => {
    const user = userEvent.setup();
    render(<FilterRail locale="en" scenario={scenario} />);

    await user.click(screen.getAllByRole("button")[2]);

    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["needs-attention"]);
    expect(useUiCoordinationStore.getState().railState).toBe("expanded");
    expect(screen.getByRole("button", { name: "Collapse filters" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /Critical/ }));
    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["needs-attention", "critical"]);

    await user.click(screen.getByRole("button", { name: /Needs attention/ }));

    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["critical"]);
    expect(useUiCoordinationStore.getState().railState).toBe("expanded");
  });
});
