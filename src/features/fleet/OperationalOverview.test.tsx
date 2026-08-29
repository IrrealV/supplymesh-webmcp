import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { OperationalOverview } from "./OperationalOverview";

describe("OperationalOverview", () => {
  beforeEach(() => useUiCoordinationStore.setState(useUiCoordinationStore.getInitialState(), true));
  afterEach(cleanup);

  it("should render real overview counts and activate equivalent filters", async () => {
    const user = userEvent.setup();
    render(<OperationalOverview locale="en" scenario={createSpainScenario()} />);

    expect(screen.getByRole("heading", { name: "Operational overview" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "All vehicles, 15" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Resting, 4" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Needs attention, 3" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Critical, 3" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Critical, 3" }));
    expect([...useUiCoordinationStore.getState().activeFilters]).toEqual(["critical"]);
    expect(useUiCoordinationStore.getState().panelContext.mode).toBe("results");
  });
});
