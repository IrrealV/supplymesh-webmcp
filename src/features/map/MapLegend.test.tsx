import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MapLegend } from "./MapLegend";

afterEach(cleanup);

describe("MapLegend", () => {
  it("should expose every required layer meaning in a compact accessible group", () => {
    render(<MapLegend locale="en" />);

    const legend = screen.getByRole("group", { name: "Map legend" });
    expect(legend.querySelectorAll("li")).toHaveLength(5);
    expect(legend.textContent).toContain("Route");
    expect(legend.textContent).toContain("Road and restriction issues");
    expect(legend.textContent).toContain("Road closure");
    expect(legend.textContent).toContain("Weather affected");
    expect(legend.textContent).toContain("Driving and rest risk");
  });

  it("should start collapsed and remain user-toggleable on tablet", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ addEventListener: () => undefined, matches: true, removeEventListener: () => undefined }) });
    try {
      const user = userEvent.setup();
      render(<MapLegend locale="en" />);

      const toggle = screen.getByRole("button", { name: "Map legend" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByRole("list", { hidden: true }).getAttribute("aria-hidden")).toBe("true");

      await user.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByRole("list", { hidden: true }).getAttribute("aria-hidden")).toBe("false");
    } finally { Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia }); }
  });
});
