import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { FilterRail } from "./FilterRail";
import { filterCount } from "./filtering";

const scenario = createSpainScenario();
const styles = readFileSync("src/styles.css", "utf8");

function resetUi(): void {
  useUiCoordinationStore.setState(useUiCoordinationStore.getInitialState(), true);
}

describe("FilterRail", () => {
  beforeEach(resetUi);
  afterEach(cleanup);

  it("should render an expand control and seven compact categories with deterministic counts and tooltips", async () => {
    const user = userEvent.setup();
    render(<FilterRail locale="en" scenario={scenario} />);

    const controls = screen.getAllByRole("button");
    await user.hover(controls[2]);

    expect(controls).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Expand filters" })).not.toBeNull();
    expect(controls[1].getAttribute("aria-describedby")).toBe("filter-all-count");
    expect(screen.getByText("Resting")).not.toBeNull();
    expect(filterCount("all", scenario)).toBe(15);
    expect(filterCount("weather-affected", scenario)).toBe(3);
  });

  it("should animate the rail on the compositor without resizing the map grid", () => {
    expect(styles).toContain("--rail-expanded-width: 322px");
    expect(styles).toContain("transform: translate3d(calc(var(--rail-compact-width) - var(--rail-expanded-width)), 0, 0)");
    expect(styles).not.toContain("transition: grid-template-columns");
  });

  it("should keep Leaflet zoom controls clear of the expanded desktop and tablet rail", () => {
    expect(styles).toContain(".console-workspace.rail-is-expanded .leaflet-control-zoom");
    expect(styles).toContain(".console-workspace.rail-is-expanded .map-legend");
    expect(styles).toContain("transform: translate3d(234px, 0, 0)");
    expect(styles).toContain("transform: translate3d(228px, 0, 0)");
  });

  it("should expand from the compact disclosure control without changing active filters", async () => {
    const user = userEvent.setup();
    render(<FilterRail locale="en" scenario={scenario} />);

    await user.click(screen.getByRole("button", { name: "Expand filters" }));

    expect(useUiCoordinationStore.getState().railState).toBe("expanded");
    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual([]);
    expect(screen.getByRole("button", { name: "Collapse filters" })).not.toBeNull();
  });

  it("should expand and toggle the active filter while preserving compact collapse behavior", async () => {
    const user = userEvent.setup();
    render(<FilterRail locale="en" scenario={scenario} />);

    await user.click(screen.getByRole("button", { name: "Needs attention" }));

    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["needs-attention"]);
    expect(useUiCoordinationStore.getState().railState).toBe("expanded");
    expect(screen.getByRole("button", { name: "Collapse filters" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /Critical/ }));
    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["needs-attention", "critical"]);

    await user.click(screen.getByRole("button", { name: /Needs attention/ }));

    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["critical"]);
    expect(useUiCoordinationStore.getState().railState).toBe("expanded");
  });

  it("should keep the rail compact after activating a filter on tablet", async () => {
    const user = userEvent.setup();
    render(<FilterRail isTablet locale="en" scenario={scenario} />);

    await user.click(screen.getByRole("button", { name: "Critical" }));

    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["critical"]);
    expect(useUiCoordinationStore.getState().railState).toBe("compact");
  });
});
