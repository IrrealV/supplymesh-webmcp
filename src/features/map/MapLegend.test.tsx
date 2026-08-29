import { cleanup, render, screen } from "@testing-library/react";
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
});
