import { describe, expect, it } from "vitest";
import { MapEventCoordinator } from "./MapEventCoordinator";

describe("MapEventCoordinator", () => {
  it("should preserve follow through overlapping programmatic focus and layout changes", () => {
    const coordinator = new MapEventCoordinator();

    coordinator.beginProgrammaticChange();
    coordinator.beginProgrammaticChange();
    coordinator.settleProgrammaticChange();

    expect(coordinator.shouldCancelFollowForViewportMove()).toBe(false);
    coordinator.settleProgrammaticChange();
    expect(coordinator.shouldCancelFollowForViewportMove()).toBe(true);
  });

  it.each(["drag", "wheel", "zoom-control", "pinch", "keyboard", "replacement-selection"])("should cancel follow for %s navigation", () => {
    const coordinator = new MapEventCoordinator();
    coordinator.beginProgrammaticChange();

    expect(coordinator.recordManualInteraction()).toBe(true);
    expect(coordinator.shouldCancelFollowForViewportMove()).toBe(true);
  });
});
